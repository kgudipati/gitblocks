import {
  loadRepositoryArtifact,
  publishRepositoryArtifactSet,
  PersistenceError,
  type PersistenceClient,
} from '@gitblocks/persistence';

import { createArtifactReceipt } from './artifact-receipt.ts';
import { StableIdRegistry, canonicalizeJson } from './canonical-json.ts';
import { asSafeErrorCode, ingestionError } from './errors.ts';
import type { RepositoryArtifactCollector } from './artifact-provider.ts';
import type {
  ArtifactReceipt,
  ArtifactReceiptCandidate,
  Clock,
  IngestionObserver,
  PublicArtifactManifest,
  PublicCatalog,
  TransportMetrics,
} from './types.ts';

const MAXIMUM_CANDIDATE_CONCURRENCY = 2;
const MAXIMUM_RUN_MILLISECONDS = 60 * 60_000;
const MAXIMUM_CANDIDATE_MILLISECONDS = 120_000;
const MAXIMUM_RUN_DECODED_BYTES = 64 * 1_024 * 1_024;

export interface CollectPublicRepositoryArtifactsConfig {
  readonly catalog: PublicCatalog;
  readonly manifest: PublicArtifactManifest;
  readonly persistence: PersistenceClient;
  readonly collector: RepositoryArtifactCollector;
  readonly getProviderMetrics: () => TransportMetrics;
  readonly clock: Clock;
  readonly observer?: IngestionObserver;
  readonly candidateConcurrency?: number;
  readonly maximumRunMilliseconds?: number;
  readonly maximumDecodedBytes?: number;
  readonly databaseMigrationVersion: number;
  readonly candidateIds?: readonly string[];
  readonly priorReceipt?: ArtifactReceipt;
  readonly signal?: AbortSignal;
}

