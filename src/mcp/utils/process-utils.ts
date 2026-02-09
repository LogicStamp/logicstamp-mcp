/**
 * Utility functions for process management
 */

/**
 * Check if a process is still running by PID
 * 
 * Uses signal 0 to test if process exists without killing it.
 * On Windows, this may throw an error if the process doesn't exist
 * or if we don't have permission to check it.
 * 
 * @param pid - Process ID to check
 * @returns true if process is running, false otherwise
 */
export function isProcessRunning(pid: number): boolean {
  try {
    // Sending signal 0 tests if process exists without killing it
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
