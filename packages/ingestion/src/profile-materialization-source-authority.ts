/* eslint-disable @typescript-eslint/no-unnecessary-condition -- Trust-boundary validation intentionally rechecks literal authority fields at runtime. */

import type { CapabilityTaxonomyV1 } from '@gitblocks/contracts';

import { canonicalizeJson } from './canonical-json.ts';
import { ingestionError } from './errors.ts';
import {
  PROFILE_MATERIALIZATION_ACCEPTED_BINDINGS,
  PROFILE_MATERIALIZATION_OPERATIONS,
  PROFILE_MATERIALIZATION_SOURCE_AUTHORITY_VERSION,
  PROFILE_MATERIALIZATION_SOURCE_TYPES,
  compareText,
  isDigest,
  isSafeCode,
  requireExactKeys,
  requireRecord,
  type ProfileMaterializationCandidateSourceRecord,
  type ProfileMaterializationOperation,
  type ProfileMaterializationProviderPolicy,
  type ProfileMaterializationSourceAuthority,
  type ProfileMaterializationSourceMutability,
  type ProfileMaterializationSourceOutcome,
  type ProfileMaterializationSourceRecord,
  type ProfileMaterializationSourceType,
} from './profile-materialization-contracts.ts';
import type { PublicCatalog } from './types.ts';

export interface ProfileMaterializationSourceRecordInput {
  readonly candidateId: string;
  readonly sourceType: ProfileMaterializationSourceType;
  readonly operation: ProfileMaterializationOperation;
  readonly logicalSourceKey: string;
  readonly sourceMutability: ProfileMaterializationSourceMutability;
  readonly outcome: ProfileMaterializationSourceOutcome;
  readonly immutableReference: string | null;
  readonly collectedAt: string;
  readonly normalizedValue: unknown;
  readonly controlledCode: string | null;
  readonly evidenceIds?: readonly string[];
}

export interface CreateProfileMaterializationSourceAuthorityInput {
  readonly policy: ProfileMaterializationProviderPolicy;
  readonly catalog: PublicCatalog;
  readonly taxonomy: CapabilityTaxonomyV1;
  readonly sourceRecords: readonly ProfileMaterializationSourceRecordInput[];
}

const RECORD_KEYS = [
  'candidateId',
  'collectedAt',
  'controlledCode',
  'evidenceIds',
  'immutableReference',
  'logicalSourceIdentityDigest',
  'logicalSourceKey',
  'normalizedValue',
  'operation',
  'outcome',
  'sourceMutability',
  'sourceRecordDigest',
  'sourceType',
] as const;

export function createProfileMaterializationSourceRecord(
  input: ProfileMaterializationSourceRecordInput,
): ProfileMaterializationSourceRecord {
  validateRecordInput(input);
  const evidenceIds = [...(input.evidenceIds ?? [])].sort(compareText);
  if (new Set(evidenceIds).size !== evidenceIds.length) {
    throw ingestionError('ingestion.invalid-input');
  }
  const logicalSourceIdentityDigest = canonicalizeJson({
    candidateId: input.candidateId,
    operation: input.operation,
    sourceType: input.sourceType,
    logicalSourceKey: input.logicalSourceKey,
  }).digest;
  const withoutRecordDigest = {
    candidateId: input.candidateId,
    sourceType: input.sourceType,
    operation: input.operation,
    logicalSourceKey: input.logicalSourceKey,
    logicalSourceIdentityDigest,
    sourceMutability: input.sourceMutability,
    outcome: input.outcome,
    immutableReference: input.immutableReference,
    collectedAt: input.collectedAt,
    normalizedValue: copyJson(input.normalizedValue),
    controlledCode: input.controlledCode,
    evidenceIds,
  };
  return deepFreeze({
    ...withoutRecordDigest,
    sourceRecordDigest: canonicalizeJson(withoutRecordDigest).digest,
  });
}

