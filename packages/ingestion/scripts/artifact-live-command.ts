import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
  closePersistenceClient,
  createPersistenceClient,
  verifyMigrations,
  type MigrationVerification,
  type PersistenceClient,
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
  type ArtifactReceipt,
  type Clock,
  type CollectPublicRepositoryArtifactsConfig,
  type ProviderTransport,
  type RepositoryArtifactCollector,
  type RepositoryArtifactCollectorConfig,
  type SafeTelemetryEvent,
  type TransportConfig,
  type TransportMetrics,
} from '../src/index.ts';
import { withVerifiedArtifactLiveDatabaseMigrationV1 } from './artifact-live-authority.ts';
import {
  ARTIFACT_LIVE_PERSISTENT_DATABASE_SCOPE_V1,
  selectArtifactLiveDatabaseBoundaryV1,
} from './artifact-live-scope-policy.ts';

interface ArtifactLiveTransportV1 extends ProviderTransport {
  getMetrics(): TransportMetrics;
}

export interface ArtifactLiveCliDependenciesV1 {
  readonly readTextFile: (path: string) => Promise<string>;
  readonly writeTextFileExclusive: (
    path: string,
    text: string,
  ) => Promise<void>;
  readonly readEnvironment: (name: string) => string | undefined;
  readonly createPersistenceClient: (
    config: PersistenceClientConfig,
  ) => PersistenceClient;
  readonly closePersistenceClient: (client: PersistenceClient) => Promise<void>;
  readonly verifyMigrations: (
    client: PersistenceClient,
  ) => Promise<MigrationVerification>;
  readonly createTransport: (
    config: TransportConfig,
  ) => ArtifactLiveTransportV1;
  readonly createRepositoryArtifactCollector: (
    config: RepositoryArtifactCollectorConfig,
  ) => RepositoryArtifactCollector;
  readonly collectPublicRepositoryArtifacts: (
    config: CollectPublicRepositoryArtifactsConfig,
  ) => Promise<ArtifactReceipt>;
  readonly fetch: typeof fetch;
  readonly sleep: (milliseconds: number, signal?: AbortSignal) => Promise<void>;
  readonly clock: Clock;
  readonly writeStdout: (text: string) => void;
  readonly writeStderr: (text: string) => void;
}

const PROCESS_DEPENDENCIES: ArtifactLiveCliDependenciesV1 = Object.freeze({
  readTextFile: (path: string) => readFile(path, 'utf8'),
  writeTextFileExclusive: (path: string, text: string) =>
    writeFile(path, text, { encoding: 'utf8', flag: 'wx' }),
  readEnvironment: (name: string) => process.env[name],
  createPersistenceClient,
  closePersistenceClient,
  verifyMigrations,
  createTransport,
  createRepositoryArtifactCollector,
  collectPublicRepositoryArtifacts,
  fetch,
  sleep: abortableSleep,
  clock: SYSTEM_CLOCK,
  writeStdout: (text: string) => process.stdout.write(text),
  writeStderr: (text: string) => process.stderr.write(text),
});

