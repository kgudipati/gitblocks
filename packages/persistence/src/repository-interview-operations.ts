import {
  parseModelExecutionV1,
  parseRepositoryInterviewRequestV1,
  parseRepositoryInterviewV1,
  validateRepositoryInterviewExecutionV1,
  type ModelExecutionV1,
  type RepositoryInterviewCitationV1,
  type RepositoryInterviewClaimV1,
  type RepositoryInterviewContradictionV1,
  type RepositoryInterviewLimitationV1,
  type RepositoryInterviewRequestV1,
  type RepositoryInterviewUnknownV1,
  type RepositoryInterviewV1,
} from '@gitblocks/contracts';
import type { JSONValue } from 'postgres';

import { canonicalizeJson } from './canonical-json.ts';
import {
  executePending,
  withTransaction,
  type PersistenceClient,
  type PersistenceTransaction,
} from './client.ts';
import { PersistenceError, persistenceError } from './errors.ts';
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
} from './repository-interview-row-validation.ts';
import type {
  FindReusableRepositoryInterviewCommand,
  LoadRepositoryInterviewExchangeCommand,
  OperationControl,
  PublishRepositoryInterviewExchangeCommand,
  PublishRepositoryInterviewExchangeResult,
  RepositoryInterviewReusableExchange,
  RepositoryInterviewStoredExchange,
} from './types.ts';
import { normalizeStoredTimestamp } from './validation.ts';

const INTERVIEW_LOCK_SEED = 44392819;
const DIGEST_PATTERN = /^[0-9a-f]{64}$/u;
const EXECUTION_ID_PATTERN = /^modelexec-[0-9a-f]{48}$/u;
const INTERVIEW_ID_PATTERN = /^interview-[0-9a-f]{48}$/u;

interface InsertedRow {
  readonly inserted: number;
}

interface RequestRow {
  readonly request_id: string;
  readonly candidate_id: string;
  readonly artifact_set_id: string;
  readonly contract_version: string;
  readonly artifact_set_identity_digest: string;
  readonly specification_version: string;
  readonly specification_digest: string;
  readonly renderer_version: string;
  readonly provider_output_schema_version: string;
  readonly provider_output_schema_digest: string;
  readonly prompt_digest: string;
  readonly identity_digest: string;
  readonly record_digest: string;
  readonly canonical_payload: unknown;
}

interface InterviewRow {
  readonly interview_id: string;
  readonly candidate_id: string;
  readonly artifact_set_id: string;
  readonly request_id: string;
  readonly execution_id: string;
  readonly contract_version: string;
  readonly artifact_set_identity_digest: string;
  readonly request_identity_digest: string;
  readonly execution_identity_digest: string;
  readonly provider_output_digest: string;
  readonly specification_version: string;
  readonly specification_digest: string;
  readonly renderer_version: string;
  readonly provider_output_schema_version: string;
  readonly provider_output_schema_digest: string;
  readonly provider_projection_version: string;
  readonly provider_projection_digest: string;
  readonly prompt_digest: string;
  readonly model_profile_digest: string;
  readonly processing_state: string;
  readonly published_at: unknown;
  readonly citation_count: number;
  readonly claim_count: number;
  readonly limitation_count: number;
  readonly contradiction_count: number;
  readonly unknown_count: number;
  readonly identity_digest: string;
  readonly record_digest: string;
  readonly canonical_payload: unknown;
}

interface ArtifactSetAuthorityRow {
  readonly candidate_id: string;
  readonly identity_digest: string;
}

interface ExecutionLookupRow {
  readonly execution_id: string;
}

interface InterviewExecutionLookupRow {
  readonly execution_id: string;
}

interface ValidatedPublication {
  readonly request: RepositoryInterviewRequestV1;
  readonly execution: ModelExecutionV1;
  readonly interview: RepositoryInterviewV1 | null;
}

interface LoadedExecutionAuthority {
  readonly row: StoredExecutionRow;
  readonly value: ModelExecutionV1;
}

