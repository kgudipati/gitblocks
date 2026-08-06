import {
  CONTRACT_VERSION,
  DETERMINISTIC_CANDIDATE_PROFILE_AUTHORITY_VERSION,
  DETERMINISTIC_CANDIDATE_PROFILE_VERSION,
  DETERMINISTIC_PROFILE_DENOMINATOR_VERSION,
  DETERMINISTIC_PROFILE_RULES_VERSION,
  createDeterministicCandidateProfileAuthorityV1,
  createDeterministicCandidateProfileV1,
  type CapabilityTaxonomyV1,
  type DeterministicCandidateProfileAuthorityV1,
  type DeterministicCandidateProfileInputV1,
  type DeterministicProfileFieldRecord,
} from '@gitblocks/contracts';

import { stableId } from './canonical-json.ts';
import { projectCandidateProfile } from './candidate-profile-projection.ts';
import { ingestionError } from './errors.ts';
import {
  PROFILE_MATERIALIZATION_AUTHORIZED_FIELD_IDS,
  PROFILE_MATERIALIZATION_PROJECTION_VERSION,
  compareText,
  requireRecord,
  type ProfileMaterializationAuthorizedFieldId,
  type ProfileMaterializationSourceAuthority,
  type ProfileMaterializationSourceRecord,
} from './profile-materialization-contracts.ts';
import {
  mapProfilePrimaryLanguage,
  projectForkUpstreamState,
} from './profile-materialization-providers.ts';
import { parseProfileMaterializationSourceAuthority } from './profile-materialization-source-authority.ts';
import type { CatalogCandidate, PublicCatalog } from './types.ts';

export interface MaterializedCandidateProfileAuthority {
  readonly projectionVersion: typeof PROFILE_MATERIALIZATION_PROJECTION_VERSION;
  readonly authority: DeterministicCandidateProfileAuthorityV1;
}

export function materializeCandidateProfiles(
  catalog: PublicCatalog,
  taxonomy: CapabilityTaxonomyV1,
  sourceAuthority: ProfileMaterializationSourceAuthority,
): MaterializedCandidateProfileAuthority {
  const validated = parseProfileMaterializationSourceAuthority(sourceAuthority);
  if (
    catalog.candidates.length !== 150 ||
    validated.catalogDigest !== catalog.manifestDigest ||
    validated.taxonomyDigest !== taxonomy.semanticDigest
  ) {
    throw ingestionError('ingestion.invalid-manifest');
  }
  const profiles = [...catalog.candidates]
    .sort((left, right) => compareText(left.candidateId, right.candidateId))
    .map((candidate) =>
      materializeCandidateProfile(candidate, catalog, taxonomy, validated),
    );
  const authority = createDeterministicCandidateProfileAuthorityV1({
    contractVersion: CONTRACT_VERSION,
    authorityVersion: DETERMINISTIC_CANDIDATE_PROFILE_AUTHORITY_VERSION,
    denominatorVersion: DETERMINISTIC_PROFILE_DENOMINATOR_VERSION,
    catalogVersion: catalog.catalogVersion,
    catalogDigest: catalog.manifestDigest,
    taxonomyVersion: taxonomy.taxonomyVersion,
    taxonomySemanticDigest: taxonomy.semanticDigest,
    profileRulesVersion: DETERMINISTIC_PROFILE_RULES_VERSION,
    profiles,
  });
  return Object.freeze({
    projectionVersion: PROFILE_MATERIALIZATION_PROJECTION_VERSION,
    authority,
  });
}

