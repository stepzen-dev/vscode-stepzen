/**
 * Copyright IBM Corp. 2025
 * Assisted by CursorAI
 */

import * as assert from 'assert';
import { GraphQLLinterService } from '../../services/graphqlLinter';

suite("GraphQL Linter Test Suite", () => {
  let linter: GraphQLLinterService;

  suiteSetup(() => {
    linter = new GraphQLLinterService();
  });

  suiteTeardown(() => {
    linter.dispose();
  });

  test("should initialize GraphQL linter service", async () => {
    await linter.initialize();
    assert.ok(linter.getDiagnosticCollection(), "Diagnostic collection should be created");
  });

  test("should create diagnostic collection with correct name", () => {
    const collection = linter.getDiagnosticCollection();
    assert.strictEqual(collection.name, 'stepzen-graphql-lint', "Diagnostic collection should have correct name");
  });

  test("should clear diagnostics", () => {
    const collection = linter.getDiagnosticCollection();
    linter.clearDiagnostics();
    let filesWithIssues = 0;
    collection.forEach(() => {
      filesWithIssues++;
    });
    assert.strictEqual(filesWithIssues, 0, "Should clear all diagnostics");
  });

  test("should dispose service correctly", () => {
    linter.dispose();
    // Test that dispose doesn't throw errors
    assert.ok(true, "Dispose should complete without errors");
  });
}); 