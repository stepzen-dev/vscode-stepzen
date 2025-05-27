/**
 * Copyright IBM Corp. 2025
 * Assisted by CursorAI
 */

import * as vscode from "vscode";
import * as path from "path";
import { StepZenError } from "../errors";
import { FILE_PATTERNS } from "./constants";
import { services } from "../services";

/**
 * Template content for the main schema file
 */
const INDEX_GRAPHQL_TEMPLATE = `schema
  @sdl(
    files: [
    ]
    executables: [
      { document: "operations/example.graphql", persist: false }
    ]
  ) {
  query: Query
}

# This query field is only here to support the sample executable document
# Remove this when you build your API
extend type Query {
  hello: String @value(const: "Hello from StepZen!")
}`;

/**
 * Template content for the example operation file
 */
const EXAMPLE_OPERATION_TEMPLATE = `# Example GraphQL operations for your StepZen API
# This query works with the default schema

query HelloWorld {
  hello
}

`;

/**
 * Validates the input parameters for project scaffold creation
 * 
 * @param projectDir Directory where to create the project
 * @param endpoint StepZen endpoint in the format folder/name
 * @throws StepZenError if validation fails
 */
function validateScaffoldInputs(projectDir: string, endpoint: string): void {
  if (!projectDir || typeof projectDir !== 'string' || projectDir.trim() === '') {
    throw new StepZenError(
      "Project directory must be a non-empty string",
      "INVALID_PROJECT_DIR"
    );
  }

  if (!endpoint || typeof endpoint !== 'string' || endpoint.trim() === '') {
    throw new StepZenError(
      "Endpoint must be a non-empty string",
      "INVALID_ENDPOINT"
    );
  }

  // Validate endpoint format (folder/name)
  if (!endpoint.includes('/')) {
    throw new StepZenError(
      "Endpoint must be in the format 'folder/name'",
      "INVALID_ENDPOINT_FORMAT"
    );
  }

  const [folder, name] = endpoint.split('/', 2);
  if (!folder || !name) {
    throw new StepZenError(
      "Both folder and name must be provided in endpoint",
      "INVALID_ENDPOINT_PARTS"
    );
  }

  if (!/^[a-zA-Z0-9-_]+$/.test(folder) || !/^[a-zA-Z0-9-_]+$/.test(name)) {
    throw new StepZenError(
      "Folder and name can only contain letters, numbers, hyphens, and underscores",
      "INVALID_ENDPOINT_CHARS"
    );
  }
}

/**
 * Creates a file using VS Code's file system API
 * 
 * @param filePath Path to the file to create
 * @param content Content to write to the file
 */
async function createFile(filePath: string, content: string): Promise<void> {
  const uri = vscode.Uri.file(filePath);
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  await vscode.workspace.fs.writeFile(uri, data);
}

/**
 * Creates a directory using VS Code's file system API
 * 
 * @param dirPath Path to the directory to create
 */
async function createDirectory(dirPath: string): Promise<void> {
  const uri = vscode.Uri.file(dirPath);
  await vscode.workspace.fs.createDirectory(uri);
}

/**
 * Checks if a file or directory exists using VS Code's file system API
 * 
 * @param filePath Path to check
 * @returns Promise resolving to true if the path exists
 */
async function pathExists(filePath: string): Promise<boolean> {
  try {
    const uri = vscode.Uri.file(filePath);
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}

/**
 * Creates a StepZen project scaffold at the specified location
 * 
 * This utility function creates the basic structure of a StepZen project:
 * - stepzen.config.json with the specified endpoint
 * - index.graphql with basic schema structure
 * - operations/example.graphql with sample operations
 * 
 * @param projectDir Directory where to create the project
 * @param endpoint StepZen endpoint in the format folder/name
 * @returns Promise that resolves when the project is created
 * @throws StepZenError if validation fails or file operations fail
 */
export async function createProjectScaffold(
  projectDir: string,
  endpoint: string,
): Promise<void> {
  try {
    // Validate inputs
    validateScaffoldInputs(projectDir, endpoint);

    // Create the main project directory if it doesn't exist
    if (!(await pathExists(projectDir))) {
      await createDirectory(projectDir);
    }

    // Create operations directory
    const operationsDir = path.join(projectDir, FILE_PATTERNS.OPERATIONS_DIR);
    if (!(await pathExists(operationsDir))) {
      await createDirectory(operationsDir);
    }

    // Create stepzen.config.json
    const configPath = path.join(projectDir, FILE_PATTERNS.CONFIG_FILE);
    const configContent = JSON.stringify({ endpoint }, null, 2);
    await createFile(configPath, configContent);

    // Create index.graphql
    const indexPath = path.join(projectDir, FILE_PATTERNS.MAIN_SCHEMA_FILE);
    await createFile(indexPath, INDEX_GRAPHQL_TEMPLATE);

    // Create operations/example.graphql
    const sampleOperationPath = path.join(
      projectDir,
      FILE_PATTERNS.OPERATIONS_DIR,
      FILE_PATTERNS.EXAMPLE_GRAPHQL_FILE,
    );
    await createFile(sampleOperationPath, EXAMPLE_OPERATION_TEMPLATE);

    services.logger.info(
      `Created StepZen project at: ${projectDir} with endpoint ${endpoint}`,
    );
  } catch (err) {
    // Re-throw StepZenErrors as-is, wrap other errors
    if (err instanceof StepZenError) {
      throw err;
    }
    
    throw new StepZenError(
      `Failed to create project scaffold: ${err instanceof Error ? err.message : String(err)}`,
      "FILESYSTEM_ERROR",
      err
    );
  }
} 