export function createProfileMaterializationSourceAuthority(
  input: CreateProfileMaterializationSourceAuthorityInput,
): ProfileMaterializationSourceAuthority {
  if (
    input.catalog.candidates.length !== 150 ||
    input.taxonomy.taxonomyVersion !== '1.0.0' ||
    input.catalog.manifestDigest !==
      PROFILE_MATERIALIZATION_ACCEPTED_BINDINGS.catalogDigest ||
    input.taxonomy.semanticDigest !==
      PROFILE_MATERIALIZATION_ACCEPTED_BINDINGS.taxonomyDigest ||
    input.policy.policySemanticDigest !==
      PROFILE_MATERIALIZATION_ACCEPTED_BINDINGS.providerPolicyDigest ||
    input.policy.catalogBinding.catalogDigest !== input.catalog.manifestDigest
  ) {
    throw ingestionError('ingestion.invalid-manifest');
  }
  const records = input.sourceRecords
    .map(createProfileMaterializationSourceRecord)
    .sort(compareRecord);
  validateRecordClosure(records, input.catalog, input.policy);
  const candidates = [...input.catalog.candidates]
    .sort((left, right) => compareText(left.candidateId, right.candidateId))
    .map<ProfileMaterializationCandidateSourceRecord>((candidate) => ({
      candidateId: candidate.candidateId,
      sourceRecordDigests: records
        .filter((record) => record.candidateId === candidate.candidateId)
        .map((record) => record.sourceRecordDigest)
        .sort(compareText),
    }));
  const withoutDigest = {
    authorityVersion: PROFILE_MATERIALIZATION_SOURCE_AUTHORITY_VERSION,
    providerPolicyVersion: input.policy.policyVersion,
    providerPolicyDigest: input.policy.policySemanticDigest,
    catalogVersion: input.catalog.catalogVersion,
    catalogDigest: input.catalog.manifestDigest,
    taxonomyVersion: input.taxonomy.taxonomyVersion as '1.0.0',
    taxonomyDigest: input.taxonomy.semanticDigest,
    candidateCount: 150 as const,
    candidates,
    sourceRecords: records,
  };
  return deepFreeze({
    ...withoutDigest,
    authoritySemanticDigest: canonicalizeJson(withoutDigest).digest,
  });
}

export function parseProfileMaterializationSourceAuthority(
  value: unknown,
  bindings?: {
    readonly policy: ProfileMaterializationProviderPolicy;
    readonly catalog: PublicCatalog;
    readonly taxonomy: CapabilityTaxonomyV1;
  },
): ProfileMaterializationSourceAuthority {
  const authority = requireRecord(value);
  requireExactKeys(authority, [
    'authoritySemanticDigest',
    'authorityVersion',
    'candidateCount',
    'candidates',
    'catalogDigest',
    'catalogVersion',
    'providerPolicyDigest',
    'providerPolicyVersion',
    'sourceRecords',
    'taxonomyDigest',
    'taxonomyVersion',
  ]);
  if (
    authority['authorityVersion'] !==
      PROFILE_MATERIALIZATION_SOURCE_AUTHORITY_VERSION ||
    authority['candidateCount'] !== 150 ||
    authority['catalogVersion'] !== 'public-v1' ||
    authority['taxonomyVersion'] !== '1.0.0' ||
    authority['providerPolicyDigest'] !==
      PROFILE_MATERIALIZATION_ACCEPTED_BINDINGS.providerPolicyDigest ||
    authority['catalogDigest'] !==
      PROFILE_MATERIALIZATION_ACCEPTED_BINDINGS.catalogDigest ||
    authority['taxonomyDigest'] !==
      PROFILE_MATERIALIZATION_ACCEPTED_BINDINGS.taxonomyDigest ||
    !isDigest(authority['providerPolicyDigest']) ||
    !isDigest(authority['catalogDigest']) ||
    !isDigest(authority['taxonomyDigest']) ||
    !isDigest(authority['authoritySemanticDigest']) ||
    !Array.isArray(authority['candidates']) ||
    !Array.isArray(authority['sourceRecords'])
  ) {
    throw ingestionError('ingestion.invalid-manifest');
  }
  const records = authority['sourceRecords'].map(parseSourceRecord);
  const candidates = authority['candidates'].map(parseCandidateRecord);
  const parsed = {
    ...authority,
    candidates,
    sourceRecords: records,
  } as unknown as ProfileMaterializationSourceAuthority;
  if (
    candidates.length !== 150 ||
    candidates.some((entry, index) => {
      if (index === 0) return false;
      const previous = candidates[index - 1];
      return (
        previous === undefined || entry.candidateId <= previous.candidateId
      );
    }) ||
    records.some((entry, index) => {
      if (index === 0) return false;
      const previous = records[index - 1];
      return previous === undefined || compareRecord(previous, entry) >= 0;
    })
  ) {
    throw ingestionError('ingestion.invalid-manifest');
  }
  const recordSet = new Set(records.map((record) => record.sourceRecordDigest));
  if (
    recordSet.size !== records.length ||
    candidates.some((candidate) =>
      candidate.sourceRecordDigests.some((digest) => !recordSet.has(digest)),
    ) ||
    records.some(
      (record) =>
        !candidates
          .find((candidate) => candidate.candidateId === record.candidateId)
          ?.sourceRecordDigests.includes(record.sourceRecordDigest),
    )
  ) {
    throw ingestionError('ingestion.invalid-manifest');
  }
  const withoutDigest = { ...parsed } as Record<string, unknown>;
  delete withoutDigest['authoritySemanticDigest'];
  if (
    canonicalizeJson(withoutDigest).digest !== parsed.authoritySemanticDigest
  ) {
    throw ingestionError('ingestion.invalid-manifest');
  }
  if (bindings !== undefined) {
    if (
      parsed.providerPolicyVersion !== bindings.policy.policyVersion ||
      parsed.providerPolicyDigest !== bindings.policy.policySemanticDigest ||
      parsed.catalogDigest !== bindings.catalog.manifestDigest ||
      parsed.taxonomyDigest !== bindings.taxonomy.semanticDigest
    ) {
      throw ingestionError('ingestion.invalid-manifest');
    }
    validateRecordClosure(records, bindings.catalog, bindings.policy);
    const expectedCandidates = [...bindings.catalog.candidates]
      .map((candidate) => candidate.candidateId)
      .sort(compareText);
    if (
      canonicalizeJson(candidates.map((candidate) => candidate.candidateId))
        .text !== canonicalizeJson(expectedCandidates).text
    ) {
      throw ingestionError('ingestion.invalid-manifest');
    }
  }
  return deepFreeze(parsed);
}

