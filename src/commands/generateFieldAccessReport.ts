/**
 * Copyright IBM Corp. 2025
 * Assisted by CursorAI
 */

import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { services } from "../services";
import { generateFieldAccessReportData } from "../services/fieldAccessReport";
import { FieldAccessReportPanel } from "../panels/fieldAccessReportPanel";

export async function generateFieldAccessReport() {
  try {
    // Prompt user for output type
    const outputType = await vscode.window.showQuickPick([
      { label: "Show in Panel", description: "Interactive visual report" },
      { label: "Export as JSON", description: "Save report to a file" }
    ], {
      placeHolder: "How would you like to view the Field Access Report?",
      canPickMany: false
    });
    if (!outputType) {
      return;
    }

    // Resolve project root and config.yaml
    const projectRoot = await services.projectResolver.resolveStepZenProjectRoot();
    const configPath = path.join(projectRoot, "config.yaml");
    if (!fs.existsSync(configPath)) {
      vscode.window.showErrorMessage("No config.yaml found in the StepZen project root.");
      return;
    }
    const configContent = fs.readFileSync(configPath, "utf8");

    // Ensure schema is indexed
    const schemaEntry = path.join(projectRoot, "index.graphql");
    await services.schemaIndex.scan(schemaEntry);

    // Generate the report
    const report = await generateFieldAccessReportData(
      services.schemaIndex,
      services.fieldPolicyParser,
      configContent
    );

    if (outputType.label === "Export as JSON") {
      // Prompt for file location
      const uri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(path.join(projectRoot, "field-access-report.json")),
        filters: { "JSON": ["json"] }
      });
      if (!uri) {
        return;
      }
      fs.writeFileSync(uri.fsPath, JSON.stringify(report, null, 2), "utf8");
      vscode.window.showInformationMessage(`Field Access Report saved to ${uri.fsPath}`);
      return;
    }

    // Show in panel
    const panel = FieldAccessReportPanel.getInstance();
    await panel.openWithReport(report);
  } catch (err) {
    services.logger.error("Error generating Field Access Report", err);
    vscode.window.showErrorMessage("Failed to generate Field Access Report");
  }
} 