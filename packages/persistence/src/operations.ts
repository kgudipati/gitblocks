import type {
  CandidateDossierV1,
  EvidenceObservationV1,
} from '@gitblocks/contracts';
import type { JSONValue } from 'postgres';

import { canonicalizeJson } from './canonical-json.ts';
import {
  executePending,
  withTransaction,
  type PersistenceClient,
  type PersistenceTransaction,
} from './client.ts';
import { persistenceError } from './errors.ts';
import type {
  ActiveDossierMaterial,
  AppendCandidateLimitationCommand,
  AppendCandidateUnknownCommand,
  AppendEvidenceObservationCommand,
  CandidateIdentityV1,
  CandidateLimitationV1,
  CandidateUnknownV1,
  CreateCandidateDossierSnapshotCommand,
  LoadActiveCandidateDossierCommand,
  LoadCandidateDossierSnapshotCommand,
  OperationControl,
  PutCatalogCandidateCommand,
  RecordEvidenceInvalidationCommand,
  RecordEvidenceSupersessionCommand,
  SelectActiveDossierMaterialCommand,
  SetCandidateCapabilityFamiliesCommand,
} from './types.ts';
import {
  normalizeStoredTimestamp,
  normalizeTimestamp,
  validateCapabilityFamilies,
  validateDossier,
  validateIdentity,
  validateReasonCode,
  validateStableId,
  validateStoredDossier,
} from './validation.ts';

const MAX_ACTIVE_OBSERVATIONS = 100;
const MAX_ACTIVE_LIMITATIONS = 40;
const MAX_ACTIVE_UNKNOWNS = 40;
const CANDIDATE_LOCK_SEED = 44392817;

interface DigestRow {
  readonly record_digest: string;
}

interface StoredRecordRow<Value = unknown> {
  readonly canonical_payload: Value;
  readonly record_digest: string;
  readonly created_at: unknown;
}

interface EvidenceTimestampColumns {
  readonly publishedAt: string | null;
  readonly collectedAt: string | null;
  readonly validatedAt: string | null;
  readonly freshnessAsOf: string;
}

export async function putCatalogCandidate(
  client: PersistenceClient,
  command: PutCatalogCandidateCommand,
  control?: OperationControl,
): Promise<void> {
  const identity = validateIdentity(command.identity);
  const createdAt = normalizeTimestamp(command.createdAt);
  const payload = canonicalizeJson(identity);
  const recordDigest = digestRecord({ createdAt, identity });
  await withTransaction(
    client,
    control,
    'read-write',
    async (transaction, signal) => {
      const inserted = await executePending<readonly DigestRow[]>(
        transaction`
          insert into gitblocks.catalog_candidates (
            candidate_id,
            display_name,
            repository_owner,
            repository_name,
            package_name,
            canonical_payload,
            record_digest,
            created_at
          )
          values (
            ${identity.candidateId},
            ${identity.displayName},
            ${identity.repository.owner},
            ${identity.repository.name},
            ${identity.package?.name ?? null},
            ${transaction.json(payload.value as JSONValue)},
            ${recordDigest},
            ${createdAt}::timestamptz
          )
          on conflict do nothing
          returning record_digest
        `,
        signal,
      );
      if (inserted.length === 1) {
        return;
      }
      const existing = await executePending<readonly DigestRow[]>(
        transaction`
          select record_digest
          from gitblocks.catalog_candidates
          where candidate_id = ${identity.candidateId}
        `,
        signal,
      );
      requireSameDigest(existing, recordDigest);
    },
  );
}

export async function setCandidateCapabilityFamilies(
  client: PersistenceClient,
  command: SetCandidateCapabilityFamiliesCommand,
  control?: OperationControl,
): Promise<void> {
  validateStableId(command.candidateId);
  await withTransaction(
    client,
    control,
    'read-write',
    async (transaction, signal) => {
      await serializeCandidate(transaction, command.candidateId, signal);
      const identity = await loadCandidateIdentity(
        transaction,
        command.candidateId,
        signal,
      );
      const families = validateCapabilityFamilies(
        identity,
        command.capabilityFamilies,
      );
      await executePending(
        transaction`
          insert into gitblocks.candidate_capability_families (
            candidate_id,
            capability_family
          )
          select
            ${command.candidateId},
            requested.capability_family
          from unnest(
            ${transaction.array([...families])}::text[]
          ) as requested(capability_family)
          on conflict (candidate_id, capability_family) do nothing
        `,
        signal,
      );
      await executePending(
        transaction`
          delete from gitblocks.candidate_capability_families
          where candidate_id = ${command.candidateId}
            and not (
              capability_family =
                any(${transaction.array([...families])}::text[])
            )
        `,
        signal,
      );
    },
  );
}

