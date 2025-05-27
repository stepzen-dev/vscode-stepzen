/**
 * Copyright IBM Corp. 2025
 * Assisted by CursorAI
 */

import * as assert from "assert";
import * as vscode from "vscode";
import { Uri } from "vscode";
import { BaseWebviewPanel } from "../../../panels/BaseWebviewPanel";

/**
 * Test implementation of BaseWebviewPanel for testing purposes
 */
class TestWebviewPanel extends BaseWebviewPanel {
  public testGenerateHtml(webview: vscode.Webview, data?: any): string {
    return this.generateHtml(webview, data);
  }

  public testNonce(): string {
    return this.nonce();
  }

  public testCsp(webview: vscode.Webview, nonce: string): string {
    return this.csp(webview, nonce);
  }

  public testGetWebviewUri(webview: vscode.Webview, pathList: string[]): vscode.Uri {
    return this.getWebviewUri(webview, pathList);
  }

  public testCreateWebviewPanel(
    viewType: string,
    title: string,
    viewColumn: vscode.ViewColumn,
    options?: Partial<vscode.WebviewOptions>
  ): vscode.WebviewPanel {
    return this.createWebviewPanel(viewType, title, viewColumn, options);
  }

  protected generateHtml(webview: vscode.Webview, _data?: any): string {
    const nonce = this.nonce();
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta http-equiv="Content-Security-Policy" content="${this.csp(webview, nonce)}">
        <title>Test Panel</title>
      </head>
      <body>
        <h1>Test Content</h1>
        <script nonce="${nonce}">
          console.log('Test script with nonce');
        </script>
      </body>
      </html>
    `;
  }
}

suite("BaseWebviewPanel Tests", () => {
  let testPanel: TestWebviewPanel;
  let mockExtensionUri: Uri;

  setup(() => {
    mockExtensionUri = Uri.file("/test/extension");
    testPanel = new TestWebviewPanel(mockExtensionUri);
  });

  teardown(() => {
    testPanel.dispose();
  });

  suite("Nonce Generation", () => {
    test("should generate unique nonces", () => {
      const nonce1 = testPanel.testNonce();
      const nonce2 = testPanel.testNonce();
      
      assert.notStrictEqual(nonce1, nonce2, "Nonces should be unique");
      assert.strictEqual(typeof nonce1, "string", "Nonce should be a string");
      assert.strictEqual(typeof nonce2, "string", "Nonce should be a string");
    });

    test("should generate nonces of correct length", () => {
      const nonce = testPanel.testNonce();
      
      // Nonce should be 16 characters long based on implementation
      assert.strictEqual(nonce.length, 16, "Nonce should be 16 characters long");
    });

    test("should generate nonces with valid characters", () => {
      const nonce = testPanel.testNonce();
      
      // Should only contain alphanumeric characters (base36)
      const validPattern = /^[a-z0-9]+$/;
      assert.ok(validPattern.test(nonce), "Nonce should only contain alphanumeric characters");
    });

    test("should generate multiple unique nonces", () => {
      const nonces = new Set<string>();
      const iterations = 100;
      
      for (let i = 0; i < iterations; i++) {
        nonces.add(testPanel.testNonce());
      }
      
      assert.strictEqual(nonces.size, iterations, "All generated nonces should be unique");
    });
  });

  suite("CSP Generation", () => {
    let mockWebview: vscode.Webview;

    setup(() => {
      mockWebview = {
        cspSource: "vscode-webview://test-source"
      } as vscode.Webview;
    });

    test("should generate valid CSP header", () => {
      const nonce = "test-nonce-123";
      const csp = testPanel.testCsp(mockWebview, nonce);
      
      assert.ok(csp.includes("default-src 'none'"), "CSP should include default-src 'none'");
      assert.ok(csp.includes(`img-src ${mockWebview.cspSource}`), "CSP should include img-src with webview source");
      assert.ok(csp.includes(`style-src ${mockWebview.cspSource}`), "CSP should include style-src with webview source");
      assert.ok(csp.includes(`script-src 'nonce-${nonce}' ${mockWebview.cspSource}`), "CSP should include script-src with nonce and webview source");
    });

    test("should include nonce in script-src", () => {
      const nonce = "unique-test-nonce";
      const csp = testPanel.testCsp(mockWebview, nonce);
      
      assert.ok(csp.includes(`'nonce-${nonce}'`), "CSP should include the provided nonce");
    });

    test("should handle different webview sources", () => {
      const customWebview = {
        cspSource: "vscode-webview://custom-source-123"
      } as vscode.Webview;
      
      const nonce = "test-nonce";
      const csp = testPanel.testCsp(customWebview, nonce);
      
      assert.ok(csp.includes(customWebview.cspSource), "CSP should include the custom webview source");
    });
  });

  suite("Webview URI Generation", () => {
    let mockWebview: vscode.Webview;

    setup(() => {
      mockWebview = {
        asWebviewUri: (uri: Uri) => {
          return Uri.parse(`vscode-webview://test/${uri.path}`);
        }
      } as vscode.Webview;
    });

    test("should generate correct webview URI", () => {
      const pathList = ["css", "styles.css"];
      const uri = testPanel.testGetWebviewUri(mockWebview, pathList);
      
      assert.ok(uri.toString().includes("webview/css/styles.css"), "URI should include the correct path");
    });

    test("should handle nested paths", () => {
      const pathList = ["js", "components", "panel.js"];
      const uri = testPanel.testGetWebviewUri(mockWebview, pathList);
      
      assert.ok(uri.toString().includes("webview/js/components/panel.js"), "URI should handle nested paths correctly");
    });

    test("should handle single path segment", () => {
      const pathList = ["index.html"];
      const uri = testPanel.testGetWebviewUri(mockWebview, pathList);
      
      assert.ok(uri.toString().includes("webview/index.html"), "URI should handle single path segment");
    });

    test("should handle empty path list", () => {
      const pathList: string[] = [];
      const uri = testPanel.testGetWebviewUri(mockWebview, pathList);
      
      assert.ok(uri.toString().includes("webview"), "URI should still include webview directory for empty path");
    });
  });

  suite("HTML Generation", () => {
    let mockWebview: vscode.Webview;

    setup(() => {
      mockWebview = {
        cspSource: "vscode-webview://test-source",
        asWebviewUri: (uri: Uri) => Uri.parse(`vscode-webview://test/${uri.path}`)
      } as vscode.Webview;
    });

    test("should generate valid HTML with CSP", () => {
      const html = testPanel.testGenerateHtml(mockWebview);
      
      assert.ok(html.includes("<!DOCTYPE html>"), "HTML should include DOCTYPE");
      assert.ok(html.includes("Content-Security-Policy"), "HTML should include CSP header");
      assert.ok(html.includes("Test Content"), "HTML should include test content");
    });

    test("should include nonce in script tags", () => {
      const html = testPanel.testGenerateHtml(mockWebview);
      
      // Extract nonce from CSP header
      const cspMatch = html.match(/script-src 'nonce-([^']+)'/);
      assert.ok(cspMatch, "Should find nonce in CSP header");
      
      const nonce = cspMatch![1];
      assert.ok(html.includes(`nonce="${nonce}"`), "Script tag should include the same nonce");
    });

    test("should generate different nonces for different calls", () => {
      const html1 = testPanel.testGenerateHtml(mockWebview);
      const html2 = testPanel.testGenerateHtml(mockWebview);
      
      const nonce1Match = html1.match(/nonce="([^"]+)"/);
      const nonce2Match = html2.match(/nonce="([^"]+)"/);
      
      assert.ok(nonce1Match && nonce2Match, "Both HTML should contain nonces");
      assert.notStrictEqual(nonce1Match[1], nonce2Match[1], "Nonces should be different for different calls");
    });
  });

  suite("Panel Lifecycle", () => {
    test("should dispose panel correctly", () => {
      // This test verifies the dispose method doesn't throw
      assert.doesNotThrow(() => {
        testPanel.dispose();
      }, "Dispose should not throw when no panel exists");
    });

    test("should reveal panel correctly", () => {
      // This test verifies the reveal method doesn't throw
      assert.doesNotThrow(() => {
        testPanel.reveal();
      }, "Reveal should not throw when no panel exists");
    });
  });

  suite("Panel Creation Options", () => {
    test("should create panel with default options", () => {
      // Mock the vscode.window.createWebviewPanel to verify it's called correctly
      const originalCreateWebviewPanel = vscode.window.createWebviewPanel;
      let capturedOptions: vscode.WebviewOptions | undefined;
      
      vscode.window.createWebviewPanel = (_viewType, _title, _showOptions, options) => {
        capturedOptions = options;
        return {
          onDidDispose: () => ({ dispose: () => {} }),
          dispose: () => {},
          reveal: () => {},
          webview: {} as vscode.Webview,
          viewType: "test",
          title: "Test",
          options: {},
          viewColumn: vscode.ViewColumn.One,
          active: true,
          visible: true,
          iconPath: undefined,
          onDidChangeViewState: () => ({ dispose: () => {} })
        } as vscode.WebviewPanel;
      };
      
      try {
        testPanel.testCreateWebviewPanel("test", "Test Panel", vscode.ViewColumn.One);
        
        assert.ok(capturedOptions, "Options should be provided");
        assert.strictEqual(capturedOptions!.enableScripts, true, "Scripts should be enabled by default");
        assert.ok(capturedOptions!.localResourceRoots, "Local resource roots should be set");
      } finally {
        vscode.window.createWebviewPanel = originalCreateWebviewPanel;
      }
    });

    test("should merge custom options with defaults", () => {
      const originalCreateWebviewPanel = vscode.window.createWebviewPanel;
      let capturedOptions: vscode.WebviewOptions | undefined;
      
      vscode.window.createWebviewPanel = (_viewType, _title, _showOptions, options) => {
        capturedOptions = options;
        return {
          onDidDispose: () => ({ dispose: () => {} }),
          dispose: () => {},
          reveal: () => {},
          webview: {} as vscode.Webview,
          viewType: "test",
          title: "Test",
          options: {},
          viewColumn: vscode.ViewColumn.One,
          active: true,
          visible: true,
          iconPath: undefined,
          onDidChangeViewState: () => ({ dispose: () => {} })
        } as vscode.WebviewPanel;
      };
      
      try {
        const customOptions = { enableCommandUris: true };
        testPanel.testCreateWebviewPanel("test", "Test Panel", vscode.ViewColumn.One, customOptions);
        
        assert.ok(capturedOptions, "Options should be provided");
        assert.strictEqual(capturedOptions!.enableScripts, true, "Default enableScripts should be preserved");
        assert.strictEqual(capturedOptions!.enableCommandUris, true, "Custom option should be included");
      } finally {
        vscode.window.createWebviewPanel = originalCreateWebviewPanel;
      }
    });
  });
}); 