/**
 * Copyright IBM Corp. 2025
 * Assisted by CursorAI
 */

import * as vscode from "vscode";
import { services } from "../services";
import { handleError } from "../errors";
import { CurlImportConfig } from "../types/import";

/**
 * Command to import a REST endpoint using cURL syntax
 */
export async function importCurl(): Promise<void> {
  try {
    services.logger.info("Starting cURL import");

    // 1. Check workspace trust
    if (!vscode.workspace.isTrusted) {
      vscode.window.showWarningMessage(
        "Import features not available in untrusted workspaces"
      );
      return;
    }

    // 2. Collect cURL configuration from user
    const config = await collectCurlConfiguration();
    if (!config) {
      services.logger.info("cURL import cancelled by user");
      return;
    }

    // 3. Execute the import using the generalized import service
    const result = await services.import.executeImport(config);

    // 4. Handle results
    if (result.success) {
      vscode.window.showInformationMessage(
        `Schema imported successfully to ${result.targetDir}/${result.schemaName}`
      );
      
      // TODO: Offer Phase 2 functional enhancements
      // await offerFunctionalEnhancements(result);
    } else {
      vscode.window.showErrorMessage(`Import failed: ${result.error}`);
    }

    services.logger.info("cURL import completed");
  } catch (err) {
    handleError(err);
  }
}

/**
 * Collect cURL import configuration from the user through VS Code UI
 */
async function collectCurlConfiguration(): Promise<CurlImportConfig | undefined> {
  // Step 1: Get cURL command or endpoint
  const curlInput = await vscode.window.showInputBox({
    prompt: "Paste your cURL command or enter the endpoint URL",
    placeHolder: "curl -H 'Authorization: Bearer token' https://api.example.com/users",
    ignoreFocusOut: true,
  });

  if (!curlInput) {
    return undefined;
  }

  // Step 2: Parse cURL command or use as endpoint
  const parsedConfig = parseCurlCommand(curlInput);

  // Step 3: Collect additional configuration
  const name = await vscode.window.showInputBox({
    prompt: "Schema name (folder name for generated files)",
    value: parsedConfig.suggestedName,
    placeHolder: "api_example_com",
    ignoreFocusOut: true,
  });

  if (!name) {
    return undefined;
  }

  const queryName = await vscode.window.showInputBox({
    prompt: "Query field name (GraphQL field name)",
    value: parsedConfig.suggestedQueryName,
    placeHolder: "users",
    ignoreFocusOut: true,
  });

  if (!queryName) {
    return undefined;
  }

  // Step 4: Advanced options (optional)
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

  // Step 5: Build final configuration
  const config: CurlImportConfig = {
    endpoint: parsedConfig.endpoint || curlInput, // Fallback to original input
    name,
    queryName,
    nonInteractive: true, // Always use non-interactive mode
    ...parsedConfig,
    ...advancedConfig,
  };

  return config;
}

/**
 * Parse a cURL command or endpoint URL into configuration
 */
function parseCurlCommand(input: string): Partial<CurlImportConfig> {
  const trimmed = input.trim();
  
  // Simple URL case
  if (trimmed.startsWith('http')) {
    return parseSimpleUrl(trimmed);
  }
  
  // cURL command case
  if (trimmed.startsWith('curl')) {
    return parseFullCurlCommand(trimmed);
  }
  
  // Assume it's a URL if it doesn't start with curl
  return parseSimpleUrl(trimmed);
}

/**
 * Parse a simple URL into configuration
 */
function parseSimpleUrl(url: string): Partial<CurlImportConfig> {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.replace(/\./g, '_');
    const pathSegments = parsed.pathname.split('/').filter(Boolean);
    
    return {
      endpoint: url,
      suggestedName: hostname,
      suggestedQueryName: generateQueryName(pathSegments),
    };
  } catch (err) {
    services.logger.warn(`Failed to parse URL: ${url}`, err);
    return {
      endpoint: url,
      suggestedName: 'imported_api',
      suggestedQueryName: 'data',
    };
  }
}

/**
 * Parse a full cURL command into configuration
 */
function parseFullCurlCommand(curlCommand: string): Partial<CurlImportConfig> {
  // Basic parsing - extract URL and headers
  const urlMatch = curlCommand.match(/https?:\/\/[^\s]+/);
  const url = urlMatch ? urlMatch[0] : '';
  
  // Extract headers
  const headerMatches = curlCommand.matchAll(/-H\s+['"]([^'"]+)['"]/g);
  const headers: Array<{ name: string; value: string }> = [];
  const secrets: string[] = [];
  
  for (const match of headerMatches) {
    const headerString = match[1];
    const colonIndex = headerString.indexOf(':');
    if (colonIndex > 0) {
      const name = headerString.substring(0, colonIndex).trim();
      const value = headerString.substring(colonIndex + 1).trim();
      
      headers.push({ name, value });
      
      // Auto-detect secrets
      if (isSecretHeader(name)) {
        secrets.push(name);
      }
    }
  }
  
  const baseConfig = parseSimpleUrl(url);
  
  return {
    ...baseConfig,
    headers: headers.length > 0 ? headers : undefined,
    secrets: secrets.length > 0 ? secrets : undefined,
  };
}

/**
 * Generate a query name from URL path segments
 */
function generateQueryName(pathSegments: string[]): string {
  if (pathSegments.length === 0) {
    return 'data';
  }
  
  // Use the last meaningful segment
  const lastSegment = pathSegments[pathSegments.length - 1];
  
  // Remove common REST patterns
  const cleaned = lastSegment
    .replace(/\{[^}]+\}/g, '') // Remove {id} patterns
    .replace(/[^a-zA-Z]/g, ''); // Remove non-letters
  
  return cleaned || 'data';
}

/**
 * Check if a header name indicates it contains secrets
 */
function isSecretHeader(headerName: string): boolean {
  const secretPatterns = [
    'authorization',
    'x-api-key',
    'api-key',
    'token',
    'auth',
    'secret',
  ];
  
  const lowerName = headerName.toLowerCase();
  return secretPatterns.some(pattern => lowerName.includes(pattern));
}

/**
 * Collect advanced configuration options
 */
async function collectAdvancedOptions(): Promise<Partial<CurlImportConfig>> {
  const options: Partial<CurlImportConfig> = {};
  
  // Query type
  const queryType = await vscode.window.showInputBox({
    prompt: "Custom return type name (optional)",
    placeHolder: "User",
    ignoreFocusOut: true,
  });
  
  if (queryType) {
    options.queryType = queryType;
  }
  
  // Prefix
  const prefix = await vscode.window.showInputBox({
    prompt: "Type prefix (optional)",
    placeHolder: "Api",
    ignoreFocusOut: true,
  });
  
  if (prefix) {
    options.prefix = prefix;
  }
  
  // Path parameters
  const pathParams = await vscode.window.showInputBox({
    prompt: "Path parameters (optional)",
    placeHolder: "/users/$userId",
    ignoreFocusOut: true,
  });
  
  if (pathParams) {
    options.pathParams = pathParams;
  }
  
  return options;
} 