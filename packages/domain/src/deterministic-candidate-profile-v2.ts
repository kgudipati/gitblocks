import {
  type DETERMINISTIC_CANDIDATE_PROFILE_AUTHORITY_VERSION,
  DETERMINISTIC_CANDIDATE_PROFILE_VERSION,
  DETERMINISTIC_PROFILE_DENOMINATOR_VERSION,
  DETERMINISTIC_PROFILE_FIELD_IDS,
  DETERMINISTIC_PROFILE_RULES_VERSION,
  canonicalizeDeterministicCandidateProfile,
  getDeterministicProfileFieldRegistry,
  validateDeterministicCandidateProfile,
  validateDeterministicCandidateProfileAuthority,
  type DeterministicCandidateProfile,
  type DeterministicCandidateProfileAuthority,
  type DeterministicProfileConflictClaim,
  type DeterministicProfileExtractionRuleId,
  type DeterministicProfileFieldId,
  type DeterministicProfileFieldRecord,
  type DeterministicProfileFieldScope,
  type DeterministicProfileSourceReference,
  type DeterministicProfileStateReasonCode,
  type DeterministicProfileStateRuleId,
  type DeterministicProfileVersionScope,
} from './deterministic-candidate-profile.ts';
import {
  addIssue,
  finalizeIssues,
  type DomainIssue,
  type DomainResult,
} from './issues.ts';

export const DETERMINISTIC_CANDIDATE_PROFILE_VERSION_V2 =
  'deterministic-candidate-profile/2.0.0' as const;
export const DETERMINISTIC_CANDIDATE_PROFILE_AUTHORITY_VERSION_V2 =
  'deterministic-candidate-profile-authority/2.0.0' as const;
export const DETERMINISTIC_PROFILE_RULES_VERSION_V2 =
  'deterministic-candidate-profile-rules/2.0.0' as const;

export const DETERMINISTIC_PROFILE_CONCEPT_ASSERTION_FIELD_IDS = Object.freeze([
  'capability-variants-features',
  'required-infrastructure',
  'optional-infrastructure',
] as const);

export type DeterministicProfileConceptAssertionFieldId =
  (typeof DETERMINISTIC_PROFILE_CONCEPT_ASSERTION_FIELD_IDS)[number];
export type DeterministicProfileNonAssertionFieldId = Exclude<
  DeterministicProfileFieldId,
  DeterministicProfileConceptAssertionFieldId
>;
export type DeterministicProfileConceptCoverage =
  'complete' | 'partial' | 'unknown';
export type DeterministicProfileConceptAssertionState =
  'absent' | 'conflict' | 'present';

interface DeterministicProfileConceptFieldCommon<
  FieldId extends DeterministicProfileConceptAssertionFieldId,
> {
  readonly fieldId: FieldId;
  readonly scope: DeterministicProfileFieldScope;
  readonly coverage: DeterministicProfileConceptCoverage;
  readonly stateReasonCode: DeterministicProfileStateReasonCode;
  readonly stateRuleId: DeterministicProfileStateRuleId;
  readonly versionScope: DeterministicProfileVersionScope | null;
  readonly sourceReferences: readonly DeterministicProfileSourceReference[];
}

export interface DeterministicProfileConceptAssertionClaimV2 {
  readonly state: 'absent' | 'present';
  readonly valueExtractionRuleId: DeterministicProfileExtractionRuleId;
  readonly sourceReferences: readonly DeterministicProfileSourceReference[];
}

export type DeterministicProfileConceptAssertionV2 =
  | {
      readonly conceptId: string;
      readonly state: 'absent' | 'present';
      readonly valueExtractionRuleId: DeterministicProfileExtractionRuleId;
      readonly sourceReferences: readonly DeterministicProfileSourceReference[];
    }
  | {
      readonly conceptId: string;
      readonly state: 'conflict';
      readonly claims: readonly DeterministicProfileConceptAssertionClaimV2[];
    };

export type DeterministicProfileConceptFieldRecordV2<
  FieldId extends DeterministicProfileConceptAssertionFieldId =
    DeterministicProfileConceptAssertionFieldId,
