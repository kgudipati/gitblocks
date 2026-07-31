import { describe, expect, it } from 'vitest';

import {
  selectRepositoryInterviewSecondarySampleV1,
  validateRepositoryInterviewAuditSetV1,
} from '../src/repository-interview-evaluation-audit.ts';
import { loadRepositoryInterviewEvaluationCorpusV1 } from '../src/repository-interview-evaluation-corpus.ts';
import type {
  RepositoryInterviewAuditRecordV1,
  RepositoryInterviewRunSummaryV1,
  RepositoryInterviewSubjectFindingV1,
} from '../src/repository-interview-evaluation-contracts.ts';
import { runRepositoryInterviewGateFixturesV1 } from '../src/repository-interview-evaluation-fixtures.ts';
import { computeRepositoryInterviewGateReportV1 } from '../src/repository-interview-evaluation-gates.ts';
import { createRepositoryInterviewEvaluationSchemaRegistry } from '../src/repository-interview-evaluation-schema-registry.ts';
import { findGitBlocksRoot } from '../src/repository-root.ts';

const root = findGitBlocksRoot(process.cwd());

describe('repository-interview human audit authority', () => {
  it('keeps audit records closed, opaque, and content-minimized', () => {
    const registry = createRepositoryInterviewEvaluationSchemaRegistry(root);
    const run = gateRun();
    const audit = review(run.candidateResults[0]!, 0, 'gate-primary', []);
    expect(registry.validate('audit-record', audit)).toEqual([]);
    expect(
      registry.validate('audit-record', { ...audit, reviewerName: 'Person' }),
    ).not.toHaveLength(0);
    expect(
      registry.validate('audit-record', {
        ...audit,
        reviewerId: 'reviewer@example.test',
      }),
    ).not.toHaveLength(0);
    expect(
      registry.validate('audit-record', {
        ...audit,
        subjectFindings: [{ ...finding(1), statement: 'forbidden text' }],
      }),
    ).not.toHaveLength(0);
    expect(
      registry.validate('audit-record', {
        ...audit,
        unknownFindings: [
          {
            auditUnknownId: `auditunknown-${hex(1, 48)}`,
            topic: 'security-and-trust',
            materiality: 'material',
            disclosedUnknownId: null,
            verdict: 'omitted',
            description: 'forbidden text',
          },
        ],
      }),
    ).not.toHaveLength(0);
  });

  it('validates critical domains, partial limitation closure, and role/stage combinations', () => {
    const run = gateRun();
    const base = primaryAudits(run);
    const critical = {
      ...finding(1),
      materiality: 'critical' as const,
      criticalDomain: null,
    };
    expect(
      issueCodes(
        validate(run, replaceReview(base, 0, { subjectFindings: [critical] })),
      ),
    ).toContain('audit.critical-domain');
    const partial = {
      ...finding(1),
      supportVerdict: 'partially-supported' as const,
      partialSupportLimitationId: null,
    };
    expect(
      issueCodes(
        validate(run, replaceReview(base, 0, { subjectFindings: [partial] })),
      ),
    ).toContain('audit.partial-limitation');
    expect(
      issueCodes(
        validate(
          run,
          replaceReview(base, 0, { reviewerRole: 'calibration-reviewer' }),
        ),
      ),
    ).toContain('audit.role-stage');
    expect(
      issueCodes(
        validate(
          run,
          replaceReview(base, 0, {
            subjectFindings: [
              { ...finding(2), subjectId: `intlimit-${hex(2, 48)}` },
            ],
          }),
        ),
      ),
    ).toContain('audit.subject-id');
  });

  it('requires two distinct blind calibration reviewers for every exact member', () => {
    const run = calibrationRun();
    const audits = run.candidateResults.flatMap((result, index) => [
      calibrationReview(result, index * 2),
      calibrationReview(result, index * 2 + 1),
    ]);
    expect(validate(run, audits).ok).toBe(true);
    const duplicateReviewer = {
      ...audits[1]!,
      reviewerId: audits[0]!.reviewerId,
    };
    expect(
      issueCodes(
        validate(run, [audits[0]!, duplicateReviewer, ...audits.slice(2)]),
      ),
    ).toContain('audit.calibration-reviewers');
    expect(
      issueCodes(
        validate(run, [
          { ...audits[0]!, blindToOtherReviews: false },
          ...audits.slice(1),
        ]),
      ),
    ).toContain('audit.reviewer-provenance');
  });

  it('selects a deterministic cohort-wide ceiling sample independent of input order', () => {
    const subjects = Array.from({ length: 11 }, (_, index) => ({
      candidateId: `candidate-${String(index)}`,
      subjectKind: 'claim' as const,
      subjectId: `intclaim-${hex(index + 1, 48)}`,
    }));
    const forward = selectRepositoryInterviewSecondarySampleV1(subjects);
    const reverse = selectRepositoryInterviewSecondarySampleV1(
      [...subjects].reverse(),
    );
    expect(forward).toEqual(reverse);
    expect(forward).toHaveLength(2);
    expect(selectRepositoryInterviewSecondarySampleV1([])).toEqual([]);
  });

  it('requires mandatory and sampled secondary reviews and adjudicates only material disagreements', () => {
    const run = gateRun();
    const primaries = primaryAudits(run);
    const sampledFinding = finding(7);
    const withSample = replaceReview(primaries, 0, {
      subjectFindings: [sampledFinding],
    });
    expect(issueCodes(validate(run, withSample))).toContain(
      'audit.missing-secondary',
    );

    const disputed = { ...finding(8), disputed: true };
    const primary = replaceReview(primaries, 0, {
      subjectFindings: [disputed],
    });
    const secondary = review(run.candidateResults[0]!, 100, 'gate-secondary', [
      { ...disputed, supportVerdict: 'unsupported' },
    ]);
    expect(issueCodes(validate(run, [...primary, secondary]))).toContain(
      'audit.unresolved-disagreement',
    );
    expect(
      issueCodes(
        validate(run, [
          ...primary,
          { ...secondary, reviewerId: primary[0]!.reviewerId },
        ]),
      ),
    ).toContain('audit.reviewer-independence');

    const nonmaterial = { ...disputed, materiality: 'non-material' as const };
    const nonmaterialPrimary = replaceReview(primaries, 0, {
      subjectFindings: [nonmaterial],
    });
    const nonmaterialSecondary = review(
      run.candidateResults[0]!,
      101,
      'gate-secondary',
      [{ ...nonmaterial, supportVerdict: 'unsupported' }],
    );
    expect(
      validate(run, [...nonmaterialPrimary, nonmaterialSecondary]).ok,
    ).toBe(true);
  });

  it('requires a secondary review for suspected injection or outside knowledge', () => {
    const run = gateRun();
    const audits = replaceReview(primaryAudits(run), 0, {
      policyFindings: {
        ...primaryAudits(run)[0]!.policyFindings,
        promptInjection: 'suspected',
      },
    });
    expect(issueCodes(validate(run, audits))).toContain(
      'audit.missing-secondary',
    );
  });

  it('accepts operational failures without inventing an interview audit', () => {
    const base = gateRun();
    const first = base.candidateResults[0]!;
    const run = {
      ...base,
      candidateResults: [
        { ...first, status: 'provider-failed' as const, interviewId: null },
        ...base.candidateResults.slice(1),
      ],
    };
    const result = validate(run, primaryAudits(run).slice(1));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(
      computeRepositoryInterviewGateReportV1(result.authority).failureCodes,
    ).toContain('operational-failure');
  });

  it('passes every deterministic gate boundary scenario and produces stable content-free reports', () => {
    const fixtures = runRepositoryInterviewGateFixturesV1(root);
    expect(fixtures.ok).toBe(true);
    expect(fixtures.scenarios).toHaveLength(16);
    expect(fixtures.scenarios.every(({ passed }) => passed)).toBe(true);

    const run = gateRun();
    const result = validate(run, primaryAudits(run));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const report = computeRepositoryInterviewGateReportV1(result.authority);
    expect(report.reportDigest).toMatch(/^[0-9a-f]{64}$/u);
    expect(computeRepositoryInterviewGateReportV1(result.authority)).toEqual(
      report,
    );
    expect(JSON.stringify(report)).not.toContain('statement');
  });
});

