import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import type { TransactionSql } from 'postgres';

import {
  executePending,
  getMigrationSql,
  type PersistenceClient,
} from './client.ts';
import { normalizePersistenceError, persistenceError } from './errors.ts';
import type {
  MigrationRecord,
  MigrationVerification,
  OperationControl,
} from './types.ts';
import { validateControl } from './validation.ts';

const MIGRATION_LOCK_KEY = 776985962084714117n;
const SUPPORTED_POSTGRESQL_MAJOR = 18;

interface KnownMigration {
  readonly version: number;
  readonly name: string;
  readonly fileName: string;
}

interface LoadedMigration extends KnownMigration {
  readonly checksum: string;
  readonly sql: string;
}

const KNOWN_MIGRATIONS: readonly KnownMigration[] = Object.freeze([
  Object.freeze({
    version: 1,
    name: 'evidence-persistence',
    fileName: '0001_evidence_persistence.sql',
  }),
  Object.freeze({
    version: 2,
    name: 'runtime-migration-verification',
    fileName: '0002_runtime_migration_verification.sql',
  }),
  Object.freeze({
    version: 3,
    name: 'immutable-repository-artifacts',
    fileName: '0003_immutable_repository_artifacts.sql',
  }),
  Object.freeze({
    version: 4,
    name: 'repository-interviews',
    fileName: '0004_repository_interviews.sql',
  }),
  Object.freeze({
    version: 5,
    name: 'retrieval-serving',
    fileName: '0005_retrieval_serving.sql',
  }),
]);

export async function applyMigrations(
  client: PersistenceClient,
  control?: OperationControl,
): Promise<MigrationVerification> {
  const migrations = await loadKnownMigrations();
  const sql = getMigrationSql(client);
  const validatedControl = validateControl(control, {
    statementTimeoutMilliseconds: 60_000,
    lockTimeoutMilliseconds: 30_000,
  });
  if (validatedControl.signal?.aborted === true) {
    throw persistenceError('persistence.deadline');
  }
  try {
    return await sql.begin(async (transaction) => {
      await configureMigrationTransaction(
        transaction,
        validatedControl.statementTimeoutMilliseconds,
        validatedControl.lockTimeoutMilliseconds,
        validatedControl.signal,
      );
      await acquireMigrationLock(transaction, validatedControl.signal);
      const postgresqlVersion = await requireSupportedVersion(
        transaction,
        validatedControl.signal,
      );
      await bootstrapMigrationHistory(transaction, validatedControl.signal);
      const applied = await loadAppliedMigrations(
        transaction,
        validatedControl.signal,
      );
      verifyHistory(migrations, applied);

      for (const migration of migrations.slice(applied.length)) {
        await executePending(
          transaction.unsafe(migration.sql).simple(),
          validatedControl.signal,
        );
        await executePending(
          transaction`
            insert into gitblocks.schema_migrations (
              version,
              name,
              checksum,
              applied_at
            )
            values (
              ${migration.version},
              ${migration.name},
              ${migration.checksum},
              pg_catalog.clock_timestamp()
            )
          `,
          validatedControl.signal,
        );
      }

      return {
        postgresqlVersion,
        migrations: migrations.map(migrationRecord),
      };
    });
  } catch (error) {
    throw normalizeMigrationError(error);
  }
}

export async function verifyMigrations(
  client: PersistenceClient,
  control?: OperationControl,
): Promise<MigrationVerification> {
  const migrations = await loadKnownMigrations();
  const sql = getMigrationSql(client);
  const validatedControl = validateControl(control, {
    statementTimeoutMilliseconds: 10_000,
    lockTimeoutMilliseconds: 5_000,
  });
  if (validatedControl.signal?.aborted === true) {
    throw persistenceError('persistence.deadline');
  }
  try {
    return await sql.begin('read only', async (transaction) => {
      await configureMigrationTransaction(
        transaction,
        validatedControl.statementTimeoutMilliseconds,
        validatedControl.lockTimeoutMilliseconds,
        validatedControl.signal,
      );
      const postgresqlVersion = await requireSupportedVersion(
        transaction,
        validatedControl.signal,
      );
      const applied = await loadAppliedMigrations(
        transaction,
        validatedControl.signal,
      );
      verifyHistory(migrations, applied);
      if (applied.length !== migrations.length) {
        throw persistenceError('persistence.migration-drift');
      }
      return {
        postgresqlVersion,
        migrations: migrations.map(migrationRecord),
      };
    });
  } catch (error) {
    throw normalizeMigrationError(error);
  }
}

export function knownMigrationInventory(): readonly Readonly<KnownMigration>[] {
  return KNOWN_MIGRATIONS.map((migration) => ({ ...migration }));
}

async function configureMigrationTransaction(
  transaction: TransactionSql,
  statementTimeoutMilliseconds: number,
  lockTimeoutMilliseconds: number,
  signal: AbortSignal | undefined,
): Promise<void> {
  await executePending(
    transaction`
      select
        pg_catalog.set_config(
          'statement_timeout',
          ${String(statementTimeoutMilliseconds)},
          true
        ),
        pg_catalog.set_config(
          'lock_timeout',
          ${String(lockTimeoutMilliseconds)},
          true
        )
    `,
    signal,
  );
}

