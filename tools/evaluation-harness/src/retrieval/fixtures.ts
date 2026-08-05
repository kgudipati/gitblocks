import type {
  NormalizationPrediction,
  RetrievalPredictionSet,
  RetrievalScoringFixture,
  ValidatedRetrievalCorpus,
} from './contracts.ts';
import { RETRIEVAL_FAMILIES } from './contracts.ts';
import {
  hardFilterMetrics,
  metric,
  scoreAliasExpansionCorrectness,
  scoreClarificationAccuracy,
  scoreProhibited,
  scoreRetrievalFixture,
  scoreRetrievalPredictionSet,
  summarizeMetrics,
} from './scoring.ts';
import { retrievalSemanticDigest, retrievalStableJson } from './stable-json.ts';

export interface RetrievalFixtureEvidence {
  readonly fixtureVersion: 'retrieval-scorer-fixtures/1.0.0';
  readonly fixtureCount: 20;
  readonly perfectRecall: number;
  readonly partialRecall: number;
  readonly knownRankMrr: number;
  readonly gradedNdcg: number;
  readonly duplicateRate: number;
  readonly equivalenceDuplicateRate: number;
  readonly zeroDenominatorStatus: 'not-applicable';
  readonly reportDigest: string;
  readonly semanticDigest: string;
}

