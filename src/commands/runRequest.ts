// src/commands/runRequest.ts
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
import { stepzenOutput, logger } from "../utils/logger";
import { summariseDiagnostics, publishDiagnostics } from "../utils/runtimeDiagnostics";
import { runtimeDiag } from "../extension";
import { getOperationMap, getPersistedDocMap, OperationEntry } from "../utils/stepzenProjectScanner";
import { UI, TIMEOUTS } from "../utils/constants";
import { StepZenConfig, StepZenResponse, StepZenDiagnostic } from "../types";

/* -------------------------------------------------------------
 * Helpers that existed previously (kept verbatim)
 * ------------------------------------------------------------*/
/**
 * Extracts operation names from a GraphQL query string
 * @param query The GraphQL query string to parse
 * @returns Array of operation names found in the query
 */
function extractOperationNames(query: string): string[] {
  if (!query || typeof query !== 'string') {
    logger.warn("Invalid query provided to extractOperationNames");
    return [];
  }
  
  const regex = /(query|mutation|subscription)\s+(\w+)/g;
  return [...query.matchAll(regex)].map(([, , name]) => name);
}

/**
 * Creates a temporary file containing the GraphQL query
 * @param query The GraphQL query string to write to the file
 * @returns Path to the created temporary file
 * @throws Error if query is invalid
 */
function createTempGraphQLFile(query: string): string {
  // Add validation
  if (!query || typeof query !== 'string') {
    throw createError(
      "Invalid query: expected a non-empty string",
      "Create Temporary GraphQL File", 
      undefined,
      "user"
    );
  }

  const tmpDir = os.tmpdir();
  const tmp = path.join(
    tmpDir,
    `stepzen-request-${Math.random().toString(36).slice(2)}.graphql`
  );
  fs.writeFileSync(tmp, query);
  return tmp;
}

const SCALARS = new Set(["String", "ID", "Int", "Float", "Boolean"]);

/* -------------------------------------------------------------
 * Helper – ask user for variable values / file
 * ------------------------------------------------------------*/
/**
 * Prompts the user to provide variable values for a GraphQL operation
 * Either via a variables file or by entering values inline for simple cases
 * 
 * @param query The GraphQL query containing variable definitions
 * @param chosenOp Optional name of the specific operation to collect variables for
 * @returns Array of CLI args (--var, --var-file) or undefined if user cancelled
 */
async function collectVariableArgs(query: string, chosenOp?: string): Promise<string[] | undefined> {
  try {
    const ast = parse(query);
    const opNodes = ast.definitions.filter(
      (d): d is OperationDefinitionNode => d.kind === "OperationDefinition"
    );

    let target: OperationDefinitionNode | undefined;
    if (chosenOp) {
      target = opNodes.find((o) => o.name?.value === chosenOp);
    } else if (opNodes.length === 1) {
      target = opNodes[0];
    }
    if (!target || !target.variableDefinitions?.length) {
      return [];
    }

    const vDefs = target.variableDefinitions;

    const allScalar = vDefs.every((v) => {
      let t: NamedTypeNode | undefined;
      if (v.type.kind === "NamedType") {
        t = v.type;
      }
      else if (v.type.kind === "NonNullType" && v.type.type.kind === "NamedType") {
        t = v.type.type;
      }
      return t ? SCALARS.has(t.name.value) : false;
    });

    // Use a different approach for dialog buttons
    const options = ["Select vars file"];
    if (allScalar && vDefs.length <= 2) {
      options.push("Enter inline");
    }
    options.push("Cancel");
    
    const pick = await vscode.window.showQuickPick(options, {
      placeHolder: `Operation "${target.name?.value ?? "(anonymous)"}" needs ${vDefs.length} variable${vDefs.length === 1 ? "" : "s"}`,
      canPickMany: false
    });

    if (pick === "Select vars file") {
      const uris = await vscode.window.showOpenDialog({
        canSelectMany: false,
        filters: { JSON: ["json"] },
        openLabel: "Use variables file",
      });
      if (!uris || !uris[0]) {
        return undefined; // cancelled
      }
      return ["--var-file", uris[0].fsPath];
    }

    if (pick === "Enter inline") {
      const args: string[] = [];
      for (const v of vDefs) {
        const name = v.variable.name.value;
        const val = await vscode.window.showInputBox({
          prompt: `Value for $${name}`,
        });
        if (val === undefined) {
          return undefined; // user cancelled
        }
        args.push("--var", `${name}=${val}`);
      }
      return args;
    }

    return undefined; // user cancelled or complex vars with no file chosen
  } catch (err) {
    logger.error(`Error parsing variables: ${formatError(err)}`, err);
    return []; // parse error → ignore variables
  }
}

