import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';

const REQUIRED_PATHS = [
  '.editorconfig',
  '.gitattributes',
  '.gitignore',
  '.node-version',
  '.nvmrc',
  '.prettierignore',
  '.prettierrc.json',
  '.secretlintignore',
  '.secretlintrc.json',
  '.github/ISSUE_TEMPLATE/bug.yml',
  '.github/ISSUE_TEMPLATE/config.yml',
  '.github/ISSUE_TEMPLATE/phase.yml',
  '.github/dependabot.yml',
  '.github/pull_request_template.md',
  '.github/workflows/ci.yml',
  'AGENTS.md',
  'CONTRIBUTING.md',
  'PLANS.md',
  'README.md',
  'SECURITY.md',
  'dependency-cruiser.config.mjs',
  'docs/architecture/decisions/0001-agent-native-delivery.md',
  'docs/architecture/decisions/0002-typescript-workspace-and-toolchain.md',
  'docs/architecture/system-context.md',
  'docs/engineering/definition-of-done.md',
  'docs/engineering/development-standards.md',
  'docs/engineering/observability-and-reliability.md',
  'docs/engineering/repository-workflow.md',
  'docs/engineering/security-baseline.md',
  'docs/engineering/testing-strategy.md',
  'docs/plans/0001-foundation.md',
  'docs/plans/0003-typescript-toolchain.md',
  'docs/plans/0005-node-runtime-preflight.md',
  'docs/product/product-contract.md',
  'eslint.config.mjs',
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'tools/repository-checks/package.json',
  'tools/repository-checks/src/cli.ts',
  'tools/repository-checks/src/index.ts',
  'tools/repository-checks/test/fixtures/runtime-capability.ts',
  'tools/repository-checks/test/tsconfig.json',
  'tools/repository-checks/tsconfig.json',
  'tools/repository-checks/tsconfig.test.json',
  'tools/runtime-preflight.mjs',
  'tsconfig.base.json',
  'tsconfig.json',
  'vitest.config.ts',
] as const;

const ROOT_MANIFEST = JSON.stringify({
  name: 'gitblocks',
  private: true,
  packageManager: `pnpm@11.17.0+sha512.${'a'.repeat(128)}`,
  engines: {
    node: '>=24.12.0 <25',
    pnpm: '11.17.0',
  },
  scripts: {
    'repo:branch':
      'pnpm runtime:check && node tools/repository-checks/src/cli.ts branch',
    'repo:check':
      'pnpm runtime:check && node tools/repository-checks/src/cli.ts repository',
    'repo:pr-branch':
      'pnpm runtime:check && node tools/repository-checks/src/cli.ts pr-branch',
    'repo:pr-title':
      'pnpm runtime:check && node tools/repository-checks/src/cli.ts pr-title',
    'runtime:check': 'node tools/runtime-preflight.mjs',
    test: 'pnpm runtime:check && vitest run',
    'test:coverage': 'pnpm runtime:check && vitest run --coverage',
    verify: 'pnpm runtime:check && pnpm verify:core',
    'verify:ci': 'pnpm verify && pnpm security:audit',
    'verify:core': 'vitest run',
  },
  devDependencies: {
    typescript: '6.0.3',
  },
});

const TOOL_MANIFEST = JSON.stringify({
  name: '@gitblocks/repository-checks',
  private: true,
  dependencies: {
    yaml: '2.9.0',
  },
});

const WORKSPACE_POLICY = `packages:
  - apps/*
  - packages/*
  - tools/*
frozenLockfile: true
autoInstallPeers: false
resolvePeersFromWorkspaceRoot: false
strictPeerDependencies: true
engineStrict: true
nodeVersion: 24.12.0
strictDepBuilds: true
allowBuilds: {}
dangerouslyAllowAllBuilds: false
blockExoticSubdeps: true
minimumReleaseAge: 1440
minimumReleaseAgeStrict: true
minimumReleaseAgeIgnoreMissingTime: false
trustPolicy: no-downgrade
trustLockfile: false
`;

export function createValidTemporaryRepository(): string {
  const repositoryRoot = mkdtempSync(
    join(tmpdir(), 'gitblocks-repository-checks-'),
  );

  for (const relativePath of REQUIRED_PATHS) {
    writeRepositoryFile(
      repositoryRoot,
      relativePath,
      defaultContent(relativePath),
    );
  }
  initializeGit(repositoryRoot);
  return repositoryRoot;
}

export function createMinimalTemporaryRepository(): string {
  const repositoryRoot = mkdtempSync(
    join(tmpdir(), 'gitblocks-repository-checks-'),
  );
  writeRepositoryFile(repositoryRoot, 'README.md', '# GitBlocks\n');
  initializeGit(repositoryRoot);
  return repositoryRoot;
}

export function writeRepositoryFile(
  repositoryRoot: string,
  relativePath: string,
  content: string,
): void {
  const absolutePath = join(repositoryRoot, relativePath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, content, 'utf8');
}

export function stageRepository(repositoryRoot: string): void {
  execFileSync('git', ['-C', repositoryRoot, 'add', '--all'], {
    env: gitEnvironment(),
    stdio: 'pipe',
  });
}

export function removeTemporaryRepository(repositoryRoot: string): void {
  rmSync(repositoryRoot, { force: true, recursive: true });
}

function initializeGit(repositoryRoot: string): void {
  execFileSync('git', ['init', '--quiet', repositoryRoot], {
    env: gitEnvironment(),
    stdio: 'pipe',
  });
  stageRepository(repositoryRoot);
}

function gitEnvironment(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_NOSYSTEM: '1',
  };
}

function defaultContent(relativePath: string): string {
  if (relativePath === 'README.md') {
    return '# GitBlocks\n';
  }
  if (relativePath === 'package.json') {
    return ROOT_MANIFEST;
  }
  if (relativePath === 'tools/repository-checks/package.json') {
    return TOOL_MANIFEST;
  }
  if (relativePath === 'pnpm-workspace.yaml') {
    return WORKSPACE_POLICY;
  }
  if (relativePath === '.node-version' || relativePath === '.nvmrc') {
    return '24.18.0\n';
  }
  if (relativePath === '.github/dependabot.yml') {
    return `version: 2
updates:
  - package-ecosystem: npm
    directory: /
    rebase-strategy: disabled
    schedule:
      interval: weekly
  - package-ecosystem: github-actions
    directory: /
    rebase-strategy: disabled
    schedule:
      interval: weekly
`;
  }
  if (relativePath === '.github/workflows/ci.yml') {
    return `name: CI
on:
  - pull_request
permissions:
  contents: read
jobs:
  verification:
    runs-on: ubuntu-24.04
    steps: []
`;
  }
  if (relativePath.endsWith('.md')) {
    return '# GitBlocks\n';
  }
  return '';
}
