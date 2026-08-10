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
  readonly fixtureVersion: 'ranking-v1-scorer-fixtures/2.0.0';
  readonly scorerVersion: 'ranking-v1-scorer/2.0.0';
  readonly fixtureCount: 21;
  readonly assertionCount: number;
  readonly fixtures: readonly {
    readonly name: string;
    readonly result: 'passed';
  }[];
  readonly syntheticOracleOnly: true;
  readonly productComparator: false;
}

type DeepMutable<Value> = Value extends readonly [infer Left, infer Right]
  ? [DeepMutable<Left>, DeepMutable<Right>]
  : Value extends readonly (infer Item)[]
    ? DeepMutable<Item>[]
    : Value extends object
      ? { -readonly [Key in keyof Value]: DeepMutable<Value[Key]> }
      : Value;

type MutablePrediction = DeepMutable<RankingCasePrediction>;

export function runRankingScorerFixtures(): RankingScorerFixtureSummary {
  const fixtures: readonly { name: string; run: () => number }[] = [
    { name: 'perfect-prediction', run: perfectFixture },
    { name: 'legal-zero-denominators', run: zeroDenominatorFixture },
    { name: 'hard-conflict-safety-violation', run: hardConflictFixture },
    { name: 'incorrect-disposition', run: incorrectDispositionFixture },
    { name: 'wrong-responsible-outcome', run: wrongOutcomeFixture },
    { name: 'tie-split-incorrectly', run: tieSplitFixture },
    { name: 'incomparable-pair-falsely-ordered', run: incomparableFixture },
    { name: 'required-relation-reversed', run: reversedRelationFixture },
    { name: 'target-controlled-pair-unchanged', run: unchangedPairFixture },
    {
      name: 'target-controlled-pair-superset-not-exact',
      run: supersetPairFixture,
    },
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
      name: 'bound-preference-must-change-comparison',
      run: boundPreferenceFixture,
    },
    {
      name: 'unbound-preference-structurally-changed-order',
      run: unboundPreferenceFixture,
    },
    { name: 'preference-hardened', run: preferenceHardenedFixture },
    { name: 'candidate-invention-assessment', run: inventionAssessmentFixture },
    {
      name: 'candidate-invention-presentation-only',
      run: inventionPresentationFixture,
    },
    {
      name: 'candidate-invention-rank-relation-only',
      run: inventionRelationFixture,
    },
    {
      name: 'candidate-invention-incomparable-only',
      run: inventionIncomparableFixture,
    },
    {
      name: 'candidate-invention-resolution-and-coverage-only',
      run: inventionResolutionCoverageFixture,
    },
  ];
  let assertionCount = 0;
  const results = fixtures.map((fixture) => {
    try {
      assertionCount += fixture.run();
    } catch {
      throw new Error(`Ranking scorer fixture failed: ${fixture.name}`);
    }
    return { name: fixture.name, result: 'passed' as const };
  });
  return {
    fixtureVersion: 'ranking-v1-scorer-fixtures/2.0.0',
    scorerVersion: 'ranking-v1-scorer/2.0.0',
    fixtureCount: 21,
    assertionCount,
    fixtures: results,
    syntheticOracleOnly: true,
    productComparator: false,
  };
}

function perfectFixture(): number {
  const fixture = createFixture('tie');
  const report = score(fixture, fixture.gold.map(perfectPrediction));
  assert(report.overall.outcome.overall.errors === 0);
  assert(report.overall.dispositions.recommended.f1 === 1);
  assert(report.overall.partialOrder.ties.errors === 0);
  assert(report.overall.evidenceNeeded.overall.errors === 0);
  assert(Object.values(report.safety).every((count) => count === 0));
  return 5;
}

