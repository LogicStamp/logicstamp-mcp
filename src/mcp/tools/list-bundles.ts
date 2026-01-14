/**
 * Tool 2: logicstamp_list_bundles
 * List available bundles in a snapshot for selective loading
 */

import { readFile } from 'fs/promises';
import { join } from 'path';
import type {
  ListBundlesInput,
  ListBundlesOutput,
  BundleDescriptor,
  LogicStampBundle,
} from '../../types/schemas.js';
import { stateManager } from '../state.js';

export async function listBundles(input: ListBundlesInput): Promise<ListBundlesOutput> {
  const snapshot = stateManager.getSnapshot(input.snapshotId);

  if (!snapshot) {
    throw new Error(
      `Snapshot not found: ${input.snapshotId}. ` +
      `The snapshot may have expired (snapshots expire after 1 hour) or was never created. ` +
      `Run logicstamp_refresh_snapshot first to create a new snapshot, then use the returned snapshotId.`
    );
  }

  try {
    // Read context_main.json to get folder information
    const contextMainPath = join(snapshot.contextDir, 'context_main.json');
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
      const contextPath = join(snapshot.contextDir, folder.path, 'context.json');

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

    return {
      snapshotId: input.snapshotId,
      totalBundles: bundles.length,
      bundles,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to list bundles for snapshot ${input.snapshotId}. ` +
      `Error: ${errorMessage}. ` +
      `Ensure the snapshot exists and context_main.json is readable at ${snapshot?.contextDir || 'unknown path'}. ` +
      `If the snapshot expired, run logicstamp_refresh_snapshot to create a new one.`
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
