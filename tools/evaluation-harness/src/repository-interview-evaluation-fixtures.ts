import type {
  RepositoryInterviewAuditRecordV1,
  RepositoryInterviewAuditScopeV1,
  RepositoryInterviewCandidateRunResultV1,
  RepositoryInterviewRunSummaryV1,
  RepositoryInterviewSecondarySubjectV1,
  RepositoryInterviewSubjectFindingV1,
} from './repository-interview-evaluation-contracts.ts';
import {
  type RepositoryInterviewAuditExchangeInputV1,
  selectRepositoryInterviewSecondarySampleV1,
  validateRepositoryInterviewAuditSetV1,
} from './repository-interview-evaluation-audit.ts';
import {
  loadRepositoryInterviewEvaluationCorpusV1,
  type ValidatedRepositoryInterviewEvaluationCorpusV1,
} from './repository-interview-evaluation-corpus.ts';
import { computeRepositoryInterviewGateReportV1 } from './repository-interview-evaluation-gates.ts';
import { findGitBlocksRoot } from './repository-root.ts';
import { createRepositoryInterviewAuditScopeV1 } from './repository-interview-evaluation-scope.ts';
import { createSyntheticRepositoryInterviewExchangeV1 } from './repository-interview-evaluation-synthetic-exchange.ts';

export interface RepositoryInterviewGateFixtureResultV1 {
  readonly ok: boolean;
  readonly scenarios: readonly {
    readonly name: string;
    readonly passed: boolean;
  }[];
}

export function runRepositoryInterviewGateFixturesV1(
  repositoryRoot = findGitBlocksRoot(process.cwd()),
): RepositoryInterviewGateFixtureResultV1 {
  const loaded = loadRepositoryInterviewEvaluationCorpusV1(repositoryRoot);
  if (!loaded.ok) return { ok: false, scenarios: [] };
  const corpus = loaded.corpus;
  const scenarios = [
    gateScenario(repositoryRoot, 'perfect-pass', corpus, {}, true),
    gateScenario(
      repositoryRoot,
      'one-critical-unsupported',
      corpus,
      { criticalUnsupported: true },
      false,
    ),
    gateScenario(
      repositoryRoot,
      'noncritical-unsupported-at-boundary',
      corpus,
      { unsupported: 1 },
      true,
    ),
    gateScenario(
      repositoryRoot,
      'noncritical-unsupported-over-boundary',
      corpus,
      { unsupported: 2 },
      false,
    ),
    gateScenario(
      repositoryRoot,
      'partial-support-at-boundary',
      corpus,
      { partial: 3 },
      true,
    ),
    gateScenario(
      repositoryRoot,
      'partial-support-without-limitation',
      corpus,
      { partial: 3, omitPartialLimitation: true },
      false,
    ),
    gateScenario(
      repositoryRoot,
      'unknown-recall-at-boundary',
      corpus,
      { disclosedUnknowns: 9 },
      true,
    ),
    gateScenario(
      repositoryRoot,
      'unknown-recall-below-boundary',
      corpus,
      { disclosedUnknowns: 8 },
      false,
    ),
    gateScenario(
      repositoryRoot,
      'basis-correctness-at-boundary',
      corpus,
      { correctBasis: 18 },
      true,
    ),
    gateScenario(
      repositoryRoot,
      'basis-correctness-below-boundary',
      corpus,
      { correctBasis: 17 },
      false,
    ),
    gateScenario(
      repositoryRoot,
      'prompt-injection-violation',
      corpus,
      { promptInjection: true },
      false,
    ),
    gateScenario(
      repositoryRoot,
      'outside-knowledge-violation',
      corpus,
      { outsideKnowledge: true },
      false,
    ),
    operationalSeparationScenario(repositoryRoot, corpus),
    workflowScenario(
      repositoryRoot,
      corpus,
      'missing-secondary-review',
      'missing-secondary',
    ),
    workflowScenario(
      repositoryRoot,
      corpus,
      'unresolved-disagreement',
      'disagreement',
    ),
    gateScenario(
      repositoryRoot,
      'zero-semantic-denominator',
      corpus,
      { noSemantics: true },
      false,
    ),
  ];
  return { ok: scenarios.every(({ passed }) => passed), scenarios };
}

interface GateOverrides {
  readonly unsupported?: number;
  readonly partial?: number;
  readonly omitPartialLimitation?: boolean;
  readonly disclosedUnknowns?: number;
  readonly correctBasis?: number;
  readonly criticalUnsupported?: boolean;
  readonly promptInjection?: boolean;
  readonly outsideKnowledge?: boolean;
  readonly noSemantics?: boolean;
}

