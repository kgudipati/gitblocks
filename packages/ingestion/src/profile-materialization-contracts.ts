/* eslint-disable @typescript-eslint/no-unnecessary-condition -- Trust-boundary validation intentionally rechecks literal DTO fields at runtime. */

import { DETERMINISTIC_PROFILE_FIELD_IDS } from '@gitblocks/contracts';

import { canonicalizeJson } from './canonical-json.ts';
import { ingestionError } from './errors.ts';

export const PROFILE_MATERIALIZATION_OPERATOR_VERSION =
  'profile-materialization-operator/1.0.0' as const;
export const PROFILE_MATERIALIZATION_PROVIDER_POLICY_VERSION =
  'profile-materialization-provider-policy/1.0.0' as const;
export const PROFILE_MATERIALIZATION_SOURCE_AUTHORITY_VERSION =
  'profile-materialization-source-authority/1.0.0' as const;
export const PROFILE_MATERIALIZATION_PERSISTENCE_PROOF_VERSION =
  'profile-materialization-persistence-proof/1.0.0' as const;
export const PROFILE_MATERIALIZATION_COVERAGE_VERSION =
  'profile-materialization-coverage/1.0.0' as const;
export const PROFILE_MATERIALIZATION_RECEIPT_VERSION =
  'profile-materialization-receipt/1.0.0' as const;
export const PROFILE_MATERIALIZATION_PROJECTION_VERSION =
  'profile-materialization-projection/1.0.0' as const;
export const PROFILE_MATERIALIZATION_ACCEPTED_BINDINGS = {
  providerPolicyDigest:
    '0945ebd862d0a1b5f622c4f10f60b2c0e713fb127cc5dea5668be5cc40c96ede',
  catalogDigest:
    '4819dd94cb1bbe5e27c31ca5ca55976da1442987a792bf438d96681021cb8634',
  taxonomyDigest:
    '838fa85b2e6937866854b6f733fe7045cf49d5f811cb5e4a8d503bfbd76a61c9',
  profileSchemaDigest:
    '3bbfdf2050c13a3d70e9dc289db7c8768a6fdcba8605cf12191e08560387af61',
  profileAuthoritySchemaDigest:
    '7a79a1671bf461127099e3ae2f75d29e949387987041bd3402f2614b747ed8cf',
  migrationInventoryDigest:
    '6c2523252496b2e99c7034a109ac4c672fe347af10b8502ad098a0bd619926f4',
  databaseSchemaDigest:
    '265fa5f21dbeaa1b80dd78bd6bdd678b27e5971f2852042a30cb872ba44a2952',
} as const;

export const PROFILE_MATERIALIZATION_SOURCE_TYPES = [
  'github-advisory',
  'github-community',
  'github-file',
  'github-head-commit',
  'github-license',
  'github-release',
  'github-repository',
  'github-tag',
  'npm-package',
] as const;

export const PROFILE_MATERIALIZATION_OPERATIONS = [
  'github-repository-metadata',
  'github-default-branch-head',
  'github-release',
  'github-tag',
  'github-license',
  'github-community-profile',
  'github-allowlisted-file',
  'npm-package',
  'github-advisory',
] as const;

export const PROFILE_MATERIALIZATION_AUTHORIZED_FIELD_IDS = [
  'archived-state',
  'fork-upstream-state',
  'license-identity',
  'package-publication-version',
  'package-repository-linkage',
  'release-state-recency',
  'repository-discovery-metadata',
  'runtime-package-format',
  'security-advisory-state',
  'security-policy-presence',
] as const;

export type ProfileMaterializationSourceType =
  (typeof PROFILE_MATERIALIZATION_SOURCE_TYPES)[number];
export type ProfileMaterializationOperation =
  (typeof PROFILE_MATERIALIZATION_OPERATIONS)[number];
export type ProfileMaterializationAuthorizedFieldId =
  (typeof PROFILE_MATERIALIZATION_AUTHORIZED_FIELD_IDS)[number];
export type ProfileMaterializationSourceMutability = 'immutable' | 'mutable';
export type ProfileMaterializationSourceOutcome =
  'established-value' | 'established-absence' | 'unavailable' | 'fatal';

export interface ProfileMaterializationRequestBudget {
  readonly github: number;
  readonly npm: number;
  readonly total: number;
}

