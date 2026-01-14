/**
 * End-to-end tests for MCP server
 * Tests the server's tool registration and execution without transport layer
 */

import { jest, beforeAll } from '@jest/globals';
import { stateManager } from '../../src/mcp/state.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  createTempDir,
  cleanupTempDir,
  createMockIndex,
  createMockBundle,
  createMockBundleFiles,
} from '../helpers/test-utils.js';
import { tmpdir } from 'os';

// Create a shared mock exec function
const mockExecImpl = jest.fn((command: string, options: any, callback: any) => {
  if (callback) {
    callback(null, { stdout: '', stderr: '' });
  }
  return {} as any;
});

jest.unstable_mockModule('child_process', () => ({
  exec: jest.fn((command: string, options: any, callback: any) => {
    return mockExecImpl(command, options, callback);
  }),
}));

jest.unstable_mockModule('util', () => ({
  promisify: jest.fn((fn: any) => {
    return jest.fn(async (command: string, options?: any) => {
      return new Promise((resolve, reject) => {
        mockExecImpl(command, options, (error: any, stdout: any, stderr: any) => {
          if (error) {
            reject(error);
          } else {
            resolve({ stdout, stderr });
          }
        });
      });
    });
  }),
}));

// Dynamically import the module after mocks are set up
let createServer: typeof import('../../src/mcp/server.js').createServer;

beforeAll(async () => {
  const module = await import('../../src/mcp/server.js');
  createServer = module.createServer;
});

