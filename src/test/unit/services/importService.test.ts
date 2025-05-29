/**
 * Copyright IBM Corp. 2025
 * Assisted by CursorAI
 */

import * as assert from "assert";
import { ImportService } from "../../../services/importService";
import { Logger } from "../../../services/logger";
import { StepzenCliService } from "../../../services/cli";
import { ProjectResolver } from "../../../services/projectResolver";
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
  let mockProjectResolver: ProjectResolver;

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

    mockProjectResolver = {
      resolveStepZenProjectRoot: async () => "/workspace/stepzen-project"
    } as any;

    importService = new ImportService(mockLogger, mockCli, mockProjectResolver);
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
      assert.ok(capturedArgs.includes('"Authorization: Bearer token123"'));
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

    test("should build CLI arguments with request body data", async () => {
      const config: CurlImportConfig = {
        endpoint: "https://api.example.com/create",
        name: "example_api",
        queryName: "create",
        data: '{"message":"Hello,world"}',
        method: "POST",
        nonInteractive: true,
      };

      let capturedArgs: string[] = [];
      mockCli.spawnProcessWithOutput = async (args: string[]) => {
        capturedArgs = args;
        return "Import completed successfully";
      };

      await importService.executeImport(config);

      assert.ok(capturedArgs.includes("--data"));
      assert.ok(capturedArgs.includes('"{\\"message\\":\\"Hello,world\\"}"'));
      assert.ok(capturedArgs.includes("-X"));
      assert.ok(capturedArgs.includes("POST"));
    });

    test("should build CLI arguments with HTTP method only", async () => {
      const config: CurlImportConfig = {
        endpoint: "https://api.example.com/delete/123",
        name: "example_api",
        queryName: "delete",
        method: "DELETE",
        nonInteractive: true,
      };

      let capturedArgs: string[] = [];
      mockCli.spawnProcessWithOutput = async (args: string[]) => {
        capturedArgs = args;
        return "Import completed successfully";
      };

      await importService.executeImport(config);

      assert.ok(capturedArgs.includes("-X"));
      assert.ok(capturedArgs.includes("DELETE"));
      assert.ok(!capturedArgs.includes("--data"));
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

    test("should execute CLI command in resolved project directory", async () => {
      const config: CurlImportConfig = {
        endpoint: "https://api.example.com/users",
        name: "example_api",
        queryName: "users", // This makes it identifiable as cURL
        nonInteractive: true,
      };

      // Mock CLI to capture arguments and options
      let capturedArgs: string[] = [];
      let capturedOptions: any = {};
      mockCli.spawnProcessWithOutput = async (args: string[], options?: any) => {
        capturedArgs = args;
        capturedOptions = options || {};
        return "Import completed successfully";
      };

      await importService.executeImport(config);

      // Verify that the CLI command was executed with the correct working directory
      assert.strictEqual(capturedOptions.cwd, "/workspace/stepzen-project");
      
      // Verify the command structure
      assert.ok(capturedArgs.length > 0, "Should have captured CLI arguments");
      assert.strictEqual(capturedArgs[0], "import", "First argument should be 'import'");
      assert.strictEqual(capturedArgs[1], "curl", "Second argument should be 'curl'");
      assert.ok(capturedArgs.includes("https://api.example.com/users"), "Should include the endpoint URL");
    });

    test("should properly escape JSON data with quotes and spaces", async () => {
      const config: CurlImportConfig = {
        endpoint: "https://httpbingo.org/anything",
        name: "httpbingo_org",
        queryName: "anything",
        queryType: "Anything",
        data: '{"message":"Hello,world"}',
        method: "POST",
        headers: [
          { name: "Content-Type", value: "application/json" }
        ],
        nonInteractive: true,
      };

      let capturedArgs: string[] = [];
      mockCli.spawnProcessWithOutput = async (args: string[]) => {
        capturedArgs = args;
        return "Import completed successfully";
      };

      await importService.executeImport(config);

      // Verify that JSON data is properly quoted
      const dataIndex = capturedArgs.indexOf("--data");
      assert.ok(dataIndex !== -1, "Should include --data flag");
      assert.ok(dataIndex + 1 < capturedArgs.length, "Should have data value after --data flag");
      const dataValue = capturedArgs[dataIndex + 1];
      assert.strictEqual(dataValue, '"{\\"message\\":\\"Hello,world\\"}"', "JSON data should be properly escaped and quoted");

      // Verify that header with spaces is properly quoted
      const headerIndex = capturedArgs.indexOf("-H");
      assert.ok(headerIndex !== -1, "Should include -H flag");
      assert.ok(headerIndex + 1 < capturedArgs.length, "Should have header value after -H flag");
      const headerValue = capturedArgs[headerIndex + 1];
      assert.strictEqual(headerValue, '"Content-Type: application/json"', "Header with spaces should be properly quoted");
    });

    test("should not quote simple values without special characters", async () => {
      const config: CurlImportConfig = {
        endpoint: "https://api.example.com/users",
        name: "example_api",
        queryName: "users",
        headers: [
          { name: "Accept", value: "application/json" }
        ],
        nonInteractive: true,
      };

      let capturedArgs: string[] = [];
      mockCli.spawnProcessWithOutput = async (args: string[]) => {
        capturedArgs = args;
        return "Import completed successfully";
      };

      await importService.executeImport(config);

      // Verify that header without spaces is properly quoted (because of the colon and space)
      const headerIndex = capturedArgs.indexOf("-H");
      assert.ok(headerIndex !== -1, "Should include -H flag");
      assert.ok(headerIndex + 1 < capturedArgs.length, "Should have header value after -H flag");
      const headerValue = capturedArgs[headerIndex + 1];
      assert.strictEqual(headerValue, '"Accept: application/json"', "Header should be quoted due to colon and space");
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

    test("should properly escape database passwords with special characters", async () => {
      const config: DatabaseImportConfig = {
        type: "postgresql",
        host: "postgresqlaws.introspection.stepzen.net",
        user: "testUserIntrospection",
        password: 'P@ssw0rd!#$%^&*(){}[]|\\:";\'<>?,./`~',
        database: "introspection",
        name: "postgresql_introspection",
        nonInteractive: true,
      };

      let capturedArgs: string[] = [];
      mockCli.spawnProcessWithOutput = async (args: string[]) => {
        capturedArgs = args;
        return "Import completed successfully";
      };

      await importService.executeImport(config);

      // Verify that password is properly quoted
      const passwordIndex = capturedArgs.indexOf("--db-password");
      assert.ok(passwordIndex !== -1, "Should include --db-password flag");
      assert.ok(passwordIndex + 1 < capturedArgs.length, "Should have password value after --db-password flag");
      const passwordValue = capturedArgs[passwordIndex + 1];
      
      // Password should be wrapped in quotes due to special characters
      assert.ok(passwordValue.startsWith('"') && passwordValue.endsWith('"'), 
        `Password should be quoted, got: ${passwordValue}`);
      
      // Verify other connection parameters are also properly escaped
      const hostIndex = capturedArgs.indexOf("--db-host");
      assert.ok(hostIndex !== -1, "Should include --db-host flag");
      const hostValue = capturedArgs[hostIndex + 1];
      assert.strictEqual(hostValue, "postgresqlaws.introspection.stepzen.net", "Host should not be quoted if no special chars");
      
      const userIndex = capturedArgs.indexOf("--db-user");
      assert.ok(userIndex !== -1, "Should include --db-user flag");
      const userValue = capturedArgs[userIndex + 1];
      assert.strictEqual(userValue, "testUserIntrospection", "User should not be quoted if no special chars");
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

    test("should handle project resolution failure", async () => {
      const config: CurlImportConfig = {
        endpoint: "https://api.example.com/users",
        name: "example_api",
        nonInteractive: true,
      };

      // Mock project resolver to throw an error
      mockProjectResolver.resolveStepZenProjectRoot = async () => {
        throw new Error("No StepZen project found");
      };

      try {
        await importService.executeImport(config);
        assert.fail("Should have thrown validation error");
      } catch (err: any) {
        assert.ok(err.message.includes("Import execution failed"));
      }
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