export interface ProfileMaterializationProviderOperationPolicy {
  readonly authentication: 'none' | 'required';
  readonly candidateDeadlineMilliseconds: number;
  readonly concurrency: number;
  readonly controlledAbsence: 'established-absence' | 'fatal';
  readonly endpointTemplate: string;
  readonly fatalErrorCodes: readonly string[];
  readonly host: 'api.github.com' | 'registry.npmjs.org';
  readonly maximumAttempts: number;
  readonly maximumJsonNodes: number;
  readonly maximumRedirects: number;
  readonly maximumRequestsPerCandidate: 1 | 2;
  readonly maximumResponseBytes: number;
  readonly method: 'GET';
  readonly operation: ProfileMaterializationOperation;
  readonly profileFields: readonly ProfileMaterializationAuthorizedFieldId[];
  readonly provider: 'github' | 'npm';
  readonly purpose: 'persistence-audit-only' | 'profile-input';
  readonly requestTimeoutMilliseconds: number;
  readonly retainedStructuredProperties: readonly string[];
  readonly runDeadlineMilliseconds: number;
  readonly sourceMutability: ProfileMaterializationSourceMutability;
  readonly sourceType: ProfileMaterializationSourceType;
  readonly temporaryUnavailability: 'fatal' | 'qualified-unknown';
}

export interface ProfileMaterializationProviderPolicy {
  readonly policyVersion: typeof PROFILE_MATERIALIZATION_PROVIDER_POLICY_VERSION;
  readonly catalogBinding: {
    readonly catalogVersion: 'public-v1';
    readonly catalogDigest: string;
  };
  readonly transport: {
    readonly scheme: 'https';
    readonly effectivePort: 443;
    readonly methods: readonly ['GET'];
    readonly allowedHosts: readonly ['api.github.com', 'registry.npmjs.org'];
    readonly redirectPolicy: 'manual-same-host';
    readonly retryPolicy: 'existing-bounded-deterministic';
    readonly cache: 'none';
    readonly cancellation: 'abort-signal';
  };
  readonly maximumRequestBudget: ProfileMaterializationRequestBudget;
  readonly operations: readonly ProfileMaterializationProviderOperationPolicy[];
  readonly policySemanticDigest: string;
}

export interface ProfileMaterializationCandidateSourceRecord {
  readonly candidateId: string;
  readonly sourceRecordDigests: readonly string[];
}

export interface ProfileMaterializationSourceRecord {
  readonly candidateId: string;
  readonly sourceType: ProfileMaterializationSourceType;
  readonly operation: ProfileMaterializationOperation;
  readonly logicalSourceKey: string;
  readonly logicalSourceIdentityDigest: string;
  readonly sourceRecordDigest: string;
  readonly sourceMutability: ProfileMaterializationSourceMutability;
  readonly outcome: ProfileMaterializationSourceOutcome;
  readonly immutableReference: string | null;
  readonly collectedAt: string;
  readonly normalizedValue: unknown;
  readonly controlledCode: string | null;
  readonly evidenceIds: readonly string[];
}

export interface ProfileMaterializationSourceAuthority {
  readonly authorityVersion: typeof PROFILE_MATERIALIZATION_SOURCE_AUTHORITY_VERSION;
  readonly providerPolicyVersion: typeof PROFILE_MATERIALIZATION_PROVIDER_POLICY_VERSION;
  readonly providerPolicyDigest: string;
  readonly catalogVersion: 'public-v1';
  readonly catalogDigest: string;
  readonly taxonomyVersion: '1.0.0';
  readonly taxonomyDigest: string;
  readonly candidateCount: 150;
  readonly candidates: readonly ProfileMaterializationCandidateSourceRecord[];
  readonly sourceRecords: readonly ProfileMaterializationSourceRecord[];
  readonly authoritySemanticDigest: string;
}

export interface ProfileMaterializationCountBySourceType {
  readonly sourceType: ProfileMaterializationSourceType;
  readonly count: number;
}

export interface ProfileMaterializationOutcomeCountBySourceType {
  readonly sourceType: ProfileMaterializationSourceType;
  readonly establishedValue: number;
  readonly establishedAbsence: number;
  readonly unavailable: number;
  readonly fatal: number;
}

export interface ProfileMaterializationDriftCount {
  readonly sourceType: ProfileMaterializationSourceType;
  readonly unchanged: number;
  readonly new: number;
  readonly changed: number;
  readonly withdrawn: number;
}

