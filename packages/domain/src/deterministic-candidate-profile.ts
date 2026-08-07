import type { CapabilityFamily } from './model.ts';
import {
  addIssue,
  finalizeIssues,
  type DomainIssue,
  type DomainResult,
} from './issues.ts';

export const DETERMINISTIC_CANDIDATE_PROFILE_VERSION =
  'deterministic-candidate-profile/1.0.0' as const;
export const DETERMINISTIC_CANDIDATE_PROFILE_AUTHORITY_VERSION =
  'deterministic-candidate-profile-authority/1.0.0' as const;
export const DETERMINISTIC_PROFILE_DENOMINATOR_VERSION =
  'deterministic-profile-coverage/1.0.0' as const;
export const DETERMINISTIC_PROFILE_RULES_VERSION =
  'deterministic-candidate-profile-rules/1.0.0' as const;

export const DETERMINISTIC_PROFILE_FIELD_IDS = Object.freeze([
  'catalog-role-status',
  'capability-family',
  'repository-identity',
  'adoption-unit-type',
  'capability-variants-features',
  'repository-discovery-metadata',
  'language-ecosystem',
  'package-identity-mapping',
  'package-publication-version',
  'runtime-package-format',
  'framework-compatibility',
  'datastore-requirements',
  'required-infrastructure',
  'optional-infrastructure',
  'deployment-self-hosting',
  'license-identity',
  'archived-state',
  'fork-upstream-state',
  'maintenance-activity',
  'release-state-recency',
  'security-advisory-state',
  'security-policy-presence',
  'documentation-presence',
  'test-ci-presence',
  'artifact-chunk-availability',
  'package-repository-linkage',
  'operational-complexity-primitives',
] as const);

export type DeterministicProfileFieldId =
  (typeof DETERMINISTIC_PROFILE_FIELD_IDS)[number];
export type DeterministicProfileFieldScope =
  'candidate-wide' | 'version-specific';
export type DeterministicProfileFieldState =
  'known' | 'unknown' | 'not-applicable' | 'conflict';
export type DeterministicProfileValueKind =
  | 'adoption-unit-concept-set'
  | 'advisory-summary'
  | 'archived-state'
  | 'artifact-chunk-summary'
  | 'capability-family-set'
  | 'catalog-role-status'
  | 'datastore-set'
  | 'deployment-concept-set'
  | 'discovery-metadata'
  | 'documentation-summary'
  | 'feature-concept-set'
  | 'fork-upstream-state'
  | 'framework-set'
  | 'infrastructure-concept-set'
  | 'language-ecosystem-set'
  | 'license-identity'
  | 'maintenance-snapshot'
  | 'operational-primitives'
  | 'package-identity-mapping'
  | 'package-publication'
  | 'package-repository-linkage'
  | 'release-snapshot'
  | 'repository-identity'
  | 'runtime-package-format'
  | 'security-policy-presence'
  | 'test-ci-presence';

export type DeterministicProfileIntendedUse =
  | 'broad-retrieval'
  | 'candidate-generation'
  | 'explanation'
  | 'hard-exclusion'
  | 'later-ranking';

export const DETERMINISTIC_PROFILE_LAUNCH_HARD_FILTER_FACETS = Object.freeze([
  'capability-family',
  'architecture',
  'feature',
  'package-availability',
  'runtime',
  'framework',
  'datastore',
  'required-infrastructure',
  'deployment',
  'license',
  'repository-state',
  'maintenance',
  'release',
  'security-advisory',
  'security-policy',
  'operational-complexity',
] as const);

export type DeterministicProfileLaunchHardFilterFacet =
  (typeof DETERMINISTIC_PROFILE_LAUNCH_HARD_FILTER_FACETS)[number];

export const DETERMINISTIC_PROFILE_BROAD_RETRIEVAL_FACETS = Object.freeze([
  'capability-family',
  'candidate-identity',
  'adoption-unit',
  'feature',
  'repository-discovery',
  'language-ecosystem',
  'infrastructure',
  'deployment',
  'operations',
] as const);

export type DeterministicProfileBroadRetrievalFacet =
  (typeof DETERMINISTIC_PROFILE_BROAD_RETRIEVAL_FACETS)[number];

export interface DeterministicProfileFieldDefinition {
  readonly fieldId: DeterministicProfileFieldId;
  readonly ordinal: number;
  readonly scope: DeterministicProfileFieldScope;
  readonly valueKind: DeterministicProfileValueKind;
  readonly notApplicablePermitted: boolean;
  readonly intendedUses: readonly DeterministicProfileIntendedUse[];
  readonly launchHardFilterFacet: DeterministicProfileLaunchHardFilterFacet | null;
  readonly broadRetrievalFacet: DeterministicProfileBroadRetrievalFacet | null;
}

const ALL_USES = Object.freeze([
  'candidate-generation',
  'hard-exclusion',
  'broad-retrieval',
  'later-ranking',
  'explanation',
] as const);
const RETRIEVAL_USES = Object.freeze([
  'candidate-generation',
  'broad-retrieval',
  'later-ranking',
  'explanation',
] as const);
const RANKING_USES = Object.freeze(['later-ranking', 'explanation'] as const);

