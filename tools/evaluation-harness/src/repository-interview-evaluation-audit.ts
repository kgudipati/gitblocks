import { createHash } from 'node:crypto';

import type {
  RepositoryInterviewAuditRecordV1,
  RepositoryInterviewEvaluationCorpusV1,
  RepositoryInterviewEvaluationDiagnostic,
  RepositoryInterviewRunSummaryV1,
  RepositoryInterviewSecondarySubjectV1,
  RepositoryInterviewSubjectFindingV1,
} from './repository-interview-evaluation-contracts.ts';
import { createRepositoryInterviewEvaluationSchemaRegistry } from './repository-interview-evaluation-schema-registry.ts';
import { stableJson } from './stable-json.ts';

const SAMPLE_DOMAIN =
  'gitblocks\0repository-interviews-v1\0secondary-sample\0v1\0';

export interface RepositoryInterviewAuditAuthorityV1 {
  readonly run: RepositoryInterviewRunSummaryV1;
  readonly audits: readonly RepositoryInterviewAuditRecordV1[];
  readonly primaryReviews: readonly RepositoryInterviewAuditRecordV1[];
  readonly secondaryReviews: readonly RepositoryInterviewAuditRecordV1[];
  readonly adjudications: readonly RepositoryInterviewAuditRecordV1[];
  readonly mandatorySecondarySubjects: readonly RepositoryInterviewSecondarySubjectV1[];
  readonly sampledSecondarySubjects: readonly RepositoryInterviewSecondarySubjectV1[];
}

export type RepositoryInterviewAuditValidationResultV1 =
  | {
      readonly ok: true;
      readonly authority: RepositoryInterviewAuditAuthorityV1;
      readonly issues: readonly [];
    }
  | {
      readonly ok: false;
      readonly issues: readonly RepositoryInterviewEvaluationDiagnostic[];
    };

export function selectRepositoryInterviewSecondarySampleV1(
  subjects: readonly RepositoryInterviewSecondarySubjectV1[],
): readonly RepositoryInterviewSecondarySubjectV1[] {
  const unique = new Map<string, RepositoryInterviewSecondarySubjectV1>();
  for (const subject of subjects) unique.set(subjectKey(subject), subject);
  const ordered = [...unique.values()].sort((left, right) => {
    const leftDigest = sampleDigest(left);
    const rightDigest = sampleDigest(right);
    return compareText(
      `${leftDigest}\0${subjectKey(left)}`,
      `${rightDigest}\0${subjectKey(right)}`,
    );
  });
  return ordered.slice(0, Math.ceil(ordered.length / 10));
}

export function validateRepositoryInterviewAuditSetV1(
  repositoryRoot: string,
  corpus: RepositoryInterviewEvaluationCorpusV1,
  runValue: unknown,
  auditValues: readonly unknown[],
): RepositoryInterviewAuditValidationResultV1 {
  const registry =
    createRepositoryInterviewEvaluationSchemaRegistry(repositoryRoot);
  const issues: RepositoryInterviewEvaluationDiagnostic[] = [];
  pushSchema(issues, registry.validate('run-summary', runValue), 'run');
  for (const [index, value] of auditValues.entries())
    pushSchema(
      issues,
      registry.validate('audit-record', value),
      `audits/${String(index)}`,
    );
  if (issues.length > 0) return { ok: false, issues: finalize(issues) };
  const run = runValue as RepositoryInterviewRunSummaryV1;
  const audits = auditValues as readonly RepositoryInterviewAuditRecordV1[];
  validateRun(issues, corpus, run);
  for (const [index, audit] of audits.entries())
    validateAuditRecord(issues, run, audit, `audits/${String(index)}`);
  const analysis = analyzeWorkflow(issues, corpus, run, audits);
  if (issues.length > 0) return { ok: false, issues: finalize(issues) };
  return {
    ok: true,
    authority: {
      run,
      audits,
      primaryReviews: analysis.primary,
      secondaryReviews: analysis.secondary,
      adjudications: analysis.adjudications,
      mandatorySecondarySubjects: analysis.mandatorySubjects,
      sampledSecondarySubjects: analysis.sampledSubjects,
    },
    issues: [],
  };
}

