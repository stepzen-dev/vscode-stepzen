/**
 * Copyright IBM Corp. 2025
 * Assisted by CursorAI
 */

import * as vscode from 'vscode';
import { services } from '../services';

/**
 * Command to configure GraphQL linting rules
 * Opens VS Code settings to the GraphQL lint rules configuration
 */
export async function configureLintRules(): Promise<void> {
  try {
    services.logger.info('Opening GraphQL lint rules configuration');

    // Open VS Code settings to the GraphQL lint rules section
    await vscode.commands.executeCommand(
      'workbench.action.openSettings',
      'stepzen.graphqlLintRules'
    );

    // Show a helpful message
    vscode.window.showInformationMessage(
      'GraphQL lint rules configuration opened. You can enable/disable individual rules here.'
    );

    services.logger.info('GraphQL lint rules configuration opened successfully');
  } catch (error) {
    services.logger.error('Failed to open GraphQL lint rules configuration:', error);
    vscode.window.showErrorMessage('Failed to open GraphQL lint rules configuration');
  }
} 