const FIELD_REGISTRY_AUTHORITY: readonly DeterministicProfileFieldDefinition[] =
  deepFreeze([
    definition(
      1,
      'catalog-role-status',
      'candidate-wide',
      'catalog-role-status',
      false,
      RANKING_USES,
      null,
      null,
    ),
    definition(
      2,
      'capability-family',
      'candidate-wide',
      'capability-family-set',
      false,
      ALL_USES,
      'capability-family',
      'capability-family',
    ),
    definition(
      3,
      'repository-identity',
      'candidate-wide',
      'repository-identity',
      false,
      RETRIEVAL_USES,
      null,
      'candidate-identity',
    ),
    definition(
      4,
      'adoption-unit-type',
      'candidate-wide',
      'adoption-unit-concept-set',
      false,
      ALL_USES,
      'architecture',
      'adoption-unit',
    ),
    definition(
      5,
      'capability-variants-features',
      'candidate-wide',
      'feature-concept-set',
      false,
      ALL_USES,
      'feature',
      'feature',
    ),
    definition(
      6,
      'repository-discovery-metadata',
      'version-specific',
      'discovery-metadata',
      false,
      RETRIEVAL_USES,
      null,
      'repository-discovery',
    ),
    definition(
      7,
      'language-ecosystem',
      'version-specific',
      'language-ecosystem-set',
      false,
      ALL_USES,
      null,
      'language-ecosystem',
    ),
    definition(
      8,
      'package-identity-mapping',
      'candidate-wide',
      'package-identity-mapping',
      false,
      ALL_USES,
      'package-availability',
      'candidate-identity',
    ),
    definition(
      9,
      'package-publication-version',
      'version-specific',
      'package-publication',
      true,
      RANKING_USES,
      null,
      null,
    ),
    definition(
      10,
      'runtime-package-format',
      'version-specific',
      'runtime-package-format',
      true,
      ALL_USES,
      'runtime',
      null,
    ),
    definition(
      11,
      'framework-compatibility',
      'version-specific',
      'framework-set',
      false,
      ALL_USES,
      'framework',
      null,
    ),
    definition(
      12,
      'datastore-requirements',
      'version-specific',
      'datastore-set',
      false,
      ALL_USES,
      'datastore',
      null,
    ),
    definition(
      13,
      'required-infrastructure',
      'version-specific',
      'infrastructure-concept-set',
      false,
      ALL_USES,
      'required-infrastructure',
      'infrastructure',
    ),
    definition(
      14,
      'optional-infrastructure',
      'version-specific',
      'infrastructure-concept-set',
      false,
      RANKING_USES,
      null,
      'infrastructure',
    ),
    definition(
      15,
      'deployment-self-hosting',
      'version-specific',
      'deployment-concept-set',
      false,
      ALL_USES,
      'deployment',
      'deployment',
    ),
    definition(
      16,
      'license-identity',
      'version-specific',
      'license-identity',
      false,
      ALL_USES,
      'license',
      null,
    ),
    definition(
      17,
      'archived-state',
      'version-specific',
      'archived-state',
      false,
      ALL_USES,
      'repository-state',
      null,
    ),
    definition(
      18,
      'fork-upstream-state',
      'version-specific',
      'fork-upstream-state',
      false,
      RANKING_USES,
      null,
      null,
    ),
    definition(
      19,
      'maintenance-activity',
      'version-specific',
      'maintenance-snapshot',
      false,
      ALL_USES,
      'maintenance',
      null,
    ),
    definition(
      20,
      'release-state-recency',
      'version-specific',
      'release-snapshot',
      false,
      ALL_USES,
      'release',
      null,
    ),
    definition(
      21,
      'security-advisory-state',
      'version-specific',
      'advisory-summary',
      false,
      ALL_USES,
      'security-advisory',
      null,
    ),
    definition(
      22,
      'security-policy-presence',
      'version-specific',
      'security-policy-presence',
      false,
      ALL_USES,
      'security-policy',
      null,
    ),
    definition(
      23,
      'documentation-presence',
      'version-specific',
      'documentation-summary',
      false,
      RANKING_USES,
      null,
      null,
    ),
    definition(
      24,
      'test-ci-presence',
      'version-specific',
      'test-ci-presence',
      false,
      RANKING_USES,
      null,
      null,
    ),
    definition(
      25,
      'artifact-chunk-availability',
      'version-specific',
      'artifact-chunk-summary',
      false,
      RANKING_USES,
      null,
      null,
    ),
    definition(
      26,
      'package-repository-linkage',
      'version-specific',
      'package-repository-linkage',
      true,
      RANKING_USES,
      null,
      null,
    ),
    definition(
      27,
      'operational-complexity-primitives',
      'version-specific',
      'operational-primitives',
      false,
      ALL_USES,
      'operational-complexity',
      'operations',
    ),
  ]);

function definition(
  ordinal: number,
  fieldId: DeterministicProfileFieldId,
  scope: DeterministicProfileFieldScope,
  valueKind: DeterministicProfileValueKind,
  notApplicablePermitted: boolean,
  intendedUses: readonly DeterministicProfileIntendedUse[],
  launchHardFilterFacet: DeterministicProfileLaunchHardFilterFacet | null,
  broadRetrievalFacet: DeterministicProfileBroadRetrievalFacet | null,
): DeterministicProfileFieldDefinition {
  return {
    fieldId,
    ordinal,
    scope,
    valueKind,
    notApplicablePermitted,
    intendedUses: [...intendedUses],
    launchHardFilterFacet,
    broadRetrievalFacet,
  };
}

export function getDeterministicProfileFieldRegistry(): readonly DeterministicProfileFieldDefinition[] {
  return deepFreeze(
    FIELD_REGISTRY_AUTHORITY.map((entry) => ({
      ...entry,
      intendedUses: [...entry.intendedUses],
    })),
  );
}

export function validateDeterministicProfileFieldRegistry(
  value: unknown,
): DomainResult<readonly DeterministicProfileFieldDefinition[]> {
  const issues: DomainIssue[] = [];
  if (
    !Array.isArray(value) ||
    value.length !== FIELD_REGISTRY_AUTHORITY.length
  ) {
    addIssue(issues, 'profile.registry', '$');
  } else if (canonicalText(value) !== canonicalText(FIELD_REGISTRY_AUTHORITY)) {
    addIssue(issues, 'profile.registry', '$');
  }
  return issues.length === 0
    ? { ok: true, value: getDeterministicProfileFieldRegistry() }
    : { ok: false, issues: finalizeIssues(issues) };
}

export type ProfileCatalogFieldCode =
  | 'additional-capability-families'
  | 'candidate-id'
  | 'display-name'
  | 'github-owner'
  | 'github-repository'
  | 'npm-package'
  | 'primary-capability-family'
  | 'status';

export type DeterministicProfileSourceReference =
  | {
      readonly kind: 'catalog-field';
      readonly candidateId: string;
      readonly catalogField: ProfileCatalogFieldCode;
    }
  | {
      readonly kind: 'structured-collection';
      readonly sourceSnapshotId: string;
      readonly evidenceIds: readonly string[];
      readonly sourceTopicCodes: readonly string[];
    }
  | {
      readonly kind: 'artifact-set-entry';
      readonly artifactSetId: string;
      readonly selectionId: string;
      readonly entryOutcome: 'materialized' | 'not-found' | 'unavailable';
      readonly artifactId: string | null;
    }
  | {
      readonly kind: 'derived-profile-fields';
      readonly derivationRuleId: string;
      readonly inputFieldIds: readonly DeterministicProfileFieldId[];
    };

export type DeterministicProfileVersionScope =
  | { readonly kind: 'package-version'; readonly version: string }
  | { readonly kind: 'repository-snapshot'; readonly snapshotId: string };

interface CompleteConceptSet {
  readonly completeness: 'complete';
  readonly conceptIds: readonly string[];
}

