import type { DeterministicProfileFieldRecord } from '@gitblocks/contracts';

import { canonicalizeJson } from './canonical-json.ts';
import {
  CANDIDATE_AUTHORITY_FAILURE_RECORD_V3_DIGEST,
  CANDIDATE_AUTHORITY_FAILURE_RECORD_V3_VERSION,
  CANDIDATE_AUTHORITY_FIELD_PLAN_V7_DIGEST,
  CANDIDATE_AUTHORITY_FIELD_PLAN_V7_VERSION,
  CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V7_DIGEST,
  CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V7_VERSION,
  CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V4_DIGEST,
  CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V4_VERSION,
  CANDIDATE_AUTHORITY_REPLAY_V6_DIGEST,
  CANDIDATE_AUTHORITY_REPLAY_V6_VERSION,
  CANDIDATE_AUTHORITY_ROUTING_DIGEST,
  CANDIDATE_AUTHORITY_ROUTING_SNAPSHOT_ID,
  CANDIDATE_AUTHORITY_ROUTING_VERSION,
  CANDIDATE_AUTHORITY_SOURCE_POLICY_V9_DIGEST,
  CANDIDATE_AUTHORITY_SOURCE_POLICY_V9_VERSION,
  CANDIDATE_AUTHORITY_V6_EXECUTION_HEAD,
  type CandidateAuthorityFieldPlanV7Runtime,
} from './candidate-authority-canonical-routing-correction.ts';
import {
  RANKING_DECISION_FIELD_IDS,
  type CandidateAuthorityDecisionFieldId,
} from './candidate-authority-contracts.ts';
import { classifyCandidateAuthorityCell } from './candidate-authority-measurement.ts';
import {
  CANDIDATE_AUTHORITY_PARTIAL_EVIDENCE_CONTRACT_DIGEST,
  CANDIDATE_AUTHORITY_PARTIAL_EVIDENCE_VERSION,
} from './candidate-authority-partial-evidence.ts';
import {
  CANDIDATE_AUTHORITY_PARTIAL_SEMANTIC_REGISTRY_V3_DIGEST,
  CANDIDATE_AUTHORITY_PARTIAL_SEMANTIC_REGISTRY_V3_VERSION,
} from './candidate-authority-partial-semantics.ts';
import type { CandidateAuthoritySuccessorSourceAuthority } from './candidate-authority-provider-contract.ts';
import {
  CANDIDATE_AUTHORITY_READINESS_POLICY_V3_DIGEST,
  CANDIDATE_AUTHORITY_READINESS_POLICY_V3_VERSION,
  evaluateCandidateAuthorityRealizedReadiness,
  type CandidateAuthorityCellOrigin,
  type CandidateAuthorityCellOriginCounts,
  type CandidateAuthorityFieldRealization,
  type CandidateAuthorityRealizedReadinessResult,
} from './candidate-authority-readiness.ts';
import type { CandidateAuthoritySuccessorReplayBundle } from './candidate-authority-successor-replay.ts';
import {
  CANDIDATE_AUTHORITY_SUCCESSOR_READINESS_VERSION,
  CANDIDATE_AUTHORITY_SUCCESSOR_ROOT_VERSION,
} from './candidate-authority-successor-contracts.ts';
import { ingestionError } from './errors.ts';
import type { PublicCatalog } from './types.ts';

const ORIGINS: readonly CandidateAuthorityCellOrigin[] = [
  'deterministic-known',
  'deterministic-not-applicable',
  'deterministic-partial-direct-evidence',
  'human-reviewed-structured',
  'model-derived',
  'unknown',
  'conflict',
];

export interface CandidateAuthoritySuccessorReadinessReport {
  readonly reportVersion: typeof CANDIDATE_AUTHORITY_SUCCESSOR_READINESS_VERSION;
  readonly replayAlgorithmVersion: typeof CANDIDATE_AUTHORITY_REPLAY_V6_VERSION;
  readonly bindings: Readonly<Record<string, string>>;
  readonly candidateCount: 150;
  readonly fields: readonly {
    readonly fieldId: CandidateAuthorityDecisionFieldId;
    readonly plannedCapable: boolean;
    readonly realizedReady: boolean;
    readonly deterministicFullClosure: boolean;
    readonly origins: CandidateAuthorityCellOriginCounts;
    readonly validatedPartialDirectEvidenceCells: number;
  }[];
  readonly plannedDeterministicExtractionCapableFieldCount: number;
  readonly realizedDeterministicReadyFieldCount: number;
  readonly deterministicFullClosureFieldCount: number;
  readonly plannedBreadthGroups: CandidateAuthorityRealizedReadinessResult['plannedBreadthGroups'];
  readonly realizedBreadthGroups: CandidateAuthorityRealizedReadinessResult['realizedBreadthGroups'];
  readonly cellOriginCounts: CandidateAuthorityCellOriginCounts;
  readonly readinessDecision: 'go' | 'no-go';
  readonly canonicalReportDigest: string;
}

