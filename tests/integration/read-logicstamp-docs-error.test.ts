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

  it('should reject invalid docPath in readDocFile (line 93)', async () => {
    // This tests line 92-98: the invalid docPath validation branch
    // Import readDocFile which is now exported for testing
    const { readDocFile } = await import('../../src/mcp/tools/read-logicstamp-docs.js');
    
    try {
      await readDocFile('invalid/path.md');
      fail('Should have thrown error for invalid docPath');
    } catch (error: any) {
      expect(error.message).toContain('Invalid documentation path requested');
      expect(error.message).toContain('invalid/path.md');
      expect(error.message).toContain('docs/logicstamp-for-llms.md');
    }
  });

  it('should handle Strategy 2 success when Strategy 1 fails', async () => {
    // This tests line 109-115: Strategy 1 fails, Strategy 2 succeeds via findPackageRoot
    // Also tests line 71 TRUE branch: when package.json.name === 'logicstamp-mcp'
    // Strategy 1 fails
    (mockReadFileImpl as any).mockRejectedValueOnce(new Error('Strategy 1 failed'));
    
    // Strategy 2: findPackageRoot succeeds (finds correct package.json)
    (mockStatImpl as any).mockResolvedValue({});
    
    let callCount = 0;
    (mockReadFileImpl as any).mockImplementation((path: string) => {
      callCount++;
      if (path.includes('package.json')) {
        // Return correct package name (tests line 71 TRUE branch - package name matches)
        return Promise.resolve(JSON.stringify({ name: 'logicstamp-mcp' }));
      }
      // Second readFile call (for doc file) succeeds
      if (callCount === 2) {
        return Promise.resolve('# LogicStamp Documentation\n\nContent here');
      }
      return Promise.reject(new Error('Unexpected call'));
    });

    const result = await readLogicStampDocs();
    expect(result).toBeDefined();
    expect(result.type).toBe('LogicStampDocs');
    expect(result.docs.forLLMs).toContain('LogicStamp Documentation');
  });

  it('should handle Strategy 3 success when Strategies 1 and 2 fail', async () => {
    // This tests line 116-121: Strategies 1 and 2 fail, Strategy 3 succeeds via process.cwd()
    // Strategy 1 fails
    (mockReadFileImpl as any).mockRejectedValueOnce(new Error('Strategy 1 failed'));
    
    // Strategy 2: findPackageRoot fails (no package.json found)
    (mockStatImpl as any).mockRejectedValue(new Error('File not found'));
    
    let callCount = 0;
    (mockReadFileImpl as any).mockImplementation((path: string) => {
      callCount++;
      // Strategy 3 (process.cwd() path) succeeds
      if (path.includes(process.cwd())) {
        return Promise.resolve('# LogicStamp Documentation\n\nContent from cwd');
      }
      return Promise.reject(new Error('Strategy failed'));
    });

    const result = await readLogicStampDocs();
    expect(result).toBeDefined();
    expect(result.type).toBe('LogicStampDocs');
    expect(result.docs.forLLMs).toContain('LogicStamp Documentation');
  });

  it('should handle error message with not attempted branches (lines 128-129)', async () => {
    // This tests lines 128-129: 'not attempted' branches when Strategy 2 or 3 aren't attempted
    // Strategy 1 fails immediately, Strategy 2 fails immediately (findPackageRoot throws before reading)
    (mockReadFileImpl as any).mockRejectedValueOnce(new Error('Strategy 1 failed'));
    
    // Strategy 2: findPackageRoot throws error immediately (before reading doc file)
    (mockStatImpl as any).mockRejectedValue(new Error('Package root not found'));
    
    // Strategy 3 also fails
    (mockReadFileImpl as any).mockRejectedValue(new Error('Strategy 3 failed'));

    const { readDocFile } = await import('../../src/mcp/tools/read-logicstamp-docs.js');
    
    try {
      await readDocFile('docs/logicstamp-for-llms.md');
      fail('Should have thrown error');
    } catch (error: any) {
      expect(error.message).toContain('Could not find documentation file');
      // Should show 'not attempted' for Strategy 2 if findPackageRoot fails before reading
      // The exact message depends on which strategies were attempted
      expect(error.message).toContain('tried multiple strategies');
    }
  });

  it('should handle non-Error objects in catch block (line 213)', async () => {
    // This tests line 213: error instanceof Error ? error.message : String(error)
    // Mock readFile to throw a non-Error object (string)
    (mockReadFileImpl as any).mockRejectedValue('String error message');
    (mockStatImpl as any).mockRejectedValue('String error');

    try {
      await readLogicStampDocs();
      fail('Should have thrown error');
    } catch (error: any) {
      expect(error.message).toContain('Failed to read LogicStamp documentation');
      // The error message should include the stringified error
      expect(error.message).toContain('Error:');
      expect(error instanceof Error).toBe(true);
    }
  });

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

  it('should handle findPackageRoot when reaching filesystem root', async () => {
    // This tests line 79: the branch where parent === current (filesystem root reached)
    // Strategy 1 fails
    (mockReadFileImpl as any).mockRejectedValueOnce(new Error('Strategy 1 failed'));
    
    // Strategy 2: findPackageRoot reaches filesystem root
    // Mock stat to fail (no package.json found)
    (mockStatImpl as any).mockRejectedValue(new Error('File not found'));
    
    // Mock readFile to simulate reaching root (parent === current)
    // We need to simulate the loop breaking condition
    let statCallCount = 0;
    (mockStatImpl as any).mockImplementation((path: string) => {
      statCallCount++;
      // After a few attempts, simulate reaching root by making stat fail consistently
      // This will cause the loop to eventually break when parent === current
      return Promise.reject(new Error('File not found'));
    });
    
    (mockReadFileImpl as any).mockRejectedValue(new Error('File not found'));

    try {
      await readLogicStampDocs();
      fail('Should have thrown error');
    } catch (error: any) {
      // Should eventually fail when package root cannot be found
      expect(error.message).toContain('Failed to read LogicStamp documentation');
    }
  });
});
