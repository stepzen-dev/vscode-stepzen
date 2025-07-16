import * as vscode from "vscode";
import { resolveStepZenProjectRoot } from "../utils/stepzenProject";
import { clearResultsPanel, openResultsPanel } from "../panels/resultsPanel";
import { summariseDiagnostics, publishDiagnostics } from "../utils/runtimeDiagnostics";
import { runtimeDiag } from "../extension";
import { UI } from "../utils/constants";
import { createTempGraphQLFile, cleanupLater } from "../utils/tempFiles";
import { services } from "../services";
import { StepZenResponse, StepZenDiagnostic } from "../types";
import { ValidationError, handleError } from "../errors";




/**
 * Executes a StepZen request using the CLI service
 * 
 * This function handles both persisted document requests and file-based requests,
 * with support for variables and operation selection.
 * 
 * @param options Options for the request
 * @param options.queryText Optional GraphQL query text for file-based requests
 * @param options.documentId Optional document ID for persisted document requests
 * @param options.operationName Optional name of the operation to execute
 * @param options.varArgs Optional variable arguments (--var, --var-file)
 * @param options.auth Optional authorization info (admin or jwt)
 * @returns Promise that resolves when execution completes
 */
export async function executeStepZenRequest(options: {
  queryText?: string;
  documentContent?: string;
  operationName?: string;
  varArgs?: string[];
  auth?: { type: 'admin' | 'jwt', jwt?: string };
}): Promise<void> {
  const { queryText, documentContent, operationName, varArgs = [], auth } = options;

  // Validate request options using the request service
  try {
    services.request.validateRequestOptions({ queryText, documentContent, operationName, varArgs });
  } catch (err) {
    handleError(err);
    return;
  }

  // Resolve project root
  let projectRoot: string;
  try {
    projectRoot = await resolveStepZenProjectRoot();
  } catch (err) {
    handleError(err);
    return;
  }

  const cfg = vscode.workspace.getConfiguration("stepzen");
  const debugLevel = cfg.get<number>("request.debugLevel", 1);

  // Prepare headers based on auth selection
  let customHeaders: Record<string, string> = {};
  let adminKey: string | undefined;
  if (auth?.type === 'jwt') {
    // Always need the admin key for debug header
    adminKey = await services.request.getApiKey();
    customHeaders = {
      'Authorization': `Bearer ${auth.jwt}`,
      'StepZen-Debug-Authorization': `apikey ${adminKey}`,
      'stepzen-debug-level': String(debugLevel),
    };
  } else {
    // Default: admin key in Authorization
    adminKey = await services.request.getApiKey();
    customHeaders = {
      'Authorization': `Apikey ${adminKey}`,
      'stepzen-debug-level': String(debugLevel),
    };
  }

  // For persisted documents, we need to make an HTTP request directly
  if (documentContent) {
    try {
      // Load endpoint configuration using the request service
      const endpointConfig = await services.request.loadEndpointConfig(projectRoot);
      // Parse variables using the request service
      const { variables } = services.request.parseVariables(varArgs);
      // Show a progress notification
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Executing StepZen request...",
          cancellable: false
        },
        async () => {
          // Execute the persisted document request using the request service, passing custom headers
          const result = await services.request.executePersistedDocumentRequest(
            endpointConfig,
            documentContent,
            variables,
            operationName,
            customHeaders
          );
          // Process results
          const rawDiags = (result.extensions?.stepzen?.diagnostics ?? []) as StepZenDiagnostic[];
          services.logger.info("Processing diagnostics for persisted operation...");
          const summaries = summariseDiagnostics(rawDiags);
          publishDiagnostics(summaries, runtimeDiag);
          services.logger.info("Persisted document request completed successfully");
          await openResultsPanel(result);
        }
      );
      return;
    } catch (err: unknown) {
      handleError(err);
      return;
    }
  }

  // For regular file-based requests, use the CLI service
  if (!queryText) {
    handleError(new ValidationError("No query provided for file-based request.", "MISSING_QUERY_TEXT"));
    return;
  }

  // Create a temp file for the query, which we'll need for Terminal mode
  let tmpFile: string | undefined;
  try {
    // Terminal output mode with debug level 0
    if (debugLevel === 0) {
      try {
        tmpFile = createTempGraphQLFile(queryText);
        const term = vscode.window.createTerminal(UI.TERMINAL_NAME);
        term.show();
        // Build CLI command for terminal
        const parts = [
          "stepzen request",
          `--file \"${tmpFile}\"`,
        ];
        // Add operation name if specified
        if (operationName) {
          services.logger.info(`Using specified operation: \"${operationName}\"`);
        } else {
          services.logger.debug('No operation name specified, letting StepZen select the default operation');
        }
        // Add custom headers
        for (const [key, value] of Object.entries(customHeaders)) {
          parts.push('--header', `\"${key}: ${value}\"`);
        }
        // Add variable arguments
        parts.push(...varArgs);
        const cmd = parts.filter(Boolean).join(" ");
        services.logger.info(`Executing StepZen request in terminal${operationName ? ` for operation \"${operationName}\"` : ' (anonymous operation)'}`);
        services.logger.debug(`Terminal command: ${cmd}`);
        term.sendText(`cd \"${projectRoot}\" && ${cmd}`);
        // Cleanup temp file later
        cleanupLater(tmpFile);
      } catch (err) {
        handleError(err);
      }
      return;
    }
    // JSON result mode with progress notification
    services.logger.info("Executing StepZen request with CLI service...");
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Executing StepZen request...",
        cancellable: false
      },
      async () => {
        try {
          // Parse variables using the request service
          const { variables } = services.request.parseVariables(varArgs);
          // Use the CLI service to execute the request, passing custom headers
          services.logger.info(`Executing StepZen request${operationName ? ` for operation \"${operationName}\"` : ' (anonymous operation)'} with debug level ${debugLevel}`);
          services.logger.debug(`Calling CLI service with request${operationName ? ` for operation \"${operationName}\"` : ' (no operation specified)'}`);
          const stdout = await services.cli.request(queryText, variables, operationName, debugLevel, customHeaders);
          services.logger.debug("Received response from StepZen CLI service");
          let json: StepZenResponse;
          try {
            // Parse the response as JSON
            services.logger.debug(`Parsing JSON response${operationName ? ` for operation \"${operationName}\"` : ''}`);
            json = JSON.parse(stdout) as StepZenResponse;
          } catch (parseErr) {
            throw new ValidationError(
              "Failed to parse StepZen CLI response",
              "CLI_RESPONSE_PARSE_ERROR",
              parseErr
            );
          }
          // Process results
          const rawDiags = (json.extensions?.stepzen?.diagnostics ?? []) as StepZenDiagnostic[];
          services.logger.info("Processing diagnostics for file-based request...");
          const summaries = summariseDiagnostics(rawDiags);
          publishDiagnostics(summaries, runtimeDiag);
          await openResultsPanel(json);
          services.logger.info(`StepZen request completed successfully${operationName ? ` for operation \"${operationName}\"` : ''}`);
        } catch (err) {
          handleError(err);
          // Clear any partial results
          clearResultsPanel();
        }
      }
    );
  } catch (err: unknown) {
    handleError(err);
  }
}
