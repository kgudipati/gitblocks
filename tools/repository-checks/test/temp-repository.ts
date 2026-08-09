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
  'docs/evaluation/retrieval-v1-authoring-protocol.md',
  'docs/evaluation/scoring.md',
  'docs/plans/0001-foundation.md',
  'docs/plans/0003-typescript-toolchain.md',
  'docs/plans/0005-node-runtime-preflight.md',
  'docs/plans/0009-product-contract-kernel.md',
  'docs/plans/0011-evidence-persistence.md',
  'docs/plans/0013-public-repository-ingestion.md',
  'docs/product/product-contract.md',
  'evals/pilot-v1/manifest.json',
  'evals/retrieval-v1/manifest.json',
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
  'schemas/evaluation/retrieval/baseline-report.schema.json',
  'schemas/evaluation/evidence.schema.json',
  'schemas/evaluation/gold.schema.json',
  'schemas/evaluation/manifest.schema.json',
  'schemas/evaluation/prediction.schema.json',
  'schemas/evaluation/score.schema.json',
  'tools/evaluation-harness/package.json',
  'tools/evaluation-harness/src/cli.ts',
  'tools/evaluation-harness/src/contract-conformance-cli.ts',
  'tools/evaluation-harness/src/index.ts',
  'tools/evaluation-harness/src/retrieval/cli.ts',
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
  'verification/retrieval-v1/baseline-report.json',
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
    'eval:retrieval:validate':
      'pnpm runtime:check && node tools/evaluation-harness/src/retrieval/cli.ts validate',
    'eval:retrieval:fixtures':
      'pnpm runtime:check && node tools/evaluation-harness/src/retrieval/cli.ts fixtures',
    'eval:retrieval:baselines':
      'pnpm runtime:check && node tools/evaluation-harness/src/retrieval/cli.ts baselines',
    'eval:retrieval:baselines:generate':
      'pnpm runtime:check && node tools/evaluation-harness/src/retrieval/cli.ts baselines-generate',
    'eval:retrieval:verify':
      'pnpm runtime:check && node tools/evaluation-harness/src/retrieval/cli.ts verify',
    'eval:retrieval:score':
      'pnpm runtime:check && node tools/evaluation-harness/src/retrieval/cli.ts score',
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
    'profiles:materialization:preflight':
      'pnpm runtime:check && node --conditions=gitblocks-source packages/ingestion/scripts/profile-materialization-cli.ts preflight',
    'profiles:materialization:execute':
      'pnpm runtime:check && node --conditions=gitblocks-source packages/ingestion/scripts/profile-materialization-cli.ts execute',
    'profiles:materialization:verify':
      'pnpm runtime:check && node --conditions=gitblocks-source packages/ingestion/scripts/profile-materialization-cli.ts verify',
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
    '@gitblocks/domain': 'workspace:0.0.0',
    '@gitblocks/persistence': 'workspace:0.0.0',
    ajv: '8.20.0',
  },
});