export interface ProfileMaterializationPassDigests {
  readonly profileAuthorityDigest: string;
  readonly profileCoverageDigest: string;
}

export interface ProfileMaterializationPersistenceEntry {
  readonly candidateId: string;
  readonly disposition: 'persisted' | 'qualified-not-persisted';
  readonly controlledOptionalSourceCodes: readonly string[];
  readonly outcome: 'created' | 'updated' | 'unchanged' | null;
  readonly candidateState: 'created' | 'idempotent' | null;
  readonly snapshotState: 'created' | 'idempotent' | null;
  readonly snapshotId: string | null;
  readonly evidenceAppended: number;
  readonly evidenceIdempotent: number;
  readonly evidenceSuperseded: number;
  readonly evidenceInvalidated: number;
  readonly limitationCount: number;
  readonly unknownCount: number;
}

export interface ProfileMaterializationPersistenceProof {
  readonly proofVersion: typeof PROFILE_MATERIALIZATION_PERSISTENCE_PROOF_VERSION;
  readonly collection: 'first' | 'second';
  readonly databaseSchemaDigest: string;
  readonly migrationInventoryDigest: string;
  readonly catalogDigest: string;
  readonly sourceAuthoritySemanticDigest: string;
  readonly candidateCount: 150;
  readonly entries: readonly ProfileMaterializationPersistenceEntry[];
  readonly proofSemanticDigest: string;
}

export interface ProfileMaterializationPersistenceCounts {
  readonly persistedCandidateCount: number;
  readonly qualifiedNotPersistedCount: number;
  readonly created: number;
  readonly updated: number;
  readonly unchanged: number;
  readonly candidateCreated: number;
  readonly candidateIdempotent: number;
  readonly snapshotCreated: number;
  readonly snapshotIdempotent: number;
  readonly evidenceAppended: number;
  readonly evidenceIdempotent: number;
  readonly evidenceSuperseded: number;
  readonly evidenceInvalidated: number;
}

export interface ProfileMaterializationReceipt {
  readonly receiptVersion: typeof PROFILE_MATERIALIZATION_RECEIPT_VERSION;
  readonly operatorVersion: typeof PROFILE_MATERIALIZATION_OPERATOR_VERSION;
  readonly providerPolicyVersion: typeof PROFILE_MATERIALIZATION_PROVIDER_POLICY_VERSION;
  readonly providerPolicyDigest: string;
  readonly sourceAuthorityVersion: typeof PROFILE_MATERIALIZATION_SOURCE_AUTHORITY_VERSION;
  readonly persistenceProofVersion: typeof PROFILE_MATERIALIZATION_PERSISTENCE_PROOF_VERSION;
  readonly firstPersistenceProofSemanticDigest: string;
  readonly secondPersistenceProofSemanticDigest: string;
  readonly firstPersistenceCounts: ProfileMaterializationPersistenceCounts;
  readonly secondPersistenceCounts: ProfileMaterializationPersistenceCounts;
  readonly firstSourceAuthoritySemanticDigest: string;
  readonly secondSourceAuthoritySemanticDigest: string;
  readonly finalSourceAuthoritySemanticDigest: string;
  readonly firstSourceRecordCounts: readonly ProfileMaterializationCountBySourceType[];
  readonly secondSourceRecordCounts: readonly ProfileMaterializationCountBySourceType[];
  readonly firstSourceOutcomeCounts: readonly ProfileMaterializationOutcomeCountBySourceType[];
  readonly secondSourceOutcomeCounts: readonly ProfileMaterializationOutcomeCountBySourceType[];
  readonly sourceDriftComparisonDigest: string;
  readonly sourceDriftCounts: readonly ProfileMaterializationDriftCount[];
  readonly firstPassA: ProfileMaterializationPassDigests;
  readonly firstPassB: ProfileMaterializationPassDigests;
  readonly secondPassA: ProfileMaterializationPassDigests;
  readonly secondPassB: ProfileMaterializationPassDigests;
  readonly sameEvidenceReproduction: 'passed';
  readonly liveIdempotency:
    | 'passed'
    | 'passed-with-provider-drift'
    | 'qualified-optional-source-failures';
  readonly qualification: 'complete' | 'qualified-optional-source-failures';
  readonly catalogVersion: 'public-v1';
  readonly catalogDigest: string;
  readonly taxonomyVersion: '1.0.0';
  readonly taxonomyDigest: string;
  readonly profileSchemaDigest: string;
  readonly profileAuthoritySchemaDigest: string;
  readonly profileRulesVersion: 'deterministic-candidate-profile-rules/1.0.0';
  readonly projectionVersion: typeof PROFILE_MATERIALIZATION_PROJECTION_VERSION;
  readonly migrationInventoryDigest: string;
  readonly migrationCount: 4;
  readonly databaseSchemaDigest: string;
  readonly productTableCount: 25;
  readonly candidateCount: 150;
  readonly aggregateFieldStates: ProfileMaterializationStateCounts;
  readonly fieldCoverage: readonly ProfileMaterializationFieldCoverage[];
  readonly familyCoverage: readonly ProfileMaterializationFamilyCoverage[];
  readonly controlledFailureCounts: readonly {
    readonly code: string;
    readonly count: number;
  }[];
  readonly runIdDigest: string;
  readonly receiptSemanticDigest: string;
  readonly receiptRecordDigest: string;
}

