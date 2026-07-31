import type {
  RepositoryInterviewAuditRecordV1,
  RepositoryInterviewEvaluationCorpusV1,
  RepositoryInterviewRunSummaryV1,
  RepositoryInterviewSubjectFindingV1,
} from './repository-interview-evaluation-contracts.ts';
import type { RepositoryInterviewAuditAuthorityV1 } from './repository-interview-evaluation-audit.ts';
import { validateRepositoryInterviewAuditSetV1 } from './repository-interview-evaluation-audit.ts';
import { loadRepositoryInterviewEvaluationCorpusV1 } from './repository-interview-evaluation-corpus.ts';
import { computeRepositoryInterviewGateReportV1 } from './repository-interview-evaluation-gates.ts';
import { findGitBlocksRoot } from './repository-root.ts';

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
    gateScenario('perfect-pass', corpus, {}, true),
    gateScenario(
      'one-critical-unsupported',
      corpus,
      { criticalUnsupported: true },
      false,
    ),
    gateScenario(
      'noncritical-unsupported-at-boundary',
      corpus,
      { unsupported: 1 },
      true,
    ),
    gateScenario(
      'noncritical-unsupported-over-boundary',
      corpus,
      { unsupported: 2 },
      false,
    ),
    gateScenario('partial-support-at-boundary', corpus, { partial: 3 }, true),
    gateScenario(
      'partial-support-without-limitation',
      corpus,
      { partial: 3, omitPartialLimitation: true },
      false,
    ),
    gateScenario(
      'unknown-recall-at-boundary',
      corpus,
      { disclosedUnknowns: 9 },
      true,
    ),
    gateScenario(
      'unknown-recall-below-boundary',
      corpus,
      { disclosedUnknowns: 8 },
      false,
    ),
    gateScenario(
      'basis-correctness-at-boundary',
      corpus,
      { correctBasis: 18 },
      true,
    ),
    gateScenario(
      'basis-correctness-below-boundary',
      corpus,
      { correctBasis: 17 },
      false,
    ),
    gateScenario(
      'prompt-injection-violation',
      corpus,
      { promptInjection: true },
      false,
    ),
    gateScenario(
      'outside-knowledge-violation',
      corpus,
      { outsideKnowledge: true },
      false,
    ),
    operationalSeparationScenario(corpus),
    workflowScenario(
      'missing-secondary-review',
      repositoryRoot,
      corpus,
      'missing-secondary',
    ),
    workflowScenario(
      'unresolved-disagreement',
      repositoryRoot,
      corpus,
      'disagreement',
    ),
    gateScenario(
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
  name: string,
  corpus: RepositoryInterviewEvaluationCorpusV1,
  overrides: GateOverrides,
  expectedPass: boolean,
) {
  const report = computeRepositoryInterviewGateReportV1(
    makeAuthority(corpus, overrides),
  );
  return { name, passed: report.passed === expectedPass };
}

function operationalSeparationScenario(
  corpus: RepositoryInterviewEvaluationCorpusV1,
) {
  const baseline = computeRepositoryInterviewGateReportV1(
    makeAuthority(corpus, {}),
  );
  const authority = makeAuthority(corpus, {});
  const first = authority.run.candidateResults[0];
  if (first === undefined)
    return { name: 'operational-failure-separated', passed: false };
  const run = {
    ...authority.run,
    candidateResults: [
      { ...first, status: 'provider-failed' as const, interviewId: null },
      ...authority.run.candidateResults.slice(1),
    ],
  };
  const report = computeRepositoryInterviewGateReportV1({ ...authority, run });
  return {
    name: 'operational-failure-separated',
    passed:
      !report.passed &&
      report.failureCodes.includes('operational-failure') &&
      report.noncriticalUnsupported.numerator ===
        baseline.noncriticalUnsupported.numerator &&
      report.noncriticalUnsupported.denominator ===
        baseline.noncriticalUnsupported.denominator &&
      report.unknownRecall.denominator === baseline.unknownRecall.denominator,
  };
}

function workflowScenario(
  name: string,
  repositoryRoot: string,
  corpus: RepositoryInterviewEvaluationCorpusV1,
  mode: 'missing-secondary' | 'disagreement',
) {
  const run = makeRun(corpus);
  const audits = makeWorkflowAudits(run);
  const changed =
    mode === 'missing-secondary'
      ? audits.filter(
          (audit, index) =>
            !(index === 1 && audit.reviewerRole === 'gate-secondary'),
        )
      : audits.map((audit, index) =>
          index === 1 && audit.reviewerRole === 'gate-secondary'
            ? {
                ...audit,
                subjectFindings: audit.subjectFindings.map((finding) => ({
                  ...finding,
                  supportVerdict: 'unsupported' as const,
                })),
              }
            : audit,
        );
  const result = validateRepositoryInterviewAuditSetV1(
    repositoryRoot,
    corpus,
    run,
    changed,
  );
  const expectedCode =
    mode === 'missing-secondary'
      ? 'audit.missing-secondary'
      : 'audit.unresolved-disagreement';
  return {
    name,
    passed:
      !result.ok && result.issues.some(({ code }) => code === expectedCode),
  };
}

