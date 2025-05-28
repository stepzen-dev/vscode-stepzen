/**
 * Copyright IBM Corp. 2025
 * Assisted by CursorAI
 */

import * as vscode from 'vscode';

/**
 * Represents a directive argument with its name and value
 */
// ts-prune-ignore-next
export interface DirectiveArgument {
  name: string;
  value: string | number | boolean | object | DirectiveArgument[];
  isString?: boolean; // Whether to wrap in quotes
}

/**
 * Configuration for building a directive
 */
// ts-prune-ignore-next
export interface DirectiveConfig {
  name: string; // Directive name (without @)
  arguments: DirectiveArgument[];
  multiline?: boolean; // Whether to format as multiline
}

/**
 * Options for directive insertion
 */
// ts-prune-ignore-next
export interface DirectiveInsertOptions {
  position?: vscode.Position; // Where to insert (defaults to line after cursor)
  baseIndent?: string; // Base indentation (auto-detected if not provided)
  editor?: vscode.TextEditor; // Editor to insert into (defaults to active editor)
}

/**
 * Utility class for building and inserting GraphQL directives
 */
export class DirectiveBuilder {
  /**
   * Builds a formatted directive string
   */
  static buildDirective(config: DirectiveConfig, indentUnit: string = '  ', baseIndent: string = ''): string {
    const { name, arguments: args, multiline = true } = config;

    if (args.length === 0) {
      return `${baseIndent}@${name}`;
    }

    if (!multiline || args.length === 1) {
      // Single line format: @directive(arg: value)
      const argStrings = args.map(arg => this.formatArgument(arg));
      return `${baseIndent}@${name}(${argStrings.join(', ')})`;
    }

    // Multiline format
    const directiveIndent = baseIndent + indentUnit;
    const innerIndent = directiveIndent + indentUnit;
    
    const lines: string[] = [];
    lines.push(`${directiveIndent}@${name}(`);
    
    args.forEach((arg, index) => {
      const formattedArg = this.formatArgument(arg, innerIndent, indentUnit);
      const isLast = index === args.length - 1;
      lines.push(`${innerIndent}${formattedArg}${isLast ? '' : ''}`);
    });
    
    lines.push(`${directiveIndent})`);
    
    return lines.join('\n');
  }

  /**
   * Formats a single directive argument
   */
  private static formatArgument(arg: DirectiveArgument, baseIndent: string = '', indentUnit: string = '  '): string {
    const { name, value, isString = true } = arg;

    if (Array.isArray(value)) {
      // Handle array arguments like arguments: [...]
      if (value.length === 0) {
        return `${name}: []`;
      }

      const innerIndent = baseIndent + indentUnit;
      const lines: string[] = [];
      lines.push(`${name}: [`);
      
      value.forEach((item, _index) => {
        let formattedItem: string;
        if (typeof item === 'string') {
          // Handle string array items (like graphql visibility patterns)
          formattedItem = `"${item}"`;
        } else if (typeof item === 'object' && item !== null && 'expose' in item && 'types' in item && 'fields' in item) {
          // Handle StepZen_VisibilityPattern objects like { expose: true, types: "Query", fields: ".*" }
          const expose = item.expose !== undefined ? String(item.expose) : 'true';
          formattedItem = `{ expose: ${expose}, types: "${item.types}", fields: "${item.fields}" }`;
        } else if (typeof item === 'object' && item !== null && 'name' in item && 'description' in item) {
          // Handle description objects like { name: "query", description: "..." }
          formattedItem = `{ name: "${item.name}", description: "${item.description}" }`;
        } else if (typeof item === 'object' && item !== null && 'name' in item && 'field' in item) {
          // Handle argument mapping objects like { name: "arg", field: "field" }
          formattedItem = `{ name: "${item.name}", field: "${item.field}" }`;
        } else if (typeof item === 'object' && item !== null) {
          // Handle other object types
          const objArgs = Object.entries(item).map(([key, val]) => {
            const stringVal = typeof val === 'string' ? `"${val}"` : String(val);
            return `${key}: ${stringVal}`;
          });
          formattedItem = `{ ${objArgs.join(', ')} }`;
        } else {
          // Handle primitive values
          formattedItem = typeof item === 'string' ? `"${item}"` : String(item);
        }
        lines.push(`${innerIndent}${indentUnit}${formattedItem}`);
      });
      
      lines.push(`${innerIndent}]`);
      return lines.join('\n');
    }

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // Handle object arguments like { name: "value", field: "field" }
      const objArgs = Object.entries(value).map(([key, val]) => {
        const stringVal = typeof val === 'string' ? `"${val}"` : String(val);
        return `${key}: ${stringVal}`;
      });
      return `${name}: { ${objArgs.join(', ')} }`;
    }