function validateRun(
  issues: RepositoryInterviewEvaluationDiagnostic[],
  corpus: RepositoryInterviewEvaluationCorpusV1,
  run: RepositoryInterviewRunSummaryV1,
): void {
  const expected =
    run.stage === 'calibration'
      ? corpus.candidates
          .filter(({ calibrationMember }) => calibrationMember)
          .map(({ candidateId }) => candidateId)
      : corpus.candidates.map(({ candidateId }) => candidateId);
  const actual = run.candidateResults.map(({ candidateId }) => candidateId);
  if (!sameSet(actual, expected) || new Set(actual).size !== actual.length)
    issues.push(
      issue(
        'audit.run-membership',
        'Run membership must match its reviewed cohort stage.',
        'run',
      ),
    );
  for (const result of run.candidateResults) {
    if ((result.status === 'completed') !== (result.interviewId !== null)) {
      issues.push(
        issue(
          'audit.run-status',
          'Run completion status must agree with interview availability.',
          'run',
        ),
      );
    }
  }
}

function validateAuditRecord(
  issues: RepositoryInterviewEvaluationDiagnostic[],
  run: RepositoryInterviewRunSummaryV1,
  audit: RepositoryInterviewAuditRecordV1,
  path: string,
): void {
  const result = run.candidateResults.find(
    ({ candidateId }) => candidateId === audit.candidateId,
  );
  const resultMatches = resultMatchesAudit(result, audit);
  if (audit.stage !== run.stage || !resultMatches)
    issues.push(
      issue(
        'audit.provenance',
        'Audit provenance must close over the run summary.',
        path,
      ),
    );
  const roleAllowed =
    audit.stage === 'calibration'
      ? audit.reviewerRole === 'calibration-reviewer' ||
        audit.reviewerRole === 'adjudicator'
      : audit.reviewerRole === 'gate-primary' ||
        audit.reviewerRole === 'gate-secondary' ||
        audit.reviewerRole === 'adjudicator';
  if (!roleAllowed)
    issues.push(
      issue(
        'audit.role-stage',
        'Reviewer role must match the audit stage.',
        path,
      ),
    );
  if (
    !audit.independentFromGeneration ||
    (audit.reviewerRole === 'calibration-reviewer' &&
      !audit.blindToOtherReviews)
  )
    issues.push(
      issue(
        'audit.reviewer-provenance',
        'Reviewer provenance must satisfy the reviewed workflow.',
        path,
      ),
    );
  const subjectKeys = audit.subjectFindings.map(
    ({ subjectKind, subjectId }) => `${subjectKind}\0${subjectId}`,
  );
  const unknownKeys = audit.unknownFindings.map(
    ({ auditUnknownId }) => auditUnknownId,
  );
  if (
    new Set(subjectKeys).size !== subjectKeys.length ||
    new Set(unknownKeys).size !== unknownKeys.length
  )
    issues.push(
      issue(
        'audit.duplicate-finding',
        'Audit findings must be unique within a review.',
        path,
      ),
    );
  for (const finding of audit.subjectFindings)
    validateSubjectFinding(issues, finding, path);
  for (const finding of audit.unknownFindings) {
    if (
      (finding.verdict === 'disclosed') !==
        (finding.disclosedUnknownId !== null) ||
      (finding.verdict === 'omitted' && finding.disclosedUnknownId !== null)
    )
      issues.push(
        issue(
          'audit.unknown-closure',
          'Unknown disclosure verdict must agree with its opaque durable reference.',
          path,
        ),
      );
  }
}

function resultMatchesAudit(
  result:
    RepositoryInterviewRunSummaryV1['candidateResults'][number] | undefined,
  audit: RepositoryInterviewAuditRecordV1,
): boolean {
  if (result === undefined) return false;
  return (
    result.status === 'completed' &&
    result.interviewId !== null &&
    result.requestId === audit.requestId &&
    result.executionId === audit.executionId &&
    result.interviewId === audit.interviewId
  );
}