/* -------------------------------------------------------------
 * Common execution function with support for persisted documents
 * ------------------------------------------------------------*/
/**
 * Executes a StepZen GraphQL request either using a file-based approach or persisted document
 * Handles displaying results to the user and processing diagnostics
 * 
 * @param options Request options object
 * @param options.queryText Optional GraphQL query text for file-based requests
 * @param options.documentId Optional document ID for persisted document requests
 * @param options.operationName Optional name of the operation to execute
 * @param options.varArgs Optional variable arguments (--var, --var-file)
 * @returns Promise that resolves when execution completes
 */
async function executeStepZenRequest(options: {
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
      
      // Verify config file exists
      if (!fs.existsSync(configPath)) {
        const error = createError(
          `StepZen configuration file not found at: ${configPath}`,
          "Execute StepZen Request",
          undefined,
          "config"
        );
        vscode.window.showErrorMessage(formatError(error));
        logger.error(formatError(error), error);
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
        
        // Get API key using the CLI
        const apiKeyOutput = cp.execSync("stepzen whoami --apikey");
        if (!apiKeyOutput) {
          vscode.window.showErrorMessage("Failed to retrieve StepZen API key");
          return;
        }
        
        apiKey = apiKeyOutput.toString().trim();
        
        if (!apiKey) {
          vscode.window.showErrorMessage("Empty API key returned from StepZen CLI");
          return;
        }
      } catch (err) {
        const error = createError(
          "Failed to read StepZen configuration file",
          "Execute StepZen Request",
          err,
          "filesystem"
        );
        vscode.window.showErrorMessage(formatError(error));
        logger.error(formatError(error), error);
        return;
      }

      // Get account and domain using the CLI
      let account, domain;
      try {
        const accountOutput = cp.execSync("stepzen whoami --account");
        const domainOutput = cp.execSync("stepzen whoami --domain");
        
        if (!accountOutput || !domainOutput) {
          vscode.window.showErrorMessage("Failed to retrieve StepZen account or domain information");
          return;
        }
        
        account = accountOutput.toString().trim();
        domain = domainOutput.toString().trim();
        
        if (!account || !domain) {
          vscode.window.showErrorMessage("Empty account or domain returned from StepZen CLI");
          return;
        }
      } catch (err) {
        const error = createError(
          "Failed to retrieve StepZen account information",
          "Execute StepZen Request",
          err,
          "cli"
        );
        vscode.window.showErrorMessage(formatError(error));
        logger.error(formatError(error), error);
        return;
      }

      // Construct the GraphQL endpoint URL
      const graphqlUrl = `https://${account}.${domain}/${endpoint}/graphql`;

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
          // Use Node.js https module to make the request
          const result = await new Promise<StepZenResponse>((resolve, reject) => {
            const req = https.request(
              graphqlUrl,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Apikey ${apiKey}`,
                  'stepzen-debug-level': debugLevel.toString()
                },
              },
              (res) => {
                let data = "";
                res.on("data", (chunk) => (data += chunk));

                res.on('end', () => {
                  try {
                    resolve(JSON.parse(data) as StepZenResponse);
                  } catch (err) {
                    reject(createError(
                      "Failed to parse StepZen response",
                      "Execute StepZen Request",
                      err,
                      "parse"
                    ));
                  }
                });
              }
            );

            req.on('error', reject);
            req.write(JSON.stringify(requestBody));
            req.end();
          });

          // Process results as before
          const rawDiags = (result.extensions?.stepzen?.diagnostics ?? []) as StepZenDiagnostic[];
          logger.info("Processing diagnostics for persisted document request...");
          const summaries = summariseDiagnostics(rawDiags);
          publishDiagnostics(summaries, runtimeDiag);

          // Show results
          await openResultsPanel(result);
        }
      );
    } catch (err: unknown) {
      const errorMsg = formatError(err);
      vscode.window.showErrorMessage(`StepZen request failed: ${errorMsg}`);
      logger.error("StepZen request failed", err); // Include details in output channel
    }
    return;
  }

  // For regular file-based requests, use the CLI as before
  if (!queryText) {
    vscode.window.showErrorMessage("No query provided for file-based request.");
    return;
  }

  let tmpFile: string | undefined;
  try {
    tmpFile = createTempGraphQLFile(queryText);
    
    // Build CLI command
    const parts = [
      "stepzen request",
      `--file "${tmpFile}"`,
      operationName ? `--operation-name ${operationName}` : "",
      debugLevel > 0 ? `-H "stepzen-debug-level: ${debugLevel}"` : "",
      ...varArgs,
    ].filter(Boolean);
    
    const cmd = parts.join(" ");

    // Terminal output mode
    if (debugLevel === 0) {
      const term = vscode.window.createTerminal(UI.TERMINAL_NAME);
      term.show();
      term.sendText(`cd "${projectRoot}" && ${cmd}`);
      cleanupLater(tmpFile);
      return;
    }

    // JSON result mode with progress notification
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Executing StepZen request...",
        cancellable: false
      },
      async () => {
        const { stdout } = await execAsync(cmd, { cwd: projectRoot });
        const json = JSON.parse(stdout) as StepZenResponse;

        // Process results
        const rawDiags = (json.extensions?.stepzen?.diagnostics ?? []) as StepZenDiagnostic[];
        logger.info("Processing diagnostics for file-based request...");
        const summaries = summariseDiagnostics(rawDiags);
        publishDiagnostics(summaries, runtimeDiag);

        await openResultsPanel(json);
      }
    );
  } catch (err: unknown) {
    const errorMsg = formatError(err);
    vscode.window.showErrorMessage(`StepZen request failed: ${errorMsg}`);
    logger.error("StepZen request failed", err); // Include details in output channel
  } finally {
    if (tmpFile) {
      cleanupLater(tmpFile);
    }
  }
}

/* -------------------------------------------------------------
 * Command implementations
 * ------------------------------------------------------------*/

/**
 * Command handler for stepzen.runRequest
 * Runs the GraphQL request in the active editor
 * If multiple operations are found, prompts the user to select one
 */
export async function runGraphQLRequest() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage("No active editor with GraphQL request.");
    return;
  }

  // Verify document exists
  if (!editor.document) {
    vscode.window.showErrorMessage("No document available in active editor.");
    return;
  }

  const query = editor.document.getText(
    editor.selection.isEmpty ? undefined : editor.selection
  );
  if (!query || !query.trim()) {
    vscode.window.showWarningMessage("No GraphQL query selected or found.");
    return;
  }

  // Handle multiple operations
  let operationName: string | undefined;
  const ops = extractOperationNames(query);
  if (ops.length > 1) {
    operationName = await vscode.window.showQuickPick(ops, {
      placeHolder: "Multiple operations found. Select one to execute.",
    });
    if (!operationName) {
      return; // cancelled
    }
  }

  // Collect variable args
  const varArgs = await collectVariableArgs(query, operationName);
  if (varArgs === undefined) {
    return; // user cancelled
  }

  // Execute using file-based approach
  await executeStepZenRequest({
    queryText: query,
    operationName,
    varArgs
  });
}

/**
 * Executes a specific operation from a GraphQL file
 * Used by the "▶ Run" codelens button in the editor
 * 
 * @param operation The operation entry to run
 */
export async function runOperation(operation: OperationEntry) {
  // Validate operation parameter
  if (!operation || !operation.fileUri) {
    const error = createError(
      "Invalid operation provided",
      "Run GraphQL Operation",
      undefined,
      "user"
    );
    vscode.window.showErrorMessage(formatError(error));
    logger.error(formatError(error), error);
    return;
  }
  
  try {
    const document = await vscode.workspace.openTextDocument(operation.fileUri);
    if (!document) {
      const error = createError(
        `Could not open document: ${operation.fileUri.toString()}`,
        "Run GraphQL Operation",
        undefined,
        "filesystem"
      );
      vscode.window.showErrorMessage(formatError(error));
      logger.error(formatError(error), error);
      return;
    }
    const content = document.getText();
  
  // Validate operation range
  if (!operation.range || typeof operation.range.start !== 'number' || typeof operation.range.end !== 'number') {
    vscode.window.showErrorMessage("Invalid operation range");
    return;
  }

  // Extract just this operation's text based on range
  const operationText = content.substring(operation.range.start, operation.range.end);
  
  // Collect variable args for the operation
  const varArgs = await collectVariableArgs(operationText, operation.name);
  if (varArgs === undefined) {
    return; // user cancelled
  }
  
  // Execute using file-based approach
  await executeStepZenRequest({
    queryText: operationText,
    operationName: operation.name,
    varArgs
  });
  } catch (error: unknown) {
    const errorMsg = formatError(error);
    vscode.window.showErrorMessage(`Error running operation: ${errorMsg}`);
    logger.error("Error running operation", error); // Include details in output channel
  }
}

/**
 * Executes a persisted operation using its document ID
 * Used by the "▶ Run (persisted)" codelens button in the editor
 * 
 * @param documentId The persisted document ID
 * @param operationName The name of the operation within the document
 */
export async function runPersisted(documentId: string, operationName: string) {
  // Validate parameters
  if (!documentId || typeof documentId !== 'string') {
    vscode.window.showErrorMessage("Invalid document ID provided");
    return;
  }
  
  if (!operationName || typeof operationName !== 'string') {
    vscode.window.showErrorMessage("Invalid operation name provided");
    return;
  }
  
  const persistedDocMap = getPersistedDocMap();
  if (!persistedDocMap) {
    vscode.window.showErrorMessage("Persisted document map is not available");
    return;
  }
  
  const entry = Object.values(persistedDocMap).find(e => e && e.documentId === documentId);
  if (!entry) {
    vscode.window.showErrorMessage("Could not find persisted document.");
    return;
  }
  
  try {
    // Open the file to extract the operation for variable analysis
    if (!entry.fileUri) {
      vscode.window.showErrorMessage("Invalid file URI in persisted document entry");
      return;
    }
    
    const document = await vscode.workspace.openTextDocument(entry.fileUri);
    if (!document) {
      vscode.window.showErrorMessage(`Could not open document: ${entry.fileUri.toString()}`);
      return;
    }
    
    const content = document.getText();
    
    // Validate operations array
    if (!entry.operations || !Array.isArray(entry.operations)) {
      vscode.window.showErrorMessage("Invalid operations list in persisted document entry");
      return;
    }
    
    // Find the specific operation
    const op = entry.operations.find(o => o && o.name === operationName);
    if (!op) {
      vscode.window.showErrorMessage(`Operation "${operationName}" not found in document.`);
      return;
    }
  
    // Validate operation range
    if (!op.range || typeof op.range.start !== 'number' || typeof op.range.end !== 'number') {
      vscode.window.showErrorMessage("Invalid operation range");
      return;
    }
    
    // Extract just this operation's text for variable parsing
    const operationText = content.substring(op.range.start, op.range.end);
    
    // Collect variable args
    const varArgs = await collectVariableArgs(operationText, operationName);
    if (varArgs === undefined) {
      return; // user cancelled
    }
    
    // Execute using document ID approach
    await executeStepZenRequest({
      documentId,
      operationName,
      varArgs
    });
  } catch (error: unknown) {
    const errorMsg = formatError(error);
    vscode.window.showErrorMessage(`Error running persisted operation: ${errorMsg}`);
    logger.error("Error running persisted operation", error); // Include details in output channel
  }
}

/**
 * Clears the results panel and any diagnostics
 * Used by the "× Clear" codelens button
 */
export function clearResults(): void {
  clearResultsPanel();
  runtimeDiag.clear(); // Also clear any diagnostics
  logger.info("Results cleared");
}

/* -------------------------------------------------------------
 * Helper utilities
 * ------------------------------------------------------------*/
/**
 * Executes a shell command asynchronously and returns the output
 * 
 * @param command The command string to execute
 * @param options Options for the child process
 * @returns Promise resolving to an object containing stdout
 */
/**
 * Executes a shell command asynchronously and returns the output
 * 
 * @param command The command string to execute
 * @param options Options for the child process
 * @returns Promise resolving to an object containing stdout
 * @throws Error if command is invalid or execution fails
 */
/**
 * Executes a shell command asynchronously
 * @param command The command to execute
 * @param options Options for the child process
 * @returns Promise resolving to the command's stdout
 * @throws StepZenError if the command fails
 */
function execAsync(command: string, options: cp.ExecOptions = {}): Promise<{ stdout: string }> {
  // Validate inputs
  if (!command || typeof command !== 'string') {
    return Promise.reject(createError(
      "Invalid command: expected a non-empty string",
      "Execute Command",
      undefined,
      "user"
    ));
  }
  
  return new Promise<{ stdout: string }>((resolve, reject) => {
    cp.exec(command, { ...options, maxBuffer: 10_000_000 }, (err, stdout, stderr) => {
      if (err) {
        reject(createError(
          `Command failed: ${command}`,
          "Execute Command",
          err,
          "cli"
        ));
      } else if (!stdout) {
        resolve({ stdout: "" });
      } else {
        resolve({ stdout });
      }
    });
  });
}

/**
 * Schedules a temporary file for cleanup after a delay
 * 
 * @param file Path to the temporary file to delete
 */
/**
 * Safely deletes a temporary file after a delay
 * @param file Path to the temporary file to delete
 * @param delayMs Delay in milliseconds before deletion attempt
 */
function cleanupLater(file: string, delayMs: number = TIMEOUTS.FILE_CLEANUP_DELAY_MS): void {
  // Add validation
  if (!file || typeof file !== 'string') {
    logger.warn("Invalid file path provided for cleanup");
    return;
  }

  setTimeout(() => {
    try {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
        logger.debug(`Temporary file cleaned up: ${file}`);
      }
    } catch (err) {
      const error = createError(
        `Failed to clean up temporary file: ${file}`,
        "File Cleanup",
        err,
        "filesystem"
      );
      logger.error(formatError(error), error);
    }
  }, delayMs);
}