/**
 * Copyright IBM Corp. 2025
 * Assisted by CursorAI
 */

import * as vscode from 'vscode';
import { services } from '../services';
import { handleError } from '../errors';
import { DirectiveBuilder } from '../utils/directiveBuilder';

/**
 * Adds a @tool directive to a GraphQL schema
 * Provides options for GraphQL tools and prescribed tools
 * 
 * @returns Promise that resolves when the tool directive has been added or operation is cancelled
 */
export async function addTool() {
  try {
    services.logger.info("Starting Add Tool command");
    
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No active editor');
      services.logger.warn("Add Tool failed: No active editor");
      return;
    }

    const document = editor.document;
    const position = editor.selection.active;
    const line = document.lineAt(position.line);
    const lineText = line.text;

    // Check if we're on a schema definition line
    const trimmed = lineText.trim();
    if (!trimmed.startsWith('schema') && !trimmed.includes('schema')) {
      vscode.window.showInformationMessage(
        'Place cursor on a GraphQL schema definition to add @tool directive.\n\n' +
        'The @tool directive should be applied to the schema definition, typically in your index.graphql file:\n\n' +
        'schema\n' +
        '  @sdl(files: [...])\n' +
        '  @tool(name: "my-tool", ...)\n' +
        '{\n' +
        '  query: Query\n' +
        '}'
      );
      services.logger.warn("Add Tool failed: Not on a GraphQL schema definition");
      return;
    }

    services.logger.info("Processing schema definition for @tool directive");

    // Show options for tool type
    const toolTypeChoices: vscode.QuickPickItem[] = [
      {
        label: "$(symbol-method) GraphQL Tool",
        description: "Schema subset for LLM-generated requests",
        detail: "Creates a tool with a subset of your schema so LLM can generate GraphQL queries/mutations for specific operations"
      },
      {
        label: "$(file-code) Prescribed Tool", 
        description: "Persisted operation with LLM variable selection",
        detail: "Tool that executes a specific persisted GraphQL operation with LLM-selected variable values"
      },
      {
        label: "$(edit) Custom Tool",
        description: "Manual configuration",
        detail: "Enter custom tool configuration manually"
      }
    ];

    const selectedType = await vscode.window.showQuickPick(toolTypeChoices, {
      placeHolder: 'Select the type of tool directive to add',
      matchOnDescription: true,
      matchOnDetail: true
    });

    if (!selectedType) {
      services.logger.info("Add Tool cancelled by user");
      return;
    }

    if (selectedType.label.includes("GraphQL Tool")) {
      await handleGraphQLTool(editor, position);
    } else if (selectedType.label.includes("Prescribed Tool")) {
      await handlePrescribedTool(editor, position);
    } else if (selectedType.label.includes("Custom Tool")) {
      await handleCustomTool(editor, position);
    }

    services.logger.info("Add Tool completed successfully");
  } catch (err) {
    handleError(err);
  }
}

/**
 * Handles adding a GraphQL tool directive
 */
