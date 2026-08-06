import { createHash } from 'node:crypto';

import postgres from 'postgres';

import { closePersistenceClient, createPersistenceClient } from './client.ts';
import { applyMigrations, verifyMigrations } from './migrations.ts';
import type { PersistenceClientConfig } from './types.ts';

export const PROFILE_MATERIALIZATION_POSTGRES_IMAGE =
  'postgres:18.4-bookworm@sha256:1961f96e6029a02c3812d7cb329a3b03a3ac2bb067058dec17b0f5596aca9296' as const;
export const PROFILE_MATERIALIZATION_POSTGRES_STORAGE_ROOT =
  '/var/lib/postgresql' as const;
const PROFILE_MATERIALIZATION_STORAGE_INSPECTION_MAXIMUM_BYTES = 16_384;
const PROFILE_MATERIALIZATION_REQUIRED_TMPFS_OPTIONS = [
  'rw',
  'noexec',
  'nosuid',
  'nodev',
  'size=1073741824',
] as const;
export const PROFILE_MATERIALIZATION_EXPECTED_MIGRATIONS = [
  {
    version: 1,
    name: 'evidence-persistence',
    checksum:
      '569d7a6d6db70b1b04cadfa8798516ce4239b1179bb2f7cdd84b27641e33755f',
  },
  {
    version: 2,
    name: 'runtime-migration-verification',
    checksum:
      'b61cf8ad8673663c646b77e8f0ebed452898aab795aa64f52217e1271e1dc2ae',
  },
  {
    version: 3,
    name: 'immutable-repository-artifacts',
    checksum:
      '0ea1e4698e8eec6d33320df7af4758ae6b3b4fcbe3da387bb042d074b86228dc',
  },
  {
    version: 4,
    name: 'repository-interviews',
    checksum:
      '2cd18e7d92373215b2a540cdf12e32a7e949bfb01866616e8a44ad326e45bca0',
  },
] as const;
export const PROFILE_MATERIALIZATION_MIGRATION_INVENTORY_DIGEST = digestJson(
  PROFILE_MATERIALIZATION_EXPECTED_MIGRATIONS,
);

export const PROFILE_MATERIALIZATION_DATABASE_EXPECTATIONS = {
  initialMigrationCount: 0,
  initialProductTableCount: 0,
  finalMigrationCount: 4,
  finalProductTableCount: 25,
  rowSecurityPolicyCount: 0,
  schemaFunctionCount: 7,
  noninternalTriggerCount: 48,
  requiredIndexCount: 15,
} as const;
export const PROFILE_MATERIALIZATION_EXPECTED_DATABASE_SCHEMA_DIGEST =
  digestJson({
    postgresqlMajor: 18,
    productTableCount:
      PROFILE_MATERIALIZATION_DATABASE_EXPECTATIONS.finalProductTableCount,
    rowSecurityPolicyCount:
      PROFILE_MATERIALIZATION_DATABASE_EXPECTATIONS.rowSecurityPolicyCount,
    schemaFunctionCount:
      PROFILE_MATERIALIZATION_DATABASE_EXPECTATIONS.schemaFunctionCount,
    noninternalTriggerCount:
      PROFILE_MATERIALIZATION_DATABASE_EXPECTATIONS.noninternalTriggerCount,
    requiredIndexCount:
      PROFILE_MATERIALIZATION_DATABASE_EXPECTATIONS.requiredIndexCount,
    runtimeRoleSafe: true,
    runtimeMembership: true,
  });

export interface ProfileMaterializationDatabaseIdentity {
  readonly runId: string;
  readonly runIdDigest: string;
  readonly containerName: string;
  readonly networkName: string;
  readonly databaseName: string;
  readonly ownerRoleName: string;
  readonly runtimeRoleName: string;
}

export interface ProfileMaterializationProcessCommand {
  readonly program: 'docker';
  readonly arguments: readonly string[];
  readonly allowedEnvironmentNames: readonly string[];
  readonly maximumOutputBytes: number;
}

