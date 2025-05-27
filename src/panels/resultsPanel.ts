/**
 * Copyright IBM Corp. 2025
 * Assisted by CursorAI
 */

// src/panels/resultsPanel.ts
import * as vscode from "vscode";
import { Uri } from "vscode";
import { EXTENSION_URI } from "../extension";
import { StepZenResponse } from "../types";
import { UI } from "../utils/constants";
import { BaseWebviewPanel } from "./BaseWebviewPanel";
import { services } from "../services";

/**
 * Results panel implementation extending BaseWebviewPanel
 * Displays GraphQL response data with tabs for data, errors, debug, and trace
 */
class ResultsPanel extends BaseWebviewPanel {
  private static instance: ResultsPanel | undefined;
  private messageHandler: vscode.Disposable | undefined;

  private constructor(extensionUri: Uri) {
    super(extensionUri);
  }

  /**
   * Gets or creates the singleton results panel instance
   */
  public static getInstance(): ResultsPanel {
    if (!ResultsPanel.instance) {
      ResultsPanel.instance = new ResultsPanel(EXTENSION_URI);
    }
    return ResultsPanel.instance;
  }

  /**
   * Opens or reveals the results panel and displays the payload
   */
  public async openWithPayload(payload: StepZenResponse): Promise<void> {
    if (!this.panel) {
      this.panel = this.createWebviewPanel(
        UI.RESULTS_PANEL_VIEW_TYPE,
        UI.RESULTS_PANEL_TITLE,
        vscode.ViewColumn.Active
      );
      
      // Setup message handling for VS Code integration
      this.setupMessageHandling();
    }

    this.panel.webview.html = this.generateHtml(this.panel.webview, payload);
    this.reveal();
  }

