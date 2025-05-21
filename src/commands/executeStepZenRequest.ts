import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as cp from "child_process";
import * as https from "https";
import { parse, NamedTypeNode, OperationDefinitionNode } from "graphql";
import { resolveStepZenProjectRoot } from "../utils/stepzenProject";
import { formatError, createError } from "../utils/errors";
import { clearResultsPanel, openResultsPanel } from "../panels/resultsPanel";
import { logger } from "../services/logger";
import { summariseDiagnostics, publishDiagnostics } from "../utils/runtimeDiagnostics";
import { runtimeDiag, cliService } from "../extension";
import { getOperationMap, getPersistedDocMap, OperationEntry } from "../utils/stepzenProjectScanner";
import { UI, TIMEOUTS } from "../utils/constants";
import { StepZenConfig, StepZenResponse, StepZenDiagnostic } from "../types";

// Export utility functions for use in other files
export {
  createTempGraphQLFile,
  cleanupLater
};

/**
 * Creates a temporary GraphQL file with the provided query content
 * @param content The GraphQL query content to write to the file
 * @returns Path to the created temporary file
 */
function createTempGraphQLFile(content: string): string {
  if (!content || typeof content !== 'string') {
    throw createError(
      "Invalid query content: expected a non-empty string",
      "Create Temporary GraphQL File", 
      undefined,
      "user"
    );
  }
  
  const tempDir = os.tmpdir();
  const timestamp = new Date().getTime();
  const randomPart = Math.random().toString(36).substring(2, 10);
  const filename = `stepzen-query-${timestamp}-${randomPart}.graphql`;
  const filePath = path.join(tempDir, filename);
  
  try {
    fs.writeFileSync(filePath, content, 'utf8');
    logger.debug(`Created temporary query file: ${filePath}`);
    return filePath;
  } catch (err) {
    throw createError(
      `Failed to create temporary file: ${err instanceof Error ? err.message : String(err)}`,
      "Create Temporary GraphQL File",
      err,
      "filesystem"
    );
  }
}

/**
 * Schedules cleanup of a temporary file
 * @param filePath Path to the temporary file to clean up
 */
