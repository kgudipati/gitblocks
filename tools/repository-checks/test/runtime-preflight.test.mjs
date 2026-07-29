import { spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  PREFLIGHT_EXIT_CODES,
  RUNTIME_CAPABILITY_SOURCE,
  evaluateNodeVersion,
  evaluateRuntime,
  runRuntimePreflight,
} from '../../runtime-preflight.mjs';

const PREFLIGHT_PATH = fileURLToPath(
  new URL('../../runtime-preflight.mjs', import.meta.url),
);
const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const SECRET_SENTINEL = 'must-not-appear-in-preflight-diagnostics';
const temporaryDirectories = [];

afterEach(() => {
  for (const temporaryDirectory of temporaryDirectories.splice(0)) {
    rmSync(temporaryDirectory, { force: true, recursive: true });
  }
});

function createRepository({
  capabilitySource = RUNTIME_CAPABILITY_SOURCE,
  includeNodeVersion = true,
  includeNvmVersion = true,
  nodeVersion = '24.18.0',
  nvmVersion = nodeVersion,
} = {}) {
  const repositoryRoot = mkdtempSync(
    join(tmpdir(), 'gitblocks-runtime-preflight-'),
  );
  temporaryDirectories.push(repositoryRoot);

  if (includeNodeVersion) {
    writeRepositoryFile(repositoryRoot, '.node-version', `${nodeVersion}\n`);
  }
  if (includeNvmVersion) {
    writeRepositoryFile(repositoryRoot, '.nvmrc', `${nvmVersion}\n`);
  }
  writeRepositoryFile(
    repositoryRoot,
    'tools/repository-checks/test/fixtures/runtime-capability.ts',
    capabilitySource,
  );
  return repositoryRoot;
}

function writeRepositoryFile(repositoryRoot, relativePath, content) {
  const absolutePath = join(repositoryRoot, relativePath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, content, 'utf8');
}

function runPreflightWithNodeOptions(nodeOptions) {
  return spawnSync(process.execPath, [PREFLIGHT_PATH], {
    cwd: REPOSITORY_ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      GITBLOCKS_RUNTIME_PREFLIGHT_SECRET: SECRET_SENTINEL,
      NODE_OPTIONS: nodeOptions,
    },
    maxBuffer: 8 * 1024,
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 5_000,
  });
}

describe('runtime version policy', () => {
  it.each([
    ['22.14.0', false],
    ['24.11.9', false],
    ['24.12.0', true],
    ['24.18.0', true],
    ['25.0.0', false],
  ])('evaluates Node %s as supported=%s', (version, supported) => {
    expect(evaluateNodeVersion(version)).toBe(supported);
  });

  it.each([
    '',
    '24',
    '24.18',
    'v24.18.0',
    '24.18.0-extra',
    '24.18.0.1',
    'x'.repeat(1_000),
  ])('fails malformed version input safely: %s', (version) => {
    expect(evaluateNodeVersion(version)).toBe(false);
  });
});

