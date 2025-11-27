/**
 * TypeScript schemas for LogicStamp MCP server
 * Based on MCP_INTEGRATION.md specification
 */

// ============================================================================
// Snapshot Management
// ============================================================================

export interface Snapshot {
  id: string; // e.g., "snap_1764033034172_0"
  createdAt: string; // ISO timestamp
  projectPath: string; // Absolute path to project
  profile: 'llm-chat' | 'llm-safe' | 'ci-strict';
  mode: 'header' | 'full' | 'none';
  contextDir: string; // Where context_main.json + folders live
}

export interface MCPServerState {
  currentSnapshot?: Snapshot; // Last "before edits" snapshot
  lastCompareResult?: CompareResult; // Last diff result
}

// ============================================================================
// Compare/Diff Results
// ============================================================================

export interface CompareResult {
  baseline: 'disk' | 'snapshot' | string; // e.g., 'git:main'
  status: 'pass' | 'diff' | 'error';
  summary: {
    totalFolders: number;
    unchangedFolders: number;
    changedFolders: number;
    addedFolders: number;
    removedFolders: number;
    tokenDelta: {
      gpt4oMini: number;
      claude: number;
    };
  };
  folderDiffs: FolderDiff[];
  error?: string; // Only present if status === 'error'
}

export interface FolderDiff {
  path: string;
  status: 'added' | 'removed' | 'changed' | 'unchanged';
  changes: ComponentChange[];
}

export interface ComponentChange {
  rootComponent: string;
  type:
    | 'uif_contract_changed'
    | 'props_signature_changed'
    | 'bundle_added'
    | 'bundle_removed'
    | 'hash_changed';
  semanticHashBefore?: string;
  semanticHashAfter?: string;
  tokenDelta?: number;
  details?: {
    modifiedFields?: string[];
    addedProps?: string[];
    removedProps?: string[];
    addedFunctions?: string[];
    removedFunctions?: string[];
    addedImports?: string[];
    removedImports?: string[];
    modifiedExports?: string[];
  };
}

// ============================================================================
// Tool Input/Output Schemas
// ============================================================================

// Tool 1: refresh_snapshot
export interface RefreshSnapshotInput {
  profile?: 'llm-chat' | 'llm-safe' | 'ci-strict';
  mode?: 'header' | 'full' | 'none';
  projectPath?: string;
}

export interface RefreshSnapshotOutput {
  snapshotId: string;
  projectPath: string;
  profile: string;
  mode: string;
  summary: {
    totalComponents: number;
    totalBundles: number;
    totalFolders: number;
    totalTokenEstimate: number;
    tokenEstimates: {
      gpt4oMini: number;
      gpt4oMiniFullCode: number;
      claude: number;
      claudeFullCode: number;
    };
    missingDependencies: string[];
  };
  folders: FolderMetadata[];
}

export interface FolderMetadata {
  path: string;
  bundles: number;
  components: string[];
  tokenEstimate: number;
  isRoot?: boolean;
  rootLabel?: string;
}

// Tool 2: list_bundles
export interface ListBundlesInput {
  snapshotId: string;
  folderPrefix?: string;
}

export interface ListBundlesOutput {
  snapshotId: string;
  totalBundles: number;
  bundles: BundleDescriptor[];
}

export interface BundleDescriptor {
  id: string;
  rootComponent: string;
  filePath: string;
  folder: string;
  bundlePath: string;
  position: string; // e.g., "1/5"
  bundleHash: string;
  approxTokens: number;
}

// Tool 3: read_bundle
export interface ReadBundleInput {
  snapshotId: string;
  bundlePath: string;
  rootComponent?: string;
}

export interface ReadBundleOutput {
  snapshotId: string;
  bundlePath: string;
  rootComponent?: string;
  bundle: LogicStampBundle;
}

// Tool 4: compare_snapshot
export interface CompareSnapshotInput {
  profile?: 'llm-chat' | 'llm-safe' | 'ci-strict';
  mode?: 'header' | 'full' | 'none';
  projectPath?: string;
  baseline?: 'disk' | 'snapshot' | string;
}

export type CompareSnapshotOutput = CompareResult;

// ============================================================================
// LogicStamp Core Types (from TOOL_DESCRIPTION.md)
// ============================================================================

export interface LogicStampIndex {
  $schema?: string;
  type: 'LogicStampIndex';
  schemaVersion: string;
  projectRoot: string;
  projectRootAbs: string;
  summary: {
    totalComponents: number;
    totalBundles: number;
    totalFolders: number;
    totalTokenEstimate: number;
    tokenEstimates?: {
      gpt4oMini: number;
      gpt4oMiniFullCode: number;
      claude: number;
      claudeFullCode: number;
    };
    missingDependencies?: string[];
  };
  folders: FolderMetadata[];
  stats?: {
    tokensGPT4?: number;
    tokensClaude?: number;
  };
}

export interface LogicStampBundle {
  $schema?: string;
  position: string;
  type: 'LogicStampBundle';
  schemaVersion: string;
  entryId: string;
  depth: number;
  createdAt: string;
  bundleHash: string;
  graph: {
    nodes: GraphNode[];
    edges: GraphEdge[];
  };
  meta: {
    missing: string[];
    source: string;
  };
}

export interface GraphNode {
  entryId: string;
  contract: UIFContract;
  codeHeader: string | null;
  fullCode?: string;
}

export interface GraphEdge {
  from: string;
  to: string;
  type: 'dependency' | 'uses' | 'usedBy';
}

export interface UIFContract {
  type: 'UIFContract';
  schemaVersion: string;
  kind: 'react:component' | 'ts:module' | 'node:cli';
  entryId: string;
  entryPathAbs: string;
  entryPathRel: string;
  description: string;
  version: {
    variables?: string[];
    hooks?: string[];
    components?: string[];
    functions?: string[];
    imports?: string[];
  };
  logicSignature: {
    props: Record<string, PropType>;
    emits: Record<string, EventType>;
    state?: Record<string, string>;
  };
  exports?: ExportMetadata;
  prediction?: string[];
  nextjs?: {
    directive?: 'client' | 'server';
    isInAppDir?: boolean;
  };
  semanticHash: string;
  fileHash: string;
}

export interface PropType {
  type: string;
  optional?: boolean;
  description?: string;
}

export interface EventType {
  signature: string;
  description?: string;
}

export interface ExportMetadata {
  default?: string;
  named?: string[];
}
