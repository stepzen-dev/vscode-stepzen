import * as vscode from "vscode";
import {
  getOperationMap,
  getPersistedDocMap,
  OperationEntry,
} from "./stepzenProjectScanner";

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
    token: vscode.CancellationToken,
  ): vscode.CodeLens[] {
    const lenses: vscode.CodeLens[] = [];
    const opMap = getOperationMap();
    const persistedMap = getPersistedDocMap();
    const uriKey = document.uri.toString();
    const ops = opMap[uriKey] || [];

    ops.forEach((op: OperationEntry) => {
      const start = document.positionAt(op.range.start);
      const range = new vscode.Range(start, start);

      // ▶ Run
      lenses.push(
        new vscode.CodeLens(range, {
          title: "▶ Run",
          command: "stepzen.runOperation",
          arguments: [op],
        }),
      );

      // ▶ Run (persisted)
      if (op.persisted) {
        // find the matching persisted document entry
        const entry = Object.values(persistedMap).find(
          (e) =>
            e.fileUri.toString() === uriKey &&
            e.operations.some((o) => o.name === op.name),
        );
        if (entry) {
          lenses.push(
            new vscode.CodeLens(range, {
              title: "▶ Run (persisted)",
              command: "stepzen.runPersisted",
              arguments: [entry.documentId, op.name],
            }),
          );
        }
      }

      // × Clear
      lenses.push(
        new vscode.CodeLens(range, {
          title: "× Clear",
          command: "stepzen.clearResults",
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
          command: "stepzen.openSchemaVisualizer",
          arguments: [typeName],
        }),
      );
    }
    return lenses;
  }
}
