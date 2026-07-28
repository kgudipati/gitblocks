import { fromMarkdown } from 'mdast-util-from-markdown';
import { parseDocument } from 'yaml';

import { diagnostic, type Diagnostic } from './types.ts';

const MAX_CONFIGURATION_BYTES = 256 * 1024;
const EXACT_VERSION_PATTERN = /^[0-9]+\.[0-9]+\.[0-9]+$/;
const PACKAGE_MANAGER_PATTERN =
  /^pnpm@[0-9]+\.[0-9]+\.[0-9]+\+sha512\.[0-9a-f]{128}$/;
const APPROVED_PACKAGE_MANIFESTS = new Set([
  'package.json',
  'tools/repository-checks/package.json',
]);
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

export interface RepositoryInvariantInput {
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
          'Artifact is outside the approved Phase 1 workspace shape.',
          trackedPath,
        ),
      );
    }
  }

  diagnostics.push(...validatePackageManifests(repository));
  diagnostics.push(...validateWorkspacePolicy(repository.textFiles));
  diagnostics.push(...validateProductCapitalization(repository.textFiles));
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
          'Package manifest is not approved in the Phase 1 workspace.',
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
          'Every Phase 1 package must be private and non-publishable.',
          manifestPath,
        ),
      );
    }

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
          !EXACT_VERSION_PATTERN.test(version)
        ) {
          diagnostics.push(
            diagnostic(
              'repository.dependency-version',
              `${dependencyName} in ${dependencyField} must use an exact stable version.`,
              manifestPath,
            ),
          );
        }
      }
    }
  }

  return diagnostics;
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
  if (Buffer.byteLength(content, 'utf8') > MAX_CONFIGURATION_BYTES) {
    return [
      diagnostic(
        'repository.configuration-size',
        'pnpm workspace policy exceeds the configuration size limit.',
        workspacePath,
      ),
    ];
  }

  const document = parseDocument(content, {
    prettyErrors: false,
    uniqueKeys: true,
    version: '1.2',
  });
  if (document.errors.length > 0) {
    return [
      diagnostic(
        'repository.workspace-yaml',
        'pnpm workspace policy must be valid YAML with unique keys.',
        workspacePath,
      ),
    ];
  }

  let policy: unknown;
  try {
    policy = document.toJS({ maxAliasCount: 0 }) as unknown;
  } catch {
    return [
      diagnostic(
        'repository.workspace-yaml',
        'pnpm workspace policy must not use YAML aliases.',
        workspacePath,
      ),
    ];
  }
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

function validateProductCapitalization(
  textFiles: ReadonlyMap<string, string>,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const markdownPaths = [...textFiles.keys()]
    .filter((filePath) => filePath.endsWith('.md'))
    .sort(compareText);

  for (const markdownPath of markdownPaths) {
    const content = textFiles.get(markdownPath);
    if (content === undefined) {
      continue;
    }
    const root = fromMarkdown(content) as unknown;

    function visit(node: unknown, insideLink: boolean): void {
      if (!isRecord(node)) {
        return;
      }
      const nextInsideLink =
        insideLink ||
        node['type'] === 'link' ||
        node['type'] === 'linkReference' ||
        node['type'] === 'definition';
      if (
        node['type'] === 'text' &&
        !nextInsideLink &&
        typeof node['value'] === 'string'
      ) {
        const matches = node['value'].match(/\bgitblocks\b/gi) ?? [];
        if (matches.some((match) => match !== 'GitBlocks')) {
          diagnostics.push(
            diagnostic(
              'repository.product-capitalization',
              'Product prose must capitalize GitBlocks exactly; code and link slugs are exempt.',
              markdownPath,
            ),
          );
          return;
        }
      }
      if (Array.isArray(node['children'])) {
        for (const child of node['children']) {
          visit(child, nextInsideLink);
        }
      }
    }

    visit(root, false);
  }

  return diagnostics;
}

function isProhibitedArtifact(trackedPath: string): boolean {
  return (
    trackedPath === '__nonexistent__' ||
    trackedPath.startsWith('apps/') ||
    trackedPath.startsWith('packages/') ||
    trackedPath.startsWith('src/') ||
    (trackedPath.startsWith('tools/') &&
      !trackedPath.startsWith('tools/repository-checks/'))
  );
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