> = DeterministicProfileConceptFieldCommon<FieldId> & {
  readonly assertions: readonly DeterministicProfileConceptAssertionV2[];
};

export type DeterministicProfileFieldRecordV2<
  FieldId extends DeterministicProfileFieldId = DeterministicProfileFieldId,
> = FieldId extends DeterministicProfileConceptAssertionFieldId
  ? DeterministicProfileConceptFieldRecordV2<FieldId>
  : DeterministicProfileFieldRecord<
      Extract<FieldId, DeterministicProfileNonAssertionFieldId>
    >;

export interface DeterministicCandidateProfileV2Domain {
  readonly contractVersion: '2.0.0';
  readonly profileVersion: typeof DETERMINISTIC_CANDIDATE_PROFILE_VERSION_V2;
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
  readonly profileRulesVersion: typeof DETERMINISTIC_PROFILE_RULES_VERSION_V2;
  readonly fields: readonly DeterministicProfileFieldRecordV2[];
  readonly semanticProfileDigest: string;
}

export interface DeterministicCandidateProfileAuthorityV2Domain {
  readonly contractVersion: '2.0.0';
  readonly authorityVersion: typeof DETERMINISTIC_CANDIDATE_PROFILE_AUTHORITY_VERSION_V2;
  readonly denominatorVersion: typeof DETERMINISTIC_PROFILE_DENOMINATOR_VERSION;
  readonly catalogVersion: string;
  readonly catalogDigest: string;
  readonly taxonomyVersion: string;
  readonly taxonomySemanticDigest: string;
  readonly profileRulesVersion: typeof DETERMINISTIC_PROFILE_RULES_VERSION_V2;
  readonly profiles: readonly DeterministicCandidateProfileV2Domain[];
  readonly semanticAuthorityDigest: string;
}

interface LegacyWholeFieldConflictV1<
  FieldId extends DeterministicProfileConceptAssertionFieldId,
> {
  readonly kind: 'v1-whole-field-conflict';
  readonly claims: readonly DeterministicProfileConflictClaim<FieldId>[];
}

export type DeterministicProfileEvaluatorConceptFieldV2<
  FieldId extends DeterministicProfileConceptAssertionFieldId =
    DeterministicProfileConceptAssertionFieldId,
> = DeterministicProfileConceptFieldRecordV2<FieldId> & {
  readonly legacyWholeFieldConflict?: LegacyWholeFieldConflictV1<FieldId>;
};

export type DeterministicProfileEvaluatorFieldV2<
  FieldId extends DeterministicProfileFieldId = DeterministicProfileFieldId,
> = FieldId extends DeterministicProfileConceptAssertionFieldId
  ? DeterministicProfileEvaluatorConceptFieldV2<FieldId>
  : DeterministicProfileFieldRecord<
      Extract<FieldId, DeterministicProfileNonAssertionFieldId>
    >;

export interface DeterministicCandidateProfileEvaluatorV2 {
  readonly contractVersion: '1.0.0' | '2.0.0';
  readonly profileVersion:
    | typeof DETERMINISTIC_CANDIDATE_PROFILE_VERSION
    | typeof DETERMINISTIC_CANDIDATE_PROFILE_VERSION_V2;
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
  readonly profileRulesVersion:
    | typeof DETERMINISTIC_PROFILE_RULES_VERSION
    | typeof DETERMINISTIC_PROFILE_RULES_VERSION_V2;
  readonly fields: readonly DeterministicProfileEvaluatorFieldV2[];
  readonly semanticProfileDigest: string;
}

interface DeterministicCandidateProfileEvaluatorAuthorityCommonV2 {
  readonly denominatorVersion: typeof DETERMINISTIC_PROFILE_DENOMINATOR_VERSION;
  readonly catalogVersion: string;
  readonly catalogDigest: string;
  readonly taxonomyVersion: string;
  readonly taxonomySemanticDigest: string;
  readonly profiles: readonly DeterministicCandidateProfileEvaluatorV2[];
  readonly semanticAuthorityDigest: string;
}

