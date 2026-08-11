import type { DeterministicProfileFieldRecord } from '@gitblocks/contracts';

import { canonicalizeJson } from './canonical-json.ts';
import { RANKING_DECISION_FIELD_IDS } from './candidate-authority-contracts.ts';
import {
  CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_DIGEST,
  CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_VERSION,
  type CandidateAuthoritySourceAuthorityV1,
} from './candidate-authority-live-contracts.ts';
import {
  CANDIDATE_AUTHORITY_FIELD_PLAN_V4_DIGEST,
  CANDIDATE_AUTHORITY_FIELD_PLAN_V4_VERSION,
  CANDIDATE_AUTHORITY_READINESS_POLICY_V3_DIGEST,
  CANDIDATE_AUTHORITY_READINESS_POLICY_V3_VERSION,
  CANDIDATE_AUTHORITY_ROOT_V4_VERSION,
  CANDIDATE_AUTHORITY_SOURCE_POLICY_V4_DIGEST,
  CANDIDATE_AUTHORITY_SOURCE_POLICY_V4_VERSION,
  candidateAuthorityRootV4SemanticDigest,
  evaluateCandidateAuthorityRealizedReadiness,
  type CandidateAuthorityCellOrigin,
  type CandidateAuthorityFieldPlanV4,
  type CandidateAuthorityFieldRealization,
  type CandidateAuthorityRootV4,
} from './candidate-authority-readiness.ts';
import {
  CANDIDATE_AUTHORITY_PARTIAL_EVIDENCE_CONTRACT_DIGEST,
  CANDIDATE_AUTHORITY_PARTIAL_EVIDENCE_VERSION,
} from './candidate-authority-partial-evidence.ts';
import {
  CANDIDATE_AUTHORITY_PARTIAL_SEMANTIC_REGISTRY_DIGEST,
  CANDIDATE_AUTHORITY_PARTIAL_SEMANTIC_REGISTRY_VERSION,
} from './candidate-authority-partial-semantics.ts';
import {
  CANDIDATE_AUTHORITY_READINESS_REPORT_VERSION,
  CANDIDATE_AUTHORITY_REPLAY_ALGORITHM_VERSION,
  withCanonicalReportDigest,
  type CandidateAuthorityRealizedReadinessReportV1,
  type CandidateAuthorityReplayBundle,
} from './candidate-authority-replay-contracts.ts';
import { ingestionError } from './errors.ts';
import type { PublicCatalog } from './types.ts';

const CELL_ORIGINS: readonly CandidateAuthorityCellOrigin[] = [
  'deterministic-known',
  'deterministic-not-applicable',
  'deterministic-partial-direct-evidence',
  'human-reviewed-structured',
  'model-derived',
  'unknown',
  'conflict',
];

export function classifyCandidateAuthorityCell(input: {
  readonly profileState: 'conflict' | 'known' | 'not-applicable' | 'unknown';
  readonly generationOrigin:
    'deterministic' | 'human-reviewed' | 'model-derived';
  readonly validatedPartialDirectEvidence: boolean;
}): CandidateAuthorityCellOrigin {
  if (input.profileState === 'conflict') return 'conflict';
  if (input.profileState === 'known') {
    if (input.generationOrigin === 'human-reviewed')
      return 'human-reviewed-structured';
    if (input.generationOrigin === 'model-derived') return 'model-derived';
    return 'deterministic-known';
  }
  if (
    input.profileState === 'not-applicable' &&
    input.generationOrigin === 'deterministic'
  )
    return 'deterministic-not-applicable';
  if (
    input.profileState === 'unknown' &&
    input.validatedPartialDirectEvidence &&
    input.generationOrigin === 'deterministic'
  )
    return 'deterministic-partial-direct-evidence';
  return 'unknown';
}

