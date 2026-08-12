import {
  closePersistenceClient,
  createPersistenceClient,
  loadServingCatalogSnapshot,
  type PersistenceClientConfig,
} from '@gitblocks/persistence';
import { createCandidateRetrievalEngineV1 } from '@gitblocks/retrieval';

import {
  createHostedDiscoveryApplication,
  hostedDiscoveryNotReady,
  type HostedDiscoveryOperationResultV1,
  type HostedDiscoverySnapshotV1,
} from './application.ts';
import { HostedDiscoveryError } from './errors.ts';
import { loadAcceptedHostedDiscoveryStaticPolicyV1 } from './static-policy.ts';

export type HostedDiscoveryReadinessV1 =
  | {
      readonly ready: true;
      readonly snapshot: HostedDiscoverySnapshotV1;
    }
  | {
      readonly ready: false;
    };

export interface HostedDiscoveryCompositionV1 {
  readonly discoverCapability: (
    input: unknown,
  ) => HostedDiscoveryOperationResultV1;
  readonly readiness: () => HostedDiscoveryReadinessV1;
  readonly close: () => Promise<void>;
}

export async function startHostedDiscoveryComposition(input: {
  readonly database: PersistenceClientConfig;
  readonly signal?: AbortSignal;
}): Promise<HostedDiscoveryCompositionV1> {
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
    const created = createHostedDiscoveryApplication({
      snapshot,
      taxonomy: policy.taxonomy,
      candidateProfileAuthority: loaded.candidateProfileAuthority,
      retrievalExpansionAuthority: policy.retrievalExpansion,
      candidateRetrievalMetadataAuthority:
        loaded.candidateRetrievalMetadataAuthority,
      engine: engine.engine,
    });
    if (!created.ok) {
      throw new HostedDiscoveryError('hosted.application-construction-failed');
    }
    let state: 'ready' | 'closing' | 'closed' = 'ready';
    let closePromise: Promise<void> | undefined;
    return Object.freeze({
      discoverCapability: (suppliedInput: unknown) =>
        state === 'ready'
          ? created.application.discoverCapability(suppliedInput)
          : hostedDiscoveryNotReady(),
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
