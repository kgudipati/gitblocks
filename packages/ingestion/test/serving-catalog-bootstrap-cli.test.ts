import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import type {
  MigrationVerification,
  PersistenceClient,
  PublishServingCatalogSnapshotResult,
} from '@gitblocks/persistence';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import {
  runServingCatalogBootstrapCliV1,
  type ServingCatalogBootstrapCliDependenciesV1,
} from '../scripts/serving-catalog-bootstrap-command.ts';

const CATALOG_PATH = '/accepted/catalog.json';
const PROFILES_PATH = '/accepted/profiles.json';
const METADATA_PATH = '/accepted/metadata.json';
const PUBLISHED_AT = '2026-08-11T18:00:00.000Z';
const CATALOG_DIGEST =
  '4819dd94cb1bbe5e27c31ca5ca55976da1442987a792bf438d96681021cb8634';
const SNAPSHOT_ID = `serving-${'a'.repeat(48)}`;
const CLIENT = Object.freeze({
  kind: 'gitblocks-postgresql-persistence' as const,
}) as PersistenceClient;

let catalogText: string;
let profilesText: string;
let metadataText: string;

beforeAll(async () => {
  [catalogText, profilesText, metadataText] = await Promise.all([
    acceptedText('manifest.json'),
    acceptedText('candidate-profile-authority.json'),
    acceptedText('candidate-retrieval-metadata-authority.json'),
  ]);
});

describe('offline serving catalog bootstrap CLI', () => {
  it('requires the complete explicit offline input before database construction', async () => {
    const fixture = dependencies();
    expect(
      await runServingCatalogBootstrapCliV1([], fixture.dependencies),
    ).toBe(1);
    expect(fixture.createClient).not.toHaveBeenCalled();
    expect(fixture.publish).not.toHaveBeenCalled();
    expect(fixture.errors).toEqual(['Serving catalog bootstrap failed.\n']);
  });

  it('requires the exact private-alpha acknowledgement and current migration', async () => {
    const missingAuthority = dependencies({
      GITBLOCKS_SERVING_BOOTSTRAP_ACKNOWLEDGEMENT: undefined,
    });
    expect(
      await runServingCatalogBootstrapCliV1(
        argumentsV1(),
        missingAuthority.dependencies,
      ),
    ).toBe(1);
    expect(missingAuthority.createClient).not.toHaveBeenCalled();

    const oldMigration = dependencies({}, { migrationVersion: 4 });
    expect(
      await runServingCatalogBootstrapCliV1(
        argumentsV1(),
        oldMigration.dependencies,
      ),
    ).toBe(1);
    expect(oldMigration.verify).toHaveBeenCalledTimes(1);
    expect(oldMigration.putCandidate).not.toHaveBeenCalled();
    expect(oldMigration.publish).not.toHaveBeenCalled();
  });

  it('validates all accepted authorities before the first persistence write', async () => {
    const fixture = dependencies({}, { profilesText: '{}' });
    expect(
      await runServingCatalogBootstrapCliV1(
        argumentsV1(),
        fixture.dependencies,
      ),
    ).toBe(1);
    expect(fixture.putCandidate).not.toHaveBeenCalled();
    expect(fixture.setFamilies).not.toHaveBeenCalled();
    expect(fixture.publish).not.toHaveBeenCalled();
  });

  it('seeds exactly 150 candidates, publishes once, and emits a content-free summary', async () => {
    const fixture = dependencies();
    expect(
      await runServingCatalogBootstrapCliV1(
        argumentsV1(),
        fixture.dependencies,
      ),
    ).toBe(0);
    expect(fixture.putCandidate).toHaveBeenCalledTimes(150);
    expect(fixture.setFamilies).toHaveBeenCalledTimes(150);
    expect(fixture.publish).toHaveBeenCalledTimes(1);
    expect(fixture.publish.mock.invocationCallOrder[0]).toBeGreaterThan(
      fixture.setFamilies.mock.invocationCallOrder.at(-1) ?? 0,
    );
    expect(fixture.closeClient).toHaveBeenCalledTimes(1);
    expect(fixture.errors).toEqual([]);
    expect(fixture.output).toHaveLength(1);
    const summaryText = fixture.output[0]!;
    expect(JSON.parse(summaryText)).toEqual({
      candidateCount: 150,
      catalogDigest: CATALOG_DIGEST,
      catalogVersion: 'public-v1',
      databaseMigrationVersion: 5,
      publicationStatus: 'created',
      publishedAt: PUBLISHED_AT,
      schemaVersion: '1.0.0',
      snapshotId: SNAPSHOT_ID,
      snapshotRecordDigest: 'b'.repeat(64),
      status: 'serving-catalog-bootstrap-complete',
    });
    expect(summaryText).not.toContain('candidateId');
    expect(summaryText).not.toContain('database-secret-sentinel');
    expect(summaryText).not.toContain('githubOwner');
  });

  it('has no provider, model, or network collection capability', async () => {
    const fixture = dependencies();
    expect(
      await runServingCatalogBootstrapCliV1(
        argumentsV1(),
        fixture.dependencies,
      ),
    ).toBe(0);
    expect(fixture.environment.mock.calls.map(([name]) => name)).toEqual([
      'GITBLOCKS_SERVING_BOOTSTRAP_ACKNOWLEDGEMENT',
      'GITBLOCKS_SERVING_BOOTSTRAP_DB_SCOPE',
      'GITBLOCKS_SERVING_BOOTSTRAP_DB_PORT',
      'GITBLOCKS_SERVING_BOOTSTRAP_DB_SSL',
      'GITBLOCKS_SERVING_BOOTSTRAP_DB_HOST',
      'GITBLOCKS_SERVING_BOOTSTRAP_DB_DATABASE',
      'GITBLOCKS_SERVING_BOOTSTRAP_DB_USERNAME',
      'GITBLOCKS_SERVING_BOOTSTRAP_DB_PASSWORD',
    ]);
    expect(
      fixture.environment.mock.calls.some(([name]) =>
        /GITHUB|NPM|OPENAI|MODEL|TOKEN/u.test(name),
      ),
    ).toBe(false);
    expect(Object.keys(fixture.dependencies)).not.toEqual(
      expect.arrayContaining(['fetch', 'provider', 'model']),
    );
  });
});

