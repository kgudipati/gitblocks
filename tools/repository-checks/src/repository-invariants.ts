import {
  parseBoundedYaml,
  YAML_LIMITS,
  type BoundedYamlFailure,
} from './bounded-yaml.ts';
import {
  inspectMarkdownFiles,
  MARKDOWN_LIMITS,
  type MarkdownRepositoryInspection,
} from './markdown-inspection.ts';
import { diagnostic, type Diagnostic } from './types.ts';

const MAX_CONFIGURATION_BYTES = 256 * 1024;
const EXACT_VERSION_PATTERN = /^[0-9]+\.[0-9]+\.[0-9]+$/;
const EXACT_WORKSPACE_VERSION = 'workspace:0.0.0';
const NODE_VERSION_PATTERN =
  /^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)$/;
const PACKAGE_MANAGER_PATTERN =
  /^pnpm@[0-9]+\.[0-9]+\.[0-9]+\+sha512\.[0-9a-f]{128}$/;
const POSTGRES_TEST_IMAGE =
  'postgres:18.4-bookworm@sha256:1961f96e6029a02c3812d7cb329a3b03a3ac2bb067058dec17b0f5596aca9296';
const APPROVED_PACKAGE_MANIFESTS = new Set([
  'package.json',
  'packages/contracts/package.json',
  'packages/domain/package.json',
  'packages/ingestion/package.json',
  'packages/persistence/package.json',
  'tools/evaluation-harness/package.json',
  'tools/repository-checks/package.json',
]);
interface ProductPackagePolicy {
  readonly dependencies: ReadonlyMap<string, string>;
  readonly name: string;
}

const PRODUCT_PACKAGE_POLICIES: ReadonlyMap<string, ProductPackagePolicy> =
  new Map([
    [
      'packages/contracts/package.json',
      {
        dependencies: new Map([
          ['@gitblocks/domain', EXACT_WORKSPACE_VERSION],
          ['ajv', '8.20.0'],
          ['typebox', '1.3.8'],
        ]),
        name: '@gitblocks/contracts',
      },
    ],
    [
      'packages/domain/package.json',
      {
        dependencies: new Map<string, string>(),
        name: '@gitblocks/domain',
      },
    ],
    [
      'packages/ingestion/package.json',
      {
        dependencies: new Map([
          ['@gitblocks/contracts', EXACT_WORKSPACE_VERSION],
          ['@gitblocks/persistence', EXACT_WORKSPACE_VERSION],
        ]),
        name: '@gitblocks/ingestion',
      },
    ],
    [
      'packages/persistence/package.json',
      {
        dependencies: new Map([
          ['@gitblocks/contracts', EXACT_WORKSPACE_VERSION],
          ['postgres', '3.4.9'],
        ]),
        name: '@gitblocks/persistence',
      },
    ],
  ] as const);
const APPROVED_WORKSPACE_DEPENDENCIES: ReadonlyMap<
  string,
  ReadonlyMap<string, string>
> = new Map([
  [
    'packages/contracts/package.json',
    new Map([['@gitblocks/domain', EXACT_WORKSPACE_VERSION]]),
  ],
  [
    'packages/ingestion/package.json',
    new Map([
      ['@gitblocks/contracts', EXACT_WORKSPACE_VERSION],
      ['@gitblocks/persistence', EXACT_WORKSPACE_VERSION],
    ]),
  ],
  [
    'packages/persistence/package.json',
    new Map([['@gitblocks/contracts', EXACT_WORKSPACE_VERSION]]),
  ],
  [
    'tools/evaluation-harness/package.json',
    new Map([
      ['@gitblocks/contracts', EXACT_WORKSPACE_VERSION],
      ['@gitblocks/persistence', EXACT_WORKSPACE_VERSION],
    ]),
  ],
] as const);
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
  'catalog/public-v1/candidates.json',
  'catalog/public-v1/manifest.json',
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
  'packages/contracts/src/index.ts',
  'packages/domain/README.md',
  'packages/domain/package.json',
  'packages/domain/src/index.ts',
  'packages/ingestion/README.md',
  'packages/ingestion/package.json',
  'packages/ingestion/scripts/catalog-cli.ts',
  'packages/ingestion/scripts/live-cli.ts',
  'packages/ingestion/scripts/receipt-cli.ts',
  'packages/ingestion/scripts/tsconfig.json',
  'packages/ingestion/src/index.ts',
  'packages/ingestion/test/tsconfig.json',
  'packages/ingestion/tsconfig.json',
  'packages/ingestion/tsconfig.test.json',
  'packages/persistence/README.md',
  'packages/persistence/migrations/0001_evidence_persistence.sql',
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

