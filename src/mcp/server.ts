/**
 * LogicStamp MCP Server
 * Provides AI assistants with access to codebase analysis via Model Context Protocol
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';

import { refreshSnapshot } from './tools/refresh-snapshot.js';
import { listBundles } from './tools/list-bundles.js';
import { readBundle } from './tools/read-bundle.js';
import { compareSnapshot } from './tools/compare-snapshot.js';
import { compareModes } from './tools/compare-modes.js';
import { readLogicStampDocs } from './tools/read-logicstamp-docs.js';
import { watchStatus } from './tools/watch-status.js';
import type { RefreshSnapshotInput, WatchStatusInput } from '../types/schemas.js';

/**
 * Create and configure the MCP server
 */
export function createServer(): Server {
  const server = new Server(
    {
      name: 'logicstamp-mcp',
      version: '0.1.5',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  /**
   * List available tools
   */
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'logicstamp_refresh_snapshot',
          description:
            '⚠️ FIRST: Call logicstamp_watch_status to check if watch mode is active! ' +
            'IF WATCH MODE IS ACTIVE → SKIP THIS TOOL. Go directly to list_bundles → read_bundle. Context is already fresh. ' +
            'ONLY use this tool when: (1) watch mode is INACTIVE, (2) first time analyzing a new repo, (3) after large code changes without watch mode. ' +
            'WHAT IT DOES: Runs `stamp context` to regenerate all AI-ready bundles. This is SLOW compared to reading existing context. ' +
            'DEFAULT BEHAVIOR: skipIfWatchActive=true, so if watch mode is running, this tool automatically skips regeneration and reads existing files. ' +
            'WHAT IT DOES: Runs `stamp context` which analyzes your React/TypeScript codebase and Node.js backend applications (Express.js, NestJS) and generates structured context files optimized for AI consumption: ' +
            '(1) `context_main.json` - Main index with folder metadata, summary statistics, and folder entries. This is your entry point to discover all components. ' +
            '(2) Multiple `context.json` files - One per folder containing component bundles with contracts, dependency graphs, and relationships. ' +
            'These files are STRUCTURED DATA, not raw source - they capture the complete architecture and relationships in your codebase. ' +
            'WHAT YOU GET: Summary statistics (component counts, token estimates, folder structure) and a snapshotId. If watch mode is active, also includes watchMode status. ' +
            'IMPORTANT: This summary does NOT include component details, props, dependencies, or style metadata. ' +
            'WHAT TO DO NEXT: (1) Call logicstamp_list_bundles with the snapshotId to see available bundles, ' +
            '(2) Then call logicstamp_read_bundle to get actual component contracts with full details including dependency graphs. ' +
            'STYLE METADATA: Set includeStyle=true to extract visual/design information (Tailwind CSS classes, SCSS modules, framer-motion animations, color palettes, spacing patterns). ' +
            'Style data appears in the "style" field of UIFContract when reading bundles - the summary does NOT show style info. ' +
            'Use includeStyle=true for design system analysis, visual consistency checks, or when the user asks about styling, colors, spacing, animations, or visual design. ' +
            'DEPTH PARAMETER: Default depth=2 includes nested components (App → Hero → Button). ' +
            'For projects that only need direct dependencies, set depth=1 to include direct dependencies only (App → Hero). ' +
            'Depth 2 ensures nested components are included in dependency graphs with their contracts and styles. ' +
            'PREFER BUNDLES OVER RAW CODE: These bundles are pre-parsed summaries optimized for AI - use them instead of reading raw .ts/.tsx files when possible. ' +
            'If you\'re unsure how LogicStamp works, call logicstamp_read_logicstamp_docs first.',
          inputSchema: {
            type: 'object',
            properties: {
              profile: {
                type: 'string',
                enum: ['llm-chat', 'llm-safe', 'ci-strict'],
                description: 'Analysis profile: llm-chat=balanced (default), llm-safe=conservative (max 30 nodes), ci-strict=contracts only, strict deps',
                default: 'llm-chat',
              },
              mode: {
                type: 'string',
                enum: ['header', 'full', 'none'],
                description: 'Code inclusion mode: none=contracts only (~79% token savings), header=contracts+JSDoc headers (~65% savings, recommended), full=complete source code (no savings)',
                default: 'header',
              },
              includeStyle: {
                type: 'boolean',
                description: 'Extract style metadata (Tailwind, SCSS, Material UI, animations, layout patterns). Equivalent to `stamp context style` or `stamp context --include-style`. Style data appears in component contracts when reading bundles, NOT in the summary.',
                default: false,
              },
              depth: {
                type: 'number',
                description: 'Dependency traversal depth. Default: 2 (includes nested components, e.g., App → Hero → Button). Set to 1 for direct dependencies only (e.g., App → Hero). Depth=2 is recommended for React projects with component hierarchies.',
                default: 2,
              },
              projectPath: {
                type: 'string',
                description: 'CRITICAL: Absolute path to project root. REQUIRED - must always be provided. When stamp init has been run, MCP clients may omit this, causing hangs. This parameter is REQUIRED for the tool to work correctly.',
              },
              cleanCache: {
                type: 'boolean',
                description: 'Manually force cleanup of .logicstamp cache folder. Default: false (auto-detects corruption/mismatch). Set to true to force cache reset. Use only when experiencing cache-related issues.',
                default: false,
              },
              skipIfWatchActive: {
                type: 'boolean',
                description: 'Skip regeneration if watch mode is active (default: true). When true and watch mode is running, skips expensive regeneration and reads existing context files instantly. Set to false only if you need to force regeneration even when watch mode is active.',
                default: true,
              },
            },
            required: ['projectPath'],
          },
        },
        {
          name: 'logicstamp_list_bundles',
          description:
            'List all LogicStamp bundles available for this project. ' +
            'WATCH MODE: If watch mode is active, just provide projectPath - no snapshotId needed! Context files are fresh. ' +
            'WHAT IT DOES: Reads the folder structure from `context_main.json` and returns a catalog of all bundles with their locations. ' +
            'WHAT YOU GET: Bundle descriptors with component names, file paths, bundle paths (use these in logicstamp_read_bundle), token estimates, and positions. ' +
            'TYPICAL FLOW: watch_status → (if active) list_bundles(projectPath) → read_bundle(projectPath) | (if inactive) refresh_snapshot → list_bundles(snapshotId) → read_bundle(snapshotId). ' +
            'FILTERING: Use folderPrefix to filter bundles by directory path (e.g., "src/components" to see only components in that folder).',
          inputSchema: {
            type: 'object',
            properties: {
              snapshotId: {
                type: 'string',
                description: 'Snapshot ID from logicstamp_refresh_snapshot. Optional if watch mode is active - use projectPath instead for direct access.',
              },
              projectPath: {
                type: 'string',
                description: 'Absolute path to project root. Use this instead of snapshotId when watch mode is active for instant access to fresh context.',
              },
              folderPrefix: {
                type: 'string',
                description: 'Filter bundles by folder path prefix (optional, e.g., "src/components" to see only that folder)',
              },
            },
          },
        },
        {
          name: 'logicstamp_read_bundle',
          description:
            'Read a LogicStamp bundle or index file to get component contracts and dependency graphs. ' +
            'WATCH MODE: If watch mode is active, just provide projectPath - no snapshotId needed! Context files are fresh. ' +
            'WHAT IT DOES: Reads either (1) `context_main.json` for project overview, or (2) a folder\'s `context.json` for component contracts. ' +
            'These are pre-parsed summaries optimized for AI - PREFER THIS over reading raw .ts/.tsx files. ' +
            'BUNDLE CONTENTS: entryId, graph.nodes[] (components with UIFContract), graph.edges[] (dependency relationships), meta.missing[] (unresolved deps). ' +
            'UIFContract includes: kind, description, props, emits, state, exports, semanticHash, and optionally style metadata. ' +
            'TYPICAL FLOW: watch_status → (if active) read_bundle(projectPath) | (if inactive) refresh_snapshot → read_bundle(snapshotId). ' +
            'Use bundlePath="context_main.json" for project overview, or specific folder paths from list_bundles for component details.',
          inputSchema: {
            type: 'object',
            properties: {
              snapshotId: {
                type: 'string',
                description: 'Snapshot ID from logicstamp_refresh_snapshot. Optional if watch mode is active - use projectPath instead for direct access.',
              },
              projectPath: {
                type: 'string',
                description: 'Absolute path to project root. Use this instead of snapshotId when watch mode is active for instant access to fresh context.',
              },
              bundlePath: {
                type: 'string',
                description: 'Relative path to context.json file or context_main.json from project root. Use "context_main.json" for project overview, or folder paths like "src/components/context.json" for component bundles.',
              },
              rootComponent: {
                type: 'string',
                description: 'Specific root component name to filter within the bundle file (optional). If omitted, returns the first bundle in the file.',
              },
            },
            required: ['bundlePath'],
          },
        },
        {
          name: 'logicstamp_compare_snapshot',
          description:
            'Compare the current LogicStamp snapshot with a saved one to detect changes. ' +
            'WHAT IT DOES: Compares all context files (multi-file mode) by reading the structured data in `context_main.json` and folder `context.json` files. ' +
            'Detects: ADDED folders/components, REMOVED folders/components, CHANGED components (props added/removed, hooks changed, imports changed, semantic hash changed), UNCHANGED components. ' +
            'Returns structured diff with folder-level and component-level changes, token deltas. ' +
            'VALUE OF COMPARISON: By comparing the structured context files (which contain dependency graphs, contracts, and metadata), this tool can detect meaningful changes in component APIs, dependencies, and relationships - not just file changes, but architectural changes. ' +
            'WHEN TO USE: After editing files to verify what changed. Like Jest snapshots - detects contract drift by comparing the structured context data. ' +
            'This is useful when refactoring or reviewing a PR, instead of diffing raw code. ' +
            'REGENERATION MODE: By default (forceRegenerate: false), reads existing context_main.json from disk (fast, assumes context is fresh). ' +
            'Set forceRegenerate: true to run `stamp context` before comparing (ensures fresh context files with latest structured data). ' +
            'STYLE METADATA: Set includeStyle: true (with forceRegenerate: true) to include style metadata in comparison. ' +
            'If forceRegenerate is false, compares whatever is on disk (may not have style metadata). ' +
            'DEPTH PARAMETER: IMPORTANT - When forceRegenerate: true, you can set depth to control dependency traversal depth. ' +
            'By default, dependency graphs include nested components (depth=2). Set depth=1 for direct dependencies only. ' +
            'BASELINE OPTIONS: Compare against "disk" (current snapshot), "snapshot" (stored snapshot), or "git:<ref>" (future: git baseline). ' +
            'ERROR HANDLING: If context_main.json is missing and forceRegenerate is false, fails with clear error - run logicstamp_refresh_snapshot first, or use forceRegenerate: true to regenerate automatically.',
          inputSchema: {
            type: 'object',
            properties: {
              profile: {
                type: 'string',
                enum: ['llm-chat', 'llm-safe', 'ci-strict'],
                description: 'Analysis profile (only used if forceRegenerate: true). llm-chat=balanced (default), llm-safe=conservative, ci-strict=contracts only',
                default: 'llm-chat',
              },
              mode: {
                type: 'string',
                enum: ['header', 'full', 'none'],
                description: 'Code inclusion mode (only used if forceRegenerate: true). none=contracts only, header=contracts+JSDoc (default), full=complete source',
                default: 'header',
              },
              includeStyle: {
                type: 'boolean',
                description: 'Include style metadata in comparison (only takes effect when forceRegenerate: true). Extracts Tailwind classes, SCSS, layout patterns, colors, spacing, animations. If forceRegenerate is false, compares whatever is on disk (may not have style metadata).',
                default: false,
              },
              depth: {
                type: 'number',
                description: 'Dependency traversal depth. Default: 2 (includes nested components, e.g., App → Hero → Button). Set to 1 for direct dependencies only (e.g., App → Hero). Only used when forceRegenerate: true.',
                default: 2,
              },
              forceRegenerate: {
                type: 'boolean',
                description: 'Force regeneration before comparing. When true, runs `stamp context` (with --include-style if includeStyle is true) to generate fresh context files. When false, reads existing context_main.json from disk (fast, assumes context is fresh).',
                default: false,
              },
              projectPath: {
                type: 'string',
                description: 'Absolute path to project root (default: current working directory)',
              },
              baseline: {
                type: 'string',
                description: 'Comparison baseline: "disk" (current snapshot, default), "snapshot" (stored snapshot), or "git:<ref>" (future: git baseline)',
                default: 'disk',
              },
              cleanCache: {
                type: 'boolean',
                description: 'Manually force cleanup of .logicstamp cache folder. Default: false (auto-detects corruption/mismatch). Set to true to force cache reset. Use only when experiencing cache-related issues.',
                default: false,
              },
            },
          },
        },
        {
          name: 'logicstamp_compare_modes',
          description:
            'Generate detailed token cost comparison across all context generation modes to help choose the optimal mode for AI workflows. ' +
            'WHAT IT DOES: Executes `stamp context --compare-modes --stats` which analyzes the codebase and generates `context_compare_modes.json` with token counts for all modes: ' +
            '(1) none - contracts only (~79% savings vs full), (2) header - contracts+JSDoc (~65% savings, recommended), (3) header+style - header+style metadata (~52% savings), (4) full - complete source code (no savings). ' +
            'Also compares against raw source files to show LogicStamp efficiency (typically 70% savings for header mode). ' +
            'WHAT YOU GET: Token counts for all modes (GPT-4o-mini and Claude), savings percentages vs raw source and vs full context, file statistics, mode breakdown. ' +
            'WHEN TO USE: (1) Before generating context to understand token costs, (2) User asks about token budgets/optimization/cost analysis, (3) Need to decide between modes (none/header/header+style/full), (4) Evaluate token impact of including style metadata, (5) Compare LogicStamp efficiency vs raw source files. ' +
            'PERFORMANCE: Takes 2-3x longer than normal generation (regenerates contracts with/without style for accurate comparison).',
          inputSchema: {
            type: 'object',
            properties: {
              projectPath: {
                type: 'string',
                description: 'Absolute path to project root (default: current working directory)',
              },
              cleanCache: {
                type: 'boolean',
                description: 'Manually force cleanup of .logicstamp cache folder. Default: false (auto-detects corruption/mismatch). Set to true to force cache reset. Use only when experiencing cache-related issues.',
                default: false,
              },
            },
          },
        },
        {
          name: 'logicstamp_read_logicstamp_docs',
          description:
            'Read LogicStamp documentation to understand how the tool works and how to use it effectively. ' +
            'WHAT IT DOES: Returns comprehensive LogicStamp documentation including: the canonical guide for LLMs (logicstamp-for-llms.md), usage guide, UIF contracts documentation, schema reference, CLI command documentation, compare modes guide, and known limitations. ' +
            'WHAT YOU GET: Complete documentation bundle with summary of key concepts, workflow instructions, and best practices. ' +
            'WHEN TO USE: (1) When you\'re unsure how LogicStamp works or how to use these tools, (2) Before starting to work with a new project, (3) When you need to understand the bundle structure or contract format, (4) When you want to understand the recommended workflow. ' +
            'This is your escape hatch: if you\'re confused about LogicStamp, call this tool first. ' +
            'The documentation explains: what LogicStamp is, why bundles are preferred over raw code, the recommended workflow (refresh → list → read), how to understand bundle structure, and best practices.',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'logicstamp_watch_status',
          description:
            '⚠️ CALL THIS FIRST before any other LogicStamp tool! ' +
            'Checks if watch mode (`stamp context --watch`) is active. ' +
            'CRITICAL WORKFLOW: ' +
            '→ IF ACTIVE: SKIP refresh_snapshot entirely! Go directly to list_bundles → read_bundle. Context is already fresh via incremental rebuilds. ' +
            '→ IF INACTIVE: Call refresh_snapshot to generate context files first. ' +
            'This check enables zero-cost instant context access when watch mode is running. ' +
            'WHAT IT DOES: Reads .logicstamp/context_watch-status.json and verifies the watch process is still running. ' +
            'WATCH MODE FEATURES: (1) Incremental rebuilds - only rebuilds affected bundles, not entire project, ' +
            '(2) Change detection - shows what changed (props, hooks, state, components), ' +
            '(3) Debouncing - batches rapid changes (500ms delay), ' +
            '(4) Optional log file - structured change logs for tracking modifications. ' +
            'RECENT LOGS: Set includeRecentLogs=true to see the most recent regeneration events.',
          inputSchema: {
            type: 'object',
            properties: {
              projectPath: {
                type: 'string',
                description: 'CRITICAL: Absolute path to project root. REQUIRED - must always be provided.',
              },
              includeRecentLogs: {
                type: 'boolean',
                description: 'Include recent watch log entries showing what changed (default: false). Only available if watch mode was started with --log-file flag.',
                default: false,
              },
              logLimit: {
                type: 'number',
                description: 'Maximum number of recent log entries to return (default: 5)',
                default: 5,
              },
            },
            required: ['projectPath'],
          },
        },
      ],
    };
  });

  /**
   * Handle tool execution
   */
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      const { name, arguments: args } = request.params;

      switch (name) {
        case 'logicstamp_refresh_snapshot': {
          // Type assertion is safe here because:
          // 1. MCP framework validates JSON schema (which requires projectPath)
          // 2. refreshSnapshot function validates projectPath at runtime and throws clear error if missing
          const result = await refreshSnapshot((args || {}) as unknown as RefreshSnapshotInput);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case 'logicstamp_list_bundles': {
          // Either snapshotId or projectPath is required (projectPath for watch mode direct access)
          if (!args || (!args.snapshotId && !args.projectPath)) {
            throw new McpError(
              ErrorCode.InvalidParams,
              'Either snapshotId or projectPath is required. Use projectPath for direct access when watch mode is active.'
            );
          }
          const result = await listBundles(args as any);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case 'logicstamp_read_bundle': {
          // bundlePath is always required; snapshotId or projectPath required for context location
          if (!args || !args.bundlePath) {
            throw new McpError(
              ErrorCode.InvalidParams,
              'bundlePath is required'
            );
          }
          if (!args.snapshotId && !args.projectPath) {
            throw new McpError(
              ErrorCode.InvalidParams,
              'Either snapshotId or projectPath is required. Use projectPath for direct access when watch mode is active.'
            );
          }
          const result = await readBundle(args as any);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case 'logicstamp_compare_snapshot': {
          const result = await compareSnapshot(args || {});
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case 'logicstamp_compare_modes': {
          const result = await compareModes(args || {});
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case 'logicstamp_read_logicstamp_docs': {
          const result = await readLogicStampDocs();
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case 'logicstamp_watch_status': {
          const result = await watchStatus((args || {}) as unknown as WatchStatusInput);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        default:
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${name}`
          );
      }
    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }

      throw new McpError(
        ErrorCode.InternalError,
        `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });

  return server;
}

/**
 * Start the MCP server
 */
export async function startServer(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);

  console.error('    /\\_/\\   🦊 LogicStamp MCP Server');
  console.error('   ( o.o )  Running on stdio');
  console.error('    > ^ <');
}
