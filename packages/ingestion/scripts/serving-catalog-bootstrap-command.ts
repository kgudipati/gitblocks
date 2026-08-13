import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
  closePersistenceClient,
  createPersistenceClient,
  publishServingCatalogSnapshot,
  putCatalogCandidate,
  setCandidateCapabilityFamilies,
  verifyMigrations,
  type MigrationVerification,
  type OperationControl,
  type PersistenceClient,
  type PersistenceClientConfig,
  type PublishServingCatalogSnapshotCommand,
  type PublishServingCatalogSnapshotResult,
  type PutCatalogCandidateCommand,
  type SetCandidateCapabilityFamiliesCommand,
} from '@gitblocks/persistence';

import {
  bootstrapServingCatalogV1,
  canonicalizeJson,
  parsePublicCatalog,
} from '../src/index.ts';

const FAILURE_DIAGNOSTIC = 'Serving catalog bootstrap failed.\n';

export interface ServingCatalogBootstrapCliDependenciesV1 {
  readonly readTextFile: (path: string) => Promise<string>;
  readonly readEnvironment: (name: string) => string | undefined;
  readonly createPersistenceClient: (
    config: PersistenceClientConfig,
  ) => PersistenceClient;
  readonly closePersistenceClient: (client: PersistenceClient) => Promise<void>;
  readonly verifyMigrations: (
    client: PersistenceClient,
  ) => Promise<MigrationVerification>;
  readonly putCatalogCandidate: (
    client: PersistenceClient,
    command: PutCatalogCandidateCommand,
    control?: OperationControl,
  ) => Promise<void>;
  readonly setCandidateCapabilityFamilies: (
    client: PersistenceClient,
    command: SetCandidateCapabilityFamiliesCommand,
    control?: OperationControl,
  ) => Promise<void>;
  readonly publishServingCatalogSnapshot: (
    client: PersistenceClient,
    command: PublishServingCatalogSnapshotCommand,
    control?: OperationControl,
  ) => Promise<PublishServingCatalogSnapshotResult>;
  readonly writeStdout: (text: string) => void;
  readonly writeStderr: (text: string) => void;
}

const PROCESS_DEPENDENCIES: ServingCatalogBootstrapCliDependenciesV1 =
  Object.freeze({
    readTextFile: (path: string) => readFile(path, 'utf8'),
    readEnvironment: (name: string) => process.env[name],
    createPersistenceClient,
    closePersistenceClient,
    verifyMigrations,
    putCatalogCandidate,
    setCandidateCapabilityFamilies,
    publishServingCatalogSnapshot,
    writeStdout: (text: string) => process.stdout.write(text),
    writeStderr: (text: string) => process.stderr.write(text),
  });

export async function runServingCatalogBootstrapCliV1(
  arguments_: readonly string[],
  dependencies: ServingCatalogBootstrapCliDependenciesV1 = PROCESS_DEPENDENCIES,
): Promise<0 | 1> {
  let client: PersistenceClient | undefined;
  let clientClosed = false;
  try {
    const configuration = parseServingCatalogBootstrapArgumentsV1(arguments_);
    const [catalogText, profileText, metadataText] = await Promise.all([
      dependencies.readTextFile(resolve(configuration.catalogPath)),
      dependencies.readTextFile(resolve(configuration.profileAuthorityPath)),
      dependencies.readTextFile(resolve(configuration.metadataAuthorityPath)),
    ]);
    const catalog = parsePublicCatalog(catalogText);
    const profileAuthority = parseJson(profileText);
    const metadataAuthority = parseJson(metadataText);
    const databaseConfig = readDatabaseConfig(dependencies);
    const activeClient = dependencies.createPersistenceClient(databaseConfig);
    client = activeClient;
    const verification = await dependencies.verifyMigrations(activeClient);
    requireCurrentMigration(verification);
    const summary = await bootstrapServingCatalogV1({
      catalog,
      candidateProfileAuthority: profileAuthority,
      candidateRetrievalMetadataAuthority: metadataAuthority,
      publishedAt: configuration.publishedAt,
      databaseMigrationVersion: 6,
      persistence: Object.freeze({
        putCatalogCandidate: (
          command: PutCatalogCandidateCommand,
          control?: OperationControl,
        ) => dependencies.putCatalogCandidate(activeClient, command, control),
        setCandidateCapabilityFamilies: (
          command: SetCandidateCapabilityFamiliesCommand,
          control?: OperationControl,
        ) =>
          dependencies.setCandidateCapabilityFamilies(
            activeClient,
            command,
            control,
          ),
        publishServingCatalogSnapshot: (
          command: PublishServingCatalogSnapshotCommand,
          control?: OperationControl,
        ) =>
          dependencies.publishServingCatalogSnapshot(
            activeClient,
            command,
            control,
          ),
      }),
    });
    await dependencies.closePersistenceClient(activeClient);
    clientClosed = true;
    dependencies.writeStdout(`${canonicalizeJson(summary).text}\n`);
    return 0;
  } catch {
    if (client !== undefined && !clientClosed) {
      try {
        await dependencies.closePersistenceClient(client);
      } catch {
        // The fixed diagnostic remains the only failure output.
      }
    }
    dependencies.writeStderr(FAILURE_DIAGNOSTIC);
    return 1;
  }
}

