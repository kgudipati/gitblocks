import type { JSONValue } from 'postgres';

import {
  parseCandidateRetrievalMetadataAuthorityV1,
  parseDeterministicCandidateProfileAuthority,
  projectDeterministicCandidateProfileAuthorityToEvaluatorV2,
  type CandidateRetrievalMetadataAuthorityV1,
  type DeterministicCandidateProfileAuthorityPublished,
  type DeterministicCandidateProfileV1,
  type DeterministicCandidateProfileV2,
} from '@gitblocks/contracts';

import {
  executePending,
  type PersistenceClient,
  type PersistenceTransaction,
  withTransaction,
} from './client.ts';
import { canonicalizeJson } from './canonical-json.ts';
import { persistenceError } from './errors.ts';
import type {
  LoadedServingCatalogSnapshot,
  LoadServingCatalogSnapshotCommand,
  OperationControl,
  PublishServingCatalogSnapshotCommand,
  PublishServingCatalogSnapshotResult,
  ServingCandidateRetrievalMetadataBinding,
} from './types.ts';
import {
  normalizeStoredTimestamp,
  normalizeTimestamp,
  validateStableId,
} from './validation.ts';

const SERVING_CATALOG_SNAPSHOT_FORMAT_VERSION =
  'serving-catalog-snapshot/1.0.0' as const;
const SERVING_CATALOG_CANDIDATE_COUNT = 150;
const SERVING_CATALOG_LOCK_SEED = 97361241;

type ProfileAuthorityHeader =
  DeterministicCandidateProfileAuthorityPublished extends infer Authority
    ? Authority extends DeterministicCandidateProfileAuthorityPublished
      ? Omit<Authority, 'profiles'>
      : never
    : never;
type MetadataAuthorityHeader = Omit<
  CandidateRetrievalMetadataAuthorityV1,
  'candidates'
>;

interface ValidatedPublication {
  readonly snapshotId: string;
  readonly catalogVersion: string;
  readonly catalogDigest: string;
  readonly candidateCount: number;
  readonly profileAuthority: DeterministicCandidateProfileAuthorityPublished;
  readonly profileAuthorityHeader: ProfileAuthorityHeader;
  readonly metadataAuthority: CandidateRetrievalMetadataAuthorityV1;
  readonly metadataAuthorityHeader: MetadataAuthorityHeader;
  readonly publishedAt: string;
  readonly recordDigest: string;
}

interface SnapshotRootRow {
  readonly snapshot_id: string;
  readonly snapshot_format_version: string;
  readonly catalog_version: string;
  readonly catalog_digest: string;
  readonly candidate_count: number;
  readonly profile_authority_header: unknown;
  readonly profile_authority_semantic_digest: string;
  readonly metadata_authority_header: unknown;
  readonly metadata_authority_semantic_digest: string;
  readonly published_at: unknown;
  readonly record_digest: string;
}

interface CandidateProfileRow {
  readonly candidate_id: string;
  readonly profile_payload: unknown;
  readonly record_digest: string;
}

interface CandidateMetadataRow {
  readonly candidate_id: string;
  readonly metadata_payload: unknown;
  readonly record_digest: string;
}

interface CatalogCandidateRow {
  readonly candidate_id: string;
  readonly repository_owner: string;
  readonly repository_name: string;
}

interface InsertedRow {
  readonly inserted: number;
}

