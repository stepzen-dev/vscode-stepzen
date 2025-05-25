/**
 * Copyright IBM Corp. 2025
 * Assisted by CursorAI
 */

// src/commands/runRequest.ts
import * as vscode from "vscode";
import { parse, NamedTypeNode, OperationDefinitionNode } from "graphql";
import { clearResultsPanel } from "../panels/resultsPanel";
import { runtimeDiag } from "../extension";
import type { OperationEntry } from "../services/schema/indexer";
import { services } from "../services";
// Import executeStepZenRequest from separate file
import { executeStepZenRequest } from "./executeStepZenRequest";
import { handleError, ValidationError } from "../errors";
import { GRAPHQL, MESSAGES } from "../utils/constants";

/* -------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------*/
/**
 * Extracts operation names from a GraphQL query string
 * @param query The GraphQL query string to parse
 * @returns Array of operation names found in the query
 */
function extractOperationNames(query: string): string[] {
  if (!query || typeof query !== "string") {
    services.logger.warn("Invalid query provided to extractOperationNames");
    return [];
  }
  
  return [...query.matchAll(GRAPHQL.OPERATION_TYPE_PATTERN)].map(([, , name]) => name);
}

/**
 * Creates a temporary file containing the GraphQL query
 * @param query The GraphQL query string to write to the file
 * @returns Path to the created temporary file
 * @throws Error if query is invalid
 */
// function createTempGraphQLFile(query: string): string {
//   // Add validation
//   if (!query || typeof query !== 'string') {
//     throw new ValidationError(
//       "Invalid query: expected a non-empty string",
//       "INVALID_QUERY"
//     );
//   }

//   const tmpDir = os.tmpdir();
//   const timestamp = new Date().getTime();
//   const tmp = path.join(
//     tmpDir,
//     `stepzen-request-${timestamp}.graphql`
//   );
//   fs.writeFileSync(tmp, query);
//   services.logger.debug(`Created temporary query file: ${tmp}`);
//   return tmp;
// }

const SCALARS = new Set<string>(GRAPHQL.SCALAR_TYPES);

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
    handleError(err);
    return []; // parse error → ignore variables
  }
}

/* -------------------------------------------------------------
 * Common execution function with support for persisted documents
 * ------------------------------------------------------------*/
// Note: executeStepZenRequest has been moved to executeStepZenRequest.ts and exported

/* -------------------------------------------------------------
 * Command implementations
 * ------------------------------------------------------------*/

/**
 * Command handler for stepzen.runRequest
 * Runs the GraphQL request in the active editor
 * If multiple operations are found, prompts the user to select one
 */
export async function runGraphQLRequest() {
  try {
    services.logger.info("Starting Run GraphQL Request command");
    
    // Check workspace trust first
    if (!vscode.workspace.isTrusted) {
      vscode.window.showWarningMessage(MESSAGES.FEATURE_NOT_AVAILABLE_UNTRUSTED);
      services.logger.warn("Run GraphQL Request failed: Workspace not trusted");
      return;
    }
    
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage(MESSAGES.NO_ACTIVE_EDITOR);
      services.logger.warn("Run GraphQL Request failed: No active editor");
      return;
    }

    // Verify document exists
    if (!editor.document) {
      vscode.window.showErrorMessage("No document available in active editor.");
      services.logger.warn("Run GraphQL Request failed: No document available");
      return;
    }

    const query = editor.document.getText(
      editor.selection.isEmpty ? undefined : editor.selection
    );
    if (!query || !query.trim()) {
      vscode.window.showWarningMessage("No GraphQL query selected or found.");
      services.logger.warn("Run GraphQL Request failed: No query found");
      return;
    }

    services.logger.info("Processing GraphQL query for execution");

    // Handle multiple operations
    let operationName: string | undefined;
    const ops = extractOperationNames(query);
    if (ops.length > 1) {
      operationName = await vscode.window.showQuickPick(ops, {
        placeHolder: MESSAGES.SELECT_OPERATION_TO_EXECUTE,
      });
      if (!operationName) {
        services.logger.info("Run GraphQL Request cancelled by user");
        return; // cancelled
      }
    }

    // Collect variable args
    const varArgs = await collectVariableArgs(query, operationName);
    if (varArgs === undefined) {
      services.logger.info("Run GraphQL Request cancelled by user during variable collection");
      return; // user cancelled
    }

    // Execute using file-based approach
    await executeStepZenRequest({
      queryText: query,
      operationName,
      varArgs
    });
    
    services.logger.info("Run GraphQL Request completed successfully");
  } catch (err) {
    handleError(err);
  }
}