export interface ProfileMaterializationStateCounts {
  readonly known: number;
  readonly unknown: number;
  readonly notApplicable: number;
  readonly conflict: number;
}

export interface ProfileMaterializationFieldCoverage extends ProfileMaterializationStateCounts {
  readonly fieldId: string;
}

export interface ProfileMaterializationFamilyCoverage extends ProfileMaterializationStateCounts {
  readonly family: string;
}

export type ProfileMaterializationReceiptInput = Omit<
  ProfileMaterializationReceipt,
  'receiptRecordDigest' | 'receiptSemanticDigest'
>;

const HEX_DIGEST = /^[a-f0-9]{64}$/u;
const SAFE_CODE = /^[a-z][a-z0-9.-]{0,127}$/u;
const FORBIDDEN_KEY =
  /(?:authorization|credential|databaseurl|machine|operatorname|providerbody|rawbody|stack|timestamp|token|url)$/iu;
const RECEIPT_INPUT_KEYS = [
  'aggregateFieldStates',
  'candidateCount',
  'catalogDigest',
  'catalogVersion',
  'controlledFailureCounts',
  'databaseSchemaDigest',
  'familyCoverage',
  'fieldCoverage',
  'finalSourceAuthoritySemanticDigest',
  'firstPersistenceCounts',
  'firstPersistenceProofSemanticDigest',
  'firstPassA',
  'firstPassB',
  'firstSourceAuthoritySemanticDigest',
  'firstSourceOutcomeCounts',
  'firstSourceRecordCounts',
  'liveIdempotency',
  'migrationCount',
  'migrationInventoryDigest',
  'operatorVersion',
  'productTableCount',
  'persistenceProofVersion',
  'profileAuthoritySchemaDigest',
  'profileRulesVersion',
  'profileSchemaDigest',
  'projectionVersion',
  'providerPolicyDigest',
  'providerPolicyVersion',
  'qualification',
  'receiptVersion',
  'runIdDigest',
  'sameEvidenceReproduction',
  'secondPassA',
  'secondPassB',
  'secondPersistenceCounts',
  'secondPersistenceProofSemanticDigest',
  'secondSourceAuthoritySemanticDigest',
  'secondSourceOutcomeCounts',
  'secondSourceRecordCounts',
  'sourceAuthorityVersion',
  'sourceDriftComparisonDigest',
  'sourceDriftCounts',
  'taxonomyDigest',
  'taxonomyVersion',
] as const;

export function createProfileMaterializationReceipt(
  input: ProfileMaterializationReceiptInput,
): ProfileMaterializationReceipt {
  validateReceiptInput(input);
  const semanticInput = { ...input } as Record<string, unknown>;
  delete semanticInput['runIdDigest'];
  const receiptSemanticDigest = canonicalizeJson(semanticInput).digest;
  const recordInput = { ...input, receiptSemanticDigest };
  const receiptRecordDigest = canonicalizeJson(recordInput).digest;
  return Object.freeze({
    ...input,
    receiptSemanticDigest,
    receiptRecordDigest,
  });
}