export async function runArtifactLiveCliV1(
  arguments_: readonly string[],
  dependencies: ArtifactLiveCliDependenciesV1 = PROCESS_DEPENDENCIES,
): Promise<void> {
  const nonProductionAcknowledgement = dependencies.readEnvironment(
    'GITBLOCKS_ARTIFACT_ACKNOWLEDGEMENT',
  );
  const scope = dependencies.readEnvironment('GITBLOCKS_ARTIFACT_DB_SCOPE');
  const persistentAcknowledgement =
    scope === ARTIFACT_LIVE_PERSISTENT_DATABASE_SCOPE_V1
      ? dependencies.readEnvironment('GITBLOCKS_ARTIFACT_PERSISTENT_ACK')
      : undefined;
  const nonProductionDatabaseConfig = {
    host: dependencies.readEnvironment('GITBLOCKS_ARTIFACT_DB_HOST'),
    port: dependencies.readEnvironment('GITBLOCKS_ARTIFACT_DB_PORT'),
    database: dependencies.readEnvironment('GITBLOCKS_ARTIFACT_DB_DATABASE'),
    username: dependencies.readEnvironment('GITBLOCKS_ARTIFACT_DB_USERNAME'),
    password: dependencies.readEnvironment('GITBLOCKS_ARTIFACT_DB_PASSWORD'),
    ssl: dependencies.readEnvironment('GITBLOCKS_ARTIFACT_DB_SSL'),
  };
  const { databaseConfig } = selectArtifactLiveDatabaseBoundaryV1({
    nonProductionAcknowledgement,
    nonProductionScope: scope,
    nonProductionPersistentAcknowledgement: persistentAcknowledgement,
    nonProductionDatabaseConfig,
    productionAcknowledgement: dependencies.readEnvironment(
      'GITBLOCKS_ARTIFACT_PRODUCTION_ACK',
    ),
    productionDatabaseUrl: dependencies.readEnvironment('DATABASE_URL'),
  });
  const githubToken = requiredEnvironment(
    dependencies,
    'GITBLOCKS_ARTIFACT_GITHUB_TOKEN',
  );
  const command = parseArtifactLiveArgumentsV1(arguments_);
  const catalog = parsePublicCatalog(
    await dependencies.readTextFile(resolve(command.catalogPath)),
  );
  const manifest = parsePublicArtifactManifest(
    await dependencies.readTextFile(resolve(command.manifestPath)),
    catalog,
  );
  const priorReceipt =
    command.comparisonReceiptPath === undefined
      ? undefined
      : parseArtifactReceipt(
          await dependencies.readTextFile(
            resolve(command.comparisonReceiptPath),
          ),
        );
  const client = dependencies.createPersistenceClient({
    ...databaseConfig,
    maximumConnections: 3,
    connectTimeoutMilliseconds: 5_000,
    idleTimeoutMilliseconds: 5_000,
    statementTimeoutMilliseconds: 10_000,
    lockTimeoutMilliseconds: 5_000,
  });
  const observer = (event: SafeTelemetryEvent): void => {
    dependencies.writeStderr(`${JSON.stringify(event)}\n`);
  };

  try {
    const receipt = await withVerifiedArtifactLiveDatabaseMigrationV1(
      () => dependencies.verifyMigrations(client),
      async (databaseMigrationVersion) => {
        const transport = dependencies.createTransport({
          fetch: dependencies.fetch,
          sleep: dependencies.sleep,
          observer,
          requestTimeoutMilliseconds: 10_000,
        });
        const collector = dependencies.createRepositoryArtifactCollector({
          transport,
          githubToken,
        });
        return dependencies.collectPublicRepositoryArtifacts({
          catalog,
          manifest,
          persistence: client,
          collector,
          getProviderMetrics: () => transport.getMetrics(),
          clock: dependencies.clock,
          observer,
          candidateConcurrency: command.concurrency,
          maximumRunMilliseconds: command.deadlineMilliseconds,
          databaseMigrationVersion,
          ...(command.candidateIds.length === 0
            ? {}
            : { candidateIds: command.candidateIds }),
          ...(priorReceipt === undefined ? {} : { priorReceipt }),
        });
      },
    );
    await dependencies.writeTextFileExclusive(
      resolve(command.receiptPath),
      `${JSON.stringify(receipt, null, 2)}\n`,
    );
    dependencies.writeStdout(
      `Repository artifact collection completed (${String(
        receipt.completedCandidateCount,
      )}/${String(receipt.requestedCandidateCount)} candidates; ` +
        `${String(receipt.artifactCount)} artifacts; ${receipt.receiptDigest}).\n`,
    );
  } finally {
    await dependencies.closePersistenceClient(client);
  }
}

interface ArtifactLiveArgumentsV1 {
  readonly catalogPath: string;
  readonly manifestPath: string;
  readonly receiptPath: string;
  readonly comparisonReceiptPath?: string;
  readonly candidateIds: readonly string[];
  readonly concurrency: number;
  readonly deadlineMilliseconds: number;
}

function parseArtifactLiveArgumentsV1(
  arguments_: readonly string[],
): ArtifactLiveArgumentsV1 {
  const catalogPath = requiredArgument(arguments_, '--catalog');
  const manifestPath = requiredArgument(arguments_, '--manifest');
  const receiptPath = requiredArgument(arguments_, '--receipt');
  const comparisonReceiptPath = argumentValue(arguments_, '--compare-receipt');
  const candidateIds = argumentValues(arguments_, '--candidate');
  const concurrency = boundedIntegerArgument(
    arguments_,
    '--concurrency',
    2,
    1,
    2,
  );
  const deadlineMilliseconds = boundedIntegerArgument(
    arguments_,
    '--deadline-ms',
    60 * 60_000,
    1,
    60 * 60_000,
  );
  return Object.freeze({
    catalogPath,
    manifestPath,
    receiptPath,
    ...(comparisonReceiptPath === undefined ? {} : { comparisonReceiptPath }),
    candidateIds: Object.freeze(candidateIds),
    concurrency,
    deadlineMilliseconds,
  });
}

function requiredEnvironment(
  dependencies: ArtifactLiveCliDependenciesV1,
  name: string,
): string {
  const value = dependencies.readEnvironment(name);
  if (value === undefined || value.length === 0) {
    throw new Error(`Required environment configuration is missing: ${name}.`);
  }
  return value;
}

function requiredArgument(arguments_: readonly string[], name: string): string {
  const value = argumentValue(arguments_, name);
  if (value === undefined || value.length === 0) {
    throw new Error(`An explicit ${name} path is required.`);
  }
  return value;
}

function argumentValue(
  arguments_: readonly string[],
  name: string,
): string | undefined {
  const index = arguments_.indexOf(name);
  return index < 0 ? undefined : arguments_[index + 1];
}

function argumentValues(arguments_: readonly string[], name: string): string[] {
  return arguments_.flatMap((argument, index) => {
    const value = arguments_[index + 1];
    return argument === name && value !== undefined ? [value] : [];
  });
}

function boundedIntegerArgument(
  arguments_: readonly string[],
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const raw = argumentValue(arguments_, name);
  if (raw === undefined) {
    return fallback;
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`Operator argument is invalid: ${name}.`);
  }
  return value;
}
