import { fileURLToPath } from 'node:url';

import { validateBranchName } from './branch-name.ts';
import { validatePullRequestTitle } from './pr-title.ts';
import { RepositoryBoundaryError } from './repository-reader.ts';
import { runRepositoryChecks } from './repository-runner.ts';
import { type Diagnostic } from './types.ts';

export const EXIT_CODES = {
  success: 0,
  policyViolation: 1,
  usage: 2,
  internalError: 3,
} as const;

interface Output {
  readonly error: (message: string) => void;
  readonly log: (message: string) => void;
}

export function runCli(
  arguments_: readonly string[],
  workingDirectory: string,
  output: Output,
): number {
  const [command, ...rawValues] = arguments_;
  const values = rawValues[0] === '--' ? rawValues.slice(1) : rawValues;

  try {
    if (command === 'branch') {
      return runValueCheck(
        values,
        validateBranchName,
        'Branch name check passed.',
        output,
      );
    }
    if (command === 'pr-title') {
      return runValueCheck(
        values,
        validatePullRequestTitle,
        'Pull request title check passed.',
        output,
      );
    }
    if (command === 'repository' && values.length === 0) {
      const diagnostics = runRepositoryChecks(workingDirectory);
      return reportDiagnostics(
        diagnostics,
        'Repository checks passed.',
        output,
      );
    }

    output.error(
      'usage: repository-checks <branch|pr-title|repository> [value]',
    );
    return EXIT_CODES.usage;
  } catch (error: unknown) {
    if (error instanceof RepositoryBoundaryError) {
      output.error(`${error.code}: ${sanitize(error.message)}`);
    } else {
      output.error('repository.internal: Unexpected internal error.');
    }
    return EXIT_CODES.internalError;
  }
}

function runValueCheck(
  values: readonly string[],
  validator: (value: string) => Diagnostic[],
  successMessage: string,
  output: Output,
): number {
  if (values.length !== 1) {
    output.error('usage: repository-checks <branch|pr-title> <value>');
    return EXIT_CODES.usage;
  }
  const value = values[0];
  if (value === undefined) {
    output.error('usage: repository-checks <branch|pr-title> <value>');
    return EXIT_CODES.usage;
  }
  return reportDiagnostics(validator(value), successMessage, output);
}

function reportDiagnostics(
  diagnostics: readonly Diagnostic[],
  successMessage: string,
  output: Output,
): number {
  if (diagnostics.length === 0) {
    output.log(successMessage);
    return EXIT_CODES.success;
  }

  for (const repositoryDiagnostic of diagnostics) {
    const prefix =
      repositoryDiagnostic.path === undefined
        ? repositoryDiagnostic.code
        : `${sanitize(repositoryDiagnostic.path)}: ${repositoryDiagnostic.code}`;
    output.error(`${prefix}: ${sanitize(repositoryDiagnostic.message)}`);
  }
  return EXIT_CODES.policyViolation;
}

function sanitize(value: string): string {
  const escaped = Array.from(value)
    .map((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint < 32 || codePoint === 127
        ? `\\u${codePoint.toString(16).padStart(4, '0')}`
        : character;
    })
    .join('');
  return escaped.length > 500 ? `${escaped.slice(0, 500)}…` : escaped;
}

if (
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === process.argv[1]
) {
  process.exitCode = runCli(process.argv.slice(2), process.cwd(), console);
}
