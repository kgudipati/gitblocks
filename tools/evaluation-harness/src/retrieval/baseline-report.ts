import type {
  MetricValue,
  RetrievalCaseScore,
  RetrievalDiagnostic,
  RetrievalFamily,
  RetrievalPredictionSet,
  RetrievalScoreReport,
  ValidatedRetrievalCorpus,
} from './contracts.ts';
import { RETRIEVAL_FAMILIES } from './contracts.ts';
import {
  RETRIEVAL_BASELINE_PREDICTION_SET_IDS,
  RETRIEVAL_BASELINE_VERSIONS,
} from './baselines/contracts.ts';
import { metric, summarizeMetrics } from './scoring.ts';
import { createRetrievalSchemaRegistry } from './schema-registry.ts';
import { retrievalSemanticDigest } from './stable-json.ts';
import type { RetrievalFixtureOracleSummary } from './synthetic-fixture-oracle.ts';

const EXPECTED = {
  corpusDigest:
    'f92eac1a3963c4f52fb135189e82a0196dbccd559af32bc57a6a7e64226eb842',
  taxonomyDigest:
    '8b2806ec8862390d0368e1c06ed657983916530f1207be9072d9e4787a61d80e',
  queryInputSchemaDigest:
    'd48e018b71f8e6947f60f4d3559c48047daba8a335168b51f37bfb5199c81b9b',
  normalizationSchemaDigest:
    'bdd7db9510937c0728f87b0d83f75dbd374555fa17c2b1e4a56399d9f9f2d06b',
  profileSchemaDigest:
    '3bbfdf2050c13a3d70e9dc289db7c8768a6fdcba8605cf12191e08560387af61',
  profileAuthoritySchemaDigest:
    '7a79a1671bf461127099e3ae2f75d29e949387987041bd3402f2614b747ed8cf',
  profileAuthorityDigest:
    '9845ff004c83879de423a566ba906f033a83f7338fca9fc38b6324feffd07bdd',
  profileCoverageDigest:
    'cd81889b92797ddd48ee69623e68c7ba1b614c2948a47896c7763c281f5298b1',
  catalogDigest:
    '4819dd94cb1bbe5e27c31ca5ca55976da1442987a792bf438d96681021cb8634',
} as const;

const V1_MEASUREMENT_STATEMENT =
  'Development measurements against proposed, not independently reviewed authority; not production-retrieval quality evidence.' as const;
const V2_MEASUREMENT_STATEMENT =
  'Blind baseline measurements against independently reviewed retrieval-v2 relevance; no production retrieval was scored.' as const;

interface FamilyMeasurement {
  readonly family: RetrievalFamily;
  readonly retrievalCases: number;
  readonly positiveCases: number;
  readonly metrics: {
    readonly recallAt10: MetricValue;
    readonly meanReciprocalRank: MetricValue;
    readonly ndcgAt10: MetricValue;
    readonly exactDuplicateRate: MetricValue;
    readonly equivalenceDuplicateRate: MetricValue;
    readonly positiveCaseHitRate: MetricValue;
    readonly hardFilterAccuracy: MetricValue;
    readonly noEligibleCandidateAccuracy: MetricValue;
    readonly clarificationAccuracy: MetricValue;
    readonly aliasExpansionCorrectness: MetricValue;
    readonly prohibitedConstraintPreservation: MetricValue;
  };
  readonly safety: SafetySummary;
}

interface SafetySummary {
  readonly hardFilterErrors: number;
  readonly top10Violations: {
    readonly conflict: number;
    readonly negativeControl: number;
    readonly laneError: number;
  };
}

export interface ContentFreeRetrievalMeasurement {
  readonly baselineId: string;
  readonly baselineVersion: string;
  readonly predictionSetId: string;
  readonly predictionSetDigest: string;
  readonly scoreReportDigest: string;
  readonly sharedNormalizationComponent: true;
  readonly candidateDecisionCount: number;
  readonly emittedResultCount: number;
  readonly aggregateMetrics: {
    readonly macro: RetrievalScoreReport['macro'];
    readonly micro: RetrievalScoreReport['micro'];
    readonly familyCoverage: MetricValue;
  };
  readonly perFamily: readonly FamilyMeasurement[];
  readonly safety: SafetySummary;
}

