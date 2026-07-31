import {
  REPOSITORY_INTERVIEW_TOPICS,
  createModelExecutionV1,
  createRepositoryInterviewRequestV1,
  createRepositoryInterviewV1,
  type ModelExecutionInputV1,
  type RepositoryInterviewRequestV1,
} from '@gitblocks/contracts';

import type {
  RepositoryInterviewAdjudicationRecordV1,
  RepositoryInterviewAuditRecordV1,
  RepositoryInterviewAuditScopeV1,
  RepositoryInterviewCandidateRunResultV1,
  RepositoryInterviewEvaluationCorpusV1,
  RepositoryInterviewReviewStage,
  RepositoryInterviewRunSummaryV1,
  RepositoryInterviewSubjectFindingV1,
} from '../src/repository-interview-evaluation-contracts.ts';
import { selectRepositoryInterviewSecondarySampleV1 } from '../src/repository-interview-evaluation-audit.ts';
import { repositoryInterviewAuditInventoryDigestV1 } from '../src/repository-interview-evaluation-digests.ts';

const DIGEST = {
  artifactSet: '1'.repeat(64),
  specification: '2'.repeat(64),
  providerSchema: '3'.repeat(64),
  prompt: '4'.repeat(64),
  providerProjection: '5'.repeat(64),
  providerOutput: '6'.repeat(64),
} as const;

export function durableSyntheticExchange() {
  const request = createRepositoryInterviewRequestV1({
    contractVersion: '1.0.0',
    candidateId: 'synthetic-candidate',
    artifactSetId: `artifact-set-${'a'.repeat(48)}`,
    artifactSetIdentityDigest: DIGEST.artifactSet,
    specificationVersion: '1.0.0',
    specificationDigest: DIGEST.specification,
    rendererVersion: 'repository-interview-renderer-v1',
    providerOutputSchemaVersion: '1.0.0',
    providerOutputSchemaDigest: DIGEST.providerSchema,
    promptDigest: DIGEST.prompt,
  });
  const execution = createModelExecutionV1(executionInput(request));
  const citation = {
    artifactId: `artifact-${'c'.repeat(48)}`,
    startLine: 1,
    endLine: 2,
  } as const;
  const interview = createRepositoryInterviewV1({
    contractVersion: '1.0.0',
    candidateId: request.candidateId,
    artifactSetId: request.artifactSetId,
    artifactSetIdentityDigest: request.artifactSetIdentityDigest,
    requestId: request.requestId,
    requestIdentityDigest: request.identityDigest,
    executionId: execution.executionId,
    executionIdentityDigest: execution.identityDigest,
    providerOutputDigest: DIGEST.providerOutput,
    specificationVersion: request.specificationVersion,
    specificationDigest: request.specificationDigest,
    rendererVersion: request.rendererVersion,
    providerOutputSchemaVersion: request.providerOutputSchemaVersion,
    providerOutputSchemaDigest: request.providerOutputSchemaDigest,
    providerProjectionVersion: execution.modelProfile.providerProjectionVersion,
    providerProjectionDigest: execution.modelProfile.providerProjectionDigest,
    promptDigest: request.promptDigest,
    modelProfileDigest: execution.modelProfileDigest,
    citations: [citation],
    claims: REPOSITORY_INTERVIEW_TOPICS.map((topic, index) => ({
      kind: 'documented-position' as const,
      topic,
      statement: `Synthetic documented position ${String(index + 1)}.`,
      rationale: null,
      confidence: 'high' as const,
      citations: [citation],
    })),
    limitations: [
      {
        topic: 'adoption-and-limitations',
        basis: 'documented-position',
        statement: 'Synthetic limitation.',
        rationale: null,
        confidence: 'high',
        citations: [citation],
      },
    ],
    contradictions: [
      {
        topic: 'maintenance-and-support',
        kind: 'direct',
        explanation: 'Synthetic contradiction.',
        positions: [
          { statement: 'Synthetic position alpha.', citations: [citation] },
          { statement: 'Synthetic position beta.', citations: [citation] },
        ],
      },
    ],
    unknowns: [
      {
        topic: 'security-and-trust',
        reason: 'insufficient-detail',
        statement: 'The supplied artifact set does not establish this detail.',
        partialCitations: [citation],
      },
    ],
    publishedAt: '2026-07-30T12:01:00.000Z',
  });
  return { request, execution, interview };
}

