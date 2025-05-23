/**
 * Copyright IBM Corp. 2025
 * Assisted by CursorAI
 */

import * as vscode from "vscode";
import { findDefinition } from "../utils/stepzenProjectScanner";
import { services } from "../services";
import { handleError } from "../errors";

/**
 * Implements Go to Definition functionality for GraphQL symbols
 * Finds the definition of the symbol under the cursor and navigates to it
 * If multiple definitions exist, shows a quick-pick to let the user choose
 *
 * @returns Promise that resolves when navigation is complete or cancelled
 */
export async function goToDefinition() {
  try {
    services.logger.info("Starting Go to Definition command");
    
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage("No active editor.");
      services.logger.warn("Go to Definition failed: No active editor");
      return;
    }

    const document = editor.document;
    const position = editor.selection.active;
    const wordRange = document.getWordRangeAtPosition(position);
    if (!wordRange) {
      vscode.window.showWarningMessage("No symbol selected.");
      services.logger.warn("Go to Definition failed: No symbol selected");
      return;
    }

    const token = document.getText(wordRange);
    services.logger.info(`Searching for definition of symbol: "${token}"`);
    
    const locations = findDefinition(token);
    if (!locations || locations.length === 0) {
      vscode.window.showWarningMessage(`No definition found for "${token}".`);
      services.logger.warn(`No definition found for "${token}".`);
      return;
    }

    // Single location found - jump directly to it
    if (locations.length === 1) {
      const loc = locations[0];
      services.logger.info(`Found "${token}" in ${loc.filePath}.`);
      const uri = vscode.Uri.file(loc.filePath);
      const pos = new vscode.Position(loc.line, loc.character);
      const doc = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(doc, {
        selection: new vscode.Range(pos, pos),
      });
      services.logger.info("Go to Definition completed successfully");
      return;
    }

    // Multiple locations found - offer a quick-pick list for user selection
    // Log message for debugging
    services.logger.info(
      `Multiple definitions for "${token}" found. Prompting user to select one.`,
    );
    const pick = await vscode.window.showQuickPick(
      locations.map((loc) => {
        const rel = vscode.workspace.asRelativePath(loc.filePath);
        const container = loc.container ?? "<type>"; // null for type-level symbols
        return {
          label: `${container}  —  ${rel}`,
          description: `line ${loc.line + 1}`,
          loc,
        } as const;
      }),
      {
        placeHolder: `Multiple definitions for "${token}" found…`,
      },
    );

    if (pick) {
      const loc = pick.loc as (typeof locations)[number];
      const uri = vscode.Uri.file(loc.filePath);
      const pos = new vscode.Position(loc.line, loc.character);
      const doc = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(doc, {
        selection: new vscode.Range(pos, pos),
      });
      services.logger.info("Go to Definition completed successfully");
    } else {
      services.logger.info("Go to Definition cancelled by user");
    }
  } catch (err) {
    handleError(err);
  }
}
