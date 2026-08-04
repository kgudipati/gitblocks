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
  'apps/repository-interview-operator/README.md',
  'apps/repository-interview-operator/package.json',
  'apps/repository-interview-operator/schemas/repository-interview-operator-policy-v1.schema.json',
  'apps/repository-interview-operator/schemas/repository-interview-operator-receipt-v1.schema.json',
  'apps/repository-interview-operator/schemas/repository-interview-operator-selection-v1.schema.json',
  'apps/repository-interview-operator/scripts/operator-cli.ts',
  'apps/repository-interview-operator/scripts/schema-cli.ts',
  'apps/repository-interview-operator/scripts/tsconfig.json',
  'apps/repository-interview-operator/src/index.ts',
  'apps/repository-interview-operator/test/tsconfig.json',
  'apps/repository-interview-operator/tsconfig.json',
  'apps/repository-interview-operator/tsconfig.test.json',
  'catalog/public-v1/candidates.json',
  'catalog/public-v1/manifest.json',
  'catalog/capability-taxonomy/1.0.0/README.md',
  'catalog/capability-taxonomy/1.0.0/manifest.json',
  'catalog/capability-taxonomy/1.0.0/source.json',
  'CONTRIBUTING.md',
  'PLANS.md',
  'README.md',
  'SECURITY.md',
  'dependency-cruiser.config.mjs',
  'docs/architecture/decisions/0001-agent-native-delivery.md',
  'docs/architecture/decisions/0002-typescript-workspace-and-toolchain.md',
  'docs/architecture/decisions/0003-product-contract-kernel.md',
  'docs/architecture/decisions/0004-postgresql-evidence-persistence.md',
  'docs/architecture/decisions/0005-public-repository-ingestion.md',
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
  'docs/plans/0009-product-contract-kernel.md',
  'docs/plans/0011-evidence-persistence.md',
  'docs/plans/0013-public-repository-ingestion.md',
  'docs/product/product-contract.md',
  'evals/pilot-v1/manifest.json',
  'eslint.config.mjs',
  'package.json',
  'packages/contracts/README.md',
  'packages/contracts/package.json',
  'packages/contracts/scripts/taxonomy-cli.ts',
  'packages/contracts/scripts/taxonomy-command.ts',
  'packages/contracts/scripts/tsconfig.json',
  'packages/contracts/src/index.ts',
  'packages/domain/README.md',
  'packages/domain/package.json',
  'packages/domain/src/index.ts',
  'packages/ingestion/README.md',
  'packages/ingestion/package.json',
  'packages/ingestion/scripts/catalog-cli.ts',
  'packages/ingestion/scripts/catalog-seed-cli.ts',
  'packages/ingestion/scripts/catalog-seed-command.ts',
  'packages/ingestion/scripts/live-cli.ts',
  'packages/ingestion/scripts/receipt-cli.ts',
  'packages/ingestion/scripts/tsconfig.json',
  'packages/ingestion/src/catalog-persistence.ts',
  'packages/ingestion/src/catalog-seed.ts',
  'packages/ingestion/src/index.ts',
  'packages/ingestion/test/tsconfig.json',
  'packages/ingestion/tsconfig.json',
  'packages/ingestion/tsconfig.test.json',
  'packages/interviews/README.md',
  'packages/interviews/package.json',
  'packages/interviews/scripts/specification-cli.ts',
  'packages/interviews/scripts/tsconfig.json',
  'packages/interviews/src/index.ts',
  'packages/interviews/test/tsconfig.json',
  'packages/interviews/tsconfig.json',
  'packages/interviews/tsconfig.test.json',
  'packages/persistence/README.md',
  'packages/persistence/migrations/0001_evidence_persistence.sql',
  'packages/persistence/migrations/0002_runtime_migration_verification.sql',
  'packages/persistence/package.json',
  'packages/persistence/scripts/database-support.ts',
  'packages/persistence/scripts/db-cli.ts',
  'packages/persistence/scripts/db-verify.ts',
  'packages/persistence/scripts/tsconfig.json',
  'packages/persistence/src/index.ts',
  'packages/persistence/test/integration/persistence.integration.ts',
  'packages/persistence/test/tsconfig.json',
  'packages/persistence/tsconfig.json',
  'packages/persistence/tsconfig.test.json',
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
  'tools/evaluation-harness/src/contract-conformance-cli.ts',
  'tools/evaluation-harness/src/index.ts',
  'tools/evaluation-harness/test/persistence-conformance.persistence-integration.ts',
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
  'vitest.db.config.ts',
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
    build: 'pnpm build:product && pnpm build:tools',
    'build:product':
      'pnpm --filter @gitblocks/ingestion... --filter @gitblocks/interviews... --filter @gitblocks/repository-interview-operator... build',
    'build:tools':
      'pnpm --filter @gitblocks/repository-checks --filter @gitblocks/evaluation-harness --filter @gitblocks/repository-interview-prelive build',
    'contracts:validate':
      'pnpm runtime:check && pnpm build:product && node tools/evaluation-harness/src/contract-conformance-cli.ts',
    'taxonomy:generate':
      'pnpm runtime:check && pnpm build:product && node packages/contracts/scripts/taxonomy-cli.ts --write',
    'taxonomy:validate':
      'pnpm runtime:check && pnpm build:product && node packages/contracts/scripts/taxonomy-cli.ts',
    'catalog:validate':
      'pnpm runtime:check && pnpm build:product && node packages/ingestion/scripts/catalog-cli.ts',
    'catalog:seed':
      'pnpm runtime:check && pnpm build:product && node packages/ingestion/scripts/catalog-seed-cli.ts',
    'db:check':
      'pnpm runtime:check && pnpm build:product && node packages/persistence/scripts/db-cli.ts check',
    'db:migrate':
      'pnpm runtime:check && pnpm build:product && node packages/persistence/scripts/db-cli.ts migrate',
    'db:test':
      'pnpm runtime:check && pnpm build && vitest run --config vitest.db.config.ts',
    'db:verify':
      'pnpm runtime:check && pnpm build && node packages/persistence/scripts/db-verify.ts',
    'eval:fixtures':
      'pnpm runtime:check && node tools/evaluation-harness/src/cli.ts fixtures',
    'eval:interviews:fixtures':
      'pnpm runtime:check && node tools/evaluation-harness/src/repository-interview-evaluation-cli.ts fixtures',
    'eval:interviews:generate':
      'pnpm runtime:check && node tools/evaluation-harness/src/repository-interview-evaluation-cli.ts generate',
    'eval:interviews:validate':
      'pnpm runtime:check && node tools/evaluation-harness/src/repository-interview-evaluation-cli.ts validate',
    'eval:interviews:verify':
      'pnpm runtime:check && node tools/evaluation-harness/src/repository-interview-evaluation-cli.ts validate && node tools/evaluation-harness/src/repository-interview-evaluation-cli.ts fixtures && vitest run tools/evaluation-harness/test/repository-interview-*.test.ts --config vitest.config.ts && pnpm --filter @gitblocks/evaluation-harness typecheck && pnpm architecture:check',
    'eval:score':
      'pnpm runtime:check && node tools/evaluation-harness/src/cli.ts score',
    'eval:validate':
      'pnpm runtime:check && node tools/evaluation-harness/src/cli.ts validate',
    'ingest:live':
      'pnpm runtime:check && pnpm build:product && node packages/ingestion/scripts/live-cli.ts',
    'ingest:receipt':
      'pnpm runtime:check && pnpm build:product && node packages/ingestion/scripts/receipt-cli.ts',
    'ingestion:test':
      'pnpm runtime:check && pnpm build:product && vitest run packages/ingestion/test --config vitest.config.ts',
    'ingestion:verify':
      'pnpm runtime:check && pnpm catalog:validate && pnpm ingestion:test && pnpm --filter @gitblocks/ingestion typecheck',
    'interviews:generate':
      'pnpm runtime:check && pnpm build:product && node packages/interviews/scripts/specification-cli.ts generate',
    'interviews:test':
      'pnpm runtime:check && pnpm build:product && vitest run packages/interviews/test --config vitest.config.ts',
    'interviews:validate':
      'pnpm runtime:check && pnpm build:product && node packages/interviews/scripts/specification-cli.ts validate',
    'interviews:verify':
      'pnpm runtime:check && pnpm interviews:validate && pnpm interviews:test && pnpm --filter @gitblocks/interviews typecheck && pnpm architecture:check',
    'interviews:prelive:materialize':
      'pnpm runtime:check && pnpm build:product && pnpm --filter @gitblocks/repository-interview-prelive build && node tools/repository-interview-prelive/src/materialize-cli.ts',
    'interviews:prelive:test':
      'pnpm runtime:check && pnpm build:product && pnpm build:tools && vitest run tools/repository-interview-prelive/test apps/repository-interview-operator/test/prelive-authorities.test.ts apps/repository-interview-operator/test/process-boundary.test.ts --config vitest.config.ts',
    'interviews:prelive:validate':
      'pnpm runtime:check && pnpm build:product && pnpm build:tools && node tools/repository-interview-prelive/src/prelive-cli.ts validate',
    'interviews:prelive:verify':
      'pnpm runtime:check && pnpm interviews:prelive:validate && pnpm interviews:prelive:test && pnpm operator:interviews:verify && pnpm interviews:verify && pnpm eval:interviews:verify',
    'operator:interviews':
      'pnpm runtime:check && pnpm build:product && pnpm --filter @gitblocks/repository-interview-prelive build && node tools/repository-interview-prelive/src/operator-cli.ts',
    'operator:interviews:schema:validate':
      'pnpm runtime:check && pnpm build:product && node apps/repository-interview-operator/scripts/schema-cli.ts validate',
    'operator:interviews:test':
      'pnpm runtime:check && pnpm build:product && vitest run apps/repository-interview-operator/test --config vitest.config.ts',
    'operator:interviews:verify':
      'pnpm runtime:check && pnpm operator:interviews:schema:validate && pnpm operator:interviews:test && pnpm --filter @gitblocks/repository-interview-operator lint && pnpm --filter @gitblocks/repository-interview-operator typecheck && pnpm architecture:check && pnpm db:verify',
    'repo:branch':
      'pnpm runtime:check && node tools/repository-checks/src/cli.ts branch',
    'repo:check':
      'pnpm runtime:check && node tools/repository-checks/src/cli.ts repository',
    'repo:pr-branch':
      'pnpm runtime:check && node tools/repository-checks/src/cli.ts pr-branch',
    'repo:pr-title':
      'pnpm runtime:check && node tools/repository-checks/src/cli.ts pr-title',
    'runtime:check': 'node tools/runtime-preflight.mjs',
    lint: 'pnpm build:product && pnpm lint:internal',
    'lint:internal': 'eslint . --max-warnings 0',
    test: 'pnpm runtime:check && vitest run',
    'test:coverage': 'pnpm runtime:check && vitest run --coverage',
    typecheck:
      'pnpm build:product && pnpm build:tools && pnpm typecheck:internal',
    'typecheck:internal':
      'pnpm --filter @gitblocks/domain --filter @gitblocks/contracts --filter @gitblocks/persistence --filter @gitblocks/ingestion --filter @gitblocks/interviews --filter @gitblocks/repository-interview-operator --filter @gitblocks/repository-checks --filter @gitblocks/evaluation-harness --filter @gitblocks/repository-interview-prelive typecheck',
    verify: 'pnpm runtime:check && pnpm verify:core',
    'verify:ci': 'pnpm verify && pnpm db:verify && pnpm security:audit',
    'verify:core':
      'pnpm format:check && pnpm build:product && pnpm lint:internal && pnpm build:tools && pnpm typecheck:internal && vitest run && node packages/contracts/scripts/taxonomy-cli.ts',
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
    '@gitblocks/contracts': 'workspace:0.0.0',
    '@gitblocks/persistence': 'workspace:0.0.0',
    ajv: '8.20.0',
  },
});

