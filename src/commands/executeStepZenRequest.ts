import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { resolveStepZenProjectRoot } from "../utils/stepzenProject";
import { clearResultsPanel, openResultsPanel } from "../panels/resultsPanel";
import { summariseDiagnostics, publishDiagnostics } from "../utils/runtimeDiagnostics";
import { runtimeDiag } from "../extension";
import { UI, TIMEOUTS, TEMP_FILE_PATTERNS } from "../utils/constants";
import { services } from "../services";
import { StepZenResponse, StepZenDiagnostic } from "../types";
import { ValidationError, handleError } from "../errors";


/**
 * Creates a temporary GraphQL file with the provided query content
 * @param content The GraphQL query content to write to the file
 * @returns Path to the created temporary file
 */
function createTempGraphQLFile(content: string): string {
  if (!content || typeof content !== 'string') {
    throw new ValidationError(
      "Invalid query content: expected a non-empty string",
      "INVALID_QUERY_CONTENT"
    );
  }
  
  const tempDir = os.tmpdir();
  const timestamp = new Date().getTime();
  const randomPart = Math.random().toString(36).substring(2, 10);
  const filename = `${TEMP_FILE_PATTERNS.QUERY_PREFIX}${timestamp}-${randomPart}${TEMP_FILE_PATTERNS.GRAPHQL_EXTENSION}`;
  const filePath = path.join(tempDir, filename);
  
  try {
    fs.writeFileSync(filePath, content, 'utf8');
    services.logger.debug(`Created temporary query file: ${filePath}`);
    return filePath;
  } catch (err) {
    throw new ValidationError(
      `Failed to create temporary file: ${err instanceof Error ? err.message : String(err)}`,
      "FILE_CREATE_FAILED",
      err
    );
  }
}

/**
 * Schedules cleanup of a temporary file
 * @param filePath Path to the temporary file to clean up
 */
function cleanupLater(filePath: string) {
  if (!filePath || typeof filePath !== 'string') {
    services.logger.warn("Invalid path provided to cleanupLater");
    return;
  }
  
  setTimeout(() => {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        services.logger.debug(`Cleaned up temporary file: ${filePath}`);
      }
    } catch (e) {
      handleError(new ValidationError(
        `Failed to clean up temporary file: ${filePath}`,
        "FILE_CLEANUP_FAILED",
        e
      ));
    }
  }, TIMEOUTS.FILE_CLEANUP_DELAY_MS);
}

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
 * @returns Promise that resolves when execution completes
 */
export async function executeStepZenRequest(options: {
  queryText?: string;
  documentContent?: string;
  operationName?: string;
  varArgs?: string[];
}): Promise<void> {
  const { queryText, documentContent, operationName, varArgs = [] } = options;

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
          // Execute the persisted document request using the request service
          const result = await services.request.executePersistedDocumentRequest(
            endpointConfig,
            documentContent,
            variables,
            operationName
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
          `--file "${tmpFile}"`,
        ];
        
        // Add operation name if specified
        // Log operation name
        if (operationName) {
          services.logger.info(`Using specified operation: "${operationName}"`);
        } else {
          services.logger.debug('No operation name specified, letting StepZen select the default operation');
        }
        
        // Add debug level header - properly escape quotes for shell
        parts.push('--header', `"stepzen-debug-level: ${debugLevel}"`);
        
        // Add variable arguments
        parts.push(...varArgs);
        
        const cmd = parts.filter(Boolean).join(" ");
        services.logger.info(`Executing StepZen request in terminal${operationName ? ` for operation "${operationName}"` : ' (anonymous operation)'}`);
        services.logger.debug(`Terminal command: ${cmd}`);
        term.sendText(`cd "${projectRoot}" && ${cmd}`);
        
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
          
          // Use the CLI service to execute the request
          services.logger.info(`Executing StepZen request${operationName ? ` for operation "${operationName}"` : ' (anonymous operation)'} with debug level ${debugLevel}`);
          services.logger.debug(`Calling CLI service with request${operationName ? ` for operation "${operationName}"` : ' (no operation specified)'}`);
          const stdout = await services.cli.request(queryText, variables, operationName, debugLevel);
          services.logger.debug("Received response from StepZen CLI service");
          
          let json: StepZenResponse;
          try {
            // Parse the response as JSON
            services.logger.debug(`Parsing JSON response${operationName ? ` for operation "${operationName}"` : ''}`);
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
          services.logger.info(`StepZen request completed successfully${operationName ? ` for operation "${operationName}"` : ''}`);
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