export async function collectPublicRepositoryArtifacts(
  config: CollectPublicRepositoryArtifactsConfig,
): Promise<ArtifactReceipt> {
  const candidateConcurrency =
    config.candidateConcurrency ?? MAXIMUM_CANDIDATE_CONCURRENCY;
  const maximumRunMilliseconds =
    config.maximumRunMilliseconds ?? MAXIMUM_RUN_MILLISECONDS;
  const maximumDecodedBytes =
    config.maximumDecodedBytes ?? MAXIMUM_RUN_DECODED_BYTES;
  validateConfig(
    config,
    candidateConcurrency,
    maximumRunMilliseconds,
    maximumDecodedBytes,
  );
  const candidates = selectCandidates(config.catalog, config.candidateIds);
  const startedAt = config.clock.now().toISOString();
  const runId = new StableIdRegistry().create('artifact-run', {
    catalogDigest: config.catalog.manifestDigest,
    artifactManifestDigest: config.manifest.manifestDigest,
    startedAt,
  });
  const runDeadline = AbortSignal.timeout(maximumRunMilliseconds);
  const results: (ArtifactReceiptCandidate | undefined)[] = Array.from(
    { length: candidates.length },
    () => undefined,
  );
  let nextIndex = 0;
  let totalDecodedBytes = 0;
  let runByteBoundExceeded = false;
  const hasRunByteBoundExceeded = (): boolean => runByteBoundExceeded;

  emit(config.observer, {
    eventName: 'artifact.batch',
    correlationId: runId,
    candidateId: null,
    provider: null,
    operation: 'collect',
    outcome: 'started',
    attempt: null,
    durationMilliseconds: null,
    safeErrorCode: null,
  });

  const worker = async (): Promise<void> => {
    for (;;) {
      const index = nextIndex;
      nextIndex += 1;
      const candidate = candidates[index];
      if (candidate === undefined) {
        return;
      }
      const candidateStarted = performance.now();
      try {
        if (hasRunByteBoundExceeded()) {
          throw ingestionError('ingestion.body-too-large');
        }
        throwIfStopped(config.signal, runDeadline);
        const candidateDeadline = AbortSignal.timeout(
          MAXIMUM_CANDIDATE_MILLISECONDS,
        );
        const deadlineSignal = AbortSignal.any([
          runDeadline,
          candidateDeadline,
        ]);
        const publication = await config.collector.collectCandidate({
          candidate,
          manifest: config.manifest,
          collectedAt: config.clock.now().toISOString(),
          publishedAt: config.clock.now().toISOString(),
          correlationId: runId,
          ...(config.signal === undefined ? {} : { signal: config.signal }),
          deadlineSignal,
        });
        const candidateBytes = publication.artifacts.reduce(
          (total, artifact) => total + artifact.artifact.byteCount,
          0,
        );
        throwIfStopped(config.signal, deadlineSignal);
        if (
          hasRunByteBoundExceeded() ||
          totalDecodedBytes + candidateBytes > maximumDecodedBytes
        ) {
          runByteBoundExceeded = true;
          throw ingestionError('ingestion.body-too-large');
        }
        totalDecodedBytes += candidateBytes;
        const operationSignal =
          config.signal === undefined
            ? deadlineSignal
            : AbortSignal.any([config.signal, deadlineSignal]);
        const persisted = await publishRepositoryArtifactSet(
          config.persistence,
          publication,
          { signal: operationSignal },
        );
        const loaded = await Promise.all(
          persisted.artifactSet.entries.flatMap((entry) =>
            entry.outcome === 'present'
              ? [
                  loadRepositoryArtifact(
                    config.persistence,
                    { artifactId: entry.artifactId },
                    { signal: operationSignal },
                  ),
                ]
              : [],
          ),
        );
        const insertedRows = rowCount(persisted.inserted);
        results[index] = {
          candidateId: candidate.candidateId,
          outcome: insertedRows === 0 ? 'idempotent' : 'created',
          artifactSetId: persisted.artifactSet.artifactSetId,
          artifactCount: loaded.length,
          chunkCount: loaded.reduce(
            (total, artifact) => total + artifact.chunks.length,
            0,
          ),
          absenceCount: persisted.artifactSet.entries.filter(
            ({ outcome }) => outcome === 'not-found',
          ).length,
          decodedBytes: loaded.reduce(
            (total, artifact) => total + artifact.artifact.byteCount,
            0,
          ),
          inserted: persisted.inserted,
          materializationDigest: canonicalizeJson({
            artifactSetId: persisted.artifactSet.artifactSetId,
            publishedAt: persisted.artifactSet.publishedAt,
            setRecordDigest: persisted.artifactSet.recordDigest,
            artifacts: loaded.map(({ artifact, chunks }) => ({
              artifactId: artifact.artifactId,
              collectedAt: artifact.firstMaterialization.collectedAt,
              recordDigest: artifact.recordDigest,
              chunks: chunks.map((chunk) => ({
                chunkId: chunk.chunkId,
                recordDigest: chunk.recordDigest,
              })),
            })),
          }).digest,
          safeErrorCode: null,
        };
        emit(config.observer, {
          eventName: 'artifact.candidate',
          correlationId: runId,
          candidateId: candidate.candidateId,
          provider: 'persistence',
          operation: 'publish',
          outcome: 'succeeded',
          attempt: null,
          durationMilliseconds: Math.round(
            performance.now() - candidateStarted,
          ),
          safeErrorCode: null,
        });
      } catch (error) {
        const safeErrorCode =
          error instanceof PersistenceError
            ? 'ingestion.persistence'
            : asSafeErrorCode(error);
        results[index] = failedCandidate(candidate.candidateId, safeErrorCode);
        emit(config.observer, {
          eventName: 'artifact.candidate',
          correlationId: runId,
          candidateId: candidate.candidateId,
          provider: null,
          operation: 'publish',
          outcome: 'failed',
          attempt: null,
          durationMilliseconds: Math.round(
            performance.now() - candidateStarted,
          ),
          safeErrorCode,
        });
      }
    }
  };

  await Promise.all(
    Array.from(
      { length: Math.min(candidateConcurrency, candidates.length) },
      worker,
    ),
  );
  const completedAt = config.clock.now().toISOString();
  const receipt = createArtifactReceipt({
    catalog: config.catalog,
    manifest: config.manifest,
    runId,
    startedAt,
    completedAt,
    candidates: results.filter(
      (candidate): candidate is ArtifactReceiptCandidate =>
        candidate !== undefined,
    ),
    providerMetrics: config.getProviderMetrics(),
    databaseMigrationVersion: config.databaseMigrationVersion,
    requestedCandidateCount: candidates.length,
    ...(config.priorReceipt === undefined
      ? {}
      : { priorReceipt: config.priorReceipt }),
  });
  emit(config.observer, {
    eventName: 'artifact.batch',
    correlationId: runId,
    candidateId: null,
    provider: null,
    operation: 'collect',
    outcome: receipt.outcomeCounts.failed > 0 ? 'partial' : 'succeeded',
    attempt: null,
    durationMilliseconds: Date.parse(completedAt) - Date.parse(startedAt),
    safeErrorCode: null,
  });
  return receipt;
}