const PRELIVE_MANIFEST = JSON.stringify({
  name: '@gitblocks/repository-interview-prelive',
  version: '0.0.0',
  private: true,
  type: 'module',
  dependencies: {
    '@gitblocks/contracts': 'workspace:0.0.0',
    '@gitblocks/evaluation-harness': 'workspace:0.0.0',
    '@gitblocks/ingestion': 'workspace:0.0.0',
    '@gitblocks/interviews': 'workspace:0.0.0',
    '@gitblocks/persistence': 'workspace:0.0.0',
    '@gitblocks/repository-interview-operator': 'workspace:0.0.0',
  },
  devDependencies: { vitest: '4.1.10' },
});

const DOMAIN_MANIFEST = JSON.stringify({
  name: '@gitblocks/domain',
  version: '0.0.0',
  private: true,
  type: 'module',
  exports: {
    '.': {
      types: './dist/src/index.d.ts',
      import: './dist/src/index.js',
    },
  },
});

const CONTRACTS_MANIFEST = JSON.stringify({
  name: '@gitblocks/contracts',
  version: '0.0.0',
  private: true,
  type: 'module',
  exports: {
    '.': {
      types: './dist/src/index.d.ts',
      import: './dist/src/index.js',
    },
  },
  dependencies: {
    '@gitblocks/domain': 'workspace:0.0.0',
    ajv: '8.20.0',
    typebox: '1.3.8',
  },
});

