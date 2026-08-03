import { randomBytes } from 'node:crypto';
import { access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { execFile as execFileCallback, spawn } from 'node:child_process';

import postgres from 'postgres';

import {
  applyMigrations,
  closePersistenceClient,
  createPersistenceClient,
  verifyMigrations,
  type MigrationVerification,
  type PersistenceClientConfig,
} from '../src/index.ts';

const execFile = promisify(execFileCallback);

export const POSTGRES_IMAGE =
  'postgres:18.4-bookworm@sha256:1961f96e6029a02c3812d7cb329a3b03a3ac2bb067058dec17b0f5596aca9296';

export interface TestDatabase {
  readonly config: PersistenceClientConfig;
  readonly environment: Readonly<Record<string, string>>;
  readonly cleanup: () => Promise<void>;
}

export function readInjectedDatabaseConfig():
  PersistenceClientConfig | undefined {
  const names = [
    'GITBLOCKS_TEST_DB_HOST',
    'GITBLOCKS_TEST_DB_PORT',
    'GITBLOCKS_TEST_DB_DATABASE',
    'GITBLOCKS_TEST_DB_OWNER',
    'GITBLOCKS_TEST_DB_PASSWORD',
  ] as const;
  const values = names.map((name) => process.env[name]);
  if (values.every((value) => value === undefined)) {
    return undefined;
  }
  if (values.some((value) => value === undefined || value.length === 0)) {
    throw new Error('PostgreSQL test configuration is incomplete.');
  }
  if (process.env['GITBLOCKS_DB_TEST_ACK'] !== 'ephemeral') {
    throw new Error('PostgreSQL test database must be explicitly ephemeral.');
  }
  const [host, portText, database, username, password] = values as [
    string,
    string,
    string,
    string,
    string,
  ];
  if (!database.endsWith('_test')) {
    throw new Error('PostgreSQL test database name must end in _test.');
  }
  const port = Number(portText);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PostgreSQL test port is invalid.');
  }
  return {
    host,
    port,
    database,
    username,
    password,
    ssl: false,
    maximumConnections: 5,
    connectTimeoutMilliseconds: 5_000,
    idleTimeoutMilliseconds: 5_000,
    statementTimeoutMilliseconds: 10_000,
    lockTimeoutMilliseconds: 5_000,
  };
}

export async function provisionTestDatabase(): Promise<TestDatabase> {
  const injected = readInjectedDatabaseConfig();
  if (injected !== undefined) {
    return {
      config: injected,
      environment: environmentFor(injected),
      cleanup: () => Promise.resolve(),
    };
  }

  const docker = await findDockerBinary();
  const containerName = `gitblocks-phase4-${String(process.pid)}`;
  const password = randomBytes(24).toString('hex');
  await runDocker(docker, [
    'run',
    '--detach',
    '--name',
    containerName,
    '--rm',
    '--publish',
    '127.0.0.1::5432',
    '--env',
    `POSTGRES_PASSWORD=${password}`,
    '--env',
    'POSTGRES_DB=gitblocks_test',
    '--health-cmd=pg_isready -U postgres -d gitblocks_test',
    '--health-interval=1s',
    '--health-timeout=3s',
    '--health-retries=30',
    POSTGRES_IMAGE,
  ]);

  let cleaned = false;
  const cleanup = async (): Promise<void> => {
    if (cleaned) {
      return;
    }
    cleaned = true;
    try {
      await runDocker(docker, ['rm', '--force', containerName]);
    } catch {
      throw new Error('Ephemeral PostgreSQL cleanup failed.');
    }
  };

  try {
    await waitForHealthyContainer(docker, containerName);
    const portOutput = await runDocker(docker, [
      'port',
      containerName,
      '5432/tcp',
    ]);
    const match = /127\.0\.0\.1:(\d{1,5})/u.exec(portOutput);
    if (match?.[1] === undefined) {
      throw new Error('Ephemeral PostgreSQL port was not assigned.');
    }
    const port = Number(match[1]);
    const config: PersistenceClientConfig = {
      host: '127.0.0.1',
      port,
      database: 'gitblocks_test',
      username: 'postgres',
      password,
      ssl: false,
      maximumConnections: 5,
      connectTimeoutMilliseconds: 5_000,
      idleTimeoutMilliseconds: 5_000,
      statementTimeoutMilliseconds: 10_000,
      lockTimeoutMilliseconds: 5_000,
    };
    return { config, environment: environmentFor(config), cleanup };
  } catch (error) {
    await cleanup();
    throw error;
  }
}