function gateScenario(
  repositoryRoot: string,
  name: string,
  corpus: ValidatedRepositoryInterviewEvaluationCorpusV1,
  overrides: GateOverrides,
  expectedPass: boolean,
) {
  const { run, audits, exchanges } = scenarioInputs(corpus, overrides);
  const validated = validateRepositoryInterviewAuditSetV1(
    repositoryRoot,
    corpus,
    run,
    audits,
    [],
    exchanges,
  );
  if (!validated.ok) return { name, passed: !expectedPass };
  return {
    name,
    passed:
      computeRepositoryInterviewGateReportV1(validated.authority).passed ===
      expectedPass,
  };
}

function operationalSeparationScenario(
  repositoryRoot: string,
  corpus: ValidatedRepositoryInterviewEvaluationCorpusV1,
) {
  const baselineInputs = scenarioInputs(corpus, {});
  const baseline = validateRepositoryInterviewAuditSetV1(
    repositoryRoot,
    corpus,
    baselineInputs.run,
    baselineInputs.audits,
    [],
    baselineInputs.exchanges,
  );
  if (!baseline.ok)
    return { name: 'operational-failure-separated', passed: false };
  const baselineReport = computeRepositoryInterviewGateReportV1(
    baseline.authority,
  );
  const last = baselineInputs.run.candidateResults.at(-1);
  if (last === undefined)
    return { name: 'operational-failure-separated', passed: false };
  const run: RepositoryInterviewRunSummaryV1 = {
    ...baselineInputs.run,
    candidateResults: [
      ...baselineInputs.run.candidateResults.slice(0, -1),
      {
        ...last,
        status: 'provider-failed',
        interviewId: null,
        auditScope: null,
      },
    ],
  };
  const audits = baselineInputs.audits.filter(
    ({ candidateId }) => candidateId !== last.candidateId,
  );
  const validated = validateRepositoryInterviewAuditSetV1(
    repositoryRoot,
    corpus,
    run,
    audits,
    [],
    baselineInputs.exchanges.filter(
      ({ candidateId }) => candidateId !== last.candidateId,
    ),
  );
  if (!validated.ok)
    return { name: 'operational-failure-separated', passed: false };
  const report = computeRepositoryInterviewGateReportV1(validated.authority);
  return {
    name: 'operational-failure-separated',
    passed:
      !report.passed &&
      report.failureCodes.includes('operational-failure') &&
      report.noncriticalUnsupported.numerator ===
        baselineReport.noncriticalUnsupported.numerator &&
      report.noncriticalUnsupported.denominator ===
        baselineReport.noncriticalUnsupported.denominator &&
      report.unknownRecall.denominator ===
        baselineReport.unknownRecall.denominator,
  };
}

function workflowScenario(
  repositoryRoot: string,
  corpus: ValidatedRepositoryInterviewEvaluationCorpusV1,
  name: string,
  mode: 'missing-secondary' | 'disagreement',
) {
  const { run, audits, exchanges } = scenarioInputs(corpus, {});
  const secondaryIndex = audits.findIndex(
    ({ reviewerRole, subjectFindings }) =>
      reviewerRole === 'gate-secondary' && subjectFindings.length > 0,
  );
  if (secondaryIndex < 0) return { name, passed: false };
  const changed =
    mode === 'missing-secondary'
      ? audits.filter((_, index) => index !== secondaryIndex)
      : audits.map((audit, index) =>
          index === secondaryIndex
            ? {
                ...audit,
                subjectFindings: audit.subjectFindings.map(
                  (finding, findingIndex) =>
                    findingIndex === 0
                      ? { ...finding, supportVerdict: 'unsupported' as const }
                      : finding,
                ),
              }
            : audit,
        );
  const result = validateRepositoryInterviewAuditSetV1(
    repositoryRoot,
    corpus,
    run,
    changed,
    [],
    exchanges,
  );
  const expectedCode =
    mode === 'missing-secondary'
      ? 'audit.secondary-count'
      : 'audit.adjudication-count';
  return {
    name,
    passed:
      !result.ok && result.issues.some(({ code }) => code === expectedCode),
  };
}

