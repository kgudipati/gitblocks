import { canonicalizeJson } from './canonical-json.ts';
import { ingestionError } from './errors.ts';
import { mapProfilePrimaryLanguage } from './profile-materialization-providers.ts';

export type CandidateAuthorityPartialRuleResult =
  | {
      readonly state: 'established-facts';
      readonly facts: readonly {
        readonly factCode:
          | 'applicable-security-advisory'
          | 'declared-framework-peer-relation'
          | 'importable-runtime-package-surface'
          | 'published-release'
          | 'recognized-license-spdx'
          | 'repository-primary-language'
          | 'repository-self-build-compose-service';
        readonly factValue: string;
      }[];
    }
  | { readonly state: 'unknown'; readonly reason: string };

const FRAMEWORK_PEER_DEPENDENCIES: Readonly<Record<string, string>> =
  Object.freeze({
    '@nestjs/core': 'nestjs',
    express: 'express',
    fastify: 'fastify',
    next: 'nextjs',
  });
const RUNTIME_EXPORT_CONDITIONS = new Set([
  'default',
  'import',
  'module-sync',
  'node',
  'node-addons',
  'require',
]);

export function extractImportableRuntimePackageAdoptionFact(input: {
  readonly catalogPackageName: string | null;
  readonly sourcePackageName: string | null;
  readonly selectedVersion: string | null;
  readonly sourceComplete: boolean;
  readonly exportsValue: unknown;
  readonly main: string | null;
  readonly module: string | null;
}): CandidateAuthorityPartialRuleResult {
  if (input.catalogPackageName === null) {
    return { state: 'unknown', reason: 'no-catalog-package-mapping' };
  }
  if (
    input.sourcePackageName !== null &&
    input.sourcePackageName !== input.catalogPackageName
  )
    invalid();
  if (
    !input.sourceComplete ||
    input.sourcePackageName === null ||
    input.selectedVersion === null
  ) {
    return { state: 'unknown', reason: 'package-publication-not-established' };
  }
  requirePackageName(input.sourcePackageName);
  requirePackageVersion(input.selectedVersion);
  const entryPointKind = hasExplicitRootExport(input.exportsValue)
    ? 'exports'
    : isRuntimeEntryPoint(input.module)
      ? 'module'
      : isRuntimeEntryPoint(input.main)
        ? 'main'
        : null;
  if (entryPointKind === null) {
    return {
      state: 'unknown',
      reason: 'importable-runtime-entry-point-not-established',
    };
  }
  return {
    state: 'established-facts',
    facts: [
      {
        factCode: 'importable-runtime-package-surface',
        factValue: canonicalizeJson({
          entryPointKind,
          packageName: input.sourcePackageName,
          packageVersion: input.selectedVersion,
        }).text,
      },
    ],
  };
}

export function extractRepositoryPrimaryLanguageFact(input: {
  readonly primaryLanguage: string | null;
  readonly sourceComplete: boolean;
}): CandidateAuthorityPartialRuleResult {
  if (!input.sourceComplete || input.primaryLanguage === null) {
    return {
      state: 'unknown',
      reason: 'repository-primary-language-not-established',
    };
  }
  const mapped = mapProfilePrimaryLanguage(input.primaryLanguage);
  if (mapped === undefined || mapped === null) {
    return {
      state: 'unknown',
      reason: 'repository-primary-language-not-established',
    };
  }
  return {
    state: 'established-facts',
    facts: [{ factCode: 'repository-primary-language', factValue: mapped }],
  };
}

export function extractFrameworkPeerRelationFacts(input: {
  readonly peerDependencies: Readonly<Record<string, string>> | null;
  readonly sourceComplete: boolean;
}): CandidateAuthorityPartialRuleResult {
  if (!input.sourceComplete) {
    return { state: 'unknown', reason: 'package-peer-source-incomplete' };
  }
  if (input.peerDependencies === null) {
    return {
      state: 'unknown',
      reason: 'framework-peer-relation-not-established',
    };
  }
  const facts = Object.entries(input.peerDependencies)
    .flatMap(([packageName, range]) => {
      requirePackageName(packageName);
      requireDependencyRange(range);
      const framework = FRAMEWORK_PEER_DEPENDENCIES[packageName];
      return framework === undefined
        ? []
        : [
            {
              factCode: 'declared-framework-peer-relation' as const,
              factValue: canonicalizeJson({
                framework,
                packageName,
                range,
              }).text,
            },
          ];
    })
    .sort((left, right) => compare(left.factValue, right.factValue));
  return facts.length === 0
    ? {
        state: 'unknown',
        reason: 'framework-peer-relation-not-established',
      }
    : { state: 'established-facts', facts };
}