export async function publishRepositoryInterviewExchange(
  client: PersistenceClient,
  command: PublishRepositoryInterviewExchangeCommand,
  control?: OperationControl,
): Promise<PublishRepositoryInterviewExchangeResult> {
  const publication = validatePublication(command);
  return withTransaction(
    client,
    control,
    'read-write',
    async (transaction, signal) => {
      await executePending(
        transaction`
          select pg_catalog.pg_advisory_xact_lock(
            pg_catalog.hashtextextended(
              ${`${publication.request.identityDigest}:${publication.execution.executionId}`},
              ${INTERVIEW_LOCK_SEED}
            )
          )
        `,
        signal,
      );
      await requireArtifactSet(transaction, publication.request, signal);

      const inserted = emptyInsertedCounts();
      inserted.requests = await insertRequest(
        transaction,
        publication.request,
        signal,
      );
      inserted.executions = await insertExecution(
        transaction,
        publication,
        signal,
      );

      if (inserted.executions === 0) {
        const stored = await loadPublicationConflictAuthority(
          transaction,
          publication.execution.executionId,
          signal,
        );
        requireSameExchange(stored, publication);
        return {
          status: 'idempotent',
          record: stored,
          inserted: emptyInsertedCounts(),
        };
      }

      if (publication.interview !== null) {
        inserted.interviews = await insertInterview(
          transaction,
          publication.interview,
          signal,
        );
        for (const [
          ordinal,
          citation,
        ] of publication.interview.citations.entries()) {
          inserted.citations += await insertCitation(
            transaction,
            publication.interview,
            citation,
            ordinal,
            signal,
          );
        }
        for (const [ordinal, claim] of publication.interview.claims.entries()) {
          inserted.claims += await insertClaim(
            transaction,
            publication.interview,
            claim,
            ordinal,
            signal,
          );
        }
        for (const [
          ordinal,
          limitation,
        ] of publication.interview.limitations.entries()) {
          inserted.limitations += await insertLimitation(
            transaction,
            publication.interview,
            limitation,
            ordinal,
            signal,
          );
        }
        for (const [
          ordinal,
          contradiction,
        ] of publication.interview.contradictions.entries()) {
          inserted.contradictions += await insertContradiction(
            transaction,
            publication.interview,
            contradiction,
            ordinal,
            signal,
          );
        }
        for (const [
          ordinal,
          unknown,
        ] of publication.interview.unknowns.entries()) {
          inserted.unknowns += await insertUnknown(
            transaction,
            publication.interview,
            unknown,
            ordinal,
            signal,
          );
        }
      }

      await executePending(transaction`set constraints all immediate`, signal);
      const stored = await loadExchangeByExecution(
        transaction,
        publication.execution.executionId,
        signal,
      );
      requireSameExchange(stored, publication);
      return {
        status: 'created',
        record: stored,
        inserted,
      };
    },
  );
}

export async function findReusableRepositoryInterview(
  client: PersistenceClient,
  command: FindReusableRepositoryInterviewCommand,
  control?: OperationControl,
): Promise<RepositoryInterviewReusableExchange | null> {
  const lookup = validateReuseLookup(command);
  return withTransaction(
    client,
    control,
    'read-only',
    async (transaction, signal) => {
      const rows = await executePending<readonly ExecutionLookupRow[]>(
        transaction`
          select execution_id
          from gitblocks.model_executions
          where request_identity_digest = ${lookup.requestIdentityDigest}
            and model_profile_digest = ${lookup.modelProfileDigest}
            and reuse_key_digest = ${lookup.reuseKeyDigest}
            and execution_mode = 'normal'
            and outcome_status = 'succeeded'
          order by completed_at, execution_id
          limit 1
        `,
        signal,
      );
      const row = rows[0];
      if (row === undefined) {
        return null;
      }
      const exchange = await loadExchangeByExecution(
        transaction,
        row.execution_id,
        signal,
      );
      if (
        exchange.interview === null ||
        exchange.request.identityDigest !== lookup.requestIdentityDigest ||
        exchange.execution.modelProfileDigest !== lookup.modelProfileDigest ||
        exchange.execution.reuseKeyDigest !== lookup.reuseKeyDigest ||
        exchange.execution.executionMode !== 'normal' ||
        exchange.execution.outcome.status !== 'succeeded'
      ) {
        throw persistenceError('persistence.corrupt-record');
      }
      return {
        request: exchange.request,
        execution: exchange.execution,
        interview: exchange.interview,
      };
    },
  );
}

export async function loadRepositoryInterviewExchange(
  client: PersistenceClient,
  command: LoadRepositoryInterviewExchangeCommand,
  control?: OperationControl,
): Promise<RepositoryInterviewStoredExchange> {
  const lookup = validateLoadLookup(command);
  return withTransaction(
    client,
    control,
    'read-only',
    async (transaction, signal) => {
      if (lookup.by === 'execution-id') {
        return loadExchangeByExecution(transaction, lookup.executionId, signal);
      }
      const rows = await executePending<readonly InterviewExecutionLookupRow[]>(
        transaction`
          select execution_id
          from gitblocks.repository_interviews
          where interview_id = ${lookup.interviewId}
        `,
        signal,
      );
      const row = rows[0];
      if (rows.length !== 1 || row === undefined) {
        throw persistenceError('persistence.not-found');
      }
      return loadExchangeByExecution(transaction, row.execution_id, signal);
    },
  );
}

