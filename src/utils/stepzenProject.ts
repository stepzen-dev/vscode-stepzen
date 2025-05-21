import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { services } from "../services";
import { StepZenError, handleError } from "../errors";

/**
 * Resolves the root directory of a StepZen project
 * First tries to find a project containing the active editor,
 * then scans the workspace, and finally prompts the user if multiple projects exist
 *
 * @param hintUri Optional URI hint to start searching from
 * @returns Promise resolving to the absolute path of the project root
 * @throws Error if no StepZen project is found or user cancels selection
 */
export async function resolveStepZenProjectRoot(
  hintUri?: vscode.Uri,
): Promise<string> {
  // ① try the folder that owns the active editor --------------------------
  const start = hintUri ?? vscode.window.activeTextEditor?.document.uri;
  if (start) {
    // Validate that the URI has a valid filesystem path
    if (!start.fsPath || typeof start.fsPath !== "string") {
      services.logger.warn("Invalid path in active editor URI");
    } else {
      const byAscend = ascendForConfig(path.dirname(start.fsPath));
      if (byAscend) {
        return byAscend;
      }
    }
  }

  // ② otherwise scan the entire workspace ---------------------------------
  services.logger.info(
    `StepZen project not found in current folder. Scanning...`,
  );
  const configs = await vscode.workspace.findFiles(
    "**/stepzen.config.json",
    "**/node_modules/**",
  );
  if (!configs || configs.length === 0) {
    throw new StepZenError(
      "No StepZen project (stepzen.config.json) found in workspace.",
      "CONFIG_NOT_FOUND"
    );
  }
  if (configs.length === 1) {
    if (!configs[0].fsPath) {
      throw new StepZenError(
        "Invalid file path for StepZen configuration.",
        "INVALID_FILE_PATH"
      );
    }
    return path.dirname(configs[0].fsPath);
  }

  // ③ prompt when several projects exist ----------------------------------
  services.logger.info(
    `Multiple StepZen projects found. Prompting for selection...`,
  );

  // Validate that all configs have valid paths
  const validConfigs = configs.filter(
    (c) => c.fsPath && typeof c.fsPath === "string",
  );
  if (validConfigs.length === 0) {
    throw new StepZenError(
      "No valid StepZen project paths found.",
      "INVALID_PROJECT_PATHS"
    );
  }

  const pick = await vscode.window.showQuickPick(
    validConfigs.map((c) => ({
      label: vscode.workspace.asRelativePath(path.dirname(c.fsPath), false),
      target: path.dirname(c.fsPath),
    })),
    { placeHolder: "Select the StepZen project to use" },
  );

  if (!pick || !pick.target) {
    throw new StepZenError(
      "Operation cancelled by user.",
      "USER_CANCELLED"
    );
  }
  return pick.target;

  // ────────────────── helpers ──────────────────
  /**
   * Helper function that ascends directory tree looking for stepzen.config.json
   * @param dir Starting directory path
   * @returns Path to directory containing stepzen.config.json or null if not found
   */
  function ascendForConfig(dir: string): string | null {
    // Validate input
    if (!dir || typeof dir !== "string") {
      services.logger.error(
        "Invalid directory path provided to ascendForConfig"
      );
      return null;
    }

    try {
      while (true) {
        const configPath = path.join(dir, "stepzen.config.json");
        if (fs.existsSync(configPath)) {
          return dir;
        }
        const parent = path.dirname(dir);
        if (parent === dir) {
          break;
        }
        dir = parent;
      }
    } catch (err) {
      const error = new StepZenError(
        "Failed to search for StepZen configuration in directory tree",
        "FILESYSTEM_ERROR",
        err
      );
      handleError(error);
      return null;
    }

    return null;
  }
}
