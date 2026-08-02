import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import type {
  MigrationVerification,
  PersistenceClient,
} from '@gitblocks/persistence';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import {
  runCatalogSeedCliV1,
  type CatalogSeedCliDependenciesV1,
} from '../scripts/catalog-seed-command.ts';

const CATALOG_PATH = '/explicit/catalog.json';
const CATALOG_DIGEST =
  '4819dd94cb1bbe5e27c31ca5ca55976da1442987a792bf438d96681021cb8634';
const CLIENT = Object.freeze({
  kind: 'gitblocks-postgresql-persistence' as const,
}) as PersistenceClient;

let catalogText: string;

beforeAll(async () => {
  catalogText = await readFile(
    fileURLToPath(
      new URL('../../../catalog/public-v1/manifest.json', import.meta.url),
    ),
    'utf8',
  );
});

describe('catalog seed CLI authority', () => {
  it('requires the explicit catalogue path before database construction', async () => {
    const fixture = dependencies();
    expect(await runCatalogSeedCliV1([], fixture.dependencies)).toBe(1);
    expect(fixture.createClient).not.toHaveBeenCalled();
    expect(fixture.output).toEqual([]);
    expect(fixture.errors).toEqual(['Catalog seed failed.\n']);
  });

  it('requires exact acknowledgement and scope before database construction', async () => {
    for (const overrides of [
      { GITBLOCKS_CATALOG_SEED_ACKNOWLEDGEMENT: undefined },
      { GITBLOCKS_CATALOG_SEED_DB_SCOPE: 'other' },
    ]) {
      const fixture = dependencies(overrides);
      expect(
        await runCatalogSeedCliV1(
          ['--catalog', CATALOG_PATH],
          fixture.dependencies,
        ),
      ).toBe(1);
      expect(fixture.createClient).not.toHaveBeenCalled();
      expect(fixture.putCandidate).not.toHaveBeenCalled();
      expect(fixture.output).toEqual([]);
      expect(fixture.errors).toEqual(['Catalog seed failed.\n']);
    }
  });

  it('fails safely when required database configuration is missing', async () => {
    const fixture = dependencies({ GITBLOCKS_CATALOG_SEED_DB_HOST: undefined });
    expect(
      await runCatalogSeedCliV1(
        ['--catalog', CATALOG_PATH],
        fixture.dependencies,
      ),
    ).toBe(1);
    expect(fixture.createClient).not.toHaveBeenCalled();
    expect(fixture.output).toEqual([]);
    expect(fixture.errors).toEqual(['Catalog seed failed.\n']);
  });

  it('rejects an invalid catalog before database construction or seed calls', async () => {
    const fixture = dependencies({}, { catalogText: '{}' });
    expect(
      await runCatalogSeedCliV1(
        ['--catalog', CATALOG_PATH],
        fixture.dependencies,
      ),
    ).toBe(1);
    expect(fixture.createClient).not.toHaveBeenCalled();
    expect(fixture.putCandidate).not.toHaveBeenCalled();
  });

  it.each([3, 5])(
    'rejects verified migration %i before seed calls',
    async (version) => {
      const fixture = dependencies({}, { migrationVersion: version });
      expect(
        await runCatalogSeedCliV1(
          ['--catalog', CATALOG_PATH],
          fixture.dependencies,
        ),
      ).toBe(1);
      expect(fixture.verify).toHaveBeenCalledTimes(1);
      expect(fixture.putCandidate).not.toHaveBeenCalled();
      expect(fixture.setFamilies).not.toHaveBeenCalled();
      expect(fixture.output).toEqual([]);
    },
  );

  it('admits only migration 4 and emits one canonical content-free summary', async () => {
    const fixture = dependencies();
    expect(
      await runCatalogSeedCliV1(
        ['--catalog', CATALOG_PATH],
        fixture.dependencies,
      ),
    ).toBe(0);
    expect(fixture.verify).toHaveBeenCalledTimes(1);
    expect(fixture.putCandidate).toHaveBeenCalledTimes(150);
    expect(fixture.setFamilies).toHaveBeenCalledTimes(150);
    expect(fixture.errors).toEqual([]);
    expect(fixture.output).toHaveLength(1);
    const summaryText = fixture.output[0]!;
    expect(JSON.parse(summaryText)).toEqual({
      candidateCount: 150,
      capabilityFamilyAssignmentCount: 150,
      catalogDigest: CATALOG_DIGEST,
      catalogVersion: 'public-v1',
      databaseMigrationVersion: 4,
      schemaVersion: '1.0.0',
      status: 'catalog-seed-complete',
    });
    expect(summaryText).not.toContain(CATALOG_PATH);
    expect(summaryText).not.toContain('synthetic-db');
    expect(summaryText).not.toContain('database-secret-sentinel');
    expect(summaryText).not.toContain('candidateId');
  });

  it('reads only the exact catalog-seed environment authority', async () => {
    const fixture = dependencies();
    expect(
      await runCatalogSeedCliV1(
        ['--catalog', CATALOG_PATH],
        fixture.dependencies,
      ),
    ).toBe(0);
    expect(fixture.environment.mock.calls.map(([name]) => name)).toEqual([
      'GITBLOCKS_CATALOG_SEED_ACKNOWLEDGEMENT',
      'GITBLOCKS_CATALOG_SEED_DB_SCOPE',
      'GITBLOCKS_CATALOG_SEED_DB_HOST',
      'GITBLOCKS_CATALOG_SEED_DB_PORT',
      'GITBLOCKS_CATALOG_SEED_DB_DATABASE',
      'GITBLOCKS_CATALOG_SEED_DB_USERNAME',
      'GITBLOCKS_CATALOG_SEED_DB_PASSWORD',
      'GITBLOCKS_CATALOG_SEED_DB_SSL',
    ]);
    expect(
      fixture.environment.mock.calls.some(([name]) =>
        /GITHUB|OPENAI/u.test(name),
      ),
    ).toBe(false);
  });
});