/**
 * Executes a specific operation from a GraphQL file
 * Used by the "▶ Run" codelens button in the editor
 * 
 * @param operation The operation entry to run
 */
export async function runOperation(operation: OperationEntry) {
  // Check workspace trust first
  if (!vscode.workspace.isTrusted) {
    const message = "Running GraphQL operations is not available in untrusted workspaces. Open this folder in a trusted workspace to enable this feature.";
    vscode.window.showWarningMessage(message);
    return;
  }

  // Validate operation parameter
  if (!operation || !operation.fileUri) {
    handleError(new ValidationError(
      "Invalid operation provided",
      "INVALID_OPERATION"
    ));
    return;
  }
  
  try {
    const document = await vscode.workspace.openTextDocument(operation.fileUri);
    if (!document) {
      handleError(new ValidationError(
        `Could not open document: ${operation.fileUri.toString()}`,
        "DOCUMENT_NOT_FOUND"
      ));
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
    handleError(error);
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
  // Check workspace trust first
  if (!vscode.workspace.isTrusted) {
    const message = "Running persisted GraphQL operations is not available in untrusted workspaces. Open this folder in a trusted workspace to enable this feature.";
    vscode.window.showWarningMessage(message);
    return;
  }
  
  // Validate parameters
  if (!documentId || typeof documentId !== 'string') {
    vscode.window.showErrorMessage("Invalid document ID provided");
    return;
  }
  
  if (!operationName || typeof operationName !== 'string') {
    vscode.window.showErrorMessage("Invalid operation name provided");
    return;
  }
  
  const persistedDocMap = services.schemaIndex.getPersistedDocMap();
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
    
    // Execute using persisted document approach with the full document content
    await executeStepZenRequest({
      documentContent: content,
      operationName,
      varArgs
    });
  } catch (error: unknown) {
    handleError(error);
  }
}

/**
 * Clears the results panel and any diagnostics
 * Used by the "× Clear" codelens button
 */
export function clearResults(): void {
  clearResultsPanel();
  runtimeDiag.clear(); // Also clear any diagnostics
  services.logger.info("Results cleared");
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
 * 
 * Note: For StepZen CLI operations, prefer using the StepzenCliService instead.
 */

// TODO: cleanup old comments
// This function is kept for backward compatibility with other parts of the code
// that might still be using it, but for StepZen CLI operations we now prefer the StepzenCliService
// function execAsync(command: string, options: cp.ExecOptions = {}): Promise<{ stdout: string }> {
//   // Validate inputs
//   if (!command || typeof command !== 'string') {
//     return Promise.reject(new ValidationError(
//       "Invalid command: expected a non-empty string",
//       "INVALID_COMMAND"
//     ));
//   }
  
//   return new Promise<{ stdout: string }>((resolve, reject) => {
//     cp.exec(command, { ...options, maxBuffer: 10_000_000 }, (err, stdout, stderr) => {
//       if (err) {
//         reject(new ValidationError(
//           `Command failed: ${command}`,
//           "COMMAND_FAILED",
//           err
//         ));
//       } else if (!stdout) {
//         resolve({ stdout: "" });
//       } else {
//         resolve({ stdout });
//       }
//     });
//   });
// }

// TODO: cleanup dead code
// /**
//  * Schedules a temporary file for cleanup after a delay
//  * 
//  * @param file Path to the temporary file to delete
//  */
// /**
//  * Safely deletes a temporary file after a delay
//  * @param file Path to the temporary file to delete
//  * @param delayMs Delay in milliseconds before deletion attempt
//  */
// function cleanupLater(file: string, delayMs: number = TIMEOUTS.FILE_CLEANUP_DELAY_MS): void {
//   // Add validation
//   if (!file || typeof file !== "string") {
//     services.logger.warn("Invalid file path provided for cleanup");
//     return;
//   }

//   // Only attempt to clean up files in the temp directory
//   if (!file.startsWith(os.tmpdir())) {
//     services.logger.warn(`Refusing to clean up non-temporary file: ${file}`);
//     return;
//   }

//   setTimeout(() => {
//     try {
//       if (fs.existsSync(file)) {
//         fs.unlinkSync(file);
//         services.logger.debug(`Temporary file cleaned up: ${file}`);
//       }
//     } catch (err) {
//       handleError(new ValidationError(
//         `Failed to clean up temporary file: ${file}`,
//         "FILE_CLEANUP_FAILED",
//         err
//       ));
//     }
//   }, delayMs);
// }