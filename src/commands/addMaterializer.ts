/**
 * Copyright IBM Corp. 2025
 * Assisted by CursorAI
 */

import * as vscode from 'vscode';
import { getRootOperationsMap } from '../utils/stepzenProjectScanner';
import { services } from '../services';
import { handleError } from '../errors';

/**
 * Adds a @materializer directive to a GraphQL field
 * Analyzes the field type and suggests matching StepZen queries
 * Generates a properly formatted materializer directive with arguments
 * 
 * @returns Promise that resolves when the materializer has been added or operation is cancelled
 */
export async function addMaterializer() {
  try {
    services.logger.info("Starting Add Materializer command");
    
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No active editor');
      services.logger.warn("Add Materializer failed: No active editor");
      return;
    }

    const document = editor.document;
    const position = editor.selection.active;
    const line = document.lineAt(position.line);
    const lineText = line.text;

    // Determine current indentation from the line to preserve formatting
    const baseIndent = lineText.substring(0, line.firstNonWhitespaceCharacterIndex);

    // Extract field name and declared type from the current line
    const trimmed = lineText.trim();
    const fieldMatch = trimmed.match(/^(\w+)\s*:\s*([^\s]+)/);
    if (!fieldMatch) {
      vscode.window.showInformationMessage('Place cursor on a GraphQL field definition.');
      services.logger.warn("Add Materializer failed: Not on a GraphQL field definition");
      return;
    }
    const declaredType = fieldMatch[2];
    services.logger.info(`Processing field with type: ${declaredType}`);

    // Determine base type and whether it's a list type
    const isList = declaredType.startsWith('[');
    const baseType = declaredType.replace(/[[\]!]/g, ''); // Remove [] and ! characters

    // Find matching root operations (queries) that return the same type
    const ops = Object.entries(getRootOperationsMap()).filter(([_opName, info]) => {
      return info.returnType === baseType && info.isList === isList;
    });

    if (ops.length === 0) {
      vscode.window.showInformationMessage(
        `No matching StepZen queries found for type ${declaredType}`
      );
      services.logger.warn(`No matching StepZen queries found for type ${declaredType}`);
      return;
    }

    services.logger.info(`Found ${ops.length} matching operations for type ${declaredType}`);

    // Choose operation if multiple
    const pickItems = ops.map(([name]) => name);
    const chosen = pickItems.length === 1
      ? pickItems[0]
      : await vscode.window.showQuickPick(pickItems, {
          placeHolder: 'Select a StepZen query to materialize',
        });
    if (!chosen) {
      services.logger.info("Add Materializer cancelled by user");
      return;
    }

    services.logger.info(`Selected operation: ${chosen}`);

    // Get argument names
    const argNames = getRootOperationsMap()[chosen].args;

    // Build directive snippet with proper indentation
    const indentUnit = editor.options.insertSpaces
      ? ' '.repeat(editor.options.tabSize as number)
      : '\t';
    const directiveIndent = baseIndent + indentUnit;
    const innerIndent = directiveIndent + indentUnit;

    const snippetLines: string[] = [];
    snippetLines.push(`${directiveIndent}@materializer(`);
    snippetLines.push(`${innerIndent}query: "${chosen}"`);
    snippetLines.push(`${innerIndent}arguments: [`);

    for (const arg of argNames) {
      snippetLines.push(
        `${innerIndent}${indentUnit}{ name: "${arg}", field: "" }`
      );
    }

    snippetLines.push(`${innerIndent}]`);
    snippetLines.push(`${directiveIndent})`);

    // Insert snippet below current line
    const insertPosition = new vscode.Position(position.line + 1, 0);
    await editor.insertSnippet(
      new vscode.SnippetString(snippetLines.join('\n')),
      insertPosition
    );

    services.logger.info("Add Materializer completed successfully");
  } catch (err) {
    handleError(err);
  }
}