function zeroDenominatorFixture(): number {
  const fixture = createFixture('empty');
  const report = score(fixture, fixture.gold.map(perfectPrediction));
  assert(report.overall.partialOrder.overall.value === null);
  assert(report.overall.evidenceNeeded.overall.value === null);
  assert(
    report.overall.criterionBinding.boundPreferenceComparisonConsequence
      .value === null,
  );
  assert(report.overall.topThreeUsefulness.value === null);
  return 4;
}

function hardConflictFixture(): number {
  const fixture = createFixture('ordered');
  const prediction = perfectPrediction(requireItem(fixture.gold, 0));
  candidate(prediction, 'fixture-c').disposition = 'recommended';
  prediction.presentation = ['fixture-c'];
  prediction.rankGroups = [['fixture-c']];
  const report = score(fixture, [prediction]);
  assert(report.safety.knownHardConflictRecommended === 1);
  assert(report.safety.knownHardConflictRanked === 1);
  return 2;
}

function incorrectDispositionFixture(): number {
  const fixture = createFixture('ordered');
  const prediction = perfectPrediction(requireItem(fixture.gold, 0));
  candidate(prediction, 'fixture-a').disposition = 'rejected';
  const report = score(fixture, [prediction]);
  assert(report.overall.dispositions.recommended.falseNegative === 1);
  assert(report.overall.dispositions.rejected.falsePositive === 1);
  return 2;
}

function wrongOutcomeFixture(): number {
  const fixture = createFixture('ordered');
  const prediction = perfectPrediction(requireItem(fixture.gold, 0));
  prediction.outcome = 'insufficient-evidence';
  const report = score(fixture, [prediction]);
  assert(report.overall.outcome.overall.errors === 1);
  assert(
    report.overall.outcome.confusion.recommend['insufficient-evidence'] === 1,
  );
  return 2;
}

function tieSplitFixture(): number {
  const fixture = createFixture('tie');
  const prediction = perfectPrediction(requireItem(fixture.gold, 0));
  prediction.rankGroups = [['fixture-a'], ['fixture-b']];
  const report = score(fixture, [prediction]);
  assert(report.overall.partialOrder.ties.correct === 0);
  assert(report.overall.partialOrder.ties.errors === 1);
  return 2;
}

function incomparableFixture(): number {
  const fixture = createFixture('incomparable');
  const prediction = perfectPrediction(requireItem(fixture.gold, 0));
  prediction.incomparablePairs = [];
  prediction.rankRelations = [
    { higherCandidateId: 'fixture-a', lowerCandidateId: 'fixture-b' },
  ];
  const report = score(fixture, [prediction]);
  assert(report.overall.partialOrder.incomparable.errors === 1);
  assert(report.overall.partialOrder.falseOrdersOfIncomparable === 1);
  return 2;
}

function reversedRelationFixture(): number {
  const fixture = createFixture('ordered');
  const prediction = perfectPrediction(requireItem(fixture.gold, 0));
  prediction.rankRelations = [
    { higherCandidateId: 'fixture-b', lowerCandidateId: 'fixture-a' },
  ];
  const report = score(fixture, [prediction]);
  assert(report.overall.partialOrder.ordered.errors === 1);
  return 1;
}

function unchangedPairFixture(): number {
  const fixture = controlledFixture();
  const first = perfectPrediction(requireItem(fixture.gold, 0));
  const second = perfectPrediction(requireItem(fixture.gold, 1));
  candidate(second, 'fixture-a').disposition = 'recommended';
  candidate(second, 'fixture-b').disposition = 'viable';
  const report = score(fixture, [first, second]);
  assert(report.controlledPairs.unchangedWhenChangeRequired === 1);
  assert(report.controlledPairs.exactPairCorrect === 0);
  return 2;
}

function supersetPairFixture(): number {
  const fixture = controlledFixture();
  const first = perfectPrediction(requireItem(fixture.gold, 0));
  const second = perfectPrediction(requireItem(fixture.gold, 1));
  candidate(first, 'fixture-b').disposition = 'recommended';
  const report = score(fixture, [first, second]);
  assert(report.controlledPairs.wrongMaximalSet === 1);
  assert(report.controlledPairs.exactPairCorrect === 0);
  return 2;
}

