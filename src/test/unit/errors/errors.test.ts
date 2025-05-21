import * as assert from 'assert';
import { StepZenError, CliError, ValidationError, NetworkError } from '../../../errors';

suite('Error Classes Tests', () => {
  suite('StepZenError', () => {
    test('constructs with basic parameters', () => {
      const error = new StepZenError('Error message', 'ERROR_CODE');
      
      assert.strictEqual(error.name, 'StepZenError');
      assert.strictEqual(error.message, 'Error message');
      assert.strictEqual(error.code, 'ERROR_CODE');
      assert.strictEqual(error.cause, undefined);
      assert.ok(error.stack, 'Should have a stack trace');
    });

    test('constructs with cause parameter', () => {
      const cause = new Error('Original error');
      const error = new StepZenError('Error message', 'ERROR_CODE', cause);
      
      assert.strictEqual(error.message, 'Error message');
      assert.strictEqual(error.code, 'ERROR_CODE');
      assert.strictEqual(error.cause, cause);
    });

    test('toString provides formatted message', () => {
      const error = new StepZenError('Error message', 'ERROR_CODE');
      
      assert.strictEqual(error.toString(), 'StepZenError[ERROR_CODE]: Error message');
    });
  });

  suite('CliError', () => {
    test('constructs with message and code', () => {
      const error = new CliError('CLI error', 'CLI_TEST_ERROR');
      
      assert.strictEqual(error.name, 'CliError');
      assert.strictEqual(error.message, 'CLI error');
      assert.strictEqual(error.code, 'CLI_TEST_ERROR');
      assert.strictEqual(error.cause, undefined);
    });

    test('constructs with default code when not provided', () => {
      const error = new CliError('CLI error');
      
      assert.strictEqual(error.code, 'CLI_ERROR');
    });

    test('constructs with cause parameter', () => {
      const cause = new Error('Original error');
      const error = new CliError('CLI error', 'CLI_TEST_ERROR', cause);
      
      assert.strictEqual(error.cause, cause);
    });
  });

  suite('ValidationError', () => {
    test('constructs with message and code', () => {
      const error = new ValidationError('Validation error', 'VALIDATION_TEST_ERROR');
      
      assert.strictEqual(error.name, 'ValidationError');
      assert.strictEqual(error.message, 'Validation error');
      assert.strictEqual(error.code, 'VALIDATION_TEST_ERROR');
      assert.strictEqual(error.cause, undefined);
    });

    test('constructs with default code when not provided', () => {
      const error = new ValidationError('Validation error');
      
      assert.strictEqual(error.code, 'VALIDATION_ERROR');
    });

    test('constructs with cause parameter', () => {
      const cause = new Error('Original error');
      const error = new ValidationError('Validation error', 'VALIDATION_TEST_ERROR', cause);
      
      assert.strictEqual(error.cause, cause);
    });
  });

  suite('NetworkError', () => {
    test('constructs with message and code', () => {
      const error = new NetworkError('Network error', 'NETWORK_TEST_ERROR');
      
      assert.strictEqual(error.name, 'NetworkError');
      assert.strictEqual(error.message, 'Network error');
      assert.strictEqual(error.code, 'NETWORK_TEST_ERROR');
      assert.strictEqual(error.cause, undefined);
    });

    test('constructs with default code when not provided', () => {
      const error = new NetworkError('Network error');
      
      assert.strictEqual(error.code, 'NETWORK_ERROR');
    });

    test('constructs with cause parameter', () => {
      const cause = new Error('Original error');
      const error = new NetworkError('Network error', 'NETWORK_TEST_ERROR', cause);
      
      assert.strictEqual(error.cause, cause);
    });
  });
});