export async function appendEvidenceObservation(
  client: PersistenceClient,
  command: AppendEvidenceObservationCommand,
  control?: OperationControl,
): Promise<void> {
  const createdAt = normalizeTimestamp(command.createdAt);
  validateStableId(command.observation.evidenceId);
  validateStableId(command.observation.candidateId);
  await withTransaction(
    client,
    control,
    'read-write',
    async (transaction, signal) => {
      const identity = await loadCandidateIdentity(
        transaction,
        command.observation.candidateId,
        signal,
      );
      const observation = validateSingleObservation(
        identity,
        command.observation,
      );
      const timestamps = evidenceTimestamps(observation);
      const payload = canonicalizeJson(observation);
      const recordDigest = digestRecord({ createdAt, observation });
      const inserted = await executePending<readonly DigestRow[]>(
        transaction`
          insert into gitblocks.evidence_observations (
            evidence_id,
            candidate_id,
            topic,
            dimension,
            provenance_kind,
            published_at,
            collected_at,
            validated_at,
            freshness_as_of,
            canonical_payload,
            record_digest,
            created_at
          )
          values (
            ${observation.evidenceId},
            ${observation.candidateId},
            ${observation.topic},
            ${observation.dimension},
            ${observation.source.kind},
            ${timestamps.publishedAt}::timestamptz,
            ${timestamps.collectedAt}::timestamptz,
            ${timestamps.validatedAt}::timestamptz,
            ${timestamps.freshnessAsOf}::timestamptz,
            ${transaction.json(payload.value as JSONValue)},
            ${recordDigest},
            ${createdAt}::timestamptz
          )
          on conflict do nothing
          returning record_digest
        `,
        signal,
      );
      if (inserted.length === 1) {
        return;
      }
      const existing = await executePending<readonly DigestRow[]>(
        transaction`
          select record_digest
          from gitblocks.evidence_observations
          where evidence_id = ${observation.evidenceId}
        `,
        signal,
      );
      requireSameDigest(existing, recordDigest);
    },
  );
}

export async function appendCandidateLimitation(
  client: PersistenceClient,
  command: AppendCandidateLimitationCommand,
  control?: OperationControl,
): Promise<void> {
  const createdAt = normalizeTimestamp(command.createdAt);
  validateStableId(command.limitation.limitationId);
  validateStableId(command.limitation.candidateId);
  await withTransaction(
    client,
    control,
    'read-write',
    async (transaction, signal) => {
      const identity = await loadCandidateIdentity(
        transaction,
        command.limitation.candidateId,
        signal,
      );
      const observations = await loadEvidenceByIds(
        transaction,
        command.limitation.candidateId,
        command.limitation.evidenceIds,
        signal,
      );
      const limitation = validateSingleLimitation(
        identity,
        observations,
        command.limitation,
      );
      const payload = canonicalizeJson(limitation);
      const recordDigest = digestRecord({ createdAt, limitation });
      const inserted = await executePending<readonly DigestRow[]>(
        transaction`
          insert into gitblocks.candidate_limitations (
            limitation_id,
            candidate_id,
            limitation_code,
            canonical_payload,
            record_digest,
            created_at
          )
          values (
            ${limitation.limitationId},
            ${limitation.candidateId},
            ${limitation.limitationCode},
            ${transaction.json(payload.value as JSONValue)},
            ${recordDigest},
            ${createdAt}::timestamptz
          )
          on conflict do nothing
          returning record_digest
        `,
        signal,
      );
      if (inserted.length === 0) {
        const existing = await executePending<readonly DigestRow[]>(
          transaction`
            select record_digest
            from gitblocks.candidate_limitations
            where limitation_id = ${limitation.limitationId}
          `,
          signal,
        );
        requireSameDigest(existing, recordDigest);
        return;
      }
      for (const [ordinal, evidenceId] of limitation.evidenceIds.entries()) {
        await executePending(
          transaction`
            insert into gitblocks.candidate_limitation_evidence (
              limitation_id,
              candidate_id,
              evidence_id,
              ordinal
            )
            values (
              ${limitation.limitationId},
              ${limitation.candidateId},
              ${evidenceId},
              ${ordinal}
            )
          `,
          signal,
        );
      }
    },
  );
}

export async function appendCandidateUnknown(
  client: PersistenceClient,
  command: AppendCandidateUnknownCommand,
  control?: OperationControl,
): Promise<void> {
  const createdAt = normalizeTimestamp(command.createdAt);
  validateStableId(command.unknown.unknownId);
  validateStableId(command.unknown.candidateId);
  await withTransaction(
    client,
    control,
    'read-write',
    async (transaction, signal) => {
      const identity = await loadCandidateIdentity(
        transaction,
        command.unknown.candidateId,
        signal,
      );
      const observations = await loadEvidenceByIds(
        transaction,
        command.unknown.candidateId,
        command.unknown.evidenceIds,
        signal,
      );
      const unknown = validateSingleUnknown(
        identity,
        observations,
        command.unknown,
      );
      const payload = canonicalizeJson(unknown);
      const recordDigest = digestRecord({ createdAt, unknown });
      const inserted = await executePending<readonly DigestRow[]>(
        transaction`
          insert into gitblocks.candidate_material_unknowns (
            unknown_id,
            candidate_id,
            topic,
            canonical_payload,
            record_digest,
            created_at
          )
          values (
            ${unknown.unknownId},
            ${unknown.candidateId},
            ${unknown.topic},
            ${transaction.json(payload.value as JSONValue)},
            ${recordDigest},
            ${createdAt}::timestamptz
          )
          on conflict do nothing
          returning record_digest
        `,
        signal,
      );
      if (inserted.length === 0) {
        const existing = await executePending<readonly DigestRow[]>(
          transaction`
            select record_digest
            from gitblocks.candidate_material_unknowns
            where unknown_id = ${unknown.unknownId}
          `,
          signal,
        );
        requireSameDigest(existing, recordDigest);
        return;
      }
      for (const [ordinal, evidenceId] of unknown.evidenceIds.entries()) {
        await executePending(
          transaction`
            insert into gitblocks.candidate_unknown_evidence (
              unknown_id,
              candidate_id,
              evidence_id,
              ordinal
            )
            values (
              ${unknown.unknownId},
              ${unknown.candidateId},
              ${evidenceId},
              ${ordinal}
            )
          `,
          signal,
        );
      }
    },
  );
}

