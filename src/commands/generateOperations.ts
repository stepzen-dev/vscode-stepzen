/**
 * Copyright IBM Corp. 2025
 * Assisted by CursorAI
 */

import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import type { ArgInfo } from "../services/schema/indexer";
import { resolveStepZenProjectRoot } from "../utils/stepzenProject";
import { services } from "../services";
import { FILE_PATTERNS, GRAPHQL, MESSAGES, TEMP_FILE_PATTERNS } from "../utils/constants";
import { handleError, StepZenError } from "../errors";

// Maximum depth for field traversal
const DEFAULT_MAX_DEPTH = 4;

// Types we should stop recursing into
const STOP_RECURSION_TYPES = [
  ...GRAPHQL.SCALAR_TYPES,
  "Date",
  "DateTime",
  "Time",
  "JSON",
];

/**
 * Generates GraphQL operation files for each query field in the schema
 * and adds them to the executable documents section of the SDL directive.
 */
export async function generateOperations() {
  try {
    // Resolve StepZen project root
    const projectRoot = await resolveStepZenProjectRoot();
    services.logger.info(
      `Generating operations for project at: ${projectRoot}`,
    );

    // Ensure index.graphql exists
    const indexPath = path.join(projectRoot, FILE_PATTERNS.MAIN_SCHEMA_FILE);
    if (!fs.existsSync(indexPath)) {
      throw new StepZenError(
        `Main schema file (${FILE_PATTERNS.MAIN_SCHEMA_FILE}) not found`,
        "FILE_NOT_FOUND"
      );
    }

    // Ensure operations directory exists
    const operationsDir = path.join(projectRoot, FILE_PATTERNS.OPERATIONS_DIR);
    if (!fs.existsSync(operationsDir)) {
      fs.mkdirSync(operationsDir, { recursive: true });
      services.logger.info(`Created operations directory at: ${operationsDir}`);
    }

    // Scan the project to get the latest schema information
    await services.schemaIndex.scan(indexPath);

    // Get the root operations and field index
    const rootOps = services.schemaIndex.getRootOperations();
    const fieldIdx = services.schemaIndex.getFieldIndex();

    // Debug logging
    services.logger.debug(
      `Root Operations count: ${Object.keys(rootOps).length}`,
    );
    services.logger.debug(
      `Field Index Types: ${Object.keys(fieldIdx).join(", ")}`,
    );

    // Find Query fields from the field index
    const queryType = fieldIdx["Query"];

    // If Query type doesn't exist in the field index, try to find Query fields
    // by inspecting root operations directly
    if (!queryType || queryType.length === 0) {
      services.logger.warn(
        "No Query type found in field index, trying root operations",
      );
      // We'll proceed with all root operations for now
    }

    // If we have no root operations at all, show error
    if (Object.keys(rootOps).length === 0) {
      throw new StepZenError(
        "No Query fields found in schema",
        "SCHEMA_VALIDATION_ERROR"
      );
    }

    // Generate timestamp for versioning
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "")
      .replace("T", "_")
      .replace("Z", "");

    // Track the generated files
    const generatedFiles: string[] = [];

    // Process all root operation fields and generate operation files
    for (const [fieldName, fieldInfo] of Object.entries(rootOps)) {
      services.logger.info(`Processing field: ${fieldName}`);
      try {
        const queryContent = generateQueryOperation(
          fieldName,
          fieldInfo,
          fieldIdx,
        );
        const fileName = `query_${fieldName}${TEMP_FILE_PATTERNS.GRAPHQL_EXTENSION}`;
        const filePath = path.join(operationsDir, fileName);

        // If file already exists, create a versioned one
        if (fs.existsSync(filePath)) {
          const versionedFileName = `query_${fieldName}_${timestamp}${TEMP_FILE_PATTERNS.GRAPHQL_EXTENSION}`;
          const versionedFilePath = path.join(operationsDir, versionedFileName);
          fs.writeFileSync(versionedFilePath, queryContent);
          generatedFiles.push(versionedFilePath);
          services.logger.info(
            `Generated versioned operation file: ${versionedFilePath}`,
          );
        } else {
          // Create new file
          fs.writeFileSync(filePath, queryContent);
          generatedFiles.push(filePath);
          services.logger.info(`Generated operation file: ${filePath}`);
        }
      } catch (err) {
        services.logger.error(
          `Error generating operation for ${fieldName}: ${err}`,
          err,
        );
      }
    }

    // Update SDL directive in index.graphql
    if (generatedFiles.length > 0) {
      updateSdlDirective(indexPath, generatedFiles);
      vscode.window.showInformationMessage(
        `Generated ${generatedFiles.length} operation files in the operations directory.`,
      );
    } else {
      vscode.window.showWarningMessage("No operation files were generated.");
    }
  } catch (err) {
    handleError(err);
  }
}