export function extractDatastoreRequirementFact(input: {
  readonly dependencies: Readonly<Record<string, string>> | null;
  readonly sourceComplete: boolean;
}): CandidateAuthorityPartialRuleResult {
  void input;
  return {
    state: 'unknown',
    reason: 'package-dependency-does-not-prove-datastore-requirement',
  };
}

export function extractPublishedReleaseFacts(input: {
  readonly outcome:
    'established-absence' | 'established-value' | 'temporary-unavailable';
  readonly releases: readonly {
    readonly tagName: string;
    readonly publishedAt: string;
    readonly draft: boolean;
    readonly prerelease: boolean;
  }[];
}): CandidateAuthorityPartialRuleResult {
  if (input.outcome !== 'established-value') {
    return {
      state: 'unknown',
      reason:
        input.outcome === 'temporary-unavailable'
          ? 'release-source-temporarily-unavailable'
          : 'release-absence-emits-no-positive-partial-fact',
    };
  }
  const facts = input.releases
    .filter((release) => !release.draft)
    .map((release) => {
      requireTimestamp(release.publishedAt);
      requireReleaseToken(release.tagName);
      return {
        factCode: 'published-release' as const,
        factValue: canonicalizeJson({
          prerelease: release.prerelease,
          publishedAt: release.publishedAt,
          tag: release.tagName,
        }).text,
      };
    })
    .sort((left, right) => compare(left.factValue, right.factValue));
  return facts.length > 0
    ? { state: 'established-facts', facts }
    : { state: 'unknown', reason: 'published-release-not-established' };
}

export function extractApplicableSecurityAdvisoryFacts(input: {
  readonly expectedPackageName: string | null;
  readonly expectedPackageVersion: string | null;
  readonly sourcePackageName: string | null;
  readonly sourcePackageVersion: string | null;
  readonly outcome: 'established-value' | 'temporary-unavailable';
  readonly advisories: readonly {
    readonly advisoryId: string;
    readonly severity: 'critical' | 'high' | 'low' | 'moderate';
  }[];
}): CandidateAuthorityPartialRuleResult {
  if (
    input.expectedPackageName === null ||
    input.expectedPackageVersion === null
  ) {
    return {
      state: 'unknown',
      reason: 'package-advisory-scope-not-established',
    };
  }
  if (
    input.sourcePackageName !== input.expectedPackageName ||
    input.sourcePackageVersion !== input.expectedPackageVersion
  )
    invalid();
  if (input.outcome === 'temporary-unavailable') {
    return {
      state: 'unknown',
      reason: 'advisory-source-temporarily-unavailable',
    };
  }
  const seen = new Set<string>();
  const facts = input.advisories
    .map((advisory) => {
      const advisoryId = advisory.advisoryId.toUpperCase();
      if (
        !/^GHSA-[23456789CFGHJMPQRVWX]{4}-[23456789CFGHJMPQRVWX]{4}-[23456789CFGHJMPQRVWX]{4}$/u.test(
          advisoryId,
        ) ||
        seen.has(advisoryId)
      )
        invalid();
      seen.add(advisoryId);
      return {
        factCode: 'applicable-security-advisory' as const,
        factValue: canonicalizeJson({
          advisoryId,
          severity: advisory.severity,
        }).text,
      };
    })
    .sort((left, right) => compare(left.factValue, right.factValue));
  return facts.length > 0
    ? { state: 'established-facts', facts }
    : { state: 'unknown', reason: 'applicable-advisory-not-established' };
}

export function extractRecognizedLicenseSpdxFact(input: {
  readonly spdxId: string | null;
  readonly sourceComplete: boolean;
}): CandidateAuthorityPartialRuleResult {
  if (
    !input.sourceComplete ||
    input.spdxId === null ||
    input.spdxId === 'NOASSERTION'
  ) {
    return { state: 'unknown', reason: 'recognized-license-not-established' };
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9.+-]{0,63}$/u.test(input.spdxId)) invalid();
  return {
    state: 'established-facts',
    facts: [{ factCode: 'recognized-license-spdx', factValue: input.spdxId }],
  };
}