export interface RetrievalBaselineReport {
  readonly reportVersion:
    | typeof RETRIEVAL_BASELINE_VERSIONS.report
    | typeof RETRIEVAL_BASELINE_VERSIONS.reportV2;
  readonly goldStatus: 'proposed-not-reviewed' | 'relevance-reviewed';
  readonly measurementStatement:
    typeof V1_MEASUREMENT_STATEMENT | typeof V2_MEASUREMENT_STATEMENT;
  readonly corpus: {
    readonly id: 'retrieval-v1' | 'retrieval-v2';
    readonly version:
      'retrieval-evaluation-corpus/1.0.0' | 'retrieval-evaluation-corpus/2.0.0';
    readonly semanticDigest: string;
  };
  readonly taxonomy: {
    readonly version: string;
    readonly semanticDigest: string;
  };
  readonly querySchemas: {
    readonly inputDigest: string;
    readonly normalizationResultDigest: string;
  };
  readonly profileAuthority: {
    readonly profileSchemaDigest: string;
    readonly authoritySchemaDigest: string;
    readonly version: string;
    readonly semanticDigest: string;
    readonly coverageReportVersion: 'deterministic-profile-coverage-report/1.0.0';
    readonly coverageReportDigest: string;
  };
  readonly catalog: {
    readonly version: string;
    readonly semanticDigest: string;
  };
  readonly equivalenceAuthority: {
    readonly version: 'retrieval-equivalence-authority/1.0.0';
    readonly groupCount: number;
  };
  readonly baselineRunnerVersion: typeof RETRIEVAL_BASELINE_VERSIONS.runner;
  readonly toolchain: { readonly node: '24.18.0'; readonly pnpm: '11.17.0' };
  readonly caseCounts: {
    readonly normalization: 20;
    readonly retrieval: 30;
    readonly positiveRetrieval: 25;
    readonly noEligibleRetrieval: 5;
  };
  readonly ordinaryBaselines: readonly ContentFreeRetrievalMeasurement[];
  readonly weakControls: readonly ContentFreeRetrievalMeasurement[];
  readonly safetyControls: readonly ContentFreeRetrievalMeasurement[];
  readonly syntheticControls: readonly RetrievalFixtureOracleSummary[];
  readonly reportSemanticDigest: string;
}

export interface RetrievalBaselineReportInputs {
  readonly corpus: ValidatedRetrievalCorpus;
  readonly familyOnly: {
    readonly prediction: RetrievalPredictionSet;
    readonly score: RetrievalScoreReport;
  };
  readonly exactKeyword: {
    readonly prediction: RetrievalPredictionSet;
    readonly score: RetrievalScoreReport;
  };
  readonly aliasExpanded: {
    readonly prediction: RetrievalPredictionSet;
    readonly score: RetrievalScoreReport;
  };
  readonly alwaysAbstain: {
    readonly prediction: RetrievalPredictionSet;
    readonly score: RetrievalScoreReport;
  };
  readonly constraintViolating: {
    readonly prediction: RetrievalPredictionSet;
    readonly score: RetrievalScoreReport;
  };
  readonly fixtureOracle: RetrievalFixtureOracleSummary;
}

export function retrievalBaselineReportSemanticDigest(
  value:
    | RetrievalBaselineReport
    | Omit<RetrievalBaselineReport, 'reportSemanticDigest'>,
): string {
  const { reportSemanticDigest, ...projection } =
    value as RetrievalBaselineReport;
  void reportSemanticDigest;
  return retrievalSemanticDigest(projection);
}

export function createRetrievalBaselineReportV1(
  inputs: RetrievalBaselineReportInputs,
  startDirectory = process.cwd(),
): RetrievalBaselineReport {
  return createRetrievalBaselineReport(inputs, startDirectory, 'v1');
}

export function createRetrievalBaselineReportV2(
  inputs: RetrievalBaselineReportInputs,
  startDirectory = process.cwd(),
): RetrievalBaselineReport {
  return createRetrievalBaselineReport(inputs, startDirectory, 'v2');
}