export type DeterministicCandidateProfileEvaluatorAuthorityV2 =
  | (DeterministicCandidateProfileEvaluatorAuthorityCommonV2 & {
      readonly runtimeAuthorityKind: 'projected-v1';
      readonly contractVersion: '1.0.0';
      readonly authorityVersion: typeof DETERMINISTIC_CANDIDATE_PROFILE_AUTHORITY_VERSION;
      readonly profileRulesVersion: typeof DETERMINISTIC_PROFILE_RULES_VERSION;
    })
  | (DeterministicCandidateProfileEvaluatorAuthorityCommonV2 & {
      readonly runtimeAuthorityKind: 'published-v2';
      readonly contractVersion: '2.0.0';
      readonly authorityVersion: typeof DETERMINISTIC_CANDIDATE_PROFILE_AUTHORITY_VERSION_V2;
      readonly profileRulesVersion: typeof DETERMINISTIC_PROFILE_RULES_VERSION_V2;
    });

export type PublishedDeterministicCandidateProfileAuthority =
  | DeterministicCandidateProfileAuthority
  | DeterministicCandidateProfileAuthorityV2Domain;

export function validateDeterministicCandidateProfileV2(
  profile: DeterministicCandidateProfileV2Domain,
): DomainResult<DeterministicCandidateProfileV2Domain> {
  const issues: DomainIssue[] = [];
  if (
    textsDiffer(profile.contractVersion, '2.0.0') ||
    textsDiffer(
      profile.profileVersion,
      DETERMINISTIC_CANDIDATE_PROFILE_VERSION_V2,
    ) ||
    textsDiffer(
      profile.profileRulesVersion,
      DETERMINISTIC_PROFILE_RULES_VERSION_V2,
    ) ||
    profile.fields.length !== DETERMINISTIC_PROFILE_FIELD_IDS.length
  ) {
    addIssue(issues, 'profile.invariant', '$');
  }

  const legacyFields: DeterministicProfileFieldRecord[] = [];
  const dependencies = new Map<
    DeterministicProfileFieldId,
    readonly DeterministicProfileFieldId[]
  >();
  for (const [index, field] of profile.fields.entries()) {
    const expected = getDeterministicProfileFieldRegistry()[index];
    if (field.fieldId !== expected?.fieldId) {
      addIssue(issues, 'profile.invariant', `$.fields[${String(index)}]`);
      continue;
    }
    if (isConceptAssertionFieldId(field.fieldId)) {
      const conceptField = field as DeterministicProfileConceptFieldRecordV2;
      validateConceptFieldV2(
        conceptField,
        expected.scope,
        profile.candidateId,
        issues,
        index,
      );
      dependencies.set(
        conceptField.fieldId,
        conceptField.sourceReferences
          .concat(
            conceptField.assertions.flatMap((assertion) =>
              assertion.state === 'conflict'
                ? assertion.claims.flatMap((claim) => claim.sourceReferences)
                : assertion.sourceReferences,
            ),
          )
          .flatMap((source) =>
            source.kind === 'derived-profile-fields'
              ? source.inputFieldIds
              : [],
          ),
      );
      legacyFields.push(
        legacyUnknownField(conceptField.fieldId, expected.scope),
      );
    } else {
      const legacyField = field as DeterministicProfileFieldRecord;
      legacyFields.push(legacyField);
      dependencies.set(
        legacyField.fieldId,
        legacyField.sourceReferences
          .concat(
            legacyField.state === 'conflict'
              ? legacyField.claims.flatMap((claim) => claim.sourceReferences)
              : [],
          )
          .flatMap((source) =>
            source.kind === 'derived-profile-fields'
              ? source.inputFieldIds
              : [],
          ),
      );
    }
  }

  const legacyValidation = validateDeterministicCandidateProfile({
    ...profile,
    contractVersion: '1.0.0',
    profileVersion: DETERMINISTIC_CANDIDATE_PROFILE_VERSION,
    profileRulesVersion: DETERMINISTIC_PROFILE_RULES_VERSION,
    fields: legacyFields,
  });
  if (!legacyValidation.ok) {
    addIssue(issues, 'profile.invariant', '$.fields');
  }
  if (hasDependencyCycle(dependencies)) {
    addIssue(issues, 'profile.source', '$.fields');
  }

  return issues.length === 0
    ? { ok: true, value: canonicalizeDeterministicCandidateProfileV2(profile) }
    : { ok: false, issues: finalizeIssues(issues) };
}