export interface ProfileMaterializationDatabasePlan {
  readonly image: typeof PROFILE_MATERIALIZATION_POSTGRES_IMAGE;
  readonly host: '127.0.0.1';
  readonly port: number;
  readonly identity: ProfileMaterializationDatabaseIdentity;
  readonly labels: readonly string[];
  readonly createNetwork: ProfileMaterializationProcessCommand;
  readonly createContainer: ProfileMaterializationProcessCommand;
  readonly inspectStorage: ProfileMaterializationProcessCommand;
  readonly inspectContainer: ProfileMaterializationProcessCommand;
  readonly inspectNetwork: ProfileMaterializationProcessCommand;
  readonly removeContainer: ProfileMaterializationProcessCommand;
  readonly removeNetwork: ProfileMaterializationProcessCommand;
  readonly expectations: typeof PROFILE_MATERIALIZATION_DATABASE_EXPECTATIONS;
  readonly migrations: typeof PROFILE_MATERIALIZATION_EXPECTED_MIGRATIONS;
  readonly planDigest: string;
}

export interface CreateProfileMaterializationDatabasePlanInput {
  readonly runId: string;
  readonly image: string;
  readonly host: string;
  readonly port: number;
  readonly ownerPasswordEnvironmentName: string;
}

export interface ProfileMaterializationDatabaseCredentials {
  readonly ownerUrl: string;
  readonly ownerPassword: string;
  readonly runtimeUrl: string;
  readonly runtimePassword: string;
}

export interface ProfileMaterializationPreparedDatabase {
  readonly runtimeConfig: PersistenceClientConfig;
  readonly migrationInventoryDigest: string;
  readonly migrationCount: 4;
  readonly databaseSchemaDigest: string;
  readonly productTableCount: 25;
}

export interface ProfileMaterializationSchemaInspection {
  readonly productTableCount: number;
  readonly rowSecurityPolicyCount: number;
  readonly schemaFunctionCount: number;
  readonly noninternalTriggerCount: number;
  readonly requiredIndexCount: number;
  readonly runtimeRoleSafe: boolean;
  readonly runtimeMembership: boolean;
}

export interface ProfileMaterializationProcessResult {
  readonly exitCode: number;
  readonly stdout: string;
}

export interface ProfileMaterializationDatabaseEffectAdapters {
  readonly runProcess: (
    command: ProfileMaterializationProcessCommand,
    environment: Readonly<Record<string, string>>,
    signal: AbortSignal,
  ) => Promise<ProfileMaterializationProcessResult>;
  readonly sleep: (milliseconds: number, signal: AbortSignal) => Promise<void>;
}

export interface ProfileMaterializationDatabaseOperator {
  create(
    plan: ProfileMaterializationDatabasePlan,
    credentials: ProfileMaterializationDatabaseCredentials,
    signal: AbortSignal,
  ): Promise<void>;
  proveEmpty(
    plan: ProfileMaterializationDatabasePlan,
    credentials: ProfileMaterializationDatabaseCredentials,
    signal: AbortSignal,
  ): Promise<void>;
  prepare(
    plan: ProfileMaterializationDatabasePlan,
    credentials: ProfileMaterializationDatabaseCredentials,
    signal: AbortSignal,
  ): Promise<ProfileMaterializationPreparedDatabase>;
  dispose(
    plan: ProfileMaterializationDatabasePlan,
    signal: AbortSignal,
  ): Promise<void>;
  proveDisposed(
    plan: ProfileMaterializationDatabasePlan,
    signal: AbortSignal,
  ): Promise<void>;
}

export function deriveProfileMaterializationDatabaseIdentity(
  runId: string,
): ProfileMaterializationDatabaseIdentity {
  if (!/^m7-[a-z2-7]{26}$/u.test(runId) || isPhase7LikeIdentity(runId)) {
    throw new Error('profile-materialization.invalid-run-id');
  }
  const suffix = runId.slice(3);
  const runIdDigest = createHash('sha256').update(runId).digest('hex');
  return {
    runId,
    runIdDigest,
    containerName: `gitblocks-p8-m7-${suffix}`,
    networkName: `gitblocks-p8-m7-${suffix}-net`,
    databaseName: `gitblocks_p8_m7_${suffix}_test`,
    ownerRoleName: `gitblocks_p8_m7_${suffix}_owner`,
    runtimeRoleName: `gitblocks_p8_m7_${suffix}_runtime`,
  };
}

