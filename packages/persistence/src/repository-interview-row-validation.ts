import type {
  ModelExecutionV1,
  RepositoryInterviewCitationV1,
  RepositoryInterviewClaimV1,
  RepositoryInterviewContradictionV1,
  RepositoryInterviewLimitationV1,
  RepositoryInterviewRequestV1,
  RepositoryInterviewUnknownV1,
  RepositoryInterviewV1,
} from '@gitblocks/contracts';

import { canonicalizeJson } from './canonical-json.ts';
import { normalizeStoredTimestamp } from './validation.ts';

export interface StoredExecutionRow {
  readonly execution_id: string;
  readonly request_id: string;
  readonly candidate_id: string;
  readonly artifact_set_id: string;
  readonly contract_version: string;
  readonly request_identity_digest: string;
  readonly execution_nonce: string;
  readonly execution_mode: string;
  readonly force_reason: string | null;
  readonly provider: string;
  readonly model_snapshot: string;
  readonly reasoning_effort: string;
  readonly model_profile_digest: string;
  readonly reuse_key_digest: string;
  readonly started_at: unknown;
  readonly completed_at: unknown;
  readonly outcome_status: string;
  readonly failure_code: string | null;
  readonly provider_output_digest: string | null;
  readonly identity_digest: string;
  readonly record_digest: string;
  readonly canonical_payload: unknown;
}

export interface StoredCitationRow {
  readonly citation_id: string;
  readonly interview_id: string;
  readonly candidate_id: string;
  readonly artifact_set_id: string;
  readonly ordinal: number;
  readonly artifact_id: string;
  readonly start_line: number;
  readonly end_line: number;
  readonly identity_digest: string;
  readonly record_digest: string;
  readonly canonical_payload: unknown;
}

export interface StoredClaimRow {
  readonly claim_id: string;
  readonly interview_id: string;
  readonly candidate_id: string;
  readonly ordinal: number;
  readonly claim_kind: string;
  readonly topic: string;
  readonly confidence: string;
  readonly identity_digest: string;
  readonly record_digest: string;
  readonly canonical_payload: unknown;
}

export interface StoredLimitationRow {
  readonly limitation_id: string;
  readonly interview_id: string;
  readonly candidate_id: string;
  readonly ordinal: number;
  readonly basis: string;
  readonly topic: string;
  readonly confidence: string;
  readonly identity_digest: string;
  readonly record_digest: string;
  readonly canonical_payload: unknown;
}

export interface StoredContradictionRow {
  readonly contradiction_id: string;
  readonly interview_id: string;
  readonly candidate_id: string;
  readonly ordinal: number;
  readonly topic: string;
  readonly contradiction_kind: string;
  readonly identity_digest: string;
  readonly record_digest: string;
  readonly canonical_payload: unknown;
}

export interface StoredUnknownRow {
  readonly unknown_id: string;
  readonly interview_id: string;
  readonly candidate_id: string;
  readonly ordinal: number;
  readonly topic: string;
  readonly reason: string;
  readonly identity_digest: string;
  readonly record_digest: string;
  readonly canonical_payload: unknown;
}

export function storedExecutionRowMatches(
  row: StoredExecutionRow,
  execution: ModelExecutionV1,
  request: RepositoryInterviewRequestV1,
): boolean {
  return (
    row.execution_id === execution.executionId &&
    row.request_id === execution.requestId &&
    row.request_id === request.requestId &&
    row.candidate_id === request.candidateId &&
    row.artifact_set_id === request.artifactSetId &&
    row.contract_version === execution.contractVersion &&
    row.request_identity_digest === execution.requestIdentityDigest &&
    row.request_identity_digest === request.identityDigest &&
    row.execution_nonce === execution.executionNonce &&
    row.execution_mode === execution.executionMode &&
    row.force_reason === execution.forceReason &&
    row.provider === execution.modelProfile.provider &&
    row.model_snapshot === execution.modelProfile.modelSnapshot &&
    row.reasoning_effort === execution.modelProfile.reasoningEffort &&
    row.model_profile_digest === execution.modelProfileDigest &&
    row.reuse_key_digest === execution.reuseKeyDigest &&
    normalizeStoredTimestamp(row.started_at) === execution.startedAt &&
    normalizeStoredTimestamp(row.completed_at) === execution.completedAt &&
    row.outcome_status === execution.outcome.status &&
    row.failure_code === execution.outcome.failureCode &&
    row.provider_output_digest === execution.outcome.providerOutputDigest &&
    row.identity_digest === execution.identityDigest &&
    row.record_digest === execution.recordDigest &&
    sameJson(row.canonical_payload, execution)
  );
}

export function storedCitationRowsMatch(
  rows: readonly StoredCitationRow[],
  interview: RepositoryInterviewV1,
): boolean {
  return rowsMatch(rows, interview.citations, (row, citation, ordinal) =>
    citationRowMatches(row, citation, interview, ordinal),
  );
}

