import {
  CONTRACT_VERSION,
  DETERMINISTIC_CANDIDATE_PROFILE_AUTHORITY_VERSION,
  DETERMINISTIC_PROFILE_DENOMINATOR_VERSION,
  DETERMINISTIC_PROFILE_RULES_VERSION,
  createDeterministicCandidateProfileAuthorityV1,
  type CapabilityTaxonomyV1,
} from '@gitblocks/contracts';

import { canonicalizeJson } from './canonical-json.ts';
import type { CandidateAuthoritySourceCandidateV1 } from './candidate-authority-live-contracts.ts';
import type { CandidateAuthorityPartialFieldEvidence } from './candidate-authority-partial-evidence.ts';
import type { CandidateAuthorityPartialSemanticRegistry } from './candidate-authority-partial-semantics.ts';
import type { CandidateAuthoritySuccessorSourceAuthority } from './candidate-authority-provider-contract.ts';
import type { CandidateAuthorityFieldPlanV5Runtime } from './candidate-authority-postmortem.ts';
import {
  withCanonicalAuthorityDigest,
  type CandidateAuthorityDeterministicProfileAuthorityV1,
  type CandidateAuthorityDossierAuthorityV1,
  type CandidateAuthorityDossierProjectionAuthorityV1,
  type CandidateAuthorityFitEvidenceAuthorityV1,
  type CandidateAuthorityPartialEvidenceAuthorityV1,
} from './candidate-authority-replay-contracts.ts';
import { projectCandidateAuthorityReplayCandidate } from './candidate-authority-replay.ts';
import {
  CANDIDATE_AUTHORITY_REPLAY_V4_VERSION,
  CANDIDATE_AUTHORITY_SUCCESSOR_DOSSIER_VERSION,
  CANDIDATE_AUTHORITY_SUCCESSOR_EVIDENCE_VERSION,
  CANDIDATE_AUTHORITY_SUCCESSOR_PARTIAL_VERSION,
  CANDIDATE_AUTHORITY_SUCCESSOR_PROFILE_VERSION,
  CANDIDATE_AUTHORITY_SUCCESSOR_PROJECTION_VERSION,
  CANDIDATE_AUTHORITY_SUCCESSOR_SOURCE_VERSION,
} from './candidate-authority-successor-contracts.ts';
import { ingestionError } from './errors.ts';
import type { PublicCatalog } from './types.ts';

type SuccessorProfiles = Omit<
  CandidateAuthorityDeterministicProfileAuthorityV1,
  'authorityVersion' | 'replayAlgorithmVersion' | 'sourceAuthorityVersion'
> & {
  readonly authorityVersion: typeof CANDIDATE_AUTHORITY_SUCCESSOR_PROFILE_VERSION;
  readonly replayAlgorithmVersion: typeof CANDIDATE_AUTHORITY_REPLAY_V4_VERSION;
  readonly sourceAuthorityVersion: typeof CANDIDATE_AUTHORITY_SUCCESSOR_SOURCE_VERSION;
};
type SuccessorPartial = Omit<
  CandidateAuthorityPartialEvidenceAuthorityV1,
  'authorityVersion' | 'replayAlgorithmVersion' | 'sourceAuthorityVersion'
> & {
  readonly authorityVersion: typeof CANDIDATE_AUTHORITY_SUCCESSOR_PARTIAL_VERSION;
  readonly replayAlgorithmVersion: typeof CANDIDATE_AUTHORITY_REPLAY_V4_VERSION;
  readonly sourceAuthorityVersion: typeof CANDIDATE_AUTHORITY_SUCCESSOR_SOURCE_VERSION;
};
type SuccessorEvidence = Omit<
  CandidateAuthorityFitEvidenceAuthorityV1,
  'authorityVersion' | 'replayAlgorithmVersion'
> & {
  readonly authorityVersion: typeof CANDIDATE_AUTHORITY_SUCCESSOR_EVIDENCE_VERSION;
  readonly replayAlgorithmVersion: typeof CANDIDATE_AUTHORITY_REPLAY_V4_VERSION;
};
type SuccessorDossiers = Omit<
  CandidateAuthorityDossierAuthorityV1,
  'authorityVersion' | 'replayAlgorithmVersion'
> & {
  readonly authorityVersion: typeof CANDIDATE_AUTHORITY_SUCCESSOR_DOSSIER_VERSION;
  readonly replayAlgorithmVersion: typeof CANDIDATE_AUTHORITY_REPLAY_V4_VERSION;
};
type SuccessorProjection = Omit<
  CandidateAuthorityDossierProjectionAuthorityV1,
  'authorityVersion' | 'replayAlgorithmVersion'
