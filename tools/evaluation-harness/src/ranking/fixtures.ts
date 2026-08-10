import type {
  RankingCasePrediction,
  RankingGoldCase,
  RankingPredictionSet,
  RankingResolvedCase,
  RankingValidatedCorpus,
} from './contracts.ts';
import { scoreRankingPredictionSet } from './scoring.ts';
import { rankingSemanticDigest } from './stable-json.ts';

export interface RankingScorerFixtureSummary {
  readonly fixtureVersion: 'ranking-v1-scorer-fixtures/1.0.0';
  readonly scorerVersion: 'ranking-v1-scorer/1.0.0';
  readonly fixtureCount: 15;
  readonly assertionCount: number;
  readonly fixtures: readonly {
    readonly name: string;
    readonly result: 'passed';
  }[];
  readonly syntheticOracleOnly: true;
  readonly productComparator: false;
}

export function runRankingScorerFixtures(): RankingScorerFixtureSummary {
  const fixtures: { name: string; run: () => number }[] = [
    { name: 'perfect-prediction', run: perfectFixture },
    { name: 'legal-zero-denominators', run: zeroDenominatorFixture },
    { name: 'hard-conflict-safety-violation', run: hardConflictFixture },
    { name: 'incorrect-disposition', run: incorrectDispositionFixture },
    { name: 'wrong-responsible-outcome', run: wrongOutcomeFixture },
    { name: 'tie-split-incorrectly', run: tieSplitFixture },
    { name: 'incomparable-pair-falsely-ordered', run: incomparableFixture },
    { name: 'required-relation-reversed', run: reversedRelationFixture },
    { name: 'target-controlled-pair-unchanged', run: unchangedPairFixture },
    { name: 'evidence-needed-three-state-errors', run: evidenceNeededFixture },
    {
      name: 'missing-evidence-needed-resolution',
      run: missingResolutionFixture,
    },
    {
      name: 'material-unbound-incorrectly-recommended',
      run: unboundSuccessFixture,
    },
    {
      name: 'unbound-preference-incorrectly-used',
      run: unboundPreferenceFixture,
    },
    { name: 'preference-hardened', run: preferenceHardenedFixture },
    { name: 'candidate-invention', run: candidateInventionFixture },
  ];
  let assertionCount = 0;
  const results = fixtures.map((fixture) => {
    assertionCount += fixture.run();
    return { name: fixture.name, result: 'passed' as const };
  });
  return {
    fixtureVersion: 'ranking-v1-scorer-fixtures/1.0.0',
    scorerVersion: 'ranking-v1-scorer/1.0.0',
    fixtureCount: 15,
    assertionCount,
    fixtures: results,
    syntheticOracleOnly: true,
    productComparator: false,
  };
}

function perfectFixture(): number {
  const authority = syntheticAuthority('tie');
  const report = score(authority, [perfectPrediction(authority.gold[0])]);
  assert(report.overall.outcome.overall.errors === 0);
  assert(report.overall.dispositions.recommended.f1 === 1);
  assert(report.overall.partialOrder.ties.errors === 0);
  assert(report.overall.evidenceNeeded.unresolved.errors === 0);
  assert(Object.values(report.safety).every((count) => count === 0));
  return 5;
}

function zeroDenominatorFixture(): number {
  const authority = syntheticAuthority('empty');
  const report = score(authority, [perfectPrediction(authority.gold[0])]);
  assert(report.overall.partialOrder.overall.value === null);
  assert(report.overall.evidenceNeeded.overall.value === null);
  assert(
    report.overall.criterionBinding.boundPreferenceOrderingEffect.value ===
      null,
  );
  assert(report.overall.topThreeUsefulness.value === null);
  return 4;
}

function hardConflictFixture(): number {
  const authority = syntheticAuthority('hard-conflict');
  const prediction = perfectPrediction(authority.gold[0]);
  requireItem(prediction.candidates, 2).disposition = 'recommended';
  prediction.presentation = ['fixture-e'];
  prediction.rankGroups = [['fixture-e']];
  const report = score(authority, [prediction]);
  assert(report.safety.knownHardConflictRecommended === 1);
  assert(report.safety.knownHardConflictRanked === 1);
  return 2;
}

