/* eslint-disable @typescript-eslint/no-unnecessary-condition -- Trust-boundary validation intentionally rechecks literal policy fields at runtime. */

import type { DeterministicProfileFieldId } from '@gitblocks/contracts';

import { canonicalizeJson } from './canonical-json.ts';
import {
  PROFILE_MATERIALIZATION_ACCEPTED_BINDINGS,
  PROFILE_MATERIALIZATION_AUTHORIZED_FIELD_IDS,
  PROFILE_MATERIALIZATION_OPERATIONS,
  PROFILE_MATERIALIZATION_PROVIDER_POLICY_VERSION,
  requireExactKeys,
  requireRecord,
  type ProfileMaterializationOperation,
  type ProfileMaterializationProviderOperationPolicy,
  type ProfileMaterializationProviderPolicy,
  type ProfileMaterializationRequestBudget,
  type ProfileMaterializationSourceType,
} from './profile-materialization-contracts.ts';
import { ingestionError } from './errors.ts';
import type { PublicCatalog } from './types.ts';

export const PROFILE_MATERIALIZATION_PROVIDER_POLICY_PATH =
  'catalog/public-v1/profile-materialization-provider-policy.json' as const;

const EXPECTED_OPERATION_SOURCE: Readonly<
  Record<ProfileMaterializationOperation, ProfileMaterializationSourceType>
> = {
  'github-advisory': 'github-advisory',
  'github-allowlisted-file': 'github-file',
  'github-community-profile': 'github-community',
  'github-default-branch-head': 'github-head-commit',
  'github-license': 'github-license',
  'github-release': 'github-release',
  'github-repository-metadata': 'github-repository',
  'github-tag': 'github-tag',
  'npm-package': 'npm-package',
};

const EXPECTED_ENDPOINTS: Readonly<
  Record<ProfileMaterializationOperation, string>
> = {
  'github-advisory':
    '/advisories?type=reviewed&ecosystem=npm&affects={packageName}@{selectedVersion}&sort=updated&direction=asc&per_page=100',
  'github-allowlisted-file':
    '/repos/{owner}/{repository}/contents/{allowlistedPath}?ref={headCommit}',
  'github-community-profile': '/repos/{owner}/{repository}/community/profile',
  'github-default-branch-head':
    '/repos/{owner}/{repository}/commits/{defaultBranch}',
  'github-license': '/repos/{owner}/{repository}/license?ref={headCommit}',
  'github-release': '/repos/{owner}/{repository}/releases?per_page=5&page=1',
  'github-repository-metadata': '/repos/{owner}/{repository}',
  'github-tag': '/repos/{owner}/{repository}/tags?per_page=5&page=1',
  'npm-package': '/{packageName}',
};

const OPERATION_KEYS = [
  'authentication',
  'candidateDeadlineMilliseconds',
  'concurrency',
  'controlledAbsence',
  'endpointTemplate',
  'fatalErrorCodes',
  'host',
  'maximumAttempts',
  'maximumJsonNodes',
  'maximumRedirects',
  'maximumRequestsPerCandidate',
  'maximumResponseBytes',
  'method',
  'operation',
  'profileFields',
  'provider',
  'purpose',
  'requestTimeoutMilliseconds',
  'retainedStructuredProperties',
  'runDeadlineMilliseconds',
  'sourceMutability',
  'sourceType',
  'temporaryUnavailability',
] as const;

export function parseProfileMaterializationProviderPolicy(
  catalog: PublicCatalog,
  supplied: unknown,
): ProfileMaterializationProviderPolicy {
  return validateProfileMaterializationProviderPolicy(supplied, catalog);
}

