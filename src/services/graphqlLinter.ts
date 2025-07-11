/**
 * Copyright IBM Corp. 2025
 * Assisted by CursorAI
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import { parse, visit, DocumentNode, ObjectTypeDefinitionNode, FieldDefinitionNode, OperationDefinitionNode } from 'graphql';
import { logger } from './logger';
import { StepZenError } from '../errors';

/**
 * Custom GraphQL linting rule interface
 */
interface GraphQLLintRule {
  name: string;
  severity: 'error' | 'warn' | 'info';
  check: (ast: DocumentNode) => GraphQLLintIssue[];
}

/**
 * GraphQL linting issue interface
 */
interface GraphQLLintIssue {
  message: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  rule: string;
  severity: 'error' | 'warn' | 'info';
}

/**
 * Service for linting GraphQL schema files using the GraphQL parser
 * Provides custom linting rules without external ESLint dependencies
 */
export class GraphQLLinterService {
  private diagnosticCollection: vscode.DiagnosticCollection;
  private rules: GraphQLLintRule[] = [];
  private isInitialized = false;

  constructor() {
    this.diagnosticCollection = vscode.languages.createDiagnosticCollection('stepzen-graphql-lint');
    this.initializeRules();
  }

  /**
   * Initialize built-in GraphQL linting rules
   */
  private initializeRules(): void {
    // Get enabled rules from configuration
    const config = vscode.workspace.getConfiguration('stepzen');
    const enabledRules = config.get('graphqlLintRules', {
      'no-anonymous-operations': true,
      'no-duplicate-fields': true,
      'require-description': true,
      'require-deprecation-reason': true,
      'field-naming-convention': true,
      'root-fields-nullable': true
    });

    const allRules: GraphQLLintRule[] = [];

    // Rule: No anonymous operations
    if (enabledRules['no-anonymous-operations']) {
      allRules.push({
        name: 'no-anonymous-operations',
        severity: 'error' as const,
        check: (ast: DocumentNode): GraphQLLintIssue[] => {
          const issues: GraphQLLintIssue[] = [];
          visit(ast, {
            OperationDefinition(node: OperationDefinitionNode) {
              if (!node.name && node.loc) {
                issues.push({
                  message: 'Anonymous operations are not allowed. Please provide a name for this operation.',
                  line: node.loc.startToken.line,
                  column: node.loc.startToken.column,
                  endLine: node.loc.endToken.line,
                  endColumn: node.loc.endToken.column,
                  rule: 'no-anonymous-operations',
                  severity: 'error'
                });
              }
            }
          });
          return issues;
        }
      });
    }

    // Rule: No duplicate fields
    if (enabledRules['no-duplicate-fields']) {
      allRules.push({
        name: 'no-duplicate-fields',
        severity: 'error' as const,
        check: (ast: DocumentNode): GraphQLLintIssue[] => {
          const issues: GraphQLLintIssue[] = [];
          visit(ast, {
            ObjectTypeDefinition(node: ObjectTypeDefinitionNode) {
              const fieldNames = new Set<string>();
              const duplicateFields = new Set<string>();

              node.fields?.forEach(field => {
                const fieldName = field.name.value;
                if (fieldNames.has(fieldName)) {
                  duplicateFields.add(fieldName);
                } else {
                  fieldNames.add(fieldName);
                }
              });

              duplicateFields.forEach(fieldName => {
                node.fields?.forEach(field => {
                  if (field.name.value === fieldName && field.loc) {
                    issues.push({
                      message: `Duplicate field '${fieldName}' found in type '${node.name.value}'`,
                      line: field.loc.startToken.line,
                      column: field.loc.startToken.column,
                      endLine: field.loc.endToken.line,
                      endColumn: field.loc.endToken.column,
                      rule: 'no-duplicate-fields',
                      severity: 'error'
                    });
                  }
                });
              });
            }
          });
          return issues;
        }
      });
    }

    // Rule: Require descriptions for types and fields
    if (enabledRules['require-description']) {
      allRules.push({
        name: 'require-description',
        severity: 'warn' as const,
        check: (ast: DocumentNode): GraphQLLintIssue[] => {
          const issues: GraphQLLintIssue[] = [];
          visit(ast, {
            ObjectTypeDefinition(node: ObjectTypeDefinitionNode) {
              if (!node.description && node.loc) {
                issues.push({
                  message: `Type '${node.name.value}' should have a description`,
                  line: node.loc.startToken.line,
                  column: node.loc.startToken.column,
                  endLine: node.loc.endToken.line,
                  endColumn: node.loc.endToken.column,
                  rule: 'require-description',
                  severity: 'warn'
                });
              }

              node.fields?.forEach(field => {
                if (!field.description && field.loc) {
                  issues.push({
                    message: `Field '${field.name.value}' in type '${node.name.value}' should have a description`,
                    line: field.loc.startToken.line,
                    column: field.loc.startToken.column,
                    endLine: field.loc.endToken.line,
                    endColumn: field.loc.endToken.column,
                    rule: 'require-description',
                    severity: 'warn'
                  });
                }
              });
            }
          });
          return issues;
        }
      });
    }

    // Rule: Check for deprecated fields without reason
    if (enabledRules['require-deprecation-reason']) {
      allRules.push({
        name: 'require-deprecation-reason',
        severity: 'warn' as const,
        check: (ast: DocumentNode): GraphQLLintIssue[] => {
          const issues: GraphQLLintIssue[] = [];
          visit(ast, {
            FieldDefinition(node: FieldDefinitionNode) {
              const deprecatedDirective = node.directives?.find(d => d.name.value === 'deprecated');
              if (deprecatedDirective && node.loc) {
                const reasonArg = deprecatedDirective.arguments?.find(arg => arg.name.value === 'reason');
                if (!reasonArg) {
                  issues.push({
                    message: 'Deprecated fields should include a reason',
                    line: node.loc.startToken.line,
                    column: node.loc.startToken.column,
                    endLine: node.loc.endToken.line,
                    endColumn: node.loc.endToken.column,
                    rule: 'require-deprecation-reason',
                    severity: 'warn'
                  });
                }
              }
            }
          });
          return issues;
        }
      });
    }

    // Rule: Enforce camelCase for field names
    if (enabledRules['field-naming-convention']) {
      allRules.push({
        name: 'field-naming-convention',
        severity: 'warn' as const,
        check: (ast: DocumentNode): GraphQLLintIssue[] => {
          const issues: GraphQLLintIssue[] = [];
          
          // Helper function to check if string is camelCase
          const isCamelCase = (str: string): boolean => {
            return /^[a-z][a-zA-Z0-9]*$/.test(str);
          };

          visit(ast, {
            FieldDefinition(node: FieldDefinitionNode) {
              const fieldName = node.name.value;
              
              // Skip if it's already camelCase or if it's a special field (like __typename)
              if (!isCamelCase(fieldName) && !fieldName.startsWith('__') && node.loc) {
                issues.push({
                  message: `Field '${fieldName}' should use camelCase naming convention`,
                  line: node.loc.startToken.line,
                  column: node.loc.startToken.column,
                  endLine: node.loc.endToken.line,
                  endColumn: node.loc.endToken.column,
                  rule: 'field-naming-convention',
                  severity: 'warn'
                });
              }
            }
          });
          return issues;
        }
      });
    }

    // Rule: Require nullable fields in root operation types
    if (enabledRules['root-fields-nullable']) {
      allRules.push({
        name: 'root-fields-nullable',
        severity: 'warn' as const,
        check: (ast: DocumentNode): GraphQLLintIssue[] => {
          const issues: GraphQLLintIssue[] = [];
          
          visit(ast, {
            ObjectTypeDefinition(node: ObjectTypeDefinitionNode) {
              // Check if this is a root operation type (Query, Mutation, Subscription)
              const typeName = node.name.value;
              const isRootType = typeName === 'Query' || typeName === 'Mutation' || typeName === 'Subscription';
              
              if (isRootType && node.fields) {
                node.fields.forEach(field => {
                  // Check if the field type is non-nullable (ends with !)
                  const fieldType = field.type;
                  
                  // If the field type is a NonNullType, it should be nullable and should be flagged
                  if (fieldType.kind === 'NonNullType' && field.loc) {
                    issues.push({
                      message: `Field '${field.name.value}' in root type '${typeName}' should be nullable for better error handling`,
                      line: field.loc.startToken.line,
                      column: field.loc.startToken.column,
                      endLine: field.loc.endToken.line,
                      endColumn: field.loc.endToken.column,
                      rule: 'root-fields-nullable',
                      severity: 'warn'
                    });
                  }
                });
              }
            }
          });
          
          return issues;
        }
      });
    }

    this.rules = allRules;
  }