export function createProfileMaterializationDatabasePlan(
  input: CreateProfileMaterializationDatabasePlanInput,
): ProfileMaterializationDatabasePlan {
  const identity = deriveProfileMaterializationDatabaseIdentity(input.runId);
  if (
    input.image !== PROFILE_MATERIALIZATION_POSTGRES_IMAGE ||
    input.host !== '127.0.0.1' ||
    !Number.isInteger(input.port) ||
    input.port < 1_024 ||
    input.port > 65_535 ||
    input.ownerPasswordEnvironmentName !==
      'GITBLOCKS_PROFILE_MATERIALIZATION_DB_OWNER_PASSWORD'
  ) {
    throw new Error('profile-materialization.invalid-database-plan');
  }
  const labels = [
    'com.gitblocks.milestone=phase-8-milestone-7',
    `com.gitblocks.profile-materialization.image=${imageDigest(input.image)}`,
    `com.gitblocks.profile-materialization.run-digest=${identity.runIdDigest}`,
  ];
  const command = (
    arguments_: readonly string[],
    allowedEnvironmentNames: readonly string[] = [],
    maximumOutputBytes = 1_048_576,
  ): ProfileMaterializationProcessCommand => ({
    program: 'docker',
    arguments: arguments_,
    allowedEnvironmentNames,
    maximumOutputBytes,
  });
  const withoutDigest = {
    image: PROFILE_MATERIALIZATION_POSTGRES_IMAGE,
    host: '127.0.0.1' as const,
    port: input.port,
    identity,
    labels,
    createNetwork: command([
      'network',
      'create',
      '--internal',
      ...labels.flatMap((label) => ['--label', label]),
      identity.networkName,
    ]),
    createContainer: command(
      [
        'run',
        '--detach',
        '--name',
        identity.containerName,
        '--network',
        identity.networkName,
        '--tmpfs',
        `${PROFILE_MATERIALIZATION_POSTGRES_STORAGE_ROOT}:rw,noexec,nosuid,nodev,size=1073741824`,
        '--publish',
        `127.0.0.1:${String(input.port)}:5432`,
        ...labels.flatMap((label) => ['--label', label]),
        '--env',
        'POSTGRES_DB',
        '--env',
        'POSTGRES_USER',
        '--env',
        'POSTGRES_PASSWORD',
        '--health-cmd',
        `pg_isready --host=127.0.0.1 --port=5432 --dbname=${identity.databaseName} --username=${identity.ownerRoleName}`,
        '--health-interval',
        '1s',
        '--health-timeout',
        '5s',
        '--health-retries',
        '30',
        PROFILE_MATERIALIZATION_POSTGRES_IMAGE,
      ],
      ['POSTGRES_DB', 'POSTGRES_PASSWORD', 'POSTGRES_USER'],
    ),
    inspectStorage: command(
      ['inspect', '--format', '{{json .Mounts}}', identity.containerName],
      [],
      PROFILE_MATERIALIZATION_STORAGE_INSPECTION_MAXIMUM_BYTES,
    ),
    inspectContainer: command([
      'inspect',
      '--format',
      '{{json .State.Health.Status}}',
      identity.containerName,
    ]),
    inspectNetwork: command(['network', 'inspect', identity.networkName]),
    removeContainer: command([
      'rm',
      '--force',
      '--volumes',
      identity.containerName,
    ]),
    removeNetwork: command(['network', 'rm', identity.networkName]),
    expectations: PROFILE_MATERIALIZATION_DATABASE_EXPECTATIONS,
    migrations: PROFILE_MATERIALIZATION_EXPECTED_MIGRATIONS,
  };
  return Object.freeze({
    ...withoutDigest,
    planDigest: digestJson(withoutDigest),
  });
}

export function validateProfileMaterializationDatabasePlan(
  plan: ProfileMaterializationDatabasePlan,
): void {
  const recreated = createProfileMaterializationDatabasePlan({
    runId: plan.identity.runId,
    image: plan.image,
    host: plan.host,
    port: plan.port,
    ownerPasswordEnvironmentName:
      'GITBLOCKS_PROFILE_MATERIALIZATION_DB_OWNER_PASSWORD',
  });
  if (digestJson(plan) !== digestJson(recreated)) {
    throw new Error('profile-materialization.invalid-database-plan');
  }
}