export function runRetrievalScorerFixtures(): RetrievalFixtureEvidence {
  const perfect = scoreRetrievalFixture(baseFixture());
  assertEqual(perfect.recallAt10, metric(2, 2));
  assertEqual(perfect.meanReciprocalRank, metric(1, 1));
  assertEqual(perfect.ndcgAt10.value, 1);

  const partial = scoreRetrievalFixture(
    baseFixture({
      results: [
        { candidateId: 'irrelevant', claimedLane: 'eligible' },
        { candidateId: 'candidate-b', claimedLane: 'eligible' },
      ],
    }),
  );
  assertEqual(partial.recallAt10, metric(1, 2));
  assertEqual(partial.meanReciprocalRank, metric(0.5, 1));
  const expectedNdcg = metric(3 / Math.log2(3), 7 + 3 / Math.log2(3));
  assertEqual(partial.ndcgAt10, expectedNdcg);

  const duplicates = scoreRetrievalFixture(
    baseFixture({
      results: [
        { candidateId: 'candidate-a', claimedLane: 'eligible' },
        { candidateId: 'candidate-a', claimedLane: 'eligible' },
        { candidateId: 'candidate-b', claimedLane: 'eligible' },
      ],
      equivalenceGroups: [['candidate-a', 'candidate-b']],
    }),
  );
  assertEqual(duplicates.exactDuplicateRate, metric(1, 3));
  assertEqual(duplicates.equivalenceDuplicateRate, metric(2, 3));

  const safety = scoreRetrievalFixture(
    baseFixture({
      judgments: [],
      generatedDecisions: [
        decision('conflict', 'conflict', 'excluded', false),
        decision('negative', 'satisfied', 'excluded', true),
        decision('unknown', 'unresolved', 'evidence-needed', false),
      ],
      predictedDecisions: [
        predicted('conflict', 'conflict', 'excluded'),
        predicted('negative', 'satisfied', 'eligible'),
        predicted('unknown', 'unresolved', 'evidence-needed'),
      ],
      results: [
        { candidateId: 'conflict', claimedLane: 'eligible' },
        { candidateId: 'negative', claimedLane: 'eligible' },
        { candidateId: 'unknown', claimedLane: 'evidence-needed' },
      ],
      expectedNoEligibleCandidate: true,
      predictedNoEligibleCandidate: true,
    }),
  );
  assertEqual(safety.top10Violations, {
    conflict: 1,
    negativeControl: 1,
    laneError: 2,
  });
  assertEqual(safety.noEligibleCandidateAccuracy, metric(1, 1));
  const unresolvedLaneError = scoreRetrievalFixture(
    baseFixture({
      judgments: [],
      generatedDecisions: [
        decision('unknown', 'unresolved', 'evidence-needed', false),
      ],
      predictedDecisions: [
        predicted('unknown', 'unresolved', 'evidence-needed'),
      ],
      results: [{ candidateId: 'unknown', claimedLane: 'eligible' }],
    }),
  );
  assertEqual(unresolvedLaneError.top10Violations.laneError, 1);
  const falsePositive = scoreRetrievalFixture(
    baseFixture({ predictedNoEligibleCandidate: true }),
  );
  assertEqual(falsePositive.noEligibleCandidateAccuracy, metric(0, 1));

  const triState = hardFilterMetrics(
    [
      decision('candidate-a', 'satisfied', 'eligible', false),
      decision('candidate-b', 'conflict', 'excluded', false),
      decision('candidate-c', 'unresolved', 'evidence-needed', false),
    ],
    [
      predicted('candidate-a', 'satisfied', 'eligible'),
      predicted('candidate-b', 'conflict', 'excluded'),
      predicted('candidate-c', 'unresolved', 'evidence-needed'),
    ],
  );
  assertEqual(triState.accuracy, metric(3, 3));
  for (const state of ['conflict', 'satisfied', 'unresolved'] as const) {
    assertEqual(triState.perState[state].precision, metric(1, 1));
    assertEqual(triState.perState[state].recall, metric(1, 1));
  }

  const normalization = normalizationPrediction();
  assertEqual(
    scoreClarificationAccuracy(
      'clarification-required',
      normalization.clarifications,
      normalization,
    ),
    metric(1, 1),
  );
  assertEqual(
    scoreClarificationAccuracy('normalized', [], normalization),
    metric(0, 1),
  );
  assertEqual(
    scoreAliasExpansionCorrectness(
      true,
      normalization.normalizedConcepts,
      normalization.normalizedConcepts,
    ),
    metric(1, 1),
  );
  assertEqual(
    scoreAliasExpansionCorrectness(true, [], normalization.normalizedConcepts),
    metric(0, 1),
  );
  assertEqual(scoreAliasExpansionCorrectness(false, [], []), metric(0, 0));
  const prohibited = prohibitedFixture();
  assertEqual(
    scoreProhibited(prohibited.query, prohibited.expected, prohibited.expected),
    metric(1, 1),
  );
  assertEqual(
    scoreProhibited(
      prohibited.query,
      prohibited.expected,
      prohibited.expected.map((constraint) => ({
        ...constraint,
        modality: 'preferred',
      })),
    ),
    metric(0, 1),
  );

  const empty = scoreRetrievalFixture(
    baseFixture({ judgments: [], results: [] }),
  );
  for (const value of [
    empty.recallAt10,
    empty.meanReciprocalRank,
    empty.ndcgAt10,
    empty.exactDuplicateRate,
    empty.equivalenceDuplicateRate,
    summarizeMetrics([empty.recallAt10]),
  ]) {
    assertEqual(value, metric(0, 0));
  }

  const synthetic = syntheticReportFixture();
  const report = scoreRetrievalPredictionSet(
    synthetic.corpus,
    synthetic.predictionSet,
  );
  assertEqual(report.macro['recallAt10'], metric(4, 5));
  assertEqual(report.micro['recallAt10'], metric(4, 5));
  assertEqual(report.familyCoverage, metric(4, 5));
  assertEqual(report.micro['hardFilterAccuracy'], metric(30, 30));
  assertEqual(report.perCase.length, 50);
  assertEqual(
    report.perFamily.map(
      ({ positiveCaseHitRate }) => positiveCaseHitRate.value,
    ),
    [1, 1, 1, 1, 0],
  );
  assertEqual(report.safetyViolations, {
    conflict: 0,
    negativeControl: 0,
    laneError: 0,
  });

  const projection = {
    fixtureVersion: 'retrieval-scorer-fixtures/1.0.0' as const,
    fixtureCount: 20 as const,
    perfectRecall: perfect.recallAt10.value ?? 0,
    partialRecall: partial.recallAt10.value ?? 0,
    knownRankMrr: partial.meanReciprocalRank.value ?? 0,
    gradedNdcg: partial.ndcgAt10.value ?? 0,
    duplicateRate: duplicates.exactDuplicateRate.value ?? 0,
    equivalenceDuplicateRate: duplicates.equivalenceDuplicateRate.value ?? 0,
    zeroDenominatorStatus: 'not-applicable' as const,
    reportDigest: report.semanticDigest,
  };
  const first = {
    ...projection,
    semanticDigest: retrievalSemanticDigest(projection),
  };
  const second = {
    ...projection,
    semanticDigest: retrievalSemanticDigest(projection),
  };
  assertEqual(first, second);
  return first;
}

