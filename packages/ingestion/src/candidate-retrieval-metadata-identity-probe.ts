import { CANDIDATE_RETRIEVAL_METADATA_CANDIDATE_COUNT } from '@gitblocks/contracts';

import { IngestionError, ingestionError } from './errors.ts';
import type { ProfileMaterializationProviderPolicy } from './profile-materialization-contracts.ts';
import {
  observeProfileMaterializationRepositoryMetadata,
  type ProfileMaterializationProviderConfig,
} from './profile-materialization-providers.ts';
import type { ProviderTransport } from './providers.ts';
import type { PublicCatalog } from './types.ts';

export const CANDIDATE_RETRIEVAL_METADATA_IDENTITY_PROBE_OPERATION =
  'candidate-retrieval-metadata-identity-probe' as const;

export interface CandidateRetrievalMetadataIdentityProbeAttemptMetrics {
  readonly requestAttempts: number;
  readonly retries: number;
}

export interface CandidateRetrievalMetadataIdentityProbeConfig {
  readonly transport: ProviderTransport;
  readonly sourceProviderPolicy: ProfileMaterializationProviderPolicy;
  readonly githubToken: string;
  readonly correlationId: string;
  readonly concurrency: number;
  readonly candidateDeadlineMilliseconds: number;
  readonly runDeadlineMilliseconds: number;
  readonly readAttemptMetrics: () => CandidateRetrievalMetadataIdentityProbeAttemptMetrics;
  readonly signal?: AbortSignal;
}

export type CandidateRetrievalMetadataIdentityDifferenceState =
  'redirected' | 'non-public' | 'failed';

export interface CandidateRetrievalMetadataIdentityDifference {
  readonly candidateId: string;
  readonly catalogOwner: string;
  readonly catalogRepository: string;
  readonly catalogStatus: PublicCatalog['candidates'][number]['status'];
  readonly providerCanonicalOwner: string | null;
  readonly providerCanonicalRepository: string | null;
  readonly identityState: CandidateRetrievalMetadataIdentityDifferenceState;
}

export interface CandidateRetrievalMetadataIdentityProbeResult {
  readonly status: 'passed';
  readonly operation: typeof CANDIDATE_RETRIEVAL_METADATA_IDENTITY_PROBE_OPERATION;
  readonly requestedCandidates: typeof CANDIDATE_RETRIEVAL_METADATA_CANDIDATE_COUNT;
  readonly completedCandidates: number;
  readonly failedCandidates: number;
  readonly unchangedCount: number;
  readonly redirectedCount: number;
  readonly nonPublicCount: number;
  readonly providerCanonicalDuplicateCount: number;
  readonly logicalRequests: number;
  readonly requestAttempts: number;
  readonly retries: number;
  readonly identityDifferences: readonly CandidateRetrievalMetadataIdentityDifference[];
}

type IdentityObservation =
  | {
      readonly candidateId: string;
      readonly catalogOwner: string;
      readonly catalogRepository: string;
      readonly catalogStatus: PublicCatalog['candidates'][number]['status'];
      readonly providerCanonicalOwner: string;
      readonly providerCanonicalRepository: string;
      readonly isPublic: boolean;
      readonly identityState: 'unchanged' | 'redirected' | 'non-public';
    }
  | {
      readonly candidateId: string;
      readonly catalogOwner: string;
      readonly catalogRepository: string;
      readonly catalogStatus: PublicCatalog['candidates'][number]['status'];
      readonly providerCanonicalOwner: null;
      readonly providerCanonicalRepository: null;
      readonly isPublic: null;
      readonly identityState: 'failed';
    };

