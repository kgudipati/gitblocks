import {
  closePersistenceClient,
  createPersistenceClient,
  loadCandidateRepositoryArtifactMaterial,
  loadActiveCandidateDossier,
  loadServingCatalogSnapshot,
  type LoadActiveCandidateDossierCommand,
  type PersistenceClientConfig,
} from '@gitblocks/persistence';
import { createCandidateRetrievalEngineV1 } from '@gitblocks/retrieval';

import {
  createHostedRecommendationApplication,
  hostedRecommendationNotReady,
  type FitAssessmentModelPort,
  type HostedDiscoverySnapshotV1,
  type HostedRecommendationApplicationV1,
  type HostedRecommendationClockPort,
  type HostedRecommendationObserverV1,
  type HostedRecommendationOperationResultV1,
} from './application.ts';
import type { CandidateArtifactMaterialLoaderPort } from './artifact-evidence-selector.ts';
import { HostedDiscoveryError } from './errors.ts';
import { loadAcceptedHostedDiscoveryStaticPolicyV1 } from './static-policy.ts';

export type HostedRecommendationReadinessV1 =
  | {
      readonly ready: true;
      readonly snapshot: HostedDiscoverySnapshotV1;
    }
  | {
      readonly ready: false;
    };

export interface HostedRecommendationCompositionV1 {
  readonly recommendOss: (
    input: unknown,
  ) => Promise<HostedRecommendationOperationResultV1>;
  readonly readiness: () => HostedRecommendationReadinessV1;
  readonly close: () => Promise<void>;
}

export async function startHostedRecommendationComposition(input: {
  readonly database: PersistenceClientConfig;
  readonly fitModel: FitAssessmentModelPort;
  readonly clock?: HostedRecommendationClockPort;
  readonly observer?: HostedRecommendationObserverV1;
  readonly signal?: AbortSignal;
}): Promise<HostedRecommendationCompositionV1> {
  const client = createPersistenceClient(input.database);
  try {
    const loaded = await loadServingCatalogSnapshot(
      client,
      { selection: 'current' },
      input.signal === undefined ? undefined : { signal: input.signal },
    );
    const policy = await loadAcceptedHostedDiscoveryStaticPolicyV1();
    const engine = createCandidateRetrievalEngineV1({
      taxonomy: policy.taxonomy,
      candidateProfileAuthority: loaded.candidateProfileAuthority,
      retrievalExpansionAuthority: policy.retrievalExpansion,
      candidateRetrievalMetadataAuthority:
        loaded.candidateRetrievalMetadataAuthority,
      expectedCandidateRetrievalMetadataAuthorityBinding:
        loaded.expectedCandidateRetrievalMetadataAuthorityBinding,
    });
    if (!engine.ok) {
      throw new HostedDiscoveryError(
        'hosted.retrieval-engine-construction-failed',
      );
    }
    const snapshot = Object.freeze({
      snapshotId: loaded.snapshotId,
      snapshotRecordDigest: loaded.snapshotRecordDigest,
      candidateCount: loaded.candidateCount,
    });
    const created = createHostedRecommendationApplication({
      snapshot,
      taxonomy: policy.taxonomy,
      candidateProfileAuthority: loaded.candidateProfileAuthority,
      retrievalExpansionAuthority: policy.retrievalExpansion,
      candidateRetrievalMetadataAuthority:
        loaded.candidateRetrievalMetadataAuthority,
      engine: engine.engine,
      dossierLoader: Object.freeze({
        loadActiveCandidateDossier: (
          command: LoadActiveCandidateDossierCommand,
        ) => loadActiveCandidateDossier(client, command),
      }),
      artifactMaterialLoader: Object.freeze({
        loadCandidateRepositoryArtifactMaterial: (
          command: Parameters<
            CandidateArtifactMaterialLoaderPort['loadCandidateRepositoryArtifactMaterial']
          >[0],
        ) => loadCandidateRepositoryArtifactMaterial(client, command),
      }),
      fitModel: input.fitModel,
      clock:
        input.clock ?? Object.freeze({ now: () => new Date().toISOString() }),
      ...(input.observer === undefined ? {} : { observer: input.observer }),
    });
    if (!created.ok) {
      throw new HostedDiscoveryError('hosted.application-construction-failed');
    }
    let state: 'ready' | 'closing' | 'closed' = 'ready';
    let closePromise: Promise<void> | undefined;
    const application: HostedRecommendationApplicationV1 = created.application;
    return Object.freeze({
      recommendOss: (suppliedInput: unknown) =>
        state === 'ready'
          ? application.recommendOss(suppliedInput)
          : Promise.resolve(hostedRecommendationNotReady()),
      readiness: () =>
        state === 'ready'
          ? Object.freeze({ ready: true, snapshot })
          : Object.freeze({ ready: false }),
      close: () => {
        closePromise ??= closeOwnedClient();
        return closePromise;
      },
    });

    async function closeOwnedClient(): Promise<void> {
      state = 'closing';
      try {
        await closePersistenceClient(client);
      } finally {
        state = 'closed';
      }
    }
  } catch (error) {
    try {
      await closePersistenceClient(client);
    } catch {
      // The startup failure remains primary and is already bounded.
    }
    throw error;
  }
}
