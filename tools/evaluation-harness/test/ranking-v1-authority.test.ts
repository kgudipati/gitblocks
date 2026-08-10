import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { loadRankingCorpus } from '../src/ranking/corpus.ts';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

describe('ranking-v1 authority', () => {
  it('closes exactly thirty proposed cases with six per family', () => {
    const loaded = loadRankingCorpus(REPOSITORY_ROOT);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;

    expect(loaded.cases).toHaveLength(30);
    expect(
      Object.fromEntries(
        [...new Set(loaded.cases.map((item) => item.binding.capabilityFamily))]
          .sort()
          .map((family) => [
            family,
            loaded.cases.filter(
              (item) => item.binding.capabilityFamily === family,
            ).length,
          ]),
      ),
    ).toEqual({
      authorization: 6,
      'audit-logging': 6,
      'background-jobs': 6,
      'rate-limiting': 6,
      webhooks: 6,
    });
    expect(loaded.corpus.gold.reviewStatus).toBe(
      'proposed-not-independently-reviewed',
    );
    expect(
      loaded.corpus.gold.cases.map(({ provenance }) => ({
        status: provenance.status,
        independentReviewStatus: provenance.independentReviewStatus,
      })),
    ).toEqual(
      Array.from({ length: 30 }, () => ({
        status: 'proposed',
        independentReviewStatus: 'not-reviewed',
      })),
    );
    expect(loaded.corpus.review.status).toBe('independent-review-pending');
    expect(loaded.corpus.review.independentReviewer).toBeNull();
    expect('milestone2Accepted' in loaded.corpus.review).toBe(false);
  });

  it('keeps blind, evidence, handoff, audit, gold, and review authority physical', () => {
    const manifest = JSON.parse(
      readFileSync(
        join(REPOSITORY_ROOT, 'evals/ranking-v1/manifest.json'),
        'utf8',
      ),
    ) as { files: readonly { path: string }[] };
    const paths = manifest.files.map(({ path }) => path);
    expect(paths).toContain('blind/cases.json');
    expect(paths).toContain('evidence/candidate-evidence.json');
    expect(paths).toContain('handoff/phase9-lanes.json');
    expect(paths).toContain('audit/case-classifications.json');
    expect(paths).toContain('gold/outcomes.json');
    expect(paths).toContain('reviews/proposed-review-record.json');

    const blind = JSON.parse(
      readFileSync(
        join(REPOSITORY_ROOT, 'evals/ranking-v1/blind/cases.json'),
        'utf8',
      ),
    ) as unknown;
    const forbiddenKeys = new Set([
      'auditLabels',
      'controlledPairExpectedDirection',
      'disposition',
      'gold',
      'incomparablePairs',
      'outcome',
      'primaryClass',
      'rankGroups',
      'rankRelations',
      'reviewStatus',
    ]);
    expect(collectKeys(blind).filter((key) => forbiddenKeys.has(key))).toEqual(
      [],
    );
  });
});

function collectKeys(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(collectKeys);
  if (typeof value !== 'object' || value === null) return [];
  return Object.entries(value).flatMap(([key, child]) => [
    key,
    ...collectKeys(child),
  ]);
}