export function createProfileMaterializationDatabaseOperator(
  adapters: ProfileMaterializationDatabaseEffectAdapters,
): ProfileMaterializationDatabaseOperator {
  return {
    create: async (plan, credentials, signal) => {
      validateProfileMaterializationDatabasePlan(plan);
      validateCredentials(plan, credentials);
      await requireResourceAbsent(adapters, plan.inspectContainer, signal);
      await requireResourceAbsent(adapters, plan.inspectNetwork, signal);
      await requireSuccess(adapters, plan.createNetwork, {}, signal);
      await requireSuccess(
        adapters,
        plan.createContainer,
        {
          POSTGRES_DB: plan.identity.databaseName,
          POSTGRES_USER: plan.identity.ownerRoleName,
          POSTGRES_PASSWORD: credentials.ownerPassword,
        },
        signal,
      );
      const storageInspection = await adapters.runProcess(
        plan.inspectStorage,
        {},
        signal,
      );
      if (storageInspection.exitCode !== 0) {
        throw new Error('profile-materialization.database-storage-drift');
      }
      validateProfileMaterializationStorageInspection(storageInspection.stdout);
      for (let attempt = 0; attempt < 30; attempt += 1) {
        const result = await adapters.runProcess(
          plan.inspectContainer,
          {},
          signal,
        );
        if (result.exitCode !== 0) {
          throw new Error('profile-materialization.database-create-failed');
        }
        if (result.stdout.trim() === '"healthy"') return;
        if (result.stdout.trim() === '"unhealthy"') {
          throw new Error('profile-materialization.database-unhealthy');
        }
        await adapters.sleep(1_000, signal);
      }
      throw new Error('profile-materialization.database-health-timeout');
    },
    proveEmpty: async (plan, credentials, signal) => {
      if (signal.aborted) {
        throw new Error('profile-materialization.cancelled');
      }
      const owner = parseDatabaseUrl(
        credentials.ownerUrl,
        credentials.ownerPassword,
        plan,
        plan.identity.ownerRoleName,
      );
      const sql = sqlFor(owner);
      try {
        const rows = await sql<
          readonly {
            readonly migration_table_count: number;
            readonly product_table_count: number;
          }[]
        >`
          select
            (
              select pg_catalog.count(*)::integer
              from pg_catalog.pg_class as class
              join pg_catalog.pg_namespace as namespace
                on namespace.oid = class.relnamespace
              where namespace.nspname = 'gitblocks'
                and class.relkind = 'r'
                and class.relname = 'schema_migrations'
            ) as migration_table_count,
            (
              select pg_catalog.count(*)::integer
              from pg_catalog.pg_class as class
              join pg_catalog.pg_namespace as namespace
                on namespace.oid = class.relnamespace
              where namespace.nspname = 'gitblocks'
                and class.relkind = 'r'
                and class.relname <> 'schema_migrations'
            ) as product_table_count
        `.execute();
        const row = rows[0];
        validateProfileMaterializationEmptyDatabaseInspection({
          migrationTableCount: row?.migration_table_count,
          productTableCount: row?.product_table_count,
        });
      } finally {
        await sql.end({ timeout: 5 });
      }
    },
    prepare: async (plan, credentials, signal) => {
      const ownerConfig = parseDatabaseUrl(
        credentials.ownerUrl,
        credentials.ownerPassword,
        plan,
        plan.identity.ownerRoleName,
      );
      const runtimeConfig = parseDatabaseUrl(
        credentials.runtimeUrl,
        credentials.runtimePassword,
        plan,
        plan.identity.runtimeRoleName,
      );
      const ownerClient = createPersistenceClient(ownerConfig);
      try {
        const applied = await applyMigrations(ownerClient, { signal });
        validateProfileMaterializationMigrationInventory(applied.migrations);
      } finally {
        await closePersistenceClient(ownerClient);
      }
      const sql = sqlFor(ownerConfig);
      try {
        await sql.begin(async (transaction) => {
          await transaction`
            select pg_catalog.set_config('statement_timeout', '10000', true)
          `.execute();
          await transaction.unsafe(
            `create role ${quoteIdentifier(plan.identity.runtimeRoleName)} login password $1 nosuperuser nocreatedb nocreaterole inherit noreplication nobypassrls`,
            [credentials.runtimePassword],
          );
          await transaction.unsafe(
            `grant gitblocks_persistence to ${quoteIdentifier(plan.identity.runtimeRoleName)}`,
          );
        });
        const schema = await inspectSchema(sql, plan.identity.runtimeRoleName);
        validateProfileMaterializationSchemaInspection(schema);
        const runtimeClient = createPersistenceClient(runtimeConfig);
        try {
          await verifyMigrations(runtimeClient, { signal });
        } finally {
          await closePersistenceClient(runtimeClient);
        }
        return {
          runtimeConfig,
          migrationInventoryDigest: digestJson(
            PROFILE_MATERIALIZATION_EXPECTED_MIGRATIONS,
          ),
          migrationCount: 4,
          databaseSchemaDigest: digestJson({
            postgresqlMajor: 18,
            ...schema,
          }),
          productTableCount: 25,
        };
      } finally {
        await sql.end({ timeout: 5 });
      }
    },
    dispose: async (plan, signal) => {
      const containerPresent = await inspectResourcePresence(
        adapters,
        plan.inspectContainer,
        signal,
      );
      if (containerPresent) {
        await requireSuccess(adapters, plan.removeContainer, {}, signal);
      }
      await requireResourceAbsent(adapters, plan.inspectContainer, signal);
      const networkPresent = await inspectResourcePresence(
        adapters,
        plan.inspectNetwork,
        signal,
      );
      if (networkPresent) {
        await requireSuccess(adapters, plan.removeNetwork, {}, signal);
      }
      await requireResourceAbsent(adapters, plan.inspectNetwork, signal);
    },
    proveDisposed: async (plan, signal) => {
      await requireResourceAbsent(adapters, plan.inspectContainer, signal);
      await requireResourceAbsent(adapters, plan.inspectNetwork, signal);
    },
  };
}