export function sourceAuthoritySemanticDigest(
  authority: ProfileMaterializationSourceAuthority,
): string {
  return parseProfileMaterializationSourceAuthority(authority)
    .authoritySemanticDigest;
}

function parseCandidateRecord(
  value: unknown,
): ProfileMaterializationCandidateSourceRecord {
  const candidate = requireRecord(value);
  requireExactKeys(candidate, ['candidateId', 'sourceRecordDigests']);
  if (
    !isStableId(candidate['candidateId']) ||
    !Array.isArray(candidate['sourceRecordDigests']) ||
    candidate['sourceRecordDigests'].some((digest) => !isDigest(digest)) ||
    candidate['sourceRecordDigests'].some(
      (digest, index, all) => index > 0 && digest <= all[index - 1],
    )
  ) {
    throw ingestionError('ingestion.invalid-manifest');
  }
  return candidate as unknown as ProfileMaterializationCandidateSourceRecord;
}

function parseSourceRecord(value: unknown): ProfileMaterializationSourceRecord {
  const record = requireRecord(value);
  requireExactKeys(record, RECORD_KEYS);
  const input = {
    candidateId: record['candidateId'],
    sourceType: record['sourceType'],
    operation: record['operation'],
    logicalSourceKey: record['logicalSourceKey'],
    sourceMutability: record['sourceMutability'],
    outcome: record['outcome'],
    immutableReference: record['immutableReference'],
    collectedAt: record['collectedAt'],
    normalizedValue: record['normalizedValue'],
    controlledCode: record['controlledCode'],
    evidenceIds: record['evidenceIds'],
  } as ProfileMaterializationSourceRecordInput;
  const rebuilt = createProfileMaterializationSourceRecord(input);
  if (
    rebuilt.logicalSourceIdentityDigest !==
      record['logicalSourceIdentityDigest'] ||
    rebuilt.sourceRecordDigest !== record['sourceRecordDigest'] ||
    canonicalizeJson(rebuilt).text !== canonicalizeJson(record).text
  ) {
    throw ingestionError('ingestion.invalid-manifest');
  }
  return rebuilt;
}

