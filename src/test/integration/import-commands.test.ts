/**
 * Copyright IBM Corp. 2025
 * Assisted by CursorAI
 */

import * as assert from "assert";
import { services } from "../../services";
import { ImportService } from "../../services/importService";
import { CurlImportConfig } from "../../types/import";

suite("Import Commands Integration", () => {
  suite("Project Resolution Integration", () => {
    test("ImportService should use ProjectResolver to determine working directory", async () => {
      // This test verifies that the ImportService properly integrates with
      // the ProjectResolver to execute CLI commands in the correct directory
      
      const mockProjectRoot = "/workspace/my-stepzen-project";
      let capturedCwd: string | undefined;
      let projectResolverCalled = false;
      
      // Mock the CLI service to capture the working directory
      const mockCli = {
        spawnProcessWithOutput: async (_args: string[], options?: any) => {
          capturedCwd = options?.cwd;
          return "Import completed successfully";
        },
        deploy: async () => {},
        request: async () => "{}",
        getApiKey: async () => "test-key",
        getAccount: async () => "test-account",
        getDomain: async () => "test-domain"
      } as any;
      
      // Mock the project resolver to return a specific project root
      const mockProjectResolver = {
        resolveStepZenProjectRoot: async () => {
          projectResolverCalled = true;
          return mockProjectRoot;
        },
        clearCache: () => {},
        getCachedProjectRoot: () => null
      } as any;
      
      // Create a new ImportService instance with mocked dependencies
      const importService = new ImportService(services.logger, mockCli, mockProjectResolver);
      
      // Execute an import command
      const config: CurlImportConfig = {
        endpoint: "https://api.example.com/test",
        name: "test_api",
        queryName: "test",
        nonInteractive: true,
      };
      
      const result = await importService.executeImport(config);
      
      // Verify the import was successful
      assert.strictEqual(result.success, true);
      
      // Verify that the CLI command was executed with the correct working directory
      assert.strictEqual(capturedCwd, mockProjectRoot);
      
      // Verify that the project resolver was called
      assert.ok(projectResolverCalled, "Project resolver should have been called");
    });
    
    test("ImportService should handle project resolution errors gracefully", async () => {
      // This test verifies that project resolution errors are properly handled
      
      const projectResolutionError = new Error("No StepZen project found");
      
      // Mock the project resolver to throw an error
      const mockProjectResolver = {
        resolveStepZenProjectRoot: async () => {
          throw projectResolutionError;
        },
        clearCache: () => {},
        getCachedProjectRoot: () => null
      } as any;
      
      // Create a new ImportService instance with mocked dependencies
      const importService = new ImportService(services.logger, services.cli, mockProjectResolver);
      
      // Execute an import command
      const config: CurlImportConfig = {
        endpoint: "https://api.example.com/test",
        name: "test_api",
        queryName: "test",
        nonInteractive: true,
      };
      
      // The import should fail with a validation error
      try {
        await importService.executeImport(config);
        assert.fail("Expected import to throw an error");
      } catch (err: any) {
        assert.ok(err.message.includes("Import execution failed"));
      }
    });
  });
}); 