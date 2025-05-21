import * as assert from 'assert';
import * as vscode from 'vscode';
import { handleError, StepZenError, CliError, ValidationError, NetworkError } from '../../../errors';
import { logger } from '../../../services/logger';

// Mock the logger and vscode window
let originalErrorFn: typeof logger.error;
let originalShowOutputFn: typeof logger.showOutput;
let originalShowErrorMessage: typeof vscode.window.showErrorMessage;
let showErrorMessageCalls: Array<[string, any]> = [];
let loggerErrorCalls: Array<[string, unknown]> = [];
let loggerShowOutputCalled = false;

suite('Error Handler Tests', () => {
  setup(() => {
    // Save original functions
    originalErrorFn = logger.error;
    originalShowOutputFn = logger.showOutput;
    originalShowErrorMessage = vscode.window.showErrorMessage;
    
    // Reset tracking variables
    showErrorMessageCalls = [];
    loggerErrorCalls = [];
    loggerShowOutputCalled = false;
    
    // Mock logger.error
    logger.error = function(message: string, error?: unknown): void {
      loggerErrorCalls.push([message, error]);
    };
    
    // Mock logger.showOutput
    logger.showOutput = function(): void {
      loggerShowOutputCalled = true;
    };
    
    // Mock vscode.window.showErrorMessage
    vscode.window.showErrorMessage = function(message: string, options?: any, ...items: any[]): Thenable<any> {
      showErrorMessageCalls.push([message, options]);
      // If there are items and the first is "Show Logs", simulate clicking it
      if (items && items.length > 0 && items[0] === 'Show Logs') {
        return Promise.resolve('Show Logs');
      }
      return Promise.resolve(undefined);
    };
  });

  teardown(() => {
    // Restore original functions
    logger.error = originalErrorFn;
    logger.showOutput = originalShowOutputFn;
    vscode.window.showErrorMessage = originalShowErrorMessage;
  });

  test('normalizes standard Error to StepZenError', () => {
    // Arrange
    const error = new Error('Standard error message');
    
    // Act
    const result = handleError(error);
    
    // Assert
    assert.strictEqual(result instanceof StepZenError, true);
    assert.strictEqual(result.message, 'Standard error message');
    assert.strictEqual(result.code, 'UNKNOWN_ERROR');
    assert.strictEqual(result.cause, error);
  });

  test('preserves StepZenError subclasses', () => {
    // Arrange
    const cliError = new CliError('CLI error message', 'TEST_CLI_ERROR');
    
    // Act
    const result = handleError(cliError);
    
    // Assert
    assert.strictEqual(result, cliError, 'Should return the original error object');
    assert.strictEqual(result.code, 'TEST_CLI_ERROR');
  });

  test('correctly identifies network errors', () => {
    // Arrange
    const networkError = new Error('ECONNREFUSED: Connection refused');
    
    // Act
    const result = handleError(networkError);
    
    // Assert
    assert.strictEqual(result instanceof NetworkError, true);
    assert.strictEqual(result.code, 'NETWORK_REQUEST_FAILED');
  });

  test('correctly identifies validation errors', () => {
    // Arrange
    const validationError = new Error('Invalid schema: syntax error');
    
    // Act
    const result = handleError(validationError);
    
    // Assert
    assert.strictEqual(result instanceof ValidationError, true);
    assert.strictEqual(result.code, 'VALIDATION_FAILED');
  });

  test('correctly identifies CLI errors', () => {
    // Arrange
    const cliError = new Error('Command exited with code 1');
    
    // Act
    const result = handleError(cliError);
    
    // Assert
    assert.strictEqual(result instanceof CliError, true);
    assert.strictEqual(result.code, 'CLI_OPERATION_FAILED');
  });

  test('logs error with stack trace', () => {
    // Arrange
    const error = new Error('Test error message');
    
    // Act
    handleError(error);
    
    // Assert
    assert.strictEqual(loggerErrorCalls.length > 0, true);
  });

  test('shows notification with correct message', () => {
    // Arrange
    const error = new CliError('Test CLI error', 'TEST_ERROR');
    
    // Act
    handleError(error);
    
    // Assert
    assert.strictEqual(showErrorMessageCalls.length > 0, true);
    // First call, first argument is the message
    assert.strictEqual(showErrorMessageCalls[0][0], 'StepZen CLI Error: Test CLI error');
  });

  test('opens logs when Show Logs action is clicked', async () => {
    // Arrange
    const error = new Error('Test error message');
    
    // Act
    handleError(error);
    
    // Need to use a timeout to allow the promise chain to complete
    await new Promise(resolve => setTimeout(resolve, 10));
    
    // Assert - logger.showOutput should be called due to our mock
    assert.strictEqual(loggerShowOutputCalled, true);
  });
});