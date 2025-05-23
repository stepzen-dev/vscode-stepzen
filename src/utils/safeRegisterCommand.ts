/**
 * Copyright IBM Corp. 2025
 * Assisted by CursorAI
 */

import * as vscode from "vscode";
import { services } from "../services";
import { UI, MESSAGES } from "./constants";

/**
 * Safely registers a VSCode command, capturing and reporting any errors
 * that might occur during registration.
 * 
 * @param commandId The command identifier to register
 * @param callback The function to execute when the command is invoked
 * @returns A disposable that unregisters the command
 * @throws Error if commandId or callback are invalid
 */
export function safeRegisterCommand(
  commandId: string,
  callback: (...args: unknown[]) => unknown
): vscode.Disposable {
  if (!commandId || typeof commandId !== 'string') {
    throw new Error('Command ID must be a non-empty string');
  }

  if (typeof callback !== 'function') {
    throw new Error('Command callback must be a function');
  }

  try {
    return vscode.commands.registerCommand(commandId, callback);
  } catch (err) {
    services.logger.error(`${MESSAGES.FAILED_TO_REGISTER_COMMAND}: ${commandId}`, err);
    vscode.window.showErrorMessage(
      `${UI.EXTENSION_NAME}: ${MESSAGES.FAILED_TO_REGISTER_COMMAND} "${commandId}"`
    );
    return { dispose: () => {} }; // <-- return a dummy disposable
  }
}