export async function recordEvidenceSupersession(
  client: PersistenceClient,
  command: RecordEvidenceSupersessionCommand,
  control?: OperationControl,
): Promise<void> {
  const normalized = validateLifecycleCommand(command);
  validateStableId(command.supersessionId);
  validateStableId(command.supersededEvidenceId);
  validateStableId(command.supersedingEvidenceId);
  if (command.supersededEvidenceId === command.supersedingEvidenceId) {
    throw persistenceError('persistence.invalid-input');
  }
  const record = {
    candidateId: command.candidateId,
    createdAt: normalized.createdAt,
    effectiveAt: normalized.effectiveAt,
    reasonCode: command.reasonCode,
    supersededEvidenceId: command.supersededEvidenceId,
    supersedingEvidenceId: command.supersedingEvidenceId,
    supersessionId: command.supersessionId,
  };
  await withTransaction(
    client,
    control,
    'read-write',
    async (transaction, signal) => {
      await serializeCandidate(transaction, command.candidateId, signal);
      await loadCandidateIdentity(transaction, command.candidateId, signal);
      const recordDigest = digestRecord(record);
      const inserted = await executePending<readonly DigestRow[]>(
        transaction`
          insert into gitblocks.evidence_supersessions (
            supersession_id,
            candidate_id,
            superseded_evidence_id,
            superseding_evidence_id,
            reason_code,
            effective_at,
            record_digest,
            created_at
          )
          values (
            ${command.supersessionId},
            ${command.candidateId},
            ${command.supersededEvidenceId},
            ${command.supersedingEvidenceId},
            ${command.reasonCode},
            ${normalized.effectiveAt}::timestamptz,
            ${recordDigest},
            ${normalized.createdAt}::timestamptz
          )
          on conflict do nothing
          returning record_digest
        `,
        signal,
      );
      if (inserted.length === 1) {
        return;
      }
      const existing = await executePending<readonly DigestRow[]>(
        transaction`
          select record_digest
          from gitblocks.evidence_supersessions
          where supersession_id = ${command.supersessionId}
        `,
        signal,
      );
      requireSameDigest(existing, recordDigest);
    },
  );
}

export async function recordEvidenceInvalidation(
  client: PersistenceClient,
  command: RecordEvidenceInvalidationCommand,
  control?: OperationControl,
): Promise<void> {
  const normalized = validateLifecycleCommand(command);
  validateStableId(command.invalidationId);
  validateStableId(command.evidenceId);
  const record = {
    candidateId: command.candidateId,
    createdAt: normalized.createdAt,
    effectiveAt: normalized.effectiveAt,
    evidenceId: command.evidenceId,
    invalidationId: command.invalidationId,
    reasonCode: command.reasonCode,
  };
  await withTransaction(
    client,
    control,
    'read-write',
    async (transaction, signal) => {
      await serializeCandidate(transaction, command.candidateId, signal);
      await loadCandidateIdentity(transaction, command.candidateId, signal);
      const recordDigest = digestRecord(record);
      const inserted = await executePending<readonly DigestRow[]>(
        transaction`
          insert into gitblocks.evidence_invalidations (
            invalidation_id,
            candidate_id,
            evidence_id,
            reason_code,
            effective_at,
            record_digest,
            created_at
          )
          values (
            ${command.invalidationId},
            ${command.candidateId},
            ${command.evidenceId},
            ${command.reasonCode},
            ${normalized.effectiveAt}::timestamptz,
            ${recordDigest},
            ${normalized.createdAt}::timestamptz
          )
          on conflict do nothing
          returning record_digest
        `,
        signal,
      );
      if (inserted.length === 1) {
        return;
      }
      const existing = await executePending<readonly DigestRow[]>(
        transaction`
          select record_digest
          from gitblocks.evidence_invalidations
          where invalidation_id = ${command.invalidationId}
        `,
        signal,
      );
      requireSameDigest(existing, recordDigest);
    },
  );
}

