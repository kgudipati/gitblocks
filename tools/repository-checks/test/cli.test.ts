import { existsSync, mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';

import { afterEach, describe, expect, it } from 'vitest';

import { EXIT_CODES } from '../src/cli.ts';
import { assertChildExit } from './child-process-assertion.ts';
import {
  createValidTemporaryRepository,
  removeTemporaryRepository,
  stageRepository,
  writeRepositoryFile,
} from './temp-repository.ts';

const CLI_PATH = fileURLToPath(new URL('../src/cli.ts', import.meta.url));
const FAILING_CHILD_PATH = fileURLToPath(
  new URL('./fixtures/failing-child.mjs', import.meta.url),
);
const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const temporaryDirectory of temporaryDirectories.splice(0)) {
    removeTemporaryRepository(temporaryDirectory);
  }
});

function track(temporaryDirectory: string): string {
  temporaryDirectories.push(temporaryDirectory);
  return temporaryDirectory;
}

function runCli(
  arguments_: readonly string[],
  workingDirectory: string,
): SpawnSyncReturns<string> {
  return spawnSync(process.execPath, [CLI_PATH, ...arguments_], {
    cwd: workingDirectory,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_CONFIG_GLOBAL: '/dev/null',
      GIT_CONFIG_NOSYSTEM: '1',
    },
  });
}

describe('repository-checks CLI', () => {
  it.each([
    [['branch', 'build/3-typescript-toolchain'], EXIT_CODES.success],
    [['branch', 'feature/3-vague'], EXIT_CODES.policyViolation],
    [['pr-branch', 'maintainer', 'fix/42-timeout'], EXIT_CODES.success],
    [
      [
        'pr-branch',
        'dependabot[bot]',
        'dependabot/npm_and_yarn/typescript-6.0.4',
      ],
      EXIT_CODES.success,
    ],
    [
      ['pr-branch', 'dependabot[bot]', 'dependabot/npm_and_yarn/../typescript'],
      EXIT_CODES.policyViolation,
    ],
    [
      ['pr-branch', 'maintainer', 'dependabot/npm_and_yarn/typescript-6.0.4'],
      EXIT_CODES.policyViolation,
    ],
    [
      [
        'pr-branch',
        'dependabot-bot',
        'dependabot/npm_and_yarn/typescript-6.0.4',
      ],
      EXIT_CODES.policyViolation,
    ],
    [['pr-title', 'build: establish TypeScript workspace'], EXIT_CODES.success],
    [['pr-title', 'Build everything'], EXIT_CODES.policyViolation],
    [[], EXIT_CODES.usage],
  ] as const)('returns a stable exit code for %j', (arguments_, exitCode) => {
    const repositoryRoot = track(createValidTemporaryRepository());

    assertChildExit(runCli(arguments_, repositoryRoot), exitCode);
  });

  it('runs repository checks from a subdirectory', () => {
    const repositoryRoot = track(createValidTemporaryRepository());
    const nestedDirectory = join(repositoryRoot, 'nested');
    mkdirSync(nestedDirectory);

    const result = runCli(['repository'], nestedDirectory);

    assertChildExit(result, EXIT_CODES.success);
    expect(result.stdout).toContain('Repository checks passed.');
  });

  it('uses the internal-error exit code outside a Git repository', () => {
    const temporaryDirectory = track(
      mkdtempSync(join(tmpdir(), 'gitblocks-not-a-repository-')),
    );

    const result = runCli(['repository'], temporaryDirectory);

    assertChildExit(result, EXIT_CODES.internalError);
    expect(result.stderr).toContain('repository.root');
    expect(result.stderr).not.toContain('at ');
  });

  it('does not interpolate repository text into commands', () => {
    const repositoryRoot = track(createValidTemporaryRepository());
    const markerPath = join(repositoryRoot, 'cli-command-executed');
    writeRepositoryFile(
      repositoryRoot,
      'README.md',
      `# GitBlocks\n\n\`\`\`sh\n$(touch ${markerPath})\n\`\`\`\n`,
    );
    stageRepository(repositoryRoot);

    const result = runCli(['repository'], repositoryRoot);

    assertChildExit(result, EXIT_CODES.success);
    expect(result.stderr).not.toContain(markerPath);
    expect(existsSync(markerPath)).toBe(false);
  });

  it('includes bounded child diagnostics when an expected exit status differs', () => {
    const result = spawnSync(process.execPath, [FAILING_CHILD_PATH], {
      encoding: 'utf8',
    });
    let diagnosticMessage = '';
    try {
      assertChildExit(result, EXIT_CODES.success);
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(Error);
      if (error instanceof Error) {
        diagnosticMessage = error.message;
      }
    }

    expect(diagnosticMessage).toMatch(
      /status: 7[\s\S]*signal: none[\s\S]*fixture stdout:[\s\S]*fixture stderr:/,
    );
    expect(diagnosticMessage).toContain(process.execPath);
    expect(diagnosticMessage).toContain(process.versions.node);
    expect(diagnosticMessage).toContain('…[truncated]');
    expect(diagnosticMessage.length).toBeLessThan(5_000);
  });
});
