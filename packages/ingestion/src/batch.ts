import type { PersistenceClient } from '@gitblocks/persistence';

import { StableIdRegistry } from './canonical-json.ts';
import { asSafeErrorCode, ingestionError } from './errors.ts';
import { loadPriorMaterial, persistCandidateProfile } from './persist.ts';
import { profileCandidate } from './profile.ts';
import {
  collectCandidateSources,
  type PublicProviderConfig,
} from './providers.ts';
import { createIngestionReceipt } from './receipt.ts';
import type {
  Clock,
  IngestionObserver,
  IngestionReceipt,
  IngestionReceiptCandidate,
  PublicCatalog,
} from './types.ts';

export interface IngestCatalogConfig {
  readonly catalog: PublicCatalog;
  readonly persistence: PersistenceClient;
  readonly provider: Omit<PublicProviderConfig, 'correlationId' | 'signal'>;
  readonly clock: Clock;
  readonly observer?: IngestionObserver;
  readonly candidateConcurrency?: number;
  readonly maximumRunMilliseconds?: number;
  readonly databaseMigrationVersion: number;
  readonly candidateIds?: readonly string[];
  readonly priorReceipt?: IngestionReceipt;
  readonly signal?: AbortSignal;
}

export async function ingestPublicCatalog(
  config: IngestCatalogConfig,
): Promise<IngestionReceipt> {
  const candidateConcurrency = config.candidateConcurrency ?? 3;
  const maximumRunMilliseconds = config.maximumRunMilliseconds ?? 60 * 60_000;
  if (
    !Number.isInteger(candidateConcurrency) ||
    candidateConcurrency < 1 ||
    candidateConcurrency > 3 ||
    !Number.isInteger(maximumRunMilliseconds) ||
    maximumRunMilliseconds < 1 ||
    maximumRunMilliseconds > 60 * 60_000 ||
    !Number.isInteger(config.databaseMigrationVersion) ||
    config.databaseMigrationVersion < 1
  ) {
    throw ingestionError('ingestion.invalid-input');
  }
  const candidates = selectCandidates(config.catalog, config.candidateIds);
  if (
    config.priorReceipt !== undefined &&
    config.priorReceipt.catalogDigest !== config.catalog.manifestDigest
  ) {
    throw ingestionError('ingestion.invalid-input');
  }
  const startedAt = config.clock.now().toISOString();
  const runId = new StableIdRegistry().create('run', {
    catalogDigest: config.catalog.manifestDigest,
    startedAt,
  });
  const deadline = AbortSignal.timeout(maximumRunMilliseconds);
  const signal =
    config.signal === undefined
      ? deadline
      : AbortSignal.any([config.signal, deadline]);
  config.observer?.({
    eventName: 'ingestion.batch',
    correlationId: runId,
    candidateId: null,
    provider: null,
    operation: 'catalog',
    outcome: 'started',
    attempt: null,
    durationMilliseconds: null,
    safeErrorCode: null,
  });

  const results: (IngestionReceiptCandidate | undefined)[] = Array.from(
    { length: candidates.length },
    () => undefined,
  );
  let nextIndex = 0;
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
        const candidateSignal = AbortSignal.any([
          signal,
          AbortSignal.timeout(90_000),
        ]);
        const collectedAt = config.clock.now().toISOString();
        const prior = await loadPriorMaterial(
          config.persistence,
          candidate.candidateId,
          collectedAt,
          candidateSignal,
        );
        const bundle = await collectCandidateSources(candidate, collectedAt, {
          ...config.provider,
          correlationId: runId,
          signal: candidateSignal,
        });
        const profile = profileCandidate(bundle, prior.observations);
        const result = await persistCandidateProfile(
          config.persistence,
          profile,
          prior,
          config.catalog.publishedAt,
          bundle.incompleteSourceCodes,
          candidateSignal,
        );
        results[index] = result;
        config.observer?.({
          eventName: 'ingestion.candidate',
          correlationId: runId,
          candidateId: candidate.candidateId,
          provider: 'persistence',
          operation: 'profile',
          outcome: result.outcome === 'partial' ? 'partial' : 'succeeded',
          attempt: null,
          durationMilliseconds: Math.round(
            performance.now() - candidateStarted,
          ),
          safeErrorCode: null,
        });
      } catch (error) {
        const safeErrorCode = asSafeErrorCode(error);
        results[index] = {
          candidateId: candidate.candidateId,
          outcome: 'failed',
          snapshotId: null,
          evidenceAppended: 0,
          evidenceIdempotent: 0,
          evidenceSuperseded: 0,
          evidenceInvalidated: 0,
          limitationCount: 0,
          unknownCount: 0,
          candidateState: null,
          snapshotState: null,
          incompleteSourceCodes: [],
          safeErrorCode,
        };
        config.observer?.({
          eventName: 'ingestion.candidate',
          correlationId: runId,
          candidateId: candidate.candidateId,
          provider: null,
          operation: 'profile',
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
      {
        length: Math.min(candidateConcurrency, candidates.length),
      },
      worker,
    ),
  );
  const completedAt = config.clock.now().toISOString();
  const receipt = createIngestionReceipt({
    catalog: config.catalog,
    runId,
    startedAt,
    completedAt,
    candidates: results.filter(
      (result): result is IngestionReceiptCandidate => result !== undefined,
    ),
    providerMetrics: config.provider.transport.getMetrics?.() ?? {
      providerRequestCounts: { github: 0, npm: 0 },
      githubRateLimit: null,
    },
    databaseMigrationVersion: config.databaseMigrationVersion,
    requestedCandidateCount: candidates.length,
    ...(config.priorReceipt === undefined
      ? {}
      : { priorReceipt: config.priorReceipt }),
  });
  config.observer?.({
    eventName: 'ingestion.batch',
    correlationId: runId,
    candidateId: null,
    provider: null,
    operation: 'catalog',
    outcome: receipt.outcomeCounts.failed > 0 ? 'partial' : 'succeeded',
    attempt: null,
    durationMilliseconds: Date.parse(completedAt) - Date.parse(startedAt),
    safeErrorCode: null,
  });
  return receipt;
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