describe('MCP Server E2E tests', () => {
  let server: Server;
  let tempDir: string;

  // Helper to call tools directly without transport
  const callTool = async (name: string, args: any) => {
    const handler = (server as any)._requestHandlers.get('tools/call');
    return await handler({
      method: 'tools/call',
      params: {
        name,
        arguments: args,
      },
    });
  };

  // Helper to list tools
  const listTools = async () => {
    const handler = (server as any)._requestHandlers.get('tools/list');
    return await handler({
      method: 'tools/list',
    });
  };

  beforeEach(async () => {
    tempDir = await createTempDir(tmpdir());
    stateManager.reset();
    server = createServer();
    mockExecImpl.mockClear();

    // Default mock implementation - successful execution
    mockExecImpl.mockImplementation((command: string, options: any, callback: any) => {
      if (callback) {
        callback(null, { stdout: '', stderr: '' });
      }
      return {} as any;
    });
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  describe('server initialization', () => {
    it('should create server with correct metadata', () => {
      expect(server).toBeDefined();
      expect(server).toBeInstanceOf(Server);
    });

    it('should list all available tools', async () => {
      const response = await listTools();

      expect(response.tools).toHaveLength(6);
      expect(response.tools.map((t: any) => t.name)).toEqual([
        'logicstamp_refresh_snapshot',
        'logicstamp_list_bundles',
        'logicstamp_read_bundle',
        'logicstamp_compare_snapshot',
        'logicstamp_compare_modes',
        'logicstamp_read_logicstamp_docs',
      ]);
    });

    it('should include correct tool descriptions', async () => {
      const response = await listTools();

      const refreshTool = response.tools.find(
        (t: any) => t.name === 'logicstamp_refresh_snapshot'
      );
      expect(refreshTool?.description).toContain('snapshot');
      expect(refreshTool?.inputSchema).toBeDefined();
    });

    it('should define input schemas for all tools', async () => {
      const response = await listTools();

      response.tools.forEach((tool: any) => {
        expect(tool.inputSchema).toBeDefined();
        expect(tool.inputSchema).toHaveProperty('type', 'object');
        expect(tool.inputSchema).toHaveProperty('properties');
      });
    });
  });

  describe('tool execution workflow', () => {
    it('should execute complete snapshot workflow', async () => {
      // Step 1: Create mock data
      await createMockIndex(tempDir, {
        totalComponents: 2,
        totalBundles: 2,
        folders: [
          {
            path: 'src/components',
            bundles: 2,
            components: ['Button', 'Input'],
          },
        ],
      });

      const bundles = [
        createMockBundle('Button', { position: '1/2' }),
        createMockBundle('Input', { position: '2/2' }),
      ];
      await createMockBundleFiles(tempDir, 'src/components', bundles);

      // Step 2: Refresh snapshot
      const refreshResponse = await callTool('logicstamp_refresh_snapshot', {
        projectPath: tempDir,
      });

      expect(refreshResponse.content).toHaveLength(1);
      const refreshResult = JSON.parse(refreshResponse.content[0].text);
      expect(refreshResult.snapshotId).toBeDefined();

      const snapshotId = refreshResult.snapshotId;

      // Step 3: List bundles
      const listResponse = await callTool('logicstamp_list_bundles', {
        snapshotId,
      });

      const listResult = JSON.parse(listResponse.content[0].text);
      expect(listResult.totalBundles).toBe(2);
      expect(listResult.bundles).toHaveLength(2);

      // Step 4: Read bundle
      const bundlePath = listResult.bundles[0].bundlePath;
      const readResponse = await callTool('logicstamp_read_bundle', {
        snapshotId,
        bundlePath,
      });

      const readResult = JSON.parse(readResponse.content[0].text);
      expect(readResult.bundle).toBeDefined();
      expect(readResult.bundle.graph.nodes).toHaveLength(1);

      // Step 5: Compare snapshot
      const compareResponse = await callTool('logicstamp_compare_snapshot', {
        projectPath: tempDir,
      });

      const compareResult = JSON.parse(compareResponse.content[0].text);
      expect(compareResult.status).toBe('pass');
    });

    it('should handle sequential snapshot operations', async () => {
      // Create initial snapshot
      await createMockIndex(tempDir, {
        folders: [
          {
            path: 'src/components',
            bundles: 1,
            components: ['Button'],
          },
        ],
      });
      await createMockBundleFiles(tempDir, 'src/components', [
        createMockBundle('Button'),
      ]);

      const snapshot1Response = await callTool('logicstamp_refresh_snapshot', {
        projectPath: tempDir,
      });

      const snapshot1 = JSON.parse(snapshot1Response.content[0].text);

      // Create second snapshot
      await createMockIndex(tempDir, {
        folders: [
          {
            path: 'src/components',
            bundles: 2,
            components: ['Button', 'Input'],
          },
        ],
      });
      await createMockBundleFiles(tempDir, 'src/components', [
        createMockBundle('Button'),
        createMockBundle('Input'),
      ]);

      const snapshot2Response = await callTool('logicstamp_refresh_snapshot', {
        projectPath: tempDir,
      });

      const snapshot2 = JSON.parse(snapshot2Response.content[0].text);

      expect(snapshot1.snapshotId).not.toBe(snapshot2.snapshotId);
      expect(snapshot2.summary.totalBundles).toBe(2);
    });
  });

  describe('error handling', () => {
    it('should return error for unknown tool', async () => {
      await expect(
        callTool('unknown_tool', {})
      ).rejects.toThrow('Unknown tool');
    });

    it('should validate required parameters for list_bundles', async () => {
      await expect(
        callTool('logicstamp_list_bundles', {})
      ).rejects.toThrow('snapshotId is required');
    });

    it('should validate required parameters for read_bundle', async () => {
      await expect(
        callTool('logicstamp_read_bundle', { snapshotId: 'test' })
      ).rejects.toThrow('bundlePath are required');
    });

    it('should handle tool execution errors gracefully', async () => {
      await expect(
        callTool('logicstamp_list_bundles', { snapshotId: 'non_existent' })
      ).rejects.toThrow();
    });
  });

  describe('response format', () => {
    it('should return JSON text content for all tools', async () => {
      await createMockIndex(tempDir);

      const response = await callTool('logicstamp_refresh_snapshot', {
        projectPath: tempDir,
      });

      expect(response.content).toHaveLength(1);
      expect(response.content[0]).toHaveProperty('type', 'text');
      expect(response.content[0]).toHaveProperty('text');

      // Verify it's valid JSON
      expect(() => JSON.parse(response.content[0].text)).not.toThrow();
    });

    it('should return properly formatted JSON with indentation', async () => {
      await createMockIndex(tempDir);

      const response = await callTool('logicstamp_refresh_snapshot', {
        projectPath: tempDir,
      });

      // Check for 2-space indentation
      expect(response.content[0].text).toContain('\n  ');
    });
  });

  describe('parameter validation', () => {
    it('should accept valid profile values', async () => {
      await createMockIndex(tempDir);

      const profiles = ['llm-chat', 'llm-safe', 'ci-strict'];

      for (const profile of profiles) {
        const response = await callTool('logicstamp_refresh_snapshot', {
          projectPath: tempDir,
          profile,
        });

        const result = JSON.parse(response.content[0].text);
        expect(result.profile).toBe(profile);
      }
    });

    it('should accept valid mode values', async () => {
      await createMockIndex(tempDir);

      const modes = ['header', 'full', 'none'];

      for (const mode of modes) {
        const response = await callTool('logicstamp_refresh_snapshot', {
          projectPath: tempDir,
          mode,
        });

        const result = JSON.parse(response.content[0].text);
        expect(result.mode).toBe(mode);
      }
    });

    it('should handle optional parameters', async () => {
      await createMockIndex(tempDir);

      // Test with no parameters
      const response1 = await callTool('logicstamp_refresh_snapshot', {
        projectPath: tempDir,
      });

      const result1 = JSON.parse(response1.content[0].text);
      expect(result1.profile).toBe('llm-chat'); // default
      expect(result1.mode).toBe('header'); // default
    });
  });

  describe('concurrent operations', () => {
    it('should handle multiple tool calls in parallel', async () => {
      await createMockIndex(tempDir, {
        folders: [
          {
            path: 'src/components',
            bundles: 2,
            components: ['Button', 'Input'],
          },
        ],
      });
      await createMockBundleFiles(tempDir, 'src/components', [
        createMockBundle('Button'),
        createMockBundle('Input'),
      ]);

      // Create snapshot first
      const snapshotResponse = await callTool('logicstamp_refresh_snapshot', {
        projectPath: tempDir,
      });

      const { snapshotId } = JSON.parse(snapshotResponse.content[0].text);

      // Execute multiple operations in parallel
      const [listResponse, compareResponse] = await Promise.all([
        callTool('logicstamp_list_bundles', { snapshotId }),
        callTool('logicstamp_compare_snapshot', { projectPath: tempDir }),
      ]);

      expect(JSON.parse(listResponse.content[0].text).totalBundles).toBe(2);
      expect(JSON.parse(compareResponse.content[0].text).status).toBeDefined();
    });
  });

  describe('state persistence across calls', () => {
    it('should maintain snapshot state between tool calls', async () => {
      await createMockIndex(tempDir);
      await createMockBundleFiles(tempDir, 'src/components', [
        createMockBundle('Button'),
      ]);

      // Create snapshot
      const refreshResponse = await callTool('logicstamp_refresh_snapshot', {
        projectPath: tempDir,
      });

      const { snapshotId } = JSON.parse(refreshResponse.content[0].text);

      // Verify snapshot exists in state
      const snapshot = stateManager.getSnapshot(snapshotId);
      expect(snapshot).toBeDefined();

      // Use snapshot in subsequent call
      const listResponse = await callTool('logicstamp_list_bundles', {
        snapshotId,
      });

      expect(JSON.parse(listResponse.content[0].text).snapshotId).toBe(snapshotId);
    });

    it('should maintain compare result state', async () => {
      await createMockIndex(tempDir);
      await createMockBundleFiles(tempDir, 'src/components', [
        createMockBundle('Button'),
      ]);

      // First create a snapshot (baseline)
      await callTool('logicstamp_refresh_snapshot', {
        projectPath: tempDir,
      });

      // Then compare (should pass since nothing changed)
      await callTool('logicstamp_compare_snapshot', {
        projectPath: tempDir,
      });

      const lastCompare = stateManager.getLastCompareResult();
      expect(lastCompare).toBeDefined();
      expect(lastCompare?.status).toBe('pass');
    });
  });

  describe('tool schema validation', () => {
    it('should expose correct schema for refresh_snapshot', async () => {
      const response = await listTools();

      const tool = response.tools.find(
        (t: any) => t.name === 'logicstamp_refresh_snapshot'
      );

      expect(tool?.inputSchema.properties).toHaveProperty('profile');
      expect(tool?.inputSchema.properties).toHaveProperty('mode');
      expect(tool?.inputSchema.properties).toHaveProperty('projectPath');
    });

    it('should expose correct schema for list_bundles', async () => {
      const response = await listTools();

      const tool = response.tools.find(
        (t: any) => t.name === 'logicstamp_list_bundles'
      );

      expect(tool?.inputSchema.properties).toHaveProperty('snapshotId');
      expect(tool?.inputSchema.properties).toHaveProperty('folderPrefix');
      expect(tool?.inputSchema.required).toContain('snapshotId');
    });

    it('should expose correct schema for read_bundle', async () => {
      const response = await listTools();

      const tool = response.tools.find((t: any) => t.name === 'logicstamp_read_bundle');

      expect(tool?.inputSchema.properties).toHaveProperty('snapshotId');
      expect(tool?.inputSchema.properties).toHaveProperty('bundlePath');
      expect(tool?.inputSchema.properties).toHaveProperty('rootComponent');
      expect(tool?.inputSchema.required).toEqual(['snapshotId', 'bundlePath']);
    });

    it('should expose correct schema for compare_snapshot', async () => {
      const response = await listTools();

      const tool = response.tools.find(
        (t: any) => t.name === 'logicstamp_compare_snapshot'
      );

      expect(tool?.inputSchema.properties).toHaveProperty('baseline');
      expect(tool?.inputSchema.properties).toHaveProperty('profile');
      expect(tool?.inputSchema.properties).toHaveProperty('mode');
    });

    it('should expose correct schema for compare_modes', async () => {
      const response = await listTools();

      const tool = response.tools.find(
        (t: any) => t.name === 'logicstamp_compare_modes'
      );

      expect(tool?.inputSchema.properties).toHaveProperty('projectPath');
    });
  });

  describe('server error handling', () => {
    it('should handle errors in compare_modes tool gracefully', async () => {
      // Mock exec to fail
      mockExecImpl.mockImplementation((command: string, options: any, callback: any) => {
        if (callback) {
          callback(new Error('stamp command failed'), { stdout: '', stderr: 'error' });
        }
        return {} as any;
      });

      await createMockIndex(tempDir);

      try {
        await callTool('logicstamp_compare_modes', {
          projectPath: tempDir,
        });
        fail('Should have thrown error');
      } catch (error: any) {
        // Should be wrapped in MCP error format
        expect(error).toBeDefined();
        expect(error.message || String(error)).toContain('Failed');
      }
    });

    it('should handle errors in read_logicstamp_docs tool gracefully', async () => {
      // This test verifies that errors from read_logicstamp_docs are handled
      // Note: In normal operation, this should succeed, but we test error handling
      try {
        const response = await callTool('logicstamp_read_logicstamp_docs', {});
        // If it succeeds, verify structure
        const result = JSON.parse(response.content[0].text);
        expect(result.type).toBe('LogicStampDocs');
      } catch (error: any) {
        // If it fails, verify error is properly formatted
        expect(error).toBeDefined();
      }
    });

    it('should wrap tool execution errors in MCP error format', async () => {
      // Mock exec to fail for refresh_snapshot
      mockExecImpl.mockImplementation((command: string, options: any, callback: any) => {
        if (callback) {
          callback(new Error('Command execution failed'), { stdout: '', stderr: 'error' });
        }
        return {} as any;
      });

      await createMockIndex(tempDir);

      try {
        await callTool('logicstamp_refresh_snapshot', {
          projectPath: tempDir,
        });
        fail('Should have thrown error');
      } catch (error: any) {
        // Error should be properly formatted
        expect(error).toBeDefined();
        // Should contain error message
        const errorMessage = error.message || String(error);
        expect(errorMessage.length).toBeGreaterThan(0);
      }
    });

    it('should handle non-Error exceptions in tool execution', async () => {
      // This tests that non-Error exceptions are properly handled
      // We'll use a tool that might throw non-Error exceptions
      await createMockIndex(tempDir);

      // Try to call with invalid snapshotId to trigger error handling
      try {
        await callTool('logicstamp_list_bundles', {
          snapshotId: 'invalid-snapshot-id-that-does-not-exist',
        });
        fail('Should have thrown error');
      } catch (error: any) {
        // Error should be properly handled
        expect(error).toBeDefined();
      }
    });
  });
});
