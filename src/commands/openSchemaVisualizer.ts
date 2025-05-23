/**
 * Copyright IBM Corp. 2025
 * Assisted by CursorAI
 */

import * as vscode from "vscode";
import { openSchemaVisualizerPanel } from "../panels/schemaVisualizerPanel";
import { EXTENSION_URI } from "../extension";
import { services } from "../services";
import { handleError } from "../errors";

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
  try {
    services.logger.info(
      `Opening Schema Visualizer command${focusedType ? ` focused on type: ${focusedType}` : ""}`,
    );
    
    const extensionUri = EXTENSION_URI || context.extensionUri;
    await openSchemaVisualizerPanel(extensionUri, focusedType);
    
    services.logger.info("Schema Visualizer opened successfully");
  } catch (err) {
    handleError(err);
  }
}