export function parseProfileMaterializationReceipt(
  value: unknown,
): ProfileMaterializationReceipt {
  const receipt = requireRecord(
    value,
  ) as unknown as ProfileMaterializationReceipt;
  const keys = Object.keys(receipt);
  if (
    !keys.includes('receiptSemanticDigest') ||
    !keys.includes('receiptRecordDigest')
  ) {
    throw ingestionError('ingestion.invalid-receipt');
  }
  const input = { ...receipt } as Record<string, unknown>;
  delete input['receiptSemanticDigest'];
  delete input['receiptRecordDigest'];
  const recreated = createProfileMaterializationReceipt(
    input as unknown as ProfileMaterializationReceiptInput,
  );
  if (canonicalizeJson(recreated).text !== canonicalizeJson(receipt).text) {
    throw ingestionError('ingestion.invalid-receipt');
  }
  return recreated;
}

function validateReceiptInput(input: ProfileMaterializationReceiptInput): void {
  requireExactKeys(requireRecord(input), RECEIPT_INPUT_KEYS);
  assertNoForbiddenContent(input);
  if (
    input.receiptVersion !== PROFILE_MATERIALIZATION_RECEIPT_VERSION ||
    input.operatorVersion !== PROFILE_MATERIALIZATION_OPERATOR_VERSION ||
    input.providerPolicyVersion !==
      PROFILE_MATERIALIZATION_PROVIDER_POLICY_VERSION ||
    input.sourceAuthorityVersion !==
      PROFILE_MATERIALIZATION_SOURCE_AUTHORITY_VERSION ||
    input.persistenceProofVersion !==
      PROFILE_MATERIALIZATION_PERSISTENCE_PROOF_VERSION ||
    input.projectionVersion !== PROFILE_MATERIALIZATION_PROJECTION_VERSION ||
    input.catalogVersion !== 'public-v1' ||
    input.taxonomyVersion !== '1.0.0' ||
    input.profileRulesVersion !==
      'deterministic-candidate-profile-rules/1.0.0' ||
    input.migrationCount !== 4 ||
    input.productTableCount !== 25 ||
    input.candidateCount !== 150 ||
    input.providerPolicyDigest !==
      PROFILE_MATERIALIZATION_ACCEPTED_BINDINGS.providerPolicyDigest ||
    !isDigest(input.firstSourceAuthoritySemanticDigest) ||
    !isDigest(input.secondSourceAuthoritySemanticDigest) ||
    !isDigest(input.finalSourceAuthoritySemanticDigest) ||
    !isDigest(input.firstPersistenceProofSemanticDigest) ||
    !isDigest(input.secondPersistenceProofSemanticDigest) ||
    !isDigest(input.sourceDriftComparisonDigest) ||
    input.catalogDigest !==
      PROFILE_MATERIALIZATION_ACCEPTED_BINDINGS.catalogDigest ||
    input.taxonomyDigest !==
      PROFILE_MATERIALIZATION_ACCEPTED_BINDINGS.taxonomyDigest ||
    input.profileSchemaDigest !==
      PROFILE_MATERIALIZATION_ACCEPTED_BINDINGS.profileSchemaDigest ||
    input.profileAuthoritySchemaDigest !==
      PROFILE_MATERIALIZATION_ACCEPTED_BINDINGS.profileAuthoritySchemaDigest ||
    input.migrationInventoryDigest !==
      PROFILE_MATERIALIZATION_ACCEPTED_BINDINGS.migrationInventoryDigest ||
    input.databaseSchemaDigest !==
      PROFILE_MATERIALIZATION_ACCEPTED_BINDINGS.databaseSchemaDigest ||
    !isDigest(input.runIdDigest) ||
    input.sameEvidenceReproduction !== 'passed' ||
    ![
      'passed',
      'passed-with-provider-drift',
      'qualified-optional-source-failures',
    ].includes(input.liveIdempotency) ||
    !['complete', 'qualified-optional-source-failures'].includes(
      input.qualification,
    ) ||
    canonicalizeJson(input.firstPassA).text !==
      canonicalizeJson(input.firstPassB).text ||
    canonicalizeJson(input.secondPassA).text !==
      canonicalizeJson(input.secondPassB).text ||
    input.finalSourceAuthoritySemanticDigest !==
      input.secondSourceAuthoritySemanticDigest
  ) {
    throw ingestionError('ingestion.invalid-receipt');
  }
  for (const pass of [
    input.firstPassA,
    input.firstPassB,
    input.secondPassA,
    input.secondPassB,
  ]) {
    requireExactKeys(requireRecord(pass), [
      'profileAuthorityDigest',
      'profileCoverageDigest',
    ]);
    if (
      !isDigest(pass.profileAuthorityDigest) ||
      !isDigest(pass.profileCoverageDigest)
    ) {
      throw ingestionError('ingestion.invalid-receipt');
    }
  }
  validateSourceTypeClosure(input.firstSourceRecordCounts);
  validateSourceTypeClosure(input.secondSourceRecordCounts);
  validateOutcomeClosure(input.firstSourceOutcomeCounts);
  validateOutcomeClosure(input.secondSourceOutcomeCounts);
  validateDriftClosure(input.sourceDriftCounts);
  validatePersistenceCounts(input.firstPersistenceCounts);
  validatePersistenceCounts(input.secondPersistenceCounts);
  requireExactKeys(requireRecord(input.aggregateFieldStates), [
    'conflict',
    'known',
    'notApplicable',
    'unknown',
  ]);
  validateStateCounts(input.aggregateFieldStates, 150 * 27);
  if (
    input.fieldCoverage.length !== DETERMINISTIC_PROFILE_FIELD_IDS.length ||
    input.fieldCoverage.some((entry, index) => {
      requireExactKeys(requireRecord(entry), [
        'conflict',
        'fieldId',
        'known',
        'notApplicable',
        'unknown',
      ]);
      validateStateCounts(entry, 150);
      return entry.fieldId !== DETERMINISTIC_PROFILE_FIELD_IDS[index];
    }) ||
    input.familyCoverage.length !== 5 ||
    input.familyCoverage.some((entry) => {
      requireExactKeys(requireRecord(entry), [
        'conflict',
        'family',
        'known',
        'notApplicable',
        'unknown',
      ]);
      validateStateCounts(entry);
      return !isSafeCode(entry.family);
    }) ||
    new Set(input.familyCoverage.map((entry) => entry.family)).size !==
      input.familyCoverage.length ||
    !sameStateCounts(
      input.familyCoverage.reduce(addStateCounts, emptyStateCounts()),
      input.aggregateFieldStates,
    )
  ) {
    throw ingestionError('ingestion.invalid-receipt');
  }
  for (const [records, outcomes] of [
    [input.firstSourceRecordCounts, input.firstSourceOutcomeCounts],
    [input.secondSourceRecordCounts, input.secondSourceOutcomeCounts],
  ] as const) {
    if (
      records.some(
        (entry, index) => entry.count !== sumOutcomeCounts(outcomes[index]),
      )
    ) {
      throw ingestionError('ingestion.invalid-receipt');
    }
  }
  if (
    input.sourceDriftCounts.some((entry, index) => {
      const first = input.firstSourceRecordCounts[index]?.count;
      const second = input.secondSourceRecordCounts[index]?.count;
      return (
        first !== entry.unchanged + entry.changed + entry.withdrawn ||
        second !== entry.unchanged + entry.changed + entry.new
      );
    })
  ) {
    throw ingestionError('ingestion.invalid-receipt');
  }
  const optionalFailures = input.controlledFailureCounts.reduce(
    (total, entry, index) => {
      requireExactKeys(requireRecord(entry), ['code', 'count']);
      if (
        !isSafeCode(entry.code) ||
        !isNonnegativeInteger(entry.count) ||
        entry.count === 0 ||
        (index > 0 &&
          compareText(
            input.controlledFailureCounts[index - 1]?.code ?? '',
            entry.code,
          ) >= 0)
      ) {
        throw ingestionError('ingestion.invalid-receipt');
      }
      return total + entry.count;
    },
    0,
  );
  const unavailableSources = [
    ...input.firstSourceOutcomeCounts,
    ...input.secondSourceOutcomeCounts,
  ].reduce((total, entry) => total + entry.unavailable, 0);
  const fatalSources = [
    ...input.firstSourceOutcomeCounts,
    ...input.secondSourceOutcomeCounts,
  ].reduce((total, entry) => total + entry.fatal, 0);
  const providerDrift = input.sourceDriftCounts.some(
    (entry) => entry.changed + entry.new + entry.withdrawn > 0,
  );
  const firstPersistence = input.firstPersistenceCounts;
  const secondPersistence = input.secondPersistenceCounts;
  const qualifiedPersistence =
    firstPersistence.qualifiedNotPersistedCount +
    secondPersistence.qualifiedNotPersistedCount;
  const secondMutationCount =
    secondPersistence.evidenceAppended +
    secondPersistence.evidenceSuperseded +
    secondPersistence.evidenceInvalidated;
  const completePersistence =
    firstPersistence.persistedCandidateCount === 150 &&
    secondPersistence.persistedCandidateCount === 150 &&
    qualifiedPersistence === 0;
  const exactUnchangedReplay =
    completePersistence &&
    secondPersistence.unchanged === 150 &&
    secondPersistence.created === 0 &&
    secondPersistence.updated === 0 &&
    secondPersistence.candidateCreated === 0 &&
    secondPersistence.candidateIdempotent === 150 &&
    secondPersistence.snapshotCreated === 0 &&
    secondPersistence.snapshotIdempotent === 150 &&
    secondMutationCount === 0;
  if (
    fatalSources !== 0 ||
    optionalFailures !== unavailableSources ||
    (input.liveIdempotency === 'passed' &&
      (providerDrift || !exactUnchangedReplay)) ||
    (input.liveIdempotency === 'passed-with-provider-drift' &&
      (!providerDrift ||
        !completePersistence ||
        secondPersistence.created !== 0)) ||
    (input.liveIdempotency === 'qualified-optional-source-failures' &&
      qualifiedPersistence === 0) ||
    (input.qualification === 'complete' && optionalFailures !== 0) ||
    (input.qualification === 'qualified-optional-source-failures' &&
      optionalFailures === 0) ||
    (input.qualification === 'complete' && qualifiedPersistence !== 0) ||
    (input.qualification === 'qualified-optional-source-failures' &&
      qualifiedPersistence === 0) ||
    (qualifiedPersistence > 0 &&
      input.liveIdempotency !== 'qualified-optional-source-failures')
  ) {
    throw ingestionError('ingestion.invalid-receipt');
  }
}

