/**
 * Copyright IBM Corp. 2025
 * Assisted by CursorAI
 */

import * as vscode from 'vscode';
import { services } from '../services';
import { handleError } from '../errors';
import { DirectiveBuilder } from '../utils/directiveBuilder';

/**
 * Adds a @value directive to a GraphQL field
 * Provides options for constant values or script-based values
 * 
 * @returns Promise that resolves when the value directive has been added or operation is cancelled
 */
export async function addValue() {
  try {
    services.logger.info("Starting Add Value command");
    
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No active editor');
      services.logger.warn("Add Value failed: No active editor");
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
      services.logger.warn("Add Value failed: Not on a GraphQL field definition");
      return;
    }
    
    const fieldName = fieldMatch[1];
    const declaredType = fieldMatch[2];
    services.logger.info(`Processing field "${fieldName}" with type: ${declaredType}`);

    // Determine base type (remove list and non-null wrappers)
    const baseType = declaredType.replace(/[[\]!]/g, '');

    // Show options for value type
    const valueTypeChoices: vscode.QuickPickItem[] = [
      {
        label: "$(symbol-constant) Constant Value",
        description: "Set a fixed value",
        detail: "Uses @value(const: value) to set a constant value"
      },
      {
        label: "$(code) Script Value", 
        description: "Computed value from script",
        detail: "Uses @value(script: {...}) to compute value dynamically"
      },
      {
        label: "$(x) Null Value",
        description: "Always returns null",
        detail: "Uses @value with no arguments to return null"
      }
    ];

    const selectedType = await vscode.window.showQuickPick(valueTypeChoices, {
      placeHolder: 'Select the type of value directive to add',
      matchOnDescription: true,
      matchOnDetail: true
    });

    if (!selectedType) {
      services.logger.info("Add Value cancelled by user");
      return;
    }

    if (selectedType.label.includes("Null Value")) {
      // Insert null value directive
      const config = DirectiveBuilder.createValueConfig({});
      await DirectiveBuilder.insertDirective(config, { editor, position });
      services.logger.info("Null value directive added successfully");
      return;
    }

    if (selectedType.label.includes("Constant Value")) {
      await handleConstantValue(fieldName, baseType, editor, position);
    } else if (selectedType.label.includes("Script Value")) {
      await handleScriptValue(fieldName, baseType, editor, position);
    }

    services.logger.info("Add Value completed successfully");
  } catch (err) {
    handleError(err);
  }
}

/**
 * Handles adding a constant value directive
 */
async function handleConstantValue(
  fieldName: string,
  fieldType: string,
  editor: vscode.TextEditor,
  position: vscode.Position
) {
  // Get suggested values based on field type
  const suggestions = getSuggestedConstantValues(fieldType, fieldName);
  
  const choices: vscode.QuickPickItem[] = [
    {
      label: "$(edit) Custom value",
      description: "Enter a custom value",
      detail: "Type your own constant value"
    }
  ];

  if (suggestions.length > 0) {
    choices.push({ label: "", kind: vscode.QuickPickItemKind.Separator });
    suggestions.forEach(suggestion => {
      choices.push({
        label: `$(symbol-constant) ${suggestion.display}`,
        description: suggestion.description,
        detail: `Value: ${suggestion.value}`
      });
    });
  }

  const selected = await vscode.window.showQuickPick(choices, {
    placeHolder: `Select a constant value for ${fieldType} field "${fieldName}"`,
    matchOnDescription: true,
    matchOnDetail: true
  });

  if (!selected) {
    return;
  }

  let constantValue: any;

  if (selected.label.includes("Custom value")) {
    // Let user enter custom value
    const inputValue = await vscode.window.showInputBox({
      prompt: `Enter constant value for ${fieldType} field "${fieldName}"`,
      placeHolder: getPlaceholderForType(fieldType),
      validateInput: (value) => validateConstantValue(value, fieldType)
    });

    if (!inputValue) {
      return;
    }

    constantValue = parseConstantValue(inputValue, fieldType);
  } else {
    // Use selected suggestion
    const suggestion = suggestions.find(s => selected.label.includes(s.display));
    if (!suggestion) {
      return;
    }
    constantValue = suggestion.value;
  }

  // Create and insert the directive
  const config = DirectiveBuilder.createValueConfig({ const: constantValue });
  await DirectiveBuilder.insertDirective(config, { editor, position });
}

/**
 * Handles adding a script-based value directive
 */
