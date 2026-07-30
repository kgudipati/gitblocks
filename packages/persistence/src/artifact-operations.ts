import {
  parseRepositoryArtifactChunkV1,
  parseRepositoryArtifactSetV1,
  parseRepositoryArtifactV1,
  type RepositoryArtifactChunkV1,
  type RepositoryArtifactSetEntryV1,
  type RepositoryArtifactSetV1,
  type RepositoryArtifactV1,
} from '@gitblocks/contracts';

import { canonicalizeJson } from './canonical-json.ts';
import {
  executePending,
  withTransaction,
  type PersistenceClient,
  type PersistenceTransaction,
} from './client.ts';
import { persistenceError } from './errors.ts';
import type {
  LoadRepositoryArtifactCommand,
  LoadRepositoryArtifactSetCommand,
  LoadedRepositoryArtifact,
  OperationControl,
  PublishRepositoryArtifactSetCommand,
  PublishRepositoryArtifactSetResult,
} from './types.ts';
import { normalizeStoredTimestamp, validateStableId } from './validation.ts';

const CANDIDATE_LOCK_SEED = 44392817;
const MAX_ARTIFACT_BYTES_PER_CANDIDATE = 512 * 1_024;

interface InsertedRow {
  readonly inserted: number;
}

interface CandidateRepositoryRow {
  readonly repository_owner: string;
  readonly repository_name: string;
}

interface ArtifactRow {
  readonly artifact_id: string;
  readonly candidate_id: string;
  readonly contract_version: string;
  readonly provider: string;
  readonly provider_repository_id: string;
  readonly git_object_algorithm: string;
  readonly commit_object_id: string;
  readonly path: string;
  readonly blob_object_id: string;
  readonly blob_api_url: string;
  readonly display_url: string | null;
  readonly media_type: string;
  readonly encoding: string;
  readonly content_sha256: string;
  readonly byte_count: number;
  readonly line_count: number;
  readonly exact_content: string;
  readonly catalog_owner: string;
  readonly catalog_repository: string;
  readonly provider_owner: string;
  readonly provider_repository: string;
  readonly collected_at: unknown;
  readonly identity_digest: string;
  readonly record_digest: string;
}

interface ChunkRow {
  readonly chunk_id: string;
  readonly artifact_id: string;
  readonly candidate_id: string;
  readonly contract_version: string;
  readonly chunker_version: string;
  readonly ordinal: number;
  readonly start_byte: number;
  readonly end_byte_exclusive: number;
  readonly byte_count: number;
  readonly start_line: number;
  readonly end_line: number;
  readonly content_sha256: string;
  readonly exact_content: string;
  readonly identity_digest: string;
  readonly record_digest: string;
}

interface ArtifactSetRow {
  readonly artifact_set_id: string;
  readonly candidate_id: string;
  readonly contract_version: string;
  readonly catalog_version: string;
  readonly catalog_digest: string;
  readonly artifact_manifest_version: string;
  readonly artifact_manifest_digest: string;
  readonly collector_version: string;
  readonly chunker_version: string;
  readonly provider: string;
  readonly provider_repository_id: string;
  readonly provider_canonical_owner: string;
  readonly provider_canonical_repository: string;
  readonly git_object_algorithm: string;
  readonly commit_object_id: string;
  readonly entry_count: number;
  readonly published_at: unknown;
  readonly identity_digest: string;
  readonly record_digest: string;
}

interface ArtifactSetEntryRow {
  readonly selection_id: string;
  readonly ordinal: number;
  readonly selector: string;
  readonly artifact_kind: string;
  readonly requirement: string;
  readonly rationale: string | null;
  readonly requested_path: string | null;
  readonly resolved_path: string | null;
  readonly outcome: string;
  readonly artifact_id: string | null;
}