function syntheticReportFixture(): {
  readonly corpus: ValidatedRetrievalCorpus;
  readonly predictionSet: RetrievalPredictionSet;
} {
  const normalization = {
    outcome: 'normalized' as const,
    primaryFamily: 'authorization' as const,
    normalizedConcepts: [],
    normalizedConstraints: [],
    unresolved: [],
    clarifications: [],
    notices: [],
  };
  const retrievalCases = RETRIEVAL_FAMILIES.flatMap((family, familyIndex) =>
    Array.from({ length: 6 }, (_, caseIndex) => {
      const suffix = String(caseIndex + 1).padStart(2, '0');
      const caseId = `ret-${family}-fixture-${suffix}`;
      const candidateId = `candidate-${family}-${suffix}`;
      return {
        query: {
          queryVersion: 'retrieval-evaluation-query/1.0.0',
          caseId,
          caseKind: 'retrieval',
          capabilityFamily: family,
          tags: ['family-balanced'],
          queryInput: {
            contractVersion: '1.0.0',
            queryInputId: `query-${caseId}`,
            scope: 'local-pre-approval',
            summary: 'Synthetic scorer fixture.',
            capabilityTerms: [
              { termId: `term-${family}-${suffix}`, originalTerm: family },
            ],
            successConditions: [
              {
                conditionId: `condition-${family}-${suffix}`,
                statement: 'Return one.',
              },
            ],
            draftConstraints: [],
            candidateReferences: [],
            repositoryFingerprintReference: null,
          },
        },
        normalizationResult: null,
        normalizationGold: {
          normalizationGoldVersion: 'retrieval-normalization-gold/1.0.0',
          caseId,
          expected: { ...normalization, primaryFamily: family },
          provenance: proposedProvenance(),
        },
        hardFilterGold: null,
        generatedProjection: {
          decisions: [decision(candidateId, 'satisfied', 'eligible', false)],
          digest: 'a'.repeat(64),
          hardStateCounts: { conflict: 0, satisfied: 1, unresolved: 0 },
          laneCounts: { eligible: 1, 'evidence-needed': 0, excluded: 0 },
        },
        relevanceGold: {
          relevanceGoldVersion: 'retrieval-relevance-gold/1.0.0',
          caseId,
          judgments: [
            {
              candidateId,
              grade: caseIndex === 0 ? 3 : 0,
              reasonCodes: ['catalog-family-capability-match'],
              provenance: proposedProvenance(),
            },
          ],
          provenance: proposedProvenance(),
        },
        noResultGold: {
          noResultGoldVersion: 'retrieval-no-result-gold/1.0.0',
          caseId,
          expectedOutcome: 'eligible-candidates-present',
          eligibleCount: 1,
          evidenceNeededCount: 0,
          excludedCount: 0,
          provenance: proposedProvenance(),
        },
        fixtureHit: caseIndex === 0 && familyIndex < 4,
      };
    }),
  );
  const normalizationCases = RETRIEVAL_FAMILIES.flatMap((family) =>
    Array.from({ length: 4 }, (_, caseIndex) => {
      const suffix = String(caseIndex + 1).padStart(2, '0');
      const caseId = `norm-${family}-fixture-${suffix}`;
      return {
        query: {
          queryVersion: 'retrieval-evaluation-query/1.0.0',
          caseId,
          caseKind: 'normalization-adversarial',
          capabilityFamily: family,
          tags: [],
          queryInput: {
            contractVersion: '1.0.0',
            queryInputId: `query-${caseId}`,
            scope: 'local-pre-approval',
            summary: 'Synthetic normalization scorer fixture.',
            capabilityTerms: [
              { termId: `term-${family}-${suffix}`, originalTerm: family },
            ],
            successConditions: [
              {
                conditionId: `condition-${family}-${suffix}`,
                statement: 'Preserve normalization.',
              },
            ],
            draftConstraints: [],
            candidateReferences: [],
            repositoryFingerprintReference: null,
          },
        },
        normalizationResult: null,
        normalizationGold: {
          normalizationGoldVersion: 'retrieval-normalization-gold/1.0.0',
          caseId,
          expected: { ...normalization, primaryFamily: family },
          provenance: proposedProvenance(),
        },
        clarificationGold: {
          clarificationGoldVersion: 'retrieval-clarification-gold/1.0.0',
          caseId,
          clarificationRequired: false,
          clarifications: [],
          terminalUnsupported: false,
          provenance: proposedProvenance(),
        },
      };
    }),
  );
  const retrievalPredictions = retrievalCases.map((bundle) => {
    const firstDecision = bundle.generatedProjection.decisions.at(0);
    if (firstDecision === undefined) {
      throw new Error('Synthetic retrieval fixture requires one decision.');
    }
    return {
      caseId: bundle.query.caseId,
      caseKind: 'retrieval' as const,
      normalization: bundle.normalizationGold.expected,
      candidateDecisions: bundle.generatedProjection.decisions.map(
        ({ candidateId, hardState, lane }) => ({
          candidateId,
          hardState,
          lane,
        }),
      ),
      results: bundle.fixtureHit
        ? [
            {
              candidateId: firstDecision.candidateId,
              claimedLane: 'eligible' as const,
            },
          ]
        : [],
      noEligibleCandidate: false,
    };
  });
  const normalizationPredictions = normalizationCases.map((bundle) => ({
    caseId: bundle.query.caseId,
    caseKind: 'normalization-adversarial' as const,
    normalization: bundle.normalizationGold.expected,
  }));
  const predictions = [
    ...retrievalPredictions,
    ...normalizationPredictions,
  ].sort((left, right) => compareText(left.caseId, right.caseId));
  const corpus = {
    manifest: {
      corpusId: 'retrieval-v1',
      corpusVersion: 'retrieval-evaluation-corpus/1.0.0',
      corpusSemanticDigest: 'b'.repeat(64),
      taxonomyVersion: '1.0.0',
      taxonomyDigest: 'c'.repeat(64),
      catalogVersion: 'public-v1',
      catalogDigest: 'd'.repeat(64),
      profileAuthorityVersion:
        'deterministic-candidate-profile-authority/1.0.0',
      profileAuthorityDigest: 'e'.repeat(64),
      caseCounts: { normalization: 20, retrieval: 30 },
    },
    equivalence: {
      equivalenceVersion: 'retrieval-equivalence-authority/1.0.0',
      groups: [],
    },
    normalizationCases,
    retrievalCases,
  } as unknown as ValidatedRetrievalCorpus;
  const predictionWithoutDigest = {
    predictionSetVersion: 'retrieval-evaluation-prediction-set/1.0.0' as const,
    predictionSetId: 'synthetic-report-fixture',
    corpusId: 'retrieval-v1' as const,
    corpusVersion: 'retrieval-evaluation-corpus/1.0.0' as const,
    corpusSemanticDigest: 'b'.repeat(64),
    predictions,
  };
  const predictionSet = {
    ...predictionWithoutDigest,
    semanticDigest: retrievalSemanticDigest(predictionWithoutDigest),
  };
  return { corpus, predictionSet };
}

