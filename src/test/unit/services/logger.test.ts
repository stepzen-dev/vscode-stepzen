import * as assert from 'assert';
import * as vscode from 'vscode';
import { Logger, LogLevel, logger } from '../../../services/logger';
import { createMock } from '../../helpers/test-utils';

// Create a test output channel that captures messages
function createMockOutputChannel(): vscode.OutputChannel & { __messages: string[] } {
  const messages: string[] = [];
  // Create a base mock output channel
  const mockOutputChannel = createMock<vscode.OutputChannel>({
    appendLine: (value: string) => { messages.push(value); },
    dispose: () => {}
  });
  
  // Add a property to access messages
  (mockOutputChannel as any).__messages = messages;
  
  return mockOutputChannel as vscode.OutputChannel & { __messages: string[] };
}

suite('Logger Service Test Suite', () => {
  // Store originals to restore after tests
  const originalCreateOutputChannel = vscode.window.createOutputChannel;
  const originalWorkspaceConfig = vscode.workspace.getConfiguration;
  
  // Mock output channel for verification
  let mockOutputChannel: vscode.OutputChannel & { __messages: string[] };
  
  setup(() => {
    // Create mock output channel
    mockOutputChannel = createMockOutputChannel();
    
    // Replace VSCode APIs with our mocks - needs correct overloads
    (vscode.window.createOutputChannel as any) = function(
      name: string, 
      languageIdOrOptions?: string | { log: boolean }
    ) {
      return mockOutputChannel;
    };
    
    // Mock configuration
    vscode.workspace.getConfiguration = () => {
      return createMock<vscode.WorkspaceConfiguration>({
        get: (section: string, defaultValue?: any) => {
          // Default values for testing
          if (section === 'logLevel') {
            return 'info';
          } else if (section === 'logToFile') {
            return false;
          }
          return defaultValue;
        }
      });
    };
    
    // Create fresh instance for each test
    (Logger as any).instance = undefined;
  });
  
  teardown(() => {
    // Restore original functions
    vscode.window.createOutputChannel = originalCreateOutputChannel;
    vscode.workspace.getConfiguration = originalWorkspaceConfig;
    
    // Clean up Logger instance
    if ((Logger as any).instance) {
      (Logger as any).instance.dispose();
      (Logger as any).instance = undefined;
    }
  });

  test('getInstance should return a singleton instance', () => {
    const instance1 = Logger.getInstance();
    const instance2 = Logger.getInstance();
    
    assert.strictEqual(instance1, instance2, 'Logger.getInstance() should return the same instance');
  });

  test('should log messages at different levels', () => {
    const testLogger = Logger.getInstance();
    // Clear messages before we start our actual test
    mockOutputChannel.__messages.length = 0;
    
    testLogger.setLogLevel(LogLevel.INFO);
    // The setLogLevel will log 1 INFO message: "Log level set to info"
    
    // Log messages at different levels
    testLogger.error('Error message');
    testLogger.warn('Warning message');
    testLogger.info('Info message');
    testLogger.debug('Debug message (should not appear)');
    
    // Verify logs at level INFO and above were captured (including log level message)
    assert.strictEqual(mockOutputChannel.__messages.length, 4, 'Should have 4 messages (including log level message)');
    
    // Skip the initial log level message and check our actual test messages
    assert.ok(mockOutputChannel.__messages[1].includes('ERROR'), 'ERROR message should be present');
    assert.ok(mockOutputChannel.__messages[2].includes('WARN'), 'WARN message should be present');
    assert.ok(mockOutputChannel.__messages[3].includes('INFO'), 'INFO message should be present');
    
    // Verify debug message was filtered out
    const hasDebugMessage = mockOutputChannel.__messages.some(msg => msg.includes('[DEBUG]'));
    assert.strictEqual(hasDebugMessage, false, 'DEBUG message should be filtered out');
  });

  test('log level should control which messages are displayed', () => {
    const testLogger = Logger.getInstance();
    
    // Start with ERROR level
    testLogger.setLogLevel(LogLevel.ERROR);
    // The setLogLevel will log 1 INFO message: "Log level set to error"
    mockOutputChannel.__messages.length = 0; // Clear messages
    
    // These should be filtered
    testLogger.debug('Debug message');
    testLogger.info('Info message');
    testLogger.warn('Warning message');
    
    // This should be logged
    testLogger.error('Error message');
    
    assert.strictEqual(mockOutputChannel.__messages.length, 1, 'Only ERROR message should be logged');
    assert.ok(mockOutputChannel.__messages[0].includes('ERROR'), 'Message should be ERROR level');
    
    // Change to DEBUG level
    testLogger.setLogLevel(LogLevel.DEBUG);
    // The setLogLevel will log 1 INFO message: "Log level set to debug"
    mockOutputChannel.__messages.length = 0; // Clear messages
    
    // All these should be logged now
    testLogger.debug('Debug message');
    testLogger.info('Info message');
    testLogger.warn('Warning message');
    testLogger.error('Error message');
    
    assert.strictEqual(mockOutputChannel.__messages.length, 4, 'All messages should be logged');
  });

  test('error logging should include error details', () => {
    const testLogger = Logger.getInstance();
    mockOutputChannel.__messages.length = 0; // Clear messages
    
    const testError = new Error('Test error details');
    
    testLogger.error('An error occurred', testError);
    
    // Should be two messages: the error message and the details line with the error info
    assert.strictEqual(mockOutputChannel.__messages.length, 2, 'Error with details should log two messages');
    assert.ok(mockOutputChannel.__messages[0].includes('An error occurred'), 'First line should contain the message');
    assert.ok(mockOutputChannel.__messages[1].includes('└─'), 'Second line should contain error details marker');
    assert.ok(mockOutputChannel.__messages[1].includes('Test error details'), 'Second line should contain error details');
  });

  test('logger produces correctly formatted messages', () => {
    const testLogger = Logger.getInstance();
    mockOutputChannel.__messages.length = 0; // Clear messages
    
    testLogger.info('Test message');
    
    // Check message format: [timestamp] [LEVEL] message
    // ISO format can have timezone part like Z or +00:00
    const messageRegex = /\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.*\] \[INFO\] Test message/;
    assert.ok(messageRegex.test(mockOutputChannel.__messages[0]), 'Message should have proper format with timestamp and level');
  });

  test('getOutputChannel should return the output channel', () => {
    const testLogger = Logger.getInstance();
    const outputChannel = testLogger.getOutputChannel();
    
    assert.strictEqual(outputChannel, mockOutputChannel, 'getOutputChannel should return the mock output channel');
  });
});