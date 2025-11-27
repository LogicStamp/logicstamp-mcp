/**
 * Integration tests for compare-snapshot tool
 */

import { compareSnapshot } from '../../src/mcp/tools/compare-snapshot.js';
import { stateManager } from '../../src/mcp/state.js';
import {
  createTempDir,
  cleanupTempDir,
  createMockIndex,
  createMockBundle,
  createMockBundleFiles,
  createMockContract,
  validateCompareResult,
} from '../helpers/test-utils.js';
import { tmpdir } from 'os';
import { writeFile, cp } from 'fs/promises';
import { join } from 'path';
import { readdir } from 'fs/promises';
import type { Snapshot, LogicStampBundle } from '../../src/types/schemas.js';

describe('compareSnapshot integration tests', () => {
  let tempDir: string;
  let baselineDir: string;
  let snapshotId: string;

  beforeEach(async () => {
    tempDir = await createTempDir(tmpdir());
    baselineDir = await createTempDir(tmpdir());
    stateManager.reset();

    // Create baseline files in a separate directory
    await createMockIndex(baselineDir, {
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

    const baselineBundles = [
      createMockBundle('Button', { position: '1/2' }),
      createMockBundle('Input', { position: '2/2' }),
    ];
    await createMockBundleFiles(baselineDir, 'src/components', baselineBundles);

    // Copy baseline to project directory
    await cp(join(baselineDir, 'context_main.json'), join(tempDir, 'context_main.json'), { recursive: false });
    await cp(join(baselineDir, 'src'), join(tempDir, 'src'), { recursive: true });

    // Create baseline snapshot pointing to the separate baseline directory
    snapshotId = stateManager.generateSnapshotId();
    const snapshot: Snapshot = {
      id: snapshotId,
      createdAt: new Date().toISOString(),
      projectPath: tempDir,
      profile: 'llm-chat',
      mode: 'header',
      contextDir: baselineDir,
    };
    stateManager.setSnapshot(snapshot);
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
    await cleanupTempDir(baselineDir);
  });

  describe('successful comparisons', () => {
    it('should detect no changes when files are identical', async () => {
      const result = await compareSnapshot({
        projectPath: tempDir,
        baseline: 'disk',
      });

      expect(validateCompareResult(result)).toBe(true);
      expect(result.status).toBe('pass');
      expect(result.summary.unchangedFolders).toBe(1);
      expect(result.summary.changedFolders).toBe(0);
      expect(result.folderDiffs).toHaveLength(0);
    });

    it('should detect added bundle', async () => {
      // Add a new bundle to existing folder
      const updatedBundles = [
        createMockBundle('Button', { position: '1/3' }),
        createMockBundle('Input', { position: '2/3' }),
        createMockBundle('Select', { position: '3/3' }),
      ];
      await createMockBundleFiles(tempDir, 'src/components', updatedBundles);

      // Update index
      await createMockIndex(tempDir, {
        totalComponents: 3,
        totalBundles: 3,
        folders: [
          {
            path: 'src/components',
            bundles: 3,
            components: ['Button', 'Input', 'Select'],
          },
        ],
      });

      const result = await compareSnapshot({
        projectPath: tempDir,
        baseline: 'disk',
      });

      expect(result.status).toBe('diff');
      expect(result.summary.changedFolders).toBe(1);
      expect(result.folderDiffs[0].changes).toContainEqual(
        expect.objectContaining({
          rootComponent: 'Select',
          type: 'bundle_added',
        })
      );
    });

    it('should detect removed bundle', async () => {
      // Remove a bundle
      const updatedBundles = [createMockBundle('Button', { position: '1/1' })];
      await createMockBundleFiles(tempDir, 'src/components', updatedBundles);

      // Update index
      await createMockIndex(tempDir, {
        totalComponents: 1,
        totalBundles: 1,
        folders: [
          {
            path: 'src/components',
            bundles: 1,
            components: ['Button'],
          },
        ],
      });

      const result = await compareSnapshot({
        projectPath: tempDir,
        baseline: 'disk',
      });

      expect(result.status).toBe('diff');
      expect(result.folderDiffs[0].changes).toContainEqual(
        expect.objectContaining({
          rootComponent: 'Input',
          type: 'bundle_removed',
        })
      );
    });

    it('should detect changed contract', async () => {
      // Modify a bundle's contract
      const modifiedBundle = createMockBundle('Button', { position: '1/2' });
      modifiedBundle.graph.nodes[0].contract.logicSignature.props.newProp = {
        type: 'string',
        optional: true,
      };
      modifiedBundle.graph.nodes[0].contract.semanticHash = 'new_hash_123';

      const updatedBundles = [
        modifiedBundle,
        createMockBundle('Input', { position: '2/2' }),
      ];
      await createMockBundleFiles(tempDir, 'src/components', updatedBundles);

      const result = await compareSnapshot({
        projectPath: tempDir,
        baseline: 'disk',
      });

      expect(result.status).toBe('diff');
      expect(result.folderDiffs[0].changes).toContainEqual(
        expect.objectContaining({
          rootComponent: 'Button',
          type: 'uif_contract_changed',
        })
      );
    });

    it('should detect added folder', async () => {
      // Add a new folder with bundles
      const newBundles = [createMockBundle('formatDate')];
      await createMockBundleFiles(tempDir, 'src/utils', newBundles);

      // Update index
      await createMockIndex(tempDir, {
        totalComponents: 3,
        totalBundles: 3,
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

      const result = await compareSnapshot({
        projectPath: tempDir,
        baseline: 'disk',
      });

      expect(result.status).toBe('diff');
      expect(result.summary.addedFolders).toBe(1);
      expect(result.folderDiffs).toContainEqual(
        expect.objectContaining({
          path: 'src/utils',
          status: 'added',
        })
      );
    });

    it('should detect removed folder', async () => {
      // Remove all bundles from folder (simulate folder removal)
      await createMockIndex(tempDir, {
        totalComponents: 0,
        totalBundles: 0,
        folders: [],
      });

      const result = await compareSnapshot({
        projectPath: tempDir,
        baseline: 'disk',
      });

      expect(result.status).toBe('diff');
      expect(result.summary.removedFolders).toBe(1);
      expect(result.folderDiffs).toContainEqual(
        expect.objectContaining({
          path: 'src/components',
          status: 'removed',
        })
      );
    });

    it('should calculate token deltas', async () => {
      // Add a larger bundle
      const largeBundle = createMockBundle('LargeComponent', {
        includeCode: true,
      });

      const updatedBundles = [
        createMockBundle('Button', { position: '1/3' }),
        createMockBundle('Input', { position: '2/3' }),
        largeBundle,
      ];
      await createMockBundleFiles(tempDir, 'src/components', updatedBundles);

      await createMockIndex(tempDir, {
        totalComponents: 3,
        totalBundles: 3,
        folders: [
          {
            path: 'src/components',
            bundles: 3,
            components: ['Button', 'Input', 'LargeComponent'],
          },
        ],
      });

      const result = await compareSnapshot({
        projectPath: tempDir,
        baseline: 'disk',
      });

      expect(result.summary.tokenDelta).toBeDefined();
      expect(result.summary.tokenDelta.gpt4oMini).toBeDefined();
      expect(result.summary.tokenDelta.claude).toBeDefined();
    });

    it('should detect contract modifications in detail', async () => {
      const modifiedBundle = createMockBundle('Button', { position: '1/2' });
      const contract = modifiedBundle.graph.nodes[0].contract;

      // Add new props
      contract.logicSignature.props.disabled = {
        type: 'boolean',
        optional: true,
      };

      // Add new function
      contract.version.functions = ['handleClick', 'handleHover'];

      // Change semantic hash
      contract.semanticHash = 'new_semantic_hash';

      const updatedBundles = [
        modifiedBundle,
        createMockBundle('Input', { position: '2/2' }),
      ];
      await createMockBundleFiles(tempDir, 'src/components', updatedBundles);

      const result = await compareSnapshot({
        projectPath: tempDir,
        baseline: 'disk',
      });

      const change = result.folderDiffs[0].changes.find(
        c => c.rootComponent === 'Button'
      );

      expect(change?.type).toBe('uif_contract_changed');
      expect(change?.details?.addedProps).toContain('disabled');
      expect(change?.details?.addedFunctions).toContain('handleHover');
    });
  });

  describe('baseline options', () => {
    it('should compare against snapshot baseline', async () => {
      const result = await compareSnapshot({
        projectPath: tempDir,
        baseline: 'snapshot',
      });

      expect(result.baseline).toBe('snapshot');
      expect(result.status).toBe('pass');
    });

    it('should use disk baseline by default', async () => {
      const result = await compareSnapshot({
        projectPath: tempDir,
      });

      expect(result.baseline).toBe('disk');
    });

    it('should reject git baseline (not yet implemented)', async () => {
      const result = await compareSnapshot({
        projectPath: tempDir,
        baseline: 'git:main',
      });

      expect(result.status).toBe('error');
      expect(result.error).toContain('Git baseline not yet implemented');
    });
  });

  describe('error handling', () => {
    it('should return error status when no snapshot exists', async () => {
      stateManager.reset();

      const result = await compareSnapshot({
        projectPath: tempDir,
        baseline: 'disk',
      });

      expect(result.status).toBe('error');
      expect(result.error).toBeDefined();
    });

    it('should handle missing baseline context_main.json', async () => {
      // Remove context_main.json
      const { rm } = await import('fs/promises');
      await rm(join(tempDir, 'context_main.json'), { force: true });

      // Create new snapshot without baseline
      stateManager.reset();

      const result = await compareSnapshot({
        projectPath: tempDir,
        baseline: 'disk',
      });

      expect(result.status).toBe('error');
    });

    it('should handle invalid JSON in context files', async () => {
      await writeFile(join(tempDir, 'context_main.json'), 'invalid json');

      const result = await compareSnapshot({
        projectPath: tempDir,
        baseline: 'disk',
      });

      expect(result.status).toBe('error');
      expect(result.error).toBeDefined();
    });

    it('should store error result in state', async () => {
      stateManager.reset();

      const result = await compareSnapshot({
        projectPath: tempDir,
        baseline: 'disk',
      });

      const lastResult = stateManager.getLastCompareResult();
      expect(lastResult?.status).toBe('error');
    });
  });

  describe('change detection details', () => {
    it('should detect props changes', async () => {
      const modifiedBundle = createMockBundle('Button', { position: '1/2' });
      const contract = modifiedBundle.graph.nodes[0].contract;

      // Remove existing prop
      delete contract.logicSignature.props.label;

      // Add new prop
      contract.logicSignature.props.variant = {
        type: "'primary' | 'secondary'",
        optional: true,
      };

      contract.semanticHash = 'modified_hash';

      await createMockBundleFiles(tempDir, 'src/components', [
        modifiedBundle,
        createMockBundle('Input', { position: '2/2' }),
      ]);

      const result = await compareSnapshot({
        projectPath: tempDir,
        baseline: 'disk',
      });

      const change = result.folderDiffs[0].changes.find(
        c => c.rootComponent === 'Button'
      );

      expect(change?.details?.removedProps).toContain('label');
      expect(change?.details?.addedProps).toContain('variant');
    });

    it('should detect imports changes', async () => {
      const modifiedBundle = createMockBundle('Button', { position: '1/2' });
      const contract = modifiedBundle.graph.nodes[0].contract;

      contract.version.imports = ['react', 'styled-components', 'lodash'];
      contract.semanticHash = 'modified_hash';

      await createMockBundleFiles(tempDir, 'src/components', [
        modifiedBundle,
        createMockBundle('Input', { position: '2/2' }),
      ]);

      const result = await compareSnapshot({
        projectPath: tempDir,
        baseline: 'disk',
      });

      const change = result.folderDiffs[0].changes.find(
        c => c.rootComponent === 'Button'
      );

      expect(change?.details?.addedImports).toEqual(
        expect.arrayContaining(['styled-components', 'lodash'])
      );
    });

    it('should detect exports changes', async () => {
      const modifiedBundle = createMockBundle('Button', { position: '1/2' });
      const contract = modifiedBundle.graph.nodes[0].contract;

      contract.exports = {
        default: 'Button',
        named: ['ButtonProps', 'useButton'],
      };
      contract.semanticHash = 'modified_hash';

      await createMockBundleFiles(tempDir, 'src/components', [
        modifiedBundle,
        createMockBundle('Input', { position: '2/2' }),
      ]);

      const result = await compareSnapshot({
        projectPath: tempDir,
        baseline: 'disk',
      });

      const change = result.folderDiffs[0].changes.find(
        c => c.rootComponent === 'Button'
      );

      expect(change?.details?.modifiedExports).toBeDefined();
    });

    it('should track semantic hash changes', async () => {
      // Get the baseline bundle to capture its original hash
      const { readFile } = await import('fs/promises');
      const baselineBundlesPath = join(baselineDir, 'src/components', 'context.json');
      const baselineBundles: LogicStampBundle[] = JSON.parse(
        await readFile(baselineBundlesPath, 'utf-8')
      );
      // Extract component name helper
      const extractName = (entryId: string) => {
        const parts = entryId.split(/[/\\]/);
        const fileName = parts[parts.length - 1];
        return fileName.replace(/\.(ts|tsx|js|jsx)$/, '');
      };
      const baselineButtonBundle = baselineBundles.find(
        b => extractName(b.graph.nodes[0]?.entryId || b.entryId) === 'Button'
      );
      const originalHash = baselineButtonBundle?.graph.nodes[0].contract.semanticHash || '';

      const modifiedBundle = createMockBundle('Button', { position: '1/2' });
      const newHash = 'completely_new_hash';

      modifiedBundle.graph.nodes[0].contract.semanticHash = newHash;
      modifiedBundle.graph.nodes[0].contract.logicSignature.props.newProp = {
        type: 'string',
      };

      await createMockBundleFiles(tempDir, 'src/components', [
        modifiedBundle,
        createMockBundle('Input', { position: '2/2' }),
      ]);

      const result = await compareSnapshot({
        projectPath: tempDir,
        baseline: 'disk',
      });

      const change = result.folderDiffs[0].changes.find(
        c => c.rootComponent === 'Button'
      );

      expect(change?.semanticHashBefore).toBe(originalHash);
      expect(change?.semanticHashAfter).toBe(newHash);
    });
  });

  describe('summary statistics', () => {
    it('should count folder changes correctly', async () => {
      // Add folder
      await createMockBundleFiles(tempDir, 'src/utils', [
        createMockBundle('helper'),
      ]);

      // Modify existing folder
      const modifiedBundle = createMockBundle('Button', { position: '1/2' });
      modifiedBundle.graph.nodes[0].contract.semanticHash = 'new_hash';
      await createMockBundleFiles(tempDir, 'src/components', [
        modifiedBundle,
        createMockBundle('Input', { position: '2/2' }),
      ]);

      await createMockIndex(tempDir, {
        totalComponents: 3,
        totalBundles: 3,
        folders: [
          {
            path: 'src/components',
            bundles: 2,
            components: ['Button', 'Input'],
          },
          {
            path: 'src/utils',
            bundles: 1,
            components: ['helper'],
          },
        ],
      });

      const result = await compareSnapshot({
        projectPath: tempDir,
        baseline: 'disk',
      });

      expect(result.summary.totalFolders).toBe(2);
      expect(result.summary.changedFolders).toBe(1);
      expect(result.summary.addedFolders).toBe(1);
      expect(result.summary.unchangedFolders).toBe(0);
    });

    it('should provide correct overall status', async () => {
      let result = await compareSnapshot({
        projectPath: tempDir,
        baseline: 'disk',
      });
      expect(result.status).toBe('pass');

      // Make a change
      const modifiedBundle = createMockBundle('Button', { position: '1/2' });
      modifiedBundle.graph.nodes[0].contract.semanticHash = 'new_hash';
      await createMockBundleFiles(tempDir, 'src/components', [
        modifiedBundle,
        createMockBundle('Input', { position: '2/2' }),
      ]);

      result = await compareSnapshot({
        projectPath: tempDir,
        baseline: 'disk',
      });
      expect(result.status).toBe('diff');
    });
  });

  describe('state management', () => {
    it('should store comparison result in state', async () => {
      const result = await compareSnapshot({
        projectPath: tempDir,
        baseline: 'disk',
      });

      const storedResult = stateManager.getLastCompareResult();
      expect(storedResult).toEqual(result);
    });

    it('should update stored result on subsequent comparisons', async () => {
      await compareSnapshot({
        projectPath: tempDir,
        baseline: 'disk',
      });

      // Make changes
      const modifiedBundle = createMockBundle('Button', { position: '1/2' });
      modifiedBundle.graph.nodes[0].contract.semanticHash = 'new_hash';
      await createMockBundleFiles(tempDir, 'src/components', [
        modifiedBundle,
        createMockBundle('Input', { position: '2/2' }),
      ]);

      const result2 = await compareSnapshot({
        projectPath: tempDir,
        baseline: 'disk',
      });

      const storedResult = stateManager.getLastCompareResult();
      expect(storedResult?.status).toBe(result2.status);
    });
  });
});
