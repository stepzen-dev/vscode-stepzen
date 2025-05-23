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

/** The singleton results panel instance */
let panel: vscode.WebviewPanel | undefined;

/**
 * Opens or reveals the results panel and displays the payload
 * 
 * @param payload The GraphQL response data to display
 */
export async function openResultsPanel(payload: StepZenResponse) {
  const extensionUri = EXTENSION_URI;
  if (!panel) {
    panel = vscode.window.createWebviewPanel(
      UI.RESULTS_PANEL_VIEW_TYPE,
      UI.RESULTS_PANEL_TITLE,
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        localResourceRoots: [Uri.joinPath(extensionUri, "webview")],
      }
    );
    panel.onDidDispose(() => (panel = undefined));
  }

  panel.webview.html = getHtml(panel.webview, extensionUri, payload);
  panel.reveal();
}

/**
 * Clears the results panel by disposing the webview panel
 * Used when clearing results or when the extension is deactivated
 */
export function clearResultsPanel(): void {
  if (panel) {
    panel.dispose();
    panel = undefined;
  }
}

/*─────────────────────────────────────────────────────────*/

/**
 * Generates the HTML content for the results panel webview
 * 
 * @param webview The webview to generate HTML for
 * @param extUri The extension URI for resource loading
 * @param payload The GraphQL response data to display
 * @returns HTML string for the webview
 */
function getHtml(
  webview: vscode.Webview,
  extUri: Uri,
  payload: StepZenResponse
): string {
  // Helper to get webview URIs
  const getUri = (pathList: string[]) => {
    return webview.asWebviewUri(Uri.joinPath(extUri, "webview", ...pathList));
  };

  const nonce = getNonce();
  const payloadJs = JSON.stringify(payload);
  const hasErrors = Array.isArray(payload?.errors) && payload.errors.length > 0;
  
  return /* html */ `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource}; style-src ${webview.cspSource}; script-src 'nonce-${nonce}' ${webview.cspSource};">
    <title>${UI.RESULTS_PANEL_TITLE}</title>
    
    <!-- Link to CSS file instead of inline styles -->
    <link rel="stylesheet" href="${getUri(['css', 'results-panel.css'])}">
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
    <script nonce="${nonce}" src="${getUri(['libs', 'react.production.min.js'])}"></script>
    <script nonce="${nonce}" src="${getUri(['libs', 'react-dom.production.min.js'])}"></script>
    <script nonce="${nonce}" src="${getUri(['libs', 'react-json-view.min.js'])}"></script>
    
    <!-- Load our custom scripts -->
    <script nonce="${nonce}" src="${getUri(['js', 'trace-viewer.js'])}"></script>
    <script nonce="${nonce}" src="${getUri(['js', 'results-panel.js'])}"></script>
    
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

/**
 * Generates a random nonce for Content Security Policy
 * Used to secure inline scripts in the webview
 * 
 * @returns A random string to use as a nonce
 */
function getNonce() {
  return [...Array(16)].map(() => Math.random().toString(36)[2]).join("");
}