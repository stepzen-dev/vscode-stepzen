/**
 * Copyright IBM Corp. 2025
 * Assisted by CursorAI
 */

import * as vscode from "vscode";
import { services } from "../services";
import { handleError } from "../errors";
import { OpenApiImportConfig } from "../types/import";

/**
 * Command to import an OpenAPI specification
 */
export async function importOpenapi(): Promise<void> {
  try {
    services.logger.info("Starting OpenAPI import");

    // 1. Check workspace trust
    if (!vscode.workspace.isTrusted) {
      vscode.window.showWarningMessage(
        "Import features not available in untrusted workspaces"
      );
      return;
    }

    // 2. Collect OpenAPI configuration from user
    const config = await collectOpenApiConfiguration();
    if (!config) {
      services.logger.info("OpenAPI import cancelled by user");
      return;
    }

    // 3. Execute the import using the generalized import service
    const result = await services.import.executeImport(config);

    // 4. Handle results
    if (result.success) {
      vscode.window.showInformationMessage(
        `OpenAPI schema imported successfully to ${result.targetDir}/${result.schemaName}`
      );
      
    } else {
      vscode.window.showErrorMessage(`Import failed: ${result.error}`);
    }

    services.logger.info("OpenAPI import completed");
  } catch (err) {
    handleError(err);
  }
}

/**
 * Collect OpenAPI import configuration from the user through VS Code UI
 */
async function collectOpenApiConfiguration(): Promise<OpenApiImportConfig | undefined> {
  // Step 1: Get OpenAPI spec file or URL
  const specInput = await vscode.window.showQuickPick(
    [
      { label: "File Path", description: "Local OpenAPI specification file" },
      { label: "URL", description: "Remote OpenAPI specification URL" }
    ],
    {
      placeHolder: "How would you like to provide the OpenAPI specification?",
      ignoreFocusOut: true,
    }
  );

  if (!specInput) {
    return undefined;
  }

  let spec: string;
  if (specInput.label === "File Path") {
    // Browse for file
    const fileUri = await vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
      filters: {
        'OpenAPI Specs': ['yaml', 'yml', 'json'],
        'All Files': ['*']
      },
      title: "Select OpenAPI Specification File"
    });

    if (!fileUri || fileUri.length === 0) {
      return undefined;
    }

    spec = fileUri[0].fsPath;
  } else {
    // Get URL
    const urlInput = await vscode.window.showInputBox({
      prompt: "Enter the OpenAPI specification URL",
      placeHolder: "https://petstore.swagger.io/v2/swagger.json",
      ignoreFocusOut: true,
      validateInput: (value) => {
        if (!value) {
          return "URL is required";
        }
        try {
          new URL(value);
          return undefined;
        } catch {
          return "Please enter a valid URL";
        }
      }
    });

    if (!urlInput) {
      return undefined;
    }

    spec = urlInput;
  }

  // Step 2: Get schema name
  const suggestedName = generateSchemaName(spec);
  const name = await vscode.window.showInputBox({
    prompt: "Schema name (folder name for generated files)",
    value: suggestedName,
    placeHolder: "petstore_api",
    ignoreFocusOut: true,
    validateInput: (value) => {
      if (!value) {
        return "Schema name is required";
      }
      if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(value)) {
        return "Schema name must start with a letter and contain only letters, numbers, and underscores";
      }
      return undefined;
    }
  });

  if (!name) {
    return undefined;
  }

  // Step 3: Advanced options (optional)
  const showAdvanced = await vscode.window.showQuickPick(
    ["No", "Yes"],
    {
      placeHolder: "Configure advanced options?",
      ignoreFocusOut: true,
    }
  );

  let advancedConfig = {};
  if (showAdvanced === "Yes") {
    advancedConfig = await collectAdvancedOptions();
  }

  // Step 4: Build final configuration
  const config: OpenApiImportConfig = {
    spec,
    name,
    nonInteractive: true, // Always use non-interactive mode
    ...advancedConfig,
  };

  return config;
}

/**
 * Generate a schema name from the OpenAPI spec path/URL
 */
function generateSchemaName(spec: string): string {
  try {
    // If it's a URL, use the hostname
    if (spec.startsWith('http')) {
      const url = new URL(spec);
      return url.hostname.replace(/\./g, '_').replace(/[^a-zA-Z0-9_]/g, '');
    }
    
    // If it's a file path, use the filename without extension
    const filename = spec.split(/[/\\]/).pop() || 'openapi';
    return filename.replace(/\.[^.]*$/, '').replace(/[^a-zA-Z0-9_]/g, '_');
  } catch (err) {
    services.logger.warn(`Failed to generate schema name from: ${spec}`, err);
    return 'openapi_import';
  }
}

/**
 * Collect advanced configuration options
 */
async function collectAdvancedOptions(): Promise<Partial<OpenApiImportConfig>> {
  const options: Partial<OpenApiImportConfig> = {};
  
  // Working directory
  const dir = await vscode.window.showInputBox({
    prompt: "Working directory (optional)",
    placeHolder: "./stepzen",
    ignoreFocusOut: true,
  });
  
  if (dir) {
    options.dir = dir;
  }
  
  return options;
} 