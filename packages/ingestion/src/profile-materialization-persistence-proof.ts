/* eslint-disable @typescript-eslint/no-unnecessary-condition -- Operational proof parsing intentionally rechecks literal fields at the trust boundary. */

import { canonicalizeJson } from './canonical-json.ts';
import { ingestionError } from './errors.ts';
import {
  PROFILE_MATERIALIZATION_ACCEPTED_BINDINGS,
  PROFILE_MATERIALIZATION_PERSISTENCE_PROOF_VERSION,
  compareText,
  isDigest,
  isSafeCode,
  requireExactKeys,
  requireRecord,
  type ProfileMaterializationOperation,
  type ProfileMaterializationPersistenceCounts,
  type ProfileMaterializationPersistenceEntry,
  type ProfileMaterializationPersistenceProof,
  type ProfileMaterializationSourceAuthority,
  type ProfileMaterializationSourceRecord,
} from './profile-materialization-contracts.ts';
import {
  sourceRecordContentDigest,
  type ProfileMaterializationSourceRecordInput,
} from './profile-materialization-source-authority.ts';
import type { IngestionReceiptCandidate, ProfileResult } from './types.ts';

export type ProfileMaterializationPersistenceProofInput = Omit<
  ProfileMaterializationPersistenceProof,
  'proofSemanticDigest' | 'proofVersion'
>;

const PROOF_KEYS = [
  'candidateCount',
  'catalogDigest',
  'collection',
  'databaseSchemaDigest',
  'entries',
  'migrationInventoryDigest',
  'proofSemanticDigest',
  'proofVersion',
  'sourceAuthoritySemanticDigest',
] as const;

const ENTRY_KEYS = [
  'candidateId',
  'candidateState',
  'controlledOptionalSourceCodes',
  'disposition',
  'evidenceAppended',
  'evidenceIdempotent',
  'evidenceInvalidated',
  'evidenceSuperseded',
  'limitationCount',
  'outcome',
  'snapshotId',
  'snapshotState',
  'unknownCount',
] as const;

export function createProfileMaterializationPersistenceProof(
  input: ProfileMaterializationPersistenceProofInput,
  expectedCandidateIds?: readonly string[],
): ProfileMaterializationPersistenceProof {
  validateProofInput(input, expectedCandidateIds);
  const withoutDigest = {
    proofVersion: PROFILE_MATERIALIZATION_PERSISTENCE_PROOF_VERSION,
    ...copyJson(input),
  };
  return deepFreeze({
    ...withoutDigest,
    proofSemanticDigest: canonicalizeJson(withoutDigest).digest,
  });
}

export function parseProfileMaterializationPersistenceProof(
  value: unknown,
  bindings?: {
    readonly collection: 'first' | 'second';
    readonly sourceAuthority: ProfileMaterializationSourceAuthority;
    readonly candidateIds: readonly string[];
  },
): ProfileMaterializationPersistenceProof {
  const record = requireRecord(value);
  requireExactKeys(record, PROOF_KEYS);
  if (
    record['proofVersion'] !==
      PROFILE_MATERIALIZATION_PERSISTENCE_PROOF_VERSION ||
    !isDigest(record['proofSemanticDigest'])
  ) {
    throw ingestionError('ingestion.invalid-receipt');
  }
  const input = { ...record };
  delete input['proofVersion'];
  delete input['proofSemanticDigest'];
  const recreated = createProfileMaterializationPersistenceProof(
    input as unknown as ProfileMaterializationPersistenceProofInput,
    bindings?.candidateIds,
  );
  if (
    canonicalizeJson(recreated).text !== canonicalizeJson(record).text ||
    (bindings !== undefined &&
      (recreated.collection !== bindings.collection ||
        recreated.sourceAuthoritySemanticDigest !==
          bindings.sourceAuthority.authoritySemanticDigest))
  ) {
    throw ingestionError('ingestion.invalid-receipt');
  }
  return recreated;
}