function validatePublication(command: unknown): ValidatedPublication {
  const owned = ownClosedRecord(command, ['request', 'execution', 'interview']);
  const parsedRequest = parseRepositoryInterviewRequestV1(owned['request']);
  const parsedExecution = parseModelExecutionV1(owned['execution']);
  if (!parsedRequest.ok || !parsedExecution.ok) {
    throw persistenceError('persistence.invalid-input');
  }
  const request = parsedRequest.value;
  const execution = parsedExecution.value;
  if (
    execution.requestId !== request.requestId ||
    execution.requestIdentityDigest !== request.identityDigest
  ) {
    throw persistenceError('persistence.invalid-input');
  }
  const suppliedInterview = owned['interview'];
  if (execution.outcome.status === 'failed') {
    if (suppliedInterview !== null) {
      throw persistenceError('persistence.invalid-input');
    }
    return { request, execution, interview: null };
  }
  if (suppliedInterview === null) {
    throw persistenceError('persistence.invalid-input');
  }
  const parsedInterview = parseRepositoryInterviewV1(suppliedInterview);
  if (!parsedInterview.ok) {
    throw persistenceError('persistence.invalid-input');
  }
  const closure = validateRepositoryInterviewExecutionV1(
    request,
    execution,
    parsedInterview.value,
  );
  if (!closure.ok) {
    throw persistenceError('persistence.invalid-input');
  }
  return {
    request: closure.request,
    execution: closure.execution,
    interview: closure.interview,
  };
}

function validateReuseLookup(
  command: unknown,
): FindReusableRepositoryInterviewCommand {
  const owned = ownClosedRecord(command, [
    'requestIdentityDigest',
    'modelProfileDigest',
    'reuseKeyDigest',
  ]);
  const requestIdentityDigest = owned['requestIdentityDigest'];
  const modelProfileDigest = owned['modelProfileDigest'];
  const reuseKeyDigest = owned['reuseKeyDigest'];
  if (
    typeof requestIdentityDigest !== 'string' ||
    typeof modelProfileDigest !== 'string' ||
    typeof reuseKeyDigest !== 'string' ||
    !DIGEST_PATTERN.test(requestIdentityDigest) ||
    !DIGEST_PATTERN.test(modelProfileDigest) ||
    !DIGEST_PATTERN.test(reuseKeyDigest)
  ) {
    throw persistenceError('persistence.invalid-input');
  }
  return { requestIdentityDigest, modelProfileDigest, reuseKeyDigest };
}

function validateLoadLookup(
  command: unknown,
): LoadRepositoryInterviewExchangeCommand {
  const initial = ownClosedRecord(command);
  if (initial['by'] === 'execution-id') {
    const owned = ownClosedRecord(command, ['by', 'executionId']);
    const executionId = owned['executionId'];
    if (
      typeof executionId !== 'string' ||
      !EXECUTION_ID_PATTERN.test(executionId)
    ) {
      throw persistenceError('persistence.invalid-input');
    }
    return { by: 'execution-id', executionId };
  }
  if (initial['by'] === 'interview-id') {
    const owned = ownClosedRecord(command, ['by', 'interviewId']);
    const interviewId = owned['interviewId'];
    if (
      typeof interviewId !== 'string' ||
      !INTERVIEW_ID_PATTERN.test(interviewId)
    ) {
      throw persistenceError('persistence.invalid-input');
    }
    return { by: 'interview-id', interviewId };
  }
  throw persistenceError('persistence.invalid-input');
}

function ownClosedRecord(
  value: unknown,
  expectedKeys?: readonly string[],
): Readonly<Record<string, unknown>> {
  try {
    if (
      typeof value !== 'object' ||
      value === null ||
      Object.getPrototypeOf(value) !== Object.prototype
    ) {
      throw persistenceError('persistence.invalid-input');
    }
    const keys = Reflect.ownKeys(value);
    if (
      keys.some((key) => typeof key !== 'string') ||
      (expectedKeys !== undefined &&
        (keys.length !== expectedKeys.length ||
          expectedKeys.some((key) => !keys.includes(key))))
    ) {
      throw persistenceError('persistence.invalid-input');
    }
    const owned: Record<string, unknown> = {};
    for (const key of keys) {
      if (typeof key !== 'string') {
        throw persistenceError('persistence.invalid-input');
      }
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        descriptor === undefined ||
        !Object.hasOwn(descriptor, 'value') ||
        descriptor.enumerable !== true
      ) {
        throw persistenceError('persistence.invalid-input');
      }
      owned[key] = (
        descriptor as PropertyDescriptor & { readonly value: unknown }
      ).value;
    }
    return owned;
  } catch (error) {
    if (error instanceof PersistenceError) {
      throw error;
    }
    throw persistenceError('persistence.invalid-input');
  }
}