function validatePersistenceCounts(
  counts: ProfileMaterializationPersistenceCounts,
): void {
  requireExactKeys(requireRecord(counts), [
    'candidateCreated',
    'candidateIdempotent',
    'created',
    'evidenceAppended',
    'evidenceIdempotent',
    'evidenceInvalidated',
    'evidenceSuperseded',
    'persistedCandidateCount',
    'qualifiedNotPersistedCount',
    'snapshotCreated',
    'snapshotIdempotent',
    'unchanged',
    'updated',
  ]);
  const values = [
    counts.candidateCreated,
    counts.candidateIdempotent,
    counts.created,
    counts.evidenceAppended,
    counts.evidenceIdempotent,
    counts.evidenceInvalidated,
    counts.evidenceSuperseded,
    counts.persistedCandidateCount,
    counts.qualifiedNotPersistedCount,
    counts.snapshotCreated,
    counts.snapshotIdempotent,
    counts.unchanged,
    counts.updated,
  ];
  if (
    values.some((value) => !isNonnegativeInteger(value)) ||
    counts.persistedCandidateCount + counts.qualifiedNotPersistedCount !==
      150 ||
    counts.created + counts.updated + counts.unchanged !==
      counts.persistedCandidateCount ||
    counts.candidateCreated + counts.candidateIdempotent !==
      counts.persistedCandidateCount ||
    counts.snapshotCreated + counts.snapshotIdempotent !==
      counts.persistedCandidateCount
  ) {
    throw ingestionError('ingestion.invalid-receipt');
  }
}