function evidenceNeededFixture(): number {
  const fixture = createFixture('three-resolutions');
  const prediction = perfectPrediction(requireItem(fixture.gold, 0));
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
  const report = score(fixture, [prediction]);
  assert(report.overall.evidenceNeeded.satisfied.errors === 1);
  assert(report.overall.evidenceNeeded.conflict.errors === 1);
  assert(report.overall.evidenceNeeded.unresolved.errors === 1);
  return 3;
}

function missingResolutionFixture(): number {
  const fixture = createFixture('three-resolutions');
  const prediction = perfectPrediction(requireItem(fixture.gold, 0));
  prediction.evidenceNeededResolutions = [];
  const report = score(fixture, [prediction]);
  assert(report.safety.missingEvidenceNeededResolution === 3);
  return 1;
}

function unboundSuccessFixture(): number {
  const fixture = createFixture('material-unbound');
  const prediction = perfectPrediction(requireItem(fixture.gold, 0));
  const coverage = prediction.successConditionCoverage.find(
    ({ criterionId }) => criterionId === 'fixture-success-unbound',
  );
  if (coverage === undefined) throw new Error('Fixture coverage missing.');
  coverage.state = 'covered';
  candidate(prediction, 'fixture-a').disposition = 'recommended';
  const report = score(fixture, [prediction]);
  assert(report.safety.unboundSuccessConditionCountedFavorable === 1);
  assert(
    report.overall.criterionBinding.materialUnboundFailClosed.errors === 1,
  );
  return 2;
}

function boundPreferenceFixture(): number {
  const fixture = createFixture('preference-effect');
  const prediction = perfectPrediction(requireItem(fixture.gold, 0));
  prediction.preferenceConsequences = [
    {
      criterionId: 'fixture-pref-bound',
      state: 'bound-but-no-applicable-positive-comparison',
      affectedPairs: [],
    },
  ];
  const report = score(fixture, [prediction]);
  assert(
    report.overall.criterionBinding.boundPreferenceComparisonConsequence
      .errors === 1,
  );
  return 1;
}

function unboundPreferenceFixture(): number {
  const fixture = createFixture('unbound-preference');
  const prediction = perfectPrediction(requireItem(fixture.gold, 0));
  prediction.rankGroups = [];
  prediction.rankRelations = [
    { higherCandidateId: 'fixture-a', lowerCandidateId: 'fixture-b' },
  ];
  const report = score(fixture, [prediction]);
  assert(report.safety.unboundPreferenceAffectedOrder === 1);
  assert(
    report.overall.criterionBinding.unboundPreferenceCounterfactualNonEffect
      .errors === 1,
  );
  return 2;
}

function preferenceHardenedFixture(): number {
  const fixture = createFixture('ordered');
  const prediction = perfectPrediction(requireItem(fixture.gold, 0));
  prediction.hardenedPreferenceIds = ['fixture-pref-bound'];
  const report = score(fixture, [prediction]);
  assert(report.safety.preferenceHardenedIntoHardConflict === 1);
  assert(report.overall.criterionBinding.noPreferenceHardening.errors === 1);
  return 2;
}

function inventionAssessmentFixture(): number {
  return inventionFixture((prediction) => {
    prediction.candidates.push({
      candidateId: 'fixture-invented',
      disposition: 'recommended',
      reasonCodes: [],
      evidenceIds: [],
      unknownIds: [],
    });
  }, true);
}

function inventionPresentationFixture(): number {
  return inventionFixture((prediction) => {
    prediction.presentation.push('fixture-invented');
  });
}

function inventionRelationFixture(): number {
  return inventionFixture((prediction) => {
    prediction.rankRelations.push({
      higherCandidateId: 'fixture-a',
      lowerCandidateId: 'fixture-invented',
    });
  });
}