export function materializeCandidateProfile(
  candidate: CatalogCandidate,
  catalog: PublicCatalog,
  taxonomy: CapabilityTaxonomyV1,
  sourceAuthority: ProfileMaterializationSourceAuthority,
): DeterministicCandidateProfileAuthorityV1['profiles'][number] {
  const base = projectCandidateProfile(candidate, catalog, taxonomy);
  const records = sourceAuthority.sourceRecords.filter(
    (record) => record.candidateId === candidate.candidateId,
  );
  const repository = requiredValue(records, 'github-repository-metadata');
  const head = requiredValue(records, 'github-default-branch-head');
  const repositoryIdentity = `${requireString(repository, 'canonicalOwner')}/${requireString(repository, 'canonicalRepository')}`;
  const headSha = requireString(head, 'sha');
  const repositoryRecords = records.filter((record) =>
    [
      'github-community-profile',
      'github-default-branch-head',
      'github-license',
      'github-release',
      'github-repository-metadata',
    ].includes(record.operation),
  );
  const repositorySnapshotId = stableId('source-snapshot', {
    candidateId: candidate.candidateId,
    repositoryIdentity,
    headSha,
    sourceRecordDigests: repositoryRecords.map(
      (record) => record.sourceRecordDigest,
    ),
  });
  const baseFields =
    base.fields as unknown as readonly DeterministicProfileFieldRecord[];
  const fields = baseFields.map((field) => {
    if (
      !PROFILE_MATERIALIZATION_AUTHORIZED_FIELD_IDS.includes(
        field.fieldId as ProfileMaterializationAuthorizedFieldId,
      )
    ) {
      return field;
    }
    return projectStructuredField(
      field.fieldId as ProfileMaterializationAuthorizedFieldId,
      field,
      candidate,
      records,
      repository,
      repositorySnapshotId,
    );
  }) as DeterministicCandidateProfileInputV1['fields'];
  return createDeterministicCandidateProfileV1({
    contractVersion: CONTRACT_VERSION,
    profileVersion: DETERMINISTIC_CANDIDATE_PROFILE_VERSION,
    candidateId: candidate.candidateId,
    catalogBinding: {
      catalogVersion: catalog.catalogVersion,
      catalogDigest: catalog.manifestDigest,
    },
    taxonomyBinding: {
      taxonomyVersion: taxonomy.taxonomyVersion,
      taxonomySemanticDigest: taxonomy.semanticDigest,
    },
    profileRulesVersion: DETERMINISTIC_PROFILE_RULES_VERSION,
    fields,
  });
}

