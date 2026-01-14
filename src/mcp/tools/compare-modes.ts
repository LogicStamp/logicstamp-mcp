/**
 * Tool: logicstamp_compare_modes
 * Generate comparison data file for MCP (Model Context Protocol) integration
 * Calls `stamp context --compare-modes --stats` and reads the generated JSON file
 */

import { readFile, rm, access } from 'fs/promises';
import { join, resolve } from 'path';
import { constants } from 'fs';
import type { CompareModesInput, CompareModesOutput } from '../../types/schemas.js';
import { execWithLongTimeout } from '../utils/exec-with-timeout.js';

/**
 * Check if a file or directory exists
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
 * Detect if .logicstamp cache is corrupted or has path mismatch
 * Returns true if cache should be cleaned
 */
async function shouldCleanCache(projectPath: string): Promise<boolean> {
  const logicstampDir = join(projectPath, '.logicstamp');
  
  // If cache doesn't exist, nothing to clean
  if (!(await exists(logicstampDir))) {
    return false;
  }
  
  // Check for common corruption indicators:
  // 1. Check if context_main.json exists but is invalid JSON (corruption)
  const contextMainPath = join(projectPath, 'context_main.json');
  if (await exists(contextMainPath)) {
    try {
      const content = await readFile(contextMainPath, 'utf-8');
      JSON.parse(content);
    } catch {
      // Invalid JSON = corruption, should clean
      return true;
    }
  }
  
  // 2. Check if .logicstamp contains metadata files that might have stale paths
  try {
    const { readdir } = await import('fs/promises');
    const entries = await readdir(logicstampDir, { withFileTypes: true });
    
    // Look for config/metadata files that might contain project paths
    for (const entry of entries) {
      if (entry.isFile() && (entry.name.includes('config') || entry.name.includes('meta'))) {
        const configPath = join(logicstampDir, entry.name);
        try {
          const content = await readFile(configPath, 'utf-8');
          const config = JSON.parse(content);
          // If config has a projectPath that doesn't match current project, it's stale
          if (config.projectPath && config.projectPath !== projectPath && config.projectPath !== resolve(projectPath)) {
            return true;
          }
        } catch {
          // Invalid JSON in config = corruption
          return true;
        }
      }
    }
  } catch {
    // Can't read directory = might be corrupted
    return true;
  }
  
  return false;
}

/**
 * Clean LogicStamp cache folder - only use when corruption/mismatch detected or manually requested
 */
async function cleanLogicStampCache(projectPath: string): Promise<void> {
  const logicstampDir = join(projectPath, '.logicstamp');
  
  try {
    await rm(logicstampDir, { recursive: true, force: true });
  } catch (error) {
    // Silently ignore - folder might be locked or already deleted
  }
}

export async function compareModes(input: CompareModesInput): Promise<CompareModesOutput> {
  const projectPath = input.projectPath 
    ? resolve(input.projectPath) 
    : (process.env.PROJECT_PATH ? resolve(process.env.PROJECT_PATH) : process.cwd());

  try {
    // Smart cache cleanup: only clean if corruption/mismatch detected or manually requested
    const cleanCache = input.cleanCache || false;
    const shouldClean = cleanCache || await shouldCleanCache(projectPath);
    
    if (shouldClean) {
      await cleanLogicStampCache(projectPath);
    }

    // Execute stamp context --compare-modes --stats command
    // This generates context_compare_modes.json in the project directory
    // Note: This operation takes 2-3x longer than normal generation, so we use a longer timeout
    const command = `stamp context --compare-modes --stats`;

    await execWithLongTimeout(command, {
      cwd: projectPath,
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    });

    // Read context_compare_modes.json
    const compareModesPath = join(projectPath, 'context_compare_modes.json');
    const compareModesContent = await readFile(compareModesPath, 'utf-8');
    const compareModesData = JSON.parse(compareModesContent);

    // Return the parsed JSON data
    return {
      projectPath,
      ...compareModesData,
    };
  } catch (error) {
    // Preserve original error information
    const errorMessage = error instanceof Error ? error.message : String(error);
    const nodeError = error as NodeJS.ErrnoException;
    
    // Check for specific error types
    if (nodeError && nodeError.code === 'ENOENT' && errorMessage.includes('context_compare_modes.json')) {
      throw new Error(
        `Failed to read context_compare_modes.json at ${join(projectPath, 'context_compare_modes.json')}. ` +
        `The stamp CLI command completed, but the expected output file was not found. ` +
        `This may indicate the CLI failed silently or encountered an error. ` +
        `Try running 'stamp context --compare-modes --stats' manually from ${projectPath} to diagnose the issue. ` +
        `Ensure the stamp CLI is installed and up to date: npm install -g logicstamp-context`
      );
    }
    
    const enhancedError = new Error(
      `Failed to generate compare modes data for project at ${projectPath}. ` +
      `This operation compares token costs across different context generation modes (none, header, header+style, full). ` +
      `Error: ${errorMessage}. ` +
      `Ensure the stamp CLI is installed (npm install -g logicstamp-context) and the project path is correct. ` +
      `This operation takes 2-3x longer than normal context generation.`
    );
    
    // Preserve error code and other properties if available
    if (error && typeof error === 'object') {
      if ('code' in error) {
        (enhancedError as any).code = (error as any).code;
      }
      if ('stdout' in error) {
        (enhancedError as any).stdout = (error as any).stdout;
      }
      if ('stderr' in error) {
        (enhancedError as any).stderr = (error as any).stderr;
      }
    }
    
    throw enhancedError;
  }
}