export function parseServingCatalogBootstrapArgumentsV1(
  arguments_: readonly string[],
): {
  readonly catalogPath: string;
  readonly profileAuthorityPath: string;
  readonly metadataAuthorityPath: string;
  readonly publishedAt: string;
} {
  const values = arguments_[0] === '--' ? arguments_.slice(1) : arguments_;
  if (
    values.length !== 8 ||
    values[0] !== '--catalog' ||
    values[2] !== '--profiles' ||
    values[4] !== '--metadata' ||
    values[6] !== '--published-at' ||
    values[1] === undefined ||
    values[3] === undefined ||
    values[5] === undefined ||
    values[7] === undefined ||
    [values[1], values[3], values[5], values[7]].some(
      (value) => value.length === 0,
    ) ||
    !isCanonicalTimestamp(values[7])
  ) {
    throw new Error('Serving catalog bootstrap configuration is invalid.');
  }
  return Object.freeze({
    catalogPath: values[1],
    profileAuthorityPath: values[3],
    metadataAuthorityPath: values[5],
    publishedAt: values[7],
  });
}

function requireCurrentMigration(value: MigrationVerification): void {
  if (
    !/^18[.]4(?:[.\s]|$)/u.test(value.postgresqlVersion) ||
    value.migrations.length !== 6 ||
    value.migrations.at(-1)?.version !== 6 ||
    value.migrations.at(-1)?.name !== 'finalist-evidence-serving'
  ) {
    throw new Error('Serving catalog bootstrap migration is invalid.');
  }
}

function readDatabaseConfig(
  dependencies: ServingCatalogBootstrapCliDependenciesV1,
): PersistenceClientConfig {
  const port = Number(
    requiredEnvironment(dependencies, 'GITBLOCKS_SERVING_BOOTSTRAP_DB_PORT'),
  );
  const ssl = requiredEnvironment(
    dependencies,
    'GITBLOCKS_SERVING_BOOTSTRAP_DB_SSL',
  );
  if (
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65_535 ||
    (ssl !== 'false' && ssl !== 'require')
  ) {
    throw new Error('Serving catalog bootstrap database is invalid.');
  }
  return Object.freeze({
    host: requiredEnvironment(
      dependencies,
      'GITBLOCKS_SERVING_BOOTSTRAP_DB_HOST',
    ),
    port,
    database: requiredEnvironment(
      dependencies,
      'GITBLOCKS_SERVING_BOOTSTRAP_DB_DATABASE',
    ),
    username: requiredEnvironment(
      dependencies,
      'GITBLOCKS_SERVING_BOOTSTRAP_DB_USERNAME',
    ),
    password: requiredEnvironment(
      dependencies,
      'GITBLOCKS_SERVING_BOOTSTRAP_DB_PASSWORD',
    ),
    ssl: ssl === 'require' ? 'require' : false,
    maximumConnections: 2,
    connectTimeoutMilliseconds: 5_000,
    idleTimeoutMilliseconds: 5_000,
    statementTimeoutMilliseconds: 60_000,
    lockTimeoutMilliseconds: 10_000,
  });
}

function requiredEnvironment(
  dependencies: ServingCatalogBootstrapCliDependenciesV1,
  name: string,
): string {
  const value = dependencies.readEnvironment(name);
  if (value === undefined || value.length === 0) {
    throw new Error('Serving catalog bootstrap database is invalid.');
  }
  return value;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error('Serving catalog bootstrap input is invalid.');
  }
}

function isCanonicalTimestamp(value: string): boolean {
  const milliseconds = Date.parse(value);
  return (
    Number.isFinite(milliseconds) &&
    new Date(milliseconds).toISOString() === value
  );
}