export function validateProfileMaterializationProviderPolicy(
  value: unknown,
  catalog: PublicCatalog,
): ProfileMaterializationProviderPolicy {
  const policy = requireRecord(value);
  requireExactKeys(policy, [
    'catalogBinding',
    'maximumRequestBudget',
    'operations',
    'policySemanticDigest',
    'policyVersion',
    'transport',
  ]);
  const catalogBinding = requireRecord(policy['catalogBinding']);
  requireExactKeys(catalogBinding, ['catalogDigest', 'catalogVersion']);
  const transport = requireRecord(policy['transport']);
  requireExactKeys(transport, [
    'allowedHosts',
    'cache',
    'cancellation',
    'effectivePort',
    'methods',
    'redirectPolicy',
    'retryPolicy',
    'scheme',
  ]);
  const budget = parseBudget(policy['maximumRequestBudget']);
  if (!Array.isArray(policy['operations'])) {
    throw ingestionError('ingestion.invalid-manifest');
  }
  const operations = policy['operations'].map(parseOperation);
  const candidate = {
    policyVersion: policy['policyVersion'],
    catalogBinding,
    transport,
    maximumRequestBudget: budget,
    operations,
    policySemanticDigest: policy['policySemanticDigest'],
  } as unknown as ProfileMaterializationProviderPolicy;
  if (
    candidate.policyVersion !==
      PROFILE_MATERIALIZATION_PROVIDER_POLICY_VERSION ||
    candidate.catalogBinding.catalogVersion !== catalog.catalogVersion ||
    candidate.catalogBinding.catalogDigest !== catalog.manifestDigest ||
    candidate.transport.scheme !== 'https' ||
    candidate.transport.effectivePort !== 443 ||
    canonicalizeJson(candidate.transport.methods).text !== '["GET"]' ||
    canonicalizeJson(candidate.transport.allowedHosts).text !==
      '["api.github.com","registry.npmjs.org"]' ||
    candidate.transport.redirectPolicy !== 'manual-same-host' ||
    candidate.transport.retryPolicy !== 'existing-bounded-deterministic' ||
    candidate.transport.cache !== 'none' ||
    candidate.transport.cancellation !== 'abort-signal' ||
    operations.length !== PROFILE_MATERIALIZATION_OPERATIONS.length ||
    operations.some(
      (operation, index) =>
        operation.operation !== PROFILE_MATERIALIZATION_OPERATIONS[index],
    ) ||
    canonicalizeJson(
      deriveProfileMaterializationRequestBudget(catalog, candidate),
    ).text !== canonicalizeJson(candidate.maximumRequestBudget).text ||
    candidate.policySemanticDigest !==
      PROFILE_MATERIALIZATION_ACCEPTED_BINDINGS.providerPolicyDigest
  ) {
    throw ingestionError('ingestion.invalid-manifest');
  }
  const withoutDigest = { ...candidate } as Record<string, unknown>;
  delete withoutDigest['policySemanticDigest'];
  if (
    canonicalizeJson(withoutDigest).digest !== candidate.policySemanticDigest
  ) {
    throw ingestionError('ingestion.invalid-manifest');
  }
  return deepFreeze(candidate);
}

export function deriveProfileMaterializationRequestBudget(
  catalog: PublicCatalog,
  policy: Pick<ProfileMaterializationProviderPolicy, 'operations'>,
): ProfileMaterializationRequestBudget {
  const byOperation = new Map(
    policy.operations.map((operation) => [operation.operation, operation]),
  );
  let github = 0;
  let npm = 0;
  const add = (
    operation: ProfileMaterializationOperation,
    count: number,
  ): void => {
    const record = byOperation.get(operation);
    if (record === undefined) {
      throw ingestionError('ingestion.invalid-manifest');
    }
    const requests = count * record.maximumRequestsPerCandidate;
    if (record.provider === 'github') github += requests;
    else npm += requests;
  };
  for (const candidate of catalog.candidates) {
    const expected = new Set(candidate.expectedSourceTypes);
    add('github-repository-metadata', 1);
    add('github-default-branch-head', 1);
    if (expected.has('github-release')) add('github-release', 1);
    if (expected.has('github-tag')) add('github-tag', 1);
    if (expected.has('github-license')) add('github-license', 1);
    if (expected.has('github-community')) {
      add('github-community-profile', 1);
    }
    if (expected.has('github-file')) {
      add('github-allowlisted-file', candidate.allowlistedFiles.length);
    }
    if (expected.has('npm-package')) add('npm-package', 1);
    if (expected.has('github-advisory')) add('github-advisory', 1);
  }
  return { github, npm, total: github + npm };
}

export function operationPolicy(
  policy: ProfileMaterializationProviderPolicy,
  operation: ProfileMaterializationOperation,
): ProfileMaterializationProviderOperationPolicy {
  const result = policy.operations.find(
    (entry) => entry.operation === operation,
  );
  if (result === undefined) throw ingestionError('ingestion.invalid-manifest');
  return result;
}

