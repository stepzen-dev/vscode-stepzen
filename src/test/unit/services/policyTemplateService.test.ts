/**
 * Copyright IBM Corp. 2025
 * Assisted by CursorAI
 */

import * as assert from "assert";
import { PolicyTemplateService } from "../../../services/policyTemplateService";

suite("PolicyTemplateService", () => {
  let service: PolicyTemplateService;

  setup(() => {
    service = new PolicyTemplateService();
  });

  suite("Template Patterns", () => {
    test("should return all template patterns", () => {
      const patterns = service.getAllTemplatePatterns();
      assert.ok(patterns);
      assert.ok(patterns.length > 0);
      assert.ok(patterns[0].id);
      assert.ok(patterns[0].name);
      assert.ok(patterns[0].pattern);
    });

    test("should return patterns by category", () => {
      const basicPatterns = service.getTemplatePatternsByCategory("basic");
      const advancedPatterns = service.getTemplatePatternsByCategory("advanced");
      
      assert.ok(basicPatterns.length > 0);
      assert.ok(advancedPatterns.length > 0);
      
      basicPatterns.forEach(pattern => {
        assert.strictEqual(pattern.category, "basic");
      });
      
      advancedPatterns.forEach(pattern => {
        assert.strictEqual(pattern.category, "advanced");
      });
    });

    test("should return patterns by type", () => {
      const queryPatterns = service.getTemplatePatternsByType("Query");
      const mutationPatterns = service.getTemplatePatternsByType("Mutation");
      
      assert.ok(queryPatterns.length > 0);
      
      queryPatterns.forEach(pattern => {
        assert.strictEqual(pattern.type, "Query");
      });
      
      mutationPatterns.forEach(pattern => {
        assert.strictEqual(pattern.type, "Mutation");
      });
    });

    test("should find pattern by ID", () => {
      const pattern = service.getTemplatePatternById("public-query-access");
      assert.ok(pattern);
      assert.strictEqual(pattern?.name, "Public Query Access");
      assert.strictEqual(pattern?.type, "Query");
    });

    test("should return undefined for non-existent pattern", () => {
      const pattern = service.getTemplatePatternById("non-existent");
      assert.strictEqual(pattern, undefined);
    });
  });

  suite("Field Suggestions", () => {
    const mockAvailableFields = [
      { name: "publicInfo" },
      { name: "userProfile" },
      { name: "adminPanel" },
      { name: "systemConfig" },
      { name: "getUsers" },
      { name: "createUser" },
      { name: "__type" },
      { name: "__schema" }
    ];

    test("should suggest fields with exact matches", () => {
      const pattern = service.getTemplatePatternById("jwt-required-with-introspection");
      assert.ok(pattern);
      
      if (pattern) {
        const rule = pattern.pattern.structure[0]; // public introspection rule
        const suggestions = service.suggestFieldsForPattern(rule, mockAvailableFields);
        
        const exactMatches = suggestions.filter(s => s.confidence === 1.0);
        assert.ok(exactMatches.length > 0);
        assert.ok(exactMatches.some(s => s.fieldName === "__type"));
        assert.ok(exactMatches.some(s => s.fieldName === "__schema"));
      }
    });

    test("should suggest fields with naming pattern matches", () => {
      const pattern = service.getTemplatePatternById("role-based-access");
      assert.ok(pattern);
      
      if (pattern) {
        const adminRule = pattern.pattern.structure.find(r => r.name === "admin access");
        assert.ok(adminRule);
        
        if (adminRule) {
          const suggestions = service.suggestFieldsForPattern(adminRule, mockAvailableFields);
          
          const patternMatches = suggestions.filter(s => s.confidence === 0.8);
          assert.ok(patternMatches.length > 0);
          assert.ok(patternMatches.some(s => s.fieldName === "adminPanel"));
          assert.ok(patternMatches.some(s => s.fieldName === "systemConfig"));
        }
      }
    });

    test("should include all fields with lower confidence", () => {
      const pattern = service.getTemplatePatternById("public-query-access");
      assert.ok(pattern);
      
      if (pattern) {
        const rule = pattern.pattern.structure[0];
        const suggestions = service.suggestFieldsForPattern(rule, mockAvailableFields);
        
        // Should include all fields (exact matches + pattern matches + all fields)
        assert.ok(suggestions.length >= mockAvailableFields.length);
        
        // Should have some low confidence suggestions
        const lowConfidence = suggestions.filter(s => s.confidence === 0.3);
        assert.ok(lowConfidence.length > 0);
      }
    });

    test("should sort suggestions by confidence", () => {
      const pattern = service.getTemplatePatternById("jwt-required-with-introspection");
      assert.ok(pattern);
      
      if (pattern) {
        const rule = pattern.pattern.structure[0];
        const suggestions = service.suggestFieldsForPattern(rule, mockAvailableFields);
        
        // Should be sorted by confidence (highest first)
        for (let i = 1; i < suggestions.length; i++) {
          assert.ok(suggestions[i-1].confidence >= suggestions[i].confidence);
        }
      }
    });

    test("should provide meaningful reasons for suggestions", () => {
      const pattern = service.getTemplatePatternById("role-based-access");
      assert.ok(pattern);
      
      if (pattern) {
        const rule = pattern.pattern.structure[0];
        const suggestions = service.suggestFieldsForPattern(rule, mockAvailableFields);
        
        suggestions.forEach(suggestion => {
          assert.ok(suggestion.reason);
          assert.ok(suggestion.reason.length > 0);
        });
      }
    });
  });

  suite("Policy Generation from Patterns", () => {
    test("should generate policy from pattern with field selections", () => {
      const fieldSelections = {
        "public fields": ["publicInfo", "getUsers"],
        "user access": ["userProfile"],
        "editor access": ["contentManagement"],
        "admin access": ["adminPanel", "systemConfig"]
      };
      
      const policy = service.generatePolicyFromPattern("role-based-access", fieldSelections);
      
      assert.ok(policy);
      assert.strictEqual(policy?.type, "Query");
      assert.ok(policy?.rules);
      assert.strictEqual(policy?.rules.length, 4);
      
      const publicRule = policy?.rules.find(r => r.name === "public fields");
      assert.deepStrictEqual(publicRule?.fields, ["publicInfo", "getUsers"]);
      
      const userRule = policy?.rules.find(r => r.name === "user access");
      assert.deepStrictEqual(userRule?.fields, ["userProfile"]);
      
      const editorRule = policy?.rules.find(r => r.name === "editor access");
      assert.deepStrictEqual(editorRule?.fields, ["contentManagement"]);
      
      const adminRule = policy?.rules.find(r => r.name === "admin access");
      assert.deepStrictEqual(adminRule?.fields, ["adminPanel", "systemConfig"]);
    });

    test("should handle empty field selections", () => {
      const fieldSelections = {};
      
      const policy = service.generatePolicyFromPattern("public-query-access", fieldSelections);
      
      assert.ok(policy);
      assert.strictEqual(policy?.rules.length, 1);
      assert.deepStrictEqual(policy?.rules[0].fields, []);
    });

    test("should return null for non-existent pattern", () => {
      const policy = service.generatePolicyFromPattern("non-existent", {});
      assert.strictEqual(policy, null);
    });

    test("should include policy default condition", () => {
      const fieldSelections = {
        "public access": ["publicInfo"]
      };
      
      const policy = service.generatePolicyFromPattern("public-query-access", fieldSelections);
      
      assert.ok(policy?.policyDefault);
      assert.strictEqual(policy?.policyDefault.condition, "false");
    });
  });

  suite("Legacy Template Compatibility", () => {
    test("should still support legacy templates", () => {
      const templates = service.getAllTemplates();
      assert.ok(templates.length > 0);
      
      const template = service.getTemplateById("public-query-access-legacy");
      assert.ok(template);
      
      const result = service.generatePolicyFromTemplate("public-query-access-legacy");
      assert.ok(result);
      assert.strictEqual(result?.generatedPolicy.type, "Query");
    });

    test("should generate multiple policies from templates", () => {
      const results = service.generatePoliciesFromTemplates([
        "public-query-access-legacy",
        "admin-mutations-legacy"
      ]);
      
      assert.strictEqual(results.length, 2);
      assert.strictEqual(results[0]?.generatedPolicy.type, "Query");
      assert.strictEqual(results[1]?.generatedPolicy.type, "Mutation");
    });
  });
}); 