/**
 * Copyright IBM Corp. 2025
 * Assisted by CursorAI
 */

import * as assert from 'assert';
import * as path from 'path';
import { services } from '../../services';

suite("Add Materializer Test Suite", () => {
  
  suiteSetup(async () => {
    // Scan the test schema before running tests
    const fixturePath = path.join(__dirname, "..", "..", "..", "src", "test", "fixtures", "schema-sample", "index.graphql");
    await services.schemaIndex.scan(fixturePath);
  });

  test("should find String fields in User type using schema data", () => {
    const fieldIndex = services.schemaIndex.getFieldIndex();
    const userFields = fieldIndex["User"];
    
    assert.ok(userFields, "User type should exist in field index");
    
    // Find String fields in User type
    const stringFields = userFields.filter(field => {
      const baseType = field.type.replace(/[[\]!]/g, '');
      return baseType === 'String';
    });
    
    // Should find username and createdAt fields
    const stringFieldNames = stringFields.map(f => f.name);
    assert.ok(stringFieldNames.includes('username'), `Expected 'username' in String fields, got: ${stringFieldNames.join(', ')}`);
    assert.ok(stringFieldNames.includes('createdAt'), `Expected 'createdAt' in String fields, got: ${stringFieldNames.join(', ')}`);
  });

  test("should find Boolean fields in User type using schema data", () => {
    const fieldIndex = services.schemaIndex.getFieldIndex();
    const userFields = fieldIndex["User"];
    
    assert.ok(userFields, "User type should exist in field index");
    
    // Find Boolean fields in User type
    const booleanFields = userFields.filter(field => {
      const baseType = field.type.replace(/[[\]!]/g, '');
      return baseType === 'Boolean';
    });
    
    // Should find isActive field
    const booleanFieldNames = booleanFields.map(f => f.name);
    assert.ok(booleanFieldNames.includes('isActive'), `Expected 'isActive' in Boolean fields, got: ${booleanFieldNames.join(', ')}`);
  });

  test("should find nested String fields in UserProfile type", () => {
    const fieldIndex = services.schemaIndex.getFieldIndex();
    const userProfileFields = fieldIndex["UserProfile"];
    
    assert.ok(userProfileFields, "UserProfile type should exist in field index");
    
    // Find String fields in UserProfile type
    const stringFields = userProfileFields.filter(field => {
      const baseType = field.type.replace(/[[\]!]/g, '');
      return baseType === 'String';
    });
    
    // Should find firstName, lastName, avatar, bio fields
    const stringFieldNames = stringFields.map(f => f.name);
    assert.ok(stringFieldNames.includes('firstName'), `Expected 'firstName' in String fields, got: ${stringFieldNames.join(', ')}`);
    assert.ok(stringFieldNames.includes('lastName'), `Expected 'lastName' in String fields, got: ${stringFieldNames.join(', ')}`);
    assert.ok(stringFieldNames.includes('avatar'), `Expected 'avatar' in String fields, got: ${stringFieldNames.join(', ')}`);
    assert.ok(stringFieldNames.includes('bio'), `Expected 'bio' in String fields, got: ${stringFieldNames.join(', ')}`);
  });

  test("should find root operations that return types containing String fields", () => {
    const rootOps = services.schemaIndex.getRootOperations();
    
    // user operation returns User type which contains String fields
    assert.ok('user' in rootOps, "Should have 'user' root operation");
    assert.equal(rootOps['user'].returnType, 'User', "user operation should return User type");
    
    // product operation returns Product type which contains String fields
    assert.ok('product' in rootOps, "Should have 'product' root operation");
    assert.equal(rootOps['product'].returnType, 'Product', "product operation should return Product type");
  });

  test("should correctly identify scalar types", () => {
    const fieldIndex = services.schemaIndex.getFieldIndex();
    const productFields = fieldIndex["Product"];
    
    assert.ok(productFields, "Product type should exist in field index");
    
    // Find different scalar types
    const stringFields = productFields.filter(field => field.type.replace(/[[\]!]/g, '') === 'String');
    const booleanFields = productFields.filter(field => field.type.replace(/[[\]!]/g, '') === 'Boolean');
    
    assert.ok(stringFields.length > 0, "Product should have String fields");
    assert.ok(booleanFields.length > 0, "Product should have Boolean fields (inStock)");
    
    // Check specific fields
    const fieldNames = productFields.map(f => f.name);
    assert.ok(fieldNames.includes('name'), "Product should have 'name' field");
    assert.ok(fieldNames.includes('description'), "Product should have 'description' field");
    assert.ok(fieldNames.includes('inStock'), "Product should have 'inStock' field");
  });

  test("should find nested scalar fields through object relationships", () => {
    const fieldIndex = services.schemaIndex.getFieldIndex();
    
    // Product has a Money field (price) which contains Float fields
    const productFields = fieldIndex["Product"];
    const moneyFields = fieldIndex["Money"];
    
    assert.ok(productFields, "Product type should exist");
    assert.ok(moneyFields, "Money type should exist");
    
    // Product should have price field of type Money
    const priceField = productFields.find(f => f.name === 'price');
    assert.ok(priceField, "Product should have price field");
    assert.equal(priceField.type.replace(/[[\]!]/g, ''), 'Money', "price field should be of type Money");
    
    // Money should have amount field of type Float
    const amountField = moneyFields.find(f => f.name === 'amount');
    assert.ok(amountField, "Money should have amount field");
    assert.equal(amountField.type.replace(/[[\]!]/g, ''), 'Float', "amount field should be of type Float");
  });
}); 