export async function publishRepositoryArtifactSet(
  client: PersistenceClient,
  command: PublishRepositoryArtifactSetCommand,
  control?: OperationControl,
): Promise<PublishRepositoryArtifactSetResult> {
  const validated = validatePublication(command);
  return withTransaction(
    client,
    control,
    'read-write',
    async (transaction, signal) => {
      await executePending(
        transaction`
          select pg_catalog.pg_advisory_xact_lock(
            pg_catalog.hashtextextended(
              ${validated.artifactSet.candidateId},
              ${CANDIDATE_LOCK_SEED}
            )
          )
        `,
        signal,
      );
      const candidate = await executePending<readonly CandidateRepositoryRow[]>(
        transaction`
          select repository_owner, repository_name
          from gitblocks.catalog_candidates
          where candidate_id = ${validated.artifactSet.candidateId}
        `,
        signal,
      );
      const candidateRepository = candidate[0];
      if (candidate.length !== 1 || candidateRepository === undefined) {
        throw persistenceError('persistence.conflict');
      }
      validateCatalogProvenance(validated, candidateRepository);

      const inserted = {
        artifacts: 0,
        chunks: 0,
        artifactSets: 0,
        entries: 0,
      };
      for (const publication of validated.artifacts) {
        inserted.artifacts += await insertArtifact(
          transaction,
          publication.artifact,
          signal,
        );
        for (const chunk of publication.chunks) {
          inserted.chunks += await insertChunk(transaction, chunk, signal);
        }
      }
      inserted.artifactSets += await insertArtifactSet(
        transaction,
        validated.artifactSet,
        signal,
      );
      for (const entry of validated.artifactSet.entries) {
        inserted.entries += await insertArtifactSetEntry(
          transaction,
          validated.artifactSet,
          entry,
          signal,
        );
      }

      await executePending(transaction`set constraints all immediate`, signal);
      const artifactSet = await loadArtifactSetTransaction(
        transaction,
        validated.artifactSet.artifactSetId,
        signal,
      );
      if (artifactSet.identityDigest !== validated.artifactSet.identityDigest) {
        throw persistenceError('persistence.conflict');
      }
      return { artifactSet, inserted };
    },
  );
}

export async function loadRepositoryArtifact(
  client: PersistenceClient,
  command: LoadRepositoryArtifactCommand,
  control?: OperationControl,
): Promise<LoadedRepositoryArtifact> {
  const artifactId = validateStableId(command.artifactId);
  return withTransaction(
    client,
    control,
    'read-only',
    async (transaction, signal) =>
      loadArtifactTransaction(transaction, artifactId, signal),
  );
}

export async function loadRepositoryArtifactSet(
  client: PersistenceClient,
  command: LoadRepositoryArtifactSetCommand,
  control?: OperationControl,
): Promise<RepositoryArtifactSetV1> {
  const artifactSetId = validateStableId(command.artifactSetId);
  return withTransaction(
    client,
    control,
    'read-only',
    async (transaction, signal) =>
      loadArtifactSetTransaction(transaction, artifactSetId, signal),
  );
}

function validatePublication(
  command: PublishRepositoryArtifactSetCommand,
): PublishRepositoryArtifactSetCommand {
  const parsedSet = parseRepositoryArtifactSetV1(command.artifactSet);
  if (!parsedSet.ok || command.artifacts.length > 4) {
    throw persistenceError('persistence.invalid-input');
  }
  const presentIds = parsedSet.value.entries
    .filter((entry) => entry.outcome === 'present')
    .map((entry) => entry.artifactId);
  const suppliedIds = new Set<string>();
  let totalBytes = 0;
  const artifacts = command.artifacts.map((publication) => {
    const parsedArtifact = parseRepositoryArtifactV1(publication.artifact);
    if (!parsedArtifact.ok) {
      throw persistenceError('persistence.invalid-input');
    }
    const artifact = parsedArtifact.value;
    if (
      suppliedIds.has(artifact.artifactId) ||
      artifact.candidateId !== parsedSet.value.candidateId ||
      artifact.providerRepositoryId !== parsedSet.value.providerRepositoryId ||
      artifact.commitObjectId !== parsedSet.value.commitObjectId ||
      artifact.firstMaterialization.providerOwner !==
        parsedSet.value.providerCanonicalOwner ||
      artifact.firstMaterialization.providerRepository !==
        parsedSet.value.providerCanonicalRepository ||
      publication.chunks.length < 1 ||
      publication.chunks.length > 64
    ) {
      throw persistenceError('persistence.invalid-input');
    }
    suppliedIds.add(artifact.artifactId);
    totalBytes += artifact.byteCount;
    const chunks = validateChunks(artifact, publication.chunks);
    return { artifact, chunks };
  });
  if (
    totalBytes > MAX_ARTIFACT_BYTES_PER_CANDIDATE ||
    presentIds.length !== artifacts.length ||
    presentIds.some((artifactId) => !suppliedIds.has(artifactId))
  ) {
    throw persistenceError('persistence.invalid-input');
  }
  return { artifactSet: parsedSet.value, artifacts };
}

