/**
 * LogicStamp Context MCP Server
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

/**
 * Create and configure the MCP server
 */
export function createServer(): Server {
  const server = new Server(
    {
      name: 'logicstamp-context-mcp',
      version: '0.1.0',
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
            'STEP 1: Run LogicStamp Context analysis on a project and create a snapshot. This generates context bundles for all components but only returns a high-level summary (component counts, token estimates, folder structure). IMPORTANT: The summary does NOT contain component details, props, dependencies, or style metadata - you must use logicstamp_list_bundles and logicstamp_read_bundle to access that data. Set includeStyle to true when you need visual/design information: Tailwind CSS classes, SCSS modules, framer-motion animations, color palettes, spacing patterns, layout types (flex/grid), responsive breakpoints. Use includeStyle: true for design system analysis, visual consistency checks, or when the user asks about styling, colors, spacing, animations, or visual design. After calling this, you MUST call logicstamp_list_bundles to see available bundles, then logicstamp_read_bundle to get actual component contracts, dependencies, and style metadata.',
          inputSchema: {
            type: 'object',
            properties: {
              profile: {
                type: 'string',
                enum: ['llm-chat', 'llm-safe', 'ci-strict'],
                description: 'Analysis profile (default: llm-chat)',
                default: 'llm-chat',
              },
              mode: {
                type: 'string',
                enum: ['header', 'full', 'none'],
                description: 'Code inclusion mode: none=contracts only, header=with JSDoc, full=complete source (default: header)',
                default: 'header',
              },
              includeStyle: {
                type: 'boolean',
                description: 'Include style metadata in context bundles (Tailwind classes, SCSS modules, framer-motion, color palettes, layout patterns). Style data appears in the "style" field of component contracts when you read bundles with logicstamp_read_bundle. The summary from refresh_snapshot does NOT show style info - you must read bundles to see it. Equivalent to stamp context style command (default: false)',
                default: false,
              },
              projectPath: {
                type: 'string',
                description: 'Absolute path to project (default: current directory)',
              },
            },
          },
        },
        {
          name: 'logicstamp_list_bundles',
          description:
            'STEP 2: List all available component bundles in a snapshot. Call this AFTER logicstamp_refresh_snapshot to see what components are available. Returns bundle descriptors with component names, file paths, bundle paths (use these in logicstamp_read_bundle), and token estimates. Use folderPrefix to filter by directory. You MUST call this before reading bundles - it tells you which bundlePath values to use in logicstamp_read_bundle.',
          inputSchema: {
            type: 'object',
            properties: {
              snapshotId: {
                type: 'string',
                description: 'Snapshot ID from refresh_snapshot',
              },
              folderPrefix: {
                type: 'string',
                description: 'Filter bundles by folder path (optional)',
              },
            },
            required: ['snapshotId'],
          },
        },
        {
          name: 'logicstamp_read_bundle',
          description:
            'STEP 3: Read the full component bundle - THIS IS WHERE THE ACTUAL USEFUL DATA IS. Call this AFTER logicstamp_list_bundles to get detailed component information. Returns complete UIFContract with: props (types, optional flags, descriptions), state variables, hooks used, dependency graph (what components/functions this imports), exports, and optionally source code (based on mode). If includeStyle was true in refresh_snapshot, the contract will also contain a "style" field with: styleSources (Tailwind classes categorized, SCSS modules, framer-motion usage), layout metadata (flex/grid patterns, responsive breakpoints), visual metadata (color palette, spacing patterns, typography), and animation metadata. This is the ONLY way to see component contracts, dependencies, and style information - the refresh_snapshot summary does NOT include this data. Use bundlePath from list_bundles output, optionally filter by rootComponent name.',
          inputSchema: {
            type: 'object',
            properties: {
              snapshotId: {
                type: 'string',
                description: 'Snapshot ID from refresh_snapshot',
              },
              bundlePath: {
                type: 'string',
                description: 'Relative path to context.json file. Get this value from the "bundlePath" field in logicstamp_list_bundles output. Example: "src/components/HeroVisualization/context.json"',
              },
              rootComponent: {
                type: 'string',
                description: 'Specific component name to filter within the bundle file (optional). Use the "rootComponent" value from list_bundles if you want a specific component. If omitted, returns the first bundle in the file.',
              },
            },
            required: ['snapshotId', 'bundlePath'],
          },
        },
        {
          name: 'logicstamp_compare_snapshot',
          description:
            'Compare current project state against baseline to detect changes. Use this after editing files to verify what changed. Returns structured diff showing modified components, changed contracts (props added/removed, functions changed), and token deltas. ' +
            'By default (forceRegenerate: false), reads existing context_main.json from disk (fast, assumes context is fresh). ' +
            'Set forceRegenerate: true to regenerate context before comparing. Set includeStyle: true (with forceRegenerate: true) to include style metadata (Tailwind classes, SCSS, layout patterns, colors, spacing, animations). ' +
            'If context_main.json is missing and forceRegenerate is false, this will fail with a clear error - run logicstamp_refresh_snapshot first, or use forceRegenerate: true to regenerate automatically.',
          inputSchema: {
            type: 'object',
            properties: {
              profile: {
                type: 'string',
                enum: ['llm-chat', 'llm-safe', 'ci-strict'],
                description: 'Analysis profile (default: llm-chat)',
                default: 'llm-chat',
              },
              mode: {
                type: 'string',
                enum: ['header', 'full', 'none'],
                description: 'Code inclusion mode (default: header)',
                default: 'header',
              },
              includeStyle: {
                type: 'boolean',
                description: 'Include style metadata in comparison (Tailwind classes, SCSS, layout patterns, etc.). Only takes effect when forceRegenerate is true. If forceRegenerate is false, compares whatever is on disk (may not have style metadata).',
                default: false,
              },
              forceRegenerate: {
                type: 'boolean',
                description: 'Force regeneration of context before comparing. When true, runs stamp context (with --include-style if includeStyle is true). When false, reads existing context_main.json from disk (fast, assumes context is fresh).',
                default: false,
              },
              projectPath: {
                type: 'string',
                description: 'Absolute path to project (default: current directory)',
              },
              baseline: {
                type: 'string',
                description: 'Comparison baseline: disk, snapshot, or git:<ref> (default: disk)',
                default: 'disk',
              },
            },
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
          const result = await refreshSnapshot(args || {});
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
          if (!args || !args.snapshotId) {
            throw new McpError(
              ErrorCode.InvalidParams,
              'snapshotId is required'
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
          if (!args || !args.snapshotId || !args.bundlePath) {
            throw new McpError(
              ErrorCode.InvalidParams,
              'snapshotId and bundlePath are required'
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