function validateSourceTypeClosure(
  entries: readonly ProfileMaterializationCountBySourceType[],
): void {
  if (
    entries.length !== PROFILE_MATERIALIZATION_SOURCE_TYPES.length ||
    entries.some((entry, index) => {
      requireExactKeys(requireRecord(entry), ['count', 'sourceType']);
      return (
        entry.sourceType !== PROFILE_MATERIALIZATION_SOURCE_TYPES[index] ||
        !isNonnegativeInteger(entry.count)
      );
    })
  ) {
    throw ingestionError('ingestion.invalid-receipt');
  }
}

function validateOutcomeClosure(
  entries: readonly ProfileMaterializationOutcomeCountBySourceType[],
): void {
  if (
    entries.length !== PROFILE_MATERIALIZATION_SOURCE_TYPES.length ||
    entries.some((entry, index) => {
      requireExactKeys(requireRecord(entry), [
        'establishedAbsence',
        'establishedValue',
        'fatal',
        'sourceType',
        'unavailable',
      ]);
      return (
        entry.sourceType !== PROFILE_MATERIALIZATION_SOURCE_TYPES[index] ||
        ![
          entry.establishedAbsence,
          entry.establishedValue,
          entry.fatal,
          entry.unavailable,
        ].every(isNonnegativeInteger)
      );
    })
  ) {
    throw ingestionError('ingestion.invalid-receipt');
  }
}

