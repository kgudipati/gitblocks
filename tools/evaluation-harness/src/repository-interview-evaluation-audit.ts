import { createHash } from 'node:crypto';

import type {
  RepositoryInterviewAdjudicationRecordV1,
  RepositoryInterviewAuditRecordV1,
  RepositoryInterviewAuditScopeV1,
  RepositoryInterviewEvaluationCorpusV1,
  RepositoryInterviewEvaluationDiagnostic,
  RepositoryInterviewPolicyField,
  RepositoryInterviewReviewPolicyV1,
  RepositoryInterviewRunSummaryV1,
  RepositoryInterviewSecondarySubjectV1,
  RepositoryInterviewSubjectFindingV1,
  RepositoryInterviewUnknownFindingV1,
} from './repository-interview-evaluation-contracts.ts';
import { repositoryInterviewAuditInventoryDigestV1 } from './repository-interview-evaluation-digests.ts';
import { createRepositoryInterviewEvaluationSchemaRegistry } from './repository-interview-evaluation-schema-registry.ts';
import { stableJson } from './stable-json.ts';

const SAMPLE_DOMAIN =
  'gitblocks\0repository-interviews-v1\0secondary-sample\0v1\0';
const VALID_AUTHORITIES = new WeakSet<object>();
const POLICY_FIELDS = [
  'promptInjection',
  'outsideKnowledge',
  'secretLeakage',
  'prohibitedDataLeakage',
  'poorFitCoverage',
  'operationalRequirementsCoverage',
  'contradictionCoverage',
] as const satisfies readonly RepositoryInterviewPolicyField[];

export interface RepositoryInterviewAuditAuthorityV1 {
  readonly corpus: RepositoryInterviewEvaluationCorpusV1;
  readonly run: RepositoryInterviewRunSummaryV1;
  readonly auditScopes: readonly RepositoryInterviewAuditScopeV1[];
  readonly audits: readonly RepositoryInterviewAuditRecordV1[];
  readonly primaryReviews: readonly RepositoryInterviewAuditRecordV1[];
  readonly secondaryReviews: readonly RepositoryInterviewAuditRecordV1[];
  readonly adjudications: readonly RepositoryInterviewAdjudicationRecordV1[];
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
  reviewPolicy: RepositoryInterviewReviewPolicyV1,
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
  const count =
    reviewPolicy.secondarySampleRounding === 'ceiling'
      ? Math.floor(
          (ordered.length * reviewPolicy.secondarySampleNumerator +
            reviewPolicy.secondarySampleDenominator -
            1) /
            reviewPolicy.secondarySampleDenominator,
        )
      : Math.floor(
          (ordered.length * reviewPolicy.secondarySampleNumerator) /
            reviewPolicy.secondarySampleDenominator,
        );
  if (!Number.isSafeInteger(count))
    throw new Error('Repository interview review policy is invalid.');
  return ordered.slice(0, count);
}

export function validateRepositoryInterviewAuditSetV1(
  repositoryRoot: string,
  corpus: RepositoryInterviewEvaluationCorpusV1,
  runValue: unknown,
  auditValues: readonly unknown[],
  adjudicationValues: readonly unknown[],
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
  for (const [index, value] of adjudicationValues.entries())
    pushSchema(
      issues,
      registry.validate('adjudication-record', value),
      `adjudications/${String(index)}`,
    );
  if (issues.length > 0) return { ok: false, issues: finalize(issues) };
  const run = runValue as RepositoryInterviewRunSummaryV1;
  const audits = auditValues as readonly RepositoryInterviewAuditRecordV1[];
  const adjudications =
    adjudicationValues as readonly RepositoryInterviewAdjudicationRecordV1[];
  const scopes = run.candidateResults.flatMap((result) =>
    result.auditScope === null ? [] : [result.auditScope],
  );
  validateRun(issues, corpus, run);
  const scopeByCandidate = new Map(
    scopes.map((scope) => [scope.candidateId, scope]),
  );
  for (const [index, audit] of audits.entries())
    validateAuditRecord(
      issues,
      run,
      scopeByCandidate.get(audit.candidateId),
      audit,
      `audits/${String(index)}`,
    );
  const analysis = analyzeWorkflow(
    issues,
    corpus,
    run,
    scopeByCandidate,
    audits,
    adjudications,
  );
  if (issues.length > 0) return { ok: false, issues: finalize(issues) };
  const authority: RepositoryInterviewAuditAuthorityV1 = {
    corpus,
    run,
    auditScopes: [...scopes].sort((left, right) =>
      compareText(left.candidateId, right.candidateId),
    ),
    audits: [...audits].sort((left, right) =>
      compareText(left.reviewId, right.reviewId),
    ),
    primaryReviews: analysis.primary,
    secondaryReviews: analysis.secondary,
    adjudications: [...adjudications].sort((left, right) =>
      compareText(left.adjudicationId, right.adjudicationId),
    ),
    mandatorySecondarySubjects: analysis.mandatorySubjects,
    sampledSecondarySubjects: analysis.sampledSubjects,
  };
  VALID_AUTHORITIES.add(authority);
  return { ok: true, authority, issues: [] };
}