export function persistenceProofCounts(
  proof: ProfileMaterializationPersistenceProof,
): ProfileMaterializationPersistenceCounts {
  const parsed = parseProfileMaterializationPersistenceProof(proof);
  const count = (
    predicate: (entry: ProfileMaterializationPersistenceEntry) => boolean,
  ): number => parsed.entries.filter(predicate).length;
  const sum = (
    field:
      | 'evidenceAppended'
      | 'evidenceIdempotent'
      | 'evidenceInvalidated'
      | 'evidenceSuperseded',
  ): number => parsed.entries.reduce((total, entry) => total + entry[field], 0);
  return Object.freeze({
    persistedCandidateCount: count(
      (entry) => entry.disposition === 'persisted',
    ),
    qualifiedNotPersistedCount: count(
      (entry) => entry.disposition === 'qualified-not-persisted',
    ),
    created: count((entry) => entry.outcome === 'created'),
    updated: count((entry) => entry.outcome === 'updated'),
    unchanged: count((entry) => entry.outcome === 'unchanged'),
    candidateCreated: count((entry) => entry.candidateState === 'created'),
    candidateIdempotent: count(
      (entry) => entry.candidateState === 'idempotent',
    ),
    snapshotCreated: count((entry) => entry.snapshotState === 'created'),
    snapshotIdempotent: count((entry) => entry.snapshotState === 'idempotent'),
    evidenceAppended: sum('evidenceAppended'),
    evidenceIdempotent: sum('evidenceIdempotent'),
    evidenceSuperseded: sum('evidenceSuperseded'),
    evidenceInvalidated: sum('evidenceInvalidated'),
  });
}

export function persistenceEntryFromResult(
  result: IngestionReceiptCandidate,
): ProfileMaterializationPersistenceEntry {
  if (
    (result.outcome !== 'created' &&
      result.outcome !== 'updated' &&
      result.outcome !== 'unchanged') ||
    result.snapshotId === null ||
    result.candidateState === null ||
    result.snapshotState === null ||
    result.incompleteSourceCodes.length !== 0 ||
    result.safeErrorCode !== null
  ) {
    throw ingestionError('ingestion.persistence');
  }
  const outcome = result.outcome;
  return {
    candidateId: result.candidateId,
    disposition: 'persisted',
    controlledOptionalSourceCodes: [],
    outcome,
    candidateState: result.candidateState,
    snapshotState: result.snapshotState,
    snapshotId: result.snapshotId,
    evidenceAppended: result.evidenceAppended,
    evidenceIdempotent: result.evidenceIdempotent,
    evidenceSuperseded: result.evidenceSuperseded,
    evidenceInvalidated: result.evidenceInvalidated,
    limitationCount: result.limitationCount,
    unknownCount: result.unknownCount,
  };
}

export function qualifiedNotPersistedEntry(
  candidateId: string,
  controlledOptionalSourceCodes: readonly string[],
): ProfileMaterializationPersistenceEntry {
  return {
    candidateId,
    disposition: 'qualified-not-persisted',
    controlledOptionalSourceCodes: [...controlledOptionalSourceCodes].sort(
      compareText,
    ),
    outcome: null,
    candidateState: null,
    snapshotState: null,
    snapshotId: null,
    evidenceAppended: 0,
    evidenceIdempotent: 0,
    evidenceSuperseded: 0,
    evidenceInvalidated: 0,
    limitationCount: 0,
    unknownCount: 0,
  };
}

export function attachProfileMaterializationEvidenceIds(
  sourceRecords: readonly ProfileMaterializationSourceRecordInput[],
  profile: ProfileResult,
): readonly ProfileMaterializationSourceRecordInput[] {
  return sourceRecords.map((record) => {
    if (record.candidateId !== profile.identity.candidateId) {
      throw ingestionError('ingestion.invalid-input');
    }
    if (record.outcome !== 'established-value') {
      return { ...record, evidenceIds: [] };
    }
    const evidenceIds = profile.observations
      .filter((observation) => observationApplies(record, observation))
      .map((observation) => observation.evidenceId)
      .sort(compareText);
    if (requiresExistingEvidence(record) && evidenceIds.length === 0) {
      throw ingestionError('ingestion.persistence');
    }
    return { ...record, evidenceIds };
  });
}