export async function probeCandidateRetrievalMetadataIdentities(
  catalog: PublicCatalog,
  config: CandidateRetrievalMetadataIdentityProbeConfig,
): Promise<CandidateRetrievalMetadataIdentityProbeResult> {
  validateProbeInputs(catalog, config);
  const runDeadline = AbortSignal.timeout(config.runDeadlineMilliseconds);
  const runSignal = AbortSignal.any([
    runDeadline,
    ...(config.signal === undefined ? [] : [config.signal]),
  ]);
  const observations: IdentityObservation[] = [];
  let nextIndex = 0;
  let logicalRequests = 0;
  const workers = Array.from({ length: config.concurrency }, async () => {
    for (;;) {
      if (runSignal.aborted) throw ingestionError('ingestion.cancelled');
      const index = nextIndex;
      nextIndex += 1;
      const candidate = catalog.candidates[index];
      if (candidate === undefined) return;
      logicalRequests += 1;
      const candidateDeadline = AbortSignal.timeout(
        config.candidateDeadlineMilliseconds,
      );
      const candidateSignal = AbortSignal.any([runSignal, candidateDeadline]);
      try {
        const repository =
          await observeProfileMaterializationRepositoryMetadata(candidate, {
            transport: config.transport,
            policy: config.sourceProviderPolicy,
            githubToken: config.githubToken,
            correlationId: config.correlationId,
            signal: candidateSignal,
            deadlineSignal: runSignal,
          } satisfies ProfileMaterializationProviderConfig);
        const redirected =
          repositoryIdentityKey(
            candidate.github.owner,
            candidate.github.repository,
          ) !==
          repositoryIdentityKey(
            repository.canonicalOwner,
            repository.canonicalRepository,
          );
        observations.push({
          candidateId: candidate.candidateId,
          catalogOwner: candidate.github.owner,
          catalogRepository: candidate.github.repository,
          catalogStatus: candidate.status,
          providerCanonicalOwner: repository.canonicalOwner,
          providerCanonicalRepository: repository.canonicalRepository,
          isPublic: repository.isPublic,
          identityState: repository.isPublic
            ? redirected
              ? 'redirected'
              : 'unchanged'
            : 'non-public',
        });
      } catch (error) {
        if (isSignalAborted(runSignal)) {
          throw error instanceof IngestionError
            ? error
            : ingestionError('ingestion.internal-invariant');
        }
        observations.push({
          candidateId: candidate.candidateId,
          catalogOwner: candidate.github.owner,
          catalogRepository: candidate.github.repository,
          catalogStatus: candidate.status,
          providerCanonicalOwner: null,
          providerCanonicalRepository: null,
          isPublic: null,
          identityState: 'failed',
        });
      }
    }
  });
  await Promise.all(workers);
  observations.sort((left, right) =>
    compareAscii(left.candidateId, right.candidateId),
  );
  const attemptMetrics = config.readAttemptMetrics();
  validateProbeResultBounds(logicalRequests, attemptMetrics);
  const providerIdentityCounts = new Map<string, number>();
  for (const observation of observations) {
    if (observation.providerCanonicalOwner === null) continue;
    const key = repositoryIdentityKey(
      observation.providerCanonicalOwner,
      observation.providerCanonicalRepository,
    );
    providerIdentityCounts.set(key, (providerIdentityCounts.get(key) ?? 0) + 1);
  }
  const identityDifferences: CandidateRetrievalMetadataIdentityDifference[] =
    [];
  for (const observation of observations) {
    if (observation.identityState === 'unchanged') continue;
    identityDifferences.push({
      candidateId: observation.candidateId,
      catalogOwner: observation.catalogOwner,
      catalogRepository: observation.catalogRepository,
      catalogStatus: observation.catalogStatus,
      providerCanonicalOwner: observation.providerCanonicalOwner,
      providerCanonicalRepository: observation.providerCanonicalRepository,
      identityState: observation.identityState,
    });
  }
  return deepFreeze({
    status: 'passed',
    operation: CANDIDATE_RETRIEVAL_METADATA_IDENTITY_PROBE_OPERATION,
    requestedCandidates: CANDIDATE_RETRIEVAL_METADATA_CANDIDATE_COUNT,
    completedCandidates: observations.filter(
      ({ identityState }) => identityState !== 'failed',
    ).length,
    failedCandidates: observations.filter(
      ({ identityState }) => identityState === 'failed',
    ).length,
    unchangedCount: observations.filter(
      ({ identityState }) => identityState === 'unchanged',
    ).length,
    redirectedCount: observations.filter(
      ({ identityState }) => identityState === 'redirected',
    ).length,
    nonPublicCount: observations.filter(
      ({ identityState }) => identityState === 'non-public',
    ).length,
    providerCanonicalDuplicateCount: [
      ...providerIdentityCounts.values(),
    ].filter((count) => count > 1).length,
    logicalRequests,
    requestAttempts: attemptMetrics.requestAttempts,
    retries: attemptMetrics.retries,
    identityDifferences,
  });
}

function isSignalAborted(signal: AbortSignal): boolean {
  return signal.aborted;
}

function validateProbeInputs(
  catalog: PublicCatalog,
  config: CandidateRetrievalMetadataIdentityProbeConfig,
): void {
  if (
    catalog.candidates.length !==
      CANDIDATE_RETRIEVAL_METADATA_CANDIDATE_COUNT ||
    config.githubToken.length < 1 ||
    config.githubToken.length > 4_096 ||
    config.correlationId.length < 1 ||
    config.correlationId.length > 128 ||
    !Number.isSafeInteger(config.concurrency) ||
    config.concurrency < 1 ||
    config.concurrency > 3 ||
    !Number.isSafeInteger(config.candidateDeadlineMilliseconds) ||
    config.candidateDeadlineMilliseconds < 1 ||
    !Number.isSafeInteger(config.runDeadlineMilliseconds) ||
    config.runDeadlineMilliseconds < 1
  ) {
    throw ingestionError('ingestion.invalid-input');
  }
}

function validateProbeResultBounds(
  logicalRequests: number,
  metrics: CandidateRetrievalMetadataIdentityProbeAttemptMetrics,
): void {
  if (
    logicalRequests !== CANDIDATE_RETRIEVAL_METADATA_CANDIDATE_COUNT ||
    !Number.isSafeInteger(metrics.requestAttempts) ||
    metrics.requestAttempts < 0 ||
    metrics.requestAttempts >
      CANDIDATE_RETRIEVAL_METADATA_CANDIDATE_COUNT * 3 ||
    !Number.isSafeInteger(metrics.retries) ||
    metrics.retries < 0 ||
    metrics.retries > metrics.requestAttempts
  ) {
    throw ingestionError('ingestion.internal-invariant');
  }
}

function repositoryIdentityKey(owner: string, repository: string): string {
  return `${owner}/${repository}`.toLowerCase();
}

function compareAscii(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) deepFreeze(nested);
  }
  return value;
}
