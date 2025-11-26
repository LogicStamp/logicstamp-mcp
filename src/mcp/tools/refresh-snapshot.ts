/**
 * Tool 1: logicstamp_refresh_snapshot
 * Run `stamp context` and create a snapshot before edits
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile } from 'fs/promises';
import { join, resolve } from 'path';
import type { RefreshSnapshotInput, RefreshSnapshotOutput, LogicStampIndex } from '../../types/schemas.js';
import { stateManager } from '../state.js';

const execAsync = promisify(exec);

export async function refreshSnapshot(input: RefreshSnapshotInput): Promise<RefreshSnapshotOutput> {
  const profile = input.profile || 'llm-chat';
  const mode = input.mode || 'header';
  const projectPath = input.projectPath 
    ? resolve(input.projectPath) 
    : (process.env.PROJECT_PATH ? resolve(process.env.PROJECT_PATH) : process.cwd());

  // Generate snapshot ID
  const snapshotId = stateManager.generateSnapshotId();

  try {
    // Execute stamp context command
    // Use --skip-gitignore to ensure non-interactive operation and prevent .gitignore modifications
    // Use --quiet to suppress verbose output since MCP reads JSON files directly
    const command = `stamp context --profile ${profile} --include-code ${mode} --skip-gitignore --quiet`;

    await execAsync(command, {
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
      contextDir: projectPath,
    });

    // Build output
    const output: RefreshSnapshotOutput = {
      snapshotId,
      projectPath,
      profile,
      mode,
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
    throw new Error(
      `Failed to refresh snapshot: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