function validateCatalogProvenance(
  command: PublishRepositoryArtifactSetCommand,
  candidate: CandidateRepositoryRow,
): void {
  if (
    command.artifacts.some(
      ({ artifact }) =>
        artifact.firstMaterialization.catalogOwner !==
          candidate.repository_owner ||
        artifact.firstMaterialization.catalogRepository !==
          candidate.repository_name,
    )
  ) {
    throw persistenceError('persistence.invalid-input');
  }
}

function validateChunks(
  artifact: RepositoryArtifactV1,
  values: readonly RepositoryArtifactChunkV1[],
): readonly RepositoryArtifactChunkV1[] {
  const chunks = values.map((value, ordinal) => {
    const parsed = parseRepositoryArtifactChunkV1(value);
    if (
      !parsed.ok ||
      parsed.value.artifactId !== artifact.artifactId ||
      parsed.value.candidateId !== artifact.candidateId ||
      parsed.value.ordinal !== ordinal
    ) {
      throw persistenceError('persistence.invalid-input');
    }
    return parsed.value;
  });
  let expectedStart = 0;
  for (const chunk of chunks) {
    if (chunk.startByte !== expectedStart) {
      throw persistenceError('persistence.invalid-input');
    }
    expectedStart = chunk.endByteExclusive;
  }
  if (
    expectedStart !== artifact.byteCount ||
    (artifact.byteCount === 0 &&
      (chunks.length !== 1 || chunks[0]?.byteCount !== 0)) ||
    (artifact.byteCount > 0 && chunks.some((chunk) => chunk.byteCount === 0)) ||
    Buffer.concat(
      chunks.map((chunk) => Buffer.from(chunk.content, 'utf8')),
    ).toString('utf8') !== artifact.content
  ) {
    throw persistenceError('persistence.invalid-input');
  }
  return chunks;
}

async function insertArtifact(
  transaction: PersistenceTransaction,
  artifact: RepositoryArtifactV1,
  signal: AbortSignal | undefined,
): Promise<number> {
  const rows = await executePending<readonly InsertedRow[]>(
    transaction`
      insert into gitblocks.repository_artifacts (
        artifact_id,
        candidate_id,
        contract_version,
        provider,
        provider_repository_id,
        git_object_algorithm,
        commit_object_id,
        path,
        blob_object_id,
        blob_api_url,
        display_url,
        media_type,
        encoding,
        content_sha256,
        byte_count,
        line_count,
        exact_content,
        catalog_owner,
        catalog_repository,
        provider_owner,
        provider_repository,
        collected_at,
        identity_digest,
        record_digest
      )
      values (
        ${artifact.artifactId},
        ${artifact.candidateId},
        ${artifact.contractVersion},
        ${artifact.provider},
        ${artifact.providerRepositoryId},
        ${artifact.gitObjectAlgorithm},
        ${artifact.commitObjectId},
        ${artifact.path},
        ${artifact.blobObjectId},
        ${artifact.blobApiUrl},
        ${artifact.displayUrl},
        ${artifact.mediaType},
        ${artifact.encoding},
        ${artifact.contentSha256},
        ${artifact.byteCount},
        ${artifact.lineCount},
        ${artifact.content},
        ${artifact.firstMaterialization.catalogOwner},
        ${artifact.firstMaterialization.catalogRepository},
        ${artifact.firstMaterialization.providerOwner},
        ${artifact.firstMaterialization.providerRepository},
        ${artifact.firstMaterialization.collectedAt}::timestamptz,
        ${artifact.identityDigest},
        ${artifact.recordDigest}
      )
      on conflict do nothing
      returning 1 as inserted
    `,
    signal,
  );
  if (rows.length === 1) {
    return 1;
  }
  const stored = (
    await loadArtifactTransaction(transaction, artifact.artifactId, signal)
  ).artifact;
  if (
    stored.identityDigest !== artifact.identityDigest ||
    artifactImmutableCoreDigest(stored) !==
      artifactImmutableCoreDigest(artifact)
  ) {
    throw persistenceError('persistence.conflict');
  }
  return 0;
}

