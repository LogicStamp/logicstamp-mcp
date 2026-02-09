/**
 * TypeScript schemas for LogicStamp MCP server
 * Based on docs/mcp_integration.md specification
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
  includeStyle?: boolean; // Whether style metadata was included
  depth?: number; // Dependency traversal depth (default: profile default, typically 2)
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
  includeStyle?: boolean; // Include style metadata (equivalent to stamp context style)
  depth?: number; // Dependency traversal depth (default: profile default, typically 2)
  projectPath: string; // REQUIRED: Absolute path to project root
  cleanCache?: boolean; // Manually force cache cleanup (default: false, auto-detects corruption)
  skipIfWatchActive?: boolean; // Skip regeneration if watch mode is active (default: true). When true and watch mode is running, just reads existing context files.
}

export interface RefreshSnapshotOutput {
  snapshotId: string;
  projectPath: string;
  profile: string;
  mode: string;
  includeStyle?: boolean; // Whether style metadata was included
  depth?: number; // Dependency traversal depth used
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
  watchMode?: {
    active: boolean;
    message: string;
    pid?: number;
    startedAt?: string;
  };
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
  snapshotId?: string; // Optional when watch mode is active
  projectPath?: string; // Required when snapshotId is not provided (for watch mode direct access)
  folderPrefix?: string;
}

export interface ListBundlesOutput {
  snapshotId?: string; // May be undefined when using watch mode direct access
  projectPath: string; // Always present
  totalBundles: number;
  bundles: BundleDescriptor[];
  watchMode?: boolean; // True when accessed via watch mode direct access
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
  snapshotId?: string; // Optional when watch mode is active
  projectPath?: string; // Required when snapshotId is not provided (for watch mode direct access)
  bundlePath: string;
  rootComponent?: string;
}

export interface ReadBundleOutput {
  snapshotId?: string; // May be undefined when using watch mode direct access
  projectPath: string; // Always present
  bundlePath: string;
  rootComponent?: string;
  bundle?: LogicStampBundle; // Present when reading a bundle file
  index?: LogicStampIndex; // Present when reading context_main.json
  watchMode?: boolean; // True when accessed via watch mode direct access
}

// Tool 4: compare_snapshot
export interface CompareSnapshotInput {
  profile?: 'llm-chat' | 'llm-safe' | 'ci-strict';
  mode?: 'header' | 'full' | 'none';
  includeStyle?: boolean; // Include style metadata in comparison. When true, also forces regeneration.
  depth?: number; // Dependency traversal depth (default: profile default, typically 2). Only used when forceRegenerate is true.
  forceRegenerate?: boolean; // Force regeneration of context before comparing (default: false, or true if includeStyle is true)
  projectPath?: string;
  baseline?: 'disk' | 'snapshot' | string;
  cleanCache?: boolean; // Manually force cache cleanup (default: false, auto-detects corruption)
}

export type CompareSnapshotOutput = CompareResult;

// Tool 5: compare_modes
export interface CompareModesInput {
  projectPath?: string;
  cleanCache?: boolean; // Manually force cache cleanup (default: false, auto-detects corruption)
}

export interface CompareModesOutput {
  projectPath: string;
  [key: string]: any; // The JSON file structure may vary, so we allow any additional fields
}

// ============================================================================
// LogicStamp Core Types (from docs/tool_description.md)
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

// ============================================================================
// Watch Mode Types
// ============================================================================

/**
 * Watch mode status file structure (.logicstamp/context_watch-status.json)
 * Created when watch mode starts, deleted when it stops
 */
export interface WatchStatus {
  active: boolean;
  projectRoot: string;
  pid: number;
  startedAt: string; // ISO timestamp
  outputDir: string;
}

/**
 * Watch mode log entry structure (.logicstamp/context_watch-mode-logs.json)
 * Each entry represents one regeneration event
 */
export interface WatchLogEntry {
  timestamp: string; // ISO timestamp
  changedFiles: string[];
  fileCount: number;
  durationMs: number;
  modifiedContracts?: Array<{
    entryId: string;
    changes?: string[];
  }>;
  modifiedBundles?: Array<{
    entryId: string;
    changes?: string[];
  }>;
  summary: {
    modifiedContractsCount: number;
    modifiedBundlesCount: number;
    addedContractsCount: number;
    removedContractsCount: number;
  };
}

// Tool: watch_status
export interface WatchStatusInput {
  projectPath: string; // REQUIRED: Absolute path to project root
  includeRecentLogs?: boolean; // Include recent watch log entries (default: false)
  logLimit?: number; // Max number of recent log entries to return (default: 5)
}

export interface WatchStatusOutput {
  projectPath: string;
  watchModeActive: boolean;
  status?: WatchStatus; // Only present if watch mode is active
  recentLogs?: WatchLogEntry[]; // Only present if includeRecentLogs is true and logs exist
  message: string; // Human-readable status message
}