function incorrectDispositionFixture(): number {
  const authority = syntheticAuthority('tie');
  const prediction = perfectPrediction(authority.gold[0]);
  requireItem(prediction.candidates, 0).disposition = 'rejected';
  const report = score(authority, [prediction]);
  assert(report.overall.dispositions.recommended.falseNegative === 1);
  assert(report.overall.dispositions.rejected.falsePositive === 1);
  return 2;
}

function wrongOutcomeFixture(): number {
  const authority = syntheticAuthority('tie');
  const prediction = perfectPrediction(authority.gold[0]);
  prediction.outcome = 'insufficient-evidence';
  const report = score(authority, [prediction]);
  assert(report.overall.outcome.overall.errors === 1);
  assert(
    report.overall.outcome.confusion.recommend['insufficient-evidence'] === 1,
  );
  return 2;
}

function tieSplitFixture(): number {
  const authority = syntheticAuthority('tie');
  const prediction = perfectPrediction(authority.gold[0]);
  prediction.rankGroups = [['fixture-a'], ['fixture-b']];
  const report = score(authority, [prediction]);
  assert(report.overall.partialOrder.ties.correct === 0);
  assert(report.overall.partialOrder.ties.errors === 1);
  return 2;
}

function incomparableFixture(): number {
  const authority = syntheticAuthority('incomparable');
  const prediction = perfectPrediction(authority.gold[0]);
  prediction.incomparablePairs = [];
  prediction.rankRelations = [
    { higherCandidateId: 'fixture-a', lowerCandidateId: 'fixture-b' },
  ];
  const report = score(authority, [prediction]);
  assert(report.overall.partialOrder.incomparable.errors === 1);
  assert(report.overall.partialOrder.falseOrdersOfIncomparable === 1);
  return 2;
}

function reversedRelationFixture(): number {
  const authority = syntheticAuthority('ordered');
  const prediction = perfectPrediction(authority.gold[0]);
  prediction.rankRelations = [
    { higherCandidateId: 'fixture-b', lowerCandidateId: 'fixture-a' },
  ];
  const report = score(authority, [prediction]);
  assert(report.overall.partialOrder.ordered.errors === 1);
  return 1;
}

function unchangedPairFixture(): number {
  const first = syntheticAuthority('ordered');
  const firstCase = first.cases[0];
  const firstGold = first.gold[0];
  const secondCase: RankingResolvedCase = {
    ...firstCase,
    binding: { ...firstCase.binding, caseId: 'fixture-controlled-b' },
  };
  const secondGold: RankingGoldCase = {
    ...firstGold,
    caseId: 'fixture-controlled-b',
  };
  const corpus: RankingValidatedCorpus = {
    ...first.corpus,
    blind: {
      ...first.corpus.blind,
      cases: [firstCase.binding, secondCase.binding],
    },
    gold: {
      ...first.corpus.gold,
      cases: [firstGold, secondGold],
      controlledPairDirections: [
        {
          pairId: 'fixture-pair',
          firstCaseId: firstGold.caseId,
          firstPreferredCandidateId: 'fixture-a',
          secondCaseId: secondGold.caseId,
          secondPreferredCandidateId: 'fixture-b',
        },
      ],
    },
  };
  const firstPrediction = perfectPrediction(firstGold);
  const secondPrediction = perfectPrediction(secondGold);
  secondPrediction.presentation = ['fixture-a', 'fixture-b'];
  requireItem(secondPrediction.candidates, 0).disposition = 'recommended';
  requireItem(secondPrediction.candidates, 1).disposition = 'viable';
  const report = score(
    { corpus, cases: [firstCase, secondCase], gold: [firstGold, secondGold] },
    [firstPrediction, secondPrediction],
  );
  assert(report.controlledPairs.unchangedWhenChangeRequired === 1);
  assert(report.controlledPairs.correct === 0);
  return 2;
}

