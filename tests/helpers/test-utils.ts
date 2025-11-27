/**
 * Test utilities and helpers
 */

import { readFile, writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import type { LogicStampIndex, LogicStampBundle, UIFContract } from '../../src/types/schemas.js';

/**
 * Create a temporary test directory
 */
export async function createTempDir(basePath: string): Promise<string> {
  const tempDir = join(basePath, `test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await mkdir(tempDir, { recursive: true });
  return tempDir;
}

/**
 * Clean up temporary directory
 */
export async function cleanupTempDir(dirPath: string): Promise<void> {
  try {
    await rm(dirPath, { recursive: true, force: true });
  } catch (error) {
    // Ignore errors during cleanup
  }
}

/**
 * Create a mock LogicStamp index file
 */
export async function createMockIndex(
  dirPath: string,
  options: {
    totalComponents?: number;
    totalBundles?: number;
    folders?: Array<{
      path: string;
      bundles: number;
      components: string[];
      tokenEstimate?: number;
    }>;
  } = {}
): Promise<LogicStampIndex> {
  // Ensure all folders have tokenEstimate
  const folders = (options.folders || [
    {
      path: 'src/components',
      bundles: 2,
      components: ['Button', 'Input'],
    },
  ]).map(folder => ({
    ...folder,
    tokenEstimate: folder.tokenEstimate ?? 2500,
  }));

  // Create actual source files so stamp context can find them
  for (const folder of folders) {
    const folderPath = join(dirPath, folder.path);
    await mkdir(folderPath, { recursive: true });
    
    for (const component of folder.components) {
      // Determine file extension based on component name pattern
      // If it starts with 'use', it's likely a hook (ts), otherwise component (tsx)
      const isHook = component.startsWith('use') || component.toLowerCase().includes('hook');
      const extension = isHook ? '.ts' : '.tsx';
      const filePath = join(folderPath, `${component}${extension}`);
      
      // Create a minimal valid TypeScript/React file
      let fileContent = '';
      if (isHook) {
        // Create a hook file
        fileContent = `import { useState } from 'react';

export function ${component}() {
  const [value, setValue] = useState(0);
  return { value, setValue };
}
`;
      } else {
        // Create a React component file
        fileContent = `import React from 'react';

interface ${component}Props {
  label?: string;
}

export function ${component}({ label }: ${component}Props) {
  return <div>{label || '${component}'}</div>;
}
`;
      }
      
      await writeFile(filePath, fileContent);
    }
  }

  // Create package.json and tsconfig.json for stamp context to recognize the project
  const packageJson = {
    name: 'test-project',
    version: '1.0.0',
    dependencies: {
      react: '^18.2.0',
      'react-dom': '^18.2.0',
    },
    devDependencies: {
      '@types/react': '^18.2.0',
      typescript: '^5.0.0',
    },
  };
  await writeFile(join(dirPath, 'package.json'), JSON.stringify(packageJson, null, 2));

  const tsconfig = {
    compilerOptions: {
      target: 'ES2020',
      lib: ['ES2020', 'DOM'],
      jsx: 'react-jsx',
      module: 'ESNext',
      moduleResolution: 'bundler',
      strict: true,
    },
    include: ['src'],
  };
  await writeFile(join(dirPath, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2));

  const index: LogicStampIndex = {
    type: 'LogicStampIndex',
    schemaVersion: '1.0.0',
    projectRoot: '.',
    projectRootAbs: dirPath,
    summary: {
      totalComponents: options.totalComponents || 2,
      totalBundles: options.totalBundles || 2,
      totalFolders: folders.length,
      totalTokenEstimate: 5000,
      tokenEstimates: {
        gpt4oMini: 2500,
        gpt4oMiniFullCode: 5000,
        claude: 2000,
        claudeFullCode: 4000,
      },
      missingDependencies: [],
    },
    folders,
  };

  const indexPath = join(dirPath, 'context_main.json');
  await writeFile(indexPath, JSON.stringify(index, null, 2));

  return index;
}

/**
 * Create a mock UIFContract
 */
export function createMockContract(componentName: string, options: Partial<UIFContract> = {}): UIFContract {
  return {
    type: 'UIFContract',
    schemaVersion: '1.0.0',
    kind: 'react:component',
    entryId: `src/components/${componentName}.tsx`,
    entryPathAbs: `/project/src/components/${componentName}.tsx`,
    entryPathRel: `src/components/${componentName}.tsx`,
    description: `${componentName} component`,
    version: {
      variables: [],
      hooks: ['useState', 'useEffect'],
      components: [],
      functions: ['handleClick'],
      imports: ['react'],
    },
    logicSignature: {
      props: {
        label: { type: 'string', optional: false },
        onClick: { type: '() => void', optional: true },
      },
      emits: {},
      state: {
        isActive: 'boolean',
      },
    },
    exports: {
      default: componentName,
    },
    semanticHash: `hash_${componentName}_${Date.now()}`,
    fileHash: `file_${componentName}_${Date.now()}`,
    ...options,
  };
}

/**
 * Create a mock LogicStamp bundle
 */
export function createMockBundle(
  componentName: string,
  options: {
    position?: string;
    depth?: number;
    includeCode?: boolean;
  } = {}
): LogicStampBundle {
  const contract = createMockContract(componentName);

  return {
    type: 'LogicStampBundle',
    schemaVersion: '1.0.0',
    position: options.position || '1/1',
    entryId: contract.entryId,
    depth: options.depth || 0,
    createdAt: new Date().toISOString(),
    bundleHash: `bundle_${componentName}_${Date.now()}`,
    graph: {
      nodes: [
        {
          entryId: contract.entryId,
          contract,
          codeHeader: options.includeCode
            ? `// ${componentName} component\nexport function ${componentName}() {}`
            : null,
          fullCode: options.includeCode
            ? `import React from 'react';\n\nexport function ${componentName}() {\n  return <div>${componentName}</div>;\n}`
            : undefined,
        },
      ],
      edges: [],
    },
    meta: {
      missing: [],
      source: 'test',
    },
  };
}