export interface CandidateAuthorityRootV7 {
  readonly authorityVersion: typeof CANDIDATE_AUTHORITY_SUCCESSOR_ROOT_VERSION;
  readonly architectureDecisionBinding: Readonly<Record<string, string>>;
  readonly failedExperimentBinding: Readonly<Record<string, string>>;
  readonly liveAuthorizationBinding: Readonly<Record<string, string>>;
  readonly authorityBindings: Readonly<Record<string, string>>;
  readonly collection: {
    readonly cutoff: string;
    readonly candidateCount: 150;
    readonly orderedCandidateIds: readonly string[];
    readonly orderedCandidateIdentitiesDigest: string;
  };
  readonly outputDigests: Readonly<Record<string, string>>;
  readonly fieldReadinessCounts: Readonly<Record<string, number>>;
  readonly plannedBreadthGroups: CandidateAuthorityRealizedReadinessResult['plannedBreadthGroups'];
  readonly realizedBreadthGroups: CandidateAuthorityRealizedReadinessResult['realizedBreadthGroups'];
  readonly cellOriginCounts: CandidateAuthorityCellOriginCounts;
  readonly readinessDecision: 'go' | 'no-go';
  readonly canonicalAuthorityDigest: string;
}

export function measureCandidateAuthoritySuccessorReadiness(input: {
  readonly catalog: PublicCatalog;
  readonly sourceAuthority: CandidateAuthoritySuccessorSourceAuthority;
  readonly fieldPlan: CandidateAuthorityFieldPlanV7Runtime;
  readonly replay: CandidateAuthoritySuccessorReplayBundle;
}): {
  readonly report: CandidateAuthoritySuccessorReadinessReport;
  readonly root: CandidateAuthorityRootV7;
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
  const realizations: CandidateAuthorityFieldRealization[] =
    RANKING_DECISION_FIELD_IDS.map((fieldId) => {
      const origins = emptyOrigins();
      let partialCount = 0;
      for (const profile of replay.profiles.profileAuthority.profiles) {
        const evidence = evidenceByCandidate.get(profile.candidateId);
        const field = (
          profile.fields as unknown as readonly DeterministicProfileFieldRecord[]
        ).find((candidate) => candidate.fieldId === fieldId);
        if (evidence === undefined || field === undefined) invalid();
        const validPartial = evidence.partialFieldEvidenceBindings.some(
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
          validatedPartialDirectEvidence: validPartial,
        });
        origins[origin] += 1;
        if (origin === 'deterministic-partial-direct-evidence')
          partialCount += 1;
      }
      return {
        fieldId,
        origins,
        validatedPartialEvidenceCellCount: partialCount,
      };
    });
  const result = evaluateCandidateAuthorityRealizedReadiness({
    candidateCount: 150,
    fieldPlan: input.fieldPlan as unknown as Parameters<
      typeof evaluateCandidateAuthorityRealizedReadiness
    >[0]['fieldPlan'],
    fields: realizations,
  });
  const realized = new Set(result.realizedDeterministicReadyFields);
  const closure = new Set(result.deterministicFullClosureFields);
  const fields = realizations.map((field) => ({
    fieldId: field.fieldId,
    plannedCapable:
      input.fieldPlan.fields.find((plan) => plan.fieldId === field.fieldId)
        ?.plannedExtractionCapable === true,
    realizedReady: realized.has(field.fieldId),
    deterministicFullClosure: closure.has(field.fieldId),
    origins: field.origins,
    validatedPartialDirectEvidenceCells:
      field.validatedPartialEvidenceCellCount,
  }));
  const totals = fields.reduce((sum, field) => {
    for (const origin of ORIGINS) sum[origin] += field.origins[origin];
    return sum;
  }, emptyOrigins());
  const reportWithoutDigest = {
    reportVersion: CANDIDATE_AUTHORITY_SUCCESSOR_READINESS_VERSION,
    replayAlgorithmVersion: CANDIDATE_AUTHORITY_REPLAY_V6_VERSION,
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
      fieldPlanVersion: CANDIDATE_AUTHORITY_FIELD_PLAN_V7_VERSION,
      fieldPlanDigest: CANDIDATE_AUTHORITY_FIELD_PLAN_V7_DIGEST,
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
    cellOriginCounts: totals,
    readinessDecision: result.decision,
  };
  const report: CandidateAuthoritySuccessorReadinessReport = Object.freeze({
    ...reportWithoutDigest,
    canonicalReportDigest: canonicalizeJson(reportWithoutDigest).digest,
  });
  const rootWithoutDigest = {
    authorityVersion: CANDIDATE_AUTHORITY_SUCCESSOR_ROOT_VERSION,
    architectureDecisionBinding: {
      adr: 'ADR-0014',
      status: 'accepted-npm-source-and-proposed-canonical-routing',
      canonicalRoutingAdr: 'ADR-0015',
      consumedV6ExecutionHead: CANDIDATE_AUTHORITY_V6_EXECUTION_HEAD,
    },
    failedExperimentBinding: {
      version: CANDIDATE_AUTHORITY_FAILURE_RECORD_V3_VERSION,
      digest: CANDIDATE_AUTHORITY_FAILURE_RECORD_V3_DIGEST,
      disposition: 'consumed-inconclusive-no-source-authority',
    },
    liveAuthorizationBinding: {
      version: CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V7_VERSION,
      digest: CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V7_DIGEST,
      collectionExecutionHead:
        sourceAuthority.bindings['collectionExecutionHead'] ?? invalid(),
    },
    authorityBindings: {
      providerContractVersion: CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V4_VERSION,
      providerContractDigest: CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V4_DIGEST,
      fieldPlanVersion: CANDIDATE_AUTHORITY_FIELD_PLAN_V7_VERSION,
      fieldPlanDigest: CANDIDATE_AUTHORITY_FIELD_PLAN_V7_DIGEST,
      sourcePolicyVersion: CANDIDATE_AUTHORITY_SOURCE_POLICY_V9_VERSION,
      sourcePolicyDigest: CANDIDATE_AUTHORITY_SOURCE_POLICY_V9_DIGEST,
      replayAlgorithmVersion: CANDIDATE_AUTHORITY_REPLAY_V6_VERSION,
      replayAlgorithmDigest: CANDIDATE_AUTHORITY_REPLAY_V6_DIGEST,
      routingAuthorityVersion: CANDIDATE_AUTHORITY_ROUTING_VERSION,
      routingAuthoritySnapshotId: CANDIDATE_AUTHORITY_ROUTING_SNAPSHOT_ID,
      routingAuthorityDigest: CANDIDATE_AUTHORITY_ROUTING_DIGEST,
      readinessPolicyVersion: CANDIDATE_AUTHORITY_READINESS_POLICY_V3_VERSION,
      readinessPolicyDigest: CANDIDATE_AUTHORITY_READINESS_POLICY_V3_DIGEST,
      partialSemanticRegistryVersion:
        CANDIDATE_AUTHORITY_PARTIAL_SEMANTIC_REGISTRY_V3_VERSION,
      partialSemanticRegistryDigest:
        CANDIDATE_AUTHORITY_PARTIAL_SEMANTIC_REGISTRY_V3_DIGEST,
      partialEvidenceContractVersion:
        CANDIDATE_AUTHORITY_PARTIAL_EVIDENCE_VERSION,
      partialEvidenceContractDigest:
        CANDIDATE_AUTHORITY_PARTIAL_EVIDENCE_CONTRACT_DIGEST,
    },
    collection: {
      cutoff: sourceAuthority.collectionCutoff,
      candidateCount: 150 as const,
      orderedCandidateIds: sourceAuthority.orderedCandidateIds,
      orderedCandidateIdentitiesDigest: canonicalizeJson(
        input.catalog.candidates.map((candidate) => ({
          candidateId: candidate.candidateId,
          github: candidate.github,
          npmPackage: candidate.npmPackage,
        })),
      ).digest,
    },
    outputDigests: {
      source: sourceAuthority.canonicalAuthorityDigest,
      deterministicProfiles: replay.profiles.canonicalAuthorityDigest,
      partialFieldEvidence: replay.partial.canonicalAuthorityDigest,
      evidence: replay.evidence.canonicalAuthorityDigest,
      dossiers: replay.dossiers.canonicalAuthorityDigest,
      dossierProjection: replay.dossierProjection.canonicalAuthorityDigest,
      readiness: report.canonicalReportDigest,
    },
    fieldReadinessCounts: {
      plannedDeterministicExtractionCapable:
        result.plannedDeterministicExtractionCapableFieldCount,
      realizedDeterministicReady: result.realizedDeterministicReadyFieldCount,
      deterministicFullClosure: result.deterministicFullClosureFieldCount,
    },
    plannedBreadthGroups: result.plannedBreadthGroups,
    realizedBreadthGroups: result.realizedBreadthGroups,
    cellOriginCounts: totals,
    readinessDecision: result.decision,
  };
  const root: CandidateAuthorityRootV7 = Object.freeze({
    ...rootWithoutDigest,
    canonicalAuthorityDigest: canonicalizeJson(rootWithoutDigest).digest,
  });
  return Object.freeze({ report, root });
}

function emptyOrigins(): Record<CandidateAuthorityCellOrigin, number> {
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
