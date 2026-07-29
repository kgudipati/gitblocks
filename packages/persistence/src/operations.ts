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
  CreateTenantCommand,
  DeleteTenantDataCommand,
  LoadCandidateDossierSnapshotCommand,
  OperationControl,
  PurgeExpiredTenantDataCommand,
  PurgeExpiredTenantDataResult,
  PutCatalogCandidateCommand,
  RecordEvidenceInvalidationCommand,
  RecordEvidenceSupersessionCommand,
  SelectActiveDossierMaterialCommand,
  SetCandidateCapabilityFamiliesCommand,
  StorageScope,
} from './types.ts';
import {
  validateCapabilityFamilies,
  validateChronology,
  validateDossier,
  validateIdentity,
  validateIntegerBound,
  validateReasonCode,
  validateScope,
  validateStableId,
  validateStoredDossier,
  validateTimestamp,
  validateUuid,
} from './validation.ts';

interface DigestRow {
  readonly canonical_digest: string;
}

interface CandidateRow {
  readonly canonical_payload: unknown;
  readonly canonical_digest: string;
}

interface PayloadRow<Value = unknown> {
  readonly canonical_payload: Value;
  readonly canonical_digest: string;
}

export async function createTenant(
  client: PersistenceClient,
  command: CreateTenantCommand,
  control?: OperationControl,
): Promise<void> {
  validateUuid(command.tenantId);
  validateTimestamp(command.createdAt);
  const scope: StorageScope = {
    kind: 'tenant',
    tenantId: command.tenantId,
    expiresAt: new Date(Date.parse(command.createdAt) + 1).toISOString(),
  };
  await withTransaction(
    client,
    scope,
    control,
    'read-write',
    async (transaction, signal) => {
      await executePending(
        transaction`
          insert into gitblocks.tenants (tenant_id, created_at)
          values (${command.tenantId}::uuid, ${command.createdAt}::timestamptz)
          on conflict (tenant_id) do nothing
        `,
        signal,
      );
    },
  );
}

export async function putCatalogCandidate(
  client: PersistenceClient,
  command: PutCatalogCandidateCommand,
  control?: OperationControl,
): Promise<void> {
  const identity = validateIdentity(command.identity);
  const scope = validateScopeWithCreation(command.scope, command.createdAt);
  const canonical = canonicalizeJson(identity);
  await withTransaction(
    client,
    command.scope,
    control,
    'read-write',
    async (transaction, signal) => {
      const inserted = await executePending<readonly DigestRow[]>(
        transaction`
          insert into gitblocks.catalog_candidates (
            scope,
            tenant_id,
            candidate_id,
            display_name,
            repository_owner,
            repository_name,
            package_name,
            canonical_payload,
            canonical_digest,
            created_at,
            expires_at
          )
          values (
            ${scope.scope},
            ${scope.tenantId}::uuid,
            ${identity.candidateId},
            ${identity.displayName},
            ${identity.repository.owner},
            ${identity.repository.name},
            ${identity.package?.name ?? null},
            ${transaction.json(canonical.value as JSONValue)},
            ${canonical.digest},
            ${command.createdAt}::timestamptz,
            ${scope.expiresAt}::timestamptz
          )
          on conflict do nothing
          returning canonical_digest
        `,
        signal,
      );
      if (inserted.length === 1) {
        return;
      }
      const existing = await executePending<readonly DigestRow[]>(
        transaction`
          select canonical_digest
          from gitblocks.catalog_candidates
          where scope_key = ${scope.scopeKey}
            and candidate_id = ${identity.candidateId}
        `,
        signal,
      );
      requireSameDigest(existing, canonical.digest);
    },
  );
}

export async function setCandidateCapabilityFamilies(
  client: PersistenceClient,
  command: SetCandidateCapabilityFamiliesCommand,
  control?: OperationControl,
): Promise<void> {
  validateStableId(command.candidateId);
  const scope = validateScope(command.scope);
  await withTransaction(
    client,
    command.scope,
    control,
    'read-write',
    async (transaction, signal) => {
      const identity = await loadCandidateIdentity(
        transaction,
        scope.scopeKey,
        command.candidateId,
        signal,
        'update',
      );
      const families = validateCapabilityFamilies(
        identity,
        command.capabilityFamilies,
      );
      await executePending(
        transaction`
          delete from gitblocks.candidate_capability_families
          where scope_key = ${scope.scopeKey}
            and candidate_id = ${command.candidateId}
        `,
        signal,
      );
      for (const family of families) {
        await executePending(
          transaction`
            insert into gitblocks.candidate_capability_families (
              scope,
              tenant_id,
              candidate_id,
              capability_family,
              expires_at
            )
            values (
              ${scope.scope},
              ${scope.tenantId}::uuid,
              ${command.candidateId},
              ${family},
              ${scope.expiresAt}::timestamptz
            )
          `,
          signal,
        );
      }
    },
  );
}