export function assertValidatedRepositoryInterviewAuditAuthorityV1(
  authority: RepositoryInterviewAuditAuthorityV1,
): void {
  if (!VALID_AUTHORITIES.has(authority))
    throw new Error('Repository interview audit authority is invalid.');
}

export function authoritativeRepositoryInterviewReviewsV1(
  authority: RepositoryInterviewAuditAuthorityV1,
): readonly RepositoryInterviewAuditRecordV1[] {
  assertValidatedRepositoryInterviewAuditAuthorityV1(authority);
  const adjudicationByCandidate = new Map(
    authority.adjudications.map((value) => [value.candidateId, value]),
  );
  return authority.primaryReviews.map((review) =>
    applyAdjudication(review, adjudicationByCandidate.get(review.candidateId)),
  );
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
  if (
    run.corpusDigest !== corpus.manifest.corpusDigest ||
    run.cohortPolicyDigest !== corpus.policyDigests.cohort ||
    run.reviewPolicyDigest !== corpus.policyDigests.review ||
    run.rubricDigest !== corpus.policyDigests.rubric ||
    run.gatePolicyDigest !== corpus.policyDigests.gate
  )
    issues.push(
      issue(
        'audit.run-authority',
        'Run authority digests must match the loaded evaluation corpus.',
        'run',
      ),
    );
  for (const result of run.candidateResults) {
    if (result.status === 'completed') {
      const scope = result.auditScope;
      if (
        scope.candidateId !== result.candidateId ||
        scope.requestId !== result.requestId ||
        scope.executionId !== result.executionId ||
        scope.interviewId !== result.interviewId
      )
        issues.push(
          issue(
            'audit.scope-provenance',
            'Audit scope provenance must match its completed run result.',
            'run',
          ),
        );
      const { inventoryDigest: ignored, ...withoutDigest } = scope;
      void ignored;
      if (
        repositoryInterviewAuditInventoryDigestV1(withoutDigest) !==
        scope.inventoryDigest
      )
        issues.push(
          issue(
            'audit.scope-digest',
            'Audit scope inventory digest must match its complete inventory.',
            'run',
          ),
        );
    }
  }
}

function validateAuditRecord(
  issues: RepositoryInterviewEvaluationDiagnostic[],
  run: RepositoryInterviewRunSummaryV1,
  scope: RepositoryInterviewAuditScopeV1 | undefined,
  audit: RepositoryInterviewAuditRecordV1,
  path: string,
): void {
  const result = run.candidateResults.find(
    ({ candidateId }) => candidateId === audit.candidateId,
  );
  if (
    audit.stage !== run.stage ||
    result?.status !== 'completed' ||
    result.requestId !== audit.requestId ||
    result.executionId !== audit.executionId ||
    result.interviewId !== audit.interviewId ||
    scope === undefined
  )
    issues.push(
      issue(
        'audit.provenance',
        'Audit provenance must close over one completed run result.',
        path,
      ),
    );
  const roleAllowed =
    audit.stage === 'calibration'
      ? audit.reviewerRole === 'calibration-reviewer'
      : audit.reviewerRole === 'gate-primary' ||
        audit.reviewerRole === 'gate-secondary';
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
  const subjectKeys = audit.subjectFindings.map(subjectFindingKey);
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
  if (!sameArray(unknownKeys, [...unknownKeys].sort(compareText)))
    issues.push(
      issue(
        'audit.finding-order',
        'Audit findings must use deterministic order.',
        path,
      ),
    );
  if (scope === undefined) return;
  for (const finding of audit.subjectFindings)
    validateSubjectFinding(issues, finding, scope, path);
  for (const finding of audit.unknownFindings)
    validateUnknownFinding(issues, finding, scope, path);
}

