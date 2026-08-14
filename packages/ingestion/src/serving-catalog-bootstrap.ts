import {
  parseCandidateRetrievalMetadataAuthorityV1,
  parseDeterministicCandidateProfileAuthorityV1,
  type CandidateRetrievalMetadataAuthorityV1,
  type DeterministicCandidateProfileAuthorityV1,
} from '@gitblocks/contracts';
import type {
  OperationControl,
  PublishServingCatalogSnapshotCommand,
  PublishServingCatalogSnapshotResult,
  PutCatalogCandidateCommand,
  SetCandidateCapabilityFamiliesCommand,
} from '@gitblocks/persistence';

import { createPublicCatalogSeedPlan } from './catalog-seed.ts';
import { ingestionError } from './errors.ts';
import type { PublicCatalog } from './types.ts';

export interface ServingCatalogBootstrapPersistencePortV1 {
  readonly putCatalogCandidate: (
    command: PutCatalogCandidateCommand,
    control?: OperationControl,
  ) => Promise<void>;
  readonly setCandidateCapabilityFamilies: (
    command: SetCandidateCapabilityFamiliesCommand,
    control?: OperationControl,
  ) => Promise<void>;
  readonly publishServingCatalogSnapshot: (
    command: PublishServingCatalogSnapshotCommand,
    control?: OperationControl,
  ) => Promise<PublishServingCatalogSnapshotResult>;
}

export interface ServingCatalogBootstrapSummaryV1 {
  readonly schemaVersion: '1.0.0';
  readonly status: 'serving-catalog-bootstrap-complete';
  readonly publicationStatus: 'created' | 'idempotent';
  readonly databaseMigrationVersion: 7;
  readonly catalogVersion: 'public-v1';
  readonly catalogDigest: string;
  readonly snapshotId: string;
  readonly snapshotRecordDigest: string;
  readonly publishedAt: string;
  readonly candidateCount: 150;
}

export async function bootstrapServingCatalogV1(input: {
  readonly catalog: PublicCatalog;
  readonly candidateProfileAuthority: unknown;
  readonly candidateRetrievalMetadataAuthority: unknown;
  readonly publishedAt: string;
  readonly databaseMigrationVersion: unknown;
  readonly persistence: ServingCatalogBootstrapPersistencePortV1;
  readonly signal?: AbortSignal;
}): Promise<ServingCatalogBootstrapSummaryV1> {
  if (input.databaseMigrationVersion !== 7) {
    throw ingestionError('ingestion.invalid-input');
  }
  const plan = createPublicCatalogSeedPlan(input.catalog);
  const profileAuthority = requireProfileAuthority(
    input.candidateProfileAuthority,
  );
  const metadataAuthority = requireMetadataAuthority(
    input.candidateRetrievalMetadataAuthority,
  );
  requireAcceptedBindings(plan, profileAuthority, metadataAuthority);
  const control =
    input.signal === undefined
      ? undefined
      : Object.freeze({ signal: input.signal });

  for (const entry of plan.entries) {
    input.signal?.throwIfAborted();
    await input.persistence.putCatalogCandidate(
      { identity: entry.identity, createdAt: entry.createdAt },
      control,
    );
    input.signal?.throwIfAborted();
    await input.persistence.setCandidateCapabilityFamilies(
      {
        candidateId: entry.identity.candidateId,
        capabilityFamilies: entry.capabilityFamilies,
      },
      control,
    );
  }

  input.signal?.throwIfAborted();
  const publication = await input.persistence.publishServingCatalogSnapshot(
    {
      candidateProfileAuthority: profileAuthority,
      candidateRetrievalMetadataAuthority: metadataAuthority,
      publishedAt: input.publishedAt,
    },
    control,
  );
  return Object.freeze({
    schemaVersion: '1.0.0',
    status: 'serving-catalog-bootstrap-complete',
    publicationStatus: publication.status,
    databaseMigrationVersion: 7,
    catalogVersion: plan.catalogVersion,
    catalogDigest: plan.catalogDigest,
    snapshotId: publication.snapshotId,
    snapshotRecordDigest: publication.snapshotRecordDigest,
    publishedAt: publication.publishedAt,
    candidateCount: 150,
  });
}

function requireProfileAuthority(
  input: unknown,
): DeterministicCandidateProfileAuthorityV1 {
  const parsed = parseDeterministicCandidateProfileAuthorityV1(input);
  if (!parsed.ok) throw ingestionError('ingestion.invalid-input');
  return parsed.value;
}

function requireMetadataAuthority(
  input: unknown,
): CandidateRetrievalMetadataAuthorityV1 {
  const parsed = parseCandidateRetrievalMetadataAuthorityV1(input);
  if (!parsed.ok) throw ingestionError('ingestion.invalid-input');
  return parsed.value;
}

function requireAcceptedBindings(
  plan: ReturnType<typeof createPublicCatalogSeedPlan>,
  profiles: DeterministicCandidateProfileAuthorityV1,
  metadata: CandidateRetrievalMetadataAuthorityV1,
): void {
  const expectedCandidateIds = plan.entries.map(
    ({ identity }) => identity.candidateId,
  );
  if (
    profiles.catalogVersion !== plan.catalogVersion ||
    profiles.catalogDigest !== plan.catalogDigest ||
    metadata.catalogVersion !== plan.catalogVersion ||
    metadata.catalogDigest !== plan.catalogDigest ||
    profiles.profiles.length !== plan.candidateCount ||
    metadata.candidates.length !== plan.candidateCount ||
    expectedCandidateIds.some(
      (candidateId, index) =>
        profiles.profiles[index]?.candidateId !== candidateId ||
        metadata.candidates[index]?.candidateId !== candidateId,
    )
  ) {
    throw ingestionError('ingestion.invalid-input');
  }
}
