/**
 * Copyright IBM Corp. 2025
 * Assisted by CursorAI
 */

import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { StepZenError } from "../errors";
import { Logger } from "./logger";
import { FILE_PATTERNS, MESSAGES } from "../utils/constants";

/**
 * Cache entry for a resolved project root
 */
interface ProjectRootCache {
  /** The resolved project root path */
  projectRoot: string;
  /** Timestamp when this was cached */
  timestamp: number;
  /** The workspace folder this was resolved for */
  workspaceFolder?: vscode.WorkspaceFolder;
  /** The hint URI that was used for resolution */
  hintUri?: vscode.Uri;
}

/**
 * Service for resolving StepZen project roots with caching support
 * Handles multi-root workspace scenarios and caches the last resolved root
 */
export class ProjectResolver {
  private cache: ProjectRootCache | null = null;
  private readonly cacheTimeout = 30000; // 30 seconds cache timeout

  constructor(private logger: Logger) {}

  /**
   * Resolves the root directory of a StepZen project with caching
   * First tries to find a project containing the active editor,
   * then scans the workspace, and finally prompts the user if multiple projects exist
   *
   * @param hintUri Optional URI hint to start searching from
   * @param forceRefresh If true, bypasses cache and forces fresh resolution
   * @returns Promise resolving to the absolute path of the project root
   * @throws StepZenError if no StepZen project is found or user cancels selection
   */
  async resolveStepZenProjectRoot(
    hintUri?: vscode.Uri,
    forceRefresh = false,
  ): Promise<string> {
    // Check cache first (unless force refresh is requested)
    if (!forceRefresh && this.isCacheValid(hintUri)) {
      this.logger.debug(`Using cached project root: ${this.cache!.projectRoot}`);
      return this.cache!.projectRoot;
    }

    this.logger.debug("Resolving StepZen project root...");

    // ① Try the folder that owns the active editor or hint URI
    const start = hintUri ?? vscode.window.activeTextEditor?.document.uri;
    if (start) {
      // Validate that the URI has a valid filesystem path
      if (!start.fsPath || typeof start.fsPath !== "string") {
        this.logger.warn("Invalid path in active editor URI");
      } else {
        const byAscend = this.ascendForConfig(path.dirname(start.fsPath));
        if (byAscend) {
          this.updateCache(byAscend, start);
          return byAscend;
        }
      }
    }

    // ② Otherwise scan the workspace(s) for StepZen projects
    this.logger.info("StepZen project not found in current folder. Scanning workspace(s)...");
    
    const configs = await this.findStepZenConfigs();
    if (!configs || configs.length === 0) {
      throw new StepZenError(
        MESSAGES.NO_STEPZEN_PROJECT_FOUND,
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
      const projectRoot = path.dirname(configs[0].fsPath);
      this.updateCache(projectRoot, hintUri);
      return projectRoot;
    }

    // ③ Prompt when several projects exist
    this.logger.info("Multiple StepZen projects found. Prompting for selection...");
    
    const projectRoot = await this.promptForProjectSelection(configs);
    this.updateCache(projectRoot, hintUri);
    return projectRoot;
  }

  /**
   * Clears the cached project root
   * Useful when workspace changes or project structure changes
   */
  clearCache(): void {
    this.logger.debug("Clearing project root cache");
    this.cache = null;
  }

  /**
   * Gets the currently cached project root if valid
   * @returns The cached project root path or null if no valid cache
   */
  getCachedProjectRoot(): string | null {
    if (this.isCacheValid()) {
      return this.cache!.projectRoot;
    }
    return null;
  }

  /**
   * Checks if the current cache is valid for the given hint URI
   */
  private isCacheValid(hintUri?: vscode.Uri): boolean {
    if (!this.cache) {
      return false;
    }

    // Check if cache has expired
    const now = Date.now();
    if (now - this.cache.timestamp > this.cacheTimeout) {
      this.logger.debug("Project root cache expired");
      return false;
    }

    // If we have a hint URI, check if it's in the same workspace folder as cached
    if (hintUri) {
      const currentWorkspaceFolder = vscode.workspace.getWorkspaceFolder(hintUri);
      if (currentWorkspaceFolder !== this.cache.workspaceFolder) {
        this.logger.debug("Hint URI is in different workspace folder than cached");
        return false;
      }
    }

    // Verify the cached project root still exists and has a config file
    const configPath = path.join(this.cache.projectRoot, FILE_PATTERNS.CONFIG_FILE);
    if (!fs.existsSync(configPath)) {
      this.logger.debug("Cached project root no longer contains stepzen.config.json");
      return false;
    }

    return true;
  }

  /**
   * Updates the cache with a new project root
   */
  private updateCache(projectRoot: string, hintUri?: vscode.Uri): void {
    const workspaceFolder = hintUri ? vscode.workspace.getWorkspaceFolder(hintUri) : undefined;
    
    this.cache = {
      projectRoot,
      timestamp: Date.now(),
      workspaceFolder,
      hintUri,
    };
    
    this.logger.debug(`Cached project root: ${projectRoot}`);
  }

  /**
   * Finds all StepZen configuration files in the workspace(s)
   * Supports multi-root workspaces by searching in all workspace folders
   */
  private async findStepZenConfigs(): Promise<vscode.Uri[]> {
    const configs: vscode.Uri[] = [];

    // Handle multi-root workspaces
    if (vscode.workspace.workspaceFolders) {
      for (const folder of vscode.workspace.workspaceFolders) {
        try {
          const folderConfigs = await vscode.workspace.findFiles(
            new vscode.RelativePattern(folder, FILE_PATTERNS.CONFIG_FILE_PATTERN),
            new vscode.RelativePattern(folder, "**/node_modules/**"),
          );
          configs.push(...folderConfigs);
        } catch (err) {
          this.logger.warn(`Failed to search for configs in workspace folder ${folder.name}: ${err}`);
        }
      }
    } else {
      // Fallback for single workspace
      const allConfigs = await vscode.workspace.findFiles(
        FILE_PATTERNS.CONFIG_FILE_PATTERN,
        "**/node_modules/**",
      );
      configs.push(...allConfigs);
    }

    return configs;
  }

  /**
   * Prompts user to select from multiple StepZen projects
   */
  private async promptForProjectSelection(configs: vscode.Uri[]): Promise<string> {
    // Validate that all configs have valid paths
    const validConfigs = configs.filter(
      (c) => c.fsPath && typeof c.fsPath === "string",
    );
    
    if (validConfigs.length === 0) {
      throw new StepZenError(
        MESSAGES.NO_VALID_STEPZEN_PROJECT_PATHS,
        "INVALID_PROJECT_PATHS"
      );
    }

    // Create pick items with workspace folder context for multi-root workspaces
    const pickItems = validConfigs.map((c) => {
      const projectDir = path.dirname(c.fsPath);
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(c);
      
      let label: string;
      if (workspaceFolder && vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 1) {
        // Multi-root workspace: include workspace folder name
        const relativePath = vscode.workspace.asRelativePath(projectDir, false);
        label = `${workspaceFolder.name}: ${relativePath}`;
      } else {
        // Single workspace: just show relative path
        label = vscode.workspace.asRelativePath(projectDir, false);
      }

      return {
        label,
        target: projectDir,
        description: workspaceFolder ? `in ${workspaceFolder.name}` : undefined,
      };
    });

    const pick = await vscode.window.showQuickPick(pickItems, {
      placeHolder: "Select the StepZen project to use",
      matchOnDescription: true,
    });

    if (!pick || !pick.target) {
      throw new StepZenError(
        MESSAGES.OPERATION_CANCELLED_BY_USER,
        "USER_CANCELLED"
      );
    }

    return pick.target;
  }

  /**
   * Helper function that ascends directory tree looking for stepzen.config.json
   * @param dir Starting directory path
   * @returns Path to directory containing stepzen.config.json or null if not found
   */
  private ascendForConfig(dir: string): string | null {
    // Validate input
    if (!dir || typeof dir !== "string") {
      this.logger.error("Invalid directory path provided to ascendForConfig");
      return null;
    }

    try {
      while (true) {
        const configPath = path.join(dir, FILE_PATTERNS.CONFIG_FILE);
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
      this.logger.error("Failed to search for StepZen configuration in directory tree", err);
      return null;
    }

    return null;
  }
} 