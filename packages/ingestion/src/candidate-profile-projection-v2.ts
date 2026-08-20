import {
  DETERMINISTIC_CANDIDATE_PROFILE_AUTHORITY_VERSION_V2,
  DETERMINISTIC_CANDIDATE_PROFILE_VERSION_V2,
  DETERMINISTIC_PROFILE_CONCEPT_ASSERTION_FIELD_IDS,
  DETERMINISTIC_PROFILE_DENOMINATOR_VERSION_V2,
  DETERMINISTIC_PROFILE_FIELD_IDS,
  DETERMINISTIC_PROFILE_RULES_VERSION_V2,
  createDeterministicCandidateProfileAuthorityV2,
  createDeterministicCandidateProfileV2,
  type CapabilityTaxonomyV1,
  type DeterministicCandidateProfileAuthorityV2,
  type DeterministicCandidateProfileV2Domain,
  type DeterministicCandidateProfileInputV2,
  type DeterministicProfileConceptAssertionFieldId,
  type DeterministicProfileConceptAssertionV2,
  type DeterministicProfileConceptFieldRecordV2,
  type DeterministicProfileFieldRecord,
  type DeterministicProfileVersionScope,
  type ReviewedConceptCurationAuthorityV2,
} from '@gitblocks/contracts';

import { canonicalizeJson } from './canonical-json.ts';
import { projectCandidateProfile } from './candidate-profile-projection.ts';
import { ingestionError } from './errors.ts';
import {
  acceptReviewedConceptCurationAuthorityV2,
  type AcceptedReviewedConceptClaimV2,
  type ReviewedConceptCurationMaterialV2,
} from './reviewed-concept-curation.ts';
import type { CapabilityFamily, PublicCatalog } from './types.ts';

export const CANDIDATE_PROFILE_COVERAGE_VERSION_V2 =
  'deterministic-profile-coverage/2.0.0' as const;

interface LegacyStateCounts {
  readonly known: number;
  readonly unknown: number;
  readonly notApplicable: number;
  readonly conflict: number;
}

interface ConceptCoverageCounts {
  readonly unknown: number;
  readonly partial: number;
  readonly complete: number;
}

interface ConceptPairCounts {
  readonly total: number;
  readonly present: number;
  readonly absent: number;
  readonly conflicting: number;
  readonly unaddressed: number;
}

export interface CandidateProfileCoverageReportV2 {
  readonly coverageVersion: typeof CANDIDATE_PROFILE_COVERAGE_VERSION_V2;
  readonly profileRulesVersion: typeof DETERMINISTIC_PROFILE_RULES_VERSION_V2;
  readonly catalogVersion: string;
  readonly catalogDigest: string;
  readonly taxonomyVersion: string;
  readonly taxonomySemanticDigest: string;
  readonly profileAuthorityDigest: string;
  readonly curationAuthorityDigest: string;
  readonly totals: {
    readonly profiles: number;
    readonly fieldsPerProfile: number;
    readonly candidateFieldCells: number;
    readonly nonConceptFieldCells: number;
    readonly nonConceptStates: LegacyStateCounts;
    readonly conceptFieldCells: number;
    readonly conceptFieldCoverage: ConceptCoverageCounts;
    readonly fullyPopulatedConceptFields: number;
    readonly conceptPairs: ConceptPairCounts;
    readonly taxonomyConcepts: {
      readonly total: number;
      readonly withAnyAssertion: number;
      readonly unaddressed: number;
    };
  };
  readonly perConceptField: readonly {
    readonly fieldId: DeterministicProfileConceptAssertionFieldId;
    readonly taxonomyKind: 'feature' | 'infrastructure';
    readonly coverage: ConceptCoverageCounts;
    readonly fullyPopulated: number;
    readonly conceptPairs: ConceptPairCounts;
    readonly taxonomyConcepts: {
      readonly total: number;
      readonly withAnyAssertion: number;
      readonly unaddressed: number;
    };
  }[];
  readonly sourceAuthority: {
    readonly reviewedClaims: number;
    readonly exactScopeAdmissions: number;
    readonly artifactLineBasisReferences: number;
    readonly structuredSemanticBasisReferences: number;
    readonly generatedClaimProvenanceReferences: number;
  };
  readonly hardConstraintDemand: {
    readonly state: 'unbound';
    readonly authorityVersion: null;
    readonly authorityDigest: null;
    readonly reasonCode: 'product-demand-authority-not-bound';
  };
  readonly reportDigest: string;
}