export interface DeterministicProfileValueByFieldId {
  readonly 'catalog-role-status': {
    readonly catalogStatus:
      'active' | 'archived' | 'moved' | 'negative-control';
  };
  readonly 'capability-family': {
    readonly primaryFamily: CapabilityFamily;
    readonly additionalFamilies: readonly CapabilityFamily[];
  };
  readonly 'repository-identity': {
    readonly candidateId: string;
    readonly displayName: string;
    readonly githubOwner: string;
    readonly githubRepository: string;
  };
  readonly 'adoption-unit-type': CompleteConceptSet;
  readonly 'capability-variants-features': CompleteConceptSet;
  readonly 'repository-discovery-metadata': {
    readonly repositoryTopics: readonly string[];
    readonly primaryLanguage: ProfileLanguageEcosystem | null;
  };
  readonly 'language-ecosystem': {
    readonly ecosystems: readonly ProfileLanguageEcosystem[];
  };
  readonly 'package-identity-mapping':
    | { readonly mapping: 'mapped'; readonly packageName: string }
    | { readonly mapping: 'unmapped' };
  readonly 'package-publication-version': {
    readonly packageName: string;
    readonly version: string;
    readonly publishedAt: string;
  };
  readonly 'runtime-package-format': {
    readonly nodeEngineRange: string | null;
    readonly moduleFormat: 'commonjs' | 'dual' | 'esm' | 'unspecified';
    readonly packageFormat: 'npm-package';
    readonly exportsDeclared: boolean;
  };
  readonly 'framework-compatibility': {
    readonly frameworks: readonly ProfileFramework[];
  };
  readonly 'datastore-requirements': {
    readonly datastores: readonly ProfileDatastore[];
  };
  readonly 'required-infrastructure': CompleteConceptSet;
  readonly 'optional-infrastructure': CompleteConceptSet;
  readonly 'deployment-self-hosting': CompleteConceptSet;
  readonly 'license-identity': { readonly spdxId: string };
  readonly 'archived-state': { readonly archived: boolean };
  readonly 'fork-upstream-state': {
    readonly fork: boolean;
    readonly upstreamRepository: string | null;
  };
  readonly 'maintenance-activity': {
    readonly snapshotAt: string;
    readonly lastCommitAt: string | null;
    readonly commitsInPrevious90Days: number;
  };
  readonly 'release-state-recency': {
    readonly snapshotAt: string;
    readonly latestReleaseVersion: string | null;
    readonly latestReleasePublishedAt: string | null;
    readonly prerelease: boolean | null;
  };
  readonly 'security-advisory-state': {
    readonly snapshotAt: string;
    readonly applicableAdvisoryCount: number;
    readonly highestSeverity: ProfileAdvisorySeverity | null;
  };
  readonly 'security-policy-presence': { readonly present: boolean };
  readonly 'documentation-presence': {
    readonly readmePresent: boolean;
    readonly documentationDirectoryPresent: boolean;
  };
  readonly 'test-ci-presence': {
    readonly testsPresent: boolean;
    readonly ciConfigurationPresent: boolean;
  };
  readonly 'artifact-chunk-availability': {
    readonly artifactSetId: string;
    readonly materializedArtifactCount: number;
    readonly chunkCount: number;
  };
  readonly 'package-repository-linkage': {
    readonly linkage: 'matched' | 'mismatched' | 'undeclared';
  };
  readonly 'operational-complexity-primitives': {
    readonly processRoles: readonly ProfileProcessRole[];
    readonly requiresScheduledExecution: boolean;
    readonly requiresPersistentStorage: boolean;
  };
}

export type ProfileLanguageEcosystem =
  | 'dotnet'
  | 'go'
  | 'java'
  | 'javascript'
  | 'php'
  | 'python'
  | 'ruby'
  | 'rust'
  | 'typescript';
export type ProfileFramework =
  | 'django'
  | 'express'
  | 'fastify'
  | 'laravel'
  | 'nestjs'
  | 'nextjs'
  | 'rails'
  | 'spring';
export type ProfileDatastore =
  'dynamodb' | 'mongodb' | 'mysql' | 'postgresql' | 'redis' | 'sqlite';
export type ProfileAdvisorySeverity = 'critical' | 'high' | 'low' | 'moderate';
export type ProfileProcessRole =
  | 'api-server'
  | 'background-worker'
  | 'database-extension'
  | 'scheduled-task'
  | 'sidecar';

export type DeterministicProfileValue =
  DeterministicProfileValueByFieldId[DeterministicProfileFieldId];

export type DeterministicProfileStateReasonCode =
  | 'approved-catalog-field-value'
  | 'approved-artifact-field-value'
  | 'approved-derived-field-value'
  | 'approved-structured-field-value'
  | 'artifact-materialization-authority-not-committed'
  | 'conflicting-approved-values'
  | 'conflicting-approved-structured-values'
  | 'package-mapping-unmapped'
  | 'repository-wide-analysis-not-performed'
  | 'requires-reviewed-curator-classification'
  | 'source-code-semantic-analysis-out-of-scope'
  | 'structured-provider-value-not-committed';

export type DeterministicProfileStateRuleId =
  | 'assign-known-approved-catalog-value'
  | 'assign-known-approved-artifact-value'
  | 'assign-known-approved-structured-value'
  | 'assign-known-deterministic-derived-value'
  | 'assign-not-applicable-for-unmapped-package'
  | 'assign-unknown-artifact-authority-missing'
  | 'assign-unknown-repository-analysis-missing'
  | 'assign-unknown-reviewed-classification-missing'
  | 'assign-unknown-source-analysis-out-of-scope'
  | 'assign-unknown-structured-provider-value-missing'
  | 'retain-conflicting-approved-claims';

export type DeterministicProfileExtractionRuleId =
  | 'extract-catalog-role-status'
  | 'extract-capability-family'
  | 'extract-package-identity-mapping'
  | 'extract-repository-identity'
  | `extract-${Exclude<DeterministicProfileFieldId, 'catalog-role-status' | 'capability-family' | 'package-identity-mapping' | 'repository-identity'>}-from-structured-authority`
  | `extract-${DeterministicProfileFieldId}-from-artifact-set-authority`
  | `derive-${DeterministicProfileFieldId}-from-profile-fields`;

interface DeterministicProfileFieldCommon<
  FieldId extends DeterministicProfileFieldId,
> {
  readonly fieldId: FieldId;
  readonly scope: DeterministicProfileFieldScope;
  readonly stateReasonCode: DeterministicProfileStateReasonCode;
  readonly stateRuleId: DeterministicProfileStateRuleId;
  readonly versionScope: DeterministicProfileVersionScope | null;
  readonly sourceReferences: readonly DeterministicProfileSourceReference[];
}

export interface DeterministicProfileConflictClaim<
  FieldId extends DeterministicProfileFieldId = DeterministicProfileFieldId,
> {
  readonly value: DeterministicProfileValueByFieldId[FieldId];
  readonly valueExtractionRuleId: DeterministicProfileExtractionRuleId;
  readonly sourceReferences: readonly DeterministicProfileSourceReference[];
}