function corpus() {
  const result = loadRepositoryInterviewEvaluationCorpusV1(root);
  if (!result.ok) throw new Error('corpus fixture invalid');
  return result.corpus;
}

function gateRun(): RepositoryInterviewRunSummaryV1 {
  return makeRun(
    'gate-a',
    corpus().candidates.map(({ candidateId }) => candidateId),
  );
}

function calibrationRun(): RepositoryInterviewRunSummaryV1 {
  return makeRun(
    'calibration',
    corpus()
      .candidates.filter(({ calibrationMember }) => calibrationMember)
      .map(({ candidateId }) => candidateId),
  );
}

function makeRun(
  stage: 'calibration' | 'gate-a',
  candidateIds: readonly string[],
): RepositoryInterviewRunSummaryV1 {
  return {
    schemaVersion: '1.0.0',
    corpusId: 'repository-interviews-v1',
    corpusVersion: '1.0.0',
    stage,
    runId: `evalrun-${hex(stage === 'gate-a' ? 1 : 2, 48)}`,
    modelProfileDigest: hex(3, 64),
    candidateResults: candidateIds.map((candidateId, index) => ({
      candidateId,
      requestId: `intreq-${hex(100 + index, 48)}`,
      executionId: `modelexec-${hex(200 + index, 48)}`,
      interviewId: `interview-${hex(300 + index, 48)}`,
      status: 'completed',
      contractValid: true,
      citationClosed: true,
      crossCandidateReferenceCount: 0,
      crossArtifactSetReferenceCount: 0,
    })),
  };
}