export function validateDeterministicCandidateProfileAuthorityV2(
  authority: DeterministicCandidateProfileAuthorityV2Domain,
): DomainResult<DeterministicCandidateProfileAuthorityV2Domain> {
  const issues: DomainIssue[] = [];
  if (
    textsDiffer(authority.contractVersion, '2.0.0') ||
    textsDiffer(
      authority.authorityVersion,
      DETERMINISTIC_CANDIDATE_PROFILE_AUTHORITY_VERSION_V2,
    ) ||
    textsDiffer(
      authority.denominatorVersion,
      DETERMINISTIC_PROFILE_DENOMINATOR_VERSION,
    ) ||
    textsDiffer(
      authority.profileRulesVersion,
      DETERMINISTIC_PROFILE_RULES_VERSION_V2,
    ) ||
    authority.profiles.length !== 150
  ) {
    addIssue(issues, 'profile.authority', '$');
  }
  let prior = '';
  const profiles: DeterministicCandidateProfileV2Domain[] = [];
  for (const [index, profile] of authority.profiles.entries()) {
    const validated = validateDeterministicCandidateProfileV2(profile);
    if (
      !validated.ok ||
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
      profiles.push(validated.value);
    }
    prior = profile.candidateId;
  }
  return issues.length === 0
    ? { ok: true, value: ownValue({ ...authority, profiles }) }
    : { ok: false, issues: finalizeIssues(issues) };
}

export function projectDeterministicCandidateProfileAuthorityToEvaluatorV2(
  authority: PublishedDeterministicCandidateProfileAuthority,
): DeterministicCandidateProfileEvaluatorAuthorityV2 {
  if (
    authority.authorityVersion ===
    DETERMINISTIC_CANDIDATE_PROFILE_AUTHORITY_VERSION_V2
  ) {
    const validated =
      validateDeterministicCandidateProfileAuthorityV2(authority);
    if (!validated.ok) {
      throw new Error(
        'Deterministic candidate profile V2 authority is invalid.',
      );
    }
    return deepFreeze({
      runtimeAuthorityKind: 'published-v2',
      ...ownValue(validated.value),
    });
  }
  const validated = validateDeterministicCandidateProfileAuthority(authority);
  if (!validated.ok) {
    throw new Error('Deterministic candidate profile V1 authority is invalid.');
  }
  return deepFreeze({
    runtimeAuthorityKind: 'projected-v1',
    contractVersion: validated.value.contractVersion,
    authorityVersion: validated.value.authorityVersion,
    denominatorVersion: validated.value.denominatorVersion,
    catalogVersion: validated.value.catalogVersion,
    catalogDigest: validated.value.catalogDigest,
    taxonomyVersion: validated.value.taxonomyVersion,
    taxonomySemanticDigest: validated.value.taxonomySemanticDigest,
    profileRulesVersion: validated.value.profileRulesVersion,
    profiles: validated.value.profiles.map(projectValidatedProfileV1),
    semanticAuthorityDigest: validated.value.semanticAuthorityDigest,
  });
}

export function isConceptAssertionFieldId(
  fieldId: DeterministicProfileFieldId,
): fieldId is DeterministicProfileConceptAssertionFieldId {
  return (
    fieldId === 'capability-variants-features' ||
    fieldId === 'required-infrastructure' ||
    fieldId === 'optional-infrastructure'
  );
}

export function projectDeterministicCandidateProfileV1ToEvaluatorV2(
  profile: DeterministicCandidateProfile,
): DeterministicCandidateProfileEvaluatorV2 {
  const validated = validateDeterministicCandidateProfile(profile);
  if (!validated.ok) {
    throw new Error('Deterministic candidate profile V1 is invalid.');
  }
  return deepFreeze(projectValidatedProfileV1(validated.value));
}