export type DeterministicProfileFieldRecord<
  FieldId extends DeterministicProfileFieldId = DeterministicProfileFieldId,
> =
  | (DeterministicProfileFieldCommon<FieldId> & {
      readonly state: 'known';
      readonly valueExtractionRuleId: DeterministicProfileExtractionRuleId;
      readonly value: DeterministicProfileValueByFieldId[FieldId];
    })
  | (DeterministicProfileFieldCommon<FieldId> & {
      readonly state: 'unknown';
      readonly valueExtractionRuleId: null;
    })
  | (DeterministicProfileFieldCommon<FieldId> & {
      readonly state: 'not-applicable';
      readonly valueExtractionRuleId: null;
    })
  | (DeterministicProfileFieldCommon<FieldId> & {
      readonly state: 'conflict';
      readonly valueExtractionRuleId: null;
      readonly claims: readonly DeterministicProfileConflictClaim<FieldId>[];
    });

export interface DeterministicCandidateProfile {
  readonly contractVersion: '1.0.0';
  readonly profileVersion: typeof DETERMINISTIC_CANDIDATE_PROFILE_VERSION;
  readonly deterministicProfileId: string;
  readonly candidateId: string;
  readonly catalogBinding: {
    readonly catalogVersion: string;
    readonly catalogDigest: string;
  };
  readonly taxonomyBinding: {
    readonly taxonomyVersion: string;
    readonly taxonomySemanticDigest: string;
  };
  readonly profileRulesVersion: typeof DETERMINISTIC_PROFILE_RULES_VERSION;
  readonly fields: readonly DeterministicProfileFieldRecord[];
  readonly semanticProfileDigest: string;
}

export interface DeterministicCandidateProfileAuthority {
  readonly contractVersion: '1.0.0';
  readonly authorityVersion: typeof DETERMINISTIC_CANDIDATE_PROFILE_AUTHORITY_VERSION;
  readonly denominatorVersion: typeof DETERMINISTIC_PROFILE_DENOMINATOR_VERSION;
  readonly catalogVersion: string;
  readonly catalogDigest: string;
  readonly taxonomyVersion: string;
  readonly taxonomySemanticDigest: string;
  readonly profileRulesVersion: typeof DETERMINISTIC_PROFILE_RULES_VERSION;
  readonly profiles: readonly DeterministicCandidateProfile[];
  readonly semanticAuthorityDigest: string;
}

export function canonicalizeDeterministicCandidateProfile(
  profile: DeterministicCandidateProfile,
): DeterministicCandidateProfile {
  const byId = new Map(profile.fields.map((field) => [field.fieldId, field]));
  return ownValue({
    ...profile,
    catalogBinding: { ...profile.catalogBinding },
    taxonomyBinding: { ...profile.taxonomyBinding },
    fields: DETERMINISTIC_PROFILE_FIELD_IDS.map((fieldId) =>
      canonicalizeField(requireField(byId, fieldId)),
    ),
  });
}

export function validateDeterministicCandidateProfile(
  profile: DeterministicCandidateProfile,
): DomainResult<DeterministicCandidateProfile> {
  const issues: DomainIssue[] = [];
  if (
    textsDiffer(
      profile.profileVersion,
      DETERMINISTIC_CANDIDATE_PROFILE_VERSION,
    ) ||
    textsDiffer(
      profile.profileRulesVersion,
      DETERMINISTIC_PROFILE_RULES_VERSION,
    ) ||
    profile.fields.length !== DETERMINISTIC_PROFILE_FIELD_IDS.length
  ) {
    addIssue(issues, 'profile.invariant', '$');
  }
  const seen = new Set<DeterministicProfileFieldId>();
  const fieldsById = new Map<
    DeterministicProfileFieldId,
    DeterministicProfileFieldRecord
  >();
  const dependencies = new Map<
    DeterministicProfileFieldId,
    DeterministicProfileFieldId[]
  >();
  for (const [index, field] of profile.fields.entries()) {
    const definition = FIELD_REGISTRY_AUTHORITY[index];
    if (
      field.fieldId !== definition?.fieldId ||
      field.scope !== definition.scope ||
      seen.has(field.fieldId)
    ) {
      addIssue(issues, 'profile.invariant', `$.fields[${String(index)}]`);
      continue;
    }
    seen.add(field.fieldId);
    fieldsById.set(field.fieldId, field);
    validateField(field, definition, profile.candidateId, issues, index);
    const dependencySources = [
      ...field.sourceReferences,
      ...(field.state === 'conflict'
        ? field.claims.flatMap((claim) => claim.sourceReferences)
        : []),
    ];
    dependencies.set(
      field.fieldId,
      dependencySources.flatMap((source) =>
        source.kind === 'derived-profile-fields' ? source.inputFieldIds : [],
      ),
    );
  }
  if (hasDependencyCycle(dependencies)) {
    addIssue(issues, 'profile.source', '$.fields');
  }
  validateProfileFieldRelationships(profile.candidateId, fieldsById, issues);
  return issues.length === 0
    ? { ok: true, value: canonicalizeDeterministicCandidateProfile(profile) }
    : { ok: false, issues: finalizeIssues(issues) };
}

function validateProfileFieldRelationships(
  candidateId: string,
  fields: ReadonlyMap<
    DeterministicProfileFieldId,
    DeterministicProfileFieldRecord
  >,
  issues: DomainIssue[],
): void {
  const repositoryIdentity = fields.get('repository-identity') as
    DeterministicProfileFieldRecord<'repository-identity'> | undefined;
  const repositoryClaims =
    repositoryIdentity?.state === 'known'
      ? [repositoryIdentity.value]
      : repositoryIdentity?.state === 'conflict'
        ? repositoryIdentity.claims.map(({ value }) => value)
        : [];
  if (repositoryClaims.some((value) => value.candidateId !== candidateId)) {
    addIssue(
      issues,
      'profile.invariant',
      `$.fields[${String(
        DETERMINISTIC_PROFILE_FIELD_IDS.indexOf('repository-identity'),
      )}]`,
    );
  }

  const packageMapping = fields.get('package-identity-mapping') as
    DeterministicProfileFieldRecord<'package-identity-mapping'> | undefined;
  for (const fieldId of [
    'package-publication-version',
    'runtime-package-format',
    'package-repository-linkage',
  ] as const) {
    const field = fields.get(fieldId) as
      DeterministicProfileFieldRecord<typeof fieldId> | undefined;
    if (field === undefined) continue;
    const knownMapping =
      packageMapping?.state === 'known' ? packageMapping.value : null;
    const mappingIsUnmapped = knownMapping?.mapping === 'unmapped';
    if (
      (field.state === 'not-applicable' && !mappingIsUnmapped) ||
      (mappingIsUnmapped && field.state !== 'not-applicable') ||
      (field.state === 'known' && knownMapping?.mapping !== 'mapped') ||
      (fieldId === 'package-publication-version' &&
        field.state === 'known' &&
        knownMapping?.mapping === 'mapped' &&
        (
          field as Extract<
            DeterministicProfileFieldRecord<'package-publication-version'>,
            { readonly state: 'known' }
          >
        ).value.packageName !== knownMapping.packageName)
    ) {
      addIssue(
        issues,
        'profile.invariant',
        `$.fields[${String(DETERMINISTIC_PROFILE_FIELD_IDS.indexOf(fieldId))}]`,
      );
    }
  }
}

