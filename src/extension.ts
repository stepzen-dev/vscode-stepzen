/**
 * Copyright IBM Corp. 2025
 * Assisted by CursorAI
 */

import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { StepZenError, handleError } from "./errors";
import { UI, FILE_PATTERNS, COMMANDS, CONFIG_KEYS, MESSAGES, LANGUAGE_IDS } from "./utils/constants";
import { safeRegisterCommand } from "./utils/safeRegisterCommand";
// Removed import - now using services.schemaIndex directly
import { StepZenCodeLensProvider } from "./utils/codelensProvider";
import { services } from "./services";
import { runGraphQLRequest } from "./commands/runRequest";


let stepzenTerminal: vscode.Terminal | undefined;
export let EXTENSION_URI: vscode.Uri;
export let runtimeDiag: vscode.DiagnosticCollection;


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
      `${MESSAGES.COULD_NOT_LOCATE_PROJECT} ${folder.name}`,
    );
    services.logger.error(`Could not locate a StepZen project under ${folder.name}`, err);
    return;
  }

  const indexPath = path.join(projectRoot, FILE_PATTERNS.MAIN_SCHEMA_FILE);

  if (!fs.existsSync(indexPath)) {
    const message = `${UI.EXTENSION_NAME}: ${folder.name} ${MESSAGES.PROJECT_DOES_NOT_CONTAIN_INDEX}`;
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
    lastSchemaHash = services.schemaIndex.computeHash(fullSDL);
    
    await services.schemaIndex.scan(indexPath);
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
        const currentHash = services.schemaIndex.computeHash(fullSDL);
        
        // Skip parsing if schema hasn't changed
        if (lastSchemaHash && lastSchemaHash === currentHash) {
          services.logger.debug(`Rescan skipped (no changes) after event in ${uri.fsPath}`);
          return;
        }
        
        services.logger.info(`Rescanning project after change in ${uri.fsPath}`);
        await services.schemaIndex.scan(indexPath);
        
        // Update hash after successful scan
        lastSchemaHash = currentHash;

        // Auto-lint GraphQL files if enabled
        const autoLintEnabled = vscode.workspace.getConfiguration('stepzen').get('autoLintGraphQL', false);
        if (autoLintEnabled && uri.fsPath.endsWith('.graphql')) {
          services.logger.debug(`Auto-linting GraphQL file: ${uri.fsPath}`);
          try {
            await services.graphqlLinter.initialize();
            const diagnostics = await services.graphqlLinter.lintFile(uri.fsPath);
            if (diagnostics.length > 0) {
              services.graphqlLinter.getDiagnosticCollection().set(uri, diagnostics);
            } else {
              services.graphqlLinter.getDiagnosticCollection().delete(uri);
            }
          } catch (lintError) {
            services.logger.error(`Auto-linting failed for ${uri.fsPath}:`, lintError);
          }
        }
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
    safeRegisterCommand(COMMANDS.INITIALIZE_PROJECT, async () => {
      const { initializeProject } = await import("./commands/initializeProject.js");
      return initializeProject();
    }),
    safeRegisterCommand(COMMANDS.DEPLOY, async () => {
      const { deployStepZen } = await import("./commands/deploy.js");
      return deployStepZen();
    }),
    safeRegisterCommand(COMMANDS.RUN_REQUEST, () => runGraphQLRequest(context)),
    safeRegisterCommand(COMMANDS.OPEN_EXPLORER, async () => {
      const { openQueryExplorer } = await import("./commands/openExplorer.js");
      return openQueryExplorer(context);
    }),
    safeRegisterCommand(COMMANDS.GO_TO_DEFINITION, async () => {
      const { goToDefinition } = await import("./commands/goToDefinition.js");
      return goToDefinition();
    }),
    safeRegisterCommand(COMMANDS.ADD_DIRECTIVE, async () => {
      const { addDirective } = await import("./commands/addDirective.js");
      return addDirective();
    }),
    safeRegisterCommand(COMMANDS.ADD_MATERIALIZER, async () => {
      const { addMaterializer } = await import("./commands/addMaterializer.js");
      return addMaterializer();
    }),
    safeRegisterCommand(COMMANDS.ADD_VALUE, async () => {
      const { addValue } = await import("./commands/addValue.js");
      return addValue();
    }),
    safeRegisterCommand(COMMANDS.ADD_TOOL, async () => {
      const { addTool } = await import("./commands/addTool.js");
      return addTool();
    }),
    // Import commands
    safeRegisterCommand(COMMANDS.IMPORT_CURL, async () => {
      const { importCurl } = await import("./commands/importCurl.js");
      return importCurl();
    }),
    safeRegisterCommand(COMMANDS.IMPORT_OPENAPI, async () => {
      const { importOpenapi } = await import("./commands/importOpenapi.js");
      return importOpenapi();
    }),
    safeRegisterCommand(COMMANDS.IMPORT_GRAPHQL, async () => {
      const { importGraphql } = await import("./commands/importGraphql.js");
      return importGraphql();
    }),
    safeRegisterCommand(COMMANDS.IMPORT_DATABASE, async () => {
      const { importDatabase } = await import("./commands/importDatabase.js");
      return importDatabase();
    }),
    safeRegisterCommand(COMMANDS.RUN_OPERATION, async (...args: unknown[]) => {
      const { runOperation } = await import("./commands/runRequest.js");
      return runOperation(context, args[0] as any);
    }),
    safeRegisterCommand(COMMANDS.RUN_PERSISTED, async (...args: unknown[]) => {
      const { runPersisted } = await import("./commands/runRequest.js");
      return runPersisted(context, args[0] as string, args[1] as string);
    }),
    safeRegisterCommand(COMMANDS.CLEAR_RESULTS, async () => {
      const { clearResults } = await import("./commands/runRequest.js");
      return clearResults();
    }),
    safeRegisterCommand(
      COMMANDS.OPEN_SCHEMA_VISUALIZER,
      async (...args: unknown[]) => {
        const { openSchemaVisualizer } = await import("./commands/openSchemaVisualizer.js");
        return openSchemaVisualizer(context, args[0] as string | undefined);
      },
    ),
    safeRegisterCommand(COMMANDS.GENERATE_OPERATIONS, async () => {
      const { generateOperations } = await import("./commands/generateOperations.js");
      return generateOperations();
    }),
    safeRegisterCommand(COMMANDS.CREATE_FIELD_POLICY, async () => {
      const { createFieldPolicy } = await import("./commands/createFieldPolicy.js");
      return createFieldPolicy();
    }),
    safeRegisterCommand(COMMANDS.FIELD_ACCESS_REPORT, async () => {
      const { generateFieldAccessReport } = await import("./commands/generateFieldAccessReport.js");
      return generateFieldAccessReport();
    }),
    safeRegisterCommand(COMMANDS.OPEN_POLICY_EDITOR, async () => {
      const { openPolicyEditor } = await import("./commands/openPolicyEditor.js");
      return openPolicyEditor();
    }),
    safeRegisterCommand(COMMANDS.CREATE_FIELD_POLICY_FROM_PATTERN, async () => {
      const { createFieldPolicyFromPattern } = await import("./commands/createFieldPolicyFromPattern.js");
      return createFieldPolicyFromPattern();
    }),
    safeRegisterCommand(COMMANDS.LINT_GRAPHQL, async () => {
      const { lintGraphQL } = await import("./commands/lintGraphQL.js");
      return lintGraphQL();
    }),
    safeRegisterCommand(COMMANDS.CONFIGURE_LINT_RULES, async () => {
      const { configureLintRules } = await import("./commands/configureLintRules.js");
      return configureLintRules();
    }),
  );

  // Register the codelens provider
  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider(
      { language: LANGUAGE_IDS.GRAPHQL },
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
      if (e.affectsConfiguration(CONFIG_KEYS.LOG_LEVEL) || 
          e.affectsConfiguration(CONFIG_KEYS.LOG_TO_FILE)) {
        services.logger.updateConfigFromSettings();
      }
      
      // Listen for GraphQL lint rules configuration changes
      if (e.affectsConfiguration(CONFIG_KEYS.GRAPHQL_LINT_RULES)) {
        services.logger.info('GraphQL lint rules configuration changed, reinitializing linter');
        // Reinitialize the linter with new rules
        services.graphqlLinter.initialize();
      }
    })
  );
  
  services.logger.info(MESSAGES.STEPZEN_TOOLS_ACTIVATED);
}

/**
 * Deactivates the StepZen Tools extension
 * Cleans up resources like file watchers and terminals
 */
// ts-prune-ignore-next
export function deactivate() {
  // Clean up resources
  watcher?.dispose();
  runtimeDiag?.dispose();
  services.graphqlLinter.dispose();
}
