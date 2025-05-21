import * as assert from 'assert';
import * as vscode from 'vscode';
import { logger as stepzenLogger, LogLevel } from '../../services/logger';

// This test suite focuses on integration aspects of the logger
suite('Logger Integration Test Suite', () => {
  test('Logger singleton can be imported and used', async function() {
    // This test simply verifies the logger can be imported and used
    stepzenLogger.info('Integration test - logger can be used');
    
    // Verify the output channel exists
    const outputChannel = stepzenLogger.getOutputChannel();
    assert.ok(outputChannel, 'Output channel should exist');
  });

  test('Logger exposes correct methods', async function() {
    // Test that the logger exposes the expected methods
    assert.strictEqual(typeof stepzenLogger.error, 'function', 'error should be a function');
    assert.strictEqual(typeof stepzenLogger.warn, 'function', 'warn should be a function');
    assert.strictEqual(typeof stepzenLogger.info, 'function', 'info should be a function');
    assert.strictEqual(typeof stepzenLogger.debug, 'function', 'debug should be a function');
    assert.strictEqual(typeof stepzenLogger.setLogLevel, 'function', 'setLogLevel should be a function');
    assert.strictEqual(typeof stepzenLogger.getOutputChannel, 'function', 'getOutputChannel should be a function');
  });
  
  test('Logger methods do not throw errors', async function() {
    // Test that the logger methods don't throw when called
    assert.doesNotThrow(() => {
      stepzenLogger.error('Integration test - error message');
      stepzenLogger.warn('Integration test - warning message');
      stepzenLogger.info('Integration test - info message');
      stepzenLogger.debug('Integration test - debug message');
      stepzenLogger.setLogLevel(LogLevel.DEBUG);
    });
  });
});