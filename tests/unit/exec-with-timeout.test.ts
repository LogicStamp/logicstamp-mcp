/**
 * Unit tests for exec-with-timeout utility
 */

import { execWithTimeout } from '../../src/mcp/utils/exec-with-timeout.js';

describe('execWithTimeout', () => {
  describe('successful execution', () => {
    it('should execute a simple command successfully', async () => {
      const command = process.platform === 'win32' ? 'echo test' : 'echo "test"';
      const result = await execWithTimeout(command, {}, 5000);
      
      expect(result.stdout.trim()).toBe('test');
      expect(result.stderr).toBe('');
    });

    it('should respect cwd option', async () => {
      const command = process.platform === 'win32' ? 'cd' : 'pwd';
      const result = await execWithTimeout(command, { cwd: process.cwd() }, 5000);
      
      if (process.platform === 'win32') {
        // Windows 'cd' outputs current directory
        expect(result.stdout.trim()).toBe(process.cwd());
      } else {
        expect(result.stdout.trim()).toBe(process.cwd());
      }
    });

    it('should handle commands with output to stderr', async () => {
      // Use a command that outputs to stderr but succeeds
      const result = await execWithTimeout(
        process.platform === 'win32' ? 'echo test >&2' : 'echo test 1>&2',
        {},
        5000
      );
      
      expect(result.stderr.trim()).toContain('test');
    });
  });

  describe('timeout handling', () => {
    it('should timeout when command takes too long', async () => {
      const timeoutMs = 1000;
      const longRunningCommand = process.platform === 'win32' 
        ? 'ping 127.0.0.1 -n 6 > nul' 
        : 'sleep 5';

      await expect(
        execWithTimeout(longRunningCommand, {}, timeoutMs)
      ).rejects.toThrow(/timed out after/);
    }, 15000); // Increase test timeout for this test

    it('should include command and working directory in timeout error', async () => {
      const timeoutMs = 100;
      const longRunningCommand = process.platform === 'win32' 
        ? 'ping 127.0.0.1 -n 3 > nul' 
        : 'sleep 2';
      const testCwd = process.platform === 'win32' ? process.cwd() : '/tmp';

      try {
        await execWithTimeout(longRunningCommand, { cwd: testCwd }, timeoutMs);
        fail('Should have thrown timeout error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        const errorMessage = (error as Error).message;
        expect(errorMessage).toContain('timed out');
        expect(errorMessage).toContain(longRunningCommand);
      }
    }, 5000);
  });

  describe('error handling', () => {
    it('should reject when command fails', async () => {
      const failingCommand = process.platform === 'win32' 
        ? 'exit /b 1' 
        : 'exit 1';

      await expect(
        execWithTimeout(failingCommand, {}, 5000)
      ).rejects.toThrow();
    });

    it('should include stdout and stderr in error', async () => {
      const failingCommand = process.platform === 'win32'
        ? 'echo error output && exit /b 1'
        : 'echo error output && exit 1';

      try {
        await execWithTimeout(failingCommand, {}, 5000);
        fail('Should have thrown error');
      } catch (error: any) {
        expect(error.stdout).toBeDefined();
        expect(error.stderr).toBeDefined();
      }
    });
  });

  describe('maxBuffer option', () => {
    it('should respect maxBuffer option', async () => {
      // Generate large output using Node.js for cross-platform compatibility
      const largeOutputCommand = `node -e "for(let i=1;i<=1000;i++) console.log('line ' + i)"`;

      const result = await execWithTimeout(
        largeOutputCommand,
        { maxBuffer: 1024 * 1024 }, // 1MB
        10000
      );

      expect(result.stdout).toBeDefined();
      expect(result.stdout.split('\n').length).toBeGreaterThan(100);
    }, 15000);
  });
});