export function deriveProfileMaterializationLiveIdempotency(input: {
  readonly firstAuthority: ProfileMaterializationSourceAuthority;
  readonly secondAuthority: ProfileMaterializationSourceAuthority;
  readonly firstProof: ProfileMaterializationPersistenceProof;
  readonly secondProof: ProfileMaterializationPersistenceProof;
}):
  | 'passed'
  | 'passed-with-provider-drift'
  | 'qualified-optional-source-failures' {
  const first = parseProfileMaterializationPersistenceProof(input.firstProof, {
    collection: 'first',
    sourceAuthority: input.firstAuthority,
    candidateIds: input.firstAuthority.candidates.map(
      (entry) => entry.candidateId,
    ),
  });
  const second = parseProfileMaterializationPersistenceProof(
    input.secondProof,
    {
      collection: 'second',
      sourceAuthority: input.secondAuthority,
      candidateIds: input.secondAuthority.candidates.map(
        (entry) => entry.candidateId,
      ),
    },
  );
  const firstEntries = new Map(
    first.entries.map((entry) => [entry.candidateId, entry]),
  );
  const secondEntries = new Map(
    second.entries.map((entry) => [entry.candidateId, entry]),
  );
  let providerDrift = false;
  let qualified = false;
  for (const candidate of input.firstAuthority.candidates) {
    const firstEntry = firstEntries.get(candidate.candidateId);
    const secondEntry = secondEntries.get(candidate.candidateId);
    if (firstEntry === undefined || secondEntry === undefined) {
      throw ingestionError('ingestion.invalid-receipt');
    }
    validateDispositionEvidence(
      firstEntry,
      input.firstAuthority.sourceRecords.filter(
        (record) => record.candidateId === candidate.candidateId,
      ),
    );
    validateDispositionEvidence(
      secondEntry,
      input.secondAuthority.sourceRecords.filter(
        (record) => record.candidateId === candidate.candidateId,
      ),
    );
    if (
      firstEntry.disposition === 'qualified-not-persisted' ||
      secondEntry.disposition === 'qualified-not-persisted'
    ) {
      qualified = true;
      continue;
    }
    const unchanged = candidateSourcesUnchanged(
      candidate.candidateId,
      input.firstAuthority,
      input.secondAuthority,
    );
    if (unchanged) {
      if (
        secondEntry.outcome !== 'unchanged' ||
        secondEntry.candidateState !== 'idempotent' ||
        secondEntry.snapshotState !== 'idempotent' ||
        secondEntry.evidenceAppended !== 0 ||
        secondEntry.evidenceSuperseded !== 0 ||
        secondEntry.evidenceInvalidated !== 0
      ) {
        throw ingestionError('ingestion.invalid-receipt');
      }
      continue;
    }
    providerDrift = true;
    if (
      secondEntry.outcome === 'created' ||
      (secondEntry.outcome === 'updated' &&
        secondEntry.evidenceAppended +
          secondEntry.evidenceSuperseded +
          secondEntry.evidenceInvalidated ===
          0) ||
      (secondEntry.outcome === 'unchanged' &&
        (secondEntry.candidateState !== 'idempotent' ||
          secondEntry.snapshotState !== 'idempotent' ||
          secondEntry.evidenceIdempotent === 0 ||
          secondEntry.evidenceAppended !== 0 ||
          secondEntry.evidenceSuperseded !== 0 ||
          secondEntry.evidenceInvalidated !== 0))
    ) {
      throw ingestionError('ingestion.invalid-receipt');
    }
  }
  return qualified
    ? 'qualified-optional-source-failures'
    : providerDrift
      ? 'passed-with-provider-drift'
      : 'passed';
}

function validateDispositionEvidence(
  entry: ProfileMaterializationPersistenceEntry,
  records: readonly ProfileMaterializationSourceRecord[],
): void {
  if (entry.disposition === 'qualified-not-persisted') {
    if (records.some((record) => record.evidenceIds.length !== 0)) {
      throw ingestionError('ingestion.invalid-receipt');
    }
    return;
  }
  if (
    records.some(
      (record) =>
        record.outcome === 'established-value' &&
        requiresExistingEvidence(record) &&
        record.evidenceIds.length === 0,
    )
  ) {
    throw ingestionError('ingestion.invalid-receipt');
  }
}

function validateProofInput(
  input: ProfileMaterializationPersistenceProofInput,
  expectedCandidateIds?: readonly string[],
): void {
  const entries: readonly ProfileMaterializationPersistenceEntry[] =
    input.entries;
  if (
    !['first', 'second'].includes(input.collection) ||
    input.databaseSchemaDigest !==
      PROFILE_MATERIALIZATION_ACCEPTED_BINDINGS.databaseSchemaDigest ||
    input.migrationInventoryDigest !==
      PROFILE_MATERIALIZATION_ACCEPTED_BINDINGS.migrationInventoryDigest ||
    input.catalogDigest !==
      PROFILE_MATERIALIZATION_ACCEPTED_BINDINGS.catalogDigest ||
    !isDigest(input.sourceAuthoritySemanticDigest) ||
    input.candidateCount !== 150 ||
    !Array.isArray(input.entries) ||
    entries.length !== 150
  ) {
    throw ingestionError('ingestion.invalid-receipt');
  }
  entries.forEach(validateEntry);
  if (
    entries.some(
      (entry, index) =>
        index > 0 &&
        compareText(entries[index - 1]?.candidateId ?? '', entry.candidateId) >=
          0,
    ) ||
    (expectedCandidateIds !== undefined &&
      canonicalizeJson(entries.map((entry) => entry.candidateId)).text !==
        canonicalizeJson(expectedCandidateIds).text)
  ) {
    throw ingestionError('ingestion.invalid-receipt');
  }
}

