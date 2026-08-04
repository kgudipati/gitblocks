import {
  CONTRACT_VERSION,
  DETERMINISTIC_CANDIDATE_PROFILE_AUTHORITY_VERSION,
  DETERMINISTIC_CANDIDATE_PROFILE_VERSION,
  DETERMINISTIC_PROFILE_BROAD_RETRIEVAL_FACETS,
  DETERMINISTIC_PROFILE_DENOMINATOR_VERSION,
  DETERMINISTIC_PROFILE_FIELD_IDS,
  DETERMINISTIC_PROFILE_LAUNCH_HARD_FILTER_FACETS,
  DETERMINISTIC_PROFILE_RULES_VERSION,
  createDeterministicCandidateProfileAuthorityV1,
  createDeterministicCandidateProfileV1,
  getDeterministicProfileFieldRegistry,
  type CapabilityTaxonomyV1,
  type DeterministicCandidateProfile,
  type DeterministicCandidateProfileAuthorityV1,
  type DeterministicCandidateProfileInputV1,
  type DeterministicProfileFieldId,
  type DeterministicProfileFieldRecord,
} from '@gitblocks/contracts';

import { canonicalizeJson } from './canonical-json.ts';
import { ingestionError } from './errors.ts';
import type {
  CatalogCandidate,
  CapabilityFamily,
  PublicCatalog,
} from './types.ts';

export const CANDIDATE_PROFILE_COVERAGE_REPORT_VERSION =
  'deterministic-profile-coverage-report/1.0.0' as const;

const CURRENT_EXTRACTION_RULES = new Map<DeterministicProfileFieldId, string>([
  ['catalog-role-status', 'extract-catalog-role-status'],
  ['capability-family', 'extract-capability-family'],
  ['repository-identity', 'extract-repository-identity'],
  ['package-identity-mapping', 'extract-package-identity-mapping'],
]);

interface StateCounts {
  readonly known: number;
  readonly unknown: number;
  readonly notApplicable: number;
  readonly conflict: number;
}

export interface CandidateProfileCoverageReportV1 {
  readonly reportVersion: typeof CANDIDATE_PROFILE_COVERAGE_REPORT_VERSION;
  readonly denominatorVersion: typeof DETERMINISTIC_PROFILE_DENOMINATOR_VERSION;
  readonly profileRulesVersion: typeof DETERMINISTIC_PROFILE_RULES_VERSION;
  readonly catalogVersion: string;
  readonly catalogDigest: string;
  readonly taxonomyVersion: string;
  readonly taxonomySemanticDigest: string;
  readonly profileAuthorityDigest: string;
  readonly totals: {
    readonly profiles: number;
    readonly fieldsPerProfile: number;
    readonly candidateFieldCells: number;
    readonly representedFields: number;
    readonly extractionCapableFields: number;
    readonly fieldsHavingKnownValues: number;
    readonly known: number;
    readonly unknown: number;
    readonly notApplicable: number;
    readonly conflict: number;
  };
  readonly perField: readonly ({
    readonly fieldId: DeterministicProfileFieldId;
    readonly scope: 'candidate-wide' | 'version-specific';
    readonly currentKnownValueExtractionImplemented: boolean;
  } & StateCounts)[];
  readonly perFamily: readonly ({
    readonly family: CapabilityFamily;
    readonly profiles: number;
    readonly candidateFieldCells: number;
  } & StateCounts)[];
  readonly scopeStateCounts: readonly ({
    readonly scope: 'candidate-wide' | 'version-specific';
  } & StateCounts)[];
  readonly sourceAuthorityCounts: readonly {
    readonly sourceKind:
      | 'artifact-set-entry'
      | 'catalog-field'
      | 'derived-profile-fields'
      | 'structured-collection';
    readonly references: number;
  }[];
  readonly candidateSideHardFilterReadiness: {
    readonly readyFacets: readonly string[];
    readonly ready: number;
    readonly total: number;
    readonly percentage: number;
  };
  readonly broadRetrievalReadiness: {
    readonly readyFacets: readonly string[];
    readonly ready: number;
    readonly total: number;
    readonly percentage: number;
  };
  readonly laterRankingOnlyCoverage: {
    readonly fieldIds: readonly DeterministicProfileFieldId[];
    readonly fieldsHavingKnownValues: number;
    readonly knownCandidateCells: number;
  };
  readonly reportDigest: string;
}

export interface CandidateProfileGeneratedArtifacts {
  readonly authority: DeterministicCandidateProfileAuthorityV1;
  readonly coverage: CandidateProfileCoverageReportV1;
}