function validateRecordInput(
  input: ProfileMaterializationSourceRecordInput,
): void {
  if (
    !isStableId(input.candidateId) ||
    !PROFILE_MATERIALIZATION_SOURCE_TYPES.includes(input.sourceType) ||
    !PROFILE_MATERIALIZATION_OPERATIONS.includes(input.operation) ||
    !isLogicalKey(input.logicalSourceKey) ||
    !['immutable', 'mutable'].includes(input.sourceMutability) ||
    ![
      'established-value',
      'established-absence',
      'unavailable',
      'fatal',
    ].includes(input.outcome) ||
    (input.immutableReference !== null &&
      !isBoundedString(input.immutableReference, 300)) ||
    !isTimestamp(input.collectedAt) ||
    (input.controlledCode !== null && !isSafeCode(input.controlledCode)) ||
    !Array.isArray(input.evidenceIds ?? []) ||
    (input.evidenceIds ?? []).length > 64 ||
    (input.evidenceIds ?? []).some((entry) => !isStableId(entry)) ||
    (input.outcome === 'established-value') !==
      (input.normalizedValue !== null) ||
    (input.outcome === 'established-value' && input.controlledCode !== null) ||
    (input.outcome !== 'established-value' && input.controlledCode === null)
  ) {
    throw ingestionError('ingestion.invalid-input');
  }
  if (input.normalizedValue !== null) {
    validateNormalizedValue(input.operation, input.normalizedValue);
  }
}

function validateRecordClosure(
  records: readonly ProfileMaterializationSourceRecord[],
  catalog: PublicCatalog,
  policy: ProfileMaterializationProviderPolicy,
): void {
  const candidates = new Map(
    catalog.candidates.map((candidate) => [candidate.candidateId, candidate]),
  );
  const operationPolicies = new Map(
    policy.operations.map((operation) => [operation.operation, operation]),
  );
  const expectedLogical = new Set<string>();
  for (const candidate of catalog.candidates) {
    const operations: readonly (readonly [
      ProfileMaterializationOperation,
      string,
    ])[] = [
      ['github-repository-metadata', 'singleton'],
      ['github-default-branch-head', 'singleton'],
      ...(candidate.expectedSourceTypes.includes('github-release')
        ? ([['github-release', 'singleton']] as const)
        : []),
      ...(candidate.expectedSourceTypes.includes('github-tag')
        ? ([['github-tag', 'singleton']] as const)
        : []),
      ...(candidate.expectedSourceTypes.includes('github-license')
        ? ([['github-license', 'singleton']] as const)
        : []),
      ...(candidate.expectedSourceTypes.includes('github-community')
        ? ([['github-community-profile', 'singleton']] as const)
        : []),
      ...(candidate.expectedSourceTypes.includes('github-file')
        ? candidate.allowlistedFiles.map(
            (path) => ['github-allowlisted-file', path] as const,
          )
        : []),
      ...(candidate.expectedSourceTypes.includes('npm-package')
        ? ([['npm-package', 'singleton']] as const)
        : []),
      ...(candidate.expectedSourceTypes.includes('github-advisory')
        ? ([['github-advisory', 'singleton']] as const)
        : []),
    ];
    for (const [operation, key] of operations) {
      expectedLogical.add(
        `${candidate.candidateId}\u0000${operation}\u0000${key}`,
      );
    }
  }
  const actualLogical = new Set<string>();
  for (const record of records) {
    const candidate = candidates.get(record.candidateId);
    const operation = operationPolicies.get(record.operation);
    const key = `${record.candidateId}\u0000${record.operation}\u0000${record.logicalSourceKey}`;
    if (
      candidate === undefined ||
      operation?.sourceType !== record.sourceType ||
      operation.sourceMutability !== record.sourceMutability ||
      actualLogical.has(key) ||
      (record.outcome === 'established-absence' &&
        operation.controlledAbsence !== 'established-absence') ||
      (record.outcome === 'unavailable' &&
        operation.temporaryUnavailability !== 'qualified-unknown') ||
      record.outcome === 'fatal'
    ) {
      throw ingestionError('ingestion.invalid-manifest');
    }
    actualLogical.add(key);
  }
  if (
    expectedLogical.size !== actualLogical.size ||
    [...expectedLogical].some((key) => !actualLogical.has(key))
  ) {
    throw ingestionError('ingestion.invalid-manifest');
  }
  validateCandidateSourceRelationships(records, catalog);
}