async function requireArtifactSet(
  transaction: PersistenceTransaction,
  request: RepositoryInterviewRequestV1,
  signal: AbortSignal | undefined,
): Promise<void> {
  const rows = await executePending<readonly ArtifactSetAuthorityRow[]>(
    transaction`
      select candidate_id, identity_digest
      from gitblocks.repository_artifact_sets
      where artifact_set_id = ${request.artifactSetId}
    `,
    signal,
  );
  const row = rows[0];
  if (
    rows.length !== 1 ||
    row?.candidate_id !== request.candidateId ||
    row.identity_digest !== request.artifactSetIdentityDigest
  ) {
    throw persistenceError('persistence.conflict');
  }
}

async function insertRequest(
  transaction: PersistenceTransaction,
  request: RepositoryInterviewRequestV1,
  signal: AbortSignal | undefined,
): Promise<number> {
  const payload = canonicalizeJson(request);
  const rows = await executePending<readonly InsertedRow[]>(
    transaction`
      insert into gitblocks.repository_interview_requests (
        request_id,
        candidate_id,
        artifact_set_id,
        contract_version,
        artifact_set_identity_digest,
        specification_version,
        specification_digest,
        renderer_version,
        provider_output_schema_version,
        provider_output_schema_digest,
        prompt_digest,
        identity_digest,
        record_digest,
        canonical_payload
      )
      values (
        ${request.requestId},
        ${request.candidateId},
        ${request.artifactSetId},
        ${request.contractVersion},
        ${request.artifactSetIdentityDigest},
        ${request.specificationVersion},
        ${request.specificationDigest},
        ${request.rendererVersion},
        ${request.providerOutputSchemaVersion},
        ${request.providerOutputSchemaDigest},
        ${request.promptDigest},
        ${request.identityDigest},
        ${request.recordDigest},
        ${transaction.json(payload.value as JSONValue)}
      )
      on conflict do nothing
      returning 1 as inserted
    `,
    signal,
  );
  if (rows.length === 1) {
    return 1;
  }
  let stored: RepositoryInterviewRequestV1;
  try {
    stored = await loadRequest(transaction, request.requestId, signal);
  } catch (error) {
    if (
      error instanceof PersistenceError &&
      (error.code === 'persistence.not-found' ||
        error.code === 'persistence.corrupt-record')
    ) {
      throw persistenceError('persistence.conflict');
    }
    throw error;
  }
  if (!sameRecord(stored, request)) {
    throw persistenceError('persistence.conflict');
  }
  return 0;
}

async function loadPublicationConflictAuthority(
  transaction: PersistenceTransaction,
  executionId: string,
  signal: AbortSignal | undefined,
): Promise<RepositoryInterviewStoredExchange> {
  try {
    return await loadExchangeByExecution(transaction, executionId, signal);
  } catch (error) {
    if (
      error instanceof PersistenceError &&
      (error.code === 'persistence.not-found' ||
        error.code === 'persistence.corrupt-record')
    ) {
      throw persistenceError('persistence.conflict');
    }
    throw error;
  }
}

async function insertExecution(
  transaction: PersistenceTransaction,
  publication: ValidatedPublication,
  signal: AbortSignal | undefined,
): Promise<number> {
  const execution = publication.execution;
  const payload = canonicalizeJson(execution);
  const rows = await executePending<readonly InsertedRow[]>(
    transaction`
      insert into gitblocks.model_executions (
        execution_id,
        request_id,
        candidate_id,
        artifact_set_id,
        contract_version,
        request_identity_digest,
        execution_nonce,
        execution_mode,
        force_reason,
        provider,
        model_snapshot,
        reasoning_effort,
        model_profile_digest,
        reuse_key_digest,
        started_at,
        completed_at,
        outcome_status,
        failure_code,
        provider_output_digest,
        identity_digest,
        record_digest,
        canonical_payload
      )
      values (
        ${execution.executionId},
        ${execution.requestId},
        ${publication.request.candidateId},
        ${publication.request.artifactSetId},
        ${execution.contractVersion},
        ${execution.requestIdentityDigest},
        ${execution.executionNonce},
        ${execution.executionMode},
        ${execution.forceReason},
        ${execution.modelProfile.provider},
        ${execution.modelProfile.modelSnapshot},
        ${execution.modelProfile.reasoningEffort},
        ${execution.modelProfileDigest},
        ${execution.reuseKeyDigest},
        ${execution.startedAt}::timestamptz,
        ${execution.completedAt}::timestamptz,
        ${execution.outcome.status},
        ${execution.outcome.failureCode},
        ${execution.outcome.providerOutputDigest},
        ${execution.identityDigest},
        ${execution.recordDigest},
        ${transaction.json(payload.value as JSONValue)}
      )
      on conflict do nothing
      returning 1 as inserted
    `,
    signal,
  );
  return rows.length === 1 ? 1 : 0;
}