async function insertChunk(
  transaction: PersistenceTransaction,
  chunk: RepositoryArtifactChunkV1,
  signal: AbortSignal | undefined,
): Promise<number> {
  const rows = await executePending<readonly InsertedRow[]>(
    transaction`
      insert into gitblocks.repository_artifact_chunks (
        chunk_id,
        artifact_id,
        candidate_id,
        contract_version,
        chunker_version,
        ordinal,
        start_byte,
        end_byte_exclusive,
        byte_count,
        start_line,
        end_line,
        content_sha256,
        exact_content,
        identity_digest,
        record_digest
      )
      values (
        ${chunk.chunkId},
        ${chunk.artifactId},
        ${chunk.candidateId},
        ${chunk.contractVersion},
        ${chunk.chunkerVersion},
        ${chunk.ordinal},
        ${chunk.startByte},
        ${chunk.endByteExclusive},
        ${chunk.byteCount},
        ${chunk.startLine},
        ${chunk.endLine},
        ${chunk.contentSha256},
        ${chunk.content},
        ${chunk.identityDigest},
        ${chunk.recordDigest}
      )
      on conflict do nothing
      returning 1 as inserted
    `,
    signal,
  );
  if (rows.length === 1) {
    return 1;
  }
  const stored = await loadChunkById(transaction, chunk.chunkId, signal);
  if (stored.recordDigest !== chunk.recordDigest) {
    throw persistenceError('persistence.conflict');
  }
  return 0;
}

async function insertArtifactSet(
  transaction: PersistenceTransaction,
  artifactSet: RepositoryArtifactSetV1,
  signal: AbortSignal | undefined,
): Promise<number> {
  const rows = await executePending<readonly InsertedRow[]>(
    transaction`
      insert into gitblocks.repository_artifact_sets (
        artifact_set_id,
        candidate_id,
        contract_version,
        catalog_version,
        catalog_digest,
        artifact_manifest_version,
        artifact_manifest_digest,
        collector_version,
        chunker_version,
        provider,
        provider_repository_id,
        provider_canonical_owner,
        provider_canonical_repository,
        git_object_algorithm,
        commit_object_id,
        entry_count,
        published_at,
        identity_digest,
        record_digest
      )
      values (
        ${artifactSet.artifactSetId},
        ${artifactSet.candidateId},
        ${artifactSet.contractVersion},
        ${artifactSet.catalogVersion},
        ${artifactSet.catalogDigest},
        ${artifactSet.artifactManifestVersion},
        ${artifactSet.artifactManifestDigest},
        ${artifactSet.collectorVersion},
        ${artifactSet.chunkerVersion},
        ${artifactSet.provider},
        ${artifactSet.providerRepositoryId},
        ${artifactSet.providerCanonicalOwner},
        ${artifactSet.providerCanonicalRepository},
        ${artifactSet.gitObjectAlgorithm},
        ${artifactSet.commitObjectId},
        ${artifactSet.entries.length},
        ${artifactSet.publishedAt}::timestamptz,
        ${artifactSet.identityDigest},
        ${artifactSet.recordDigest}
      )
      on conflict do nothing
      returning 1 as inserted
    `,
    signal,
  );
  if (rows.length === 1) {
    return 1;
  }
  const stored = await loadArtifactSetTransaction(
    transaction,
    artifactSet.artifactSetId,
    signal,
  );
  if (stored.identityDigest !== artifactSet.identityDigest) {
    throw persistenceError('persistence.conflict');
  }
  return 0;
}

async function insertArtifactSetEntry(
  transaction: PersistenceTransaction,
  artifactSet: RepositoryArtifactSetV1,
  entry: RepositoryArtifactSetEntryV1,
  signal: AbortSignal | undefined,
): Promise<number> {
  const rows = await executePending<readonly InsertedRow[]>(
    transaction`
      insert into gitblocks.repository_artifact_set_entries (
        artifact_set_id,
        candidate_id,
        selection_id,
        ordinal,
        selector,
        artifact_kind,
        requirement,
        rationale,
        requested_path,
        resolved_path,
        outcome,
        artifact_id
      )
      values (
        ${artifactSet.artifactSetId},
        ${artifactSet.candidateId},
        ${entry.selectionId},
        ${entry.ordinal},
        ${entry.selector},
        ${entry.artifactKind},
        ${entry.requirement},
        ${entry.rationale},
        ${entry.requestedPath},
        ${entry.resolvedPath},
        ${entry.outcome},
        ${entry.artifactId}
      )
      on conflict do nothing
      returning 1 as inserted
    `,
    signal,
  );
  if (rows.length === 1) {
    return 1;
  }
  const existing = await executePending<readonly ArtifactSetEntryRow[]>(
    transaction`
      select
        selection_id,
        ordinal,
        selector,
        artifact_kind,
        requirement,
        rationale,
        requested_path,
        resolved_path,
        outcome,
        artifact_id
      from gitblocks.repository_artifact_set_entries
      where artifact_set_id = ${artifactSet.artifactSetId}
        and ordinal = ${entry.ordinal}
    `,
    signal,
  );
  const existingEntry = existing[0];
  if (
    existing.length !== 1 ||
    existingEntry === undefined ||
    canonicalizeJson(mapEntry(existingEntry)).digest !==
      canonicalizeJson(entry).digest
  ) {
    throw persistenceError('persistence.conflict');
  }
  return 0;
}