export async function createCandidateDossierSnapshot(
  client: PersistenceClient,
  command: CreateCandidateDossierSnapshotCommand,
  control?: OperationControl,
): Promise<void> {
  validateStableId(command.snapshotId);
  const dossier = validateDossier(command.dossier);
  const evidenceCutoff = normalizeTimestamp(command.evidenceCutoff);
  const createdAt = normalizeTimestamp(command.createdAt);
  if (Date.parse(evidenceCutoff) > Date.parse(createdAt)) {
    throw persistenceError('persistence.invalid-input');
  }
  validateDossierEvidenceCutoff(dossier, evidenceCutoff);
  const dossierCanonical = canonicalizeJson(dossier);
  const snapshotRecord = snapshotRecordFor(
    command.snapshotId,
    dossier,
    evidenceCutoff,
    createdAt,
    dossierCanonical.digest,
  );
  const recordDigest = digestRecord(snapshotRecord);

  await withTransaction(
    client,
    control,
    'read-write',
    async (transaction, signal) => {
      await serializeCandidate(
        transaction,
        dossier.identity.candidateId,
        signal,
      );
      const identity = await loadCandidateIdentity(
        transaction,
        dossier.identity.candidateId,
        signal,
      );
      if (
        canonicalizeJson(identity).digest !==
        canonicalizeJson(dossier.identity).digest
      ) {
        throw persistenceError('persistence.conflict');
      }
      await assertCapabilityMembership(
        transaction,
        dossier.identity.candidateId,
        dossier.capabilityFamily,
        signal,
      );
      await assertExactSnapshotMaterial(transaction, dossier, signal);

      const inserted = await executePending<readonly DigestRow[]>(
        transaction`
          insert into gitblocks.candidate_dossier_snapshots (
            snapshot_id,
            candidate_id,
            capability_family,
            version_scope,
            contract_version,
            evidence_cutoff,
            canonical_dossier_digest,
            record_digest,
            created_at
          )
          values (
            ${command.snapshotId},
            ${dossier.identity.candidateId},
            ${dossier.capabilityFamily},
            ${dossier.versionScope},
            ${dossier.contractVersion},
            ${evidenceCutoff}::timestamptz,
            ${dossierCanonical.digest},
            ${recordDigest},
            ${createdAt}::timestamptz
          )
          on conflict do nothing
          returning record_digest
        `,
        signal,
      );
      if (inserted.length === 0) {
        const existing = await executePending<readonly DigestRow[]>(
          transaction`
            select record_digest
            from gitblocks.candidate_dossier_snapshots
            where snapshot_id = ${command.snapshotId}
          `,
          signal,
        );
        requireSameDigest(existing, recordDigest);
        return;
      }

      await insertSnapshotMembers(
        transaction,
        command.snapshotId,
        dossier,
        signal,
      );
    },
  );
}

export async function loadCandidateDossierSnapshot(
  client: PersistenceClient,
  command: LoadCandidateDossierSnapshotCommand,
  control?: OperationControl,
): Promise<CandidateDossierV1> {
  validateStableId(command.snapshotId);
  return withTransaction(
    client,
    control,
    'read-only',
    async (transaction, signal) => {
      const rows = await executePending<
        readonly {
          readonly candidate_id: string;
          readonly capability_family: CandidateDossierV1['capabilityFamily'];
          readonly version_scope: string | null;
          readonly contract_version: '1.0.0';
          readonly evidence_cutoff: unknown;
          readonly canonical_dossier_digest: string;
          readonly record_digest: string;
          readonly created_at: unknown;
          readonly identity_payload: unknown;
          readonly identity_record_digest: string;
          readonly identity_created_at: unknown;
        }[]
      >(
        transaction`
          select
            snapshot.candidate_id,
            snapshot.capability_family,
            snapshot.version_scope,
            snapshot.contract_version,
            snapshot.evidence_cutoff,
            snapshot.canonical_dossier_digest,
            snapshot.record_digest,
            snapshot.created_at,
            candidate.canonical_payload as identity_payload,
            candidate.record_digest as identity_record_digest,
            candidate.created_at as identity_created_at
          from gitblocks.candidate_dossier_snapshots as snapshot
          join gitblocks.catalog_candidates as candidate
            on candidate.candidate_id = snapshot.candidate_id
          where snapshot.snapshot_id = ${command.snapshotId}
        `,
        signal,
      );
      const snapshot = rows[0];
      if (snapshot === undefined) {
        throw persistenceError('persistence.not-found');
      }
      const identity = validateStoredIdentityRecord({
        canonical_payload: snapshot.identity_payload,
        record_digest: snapshot.identity_record_digest,
        created_at: snapshot.identity_created_at,
      });
      const observations = await loadSnapshotObservations(
        transaction,
        command.snapshotId,
        signal,
      );
      const limitations = await loadSnapshotLimitations(
        transaction,
        command.snapshotId,
        signal,
      );
      const unknowns = await loadSnapshotUnknowns(
        transaction,
        command.snapshotId,
        signal,
      );
      const dossier = validateStoredDossier({
        contractVersion: snapshot.contract_version,
        identity,
        capabilityFamily: snapshot.capability_family,
        versionScope: snapshot.version_scope,
        observations,
        limitations,
        unknowns,
      });
      if (
        canonicalizeJson(dossier).digest !== snapshot.canonical_dossier_digest
      ) {
        throw persistenceError('persistence.corrupt-record');
      }
      const evidenceCutoff = normalizeStoredTimestamp(snapshot.evidence_cutoff);
      const createdAt = normalizeStoredTimestamp(snapshot.created_at);
      const expectedRecord = snapshotRecordFor(
        command.snapshotId,
        dossier,
        evidenceCutoff,
        createdAt,
        snapshot.canonical_dossier_digest,
      );
      if (digestRecord(expectedRecord) !== snapshot.record_digest) {
        throw persistenceError('persistence.corrupt-record');
      }
      return dossier;
    },
  );
}

export async function selectActiveDossierMaterial(
  client: PersistenceClient,
  command: SelectActiveDossierMaterialCommand,
  control?: OperationControl,
): Promise<ActiveDossierMaterial> {
  validateStableId(command.candidateId);
  const evidenceCutoff = normalizeTimestamp(command.evidenceCutoff);
  return withTransaction(
    client,
    control,
    'read-only',
    async (transaction, signal) => {
      const identity = await loadCandidateIdentity(
        transaction,
        command.candidateId,
        signal,
      );
      const validated = await loadActiveDossierInTransaction(
        transaction,
        command.candidateId,
        identity,
        'authorization',
        evidenceCutoff,
        signal,
      );
      return {
        observations: validated.observations,
        limitations: validated.limitations,
        unknowns: validated.unknowns,
      };
    },
  );
}