function projectStructuredField(
  fieldId: ProfileMaterializationAuthorizedFieldId,
  base: DeterministicProfileFieldRecord,
  candidate: CatalogCandidate,
  records: readonly ProfileMaterializationSourceRecord[],
  repository: Record<string, unknown>,
  repositorySnapshotId: string,
): DeterministicProfileFieldRecord {
  const repositoryScope = {
    kind: 'repository-snapshot' as const,
    snapshotId: repositorySnapshotId,
  };
  const repositoryRecord = requireRecordEntry(
    records,
    'github-repository-metadata',
  );
  switch (fieldId) {
    case 'repository-discovery-metadata': {
      const primaryLanguage = mapProfilePrimaryLanguage(
        requireNullableString(repository, 'primaryLanguage'),
      );
      const topics = requireStringArray(repository, 'topics');
      if (
        primaryLanguage === undefined ||
        topics.some((topic) => !/^[a-z][a-z0-9-]{0,63}$/u.test(topic))
      ) {
        return structuredUnknown(base, repositoryRecord);
      }
      return structuredKnown(
        fieldId,
        repositoryScope,
        {
          repositoryTopics: topics,
          primaryLanguage,
        },
        [
          repositoryRecord,
          requireRecordEntry(records, 'github-default-branch-head'),
        ],
        ['repository-head', 'repository-metadata'],
      );
    }
    case 'package-publication-version': {
      if (candidate.npmPackage === null) return base;
      const npmRecord = requireRecordEntry(records, 'npm-package');
      const npm = establishedValue(npmRecord);
      const version = requireString(npm, 'selectedVersion');
      return structuredKnown(
        fieldId,
        packageScope(version),
        {
          packageName: requireString(npm, 'name'),
          version,
          publishedAt: requireString(npm, 'publishedAt'),
        },
        [npmRecord],
        ['npm-package-version'],
      );
    }
    case 'runtime-package-format': {
      if (candidate.npmPackage === null) return base;
      const npmRecord = requireRecordEntry(records, 'npm-package');
      const npm = establishedValue(npmRecord);
      const version = requireString(npm, 'selectedVersion');
      const moduleType = requireNullableString(npm, 'moduleType');
      const moduleFormat =
        moduleType === null
          ? 'unspecified'
          : moduleType === 'module'
            ? 'esm'
            : moduleType === 'commonjs'
              ? 'commonjs'
              : null;
      const nodeEngine = requireNullableString(npm, 'nodeEngine');
      if (
        moduleFormat === null ||
        (nodeEngine !== null &&
          (nodeEngine.trim() !== nodeEngine ||
            nodeEngine.length > 100 ||
            /[\p{Cc}\p{Cf}]/u.test(nodeEngine)))
      ) {
        return structuredUnknown(base, npmRecord);
      }
      return structuredKnown(
        fieldId,
        packageScope(version),
        {
          nodeEngineRange: nodeEngine,
          moduleFormat,
          packageFormat: 'npm-package',
          exportsDeclared: requireBoolean(npm, 'exportsDeclared'),
        },
        [npmRecord],
        ['npm-runtime-package-format'],
      );
    }
    case 'license-identity': {
      const licenseRecord = records.find(
        (record) => record.operation === 'github-license',
      );
      if (licenseRecord?.outcome !== 'established-value') {
        return structuredUnknown(base, licenseRecord);
      }
      const license = establishedValue(licenseRecord);
      const spdxId = requireNullableString(license, 'spdxId');
      if (
        spdxId === null ||
        spdxId === 'NOASSERTION' ||
        !/^[A-Za-z0-9][A-Za-z0-9.+-]{0,63}$/u.test(spdxId)
      ) {
        return structuredUnknown(base, licenseRecord);
      }
      return structuredKnown(
        fieldId,
        repositoryScope,
        { spdxId },
        [licenseRecord, repositoryRecord],
        ['github-license-spdx', 'repository-metadata'],
      );
    }
    case 'archived-state':
      return structuredKnown(
        fieldId,
        repositoryScope,
        { archived: requireBoolean(repository, 'isArchived') },
        [repositoryRecord],
        ['repository-archived-state'],
      );
    case 'fork-upstream-state': {
      const forkState = projectForkUpstreamState({
        isFork: requireBoolean(repository, 'isFork'),
        upstreamRepository: requireNullableString(
          repository,
          'upstreamRepository',
        ),
      });
      return forkState === null
        ? structuredUnknown(base, repositoryRecord)
        : structuredKnown(
            fieldId,
            repositoryScope,
            forkState,
            [repositoryRecord],
            ['repository-fork-parent'],
          );
    }
    case 'release-state-recency': {
      const releaseRecord = records.find(
        (record) => record.operation === 'github-release',
      );
      if (releaseRecord?.outcome !== 'established-value') {
        return structuredUnknown(base, releaseRecord);
      }
      const releaseValue = establishedValue(releaseRecord);
      const releases = requireObjectArray(releaseValue, 'releases');
      const selected = releases.find(
        (release) =>
          release['isDraft'] === false &&
          typeof release['tag'] === 'string' &&
          isNormalizedToken(release['tag']) &&
          !/(?:^|[._+/@-])(?:canary|current|head|latest|main|master|next|stable)(?:$|[._+/@-])/iu.test(
            release['tag'],
          ),
      );
      if (selected === undefined) return structuredUnknown(base, releaseRecord);
      return structuredKnown(
        fieldId,
        repositoryScope,
        {
          snapshotAt: releaseRecord.collectedAt,
          latestReleaseVersion: requireString(selected, 'tag'),
          latestReleasePublishedAt: requireString(selected, 'publishedAt'),
          prerelease: requireBoolean(selected, 'isPrerelease'),
        },
        [releaseRecord, repositoryRecord],
        ['github-release-recency', 'repository-metadata'],
      );
    }
    case 'security-advisory-state': {
      if (candidate.npmPackage === null) return base;
      const npmRecord = requireRecordEntry(records, 'npm-package');
      const npm = establishedValue(npmRecord);
      const version = requireString(npm, 'selectedVersion');
      const advisoryRecord = records.find(
        (record) => record.operation === 'github-advisory',
      );
      if (advisoryRecord?.outcome !== 'established-value') {
        return structuredUnknown(base, advisoryRecord ?? npmRecord);
      }
      const advisoryValue = establishedValue(advisoryRecord);
      const advisories = requireObjectArray(advisoryValue, 'advisories').filter(
        (advisory) => advisory['withdrawnAt'] === null,
      );
      const severities = advisories.map((advisory) => advisory['severity']);
      const allowed = new Set(['critical', 'high', 'low', 'moderate']);
      if (
        advisoryValue['complete'] !== true ||
        requireString(advisoryValue, 'packageName') !==
          requireString(npm, 'name') ||
        requireString(advisoryValue, 'packageVersion') !== version ||
        advisories.length === 0 ||
        severities.some(
          (severity) => typeof severity !== 'string' || !allowed.has(severity),
        )
      ) {
        return structuredUnknown(base, advisoryRecord);
      }
      const severityOrder = ['low', 'moderate', 'high', 'critical'];
      const highestSeverity = [...(severities as string[])].sort(
        (left, right) =>
          severityOrder.indexOf(right) - severityOrder.indexOf(left),
      )[0];
      if (highestSeverity === undefined) {
        throw ingestionError('ingestion.internal-invariant');
      }
      return structuredKnown(
        fieldId,
        packageScope(version),
        {
          snapshotAt: advisoryRecord.collectedAt,
          applicableAdvisoryCount: advisories.length,
          highestSeverity,
        },
        [advisoryRecord, npmRecord],
        ['github-applicable-advisories', 'npm-package-version'],
      );
    }
    case 'security-policy-presence': {
      const communityRecord = records.find(
        (record) => record.operation === 'github-community-profile',
      );
      if (communityRecord?.outcome !== 'established-value') {
        return structuredUnknown(base, communityRecord);
      }
      return structuredKnown(
        fieldId,
        repositoryScope,
        {
          present: requireBoolean(
            establishedValue(communityRecord),
            'securityPolicyPresent',
          ),
        },
        [communityRecord, repositoryRecord],
        ['github-security-policy-presence', 'repository-metadata'],
      );
    }
    case 'package-repository-linkage': {
      if (candidate.npmPackage === null) return base;
      const npmRecord = requireRecordEntry(records, 'npm-package');
      const npm = establishedValue(npmRecord);
      const version = requireString(npm, 'selectedVersion');
      const declared = npm['repositoryIdentity'];
      let linkage: 'matched' | 'mismatched' | 'undeclared';
      if (declared === null) {
        linkage = 'undeclared';
      } else {
        const identity = requireRecord(declared);
        const declaredRepository = `${requireString(identity, 'owner')}/${requireString(identity, 'repository')}`;
        linkage =
          declaredRepository.toLowerCase() ===
          `${requireString(repository, 'canonicalOwner')}/${requireString(repository, 'canonicalRepository')}`.toLowerCase()
            ? 'matched'
            : 'mismatched';
      }
      return structuredKnown(
        fieldId,
        packageScope(version),
        { linkage },
        [npmRecord, repositoryRecord],
        ['npm-repository-linkage', 'repository-metadata'],
      );
    }
  }
}

