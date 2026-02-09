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
      version: '0.1.6',
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
            '⚠️ FIRST: Call logicstamp_watch_status! If watch mode is ACTIVE → SKIP this tool, go to list_bundles → read_bundle (context is fresh). ' +
            'Use when: watch mode INACTIVE, first-time analysis, or after large changes. Default skipIfWatchActive=true (auto-skips regeneration if watch mode active). ' +
            'WHAT IT DOES: Runs `stamp context` to analyze React/TypeScript/Node.js codebases (Next.js, Express.js, NestJS) and generate structured context files (context_main.json + per-folder context.json bundles). These are STRUCTURED DATA, not raw source. SLOW compared to reading existing context. ' +
            'WHAT YOU GET: Summary statistics (component counts, token estimates, folder structure) and a snapshotId. If watch mode is active, also includes watchMode status. ' +
            'IMPORTANT: This summary does NOT include component details, props, dependencies, or style metadata. ' +
            'WHAT TO DO NEXT: list_bundles(snapshotId|projectPath) → read_bundle(snapshotId|projectPath, bundlePath). Use projectPath when watch mode is active (no snapshotId needed). ' +
            'STYLE METADATA: Set includeStyle=true to extract visual/design info (Tailwind/SCSS/animations/colors/spacing). Appears in bundle "style" field, NOT in summary. Use for design system analysis or when user asks about styling/colors/animations. ' +
            'DEPTH PARAMETER: Default depth=2 includes nested components (App → Hero → Button) with contracts and styles. Set depth=1 for direct dependencies only (App → Hero). ' +
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
            'Lists all bundles from context_main.json. Returns bundle catalog (component names, file paths, bundle paths, token estimates). ' +
            'Use bundle paths in read_bundle to get component contracts. ' +
            'Watch mode: Use projectPath directly (no snapshotId needed). Filter: folderPrefix="src/components" to filter by directory. ' +
            'Next: read_bundle(snapshotId|projectPath, bundlePath).',
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
            'Reads bundle/index file to get component contracts and dependency graphs. Reads context_main.json (project overview) or folder context.json (component contracts). ' +
            'These are pre-parsed summaries optimized for AI - PREFER over raw .ts/.tsx files. ' +
            'Bundle contains: entryId, graph.nodes[] (UIFContract), graph.edges[] (dependencies), meta.missing[] (unresolved). ' +
            'UIFContract: kind, description, props, emits, state, exports, semanticHash, optional style metadata. ' +
            'Watch mode: Use projectPath directly (no snapshotId needed). Use bundlePath="context_main.json" for overview, or folder paths from list_bundles for details.',
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
            'Compares current snapshot with baseline to detect changes. Reads context_main.json and folder context.json files. ' +
            'Detects: ADDED/REMOVED/CHANGED/UNCHANGED folders/components (props, hooks, imports, semantic hash changes). Returns structured diff with token deltas. ' +
            'Use after editing files to verify changes (like Jest snapshots - detects contract drift, not just file changes). ' +
            'Default (forceRegenerate=false): Reads from disk (fast, assumes fresh). Set forceRegenerate=true to regenerate before comparing. ' +
            'Style: Set includeStyle=true (with forceRegenerate=true) to include style metadata. Depth: Set depth when forceRegenerate=true (default=2 nested, 1=direct only). ' +
            'Baseline: "disk" (current snapshot, default), "snapshot" (stored), or "git:<ref>" (future). ' +
            'Error: If context_main.json missing and forceRegenerate=false, fails - run refresh_snapshot first or use forceRegenerate=true.',
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
            'Generates token cost comparison across all modes (none/header/header+style/full) to help choose optimal mode. ' +
            'Executes `stamp context --compare-modes --stats` and returns token counts (GPT-4o-mini/Claude), savings vs raw source (~70% for header) and vs full context, file stats. ' +
            'Modes: none (~79% savings), header (~65%, recommended), header+style (~52%), full (no savings). ' +
            'Use before generating context, when user asks about token budgets, or to evaluate style metadata impact. ' +
            'Performance: Takes 2-3x longer (regenerates with/without style for accuracy).',
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
            'Returns comprehensive LogicStamp documentation (logicstamp-for-llms.md guide, usage, UIF contracts, schema, CLI commands, limitations). ' +
            'Returns complete doc bundle with key concepts, workflow instructions, and best practices. ' +
            'Use when: unsure how LogicStamp works, starting new project, need bundle structure/contract format, or want recommended workflow. ' +
            'Escape hatch: if confused about LogicStamp, call this first. ' +
            'Explains: what LogicStamp is, why bundles over raw code, workflow (refresh → list → read), bundle structure, best practices.',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'logicstamp_watch_status',
          description:
            '⚠️ CALL THIS FIRST before any other LogicStamp tool! Checks if watch mode (`stamp context --watch`) is active. ' +
            'If ACTIVE: SKIP refresh_snapshot, go to list_bundles → read_bundle (context fresh via incremental rebuilds). ' +
            'If INACTIVE: Call refresh_snapshot first. Enables zero-cost instant context access when watch mode running. ' +
            'Reads .logicstamp/context_watch-status.json and verifies process is running. ' +
            'Watch features: Incremental rebuilds (affected bundles only), change detection (props/hooks/state/components), debouncing (500ms), optional log file. ' +
            'Set includeRecentLogs=true to see recent regeneration events.',
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
