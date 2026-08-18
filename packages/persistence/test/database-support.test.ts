import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  DatabaseCommandConfigurationError,
  readDatabaseCommandConfig,
  readInjectedDatabaseConfig,
  readProductionDatabaseConfig,
  validateServingLoginInspection,
  type ServingLoginInspection,
} from '../scripts/database-support.ts';

const TEST_DATABASE_VARIABLES = {
  GITBLOCKS_DB_TEST_ACK: 'ephemeral',
  GITBLOCKS_TEST_DB_HOST: '127.0.0.1',
  GITBLOCKS_TEST_DB_PORT: '5432',
  GITBLOCKS_TEST_DB_DATABASE: 'gitblocks_regression_test',
  GITBLOCKS_TEST_DB_OWNER: 'postgres',
  GITBLOCKS_TEST_DB_PASSWORD: 'test-password-sentinel',
} as const;

const SAFE_SERVING_LOGIN_INSPECTION: ServingLoginInspection = {
  attributes: {
    login: true,
    superuser: false,
    bypassRowSecurity: false,
    createDatabase: false,
    createRole: false,
    inherit: true,
    replication: false,
  },
  memberships: ['gitblocks_serving'],
  membershipWithAdminOptionCount: 0,
  servingTableCount: 15,
  selectableServingTableCount: 15,
  selectableNonServingTableCount: 0,
  writableTableCount: 0,
  otherTablePrivilegeCount: 0,
  databaseCreate: false,
  databaseTemporary: false,
  creatableSchemaCount: 0,
  ownedObjectCount: 0,
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('database command configuration boundaries', () => {
  it('preserves the existing explicit ephemeral test configuration', () => {
    stubEnvironment(TEST_DATABASE_VARIABLES);

    const direct = readInjectedDatabaseConfig();
    const selected = readDatabaseCommandConfig();

    expect(direct?.port).toBe(5432);
    expect(direct?.database).toBe('gitblocks_regression_test');
    expect(direct?.ssl).toBe(false);
    expect(direct?.maximumConnections).toBe(5);
    expect(selected?.mode).toBe('test');
    expect(selected?.config.ssl).toBe(false);
  });

  it('rejects a production acknowledgement on the test path', () => {
    stubEnvironment({
      ...TEST_DATABASE_VARIABLES,
      GITBLOCKS_DB_PRODUCTION_ACK: 'managed-production',
    });

    expect(() => readDatabaseCommandConfig()).toThrow(
      'GITBLOCKS_DB_PRODUCTION_ACK',
    );
  });

  it('rejects simultaneous test and production configuration', () => {
    stubEnvironment({
      ...TEST_DATABASE_VARIABLES,
      DATABASE_URL: productionDatabaseUrl('gitblocks'),
      GITBLOCKS_DB_PRODUCTION_ACK: 'managed-production',
    });

    expect(() => readDatabaseCommandConfig()).toThrow(
      DatabaseCommandConfigurationError,
    );
  });

  it('rejects a production database name ending in _test', () => {
    stubEnvironment({
      DATABASE_URL: productionDatabaseUrl('gitblocks_test'),
      GITBLOCKS_DB_PRODUCTION_ACK: 'managed-production',
    });

    expect(() => readProductionDatabaseConfig()).toThrow('DATABASE_URL');
  });

  it('names a missing production acknowledgement without exposing DATABASE_URL', () => {
    const connectionString = productionDatabaseUrl('gitblocks');
    stubEnvironment({ DATABASE_URL: connectionString });

    let caught: unknown;
    try {
      readProductionDatabaseConfig();
    } catch (error) {
      caught = error;
    }

    expect(errorMessage(caught)).toContain('GITBLOCKS_DB_PRODUCTION_ACK');
    expect(String(caught)).not.toContain(connectionString);
  });

  it('names a missing DATABASE_URL without exposing another credential', () => {
    stubEnvironment({
      GITBLOCKS_DB_PRODUCTION_ACK: 'managed-production',
      GITBLOCKS_SERVING_LOGIN_PASSWORD: 'serving-password-sentinel',
    });

    let caught: unknown;
    try {
      readProductionDatabaseConfig();
    } catch (error) {
      caught = error;
    }

    expect(errorMessage(caught)).toContain('DATABASE_URL');
    expect(String(caught)).not.toContain('serving-password-sentinel');
  });

  it('rejects a malformed DATABASE_URL without printing its value', () => {
    const malformed = 'not-a-url-production-password-sentinel';
    stubEnvironment({
      DATABASE_URL: malformed,
      GITBLOCKS_DB_PRODUCTION_ACK: 'managed-production',
    });

    let caught: unknown;
    try {
      readProductionDatabaseConfig();
    } catch (error) {
      caught = error;
    }

    expect(errorMessage(caught)).toContain('DATABASE_URL');
    expect(String(caught)).not.toContain(malformed);
  });

  it('requires TLS when DATABASE_URL omits sslmode', () => {
    stubEnvironment({
      DATABASE_URL: productionDatabaseUrl('gitblocks'),
      GITBLOCKS_DB_PRODUCTION_ACK: 'managed-production',
    });

    expect(readProductionDatabaseConfig()?.ssl).toBe('require');
  });

  it.each([
    ['disable', false],
    ['allow', 'allow'],
    ['prefer', 'prefer'],
    ['require', 'require'],
    ['verify-full', 'verify-full'],
  ] as const)('honors sslmode=%s from DATABASE_URL', (sslmode, expected) => {
    stubEnvironment({
      DATABASE_URL: productionDatabaseUrl('gitblocks', `?sslmode=${sslmode}`),
      GITBLOCKS_DB_PRODUCTION_ACK: 'managed-production',
    });

    expect(readProductionDatabaseConfig()?.ssl).toBe(expected);
  });

  it('rejects an unsupported sslmode without exposing DATABASE_URL', () => {
    const connectionString = productionDatabaseUrl(
      'gitblocks',
      '?sslmode=verify-ca',
    );
    stubEnvironment({
      DATABASE_URL: connectionString,
      GITBLOCKS_DB_PRODUCTION_ACK: 'managed-production',
    });

    let caught: unknown;
    try {
      readProductionDatabaseConfig();
    } catch (error) {
      caught = error;
    }

    expect(errorMessage(caught)).toContain('DATABASE_URL');
    expect(String(caught)).not.toContain(connectionString);
  });
});

describe('serving login verification', () => {
  it('returns a credential-free structured report for the least-privilege role', () => {
    expect(
      validateServingLoginInspection(SAFE_SERVING_LOGIN_INSPECTION),
    ).toEqual({
      schemaVersion: '1.0.0',
      status: 'serving-login-verified',
      groupRole: 'gitblocks_serving',
      attributes: SAFE_SERVING_LOGIN_INSPECTION.attributes,
      memberships: {
        count: 1,
        onlyServingGroup: true,
        adminOptionAllowed: false,
      },
      tablePrivileges: {
        servingTableCount: 15,
        selectAllowed: true,
        nonServingSelectAllowed: false,
        insertAllowed: false,
        updateAllowed: false,
        deleteAllowed: false,
        otherAllowed: false,
      },
      ddl: {
        databaseCreateAllowed: false,
        databaseTemporaryAllowed: false,
        schemaCreateAllowed: false,
        ownsObjects: false,
      },
    });
  });

  it.each([
    [
      'superuser',
      {
        attributes: {
          ...SAFE_SERVING_LOGIN_INSPECTION.attributes,
          superuser: true,
        },
      },
    ],
    [
      'BYPASSRLS',
      {
        attributes: {
          ...SAFE_SERVING_LOGIN_INSPECTION.attributes,
          bypassRowSecurity: true,
        },
      },
    ],
    [
      'CREATEDB',
      {
        attributes: {
          ...SAFE_SERVING_LOGIN_INSPECTION.attributes,
          createDatabase: true,
        },
      },
    ],
    [
      'CREATEROLE',
      {
        attributes: {
          ...SAFE_SERVING_LOGIN_INSPECTION.attributes,
          createRole: true,
        },
      },
    ],
    [
      'excess membership',
      { memberships: ['gitblocks_persistence', 'gitblocks_serving'] },
    ],
    ['write privilege', { writableTableCount: 1 }],
    ['DDL privilege', { creatableSchemaCount: 1 }],
    ['temporary DDL privilege', { databaseTemporary: true }],
  ] as const)('rejects a role with excess %s privilege', (_label, patch) => {
    expect(() =>
      validateServingLoginInspection({
        ...SAFE_SERVING_LOGIN_INSPECTION,
        ...patch,
      }),
    ).toThrow('Serving login verification failed.');
  });
});

function stubEnvironment(values: Readonly<Record<string, string>>): void {
  for (const name of [
    ...Object.keys(TEST_DATABASE_VARIABLES),
    'DATABASE_URL',
    'GITBLOCKS_DB_PRODUCTION_ACK',
    'GITBLOCKS_SERVING_LOGIN_ROLE',
    'GITBLOCKS_SERVING_LOGIN_PASSWORD',
  ]) {
    vi.stubEnv(name, values[name]);
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '';
}

function productionDatabaseUrl(database: string, query = ''): string {
  return [
    'postgresql:',
    '//operator:',
    'production-password-sentinel',
    '@managed.invalid/',
    database,
    query,
  ].join('');
}