function validateCandidateSourceRelationships(
  records: readonly ProfileMaterializationSourceRecord[],
  catalog: PublicCatalog,
): void {
  for (const candidate of catalog.candidates) {
    const candidateRecords = records.filter(
      (record) => record.candidateId === candidate.candidateId,
    );
    const repositoryRecord = requireEstablishedRecord(
      candidateRecords,
      'github-repository-metadata',
    );
    const repository = requireRecord(repositoryRecord.normalizedValue);
    const canonicalIdentity = `${String(repository['canonicalOwner'])}/${String(repository['canonicalRepository'])}`;
    const catalogIdentity = `${candidate.github.owner}/${candidate.github.repository}`;
    const headRecord = requireEstablishedRecord(
      candidateRecords,
      'github-default-branch-head',
    );
    const head = requireRecord(headRecord.normalizedValue);
    const headSha = head['sha'];
    if (
      repository['isPublic'] !== true ||
      (candidate.status !== 'moved' &&
        canonicalIdentity.toLowerCase() !== catalogIdentity.toLowerCase()) ||
      (repository['isFork'] === false &&
        repository['upstreamRepository'] !== null) ||
      typeof headSha !== 'string' ||
      headRecord.immutableReference !== headSha
    ) {
      throw ingestionError('ingestion.invalid-manifest');
    }
    for (const record of candidateRecords.filter((entry) =>
      ['github-allowlisted-file', 'github-license'].includes(entry.operation),
    )) {
      const expectedReference =
        record.operation === 'github-allowlisted-file'
          ? `${headSha}:${record.logicalSourceKey}`
          : headSha;
      if (record.immutableReference !== expectedReference) {
        throw ingestionError('ingestion.invalid-manifest');
      }
    }
    const npmRecord = candidateRecords.find(
      (record) => record.operation === 'npm-package',
    );
    if (candidate.npmPackage === null) {
      if (npmRecord !== undefined) {
        throw ingestionError('ingestion.invalid-manifest');
      }
      continue;
    }
    if (npmRecord?.outcome !== 'established-value') {
      throw ingestionError('ingestion.invalid-manifest');
    }
    const npm = requireRecord(npmRecord.normalizedValue);
    const packageName = npm['name'];
    const packageVersion = npm['selectedVersion'];
    if (
      typeof packageName !== 'string' ||
      packageName.toLowerCase() !== candidate.npmPackage.toLowerCase() ||
      typeof packageVersion !== 'string' ||
      npmRecord.immutableReference !== `${packageName}@${packageVersion}`
    ) {
      throw ingestionError('ingestion.invalid-manifest');
    }
    const advisoryRecord = candidateRecords.find(
      (record) => record.operation === 'github-advisory',
    );
    if (advisoryRecord?.outcome === 'established-value') {
      const advisory = requireRecord(advisoryRecord.normalizedValue);
      if (
        advisory['packageName'] !== packageName ||
        advisory['packageVersion'] !== packageVersion
      ) {
        throw ingestionError('ingestion.invalid-manifest');
      }
    }
  }
}

function requireEstablishedRecord(
  records: readonly ProfileMaterializationSourceRecord[],
  operation: ProfileMaterializationOperation,
): ProfileMaterializationSourceRecord {
  const record = records.find((entry) => entry.operation === operation);
  if (record?.outcome !== 'established-value') {
    throw ingestionError('ingestion.invalid-manifest');
  }
  return record;
}

