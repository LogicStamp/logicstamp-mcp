/**
 * Tool: logicstamp_compare_modes
 * Generate comparison data file for MCP (Model Context Protocol) integration
 * Calls `stamp context --compare-modes --stats` and reads the generated JSON file
 */

import { readFile } from 'fs/promises';
import { join, resolve } from 'path';
import type { CompareModesInput, CompareModesOutput } from '../../types/schemas.js';
import { execWithLongTimeout } from '../utils/exec-with-timeout.js';

export async function compareModes(input: CompareModesInput): Promise<CompareModesOutput> {
  const projectPath = input.projectPath 
    ? resolve(input.projectPath) 
    : (process.env.PROJECT_PATH ? resolve(process.env.PROJECT_PATH) : process.cwd());

  try {
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
    const enhancedError = new Error(
      `Failed to generate compare modes data: ${errorMessage}`
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