async function acquireMigrationLock(
  transaction: TransactionSql,
  signal: AbortSignal | undefined,
): Promise<void> {
  await executePending(
    transaction`
      select pg_catalog.pg_advisory_xact_lock(
        ${MIGRATION_LOCK_KEY.toString()}::bigint
      )
    `,
    signal,
  );
}

async function requireSupportedVersion(
  transaction: TransactionSql,
  signal: AbortSignal | undefined,
): Promise<string> {
  const rows = await executePending<
    readonly {
      readonly server_version: string;
      readonly server_version_num: number;
    }[]
  >(
    transaction`
      select
        pg_catalog.current_setting('server_version') as server_version,
        pg_catalog.current_setting('server_version_num')::integer
          as server_version_num
    `,
    signal,
  );
  const row = rows[0];
  if (
    row === undefined ||
    typeof row.server_version !== 'string' ||
    typeof row.server_version_num !== 'number' ||
    Math.floor(row.server_version_num / 10_000) !== SUPPORTED_POSTGRESQL_MAJOR
  ) {
    throw persistenceError('persistence.unsupported-version');
  }
  return row.server_version;
}

async function bootstrapMigrationHistory(
  transaction: TransactionSql,
  signal: AbortSignal | undefined,
): Promise<void> {
  await executePending(
    transaction`
      create schema if not exists gitblocks
    `,
    signal,
  );
  await executePending(
    transaction`
      revoke all on schema gitblocks from public
    `,
    signal,
  );
  await executePending(
    transaction`
      create table if not exists gitblocks.schema_migrations (
        version integer primary key,
        name text not null unique,
        checksum text not null,
        applied_at timestamptz not null,
        constraint schema_migrations_version check (version > 0),
        constraint schema_migrations_name
          check (
            pg_catalog.octet_length(name) between 1 and 100
            and name ~ '^[a-z0-9](?:[a-z0-9-]{0,98}[a-z0-9])?$'
          ),
        constraint schema_migrations_checksum
          check (checksum ~ '^[0-9a-f]{64}$'),
        constraint schema_migrations_applied_at_finite
          check (
            applied_at
              not in (
                'infinity'::timestamptz,
                '-infinity'::timestamptz
              )
          )
      )
    `,
    signal,
  );
  await executePending(
    transaction`
      revoke all on table gitblocks.schema_migrations from public
    `,
    signal,
  );
}

async function loadAppliedMigrations(
  transaction: TransactionSql,
  signal: AbortSignal | undefined,
): Promise<readonly MigrationRecord[]> {
  const rows = await executePending<
    readonly {
      readonly version: number;
      readonly name: string;
      readonly checksum: string;
    }[]
  >(
    transaction`
      select version, name, checksum
      from gitblocks.schema_migrations
      order by version
    `,
    signal,
  );
  return rows.map((row) => {
    if (
      typeof row.version !== 'number' ||
      typeof row.name !== 'string' ||
      typeof row.checksum !== 'string'
    ) {
      throw persistenceError('persistence.migration-drift');
    }
    return {
      version: row.version,
      name: row.name,
      checksum: row.checksum,
    };
  });
}

function verifyHistory(
  known: readonly LoadedMigration[],
  applied: readonly MigrationRecord[],
): void {
  if (applied.length > known.length) {
    throw persistenceError('persistence.migration-drift');
  }
  for (let index = 0; index < applied.length; index += 1) {
    const expected = known[index];
    const actual = applied[index];
    if (
      expected === undefined ||
      actual === undefined ||
      expected.version !== index + 1 ||
      actual.version !== expected.version ||
      actual.name !== expected.name ||
      actual.checksum !== expected.checksum
    ) {
      throw persistenceError('persistence.migration-drift');
    }
  }
}

async function loadKnownMigrations(): Promise<readonly LoadedMigration[]> {
  const loaded: LoadedMigration[] = [];
  for (const migration of KNOWN_MIGRATIONS) {
    const sql = await readMigrationFile(migration.fileName);
    loaded.push({
      ...migration,
      checksum: createHash('sha256').update(sql, 'utf8').digest('hex'),
      sql,
    });
  }
  return loaded;
}

async function readMigrationFile(fileName: string): Promise<string> {
  const candidates = [
    new URL(`../migrations/${fileName}`, import.meta.url),
    new URL(`../../migrations/${fileName}`, import.meta.url),
  ];
  for (const candidate of candidates) {
    try {
      return await readFile(candidate, 'utf8');
    } catch {
      // A source checkout and a built package have different module depths.
    }
  }
  throw persistenceError('persistence.migration-drift');
}

function migrationRecord(migration: LoadedMigration): MigrationRecord {
  return {
    version: migration.version,
    name: migration.name,
    checksum: migration.checksum,
  };
}

function normalizeMigrationError(error: unknown): Error {
  if (
    error instanceof Error &&
    'code' in error &&
    (error as { readonly code?: unknown }).code ===
      'persistence.unsupported-version'
  ) {
    return error;
  }
  if (
    error instanceof Error &&
    'code' in error &&
    (error as { readonly code?: unknown }).code ===
      'persistence.migration-drift'
  ) {
    return error;
  }
  if (
    typeof error === 'object' &&
    error !== null &&
    Object.hasOwn(error, 'code')
  ) {
    try {
      const code = Reflect.get(error, 'code') as unknown;
      if (code === '3F000' || code === '42P01') {
        return persistenceError('persistence.migration-drift');
      }
    } catch {
      return persistenceError('persistence.connection');
    }
  }
  return normalizePersistenceError(error);
}