function validateDriftClosure(
  entries: readonly ProfileMaterializationDriftCount[],
): void {
  if (
    entries.length !== PROFILE_MATERIALIZATION_SOURCE_TYPES.length ||
    entries.some((entry, index) => {
      requireExactKeys(requireRecord(entry), [
        'changed',
        'new',
        'sourceType',
        'unchanged',
        'withdrawn',
      ]);
      return (
        entry.sourceType !== PROFILE_MATERIALIZATION_SOURCE_TYPES[index] ||
        ![entry.changed, entry.new, entry.unchanged, entry.withdrawn].every(
          isNonnegativeInteger,
        )
      );
    })
  ) {
    throw ingestionError('ingestion.invalid-receipt');
  }
}

function validateStateCounts(
  counts: ProfileMaterializationStateCounts,
  expectedTotal?: number,
): void {
  const total =
    counts.known + counts.unknown + counts.notApplicable + counts.conflict;
  if (
    ![
      counts.known,
      counts.unknown,
      counts.notApplicable,
      counts.conflict,
    ].every(isNonnegativeInteger) ||
    (expectedTotal !== undefined && total !== expectedTotal)
  ) {
    throw ingestionError('ingestion.invalid-receipt');
  }
}

function emptyStateCounts(): ProfileMaterializationStateCounts {
  return { known: 0, unknown: 0, notApplicable: 0, conflict: 0 };
}

function addStateCounts(
  total: ProfileMaterializationStateCounts,
  entry: ProfileMaterializationStateCounts,
): ProfileMaterializationStateCounts {
  return {
    known: total.known + entry.known,
    unknown: total.unknown + entry.unknown,
    notApplicable: total.notApplicable + entry.notApplicable,
    conflict: total.conflict + entry.conflict,
  };
}

function sameStateCounts(
  left: ProfileMaterializationStateCounts,
  right: ProfileMaterializationStateCounts,
): boolean {
  return canonicalizeJson(left).text === canonicalizeJson(right).text;
}

function sumOutcomeCounts(
  entry: ProfileMaterializationOutcomeCountBySourceType | undefined,
): number {
  if (entry === undefined) throw ingestionError('ingestion.invalid-receipt');
  return (
    entry.establishedValue +
    entry.establishedAbsence +
    entry.unavailable +
    entry.fatal
  );
}

function isNonnegativeInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

export function assertNoForbiddenContent(value: unknown): void {
  const seen = new Set<object>();
  const visit = (entry: unknown): void => {
    if (
      entry === null ||
      typeof entry === 'boolean' ||
      typeof entry === 'number'
    ) {
      return;
    }
    if (typeof entry === 'string') {
      if (
        entry.length > 512 ||
        /(?:https?:\/\/|Bearer\s|postgres(?:ql)?:\/\/|BEGIN [A-Z ]+PRIVATE KEY)/iu.test(
          entry,
        )
      ) {
        throw ingestionError('ingestion.invalid-input');
      }
      return;
    }
    if (typeof entry !== 'object' || seen.has(entry)) {
      throw ingestionError('ingestion.invalid-input');
    }
    seen.add(entry);
    if (Array.isArray(entry)) {
      if (entry.length > 10_000)
        throw ingestionError('ingestion.invalid-input');
      entry.forEach(visit);
    } else {
      for (const [key, nested] of Object.entries(entry)) {
        if (FORBIDDEN_KEY.test(key)) {
          throw ingestionError('ingestion.invalid-input');
        }
        visit(nested);
      }
    }
    seen.delete(entry);
  };
  visit(value);
}

export function requireRecord(value: unknown): Record<string, unknown> {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value) ||
    (Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null)
  ) {
    throw ingestionError('ingestion.invalid-input');
  }
  return value as Record<string, unknown>;
}

export function requireExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): void {
  const actual = Object.keys(value).sort(compareText);
  const sortedExpected = [...expected].sort(compareText);
  if (canonicalizeJson(actual).text !== canonicalizeJson(sortedExpected).text) {
    throw ingestionError('ingestion.invalid-input');
  }
}

export function isDigest(value: unknown): value is string {
  return typeof value === 'string' && HEX_DIGEST.test(value);
}

export function isSafeCode(value: unknown): value is string {
  return typeof value === 'string' && SAFE_CODE.test(value);
}

export function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
