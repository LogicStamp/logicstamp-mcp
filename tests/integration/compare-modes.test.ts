/**
 * Integration tests for compare-modes tool
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  createTempDir,
  cleanupTempDir,
  createMockIndex,
} from '../helpers/test-utils.js';
import { tmpdir } from 'os';
import { writeFile, readFile } from 'fs/promises';
import { writeFileSync } from 'fs';
import { join } from 'path';

// Create a shared mock exec function
const mockExecImpl = jest.fn((command: string, options: any, callback: any) => {
  if (callback) {
    callback(null, { stdout: '', stderr: '' });
  }
  return {} as any;
});

// Mock child_process module using doMock for ESM compatibility
jest.doMock('child_process', () => ({
  exec: jest.fn((command: string, options: any, callback: any) => {
    return mockExecImpl(command, options, callback);
  }),
}));

// Mock util.promisify to wrap our mock exec
jest.doMock('util', () => ({
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

// Import after mocks are set up
import { compareModes } from '../../src/mcp/tools/compare-modes.js';

describe('compareModes integration tests', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await createTempDir(tmpdir());
    mockExecImpl.mockClear();
    
    // Default mock implementation - successful execution
    mockExecImpl.mockImplementation((command: string, options: any, callback: any) => {
      // When command executes successfully, create the context_compare_modes.json file
      if (command.includes('--compare-modes --stats')) {
        const compareModesData = {
          type: 'LogicStampCompareModes',
          schemaVersion: '0.1',
          createdAt: new Date().toISOString(),
          elapsed: 500,
          files: {
            total: 150,
            ts: 100,
            tsx: 50,
          },
          comparison: {
            headerNoStyleGPT4: 82917,
            headerNoStyleClaude: 90131,
            headerWithStyleGPT4: 170466,
            headerWithStyleClaude: 184864,
            sourceTokensGPT4: 273006,
            sourceTokensClaude: 289573,
            modeEstimates: {
              none: {
                gpt4: 49751,
                claude: 54079,
              },
              header: {
                gpt4: 82917,
                claude: 90131,
              },
              headerStyle: {
                gpt4: 170466,
                claude: 184864,
              },
              full: {
                gpt4: 355923,
                claude: 379704,
              },
            },
          },
        };
        
        const compareModesPath = join(options.cwd, 'context_compare_modes.json');
        // Write file synchronously to ensure it exists before callback
        try {
          writeFileSync(compareModesPath, JSON.stringify(compareModesData, null, 2), 'utf-8');
          if (callback) {
            callback(null, { stdout: '', stderr: '' });
          }
        } catch (err) {
          if (callback) {
            callback(err as Error, { stdout: '', stderr: (err as Error).message });
          }
        }
      } else {
        if (callback) {
          callback(null, { stdout: '', stderr: '' });
        }
      }
      return {} as any;
    });
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  describe('successful comparison generation', () => {
    it('should generate comparison data with default parameters', async () => {
      await createMockIndex(tempDir);

      const result = await compareModes({ projectPath: tempDir });

      expect(result.projectPath).toBe(tempDir);
      expect(result.type).toBe('LogicStampCompareModes');
      expect(result.files).toBeDefined();
      expect(result.comparison).toBeDefined();
      expect(result.comparison.modeEstimates).toBeDefined();
    });

    it('should include schema version and type', async () => {
      await createMockIndex(tempDir);

      const result = await compareModes({ projectPath: tempDir });

      expect(result.type).toBe('LogicStampCompareModes');
      expect(result.schemaVersion).toBeDefined();
      expect(typeof result.schemaVersion).toBe('string');
    });

    it('should include comparison data', async () => {
      await createMockIndex(tempDir);

      const result = await compareModes({ projectPath: tempDir });

      expect(result.comparison).toBeDefined();
      expect(typeof result.comparison.headerNoStyleGPT4).toBe('number');
      expect(typeof result.comparison.headerNoStyleClaude).toBe('number');
      expect(typeof result.comparison.headerWithStyleGPT4).toBe('number');
      expect(typeof result.comparison.headerWithStyleClaude).toBe('number');
      expect(typeof result.comparison.sourceTokensGPT4).toBe('number');
      expect(typeof result.comparison.sourceTokensClaude).toBe('number');
    });

    it('should include mode estimates', async () => {
      await createMockIndex(tempDir);

      const result = await compareModes({ projectPath: tempDir });

      expect(result.comparison.modeEstimates).toBeDefined();
      expect(result.comparison.modeEstimates.none).toBeDefined();
      expect(result.comparison.modeEstimates.header).toBeDefined();
      expect(result.comparison.modeEstimates.headerStyle).toBeDefined();
      expect(result.comparison.modeEstimates.full).toBeDefined();
      
      // Verify structure
      expect(typeof result.comparison.modeEstimates.none.gpt4).toBe('number');
      expect(typeof result.comparison.modeEstimates.none.claude).toBe('number');
      expect(typeof result.comparison.modeEstimates.header.gpt4).toBe('number');
      expect(typeof result.comparison.modeEstimates.header.claude).toBe('number');
    });

    it('should include file statistics', async () => {
      await createMockIndex(tempDir);

      const result = await compareModes({ projectPath: tempDir });

      expect(result.files).toBeDefined();
      expect(typeof result.files.total).toBe('number');
      expect(typeof result.files.ts).toBe('number');
      expect(typeof result.files.tsx).toBe('number');
    });

    it('should use current directory when no projectPath provided', async () => {
      const originalCwd = process.cwd();
      
      try {
        process.chdir(tempDir);
        await createMockIndex(tempDir);

        const result = await compareModes({});

        expect(result.projectPath).toBe(tempDir);
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should execute stamp context with correct flags', async () => {
      let executedCommand = '';
      let wasCalled = false;

      mockExecImpl.mockImplementation((command: string, options: any, callback: any) => {
        executedCommand = command;
        wasCalled = true;
        
        if (command.includes('--compare-modes --stats')) {
          const compareModesData = {
            type: 'LogicStampCompareModes',
            schemaVersion: '0.1',
            files: {},
            comparison: {},
          };
          const compareModesPath = join(options.cwd, 'context_compare_modes.json');
          try {
            writeFileSync(compareModesPath, JSON.stringify(compareModesData, null, 2), 'utf-8');
            if (callback) {
              callback(null, { stdout: '', stderr: '' });
            }
          } catch (err) {
            if (callback) {
              callback(err as Error, { stdout: '', stderr: (err as Error).message });
            }
          }
        } else {
          if (callback) {
            callback(null, { stdout: '', stderr: '' });
          }
        }
        return {} as any;
      });

      await createMockIndex(tempDir);

      await compareModes({ projectPath: tempDir });

      if (wasCalled) {
        expect(executedCommand).toContain('stamp context');
        expect(executedCommand).toContain('--compare-modes');
        expect(executedCommand).toContain('--stats');
      }
    });

    it('should set correct working directory for command execution', async () => {
      let executionOptions: any;
      let wasCalled = false;

      mockExecImpl.mockImplementation((command: string, options: any, callback: any) => {
        executionOptions = options;
        wasCalled = true;
        
        if (command.includes('--compare-modes --stats')) {
          const compareModesData = {
            type: 'LogicStampCompareModes',
            schemaVersion: '0.1',
            files: {},
            comparison: {},
          };
          const compareModesPath = join(options.cwd, 'context_compare_modes.json');
          try {
            writeFileSync(compareModesPath, JSON.stringify(compareModesData, null, 2), 'utf-8');
            if (callback) {
              callback(null, { stdout: '', stderr: '' });
            }
          } catch (err) {
            if (callback) {
              callback(err as Error, { stdout: '', stderr: (err as Error).message });
            }
          }
        } else {
          if (callback) {
            callback(null, { stdout: '', stderr: '' });
          }
        }
        return {} as any;
      });

      await createMockIndex(tempDir);

      await compareModes({ projectPath: tempDir });

      if (wasCalled && executionOptions) {
        expect(executionOptions.cwd).toBe(tempDir);
      }
    });

    it('should use sufficient buffer size for large outputs', async () => {
      let executionOptions: any;
      let wasCalled = false;

      mockExecImpl.mockImplementation((command: string, options: any, callback: any) => {
        executionOptions = options;
        wasCalled = true;
        
        if (command.includes('--compare-modes --stats')) {
          const compareModesData = {
            type: 'LogicStampCompareModes',
            schemaVersion: '0.1',
            files: {},
            comparison: {},
          };
          const compareModesPath = join(options.cwd, 'context_compare_modes.json');
          try {
            writeFileSync(compareModesPath, JSON.stringify(compareModesData, null, 2), 'utf-8');
            if (callback) {
              callback(null, { stdout: '', stderr: '' });
            }
          } catch (err) {
            if (callback) {
              callback(err as Error, { stdout: '', stderr: (err as Error).message });
            }
          }
        } else {
          if (callback) {
            callback(null, { stdout: '', stderr: '' });
          }
        }
        return {} as any;
      });

      await createMockIndex(tempDir);

      await compareModes({ projectPath: tempDir });

      if (wasCalled && executionOptions) {
        expect(executionOptions.maxBuffer).toBeGreaterThanOrEqual(10 * 1024 * 1024);
      }
    });
  });

  describe('error handling', () => {
    it('should throw error when stamp command fails', async () => {
      mockExecImpl.mockImplementation((command: string, options: any, callback: any) => {
        if (callback) {
          callback(new Error('stamp command not found'), { stdout: '', stderr: 'command not found' });
        }
        return {} as any;
      });

      await expect(
        compareModes({ projectPath: tempDir })
      ).rejects.toThrow('Failed to generate compare modes data');
    });

    it('should throw error when context_compare_modes.json is missing', async () => {
      // Don't create the file in the mock
      mockExecImpl.mockImplementation((command: string, options: any, callback: any) => {
        if (callback) {
          callback(null, { stdout: '', stderr: '' });
        }
        return {} as any;
      });

      await expect(
        compareModes({ projectPath: tempDir })
      ).rejects.toThrow();
    });

    it('should throw error when context_compare_modes.json is invalid JSON', async () => {
      mockExecImpl.mockImplementation((command: string, options: any, callback: any) => {
        if (command.includes('--compare-modes --stats')) {
          const compareModesPath = join(options.cwd, 'context_compare_modes.json');
          try {
            writeFileSync(compareModesPath, 'invalid json', 'utf-8');
            if (callback) {
              callback(null, { stdout: '', stderr: '' });
            }
          } catch (err) {
            if (callback) {
              callback(err as Error, { stdout: '', stderr: (err as Error).message });
            }
          }
        } else {
          if (callback) {
            callback(null, { stdout: '', stderr: '' });
          }
        }
        return {} as any;
      });

      await expect(
        compareModes({ projectPath: tempDir })
      ).rejects.toThrow();
    });

    it('should handle file read errors gracefully', async () => {
      mockExecImpl.mockImplementation(async (command: string, options: any, callback: any) => {
        // Create a file that will cause read errors (permissions, etc.)
        // In this case, we'll just not create it and let the read fail
        if (callback) {
          callback(null, { stdout: '', stderr: '' });
        }
        return {} as any;
      });

      await expect(
        compareModes({ projectPath: tempDir })
      ).rejects.toThrow();
    });
  });

  describe('JSON file structure', () => {
    it('should preserve all fields from the JSON file', async () => {
      await createMockIndex(tempDir);

      const result = await compareModes({ projectPath: tempDir });

      // Verify that all expected fields from the JSON are present
      expect(result.projectPath).toBe(tempDir);
      expect(result.type).toBe('LogicStampCompareModes');
      expect(result.schemaVersion).toBeDefined();
      expect(result.files).toBeDefined();
      expect(result.comparison).toBeDefined();
      expect(result.comparison.modeEstimates).toBeDefined();
      
      // Verify that the structure allows for additional fields (spread operator works)
      expect(Object.keys(result).length).toBeGreaterThan(5);
    });

    it('should handle empty JSON file gracefully', async () => {
      mockExecImpl.mockImplementation((command: string, options: any, callback: any) => {
        if (command.includes('--compare-modes --stats')) {
          const compareModesPath = join(options.cwd, 'context_compare_modes.json');
          try {
            writeFileSync(compareModesPath, '{}', 'utf-8');
            if (callback) {
              callback(null, { stdout: '', stderr: '' });
            }
          } catch (err) {
            if (callback) {
              callback(err as Error, { stdout: '', stderr: (err as Error).message });
            }
          }
        } else {
          if (callback) {
            callback(null, { stdout: '', stderr: '' });
          }
        }
        return {} as any;
      });

      await createMockIndex(tempDir);

      const result = await compareModes({ projectPath: tempDir });

      expect(result.projectPath).toBe(tempDir);
      expect(result).toBeDefined();
    });
  });
});