/**
 * Generates a GraphQL query operation for a given field
 *
 * @param fieldName The name of the query field
 * @param fieldInfo The field information
 * @param fieldIdx The complete field index
 * @returns A string containing the generated GraphQL query
 */
function generateQueryOperation(
  fieldName: string,
  fieldInfo: any,
  fieldIdx: Record<string, any>,
) {
  services.logger.debug(`Generating query operation for: ${fieldName}`);
  services.logger.debug(`Field info: ${JSON.stringify(fieldInfo, null, 2)}`);

  // Start with query declaration
  let query = `query ${fieldName}`;

  // Add arguments if any
  const args = fieldInfo.args || [];
  if (args.length > 0) {
    const argsList = args
      .map((arg: ArgInfo) => {
        return `$${arg.name}: ${arg.type}`; // Already contains the full type including nullability
      })
      .join(", ");
    query += `(${argsList})`;
  }

  query += ` {\n  ${fieldName}`;

  // Add arguments to the field if any
  if (args.length > 0) {
    const argsUsage = args
      .map((arg: ArgInfo) => {
        return `${arg.name}: $${arg.name}`;
      })
      .join(", ");
    query += `(${argsUsage})`;
  }

  // Recursively add fields
  const returnType = fieldInfo.returnType;
  if (returnType && fieldIdx[returnType]) {
    query += generateFieldSelection(returnType, fieldIdx, 1, DEFAULT_MAX_DEPTH);
  }

  query += "\n}\n";
  return query;
}

/**
 * Recursively generates field selections for a given type
 *
 * @param typeName The name of the type to generate fields for
 * @param fieldIdx The complete field index
 * @param depth Current depth in the recursion
 * @param maxDepth Maximum depth to traverse
 * @returns A string containing the field selection
 */
function generateFieldSelection(
  typeName: string,
  fieldIdx: Record<string, any[]>,
  depth: number,
  maxDepth: number,
): string {
  // Stop recursion if type is a scalar or we've reached max depth
  if (STOP_RECURSION_TYPES.includes(typeName) || depth > maxDepth) {
    return "";
  }

  // If type doesn't exist in the field index, return empty string
  const typeFields = fieldIdx[typeName];
  if (!typeFields) {
    return "";
  }

  let fields = " {\n";
  const indent = "  ".repeat(depth + 1);

  // Add all fields for this type
  for (const fieldInfo of typeFields) {
    const fieldName = fieldInfo.name;
    // Skip __typename (added automatically by GraphQL) and deprecated fields if set
    if (fieldName === "__typename" || (fieldInfo as any).isDeprecated) {
      continue;
    }

    fields += `${indent}${fieldName}`;

    // Check if field is an object type that needs recursion
    const fieldType = fieldInfo.type.replace(/[!\[\]]/g, "");

    if (fieldType && fieldIdx[fieldType] && depth < maxDepth) {
      // Recursive call for nested objects
      fields += generateFieldSelection(
        fieldType,
        fieldIdx,
        depth + 1,
        maxDepth,
      );
    }
    fields += "\n";
  }

  fields += `${"  ".repeat(depth)}}`;
  return fields;
}

/**
 * Updates the SDL directive in index.graphql to include the generated files
 *
 * @param indexPath Path to the index.graphql file
 * @param generatedFiles List of generated file paths
 * @param projectRoot Path to the project root
 */
