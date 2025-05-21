// src/panels/schemaVisualizerPanel.ts
import * as vscode from "vscode";
import { Uri } from "vscode";
import {
  getFieldIndex,
  getTypeDirectives,
  getTypeRelationships,
  scanStepZenProject,
  FieldInfo,
  DirectiveInfo,
  TypeRelationship,
} from "../utils/stepzenProjectScanner";
import { logger } from "../services/logger";
import { resolveStepZenProjectRoot } from "../utils/stepzenProject";
import * as path from "path";
import * as fs from "fs";

/**
 * Model representing the GraphQL schema for visualization
 * Contains all types, fields, and relationships in the schema
 */
interface SchemaVisualizerModel {
  types: Record<
    string,
    {
      name: string;
      directives: DirectiveInfo[];
      location: { uri: string; line: number; character: number } | null;
    }
  >;
  fields: Record<string, FieldInfo[]>;
  relationships: TypeRelationship[];
}

/** The singleton schema visualizer panel instance */
let panel: vscode.WebviewPanel | undefined;

export async function openSchemaVisualizerPanel(
  extensionUri: Uri,
  focusedType?: string,
) {
  logger.info(
    `Opening Schema Visualizer${focusedType ? ` focused on type: ${focusedType}` : ""}`,
  );

  // Create panel if it doesn't exist
  if (!panel) {
    panel = vscode.window.createWebviewPanel(
      "stepzenSchemaVisualizer",
      "StepZen Schema Visualizer",
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        localResourceRoots: [Uri.joinPath(extensionUri, "webview")],
      },
    );

    // Setup message handling
    const messageHandler = panel.webview.onDidReceiveMessage((message) => {
      switch (message.command) {
        case "navigateToLocation":
          const uri = vscode.Uri.file(message.location.uri);
          vscode.workspace.openTextDocument(uri).then((doc) => {
            vscode.window.showTextDocument(doc).then((editor) => {
              const position = new vscode.Position(
                message.location.line,
                message.location.character,
              );
              editor.selection = new vscode.Selection(position, position);
              editor.revealRange(
                new vscode.Range(position, position),
                vscode.TextEditorRevealType.InCenter,
              );
            });
          });
          return;
        case "debug-log":
          // Log messages from the webview to the StepZen output channel
          logger.debug(`[Webview] ${message.message}`);
          return;
      }
    });

    // Clean up when panel is closed
    panel.onDidDispose(
      () => {
        messageHandler.dispose();
        panel = undefined;
      },
      null,
      [],
    );
    
    // Initially show loading state
    panel.webview.html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="color-scheme" content="light dark">
        <title>StepZen Schema Visualizer</title>
        <style>
          html, body {
            margin: 0;
            padding: 0;
            height: 100%;
            width: 100%;
            overflow: hidden;
          }
          .loading {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            color: var(--vscode-foreground);
            font-family: var(--vscode-font-family);
          }
          .loading .spinner {
            width: 50px;
            height: 50px;
            margin-bottom: 20px;
            border: 5px solid var(--vscode-editor-background);
            border-top: 5px solid var(--vscode-textLink-foreground);
            border-radius: 50%;
            animation: spin 1s linear infinite;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
      </head>
      <body>
        <div class="loading">
          <div class="spinner"></div>
          <div>Loading schema data...</div>
        </div>
      </body>
      </html>
    `;
  }
  
  panel.reveal();

  try {
    // Ensure schema data is loaded
    const dataLoaded = await ensureSchemaDataLoaded();

    if (!dataLoaded) {
      panel.webview.html = getNoProjectHtml();
      return;
    }

    // Build the schema model for visualization
    const schemaModel = buildSchemaModel();

    // Debug logging
    logger.debug(
      `Schema model built: ${Object.keys(schemaModel.types).length} types, ${
        Object.keys(schemaModel.fields).length
      } fields with entries, ${schemaModel.relationships.length} relationships`,
    );

    if (Object.keys(schemaModel.types).length === 0) {
      logger.warn("No types found in schema model");
      panel.webview.html = getNoProjectHtml();
      return;
    }

    // Update the webview with the schema data
    panel.webview.html = getSchemaVisualizerHtml(
      panel.webview,
      extensionUri,
      schemaModel,
      focusedType,
    );
    
  } catch (error) {
    logger.error(`Error loading schema visualizer`, error);
    panel.webview.html = getNoProjectHtml();
  }
}

/**
 * Clears the schema visualizer panel by disposing the webview panel
 * Used when closing the visualizer or when the extension is deactivated
 */
export function clearSchemaVisualizerPanel(): void {
  if (panel) {
    panel.dispose();
    panel = undefined;
  }
}

/**
 * Ensures that schema data is loaded before the visualizer is opened.
 * If the schema data appears to be empty, this will trigger a scan of the project.
 * @returns true if schema data was successfully loaded, false otherwise
 */
async function ensureSchemaDataLoaded(): Promise<boolean> {
  const fieldIndex = getFieldIndex();

  // If we already have schema data, return true
  if (Object.keys(fieldIndex).length > 0) {
    logger.debug("Using existing schema data");
    return true;
  }

  logger.info("Schema data not found, attempting to load project...");

  try {
    // Find StepZen project root using the active editor or workspace folders
    let projectRoot: string;
    let hintUri: vscode.Uri | undefined;
    
    // Get hint URI from active editor if available
    if (vscode.window.activeTextEditor) {
      hintUri = vscode.window.activeTextEditor.document.uri;
    } 
    // Otherwise use the first workspace folder
    else if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
      hintUri = vscode.workspace.workspaceFolders[0].uri;
    }

    // If we have no hint, we can't proceed
    if (!hintUri) {
      logger.warn("No workspace folder or active editor available");
      return false;
    }

    // Use the existing utility to find the project root
    projectRoot = await resolveStepZenProjectRoot(hintUri);
    const indexPath = path.join(projectRoot, "index.graphql");

    // Verify that the index file exists
    if (!fs.existsSync(indexPath)) {
      logger.warn(`Index file not found at ${indexPath}`);
      return false;
    }

    // Scan the project
    logger.info(`Scanning StepZen project at ${indexPath}`);
    await scanStepZenProject(indexPath);
    logger.debug("Schema scan completed successfully");
    return true;
  } catch (error) {
    logger.error(`Failed to load schema data`, error);
    return false;
  }
}

/**
 * Builds a schema model for visualization using the current schema data
 * Collects types, fields, directives and relationships into a unified model
 * 
 * @returns A complete schema model for visualization
 */
function buildSchemaModel(): SchemaVisualizerModel {
  const fieldIndex = getFieldIndex();
  const typeDirectives = getTypeDirectives();
  const relationships = getTypeRelationships();

  const model: SchemaVisualizerModel = {
    types: {},
    fields: fieldIndex,
    relationships: relationships,
  };

  // Create type entries
  for (const typeName in fieldIndex) {
    const fields = fieldIndex[typeName];
    // Use first field's location as the type location (simplified approach)
    const location = fields.length > 0 ? fields[0].location : null;

    model.types[typeName] = {
      name: typeName,
      directives: typeDirectives[typeName] || [],
      location,
    };
  }

  return model;
}

/**
 * Generates HTML for an error message when no StepZen project is found
 * 
 * @returns HTML string for the error message
 */
function getNoProjectHtml(): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>StepZen Schema Visualizer</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
          padding: 2rem;
          text-align: center;
        }
        .error-container {
          max-width: 500px;
          margin: 0 auto;
          padding: 2rem;
          border: 1px solid #ccc;
          border-radius: 8px;
          background-color: #f9f9f9;
        }
        h2 {
          color: #d32f2f;
          margin-top: 0;
        }
        p {
          line-height: 1.5;
        }
      </style>
    </head>
    <body>
      <div class="error-container">
        <h2>No StepZen Project Found</h2>
        <p>
          The Schema Visualizer couldn't find a valid StepZen project in your workspace.
          Please open a folder containing a StepZen project and try again.
        </p>
        <p>
          A StepZen project should contain a <code>stepzen.config.json</code> file and an <code>index.graphql</code> file.
        </p>
      </div>
    </body>
    </html>
  `;
}

/**
 * Generates the HTML for the schema visualizer webview panel
 */
/**
 * Generates the HTML for the schema visualizer webview panel
 * Includes all necessary scripts, styles, and data for the visualization
 * 
 * @param webview The webview to generate HTML for
 * @param extUri The extension URI for resource loading
 * @param schemaModel The schema model to visualize
 * @param focusedType Optional type name to focus on initially
 * @returns HTML string for the webview
 */
function getSchemaVisualizerHtml(
  webview: vscode.Webview,
  extUri: Uri,
  schemaModel: SchemaVisualizerModel,
  focusedType?: string,
): string {
  // Helper to get webview URIs
  const getUri = (pathList: string[]) => {
    return webview.asWebviewUri(Uri.joinPath(extUri, "webview", ...pathList));
  };

  // Load resources
  const jointJsUri = getUri(["libs", "joint.min.js"]);
  const customJsUri = getUri(["js", "schema-visualizer.js"]);
  const customCssUri = getUri(["css", "schema-visualizer.css"]);

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="color-scheme" content="light dark">
      <title>StepZen Schema Visualizer</title>
      <link rel="stylesheet" href="${customCssUri}">
      <style>
        html, body {
          margin: 0;
          padding: 0;
          height: 100%;
          width: 100%;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          transition: background-color 0.2s ease;
        }

        #diagram {
          flex: 1;
          position: relative;
          overflow: hidden;
        }

        /* Search count styles */
        #search-count {
          color: var(--vscode-descriptionForeground);
        }
        
        .loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: var(--vscode-foreground);
        }
        
        .loading .spinner {
          width: 50px;
          height: 50px;
          margin-bottom: 20px;
          border: 5px solid var(--vscode-editor-background);
          border-top: 5px solid var(--vscode-textLink-foreground);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>
    </head>
    <body>
      <div id="toolbar">
        <button id="zoom-in" title="Zoom in">+</button>
        <button id="zoom-out" title="Zoom out">-</button>
        <button id="reset" title="Reset view">Reset</button>
        <div style="position: relative; flex: 1; display: flex; align-items: center;">
          <input type="text" id="search" placeholder="Search for types or fields..." style="width: 100%;">
          <!-- Search navigation buttons will be added by JS -->
        </div>
      </div>
      <div id="diagram"></div>

      <!-- Load JointJS v4 first -->
      <script src="${jointJsUri}"></script>

      <!-- Then pass data and create navigator function -->
      <script>
        // Get VSCode theme info from body class
        const vscodeTheme = document.body.classList.contains('vscode-dark') ? 'dark' : 'light';
        // Use debug message for theme detection
        vscode.postMessage({
          command: 'debug-log',
          message: 'VSCode theme detected: ' + vscodeTheme
        });

        // Watch for theme changes (if user switches VS Code theme)
        const observer = new MutationObserver(mutations => {
          mutations.forEach(mutation => {
            if (mutation.attributeName === 'class') {
              const newTheme = document.body.classList.contains('vscode-dark') ? 'dark' : 'light';
              // Use debug message for theme change
              vscode.postMessage({
                command: 'debug-log',
                message: 'VSCode theme changed to: ' + newTheme
              });
              // Let the page reload to apply the new theme
              location.reload();
            }
          });
        });
        observer.observe(document.body, { attributes: true });

        // Pass the schema model to the frontend with var to ensure global scope
        var schemaModel = ${JSON.stringify(schemaModel)};
        var focusedType = ${focusedType ? `'${focusedType}'` : "null"};

        // Function to navigate back to VSCode
        function navigateToLocation(location) {
          if (location) {
            const vscode = acquireVsCodeApi();
            vscode.postMessage({
              command: 'navigateToLocation',
              location: location
            });
          }
        }

        // Display JointJS version in logs if available
        if (typeof joint !== 'undefined' && joint.version) {
          vscode.postMessage({
            command: 'debug-log',
            message: 'JointJS version: ' + joint.version
          });
        } else {
          vscode.postMessage({
            command: 'debug-log',
            message: 'JointJS not detected'
          });
        }

        // Helper to log debug messages
        function debugLog(message) {
          // Log to console for developer tools access only in development
          if (typeof message === 'object') {
            message = JSON.stringify(message);
          }

          // Send message back to extension
          vscode.postMessage({
            command: 'debug-log',
            message: message
          });
        }

        // Log initialization
        debugLog('Initializing schema visualizer');
      </script>

      <!-- Finally load our custom script -->
      <script src="${customJsUri}"></script>
    </body>
    </html>
  `;
}