export function validateDeterministicCandidateProfileAuthority(
  authority: DeterministicCandidateProfileAuthority,
): DomainResult<DeterministicCandidateProfileAuthority> {
  const issues: DomainIssue[] = [];
  if (
    textsDiffer(
      authority.authorityVersion,
      DETERMINISTIC_CANDIDATE_PROFILE_AUTHORITY_VERSION,
    ) ||
    textsDiffer(
      authority.denominatorVersion,
      DETERMINISTIC_PROFILE_DENOMINATOR_VERSION,
    ) ||
    textsDiffer(
      authority.profileRulesVersion,
      DETERMINISTIC_PROFILE_RULES_VERSION,
    ) ||
    authority.profiles.length !== 150
  ) {
    addIssue(issues, 'profile.authority', '$');
  }
  let prior = '';
  const seen = new Set<string>();
  const profiles: DeterministicCandidateProfile[] = [];
  for (const [index, profile] of authority.profiles.entries()) {
    const result = validateDeterministicCandidateProfile(profile);
    if (
      !result.ok ||
      seen.has(profile.candidateId) ||
      profile.candidateId <= prior ||
      profile.catalogBinding.catalogVersion !== authority.catalogVersion ||
      profile.catalogBinding.catalogDigest !== authority.catalogDigest ||
      profile.taxonomyBinding.taxonomyVersion !== authority.taxonomyVersion ||
      profile.taxonomyBinding.taxonomySemanticDigest !==
        authority.taxonomySemanticDigest ||
      textsDiffer(profile.profileRulesVersion, authority.profileRulesVersion)
    ) {
      addIssue(issues, 'profile.authority', `$.profiles[${String(index)}]`);
    } else {
      profiles.push(result.value);
    }
    seen.add(profile.candidateId);
    prior = profile.candidateId;
  }
  return issues.length === 0
    ? {
        ok: true,
        value: ownValue({ ...authority, profiles }),
      }
    : { ok: false, issues: finalizeIssues(issues) };
}

function validateField(
  field: DeterministicProfileFieldRecord,
  definition: DeterministicProfileFieldDefinition,
  candidateId: string,
  issues: DomainIssue[],
  index: number,
): void {
  const path = `$.fields[${String(index)}]`;
  if (
    (definition.scope === 'candidate-wide' && field.versionScope !== null) ||
    (definition.scope === 'version-specific' &&
      (field.state === 'known' || field.state === 'conflict') &&
      field.versionScope === null)
  ) {
    addIssue(issues, 'profile.invariant', `${path}.versionScope`);
  }
  validateSources(
    field.sourceReferences,
    candidateId,
    field.fieldId,
    issues,
    `${path}.sourceReferences`,
  );
  if (field.state === 'known') {
    if (
      !isNonNullExtractionRule(field.valueExtractionRuleId) ||
      field.sourceReferences.length === 0 ||
      !isFieldValue(field.fieldId, field.value) ||
      !isExtractionRuleForField(field.fieldId, field.valueExtractionRuleId) ||
      !isKnownStateAuthorityCoherent(field)
    ) {
      addIssue(issues, 'profile.invariant', path);
    }
  } else if (field.state === 'unknown') {
    if (!isUnknownStateMetadataCoherent(field)) {
      addIssue(issues, 'profile.invariant', path);
    }
  } else if (field.state === 'not-applicable') {
    if (
      !definition.notApplicablePermitted ||
      field.sourceReferences.length === 0 ||
      field.stateReasonCode !== 'package-mapping-unmapped' ||
      field.stateRuleId !== 'assign-not-applicable-for-unmapped-package' ||
      field.sourceReferences.some(
        (source) =>
          source.kind !== 'catalog-field' ||
          source.catalogField !== 'npm-package',
      )
    ) {
      addIssue(issues, 'profile.invariant', path);
    }
  } else {
    if (
      field.claims.length < 2 ||
      field.stateRuleId !== 'retain-conflicting-approved-claims' ||
      (field.stateReasonCode !== 'conflicting-approved-values' &&
        field.stateReasonCode !== 'conflicting-approved-structured-values')
    ) {
      addIssue(issues, 'profile.invariant', `${path}.claims`);
    }
    const claims = new Set<string>();
    for (const [claimIndex, claim] of field.claims.entries()) {
      if (
        claim.sourceReferences.length === 0 ||
        !isFieldValue(field.fieldId, claim.value) ||
        !isExtractionRuleForField(field.fieldId, claim.valueExtractionRuleId) ||
        !isExtractionSourceCoherent(
          claim.valueExtractionRuleId,
          claim.sourceReferences,
        )
      ) {
        addIssue(
          issues,
          'profile.invariant',
          `${path}.claims[${String(claimIndex)}]`,
        );
      }
      validateSources(
        claim.sourceReferences,
        candidateId,
        field.fieldId,
        issues,
        `${path}.claims[${String(claimIndex)}].sourceReferences`,
      );
      claims.add(canonicalText(claim.value));
    }
    if (claims.size !== field.claims.length) {
      addIssue(issues, 'profile.invariant', `${path}.claims`);
    }
  }
}

function isExtractionRuleForField(
  fieldId: DeterministicProfileFieldId,
  ruleId: DeterministicProfileExtractionRuleId,
): boolean {
  const current =
    fieldId === 'catalog-role-status'
      ? 'extract-catalog-role-status'
      : fieldId === 'capability-family'
        ? 'extract-capability-family'
        : fieldId === 'repository-identity'
          ? 'extract-repository-identity'
          : fieldId === 'package-identity-mapping'
            ? 'extract-package-identity-mapping'
            : null;
  return (
    ruleId === current ||
    (current === null &&
      ruleId === `extract-${fieldId}-from-structured-authority`) ||
    ruleId === `extract-${fieldId}-from-artifact-set-authority` ||
    ruleId === `derive-${fieldId}-from-profile-fields`
  );
}