async function loadArtifactTransaction(
  transaction: PersistenceTransaction,
  artifactId: string,
  signal: AbortSignal | undefined,
): Promise<LoadedRepositoryArtifact> {
  const rows = await executePending<readonly ArtifactRow[]>(
    transaction`
      select *
      from gitblocks.repository_artifacts
      where artifact_id = ${artifactId}
    `,
    signal,
  );
  if (rows.length !== 1) {
    throw persistenceError('persistence.not-found');
  }
  const artifactRow = rows[0];
  if (artifactRow === undefined) {
    throw persistenceError('persistence.not-found');
  }
  const artifact = mapArtifact(artifactRow);
  const chunks = await loadChunks(transaction, artifact.artifactId, signal);
  validateChunks(artifact, chunks);
  return { artifact, chunks };
}

async function loadChunks(
  transaction: PersistenceTransaction,
  artifactId: string,
  signal: AbortSignal | undefined,
): Promise<readonly RepositoryArtifactChunkV1[]> {
  const rows = await executePending<readonly ChunkRow[]>(
    transaction`
      select *
      from gitblocks.repository_artifact_chunks
      where artifact_id = ${artifactId}
      order by ordinal
    `,
    signal,
  );
  if (rows.length > 64) {
    throw persistenceError('persistence.result-limit');
  }
  return rows.map(mapChunk);
}

async function loadChunkById(
  transaction: PersistenceTransaction,
  chunkId: string,
  signal: AbortSignal | undefined,
): Promise<RepositoryArtifactChunkV1> {
  const rows = await executePending<readonly ChunkRow[]>(
    transaction`
      select *
      from gitblocks.repository_artifact_chunks
      where chunk_id = ${chunkId}
    `,
    signal,
  );
  if (rows.length !== 1) {
    throw persistenceError('persistence.conflict');
  }
  const row = rows[0];
  if (row === undefined) {
    throw persistenceError('persistence.conflict');
  }
  return mapChunk(row);
}

async function loadArtifactSetTransaction(
  transaction: PersistenceTransaction,
  artifactSetId: string,
  signal: AbortSignal | undefined,
): Promise<RepositoryArtifactSetV1> {
  const setRows = await executePending<readonly ArtifactSetRow[]>(
    transaction`
      select *
      from gitblocks.repository_artifact_sets
      where artifact_set_id = ${artifactSetId}
    `,
    signal,
  );
  if (setRows.length !== 1) {
    throw persistenceError('persistence.not-found');
  }
  const entryRows = await executePending<readonly ArtifactSetEntryRow[]>(
    transaction`
      select
        selection_id,
        ordinal,
        selector,
        artifact_kind,
        requirement,
        rationale,
        requested_path,
        resolved_path,
        outcome,
        artifact_id
      from gitblocks.repository_artifact_set_entries
      where artifact_set_id = ${artifactSetId}
      order by ordinal
    `,
    signal,
  );
  if (entryRows.length > 4) {
    throw persistenceError('persistence.result-limit');
  }
  const setRow = setRows[0];
  if (setRow === undefined) {
    throw persistenceError('persistence.not-found');
  }
  return mapArtifactSet(setRow, entryRows);
}

