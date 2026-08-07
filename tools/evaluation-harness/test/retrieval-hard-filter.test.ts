import { beforeAll, describe, expect, it } from 'vitest';

import { findGitBlocksRoot } from '../src/repository-root.ts';
import type { ValidatedRetrievalCorpus } from '../src/retrieval/contracts.ts';
import { loadRetrievalCorpusV1 } from '../src/retrieval/corpus.ts';

let corpus: ValidatedRetrievalCorpus;

beforeAll(() => {
  const loaded = loadRetrievalCorpusV1(findGitBlocksRoot(process.cwd()));
  if (!loaded.ok) throw new Error('Retrieval corpus fixture must validate.');
  corpus = loaded.corpus;
}, 60_000);

describe('generated retrieval hard-filter authority', () => {
  it('regenerates 150 decisions and preserves exact tri-state-to-lane policy', () => {
    for (const bundle of corpus.retrievalCases) {
      expect(bundle.generatedProjection.decisions).toHaveLength(150);
      expect(bundle.generatedProjection.digest).toBe(
        bundle.hardFilterGold.projectionDigest,
      );
      for (const decision of bundle.generatedProjection.decisions) {
        if (decision.negativeControl || decision.hardState === 'conflict') {
          expect(decision.lane).toBe('excluded');
        } else if (decision.hardState === 'unresolved') {
          expect(decision.lane).toBe('evidence-needed');
        } else {
          expect(decision.lane).toBe('eligible');
        }
      }
      expect(bundle.hardFilterGold).not.toHaveProperty('decisions');
      expect(bundle.hardFilterGold).not.toHaveProperty('matrix');
    }
  });

  it('keeps unknown hard evidence unresolved and never calls it eligible', () => {
    const constrained = corpus.retrievalCases.filter(
      ({ classification }) =>
        classification.slotId === 'retrieval-hard-constraint',
    );
    expect(constrained).toHaveLength(5);
    for (const bundle of constrained) {
      expect(bundle.generatedProjection.laneCounts.eligible).toBe(0);
      expect(
        bundle.generatedProjection.laneCounts['evidence-needed'],
      ).toBeGreaterThan(0);
      expect(
        bundle.generatedProjection.decisions.some(
          ({ hardState, lane }) =>
            hardState === 'unresolved' && lane === 'eligible',
        ),
      ).toBe(false);
      expect(
        bundle.relevanceGold.judgments.some(({ grade }) => grade > 0),
      ).toBe(true);
    }
  });

  it('freezes exact generated state and lane aggregates by family', () => {
    const aggregates = Object.fromEntries(
      [
        'authorization',
        'audit-logging',
        'background-jobs',
        'rate-limiting',
        'webhooks',
      ].map((family) => {
        const cases = corpus.retrievalCases.filter(
          ({ query }) => query.capabilityFamily === family,
        );
        const sum = (key: 'hardStateCounts' | 'laneCounts', field: string) =>
          cases.reduce(
            (total, bundle) =>
              total +
              (bundle.generatedProjection[key] as Record<string, number>)[
                field
              ]!,
            0,
          );
        return [
          family,
          {
            hard: {
              conflict: sum('hardStateCounts', 'conflict'),
              satisfied: sum('hardStateCounts', 'satisfied'),
              unresolved: sum('hardStateCounts', 'unresolved'),
            },
            lanes: {
              eligible: sum('laneCounts', 'eligible'),
              evidenceNeeded: sum('laneCounts', 'evidence-needed'),
              excluded: sum('laneCounts', 'excluded'),
            },
          },
        ];
      }),
    );
    expect(aggregates).toEqual({
      authorization: {
        hard: { conflict: 720, satisfied: 150, unresolved: 30 },
        lanes: { eligible: 85, evidenceNeeded: 17, excluded: 798 },
      },
      'audit-logging': {
        hard: { conflict: 720, satisfied: 150, unresolved: 30 },
        lanes: { eligible: 115, evidenceNeeded: 23, excluded: 762 },
      },
      'background-jobs': {
        hard: { conflict: 720, satisfied: 150, unresolved: 30 },
        lanes: { eligible: 145, evidenceNeeded: 29, excluded: 726 },
      },
      'rate-limiting': {
        hard: { conflict: 720, satisfied: 150, unresolved: 30 },
        lanes: { eligible: 120, evidenceNeeded: 24, excluded: 756 },
      },
      webhooks: {
        hard: { conflict: 720, satisfied: 150, unresolved: 30 },
        lanes: { eligible: 65, evidenceNeeded: 13, excluded: 822 },
      },
    });
  });

  it('binds complete proposed audit samples to generated entries', () => {
    for (const bundle of corpus.retrievalCases) {
      const roles = bundle.hardFilterGold.auditSample.map(
        ({ sampleRole }) => sampleRole,
      );
      expect(roles).toEqual([...roles].sort());
      expect(roles).toEqual(
        expect.arrayContaining([
          'cross-family',
          'hard-conflict',
          'negative-control',
        ]),
      );
      expect(
        new Set(
          bundle.hardFilterGold.auditSample.map(
            ({ candidateId }) => candidateId,
          ),
        ).size,
      ).toBe(bundle.hardFilterGold.auditSample.length);
      expect(
        bundle.hardFilterGold.auditSample.map(({ provenance }) => provenance),
      ).toEqual(
        bundle.hardFilterGold.auditSample.map(() => ({
          status: 'proposed',
          reviewStatus: 'not-reviewed',
          reviewer: null,
          reviewedAt: null,
          reviewReference: null,
        })),
      );
    }
  });
});
