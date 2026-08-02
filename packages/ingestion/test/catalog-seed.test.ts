import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it, vi } from 'vitest';

import {
  createPublicCatalogSeedPlan,
  parsePublicCatalog,
  seedPublicCatalogV1,
  type CatalogSeedPersistencePort,
  type PublicCatalog,
} from '../src/index.ts';

const CATALOG_PATH = fileURLToPath(
  new URL('../../../catalog/public-v1/manifest.json', import.meta.url),
);
const CATALOG_DIGEST =
  '4819dd94cb1bbe5e27c31ca5ca55976da1442987a792bf438d96681021cb8634';

let catalog: PublicCatalog;

beforeAll(async () => {
  catalog = parsePublicCatalog(await readFile(CATALOG_PATH, 'utf8'));
});

describe('public catalog seed planning', () => {
  it('owns and freezes the complete canonical 150-candidate plan', () => {
    const plan = createPublicCatalogSeedPlan(catalog);
    const candidateIds = plan.entries.map(
      (entry) => entry.identity.candidateId,
    );

    expect(plan).toMatchObject({
      catalogVersion: 'public-v1',
      catalogDigest: CATALOG_DIGEST,
      candidateCount: 150,
    });
    expect(plan.entries).toHaveLength(150);
    expect(candidateIds).toEqual([...candidateIds].sort());
    expect(new Set(candidateIds).size).toBe(150);
    expect(plan.entries.every((entry) => Object.isFrozen(entry))).toBe(true);
    expect(Object.isFrozen(plan)).toBe(true);
    expect(Object.isFrozen(plan.entries)).toBe(true);
  });

  it('uses introducedAt as createdAt and retains no mutable catalog references', () => {
    const source = parsePublicCatalog(JSON.stringify(catalog));
    const plan = createPublicCatalogSeedPlan(source);
    const firstSource = source.candidates[0]!;
    const firstPlan = plan.entries[0]!;
    const originalIdentity = structuredClone(firstPlan.identity);
    const originalFamilies = [...firstPlan.capabilityFamilies];

    const mutableSource = firstSource as unknown as {
      displayName: string;
      github: { owner: string };
      additionalCapabilityFamilies: string[];
    };
    mutableSource.displayName = 'changed after planning';
    mutableSource.github.owner = 'changed-after-planning';
    mutableSource.additionalCapabilityFamilies.push('webhooks');

    expect(firstPlan.identity).toEqual(originalIdentity);
    expect(firstPlan.capabilityFamilies).toEqual(originalFamilies);
    expect(firstPlan.createdAt).toBe(firstSource.introducedAt);
  });

  it('rejects invalid or non-authoritative catalogs during complete planning', () => {
    expect(() =>
      createPublicCatalogSeedPlan({
        ...catalog,
        manifestDigest: '0'.repeat(64),
      }),
    ).toThrow();
    expect(() =>
      createPublicCatalogSeedPlan({
        ...catalog,
        candidates: catalog.candidates.slice(0, 149),
      }),
    ).toThrow();
  });
});

describe('public catalog seed persistence composition', () => {
  it('performs exactly one candidate put and family set per candidate in canonical order', async () => {
    const persistence = port();
    const summary = await seedPublicCatalogV1({
      catalog,
      databaseMigrationVersion: 4,
      persistence,
    });
    const plan = createPublicCatalogSeedPlan(catalog);

    expect(persistence.putCatalogCandidate).toHaveBeenCalledTimes(150);
    expect(persistence.setCandidateCapabilityFamilies).toHaveBeenCalledTimes(
      150,
    );
    for (const [index, entry] of plan.entries.entries()) {
      expect(persistence.putCatalogCandidate).toHaveBeenNthCalledWith(
        index + 1,
        { identity: entry.identity, createdAt: entry.createdAt },
        undefined,
      );
      expect(
        persistence.setCandidateCapabilityFamilies,
      ).toHaveBeenNthCalledWith(
        index + 1,
        {
          candidateId: entry.identity.candidateId,
          capabilityFamilies: entry.capabilityFamilies,
        },
        undefined,
      );
    }
    expect(summary).toEqual({
      schemaVersion: '1.0.0',
      status: 'catalog-seed-complete',
      catalogVersion: 'public-v1',
      catalogDigest: CATALOG_DIGEST,
      databaseMigrationVersion: 4,
      candidateCount: 150,
      capabilityFamilyAssignmentCount: plan.capabilityFamilyAssignmentCount,
    });
    expect(Object.isFrozen(summary)).toBe(true);
  });

  it('validates the complete plan before making the first persistence call', async () => {
    const persistence = port();

    await expect(
      seedPublicCatalogV1({
        catalog: { ...catalog, manifestDigest: '0'.repeat(64) },
        databaseMigrationVersion: 4,
        persistence,
      }),
    ).rejects.toThrow();
    expect(persistence.putCatalogCandidate).not.toHaveBeenCalled();
    expect(persistence.setCandidateCapabilityFamilies).not.toHaveBeenCalled();
  });

  it.each([3, 5])(
    'rejects migration %i before the first write',
    async (databaseMigrationVersion) => {
      const persistence = port();
      await expect(
        seedPublicCatalogV1({
          catalog,
          databaseMigrationVersion,
          persistence,
        }),
      ).rejects.toThrow();
      expect(persistence.putCatalogCandidate).not.toHaveBeenCalled();
      expect(persistence.setCandidateCapabilityFamilies).not.toHaveBeenCalled();
    },
  );

  it('stops on the first persistence failure without a success summary or later calls', async () => {
    const failure = new Error('synthetic persistence failure');
    const persistence = port({ failPutAt: 3, failure });

    await expect(
      seedPublicCatalogV1({
        catalog,
        databaseMigrationVersion: 4,
        persistence,
      }),
    ).rejects.toBe(failure);
    expect(persistence.putCatalogCandidate).toHaveBeenCalledTimes(3);
    expect(persistence.setCandidateCapabilityFamilies).toHaveBeenCalledTimes(2);
  });

  it('permits an exact idempotent rerun through the same narrow operations', async () => {
    const persistence = port();
    const first = await seedPublicCatalogV1({
      catalog,
      databaseMigrationVersion: 4,
      persistence,
    });
    const second = await seedPublicCatalogV1({
      catalog,
      databaseMigrationVersion: 4,
      persistence,
    });

    expect(second).toEqual(first);
    expect(persistence.putCatalogCandidate).toHaveBeenCalledTimes(300);
    expect(persistence.setCandidateCapabilityFamilies).toHaveBeenCalledTimes(
      300,
    );
  });
});

function port(options?: {
  readonly failPutAt: number;
  readonly failure: Error;
}): CatalogSeedPersistencePort & {
  readonly putCatalogCandidate: ReturnType<typeof vi.fn>;
  readonly setCandidateCapabilityFamilies: ReturnType<typeof vi.fn>;
} {
  let puts = 0;
  return {
    putCatalogCandidate: vi.fn(() => {
      puts += 1;
      return puts === options?.failPutAt
        ? Promise.reject(options.failure)
        : Promise.resolve();
    }),
    setCandidateCapabilityFamilies: vi.fn(() => Promise.resolve()),
  };
}
