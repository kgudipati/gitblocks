import { createHash } from 'node:crypto';

import postgres from 'postgres';

import {
  closePersistenceClient,
  createPersistenceClient,
  executePending,
} from './client.ts';
import {
  PersistenceError,
  normalizePersistenceError,
  persistenceError,
} from './errors.ts';
import { applyMigrations, verifyMigrations } from './migrations.ts';
import type { PersistenceClientConfig } from './types.ts';

export const PROFILE_MATERIALIZATION_POSTGRES_IMAGE =
  'postgres:18.4-bookworm@sha256:1961f96e6029a02c3812d7cb329a3b03a3ac2bb067058dec17b0f5596aca9296' as const;
export const PROFILE_MATERIALIZATION_POSTGRES_STORAGE_ROOT =
  '/var/lib/postgresql' as const;
const PROFILE_MATERIALIZATION_STORAGE_CONFIGURATION_MAXIMUM_BYTES = 16_384;
const PROFILE_MATERIALIZATION_STORAGE_MOUNTS_MAXIMUM_BYTES = 16_384;
const PROFILE_MATERIALIZATION_STORAGE_RUNTIME_MAXIMUM_BYTES = 1_048_576;
const PROFILE_MATERIALIZATION_STORAGE_MOUNT_MAXIMUM_ENTRIES = 16;
const PROFILE_MATERIALIZATION_PORT_BINDING_MAXIMUM_BYTES = 4_096;
const PROFILE_MATERIALIZATION_ZERO_STATE_MAXIMUM_ATTEMPTS = 10;
const PROFILE_MATERIALIZATION_ZERO_STATE_RETRY_DELAY_MILLISECONDS = 250;
const PROFILE_MATERIALIZATION_ZERO_STATE_CONNECT_TIMEOUT_MILLISECONDS = 1_000;
const PROFILE_MATERIALIZATION_ZERO_STATE_CLOSE_TIMEOUT_SECONDS = 1;
const PROFILE_MATERIALIZATION_ZERO_STATE_RETRYABLE_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'EPIPE',
  'CONNECT_TIMEOUT',
  'CONNECTION_CLOSED',
  'CONNECTION_DESTROYED',
]);
const PROFILE_MATERIALIZATION_RUNTIME_ROLE_PROVISIONING_SQL = `
do $gitblocks$
begin
  execute pg_catalog.format(
    'create role %I login password %L nosuperuser nocreatedb nocreaterole inherit noreplication nobypassrls',
    pg_catalog.current_setting('gitblocks.runtime_role'),
    pg_catalog.current_setting('gitblocks.runtime_password')
  );
  execute pg_catalog.format(
    'grant gitblocks_persistence to %I',
    pg_catalog.current_setting('gitblocks.runtime_role')
  );
end
$gitblocks$
`;
const PROFILE_MATERIALIZATION_REQUIRED_TMPFS_OPTIONS = [
  'rw',
  'noexec',
  'nosuid',
  'nodev',
  'size=1073741824',
] as const;
const PROFILE_MATERIALIZATION_STORAGE_CONFLICT_DESTINATIONS = new Set([
  PROFILE_MATERIALIZATION_POSTGRES_STORAGE_ROOT,
  '/var/lib/postgresql/18/docker',
  '/var/lib/postgresql/data',
]);
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
const PROFILE_MATERIALIZATION_COMPATIBLE_ADDITIVE_MIGRATIONS = [
  {
    version: 5,
    name: 'retrieval-serving',
    checksum:
      '40359c6dbeaf87ee88f8d46b910f851a74c3155243ca9fa67941620eb253e448',
  },
  {
    version: 6,
    name: 'finalist-evidence-serving',
    checksum:
      '05575971fe03bea06bbd6736b15f68f98c137cf903816bbb8689e843481c70db',
  },
  {
    version: 7,
    name: 'artifact-evidence-serving',
    checksum:
      'c5cb5fcc522b25335b1c927b62ad80133bdf99ffe0c065d759cd3059880c5903',
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
  readonly inspectStorageConfiguration: ProfileMaterializationProcessCommand;
  readonly inspectStorageMounts: ProfileMaterializationProcessCommand;
  readonly inspectStorageRuntime: ProfileMaterializationProcessCommand;
  readonly inspectPublishedPort: ProfileMaterializationProcessCommand;
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
  readonly createZeroStateClient?: (
    config: PersistenceClientConfig,
  ) => ProfileMaterializationZeroStateClient;
}

/** Package-private live-boundary seam used by deterministic adapter tests. */
export interface ProfileMaterializationZeroStateClient {
  inspect(signal: AbortSignal): Promise<{
    readonly migrationTableCount: number | undefined;
    readonly productTableCount: number | undefined;
  }>;
  close(): Promise<void>;
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
    inspectStorageConfiguration: command(
      [
        'inspect',
        '--format',
        '{{json .HostConfig.Tmpfs}}',
        identity.containerName,
      ],
      [],
      PROFILE_MATERIALIZATION_STORAGE_CONFIGURATION_MAXIMUM_BYTES,
    ),
    inspectStorageMounts: command(
      ['inspect', '--format', '{{json .Mounts}}', identity.containerName],
      [],
      PROFILE_MATERIALIZATION_STORAGE_MOUNTS_MAXIMUM_BYTES,
    ),
    inspectStorageRuntime: command(
      ['exec', identity.containerName, 'cat', '/proc/self/mountinfo'],
      [],
      PROFILE_MATERIALIZATION_STORAGE_RUNTIME_MAXIMUM_BYTES,
    ),
    inspectPublishedPort: command(
      ['port', identity.containerName, '5432/tcp'],
      [],
      PROFILE_MATERIALIZATION_PORT_BINDING_MAXIMUM_BYTES,
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
      const storageConfiguration = await adapters.runProcess(
        plan.inspectStorageConfiguration,
        {},
        signal,
      );
      if (storageConfiguration.exitCode !== 0) {
        throw new Error('profile-materialization.database-storage-drift');
      }
      validateProfileMaterializationStorageConfiguration(
        storageConfiguration.stdout,
      );
      const storageMounts = await adapters.runProcess(
        plan.inspectStorageMounts,
        {},
        signal,
      );
      if (storageMounts.exitCode !== 0) {
        throw new Error('profile-materialization.database-storage-drift');
      }
      validateProfileMaterializationStorageMounts(storageMounts.stdout);
      const storageRuntime = await adapters.runProcess(
        plan.inspectStorageRuntime,
        {},
        signal,
      );
      if (storageRuntime.exitCode !== 0) {
        throw new Error('profile-materialization.database-storage-drift');
      }
      validateProfileMaterializationStorageRuntime(storageRuntime.stdout);
      let healthy = false;
      for (let attempt = 0; attempt < 30; attempt += 1) {
        const result = await adapters.runProcess(
          plan.inspectContainer,
          {},
          signal,
        );
        if (result.exitCode !== 0) {
          throw new Error('profile-materialization.database-create-failed');
        }
        if (result.stdout.trim() === '"healthy"') {
          healthy = true;
          break;
        }
        if (result.stdout.trim() === '"unhealthy"') {
          throw new Error('profile-materialization.database-unhealthy');
        }
        await adapters.sleep(1_000, signal);
      }
      if (!healthy) {
        throw new Error('profile-materialization.database-health-timeout');
      }
      const publishedPort = await adapters.runProcess(
        plan.inspectPublishedPort,
        {},
        signal,
      );
      if (publishedPort.exitCode !== 0) {
        throw new Error('profile-materialization.database-port-binding-drift');
      }
      validateProfileMaterializationPublishedPort(
        publishedPort.stdout,
        plan.port,
      );
    },
    proveEmpty: async (plan, credentials, signal) => {
      const owner = parseDatabaseUrl(
        credentials.ownerUrl,
        credentials.ownerPassword,
        plan,
        plan.identity.ownerRoleName,
      );
      const createZeroStateClient =
        adapters.createZeroStateClient ??
        createProfileMaterializationZeroStateClient;
      for (
        let attempt = 1;
        attempt <= PROFILE_MATERIALIZATION_ZERO_STATE_MAXIMUM_ATTEMPTS;
        attempt += 1
      ) {
        requireZeroStateSignal(signal);
        let client: ProfileMaterializationZeroStateClient;
        try {
          client = createZeroStateClient(owner);
        } catch (error) {
          if (
            isRetryableZeroStateConnectionError(error) &&
            attempt < PROFILE_MATERIALIZATION_ZERO_STATE_MAXIMUM_ATTEMPTS
          ) {
            await sleepBeforeZeroStateRetry(adapters, signal);
            continue;
          }
          throw normalizeZeroStateError(error);
        }

        let primaryError: unknown;
        try {
          const inspection = await client.inspect(signal);
          validateProfileMaterializationEmptyDatabaseInspection(inspection);
        } catch (error) {
          primaryError = error;
        }

        let closeError: unknown;
        try {
          await client.close();
        } catch (error) {
          closeError = error;
        }

        if (primaryError === undefined) {
          if (closeError !== undefined) {
            throw persistenceError('persistence.connection');
          }
          return;
        }
        if (closeError !== undefined) {
          throw normalizeZeroStateError(primaryError);
        }
        if (
          isRetryableZeroStateConnectionError(primaryError) &&
          attempt < PROFILE_MATERIALIZATION_ZERO_STATE_MAXIMUM_ATTEMPTS
        ) {
          await sleepBeforeZeroStateRetry(adapters, signal);
          continue;
        }
        throw normalizeZeroStateError(primaryError);
      }
      throw persistenceError('persistence.connection');
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
        try {
          await sql.begin(async (transaction) => {
            await executePending(
              transaction`
                select
                  pg_catalog.set_config(
                    'statement_timeout',
                    ${'10000'},
                    true
                  ) is not null as statement_timeout_configured,
                  pg_catalog.set_config(
                    'lock_timeout',
                    ${'5000'},
                    true
                  ) is not null as lock_timeout_configured,
                  pg_catalog.set_config(
                    'gitblocks.runtime_role',
                    ${plan.identity.runtimeRoleName},
                    true
                  ) is not null as runtime_role_configured,
                  pg_catalog.set_config(
                    'gitblocks.runtime_password',
                    ${credentials.runtimePassword},
                    true
                  ) is not null as runtime_password_configured
              `,
              signal,
            );
            await executePending(
              transaction.unsafe(
                PROFILE_MATERIALIZATION_RUNTIME_ROLE_PROVISIONING_SQL,
              ),
              signal,
            );
          });
        } catch (error) {
          throw normalizePersistenceError(error);
        }
        const schema = await inspectSchema(
          sql,
          plan.identity.runtimeRoleName,
          signal,
        );
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

/**
 * Creates one bounded host-side zero-state client. Ten one-second connection
 * attempts plus nine fixed 250 ms delays and bounded teardown cap this stage's
 * connection schedule at 22.25 seconds before the caller's outer deadline.
 */
export function createProfileMaterializationZeroStateClient(
  config: PersistenceClientConfig,
): ProfileMaterializationZeroStateClient {
  const sql = postgres({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.username,
    password: config.password,
    ssl: config.ssl,
    max: 1,
    connect_timeout: Math.ceil(
      PROFILE_MATERIALIZATION_ZERO_STATE_CONNECT_TIMEOUT_MILLISECONDS / 1_000,
    ),
    idle_timeout: 5,
    onnotice: () => undefined,
    debug: false,
  });
  return {
    inspect: async (signal) => {
      const rows = await executePending<
        readonly {
          readonly migration_table_count: number;
          readonly product_table_count: number;
        }[]
      >(
        sql`
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
        `,
        signal,
      );
      const row = rows[0];
      return {
        migrationTableCount: row?.migration_table_count,
        productTableCount: row?.product_table_count,
      };
    },
    close: async () => {
      try {
        await sql.end({
          timeout: PROFILE_MATERIALIZATION_ZERO_STATE_CLOSE_TIMEOUT_SECONDS,
        });
      } catch {
        throw persistenceError('persistence.connection');
      }
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
  const additiveMigrations = migrations.slice(
    PROFILE_MATERIALIZATION_EXPECTED_MIGRATIONS.length,
  );
  if (
    additiveMigrations.length >
      PROFILE_MATERIALIZATION_COMPATIBLE_ADDITIVE_MIGRATIONS.length ||
    PROFILE_MATERIALIZATION_EXPECTED_MIGRATIONS.some((expected, index) => {
      const migration = migrations[index];
      return (
        migration?.version !== expected.version ||
        migration.name !== expected.name ||
        migration.checksum !== expected.checksum
      );
    }) ||
    additiveMigrations.some((migration, index) => {
      const expected =
        PROFILE_MATERIALIZATION_COMPATIBLE_ADDITIVE_MIGRATIONS[index];
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
  validateProfileMaterializationStorageConfiguration(text);
}

function validateProfileMaterializationStorageConfiguration(
  text: string,
): void {
  const inspection = parseBoundedStorageJson(
    text,
    PROFILE_MATERIALIZATION_STORAGE_CONFIGURATION_MAXIMUM_BYTES,
  );
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

function validateProfileMaterializationStorageMounts(text: string): void {
  const inspection = parseBoundedStorageJson(
    text,
    PROFILE_MATERIALIZATION_STORAGE_MOUNTS_MAXIMUM_BYTES,
  );
  if (
    !Array.isArray(inspection) ||
    inspection.length > PROFILE_MATERIALIZATION_STORAGE_MOUNT_MAXIMUM_ENTRIES
  ) {
    throw new Error('profile-materialization.database-storage-drift');
  }
  let explicitRootTmpfsCount = 0;
  for (const mount of inspection) {
    if (
      !isOrdinaryJsonObject(mount) ||
      typeof mount['Type'] !== 'string' ||
      typeof mount['Destination'] !== 'string'
    ) {
      throw new Error('profile-materialization.database-storage-drift');
    }
    if (mount['Type'] === 'volume' || mount['Type'] === 'bind') {
      throw new Error('profile-materialization.database-storage-drift');
    }
    if (
      !PROFILE_MATERIALIZATION_STORAGE_CONFLICT_DESTINATIONS.has(
        mount['Destination'],
      )
    ) {
      continue;
    }
    if (
      mount['Destination'] !== PROFILE_MATERIALIZATION_POSTGRES_STORAGE_ROOT ||
      mount['Type'] !== 'tmpfs' ||
      !Object.hasOwn(mount, 'Source') ||
      mount['Source'] !== '' ||
      !Object.hasOwn(mount, 'RW') ||
      mount['RW'] !== true
    ) {
      throw new Error('profile-materialization.database-storage-drift');
    }
    explicitRootTmpfsCount += 1;
  }
  if (
    explicitRootTmpfsCount > 1 ||
    (explicitRootTmpfsCount === 1 && inspection.length !== 1)
  ) {
    throw new Error('profile-materialization.database-storage-drift');
  }
}

function validateProfileMaterializationStorageRuntime(text: string): void {
  if (
    Buffer.byteLength(text, 'utf8') < 1 ||
    Buffer.byteLength(text, 'utf8') >
      PROFILE_MATERIALIZATION_STORAGE_RUNTIME_MAXIMUM_BYTES
  ) {
    throw new Error('profile-materialization.database-storage-drift');
  }
  const rootMounts: {
    readonly filesystemType: string;
    readonly mountOptions: readonly string[];
    readonly superOptions: readonly string[];
  }[] = [];
  for (const line of text.split('\n')) {
    if (line === '') continue;
    const separatorIndex = line.indexOf(' - ');
    if (separatorIndex < 0) {
      throw new Error('profile-materialization.database-storage-drift');
    }
    const mountFields = line.slice(0, separatorIndex).split(' ');
    const filesystemFields = line.slice(separatorIndex + 3).split(' ');
    if (mountFields.length < 6 || filesystemFields.length < 3) {
      throw new Error('profile-materialization.database-storage-drift');
    }
    if (
      decodeMountInfoPath(mountFields[4] ?? '') !==
      PROFILE_MATERIALIZATION_POSTGRES_STORAGE_ROOT
    ) {
      continue;
    }
    rootMounts.push({
      filesystemType: filesystemFields[0] ?? '',
      mountOptions: (mountFields[5] ?? '').split(','),
      superOptions: (filesystemFields[2] ?? '').split(','),
    });
  }
  const rootMount = rootMounts[0];
  if (
    rootMounts.length !== 1 ||
    rootMount?.filesystemType !== 'tmpfs' ||
    !rootMount.mountOptions.includes('rw') ||
    rootMount.mountOptions.includes('ro') ||
    !rootMount.mountOptions.includes('noexec') ||
    rootMount.mountOptions.includes('exec') ||
    !rootMount.mountOptions.includes('nosuid') ||
    rootMount.mountOptions.includes('suid') ||
    !rootMount.mountOptions.includes('nodev') ||
    rootMount.mountOptions.includes('dev') ||
    !rootMount.superOptions.some(
      (option) => option.startsWith('size=') && option.length > 5,
    )
  ) {
    throw new Error('profile-materialization.database-storage-drift');
  }
}

function validateProfileMaterializationPublishedPort(
  text: string,
  port: number,
): void {
  const expected = `127.0.0.1:${String(port)}`;
  if (
    Buffer.byteLength(text, 'utf8') < expected.length ||
    Buffer.byteLength(text, 'utf8') >
      PROFILE_MATERIALIZATION_PORT_BINDING_MAXIMUM_BYTES ||
    (text !== expected && text !== `${expected}\n`)
  ) {
    throw new Error('profile-materialization.database-port-binding-drift');
  }
}

function parseBoundedStorageJson(text: string, maximumBytes: number): unknown {
  if (
    Buffer.byteLength(text, 'utf8') < 2 ||
    Buffer.byteLength(text, 'utf8') > maximumBytes
  ) {
    throw new Error('profile-materialization.database-storage-drift');
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('profile-materialization.database-storage-drift');
  }
}

function decodeMountInfoPath(value: string): string {
  return value.replace(/\\([0-7]{3})/gu, (_match, octal: string) =>
    String.fromCodePoint(Number.parseInt(octal, 8)),
  );
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

function requireZeroStateSignal(signal: AbortSignal): void {
  if (signal.aborted) {
    throw persistenceError('persistence.deadline');
  }
}

async function sleepBeforeZeroStateRetry(
  adapters: ProfileMaterializationDatabaseEffectAdapters,
  signal: AbortSignal,
): Promise<void> {
  requireZeroStateSignal(signal);
  try {
    await adapters.sleep(
      PROFILE_MATERIALIZATION_ZERO_STATE_RETRY_DELAY_MILLISECONDS,
      signal,
    );
  } catch (error) {
    if (signal.aborted) {
      throw persistenceError('persistence.deadline');
    }
    throw error;
  }
  requireZeroStateSignal(signal);
}

function isRetryableZeroStateConnectionError(error: unknown): boolean {
  const code = databaseErrorCode(error);
  return (
    code !== undefined &&
    PROFILE_MATERIALIZATION_ZERO_STATE_RETRYABLE_CODES.has(code)
  );
}

function normalizeZeroStateError(error: unknown): unknown {
  if (error instanceof PersistenceError) {
    return error;
  }
  return databaseErrorCode(error) === undefined
    ? error
    : normalizePersistenceError(error);
}

function databaseErrorCode(error: unknown): string | undefined {
  if (
    typeof error !== 'object' ||
    error === null ||
    !Object.hasOwn(error, 'code')
  ) {
    return undefined;
  }
  try {
    const code = Reflect.get(error, 'code') as unknown;
    return typeof code === 'string' && code.length <= 32 ? code : undefined;
  } catch {
    return undefined;
  }
}

async function inspectSchema(
  sql: postgres.Sql,
  runtimeRoleName: string,
  signal: AbortSignal,
): Promise<ProfileMaterializationSchemaInspection> {
  const rows = await executePending(
    sql<
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
          and role.rolinherit
          and not role.rolreplication
        from pg_catalog.pg_roles as role
        where role.rolname = ${runtimeRoleName}
      ), false) as runtime_role_safe,
      coalesce((
        select
          pg_catalog.count(*) = 1
          and pg_catalog.bool_and(
            granted_role.rolname = 'gitblocks_persistence'
          )
        from pg_catalog.pg_auth_members as membership
        join pg_catalog.pg_roles as member_role
          on member_role.oid = membership.member
        join pg_catalog.pg_roles as granted_role
          on granted_role.oid = membership.roleid
        where member_role.rolname = ${runtimeRoleName}
      ), false) as runtime_membership
  `,
    signal,
  );
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