export interface RepositoryInvariantInput {
  readonly markdownInspection?: MarkdownRepositoryInspection;
  readonly textFiles: ReadonlyMap<string, string>;
  readonly trackedPaths: ReadonlySet<string>;
}

export function validateRepositoryInvariants(
  repository: RepositoryInvariantInput,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const requiredPath of REQUIRED_PATHS) {
    if (!repository.trackedPaths.has(requiredPath)) {
      diagnostics.push(
        diagnostic(
          'repository.required-file',
          'Required repository file is missing.',
          requiredPath,
        ),
      );
    }
  }

  for (const trackedPath of [...repository.trackedPaths].sort(compareText)) {
    if (isProhibitedArtifact(trackedPath)) {
      diagnostics.push(
        diagnostic(
          'repository.prohibited-artifact',
          'Artifact is outside the approved Phase 4 workspace shape.',
          trackedPath,
        ),
      );
    }
  }

  diagnostics.push(...validatePackageManifests(repository));
  diagnostics.push(...validateWorkspacePolicy(repository.textFiles));
  diagnostics.push(...validateDependabotPolicy(repository.textFiles));
  diagnostics.push(...validateCiPolicy(repository.textFiles));
  diagnostics.push(...validateNodePinPolicy(repository.textFiles));

  const markdownInspection =
    repository.markdownInspection ??
    inspectMarkdownFiles(
      new Map(
        [...repository.textFiles].filter(([filePath]) =>
          filePath.endsWith('.md'),
        ),
      ),
    );
  if (repository.markdownInspection === undefined) {
    diagnostics.push(...markdownInspection.diagnostics);
  }
  diagnostics.push(...validateProductCapitalization(markdownInspection));
  return diagnostics;
}