export async function appendEvidenceObservation(
  client: PersistenceClient,
  command: AppendEvidenceObservationCommand,
  control?: OperationControl,
): Promise<void> {
  const scope = validateScopeWithCreation(command.scope, command.createdAt);
  const observation = command.observation;
  validateStableId(observation.evidenceId);
  validateStableId(observation.candidateId);
  await withTransaction(
    client,
    command.scope,
    control,
    'read-write',
    async (transaction, signal) => {
      const identity = await loadCandidateIdentity(
        transaction,
        scope.scopeKey,
        observation.candidateId,
        signal,
        'share',
      );
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
      const canonical = canonicalizeJson(validated);
      const inserted = await executePending<readonly DigestRow[]>(
        transaction`
          insert into gitblocks.evidence_observations (
            scope,
            tenant_id,
            candidate_id,
            evidence_id,
            topic,
            dimension,
            provenance_kind,
            freshness_as_of,
            canonical_payload,
            canonical_digest,
            created_at,
            expires_at
          )
          values (
            ${scope.scope},
            ${scope.tenantId}::uuid,
            ${validated.candidateId},
            ${validated.evidenceId},
            ${validated.topic},
            ${validated.dimension},
            ${validated.source.kind},
            ${validated.freshness.asOf}::timestamptz,
            ${transaction.json(canonical.value as JSONValue)},
            ${canonical.digest},
            ${command.createdAt}::timestamptz,
            ${scope.expiresAt}::timestamptz
          )
          on conflict do nothing
          returning canonical_digest
        `,
        signal,
      );
      if (inserted.length === 1) {
        return;
      }
      const existing = await executePending<readonly DigestRow[]>(
        transaction`
          select canonical_digest
          from gitblocks.evidence_observations
          where scope_key = ${scope.scopeKey}
            and evidence_id = ${validated.evidenceId}
        `,
        signal,
      );
      requireSameDigest(existing, canonical.digest);
    },
  );
}

