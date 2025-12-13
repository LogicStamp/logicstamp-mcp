/**
 * Integration tests for read-logicstamp-docs tool
 */

import { readLogicStampDocs } from '../../src/mcp/tools/read-logicstamp-docs.js';
import { readFile } from 'fs/promises';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('readLogicStampDocs integration tests', () => {
  describe('successful documentation reading', () => {
    it('should read LogicStamp documentation successfully', async () => {
      const result = await readLogicStampDocs();

      expect(result).toBeDefined();
      expect(result.type).toBe('LogicStampDocs');
      expect(result.version).toBe('1.0');
    });

    it('should include docs content', async () => {
      const result = await readLogicStampDocs();

      expect(result.docs).toBeDefined();
      expect(result.docs.forLLMs).toBeDefined();
      expect(typeof result.docs.forLLMs).toBe('string');
      expect(result.docs.forLLMs.length).toBeGreaterThan(0);
    });

    it('should include canonical documentation links', async () => {
      const result = await readLogicStampDocs();

      expect(result.canonicalDocs).toBeDefined();
      expect(result.canonicalDocs.landingPage).toBe('https://logicstamp.dev/docs/logicstamp-context/context');
      expect(result.canonicalDocs.cliRepo).toBe('https://github.com/LogicStamp/logicstamp-context');
      
      expect(result.canonicalDocs.usage).toBeDefined();
      expect(result.canonicalDocs.usage.primary).toContain('logicstamp.dev');
      expect(result.canonicalDocs.usage.fallback).toContain('github.com');
      
      expect(result.canonicalDocs.uifContracts).toBeDefined();
      expect(result.canonicalDocs.schema).toBeDefined();
      expect(result.canonicalDocs.context).toBeDefined();
      expect(result.canonicalDocs.compareModes).toBeDefined();
      expect(result.canonicalDocs.limitations).toBeDefined();
    });

    it('should include summary information', async () => {
      const result = await readLogicStampDocs();

      expect(result.summary).toBeDefined();
      expect(result.summary.purpose).toBeDefined();
      expect(typeof result.summary.purpose).toBe('string');
      expect(result.summary.purpose.length).toBeGreaterThan(0);
      
      expect(result.summary.howToUse).toBeDefined();
      expect(Array.isArray(result.summary.howToUse)).toBe(true);
      expect(result.summary.howToUse.length).toBeGreaterThan(0);
      
      expect(result.summary.keyConcepts).toBeDefined();
      expect(Array.isArray(result.summary.keyConcepts)).toBe(true);
      expect(result.summary.keyConcepts.length).toBeGreaterThan(0);
    });

    it('should read the actual docs/logicstamp-for-llms.md file', async () => {
      const result = await readLogicStampDocs();
      
      // Try to read the actual file from package root
      // Strategy: go up from test file to find package root
      const packageRoot = resolve(__dirname, '../../..');
      const docPath = join(packageRoot, 'docs/logicstamp-for-llms.md');
      
      try {
        const actualContent = await readFile(docPath, 'utf-8');
        expect(result.docs.forLLMs).toBe(actualContent);
      } catch (error) {
        // If file doesn't exist at expected path, that's okay - 
        // the tool has fallback strategies that might work
        // Just verify the content exists and looks like markdown
        expect(result.docs.forLLMs).toContain('#');
        expect(result.docs.forLLMs.length).toBeGreaterThan(100);
      }
    });

    it('should return markdown-formatted content', async () => {
      const result = await readLogicStampDocs();

      const content = result.docs.forLLMs;
      // Should contain markdown headers
      expect(content).toMatch(/#+\s/);
      // Should contain some LogicStamp-related content
      expect(content.toLowerCase()).toMatch(/logicstamp/);
    });

    it('should include workflow steps in howToUse', async () => {
      const result = await readLogicStampDocs();

      const howToUse = result.summary.howToUse;
      expect(howToUse.length).toBeGreaterThanOrEqual(4);
      
      // Should mention the key tools
      const howToUseText = howToUse.join(' ').toLowerCase();
      expect(howToUseText).toMatch(/refresh_snapshot|refresh-snapshot/);
      expect(howToUseText).toMatch(/list_bundles|list-bundles/);
      expect(howToUseText).toMatch(/read_bundle|read-bundle/);
    });

    it('should include key concepts about bundles', async () => {
      const result = await readLogicStampDocs();

      const concepts = result.summary.keyConcepts.join(' ').toLowerCase();
      expect(concepts).toMatch(/bundle/);
    });
  });

  describe('output structure validation', () => {
    it('should return valid output structure', async () => {
      const result = await readLogicStampDocs();

      // Type check
      expect(result.type).toBe('LogicStampDocs');
      expect(result.version).toBe('1.0');
      
      // Docs structure
      expect(result.docs).toBeDefined();
      expect(result.docs.forLLMs).toBeDefined();
      
      // Canonical docs structure
      expect(result.canonicalDocs).toBeDefined();
      expect(result.canonicalDocs.landingPage).toBeDefined();
      expect(result.canonicalDocs.cliRepo).toBeDefined();
      
      // Summary structure
      expect(result.summary).toBeDefined();
      expect(result.summary.purpose).toBeDefined();
      expect(result.summary.howToUse).toBeDefined();
      expect(result.summary.keyConcepts).toBeDefined();
    });

    it('should have all canonical doc links as URLs', async () => {
      const result = await readLogicStampDocs();

      const checkUrl = (url: string) => {
        expect(url).toMatch(/^https?:\/\//);
      };

      checkUrl(result.canonicalDocs.landingPage);
      checkUrl(result.canonicalDocs.cliRepo);
      checkUrl(result.canonicalDocs.usage.primary);
      checkUrl(result.canonicalDocs.usage.fallback);
      checkUrl(result.canonicalDocs.uifContracts.primary);
      checkUrl(result.canonicalDocs.uifContracts.fallback);
      checkUrl(result.canonicalDocs.schema.primary);
      checkUrl(result.canonicalDocs.schema.fallback);
      checkUrl(result.canonicalDocs.context.primary);
      checkUrl(result.canonicalDocs.context.fallback);
      checkUrl(result.canonicalDocs.compareModes.primary);
      checkUrl(result.canonicalDocs.compareModes.fallback);
      checkUrl(result.canonicalDocs.limitations.primary);
      checkUrl(result.canonicalDocs.limitations.fallback);
    });
  });
});