function cleanupLater(filePath: string): void {
  // Validate the path isn't empty
  if (!filePath || typeof filePath !== 'string') {
    logger.warn("Invalid path provided to cleanupLater");
    return;
  }

  setTimeout(() => {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        logger.debug(`Cleaned up temporary file: ${filePath}`);
      }
    } catch (e) {
      logger.warn(`Failed to clean up temporary file: ${e}`);
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
  documentId?: string;
  operationName?: string;
  varArgs?: string[];
}): Promise<void> {
  // Validate options object
  if (!options || typeof options !== 'object') {
    vscode.window.showErrorMessage("Invalid request options provided");
    return;
  }

  const { queryText, documentId, operationName, varArgs = [] } = options;

  // Validate at least one of queryText or documentId is provided and valid
  if (documentId === undefined && (!queryText || typeof queryText !== 'string')) {
    vscode.window.showErrorMessage("Invalid request: either documentId or queryText must be provided");
    return;
  }

  // Validate operationName if provided
  if (operationName !== undefined && typeof operationName !== 'string') {
    vscode.window.showErrorMessage("Invalid operation name provided");
    return;
  }

  // Validate varArgs is an array
  if (!Array.isArray(varArgs)) {
    vscode.window.showErrorMessage("Invalid variable arguments: expected an array");
    return;
  }

  // Resolve project root
  let projectRoot: string;
  try {
    projectRoot = await resolveStepZenProjectRoot();
  } catch (err) {
    const errorMsg = formatError(err);
    vscode.window.showErrorMessage(errorMsg);
    logger.error(`Failed to resolve project root`, err);
    return;
  }

  const cfg = vscode.workspace.getConfiguration("stepzen");
  const debugLevel = cfg.get<number>("request.debugLevel", 1);

  // For persisted documents, we need to make an HTTP request directly
  if (documentId) {
    try {
      // Get StepZen config to build the endpoint URL
      const configPath = path.join(projectRoot, "stepzen.config.json");
      logger.debug(`Looking for config file at: ${configPath}`);
        
      // Verify config file exists
      if (!fs.existsSync(configPath)) {
        const error = createError(
          `StepZen configuration file not found at: ${configPath}`,
          "Execute StepZen Request",
          undefined,
          "config"
        );
        vscode.window.showErrorMessage(formatError(error));
        logger.error(`Configuration error: ${formatError(error)}`, error);
        return;
      }
      
      let endpoint: string;
      let apiKey: string;

      try {
        const configContent = fs.readFileSync(configPath, "utf8");
        
        if (!configContent) {
          vscode.window.showErrorMessage("StepZen configuration file is empty");
          return;
        }
        
        const config = JSON.parse(configContent);
        
        if (!config || !config.endpoint) {
          vscode.window.showErrorMessage("Invalid StepZen configuration: missing endpoint");
          return;
        }
        
        endpoint = config.endpoint;
        apiKey = config.apiKey || "";
      } catch (err) {
        const error = createError(
          "Failed to parse StepZen configuration file",
          "Execute StepZen Request",
          err,
          "parse"
        );
        vscode.window.showErrorMessage(formatError(error));
        logger.error(`Configuration error: ${formatError(error)}`, error);
        return;
      }

      // Parse endpoint to extract account and domain
      const endpointParts = endpoint.split("/");
      if (endpointParts.length < 2) {
        const error = createError(
          `Invalid StepZen endpoint format: ${endpoint}`,
          "Execute StepZen Request",
          undefined,
          "config"
        );
        vscode.window.showErrorMessage(formatError(error));
        logger.error(formatError(error), error);
        return;
      }

      // Construct the GraphQL endpoint URL
      const graphqlUrl = `https://${endpoint}/graphql`;

      // Prepare variables from varArgs
      let variables: Record<string, string> = {};
      for (let i = 0; i < varArgs.length; i += 2) {
        if (varArgs[i] === "--var" && i + 1 < varArgs.length) {
          const [name, value] = varArgs[i + 1].split("=");
          variables[name] = value;
        } else if (varArgs[i] === "--var-file" && i + 1 < varArgs.length) {
          try {
            const fileContent = fs.readFileSync(varArgs[i + 1], "utf8");
            variables = JSON.parse(fileContent);
          } catch (err) {
            const error = createError(
              "Failed to read variables file",
              "Execute StepZen Request",
              err,
              "filesystem"
            );
            vscode.window.showErrorMessage(formatError(error));
            logger.error(formatError(error), error);
            return;
          }
        }
      }

      // Prepare the request body
      const requestBody = {
        documentId,
        operationName,
        variables
      };

      // Show a progress notification
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Executing StepZen request...",
          cancellable: false
        },
        async () => {
          logger.info("Making HTTP request to StepZen API for persisted document");
          // Use Node.js https module to make the request
          const result = await new Promise<StepZenResponse>((resolve, reject) => {
            const postData = JSON.stringify(requestBody);
            
            const options = {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
                'Authorization': apiKey ? `Apikey ${apiKey}` : '',
                'stepzen-debug-level': debugLevel.toString(),
              }
            };
            
            const req = https.request(graphqlUrl, options, (res) => {
              let responseData = '';
              
              res.on('data', (chunk) => {
                responseData += chunk;
              });
              
              res.on('end', () => {
                try {
                  const json = JSON.parse(responseData);
                  resolve(json);
                } catch (err) {
                  reject(createError(
                    "Failed to parse StepZen response",
                    "Execute StepZen Request",
                    err,
                    "parse"
                  ));
                }
              });
            });
            
            req.on('error', (err) => {
              reject(createError(
                "Failed to connect to StepZen API",
                "Execute StepZen Request",
                err,
                "network"
              ));
            });
            
            req.write(postData);
            req.end();
          });
          
          // Process results
          const rawDiags = (result.extensions?.stepzen?.diagnostics ?? []) as StepZenDiagnostic[];
          logger.info("Processing diagnostics for persisted operation...");
          const summaries = summariseDiagnostics(rawDiags);
          publishDiagnostics(summaries, runtimeDiag);
          
          logger.info("Persisted document request completed successfully");
          await openResultsPanel(result);
        }
      );
      
      return;
    } catch (err: unknown) {
      const errorMsg = formatError(err);
      vscode.window.showErrorMessage(`StepZen request failed: ${errorMsg}`);
      logger.error(`StepZen request failed: ${errorMsg}`, err);
      return;
    }
  }

  // For regular file-based requests, use the CLI service
  if (!queryText) {
    vscode.window.showErrorMessage("No query provided for file-based request.");
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
        if (operationName) {
          parts.push(`--operation-name "${operationName}"`);
          logger.info(`Using specified operation: "${operationName}"`);
        } else {
          logger.debug('No operation name specified, letting StepZen select the default operation');
        }
        
        // Add debug level header - properly escape quotes for shell
        parts.push('--header', `"stepzen-debug-level: ${debugLevel}"`);
        
        // Add variable arguments
        parts.push(...varArgs);
        
        const cmd = parts.filter(Boolean).join(" ");
        logger.info(`Executing StepZen request in terminal${operationName ? ` for operation "${operationName}"` : ' (anonymous operation)'}`);
        logger.debug(`Terminal command: ${cmd}`);
        term.sendText(`cd "${projectRoot}" && ${cmd}`);
        
        // Cleanup temp file later
        cleanupLater(tmpFile);
      } catch (err) {
        const errorMsg = formatError(err);
        vscode.window.showErrorMessage(`Failed to execute terminal request: ${errorMsg}`);
        logger.error(`Terminal request failed: ${formatError(err, true)}`, err);
      }
      return;
    }

    // JSON result mode with progress notification
    logger.info("Executing StepZen request with CLI service...");
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Executing StepZen request...",
        cancellable: false
      },
      async () => {
        try {
          // Parse varArgs into variables object
          const variables: Record<string, any> = {};
          for (let i = 0; i < varArgs.length; i += 2) {
            if (varArgs[i] === "--var" && i + 1 < varArgs.length) {
              const [name, value] = varArgs[i + 1].split("=");
              if (name && value !== undefined) {
                variables[name] = value;
                logger.debug(`Setting variable ${name}=${value}`);
              } else {
                logger.warn(`Invalid variable format: ${varArgs[i + 1]}`);
              }
            } else if (varArgs[i] === "--var-file" && i + 1 < varArgs.length) {
              try {
                const varFilePath = varArgs[i + 1];
                logger.debug(`Reading variables from file: ${varFilePath}`);
                if (!fs.existsSync(varFilePath)) {
                  throw new Error(`Variables file not found: ${varFilePath}`);
                }
                const fileContent = fs.readFileSync(varFilePath, "utf8");
                const fileVars = JSON.parse(fileContent);
                logger.debug(`Loaded ${Object.keys(fileVars).length} variables from file`);
                Object.assign(variables, fileVars);
              } catch (err) {
                throw createError(
                  "Failed to read variables file",
                  "Execute StepZen Request",
                  err,
                  "filesystem"
                );
              }
            }
          }
          
          // Use the CLI service to execute the request
          logger.info(`Executing StepZen request${operationName ? ` for operation "${operationName}"` : ' (anonymous operation)'} with debug level ${debugLevel}`);
          logger.debug(`Calling CLI service with request${operationName ? ` for operation "${operationName}"` : ' (no operation specified)'}`);
          const stdout = await cliService.request(queryText, variables, operationName, debugLevel);
          logger.debug("Received response from StepZen CLI service");
          
          let json: StepZenResponse;
          try {
            logger.debug(`Parsing JSON response${operationName ? ` for operation "${operationName}"` : ''}`);
            json = JSON.parse(stdout) as StepZenResponse;
          } catch (parseErr) {
            throw createError(
              "Failed to parse StepZen CLI response",
              "Execute StepZen Request",
              parseErr,
              "parse"
            );
          }

          // Process results
          const rawDiags = (json.extensions?.stepzen?.diagnostics ?? []) as StepZenDiagnostic[];
          logger.info("Processing diagnostics for file-based request...");
          const summaries = summariseDiagnostics(rawDiags);
          publishDiagnostics(summaries, runtimeDiag);

          await openResultsPanel(json);
          logger.info(`StepZen request completed successfully${operationName ? ` for operation "${operationName}"` : ''}`);
        } catch (err) {
          const errorMsg = formatError(err);
          vscode.window.showErrorMessage(`Failed to execute request: ${errorMsg}`);
          logger.error(`Failed to execute request: ${formatError(err, true)}`, err);
          // Clear any partial results
          clearResultsPanel();
        }
      }
    );
  } catch (err: unknown) {
    const errorMsg = formatError(err);
    vscode.window.showErrorMessage(`StepZen request failed: ${errorMsg}`);
    logger.error(`StepZen request failed: ${errorMsg}`, err);
  }
}