function validateSubjectFinding(
  issues: RepositoryInterviewEvaluationDiagnostic[],
  finding: RepositoryInterviewSubjectFindingV1,
  scope: RepositoryInterviewAuditScopeV1,
  path: string,
): void {
  if (!scopeIds(scope, finding.subjectKind).includes(finding.subjectId))
    issues.push(
      issue(
        'audit.subject-scope',
        'Semantic subject must belong to the exact durable audit scope.',
        path,
      ),
    );
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
    finding.basisVerdict === 'not-applicable' ||
    finding.contradictionRepresentationVerdict !== 'not-applicable'
  )
    issues.push(
      issue(
        'audit.semantic-verdict',
        'Claims and limitations require their controlled semantic verdicts.',
        path,
      ),
    );
  const partialMaterial =
    finding.subjectKind !== 'contradiction' &&
    finding.supportVerdict === 'partially-supported' &&
    finding.materiality !== 'non-material';
  if (partialMaterial !== (finding.partialSupportLimitationId !== null))
    issues.push(
      issue(
        'audit.partial-limitation',
        'Partial material support must reference one durable limitation.',
        path,
      ),
    );
  if (
    finding.partialSupportLimitationId !== null &&
    !scope.limitationIds.includes(finding.partialSupportLimitationId)
  )
    issues.push(
      issue(
        'audit.limitation-scope',
        'Partial-support limitation must belong to the same audit scope.',
        path,
      ),
    );
}

function validateUnknownFinding(
  issues: RepositoryInterviewEvaluationDiagnostic[],
  finding: RepositoryInterviewUnknownFindingV1,
  scope: RepositoryInterviewAuditScopeV1,
  path: string,
): void {
  const requiresReference =
    finding.verdict === 'disclosed' || finding.verdict === 'misstated';
  if (requiresReference !== (finding.disclosedUnknownId !== null))
    issues.push(
      issue(
        'audit.unknown-closure',
        'Unknown verdict must agree with its durable reference.',
        path,
      ),
    );
  if (
    finding.disclosedUnknownId !== null &&
    !scope.unknownIds.includes(finding.disclosedUnknownId)
  )
    issues.push(
      issue(
        'audit.unknown-scope',
        'Disclosed unknown must belong to the same audit scope.',
        path,
      ),
    );
}