function validatePackageManifests(
  repository: RepositoryInvariantInput,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const packageManifests = [...repository.trackedPaths]
    .filter((trackedPath) => trackedPath.endsWith('package.json'))
    .sort(compareText);

  for (const manifestPath of packageManifests) {
    if (!APPROVED_PACKAGE_MANIFESTS.has(manifestPath)) {
      diagnostics.push(
        diagnostic(
          'repository.prohibited-artifact',
          'Package manifest is not approved in the Phase 4 workspace.',
          manifestPath,
        ),
      );
      continue;
    }

    const content = repository.textFiles.get(manifestPath);
    if (content === undefined) {
      diagnostics.push(
        diagnostic(
          'repository.required-content',
          'Package manifest was not available for policy validation.',
          manifestPath,
        ),
      );
      continue;
    }
    if (Buffer.byteLength(content, 'utf8') > MAX_CONFIGURATION_BYTES) {
      diagnostics.push(
        diagnostic(
          'repository.configuration-size',
          'Package manifest exceeds the configuration size limit.',
          manifestPath,
        ),
      );
      continue;
    }

    let manifest: unknown;
    try {
      manifest = JSON.parse(content) as unknown;
    } catch {
      diagnostics.push(
        diagnostic(
          'repository.package-json',
          'Package manifest must contain valid JSON.',
          manifestPath,
        ),
      );
      continue;
    }
    if (!isRecord(manifest)) {
      diagnostics.push(
        diagnostic(
          'repository.package-json',
          'Package manifest root must be an object.',
          manifestPath,
        ),
      );
      continue;
    }

    if (manifest['private'] !== true) {
      diagnostics.push(
        diagnostic(
          'repository.package-private',
          'Every workspace package must be private and non-publishable.',
          manifestPath,
        ),
      );
    }

    diagnostics.push(...validateProductPackage(manifest, manifestPath));

    if (manifestPath === 'package.json') {
      if (
        typeof manifest['packageManager'] !== 'string' ||
        !PACKAGE_MANAGER_PATTERN.test(manifest['packageManager'])
      ) {
        diagnostics.push(
          diagnostic(
            'repository.package-manager',
            'Root packageManager must pin pnpm exactly with a SHA-512 digest.',
            manifestPath,
          ),
        );
      }
      diagnostics.push(...validateRuntimeScripts(manifest, manifestPath));
      const engines = manifest['engines'];
      if (
        !isRecord(engines) ||
        engines['node'] !== '>=24.12.0 <25' ||
        engines['pnpm'] !== '11.17.0'
      ) {
        diagnostics.push(
          diagnostic(
            'repository.engines',
            'Root engines must require Node >=24.12.0 <25 and pnpm 11.17.0.',
            manifestPath,
          ),
        );
      }
    }

    for (const dependencyField of [
      'dependencies',
      'devDependencies',
      'optionalDependencies',
      'peerDependencies',
    ]) {
      const dependencies = manifest[dependencyField];
      if (dependencies === undefined) {
        continue;
      }
      if (!isRecord(dependencies)) {
        diagnostics.push(
          diagnostic(
            'repository.dependency-version',
            `${dependencyField} must be an object of exact versions.`,
            manifestPath,
          ),
        );
        continue;
      }
      for (const [dependencyName, version] of Object.entries(dependencies)) {
        if (
          typeof version !== 'string' ||
          !isApprovedDependencyVersion(
            manifestPath,
            dependencyField,
            dependencyName,
            version,
          )
        ) {
          diagnostics.push(
            diagnostic(
              'repository.dependency-version',
              `${dependencyName} in ${dependencyField} must use an exact stable version or its allowlisted exact workspace specifier.`,
              manifestPath,
            ),
          );
        }
      }
    }

    diagnostics.push(
      ...validateProductRuntimeDependencies(manifest, manifestPath),
    );
  }

  return diagnostics;
}

