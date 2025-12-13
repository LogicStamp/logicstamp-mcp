/**
 * Tool 1: logicstamp_refresh_snapshot
 * Run `stamp context` and create a snapshot before edits
 */

import { readFile, rm, access } from 'fs/promises';
import { join, resolve } from 'path';
import { constants } from 'fs';
import type { RefreshSnapshotInput, RefreshSnapshotOutput, LogicStampIndex } from '../../types/schemas.js';
import { stateManager } from '../state.js';
import { execWithTimeout } from '../utils/exec-with-timeout.js';

/**
 * Check if a file or directory exists
 */
async function exists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Detect if .logicstamp cache is corrupted or has path mismatch
 * Returns true if cache should be cleaned
 */
async function shouldCleanCache(projectPath: string): Promise<boolean> {
  const logicstampDir = join(projectPath, '.logicstamp');
  
  // If cache doesn't exist, nothing to clean
  if (!(await exists(logicstampDir))) {
    return false;
  }
  
  // Check for common corruption indicators:
  // 1. Check if context_main.json exists but is invalid JSON (corruption)
  const contextMainPath = join(projectPath, 'context_main.json');
  if (await exists(contextMainPath)) {
    try {
      const content = await readFile(contextMainPath, 'utf-8');
      JSON.parse(content);
    } catch {
      // Invalid JSON = corruption, should clean
      return true;
    }
  }
  
  // 2. Check if .logicstamp contains metadata files that might have stale paths
  // This is a heuristic - if stamp init was run, there might be config files
  // with stale project paths. We check by trying to read common config files.
  try {
    const { readdir } = await import('fs/promises');
    const entries = await readdir(logicstampDir, { withFileTypes: true });
    
    // Look for config/metadata files that might contain project paths
    for (const entry of entries) {
      if (entry.isFile() && (entry.name.includes('config') || entry.name.includes('meta'))) {
        const configPath = join(logicstampDir, entry.name);
        try {
          const content = await readFile(configPath, 'utf-8');
          const config = JSON.parse(content);
          // If config has a projectPath that doesn't match current project, it's stale
          if (config.projectPath && config.projectPath !== projectPath && config.projectPath !== resolve(projectPath)) {
            return true;
          }
        } catch {
          // Invalid JSON in config = corruption
          return true;
        }
      }
    }
  } catch {
    // Can't read directory = might be corrupted
    return true;
  }
  
  return false;
}

/**
 * Clean LogicStamp cache folder - only use when corruption/mismatch detected or manually requested
 */
async function cleanLogicStampCache(projectPath: string): Promise<void> {
  const logicstampDir = join(projectPath, '.logicstamp');
  
  try {
    await rm(logicstampDir, { recursive: true, force: true });
  } catch (error) {
    // Silently ignore - folder might be locked or already deleted
  }
}

export async function refreshSnapshot(input: RefreshSnapshotInput): Promise<RefreshSnapshotOutput> {
  const profile = input.profile || 'llm-chat';
  const mode = input.mode || 'header';
  const includeStyle = input.includeStyle || false;
  
  // CRITICAL: projectPath is now REQUIRED in the schema
  // If it's missing, throw a clear error instead of hanging
  if (!input.projectPath) {
    throw new Error(
      'projectPath is REQUIRED. The MCP client must provide the absolute path to the project root. ' +
      'When stamp init has been run, some MCP clients may omit this parameter, causing hangs. ' +
      'Please ensure your MCP client is configured to always send projectPath.'
    );
  }
  
  // Always resolve to absolute path to avoid issues with relative paths
  const projectPath = resolve(input.projectPath);

  // Generate snapshot ID
  const snapshotId = stateManager.generateSnapshotId();

  try {
    // Smart cache cleanup: only clean if corruption/mismatch detected or manually requested
    // This preserves cache benefits (speed + stability) while handling real issues
    const cleanCache = input.cleanCache || false;
    const shouldClean = cleanCache || await shouldCleanCache(projectPath);
    
    if (shouldClean) {
      await cleanLogicStampCache(projectPath);
    }

    // Execute stamp context command
    // Use --skip-gitignore to ensure non-interactive operation and prevent .gitignore modifications
    // Use --quiet to suppress verbose output since MCP reads JSON files directly
    // Add --include-style flag if includeStyle is true (equivalent to stamp context style)
    const styleFlag = includeStyle ? ' --include-style' : '';
    const command = `stamp context --profile ${profile} --include-code ${mode}${styleFlag} --skip-gitignore --quiet`;

    const execResult = await execWithTimeout(command, {
      cwd: projectPath,
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    });

    // Read context_main.json
    const contextMainPath = join(projectPath, 'context_main.json');
    // Verify file exists before reading
    let contextMain: LogicStampIndex;
    try {
    const contextMainContent = await readFile(contextMainPath, 'utf-8');
      contextMain = JSON.parse(contextMainContent);
    } catch (readError) {
      // If file read fails, provide helpful error message
      const readErrorMessage = readError instanceof Error ? readError.message : String(readError);
      throw new Error(
        `Failed to read context_main.json after stamp context execution.\n` +
        `Command completed successfully, but file not found at: ${contextMainPath}\n` +
        `Working directory: ${projectPath}\n` +
        `Command output: ${execResult.stdout}\n` +
        `Command errors: ${execResult.stderr}\n` +
        `Read error: ${readErrorMessage}`
      );
    }

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
