/**
 * Error scenario tests for read-logicstamp-docs tool
 * These tests use mocks to test error handling paths
 */

import { jest, describe, it, expect, beforeEach, afterEach, beforeAll } from '@jest/globals';

// Create mock implementations
// Using any to avoid complex type inference issues with jest.fn()
const mockReadFileImpl: jest.Mock = jest.fn();
const mockStatImpl: jest.Mock = jest.fn();

// Mock fs/promises module using unstable_mockModule for ESM compatibility
// This MUST be done before importing the module under test
jest.unstable_mockModule('fs/promises', () => ({
  readFile: jest.fn((...args: any[]) => mockReadFileImpl(...args)),
  stat: jest.fn((...args: any[]) => mockStatImpl(...args)),
}));

// Dynamically import the module after mocks are set up
let readLogicStampDocs: typeof import('../../src/mcp/tools/read-logicstamp-docs.js').readLogicStampDocs;

beforeAll(async () => {
  // Import the module fresh after mocks are set up
  const module = await import('../../src/mcp/tools/read-logicstamp-docs.js');
  readLogicStampDocs = module.readLogicStampDocs;
});

describe('readLogicStampDocs error scenarios', () => {
  beforeEach(() => {
    // Reset mocks before each test
    mockReadFileImpl.mockReset();
    mockStatImpl.mockReset();
  });

  afterEach(() => {
    // Restore mocks after each test
    jest.restoreAllMocks();
  });

  it('should throw error with helpful message when all file read strategies fail', async () => {
    // Mock readFile to fail for all strategies
    (mockReadFileImpl as any).mockRejectedValue(new Error('File not found'));
    (mockStatImpl as any).mockRejectedValue(new Error('File not found'));

    try {
      await readLogicStampDocs();
      fail('Should have thrown error');
    } catch (error: any) {
      expect(error.message).toContain('Could not find documentation file');
      expect(error.message).toContain('docs/logicstamp-for-llms.md');
      expect(error.message).toContain('tried multiple strategies');
    }
  });

  it('should include error details in error message when file read fails', async () => {
    // Mock all file operations to fail
    (mockReadFileImpl as any).mockRejectedValue(new Error('ENOENT: no such file'));
    (mockStatImpl as any).mockRejectedValue(new Error('ENOENT: no such file'));

    try {
      await readLogicStampDocs();
      fail('Should have thrown error');
    } catch (error: any) {
      expect(error.message).toContain('Failed to read LogicStamp documentation');
      expect(error.message).toContain('docs/logicstamp-for-llms.md');
      expect(error.message).toContain('logicstamp-mcp package');
    }
  });

  it('should handle Error objects correctly in catch block', async () => {
    const testError = new Error('Test error message');
    (mockReadFileImpl as any).mockRejectedValue(testError);
    (mockStatImpl as any).mockRejectedValue(testError);

    try {
      await readLogicStampDocs();
      fail('Should have thrown error');
    } catch (error: any) {
      expect(error.message).toContain('Failed to read LogicStamp documentation');
      // The error message is wrapped, so we check that it contains the error handling structure
      expect(error.message).toContain('Error:');
      // The original error message might be nested in the wrapped error
      expect(error instanceof Error).toBe(true);
    }
  });

  it('should handle non-Error objects in catch block', async () => {
    // Test with a string instead of Error object
    (mockReadFileImpl as any).mockRejectedValue('String error');
    (mockStatImpl as any).mockRejectedValue('String error');

    try {
      await readLogicStampDocs();
      fail('Should have thrown error');
    } catch (error: any) {
      expect(error.message).toContain('Failed to read LogicStamp documentation');
      // The error handling converts non-Error objects to strings
      expect(error instanceof Error).toBe(true);
      expect(typeof error.message).toBe('string');
    }
  });

  it('should try multiple fallback strategies when first strategy fails', async () => {
    // Strategy 1 fails
    (mockReadFileImpl as any).mockRejectedValueOnce(new Error('Strategy 1 failed'));
    // Strategy 2 fails (findPackageRoot will also fail)
    (mockStatImpl as any).mockRejectedValue(new Error('Package root not found'));
    (mockReadFileImpl as any).mockRejectedValueOnce(new Error('Strategy 2 failed'));
    // Strategy 3 fails
    (mockReadFileImpl as any).mockRejectedValueOnce(new Error('Strategy 3 failed'));

    try {
      await readLogicStampDocs();
      fail('Should have thrown error');
    } catch (error: any) {
      expect(error.message).toContain('Could not find documentation file');
      expect(error.message).toContain('tried multiple strategies');
      // Verify that multiple readFile calls were attempted
      expect(mockReadFileImpl.mock.calls.length).toBeGreaterThan(1);
    }
  });
});