function isKnownStateAuthorityCoherent(
  field: Extract<DeterministicProfileFieldRecord, { readonly state: 'known' }>,
): boolean {
  const catalogRule =
    field.valueExtractionRuleId === 'extract-catalog-role-status' ||
    field.valueExtractionRuleId === 'extract-capability-family' ||
    field.valueExtractionRuleId === 'extract-repository-identity' ||
    field.valueExtractionRuleId === 'extract-package-identity-mapping';
  if (catalogRule) {
    if (
      field.stateReasonCode !== 'approved-catalog-field-value' ||
      field.stateRuleId !== 'assign-known-approved-catalog-value' ||
      field.sourceReferences.some((source) => source.kind !== 'catalog-field')
    ) {
      return false;
    }
    const actual = new Set(
      field.sourceReferences.flatMap((source) =>
        source.kind === 'catalog-field' ? [source.catalogField] : [],
      ),
    );
    const expected =
      field.fieldId === 'catalog-role-status'
        ? ['status']
        : field.fieldId === 'capability-family'
          ? ['additional-capability-families', 'primary-capability-family']
          : field.fieldId === 'repository-identity'
            ? [
                'candidate-id',
                'display-name',
                'github-owner',
                'github-repository',
              ]
            : ['npm-package'];
    return (
      actual.size === expected.length &&
      expected.every((code) => actual.has(code as ProfileCatalogFieldCode))
    );
  }
  if (
    !isExtractionSourceCoherent(
      field.valueExtractionRuleId,
      field.sourceReferences,
    )
  ) {
    return false;
  }
  if (field.valueExtractionRuleId.endsWith('-from-structured-authority')) {
    return (
      field.stateReasonCode === 'approved-structured-field-value' &&
      field.stateRuleId === 'assign-known-approved-structured-value'
    );
  }
  if (field.valueExtractionRuleId.endsWith('-from-artifact-set-authority')) {
    return (
      field.stateReasonCode === 'approved-artifact-field-value' &&
      field.stateRuleId === 'assign-known-approved-artifact-value'
    );
  }
  return (
    field.stateReasonCode === 'approved-derived-field-value' &&
    field.stateRuleId === 'assign-known-deterministic-derived-value'
  );
}

function isExtractionSourceCoherent(
  ruleId: DeterministicProfileExtractionRuleId,
  sources: readonly DeterministicProfileSourceReference[],
): boolean {
  if (sources.length === 0) return false;
  const kind = ruleId.endsWith('-from-structured-authority')
    ? 'structured-collection'
    : ruleId.endsWith('-from-artifact-set-authority')
      ? 'artifact-set-entry'
      : ruleId.endsWith('-from-profile-fields')
        ? 'derived-profile-fields'
        : 'catalog-field';
  return sources.every((source) => source.kind === kind);
}

function isUnknownStateMetadataCoherent(
  field: DeterministicProfileFieldRecord,
): boolean {
  const expectedRule: Readonly<
    Record<
      Exclude<
        DeterministicProfileStateReasonCode,
        | 'approved-artifact-field-value'
        | 'approved-catalog-field-value'
        | 'approved-derived-field-value'
        | 'approved-structured-field-value'
        | 'conflicting-approved-structured-values'
        | 'conflicting-approved-values'
        | 'package-mapping-unmapped'
      >,
      DeterministicProfileStateRuleId
    >
  > = {
    'artifact-materialization-authority-not-committed':
      'assign-unknown-artifact-authority-missing',
    'repository-wide-analysis-not-performed':
      'assign-unknown-repository-analysis-missing',
    'requires-reviewed-curator-classification':
      'assign-unknown-reviewed-classification-missing',
    'source-code-semantic-analysis-out-of-scope':
      'assign-unknown-source-analysis-out-of-scope',
    'structured-provider-value-not-committed':
      'assign-unknown-structured-provider-value-missing',
  };
  return (
    field.stateReasonCode in expectedRule &&
    expectedRule[field.stateReasonCode as keyof typeof expectedRule] ===
      field.stateRuleId
  );
}

function validateSources(
  sources: readonly DeterministicProfileSourceReference[],
  candidateId: string,
  ownerFieldId: DeterministicProfileFieldId,
  issues: DomainIssue[],
  path: string,
): void {
  const seen = new Set<string>();
  for (const [index, source] of sources.entries()) {
    const sourcePath = `${path}[${String(index)}]`;
    const key = canonicalText(source);
    if (seen.has(key)) addIssue(issues, 'profile.source', sourcePath);
    seen.add(key);
    if (source.kind === 'catalog-field' && source.candidateId !== candidateId) {
      addIssue(issues, 'profile.source', sourcePath);
    }
    if (
      source.kind === 'artifact-set-entry' &&
      (source.entryOutcome === 'materialized') !== (source.artifactId !== null)
    ) {
      addIssue(issues, 'profile.source', sourcePath);
    }
    if (
      source.kind === 'derived-profile-fields' &&
      (source.inputFieldIds.length === 0 ||
        source.inputFieldIds.includes(ownerFieldId) ||
        new Set(source.inputFieldIds).size !== source.inputFieldIds.length)
    ) {
      addIssue(issues, 'profile.source', sourcePath);
    }
  }
}

function hasDependencyCycle(
  dependencies: ReadonlyMap<
    DeterministicProfileFieldId,
    readonly DeterministicProfileFieldId[]
  >,
): boolean {
  const visiting = new Set<DeterministicProfileFieldId>();
  const visited = new Set<DeterministicProfileFieldId>();
  const visit = (fieldId: DeterministicProfileFieldId): boolean => {
    if (visiting.has(fieldId)) return true;
    if (visited.has(fieldId)) return false;
    visiting.add(fieldId);
    for (const dependency of dependencies.get(fieldId) ?? []) {
      if (visit(dependency)) return true;
    }
    visiting.delete(fieldId);
    visited.add(fieldId);
    return false;
  };
  return DETERMINISTIC_PROFILE_FIELD_IDS.some(visit);
}

const LANGUAGES = new Set<ProfileLanguageEcosystem>([
  'dotnet',
  'go',
  'java',
  'javascript',
  'php',
  'python',
  'ruby',
  'rust',
  'typescript',
]);
const FRAMEWORKS = new Set<ProfileFramework>([
  'django',
  'express',
  'fastify',
  'laravel',
  'nestjs',
  'nextjs',
  'rails',
  'spring',
]);
const DATASTORES = new Set<ProfileDatastore>([
  'dynamodb',
  'mongodb',
  'mysql',
  'postgresql',
  'redis',
  'sqlite',
]);
const PROCESS_ROLES = new Set<ProfileProcessRole>([
  'api-server',
  'background-worker',
  'database-extension',
  'scheduled-task',
  'sidecar',
]);

