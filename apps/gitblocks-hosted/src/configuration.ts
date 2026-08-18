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

export const HOSTED_MCP_HOST_ENVIRONMENT_NAME = 'GITBLOCKS_HOSTED_MCP_HOST';
export const HOSTED_MCP_PUBLIC_HOST_ENVIRONMENT_NAME =
  'GITBLOCKS_HOSTED_MCP_PUBLIC_HOST';
export const HOSTED_MCP_PORT_ENVIRONMENT_NAME = 'GITBLOCKS_HOSTED_MCP_PORT';
export const MCP_TOKEN_ENVIRONMENT_NAME = 'GITBLOCKS_MCP_TOKEN';
export const DEFAULT_HOSTED_MCP_HOST = '127.0.0.1';
export const DEFAULT_HOSTED_MCP_PORT = 3333;
export const OPENAI_API_KEY_ENVIRONMENT_NAME = 'OPENAI_API_KEY';
export const HOSTED_FIT_MODEL_ENVIRONMENT_NAME = 'GITBLOCKS_HOSTED_FIT_MODEL';
export const HOSTED_FIT_MODEL = 'gpt-5.4-mini-2026-03-17';

const EXPECTED_NON_EMPTY_TEXT = 'non-empty text';
const EXPECTED_PORT = 'an integer from 1 through 65535';
const EXPECTED_SSL = 'one of: disable, require';
const EXPECTED_MCP_HOST =
  'a hostname or IP address without a scheme, path, or port';
const EXPECTED_API_KEY =
  '1 to 512 ASCII letters, digits, periods, underscores, or hyphens';

type HostedEnvironmentV1 = Readonly<Record<string, string | undefined>>;

export interface HostedConfigurationProblemV1 {
  readonly variable: string;
  readonly expected: string;
}

export class HostedConfigurationError extends HostedDiscoveryError {
  public readonly problems: readonly HostedConfigurationProblemV1[];

  public constructor(problems: readonly HostedConfigurationProblemV1[]) {
    super('hosted.invalid-configuration');
    this.name = 'HostedConfigurationError';
    this.problems = Object.freeze(
      problems.map(({ variable, expected }) =>
        Object.freeze({ variable, expected }),
      ),
    );
    this.message = `Hosted discovery configuration is invalid. ${this.problems
      .map(({ variable, expected }) => `${variable}: expected ${expected}`)
      .join('; ')}.`;
  }
}

export interface HostedFitModelConfigurationV1 {
  readonly apiKey: string;
  readonly model: string;
}

export interface HostedRuntimeConfigurationV1 {
  readonly database: PersistenceClientConfig;
  readonly fitModel: HostedFitModelConfigurationV1;
  readonly host: string;
  readonly publicHost: string;
  readonly port: number;
  readonly token: string;
}

export function readHostedRuntimeConfiguration(
  environment: HostedEnvironmentV1,
): HostedRuntimeConfigurationV1 {
  const problems = [
    ...servingDatabaseProblems(environment),
    ...mcpHostProblems(environment),
    ...mcpPublicHostProblems(environment),
    ...mcpPortProblems(environment),
    ...mcpTokenProblems(environment),
    ...fitModelProblems(environment),
  ];
  throwForProblems(problems);
  return Object.freeze({
    database: readHostedServingDatabaseConfiguration(environment),
    fitModel: readHostedFitModelConfiguration(environment),
    host: readHostedMcpHostConfiguration(environment),
    publicHost: readHostedMcpPublicHostConfiguration(environment),
    port: readHostedMcpPortConfiguration(environment),
    token: readHostedMcpTokenConfiguration(environment),
  });
}

export function readHostedFitModelConfiguration(
  environment: HostedEnvironmentV1,
): HostedFitModelConfigurationV1 {
  throwForProblems(fitModelProblems(environment));
  return Object.freeze({
    apiKey: configuredValue(environment, OPENAI_API_KEY_ENVIRONMENT_NAME),
    model: configuredValue(environment, HOSTED_FIT_MODEL_ENVIRONMENT_NAME),
  });
}

export function readHostedMcpHostConfiguration(
  environment: HostedEnvironmentV1,
): string {
  throwForProblems(mcpHostProblems(environment));
  return (
    environment[HOSTED_MCP_HOST_ENVIRONMENT_NAME] ?? DEFAULT_HOSTED_MCP_HOST
  );
}

export function readHostedMcpPublicHostConfiguration(
  environment: HostedEnvironmentV1,
): string {
  throwForProblems(mcpPublicHostProblems(environment));
  return (
    environment[HOSTED_MCP_PUBLIC_HOST_ENVIRONMENT_NAME] ??
    readHostedMcpHostConfiguration(environment)
  );
}

export function readHostedMcpPortConfiguration(
  environment: HostedEnvironmentV1,
): number {
  throwForProblems(mcpPortProblems(environment));
  const text = environment[HOSTED_MCP_PORT_ENVIRONMENT_NAME];
  return text === undefined ? DEFAULT_HOSTED_MCP_PORT : Number(text);
}

export function readHostedMcpTokenConfiguration(
  environment: HostedEnvironmentV1,
): string {
  throwForProblems(mcpTokenProblems(environment));
  return configuredValue(environment, MCP_TOKEN_ENVIRONMENT_NAME);
}

