/**
 * Copyright IBM Corp. 2025
 * Assisted by CursorAI
 */

import * as vscode from "vscode";
import { Uri } from "vscode";

/**
 * Abstract base class for webview panels providing common functionality
 * including CSP handling, nonce generation, and URI resolution.
 */
export abstract class BaseWebviewPanel {
  protected panel: vscode.WebviewPanel | undefined;
  protected readonly extensionUri: Uri;

  constructor(extensionUri: Uri) {
    this.extensionUri = extensionUri;
  }

  /**
   * Generates a random nonce for Content Security Policy
   * Used to secure inline scripts in the webview
   * 
   * @returns A random string to use as a nonce
   */
  protected nonce(): string {
    return [...Array(16)].map(() => Math.random().toString(36)[2]).join("");
  }

  /**
   * Generates a Content Security Policy header for the webview
   * Includes proper nonce and webview source handling
   * 
   * @param webview The webview to generate CSP for
   * @param nonce The nonce value to include in the CSP
   * @returns CSP header string
   */
  protected csp(webview: vscode.Webview, nonce: string): string {
    return `default-src 'none'; img-src ${webview.cspSource}; style-src ${webview.cspSource}; script-src 'nonce-${nonce}' ${webview.cspSource};`;
  }

  /**
   * Helper to get webview URIs for resources
   * Resolves paths relative to the webview directory
   * 
   * @param webview The webview to generate URIs for
   * @param pathList Array of path segments relative to webview directory
   * @returns Webview URI for the resource
   */
  protected getWebviewUri(webview: vscode.Webview, pathList: string[]): vscode.Uri {
    return webview.asWebviewUri(Uri.joinPath(this.extensionUri, "webview", ...pathList));
  }

  /**
   * Creates the webview panel with standard options
   * 
   * @param viewType Unique identifier for the webview type
   * @param title Title to display in the panel
   * @param viewColumn Column to show the panel in
   * @param options Additional webview options
   * @returns Created webview panel
   */
  protected createWebviewPanel(
    viewType: string,
    title: string,
    viewColumn: vscode.ViewColumn,
    options?: Partial<vscode.WebviewOptions>
  ): vscode.WebviewPanel {
    const defaultOptions: vscode.WebviewOptions = {
      enableScripts: true,
      localResourceRoots: [Uri.joinPath(this.extensionUri, "webview")],
    };

    const panel = vscode.window.createWebviewPanel(
      viewType,
      title,
      viewColumn,
      { ...defaultOptions, ...options }
    );

    // Setup disposal handling
    panel.onDidDispose(() => this.onDispose());

    return panel;
  }

  /**
   * Called when the panel is disposed
   * Subclasses can override to perform cleanup
   */
  protected onDispose(): void {
    this.panel = undefined;
  }

  /**
   * Disposes the panel if it exists
   */
  public dispose(): void {
    if (this.panel) {
      this.panel.dispose();
      this.panel = undefined;
    }
  }

  /**
   * Reveals the panel if it exists
   */
  public reveal(): void {
    if (this.panel) {
      this.panel.reveal();
    }
  }

  /**
   * Abstract method that subclasses must implement to generate HTML content
   * 
   * @param webview The webview to generate HTML for
   * @param data Optional data to include in the HTML
   * @returns HTML string for the webview
   */
  protected abstract generateHtml(webview: vscode.Webview, data?: any): string;
} 