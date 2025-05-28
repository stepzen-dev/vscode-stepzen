/**
 * Copyright IBM Corp. 2025
 * Assisted by CursorAI
 */

import * as vscode from 'vscode';
import { services } from '../services';
import { handleError } from '../errors';
import { DirectiveBuilder } from '../utils/directiveBuilder';
import { GRAPHQL } from '../utils/constants';

/**
 * Represents a field path within a GraphQL type
 */
interface FieldPath {
  path: string; // e.g., "customer { name }" or "customer { address { street } }"
  displayName: string; // e.g., "customer { name }"
}

/**
 * Adds a @materializer directive to a GraphQL field
 * Analyzes the field type and suggests matching StepZen queries
 * For scalar fields, provides a two-step process to select operation and field path
 * 
 * @returns Promise that resolves when the materializer has been added or operation is cancelled
 */
export async function addMaterializer() {
  try {
    services.logger.info("Starting Add Materializer command");
    
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No active editor');
      services.logger.warn("Add Materializer failed: No active editor");
      return;
    }

    const document = editor.document;
    const position = editor.selection.active;
    const line = document.lineAt(position.line);
    const lineText = line.text;

    // Extract field name and declared type from the current line
    const trimmed = lineText.trim();
    const fieldMatch = trimmed.match(/^(\w+)\s*:\s*([^\s]+)/);
    if (!fieldMatch) {
      vscode.window.showInformationMessage('Place cursor on a GraphQL field definition.');
      services.logger.warn("Add Materializer failed: Not on a GraphQL field definition");
      return;
    }
    
    const fieldName = fieldMatch[1];
    const declaredType = fieldMatch[2];
    services.logger.info(`Processing field "${fieldName}" with type: ${declaredType}`);

    // Determine base type and whether it's a list type
    const isList = declaredType.startsWith('[');
    const baseType = declaredType.replace(/[[\]!]/g, ''); // Remove [] and ! characters

    // Check if this is a scalar type
    const isScalarType = isScalar(baseType);
    
    if (isScalarType) {
      // Handle scalar field materialization with two-step process
      await handleScalarFieldMaterialization(fieldName, baseType, editor, position);
    } else {
      // Handle object/interface type materialization (existing logic)
      await handleObjectFieldMaterialization(declaredType, baseType, isList, editor, position);
    }

    services.logger.info("Add Materializer completed successfully");
  } catch (err) {
    handleError(err);
  }
}

/**
 * Handles materialization for object/interface fields (existing logic)
 */
async function handleObjectFieldMaterialization(
  declaredType: string,
  baseType: string,
  isList: boolean,
  editor: vscode.TextEditor,
  position: vscode.Position
) {
  // Find matching root operations (queries) that return the same type
  const ops = Object.entries(services.schemaIndex.getRootOperations()).filter(([_opName, info]) => {
    return info.returnType === baseType && info.isList === isList;
  });

  if (ops.length === 0) {
    vscode.window.showInformationMessage(
      `No matching StepZen queries found for type ${declaredType}`
    );
    services.logger.warn(`No matching StepZen queries found for type ${declaredType}`);
    return;
  }

  services.logger.info(`Found ${ops.length} matching operations for type ${declaredType}`);

  // Choose operation if multiple
  const pickItems = ops.map(([name]) => name);
  const chosen = pickItems.length === 1
    ? pickItems[0]
    : await vscode.window.showQuickPick(pickItems, {
        placeHolder: 'Select a StepZen query to materialize',
      });
  if (!chosen) {
    services.logger.info("Add Materializer cancelled by user");
    return;
  }

  services.logger.info(`Selected operation: ${chosen}`);

  // Get argument names and create argument mappings
  const argNames = services.schemaIndex.getRootOperations()[chosen].args;
  const argumentMappings = argNames.map(arg => ({ name: arg.name, field: "" }));

  // Create and insert the directive using DirectiveBuilder
  const config = DirectiveBuilder.createMaterializerConfig(chosen, argumentMappings);
  await DirectiveBuilder.insertDirective(config, { editor, position });
}

/**
 * Handles materialization for scalar fields with two-step process
 */
