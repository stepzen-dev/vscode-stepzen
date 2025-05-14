import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { formatError, createError } from "./utils/errors";
import { UI, FILE_PATTERNS } from "./utils/constants";
import { stepzenOutput, logger } from "./utils/logger";

import { deployStepZen } from "./commands/deploy";
import {
  clearResults,
  runGraphQLRequest,
  runOperation,
  runPersisted,
} from "./commands/runRequest";
import { openQueryExplorer } from "./commands/openExplorer";
import { goToDefinition } from "./commands/goToDefinition";
import { safeRegisterCommand } from "./utils/safeRegisterCommand";
import { scanStepZenProject } from "./utils/stepzenProjectScanner";
import { resolveStepZenProjectRoot } from "./utils/stepzenProject";
import { addMaterializer } from "./commands/addMaterializer";
import { StepZenCodeLensProvider } from "./utils/codelensProvider";
import { openSchemaVisualizer } from "./commands/openSchemaVisualizer";
import { initializeProject } from "./commands/initializeProject";
import { generateOperations } from "./commands/generateOperations";

export { stepzenOutput };
export let stepzenTerminal: vscode.Terminal | undefined;
export let EXTENSION_URI: vscode.Uri;
export let runtimeDiag: vscode.DiagnosticCollection;

/**
 * Gets or creates a terminal for StepZen operations
 * @param name The name to give the terminal if creating a new one
 * @returns An existing or newly created terminal instance
 */
export function getOrCreateStepZenTerminal(name: string = UI.TERMINAL_NAME): vscode.Terminal {
  if (!stepzenTerminal) {
    stepzenTerminal = vscode.window.createTerminal(name);
  }
  return stepzenTerminal;
}

/**
 * Resolve the workspace folder that owns the given URI (or the active editor if none supplied).
 */
/**
 * Resolve the workspace folder that owns the given URI (or the active editor if none supplied).
 * @param uri Optional URI to find the workspace folder for. If not provided, uses the active editor
 * @returns The workspace folder that contains the URI, or undefined if none found
 */
function getActiveWorkspaceFolder(
  uri?: vscode.Uri,
): vscode.WorkspaceFolder | undefined {
  if (!uri) {
    uri = vscode.window.activeTextEditor?.document.uri;
  }
  return uri
    ? (vscode.workspace.getWorkspaceFolder(uri) ?? undefined)
    : undefined;
}

let activeFolder: vscode.WorkspaceFolder | undefined;
let watcher: vscode.FileSystemWatcher | undefined;

/**
 * Initializes the extension for a specific workspace folder
 * Sets up file watchers and scans the StepZen project structure
 * @param folder The workspace folder to initialize for
 */
async function initialiseFor(folder: vscode.WorkspaceFolder) {
  // dispose any previous watcher when switching projects
  watcher?.dispose();
  activeFolder = folder;

  // figure out where the actual StepZen project lives (may be nested)
  let projectRoot: string;
  try {
    projectRoot = await resolveStepZenProjectRoot(folder.uri);
  } catch (err) {
    const errorMsg = formatError(err);
    vscode.window.showWarningMessage(
      `StepZen Tools: could not locate a StepZen project under ${folder.name}`,
    );
    logger.error(`Could not locate a StepZen project under ${folder.name}`, err);
    return;
  }

  const indexPath = path.join(projectRoot, FILE_PATTERNS.MAIN_SCHEMA_FILE);

  if (!fs.existsSync(indexPath)) {
    vscode.window.showWarningMessage(
      `StepZen Tools: ${folder.name} does not appear to contain an ${FILE_PATTERNS.MAIN_SCHEMA_FILE}. Commands will be disabled until a valid project is opened.`,
    );
    return;
  }

  try {
    // Ensure schema is loaded immediately instead of lazily
    logger.info(`Initial scan of project at ${indexPath}`);
    await scanStepZenProject(indexPath);
  } catch (err) {
    const error = createError(
      "Initial project scan failed",
      "Extension Initialization",
      err,
      "filesystem"
    );
    logger.error(formatError(error), error);
  }

  // watch only inside the actual project root
  watcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(projectRoot, FILE_PATTERNS.SCHEMA_FILES),
  );

  const rescan = async (uri: vscode.Uri) => {
    // ignore events bubbling from other folders (defensive)
    if (
      vscode.workspace.getWorkspaceFolder(uri)?.uri.toString() !==
      folder.uri.toString()
    ) {
      return;
    }
    try {
      logger.info(`Rescanning project after change in ${uri.fsPath}`);
      await scanStepZenProject(indexPath);
    } catch (err) {
      const error = createError(
        `Error rescanning project after change in ${uri.fsPath}`,
        "Project Watcher",
        err,
        "filesystem"
      );
      logger.error(formatError(error), error);
    }
  };

  watcher.onDidChange(rescan);
  watcher.onDidCreate(rescan);
  watcher.onDidDelete(rescan);
}

/**
 * Activates the StepZen Tools extension
 * Sets up commands, event listeners, and initializes for the current workspace
 * @param context The extension context provided by VS Code
 */
export async function activate(context: vscode.ExtensionContext) {
  // Store extension URI for global access
  EXTENSION_URI = context.extensionUri;

  // command registration --------------------------------------------------
  context.subscriptions.push(
    safeRegisterCommand("stepzen.initializeProject", initializeProject),
    safeRegisterCommand("stepzen.deploy", deployStepZen),
    safeRegisterCommand("stepzen.runRequest", runGraphQLRequest),
    safeRegisterCommand("stepzen.openExplorer", () =>
      openQueryExplorer(context),
    ),
    safeRegisterCommand("stepzen.goToDefinition", goToDefinition),
    safeRegisterCommand("stepzen.addMaterializer", addMaterializer),
    safeRegisterCommand("stepzen.runOperation", runOperation),
    safeRegisterCommand("stepzen.runPersisted", runPersisted),
    safeRegisterCommand("stepzen.clearResults", clearResults),
    safeRegisterCommand(
      "stepzen.openSchemaVisualizer",
      async (typeName?: string) =>
        await openSchemaVisualizer(context, typeName),
    ),
    safeRegisterCommand("stepzen.generateOperations", generateOperations),
  );

  // Register the codelens provider
  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider(
      { language: "graphql" },
      new StepZenCodeLensProvider(),
    ),
  );

  // track user‑closed terminal
  context.subscriptions.push(
    vscode.window.onDidCloseTerminal((closed) => {
      if (closed === stepzenTerminal) {
        stepzenTerminal = undefined;
      }
    }),
  );

  // 1 initialise for the folder that owns the currently focused editor
  const firstFolder = getActiveWorkspaceFolder();
  if (firstFolder) {
    await initialiseFor(firstFolder);
  }

  // 2 when focus moves to an editor in a different workspace folder, re‑initialise
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(async (editor) => {
      const folder = editor && getActiveWorkspaceFolder(editor.document.uri);
      if (folder && folder !== activeFolder) {
        await initialiseFor(folder);
      }
    }),
  );

  runtimeDiag = vscode.languages.createDiagnosticCollection(
    UI.DIAGNOSTIC_COLLECTION_NAME,
  );
  context.subscriptions.push(runtimeDiag);

  logger.info("StepZen Tools activated");
}

/**
 * Deactivates the StepZen Tools extension
 * Cleans up resources like file watchers and terminals
 */
export function deactivate() {
  watcher?.dispose();
  stepzenTerminal?.dispose();
}
