/* eslint-disable @typescript-eslint/no-unnecessary-condition -- Trust-boundary validation intentionally rechecks literal DTO fields at runtime. */

import {
  DETERMINISTIC_PROFILE_BROAD_RETRIEVAL_FACETS,
  DETERMINISTIC_PROFILE_FIELD_IDS,
  DETERMINISTIC_PROFILE_LAUNCH_HARD_FILTER_FACETS,
  getDeterministicProfileFieldRegistry,
  type CapabilityTaxonomyV1,
  type DeterministicCandidateProfileAuthorityV1,
  type DeterministicProfileFieldId,
  type DeterministicProfileFieldRecord,
} from '@gitblocks/contracts';

import {
  materializeCandidateProfiles,
  type MaterializedCandidateProfileAuthority,
} from './candidate-profile-materialization.ts';
import {
  buildCandidateProfileArtifacts,
  type CandidateProfileCoverageReportV1,
} from './candidate-profile-projection.ts';
import { canonicalizeJson } from './canonical-json.ts';
import { ingestionError } from './errors.ts';
import {
  PROFILE_MATERIALIZATION_ACCEPTED_BINDINGS,
  PROFILE_MATERIALIZATION_AUTHORIZED_FIELD_IDS,
  PROFILE_MATERIALIZATION_COVERAGE_VERSION,
  assertNoForbiddenContent,
  compareText,
  isDigest,
  isSafeCode,
  requireExactKeys,
  requireRecord,
  type ProfileMaterializationSourceAuthority,
  type ProfileMaterializationStateCounts,
} from './profile-materialization-contracts.ts';
import type { CapabilityFamily, PublicCatalog } from './types.ts';

export const ACCEPTED_OFFLINE_PROFILE_AUTHORITY_DIGEST =
  'fc85d7ea71c69cd5e56e5a73936ceba6263c4ea0ba8fc2d0802556d79cf9e879' as const;
export const ACCEPTED_OFFLINE_PROFILE_COVERAGE_DIGEST =
  'b313d7f7afc3f9324042fff965f9e63c4e0a347be2f7363808cb6107e913fb17' as const;

export interface ProfileMaterializationCoverageTransition {
  readonly from: 'conflict' | 'known' | 'not-applicable' | 'unknown';
  readonly to: 'conflict' | 'known' | 'not-applicable' | 'unknown';
  readonly count: number;
}

export interface ProfileMaterializationCoverageReport {
  readonly coverageVersion: typeof PROFILE_MATERIALIZATION_COVERAGE_VERSION;
  readonly catalogVersion: 'public-v1';
  readonly catalogDigest: string;
  readonly taxonomyVersion: '1.0.0';
  readonly taxonomyDigest: string;
  readonly offlineProfileAuthorityDigest: string;
  readonly offlineProfileCoverageDigest: string;
  readonly finalSourceAuthorityDigest: string;
  readonly finalProfileAuthorityDigest: string;
  readonly aggregate: {
    readonly offline: ProfileMaterializationStateCounts;
    readonly final: ProfileMaterializationStateCounts;
    readonly transitions: readonly ProfileMaterializationCoverageTransition[];
  };
  readonly perField: readonly {
    readonly fieldId: DeterministicProfileFieldId;
    readonly extractionRule: string;
    readonly offline: ProfileMaterializationStateCounts;
    readonly final: ProfileMaterializationStateCounts;
    readonly transitions: readonly ProfileMaterializationCoverageTransition[];
    readonly remainingUnknown: number;
  }[];
  readonly perFamily: readonly {
    readonly family: CapabilityFamily;
    readonly offline: ProfileMaterializationStateCounts;
    readonly final: ProfileMaterializationStateCounts;
    readonly transitions: readonly ProfileMaterializationCoverageTransition[];
  }[];
  readonly remainingUnknownReasons: readonly {
    readonly reasonCode: string;
    readonly count: number;
  }[];
  readonly hardFilterReadiness: {
    readonly offlineReadyFacets: readonly string[];
    readonly finalReadyFacets: readonly string[];
    readonly totalFacets: number;
  };
  readonly broadRetrievalReadiness: {
    readonly offlineReadyFacets: readonly string[];
    readonly finalReadyFacets: readonly string[];
    readonly totalFacets: number;
  };
  readonly coverageSemanticDigest: string;
}