function validateNormalizedValue(
  operation: ProfileMaterializationOperation,
  value: unknown,
): void {
  const record = requireRecord(value);
  switch (operation) {
    case 'github-repository-metadata': {
      requireExactKeys(record, [
        'canonicalOwner',
        'canonicalRepository',
        'defaultBranch',
        'isArchived',
        'isFork',
        'isPublic',
        'licenseSpdxId',
        'primaryLanguage',
        'pushedAt',
        'topics',
        'updatedAt',
        'upstreamRepository',
      ]);
      if (
        !isRepositoryPart(record['canonicalOwner']) ||
        !isRepositoryPart(record['canonicalRepository']) ||
        !isBoundedString(record['defaultBranch'], 255) ||
        typeof record['isArchived'] !== 'boolean' ||
        typeof record['isFork'] !== 'boolean' ||
        typeof record['isPublic'] !== 'boolean' ||
        !isNullableBoundedString(record['licenseSpdxId'], 100) ||
        !isNullableBoundedString(record['primaryLanguage'], 100) ||
        !isTimestamp(record['pushedAt']) ||
        !isTimestamp(record['updatedAt']) ||
        !isNullableRepository(record['upstreamRepository']) ||
        !isSortedStrings(record['topics'], 32, 100)
      )
        throw ingestionError('ingestion.invalid-input');
      break;
    }
    case 'github-default-branch-head':
      requireExactKeys(record, ['committedAt', 'sha']);
      if (!isSha(record['sha']) || !isTimestamp(record['committedAt'])) {
        throw ingestionError('ingestion.invalid-input');
      }
      break;
    case 'github-release':
      requireExactKeys(record, ['releases']);
      validateObjectArray(record['releases'], 5, (release) => {
        requireExactKeys(release, [
          'isDraft',
          'isPrerelease',
          'publishedAt',
          'tag',
        ]);
        if (
          typeof release['isDraft'] !== 'boolean' ||
          typeof release['isPrerelease'] !== 'boolean' ||
          !isTimestamp(release['publishedAt']) ||
          !isBoundedString(release['tag'], 255)
        )
          throw ingestionError('ingestion.invalid-input');
      });
      break;
    case 'github-tag':
      requireExactKeys(record, ['tags']);
      validateObjectArray(record['tags'], 5, (tag) => {
        requireExactKeys(tag, ['commitSha', 'name']);
        if (!isSha(tag['commitSha']) || !isBoundedString(tag['name'], 255)) {
          throw ingestionError('ingestion.invalid-input');
        }
      });
      break;
    case 'github-license':
      requireExactKeys(record, ['path', 'sha', 'spdxId']);
      if (
        !isRepositoryPath(record['path']) ||
        !(record['sha'] === null || isSha(record['sha'])) ||
        !isNullableBoundedString(record['spdxId'], 100)
      )
        throw ingestionError('ingestion.invalid-input');
      break;
    case 'github-community-profile':
      requireExactKeys(record, ['healthPercentage', 'securityPolicyPresent']);
      if (
        !Number.isInteger(record['healthPercentage']) ||
        Number(record['healthPercentage']) < 0 ||
        Number(record['healthPercentage']) > 100 ||
        typeof record['securityPolicyPresent'] !== 'boolean'
      )
        throw ingestionError('ingestion.invalid-input');
      break;
    case 'github-allowlisted-file':
      requireExactKeys(record, ['path', 'sha']);
      if (!isRepositoryPath(record['path']) || !isSha(record['sha'])) {
        throw ingestionError('ingestion.invalid-input');
      }
      break;
    case 'npm-package':
      requireExactKeys(record, [
        'deprecated',
        'distTags',
        'exportsDeclared',
        'licenseDeclaration',
        'moduleType',
        'name',
        'nodeEngine',
        'publishedAt',
        'repositoryIdentity',
        'selectedVersion',
      ]);
      if (
        !isPackageName(record['name']) ||
        !isVersion(record['selectedVersion']) ||
        !isTimestamp(record['publishedAt']) ||
        !isNullableBoundedString(record['licenseDeclaration'], 100) ||
        !isNullableBoundedString(record['nodeEngine'], 100) ||
        !isNullableBoundedString(record['moduleType'], 40) ||
        typeof record['exportsDeclared'] !== 'boolean' ||
        typeof record['deprecated'] !== 'boolean' ||
        !isDistTags(record['distTags']) ||
        !isNullableRepository(record['repositoryIdentity'])
      )
        throw ingestionError('ingestion.invalid-input');
      break;
    case 'github-advisory':
      requireExactKeys(record, [
        'advisories',
        'complete',
        'limitationCode',
        'packageName',
        'packageVersion',
      ]);
      if (
        !isPackageName(record['packageName']) ||
        !isVersion(record['packageVersion']) ||
        typeof record['complete'] !== 'boolean' ||
        !isNullableSafeCode(record['limitationCode'])
      )
        throw ingestionError('ingestion.invalid-input');
      validateObjectArray(record['advisories'], 200, (advisory) => {
        requireExactKeys(advisory, [
          'advisoryId',
          'publishedAt',
          'severity',
          'updatedAt',
          'withdrawnAt',
        ]);
        if (
          !isSafeCode(advisory['advisoryId']) ||
          !isTimestamp(advisory['publishedAt']) ||
          !isTimestamp(advisory['updatedAt']) ||
          !(
            advisory['withdrawnAt'] === null ||
            isTimestamp(advisory['withdrawnAt'])
          ) ||
          !isBoundedString(advisory['severity'], 32)
        )
          throw ingestionError('ingestion.invalid-input');
      });
      break;
  }
}

