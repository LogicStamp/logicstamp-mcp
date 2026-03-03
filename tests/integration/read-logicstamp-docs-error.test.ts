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

  // Note: Line 93 (invalid docPath validation) is defensive code that's difficult to test
  // because readDocFile is private and always called with the hardcoded path 'docs/logicstamp-for-llms.md'
  // from readLogicStampDocs(). This branch is essentially unreachable in normal operation but serves
  // as defensive programming if the code is refactored in the future. To test it, we would need to
  // either export readDocFile (not ideal) or use complex module mocking (not worth it for defensive code).

  it('should handle findPackageRoot when package.json name does not match', async () => {
    // This tests line 72: the FALSE branch where package.json exists but name doesn't match
    // Strategy 1 fails
    (mockReadFileImpl as any).mockRejectedValueOnce(new Error('Strategy 1 failed'));
    
    // Strategy 2: findPackageRoot finds package.json but name doesn't match
    // Mock stat to succeed (package.json exists at multiple levels)
    (mockStatImpl as any).mockResolvedValue({});
    
    // Mock readFile: first call for wrong package.json, then continue searching up
    let packageJsonCallCount = 0;
    (mockReadFileImpl as any).mockImplementation((path: string) => {
      if (path.includes('package.json')) {
        packageJsonCallCount++;
        // First package.json has wrong name (tests line 72 FALSE branch)
        if (packageJsonCallCount === 1) {
          return Promise.resolve(JSON.stringify({ name: 'wrong-package' }));
        }
        // Eventually should find correct package or fail
        return Promise.reject(new Error('No more package.json files'));
      }
      // Doc file read fails
      return Promise.reject(new Error('File not found'));
    });

    try {
      await readLogicStampDocs();
      fail('Should have thrown error');
    } catch (error: any) {
      // Should eventually fail when all strategies are exhausted
      expect(error.message).toContain('Failed to read LogicStamp documentation');
      // Verify that package.json was checked (tests the loop continuation branch)
      expect(packageJsonCallCount).toBeGreaterThan(0);
    }
  });

  it('should handle findPackageRoot when package.json read fails', async () => {
    // Strategy 1 fails
    (mockReadFileImpl as any).mockRejectedValueOnce(new Error('Strategy 1 failed'));
    
    // Strategy 2: findPackageRoot - stat succeeds but readFile fails
    (mockStatImpl as any).mockResolvedValue({});
    
    // Mock readFile for package.json to fail (tests the catch block in findPackageRoot)
    (mockReadFileImpl as any).mockImplementation((path: string) => {
      if (path.includes('package.json')) {
        return Promise.reject(new Error('Cannot read package.json'));
      }
      return Promise.reject(new Error('File not found'));
    });

    try {
      await readLogicStampDocs();
      fail('Should have thrown error');
    } catch (error: any) {
      expect(error.message).toContain('Failed to read LogicStamp documentation');
    }
  });

  it('should handle Strategy 2 where findPackageRoot succeeds but doc file read fails', async () => {
    // This tests lines 113-115: Strategy 2 where findPackageRoot succeeds but readFile for doc fails
    // Strategy 1 fails
    (mockReadFileImpl as any).mockRejectedValueOnce(new Error('Strategy 1 failed'));
    
    // Strategy 2: findPackageRoot succeeds (finds correct package.json)
    (mockStatImpl as any).mockResolvedValue({});
    
    let callCount = 0;
    (mockReadFileImpl as any).mockImplementation((path: string) => {
      callCount++;
      if (path.includes('package.json')) {
        // Return correct package name (findPackageRoot succeeds)
        return Promise.resolve(JSON.stringify({ name: 'logicstamp-mcp' }));
      }
      // Doc file read fails (tests lines 113-115 branch)
      return Promise.reject(new Error('Doc file not found'));
    });

    try {
      await readLogicStampDocs();
      fail('Should have thrown error');
    } catch (error: any) {
      expect(error.message).toContain('Failed to read LogicStamp documentation');
      // Verify that findPackageRoot was called (package.json read happened)
      const packageJsonReads = mockReadFileImpl.mock.calls.filter((call: any[]) => 
        call[0]?.includes('package.json')
      );
      expect(packageJsonReads.length).toBeGreaterThan(0);
    }
  });

  it('should handle findPackageRoot loop continuation when parent directory changes', async () => {
    // This tests the loop in findPackageRoot where it continues searching up directories
    // Strategy 1 fails
    (mockReadFileImpl as any).mockRejectedValueOnce(new Error('Strategy 1 failed'));
    
    // Strategy 2: Multiple package.json files exist but none match
    (mockStatImpl as any).mockResolvedValue({});
    
    let packageJsonCallCount = 0;
    (mockReadFileImpl as any).mockImplementation((path: string) => {
      if (path.includes('package.json')) {
        packageJsonCallCount++;
        // All package.json files have wrong name - tests loop continuation
        return Promise.resolve(JSON.stringify({ name: `wrong-package-${packageJsonCallCount}` }));
      }
      return Promise.reject(new Error('File not found'));
    });

    try {
      await readLogicStampDocs();
      fail('Should have thrown error');
    } catch (error: any) {
      expect(error.message).toContain('Failed to read LogicStamp documentation');
      // Verify multiple package.json files were checked (tests loop continuation)
      expect(packageJsonCallCount).toBeGreaterThan(0);
    }
  });
});
