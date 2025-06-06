/**
 * Copyright IBM Corp. 2025
 * Assisted by CursorAI
 */

// src/panels/schemaVisualizerPanel.ts
import * as vscode from "vscode";
import { Uri } from "vscode";
import type {
  FieldInfo,
  DirectiveInfo,
  TypeRelationship,
} from "../services/schema/indexer";
import { services } from "../services";
import * as path from "path";
import * as fs from "fs";
import { MESSAGES, FILE_PATTERNS, UI } from "../utils/constants";
import { BaseWebviewPanel } from "./BaseWebviewPanel";

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

/**
 * Schema visualizer panel implementation extending BaseWebviewPanel
 * Displays GraphQL schema as an interactive diagram
 */
class SchemaVisualizerPanel extends BaseWebviewPanel {
  private static instance: SchemaVisualizerPanel | undefined;
  private messageHandler: vscode.Disposable | undefined;

  private constructor(extensionUri: Uri) {
    super(extensionUri);
  }

  /**
   * Gets or creates the singleton schema visualizer panel instance
   */
  public static getInstance(extensionUri: Uri): SchemaVisualizerPanel {
    if (!SchemaVisualizerPanel.instance) {
      SchemaVisualizerPanel.instance = new SchemaVisualizerPanel(extensionUri);
    }
    return SchemaVisualizerPanel.instance;
  }

  /**
   * Opens or reveals the schema visualizer panel
   */
  public async openWithFocus(focusedType?: string): Promise<void> {
    services.logger.info(
      `Opening Schema Visualizer${focusedType ? ` focused on type: ${focusedType}` : ""}`,
    );

    // Create panel if it doesn't exist
    if (!this.panel) {
      this.panel = this.createWebviewPanel(
        UI.SCHEMA_VISUALIZER_VIEW_TYPE,
        UI.SCHEMA_VISUALIZER_TITLE,
        vscode.ViewColumn.Active
      );

      // Setup message handling
      this.setupMessageHandling();
      
      // Initially show loading state
      this.panel.webview.html = this.getLoadingHtml();
    }
    
    this.reveal();

    try {
      // Ensure schema data is loaded
      const dataLoaded = await this.ensureSchemaDataLoaded();

      if (!dataLoaded) {
        this.panel.webview.html = this.getNoProjectHtml();
        return;
      }

      // Build the schema model for visualization
      const schemaModel = this.buildSchemaModel();

      // Validate the schema model
      const typeCount = Object.keys(schemaModel.types).length;
      const fieldCount = Object.keys(schemaModel.fields).length;
      const relationshipCount = schemaModel.relationships.length;

      services.logger.debug(
        `Schema model built: ${typeCount} types, ${fieldCount} field entries, ${relationshipCount} relationships`,
      );

      if (typeCount === 0) {
        services.logger.warn("No types found in schema model - showing empty schema message");
        this.panel.webview.html = this.getEmptySchemaHtml();
        return;
      }

      // Update the webview with the schema data
      this.panel.webview.html = this.generateHtml(this.panel.webview, { schemaModel, focusedType });
      
    } catch (error) {
      services.logger.error(`Error loading schema visualizer`, error);
      this.panel.webview.html = this.getNoProjectHtml();
    }
  }

