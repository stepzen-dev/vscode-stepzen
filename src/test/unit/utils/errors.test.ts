import * as assert from "assert";
import { formatError, createError, StepZenError } from "../../../utils/errors";

suite("Error Utilities Test Suite", () => {
  suite("StepZenError Class", () => {
    test("should create an error with all properties when all parameters are provided", () => {
      const message = "Test error message";
      const operation = "TestOperation";
      const cause = new Error("Original error");
      const category = "network";

      const error = new StepZenError(message, operation, { cause, category });
      
      assert.strictEqual(error.message, message);
      assert.strictEqual(error.name, "StepZenError");
      assert.strictEqual(error.operation, operation);
      assert.strictEqual(error.cause, cause);
      assert.strictEqual(error.category, category);
      assert.ok(error.stack, "Stack trace should be captured");
    });

    test("should use 'unknown' as default category when not provided", () => {
      const error = new StepZenError("Test message", "TestOperation");
      
      assert.strictEqual(error.category, "unknown");
    });

    test("should handle cause without specifying category", () => {
      const cause = new Error("Original error");
      const error = new StepZenError("Test message", "TestOperation", { cause });
      
      assert.strictEqual(error.cause, cause);
      assert.strictEqual(error.category, "unknown");
    });
  });

  suite("formatError Function", () => {
    test("should format a StepZenError without cause", () => {
      const error = new StepZenError("Test message", "TestOperation");
      const formatted = formatError(error);
      
      assert.strictEqual(formatted, "TestOperation: Test message");
    });

    test("should format a StepZenError with Error cause and includeDetails=true", () => {
      const cause = new Error("Cause error");
      // Simulate a stack trace
      Object.defineProperty(cause, "stack", {
        value: "Error: Cause error\n    at Object.<anonymous> (/path/to/file.js:1:1)",
        writable: true,
        configurable: true
      });
      
      const error = new StepZenError("Test message", "TestOperation", { cause });
      const formatted = formatError(error, true);
      
      assert.ok(formatted.includes("TestOperation: Test message"));
      assert.ok(formatted.includes("Caused by: Cause error"));
      assert.ok(formatted.includes("at Object.<anonymous>"));
    });

    test("should format a StepZenError with Error cause that has no stack", () => {
      const cause = new Error("Cause error");
      // Ensure there's no stack
      Object.defineProperty(cause, "stack", { value: undefined });
      
      const error = new StepZenError("Test message", "TestOperation", { cause });
      const formatted = formatError(error, true);
      
      assert.strictEqual(formatted, "TestOperation: Test message\nCaused by: Cause error");
    });

    test("should format a StepZenError with non-Error cause and includeDetails=true", () => {
      const cause = "String cause";
      const error = new StepZenError("Test message", "TestOperation", { cause });
      const formatted = formatError(error, true);
      
      assert.strictEqual(formatted, "TestOperation: Test message\nCaused by: String cause");
    });

    test("should format a standard Error with stack when includeDetails=true", () => {
      const error = new Error("Standard error");
      // Simulate a stack trace
      Object.defineProperty(error, "stack", {
        value: "Error: Standard error\n    at Object.<anonymous> (/path/to/file.js:1:1)",
        writable: true,
        configurable: true
      });
      
      const formatted = formatError(error, true);
      
      assert.ok(formatted.includes("Standard error"));
      assert.ok(formatted.includes("at Object.<anonymous>"));
    });

    test("should format a standard Error without stack when includeDetails=true", () => {
      const error = new Error("Standard error");
      // Ensure there's no stack
      Object.defineProperty(error, "stack", { value: undefined });
      
      const formatted = formatError(error, true);
      
      assert.strictEqual(formatted, "Standard error");
    });

    test("should format a standard Error with stack when includeDetails=false", () => {
      const error = new Error("Standard error");
      // Simulate a stack trace
      Object.defineProperty(error, "stack", {
        value: "Error: Standard error\n    at Object.<anonymous> (/path/to/file.js:1:1)",
        writable: true,
        configurable: true
      });
      
      const formatted = formatError(error, false);
      
      assert.strictEqual(formatted, "Standard error");
      assert.ok(!formatted.includes("at Object.<anonymous>"));
    });

    test("should format network error with address and port", () => {
      const networkError = {
        code: "ECONNREFUSED",
        syscall: "connect",
        address: "127.0.0.1",
        port: 8080
      };
      
      const formatted = formatError(networkError);
      
      assert.strictEqual(formatted, "Network error: ECONNREFUSED during connect to 127.0.0.1:8080");
    });

    test("should format network error with address but without port", () => {
      const networkError = {
        code: "ECONNREFUSED",
        syscall: "connect",
        address: "127.0.0.1"
      };
      
      const formatted = formatError(networkError);
      
      assert.strictEqual(formatted, "Network error: ECONNREFUSED during connect to 127.0.0.1");
    });

    test("should format network error without address or port", () => {
      const networkError = {
        code: "ECONNREFUSED",
        syscall: "connect"
      };
      
      const formatted = formatError(networkError);
      
      assert.strictEqual(formatted, "Network error: ECONNREFUSED during connect");
    });

    test("should format an object with a message property", () => {
      const errorObject = { message: "Message property error" };
      const formatted = formatError(errorObject);
      
      assert.strictEqual(formatted, "Message property error");
    });

    test("should format a string error", () => {
      const error = "String error message";
      const formatted = formatError(error);
      
      assert.strictEqual(formatted, "String error message");
    });

    test("should format null", () => {
      const formatted = formatError(null);
      assert.strictEqual(formatted, "null");
    });

    test("should format undefined", () => {
      const formatted = formatError(undefined);
      assert.strictEqual(formatted, "undefined");
    });

    test("should format a number", () => {
      const formatted = formatError(42);
      assert.strictEqual(formatted, "42");
    });
  });

  suite("createError Function", () => {
    test("should create an error with all parameters", () => {
      const message = "Error message";
      const operation = "TestOperation";
      const cause = new Error("Original error");
      const category = "config";
      
      const error = createError(message, operation, cause, category);
      
      assert.strictEqual(error.message, message);
      assert.strictEqual(error.name, "StepZenError");
      assert.strictEqual(error.operation, operation);
      assert.strictEqual(error.cause, cause);
      assert.strictEqual(error.category, category);
    });
    
    test("should create an error with minimal parameters", () => {
      const message = "Error message";
      const operation = "TestOperation";
      
      const error = createError(message, operation);
      
      assert.strictEqual(error.message, message);
      assert.strictEqual(error.operation, operation);
      assert.strictEqual(error.cause, undefined);
      assert.strictEqual(error.category, "unknown");
    });
  });
});