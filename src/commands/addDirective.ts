/**
 * Copyright IBM Corp. 2025
 * Assisted by CursorAI
 */

import * as vscode from 'vscode';
import { services } from '../services';
import { handleError } from '../errors';
import { addMaterializer } from './addMaterializer';
import { addValue } from './addValue';

/**
 * Directive option for the quick pick menu
 */
interface DirectiveOption {
  label: string;
  description: string;
  detail: string;
  icon: string;
  command: () => Promise<void>;
}

/**
 * Shows a menu to select which directive to add
 * This provides a multi-level right-click experience
 */
export async function addDirective() {
  try {
    services.logger.info("Starting Add Directive menu");
    
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No active editor');
      services.logger.warn("Add Directive failed: No active editor");
      return;
    }

    // Check if we're in a GraphQL file
    if (editor.document.languageId !== 'graphql') {
      vscode.window.showInformationMessage('Directives can only be added to GraphQL files.');
      services.logger.warn("Add Directive failed: Not a GraphQL file");
      return;
    }

    // Define available directive options
    const directiveOptions: DirectiveOption[] = [
      {
        label: "$(symbol-method) @materializer",
        description: "Connect fields to queries",
        detail: "Resolves a field by executing a StepZen query with argument mapping",
        icon: "symbol-method",
        command: addMaterializer
      },
      {
        label: "$(symbol-constant) @value",
        description: "Set constant or computed values",
        detail: "Returns a constant value or the result of a script expression",
        icon: "symbol-constant", 
        command: addValue
      }
      // Future directives can be added here:
      // {
      //   label: "$(symbol-interface) @rest",
      //   description: "Connect to REST APIs",
      //   detail: "Fetches data from REST endpoints",
      //   icon: "symbol-interface",
      //   command: addRest
      // },
      // {
      //   label: "$(database) @dbquery", 
      //   description: "Query databases",
      //   detail: "Executes SQL queries against database connections",
      //   icon: "database",
      //   command: addDbquery
      // }
    ];

    // Show the directive selection menu
    const selectedOption = await vscode.window.showQuickPick(directiveOptions, {
      placeHolder: 'Select a directive to add',
      matchOnDescription: true,
      matchOnDetail: true
    });

    if (!selectedOption) {
      services.logger.info("Add Directive cancelled by user");
      return;
    }

    services.logger.info(`Selected directive: ${selectedOption.label}`);

    // Execute the selected directive command
    await selectedOption.command();

    services.logger.info("Add Directive completed successfully");
  } catch (err) {
    handleError(err);
  }
} 