function validateRuntimeScripts(
  manifest: Readonly<Record<string, unknown>>,
  manifestPath: string,
): Diagnostic[] {
  const scripts = manifest['scripts'];
  if (!isRecord(scripts)) {
    return [
      diagnostic(
        'repository.runtime-script',
        'Root package scripts must protect TypeScript-backed commands with the runtime preflight.',
        manifestPath,
      ),
    ];
  }

  const diagnostics: Diagnostic[] = [];
  if (scripts['runtime:check'] !== 'node tools/runtime-preflight.mjs') {
    diagnostics.push(runtimeScriptDiagnostic('runtime:check', manifestPath));
  }
  for (const scriptName of [
    'contracts:validate',
    'catalog:validate',
    'eval:fixtures',
    'eval:score',
    'eval:validate',
    'test',
    'test:coverage',
    'ingest:live',
    'ingest:receipt',
    'ingestion:test',
    'ingestion:verify',
    'repo:check',
    'repo:branch',
    'repo:pr-branch',
    'repo:pr-title',
    'verify',
  ]) {
    const script = scripts[scriptName];
    if (
      typeof script !== 'string' ||
      !script.startsWith('pnpm runtime:check && ')
    ) {
      diagnostics.push(runtimeScriptDiagnostic(scriptName, manifestPath));
    }
  }
  if (
    typeof scripts['verify:core'] !== 'string' ||
    scripts['verify:core'].includes('runtime:check')
  ) {
    diagnostics.push(runtimeScriptDiagnostic('verify:core', manifestPath));
  }
  const requiredWorkspaceScripts = {
    build: 'pnpm build:product && pnpm build:tools',
    'build:product': 'pnpm --filter @gitblocks/ingestion... build',
    'build:tools':
      'pnpm --filter @gitblocks/repository-checks --filter @gitblocks/evaluation-harness build',
    'contracts:validate':
      'pnpm runtime:check && pnpm build:product && node tools/evaluation-harness/src/contract-conformance-cli.ts',
    'catalog:validate':
      'pnpm runtime:check && pnpm build:product && node packages/ingestion/scripts/catalog-cli.ts',
    'ingestion:test':
      'pnpm runtime:check && pnpm build:product && vitest run packages/ingestion/test --config vitest.config.ts',
    'ingestion:verify':
      'pnpm runtime:check && pnpm catalog:validate && pnpm ingestion:test && pnpm --filter @gitblocks/ingestion typecheck',
    'db:check':
      'pnpm runtime:check && pnpm build:product && node packages/persistence/scripts/db-cli.ts check',
    'db:migrate':
      'pnpm runtime:check && pnpm build:product && node packages/persistence/scripts/db-cli.ts migrate',
    'db:test':
      'pnpm runtime:check && pnpm build && vitest run --config vitest.db.config.ts',
    'db:verify':
      'pnpm runtime:check && pnpm build && node packages/persistence/scripts/db-verify.ts',
    lint: 'pnpm build:product && pnpm lint:internal',
    'lint:internal': 'eslint . --max-warnings 0',
    typecheck: 'pnpm build:product && pnpm typecheck:internal',
    'typecheck:internal':
      'pnpm --filter @gitblocks/domain --filter @gitblocks/contracts --filter @gitblocks/persistence --filter @gitblocks/ingestion --filter @gitblocks/repository-checks --filter @gitblocks/evaluation-harness typecheck',
  } as const;
  for (const [scriptName, expected] of Object.entries(
    requiredWorkspaceScripts,
  )) {
    if (scripts[scriptName] !== expected) {
      diagnostics.push(runtimeScriptDiagnostic(scriptName, manifestPath));
    }
  }
  const verifyCore = scripts['verify:core'];
  if (
    typeof verifyCore !== 'string' ||
    (verifyCore.match(/pnpm build:product/gu)?.length ?? 0) !== 1 ||
    !verifyCore.includes(
      'pnpm build:product && pnpm lint:internal && pnpm typecheck:internal && pnpm build:tools',
    )
  ) {
    diagnostics.push(runtimeScriptDiagnostic('verify:core', manifestPath));
  }
  if (
    scripts['verify:ci'] !==
    'pnpm verify && pnpm db:verify && pnpm security:audit'
  ) {
    diagnostics.push(runtimeScriptDiagnostic('verify:ci', manifestPath));
  }
  return diagnostics;
}

function runtimeScriptDiagnostic(
  scriptName: string,
  manifestPath: string,
): Diagnostic {
  return diagnostic(
    'repository.runtime-script',
    `Root script ${scriptName} must preserve the protected runtime-preflight graph.`,
    manifestPath,
  );
}

function validateNodePinPolicy(
  textFiles: ReadonlyMap<string, string>,
): Diagnostic[] {
  const pins = new Map<string, string>();
  const diagnostics: Diagnostic[] = [];
  for (const versionPath of ['.node-version', '.nvmrc']) {
    const content = textFiles.get(versionPath);
    if (content === undefined) {
      diagnostics.push(
        diagnostic(
          'repository.required-content',
          'Node version pin was not available for policy validation.',
          versionPath,
        ),
      );
      continue;
    }
    const version = normalizeNodePin(content);
    if (version === undefined) {
      diagnostics.push(
        diagnostic(
          'repository.node-pin',
          'Node version pin must contain one exact decimal version.',
          versionPath,
        ),
      );
      continue;
    }
    pins.set(versionPath, version);
  }

  const nodeVersion = pins.get('.node-version');
  const nvmVersion = pins.get('.nvmrc');
  if (
    nodeVersion !== undefined &&
    nvmVersion !== undefined &&
    nodeVersion !== nvmVersion
  ) {
    diagnostics.push(
      diagnostic(
        'repository.node-pin-mismatch',
        '.node-version and .nvmrc must contain the same normalized Node version.',
      ),
    );
  }
  return diagnostics;
}