function evidenceNeededFixture(): number {
  const authority = syntheticAuthority('three-resolutions');
  const prediction = perfectPrediction(authority.gold[0]);
  prediction.evidenceNeededResolutions =
    prediction.evidenceNeededResolutions.map((entry) => ({
      ...entry,
      resolution:
        entry.resolution === 'satisfied'
          ? 'conflict'
          : entry.resolution === 'conflict'
            ? 'unresolved'
            : 'satisfied',
    }));
  const report = score(authority, [prediction]);
  assert(report.overall.evidenceNeeded.satisfied.errors === 1);
  assert(report.overall.evidenceNeeded.conflict.errors === 1);
  assert(report.overall.evidenceNeeded.unresolved.errors === 1);
  return 3;
}

function missingResolutionFixture(): number {
  const authority = syntheticAuthority('three-resolutions');
  const prediction = perfectPrediction(authority.gold[0]);
  prediction.evidenceNeededResolutions = [];
  const report = score(authority, [prediction]);
  assert(report.safety.missingEvidenceNeededResolution === 3);
  return 1;
}

function unboundSuccessFixture(): number {
  const authority = syntheticAuthority('material-unbound');
  const prediction = perfectPrediction(authority.gold[0]);
  const unboundCoverage = prediction.successConditionCoverage.find(
    ({ criterionId }) => criterionId === 'fixture-success-unbound',
  );
  if (unboundCoverage === undefined)
    throw new Error('Fixture coverage missing.');
  unboundCoverage.state = 'covered';
  requireItem(prediction.candidates, 0).disposition = 'recommended';
  prediction.outcome = 'recommend';
  const report = score(authority, [prediction]);
  assert(report.safety.unboundSuccessConditionCountedFavorable === 1);
  assert(
    report.overall.criterionBinding.materialUnboundFailClosed.errors === 1,
  );
  return 2;
}

function unboundPreferenceFixture(): number {
  const authority = syntheticAuthority('unbound-preference');
  const prediction = perfectPrediction(authority.gold[0]);
  prediction.ignoredPreferenceIds = [];
  prediction.appliedPreferenceIds = ['fixture-pref-unbound'];
  const report = score(authority, [prediction]);
  assert(report.safety.unboundPreferenceAffectedOrder === 1);
  assert(
    report.overall.criterionBinding.unboundPreferenceNonEffect.errors === 1,
  );
  return 2;
}

function preferenceHardenedFixture(): number {
  const authority = syntheticAuthority('tie');
  const prediction = perfectPrediction(authority.gold[0]);
  prediction.hardenedPreferenceIds = ['fixture-pref-bound'];
  const report = score(authority, [prediction]);
  assert(report.safety.preferenceHardenedIntoHardConflict === 1);
  assert(report.overall.criterionBinding.noPreferenceHardening.errors === 1);
  return 2;
}

function candidateInventionFixture(): number {
  const authority = syntheticAuthority('tie');
  const prediction = perfectPrediction(authority.gold[0]);
  prediction.candidates.push({
    candidateId: 'fixture-invented',
    disposition: 'recommended',
    reasonCodes: [],
    evidenceIds: [],
    unknownIds: [],
  });
  const report = score(authority, [prediction]);
  assert(report.safety.candidateInvention === 1);
  assert(report.safety.candidateSetMismatch === 1);
  return 2;
}

interface SyntheticAuthority {
  corpus: RankingValidatedCorpus;
  cases: [RankingResolvedCase, ...RankingResolvedCase[]];
  gold: [RankingGoldCase, ...RankingGoldCase[]];
}

