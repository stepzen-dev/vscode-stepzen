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

/**
 * Results panel implementation extending BaseWebviewPanel
 * Displays GraphQL response data with tabs for data, errors, debug, and trace
 */
class ResultsPanel extends BaseWebviewPanel {
  private static instance: ResultsPanel | undefined;

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
        vscode.ViewColumn.Beside
      );
    }

    this.panel.webview.html = this.generateHtml(this.panel.webview, payload);
    this.reveal();
  }

  /**
   * Clears the results panel by disposing it
   */
  public clear(): void {
    this.dispose();
  }

  protected onDispose(): void {
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