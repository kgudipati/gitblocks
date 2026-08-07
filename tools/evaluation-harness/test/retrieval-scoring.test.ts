import { describe, expect, it } from 'vitest';

import {
  metric,
  scoreRetrievalFixture,
  summarizeMetrics,
} from '../src/retrieval/scoring.ts';
import type { RetrievalScoringFixture } from '../src/retrieval/contracts.ts';
import { runRetrievalScorerFixtures } from '../src/retrieval/fixtures.ts';

function fixture(
  overrides: Partial<RetrievalScoringFixture> = {},
): RetrievalScoringFixture {
  return {
    family: 'authorization',
    judgments: [
      { candidateId: 'candidate-a', grade: 3, eligible: true },
      { candidateId: 'candidate-b', grade: 2, eligible: true },
      { candidateId: 'candidate-c', grade: 1, eligible: false },
    ],
    results: [
      { candidateId: 'candidate-a', claimedLane: 'eligible' },
      { candidateId: 'candidate-b', claimedLane: 'eligible' },
    ],
    equivalenceGroups: [],
    generatedDecisions: [
      {
        candidateId: 'candidate-a',
        hardState: 'satisfied',
        lane: 'eligible',
        negativeControl: false,
      },
      {
        candidateId: 'candidate-b',
        hardState: 'satisfied',
        lane: 'eligible',
        negativeControl: false,
      },
      {
        candidateId: 'candidate-c',
        hardState: 'unresolved',
        lane: 'evidence-needed',
        negativeControl: false,
      },
    ],
    predictedDecisions: [
      { candidateId: 'candidate-a', hardState: 'satisfied', lane: 'eligible' },
      { candidateId: 'candidate-b', hardState: 'satisfied', lane: 'eligible' },
      {
        candidateId: 'candidate-c',
        hardState: 'unresolved',
        lane: 'evidence-needed',
      },
    ],
    expectedNoEligibleCandidate: false,
    predictedNoEligibleCandidate: false,
    ...overrides,
  };
}

describe('retrieval scorer', () => {
  it('hand-calculates perfect retrieval, partial recall, MRR, and graded NDCG', () => {
    const perfect = scoreRetrievalFixture(fixture());
    expect(perfect.recallAt10).toEqual(metric(2, 2));
    expect(perfect.meanReciprocalRank).toEqual(metric(1, 1));
    expect(perfect.ndcgAt10).toEqual(
      metric(7 + 3 / Math.log2(3), 7 + 3 / Math.log2(3)),
    );

    const partial = scoreRetrievalFixture(
      fixture({
        results: [
          { candidateId: 'irrelevant', claimedLane: 'eligible' },
          { candidateId: 'candidate-b', claimedLane: 'eligible' },
        ],
      }),
    );
    expect(partial.recallAt10).toEqual(metric(1, 2));
    expect(partial.meanReciprocalRank).toEqual(metric(0.5, 1));
    expect(partial.ndcgAt10).toEqual(
      metric(3 / Math.log2(3), 7 + 3 / Math.log2(3)),
    );
  });

  it('detects exact and equivalence duplicates at the pure scorer boundary', () => {
    const scored = scoreRetrievalFixture(
      fixture({
        results: [
          { candidateId: 'candidate-a', claimedLane: 'eligible' },
          { candidateId: 'candidate-a', claimedLane: 'eligible' },
          { candidateId: 'candidate-b', claimedLane: 'eligible' },
        ],
        equivalenceGroups: [['candidate-a', 'candidate-b']],
      }),
    );
    expect(scored.exactDuplicateRate).toEqual(metric(1, 3));
    expect(scored.equivalenceDuplicateRate).toEqual(metric(2, 3));
  });

  it('separates conflicts, negative controls, evidence-needed, and lane errors', () => {
    const scored = scoreRetrievalFixture(
      fixture({
        generatedDecisions: [
          {
            candidateId: 'conflict',
            hardState: 'conflict',
            lane: 'excluded',
            negativeControl: false,
          },
          {
            candidateId: 'negative',
            hardState: 'satisfied',
            lane: 'excluded',
            negativeControl: true,
          },
          {
            candidateId: 'unknown',
            hardState: 'unresolved',
            lane: 'evidence-needed',
            negativeControl: false,
          },
        ],
        predictedDecisions: [
          { candidateId: 'conflict', hardState: 'conflict', lane: 'excluded' },
          {
            candidateId: 'negative',
            hardState: 'satisfied',
            lane: 'eligible',
          },
          {
            candidateId: 'unknown',
            hardState: 'unresolved',
            lane: 'evidence-needed',
          },
        ],
        results: [
          { candidateId: 'conflict', claimedLane: 'eligible' },
          { candidateId: 'negative', claimedLane: 'eligible' },
          { candidateId: 'unknown', claimedLane: 'evidence-needed' },
        ],
      }),
    );
    expect(scored.top10Violations.conflict).toBe(1);
    expect(scored.top10Violations.negativeControl).toBe(1);
    expect(scored.top10Violations.laneError).toBe(2);
    expect(scored.hardFilterAccuracy).toEqual(metric(3, 3));
  });

  it('keeps every zero denominator null and excludes nulls from macro means', () => {
    const empty = scoreRetrievalFixture(
      fixture({ judgments: [], results: [] }),
    );
    expect(empty.recallAt10).toEqual({
      numerator: 0,
      denominator: 0,
      value: null,
      status: 'not-applicable',
    });
    expect(empty.meanReciprocalRank.value).toBeNull();
    expect(empty.ndcgAt10.value).toBeNull();
    expect(empty.exactDuplicateRate.value).toBeNull();
    expect(empty.equivalenceDuplicateRate.value).toBeNull();
    expect(summarizeMetrics([empty.recallAt10]).value).toBeNull();
  });

  it('reproduces the complete hand-calculated fixture evidence and digest', () => {
    expect(runRetrievalScorerFixtures()).toEqual({
      fixtureVersion: 'retrieval-scorer-fixtures/1.0.0',
      fixtureCount: 26,
      perfectRecall: 1,
      partialRecall: 0.5,
      knownRankMrr: 0.5,
      gradedNdcg: 0.212845,
      duplicateRate: 0.333333,
      equivalenceDuplicateRate: 0.666667,
      zeroDenominatorStatus: 'not-applicable',
      reportDigest:
        '77f2354a40bcbc6c1fe4b57f77145207639cc27a6621c792d3a7609d449333fc',
      semanticDigest:
        '681074536322773991e532ce9ce83c72137a4d61a51e3afd2cb7a3b4ebb604f8',
    });
  });
});