export interface ProfileMaterializationArtifacts extends MaterializedCandidateProfileAuthority {
  readonly coverage: ProfileMaterializationCoverageReport;
}

export function buildProfileMaterializationArtifacts(
  catalog: PublicCatalog,
  taxonomy: CapabilityTaxonomyV1,
  sourceAuthority: ProfileMaterializationSourceAuthority,
): ProfileMaterializationArtifacts {
  const offline = buildCandidateProfileArtifacts(catalog, taxonomy);
  if (
    offline.authority.semanticAuthorityDigest !==
      ACCEPTED_OFFLINE_PROFILE_AUTHORITY_DIGEST ||
    offline.coverage.reportDigest !== ACCEPTED_OFFLINE_PROFILE_COVERAGE_DIGEST
  ) {
    throw ingestionError('ingestion.invalid-manifest');
  }
  const materialized = materializeCandidateProfiles(
    catalog,
    taxonomy,
    sourceAuthority,
  );
  const coverage = compareProfileMaterializationCoverage(
    catalog,
    sourceAuthority,
    offline.authority,
    offline.coverage,
    materialized.authority,
  );
  return Object.freeze({ ...materialized, coverage });
}

export function compareProfileMaterializationCoverage(
  catalog: PublicCatalog,
  sourceAuthority: ProfileMaterializationSourceAuthority,
  offlineAuthority: DeterministicCandidateProfileAuthorityV1,
  offlineCoverage: CandidateProfileCoverageReportV1,
  finalAuthority: DeterministicCandidateProfileAuthorityV1,
): ProfileMaterializationCoverageReport {
  if (
    offlineAuthority.profiles.length !== 150 ||
    finalAuthority.profiles.length !== 150 ||
    sourceAuthority.candidateCount !== 150 ||
    offlineAuthority.catalogDigest !== catalog.manifestDigest ||
    finalAuthority.catalogDigest !== catalog.manifestDigest
  ) {
    throw ingestionError('ingestion.invalid-manifest');
  }
  const offlineById = new Map(
    offlineAuthority.profiles.map((profile) => [profile.candidateId, profile]),
  );
  const finalById = new Map(
    finalAuthority.profiles.map((profile) => [profile.candidateId, profile]),
  );
  const pairs = [...catalog.candidates]
    .sort((left, right) => compareText(left.candidateId, right.candidateId))
    .map((candidate) => {
      const offline = offlineById.get(candidate.candidateId);
      const final = finalById.get(candidate.candidateId);
      if (offline === undefined || final === undefined) {
        throw ingestionError('ingestion.invalid-manifest');
      }
      return { candidate, offline, final };
    });
  const allOffline = pairs.flatMap(
    ({ offline }) =>
      offline.fields as unknown as readonly DeterministicProfileFieldRecord[],
  );
  const allFinal = pairs.flatMap(
    ({ final }) =>
      final.fields as unknown as readonly DeterministicProfileFieldRecord[],
  );
  const perField = DETERMINISTIC_PROFILE_FIELD_IDS.map((fieldId) => {
    const fieldPairs = pairs.map(({ offline, final }) => ({
      offline: requireField(offline.fields, fieldId),
      final: requireField(final.fields, fieldId),
    }));
    return {
      fieldId,
      extractionRule: PROFILE_MATERIALIZATION_AUTHORIZED_FIELD_IDS.includes(
        fieldId as (typeof PROFILE_MATERIALIZATION_AUTHORIZED_FIELD_IDS)[number],
      )
        ? `extract-${fieldId}-from-structured-authority`
        : `preserve-accepted-offline-${fieldId}`,
      offline: countStates(fieldPairs.map(({ offline }) => offline)),
      final: countStates(fieldPairs.map(({ final }) => final)),
      transitions: countTransitions(fieldPairs),
      remainingUnknown: fieldPairs.filter(
        ({ final }) => final.state === 'unknown',
      ).length,
    };
  });
  const families = [
    'authorization',
    'audit-logging',
    'background-jobs',
    'rate-limiting',
    'webhooks',
  ] as const;
  const perFamily = families.map((family) => {
    const familyPairs = pairs.filter(
      ({ candidate }) => candidate.primaryCapabilityFamily === family,
    );
    return {
      family,
      offline: countStates(
        familyPairs.flatMap(({ offline }) => offline.fields),
      ),
      final: countStates(familyPairs.flatMap(({ final }) => final.fields)),
      transitions: countTransitions(
        familyPairs.flatMap(({ offline, final }) =>
          DETERMINISTIC_PROFILE_FIELD_IDS.map((fieldId) => ({
            offline: requireField(offline.fields, fieldId),
            final: requireField(final.fields, fieldId),
          })),
        ),
      ),
    };
  });
  const remainingReasons = new Map<string, number>();
  for (const field of allFinal) {
    if (field.state === 'unknown') {
      remainingReasons.set(
        field.stateReasonCode,
        (remainingReasons.get(field.stateReasonCode) ?? 0) + 1,
      );
    }
  }
  const offlineCapable = new Set(
    offlineCoverage.perField
      .filter((field) => field.currentKnownValueExtractionImplemented)
      .map((field) => field.fieldId),
  );
  const finalCapable = new Set([
    ...offlineCapable,
    ...PROFILE_MATERIALIZATION_AUTHORIZED_FIELD_IDS,
  ]);
  const withoutDigest = {
    coverageVersion: PROFILE_MATERIALIZATION_COVERAGE_VERSION,
    catalogVersion: catalog.catalogVersion,
    catalogDigest: catalog.manifestDigest,
    taxonomyVersion: sourceAuthority.taxonomyVersion,
    taxonomyDigest: sourceAuthority.taxonomyDigest,
    offlineProfileAuthorityDigest: offlineAuthority.semanticAuthorityDigest,
    offlineProfileCoverageDigest: offlineCoverage.reportDigest,
    finalSourceAuthorityDigest: sourceAuthority.authoritySemanticDigest,
    finalProfileAuthorityDigest: finalAuthority.semanticAuthorityDigest,
    aggregate: {
      offline: countStates(allOffline),
      final: countStates(allFinal),
      transitions: countTransitions(
        pairs.flatMap(({ offline, final }) =>
          DETERMINISTIC_PROFILE_FIELD_IDS.map((fieldId) => ({
            offline: requireField(offline.fields, fieldId),
            final: requireField(final.fields, fieldId),
          })),
        ),
      ),
    },
    perField,
    perFamily,
    remainingUnknownReasons: [...remainingReasons]
      .map(([reasonCode, count]) => ({ reasonCode, count }))
      .sort((left, right) => compareText(left.reasonCode, right.reasonCode)),
    hardFilterReadiness: {
      offlineReadyFacets: readyFacets('launchHardFilterFacet', offlineCapable),
      finalReadyFacets: readyFacets('launchHardFilterFacet', finalCapable),
      totalFacets: DETERMINISTIC_PROFILE_LAUNCH_HARD_FILTER_FACETS.length,
    },
    broadRetrievalReadiness: {
      offlineReadyFacets: readyFacets('broadRetrievalFacet', offlineCapable),
      finalReadyFacets: readyFacets('broadRetrievalFacet', finalCapable),
      totalFacets: DETERMINISTIC_PROFILE_BROAD_RETRIEVAL_FACETS.length,
    },
  };
  return Object.freeze({
    ...withoutDigest,
    coverageSemanticDigest: canonicalizeJson(withoutDigest).digest,
  });
}