async function handleGraphQLTool(
  editor: vscode.TextEditor,
  position: vscode.Position
) {
  // Get tool name
  const toolName = await vscode.window.showInputBox({
    prompt: 'Enter tool name (can include {endpoint_folder} and {endpoint_name} variables)',
    placeHolder: 'my-graphql-tool or {endpoint_folder}-{endpoint_name}',
    validateInput: (value) => {
      if (!value.trim()) {
        return 'Tool name cannot be empty';
      }
      return undefined;
    }
  });

  if (!toolName) {
    return;
  }

  // Get tool description (optional)
  const description = await vscode.window.showInputBox({
    prompt: 'Enter tool description (optional)',
    placeHolder: 'Description of what this tool does...'
  });

  // Get available root operation fields from schema
  const fieldIndex = services.schemaIndex.getFieldIndex();
  const queryFields = fieldIndex['Query'] ? fieldIndex['Query'].map(field => field.name) : [];
  const mutationFields = fieldIndex['Mutation'] ? fieldIndex['Mutation'].map(field => field.name) : [];

  // Simple choice: Query, Mutation, or Both
  const operationTypeChoice = await vscode.window.showQuickPick([
    {
      label: "$(search) Query fields only",
      description: "Include Query operations (read-only)",
      detail: `${queryFields.length} Query fields available`
    },
    {
      label: "$(edit) Mutation fields only", 
      description: "Include Mutation operations (write operations)",
      detail: `${mutationFields.length} Mutation fields available`
    },
    {
      label: "$(database) Both Query and Mutation fields",
      description: "Include both read and write operations",
      detail: `${queryFields.length + mutationFields.length} total fields available`
    }
  ], {
    placeHolder: 'Which operation types should this tool include?'
  });

  if (!operationTypeChoice) {
    return;
  }

  let visibilityPatterns: Array<{expose: boolean, types: string, fields: string}> = [];
  let selectedFields: string[] = [];

  // Field selection based on choice
  if (operationTypeChoice.label.includes("Query fields only")) {
    if (queryFields.length > 0) {
      selectedFields = await selectFields(queryFields, "Query");
      if (selectedFields.length === 0) {
        return;
      }
      
      const fieldPattern = selectedFields.join('|');
      visibilityPatterns = [
        { expose: true, types: "Query", fields: fieldPattern },
        { expose: false, types: "Mutation", fields: ".*" }
      ];
    } else {
      visibilityPatterns = [
        { expose: true, types: "Query", fields: ".*" },
        { expose: false, types: "Mutation", fields: ".*" }
      ];
    }
  } else if (operationTypeChoice.label.includes("Mutation fields only")) {
    if (mutationFields.length > 0) {
      selectedFields = await selectFields(mutationFields, "Mutation");
      if (selectedFields.length === 0) {
        return;
      }
      
      const fieldPattern = selectedFields.join('|');
      visibilityPatterns = [
        { expose: false, types: "Query", fields: ".*" },
        { expose: true, types: "Mutation", fields: fieldPattern }
      ];
    } else {
      visibilityPatterns = [
        { expose: false, types: "Query", fields: ".*" },
        { expose: true, types: "Mutation", fields: ".*" }
      ];
    }
  } else { // Both Query and Mutation
    const allFields = [...queryFields.map(f => `Query.${f}`), ...mutationFields.map(f => `Mutation.${f}`)];
    
    if (allFields.length > 0) {
      const selectedAllFields = await selectFields(allFields, "Query and Mutation");
      if (selectedAllFields.length === 0) {
        return;
      }
      
      // Separate selected fields by type
      const selectedQueryFields = selectedAllFields
        .filter(f => f.startsWith('Query.'))
        .map(f => f.replace('Query.', ''));
      const selectedMutationFields = selectedAllFields
        .filter(f => f.startsWith('Mutation.'))
        .map(f => f.replace('Mutation.', ''));
      
      visibilityPatterns = [];
      if (selectedQueryFields.length > 0) {
        visibilityPatterns.push({ expose: true, types: "Query", fields: selectedQueryFields.join('|') });
      }
      if (selectedMutationFields.length > 0) {
        visibilityPatterns.push({ expose: true, types: "Mutation", fields: selectedMutationFields.join('|') });
      }
      
      // Hide unselected fields
      if (selectedQueryFields.length < queryFields.length) {
        const unselectedQuery = queryFields.filter(f => !selectedQueryFields.includes(f));
        if (unselectedQuery.length > 0) {
          visibilityPatterns.push({ expose: false, types: "Query", fields: unselectedQuery.join('|') });
        }
      }
      if (selectedMutationFields.length < mutationFields.length) {
        const unselectedMutation = mutationFields.filter(f => !selectedMutationFields.includes(f));
        if (unselectedMutation.length > 0) {
          visibilityPatterns.push({ expose: false, types: "Mutation", fields: unselectedMutation.join('|') });
        }
      }
    } else {
      // No fields found, use wildcard patterns
      visibilityPatterns = [
        { expose: true, types: "Query", fields: ".*" },
        { expose: true, types: "Mutation", fields: ".*" }
      ];
    }
  }

  // Ask about parameter descriptions (simplified)
  const addDescriptions = await vscode.window.showQuickPick([
    { label: "$(x) No", description: "Skip parameter descriptions" },
    { label: "$(check) Yes", description: "Add parameter descriptions" }
  ], {
    placeHolder: 'Add descriptions for GraphQL tool parameters?'
  });

  let descriptions: Array<{name: string, description: string}> = [];

  if (addDescriptions?.label.includes("Yes")) {
    descriptions = [
      { name: "query", description: "The GraphQL query or mutation to execute" },
      { name: "operationName", description: "Name of the operation to execute (for documents with multiple operations)" },
      { name: "variables", description: "Variables to pass to the GraphQL operation" }
    ];
  }

  // Create and insert the directive
  const config = DirectiveBuilder.createToolConfig({
    name: toolName,
    description: description || undefined,
    visibilityPatterns: visibilityPatterns,
    descriptions: descriptions.length > 0 ? descriptions : undefined
  });

  await DirectiveBuilder.insertDirective(config, { editor, position });
}