function inventionIncomparableFixture(): number {
  return inventionFixture((prediction) => {
    prediction.incomparablePairs.push(['fixture-b', 'fixture-invented']);
  });
}

function inventionResolutionCoverageFixture(): number {
  const fixture = createFixture('ordered');
  const resolutionPrediction = perfectPrediction(requireItem(fixture.gold, 0));
  resolutionPrediction.evidenceNeededResolutions.push({
    candidateId: 'fixture-invented',
    evaluationId: 'fixture-invented-resolution',
    resolution: 'unresolved',
    evidenceIds: [],
  });
  const resolutionReport = score(fixture, [resolutionPrediction]);
  assert(resolutionReport.safety.candidateInvention === 1);
  assert(resolutionReport.safety.candidateSetMismatch === 0);

  const coveragePrediction = perfectPrediction(requireItem(fixture.gold, 0));
  coveragePrediction.successConditionCoverage.push({
    candidateId: 'fixture-invented',
    criterionId: 'fixture-success-bound',
    state: 'covered',
  });
  const coverageReport = score(fixture, [coveragePrediction]);
  assert(coverageReport.safety.candidateInvention === 1);
  assert(coverageReport.safety.candidateSetMismatch === 0);
  return 4;
}

function inventionFixture(
  mutate: (prediction: MutablePrediction) => void,
  assessmentMismatch = false,
): number {
  const fixture = createFixture('ordered');
  const prediction = perfectPrediction(requireItem(fixture.gold, 0));
  mutate(prediction);
  const report = score(fixture, [prediction]);
  assert(report.safety.candidateInvention === 1);
  assert(report.safety.candidateSetMismatch === (assessmentMismatch ? 1 : 0));
  return 2;
}

interface Fixture {
  corpus: RankingValidatedCorpus;
  cases: RankingResolvedCase[];
  gold: RankingGoldCase[];
}

function createFixture(
  variant:
    | 'ordered'
    | 'tie'
    | 'incomparable'
    | 'empty'
    | 'three-resolutions'
    | 'material-unbound'
    | 'preference-effect'
    | 'unbound-preference',
): Fixture {
  const caseId = `fixture-${variant}`;
  const gold = baseGold(caseId);
  if (variant === 'tie' || variant === 'unbound-preference') {
    gold.candidates[0] = {
      ...requireItem(gold.candidates, 0),
      disposition: 'recommended',
    };
    gold.candidates[1] = {
      ...requireItem(gold.candidates, 1),
      disposition: 'recommended',
    };
    gold.rankGroups = [['fixture-a', 'fixture-b']];
    gold.rankRelations = [];
    gold.presentation = ['fixture-a', 'fixture-b'];
  }
  if (variant === 'incomparable') {
    gold.candidates[1] = {
      ...requireItem(gold.candidates, 1),
      disposition: 'recommended',
    };
    gold.rankGroups = [];
    gold.rankRelations = [];
    gold.incomparablePairs = [['fixture-a', 'fixture-b']];
    gold.presentation = ['fixture-a', 'fixture-b'];
  }
  if (variant === 'empty') {
    gold.outcome = 'no-viable-candidate';
    gold.candidates = gold.candidates.map((item) => ({
      ...item,
      disposition: 'rejected',
    }));
    gold.presentation = [];
    gold.rankGroups = [];
    gold.rankRelations = [];
    gold.hardConstraintConflicts = [];
    gold.preferenceConsequences = [];
  }
  if (variant === 'three-resolutions') {
    gold.evidenceNeededResolutions = [
      resolution('fixture-a', 'satisfied'),
      resolution('fixture-b', 'conflict'),
      resolution('fixture-c', 'unresolved'),
    ];
  }
  if (variant === 'material-unbound') {
    gold.successConditionCoverage.push({
      candidateId: 'fixture-a',
      criterionId: 'fixture-success-unbound',
      state: 'fail-closed',
    });
  }
  if (variant === 'preference-effect') {
    gold.preferenceConsequences = [
      {
        criterionId: 'fixture-pref-bound',
        state: 'applied-and-changed-supported-comparison',
        affectedPairs: [['fixture-a', 'fixture-b']],
      },
    ];
  }
  if (variant === 'unbound-preference') {
    gold.preferenceConsequences = [
      {
        criterionId: 'fixture-pref-unbound',
        state: 'ignored-unbound',
        affectedPairs: [],
      },
    ];
    gold.unboundPreferenceCounterfactuals = [
      {
        criterionId: 'fixture-pref-unbound',
        candidatePair: ['fixture-a', 'fixture-b'],
        relationWithoutPreference: 'tie',
      },
    ];
  }
  const resolved = baseResolved(caseId, variant);
  return assemble([resolved], [gold], []);
}