function compareRecord(
  left: ProfileMaterializationSourceRecord,
  right: ProfileMaterializationSourceRecord,
): number {
  return (
    compareText(left.candidateId, right.candidateId) ||
    compareText(left.operation, right.operation) ||
    compareText(left.logicalSourceKey, right.logicalSourceKey)
  );
}

function copyJson<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(copyJson) as T;
  const record = requireRecord(value);
  return Object.fromEntries(
    Object.entries(record).map(([key, entry]) => [key, copyJson(entry)]),
  ) as T;
}

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) deepFreeze(nested);
  }
  return value;
}

function validateObjectArray(
  value: unknown,
  maximum: number,
  validate: (value: Record<string, unknown>) => void,
): void {
  if (!Array.isArray(value) || value.length > maximum) {
    throw ingestionError('ingestion.invalid-input');
  }
  value.forEach((entry) => {
    validate(requireRecord(entry));
  });
}

function isStableId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z][a-z0-9-]{0,63}$/u.test(value);
}

function isLogicalKey(value: unknown): value is string {
  return (
    value === 'singleton' ||
    (typeof value === 'string' && isRepositoryPath(value))
  );
}

function isTimestamp(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}

function isBoundedString(value: unknown, maximum: number): value is string {
  return (
    typeof value === 'string' &&
    value.length >= 1 &&
    value.length <= maximum &&
    !hasControlCharacter(value)
  );
}

function isNullableBoundedString(value: unknown, maximum: number): boolean {
  return value === null || isBoundedString(value, maximum);
}

function isSha(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{40}$/u.test(value);
}

function isRepositoryPart(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_.-]{1,100}$/u.test(value);
}

function isNullableRepository(value: unknown): boolean {
  if (value === null) return true;
  if (typeof value === 'string') {
    const parts = value.split('/');
    return parts.length === 2 && parts.every(isRepositoryPart);
  }
  const record = requireRecord(value);
  requireExactKeys(record, ['owner', 'repository']);
  return (
    isRepositoryPart(record['owner']) && isRepositoryPart(record['repository'])
  );
}

function isRepositoryPath(value: unknown): value is string {
  return (
    isBoundedString(value, 255) &&
    !value.startsWith('/') &&
    !value.endsWith('/') &&
    !value.includes('\\') &&
    value
      .split('/')
      .every((part) => part !== '' && part !== '.' && part !== '..')
  );
}

function isSortedStrings(
  value: unknown,
  maximumItems: number,
  maximumLength: number,
): boolean {
  return (
    Array.isArray(value) &&
    value.length <= maximumItems &&
    value.every((entry) => isBoundedString(entry, maximumLength)) &&
    value.every((entry, index) => {
      const previous = value[index - 1];
      return index === 0 || (typeof previous === 'string' && entry > previous);
    })
  );
}

function hasControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 31 || codePoint === 127;
  });
}

function isPackageName(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= 214 &&
    /^(?:@[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*|[a-z0-9][a-z0-9._-]*)$/u.test(
      value,
    )
  );
}

function isVersion(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u.test(
      value,
    )
  );
}

function isDistTags(value: unknown): boolean {
  const record = requireRecord(value);
  const keys = Object.keys(record);
  return (
    keys.length >= 1 &&
    keys.length <= 20 &&
    Object.hasOwn(record, 'latest') &&
    keys.every((key) => isSafeCode(key) && isBoundedString(record[key], 100))
  );
}

function isNullableSafeCode(value: unknown): boolean {
  return value === null || isSafeCode(value);
}
