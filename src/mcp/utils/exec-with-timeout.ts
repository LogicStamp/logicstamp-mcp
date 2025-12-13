/**
 * Utility for executing shell commands with timeout protection
 */

import { exec, ChildProcess } from 'child_process';

export interface ExecOptions {
  cwd?: string;
  maxBuffer?: number;
}

/**
 * Execute a command with a timeout to prevent indefinite hanging
 * @param command - Command to execute
 * @param options - Execution options (cwd, maxBuffer)
 * @param timeoutMs - Timeout in milliseconds (default: 15 minutes)
 * @returns Promise resolving to stdout/stderr
 */
export async function execWithTimeout(
  command: string,
  options: ExecOptions = {},
  timeoutMs: number = 15 * 60 * 1000 // 15 minutes default
): Promise<{ stdout: string; stderr: string }> {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    let childProcess: ChildProcess | null = null;
    let timeoutId: NodeJS.Timeout | null = null;
    let isResolved = false;

    // Set up timeout
    timeoutId = setTimeout(() => {
      if (!isResolved && childProcess) {
        isResolved = true;
        // Try to kill the process
        try {
          if (process.platform === 'win32') {
            // On Windows, kill the process tree
            exec(`taskkill /pid ${childProcess.pid} /T /F`, () => {});
          } else {
            // On Unix, kill the process group
            childProcess.kill('SIGTERM');
          }
        } catch (killError) {
          // Ignore kill errors - process may have already terminated
        }
        reject(new Error(
          `Command timed out after ${timeoutMs}ms: ${command}\n` +
          `Working directory: ${options.cwd || process.cwd()}`
        ));
      }
    }, timeoutMs);

    // Execute the command
    childProcess = exec(command, {
      cwd: options.cwd,
      maxBuffer: options.maxBuffer || 10 * 1024 * 1024, // 10MB default
    }, (error, stdout, stderr) => {
      if (isResolved) {
        return; // Already handled by timeout
      }
      isResolved = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

        if (error) {
          // Enhance error with context while preserving original information
          const enhancedError = new Error(
            `Command failed: ${command}\n` +
            `Working directory: ${options.cwd || process.cwd()}\n` +
            `Original error: ${error.message}`
          );
          // Preserve original error properties
          if ('code' in error) {
            (enhancedError as any).code = (error as any).code;
          }
          (enhancedError as any).stdout = stdout;
          (enhancedError as any).stderr = stderr;
          reject(enhancedError);
        } else {
          resolve({ stdout, stderr });
        }
      });
  });
}

/**
 * Execute a command with a longer timeout (for operations that take longer)
 * @param command - Command to execute
 * @param options - Execution options
 * @param timeoutMs - Timeout in milliseconds (default: 30 minutes)
 */
export async function execWithLongTimeout(
  command: string,
  options: ExecOptions = {},
  timeoutMs: number = 30 * 60 * 1000 // 30 minutes default
): Promise<{ stdout: string; stderr: string }> {
  return execWithTimeout(command, options, timeoutMs);
}
