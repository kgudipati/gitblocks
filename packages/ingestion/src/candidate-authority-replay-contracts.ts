import type {
  CandidateDossierV1,
  DeterministicCandidateProfileAuthorityV1,
} from '@gitblocks/contracts';

import { canonicalizeJson } from './canonical-json.ts';
import type { CandidateAuthorityDecisionFieldId } from './candidate-authority-contracts.ts';
import type { CandidateAuthorityPartialFieldEvidence } from './candidate-authority-partial-evidence.ts';
import type {
  CandidateAuthorityCellOriginCounts,
  CandidateAuthorityRootV4,
} from './candidate-authority-readiness.ts';
import { ingestionError } from './errors.ts';

export const CANDIDATE_AUTHORITY_REPLAY_ALGORITHM_VERSION =
  'candidate-authority-pure-replay/3.0.0' as const;
export const CANDIDATE_AUTHORITY_PROFILE_REPLAY_AUTHORITY_VERSION =
  'candidate-authority-deterministic-profile-authority/1.0.0' as const;
export const CANDIDATE_AUTHORITY_PARTIAL_REPLAY_AUTHORITY_VERSION =
  'candidate-authority-partial-field-evidence-authority/1.0.0' as const;
export const CANDIDATE_AUTHORITY_EVIDENCE_REPLAY_AUTHORITY_VERSION =
  'candidate-authority-fit-consumable-evidence-authority/1.0.0' as const;
export const CANDIDATE_AUTHORITY_DOSSIER_REPLAY_AUTHORITY_VERSION =
  'candidate-authority-dossier-authority/1.0.0' as const;
export const CANDIDATE_AUTHORITY_DOSSIER_PROJECTION_VERSION =
  'candidate-authority-dossier-projection/1.0.0' as const;
export const CANDIDATE_AUTHORITY_READINESS_REPORT_VERSION =
  'candidate-authority-realized-readiness-report/1.0.0' as const;

// Structural maxima are frozen before live values. Per candidate, the accepted
// sources can emit at most 200 advisories, 5 releases, 4 framework peers, 100
// Compose services, and one each for adoption, language, license, and Dockerfile.
export const CANDIDATE_AUTHORITY_MAXIMUM_PARTIAL_FACTS_PER_CANDIDATE =
  200 + 5 + 4 + 100 + 1 + 1 + 1 + 1;
export const CANDIDATE_AUTHORITY_MAXIMUM_PARTIAL_FACT_RECORDS =
  150 * CANDIDATE_AUTHORITY_MAXIMUM_PARTIAL_FACTS_PER_CANDIDATE;
export const CANDIDATE_AUTHORITY_PROFILE_MAXIMUM_SERIALIZED_BYTES =
  64 * 1_024 * 1_024;
export const CANDIDATE_AUTHORITY_PARTIAL_MAXIMUM_SERIALIZED_BYTES =
  384 * 1_024 * 1_024;
export const CANDIDATE_AUTHORITY_EVIDENCE_MAXIMUM_SERIALIZED_BYTES =
  512 * 1_024 * 1_024;
export const CANDIDATE_AUTHORITY_DOSSIER_MAXIMUM_SERIALIZED_BYTES =
  512 * 1_024 * 1_024;
export const CANDIDATE_AUTHORITY_DOSSIER_PROJECTION_MAXIMUM_SERIALIZED_BYTES =
  64 * 1_024 * 1_024;
export const CANDIDATE_AUTHORITY_READINESS_MAXIMUM_SERIALIZED_BYTES =
  4 * 1_024 * 1_024;
export const CANDIDATE_AUTHORITY_ROOT_MAXIMUM_SERIALIZED_BYTES =
  4 * 1_024 * 1_024;

export interface CandidateAuthorityDeterministicProfileAuthorityV1 {
  readonly authorityVersion: typeof CANDIDATE_AUTHORITY_PROFILE_REPLAY_AUTHORITY_VERSION;
  readonly replayAlgorithmVersion: typeof CANDIDATE_AUTHORITY_REPLAY_ALGORITHM_VERSION;
  readonly sourceAuthorityVersion: string;
  readonly sourceAuthorityDigest: string;
  readonly orderedCandidateIds: readonly string[];
  readonly profileAuthority: DeterministicCandidateProfileAuthorityV1;
  readonly canonicalAuthorityDigest: string;
}

export interface CandidateAuthorityPartialEvidenceAuthorityV1 {
  readonly authorityVersion: typeof CANDIDATE_AUTHORITY_PARTIAL_REPLAY_AUTHORITY_VERSION;
  readonly replayAlgorithmVersion: typeof CANDIDATE_AUTHORITY_REPLAY_ALGORITHM_VERSION;
  readonly sourceAuthorityVersion: string;
  readonly sourceAuthorityDigest: string;
  readonly semanticRegistryVersion: string;
  readonly semanticRegistryDigest: string;
  readonly orderedCandidateIds: readonly string[];
  readonly records: readonly CandidateAuthorityPartialFieldEvidence[];
  readonly canonicalAuthorityDigest: string;
}

export interface CandidateAuthorityFitEvidenceCandidateV1 {
  readonly candidateId: string;
  readonly observations: CandidateDossierV1['observations'];
  readonly limitations: CandidateDossierV1['limitations'];
  readonly unknowns: CandidateDossierV1['unknowns'];
  readonly completeFieldEvidenceBindings: readonly {
    readonly fieldId: CandidateAuthorityDecisionFieldId;
    readonly evidenceId: string;
    readonly evidenceDigest: string;
  }[];
  readonly partialFieldEvidenceBindings: readonly {
    readonly partialEvidenceId: string;
    readonly fieldId: CandidateAuthorityDecisionFieldId;
    readonly factDefinitionDigest: string;
    readonly evidenceId: string;
    readonly evidenceDigest: string;
  }[];
  readonly canonicalEvidenceDigest: string;
}

