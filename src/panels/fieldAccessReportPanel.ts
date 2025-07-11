/**
 * Copyright IBM Corp. 2025
 * Assisted by CursorAI
 */

import * as vscode from "vscode";
import { BaseWebviewPanel } from "./BaseWebviewPanel";
import { services } from "../services";
import { FieldAccessReport } from "../services/fieldAccessReport";
import { EXTENSION_URI } from "../extension";

export class FieldAccessReportPanel extends BaseWebviewPanel {
  private static instance: FieldAccessReportPanel | undefined;
  private report: FieldAccessReport | null = null;
  protected disposables: vscode.Disposable[] = [];

  private constructor(extensionUri: vscode.Uri) {
    super(extensionUri);
  }

  public static getInstance(): FieldAccessReportPanel {
    if (!FieldAccessReportPanel.instance) {
      FieldAccessReportPanel.instance = new FieldAccessReportPanel(EXTENSION_URI);
    }
    return FieldAccessReportPanel.instance;
  }

  public async openWithReport(report: FieldAccessReport): Promise<void> {
    this.report = report;
    services.logger.info("Opening Field Access Report Panel");

    if (!this.panel) {
      this.panel = this.createWebviewPanel(
        "fieldAccessReport",
        "Field Access Report",
        vscode.ViewColumn.Active
      );

      this.setupMessageHandling();
    }

    this.reveal();
    this.panel.webview.html = this.generateHtml(this.panel.webview, report);
  }

  private setupMessageHandling(): void {
    if (!this.panel) {
      return;
    }

    this.panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case "exportJson":
            await this.handleExportJson();
            break;
          case "copyToClipboard":
            await this.handleCopyToClipboard();
            break;
          case "openPolicyEditor":
            await this.handleOpenPolicyEditor();
            break;
          case "toggleSection":
            this.handleToggleSection(message.sectionId);
            break;
        }
      },
      undefined,
      this.disposables
    );
  }

  private async handleExportJson(): Promise<void> {
    if (!this.report) {
      return;
    }

    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file("field-access-report.json"),
      filters: { "JSON": ["json"] }
    });

    if (uri) {
      const fs = require("fs");
      fs.writeFileSync(uri.fsPath, JSON.stringify(this.report, null, 2), "utf8");
      vscode.window.showInformationMessage(`Report saved to ${uri.fsPath}`);
    }
  }

  private async handleCopyToClipboard(): Promise<void> {
    if (!this.report) {
      return;
    }

    const jsonString = JSON.stringify(this.report, null, 2);
    await vscode.env.clipboard.writeText(jsonString);
    vscode.window.showInformationMessage("Report copied to clipboard");
  }

  private async handleOpenPolicyEditor(): Promise<void> {
    try {
      const { PolicyEditorPanel } = await import("./policyEditorPanel.js");
      const panel = PolicyEditorPanel.getInstance();
      await panel.openWithPolicy();
    } catch (error) {
      services.logger.error("Error opening policy editor", error);
      vscode.window.showErrorMessage("Failed to open policy editor");
    }
  }

  private handleToggleSection(sectionId: string): void {
    if (!this.panel) {return;}
    
    this.panel.webview.postMessage({
      command: "toggleSection",
      sectionId
    });
  }

  protected onDispose(): void {
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
    super.onDispose();
    FieldAccessReportPanel.instance = undefined;
  }

  protected generateHtml(webview: vscode.Webview, report: FieldAccessReport): string {
    const nonce = this.nonce();
    const reportData = JSON.stringify(report);
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta http-equiv="Content-Security-Policy" content="${this.csp(webview, nonce)}">
        <meta name="color-scheme" content="light dark">
        <title>Field Access Report</title>
        <link rel="stylesheet" href="${this.getWebviewUri(webview, ['css', 'field-access-report.css'])}">
      </head>
      <body>
        <div id="fieldAccessReportRoot"></div>
        <script nonce="${nonce}" src="${this.getWebviewUri(webview, ['js', 'field-access-report.js'])}"></script>
        <script nonce="${nonce}">
          const vscode = acquireVsCodeApi();
          document.addEventListener('DOMContentLoaded', function() {
            window.initFieldAccessReportPanel(${reportData});
          });
        </script>
      </body>
      </html>
    `;
  }
} 