function parseOperation(
  value: unknown,
): ProfileMaterializationProviderOperationPolicy {
  const operation = requireRecord(value);
  requireExactKeys(operation, OPERATION_KEYS);
  const operationName = operation['operation'];
  if (
    typeof operationName !== 'string' ||
    !PROFILE_MATERIALIZATION_OPERATIONS.includes(
      operationName as ProfileMaterializationOperation,
    )
  ) {
    throw ingestionError('ingestion.invalid-manifest');
  }
  const name = operationName as ProfileMaterializationOperation;
  const sourceType = operation['sourceType'];
  const provider = operation['provider'];
  const host = operation['host'];
  const profileFields = parseStringArray(operation['profileFields'], 10);
  const retained = parseStringArray(
    operation['retainedStructuredProperties'],
    32,
  );
  const fatalCodes = parseStringArray(operation['fatalErrorCodes'], 32);
  const expectedProvider = name === 'npm-package' ? 'npm' : 'github';
  const expectedHost =
    expectedProvider === 'npm' ? 'registry.npmjs.org' : 'api.github.com';
  if (
    sourceType !== EXPECTED_OPERATION_SOURCE[name] ||
    provider !== expectedProvider ||
    host !== expectedHost ||
    operation['method'] !== 'GET' ||
    operation['endpointTemplate'] !== EXPECTED_ENDPOINTS[name] ||
    operation['maximumRedirects'] !== 2 ||
    operation['requestTimeoutMilliseconds'] !== 10_000 ||
    operation['candidateDeadlineMilliseconds'] !== 90_000 ||
    operation['runDeadlineMilliseconds'] !== 3_600_000 ||
    operation['maximumAttempts'] !== 3 ||
    operation['concurrency'] !== 3 ||
    operation['authentication'] !==
      (expectedProvider === 'github' ? 'required' : 'none') ||
    !['immutable', 'mutable'].includes(String(operation['sourceMutability'])) ||
    !['established-absence', 'fatal'].includes(
      String(operation['controlledAbsence']),
    ) ||
    !['fatal', 'qualified-unknown'].includes(
      String(operation['temporaryUnavailability']),
    ) ||
    !['persistence-audit-only', 'profile-input'].includes(
      String(operation['purpose']),
    ) ||
    !Number.isInteger(operation['maximumResponseBytes']) ||
    Number(operation['maximumResponseBytes']) < 1 ||
    Number(operation['maximumResponseBytes']) > 16 * 1_024 * 1_024 ||
    !Number.isInteger(operation['maximumJsonNodes']) ||
    Number(operation['maximumJsonNodes']) < 1 ||
    Number(operation['maximumJsonNodes']) > 500_000 ||
    ![1, 2].includes(Number(operation['maximumRequestsPerCandidate'])) ||
    (name === 'github-advisory'
      ? operation['maximumRequestsPerCandidate'] !== 2
      : operation['maximumRequestsPerCandidate'] !== 1) ||
    profileFields.some(
      (field) =>
        !PROFILE_MATERIALIZATION_AUTHORIZED_FIELD_IDS.includes(
          field as ProfileMaterializationAuthorizedFieldId,
        ),
    ) ||
    (operation['purpose'] === 'persistence-audit-only' &&
      profileFields.length !== 0) ||
    retained.length === 0 ||
    fatalCodes.length === 0
  ) {
    throw ingestionError('ingestion.invalid-manifest');
  }
  return {
    ...(operation as unknown as ProfileMaterializationProviderOperationPolicy),
    profileFields:
      profileFields as DeterministicProfileFieldId[] as readonly ProfileMaterializationAuthorizedFieldId[],
    retainedStructuredProperties: retained,
    fatalErrorCodes: fatalCodes,
  };
}

function parseBudget(value: unknown): ProfileMaterializationRequestBudget {
  const budget = requireRecord(value);
  requireExactKeys(budget, ['github', 'npm', 'total']);
  const github = budget['github'];
  const npm = budget['npm'];
  const total = budget['total'];
  if (
    typeof github !== 'number' ||
    typeof npm !== 'number' ||
    typeof total !== 'number' ||
    !Number.isInteger(github) ||
    !Number.isInteger(npm) ||
    !Number.isInteger(total) ||
    github < 1 ||
    npm < 1 ||
    total !== github + npm
  ) {
    throw ingestionError('ingestion.invalid-manifest');
  }
  return { github, npm, total };
}

function parseStringArray(value: unknown, maximum: number): readonly string[] {
  if (
    !Array.isArray(value) ||
    value.length > maximum ||
    value.some(
      (entry) =>
        typeof entry !== 'string' || entry.length < 1 || entry.length > 200,
    ) ||
    value.some((entry, index) => index > 0 && entry <= value[index - 1])
  ) {
    throw ingestionError('ingestion.invalid-manifest');
  }
  return value.map((entry) => {
    if (typeof entry !== 'string') {
      throw ingestionError('ingestion.invalid-manifest');
    }
    return entry;
  });
}

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) deepFreeze(nested);
  }
  return value;
}

type ProfileMaterializationAuthorizedFieldId =
  (typeof PROFILE_MATERIALIZATION_AUTHORIZED_FIELD_IDS)[number];
