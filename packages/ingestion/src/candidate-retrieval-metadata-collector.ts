import {
  CANDIDATE_RETRIEVAL_METADATA_CANDIDATE_COUNT,
  createCandidateRetrievalMetadataAuthorityV1,
  type CandidateRetrievalMetadataAuthorityV1,
  type CandidateRetrievalMetadataRecordInputV1,
} from '@gitblocks/contracts';

import type { CandidateRetrievalMetadataCollectionEnvelope } from './candidate-retrieval-metadata-policy.ts';
import { IngestionError, ingestionError } from './errors.ts';
import { requireTimestamp } from './json-boundary.ts';
import {
  collectCandidateRetrievalRepositoryMetadata,
  type ProfileMaterializationProviderConfig,
} from './profile-materialization-providers.ts';
import type { ProfileMaterializationProviderPolicy } from './profile-materialization-contracts.ts';
import type { ProviderTransport } from './providers.ts';
import type { PublicCatalog } from './types.ts';

export interface CandidateRetrievalMetadataCollectorConfig {
  readonly transport: ProviderTransport;
  readonly sourceProviderPolicy: ProfileMaterializationProviderPolicy;
  readonly collectionEnvelope: CandidateRetrievalMetadataCollectionEnvelope;
  readonly githubToken: string;
  readonly correlationId: string;
  readonly collectedAt: string;
  readonly signal?: AbortSignal;
}

export async function collectCandidateRetrievalMetadataAuthority(
  catalog: PublicCatalog,
  config: CandidateRetrievalMetadataCollectorConfig,
): Promise<CandidateRetrievalMetadataAuthorityV1> {
  const collectedAt = requireTimestamp(config.collectedAt);
  validateCollectionInputs(catalog, config);
  const operation = config.collectionEnvelope.sourceOperation;
  const runDeadline = AbortSignal.timeout(operation.runDeadlineMilliseconds);
  const failureCancellation = new AbortController();
  const runSignal = AbortSignal.any([
    runDeadline,
    failureCancellation.signal,
    ...(config.signal === undefined ? [] : [config.signal]),
  ]);
  const records: CandidateRetrievalMetadataRecordInputV1[] = [];
  let nextIndex = 0;
  const workers = Array.from({ length: operation.concurrency }, async () => {
    for (;;) {
      const index = nextIndex;
      nextIndex += 1;
      const candidate = catalog.candidates[index];
      if (candidate === undefined) return;
      try {
        const candidateDeadline = AbortSignal.timeout(
          operation.candidateDeadlineMilliseconds,
        );
        const candidateSignal = AbortSignal.any([runSignal, candidateDeadline]);
        const repository = await collectCandidateRetrievalRepositoryMetadata(
          candidate,
          {
            transport: config.transport,
            policy: config.sourceProviderPolicy,
            githubToken: config.githubToken,
            correlationId: config.correlationId,
            signal: candidateSignal,
            deadlineSignal: runSignal,
          } satisfies ProfileMaterializationProviderConfig,
        );
        records.push({
          candidateId: candidate.candidateId,
          catalogOwner: candidate.github.owner,
          catalogRepository: candidate.github.repository,
          providerCanonicalOwner: repository.canonicalOwner,
          providerCanonicalRepository: repository.canonicalRepository,
          description: repository.description,
          topics: repository.topics,
          primaryLanguage: repository.primaryLanguage,
        });
      } catch (error) {
        failureCancellation.abort();
        throw error instanceof IngestionError
          ? error
          : ingestionError('ingestion.internal-invariant');
      }
    }
  });
  await Promise.all(workers);
  const policy = config.collectionEnvelope.policy;
  try {
    return createCandidateRetrievalMetadataAuthorityV1({
      catalogVersion: catalog.catalogVersion,
      catalogDigest: catalog.manifestDigest,
      providerPolicyVersion: policy.policyVersion,
      providerPolicyDigest: policy.policySemanticDigest,
      sourceProviderPolicyVersion:
        policy.sourceProviderPolicyBinding.policyVersion,
      sourceProviderPolicyDigest:
        policy.sourceProviderPolicyBinding.policyDigest,
      sourceOperation: policy.allowedOperations[0],
      collectedAt,
      candidates: records,
    });
  } catch {
    throw ingestionError('ingestion.invalid-manifest');
  }
}

function validateCollectionInputs(
  catalog: PublicCatalog,
  config: CandidateRetrievalMetadataCollectorConfig,
): void {
  const policy = config.collectionEnvelope.policy;
  const candidateIds = new Set<string>();
  const repositories = new Set<string>();
  if (
    catalog.candidates.length !==
      CANDIDATE_RETRIEVAL_METADATA_CANDIDATE_COUNT ||
    policy.catalogBinding.catalogDigest !== catalog.manifestDigest ||
    policy.sourceProviderPolicyBinding.policyDigest !==
      config.sourceProviderPolicy.policySemanticDigest ||
    config.githubToken.length < 1 ||
    config.githubToken.length > 4_096 ||
    config.correlationId.length < 1 ||
    config.correlationId.length > 128
  ) {
    throw ingestionError('ingestion.invalid-input');
  }
  for (const candidate of catalog.candidates) {
    const repository =
      `${candidate.github.owner}/${candidate.github.repository}`.toLowerCase();
    if (
      candidateIds.has(candidate.candidateId) ||
      repositories.has(repository)
    ) {
      throw ingestionError('ingestion.invalid-manifest');
    }
    candidateIds.add(candidate.candidateId);
    repositories.add(repository);
  }
}
