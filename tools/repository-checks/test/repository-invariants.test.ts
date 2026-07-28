import { describe, expect, it } from 'vitest';

import { validateRepositoryInvariants } from '../src/repository-invariants.ts';

const REQUIRED_PATHS = [
  '.editorconfig',
  '.gitattributes',
  '.gitignore',
  '.node-version',
  '.prettierignore',
  '.prettierrc.json',
  '.secretlintignore',
  '.secretlintrc.json',
  '.github/dependabot.yml',
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
  'docs/plans/0003-typescript-toolchain.md',
  'docs/product/product-contract.md',
  'eslint.config.mjs',
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'tools/repository-checks/package.json',
  'tools/repository-checks/src/cli.ts',
  'tools/repository-checks/src/index.ts',
  'tools/repository-checks/test/tsconfig.json',
  'tools/repository-checks/tsconfig.json',
  'tools/repository-checks/tsconfig.test.json',
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

function validRepository() {
  const trackedPaths = new Set<string>(REQUIRED_PATHS);
  const textFiles = new Map<string, string>([
    ['README.md', '# GitBlocks\n\nUse `gitblocks` as the repository slug.\n'],
    ['package.json', ROOT_MANIFEST],
    ['tools/repository-checks/package.json', TOOL_MANIFEST],
    ['pnpm-workspace.yaml', WORKSPACE_POLICY],
  ]);
  return { textFiles, trackedPaths };
}

describe('validateRepositoryInvariants', () => {
  it('accepts the explicit Phase 1 repository shape', () => {
    expect(validateRepositoryInvariants(validRepository())).toEqual([]);
  });

  it('reports a missing required foundation file', () => {
    const repository = validRepository();
    repository.trackedPaths.delete('AGENTS.md');

    expect(
      validateRepositoryInvariants(repository).map(
        (diagnostic) => diagnostic.code,
      ),
    ).toContain('repository.required-file');
  });

  it.each([
    'apps/api/package.json',
    'packages/domain/package.json',
    'tools/unapproved/package.json',
    'src/server.ts',
    '__nonexistent__',
  ])('rejects prohibited Phase 1 artifact %s', (artifact) => {
    const repository = validRepository();
    repository.trackedPaths.add(artifact);

    expect(
      validateRepositoryInvariants(repository).map(
        (diagnostic) => diagnostic.code,
      ),
    ).toContain('repository.prohibited-artifact');
  });

  it('requires exact dependency versions', () => {
    const repository = validRepository();
    repository.textFiles.set(
      'package.json',
      ROOT_MANIFEST.replace('"6.0.3"', '"^6.0.3"'),
    );

    expect(
      validateRepositoryInvariants(repository).map(
        (diagnostic) => diagnostic.code,
      ),
    ).toContain('repository.dependency-version');
  });

  it('requires private package manifests', () => {
    const repository = validRepository();
    repository.textFiles.set(
      'tools/repository-checks/package.json',
      TOOL_MANIFEST.replace('"private":true', '"private":false'),
    );

    expect(
      validateRepositoryInvariants(repository).map(
        (diagnostic) => diagnostic.code,
      ),
    ).toContain('repository.package-private');
  });

  it('rejects weakened supply-chain settings', () => {
    const repository = validRepository();
    repository.textFiles.set(
      'pnpm-workspace.yaml',
      WORKSPACE_POLICY.replace(
        'dangerouslyAllowAllBuilds: false',
        'dangerouslyAllowAllBuilds: true',
      ),
    );

    expect(
      validateRepositoryInvariants(repository).map(
        (diagnostic) => diagnostic.code,
      ),
    ).toContain('repository.supply-chain-policy');
  });

  it('enforces GitBlocks capitalization in prose but permits code slugs', () => {
    const repository = validRepository();
    repository.textFiles.set(
      'README.md',
      '# Gitblocks\n\nUse `gitblocks` as the repository slug.\n',
    );

    expect(
      validateRepositoryInvariants(repository).map(
        (diagnostic) => diagnostic.code,
      ),
    ).toContain('repository.product-capitalization');
  });
});