const PERSISTENCE_MANIFEST = JSON.stringify({
  name: '@gitblocks/persistence',
  version: '0.0.0',
  private: true,
  type: 'module',
  exports: {
    '.': {
      types: './dist/src/index.d.ts',
      import: './dist/src/index.js',
    },
  },
  dependencies: {
    '@gitblocks/contracts': 'workspace:0.0.0',
    postgres: '3.4.9',
  },
});

const INGESTION_MANIFEST = JSON.stringify({
  name: '@gitblocks/ingestion',
  version: '0.0.0',
  private: true,
  type: 'module',
  exports: {
    '.': {
      types: './dist/src/index.d.ts',
      import: './dist/src/index.js',
    },
  },
  dependencies: {
    '@gitblocks/contracts': 'workspace:0.0.0',
    '@gitblocks/persistence': 'workspace:0.0.0',
  },
});

const INTERVIEWS_MANIFEST = JSON.stringify({
  name: '@gitblocks/interviews',
  version: '0.0.0',
  private: true,
  type: 'module',
  exports: {
    '.': {
      types: './dist/src/index.d.ts',
      import: './dist/src/index.js',
    },
  },
  dependencies: {
    '@gitblocks/contracts': 'workspace:0.0.0',
    ajv: '8.20.0',
    typebox: '1.3.8',
  },
});