function projectValidatedProfileV1(
  profile: DeterministicCandidateProfile,
): DeterministicCandidateProfileEvaluatorV2 {
  const fields = profile.fields.map((field) => {
    if (!isConceptAssertionFieldId(field.fieldId)) return ownValue(field);
    const conceptField =
      field as DeterministicProfileFieldRecord<DeterministicProfileConceptAssertionFieldId>;
    const common = {
      fieldId: conceptField.fieldId,
      scope: conceptField.scope,
      stateReasonCode: conceptField.stateReasonCode,
      stateRuleId: conceptField.stateRuleId,
      versionScope:
        conceptField.versionScope === null
          ? null
          : { ...conceptField.versionScope },
      sourceReferences: conceptField.sourceReferences.map((source) =>
        ownValue(source),
      ),
    };
    if (conceptField.state === 'conflict') {
      return {
        ...common,
        coverage: 'unknown' as const,
        assertions: [],
        legacyWholeFieldConflict: {
          kind: 'v1-whole-field-conflict' as const,
          claims: conceptField.claims.map((claim) => ownValue(claim)),
        },
      };
    }
    if (conceptField.state === 'unknown') {
      return { ...common, coverage: 'unknown' as const, assertions: [] };
    }
    if (conceptField.state !== 'known') {
      throw new Error('V1 concept field has an unsupported state.');
    }
    return {
      ...common,
      coverage: 'complete' as const,
      assertions: conceptField.value.conceptIds.map((conceptId: string) => ({
        conceptId,
        state: 'present' as const,
        valueExtractionRuleId: conceptField.valueExtractionRuleId,
        sourceReferences: conceptField.sourceReferences.map((source) =>
          ownValue(source),
        ),
      })),
    };
  }) as readonly DeterministicProfileEvaluatorFieldV2[];
  return {
    ...ownValue(profile),
    fields,
  };
}

function validateConceptFieldV2(
  field: DeterministicProfileConceptFieldRecordV2,
  expectedScope: DeterministicProfileFieldScope,
  candidateId: string,
  issues: DomainIssue[],
  index: number,
): void {
  const path = `$.fields[${String(index)}]`;
  if (
    field.scope !== expectedScope ||
    (field.fieldId === 'capability-variants-features' &&
      field.versionScope !== null) ||
    (field.fieldId !== 'capability-variants-features' &&
      field.coverage !== 'unknown' &&
      field.versionScope === null) ||
    (field.coverage === 'unknown' && field.assertions.length !== 0) ||
    (field.coverage === 'partial' && field.assertions.length === 0)
  ) {
    addIssue(issues, 'profile.invariant', path);
  }
  const knownCoverage = field.coverage !== 'unknown';
  if (
    knownCoverage
      ? !isApprovedKnownMetadata(field) || field.sourceReferences.length === 0
      : !isUnknownMetadata(field)
  ) {
    addIssue(issues, 'profile.invariant', path);
  }
  validateSources(
    field.sourceReferences,
    candidateId,
    field.fieldId,
    issues,
    `${path}.sourceReferences`,
  );
  let prior = '';
  for (const [assertionIndex, assertion] of field.assertions.entries()) {
    const assertionPath = `${path}.assertions[${String(assertionIndex)}]`;
    if (!isStableId(assertion.conceptId) || assertion.conceptId <= prior) {
      addIssue(issues, 'profile.invariant', assertionPath);
    }
    prior = assertion.conceptId;
    if (assertion.state === 'conflict') {
      const states = new Set(assertion.claims.map(({ state }) => state));
      if (
        assertion.claims.length < 2 ||
        assertion.claims.length > 8 ||
        !states.has('present') ||
        !states.has('absent')
      ) {
        addIssue(issues, 'profile.invariant', `${assertionPath}.claims`);
      }
      const claimKeys = new Set<string>();
      for (const [claimIndex, claim] of assertion.claims.entries()) {
        const claimPath = `${assertionPath}.claims[${String(claimIndex)}]`;
        if (
          claim.sourceReferences.length === 0 ||
          !isExtractionRuleForField(
            field.fieldId,
            claim.valueExtractionRuleId,
          ) ||
          !isExtractionSourceCoherent(
            claim.valueExtractionRuleId,
            claim.sourceReferences,
          )
        ) {
          addIssue(issues, 'profile.invariant', claimPath);
        }
        validateSources(
          claim.sourceReferences,
          candidateId,
          field.fieldId,
          issues,
          `${claimPath}.sourceReferences`,
        );
        claimKeys.add(canonicalText(claim));
      }
      if (claimKeys.size !== assertion.claims.length) {
        addIssue(issues, 'profile.invariant', `${assertionPath}.claims`);
      }
    } else {
      if (
        assertion.sourceReferences.length === 0 ||
        !isExtractionRuleForField(
          field.fieldId,
          assertion.valueExtractionRuleId,
        ) ||
        !isExtractionSourceCoherent(
          assertion.valueExtractionRuleId,
          assertion.sourceReferences,
        )
      ) {
        addIssue(issues, 'profile.invariant', assertionPath);
      }
      validateSources(
        assertion.sourceReferences,
        candidateId,
        field.fieldId,
        issues,
        `${assertionPath}.sourceReferences`,
      );
    }
  }
}

