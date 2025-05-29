/**
 * Copyright IBM Corp. 2025
 * Assisted by CursorAI
 */

import * as assert from "assert";
import { ImportService } from "../../../services/importService";
import { Logger } from "../../../services/logger";
import { StepzenCliService } from "../../../services/cli";
import { 
  CurlImportConfig, 
  OpenApiImportConfig, 
  GraphQLImportConfig, 
  DatabaseImportConfig 
} from "../../../types/import";

suite("ImportService", () => {
  let importService: ImportService;
  let mockLogger: Logger;
  let mockCli: StepzenCliService;

  setup(() => {
    mockLogger = {
      info: () => {},
      debug: () => {},
      warn: () => {},
      error: () => {},
    } as any;

    mockCli = {
      spawnProcessWithOutput: async () => "Import completed successfully"
    } as any;

    importService = new ImportService(mockLogger, mockCli);
  });

  suite("cURL Import", () => {
    test("should build correct CLI arguments for basic cURL import", async () => {
      const config: CurlImportConfig = {
        endpoint: "https://api.example.com/users",
        name: "example_api",
        queryName: "users",
        nonInteractive: true,
      };

      // Mock CLI to capture arguments
      let capturedArgs: string[] = [];
      mockCli.spawnProcessWithOutput = async (args: string[]) => {
        capturedArgs = args;
        return "Import completed successfully";
      };

      await importService.executeImport(config);

      assert.deepStrictEqual(capturedArgs, [
        "import", "curl",
        "https://api.example.com/users",
        "--name", "example_api",
        "--non-interactive",
        "--query-name", "users"
      ]);
    });

    test("should build CLI arguments with headers and secrets", async () => {
      const config: CurlImportConfig = {
        endpoint: "https://api.example.com/users",
        name: "example_api",
        headers: [
          { name: "Authorization", value: "Bearer token123" },
          { name: "Content-Type", value: "application/json" }
        ],
        secrets: ["Authorization"],
        nonInteractive: true,
      };

      let capturedArgs: string[] = [];
      mockCli.spawnProcessWithOutput = async (args: string[]) => {
        capturedArgs = args;
        return "Import completed successfully";
      };

      await importService.executeImport(config);

      assert.ok(capturedArgs.includes("-H"));
      assert.ok(capturedArgs.includes("Authorization: Bearer token123"));
      assert.ok(capturedArgs.includes("--secrets"));
      assert.ok(capturedArgs.includes("Authorization"));
    });

    test("should build CLI arguments with path parameters", async () => {
      const config: CurlImportConfig = {
        endpoint: "https://api.example.com/users/123",
        pathParams: "/users/$userId",
        name: "example_api",
        nonInteractive: true,
      };

      let capturedArgs: string[] = [];
      mockCli.spawnProcessWithOutput = async (args: string[]) => {
        capturedArgs = args;
        return "Import completed successfully";
      };

      await importService.executeImport(config);

      assert.ok(capturedArgs.includes("--path-params"));
      assert.ok(capturedArgs.includes("/users/$userId"));
    });

    test("should validate cURL configuration", async () => {
      const invalidConfig = {
        endpoint: "", // Empty endpoint should fail validation
        name: "test",
        queryName: "test", // This makes it identifiable as cURL
      } as CurlImportConfig;

      try {
        await importService.executeImport(invalidConfig);
        assert.fail("Should have thrown validation error");
      } catch (err: any) {
        assert.ok(err.message.includes("Invalid import configuration"));
      }
    });
  });

  suite("OpenAPI Import", () => {
    test("should build correct CLI arguments for OpenAPI import", async () => {
      const config: OpenApiImportConfig = {
        spec: "./openapi.yaml",
        name: "petstore_api",
        nonInteractive: true,
      };

      let capturedArgs: string[] = [];
      mockCli.spawnProcessWithOutput = async (args: string[]) => {
        capturedArgs = args;
        return "Import completed successfully";
      };

      await importService.executeImport(config);

      assert.deepStrictEqual(capturedArgs, [
        "import", "openapi",
        "./openapi.yaml",
        "--name", "petstore_api",
        "--non-interactive"
      ]);
    });

    test("should validate OpenAPI configuration", async () => {
      const invalidConfig = {
        spec: "", // Empty spec should fail validation
        name: "test",
      } as OpenApiImportConfig;

      try {
        await importService.executeImport(invalidConfig);
        assert.fail("Should have thrown validation error");
      } catch (err: any) {
        assert.ok(err.message.includes("Invalid import configuration"));
      }
    });
  });

  suite("GraphQL Import", () => {
    test("should build correct CLI arguments for GraphQL import", async () => {
      const config: GraphQLImportConfig = {
        endpoint: "https://api.github.com/graphql",
        name: "github_api",
        prefix: "GitHub",
        headers: [{ name: "Authorization", value: "Bearer token" }],
        secrets: ["Authorization"],
        nonInteractive: true,
      };

      let capturedArgs: string[] = [];
      mockCli.spawnProcessWithOutput = async (args: string[]) => {
        capturedArgs = args;
        return "Import completed successfully";
      };

      await importService.executeImport(config);

      assert.ok(capturedArgs.includes("import"));
      assert.ok(capturedArgs.includes("graphql"));
      assert.ok(capturedArgs.includes("https://api.github.com/graphql"));
      assert.ok(capturedArgs.includes("--prefix"));
      assert.ok(capturedArgs.includes("GitHub"));
    });
  });

  suite("Database Import", () => {
    test("should build correct CLI arguments for PostgreSQL import", async () => {
      const config: DatabaseImportConfig = {
        type: "postgresql",
        connectionString: "postgresql://user:pass@localhost:5432/db",
        name: "postgres_db",
        linkTypes: true,
        include: "tables-only",
        nonInteractive: true,
      };

      let capturedArgs: string[] = [];
      mockCli.spawnProcessWithOutput = async (args: string[]) => {
        capturedArgs = args;
        return "Import completed successfully";
      };

      await importService.executeImport(config);

      assert.ok(capturedArgs.includes("import"));
      assert.ok(capturedArgs.includes("postgresql"));
      assert.ok(capturedArgs.includes("postgresql://user:pass@localhost:5432/db"));
      assert.ok(capturedArgs.includes("--db-link-types"));
      assert.ok(capturedArgs.includes("--db-include"));
      assert.ok(capturedArgs.includes("tables-only"));
    });

    test("should build CLI arguments with individual connection parameters", async () => {
      const config: DatabaseImportConfig = {
        type: "mysql",
        host: "localhost:3306",
        user: "root",
        password: "secret",
        database: "mydb",
        schema: "public",
        name: "mysql_db",
        nonInteractive: true,
      };

      let capturedArgs: string[] = [];
      mockCli.spawnProcessWithOutput = async (args: string[]) => {
        capturedArgs = args;
        return "Import completed successfully";
      };

      await importService.executeImport(config);

      assert.ok(capturedArgs.includes("--db-host"));
      assert.ok(capturedArgs.includes("localhost:3306"));
      assert.ok(capturedArgs.includes("--db-user"));
      assert.ok(capturedArgs.includes("root"));
      assert.ok(capturedArgs.includes("--db-password"));
      assert.ok(capturedArgs.includes("secret"));
    });

    test("should handle Snowflake-specific options", async () => {
      const config: DatabaseImportConfig = {
        type: "snowflake",
        connectionString: "snowflake://user:pass@account/db",
        name: "snowflake_db",
        specificOptions: {
          accountId: "myorg-myaccount",
          warehouse: "COMPUTE_WH"
        },
        nonInteractive: true,
      };

      let capturedArgs: string[] = [];
      mockCli.spawnProcessWithOutput = async (args: string[]) => {
        capturedArgs = args;
        return "Import completed successfully";
      };

      await importService.executeImport(config);

      assert.ok(capturedArgs.includes("--snowflake-account-id"));
      assert.ok(capturedArgs.includes("myorg-myaccount"));
      assert.ok(capturedArgs.includes("--snowflake-warehouse"));
      assert.ok(capturedArgs.includes("COMPUTE_WH"));
    });
  });

  suite("Error Handling", () => {
    test("should handle CLI execution failure", async () => {
      const config: CurlImportConfig = {
        endpoint: "https://api.example.com/users",
        name: "example_api",
        nonInteractive: true,
      };

      mockCli.spawnProcessWithOutput = async () => {
        throw new Error("Network error");
      };

      const result = await importService.executeImport(config);

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, "Network error");
    });

    test("should handle unknown import type", async () => {
      const invalidConfig = {
        unknownField: "value"
      } as any;

      try {
        await importService.executeImport(invalidConfig);
        assert.fail("Should have thrown validation error");
      } catch (err: any) {
        assert.ok(err.message.includes("Unable to determine import type"));
      }
    });
  });

  suite("Import Type Detection", () => {
    test("should detect cURL import type", async () => {
      const config: CurlImportConfig = {
        endpoint: "https://api.example.com",
        pathParams: "/users/$id", // This makes it cURL
        nonInteractive: true,
      };

      // Should not throw
      await importService.executeImport(config);
    });

    test("should detect OpenAPI import type", async () => {
      const config: OpenApiImportConfig = {
        spec: "./openapi.yaml", // This makes it OpenAPI
        nonInteractive: true,
      };

      // Should not throw
      await importService.executeImport(config);
    });

    test("should detect GraphQL import type", async () => {
      const config: GraphQLImportConfig = {
        endpoint: "https://api.github.com/graphql", // endpoint without pathParams makes it GraphQL
        nonInteractive: true,
      };

      // Should not throw
      await importService.executeImport(config);
    });

    test("should detect database import type", async () => {
      const config: DatabaseImportConfig = {
        type: "postgresql", // This makes it database
        connectionString: "postgresql://localhost/db",
        nonInteractive: true,
      };

      // Should not throw
      await importService.executeImport(config);
    });
  });
}); 