export interface CandidateProfileGeneratedArtifactsV2 {
  readonly authority: DeterministicCandidateProfileAuthorityV2;
  readonly coverage: CandidateProfileCoverageReportV2;
}

export interface CandidateProfileGenerationScopeV2 {
  readonly candidateId: string;
  readonly fieldId: 'required-infrastructure' | 'optional-infrastructure';
  readonly versionScope: DeterministicProfileVersionScope;
}

export function buildCandidateProfileArtifactsV2(
  catalog: PublicCatalog,
  taxonomy: CapabilityTaxonomyV1,
  curationAuthority: ReviewedConceptCurationAuthorityV2,
  options: {
    readonly curationMaterial?: ReviewedConceptCurationMaterialV2;
    readonly generationScopes?: readonly CandidateProfileGenerationScopeV2[];
  } = {},
): CandidateProfileGeneratedArtifactsV2 {
  if (
    catalog.candidates.length !== 150 ||
    taxonomy.taxonomyVersion !== '1.0.0'
  ) {
    throw ingestionError('ingestion.invalid-manifest');
  }
  const accepted = acceptReviewedConceptCurationAuthorityV2({
    authority: curationAuthority,
    catalog,
    taxonomy,
    ...(options.curationMaterial === undefined
      ? {}
      : { material: options.curationMaterial }),
  });
  const scopes = generationScopeMap(options.generationScopes ?? []);
  const claimsByCandidate = new Map<string, AcceptedReviewedConceptClaimV2[]>();
  for (const claim of accepted.claims) {
    const claims = claimsByCandidate.get(claim.claim.candidateId) ?? [];
    claims.push(claim);
    claimsByCandidate.set(claim.claim.candidateId, claims);
  }
  const profiles = catalog.candidates.map((candidate) => {
    const base = projectCandidateProfile(candidate, catalog, taxonomy);
    const baseFields =
      base.fields as unknown as readonly DeterministicProfileFieldRecord[];
    const fields = baseFields.map((field) =>
      isConceptFieldId(field.fieldId)
        ? generateConceptField(
            field.fieldId,
            claimsByCandidate.get(candidate.candidateId) ?? [],
            accepted.authority.semanticAuthorityDigest,
            scopes.get(scopeKey(candidate.candidateId, field.fieldId)) ?? null,
          )
        : field,
    ) as DeterministicCandidateProfileInputV2['fields'];
    return createDeterministicCandidateProfileV2({
      contractVersion: '2.0.0',
      profileVersion: DETERMINISTIC_CANDIDATE_PROFILE_VERSION_V2,
      candidateId: candidate.candidateId,
      catalogBinding: {
        catalogVersion: catalog.catalogVersion,
        catalogDigest: catalog.manifestDigest,
      },
      taxonomyBinding: {
        taxonomyVersion: taxonomy.taxonomyVersion,
        taxonomySemanticDigest: taxonomy.semanticDigest,
      },
      profileRulesVersion: DETERMINISTIC_PROFILE_RULES_VERSION_V2,
      fields,
    });
  });
  const authority = createDeterministicCandidateProfileAuthorityV2({
    contractVersion: '2.0.0',
    authorityVersion: DETERMINISTIC_CANDIDATE_PROFILE_AUTHORITY_VERSION_V2,
    denominatorVersion: DETERMINISTIC_PROFILE_DENOMINATOR_VERSION_V2,
    catalogVersion: catalog.catalogVersion,
    catalogDigest: catalog.manifestDigest,
    taxonomyVersion: taxonomy.taxonomyVersion,
    taxonomySemanticDigest: taxonomy.semanticDigest,
    profileRulesVersion: DETERMINISTIC_PROFILE_RULES_VERSION_V2,
    profiles,
  });
  const coverage = buildCandidateProfileCoverageReportV2(
    authority,
    catalog,
    taxonomy,
    accepted.authority,
  );
  return Object.freeze({ authority, coverage });
}