/**
 * Helper function to select fields from available options
 */
async function selectFields(
  availableFields: string[], 
  operationType: string
): Promise<string[]> {
  if (availableFields.length === 0) {
    vscode.window.showInformationMessage(`No ${operationType} fields found in schema. Using wildcard pattern.`);
    return [];
  }

  // If only a few fields, show them all for selection
  if (availableFields.length <= 10) {
    const fieldItems = availableFields.map(field => ({
      label: field,
      description: `Include ${field} in the tool`,
      picked: true // Default to all selected
    }));

    const selectedItems = await vscode.window.showQuickPick(fieldItems, {
      placeHolder: `Select ${operationType} fields to include in the tool`,
      canPickMany: true,
      matchOnDescription: true
    });

    return selectedItems ? selectedItems.map(item => item.label) : [];
  } else {
    // Too many fields, offer pattern-based selection
    const patternChoice = await vscode.window.showQuickPick([
      {
        label: "$(check-all) All fields",
        description: `Include all ${availableFields.length} ${operationType} fields`,
        detail: "Uses .* pattern to include everything"
      },
      {
        label: "$(filter) Enter pattern",
        description: "Enter a regex pattern to match field names",
        detail: "e.g., 'customer.*' or 'get.*|list.*'"
      },
      {
        label: "$(list-unordered) Select specific fields",
        description: "Choose from a list of available fields",
        detail: `Browse and select from ${availableFields.length} fields`
      }
    ], {
      placeHolder: `How would you like to select ${operationType} fields?`
    });

    if (!patternChoice) {
      return [];
    }

    if (patternChoice.label.includes("All fields")) {
      return availableFields;
    } else if (patternChoice.label.includes("Enter pattern")) {
      const pattern = await vscode.window.showInputBox({
        prompt: `Enter regex pattern to match ${operationType} field names`,
        placeHolder: 'customer.*|order.*|get.*',
        validateInput: (value) => {
          if (!value.trim()) {
            return 'Pattern cannot be empty';
          }
          try {
            new RegExp(value);
            return undefined;
          } catch {
            return 'Invalid regex pattern';
          }
        }
      });

      if (!pattern) {
        return [];
      }

      // Filter fields by pattern
      try {
        const regex = new RegExp(pattern);
        const matchingFields = availableFields.filter(field => regex.test(field));
        
        if (matchingFields.length === 0) {
          vscode.window.showWarningMessage(`No fields match pattern "${pattern}"`);
          return [];
        }

        vscode.window.showInformationMessage(`Pattern "${pattern}" matches ${matchingFields.length} fields`);
        return matchingFields;
      } catch {
        vscode.window.showErrorMessage('Invalid regex pattern');
        return [];
      }
    } else {
      // Select specific fields - show in chunks if too many
      const fieldItems = availableFields.map(field => ({
        label: field,
        description: `Include ${field} in the tool`
      }));

      const selectedItems = await vscode.window.showQuickPick(fieldItems, {
        placeHolder: `Select specific ${operationType} fields to include`,
        canPickMany: true,
        matchOnDescription: true
      });

      return selectedItems ? selectedItems.map(item => item.label) : [];
    }
  }
}