export async function migrateDatabase(
  config: PersistenceClientConfig,
): Promise<MigrationVerification> {
  const client = createPersistenceClient(config);
  try {
    return await applyMigrations(client);
  } finally {
    await closePersistenceClient(client);
  }
}

export async function checkDatabase(config: PersistenceClientConfig): Promise<{
  readonly verification: MigrationVerification;
  readonly productTables: number;
  readonly rowSecurityPolicies: number;
  readonly schemaFunctions: number;
  readonly triggers: number;
  readonly requiredIndexes: number;
}> {
  const client = createPersistenceClient(config);
  let verification: MigrationVerification;
  try {
    verification = await verifyMigrations(client);
  } finally {
    await closePersistenceClient(client);
  }
  const sql = postgres({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.username,
    password: config.password,
    ssl: config.ssl,
    max: 1,
    connect_timeout: 5,
    idle_timeout: 5,
    onnotice: () => undefined,
    debug: false,
  });
  try {
    const tables = await sql<
      readonly {
        readonly relname: string;
        readonly rowsecurity: boolean;
      }[]
    >`
      select
        class.relname,
        class.relrowsecurity as rowsecurity
      from pg_catalog.pg_class as class
      join pg_catalog.pg_namespace as namespace
        on namespace.oid = class.relnamespace
      where namespace.nspname = 'gitblocks'
        and class.relkind = 'r'
        and class.relname <> 'schema_migrations'
    `;
    if (tables.length !== 25 || tables.some((table) => table.rowsecurity)) {
      throw new Error('PostgreSQL public-table catalog check failed.');
    }
    const roles = await sql<
      readonly {
        readonly rolname: string;
        readonly rolsuper: boolean;
        readonly rolbypassrls: boolean;
        readonly rolcanlogin: boolean;
        readonly rolcreatedb: boolean;
        readonly rolcreaterole: boolean;
        readonly rolreplication: boolean;
      }[]
    >`
      select
        rolname,
        rolsuper,
        rolbypassrls,
        rolcanlogin,
        rolcreatedb,
        rolcreaterole,
        rolreplication
      from pg_catalog.pg_roles
      where rolname = 'gitblocks_persistence'
    `;
    if (
      roles.length !== 1 ||
      roles.some(
        (role) =>
          role.rolsuper ||
          role.rolbypassrls ||
          role.rolcanlogin ||
          role.rolcreatedb ||
          role.rolcreaterole ||
          role.rolreplication,
      )
    ) {
      throw new Error('PostgreSQL runtime-role catalog check failed.');
    }
    const policies = await sql<readonly { readonly count: number }[]>`
      select pg_catalog.count(*)::integer as count
      from pg_catalog.pg_policy as policy
      join pg_catalog.pg_class as class
        on class.oid = policy.polrelid
      join pg_catalog.pg_namespace as namespace
        on namespace.oid = class.relnamespace
      where namespace.nspname = 'gitblocks'
    `;
    const functions = await sql<readonly { readonly count: number }[]>`
      select pg_catalog.count(*)::integer as count
      from pg_catalog.pg_proc as procedure
      join pg_catalog.pg_namespace as namespace
        on namespace.oid = procedure.pronamespace
      where namespace.nspname = 'gitblocks'
    `;
    const triggers = await sql<readonly { readonly count: number }[]>`
      select pg_catalog.count(*)::integer as count
      from pg_catalog.pg_trigger as trigger
      join pg_catalog.pg_class as class
        on class.oid = trigger.tgrelid
      join pg_catalog.pg_namespace as namespace
        on namespace.oid = class.relnamespace
      where namespace.nspname = 'gitblocks'
        and not trigger.tgisinternal
    `;
    const requiredIndexNames = [
      'catalog_candidates_repository_identity',
      'catalog_candidates_package_identity',
      'evidence_observations_active_world',
      'candidate_limitations_active_world',
      'candidate_material_unknowns_active_world',
      'evidence_supersessions_active',
      'evidence_supersessions_cycle',
      'evidence_invalidations_active',
      'candidate_dossier_snapshots_history',
      'repository_artifacts_context',
      'repository_artifact_chunks_reconstruction',
      'repository_artifact_sets_history',
      'repository_artifact_set_entries_resolved_path',
      'repository_artifact_sets_interview_identity',
      'model_executions_reuse',
    ] as const;
    const indexes = await sql<readonly { readonly indexname: string }[]>`
      select indexname
      from pg_catalog.pg_indexes
      where schemaname = 'gitblocks'
        and indexname =
          any(${sql.array([...requiredIndexNames])}::text[])
    `;
    const policyCount = policies[0]?.count;
    const functionCount = functions[0]?.count;
    const triggerCount = triggers[0]?.count;
    if (
      policyCount !== 0 ||
      functionCount !== 7 ||
      triggerCount !== 48 ||
      indexes.length !== requiredIndexNames.length
    ) {
      throw new Error('PostgreSQL public-schema invariant check failed.');
    }
    return {
      verification,
      productTables: tables.length,
      rowSecurityPolicies: policyCount,
      schemaFunctions: functionCount,
      triggers: triggerCount,
      requiredIndexes: indexes.length,
    };
  } finally {
    await sql.end({ timeout: 5 });
  }
}

