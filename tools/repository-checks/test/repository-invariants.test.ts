import { describe, expect, it } from 'vitest';

import { validateRepositoryInvariants } from '../src/repository-invariants.ts';

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
  'docs/evaluation/baseline-protocol.md',
  'docs/evaluation/case-authoring-protocol.md',
  'docs/evaluation/scoring.md',
  'docs/plans/0001-foundation.md',
  'docs/plans/0003-typescript-toolchain.md',
  'docs/plans/0005-node-runtime-preflight.md',
  'docs/product/product-contract.md',
  'evals/pilot-v1/manifest.json',
  'eslint.config.mjs',
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'schemas/evaluation/case.schema.json',
  'schemas/evaluation/evidence.schema.json',
  'schemas/evaluation/gold.schema.json',
  'schemas/evaluation/manifest.schema.json',
  'schemas/evaluation/prediction.schema.json',
  'schemas/evaluation/score.schema.json',
  'tools/evaluation-harness/package.json',
  'tools/evaluation-harness/src/cli.ts',
  'tools/evaluation-harness/src/index.ts',
  'tools/evaluation-harness/test/tsconfig.json',
  'tools/evaluation-harness/tsconfig.json',
  'tools/evaluation-harness/tsconfig.test.json',
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
    'eval:fixtures':
      'pnpm runtime:check && node tools/evaluation-harness/src/cli.ts fixtures',
    'eval:score':
      'pnpm runtime:check && node tools/evaluation-harness/src/cli.ts score',
    'eval:validate':
      'pnpm runtime:check && node tools/evaluation-harness/src/cli.ts validate',
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