/**
 * Create mock bundle files in a directory
 */
export async function createMockBundleFiles(
  dirPath: string,
  folderPath: string,
  bundles: LogicStampBundle[]
): Promise<void> {
  const fullPath = join(dirPath, folderPath);
  await mkdir(fullPath, { recursive: true });

  const contextPath = join(fullPath, 'context.json');
  await writeFile(contextPath, JSON.stringify(bundles, null, 2));
}

/**
 * Read JSON file
 */
export async function readJsonFile<T>(filePath: string): Promise<T> {
  const content = await readFile(filePath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Wait for a condition to be true
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout = 5000,
  interval = 100
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error('Timeout waiting for condition');
}

/**
 * Create a mock exec function for testing
 */
export function createMockExec(
  responses: Map<string, { stdout: string; stderr: string }> = new Map()
) {
  return jest.fn((command: string) => {
    const response = responses.get(command) || { stdout: '', stderr: '' };
    return Promise.resolve(response);
  });
}

/**
 * Validate snapshot structure
 */
export function validateSnapshot(snapshot: any): boolean {
  return (
    typeof snapshot.id === 'string' &&
    typeof snapshot.createdAt === 'string' &&
    typeof snapshot.projectPath === 'string' &&
    typeof snapshot.profile === 'string' &&
    typeof snapshot.mode === 'string' &&
    typeof snapshot.contextDir === 'string'
  );
}

/**
 * Validate bundle descriptor structure
 */
export function validateBundleDescriptor(bundle: any): boolean {
  return (
    typeof bundle.id === 'string' &&
    typeof bundle.rootComponent === 'string' &&
    typeof bundle.filePath === 'string' &&
    typeof bundle.folder === 'string' &&
    typeof bundle.bundlePath === 'string' &&
    typeof bundle.position === 'string' &&
    typeof bundle.bundleHash === 'string' &&
    typeof bundle.approxTokens === 'number'
  );
}

/**
 * Validate compare result structure
 */
export function validateCompareResult(result: any): boolean {
  return (
    typeof result.baseline === 'string' &&
    typeof result.status === 'string' &&
    ['pass', 'diff', 'error'].includes(result.status) &&
    result.summary &&
    typeof result.summary.totalFolders === 'number' &&
    Array.isArray(result.folderDiffs)
  );
}
