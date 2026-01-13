/**
 * Integration tests for read-bundle tool
 */

import { readBundle } from '../../src/mcp/tools/read-bundle.js';
import { stateManager } from '../../src/mcp/state.js';
import {
  createTempDir,
  cleanupTempDir,
  createMockIndex,
  createMockBundle,
  createMockBundleFiles,
} from '../helpers/test-utils.js';
import { tmpdir } from 'os';
import type { Snapshot, LogicStampBundle } from '../../src/types/schemas.js';

describe('readBundle integration tests', () => {
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

  describe('successful bundle reading', () => {
    it('should read context_main.json as LogicStampIndex', async () => {
      const mockIndex = await createMockIndex(tempDir, {
        folders: [
          {
            path: 'src/components',
            bundles: 1,
            components: ['Button'],
          },
        ],
      });

      const result = await readBundle({
        snapshotId,
        bundlePath: 'context_main.json',
      });

      expect(result.snapshotId).toBe(snapshotId);
      expect(result.bundlePath).toBe('context_main.json');
      expect(result.index).toBeDefined();
      expect(result.index?.type).toBe('LogicStampIndex');
      expect(result.index?.summary).toBeDefined();
      expect(result.index?.folders).toBeDefined();
      expect(result.index?.folders).toHaveLength(1);
      expect(result.bundle).toBeUndefined();
    });

    it('should read bundle by bundlePath', async () => {
      await createMockIndex(tempDir, {
        folders: [
          {
            path: 'src/components',
            bundles: 1,
            components: ['Button'],
          },
        ],
      });

      const mockBundle = createMockBundle('Button', { includeCode: true });
      await createMockBundleFiles(tempDir, 'src/components', [mockBundle]);

      const result = await readBundle({
        snapshotId,
        bundlePath: 'src/components/context.json',
      });

      expect(result.snapshotId).toBe(snapshotId);
      expect(result.bundlePath).toBe('src/components/context.json');
      expect(result.bundle).toBeDefined();
      expect(result.bundle!).toBeDefined();
      expect(result.bundle!.type).toBe('LogicStampBundle');
    });

    it('should read specific component by name', async () => {
      await createMockIndex(tempDir);

      const bundles = [
        createMockBundle('Button', { position: '1/2' }),
        createMockBundle('Input', { position: '2/2' }),
      ];
      await createMockBundleFiles(tempDir, 'src/components', bundles);

      const result = await readBundle({
        snapshotId,
        bundlePath: 'src/components/context.json',
        rootComponent: 'Input',
      });

      expect(result.bundle).toBeDefined();
      expect(result.bundle!.graph.nodes[0].contract.description).toContain('Input');
      expect(result.rootComponent).toBe('Input');
    });

    it('should return first bundle when rootComponent not specified', async () => {
      await createMockIndex(tempDir);

      const bundles = [
        createMockBundle('Button', { position: '1/3' }),
        createMockBundle('Input', { position: '2/3' }),
        createMockBundle('Select', { position: '3/3' }),
      ];
      await createMockBundleFiles(tempDir, 'src/components', bundles);

      const result = await readBundle({
        snapshotId,
        bundlePath: 'src/components/context.json',
      });

      expect(result.bundle).toBeDefined();
      expect(result.bundle!).toEqual(bundles[0]);
    });

    it('should include full bundle structure', async () => {
      await createMockIndex(tempDir);

      const mockBundle = createMockBundle('Button', { includeCode: true });
      await createMockBundleFiles(tempDir, 'src/components', [mockBundle]);

      const result = await readBundle({
        snapshotId,
        bundlePath: 'src/components/context.json',
      });

      expect(result.bundle).toBeDefined();
      expect(result.bundle!).toHaveProperty('type');
      expect(result.bundle!).toHaveProperty('schemaVersion');
      expect(result.bundle!).toHaveProperty('bundleHash');
      expect(result.bundle!).toHaveProperty('graph');
      expect(result.bundle!).toHaveProperty('meta');
      expect(result.bundle!.graph).toHaveProperty('nodes');
      expect(result.bundle!.graph).toHaveProperty('edges');
    });

    it('should include contract details', async () => {
      await createMockIndex(tempDir);

      const mockBundle = createMockBundle('Button');
      await createMockBundleFiles(tempDir, 'src/components', [mockBundle]);

      const result = await readBundle({
        snapshotId,
        bundlePath: 'src/components/context.json',
      });

      expect(result.bundle).toBeDefined();
      const contract = result.bundle!.graph.nodes[0].contract;
      expect(contract).toHaveProperty('type', 'UIFContract');
      expect(contract).toHaveProperty('kind');
      expect(contract).toHaveProperty('logicSignature');
      expect(contract).toHaveProperty('semanticHash');
      expect(contract).toHaveProperty('fileHash');
      expect(contract.logicSignature).toHaveProperty('props');
      expect(contract.logicSignature).toHaveProperty('emits');
    });

    it('should include code header when available', async () => {
      await createMockIndex(tempDir);

      const mockBundle = createMockBundle('Button', { includeCode: true });
      await createMockBundleFiles(tempDir, 'src/components', [mockBundle]);

      const result = await readBundle({
        snapshotId,
        bundlePath: 'src/components/context.json',
      });

      expect(result.bundle).toBeDefined();
      expect(result.bundle!.graph.nodes[0].codeHeader).toBeDefined();
      expect(typeof result.bundle!.graph.nodes[0].codeHeader).toBe('string');
    });

    it('should include full code when available', async () => {
      await createMockIndex(tempDir);

      const mockBundle = createMockBundle('Button', { includeCode: true });
      await createMockBundleFiles(tempDir, 'src/components', [mockBundle]);

      const result = await readBundle({
        snapshotId,
        bundlePath: 'src/components/context.json',
      });

      expect(result.bundle).toBeDefined();
      expect(result.bundle!.graph.nodes[0].fullCode).toBeDefined();
      expect(typeof result.bundle!.graph.nodes[0].fullCode).toBe('string');
    });
  });

  describe('error handling', () => {
    it('should throw error when snapshot not found', async () => {
      await expect(
        readBundle({
          snapshotId: 'non_existent',
          bundlePath: 'src/components/context.json',
        })
      ).rejects.toThrow('Snapshot not found');
    });

    it('should throw error when bundlePath is missing', async () => {
      await expect(
        readBundle({
          snapshotId,
          bundlePath: '',
        })
      ).rejects.toThrow();
    });

    it('should throw error when bundle file does not exist', async () => {
      await createMockIndex(tempDir);

      await expect(
        readBundle({
          snapshotId,
          bundlePath: 'src/nonexistent/context.json',
        })
      ).rejects.toThrow('Failed to read bundle');
    });

    it('should throw error when bundle file contains invalid JSON', async () => {
      await createMockIndex(tempDir);

      const { writeFile, mkdir } = await import('fs/promises');
      const { join } = await import('path');
      const folderPath = join(tempDir, 'src/components');
      await mkdir(folderPath, { recursive: true });
      await writeFile(join(folderPath, 'context.json'), 'invalid json');

      await expect(
        readBundle({
          snapshotId,
          bundlePath: 'src/components/context.json',
        })
      ).rejects.toThrow();
    });

    it('should throw error when specified component not found', async () => {
      await createMockIndex(tempDir);

      const bundles = [createMockBundle('Button')];
      await createMockBundleFiles(tempDir, 'src/components', bundles);

      await expect(
        readBundle({
          snapshotId,
          bundlePath: 'src/components/context.json',
          rootComponent: 'NonExistent',
        })
      ).rejects.toThrow('Bundle not found for component');
    });

    it('should throw error when bundle array is empty', async () => {
      await createMockIndex(tempDir);

      await createMockBundleFiles(tempDir, 'src/components', []);

      await expect(
        readBundle({
          snapshotId,
          bundlePath: 'src/components/context.json',
        })
      ).rejects.toThrow('No bundles found');
    });
  });

  describe('component name extraction', () => {
    it('should match component by filename without extension', async () => {
      await createMockIndex(tempDir);

      const mockBundle = createMockBundle('MyComponent');
      mockBundle.graph.nodes[0].entryId = 'src/components/MyComponent.tsx';
      await createMockBundleFiles(tempDir, 'src/components', [mockBundle]);

      const result = await readBundle({
        snapshotId,
        bundlePath: 'src/components/context.json',
        rootComponent: 'MyComponent',
      });

      expect(result.bundle).toBeDefined();
    });

    it('should handle different file extensions', async () => {
      await createMockIndex(tempDir);

      const bundles = [
        createMockBundle('Component1'),
        createMockBundle('Component2'),
      ];
      bundles[0].graph.nodes[0].entryId = 'src/Component1.ts';
      bundles[1].graph.nodes[0].entryId = 'src/Component2.jsx';

      await createMockBundleFiles(tempDir, 'src', bundles);

      const result1 = await readBundle({
        snapshotId,
        bundlePath: 'src/context.json',
        rootComponent: 'Component1',
      });
      expect(result1.bundle).toBeDefined();

      const result2 = await readBundle({
        snapshotId,
        bundlePath: 'src/context.json',
        rootComponent: 'Component2',
      });
      expect(result2.bundle).toBeDefined();
    });

    it('should handle nested paths in entryId', async () => {
      await createMockIndex(tempDir);

      const mockBundle = createMockBundle('Button');
      mockBundle.graph.nodes[0].entryId = 'src/ui/components/Button.tsx';
      await createMockBundleFiles(tempDir, 'src/ui/components', [mockBundle]);

      const result = await readBundle({
        snapshotId,
        bundlePath: 'src/ui/components/context.json',
        rootComponent: 'Button',
      });

      expect(result.bundle).toBeDefined();
    });

    it('should handle Windows-style paths', async () => {
      await createMockIndex(tempDir);

      const mockBundle = createMockBundle('Button');
      mockBundle.graph.nodes[0].entryId = 'src\\components\\Button.tsx';
      await createMockBundleFiles(tempDir, 'src/components', [mockBundle]);

      const result = await readBundle({
        snapshotId,
        bundlePath: 'src/components/context.json',
        rootComponent: 'Button',
      });

      expect(result.bundle).toBeDefined();
    });
  });

  describe('complex bundle structures', () => {
    it('should handle bundles with multiple graph nodes', async () => {
      await createMockIndex(tempDir);

      const mockBundle = createMockBundle('ParentComponent');
      mockBundle.graph.nodes.push({
        entryId: 'src/components/ChildComponent.tsx',
        contract: createMockBundle('ChildComponent').graph.nodes[0].contract,
        codeHeader: null,
      });
      mockBundle.graph.edges.push({
        from: 'src/components/ParentComponent.tsx',
        to: 'src/components/ChildComponent.tsx',
        type: 'dependency',
      });

      await createMockBundleFiles(tempDir, 'src/components', [mockBundle]);

      const result = await readBundle({
        snapshotId,
        bundlePath: 'src/components/context.json',
      });

      expect(result.bundle).toBeDefined();
      expect(result.bundle!.graph.nodes).toHaveLength(2);
      expect(result.bundle!.graph.edges).toHaveLength(1);
    });

    it('should preserve bundle metadata', async () => {
      await createMockIndex(tempDir);

      const mockBundle = createMockBundle('Button');
      mockBundle.depth = 3;
      mockBundle.meta.missing = ['@types/react', 'lodash'];
      mockBundle.meta.source = 'custom-analyzer';

      await createMockBundleFiles(tempDir, 'src/components', [mockBundle]);

      const result = await readBundle({
        snapshotId,
        bundlePath: 'src/components/context.json',
      });

      expect(result.bundle).toBeDefined();
      expect(result.bundle!.depth).toBe(3);
      expect(result.bundle!.meta.missing).toEqual(['@types/react', 'lodash']);
      expect(result.bundle!.meta.source).toBe('custom-analyzer');
    });

    it('should handle bundles with complex props and state', async () => {
      await createMockIndex(tempDir);

      const mockBundle = createMockBundle('ComplexComponent');
      mockBundle.graph.nodes[0].contract.logicSignature.props = {
        title: { type: 'string', optional: false },
        items: { type: 'Array<Item>', optional: false },
        onSelect: { type: '(item: Item) => void', optional: true },
        config: { type: 'Config', optional: true, description: 'Component configuration' },
      };
      mockBundle.graph.nodes[0].contract.logicSignature.state = {
        selectedIndex: 'number',
        isExpanded: 'boolean',
        searchQuery: 'string',
      };

      await createMockBundleFiles(tempDir, 'src/components', [mockBundle]);

      const result = await readBundle({
        snapshotId,
        bundlePath: 'src/components/context.json',
      });

      expect(result.bundle).toBeDefined();
      const contract = result.bundle!.graph.nodes[0].contract;
      expect(Object.keys(contract.logicSignature.props)).toHaveLength(4);
      expect(Object.keys(contract.logicSignature.state || {})).toHaveLength(3);
    });

    it('should handle bundles with exports metadata', async () => {
      await createMockIndex(tempDir);

      const mockBundle = createMockBundle('Component');
      mockBundle.graph.nodes[0].contract.exports = {
        default: 'Component',
        named: ['SubComponent', 'useComponentHook', 'COMPONENT_CONSTANT'],
      };

      await createMockBundleFiles(tempDir, 'src/components', [mockBundle]);

      const result = await readBundle({
        snapshotId,
        bundlePath: 'src/components/context.json',
      });

      expect(result.bundle).toBeDefined();
      const exports = result.bundle!.graph.nodes[0].contract.exports;
      expect(exports?.default).toBe('Component');
      expect(exports?.named).toHaveLength(3);
    });

    it('should handle bundles with Next.js metadata', async () => {
      await createMockIndex(tempDir);

      const mockBundle = createMockBundle('Page');
      mockBundle.graph.nodes[0].contract.nextjs = {
        directive: 'client',
        isInAppDir: true,
      };

      await createMockBundleFiles(tempDir, 'app', [mockBundle]);

      const result = await readBundle({
        snapshotId,
        bundlePath: 'app/context.json',
      });

      expect(result.bundle).toBeDefined();
      const nextjs = result.bundle!.graph.nodes[0].contract.nextjs;
      expect(nextjs?.directive).toBe('client');
      expect(nextjs?.isInAppDir).toBe(true);
    });
  });

  describe('bundle selection logic', () => {
    it('should prioritize exact component name match', async () => {
      await createMockIndex(tempDir);

      const bundles = [
        createMockBundle('UserButton', { position: '1/3' }),
        createMockBundle('Button', { position: '2/3' }),
        createMockBundle('SubmitButton', { position: '3/3' }),
      ];
      await createMockBundleFiles(tempDir, 'src/components', bundles);

      const result = await readBundle({
        snapshotId,
        bundlePath: 'src/components/context.json',
        rootComponent: 'Button',
      });

      expect(result.bundle).toBeDefined();
      expect(result.bundle!.position).toBe('2/3');
    });

    it('should handle case-sensitive component names', async () => {
      await createMockIndex(tempDir);

      const bundles = [
        createMockBundle('button', { position: '1/2' }),
        createMockBundle('Button', { position: '2/2' }),
      ];
      bundles[0].graph.nodes[0].entryId = 'src/button.tsx';
      bundles[1].graph.nodes[0].entryId = 'src/Button.tsx';
      await createMockBundleFiles(tempDir, 'src', bundles);

      const result = await readBundle({
        snapshotId,
        bundlePath: 'src/context.json',
        rootComponent: 'Button',
      });

      expect(result.bundle).toBeDefined();
      expect(result.bundle!.position).toBe('2/2');
    });
  });
});