export function isPhase7LikeIdentity(value: string): boolean {
  const normalized = value.toLowerCase();
  return (
    /(?:^|[^a-z0-9])phase[-_ ]?7(?:[^a-z0-9]|$)/u.test(normalized) ||
    /(?:^|[^a-z0-9])p7(?:[^a-z0-9]|$)/u.test(normalized) ||
    normalized.includes('repository-interview')
  );
}

export function validateProfileMaterializationEmptyDatabaseInspection(value: {
  readonly migrationTableCount: number | undefined;
  readonly productTableCount: number | undefined;
}): void {
  if (value.migrationTableCount !== 0 || value.productTableCount !== 0) {
    throw new Error('profile-materialization.database-not-empty');
  }
}

export function validateProfileMaterializationMigrationInventory(
  migrations: readonly {
    readonly version: number;
    readonly name: string;
    readonly checksum: string;
  }[],
): void {
  if (
    migrations.length !== PROFILE_MATERIALIZATION_EXPECTED_MIGRATIONS.length ||
    migrations.some((migration, index) => {
      const expected = PROFILE_MATERIALIZATION_EXPECTED_MIGRATIONS[index];
      return (
        migration.version !== expected?.version ||
        migration.name !== expected.name ||
        migration.checksum !== expected.checksum
      );
    })
  ) {
    throw new Error('profile-materialization.migration-drift');
  }
}

export function validateProfileMaterializationSchemaInspection(
  value: ProfileMaterializationSchemaInspection,
): void {
  if (
    value.productTableCount !==
      PROFILE_MATERIALIZATION_DATABASE_EXPECTATIONS.finalProductTableCount ||
    value.rowSecurityPolicyCount !==
      PROFILE_MATERIALIZATION_DATABASE_EXPECTATIONS.rowSecurityPolicyCount ||
    value.schemaFunctionCount !==
      PROFILE_MATERIALIZATION_DATABASE_EXPECTATIONS.schemaFunctionCount ||
    value.noninternalTriggerCount !==
      PROFILE_MATERIALIZATION_DATABASE_EXPECTATIONS.noninternalTriggerCount ||
    value.requiredIndexCount !==
      PROFILE_MATERIALIZATION_DATABASE_EXPECTATIONS.requiredIndexCount ||
    !value.runtimeRoleSafe ||
    !value.runtimeMembership
  ) {
    throw new Error('profile-materialization.database-schema-drift');
  }
}

export function validateProfileMaterializationStorageInspection(
  text: string,
): void {
  if (
    Buffer.byteLength(text, 'utf8') < 2 ||
    Buffer.byteLength(text, 'utf8') >
      PROFILE_MATERIALIZATION_STORAGE_INSPECTION_MAXIMUM_BYTES
  ) {
    throw new Error('profile-materialization.database-storage-drift');
  }
  let inspection: unknown;
  try {
    inspection = JSON.parse(text);
  } catch {
    throw new Error('profile-materialization.database-storage-drift');
  }
  if (Array.isArray(inspection)) {
    validateStructuredTmpfsMount(inspection);
    return;
  }
  validateTmpfsOptionsMap(inspection);
}

