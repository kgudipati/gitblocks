import type {
  OperationControl,
  PutCatalogCandidateCommand,
  SetCandidateCapabilityFamiliesCommand,
} from '@gitblocks/persistence';

import { canonicalizeJson } from './canonical-json.ts';
import {
  catalogCandidateCapabilityFamilies,
  catalogCandidateIdentity,
} from './catalog-persistence.ts';
import { ingestionError } from './errors.ts';
import { parsePublicCatalog } from './manifest.ts';
import type { PublicCatalog } from './types.ts';

export const PUBLIC_CATALOG_V1_DIGEST =
  '4819dd94cb1bbe5e27c31ca5ca55976da1442987a792bf438d96681021cb8634';
export const PUBLIC_CATALOG_V1_CANDIDATE_COUNT = 150;

export interface CatalogSeedPersistencePort {
  readonly putCatalogCandidate: (
    command: PutCatalogCandidateCommand,
    control?: OperationControl,
  ) => Promise<void>;
  readonly setCandidateCapabilityFamilies: (
    command: SetCandidateCapabilityFamiliesCommand,
    control?: OperationControl,
  ) => Promise<void>;
}

export interface PublicCatalogSeedEntry {
  readonly identity: ReturnType<typeof catalogCandidateIdentity>;
  readonly capabilityFamilies: ReturnType<
    typeof catalogCandidateCapabilityFamilies
  >;
  readonly createdAt: string;
}

export interface PublicCatalogSeedPlan {
  readonly catalogVersion: 'public-v1';
  readonly catalogDigest: string;
  readonly candidateCount: number;
  readonly capabilityFamilyAssignmentCount: number;
  readonly entries: readonly PublicCatalogSeedEntry[];
}

export interface PublicCatalogSeedSummaryV1 {
  readonly schemaVersion: '1.0.0';
  readonly status: 'catalog-seed-complete';
  readonly catalogVersion: 'public-v1';
  readonly catalogDigest: string;
  readonly databaseMigrationVersion: 4;
  readonly candidateCount: number;
  readonly capabilityFamilyAssignmentCount: number;
}

export function createPublicCatalogSeedPlan(
  catalog: PublicCatalog,
): PublicCatalogSeedPlan {
  const validated = parsePublicCatalog(canonicalizeJson(catalog).text);
  if (
    validated.manifestDigest !== PUBLIC_CATALOG_V1_DIGEST ||
    validated.candidates.length !== PUBLIC_CATALOG_V1_CANDIDATE_COUNT
  ) {
    throw ingestionError('ingestion.invalid-manifest');
  }

  const entries = validated.candidates.map((candidate) =>
    Object.freeze({
      identity: catalogCandidateIdentity(candidate),
      capabilityFamilies: catalogCandidateCapabilityFamilies(candidate),
      createdAt: candidate.introducedAt,
    }),
  );
  const candidateIds = entries.map((entry) => entry.identity.candidateId);
  const canonicalCandidateIds = [...candidateIds].sort((left, right) =>
    left.localeCompare(right),
  );
  if (
    entries.length !== validated.candidates.length ||
    new Set(candidateIds).size !== candidateIds.length ||
    candidateIds.some(
      (candidateId, index) => candidateId !== canonicalCandidateIds[index],
    )
  ) {
    throw ingestionError('ingestion.invalid-manifest');
  }

  const ownedEntries = Object.freeze([...entries]);
  return Object.freeze({
    catalogVersion: 'public-v1',
    catalogDigest: validated.manifestDigest,
    candidateCount: ownedEntries.length,
    capabilityFamilyAssignmentCount: ownedEntries.reduce(
      (count, entry) => count + entry.capabilityFamilies.length,
      0,
    ),
    entries: ownedEntries,
  });
}

export async function seedPublicCatalogV1(input: {
  readonly catalog: PublicCatalog;
  readonly databaseMigrationVersion: unknown;
  readonly persistence: CatalogSeedPersistencePort;
  readonly signal?: AbortSignal;
}): Promise<PublicCatalogSeedSummaryV1> {
  if (input.databaseMigrationVersion !== 4) {
    throw ingestionError('ingestion.invalid-input');
  }
  const plan = createPublicCatalogSeedPlan(input.catalog);
  const control =
    input.signal === undefined
      ? undefined
      : Object.freeze({ signal: input.signal });

  for (const entry of plan.entries) {
    input.signal?.throwIfAborted();
    await input.persistence.putCatalogCandidate(
      {
        identity: entry.identity,
        createdAt: entry.createdAt,
      },
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

  return Object.freeze({
    schemaVersion: '1.0.0',
    status: 'catalog-seed-complete',
    catalogVersion: plan.catalogVersion,
    catalogDigest: plan.catalogDigest,
    databaseMigrationVersion: 4,
    candidateCount: plan.candidateCount,
    capabilityFamilyAssignmentCount: plan.capabilityFamilyAssignmentCount,
  });
}
