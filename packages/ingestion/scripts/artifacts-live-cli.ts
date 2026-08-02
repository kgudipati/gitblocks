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
  collectPublicRepositoryArtifacts,
  createRepositoryArtifactCollector,
  createTransport,
  parseArtifactReceipt,
  parsePublicArtifactManifest,
  parsePublicCatalog,
  type SafeTelemetryEvent,
} from '../src/index.ts';
import { withVerifiedArtifactLiveDatabaseMigrationV1 } from './artifact-live-authority.ts';

const acknowledgement = 'approved-non-production-public-artifact-collection';
if (process.env['GITBLOCKS_ARTIFACT_ACKNOWLEDGEMENT'] !== acknowledgement) {
  throw new Error(
    'The exact non-production artifact acknowledgement is required.',
  );
}
if (process.env['GITBLOCKS_ARTIFACT_DB_SCOPE'] !== 'ephemeral-non-production') {
  throw new Error(
    'The artifact database must be explicitly scoped as ephemeral non-production.',
  );
}

const githubToken = requiredEnvironment('GITBLOCKS_ARTIFACT_GITHUB_TOKEN');
const catalogArgument = requiredArgument('--catalog');
const manifestArgument = requiredArgument('--manifest');
const receiptArgument = requiredArgument('--receipt');
const comparisonPath = argumentValue('--compare-receipt');
const candidateIds = argumentValues('--candidate');
const concurrency = boundedIntegerArgument('--concurrency', 2, 1, 2);
const deadlineMilliseconds = boundedIntegerArgument(
  '--deadline-ms',
  60 * 60_000,
  1,
  60 * 60_000,
);

const catalog = parsePublicCatalog(
  await readFile(resolve(catalogArgument), 'utf8'),
);
const manifest = parsePublicArtifactManifest(
  await readFile(resolve(manifestArgument), 'utf8'),
  catalog,
);
const priorReceipt =
  comparisonPath === undefined
    ? undefined
    : parseArtifactReceipt(await readFile(resolve(comparisonPath), 'utf8'));
const client = createPersistenceClient(readDatabaseConfig());
const observer = (event: SafeTelemetryEvent): void => {
  process.stderr.write(`${JSON.stringify(event)}\n`);
};

try {
  const receipt = await withVerifiedArtifactLiveDatabaseMigrationV1(
    () => verifyMigrations(client),
    async (databaseMigrationVersion) => {
      const transport = createTransport({
        fetch,
        sleep: abortableSleep,
        observer,
        requestTimeoutMilliseconds: 10_000,
      });
      const collector = createRepositoryArtifactCollector({
        transport,
        githubToken,
      });
      return collectPublicRepositoryArtifacts({
        catalog,
        manifest,
        persistence: client,
        collector,
        getProviderMetrics: () => transport.getMetrics(),
        clock: SYSTEM_CLOCK,
        observer,
        candidateConcurrency: concurrency,
        maximumRunMilliseconds: deadlineMilliseconds,
        databaseMigrationVersion,
        ...(candidateIds.length === 0 ? {} : { candidateIds }),
        ...(priorReceipt === undefined ? {} : { priorReceipt }),
      });
    },
  );
  await writeFile(
    resolve(receiptArgument),
    `${JSON.stringify(receipt, null, 2)}\n`,
    { encoding: 'utf8', flag: 'wx' },
  );
  process.stdout.write(
    `Repository artifact collection completed (${String(
      receipt.completedCandidateCount,
    )}/${String(receipt.requestedCandidateCount)} candidates; ` +
      `${String(receipt.artifactCount)} artifacts; ${receipt.receiptDigest}).\n`,
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
  const port = Number(requiredEnvironment('GITBLOCKS_ARTIFACT_DB_PORT'));
  const ssl = requiredEnvironment('GITBLOCKS_ARTIFACT_DB_SSL');
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('Artifact database port is invalid.');
  }
  if (ssl !== 'false' && ssl !== 'require') {
    throw new Error('Artifact database SSL mode is invalid.');
  }
  return {
    host: requiredEnvironment('GITBLOCKS_ARTIFACT_DB_HOST'),
    port,
    database: requiredEnvironment('GITBLOCKS_ARTIFACT_DB_DATABASE'),
    username: requiredEnvironment('GITBLOCKS_ARTIFACT_DB_USERNAME'),
    password: requiredEnvironment('GITBLOCKS_ARTIFACT_DB_PASSWORD'),
    ssl: ssl === 'require' ? 'require' : false,
    maximumConnections: 3,
    connectTimeoutMilliseconds: 5_000,
    idleTimeoutMilliseconds: 5_000,
    statementTimeoutMilliseconds: 10_000,
    lockTimeoutMilliseconds: 5_000,
  };
}

function requiredArgument(name: string): string {
  const value = argumentValue(name);
  if (value === undefined || value.length === 0) {
    throw new Error(`An explicit ${name} path is required.`);
  }
  return value;
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
