import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
  closePersistenceClient,
  createPersistenceClient,
  putCatalogCandidate,
  setCandidateCapabilityFamilies,
  verifyMigrations,
  type MigrationVerification,
  type OperationControl,
  type PersistenceClient,
  type PersistenceClientConfig,
  type PutCatalogCandidateCommand,
  type SetCandidateCapabilityFamiliesCommand,
} from '@gitblocks/persistence';

import {
  canonicalizeJson,
  createPublicCatalogSeedPlan,
  parsePublicCatalog,
  seedPublicCatalogV1,
} from '../src/index.ts';
import { withVerifiedArtifactLiveDatabaseMigrationV1 } from './artifact-live-authority.ts';

const ACKNOWLEDGEMENT = 'approved-non-production-public-catalog-seed';
const DATABASE_SCOPE = 'ephemeral-non-production';
const FAILURE_DIAGNOSTIC = 'Catalog seed failed.\n';

export interface CatalogSeedCliDependenciesV1 {
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
  readonly writeStdout: (text: string) => void;
  readonly writeStderr: (text: string) => void;
}

const PROCESS_DEPENDENCIES: CatalogSeedCliDependenciesV1 = Object.freeze({
  readTextFile: (path: string) => readFile(path, 'utf8'),
  readEnvironment: (name: string) => process.env[name],
  createPersistenceClient,
  closePersistenceClient,
  verifyMigrations,
  putCatalogCandidate,
  setCandidateCapabilityFamilies,
  writeStdout: (text: string) => process.stdout.write(text),
  writeStderr: (text: string) => process.stderr.write(text),
});

export async function runCatalogSeedCliV1(
  arguments_: readonly string[],
  dependencies: CatalogSeedCliDependenciesV1 = PROCESS_DEPENDENCIES,
): Promise<0 | 1> {
  let client: PersistenceClient | undefined;
  let clientClosed = false;
  try {
    const catalogPath = parseCatalogSeedArgumentsV1(arguments_).catalogPath;
    requireExactAuthority(dependencies);
    const catalog = parsePublicCatalog(
      await dependencies.readTextFile(resolve(catalogPath)),
    );
    createPublicCatalogSeedPlan(catalog);
    const databaseConfig = readDatabaseConfig(dependencies);
    const activeClient = dependencies.createPersistenceClient(databaseConfig);
    client = activeClient;
    const persistence = Object.freeze({
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
    });
    const summary = await withVerifiedArtifactLiveDatabaseMigrationV1(
      () => dependencies.verifyMigrations(activeClient),
      (databaseMigrationVersion) =>
        seedPublicCatalogV1({
          catalog,
          databaseMigrationVersion,
          persistence,
        }),
    );
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

export function parseCatalogSeedArgumentsV1(arguments_: readonly string[]): {
  readonly catalogPath: string;
} {
  if (
    arguments_.length !== 2 ||
    arguments_[0] !== '--catalog' ||
    arguments_[1] === undefined ||
    arguments_[1].length === 0
  ) {
    throw new Error('Catalog seed configuration is invalid.');
  }
  return Object.freeze({ catalogPath: arguments_[1] });
}

function requireExactAuthority(
  dependencies: CatalogSeedCliDependenciesV1,
): void {
  if (
    dependencies.readEnvironment('GITBLOCKS_CATALOG_SEED_ACKNOWLEDGEMENT') !==
    ACKNOWLEDGEMENT
  ) {
    throw new Error('Catalog seed authority is invalid.');
  }
  if (
    dependencies.readEnvironment('GITBLOCKS_CATALOG_SEED_DB_SCOPE') !==
    DATABASE_SCOPE
  ) {
    throw new Error('Catalog seed authority is invalid.');
  }
}

function readDatabaseConfig(
  dependencies: CatalogSeedCliDependenciesV1,
): PersistenceClientConfig {
  const host = requiredEnvironment(
    dependencies,
    'GITBLOCKS_CATALOG_SEED_DB_HOST',
  );
  const portText = requiredEnvironment(
    dependencies,
    'GITBLOCKS_CATALOG_SEED_DB_PORT',
  );
  const database = requiredEnvironment(
    dependencies,
    'GITBLOCKS_CATALOG_SEED_DB_DATABASE',
  );
  const username = requiredEnvironment(
    dependencies,
    'GITBLOCKS_CATALOG_SEED_DB_USERNAME',
  );
  const password = requiredEnvironment(
    dependencies,
    'GITBLOCKS_CATALOG_SEED_DB_PASSWORD',
  );
  const sslText = requiredEnvironment(
    dependencies,
    'GITBLOCKS_CATALOG_SEED_DB_SSL',
  );
  const port = Number(portText);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('Catalog seed database configuration is invalid.');
  }
  if (sslText !== 'false' && sslText !== 'require') {
    throw new Error('Catalog seed database configuration is invalid.');
  }
  return Object.freeze({
    host,
    port,
    database,
    username,
    password,
    ssl: sslText === 'require' ? 'require' : false,
    maximumConnections: 2,
    connectTimeoutMilliseconds: 5_000,
    idleTimeoutMilliseconds: 5_000,
    statementTimeoutMilliseconds: 10_000,
    lockTimeoutMilliseconds: 5_000,
  });
}

function requiredEnvironment(
  dependencies: CatalogSeedCliDependenciesV1,
  name: string,
): string {
  const value = dependencies.readEnvironment(name);
  if (value === undefined || value.length === 0) {
    throw new Error('Catalog seed database configuration is invalid.');
  }
  return value;
}
