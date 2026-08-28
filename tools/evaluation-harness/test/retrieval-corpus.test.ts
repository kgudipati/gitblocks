import { beforeAll, describe, expect, it } from 'vitest';

import { findGitBlocksRoot } from '../src/repository-root.ts';
import {
  RETRIEVAL_FAMILIES,
  RETRIEVAL_VERSIONS,
  type ValidatedRetrievalCorpus,
} from '../src/retrieval/contracts.ts';
import { loadRetrievalCorpusV1 } from '../src/retrieval/corpus.ts';
import { retrievalStableJson } from '../src/retrieval/stable-json.ts';

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
      'f92eac1a3963c4f52fb135189e82a0196dbccd559af32bc57a6a7e64226eb842',
    );
    expect(corpus.manifest.files).toHaveLength(212);
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
    const classifications = new Map<string, number>();
    for (const { classification } of [
      ...corpus.retrievalCases,
      ...corpus.normalizationCases,
    ]) {
      for (const value of classification.classifications) {
        classifications.set(value, (classifications.get(value) ?? 0) + 1);
      }
    }
    expect(Object.fromEntries([...classifications].sort())).toMatchObject({
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
    expect(grades).toEqual([130, 62, 388, 56]);
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
    expect(corpus.equivalence.groups).toEqual([]);
  });

  it('requires candidate-specific relevance variation without a fixed family anchor', () => {
    for (const family of RETRIEVAL_FAMILIES) {
      const cases = corpus.retrievalCases.filter(
        ({ query }) => query.capabilityFamily === family,
      );
      const vectors = new Set(
        cases.map(({ relevanceGold }) =>
          retrievalStableJson(
            relevanceGold.judgments.map(({ candidateId, grade }) => ({
              candidateId,
              grade,
            })),
          ),
        ),
      );
      expect(vectors.size).toBeGreaterThanOrEqual(3);
      const fixedGradeThree = cases
        .map(
          ({ relevanceGold }) =>
            new Set(
              relevanceGold.judgments
                .filter(({ grade }) => grade === 3)
                .map(({ candidateId }) => candidateId),
            ),
        )
        .reduce(
          (intersection, values) =>
            new Set([...intersection].filter((id) => values.has(id))),
        );
      expect([...fixedGradeThree]).toEqual([]);
      const narrower = cases.find(
        ({ classification }) =>
          classification.slotId === 'retrieval-narrower-intent',
      )!;
      expect(
        new Set(narrower.relevanceGold.judgments.map(({ grade }) => grade))
          .size,
      ).toBeGreaterThanOrEqual(3);
      expect(
        narrower.relevanceGold.judgments.some(({ grade }) => grade === 0),
      ).toBe(true);
      const comparison = cases.find(
        ({ classification }) =>
          classification.slotId === 'retrieval-candidate-comparison',
      )!;
      const named = new Set(
        comparison.query.queryInput.candidateReferences.map(
          ({ value }) => value,
        ),
      );
      expect(
        comparison.relevanceGold.judgments
          .filter(({ grade }) => grade === 3)
          .every(({ candidateId }) => named.has(candidateId)),
      ).toBe(true);
    }
  });

  it('exercises the corrected public contradiction path in every family', () => {
    const cases = corpus.normalizationCases.filter(({ classification }) =>
      classification.classifications.includes('required-prohibited-conflict'),
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