async function insertInterview(
  transaction: PersistenceTransaction,
  interview: RepositoryInterviewV1,
  signal: AbortSignal | undefined,
): Promise<number> {
  const payload = canonicalizeJson(interview);
  const rows = await executePending<readonly InsertedRow[]>(
    transaction`
      insert into gitblocks.repository_interviews (
        interview_id,
        candidate_id,
        artifact_set_id,
        request_id,
        execution_id,
        contract_version,
        artifact_set_identity_digest,
        request_identity_digest,
        execution_identity_digest,
        provider_output_digest,
        specification_version,
        specification_digest,
        renderer_version,
        provider_output_schema_version,
        provider_output_schema_digest,
        provider_projection_version,
        provider_projection_digest,
        prompt_digest,
        model_profile_digest,
        processing_state,
        published_at,
        citation_count,
        claim_count,
        limitation_count,
        contradiction_count,
        unknown_count,
        identity_digest,
        record_digest,
        canonical_payload
      )
      values (
        ${interview.interviewId},
        ${interview.candidateId},
        ${interview.artifactSetId},
        ${interview.requestId},
        ${interview.executionId},
        ${interview.contractVersion},
        ${interview.artifactSetIdentityDigest},
        ${interview.requestIdentityDigest},
        ${interview.executionIdentityDigest},
        ${interview.providerOutputDigest},
        ${interview.specificationVersion},
        ${interview.specificationDigest},
        ${interview.rendererVersion},
        ${interview.providerOutputSchemaVersion},
        ${interview.providerOutputSchemaDigest},
        ${interview.providerProjectionVersion},
        ${interview.providerProjectionDigest},
        ${interview.promptDigest},
        ${interview.modelProfileDigest},
        ${interview.processingState},
        ${interview.publishedAt}::timestamptz,
        ${interview.citations.length},
        ${interview.claims.length},
        ${interview.limitations.length},
        ${interview.contradictions.length},
        ${interview.unknowns.length},
        ${interview.identityDigest},
        ${interview.recordDigest},
        ${transaction.json(payload.value as JSONValue)}
      )
      on conflict do nothing
      returning 1 as inserted
    `,
    signal,
  );
  return rows.length === 1 ? 1 : 0;
}

async function insertCitation(
  transaction: PersistenceTransaction,
  interview: RepositoryInterviewV1,
  citation: RepositoryInterviewCitationV1,
  ordinal: number,
  signal: AbortSignal | undefined,
): Promise<number> {
  const rows = await executePending<readonly InsertedRow[]>(
    transaction`
      insert into gitblocks.repository_interview_citations (
        citation_id,
        interview_id,
        candidate_id,
        artifact_set_id,
        ordinal,
        artifact_id,
        start_line,
        end_line,
        identity_digest,
        record_digest,
        canonical_payload
      )
      values (
        ${citation.citationId},
        ${interview.interviewId},
        ${interview.candidateId},
        ${interview.artifactSetId},
        ${ordinal},
        ${citation.artifactId},
        ${citation.startLine},
        ${citation.endLine},
        ${citation.identityDigest},
        ${citation.recordDigest},
        ${transaction.json(canonicalizeJson(citation).value as JSONValue)}
      )
      on conflict do nothing
      returning 1 as inserted
    `,
    signal,
  );
  return rows.length === 1 ? 1 : 0;
}

async function insertClaim(
  transaction: PersistenceTransaction,
  interview: RepositoryInterviewV1,
  claim: RepositoryInterviewClaimV1,
  ordinal: number,
  signal: AbortSignal | undefined,
): Promise<number> {
  return insertSemanticRow(
    transaction`
      insert into gitblocks.repository_interview_claims (
        claim_id,
        interview_id,
        candidate_id,
        ordinal,
        claim_kind,
        topic,
        confidence,
        identity_digest,
        record_digest,
        canonical_payload
      )
      values (
        ${claim.claimId},
        ${interview.interviewId},
        ${interview.candidateId},
        ${ordinal},
        ${claim.kind},
        ${claim.topic},
        ${claim.confidence},
        ${claim.identityDigest},
        ${claim.recordDigest},
        ${transaction.json(canonicalizeJson(claim).value as JSONValue)}
      )
      on conflict do nothing
      returning 1 as inserted
    `,
    signal,
  );
}

async function insertLimitation(
  transaction: PersistenceTransaction,
  interview: RepositoryInterviewV1,
  limitation: RepositoryInterviewLimitationV1,
  ordinal: number,
  signal: AbortSignal | undefined,
): Promise<number> {
  return insertSemanticRow(
    transaction`
      insert into gitblocks.repository_interview_limitations (
        limitation_id,
        interview_id,
        candidate_id,
        ordinal,
        basis,
        topic,
        confidence,
        identity_digest,
        record_digest,
        canonical_payload
      )
      values (
        ${limitation.limitationId},
        ${interview.interviewId},
        ${interview.candidateId},
        ${ordinal},
        ${limitation.basis},
        ${limitation.topic},
        ${limitation.confidence},
        ${limitation.identityDigest},
        ${limitation.recordDigest},
        ${transaction.json(canonicalizeJson(limitation).value as JSONValue)}
      )
      on conflict do nothing
      returning 1 as inserted
    `,
    signal,
  );
}

