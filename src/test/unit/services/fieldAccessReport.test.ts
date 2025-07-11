/**
 * Copyright IBM Corp. 2025
 * Assisted by CursorAI
 */

import * as assert from "assert";
import * as path from "path";
import * as fs from "fs";
import { SchemaIndexService } from "../../../services/SchemaIndexService";
import { FieldPolicyParser } from "../../../services/fieldPolicyParser";
import { generateFieldAccessReportData } from "../../../services/fieldAccessReport";
import { services } from "../../../services";

suite("Field Access Report Tests", () => {
  const fixturesDir = path.join(__dirname, "../../../../src/test/fixtures/field-policies");
  const schemaDir = path.join(__dirname, "../../../../src/test/fixtures/schema-sample");
  const outputDir = path.join(__dirname, "../../../../src/test/fixtures/field-policies/generated-reports");

  test("GENERATE REPORTS FOR MANUAL REVIEW - generates reports for all field policy fixtures", async () => {
    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Set up schema index once for all fixtures
    const schemaIndex = new SchemaIndexService();
    const schemaEntry = path.join(schemaDir, "index.graphql");
    await schemaIndex.scan(schemaEntry);

    const policyParser = new FieldPolicyParser();
    
    // Get all YAML fixture files
    const fixtureFiles = fs.readdirSync(fixturesDir)
      .filter(file => file.endsWith('.yaml'))
      .map(file => file.replace('.yaml', ''));

    services.logger.info("\n=== FIELD ACCESS REPORT GENERATION FOR MANUAL REVIEW ===\n");

    for (const fixtureName of fixtureFiles) {
      const configPath = path.join(fixturesDir, `${fixtureName}.yaml`);
      const configContent = fs.readFileSync(configPath, "utf8");

      services.logger.info(`\n--- ${fixtureName} ---`);
      services.logger.info(`Policy Config:`);
      services.logger.info(configContent);
      
      try {
        const report = await generateFieldAccessReportData(schemaIndex, policyParser, configContent);
        
        // Write generated report to file
        const outputPath = path.join(outputDir, `${fixtureName}.report.json`);
        fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
        
        services.logger.info(`\nGenerated Report saved to: ${outputPath}`);
        services.logger.info(`Report Summary: ${report.summary.totalRootFields} root fields, ${report.summary.accessibleRootFields} accessible, ${report.summary.protectedRootFields} protected`);
        services.logger.info(`Custom Types: ${report.summary.totalCustomTypes} total, ${report.summary.customTypesWithPolicies} with policies`);
        
        // Check if there's an existing expected report
        const expectedReportPath = path.join(fixturesDir, `${fixtureName}.report.json`);
        if (fs.existsSync(expectedReportPath)) {
          const expectedReport = JSON.parse(fs.readFileSync(expectedReportPath, "utf8"));
          services.logger.info(`\nExisting Expected Report:`);
          services.logger.info(JSON.stringify(expectedReport, null, 2));
          
          const match = JSON.stringify(report) === JSON.stringify(expectedReport);
          services.logger.info(`\nMatch: ${match ? 'YES' : 'NO'}`);
          
          if (!match) {
            services.logger.info(`\nDifferences detected! Check the generated report at: ${outputPath}`);
          }
        } else {
          services.logger.info(`\nNo existing expected report found for ${fixtureName}`);
          services.logger.info(`Generated report saved to: ${outputPath}`);
        }
        
      } catch (error) {
        services.logger.error(`\nError generating report: ${error}`);
      }
      
      services.logger.info(`\n${'='.repeat(50)}`);
    }

    services.logger.info("\n=== END OF REPORT GENERATION ===\n");
    services.logger.info(`All generated reports saved to: ${outputDir}`);
    
    // This test always passes - it's just for generating output
    assert.ok(true, "Report generation completed for manual review");
  });

  test("should generate correct report for basic public access", async () => {
    const configPath = path.join(fixturesDir, "basic-public-access.yaml");
    const expectedReportPath = path.join(fixturesDir, "basic-public-access.report.json");
    const configContent = fs.readFileSync(configPath, "utf8");
    const expectedReport = JSON.parse(fs.readFileSync(expectedReportPath, "utf8"));

    // Set up schema index
    const schemaIndex = new SchemaIndexService();
    const schemaEntry = path.join(schemaDir, "index.graphql");
    await schemaIndex.scan(schemaEntry);

    // Use real parser
    const policyParser = new FieldPolicyParser();
    const report = await generateFieldAccessReportData(schemaIndex, policyParser, configContent);
    
    // Test summary structure
    assert.strictEqual(report.summary.totalRootFields, expectedReport.summary.totalRootFields);
    assert.strictEqual(report.summary.accessibleRootFields, expectedReport.summary.accessibleRootFields);
    assert.strictEqual(report.summary.protectedRootFields, expectedReport.summary.protectedRootFields);
    assert.strictEqual(report.summary.totalCustomTypes, expectedReport.summary.totalCustomTypes);
    assert.strictEqual(report.summary.customTypesWithPolicies, expectedReport.summary.customTypesWithPolicies);
    
    // Test root type access structure
    assert.ok(report.rootTypeAccess.Query, "Should have Query root type access");
    assert.ok(report.rootTypeAccess.Mutation, "Should have Mutation root type access");
    
    // Test that Query fields have correct structure
    const queryFields = report.rootTypeAccess.Query;
    assert.ok(queryFields.length > 0, "Should have Query fields");
    
    for (const field of queryFields) {
      assert.ok(field.field, "Field should have field name");
      assert.ok(["allowed", "denied"].includes(field.access), "Field should have valid access");
      assert.ok(field.ruleName !== undefined, "Field should have ruleName (can be null)");
      assert.ok(field.condition, "Field should have condition");
      assert.ok(field.reason, "Field should have reason");
    }
    
    // Test custom type access structure
    assert.ok(report.customTypeAccess.User, "Should have User custom type access");
    assert.ok(report.customTypeAccess.Product, "Should have Product custom type access");
    
    // Test User type structure
    const userType = report.customTypeAccess.User;
    assert.strictEqual(userType.hasPolicy, false, "User should not have policy");
    assert.ok(Array.isArray(userType.accessPaths), "User should have access paths");
    assert.ok(["blocked", "controlled", "inherited"].includes(userType.effectiveAccess), "User should have valid effective access");
    assert.ok(Array.isArray(userType.fields), "User should have fields");
    
    // Test User fields structure
    for (const field of userType.fields) {
      assert.ok(field.field, "Field should have field name");
      assert.ok(["inherited", "controlled"].includes(field.access), "Field should have valid access");
      assert.ok(field.ruleName !== undefined, "Field should have ruleName (can be null)");
      assert.ok(field.condition !== undefined, "Field should have condition (can be null)");
      assert.ok(field.reason, "Field should have reason");
    }
  });

  test("should generate correct report for JWT role-based policies", async () => {
    const configPath = path.join(fixturesDir, "jwt-role-based.yaml");
    const expectedReportPath = path.join(fixturesDir, "jwt-role-based.report.json");
    const configContent = fs.readFileSync(configPath, "utf8");
    const expectedReport = JSON.parse(fs.readFileSync(expectedReportPath, "utf8"));

    // Set up schema index
    const schemaIndex = new SchemaIndexService();
    const schemaEntry = path.join(schemaDir, "index.graphql");
    await schemaIndex.scan(schemaEntry);

    // Use real parser
    const policyParser = new FieldPolicyParser();
    const report = await generateFieldAccessReportData(schemaIndex, policyParser, configContent);
    
    // Test summary structure
    assert.strictEqual(report.summary.totalRootFields, expectedReport.summary.totalRootFields);
    assert.strictEqual(report.summary.accessibleRootFields, expectedReport.summary.accessibleRootFields);
    assert.strictEqual(report.summary.protectedRootFields, expectedReport.summary.protectedRootFields);
    assert.strictEqual(report.summary.totalCustomTypes, expectedReport.summary.totalCustomTypes);
    assert.strictEqual(report.summary.customTypesWithPolicies, expectedReport.summary.customTypesWithPolicies);
    
    // Test that User type has policy
    const userType = report.customTypeAccess.User;
    assert.strictEqual(userType.hasPolicy, true, "User should have policy");
    assert.strictEqual(userType.effectiveAccess, "controlled", "User should have controlled access");
    
    // Test that User fields show rule names
    const emailField = userType.fields.find(f => f.field === "email");
    assert.ok(emailField, "Should have email field");
    assert.strictEqual(emailField.ruleName, "own user data", "Email field should have rule name");
    assert.strictEqual(emailField.access, "controlled", "Email field should be controlled");
    
    const profileField = userType.fields.find(f => f.field === "profile");
    assert.ok(profileField, "Should have profile field");
    assert.strictEqual(profileField.ruleName, "own user data", "Profile field should have rule name");
    
    // Test that fields without rules show null ruleName
    const idField = userType.fields.find(f => f.field === "id");
    assert.ok(idField, "Should have id field");
    assert.strictEqual(idField.ruleName, null, "ID field should have null rule name (uses policy default)");
  });

  test("should handle no policies scenario", async () => {
    const configContent = "configurationset:\n  - configuration:\n      name: test\n      uri: TEST_URI";
    
    const schemaIndex = new SchemaIndexService();
    const schemaEntry = path.join(schemaDir, "index.graphql");
    await schemaIndex.scan(schemaEntry);

    const policyParser = new FieldPolicyParser();
    const report = await generateFieldAccessReportData(schemaIndex, policyParser, configContent);
    
    // Test summary
    assert.strictEqual(report.summary.accessibleRootFields, report.summary.totalRootFields);
    assert.strictEqual(report.summary.protectedRootFields, 0);
    assert.strictEqual(report.summary.customTypesWithPolicies, 0);
    
    // Check that all root type fields are allowed
    for (const rootType of Object.values(report.rootTypeAccess)) {
      assert.ok(rootType.every(f => f.access === "allowed"));
      assert.ok(rootType.every(f => f.reason.includes("No field policies defined")));
    }
    
    // Check that all custom types show inherited access
    for (const customType of Object.values(report.customTypeAccess)) {
      assert.strictEqual(customType.hasPolicy, false);
      assert.strictEqual(customType.effectiveAccess, "inherited");
      assert.ok(customType.fields.every(f => f.access === "inherited"));
    }
  });

  test("should handle array membership policies", async () => {
    const configPath = path.join(fixturesDir, "array-membership.yaml");
    const configContent = fs.readFileSync(configPath, "utf8");

    const schemaIndex = new SchemaIndexService();
    const schemaEntry = path.join(schemaDir, "index.graphql");
    await schemaIndex.scan(schemaEntry);

    const policyParser = new FieldPolicyParser();
    const report = await generateFieldAccessReportData(schemaIndex, policyParser, configContent);
    
    // Test that report structure is correct
    assert.ok(report.summary.totalRootFields > 0);
    assert.ok(report.summary.totalCustomTypes > 0);
    assert.ok(report.rootTypeAccess.Query);
    assert.ok(report.customTypeAccess.Product);
    
    // Test that Product type has policy
    const productType = report.customTypeAccess.Product;
    assert.strictEqual(productType.hasPolicy, true);
    assert.strictEqual(productType.effectiveAccess, "controlled");
    
    // Test that Product fields show controlled access
    for (const field of productType.fields) {
      assert.strictEqual(field.access, "controlled");
      assert.ok(field.condition !== null, "Controlled fields should have conditions");
    }
  });

  test("should handle introspection control policies", async () => {
    const configPath = path.join(fixturesDir, "introspection-control.yaml");
    const configContent = fs.readFileSync(configPath, "utf8");

    const schemaIndex = new SchemaIndexService();
    const schemaEntry = path.join(schemaDir, "index.graphql");
    await schemaIndex.scan(schemaEntry);

    const policyParser = new FieldPolicyParser();
    const report = await generateFieldAccessReportData(schemaIndex, policyParser, configContent);
    
    // Test that report structure is correct
    assert.ok(report.summary.totalRootFields > 0);
    assert.ok(report.rootTypeAccess.Query);
    
    // Test that Query fields have correct access
    const queryFields = report.rootTypeAccess.Query;
    
    // The policy defines public fields for "contents" and "pages" but these don't exist in our schema
    // So all fields should use the policy default: ?$jwt (denied)
    const allowedFields = queryFields.filter(f => f.access === "allowed");
    const deniedFields = queryFields.filter(f => f.access === "denied");
    
    // Since the public fields don't exist in our schema, all fields should be denied
    assert.strictEqual(allowedFields.length, 0, "No fields should be allowed (public fields don't exist in schema)");
    assert.ok(deniedFields.length > 0, "Should have some denied fields");
    
    // Test that denied fields have the correct reason
    for (const field of deniedFields) {
      assert.ok(field.reason.includes("Policy default: denied"), "Denied fields should reference policy default");
    }
  });

  test("should handle policy conflicts", async () => {
    const configPath = path.join(fixturesDir, "conflict-test.yaml");
    const configContent = fs.readFileSync(configPath, "utf8");

    const schemaIndex = new SchemaIndexService();
    const schemaEntry = path.join(schemaDir, "index.graphql");
    await schemaIndex.scan(schemaEntry);

    const policyParser = new FieldPolicyParser();
    const report = await generateFieldAccessReportData(schemaIndex, policyParser, configContent);
    
    // Test that report structure is correct even with conflicts
    assert.ok(report.summary.totalRootFields > 0);
    assert.ok(report.rootTypeAccess.Query);
    assert.ok(report.customTypeAccess.User);
    
    // Test that User type has policy
    const userType = report.customTypeAccess.User;
    assert.strictEqual(userType.hasPolicy, true);
    assert.strictEqual(userType.effectiveAccess, "controlled");
    
    // Test that conflicting fields are handled (first rule wins)
    const userDataField = userType.fields.find(f => f.field === "email");
    assert.ok(userDataField, "Should have email field");
    assert.strictEqual(userDataField.access, "controlled");
  });
}); 