  /**
   * Setup message handling for webview-to-extension communication
   */
  private setupMessageHandling(): void {
    if (!this.panel) {
      return;
    }

    this.messageHandler = this.panel.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case "navigateToSchema":
          await this.handleNavigateToSchema(message);
          return;
          
        case "debug-log":
          // Log messages from the webview to the StepZen output channel
          services.logger.debug(`[Results Panel] ${message.message}`);
          return;
          
        default:
          services.logger.warn(`Unknown message command: ${message.command}`);
      }
    });
  }

  /**
   * Handle navigation to schema definition from a span
   */
  private async handleNavigateToSchema(message: any): Promise<void> {
    try {
      services.logger.info(`Navigate to schema requested for span: ${message.spanName}`);
      
      // Extract GraphQL field information from span attributes
      const fieldPath = message.spanAttributes?.['graphql.field.path'];
      
      if (!fieldPath || !Array.isArray(fieldPath)) {
        vscode.window.showWarningMessage("No GraphQL field path found in span data");
        return;
      }
      
      // Use schema index to find the field definition
      const fieldIndex = services.schemaIndex.getFieldIndex();
      
      // For field paths like ["customer", "orders"], we want to find the "orders" field on the "Customer" type
      // The field path contains aliases, but we need to resolve to actual field names
      let typeName: string;
      let fieldName: string;
      
      if (fieldPath.length === 1) {
        // Root field like ["customer"] -> Query.customer
        typeName = "Query";
        // For root fields, try to get the actual field name from the span name
        // Span names are typically like "resolve Query.customer"
        const spanName = message.spanName || '';
        const resolveMatch = spanName.match(/resolve\s+(\w+)\.(\w+)/);
        if (resolveMatch) {
          fieldName = resolveMatch[2]; // Extract actual field name from span name
        } else {
          fieldName = fieldPath[0]; // Fallback to path (might be alias)
        }
      } else {
        // Nested field like ["customer", "orders"] -> Customer.orders
        // We need to resolve the type of the parent field
        const parentFieldName = fieldPath[fieldPath.length - 2];
        fieldName = fieldPath[fieldPath.length - 1];
        
        // Find the parent field to get its return type
        const queryFields = fieldIndex["Query"] || [];
        const parentField = queryFields.find(f => f.name === parentFieldName);
        
        if (parentField) {
          // Extract type name from the field type (remove [] and ! modifiers)
          typeName = parentField.type.replace(/[\[\]!]/g, '');
        } else {
          // Fallback: capitalize the parent field name
          typeName = parentFieldName.charAt(0).toUpperCase() + parentFieldName.slice(1);
        }
        
        // For nested fields, also try to get actual field name from span name
        const spanName = message.spanName || '';
        const resolveMatch = spanName.match(/resolve\s+(\w+)\.(\w+)/);
        if (resolveMatch) {
          fieldName = resolveMatch[2]; // Use actual field name from span
        }
      }
      
      // Find the field in the schema index
      const typeFields = fieldIndex[typeName] || [];
      const targetField = typeFields.find(f => f.name === fieldName);
      
      if (targetField && targetField.location) {
        // Navigate to the field definition
        const uri = vscode.Uri.file(targetField.location.uri);
        const document = await vscode.workspace.openTextDocument(uri);
        const editor = await vscode.window.showTextDocument(document);
        
        const position = new vscode.Position(
          targetField.location.line,
          targetField.location.character
        );
        
        editor.selection = new vscode.Selection(position, position);
        editor.revealRange(
          new vscode.Range(position, position),
          vscode.TextEditorRevealType.InCenter
        );
        
        services.logger.info(`Navigated to ${typeName}.${fieldName} at ${targetField.location.uri}:${targetField.location.line}`);
      } else {
        vscode.window.showWarningMessage(`Could not find schema definition for ${typeName}.${fieldName}`);
        services.logger.warn(`Schema definition not found for ${typeName}.${fieldName}`);
      }
      
    } catch (error) {
      services.logger.error("Error navigating to schema", error);
      vscode.window.showErrorMessage("Failed to navigate to schema definition");
    }
  }

  /**
   * Clears the results panel by disposing it
   */
  public clear(): void {
    this.dispose();
  }

  protected onDispose(): void {
    if (this.messageHandler) {
      this.messageHandler.dispose();
      this.messageHandler = undefined;
    }
    super.onDispose();
    ResultsPanel.instance = undefined;
  }

  protected generateHtml(webview: vscode.Webview, payload: StepZenResponse): string {
    const nonce = this.nonce();
    const payloadJs = JSON.stringify(payload);
    const hasErrors = Array.isArray(payload?.errors) && payload.errors.length > 0;
    
    return /* html */ `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta http-equiv="Content-Security-Policy" content="${this.csp(webview, nonce)}">
      <title>${UI.RESULTS_PANEL_TITLE}</title>
      
      <!-- Link to CSS file instead of inline styles -->
      <link rel="stylesheet" href="${this.getWebviewUri(webview, ['css', 'results-panel.css'])}">
    </head>
    <body>
      <div class="tabs">
        <div class="tab active" data-id="data">Data</div>
        ${hasErrors ? '<div class="tab" data-id="errors">Errors</div>' : ''}
        <div class="tab" data-id="debug">Debug</div>
        <div class="tab" data-id="trace">Trace View</div>
      </div>
      
      <div id="pane-data" class="panel"></div>
      ${hasErrors ? '<div id="pane-errors" class="panel" hidden></div>' : ''}
      <div id="pane-debug" class="panel" hidden></div>
      <div id="pane-trace" class="panel" hidden></div>
      
      <!-- Load React libraries -->
      <script nonce="${nonce}" src="${this.getWebviewUri(webview, ['libs', 'react.production.min.js'])}"></script>
      <script nonce="${nonce}" src="${this.getWebviewUri(webview, ['libs', 'react-dom.production.min.js'])}"></script>
      <script nonce="${nonce}" src="${this.getWebviewUri(webview, ['libs', 'react-json-view.min.js'])}"></script>
      
      <!-- Load our custom scripts -->
      <script nonce="${nonce}" src="${this.getWebviewUri(webview, ['js', 'trace-viewer.js'])}"></script>
      <script nonce="${nonce}" src="${this.getWebviewUri(webview, ['js', 'results-panel.js'])}"></script>
      
      <!-- Initialize the panel -->
      <script nonce="${nonce}">
        // Acquire VS Code API for webview communication
        const vscode = acquireVsCodeApi();
        
        // Initialize when the DOM is ready
        document.addEventListener('DOMContentLoaded', () => {
          const payload = ${payloadJs};
          window.ResultsPanel.initResultsPanel(payload);
        });
      </script>
    </body>
    </html>
    `;
  }
}

/** The singleton results panel instance */
let resultsPanel: ResultsPanel | undefined;

/**
 * Opens or reveals the results panel and displays the payload
 * 
 * @param payload The GraphQL response data to display
 */
export async function openResultsPanel(payload: StepZenResponse) {
  if (!resultsPanel) {
    resultsPanel = ResultsPanel.getInstance();
  }
  await resultsPanel.openWithPayload(payload);
}

/**
 * Clears the results panel by disposing the webview panel
 * Used when clearing results or when the extension is deactivated
 */
export function clearResultsPanel(): void {
  if (resultsPanel) {
    resultsPanel.clear();
    resultsPanel = undefined;
  }
}