export function parseProfileMaterializationCoverage(
  value: unknown,
): ProfileMaterializationCoverageReport {
  const report = requireRecord(
    value,
  ) as unknown as ProfileMaterializationCoverageReport;
  requireExactKeys(requireRecord(report), [
    'aggregate',
    'broadRetrievalReadiness',
    'catalogDigest',
    'catalogVersion',
    'coverageSemanticDigest',
    'coverageVersion',
    'finalProfileAuthorityDigest',
    'finalSourceAuthorityDigest',
    'hardFilterReadiness',
    'offlineProfileAuthorityDigest',
    'offlineProfileCoverageDigest',
    'perFamily',
    'perField',
    'remainingUnknownReasons',
    'taxonomyDigest',
    'taxonomyVersion',
  ]);
  assertNoForbiddenContent(report);
  if (
    report.coverageVersion !== PROFILE_MATERIALIZATION_COVERAGE_VERSION ||
    report.catalogVersion !== 'public-v1' ||
    report.taxonomyVersion !== '1.0.0' ||
    report.catalogDigest !==
      PROFILE_MATERIALIZATION_ACCEPTED_BINDINGS.catalogDigest ||
    report.taxonomyDigest !==
      PROFILE_MATERIALIZATION_ACCEPTED_BINDINGS.taxonomyDigest ||
    report.offlineProfileAuthorityDigest !==
      ACCEPTED_OFFLINE_PROFILE_AUTHORITY_DIGEST ||
    report.offlineProfileCoverageDigest !==
      ACCEPTED_OFFLINE_PROFILE_COVERAGE_DIGEST ||
    report.perField.length !== DETERMINISTIC_PROFILE_FIELD_IDS.length ||
    report.perFamily.length !== 5 ||
    ![
      report.catalogDigest,
      report.taxonomyDigest,
      report.finalSourceAuthorityDigest,
      report.finalProfileAuthorityDigest,
      report.coverageSemanticDigest,
    ].every(isDigest)
  ) {
    throw ingestionError('ingestion.invalid-receipt');
  }
  validateComparison(report.aggregate, 150 * 27);
  for (const [index, field] of report.perField.entries()) {
    requireExactKeys(requireRecord(field), [
      'extractionRule',
      'fieldId',
      'final',
      'offline',
      'remainingUnknown',
      'transitions',
    ]);
    const expectedFieldId = DETERMINISTIC_PROFILE_FIELD_IDS[index];
    if (expectedFieldId === undefined) {
      throw ingestionError('ingestion.invalid-receipt');
    }
    const expectedRule = PROFILE_MATERIALIZATION_AUTHORIZED_FIELD_IDS.includes(
      expectedFieldId as (typeof PROFILE_MATERIALIZATION_AUTHORIZED_FIELD_IDS)[number],
    )
      ? `extract-${expectedFieldId}-from-structured-authority`
      : `preserve-accepted-offline-${expectedFieldId}`;
    validateComparison(field, 150);
    if (
      field.fieldId !== expectedFieldId ||
      field.extractionRule !== expectedRule ||
      field.remainingUnknown !== field.final.unknown
    ) {
      throw ingestionError('ingestion.invalid-receipt');
    }
  }
  const familyIds = [
    'authorization',
    'audit-logging',
    'background-jobs',
    'rate-limiting',
    'webhooks',
  ] as const;
  for (const [index, family] of report.perFamily.entries()) {
    requireExactKeys(requireRecord(family), [
      'family',
      'final',
      'offline',
      'transitions',
    ]);
    validateComparison(family, 30 * 27);
    if (family.family !== familyIds[index]) {
      throw ingestionError('ingestion.invalid-receipt');
    }
  }
  const familyOffline = report.perFamily.reduce(
    (total, family) => addCounts(total, family.offline),
    emptyCounts(),
  );
  const familyFinal = report.perFamily.reduce(
    (total, family) => addCounts(total, family.final),
    emptyCounts(),
  );
  const fieldOffline = report.perField.reduce(
    (total, field) => addCounts(total, field.offline),
    emptyCounts(),
  );
  const fieldFinal = report.perField.reduce(
    (total, field) => addCounts(total, field.final),
    emptyCounts(),
  );
  if (
    canonicalizeJson(familyOffline).text !==
      canonicalizeJson(report.aggregate.offline).text ||
    canonicalizeJson(familyFinal).text !==
      canonicalizeJson(report.aggregate.final).text ||
    canonicalizeJson(fieldOffline).text !==
      canonicalizeJson(report.aggregate.offline).text ||
    canonicalizeJson(fieldFinal).text !==
      canonicalizeJson(report.aggregate.final).text ||
    canonicalizeJson(mergeTransitions(report.perField)).text !==
      canonicalizeJson(report.aggregate.transitions).text ||
    canonicalizeJson(mergeTransitions(report.perFamily)).text !==
      canonicalizeJson(report.aggregate.transitions).text
  ) {
    throw ingestionError('ingestion.invalid-receipt');
  }
  let remainingUnknown = 0;
  for (const [index, reason] of report.remainingUnknownReasons.entries()) {
    requireExactKeys(requireRecord(reason), ['count', 'reasonCode']);
    if (
      !isSafeCode(reason.reasonCode) ||
      !Number.isInteger(reason.count) ||
      reason.count < 1 ||
      (index > 0 &&
        compareText(
          report.remainingUnknownReasons[index - 1]?.reasonCode ?? '',
          reason.reasonCode,
        ) >= 0)
    ) {
      throw ingestionError('ingestion.invalid-receipt');
    }
    remainingUnknown += reason.count;
  }
  if (remainingUnknown !== report.aggregate.final.unknown) {
    throw ingestionError('ingestion.invalid-receipt');
  }
  validateReadiness(
    report.hardFilterReadiness,
    DETERMINISTIC_PROFILE_LAUNCH_HARD_FILTER_FACETS,
  );
  validateReadiness(
    report.broadRetrievalReadiness,
    DETERMINISTIC_PROFILE_BROAD_RETRIEVAL_FACETS,
  );
  const withoutDigest = { ...report } as Record<string, unknown>;
  delete withoutDigest['coverageSemanticDigest'];
  if (
    canonicalizeJson(withoutDigest).digest !== report.coverageSemanticDigest
  ) {
    throw ingestionError('ingestion.invalid-receipt');
  }
  return report;
}