async function insertContradiction(
  transaction: PersistenceTransaction,
  interview: RepositoryInterviewV1,
  contradiction: RepositoryInterviewContradictionV1,
  ordinal: number,
  signal: AbortSignal | undefined,
): Promise<number> {
  return insertSemanticRow(
    transaction`
      insert into gitblocks.repository_interview_contradictions (
        contradiction_id,
        interview_id,
        candidate_id,
        ordinal,
        topic,
        contradiction_kind,
        identity_digest,
        record_digest,
        canonical_payload
      )
      values (
        ${contradiction.contradictionId},
        ${interview.interviewId},
        ${interview.candidateId},
        ${ordinal},
        ${contradiction.topic},
        ${contradiction.kind},
        ${contradiction.identityDigest},
        ${contradiction.recordDigest},
        ${transaction.json(canonicalizeJson(contradiction).value as JSONValue)}
      )
      on conflict do nothing
      returning 1 as inserted
    `,
    signal,
  );
}

async function insertUnknown(
  transaction: PersistenceTransaction,
  interview: RepositoryInterviewV1,
  unknown: RepositoryInterviewUnknownV1,
  ordinal: number,
  signal: AbortSignal | undefined,
): Promise<number> {
  return insertSemanticRow(
    transaction`
      insert into gitblocks.repository_interview_unknowns (
        unknown_id,
        interview_id,
        candidate_id,
        ordinal,
        topic,
        reason,
        identity_digest,
        record_digest,
        canonical_payload
      )
      values (
        ${unknown.unknownId},
        ${interview.interviewId},
        ${interview.candidateId},
        ${ordinal},
        ${unknown.topic},
        ${unknown.reason},
        ${unknown.identityDigest},
        ${unknown.recordDigest},
        ${transaction.json(canonicalizeJson(unknown).value as JSONValue)}
      )
      on conflict do nothing
      returning 1 as inserted
    `,
    signal,
  );
}

async function insertSemanticRow(
  pending: Parameters<typeof executePending<readonly InsertedRow[]>>[0],
  signal: AbortSignal | undefined,
): Promise<number> {
  const rows = await executePending<readonly InsertedRow[]>(pending, signal);
  return rows.length === 1 ? 1 : 0;
}

async function loadExchangeByExecution(
  transaction: PersistenceTransaction,
  executionId: string,
  signal: AbortSignal | undefined,
): Promise<RepositoryInterviewStoredExchange> {
  const loadedExecution = await loadExecution(transaction, executionId, signal);
  const execution = loadedExecution.value;
  const request = await loadRequest(transaction, execution.requestId, signal);
  if (!storedExecutionRowMatches(loadedExecution.row, execution, request)) {
    throw persistenceError('persistence.corrupt-record');
  }
  const interviewRows = await executePending<readonly InterviewRow[]>(
    transaction`
      select *
      from gitblocks.repository_interviews
      where execution_id = ${executionId}
    `,
    signal,
  );
  if (interviewRows.length > 1) {
    throw persistenceError('persistence.corrupt-record');
  }
  const interviewRow = interviewRows[0];
  if (execution.outcome.status === 'failed') {
    if (interviewRow !== undefined) {
      throw persistenceError('persistence.corrupt-record');
    }
    return { request, execution, interview: null };
  }
  if (interviewRow === undefined) {
    throw persistenceError('persistence.corrupt-record');
  }
  const interview = await loadInterview(transaction, interviewRow, signal);
  const closure = validateRepositoryInterviewExecutionV1(
    request,
    execution,
    interview,
  );
  if (!closure.ok) {
    throw persistenceError('persistence.corrupt-record');
  }
  return {
    request: closure.request,
    execution: closure.execution,
    interview: closure.interview,
  };
}

async function loadRequest(
  transaction: PersistenceTransaction,
  requestId: string,
  signal: AbortSignal | undefined,
): Promise<RepositoryInterviewRequestV1> {
  const rows = await executePending<readonly RequestRow[]>(
    transaction`
      select *
      from gitblocks.repository_interview_requests
      where request_id = ${requestId}
    `,
    signal,
  );
  const row = rows[0];
  if (rows.length !== 1 || row === undefined) {
    throw persistenceError('persistence.not-found');
  }
  const parsed = parseRepositoryInterviewRequestV1(row.canonical_payload);
  if (!parsed.ok || !requestRowMatches(row, parsed.value)) {
    throw persistenceError('persistence.corrupt-record');
  }
  return parsed.value;
}

