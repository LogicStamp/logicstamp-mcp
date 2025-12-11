/**
 * Tool 4: logicstamp_compare_snapshot
 * Detect drift after edits by comparing current state to baseline
 * Implements diff logic in MCP by reading and comparing JSON files directly
 */

import { readFile } from 'fs/promises';
import { join, resolve } from 'path';
import type {
  CompareSnapshotInput,
  CompareSnapshotOutput,
  CompareResult,
  FolderDiff,
  ComponentChange,
  LogicStampIndex,
  LogicStampBundle,
  FolderMetadata,
  UIFContract,
} from '../../types/schemas.js';
import { stateManager } from '../state.js';
import { execWithTimeout } from '../utils/exec-with-timeout.js';

export async function compareSnapshot(input: CompareSnapshotInput): Promise<CompareSnapshotOutput> {
  const profile = input.profile || 'llm-chat';
  const mode = input.mode || 'header';
  const includeStyle = input.includeStyle || false;
  // Completely independent: includeStyle only affects CLI flag, forceRegenerate controls regeneration
  const forceRegenerate = input.forceRegenerate || false;
  
  const projectPath = input.projectPath 
    ? resolve(input.projectPath) 
    : (process.env.PROJECT_PATH ? resolve(process.env.PROJECT_PATH) : process.cwd());
  const baseline = input.baseline || 'disk';

  try {
    // Resolve baseline path
    let baselinePath: string;
    
    if (baseline === 'snapshot') {
      const snapshot = stateManager.getCurrentSnapshot();
      if (!snapshot) {
        throw new Error('No snapshot found. Run logicstamp_refresh_snapshot first.');
      }
      baselinePath = snapshot.contextDir;
    } else if (baseline === 'disk') {
      // For 'disk' baseline, use current snapshot if available
      // Otherwise, we'd need to compare against a previous disk state which we don't store
      const snapshot = stateManager.getCurrentSnapshot();
      if (!snapshot) {
        throw new Error(
          'No snapshot found for disk comparison. Run logicstamp_refresh_snapshot first to create a baseline.'
        );
      }
      baselinePath = snapshot.contextDir;
    } else if (baseline.startsWith('git:')) {
      // Future: support git baselines
      throw new Error(`Git baseline not yet implemented: ${baseline}`);
    } else {
      // Assume it's a path
      baselinePath = resolve(baseline);
    }

    // Read baseline context_main.json
    const baselineContextMainPath = join(baselinePath, 'context_main.json');
    const baselineContextMainContent = await readFile(baselineContextMainPath, 'utf-8');
    const baselineIndex: LogicStampIndex = JSON.parse(baselineContextMainContent);

    // Read or regenerate current state
    const currentContextMainPath = join(projectPath, 'context_main.json');
    let currentIndex: LogicStampIndex;
    
    if (forceRegenerate) {
      // Force regeneration: run stamp context before comparing
      const styleFlag = includeStyle ? ' --include-style' : '';
      const command = `stamp context --profile ${profile} --include-code ${mode}${styleFlag} --skip-gitignore --quiet`;
      
      await execWithTimeout(command, {
        cwd: projectPath,
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      });
      
      // Read the regenerated context_main.json
      const regeneratedContextMainContent = await readFile(currentContextMainPath, 'utf-8');
      currentIndex = JSON.parse(regeneratedContextMainContent);
    } else {
      // Read existing current state from disk
      try {
        const currentContextMainContent = await readFile(currentContextMainPath, 'utf-8');
        try {
          currentIndex = JSON.parse(currentContextMainContent);
        } catch (parseError) {
          // Invalid JSON - return error
          throw new Error(`Invalid JSON in ${currentContextMainPath}: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
        }
      } catch (error) {
        // Check if it's a file not found error
        const nodeError = error as NodeJS.ErrnoException;
        if (nodeError && nodeError.code === 'ENOENT') {
          // context_main.json is missing - this usually means the context hasn't been generated yet
          // Fail loudly with a clear error message rather than assuming "all folders removed"
          throw new Error(
            `context_main.json not found in ${projectPath}. ` +
            `Run 'stamp context' or 'logicstamp_refresh_snapshot' first to generate context files, ` +
            `or use forceRegenerate: true to regenerate automatically.`
          );
        }
        // Other errors should be re-thrown
        throw error;
      }
    }

    // Compare the two states
    const compareResult = await compareIndexes(baselineIndex, currentIndex, baselinePath, projectPath, baseline);

    // Store the comparison result
    stateManager.setLastCompareResult(compareResult);

    return compareResult;
  } catch (error) {
    // If comparison fails, return an error result
    const errorResult: CompareResult = {
      baseline,
      status: 'error',
      summary: {
        totalFolders: 0,
        unchangedFolders: 0,
        changedFolders: 0,
        addedFolders: 0,
        removedFolders: 0,
        tokenDelta: {
          gpt4oMini: 0,
          claude: 0,
        },
      },
      folderDiffs: [],
      error: error instanceof Error ? error.message : String(error),
    };

    stateManager.setLastCompareResult(errorResult);
    return errorResult;
  }
}

/**
 * Compare two LogicStampIndex objects and compute diff
 */
async function compareIndexes(
  baselineIndex: LogicStampIndex,
  currentIndex: LogicStampIndex,
  baselinePath: string,
  currentPath: string,
  baseline: string
): Promise<CompareResult> {
  const baselineFolders = new Map<string, FolderMetadata>();
  const currentFolders = new Map<string, FolderMetadata>();

  // Index folders by path
  for (const folder of baselineIndex.folders) {
    baselineFolders.set(folder.path, folder);
  }
  for (const folder of currentIndex.folders) {
    currentFolders.set(folder.path, folder);
  }

  const folderDiffs: FolderDiff[] = [];
  let unchangedFolders = 0;
  let changedFolders = 0;
  let addedFolders = 0;
  let removedFolders = 0;

  const allFolderPaths = new Set([
    ...baselineFolders.keys(),
    ...currentFolders.keys(),
  ]);

  // Compare each folder
  for (const folderPath of allFolderPaths) {
    const baselineFolder = baselineFolders.get(folderPath);
    const currentFolder = currentFolders.get(folderPath);

    if (!baselineFolder && currentFolder) {
      // Folder was added
      addedFolders++;
      folderDiffs.push({
        path: folderPath,
        status: 'added',
        changes: await getAddedBundles(currentPath, folderPath, currentFolder),
      });
    } else if (baselineFolder && !currentFolder) {
      // Folder was removed
      removedFolders++;
      folderDiffs.push({
        path: folderPath,
        status: 'removed',
        changes: await getRemovedBundles(baselinePath, folderPath, baselineFolder),
      });
    } else if (baselineFolder && currentFolder) {
      // Folder exists in both - compare bundles
      const folderDiff = await compareFolder(
        baselinePath,
        currentPath,
        folderPath,
        baselineFolder,
        currentFolder
      );

      if (folderDiff.changes.length > 0) {
        changedFolders++;
        folderDiffs.push(folderDiff);
      } else {
        unchangedFolders++;
      }
    }
  }

  // Calculate token deltas
  const tokenDelta = calculateTokenDelta(baselineIndex, currentIndex, folderDiffs);

  // Determine overall status
  const status = folderDiffs.length === 0 ? 'pass' : 'diff';

  return {
    baseline,
    status,
    summary: {
      totalFolders: allFolderPaths.size,
      unchangedFolders,
      changedFolders,
      addedFolders,
      removedFolders,
      tokenDelta,
    },
    folderDiffs,
  };
}

/**
 * Compare bundles within a folder
 */
async function compareFolder(
  baselinePath: string,
  currentPath: string,
  folderPath: string,
  baselineFolder: FolderMetadata,
  currentFolder: FolderMetadata
): Promise<FolderDiff> {
  const changes: ComponentChange[] = [];

  // If bundle counts differ, we need to compare individual bundles
  if (baselineFolder.bundles !== currentFolder.bundles) {
    // Load and compare bundles
    const baselineBundles = await loadBundles(baselinePath, folderPath);
    const currentBundles = await loadBundles(currentPath, folderPath);

    const baselineBundleMap = new Map<string, LogicStampBundle>();
    const currentBundleMap = new Map<string, LogicStampBundle>();

    // Index bundles by component name (from entryId)
    for (const bundle of baselineBundles) {
      const componentName = extractComponentName(bundle.graph.nodes[0]?.entryId || bundle.entryId);
      baselineBundleMap.set(componentName, bundle);
    }
    for (const bundle of currentBundles) {
      const componentName = extractComponentName(bundle.graph.nodes[0]?.entryId || bundle.entryId);
      currentBundleMap.set(componentName, bundle);
    }

    // Find added bundles
    for (const [componentName, bundle] of currentBundleMap.entries()) {
      if (!baselineBundleMap.has(componentName)) {
        changes.push({
          rootComponent: componentName,
          type: 'bundle_added',
          tokenDelta: estimateBundleTokens(bundle),
        });
      }
    }

    // Find removed bundles
    for (const [componentName, bundle] of baselineBundleMap.entries()) {
      if (!currentBundleMap.has(componentName)) {
        changes.push({
          rootComponent: componentName,
          type: 'bundle_removed',
          tokenDelta: -estimateBundleTokens(bundle),
        });
      }
    }

    // Compare common bundles
    for (const [componentName, baselineBundle] of baselineBundleMap.entries()) {
      const currentBundle = currentBundleMap.get(componentName);
      if (currentBundle) {
        const bundleChange = compareBundles(baselineBundle, currentBundle, componentName);
        if (bundleChange) {
          changes.push(bundleChange);
        }
      }
    }
  } else {
    // Bundle counts match - compare by hash
    const baselineBundles = await loadBundles(baselinePath, folderPath);
    const currentBundles = await loadBundles(currentPath, folderPath);

    const baselineHashMap = new Map<string, LogicStampBundle>();
    const currentHashMap = new Map<string, LogicStampBundle>();

    for (const bundle of baselineBundles) {
      baselineHashMap.set(bundle.bundleHash, bundle);
    }
    for (const bundle of currentBundles) {
      currentHashMap.set(bundle.bundleHash, bundle);
    }

    // Find bundles with changed hashes
    for (const [hash, baselineBundle] of baselineHashMap.entries()) {
      const currentBundle = currentHashMap.get(hash);
      if (!currentBundle) {
        // Hash changed - need to find matching bundle by component name
        const componentName = extractComponentName(
          baselineBundle.graph.nodes[0]?.entryId || baselineBundle.entryId
        );
        const matchingCurrent = currentBundles.find((b) => {
          const name = extractComponentName(b.graph.nodes[0]?.entryId || b.entryId);
          return name === componentName;
        });

        if (matchingCurrent) {
          const bundleChange = compareBundles(baselineBundle, matchingCurrent, componentName);
          if (bundleChange) {
            changes.push(bundleChange);
          }
        } else {
          // Bundle removed
          changes.push({
            rootComponent: componentName,
            type: 'bundle_removed',
            semanticHashBefore: baselineBundle.graph.nodes[0]?.contract.semanticHash,
            tokenDelta: -estimateBundleTokens(baselineBundle),
          });
        }
      }
    }

    // Find new bundles (new hashes)
    for (const [hash, currentBundle] of currentHashMap.entries()) {
      if (!baselineHashMap.has(hash)) {
        const componentName = extractComponentName(
          currentBundle.graph.nodes[0]?.entryId || currentBundle.entryId
        );
        const matchingBaseline = baselineBundles.find((b) => {
          const name = extractComponentName(b.graph.nodes[0]?.entryId || b.entryId);
          return name === componentName;
        });

        if (!matchingBaseline) {
          // New bundle
          changes.push({
            rootComponent: componentName,
            type: 'bundle_added',
            tokenDelta: estimateBundleTokens(currentBundle),
          });
        }
      }
    }
  }

  return {
    path: folderPath,
    status: changes.length > 0 ? 'changed' : 'unchanged',
    changes,
  };
}

/**
 * Compare two bundles and return change if different
 */
function compareBundles(
  baselineBundle: LogicStampBundle,
  currentBundle: LogicStampBundle,
  componentName: string
): ComponentChange | null {
  const baselineContract = baselineBundle.graph.nodes[0]?.contract;
  const currentContract = currentBundle.graph.nodes[0]?.contract;

  if (!baselineContract || !currentContract) {
    return null;
  }

  // Compare semantic hash first (most reliable)
  if (baselineContract.semanticHash !== currentContract.semanticHash) {
    return compareContracts(baselineContract, currentContract, componentName);
  }

  // Compare bundle hash
  if (baselineBundle.bundleHash !== currentBundle.bundleHash) {
    return {
      rootComponent: componentName,
      type: 'hash_changed',
      semanticHashBefore: baselineContract.semanticHash,
      semanticHashAfter: currentContract.semanticHash,
      tokenDelta: estimateBundleTokens(currentBundle) - estimateBundleTokens(baselineBundle),
    };
  }

  return null;
}

/**
 * Compare two UIF contracts and return detailed change
 */
function compareContracts(
  baselineContract: UIFContract,
  currentContract: UIFContract,
  componentName: string
): ComponentChange {
  const details: ComponentChange['details'] = {};
  const modifiedFields: string[] = [];

  // Compare version fields
  if (JSON.stringify(baselineContract.version) !== JSON.stringify(currentContract.version)) {
    modifiedFields.push('version');

    const addedProps: string[] = [];
    const removedProps: string[] = [];
    const addedFunctions: string[] = [];
    const removedFunctions: string[] = [];
    const addedImports: string[] = [];
    const removedImports: string[] = [];
    const modifiedExports: string[] = [];

    // Compare functions
    const baselineFuncs = new Set(baselineContract.version.functions || []);
    const currentFuncs = new Set(currentContract.version.functions || []);
    for (const func of currentFuncs) {
      if (!baselineFuncs.has(func)) addedFunctions.push(func);
    }
    for (const func of baselineFuncs) {
      if (!currentFuncs.has(func)) removedFunctions.push(func);
    }

    // Compare imports
    const baselineImports = new Set(baselineContract.version.imports || []);
    const currentImports = new Set(currentContract.version.imports || []);
    for (const imp of currentImports) {
      if (!baselineImports.has(imp)) addedImports.push(imp);
    }
    for (const imp of baselineImports) {
      if (!currentImports.has(imp)) removedImports.push(imp);
    }

    if (addedFunctions.length > 0) details.addedFunctions = addedFunctions;
    if (removedFunctions.length > 0) details.removedFunctions = removedFunctions;
    if (addedImports.length > 0) details.addedImports = addedImports;
    if (removedImports.length > 0) details.removedImports = removedImports;
  }

  // Compare exports (separate from version)
  if (
    JSON.stringify(baselineContract.exports) !== JSON.stringify(currentContract.exports)
  ) {
    modifiedFields.push('exports');
    const modifiedExports: string[] = [];
    const baselineExports = new Set([
      ...(baselineContract.exports?.named || []),
      ...(baselineContract.exports?.default ? [baselineContract.exports.default] : []),
    ]);
    const currentExports = new Set([
      ...(currentContract.exports?.named || []),
      ...(currentContract.exports?.default ? [currentContract.exports.default] : []),
    ]);
    for (const exp of currentExports) {
      if (!baselineExports.has(exp)) modifiedExports.push(exp);
    }
    if (modifiedExports.length > 0) details.modifiedExports = modifiedExports;
  }

  // Compare logicSignature.props
  if (
    JSON.stringify(baselineContract.logicSignature.props) !==
    JSON.stringify(currentContract.logicSignature.props)
  ) {
    modifiedFields.push('logicSignature.props');

    const addedProps: string[] = [];
    const removedProps: string[] = [];

    const baselineProps = new Set(Object.keys(baselineContract.logicSignature.props || {}));
    const currentProps = new Set(Object.keys(currentContract.logicSignature.props || {}));

    for (const prop of currentProps) {
      if (!baselineProps.has(prop)) addedProps.push(prop);
    }
    for (const prop of baselineProps) {
      if (!currentProps.has(prop)) removedProps.push(prop);
    }

    if (addedProps.length > 0) details.addedProps = addedProps;
    if (removedProps.length > 0) details.removedProps = removedProps;
  }

  if (modifiedFields.length > 0) {
    details.modifiedFields = modifiedFields;
  }

  return {
    rootComponent: componentName,
    type: 'uif_contract_changed',
    semanticHashBefore: baselineContract.semanticHash,
    semanticHashAfter: currentContract.semanticHash,
    details: Object.keys(details).length > 0 ? details : undefined,
  };
}

/**
 * Load bundles from a folder's context.json
 */
async function loadBundles(basePath: string, folderPath: string): Promise<LogicStampBundle[]> {
  try {
    const contextPath = join(basePath, folderPath, 'context.json');
    const contextContent = await readFile(contextPath, 'utf-8');
    return JSON.parse(contextContent);
  } catch (error) {
    // Folder might not have context.json
    return [];
  }
}

/**
 * Get changes for added bundles in a new folder
 */
async function getAddedBundles(
  currentPath: string,
  folderPath: string,
  folder: FolderMetadata
): Promise<ComponentChange[]> {
  const bundles = await loadBundles(currentPath, folderPath);
  return bundles.map((bundle) => {
    const componentName = extractComponentName(bundle.graph.nodes[0]?.entryId || bundle.entryId);
    return {
      rootComponent: componentName,
      type: 'bundle_added' as const,
      tokenDelta: estimateBundleTokens(bundle),
    };
  });
}

/**
 * Get changes for removed bundles in a deleted folder
 */
async function getRemovedBundles(
  baselinePath: string,
  folderPath: string,
  folder: FolderMetadata
): Promise<ComponentChange[]> {
  const bundles = await loadBundles(baselinePath, folderPath);
  return bundles.map((bundle) => {
    const componentName = extractComponentName(bundle.graph.nodes[0]?.entryId || bundle.entryId);
    return {
      rootComponent: componentName,
      type: 'bundle_removed' as const,
      semanticHashBefore: bundle.graph.nodes[0]?.contract.semanticHash,
      tokenDelta: -estimateBundleTokens(bundle),
    };
  });
}

/**
 * Calculate token deltas from folder diffs
 */
function calculateTokenDelta(
  baselineIndex: LogicStampIndex,
  currentIndex: LogicStampIndex,
  folderDiffs: FolderDiff[]
): { gpt4oMini: number; claude: number } {
  let gpt4oMiniDelta = 0;
  let claudeDelta = 0;

  // Calculate from index summaries if available
  const baselineTokens = baselineIndex.summary.tokenEstimates;
  const currentTokens = currentIndex.summary.tokenEstimates;

  if (baselineTokens && currentTokens) {
    gpt4oMiniDelta = currentTokens.gpt4oMini - baselineTokens.gpt4oMini;
    claudeDelta = currentTokens.claude - baselineTokens.claude;
  } else {
    // Fallback: estimate from component changes
    for (const folderDiff of folderDiffs) {
      for (const change of folderDiff.changes) {
        if (change.tokenDelta) {
          // Rough estimate: assume proportional split
          gpt4oMiniDelta += Math.round(change.tokenDelta * 0.6);
          claudeDelta += Math.round(change.tokenDelta * 0.5);
        }
      }
    }
  }

  return {
    gpt4oMini: gpt4oMiniDelta,
    claude: claudeDelta,
  };
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