function createRetrievalBaselineReport(
  inputs: RetrievalBaselineReportInputs,
  startDirectory: string,
  authorityVersion: 'v1' | 'v2',
): RetrievalBaselineReport {
  const expectedId =
    authorityVersion === 'v1' ? 'retrieval-v1' : 'retrieval-v2';
  const expectedVersion =
    authorityVersion === 'v1'
      ? 'retrieval-evaluation-corpus/1.0.0'
      : 'retrieval-evaluation-corpus/2.0.0';
  if (
    inputs.corpus.manifest.corpusId !== expectedId ||
    inputs.corpus.manifest.corpusVersion !== expectedVersion
  ) {
    throw new Error('Retrieval baseline report corpus binding is invalid.');
  }
  const ordinaryBaselines = [
    measurement(
      'family-only',
      RETRIEVAL_BASELINE_VERSIONS.familyOnly,
      inputs.familyOnly.prediction,
      inputs.familyOnly.score,
    ),
    measurement(
      'exact-keyword',
      RETRIEVAL_BASELINE_VERSIONS.exactKeyword,
      inputs.exactKeyword.prediction,
      inputs.exactKeyword.score,
    ),
    measurement(
      'alias-expanded',
      RETRIEVAL_BASELINE_VERSIONS.aliasExpanded,
      inputs.aliasExpanded.prediction,
      inputs.aliasExpanded.score,
    ),
  ];
  const weakControls = [
    measurement(
      'always-abstain',
      RETRIEVAL_BASELINE_VERSIONS.alwaysAbstain,
      inputs.alwaysAbstain.prediction,
      inputs.alwaysAbstain.score,
    ),
  ];
  const safetyControls = [
    measurement(
      'constraint-violating',
      RETRIEVAL_BASELINE_VERSIONS.constraintViolating,
      inputs.constraintViolating.prediction,
      inputs.constraintViolating.score,
    ),
  ];
  const withoutDigest = {
    reportVersion:
      authorityVersion === 'v1'
        ? RETRIEVAL_BASELINE_VERSIONS.report
        : RETRIEVAL_BASELINE_VERSIONS.reportV2,
    goldStatus:
      authorityVersion === 'v1'
        ? ('proposed-not-reviewed' as const)
        : ('relevance-reviewed' as const),
    measurementStatement:
      authorityVersion === 'v1'
        ? V1_MEASUREMENT_STATEMENT
        : V2_MEASUREMENT_STATEMENT,
    corpus: {
      id: expectedId,
      version: expectedVersion,
      semanticDigest: inputs.corpus.manifest.corpusSemanticDigest,
    },
    taxonomy: {
      version: inputs.corpus.manifest.taxonomyVersion,
      semanticDigest: inputs.corpus.manifest.taxonomyDigest,
    },
    querySchemas: {
      inputDigest: inputs.corpus.manifest.queryInputSchemaDigest,
      normalizationResultDigest:
        inputs.corpus.manifest.normalizationResultSchemaDigest,
    },
    profileAuthority: {
      profileSchemaDigest: inputs.corpus.manifest.profileSchemaDigest,
      authoritySchemaDigest:
        inputs.corpus.manifest.profileAuthoritySchemaDigest,
      version: inputs.corpus.manifest.profileAuthorityVersion,
      semanticDigest: inputs.corpus.manifest.profileAuthorityDigest,
      coverageReportVersion:
        'deterministic-profile-coverage-report/1.0.0' as const,
      coverageReportDigest: EXPECTED.profileCoverageDigest,
    },
    catalog: {
      version: inputs.corpus.manifest.catalogVersion,
      semanticDigest: inputs.corpus.manifest.catalogDigest,
    },
    equivalenceAuthority: {
      version: inputs.corpus.equivalence.equivalenceVersion,
      groupCount: inputs.corpus.equivalence.groups.length,
    },
    baselineRunnerVersion: RETRIEVAL_BASELINE_VERSIONS.runner,
    toolchain: { node: '24.18.0' as const, pnpm: '11.17.0' as const },
    caseCounts: {
      normalization: 20 as const,
      retrieval: 30 as const,
      positiveRetrieval: 25 as const,
      noEligibleRetrieval: 5 as const,
    },
    ordinaryBaselines,
    weakControls,
    safetyControls,
    syntheticControls: [inputs.fixtureOracle],
  } satisfies Omit<RetrievalBaselineReport, 'reportSemanticDigest'>;
  const report: RetrievalBaselineReport = {
    ...withoutDigest,
    reportSemanticDigest: retrievalBaselineReportSemanticDigest(withoutDigest),
  };
  const diagnostics =
    authorityVersion === 'v1'
      ? validateRetrievalBaselineReportV1(report, startDirectory)
      : validateRetrievalBaselineReportV2(report, startDirectory);
  if (diagnostics.length > 0) {
    throw new Error(
      `Retrieval baseline report is invalid: ${diagnostics[0]?.code ?? 'unknown'}.`,
    );
  }
  return report;
}