async function handleScriptValue(
  fieldName: string,
  fieldType: string,
  editor: vscode.TextEditor,
  position: vscode.Position
) {
  // Show script language options
  const languageChoices: vscode.QuickPickItem[] = [
    {
      label: "$(code) ECMAScript",
      description: "JavaScript/ECMAScript 5.1",
      detail: "Most common choice for computed values"
    },
    {
      label: "$(json) JSONata",
      description: "JSONata query language",
      detail: "Good for data transformation"
    },
    {
      label: "$(search) jq",
      description: "jq query language", 
      detail: "JSON processing and filtering"
    }
  ];

  const selectedLang = await vscode.window.showQuickPick(languageChoices, {
    placeHolder: 'Select script language',
    matchOnDescription: true,
    matchOnDetail: true
  });

  if (!selectedLang) {
    return;
  }

  const language = selectedLang.label.includes("ECMAScript") ? "ECMASCRIPT" :
                  selectedLang.label.includes("JSONata") ? "JSONATA" : "JQ";

  // Get script templates
  const templates = getScriptTemplates(fieldType, fieldName, language);
  
  const templateChoices: vscode.QuickPickItem[] = [
    {
      label: "$(edit) Custom script",
      description: "Write your own script",
      detail: "Enter custom script code"
    }
  ];

  if (templates.length > 0) {
    templateChoices.push({ label: "", kind: vscode.QuickPickItemKind.Separator });
    templates.forEach(template => {
      templateChoices.push({
        label: `$(file-code) ${template.name}`,
        description: template.description,
        detail: template.preview
      });
    });
  }

  const selectedTemplate = await vscode.window.showQuickPick(templateChoices, {
    placeHolder: `Select a script template for ${fieldType} field "${fieldName}"`,
    matchOnDescription: true,
    matchOnDetail: true
  });

  if (!selectedTemplate) {
    return;
  }

  let scriptSrc: string;

  if (selectedTemplate.label.includes("Custom script")) {
    // Let user enter custom script
    const inputScript = await vscode.window.showInputBox({
      prompt: `Enter ${language} script for ${fieldType} field "${fieldName}"`,
      placeHolder: getScriptPlaceholder(language, fieldType),
      value: getDefaultScript(language, fieldType)
    });

    if (!inputScript) {
      return;
    }

    scriptSrc = inputScript;
  } else {
    // Use selected template
    const template = templates.find(t => selectedTemplate.label.includes(t.name));
    if (!template) {
      return;
    }
    scriptSrc = template.code;
  }

  // Create and insert the directive
  const config = DirectiveBuilder.createValueConfig({ 
    script: { 
      language: language === "ECMASCRIPT" ? undefined : language, // ECMAScript is default
      src: scriptSrc 
    } 
  });
  await DirectiveBuilder.insertDirective(config, { editor, position });
}

/**
 * Gets suggested constant values based on field type and name
 */
function getSuggestedConstantValues(fieldType: string, fieldName: string): Array<{display: string, value: any, description: string}> {
  const suggestions: Array<{display: string, value: any, description: string}> = [];

  switch (fieldType) {
    case 'String':
      suggestions.push(
        { display: '""', value: "", description: "Empty string" },
        { display: '"N/A"', value: "N/A", description: "Not available" },
        { display: '"TBD"', value: "TBD", description: "To be determined" }
      );
      if (fieldName.toLowerCase().includes('status')) {
        suggestions.push(
          { display: '"active"', value: "active", description: "Active status" },
          { display: '"inactive"', value: "inactive", description: "Inactive status" }
        );
      }
      break;
    case 'Int':
      suggestions.push(
        { display: '0', value: 0, description: "Zero" },
        { display: '1', value: 1, description: "One" },
        { display: '-1', value: -1, description: "Negative one" }
      );
      break;
    case 'Float':
      suggestions.push(
        { display: '0.0', value: 0.0, description: "Zero" },
        { display: '1.0', value: 1.0, description: "One" },
        { display: '0.5', value: 0.5, description: "Half" }
      );
      break;
    case 'Boolean':
      suggestions.push(
        { display: 'true', value: true, description: "True value" },
        { display: 'false', value: false, description: "False value" }
      );
      break;
    case 'ID':
      suggestions.push(
        { display: '"0"', value: "0", description: "Zero ID" },
        { display: '"unknown"', value: "unknown", description: "Unknown ID" }
      );
      break;
    case 'Date':
      suggestions.push(
        { display: '"2024-01-01"', value: "2024-01-01", description: "ISO date format" },
        { display: '"2024-12-31"', value: "2024-12-31", description: "End of year" }
      );
      break;
    case 'DateTime':
      suggestions.push(
        { display: '"2024-01-01T00:00:00Z"', value: "2024-01-01T00:00:00Z", description: "ISO datetime format" },
        { display: '"2024-01-01T12:00:00Z"', value: "2024-01-01T12:00:00Z", description: "Noon UTC" }
      );
      break;
    case 'JSON':
      suggestions.push(
        { display: '{}', value: {}, description: "Empty object" },
        { display: '[]', value: [], description: "Empty array" },
        { display: 'null', value: null, description: "Null value" }
      );
      break;
    case 'Secret':
      suggestions.push(
        { display: '"********"', value: "********", description: "Placeholder secret" },
        { display: '"$ENV_VAR"', value: "$ENV_VAR", description: "Environment variable reference" }
      );
      break;
  }

  return suggestions;
}