function proposedProvenance() {
  return {
    status: 'proposed' as const,
    reviewStatus: 'not-reviewed' as const,
    reviewer: null,
    reviewedAt: null,
    reviewReference: null,
  };
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function baseFixture(
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
      decision('candidate-a', 'satisfied', 'eligible', false),
      decision('candidate-b', 'satisfied', 'eligible', false),
      decision('candidate-c', 'unresolved', 'evidence-needed', false),
    ],
    predictedDecisions: [
      predicted('candidate-a', 'satisfied', 'eligible'),
      predicted('candidate-b', 'satisfied', 'eligible'),
      predicted('candidate-c', 'unresolved', 'evidence-needed'),
    ],
    expectedNoEligibleCandidate: false,
    predictedNoEligibleCandidate: false,
    ...overrides,
  };
}

function normalizationPrediction(): NormalizationPrediction {
  return {
    outcome: 'clarification-required',
    primaryFamily: 'authorization',
    normalizedConcepts: [
      {
        conceptId: 'authorization',
        sourceTermIds: ['term-alias'],
        ruleId: 'taxonomy-active-alias',
      },
    ],
    normalizedConstraints: [],
    unresolved: [],
    clarifications: [
      {
        reasonCode: 'capability-scope-ambiguous',
        sourceIds: ['term-alias'],
        possibleConceptIds: ['authorization'],
      },
    ],
    notices: [],
  };
}

