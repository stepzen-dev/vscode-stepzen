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
