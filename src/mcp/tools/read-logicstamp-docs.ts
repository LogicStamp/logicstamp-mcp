/**
 * Tool: logicstamp_read_logicstamp_docs
 * Returns LogicStamp documentation as a bundle for LLMs to understand the tool
 */

import { readFile, stat } from 'fs/promises';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface ReadLogicStampDocsOutput {
  type: 'LogicStampDocs';
  version: '1.0';
  docs: {
    forLLMs: string; // The canonical LLM-focused guide (embedded in MCP package)
  };
  canonicalDocs: {
    // Links to canonical documentation with redundancy
    // Primary: landing page (logicstamp.dev/docs/logicstamp-context/context) - best UX
    // Fallback: CLI repo GitHub docs - always available, versioned
    landingPage: string; // Primary: logicstamp.dev/docs/logicstamp-context/context
    cliRepo: string; // Fallback: github.com/LogicStamp/logicstamp-context
    usage: {
      primary: string; // logicstamp.dev/docs/logicstamp-context/usage
      fallback: string; // github.com/LogicStamp/logicstamp-context/blob/main/docs/usage.md
    };
    uifContracts: {
      primary: string;
      fallback: string;
    };
    schema: {
      primary: string;
      fallback: string;
    };
    context: {
      primary: string;
      fallback: string;
    };
    compareModes: {
      primary: string;
      fallback: string;
    };
    limitations: {
      primary: string;
      fallback: string;
    };
  };
  summary: {
    purpose: string;
    howToUse: string[];
    keyConcepts: string[];
  };
}

/**
 * Find the package root by looking for package.json
 * This works reliably whether installed via npm, npx, or running from source
 */
async function findPackageRoot(startPath: string): Promise<string> {
  let current = resolve(startPath);
  const root = resolve('/');
  
  while (current !== root) {
    try {
      const packageJsonPath = join(current, 'package.json');
      await stat(packageJsonPath);
      // Check if it's the right package
      const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'));
      if (packageJson.name === 'logicstamp-mcp') {
        return current;
      }
    } catch {
      // Continue searching up
    }
    
    const parent = dirname(current);
    if (parent === current) break; // Reached filesystem root
    current = parent;
  }
  
  throw new Error(
    'Could not find logicstamp-mcp package root. ' +
    'This tool searches for package.json starting from the current directory and walking up the directory tree. ' +
    'Ensure you are running this from within the logicstamp-mcp package directory or that the package is properly installed.'
  );
}

async function readDocFile(docPath: string): Promise<string> {
  // Ensure we're only reading the correct file
  if (docPath !== 'docs/logicstamp-for-llms.md') {
    throw new Error(
      `Invalid documentation path requested: ${docPath}. ` +
      `This tool only reads docs/logicstamp-for-llms.md. ` +
      `The documentation file must be included in the package.json files array to be accessible.`
    );
  }

  const triedPaths: string[] = [];
  
  // Strategy 1: From __dirname (dist/mcp/tools/) going up to package root
  const packageRootFromDist = join(__dirname, '../../..');
  const docFilePath1 = join(packageRootFromDist, docPath);
  triedPaths.push(docFilePath1);
  
  try {
    return await readFile(docFilePath1, 'utf-8');
  } catch (error1) {
    // Strategy 2: Find package root by searching for package.json
    try {
      const packageRoot = await findPackageRoot(__dirname);
      const docFilePath2 = join(packageRoot, docPath);
      triedPaths.push(docFilePath2);
      return await readFile(docFilePath2, 'utf-8');
    } catch (error2) {
      // Strategy 3: Try from process.cwd() (for development)
      const cwdPath = join(process.cwd(), docPath);
      triedPaths.push(cwdPath);
      try {
        return await readFile(cwdPath, 'utf-8');
      } catch (error3) {
        // Include __dirname and process.cwd() in error for debugging
        throw new Error(
          `Could not find documentation file: ${docPath}\n\n` +
          `This tool tried multiple strategies to locate the file:\n` +
          `1. From compiled dist directory: ${triedPaths[0]}\n` +
          `2. By searching for package root: ${triedPaths[1] || 'not attempted'}\n` +
          `3. From current working directory: ${triedPaths[2] || 'not attempted'}\n\n` +
          `Current location: __dirname=${__dirname}, process.cwd()=${process.cwd()}\n\n` +
          `Solution: Ensure docs/logicstamp-for-llms.md exists and is included in package.json files array. ` +
          `The file should be at the package root level in the docs/ directory.`
        );
      }
    }
  }
}

