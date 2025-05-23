/**
 * Copyright IBM Corp. 2025
 * Assisted by CursorAI
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import { ProjectResolver } from '../../../services/projectResolver';
import { Logger } from '../../../services/logger';
import { StepZenError } from '../../../errors';
import { createMock } from '../../helpers/test-utils';

suite('ProjectResolver Service', () => {
  let projectResolver: ProjectResolver;
  let mockLogger: Logger;
  let originalWorkspaceFolders: readonly vscode.WorkspaceFolder[] | undefined;
  let originalActiveTextEditor: vscode.TextEditor | undefined;
  let originalFindFiles: typeof vscode.workspace.findFiles;
  let originalShowQuickPick: typeof vscode.window.showQuickPick;

  suiteSetup(() => {
    // Store original VS Code API methods
    originalWorkspaceFolders = vscode.workspace.workspaceFolders;
    originalActiveTextEditor = vscode.window.activeTextEditor;
    originalFindFiles = vscode.workspace.findFiles;
    originalShowQuickPick = vscode.window.showQuickPick;
  });

  setup(() => {
    // Create mock logger
    mockLogger = createMock<Logger>({
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    });

    // Create ProjectResolver instance
    projectResolver = new ProjectResolver(mockLogger);
  });

  teardown(() => {
    // Reset VS Code API mocks
    Object.defineProperty(vscode.workspace, 'workspaceFolders', {
      value: originalWorkspaceFolders,
      configurable: true
    });
    Object.defineProperty(vscode.window, 'activeTextEditor', {
      value: originalActiveTextEditor,
      configurable: true
    });
    (vscode.workspace as any).findFiles = originalFindFiles;
    (vscode.window as any).showQuickPick = originalShowQuickPick;

    // Clear cache
    projectResolver.clearCache();
  });

  suite('resolveStepZenProjectRoot', () => {
    test('should scan workspace when no active editor', async () => {
      const projectPath = '/workspace/my-project';
      const configUri = vscode.Uri.file(path.join(projectPath, 'stepzen.config.json'));

      // Mock no active editor
      Object.defineProperty(vscode.window, 'activeTextEditor', {
        value: undefined,
        configurable: true
      });

      // Mock workspace.findFiles to return one config
      (vscode.workspace as any).findFiles = async () => [configUri];

      const result = await projectResolver.resolveStepZenProjectRoot();
      assert.strictEqual(result, projectPath);
    });

    test('should prompt user when multiple projects found', async () => {
      const project1Path = '/workspace/project1';
      const project2Path = '/workspace/project2';
      const config1Uri = vscode.Uri.file(path.join(project1Path, 'stepzen.config.json'));
      const config2Uri = vscode.Uri.file(path.join(project2Path, 'stepzen.config.json'));

      // Mock no active editor
      Object.defineProperty(vscode.window, 'activeTextEditor', {
        value: undefined,
        configurable: true
      });

      // Mock workspace.findFiles to return multiple configs
      (vscode.workspace as any).findFiles = async () => [config1Uri, config2Uri];

      // Mock workspace.asRelativePath
      (vscode.workspace as any).asRelativePath = (fsPath: string) => {
        return path.basename(fsPath);
      };

      // Mock user selection
      (vscode.window as any).showQuickPick = async (items: any[]) => {
        return items[0]; // Select first project
      };

      const result = await projectResolver.resolveStepZenProjectRoot();
      assert.strictEqual(result, project1Path);
    });

    test('should throw error when no StepZen projects found', async () => {
      // Mock no active editor
      Object.defineProperty(vscode.window, 'activeTextEditor', {
        value: undefined,
        configurable: true
      });

      // Mock workspace.findFiles to return empty array
      (vscode.workspace as any).findFiles = async () => [];

      try {
        await projectResolver.resolveStepZenProjectRoot();
        assert.fail('Expected StepZenError to be thrown');
      } catch (err) {
        assert.ok(err instanceof StepZenError);
        assert.strictEqual((err as StepZenError).code, 'CONFIG_NOT_FOUND');
      }
    });

    test('should throw error when user cancels project selection', async () => {
      const project1Path = '/workspace/project1';
      const project2Path = '/workspace/project2';
      const config1Uri = vscode.Uri.file(path.join(project1Path, 'stepzen.config.json'));
      const config2Uri = vscode.Uri.file(path.join(project2Path, 'stepzen.config.json'));

      // Mock no active editor
      Object.defineProperty(vscode.window, 'activeTextEditor', {
        value: undefined,
        configurable: true
      });

      // Mock workspace.findFiles to return multiple configs (to trigger user prompt)
      (vscode.workspace as any).findFiles = async () => [config1Uri, config2Uri];

      // Mock workspace.asRelativePath
      (vscode.workspace as any).asRelativePath = (fsPath: string) => {
        return path.basename(fsPath);
      };

      // Mock user cancellation
      (vscode.window as any).showQuickPick = async () => undefined;

      try {
        await projectResolver.resolveStepZenProjectRoot();
        assert.fail('Expected StepZenError to be thrown');
      } catch (err) {
        assert.ok(err instanceof StepZenError);
        assert.strictEqual((err as StepZenError).code, 'USER_CANCELLED');
      }
    });

    test('should handle multi-root workspace', async () => {
      const workspace1 = createMock<vscode.WorkspaceFolder>({
        name: 'workspace1',
        uri: vscode.Uri.file('/workspace1'),
        index: 0
      });
      const workspace2 = createMock<vscode.WorkspaceFolder>({
        name: 'workspace2', 
        uri: vscode.Uri.file('/workspace2'),
        index: 1
      });

      const project1Path = '/workspace1/project1';
      const project2Path = '/workspace2/project2';
      const config1Uri = vscode.Uri.file(path.join(project1Path, 'stepzen.config.json'));
      const config2Uri = vscode.Uri.file(path.join(project2Path, 'stepzen.config.json'));

      // Mock multi-root workspace
      Object.defineProperty(vscode.workspace, 'workspaceFolders', {
        value: [workspace1, workspace2],
        configurable: true
      });

      // Mock no active editor
      Object.defineProperty(vscode.window, 'activeTextEditor', {
        value: undefined,
        configurable: true
      });

      // Mock workspace.findFiles for each workspace folder
      (vscode.workspace as any).findFiles = async (pattern: any) => {
        if (pattern.baseUri?.fsPath === '/workspace1') {
          return [config1Uri];
        } else if (pattern.baseUri?.fsPath === '/workspace2') {
          return [config2Uri];
        }
        return [];
      };

      // Mock workspace.getWorkspaceFolder
      (vscode.workspace as any).getWorkspaceFolder = (uri: vscode.Uri) => {
        if (uri.fsPath.startsWith('/workspace1')) {
          return workspace1;
        }
        if (uri.fsPath.startsWith('/workspace2')) {
          return workspace2;
        }
        return undefined;
      };

      // Mock workspace.asRelativePath
      (vscode.workspace as any).asRelativePath = (fsPath: string) => {
        return path.basename(fsPath);
      };

      // Mock user selection
      (vscode.window as any).showQuickPick = async (items: any[]) => {
        // Should show items with workspace context
        assert.ok(items.length === 2);
        assert.ok(items[0].label.includes('workspace1'));
        assert.ok(items[1].label.includes('workspace2'));
        return items[0];
      };

      const result = await projectResolver.resolveStepZenProjectRoot();
      assert.strictEqual(result, project1Path);
    });
  });

  suite('caching', () => {
    test('should bypass cache when forceRefresh is true', async () => {
      const projectPath = '/workspace/my-project';
      const configUri = vscode.Uri.file(path.join(projectPath, 'stepzen.config.json'));

      // Mock no active editor
      Object.defineProperty(vscode.window, 'activeTextEditor', {
        value: undefined,
        configurable: true
      });

      // Mock workspace.findFiles for force refresh
      (vscode.workspace as any).findFiles = async () => [configUri];

      // Force refresh should bypass cache and resolve again
      const result = await projectResolver.resolveStepZenProjectRoot(undefined, true);
      assert.strictEqual(result, projectPath);
    });
  });

  suite('clearCache', () => {
    test('should clear the cache', () => {
      // Clear cache should not throw
      projectResolver.clearCache();
      
      // Verify cache is cleared
      assert.strictEqual(projectResolver.getCachedProjectRoot(), null);
    });
  });

  suite('getCachedProjectRoot', () => {
    test('should return null when no cache exists', () => {
      // Should return null before caching
      assert.strictEqual(projectResolver.getCachedProjectRoot(), null);
    });
  });

  suite('error handling', () => {
    test('should handle invalid hint URI gracefully', async () => {
      const projectPath = '/workspace/my-project';
      
      // Mock workspace.findFiles for fallback
      (vscode.workspace as any).findFiles = async () => [
        vscode.Uri.file(path.join(projectPath, 'stepzen.config.json'))
      ];

      // Mock workspace.getWorkspaceFolder to handle null fsPath
      (vscode.workspace as any).getWorkspaceFolder = () => undefined;

      // Create invalid URI (null fsPath)
      const invalidUri = createMock<vscode.Uri>({
        fsPath: null as any
      });

      // Should fall back to workspace scan
      const result = await projectResolver.resolveStepZenProjectRoot(invalidUri);
      assert.strictEqual(result, projectPath);
    });

    test('should handle workspace.findFiles errors gracefully', async () => {
      const workspace1 = createMock<vscode.WorkspaceFolder>({
        name: 'workspace1',
        uri: vscode.Uri.file('/workspace1'),
        index: 0
      });

      // Mock multi-root workspace
      Object.defineProperty(vscode.workspace, 'workspaceFolders', {
        value: [workspace1],
        configurable: true
      });

      // Mock no active editor
      Object.defineProperty(vscode.window, 'activeTextEditor', {
        value: undefined,
        configurable: true
      });

      // Mock workspace.findFiles to throw error
      (vscode.workspace as any).findFiles = async () => {
        throw new Error('File search failed');
      };

      try {
        await projectResolver.resolveStepZenProjectRoot();
        assert.fail('Expected StepZenError to be thrown');
      } catch (err) {
        assert.ok(err instanceof StepZenError);
        assert.strictEqual((err as StepZenError).code, 'CONFIG_NOT_FOUND');
      }
    });
  });
}); 