function canonicalizeDeterministicCandidateProfileV2(
  profile: DeterministicCandidateProfileV2Domain,
): DeterministicCandidateProfileV2Domain {
  const legacyInput = {
    ...profile,
    contractVersion: '1.0.0' as const,
    profileVersion: DETERMINISTIC_CANDIDATE_PROFILE_VERSION,
    profileRulesVersion: DETERMINISTIC_PROFILE_RULES_VERSION,
    fields: profile.fields.map((field) =>
      isConceptAssertionFieldId(field.fieldId)
        ? legacyUnknownField(field.fieldId, field.scope)
        : field,
    ) as readonly DeterministicProfileFieldRecord[],
  };
  const canonicalLegacy =
    canonicalizeDeterministicCandidateProfile(legacyInput);
  const canonicalLegacyById = new Map(
    canonicalLegacy.fields.map((field) => [field.fieldId, field]),
  );
  return ownValue({
    ...profile,
    catalogBinding: { ...profile.catalogBinding },
    taxonomyBinding: { ...profile.taxonomyBinding },
    fields: profile.fields.map((field) =>
      isConceptAssertionFieldId(field.fieldId)
        ? canonicalizeConceptField(
            field as DeterministicProfileConceptFieldRecordV2,
          )
        : (canonicalLegacyById.get(field.fieldId) ?? field),
    ) as readonly DeterministicProfileFieldRecordV2[],
  });
}

function canonicalizeConceptField(
  field: DeterministicProfileConceptFieldRecordV2,
): DeterministicProfileConceptFieldRecordV2 {
  return ownValue({
    ...field,
    sourceReferences: [...field.sourceReferences]
      .map((source) => canonicalizeSource(source))
      .sort(compareSource),
    assertions: [...field.assertions]
      .map((assertion) =>
        assertion.state === 'conflict'
          ? {
              ...assertion,
              claims: [...assertion.claims]
                .map((claim) => ({
                  ...claim,
                  sourceReferences: [...claim.sourceReferences]
                    .map(canonicalizeSource)
                    .sort(compareSource),
                }))
                .sort((left, right) =>
                  compareText(canonicalText(left), canonicalText(right)),
                ),
            }
          : {
              ...assertion,
              sourceReferences: [...assertion.sourceReferences]
                .map(canonicalizeSource)
                .sort(compareSource),
            },
      )
      .sort((left, right) => compareText(left.conceptId, right.conceptId)),
  });
}

function legacyUnknownField(
  fieldId: DeterministicProfileConceptAssertionFieldId,
  scope: DeterministicProfileFieldScope,
): DeterministicProfileFieldRecord {
  return {
    fieldId,
    scope,
    state: 'unknown',
    stateReasonCode: 'structured-provider-value-not-committed',
    stateRuleId: 'assign-unknown-structured-provider-value-missing',
    valueExtractionRuleId: null,
    versionScope: null,
    sourceReferences: [],
  };
}

