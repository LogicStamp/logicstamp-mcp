/**
 * Tool 2: logicstamp_list_bundles
 * List available bundles in a snapshot for selective loading
 */

import { readFile, access } from 'fs/promises';
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
 * Check if watch mode is active for the project
 */
async function checkWatchMode(projectPath: string): Promise<boolean> {
  const statusPath = join(projectPath, '.logicstamp', 'context_watch-status.json');

  if (!(await exists(statusPath))) {
    return false;
  }

  try {
    const content = await readFile(statusPath, 'utf-8');
    const status = JSON.parse(content);

    // Verify the process is still running
    if (status.pid && !isProcessRunning(status.pid)) {
      return false;
    }

    return status.active === true;
  } catch {
    return false;
  }
}

export async function listBundles(input: ListBundlesInput): Promise<ListBundlesOutput> {
  let contextDir: string;
  let snapshotId: string | undefined;
  let projectPath: string;
  let isWatchMode = false;

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
  } else if (input.projectPath) {
    // Direct disk access - check if watch mode is active or context files exist
    projectPath = resolve(input.projectPath);
    const watchModeActive = await checkWatchMode(projectPath);
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

    if (!watchModeActive) {
      // Context exists but watch mode is not active - warn but allow
      // The context might be stale, but we'll allow access
    }

    contextDir = projectPath;
    isWatchMode = watchModeActive;
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
    const contextMainContent = await readFile(contextMainPath, 'utf-8');
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
        const contextContent = await readFile(contextPath, 'utf-8');
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