    // Handle primitive values
    let formattedValue: string;
    if (typeof value === 'string' && isString) {
      formattedValue = `"${value}"`;
    } else {
      formattedValue = String(value);
    }

    return `${name}: ${formattedValue}`;
  }

  /**
   * Inserts a directive into the editor
   */
  static async insertDirective(
    config: DirectiveConfig, 
    options: DirectiveInsertOptions = {}
  ): Promise<boolean> {
    const editor = options.editor || vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No active editor');
      return false;
    }

    // Determine indentation
    const position = options.position || editor.selection.active;
    const line = editor.document.lineAt(position.line);
    const baseIndent = options.baseIndent || 
      line.text.substring(0, line.firstNonWhitespaceCharacterIndex);

    const indentUnit = editor.options.insertSpaces
      ? ' '.repeat(editor.options.tabSize as number)
      : '\t';

    // Build the directive
    const directiveText = this.buildDirective(config, indentUnit, baseIndent);

    // Insert the directive
    const insertPosition = options.position || new vscode.Position(position.line + 1, 0);
    await editor.insertSnippet(
      new vscode.SnippetString(directiveText),
      insertPosition
    );

    return true;
  }

  /**
   * Creates a materializer directive configuration
   */
  static createMaterializerConfig(query: string, argumentMappings: Array<{name: string, field: string}>): DirectiveConfig {
    const args: DirectiveArgument[] = [
      { name: 'query', value: query, isString: true }
    ];

    if (argumentMappings.length > 0) {
      args.push({
        name: 'arguments',
        value: argumentMappings,
        isString: false
      });
    }

    return {
      name: 'materializer',
      arguments: args,
      multiline: true
    };
  }

  /**
   * Creates a value directive configuration
   */
  static createValueConfig(options: { const?: any, script?: { language?: string, src: string } }): DirectiveConfig {
    const args: DirectiveArgument[] = [];

    if (options.const !== undefined) {
      args.push({
        name: 'const',
        value: typeof options.const === 'string' ? options.const : JSON.stringify(options.const),
        isString: typeof options.const === 'string'
      });
    }

    if (options.script) {
      const scriptObj: any = { src: options.script.src };
      if (options.script.language) {
        scriptObj.language = options.script.language;
      }

      args.push({
        name: 'script',
        value: scriptObj,
        isString: false
      });
    }

    return {
      name: 'value',
      arguments: args,
      multiline: args.length > 1
    };
  }

  /**
   * Creates a tool directive configuration
   */
  static createToolConfig(options: {
    name: string;
    description?: string;
    graphql?: Array<{expose: boolean, types: string, fields: string}>;
    visibilityPatterns?: Array<{expose: boolean, types: string, fields: string}>;
    descriptions?: Array<{name: string, description: string}>;
  }): DirectiveConfig {
    const args: DirectiveArgument[] = [
      { name: 'name', value: options.name, isString: true }
    ];

    if (options.description) {
      args.push({
        name: 'description',
        value: options.description,
        isString: true
      });
    }

    // Handle both graphql and visibilityPatterns for backward compatibility
    const patterns = options.visibilityPatterns || options.graphql;
    if (patterns && patterns.length > 0) {
      args.push({
        name: 'graphql',
        value: patterns,
        isString: false
      });
    }

    if (options.descriptions && options.descriptions.length > 0) {
      args.push({
        name: 'descriptions',
        value: options.descriptions,
        isString: false
      });
    }

    return {
      name: 'tool',
      arguments: args,
      multiline: true
    };
  }
} 