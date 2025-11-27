/**
 * Integration tests for list-bundles tool
 */

import { listBundles } from '../../src/mcp/tools/list-bundles.js';
import { stateManager } from '../../src/mcp/state.js';
import {
  createTempDir,
  cleanupTempDir,
  createMockIndex,
  createMockBundle,
  createMockBundleFiles,
  validateBundleDescriptor,
} from '../helpers/test-utils.js';
import { tmpdir } from 'os';
import type { Snapshot } from '../../src/types/schemas.js';

describe('listBundles integration tests', () => {
  let tempDir: string;
  let snapshotId: string;

  beforeEach(async () => {
    tempDir = await createTempDir(tmpdir());
    stateManager.reset();

    // Create a mock snapshot
    snapshotId = stateManager.generateSnapshotId();
    const snapshot: Snapshot = {
      id: snapshotId,
      createdAt: new Date().toISOString(),
      projectPath: tempDir,
      profile: 'llm-chat',
      mode: 'header',
      contextDir: tempDir,
    };
    stateManager.setSnapshot(snapshot);
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  describe('successful bundle listing', () => {
    it('should list all bundles in snapshot', async () => {
      // Create mock index
      await createMockIndex(tempDir, {
        folders: [
          {
            path: 'src/components',
            bundles: 2,
            components: ['Button', 'Input'],
          },
        ],
      });

      // Create mock bundles
      const bundles = [
        createMockBundle('Button', { position: '1/2' }),
        createMockBundle('Input', { position: '2/2' }),
      ];
      await createMockBundleFiles(tempDir, 'src/components', bundles);

      const result = await listBundles({ snapshotId });

      expect(result.snapshotId).toBe(snapshotId);
      expect(result.totalBundles).toBe(2);
      expect(result.bundles).toHaveLength(2);

      // Validate bundle descriptors
      result.bundles.forEach(bundle => {
        expect(validateBundleDescriptor(bundle)).toBe(true);
      });
    });

    it('should include correct bundle metadata', async () => {
      await createMockIndex(tempDir, {
        folders: [
          {
            path: 'src/components',
            bundles: 1,
            components: ['Button'],
          },
        ],
      });

      const mockBundle = createMockBundle('Button', { position: '1/1' });
      await createMockBundleFiles(tempDir, 'src/components', [mockBundle]);

      const result = await listBundles({ snapshotId });

      expect(result.bundles[0]).toMatchObject({
        rootComponent: 'Button',
        folder: 'src/components',
        position: '1/1',
        bundleHash: mockBundle.bundleHash,
      });
      expect(result.bundles[0].approxTokens).toBeGreaterThan(0);
    });

    it('should list bundles from multiple folders', async () => {
      await createMockIndex(tempDir, {
        folders: [
          {
            path: 'src/components',
            bundles: 2,
            components: ['Button', 'Input'],
          },
          {
            path: 'src/utils',
            bundles: 1,
            components: ['formatDate'],
          },
        ],
      });

      // Create bundles for first folder
      const componentBundles = [
        createMockBundle('Button'),
        createMockBundle('Input'),
      ];
      await createMockBundleFiles(tempDir, 'src/components', componentBundles);

      // Create bundles for second folder
      const utilBundles = [createMockBundle('formatDate')];
      await createMockBundleFiles(tempDir, 'src/utils', utilBundles);

      const result = await listBundles({ snapshotId });

      expect(result.totalBundles).toBe(3);
      expect(result.bundles).toHaveLength(3);

      const folders = new Set(result.bundles.map(b => b.folder));
      expect(folders).toContain('src/components');
      expect(folders).toContain('src/utils');
    });

    it('should filter bundles by folder prefix', async () => {
      await createMockIndex(tempDir, {
        folders: [
          {
            path: 'src/components',
            bundles: 2,
            components: ['Button', 'Input'],
          },
          {
            path: 'src/utils',
            bundles: 1,
            components: ['formatDate'],
          },
          {
            path: 'tests',
            bundles: 1,
            components: ['TestHelper'],
          },
        ],
      });

      // Create bundles for all folders
      await createMockBundleFiles(tempDir, 'src/components', [
        createMockBundle('Button'),
        createMockBundle('Input'),
      ]);
      await createMockBundleFiles(tempDir, 'src/utils', [
        createMockBundle('formatDate'),
      ]);
      await createMockBundleFiles(tempDir, 'tests', [
        createMockBundle('TestHelper'),
      ]);

      const result = await listBundles({
        snapshotId,
        folderPrefix: 'src',
      });

      expect(result.totalBundles).toBe(3);
      expect(result.bundles).toHaveLength(3);

      // All bundles should be from 'src' folders
      result.bundles.forEach(bundle => {
        expect(bundle.folder).toMatch(/^src/);
      });
    });

    it('should handle empty folders gracefully', async () => {
      await createMockIndex(tempDir, {
        folders: [
          {
            path: 'src/components',
            bundles: 1,
            components: ['Button'],
          },
          {
            path: 'src/empty',
            bundles: 0,
            components: [],
          },
        ],
      });

      // Only create bundles for non-empty folder
      await createMockBundleFiles(tempDir, 'src/components', [
        createMockBundle('Button'),
      ]);

      const result = await listBundles({ snapshotId });

      expect(result.totalBundles).toBe(1);
      expect(result.bundles[0].folder).toBe('src/components');
    });

    it('should return empty list when no bundles exist', async () => {
      await createMockIndex(tempDir, {
        folders: [],
      });

      const result = await listBundles({ snapshotId });

      expect(result.totalBundles).toBe(0);
      expect(result.bundles).toHaveLength(0);
    });

    it('should calculate approximate token counts', async () => {
      await createMockIndex(tempDir, {
        folders: [
          {
            path: 'src/components',
            bundles: 1,
            components: ['LargeComponent'],
          },
        ],
      });

      const largeBundle = createMockBundle('LargeComponent', {
        includeCode: true,
      });
      await createMockBundleFiles(tempDir, 'src/components', [largeBundle]);

      const result = await listBundles({ snapshotId });

      expect(result.bundles[0].approxTokens).toBeGreaterThan(0);
      // Token estimate should be roughly 1/4 of JSON string length
      const jsonLength = JSON.stringify(largeBundle).length;
      expect(result.bundles[0].approxTokens).toBeCloseTo(jsonLength / 4, -1);
    });
  });

  describe('error handling', () => {
    it('should throw error when snapshot not found', async () => {
      await expect(
        listBundles({ snapshotId: 'non_existent_snapshot' })
      ).rejects.toThrow('Snapshot not found');
    });

    it('should throw error when snapshotId is missing', async () => {
      await expect(
        listBundles({ snapshotId: '' })
      ).rejects.toThrow();
    });

    it('should throw error when context_main.json is missing', async () => {
      // Don't create context_main.json

      await expect(
        listBundles({ snapshotId })
      ).rejects.toThrow('Failed to list bundles');
    });

    it('should throw error when context_main.json is invalid', async () => {
      const { writeFile } = await import('fs/promises');
      const { join } = await import('path');
      await writeFile(join(tempDir, 'context_main.json'), 'invalid json');

      await expect(
        listBundles({ snapshotId })
      ).rejects.toThrow();
    });

    it('should handle missing context.json in folders', async () => {
      await createMockIndex(tempDir, {
        folders: [
          {
            path: 'src/components',
            bundles: 1,
            components: ['Button'],
          },
        ],
      });

      // Don't create context.json file

      const result = await listBundles({ snapshotId });

      // Should return empty list when bundle files are missing
      expect(result.totalBundles).toBe(0);
      expect(result.bundles).toHaveLength(0);
    });
  });

  describe('bundle descriptor format', () => {
    it('should include all required fields in bundle descriptor', async () => {
      await createMockIndex(tempDir, {
        folders: [
          {
            path: 'src/components',
            bundles: 1,
            components: ['Button'],
          },
        ],
      });

      const bundle = createMockBundle('Button', { position: '1/1' });
      await createMockBundleFiles(tempDir, 'src/components', [bundle]);

      const result = await listBundles({ snapshotId });

      const descriptor = result.bundles[0];
      expect(descriptor).toHaveProperty('id');
      expect(descriptor).toHaveProperty('rootComponent');
      expect(descriptor).toHaveProperty('filePath');
      expect(descriptor).toHaveProperty('folder');
      expect(descriptor).toHaveProperty('bundlePath');
      expect(descriptor).toHaveProperty('position');
      expect(descriptor).toHaveProperty('bundleHash');
      expect(descriptor).toHaveProperty('approxTokens');
    });

    it('should use forward slashes in bundlePath', async () => {
      await createMockIndex(tempDir, {
        folders: [
          {
            path: 'src\\components',
            bundles: 1,
            components: ['Button'],
          },
        ],
      });

      const bundle = createMockBundle('Button');
      await createMockBundleFiles(tempDir, 'src/components', [bundle]);

      const result = await listBundles({ snapshotId });

      expect(result.bundles[0].bundlePath).not.toContain('\\');
      expect(result.bundles[0].bundlePath).toContain('/');
    });

    it('should generate unique IDs for bundles', async () => {
      await createMockIndex(tempDir, {
        folders: [
          {
            path: 'src/components',
            bundles: 2,
            components: ['Button', 'Input'],
          },
        ],
      });

      const bundles = [
        createMockBundle('Button'),
        createMockBundle('Input'),
      ];
      await createMockBundleFiles(tempDir, 'src/components', bundles);

      const result = await listBundles({ snapshotId });

      const ids = result.bundles.map(b => b.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe('complex scenarios', () => {
    it('should handle deeply nested folder structures', async () => {
      await createMockIndex(tempDir, {
        folders: [
          {
            path: 'src/features/auth/components',
            bundles: 1,
            components: ['LoginForm'],
          },
          {
            path: 'src/features/dashboard/widgets',
            bundles: 1,
            components: ['StatCard'],
          },
        ],
      });

      await createMockBundleFiles(
        tempDir,
        'src/features/auth/components',
        [createMockBundle('LoginForm')]
      );
      await createMockBundleFiles(
        tempDir,
        'src/features/dashboard/widgets',
        [createMockBundle('StatCard')]
      );

      const result = await listBundles({ snapshotId });

      expect(result.totalBundles).toBe(2);
      expect(result.bundles.map(b => b.rootComponent)).toContain('LoginForm');
      expect(result.bundles.map(b => b.rootComponent)).toContain('StatCard');
    });

    it('should handle multiple bundles per file', async () => {
      await createMockIndex(tempDir, {
        folders: [
          {
            path: 'src/components',
            bundles: 3,
            components: ['ComponentA', 'ComponentB', 'ComponentC'],
          },
        ],
      });

      // Create multiple bundles in the same context.json
      const bundles = [
        createMockBundle('ComponentA', { position: '1/3' }),
        createMockBundle('ComponentB', { position: '2/3' }),
        createMockBundle('ComponentC', { position: '3/3' }),
      ];
      await createMockBundleFiles(tempDir, 'src/components', bundles);

      const result = await listBundles({ snapshotId });

      expect(result.totalBundles).toBe(3);
      expect(result.bundles.map(b => b.position)).toContain('1/3');
      expect(result.bundles.map(b => b.position)).toContain('2/3');
      expect(result.bundles.map(b => b.position)).toContain('3/3');
    });

    it('should filter by precise folder prefix match', async () => {
      await createMockIndex(tempDir, {
        folders: [
          {
            path: 'src',
            bundles: 1,
            components: ['App'],
          },
          {
            path: 'src/components',
            bundles: 1,
            components: ['Button'],
          },
          {
            path: 'srcTest',
            bundles: 1,
            components: ['TestComponent'],
          },
        ],
      });

      await createMockBundleFiles(tempDir, 'src', [createMockBundle('App')]);
      await createMockBundleFiles(tempDir, 'src/components', [createMockBundle('Button')]);
      await createMockBundleFiles(tempDir, 'srcTest', [createMockBundle('TestComponent')]);

      const result = await listBundles({
        snapshotId,
        folderPrefix: 'src/',
      });

      // Should only match folders starting with 'src/', not 'src' or 'srcTest'
      expect(result.bundles.map(b => b.folder)).not.toContain('srcTest');
    });
  });
});