function dependencies(
  environmentOverrides: Readonly<Record<string, string | undefined>> = {},
  options: {
    readonly catalogText?: string;
    readonly migrationVersion?: number;
  } = {},
) {
  const environmentValues: Record<string, string | undefined> = {
    GITBLOCKS_CATALOG_SEED_ACKNOWLEDGEMENT:
      'approved-non-production-public-catalog-seed',
    GITBLOCKS_CATALOG_SEED_DB_SCOPE: 'ephemeral-non-production',
    GITBLOCKS_CATALOG_SEED_DB_HOST: 'synthetic-db-host',
    GITBLOCKS_CATALOG_SEED_DB_PORT: '5432',
    GITBLOCKS_CATALOG_SEED_DB_DATABASE: 'synthetic-db',
    GITBLOCKS_CATALOG_SEED_DB_USERNAME: 'synthetic-user',
    GITBLOCKS_CATALOG_SEED_DB_PASSWORD: 'database-secret-sentinel',
    GITBLOCKS_CATALOG_SEED_DB_SSL: 'false',
    ...environmentOverrides,
  };
  const output: string[] = [];
  const errors: string[] = [];
  const environment = vi.fn((name: string) => environmentValues[name]);
  const createClient = vi.fn(() => CLIENT);
  const closeClient = vi.fn(() => Promise.resolve());
  const verify = vi.fn(() =>
    Promise.resolve({
      postgresqlVersion: '18.4',
      migrations: [
        {
          version: options.migrationVersion ?? 4,
          name: 'synthetic-migration',
          checksum: 'a'.repeat(64),
        },
      ],
    } satisfies MigrationVerification),
  );
  const putCandidate = vi.fn(() => Promise.resolve());
  const setFamilies = vi.fn(() => Promise.resolve());
  const dependencies: CatalogSeedCliDependenciesV1 = {
    readTextFile: () => Promise.resolve(options.catalogText ?? catalogText),
    readEnvironment: environment,
    createPersistenceClient: createClient,
    closePersistenceClient: closeClient,
    verifyMigrations: verify,
    putCatalogCandidate: putCandidate,
    setCandidateCapabilityFamilies: setFamilies,
    writeStdout: (text) => output.push(text),
    writeStderr: (text) => errors.push(text),
  };
  return {
    dependencies,
    output,
    errors,
    environment,
    createClient,
    closeClient,
    verify,
    putCandidate,
    setFamilies,
  };
}