function validateSubjectFinding(
  issues: RepositoryInterviewEvaluationDiagnostic[],
  finding: RepositoryInterviewSubjectFindingV1,
  path: string,
): void {
  const expectedPrefix =
    finding.subjectKind === 'claim'
      ? 'intclaim-'
      : finding.subjectKind === 'limitation'
        ? 'intlimit-'
        : 'intcontra-';
  if (!finding.subjectId.startsWith(expectedPrefix)) {
    issues.push(
      issue(
        'audit.subject-id',
        'Semantic subject ID must agree with its controlled kind.',
        path,
      ),
    );
  }
  if (
    (finding.materiality === 'critical') !==
    (finding.criticalDomain !== null)
  )
    issues.push(
      issue(
        'audit.critical-domain',
        'Critical domain must be present only for critical findings.',
        path,
      ),
    );
  if (finding.subjectKind === 'contradiction') {
    if (
      finding.contradictionRepresentationVerdict === 'not-applicable' ||
      finding.basisVerdict !== 'not-applicable' ||
      finding.partialSupportLimitationId !== null
    )
      issues.push(
        issue(
          'audit.contradiction-verdict',
          'Contradictions require only their controlled representation verdict.',
          path,
        ),
      );
  } else if (
    finding.supportVerdict === 'not-applicable' ||
    finding.basisVerdict === 'not-applicable'
  ) {
    issues.push(
      issue(
        'audit.semantic-verdict',
        'Claims and limitations require support and basis verdicts.',
        path,
      ),
    );
  } else if (finding.contradictionRepresentationVerdict !== 'not-applicable') {
    issues.push(
      issue(
        'audit.semantic-verdict',
        'Claims and limitations cannot author contradiction verdicts.',
        path,
      ),
    );
  }
  const partialMaterial =
    finding.subjectKind !== 'contradiction' &&
    finding.supportVerdict === 'partially-supported' &&
    finding.materiality !== 'non-material';
  if (partialMaterial !== (finding.partialSupportLimitationId !== null))
    issues.push(
      issue(
        'audit.partial-limitation',
        'Partial material support must reference exactly one durable limitation.',
        path,
      ),
    );
}