function measurement(
  baselineId: string,
  baselineVersion: string,
  prediction: RetrievalPredictionSet,
  score: RetrievalScoreReport,
): ContentFreeRetrievalMeasurement {
  return {
    baselineId,
    baselineVersion,
    predictionSetId: prediction.predictionSetId,
    predictionSetDigest: prediction.semanticDigest,
    scoreReportDigest: score.semanticDigest,
    sharedNormalizationComponent: true,
    candidateDecisionCount: prediction.predictions.reduce(
      (count, item) =>
        count +
        (item.caseKind === 'retrieval' ? item.candidateDecisions.length : 0),
      0,
    ),
    emittedResultCount: prediction.predictions.reduce(
      (count, item) =>
        count + (item.caseKind === 'retrieval' ? item.results.length : 0),
      0,
    ),
    aggregateMetrics: {
      macro: score.macro,
      micro: score.micro,
      familyCoverage: score.familyCoverage,
    },
    perFamily: RETRIEVAL_FAMILIES.map((family) =>
      familyMeasurement(family, score),
    ),
    safety: scoreSafety(score.perCase.filter(isRetrievalScore)),
  };
}

function familyMeasurement(
  family: RetrievalFamily,
  score: RetrievalScoreReport,
): FamilyMeasurement {
  const retrieval = score.perCase.filter(
    (item): item is RetrievalCaseScore =>
      item.caseKind === 'retrieval' && item.family === family,
  );
  const familyScore = score.perFamily.find((item) => item.family === family);
  if (familyScore === undefined) {
    throw new Error('Retrieval score report is missing a family.');
  }
  return {
    family,
    retrievalCases: familyScore.retrievalCases,
    positiveCases: familyScore.positiveCases,
    metrics: {
      recallAt10: summarizeMetrics(
        retrieval.map(({ recallAt10 }) => recallAt10),
      ),
      meanReciprocalRank: summarizeMetrics(
        retrieval.map(({ meanReciprocalRank }) => meanReciprocalRank),
      ),
      ndcgAt10: summarizeMetrics(retrieval.map(({ ndcgAt10 }) => ndcgAt10)),
      exactDuplicateRate: combineMetrics(
        retrieval.map(({ exactDuplicateRate }) => exactDuplicateRate),
      ),
      equivalenceDuplicateRate: combineMetrics(
        retrieval.map(
          ({ equivalenceDuplicateRate }) => equivalenceDuplicateRate,
        ),
      ),
      positiveCaseHitRate: familyScore.positiveCaseHitRate,
      hardFilterAccuracy: familyScore.hardFilterAccuracy,
      noEligibleCandidateAccuracy: combineMetrics(
        retrieval.map(
          ({ noEligibleCandidateAccuracy }) => noEligibleCandidateAccuracy,
        ),
      ),
      clarificationAccuracy: familyScore.clarificationAccuracy,
      aliasExpansionCorrectness: familyScore.aliasExpansionCorrectness,
      prohibitedConstraintPreservation:
        familyScore.prohibitedConstraintPreservation,
    },
    safety: scoreSafety(retrieval),
  };
}

function scoreSafety(scores: readonly RetrievalCaseScore[]): SafetySummary {
  return {
    hardFilterErrors: scores.reduce(
      (count, item) =>
        count +
        (item.hardFilter.accuracy.denominator -
          item.hardFilter.accuracy.numerator),
      0,
    ),
    top10Violations: scores.reduce(
      (total, item) => ({
        conflict: total.conflict + item.top10Violations.conflict,
        negativeControl:
          total.negativeControl + item.top10Violations.negativeControl,
        laneError: total.laneError + item.top10Violations.laneError,
      }),
      { conflict: 0, negativeControl: 0, laneError: 0 },
    ),
  };
}

function combineMetrics(values: readonly MetricValue[]): MetricValue {
  return metric(
    values.reduce((sum, value) => sum + value.numerator, 0),
    values.reduce((sum, value) => sum + value.denominator, 0),
  );
}

function isRetrievalScore(
  value: RetrievalScoreReport['perCase'][number],
): value is RetrievalCaseScore {
  return value.caseKind === 'retrieval';
}

export function validateRetrievalBaselineReportV1(
  value: unknown,
  startDirectory = process.cwd(),
): readonly RetrievalDiagnostic[] {
  return validateRetrievalBaselineReport(value, startDirectory, 'v1');
}

export function validateRetrievalBaselineReportV2(
  value: unknown,
  startDirectory = process.cwd(),
): readonly RetrievalDiagnostic[] {
  return validateRetrievalBaselineReport(value, startDirectory, 'v2');
}

