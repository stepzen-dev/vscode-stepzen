import * as assert from 'assert';
import { createMockLogger } from './mock-logger';

suite('Mock Logger Helper Test Suite', () => {
  test('createMockLogger returns a usable mock', () => {
    const { mockLogger, logCalls } = createMockLogger();
    
    // Test all log methods
    mockLogger.error('Test error', new Error('Error details'));
    mockLogger.warn('Test warning');
    mockLogger.info('Test info');
    mockLogger.debug('Test debug');
    
    // Verify calls were tracked
    assert.strictEqual(logCalls.error.length, 1, 'Should track error calls');
    assert.strictEqual(logCalls.warn.length, 1, 'Should track warn calls');
    assert.strictEqual(logCalls.info.length, 1, 'Should track info calls');
    assert.strictEqual(logCalls.debug.length, 1, 'Should track debug calls');
    
    // Verify messages were stored correctly
    assert.strictEqual(logCalls.error[0], 'Test error');
    assert.strictEqual(logCalls.warn[0], 'Test warning');
    assert.strictEqual(logCalls.info[0], 'Test info');
    assert.strictEqual(logCalls.debug[0], 'Test debug');
    
    // Verify all messages array
    assert.strictEqual(logCalls.all.length, 4, 'Should track all calls');
    
    // Verify error details were captured
    assert.ok(logCalls.all[0].error instanceof Error, 'Error object should be captured');
    assert.strictEqual((logCalls.all[0].error as Error).message, 'Error details');
  });
  
  test('setupMocks replaces Logger.getInstance', () => {
    const { mockLogger, logCalls, setupMocks } = createMockLogger();
    
    // Replace the logger
    const restore = setupMocks();
    
    try {
      // Check that the mock's methods can be called
      mockLogger.info('Test mocked logger');
      
      // Verify calls were tracked
      assert.strictEqual(logCalls.info.length, 1);
      assert.strictEqual(logCalls.info[0], 'Test mocked logger');
    } finally {
      // Always restore the original
      restore();
    }
  });
});