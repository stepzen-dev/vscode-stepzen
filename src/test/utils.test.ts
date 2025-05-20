import * as assert from "assert";
import * as vscode from "vscode";
import { formatError, createError } from "../utils/errors";

suite("Utility Function Test Suite", () => {
  vscode.window.showInformationMessage("Start utility function tests.");

  test("formatError should handle Error objects", () => {
    const testError = new Error("Test error message");
    const formattedError = formatError(testError);
    assert.strictEqual(
      formattedError.includes("Test error message"),
      true,
      "Formatted error should include the original message"
    );
  });

  test("formatError should handle string errors", () => {
    const testErrorString = "String error message";
    const formattedError = formatError(testErrorString);
    assert.strictEqual(
      formattedError.includes("String error message"),
      true,
      "Formatted error should include the string error"
    );
  });

  test("createError should produce an error with correct properties", () => {
    const message = "Test error";
    const operation = "Test context";
    const cause = new Error("Original error");
    const category = "unknown";

    const error = createError(message, operation, cause, category);
    
    assert.strictEqual(error.message, message, "Error should have the correct message");
    assert.strictEqual(error.name, "StepZenError", "Error should have the correct name");
    assert.strictEqual((error as any).operation, operation, "Error should have the correct operation");
    assert.strictEqual((error as any).cause, cause, "Error should have the correct cause");
    assert.strictEqual((error as any).category, category, "Error should have the correct category");
  });
});