function controlledFixture(): Fixture {
  const first = baseResolved('fixture-controlled-a', 'ordered');
  const second: RankingResolvedCase = {
    ...first,
    binding: { ...first.binding, caseId: 'fixture-controlled-b' },
  };
  const firstGold = baseGold(first.binding.caseId);
  const secondGold = baseGold(second.binding.caseId);
  secondGold.candidates[0] = {
    ...requireItem(secondGold.candidates, 0),
    disposition: 'viable',
  };
  secondGold.candidates[1] = {
    ...requireItem(secondGold.candidates, 1),
    disposition: 'recommended',
  };
  secondGold.presentation = ['fixture-b', 'fixture-a'];
  secondGold.rankGroups = [['fixture-b'], ['fixture-a']];
  secondGold.rankRelations = [
    { higherCandidateId: 'fixture-b', lowerCandidateId: 'fixture-a' },
  ];
  return assemble(
    [first, second],
    [firstGold, secondGold],
    [
      {
        pairId: 'fixture-controlled-pair',
        firstCaseId: first.binding.caseId,
        firstMaximalCandidateIds: ['fixture-a'],
        secondCaseId: second.binding.caseId,
        secondMaximalCandidateIds: ['fixture-b'],
      },
    ],
  );
}

function assemble(
  cases: RankingResolvedCase[],
  gold: RankingGoldCase[],
  controlledPairDirections: RankingValidatedCorpus['gold']['controlledPairDirections'],
): Fixture {
  const corpus = {
    blind: {
      authorityVersion: 'ranking-v1-blind-cases/2.0.0',
      corpusId: 'ranking-v1',
      corpusVersion: '2.0.0',
      evidenceCutoff: 'fixture',
      requests: cases.map(({ request }) => request),
      criterionAuthorities: cases.map(({ criteria }) => criteria),
      targets: cases.map(({ target }) => target),
      candidateSets: cases.map(({ candidateSet }) => candidateSet),
      cases: cases.map(({ binding }) => binding),
      semanticDigest: 'fixture',
    },
    evidence: {
      authorityVersion: 'ranking-v1-candidate-evidence/2.0.0',
      corpusId: 'ranking-v1',
      evidenceCutoff: 'fixture',
      evidenceSets: cases.map(({ evidence }) => evidence),
      semanticDigest: 'fixture',
    },
    handoff: {
      authorityVersion: 'ranking-v1-phase9-handoff/2.0.0',
      corpusId: 'ranking-v1',
      handoffSets: cases.map(({ handoff }) => handoff),
      semanticDigest: 'fixture',
    },
    gold: {
      authorityVersion: 'ranking-v1-proposed-gold/2.0.0',
      corpusId: 'ranking-v1',
      reviewStatus: 'proposed-not-independently-reviewed',
      cases: gold,
      controlledPairDirections,
      semanticDigest: 'fixture',
    },
    audit: {
      authorityVersion: 'ranking-v1-audit-classification/2.0.0',
      corpusId: 'ranking-v1',
      cases: [],
      controlledPairs: [],
      semanticDigest: 'fixture',
    },
    reviewerRationale: {
      authorityVersion: 'ranking-v1-reviewer-rationale/1.0.0',
      corpusId: 'ranking-v1',
      status: 'author-rationale-for-independent-review',
      cases: [],
      semanticDigest: 'fixture',
    },
    review: {
      reviewRecordVersion: 'ranking-v1-review-record/2.0.0',
      corpusId: 'ranking-v1',
      goldAuthorityVersion: 'ranking-v1-proposed-gold/2.0.0',
      reviewerRationaleVersion: 'ranking-v1-reviewer-rationale/1.0.0',
      status: 'independent-review-pending',
      author: 'Codex',
      independentReviewer: null,
      reviewedAt: null,
      adjudication: 'not-started',
      disputedCaseIds: [],
      acceptedCaseIds: [],
      goldDigest: 'fixture',
      reviewerRationaleDigest: 'fixture',
      semanticDigest: 'fixture',
    },
  } satisfies RankingValidatedCorpus;
  return { corpus, cases, gold };
}

