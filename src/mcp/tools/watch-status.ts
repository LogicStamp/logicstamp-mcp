/**
 * Tool: logicstamp_watch_status
 * Check if watch mode is active and get status information
 */

import { readFile, access } from 'fs/promises';
import { join, resolve } from 'path';
import { constants } from 'fs';
import type { WatchStatusInput, WatchStatusOutput, WatchStatus, WatchLogEntry } from '../../types/schemas.js';

/**
 * Check if a file exists
 */
async function exists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a process is still running by PID
 */
function isProcessRunning(pid: number): boolean {
  try {
    // Sending signal 0 tests if process exists without killing it
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read and parse the watch status file
 */
async function readWatchStatus(projectPath: string): Promise<WatchStatus | null> {
  const statusPath = join(projectPath, '.logicstamp', 'context_watch-status.json');

  if (!(await exists(statusPath))) {
    return null;
  }

  try {
    const content = await readFile(statusPath, 'utf-8');
    const status = JSON.parse(content) as WatchStatus;

    // Verify the process is still running
    if (status.pid && !isProcessRunning(status.pid)) {
      // Status file exists but process is dead - stale status
      return null;
    }

    return status;
  } catch {
    return null;
  }
}

/**
 * Read recent watch log entries
 */
async function readWatchLogs(projectPath: string, limit: number): Promise<WatchLogEntry[]> {
  const logsPath = join(projectPath, '.logicstamp', 'context_watch-mode-logs.json');

  if (!(await exists(logsPath))) {
    return [];
  }

  try {
    const content = await readFile(logsPath, 'utf-8');
    // The log file may contain multiple JSON objects (one per line) or be an array
    // Try parsing as array first, then as newline-delimited JSON
    let logs: WatchLogEntry[];

    try {
      const parsed = JSON.parse(content);
      logs = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      // Try newline-delimited JSON
      logs = content
        .split('\n')
        .filter(line => line.trim())
        .map(line => JSON.parse(line));
    }

    // Return the most recent entries
    return logs.slice(-limit);
  } catch {
    return [];
  }
}

export async function watchStatus(input: WatchStatusInput): Promise<WatchStatusOutput> {
  if (!input.projectPath) {
    throw new Error(
      'projectPath parameter is REQUIRED but was not provided. ' +
      'Please provide the absolute path to the project root.'
    );
  }

  const projectPath = resolve(input.projectPath);
  const includeRecentLogs = input.includeRecentLogs ?? false;
  const logLimit = input.logLimit ?? 5;

  // Read watch status
  const status = await readWatchStatus(projectPath);
  const watchModeActive = status !== null && status.active === true;

  // Build output
  const output: WatchStatusOutput = {
    projectPath,
    watchModeActive,
    message: watchModeActive
      ? `Watch mode is ACTIVE (PID: ${status!.pid}, started: ${status!.startedAt}). Context bundles are being kept fresh automatically. You can skip calling refresh_snapshot - just use list_bundles and read_bundle with the existing context files.`
      : 'Watch mode is NOT active. Context files may be stale. Consider running refresh_snapshot or starting watch mode with `stamp context --watch`.',
  };

  if (watchModeActive && status) {
    output.status = status;
  }

  // Include recent logs if requested
  if (includeRecentLogs) {
    const logs = await readWatchLogs(projectPath, logLimit);
    if (logs.length > 0) {
      output.recentLogs = logs;
    }
  }

  return output;
}
