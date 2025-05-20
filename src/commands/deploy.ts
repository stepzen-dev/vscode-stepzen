import * as vscode from "vscode";
import { getOrCreateStepZenTerminal, stepzenOutput } from "../extension";
import { resolveStepZenProjectRoot } from "../utils/stepzenProject";
import { formatError, createError } from '../utils/errors';

/**
 * Deploys the current StepZen project to StepZen service
 * Resolves the project root and runs 'stepzen deploy' in a terminal
 * 
 * @returns Promise that resolves when deployment command is initiated
 */
export async function deployStepZen() {
  // Check workspace trust first
  if (!vscode.workspace.isTrusted) {
    const message = "StepZen deployment is not available in untrusted workspaces. Open this folder in a trusted workspace to enable deployment.";
    vscode.window.showWarningMessage(message);
    stepzenOutput.appendLine(`Deploy failed: ${message}`);
    return;
  }

  let projectRoot: string;
  try {
    projectRoot = await resolveStepZenProjectRoot();
  } catch (err) {
    const message = formatError(err);
    vscode.window.showErrorMessage(message);
    stepzenOutput.appendLine(`Deploy failed: ${formatError(err, true)}`);
    return;
  }

  stepzenOutput.appendLine(`Deploying StepZen project at: ${projectRoot}`);

  const terminal = getOrCreateStepZenTerminal("StepZen Tools");
  terminal.show();
  terminal.sendText(`cd "${projectRoot}" && stepzen deploy`);
}
