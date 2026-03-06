/**
 * Tool 2: logicstamp_list_bundles
 * List available bundles in a snapshot for selective loading
 */

import { readFile, access, unlink } from 'fs/promises';
import { join, resolve } from 'path';
import { constants } from 'fs';
import type {
  ListBundlesInput,
  ListBundlesOutput,
  BundleDescriptor,
  LogicStampBundle,
} from '../../types/schemas.js';
import { stateManager } from '../state.js';
import { isProcessRunning } from '../utils/process-utils.js';

/**
 * Check if a file exists
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
 * Check if watch mode is active for the project.
 * Cleans up stale status files when the process is no longer running.
 * Returns watch mode status including strictWatch flag.
 */
async function checkWatchMode(projectPath: string): Promise<{
  active: boolean;
  strictWatch?: boolean;
}> {
  const statusPath = join(projectPath, '.logicstamp', 'context_watch-status.json');

  if (!(await exists(statusPath))) {
    return { active: false };
  }

  try {
    const content = await readFile(statusPath, 'utf-8');
    const status = JSON.parse(content);

    // Verify the process is still running
    if (status.pid && !isProcessRunning(status.pid)) {
      // Clean up stale file
      try {
        await unlink(statusPath);
      } catch {
        // Ignore cleanup errors
      }
      return { active: false };
    }

    return {
      active: status.active === true,
      strictWatch: status.strictWatch === true,
    };
  } catch {
    return { active: false };
  }
}

/**
 * Sleep utility for delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Read file with retry logic for watch mode.
 * When watch mode is active, files may be in the process of being written,
 * so we retry with exponential backoff if JSON parsing fails.
 */
async function readFileWithRetry(
  filePath: string,
  watchMode: { active: boolean; strictWatch?: boolean },
  maxRetries = 3
): Promise<string> {
  // If watch mode is active, add a small initial delay to let files stabilize
  // Strict watch mode does breaking change detection which may take longer
  // The retry logic below handles edge cases, so shorter delays are sufficient
  if (watchMode.active) {
    const delay = watchMode.strictWatch ? 500 : 200; // 500ms for strict watch, 200ms for regular watch
    await sleep(delay);
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const content = await readFile(filePath, 'utf-8');
      
      // Try to parse as JSON to validate it's complete
      // This catches cases where the file is partially written
      JSON.parse(content);
      
      return content;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // If watch mode is active and this might be a race condition, retry
      if (watchMode.active && attempt < maxRetries) {
        // Exponential backoff: 100ms, 200ms, 400ms
        const backoffDelay = 100 * Math.pow(2, attempt);
        await sleep(backoffDelay);
        continue;
      }
      
      // If not watch mode or out of retries, throw immediately
      throw lastError;
    }
  }

  throw lastError || new Error('Failed to read file after retries');
}

