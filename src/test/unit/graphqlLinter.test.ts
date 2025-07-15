/**
 * Copyright IBM Corp. 2025
 * Assisted by CursorAI
 */

import * as assert from "assert";
import * as vscode from "vscode";
import { GraphQLLinterService } from "../../services/graphqlLinter";
import { overrideServices, resetServices } from "../../services";
import { parse } from "graphql";

suite("GraphQL Linter Test Suite", () => {
  let linter: GraphQLLinterService;
  let mockLogger: any;
  let originalLogger: any;

  suiteSetup(() => {
    // Save original logger before overriding
    originalLogger = require("../../services").services.logger;
    // Create mock logger
    mockLogger = {
      info: () => {},
      debug: () => {},
      warn: () => {},
      error: () => {},
    };

    // Override services with mocks
    overrideServices({
      logger: mockLogger,
    });

    linter = new GraphQLLinterService();
  });

  suiteTeardown(() => {
    linter.dispose();
    // Restore the original logger
    resetServices({ logger: originalLogger });
  });

  test("should initialize GraphQL linter service", async () => {
    await linter.initialize();
    assert.ok(
      linter.getDiagnosticCollection(),
      "Diagnostic collection should be created",
    );
  });

  test("should create diagnostic collection with correct name", () => {
    const collection = linter.getDiagnosticCollection();
    assert.strictEqual(
      collection.name,
      "stepzen-graphql-lint",
      "Diagnostic collection should have correct name",
    );
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

  // Test individual linting rules
  test("should detect anonymous operations", async () => {
    await linter.initialize();

    const content = `
      query {
        user {
          id
          name
        }
      }
    `;

    const ast = parse(content);
    const rules = (linter as any).rules;
    const anonymousRule = rules.find(
      (r: any) => r.name === "no-anonymous-operations",
    );

    assert.ok(anonymousRule, "Anonymous operations rule should exist");

    const issues = anonymousRule.check(ast);
    assert.strictEqual(
      issues.length,
      1,
      "Should detect one anonymous operation",
    );
    assert.strictEqual(
      issues[0].message,
      "Anonymous operations are not allowed. Please provide a name for this operation.",
    );
    assert.strictEqual(issues[0].severity, "error");
  });

  test("should allow named operations", async () => {
    await linter.initialize();

    const content = `
      query GetUser {
        user {
          id
          name
        }
      }
    `;

    const ast = parse(content);
    const rules = (linter as any).rules;
    const anonymousRule = rules.find(
      (r: any) => r.name === "no-anonymous-operations",
    );

    const issues = anonymousRule.check(ast);
    assert.strictEqual(
      issues.length,
      0,
      "Should not detect issues with named operations",
    );
  });

  test("should detect duplicate fields", async () => {
    await linter.initialize();

    const content = `
      type User {
        id: ID!
        name: String!
        name: String! # Duplicate field
      }
    `;

    const ast = parse(content);
    const rules = (linter as any).rules;
    const duplicateRule = rules.find(
      (r: any) => r.name === "no-duplicate-fields",
    );

    assert.ok(duplicateRule, "Duplicate fields rule should exist");

    const issues = duplicateRule.check(ast);
    // Should detect at least one duplicate field issue
    assert.ok(
      issues.length >= 1,
      `Should detect at least one duplicate field, got ${issues.length}`,
    );
    assert.ok(
      issues.some((d: any) =>
        d.message.includes("Duplicate field 'name' found in type 'User'"),
      ),
    );
    assert.strictEqual(issues[0].severity, "error");
  });

  test("should detect missing descriptions", async () => {
    await linter.initialize();

    const content = `
      type User {
        id: ID!
        name: String!
      }
    `;

    const ast = parse(content);
    const rules = (linter as any).rules;
    const descriptionRule = rules.find(
      (r: any) => r.name === "require-description",
    );

    assert.ok(descriptionRule, "Require description rule should exist");

    const issues = descriptionRule.check(ast);
    // Should detect at least two missing descriptions (type and at least one field)
    assert.ok(
      issues.length >= 2,
      `Should detect at least two missing descriptions, got ${issues.length}`,
    );
    assert.ok(
      issues.some((d: any) =>
        d.message.includes("Type 'User' should have a description"),
      ),
    );
    assert.ok(
      issues.some((d: any) =>
        d.message.includes(
          "Field 'id' in type 'User' should have a description",
        ),
      ),
    );
    assert.strictEqual(issues[0].severity, "warn");
  });

  test("should allow descriptions", async () => {
    await linter.initialize();

    const content = `
      """A user in the system"""
      type User {
        """Unique identifier"""
        id: ID!
        """User's full name"""
        name: String!
      }
    `;

    const ast = parse(content);
    const rules = (linter as any).rules;
    const descriptionRule = rules.find(
      (r: any) => r.name === "require-description",
    );

    const issues = descriptionRule.check(ast);
    assert.strictEqual(
      issues.length,
      0,
      "Should not detect issues with proper descriptions",
    );
  });

  test("should detect deprecated fields without reason", async () => {
    await linter.initialize();

    const content = `
      type User {
        id: ID!
        @deprecated
        oldField: String!
      }
    `;

    const ast = parse(content);
    const rules = (linter as any).rules;
    const deprecatedRule = rules.find(
      (r: any) => r.name === "require-deprecation-reason",
    );

    assert.ok(deprecatedRule, "Require deprecation reason rule should exist");

    const issues = deprecatedRule.check(ast);
    assert.strictEqual(
      issues.length,
      1,
      "Should detect deprecated field without reason",
    );
    assert.strictEqual(
      issues[0].message,
      "Deprecated fields should include a reason",
    );
    assert.strictEqual(issues[0].severity, "warn");
  });

  test("should allow deprecated fields with reason", async () => {
    await linter.initialize();

    const content = `
      type User {
        id: ID!
        @deprecated(reason: "Use newField instead")
        oldField: String!
      }
    `;

    const ast = parse(content);
    const rules = (linter as any).rules;
    const deprecatedRule = rules.find(
      (r: any) => r.name === "require-deprecation-reason",
    );

    const issues = deprecatedRule.check(ast);
    assert.strictEqual(
      issues.length,
      0,
      "Should not detect issues with deprecated fields that have reasons",
    );
  });

  test("should detect non-camelCase field names", async () => {
    await linter.initialize();

    const content = `
      type User {
        id: ID!
        first_name: String! # snake_case
        LastName: String!   # PascalCase
        email: String!      # camelCase - should be fine
      }
    `;

    const ast = parse(content);
    const rules = (linter as any).rules;
    const namingRule = rules.find(
      (r: any) => r.name === "field-naming-convention",
    );

    assert.ok(namingRule, "Field naming convention rule should exist");

    const issues = namingRule.check(ast);
    assert.strictEqual(
      issues.length,
      2,
      "Should detect non-camelCase field names",
    );
    assert.ok(
      issues.some((d: any) =>
        d.message.includes(
          "Field 'first_name' should use camelCase naming convention",
        ),
      ),
    );
    assert.ok(
      issues.some((d: any) =>
        d.message.includes(
          "Field 'LastName' should use camelCase naming convention",
        ),
      ),
    );
    assert.strictEqual(issues[0].severity, "warn");
  });

  test("should allow camelCase field names", async () => {
    await linter.initialize();

    const content = `
      type User {
        id: ID!
        firstName: String!
        lastName: String!
        emailAddress: String!
      }
    `;

    const ast = parse(content);
    const rules = (linter as any).rules;
    const namingRule = rules.find(
      (r: any) => r.name === "field-naming-convention",
    );

    const issues = namingRule.check(ast);
    assert.strictEqual(
      issues.length,
      0,
      "Should not detect issues with camelCase field names",
    );
  });

  test("should ignore special fields like __typename", async () => {
    await linter.initialize();

    const content = `
      type User {
        id: ID!
        __typename: String! # Special field - should be ignored
      }
    `;

    const ast = parse(content);
    const rules = (linter as any).rules;
    const namingRule = rules.find(
      (r: any) => r.name === "field-naming-convention",
    );

    const issues = namingRule.check(ast);
    assert.strictEqual(
      issues.length,
      0,
      "Should not detect issues with special fields like __typename",
    );
  });

  test("should detect non-nullable fields in root types", async () => {
    await linter.initialize();

    const content = `
      type Query {
        user(id: ID!): User! # Non-nullable return type
        users: [User!]!      # Non-nullable list
      }
    `;

    const ast = parse(content);
    const rules = (linter as any).rules;
    const nullableRule = rules.find(
      (r: any) => r.name === "root-fields-nullable",
    );

    assert.ok(nullableRule, "Root fields nullable rule should exist");

    const issues = nullableRule.check(ast);
    assert.strictEqual(
      issues.length,
      2,
      "Should detect non-nullable fields in root types",
    );
    assert.ok(
      issues.some((d: any) =>
        d.message.includes(
          "Field 'user' in root type 'Query' should be nullable",
        ),
      ),
    );
    assert.ok(
      issues.some((d: any) =>
        d.message.includes(
          "Field 'users' in root type 'Query' should be nullable",
        ),
      ),
    );
    assert.strictEqual(issues[0].severity, "warn");
  });

  test("should allow nullable fields in root types", async () => {
    await linter.initialize();

    const content = `
      type Query {
        user(id: ID!): User  # Nullable return type
        users: [User]        # Nullable list
      }
    `;

    const ast = parse(content);
    const rules = (linter as any).rules;
    const nullableRule = rules.find(
      (r: any) => r.name === "root-fields-nullable",
    );

    const issues = nullableRule.check(ast);
    assert.strictEqual(
      issues.length,
      0,
      "Should not detect issues with nullable fields in root types",
    );
  });

  test("should not check non-root types for nullability", async () => {
    await linter.initialize();

    const content = `
      type User {
        id: ID!              # Non-nullable in regular type - should be fine
        name: String!        # Non-nullable in regular type - should be fine
      }
    `;

    const ast = parse(content);
    const rules = (linter as any).rules;
    const nullableRule = rules.find(
      (r: any) => r.name === "root-fields-nullable",
    );

    const issues = nullableRule.check(ast);
    assert.strictEqual(
      issues.length,
      0,
      "Should not check nullability for non-root types",
    );
  });

  test("should handle GraphQL parse errors gracefully", async () => {
    await linter.initialize();

    const content = `
      type User {
        id: ID!
        name: String! # Missing closing brace
    `;

    try {
      parse(content);
      assert.fail("Should have thrown a parse error");
    } catch (parseError) {
      assert.ok(parseError instanceof Error, "Should throw a parse error");
    }
  });

  test("should handle non-existent files gracefully", async () => {
    await linter.initialize();
    const diagnostics = await linter.lintFile("/non/existent/file.graphql");
    assert.strictEqual(
      diagnostics.length,
      0,
      "Should return empty array for non-existent files",
    );
  });

  test("should respect configuration changes", async () => {
    // Test with anonymous operations rule disabled
    const originalGetConfiguration = vscode.workspace.getConfiguration;
    vscode.workspace.getConfiguration = (section?: string) => {
      if (section === "stepzen") {
        return {
          get: (key: string, defaultValue: any) => {
            if (key === "graphqlLintRules") {
              return {
                "no-anonymous-operations": false, // Disabled
                "no-duplicate-fields": true,
                "require-description": true,
                "require-deprecation-reason": true,
                "field-naming-convention": true,
                "root-fields-nullable": true,
              };
            }
            return defaultValue;
          },
        } as any;
      }
      return originalGetConfiguration(section);
    };

    try {
      // Reinitialize with new configuration
      await linter.initialize();

      const rules = (linter as any).rules;
      const anonymousRule = rules.find(
        (r: any) => r.name === "no-anonymous-operations",
      );

      // Rule should not exist when disabled
      assert.strictEqual(
        anonymousRule,
        undefined,
        "Anonymous operations rule should not exist when disabled",
      );
    } finally {
      // Restore original method
      vscode.workspace.getConfiguration = originalGetConfiguration;
    }
  });

  test("should handle all rules disabled", async () => {
    const originalGetConfiguration = vscode.workspace.getConfiguration;
    vscode.workspace.getConfiguration = (section?: string) => {
      if (section === "stepzen") {
        return {
          get: (key: string, defaultValue: any) => {
            if (key === "graphqlLintRules") {
              return {
                "no-anonymous-operations": false,
                "no-duplicate-fields": false,
                "require-description": false,
                "require-deprecation-reason": false,
                "field-naming-convention": false,
                "root-fields-nullable": false,
                "connection-structure": false,
                "edge-structure": false,
                "connection-arguments": false,
                "pagination-argument-types": false,
              };
            }
            return defaultValue;
          },
        } as any;
      }
      return originalGetConfiguration(section);
    };

    try {
      await linter.initialize();

      const rules = (linter as any).rules;

      assert.strictEqual(
        rules.length,
        0,
        "Should not have any rules when all are disabled",
      );
    } finally {
      vscode.workspace.getConfiguration = originalGetConfiguration;
    }
  });

  // Helper function for pagination tests
  async function withPaginationRules(
    testFn: () => Promise<void>,
  ): Promise<void> {
    const originalGetConfiguration = vscode.workspace.getConfiguration;
    vscode.workspace.getConfiguration = (section?: string) => {
      if (section === "stepzen") {
        return {
          get: (key: string, defaultValue: any) => {
            if (key === "graphqlLintRules") {
              return {
                "no-anonymous-operations": false,
                "no-duplicate-fields": false,
                "require-description": false,
                "require-deprecation-reason": false,
                "field-naming-convention": false,
                "root-fields-nullable": false,
                "connection-structure": true,
                "edge-structure": true,
                "connection-arguments": true,
                "pagination-argument-types": true,
              };
            }
            return defaultValue;
          },
        } as any;
      }
      return originalGetConfiguration(section);
    };

    try {
      await testFn();
    } finally {
      vscode.workspace.getConfiguration = originalGetConfiguration;
    }
  }

  // Pagination rule tests
  test("should detect Connection types missing edges field", async () => {
    await withPaginationRules(async () => {
      await linter.initialize();

      const content = `
        type UserConnection {
          pageInfo: PageInfo!
        }
      `;

      const ast = parse(content);
      const rules = (linter as any).rules;
      const connectionRule = rules.find(
        (r: any) => r.name === "connection-structure",
      );

      assert.ok(connectionRule, "Connection structure rule should exist");

      const issues = connectionRule.check(ast);
      assert.ok(issues.length >= 1, "Should detect missing edges field");
      assert.ok(
        issues.some((d: any) =>
          d.message.includes("must have an 'edges' field"),
        ),
      );
      assert.strictEqual(issues[0].severity, "error");
    });
  });

  test("should detect Connection types missing pageInfo field", async () => {
    await withPaginationRules(async () => {
      await linter.initialize();

      const content = `
        type UserConnection {
          edges: [UserEdge!]!
        }
      `;

      const ast = parse(content);
      const rules = (linter as any).rules;
      const connectionRule = rules.find(
        (r: any) => r.name === "connection-structure",
      );

      const issues = connectionRule.check(ast);
      assert.ok(issues.length >= 1, "Should detect missing pageInfo field");
      assert.ok(
        issues.some((d: any) =>
          d.message.includes("must have a 'pageInfo' field"),
        ),
      );
      assert.strictEqual(issues[0].severity, "error");
    });
  });

  test("should allow valid Connection types", async () => {
    await withPaginationRules(async () => {
      await linter.initialize();

      const content = `
        type UserConnection {
          edges: [UserEdge!]!
          pageInfo: PageInfo!
        }
      `;

      const ast = parse(content);
      const rules = (linter as any).rules;
      const connectionRule = rules.find(
        (r: any) => r.name === "connection-structure",
      );

      const issues = connectionRule.check(ast);
      assert.strictEqual(
        issues.length,
        0,
        "Should not detect issues with valid Connection type",
      );
    });
  });

  test("should detect Edge types missing node field", async () => {
    await withPaginationRules(async () => {
      await linter.initialize();

      const content = `
        type UserEdge {
          cursor: String!
        }
      `;

      const ast = parse(content);
      const rules = (linter as any).rules;
      const edgeRule = rules.find((r: any) => r.name === "edge-structure");

      assert.ok(edgeRule, "Edge structure rule should exist");

      const issues = edgeRule.check(ast);
      assert.ok(issues.length >= 1, "Should detect missing node field");
      assert.ok(
        issues.some((d: any) => d.message.includes("must have a 'node' field")),
      );
      assert.strictEqual(issues[0].severity, "error");
    });
  });

  test("should detect Edge types missing cursor field", async () => {
    await withPaginationRules(async () => {
      await linter.initialize();

      const content = `
        type UserEdge {
          node: User!
        }
      `;

      const ast = parse(content);
      const rules = (linter as any).rules;
      const edgeRule = rules.find((r: any) => r.name === "edge-structure");

      const issues = edgeRule.check(ast);
      assert.ok(issues.length >= 1, "Should detect missing cursor field");
      assert.ok(
        issues.some((d: any) =>
          d.message.includes("must have a 'cursor' field"),
        ),
      );
      assert.strictEqual(issues[0].severity, "error");
    });
  });

  test("should allow valid Edge types", async () => {
    await withPaginationRules(async () => {
      await linter.initialize();

      const content = `
        type UserEdge {
          node: User!
          cursor: String!
        }
      `;

      const ast = parse(content);
      const rules = (linter as any).rules;
      const edgeRule = rules.find((r: any) => r.name === "edge-structure");

      const issues = edgeRule.check(ast);
      assert.strictEqual(
        issues.length,
        0,
        "Should not detect issues with valid Edge type",
      );
    });
  });

  test("should detect Connection fields missing first argument", async () => {
    await withPaginationRules(async () => {
      await linter.initialize();

      const content = `
        type Query {
          users(after: String): UserConnection!
        }
      `;

      const ast = parse(content);
      const rules = (linter as any).rules;
      const connectionArgsRule = rules.find(
        (r: any) => r.name === "connection-arguments",
      );

      assert.ok(connectionArgsRule, "Connection arguments rule should exist");

      const issues = connectionArgsRule.check(ast);
      assert.ok(issues.length >= 1, "Should detect missing first argument");
      assert.ok(
        issues.some((d: any) =>
          d.message.includes("should accept 'first' argument"),
        ),
      );
      assert.strictEqual(issues[0].severity, "warn");
    });
  });

  test("should detect Connection fields missing after argument", async () => {
    await withPaginationRules(async () => {
      await linter.initialize();

      const content = `
        type Query {
          users(first: Int!): UserConnection!
        }
      `;

      const ast = parse(content);
      const rules = (linter as any).rules;
      const connectionArgsRule = rules.find(
        (r: any) => r.name === "connection-arguments",
      );

      const issues = connectionArgsRule.check(ast);
      assert.ok(issues.length >= 1, "Should detect missing after argument");
      assert.ok(
        issues.some((d: any) =>
          d.message.includes("should accept 'after' argument"),
        ),
      );
      assert.strictEqual(issues[0].severity, "warn");
    });
  });

  test("should allow Connection fields with proper arguments", async () => {
    await withPaginationRules(async () => {
      await linter.initialize();

      const content = `
        type Query {
          users(first: Int!, after: String): UserConnection!
        }
      `;

      const ast = parse(content);
      const rules = (linter as any).rules;
      const connectionArgsRule = rules.find(
        (r: any) => r.name === "connection-arguments",
      );

      const issues = connectionArgsRule.check(ast);
      assert.strictEqual(
        issues.length,
        0,
        "Should not detect issues with proper pagination arguments",
      );
    });
  });

  test("should detect incorrect first argument type", async () => {
    await withPaginationRules(async () => {
      await linter.initialize();

      const content = `
        type Query {
          users(first: String, after: String): UserConnection!
        }
      `;

      const ast = parse(content);
      const rules = (linter as any).rules;
      const paginationTypesRule = rules.find(
        (r: any) => r.name === "pagination-argument-types",
      );

      assert.ok(
        paginationTypesRule,
        "Pagination argument types rule should exist",
      );

      const issues = paginationTypesRule.check(ast);
      assert.ok(
        issues.length >= 1,
        "Should detect incorrect first argument type",
      );
      assert.ok(
        issues.some((d: any) =>
          d.message.includes("'first' argument should be of type 'Int!'"),
        ),
      );
      assert.strictEqual(issues[0].severity, "error");
    });
  });

  test("should detect incorrect after argument type", async () => {
    await withPaginationRules(async () => {
      await linter.initialize();

      const content = `
        type Query {
          users(first: Int, after: Int): UserConnection!
        }
      `;

      const ast = parse(content);
      const rules = (linter as any).rules;
      const paginationTypesRule = rules.find(
        (r: any) => r.name === "pagination-argument-types",
      );

      const issues = paginationTypesRule.check(ast);
      assert.ok(
        issues.length >= 1,
        "Should detect incorrect after argument type",
      );
      assert.ok(
        issues.some((d: any) =>
          d.message.includes("'after' argument should be of type 'String'"),
        ),
      );
      assert.strictEqual(issues[0].severity, "error");
    });
  });

  test("should detect nullable first argument type", async () => {
    await withPaginationRules(async () => {
      await linter.initialize();

      const content = `
        type Query {
          users(first: Int, after: String): UserConnection!
        }
      `;

      const ast = parse(content);
      const rules = (linter as any).rules;
      const paginationTypesRule = rules.find(
        (r: any) => r.name === "pagination-argument-types",
      );

      assert.ok(
        paginationTypesRule,
        "Pagination argument types rule should exist",
      );

      const issues = paginationTypesRule.check(ast);
      assert.ok(
        issues.length >= 1,
        "Should detect nullable first argument type",
      );
      assert.ok(
        issues.some((d: any) =>
          d.message.includes("'first' argument should be of type 'Int!'"),
        ),
      );
      assert.strictEqual(issues[0].severity, "error");
    });
  });

  test("should allow correct pagination argument types", async () => {
    await withPaginationRules(async () => {
      await linter.initialize();

      const content = `
        type Query {
          users(first: Int!, after: String): UserConnection!
        }
      `;

      const ast = parse(content);
      const rules = (linter as any).rules;
      const paginationTypesRule = rules.find(
        (r: any) => r.name === "pagination-argument-types",
      );

      const issues = paginationTypesRule.check(ast);
      assert.strictEqual(
        issues.length,
        0,
        "Should not detect issues with correct pagination argument types",
      );
    });
  });

  test("should not check non-Connection fields for pagination arguments", async () => {
    await withPaginationRules(async () => {
      await linter.initialize();

      const content = `
        type Query {
          user(id: ID!): User!
        }
      `;

      const ast = parse(content);
      const rules = (linter as any).rules;
      const connectionArgsRule = rules.find(
        (r: any) => r.name === "connection-arguments",
      );

      const issues = connectionArgsRule.check(ast);
      assert.strictEqual(
        issues.length,
        0,
        "Should not check non-Connection fields for pagination arguments",
      );
    });
  });
});