function isApprovedKnownMetadata(field: {
  readonly stateReasonCode: DeterministicProfileStateReasonCode;
  readonly stateRuleId: DeterministicProfileStateRuleId;
}): boolean {
  return (
    (field.stateReasonCode === 'approved-structured-field-value' &&
      field.stateRuleId === 'assign-known-approved-structured-value') ||
    (field.stateReasonCode === 'approved-artifact-field-value' &&
      field.stateRuleId === 'assign-known-approved-artifact-value') ||
    (field.stateReasonCode === 'approved-derived-field-value' &&
      field.stateRuleId === 'assign-known-deterministic-derived-value')
  );
}

function isUnknownMetadata(field: {
  readonly stateReasonCode: DeterministicProfileStateReasonCode;
  readonly stateRuleId: DeterministicProfileStateRuleId;
}): boolean {
  const pairs = new Map<
    DeterministicProfileStateReasonCode,
    DeterministicProfileStateRuleId
  >([
    [
      'artifact-materialization-authority-not-committed',
      'assign-unknown-artifact-authority-missing',
    ],
    [
      'repository-wide-analysis-not-performed',
      'assign-unknown-repository-analysis-missing',
    ],
    [
      'requires-reviewed-curator-classification',
      'assign-unknown-reviewed-classification-missing',
    ],
    [
      'source-code-semantic-analysis-out-of-scope',
      'assign-unknown-source-analysis-out-of-scope',
    ],
    [
      'structured-provider-value-not-committed',
      'assign-unknown-structured-provider-value-missing',
    ],
  ]);
  return pairs.get(field.stateReasonCode) === field.stateRuleId;
}

function isExtractionRuleForField(
  fieldId: DeterministicProfileConceptAssertionFieldId,
  ruleId: DeterministicProfileExtractionRuleId,
): boolean {
  return (
    ruleId === `extract-${fieldId}-from-structured-authority` ||
    ruleId === `extract-${fieldId}-from-artifact-set-authority` ||
    ruleId === `derive-${fieldId}-from-profile-fields`
  );
}

function isExtractionSourceCoherent(
  ruleId: DeterministicProfileExtractionRuleId,
  sources: readonly DeterministicProfileSourceReference[],
): boolean {
  const expected = ruleId.endsWith('-from-structured-authority')
    ? 'structured-collection'
    : ruleId.endsWith('-from-artifact-set-authority')
      ? 'artifact-set-entry'
      : 'derived-profile-fields';
  return sources.length > 0 && sources.every(({ kind }) => kind === expected);
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

function canonicalizeSource(
  source: DeterministicProfileSourceReference,
): DeterministicProfileSourceReference {
  if (source.kind === 'structured-collection') {
    return {
      ...source,
      evidenceIds: [...source.evidenceIds].sort(compareText),
      sourceTopicCodes: [...source.sourceTopicCodes].sort(compareText),
    };
  }
  if (source.kind === 'derived-profile-fields') {
    return {
      ...source,
      inputFieldIds: [...source.inputFieldIds].sort(
        (left, right) =>
          DETERMINISTIC_PROFILE_FIELD_IDS.indexOf(left) -
          DETERMINISTIC_PROFILE_FIELD_IDS.indexOf(right),
      ),
    };
  }
  return { ...source };
}

function compareSource(
  left: DeterministicProfileSourceReference,
  right: DeterministicProfileSourceReference,
): number {
  return compareText(canonicalText(left), canonicalText(right));
}

function isStableId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/u.test(value)
  );
}

function canonicalText(value: unknown): string {
  return JSON.stringify(sortJson(value));
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => compareText(left, right))
        .map(([key, child]) => [key, sortJson(child)]),
    );
  }
  return value;
}

function ownValue<T>(value: T): T {
  if (Array.isArray(value)) return value.map(ownValue) as T;
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, ownValue(child)]),
    ) as T;
  }
  return value;
}

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function textsDiffer(left: string, right: string): boolean {
  return left !== right;
}
