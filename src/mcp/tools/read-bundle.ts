/**
 * Tool 3: logicstamp_read_bundle
 * Return the full bundle (contract + graph) for a specific component
 */

import { readFile, access, unlink } from 'fs/promises';
import { join, resolve } from 'path';
import { constants } from 'fs';
import type {
  ReadBundleInput,
  ReadBundleOutput,
  LogicStampBundle,
  LogicStampIndex,
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
 * 
 * Note: This function validates JSON parsing to catch partial writes, but
 * does NOT validate TypeScript files - that's handled by the caller.
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
      
      // Check if this looks like a TypeScript file (not JSON)
      // If so, return it immediately - let the caller handle the validation error
      const trimmedContent = content.trim();
      if (trimmedContent.startsWith('import ') || trimmedContent.startsWith('export ')) {
        // This is likely a TypeScript file, not a partial JSON write
        // Return it so the caller can throw the appropriate error
        return content;
      }
      
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

export async function readBundle(input: ReadBundleInput): Promise<ReadBundleOutput> {
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
    // Read the context.json file from the specified bundle path
    const contextPath = join(contextDir, input.bundlePath);
    // Use retry logic when watch mode is active to handle race conditions
    const contextContent = await readFileWithRetry(contextPath, watchStatus);

    // Validate that we're reading JSON, not a TypeScript file
    const trimmedContent = contextContent.trim();
    if (trimmedContent.startsWith('import ') || trimmedContent.startsWith('export ')) {
      throw new Error(
        `Invalid bundle file: ${contextPath} appears to be a TypeScript file, not JSON. ` +
        `The bundlePath should point to a context.json file, not a source file. ` +
        `Use logicstamp_list_bundles to get the correct bundlePath for a component, ` +
        `or check that the bundlePath format is correct (e.g., "src/components/context.json").`
      );
    }

    // Check if this is context_main.json (LogicStampIndex) or a bundle file (LogicStampBundle[])
    const isIndexFile = input.bundlePath === 'context_main.json' ||
                        input.bundlePath.endsWith('/context_main.json') ||
                        input.bundlePath.endsWith('\\context_main.json');

    if (isIndexFile) {
      // Parse as LogicStampIndex
      const index: LogicStampIndex = JSON.parse(contextContent);

      // Validate it's actually an index file
      if (index.type !== 'LogicStampIndex') {
        throw new Error(
          `File ${input.bundlePath} does not appear to be a valid LogicStampIndex file. ` +
          `Expected type: "LogicStampIndex", but got: ${(index as any).type || 'undefined'}. ` +
          `This may indicate the file is corrupted or is not a LogicStamp context file. ` +
          `Ensure you're reading context_main.json from a valid LogicStamp snapshot.`
        );
      }

      const output: ReadBundleOutput = {
        projectPath,
        bundlePath: input.bundlePath,
        index: index,
      };

      if (snapshotId) {
        output.snapshotId = snapshotId;
      }

      if (isWatchMode) {
        output.watchMode = true;
      }

      return output;
    }

    // Parse as LogicStampBundle[] array
    const bundleArray: LogicStampBundle[] = JSON.parse(contextContent);

    // If rootComponent is specified, find matching bundle
    let targetBundle: LogicStampBundle;

    if (input.rootComponent) {
      const found = bundleArray.find((bundle) => {
        const rootNode = bundle.graph.nodes[0];
        if (!rootNode) return false;

        const componentName = extractComponentName(rootNode.entryId);
        return componentName === input.rootComponent;
      });

      if (!found) {
        throw new Error(
          `Bundle not found for component "${input.rootComponent}" in ${input.bundlePath}. ` +
          `IMPORTANT: LogicStamp organizes components into ROOT components (have their own bundles) and DEPENDENCIES (included in importing root's bundle). ` +
          `If "${input.rootComponent}" is not listed in logicstamp_list_bundles output, it's likely a DEPENDENCY, not a root component. ` +
          `To find a dependency: (1) Use logicstamp_list_bundles to see all root components, ` +
          `(2) Read bundles that might import "${input.rootComponent}" (check bundle.graph.nodes[] for dependency contracts), ` +
          `or (3) Search source code to find which root component imports "${input.rootComponent}". ` +
          `Dependencies appear in bundle.graph.nodes[] of the root component that imports them, not as separate root bundles.`
        );
      }

      targetBundle = found;
    } else {
      // If no rootComponent specified, return the first bundle
      if (bundleArray.length === 0) {
        throw new Error(
          `No bundles found in ${input.bundlePath}. ` +
          `This bundle file is empty or invalid. ` +
          `Ensure the bundlePath is correct (use logicstamp_list_bundles to see available bundles), ` +
          `or the folder may not contain any components.`
        );
      }
      targetBundle = bundleArray[0];
    }

    const output: ReadBundleOutput = {
      projectPath,
      bundlePath: input.bundlePath,
      rootComponent: input.rootComponent,
      bundle: targetBundle,
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
      `Failed to read bundle at ${input.bundlePath}. ` +
      `Error: ${errorMessage}. ` +
      `Ensure the bundlePath is correct (use logicstamp_list_bundles to verify), ` +
      `and the file is readable. If using a snapshot that expired, run logicstamp_refresh_snapshot to create a new one. ` +
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