export async function runDatabaseIntegrationTests(
  environment: Readonly<Record<string, string>>,
): Promise<void> {
  const vitest = fileURLToPath(
    new URL('../../../node_modules/vitest/vitest.mjs', import.meta.url),
  );
  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [vitest, 'run', '--config', 'vitest.db.config.ts'],
      {
        cwd: fileURLToPath(new URL('../../../', import.meta.url)),
        env: { ...process.env, ...environment },
        stdio: 'inherit',
      },
    );
    child.once('error', () => {
      reject(new Error('PostgreSQL integration test process failed.'));
    });
    child.once('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error('PostgreSQL integration tests failed.'));
      }
    });
  });
}

function environmentFor(
  config: PersistenceClientConfig,
): Readonly<Record<string, string>> {
  return {
    GITBLOCKS_DB_TEST_ACK: 'ephemeral',
    GITBLOCKS_TEST_DB_HOST: config.host,
    GITBLOCKS_TEST_DB_PORT: String(config.port),
    GITBLOCKS_TEST_DB_DATABASE: config.database,
    GITBLOCKS_TEST_DB_OWNER: config.username,
    GITBLOCKS_TEST_DB_PASSWORD: config.password,
  };
}

async function findDockerBinary(): Promise<string> {
  const configured = process.env['GITBLOCKS_DOCKER_BIN'];
  const candidates = [
    ...(configured === undefined ? [] : [configured]),
    'docker',
    '/Applications/Docker.app/Contents/Resources/bin/docker',
  ];
  for (const candidate of candidates) {
    if (candidate.includes('/')) {
      try {
        await access(candidate);
      } catch {
        continue;
      }
    }
    try {
      await runDocker(candidate, ['info', '--format', '{{.ServerVersion}}']);
      return candidate;
    } catch {
      // Continue through the fixed local candidates.
    }
  }
  throw new Error('A running Docker engine is required for PostgreSQL tests.');
}

async function waitForHealthyContainer(
  docker: string,
  containerName: string,
): Promise<void> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const status = await runDocker(docker, [
      'inspect',
      '--format',
      '{{.State.Health.Status}}',
      containerName,
    ]);
    if (status.trim() === 'healthy') {
      return;
    }
    if (status.trim() === 'unhealthy') {
      throw new Error('Ephemeral PostgreSQL health check failed.');
    }
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 1_000);
    });
  }
  throw new Error('Ephemeral PostgreSQL did not become healthy.');
}

async function runDocker(
  docker: string,
  arguments_: readonly string[],
): Promise<string> {
  try {
    const result = await execFile(docker, arguments_, {
      encoding: 'utf8',
      maxBuffer: 1024 * 1024,
    });
    return result.stdout;
  } catch {
    throw new Error('Docker command failed.');
  }
}
