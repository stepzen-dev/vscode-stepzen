/**
 * Copyright IBM Corp. 2025
 * Assisted by CursorAI
 */

import * as vscode from "vscode";
import { services } from "../services";
import { handleError } from "../errors";
import { GraphQLImportConfig } from "../types/import";

/**
 * Command to import a GraphQL endpoint
 */
export async function importGraphql(): Promise<void> {
  try {
    services.logger.info("Starting GraphQL import");

    // 1. Check workspace trust
    if (!vscode.workspace.isTrusted) {
      vscode.window.showWarningMessage(
        "Import features not available in untrusted workspaces"
      );
      return;
    }

    // 2. Collect GraphQL configuration from user
    const config = await collectGraphQLConfiguration();
    if (!config) {
      services.logger.info("GraphQL import cancelled by user");
      return;
    }

    // 3. Execute the import using the generalized import service
    const result = await services.import.executeImport(config);

    // 4. Handle results
    if (result.success) {
      vscode.window.showInformationMessage(
        `GraphQL schema imported successfully to ${result.targetDir}/${result.schemaName}`
      );
      
    } else {
      vscode.window.showErrorMessage(`Import failed: ${result.error}`);
    }

    services.logger.info("GraphQL import completed");
  } catch (err) {
    handleError(err);
  }
}

/**
 * Collect GraphQL import configuration from the user through VS Code UI
 */
async function collectGraphQLConfiguration(): Promise<GraphQLImportConfig | undefined> {
  // Step 1: Get GraphQL endpoint URL
  const endpoint = await vscode.window.showInputBox({
    prompt: "Enter the GraphQL endpoint URL",
    placeHolder: "https://api.github.com/graphql",
    ignoreFocusOut: true,
    validateInput: (value) => {
      if (!value) {
        return "Endpoint URL is required";
      }
      try {
        new URL(value);
        return undefined;
      } catch {
        return "Please enter a valid URL";
      }
    }
  });

  if (!endpoint) {
    return undefined;
  }

  // Step 2: Get schema name
  const suggestedName = generateSchemaName(endpoint);
  const name = await vscode.window.showInputBox({
    prompt: "Schema name (folder name for generated files)",
    value: suggestedName,
    placeHolder: "github_api",
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

  // Step 3: Authentication (optional but common for GraphQL)
  const needsAuth = await vscode.window.showQuickPick(
    ["No", "Yes"],
    {
      placeHolder: "Does this GraphQL endpoint require authentication?",
      ignoreFocusOut: true,
    }
  );

  let authConfig = {};
  if (needsAuth === "Yes") {
    authConfig = await collectAuthConfiguration();
  }

  // Step 4: Type prefix (optional)
  const prefix = await vscode.window.showInputBox({
    prompt: "Type prefix (leave blank for none)",
    placeHolder: "GitHub (will create GitHubUser, GitHubRepository, etc.)",
    ignoreFocusOut: true,
  });

  // Step 5: Build final configuration
  const config: GraphQLImportConfig = {
    endpoint,
    name,
    nonInteractive: true, // Always use non-interactive mode
    ...authConfig,
    ...(prefix ? { prefix } : {}),
  };

  return config;
}

/**
 * Generate a schema name from the GraphQL endpoint URL
 */
function generateSchemaName(endpoint: string): string {
  try {
    const url = new URL(endpoint);
    let name = url.hostname.replace(/\./g, '_');
    
    // Add path context if meaningful
    const pathSegments = url.pathname.split('/').filter(Boolean);
    if (pathSegments.length > 0 && pathSegments[0] !== 'graphql') {
      name += '_' + pathSegments[0];
    }
    
    return name.replace(/[^a-zA-Z0-9_]/g, '');
  } catch (err) {
    services.logger.warn(`Failed to generate schema name from: ${endpoint}`, err);
    return 'graphql_import';
  }
}

/**
 * Collect authentication configuration
 */
async function collectAuthConfiguration(): Promise<Partial<GraphQLImportConfig>> {
  const authType = await vscode.window.showQuickPick(
    [
      { label: "Bearer Token", description: "Authorization: Bearer <token>" },
      { label: "API Key Header", description: "Custom header with API key" },
      { label: "Basic Auth", description: "Username and password" },
      { label: "Custom Header", description: "Custom authentication header" }
    ],
    {
      placeHolder: "Select authentication type",
      ignoreFocusOut: true,
    }
  );

  if (!authType) {
    return {};
  }

  const headers: Array<{ name: string; value: string }> = [];
  const secrets: string[] = [];

  switch (authType.label) {
    case "Bearer Token":
      const token = await vscode.window.showInputBox({
        prompt: "Enter your bearer token",
        placeHolder: "ghp_xxxxxxxxxxxxxxxxxxxx",
        password: true,
        ignoreFocusOut: true,
      });
      
      if (token) {
        headers.push({ name: "Authorization", value: `Bearer ${token}` });
        secrets.push("Authorization");
      }
      break;

    case "API Key Header":
      const keyName = await vscode.window.showInputBox({
        prompt: "Enter the header name for your API key",
        placeHolder: "X-API-Key",
        ignoreFocusOut: true,
      });
      
      if (keyName) {
        const keyValue = await vscode.window.showInputBox({
          prompt: `Enter your ${keyName} value`,
          password: true,
          ignoreFocusOut: true,
        });
        
        if (keyValue) {
          headers.push({ name: keyName, value: keyValue });
          secrets.push(keyName);
        }
      }
      break;

    case "Basic Auth":
      const username = await vscode.window.showInputBox({
        prompt: "Enter username",
        ignoreFocusOut: true,
      });
      
      if (username) {
        const password = await vscode.window.showInputBox({
          prompt: "Enter password",
          password: true,
          ignoreFocusOut: true,
        });
        
        if (password) {
          const credentials = Buffer.from(`${username}:${password}`).toString('base64');
          headers.push({ name: "Authorization", value: `Basic ${credentials}` });
          secrets.push("Authorization");
        }
      }
      break;

    case "Custom Header":
      const headerName = await vscode.window.showInputBox({
        prompt: "Enter header name",
        placeHolder: "X-Custom-Auth",
        ignoreFocusOut: true,
      });
      
      if (headerName) {
        const headerValue = await vscode.window.showInputBox({
          prompt: `Enter ${headerName} value`,
          password: true,
          ignoreFocusOut: true,
        });
        
        if (headerValue) {
          headers.push({ name: headerName, value: headerValue });
          secrets.push(headerName);
        }
      }
      break;
  }

  return {
    headers: headers.length > 0 ? headers : undefined,
    secrets: secrets.length > 0 ? secrets : undefined,
  };
} 