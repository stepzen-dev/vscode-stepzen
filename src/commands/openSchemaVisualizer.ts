/**
 * Copyright IBM Corp. 2025
 * Assisted by CursorAI
 */

import * as vscode from "vscode";
import { openSchemaVisualizerPanel } from "../panels/schemaVisualizerPanel";
import { EXTENSION_URI } from "../extension";
import { services } from "../services";
import { handleError } from "../errors";
import { MESSAGES } from "../utils/constants";

/**
 * Opens the schema visualizer panel.
 * This command allows the user to visualize the GraphQL schema in a StepZen project.
 * 
 * @param context The extension context
 * @param focusedType Optional type name to focus on in the visualization
 */
export async function openSchemaVisualizer(
  context: vscode.ExtensionContext,
  focusedType?: string,
) {
  // Check workspace trust
  if (!vscode.workspace.isTrusted) {
    vscode.window.showWarningMessage(MESSAGES.FEATURE_NOT_AVAILABLE_UNTRUSTED);
    return;
  }

  // Check if workspace is open
  if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
    vscode.window.showErrorMessage(MESSAGES.NO_WORKSPACE_OPEN);
    return;
  }

  try {
    services.logger.info(
      `Opening Schema Visualizer${focusedType ? ` focused on type: ${focusedType}` : ""}`,
    );
    
    const extensionUri = EXTENSION_URI || context.extensionUri;
    await openSchemaVisualizerPanel(extensionUri, focusedType);
    
    services.logger.info("Schema Visualizer opened successfully");
  } catch (err) {
    handleError(err);
  }
}