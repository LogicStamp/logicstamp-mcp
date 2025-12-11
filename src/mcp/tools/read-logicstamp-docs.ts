/**
 * Tool: logicstamp_read_logicstamp_docs
 * Returns LogicStamp documentation as a bundle for LLMs to understand the tool
 */

import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
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
    // Primary: landing page (logicstamp.dev/docs) - best UX
    // Fallback: CLI repo GitHub docs - always available, versioned
    landingPage: string; // Primary: logicstamp.dev/docs
    cliRepo: string; // Fallback: github.com/LogicStamp/logicstamp-context
    usage: {
      primary: string; // logicstamp.dev/docs/usage
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

async function readDocFile(docPath: string): Promise<string> {
  // Try relative path first (for development)
  const relativePath = join(__dirname, '../../..', docPath);
  try {
    return await readFile(relativePath, 'utf-8');
  } catch {
    // Fallback to cwd (for installed packages)
    const cwdPath = join(process.cwd(), docPath);
    return await readFile(cwdPath, 'utf-8');
  }
}

export async function readLogicStampDocs(): Promise<ReadLogicStampDocsOutput> {
  try {
    // Read only the LLM-focused doc bundle (embedded in MCP package)
    // This is a frozen snapshot for LLMs - full docs live at logicstamp.dev/docs
    const forLLMs = await readDocFile('docs/logicstamp-for-llms.md');

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
        landingPage: 'https://logicstamp.dev/docs',
        cliRepo: 'https://github.com/LogicStamp/logicstamp-context',
        usage: {
          primary: 'https://logicstamp.dev/docs/usage',
          fallback: 'https://github.com/LogicStamp/logicstamp-context/blob/main/docs/usage.md',
        },
        uifContracts: {
          primary: 'https://logicstamp.dev/docs/uif-contracts',
          fallback: 'https://github.com/LogicStamp/logicstamp-context/blob/main/docs/uif_contracts.md',
        },
        schema: {
          primary: 'https://logicstamp.dev/docs/schema',
          fallback: 'https://github.com/LogicStamp/logicstamp-context/blob/main/docs/schema.md',
        },
        context: {
          primary: 'https://logicstamp.dev/docs/cli/context',
          fallback: 'https://github.com/LogicStamp/logicstamp-context/blob/main/docs/cli/context.md',
        },
        compareModes: {
          primary: 'https://logicstamp.dev/docs/cli/compare-modes',
          fallback: 'https://github.com/LogicStamp/logicstamp-context/blob/main/docs/cli/compare-modes.md',
        },
        limitations: {
          primary: 'https://logicstamp.dev/docs/limitations',
          fallback: 'https://github.com/LogicStamp/logicstamp-context/blob/main/docs/limitations.md',
        },
      },
      summary: {
        purpose: 'LogicStamp is a CLI tool + MCP server that scans React/TypeScript/Next.js codebases and produces structured, AI-ready summaries (bundles) optimized for LLM consumption.',
        howToUse: [
          '1. Call logicstamp_refresh_snapshot to generate context files and get a snapshotId',
          '2. Call logicstamp_list_bundles with the snapshotId to discover available bundles',
          '3. Call logicstamp_read_bundle with bundlePath to get component contracts and dependency graphs',
          '4. Prefer reading bundles over raw source files - bundles contain structured summaries optimized for AI',
          '5. Only read raw .ts/.tsx files when you need exact implementation details not in bundles',
        ],
        keyConcepts: [
          'Bundles are pre-parsed, structured summaries (not raw code)',
          'context_main.json is the main index - start here to understand the project',
          'Each folder gets a context.json file with bundles (one per root component)',
          'Bundles contain contracts (props, state, hooks), dependency graphs, and optional style metadata',
          'Use header mode (default) for most cases - provides contracts + signatures at ~70% token savings',
          'Missing micro-details in bundles is normal - they are intentionally compressed',
        ],
      },
    };
  } catch (error) {
    throw new Error(
      `Failed to read LogicStamp documentation: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