export async function appendCandidateLimitation(
  client: PersistenceClient,
  command: AppendCandidateLimitationCommand,
  control?: OperationControl,
): Promise<void> {
  const scope = validateScopeWithCreation(command.scope, command.createdAt);
  validateStableId(command.limitation.limitationId);
  validateStableId(command.limitation.candidateId);
  await withTransaction(
    client,
    command.scope,
    control,
    'read-write',
    async (transaction, signal) => {
      const identity = await loadCandidateIdentity(
        transaction,
        scope.scopeKey,
        command.limitation.candidateId,
        signal,
        'share',
      );
      const observations = await loadEvidenceByIds(
        transaction,
        scope.scopeKey,
        command.limitation.candidateId,
        command.limitation.evidenceIds,
        signal,
      );
      const limitation = validateDossier({
        contractVersion: '1.0.0',
        identity,
        capabilityFamily: 'authorization',
        versionScope: null,
        observations,
        limitations: [command.limitation],
        unknowns: [],
      }).limitations[0];
      if (limitation === undefined) {
        throw persistenceError('persistence.invalid-input');
      }
      const canonical = canonicalizeJson(limitation);
      const inserted = await executePending<readonly DigestRow[]>(
        transaction`
          insert into gitblocks.candidate_limitations (
            scope,
            tenant_id,
            candidate_id,
            limitation_id,
            limitation_code,
            canonical_payload,
            canonical_digest,
            created_at,
            expires_at
          )
          values (
            ${scope.scope},
            ${scope.tenantId}::uuid,
            ${limitation.candidateId},
            ${limitation.limitationId},
            ${limitation.limitationCode},
            ${transaction.json(canonical.value as JSONValue)},
            ${canonical.digest},
            ${command.createdAt}::timestamptz,
            ${scope.expiresAt}::timestamptz
          )
          on conflict do nothing
          returning canonical_digest
        `,
        signal,
      );
      if (inserted.length === 0) {
        const existing = await executePending<readonly DigestRow[]>(
          transaction`
            select canonical_digest
            from gitblocks.candidate_limitations
            where scope_key = ${scope.scopeKey}
              and limitation_id = ${limitation.limitationId}
          `,
          signal,
        );
        requireSameDigest(existing, canonical.digest);
        return;
      }
      for (const evidenceId of limitation.evidenceIds) {
        await executePending(
          transaction`
            insert into gitblocks.candidate_limitation_evidence (
              scope,
              tenant_id,
              candidate_id,
              limitation_id,
              evidence_id,
              expires_at
            )
            values (
              ${scope.scope},
              ${scope.tenantId}::uuid,
              ${limitation.candidateId},
              ${limitation.limitationId},
              ${evidenceId},
              ${scope.expiresAt}::timestamptz
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
  const scope = validateScopeWithCreation(command.scope, command.createdAt);
  validateStableId(command.unknown.unknownId);
  validateStableId(command.unknown.candidateId);
  await withTransaction(
    client,
    command.scope,
    control,
    'read-write',
    async (transaction, signal) => {
      const identity = await loadCandidateIdentity(
        transaction,
        scope.scopeKey,
        command.unknown.candidateId,
        signal,
        'share',
      );
      const observations = await loadEvidenceByIds(
        transaction,
        scope.scopeKey,
        command.unknown.candidateId,
        command.unknown.evidenceIds,
        signal,
      );
      const unknown = validateDossier({
        contractVersion: '1.0.0',
        identity,
        capabilityFamily: 'authorization',
        versionScope: null,
        observations,
        limitations: [],
        unknowns: [command.unknown],
      }).unknowns[0];
      if (unknown === undefined) {
        throw persistenceError('persistence.invalid-input');
      }
      const canonical = canonicalizeJson(unknown);
      const inserted = await executePending<readonly DigestRow[]>(
        transaction`
          insert into gitblocks.candidate_material_unknowns (
            scope,
            tenant_id,
            candidate_id,
            unknown_id,
            topic,
            canonical_payload,
            canonical_digest,
            created_at,
            expires_at
          )
          values (
            ${scope.scope},
            ${scope.tenantId}::uuid,
            ${unknown.candidateId},
            ${unknown.unknownId},
            ${unknown.topic},
            ${transaction.json(canonical.value as JSONValue)},
            ${canonical.digest},
            ${command.createdAt}::timestamptz,
            ${scope.expiresAt}::timestamptz
          )
          on conflict do nothing
          returning canonical_digest
        `,
        signal,
      );
      if (inserted.length === 0) {
        const existing = await executePending<readonly DigestRow[]>(
          transaction`
            select canonical_digest
            from gitblocks.candidate_material_unknowns
            where scope_key = ${scope.scopeKey}
              and unknown_id = ${unknown.unknownId}
          `,
          signal,
        );
        requireSameDigest(existing, canonical.digest);
        return;
      }
      for (const evidenceId of unknown.evidenceIds) {
        await executePending(
          transaction`
            insert into gitblocks.candidate_unknown_evidence (
              scope,
              tenant_id,
              candidate_id,
              unknown_id,
              evidence_id,
              expires_at
            )
            values (
              ${scope.scope},
              ${scope.tenantId}::uuid,
              ${unknown.candidateId},
              ${unknown.unknownId},
              ${evidenceId},
              ${scope.expiresAt}::timestamptz
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
  const scope = validateLifecycleCommand(command);
  validateStableId(command.supersessionId);
  validateStableId(command.supersededEvidenceId);
  validateStableId(command.supersedingEvidenceId);
  if (command.supersededEvidenceId === command.supersedingEvidenceId) {
    throw persistenceError('persistence.invalid-input');
  }
  const canonical = canonicalizeJson({
    candidateId: command.candidateId,
    createdAt: command.createdAt,
    effectiveAt: command.effectiveAt,
    reasonCode: command.reasonCode,
    supersededEvidenceId: command.supersededEvidenceId,
    supersedingEvidenceId: command.supersedingEvidenceId,
    supersessionId: command.supersessionId,
  });
  await withTransaction(
    client,
    command.scope,
    control,
    'read-write',
    async (transaction, signal) => {
      await lockCandidate(
        transaction,
        scope.scopeKey,
        command.candidateId,
        signal,
      );
      const inserted = await executePending<readonly DigestRow[]>(
        transaction`
          insert into gitblocks.evidence_supersessions (
            scope,
            tenant_id,
            candidate_id,
            supersession_id,
            superseded_evidence_id,
            superseding_evidence_id,
            reason_code,
            effective_at,
            canonical_digest,
            created_at,
            expires_at
          )
          values (
            ${scope.scope},
            ${scope.tenantId}::uuid,
            ${command.candidateId},
            ${command.supersessionId},
            ${command.supersededEvidenceId},
            ${command.supersedingEvidenceId},
            ${command.reasonCode},
            ${command.effectiveAt}::timestamptz,
            ${canonical.digest},
            ${command.createdAt}::timestamptz,
            ${scope.expiresAt}::timestamptz
          )
          on conflict do nothing
          returning canonical_digest
        `,
        signal,
      );
      if (inserted.length === 1) {
        return;
      }
      const existing = await executePending<readonly DigestRow[]>(
        transaction`
          select canonical_digest
          from gitblocks.evidence_supersessions
          where scope_key = ${scope.scopeKey}
            and supersession_id = ${command.supersessionId}
        `,
        signal,
      );
      requireSameDigest(existing, canonical.digest);
    },
  );
}

export async function recordEvidenceInvalidation(
  client: PersistenceClient,
  command: RecordEvidenceInvalidationCommand,
  control?: OperationControl,
): Promise<void> {
  const scope = validateLifecycleCommand(command);
  validateStableId(command.invalidationId);
  validateStableId(command.evidenceId);
  const canonical = canonicalizeJson({
    candidateId: command.candidateId,
    createdAt: command.createdAt,
    effectiveAt: command.effectiveAt,
    evidenceId: command.evidenceId,
    invalidationId: command.invalidationId,
    reasonCode: command.reasonCode,
  });
  await withTransaction(
    client,
    command.scope,
    control,
    'read-write',
    async (transaction, signal) => {
      await lockCandidate(
        transaction,
        scope.scopeKey,
        command.candidateId,
        signal,
      );
      const inserted = await executePending<readonly DigestRow[]>(
        transaction`
          insert into gitblocks.evidence_invalidations (
            scope,
            tenant_id,
            candidate_id,
            invalidation_id,
            evidence_id,
            reason_code,
            effective_at,
            canonical_digest,
            created_at,
            expires_at
          )
          values (
            ${scope.scope},
            ${scope.tenantId}::uuid,
            ${command.candidateId},
            ${command.invalidationId},
            ${command.evidenceId},
            ${command.reasonCode},
            ${command.effectiveAt}::timestamptz,
            ${canonical.digest},
            ${command.createdAt}::timestamptz,
            ${scope.expiresAt}::timestamptz
          )
          on conflict do nothing
          returning canonical_digest
        `,
        signal,
      );
      if (inserted.length === 1) {
        return;
      }
      const existing = await executePending<readonly DigestRow[]>(
        transaction`
          select canonical_digest
          from gitblocks.evidence_invalidations
          where scope_key = ${scope.scopeKey}
            and invalidation_id = ${command.invalidationId}
        `,
        signal,
      );
      requireSameDigest(existing, canonical.digest);
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
  validateTimestamp(command.evidenceCutoff);
  validateTimestamp(command.createdAt);
  if (Date.parse(command.evidenceCutoff) > Date.parse(command.createdAt)) {
    throw persistenceError('persistence.invalid-input');
  }
  validateDossierEvidenceCutoff(dossier, command.evidenceCutoff);
  const scope = validateScopeWithCreation(command.scope, command.createdAt);
  const canonical = canonicalizeJson(dossier);
  const identityCanonical = canonicalizeJson(dossier.identity);
  await withTransaction(
    client,
    command.scope,
    control,
    'read-write',
    async (transaction, signal) => {
      const identity = await loadCandidateIdentity(
        transaction,
        scope.scopeKey,
        dossier.identity.candidateId,
        signal,
        'update',
      );
      if (canonicalizeJson(identity).digest !== identityCanonical.digest) {
        throw persistenceError('persistence.conflict');
      }
      await assertCapabilityMembership(
        transaction,
        scope.scopeKey,
        dossier.identity.candidateId,
        dossier.capabilityFamily,
        signal,
      );
      await assertExactSnapshotMaterial(
        transaction,
        scope.scopeKey,
        dossier,
        signal,
      );

      const inserted = await executePending<readonly DigestRow[]>(
        transaction`
          insert into gitblocks.candidate_dossier_snapshots (
            scope,
            tenant_id,
            snapshot_id,
            candidate_id,
            capability_family,
            version_scope,
            contract_version,
            evidence_cutoff,
            identity_payload,
            canonical_dossier_digest,
            created_at,
            expires_at
          )
          values (
            ${scope.scope},
            ${scope.tenantId}::uuid,
            ${command.snapshotId},
            ${dossier.identity.candidateId},
            ${dossier.capabilityFamily},
            ${dossier.versionScope},
            ${dossier.contractVersion},
            ${command.evidenceCutoff}::timestamptz,
            ${transaction.json(identityCanonical.value as JSONValue)},
            ${canonical.digest},
            ${command.createdAt}::timestamptz,
            ${scope.expiresAt}::timestamptz
          )
          on conflict do nothing
          returning canonical_dossier_digest as canonical_digest
        `,
        signal,
      );
      if (inserted.length === 0) {
        const existing = await executePending<readonly DigestRow[]>(
          transaction`
            select canonical_dossier_digest as canonical_digest
            from gitblocks.candidate_dossier_snapshots
            where scope_key = ${scope.scopeKey}
              and snapshot_id = ${command.snapshotId}
          `,
          signal,
        );
        requireSameDigest(existing, canonical.digest);
        return;
      }

      for (const [ordinal, observation] of dossier.observations.entries()) {
        await executePending(
          transaction`
            insert into gitblocks.snapshot_evidence_members (
              scope,
              tenant_id,
              snapshot_id,
              candidate_id,
              evidence_id,
              ordinal,
              expires_at
            )
            values (
              ${scope.scope},
              ${scope.tenantId}::uuid,
              ${command.snapshotId},
              ${dossier.identity.candidateId},
              ${observation.evidenceId},
              ${ordinal},
              ${scope.expiresAt}::timestamptz
            )
          `,
          signal,
        );
      }
      for (const [ordinal, limitation] of dossier.limitations.entries()) {
        await executePending(
          transaction`
            insert into gitblocks.snapshot_limitation_members (
              scope,
              tenant_id,
              snapshot_id,
              candidate_id,
              limitation_id,
              ordinal,
              expires_at
            )
            values (
              ${scope.scope},
              ${scope.tenantId}::uuid,
              ${command.snapshotId},
              ${dossier.identity.candidateId},
              ${limitation.limitationId},
              ${ordinal},
              ${scope.expiresAt}::timestamptz
            )
          `,
          signal,
        );
      }
      for (const [ordinal, unknown] of dossier.unknowns.entries()) {
        await executePending(
          transaction`
            insert into gitblocks.snapshot_unknown_members (
              scope,
              tenant_id,
              snapshot_id,
              candidate_id,
              unknown_id,
              ordinal,
              expires_at
            )
            values (
              ${scope.scope},
              ${scope.tenantId}::uuid,
              ${command.snapshotId},
              ${dossier.identity.candidateId},
              ${unknown.unknownId},
              ${ordinal},
              ${scope.expiresAt}::timestamptz
            )
          `,
          signal,
        );
      }
    },
  );
}

export async function loadCandidateDossierSnapshot(
  client: PersistenceClient,
  command: LoadCandidateDossierSnapshotCommand,
  control?: OperationControl,
): Promise<CandidateDossierV1> {
  validateStableId(command.snapshotId);
  const scope = validateScope(command.scope);
  return withTransaction(
    client,
    command.scope,
    control,
    'read-only',
    async (transaction, signal) => {
      const rows = await executePending<
        readonly {
          readonly identity_payload: unknown;
          readonly capability_family: CandidateDossierV1['capabilityFamily'];
          readonly version_scope: string | null;
          readonly contract_version: '1.0.0';
          readonly canonical_dossier_digest: string;
        }[]
      >(
        transaction`
          select
            identity_payload,
            capability_family,
            version_scope,
            contract_version,
            canonical_dossier_digest
          from gitblocks.candidate_dossier_snapshots
          where scope_key = ${scope.scopeKey}
            and snapshot_id = ${command.snapshotId}
        `,
        signal,
      );
      const snapshot = rows[0];
      if (snapshot === undefined) {
        throw persistenceError('persistence.not-found');
      }
      const observations = await loadSnapshotObservations(
        transaction,
        scope.scopeKey,
        command.snapshotId,
        signal,
      );
      const limitations = await loadSnapshotLimitations(
        transaction,
        scope.scopeKey,
        command.snapshotId,
        signal,
      );
      const unknowns = await loadSnapshotUnknowns(
        transaction,
        scope.scopeKey,
        command.snapshotId,
        signal,
      );
      const dossier = validateStoredDossier({
        contractVersion: snapshot.contract_version,
        identity: snapshot.identity_payload,
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
  validateTimestamp(command.evidenceCutoff);
  validateIntegerBound(command.limit, 1, 100);
  if (command.afterEvidenceId !== undefined) {
    validateStableId(command.afterEvidenceId);
  }
  const scope = validateScope(command.scope);
  return withTransaction(
    client,
    command.scope,
    control,
    'read-only',
    async (transaction, signal) => {
      await loadCandidateIdentity(
        transaction,
        scope.scopeKey,
        command.candidateId,
        signal,
        'none',
      );
      const observations = await executePending<
        readonly {
          readonly canonical_payload: EvidenceObservationV1;
          readonly canonical_digest: string;
        }[]
      >(
        transaction`
          select observation.canonical_payload, observation.canonical_digest
          from gitblocks.evidence_observations as observation
          where observation.scope_key = ${scope.scopeKey}
            and observation.candidate_id = ${command.candidateId}
            and observation.created_at <=
              ${command.evidenceCutoff}::timestamptz
            and observation.evidence_id >
              ${command.afterEvidenceId ?? ''}
            and not exists (
              select 1
              from gitblocks.evidence_supersessions as supersession
              where supersession.scope_key = observation.scope_key
                and supersession.candidate_id = observation.candidate_id
                and supersession.superseded_evidence_id =
                  observation.evidence_id
                and supersession.effective_at <=
                  ${command.evidenceCutoff}::timestamptz
            )
            and not exists (
              select 1
              from gitblocks.evidence_invalidations as invalidation
              where invalidation.scope_key = observation.scope_key
                and invalidation.candidate_id = observation.candidate_id
                and invalidation.evidence_id = observation.evidence_id
                and invalidation.effective_at <=
                  ${command.evidenceCutoff}::timestamptz
            )
          order by observation.evidence_id
          limit ${command.limit}
        `,
        signal,
      );
      const limitations = await executePending<
        readonly {
          readonly canonical_payload: CandidateLimitationV1;
          readonly canonical_digest: string;
        }[]
      >(
        transaction`
          select canonical_payload, canonical_digest
          from gitblocks.candidate_limitations
          where scope_key = ${scope.scopeKey}
            and candidate_id = ${command.candidateId}
            and created_at <= ${command.evidenceCutoff}::timestamptz
          order by limitation_id
          limit 40
        `,
        signal,
      );
      const unknowns = await executePending<
        readonly {
          readonly canonical_payload: CandidateUnknownV1;
          readonly canonical_digest: string;
        }[]
      >(
        transaction`
          select canonical_payload, canonical_digest
          from gitblocks.candidate_material_unknowns
          where scope_key = ${scope.scopeKey}
            and candidate_id = ${command.candidateId}
            and created_at <= ${command.evidenceCutoff}::timestamptz
          order by unknown_id
          limit 40
        `,
        signal,
      );
      return {
        observations: observations.map((row) => validatePayloadDigest(row)),
        limitations: limitations.map((row) => validatePayloadDigest(row)),
        unknowns: unknowns.map((row) => validatePayloadDigest(row)),
      };
    },
  );
}

export async function purgeExpiredTenantData(
  client: PersistenceClient,
  command: PurgeExpiredTenantDataCommand,
  control?: OperationControl,
): Promise<PurgeExpiredTenantDataResult> {
  validateUuid(command.tenantId);
  validateTimestamp(command.expiresBeforeOrAt);
  validateIntegerBound(command.batchSize, 1, 500);
  const scope: StorageScope = {
    kind: 'tenant',
    tenantId: command.tenantId,
    expiresAt: new Date(
      Date.parse(command.expiresBeforeOrAt) + 1,
    ).toISOString(),
  };
  return withTransaction(
    client,
    scope,
    control,
    'read-write',
    async (transaction, signal) => {
      const rows = await executePending<
        readonly {
          readonly deleted_snapshots: number;
          readonly deleted_candidates: number;
        }[]
      >(
        transaction`
          select deleted_snapshots, deleted_candidates
          from gitblocks.purge_expired_tenant_data(
            ${command.tenantId}::uuid,
            ${command.expiresBeforeOrAt}::timestamptz,
            ${command.batchSize}::integer
          )
        `,
        signal,
      );
      const result = rows[0];
      if (
        result === undefined ||
        typeof result.deleted_snapshots !== 'number' ||
        typeof result.deleted_candidates !== 'number'
      ) {
        throw persistenceError('persistence.corrupt-record');
      }
      return {
        deletedSnapshots: result.deleted_snapshots,
        deletedCandidates: result.deleted_candidates,
      };
    },
  );
}

export async function deleteTenantData(
  client: PersistenceClient,
  command: DeleteTenantDataCommand,
  control?: OperationControl,
): Promise<void> {
  validateUuid(command.tenantId);
  validateTimestamp(command.deletedAt);
  validateReasonCode(command.reasonCode);
  const scope: StorageScope = {
    kind: 'tenant',
    tenantId: command.tenantId,
    expiresAt: new Date(Date.parse(command.deletedAt) + 1).toISOString(),
  };
  await withTransaction(
    client,
    scope,
    control,
    'read-write',
    async (transaction, signal) => {
      await executePending(
        transaction`
          select gitblocks.delete_tenant_data(
            ${command.tenantId}::uuid,
            ${command.deletedAt}::timestamptz,
            ${command.reasonCode}
          )
        `,
        signal,
      );
    },
  );
}

function validateScopeWithCreation(
  rawScope: StorageScope,
  createdAt: string,
): ReturnType<typeof validateScope> {
  validateTimestamp(createdAt);
  const scope = validateScope(rawScope);
  if (scope.expiresAt !== null) {
    validateChronology(createdAt, scope.expiresAt);
  }
  return scope;
}

function validateDossierEvidenceCutoff(
  dossier: CandidateDossierV1,
  evidenceCutoff: string,
): void {
  const cutoff = Date.parse(evidenceCutoff);
  for (const observation of dossier.observations) {
    const sourceTimestamp =
      observation.source.kind === 'approved-validation'
        ? observation.source.validatedAt
        : observation.source.collectedAt;
    if (
      Date.parse(observation.freshness.asOf) > cutoff ||
      Date.parse(sourceTimestamp) > cutoff ||
      ('publishedAt' in observation.source &&
        Date.parse(observation.source.publishedAt) > cutoff)
    ) {
      throw persistenceError('persistence.invalid-input');
    }
  }
}

function validateLifecycleCommand(
  command:
    RecordEvidenceSupersessionCommand | RecordEvidenceInvalidationCommand,
): ReturnType<typeof validateScope> {
  validateStableId(command.candidateId);
  validateReasonCode(command.reasonCode);
  validateTimestamp(command.createdAt);
  validateTimestamp(command.effectiveAt);
  if (Date.parse(command.effectiveAt) < Date.parse(command.createdAt)) {
    throw persistenceError('persistence.invalid-input');
  }
  return validateScopeWithCreation(command.scope, command.createdAt);
}

async function loadCandidateIdentity(
  transaction: PersistenceTransaction,
  scopeKey: string,
  candidateId: string,
  signal: AbortSignal | undefined,
  lock: 'none' | 'share' | 'update',
): Promise<CandidateIdentityV1> {
  const rows =
    lock === 'update'
      ? await executePending<readonly CandidateRow[]>(
          transaction`
            select canonical_payload, canonical_digest
            from gitblocks.catalog_candidates
            where scope_key = ${scopeKey}
              and candidate_id = ${candidateId}
            for update
          `,
          signal,
        )
      : lock === 'share'
        ? await executePending<readonly CandidateRow[]>(
            transaction`
              select canonical_payload, canonical_digest
              from gitblocks.catalog_candidates
              where scope_key = ${scopeKey}
                and candidate_id = ${candidateId}
              for share
            `,
            signal,
          )
        : await executePending<readonly CandidateRow[]>(
            transaction`
              select canonical_payload, canonical_digest
              from gitblocks.catalog_candidates
              where scope_key = ${scopeKey}
                and candidate_id = ${candidateId}
            `,
            signal,
          );
  const row = rows[0];
  if (row === undefined) {
    throw persistenceError('persistence.not-found');
  }
  const identity = validateIdentity(
    row.canonical_payload as CandidateIdentityV1,
  );
  if (canonicalizeJson(identity).digest !== row.canonical_digest) {
    throw persistenceError('persistence.corrupt-record');
  }
  return identity;
}

async function lockCandidate(
  transaction: PersistenceTransaction,
  scopeKey: string,
  candidateId: string,
  signal: AbortSignal | undefined,
): Promise<void> {
  await loadCandidateIdentity(
    transaction,
    scopeKey,
    candidateId,
    signal,
    'update',
  );
}

async function assertCapabilityMembership(
  transaction: PersistenceTransaction,
  scopeKey: string,
  candidateId: string,
  family: CandidateDossierV1['capabilityFamily'],
  signal: AbortSignal | undefined,
): Promise<void> {
  const rows = await executePending<readonly { readonly present: number }[]>(
    transaction`
      select 1 as present
      from gitblocks.candidate_capability_families
      where scope_key = ${scopeKey}
        and candidate_id = ${candidateId}
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
  scopeKey: string,
  dossier: CandidateDossierV1,
  signal: AbortSignal | undefined,
): Promise<void> {
  const observations = await loadEvidenceByIds(
    transaction,
    scopeKey,
    dossier.identity.candidateId,
    dossier.observations.map((observation) => observation.evidenceId),
    signal,
  );
  assertPayloadListsMatch(dossier.observations, observations);

  const limitations = await loadLimitationByIds(
    transaction,
    scopeKey,
    dossier.identity.candidateId,
    dossier.limitations.map((limitation) => limitation.limitationId),
    signal,
  );
  assertPayloadListsMatch(dossier.limitations, limitations);

  const unknowns = await loadUnknownByIds(
    transaction,
    scopeKey,
    dossier.identity.candidateId,
    dossier.unknowns.map((unknown) => unknown.unknownId),
    signal,
  );
  assertPayloadListsMatch(dossier.unknowns, unknowns);
}

async function loadEvidenceByIds(
  transaction: PersistenceTransaction,
  scopeKey: string,
  candidateId: string,
  evidenceIds: readonly string[],
  signal: AbortSignal | undefined,
): Promise<readonly EvidenceObservationV1[]> {
  if (evidenceIds.length === 0) {
    return [];
  }
  for (const evidenceId of evidenceIds) {
    validateStableId(evidenceId);
  }
  if (new Set(evidenceIds).size !== evidenceIds.length) {
    throw persistenceError('persistence.invalid-input');
  }
  const rows = await executePending<
    readonly PayloadRow<EvidenceObservationV1>[]
  >(
    transaction`
      select canonical_payload, canonical_digest
      from gitblocks.evidence_observations
      where scope_key = ${scopeKey}
        and candidate_id = ${candidateId}
        and evidence_id =
          any(${transaction.array([...evidenceIds])}::text[])
      order by evidence_id
    `,
    signal,
  );
  if (rows.length !== evidenceIds.length) {
    throw persistenceError('persistence.conflict');
  }
  const byId = new Map<string, EvidenceObservationV1>();
  for (const row of rows) {
    const value = validatePayloadDigest(row);
    byId.set(value.evidenceId, value);
  }
  return evidenceIds.map((evidenceId) => {
    const value = byId.get(evidenceId);
    if (value === undefined) {
      throw persistenceError('persistence.conflict');
    }
    return value;
  });
}

async function loadLimitationByIds(
  transaction: PersistenceTransaction,
  scopeKey: string,
  candidateId: string,
  limitationIds: readonly string[],
  signal: AbortSignal | undefined,
): Promise<readonly CandidateLimitationV1[]> {
  if (limitationIds.length === 0) {
    return [];
  }
  for (const limitationId of limitationIds) {
    validateStableId(limitationId);
  }
  if (new Set(limitationIds).size !== limitationIds.length) {
    throw persistenceError('persistence.invalid-input');
  }
  const rows = await executePending<
    readonly PayloadRow<CandidateLimitationV1>[]
  >(
    transaction`
      select canonical_payload, canonical_digest
      from gitblocks.candidate_limitations
      where scope_key = ${scopeKey}
        and candidate_id = ${candidateId}
        and limitation_id =
          any(${transaction.array([...limitationIds])}::text[])
      order by limitation_id
    `,
    signal,
  );
  if (rows.length !== limitationIds.length) {
    throw persistenceError('persistence.conflict');
  }
  const byId = new Map<string, CandidateLimitationV1>();
  for (const row of rows) {
    const value = validatePayloadDigest(row);
    byId.set(value.limitationId, value);
  }
  return limitationIds.map((limitationId) => {
    const value = byId.get(limitationId);
    if (value === undefined) {
      throw persistenceError('persistence.conflict');
    }
    return value;
  });
}

async function loadUnknownByIds(
  transaction: PersistenceTransaction,
  scopeKey: string,
  candidateId: string,
  unknownIds: readonly string[],
  signal: AbortSignal | undefined,
): Promise<readonly CandidateUnknownV1[]> {
  if (unknownIds.length === 0) {
    return [];
  }
  for (const unknownId of unknownIds) {
    validateStableId(unknownId);
  }
  if (new Set(unknownIds).size !== unknownIds.length) {
    throw persistenceError('persistence.invalid-input');
  }
  const rows = await executePending<readonly PayloadRow<CandidateUnknownV1>[]>(
    transaction`
      select canonical_payload, canonical_digest
      from gitblocks.candidate_material_unknowns
      where scope_key = ${scopeKey}
        and candidate_id = ${candidateId}
        and unknown_id =
          any(${transaction.array([...unknownIds])}::text[])
      order by unknown_id
    `,
    signal,
  );
  if (rows.length !== unknownIds.length) {
    throw persistenceError('persistence.conflict');
  }
  const byId = new Map<string, CandidateUnknownV1>();
  for (const row of rows) {
    const value = validatePayloadDigest(row);
    byId.set(value.unknownId, value);
  }
  return unknownIds.map((unknownId) => {
    const value = byId.get(unknownId);
    if (value === undefined) {
      throw persistenceError('persistence.conflict');
    }
    return value;
  });
}

async function loadSnapshotObservations(
  transaction: PersistenceTransaction,
  scopeKey: string,
  snapshotId: string,
  signal: AbortSignal | undefined,
): Promise<readonly EvidenceObservationV1[]> {
  const rows = await executePending<
    readonly PayloadRow<EvidenceObservationV1>[]
  >(
    transaction`
      select observation.canonical_payload, observation.canonical_digest
      from gitblocks.snapshot_evidence_members as member
      join gitblocks.evidence_observations as observation
        on observation.scope_key = member.scope_key
        and observation.candidate_id = member.candidate_id
        and observation.evidence_id = member.evidence_id
      where member.scope_key = ${scopeKey}
        and member.snapshot_id = ${snapshotId}
      order by member.ordinal
    `,
    signal,
  );
  return rows.map((row) => validatePayloadDigest(row));
}

async function loadSnapshotLimitations(
  transaction: PersistenceTransaction,
  scopeKey: string,
  snapshotId: string,
  signal: AbortSignal | undefined,
): Promise<readonly CandidateLimitationV1[]> {
  const rows = await executePending<
    readonly PayloadRow<CandidateLimitationV1>[]
  >(
    transaction`
      select limitation.canonical_payload, limitation.canonical_digest
      from gitblocks.snapshot_limitation_members as member
      join gitblocks.candidate_limitations as limitation
        on limitation.scope_key = member.scope_key
        and limitation.candidate_id = member.candidate_id
        and limitation.limitation_id = member.limitation_id
      where member.scope_key = ${scopeKey}
        and member.snapshot_id = ${snapshotId}
      order by member.ordinal
    `,
    signal,
  );
  return rows.map((row) => validatePayloadDigest(row));
}

async function loadSnapshotUnknowns(
  transaction: PersistenceTransaction,
  scopeKey: string,
  snapshotId: string,
  signal: AbortSignal | undefined,
): Promise<readonly CandidateUnknownV1[]> {
  const rows = await executePending<readonly PayloadRow<CandidateUnknownV1>[]>(
    transaction`
      select unknown_value.canonical_payload, unknown_value.canonical_digest
      from gitblocks.snapshot_unknown_members as member
      join gitblocks.candidate_material_unknowns as unknown_value
        on unknown_value.scope_key = member.scope_key
        and unknown_value.candidate_id = member.candidate_id
        and unknown_value.unknown_id = member.unknown_id
      where member.scope_key = ${scopeKey}
        and member.snapshot_id = ${snapshotId}
      order by member.ordinal
    `,
    signal,
  );
  return rows.map((row) => validatePayloadDigest(row));
}

function validatePayloadDigest<Value>(row: PayloadRow<Value>): Value {
  if (
    typeof row.canonical_digest !== 'string' ||
    canonicalizeJson(row.canonical_payload).digest !== row.canonical_digest
  ) {
    throw persistenceError('persistence.corrupt-record');
  }
  return row.canonical_payload;
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
  if (rows.length !== 1 || row?.canonical_digest !== expectedDigest) {
    throw persistenceError('persistence.conflict');
  }
}