async function loadExecution(
  transaction: PersistenceTransaction,
  executionId: string,
  signal: AbortSignal | undefined,
): Promise<LoadedExecutionAuthority> {
  const rows = await executePending<readonly StoredExecutionRow[]>(
    transaction`
      select *
      from gitblocks.model_executions
      where execution_id = ${executionId}
    `,
    signal,
  );
  const row = rows[0];
  if (rows.length !== 1 || row === undefined) {
    throw persistenceError('persistence.not-found');
  }
  const parsed = parseModelExecutionV1(row.canonical_payload);
  if (!parsed.ok) {
    throw persistenceError('persistence.corrupt-record');
  }
  return { row, value: parsed.value };
}

async function loadInterview(
  transaction: PersistenceTransaction,
  row: InterviewRow,
  signal: AbortSignal | undefined,
): Promise<RepositoryInterviewV1> {
  const root = parseRepositoryInterviewV1(row.canonical_payload);
  if (!root.ok || !interviewRowMatches(row, root.value)) {
    throw persistenceError('persistence.corrupt-record');
  }
  const [
    citationRows,
    claimRows,
    limitationRows,
    contradictionRows,
    unknownRows,
  ] = await Promise.all([
    loadCitationRows(transaction, row.interview_id, signal),
    loadClaimRows(transaction, row.interview_id, signal),
    loadLimitationRows(transaction, row.interview_id, signal),
    loadContradictionRows(transaction, row.interview_id, signal),
    loadUnknownRows(transaction, row.interview_id, signal),
  ]);
  const reconstructed = {
    ...root.value,
    citations: nestedPayloads(citationRows, row.citation_count),
    claims: nestedPayloads(claimRows, row.claim_count),
    limitations: nestedPayloads(limitationRows, row.limitation_count),
    contradictions: nestedPayloads(contradictionRows, row.contradiction_count),
    unknowns: nestedPayloads(unknownRows, row.unknown_count),
  };
  const parsed = parseRepositoryInterviewV1(reconstructed);
  if (
    !parsed.ok ||
    !sameRecord(parsed.value, root.value) ||
    !storedCitationRowsMatch(citationRows, root.value) ||
    !storedClaimRowsMatch(claimRows, root.value) ||
    !storedLimitationRowsMatch(limitationRows, root.value) ||
    !storedContradictionRowsMatch(contradictionRows, root.value) ||
    !storedUnknownRowsMatch(unknownRows, root.value)
  ) {
    throw persistenceError('persistence.corrupt-record');
  }
  return parsed.value;
}

async function loadCitationRows(
  transaction: PersistenceTransaction,
  interviewId: string,
  signal: AbortSignal | undefined,
): Promise<readonly StoredCitationRow[]> {
  return executePending<readonly StoredCitationRow[]>(
    transaction`
      select
        citation_id,
        interview_id,
        candidate_id,
        artifact_set_id,
        ordinal,
        artifact_id,
        start_line,
        end_line,
        identity_digest,
        record_digest,
        canonical_payload
      from gitblocks.repository_interview_citations
      where interview_id = ${interviewId}
      order by ordinal
    `,
    signal,
  );
}

async function loadClaimRows(
  transaction: PersistenceTransaction,
  interviewId: string,
  signal: AbortSignal | undefined,
): Promise<readonly StoredClaimRow[]> {
  return executePending<readonly StoredClaimRow[]>(
    transaction`
      select
        claim_id,
        interview_id,
        candidate_id,
        ordinal,
        claim_kind,
        topic,
        confidence,
        identity_digest,
        record_digest,
        canonical_payload
      from gitblocks.repository_interview_claims
      where interview_id = ${interviewId}
      order by ordinal
    `,
    signal,
  );
}

async function loadLimitationRows(
  transaction: PersistenceTransaction,
  interviewId: string,
  signal: AbortSignal | undefined,
): Promise<readonly StoredLimitationRow[]> {
  return executePending<readonly StoredLimitationRow[]>(
    transaction`
      select
        limitation_id,
        interview_id,
        candidate_id,
        ordinal,
        basis,
        topic,
        confidence,
        identity_digest,
        record_digest,
        canonical_payload
      from gitblocks.repository_interview_limitations
      where interview_id = ${interviewId}
      order by ordinal
    `,
    signal,
  );
}

async function loadContradictionRows(
  transaction: PersistenceTransaction,
  interviewId: string,
  signal: AbortSignal | undefined,
): Promise<readonly StoredContradictionRow[]> {
  return executePending<readonly StoredContradictionRow[]>(
    transaction`
      select
        contradiction_id,
        interview_id,
        candidate_id,
        ordinal,
        topic,
        contradiction_kind,
        identity_digest,
        record_digest,
        canonical_payload
      from gitblocks.repository_interview_contradictions
      where interview_id = ${interviewId}
      order by ordinal
    `,
    signal,
  );
}

