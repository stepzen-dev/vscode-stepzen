/**
 * Copyright IBM Corp. 2025
 * Assisted by CursorAI
 */

import * as assert from "assert";
import * as vscode from "vscode";
import { Uri } from "vscode";
import { openResultsPanel, clearResultsPanel } from "../../../panels/resultsPanel";
import { StepZenResponse } from "../../../types";

suite("Results Panel Tests", () => {
  let originalCreateWebviewPanel: typeof vscode.window.createWebviewPanel;
  let createdPanels: vscode.WebviewPanel[] = [];

  setup(() => {
    // Mock the EXTENSION_URI
    const extensionModule = require("../../../extension");
    extensionModule.EXTENSION_URI = Uri.file("/test/extension");
    
    // Mock vscode.window.createWebviewPanel
    originalCreateWebviewPanel = vscode.window.createWebviewPanel;
    vscode.window.createWebviewPanel = (viewType, title, _showOptions, _options) => {
      const mockPanel = {
        webview: {
          html: "",
          cspSource: "vscode-webview://test-source",
          asWebviewUri: (uri: Uri) => Uri.parse(`vscode-webview://test/${uri.path}`),
          // Assisted by CursorAI ; inserted onDidReceiveMessage
          onDidReceiveMessage: (callback: (message: any) => void) => { 
            // Store the callback for potential use in tests
            (mockPanel.webview as any)._messageCallback = callback;
            return { dispose: () => {} };
          }
        },
        onDidDispose: (_callback: () => void) => ({ dispose: () => {} }),
        dispose: () => {},
        reveal: () => {},
        viewType,
        title
      } as vscode.WebviewPanel;
      
      createdPanels.push(mockPanel);
      return mockPanel;
    };
  });

  teardown(() => {
    // Clean up
    clearResultsPanel();
    createdPanels = [];
    vscode.window.createWebviewPanel = originalCreateWebviewPanel;
  });

  suite("Panel Creation", () => {
    test("should create panel with correct view type and title", async () => {
      const mockPayload: StepZenResponse = {
        data: { test: "data" }
      };

      await openResultsPanel(mockPayload);

      assert.strictEqual(createdPanels.length, 1, "Should create exactly one panel");
      assert.strictEqual(createdPanels[0].viewType, "stepzen.results", "Should use correct view type");
      assert.strictEqual(createdPanels[0].title, "StepZen Request Results", "Should use correct title");
    });

    test("should reuse existing panel", async () => {
      const mockPayload1: StepZenResponse = { data: { test: "data1" } };
      const mockPayload2: StepZenResponse = { data: { test: "data2" } };

      await openResultsPanel(mockPayload1);
      await openResultsPanel(mockPayload2);

      assert.strictEqual(createdPanels.length, 1, "Should reuse existing panel");
    });
  });

  suite("HTML Generation", () => {
    test("should generate HTML with CSP header", async () => {
      const mockPayload: StepZenResponse = {
        data: { test: "data" }
      };

      await openResultsPanel(mockPayload);

      const html = createdPanels[0].webview.html;
      assert.ok(html.includes("Content-Security-Policy"), "HTML should include CSP header");
      assert.ok(html.includes("default-src 'none'"), "CSP should include default-src 'none'");
    });

    test("should include nonce in script tags", async () => {
      const mockPayload: StepZenResponse = {
        data: { test: "data" }
      };

      await openResultsPanel(mockPayload);

      const html = createdPanels[0].webview.html;
      
      // Extract nonce from CSP header
      const cspMatch = html.match(/script-src 'nonce-([^']+)'/);
      assert.ok(cspMatch, "Should find nonce in CSP header");
      
      const nonce = cspMatch[1];
      const scriptMatches = html.match(new RegExp(`nonce="${nonce}"`, 'g'));
      assert.ok(scriptMatches && scriptMatches.length > 0, "Script tags should include the nonce");
    });

    test("should include payload data", async () => {
      const mockPayload: StepZenResponse = {
        data: { user: { name: "John", id: 123 } }
      };

      await openResultsPanel(mockPayload);

      const html = createdPanels[0].webview.html;
      const payloadString = JSON.stringify(mockPayload);
      assert.ok(html.includes(payloadString), "HTML should include the payload data");
    });

    test("should show errors tab when errors exist", async () => {
      const mockPayload: StepZenResponse = {
        data: { test: "data" },
        errors: [{ message: "Test error" }]
      };

      await openResultsPanel(mockPayload);

      const html = createdPanels[0].webview.html;
      assert.ok(html.includes('data-id="errors"'), "Should include errors tab");
      assert.ok(html.includes('id="pane-errors"'), "Should include errors pane");
    });

    test("should not show errors tab when no errors", async () => {
      const mockPayload: StepZenResponse = {
        data: { test: "data" }
      };

      await openResultsPanel(mockPayload);

      const html = createdPanels[0].webview.html;
      assert.ok(!html.includes('data-id="errors"'), "Should not include errors tab");
      assert.ok(!html.includes('id="pane-errors"'), "Should not include errors pane");
    });

    test("should include all required tabs", async () => {
      const mockPayload: StepZenResponse = {
        data: { test: "data" }
      };

      await openResultsPanel(mockPayload);

      const html = createdPanels[0].webview.html;
      assert.ok(html.includes('data-id="data"'), "Should include data tab");
      assert.ok(html.includes('data-id="debug"'), "Should include debug tab");
      assert.ok(html.includes('data-id="trace"'), "Should include trace tab");
    });

    test("should include required script libraries", async () => {
      const mockPayload: StepZenResponse = {
        data: { test: "data" }
      };

      await openResultsPanel(mockPayload);

      const html = createdPanels[0].webview.html;
      assert.ok(html.includes("react.production.min.js"), "Should include React library");
      assert.ok(html.includes("react-dom.production.min.js"), "Should include ReactDOM library");
      assert.ok(html.includes("react-json-view.min.js"), "Should include React JSON View library");
      assert.ok(html.includes("results-panel.js"), "Should include results panel script");
    });

    test("should include CSS file", async () => {
      const mockPayload: StepZenResponse = {
        data: { test: "data" }
      };

      await openResultsPanel(mockPayload);

      const html = createdPanels[0].webview.html;
      assert.ok(html.includes("results-panel.css"), "Should include CSS file");
    });
  });

  suite("Panel Management", () => {
    test("should clear panel correctly", async () => {
      const mockPayload: StepZenResponse = {
        data: { test: "data" }
      };

      await openResultsPanel(mockPayload);
      assert.strictEqual(createdPanels.length, 1, "Panel should be created");

      clearResultsPanel();
      
      // After clearing, opening again should create a new panel
      await openResultsPanel(mockPayload);
      assert.strictEqual(createdPanels.length, 2, "New panel should be created after clearing");
    });
  });

  suite("Payload Handling", () => {
    test("should handle payload with extensions", async () => {
      const mockPayload: StepZenResponse = {
        data: { test: "data" },
        extensions: {
          stepzen: {
            diagnostics: [{ message: "Debug info", severity: "info" }]
          }
        }
      };

      await openResultsPanel(mockPayload);

      const html = createdPanels[0].webview.html;
      assert.ok(html.includes(JSON.stringify(mockPayload)), "Should include full payload with extensions");
    });

    test("should handle empty payload", async () => {
      const mockPayload: StepZenResponse = {};

      await openResultsPanel(mockPayload);

      const html = createdPanels[0].webview.html;
      assert.ok(html.includes("<!DOCTYPE html>"), "Should generate valid HTML even for empty payload");
    });

    test("should handle payload with null data", async () => {
      const mockPayload: StepZenResponse = {
        data: undefined
      };

      await openResultsPanel(mockPayload);

      const html = createdPanels[0].webview.html;
      assert.ok(html.includes(JSON.stringify(mockPayload)), "Should handle null data correctly");
    });

    test("should handle complex nested data", async () => {
      const mockPayload: StepZenResponse = {
        data: {
          users: [
            { id: 1, name: "John", posts: [{ title: "Post 1" }] },
            { id: 2, name: "Jane", posts: [{ title: "Post 2" }, { title: "Post 3" }] }
          ]
        }
      };

      await openResultsPanel(mockPayload);

      const html = createdPanels[0].webview.html;
      assert.ok(html.includes(JSON.stringify(mockPayload)), "Should handle complex nested data");
    });
  });
}); 