export function readHostedServingDatabaseConfiguration(
  environment: HostedEnvironmentV1,
): PersistenceClientConfig {
  throwForProblems(servingDatabaseProblems(environment));
  const sslText = configuredValue(
    environment,
    HOSTED_SERVING_DATABASE_ENVIRONMENT_NAMES.ssl,
  );
  return Object.freeze({
    host: configuredValue(
      environment,
      HOSTED_SERVING_DATABASE_ENVIRONMENT_NAMES.host,
    ),
    port: Number(
      configuredValue(
        environment,
        HOSTED_SERVING_DATABASE_ENVIRONMENT_NAMES.port,
      ),
    ),
    database: configuredValue(
      environment,
      HOSTED_SERVING_DATABASE_ENVIRONMENT_NAMES.database,
    ),
    username: configuredValue(
      environment,
      HOSTED_SERVING_DATABASE_ENVIRONMENT_NAMES.username,
    ),
    password: configuredValue(
      environment,
      HOSTED_SERVING_DATABASE_ENVIRONMENT_NAMES.password,
    ),
    ssl: sslText === 'disable' ? false : ('require' as const),
  });
}

function servingDatabaseProblems(
  environment: HostedEnvironmentV1,
): readonly HostedConfigurationProblemV1[] {
  const problems: HostedConfigurationProblemV1[] = [];
  for (const key of ['host', 'database', 'username', 'password'] as const) {
    const variable = HOSTED_SERVING_DATABASE_ENVIRONMENT_NAMES[key];
    if (!isNonEmpty(environment[variable])) {
      problems.push(problem(variable, EXPECTED_NON_EMPTY_TEXT));
    }
  }
  const portVariable = HOSTED_SERVING_DATABASE_ENVIRONMENT_NAMES.port;
  if (!isPort(environment[portVariable])) {
    problems.splice(1, 0, problem(portVariable, EXPECTED_PORT));
  }
  const sslVariable = HOSTED_SERVING_DATABASE_ENVIRONMENT_NAMES.ssl;
  const ssl = environment[sslVariable];
  if (ssl !== 'disable' && ssl !== 'require') {
    problems.push(problem(sslVariable, EXPECTED_SSL));
  }
  return problems;
}

function mcpHostProblems(
  environment: HostedEnvironmentV1,
): readonly HostedConfigurationProblemV1[] {
  const host = environment[HOSTED_MCP_HOST_ENVIRONMENT_NAME];
  return host === undefined || isValidHost(host)
    ? []
    : [problem(HOSTED_MCP_HOST_ENVIRONMENT_NAME, EXPECTED_MCP_HOST)];
}

function mcpPublicHostProblems(
  environment: HostedEnvironmentV1,
): readonly HostedConfigurationProblemV1[] {
  const host = environment[HOSTED_MCP_PUBLIC_HOST_ENVIRONMENT_NAME];
  return host === undefined || isValidHost(host)
    ? []
    : [problem(HOSTED_MCP_PUBLIC_HOST_ENVIRONMENT_NAME, EXPECTED_MCP_HOST)];
}

function mcpPortProblems(
  environment: HostedEnvironmentV1,
): readonly HostedConfigurationProblemV1[] {
  const port = environment[HOSTED_MCP_PORT_ENVIRONMENT_NAME];
  return port === undefined || isPort(port)
    ? []
    : [problem(HOSTED_MCP_PORT_ENVIRONMENT_NAME, EXPECTED_PORT)];
}

function mcpTokenProblems(
  environment: HostedEnvironmentV1,
): readonly HostedConfigurationProblemV1[] {
  return isNonEmpty(environment[MCP_TOKEN_ENVIRONMENT_NAME])
    ? []
    : [problem(MCP_TOKEN_ENVIRONMENT_NAME, EXPECTED_NON_EMPTY_TEXT)];
}

function fitModelProblems(
  environment: HostedEnvironmentV1,
): readonly HostedConfigurationProblemV1[] {
  const problems: HostedConfigurationProblemV1[] = [];
  const apiKey = environment[OPENAI_API_KEY_ENVIRONMENT_NAME];
  if (apiKey === undefined || !/^[A-Za-z0-9._-]{1,512}$/u.test(apiKey)) {
    problems.push(problem(OPENAI_API_KEY_ENVIRONMENT_NAME, EXPECTED_API_KEY));
  }
  if (environment[HOSTED_FIT_MODEL_ENVIRONMENT_NAME] !== HOSTED_FIT_MODEL) {
    problems.push(
      problem(
        HOSTED_FIT_MODEL_ENVIRONMENT_NAME,
        `the exact identifier ${HOSTED_FIT_MODEL}`,
      ),
    );
  }
  return problems;
}

function throwForProblems(
  problems: readonly HostedConfigurationProblemV1[],
): void {
  if (problems.length > 0) throw new HostedConfigurationError(problems);
}

function problem(
  variable: string,
  expected: string,
): HostedConfigurationProblemV1 {
  return Object.freeze({ variable, expected });
}

function isNonEmpty(value: string | undefined): value is string {
  return value !== undefined && value.length > 0;
}

function isPort(value: string | undefined): boolean {
  if (!isNonEmpty(value)) return false;
  const port = Number(value);
  return Number.isInteger(port) && port >= 1 && port <= 65_535;
}

function isValidHost(value: string): boolean {
  if (value.length === 0 || value.length > 253) return false;
  if (/^[0-9]+(?:[.][0-9]+){3}$/u.test(value)) {
    return value.split('.').every((octet) => Number(octet) <= 255);
  }
  if (value.includes(':')) return isValidIpv6Address(value);
  if (value === 'localhost') return true;
  return value
    .split('.')
    .every(
      (label) =>
        label.length >= 1 &&
        label.length <= 63 &&
        /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/u.test(label),
    );
}

function isValidIpv6Address(value: string): boolean {
  try {
    const parsed = new URL(`http://[${value}]`);
    return parsed.hostname.startsWith('[') && parsed.hostname.endsWith(']');
  } catch {
    return false;
  }
}

function configuredValue(
  environment: HostedEnvironmentV1,
  variable: string,
): string {
  return environment[variable] ?? '';
}
