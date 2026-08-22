import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  INGESTION_LIVE_NON_PRODUCTION_ACKNOWLEDGEMENT_V1,
  INGESTION_LIVE_PRODUCTION_ACKNOWLEDGEMENT_V1,
} from '../scripts/ingestion-live-scope-policy.ts';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const NON_PRODUCTION_ENVIRONMENT = Object.freeze({
  GITBLOCKS_INGEST_ACKNOWLEDGEMENT:
    INGESTION_LIVE_NON_PRODUCTION_ACKNOWLEDGEMENT_V1,
  GITBLOCKS_INGEST_DB_HOST: '127.0.0.1',
  GITBLOCKS_INGEST_DB_PORT: '5432',
  GITBLOCKS_INGEST_DB_DATABASE: 'gitblocks_ingestion_test',
  GITBLOCKS_INGEST_DB_USERNAME: 'postgres',
  GITBLOCKS_INGEST_DB_PASSWORD: 'non-production-password-sentinel',
  GITBLOCKS_INGEST_DB_SSL: 'false',
});

describe('live ingestion command boundary', () => {
  it('composes the reviewed selector before credentials, arguments, or effects', async () => {
    const source = await readFile(
      new URL('../scripts/live-cli.ts', import.meta.url),
      'utf8',
    );
    const authority = source.indexOf(
      'selectIngestionLiveDatabaseAuthorityV1(databaseBoundaryInput)',
    );
    const providerCredential = source.indexOf(
      "requiredEnvironment('GITBLOCKS_INGEST_GITHUB_TOKEN')",
    );
    const client = source.indexOf('createPersistenceClient(databaseConfig)');
    const selection = source.indexOf(
      'selectIngestionLiveDatabaseBoundaryV1(',
      providerCredential,
    );

    expect(authority).toBeGreaterThan(-1);
    expect(providerCredential).toBeGreaterThan(authority);
    expect(selection).toBeGreaterThan(providerCredential);
    expect(client).toBeGreaterThan(selection);
  });

  it('preserves the existing non-production preflight order', () => {
    const missingToken = runCommandBoundary({
      GITBLOCKS_INGEST_ACKNOWLEDGEMENT:
        INGESTION_LIVE_NON_PRODUCTION_ACKNOWLEDGEMENT_V1,
    });
    expect(missingToken.stderr).toContain('GITBLOCKS_INGEST_GITHUB_TOKEN');
    expect(missingToken.stderr).not.toContain('GITBLOCKS_INGEST_DB_PORT');

    const missingReceipt = runCommandBoundary({
      GITBLOCKS_INGEST_ACKNOWLEDGEMENT:
        INGESTION_LIVE_NON_PRODUCTION_ACKNOWLEDGEMENT_V1,
      GITBLOCKS_INGEST_GITHUB_TOKEN: 'github-token-sentinel',
    });
    expect(missingReceipt.stderr).toContain(
      'An explicit --receipt path is required.',
    );
    expect(missingReceipt.stderr).not.toContain('github-token-sentinel');
    expect(missingReceipt.stderr).not.toContain('GITBLOCKS_INGEST_DB_PORT');
  });

  it('rejects a production acknowledgement on the non-production path', () => {
    const result = runCommandBoundary({
      ...NON_PRODUCTION_ENVIRONMENT,
      GITBLOCKS_INGEST_PRODUCTION_ACK:
        INGESTION_LIVE_PRODUCTION_ACKNOWLEDGEMENT_V1,
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('GITBLOCKS_INGEST_PRODUCTION_ACK');
    expect(result.stderr).not.toContain('non-production-password-sentinel');
  });

  it('rejects simultaneous non-production and production configuration', () => {
    const databaseUrl = productionDatabaseUrl('gitblocks_ingestion');
    const result = runCommandBoundary({
      ...NON_PRODUCTION_ENVIRONMENT,
      GITBLOCKS_INGEST_PRODUCTION_ACK:
        INGESTION_LIVE_PRODUCTION_ACKNOWLEDGEMENT_V1,
      DATABASE_URL: databaseUrl,
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('mutually exclusive');
    expect(result.stderr).not.toContain(databaseUrl);
    expect(result.stderr).not.toContain('production-password-sentinel');
  });

  it('rejects a production database name ending in _test', () => {
    const databaseUrl = productionDatabaseUrl('gitblocks_ingestion_test');
    const result = runCommandBoundary(
      {
        GITBLOCKS_INGEST_PRODUCTION_ACK:
          INGESTION_LIVE_PRODUCTION_ACKNOWLEDGEMENT_V1,
        DATABASE_URL: databaseUrl,
        GITBLOCKS_INGEST_GITHUB_TOKEN: 'github-token-sentinel',
      },
      [
        '--receipt',
        '/not-written/ingestion-receipt.json',
        '--manifest',
        'catalog/public-v1/manifest.json',
      ],
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      'DATABASE_URL database name must not end in _test.',
    );
    expect(result.stderr).not.toContain(databaseUrl);
    expect(result.stderr).not.toContain('managed.invalid');
  });
});

function runCommandBoundary(
  environment: Readonly<Record<string, string>>,
  arguments_: readonly string[] = [],
): ReturnType<typeof spawnSync> {
  return spawnSync(
    process.execPath,
    [
      '--conditions=gitblocks-source',
      'packages/ingestion/scripts/live-cli.ts',
      ...arguments_,
    ],
    {
      cwd: REPOSITORY_ROOT,
      encoding: 'utf8',
      env: {
        PATH: process.env['PATH'] ?? '',
        ...environment,
      },
    },
  );
}

function productionDatabaseUrl(database: string): string {
  return [
    'postgresql:',
    '//operator:',
    'production-password-sentinel',
    '@managed.invalid/',
    database,
  ].join('');
}
