import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { StepZenError, handleError } from "./errors";
import { UI, FILE_PATTERNS } from "./utils/constants";
import { safeRegisterCommand } from "./utils/safeRegisterCommand";
import { scanStepZenProject, computeHash } from "./utils/stepzenProjectScanner";
import { StepZenCodeLensProvider } from "./utils/codelensProvider";
import { services } from "./services";


let stepzenTerminal: vscode.Terminal | undefined;
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
let lastSchemaHash: string | undefined;
let debounceTimer: NodeJS.Timeout | undefined;

/**
 * Initializes the extension for a specific workspace folder
 * Sets up file watchers and scans the StepZen project structure
 * @param folder The workspace folder to initialize for
 */
async function initialiseFor(folder: vscode.WorkspaceFolder) {
  // dispose any previous watcher when switching projects
  watcher?.dispose();
  activeFolder = folder;

  // Clear project resolver cache when switching workspace folders
  services.projectResolver.clearCache();

  // figure out where the actual StepZen project lives (may be nested)
  let projectRoot: string;
  try {
    projectRoot = await services.projectResolver.resolveStepZenProjectRoot(folder.uri);
  } catch (err) {
    vscode.window.showWarningMessage(
      `StepZen Tools: could not locate a StepZen project under ${folder.name}`,
    );
    services.logger.error(`Could not locate a StepZen project under ${folder.name}`, err);
    return;
  }

  const indexPath = path.join(projectRoot, FILE_PATTERNS.MAIN_SCHEMA_FILE);

  if (!fs.existsSync(indexPath)) {
    const message = `StepZen Tools: ${folder.name} does not appear to contain an ${FILE_PATTERNS.MAIN_SCHEMA_FILE}. Commands will be disabled until a valid project is opened.`;
    vscode.window.showWarningMessage(message);
    services.logger.warn(message);
    return;
  }

  try {
    // Ensure schema is loaded immediately instead of lazily
    services.logger.info(`Initial scan of project at ${indexPath}`);
    
    // Compute initial hash of schema files
    const schemaFiles = await vscode.workspace.findFiles(
      new vscode.RelativePattern(projectRoot, FILE_PATTERNS.SCHEMA_FILES),
      null,
      100
    );
    
    const contents = await Promise.all(
      schemaFiles.map(async file => {
        return await fs.promises.readFile(file.fsPath, 'utf8');
      })
    );
    
    const fullSDL = contents.join('\n');
    lastSchemaHash = computeHash(fullSDL);
    
    await scanStepZenProject(indexPath);
  } catch (err) {
    const error = new StepZenError(
      "Initial project scan failed",
      "INITIALIZATION_ERROR",
      err
    );
    handleError(error);
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

    // Clear any existing debounce timer
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    // Set a new debounce timer (250ms)
    debounceTimer = setTimeout(async () => {
      try {
        // Compute hash of all schema files to check for actual changes
        const schemaFiles = vscode.workspace.findFiles(
          new vscode.RelativePattern(projectRoot, FILE_PATTERNS.SCHEMA_FILES),
          null,
          100
        );
        
        const files = await schemaFiles;
        const contents = await Promise.all(
          files.map(async file => {
            return await fs.promises.readFile(file.fsPath, 'utf8');
          })
        );
        
        const fullSDL = contents.join('\n');
        const currentHash = computeHash(fullSDL);
        
        // Skip parsing if schema hasn't changed
        if (lastSchemaHash && lastSchemaHash === currentHash) {
          services.logger.debug(`Rescan skipped (no changes) after event in ${uri.fsPath}`);
          return;
        }
        
        services.logger.info(`Rescanning project after change in ${uri.fsPath}`);
        await scanStepZenProject(indexPath);
        
        // Update hash after successful scan
        lastSchemaHash = currentHash;
      } catch (err) {
        const error = new StepZenError(
          `Error rescanning project after change in ${uri.fsPath}`,
          "PROJECT_WATCHER_ERROR",
          err
        );
        handleError(error);
      }
    }, 250);
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
// ts-prune-ignore-next
export async function activate(context: vscode.ExtensionContext) {
  // Store extension URI for global access
  EXTENSION_URI = context.extensionUri;
  
  // CLI service is initialized via service registry
  services.logger.info("StepZen CLI service initialized");

  // command registration --------------------------------------------------
  context.subscriptions.push(
    safeRegisterCommand("stepzen.initializeProject", async () => {
      const { initializeProject } = await import("./commands/initializeProject.js");
      return initializeProject();
    }),
    safeRegisterCommand("stepzen.deploy", async () => {
      const { deployStepZen } = await import("./commands/deploy.js");
      return deployStepZen();
    }),
    safeRegisterCommand("stepzen.runRequest", async () => {
      const { runGraphQLRequest } = await import("./commands/runRequest.js");
      return runGraphQLRequest();
    }),
    safeRegisterCommand("stepzen.openExplorer", async () => {
      const { openQueryExplorer } = await import("./commands/openExplorer.js");
      return openQueryExplorer(context);
    }),
    safeRegisterCommand("stepzen.goToDefinition", async () => {
      const { goToDefinition } = await import("./commands/goToDefinition.js");
      return goToDefinition();
    }),
    safeRegisterCommand("stepzen.addMaterializer", async () => {
      const { addMaterializer } = await import("./commands/addMaterializer.js");
      return addMaterializer();
    }),
    safeRegisterCommand("stepzen.runOperation", async (...args: unknown[]) => {
      const { runOperation } = await import("./commands/runRequest.js");
      return runOperation(args[0] as any);
    }),
    safeRegisterCommand("stepzen.runPersisted", async (...args: unknown[]) => {
      const { runPersisted } = await import("./commands/runRequest.js");
      return runPersisted(args[0] as string, args[1] as string);
    }),
    safeRegisterCommand("stepzen.clearResults", async () => {
      const { clearResults } = await import("./commands/runRequest.js");
      return clearResults();
    }),
    safeRegisterCommand(
      "stepzen.openSchemaVisualizer",
      async (...args: unknown[]) => {
        const { openSchemaVisualizer } = await import("./commands/openSchemaVisualizer.js");
        return openSchemaVisualizer(context, args[0] as string | undefined);
      },
    ),
    safeRegisterCommand("stepzen.generateOperations", async () => {
      const { generateOperations } = await import("./commands/generateOperations.js");
      return generateOperations();
    }),
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

  // 3 Clear project resolver cache when workspace folders change
  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders((event) => {
      // Clear cache when workspace folders are added or removed
      if (event.added.length > 0 || event.removed.length > 0) {
        services.logger.debug("Workspace folders changed, clearing project resolver cache");
        services.projectResolver.clearCache();
      }
    }),
  );

  runtimeDiag = vscode.languages.createDiagnosticCollection(
    UI.DIAGNOSTIC_COLLECTION_NAME,
  );
  context.subscriptions.push(runtimeDiag);

  // Update logger configuration from settings
  services.logger.updateConfigFromSettings();
  
  // Listen for configuration changes to update logger settings
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('stepzen.logLevel') || 
          e.affectsConfiguration('stepzen.logToFile')) {
        services.logger.updateConfigFromSettings();
      }
    })
  );
  
  services.logger.info("StepZen Tools activated");
}

/**
 * Deactivates the StepZen Tools extension
 * Cleans up resources like file watchers and terminals
 */
// ts-prune-ignore-next
export function deactivate() {
  watcher?.dispose();
  stepzenTerminal?.dispose();
  services.logger.dispose();
}