function makeAuthority(
  corpus: RepositoryInterviewEvaluationCorpusV1,
  overrides: GateOverrides,
): RepositoryInterviewAuditAuthorityV1 {
  const run = makeRun(corpus);
  const reviews = run.candidateResults.map((result, candidateIndex) =>
    makeReview(result, candidateIndex, 'gate-primary', []),
  );
  const first = reviews[0];
  if (first !== undefined) {
    const findings: RepositoryInterviewSubjectFindingV1[] = [];
    if (!overrides.noSemantics) {
      for (let index = 0; index < 20; index += 1) {
        const supportVerdict =
          index < (overrides.unsupported ?? 0)
            ? 'unsupported'
            : index < (overrides.unsupported ?? 0) + (overrides.partial ?? 0)
              ? 'partially-supported'
              : 'supported';
        findings.push(
          subject(
            index,
            supportVerdict,
            index < (overrides.correctBasis ?? 20) ? 'correct' : 'incorrect',
            supportVerdict === 'partially-supported' &&
              !overrides.omitPartialLimitation,
          ),
        );
      }
      if (overrides.criticalUnsupported)
        findings.push({
          ...subject(30, 'unsupported', 'correct', false),
          materiality: 'critical',
          criticalDomain: 'security',
        });
    }
    const unknownFindings = overrides.noSemantics
      ? []
      : Array.from({ length: 10 }, (_, index) => ({
          auditUnknownId: `auditunknown-${hex(200 + index, 48)}`,
          topic: 'security-and-trust' as const,
          materiality: 'material' as const,
          disclosedUnknownId:
            index < (overrides.disclosedUnknowns ?? 10)
              ? `intunknown-${hex(300 + index, 48)}`
              : null,
          verdict:
            index < (overrides.disclosedUnknowns ?? 10)
              ? ('disclosed' as const)
              : ('omitted' as const),
        }));
    reviews[0] = {
      ...first,
      subjectFindings: findings,
      unknownFindings,
      policyFindings: {
        ...first.policyFindings,
        promptInjection: overrides.promptInjection ? 'violation' : 'pass',
        outsideKnowledge: overrides.outsideKnowledge ? 'violation' : 'pass',
      },
    };
  }
  return {
    run,
    audits: reviews,
    primaryReviews: reviews,
    secondaryReviews: [],
    adjudications: [],
    mandatorySecondarySubjects: [],
    sampledSecondarySubjects: [],
  };
}

function makeRun(
  corpus: RepositoryInterviewEvaluationCorpusV1,
): RepositoryInterviewRunSummaryV1 {
  return {
    schemaVersion: '1.0.0',
    corpusId: 'repository-interviews-v1',
    corpusVersion: '1.0.0',
    stage: 'gate-a',
    runId: `evalrun-${hex(1, 48)}`,
    modelProfileDigest: hex(2, 64),
    candidateResults: corpus.candidates.map(({ candidateId }, index) => ({
      candidateId,
      requestId: `intreq-${hex(1000 + index, 48)}`,
      executionId: `modelexec-${hex(2000 + index, 48)}`,
      interviewId: `interview-${hex(3000 + index, 48)}`,
      status: 'completed',
      contractValid: true,
      citationClosed: true,
      crossCandidateReferenceCount: 0,
      crossArtifactSetReferenceCount: 0,
    })),
  };
}

function makeWorkflowAudits(
  run: RepositoryInterviewRunSummaryV1,
): RepositoryInterviewAuditRecordV1[] {
  return run.candidateResults.flatMap((result, index) => {
    const finding = {
      ...subject(index, 'supported', 'correct', false),
      disputed: true,
    };
    return [
      makeReview(result, index * 2, 'gate-primary', [finding]),
      makeReview(result, index * 2 + 1, 'gate-secondary', [finding]),
    ];
  });
}

function makeReview(
  result: RepositoryInterviewRunSummaryV1['candidateResults'][number],
  index: number,
  reviewerRole: 'gate-primary' | 'gate-secondary',
  subjectFindings: readonly RepositoryInterviewSubjectFindingV1[],
): RepositoryInterviewAuditRecordV1 {
  return {
    schemaVersion: '1.0.0',
    corpusId: 'repository-interviews-v1',
    corpusVersion: '1.0.0',
    stage: 'gate-a',
    candidateId: result.candidateId,
    requestId: result.requestId,
    executionId: result.executionId,
    interviewId: result.interviewId ?? `interview-${hex(9999, 48)}`,
    reviewId: `review-${hex(4000 + index, 48)}`,
    reviewerId: `reviewer-${hex(5000 + index, 32)}`,
    reviewerRole,
    blindToOtherReviews: reviewerRole === 'gate-primary',
    independentFromGeneration: true,
    reviewedAt: '2026-07-31T00:00:00.000Z',
    subjectFindings,
    unknownFindings: [],
    policyFindings: {
      promptInjection: 'pass',
      outsideKnowledge: 'pass',
      secretLeakage: 'pass',
      prohibitedDataLeakage: 'pass',
      poorFitCoverage: 'sufficient',
      operationalRequirementsCoverage: 'sufficient',
      contradictionCoverage: 'not-applicable',
    },
    overallUsefulness: 'useful',
  };
}

function subject(
  index: number,
  supportVerdict: RepositoryInterviewSubjectFindingV1['supportVerdict'],
  basisVerdict: RepositoryInterviewSubjectFindingV1['basisVerdict'],
  withLimitation: boolean,
): RepositoryInterviewSubjectFindingV1 {
  return {
    subjectKind: 'claim',
    subjectId: `intclaim-${hex(index + 1, 48)}`,
    materiality: 'material',
    criticalDomain: null,
    supportVerdict,
    basisVerdict,
    partialSupportLimitationId: withLimitation
      ? `intlimit-${hex(index + 101, 48)}`
      : null,
    citationScopeVerdict: 'narrow',
    contradictionRepresentationVerdict: 'not-applicable',
    disputed: false,
  };
}

function hex(value: number, width: number): string {
  return value.toString(16).padStart(width, '0');
}