function normalizeNodePin(content: string): string | undefined {
  const version = content.trim();
  if (
    (content !== version &&
      content !== `${version}\n` &&
      content !== `${version}\r\n`) ||
    !NODE_VERSION_PATTERN.test(version)
  ) {
    return undefined;
  }
  return version;
}

function validateWorkspacePolicy(
  textFiles: ReadonlyMap<string, string>,
): Diagnostic[] {
  const workspacePath = 'pnpm-workspace.yaml';
  const content = textFiles.get(workspacePath);
  if (content === undefined) {
    return [
      diagnostic(
        'repository.required-content',
        'pnpm workspace policy was not available for validation.',
        workspacePath,
      ),
    ];
  }
  const parsed = parseBoundedYaml(content);
  if (!parsed.ok) {
    return [configurationYamlDiagnostic('workspace', parsed.failure)];
  }

  const policy = parsed.value;
  if (!isRecord(policy)) {
    return [
      diagnostic(
        'repository.workspace-yaml',
        'pnpm workspace policy root must be a mapping.',
        workspacePath,
      ),
    ];
  }

  const expectedValues: Readonly<Record<string, unknown>> = {
    autoInstallPeers: false,
    blockExoticSubdeps: true,
    dangerouslyAllowAllBuilds: false,
    engineStrict: true,
    frozenLockfile: true,
    minimumReleaseAge: 1440,
    minimumReleaseAgeIgnoreMissingTime: false,
    minimumReleaseAgeStrict: true,
    nodeVersion: '24.12.0',
    resolvePeersFromWorkspaceRoot: false,
    strictDepBuilds: true,
    strictPeerDependencies: true,
    trustLockfile: false,
    trustPolicy: 'no-downgrade',
  };
  const diagnostics = Object.entries(expectedValues)
    .filter(([key, expectedValue]) => policy[key] !== expectedValue)
    .map(([key]) =>
      diagnostic(
        'repository.supply-chain-policy',
        `pnpm supply-chain setting ${key} is missing or weakened.`,
        workspacePath,
      ),
    );

  const packages = policy['packages'];
  if (
    !Array.isArray(packages) ||
    !['apps/*', 'packages/*', 'tools/*'].every((workspaceGlob) =>
      packages.includes(workspaceGlob),
    )
  ) {
    diagnostics.push(
      diagnostic(
        'repository.workspace-globs',
        'Workspace must reserve apps/*, packages/*, and tools/*.',
        workspacePath,
      ),
    );
  }

  const allowBuilds = policy['allowBuilds'];
  if (!isRecord(allowBuilds)) {
    diagnostics.push(
      diagnostic(
        'repository.supply-chain-policy',
        'allowBuilds must be an explicit default-deny mapping.',
        workspacePath,
      ),
    );
  } else {
    for (const [selector, allowed] of Object.entries(allowBuilds)) {
      if (
        typeof allowed !== 'boolean' ||
        (allowed && !/@[0-9]+\.[0-9]+\.[0-9]+$/.test(selector))
      ) {
        diagnostics.push(
          diagnostic(
            'repository.build-allowlist',
            'Allowed dependency builds must use an exact package version selector.',
            workspacePath,
          ),
        );
      }
    }
  }

  return diagnostics;
}

