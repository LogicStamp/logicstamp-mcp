/**
 * Tool 3: logicstamp_read_bundle
 * Return the full bundle (contract + graph) for a specific component
 */

import { readFile, access } from 'fs/promises';
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

export async function readBundle(input: ReadBundleInput): Promise<ReadBundleOutput> {
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
    // Read the context.json file from the specified bundle path
    const contextPath = join(contextDir, input.bundlePath);
    const contextContent = await readFile(contextPath, 'utf-8');

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
          `The component may not exist in this bundle file, or the component name may be incorrect. ` +
          `Use logicstamp_list_bundles to see all available components in this snapshot, ` +
          `or omit rootComponent to read the first bundle in the file.`
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