function updateSdlDirective(
  indexPath: string,
  generatedFiles: string[],
  // projectRoot: string,
) {
  try {
    // Read the index file content
    let content = fs.readFileSync(indexPath, "utf8");

    // Convert absolute paths to relative paths from the project root
    const relativeFiles = generatedFiles.map(
      (filePath) =>
        path.relative(path.dirname(indexPath), filePath).replace(/\\/g, "/"), // Ensure forward slashes for GraphQL declarations
    );

    // First, check for SDL directive with executables
    const executablesRegex =
      /@sdl\(\s*(?:files\s*:.*?,\s*)?executables\s*:\s*\[(.*?)\]\s*\)/s;
    const executablesMatch = content.match(executablesRegex);

    // Also check for SDL directive without executables
    const sdlRegex = /@sdl\(([^)]*)\)/gs;
    let sdlWithoutExecutablesMatch = null;

    // Find the schema directive that doesn't include executables
    let isSchemaDirective = false;
    for (const match of content.matchAll(sdlRegex)) {
      // If this SDL directive doesn't have 'executables:', capture it
      if (!match[1].includes("executables:")) {
        // Check if this is in a schema directive (which is what we want)
        const schemaCheck = content.substring(
          Math.max(0, match.index - 20),
          match.index + 30,
        );
        isSchemaDirective = /schema\s+@sdl/.test(schemaCheck);

        sdlWithoutExecutablesMatch = match;

        // If this is the schema directive, we found what we wanted
        if (isSchemaDirective) {
          break;
        }
      }
    }

    if (executablesMatch) {
      // SDL with executables found, append to the existing list
      let executablesList = executablesMatch[1];

      // Get current executables from both formats - strings and objects with document
      const currentExecutables = new Set<string>();

      // Look for object style { document: "file.graphql", persist: true/false }
      const documentRegex = /document:\s*["']([^"\\]*(?:\\.[^"\\]*)*)["']/g;
      for (const m of executablesList.matchAll(documentRegex)) {
        const exec = m[1].trim();
        if (exec) {
          currentExecutables.add(exec);
        }
      }

      // Also detect string-only executables for backward compatibility ("file.graphql")
      const stringRegex =
        /"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'/g;
      for (const m of executablesList.matchAll(stringRegex)) {
        const exec = (m[1] ?? m[2]).trim();
        if (exec && !exec.includes("document:")) {
          currentExecutables.add(exec);
        }
      }

      // Add new executables
      const newExecutables = relativeFiles.filter(
        (file) => !currentExecutables.has(file),
      );

      // If there are new executables to add
      if (newExecutables.length > 0) {
        let newList = executablesList;
        if (newList.trim()) {
          // Append to existing list
          newList = newList.trimEnd();
          if (!newList.endsWith(",")) {
            newList += ",";
          }
          newList += " ";
          newList += newExecutables
            .map((file) => `{ document: "${file}", persist: false }`)
            .join(", ");
        } else {
          // Empty list, add the new executables
          newList = newExecutables
            .map((file) => `{ document: "${file}", persist: false }`)
            .join(", ");
        }

        // Replace the old executables list with the new one
        content = content.replace(executablesRegex, (match) => {
          return match.replace(executablesList, newList);
        });

        // Write back to the file
        fs.writeFileSync(indexPath, content);
        services.logger.info(
          `Updated SDL directive in ${indexPath} with ${newExecutables.length} new operation files`,
        );
      } else {
        services.logger.info(
          "All generated files already in SDL directive, nothing to update.",
        );
      }
    } else if (sdlWithoutExecutablesMatch) {
      // SDL directive exists but doesn't have executables
      services.logger.info(
        MESSAGES.FOUND_SDL_WITHOUT_EXECUTABLES,
      );

      try {
        // Get the existing SDL directive content
        const existingDirectiveContent = sdlWithoutExecutablesMatch[1];
        const executablesValue = relativeFiles
          .map((file) => `{ document: "${file}", persist: false }`)
          .join(", ");

        // Format the updated directive
        let updatedDirective;
        if (existingDirectiveContent.trim().endsWith(",")) {
          // Already has a comma
          updatedDirective = `@sdl(${existingDirectiveContent} executables: [${executablesValue}])`;
        } else if (existingDirectiveContent.trim()) {
          // No trailing comma
          updatedDirective = `@sdl(${existingDirectiveContent}, executables: [${executablesValue}])`;
        } else {
          // Empty content
          updatedDirective = `@sdl(executables: [${executablesValue}])`;
        }

        // Replace the specific SDL directive that doesn't have executables
        const fullMatch = sdlWithoutExecutablesMatch[0];

        // Safety check to avoid replacing all occurrences (which might be dangerous)
        // We'll only replace the first occurrence, which should be the one we matched
        const replaceIndex = content.indexOf(fullMatch);
        if (replaceIndex !== -1) {
          content =
            content.substring(0, replaceIndex) +
            updatedDirective +
            content.substring(replaceIndex + fullMatch.length);
        } else {
          content = content.replace(fullMatch, updatedDirective);
        }

        // Write back to the file
        fs.writeFileSync(indexPath, content);
        services.logger.info(
          `Added executables to SDL directive in ${indexPath} with ${relativeFiles.length} operation files`,
        );
      } catch (err) {
        services.logger.error(`Error formatting SDL directive: ${err}`, err);
        vscode.window.showWarningMessage(
          "Error updating SDL directive. Please add executables manually or check file format.",
        );
      }
    } else {
      // No SDL directive found at all
      services.logger.warn(MESSAGES.COULD_NOT_FIND_SDL_DIRECTIVE);
      vscode.window.showWarningMessage(
        MESSAGES.COULD_NOT_FIND_SDL_DIRECTIVE,
      );
    }
  } catch (err) {
    handleError(err);
  }
}