export interface CandidateAuthorityFitEvidenceAuthorityV1 {
  readonly authorityVersion: typeof CANDIDATE_AUTHORITY_EVIDENCE_REPLAY_AUTHORITY_VERSION;
  readonly replayAlgorithmVersion: typeof CANDIDATE_AUTHORITY_REPLAY_ALGORITHM_VERSION;
  readonly sourceAuthorityDigest: string;
  readonly deterministicProfileAuthorityDigest: string;
  readonly partialFieldEvidenceAuthorityDigest: string;
  readonly orderedCandidateIds: readonly string[];
  readonly candidates: readonly CandidateAuthorityFitEvidenceCandidateV1[];
  readonly canonicalAuthorityDigest: string;
}

export interface CandidateAuthorityDossierAuthorityV1 {
  readonly authorityVersion: typeof CANDIDATE_AUTHORITY_DOSSIER_REPLAY_AUTHORITY_VERSION;
  readonly replayAlgorithmVersion: typeof CANDIDATE_AUTHORITY_REPLAY_ALGORITHM_VERSION;
  readonly sourceAuthorityDigest: string;
  readonly deterministicProfileAuthorityDigest: string;
  readonly fitEvidenceAuthorityDigest: string;
  readonly orderedCandidateIds: readonly string[];
  readonly dossiers: readonly CandidateDossierV1[];
  readonly canonicalAuthorityDigest: string;
}

export interface CandidateAuthorityDossierProjectionAuthorityV1 {
  readonly authorityVersion: typeof CANDIDATE_AUTHORITY_DOSSIER_PROJECTION_VERSION;
  readonly replayAlgorithmVersion: typeof CANDIDATE_AUTHORITY_REPLAY_ALGORITHM_VERSION;
  readonly sourceAuthorityDigest: string;
  readonly deterministicProfileAuthorityDigest: string;
  readonly partialFieldEvidenceAuthorityDigest: string;
  readonly fitEvidenceAuthorityDigest: string;
  readonly dossierAuthorityDigest: string;
  readonly orderedCandidateIds: readonly string[];
  readonly projections: readonly {
    readonly candidateId: string;
    readonly deterministicProfileDigest: string;
    readonly fitEvidenceDigest: string;
    readonly dossierDigest: string;
    readonly completeEvidenceIds: readonly string[];
    readonly partialEvidenceIds: readonly string[];
    readonly canonicalProjectionDigest: string;
  }[];
  readonly canonicalAuthorityDigest: string;
}

export interface CandidateAuthorityRealizedReadinessReportV1 {
  readonly reportVersion: typeof CANDIDATE_AUTHORITY_READINESS_REPORT_VERSION;
  readonly replayAlgorithmVersion: typeof CANDIDATE_AUTHORITY_REPLAY_ALGORITHM_VERSION;
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
  readonly plannedBreadthGroups: CandidateAuthorityRootV4['plannedBreadthGroups'];
  readonly realizedBreadthGroups: CandidateAuthorityRootV4['realizedBreadthGroups'];
  readonly cellOriginCounts: CandidateAuthorityCellOriginCounts;
  readonly readinessDecision: 'go' | 'no-go';
  readonly canonicalReportDigest: string;
}

export interface CandidateAuthorityReplayBundle {
  readonly profiles: CandidateAuthorityDeterministicProfileAuthorityV1;
  readonly partial: CandidateAuthorityPartialEvidenceAuthorityV1;
  readonly evidence: CandidateAuthorityFitEvidenceAuthorityV1;
  readonly dossiers: CandidateAuthorityDossierAuthorityV1;
  readonly dossierProjection: CandidateAuthorityDossierProjectionAuthorityV1;
}

export function withCanonicalAuthorityDigest<
  Value extends Readonly<Record<string, unknown>>,
>(value: Value): Value & { readonly canonicalAuthorityDigest: string } {
  return Object.freeze({
    ...value,
    canonicalAuthorityDigest: canonicalizeJson(value).digest,
  });
}

export function withCanonicalReportDigest<
  Value extends Readonly<Record<string, unknown>>,
>(value: Value): Value & { readonly canonicalReportDigest: string } {
  return Object.freeze({
    ...value,
    canonicalReportDigest: canonicalizeJson(value).digest,
  });
}

export function canonicalReplayAuthorityText(
  value: unknown,
  maximumBytes: number,
): string {
  const text = `${canonicalizeJson(value).text}\n`;
  if (Buffer.byteLength(text, 'utf8') > maximumBytes) invalid();
  return text;
}

export function validateCanonicalAuthorityDigest(
  value: Readonly<Record<string, unknown>>,
  digestKey: 'canonicalAuthorityDigest' | 'canonicalReportDigest',
): void {
  const supplied = value[digestKey];
  const withoutDigest = Object.fromEntries(
    Object.entries(value).filter(([key]) => key !== digestKey),
  );
  if (
    typeof supplied !== 'string' ||
    supplied !== canonicalizeJson(withoutDigest).digest
  )
    invalid();
}

function invalid(): never {
  throw ingestionError('ingestion.invalid-input');
}