const DOMAIN_MANIFEST = JSON.stringify({
  name: '@gitblocks/domain',
  version: '0.0.0',
  private: true,
  type: 'module',
  exports: {
    '.': {
      types: './dist/src/index.d.ts',
      'gitblocks-source': './src/index.ts',
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
      'gitblocks-source': './src/index.ts',
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
      'gitblocks-source': './src/index.ts',
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
  if (relativePath === 'tools/evaluation-harness/package.json') {
    return EVALUATION_MANIFEST;
  }
  if (relativePath === 'packages/domain/package.json') {
    return DOMAIN_MANIFEST;
  }
  if (relativePath === 'packages/contracts/package.json') {
    return CONTRACTS_MANIFEST;
  }
  if (relativePath === 'packages/persistence/package.json') {
    return PERSISTENCE_MANIFEST;
  }
  if (relativePath === 'packages/ingestion/package.json') {
    return INGESTION_MANIFEST;
  }
  if (relativePath === 'packages/interviews/package.json') {
    return INTERVIEWS_MANIFEST;
  }
  if (relativePath === 'apps/repository-interview-operator/package.json') {
    return OPERATOR_MANIFEST;
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
  typecheck:
    runs-on: ubuntu-24.04
    steps:
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: git diff --exit-code
  verification-static:
    runs-on: ubuntu-24.04
    steps:
      - run: pnpm install --frozen-lockfile
      - run: |
          pnpm repo:pr-branch -- "$PR_ACTOR" "$PR_BRANCH"
          pnpm repo:pr-title -- "$PR_TITLE"
      - run: pnpm runtime:check
      - run: pnpm format:check
      - run: pnpm build:product
      - run: pnpm lint:internal
      - run: pnpm build:tools
      - run: pnpm typecheck:internal
      - run: pnpm architecture:check
      - run: node tools/repository-checks/src/cli.ts repository
      - run: pnpm security:secrets
      - run: git diff --exit-code
  verification-authority-retrieval:
    runs-on: ubuntu-24.04
    steps:
      - run: pnpm install --frozen-lockfile
      - run: pnpm runtime:check
      - run: pnpm --filter @gitblocks/evaluation-harness... build
      - run: node tools/evaluation-harness/src/retrieval/cli.ts validate
      - run: node tools/evaluation-harness/src/retrieval/cli.ts validate-v2
      - run: node tools/evaluation-harness/src/retrieval/cli.ts fixtures
      - run: node tools/evaluation-harness/src/retrieval/cli.ts verify
      - run: node tools/evaluation-harness/src/retrieval/cli.ts verify-v2
      - run: node tools/evaluation-harness/src/retrieval/cli.ts gates-validate-v2
      - run: git diff --exit-code
  verification-authority-other:
    runs-on: ubuntu-24.04
    steps:
      - run: pnpm install --frozen-lockfile
      - run: pnpm runtime:check
      - run: pnpm --filter @gitblocks/repository-interview-prelive... build
      - run: node tools/evaluation-harness/src/cli.ts validate
      - run: node tools/evaluation-harness/src/cli.ts fixtures
      - run: node tools/evaluation-harness/src/repository-interview-evaluation-cli.ts validate
      - run: node tools/evaluation-harness/src/repository-interview-evaluation-cli.ts fixtures
      - run: node tools/evaluation-harness/src/contract-conformance-cli.ts
      - run: node packages/contracts/scripts/taxonomy-cli.ts
      - run: node packages/ingestion/scripts/candidate-profile-cli.ts
      - run: node packages/ingestion/scripts/catalog-cli.ts
      - run: node packages/interviews/scripts/specification-cli.ts validate
      - run: node apps/repository-interview-operator/scripts/schema-cli.ts validate
      - run: node tools/repository-interview-prelive/src/prelive-cli.ts validate
      - run: git diff --exit-code
  verification-tests-contracts-domain:
    runs-on: ubuntu-24.04
    steps:
      - run: pnpm install --frozen-lockfile
      - run: pnpm runtime:check
      - run: pnpm --filter @gitblocks/contracts... build
      - run: >-
          pnpm exec vitest run
          packages/contracts/test
          packages/domain/test
          --config vitest.config.ts
      - run: git diff --exit-code
  verification-tests-persistence-ingestion:
    runs-on: ubuntu-24.04
    steps:
      - run: pnpm install --frozen-lockfile
      - run: pnpm runtime:check
      - run: pnpm --filter @gitblocks/ingestion... build
      - run: >-
          pnpm exec vitest run
          packages/persistence/test
          packages/ingestion/test
          --config vitest.config.ts
      - run: git diff --exit-code
  verification-tests-interviews:
    runs-on: ubuntu-24.04
    steps:
      - run: pnpm install --frozen-lockfile
      - run: pnpm runtime:check
      - run: pnpm --filter @gitblocks/repository-interview-operator... build
      - run: >-
          pnpm exec vitest run
          packages/interviews/test
          apps/repository-interview-operator/test
          --config vitest.config.ts
      - run: git diff --exit-code
  verification-tests-evaluation-harness:
    runs-on: ubuntu-24.04
    steps:
      - run: pnpm install --frozen-lockfile
      - run: pnpm runtime:check
      - run: pnpm --filter @gitblocks/evaluation-harness... build
      - run: >-
          pnpm exec vitest run
          tools/evaluation-harness/test
          --config vitest.config.ts
      - run: git diff --exit-code
  verification-tests-prelive:
    runs-on: ubuntu-24.04
    steps:
      - run: pnpm install --frozen-lockfile
      - run: pnpm runtime:check
      - run: pnpm --filter @gitblocks/repository-interview-prelive... build
      - run: >-
          pnpm exec vitest run
          tools/repository-interview-prelive/test
          --config vitest.config.ts
      - run: git diff --exit-code
  verification-tests-repository-checks:
    runs-on: ubuntu-24.04
    steps:
      - run: pnpm install --frozen-lockfile
      - run: pnpm runtime:check
      - run: >-
          pnpm exec vitest run
          tools/repository-checks/test
          --config vitest.config.ts
      - run: git diff --exit-code
  database-and-audit:
    runs-on: ubuntu-24.04
    services:
      postgres:
        image: postgres:18.4-bookworm@sha256:1961f96e6029a02c3812d7cb329a3b03a3ac2bb067058dec17b0f5596aca9296
    env:
      GITBLOCKS_DB_TEST_ACK: ephemeral
      GITBLOCKS_TEST_DB_DATABASE: gitblocks_test
      GITBLOCKS_TEST_DB_OWNER: postgres
    steps:
      - run: pnpm install --frozen-lockfile
      - run: pnpm db:verify
      - run: pnpm security:audit
      - run: git diff --exit-code
  verification:
    name: Verification
    needs:
      - verification-static
      - verification-authority-retrieval
      - verification-authority-other
      - verification-tests-contracts-domain
      - verification-tests-persistence-ingestion
      - verification-tests-interviews
      - verification-tests-evaluation-harness
      - verification-tests-prelive
      - verification-tests-repository-checks
    if: \${{ always() }}
    timeout-minutes: 5
    env:
      STATIC_RESULT: \${{ needs.verification-static.result }}
      RETRIEVAL_AUTHORITY_RESULT: \${{ needs.verification-authority-retrieval.result }}
      OTHER_AUTHORITY_RESULT: \${{ needs.verification-authority-other.result }}
      CONTRACTS_DOMAIN_RESULT: \${{ needs.verification-tests-contracts-domain.result }}
      PERSISTENCE_INGESTION_RESULT: \${{ needs.verification-tests-persistence-ingestion.result }}
      INTERVIEW_TEST_RESULT: \${{ needs.verification-tests-interviews.result }}
      EVALUATION_HARNESS_RESULT: \${{ needs.verification-tests-evaluation-harness.result }}
      PRELIVE_TEST_RESULT: \${{ needs.verification-tests-prelive.result }}
      REPOSITORY_CHECKS_RESULT: \${{ needs.verification-tests-repository-checks.result }}
    steps:
      - run: |
          test "$STATIC_RESULT" = "success"
          test "$RETRIEVAL_AUTHORITY_RESULT" = "success"
          test "$OTHER_AUTHORITY_RESULT" = "success"
          test "$CONTRACTS_DOMAIN_RESULT" = "success"
          test "$PERSISTENCE_INGESTION_RESULT" = "success"
          test "$INTERVIEW_TEST_RESULT" = "success"
          test "$EVALUATION_HARNESS_RESULT" = "success"
          test "$PRELIVE_TEST_RESULT" = "success"
          test "$REPOSITORY_CHECKS_RESULT" = "success"
`;
  }
  if (relativePath.endsWith('.md')) {
    return '# GitBlocks\n';
  }
  return '';
}