function validateRetrievalBaselineReport(
  value: unknown,
  startDirectory: string,
  authorityVersion: 'v1' | 'v2',
): readonly RetrievalDiagnostic[] {
  const diagnostics = [
    ...createRetrievalSchemaRegistry(startDirectory, authorityVersion).validate(
      'baseline-report',
      value,
    ),
  ];
  if (diagnostics.length > 0) return diagnostics;
  const report = value as RetrievalBaselineReport;
  const add = (code: string, path: string): void => {
    diagnostics.push({
      code,
      path,
      message: 'Retrieval baseline report is inconsistent.',
    });
  };
  if (
    retrievalBaselineReportSemanticDigest(report) !==
    report.reportSemanticDigest
  ) {
    add('retrieval.baseline-report.digest', '/reportSemanticDigest');
  }
  if (
    report.corpus.semanticDigest !==
      (authorityVersion === 'v1'
        ? EXPECTED.corpusDigest
        : '2e76715d952b84f3eb124c662ecb0b43acbbe98df1ad5f63b366d5f393a2f84e') ||
    report.taxonomy.semanticDigest !== EXPECTED.taxonomyDigest ||
    report.querySchemas.inputDigest !== EXPECTED.queryInputSchemaDigest ||
    report.querySchemas.normalizationResultDigest !==
      EXPECTED.normalizationSchemaDigest ||
    report.profileAuthority.profileSchemaDigest !==
      EXPECTED.profileSchemaDigest ||
    report.profileAuthority.authoritySchemaDigest !==
      EXPECTED.profileAuthoritySchemaDigest ||
    report.profileAuthority.semanticDigest !==
      EXPECTED.profileAuthorityDigest ||
    report.profileAuthority.coverageReportDigest !==
      EXPECTED.profileCoverageDigest ||
    report.catalog.semanticDigest !== EXPECTED.catalogDigest
  ) {
    add('retrieval.baseline-report.authority-binding', '');
  }
  validateSection(
    report.ordinaryBaselines,
    [
      [
        'family-only',
        RETRIEVAL_BASELINE_VERSIONS.familyOnly,
        RETRIEVAL_BASELINE_PREDICTION_SET_IDS.familyOnly,
      ],
      [
        'exact-keyword',
        RETRIEVAL_BASELINE_VERSIONS.exactKeyword,
        RETRIEVAL_BASELINE_PREDICTION_SET_IDS.exactKeyword,
      ],
      [
        'alias-expanded',
        RETRIEVAL_BASELINE_VERSIONS.aliasExpanded,
        RETRIEVAL_BASELINE_PREDICTION_SET_IDS.aliasExpanded,
      ],
    ],
    diagnostics,
    '/ordinaryBaselines',
  );
  validateSection(
    report.weakControls,
    [
      [
        'always-abstain',
        RETRIEVAL_BASELINE_VERSIONS.alwaysAbstain,
        RETRIEVAL_BASELINE_PREDICTION_SET_IDS.alwaysAbstain,
      ],
    ],
    diagnostics,
    '/weakControls',
  );
  validateSection(
    report.safetyControls,
    [
      [
        'constraint-violating',
        RETRIEVAL_BASELINE_VERSIONS.constraintViolating,
        RETRIEVAL_BASELINE_PREDICTION_SET_IDS.constraintViolating,
      ],
    ],
    diagnostics,
    '/safetyControls',
  );
  for (const baseline of report.ordinaryBaselines) {
    const exactDuplicateRate =
      baseline.aggregateMetrics.micro['exactDuplicateRate'];
    if (
      baseline.safety.hardFilterErrors !== 0 ||
      Object.values(baseline.safety.top10Violations).some(
        (count) => count !== 0,
      ) ||
      exactDuplicateRate?.numerator !== 0
    ) {
      add('retrieval.baseline-report.ordinary-safety', '/ordinaryBaselines');
    }
  }
  const weak = report.weakControls[0];
  const weakExactDuplicates =
    weak?.aggregateMetrics.micro['exactDuplicateRate'];
  const weakEquivalenceDuplicates =
    weak?.aggregateMetrics.micro['equivalenceDuplicateRate'];
  const weakNoEligible =
    weak?.aggregateMetrics.micro['noEligibleCandidateAccuracy'];
  const weakRecall = weak?.aggregateMetrics.macro['recallAt10'];
  if (weak === undefined) {
    add('retrieval.baseline-report.weak-control', '/weakControls');
  } else if (
    weak.emittedResultCount !== 0 ||
    weak.safety.hardFilterErrors !== 0 ||
    Object.values(weak.safety.top10Violations).some((count) => count !== 0) ||
    weakExactDuplicates?.status !== 'not-applicable' ||
    weakEquivalenceDuplicates?.status !== 'not-applicable' ||
    (weakNoEligible?.value ?? 1) >= 1 ||
    (weakRecall?.value ?? 1) >= 1
  ) {
    add('retrieval.baseline-report.weak-control', '/weakControls');
  }
  const unsafe = report.safetyControls[0];
  if (unsafe === undefined) {
    add('retrieval.baseline-report.safety-control', '/safetyControls');
  } else if (
    unsafe.safety.hardFilterErrors === 0 ||
    unsafe.safety.top10Violations.conflict === 0 ||
    unsafe.safety.top10Violations.negativeControl === 0 ||
    unsafe.safety.top10Violations.laneError === 0
  ) {
    add('retrieval.baseline-report.safety-control', '/safetyControls');
  }
  auditContent(report, diagnostics);
  return diagnostics.slice(0, 500);
}

