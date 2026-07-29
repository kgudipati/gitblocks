export type PersistenceErrorCode =
  | 'persistence.closed'
  | 'persistence.conflict'
  | 'persistence.connection'
  | 'persistence.corrupt-record'
  | 'persistence.deadline'
  | 'persistence.invalid-input'
  | 'persistence.migration-drift'
  | 'persistence.not-found'
  | 'persistence.result-limit'
  | 'persistence.unsupported-version';

const ERROR_MESSAGES: Readonly<Record<PersistenceErrorCode, string>> = {
  'persistence.closed': 'Persistence client is closed.',
  'persistence.conflict': 'Persistence operation conflicts with stored state.',
  'persistence.connection': 'Persistence service is unavailable.',
  'persistence.corrupt-record': 'Persisted state failed validation.',
  'persistence.deadline': 'Persistence operation exceeded its deadline.',
  'persistence.invalid-input': 'Persistence input is invalid.',
  'persistence.migration-drift':
    'Persistence migration history does not match.',
  'persistence.not-found': 'Persistence record was not found.',
  'persistence.result-limit': 'Persistence result exceeds its supported bound.',
  'persistence.unsupported-version':
    'PostgreSQL server version is not supported.',
};

export class PersistenceError extends Error {
  public readonly code: PersistenceErrorCode;

  public constructor(code: PersistenceErrorCode) {
    super(ERROR_MESSAGES[code]);
    this.name = 'PersistenceError';
    this.code = code;
    Object.defineProperty(this, 'stack', {
      configurable: false,
      enumerable: false,
      value: undefined,
      writable: false,
    });
  }
}

export function persistenceError(code: PersistenceErrorCode): PersistenceError {
  return new PersistenceError(code);
}

export function normalizePersistenceError(error: unknown): PersistenceError {
  if (error instanceof PersistenceError) {
    return error;
  }
  const code = databaseErrorCode(error);
  switch (code) {
    case '23503':
    case '23505':
    case '23514':
    case '23P01':
    case 'P0001':
      return persistenceError('persistence.conflict');
    case 'P0002':
      return persistenceError('persistence.not-found');
    case '22023':
      return persistenceError('persistence.invalid-input');
    case '42501':
      return persistenceError('persistence.connection');
    case '55P03':
    case '57014':
      return persistenceError('persistence.deadline');
    case undefined:
      return persistenceError('persistence.connection');
    default:
      return persistenceError('persistence.connection');
  }
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
    return typeof code === 'string' && code.length <= 8 ? code : undefined;
  } catch {
    return undefined;
  }
}
