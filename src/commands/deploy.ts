/**
 * Copyright IBM Corp. 2025
 * Assisted by CursorAI
 */

import * as vscode from "vscode";
import { services } from "../services";
import { handleError } from "../errors";
import { MESSAGES, PROGRESS_MESSAGES } from "../utils/constants";

/**
 * Deploys the current StepZen project to StepZen service
 * Uses the StepzenCliService to execute the deploy command
 * 
 * @returns Promise that resolves when deployment is complete
 */
export async function deployStepZen() {
  // Check workspace trust first
  if (!vscode.workspace.isTrusted) {
    vscode.window.showWarningMessage(MESSAGES.FEATURE_NOT_AVAILABLE_UNTRUSTED);
    services.logger.warn(`Deploy failed: ${MESSAGES.FEATURE_NOT_AVAILABLE_UNTRUSTED}`);
    return;
  }

  services.logger.info("Starting deployment of StepZen project...");

  // Show deployment progress to the user
  return vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: "StepZen: Deploying schema...",
    cancellable: false
  }, async (progress) => {
    progress.report({ increment: 0, message: "Starting deployment..." });
    
    try {
      // Use the CLI service to perform the deployment
      progress.report({ increment: 50, message: PROGRESS_MESSAGES.UPLOADING_SCHEMA });
      await services.cli.deploy();
      
      // Show success message to the user
      progress.report({ increment: 100, message: "Deployment completed!" });
      vscode.window.showInformationMessage(
        "StepZen schema deployed successfully!", 
        { modal: false, detail: "Your GraphQL schema has been deployed and is ready to use." },
        "OK"
      );
      
      services.logger.info("Deployment completed successfully");
    } catch (err) {
      handleError(err);
    }
  });
}