describe('runtime preflight policy', () => {
  it('rejects mismatched .node-version and .nvmrc pins', () => {
    const result = evaluateRuntime({
      actualNodeVersion: '24.18.0',
      repositoryRoot: createRepository({ nvmVersion: '24.17.1' }),
    });

    expect(result).toEqual(
      expect.objectContaining({
        message: expect.stringContaining('.nvmrc'),
        ok: false,
      }),
    );
  });

  it('rejects an agreed repository pin outside the supported range', () => {
    const result = evaluateRuntime({
      actualNodeVersion: '24.18.0',
      repositoryRoot: createRepository({ nodeVersion: '22.14.0' }),
    });

    expect(result).toEqual(
      expect.objectContaining({
        message: expect.stringContaining(
          'Repository pin 22.14.0 is outside the supported range',
        ),
        ok: false,
      }),
    );
  });

  it.each([
    ['.node-version', false, true],
    ['.nvmrc', true, false],
  ])(
    'reports an actionable missing %s diagnostic',
    (missingFile, includeNodeVersion, includeNvmVersion) => {
      const result = evaluateRuntime({
        actualNodeVersion: '24.18.0',
        repositoryRoot: createRepository({
          includeNodeVersion,
          includeNvmVersion,
        }),
      });

      expect(result).toEqual(
        expect.objectContaining({
          message: expect.stringContaining(missingFile),
          ok: false,
        }),
      );
      expect(result.message).toContain('nvm install && nvm use');
    },
  );

  it('passes direct TypeScript capability validation on the supported runtime', () => {
    const result = evaluateRuntime({
      actualNodeVersion: process.versions.node,
      repositoryRoot: createRepository(),
    });

    expect(result).toEqual({ ok: true, repositoryPin: '24.18.0' });
  });

  it('fails when a supported runtime cannot execute the TypeScript fixture', () => {
    const result = evaluateRuntime({
      actualNodeVersion: '24.18.0',
      executeCapability: () => false,
      repositoryRoot: createRepository(),
    });

    expect(result).toEqual(
      expect.objectContaining({
        message: expect.stringContaining('direct TypeScript'),
        ok: false,
      }),
    );
  });

  it('rejects a changed capability fixture instead of executing it', () => {
    const executeCapability = vi.fn(() => true);
    const result = evaluateRuntime({
      actualNodeVersion: '24.18.0',
      executeCapability,
      repositoryRoot: createRepository({
        capabilitySource: 'process.exitCode = 0;\n',
      }),
    });

    expect(result.ok).toBe(false);
    expect(executeCapability).not.toHaveBeenCalled();
  });

  it('rejects unsupported Node before TypeScript capability execution', () => {
    const executeCapability = vi.fn(() => true);
    const result = evaluateRuntime({
      actualNodeVersion: '22.14.0',
      executeCapability,
      repositoryRoot: createRepository(),
    });

    expect(result).toEqual(
      expect.objectContaining({
        message: expect.stringContaining('Node 22.14.0'),
        ok: false,
      }),
    );
    expect(executeCapability).not.toHaveBeenCalled();
  });

  it('returns stable exit codes and stays quiet on success by default', () => {
    const stdout = [];
    const stderr = [];

    expect(
      runRuntimePreflight({
        actualNodeVersion: '24.18.0',
        executeCapability: () => true,
        repositoryRoot: createRepository(),
        writeError: (message) => stderr.push(message),
        writeOutput: (message) => stdout.push(message),
      }),
    ).toBe(PREFLIGHT_EXIT_CODES.success);
    expect(stdout).toEqual([]);
    expect(stderr).toEqual([]);
  });

  it('supports a documented success message flag', () => {
    const stdout = [];

    expect(
      runRuntimePreflight({
        actualNodeVersion: '24.18.0',
        executeCapability: () => true,
        repositoryRoot: createRepository(),
        showSuccess: true,
        writeError: () => {
          throw new Error('unexpected error output');
        },
        writeOutput: (message) => stdout.push(message),
      }),
    ).toBe(PREFLIGHT_EXIT_CODES.success);
    expect(stdout).toEqual([
      'GitBlocks runtime preflight passed with Node 24.18.0.',
    ]);
  });

  it('bounds one actionable failure without attempting installation', () => {
    const stderr = [];
    const executeCapability = vi.fn(() => true);

    expect(
      runRuntimePreflight({
        actualNodeVersion: `22.${'9'.repeat(2_000)}.0`,
        executeCapability,
        repositoryRoot: createRepository(),
        writeError: (message) => stderr.push(message),
        writeOutput: () => {
          throw new Error('unexpected success output');
        },
      }),
    ).toBe(PREFLIGHT_EXIT_CODES.failure);
    expect(stderr).toHaveLength(1);
    expect(stderr[0]).toContain('supported >=24.12.0 <25');
    expect(stderr[0]).toContain('repository pin 24.18.0');
    expect(stderr[0]).toContain('nvm install && nvm use');
    expect(stderr[0].length).toBeLessThanOrEqual(512);
    expect(executeCapability).not.toHaveBeenCalled();
  });
});

describe('runtime preflight effective environment', () => {
  it('passes when the inherited Node options preserve TypeScript execution', () => {
    const result = runPreflightWithNodeOptions('--no-warnings');

    expect(result.error).toBeUndefined();
    expect(result.signal).toBeNull();
    expect(result.status).toBe(PREFLIGHT_EXIT_CODES.success);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe('');
  });

  it('fails inside the preflight when inherited options disable TypeScript stripping', () => {
    const result = runPreflightWithNodeOptions('--no-strip-types');

    expect(result.error).toBeUndefined();
    expect(result.signal).toBeNull();
    expect(result.status).toBe(PREFLIGHT_EXIT_CODES.failure);
    expect(result.status).not.toBe(PREFLIGHT_EXIT_CODES.usage);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain(
      'The active runtime cannot execute the repository-owned direct TypeScript capability fixture.',
    );
    expect(result.stderr).not.toContain('ERR_UNKNOWN_FILE_EXTENSION');
    expect(result.stderr).not.toContain('--no-strip-types');
    expect(result.stderr).not.toContain(SECRET_SENTINEL);
    expect(result.stderr.trim().split(/\r?\n/u)).toHaveLength(1);
    expect(result.stderr.length).toBeLessThanOrEqual(513);
  });
});

describe('root command graph', () => {
  it('protects direct TypeScript commands and preflights aggregate verification once', () => {
    const packageManifest = JSON.parse(
      readFileSync(new URL('../../../package.json', import.meta.url), 'utf8'),
    );
    const scripts = packageManifest.scripts;

    expect(scripts['runtime:check']).toBe('node tools/runtime-preflight.mjs');
    for (const scriptName of [
      'db:check',
      'db:migrate',
      'db:test',
      'db:verify',
      'test',
      'test:coverage',
      'repo:check',
      'repo:branch',
      'repo:pr-branch',
      'repo:pr-title',
      'verify',
    ]) {
      expect(scripts[scriptName]).toMatch(/^pnpm runtime:check && /);
    }
    expect(scripts['verify:core']).not.toContain('runtime:check');
    expect(scripts['verify:ci']).toBe(
      'pnpm verify && pnpm db:verify && pnpm security:audit',
    );
  });
});