function generateConceptField(
  fieldId: DeterministicProfileConceptAssertionFieldId,
  candidateClaims: readonly AcceptedReviewedConceptClaimV2[],
  curationAuthorityDigest: string,
  selectedScope: DeterministicProfileVersionScope | null,
): DeterministicProfileConceptFieldRecordV2 {
  const all = candidateClaims.filter(
    (entry) => entry.claim.fieldId === fieldId,
  );
  if (all.length === 0) return unknownConceptField(fieldId);
  let claims = all;
  let versionScope: DeterministicProfileVersionScope | null = null;
  if (fieldId !== 'capability-variants-features') {
    const distinctScopes = new Map(
      all.map((entry) => [scopeText(entry.versionScope), entry.versionScope]),
    );
    if (selectedScope === null) {
      if (distinctScopes.size !== 1) {
        throw ingestionError('ingestion.invalid-input');
      }
      versionScope = [...distinctScopes.values()][0] ?? null;
    } else {
      versionScope = selectedScope;
      claims = all.filter(
        (entry) => scopeText(entry.versionScope) === scopeText(selectedScope),
      );
      if (claims.length === 0) return unknownConceptField(fieldId);
    }
    if (versionScope === null) throw ingestionError('ingestion.invalid-input');
  }
  const byConcept = new Map<string, AcceptedReviewedConceptClaimV2[]>();
  for (const claim of claims) {
    const group = byConcept.get(claim.claim.conceptId) ?? [];
    group.push(claim);
    byConcept.set(claim.claim.conceptId, group);
  }
  const assertions = [...byConcept.entries()]
    .sort(([left], [right]) => compareText(left, right))
    .map(([conceptId, conceptClaims]) =>
      assertionForConcept(
        fieldId,
        conceptId,
        conceptClaims,
        curationAuthorityDigest,
      ),
    );
  return {
    fieldId,
    scope:
      fieldId === 'capability-variants-features'
        ? 'candidate-wide'
        : 'version-specific',
    coverage: 'partial',
    stateReasonCode: 'approved-structured-field-value',
    stateRuleId: 'assign-known-approved-structured-value',
    versionScope,
    sourceReferences: [],
    assertions,
  };
}

function assertionForConcept(
  fieldId: DeterministicProfileConceptAssertionFieldId,
  conceptId: string,
  claims: readonly AcceptedReviewedConceptClaimV2[],
  authorityDigest: string,
): DeterministicProfileConceptAssertionV2 {
  const byState = new Map(
    (['absent', 'present'] as const).map((state) => [
      state,
      claims.filter((entry) => entry.claim.state === state),
    ]),
  );
  const states = [...byState.entries()].filter(
    ([, entries]) => entries.length > 0,
  );
  const rule = `extract-${fieldId}-from-reviewed-curation-authority` as const;
  if (states.length === 1) {
    const onlyState = states[0];
    if (onlyState === undefined)
      throw ingestionError('ingestion.internal-invariant');
    const [state, entries] = onlyState;
    return {
      conceptId,
      state,
      valueExtractionRuleId: rule,
      sourceReferences: entries.map((entry) =>
        claimSourceReference(entry, authorityDigest),
      ),
    };
  }
  if (states.length !== 2) throw ingestionError('ingestion.internal-invariant');
  return {
    conceptId,
    state: 'conflict',
    claims: states.flatMap(([state, entries]) =>
      entries.map((entry) => ({
        state,
        valueExtractionRuleId: rule,
        sourceReferences: [claimSourceReference(entry, authorityDigest)],
      })),
    ),
  };
}