function analyzeWorkflow(
  issues: RepositoryInterviewEvaluationDiagnostic[],
  corpus: RepositoryInterviewEvaluationCorpusV1,
  run: RepositoryInterviewRunSummaryV1,
  audits: readonly RepositoryInterviewAuditRecordV1[],
) {
  if (new Set(audits.map(({ reviewId }) => reviewId)).size !== audits.length) {
    issues.push(
      issue('audit.review-id', 'Audit review IDs must be unique.', 'audits'),
    );
  }
  const primary = audits.filter(
    (audit) =>
      audit.reviewerRole ===
      (run.stage === 'calibration' ? 'calibration-reviewer' : 'gate-primary'),
  );
  const secondary = audits.filter(
    (audit) =>
      audit.reviewerRole === 'gate-secondary' ||
      (run.stage === 'calibration' &&
        audit.reviewerRole === 'calibration-reviewer'),
  );
  const adjudications = audits.filter(
    ({ reviewerRole }) => reviewerRole === 'adjudicator',
  );
  if (run.stage === 'gate-a') {
    for (const review of secondary) {
      if (
        primary.some(
          ({ candidateId, reviewerId }) =>
            candidateId === review.candidateId &&
            reviewerId === review.reviewerId,
        )
      ) {
        issues.push(
          issue(
            'audit.reviewer-independence',
            'Primary and secondary reviewers must be distinct.',
            'audits',
          ),
        );
      }
    }
  }
  for (const adjudication of adjudications) {
    if (
      audits.some(
        ({ candidateId, reviewerId, reviewerRole }) =>
          reviewerRole !== 'adjudicator' &&
          candidateId === adjudication.candidateId &&
          reviewerId === adjudication.reviewerId,
      )
    ) {
      issues.push(
        issue(
          'audit.reviewer-independence',
          'Adjudicator must be distinct from earlier reviewers.',
          'audits',
        ),
      );
    }
  }
  if (run.stage === 'calibration') {
    for (const candidate of corpus.candidates.filter(
      ({ calibrationMember, candidateId }) =>
        calibrationMember &&
        run.candidateResults.some(
          (result) =>
            result.candidateId === candidateId &&
            result.status === 'completed' &&
            result.interviewId !== null,
        ),
    )) {
      const reviews = primary.filter(
        ({ candidateId }) => candidateId === candidate.candidateId,
      );
      if (
        reviews.length !== 2 ||
        new Set(reviews.map(({ reviewerId }) => reviewerId)).size !== 2
      )
        issues.push(
          issue(
            'audit.calibration-reviewers',
            'Calibration requires exactly two distinct blind reviewers per candidate.',
            'audits',
          ),
        );
    }
  } else {
    for (const result of run.candidateResults.filter(
      ({ status, interviewId }) =>
        status === 'completed' && interviewId !== null,
    ))
      if (
        primary.filter(({ candidateId }) => candidateId === result.candidateId)
          .length !== 1
      )
        issues.push(
          issue(
            'audit.gate-primary',
            'Gate A requires exactly one primary review per candidate.',
            'audits',
          ),
        );
  }
  const mandatorySubjects =
    run.stage === 'gate-a' ? collectMandatorySubjects(primary) : [];
  const remainingMaterial =
    run.stage === 'gate-a'
      ? primary
          .flatMap((audit) =>
            audit.subjectFindings
              .filter((finding) => finding.materiality !== 'non-material')
              .map((finding) => ({
                candidateId: audit.candidateId,
                subjectKind: finding.subjectKind,
                subjectId: finding.subjectId,
              })),
          )
          .filter(
            (subject) =>
              !mandatorySubjects.some(
                (mandatory) => subjectKey(mandatory) === subjectKey(subject),
              ),
          )
      : [];
  const sampledSubjects =
    selectRepositoryInterviewSecondarySampleV1(remainingMaterial);
  if (run.stage === 'gate-a') {
    for (const subject of [...mandatorySubjects, ...sampledSubjects])
      if (
        !secondary.some(
          (audit) =>
            audit.candidateId === subject.candidateId &&
            audit.subjectFindings.some(
              (finding) =>
                finding.subjectKind === subject.subjectKind &&
                finding.subjectId === subject.subjectId,
            ),
        )
      )
        issues.push(
          issue(
            'audit.missing-secondary',
            'Mandatory or sampled secondary review is missing.',
            'audits',
          ),
        );
    for (const audit of primary) {
      const suspected =
        audit.policyFindings.promptInjection !== 'pass' ||
        audit.policyFindings.outsideKnowledge !== 'pass';
      if (
        suspected &&
        !secondary.some(({ candidateId }) => candidateId === audit.candidateId)
      )
        issues.push(
          issue(
            'audit.missing-secondary',
            'Suspected policy finding requires secondary review.',
            'audits',
          ),
        );
    }
  }
  const disagreementKeys = materialDisagreementKeys(primary, secondary);
  for (const key of disagreementKeys)
    if (!adjudications.some((audit) => auditContainsKey(audit, key)))
      issues.push(
        issue(
          'audit.unresolved-disagreement',
          'Material disagreement requires adjudication.',
          'audits',
        ),
      );
  for (const audit of adjudications)
    if (![...disagreementKeys].some((key) => auditContainsKey(audit, key)))
      issues.push(
        issue(
          'audit.unauthorized-adjudication',
          'Adjudication requires a material human disagreement.',
          'audits',
        ),
      );
  return {
    primary,
    secondary: audits.filter(
      ({ reviewerRole }) => reviewerRole === 'gate-secondary',
    ),
    adjudications,
    mandatorySubjects,
    sampledSubjects,
  };
}

function collectMandatorySubjects(
  audits: readonly RepositoryInterviewAuditRecordV1[],
): RepositoryInterviewSecondarySubjectV1[] {
  const values = audits.flatMap((audit) =>
    audit.subjectFindings
      .filter(
        (finding) =>
          finding.disputed ||
          (finding.materiality === 'critical' &&
            finding.supportVerdict !== 'supported'),
      )
      .map((finding) => ({
        candidateId: audit.candidateId,
        subjectKind: finding.subjectKind,
        subjectId: finding.subjectId,
      })),
  );
  return uniqueSubjects(values);
}