export async function listBundles(input: ListBundlesInput): Promise<ListBundlesOutput> {
  let contextDir: string;
  let snapshotId: string | undefined;
  let projectPath: string;
  let isWatchMode = false;
  let watchStatus: { active: boolean; strictWatch?: boolean } = { active: false };

  // Determine context directory: either from snapshot or direct disk access
  if (input.snapshotId) {
    // Use snapshot-based access
    const snapshot = stateManager.getSnapshot(input.snapshotId);

    if (!snapshot) {
      throw new Error(
        `Snapshot not found: ${input.snapshotId}. ` +
        `The snapshot may have expired (snapshots expire after 1 hour) or was never created. ` +
        `Run logicstamp_refresh_snapshot first to create a new snapshot, then use the returned snapshotId. ` +
        `Alternatively, if watch mode is active, you can omit snapshotId and provide projectPath instead.`
      );
    }

    contextDir = snapshot.contextDir;
    snapshotId = input.snapshotId;
    projectPath = snapshot.projectPath;
    // Check watch mode even for snapshots (in case watch mode started after snapshot)
    watchStatus = await checkWatchMode(projectPath);
    isWatchMode = watchStatus.active;
  } else if (input.projectPath) {
    // Direct disk access - check if watch mode is active or context files exist
    projectPath = resolve(input.projectPath);
    watchStatus = await checkWatchMode(projectPath);
    const contextMainPath = join(projectPath, 'context_main.json');
    const contextExists = await exists(contextMainPath);

    if (!contextExists) {
      throw new Error(
        `context_main.json not found at ${projectPath}. ` +
        `The context files have not been generated yet. ` +
        `Either: (1) Start watch mode with 'stamp context --watch', or ` +
        `(2) Call logicstamp_refresh_snapshot to generate context files first.`
      );
    }

    if (!watchStatus.active) {
      // Context exists but watch mode is not active - warn but allow
      // The context might be stale, but we'll allow access
    }

    contextDir = projectPath;
    isWatchMode = watchStatus.active;
  } else {
    throw new Error(
      'Either snapshotId or projectPath is required. ' +
      'If watch mode is active, provide projectPath for direct access to fresh context. ' +
      'Otherwise, call logicstamp_refresh_snapshot first to get a snapshotId.'
    );
  }

  try {
    // Read context_main.json to get folder information
    const contextMainPath = join(contextDir, 'context_main.json');
    // Use retry logic when watch mode is active to handle race conditions
    const contextMainContent = await readFileWithRetry(contextMainPath, watchStatus);
    const contextMain = JSON.parse(contextMainContent);

    // Filter folders by prefix if specified
    let folders = contextMain.folders;
    if (input.folderPrefix) {
      folders = folders.filter((f: any) =>
        f.path.startsWith(input.folderPrefix!)
      );
    }

    // Collect all bundles from filtered folders
    const bundles: BundleDescriptor[] = [];

    for (const folder of folders) {
      const contextPath = join(contextDir, folder.path, 'context.json');

      try {
        // Use retry logic when watch mode is active to handle race conditions
        const contextContent = await readFileWithRetry(contextPath, watchStatus);
        const bundleArray: LogicStampBundle[] = JSON.parse(contextContent);

        // Process each bundle in the folder
        for (const bundle of bundleArray) {
          const rootNode = bundle.graph.nodes[0];
          if (!rootNode) continue;

          const componentName = extractComponentName(rootNode.entryId);

          bundles.push({
            id: `bundle_${componentName}`,
            rootComponent: componentName,
            filePath: rootNode.contract.entryPathRel,
            folder: folder.path,
            bundlePath: join(folder.path, 'context.json').replace(/\\/g, '/'),
            position: bundle.position,
            bundleHash: bundle.bundleHash,
            approxTokens: estimateBundleTokens(bundle),
          });
        }
      } catch (error) {
        // Folder might not have context.json, skip it
        continue;
      }
    }

    const output: ListBundlesOutput = {
      projectPath,
      totalBundles: bundles.length,
      bundles,
    };

    if (snapshotId) {
      output.snapshotId = snapshotId;
    }

    if (isWatchMode) {
      output.watchMode = true;
      // Add warning to help AI assistants avoid unnecessary sleep() calls
      (output as any).warning = 'Watch mode is active - bundles are already fresh. Do not use sleep() delays before reading bundles.';
    }

    return output;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to list bundles. ` +
      `Error: ${errorMessage}. ` +
      `Ensure context_main.json is readable at ${contextDir}. ` +
      `If using a snapshot that expired, run logicstamp_refresh_snapshot to create a new one. ` +
      `If using watch mode, ensure 'stamp context --watch' is running.`
    );
  }
}

/**
 * Extract component name from entry ID
 */
function extractComponentName(entryId: string): string {
  const parts = entryId.split(/[/\\]/);
  const fileName = parts[parts.length - 1];
  return fileName.replace(/\.(ts|tsx|js|jsx)$/, '');
}

/**
 * Estimate token count for a bundle (rough approximation)
 */
function estimateBundleTokens(bundle: LogicStampBundle): number {
  const jsonString = JSON.stringify(bundle);
  // Rough estimate: ~4 characters per token
  return Math.ceil(jsonString.length / 4);
}
