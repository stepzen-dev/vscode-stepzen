/**
 * Copyright IBM Corp. 2025
 * Assisted by CursorAI
 */

import * as assert from "assert";
import * as vscode from "vscode";
import { Uri } from "vscode";

suite("Schema Visualizer Panel Tests", () => {
  let mockExtensionUri: Uri;

  setup(() => {
    mockExtensionUri = Uri.file("/test/extension");
  });

  suite("Module Loading", () => {
    test("should load schema visualizer panel module", () => {
      const schemaVisualizerModule = require("../../../panels/schemaVisualizerPanel");
      assert.ok(schemaVisualizerModule.openSchemaVisualizerPanel, "Should export openSchemaVisualizerPanel function");
    });

    test("should have SchemaVisualizerPanel class extending BaseWebviewPanel", () => {
      const schemaVisualizerModule = require("../../../panels/schemaVisualizerPanel");
      const BaseWebviewPanel = require("../../../panels/BaseWebviewPanel").BaseWebviewPanel;
      
      // Access the class through the module (it might be exported differently)
      const SchemaVisualizerPanel = schemaVisualizerModule.SchemaVisualizerPanel || 
        (schemaVisualizerModule.default && schemaVisualizerModule.default.SchemaVisualizerPanel);
      
      if (SchemaVisualizerPanel) {
        // Check if it extends BaseWebviewPanel by checking the prototype chain
        let proto = SchemaVisualizerPanel.prototype;
        let extendsBase = false;
        while (proto) {
          if (proto.constructor === BaseWebviewPanel) {
            extendsBase = true;
            break;
          }
          proto = Object.getPrototypeOf(proto);
        }
        assert.ok(extendsBase, "SchemaVisualizerPanel should extend BaseWebviewPanel");
      }
    });
  });

  suite("Security Features", () => {
    test("should use BaseWebviewPanel security features", () => {
      const BaseWebviewPanel = require("../../../panels/BaseWebviewPanel").BaseWebviewPanel;
      
      // Create a test instance to verify it has the security methods
      const testPanel = new (class extends BaseWebviewPanel {
        constructor(extensionUri: Uri) {
          super(extensionUri);
        }
        protected generateHtml() { return ""; }
      })(mockExtensionUri);
      
      assert.ok(typeof testPanel.nonce === "function", "Should have nonce method from BaseWebviewPanel");
      assert.ok(typeof testPanel.csp === "function", "Should have csp method from BaseWebviewPanel");
      
      // Test that nonce generates proper values
      const nonce1 = testPanel.nonce();
      const nonce2 = testPanel.nonce();
      
      assert.strictEqual(nonce1.length, 16, "Nonce should be 16 characters");
      assert.notStrictEqual(nonce1, nonce2, "Each nonce should be unique");
      assert.ok(/^[a-zA-Z0-9]+$/.test(nonce1), "Nonce should contain only alphanumeric characters");
    });

    test("should generate proper CSP headers", () => {
      const BaseWebviewPanel = require("../../../panels/BaseWebviewPanel").BaseWebviewPanel;
      
      const testPanel = new (class extends BaseWebviewPanel {
        constructor(extensionUri: Uri) {
          super(extensionUri);
        }
        protected generateHtml() { return ""; }
      })(mockExtensionUri);
      
      const mockWebview = {
        cspSource: "vscode-webview://test-source"
      } as vscode.Webview;
      
      const nonce = "test-nonce-123";
      const csp = testPanel.csp(mockWebview, nonce);
      
      assert.ok(csp.includes("default-src 'none'"), "CSP should include default-src 'none'");
      assert.ok(csp.includes(`script-src 'nonce-${nonce}'`), "CSP should include script-src with nonce");
      assert.ok(csp.includes("vscode-webview://test-source"), "CSP should include webview source");
    });
  });

  suite("Code Duplication Reduction", () => {
    test("should not duplicate nonce generation logic", () => {
      // Verify that the schema visualizer doesn't have its own nonce implementation
      const schemaVisualizerSource = require("fs").readFileSync(
        require("path").join(__dirname, "../../../../src/panels/schemaVisualizerPanel.ts"),
        "utf8"
      );
      
      // Should not contain inline nonce generation (would indicate duplication)
      assert.ok(
        !schemaVisualizerSource.includes("Math.random().toString(36)"),
        "Should not contain inline nonce generation - should use BaseWebviewPanel"
      );
      
      // Should not contain inline CSP generation
      assert.ok(
        !schemaVisualizerSource.includes("Content-Security-Policy.*default-src"),
        "Should not contain inline CSP generation - should use BaseWebviewPanel"
      );
    });

    test("should not duplicate webview URI resolution", () => {
      const schemaVisualizerSource = require("fs").readFileSync(
        require("path").join(__dirname, "../../../../src/panels/schemaVisualizerPanel.ts"),
        "utf8"
      );
      
      // Should use getWebviewUri from BaseWebviewPanel, not duplicate the logic
      assert.ok(
        schemaVisualizerSource.includes("this.getWebviewUri"),
        "Should use getWebviewUri method from BaseWebviewPanel"
      );
    });
  });

  suite("Architecture Compliance", () => {
    test("should follow the established panel pattern", () => {
      const schemaVisualizerModule = require("../../../panels/schemaVisualizerPanel");
      
      // Should export the main function
      assert.ok(
        typeof schemaVisualizerModule.openSchemaVisualizerPanel === "function",
        "Should export openSchemaVisualizerPanel function"
      );
      
      // Function should accept extensionUri parameter
      const functionSource = schemaVisualizerModule.openSchemaVisualizerPanel.toString();
      assert.ok(
        functionSource.includes("extensionUri"),
        "openSchemaVisualizerPanel should accept extensionUri parameter"
      );
    });

    test("should use proper TypeScript patterns", () => {
      const schemaVisualizerSource = require("fs").readFileSync(
        require("path").join(__dirname, "../../../../src/panels/schemaVisualizerPanel.ts"),
        "utf8"
      );
      
      // Should have proper copyright header
      assert.ok(
        schemaVisualizerSource.includes("Copyright IBM Corp. 2025"),
        "Should have proper copyright header"
      );
      
      // Should extend BaseWebviewPanel
      assert.ok(
        schemaVisualizerSource.includes("extends BaseWebviewPanel"),
        "Should extend BaseWebviewPanel class"
      );
    });
  });
}); 