async function handleScalarFieldMaterialization(
  fieldName: string,
  scalarType: string,
  editor: vscode.TextEditor,
  position: vscode.Position
) {
  services.logger.info(`Handling scalar field materialization for ${scalarType} field "${fieldName}"`);

  // Step 1: Find root operations that contain the scalar type
  const rootOps = services.schemaIndex.getRootOperations();
  const candidateOps = Object.entries(rootOps).filter(([_opName, info]) => {
    return containsScalarType(info.returnType, scalarType);
  });

  if (candidateOps.length === 0) {
    // No operations contain this scalar type, offer blank template
    await insertBlankMaterializerTemplate(editor, position);
    return;
  }

  // Prepare operation choices
  const operationChoices: vscode.QuickPickItem[] = [];
  
  // Always add blank template option at the top
  operationChoices.push({
    label: "$(edit) Insert blank template",
    description: "I'll write the query myself",
    detail: "Inserts @materializer(query: \"\") for manual completion"
  });

  // Add separator if we have operations
  if (candidateOps.length > 0) {
    operationChoices.push({ label: "", kind: vscode.QuickPickItemKind.Separator });
  }

  // Add operation choices (limit to 10 for usability)
  const displayOps = candidateOps.slice(0, 10);
  displayOps.forEach(([opName, info]) => {
    const scalarFieldCount = countScalarFields(info.returnType, scalarType);
    operationChoices.push({
      label: `$(symbol-method) ${opName}`,
      description: `${scalarFieldCount} ${scalarType} field${scalarFieldCount !== 1 ? 's' : ''}`,
      detail: `Returns ${info.returnType}${info.isList ? '[]' : ''}`
    });
  });

  // If there are more than 10 operations, add a note
  if (candidateOps.length > 10) {
    operationChoices.push({
      label: `... and ${candidateOps.length - 10} more operations`,
      description: "Consider using blank template for other operations"
    });
  }

  // Step 1: Let user choose operation
  const selectedOp = await vscode.window.showQuickPick(operationChoices, {
    placeHolder: `Select a root operation that contains ${scalarType} fields`,
    matchOnDescription: true,
    matchOnDetail: true
  });

  if (!selectedOp) {
    services.logger.info("Add Materializer cancelled by user at operation selection");
    return;
  }

  // Handle blank template choice
  if (selectedOp.label.includes("blank template")) {
    await insertBlankMaterializerTemplate(editor, position);
    return;
  }

  // Extract operation name from the selected item
  const opName = selectedOp.label.replace('$(symbol-method) ', '');
  const opInfo = rootOps[opName];
  
  if (!opInfo) {
    services.logger.error(`Selected operation ${opName} not found in root operations`);
    return;
  }

  // Step 2: Find all field paths that lead to the scalar type
  const fieldPaths = findScalarFieldPaths(opInfo.returnType, scalarType, opName);
  
  if (fieldPaths.length === 0) {
    vscode.window.showWarningMessage(`No ${scalarType} fields found in ${opName} return type`);
    return;
  }

  if (fieldPaths.length === 1) {
    // Only one path, use it directly
    const query = fieldPaths[0].path;
    const argNames = opInfo.args;
    const argumentMappings = argNames.map(arg => ({ name: arg.name, field: "" }));
    
    const config = DirectiveBuilder.createMaterializerConfig(query, argumentMappings);
    await DirectiveBuilder.insertDirective(config, { editor, position });
    return;
  }

  // Multiple paths, let user choose
  const pathChoices = fieldPaths.map(fp => ({
    label: fp.displayName,
    description: fp.path === fp.displayName ? "" : fp.path
  }));

  const selectedPath = await vscode.window.showQuickPick(pathChoices, {
    placeHolder: `Select the ${scalarType} field path to materialize`,
    matchOnDescription: true
  });

  if (!selectedPath) {
    services.logger.info("Add Materializer cancelled by user at field path selection");
    return;
  }

  // Find the selected field path
  const chosenFieldPath = fieldPaths.find(fp => 
    fp.displayName === selectedPath.label || fp.path === selectedPath.label
  );

  if (!chosenFieldPath) {
    services.logger.error("Selected field path not found");
    return;
  }

  // Create and insert the directive
  const argNames = opInfo.args;
  const argumentMappings = argNames.map(arg => ({ name: arg.name, field: "" }));
  
  const config = DirectiveBuilder.createMaterializerConfig(chosenFieldPath.path, argumentMappings);
  await DirectiveBuilder.insertDirective(config, { editor, position });
}

/**
 * Inserts a blank materializer template for manual completion
 */
async function insertBlankMaterializerTemplate(editor: vscode.TextEditor, position: vscode.Position) {
  const config = DirectiveBuilder.createMaterializerConfig("", []);
  await DirectiveBuilder.insertDirective(config, { editor, position });
  
  vscode.window.showInformationMessage(
    'Blank materializer template inserted. Replace the empty query with your desired query and field path.'
  );
}