export function makeRun(
  corpus: RepositoryInterviewEvaluationCorpusV1,
  stage: RepositoryInterviewReviewStage = 'gate-a',
  scopes?: readonly RepositoryInterviewAuditScopeV1[],
): RepositoryInterviewRunSummaryV1 {
  const candidates =
    stage === 'calibration'
      ? corpus.candidates.filter(({ calibrationMember }) => calibrationMember)
      : corpus.candidates;
  return {
    schemaVersion: '1.0.0',
    corpusId: 'repository-interviews-v1',
    corpusVersion: '1.0.0',
    stage,
    runId: `evalrun-${hex(stage === 'gate-a' ? 1 : 2, 48)}`,
    modelProfileDigest: hex(3, 64),
    corpusDigest: corpus.manifest.corpusDigest,
    cohortPolicyDigest: corpus.policyDigests.cohort,
    reviewPolicyDigest: corpus.policyDigests.review,
    rubricDigest: corpus.policyDigests.rubric,
    gatePolicyDigest: corpus.policyDigests.gate,
    candidateResults: candidates.map(({ candidateId }, index) => {
      const base = {
        candidateId,
        requestId: `intreq-${hex(100 + index, 48)}`,
        executionId: `modelexec-${hex(200 + index, 48)}`,
        interviewId: `interview-${hex(300 + index, 48)}`,
      };
      const scope =
        scopes?.find((value) => value.candidateId === candidateId) ??
        makeScope(base, index);
      return {
        ...base,
        status: 'completed' as const,
        auditScope: scope,
        contractValid: true,
        citationClosed: true,
        crossCandidateReferenceCount: 0,
        crossArtifactSetReferenceCount: 0,
      };
    }),
  };
}

export function makeScope(
  provenance: {
    readonly candidateId: string;
    readonly requestId: string;
    readonly executionId: string;
    readonly interviewId: string;
  },
  index: number,
  counts = { claims: 1, limitations: 1, contradictions: 1, unknowns: 1 },
): RepositoryInterviewAuditScopeV1 {
  const base = index * 100;
  const withoutDigest: Omit<
    RepositoryInterviewAuditScopeV1,
    'inventoryDigest'
  > = {
    schemaVersion: '1.0.0',
    ...provenance,
    requestRecordDigest: hex(1_000 + index, 64),
    executionRecordDigest: hex(2_000 + index, 64),
    interviewRecordDigest: hex(3_000 + index, 64),
    claimIds: Array.from(
      { length: counts.claims },
      (_, offset) => `intclaim-${hex(base + offset + 1, 48)}`,
    ),
    limitationIds: Array.from(
      { length: counts.limitations },
      (_, offset) => `intlimit-${hex(base + offset + 21, 48)}`,
    ),
    contradictionIds: Array.from(
      { length: counts.contradictions },
      (_, offset) => `intcontra-${hex(base + offset + 41, 48)}`,
    ),
    unknownIds: Array.from(
      { length: counts.unknowns },
      (_, offset) => `intunknown-${hex(base + offset + 61, 48)}`,
    ),
  };
  return {
    ...withoutDigest,
    inventoryDigest: repositoryInterviewAuditInventoryDigestV1(withoutDigest),
  };
}

export function fullFindings(
  scope: RepositoryInterviewAuditScopeV1,
): RepositoryInterviewSubjectFindingV1[] {
  return [
    ...scope.claimIds.map((subjectId) => finding('claim', subjectId)),
    ...scope.limitationIds.map((subjectId) => finding('limitation', subjectId)),
    ...scope.contradictionIds.map((subjectId) =>
      finding('contradiction', subjectId),
    ),
  ];
}

