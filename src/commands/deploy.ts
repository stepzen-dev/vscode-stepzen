import * as vscode from "vscode";
import { cliService } from "../extension";
import { formatError } from '../utils/errors';
import { logger } from "../services/logger";
import { UI } from "../utils/constants";

/**
 * Deploys the current StepZen project to StepZen service
 * Uses the StepzenCliService to execute the deploy command
 * 
 * @returns Promise that resolves when deployment is complete
 */
export async function deployStepZen() {
  // Check workspace trust first
  if (!vscode.workspace.isTrusted) {
    const message = "StepZen deployment is not available in untrusted workspaces. Open this folder in a trusted workspace to enable deployment.";
    vscode.window.showWarningMessage(message);
    logger.warn(`Deploy failed: ${message}`);
    return;
  }

  logger.info("Starting deployment of StepZen project...");

  // Show deployment progress to the user
  return vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: "StepZen: Deploying schema...",
    cancellable: false
  }, async (progress) => {
    progress.report({ increment: 0, message: "Starting deployment..." });
    
    try {
      // Use the CLI service to perform the deployment
      progress.report({ increment: 50, message: "Uploading schema to StepZen..." });
      await cliService.deploy("");
      
      // Show success message to the user
      progress.report({ increment: 100, message: "Deployment completed!" });
      vscode.window.showInformationMessage(
        "StepZen schema deployed successfully!", 
        { modal: false, detail: "Your GraphQL schema has been deployed and is ready to use." },
        "OK"
      );
      
      logger.info("Deployment completed successfully");
    } catch (err) {
      const message = formatError(err);
      vscode.window.showErrorMessage(
        `StepZen deployment failed: ${message}`,
        { modal: false, detail: "Check the logs for more details." },
        "View Logs"
      ).then(selection => {
        if (selection === "View Logs") {
          // Show the StepZen output channel
          logger.showOutput();
        }
      });
      
      logger.error(`Deploy failed: ${formatError(err, true)}`, err);
    }
  });
}