/**
 * Handles adding a prescribed tool directive
 */
async function handlePrescribedTool(
  editor: vscode.TextEditor,
  position: vscode.Position
) {
  // Get tool name
  const toolName = await vscode.window.showInputBox({
    prompt: 'Enter tool name (can include {endpoint_folder} and {endpoint_name} variables)',
    placeHolder: 'my-prescribed-tool or {endpoint_folder}-{endpoint_name}',
    validateInput: (value) => {
      if (!value.trim()) {
        return 'Tool name cannot be empty';
      }
      return undefined;
    }
  });

  if (!toolName) {
    return;
  }

  // Get tool description (optional)
  const description = await vscode.window.showInputBox({
    prompt: 'Enter tool description (optional)',
    placeHolder: 'Description of what this prescribed tool does...'
  });

  // Ask about variable descriptions
  const addDescriptions = await vscode.window.showQuickPick([
    { label: "$(check) Yes", description: "Add variable descriptions" },
    { label: "$(x) No", description: "Skip variable descriptions" }
  ], {
    placeHolder: 'Add custom descriptions for operation variables?'
  });

  let descriptions: Array<{name: string, description: string}> = [];

  if (addDescriptions?.label.includes("Yes")) {
    vscode.window.showInformationMessage(
      'For prescribed tools, add variable descriptions after creating the directive. ' +
      'Use the format: {name: "variableName", description: "description"}'
    );

    // Allow user to add some common variable descriptions
    let addMore = true;
    while (addMore) {
      const varName = await vscode.window.showInputBox({
        prompt: 'Enter variable name (without $)',
        placeHolder: 'email, userId, filter.since'
      });

      if (!varName) {
        break;
      }

      const varDesc = await vscode.window.showInputBox({
        prompt: `Enter description for variable "${varName}"`,
        placeHolder: 'Description of this variable...'
      });

      if (varDesc && varDesc.trim()) {
        descriptions.push({ name: varName, description: varDesc.trim() });
      }

      const continueAdding = await vscode.window.showQuickPick([
        { label: "$(add) Add another variable", description: "Continue adding variable descriptions" },
        { label: "$(check) Done", description: "Finish adding descriptions" }
      ], {
        placeHolder: 'Add more variable descriptions?'
      });

      addMore = continueAdding?.label.includes("Add another") || false;
    }
  }

  // Create and insert the directive
  const config = DirectiveBuilder.createToolConfig({
    name: toolName,
    description: description || undefined,
    descriptions: descriptions.length > 0 ? descriptions : undefined
  });

  await DirectiveBuilder.insertDirective(config, { editor, position });
}

/**
 * Handles adding a custom tool directive
 */
async function handleCustomTool(
  editor: vscode.TextEditor,
  position: vscode.Position
) {
  // Get tool name
  const toolName = await vscode.window.showInputBox({
    prompt: 'Enter tool name (can include {endpoint_folder} and {endpoint_name} variables)',
    placeHolder: 'my-custom-tool or {endpoint_folder}-{endpoint_name}',
    validateInput: (value) => {
      if (!value.trim()) {
        return 'Tool name cannot be empty';
      }
      return undefined;
    }
  });

  if (!toolName) {
    return;
  }

  // Create minimal directive and let user customize
  const config = DirectiveBuilder.createToolConfig({
    name: toolName
  });

  await DirectiveBuilder.insertDirective(config, { editor, position });

  vscode.window.showInformationMessage(
    'Basic @tool directive inserted. Customize it by adding description, graphql, or descriptions arguments as needed.'
  );
} 