function claimSourceReference(
  accepted: AcceptedReviewedConceptClaimV2,
  authorityDigest: string,
) {
  return {
    kind: 'reviewed-curation-claim' as const,
    curationAuthorityDigest: authorityDigest,
    claimId: accepted.claim.claimId,
    claimDigest: accepted.claim.claimDigest,
    admissionId: accepted.admission?.admissionId ?? null,
    admissionDigest: accepted.admission?.admissionDigest ?? null,
  };
}

function unknownConceptField(
  fieldId: DeterministicProfileConceptAssertionFieldId,
): DeterministicProfileConceptFieldRecordV2 {
  return {
    fieldId,
    scope:
      fieldId === 'capability-variants-features'
        ? 'candidate-wide'
        : 'version-specific',
    coverage: 'unknown',
    stateReasonCode: 'requires-reviewed-curator-classification',
    stateRuleId: 'assign-unknown-reviewed-classification-missing',
    versionScope: null,
    sourceReferences: [],
    assertions: [],
  };
}

export function buildCandidateProfileCoverageReportV2(
  authority: DeterministicCandidateProfileAuthorityV2,
  catalog: PublicCatalog,
  taxonomy: CapabilityTaxonomyV1,
  curation: ReviewedConceptCurationAuthorityV2,
): CandidateProfileCoverageReportV2 {
  const profiles =
    authority.profiles as unknown as readonly DeterministicCandidateProfileV2Domain[];
  const familyByCandidate = new Map(
    catalog.candidates.map((candidate) => [
      candidate.candidateId,
      [
        candidate.primaryCapabilityFamily,
        ...candidate.additionalCapabilityFamilies,
      ] as readonly CapabilityFamily[],
    ]),
  );
  const nonConceptFields = profiles.flatMap((profile) =>
    profile.fields.filter((field) => !isConceptFieldId(field.fieldId)),
  ) as unknown as readonly DeterministicProfileFieldRecord[];
  const perConceptField = DETERMINISTIC_PROFILE_CONCEPT_ASSERTION_FIELD_IDS.map(
    (fieldId) => {
      const taxonomyKind =
        fieldId === 'capability-variants-features'
          ? ('feature' as const)
          : ('infrastructure' as const);
      const concepts = taxonomy.concepts.filter(
        (concept) => concept.kind === taxonomyKind,
      );
      const fields = profiles.map((profile) =>
        requireConceptField(profile.fields, fieldId),
      );
      const pairCounts = emptyPairCounts();
      const conceptsWithAssertion = new Set<string>();
      for (const [index, field] of fields.entries()) {
        const profile = profiles[index];
        if (profile === undefined)
          throw ingestionError('ingestion.internal-invariant');
        const families = familyByCandidate.get(profile.candidateId) ?? [];
        const assertions = new Map(
          field.assertions.map((assertion) => [assertion.conceptId, assertion]),
        );
        for (const concept of concepts) {
          if (
            !concept.applicableFamilyIds.some((family) =>
              families.includes(family),
            )
          ) {
            continue;
          }
          pairCounts.total += 1;
          const assertion = assertions.get(concept.conceptId);
          if (assertion !== undefined)
            conceptsWithAssertion.add(concept.conceptId);
          if (assertion?.state === 'present') pairCounts.present += 1;
          else if (assertion?.state === 'absent') pairCounts.absent += 1;
          else if (assertion?.state === 'conflict') pairCounts.conflicting += 1;
          else if (field.coverage === 'complete') pairCounts.absent += 1;
          else pairCounts.unaddressed += 1;
        }
      }
      const coverage = countConceptCoverage(fields);
      return {
        fieldId,
        taxonomyKind,
        coverage,
        fullyPopulated: coverage.complete,
        conceptPairs: freezePairCounts(pairCounts),
        taxonomyConcepts: {
          total: concepts.length,
          withAnyAssertion: conceptsWithAssertion.size,
          unaddressed: concepts.length - conceptsWithAssertion.size,
        },
      };
    },
  );
  const conceptCoverage = sumCoverage(
    perConceptField.map(({ coverage }) => coverage),
  );
  const pairs = sumPairs(
    perConceptField.map(({ conceptPairs }) => conceptPairs),
  );
  const uniqueTaxonomyConcepts = new Set(
    taxonomy.concepts
      .filter(({ kind }) => kind === 'feature' || kind === 'infrastructure')
      .map(({ conceptId }) => conceptId),
  );
  const assertedConcepts = new Set(
    profiles.flatMap((profile) =>
      profile.fields.flatMap((field) => {
        const conceptField = asConceptField(field);
        return conceptField?.assertions.map(({ conceptId }) => conceptId) ?? [];
      }),
    ),
  );
  const generatedProvenance = profiles.reduce(
    (total, profile) =>
      total +
      profile.fields.reduce((fieldTotal, field) => {
        const conceptField = asConceptField(field);
        return (
          fieldTotal +
          (conceptField === null
            ? 0
            : conceptField.assertions.reduce(
                (assertionTotal, assertion) =>
                  assertionTotal +
                  (assertion.state === 'conflict'
                    ? assertion.claims.reduce(
                        (claimTotal, claim) =>
                          claimTotal + claim.sourceReferences.length,
                        0,
                      )
                    : assertion.sourceReferences.length),
                0,
              ))
        );
      }, 0),
    0,
  );
  const withoutDigest = {
    coverageVersion: CANDIDATE_PROFILE_COVERAGE_VERSION_V2,
    profileRulesVersion: authority.profileRulesVersion,
    catalogVersion: authority.catalogVersion,
    catalogDigest: authority.catalogDigest,
    taxonomyVersion: authority.taxonomyVersion,
    taxonomySemanticDigest: authority.taxonomySemanticDigest,
    profileAuthorityDigest: authority.semanticAuthorityDigest,
    curationAuthorityDigest: curation.semanticAuthorityDigest,
    totals: {
      profiles: profiles.length,
      fieldsPerProfile: DETERMINISTIC_PROFILE_FIELD_IDS.length,
      candidateFieldCells:
        profiles.length * DETERMINISTIC_PROFILE_FIELD_IDS.length,
      nonConceptFieldCells: nonConceptFields.length,
      nonConceptStates: countLegacyStates(nonConceptFields),
      conceptFieldCells:
        profiles.length *
        DETERMINISTIC_PROFILE_CONCEPT_ASSERTION_FIELD_IDS.length,
      conceptFieldCoverage: conceptCoverage,
      fullyPopulatedConceptFields: conceptCoverage.complete,
      conceptPairs: pairs,
      taxonomyConcepts: {
        total: uniqueTaxonomyConcepts.size,
        withAnyAssertion: assertedConcepts.size,
        unaddressed: uniqueTaxonomyConcepts.size - assertedConcepts.size,
      },
    },
    perConceptField,
    sourceAuthority: {
      reviewedClaims: curation.claims.length,
      exactScopeAdmissions: curation.claims.reduce(
        (total, claim) => total + claim.admissions.length,
        0,
      ),
      artifactLineBasisReferences: curation.claims.reduce(
        (total, claim) =>
          total +
          claim.basisReferences.filter(({ kind }) => kind === 'artifact-lines')
            .length,
        0,
      ),
      structuredSemanticBasisReferences: curation.claims.reduce(
        (total, claim) =>
          total +
          claim.basisReferences.filter(
            ({ kind }) => kind === 'structured-semantic',
          ).length,
        0,
      ),
      generatedClaimProvenanceReferences: generatedProvenance,
    },
    hardConstraintDemand: {
      state: 'unbound' as const,
      authorityVersion: null,
      authorityDigest: null,
      reasonCode: 'product-demand-authority-not-bound' as const,
    },
  };
  return Object.freeze({
    ...withoutDigest,
    reportDigest: canonicalizeJson(withoutDigest).digest,
  });
}