export async function readLogicStampDocs(): Promise<ReadLogicStampDocsOutput> {
  try {
    // Read only the LLM-focused doc bundle (embedded in MCP package)
    // This is a frozen snapshot for LLMs - full docs live at logicstamp.dev/docs/logicstamp-context/context
    // IMPORTANT: Only reads docs/logicstamp-for-llms.md - does NOT read any CLI docs
    const docPath = 'docs/logicstamp-for-llms.md';
    const forLLMs = await readDocFile(docPath);

    return {
      type: 'LogicStampDocs',
      version: '1.0',
      docs: {
        forLLMs,
      },
      canonicalDocs: {
        // Links to canonical documentation with redundancy
        // Primary: landing page (best UX, SEO) | Fallback: CLI repo GitHub (always available, versioned)
        // Docs are maintained in CLI repo and synced to landing page - both are canonical
        landingPage: 'https://logicstamp.dev/docs/logicstamp-context/context',
        cliRepo: 'https://github.com/LogicStamp/logicstamp-context',
        usage: {
          primary: 'https://logicstamp.dev/docs/logicstamp-context/usage',
          fallback: 'https://github.com/LogicStamp/logicstamp-context/blob/main/docs/usage.md',
        },
        uifContracts: {
          primary: 'https://logicstamp.dev/docs/logicstamp-context/uif-contracts',
          fallback: 'https://github.com/LogicStamp/logicstamp-context/blob/main/docs/uif_contracts.md',
        },
        schema: {
          primary: 'https://logicstamp.dev/docs/logicstamp-context/schema',
          fallback: 'https://github.com/LogicStamp/logicstamp-context/blob/main/docs/schema.md',
        },
        context: {
          primary: 'https://logicstamp.dev/docs/logicstamp-context/context',
          fallback: 'https://github.com/LogicStamp/logicstamp-context/blob/main/docs/cli/context.md',
        },
        compareModes: {
          primary: 'https://logicstamp.dev/docs/logicstamp-context/compare-modes',
          fallback: 'https://github.com/LogicStamp/logicstamp-context/blob/main/docs/cli/compare-modes.md',
        },
        limitations: {
          primary: 'https://logicstamp.dev/docs/complete-reference/known-limitations',
          fallback: 'https://github.com/LogicStamp/logicstamp-context/blob/main/docs/limitations.md',
        },
      },
      summary: {
        purpose: 'LogicStamp Context is a CLI tool + MCP server that statically analyzes TypeScript codebases (React, Next.js, Vue 3) and produces structured, AI-ready context bundles optimized for LLM consumption.',
        howToUse: [
          '1. Call logicstamp_refresh_snapshot to generate context files and get a snapshotId',
          '2. Call logicstamp_list_bundles with the snapshotId to discover available bundles',
          '3. Call logicstamp_read_bundle with bundlePath to get component contracts and dependency graphs',
          '4. Prefer reading bundles over raw source files - bundles contain structured summaries optimized for AI',
          '5. Only read raw .ts/.tsx files when you need exact implementation details not in bundles',
          '6. Use logicstamp_compare_modes to understand token costs across all modes',
        ],
        keyConcepts: [
          'Bundles are pre-parsed, structured summaries (not raw code) - transforms "parse and infer" to "read and reason"',
          'Supports React (full), Next.js (partial), Vue 3 (partial), and UI frameworks (Material UI, ShadCN, Tailwind, etc.)',
          'context_main.json is the main index - start here to understand the project',
          'Each folder gets a context.json file with bundles (one per root component)',
          'Bundles contain contracts (props, state, hooks), dependency graphs, and optional style metadata',
          'Use header mode (default) for most cases - provides contracts + signatures at ~70% token savings vs raw source',
          'Style metadata token savings vary: CSS/SCSS (~40-70%), Tailwind (~4-10%) - use compare_modes for exact costs',
          'Security-first: Automatic secret detection and sanitization (secrets replaced with "PRIVATE_DATA")',
          'Missing micro-details in bundles is normal - they are intentionally compressed',
          'IMPORTANT: By default, dependency graphs include nested components (depth=2). To include only direct dependencies, explicitly set depth: 1 when calling refresh_snapshot. The default depth=2 ensures nested components are included in dependency graphs.',
        ],
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to read LogicStamp documentation. ` +
      `This tool reads docs/logicstamp-for-llms.md from the logicstamp-mcp package. ` +
      `Error: ${errorMessage}. ` +
      `Ensure the documentation file exists and is accessible. ` +
      `If running from source, ensure you're in the package root directory. ` +
      `If installed via npm, ensure the package was installed correctly and includes the docs/ directory.`
    );
  }
}

