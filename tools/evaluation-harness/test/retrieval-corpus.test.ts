import { beforeAll, describe, expect, it } from 'vitest';

import { findGitBlocksRoot } from '../src/repository-root.ts';
import {
  RETRIEVAL_VERSIONS,
  type ValidatedRetrievalCorpus,
} from '../src/retrieval/contracts.ts';
import { loadRetrievalCorpusV1 } from '../src/retrieval/corpus.ts';

let corpus: ValidatedRetrievalCorpus;

beforeAll(() => {
  const loaded = loadRetrievalCorpusV1(findGitBlocksRoot(process.cwd()));
  if (!loaded.ok) throw new Error('Retrieval corpus must validate.');
  corpus = loaded.corpus;
}, 60_000);

describe('retrieval-v1 corpus', () => {
  it('closes exactly 30 retrieval and 20 normalization cases with exact family balance', () => {
    expect(corpus.retrievalCases).toHaveLength(30);
    expect(corpus.normalizationCases).toHaveLength(20);
    expect(corpus.manifest.corpusVersion).toBe(RETRIEVAL_VERSIONS.corpus);
    expect(corpus.manifest.corpusSemanticDigest).toBe(
      'e133c0fa00b6063e7360ce5ebfdf27893f72ee5ca5e39fbe5d82c1e944831917',
    );
    expect(corpus.manifest.files).toHaveLength(211);
    expect(corpus.manifest.familyCounts).toEqual({
      authorization: { normalization: 4, retrieval: 6 },
      'audit-logging': { normalization: 4, retrieval: 6 },
      'background-jobs': { normalization: 4, retrieval: 6 },
      'rate-limiting': { normalization: 4, retrieval: 6 },
      webhooks: { normalization: 4, retrieval: 6 },
    });
  }, 30_000);

  it('regenerates all 30 complete 150-candidate hard-filter projections', () => {
    for (const bundle of corpus.retrievalCases) {
      expect(bundle.generatedProjection.decisions).toHaveLength(150);
      expect(bundle.generatedProjection.digest).toBe(
        bundle.hardFilterGold.projectionDigest,
      );
    }
  }, 30_000);

  it('keeps all authority proposed and not independently reviewed', () => {
    expect(corpus.allProvenance).toEqual(
      expect.arrayContaining([
        {
          status: 'proposed',
          reviewStatus: 'not-reviewed',
          reviewer: null,
          reviewedAt: null,
          reviewReference: null,
        },
      ]),
    );
    expect(corpus.allProvenance).toEqual(
      corpus.allProvenance.map(() => ({
        status: 'proposed',
        reviewStatus: 'not-reviewed',
        reviewer: null,
        reviewedAt: null,
        reviewReference: null,
      })),
    );
  });

  it('freezes diversity, relevance, equivalence, and no-result evidence', () => {
    const tags = new Map<string, number>();
    for (const { query } of [
      ...corpus.retrievalCases,
      ...corpus.normalizationCases,
    ]) {
      for (const tag of query.tags) tags.set(tag, (tags.get(tag) ?? 0) + 1);
    }
    expect(Object.fromEntries([...tags].sort())).toMatchObject({
      'active-alias': 5,
      'alias-evaluation': 5,
      'deployment-self-hosting': 5,
      'evidence-needed': 5,
      'equivalence-safety': 10,
      'infrastructure-exclusion': 5,
      'negative-control-safety': 5,
      'no-eligible-candidate': 5,
      'positive-multiple-relevant': 25,
      'preferred-constraint': 5,
      'prohibited-constraint': 5,
      'required-constraint': 5,
      'required-prohibited-conflict': 5,
      'same-family-comparison': 6,
    });
    const grades = [0, 0, 0, 0];
    for (const { relevanceGold } of corpus.retrievalCases) {
      for (const { grade } of relevanceGold.judgments) grades[grade]! += 1;
    }
    expect(grades).toEqual([0, 194, 404, 38]);
    expect(
      corpus.retrievalCases
        .filter(
          ({ noResultGold }) =>
            noResultGold.expectedOutcome === 'no-eligible-candidate',
        )
        .map(({ query }) => query.capabilityFamily)
        .sort(),
    ).toEqual([
      'audit-logging',
      'authorization',
      'background-jobs',
      'rate-limiting',
      'webhooks',
    ]);
    expect(corpus.equivalence.groups).toHaveLength(5);
    expect(
      [
        ...new Set(
          corpus.equivalence.groups.map(
            ({ relationshipKind }) => relationshipKind,
          ),
        ),
      ].sort(),
    ).toEqual([
      'ecosystem-companion',
      'ecosystem-implementation-variant',
      'functional-overlap',
      'parent-focused-companion',
    ]);
  });

  it('exercises the corrected public contradiction path in every family', () => {
    const cases = corpus.normalizationCases.filter(({ query }) =>
      query.tags.includes('required-prohibited-conflict'),
    );
    expect(cases).toHaveLength(5);
    for (const bundle of cases) {
      expect(bundle.normalizationResult.outcome).toBe('clarification-required');
      expect(
        bundle.normalizationResult.normalizedConstraints.map(
          ({ modality, resolutionBasis, ruleId }) => ({
            modality,
            resolutionBasis,
            ruleId,
          }),
        ),
      ).toEqual(
        expect.arrayContaining([
          {
            modality: 'required',
            resolutionBasis: 'contradiction',
            ruleId: 'constraint-modality-conflict',
          },
          {
            modality: 'prohibited',
            resolutionBasis: 'contradiction',
            ruleId: 'constraint-modality-conflict',
          },
        ]),
      );
    }
  }, 30_000);
});