function syntheticAuthority(
  variant:
    | 'tie'
    | 'empty'
    | 'hard-conflict'
    | 'incomparable'
    | 'ordered'
    | 'three-resolutions'
    | 'material-unbound'
    | 'unbound-preference',
): SyntheticAuthority {
  const candidateIds = ['fixture-a', 'fixture-b', 'fixture-e'] as const;
  const caseId = `fixture-${variant}`;
  const bindings = [
    {
      criterionId: 'fixture-success-bound',
      criterionKind: 'success-condition' as const,
      bindingState: 'bound' as const,
      materiality: 'material' as const,
      semanticFacet: 'fixture',
      targetFactDependencies: [],
      candidateFeatureDependencies: [],
      evidenceRequired: true,
      provenance: 'explicit-structured-approval' as const,
    },
    ...(variant === 'empty'
      ? []
      : [
          {
            criterionId:
              variant === 'material-unbound'
                ? 'fixture-success-unbound'
                : 'fixture-pref-bound',
            criterionKind:
              variant === 'material-unbound'
                ? ('success-condition' as const)
                : ('preference' as const),
            bindingState:
              variant === 'material-unbound'
                ? ('unbound' as const)
                : ('bound' as const),
            materiality:
              variant === 'material-unbound'
                ? ('material' as const)
                : ('non-material' as const),
            semanticFacet: null,
            targetFactDependencies: [],
            candidateFeatureDependencies: [],
            evidenceRequired: false,
            provenance: 'explicit-unbound-review' as const,
          },
        ]),
    ...(variant === 'unbound-preference'
      ? [
          {
            criterionId: 'fixture-pref-unbound',
            criterionKind: 'preference' as const,
            bindingState: 'unbound' as const,
            materiality: 'non-material' as const,
            semanticFacet: null,
            targetFactDependencies: [],
            candidateFeatureDependencies: [],
            evidenceRequired: false,
            provenance: 'explicit-unbound-review' as const,
          },
        ]
      : []),
  ];
  const request = {
    requestAuthorityId: 'fixture-request',
    capabilityFamily: 'authorization' as const,
    summary: 'fixture',
    successConditions: bindings
      .filter(({ criterionKind }) => criterionKind === 'success-condition')
      .map(({ criterionId }) => ({ criterionId, statement: 'fixture' })),
    hardConstraints: [
      {
        criterionId: 'fixture-hard',
        statement: 'fixture',
        reasonCode: 'known-hard-conflict',
      },
    ],
    preferences: bindings
      .filter(({ criterionKind }) => criterionKind === 'preference')
      .map(({ criterionId }) => ({
        criterionId,
        statement: 'fixture',
        source: 'explicit-structured-approval' as const,
      })),
  };
  const unresolved =
    variant === 'three-resolutions'
      ? candidateIds.map((candidateId, index) => ({
          candidateId,
          lane: 'evidence-needed' as const,
          retrievalOrder: index + 1,
          retrievalScore: 3 - index,
          unresolvedHardEvaluations: [
            {
              evaluationId: `fixture-evaluation-${String(index)}`,
              sourceKind: 'normalized-constraint' as const,
              modality: 'required' as const,
              facet: 'runtime',
              conceptId: null,
              profileFieldId: null,
              match: 'unresolved' as const,
              state: 'unresolved' as const,
              ruleId: 'fixture-rule',
            },
          ],
        }))
      : candidateIds.map((candidateId, index) => ({
          candidateId,
          lane:
            candidateId === 'fixture-e'
              ? ('evidence-needed' as const)
              : ('eligible' as const),
          retrievalOrder: index + 1,
          retrievalScore: 3 - index,
          unresolvedHardEvaluations:
            candidateId === 'fixture-e'
              ? [
                  {
                    evaluationId: 'fixture-evaluation',
                    sourceKind: 'normalized-constraint' as const,
                    modality: 'required' as const,
                    facet: 'runtime',
                    conceptId: null,
                    profileFieldId: null,
                    match: 'unresolved' as const,
                    state: 'unresolved' as const,
                    ruleId: 'fixture-rule',
                  },
                ]
              : [],
        }));
  const resolved = {
    binding: {
      caseId,
      capabilityFamily: 'authorization' as const,
      requestAuthorityId: request.requestAuthorityId,
      criterionAuthorityId: 'fixture-criteria',
      targetAuthorityId: 'fixture-target',
      candidateSetId: 'fixture-candidates',
      evidenceSetId: 'fixture-evidence',
      handoffAuthorityId: 'fixture-handoff',
      requestedMaximumResults: 3 as const,
      evidenceCutoff: '2026-08-10',
    },
    request,
    criteria: {
      criterionAuthorityId: 'fixture-criteria',
      requestAuthorityId: request.requestAuthorityId,
      sourceQueryDigest: '0'.repeat(64),
      normalizationDigest: '0'.repeat(64),
      requestDigest: '0'.repeat(64),
      approvalDigest: '0'.repeat(64),
      bindings,
      semanticDigest: '0'.repeat(64),
    },
    target: {
      targetAuthorityId: 'fixture-target',
      fingerprintId: 'fixture-fingerprint',
      facts: {
        runtime: 'node',
        framework: 'express',
        packageManager: 'pnpm',
        database: 'postgresql',
        redis: 'absent' as const,
        orm: 'prisma',
        workerCapability: 'capable' as const,
        deployment: 'long-running-container' as const,
        replicas: 1,
        region: 'fixture',
        identity: [],
        resources: [],
        dataPolicies: [],
      },
      withheldCategories: [],
      semanticDigest: '0'.repeat(64),
    },
    candidateSet: {
      candidateSetId: 'fixture-candidates',
      capabilityFamily: 'authorization' as const,
      candidates: candidateIds.map((candidateId) => ({
        candidateId,
        displayName: candidateId,
        repository: `fixture/${candidateId}`,
        packageName: null,
      })),
      semanticDigest: '0'.repeat(64),
    },
    evidence: {
      evidenceSetId: 'fixture-evidence',
      candidates: candidateIds.map((candidateId) => ({
        candidateId,
        observations: [],
        supportedSuccessConditionIds: [],
        supportedPreferenceIds: [],
        compatibility: {},
        closureAssertions: [],
      })),
      semanticDigest: '0'.repeat(64),
    },
    handoff: {
      handoffAuthorityId: 'fixture-handoff',
      retrievalRequestVersion: 'candidate-retrieval-request/1.2.0' as const,
      retrievalResultVersion: 'candidate-retrieval-result/1.3.0' as const,
      retrievalAlgorithmVersion:
        'deterministic-candidate-retrieval/1.3.0' as const,
      candidates: unresolved,
      excludedCandidateIds: ['fixture-excluded'],
      semanticDigest: '0'.repeat(64),
    },
  } satisfies RankingResolvedCase;
  const baseCandidates = [
    goldCandidate('fixture-a', 'recommended'),
    goldCandidate(
      'fixture-b',
      variant === 'empty'
        ? 'rejected'
        : variant === 'ordered'
          ? 'viable'
          : 'recommended',
    ),
    goldCandidate(
      'fixture-e',
      variant === 'empty' ? 'rejected' : 'insufficient-evidence',
    ),
  ];
  if (variant === 'empty')
    requireItem(baseCandidates, 0).disposition = 'rejected';
  if (variant === 'hard-conflict')
    requireItem(baseCandidates, 2).disposition = 'rejected';
  if (variant === 'material-unbound') {
    requireItem(baseCandidates, 0).disposition = 'insufficient-evidence';
    requireItem(baseCandidates, 1).disposition = 'insufficient-evidence';
  }
  const gold: RankingGoldCase = {
    caseId,
    outcome:
      variant === 'empty' || variant === 'hard-conflict'
        ? 'no-viable-candidate'
        : variant === 'material-unbound'
          ? 'insufficient-evidence'
          : 'recommend',
    allowedAlternativeOutcomes: [],
    candidates: baseCandidates,
    presentation:
      variant === 'empty' ||
      variant === 'hard-conflict' ||
      variant === 'material-unbound'
        ? []
        : ['fixture-a', 'fixture-b'],
    rankGroups:
      variant === 'tie' || variant === 'unbound-preference'
        ? [['fixture-a', 'fixture-b']]
        : [],
    rankRelations:
      variant === 'ordered'
        ? [{ higherCandidateId: 'fixture-a', lowerCandidateId: 'fixture-b' }]
        : [],
    incomparablePairs:
      variant === 'incomparable' ? [['fixture-a', 'fixture-b']] : [],
    hardConstraintConflicts:
      variant === 'hard-conflict'
        ? [
            {
              candidateId: 'fixture-e',
              constraintId: 'fixture-hard',
              reasonCode: 'known-hard-conflict',
              evidenceIds: ['fixture-evidence-hard'],
            },
          ]
        : [],
    requiredUnknowns:
      variant === 'material-unbound'
        ? [
            { candidateId: 'fixture-a', unknownId: 'fixture-unknown-a' },
            { candidateId: 'fixture-b', unknownId: 'fixture-unknown-b' },
          ]
        : [],
    evidenceNeededResolutions:
      variant === 'three-resolutions'
        ? (['satisfied', 'conflict', 'unresolved'] as const).map(
            (resolution, index) => ({
              candidateId: requireItem(candidateIds, index),
              evaluationId: `fixture-evaluation-${String(index)}`,
              resolution,
              evidenceIds: [`fixture-resolution-${String(index)}`],
            }),
          )
        : variant === 'empty'
          ? []
          : [
              {
                candidateId: 'fixture-e',
                evaluationId: 'fixture-evaluation',
                resolution: 'unresolved',
                evidenceIds: ['fixture-resolution'],
              },
            ],
    successConditionCoverage: candidateIds.flatMap((candidateId) =>
      request.successConditions.map(({ criterionId }) => ({
        candidateId,
        criterionId,
        state:
          criterionId === 'fixture-success-unbound'
            ? ('fail-closed' as const)
            : ('covered' as const),
      })),
    ),
    preferenceConsequences: request.preferences.map(({ criterionId }) => ({
      criterionId,
      state:
        criterionId === 'fixture-pref-unbound'
          ? ('ignored-unbound' as const)
          : ('applied' as const),
    })),
    noPreferenceHardening: true,
    rationaleNotes: [],
    provenance: {
      status: 'proposed',
      authoringSession: 'phase-10-m2-ranking-authoring',
      independentReviewStatus: 'not-reviewed',
      independentReviewer: null,
      reviewedAt: null,
      reviewReference: null,
    },
  };
  const corpus = {
    blind: {
      authorityVersion: 'ranking-v1-blind-cases/1.0.0',
      corpusId: 'ranking-v1',
      corpusVersion: '1.0.0',
      evidenceCutoff: '2026-08-10',
      requests: [request],
      criterionAuthorities: [resolved.criteria],
      targets: [resolved.target],
      candidateSets: [resolved.candidateSet],
      cases: [resolved.binding],
      semanticDigest: '0'.repeat(64),
    },
    evidence: {
      authorityVersion: 'ranking-v1-candidate-evidence/1.0.0',
      corpusId: 'ranking-v1',
      evidenceCutoff: '2026-08-10',
      evidenceSets: [resolved.evidence],
      semanticDigest: '0'.repeat(64),
    },
    handoff: {
      authorityVersion: 'ranking-v1-phase9-handoff/1.0.0',
      corpusId: 'ranking-v1',
      handoffSets: [resolved.handoff],
      semanticDigest: '0'.repeat(64),
    },
    gold: {
      authorityVersion: 'ranking-v1-proposed-gold/1.0.0',
      corpusId: 'ranking-v1',
      reviewStatus: 'proposed-not-independently-reviewed',
      cases: [gold],
      controlledPairDirections: [],
      semanticDigest: '0'.repeat(64),
    },
    audit: {
      authorityVersion: 'ranking-v1-audit-classification/1.0.0',
      corpusId: 'ranking-v1',
      cases: [],
      controlledPairs: [],
      semanticDigest: '0'.repeat(64),
    },
    review: {
      reviewRecordVersion: 'ranking-v1-review-record/1.0.0',
      corpusId: 'ranking-v1',
      goldAuthorityVersion: 'ranking-v1-proposed-gold/1.0.0',
      status: 'independent-review-pending',
      author: 'Codex',
      independentReviewer: null,
      reviewedAt: null,
      adjudication: 'not-started',
      disputedCaseIds: [],
      acceptedCaseIds: [],
      goldDigest: '0'.repeat(64),
      semanticDigest: '0'.repeat(64),
    },
  } satisfies RankingValidatedCorpus;
  return { corpus, cases: [resolved], gold: [gold] };
}

