import { isAbsolute } from 'node:path';

export interface RepositoryInterviewPreliveMaterializeConfigurationV1 {
  readonly candidatePlanFile: string;
  readonly artifactReceiptFile: string;
  readonly databaseHost: string;
  readonly databasePort: number;
  readonly databaseName: string;
  readonly databaseUser: string;
  readonly databaseSsl: false | 'require';
  readonly databasePasswordEnv: string;
  readonly acknowledgement: string;
  readonly selectionId: string;
  readonly selectionOutputPath: string;
  readonly materializationOutputPath: string;
}

const ARGUMENTS = Object.freeze([
  '--candidate-plan-file',
  '--artifact-receipt-file',
  '--database-host',
  '--database-port',
  '--database-name',
  '--database-user',
  '--database-ssl',
  '--database-password-env',
  '--acknowledge-ephemeral-non-production',
  '--selection-id',
  '--selection-output-path',
  '--materialization-output-path',
] as const);
const ENV_NAME = /^[A-Z][A-Z0-9_]{0,63}$/u;
const SAFE_ID = /^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/u;

export function parseRepositoryInterviewPreliveMaterializeArgumentsV1(
  argv: readonly string[],
): RepositoryInterviewPreliveMaterializeConfigurationV1 {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === undefined || !ARGUMENTS.includes(argument as never)) {
      throw invalid();
    }
    if (values.has(argument)) throw invalid();
    const value = argv[index + 1];
    if (value === undefined || value.length === 0 || value.startsWith('--')) {
      throw invalid();
    }
    values.set(argument, value);
    index += 1;
  }
  if (values.size !== ARGUMENTS.length) throw invalid();
  const candidatePlanFile = get(values, '--candidate-plan-file');
  const artifactReceiptFile = get(values, '--artifact-receipt-file');
  const selectionOutputPath = get(values, '--selection-output-path');
  const materializationOutputPath = get(
    values,
    '--materialization-output-path',
  );
  const databasePort = Number(get(values, '--database-port'));
  const databaseName = get(values, '--database-name');
  const acknowledgement = get(values, '--acknowledge-ephemeral-non-production');
  const databaseSsl = get(values, '--database-ssl');
  const databasePasswordEnv = get(values, '--database-password-env');
  const selectionId = get(values, '--selection-id');
  if (
    acknowledgement !== databaseName ||
    !Number.isSafeInteger(databasePort) ||
    databasePort < 1 ||
    databasePort > 65_535 ||
    (databaseSsl !== 'disabled' && databaseSsl !== 'require') ||
    !ENV_NAME.test(databasePasswordEnv) ||
    !SAFE_ID.test(selectionId) ||
    [
      candidatePlanFile,
      artifactReceiptFile,
      selectionOutputPath,
      materializationOutputPath,
    ].some((path) => !isAbsolute(path) || path.length > 4_096) ||
    new Set([
      candidatePlanFile,
      artifactReceiptFile,
      selectionOutputPath,
      materializationOutputPath,
    ]).size !== 4 ||
    [
      get(values, '--database-host'),
      databaseName,
      get(values, '--database-user'),
    ].some((value) => !safeText(value, 255))
  )
    throw invalid();
  return Object.freeze({
    candidatePlanFile,
    artifactReceiptFile,
    databaseHost: get(values, '--database-host'),
    databasePort,
    databaseName,
    databaseUser: get(values, '--database-user'),
    databaseSsl: databaseSsl === 'require' ? 'require' : false,
    databasePasswordEnv,
    acknowledgement,
    selectionId,
    selectionOutputPath,
    materializationOutputPath,
  });
}

function get(values: ReadonlyMap<string, string>, key: string): string {
  const value = values.get(key);
  if (value === undefined) throw invalid();
  return value;
}

function safeText(value: string, maximum: number): boolean {
  return (
    value.length > 0 &&
    Buffer.byteLength(value, 'utf8') <= maximum &&
    !Array.from(value).some((character) => {
      const code = character.codePointAt(0) ?? 0;
      return code <= 31 || code === 127;
    })
  );
}

function invalid(): Error {
  const error = new Error(
    'Repository interview materialization configuration is invalid.',
  );
  Object.defineProperty(error, 'stack', { value: undefined });
  return error;
}
