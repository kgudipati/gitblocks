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
export const OPENAI_API_KEY_ENVIRONMENT_NAME = 'OPENAI_API_KEY';
export const HOSTED_FIT_MODEL_ENVIRONMENT_NAME = 'GITBLOCKS_HOSTED_FIT_MODEL';
export const HOSTED_FIT_MODEL = 'gpt-5.4-mini-2026-03-17';

export interface HostedFitModelConfigurationV1 {
  readonly apiKey: string;
  readonly model: string;
}

export function readHostedFitModelConfiguration(
  environment: Readonly<Record<string, string | undefined>>,
): HostedFitModelConfigurationV1 {
  const apiKey = environment[OPENAI_API_KEY_ENVIRONMENT_NAME];
  const model = environment[HOSTED_FIT_MODEL_ENVIRONMENT_NAME];
  if (
    apiKey === undefined ||
    !/^[A-Za-z0-9._-]{1,512}$/u.test(apiKey) ||
    model !== HOSTED_FIT_MODEL
  ) {
    throw new HostedDiscoveryError('hosted.invalid-configuration');
  }
  return Object.freeze({ apiKey, model });
}

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