function validateStructuredTmpfsMount(mounts: readonly unknown[]): void {
  const mount = mounts[0];
  if (
    mounts.length !== 1 ||
    !isOrdinaryJsonObject(mount) ||
    !Object.hasOwn(mount, 'Type') ||
    mount['Type'] !== 'tmpfs' ||
    !Object.hasOwn(mount, 'Source') ||
    mount['Source'] !== '' ||
    !Object.hasOwn(mount, 'Destination') ||
    mount['Destination'] !== PROFILE_MATERIALIZATION_POSTGRES_STORAGE_ROOT ||
    !Object.hasOwn(mount, 'RW') ||
    mount['RW'] !== true
  ) {
    throw new Error('profile-materialization.database-storage-drift');
  }
}

function validateTmpfsOptionsMap(inspection: unknown): void {
  if (!isOrdinaryJsonObject(inspection)) {
    throw new Error('profile-materialization.database-storage-drift');
  }
  const destinations = Reflect.ownKeys(inspection);
  if (
    destinations.length !== 1 ||
    destinations[0] !== PROFILE_MATERIALIZATION_POSTGRES_STORAGE_ROOT
  ) {
    throw new Error('profile-materialization.database-storage-drift');
  }
  const optionText = inspection[PROFILE_MATERIALIZATION_POSTGRES_STORAGE_ROOT];
  if (typeof optionText !== 'string') {
    throw new Error('profile-materialization.database-storage-drift');
  }
  const options = optionText.split(',');
  const uniqueOptions = new Set(options);
  if (
    options.some((option) => option === '') ||
    uniqueOptions.size !== options.length ||
    uniqueOptions.size !==
      PROFILE_MATERIALIZATION_REQUIRED_TMPFS_OPTIONS.length ||
    PROFILE_MATERIALIZATION_REQUIRED_TMPFS_OPTIONS.some(
      (option) => !uniqueOptions.has(option),
    )
  ) {
    throw new Error('profile-materialization.database-storage-drift');
  }
}