/**
 * Gets script templates for a given field type and language
 */
function getScriptTemplates(fieldType: string, _fieldName: string, language: string): Array<{name: string, description: string, preview: string, code: string}> {
  const templates: Array<{name: string, description: string, preview: string, code: string}> = [];

  if (language === "ECMASCRIPT") {
    switch (fieldType) {
      case 'String':
        templates.push(
          {
            name: "Current timestamp",
            description: "Returns current date/time as string",
            preview: "new Date().toISOString()",
            code: "new Date().toISOString()"
          },
          {
            name: "Field concatenation",
            description: "Combine multiple field values",
            preview: "field1 + ' ' + field2",
            code: "// Replace with actual field names\nfield1 + ' ' + field2"
          }
        );
        break;
      case 'Int':
        templates.push(
          {
            name: "Random number",
            description: "Generate random integer",
            preview: "Math.floor(Math.random() * 100)",
            code: "Math.floor(Math.random() * 100)"
          },
          {
            name: "Field calculation",
            description: "Calculate from other fields",
            preview: "field1 + field2",
            code: "// Replace with actual field names\nfield1 + field2"
          }
        );
        break;
      case 'Boolean':
        templates.push(
          {
            name: "Field comparison",
            description: "Compare field values",
            preview: "field1 > field2",
            code: "// Replace with actual field names\nfield1 > field2"
          },
          {
            name: "Random boolean",
            description: "Generate random true/false",
            preview: "Math.random() > 0.5",
            code: "Math.random() > 0.5"
          }
        );
        break;
      case 'Date':
        templates.push(
          {
            name: "Current date",
            description: "Today's date in ISO format",
            preview: "new Date().toISOString().split('T')[0]",
            code: "new Date().toISOString().split('T')[0]"
          },
          {
            name: "Date calculation",
            description: "Add/subtract days from current date",
            preview: "new Date(Date.now() + 7*24*60*60*1000).toISOString().split('T')[0]",
            code: "// Add 7 days to current date\nnew Date(Date.now() + 7*24*60*60*1000).toISOString().split('T')[0]"
          }
        );
        break;
      case 'DateTime':
        templates.push(
          {
            name: "Current timestamp",
            description: "Current date and time in ISO format",
            preview: "new Date().toISOString()",
            code: "new Date().toISOString()"
          },
          {
            name: "Future timestamp",
            description: "Add time to current timestamp",
            preview: "new Date(Date.now() + 3600000).toISOString()",
            code: "// Add 1 hour to current time\nnew Date(Date.now() + 3600000).toISOString()"
          }
        );
        break;
      case 'JSON':
        templates.push(
          {
            name: "Dynamic object",
            description: "Create object from field values",
            preview: "{ key: field1, value: field2 }",
            code: "// Replace with actual field names\n{ key: field1, value: field2 }"
          },
          {
            name: "Metadata object",
            description: "Common metadata structure",
            preview: "{ createdAt: new Date().toISOString(), version: '1.0' }",
            code: "{ createdAt: new Date().toISOString(), version: '1.0' }"
          }
        );
        break;
      case 'Secret':
        templates.push(
          {
            name: "Environment variable",
            description: "Reference environment variable",
            preview: "process.env.API_KEY",
            code: "// Replace with actual environment variable\nprocess.env.API_KEY"
          },
          {
            name: "JWT claim",
            description: "Extract secret from JWT",
            preview: "$jwt.secret_claim",
            code: "// Replace with actual claim name\n$jwt.secret_claim"
          }
        );
        break;
    }

    // Add JWT-based templates for all types
    templates.push({
      name: "From JWT claim",
      description: "Extract value from JWT token",
      preview: "$jwt.sub",
      code: "// Replace 'sub' with desired claim\n$jwt.sub"
    });
  }

  return templates;
}

