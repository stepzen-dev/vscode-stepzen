/**
 * Copyright IBM Corp. 2025
 * Assisted by CursorAI
 */

import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { handleError } from "../errors";
import { FILE_PATTERNS, URLS, MESSAGES } from "../utils/constants";
import { services } from "../services";
import { createProjectScaffold } from "../utils/projectScaffold";

// NLS Messages for Initialize Project
const NLS = {
  CLI_NOT_INSTALLED: "StepZen CLI is not installed. You need to install it to create a StepZen project.",
  INSTALL_INSTRUCTIONS: "Install Instructions",
  CANCEL: "Cancel",
  LOGIN_REQUIRED: "You need to log in to StepZen before creating a project.",
  LOG_IN: "Log In",
  PROJECT_EXISTS_PROMPT: "A StepZen project already exists at this location. What would you like to do?",
  OPEN_CONFIG: "Open Config",
  OPEN_CONFIG_DESC: "Open the existing StepZen config file",
  REINITIALIZE: "Reinitialize",
  REINITIALIZE_DESC: "Replace the existing project with a new one",
  CREATE_NEW: "Create New",
  CREATE_NEW_DESC: "Create a new project in a different location",
  PROJECT_NAME_PROMPT: "Enter name for the new StepZen project folder",
  PROJECT_NAME_PLACEHOLDER: "my-stepzen-project",
  PROJECT_NAME_EMPTY: "Project name cannot be empty",
  PROJECT_NAME_INVALID: "Project name can only contain letters, numbers, hyphens, and underscores",
  PROJECT_NAME_EXISTS: "A file or folder named \"{0}\" already exists",
  SELECT_LOCATION_TITLE: "Select Location for StepZen Project",
  SELECT_LOCATION_LABEL: "Select Location",
  WHERE_CREATE_PROJECT: "Where would you like to create the StepZen project?",
  INITIALIZE_HERE: "Initialize Here",
  INITIALIZE_HERE_DESC: "Create at {0}",
  CREATE_SUBFOLDER: "Create in Subfolder",
  CREATE_SUBFOLDER_DESC: "Create in a new subfolder",
  FOLDER_NOT_EMPTY: "This folder contains files. What would you like to do?",
  FOLDER_NOT_EMPTY_INIT: "Create project in this folder",
  ENDPOINT_FORMAT_INFO: "StepZen endpoints must be in the format \"folder/name\" (e.g., dev/myapi)",
  ENDPOINT_PROMPT: "Enter a folder/name for your StepZen endpoint (e.g., dev/myapi)",
  ENDPOINT_PLACEHOLDER: "folder/endpoint-name",
  ENDPOINT_EMPTY: "Endpoint must not be empty",
  ENDPOINT_MISSING_SLASH: "Endpoint must be in the format folder/name",
  ENDPOINT_MISSING_PARTS: "Both folder and name must be provided",
  ENDPOINT_INVALID_CHARS: "Folder and name can only contain letters, numbers, hyphens, and underscores",
  PROJECT_CREATED: "StepZen project created successfully at {0}",
  OPEN_PROJECT_FOLDER: "Open Project Folder",
  INITIALIZATION_CANCELLED: "Project initialization cancelled."
} as const;

/**
 * Checks if the StepZen CLI is installed and properly configured
 * @returns Boolean indicating if CLI is available
 */
async function checkStepZenCLI(): Promise<boolean> {
  try {
    services.logger.info("Checking StepZen CLI installation...");

    // Check CLI version using services.cli
    try {
      await services.cli.spawnProcessWithOutput(["--version"]);
      services.logger.info("StepZen CLI is installed");
    } catch (err) {
      const installOption = await vscode.window.showErrorMessage(
        NLS.CLI_NOT_INSTALLED,
        NLS.INSTALL_INSTRUCTIONS,
        NLS.CANCEL,
      );

      if (installOption === NLS.INSTALL_INSTRUCTIONS) {
        vscode.env.openExternal(vscode.Uri.parse(URLS.STEPZEN_CLI_INSTALL));
      }
      return false;
    }

    // Verify that user is logged in using services.cli
    try {
      await services.cli.spawnProcessWithOutput(["whoami"]);
      services.logger.info("StepZen CLI is properly configured.");
    } catch (err) {
      const loginOption = await vscode.window.showErrorMessage(
        NLS.LOGIN_REQUIRED,
        NLS.LOG_IN,
        NLS.CANCEL,
      );

      if (loginOption === NLS.LOG_IN) {
        const terminal = vscode.window.createTerminal("StepZen Login");
        terminal.show();
        terminal.sendText("stepzen login");
      }
      return false;
    }

    return true;
  } catch (err) {
    handleError(err);
    return false;
  }
}