function baseResolved(
  caseId: string,
  variant: Parameters<typeof createFixture>[0],
): RankingResolvedCase {
  const bindings = [
    {
      criterionId: 'fixture-success-bound',
      criterionKind: 'success-condition' as const,
      bindingState: 'bound' as const,
      materiality: 'material' as const,
      semanticFacet: 'fixture',
      semanticConcept: 'fixture-bound-success',
      targetFactDependencies: [],
      candidateFeatureDependencies: ['fixture-feature'],
      comparisonRuleId: 'candidate-has-all/1.0.0',
      expectedValues: ['supported'],
      evidenceRequired: true,
      provenance: 'explicit-structured-approval' as const,
    },
    ...(variant === 'material-unbound'
      ? [
          {
            criterionId: 'fixture-success-unbound',
            criterionKind: 'success-condition' as const,
            bindingState: 'unbound' as const,
            materiality: 'material' as const,
            semanticFacet: null,
            semanticConcept: null,
            targetFactDependencies: [],
            candidateFeatureDependencies: [],
            comparisonRuleId: null,
            expectedValues: [],
            evidenceRequired: false,
            provenance: 'explicit-unbound-review' as const,
          },
        ]
      : []),
    ...(variant === 'unbound-preference'
      ? [
          {
            criterionId: 'fixture-pref-unbound',
            criterionKind: 'preference' as const,
            bindingState: 'unbound' as const,
            materiality: 'non-material' as const,
            semanticFacet: null,
            semanticConcept: null,
            targetFactDependencies: [],
            candidateFeatureDependencies: [],
            comparisonRuleId: null,
            expectedValues: [],
            evidenceRequired: false,
            provenance: 'explicit-unbound-review' as const,
          },
        ]
      : variant === 'empty'
        ? []
        : [
            {
              criterionId: 'fixture-pref-bound',
              criterionKind: 'preference' as const,
              bindingState: 'bound' as const,
              materiality: 'non-material' as const,
              semanticFacet: 'fixture',
              semanticConcept: 'fixture-preference',
              targetFactDependencies: [],
              candidateFeatureDependencies: ['fixture-feature'],
              comparisonRuleId: 'prefer-candidate-values/1.0.0',
              expectedValues: ['supported'],
              evidenceRequired: true,
              provenance: 'explicit-structured-approval' as const,
            },
          ]),
  ];
  const candidateIds = ['fixture-a', 'fixture-b', 'fixture-c'];
  return {
    binding: {
      caseId,
      capabilityFamily: 'authorization',
      requestAuthorityId: `${caseId}-request`,
      criterionAuthorityId: `${caseId}-criteria`,
      targetAuthorityId: `${caseId}-target`,
      candidateSetId: `${caseId}-candidates`,
      evidenceSetId: `${caseId}-evidence`,
      handoffAuthorityId: `${caseId}-handoff`,
      requestedMaximumResults: 3,
      evidenceCutoff: 'fixture',
    },
    request: {
      requestAuthorityId: `${caseId}-request`,
      capabilityFamily: 'authorization',
      summary: 'synthetic scorer fixture',
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
    },
    criteria: {
      criterionAuthorityId: `${caseId}-criteria`,
      requestAuthorityId: `${caseId}-request`,
      sourceQueryDigest: 'fixture',
      normalizationDigest: 'fixture',
      requestDigest: 'fixture',
      approvalDigest: 'fixture',
      bindings,
      hardConstraintRules: [
        {
          constraintId: 'fixture-hard',
          modality: 'prohibited',
          semanticFacet: 'fixture',
          semanticConcept: 'fixture-conflict',
          targetFactDependencies: [],
          candidateFeatureDependencies: ['fixture-feature'],
          evaluationRuleId: 'candidate-has-all/1.0.0',
          expectedValues: ['conflict'],
        },
      ],
      semanticDigest: 'fixture',
    },
    target: {
      targetAuthorityId: `${caseId}-target`,
      fingerprintId: `${caseId}-fingerprint`,
      facts: {
        runtime: 'node',
        framework: 'fixture',
        packageManager: 'pnpm',
        database: 'postgresql',
        redis: 'absent',
        orm: 'fixture',
        workerCapability: 'capable',
        deployment: 'long-running-container',
        replicas: 1,
        region: 'fixture',
        identity: [],
        resources: [],
        dataPolicies: [],
        externalNetwork: 'prohibited',
      },
      withheldCategories: [],
      semanticDigest: 'fixture',
    },
    candidateSet: {
      candidateSetId: `${caseId}-candidates`,
      capabilityFamily: 'authorization',
      candidates: candidateIds.map((candidateId) => ({
        candidateId,
        displayName: candidateId,
        repository: `fixture/${candidateId}`,
        packageName: null,
        identityKind: 'scenario-synthetic-candidate',
      })),
      semanticDigest: 'fixture',
    },
    evidence: {
      evidenceSetId: `${caseId}-evidence`,
      candidates: candidateIds.map((candidateId) => ({
        candidateId,
        observations: [],
      })),
      semanticDigest: 'fixture',
    },
    handoff: {
      handoffAuthorityId: `${caseId}-handoff`,
      retrievalRequestVersion: 'candidate-retrieval-request/1.2.0',
      retrievalResultVersion: 'candidate-retrieval-result/1.3.0',
      retrievalAlgorithmVersion: 'deterministic-candidate-retrieval/1.3.0',
      candidates: candidateIds.map((candidateId, index) => ({
        candidateId,
        lane: 'eligible' as const,
        retrievalOrder: index + 1,
        retrievalScore: 3 - index,
        unresolvedHardEvaluations: [],
      })),
      excludedCandidateIds: ['fixture-excluded'],
      semanticDigest: 'fixture',
    },
  };
}

