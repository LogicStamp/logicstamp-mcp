/**
 * Tool 3: logicstamp_read_bundle
 * Return the full bundle (contract + graph) for a specific component
 */

import { readFile } from 'fs/promises';
import { join } from 'path';
import type {
  ReadBundleInput,
  ReadBundleOutput,
  LogicStampBundle,
} from '../../types/schemas.js';
import { stateManager } from '../state.js';

export async function readBundle(input: ReadBundleInput): Promise<ReadBundleOutput> {
  const snapshot = stateManager.getSnapshot(input.snapshotId);

  if (!snapshot) {
    throw new Error(`Snapshot not found: ${input.snapshotId}`);
  }

  try {
    // Read the context.json file from the specified bundle path
    const contextPath = join(snapshot.contextDir, input.bundlePath);
    const contextContent = await readFile(contextPath, 'utf-8');
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
          `Bundle not found for component: ${input.rootComponent} in ${input.bundlePath}`
        );
      }

      targetBundle = found;
    } else {
      // If no rootComponent specified, return the first bundle
      if (bundleArray.length === 0) {
        throw new Error(`No bundles found in ${input.bundlePath}`);
      }
      targetBundle = bundleArray[0];
    }

    return {
      snapshotId: input.snapshotId,
      bundlePath: input.bundlePath,
      rootComponent: input.rootComponent,
      bundle: targetBundle,
    };
  } catch (error) {
    throw new Error(
      `Failed to read bundle: ${error instanceof Error ? error.message : String(error)}`
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