function validateEntry(entry: ProfileMaterializationPersistenceEntry): void {
  requireExactKeys(requireRecord(entry), ENTRY_KEYS);
  const counts = [
    entry.evidenceAppended,
    entry.evidenceIdempotent,
    entry.evidenceInvalidated,
    entry.evidenceSuperseded,
    entry.limitationCount,
    entry.unknownCount,
  ];
  if (
    !isStableId(entry.candidateId) ||
    !Array.isArray(entry.controlledOptionalSourceCodes) ||
    entry.controlledOptionalSourceCodes.some((code) => !isSafeCode(code)) ||
    entry.controlledOptionalSourceCodes.some(
      (code, index) =>
        index > 0 &&
        code <= (entry.controlledOptionalSourceCodes[index - 1] ?? ''),
    ) ||
    counts.some((count) => !Number.isInteger(count) || count < 0)
  ) {
    throw ingestionError('ingestion.invalid-receipt');
  }
  if (entry.disposition === 'persisted') {
    if (
      entry.controlledOptionalSourceCodes.length !== 0 ||
      !['created', 'updated', 'unchanged'].includes(entry.outcome ?? '') ||
      !['created', 'idempotent'].includes(entry.candidateState ?? '') ||
      !['created', 'idempotent'].includes(entry.snapshotState ?? '') ||
      !isStableId(entry.snapshotId)
    ) {
      throw ingestionError('ingestion.invalid-receipt');
    }
    return;
  }
  if (
    entry.disposition !== 'qualified-not-persisted' ||
    entry.controlledOptionalSourceCodes.length === 0 ||
    entry.outcome !== null ||
    entry.candidateState !== null ||
    entry.snapshotState !== null ||
    entry.snapshotId !== null ||
    counts.some((count) => count !== 0)
  ) {
    throw ingestionError('ingestion.invalid-receipt');
  }
}

function observationApplies(
  record: ProfileMaterializationSourceRecordInput,
  observation: ProfileResult['observations'][number],
): boolean {
  switch (record.operation) {
    case 'github-repository-metadata':
      return ['repository-identity', 'repository-state'].includes(
        observation.topic,
      );
    case 'github-default-branch-head':
      return observation.topic === 'repository-head';
    case 'github-release':
      return observation.topic === 'release-current';
    case 'github-tag':
      return observation.topic.startsWith('repository-tag-');
    case 'github-license':
      return observation.topic === 'license-declared';
    case 'github-community-profile':
      return observation.topic === 'security-policy';
    case 'github-allowlisted-file': {
      const value = requireRecord(record.normalizedValue);
      const path = String(value['path']);
      const encodedPath = path
        .split('/')
        .map((part) => encodeURIComponent(part))
        .join('/');
      return (
        observation.topic.startsWith('repository-file-') &&
        observation.source.kind === 'git-commit' &&
        observation.source.immutableUrl.endsWith(`/${encodedPath}`)
      );
    }
    case 'npm-package':
      return [
        'npm-latest-version',
        'npm-runtime-shape',
        'repository-package-linkage',
      ].includes(observation.topic);
    case 'github-advisory':
      return observation.topic.startsWith('security-advisory-');
  }
}

function requiresExistingEvidence(
  record: ProfileMaterializationSourceRecordInput,
): boolean {
  const always: readonly ProfileMaterializationOperation[] = [
    'github-repository-metadata',
    'github-default-branch-head',
    'github-community-profile',
    'github-allowlisted-file',
    'npm-package',
  ];
  if (always.includes(record.operation)) return true;
  const value = requireRecord(record.normalizedValue);
  if (record.operation === 'github-tag') {
    return Array.isArray(value['tags']) && value['tags'].length > 0;
  }
  if (record.operation === 'github-license') return value['spdxId'] !== null;
  if (record.operation === 'github-advisory') {
    return Array.isArray(value['advisories']) && value['advisories'].length > 0;
  }
  return false;
}

function candidateSourcesUnchanged(
  candidateId: string,
  first: ProfileMaterializationSourceAuthority,
  second: ProfileMaterializationSourceAuthority,
): boolean {
  const firstRecords = first.sourceRecords.filter(
    (record) => record.candidateId === candidateId,
  );
  const secondByIdentity = new Map(
    second.sourceRecords
      .filter((record) => record.candidateId === candidateId)
      .map((record) => [record.logicalSourceIdentityDigest, record]),
  );
  if (firstRecords.length !== secondByIdentity.size) return false;
  return firstRecords.every((record) => {
    const next = secondByIdentity.get(record.logicalSourceIdentityDigest);
    return (
      next !== undefined &&
      sourceRecordContentDigest(record) === sourceRecordContentDigest(next)
    );
  });
}

function isStableId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z][a-z0-9-]{0,63}$/u.test(value);
}

function copyJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}