function structuredKnown(
  fieldId: ProfileMaterializationAuthorizedFieldId,
  versionScope:
    | { readonly kind: 'package-version'; readonly version: string }
    | { readonly kind: 'repository-snapshot'; readonly snapshotId: string },
  value: object,
  records: readonly ProfileMaterializationSourceRecord[],
  topicCodes: readonly string[],
): DeterministicProfileFieldRecord {
  return {
    fieldId,
    scope: 'version-specific',
    state: 'known',
    stateReasonCode: 'approved-structured-field-value',
    stateRuleId: 'assign-known-approved-structured-value',
    valueExtractionRuleId: `extract-${fieldId}-from-structured-authority`,
    versionScope,
    sourceReferences: [structuredReference(records, topicCodes)],
    value,
  } as DeterministicProfileFieldRecord;
}

function structuredUnknown(
  base: DeterministicProfileFieldRecord,
  record: ProfileMaterializationSourceRecord | undefined,
): DeterministicProfileFieldRecord {
  return {
    ...base,
    versionScope: null,
    sourceReferences:
      record === undefined
        ? base.sourceReferences
        : [structuredReference([record], [`${record.operation}-unknown`])],
  };
}

function structuredReference(
  records: readonly ProfileMaterializationSourceRecord[],
  topicCodes: readonly string[],
): {
  readonly kind: 'structured-collection';
  readonly sourceSnapshotId: string;
  readonly evidenceIds: readonly string[];
  readonly sourceTopicCodes: readonly string[];
} {
  const sorted = [...records].sort((left, right) =>
    compareText(left.sourceRecordDigest, right.sourceRecordDigest),
  );
  return {
    kind: 'structured-collection',
    sourceSnapshotId: stableId('source-snapshot', {
      sourceRecords: sorted.map((record) => record.sourceRecordDigest),
    }),
    evidenceIds: [
      ...new Set(sorted.flatMap((record) => record.evidenceIds)),
    ].sort(compareText),
    sourceTopicCodes: [...topicCodes].sort(compareText),
  };
}

