import { ingestionError } from './errors.ts';

export type CandidateAuthorityPartialRuleResult =
  | {
      readonly state: 'established-facts';
      readonly facts: readonly {
        readonly factCode:
          | 'compose-service-declaration'
          | 'declared-datastore-runtime-dependency'
          | 'declared-framework-compatibility-dependency'
          | 'npm-package-ecosystem'
          | 'published-installable-package';
        readonly factValue: string;
      }[];
    }
  | { readonly state: 'unknown'; readonly reason: string };

const FRAMEWORK_DEPENDENCIES = Object.freeze({
  '@nestjs/core': 'nestjs',
  express: 'express',
  fastify: 'fastify',
  next: 'nextjs',
} as const);
const DATASTORE_DEPENDENCIES = Object.freeze({
  '@aws-sdk/client-dynamodb': 'dynamodb',
  '@aws-sdk/lib-dynamodb': 'dynamodb',
  'better-sqlite3': 'sqlite',
  ioredis: 'redis',
  mongodb: 'mongodb',
  mysql: 'mysql',
  mysql2: 'mysql',
  pg: 'postgresql',
  postgres: 'postgresql',
  redis: 'redis',
  sqlite3: 'sqlite',
} as const);

export function extractPublishedPackageAdoptionFact(input: {
  readonly catalogPackageName: string | null;
  readonly sourcePackageName: string | null;
  readonly selectedVersion: string | null;
  readonly sourceComplete: boolean;
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
  requirePackageVersion(input.selectedVersion);
  return {
    state: 'established-facts',
    facts: [
      {
        factCode: 'published-installable-package',
        factValue: `${input.sourcePackageName}@${input.selectedVersion}`,
      },
    ],
  };
}

export function extractPackageEcosystemFact(input: {
  readonly packageName: string | null;
  readonly selectedVersion: string | null;
  readonly sourceComplete: boolean;
}): CandidateAuthorityPartialRuleResult {
  if (
    input.packageName === null ||
    input.selectedVersion === null ||
    !input.sourceComplete
  ) {
    return { state: 'unknown', reason: 'npm-ecosystem-not-established' };
  }
  requirePackageVersion(input.selectedVersion);
  return {
    state: 'established-facts',
    facts: [
      {
        factCode: 'npm-package-ecosystem',
        factValue: `${input.packageName}@${input.selectedVersion}`,
      },
    ],
  };
}

export function extractPackageDependencyFacts(input: {
  readonly dependencies: Readonly<Record<string, string>> | null;
  readonly peerDependencies: Readonly<Record<string, string>> | null;
  readonly sourceComplete: boolean;
}): CandidateAuthorityPartialRuleResult {
  if (!input.sourceComplete) {
    return { state: 'unknown', reason: 'package-dependency-source-incomplete' };
  }
  const facts = [
    ...dependencyFacts(
      input.dependencies,
      FRAMEWORK_DEPENDENCIES,
      'declared-framework-compatibility-dependency',
    ),
    ...dependencyFacts(
      input.peerDependencies,
      FRAMEWORK_DEPENDENCIES,
      'declared-framework-compatibility-dependency',
    ),
    ...dependencyFacts(
      input.dependencies,
      DATASTORE_DEPENDENCIES,
      'declared-datastore-runtime-dependency',
    ),
  ].sort((left, right) =>
    left.factCode === right.factCode
      ? compare(left.factValue, right.factValue)
      : compare(left.factCode, right.factCode),
  );
  const unique = facts.filter((fact, index) => {
    const previous = index === 0 ? undefined : facts[index - 1];
    return (
      fact.factCode !== previous?.factCode ||
      fact.factValue !== previous.factValue
    );
  });
  return unique.length === 0
    ? { state: 'unknown', reason: 'no-controlled-positive-dependency-fact' }
    : { state: 'established-facts', facts: unique };
}

export function extractComposeServiceFact(input: {
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
    return { state: 'unknown', reason: 'compose-services-not-established' };
  }
  const services = value['services'];
  const serviceNames = Object.keys(services).sort(compare);
  if (
    serviceNames.length < 1 ||
    serviceNames.length > 100 ||
    serviceNames.some(
      (name) =>
        !/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,99}$/u.test(name) ||
        !isRecord(services[name]),
    )
  ) {
    return { state: 'unknown', reason: 'compose-services-not-established' };
  }
  return {
    state: 'established-facts',
    facts: [
      {
        factCode: 'compose-service-declaration',
        factValue: serviceNames.join(','),
      },
    ],
  };
}

function dependencyFacts(
  dependencies: Readonly<Record<string, string>> | null,
  mapping: Readonly<Record<string, string>>,
  factCode:
    | 'declared-datastore-runtime-dependency'
    | 'declared-framework-compatibility-dependency',
): {
  readonly factCode:
    | 'declared-datastore-runtime-dependency'
    | 'declared-framework-compatibility-dependency';
  readonly factValue: string;
}[] {
  if (dependencies === null) return [];
  return Object.entries(dependencies).flatMap(([name, range]) => {
    if (
      !/^(?:@[-a-z0-9_.]+\/)?[-a-z0-9_.]+$/u.test(name) ||
      range.length < 1 ||
      range.length > 200
    )
      invalid();
    const mapped = mapping[name];
    return mapped === undefined
      ? []
      : [{ factCode, factValue: `${mapped}:${name}@${range}` }];
  });
}

function requirePackageVersion(value: string): void {
  if (
    !/^v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u.test(value)
  )
    invalid();
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
