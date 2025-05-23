/**
 * Copyright IBM Corp. 2025
 * Assisted by CursorAI
 */

import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { execSync } from "child_process";
import { StepZenError, handleError } from "../errors";
import { StepZenConfig } from "../types";
import { services } from "../services";

/**
 * Helper function to get StepZen configuration information
 * Retrieves account, domain, API key, and endpoint from StepZen CLI and config
 * 
 * @param workspaceFolderPath Path to the workspace folder containing StepZen config
 * @returns Object with StepZen account, domain, API key, and endpoint
 */
function getStepZenInfo(workspaceFolderPath: string): {
  account: string;
  domain: string;
  apiKey: string;
  endpoint: string;
} {
  try {
    const account = execSync("stepzen whoami --account").toString().trim();
    const domain = execSync("stepzen whoami --domain").toString().trim();
    const apiKey = execSync("stepzen whoami --apikey").toString().trim();
    
    const configPath = path.join(workspaceFolderPath, "stepzen.config.json");
    if (!fs.existsSync(configPath)) {
      throw new StepZenError(
        `StepZen configuration file not found at: ${configPath}`, 
        "CONFIG_FILE_NOT_FOUND"
      );
    }
    
    const configContent = fs.readFileSync(configPath, "utf8");
    const endpointJson = JSON.parse(configContent) as StepZenConfig;
    
    if (!endpointJson.endpoint) {
      throw new StepZenError(
        "Missing 'endpoint' field in StepZen configuration", 
        "CONFIG_VALIDATION_ERROR"
      );
    }
    
    const endpoint = endpointJson.endpoint;
    return { account, domain, apiKey, endpoint };
  } catch (err: unknown) {
    // Re-throw with better context if it's not already a StepZenError
    if (typeof err === 'object' && err !== null && 'name' in err && err.name !== 'StepZenError') {
      throw new StepZenError(
        "Failed to retrieve StepZen project information", 
        "CONFIG_ERROR",
        err
      );
    }
    throw err;
  }
}

/**
 * Opens the StepZen Query Explorer in a webview panel
 * Creates a GraphiQL interface connected to the current StepZen endpoint
 * 
 * @param context The VS Code extension context
 */
export function openQueryExplorer(context: vscode.ExtensionContext) {
  try {
    services.logger.info("Starting Open Query Explorer command");
    
    const panel = vscode.window.createWebviewPanel(
      "stepzenExplorer",
      "StepZen Query Explorer",
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
      }
    );

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      const error = new StepZenError(
        "No workspace open", 
        "WORKSPACE_ERROR"
      );
      vscode.window.showErrorMessage("No workspace open");
      services.logger.warn("Open Query Explorer failed: No workspace open");
      handleError(error);
      return;
    }
    const workspaceFolderPath = workspaceFolders[0].uri.fsPath;

    let stepzenInfo;
    try {
      stepzenInfo = getStepZenInfo(workspaceFolderPath);
      services.logger.info(`Retrieved StepZen info for endpoint: ${stepzenInfo.endpoint}`);
    } catch (err) {
      handleError(err);
      return;
    }

    const fullUrl = `https://${stepzenInfo.account}.${stepzenInfo.domain}/${stepzenInfo.endpoint}/graphql`;

    // Build safe webview URIs for local libs
    const reactUri = panel.webview.asWebviewUri(
      vscode.Uri.joinPath(
        context.extensionUri,
        "webview",
        "libs",
        "react.production.min.js"
      )
    );
    const reactDomUri = panel.webview.asWebviewUri(
      vscode.Uri.joinPath(
        context.extensionUri,
        "webview",
        "libs",
        "react-dom.production.min.js"
      )
    );
    const graphiqlUri = panel.webview.asWebviewUri(
      vscode.Uri.joinPath(
        context.extensionUri,
        "webview",
        "libs",
        "graphiql.min.js"
      )
    );
    const graphiqlCssUri = panel.webview.asWebviewUri(
      vscode.Uri.joinPath(
        context.extensionUri,
        "webview",
        "libs",
        "graphiql.min.css"
      )
    );
    const pluginExplorerUri = panel.webview.asWebviewUri(
      vscode.Uri.joinPath(
        context.extensionUri,
        "webview",
        "libs",
        "plugin-explorer.min.js"
      )
    );
    const pluginExplorerCssUri = panel.webview.asWebviewUri(
      vscode.Uri.joinPath(
        context.extensionUri,
        "webview",
        "libs",
        "plugin-explorer.min.css"
      )
    );

    // Set the Webview HTML
    panel.webview.html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>StepZen Explorer</title>
        <link rel="stylesheet" href="${graphiqlCssUri}">
        <link rel="stylesheet" href="${pluginExplorerCssUri}">
        <style>
          html, body, #graphiql {
            margin: 0;
            padding: 0;
            height: 100%;
            width: 100%;
            overflow: hidden;
          }
        </style>
      </head>
      <body>
        <div id="graphiql">Loading...</div>
        <script src="${reactUri}"></script>
        <script src="${reactDomUri}"></script>
        <script src="${graphiqlUri}"></script>
        <script src="${pluginExplorerUri}"></script>
        <script>
          const root = ReactDOM.createRoot(document.getElementById('graphiql'));
          const fetcher = GraphiQL.createFetcher({
            url: '${fullUrl}',
            headers: { 'Authorization': 'Apikey ${stepzenInfo.apiKey}' },
          });
          const explorerPlugin = GraphiQLPluginExplorer.explorerPlugin();
          root.render(
            React.createElement(GraphiQL, {
              fetcher,
              defaultEditorToolsVisibility: true,
              plugins: [explorerPlugin],
            }),
          );
        </script>
      </body>
      </html>
    `;

    services.logger.info("Query Explorer opened successfully");
  } catch (err) {
    handleError(err);
  }
}