function scenarioInputs(
  corpus: ValidatedRepositoryInterviewEvaluationCorpusV1,
  overrides: GateOverrides,
): {
  readonly run: RepositoryInterviewRunSummaryV1;
  readonly audits: readonly RepositoryInterviewAuditRecordV1[];
  readonly exchanges: readonly RepositoryInterviewAuditExchangeInputV1[];
} {
  const { run, exchanges } = makeRun(corpus);
  const primaries = run.candidateResults.flatMap((result, index) => {
    if (result.status !== 'completed') return [];
    const findings: RepositoryInterviewSubjectFindingV1[] = fullScopeFindings(
      result.auditScope,
    ).map((finding, findingIndex) => {
      const materiality =
        index === 0 && overrides.noSemantics !== true
          ? finding.materiality
          : ('non-material' as const);
      if (finding.subjectKind !== 'claim') return finding;
      const supportVerdict: RepositoryInterviewSubjectFindingV1['supportVerdict'] =
        findingIndex < (overrides.unsupported ?? 0)
          ? 'unsupported'
          : findingIndex <
              (overrides.unsupported ?? 0) + (overrides.partial ?? 0)
            ? 'partially-supported'
            : 'supported';
      return {
        ...finding,
        materiality:
          overrides.criticalUnsupported === true && findingIndex === 0
            ? ('critical' as const)
            : materiality,
        criticalDomain:
          overrides.criticalUnsupported === true && findingIndex === 0
            ? ('security' as const)
            : null,
        supportVerdict:
          overrides.criticalUnsupported === true && findingIndex === 0
            ? ('unsupported' as const)
            : supportVerdict,
        basisVerdict:
          findingIndex < (overrides.correctBasis ?? 20)
            ? ('correct' as const)
            : ('incorrect' as const),
        partialSupportLimitationId:
          supportVerdict === 'partially-supported' &&
          !overrides.omitPartialLimitation
            ? (result.auditScope.limitationIds[0] ?? null)
            : null,
      };
    });
    const unknownFindings = (
      index === 0 && overrides.noSemantics !== true
        ? result.auditScope.unknownIds
        : []
    ).map((unknownId, unknownIndex) => {
      const disclosed = unknownIndex < (overrides.disclosedUnknowns ?? 10);
      return {
        auditUnknownId: `auditunknown-${hex(500 + unknownIndex, 48)}`,
        topic: 'security-and-trust',
        materiality: 'material' as const,
        disclosedUnknownId: disclosed ? unknownId : null,
        verdict: disclosed ? ('disclosed' as const) : ('omitted' as const),
      };
    });
    return [
      makeReview(result, index, 'gate-primary', findings, unknownFindings, {
        promptInjection:
          overrides.promptInjection === true ? 'violation' : 'pass',
        outsideKnowledge:
          overrides.outsideKnowledge === true ? 'violation' : 'pass',
      }),
    ];
  });
  return {
    run,
    audits: exactGateAuditSet(corpus, run, primaries),
    exchanges,
  };
}

function makeRun(corpus: ValidatedRepositoryInterviewEvaluationCorpusV1): {
  readonly run: RepositoryInterviewRunSummaryV1;
  readonly exchanges: readonly RepositoryInterviewAuditExchangeInputV1[];
} {
  const exchanges = corpus.candidates.map(({ candidateId }, index) => ({
    candidateId,
    ...createSyntheticRepositoryInterviewExchangeV1(candidateId, index === 0),
  }));
  const run: RepositoryInterviewRunSummaryV1 = {
    schemaVersion: '1.0.0',
    corpusId: 'repository-interviews-v1',
    corpusVersion: '1.0.0',
    stage: 'gate-a',
    runId: `evalrun-${hex(1, 48)}`,
    modelProfileDigest: hex(2, 64),
    corpusDigest: corpus.manifest.corpusDigest,
    cohortPolicyDigest: corpus.policyDigests.cohort,
    reviewPolicyDigest: corpus.policyDigests.review,
    rubricDigest: corpus.policyDigests.rubric,
    gatePolicyDigest: corpus.policyDigests.gate,
    candidateResults: exchanges.map(
      ({ candidateId, request, execution, interview }) => {
        const auditScope = createRepositoryInterviewAuditScopeV1(
          request,
          execution,
          interview,
        );
        return {
          candidateId,
          requestId: request.requestId,
          executionId: execution.executionId,
          interviewId: interview.interviewId,
          status: 'completed' as const,
          auditScope,
          contractValid: true,
          citationClosed: true,
          crossCandidateReferenceCount: 0,
          crossArtifactSetReferenceCount: 0,
        };
      },
    ),
  };
  return { run, exchanges };
}

function fullScopeFindings(
  scope: RepositoryInterviewAuditScopeV1,
): RepositoryInterviewSubjectFindingV1[] {
  return [
    ...scope.claimIds.map((subjectId) =>
      subject('claim', subjectId, 'material'),
    ),
    ...scope.limitationIds.map((subjectId) =>
      subject('limitation', subjectId, 'non-material'),
    ),
    ...scope.contradictionIds.map((subjectId) =>
      subject('contradiction', subjectId, 'material'),
    ),
  ];
}

