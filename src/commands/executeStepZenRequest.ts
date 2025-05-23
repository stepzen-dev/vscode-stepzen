import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as https from "https";
import { resolveStepZenProjectRoot } from "../utils/stepzenProject";
import { clearResultsPanel, openResultsPanel } from "../panels/resultsPanel";
import { summariseDiagnostics, publishDiagnostics } from "../utils/runtimeDiagnostics";
import { runtimeDiag } from "../extension";
import { UI, TIMEOUTS, TEMP_FILE_PATTERNS, FILE_PATTERNS } from "../utils/constants";
import { services } from "../services";
import { StepZenResponse, StepZenDiagnostic } from "../types";
import { ValidationError, NetworkError, handleError } from "../errors";

/* CLEANUP - DELETE WHEN SAFE
// Export utility functions for use in other files
export {
  createTempGraphQLFile,
  cleanupLater
};
*/

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
  documentId?: string;
  operationName?: string;
  varArgs?: string[];
}): Promise<void> {
  // Validate options object
  if (!options || typeof options !== 'object') {
    handleError(new ValidationError("Invalid request options provided", "INVALID_OPTIONS"));
    return;
  }

  const { queryText, documentId, operationName, varArgs = [] } = options;

  // Validate at least one of queryText or documentId is provided and valid
  if (documentId === undefined && (!queryText || typeof queryText !== 'string')) {
    handleError(new ValidationError("Invalid request: either documentId or queryText must be provided", "MISSING_QUERY"));
    return;
  }

  // Validate operationName if provided
  if (operationName !== undefined && typeof operationName !== 'string') {
    handleError(new ValidationError("Invalid operation name provided", "INVALID_OPERATION_NAME"));
    return;
  }

  // Validate varArgs is an array
  if (!Array.isArray(varArgs)) {
    handleError(new ValidationError("Invalid variable arguments: expected an array", "INVALID_VAR_ARGS"));
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
  if (documentId) {
    try {
      // Get StepZen config to build the endpoint URL
      const configPath = path.join(projectRoot, FILE_PATTERNS.CONFIG_FILE);
      services.logger.debug(`Looking for config file at: ${configPath}`);
        
      // Verify config file exists
      if (!fs.existsSync(configPath)) {
        handleError(new ValidationError(
          `StepZen configuration file not found at: ${configPath}`,
          "CONFIG_NOT_FOUND"
        ));
        return;
      }
      
      let endpoint: string;
      let apiKey: string;

      try {
        const configContent = fs.readFileSync(configPath, "utf8");
        
        if (!configContent) {
          handleError(new ValidationError("StepZen configuration file is empty", "EMPTY_CONFIG"));
          return;
        }
        
        const config = JSON.parse(configContent);
        
        if (!config || !config.endpoint) {
          handleError(new ValidationError("Invalid StepZen configuration: missing endpoint", "MISSING_ENDPOINT"));
          return;
        }
        
        endpoint = config.endpoint;
        apiKey = config.apiKey || "";
      } catch (err) {
        handleError(new ValidationError(
          "Failed to parse StepZen configuration file",
          "CONFIG_PARSE_ERROR",
          err
        ));
        return;
      }

      // Parse endpoint to extract account and domain
      const endpointParts = endpoint.split("/");
      if (endpointParts.length < 2) {
        handleError(new ValidationError(
          `Invalid StepZen endpoint format: ${endpoint}`,
          "INVALID_ENDPOINT_FORMAT"
        ));
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
            handleError(new ValidationError(
              "Failed to read variables file",
              "VAR_FILE_READ_ERROR",
              err
            ));
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
          services.logger.info("Making HTTP request to StepZen API for persisted document");
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
                  reject(new ValidationError(
                    "Failed to parse StepZen response",
                    "RESPONSE_PARSE_ERROR",
                    err
                  ));
                }
              });
            });
            
            req.on('error', (err) => {
              reject(new NetworkError(
                "Failed to connect to StepZen API",
                "API_CONNECTION_ERROR",
                err
              ));
            });
            
            req.write(postData);
            req.end();
          });
          
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
          // Parse varArgs into variables object
          const variables: Record<string, any> = {};
          for (let i = 0; i < varArgs.length; i += 2) {
            if (varArgs[i] === "--var" && i + 1 < varArgs.length) {
              const [name, value] = varArgs[i + 1].split("=");
              if (name && value !== undefined) {
                variables[name] = value;
                services.logger.debug(`Setting variable ${name}=${value}`);
              } else {
                services.logger.warn(`Invalid variable format: ${varArgs[i + 1]}`);
              }
            } else if (varArgs[i] === "--var-file" && i + 1 < varArgs.length) {
              try {
                const varFilePath = varArgs[i + 1];
                services.logger.debug(`Reading variables from file: ${varFilePath}`);
                if (!fs.existsSync(varFilePath)) {
                  throw new ValidationError(`Variables file not found: ${varFilePath}`, "VAR_FILE_NOT_FOUND");
                }
                const fileContent = fs.readFileSync(varFilePath, "utf8");
                const fileVars = JSON.parse(fileContent);
                services.logger.debug(`Loaded ${Object.keys(fileVars).length} variables from file`);
                Object.assign(variables, fileVars);
              } catch (err) {
                throw new ValidationError(
                  "Failed to read variables file",
                  "VAR_FILE_READ_ERROR",
                  err
                );
              }
            }
          }
          
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