function validateConfig(
  config: CollectPublicRepositoryArtifactsConfig,
  concurrency: number,
  maximumRunMilliseconds: number,
  maximumDecodedBytes: number,
): void {
  if (
    config.manifest.catalogDigest !== config.catalog.manifestDigest ||
    config.manifest.candidates.length !== config.catalog.candidates.length ||
    config.manifest.candidates.some(
      ({ candidateId }, index) =>
        candidateId !== config.catalog.candidates[index]?.candidateId,
    ) ||
    !Number.isInteger(concurrency) ||
    concurrency < 1 ||
    concurrency > MAXIMUM_CANDIDATE_CONCURRENCY ||
    !Number.isInteger(maximumRunMilliseconds) ||
    maximumRunMilliseconds < 1 ||
    maximumRunMilliseconds > MAXIMUM_RUN_MILLISECONDS ||
    !Number.isInteger(maximumDecodedBytes) ||
    maximumDecodedBytes < 1 ||
    maximumDecodedBytes > MAXIMUM_RUN_DECODED_BYTES ||
    !Number.isInteger(config.databaseMigrationVersion) ||
    config.databaseMigrationVersion < 3 ||
    (config.priorReceipt !== undefined &&
      (config.priorReceipt.catalogDigest !== config.catalog.manifestDigest ||
        config.priorReceipt.artifactManifestDigest !==
          config.manifest.manifestDigest))
  ) {
    throw ingestionError('ingestion.invalid-input');
  }
}

function selectCandidates(
  catalog: PublicCatalog,
  candidateIds: readonly string[] | undefined,
): readonly PublicCatalog['candidates'][number][] {
  if (candidateIds === undefined) {
    return catalog.candidates;
  }
  if (
    candidateIds.length < 1 ||
    candidateIds.length > catalog.candidates.length ||
    new Set(candidateIds).size !== candidateIds.length
  ) {
    throw ingestionError('ingestion.invalid-input');
  }
  const byId = new Map(
    catalog.candidates.map((candidate) => [candidate.candidateId, candidate]),
  );
  return candidateIds.map((candidateId) => {
    const candidate = byId.get(candidateId);
    if (candidate === undefined) {
      throw ingestionError('ingestion.invalid-input');
    }
    return candidate;
  });
}

function throwIfStopped(
  callerSignal: AbortSignal | undefined,
  deadlineSignal: AbortSignal,
): void {
  if (callerSignal?.aborted === true) {
    throw ingestionError('ingestion.cancelled');
  }
  if (deadlineSignal.aborted) {
    throw ingestionError('ingestion.deadline-exceeded');
  }
}

function failedCandidate(
  candidateId: string,
  safeErrorCode: ReturnType<typeof asSafeErrorCode>,
): ArtifactReceiptCandidate {
  return {
    candidateId,
    outcome: 'failed',
    artifactSetId: null,
    artifactCount: 0,
    chunkCount: 0,
    absenceCount: 0,
    decodedBytes: 0,
    inserted: { artifacts: 0, chunks: 0, artifactSets: 0, entries: 0 },
    materializationDigest: null,
    safeErrorCode,
  };
}

function rowCount(inserted: ArtifactReceiptCandidate['inserted']): number {
  return (
    inserted.artifacts +
    inserted.chunks +
    inserted.artifactSets +
    inserted.entries
  );
}

function emit(
  observer: IngestionObserver | undefined,
  event: Parameters<IngestionObserver>[0],
): void {
  observer?.(event);
}
