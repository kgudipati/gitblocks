import { randomBytes } from 'node:crypto';
import { access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { execFile as execFileCallback, spawn } from 'node:child_process';

import postgres, { type Sql } from 'postgres';

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

export type DatabaseCommandConfig =
  | {
      readonly mode: 'test';
      readonly config: PersistenceClientConfig;
    }
  | {
      readonly mode: 'production';
      readonly config: PersistenceClientConfig;
    };

export class DatabaseCommandConfigurationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'DatabaseCommandConfigurationError';
    Object.defineProperty(this, 'stack', {
      configurable: false,
      enumerable: false,
      value: undefined,
      writable: false,
    });
  }
}

const PRODUCTION_ACKNOWLEDGEMENT = 'managed-production';
const TEST_DATABASE_ENVIRONMENT_NAMES = [
  'GITBLOCKS_TEST_DB_HOST',
  'GITBLOCKS_TEST_DB_PORT',
  'GITBLOCKS_TEST_DB_DATABASE',
  'GITBLOCKS_TEST_DB_OWNER',
  'GITBLOCKS_TEST_DB_PASSWORD',
  'GITBLOCKS_DB_TEST_ACK',
] as const;
const PRODUCTION_DATABASE_ENVIRONMENT_NAMES = [
  'DATABASE_URL',
  'GITBLOCKS_DB_PRODUCTION_ACK',
] as const;
const SERVING_GROUP_ROLE = 'gitblocks_serving';
const SERVING_LOGIN_LOCK_KEY = 776985962084714119n;
const SERVING_TABLE_NAMES = [
  'candidate_capability_families',
  'candidate_limitations',
  'candidate_material_unknowns',
  'catalog_candidates',
  'evidence_invalidations',
  'evidence_observations',
  'evidence_supersessions',
  'repository_artifact_chunks',
  'repository_artifact_set_entries',
  'repository_artifact_sets',
  'repository_artifacts',
  'serving_candidate_profile_records',
  'serving_candidate_retrieval_metadata_records',
  'serving_catalog_current_snapshot',
  'serving_catalog_snapshots',
] as const;

export interface ServingLoginInspection {
  readonly attributes: {
    readonly login: boolean;
    readonly superuser: boolean;
    readonly bypassRowSecurity: boolean;
    readonly createDatabase: boolean;
    readonly createRole: boolean;
    readonly inherit: boolean;
    readonly replication: boolean;
  };
  readonly memberships: readonly string[];
  readonly membershipWithAdminOptionCount: number;
  readonly servingTableCount: number;
  readonly selectableServingTableCount: number;
  readonly selectableNonServingTableCount: number;
  readonly writableTableCount: number;
  readonly otherTablePrivilegeCount: number;
  readonly databaseCreate: boolean;
  readonly databaseTemporary: boolean;
  readonly creatableSchemaCount: number;
  readonly ownedObjectCount: number;
}

export interface ServingLoginVerificationReport {
  readonly schemaVersion: '1.0.0';
  readonly status: 'serving-login-verified';
  readonly groupRole: 'gitblocks_serving';
  readonly attributes: ServingLoginInspection['attributes'];
  readonly memberships: {
    readonly count: number;
    readonly onlyServingGroup: true;
    readonly adminOptionAllowed: false;
  };
  readonly tablePrivileges: {
    readonly servingTableCount: number;
    readonly selectAllowed: true;
    readonly nonServingSelectAllowed: false;
    readonly insertAllowed: false;
    readonly updateAllowed: false;
    readonly deleteAllowed: false;
    readonly otherAllowed: false;
  };
  readonly ddl: {
    readonly databaseCreateAllowed: false;
    readonly databaseTemporaryAllowed: false;
    readonly schemaCreateAllowed: false;
    readonly ownsObjects: false;
  };
}

export class ServingLoginOperatorError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'ServingLoginOperatorError';
    Object.defineProperty(this, 'stack', {
      configurable: false,
      enumerable: false,
      value: undefined,
      writable: false,
    });
  }
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

export function readProductionDatabaseConfig():
  PersistenceClientConfig | undefined {
  const connectionString = process.env['DATABASE_URL'];
  const acknowledgement = process.env['GITBLOCKS_DB_PRODUCTION_ACK'];
  if (connectionString === undefined && acknowledgement === undefined) {
    return undefined;
  }
  if (acknowledgement !== PRODUCTION_ACKNOWLEDGEMENT) {
    throw new DatabaseCommandConfigurationError(
      'GITBLOCKS_DB_PRODUCTION_ACK must equal managed-production.',
    );
  }
  if (connectionString === undefined || connectionString.length === 0) {
    throw new DatabaseCommandConfigurationError(
      'DATABASE_URL is required for production PostgreSQL configuration.',
    );
  }

  const parsed = parseProductionDatabaseUrl(connectionString);
  return {
    ...parsed,
    maximumConnections: 5,
    connectTimeoutMilliseconds: 5_000,
    idleTimeoutMilliseconds: 5_000,
    statementTimeoutMilliseconds: 10_000,
    lockTimeoutMilliseconds: 5_000,
  };
}

