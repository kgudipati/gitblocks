import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import {
  ARTIFACT_LIVE_EPHEMERAL_DATABASE_SCOPE_V1,
  ARTIFACT_LIVE_GLOBAL_ACKNOWLEDGEMENT_V1,
  ARTIFACT_LIVE_PERSISTENT_ACKNOWLEDGEMENT_V1,
  ARTIFACT_LIVE_PERSISTENT_DATABASE_SCOPE_V1,
  ARTIFACT_LIVE_PRODUCTION_ACKNOWLEDGEMENT_V1,
  assertArtifactLiveDatabaseScopeAuthorityV1,
  selectArtifactLiveDatabaseBoundaryV1,
  validateArtifactLiveDatabaseScopeV1,
} from '../scripts/artifact-live-scope-policy.ts';

const PERSISTENT_DATABASE_CONFIG = Object.freeze({
  host: '127.0.0.1',
  port: '49152',
  database: 'gitblocks_dogfood_test',
  username: 'gitblocks_persistence_dogfood',
  password: 'database-password-sentinel',
  ssl: 'false',
});

function productionDatabaseUrl(database: string): string {
  return [
    'postgresql:',
    '//operator:',
    'production-password-sentinel',
    '@managed.invalid/',
    database,
  ].join('');
}

describe('live artifact database scope policy', () => {
  it('preserves the existing ephemeral non-production contract without the persistent acknowledgement', () => {
    const result = validateArtifactLiveDatabaseScopeV1({
      scope: ARTIFACT_LIVE_EPHEMERAL_DATABASE_SCOPE_V1,
      persistentAcknowledgement: undefined,
      databaseConfig: {
        host: 'synthetic-ephemeral-host',
        port: '5432',
        database: 'synthetic_artifacts_test',
        username: 'synthetic-writer',
        password: 'ephemeral-password-sentinel',
        ssl: 'require',
      },
    });

    expect(result).toEqual({
      scope: 'ephemeral-non-production',
      databaseConfig: {
        host: 'synthetic-ephemeral-host',
        port: 5432,
        database: 'synthetic_artifacts_test',
        username: 'synthetic-writer',
        password: 'ephemeral-password-sentinel',
        ssl: 'require',
      },
    });
  });

  it('accepts the exact persistent private-alpha dogfood authority and dynamic valid port', () => {
    const result = validateArtifactLiveDatabaseScopeV1({
      scope: ARTIFACT_LIVE_PERSISTENT_DATABASE_SCOPE_V1,
      persistentAcknowledgement: ARTIFACT_LIVE_PERSISTENT_ACKNOWLEDGEMENT_V1,
      databaseConfig: PERSISTENT_DATABASE_CONFIG,
    });

    expect(result).toEqual({
      scope: 'persistent-private-alpha-dogfood',
      databaseConfig: {
        ...PERSISTENT_DATABASE_CONFIG,
        port: 49152,
        ssl: false,
      },
    });
  });

  it('keeps the dogfood loopback path byte-for-byte equivalent through boundary selection', () => {
    expect(
      selectArtifactLiveDatabaseBoundaryV1({
        nonProductionAcknowledgement: ARTIFACT_LIVE_GLOBAL_ACKNOWLEDGEMENT_V1,
        nonProductionScope: ARTIFACT_LIVE_PERSISTENT_DATABASE_SCOPE_V1,
        nonProductionPersistentAcknowledgement:
          ARTIFACT_LIVE_PERSISTENT_ACKNOWLEDGEMENT_V1,
        nonProductionDatabaseConfig: PERSISTENT_DATABASE_CONFIG,
        productionAcknowledgement: undefined,
        productionDatabaseUrl: undefined,
      }),
    ).toEqual({
      mode: 'non-production',
      scope: 'persistent-private-alpha-dogfood',
      databaseConfig: {
        ...PERSISTENT_DATABASE_CONFIG,
        port: 49152,
        ssl: false,
      },
    });
  });

  it('uses TLS by default for an explicitly acknowledged production database', () => {
    expect(
      selectArtifactLiveDatabaseBoundaryV1({
        nonProductionAcknowledgement: undefined,
        nonProductionScope: undefined,
        nonProductionPersistentAcknowledgement: undefined,
        nonProductionDatabaseConfig: {},
        productionAcknowledgement: ARTIFACT_LIVE_PRODUCTION_ACKNOWLEDGEMENT_V1,
        productionDatabaseUrl: productionDatabaseUrl('gitblocks_artifacts'),
      }),
    ).toMatchObject({
      mode: 'production',
      databaseConfig: {
        database: 'gitblocks_artifacts',
        ssl: 'require',
      },
    });
  });

  it('rejects a production database name ending in _test', () => {
    expect(() =>
      selectArtifactLiveDatabaseBoundaryV1({
        nonProductionAcknowledgement: undefined,
        nonProductionScope: undefined,
        nonProductionPersistentAcknowledgement: undefined,
        nonProductionDatabaseConfig: {},
        productionAcknowledgement: ARTIFACT_LIVE_PRODUCTION_ACKNOWLEDGEMENT_V1,
        productionDatabaseUrl: productionDatabaseUrl(
          'gitblocks_artifacts_test',
        ),
      }),
    ).toThrow('DATABASE_URL database name must not end in _test.');
  });

  it('rejects a production acknowledgement on the dogfood path', () => {
    expect(() =>
      selectArtifactLiveDatabaseBoundaryV1({
        nonProductionAcknowledgement: ARTIFACT_LIVE_GLOBAL_ACKNOWLEDGEMENT_V1,
        nonProductionScope: ARTIFACT_LIVE_PERSISTENT_DATABASE_SCOPE_V1,
        nonProductionPersistentAcknowledgement:
          ARTIFACT_LIVE_PERSISTENT_ACKNOWLEDGEMENT_V1,
        nonProductionDatabaseConfig: PERSISTENT_DATABASE_CONFIG,
        productionAcknowledgement: ARTIFACT_LIVE_PRODUCTION_ACKNOWLEDGEMENT_V1,
        productionDatabaseUrl: undefined,
      }),
    ).toThrow('GITBLOCKS_ARTIFACT_PRODUCTION_ACK');
  });

  it('rejects simultaneous dogfood and production configuration', () => {
    expect(() =>
      selectArtifactLiveDatabaseBoundaryV1({
        nonProductionAcknowledgement: ARTIFACT_LIVE_GLOBAL_ACKNOWLEDGEMENT_V1,
        nonProductionScope: ARTIFACT_LIVE_PERSISTENT_DATABASE_SCOPE_V1,
        nonProductionPersistentAcknowledgement:
          ARTIFACT_LIVE_PERSISTENT_ACKNOWLEDGEMENT_V1,
        nonProductionDatabaseConfig: PERSISTENT_DATABASE_CONFIG,
        productionAcknowledgement: ARTIFACT_LIVE_PRODUCTION_ACKNOWLEDGEMENT_V1,
        productionDatabaseUrl: productionDatabaseUrl('gitblocks_artifacts'),
      }),
    ).toThrow('mutually exclusive');
  });

  it.each([
    ['missing acknowledgement', { persistentAcknowledgement: undefined }],
    [
      'wrong acknowledgement',
      { persistentAcknowledgement: 'approved-something-else' },
    ],
    ['localhost host alias', { databaseConfig: { host: 'localhost' } }],
    ['wildcard host', { databaseConfig: { host: '0.0.0.0' } }],
    ['remote host', { databaseConfig: { host: 'db.example.test' } }],
    [
      'wrong database',
      { databaseConfig: { database: 'another_dogfood_test' } },
    ],
    ['postgres username', { databaseConfig: { username: 'postgres' } }],
    [
      'database owner shaped username',
      { databaseConfig: { username: 'gitblocks_dogfood_owner' } },
    ],
    [
      'persistence group username',
      { databaseConfig: { username: 'gitblocks_persistence' } },
    ],
    ['serving username', { databaseConfig: { username: 'gitblocks_serving' } }],
    ['arbitrary username', { databaseConfig: { username: 'artifact-writer' } }],
    ['required SSL', { databaseConfig: { ssl: 'require' } }],
  ] as const)(
    'rejects persistent mode for %s with one value-free error',
    (_name, overrides) => {
      const databaseConfig = {
        ...PERSISTENT_DATABASE_CONFIG,
        ...('databaseConfig' in overrides ? overrides.databaseConfig : {}),
      };
      const persistentAcknowledgement =
        'persistentAcknowledgement' in overrides
          ? overrides.persistentAcknowledgement
          : ARTIFACT_LIVE_PERSISTENT_ACKNOWLEDGEMENT_V1;

      expect(() =>
        validateArtifactLiveDatabaseScopeV1({
          scope: ARTIFACT_LIVE_PERSISTENT_DATABASE_SCOPE_V1,
          persistentAcknowledgement,
          databaseConfig,
        }),
      ).toThrow(/^(?:The exact persistent|The persistent private-alpha)/u);
      try {
        validateArtifactLiveDatabaseScopeV1({
          scope: ARTIFACT_LIVE_PERSISTENT_DATABASE_SCOPE_V1,
          persistentAcknowledgement,
          databaseConfig,
        });
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).not.toMatch(
          /database-password-sentinel|localhost|0\.0\.0\.0|example|postgres|owner|serving|artifact-writer|another_dogfood/u,
        );
      }
    },
  );

  it.each(['host', 'port', 'database', 'username', 'password', 'ssl'] as const)(
    'rejects incomplete configuration missing %s',
    (missing) => {
      const databaseConfig = Object.fromEntries(
        Object.entries(PERSISTENT_DATABASE_CONFIG).filter(
          ([name]) => name !== missing,
        ),
      );

      expect(() =>
        validateArtifactLiveDatabaseScopeV1({
          scope: ARTIFACT_LIVE_PERSISTENT_DATABASE_SCOPE_V1,
          persistentAcknowledgement:
            ARTIFACT_LIVE_PERSISTENT_ACKNOWLEDGEMENT_V1,
          databaseConfig,
        }),
      ).toThrow('Artifact database configuration is incomplete.');
    },
  );

  it.each([0, 65_536, 1.5, 'not-a-port', undefined])(
    'rejects invalid database port %j',
    (port) => {
      expect(() =>
        validateArtifactLiveDatabaseScopeV1({
          scope: ARTIFACT_LIVE_PERSISTENT_DATABASE_SCOPE_V1,
          persistentAcknowledgement:
            ARTIFACT_LIVE_PERSISTENT_ACKNOWLEDGEMENT_V1,
          databaseConfig: { ...PERSISTENT_DATABASE_CONFIG, port },
        }),
      ).toThrow('Artifact database port is invalid.');
    },
  );

  it('rejects missing, unknown, and generalized database scopes before configuration validation', () => {
    for (const scope of [
      undefined,
      '',
      'production',
      'persistent-production',
      'staging',
      'shared-development',
      'remote-database',
    ]) {
      expect(() => {
        assertArtifactLiveDatabaseScopeAuthorityV1({
          scope,
          persistentAcknowledgement:
            ARTIFACT_LIVE_PERSISTENT_ACKNOWLEDGEMENT_V1,
        });
      }).toThrow(
        'The artifact database must be explicitly scoped as an authorized non-production target.',
      );
    }
  });

  it('has no environment, filesystem, database, provider, network, logging, or secret-reading effect', async () => {
    const source = await readFile(
      new URL('../scripts/artifact-live-scope-policy.ts', import.meta.url),
      'utf8',
    );
    expect(source).not.toMatch(
      /process\.|readFile|writeFile|fetch\(|createTransport|createRepositoryArtifactCollector|createPersistenceClient|console\.|stdout|stderr|from ['"]@/u,
    );
    expect(source).not.toMatch(/\b[1-9][0-9]{4}\b/u);
  });
});