function baseGold(caseId: string): MutableGold {
  return {
    caseId,
    outcome: 'recommend',
    allowedAlternativeOutcomes: [],
    candidates: [
      goldCandidate('fixture-a', 'recommended'),
      goldCandidate('fixture-b', 'viable'),
      goldCandidate('fixture-c', 'rejected'),
    ],
    presentation: ['fixture-a', 'fixture-b'],
    rankGroups: [['fixture-a'], ['fixture-b']],
    rankRelations: [
      { higherCandidateId: 'fixture-a', lowerCandidateId: 'fixture-b' },
    ],
    incomparablePairs: [],
    hardConstraintConflicts: [
      {
        candidateId: 'fixture-c',
        constraintId: 'fixture-hard',
        reasonCode: 'known-hard-conflict',
        evidenceIds: ['fixture-evidence-c'],
      },
    ],
    requiredUnknowns: [],
    evidenceNeededResolutions: [],
    successConditionCoverage: [
      {
        candidateId: 'fixture-a',
        criterionId: 'fixture-success-bound',
        state: 'covered',
      },
      {
        candidateId: 'fixture-b',
        criterionId: 'fixture-success-bound',
        state: 'covered',
      },
      {
        candidateId: 'fixture-c',
        criterionId: 'fixture-success-bound',
        state: 'not-covered',
      },
    ],
    preferenceConsequences: [
      {
        criterionId: 'fixture-pref-bound',
        state: 'bound-but-no-applicable-positive-comparison',
        affectedPairs: [],
      },
    ],
    unboundPreferenceCounterfactuals: [],
    noPreferenceHardening: true,
    provenance: {
      status: 'proposed',
      authoringSession: 'phase-10-m2-ranking-authoring',
      independentReviewStatus: 'not-reviewed',
      independentReviewer: null,
      reviewedAt: null,
      reviewReference: null,
    },
  };
}