export function isFieldValue(
  fieldId: DeterministicProfileFieldId,
  value: unknown,
): boolean {
  if (!isRecord(value)) return false;
  switch (fieldId) {
    case 'catalog-role-status':
      return (
        isExactKeys(value, ['catalogStatus']) &&
        ['active', 'archived', 'moved', 'negative-control'].includes(
          String(value['catalogStatus']),
        )
      );
    case 'capability-family':
      return (
        isExactKeys(value, ['additionalFamilies', 'primaryFamily']) &&
        isCapabilityFamily(value['primaryFamily']) &&
        isSortedUniqueStrings(
          value['additionalFamilies'],
          isCapabilityFamily,
        ) &&
        !(value['additionalFamilies'] as readonly string[]).includes(
          value['primaryFamily'],
        )
      );
    case 'repository-identity':
      return (
        isExactKeys(value, [
          'candidateId',
          'displayName',
          'githubOwner',
          'githubRepository',
        ]) &&
        isStableId(value['candidateId']) &&
        isBoundedText(value['displayName'], 160) &&
        isRepositoryPart(value['githubOwner']) &&
        isRepositoryPart(value['githubRepository'])
      );
    case 'adoption-unit-type':
    case 'capability-variants-features':
    case 'required-infrastructure':
    case 'optional-infrastructure':
    case 'deployment-self-hosting':
      return isCompleteConceptSet(value);
    case 'repository-discovery-metadata':
      return (
        isExactKeys(value, ['primaryLanguage', 'repositoryTopics']) &&
        (value['primaryLanguage'] === null ||
          (typeof value['primaryLanguage'] === 'string' &&
            LANGUAGES.has(
              value['primaryLanguage'] as ProfileLanguageEcosystem,
            ))) &&
        isSortedUniqueStrings(value['repositoryTopics'], isStableId, 32)
      );
    case 'language-ecosystem':
      return (
        isExactKeys(value, ['ecosystems']) &&
        isSortedUniqueStrings(
          value['ecosystems'],
          (entry) =>
            typeof entry === 'string' &&
            LANGUAGES.has(entry as ProfileLanguageEcosystem),
          9,
        )
      );
    case 'package-identity-mapping':
      return value['mapping'] === 'unmapped'
        ? isExactKeys(value, ['mapping'])
        : value['mapping'] === 'mapped' &&
            isExactKeys(value, ['mapping', 'packageName']) &&
            isPackageName(value['packageName']);
    case 'package-publication-version':
      return (
        isExactKeys(value, ['packageName', 'publishedAt', 'version']) &&
        isPackageName(value['packageName']) &&
        isExactPackageVersion(value['version']) &&
        isTimestamp(value['publishedAt'])
      );
    case 'runtime-package-format':
      return (
        isExactKeys(value, [
          'exportsDeclared',
          'moduleFormat',
          'nodeEngineRange',
          'packageFormat',
        ]) &&
        typeof value['exportsDeclared'] === 'boolean' &&
        ['commonjs', 'dual', 'esm', 'unspecified'].includes(
          String(value['moduleFormat']),
        ) &&
        (value['nodeEngineRange'] === null ||
          isBoundedNormalizedToken(value['nodeEngineRange'], 100)) &&
        value['packageFormat'] === 'npm-package'
      );
    case 'framework-compatibility':
      return (
        isExactKeys(value, ['frameworks']) &&
        isSortedUniqueStrings(
          value['frameworks'],
          (entry) =>
            typeof entry === 'string' &&
            FRAMEWORKS.has(entry as ProfileFramework),
          8,
        )
      );
    case 'datastore-requirements':
      return (
        isExactKeys(value, ['datastores']) &&
        isSortedUniqueStrings(
          value['datastores'],
          (entry) =>
            typeof entry === 'string' &&
            DATASTORES.has(entry as ProfileDatastore),
          6,
        )
      );
    case 'license-identity':
      return (
        isExactKeys(value, ['spdxId']) &&
        typeof value['spdxId'] === 'string' &&
        /^[A-Za-z0-9][A-Za-z0-9.+-]{0,63}$/u.test(value['spdxId'])
      );
    case 'archived-state':
      return (
        isExactKeys(value, ['archived']) &&
        typeof value['archived'] === 'boolean'
      );
    case 'fork-upstream-state':
      return (
        isExactKeys(value, ['fork', 'upstreamRepository']) &&
        typeof value['fork'] === 'boolean' &&
        (value['upstreamRepository'] === null ||
          isRepositoryIdentity(value['upstreamRepository'])) &&
        (value['fork'] || value['upstreamRepository'] === null)
      );
    case 'maintenance-activity':
      return (
        isExactKeys(value, [
          'commitsInPrevious90Days',
          'lastCommitAt',
          'snapshotAt',
        ]) &&
        isTimestamp(value['snapshotAt']) &&
        (value['lastCommitAt'] === null ||
          isTimestamp(value['lastCommitAt'])) &&
        isBoundedCount(value['commitsInPrevious90Days'], 100_000)
      );
    case 'release-state-recency':
      return (
        isExactKeys(value, [
          'latestReleasePublishedAt',
          'latestReleaseVersion',
          'prerelease',
          'snapshotAt',
        ]) &&
        isTimestamp(value['snapshotAt']) &&
        (value['latestReleaseVersion'] === null ||
          isBoundedNormalizedToken(value['latestReleaseVersion'], 100)) &&
        (value['latestReleasePublishedAt'] === null ||
          isTimestamp(value['latestReleasePublishedAt'])) &&
        (value['prerelease'] === null ||
          typeof value['prerelease'] === 'boolean') &&
        (value['latestReleaseVersion'] === null) ===
          (value['latestReleasePublishedAt'] === null)
      );
    case 'security-advisory-state':
      return (
        isExactKeys(value, [
          'applicableAdvisoryCount',
          'highestSeverity',
          'snapshotAt',
        ]) &&
        isTimestamp(value['snapshotAt']) &&
        isBoundedCount(value['applicableAdvisoryCount'], 10_000) &&
        (value['highestSeverity'] === null ||
          (typeof value['highestSeverity'] === 'string' &&
            ['critical', 'high', 'low', 'moderate'].includes(
              value['highestSeverity'],
            ))) &&
        (value['applicableAdvisoryCount'] === 0) ===
          (value['highestSeverity'] === null)
      );
    case 'security-policy-presence':
      return (
        isExactKeys(value, ['present']) && typeof value['present'] === 'boolean'
      );
    case 'documentation-presence':
      return (
        isExactKeys(value, [
          'documentationDirectoryPresent',
          'readmePresent',
        ]) &&
        typeof value['documentationDirectoryPresent'] === 'boolean' &&
        typeof value['readmePresent'] === 'boolean'
      );
    case 'test-ci-presence':
      return (
        isExactKeys(value, ['ciConfigurationPresent', 'testsPresent']) &&
        typeof value['ciConfigurationPresent'] === 'boolean' &&
        typeof value['testsPresent'] === 'boolean'
      );
    case 'artifact-chunk-availability':
      return (
        isExactKeys(value, [
          'artifactSetId',
          'chunkCount',
          'materializedArtifactCount',
        ]) &&
        isStableId(value['artifactSetId']) &&
        isBoundedCount(value['chunkCount'], 1_000_000) &&
        isBoundedCount(value['materializedArtifactCount'], 10_000)
      );
    case 'package-repository-linkage':
      return (
        isExactKeys(value, ['linkage']) &&
        ['matched', 'mismatched', 'undeclared'].includes(
          String(value['linkage']),
        )
      );
    case 'operational-complexity-primitives':
      return (
        isExactKeys(value, [
          'processRoles',
          'requiresPersistentStorage',
          'requiresScheduledExecution',
        ]) &&
        typeof value['requiresPersistentStorage'] === 'boolean' &&
        typeof value['requiresScheduledExecution'] === 'boolean' &&
        isSortedUniqueStrings(
          value['processRoles'],
          (entry) =>
            typeof entry === 'string' &&
            PROCESS_ROLES.has(entry as ProfileProcessRole),
          5,
        )
      );
  }
}