function primaryAudits(
  run: RepositoryInterviewRunSummaryV1,
): RepositoryInterviewAuditRecordV1[] {
  return run.candidateResults.map((result, index) =>
    review(result, index, 'gate-primary', []),
  );
}

function calibrationReview(
  result: RepositoryInterviewRunSummaryV1['candidateResults'][number],
  index: number,
): RepositoryInterviewAuditRecordV1 {
  return {
    ...review(result, index, 'gate-primary', []),
    stage: 'calibration',
    reviewerRole: 'calibration-reviewer',
    blindToOtherReviews: true,
  };
}

function review(
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
    interviewId: result.interviewId!,
    reviewId: `review-${hex(1000 + index, 48)}`,
    reviewerId: `reviewer-${hex(2000 + index, 32)}`,
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

function finding(index: number): RepositoryInterviewSubjectFindingV1 {
  return {
    subjectKind: 'claim',
    subjectId: `intclaim-${hex(index, 48)}`,
    materiality: 'material',
    criticalDomain: null,
    supportVerdict: 'supported',
    basisVerdict: 'correct',
    partialSupportLimitationId: null,
    citationScopeVerdict: 'narrow',
    contradictionRepresentationVerdict: 'not-applicable',
    disputed: false,
  };
}

function replaceReview(
  audits: readonly RepositoryInterviewAuditRecordV1[],
  index: number,
  patch: Partial<RepositoryInterviewAuditRecordV1>,
): RepositoryInterviewAuditRecordV1[] {
  return audits.map((audit, current) =>
    current === index ? { ...audit, ...patch } : audit,
  );
}

function validate(
  run: RepositoryInterviewRunSummaryV1,
  audits: readonly RepositoryInterviewAuditRecordV1[],
) {
  return validateRepositoryInterviewAuditSetV1(root, corpus(), run, audits);
}

function issueCodes(result: ReturnType<typeof validate>): readonly string[] {
  return result.ok ? [] : result.issues.map(({ code }) => code);
}

function hex(value: number, width: number): string {
  return value.toString(16).padStart(width, '0');
}