  /**
   * Initialize the GraphQL linter service
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing GraphQL linter service');
      
      // Reinitialize rules when called (for configuration changes)
      this.initializeRules();
      
      this.isInitialized = true;
      logger.info('GraphQL linter service initialized successfully');
    } catch (error) {
      const stepzenError = new StepZenError(
        'Failed to initialize GraphQL linter service',
        'GRAPHQL_LINT_INIT_ERROR',
        error
      );
      logger.error('GraphQL linter initialization failed', stepzenError);
      throw stepzenError;
    }
  }

  /**
   * Lint a single GraphQL file
   * @param filePath Path to the GraphQL file to lint
   * @returns Promise that resolves to linting results
   */
  async lintFile(filePath: string): Promise<vscode.Diagnostic[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      logger.debug(`Linting GraphQL file: ${filePath}`);

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        logger.warn(`File does not exist: ${filePath}`);
        return [];
      }

      // Read and parse the file
      const content = fs.readFileSync(filePath, 'utf8');
      let ast: DocumentNode;

      try {
        ast = parse(content, { noLocation: false });
      } catch (parseError) {
        // If parsing fails, create a diagnostic for the parse error
        const diagnostic = new vscode.Diagnostic(
          new vscode.Range(0, 0, 0, 0),
          `GraphQL parse error: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`,
          vscode.DiagnosticSeverity.Error
        );
        diagnostic.source = 'GraphQL Linter';
        return [diagnostic];
      }

