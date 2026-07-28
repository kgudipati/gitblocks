import { type SpawnSyncReturns } from 'node:child_process';

const MAX_ERROR_CHARACTERS = 512;
const MAX_OUTPUT_CHARACTERS = 1_024;
const MAX_PATH_CHARACTERS = 512;
const MAX_VERSION_CHARACTERS = 64;

export function assertChildExit(
  result: SpawnSyncReturns<string>,
  expectedStatus: number,
): void {
  if (result.status === expectedStatus) {
    return;
  }

  throw new Error(
    [
      `Expected child exit status ${String(expectedStatus)}.`,
      `status: ${result.status === null ? 'none' : String(result.status)}`,
      `signal: ${result.signal ?? 'none'}`,
      `process.execPath: ${boundedField(process.execPath, MAX_PATH_CHARACTERS)}`,
      `Node version: ${boundedField(process.versions.node, MAX_VERSION_CHARACTERS)}`,
      `stdout:\n${boundedField(result.stdout, MAX_OUTPUT_CHARACTERS)}`,
      `stderr:\n${boundedField(result.stderr, MAX_OUTPUT_CHARACTERS)}`,
      `spawn error:\n${boundedField(result.error?.message ?? '', MAX_ERROR_CHARACTERS)}`,
    ].join('\n'),
  );
}

function boundedField(value: string, maximumCharacters: number): string {
  const sanitized = Array.from(value, (character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return (codePoint <= 31 && character !== '\n' && character !== '\t') ||
      codePoint === 127
      ? '?'
      : character;
  }).join('');
  if (sanitized.length <= maximumCharacters) {
    return sanitized;
  }
  const suffix = '…[truncated]';
  return `${sanitized.slice(0, maximumCharacters - suffix.length)}${suffix}`;
}