function validateSection(
  actual: readonly ContentFreeRetrievalMeasurement[],
  expected: readonly (readonly [string, string, string])[],
  diagnostics: RetrievalDiagnostic[],
  path: string,
): void {
  if (
    actual.length !== expected.length ||
    actual.some((item, index) => {
      const expectedItem = expected[index];
      return (
        item.baselineId !== expectedItem?.[0] ||
        item.baselineVersion !== expectedItem[1] ||
        item.predictionSetId !== expectedItem[2] ||
        item.perFamily.some(
          (family, familyIndex) =>
            family.family !== RETRIEVAL_FAMILIES[familyIndex],
        )
      );
    })
  ) {
    diagnostics.push({
      code: 'retrieval.baseline-report.section-order',
      path,
      message: 'Retrieval baseline report section ordering is inconsistent.',
    });
  }
}

function auditContent(
  value: unknown,
  diagnostics: RetrievalDiagnostic[],
): void {
  const forbiddenKeys = new Set([
    'artifact',
    'best',
    'candidateDecisions',
    'candidateId',
    'caseId',
    'classification',
    'composite',
    'elapsed',
    'launchThreshold',
    'model',
    'perCase',
    'productionReadiness',
    'provider',
    'queryInput',
    'rank',
    'rationale',
    'reasonCode',
    'recommendation',
    'results',
    'reviewer',
    'selectionSource',
    'sourceId',
    'targetSource',
    'timestamp',
    'winner',
  ]);
  const visit = (node: unknown, path: string): void => {
    if (typeof node === 'number' && !Number.isFinite(node)) {
      diagnostics.push(diagnostic('retrieval.baseline-report.number', path));
      return;
    }
    if (typeof node === 'string') {
      if (
        /https?:\/\//iu.test(node) ||
        /\b(?:ret|norm)-(?:authorization|audit-logging|background-jobs|rate-limiting|webhooks)-\d{2}\b/u.test(
          node,
        ) ||
        (!RETRIEVAL_FAMILIES.includes(node as RetrievalFamily) &&
          /^(?:auth|audit|jobs|rate|webhook)-[a-z0-9-]+$/u.test(node))
      ) {
        diagnostics.push(diagnostic('retrieval.baseline-report.content', path));
      }
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((child, index) => {
        visit(child, `${path}/${String(index)}`);
      });
      return;
    }
    if (typeof node !== 'object' || node === null) return;
    for (const [key, child] of Object.entries(node)) {
      if (forbiddenKeys.has(key)) {
        diagnostics.push(
          diagnostic(
            'retrieval.baseline-report.forbidden-field',
            `${path}/${key}`,
          ),
        );
      }
      if (isMetric(child)) {
        if (
          (child.denominator === 0 &&
            (child.value !== null || child.status !== 'not-applicable')) ||
          (child.denominator > 0 &&
            (child.value === null || child.status !== 'applicable'))
        ) {
          diagnostics.push(
            diagnostic(
              'retrieval.baseline-report.denominator',
              `${path}/${key}`,
            ),
          );
        }
      }
      visit(child, `${path}/${key}`);
    }
  };
  visit(value, '');
}

function isMetric(value: unknown): value is MetricValue {
  return (
    typeof value === 'object' &&
    value !== null &&
    'numerator' in value &&
    'denominator' in value &&
    'value' in value &&
    'status' in value
  );
}

function diagnostic(code: string, path: string): RetrievalDiagnostic {
  return {
    code,
    path: path.slice(0, 256),
    message: 'Retrieval baseline report failed its content-free audit.',
  };
}