      // Run all linting rules
      const allIssues: GraphQLLintIssue[] = [];
      for (const rule of this.rules) {
        const issues = rule.check(ast);
        allIssues.push(...issues);
      }

      // Convert issues to VS Code diagnostics
      const diagnostics: vscode.Diagnostic[] = allIssues.map(issue => {
        const range = new vscode.Range(
          issue.line - 1,
          issue.column - 1,
          (issue.endLine || issue.line) - 1,
          (issue.endColumn || issue.column) - 1
        );

        let severity: vscode.DiagnosticSeverity;
        switch (issue.severity) {
          case 'error':
            severity = vscode.DiagnosticSeverity.Error;
            break;
          case 'warn':
            severity = vscode.DiagnosticSeverity.Warning;
            break;
          default:
            severity = vscode.DiagnosticSeverity.Information;
        }

        const diagnostic = new vscode.Diagnostic(range, issue.message, severity);
        diagnostic.source = 'GraphQL Linter';
        diagnostic.code = issue.rule;

        return diagnostic;
      });

      logger.debug(`Found ${diagnostics.length} linting issues in ${filePath}`);
      return diagnostics;
    } catch (error) {
      logger.error(`Error linting file ${filePath}:`, error);
      return [];
    }
  }

  /**
   * Lint all GraphQL files in a StepZen project
   * @param projectRoot Root directory of the StepZen project
   * @returns Promise that resolves when linting is complete
   */
  async lintProject(projectRoot: string): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      logger.info(`Linting GraphQL files in project: ${projectRoot}`);

      // Find all GraphQL files in the project
      const graphqlFiles = await vscode.workspace.findFiles(
        new vscode.RelativePattern(projectRoot, '**/*.{graphql,gql}'),
        '**/node_modules/**'
      );

      logger.debug(`Found ${graphqlFiles.length} GraphQL files to lint`);

      // Clear existing diagnostics
      this.diagnosticCollection.clear();

      // Lint each file
      for (const file of graphqlFiles) {
        const diagnostics = await this.lintFile(file.fsPath);
        if (diagnostics.length > 0) {
          this.diagnosticCollection.set(file, diagnostics);
        }
      }

      let filesWithIssues = 0;
      this.diagnosticCollection.forEach(() => {
        filesWithIssues++;
      });
      logger.info(`Project linting completed. Found issues in ${filesWithIssues} files`);
    } catch (error) {
      const stepzenError = new StepZenError(
        'Failed to lint GraphQL project',
        'GRAPHQL_PROJECT_LINT_ERROR',
        error
      );
      logger.error('Project linting failed', stepzenError);
      throw stepzenError;
    }
  }

  /**
   * Get the diagnostic collection for external access
   * @returns VS Code diagnostic collection
   */
  getDiagnosticCollection(): vscode.DiagnosticCollection {
    return this.diagnosticCollection;
  }

  /**
   * Clear all diagnostics
   */
  clearDiagnostics(): void {
    this.diagnosticCollection.clear();
  }

  /**
   * Dispose of the service
   */
  dispose(): void {
    this.diagnosticCollection.dispose();
    this.isInitialized = false;
  }
} 