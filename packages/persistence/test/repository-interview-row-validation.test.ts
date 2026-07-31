import { describe, expect, it } from 'vitest';

import {
  storedCitationRowsMatch,
  storedClaimRowsMatch,
  storedContradictionRowsMatch,
  storedExecutionRowMatches,
  storedLimitationRowsMatch,
  storedUnknownRowsMatch,
  type StoredCitationRow,
  type StoredClaimRow,
  type StoredContradictionRow,
  type StoredExecutionRow,
  type StoredLimitationRow,
  type StoredUnknownRow,
} from '../src/repository-interview-row-validation.ts';
import { createRepositoryInterviewPersistenceFixture } from './repository-interview-fixtures.ts';

describe('repository interview normalized row authority', () => {
  it('reconciles every execution column with its contract and request context', () => {
    const fixture = createRepositoryInterviewPersistenceFixture();
    const execution = fixture.execution;
    const row: StoredExecutionRow = {
      execution_id: execution.executionId,
      request_id: execution.requestId,
      candidate_id: fixture.request.candidateId,
      artifact_set_id: fixture.request.artifactSetId,
      contract_version: execution.contractVersion,
      request_identity_digest: execution.requestIdentityDigest,
      execution_nonce: execution.executionNonce,
      execution_mode: execution.executionMode,
      force_reason: execution.forceReason,
      provider: execution.modelProfile.provider,
      model_snapshot: execution.modelProfile.modelSnapshot,
      reasoning_effort: execution.modelProfile.reasoningEffort,
      model_profile_digest: execution.modelProfileDigest,
      reuse_key_digest: execution.reuseKeyDigest,
      started_at: execution.startedAt,
      completed_at: execution.completedAt,
      outcome_status: execution.outcome.status,
      failure_code: execution.outcome.failureCode,
      provider_output_digest: execution.outcome.providerOutputDigest,
      identity_digest: execution.identityDigest,
      record_digest: execution.recordDigest,
      canonical_payload: execution,
    };

    expect(storedExecutionRowMatches(row, execution, fixture.request)).toBe(
      true,
    );
    expect(
      storedExecutionRowMatches(
        { ...row, candidate_id: 'candidate-corrupt' },
        execution,
        fixture.request,
      ),
    ).toBe(false);
    expect(
      storedExecutionRowMatches(
        { ...row, artifact_set_id: 'artifact-set-corrupt' },
        execution,
        fixture.request,
      ),
    ).toBe(false);
  });

  it('reconciles citation ownership, coordinates, and digests', () => {
    const fixture = createRepositoryInterviewPersistenceFixture();
    const rows: readonly StoredCitationRow[] = fixture.interview.citations.map(
      (citation, ordinal) => ({
        citation_id: citation.citationId,
        interview_id: fixture.interview.interviewId,
        candidate_id: fixture.interview.candidateId,
        artifact_set_id: fixture.interview.artifactSetId,
        ordinal,
        artifact_id: citation.artifactId,
        start_line: citation.startLine,
        end_line: citation.endLine,
        identity_digest: citation.identityDigest,
        record_digest: citation.recordDigest,
        canonical_payload: citation,
      }),
    );

    expect(storedCitationRowsMatch(rows, fixture.interview)).toBe(true);
    for (const changed of [
      { candidate_id: 'candidate-corrupt' },
      { artifact_set_id: 'artifact-set-corrupt' },
      { artifact_id: `artifact-${'f'.repeat(48)}` },
      { start_line: 2 },
      { end_line: 2 },
    ]) {
      expect(
        storedCitationRowsMatch(replaceFirst(rows, changed), fixture.interview),
      ).toBe(false);
    }
  });

  it('reconciles claim ownership and every normalized query field', () => {
    const fixture = createRepositoryInterviewPersistenceFixture();
    const rows: readonly StoredClaimRow[] = fixture.interview.claims.map(
      (claim, ordinal) => ({
        claim_id: claim.claimId,
        interview_id: fixture.interview.interviewId,
        candidate_id: fixture.interview.candidateId,
        ordinal,
        claim_kind: claim.kind,
        topic: claim.topic,
        confidence: claim.confidence,
        identity_digest: claim.identityDigest,
        record_digest: claim.recordDigest,
        canonical_payload: claim,
      }),
    );

    expect(storedClaimRowsMatch(rows, fixture.interview)).toBe(true);
    for (const changed of [
      { candidate_id: 'candidate-corrupt' },
      { claim_kind: 'inference' },
      { topic: 'runtime-and-framework' },
      { confidence: 'medium' },
    ]) {
      expect(
        storedClaimRowsMatch(replaceFirst(rows, changed), fixture.interview),
      ).toBe(false);
    }
  });

  it('reconciles limitation ownership and every normalized query field', () => {
    const fixture = createRepositoryInterviewPersistenceFixture();
    const rows: readonly StoredLimitationRow[] =
      fixture.interview.limitations.map((limitation, ordinal) => ({
        limitation_id: limitation.limitationId,
        interview_id: fixture.interview.interviewId,
        candidate_id: fixture.interview.candidateId,
        ordinal,
        basis: limitation.basis,
        topic: limitation.topic,
        confidence: limitation.confidence,
        identity_digest: limitation.identityDigest,
        record_digest: limitation.recordDigest,
        canonical_payload: limitation,
      }));

    expect(storedLimitationRowsMatch(rows, fixture.interview)).toBe(true);
    for (const changed of [
      { candidate_id: 'candidate-corrupt' },
      { basis: 'inference' },
      { topic: 'purpose-and-scope' },
      { confidence: 'low' },
    ]) {
      expect(
        storedLimitationRowsMatch(
          replaceFirst(rows, changed),
          fixture.interview,
        ),
      ).toBe(false);
    }
  });

  it('reconciles contradiction ownership and every normalized query field', () => {
    const fixture = createRepositoryInterviewPersistenceFixture();
    const rows: readonly StoredContradictionRow[] =
      fixture.interview.contradictions.map((contradiction, ordinal) => ({
        contradiction_id: contradiction.contradictionId,
        interview_id: fixture.interview.interviewId,
        candidate_id: fixture.interview.candidateId,
        ordinal,
        topic: contradiction.topic,
        contradiction_kind: contradiction.kind,
        identity_digest: contradiction.identityDigest,
        record_digest: contradiction.recordDigest,
        canonical_payload: contradiction,
      }));

    expect(storedContradictionRowsMatch(rows, fixture.interview)).toBe(true);
    for (const changed of [
      { candidate_id: 'candidate-corrupt' },
      { topic: 'purpose-and-scope' },
      { contradiction_kind: 'direct' },
    ]) {
      expect(
        storedContradictionRowsMatch(
          replaceFirst(rows, changed),
          fixture.interview,
        ),
      ).toBe(false);
    }
  });

  it('reconciles unknown ownership and every normalized query field', () => {
    const fixture = createRepositoryInterviewPersistenceFixture();
    const rows: readonly StoredUnknownRow[] = fixture.interview.unknowns.map(
      (unknown, ordinal) => ({
        unknown_id: unknown.unknownId,
        interview_id: fixture.interview.interviewId,
        candidate_id: fixture.interview.candidateId,
        ordinal,
        topic: unknown.topic,
        reason: unknown.reason,
        identity_digest: unknown.identityDigest,
        record_digest: unknown.recordDigest,
        canonical_payload: unknown,
      }),
    );

    expect(storedUnknownRowsMatch(rows, fixture.interview)).toBe(true);
    for (const changed of [
      { candidate_id: 'candidate-corrupt' },
      { topic: 'purpose-and-scope' },
      { reason: 'ambiguous' },
    ]) {
      expect(
        storedUnknownRowsMatch(replaceFirst(rows, changed), fixture.interview),
      ).toBe(false);
    }
  });
});

function replaceFirst<Row extends object>(
  rows: readonly Row[],
  changed: Readonly<Partial<Row>>,
): readonly Row[] {
  const first = rows[0];
  if (first === undefined) {
    throw new Error('Synthetic row fixture requires one member.');
  }
  return [{ ...first, ...changed }, ...rows.slice(1)];
}