export function extractRepositorySelfBuildComposeServiceFacts(input: {
  readonly content: string | null;
  readonly pathOutcome:
    'established-absence' | 'established-value' | 'unavailable';
  readonly contentTreeBlobIdentityVerified: boolean;
}): CandidateAuthorityPartialRuleResult {
  if (
    input.pathOutcome !== 'established-value' ||
    input.content === null ||
    !input.contentTreeBlobIdentityVerified
  ) {
    return {
      state: 'unknown',
      reason:
        input.pathOutcome === 'established-absence'
          ? 'compose-path-absence-is-not-deployment-absence'
          : 'compose-source-not-established',
    };
  }
  if (Buffer.byteLength(input.content, 'utf8') > 262_144) invalid();
  let value: unknown;
  try {
    value = JSON.parse(input.content) as unknown;
  } catch {
    return { state: 'unknown', reason: 'unsupported-compose-json' };
  }
  if (!withinJsonBounds(value, 100_000, 32)) invalid();
  if (!isRecord(value) || !isRecord(value['services'])) {
    return {
      state: 'unknown',
      reason: 'repository-self-build-compose-service-not-established',
    };
  }
  const services = value['services'];
  const serviceNames = Object.keys(services).sort(compare);
  if (
    serviceNames.length < 1 ||
    serviceNames.length > 100 ||
    serviceNames.some(
      (name) => !isServiceName(name) || !isRecord(services[name]),
    )
  ) {
    return {
      state: 'unknown',
      reason: 'repository-self-build-compose-service-not-established',
    };
  }
  const selfBuildServices = serviceNames.filter((name) => {
    const service = services[name];
    if (!isRecord(service)) invalid();
    const build = service['build'];
    return build === '.' || (isRecord(build) && build['context'] === '.');
  });
  return selfBuildServices.length === 0
    ? {
        state: 'unknown',
        reason: 'repository-self-build-compose-service-not-established',
      }
    : {
        state: 'established-facts',
        facts: selfBuildServices.map((factValue) => ({
          factCode: 'repository-self-build-compose-service' as const,
          factValue,
        })),
      };
}

function hasExplicitRootExport(value: unknown): boolean {
  if (isRuntimeEntryPoint(value)) return true;
  if (!isRecord(value)) return false;
  if (Object.hasOwn(value, '.')) return hasExportTarget(value['.']);
  const keys = Object.keys(value);
  return (
    keys.length > 0 &&
    keys.every((key) => !key.startsWith('.')) &&
    hasExportTarget(value)
  );
}

function hasExportTarget(value: unknown): boolean {
  if (isRuntimeEntryPoint(value)) return true;
  if (!isRecord(value)) return false;
  return Object.entries(value).some(
    ([condition, nested]) =>
      RUNTIME_EXPORT_CONDITIONS.has(condition) && hasExportTarget(nested),
  );
}

function isRuntimeEntryPoint(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length >= 1 &&
    value.length <= 512 &&
    !value.includes('\0') &&
    !value.startsWith('/') &&
    !/^[a-z][a-z0-9+.-]*:/iu.test(value) &&
    !/\.d\.(?:c|m)?ts$/iu.test(value)
  );
}

function requirePackageName(value: string): void {
  if (!/^(?:@[-a-z0-9_.]+\/)?[-a-z0-9_.]+$/u.test(value)) invalid();
}

function requireDependencyRange(value: string): void {
  if (value.length < 1 || value.length > 200 || hasControlCharacter(value))
    invalid();
}

function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 31 || code === 127) return true;
  }
  return false;
}

function requirePackageVersion(value: string): void {
  if (
    !/^v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u.test(value)
  )
    invalid();
}

function requireTimestamp(value: string): void {
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/u.test(value) ||
    !Number.isFinite(Date.parse(value))
  )
    invalid();
}

function requireReleaseToken(value: string): void {
  if (
    !/^[A-Za-z0-9][A-Za-z0-9._+/@-]{0,99}$/u.test(value) ||
    /(?:^|[._+/@-])(?:canary|current|head|latest|main|master|next|stable)(?:$|[._+/@-])/iu.test(
      value,
    )
  )
    invalid();
}

function isServiceName(value: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,99}$/u.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function withinJsonBounds(
  root: unknown,
  maximumNodes: number,
  maximumDepth: number,
): boolean {
  const pending: { readonly value: unknown; readonly depth: number }[] = [
    { value: root, depth: 0 },
  ];
  let nodes = 0;
  while (pending.length > 0) {
    const current = pending.pop();
    if (current === undefined) invalid();
    nodes += 1;
    if (nodes > maximumNodes || current.depth > maximumDepth) return false;
    if (Array.isArray(current.value)) {
      for (const value of current.value) {
        pending.push({ value, depth: current.depth + 1 });
      }
    } else if (isRecord(current.value)) {
      for (const value of Object.values(current.value)) {
        pending.push({ value, depth: current.depth + 1 });
      }
    }
  }
  return true;
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function invalid(): never {
  throw ingestionError('ingestion.invalid-input');
}
