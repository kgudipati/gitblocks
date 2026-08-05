import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  normalizeCapabilityQueryV1,
  parseCapabilityQueryInputV1,
  type CapabilityTaxonomyV1,
} from '@gitblocks/contracts';
import { describe, expect, it } from 'vitest';

import { findGitBlocksRoot } from '../src/repository-root.ts';
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

  it('uses the accepted closed query-input parser and controlled case tags', () => {
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
    expect(
      createRetrievalSchemaRegistry(root).validate('query', {
        ...query,
        tags: [...query.tags, 'fabricated-diversity-label'],
      }).length,
    ).toBeGreaterThan(0);
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
