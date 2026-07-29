import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
  closePersistenceClient,
  createPersistenceClient,
  verifyMigrations,
  type PersistenceClientConfig,
} from '@gitblocks/persistence';

import {
  SYSTEM_CLOCK,
  abortableSleep,
  createTransport,
  ingestPublicCatalog,
  parseIngestionReceipt,
  parsePublicCatalog,
  type SafeTelemetryEvent,
} from '../src/index.ts';

const acknowledgement =
  'approved-non-production-public-ingestion-with-public-sources-only';
if (process.env['GITBLOCKS_INGEST_ACKNOWLEDGEMENT'] !== acknowledgement) {
  throw new Error(
    'The exact non-production ingestion acknowledgement is required.',
  );
}
const githubToken = requiredEnvironment('GITBLOCKS_INGEST_GITHUB_TOKEN');
const receiptArgument = argumentValue('--receipt');
const manifestArgument = argumentValue('--manifest');
if (receiptArgument === undefined) {
  throw new Error('An explicit --receipt path is required.');
}
if (manifestArgument === undefined) {
  throw new Error('An explicit --manifest path is required.');
}
const concurrency = boundedIntegerArgument('--concurrency', 3, 1, 3);
const deadlineMilliseconds = boundedIntegerArgument(
  '--deadline-ms',
  60 * 60_000,
  1,
  60 * 60_000,
);
const candidateIds = argumentValues('--candidate');
const comparisonPath = argumentValue('--compare-receipt');
const databaseConfig = readDatabaseConfig();
const catalog = parsePublicCatalog(
  await readFile(resolve(manifestArgument), 'utf8'),
);
const priorReceipt =
  comparisonPath === undefined
    ? undefined
    : parseIngestionReceipt(await readFile(resolve(comparisonPath), 'utf8'));
const client = createPersistenceClient(databaseConfig);
const observer = (event: SafeTelemetryEvent): void => {
  process.stderr.write(`${JSON.stringify(event)}\n`);
};
try {
  const migration = await verifyMigrations(client);
  const databaseMigrationVersion = migration.migrations.at(-1)?.version;
  if (databaseMigrationVersion === undefined) {
    throw new Error('The ingestion database has no verified migration.');
  }
  const transport = createTransport({
    fetch,
    sleep: abortableSleep,
    observer,
  });
  const receipt = await ingestPublicCatalog({
    catalog,
    persistence: client,
    provider: { transport, githubToken },
    clock: SYSTEM_CLOCK,
    observer,
    databaseMigrationVersion,
    candidateConcurrency: concurrency,
    maximumRunMilliseconds: deadlineMilliseconds,
    ...(candidateIds.length === 0 ? {} : { candidateIds }),
    ...(priorReceipt === undefined ? {} : { priorReceipt }),
  });
  await writeFile(
    resolve(receiptArgument),
    `${JSON.stringify(receipt, null, 2)}\n`,
    { encoding: 'utf8', flag: 'wx' },
  );
  process.stdout.write(
    `Public ingestion completed (${String(receipt.completedCandidateCount)}/${String(receipt.requestedCandidateCount)} candidates; ${receipt.receiptDigest}).\n`,
  );
} finally {
  await closePersistenceClient(client);
}

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    throw new Error(`Required environment configuration is missing: ${name}.`);
  }
  return value;
}

function readDatabaseConfig(): PersistenceClientConfig {
  const port = Number(requiredEnvironment('GITBLOCKS_INGEST_DB_PORT'));
  const ssl = requiredEnvironment('GITBLOCKS_INGEST_DB_SSL');
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('Ingestion database port is invalid.');
  }
  if (ssl !== 'false' && ssl !== 'require') {
    throw new Error('Ingestion database SSL mode is invalid.');
  }
  return {
    host: requiredEnvironment('GITBLOCKS_INGEST_DB_HOST'),
    port,
    database: requiredEnvironment('GITBLOCKS_INGEST_DB_DATABASE'),
    username: requiredEnvironment('GITBLOCKS_INGEST_DB_USERNAME'),
    password: requiredEnvironment('GITBLOCKS_INGEST_DB_PASSWORD'),
    ssl: ssl === 'require' ? 'require' : false,
    maximumConnections: 3,
    connectTimeoutMilliseconds: 5_000,
    idleTimeoutMilliseconds: 5_000,
    statementTimeoutMilliseconds: 10_000,
    lockTimeoutMilliseconds: 5_000,
  };
}

function argumentValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}

function argumentValues(name: string): string[] {
  return process.argv.flatMap((argument, index) => {
    const value = process.argv[index + 1];
    return argument === name && value !== undefined ? [value] : [];
  });
}

function boundedIntegerArgument(
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const raw = argumentValue(name);
  if (raw === undefined) {
    return fallback;
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`Operator argument is invalid: ${name}.`);
  }
  return value;
}