/**
 * Gets placeholder text for input based on field type
 */
function getPlaceholderForType(fieldType: string): string {
  switch (fieldType) {
    case 'String': return '"example string"';
    case 'Int': return '42';
    case 'Float': return '3.14';
    case 'Boolean': return 'true';
    case 'ID': return '"unique-id"';
    case 'Date': return '"2024-01-01"';
    case 'DateTime': return '"2024-01-01T12:00:00Z"';
    case 'JSON': return '{"key": "value"}';
    case 'Secret': return '"$ENV_VAR"';
    default: return 'value';
  }
}

/**
 * Gets script placeholder based on language and type
 */
function getScriptPlaceholder(language: string, fieldType: string): string {
  switch (language) {
    case 'ECMASCRIPT':
      return fieldType === 'String' ? '"computed value"' : 'computed_value';
    case 'JSONATA':
      return '$';
    case 'JQ':
      return '.';
    default:
      return 'script';
  }
}

/**
 * Gets default script template
 */
function getDefaultScript(language: string, fieldType: string): string {
  switch (language) {
    case 'ECMASCRIPT':
      return fieldType === 'String' ? '"default value"' : '0';
    case 'JSONATA':
      return '"default value"';
    case 'JQ':
      return '"default value"';
    default:
      return '';
  }
}

/**
 * Validates a constant value input
 */
function validateConstantValue(value: string, fieldType: string): string | undefined {
  if (!value.trim()) {
    return 'Value cannot be empty';
  }

  try {
    parseConstantValue(value, fieldType);
    return undefined; // Valid
  } catch (err) {
    return `Invalid ${fieldType} value: ${err instanceof Error ? err.message : 'Unknown error'}`;
  }
}

/**
 * Parses a constant value string into the appropriate type
 */
function parseConstantValue(value: string, fieldType: string): any {
  const trimmed = value.trim();

  switch (fieldType) {
    case 'String':
      // If it's quoted, remove quotes; otherwise use as-is
      if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
          (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
        return trimmed.slice(1, -1);
      }
      return trimmed;
    
    case 'Int':
      const intVal = parseInt(trimmed, 10);
      if (isNaN(intVal)) {
        throw new Error('Must be a valid integer');
      }
      return intVal;
    
    case 'Float':
      const floatVal = parseFloat(trimmed);
      if (isNaN(floatVal)) {
        throw new Error('Must be a valid number');
      }
      return floatVal;
    
    case 'Boolean':
      if (trimmed === 'true') {
        return true;
      }
      if (trimmed === 'false') {
        return false;
      }
      throw new Error('Must be true or false');
    
    case 'ID':
      // IDs are strings
      if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
          (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
        return trimmed.slice(1, -1);
      }
      return trimmed;
    
    case 'Date':
      // Date should be a string in ISO date format
      let dateStr = trimmed;
      if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
          (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
        dateStr = trimmed.slice(1, -1);
      }
      // Validate date format (basic check)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        throw new Error('Must be in YYYY-MM-DD format');
      }
      return dateStr;
    
    case 'DateTime':
      // DateTime should be a string in ISO datetime format
      let dateTimeStr = trimmed;
      if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
          (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
        dateTimeStr = trimmed.slice(1, -1);
      }
      // Validate datetime format (basic check)
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/.test(dateTimeStr)) {
        throw new Error('Must be in ISO datetime format (e.g., 2024-01-01T12:00:00Z)');
      }
      return dateTimeStr;
    
    case 'JSON':
      // JSON can be any valid JSON value
      try {
        return JSON.parse(trimmed);
      } catch {
        throw new Error('Must be valid JSON');
      }
    
    case 'Secret':
      // Secret is a string, often an environment variable reference
      if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
          (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
        return trimmed.slice(1, -1);
      }
      return trimmed;
    
    default:
      // Try to parse as JSON for complex types
      try {
        return JSON.parse(trimmed);
      } catch {
        return trimmed;
      }
  }
} 