const EVALUATION_MANIFEST = JSON.stringify({
  name: '@gitblocks/evaluation-harness',
  private: true,
  dependencies: {
    ajv: '8.20.0',
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

function dependabotPolicy(
  npmRebaseStrategy = true,
  actionsRebaseStrategy = true,
): string {
  return `version: 2
updates:
  - package-ecosystem: npm
    directory: /
${npmRebaseStrategy ? '    rebase-strategy: disabled\n' : ''}    schedule:
      interval: weekly
  - package-ecosystem: github-actions
    directory: /
${actionsRebaseStrategy ? '    rebase-strategy: disabled\n' : ''}    schedule:
      interval: weekly
`;
}

function validRepository() {
  const trackedPaths = new Set<string>(REQUIRED_PATHS);
  const textFiles = new Map<string, string>([
    ['README.md', '# GitBlocks\n\nUse `gitblocks` as the repository slug.\n'],
    ['.github/dependabot.yml', dependabotPolicy()],
    ['.node-version', '24.18.0\n'],
    ['.nvmrc', '24.18.0\n'],
    ['package.json', ROOT_MANIFEST],
    ['tools/evaluation-harness/package.json', EVALUATION_MANIFEST],
    ['tools/repository-checks/package.json', TOOL_MANIFEST],
    ['pnpm-workspace.yaml', WORKSPACE_POLICY],
  ]);
  return { textFiles, trackedPaths };
}

describe('validateRepositoryInvariants', () => {
  it('accepts the explicit Phase 1 repository shape', () => {
    expect(validateRepositoryInvariants(validRepository())).toEqual([]);
  });

  it.each([
    ['contributor or agent entry point', 'AGENTS.md'],
    ['issue or pull request template', '.github/ISSUE_TEMPLATE/bug.yml'],
    ['historical execution plan', 'docs/plans/0001-foundation.md'],
    ['engineering policy', 'docs/engineering/security-baseline.md'],
    [
      'architecture decision',
      'docs/architecture/decisions/0001-agent-native-delivery.md',
    ],
    ['active toolchain configuration', 'eslint.config.mjs'],
  ])('reports a missing %s', (_category, requiredPath) => {
    const repository = validRepository();
    repository.trackedPaths.delete(requiredPath);

    expect(validateRepositoryInvariants(repository)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'repository.required-file',
          path: requiredPath,
        }),
      ]),
    );
  });

  it.each(['.nvmrc', 'tools/runtime-preflight.mjs'])(
    'reports a missing runtime foundation file %s',
    (requiredPath) => {
      const repository = validRepository();
      repository.trackedPaths.delete(requiredPath);

      expect(validateRepositoryInvariants(repository)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'repository.required-file',
            path: requiredPath,
          }),
        ]),
      );
    },
  );

  it.each([
    'apps/api/package.json',
    'packages/domain/package.json',
    'tools/unapproved/package.json',
    'src/server.ts',
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

  it('requires .node-version and .nvmrc to agree', () => {
    const repository = validRepository();
    repository.textFiles.set('.nvmrc', '24.17.1\n');

    expect(validateRepositoryInvariants(repository)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'repository.node-pin-mismatch' }),
      ]),
    );
  });

  it.each(['.node-version', '.nvmrc'])(
    'requires readable content for %s',
    (versionPath) => {
      const repository = validRepository();
      repository.textFiles.delete(versionPath);

      expect(validateRepositoryInvariants(repository)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'repository.required-content',
            path: versionPath,
          }),
        ]),
      );
    },
  );

  it('requires the protected runtime command graph', () => {
    const repository = validRepository();
    repository.textFiles.set(
      'package.json',
      ROOT_MANIFEST.replace('pnpm runtime:check && vitest run', 'vitest run'),
    );

    expect(validateRepositoryInvariants(repository)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'repository.runtime-script' }),
      ]),
    );
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

  it.each([
    ['npm', false, true],
    ['github-actions', true, false],
  ])(
    'requires disabled Dependabot rebasing for %s',
    (_ecosystem, npmEnabled, actionsEnabled) => {
      const repository = validRepository();
      repository.textFiles.set(
        '.github/dependabot.yml',
        dependabotPolicy(npmEnabled, actionsEnabled),
      );

      expect(validateRepositoryInvariants(repository)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'repository.dependabot-rebase',
            path: '.github/dependabot.yml',
          }),
        ]),
      );
    },
  );

  it('rejects YAML aliases in workspace policy', () => {
    const repository = validRepository();
    repository.textFiles.set(
      'pnpm-workspace.yaml',
      `${WORKSPACE_POLICY}\nshared: &shared\n  value: inert\ncopy: *shared\n`,
    );

    expect(validateRepositoryInvariants(repository)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'repository.workspace-yaml-alias' }),
      ]),
    );
  });

  it('rejects excessive YAML nesting in workspace policy', () => {
    const repository = validRepository();
    const nested = Array.from(
      { length: 70 },
      (_, index) => `${'  '.repeat(index)}level${String(index)}:`,
    ).join('\n');
    repository.textFiles.set(
      'pnpm-workspace.yaml',
      `${WORKSPACE_POLICY}\nextra:\n${nested}\n${'  '.repeat(70)}value: true\n`,
    );

    expect(validateRepositoryInvariants(repository)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'repository.workspace-structure-limit',
        }),
      ]),
    );
  });

  it('rejects YAML aliases in Dependabot policy', () => {
    const repository = validRepository();
    repository.textFiles.set(
      '.github/dependabot.yml',
      `${dependabotPolicy()}\nshared: &shared\n  value: inert\ncopy: *shared\n`,
    );

    expect(validateRepositoryInvariants(repository)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'repository.dependabot-yaml-alias' }),
      ]),
    );
  });

  it('rejects excessive YAML nesting in Dependabot policy', () => {
    const repository = validRepository();
    const nested = Array.from(
      { length: 70 },
      (_, index) => `${'  '.repeat(index)}level${String(index)}:`,
    ).join('\n');
    repository.textFiles.set(
      '.github/dependabot.yml',
      `${dependabotPolicy()}\nextra:\n${nested}\n${'  '.repeat(70)}value: true\n`,
    );

    expect(validateRepositoryInvariants(repository)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'repository.dependabot-structure-limit',
        }),
      ]),
    );
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