function exactGateAuditSet(
  corpus: ValidatedRepositoryInterviewEvaluationCorpusV1,
  run: RepositoryInterviewRunSummaryV1,
  primaries: readonly RepositoryInterviewAuditRecordV1[],
): RepositoryInterviewAuditRecordV1[] {
  const mandatory = primaries.flatMap((audit) =>
    audit.subjectFindings
      .filter(
        (finding) =>
          finding.disputed ||
          (finding.materiality === 'critical' &&
            finding.supportVerdict !== 'supported'),
      )
      .map((finding) => secondarySubject(audit.candidateId, finding)),
  );
  const mandatoryKeys = new Set(mandatory.map(secondaryKey));
  const sample = selectRepositoryInterviewSecondarySampleV1(
    primaries
      .flatMap((audit) =>
        audit.subjectFindings
          .filter(({ materiality }) => materiality !== 'non-material')
          .map((finding) => secondarySubject(audit.candidateId, finding)),
      )
      .filter((value) => !mandatoryKeys.has(secondaryKey(value))),
    corpus.policies.review,
  );
  const requiredKeys = new Set([...mandatory, ...sample].map(secondaryKey));
  const secondaries = run.candidateResults.flatMap((result, index) => {
    if (result.status !== 'completed') return [];
    const primary = primaries.find(
      ({ candidateId }) => candidateId === result.candidateId,
    );
    if (primary === undefined) return [];
    const findings = primary.subjectFindings
      .filter((finding) =>
        requiredKeys.has(
          secondaryKey(secondarySubject(result.candidateId, finding)),
        ),
      )
      .sort((left, right) =>
        compareText(
          secondaryKey(secondarySubject(result.candidateId, left)),
          secondaryKey(secondarySubject(result.candidateId, right)),
        ),
      );
    const policyRequired =
      primary.policyFindings.promptInjection !== 'pass' ||
      primary.policyFindings.outsideKnowledge !== 'pass';
    return findings.length > 0 || policyRequired
      ? [
          makeReview(
            result,
            100 + index,
            'gate-secondary',
            findings,
            primary.unknownFindings,
          ),
        ]
      : [];
  });
  return [...primaries, ...secondaries];
}

function makeReview(
  result: RepositoryInterviewCandidateRunResultV1,
  index: number,
  reviewerRole: 'gate-primary' | 'gate-secondary',
  subjectFindings: readonly RepositoryInterviewSubjectFindingV1[],
  unknownFindings: RepositoryInterviewAuditRecordV1['unknownFindings'],
  policyPatch: Partial<RepositoryInterviewAuditRecordV1['policyFindings']> = {},
): RepositoryInterviewAuditRecordV1 {
  if (result.status !== 'completed')
    throw new Error('Repository interview fixture result is invalid.');
  return {
    schemaVersion: '1.0.0',
    corpusId: 'repository-interviews-v1',
    corpusVersion: '1.0.0',
    stage: 'gate-a',
    candidateId: result.candidateId,
    requestId: result.requestId,
    executionId: result.executionId,
    interviewId: result.interviewId,
    reviewId: `review-${hex(7_000 + index, 48)}`,
    reviewerId: `reviewer-${hex(8_000 + index, 32)}`,
    reviewerRole,
    blindToOtherReviews: reviewerRole === 'gate-primary',
    independentFromGeneration: true,
    reviewedAt: '2026-07-31T00:00:00.000Z',
    subjectFindings,
    unknownFindings,
    policyFindings: {
      promptInjection: 'pass',
      outsideKnowledge: 'pass',
      secretLeakage: 'pass',
      prohibitedDataLeakage: 'pass',
      poorFitCoverage: 'sufficient',
      operationalRequirementsCoverage: 'sufficient',
      contradictionCoverage: 'not-applicable',
      ...policyPatch,
    },
    overallUsefulness: 'useful',
  };
}

function subject(
  subjectKind: RepositoryInterviewSubjectFindingV1['subjectKind'],
  subjectId: string,
  materiality: RepositoryInterviewSubjectFindingV1['materiality'],
): RepositoryInterviewSubjectFindingV1 {
  const contradiction = subjectKind === 'contradiction';
  return {
    subjectKind,
    subjectId,
    materiality,
    criticalDomain: null,
    supportVerdict: contradiction ? 'not-applicable' : 'supported',
    basisVerdict: contradiction ? 'not-applicable' : 'correct',
    partialSupportLimitationId: null,
    citationScopeVerdict: contradiction ? 'not-applicable' : 'narrow',
    contradictionRepresentationVerdict: contradiction
      ? 'honest'
      : 'not-applicable',
    disputed: false,
  };
}

function secondarySubject(
  candidateId: string,
  finding: RepositoryInterviewSubjectFindingV1,
): RepositoryInterviewSecondarySubjectV1 {
  return {
    candidateId,
    subjectKind: finding.subjectKind,
    subjectId: finding.subjectId,
  };
}

function secondaryKey(value: RepositoryInterviewSecondarySubjectV1): string {
  return `${value.candidateId}\0${value.subjectKind}\0${value.subjectId}`;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function hex(value: number, width: number): string {
  return value.toString(16).padStart(width, '0');
}