export function buildCandidateProfileArtifacts(
  catalog: PublicCatalog,
  taxonomy: CapabilityTaxonomyV1,
): CandidateProfileGeneratedArtifacts {
  if (
    catalog.candidates.length !== 150 ||
    taxonomy.taxonomyVersion !== '1.0.0'
  ) {
    throw ingestionError('ingestion.invalid-manifest');
  }
  const profiles = catalog.candidates.map((candidate) =>
    projectCandidateProfile(candidate, catalog, taxonomy),
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
  const coverage = buildCoverageReport(
    authority,
    new Map(
      catalog.candidates.map((candidate) => [
        candidate.candidateId,
        candidate.primaryCapabilityFamily,
      ]),
    ),
  );
  assertExpectedCoverage(coverage);
  return { authority, coverage };
}

export function projectCandidateProfile(
  candidate: CatalogCandidate,
  catalog: PublicCatalog,
  taxonomy: CapabilityTaxonomyV1,
): DeterministicCandidateProfileAuthorityV1['profiles'][number] {
  const fields = DETERMINISTIC_PROFILE_FIELD_IDS.map((fieldId) =>
    projectField(candidate, fieldId),
  ) as unknown as DeterministicCandidateProfileInputV1['fields'];
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

function projectField(
  candidate: CatalogCandidate,
  fieldId: DeterministicProfileFieldId,
): object {
  const definition = getDeterministicProfileFieldRegistry().find(
    (entry) => entry.fieldId === fieldId,
  );
  if (definition === undefined) {
    throw ingestionError('ingestion.internal-invariant');
  }
  const common = {
    fieldId,
    scope: definition.scope,
    versionScope: null,
  } as const;
  switch (fieldId) {
    case 'catalog-role-status':
      return known(
        common,
        'extract-catalog-role-status',
        {
          catalogStatus: candidate.status,
        },
        [catalogReference(candidate, 'status')],
      );
    case 'capability-family':
      return known(
        common,
        'extract-capability-family',
        {
          primaryFamily: candidate.primaryCapabilityFamily,
          additionalFamilies: [...candidate.additionalCapabilityFamilies],
        },
        [
          catalogReference(candidate, 'additional-capability-families'),
          catalogReference(candidate, 'primary-capability-family'),
        ],
      );
    case 'repository-identity':
      return known(
        common,
        'extract-repository-identity',
        {
          candidateId: candidate.candidateId,
          displayName: candidate.displayName,
          githubOwner: candidate.github.owner,
          githubRepository: candidate.github.repository,
        },
        [
          catalogReference(candidate, 'candidate-id'),
          catalogReference(candidate, 'display-name'),
          catalogReference(candidate, 'github-owner'),
          catalogReference(candidate, 'github-repository'),
        ],
      );
    case 'package-identity-mapping':
      return known(
        common,
        'extract-package-identity-mapping',
        candidate.npmPackage === null
          ? { mapping: 'unmapped' }
          : { mapping: 'mapped', packageName: candidate.npmPackage },
        [catalogReference(candidate, 'npm-package')],
      );
    case 'package-publication-version':
    case 'runtime-package-format':
    case 'package-repository-linkage':
      return candidate.npmPackage === null
        ? {
            ...common,
            state: 'not-applicable',
            stateReasonCode: 'package-mapping-unmapped',
            stateRuleId: 'assign-not-applicable-for-unmapped-package',
            valueExtractionRuleId: null,
            sourceReferences: [catalogReference(candidate, 'npm-package')],
          }
        : unknownField(
            common,
            'structured-provider-value-not-committed',
            'assign-unknown-structured-provider-value-missing',
            [catalogReference(candidate, 'npm-package')],
          );
    case 'adoption-unit-type':
    case 'capability-variants-features':
    case 'required-infrastructure':
    case 'optional-infrastructure':
    case 'deployment-self-hosting':
      return unknownField(
        common,
        'requires-reviewed-curator-classification',
        'assign-unknown-reviewed-classification-missing',
        [],
      );
    case 'artifact-chunk-availability':
      return unknownField(
        common,
        'artifact-materialization-authority-not-committed',
        'assign-unknown-artifact-authority-missing',
        [],
      );
    case 'repository-discovery-metadata':
    case 'documentation-presence':
    case 'test-ci-presence':
      return unknownField(
        common,
        'repository-wide-analysis-not-performed',
        'assign-unknown-repository-analysis-missing',
        [],
      );
    case 'language-ecosystem':
    case 'framework-compatibility':
    case 'datastore-requirements':
    case 'operational-complexity-primitives':
      return unknownField(
        common,
        'source-code-semantic-analysis-out-of-scope',
        'assign-unknown-source-analysis-out-of-scope',
        [],
      );
    case 'license-identity':
    case 'archived-state':
    case 'fork-upstream-state':
    case 'maintenance-activity':
    case 'release-state-recency':
    case 'security-advisory-state':
    case 'security-policy-presence':
      return unknownField(
        common,
        'structured-provider-value-not-committed',
        'assign-unknown-structured-provider-value-missing',
        [],
      );
  }
}

function known(
  common: object,
  valueExtractionRuleId: string,
  value: object,
  sourceReferences: readonly object[],
): object {
  return {
    ...common,
    state: 'known',
    stateReasonCode: 'approved-catalog-field-value',
    stateRuleId: 'assign-known-approved-catalog-value',
    valueExtractionRuleId,
    sourceReferences,
    value,
  };
}

function unknownField(
  common: object,
  stateReasonCode: string,
  stateRuleId: string,
  sourceReferences: readonly object[],
): object {
  return {
    ...common,
    state: 'unknown',
    stateReasonCode,
    stateRuleId,
    valueExtractionRuleId: null,
    sourceReferences,
  };
}

function catalogReference(
  candidate: CatalogCandidate,
  catalogField: string,
): object {
  return {
    kind: 'catalog-field',
    candidateId: candidate.candidateId,
    catalogField,
  };
}

function buildCoverageReport(
  authority: DeterministicCandidateProfileAuthorityV1,
  familyByCandidate: ReadonlyMap<string, CapabilityFamily>,
): CandidateProfileCoverageReportV1 {
  const profiles =
    authority.profiles as unknown as readonly DeterministicCandidateProfile[];
  const registry = getDeterministicProfileFieldRegistry();
  const perField = registry.map((definition) => {
    const fields = profiles.map((profile) =>
      requireField(profile, definition.fieldId),
    );
    return {
      fieldId: definition.fieldId,
      scope: definition.scope,
      currentKnownValueExtractionImplemented: CURRENT_EXTRACTION_RULES.has(
        definition.fieldId,
      ),
      ...countStates(fields),
    };
  });
  const allFields = profiles.flatMap((profile) => profile.fields);
  const states = countStates(allFields);
  const perFamily = [
    'authorization',
    'audit-logging',
    'background-jobs',
    'rate-limiting',
    'webhooks',
  ].map((family) => {
    const familyProfiles = profiles.filter(
      (profile) => familyByCandidate.get(profile.candidateId) === family,
    );
    return {
      family: family as CapabilityFamily,
      profiles: familyProfiles.length,
      candidateFieldCells: familyProfiles.length * registry.length,
      ...countStates(familyProfiles.flatMap((profile) => profile.fields)),
    };
  });
  const scopeStateCounts = (
    ['candidate-wide', 'version-specific'] as const
  ).map((scope) => ({
    scope,
    ...countStates(allFields.filter((field) => field.scope === scope)),
  }));
  const sourceKinds = [
    'artifact-set-entry',
    'catalog-field',
    'derived-profile-fields',
    'structured-collection',
  ] as const;
  const allSources = allFields.flatMap((field) => [
    ...field.sourceReferences,
    ...(field.state === 'conflict'
      ? field.claims.flatMap((claim) => claim.sourceReferences)
      : []),
  ]);
  const sourceAuthorityCounts = sourceKinds.map((sourceKind) => ({
    sourceKind,
    references: allSources.filter((source) => source.kind === sourceKind)
      .length,
  }));
  const readyHard = readyFacets('launchHardFilterFacet');
  const readyBroad = readyFacets('broadRetrievalFacet');
  const rankingOnly = registry.filter(
    (definition) =>
      definition.intendedUses.includes('later-ranking') &&
      definition.launchHardFilterFacet === null &&
      definition.broadRetrievalFacet === null,
  );
  const reportWithoutDigest = {
    reportVersion: CANDIDATE_PROFILE_COVERAGE_REPORT_VERSION,
    denominatorVersion: authority.denominatorVersion,
    profileRulesVersion: authority.profileRulesVersion,
    catalogVersion: authority.catalogVersion,
    catalogDigest: authority.catalogDigest,
    taxonomyVersion: authority.taxonomyVersion,
    taxonomySemanticDigest: authority.taxonomySemanticDigest,
    profileAuthorityDigest: authority.semanticAuthorityDigest,
    totals: {
      profiles: profiles.length,
      fieldsPerProfile: registry.length,
      candidateFieldCells: allFields.length,
      representedFields: registry.length,
      extractionCapableFields: CURRENT_EXTRACTION_RULES.size,
      fieldsHavingKnownValues: perField.filter(({ known }) => known > 0).length,
      ...states,
    },
    perField,
    perFamily,
    scopeStateCounts,
    sourceAuthorityCounts,
    candidateSideHardFilterReadiness: {
      readyFacets: readyHard,
      ready: readyHard.length,
      total: DETERMINISTIC_PROFILE_LAUNCH_HARD_FILTER_FACETS.length,
      percentage: percentage(
        readyHard.length,
        DETERMINISTIC_PROFILE_LAUNCH_HARD_FILTER_FACETS.length,
      ),
    },
    broadRetrievalReadiness: {
      readyFacets: readyBroad,
      ready: readyBroad.length,
      total: DETERMINISTIC_PROFILE_BROAD_RETRIEVAL_FACETS.length,
      percentage: percentage(
        readyBroad.length,
        DETERMINISTIC_PROFILE_BROAD_RETRIEVAL_FACETS.length,
      ),
    },
    laterRankingOnlyCoverage: {
      fieldIds: rankingOnly.map(({ fieldId }) => fieldId),
      fieldsHavingKnownValues: rankingOnly.filter(({ fieldId }) =>
        perField.some((field) => field.fieldId === fieldId && field.known > 0),
      ).length,
      knownCandidateCells: rankingOnly.reduce(
        (total, { fieldId }) =>
          total +
          (perField.find((field) => field.fieldId === fieldId)?.known ?? 0),
        0,
      ),
    },
  };
  return {
    ...reportWithoutDigest,
    reportDigest: canonicalizeJson(reportWithoutDigest).digest,
  };

  function readyFacets(
    key: 'broadRetrievalFacet' | 'launchHardFilterFacet',
  ): string[] {
    const facets =
      key === 'launchHardFilterFacet'
        ? DETERMINISTIC_PROFILE_LAUNCH_HARD_FILTER_FACETS
        : DETERMINISTIC_PROFILE_BROAD_RETRIEVAL_FACETS;
    return facets.filter((facet) => {
      const requiredFields = registry.filter(
        (definition) => definition[key] === facet,
      );
      return (
        requiredFields.length > 0 &&
        requiredFields.every(({ fieldId }) =>
          CURRENT_EXTRACTION_RULES.has(fieldId),
        )
      );
    });
  }
}

function countStates(
  fields: readonly DeterministicProfileFieldRecord[],
): StateCounts {
  return {
    known: fields.filter(({ state }) => state === 'known').length,
    unknown: fields.filter(({ state }) => state === 'unknown').length,
    notApplicable: fields.filter(({ state }) => state === 'not-applicable')
      .length,
    conflict: fields.filter(({ state }) => state === 'conflict').length,
  };
}

function requireField(
  profile: DeterministicCandidateProfile,
  fieldId: DeterministicProfileFieldId,
): DeterministicProfileFieldRecord {
  const field = profile.fields.find((entry) => entry.fieldId === fieldId);
  if (field === undefined) throw ingestionError('ingestion.internal-invariant');
  return field;
}

function percentage(numerator: number, denominator: number): number {
  return Math.round((numerator / denominator) * 1_000) / 10;
}

function assertExpectedCoverage(
  report: CandidateProfileCoverageReportV1,
): void {
  const totals = report.totals;
  if (
    totals.profiles !== 150 ||
    totals.fieldsPerProfile !== 27 ||
    totals.candidateFieldCells !== 4_050 ||
    totals.representedFields !== 27 ||
    totals.extractionCapableFields !== 4 ||
    totals.fieldsHavingKnownValues !== 4 ||
    totals.known !== 600 ||
    totals.unknown !== 3_240 ||
    totals.notApplicable !== 210 ||
    totals.conflict !== 0 ||
    report.perField.some(
      (field) =>
        field.known + field.unknown + field.notApplicable + field.conflict !==
        150,
    ) ||
    report.perFamily.some(
      (family) =>
        family.profiles !== 30 ||
        family.candidateFieldCells !== 810 ||
        family.known +
          family.unknown +
          family.notApplicable +
          family.conflict !==
          810,
    ) ||
    report.candidateSideHardFilterReadiness.ready !== 2 ||
    report.candidateSideHardFilterReadiness.total !== 16 ||
    report.candidateSideHardFilterReadiness.percentage !== 12.5 ||
    report.broadRetrievalReadiness.ready !== 2 ||
    report.broadRetrievalReadiness.total !== 9 ||
    report.broadRetrievalReadiness.percentage !== 22.2
  ) {
    throw ingestionError('ingestion.internal-invariant');
  }
}