/**
 * Checks if a StepZen project already exists at the specified location
 * @param dirPath Directory to check for existing StepZen project
 * @returns Boolean indicating if a project exists
 */
function projectExistsAt(dirPath: string): boolean {
  const configPath = path.join(dirPath, FILE_PATTERNS.CONFIG_FILE);
  return fs.existsSync(configPath);
}

/**
 * Handles scenario where a StepZen project already exists
 * @param existingPath Path to existing StepZen project
 * @returns Promise resolving to string action or undefined if cancelled
 */
async function handleExistingProject(existingPath: string): Promise<string | undefined> {
  const options = [
    {
      label: NLS.OPEN_CONFIG,
      id: "open",
      description: NLS.OPEN_CONFIG_DESC,
    },
    {
      label: NLS.REINITIALIZE,
      id: "reinit",
      description: NLS.REINITIALIZE_DESC,
    },
    {
      label: NLS.CREATE_NEW,
      id: "new",
      description: NLS.CREATE_NEW_DESC,
    },
  ];

  const choice = await vscode.window.showQuickPick(options, {
    placeHolder: NLS.PROJECT_EXISTS_PROMPT,
  });

  if (!choice) {
    return undefined;
  }

  if (choice.id === "open") {
    const configPath = path.join(existingPath, FILE_PATTERNS.CONFIG_FILE);
    const document = await vscode.workspace.openTextDocument(configPath);
    await vscode.window.showTextDocument(document);
  }

  return choice.id;
}

/**
 * Prompts for a new subfolder name to create under a parent directory
 * @param parentDir Parent directory where subfolder will be created
 * @returns Promise resolving to the full path of the new subfolder or undefined if cancelled
 */
async function promptForSubfolder(parentDir: string): Promise<string | undefined> {
  const projectName = await vscode.window.showInputBox({
    prompt: NLS.PROJECT_NAME_PROMPT,
    placeHolder: NLS.PROJECT_NAME_PLACEHOLDER,
    validateInput: (input) => {
      if (!input || input.trim() === "") {
        return NLS.PROJECT_NAME_EMPTY;
      }

      if (!/^[a-zA-Z0-9-_]+$/.test(input)) {
        return NLS.PROJECT_NAME_INVALID;
      }

      const newPath = path.join(parentDir, input);
      if (fs.existsSync(newPath)) {
        return NLS.PROJECT_NAME_EXISTS.replace("{0}", input);
      }

      return null;
    },
  });

  if (!projectName) {
    return undefined;
  }

  return path.join(parentDir, projectName);
}

/**
 * Shows UI to select where to create a new StepZen project
 * @param startPath Optional starting path for location selection
 * @returns Promise resolving to the selected path or undefined if cancelled
 */
async function selectProjectLocation(startPath?: string): Promise<string | undefined> {
  const initialUri = startPath ? vscode.Uri.file(startPath) : undefined;

  const folderUri = await vscode.window.showOpenDialog({
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    openLabel: NLS.SELECT_LOCATION_LABEL,
    defaultUri: initialUri,
    title: NLS.SELECT_LOCATION_TITLE,
  });

  if (!folderUri || folderUri.length === 0) {
    return undefined;
  }

  return folderUri[0].fsPath;
}

/**
 * Prompts the user for a StepZen endpoint name with folder/name format
 * @returns Promise resolving to the endpoint or undefined if cancelled
 */
async function promptForEndpoint(): Promise<string | undefined> {
  return await vscode.window.showInputBox({
    prompt: NLS.ENDPOINT_PROMPT,
    placeHolder: NLS.ENDPOINT_PLACEHOLDER,
    validateInput: (input) => {
      if (!input || input.trim() === "") {
        return NLS.ENDPOINT_EMPTY;
      }

      if (!input.includes("/")) {
        return NLS.ENDPOINT_MISSING_SLASH;
      }

      const [folder, name] = input.split("/", 2);

      if (!folder || !name) {
        return NLS.ENDPOINT_MISSING_PARTS;
      }

      if (!/^[a-zA-Z0-9-_]+$/.test(folder) || !/^[a-zA-Z0-9-_]+$/.test(name)) {
        return NLS.ENDPOINT_INVALID_CHARS;
      }

      return null;
    },
  });
}

/**
 * Determines the target location for the new project
 * @returns Promise resolving to target location or undefined if cancelled
 */