export function finding(
  subjectKind: RepositoryInterviewSubjectFindingV1['subjectKind'],
  subjectId: string,
): RepositoryInterviewSubjectFindingV1 {
  return {
    subjectKind,
    subjectId,
    materiality: 'material',
    criticalDomain: null,
    supportVerdict:
      subjectKind === 'contradiction' ? 'not-applicable' : 'supported',
    basisVerdict:
      subjectKind === 'contradiction' ? 'not-applicable' : 'correct',
    partialSupportLimitationId: null,
    citationScopeVerdict:
      subjectKind === 'contradiction' ? 'not-applicable' : 'narrow',
    contradictionRepresentationVerdict:
      subjectKind === 'contradiction' ? 'honest' : 'not-applicable',
    disputed: false,
  };
}

export function makeReview(
  result: RepositoryInterviewCandidateRunResultV1,
  index: number,
  reviewerRole: 'calibration-reviewer' | 'gate-primary' | 'gate-secondary',
  subjectFindings: readonly RepositoryInterviewSubjectFindingV1[],
): RepositoryInterviewAuditRecordV1 {
  if (result.status !== 'completed')
    throw new Error('Synthetic completed result required.');
  return {
    schemaVersion: '1.0.0',
    corpusId: 'repository-interviews-v1',
    corpusVersion: '1.0.0',
    stage: reviewerRole === 'calibration-reviewer' ? 'calibration' : 'gate-a',
    candidateId: result.candidateId,
    requestId: result.requestId,
    executionId: result.executionId,
    interviewId: result.interviewId,
    reviewId: `review-${hex(1_000 + index, 48)}`,
    reviewerId: `reviewer-${hex(2_000 + index, 32)}`,
    reviewerRole,
    blindToOtherReviews: reviewerRole !== 'gate-secondary',
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
      contradictionCoverage: 'sufficient',
    },
    overallUsefulness: 'useful',
  };
}

export function primaryAudits(
  run: RepositoryInterviewRunSummaryV1,
): RepositoryInterviewAuditRecordV1[] {
  return run.candidateResults.flatMap((result, index) =>
    result.status === 'completed'
      ? [
          makeReview(
            result,
            index,
            'gate-primary',
            fullFindings(result.auditScope),
          ),
        ]
      : [],
  );
}

export function calibrationAudits(
  run: RepositoryInterviewRunSummaryV1,
): RepositoryInterviewAuditRecordV1[] {
  return run.candidateResults.flatMap((result, index) =>
    result.status === 'completed'
      ? [
          makeReview(
            result,
            index * 2,
            'calibration-reviewer',
            fullFindings(result.auditScope),
          ),
          makeReview(
            result,
            index * 2 + 1,
            'calibration-reviewer',
            fullFindings(result.auditScope),
          ),
        ]
      : [],
  );
}

export function gateAudits(
  corpus: RepositoryInterviewEvaluationCorpusV1,
  run: RepositoryInterviewRunSummaryV1,
  primaries: readonly RepositoryInterviewAuditRecordV1[] = primaryAudits(run),
): RepositoryInterviewAuditRecordV1[] {
  const mandatory = primaries.flatMap((audit) =>
    audit.subjectFindings
      .filter(
        (value) =>
          value.disputed ||
          (value.materiality === 'critical' &&
            value.supportVerdict !== 'supported'),
      )
      .map((value) => ({
        candidateId: audit.candidateId,
        subjectKind: value.subjectKind,
        subjectId: value.subjectId,
      })),
  );
  const mandatoryKeys = new Set(mandatory.map(secondarySubjectKey));
  const sample = selectRepositoryInterviewSecondarySampleV1(
    primaries
      .flatMap((audit) =>
        audit.subjectFindings
          .filter((value) => value.materiality !== 'non-material')
          .map((value) => ({
            candidateId: audit.candidateId,
            subjectKind: value.subjectKind,
            subjectId: value.subjectId,
          })),
      )
      .filter((value) => !mandatoryKeys.has(secondarySubjectKey(value))),
    corpus.policies.review,
  );
  const requiredKeys = new Set(
    [...mandatory, ...sample].map(secondarySubjectKey),
  );
  const secondaries = run.candidateResults.flatMap((result, index) => {
    if (result.status !== 'completed') return [];
    const primary = primaries.find(
      ({ candidateId }) => candidateId === result.candidateId,
    );
    if (primary === undefined) return [];
    const findings = primary.subjectFindings.filter((value) =>
      requiredKeys.has(
        secondarySubjectKey({
          candidateId: result.candidateId,
          subjectKind: value.subjectKind,
          subjectId: value.subjectId,
        }),
      ),
    );
    const policyRequired =
      primary.policyFindings.promptInjection !== 'pass' ||
      primary.policyFindings.outsideKnowledge !== 'pass';
    return findings.length > 0 || policyRequired
      ? [makeReview(result, 100 + index, 'gate-secondary', findings)]
      : [];
  });
  return [...primaries, ...secondaries];
}