function validateComparison(
  value: {
    readonly offline: ProfileMaterializationStateCounts;
    readonly final: ProfileMaterializationStateCounts;
    readonly transitions: readonly ProfileMaterializationCoverageTransition[];
  },
  expectedTotal?: number,
): void {
  for (const counts of [value.offline, value.final]) {
    requireExactKeys(requireRecord(counts), [
      'conflict',
      'known',
      'notApplicable',
      'unknown',
    ]);
    const total = stateTotal(counts);
    if (
      ![
        counts.conflict,
        counts.known,
        counts.notApplicable,
        counts.unknown,
      ].every((count) => Number.isInteger(count) && count >= 0) ||
      (expectedTotal !== undefined && total !== expectedTotal)
    ) {
      throw ingestionError('ingestion.invalid-receipt');
    }
  }
  let transitionTotal = 0;
  let previous = '';
  for (const transition of value.transitions) {
    requireExactKeys(requireRecord(transition), ['count', 'from', 'to']);
    const key = `${transition.from}->${transition.to}`;
    if (
      !['conflict', 'known', 'not-applicable', 'unknown'].includes(
        transition.from,
      ) ||
      !['conflict', 'known', 'not-applicable', 'unknown'].includes(
        transition.to,
      ) ||
      !Number.isInteger(transition.count) ||
      transition.count < 1 ||
      (previous !== '' && compareText(previous, key) >= 0)
    ) {
      throw ingestionError('ingestion.invalid-receipt');
    }
    previous = key;
    transitionTotal += transition.count;
  }
  if (
    transitionTotal !== stateTotal(value.offline) ||
    transitionTotal !== stateTotal(value.final) ||
    !transitionMarginalsMatch(value)
  ) {
    throw ingestionError('ingestion.invalid-receipt');
  }
}

