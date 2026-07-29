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
  readonly forcedRlsTables: number;
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
        readonly rowsecurity: boolean;
        readonly forcerowsecurity: boolean;
      }[]
    >`
      select
        class.relrowsecurity as rowsecurity,
        class.relforcerowsecurity as forcerowsecurity
      from pg_catalog.pg_class as class
      join pg_catalog.pg_namespace as namespace
        on namespace.oid = class.relnamespace
      where namespace.nspname = 'gitblocks'
        and class.relkind = 'r'
        and class.relname <> 'schema_migrations'
    `;
    if (
      tables.length !== 15 ||
      tables.some((table) => !table.rowsecurity || !table.forcerowsecurity)
    ) {
      throw new Error('PostgreSQL row-isolation catalog check failed.');
    }
    const roles = await sql<
      readonly {
        readonly rolname: string;
        readonly rolsuper: boolean;
        readonly rolbypassrls: boolean;
      }[]
    >`
      select rolname, rolsuper, rolbypassrls
      from pg_catalog.pg_roles
      where rolname in ('gitblocks_runtime', 'gitblocks_public_writer')
    `;
    if (
      roles.length !== 2 ||
      roles.some((role) => role.rolsuper || role.rolbypassrls)
    ) {
      throw new Error('PostgreSQL runtime-role catalog check failed.');
    }
    return { verification, forcedRlsTables: tables.length };
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
