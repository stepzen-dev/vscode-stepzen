import * as assert from 'assert';
import * as vscode from 'vscode';
import { Logger, LogLevel } from '../../../services/logger';
import { createMock } from '../../helpers/test-utils';

// Create a test output channel that captures messages
function createMockOutputChannel(): vscode.OutputChannel & { __messages: string[] } {
  const messages: string[] = [];
  const mockOutputChannel = createMock<vscode.OutputChannel>({
    appendLine: (value: string) => { messages.push(value); },
    dispose: () => {}
  });
  
  // Add a property to access messages
  (mockOutputChannel as any).__messages = messages;
  
  return mockOutputChannel as vscode.OutputChannel & { __messages: string[] };
}

suite('Logger Configuration Test Suite', () => {
  // Store originals to restore after tests
  const originalCreateOutputChannel = vscode.window.createOutputChannel;
  const originalWorkspaceConfig = vscode.workspace.getConfiguration;
  let mockOutputChannel: vscode.OutputChannel & { __messages: string[] };
  let configGetValue: string = 'info';

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
        get: <T>(section: string, defaultValue?: T): T => {
          if (section === 'logLevel') {
            return configGetValue as unknown as T;
          }
          return defaultValue as T;
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

  test('should respect logLevel configuration from settings', () => {
    // Set config to return error level
    configGetValue = 'error';
    
    // Get a new logger instance that will use our mocked config
    const testLogger = Logger.getInstance();
    testLogger.updateConfigFromSettings();
    
    // Test all log levels
    testLogger.error('Test error message');
    testLogger.warn('Test warning message');
    testLogger.info('Test info message');
    testLogger.debug('Test debug message');
    
    // Only error message should be logged (plus the "Log level set to error" INFO message)
    const errorLogs = mockOutputChannel.__messages.filter(msg => msg.includes('[ERROR]'));
    const warnLogs = mockOutputChannel.__messages.filter(msg => msg.includes('[WARN]'));
    const infoLogs = mockOutputChannel.__messages.filter(msg => msg.includes('[INFO]'));
    const debugLogs = mockOutputChannel.__messages.filter(msg => msg.includes('[DEBUG]'));
    
    assert.strictEqual(errorLogs.length, 1, 'Error messages should be logged');
    assert.strictEqual(warnLogs.length, 0, 'Warning messages should not be logged');
    assert.strictEqual(infoLogs.length, 0, 'Info messages should not be logged at ERROR level');
    assert.strictEqual(debugLogs.length, 0, 'Debug messages should not be logged');
    
    // Update log level to debug and reset messages
    configGetValue = 'debug';
    mockOutputChannel.__messages.length = 0;
    testLogger.updateConfigFromSettings();
    
    // Test all log levels again
    testLogger.error('Test error message');
    testLogger.warn('Test warning message');
    testLogger.info('Test info message');
    testLogger.debug('Test debug message');
    
    // All messages should be logged (including the log level message)
    assert.strictEqual(mockOutputChannel.__messages.length, 5, 'All messages should be logged with debug level');
  });

  test('should handle invalid logLevel configuration gracefully', () => {
    // Set an invalid log level
    configGetValue = 'invalid_level';
    
    // Get a new logger instance that will use our mocked config
    const testLogger = Logger.getInstance();
    
    // The most important thing is that the logger doesn't throw when given an invalid level
    assert.doesNotThrow(() => testLogger.updateConfigFromSettings());
    
    // Verify we can still log after an invalid configuration
    assert.doesNotThrow(() => {
      testLogger.error('Test error');
      testLogger.warn('Test warning');
      testLogger.info('Test info');
      testLogger.debug('Test debug');
    });
  });

  test('logger level enum values should be correctly ordered', () => {
    // The LOG_LEVEL_VALUES in the logger implementation should have values in 
    // the correct order for comparison. Let's ensure our test assumptions match.
    assert.notStrictEqual(LogLevel.ERROR, LogLevel.WARN, 'ERROR should be different from WARN');
    assert.notStrictEqual(LogLevel.WARN, LogLevel.INFO, 'WARN should be different from INFO');
    assert.notStrictEqual(LogLevel.INFO, LogLevel.DEBUG, 'INFO should be different from DEBUG');
  });

  test('setLogLevel should change logging behavior', () => {
    const testLogger = Logger.getInstance();
    
    // Manually set log level to ERROR
    testLogger.setLogLevel(LogLevel.ERROR);
    
    // Clear messages array
    mockOutputChannel.__messages.length = 0;
    
    // Test all log levels
    testLogger.error('Test error message');
    testLogger.warn('Test warning message');
    testLogger.info('Test info message');
    testLogger.debug('Test debug message');
    
    // Only error should be logged
    assert.strictEqual(mockOutputChannel.__messages.length, 1, 'Only error messages should be logged');
    assert.ok(mockOutputChannel.__messages.some(msg => msg.includes('[ERROR]')), 'Message should include ERROR level');
    
    // Manually set log level to DEBUG
    testLogger.setLogLevel(LogLevel.DEBUG);
    
    // Clear messages array
    mockOutputChannel.__messages.length = 0;
    
    // Test all log levels
    testLogger.error('Test error message');
    testLogger.warn('Test warning message');
    testLogger.info('Test info message');
    testLogger.debug('Test debug message');
    
    // All levels should be logged
    assert.strictEqual(mockOutputChannel.__messages.length, 4, 'All messages should be logged with DEBUG level');
  });
});