type MutableGold = DeepMutable<RankingGoldCase>;

function goldCandidate(
  candidateId: string,
  disposition: 'recommended' | 'viable' | 'rejected',
) {
  return {
    candidateId,
    disposition,
    reasonCodes: [`fixture-reason-${candidateId}`],
    evidenceIds: [`fixture-evidence-${candidateId.slice(-1)}`],
    unknownIds: [],
  };
}

function resolution(
  candidateId: string,
  state: 'satisfied' | 'conflict' | 'unresolved',
) {
  return {
    candidateId,
    evaluationId: `fixture-${state}`,
    resolution: state,
    evidenceIds: [`fixture-evidence-${candidateId.slice(-1)}`],
  };
}

function perfectPrediction(gold: RankingGoldCase): MutablePrediction {
  return structuredClone({
    caseId: gold.caseId,
    outcome: gold.outcome,
    candidates: gold.candidates,
    presentation: gold.presentation,
    rankGroups: gold.rankGroups,
    rankRelations: gold.rankRelations,
    incomparablePairs: gold.incomparablePairs,
    hardConstraintConflicts: gold.hardConstraintConflicts,
    evidenceNeededResolutions: gold.evidenceNeededResolutions,
    successConditionCoverage: gold.successConditionCoverage,
    preferenceConsequences: gold.preferenceConsequences,
    unboundPreferenceCounterfactuals: gold.unboundPreferenceCounterfactuals,
    hardenedPreferenceIds: [],
  }) as unknown as MutablePrediction;
}

function score(
  fixture: Fixture,
  predictions: readonly RankingCasePrediction[],
) {
  const withoutDigest = {
    predictionSetVersion: 'ranking-v1-prediction-set/2.0.0' as const,
    predictionSetId: 'fixture-predictions',
    baselineId: 'synthetic-oracle-scorer-only',
    baselineVersion: 'ranking-synthetic-oracle/2.0.0',
    baselineSpecificationDigest: 'fixture',
    corpusId: 'ranking-v1' as const,
    corpusVersion: '2.0.0' as const,
    blindInputDigest: 'fixture',
    predictions,
  };
  const predictionSet: RankingPredictionSet = {
    ...withoutDigest,
    semanticDigest: rankingSemanticDigest(withoutDigest),
  };
  return scoreRankingPredictionSet(
    fixture.corpus,
    fixture.cases,
    predictionSet,
  );
}

function candidate(prediction: MutablePrediction, candidateId: string) {
  const value = prediction.candidates.find(
    (item) => item.candidateId === candidateId,
  );
  if (value === undefined) throw new Error('Fixture candidate missing.');
  return value;
}

function requireItem<Item>(items: readonly Item[], index: number): Item {
  const value = items[index];
  if (value === undefined) throw new Error('Fixture item missing.');
  return value;
}

function assert(condition: boolean): asserts condition {
  if (!condition) throw new Error('Ranking scorer fixture failed.');
}
