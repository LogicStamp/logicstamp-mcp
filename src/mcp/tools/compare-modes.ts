/**
 * Tool: logicstamp_compare_modes
 * Generate comparison data file for MCP (Model Context Protocol) integration
 * Calls `stamp context --compare-modes --stats` and reads the generated JSON file
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile } from 'fs/promises';
import { join, resolve } from 'path';
import type { CompareModesInput, CompareModesOutput } from '../../types/schemas.js';

const execAsync = promisify(exec);

export async function compareModes(input: CompareModesInput): Promise<CompareModesOutput> {
  const projectPath = input.projectPath 
    ? resolve(input.projectPath) 
    : (process.env.PROJECT_PATH ? resolve(process.env.PROJECT_PATH) : process.cwd());

  try {
    // Execute stamp context --compare-modes --stats command
    // This generates context_compare_modes.json in the project directory
    const command = `stamp context --compare-modes --stats`;

    await execAsync(command, {
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
    throw new Error(
      `Failed to generate compare modes data: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

