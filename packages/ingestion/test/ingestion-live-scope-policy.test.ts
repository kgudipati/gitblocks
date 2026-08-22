import { describe, expect, it } from 'vitest';

import {
  INGESTION_LIVE_NON_PRODUCTION_ACKNOWLEDGEMENT_V1,
  INGESTION_LIVE_PRODUCTION_ACKNOWLEDGEMENT_V1,
  selectIngestionLiveDatabaseBoundaryV1,
} from '../scripts/ingestion-live-scope-policy.ts';

const NON_PRODUCTION_DATABASE_CONFIG = Object.freeze({
  host: '127.0.0.1',
  port: '5432',
  database: 'gitblocks_ingestion_test',
  username: 'postgres',
  password: 'non-production-password-sentinel',
  ssl: 'false',
});

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

describe('live ingestion database boundary', () => {
  it('preserves the existing non-production configuration as the default', () => {
    expect(
      selectIngestionLiveDatabaseBoundaryV1({
        nonProductionAcknowledgement:
          INGESTION_LIVE_NON_PRODUCTION_ACKNOWLEDGEMENT_V1,
        nonProductionDatabaseConfig: NON_PRODUCTION_DATABASE_CONFIG,
        productionAcknowledgement: undefined,
        productionDatabaseUrl: undefined,
      }),
    ).toEqual({
      mode: 'non-production',
      databaseConfig: {
        ...NON_PRODUCTION_DATABASE_CONFIG,
        port: 5432,
        ssl: false,
      },
    });
  });

  it('uses TLS by default for an explicitly acknowledged production database', () => {
    expect(
      selectIngestionLiveDatabaseBoundaryV1({
        nonProductionAcknowledgement: undefined,
        nonProductionDatabaseConfig: {},
        productionAcknowledgement: INGESTION_LIVE_PRODUCTION_ACKNOWLEDGEMENT_V1,
        productionDatabaseUrl: productionDatabaseUrl('gitblocks_ingestion'),
      }),
    ).toMatchObject({
      mode: 'production',
      databaseConfig: {
        database: 'gitblocks_ingestion',
        ssl: 'require',
      },
    });
  });

  it.each([
    ['disable', false],
    ['allow', 'allow'],
    ['prefer', 'prefer'],
    ['require', 'require'],
    ['verify-full', 'verify-full'],
  ] as const)('honors production sslmode=%s', (sslmode, expected) => {
    expect(
      selectIngestionLiveDatabaseBoundaryV1({
        nonProductionAcknowledgement: undefined,
        nonProductionDatabaseConfig: {},
        productionAcknowledgement: INGESTION_LIVE_PRODUCTION_ACKNOWLEDGEMENT_V1,
        productionDatabaseUrl: productionDatabaseUrl(
          'gitblocks_ingestion',
          `?sslmode=${sslmode}`,
        ),
      }).databaseConfig.ssl,
    ).toBe(expected);
  });

  it('names an invalid production acknowledgement without exposing DATABASE_URL', () => {
    expect.assertions(4);
    const databaseUrl = productionDatabaseUrl('gitblocks_ingestion');

    try {
      selectIngestionLiveDatabaseBoundaryV1({
        nonProductionAcknowledgement: undefined,
        nonProductionDatabaseConfig: {},
        productionAcknowledgement: 'wrong-production-acknowledgement',
        productionDatabaseUrl: databaseUrl,
      });
    } catch (error) {
      expect(String(error)).toContain('GITBLOCKS_INGEST_PRODUCTION_ACK');
      expect(String(error)).not.toContain(databaseUrl);
      expect(String(error)).not.toContain('production-password-sentinel');
      expect(String(error)).not.toContain('managed.invalid');
    }
  });

  it('rejects invalid production sslmode without exposing DATABASE_URL', () => {
    expect.assertions(4);
    const databaseUrl = productionDatabaseUrl(
      'gitblocks_ingestion',
      '?sslmode=verify-ca',
    );

    try {
      selectIngestionLiveDatabaseBoundaryV1({
        nonProductionAcknowledgement: undefined,
        nonProductionDatabaseConfig: {},
        productionAcknowledgement: INGESTION_LIVE_PRODUCTION_ACKNOWLEDGEMENT_V1,
        productionDatabaseUrl: databaseUrl,
      });
    } catch (error) {
      expect(String(error)).toContain('DATABASE_URL sslmode is invalid.');
      expect(String(error)).not.toContain(databaseUrl);
      expect(String(error)).not.toContain('production-password-sentinel');
      expect(String(error)).not.toContain('managed.invalid');
    }
  });

  it('rejects a production database name ending in _test without exposing DATABASE_URL', () => {
    const databaseUrl = productionDatabaseUrl('gitblocks_ingestion_test');

    expect(() =>
      selectIngestionLiveDatabaseBoundaryV1({
        nonProductionAcknowledgement: undefined,
        nonProductionDatabaseConfig: {},
        productionAcknowledgement: INGESTION_LIVE_PRODUCTION_ACKNOWLEDGEMENT_V1,
        productionDatabaseUrl: databaseUrl,
      }),
    ).toThrow('DATABASE_URL database name must not end in _test.');
    try {
      selectIngestionLiveDatabaseBoundaryV1({
        nonProductionAcknowledgement: undefined,
        nonProductionDatabaseConfig: {},
        productionAcknowledgement: INGESTION_LIVE_PRODUCTION_ACKNOWLEDGEMENT_V1,
        productionDatabaseUrl: databaseUrl,
      });
    } catch (error) {
      expect(String(error)).not.toContain(databaseUrl);
      expect(String(error)).not.toContain('production-password-sentinel');
      expect(String(error)).not.toContain('managed.invalid');
    }
  });

  it('rejects a production acknowledgement on the non-production path', () => {
    expect(() =>
      selectIngestionLiveDatabaseBoundaryV1({
        nonProductionAcknowledgement:
          INGESTION_LIVE_NON_PRODUCTION_ACKNOWLEDGEMENT_V1,
        nonProductionDatabaseConfig: NON_PRODUCTION_DATABASE_CONFIG,
        productionAcknowledgement: INGESTION_LIVE_PRODUCTION_ACKNOWLEDGEMENT_V1,
        productionDatabaseUrl: undefined,
      }),
    ).toThrow('GITBLOCKS_INGEST_PRODUCTION_ACK');
  });

  it('rejects simultaneous non-production and production configuration', () => {
    expect(() =>
      selectIngestionLiveDatabaseBoundaryV1({
        nonProductionAcknowledgement:
          INGESTION_LIVE_NON_PRODUCTION_ACKNOWLEDGEMENT_V1,
        nonProductionDatabaseConfig: NON_PRODUCTION_DATABASE_CONFIG,
        productionAcknowledgement: INGESTION_LIVE_PRODUCTION_ACKNOWLEDGEMENT_V1,
        productionDatabaseUrl: productionDatabaseUrl('gitblocks_ingestion'),
      }),
    ).toThrow('mutually exclusive');
  });
});