export function readDatabaseCommandConfig(): DatabaseCommandConfig | undefined {
  const testConfigured = TEST_DATABASE_ENVIRONMENT_NAMES.some(
    (name) => process.env[name] !== undefined,
  );
  const productionConfigured = PRODUCTION_DATABASE_ENVIRONMENT_NAMES.some(
    (name) => process.env[name] !== undefined,
  );
  if (testConfigured && productionConfigured) {
    throw new DatabaseCommandConfigurationError(
      'GITBLOCKS_TEST_DB_* and GITBLOCKS_DB_TEST_ACK are mutually exclusive with DATABASE_URL and GITBLOCKS_DB_PRODUCTION_ACK.',
    );
  }
  if (testConfigured) {
    const config = readInjectedDatabaseConfig();
    if (config === undefined) {
      throw new DatabaseCommandConfigurationError(
        'GITBLOCKS_TEST_DB_* configuration is required with GITBLOCKS_DB_TEST_ACK.',
      );
    }
    return { mode: 'test', config };
  }
  if (productionConfigured) {
    const config = readProductionDatabaseConfig();
    if (config === undefined) {
      throw new DatabaseCommandConfigurationError(
        'DATABASE_URL and GITBLOCKS_DB_PRODUCTION_ACK are required.',
      );
    }
    return { mode: 'production', config };
  }
  return undefined;
}

function parseProductionDatabaseUrl(
  connectionString: string,
): Pick<
  PersistenceClientConfig,
  'host' | 'port' | 'database' | 'username' | 'password' | 'ssl'
