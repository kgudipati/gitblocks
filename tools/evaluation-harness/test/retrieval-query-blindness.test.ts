import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  normalizeCapabilityQueryV1,
  parseCapabilityQueryInputV1,
  type CapabilityTaxonomyV1,
} from '@gitblocks/contracts';
import { describe, expect, it } from 'vitest';

import { findGitBlocksRoot } from '../src/repository-root.ts';
import { loadRetrievalBlindQuerySetV1 } from '../src/retrieval/blind-query.ts';
import type { RetrievalQueryDocument } from '../src/retrieval/contracts.ts';
import { projectNormalization } from '../src/retrieval/normalization.ts';
import { createRetrievalSchemaRegistry } from '../src/retrieval/schema-registry.ts';

const root = findGitBlocksRoot(process.cwd());
const query = readJson(
  'evals/retrieval-v1/queries/retrieval/ret-authorization-01.json',
) as RetrievalQueryDocument;
const taxonomy = readJson(
  'catalog/capability-taxonomy/1.0.0/manifest.json',
) as CapabilityTaxonomyV1;

describe('retrieval query blindness', () => {
  it('loads only the physically separate blind set without gold or audit metadata', () => {
    expect(
      existsSync(
        join(root, 'evals/retrieval-v1/audit/case-classification.json'),
      ),
    ).toBe(true);
    const loaded = loadRetrievalBlindQuerySetV1(root);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.querySet.queries).toHaveLength(50);
    const serialized = JSON.stringify(loaded.querySet);
    for (const forbidden of [
      'tags',
      'classification',
      'normalizationGold',
      'clarificationGold',
      'hardFilterGold',
      'relevanceGold',
      'noResultGold',
      'equivalence',
      'gold/',
      'audit/',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('rejects every audit or outcome classification on a blind query', () => {
    const registry = createRetrievalSchemaRegistry(root);
    for (const classification of [
      'no-eligible-candidate',
      'evidence-needed',
      'required-prohibited-conflict',
      'slot-exact-family',
    ]) {
      expect(
        registry.validate('query', {
          ...query,
          tags: [classification],
        }).length,
        classification,
      ).toBeGreaterThan(0);
    }
  });

  it('rejects expected outcomes, judgments, winners, filter gold, review conclusions, URLs, and target source', () => {
    const registry = createRetrievalSchemaRegistry(root);
    for (const forbidden of [
      { expectedOutcome: 'normalized' },
      { relevanceGrade: 3 },
      { winner: 'auth-open-policy-agent' },
      { recommendation: 'auth-open-policy-agent' },
      { hardFilterExpectation: 'eligible' },
      { reviewerConclusion: 'accepted' },
      { url: 'https://example.invalid' },
      { targetSource: 'repository-source' },
    ]) {
      expect(
        registry.validate('query', { ...query, ...forbidden }).length,
      ).toBeGreaterThan(0);
    }
  });

  it.each(['v1', 'v2'] as const)(
    'preserves repeated query validation on one %s registry',
    (authorityVersion) => {
      const registry = createRetrievalSchemaRegistry(root, authorityVersion);
      expect(registry.validate('query', query)).toEqual([]);
      const invalid = { ...query, hiddenAnswer: true };
      const first = registry.validate('query', invalid);
      expect(first).not.toEqual([]);
      expect(registry.validate('query', invalid)).toEqual(first);
    },
  );

  it('uses the accepted closed query-input parser', () => {
    for (const forbidden of [
      { arbitraryUrl: 'https://example.invalid' },
      { targetSource: 'repository-source' },
      { expectedOutcome: 'normalized' },
      { rankingHint: 'first' },
    ]) {
      expect(
        parseCapabilityQueryInputV1({ ...query.queryInput, ...forbidden }).ok,
      ).toBe(false);
    }
  });

  it('proves summary prose is inert while structured terms retain meaning', () => {
    const first = normalizeCapabilityQueryV1(query.queryInput, taxonomy);
    const changed = normalizeCapabilityQueryV1(
      {
        ...query.queryInput,
        summary:
          'This prose mentions webhooks and a winner, but must not create deterministic meaning.',
      },
      taxonomy,
    );
    expect(first.ok && changed.ok).toBe(true);
    if (!first.ok || !changed.ok) return;
    expect(first.value.semanticDigest).not.toBe(changed.value.semanticDigest);
    expect(projectNormalization(first.value)).toEqual(
      projectNormalization(changed.value),
    );
  });
});

function readJson(relativePath: string): unknown {
  return JSON.parse(readFileSync(join(root, relativePath), 'utf8')) as unknown;
}