> & {
  readonly authorityVersion: typeof CANDIDATE_AUTHORITY_SUCCESSOR_PROJECTION_VERSION;
  readonly replayAlgorithmVersion: typeof CANDIDATE_AUTHORITY_REPLAY_V4_VERSION;
};

export interface CandidateAuthoritySuccessorReplayBundle {
  readonly profiles: SuccessorProfiles;
  readonly partial: SuccessorPartial;
  readonly evidence: SuccessorEvidence;
  readonly dossiers: SuccessorDossiers;
  readonly dossierProjection: SuccessorProjection;
}

export function generateCandidateAuthoritySuccessorReplay(input: {
  readonly catalog: PublicCatalog;
  readonly taxonomy: CapabilityTaxonomyV1;
  readonly sourceAuthority: CandidateAuthoritySuccessorSourceAuthority;
  readonly fieldPlan: CandidateAuthorityFieldPlanV5Runtime;
  readonly partialSemanticRegistry: CandidateAuthorityPartialSemanticRegistry;
}): CandidateAuthoritySuccessorReplayBundle {
  const source = input.sourceAuthority;
  if (
    input.catalog.candidates.length !== source.candidateCount ||
    source.bindings['catalogDigest'] !== input.catalog.manifestDigest ||
    source.bindings['taxonomyDigest'] !== input.taxonomy.semanticDigest
  )
    invalid();
  const catalogById = new Map(
    input.catalog.candidates.map((candidate) => [
      candidate.candidateId,
      candidate,
    ]),
  );
  const sourceById = new Map(
    source.candidates.map((candidate) => [candidate.candidateId, candidate]),
  );
  if (sourceById.size !== 150) invalid();
  const projections = source.orderedCandidateIds.map((candidateId) => {
    const candidate = catalogById.get(candidateId);
    const sourceCandidate = sourceById.get(candidateId);
    if (candidate === undefined || sourceCandidate === undefined) invalid();
    // Source-v2 preserves the complete datum shape used by the projector; only
    // the bounded operation-id union evolved. The source-v2 parser has already
    // proved every successor identifier and digest, making this adapter lossless.
    return projectCandidateAuthorityReplayCandidate({
      candidate,
      catalog: input.catalog,
      taxonomy: input.taxonomy,
      sourceCandidate:
        sourceCandidate as unknown as CandidateAuthoritySourceCandidateV1,
      sourceAuthorityDigest: source.canonicalAuthorityDigest,
      sourceAuthorityVersion: CANDIDATE_AUTHORITY_SUCCESSOR_SOURCE_VERSION,
      collectionCutoff: source.collectionCutoff,
      fieldPlan: input.fieldPlan as unknown as Parameters<
        typeof projectCandidateAuthorityReplayCandidate
      >[0]['fieldPlan'],
      partialSemanticRegistry: input.partialSemanticRegistry,
    });
  });
  const productProfiles = createDeterministicCandidateProfileAuthorityV1({
    contractVersion: CONTRACT_VERSION,
    authorityVersion: DETERMINISTIC_CANDIDATE_PROFILE_AUTHORITY_VERSION,
    denominatorVersion: DETERMINISTIC_PROFILE_DENOMINATOR_VERSION,
    catalogVersion: input.catalog.catalogVersion,
    catalogDigest: input.catalog.manifestDigest,
    taxonomyVersion: input.taxonomy.taxonomyVersion,
    taxonomySemanticDigest: input.taxonomy.semanticDigest,
    profileRulesVersion: DETERMINISTIC_PROFILE_RULES_VERSION,
    profiles: projections.map(({ profile }) => profile),
  });
  const profiles = withCanonicalAuthorityDigest({
    authorityVersion: CANDIDATE_AUTHORITY_SUCCESSOR_PROFILE_VERSION,
    replayAlgorithmVersion: CANDIDATE_AUTHORITY_REPLAY_V4_VERSION,
    sourceAuthorityVersion: CANDIDATE_AUTHORITY_SUCCESSOR_SOURCE_VERSION,
    sourceAuthorityDigest: source.canonicalAuthorityDigest,
    orderedCandidateIds: source.orderedCandidateIds,
    profileAuthority: productProfiles,
  }) as SuccessorProfiles;
  const partialRecords: CandidateAuthorityPartialFieldEvidence[] = projections
    .flatMap(({ partialEvidence }) => [...partialEvidence])
    .sort((left, right) =>
      left.partialEvidenceId.localeCompare(right.partialEvidenceId),
    );
  const partial = withCanonicalAuthorityDigest({
    authorityVersion: CANDIDATE_AUTHORITY_SUCCESSOR_PARTIAL_VERSION,
    replayAlgorithmVersion: CANDIDATE_AUTHORITY_REPLAY_V4_VERSION,
    sourceAuthorityVersion: CANDIDATE_AUTHORITY_SUCCESSOR_SOURCE_VERSION,
    sourceAuthorityDigest: source.canonicalAuthorityDigest,
    semanticRegistryVersion: input.partialSemanticRegistry.registryVersion,
    semanticRegistryDigest:
      input.partialSemanticRegistry.registrySemanticDigest,
    orderedCandidateIds: source.orderedCandidateIds,
    records: partialRecords,
  }) as SuccessorPartial;
  const evidenceCandidates = projections.map(({ evidence }) => evidence);
  const evidence = withCanonicalAuthorityDigest({
    authorityVersion: CANDIDATE_AUTHORITY_SUCCESSOR_EVIDENCE_VERSION,
    replayAlgorithmVersion: CANDIDATE_AUTHORITY_REPLAY_V4_VERSION,
    sourceAuthorityDigest: source.canonicalAuthorityDigest,
    deterministicProfileAuthorityDigest: profiles.canonicalAuthorityDigest,
    partialFieldEvidenceAuthorityDigest: partial.canonicalAuthorityDigest,
    orderedCandidateIds: source.orderedCandidateIds,
    candidates: evidenceCandidates,
  }) as SuccessorEvidence;
  const dossierValues = projections.map(({ dossier }) => dossier);
  const dossiers = withCanonicalAuthorityDigest({
    authorityVersion: CANDIDATE_AUTHORITY_SUCCESSOR_DOSSIER_VERSION,
    replayAlgorithmVersion: CANDIDATE_AUTHORITY_REPLAY_V4_VERSION,
    sourceAuthorityDigest: source.canonicalAuthorityDigest,
    deterministicProfileAuthorityDigest: profiles.canonicalAuthorityDigest,
    fitEvidenceAuthorityDigest: evidence.canonicalAuthorityDigest,
    orderedCandidateIds: source.orderedCandidateIds,
    dossiers: dossierValues,
  }) as SuccessorDossiers;
  const projectionRows = projections.map((projection) => {
    const row = {
      candidateId: projection.profile.candidateId,
      deterministicProfileDigest: projection.deterministicProfileDigest,
      fitEvidenceDigest: projection.evidence.canonicalEvidenceDigest,
      dossierDigest: projection.dossierDigest,
      completeEvidenceIds: projection.evidence.completeFieldEvidenceBindings
        .map(({ evidenceId }) => evidenceId)
        .sort(),
      partialEvidenceIds: projection.evidence.partialFieldEvidenceBindings
        .map(({ partialEvidenceId }) => partialEvidenceId)
        .sort(),
    };
    return { ...row, canonicalProjectionDigest: canonicalizeJson(row).digest };
  });
  const dossierProjection = withCanonicalAuthorityDigest({
    authorityVersion: CANDIDATE_AUTHORITY_SUCCESSOR_PROJECTION_VERSION,
    replayAlgorithmVersion: CANDIDATE_AUTHORITY_REPLAY_V4_VERSION,
    sourceAuthorityDigest: source.canonicalAuthorityDigest,
    deterministicProfileAuthorityDigest: profiles.canonicalAuthorityDigest,
    partialFieldEvidenceAuthorityDigest: partial.canonicalAuthorityDigest,
    fitEvidenceAuthorityDigest: evidence.canonicalAuthorityDigest,
    dossierAuthorityDigest: dossiers.canonicalAuthorityDigest,
    orderedCandidateIds: source.orderedCandidateIds,
    projections: projectionRows,
  }) as SuccessorProjection;
  return Object.freeze({
    profiles,
    partial,
    evidence,
    dossiers,
    dossierProjection,
  });
}

export function candidateAuthoritySuccessorReplaySemanticDigest(
  replay: CandidateAuthoritySuccessorReplayBundle,
): string {
  return canonicalizeJson({
    profiles: replay.profiles.canonicalAuthorityDigest,
    partial: replay.partial.canonicalAuthorityDigest,
    evidence: replay.evidence.canonicalAuthorityDigest,
    dossiers: replay.dossiers.canonicalAuthorityDigest,
    dossierProjection: replay.dossierProjection.canonicalAuthorityDigest,
  }).digest;
}

function invalid(): never {
  throw ingestionError('ingestion.invalid-input');
}