function dependencies(
  environmentOverrides: Readonly<Record<string, string | undefined>> = {},
  options: {
    readonly migrationVersion?: number;
    readonly profilesText?: string;
  } = {},
) {
  const environmentValues: Record<string, string | undefined> = {
    GITBLOCKS_SERVING_BOOTSTRAP_ACKNOWLEDGEMENT:
      'approved-offline-serving-catalog-bootstrap',
    GITBLOCKS_SERVING_BOOTSTRAP_DB_SCOPE: 'private-alpha',
    GITBLOCKS_SERVING_BOOTSTRAP_DB_HOST: 'synthetic-db-host',
    GITBLOCKS_SERVING_BOOTSTRAP_DB_PORT: '5432',
    GITBLOCKS_SERVING_BOOTSTRAP_DB_DATABASE: 'synthetic-db',
    GITBLOCKS_SERVING_BOOTSTRAP_DB_USERNAME: 'synthetic-user',
    GITBLOCKS_SERVING_BOOTSTRAP_DB_PASSWORD: 'database-secret-sentinel',
    GITBLOCKS_SERVING_BOOTSTRAP_DB_SSL: 'false',
    ...environmentOverrides,
  };
  const texts: Readonly<Record<string, string>> = {
    [CATALOG_PATH]: catalogText,
    [PROFILES_PATH]: options.profilesText ?? profilesText,
    [METADATA_PATH]: metadataText,
  };
  const output: string[] = [];
  const errors: string[] = [];
  const environment = vi.fn((name: string) => environmentValues[name]);
  const createClient = vi.fn(() => CLIENT);
  const closeClient = vi.fn(() => Promise.resolve());
  const migrationVersion = options.migrationVersion ?? 5;
  const verify = vi.fn(() =>
    Promise.resolve({
      postgresqlVersion: '18.4',
      migrations: Array.from({ length: migrationVersion }, (_, index) => ({
        version: index + 1,
        name:
          index + 1 === 5
            ? 'retrieval-serving'
            : `synthetic-${String(index + 1)}`,
        checksum: String(index + 1).repeat(64),
      })),
    } satisfies MigrationVerification),
  );
  const putCandidate = vi.fn(() => Promise.resolve());
  const setFamilies = vi.fn(() => Promise.resolve());
  const publication: PublishServingCatalogSnapshotResult = Object.freeze({
    status: 'created',
    snapshotId: SNAPSHOT_ID,
    snapshotRecordDigest: 'b'.repeat(64),
    publishedAt: PUBLISHED_AT,
    candidateCount: 150,
  });
  const publish = vi.fn(() => Promise.resolve(publication));
  const dependencies: ServingCatalogBootstrapCliDependenciesV1 = {
    readTextFile: (path) => Promise.resolve(texts[path] ?? ''),
    readEnvironment: environment,
    createPersistenceClient: createClient,
    closePersistenceClient: closeClient,
    verifyMigrations: verify,
    putCatalogCandidate: putCandidate,
    setCandidateCapabilityFamilies: setFamilies,
    publishServingCatalogSnapshot: publish,
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
    publish,
  };
}

function argumentsV1(): readonly string[] {
  return [
    '--',
    '--catalog',
    CATALOG_PATH,
    '--profiles',
    PROFILES_PATH,
    '--metadata',
    METADATA_PATH,
    '--published-at',
    PUBLISHED_AT,
  ];
}

function acceptedText(fileName: string): Promise<string> {
  return readFile(
    fileURLToPath(
      new URL(`../../../catalog/public-v1/${fileName}`, import.meta.url),
    ),
    'utf8',
  );
}
