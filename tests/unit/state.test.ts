/**
 * Unit tests for state manager
 */

import { stateManager } from '../../src/mcp/state.js';
import type { Snapshot, CompareResult } from '../../src/types/schemas.js';

describe('StateManager', () => {
  beforeEach(() => {
    // Reset state before each test
    stateManager.reset();
  });

  describe('generateSnapshotId', () => {
    it('should generate unique snapshot IDs', () => {
      const id1 = stateManager.generateSnapshotId();
      const id2 = stateManager.generateSnapshotId();

      expect(id1).toMatch(/^snap_\d+_\d+$/);
      expect(id2).toMatch(/^snap_\d+_\d+$/);
      expect(id1).not.toBe(id2);
    });

    it('should include timestamp in ID', () => {
      const id = stateManager.generateSnapshotId();
      const match = id.match(/^snap_(\d+)_\d+$/);
      expect(match).not.toBeNull();
      const timestamp = parseInt(match![1]);
      const now = Date.now();

      expect(timestamp).toBeGreaterThan(now - 1000);
      expect(timestamp).toBeLessThanOrEqual(now);
    });
  });

  describe('snapshot management', () => {
    const mockSnapshot: Snapshot = {
      id: 'snap_test_123',
      createdAt: new Date().toISOString(),
      projectPath: '/test/project',
      profile: 'llm-chat',
      mode: 'header',
      contextDir: '/test/project',
    };

    it('should store and retrieve snapshots', () => {
      stateManager.setSnapshot(mockSnapshot);

      const retrieved = stateManager.getSnapshot(mockSnapshot.id);
      expect(retrieved).toEqual(mockSnapshot);
    });

    it('should return undefined for non-existent snapshot', () => {
      const retrieved = stateManager.getSnapshot('non_existent');
      expect(retrieved).toBeUndefined();
    });

    it('should set current snapshot when storing', () => {
      stateManager.setSnapshot(mockSnapshot);

      const current = stateManager.getCurrentSnapshot();
      expect(current).toEqual(mockSnapshot);
    });

    it('should update current snapshot with latest', () => {
      const snapshot1: Snapshot = { ...mockSnapshot, id: 'snap_1' };
      const snapshot2: Snapshot = { ...mockSnapshot, id: 'snap_2' };

      stateManager.setSnapshot(snapshot1);
      stateManager.setSnapshot(snapshot2);

      const current = stateManager.getCurrentSnapshot();
      expect(current?.id).toBe('snap_2');
    });

    it('should retrieve all snapshots', () => {
      const snapshot1: Snapshot = { ...mockSnapshot, id: 'snap_1' };
      const snapshot2: Snapshot = { ...mockSnapshot, id: 'snap_2' };
      const snapshot3: Snapshot = { ...mockSnapshot, id: 'snap_3' };

      stateManager.setSnapshot(snapshot1);
      stateManager.setSnapshot(snapshot2);
      stateManager.setSnapshot(snapshot3);

      const allSnapshots = stateManager.getAllSnapshots();
      expect(allSnapshots).toHaveLength(3);
      expect(allSnapshots.map(s => s.id)).toContain('snap_1');
      expect(allSnapshots.map(s => s.id)).toContain('snap_2');
      expect(allSnapshots.map(s => s.id)).toContain('snap_3');
    });
  });

  describe('compare result management', () => {
    const mockCompareResult: CompareResult = {
      baseline: 'disk',
      status: 'pass',
      summary: {
        totalFolders: 5,
        unchangedFolders: 5,
        changedFolders: 0,
        addedFolders: 0,
        removedFolders: 0,
        tokenDelta: {
          gpt4oMini: 0,
          claude: 0,
        },
      },
      folderDiffs: [],
    };

    it('should store and retrieve compare results', () => {
      stateManager.setLastCompareResult(mockCompareResult);

      const retrieved = stateManager.getLastCompareResult();
      expect(retrieved).toEqual(mockCompareResult);
    });

    it('should return undefined when no compare result exists', () => {
      const retrieved = stateManager.getLastCompareResult();
      expect(retrieved).toBeUndefined();
    });

    it('should overwrite previous compare result', () => {
      const result1: CompareResult = { ...mockCompareResult, status: 'pass' };
      const result2: CompareResult = { ...mockCompareResult, status: 'diff' };

      stateManager.setLastCompareResult(result1);
      stateManager.setLastCompareResult(result2);

      const retrieved = stateManager.getLastCompareResult();
      expect(retrieved?.status).toBe('diff');
    });
  });

  describe('cleanupOldSnapshots', () => {
    it('should remove snapshots older than maxAge', async () => {
      const oldSnapshot: Snapshot = {
        id: 'snap_old',
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
        projectPath: '/test/project',
        profile: 'llm-chat',
        mode: 'header',
        contextDir: '/test/project',
      };

      const newSnapshot: Snapshot = {
        id: 'snap_new',
        createdAt: new Date().toISOString(),
        projectPath: '/test/project',
        profile: 'llm-chat',
        mode: 'header',
        contextDir: '/test/project',
      };

      stateManager.setSnapshot(oldSnapshot);
      stateManager.setSnapshot(newSnapshot);

      // Clean up snapshots older than 1 hour
      stateManager.cleanupOldSnapshots(60 * 60 * 1000);

      const allSnapshots = stateManager.getAllSnapshots();
      expect(allSnapshots).toHaveLength(1);
      expect(allSnapshots[0].id).toBe('snap_new');
    });

    it('should keep all snapshots within maxAge', () => {
      const snapshot1: Snapshot = {
        id: 'snap_1',
        createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 min ago
        projectPath: '/test/project',
        profile: 'llm-chat',
        mode: 'header',
        contextDir: '/test/project',
      };

      const snapshot2: Snapshot = {
        id: 'snap_2',
        createdAt: new Date().toISOString(),
        projectPath: '/test/project',
        profile: 'llm-chat',
        mode: 'header',
        contextDir: '/test/project',
      };

      stateManager.setSnapshot(snapshot1);
      stateManager.setSnapshot(snapshot2);

      // Clean up snapshots older than 1 hour
      stateManager.cleanupOldSnapshots(60 * 60 * 1000);

      const allSnapshots = stateManager.getAllSnapshots();
      expect(allSnapshots).toHaveLength(2);
    });

    it('should use default maxAge of 1 hour', () => {
      const oldSnapshot: Snapshot = {
        id: 'snap_old',
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        projectPath: '/test/project',
        profile: 'llm-chat',
        mode: 'header',
        contextDir: '/test/project',
      };

      stateManager.setSnapshot(oldSnapshot);
      stateManager.cleanupOldSnapshots();

      const allSnapshots = stateManager.getAllSnapshots();
      expect(allSnapshots).toHaveLength(0);
    });
  });

  describe('reset', () => {
    it('should clear all state', () => {
      const snapshot: Snapshot = {
        id: 'snap_test',
        createdAt: new Date().toISOString(),
        projectPath: '/test/project',
        profile: 'llm-chat',
        mode: 'header',
        contextDir: '/test/project',
      };

      const compareResult: CompareResult = {
        baseline: 'disk',
        status: 'pass',
        summary: {
          totalFolders: 1,
          unchangedFolders: 1,
          changedFolders: 0,
          addedFolders: 0,
          removedFolders: 0,
          tokenDelta: { gpt4oMini: 0, claude: 0 },
        },
        folderDiffs: [],
      };

      stateManager.setSnapshot(snapshot);
      stateManager.setLastCompareResult(compareResult);

      stateManager.reset();

      expect(stateManager.getCurrentSnapshot()).toBeUndefined();
      expect(stateManager.getLastCompareResult()).toBeUndefined();
      expect(stateManager.getAllSnapshots()).toHaveLength(0);
    });

    it('should allow new snapshots after reset', () => {
      const snapshot1: Snapshot = {
        id: 'snap_1',
        createdAt: new Date().toISOString(),
        projectPath: '/test/project',
        profile: 'llm-chat',
        mode: 'header',
        contextDir: '/test/project',
      };

      stateManager.setSnapshot(snapshot1);
      stateManager.reset();

      const snapshot2: Snapshot = {
        id: 'snap_2',
        createdAt: new Date().toISOString(),
        projectPath: '/test/project',
        profile: 'llm-chat',
        mode: 'header',
        contextDir: '/test/project',
      };

      stateManager.setSnapshot(snapshot2);

      const current = stateManager.getCurrentSnapshot();
      expect(current?.id).toBe('snap_2');
    });
  });
});