export async function loadActiveCandidateDossier(
  client: PersistenceClient,
  command: LoadActiveCandidateDossierCommand,
  control?: OperationControl,
): Promise<CandidateDossierV1> {
  validateStableId(command.candidateId);
  const evidenceCutoff = normalizeTimestamp(command.evidenceCutoff);
  return withTransaction(
    client,
    control,
    'read-only',
    async (transaction, signal) => {
      const identity = await loadCandidateIdentity(
        transaction,
        command.candidateId,
        signal,
      );
      const expectedCapabilityFamily = validateCapabilityFamilies(identity, [
        command.expectedCapabilityFamily,
      ])[0];
      if (expectedCapabilityFamily === undefined) {
        throw persistenceError('persistence.invalid-input');
      }
      await assertCapabilityMembership(
        transaction,
        command.candidateId,
        expectedCapabilityFamily,
        signal,
      );
      return loadActiveDossierInTransaction(
        transaction,
        command.candidateId,
        identity,
        expectedCapabilityFamily,
        evidenceCutoff,
        signal,
      );
    },
  );
}

async function loadActiveDossierInTransaction(
  transaction: PersistenceTransaction,
  candidateId: string,
  identity: CandidateIdentityV1,
  capabilityFamily: CandidateDossierV1['capabilityFamily'],
  evidenceCutoff: string,
  signal: AbortSignal | undefined,
): Promise<CandidateDossierV1> {
  const observationRows = await executePending<
    readonly StoredRecordRow<EvidenceObservationV1>[]
  >(
    transaction`
      select
        observation.canonical_payload,
        observation.record_digest,
        observation.created_at
      from gitblocks.evidence_observations as observation
      where observation.candidate_id = ${candidateId}
        and (
          observation.published_at is null
          or observation.published_at <= ${evidenceCutoff}::timestamptz
        )
        and (
          observation.collected_at is null
          or observation.collected_at <= ${evidenceCutoff}::timestamptz
        )
        and (
          observation.validated_at is null
          or observation.validated_at <= ${evidenceCutoff}::timestamptz
        )
        and observation.freshness_as_of <= ${evidenceCutoff}::timestamptz
        and not exists (
          select 1
          from gitblocks.evidence_supersessions as supersession
          where supersession.candidate_id = observation.candidate_id
            and supersession.superseded_evidence_id = observation.evidence_id
            and supersession.effective_at <= ${evidenceCutoff}::timestamptz
        )
        and not exists (
          select 1
          from gitblocks.evidence_invalidations as invalidation
          where invalidation.candidate_id = observation.candidate_id
            and invalidation.evidence_id = observation.evidence_id
            and invalidation.effective_at <= ${evidenceCutoff}::timestamptz
        )
      order by observation.evidence_id
      limit ${MAX_ACTIVE_OBSERVATIONS + 1}
    `,
    signal,
  );
  requireResultBound(observationRows, MAX_ACTIVE_OBSERVATIONS);
  const observations = observationRows.map(validateStoredEvidenceRecord);
  const activeEvidenceIds = new Set(
    observations.map((observation) => observation.evidenceId),
  );

  const limitationRows = await executePending<
    readonly StoredRecordRow<CandidateLimitationV1>[]
  >(
    transaction`
      select canonical_payload, record_digest, created_at
      from gitblocks.candidate_limitations
      where candidate_id = ${candidateId}
      order by limitation_id
      limit ${MAX_ACTIVE_LIMITATIONS + 1}
    `,
    signal,
  );
  requireResultBound(limitationRows, MAX_ACTIVE_LIMITATIONS);
  const limitations = limitationRows
    .map(validateStoredLimitationRecord)
    .filter((limitation) =>
      limitation.evidenceIds.every((evidenceId) =>
        activeEvidenceIds.has(evidenceId),
      ),
    );

  const unknownRows = await executePending<
    readonly StoredRecordRow<CandidateUnknownV1>[]
  >(
    transaction`
      select canonical_payload, record_digest, created_at
      from gitblocks.candidate_material_unknowns
      where candidate_id = ${candidateId}
      order by unknown_id
      limit ${MAX_ACTIVE_UNKNOWNS + 1}
    `,
    signal,
  );
  requireResultBound(unknownRows, MAX_ACTIVE_UNKNOWNS);
  const unknowns = unknownRows
    .map(validateStoredUnknownRecord)
    .filter((unknown) =>
      unknown.evidenceIds.every((evidenceId) =>
        activeEvidenceIds.has(evidenceId),
      ),
    );

  return validateStoredDossier({
    contractVersion: '1.0.0',
    identity,
    capabilityFamily,
    versionScope: null,
    observations,
    limitations,
    unknowns,
  });
}

function validateSingleObservation(
  identity: CandidateIdentityV1,
  observation: EvidenceObservationV1,
): EvidenceObservationV1 {
  const validated = validateDossier({
    contractVersion: '1.0.0',
    identity,
    capabilityFamily: 'authorization',
    versionScope: null,
    observations: [observation],
    limitations: [],
    unknowns: [],
  }).observations[0];
  if (validated === undefined) {
    throw persistenceError('persistence.invalid-input');
  }
  return validated;
}

function validateSingleLimitation(
  identity: CandidateIdentityV1,
  observations: readonly EvidenceObservationV1[],
  limitation: CandidateLimitationV1,
): CandidateLimitationV1 {
  const validated = validateDossier({
    contractVersion: '1.0.0',
    identity,
    capabilityFamily: 'authorization',
    versionScope: null,
    observations,
    limitations: [limitation],
    unknowns: [],
  }).limitations[0];
  if (validated === undefined) {
    throw persistenceError('persistence.invalid-input');
  }
  return validated;
}