function transitionMarginalsMatch(value: {
  readonly offline: ProfileMaterializationStateCounts;
  readonly final: ProfileMaterializationStateCounts;
  readonly transitions: readonly ProfileMaterializationCoverageTransition[];
}): boolean {
  const states = ['conflict', 'known', 'not-applicable', 'unknown'] as const;
  return states.every((state) => {
    const from = value.transitions
      .filter((entry) => entry.from === state)
      .reduce((total, entry) => total + entry.count, 0);
    const to = value.transitions
      .filter((entry) => entry.to === state)
      .reduce((total, entry) => total + entry.count, 0);
    const key = state === 'not-applicable' ? 'notApplicable' : state;
    return from === value.offline[key] && to === value.final[key];
  });
}

function mergeTransitions(
  entries: readonly {
    readonly transitions: readonly ProfileMaterializationCoverageTransition[];
  }[],
): readonly ProfileMaterializationCoverageTransition[] {
  const counts = new Map<string, number>();
  for (const transition of entries.flatMap((entry) => entry.transitions)) {
    const key = `${transition.from}->${transition.to}`;
    counts.set(key, (counts.get(key) ?? 0) + transition.count);
  }
  return [...counts]
    .map(([key, count]) => {
      const [from, to] = key.split('->') as [
        ProfileMaterializationCoverageTransition['from'],
        ProfileMaterializationCoverageTransition['to'],
      ];
      return { from, to, count };
    })
    .sort(
      (left, right) =>
        compareText(left.from, right.from) || compareText(left.to, right.to),
    );
}

