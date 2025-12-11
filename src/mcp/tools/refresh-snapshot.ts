/**
 * Tool 1: logicstamp_refresh_snapshot
 * Run `stamp context` and create a snapshot before edits
 */

import { readFile } from 'fs/promises';
import { join, resolve } from 'path';
import type { RefreshSnapshotInput, RefreshSnapshotOutput, LogicStampIndex } from '../../types/schemas.js';
import { stateManager } from '../state.js';
import { execWithTimeout } from '../utils/exec-with-timeout.js';

export async function refreshSnapshot(input: RefreshSnapshotInput): Promise<RefreshSnapshotOutput> {
  const profile = input.profile || 'llm-chat';
  const mode = input.mode || 'header';
  const includeStyle = input.includeStyle || false;
  const projectPath = input.projectPath 
    ? resolve(input.projectPath) 
    : (process.env.PROJECT_PATH ? resolve(process.env.PROJECT_PATH) : process.cwd());

  // Generate snapshot ID
  const snapshotId = stateManager.generateSnapshotId();

  try {
    // Execute stamp context command
    // Use --skip-gitignore to ensure non-interactive operation and prevent .gitignore modifications
    // Use --quiet to suppress verbose output since MCP reads JSON files directly
    // Add --include-style flag if includeStyle is true (equivalent to stamp context style)
    const styleFlag = includeStyle ? ' --include-style' : '';
    const command = `stamp context --profile ${profile} --include-code ${mode}${styleFlag} --skip-gitignore --quiet`;

    await execWithTimeout(command, {
      cwd: projectPath,
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    });

    // Read context_main.json
    const contextMainPath = join(projectPath, 'context_main.json');
    const contextMainContent = await readFile(contextMainPath, 'utf-8');
    const contextMain: LogicStampIndex = JSON.parse(contextMainContent);

    // Store snapshot
    stateManager.setSnapshot({
      id: snapshotId,
      createdAt: new Date().toISOString(),
      projectPath,
      profile,
      mode,
      includeStyle,
      contextDir: projectPath,
    });

    // Build output
    const output: RefreshSnapshotOutput = {
      snapshotId,
      projectPath,
      profile,
      mode,
      includeStyle,
      summary: {
        totalComponents: contextMain.summary.totalComponents,
        totalBundles: contextMain.summary.totalBundles,
        totalFolders: contextMain.summary.totalFolders,
        totalTokenEstimate: contextMain.summary.totalTokenEstimate,
        tokenEstimates: contextMain.summary.tokenEstimates || {
          gpt4oMini: 0,
          gpt4oMiniFullCode: 0,
          claude: 0,
          claudeFullCode: 0,
        },
        missingDependencies: contextMain.summary.missingDependencies || [],
      },
      folders: contextMain.folders,
    };

    return output;
  } catch (error) {
    // Preserve original error information
    const errorMessage = error instanceof Error ? error.message : String(error);
    const enhancedError = new Error(
      `Failed to refresh snapshot: ${errorMessage}`
    );
    
    // Preserve error code and other properties if available
    if (error && typeof error === 'object') {
      if ('code' in error) {
        (enhancedError as any).code = (error as any).code;
      }
      if ('stdout' in error) {
        (enhancedError as any).stdout = (error as any).stdout;
      }
      if ('stderr' in error) {
        (enhancedError as any).stderr = (error as any).stderr;
      }
    }
    
    throw enhancedError;
  }
}