function validateSingleUnknown(
  identity: CandidateIdentityV1,
  observations: readonly EvidenceObservationV1[],
  unknown: CandidateUnknownV1,
): CandidateUnknownV1 {
  const validated = validateDossier({
    contractVersion: '1.0.0',
    identity,
    capabilityFamily: 'authorization',
    versionScope: null,
    observations,
    limitations: [],
    unknowns: [unknown],
  }).unknowns[0];
  if (validated === undefined) {
    throw persistenceError('persistence.invalid-input');
  }
  return validated;
}

function evidenceTimestamps(
  observation: EvidenceObservationV1,
): EvidenceTimestampColumns {
  const freshnessAsOf = normalizeTimestamp(observation.freshness.asOf);
  switch (observation.source.kind) {
    case 'approved-validation':
      return {
        publishedAt: null,
        collectedAt: null,
        validatedAt: normalizeTimestamp(observation.source.validatedAt),
        freshnessAsOf,
      };
    case 'mutable-documentation':
      return {
        publishedAt: null,
        collectedAt: normalizeTimestamp(observation.source.collectedAt),
        validatedAt: null,
        freshnessAsOf,
      };
    case 'git-commit':
    case 'tag':
    case 'release':
    case 'package-version':
    case 'security-advisory':
      return {
        publishedAt: normalizeTimestamp(observation.source.publishedAt),
        collectedAt: normalizeTimestamp(observation.source.collectedAt),
        validatedAt: null,
        freshnessAsOf,
      };
  }
}

function validateLifecycleCommand(
  command:
    RecordEvidenceSupersessionCommand | RecordEvidenceInvalidationCommand,
): {
  readonly createdAt: string;
  readonly effectiveAt: string;
} {
  validateStableId(command.candidateId);
  validateReasonCode(command.reasonCode);
  const createdAt = normalizeTimestamp(command.createdAt);
  const effectiveAt = normalizeTimestamp(command.effectiveAt);
  if (Date.parse(effectiveAt) < Date.parse(createdAt)) {
    throw persistenceError('persistence.invalid-input');
  }
  return { createdAt, effectiveAt };
}

function validateDossierEvidenceCutoff(
  dossier: CandidateDossierV1,
  evidenceCutoff: string,
): void {
  const cutoff = Date.parse(evidenceCutoff);
  for (const observation of dossier.observations) {
    const timestamps = evidenceTimestamps(observation);
    if (
      Date.parse(timestamps.freshnessAsOf) > cutoff ||
      (timestamps.publishedAt !== null &&
        Date.parse(timestamps.publishedAt) > cutoff) ||
      (timestamps.collectedAt !== null &&
        Date.parse(timestamps.collectedAt) > cutoff) ||
      (timestamps.validatedAt !== null &&
        Date.parse(timestamps.validatedAt) > cutoff)
    ) {
      throw persistenceError('persistence.invalid-input');
    }
  }
}

async function serializeCandidate(
  transaction: PersistenceTransaction,
  candidateId: string,
  signal: AbortSignal | undefined,
): Promise<void> {
  await executePending(
    transaction`
      select pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(
          ${candidateId},
          ${CANDIDATE_LOCK_SEED}
        )
      )
    `,
    signal,
  );
}

async function loadCandidateIdentity(
  transaction: PersistenceTransaction,
  candidateId: string,
  signal: AbortSignal | undefined,
): Promise<CandidateIdentityV1> {
  const rows = await executePending<
    readonly StoredRecordRow<CandidateIdentityV1>[]
  >(
    transaction`
      select canonical_payload, record_digest, created_at
      from gitblocks.catalog_candidates
      where candidate_id = ${candidateId}
    `,
    signal,
  );
  const row = rows[0];
  if (row === undefined) {
    throw persistenceError('persistence.not-found');
  }
  return validateStoredIdentityRecord(row);
}

function validateStoredIdentityRecord(
  row: StoredRecordRow,
): CandidateIdentityV1 {
  const identity = validateIdentity(row.canonical_payload);
  const createdAt = normalizeStoredTimestamp(row.created_at);
  if (digestRecord({ createdAt, identity }) !== row.record_digest) {
    throw persistenceError('persistence.corrupt-record');
  }
  return identity;
}

function validateStoredEvidenceRecord(
  row: StoredRecordRow<EvidenceObservationV1>,
): EvidenceObservationV1 {
  const observation = row.canonical_payload;
  const createdAt = normalizeStoredTimestamp(row.created_at);
  if (digestRecord({ createdAt, observation }) !== row.record_digest) {
    throw persistenceError('persistence.corrupt-record');
  }
  return observation;
}

function validateStoredLimitationRecord(
  row: StoredRecordRow<CandidateLimitationV1>,
): CandidateLimitationV1 {
  const limitation = row.canonical_payload;
  const createdAt = normalizeStoredTimestamp(row.created_at);
  if (digestRecord({ createdAt, limitation }) !== row.record_digest) {
    throw persistenceError('persistence.corrupt-record');
  }
  return limitation;
}

function validateStoredUnknownRecord(
  row: StoredRecordRow<CandidateUnknownV1>,
): CandidateUnknownV1 {
  const unknown = row.canonical_payload;
  const createdAt = normalizeStoredTimestamp(row.created_at);
  if (digestRecord({ createdAt, unknown }) !== row.record_digest) {
    throw persistenceError('persistence.corrupt-record');
  }
  return unknown;
}

