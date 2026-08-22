import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import {
  createCandidateRetrievalMetadataAuthorityV1,
  type CandidateRetrievalMetadataAuthorityV1,
} from '@gitblocks/contracts';
import type {
  MigrationVerification,
  PersistenceClient,
  PublishServingCatalogSnapshotResult,
} from '@gitblocks/persistence';
import { PersistenceError } from '@gitblocks/persistence';
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
let profilesV2Text: string;
let metadataText: string;

beforeAll(async () => {
  [catalogText, profilesText, profilesV2Text, metadataText] = await Promise.all(
    [
      acceptedText('manifest.json'),
      acceptedText('candidate-profile-authority.json'),
      acceptedText('candidate-profile-authority-v2.json'),
      acceptedText('candidate-retrieval-metadata-authority.json'),
    ],
  );
});

describe('offline serving catalog bootstrap CLI', () => {
  it('requires the complete explicit offline input before database construction', async () => {
    const fixture = dependencies();
    expect(
      await runServingCatalogBootstrapCliV1([], fixture.dependencies),
    ).toBe(1);
    expect(fixture.createClient).not.toHaveBeenCalled();
    expect(fixture.publish).not.toHaveBeenCalled();
    expect(fixture.errors).toEqual([
      failureDiagnostic(
        'argument-parsing',
        'serving-bootstrap.invalid-arguments',
      ),
    ]);
  });

  it('requires complete database credentials and the current migration', async () => {
    const missingCredential = dependencies({
      GITBLOCKS_SERVING_BOOTSTRAP_DB_PASSWORD: undefined,
    });
    expect(
      await runServingCatalogBootstrapCliV1(
        argumentsV1(),
        missingCredential.dependencies,
      ),
    ).toBe(1);
    expect(missingCredential.createClient).not.toHaveBeenCalled();
    expect(missingCredential.errors).toEqual([
      failureDiagnostic(
        'database-configuration',
        'serving-bootstrap.invalid-database-configuration',
      ),
    ]);

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
    expect(oldMigration.errors).toEqual([
      failureDiagnostic(
        'database-precondition',
        'serving-bootstrap.migration-precondition',
      ),
    ]);
  });

  it('emits bounded stage and cause diagnostics for every bootstrap boundary', async () => {
    const catalog = dependencies({}, { catalogText: '{}' });
    expect(
      await runServingCatalogBootstrapCliV1(
        argumentsV1(),
        catalog.dependencies,
      ),
    ).toBe(1);
    expect(catalog.errors).toEqual([
      failureDiagnostic('catalog-parse', 'serving-bootstrap.invalid-catalog'),
    ]);

    const profile = dependencies({}, { profilesText: '{}' });
    expect(
      await runServingCatalogBootstrapCliV1(
        argumentsV1(),
        profile.dependencies,
      ),
    ).toBe(1);
    expect(profile.errors).toEqual([
      failureDiagnostic(
        'profile-authority-parse',
        'serving-bootstrap.invalid-profile-authority',
      ),
    ]);

    const metadata = dependencies({}, { metadataText: '{}' });
    expect(
      await runServingCatalogBootstrapCliV1(
        argumentsV1(),
        metadata.dependencies,
      ),
    ).toBe(1);
    expect(metadata.errors).toEqual([
      failureDiagnostic(
        'metadata-parse',
        'serving-bootstrap.invalid-metadata-authority',
      ),
    ]);

    const incoherent = dependencies(
      {},
      { metadataText: incoherentMetadataText() },
    );
    expect(
      await runServingCatalogBootstrapCliV1(
        argumentsV1(),
        incoherent.dependencies,
      ),
    ).toBe(1);
    expect(incoherent.errors).toEqual([
      failureDiagnostic(
        'coherence-validation',
        'serving-bootstrap.incoherent-authorities',
      ),
    ]);

    const connection = dependencies(
      {},
      { verifyError: new Error('host-secret-sentinel') },
    );
    expect(
      await runServingCatalogBootstrapCliV1(
        argumentsV1(),
        connection.dependencies,
      ),
    ).toBe(1);
    expect(connection.errors).toEqual([
      failureDiagnostic(
        'database-connection',
        'serving-bootstrap.connection-failed',
      ),
    ]);

    const unsupportedVersion = dependencies({}, { postgresqlVersion: '19.0' });
    expect(
      await runServingCatalogBootstrapCliV1(
        argumentsV1(),
        unsupportedVersion.dependencies,
      ),
    ).toBe(1);
    expect(unsupportedVersion.errors).toEqual([
      failureDiagnostic(
        'database-precondition',
        'serving-bootstrap.postgresql-version-precondition',
      ),
    ]);

    const persistence = dependencies(
      {},
      { publishError: new PersistenceError('persistence.conflict') },
    );
    expect(
      await runServingCatalogBootstrapCliV1(
        argumentsV1(),
        persistence.dependencies,
      ),
    ).toBe(1);
    expect(persistence.errors).toEqual([
      failureDiagnostic('persistence-write', 'persistence.conflict'),
    ]);

    expect(
      [
        ...catalog.errors,
        ...profile.errors,
        ...metadata.errors,
        ...incoherent.errors,
        ...connection.errors,
        ...unsupportedVersion.errors,
        ...persistence.errors,
      ].join(''),
    ).not.toMatch(/host-secret-sentinel|database-secret-sentinel/u);
  }, 120_000);

  it('accepts PostgreSQL 18.4 and newer 18.x minors but rejects older minors and other majors', async () => {
    for (const postgresqlVersion of ['18.4', '18.6']) {
      const supported = dependencies({}, { postgresqlVersion });
      expect(
        await runServingCatalogBootstrapCliV1(
          argumentsV1(),
          supported.dependencies,
        ),
      ).toBe(0);
      expect(supported.errors).toEqual([]);
    }

    for (const postgresqlVersion of ['18.3', '19.0']) {
      const unsupported = dependencies({}, { postgresqlVersion });
      expect(
        await runServingCatalogBootstrapCliV1(
          argumentsV1(),
          unsupported.dependencies,
        ),
      ).toBe(1);
      expect(unsupported.putCandidate).not.toHaveBeenCalled();
      expect(unsupported.publish).not.toHaveBeenCalled();
      expect(unsupported.errors).toEqual([
        failureDiagnostic(
          'database-precondition',
          'serving-bootstrap.postgresql-version-precondition',
        ),
      ]);
    }
  }, 120_000);

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
      databaseMigrationVersion: 7,
      publicationStatus: 'created',
      profileAuthorityVersion:
        'deterministic-candidate-profile-authority/1.0.0',
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

  it('publishes a native V2 authority through the same immutable snapshot boundary', async () => {
    const fixture = dependencies({}, { profilesText: profilesV2Text });
    expect(
      await runServingCatalogBootstrapCliV1(
        argumentsV1(),
        fixture.dependencies,
      ),
    ).toBe(0);
    expect(fixture.publish).toHaveBeenCalledTimes(1);
    expect(fixture.publish.mock.calls[0]?.[1]).toMatchObject({
      candidateProfileAuthority: {
        authorityVersion: 'deterministic-candidate-profile-authority/2.0.0',
      },
    });
    expect(JSON.parse(fixture.output[0] ?? '{}')).toMatchObject({
      profileAuthorityVersion:
        'deterministic-candidate-profile-authority/2.0.0',
    });
  }, 120_000);

  it('has no provider, model, or network collection capability', async () => {
    const fixture = dependencies();
    expect(
      await runServingCatalogBootstrapCliV1(
        argumentsV1(),
        fixture.dependencies,
      ),
    ).toBe(0);
    expect(fixture.environment.mock.calls.map(([name]) => name)).toEqual([
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
    readonly catalogText?: string;
    readonly migrationVersion?: number;
    readonly metadataText?: string;
    readonly postgresqlVersion?: string;
    readonly profilesText?: string;
    readonly publishError?: Error;
    readonly verifyError?: Error;
  } = {},
) {
  const environmentValues: Record<string, string | undefined> = {
    GITBLOCKS_SERVING_BOOTSTRAP_DB_HOST: 'synthetic-db-host',
    GITBLOCKS_SERVING_BOOTSTRAP_DB_PORT: '5432',
    GITBLOCKS_SERVING_BOOTSTRAP_DB_DATABASE: 'synthetic-db',
    GITBLOCKS_SERVING_BOOTSTRAP_DB_USERNAME: 'synthetic-user',
    GITBLOCKS_SERVING_BOOTSTRAP_DB_PASSWORD: 'database-secret-sentinel',
    GITBLOCKS_SERVING_BOOTSTRAP_DB_SSL: 'false',
    ...environmentOverrides,
  };
  const texts: Readonly<Record<string, string>> = {
    [CATALOG_PATH]: options.catalogText ?? catalogText,
    [PROFILES_PATH]: options.profilesText ?? profilesText,
    [METADATA_PATH]: options.metadataText ?? metadataText,
  };
  const output: string[] = [];
  const errors: string[] = [];
  const environment = vi.fn((name: string) => environmentValues[name]);
  const createClient = vi.fn(() => CLIENT);
  const closeClient = vi.fn(() => Promise.resolve());
  const migrationVersion = options.migrationVersion ?? 7;
  const verify = vi.fn(() =>
    options.verifyError === undefined
      ? Promise.resolve({
          postgresqlVersion: options.postgresqlVersion ?? '18.4',
          migrations: Array.from({ length: migrationVersion }, (_, index) => ({
            version: index + 1,
            name:
              index + 1 === 5
                ? 'retrieval-serving'
                : index + 1 === 6
                  ? 'finalist-evidence-serving'
                  : index + 1 === 7
                    ? 'artifact-evidence-serving'
                    : `synthetic-${String(index + 1)}`,
            checksum: String(index + 1).repeat(64),
          })),
        } satisfies MigrationVerification)
      : Promise.reject(options.verifyError),
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
  const publish = vi.fn<
    ServingCatalogBootstrapCliDependenciesV1['publishServingCatalogSnapshot']
  >(() =>
    options.publishError === undefined
      ? Promise.resolve(publication)
      : Promise.reject(options.publishError),
  );
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

function incoherentMetadataText(): string {
  const metadata = JSON.parse(
    metadataText,
  ) as CandidateRetrievalMetadataAuthorityV1;
  return JSON.stringify(
    createCandidateRetrievalMetadataAuthorityV1({
      catalogVersion: metadata.catalogVersion,
      catalogDigest: 'f'.repeat(64),
      providerPolicyVersion: metadata.providerPolicyVersion,
      providerPolicyDigest: metadata.providerPolicyDigest,
      sourceProviderPolicyVersion: metadata.sourceProviderPolicyVersion,
      sourceProviderPolicyDigest: metadata.sourceProviderPolicyDigest,
      sourceOperation: metadata.sourceOperation,
      collectedAt: metadata.collectedAt,
      candidates: metadata.candidates.map(
        ({ sourceRecordDigest, repositoryIdentityState, ...candidate }) => {
          void sourceRecordDigest;
          void repositoryIdentityState;
          return candidate;
        },
      ),
    }),
  );
}

function failureDiagnostic(stage: string, causeCode: string): string {
  return `${JSON.stringify({ causeCode, stage })}\n`;
}
