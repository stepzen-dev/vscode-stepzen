/**
 * Copyright IBM Corp. 2025
 * Assisted by CursorAI
 */

import * as assert from 'assert';
import * as path from 'path';
import { services } from '../../services';
import { DirectiveBuilder } from '../../utils/directiveBuilder';

suite("Add Tool Test Suite", () => {
  
  suiteSetup(async () => {
    // Scan the test schema before running tests
    const fixturePath = path.join(__dirname, "..", "..", "..", "src", "test", "fixtures", "schema-sample", "index.graphql");
    await services.schemaIndex.scan(fixturePath);
  });

  test("should create GraphQL tool directive configuration", () => {
    const config = DirectiveBuilder.createToolConfig({
      name: "my-graphql-tool",
      description: "A GraphQL tool for testing",
      graphql: [
        { expose: true, types: "Query", fields: "customers|products" },
        { expose: true, types: "Mutation", fields: "createOrder" }
      ],
      descriptions: [
        { name: "query", description: "The GraphQL query to execute" },
        { name: "variables", description: "Variables for the query" }
      ]
    });

    assert.strictEqual(config.name, "tool");
    assert.strictEqual(config.arguments.length, 4);
    
    // Check name argument
    const nameArg = config.arguments.find(arg => arg.name === "name");
    assert.ok(nameArg);
    assert.strictEqual(nameArg.value, "my-graphql-tool");
    assert.strictEqual(nameArg.isString, true);
    
    // Check description argument
    const descArg = config.arguments.find(arg => arg.name === "description");
    assert.ok(descArg);
    assert.strictEqual(descArg.value, "A GraphQL tool for testing");
    
    // Check graphql argument (visibility patterns)
    const graphqlArg = config.arguments.find(arg => arg.name === "graphql");
    assert.ok(graphqlArg);
    assert.ok(Array.isArray(graphqlArg.value));
    const visibilityPatterns = graphqlArg.value as Array<{expose: boolean, types: string, fields: string}>;
    assert.strictEqual(visibilityPatterns.length, 2);
    
    // Check first pattern
    assert.strictEqual(visibilityPatterns[0].expose, true);
    assert.strictEqual(visibilityPatterns[0].types, "Query");
    assert.strictEqual(visibilityPatterns[0].fields, "customers|products");
    
    // Check second pattern
    assert.strictEqual(visibilityPatterns[1].expose, true);
    assert.strictEqual(visibilityPatterns[1].types, "Mutation");
    assert.strictEqual(visibilityPatterns[1].fields, "createOrder");
    
    // Check descriptions argument
    const descriptionsArg = config.arguments.find(arg => arg.name === "descriptions");
    assert.ok(descriptionsArg);
    assert.ok(Array.isArray(descriptionsArg.value));
  });

  test("should create prescribed tool directive configuration", () => {
    const config = DirectiveBuilder.createToolConfig({
      name: "my-prescribed-tool",
      description: "A prescribed tool for testing",
      descriptions: [
        { name: "email", description: "User email address" },
        { name: "filter.since", description: "Filter start date" }
      ]
    });

    assert.strictEqual(config.name, "tool");
    assert.strictEqual(config.multiline, true);
    assert.strictEqual(config.arguments.length, 3);

    // Check name argument
    const nameArg = config.arguments.find(arg => arg.name === "name");
    assert.ok(nameArg, "Should have name argument");
    assert.strictEqual(nameArg.value, "my-prescribed-tool");

    // Check description argument
    const descArg = config.arguments.find(arg => arg.name === "description");
    assert.ok(descArg, "Should have description argument");
    assert.strictEqual(descArg.value, "A prescribed tool for testing");

    // Should not have graphql argument for prescribed tools
    const graphqlArg = config.arguments.find(arg => arg.name === "graphql");
    assert.strictEqual(graphqlArg, undefined, "Prescribed tool should not have graphql argument");

    // Check descriptions argument
    const descriptionsArg = config.arguments.find(arg => arg.name === "descriptions");
    assert.ok(descriptionsArg, "Should have descriptions argument");
    assert.ok(Array.isArray(descriptionsArg.value), "Descriptions value should be an array");
    const descriptions = descriptionsArg.value as Array<{name: string, description: string}>;
    assert.strictEqual(descriptions.length, 2);
    assert.strictEqual(descriptions[0].name, "email");
    assert.strictEqual(descriptions[0].description, "User email address");
    assert.strictEqual(descriptions[1].name, "filter.since");
    assert.strictEqual(descriptions[1].description, "Filter start date");
  });

  test("should create minimal tool directive configuration", () => {
    const config = DirectiveBuilder.createToolConfig({
      name: "simple-tool"
    });

    assert.strictEqual(config.name, "tool");
    assert.strictEqual(config.multiline, true);
    assert.strictEqual(config.arguments.length, 1);

    // Check name argument
    const nameArg = config.arguments.find(arg => arg.name === "name");
    assert.ok(nameArg, "Should have name argument");
    assert.strictEqual(nameArg.value, "simple-tool");
    assert.strictEqual(nameArg.isString, true);
  });

  test("should handle template variables in tool name", () => {
    const config = DirectiveBuilder.createToolConfig({
      name: "{endpoint_folder}-{endpoint_name}-tool",
      description: "Tool with template variables"
    });

    assert.strictEqual(config.name, "tool");
    assert.strictEqual(config.arguments.length, 2);

    const nameArg = config.arguments.find(arg => arg.name === "name");
    assert.ok(nameArg, "Should have name argument");
    assert.strictEqual(nameArg.value, "{endpoint_folder}-{endpoint_name}-tool");
    assert.strictEqual(nameArg.isString, true);
  });

  test("should build tool directive string correctly", () => {
    const config = DirectiveBuilder.createToolConfig({
      name: "customer-orders-tool",
      description: "Tool for customer and order operations",
      graphql: [
        { expose: true, types: "Query", fields: "customers|orders" },
        { expose: true, types: "Mutation", fields: "createOrder" }
      ]
    });

    const directiveString = DirectiveBuilder.buildDirective(config, '  ', '');
    
    // Should not contain undefined values
    assert.ok(!directiveString.includes('undefined'), 'Should not contain undefined values');
    
    // Should contain the tool name
    assert.ok(directiveString.includes('"customer-orders-tool"'), 'Should contain tool name');
    
    // Should contain the description
    assert.ok(directiveString.includes('"Tool for customer and order operations"'), 'Should contain description');
    
    // Should contain the visibility patterns
    assert.ok(directiveString.includes('expose: true'), 'Should contain expose: true');
    assert.ok(directiveString.includes('types: "Query"'), 'Should contain types: "Query"');
    assert.ok(directiveString.includes('fields: "customers|orders"'), 'Should contain fields pattern');
    assert.ok(directiveString.includes('types: "Mutation"'), 'Should contain types: "Mutation"');
    assert.ok(directiveString.includes('fields: "createOrder"'), 'Should contain Mutation field pattern');
    
    // Should be properly formatted as multiline
    assert.ok(directiveString.includes('@tool('), 'Should start with @tool(');
    assert.ok(directiveString.includes('graphql: ['), 'Should have graphql array');
  });

  test("should handle empty arrays correctly", () => {
    const config = DirectiveBuilder.createToolConfig({
      name: "empty-arrays-tool",
      graphql: [],
      descriptions: []
    });

    // Empty arrays should not be included in the configuration
    assert.strictEqual(config.arguments.length, 1); // Only name argument
    
    const nameArg = config.arguments.find(arg => arg.name === "name");
    assert.ok(nameArg, "Should have name argument");
    
    const graphqlArg = config.arguments.find(arg => arg.name === "graphql");
    assert.strictEqual(graphqlArg, undefined, "Should not include empty graphql array");
    
    const descriptionsArg = config.arguments.find(arg => arg.name === "descriptions");
    assert.strictEqual(descriptionsArg, undefined, "Should not include empty descriptions array");
  });

  test("should validate tool directive structure", () => {
    // Test that the tool directive follows the expected structure from the issue description
    const config = DirectiveBuilder.createToolConfig({
      name: "comprehensive-tool",
      description: "A comprehensive tool with all features",
      graphql: [
        { expose: true, types: "Query", fields: ".*" },
        { expose: true, types: "User", fields: ".*" },
        { expose: true, types: "Product", fields: "name" }
      ],
      descriptions: [
        { name: "query", description: "The GraphQL query or mutation operation" },
        { name: "operationName", description: "Name of the operation to execute" },
        { name: "variables", description: "Variables object for the operation" }
      ]
    });

    // Verify the structure matches the @tool directive specification
    assert.strictEqual(config.name, "tool");
    assert.ok(config.multiline, "Tool directive should be multiline");
    
    // All required and optional arguments should be present
    const argNames = config.arguments.map(arg => arg.name);
    assert.ok(argNames.includes("name"), "Should have name argument");
    assert.ok(argNames.includes("description"), "Should have description argument");
    assert.ok(argNames.includes("graphql"), "Should have graphql argument");
    assert.ok(argNames.includes("descriptions"), "Should have descriptions argument");
  });

  test("should handle complex visibility patterns", () => {
    const config = DirectiveBuilder.createToolConfig({
      name: "pattern-tool",
      graphql: [
        { expose: true, types: "Query", fields: ".*" },
        { expose: true, types: "User", fields: "id|name|email" },
        { expose: false, types: "Query", fields: "_.*" },
        { expose: true, types: "Product", fields: "name" }
      ]
    });

    const graphqlArg = config.arguments.find(arg => arg.name === "graphql");
    assert.ok(graphqlArg, "Should have graphql argument");
    assert.ok(Array.isArray(graphqlArg.value), "GraphQL value should be an array");
    
    const patterns = graphqlArg.value as Array<{expose: boolean, types: string, fields: string}>;
    assert.strictEqual(patterns.length, 4);
    
    // Check each pattern
    assert.strictEqual(patterns[0].expose, true);
    assert.strictEqual(patterns[0].types, "Query");
    assert.strictEqual(patterns[0].fields, ".*");
    
    assert.strictEqual(patterns[1].expose, true);
    assert.strictEqual(patterns[1].types, "User");
    assert.strictEqual(patterns[1].fields, "id|name|email");
    
    assert.strictEqual(patterns[2].expose, false);
    assert.strictEqual(patterns[2].types, "Query");
    assert.strictEqual(patterns[2].fields, "_.*");
    
    assert.strictEqual(patterns[3].expose, true);
    assert.strictEqual(patterns[3].types, "Product");
    assert.strictEqual(patterns[3].fields, "name");
  });
}); 