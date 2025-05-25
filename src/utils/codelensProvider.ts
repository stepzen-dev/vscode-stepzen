/**
 * Copyright IBM Corp. 2025
 * Assisted by CursorAI
 */

import * as vscode from "vscode";
import type { OperationEntry } from "../services/schema/indexer";
import { services } from "../services";
import { COMMANDS } from "./constants";

/**
 * Provides CodeLens items for GraphQL operations in StepZen files
 * Adds run buttons for operations and schema visualization for type definitions
 */
export class StepZenCodeLensProvider implements vscode.CodeLensProvider {
  /**
   * Provides CodeLens items for the given document
   * Adds "Run", "Run (persisted)", and "Clear" buttons for operations
   * Also adds "View in Explorer" buttons for type definitions
   * 
   * @param document The document to provide CodeLens for
   * @param token Cancellation token
   * @returns Array of CodeLens items
   */
  public provideCodeLenses(
    document: vscode.TextDocument,
  ): vscode.CodeLens[] {
    const lenses: vscode.CodeLens[] = [];
    const opMap = services.schemaIndex.getOperationMap();
    const persistedMap = services.schemaIndex.getPersistedDocMap();
    const uriKey = document.uri.toString();
    const ops = opMap[uriKey] || [];

    ops.forEach((op: OperationEntry) => {
      const start = document.positionAt(op.range.start);
      const range = new vscode.Range(start, start);

      // ▶ Run
      lenses.push(
        new vscode.CodeLens(range, {
          title: "▶ Run",
          command: COMMANDS.RUN_OPERATION,
          arguments: [op],
        }),
      );

      // ▶ Run (persisted)
      if (op.persisted) {
        // find the matching persisted document entry
        const entry = Object.values(persistedMap).find(
          (e) =>
            e && e.fileUri.toString() === uriKey &&
            e.operations.some((o) => o.name === op.name),
        );
        if (entry) {
          lenses.push(
            new vscode.CodeLens(range, {
              title: "▶ Run (persisted)",
              command: COMMANDS.RUN_PERSISTED,
              arguments: [entry.documentId, op.name],
            }),
          );
        }
      }

      // × Clear
      lenses.push(
        new vscode.CodeLens(range, {
          title: "× Clear",
          command: COMMANDS.CLEAR_RESULTS,
          arguments: [],
        }),
      );
    });

    // add schema visualization code lenses for type definitions
    const text = document.getText();
    const typeRegex = /type\s+(\w+)/g;
    let match;

    while ((match = typeRegex.exec(text)) !== null) {
      const typeName = match[1];
      const position = document.positionAt(match.index);
      const range = new vscode.Range(position, position);
      lenses.push(
        new vscode.CodeLens(range, {
          title: "🔍 View in Explorer",
          command: COMMANDS.OPEN_SCHEMA_VISUALIZER,
          arguments: [typeName],
        }),
      );
    }
    return lenses;
  }
}
