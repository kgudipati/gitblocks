import { isAbsolute } from 'node:path';

export interface RepositoryInterviewOperatorCliConfigurationV1 {
  readonly acknowledgement: string;
  readonly candidatePlanFile: string;
  readonly artifactReceiptFile: string | null;
  readonly selectionFile: string | null;
  readonly selectionMaterializationFile: string | null;
  readonly preliveAuthorizationFile: string | null;
  readonly specificationDirectory: string;
  readonly modelProfileFile: string;
  readonly operatorPolicyFile: string;
  readonly databaseHost: string;
  readonly databasePort: number;
  readonly databaseName: string;
  readonly databaseUser: string;
  readonly databaseSsl: false | 'require';
  readonly databasePasswordEnv: string;
  readonly openAiTokenEnv: string;
  readonly receiptPath: string;
  readonly dryRun: boolean;
  readonly executionMode: 'normal' | 'forced';
  readonly forceReason:
    'calibration' | 'review-rejected' | 'operator-recovery' | null;
  readonly verifyImmediateReuse: boolean;
}

const VALUE_ARGUMENTS = new Set([
  '--acknowledge-ephemeral-non-production',
  '--candidate-plan-file',
  '--artifact-receipt-file',
  '--selection-file',
  '--selection-materialization-file',
  '--prelive-authorization-file',
  '--specification-directory',
  '--model-profile-file',
  '--operator-policy-file',
  '--database-host',
  '--database-port',
  '--database-name',
  '--database-user',
  '--database-ssl',
  '--database-password-env',
  '--openai-token-env',
  '--receipt-path',
  '--force-reason',
]);
const FLAG_ARGUMENTS = new Set([
  '--dry-run',
  '--force',
  '--verify-immediate-reuse',
]);
const ENV_NAME = /^[A-Z][A-Z0-9_]{0,63}$/u;
const SAFE_FORCE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/u;
const PRODUCT_FORCE_REASONS = new Set([
  'calibration',
  'review-rejected',
  'operator-recovery',
]);

export class RepositoryInterviewOperatorConfigurationError extends Error {
  public constructor() {
    super('Repository interview operator configuration is invalid.');
    this.name = 'RepositoryInterviewOperatorConfigurationError';
    Object.defineProperty(this, 'stack', { value: undefined });
  }
}

export function parseRepositoryInterviewOperatorArgumentsV1(
  argv: readonly string[],
): RepositoryInterviewOperatorCliConfigurationV1 {
  const values = new Map<string, string>();
  const flags = new Set<string>();
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument?.startsWith('--')) throw invalid();
    if (VALUE_ARGUMENTS.has(argument)) {
      if (values.has(argument)) throw invalid();
      const value = argv[index + 1];
      if (value === undefined || value.length === 0 || value.startsWith('--')) {
        throw invalid();
      }
      values.set(argument, value);
      index += 1;
    } else if (FLAG_ARGUMENTS.has(argument)) {
      if (flags.has(argument)) throw invalid();
      flags.add(argument);
    } else {
      throw invalid();
    }
  }
  const conditional = new Set([
    '--artifact-receipt-file',
    '--selection-file',
    '--selection-materialization-file',
    '--prelive-authorization-file',
  ]);
  for (const argument of VALUE_ARGUMENTS) {
    if (
      argument !== '--force-reason' &&
      !conditional.has(argument) &&
      !values.has(argument)
    )
      throw invalid();
  }
  const force = flags.has('--force');
  const forceReason = values.get('--force-reason') ?? null;
  if (
    force !== (forceReason !== null) ||
    (forceReason !== null &&
      (!SAFE_FORCE.test(forceReason) ||
        !PRODUCT_FORCE_REASONS.has(forceReason))) ||
    (force && flags.has('--verify-immediate-reuse'))
  )
    throw invalid();
  const databaseName = requireValue(values, '--database-name');
  const acknowledgement = requireValue(
    values,
    '--acknowledge-ephemeral-non-production',
  );
  if (acknowledgement !== databaseName) throw invalid();
  const databasePort = Number(requireValue(values, '--database-port'));
  const ssl = requireValue(values, '--database-ssl');
  const databasePasswordEnv = requireValue(values, '--database-password-env');
  const openAiTokenEnv = requireValue(values, '--openai-token-env');
  const candidatePlanFile = requireValue(values, '--candidate-plan-file');
  const groupCount = [...conditional].filter((argument) =>
    values.has(argument),
  ).length;
  const dryRun = flags.has('--dry-run');
  if (
    (groupCount !== 0 && groupCount !== conditional.size) ||
    (!dryRun && groupCount === 0) ||
    (!dryRun && force)
  ) {
    throw invalid();
  }
  const artifactReceiptFile = values.get('--artifact-receipt-file') ?? null;
  const selectionFile = values.get('--selection-file') ?? null;
  const selectionMaterializationFile =
    values.get('--selection-materialization-file') ?? null;
  const preliveAuthorizationFile =
    values.get('--prelive-authorization-file') ?? null;
  const specificationDirectory = requireValue(
    values,
    '--specification-directory',
  );
  const modelProfileFile = requireValue(values, '--model-profile-file');
  const operatorPolicyFile = requireValue(values, '--operator-policy-file');
  const receiptPath = requireValue(values, '--receipt-path');
  const paths = [
    candidatePlanFile,
    specificationDirectory,
    modelProfileFile,
    operatorPolicyFile,
    receiptPath,
    ...[
      artifactReceiptFile,
      selectionFile,
      selectionMaterializationFile,
      preliveAuthorizationFile,
    ].filter((path): path is string => path !== null),
  ];
  if (
    !Number.isSafeInteger(databasePort) ||
    databasePort < 1 ||
    databasePort > 65_535 ||
    (ssl !== 'disabled' && ssl !== 'require') ||
    !ENV_NAME.test(databasePasswordEnv) ||
    !ENV_NAME.test(openAiTokenEnv) ||
    paths.some((path) => !isAbsolute(path) || path.length > 4_096) ||
    [
      databaseName,
      requireValue(values, '--database-host'),
      requireValue(values, '--database-user'),
    ].some((value) => !safeText(value, 255))
  )
    throw invalid();
  return Object.freeze({
    acknowledgement,
    candidatePlanFile,
    artifactReceiptFile,
    selectionFile,
    selectionMaterializationFile,
    preliveAuthorizationFile,
    specificationDirectory,
    modelProfileFile,
    operatorPolicyFile,
    databaseHost: requireValue(values, '--database-host'),
    databasePort,
    databaseName,
    databaseUser: requireValue(values, '--database-user'),
    databaseSsl: ssl === 'require' ? 'require' : false,
    databasePasswordEnv,
    openAiTokenEnv,
    receiptPath,
    dryRun,
    executionMode: force ? 'forced' : 'normal',
    forceReason:
      forceReason as RepositoryInterviewOperatorCliConfigurationV1['forceReason'],
    verifyImmediateReuse: flags.has('--verify-immediate-reuse'),
  });
}

function requireValue(
  values: ReadonlyMap<string, string>,
  key: string,
): string {
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

function invalid(): RepositoryInterviewOperatorConfigurationError {
  return new RepositoryInterviewOperatorConfigurationError();
}
