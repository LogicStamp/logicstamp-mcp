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
            'Run LogicStamp Context analysis on a project and create a snapshot. This captures the current state of all React/TypeScript components before making edits. Returns a summary with component counts, token estimates, and folder structure.',
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
            'List all available component bundles in a snapshot. Use this to see what components are available before reading their full details. Returns bundle descriptors with names, paths, and token estimates for selective loading.',
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
            'Read the full component bundle (contract + dependency graph) for a specific component. Returns complete UIFContract with props, state, hooks, dependencies, and optionally source code.',
          inputSchema: {
            type: 'object',
            properties: {
              snapshotId: {
                type: 'string',
                description: 'Snapshot ID from refresh_snapshot',
              },
              bundlePath: {
                type: 'string',
                description: 'Relative path to context.json file (from list_bundles)',
              },
              rootComponent: {
                type: 'string',
                description: 'Specific component name (optional, returns first bundle if omitted)',
              },
            },
            required: ['snapshotId', 'bundlePath'],
          },
        },
        {
          name: 'logicstamp_compare_snapshot',
          description:
            'Compare current project state against baseline to detect changes. Use this after editing files to verify what changed. Returns structured diff showing modified components, changed contracts, and token deltas.',
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

  console.error('LogicStamp Context MCP server running on stdio');
}