function isOrdinaryJsonObject(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function imageDigest(image: string): string {
  return image.split('@sha256:')[1] ?? '';
}

async function requireResourceAbsent(
  adapters: ProfileMaterializationDatabaseEffectAdapters,
  inspect: ProfileMaterializationProcessCommand,
  signal: AbortSignal,
): Promise<void> {
  if (await inspectResourcePresence(adapters, inspect, signal)) {
    throw new Error('profile-materialization.database-identity-collision');
  }
}

async function inspectResourcePresence(
  adapters: ProfileMaterializationDatabaseEffectAdapters,
  inspect: ProfileMaterializationProcessCommand,
  signal: AbortSignal,
): Promise<boolean> {
  const result = await adapters.runProcess(inspect, {}, signal);
  if (result.exitCode === 0) return true;
  if (result.exitCode === 1) return false;
  throw new Error('profile-materialization.resource-inspection-failed');
}

async function requireSuccess(
  adapters: ProfileMaterializationDatabaseEffectAdapters,
  command_: ProfileMaterializationProcessCommand,
  environment: Readonly<Record<string, string>>,
  signal: AbortSignal,
): Promise<void> {
  const result = await adapters.runProcess(command_, environment, signal);
  if (result.exitCode !== 0) {
    throw new Error('profile-materialization.process-failed');
  }
}

function validateCredentials(
  plan: ProfileMaterializationDatabasePlan,
  credentials: ProfileMaterializationDatabaseCredentials,
): void {
  parseDatabaseUrl(
    credentials.ownerUrl,
    credentials.ownerPassword,
    plan,
    plan.identity.ownerRoleName,
  );
  parseDatabaseUrl(
    credentials.runtimeUrl,
    credentials.runtimePassword,
    plan,
    plan.identity.runtimeRoleName,
  );
}

function parseDatabaseUrl(
  value: string,
  password: string,
  plan: ProfileMaterializationDatabasePlan,
  username: string,
): PersistenceClientConfig {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('profile-materialization.invalid-database-url');
  }
  if (
    (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') ||
    url.hostname !== plan.host ||
    url.port !== String(plan.port) ||
    decodeURIComponent(url.username) !== username ||
    url.password !== '' ||
    decodeURIComponent(url.pathname.slice(1)) !== plan.identity.databaseName ||
    url.search !== '' ||
    url.hash !== '' ||
    password.length < 1 ||
    password.length > 1_024
  ) {
    throw new Error('profile-materialization.invalid-database-url');
  }
  return {
    host: plan.host,
    port: plan.port,
    database: plan.identity.databaseName,
    username,
    password,
    ssl: false,
    maximumConnections: 3,
    connectTimeoutMilliseconds: 5_000,
    idleTimeoutMilliseconds: 5_000,
    statementTimeoutMilliseconds: 10_000,
    lockTimeoutMilliseconds: 5_000,
  };
}

function sqlFor(config: PersistenceClientConfig): postgres.Sql {
  return postgres({
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
}

async function inspectSchema(
  sql: postgres.Sql,
  runtimeRoleName: string,
): Promise<ProfileMaterializationSchemaInspection> {
  const rows = await sql<
    readonly {
      readonly product_table_count: number;
      readonly policy_count: number;
      readonly function_count: number;
      readonly trigger_count: number;
      readonly index_count: number;
      readonly runtime_role_safe: boolean;
      readonly runtime_membership: boolean;
    }[]
  >`
    select
      (
        select pg_catalog.count(*)::integer
        from pg_catalog.pg_class as class
        join pg_catalog.pg_namespace as namespace
          on namespace.oid = class.relnamespace
        where namespace.nspname = 'gitblocks'
          and class.relkind = 'r'
          and class.relname <> 'schema_migrations'
      ) as product_table_count,
      (
        select pg_catalog.count(*)::integer
        from pg_catalog.pg_policy as policy
        join pg_catalog.pg_class as class on class.oid = policy.polrelid
        join pg_catalog.pg_namespace as namespace
          on namespace.oid = class.relnamespace
        where namespace.nspname = 'gitblocks'
      ) as policy_count,
      (
        select pg_catalog.count(*)::integer
        from pg_catalog.pg_proc as procedure
        join pg_catalog.pg_namespace as namespace
          on namespace.oid = procedure.pronamespace
        where namespace.nspname = 'gitblocks'
      ) as function_count,
      (
        select pg_catalog.count(*)::integer
        from pg_catalog.pg_trigger as trigger
        join pg_catalog.pg_class as class on class.oid = trigger.tgrelid
        join pg_catalog.pg_namespace as namespace
          on namespace.oid = class.relnamespace
        where namespace.nspname = 'gitblocks'
          and not trigger.tgisinternal
      ) as trigger_count,
      (
        select pg_catalog.count(*)::integer
        from pg_catalog.pg_indexes
        where schemaname = 'gitblocks'
          and indexname = any(array[
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
            'model_executions_reuse'
          ]::text[])
      ) as index_count,
      coalesce((
        select
          not role.rolsuper
          and not role.rolbypassrls
          and role.rolcanlogin
          and not role.rolcreatedb
          and not role.rolcreaterole
          and not role.rolreplication
        from pg_catalog.pg_roles as role
        where role.rolname = ${runtimeRoleName}
      ), false) as runtime_role_safe,
      pg_catalog.pg_has_role(
        ${runtimeRoleName},
        'gitblocks_persistence',
        'member'
      ) as runtime_membership
  `.execute();
  const row = rows[0];
  if (row === undefined) {
    throw new Error('profile-materialization.database-schema-drift');
  }
  return {
    productTableCount: row.product_table_count,
    rowSecurityPolicyCount: row.policy_count,
    schemaFunctionCount: row.function_count,
    noninternalTriggerCount: row.trigger_count,
    requiredIndexCount: row.index_count,
    runtimeRoleSafe: row.runtime_role_safe,
    runtimeMembership: row.runtime_membership,
  };
}

function quoteIdentifier(value: string): string {
  if (!/^[a-z][a-z0-9_]{0,62}$/u.test(value)) {
    throw new Error('profile-materialization.invalid-database-plan');
  }
  return `"${value}"`;
}

function digestJson(value: unknown): string {
  return createHash('sha256').update(canonical(value)).digest('hex');
}

function canonical(value: unknown): string {
  if (value === null) return 'null';
  if (
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    typeof value === 'number'
  )
    return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (typeof value !== 'object') {
    throw new Error('profile-materialization.invalid-database-plan');
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0))
    .map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`)
    .join(',')}}`;
}
