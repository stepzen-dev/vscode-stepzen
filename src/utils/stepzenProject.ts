/**
 * Copyright IBM Corp. 2025
 * Assisted by CursorAI
 */

import * as vscode from "vscode";

/**
 * Resolves the root directory of a StepZen project
 * 
 * @deprecated Use services.projectResolver.resolveStepZenProjectRoot() instead
 * This function is maintained for backward compatibility during migration
 * 
 * @param hintUri Optional URI hint to start searching from
 * @returns Promise resolving to the absolute path of the project root
 * @throws Error if no StepZen project is found or user cancels selection
 */
export async function resolveStepZenProjectRoot(
  hintUri?: vscode.Uri,
): Promise<string> {
  // Import services here to avoid circular dependency
  const { services } = await import("../services/index.js");
  return services.projectResolver.resolveStepZenProjectRoot(hintUri);
}
