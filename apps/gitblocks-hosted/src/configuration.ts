import type { PersistenceClientConfig } from '@gitblocks/persistence';

import { HostedDiscoveryError } from './errors.ts';

export const HOSTED_SERVING_DATABASE_ENVIRONMENT_NAMES = Object.freeze({
  host: 'GITBLOCKS_HOSTED_SERVING_DB_HOST',
  port: 'GITBLOCKS_HOSTED_SERVING_DB_PORT',
  database: 'GITBLOCKS_HOSTED_SERVING_DB_DATABASE',
  username: 'GITBLOCKS_HOSTED_SERVING_DB_USERNAME',
  password: 'GITBLOCKS_HOSTED_SERVING_DB_PASSWORD',
  ssl: 'GITBLOCKS_HOSTED_SERVING_DB_SSL',
} as const);

export const HOSTED_MCP_PORT_ENVIRONMENT_NAME = 'GITBLOCKS_HOSTED_MCP_PORT';
export const DEFAULT_HOSTED_MCP_PORT = 3333;

export function readHostedMcpPortConfiguration(
  environment: Readonly<Record<string, string | undefined>>,
): number {
  const text = environment[HOSTED_MCP_PORT_ENVIRONMENT_NAME];
  if (text === undefined) return DEFAULT_HOSTED_MCP_PORT;
  const port = Number(text);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new HostedDiscoveryError('hosted.invalid-configuration');
  }
  return port;
}

export function readHostedServingDatabaseConfiguration(
  environment: Readonly<Record<string, string | undefined>>,
): PersistenceClientConfig {
  const host = requiredEnvironment(environment, 'host');
  const portText = requiredEnvironment(environment, 'port');
  const database = requiredEnvironment(environment, 'database');
  const username = requiredEnvironment(environment, 'username');
  const password = requiredEnvironment(environment, 'password');
  const sslText = requiredEnvironment(environment, 'ssl');
  const port = Number(portText);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new HostedDiscoveryError('hosted.invalid-configuration');
  }
  const ssl =
    sslText === 'disable'
      ? false
      : sslText === 'require'
        ? ('require' as const)
        : null;
  if (ssl === null) {
    throw new HostedDiscoveryError('hosted.invalid-configuration');
  }
  return Object.freeze({ host, port, database, username, password, ssl });
}

function requiredEnvironment(
  environment: Readonly<Record<string, string | undefined>>,
  key: keyof typeof HOSTED_SERVING_DATABASE_ENVIRONMENT_NAMES,
): string {
  const value = environment[HOSTED_SERVING_DATABASE_ENVIRONMENT_NAMES[key]];
  if (value === undefined || value.length === 0) {
    throw new HostedDiscoveryError('hosted.invalid-configuration');
  }
  return value;
}