  private setupMessageHandling(): void {
    if (!this.panel) {return;}

    this.messageHandler = this.panel.webview.onDidReceiveMessage(async (message) => {
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
          services.logger.debug(`[Webview] ${message.message}`);
          return;
        case "refresh-schema":
          // Handle schema refresh request
          services.logger.info("Schema refresh requested from visualizer");
          try {
            // Clear the schema index cache
            services.schemaIndex.clearState();
            // Reload the schema data
            await this.openWithFocus();
          } catch (error) {
            services.logger.error("Failed to refresh schema", error);
            vscode.window.showErrorMessage("Failed to refresh schema data. Check the output for details.");
          }
          return;
      }
    });
  }

  protected onDispose(): void {
    if (this.messageHandler) {
      this.messageHandler.dispose();
      this.messageHandler = undefined;
    }
    super.onDispose();
    SchemaVisualizerPanel.instance = undefined;
  }

  private getLoadingHtml(): string {
    const nonce = this.nonce();
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta http-equiv="Content-Security-Policy" content="${this.csp(this.panel!.webview, nonce)}">
        <meta name="color-scheme" content="light dark">
        <title>StepZen Schema Visualizer</title>
        <style nonce="${nonce}">
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
          <div>${MESSAGES.SCHEMA_VISUALIZER_LOADING}</div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Ensures that schema data is loaded before the visualizer is opened.
   * If the schema data appears to be empty, this will trigger a scan of the project.
   * @returns true if schema data was successfully loaded, false otherwise
   */
  private async ensureSchemaDataLoaded(): Promise<boolean> {
    services.logger.debug("Checking if schema data is available...");
    
    const fieldIndex = services.schemaIndex.getFieldIndex();
    const typeCount = Object.keys(fieldIndex).length;
    
    services.logger.debug(`Current field index has ${typeCount} types`);

    // If we already have schema data, return true
    if (typeCount > 0) {
      services.logger.debug("Using existing schema data");
      return true;
    }

    services.logger.info("Schema data not found, attempting to load project...");

    try {
      // Find StepZen project root using the project resolver service
      let hintUri: vscode.Uri | undefined;
      
      // Get hint URI from active editor if available
      if (vscode.window.activeTextEditor) {
        hintUri = vscode.window.activeTextEditor.document.uri;
        services.logger.debug(`Using active editor URI: ${hintUri.fsPath}`);
      } 
      // Otherwise use the first workspace folder
      else if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
        hintUri = vscode.workspace.workspaceFolders[0].uri;
        services.logger.debug(`Using workspace folder URI: ${hintUri.fsPath}`);
      }

      // If we have no hint, we can't proceed
      if (!hintUri) {
        services.logger.warn("No workspace folder or active editor available");
        return false;
      }

      // Use the project resolver service to find the project root
      const projectRoot = await services.projectResolver.resolveStepZenProjectRoot(hintUri);
      const indexPath = path.join(projectRoot, FILE_PATTERNS.MAIN_SCHEMA_FILE);

      services.logger.debug(`Resolved project root: ${projectRoot}`);
      services.logger.debug(`Index path: ${indexPath}`);

      // Verify that the index file exists
      if (!fs.existsSync(indexPath)) {
        services.logger.warn(`Index file not found at ${indexPath}`);
        return false;
      }

      // Scan the project using the schema index service
      services.logger.info(`Scanning StepZen project at ${indexPath}`);
      await services.schemaIndex.scan(indexPath);
      
      // Verify the scan worked
      const newFieldIndex = services.schemaIndex.getFieldIndex();
      const newTypeCount = Object.keys(newFieldIndex).length;
      
      services.logger.debug(`Schema scan completed, found ${newTypeCount} types`);
      
      if (newTypeCount === 0) {
        services.logger.warn("Schema scan completed but no types were found");
        return false;
      }
      
      return true;
    } catch (error) {
      services.logger.error(`Failed to load schema data`, error);
      return false;
    }
  }

  /**
   * Builds a schema model for visualization using the current schema data
   * Collects types, fields, directives and relationships into a unified model
   * 
   * @returns A complete schema model for visualization
   */
  private buildSchemaModel(): SchemaVisualizerModel {
    services.logger.debug("Building schema model for visualization...");
    
    const fieldIndex = services.schemaIndex.getFieldIndex();
    const typeDirectives = services.schemaIndex.getTypeDirectives();
    const relationships = services.schemaIndex.getTypeRelationships();

    services.logger.debug(`Field index has ${Object.keys(fieldIndex).length} types`);
    services.logger.debug(`Type directives has ${Object.keys(typeDirectives).length} entries`);
    services.logger.debug(`Found ${relationships.length} relationships`);

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
      
      services.logger.debug(`Added type ${typeName} with ${fields.length} fields`);
    }

    services.logger.debug(`Schema model built with ${Object.keys(model.types).length} types`);
    return model;
  }

  /**
   * Generates HTML for when the schema is empty (no types found)
   * 
   * @returns HTML string for the empty schema message
   */
  private getEmptySchemaHtml(): string {
    const nonce = this.nonce();
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta http-equiv="Content-Security-Policy" content="${this.csp(this.panel!.webview, nonce)}">
        <meta name="color-scheme" content="light dark">
        <title>StepZen Schema Visualizer</title>
        <style nonce="${nonce}">
          body {
            font-family: var(--vscode-font-family);
            padding: 2rem;
            text-align: center;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
          }
          .message-container {
            max-width: 500px;
            margin: 0 auto;
            padding: 2rem;
            border: 1px solid var(--vscode-widget-border);
            border-radius: 8px;
            background-color: var(--vscode-editor-background);
          }
          h2 {
            color: var(--vscode-notificationsWarningIcon-foreground);
            margin-top: 0;
          }
          p {
            line-height: 1.5;
            color: var(--vscode-descriptionForeground);
          }
          .suggestion {
            margin-top: 1.5rem;
            padding: 1rem;
            background-color: var(--vscode-textBlockQuote-background);
            border-left: 4px solid var(--vscode-textBlockQuote-border);
            text-align: left;
          }
        </style>
      </head>
      <body>
        <div class="message-container">
          <h2>${MESSAGES.SCHEMA_VISUALIZER_NO_TYPES_FOUND}</h2>
          <p>
            ${MESSAGES.SCHEMA_VISUALIZER_NO_TYPES_DESCRIPTION}
          </p>
          <div class="suggestion">
            <strong>Suggestions:</strong>
            <ul>
              <li>Make sure your schema files contain type definitions</li>
              <li>Check that your index.graphql file properly references other schema files</li>
              <li>Verify that the @sdl directive includes all necessary files</li>
              <li>Try refreshing the visualizer after making changes</li>
            </ul>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generates HTML for an error message when no StepZen project is found
   * 
   * @returns HTML string for the error message
   */
  private getNoProjectHtml(): string {
    const nonce = this.nonce();
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta http-equiv="Content-Security-Policy" content="${this.csp(this.panel!.webview, nonce)}">
        <title>StepZen Schema Visualizer</title>
        <style nonce="${nonce}">
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
            ${MESSAGES.STEPZEN_PROJECT_DESCRIPTION}
          </p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Override CSP to allow inline styles for dynamic content
   * 
   * @param webview The webview to generate CSP for
   * @param nonce The nonce value to include in the CSP
   * @returns CSP header string
   */
  protected csp(webview: vscode.Webview, nonce: string): string {
    return `default-src 'none'; img-src ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' ${webview.cspSource};`;
  }

  /**
   * Generates the HTML for the schema visualizer webview panel
   * Includes all necessary scripts, styles, and data for the visualization
   * 
   * @param webview The webview to generate HTML for
   * @param data Object containing schemaModel and focusedType
   * @returns HTML string for the webview
   */
  protected generateHtml(webview: vscode.Webview, data: { schemaModel: SchemaVisualizerModel, focusedType?: string }): string {
    const { schemaModel, focusedType } = data;
    // Load resources
    const jointJsUri = this.getWebviewUri(webview, ["libs", "joint.min.js"]);
    const d3JsUri = this.getWebviewUri(webview, ["libs", "d3.min.js"]);
    const customJsUri = this.getWebviewUri(webview, ["js", "schema-visualizer.js"]);
    const customCssUri = this.getWebviewUri(webview, ["css", "schema-visualizer.css"]);
    const nonce = this.nonce();

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta http-equiv="Content-Security-Policy" content="${this.csp(webview, nonce)}">
        <meta name="color-scheme" content="light dark">
        <title>StepZen Schema Visualizer</title>
        <link rel="stylesheet" href="${customCssUri}">
        <style nonce="${nonce}">
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
        <button id="refresh" title="Refresh schema data">🔄</button>
        
        <div style="position: relative; flex: 1; display: flex; align-items: center;">
          <input type="text" id="search" placeholder="Search for types or fields..." style="width: 100%;">
          <!-- Search navigation buttons will be added by JS -->
        </div>
      </div>
      <div id="diagram"></div>

        <!-- Load JointJS v4 first -->
        <script nonce="${nonce}" src="${jointJsUri}"></script>
        
        <!-- Load D3.js for force simulation -->
        <script nonce="${nonce}" src="${d3JsUri}"></script>

        <!-- Then pass data and create navigator function -->
        <script nonce="${nonce}">
        // Acquire VS Code API first
        const vscode = acquireVsCodeApi();
        
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
        <script nonce="${nonce}" src="${customJsUri}"></script>
      </body>
      </html>
    `;
  }
}

/** The singleton schema visualizer panel instance */
let schemaVisualizerPanel: SchemaVisualizerPanel | undefined;

export async function openSchemaVisualizerPanel(
  extensionUri: Uri,
  focusedType?: string,
) {
  if (!schemaVisualizerPanel) {
    schemaVisualizerPanel = SchemaVisualizerPanel.getInstance(extensionUri);
  }
  await schemaVisualizerPanel.openWithFocus(focusedType);
}
