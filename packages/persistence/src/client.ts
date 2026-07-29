import postgres, {
  type PendingQuery,
  type Row,
  type Sql,
  type TransactionSql,
} from 'postgres';

import {
  normalizePersistenceError,
  persistenceError,
  type PersistenceError,
} from './errors.ts';
import type {
  OperationControl,
  PersistenceClientConfig,
  StorageScope,
} from './types.ts';
import {
  validateControl,
  validateIntegerBound,
  validateScope,
} from './validation.ts';

const CLIENT_STATE = new WeakMap<
  PersistenceClient,
  {
    readonly sql: Sql;
    readonly defaults: {
      readonly statementTimeoutMilliseconds: number;
      readonly lockTimeoutMilliseconds: number;
    };
    closed: boolean;
  }
>();

export interface PersistenceClient {
  readonly kind: 'gitblocks-postgresql-persistence';
}

export type PersistenceTransaction = TransactionSql;

export function createPersistenceClient(
  config: PersistenceClientConfig,
): PersistenceClient {
  validateClientConfig(config);
  const client: PersistenceClient = Object.freeze({
    kind: 'gitblocks-postgresql-persistence',
  });
  const sql = postgres({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.username,
    password: config.password,
    ssl: config.ssl,
    max: config.maximumConnections ?? 10,
    connect_timeout: Math.ceil(
      (config.connectTimeoutMilliseconds ?? 5_000) / 1_000,
    ),
    idle_timeout: Math.ceil((config.idleTimeoutMilliseconds ?? 10_000) / 1_000),
    max_lifetime: null,
    prepare: true,
    fetch_types: true,
    onnotice: () => undefined,
    debug: false,
    connection: {
      application_name: 'gitblocks-persistence',
    },
    target_session_attrs: 'read-write',
  });
  CLIENT_STATE.set(client, {
    sql,
    defaults: {
      statementTimeoutMilliseconds:
        config.statementTimeoutMilliseconds ?? 10_000,
      lockTimeoutMilliseconds: config.lockTimeoutMilliseconds ?? 5_000,
    },
    closed: false,
  });
  return client;
}

export async function closePersistenceClient(
  client: PersistenceClient,
): Promise<void> {
  const state = requireClientState(client, true);
  if (state.closed) {
    return;
  }
  state.closed = true;
  try {
    await state.sql.end({ timeout: 5 });
  } catch {
    throw persistenceError('persistence.connection');
  }
}

export function getMigrationSql(client: PersistenceClient): Sql {
  return requireClientState(client).sql;
}

export async function withTransaction<Value>(
  client: PersistenceClient,
  scope: StorageScope | undefined,
  control: OperationControl | undefined,
  mode: 'read-write' | 'read-only',
  operation: (
    transaction: PersistenceTransaction,
    signal: AbortSignal | undefined,
  ) => Promise<Value>,
): Promise<Value> {
  const state = requireClientState(client);
  const validatedControl = validateControl(control, state.defaults);
  if (validatedControl.signal?.aborted === true) {
    throw persistenceError('persistence.deadline');
  }
  const validatedScope = scope === undefined ? undefined : validateScope(scope);
  try {
    const options =
      mode === 'read-only'
        ? 'read only isolation level repeatable read'
        : 'read write isolation level read committed';
    const result = await state.sql.begin(options, async (transaction) => {
      await executePending(
        transaction`
          select
            pg_catalog.set_config(
              'statement_timeout',
              ${String(validatedControl.statementTimeoutMilliseconds)},
              true
            ),
            pg_catalog.set_config(
              'lock_timeout',
              ${String(validatedControl.lockTimeoutMilliseconds)},
              true
            ),
            pg_catalog.set_config(
              'gitblocks.tenant_id',
              ${validatedScope?.tenantId ?? ''},
              true
            )
        `,
        validatedControl.signal,
      );
      return operation(transaction, validatedControl.signal);
    });
    return result as Value;
  } catch (error) {
    throw normalizePersistenceError(error);
  }
}

export async function executePending<
  Rows extends readonly (object | undefined)[],
>(pending: PendingQuery<Rows>, signal: AbortSignal | undefined): Promise<Rows> {
  if (signal?.aborted === true) {
    pending.cancel();
    throw persistenceError('persistence.deadline');
  }
  const cancel = (): void => {
    pending.cancel();
  };
  signal?.addEventListener('abort', cancel, { once: true });
  try {
    return await pending;
  } finally {
    signal?.removeEventListener('abort', cancel);
  }
}

export function mapDatabaseError(error: unknown): PersistenceError {
  return normalizePersistenceError(error);
}

function requireClientState(
  client: PersistenceClient,
  allowClosed = false,
): {
  readonly sql: Sql;
  readonly defaults: {
    readonly statementTimeoutMilliseconds: number;
    readonly lockTimeoutMilliseconds: number;
  };
  closed: boolean;
} {
  const state = CLIENT_STATE.get(client);
  if (state === undefined || (!allowClosed && state.closed)) {
    throw persistenceError('persistence.closed');
  }
  return state;
}

function validateClientConfig(config: PersistenceClientConfig): void {
  const ssl: unknown = config.ssl;
  if (
    !isSafeConfigText(config.host, 255) ||
    !isSafeConfigText(config.database, 63) ||
    !isSafeConfigText(config.username, 63) ||
    typeof config.password !== 'string' ||
    config.password.length > 4_096 ||
    (ssl !== false && ssl !== 'require')
  ) {
    throw persistenceError('persistence.invalid-input');
  }
  validateIntegerBound(config.port, 1, 65_535);
  validateIntegerBound(config.maximumConnections ?? 10, 1, 20);
  validateIntegerBound(config.connectTimeoutMilliseconds ?? 5_000, 250, 60_000);
  validateIntegerBound(
    config.idleTimeoutMilliseconds ?? 10_000,
    1_000,
    300_000,
  );
  validateIntegerBound(
    config.statementTimeoutMilliseconds ?? 10_000,
    1,
    60_000,
  );
  validateIntegerBound(config.lockTimeoutMilliseconds ?? 5_000, 1, 30_000);
}

function isSafeConfigText(value: string, maximumLength: number): boolean {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= maximumLength &&
    !hasControlCharacter(value)
  );
}

function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (
      codePoint === undefined ||
      (codePoint >= 0 && codePoint <= 31) ||
      codePoint === 127
    ) {
      return true;
    }
  }
  return false;
}

export type DatabaseRow = Row;