function validateReadiness(
  value: {
    readonly offlineReadyFacets: readonly string[];
    readonly finalReadyFacets: readonly string[];
    readonly totalFacets: number;
  },
  authority: readonly string[],
): void {
  requireExactKeys(requireRecord(value), [
    'finalReadyFacets',
    'offlineReadyFacets',
    'totalFacets',
  ]);
  if (
    value.totalFacets !== authority.length ||
    [value.offlineReadyFacets, value.finalReadyFacets].some(
      (facets) =>
        new Set(facets).size !== facets.length ||
        facets.some(
          (facet, index) =>
            !authority.includes(facet) ||
            (index > 0 && compareText(facets[index - 1] ?? '', facet) >= 0),
        ),
    )
  ) {
    throw ingestionError('ingestion.invalid-receipt');
  }
}

function stateTotal(counts: ProfileMaterializationStateCounts): number {
  return counts.known + counts.unknown + counts.notApplicable + counts.conflict;
}

function emptyCounts(): ProfileMaterializationStateCounts {
  return { known: 0, unknown: 0, notApplicable: 0, conflict: 0 };
}

function addCounts(
  left: ProfileMaterializationStateCounts,
  right: ProfileMaterializationStateCounts,
): ProfileMaterializationStateCounts {
  return {
    known: left.known + right.known,
    unknown: left.unknown + right.unknown,
    notApplicable: left.notApplicable + right.notApplicable,
    conflict: left.conflict + right.conflict,
  };
}

function countStates(
  fields: readonly DeterministicProfileFieldRecord[],
): ProfileMaterializationStateCounts {
  return {
    known: fields.filter((field) => field.state === 'known').length,
    unknown: fields.filter((field) => field.state === 'unknown').length,
    notApplicable: fields.filter((field) => field.state === 'not-applicable')
      .length,
    conflict: fields.filter((field) => field.state === 'conflict').length,
  };
}

function countTransitions(
  pairs: readonly {
    readonly offline: DeterministicProfileFieldRecord;
    readonly final: DeterministicProfileFieldRecord;
  }[],
): readonly ProfileMaterializationCoverageTransition[] {
  const counts = new Map<string, number>();
  for (const pair of pairs) {
    const key = `${pair.offline.state}->${pair.final.state}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts]
    .map(([key, count]) => {
      const [from, to] = key.split('->') as [
        ProfileMaterializationCoverageTransition['from'],
        ProfileMaterializationCoverageTransition['to'],
      ];
      return { from, to, count };
    })
    .sort(
      (left, right) =>
        compareText(left.from, right.from) || compareText(left.to, right.to),
    );
}

function readyFacets(
  key: 'broadRetrievalFacet' | 'launchHardFilterFacet',
  capable: ReadonlySet<DeterministicProfileFieldId>,
): readonly string[] {
  const facets =
    key === 'launchHardFilterFacet'
      ? DETERMINISTIC_PROFILE_LAUNCH_HARD_FILTER_FACETS
      : DETERMINISTIC_PROFILE_BROAD_RETRIEVAL_FACETS;
  const registry = getDeterministicProfileFieldRegistry();
  return facets.filter((facet) => {
    const required = registry.filter((field) => field[key] === facet);
    return (
      required.length > 0 &&
      required.every((field) => capable.has(field.fieldId))
    );
  });
}

function requireField(
  fields: readonly DeterministicProfileFieldRecord[],
  fieldId: DeterministicProfileFieldId,
): DeterministicProfileFieldRecord {
  const field = fields.find((entry) => entry.fieldId === fieldId);
  if (field === undefined) throw ingestionError('ingestion.invalid-manifest');
  return field;
}
