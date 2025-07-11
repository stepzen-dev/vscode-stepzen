/**
 * Copyright IBM Corp. 2025
 * Assisted by CursorAI
 */

import * as vscode from "vscode";
import { services } from "../services";
import { PolicyEditorPanel } from "../panels/policyEditorPanel";
import * as path from "path";

export async function openPolicyEditor() {
  try {
    services.logger.info("Opening Policy Editor");

    // Check workspace trust
    if (!vscode.workspace.isTrusted) {
      vscode.window.showWarningMessage("Policy editor is not available in untrusted workspaces");
      return;
    }

    // Ensure schema is indexed
    const projectRoot = await services.projectResolver.resolveStepZenProjectRoot();
    const schemaEntry = path.join(projectRoot, "index.graphql");
    await services.schemaIndex.scan(schemaEntry);

    // Open the policy editor
    const panel = PolicyEditorPanel.getInstance();
    await panel.openWithPolicy();

  } catch (error) {
    services.logger.error("Error opening policy editor", error);
    vscode.window.showErrorMessage("Failed to open policy editor");
  }
} 