export function makeAdjudication(
  first: RepositoryInterviewAuditRecordV1,
  second: RepositoryInterviewAuditRecordV1,
  patch: Partial<RepositoryInterviewAdjudicationRecordV1> = {},
): RepositoryInterviewAdjudicationRecordV1 {
  return {
    schemaVersion: '1.0.0',
    corpusId: 'repository-interviews-v1',
    corpusVersion: '1.0.0',
    stage: first.stage,
    candidateId: first.candidateId,
    requestId: first.requestId,
    executionId: first.executionId,
    interviewId: first.interviewId,
    adjudicationId: `adjudication-${hex(1, 48)}`,
    adjudicatorId: `reviewer-${hex(9_999, 32)}`,
    sourceReviewIds: [first.reviewId, second.reviewId].sort(compareText) as [
      string,
      string,
    ],
    independentFromGeneration: true,
    adjudicatedAt: '2026-07-31T01:00:00.000Z',
    subjectResolutions: [],
    unknownResolutions: [],
    policyResolutions: [],
    ...patch,
  };
}

function executionInput(
  request: RepositoryInterviewRequestV1,
): ModelExecutionInputV1 {
  return {
    contractVersion: '1.0.0',
    requestId: request.requestId,
    requestIdentityDigest: request.identityDigest,
    executionNonce: 'b'.repeat(32),
    executionMode: 'normal',
    forceReason: null,
    modelProfile: {
      provider: 'openai',
      endpointProfile: 'responses-v1',
      modelSnapshot: 'gpt-5.4-mini-2026-03-17',
      providerProjectionVersion: '1.0.0',
      providerProjectionDigest: DIGEST.providerProjection,
      reasoningEffort: 'low',
      maximumOutputTokens: 8_192,
      maximumResponseBytes: 2_097_152,
      store: false,
      toolsEnabled: false,
      background: false,
      conversationState: false,
      previousResponseState: false,
      truncation: 'disabled',
      promptCacheRetention: 'in-memory',
      serviceTier: 'default',
      retryPolicyVersion: 'repository-interview-retry-v1',
    },
    startedAt: '2026-07-30T12:00:00.000Z',
    completedAt: '2026-07-30T12:00:01.000Z',
    attempts: [
      {
        ordinal: 1,
        startedAt: '2026-07-30T12:00:00.000Z',
        completedAt: '2026-07-30T12:00:01.000Z',
        transportOutcome: 'response',
        httpStatus: 200,
        providerRequestId: 'req_synthetic',
        responseId: 'resp_synthetic',
        responseBytes: 1_024,
        providerProcessingMilliseconds: 800,
        retryAfterMilliseconds: null,
        remainingRequests: 99,
        remainingTokens: 999_999,
        resetRequestsMilliseconds: 1_000,
        resetTokensMilliseconds: 1_000,
      },
    ],
    outcome: {
      status: 'succeeded',
      failureCode: null,
      providerOutputDigest: DIGEST.providerOutput,
      usage: {
        inputTokens: 1_000,
        cachedInputTokens: 100,
        outputTokens: 200,
        reasoningTokens: 50,
        totalTokens: 1_200,
      },
    },
  };
}

export function hex(value: number, width: number): string {
  return value.toString(16).padStart(width, '0');
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function secondarySubjectKey(value: {
  readonly candidateId: string;
  readonly subjectKind: string;
  readonly subjectId: string;
}): string {
  return `${value.candidateId}\0${value.subjectKind}\0${value.subjectId}`;
}