function validateDependabotPolicy(
  textFiles: ReadonlyMap<string, string>,
): Diagnostic[] {
  const dependabotPath = '.github/dependabot.yml';
  const content = textFiles.get(dependabotPath);
  if (content === undefined) {
    return [
      diagnostic(
        'repository.required-content',
        'Dependabot policy was not available for validation.',
        dependabotPath,
      ),
    ];
  }

  const parsed = parseBoundedYaml(content);
  if (!parsed.ok) {
    return [configurationYamlDiagnostic('dependabot', parsed.failure)];
  }
  if (!isRecord(parsed.value)) {
    return [
      diagnostic(
        'repository.dependabot-yaml',
        'Dependabot policy must contain an updates sequence.',
        dependabotPath,
      ),
    ];
  }
  const rawUpdates = parsed.value['updates'];
  if (!Array.isArray(rawUpdates)) {
    return [
      diagnostic(
        'repository.dependabot-yaml',
        'Dependabot policy must contain an updates sequence.',
        dependabotPath,
      ),
    ];
  }
  const updates: readonly unknown[] = rawUpdates;

  const diagnostics: Diagnostic[] = [];
  for (const ecosystem of ['npm', 'github-actions']) {
    const entries: readonly unknown[] = updates.filter(
      (entry) =>
        isRecord(entry) &&
        entry['package-ecosystem'] === ecosystem &&
        entry['directory'] === '/',
    );
    if (entries.length !== 1) {
      diagnostics.push(
        diagnostic(
          'repository.dependabot-ecosystem',
          `Dependabot must configure exactly one ${ecosystem} update entry at the repository root.`,
          dependabotPath,
        ),
      );
      continue;
    }
    const entry: unknown = entries[0];
    if (!isRecord(entry) || entry['rebase-strategy'] !== 'disabled') {
      diagnostics.push(
        diagnostic(
          'repository.dependabot-rebase',
          `Dependabot ${ecosystem} updates must disable automatic rebasing.`,
          dependabotPath,
        ),
      );
    }
  }

  return diagnostics;
}

function validateCiPolicy(
  textFiles: ReadonlyMap<string, string>,
): Diagnostic[] {
  const workflowPath = '.github/workflows/ci.yml';
  const content = textFiles.get(workflowPath);
  if (content === undefined) {
    return [
      diagnostic(
        'repository.required-content',
        'CI workflow was not available for policy validation.',
        workflowPath,
      ),
    ];
  }
  const requiredFragments = [
    `image: ${POSTGRES_TEST_IMAGE}`,
    'GITBLOCKS_DB_TEST_ACK: ephemeral',
    'GITBLOCKS_TEST_DB_DATABASE: gitblocks_test',
    'GITBLOCKS_TEST_DB_OWNER: postgres',
    'run: pnpm verify:ci',
  ] as const;
  if (requiredFragments.every((fragment) => content.includes(fragment))) {
    return [];
  }
  return [
    diagnostic(
      'repository.ci-postgresql',
      'CI must run verify:ci against the exact pinned ephemeral PostgreSQL service.',
      workflowPath,
    ),
  ];
}

function validateProductCapitalization(
  inspection: MarkdownRepositoryInspection,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  for (const [markdownPath, fileInspection] of [...inspection.files].sort(
    ([left], [right]) => compareText(left, right),
  )) {
    if (fileInspection.hasProductCapitalizationViolation) {
      diagnostics.push(
        diagnostic(
          'repository.product-capitalization',
          'Product prose must capitalize GitBlocks exactly; code and link slugs are exempt.',
          markdownPath,
        ),
      );
    }
    if (diagnostics.length >= MARKDOWN_LIMITS.diagnostics) {
      break;
    }
  }

  return diagnostics;
}

function isProhibitedArtifact(trackedPath: string): boolean {
  return (
    trackedPath.startsWith('apps/') ||
    (trackedPath.startsWith('packages/') &&
      !trackedPath.startsWith('packages/contracts/') &&
      !trackedPath.startsWith('packages/domain/') &&
      !trackedPath.startsWith('packages/ingestion/') &&
      !trackedPath.startsWith('packages/persistence/')) ||
    trackedPath.startsWith('src/') ||
    (trackedPath.startsWith('tools/') &&
      trackedPath !== 'tools/runtime-preflight.mjs' &&
      !trackedPath.startsWith('tools/evaluation-harness/') &&
      !trackedPath.startsWith('tools/repository-checks/'))
  );
}