function isCompleteConceptSet(value: Record<string, unknown>): boolean {
  return (
    isExactKeys(value, ['completeness', 'conceptIds']) &&
    value['completeness'] === 'complete' &&
    isSortedUniqueStrings(value['conceptIds'], isStableId, 85)
  );
}

function canonicalizeField(
  field: DeterministicProfileFieldRecord,
): DeterministicProfileFieldRecord {
  const common = {
    ...field,
    versionScope:
      field.versionScope === null ? null : { ...field.versionScope },
    sourceReferences: [...field.sourceReferences]
      .map(canonicalizeSource)
      .sort(compareSource),
  };
  if (field.state === 'conflict') {
    return ownValue({
      ...common,
      claims: [...field.claims]
        .sort((left, right) =>
          compareText(canonicalText(left.value), canonicalText(right.value)),
        )
        .map((claim) => ({
          ...claim,
          value: ownValue(claim.value),
          sourceReferences: [...claim.sourceReferences]
            .map(canonicalizeSource)
            .sort(compareSource),
        })),
    });
  }
  return ownValue(
    field.state === 'known'
      ? { ...common, value: ownValue(field.value) }
      : common,
  );
}

function canonicalizeSource(
  source: DeterministicProfileSourceReference,
): DeterministicProfileSourceReference {
  if (source.kind === 'structured-collection') {
    return ownValue({
      ...source,
      evidenceIds: [...source.evidenceIds].sort(compareText),
      sourceTopicCodes: [...source.sourceTopicCodes].sort(compareText),
    });
  }
  if (source.kind === 'derived-profile-fields') {
    return ownValue({
      ...source,
      inputFieldIds: [...source.inputFieldIds].sort(
        (left, right) =>
          DETERMINISTIC_PROFILE_FIELD_IDS.indexOf(left) -
          DETERMINISTIC_PROFILE_FIELD_IDS.indexOf(right),
      ),
    });
  }
  return ownValue(source);
}

function compareSource(
  left: DeterministicProfileSourceReference,
  right: DeterministicProfileSourceReference,
): number {
  return compareText(canonicalText(left), canonicalText(right));
}

function requireField(
  fields: ReadonlyMap<
    DeterministicProfileFieldId,
    DeterministicProfileFieldRecord
  >,
  fieldId: DeterministicProfileFieldId,
): DeterministicProfileFieldRecord {
  const field = fields.get(fieldId);
  if (field === undefined)
    throw new Error('Candidate profile field is missing.');
  return field;
}

function isCapabilityFamily(value: unknown): value is CapabilityFamily {
  return [
    'authorization',
    'audit-logging',
    'background-jobs',
    'rate-limiting',
    'webhooks',
  ].includes(String(value));
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype ||
      Object.getPrototypeOf(value) === null)
  );
}
function isExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): boolean {
  const actual = Object.keys(value).sort(compareText);
  const sorted = [...expected].sort(compareText);
  return (
    actual.length === sorted.length &&
    actual.every((key, index) => key === sorted[index])
  );
}
function isSortedUniqueStrings(
  value: unknown,
  predicate: (entry: unknown) => boolean,
  maximum = 32,
): boolean {
  return (
    Array.isArray(value) &&
    value.length <= maximum &&
    value.every(
      (entry, index) =>
        predicate(entry) &&
        typeof entry === 'string' &&
        (index === 0 || String(value[index - 1]) < entry),
    )
  );
}
function isStableId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/u.test(value)
  );
}
function isBoundedText(value: unknown, maximum: number): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= maximum &&
    !/[\p{Cc}\p{Cf}]/u.test(value)
  );
}
function isRepositoryPart(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[A-Za-z0-9_.-]{1,100}$/u.test(value) &&
    value !== '.' &&
    value !== '..'
  );
}
function isRepositoryIdentity(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const parts = value.split('/');
  return (
    parts.length === 2 &&
    isRepositoryPart(parts[0]) &&
    isRepositoryPart(parts[1])
  );
}
function isPackageName(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^(?:@[a-z0-9][a-z0-9._-]{0,99}\/)?[a-z0-9][a-z0-9._-]{0,99}$/u.test(value)
  );
}
function isExactPackageVersion(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u.test(
      value,
    )
  );
}
function isTimestamp(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/u.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}
function isBoundedNormalizedToken(
  value: unknown,
  maximum: number,
): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= maximum &&
    value.trim() === value &&
    !/[\p{Cc}\p{Cf}]/u.test(value)
  );
}
function isBoundedCount(value: unknown, maximum: number): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= maximum
  );
}
function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
function textsDiffer(left: string, right: string): boolean {
  return left !== right;
}
function isNonNullExtractionRule(
  value: DeterministicProfileExtractionRuleId | null,
): value is DeterministicProfileExtractionRuleId {
  return value !== null;
}
function canonicalText(value: unknown): string {
  return JSON.stringify(sortJson(value));
}
function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (isRecord(value))
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => compareText(left, right))
        .map(([key, child]) => [key, sortJson(child)]),
    );
  return value;
}
function ownValue<T>(value: T): T {
  if (Array.isArray(value)) return value.map(ownValue) as T;
  if (isRecord(value))
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, ownValue(child)]),
    ) as T;
  return value;
}
function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