/**
 * Checks if a type is a GraphQL scalar type
 */
function isScalar(typeName: string): boolean {
  return GRAPHQL.ALL_SCALAR_TYPES.includes(typeName as any);
}

/**
 * Checks if a type contains fields of the specified scalar type
 * Uses actual schema data to traverse type definitions
 */
function containsScalarType(typeName: string, scalarType: string): boolean {
  if (isScalar(typeName)) {
    return typeName === scalarType;
  }
  
  // Get the actual type definition from schema
  const fieldIndex = services.schemaIndex.getFieldIndex();
  const typeFields = fieldIndex[typeName];
  
  if (!typeFields) {
    return false;
  }
  
  // Check if any field in this type matches the scalar type
  return typeFields.some(field => {
    const baseFieldType = field.type.replace(/[[\]!]/g, ''); // Remove [] and ! characters
    if (isScalar(baseFieldType)) {
      return baseFieldType === scalarType;
    }
    // For nested object types, recursively check (with depth limit to avoid cycles)
    return containsScalarTypeRecursive(baseFieldType, scalarType, new Set([typeName]), 3);
  });
}

/**
 * Recursively checks if a type contains fields of the specified scalar type
 * Includes cycle detection and depth limiting
 */
function containsScalarTypeRecursive(typeName: string, scalarType: string, visited: Set<string>, maxDepth: number): boolean {
  if (maxDepth <= 0 || visited.has(typeName) || isScalar(typeName)) {
    return isScalar(typeName) && typeName === scalarType;
  }
  
  const fieldIndex = services.schemaIndex.getFieldIndex();
  const typeFields = fieldIndex[typeName];
  
  if (!typeFields) {
    return false;
  }
  
  visited.add(typeName);
  
  const result = typeFields.some(field => {
    const baseFieldType = field.type.replace(/[[\]!]/g, '');
    if (isScalar(baseFieldType)) {
      return baseFieldType === scalarType;
    }
    return containsScalarTypeRecursive(baseFieldType, scalarType, new Set(visited), maxDepth - 1);
  });
  
  visited.delete(typeName);
  return result;
}

/**
 * Counts the number of fields of a specific scalar type in a return type
 * Uses actual schema data to count fields
 */
function countScalarFields(typeName: string, scalarType: string): number {
  if (isScalar(typeName)) {
    return typeName === scalarType ? 1 : 0;
  }
  
  const fieldIndex = services.schemaIndex.getFieldIndex();
  const typeFields = fieldIndex[typeName];
  
  if (!typeFields) {
    return 0;
  }
  
  return typeFields.filter(field => {
    const baseFieldType = field.type.replace(/[[\]!]/g, '');
    return isScalar(baseFieldType) && baseFieldType === scalarType;
  }).length;
}

/**
 * Finds all field paths that lead to a specific scalar type
 * Uses actual schema data to discover real field paths
 */
function findScalarFieldPaths(typeName: string, scalarType: string, operationName: string): FieldPath[] {
  const paths: FieldPath[] = [];
  
  if (isScalar(typeName) && typeName === scalarType) {
    // The operation directly returns the scalar type
    paths.push({
      path: operationName,
      displayName: operationName
    });
    return paths;
  }
  
  // Get the actual type definition from schema
  const fieldIndex = services.schemaIndex.getFieldIndex();
  const typeFields = fieldIndex[typeName];
  
  if (!typeFields) {
    return paths;
  }
  
  // Find direct scalar fields
  typeFields.forEach(field => {
    const baseFieldType = field.type.replace(/[[\]!]/g, '');
    if (isScalar(baseFieldType) && baseFieldType === scalarType) {
      paths.push({
        path: `${operationName} { ${field.name} }`,
        displayName: `${operationName} { ${field.name} }`
      });
    }
  });
  
  // Find nested scalar fields (one level deep to avoid complexity)
  typeFields.forEach(field => {
    const baseFieldType = field.type.replace(/[[\]!]/g, '');
    if (!isScalar(baseFieldType)) {
      const nestedFields = fieldIndex[baseFieldType];
      if (nestedFields) {
        nestedFields.forEach(nestedField => {
          const nestedBaseType = nestedField.type.replace(/[[\]!]/g, '');
          if (isScalar(nestedBaseType) && nestedBaseType === scalarType) {
            paths.push({
              path: `${operationName} { ${field.name} { ${nestedField.name} } }`,
              displayName: `${operationName} { ${field.name} { ${nestedField.name} } }`
            });
          }
        });
      }
    }
  });
  
  return paths;
}