export async function publishServingCatalogSnapshot(
  client: PersistenceClient,
  command: PublishServingCatalogSnapshotCommand,
  control?: OperationControl,
): Promise<PublishServingCatalogSnapshotResult> {
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
              ${publication.snapshotId},
              ${SERVING_CATALOG_LOCK_SEED}
            )
          )
        `,
        signal,
      );
      await validatePersistedCatalogCandidates(
        transaction,
        publication,
        signal,
      );
      const rootInserted = await insertSnapshotRoot(
        transaction,
        publication,
        signal,
      );
      let profileRecordsInserted = 0;
      let metadataRecordsInserted = 0;
      for (const profile of publication.profileAuthority.profiles) {
        profileRecordsInserted += await insertProfileRecord(
          transaction,
          publication.snapshotId,
          profile,
          signal,
        );
      }
      for (const metadata of publication.metadataAuthority.candidates) {
        metadataRecordsInserted += await insertMetadataRecord(
          transaction,
          publication.snapshotId,
          metadata,
          signal,
        );
      }
      await executePending(transaction`set constraints all immediate`, signal);
      await selectCurrentSnapshot(transaction, publication, signal);
      const loaded = await loadSnapshotTransaction(
        transaction,
        publication.snapshotId,
        signal,
      );
      if (loaded.snapshotRecordDigest !== publication.recordDigest) {
        throw persistenceError('persistence.conflict');
      }
      return Object.freeze({
        status:
          rootInserted + profileRecordsInserted + metadataRecordsInserted === 0
            ? 'idempotent'
            : 'created',
        snapshotId: publication.snapshotId,
        snapshotRecordDigest: publication.recordDigest,
        publishedAt: publication.publishedAt,
        candidateCount: SERVING_CATALOG_CANDIDATE_COUNT,
      });
    },
  );
}

export async function loadServingCatalogSnapshot(
  client: PersistenceClient,
  command: LoadServingCatalogSnapshotCommand,
  control?: OperationControl,
): Promise<LoadedServingCatalogSnapshot> {
  const validated = validateLoadCommand(command);
  return withTransaction(
    client,
    control,
    'read-only',
    async (transaction, signal) => {
      const snapshotId =
        validated.selection === 'current'
          ? await loadCurrentSnapshotId(transaction, signal)
          : validated.snapshotId;
      return loadSnapshotTransaction(transaction, snapshotId, signal);
    },
  );
}

function validatePublication(
  command: PublishServingCatalogSnapshotCommand,
): ValidatedPublication {
  const profiles = parseDeterministicCandidateProfileAuthority(
    command.candidateProfileAuthority,
  );
  const metadata = parseCandidateRetrievalMetadataAuthorityV1(
    command.candidateRetrievalMetadataAuthority,
  );
  if (!profiles.ok || !metadata.ok) {
    throw persistenceError('persistence.invalid-input');
  }
  const profileAuthority = profiles.value;
  const metadataAuthority = metadata.value;
  if (
    profileAuthority.profiles.length !== SERVING_CATALOG_CANDIDATE_COUNT ||
    metadataAuthority.candidates.length !== SERVING_CATALOG_CANDIDATE_COUNT ||
    profileAuthority.catalogVersion !== metadataAuthority.catalogVersion ||
    profileAuthority.catalogDigest !== metadataAuthority.catalogDigest
  ) {
    throw persistenceError('persistence.invalid-input');
  }
  const metadataByCandidate = new Map(
    metadataAuthority.candidates.map((candidate) => [
      candidate.candidateId,
      candidate,
    ]),
  );
  for (const profile of profileAuthority.profiles) {
    const repository = profileRepositoryIdentity(profile);
    const candidateMetadata = metadataByCandidate.get(profile.candidateId);
    if (
      repository === null ||
      candidateMetadata === undefined ||
      repository.candidateId !== profile.candidateId ||
      repository.githubOwner.toLowerCase() !==
        candidateMetadata.catalogOwner.toLowerCase() ||
      repository.githubRepository.toLowerCase() !==
        candidateMetadata.catalogRepository.toLowerCase()
    ) {
      throw persistenceError('persistence.invalid-input');
    }
  }
  const publishedAt = normalizeTimestamp(command.publishedAt);
  const { profiles: ignoredProfiles, ...profileAuthorityHeader } =
    profileAuthority;
  const { candidates: ignoredCandidates, ...metadataAuthorityHeader } =
    metadataAuthority;
  void ignoredProfiles;
  void ignoredCandidates;
  const snapshotId = servingCatalogSnapshotId(
    profileAuthority,
    metadataAuthority,
  );
  const recordDigest = servingCatalogSnapshotRecordDigest({
    snapshotId,
    catalogVersion: profileAuthority.catalogVersion,
    catalogDigest: profileAuthority.catalogDigest,
    candidateCount: profileAuthority.profiles.length,
    profileAuthorityHeader,
    metadataAuthorityHeader,
    publishedAt,
  });
  return {
    snapshotId,
    catalogVersion: profileAuthority.catalogVersion,
    catalogDigest: profileAuthority.catalogDigest,
    candidateCount: profileAuthority.profiles.length,
    profileAuthority,
    profileAuthorityHeader,
    metadataAuthority,
    metadataAuthorityHeader,
    publishedAt,
    recordDigest,
  };
}

function validateLoadCommand(
  command: LoadServingCatalogSnapshotCommand,
): LoadServingCatalogSnapshotCommand {
  const selection: unknown = command.selection;
  if (selection === 'current') {
    return Object.freeze({ selection: 'current' });
  }
  if (selection === 'snapshot-id') {
    const snapshotId: unknown = Reflect.get(command, 'snapshotId');
    if (typeof snapshotId !== 'string') {
      throw persistenceError('persistence.invalid-input');
    }
    return Object.freeze({
      selection: 'snapshot-id',
      snapshotId: validateStableId(snapshotId),
    });
  }
  throw persistenceError('persistence.invalid-input');
}

async function validatePersistedCatalogCandidates(
  transaction: PersistenceTransaction,
  publication: ValidatedPublication,
  signal: AbortSignal | undefined,
): Promise<void> {
  const candidateIds = publication.profileAuthority.profiles.map(
    ({ candidateId }) => candidateId,
  );
  const rows = await executePending<readonly CatalogCandidateRow[]>(
    transaction`
      select candidate_id, repository_owner, repository_name
      from gitblocks.catalog_candidates
      where candidate_id = any(${transaction.array(candidateIds)}::text[])
      order by candidate_id collate "C"
    `,
    signal,
  );
  const metadataByCandidate = new Map(
    publication.metadataAuthority.candidates.map((candidate) => [
      candidate.candidateId,
      candidate,
    ]),
  );
  if (
    rows.length !== publication.candidateCount ||
    rows.some((row, index) => {
      const profile = publication.profileAuthority.profiles[index];
      const metadata = metadataByCandidate.get(row.candidate_id);
      return (
        profile === undefined ||
        metadata === undefined ||
        row.candidate_id !== profile.candidateId ||
        row.repository_owner.toLowerCase() !==
          metadata.catalogOwner.toLowerCase() ||
        row.repository_name.toLowerCase() !==
          metadata.catalogRepository.toLowerCase()
      );
    })
  ) {
    throw persistenceError('persistence.conflict');
  }
}

async function insertSnapshotRoot(
  transaction: PersistenceTransaction,
  publication: ValidatedPublication,
  signal: AbortSignal | undefined,
): Promise<number> {
  const profileHeader = canonicalizeJson(publication.profileAuthorityHeader);
  const metadataHeader = canonicalizeJson(publication.metadataAuthorityHeader);
  const inserted = await executePending<readonly InsertedRow[]>(
    transaction`
      insert into gitblocks.serving_catalog_snapshots (
        snapshot_id,
        snapshot_format_version,
        catalog_version,
        catalog_digest,
        candidate_count,
        profile_authority_header,
        profile_authority_semantic_digest,
        metadata_authority_header,
        metadata_authority_semantic_digest,
        published_at,
        record_digest
      )
      values (
        ${publication.snapshotId},
        ${SERVING_CATALOG_SNAPSHOT_FORMAT_VERSION},
        ${publication.catalogVersion},
        ${publication.catalogDigest},
        ${publication.candidateCount},
        ${transaction.json(profileHeader.value as JSONValue)},
        ${publication.profileAuthority.semanticAuthorityDigest},
        ${transaction.json(metadataHeader.value as JSONValue)},
        ${publication.metadataAuthority.authoritySemanticDigest},
        ${publication.publishedAt}::timestamptz,
        ${publication.recordDigest}
      )
      on conflict do nothing
      returning 1 as inserted
    `,
    signal,
  );
  if (inserted.length === 1) return 1;
  const existing = await executePending<
    readonly { readonly record_digest: string }[]
  >(
    transaction`
      select record_digest
      from gitblocks.serving_catalog_snapshots
      where snapshot_id = ${publication.snapshotId}
    `,
    signal,
  );
  if (
    existing.length !== 1 ||
    existing[0]?.record_digest !== publication.recordDigest
  ) {
    throw persistenceError('persistence.conflict');
  }
  return 0;
}

async function insertProfileRecord(
  transaction: PersistenceTransaction,
  snapshotId: string,
  profile: DeterministicCandidateProfileV1 | DeterministicCandidateProfileV2,
  signal: AbortSignal | undefined,
): Promise<number> {
  const payload = canonicalizeJson(profile);
  const inserted = await executePending<readonly InsertedRow[]>(
    transaction`
      insert into gitblocks.serving_candidate_profile_records (
        snapshot_id,
        candidate_id,
        profile_payload,
        record_digest
      )
      values (
        ${snapshotId},
        ${profile.candidateId},
        ${transaction.json(payload.value as JSONValue)},
        ${profile.semanticProfileDigest}
      )
      on conflict do nothing
      returning 1 as inserted
    `,
    signal,
  );
  if (inserted.length === 1) return 1;
  await requireStoredDigest(
    transaction,
    'profile',
    snapshotId,
    profile.candidateId,
    profile.semanticProfileDigest,
    signal,
  );
  return 0;
}

async function insertMetadataRecord(
  transaction: PersistenceTransaction,
  snapshotId: string,
  metadata: CandidateRetrievalMetadataAuthorityV1['candidates'][number],
  signal: AbortSignal | undefined,
): Promise<number> {
  const payload = canonicalizeJson(metadata);
  const inserted = await executePending<readonly InsertedRow[]>(
    transaction`
      insert into gitblocks.serving_candidate_retrieval_metadata_records (
        snapshot_id,
        candidate_id,
        metadata_payload,
        record_digest
      )
      values (
        ${snapshotId},
        ${metadata.candidateId},
        ${transaction.json(payload.value as JSONValue)},
        ${metadata.sourceRecordDigest}
      )
      on conflict do nothing
      returning 1 as inserted
    `,
    signal,
  );
  if (inserted.length === 1) return 1;
  await requireStoredDigest(
    transaction,
    'metadata',
    snapshotId,
    metadata.candidateId,
    metadata.sourceRecordDigest,
    signal,
  );
  return 0;
}

async function requireStoredDigest(
  transaction: PersistenceTransaction,
  kind: 'metadata' | 'profile',
  snapshotId: string,
  candidateId: string,
  recordDigest: string,
  signal: AbortSignal | undefined,
): Promise<void> {
  const rows =
    kind === 'profile'
      ? await executePending<readonly { readonly record_digest: string }[]>(
          transaction`
            select record_digest
            from gitblocks.serving_candidate_profile_records
            where snapshot_id = ${snapshotId}
              and candidate_id = ${candidateId}
          `,
          signal,
        )
      : await executePending<readonly { readonly record_digest: string }[]>(
          transaction`
            select record_digest
            from gitblocks.serving_candidate_retrieval_metadata_records
            where snapshot_id = ${snapshotId}
              and candidate_id = ${candidateId}
          `,
          signal,
        );
  if (rows.length !== 1 || rows[0]?.record_digest !== recordDigest) {
    throw persistenceError('persistence.conflict');
  }
}

async function selectCurrentSnapshot(
  transaction: PersistenceTransaction,
  publication: ValidatedPublication,
  signal: AbortSignal | undefined,
): Promise<void> {
  await executePending(
    transaction`
      insert into gitblocks.serving_catalog_current_snapshot (
        selector,
        snapshot_id,
        selected_at
      )
      values (true, ${publication.snapshotId}, ${publication.publishedAt}::timestamptz)
      on conflict (selector) do update
      set snapshot_id = excluded.snapshot_id,
          selected_at = excluded.selected_at
      where gitblocks.serving_catalog_current_snapshot.snapshot_id <>
        excluded.snapshot_id
    `,
    signal,
  );
}

async function loadCurrentSnapshotId(
  transaction: PersistenceTransaction,
  signal: AbortSignal | undefined,
): Promise<string> {
  const rows = await executePending<
    readonly { readonly snapshot_id: string }[]
  >(
    transaction`
      select snapshot_id
      from gitblocks.serving_catalog_current_snapshot
      where selector
    `,
    signal,
  );
  const snapshotId = rows[0]?.snapshot_id;
  if (rows.length !== 1 || snapshotId === undefined) {
    throw persistenceError('persistence.not-found');
  }
  return validateStableId(snapshotId);
}

async function loadSnapshotTransaction(
  transaction: PersistenceTransaction,
  snapshotId: string,
  signal: AbortSignal | undefined,
): Promise<LoadedServingCatalogSnapshot> {
  const roots = await executePending<readonly SnapshotRootRow[]>(
    transaction`
      select
        snapshot_id,
        snapshot_format_version,
        catalog_version,
        catalog_digest,
        candidate_count,
        profile_authority_header,
        profile_authority_semantic_digest,
        metadata_authority_header,
        metadata_authority_semantic_digest,
        published_at,
        record_digest
      from gitblocks.serving_catalog_snapshots
      where snapshot_id = ${snapshotId}
    `,
    signal,
  );
  const root = roots[0];
  if (roots.length !== 1 || root === undefined) {
    throw persistenceError('persistence.not-found');
  }
  const profiles = await executePending<readonly CandidateProfileRow[]>(
    transaction`
      select candidate_id, profile_payload, record_digest
      from gitblocks.serving_candidate_profile_records
      where snapshot_id = ${snapshotId}
      order by candidate_id collate "C"
      limit ${SERVING_CATALOG_CANDIDATE_COUNT + 1}
    `,
    signal,
  );
  const metadata = await executePending<readonly CandidateMetadataRow[]>(
    transaction`
      select candidate_id, metadata_payload, record_digest
      from gitblocks.serving_candidate_retrieval_metadata_records
      where snapshot_id = ${snapshotId}
      order by candidate_id collate "C"
      limit ${SERVING_CATALOG_CANDIDATE_COUNT + 1}
    `,
    signal,
  );
  return validateStoredSnapshot(root, profiles, metadata);
}

function validateStoredSnapshot(
  root: SnapshotRootRow,
  profileRows: readonly CandidateProfileRow[],
  metadataRows: readonly CandidateMetadataRow[],
): LoadedServingCatalogSnapshot {
  const profileHeader = storedHeader(root.profile_authority_header);
  const metadataHeader = storedHeader(root.metadata_authority_header);
  const profileAuthorityInput = {
    ...profileHeader,
    profiles: profileRows.map(({ profile_payload }) => profile_payload),
  };
  const metadataAuthorityInput = {
    ...metadataHeader,
    candidates: metadataRows.map(({ metadata_payload }) => metadata_payload),
  };
  const profiles = parseDeterministicCandidateProfileAuthority(
    profileAuthorityInput,
  );
  const metadata = parseCandidateRetrievalMetadataAuthorityV1(
    metadataAuthorityInput,
  );
  if (!profiles.ok || !metadata.ok) {
    throw persistenceError('persistence.corrupt-record');
  }
  const publishedAt = normalizeStoredTimestamp(root.published_at);
  const expectedSnapshotId = servingCatalogSnapshotId(
    profiles.value,
    metadata.value,
  );
  const expectedRecordDigest = servingCatalogSnapshotRecordDigest({
    snapshotId: expectedSnapshotId,
    catalogVersion: profiles.value.catalogVersion,
    catalogDigest: profiles.value.catalogDigest,
    candidateCount: profiles.value.profiles.length,
    profileAuthorityHeader: profileHeader as ProfileAuthorityHeader,
    metadataAuthorityHeader: metadataHeader as MetadataAuthorityHeader,
    publishedAt,
  });
  if (
    root.snapshot_format_version !== SERVING_CATALOG_SNAPSHOT_FORMAT_VERSION ||
    root.snapshot_id !== expectedSnapshotId ||
    root.catalog_version !== profiles.value.catalogVersion ||
    root.catalog_digest !== profiles.value.catalogDigest ||
    root.candidate_count !== SERVING_CATALOG_CANDIDATE_COUNT ||
    root.candidate_count !== profiles.value.profiles.length ||
    root.candidate_count !== metadata.value.candidates.length ||
    metadata.value.catalogVersion !== profiles.value.catalogVersion ||
    metadata.value.catalogDigest !== profiles.value.catalogDigest ||
    root.profile_authority_semantic_digest !==
      profiles.value.semanticAuthorityDigest ||
    root.metadata_authority_semantic_digest !==
      metadata.value.authoritySemanticDigest ||
    root.record_digest !== expectedRecordDigest ||
    profileRows.some((row, index) => {
      const candidateId = profiles.value.profiles.at(index)?.candidateId;
      const recordDigest =
        profiles.value.profiles.at(index)?.semanticProfileDigest;
      return (
        candidateId === undefined ||
        recordDigest === undefined ||
        row.candidate_id !== candidateId ||
        row.record_digest !== recordDigest
      );
    }) ||
    metadataRows.some((row, index) => {
      const candidateId = metadata.value.candidates.at(index)?.candidateId;
      const recordDigest =
        metadata.value.candidates.at(index)?.sourceRecordDigest;
      return (
        candidateId === undefined ||
        recordDigest === undefined ||
        row.candidate_id !== candidateId ||
        row.record_digest !== recordDigest
      );
    })
  ) {
    throw persistenceError('persistence.corrupt-record');
  }
  return Object.freeze({
    snapshotId: root.snapshot_id,
    snapshotRecordDigest: root.record_digest,
    publishedAt,
    candidateCount: SERVING_CATALOG_CANDIDATE_COUNT,
    candidateProfileAuthority: profiles.value,
    candidateProfileEvaluatorAuthority:
      projectDeterministicCandidateProfileAuthorityToEvaluatorV2(
        profiles.domain,
      ),
    candidateRetrievalMetadataAuthority: metadata.value,
    expectedCandidateRetrievalMetadataAuthorityBinding: metadataBinding(
      metadata.value,
    ),
  });
}

function storedHeader(value: unknown): Readonly<Record<string, unknown>> {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    throw persistenceError('persistence.corrupt-record');
  }
  return value as Readonly<Record<string, unknown>>;
}

function profileRepositoryIdentity(
  profile: DeterministicCandidateProfileV1 | DeterministicCandidateProfileV2,
): {
  readonly candidateId: string;
  readonly githubOwner: string;
  readonly githubRepository: string;
} | null {
  const field = (
    profile.fields as readonly {
      readonly fieldId: string;
      readonly state: string;
      readonly value?: Readonly<Record<string, unknown>>;
    }[]
  ).find(({ fieldId }) => fieldId === 'repository-identity');
  if (
    field?.state !== 'known' ||
    typeof field.value?.['candidateId'] !== 'string' ||
    typeof field.value['githubOwner'] !== 'string' ||
    typeof field.value['githubRepository'] !== 'string'
  ) {
    return null;
  }
  return {
    candidateId: field.value['candidateId'],
    githubOwner: field.value['githubOwner'],
    githubRepository: field.value['githubRepository'],
  };
}

function servingCatalogSnapshotId(
  profiles: DeterministicCandidateProfileAuthorityPublished,
  metadata: CandidateRetrievalMetadataAuthorityV1,
): string {
  const identityDigest = canonicalizeJson({
    snapshotFormatVersion: SERVING_CATALOG_SNAPSHOT_FORMAT_VERSION,
    catalogVersion: profiles.catalogVersion,
    catalogDigest: profiles.catalogDigest,
    profileAuthoritySemanticDigest: profiles.semanticAuthorityDigest,
    metadataAuthoritySemanticDigest: metadata.authoritySemanticDigest,
  }).digest;
  return `serving-${identityDigest.slice(0, 48)}`;
}

function servingCatalogSnapshotRecordDigest(input: {
  readonly snapshotId: string;
  readonly catalogVersion: string;
  readonly catalogDigest: string;
  readonly candidateCount: number;
  readonly profileAuthorityHeader: ProfileAuthorityHeader;
  readonly metadataAuthorityHeader: MetadataAuthorityHeader;
  readonly publishedAt: string;
}): string {
  return canonicalizeJson({
    snapshotId: input.snapshotId,
    snapshotFormatVersion: SERVING_CATALOG_SNAPSHOT_FORMAT_VERSION,
    catalogVersion: input.catalogVersion,
    catalogDigest: input.catalogDigest,
    candidateCount: input.candidateCount,
    profileAuthorityHeader: input.profileAuthorityHeader,
    metadataAuthorityHeader: input.metadataAuthorityHeader,
    publishedAt: input.publishedAt,
  }).digest;
}

function metadataBinding(
  authority: CandidateRetrievalMetadataAuthorityV1,
): ServingCandidateRetrievalMetadataBinding {
  return Object.freeze({
    authorityVersion: authority.authorityVersion,
    catalogVersion: authority.catalogVersion,
    catalogDigest: authority.catalogDigest,
    providerPolicyVersion: authority.providerPolicyVersion,
    providerPolicyDigest: authority.providerPolicyDigest,
    sourceProviderPolicyVersion: authority.sourceProviderPolicyVersion,
    sourceProviderPolicyDigest: authority.sourceProviderPolicyDigest,
    sourceOperation: authority.sourceOperation,
  });
}
