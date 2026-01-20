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
 * Check if a process is still running by PID
 */
function isProcessRunning(pid: number): boolean {
  try {
    // Sending signal 0 tests if process exists without killing it
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if watch mode is active for the project
 * Returns watch status info if active, null otherwise
 */
async function checkWatchMode(projectPath: string): Promise<{
  active: boolean;
  pid?: number;
  startedAt?: string;
} | null> {
  const statusPath = join(projectPath, '.logicstamp', 'context_watch-status.json');

  if (!(await exists(statusPath))) {
    return null;
  }

  try {
    const content = await readFile(statusPath, 'utf-8');
    const status = JSON.parse(content);

    // Verify the process is still running
    if (status.pid && !isProcessRunning(status.pid)) {
      // Status file exists but process is dead - stale status
      return null;
    }

    return {
      active: status.active === true,
      pid: status.pid,
      startedAt: status.startedAt,
    };
  } catch {
    return null;
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
  // Default depth to 2 (schema default), but allow override
  // Ensure depth is a number if provided (MCP may send it as string or null)
  // Handle both undefined and null as "not provided" - default to 2
  const depth = (input.depth !== undefined && input.depth !== null) ? Number(input.depth) : 2; // Default to 2
  // Validate depth is a positive integer
  if (!Number.isInteger(depth) || depth < 1) {
    throw new Error(
      `Invalid depth parameter: ${input.depth}. ` +
      `Depth must be a positive integer (1 or higher). ` +
      `Depth controls dependency traversal: depth=1 includes only direct dependencies, ` +
      `depth=2 includes nested components (recommended for React projects).`
    );
  }
  
  // CRITICAL: projectPath is now REQUIRED in the schema
  // If it's missing, throw a clear error instead of hanging
  if (!input.projectPath) {
    throw new Error(
      'projectPath parameter is REQUIRED but was not provided. ' +
      'The MCP client must provide the absolute path to the project root. ' +
      'When stamp init has been run, some MCP clients may omit this parameter, causing hangs. ' +
      'Please ensure your MCP client is configured to always send projectPath. ' +
      'Example: { "projectPath": "/absolute/path/to/project" }'
    );
  }
  
  // Always resolve to absolute path to avoid issues with relative paths
  const projectPath = resolve(input.projectPath);

  // Generate snapshot ID
  const snapshotId = stateManager.generateSnapshotId();

  // Check if we should skip regeneration when watch mode is active
  // Default to true - watch mode means context is fresh, no need to regenerate
  const skipIfWatchActive = input.skipIfWatchActive ?? true;

  if (skipIfWatchActive) {
    const watchStatus = await checkWatchMode(projectPath);

    if (watchStatus?.active) {
      // Watch mode is active - skip regeneration, just read existing context
      const contextMainPath = join(projectPath, 'context_main.json');

      if (!(await exists(contextMainPath))) {
        throw new Error(
          'skipIfWatchActive is true and watch mode is active, but context_main.json does not exist. ' +
          'This may happen if watch mode just started and hasn\'t completed its initial build yet. ' +
          'Either wait for watch mode to complete its initial build, or call refresh_snapshot with skipIfWatchActive=false.'
        );
      }

      try {
        const contextMainContent = await readFile(contextMainPath, 'utf-8');
        const contextMain: LogicStampIndex = JSON.parse(contextMainContent);

        // Store snapshot (even though we didn't regenerate)
        stateManager.setSnapshot({
          id: snapshotId,
          createdAt: new Date().toISOString(),
          projectPath,
          profile,
          mode,
          includeStyle,
          depth,
          contextDir: projectPath,
        });

        // Build output - no regeneration occurred
        const output: RefreshSnapshotOutput = {
          snapshotId,
          projectPath,
          profile,
          mode,
          includeStyle,
          depth,
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
          watchMode: {
            active: true,
            message: 'Watch mode is ACTIVE - skipped regeneration. Context files are being kept fresh automatically via incremental rebuilds. Using existing context_main.json.',
            pid: watchStatus.pid,
            startedAt: watchStatus.startedAt,
          },
        };

        return output;
      } catch (readError) {
        const readErrorMessage = readError instanceof Error ? readError.message : String(readError);
        throw new Error(
          `skipIfWatchActive is true and watch mode is active, but failed to read context_main.json: ${readErrorMessage}`
        );
      }
    }
    // Watch mode is not active - fall through to normal regeneration
  }

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
    // IMPORTANT: Since depth defaults to 2 (same as profiles), we can use profile when depth=2
    // But when depth is explicitly set to a different value, set flags individually to avoid profile conflicts
    // Profile settings: llm-chat = depth=2, header mode, max-nodes=100
    // llm-safe = depth=2, header mode, max-nodes=30
    // ci-strict = depth=2, none mode, strict-missing
    const styleFlag = includeStyle ? ' --include-style' : '';
    const maxNodes = profile === 'llm-safe' ? '30' : '100';
    const strictFlag = profile === 'ci-strict' ? ' --strict-missing' : '';
    // Use the explicitly provided mode (or default), not profile's mode
    const effectiveMode = mode || (profile === 'ci-strict' ? 'none' : 'header');
    // When depth=2 (default), use profile for convenience. When depth differs, set flags individually
    let command: string;
    if (depth === 2) {
      // Default depth matches profile default - use profile for convenience
      command = `stamp context --profile ${profile} --include-code ${effectiveMode}${styleFlag} --skip-gitignore --quiet`;
    } else {
      // Depth explicitly set to a different value - set flags individually to avoid profile overriding depth
      command = `stamp context --depth ${depth} --include-code ${effectiveMode} --max-nodes ${maxNodes}${styleFlag}${strictFlag} --skip-gitignore --quiet`;
    }

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
        `Failed to read context_main.json after stamp context execution. ` +
        `The command completed successfully, but the expected file was not found.\n\n` +
        `File path: ${contextMainPath}\n` +
        `Working directory: ${projectPath}\n` +
        `Read error: ${readErrorMessage}\n\n` +
        `Possible causes: ` +
        `(1) The stamp CLI may have failed silently - check command output below, ` +
        `(2) File permissions issue - ensure the directory is writable, ` +
        `(3) The CLI may have written to a different location.\n\n` +
        `Command stdout: ${execResult.stdout || '(empty)'}\n` +
        `Command stderr: ${execResult.stderr || '(empty)'}\n\n` +
        `Try running 'stamp context' manually from ${projectPath} to diagnose the issue.`
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
      depth,
      contextDir: projectPath,
    });

    // Check if watch mode is active
    const watchStatus = await checkWatchMode(projectPath);

    // Build output
    const output: RefreshSnapshotOutput = {
      snapshotId,
      projectPath,
      profile,
      mode,
      includeStyle,
      depth,
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

    // Add watch mode info if active
    if (watchStatus?.active) {
      output.watchMode = {
        active: true,
        message: 'Watch mode is ACTIVE. Context bundles are being kept fresh automatically via incremental rebuilds. Future refresh_snapshot calls may be unnecessary - the context files are already up-to-date.',
        pid: watchStatus.pid,
        startedAt: watchStatus.startedAt,
      };
    }

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
