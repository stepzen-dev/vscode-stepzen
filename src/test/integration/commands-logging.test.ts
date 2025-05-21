import * as assert from 'assert';
import * as vscode from 'vscode';
import { LogLevel, logger } from '../../services/logger';

// This test suite verifies that extension commands properly use the logger
suite('Commands Logging Integration Test Suite', () => {
  // Simple test that verifies the logger can be used with commands
  // This is a basic integration test that doesn't rely on mocking
  
  test('Logger is properly initialized and exported', async function() {
    // Check that the logger exists and has the expected methods
    assert.ok(logger, 'logger should be exported');
    assert.strictEqual(typeof logger.error, 'function', 'error should be a function');
    assert.strictEqual(typeof logger.warn, 'function', 'warn should be a function');
    assert.strictEqual(typeof logger.info, 'function', 'info should be a function');
    assert.strictEqual(typeof logger.debug, 'function', 'debug should be a function');
  });

  test('Logger methods can be called without errors', async function() {
    // Test that the logger methods don't throw when called
    assert.doesNotThrow(() => {
      logger.info('Test info logging for commands');
      logger.debug('Test debug logging for commands');
      logger.warn('Test warning logging for commands');
      logger.error('Test error logging for commands');
    });
  });

  test('Logger can be used with error objects', async function() {
    // Test that the logger can handle errors
    const testError = new Error('Test error details');
    
    assert.doesNotThrow(() => {
      logger.error('Test error with details for commands', testError);
    });
    
    // We can't easily verify the output in an integration test,
    // but we can at least verify it doesn't throw
  });
  
  test('OutputChannel can be accessed', async function() {
    // Verify we can get the output channel
    const outputChannel = logger.getOutputChannel();
    assert.ok(outputChannel, 'Output channel should be accessible');
  });
});