> {
  let parsed: URL;
  try {
    parsed = new URL(connectionString);
  } catch {
    throw invalidDatabaseUrl();
  }
  if (
    (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') ||
    parsed.hostname.length === 0 ||
    parsed.username.length === 0 ||
    parsed.password.length === 0 ||
    parsed.pathname.length <= 1 ||
    parsed.hash.length > 0
  ) {
    throw invalidDatabaseUrl();
  }

  let username: string;
  let password: string;
  let database: string;
  try {
    username = decodeURIComponent(parsed.username);
    password = decodeURIComponent(parsed.password);
    database = decodeURIComponent(parsed.pathname.slice(1));
  } catch {
    throw invalidDatabaseUrl();
  }
  const host = unbracketIpv6Host(parsed.hostname);
  const port = parsed.port.length === 0 ? 5432 : Number(parsed.port);
  if (
    !isBoundedDatabaseUrlText(host, 255) ||
    !isBoundedDatabaseUrlText(database, 63) ||
    !isBoundedDatabaseUrlText(username, 63) ||
    !isBoundedDatabaseUrlText(password, 4_096) ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65_535
  ) {
    throw invalidDatabaseUrl();
  }
  if (database.toLowerCase().endsWith('_test')) {
    throw new DatabaseCommandConfigurationError(
      'DATABASE_URL database name must not end in _test.',
    );
  }

  const sslmodes = parsed.searchParams.getAll('sslmode');
  if (sslmodes.length > 1) {
    throw new DatabaseCommandConfigurationError(
      'DATABASE_URL sslmode is invalid.',
    );
  }
  const sslmode = sslmodes[0] ?? 'require';
  const ssl: PersistenceClientConfig['ssl'] =
    sslmode === 'disable'
      ? false
      : sslmode === 'allow' ||
          sslmode === 'prefer' ||
          sslmode === 'require' ||
          sslmode === 'verify-full'
        ? sslmode
        : (() => {
            throw new DatabaseCommandConfigurationError(
              'DATABASE_URL sslmode is invalid.',
            );
          })();
  return { host, port, database, username, password, ssl };
}

function invalidDatabaseUrl(): DatabaseCommandConfigurationError {
  return new DatabaseCommandConfigurationError('DATABASE_URL is invalid.');
}

function unbracketIpv6Host(host: string): string {
  return host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host;
}

function isBoundedDatabaseUrlText(
  value: string,
  maximumLength: number,
): boolean {
  if (value.length === 0 || value.length > maximumLength) {
    return false;
  }
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (
      codePoint === undefined ||
      (codePoint >= 0 && codePoint <= 31) ||
      codePoint === 127
    ) {
      return false;
    }
  }
  return true;
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
    if (tables.length !== 29 || tables.some((table) => table.rowsecurity)) {
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
      where rolname in ('gitblocks_persistence', 'gitblocks_serving')
      order by rolname
    `;
    if (
      roles.length !== 2 ||
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
      functionCount !== 9 ||
      triggerCount !== 56 ||
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

export async function configureAndVerifyServingLogin(
  config: PersistenceClientConfig,
): Promise<ServingLoginVerificationReport> {
  const roleName = process.env['GITBLOCKS_SERVING_LOGIN_ROLE'];
  const password = process.env['GITBLOCKS_SERVING_LOGIN_PASSWORD'];
  if (roleName === undefined || roleName.length === 0) {
    throw new DatabaseCommandConfigurationError(
      'GITBLOCKS_SERVING_LOGIN_ROLE is required.',
    );
  }
  if (!/^[a-z][a-z0-9_]{0,62}$/u.test(roleName)) {
    throw new DatabaseCommandConfigurationError(
      'GITBLOCKS_SERVING_LOGIN_ROLE is invalid.',
    );
  }
  if (
    roleName === SERVING_GROUP_ROLE ||
    roleName === 'gitblocks_persistence' ||
    roleName.startsWith('pg_') ||
    roleName === config.username
  ) {
    throw new DatabaseCommandConfigurationError(
      'GITBLOCKS_SERVING_LOGIN_ROLE must identify a separate unprivileged login.',
    );
  }
  if (
    password === undefined ||
    password.length < 16 ||
    password.length > 4_096 ||
    password.includes('\u0000')
  ) {
    throw new DatabaseCommandConfigurationError(
      'GITBLOCKS_SERVING_LOGIN_PASSWORD is missing or invalid.',
    );
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
    await enforceServingLogin(sql, roleName, password, config.database);
    return validateServingLoginInspection(
      await inspectServingLogin(sql, roleName),
    );
  } catch (error) {
    if (
      error instanceof DatabaseCommandConfigurationError ||
      error instanceof ServingLoginOperatorError
    ) {
      throw error;
    }
    const code = safeDatabaseErrorCode(error);
    throw new ServingLoginOperatorError(
      code === undefined
        ? 'Serving login could not be enforced with the DATABASE_URL operator authority.'
        : `Serving login could not be enforced with the DATABASE_URL operator authority (PostgreSQL ${code}).`,
    );
  } finally {
    await sql.end({ timeout: 5 }).catch(() => undefined);
  }
}

function safeDatabaseErrorCode(error: unknown): string | undefined {
  if (
    typeof error !== 'object' ||
    error === null ||
    !Object.hasOwn(error, 'code')
  ) {
    return undefined;
  }
  try {
    const code = Reflect.get(error, 'code') as unknown;
    return typeof code === 'string' && /^[0-9A-Z]{5}$/u.test(code)
      ? code
      : undefined;
  } catch {
    return undefined;
  }
}

export function validateServingLoginInspection(
  inspection: ServingLoginInspection,
): ServingLoginVerificationReport {
  const valid =
    inspection.attributes.login &&
    !inspection.attributes.superuser &&
    !inspection.attributes.bypassRowSecurity &&
    !inspection.attributes.createDatabase &&
    !inspection.attributes.createRole &&
    inspection.attributes.inherit &&
    !inspection.attributes.replication &&
    inspection.memberships.length === 1 &&
    inspection.memberships[0] === SERVING_GROUP_ROLE &&
    inspection.membershipWithAdminOptionCount === 0 &&
    inspection.servingTableCount === SERVING_TABLE_NAMES.length &&
    inspection.selectableServingTableCount === SERVING_TABLE_NAMES.length &&
    inspection.selectableNonServingTableCount === 0 &&
    inspection.writableTableCount === 0 &&
    inspection.otherTablePrivilegeCount === 0 &&
    !inspection.databaseCreate &&
    !inspection.databaseTemporary &&
    inspection.creatableSchemaCount === 0 &&
    inspection.ownedObjectCount === 0;
  if (!valid) {
    throw new ServingLoginOperatorError('Serving login verification failed.');
  }
  return {
    schemaVersion: '1.0.0',
    status: 'serving-login-verified',
    groupRole: SERVING_GROUP_ROLE,
    attributes: inspection.attributes,
    memberships: {
      count: inspection.memberships.length,
      onlyServingGroup: true,
      adminOptionAllowed: false,
    },
    tablePrivileges: {
      servingTableCount: inspection.servingTableCount,
      selectAllowed: true,
      nonServingSelectAllowed: false,
      insertAllowed: false,
      updateAllowed: false,
      deleteAllowed: false,
      otherAllowed: false,
    },
    ddl: {
      databaseCreateAllowed: false,
      databaseTemporaryAllowed: false,
      schemaCreateAllowed: false,
      ownsObjects: false,
    },
  };
}

async function enforceServingLogin(
  sql: Sql,
  roleName: string,
  password: string,
  databaseName: string,
): Promise<void> {
  await sql.begin(async (transaction) => {
    await transaction`
      select pg_catalog.pg_advisory_xact_lock(
        ${SERVING_LOGIN_LOCK_KEY.toString()}::bigint
      )
    `;
    const group = await transaction<
      readonly {
        readonly safe: boolean;
      }[]
    >`
      select not (
        rolsuper
        or rolbypassrls
        or rolcanlogin
        or rolcreatedb
        or rolcreaterole
        or rolreplication
      ) as safe
      from pg_catalog.pg_roles
      where rolname = ${SERVING_GROUP_ROLE}
    `;
    if (group.length !== 1 || group[0]?.safe !== true) {
      throw new ServingLoginOperatorError(
        'Serving login requires the checked gitblocks_serving group.',
      );
    }

    const existing = await transaction<readonly { readonly exists: boolean }[]>`
      select exists(
        select 1
        from pg_catalog.pg_roles
        where rolname = ${roleName}
      ) as exists
    `;
    const verb = existing[0]?.exists === true ? 'alter' : 'create';
    const statements = await transaction<
      readonly { readonly statement: string }[]
    >`
      select pg_catalog.format(
        ${`${verb} role %I with login nosuperuser nocreatedb nocreaterole inherit noreplication nobypassrls connection limit -1 password %L valid until 'infinity'`}::text,
        ${roleName}::text,
        ${password}::text
      ) as statement
    `;
    const statement = statements[0]?.statement;
    if (statement === undefined) {
      throw new ServingLoginOperatorError(
        'Serving login role statement could not be prepared.',
      );
    }
    await transaction.unsafe(statement).simple();

    const directMemberships = await transaction<
      readonly { readonly role_name: string }[]
    >`
      select parent.rolname as role_name
      from pg_catalog.pg_auth_members as membership
      join pg_catalog.pg_roles as parent
        on parent.oid = membership.roleid
      join pg_catalog.pg_roles as member
        on member.oid = membership.member
      where member.rolname = ${roleName}
        and parent.rolname <> ${SERVING_GROUP_ROLE}
      order by parent.rolname
    `;
    for (const membership of directMemberships) {
      await transaction`revoke ${transaction(membership.role_name)} from ${transaction(roleName)}`;
    }

    await transaction`grant ${transaction(SERVING_GROUP_ROLE)} to ${transaction(roleName)}`;
    await transaction`revoke admin option for ${transaction(SERVING_GROUP_ROLE)} from ${transaction(roleName)}`;
    await transaction`revoke all privileges on database ${transaction(databaseName)} from ${transaction(roleName)}`;
    await transaction`revoke all privileges on schema gitblocks from ${transaction(roleName)}`;
    await transaction`revoke all privileges on all tables in schema gitblocks from ${transaction(roleName)}`;
    await transaction`revoke all privileges on all sequences in schema gitblocks from ${transaction(roleName)}`;
    await transaction`revoke all privileges on all functions in schema gitblocks from ${transaction(roleName)}`;
  });
}

async function inspectServingLogin(
  sql: Sql,
  roleName: string,
): Promise<ServingLoginInspection> {
  const roles = await sql<
    readonly {
      readonly rolcanlogin: boolean;
      readonly rolsuper: boolean;
      readonly rolbypassrls: boolean;
      readonly rolcreatedb: boolean;
      readonly rolcreaterole: boolean;
      readonly rolinherit: boolean;
      readonly rolreplication: boolean;
    }[]
  >`
    select
      rolcanlogin,
      rolsuper,
      rolbypassrls,
      rolcreatedb,
      rolcreaterole,
      rolinherit,
      rolreplication
    from pg_catalog.pg_roles
    where rolname = ${roleName}
  `;
  const role = roles[0];
  if (roles.length !== 1 || role === undefined) {
    throw new ServingLoginOperatorError('Serving login verification failed.');
  }
  const memberships = await sql<
    readonly {
      readonly role_name: string;
      readonly admin_option: boolean;
    }[]
  >`
    select parent.rolname as role_name, direct.admin_option
    from pg_catalog.pg_roles as parent
    left join pg_catalog.pg_roles as member
      on member.rolname = ${roleName}
    left join pg_catalog.pg_auth_members as direct
      on direct.roleid = parent.oid
      and direct.member = member.oid
    where parent.rolname <> ${roleName}
      and pg_catalog.pg_has_role(${roleName}::text, parent.oid, 'MEMBER')
    order by parent.rolname
  `;
  const tables = await sql<
    readonly {
      readonly serving_table_count: number;
      readonly selectable_serving_table_count: number;
      readonly selectable_non_serving_table_count: number;
      readonly writable_table_count: number;
      readonly other_table_privilege_count: number;
    }[]
  >`
    select
      pg_catalog.count(*) filter (
        where class.relname = any(
          ${sql.array([...SERVING_TABLE_NAMES])}::text[]
        )
      )::integer as serving_table_count,
      pg_catalog.count(*) filter (
        where class.relname = any(
          ${sql.array([...SERVING_TABLE_NAMES])}::text[]
        )
        and pg_catalog.has_table_privilege(
          ${roleName}::text, class.oid, 'SELECT'
        )
      )::integer as selectable_serving_table_count,
      pg_catalog.count(*) filter (
        where class.relname <> all(
          ${sql.array([...SERVING_TABLE_NAMES])}::text[]
        )
        and pg_catalog.has_table_privilege(
          ${roleName}::text, class.oid, 'SELECT'
        )
      )::integer as selectable_non_serving_table_count,
      pg_catalog.count(*) filter (
        where pg_catalog.has_table_privilege(
          ${roleName}::text, class.oid, 'INSERT,UPDATE,DELETE'
        )
      )::integer as writable_table_count,
      pg_catalog.count(*) filter (
        where pg_catalog.has_table_privilege(
          ${roleName}::text, class.oid, 'TRUNCATE,REFERENCES,TRIGGER'
        )
      )::integer as other_table_privilege_count
    from pg_catalog.pg_class as class
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = class.relnamespace
    where namespace.nspname = 'gitblocks'
      and class.relkind = 'r'
  `;
  const ddl = await sql<
    readonly {
      readonly database_create: boolean;
      readonly database_temporary: boolean;
      readonly creatable_schema_count: number;
      readonly owned_object_count: number;
    }[]
  >`
    select
      pg_catalog.has_database_privilege(
        ${roleName}::text, pg_catalog.current_database(), 'CREATE'
      ) as database_create,
      pg_catalog.has_database_privilege(
        ${roleName}::text, pg_catalog.current_database(), 'TEMPORARY'
      ) as database_temporary,
      (
        select pg_catalog.count(*)::integer
        from pg_catalog.pg_namespace as namespace
        where namespace.nspname <> 'information_schema'
          and namespace.nspname !~ '^pg_'
          and pg_catalog.has_schema_privilege(
            ${roleName}::text, namespace.oid, 'CREATE'
          )
      ) as creatable_schema_count,
      (
        select pg_catalog.count(*)::integer
        from pg_catalog.pg_shdepend as dependency
        join pg_catalog.pg_roles as owner
          on owner.oid = dependency.refobjid
        where dependency.refclassid =
            'pg_catalog.pg_authid'::pg_catalog.regclass
          and dependency.deptype = 'o'
          and owner.rolname = ${roleName}
          and (
            dependency.dbid = 0
            or dependency.dbid = (
              select database.oid
              from pg_catalog.pg_database as database
              where database.datname = pg_catalog.current_database()
            )
          )
      ) as owned_object_count
  `;
  const table = tables[0];
  const ddlInspection = ddl[0];
  if (table === undefined || ddlInspection === undefined) {
    throw new ServingLoginOperatorError('Serving login verification failed.');
  }
  return {
    attributes: {
      login: role.rolcanlogin,
      superuser: role.rolsuper,
      bypassRowSecurity: role.rolbypassrls,
      createDatabase: role.rolcreatedb,
      createRole: role.rolcreaterole,
      inherit: role.rolinherit,
      replication: role.rolreplication,
    },
    memberships: memberships.map((membership) => membership.role_name),
    membershipWithAdminOptionCount: memberships.filter(
      (membership) => membership.admin_option,
    ).length,
    servingTableCount: table.serving_table_count,
    selectableServingTableCount: table.selectable_serving_table_count,
    selectableNonServingTableCount: table.selectable_non_serving_table_count,
    writableTableCount: table.writable_table_count,
    otherTablePrivilegeCount: table.other_table_privilege_count,
    databaseCreate: ddlInspection.database_create,
    databaseTemporary: ddlInspection.database_temporary,
    creatableSchemaCount: ddlInspection.creatable_schema_count,
    ownedObjectCount: ddlInspection.owned_object_count,
  };
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