function mapArtifact(row: ArtifactRow): RepositoryArtifactV1 {
  const value = {
    contractVersion: row.contract_version,
    artifactId: row.artifact_id,
    candidateId: row.candidate_id,
    provider: row.provider,
    providerRepositoryId: row.provider_repository_id,
    gitObjectAlgorithm: row.git_object_algorithm,
    commitObjectId: row.commit_object_id,
    path: row.path,
    blobObjectId: row.blob_object_id,
    blobApiUrl: row.blob_api_url,
    displayUrl: row.display_url,
    mediaType: row.media_type,
    encoding: row.encoding,
    contentSha256: row.content_sha256,
    byteCount: row.byte_count,
    lineCount: row.line_count,
    content: row.exact_content,
    firstMaterialization: {
      catalogOwner: row.catalog_owner,
      catalogRepository: row.catalog_repository,
      providerOwner: row.provider_owner,
      providerRepository: row.provider_repository,
      collectedAt: normalizeStoredTimestamp(row.collected_at),
    },
    identityDigest: row.identity_digest,
    recordDigest: row.record_digest,
  };
  const parsed = parseRepositoryArtifactV1(value);
  if (!parsed.ok) {
    throw persistenceError('persistence.corrupt-record');
  }
  return parsed.value;
}

function mapChunk(row: ChunkRow): RepositoryArtifactChunkV1 {
  const parsed = parseRepositoryArtifactChunkV1({
    contractVersion: row.contract_version,
    chunkId: row.chunk_id,
    artifactId: row.artifact_id,
    candidateId: row.candidate_id,
    chunkerVersion: row.chunker_version,
    ordinal: row.ordinal,
    startByte: row.start_byte,
    endByteExclusive: row.end_byte_exclusive,
    byteCount: row.byte_count,
    startLine: row.start_line,
    endLine: row.end_line,
    contentSha256: row.content_sha256,
    content: row.exact_content,
    identityDigest: row.identity_digest,
    recordDigest: row.record_digest,
  });
  if (!parsed.ok) {
    throw persistenceError('persistence.corrupt-record');
  }
  return parsed.value;
}

function mapArtifactSet(
  row: ArtifactSetRow,
  entries: readonly ArtifactSetEntryRow[],
): RepositoryArtifactSetV1 {
  if (row.entry_count !== entries.length) {
    throw persistenceError('persistence.corrupt-record');
  }
  const parsed = parseRepositoryArtifactSetV1({
    contractVersion: row.contract_version,
    artifactSetId: row.artifact_set_id,
    candidateId: row.candidate_id,
    catalogVersion: row.catalog_version,
    catalogDigest: row.catalog_digest,
    artifactManifestVersion: row.artifact_manifest_version,
    artifactManifestDigest: row.artifact_manifest_digest,
    collectorVersion: row.collector_version,
    chunkerVersion: row.chunker_version,
    provider: row.provider,
    providerRepositoryId: row.provider_repository_id,
    providerCanonicalOwner: row.provider_canonical_owner,
    providerCanonicalRepository: row.provider_canonical_repository,
    gitObjectAlgorithm: row.git_object_algorithm,
    commitObjectId: row.commit_object_id,
    entries: entries.map(mapEntry),
    publishedAt: normalizeStoredTimestamp(row.published_at),
    identityDigest: row.identity_digest,
    recordDigest: row.record_digest,
  });
  if (!parsed.ok) {
    throw persistenceError('persistence.corrupt-record');
  }
  return parsed.value;
}

function mapEntry(row: ArtifactSetEntryRow): RepositoryArtifactSetEntryV1 {
  return {
    selectionId: row.selection_id,
    ordinal: row.ordinal,
    selector: row.selector,
    artifactKind: row.artifact_kind,
    requirement: row.requirement,
    rationale: row.rationale,
    requestedPath: row.requested_path,
    resolvedPath: row.resolved_path,
    outcome: row.outcome,
    artifactId: row.artifact_id,
  } as RepositoryArtifactSetEntryV1;
}

function artifactImmutableCoreDigest(value: RepositoryArtifactV1): string {
  return canonicalizeJson({
    contractVersion: value.contractVersion,
    artifactId: value.artifactId,
    candidateId: value.candidateId,
    provider: value.provider,
    providerRepositoryId: value.providerRepositoryId,
    gitObjectAlgorithm: value.gitObjectAlgorithm,
    commitObjectId: value.commitObjectId,
    path: value.path,
    blobObjectId: value.blobObjectId,
    blobApiUrl: value.blobApiUrl,
    mediaType: value.mediaType,
    encoding: value.encoding,
    contentSha256: value.contentSha256,
    byteCount: value.byteCount,
    lineCount: value.lineCount,
    content: value.content,
    identityDigest: value.identityDigest,
  }).digest;
}