export function measureCandidateAuthorityReadiness(input: {
  readonly catalog: PublicCatalog;
  readonly taxonomyVersion: string;
  readonly taxonomyDigest: string;
  readonly sourceAuthority: CandidateAuthoritySourceAuthorityV1;
  readonly fieldPlan: CandidateAuthorityFieldPlanV4;
  readonly replay: CandidateAuthorityReplayBundle;
}): {
  readonly report: CandidateAuthorityRealizedReadinessReportV1;
  readonly root: CandidateAuthorityRootV4;
} {
  const { sourceAuthority, replay } = input;
  if (
    input.catalog.candidates.length !== 150 ||
    replay.profiles.orderedCandidateIds.length !== 150 ||
    replay.partial.orderedCandidateIds.length !== 150 ||
    replay.evidence.candidates.length !== 150 ||
    replay.dossiers.dossiers.length !== 150 ||
    replay.dossierProjection.projections.length !== 150
  )
    invalid();
  const partialById = new Map(
    replay.partial.records.map((record) => [record.partialEvidenceId, record]),
  );
  const evidenceByCandidate = new Map(
    replay.evidence.candidates.map((candidate) => [
      candidate.candidateId,
      candidate,
    ]),
  );
  const profiles = replay.profiles.profileAuthority.profiles;
  const realizations: CandidateAuthorityFieldRealization[] =
    RANKING_DECISION_FIELD_IDS.map((fieldId) => {
      const origins = emptyOriginCounts();
      let validatedPartialEvidenceCellCount = 0;
      for (const profile of profiles) {
        const evidence = evidenceByCandidate.get(profile.candidateId);
        if (evidence === undefined) invalid();
        const field = (
          profile.fields as unknown as readonly DeterministicProfileFieldRecord[]
        ).find((candidate) => candidate.fieldId === fieldId);
        if (field === undefined) invalid();
        const matchingPartial = evidence.partialFieldEvidenceBindings.filter(
          (binding) => {
            const partial = partialById.get(binding.partialEvidenceId);
            return (
              binding.fieldId === fieldId &&
              partial?.candidateId === profile.candidateId &&
              partial.fieldId === fieldId &&
              partial.canonicalDigest.length === 64 &&
              evidence.observations.some(
                (observation) => observation.evidenceId === binding.evidenceId,
              )
            );
          },
        );
        const origin = classifyCandidateAuthorityCell({
          profileState: field.state,
          generationOrigin: 'deterministic',
          validatedPartialDirectEvidence: matchingPartial.length > 0,
        });
        origins[origin] += 1;
        if (origin === 'deterministic-partial-direct-evidence')
          validatedPartialEvidenceCellCount += 1;
      }
      return { fieldId, origins, validatedPartialEvidenceCellCount };
    });
  const result = evaluateCandidateAuthorityRealizedReadiness({
    candidateCount: 150,
    fieldPlan: input.fieldPlan,
    fields: realizations,
  });
  const realized = new Set(result.realizedDeterministicReadyFields);
  const fullClosure = new Set(result.deterministicFullClosureFields);
  const fields = realizations.map((field) => ({
    fieldId: field.fieldId,
    plannedCapable:
      input.fieldPlan.fields.find((plan) => plan.fieldId === field.fieldId)
        ?.plannedExtractionCapable === true,
    realizedReady: realized.has(field.fieldId),
    deterministicFullClosure: fullClosure.has(field.fieldId),
    origins: field.origins,
    validatedPartialDirectEvidenceCells:
      field.validatedPartialEvidenceCellCount,
  }));
  const cellOriginCounts = fields.reduce((totals, field) => {
    for (const origin of CELL_ORIGINS) totals[origin] += field.origins[origin];
    return totals;
  }, emptyOriginCounts());
  const report = withCanonicalReportDigest({
    reportVersion: CANDIDATE_AUTHORITY_READINESS_REPORT_VERSION,
    replayAlgorithmVersion: CANDIDATE_AUTHORITY_REPLAY_ALGORITHM_VERSION,
    bindings: {
      sourceAuthorityVersion: sourceAuthority.authorityVersion,
      sourceAuthorityDigest: sourceAuthority.canonicalAuthorityDigest,
      deterministicProfileAuthorityVersion: replay.profiles.authorityVersion,
      deterministicProfileAuthorityDigest:
        replay.profiles.canonicalAuthorityDigest,
      partialFieldEvidenceAuthorityVersion: replay.partial.authorityVersion,
      partialFieldEvidenceAuthorityDigest:
        replay.partial.canonicalAuthorityDigest,
      fitEvidenceAuthorityVersion: replay.evidence.authorityVersion,
      fitEvidenceAuthorityDigest: replay.evidence.canonicalAuthorityDigest,
      dossierAuthorityVersion: replay.dossiers.authorityVersion,
      dossierAuthorityDigest: replay.dossiers.canonicalAuthorityDigest,
      dossierProjectionVersion: replay.dossierProjection.authorityVersion,
      dossierProjectionDigest:
        replay.dossierProjection.canonicalAuthorityDigest,
      readinessPolicyVersion: CANDIDATE_AUTHORITY_READINESS_POLICY_V3_VERSION,
      readinessPolicyDigest: CANDIDATE_AUTHORITY_READINESS_POLICY_V3_DIGEST,
      fieldPlanVersion: CANDIDATE_AUTHORITY_FIELD_PLAN_V4_VERSION,
      fieldPlanDigest: CANDIDATE_AUTHORITY_FIELD_PLAN_V4_DIGEST,
    },
    candidateCount: 150 as const,
    fields,
    plannedDeterministicExtractionCapableFieldCount:
      result.plannedDeterministicExtractionCapableFieldCount,
    realizedDeterministicReadyFieldCount:
      result.realizedDeterministicReadyFieldCount,
    deterministicFullClosureFieldCount:
      result.deterministicFullClosureFieldCount,
    plannedBreadthGroups: result.plannedBreadthGroups,
    realizedBreadthGroups: result.realizedBreadthGroups,
    cellOriginCounts,
    readinessDecision: result.decision,
  }) as CandidateAuthorityRealizedReadinessReportV1;
  const orderedCandidateIdentitiesDigest = canonicalizeJson(
    input.catalog.candidates.map((candidate) => ({
      candidateId: candidate.candidateId,
      github: candidate.github,
      npmPackage: candidate.npmPackage,
    })),
  ).digest;
  const rootWithoutDigest: Omit<
    CandidateAuthorityRootV4,
    'canonicalAuthorityDigest'
  > = {
    authorityVersion: CANDIDATE_AUTHORITY_ROOT_V4_VERSION,
    architectureDecisionBinding: {
      adr: 'ADR-0012',
      status: 'accepted-pre-live-architecture-authority',
      acceptedPreLiveHead:
        sourceAuthority.bindings['acceptedPreLiveHead'] ?? invalid(),
    },
    liveAuthorizationBinding: {
      version: CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_VERSION,
      digest: CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_DIGEST,
      collectionExecutionHead:
        sourceAuthority.bindings['collectionExecutionHead'] ?? invalid(),
    },
    catalogBinding: {
      version: input.catalog.catalogVersion,
      digest: input.catalog.manifestDigest,
    },
    taxonomyBinding: {
      version: input.taxonomyVersion,
      digest: input.taxonomyDigest,
    },
    deterministicProfileBinding: {
      version: replay.profiles.authorityVersion,
      digest: replay.profiles.canonicalAuthorityDigest,
      productProfileAuthorityDigest:
        replay.profiles.profileAuthority.semanticAuthorityDigest,
    },
    rankingDecisionBinding: {
      denominatorVersion: 'ranking-decision-denominator/1.0.0',
      denominatorSize: '18',
    },
    readinessPolicyBinding: {
      version: CANDIDATE_AUTHORITY_READINESS_POLICY_V3_VERSION,
      digest: CANDIDATE_AUTHORITY_READINESS_POLICY_V3_DIGEST,
    },
    fieldPlanBinding: {
      version: CANDIDATE_AUTHORITY_FIELD_PLAN_V4_VERSION,
      digest: CANDIDATE_AUTHORITY_FIELD_PLAN_V4_DIGEST,
    },
    sourcePolicyBinding: {
      version: CANDIDATE_AUTHORITY_SOURCE_POLICY_V4_VERSION,
      digest: CANDIDATE_AUTHORITY_SOURCE_POLICY_V4_DIGEST,
    },
    partialSemanticRegistryBinding: {
      version: CANDIDATE_AUTHORITY_PARTIAL_SEMANTIC_REGISTRY_VERSION,
      digest: CANDIDATE_AUTHORITY_PARTIAL_SEMANTIC_REGISTRY_DIGEST,
    },
    partialEvidenceContractBinding: {
      version: CANDIDATE_AUTHORITY_PARTIAL_EVIDENCE_VERSION,
      digest: CANDIDATE_AUTHORITY_PARTIAL_EVIDENCE_CONTRACT_DIGEST,
    },
    collection: {
      cutoff: sourceAuthority.collectionCutoff,
      candidateCount: 150,
      orderedCandidateIds: sourceAuthority.orderedCandidateIds,
      orderedCandidateIdentitiesDigest,
    },
    authorityDigests: {
      source: sourceAuthority.canonicalAuthorityDigest,
      deterministicProfiles: replay.profiles.canonicalAuthorityDigest,
      partialFieldEvidence: replay.partial.canonicalAuthorityDigest,
      evidence: replay.evidence.canonicalAuthorityDigest,
      dossiers: replay.dossiers.canonicalAuthorityDigest,
      dossierProjection: replay.dossierProjection.canonicalAuthorityDigest,
      coverageReadinessReport: report.canonicalReportDigest,
    },
    fieldReadinessCounts: {
      plannedDeterministicExtractionCapable:
        result.plannedDeterministicExtractionCapableFieldCount,
      realizedDeterministicReady: result.realizedDeterministicReadyFieldCount,
      deterministicFullClosure: result.deterministicFullClosureFieldCount,
    },
    plannedBreadthGroups: result.plannedBreadthGroups,
    realizedBreadthGroups: result.realizedBreadthGroups,
    cellOriginCounts,
    readinessDecision: result.decision,
  };
  const root: CandidateAuthorityRootV4 = Object.freeze({
    ...rootWithoutDigest,
    canonicalAuthorityDigest:
      candidateAuthorityRootV4SemanticDigest(rootWithoutDigest),
  });
  return Object.freeze({ report, root });
}

function emptyOriginCounts(): Record<CandidateAuthorityCellOrigin, number> {
  return {
    'deterministic-known': 0,
    'deterministic-not-applicable': 0,
    'deterministic-partial-direct-evidence': 0,
    'human-reviewed-structured': 0,
    'model-derived': 0,
    unknown: 0,
    conflict: 0,
  };
}

function invalid(): never {
  throw ingestionError('ingestion.invalid-input');
}
