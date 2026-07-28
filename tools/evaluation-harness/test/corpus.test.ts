import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { loadCorpus } from '../src/corpus.ts';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

describe('committed pilot corpus', () => {
  it('loads the exact balanced corpus with all integrity and diversity gates', () => {
    const result = loadCorpus(REPOSITORY_ROOT);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.bundles).toHaveLength(10);
    expect(result.manifest.familyCounts).toEqual({
      authorization: 2,
      'audit-logging': 2,
      'background-jobs': 2,
      'rate-limiting': 2,
      webhooks: 2,
    });
    expect(
      result.bundles.every(
        (bundle) =>
          bundle.caseDocument.candidates.length >= 3 &&
          bundle.caseDocument.candidates.length <= 5,
      ),
    ).toBe(true);
  });

  it('keeps input candidates neutral and excludes gold-only fields', () => {
    const result = loadCorpus(REPOSITORY_ROOT);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    for (const bundle of result.bundles) {
      const candidateIds = bundle.caseDocument.candidates.map(
        (candidate) => candidate.candidateId,
      );
      expect(candidateIds).toEqual([...candidateIds].sort());
      const input = bundle.caseDocument as unknown as Record<string, unknown>;
      expect(input).not.toHaveProperty('outcome');
      expect(input).not.toHaveProperty('rankGroups');
      expect(input).not.toHaveProperty('recommendedCandidate');
      expect(input).not.toHaveProperty('rationaleNotes');
    }
  });
});