function goldCandidate(
  candidateId: string,
  disposition: RankingGoldCase['candidates'][number]['disposition'],
) {
  return {
    candidateId,
    disposition,
    reasonCodes: [],
    evidenceIds: [],
    unknownIds: [],
  };
}

function perfectPrediction(gold: RankingGoldCase): MutablePrediction {
  return {
    caseId: gold.caseId,
    outcome: gold.outcome,
    candidates: gold.candidates.map((candidate) => ({
      candidateId: candidate.candidateId,
      disposition: candidate.disposition,
      reasonCodes: [...candidate.reasonCodes],
      evidenceIds: [...candidate.evidenceIds],
      unknownIds: [...candidate.unknownIds],
    })),
    presentation: [...gold.presentation],
    rankGroups: gold.rankGroups.map((group) => [...group]),
    rankRelations: gold.rankRelations.map((relation) => ({ ...relation })),
    incomparablePairs: gold.incomparablePairs.map(
      (pair) => [...pair] as [string, string],
    ),
    hardConstraintConflicts: gold.hardConstraintConflicts.map((conflict) => ({
      ...conflict,
      evidenceIds: [...conflict.evidenceIds],
    })),
    evidenceNeededResolutions: gold.evidenceNeededResolutions.map(
      (resolution) => ({
        ...resolution,
        evidenceIds: [...resolution.evidenceIds],
      }),
    ),
    successConditionCoverage: gold.successConditionCoverage.map((coverage) => ({
      ...coverage,
    })),
    appliedPreferenceIds: gold.preferenceConsequences
      .filter(({ state }) => state === 'applied')
      .map(({ criterionId }) => criterionId),
    ignoredPreferenceIds: gold.preferenceConsequences
      .filter(({ state }) => state === 'ignored-unbound')
      .map(({ criterionId }) => criterionId),
    hardenedPreferenceIds: [],
  };
}

