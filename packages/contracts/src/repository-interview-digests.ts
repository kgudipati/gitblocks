import { contractCanonicalDigest } from './artifact-identity.ts';
import type {
  ModelExecutionModelProfileV1,
  ModelExecutionV1,
  RepositoryInterviewCitationV1,
  RepositoryInterviewClaimV1,
  RepositoryInterviewContradictionV1,
  RepositoryInterviewLimitationV1,
  RepositoryInterviewRequestV1,
  RepositoryInterviewUnknownV1,
  RepositoryInterviewV1,
} from './repository-interview-schemas.ts';

const IDENTITY_VERSION = '1' as const;

export function repositoryInterviewRequestIdentityDigest(
  value: Pick<
    RepositoryInterviewRequestV1,
    | 'contractVersion'
    | 'candidateId'
    | 'artifactSetId'
    | 'artifactSetIdentityDigest'
    | 'specificationVersion'
    | 'specificationDigest'
    | 'rendererVersion'
    | 'providerOutputSchemaVersion'
    | 'providerOutputSchemaDigest'
    | 'promptDigest'
  >,
): string {
  return contractCanonicalDigest({
    kind: 'repository-interview-request',
    identityVersion: IDENTITY_VERSION,
    contractVersion: value.contractVersion,
    candidateId: value.candidateId,
    artifactSetId: value.artifactSetId,
    artifactSetIdentityDigest: value.artifactSetIdentityDigest,
    specificationVersion: value.specificationVersion,
    specificationDigest: value.specificationDigest,
    rendererVersion: value.rendererVersion,
    providerOutputSchemaVersion: value.providerOutputSchemaVersion,
    providerOutputSchemaDigest: value.providerOutputSchemaDigest,
    promptDigest: value.promptDigest,
  });
}

export function repositoryInterviewRequestRecordDigest(
  value:
    | Omit<RepositoryInterviewRequestV1, 'recordDigest'>
    | RepositoryInterviewRequestV1,
): string {
  return contractRecordDigest(value);
}

export function modelExecutionModelProfileDigest(
  value: ModelExecutionModelProfileV1,
): string {
  return contractCanonicalDigest({
    kind: 'repository-interview-model-profile',
    identityVersion: IDENTITY_VERSION,
    profile: value,
  });
}

export function modelExecutionReuseKeyDigest(
  value: Pick<
    ModelExecutionV1,
    'contractVersion' | 'requestIdentityDigest' | 'modelProfileDigest'
  >,
): string {
  return contractCanonicalDigest({
    kind: 'repository-interview-execution-reuse',
    identityVersion: IDENTITY_VERSION,
    contractVersion: value.contractVersion,
    requestIdentityDigest: value.requestIdentityDigest,
    modelProfileDigest: value.modelProfileDigest,
  });
}

export function modelExecutionIdentityDigest(
  value: Pick<
    ModelExecutionV1,
    | 'contractVersion'
    | 'reuseKeyDigest'
    | 'executionNonce'
    | 'executionMode'
    | 'forceReason'
  >,
): string {
  return contractCanonicalDigest({
    kind: 'repository-interview-model-execution',
    identityVersion: IDENTITY_VERSION,
    contractVersion: value.contractVersion,
    reuseKeyDigest: value.reuseKeyDigest,
    executionNonce: value.executionNonce,
    executionMode: value.executionMode,
    forceReason: value.forceReason,
  });
}

export function modelExecutionRecordDigest(
  value: Omit<ModelExecutionV1, 'recordDigest'> | ModelExecutionV1,
): string {
  return contractRecordDigest(value);
}

export function repositoryInterviewCitationIdentityDigest(
  contractVersion: RepositoryInterviewV1['contractVersion'],
  executionId: RepositoryInterviewV1['executionId'],
  value: Pick<
    RepositoryInterviewCitationV1,
    'artifactId' | 'startLine' | 'endLine'
  >,
): string {
  return contractCanonicalDigest({
    kind: 'repository-interview-citation',
    identityVersion: IDENTITY_VERSION,
    contractVersion,
    executionId,
    artifactId: value.artifactId,
    startLine: value.startLine,
    endLine: value.endLine,
  });
}

export function repositoryInterviewClaimIdentityDigest(
  contractVersion: RepositoryInterviewV1['contractVersion'],
  executionId: RepositoryInterviewV1['executionId'],
  value: Pick<
    RepositoryInterviewClaimV1,
    'kind' | 'topic' | 'statement' | 'rationale' | 'confidence' | 'citationIds'
  >,
): string {
  return contractCanonicalDigest({
    kind: 'repository-interview-claim',
    identityVersion: IDENTITY_VERSION,
    contractVersion,
    executionId,
    claimKind: value.kind,
    topic: value.topic,
    statement: value.statement,
    rationale: value.rationale,
    confidence: value.confidence,
    citationIds: value.citationIds,
  });
}