async function assertCapabilityMembership(
  transaction: PersistenceTransaction,
  candidateId: string,
  family: CandidateDossierV1['capabilityFamily'],
  signal: AbortSignal | undefined,
): Promise<void> {
  const rows = await executePending<readonly { readonly present: number }[]>(
    transaction`
      select 1 as present
      from gitblocks.candidate_capability_families
      where candidate_id = ${candidateId}
        and capability_family = ${family}
    `,
    signal,
  );
  if (rows.length !== 1) {
    throw persistenceError('persistence.conflict');
  }
}

async function assertExactSnapshotMaterial(
  transaction: PersistenceTransaction,
  dossier: CandidateDossierV1,
  signal: AbortSignal | undefined,
): Promise<void> {
  const observations = await loadEvidenceByIds(
    transaction,
    dossier.identity.candidateId,
    dossier.observations.map((observation) => observation.evidenceId),
    signal,
  );
  assertPayloadListsMatch(dossier.observations, observations);
  const limitations = await loadLimitationByIds(
    transaction,
    dossier.identity.candidateId,
    dossier.limitations.map((limitation) => limitation.limitationId),
    signal,
  );
  assertPayloadListsMatch(dossier.limitations, limitations);
  const unknowns = await loadUnknownByIds(
    transaction,
    dossier.identity.candidateId,
    dossier.unknowns.map((unknown) => unknown.unknownId),
    signal,
  );
  assertPayloadListsMatch(dossier.unknowns, unknowns);
}

async function loadEvidenceByIds(
  transaction: PersistenceTransaction,
  candidateId: string,
  evidenceIds: readonly string[],
  signal: AbortSignal | undefined,
): Promise<readonly EvidenceObservationV1[]> {
  validateUniqueIds(evidenceIds);
  if (evidenceIds.length === 0) {
    return [];
  }
  const rows = await executePending<
    readonly (StoredRecordRow<EvidenceObservationV1> & {
      readonly evidence_id: string;
    })[]
  >(
    transaction`
      select evidence_id, canonical_payload, record_digest, created_at
      from gitblocks.evidence_observations
      where candidate_id = ${candidateId}
        and evidence_id =
          any(${transaction.array([...evidenceIds])}::text[])
      order by evidence_id
    `,
    signal,
  );
  if (rows.length !== evidenceIds.length) {
    throw persistenceError('persistence.conflict');
  }
  const byId = new Map(
    rows.map((row) => [row.evidence_id, validateStoredEvidenceRecord(row)]),
  );
  return mapIds(evidenceIds, byId);
}

async function loadLimitationByIds(
  transaction: PersistenceTransaction,
  candidateId: string,
  limitationIds: readonly string[],
  signal: AbortSignal | undefined,
): Promise<readonly CandidateLimitationV1[]> {
  validateUniqueIds(limitationIds);
  if (limitationIds.length === 0) {
    return [];
  }
  const rows = await executePending<
    readonly (StoredRecordRow<CandidateLimitationV1> & {
      readonly limitation_id: string;
    })[]
  >(
    transaction`
      select limitation_id, canonical_payload, record_digest, created_at
      from gitblocks.candidate_limitations
      where candidate_id = ${candidateId}
        and limitation_id =
          any(${transaction.array([...limitationIds])}::text[])
      order by limitation_id
    `,
    signal,
  );
  if (rows.length !== limitationIds.length) {
    throw persistenceError('persistence.conflict');
  }
  const byId = new Map(
    rows.map((row) => [row.limitation_id, validateStoredLimitationRecord(row)]),
  );
  return mapIds(limitationIds, byId);
}

async function loadUnknownByIds(
  transaction: PersistenceTransaction,
  candidateId: string,
  unknownIds: readonly string[],
  signal: AbortSignal | undefined,
): Promise<readonly CandidateUnknownV1[]> {
  validateUniqueIds(unknownIds);
  if (unknownIds.length === 0) {
    return [];
  }
  const rows = await executePending<
    readonly (StoredRecordRow<CandidateUnknownV1> & {
      readonly unknown_id: string;
    })[]
  >(
    transaction`
      select unknown_id, canonical_payload, record_digest, created_at
      from gitblocks.candidate_material_unknowns
      where candidate_id = ${candidateId}
        and unknown_id =
          any(${transaction.array([...unknownIds])}::text[])
      order by unknown_id
    `,
    signal,
  );
  if (rows.length !== unknownIds.length) {
    throw persistenceError('persistence.conflict');
  }
  const byId = new Map(
    rows.map((row) => [row.unknown_id, validateStoredUnknownRecord(row)]),
  );
  return mapIds(unknownIds, byId);
}