function validateProductPackage(
  manifest: Readonly<Record<string, unknown>>,
  manifestPath: string,
): Diagnostic[] {
  const policy = PRODUCT_PACKAGE_POLICIES.get(manifestPath);
  if (policy === undefined) {
    return [];
  }

  const diagnostics: Diagnostic[] = [];
  if (
    manifest['name'] !== policy.name ||
    manifest['version'] !== '0.0.0' ||
    manifest['type'] !== 'module'
  ) {
    diagnostics.push(
      diagnostic(
        'repository.product-package',
        'Product packages must preserve their approved name, private workspace version, and ESM module type.',
        manifestPath,
      ),
    );
  }

  const exports = manifest['exports'];
  if (
    !isRecord(exports) ||
    Object.keys(exports).length !== 1 ||
    !isRecord(exports['.']) ||
    Object.keys(exports['.']).length !== 2 ||
    exports['.']['types'] !== './dist/src/index.d.ts' ||
    exports['.']['import'] !== './dist/src/index.js'
  ) {
    diagnostics.push(
      diagnostic(
        'repository.product-exports',
        'Product packages must expose only the public root entry point.',
        manifestPath,
      ),
    );
  }

  return diagnostics;
}

function validateProductRuntimeDependencies(
  manifest: Readonly<Record<string, unknown>>,
  manifestPath: string,
): Diagnostic[] {
  const policy = PRODUCT_PACKAGE_POLICIES.get(manifestPath);
  if (policy === undefined) {
    return [];
  }

  const dependencies = manifest['dependencies'];
  const actualDependencies = isRecord(dependencies)
    ? new Map(Object.entries(dependencies))
    : new Map<string, unknown>();
  const hasExpectedDependencies =
    actualDependencies.size === policy.dependencies.size &&
    [...policy.dependencies].every(
      ([dependencyName, expectedVersion]) =>
        actualDependencies.get(dependencyName) === expectedVersion,
    );
  const hasNoAlternateRuntimeDependencies = [
    'optionalDependencies',
    'peerDependencies',
  ].every((field) => {
    const value = manifest[field];
    return (
      value === undefined ||
      (isRecord(value) && Object.keys(value).length === 0)
    );
  });

  if (hasExpectedDependencies && hasNoAlternateRuntimeDependencies) {
    return [];
  }
  return [
    diagnostic(
      'repository.product-dependency',
      'Product runtime dependencies must match the Phase 4 package allowlist exactly.',
      manifestPath,
    ),
  ];
}

function isApprovedDependencyVersion(
  manifestPath: string,
  dependencyField: string,
  dependencyName: string,
  version: string,
): boolean {
  if (!dependencyName.startsWith('@gitblocks/')) {
    return EXACT_VERSION_PATTERN.test(version);
  }
  return (
    dependencyField === 'dependencies' &&
    APPROVED_WORKSPACE_DEPENDENCIES.get(manifestPath)?.get(dependencyName) ===
      version
  );
}

function configurationYamlDiagnostic(
  configuration: 'dependabot' | 'workspace',
  failure: BoundedYamlFailure,
): Diagnostic {
  const path =
    configuration === 'workspace'
      ? 'pnpm-workspace.yaml'
      : '.github/dependabot.yml';
  const subject =
    configuration === 'workspace' ? 'pnpm workspace' : 'Dependabot';
  switch (failure) {
    case 'alias':
      return diagnostic(
        `repository.${configuration}-yaml-alias`,
        `${subject} policy must not use YAML aliases.`,
        path,
      );
    case 'file-size':
      return diagnostic(
        'repository.configuration-size',
        `${subject} policy exceeds the ${String(YAML_LIMITS.bytes)}-byte configuration size limit.`,
        path,
      );
    case 'structure':
      return diagnostic(
        `repository.${configuration}-structure-limit`,
        `${subject} policy exceeds the allowed YAML node count or nesting depth.`,
        path,
      );
    case 'syntax':
      return diagnostic(
        `repository.${configuration}-yaml`,
        `${subject} policy must be valid YAML with unique keys and supported tags.`,
        path,
      );
  }
}

function compareText(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  return left > right ? 1 : 0;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
