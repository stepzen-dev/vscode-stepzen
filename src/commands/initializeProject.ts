import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import { getOrCreateStepZenTerminal } from "../extension";
import { resolveStepZenProjectRoot } from "../utils/stepzenProject";
import { formatError, createError } from "../utils/errors";
import { FILE_PATTERNS } from "../utils/constants";
import { logger } from "../services/logger";

/**
 * Checks if the StepZen CLI is installed and properly configured
 *
 * @returns Boolean indicating if CLI is available
 */
async function checkStepZenCLI(): Promise<boolean> {
  try {
    logger.info("Checking StepZen CLI installation...");

    try {
      const version = execSync("stepzen --version").toString().trim();
      logger.info(`Found StepZen CLI version: ${version}`);
    } catch (err) {
      const installOption = await vscode.window.showErrorMessage(
        "StepZen CLI is not installed. You need to install it to create a StepZen project.",
        "Install Instructions",
        "Cancel",
      );

      if (installOption === "Install Instructions") {
        vscode.env.openExternal(
          vscode.Uri.parse("https://stepzen.com/docs/stepzen-cli/install"),
        );
      }

      return false;
    }

    // Verify that user is logged in
    try {
      execSync("stepzen whoami");
      logger.info("StepZen CLI is properly configured.");
    } catch (err) {
      const loginOption = await vscode.window.showErrorMessage(
        "You need to log in to StepZen before creating a project.",
        "Log In",
        "Cancel",
      );

      if (loginOption === "Log In") {
        const terminal = vscode.window.createTerminal("StepZen Login");
        terminal.show();
        terminal.sendText("stepzen login");
      }

      return false;
    }

    return true;
  } catch (err) {
    vscode.window.showErrorMessage(`StepZen CLI error: ${formatError(err)}`);
    logger.error(`StepZen CLI error: ${formatError(err, true)}`, err);
    return false;
  }
}

/**
 * Checks if a StepZen project already exists at the specified location
 *
 * @param dirPath Directory to check for existing StepZen project
 * @returns Boolean indicating if a project exists
 */
function projectExistsAt(dirPath: string): boolean {
  const configPath = path.join(dirPath, FILE_PATTERNS.CONFIG_FILE);
  return fs.existsSync(configPath);
}

/**
 * Handles scenario where a StepZen project already exists
 * Offers options to open config, reinitialize, or create new
 *
 * @param existingPath Path to existing StepZen project
 * @returns Promise resolving to string action ('open', 'reinit', 'new') or undefined if cancelled
 */