interface MutablePrediction {
  caseId: string;
  outcome: RankingCasePrediction['outcome'];
  candidates: {
    candidateId: string;
    disposition: RankingCasePrediction['candidates'][number]['disposition'];
    reasonCodes: string[];
    evidenceIds: string[];
    unknownIds: string[];
  }[];
  presentation: string[];
  rankGroups: string[][];
  rankRelations: {
    higherCandidateId: string;
    lowerCandidateId: string;
  }[];
  incomparablePairs: [string, string][];
  hardConstraintConflicts: {
    candidateId: string;
    constraintId: string;
    reasonCode: string;
    evidenceIds: string[];
  }[];
  evidenceNeededResolutions: {
    candidateId: string;
    evaluationId: string;
    resolution: RankingCasePrediction['evidenceNeededResolutions'][number]['resolution'];
    evidenceIds: string[];
  }[];
  successConditionCoverage: {
    candidateId: string;
    criterionId: string;
    state: RankingCasePrediction['successConditionCoverage'][number]['state'];
  }[];
  appliedPreferenceIds: string[];
  ignoredPreferenceIds: string[];
  hardenedPreferenceIds: string[];
}

function score(
  authority: SyntheticAuthority,
  predictions: readonly RankingCasePrediction[],
) {
  const withoutDigest = {
    predictionSetVersion: 'ranking-v1-prediction-set/1.0.0' as const,
    predictionSetId: 'synthetic-fixture',
    baselineId: 'synthetic-oracle-scorer-only',
    baselineVersion: 'ranking-synthetic-oracle/1.0.0',
    baselineSpecificationDigest: '0'.repeat(64),
    corpusId: 'ranking-v1' as const,
    corpusVersion: '1.0.0' as const,
    blindInputDigest: '0'.repeat(64),
    predictions,
  };
  const predictionSet: RankingPredictionSet = {
    ...withoutDigest,
    semanticDigest: rankingSemanticDigest(withoutDigest),
  };
  return scoreRankingPredictionSet(
    authority.corpus,
    authority.cases,
    predictionSet,
  );
}

function assert(condition: boolean): asserts condition {
  if (!condition) throw new Error('Ranking scorer fixture assertion failed.');
}

function requireItem<Value>(values: readonly Value[], index: number): Value {
  const value = values[index];
  if (value === undefined) {
    throw new Error('Ranking scorer fixture item is missing.');
  }
  return value;
}