export function repositoryInterviewLimitationIdentityDigest(
  contractVersion: RepositoryInterviewV1['contractVersion'],
  executionId: RepositoryInterviewV1['executionId'],
  value: Pick<
    RepositoryInterviewLimitationV1,
    'topic' | 'basis' | 'statement' | 'rationale' | 'confidence' | 'citationIds'
  >,
): string {
  return contractCanonicalDigest({
    kind: 'repository-interview-limitation',
    identityVersion: IDENTITY_VERSION,
    contractVersion,
    executionId,
    topic: value.topic,
    basis: value.basis,
    statement: value.statement,
    rationale: value.rationale,
    confidence: value.confidence,
    citationIds: value.citationIds,
  });
}

export function repositoryInterviewContradictionIdentityDigest(
  contractVersion: RepositoryInterviewV1['contractVersion'],
  executionId: RepositoryInterviewV1['executionId'],
  value: Pick<
    RepositoryInterviewContradictionV1,
    'topic' | 'kind' | 'explanation' | 'positions'
  >,
): string {
  return contractCanonicalDigest({
    kind: 'repository-interview-contradiction',
    identityVersion: IDENTITY_VERSION,
    contractVersion,
    executionId,
    topic: value.topic,
    contradictionKind: value.kind,
    explanation: value.explanation,
    positions: value.positions,
  });
}

export function repositoryInterviewUnknownIdentityDigest(
  contractVersion: RepositoryInterviewV1['contractVersion'],
  executionId: RepositoryInterviewV1['executionId'],
  value: Pick<
    RepositoryInterviewUnknownV1,
    'topic' | 'reason' | 'statement' | 'partialCitationIds'
  >,
): string {
  return contractCanonicalDigest({
    kind: 'repository-interview-unknown',
    identityVersion: IDENTITY_VERSION,
    contractVersion,
    executionId,
    topic: value.topic,
    reason: value.reason,
    statement: value.statement,
    partialCitationIds: value.partialCitationIds,
  });
}

export function repositoryInterviewNestedRecordDigest(
  value:
    | Omit<RepositoryInterviewCitationV1, 'recordDigest'>
    | RepositoryInterviewCitationV1
    | Omit<RepositoryInterviewClaimV1, 'recordDigest'>
    | RepositoryInterviewClaimV1
    | Omit<RepositoryInterviewLimitationV1, 'recordDigest'>
    | RepositoryInterviewLimitationV1
    | Omit<RepositoryInterviewContradictionV1, 'recordDigest'>
    | RepositoryInterviewContradictionV1
    | Omit<RepositoryInterviewUnknownV1, 'recordDigest'>
    | RepositoryInterviewUnknownV1,
): string {
  return contractRecordDigest(value);
}

export function repositoryInterviewIdentityDigest(
  value: Omit<
    RepositoryInterviewV1,
    'interviewId' | 'publishedAt' | 'identityDigest' | 'recordDigest'
  >,
): string {
  return contractCanonicalDigest({
    kind: 'repository-interview',
    identityVersion: IDENTITY_VERSION,
    contractVersion: value.contractVersion,
    candidateId: value.candidateId,
    artifactSetId: value.artifactSetId,
    artifactSetIdentityDigest: value.artifactSetIdentityDigest,
    requestId: value.requestId,
    requestIdentityDigest: value.requestIdentityDigest,
    executionId: value.executionId,
    executionIdentityDigest: value.executionIdentityDigest,
    providerOutputDigest: value.providerOutputDigest,
    specificationVersion: value.specificationVersion,
    specificationDigest: value.specificationDigest,
    rendererVersion: value.rendererVersion,
    providerOutputSchemaVersion: value.providerOutputSchemaVersion,
    providerOutputSchemaDigest: value.providerOutputSchemaDigest,
    providerProjectionVersion: value.providerProjectionVersion,
    providerProjectionDigest: value.providerProjectionDigest,
    promptDigest: value.promptDigest,
    modelProfileDigest: value.modelProfileDigest,
    processingState: value.processingState,
    citationIdentityDigests: value.citations.map((item) => item.identityDigest),
    claimIdentityDigests: value.claims.map((item) => item.identityDigest),
    limitationIdentityDigests: value.limitations.map(
      (item) => item.identityDigest,
    ),
    contradictionIdentityDigests: value.contradictions.map(
      (item) => item.identityDigest,
    ),
    unknownIdentityDigests: value.unknowns.map((item) => item.identityDigest),
  });
}

export function repositoryInterviewRecordDigest(
  value: Omit<RepositoryInterviewV1, 'recordDigest'> | RepositoryInterviewV1,
): string {
  return contractRecordDigest(value);
}

function contractRecordDigest(
  value: Readonly<Record<string, unknown>>,
): string {
  const record = Object.fromEntries(
    Object.entries(value).filter(([key]) => key !== 'recordDigest'),
  );
  return contractCanonicalDigest({
    kind: 'gitblocks-contract-record',
    recordVersion: IDENTITY_VERSION,
    value: record,
  });
}
