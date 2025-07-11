/**
 * Copyright IBM Corp. 2025
 * Assisted by CursorAI
 */

import * as vscode from 'vscode';
import { services } from '../services';
import { handleError } from '../errors';
import { MESSAGES } from '../utils/constants';

/**
 * Command to lint GraphQL schema files in the current StepZen project
 * Uses graphql-eslint to provide comprehensive schema validation
 * 
 * @returns Promise that resolves when linting is complete
 */
export async function lintGraphQL(): Promise<void> {
  // Check workspace trust
  if (!vscode.workspace.isTrusted) {
    vscode.window.showWarningMessage(MESSAGES.FEATURE_NOT_AVAILABLE_UNTRUSTED);
    services.logger.warn(`GraphQL linting failed: ${MESSAGES.FEATURE_NOT_AVAILABLE_UNTRUSTED}`);
    return;
  }

  // Check if workspace is open
  if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
    vscode.window.showErrorMessage(MESSAGES.NO_WORKSPACE_OPEN);
    return;
  }

  try {
    services.logger.info('Starting GraphQL linting');

    // Get the active workspace folder
    const activeFolder = vscode.window.activeTextEditor?.document.uri
      ? vscode.workspace.getWorkspaceFolder(vscode.window.activeTextEditor.document.uri)
      : vscode.workspace.workspaceFolders[0];

    if (!activeFolder) {
      vscode.window.showErrorMessage('No active workspace folder found');
      return;
    }

    // Resolve StepZen project root
    const projectRoot = await services.projectResolver.resolveStepZenProjectRoot(activeFolder.uri);
    
    // Show progress to user
    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: "StepZen: Linting GraphQL schema...",
      cancellable: false
    }, async (progress) => {
      progress.report({ increment: 0, message: "Initializing GraphQL linter..." });
      
      // Initialize the linter
      await services.graphqlLinter.initialize();
      
      progress.report({ increment: 30, message: "Scanning GraphQL files..." });
      
      // Lint the project
      await services.graphqlLinter.lintProject(projectRoot);
      
      progress.report({ increment: 100, message: "Linting completed!" });
    });

    // Get linting results
    const diagnosticCollection = services.graphqlLinter.getDiagnosticCollection();
    
    // Count total issues across all files
    let totalIssues = 0;
    let filesWithIssues = 0;
    diagnosticCollection.forEach((_, diagnostics) => {
      totalIssues += diagnostics.length;
      filesWithIssues++;
    });

    // Show results
    if (totalIssues === 0) {
      vscode.window.showInformationMessage('✅ GraphQL schema linting completed. No issues found.');
    } else {
      vscode.window.showWarningMessage(
        `⚠️ GraphQL schema linting completed. Found ${totalIssues} issues across ${filesWithIssues} files. Check the Problems panel for details.`
      );
    }

    services.logger.info(`GraphQL linting completed with ${totalIssues} issues found`);
  } catch (err) {
    handleError(err);
  }
} 