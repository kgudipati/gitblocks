import type { RetrievalScoringFixture } from './contracts.ts';
import { RETRIEVAL_BASELINE_VERSIONS } from './baselines/contracts.ts';
import { scoreRetrievalFixture } from './scoring.ts';
import { retrievalSemanticDigest } from './stable-json.ts';

export interface RetrievalFixtureOracleSummary {
  readonly controlId: 'fixture-oracle';
  readonly controlVersion: typeof RETRIEVAL_BASELINE_VERSIONS.fixtureOracle;
  readonly fixtureVersion: 'retrieval-baseline-oracle-fixture/1.0.0';
  readonly fixtureDigest: string;
  readonly scoreDigest: string;
  readonly sharedNormalizationComponent: false;
  readonly realCorpusUsed: false;
  readonly producedRealPredictionSet: false;
  readonly metrics: ReturnType<typeof scoreRetrievalFixture>;
  readonly expectationsSatisfied: true;
}

export function runRetrievalFixtureOracle(): RetrievalFixtureOracleSummary {
  const fixture: RetrievalScoringFixture = {
    family: 'authorization',
    judgments: [
      { candidateId: 'fixture-primary', grade: 3, eligible: true },
      { candidateId: 'fixture-secondary', grade: 2, eligible: true },
    ],
    results: [
      { candidateId: 'fixture-primary', claimedLane: 'eligible' },
      { candidateId: 'fixture-secondary', claimedLane: 'eligible' },
    ],
    equivalenceGroups: [],
    generatedDecisions: [
      {
        candidateId: 'fixture-primary',
        hardState: 'satisfied',
        lane: 'eligible',
        negativeControl: false,
      },
      {
        candidateId: 'fixture-secondary',
        hardState: 'satisfied',
        lane: 'eligible',
        negativeControl: false,
      },
    ],
    predictedDecisions: [
      {
        candidateId: 'fixture-primary',
        hardState: 'satisfied',
        lane: 'eligible',
      },
      {
        candidateId: 'fixture-secondary',
        hardState: 'satisfied',
        lane: 'eligible',
      },
    ],
    expectedNoEligibleCandidate: false,
    predictedNoEligibleCandidate: false,
  };
  const metrics = scoreRetrievalFixture(fixture);
  if (
    metrics.recallAt10.value !== 1 ||
    metrics.meanReciprocalRank.value !== 1 ||
    metrics.ndcgAt10.value !== 1 ||
    metrics.exactDuplicateRate.value !== 0 ||
    metrics.equivalenceDuplicateRate.value !== 0 ||
    metrics.hardFilterAccuracy.value !== 1 ||
    metrics.noEligibleCandidateAccuracy.value !== 1 ||
    metrics.top10Violations.conflict !== 0 ||
    metrics.top10Violations.negativeControl !== 0 ||
    metrics.top10Violations.laneError !== 0
  ) {
    throw new Error(
      'Synthetic fixture oracle did not meet exact expectations.',
    );
  }
  return {
    controlId: 'fixture-oracle',
    controlVersion: RETRIEVAL_BASELINE_VERSIONS.fixtureOracle,
    fixtureVersion: 'retrieval-baseline-oracle-fixture/1.0.0',
    fixtureDigest: retrievalSemanticDigest(fixture),
    scoreDigest: retrievalSemanticDigest(metrics),
    sharedNormalizationComponent: false,
    realCorpusUsed: false,
    producedRealPredictionSet: false,
    metrics,
    expectationsSatisfied: true,
  };
}
