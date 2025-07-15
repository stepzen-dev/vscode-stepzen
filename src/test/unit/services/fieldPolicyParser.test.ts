/**
 * Copyright IBM Corp. 2025
 * Assisted by CursorAI
 */

import * as assert from "assert";
import * as path from "path";
import * as fs from "fs";
import { FieldPolicyParser } from "../../../services/fieldPolicyParser";
import { FieldPolicy, PolicyValidationError, PolicyConflict } from "../../../types/fieldPolicy";

suite("Field Policy Parser Tests", () => {
  const fixturesDir = path.join(__dirname, "../../fixtures/field-policies");

  test("should parse basic public access policies", async () => {
    const configPath = path.join(fixturesDir, "basic-public-access.yaml");
    const configContent = fs.readFileSync(configPath, "utf8");
    
    const parser = new FieldPolicyParser();
    const result = await parser.parse(configContent);
    
    assert.strictEqual(result.isValid, true);
    assert.strictEqual(result.policies.length, 2);
    
    const queryPolicy = result.policies.find((p: FieldPolicy) => p.type === "Query");
    assert.ok(queryPolicy);
    assert.strictEqual(queryPolicy.rules.length, 1);
    assert.strictEqual(queryPolicy.rules[0].condition, "true");
    assert.strictEqual(queryPolicy.rules[0].name, "public fields");
    assert.deepStrictEqual(queryPolicy.rules[0].fields, [
      "hello",
      "user",
      "users",
      "product",
      "products",
      "productsByIds",
      "searchProducts",
      "order",
      "ordersByUserId",
      "getProductRating",
      "getShippingInfo"
    ]);
    assert.strictEqual(queryPolicy.policyDefault.condition, "false");
  });

  test("should parse JWT role-based policies", async () => {
    const configPath = path.join(fixturesDir, "jwt-role-based.yaml");
    const configContent = fs.readFileSync(configPath, "utf8");
    
    const parser = new FieldPolicyParser();
    const result = await parser.parse(configContent);
    
    assert.strictEqual(result.isValid, true);
    assert.strictEqual(result.policies.length, 3);
    
    const queryPolicy = result.policies.find((p: FieldPolicy) => p.type === "Query");
    assert.ok(queryPolicy);
    assert.strictEqual(queryPolicy.rules.length, 3);
    
    // Check admin rule
    const adminRule = queryPolicy.rules.find((r: any) => r.name === "admin access");
    assert.ok(adminRule);
    assert.strictEqual(adminRule.condition, '$jwt.role:String == "admin"');
    assert.deepStrictEqual(adminRule.fields, ["adminData", "userManagement", "systemStats"]);
  });

  test("should parse array membership conditions", async () => {
    const configPath = path.join(fixturesDir, "array-membership.yaml");
    const configContent = fs.readFileSync(configPath, "utf8");
    
    const parser = new FieldPolicyParser();
    const result = await parser.parse(configContent);
    
    assert.strictEqual(result.isValid, true);
    
    const queryPolicy = result.policies.find((p: FieldPolicy) => p.type === "Query");
    assert.ok(queryPolicy);
    const adminGroupRule = queryPolicy.rules.find((r: any) => r.name === "admin group access");
    assert.ok(adminGroupRule);
    assert.strictEqual(adminGroupRule.condition, '$jwt.groups:String has "admin"');
  });

  test("should detect invalid syntax", async () => {
    const configPath = path.join(fixturesDir, "invalid-syntax.yaml");
    const configContent = fs.readFileSync(configPath, "utf8");
    
    const parser = new FieldPolicyParser();
    const result = await parser.parse(configContent);
    
    assert.strictEqual(result.isValid, false);
    assert.ok(result.errors.length > 0);
    
    // Check for specific error types
    const missingTypeError = result.errors.find((e: PolicyValidationError) => 
      e.message.includes("Invalid condition")
    );
    assert.ok(missingTypeError, "Should detect invalid condition");
  });

  test("should detect policy conflicts", async () => {
    const configPath = path.join(fixturesDir, "conflict-test.yaml");
    const configContent = fs.readFileSync(configPath, "utf8");
    
    const parser = new FieldPolicyParser();
    const result = await parser.parse(configContent);
    
    assert.strictEqual(result.isValid, true); // Syntax is valid
    assert.ok(result.conflicts.length > 0);
    
    // Check for field conflicts
    const fieldConflict = result.conflicts.find((c: PolicyConflict) => 
      c.type === "field_conflict" && c.field === "userData"
    );
    assert.ok(fieldConflict, "Should detect conflicting field access");
  });

  test("should validate predicate syntax", async () => {
    const parser = new FieldPolicyParser();
    
    // Valid predicates
    assert.strictEqual(parser.validatePredicate("true"), true);
    assert.strictEqual(parser.validatePredicate("false"), true);
    assert.strictEqual(parser.validatePredicate("?$jwt"), true);
    assert.strictEqual(parser.validatePredicate('$jwt.CUSTOMGROUP.role:String == "admin"'), true);
    assert.strictEqual(parser.validatePredicate('$jwt.CUSTOM/groups:String has "admin"'), true);
    
    // Invalid predicates
    assert.strictEqual(parser.validatePredicate("$jwt.CUSTOMGROUP.role"), false); // Missing type
    assert.strictEqual(parser.validatePredicate("$jwt.CUSTOMGROUP.role:String == admin"), false); // Missing quotes
    assert.strictEqual(parser.validatePredicate("$jwt.CUSTOMGROUP.role:String == 'admin' ||"), false); // Incomplete
  });

  test("should extract JWT claims from predicates", async () => {
    const parser = new FieldPolicyParser();
    
    const claims1 = parser.extractJwtClaims('$jwt.role:String == "admin"');
    assert.deepStrictEqual(claims1, ["role"]);
    
    const claims2 = parser.extractJwtClaims('$jwt.groups:String has "admin" || $jwt.permissions:String has "read"');
    assert.deepStrictEqual(claims2, ["groups", "permissions"]);
    
    const claims3 = parser.extractJwtClaims("true");
    assert.deepStrictEqual(claims3, []);
  });

  test("should analyze policy coverage", async () => {
    const configPath = path.join(fixturesDir, "jwt-role-based.yaml");
    const configContent = fs.readFileSync(configPath, "utf8");
    
    const parser = new FieldPolicyParser();
    const result = await parser.parse(configContent);
    
    const coverage = parser.analyzeCoverage(result.policies);
    
    assert.ok(coverage.types.length > 0);
    const queryCoverage = coverage.types.find((t: any) => t.type === "Query");
    assert.ok(queryCoverage);
    assert.ok(queryCoverage.coveredFields.length > 0);
    assert.ok(queryCoverage.uncoveredFields.length >= 0);
  });
}); 