/**
 * Copyright IBM Corp. 2025
 * Assisted by CursorAI
 */

import * as assert from 'assert';
import { GraphQLLinterService } from '../../../services/graphqlLinter';

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



  test("should detect Node interface with wrong field name", async () => {
    await linter.initialize();
    const testFile = 'test-node-wrong-field.graphql';
    const content = 'interface Node { identifier: ID! }';
    
    const fs = require('fs');
    fs.writeFileSync(testFile, content);
    
    try {
      const diagnostics = await linter.lintFile(testFile);

      const nodeInterfaceErrors = diagnostics.filter(d => 
        d.message.includes("Node interface must have a field named 'id'") && 
        d.code === "node-interface-structure"
      );
      
      assert.strictEqual(nodeInterfaceErrors.length, 1, "Should detect Node interface with wrong field name");
    } finally {
      fs.unlinkSync(testFile);
    }
  });

  test("should detect Node interface with wrong field type", async () => {
    await linter.initialize();
    const testFile = 'test-node-wrong-type.graphql';
    const content = 'interface Node { id: String! }';
    
    const fs = require('fs');
    fs.writeFileSync(testFile, content);
    
    try {
      const diagnostics = await linter.lintFile(testFile);

      const nodeInterfaceErrors = diagnostics.filter(d => 
        d.message.includes("Node interface 'id' field must be of type 'ID!'") && 
        d.code === "node-interface-structure"
      );
      
      assert.strictEqual(nodeInterfaceErrors.length, 1, "Should detect Node interface with wrong field type");
    } finally {
      fs.unlinkSync(testFile);
    }
  });

  test("should accept correct Node interface", async () => {
    await linter.initialize();
    const testFile = 'test-node-correct.graphql';
    const content = 'interface Node { id: ID! }';
    
    const fs = require('fs');
    fs.writeFileSync(testFile, content);
    
    try {
      const diagnostics = await linter.lintFile(testFile);
      const nodeInterfaceErrors = diagnostics.filter(d => d.code === "node-interface-structure");
      
      assert.strictEqual(nodeInterfaceErrors.length, 0, "Should accept correct Node interface");
    } finally {
      fs.unlinkSync(testFile);
    }
  });

  test("should not affect other interfaces", async () => {
    await linter.initialize();
    const testFile = 'test-other-interfaces.graphql';
    const content = `
      interface User {
        id: ID!
        name: String!
        email: String!
      }
      
      interface Product {
        id: ID!
        name: String!
        price: Float!
      }
    `;
    
    const fs = require('fs');
    fs.writeFileSync(testFile, content);
    
    try {
      const diagnostics = await linter.lintFile(testFile);
      const nodeInterfaceErrors = diagnostics.filter(d => d.code === "node-interface-structure");
      
      assert.strictEqual(nodeInterfaceErrors.length, 0, "Should not affect other interfaces");
    } finally {
      fs.unlinkSync(testFile);
    }
  });
}); 