export function storedClaimRowsMatch(
  rows: readonly StoredClaimRow[],
  interview: RepositoryInterviewV1,
): boolean {
  return rowsMatch(rows, interview.claims, (row, claim, ordinal) =>
    claimRowMatches(row, claim, interview, ordinal),
  );
}

export function storedLimitationRowsMatch(
  rows: readonly StoredLimitationRow[],
  interview: RepositoryInterviewV1,
): boolean {
  return rowsMatch(rows, interview.limitations, (row, limitation, ordinal) =>
    limitationRowMatches(row, limitation, interview, ordinal),
  );
}

export function storedContradictionRowsMatch(
  rows: readonly StoredContradictionRow[],
  interview: RepositoryInterviewV1,
): boolean {
  return rowsMatch(
    rows,
    interview.contradictions,
    (row, contradiction, ordinal) =>
      contradictionRowMatches(row, contradiction, interview, ordinal),
  );
}

export function storedUnknownRowsMatch(
  rows: readonly StoredUnknownRow[],
  interview: RepositoryInterviewV1,
): boolean {
  return rowsMatch(rows, interview.unknowns, (row, unknown, ordinal) =>
    unknownRowMatches(row, unknown, interview, ordinal),
  );
}

function citationRowMatches(
  row: StoredCitationRow,
  citation: RepositoryInterviewCitationV1,
  interview: RepositoryInterviewV1,
  ordinal: number,
): boolean {
  return (
    row.citation_id === citation.citationId &&
    parentMatches(row, interview, ordinal) &&
    row.artifact_set_id === interview.artifactSetId &&
    row.artifact_id === citation.artifactId &&
    row.start_line === citation.startLine &&
    row.end_line === citation.endLine &&
    nestedRecordMatches(row, citation)
  );
}

function claimRowMatches(
  row: StoredClaimRow,
  claim: RepositoryInterviewClaimV1,
  interview: RepositoryInterviewV1,
  ordinal: number,
): boolean {
  return (
    row.claim_id === claim.claimId &&
    parentMatches(row, interview, ordinal) &&
    row.claim_kind === claim.kind &&
    row.topic === claim.topic &&
    row.confidence === claim.confidence &&
    nestedRecordMatches(row, claim)
  );
}

function limitationRowMatches(
  row: StoredLimitationRow,
  limitation: RepositoryInterviewLimitationV1,
  interview: RepositoryInterviewV1,
  ordinal: number,
): boolean {
  return (
    row.limitation_id === limitation.limitationId &&
    parentMatches(row, interview, ordinal) &&
    row.basis === limitation.basis &&
    row.topic === limitation.topic &&
    row.confidence === limitation.confidence &&
    nestedRecordMatches(row, limitation)
  );
}

function contradictionRowMatches(
  row: StoredContradictionRow,
  contradiction: RepositoryInterviewContradictionV1,
  interview: RepositoryInterviewV1,
  ordinal: number,
): boolean {
  return (
    row.contradiction_id === contradiction.contradictionId &&
    parentMatches(row, interview, ordinal) &&
    row.topic === contradiction.topic &&
    row.contradiction_kind === contradiction.kind &&
    nestedRecordMatches(row, contradiction)
  );
}

function unknownRowMatches(
  row: StoredUnknownRow,
  unknown: RepositoryInterviewUnknownV1,
  interview: RepositoryInterviewV1,
  ordinal: number,
): boolean {
  return (
    row.unknown_id === unknown.unknownId &&
    parentMatches(row, interview, ordinal) &&
    row.topic === unknown.topic &&
    row.reason === unknown.reason &&
    nestedRecordMatches(row, unknown)
  );
}

function rowsMatch<Row, Value>(
  rows: readonly Row[],
  values: readonly Value[],
  matches: (row: Row, value: Value, ordinal: number) => boolean,
): boolean {
  return (
    rows.length === values.length &&
    rows.every((row, ordinal) => {
      const value = values[ordinal];
      return value !== undefined && matches(row, value, ordinal);
    })
  );
}

function parentMatches(
  row: {
    readonly interview_id: string;
    readonly candidate_id: string;
    readonly ordinal: number;
  },
  interview: RepositoryInterviewV1,
  ordinal: number,
): boolean {
  return (
    row.interview_id === interview.interviewId &&
    row.candidate_id === interview.candidateId &&
    row.ordinal === ordinal
  );
}

function nestedRecordMatches(
  row: {
    readonly identity_digest: string;
    readonly record_digest: string;
    readonly canonical_payload: unknown;
  },
  value: {
    readonly identityDigest: string;
    readonly recordDigest: string;
  },
): boolean {
  return (
    row.identity_digest === value.identityDigest &&
    row.record_digest === value.recordDigest &&
    sameJson(row.canonical_payload, value)
  );
}

function sameJson(left: unknown, right: unknown): boolean {
  try {
    return canonicalizeJson(left).json === canonicalizeJson(right).json;
  } catch {
    return false;
  }
}
