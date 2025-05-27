/**
 * Copyright IBM Corp. 2025
 * Assisted by CursorAI
 */

import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createTempGraphQLFile, cleanupLater, createTempJSONFile } from '../../../utils/tempFiles';
import { ValidationError } from '../../../errors';

suite('TempFiles Utility Tests', () => {
  
  suite('createTempGraphQLFile', () => {
    test('should create a temporary GraphQL file with valid content', () => {
      const content = 'query { hello }';
      const filePath = createTempGraphQLFile(content);
      
      // Verify file was created
      assert.ok(fs.existsSync(filePath), 'File should exist');
      
      // Verify content is correct
      const fileContent = fs.readFileSync(filePath, 'utf8');
      assert.strictEqual(fileContent, content, 'File content should match input');
      
      // Verify file is in temp directory
      assert.ok(filePath.startsWith(os.tmpdir()), 'File should be in temp directory');
      
      // Verify file has correct extension
      assert.ok(filePath.endsWith('.graphql'), 'File should have .graphql extension');
      
      // Cleanup
      fs.unlinkSync(filePath);
    });
    
    test('should throw ValidationError for invalid content', () => {
      assert.throws(() => {
        createTempGraphQLFile('');
      }, ValidationError);
      
      assert.throws(() => {
        createTempGraphQLFile(null as any);
      }, ValidationError);
      
      assert.throws(() => {
        createTempGraphQLFile(undefined as any);
      }, ValidationError);
    });
    
    test('should generate unique filenames', () => {
      const content = 'query { test }';
      const file1 = createTempGraphQLFile(content);
      const file2 = createTempGraphQLFile(content);
      
      assert.notStrictEqual(file1, file2, 'Files should have different names');
      
      // Cleanup
      fs.unlinkSync(file1);
      fs.unlinkSync(file2);
    });
  });
  
  suite('createTempJSONFile', () => {
    test('should create a temporary JSON file with valid data', () => {
      const data = { test: 'value', number: 42 };
      const filePath = createTempJSONFile(data);
      
      // Verify file was created
      assert.ok(fs.existsSync(filePath), 'File should exist');
      
      // Verify content is correct JSON
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const parsedData = JSON.parse(fileContent);
      assert.deepStrictEqual(parsedData, data, 'File content should match input data');
      
      // Verify file is in temp directory
      assert.ok(filePath.startsWith(os.tmpdir()), 'File should be in temp directory');
      
      // Verify file has correct extension
      assert.ok(filePath.endsWith('.json'), 'File should have .json extension');
      
      // Cleanup
      fs.unlinkSync(filePath);
    });
    
    test('should use custom prefix when provided', () => {
      const data = { test: true };
      const prefix = 'custom-prefix-';
      const filePath = createTempJSONFile(data, prefix);
      
      const filename = path.basename(filePath);
      assert.ok(filename.startsWith(prefix), 'Filename should start with custom prefix');
      
      // Cleanup
      fs.unlinkSync(filePath);
    });
    
    test('should throw ValidationError for invalid data', () => {
      assert.throws(() => {
        createTempJSONFile(null);
      }, ValidationError);
      
      assert.throws(() => {
        createTempJSONFile(undefined);
      }, ValidationError);
    });
  });
  
  suite('cleanupLater', () => {
    test('should schedule file cleanup', (done) => {
      const content = 'test content';
      const filePath = createTempGraphQLFile(content);
      
      // Verify file exists
      assert.ok(fs.existsSync(filePath), 'File should exist initially');
      
      // Schedule cleanup with short delay
      cleanupLater(filePath, 50);
      
      // Check that file is cleaned up after delay
      setTimeout(() => {
        assert.ok(!fs.existsSync(filePath), 'File should be cleaned up');
        done();
      }, 100);
    });
    
    test('should handle invalid file paths gracefully', () => {
      // These should not throw errors
      cleanupLater('');
      cleanupLater(null as any);
      cleanupLater(undefined as any);
    });
    
    test('should refuse to clean up non-temp files', () => {
      const nonTempPath = '/some/other/path/file.txt';
      
      // This should not throw but should log a warning
      cleanupLater(nonTempPath);
      
      // If the file existed, it should not be deleted
      // (We can't easily test this without creating files outside temp)
    });
  });
}); 