function generationScopeMap(
  scopes: readonly CandidateProfileGenerationScopeV2[],
): ReadonlyMap<string, DeterministicProfileVersionScope> {
  const result = new Map<string, DeterministicProfileVersionScope>();
  for (const scope of scopes) {
    const key = scopeKey(scope.candidateId, scope.fieldId);
    if (result.has(key)) throw ingestionError('ingestion.invalid-input');
    result.set(key, scope.versionScope);
  }
  return result;
}

function scopeKey(
  candidateId: string,
  fieldId: DeterministicProfileConceptAssertionFieldId,
): string {
  return `${candidateId}\u0000${fieldId}`;
}

function scopeText(scope: DeterministicProfileVersionScope | null): string {
  return canonicalizeJson(scope).text;
}

function isConceptFieldId(
  fieldId: string,
): fieldId is DeterministicProfileConceptAssertionFieldId {
  return DETERMINISTIC_PROFILE_CONCEPT_ASSERTION_FIELD_IDS.includes(
    fieldId as DeterministicProfileConceptAssertionFieldId,
  );
}

function requireConceptField(
  fields: DeterministicCandidateProfileV2Domain['fields'],
  fieldId: DeterministicProfileConceptAssertionFieldId,
): DeterministicProfileConceptFieldRecordV2 {
  const field = fields.find((entry) => entry.fieldId === fieldId);
  if (field === undefined || !isConceptFieldId(field.fieldId)) {
    throw ingestionError('ingestion.internal-invariant');
  }
  return field as DeterministicProfileConceptFieldRecordV2;
}

