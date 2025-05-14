import * as vscode from "vscode";

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
    console.error(`Failed to register command: ${commandId}`, err);
    vscode.window.showErrorMessage(
      `StepZen Tools: Failed to register command "${commandId}"`
    );
    return { dispose: () => {} }; // <-- return a dummy disposable
  }
}
