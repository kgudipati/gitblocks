import { access, readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

const ROOT = new URL('../../../', import.meta.url);
const PRODUCT_FILES = [
  'packages/ingestion/src/candidate-authority-contracts.ts',
  'packages/ingestion/src/candidate-authority-evidence.ts',
  'packages/ingestion/src/candidate-authority-partial-evidence.ts',
  'packages/ingestion/src/candidate-authority-partial-rules.ts',
  'packages/ingestion/src/candidate-authority-partial-semantics.ts',
  'packages/ingestion/src/candidate-authority-readiness.ts',
  'packages/ingestion/src/candidate-authority-rules.ts',
] as const;

describe('candidate-authority product scope boundaries', () => {
  it('has no evaluation, persistence, provider, credential, model, or ambient-clock dependency', async () => {
    for (const path of PRODUCT_FILES) {
      const source = await readFile(new URL(path, ROOT), 'utf8');
      expect(source).not.toMatch(
        /evals\/|evaluation-harness|@gitblocks\/persistence/u,
      );
      expect(source).not.toMatch(/process\.env|\bfetch\s*\(|\bDate\.now\s*\(/u);
      expect(source).not.toMatch(/\bdocker\b|model-provider|readCredential/iu);
    }
  });

  it('does not publish a live source authority, all-candidate root, coverage, or ranking package', async () => {
    for (const path of [
      'catalog/public-v1/candidate-authority-source-authority.json',
      'catalog/public-v1/candidate-authority-root.json',
      'catalog/public-v1/candidate-authority-coverage.json',
      'packages/ranking',
    ]) {
      await expect(access(new URL(path, ROOT))).rejects.toThrow();
    }
  });
});