function prohibitedFixture() {
  const expected = [
    {
      sourceConstraintIds: ['constraint-prohibited'],
      modality: 'prohibited' as const,
      facet: 'infrastructure',
      resolutionBasis: 'controlled-taxonomy',
      ruleId: 'taxonomy-active-alias',
      conceptId: 'redis',
      canonicalTerm: 'redis',
    },
  ];
  return {
    query: {
      queryVersion: 'retrieval-evaluation-query/1.0.0' as const,
      caseId: 'norm-authorization-fixture',
      caseKind: 'normalization-adversarial' as const,
      capabilityFamily: 'authorization' as const,
      tags: ['prohibited-preservation' as const],
      queryInput: {
        contractVersion: '1.0.0' as const,
        queryInputId: 'query-prohibited-fixture',
        scope: 'local-pre-approval' as const,
        summary: 'Fixture.',
        capabilityTerms: [
          { termId: 'term-family', originalTerm: 'authorization' },
        ],
        successConditions: [
          { conditionId: 'condition-one', statement: 'Preserve modality.' },
        ],
        draftConstraints: [
          {
            constraintId: 'constraint-prohibited',
            modality: 'prohibited' as const,
            statement: 'Do not use Redis.',
            originalTerm: 'redis',
            facetHint: 'infrastructure' as const,
            reasonCode: 'redis-prohibited',
          },
        ],
        candidateReferences: [],
        repositoryFingerprintReference: null,
      },
    },
    expected,
  };
}

function decision(
  candidateId: string,
  hardState: 'conflict' | 'satisfied' | 'unresolved',
  lane: 'eligible' | 'evidence-needed' | 'excluded',
  negativeControl: boolean,
) {
  return { candidateId, hardState, lane, negativeControl } as const;
}

function predicted(
  candidateId: string,
  hardState: 'conflict' | 'satisfied' | 'unresolved',
  lane: 'eligible' | 'evidence-needed' | 'excluded',
) {
  return { candidateId, hardState, lane } as const;
}

function assertEqual(actual: unknown, expected: unknown): void {
  if (retrievalStableJson(actual) !== retrievalStableJson(expected)) {
    throw new Error('Hand-calculated retrieval scorer fixture failed.');
  }
}