async function handleExistingProject(
  existingPath: string,
): Promise<string | undefined> {
  const options = [
    {
      label: "Open Config",
      id: "open",
      description: "Open the existing StepZen config file",
    },
    {
      label: "Reinitialize",
      id: "reinit",
      description: "Replace the existing project with a new one",
    },
    {
      label: "Create New",
      id: "new",
      description: "Create a new project in a different location",
    },
  ];

  const choice = await vscode.window.showQuickPick(options, {
    placeHolder:
      "A StepZen project already exists at this location. What would you like to do?",
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
 *
 * @param parentDir Parent directory where subfolder will be created
 * @returns Promise resolving to the full path of the new subfolder or undefined if cancelled
 */
async function promptForSubfolder(
  parentDir: string,
): Promise<string | undefined> {
  const projectName = await vscode.window.showInputBox({
    prompt: "Enter name for the new StepZen project folder",
    placeHolder: "my-stepzen-project",
    validateInput: (input) => {
      if (!input || input.trim() === "") {
        return "Project name cannot be empty";
      }

      if (!/^[a-zA-Z0-9-_]+$/.test(input)) {
        return "Project name can only contain letters, numbers, hyphens, and underscores";
      }

      const newPath = path.join(parentDir, input);
      if (fs.existsSync(newPath)) {
        return `A file or folder named "${input}" already exists`;
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
 *
 * @param startPath Optional starting path for location selection
 * @returns Promise resolving to the selected path or undefined if cancelled
 */
async function selectProjectLocation(
  startPath?: string,
): Promise<string | undefined> {
  const initialUri = startPath ? vscode.Uri.file(startPath) : undefined;

  const folderUri = await vscode.window.showOpenDialog({
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    openLabel: "Select Location",
    defaultUri: initialUri,
    title: "Select Location for StepZen Project",
  });

  if (!folderUri || folderUri.length === 0) {
    return undefined;
  }

  return folderUri[0].fsPath;
}

/**
 * Prompts the user for a StepZen endpoint name with folder/name format
 *
 * @returns Promise resolving to the endpoint or undefined if cancelled
 */
async function promptForEndpoint(): Promise<string | undefined> {
  return await vscode.window.showInputBox({
    prompt: "Enter a folder/name for your StepZen endpoint (e.g., dev/myapi)",
    placeHolder: "folder/endpoint-name",
    validateInput: (input) => {
      if (!input || input.trim() === "") {
        return "Endpoint must not be empty";
      }

      if (!input.includes("/")) {
        return "Endpoint must be in the format folder/name";
      }

      const [folder, name] = input.split("/", 2);

      if (!folder || !name) {
        return "Both folder and name must be provided";
      }

      if (!/^[a-zA-Z0-9-_]+$/.test(folder) || !/^[a-zA-Z0-9-_]+$/.test(name)) {
        return "Folder and name can only contain letters, numbers, hyphens, and underscores";
      }

      return null;
    },
  });
}

/**
 * Creates a StepZen project at the specified location
 *
 * @param projectDir Directory where to create the project
 * @param endpoint StepZen endpoint in the format folder/name
 * @returns Promise that resolves when the project is created
 */
async function createProject(
  projectDir: string,
  endpoint: string,
): Promise<void> {
  try {
    // Create the directory if it doesn't exist
    if (!fs.existsSync(projectDir)) {
      await vscode.workspace.fs.createDirectory(vscode.Uri.file(projectDir));
    }

    // Create operations directory
    const operationsDir = path.join(projectDir, "operations");
    if (!fs.existsSync(operationsDir)) {
      await vscode.workspace.fs.createDirectory(vscode.Uri.file(operationsDir));
    }

    // Create stepzen.config.json
    const configPath = path.join(projectDir, "stepzen.config.json");
    const configContent = JSON.stringify({ endpoint }, null, 2);
    fs.writeFileSync(configPath, configContent);

    // Create index.graphql
    const indexPath = path.join(projectDir, "index.graphql");
    const indexContent = `schema
  @sdl(
    files: [
    ]
    executables: [
      { document: "operations/example.graphql", persist: false }
    ]
  ) {
  query: Query
}

# Ths query field is only here to support the sample executable document
# Remove this when you build your API
extend type Query {
  hello: String @value(const: "Hello from StepZen!")
}`;
    fs.writeFileSync(indexPath, indexContent);

    // Create operations/example.graphql
    const sampleOperationPath = path.join(
      projectDir,
      "operations",
      "example.graphql",
    );
    const sampleOperationContent = `# Example GraphQL operations for your StepZen API
# This query works with the default schema

query HelloWorld {
  hello
}

`;
    fs.writeFileSync(sampleOperationPath, sampleOperationContent);

    logger.info(
      `Created StepZen project at: ${projectDir} with endpoint ${endpoint}`,
    );
  } catch (err) {
    throw createError(
      `Failed to create project: ${err}`,
      "Initialize Project",
      err,
      "filesystem",
    );
  }
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

    // Step 2: Determine target location based on workspace state
    let targetLocation: string | undefined;

    // Check if we have a workspace folder open
    if (
      vscode.workspace.workspaceFolders &&
      vscode.workspace.workspaceFolders.length > 0
    ) {
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
          return; // Config file already opened
        } else if (action === "new") {
          targetLocation = undefined; // Will prompt for new location
        } else if (action !== "reinit") {
          return; // Cancelled
        }
        // If 'reinit', continue with existing location
      }

      // Prompt: initialize here or create in subfolder?
      if (targetLocation) {
        const options = [
          {
            label: "Initialize Here",
            id: "here",
            description: `Create at ${vscode.workspace.asRelativePath(targetLocation)}`,
          },
          {
            label: "Create in Subfolder",
            id: "subfolder",
            description: "Create in a new subfolder",
          },
        ];

        const choice = await vscode.window.showQuickPick(options, {
          placeHolder: "Where would you like to create the StepZen project?",
        });

        if (!choice) {
          return; // Cancelled
        }

        if (choice.id === "subfolder") {
          targetLocation = await promptForSubfolder(targetLocation);
          if (!targetLocation) {
            return; // Cancelled
          }
        }
      }
    }

    // If no target location determined yet, show folder selector
    if (!targetLocation) {
      targetLocation = await selectProjectLocation();
      if (!targetLocation) {
        return; // Cancelled
      }

      // If directory exists but isn't empty, confirm or prompt for subfolder
      if (fs.existsSync(targetLocation)) {
        const dirContents = fs.readdirSync(targetLocation);
        if (dirContents.length > 0) {
          const choice = await vscode.window.showQuickPick(
            [
              {
                label: "Initialize Here",
                id: "here",
                description: "Create project in this folder",
              },
              {
                label: "Create in Subfolder",
                id: "subfolder",
                description: "Create a new subfolder",
              },
            ],
            {
              placeHolder:
                "This folder contains files. What would you like to do?",
            },
          );

          if (!choice) {
            return; // Cancelled
          }

          if (choice.id === "subfolder") {
            targetLocation = await promptForSubfolder(targetLocation);
            if (!targetLocation) {
              return; // Cancelled
            }
          }
        }
      }
    }

    // Step 3: Get endpoint name (format: folder/name)
    vscode.window.showInformationMessage(
      'StepZen endpoints must be in the format "folder/name" (e.g., dev/myapi)',
    );

    const endpoint = await promptForEndpoint();
    if (!endpoint) {
      logger.info("Project initialization cancelled.");
      return;
    }

    // Step 4: Create project
    await createProject(targetLocation, endpoint);

    // Step 5: Open project in editor
    const openOption = await vscode.window.showInformationMessage(
      `StepZen project created successfully at ${targetLocation}`,
      "Open index.graphql",
      "Open Project Folder",
    );

    if (openOption === "Open index.graphql") {
      const indexPath = path.join(targetLocation, "index.graphql");
      if (fs.existsSync(indexPath)) {
        const document = await vscode.workspace.openTextDocument(indexPath);
        await vscode.window.showTextDocument(document);
      }
    } else if (openOption === "Open Project Folder") {
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
            uri: vscode.Uri.file(targetLocation as string),
            name: path.basename(targetLocation as string),
          },
        );
      }
    }
  } catch (err) {
    const error = formatError(err);
    vscode.window.showErrorMessage(
      `Failed to initialize StepZen project: ${error}`,
    );
    logger.error(
      `Project initialization failed: ${formatError(err, true)}`,
      err
    );
  }
}