function packageScope(version: string): {
  readonly kind: 'package-version';
  readonly version: string;
} {
  return { kind: 'package-version', version };
}

function requiredValue(
  records: readonly ProfileMaterializationSourceRecord[],
  operation: ProfileMaterializationSourceRecord['operation'],
): Record<string, unknown> {
  return establishedValue(requireRecordEntry(records, operation));
}

function requireRecordEntry(
  records: readonly ProfileMaterializationSourceRecord[],
  operation: ProfileMaterializationSourceRecord['operation'],
): ProfileMaterializationSourceRecord {
  const result = records.find((record) => record.operation === operation);
  if (result === undefined) throw ingestionError('ingestion.invalid-manifest');
  return result;
}

function establishedValue(
  record: ProfileMaterializationSourceRecord,
): Record<string, unknown> {
  if (record.outcome !== 'established-value') {
    throw ingestionError('ingestion.invalid-manifest');
  }
  return requireRecord(record.normalizedValue);
}

function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string')
    throw ingestionError('ingestion.invalid-input');
  return value;
}

function requireNullableString(
  record: Record<string, unknown>,
  key: string,
): string | null {
  const value = record[key];
  if (value !== null && typeof value !== 'string') {
    throw ingestionError('ingestion.invalid-input');
  }
  return value;
}

function requireBoolean(record: Record<string, unknown>, key: string): boolean {
  const value = record[key];
  if (typeof value !== 'boolean')
    throw ingestionError('ingestion.invalid-input');
  return value;
}

function requireStringArray(
  record: Record<string, unknown>,
  key: string,
): readonly string[] {
  const value = record[key];
  if (!Array.isArray(value)) {
    throw ingestionError('ingestion.invalid-input');
  }
  return value.map((entry) => {
    if (typeof entry !== 'string') {
      throw ingestionError('ingestion.invalid-input');
    }
    return entry;
  });
}

function requireObjectArray(
  record: Record<string, unknown>,
  key: string,
): readonly Record<string, unknown>[] {
  const value = record[key];
  if (!Array.isArray(value)) throw ingestionError('ingestion.invalid-input');
  return value.map(requireRecord);
}

function isNormalizedToken(value: string): boolean {
  return (
    value.length > 0 &&
    value.length <= 100 &&
    value.trim() === value &&
    !/[\p{Cc}\p{Cf}]/u.test(value)
  );
}
