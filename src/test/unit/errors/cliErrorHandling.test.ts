import * as assert from 'assert';
import { CliError, StepZenCliErrorDetails } from '../../../errors/CliError';
import { handleError } from '../../../errors/handler';
import { logger } from '../../../services/logger';
import * as vscode from 'vscode';
import * as sinon from 'sinon';

// We'll use a sandbox to manage our stubs
let sandbox: sinon.SinonSandbox;

suite('CLI Error Handling', () => {
  // Set up stubs before each test
  setup(() => {
    sandbox = sinon.createSandbox();
    
    // Stub logger methods
    sandbox.stub(logger, 'error');
    sandbox.stub(logger, 'debug');
    sandbox.stub(logger, 'info');
    sandbox.stub(logger, 'warn');
    sandbox.stub(logger, 'showOutput');
    
    // Stub vscode.window.showErrorMessage
    sandbox.stub(vscode.window, 'showErrorMessage').resolves(undefined);
  });
  
  // Clean up stubs after each test
  teardown(() => {
    sandbox.restore();
  });
  
  suite('Authorization Errors', () => {
    test('should correctly parse and handle authorization errors', () => {
      // Create a mock CLI error with authorization details
      const errorDetails: StepZenCliErrorDetails = {
        originalMessage: 'Error: Failed to execute the GraphQL query\nAction denied: You are not authorized to perform this action',
        errorType: 'authorization',
        authError: 'You are not authorized to perform this action'
      };

      const error = new CliError(
        'StepZen CLI exited with code 1: Error: Failed to execute the GraphQL query',
        'COMMAND_FAILED',
        new Error('CLI error'),
        errorDetails
      );

      // Handle the error
      handleError(error);

      // Verify error was logged correctly
      assert.ok(
        (logger.error as sinon.SinonStub).calledWith(
          sinon.match(/CliError\[COMMAND_FAILED\]/),
          sinon.match.any
        ),
        'Should log the error with code'
      );
      
      assert.ok(
        (logger.error as sinon.SinonStub).calledWith(
          sinon.match(/Authorization Error: You are not authorized to perform this action/)
        ),
        'Should log the authorization error details'
      );

      // Verify notification was shown with correct message
      assert.ok(
        (vscode.window.showErrorMessage as sinon.SinonStub).calledWith(
          sinon.match(/StepZen Authorization Error/),
          sinon.match.any,
          'Show Logs'
        ),
        'Should show error notification with authorization error'
      );
    });
  });

  suite('GraphQL Errors', () => {
    test('should correctly parse and handle GraphQL errors', () => {
      // Create a mock CLI error with GraphQL error details
      const errorDetails: StepZenCliErrorDetails = {
        originalMessage: 'Error: Failed to execute the GraphQL query\nErrors returned by the GraphQL server:\n - (8:13) Cannot query field "ssno" on type "Contact". Did you mean "ssn"?',
        errorType: 'graphql',
        graphqlErrors: ['(8:13) Cannot query field "ssno" on type "Contact". Did you mean "ssn"?']
      };

      const error = new CliError(
        'StepZen CLI exited with code 1: Error: Failed to execute the GraphQL query',
        'COMMAND_FAILED',
        new Error('CLI error'),
        errorDetails
      );

      // Handle the error
      handleError(error);

      // Verify error was logged correctly
      assert.ok(
        (logger.error as sinon.SinonStub).calledWith(
          sinon.match(/CliError\[COMMAND_FAILED\]/),
          sinon.match.any
        ),
        'Should log the error with code'
      );
      
      assert.ok(
        (logger.error as sinon.SinonStub).calledWith('GraphQL Errors:'),
        'Should log GraphQL errors header'
      );
      
      assert.ok(
        (logger.error as sinon.SinonStub).calledWith(
          sinon.match(/- \(8:13\) Cannot query field "ssno" on type "Contact"/)
        ),
        'Should log the specific GraphQL error'
      );

      // Verify notification was shown with correct message
      assert.ok(
        (vscode.window.showErrorMessage as sinon.SinonStub).calledWith(
          'StepZen GraphQL Error: The request contains errors',
          sinon.match.any,
          'Show Logs'
        ),
        'Should show error notification with GraphQL error'
      );
    });
  });

  suite('Generic CLI Errors', () => {
    test('should handle generic CLI errors without specific details', () => {
      const error = new CliError(
        'Failed to execute StepZen request',
        'REQUEST_FAILED'
      );

      // Handle the error
      handleError(error);

      // Verify error was logged correctly
      assert.ok(
        (logger.error as sinon.SinonStub).calledWith(
          sinon.match(/CliError\[REQUEST_FAILED\]/),
          sinon.match.any
        ),
        'Should log the error with code'
      );

      // Verify notification was shown with correct message
      assert.ok(
        (vscode.window.showErrorMessage as sinon.SinonStub).calledWith(
          'StepZen CLI Error: Failed to execute StepZen request',
          sinon.match.any,
          'Show Logs'
        ),
        'Should show error notification with generic CLI error'
      );
    });
  });

  suite('Error Normalization', () => {
    test('should normalize standard Error objects with CLI-related messages', () => {
      const stdError = new Error('Command stepzen request exited with code 1');
      
      // Handle the error
      const normalized = handleError(stdError);
      
      // Verify it was normalized to a CliError
      assert.ok(normalized instanceof CliError, 'Should normalize to CliError');
      assert.strictEqual(normalized.code, 'CLI_OPERATION_FAILED', 'Should have correct error code');
      
      // Verify notification was shown
      assert.ok(
        (vscode.window.showErrorMessage as sinon.SinonStub).called,
        'Should show error notification'
      );
    });
  });
});

// Made with Bob