async function determineTargetLocation(): Promise<string | undefined> {
  let targetLocation: string | undefined;

  // Check if we have a workspace folder open
  if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
    const workspaceFolder = vscode.workspace.workspaceFolders[0];

    // Check if this is a right-click in explorer context menu
    if (vscode.window.activeTextEditor) {
      const activeFile = vscode.window.activeTextEditor.document.uri;
      if (vscode.workspace.getWorkspaceFolder(activeFile)) {
        const activeDir = path.dirname(activeFile.fsPath);
        targetLocation = activeDir;
      }
    } else {
      targetLocation = workspaceFolder.uri.fsPath;
    }

    // If StepZen project already exists, handle accordingly
    if (targetLocation && projectExistsAt(targetLocation)) {
      const action = await handleExistingProject(targetLocation);

      if (action === "open") {
        return undefined; // Config file already opened
      } else if (action === "new") {
        targetLocation = undefined; // Will prompt for new location
      } else if (action !== "reinit") {
        return undefined; // Cancelled
      }
      // If 'reinit', continue with existing location
    }

    // Prompt: initialize here or create in subfolder?
    if (targetLocation) {
      const options = [
        {
          label: NLS.INITIALIZE_HERE,
          id: "here",
          description: NLS.INITIALIZE_HERE_DESC.replace("{0}", vscode.workspace.asRelativePath(targetLocation)),
        },
        {
          label: NLS.CREATE_SUBFOLDER,
          id: "subfolder",
          description: NLS.CREATE_SUBFOLDER_DESC,
        },
      ];

      const choice = await vscode.window.showQuickPick(options, {
        placeHolder: NLS.WHERE_CREATE_PROJECT,
      });

      if (!choice) {
        return undefined; // Cancelled
      }

      if (choice.id === "subfolder") {
        targetLocation = await promptForSubfolder(targetLocation);
        if (!targetLocation) {
          return undefined; // Cancelled
        }
      }
    }
  }

  // If no target location determined yet, show folder selector
  if (!targetLocation) {
    targetLocation = await selectProjectLocation();
    if (!targetLocation) {
      return undefined; // Cancelled
    }

    // If directory exists but isn't empty, confirm or prompt for subfolder
    if (fs.existsSync(targetLocation)) {
      const dirContents = fs.readdirSync(targetLocation);
      if (dirContents.length > 0) {
        const choice = await vscode.window.showQuickPick(
          [
            {
              label: NLS.INITIALIZE_HERE,
              id: "here",
              description: NLS.FOLDER_NOT_EMPTY_INIT,
            },
            {
              label: NLS.CREATE_SUBFOLDER,
              id: "subfolder",
              description: NLS.CREATE_SUBFOLDER_DESC,
            },
          ],
          {
            placeHolder: NLS.FOLDER_NOT_EMPTY,
          },
        );

        if (!choice) {
          return undefined; // Cancelled
        }

        if (choice.id === "subfolder") {
          targetLocation = await promptForSubfolder(targetLocation);
          if (!targetLocation) {
            return undefined; // Cancelled
          }
        }
      }
    }
  }

  return targetLocation;
}

/**
 * Initializes a new StepZen project
 * Command handler for initializing a new StepZen project
 */
export async function initializeProject() {
  try {
    // Step 1: Check if StepZen CLI is installed
    const hasStepZen = await checkStepZenCLI();
    if (!hasStepZen) {
      return;
    }

    // Step 2: Determine target location
    const targetLocation = await determineTargetLocation();
    if (!targetLocation) {
      return;
    }

    // Step 3: Get endpoint name (format: folder/name)
    vscode.window.showInformationMessage(NLS.ENDPOINT_FORMAT_INFO);

    const endpoint = await promptForEndpoint();
    if (!endpoint) {
      services.logger.info(NLS.INITIALIZATION_CANCELLED);
      return;
    }

    // Step 4: Create project using utility
    await createProjectScaffold(targetLocation, endpoint);

    // Step 5: Open project in editor
    const openOption = await vscode.window.showInformationMessage(
      NLS.PROJECT_CREATED.replace("{0}", targetLocation),
      MESSAGES.OPEN_INDEX_GRAPHQL,
      NLS.OPEN_PROJECT_FOLDER,
    );

    if (openOption === MESSAGES.OPEN_INDEX_GRAPHQL) {
      const indexPath = path.join(targetLocation, FILE_PATTERNS.MAIN_SCHEMA_FILE);
      if (fs.existsSync(indexPath)) {
        const document = await vscode.workspace.openTextDocument(indexPath);
        await vscode.window.showTextDocument(document);
      }
    } else if (openOption === NLS.OPEN_PROJECT_FOLDER) {
      // If we created a subfolder, open that as a new workspace folder
      const currentWorkspaceFolders = vscode.workspace.workspaceFolders || [];
      const isNewFolder = !currentWorkspaceFolders.some(
        (folder) => folder.uri.fsPath === targetLocation,
      );

      if (isNewFolder) {
        vscode.workspace.updateWorkspaceFolders(
          currentWorkspaceFolders.length,
          0,
          {
            uri: vscode.Uri.file(targetLocation),
            name: path.basename(targetLocation),
          },
        );
      }
    }
  } catch (err) {
    handleError(err);
  }
}
