/**
 * Integration tests for watch-status tool
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { watchStatus } from '../../src/mcp/tools/watch-status.js';
import {
  createTempDir,
  cleanupTempDir,
} from '../helpers/test-utils.js';
import { tmpdir } from 'os';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

describe('watchStatus integration tests', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await createTempDir(tmpdir());
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  describe('when watch mode is not active', () => {
    it('should return watchModeActive: false when no status file exists', async () => {
      const result = await watchStatus({ projectPath: tempDir });

      expect(result.watchModeActive).toBe(false);
      expect(result.projectPath).toBe(tempDir);
      expect(result.status).toBeUndefined();
      expect(result.message).toContain('NOT active');
    });

    it('should return watchModeActive: false when .logicstamp directory does not exist', async () => {
      const result = await watchStatus({ projectPath: tempDir });

      expect(result.watchModeActive).toBe(false);
      expect(result.message).toContain('stamp context --watch');
    });

    it('should return watchModeActive: false when status file has invalid JSON', async () => {
      const logicstampDir = join(tempDir, '.logicstamp');
      await mkdir(logicstampDir, { recursive: true });
      await writeFile(
        join(logicstampDir, 'context_watch-status.json'),
        'invalid json {'
      );

      const result = await watchStatus({ projectPath: tempDir });

      expect(result.watchModeActive).toBe(false);
    });

    it('should return watchModeActive: false when status file exists but process is dead', async () => {
      const logicstampDir = join(tempDir, '.logicstamp');
      await mkdir(logicstampDir, { recursive: true });

      // Use a PID that definitely doesn't exist (very high number)
      const status = {
        active: true,
        projectRoot: tempDir,
        pid: 9999999, // This PID should not exist
        startedAt: new Date().toISOString(),
        outputDir: tempDir,
      };
      await writeFile(
        join(logicstampDir, 'context_watch-status.json'),
        JSON.stringify(status)
      );

      const result = await watchStatus({ projectPath: tempDir });

      // Should detect that process is dead and return inactive
      expect(result.watchModeActive).toBe(false);
    });
  });

  describe('when watch mode is active', () => {
    it('should return watchModeActive: true with status when process is running', async () => {
      const logicstampDir = join(tempDir, '.logicstamp');
      await mkdir(logicstampDir, { recursive: true });

      // Use current process PID (which is definitely running)
      const startedAt = new Date().toISOString();
      const status = {
        active: true,
        projectRoot: tempDir,
        pid: process.pid, // Current process is definitely running
        startedAt,
        outputDir: tempDir,
      };
      await writeFile(
        join(logicstampDir, 'context_watch-status.json'),
        JSON.stringify(status)
      );

      const result = await watchStatus({ projectPath: tempDir });

      expect(result.watchModeActive).toBe(true);
      expect(result.status).toBeDefined();
      expect(result.status?.pid).toBe(process.pid);
      expect(result.status?.startedAt).toBe(startedAt);
      expect(result.message).toContain('ACTIVE');
      expect(result.message).toContain('skip');
    });

    it('should include helpful message about skipping refresh_snapshot', async () => {
      const logicstampDir = join(tempDir, '.logicstamp');
      await mkdir(logicstampDir, { recursive: true });

      const status = {
        active: true,
        projectRoot: tempDir,
        pid: process.pid,
        startedAt: new Date().toISOString(),
        outputDir: tempDir,
      };
      await writeFile(
        join(logicstampDir, 'context_watch-status.json'),
        JSON.stringify(status)
      );

      const result = await watchStatus({ projectPath: tempDir });

      expect(result.message).toContain('refresh_snapshot');
      expect(result.message).toContain('list_bundles');
      expect(result.message).toContain('read_bundle');
    });
  });

  describe('recent logs', () => {
    it('should not include logs when includeRecentLogs is false', async () => {
      const logicstampDir = join(tempDir, '.logicstamp');
      await mkdir(logicstampDir, { recursive: true });

      // Create status file
      const status = {
        active: true,
        projectRoot: tempDir,
        pid: process.pid,
        startedAt: new Date().toISOString(),
        outputDir: tempDir,
      };
      await writeFile(
        join(logicstampDir, 'context_watch-status.json'),
        JSON.stringify(status)
      );

      // Create log file
      const logs = [
        {
          timestamp: new Date().toISOString(),
          changedFiles: ['src/Button.tsx'],
          fileCount: 1,
          durationMs: 150,
          summary: {
            modifiedContractsCount: 1,
            modifiedBundlesCount: 1,
            addedContractsCount: 0,
            removedContractsCount: 0,
          },
        },
      ];
      await writeFile(
        join(logicstampDir, 'context_watch-mode-logs.json'),
        JSON.stringify(logs)
      );

      const result = await watchStatus({
        projectPath: tempDir,
        includeRecentLogs: false,
      });

      expect(result.recentLogs).toBeUndefined();
    });

    it('should include logs when includeRecentLogs is true', async () => {
      const logicstampDir = join(tempDir, '.logicstamp');
      await mkdir(logicstampDir, { recursive: true });

      // Create status file
      const status = {
        active: true,
        projectRoot: tempDir,
        pid: process.pid,
        startedAt: new Date().toISOString(),
        outputDir: tempDir,
      };
      await writeFile(
        join(logicstampDir, 'context_watch-status.json'),
        JSON.stringify(status)
      );

      // Create log file with array of entries
      const logs = [
        {
          timestamp: new Date().toISOString(),
          changedFiles: ['src/Button.tsx'],
          fileCount: 1,
          durationMs: 150,
          summary: {
            modifiedContractsCount: 1,
            modifiedBundlesCount: 1,
            addedContractsCount: 0,
            removedContractsCount: 0,
          },
        },
      ];
      await writeFile(
        join(logicstampDir, 'context_watch-mode-logs.json'),
        JSON.stringify(logs)
      );

      const result = await watchStatus({
        projectPath: tempDir,
        includeRecentLogs: true,
      });

      expect(result.recentLogs).toBeDefined();
      expect(result.recentLogs).toHaveLength(1);
      expect(result.recentLogs![0].changedFiles).toContain('src/Button.tsx');
    });

    it('should respect logLimit parameter', async () => {
      const logicstampDir = join(tempDir, '.logicstamp');
      await mkdir(logicstampDir, { recursive: true });

      // Create status file
      const status = {
        active: true,
        projectRoot: tempDir,
        pid: process.pid,
        startedAt: new Date().toISOString(),
        outputDir: tempDir,
      };
      await writeFile(
        join(logicstampDir, 'context_watch-status.json'),
        JSON.stringify(status)
      );

      // Create log file with multiple entries
      const logs = Array.from({ length: 10 }, (_, i) => ({
        timestamp: new Date(Date.now() + i * 1000).toISOString(),
        changedFiles: [`src/Component${i}.tsx`],
        fileCount: 1,
        durationMs: 100 + i * 10,
        summary: {
          modifiedContractsCount: 1,
          modifiedBundlesCount: 1,
          addedContractsCount: 0,
          removedContractsCount: 0,
        },
      }));
      await writeFile(
        join(logicstampDir, 'context_watch-mode-logs.json'),
        JSON.stringify(logs)
      );

      const result = await watchStatus({
        projectPath: tempDir,
        includeRecentLogs: true,
        logLimit: 3,
      });

      expect(result.recentLogs).toBeDefined();
      expect(result.recentLogs).toHaveLength(3);
      // Should return the last 3 entries (most recent)
      expect(result.recentLogs![0].changedFiles[0]).toBe('src/Component7.tsx');
      expect(result.recentLogs![2].changedFiles[0]).toBe('src/Component9.tsx');
    });

    it('should return empty array when log file does not exist', async () => {
      const logicstampDir = join(tempDir, '.logicstamp');
      await mkdir(logicstampDir, { recursive: true });

      // Create status file but no log file
      const status = {
        active: true,
        projectRoot: tempDir,
        pid: process.pid,
        startedAt: new Date().toISOString(),
        outputDir: tempDir,
      };
      await writeFile(
        join(logicstampDir, 'context_watch-status.json'),
        JSON.stringify(status)
      );

      const result = await watchStatus({
        projectPath: tempDir,
        includeRecentLogs: true,
      });

      // recentLogs should be undefined since no logs exist
      expect(result.recentLogs).toBeUndefined();
    });

    it('should handle invalid log file gracefully', async () => {
      const logicstampDir = join(tempDir, '.logicstamp');
      await mkdir(logicstampDir, { recursive: true });

      // Create status file
      const status = {
        active: true,
        projectRoot: tempDir,
        pid: process.pid,
        startedAt: new Date().toISOString(),
        outputDir: tempDir,
      };
      await writeFile(
        join(logicstampDir, 'context_watch-status.json'),
        JSON.stringify(status)
      );

      // Create invalid log file
      await writeFile(
        join(logicstampDir, 'context_watch-mode-logs.json'),
        'not valid json'
      );

      const result = await watchStatus({
        projectPath: tempDir,
        includeRecentLogs: true,
      });

      // Should not throw, just return undefined logs
      expect(result.recentLogs).toBeUndefined();
    });
  });

  describe('error handling', () => {
    it('should throw error when projectPath is missing', async () => {
      await expect(watchStatus({} as any)).rejects.toThrow(
        'projectPath parameter is REQUIRED'
      );
    });

    it('should handle non-existent project path gracefully', async () => {
      const result = await watchStatus({
        projectPath: '/non/existent/path/that/should/not/exist',
      });

      expect(result.watchModeActive).toBe(false);
    });
  });

  describe('default parameter values', () => {
    it('should default includeRecentLogs to false', async () => {
      const result = await watchStatus({ projectPath: tempDir });

      expect(result.recentLogs).toBeUndefined();
    });

    it('should default logLimit to 5', async () => {
      const logicstampDir = join(tempDir, '.logicstamp');
      await mkdir(logicstampDir, { recursive: true });

      // Create status file
      const status = {
        active: true,
        projectRoot: tempDir,
        pid: process.pid,
        startedAt: new Date().toISOString(),
        outputDir: tempDir,
      };
      await writeFile(
        join(logicstampDir, 'context_watch-status.json'),
        JSON.stringify(status)
      );

      // Create log file with 10 entries
      const logs = Array.from({ length: 10 }, (_, i) => ({
        timestamp: new Date(Date.now() + i * 1000).toISOString(),
        changedFiles: [`src/Component${i}.tsx`],
        fileCount: 1,
        durationMs: 100,
        summary: {
          modifiedContractsCount: 1,
          modifiedBundlesCount: 1,
          addedContractsCount: 0,
          removedContractsCount: 0,
        },
      }));
      await writeFile(
        join(logicstampDir, 'context_watch-mode-logs.json'),
        JSON.stringify(logs)
      );

      const result = await watchStatus({
        projectPath: tempDir,
        includeRecentLogs: true,
        // logLimit not specified, should default to 5
      });

      expect(result.recentLogs).toHaveLength(5);
    });
  });
});