async function loadUnknownRows(
  transaction: PersistenceTransaction,
  interviewId: string,
  signal: AbortSignal | undefined,
): Promise<readonly StoredUnknownRow[]> {
  return executePending<readonly StoredUnknownRow[]>(
    transaction`
      select
        unknown_id,
        interview_id,
        candidate_id,
        ordinal,
        topic,
        reason,
        identity_digest,
        record_digest,
        canonical_payload
      from gitblocks.repository_interview_unknowns
      where interview_id = ${interviewId}
      order by ordinal
    `,
    signal,
  );
}

function requestRowMatches(
  row: RequestRow,
  value: RepositoryInterviewRequestV1,
): boolean {
  return (
    row.request_id === value.requestId &&
    row.candidate_id === value.candidateId &&
    row.artifact_set_id === value.artifactSetId &&
    row.contract_version === value.contractVersion &&
    row.artifact_set_identity_digest === value.artifactSetIdentityDigest &&
    row.specification_version === value.specificationVersion &&
    row.specification_digest === value.specificationDigest &&
    row.renderer_version === value.rendererVersion &&
    row.provider_output_schema_version === value.providerOutputSchemaVersion &&
    row.provider_output_schema_digest === value.providerOutputSchemaDigest &&
    row.prompt_digest === value.promptDigest &&
    row.identity_digest === value.identityDigest &&
    row.record_digest === value.recordDigest
  );
}

function interviewRowMatches(
  row: InterviewRow,
  value: RepositoryInterviewV1,
): boolean {
  return (
    row.interview_id === value.interviewId &&
    row.candidate_id === value.candidateId &&
    row.artifact_set_id === value.artifactSetId &&
    row.request_id === value.requestId &&
    row.execution_id === value.executionId &&
    row.contract_version === value.contractVersion &&
    row.artifact_set_identity_digest === value.artifactSetIdentityDigest &&
    row.request_identity_digest === value.requestIdentityDigest &&
    row.execution_identity_digest === value.executionIdentityDigest &&
    row.provider_output_digest === value.providerOutputDigest &&
    row.specification_version === value.specificationVersion &&
    row.specification_digest === value.specificationDigest &&
    row.renderer_version === value.rendererVersion &&
    row.provider_output_schema_version === value.providerOutputSchemaVersion &&
    row.provider_output_schema_digest === value.providerOutputSchemaDigest &&
    row.provider_projection_version === value.providerProjectionVersion &&
    row.provider_projection_digest === value.providerProjectionDigest &&
    row.prompt_digest === value.promptDigest &&
    row.model_profile_digest === value.modelProfileDigest &&
    row.processing_state === value.processingState &&
    normalizeStoredTimestamp(row.published_at) === value.publishedAt &&
    row.citation_count === value.citations.length &&
    row.claim_count === value.claims.length &&
    row.limitation_count === value.limitations.length &&
    row.contradiction_count === value.contradictions.length &&
    row.unknown_count === value.unknowns.length &&
    row.identity_digest === value.identityDigest &&
    row.record_digest === value.recordDigest
  );
}

function nestedPayloads(
  rows: readonly {
    readonly ordinal: number;
    readonly canonical_payload: unknown;
  }[],
  expectedCount: number,
): readonly unknown[] {
  if (
    rows.length !== expectedCount ||
    rows.some((row, ordinal) => row.ordinal !== ordinal)
  ) {
    throw persistenceError('persistence.corrupt-record');
  }
  return rows.map((row) => row.canonical_payload);
}

function requireSameExchange(
  stored: RepositoryInterviewStoredExchange,
  expected: ValidatedPublication,
): void {
  if (
    !sameRecord(stored.request, expected.request) ||
    !sameRecord(stored.execution, expected.execution) ||
    (stored.interview === null) !== (expected.interview === null) ||
    (stored.interview !== null &&
      expected.interview !== null &&
      !sameRecord(stored.interview, expected.interview))
  ) {
    throw persistenceError('persistence.conflict');
  }
}

function sameRecord(left: unknown, right: unknown): boolean {
  return sameJson(left, right);
}

function sameJson(left: unknown, right: unknown): boolean {
  try {
    return canonicalizeJson(left).json === canonicalizeJson(right).json;
  } catch {
    return false;
  }
}

function emptyInsertedCounts(): {
  requests: number;
  executions: number;
  interviews: number;
  citations: number;
  claims: number;
  limitations: number;
  contradictions: number;
  unknowns: number;
} {
  return {
    requests: 0,
    executions: 0,
    interviews: 0,
    citations: 0,
    claims: 0,
    limitations: 0,
    contradictions: 0,
    unknowns: 0,
  };
}
