export type LiveDatabaseSslModeV1 =
  false | 'allow' | 'prefer' | 'require' | 'verify-full';

export interface LiveDatabaseConfigV1 {
  readonly host: string;
  readonly port: number;
  readonly database: string;
  readonly username: string;
  readonly password: string;
  readonly ssl: LiveDatabaseSslModeV1;
}

export function parseLiveProductionDatabaseUrlV1(
  value: unknown,
): LiveDatabaseConfigV1 {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error('DATABASE_URL is required for production configuration.');
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
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
    throw new Error('DATABASE_URL database name must not end in _test.');
  }

  const sslmodes = parsed.searchParams.getAll('sslmode');
  if (sslmodes.length > 1) {
    throw new Error('DATABASE_URL sslmode is invalid.');
  }
  const sslmode = sslmodes[0] ?? 'require';
  const ssl: LiveDatabaseSslModeV1 =
    sslmode === 'disable'
      ? false
      : sslmode === 'allow' ||
          sslmode === 'prefer' ||
          sslmode === 'require' ||
          sslmode === 'verify-full'
        ? sslmode
        : (() => {
            throw new Error('DATABASE_URL sslmode is invalid.');
          })();
  return Object.freeze({ host, port, database, username, password, ssl });
}

function invalidDatabaseUrl(): Error {
  return new Error('DATABASE_URL is invalid.');
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
