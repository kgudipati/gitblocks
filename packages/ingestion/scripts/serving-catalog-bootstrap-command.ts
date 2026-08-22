import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
  closePersistenceClient,
  createPersistenceClient,
  PersistenceError,
  publishServingCatalogSnapshot,
  putCatalogCandidate,
  setCandidateCapabilityFamilies,
  verifyMigrations,
  type MigrationVerification,
  type OperationControl,
  type PersistenceClient,
  type PersistenceClientConfig,
  type PersistenceErrorCode,
  type PublishServingCatalogSnapshotCommand,
  type PublishServingCatalogSnapshotResult,
  type PutCatalogCandidateCommand,
  type SetCandidateCapabilityFamiliesCommand,
} from '@gitblocks/persistence';

import {
  bootstrapServingCatalogV1,
  canonicalizeJson,
  parsePublicCatalog,
  type ServingCatalogBootstrapOperationStageV1,
} from '../src/index.ts';

export type ServingCatalogBootstrapFailureStageV1 =
  | 'argument-parsing'
  | 'database-configuration'
  | 'database-connection'
  | 'database-precondition'
  | ServingCatalogBootstrapOperationStageV1;

export type ServingCatalogBootstrapFailureCauseCodeV1 =
  | PersistenceErrorCode
  | 'serving-bootstrap.connection-failed'
  | 'serving-bootstrap.incoherent-authorities'
  | 'serving-bootstrap.input-read-failed'
  | 'serving-bootstrap.invalid-arguments'
  | 'serving-bootstrap.invalid-catalog'
  | 'serving-bootstrap.invalid-database-configuration'
  | 'serving-bootstrap.invalid-json'
  | 'serving-bootstrap.invalid-metadata-authority'
  | 'serving-bootstrap.invalid-profile-authority'
  | 'serving-bootstrap.migration-precondition'
  | 'serving-bootstrap.persistence-write-failed'
  | 'serving-bootstrap.postgresql-version-precondition';

export interface ServingCatalogBootstrapFailureDiagnosticV1 {
  readonly causeCode: ServingCatalogBootstrapFailureCauseCodeV1;
  readonly stage: ServingCatalogBootstrapFailureStageV1;
}

const OPERATION_STAGE_CAUSE_CODES: Readonly<
  Record<
    ServingCatalogBootstrapOperationStageV1,
    ServingCatalogBootstrapFailureCauseCodeV1
  >