async function insertSnapshotMembers(
  transaction: PersistenceTransaction,
  snapshotId: string,
  dossier: CandidateDossierV1,
  signal: AbortSignal | undefined,
): Promise<void> {
  for (const [ordinal, observation] of dossier.observations.entries()) {
    await executePending(
      transaction`
        insert into gitblocks.snapshot_evidence_members (
          snapshot_id,
          candidate_id,
          evidence_id,
          ordinal
        )
        values (
          ${snapshotId},
          ${dossier.identity.candidateId},
          ${observation.evidenceId},
          ${ordinal}
        )
      `,
      signal,
    );
  }
  for (const [ordinal, limitation] of dossier.limitations.entries()) {
    await executePending(
      transaction`
        insert into gitblocks.snapshot_limitation_members (
          snapshot_id,
          candidate_id,
          limitation_id,
          ordinal
        )
        values (
          ${snapshotId},
          ${dossier.identity.candidateId},
          ${limitation.limitationId},
          ${ordinal}
        )
      `,
      signal,
    );
  }
  for (const [ordinal, unknown] of dossier.unknowns.entries()) {
    await executePending(
      transaction`
        insert into gitblocks.snapshot_unknown_members (
          snapshot_id,
          candidate_id,
          unknown_id,
          ordinal
        )
        values (
          ${snapshotId},
          ${dossier.identity.candidateId},
          ${unknown.unknownId},
          ${ordinal}
        )
      `,
      signal,
    );
  }
}

async function loadSnapshotObservations(
  transaction: PersistenceTransaction,
  snapshotId: string,
  signal: AbortSignal | undefined,
): Promise<readonly EvidenceObservationV1[]> {
  const rows = await executePending<
    readonly StoredRecordRow<EvidenceObservationV1>[]
  >(
    transaction`
      select
        observation.canonical_payload,
        observation.record_digest,
        observation.created_at
      from gitblocks.snapshot_evidence_members as member
      join gitblocks.evidence_observations as observation
        on observation.candidate_id = member.candidate_id
        and observation.evidence_id = member.evidence_id
      where member.snapshot_id = ${snapshotId}
      order by member.ordinal
    `,
    signal,
  );
  return rows.map(validateStoredEvidenceRecord);
}

async function loadSnapshotLimitations(
  transaction: PersistenceTransaction,
  snapshotId: string,
  signal: AbortSignal | undefined,
): Promise<readonly CandidateLimitationV1[]> {
  const rows = await executePending<
    readonly StoredRecordRow<CandidateLimitationV1>[]
  >(
    transaction`
      select
        limitation.canonical_payload,
        limitation.record_digest,
        limitation.created_at
      from gitblocks.snapshot_limitation_members as member
      join gitblocks.candidate_limitations as limitation
        on limitation.candidate_id = member.candidate_id
        and limitation.limitation_id = member.limitation_id
      where member.snapshot_id = ${snapshotId}
      order by member.ordinal
    `,
    signal,
  );
  return rows.map(validateStoredLimitationRecord);
}

async function loadSnapshotUnknowns(
  transaction: PersistenceTransaction,
  snapshotId: string,
  signal: AbortSignal | undefined,
): Promise<readonly CandidateUnknownV1[]> {
  const rows = await executePending<
    readonly StoredRecordRow<CandidateUnknownV1>[]
  >(
    transaction`
      select
        unknown_value.canonical_payload,
        unknown_value.record_digest,
        unknown_value.created_at
      from gitblocks.snapshot_unknown_members as member
      join gitblocks.candidate_material_unknowns as unknown_value
        on unknown_value.candidate_id = member.candidate_id
        and unknown_value.unknown_id = member.unknown_id
      where member.snapshot_id = ${snapshotId}
      order by member.ordinal
    `,
    signal,
  );
  return rows.map(validateStoredUnknownRecord);
}

function snapshotRecordFor(
  snapshotId: string,
  dossier: CandidateDossierV1,
  evidenceCutoff: string,
  createdAt: string,
  dossierDigest: string,
): Readonly<Record<string, unknown>> {
  return {
    candidateId: dossier.identity.candidateId,
    capabilityFamily: dossier.capabilityFamily,
    contractVersion: dossier.contractVersion,
    createdAt,
    dossierDigest,
    evidenceCutoff,
    evidenceIds: dossier.observations.map(
      (observation) => observation.evidenceId,
    ),
    limitationIds: dossier.limitations.map(
      (limitation) => limitation.limitationId,
    ),
    snapshotId,
    unknownIds: dossier.unknowns.map((unknown) => unknown.unknownId),
    versionScope: dossier.versionScope,
  };
}

function digestRecord(value: unknown): string {
  return canonicalizeJson(value).digest;
}

function validateUniqueIds(values: readonly string[]): void {
  for (const value of values) {
    validateStableId(value);
  }
  if (new Set(values).size !== values.length) {
    throw persistenceError('persistence.invalid-input');
  }
}

function mapIds<Value>(
  ids: readonly string[],
  values: ReadonlyMap<string, Value>,
): readonly Value[] {
  return ids.map((id) => {
    const value = values.get(id);
    if (value === undefined) {
      throw persistenceError('persistence.conflict');
    }
    return value;
  });
}

function assertPayloadListsMatch(
  expected: readonly unknown[],
  actual: readonly unknown[],
): void {
  if (expected.length !== actual.length) {
    throw persistenceError('persistence.conflict');
  }
  for (let index = 0; index < expected.length; index += 1) {
    if (
      canonicalizeJson(expected[index]).digest !==
      canonicalizeJson(actual[index]).digest
    ) {
      throw persistenceError('persistence.conflict');
    }
  }
}

function requireSameDigest(
  rows: readonly DigestRow[],
  expectedDigest: string,
): void {
  const row = rows[0];
  if (rows.length !== 1 || row?.record_digest !== expectedDigest) {
    throw persistenceError('persistence.conflict');
  }
}

function requireResultBound(rows: readonly unknown[], maximum: number): void {
  if (rows.length > maximum) {
    throw persistenceError('persistence.result-limit');
  }
}