const OPERATOR_MANIFEST = JSON.stringify({
  name: '@gitblocks/repository-interview-operator',
  version: '0.0.0',
  private: true,
  type: 'module',
  exports: {
    '.': {
      types: './dist/src/index.d.ts',
      import: './dist/src/index.js',
    },
  },
  dependencies: {
    '@gitblocks/contracts': 'workspace:0.0.0',
    '@gitblocks/interviews': 'workspace:0.0.0',
    '@gitblocks/persistence': 'workspace:0.0.0',
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

const CI_POLICY = `jobs:
  verification:
    services:
      postgres:
        image: postgres:18.4-bookworm@sha256:1961f96e6029a02c3812d7cb329a3b03a3ac2bb067058dec17b0f5596aca9296
    env:
      GITBLOCKS_DB_TEST_ACK: ephemeral
      GITBLOCKS_TEST_DB_DATABASE: gitblocks_test
      GITBLOCKS_TEST_DB_OWNER: postgres
    steps:
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm verify:ci
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
    ['.github/workflows/ci.yml', CI_POLICY],
    ['.github/dependabot.yml', dependabotPolicy()],
    ['.node-version', '24.18.0\n'],
    ['.nvmrc', '24.18.0\n'],
    ['package.json', ROOT_MANIFEST],
    ['packages/contracts/package.json', CONTRACTS_MANIFEST],
    ['packages/domain/package.json', DOMAIN_MANIFEST],
    ['packages/ingestion/package.json', INGESTION_MANIFEST],
    ['packages/interviews/package.json', INTERVIEWS_MANIFEST],
    ['apps/repository-interview-operator/package.json', OPERATOR_MANIFEST],
    ['packages/persistence/package.json', PERSISTENCE_MANIFEST],
    ['tools/evaluation-harness/package.json', EVALUATION_MANIFEST],
    ['tools/repository-checks/package.json', TOOL_MANIFEST],
    ['pnpm-workspace.yaml', WORKSPACE_POLICY],
  ]);
  return { textFiles, trackedPaths };
}

describe('validateRepositoryInvariants', () => {
  it('accepts the explicit approved repository shape', () => {
    expect(validateRepositoryInvariants(validRepository())).toEqual([]);
  });

  it('accepts the pre-live tool and only its explicit workspace direction', () => {
    const repository = validRepository();
    repository.trackedPaths.add(
      'tools/repository-interview-prelive/package.json',
    );
    repository.trackedPaths.add(
      'tools/repository-interview-prelive/src/index.ts',
    );
    repository.textFiles.set(
      'tools/repository-interview-prelive/package.json',
      PRELIVE_MANIFEST,
    );
    expect(validateRepositoryInvariants(repository)).toEqual([]);

    repository.textFiles.set(
      'tools/repository-interview-prelive/package.json',
      PRELIVE_MANIFEST.replace(
        '"@gitblocks/contracts":"workspace:0.0.0"',
        '"@gitblocks/domain":"workspace:0.0.0"',
      ),
    );
    expect(validateRepositoryInvariants(repository)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'repository.dependency-version',
          path: 'tools/repository-interview-prelive/package.json',
        }),
      ]),
    );
  });

  it('requires the pinned PostgreSQL service in hosted verification', () => {
    const repository = validRepository();
    repository.textFiles.set(
      '.github/workflows/ci.yml',
      CI_POLICY.replace(
        'postgres:18.4-bookworm@sha256:',
        'postgres:18.4@sha256:',
      ),
    );

    expect(validateRepositoryInvariants(repository)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'repository.ci-postgresql',
          path: '.github/workflows/ci.yml',
        }),
      ]),
    );
  });

  it('requires standalone typecheck directly after frozen installation and before verification', () => {
    for (const invalid of [
      CI_POLICY.replace('      - run: pnpm typecheck\n', ''),
      CI_POLICY.replace(
        '      - run: pnpm typecheck\n      - run: pnpm verify:ci',
        '      - run: pnpm verify:ci\n      - run: pnpm typecheck',
      ),
      CI_POLICY.replace(
        '    steps:\n      - run: pnpm install --frozen-lockfile',
        '    steps:\n      - run: pnpm build\n      - run: pnpm install --frozen-lockfile',
      ),
    ]) {
      const repository = validRepository();
      repository.textFiles.set('.github/workflows/ci.yml', invalid);
      expect(validateRepositoryInvariants(repository)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'repository.ci-clean-typecheck',
            path: '.github/workflows/ci.yml',
          }),
        ]),
      );
    }
  });

  it.each([
    ['contributor or agent entry point', 'AGENTS.md'],
    ['issue or pull request template', '.github/ISSUE_TEMPLATE/bug.yml'],
    ['historical execution plan', 'docs/plans/0001-foundation.md'],
    ['engineering policy', 'docs/engineering/security-baseline.md'],
    [
      'architecture decision',
      'docs/architecture/decisions/0003-product-contract-kernel.md',
    ],
    ['active execution plan', 'docs/plans/0009-product-contract-kernel.md'],
    ['product package manifest', 'packages/domain/package.json'],
    ['product package README', 'packages/contracts/README.md'],
    ['product package entry point', 'packages/contracts/src/index.ts'],
    [
      'contract conformance entry point',
      'tools/evaluation-harness/src/contract-conformance-cli.ts',
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
    'packages/application/package.json',
    'packages/domain-adapter/src/index.ts',
    'tools/unapproved/package.json',
    'src/server.ts',
  ])('rejects prohibited Phase 4 artifact %s', (artifact) => {
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

  it('requires the domain package to have zero runtime dependencies', () => {
    const repository = validRepository();
    repository.textFiles.set(
      'packages/domain/package.json',
      DOMAIN_MANIFEST.replace(
        '"exports":',
        '"dependencies":{"left-pad":"1.3.0"},"exports":',
      ),
    );

    expect(validateRepositoryInvariants(repository)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'repository.product-dependency',
          path: 'packages/domain/package.json',
        }),
      ]),
    );
  });

  it('requires the contracts runtime dependency allowlist exactly', () => {
    const repository = validRepository();
    repository.textFiles.set(
      'packages/contracts/package.json',
      CONTRACTS_MANIFEST.replace('"typebox":"1.3.8"', '"zod":"4.4.3"'),
    );

    expect(validateRepositoryInvariants(repository)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'repository.product-dependency',
          path: 'packages/contracts/package.json',
        }),
      ]),
    );
  });

  it('requires the persistence runtime dependency allowlist exactly', () => {
    const repository = validRepository();
    repository.textFiles.set(
      'packages/persistence/package.json',
      PERSISTENCE_MANIFEST.replace('"postgres":"3.4.9"', '"pg":"8.22.0"'),
    );

    expect(validateRepositoryInvariants(repository)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'repository.product-dependency',
          path: 'packages/persistence/package.json',
        }),
      ]),
    );
  });

  it('requires the interviews runtime dependency allowlist exactly', () => {
    const repository = validRepository();
    repository.textFiles.set(
      'packages/interviews/package.json',
      INTERVIEWS_MANIFEST.replace('"ajv":"8.20.0"', '"ajv":"^8.20.0"'),
    );

    expect(validateRepositoryInvariants(repository)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'repository.product-dependency',
          path: 'packages/interviews/package.json',
        }),
      ]),
    );
  });

  it.each([
    [
      'packages/contracts/package.json',
      CONTRACTS_MANIFEST.replace('workspace:0.0.0', '0.0.0'),
    ],
    [
      'packages/persistence/package.json',
      PERSISTENCE_MANIFEST.replace('workspace:0.0.0', 'workspace:*'),
    ],
    [
      'tools/evaluation-harness/package.json',
      EVALUATION_MANIFEST.replace('workspace:0.0.0', 'workspace:*'),
    ],
    [
      'tools/repository-checks/package.json',
      TOOL_MANIFEST.replace(
        '"dependencies":{',
        '"dependencies":{"@gitblocks/domain":"workspace:0.0.0",',
      ),
    ],
  ])(
    'rejects a non-allowlisted workspace dependency in %s',
    (manifestPath, manifest) => {
      const repository = validRepository();
      repository.textFiles.set(manifestPath, manifest);

      expect(validateRepositoryInvariants(repository)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'repository.dependency-version',
            path: manifestPath,
          }),
        ]),
      );
    },
  );

  it('requires product packages to expose only their root entry point', () => {
    const repository = validRepository();
    repository.textFiles.set(
      'packages/contracts/package.json',
      CONTRACTS_MANIFEST.replace(
        '"exports":{',
        '"exports":{"./internal":"./dist/src/internal.js",',
      ),
    );

    expect(validateRepositoryInvariants(repository)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'repository.product-exports',
          path: 'packages/contracts/package.json',
        }),
      ]),
    );
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

  it('requires one product build before typed lint and internal typecheck', () => {
    const repository = validRepository();
    repository.textFiles.set(
      'package.json',
      ROOT_MANIFEST.replace(
        'pnpm build:product && pnpm lint:internal && pnpm build:tools && pnpm typecheck:internal',
        'pnpm lint:internal && pnpm build:product && pnpm build:tools && pnpm typecheck:internal',
      ),
    );

    expect(validateRepositoryInvariants(repository)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'repository.runtime-script' }),
      ]),
    );
  });

  it('requires tool builds before internal typecheck on a clean checkout', () => {
    const repository = validRepository();
    repository.textFiles.set(
      'package.json',
      ROOT_MANIFEST.replace(
        'pnpm build:tools && pnpm typecheck:internal',
        'pnpm typecheck:internal && pnpm build:tools',
      ),
    );

    expect(validateRepositoryInvariants(repository)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'repository.runtime-script' }),
      ]),
    );
  });

  it('requires product and tool builds before standalone internal typecheck', () => {
    for (const invalid of [
      'pnpm build:product && pnpm typecheck:internal',
      'pnpm build:product && pnpm typecheck:internal && pnpm build:tools',
    ]) {
      const repository = validRepository();
      repository.textFiles.set(
        'package.json',
        ROOT_MANIFEST.replace(
          'pnpm build:product && pnpm build:tools && pnpm typecheck:internal',
          invalid,
        ),
      );
      expect(validateRepositoryInvariants(repository)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'repository.runtime-script' }),
        ]),
      );
    }
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