> = Object.freeze({
  'catalog-parse': 'serving-bootstrap.invalid-catalog',
  'profile-authority-parse': 'serving-bootstrap.invalid-profile-authority',
  'metadata-parse': 'serving-bootstrap.invalid-metadata-authority',
  'coherence-validation': 'serving-bootstrap.incoherent-authorities',
  'persistence-write': 'serving-bootstrap.persistence-write-failed',
});
const SUPPORTED_POSTGRESQL_MAJOR = 18;
const MINIMUM_SUPPORTED_POSTGRESQL_MINOR = 4;

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
  let failureStage: ServingCatalogBootstrapFailureStageV1 = 'argument-parsing';
  let failureCauseCode: ServingCatalogBootstrapFailureCauseCodeV1 =
    'serving-bootstrap.invalid-arguments';
  try {
    const configuration = parseServingCatalogBootstrapArgumentsV1(arguments_);

    failureStage = 'catalog-parse';
    failureCauseCode = 'serving-bootstrap.input-read-failed';
    const catalogText = await dependencies.readTextFile(
      resolve(configuration.catalogPath),
    );
    failureCauseCode = 'serving-bootstrap.invalid-catalog';
    const catalog = parsePublicCatalog(catalogText);

    failureStage = 'profile-authority-parse';
    failureCauseCode = 'serving-bootstrap.input-read-failed';
    const profileText = await dependencies.readTextFile(
      resolve(configuration.profileAuthorityPath),
    );
    failureCauseCode = 'serving-bootstrap.invalid-json';
    const profileAuthority = parseJson(profileText);

    failureStage = 'metadata-parse';
    failureCauseCode = 'serving-bootstrap.input-read-failed';
    const metadataText = await dependencies.readTextFile(
      resolve(configuration.metadataAuthorityPath),
    );
    failureCauseCode = 'serving-bootstrap.invalid-json';
    const metadataAuthority = parseJson(metadataText);

    failureStage = 'database-configuration';
    failureCauseCode = 'serving-bootstrap.invalid-database-configuration';
    const databaseConfig = readDatabaseConfig(dependencies);
    const activeClient = dependencies.createPersistenceClient(databaseConfig);
    client = activeClient;

    failureStage = 'database-connection';
    failureCauseCode = 'serving-bootstrap.connection-failed';
    let verification: MigrationVerification;
    try {
      verification = await dependencies.verifyMigrations(activeClient);
    } catch (error) {
      if (
        error instanceof PersistenceError &&
        (error.code === 'persistence.unsupported-version' ||
          error.code === 'persistence.migration-drift')
      ) {
        failureStage = 'database-precondition';
        failureCauseCode = error.code;
      }
      throw error;
    }
    failureStage = 'database-precondition';
    const preconditionCauseCode =
      currentDatabasePreconditionCause(verification);
    if (preconditionCauseCode !== undefined) {
      failureCauseCode = preconditionCauseCode;
      throw new Error(
        'Serving catalog bootstrap database precondition failed.',
      );
    }

    const summary = await bootstrapServingCatalogV1({
      catalog,
      candidateProfileAuthority: profileAuthority,
      candidateRetrievalMetadataAuthority: metadataAuthority,
      publishedAt: configuration.publishedAt,
      databaseMigrationVersion: 7,
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
      onStage: (stage) => {
        failureStage = stage;
        failureCauseCode = OPERATION_STAGE_CAUSE_CODES[stage];
      },
    });
    failureStage = 'database-connection';
    failureCauseCode = 'serving-bootstrap.connection-failed';
    await dependencies.closePersistenceClient(activeClient);
    clientClosed = true;
    dependencies.writeStdout(`${canonicalizeJson(summary).text}\n`);
    return 0;
  } catch (error) {
    if (client !== undefined && !clientClosed) {
      try {
        await dependencies.closePersistenceClient(client);
      } catch {
        // Cleanup must not alter or expand the bounded failure diagnostic.
      }
    }
    const diagnostic: ServingCatalogBootstrapFailureDiagnosticV1 =
      Object.freeze({
        causeCode: safeFailureCauseCode(failureStage, failureCauseCode, error),
        stage: failureStage,
      });
    dependencies.writeStderr(`${canonicalizeJson(diagnostic).text}\n`);
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

function currentDatabasePreconditionCause(
  value: MigrationVerification,
):
  | 'serving-bootstrap.migration-precondition'
  | 'serving-bootstrap.postgresql-version-precondition'
  | undefined {
  if (!isSupportedPostgresqlVersion(value.postgresqlVersion)) {
    return 'serving-bootstrap.postgresql-version-precondition';
  }
  if (
    value.migrations.length !== 7 ||
    value.migrations.at(-1)?.version !== 7 ||
    value.migrations.at(-1)?.name !== 'artifact-evidence-serving'
  ) {
    return 'serving-bootstrap.migration-precondition';
  }
  return undefined;
}

function isSupportedPostgresqlVersion(value: string): boolean {
  const match = /^(\d+)[.](\d+)(?:[.\s]|$)/u.exec(value);
  if (match?.[1] === undefined || match[2] === undefined) {
    return false;
  }
  const major = Number(match[1]);
  const minor = Number(match[2]);
  return (
    Number.isSafeInteger(major) &&
    major === SUPPORTED_POSTGRESQL_MAJOR &&
    Number.isSafeInteger(minor) &&
    minor >= MINIMUM_SUPPORTED_POSTGRESQL_MINOR
  );
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

function safeFailureCauseCode(
  stage: ServingCatalogBootstrapFailureStageV1,
  fallback: ServingCatalogBootstrapFailureCauseCodeV1,
  error: unknown,
): ServingCatalogBootstrapFailureCauseCodeV1 {
  if (
    error instanceof PersistenceError &&
    (stage === 'database-connection' ||
      stage === 'database-precondition' ||
      stage === 'persistence-write')
  ) {
    return error.code;
  }
  return fallback;
}