function materialDisagreementKeys(
  primary: readonly RepositoryInterviewAuditRecordV1[],
  secondary: readonly RepositoryInterviewAuditRecordV1[],
): ReadonlySet<string> {
  const keys = new Set<string>();
  for (const first of primary) {
    for (const second of secondary.filter(
      ({ candidateId }) => candidateId === first.candidateId,
    )) {
      for (const finding of first.subjectFindings.filter(
        ({ materiality }) => materiality !== 'non-material',
      )) {
        const other = second.subjectFindings.find(
          ({ subjectKind, subjectId }) =>
            subjectKind === finding.subjectKind &&
            subjectId === finding.subjectId,
        );
        if (
          other !== undefined &&
          disagreementValue(finding) !== disagreementValue(other)
        )
          keys.add(
            `subject\0${first.candidateId}\0${finding.subjectKind}\0${finding.subjectId}`,
          );
      }
      for (const finding of first.unknownFindings.filter(
        ({ materiality }) => materiality !== 'non-material',
      )) {
        const other = second.unknownFindings.find(
          ({ auditUnknownId }) => auditUnknownId === finding.auditUnknownId,
        );
        if (other !== undefined && finding.verdict !== other.verdict)
          keys.add(`unknown\0${first.candidateId}\0${finding.auditUnknownId}`);
      }
      if (
        stableJson(first.policyFindings) !== stableJson(second.policyFindings)
      )
        keys.add(`policy\0${first.candidateId}`);
    }
  }
  return keys;
}

function disagreementValue(
  finding: RepositoryInterviewSubjectFindingV1,
): string {
  return stableJson({
    materiality: finding.materiality,
    criticalDomain: finding.criticalDomain,
    supportVerdict: finding.supportVerdict,
    basisVerdict: finding.basisVerdict,
    hasPartialLimitation: finding.partialSupportLimitationId !== null,
    contradictionRepresentationVerdict:
      finding.contradictionRepresentationVerdict,
  });
}

function auditContainsKey(
  audit: RepositoryInterviewAuditRecordV1,
  key: string,
): boolean {
  const [, candidateId, kind, id] = key.split('\0');
  if (audit.candidateId !== candidateId) return false;
  if (key.startsWith('policy\0')) return true;
  if (key.startsWith('unknown\0'))
    return audit.unknownFindings.some(
      ({ auditUnknownId }) => auditUnknownId === kind,
    );
  return audit.subjectFindings.some(
    ({ subjectKind, subjectId }) => subjectKind === kind && subjectId === id,
  );
}

function uniqueSubjects(
  values: readonly RepositoryInterviewSecondarySubjectV1[],
): RepositoryInterviewSecondarySubjectV1[] {
  return [
    ...new Map(values.map((value) => [subjectKey(value), value])).values(),
  ].sort((left, right) => compareText(subjectKey(left), subjectKey(right)));
}
function subjectKey(subject: RepositoryInterviewSecondarySubjectV1): string {
  return `${subject.candidateId}\0${subject.subjectKind}\0${subject.subjectId}`;
}
function sampleDigest(subject: RepositoryInterviewSecondarySubjectV1): string {
  const bytes = [subject.candidateId, subject.subjectKind, subject.subjectId]
    .map((value) => `${String(Buffer.byteLength(value, 'utf8'))}:${value}`)
    .join('|');
  return createHash('sha256')
    .update(SAMPLE_DOMAIN, 'utf8')
    .update(bytes, 'utf8')
    .digest('hex');
}
function pushSchema(
  issues: RepositoryInterviewEvaluationDiagnostic[],
  diagnostics: readonly {
    readonly code: string;
    readonly message: string;
    readonly path: string;
  }[],
  prefix: string,
): void {
  for (const diagnostic of diagnostics)
    issues.push(
      issue(diagnostic.code, diagnostic.message, `${prefix}${diagnostic.path}`),
    );
}
function sameSet(left: readonly string[], right: readonly string[]): boolean {
  return (
    left.length === right.length &&
    new Set(left).size === left.length &&
    left.every((value) => right.includes(value))
  );
}
function issue(
  code: string,
  message: string,
  path: string,
): RepositoryInterviewEvaluationDiagnostic {
  return { code, message, path: path.slice(0, 256) };
}
function finalize(
  issues: readonly RepositoryInterviewEvaluationDiagnostic[],
): readonly RepositoryInterviewEvaluationDiagnostic[] {
  return [...issues]
    .sort((left, right) =>
      compareText(`${left.path}\0${left.code}`, `${right.path}\0${right.code}`),
    )
    .slice(0, 20);
}
function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
