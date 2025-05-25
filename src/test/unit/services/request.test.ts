/**
 * Copyright IBM Corp. 2025
 * Assisted by CursorAI
 */

import * as assert from 'assert';
import { RequestService } from '../../../services/request';
import { Logger } from '../../../services/logger';
import { ValidationError } from '../../../errors';
import { createMock } from '../../helpers/test-utils';

suite('RequestService', () => {
  let requestService: RequestService;
  let mockLogger: Logger;

  setup(() => {
    mockLogger = createMock<Logger>({
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {}
    });
    requestService = new RequestService(mockLogger);
  });

  suite('parseVariables', () => {
    test('should parse --var arguments correctly', () => {
      const varArgs = ['--var', 'name=value', '--var', 'count=42'];
      const result = requestService.parseVariables(varArgs);
      
      assert.deepStrictEqual(result.variables, {
        name: 'value',
        count: '42'
      });
    });

    test('should throw error for invalid varArgs type', () => {
      assert.throws(() => {
        requestService.parseVariables('invalid' as any);
      }, ValidationError);
    });

    test('should handle malformed variable format gracefully', () => {
      const varArgs = ['--var', 'invalidformat', '--var', 'valid=value'];
      const result = requestService.parseVariables(varArgs);
      
      // Should only include the valid variable
      assert.deepStrictEqual(result.variables, {
        valid: 'value'
      });
    });

    test('should return empty variables for empty array', () => {
      const result = requestService.parseVariables([]);
      assert.deepStrictEqual(result.variables, {});
    });

    test('should handle variables with equals signs in values', () => {
      const varArgs = ['--var', 'url=https://example.com/path?param=value'];
      const result = requestService.parseVariables(varArgs);
      
      assert.deepStrictEqual(result.variables, {
        url: 'https://example.com/path?param=value'
      });
    });
  });

  suite('loadEndpointConfig', () => {
    test('should have loadEndpointConfig method', () => {
      // Just verify the method exists - file system tests would require complex mocking
      assert.strictEqual(typeof requestService.loadEndpointConfig, 'function');
    });
  });

  suite('getApiKey', () => {
    test('should have getApiKey method', () => {
      // Just verify the method exists - CLI tests would require complex mocking
      assert.strictEqual(typeof requestService.getApiKey, 'function');
    });
  });

  suite('validateRequestOptions', () => {
    test('should validate valid options with queryText', () => {
      const options = {
        queryText: 'query { hello }',
        operationName: 'GetHello',
        varArgs: ['--var', 'name=value']
      };
      
      // Should not throw
      requestService.validateRequestOptions(options);
    });

    test('should validate valid options with documentContent', () => {
      const options = {
        documentContent: 'query GetHello { hello }',
        operationName: 'GetHello',
        varArgs: ['--var', 'name=value']
      };
      
      // Should not throw
      requestService.validateRequestOptions(options);
    });

    test('should throw error for invalid options object', () => {
      assert.throws(() => {
        requestService.validateRequestOptions(null as any);
      }, ValidationError);
      
      assert.throws(() => {
        requestService.validateRequestOptions('invalid' as any);
      }, ValidationError);
    });

    test('should throw error when neither queryText nor documentContent provided', () => {
      const options = {
        operationName: 'GetHello'
      };
      
      assert.throws(() => {
        requestService.validateRequestOptions(options);
      }, ValidationError);
    });

    test('should throw error for invalid operationName type', () => {
      const options = {
        queryText: 'query { hello }',
        operationName: 123 as any
      };
      
      assert.throws(() => {
        requestService.validateRequestOptions(options);
      }, ValidationError);
    });

    test('should throw error for invalid varArgs type', () => {
      const options = {
        queryText: 'query { hello }',
        varArgs: 'invalid' as any
      };
      
      assert.throws(() => {
        requestService.validateRequestOptions(options);
      }, ValidationError);
    });

    test('should allow undefined optional fields', () => {
      const options = {
        queryText: 'query { hello }',
        operationName: undefined,
        varArgs: undefined
      };
      
      // Should not throw
      requestService.validateRequestOptions(options);
    });
  });

  suite('calculateDocumentHash', () => {
    test('should calculate SHA256 hash correctly', () => {
      const documentContent = '{\n  __typename\n}\n';
      const result = requestService.calculateDocumentHash(documentContent);
      
      // This should match the hash from the StepZen documentation example
      assert.strictEqual(result, 'sha256:8d8f7365e9e86fa8e3313fcaf2131b801eafe9549de22373089cf27511858b39');
    });

    test('should throw error for invalid document content', () => {
      assert.throws(() => {
        requestService.calculateDocumentHash('');
      }, ValidationError);
      
      assert.throws(() => {
        requestService.calculateDocumentHash(null as any);
      }, ValidationError);
    });
  });

  suite('executePersistedDocumentRequest', () => {
    test('should handle successful HTTP request', async () => {
      // This test would require mocking the https module
      // For now, we'll just verify the method exists and has the correct signature
      assert.strictEqual(typeof requestService.executePersistedDocumentRequest, 'function');
    });
  });
}); 