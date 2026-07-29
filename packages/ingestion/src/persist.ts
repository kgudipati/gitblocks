import {
  PersistenceError,
  appendCandidateLimitation,
  appendCandidateUnknown,
  appendEvidenceObservation,
  createCandidateDossierSnapshot,
  loadCandidateDossierSnapshot,
  putCatalogCandidate,
  recordEvidenceInvalidation,
  recordEvidenceSupersession,
  selectActiveDossierMaterial,
  setCandidateCapabilityFamilies,
  type ActiveDossierMaterial,
  type PersistenceClient,
} from '@gitblocks/persistence';

import { canonicalizeJson } from './canonical-json.ts';
import { ingestionError } from './errors.ts';
import { planCandidateRefresh } from './refresh.ts';
import type { IngestionReceiptCandidate, ProfileResult } from './types.ts';

const EMPTY_ACTIVE: ActiveDossierMaterial = {
  observations: [],
  limitations: [],
  unknowns: [],
};

export async function loadPriorMaterial(
  client: PersistenceClient,
  candidateId: string,
  evidenceCutoff: string,
  signal?: AbortSignal,
): Promise<ActiveDossierMaterial> {
  try {
    return await selectActiveDossierMaterial(
      client,
      { candidateId, evidenceCutoff },
      signal === undefined ? undefined : { signal },
    );
  } catch (error) {
    if (
      error instanceof PersistenceError &&
      error.code === 'persistence.not-found'
    ) {
      return EMPTY_ACTIVE;
    }
    throw ingestionError('ingestion.persistence');
  }
}

export async function persistCandidateProfile(
  client: PersistenceClient,
  profile: ProfileResult,
  prior: ActiveDossierMaterial,
  introducedAt: string,
  signal?: AbortSignal,
): Promise<IngestionReceiptCandidate> {
  const control = signal === undefined ? undefined : { signal };
  const refresh = planCandidateRefresh(prior.observations, profile);
  let snapshotExisted = false;
  try {
    const existing = await loadCandidateDossierSnapshot(
      client,
      { snapshotId: profile.snapshotId },
      control,
    );
    snapshotExisted =
      canonicalizeJson(existing).digest ===
      canonicalizeJson(profile.dossier).digest;
    if (!snapshotExisted) {
      throw ingestionError('ingestion.persistence');
    }
  } catch (error) {
    if (!(
      error instanceof PersistenceError &&
      error.code === 'persistence.not-found'
    )) {
      throw error;
    }
  }

  try {
    await putCatalogCandidate(
      client,
      { identity: profile.identity, createdAt: introducedAt },
      control,
    );
    await setCandidateCapabilityFamilies(
      client,
      {
        candidateId: profile.identity.candidateId,
        capabilityFamilies: profile.capabilityFamilies,
      },
      control,
    );
    for (const observation of refresh.observationsToAppend) {
      await appendEvidenceObservation(
        client,
        { observation, createdAt: profile.evidenceCutoff },
        control,
      );
    }
    for (const supersession of refresh.supersessions) {
      await recordEvidenceSupersession(
        client,
        {
          ...supersession,
          candidateId: profile.identity.candidateId,
          effectiveAt: profile.evidenceCutoff,
          createdAt: profile.evidenceCutoff,
        },
        control,
      );
    }
    for (const invalidation of refresh.invalidations) {
      await recordEvidenceInvalidation(
        client,
        {
          ...invalidation,
          candidateId: profile.identity.candidateId,
          effectiveAt: profile.evidenceCutoff,
          createdAt: profile.evidenceCutoff,
        },
        control,
      );
    }
    const priorLimitationIds = new Set(
      prior.limitations.map((limitation) => limitation.limitationId),
    );
    for (const limitation of profile.limitations) {
      if (priorLimitationIds.has(limitation.limitationId)) {
        continue;
      }
      await appendCandidateLimitation(
        client,
        { limitation, createdAt: profile.evidenceCutoff },
        control,
      );
    }
    const priorUnknownIds = new Set(
      prior.unknowns.map((unknown) => unknown.unknownId),
    );
    for (const unknown of profile.unknowns) {
      if (priorUnknownIds.has(unknown.unknownId)) {
        continue;
      }
      await appendCandidateUnknown(
        client,
        { unknown, createdAt: profile.evidenceCutoff },
        control,
      );
    }
    await createCandidateDossierSnapshot(
      client,
      {
        snapshotId: profile.snapshotId,
        dossier: profile.dossier,
        evidenceCutoff: profile.evidenceCutoff,
        createdAt: profile.evidenceCutoff,
      },
      control,
    );
    const reconstructed = await loadCandidateDossierSnapshot(
      client,
      { snapshotId: profile.snapshotId },
      control,
    );
    if (
      canonicalizeJson(reconstructed).digest !==
      canonicalizeJson(profile.dossier).digest
    ) {
      throw ingestionError('ingestion.persistence');
    }
  } catch (error) {
    if (error instanceof PersistenceError) {
      throw ingestionError('ingestion.persistence');
    }
    throw error;
  }

  const changed =
    refresh.observationsToAppend.length > 0 ||
    refresh.supersessions.length > 0 ||
    refresh.invalidations.length > 0;
  const outcome =
    snapshotExisted && !changed
      ? 'unchanged'
      : prior.observations.length === 0
        ? 'created'
        : 'updated';
  return {
    candidateId: profile.identity.candidateId,
    outcome,
    snapshotId: profile.snapshotId,
    evidenceAppended: refresh.observationsToAppend.length,
    evidenceIdempotent: refresh.unchangedEvidenceIds.length,
    evidenceSuperseded: refresh.supersessions.length,
    evidenceInvalidated: refresh.invalidations.length,
    limitationCount: profile.limitations.length,
    unknownCount: profile.unknowns.length,
    candidateState: prior.observations.length === 0 ? 'created' : 'idempotent',
    snapshotState: snapshotExisted ? 'idempotent' : 'created',
    incompleteSourceCodes: [],
    safeErrorCode: null,
  };
}