function asConceptField(
  field: DeterministicCandidateProfileV2Domain['fields'][number],
): DeterministicProfileConceptFieldRecordV2 | null {
  return isConceptFieldId(field.fieldId)
    ? (field as DeterministicProfileConceptFieldRecordV2)
    : null;
}

function countLegacyStates(
  fields: readonly DeterministicProfileFieldRecord[],
): LegacyStateCounts {
  return {
    known: fields.filter(({ state }) => state === 'known').length,
    unknown: fields.filter(({ state }) => state === 'unknown').length,
    notApplicable: fields.filter(({ state }) => state === 'not-applicable')
      .length,
    conflict: fields.filter(({ state }) => state === 'conflict').length,
  };
}

function countConceptCoverage(
  fields: readonly DeterministicProfileConceptFieldRecordV2[],
): ConceptCoverageCounts {
  return {
    unknown: fields.filter(({ coverage }) => coverage === 'unknown').length,
    partial: fields.filter(({ coverage }) => coverage === 'partial').length,
    complete: fields.filter(({ coverage }) => coverage === 'complete').length,
  };
}

function sumCoverage(
  counts: readonly ConceptCoverageCounts[],
): ConceptCoverageCounts {
  return counts.reduce(
    (total, current) => ({
      unknown: total.unknown + current.unknown,
      partial: total.partial + current.partial,
      complete: total.complete + current.complete,
    }),
    { unknown: 0, partial: 0, complete: 0 },
  );
}

function emptyPairCounts(): {
  total: number;
  present: number;
  absent: number;
  conflicting: number;
  unaddressed: number;
} {
  return { total: 0, present: 0, absent: 0, conflicting: 0, unaddressed: 0 };
}

function freezePairCounts(counts: ConceptPairCounts): ConceptPairCounts {
  return Object.freeze({ ...counts });
}

function sumPairs(counts: readonly ConceptPairCounts[]): ConceptPairCounts {
  const total = emptyPairCounts();
  for (const current of counts) {
    total.total += current.total;
    total.present += current.present;
    total.absent += current.absent;
    total.conflicting += current.conflicting;
    total.unaddressed += current.unaddressed;
  }
  return freezePairCounts(total);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