function analyzeWorkflow(
  issues: RepositoryInterviewEvaluationDiagnostic[],
  corpus: RepositoryInterviewEvaluationCorpusV1,
  run: RepositoryInterviewRunSummaryV1,
  scopeByCandidate: ReadonlyMap<string, RepositoryInterviewAuditScopeV1>,
  audits: readonly RepositoryInterviewAuditRecordV1[],
  adjudications: readonly RepositoryInterviewAdjudicationRecordV1[],
) {
  if (new Set(audits.map(({ reviewId }) => reviewId)).size !== audits.length)
    issues.push(
      issue('audit.review-id', 'Audit review IDs must be unique.', 'audits'),
    );
  const calibration = audits.filter(
    ({ reviewerRole }) => reviewerRole === 'calibration-reviewer',
  );
  const gatePrimary = audits.filter(
    ({ reviewerRole }) => reviewerRole === 'gate-primary',
  );
  const gateSecondary = audits.filter(
    ({ reviewerRole }) => reviewerRole === 'gate-secondary',
  );
  const completed = run.candidateResults.filter(
    (result) => result.status === 'completed',
  );
  const primary: RepositoryInterviewAuditRecordV1[] = [];
  const secondary: RepositoryInterviewAuditRecordV1[] = [];
  if (run.stage === 'calibration') {
    for (const result of completed) {
      const reviews = calibration
        .filter(({ candidateId }) => candidateId === result.candidateId)
        .sort((left, right) => compareText(left.reviewId, right.reviewId));
      if (
        reviews.length !==
          corpus.policies.review.calibrationReviewersPerCandidate ||
        new Set(reviews.map(({ reviewerId }) => reviewerId)).size !==
          reviews.length
      )
        issues.push(
          issue(
            'audit.calibration-reviewers',
            'Calibration requires exactly two distinct blind reviewers.',
            'audits',
          ),
        );
      const scope = scopeByCandidate.get(result.candidateId);
      if (scope !== undefined)
        for (const review of reviews)
          validateFullCoverage(issues, review, scope, 'audits');
      if (reviews[0] !== undefined) primary.push(reviews[0]);
      if (reviews[1] !== undefined) secondary.push(reviews[1]);
    }
  } else {
    for (const result of completed) {
      const reviews = gatePrimary.filter(
        ({ candidateId }) => candidateId === result.candidateId,
      );
      if (
        reviews.length !==
        corpus.policies.review.gatePrimaryReviewersPerCandidate
      )
        issues.push(
          issue(
            'audit.gate-primary',
            'Gate A requires exactly one primary review per completed candidate.',
            'audits',
          ),
        );
      const review = reviews[0];
      const scope = scopeByCandidate.get(result.candidateId);
      if (review !== undefined) primary.push(review);
      if (review !== undefined && scope !== undefined)
        validateFullCoverage(issues, review, scope, 'audits');
    }
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
    run.stage === 'gate-a'
      ? selectRepositoryInterviewSecondarySampleV1(
          remainingMaterial,
          corpus.policies.review,
        )
      : [];
  if (run.stage === 'gate-a') {
    const required = uniqueSubjects([...mandatorySubjects, ...sampledSubjects]);
    for (const result of completed) {
      const primaryReview = primary.find(
        ({ candidateId }) => candidateId === result.candidateId,
      );
      const requiredForCandidate = required.filter(
        ({ candidateId }) => candidateId === result.candidateId,
      );
      const policyRequired =
        primaryReview !== undefined &&
        (primaryReview.policyFindings.promptInjection !== 'pass' ||
          primaryReview.policyFindings.outsideKnowledge !== 'pass');
      const requiresSecondary =
        requiredForCandidate.length > 0 || policyRequired;
      const reviews = gateSecondary.filter(
        ({ candidateId }) => candidateId === result.candidateId,
      );
      if (reviews.length !== (requiresSecondary ? 1 : 0))
        issues.push(
          issue(
            'audit.secondary-count',
            'Gate A secondary-review count must match exact assigned scope.',
            'audits',
          ),
        );
      const review = reviews[0];
      if (review === undefined) continue;
      secondary.push(review);
      if (primaryReview?.reviewerId === review.reviewerId)
        issues.push(
          issue(
            'audit.reviewer-independence',
            'Primary and secondary reviewers must be distinct.',
            'audits',
          ),
        );
      const actual = review.subjectFindings.map((finding) => ({
        candidateId: review.candidateId,
        subjectKind: finding.subjectKind,
        subjectId: finding.subjectId,
      }));
      if (!sameSubjectArray(actual, requiredForCandidate))
        issues.push(
          issue(
            'audit.secondary-scope',
            'Secondary findings must equal the exact assigned subject set.',
            'audits',
          ),
        );
    }
  }
  const disagreements = collectDisagreements(primary, secondary);
  validateAdjudications(
    issues,
    run,
    scopeByCandidate,
    primary,
    secondary,
    disagreements,
    adjudications,
  );
  return {
    primary: [...primary].sort((left, right) =>
      compareText(left.candidateId, right.candidateId),
    ),
    secondary: [...secondary].sort((left, right) =>
      compareText(left.candidateId, right.candidateId),
    ),
    mandatorySubjects,
    sampledSubjects,
  };
}

function validateFullCoverage(
  issues: RepositoryInterviewEvaluationDiagnostic[],
  review: RepositoryInterviewAuditRecordV1,
  scope: RepositoryInterviewAuditScopeV1,
  path: string,
): void {
  const expected = canonicalScopeSubjects(scope);
  const actual = review.subjectFindings.map((finding) => ({
    candidateId: review.candidateId,
    subjectKind: finding.subjectKind,
    subjectId: finding.subjectId,
  }));
  if (!sameSubjectArray(actual, expected))
    issues.push(
      issue(
        'audit.primary-coverage',
        'Primary review must cover the complete durable semantic inventory.',
        path,
      ),
    );
}

interface Disagreement {
  readonly candidateId: string;
  readonly key: string;
  readonly kind: 'subject' | 'unknown' | 'policy';
  readonly sourceReviewIds: readonly [string, string];
}

function collectDisagreements(
  primary: readonly RepositoryInterviewAuditRecordV1[],
  secondary: readonly RepositoryInterviewAuditRecordV1[],
): readonly Disagreement[] {
  const values: Disagreement[] = [];
  for (const first of primary) {
    const second = secondary.find(
      ({ candidateId }) => candidateId === first.candidateId,
    );
    if (second === undefined) continue;
    const sourceReviewIds = [first.reviewId, second.reviewId].sort(
      compareText,
    ) as [string, string];
    for (const finding of first.subjectFindings) {
      const other = second.subjectFindings.find(
        (value) => subjectFindingKey(value) === subjectFindingKey(finding),
      );
      if (
        other !== undefined &&
        (finding.materiality !== 'non-material' ||
          other.materiality !== 'non-material') &&
        subjectDisagreementValue(finding) !== subjectDisagreementValue(other)
      )
        values.push({
          candidateId: first.candidateId,
          key: `subject\0${finding.subjectKind}\0${finding.subjectId}`,
          kind: 'subject',
          sourceReviewIds,
        });
    }
    const unknownIds = new Set([
      ...first.unknownFindings.map(({ auditUnknownId }) => auditUnknownId),
      ...second.unknownFindings.map(({ auditUnknownId }) => auditUnknownId),
    ]);
    for (const auditUnknownId of unknownIds) {
      const finding = first.unknownFindings.find(
        (value) => value.auditUnknownId === auditUnknownId,
      );
      const other = second.unknownFindings.find(
        (value) => value.auditUnknownId === auditUnknownId,
      );
      const material = [finding, other].some(
        (value) => value !== undefined && value.materiality !== 'non-material',
      );
      if (
        material &&
        (finding === undefined ||
          other === undefined ||
          unknownDisagreementValue(finding) !== unknownDisagreementValue(other))
      )
        values.push({
          candidateId: first.candidateId,
          key: `unknown\0${auditUnknownId}`,
          kind: 'unknown',
          sourceReviewIds,
        });
    }
    for (const field of POLICY_FIELDS)
      if (first.policyFindings[field] !== second.policyFindings[field])
        values.push({
          candidateId: first.candidateId,
          key: `policy\0${field}`,
          kind: 'policy',
          sourceReviewIds,
        });
  }
  return values.sort((left, right) =>
    compareText(
      `${left.candidateId}\0${left.key}`,
      `${right.candidateId}\0${right.key}`,
    ),
  );
}

function validateAdjudications(
  issues: RepositoryInterviewEvaluationDiagnostic[],
  run: RepositoryInterviewRunSummaryV1,
  scopeByCandidate: ReadonlyMap<string, RepositoryInterviewAuditScopeV1>,
  primary: readonly RepositoryInterviewAuditRecordV1[],
  secondary: readonly RepositoryInterviewAuditRecordV1[],
  disagreements: readonly Disagreement[],
  adjudications: readonly RepositoryInterviewAdjudicationRecordV1[],
): void {
  if (
    new Set(adjudications.map(({ adjudicationId }) => adjudicationId)).size !==
    adjudications.length
  )
    issues.push(
      issue(
        'audit.adjudication-id',
        'Adjudication IDs must be unique.',
        'adjudications',
      ),
    );
  const candidateIds = new Set([
    ...disagreements.map(({ candidateId }) => candidateId),
    ...adjudications.map(({ candidateId }) => candidateId),
  ]);
  for (const candidateId of candidateIds) {
    const expected = disagreements.filter(
      (value) => value.candidateId === candidateId,
    );
    const records = adjudications.filter(
      (value) => value.candidateId === candidateId,
    );
    if (records.length !== (expected.length > 0 ? 1 : 0))
      issues.push(
        issue(
          'audit.adjudication-count',
          'Exactly one adjudication is required for each disputed candidate.',
          'adjudications',
        ),
      );
    const record = records[0];
    if (record === undefined) continue;
    const result = run.candidateResults.find(
      (value) => value.candidateId === candidateId,
    );
    const first = primary.find((value) => value.candidateId === candidateId);
    const second = secondary.find((value) => value.candidateId === candidateId);
    const expectedSources = expected[0]?.sourceReviewIds;
    if (
      result?.status !== 'completed' ||
      record.stage !== run.stage ||
      record.requestId !== result.requestId ||
      record.executionId !== result.executionId ||
      record.interviewId !== result.interviewId ||
      expectedSources === undefined ||
      !sameArray(record.sourceReviewIds, expectedSources) ||
      first === undefined ||
      second === undefined
    )
      issues.push(
        issue(
          'audit.adjudication-provenance',
          'Adjudication provenance must close over both source reviews.',
          'adjudications',
        ),
      );
    if (
      !record.independentFromGeneration ||
      record.adjudicatorId === first?.reviewerId ||
      record.adjudicatorId === second?.reviewerId
    )
      issues.push(
        issue(
          'audit.reviewer-independence',
          'Adjudicator must be independent from both source reviewers.',
          'adjudications',
        ),
      );
    const scope = scopeByCandidate.get(candidateId);
    if (scope === undefined) continue;
    const actualKeys: string[] = [];
    for (const resolution of record.subjectResolutions) {
      const key = `subject\0${resolution.subjectKind}\0${resolution.subjectId}`;
      actualKeys.push(key);
      if (
        resolution.finalFinding.subjectKind !== resolution.subjectKind ||
        resolution.finalFinding.subjectId !== resolution.subjectId
      )
        issues.push(
          issue(
            'audit.adjudication-resolution',
            'Subject resolution must preserve its exact subject key.',
            'adjudications',
          ),
        );
      validateSubjectFinding(
        issues,
        resolution.finalFinding,
        scope,
        'adjudications',
      );
    }
    for (const resolution of record.unknownResolutions) {
      const key = `unknown\0${resolution.auditUnknownId}`;
      actualKeys.push(key);
      if (resolution.finalFinding.auditUnknownId !== resolution.auditUnknownId)
        issues.push(
          issue(
            'audit.adjudication-resolution',
            'Unknown resolution must preserve its exact unknown key.',
            'adjudications',
          ),
        );
      validateUnknownFinding(
        issues,
        resolution.finalFinding,
        scope,
        'adjudications',
      );
    }
    for (const resolution of record.policyResolutions)
      actualKeys.push(`policy\0${resolution.field}`);
    const expectedKeys = expected.map(({ key }) => key).sort(compareText);
    if (
      new Set(actualKeys).size !== actualKeys.length ||
      !sameArray([...actualKeys].sort(compareText), expectedKeys)
    )
      issues.push(
        issue(
          'audit.adjudication-closure',
          'Adjudication resolutions must exactly match disagreement keys.',
          'adjudications',
        ),
      );
  }
}

function applyAdjudication(
  primary: RepositoryInterviewAuditRecordV1,
  adjudication: RepositoryInterviewAdjudicationRecordV1 | undefined,
): RepositoryInterviewAuditRecordV1 {
  if (adjudication === undefined) return primary;
  const subjects = new Map(
    primary.subjectFindings.map((finding) => [
      subjectFindingKey(finding),
      finding,
    ]),
  );
  const unknowns = new Map(
    primary.unknownFindings.map((finding) => [finding.auditUnknownId, finding]),
  );
  const policy = { ...primary.policyFindings };
  for (const resolution of adjudication.subjectResolutions)
    subjects.set(
      `${resolution.subjectKind}\0${resolution.subjectId}`,
      resolution.finalFinding,
    );
  for (const resolution of adjudication.unknownResolutions)
    unknowns.set(resolution.auditUnknownId, resolution.finalFinding);
  for (const resolution of adjudication.policyResolutions)
    setPolicyResolution(policy, resolution.field, resolution.finalValue);
  return {
    ...primary,
    subjectFindings: [...subjects.values()],
    unknownFindings: [...unknowns.values()].sort((left, right) =>
      compareText(left.auditUnknownId, right.auditUnknownId),
    ),
    policyFindings: policy,
  };
}

function setPolicyResolution(
  policy: Record<RepositoryInterviewPolicyField, string>,
  field: RepositoryInterviewPolicyField,
  value: string,
): void {
  policy[field] = value;
}

function collectMandatorySubjects(
  audits: readonly RepositoryInterviewAuditRecordV1[],
): RepositoryInterviewSecondarySubjectV1[] {
  return uniqueSubjects(
    audits.flatMap((audit) =>
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
    ),
  );
}

function canonicalScopeSubjects(
  scope: RepositoryInterviewAuditScopeV1,
): RepositoryInterviewSecondarySubjectV1[] {
  return [
    ...scope.claimIds.map((subjectId) => ({
      candidateId: scope.candidateId,
      subjectKind: 'claim' as const,
      subjectId,
    })),
    ...scope.limitationIds.map((subjectId) => ({
      candidateId: scope.candidateId,
      subjectKind: 'limitation' as const,
      subjectId,
    })),
    ...scope.contradictionIds.map((subjectId) => ({
      candidateId: scope.candidateId,
      subjectKind: 'contradiction' as const,
      subjectId,
    })),
  ];
}

function scopeIds(
  scope: RepositoryInterviewAuditScopeV1,
  kind: RepositoryInterviewSubjectFindingV1['subjectKind'],
): readonly string[] {
  return kind === 'claim'
    ? scope.claimIds
    : kind === 'limitation'
      ? scope.limitationIds
      : scope.contradictionIds;
}

function subjectDisagreementValue(
  finding: RepositoryInterviewSubjectFindingV1,
): string {
  return stableJson({
    materiality: finding.materiality,
    criticalDomain: finding.criticalDomain,
    supportVerdict: finding.supportVerdict,
    basisVerdict: finding.basisVerdict,
    partialSupportLimitationId: finding.partialSupportLimitationId,
    citationScopeVerdict: finding.citationScopeVerdict,
    contradictionRepresentationVerdict:
      finding.contradictionRepresentationVerdict,
  });
}

function unknownDisagreementValue(
  finding: RepositoryInterviewUnknownFindingV1,
): string {
  return stableJson({
    materiality: finding.materiality,
    verdict: finding.verdict,
    disclosedUnknownId: finding.disclosedUnknownId,
  });
}

function subjectFindingKey(finding: RepositoryInterviewSubjectFindingV1) {
  return `${finding.subjectKind}\0${finding.subjectId}`;
}

function uniqueSubjects(
  values: readonly RepositoryInterviewSecondarySubjectV1[],
): RepositoryInterviewSecondarySubjectV1[] {
  return [
    ...new Map(values.map((value) => [subjectKey(value), value])).values(),
  ].sort((left, right) => compareText(subjectKey(left), subjectKey(right)));
}

function sameSubjectArray(
  left: readonly RepositoryInterviewSecondarySubjectV1[],
  right: readonly RepositoryInterviewSecondarySubjectV1[],
): boolean {
  return sameArray(left.map(subjectKey), right.map(subjectKey));
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

function sameArray(
  left: readonly unknown[],
  right: readonly unknown[],
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
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
