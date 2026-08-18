import type { PersistenceClientConfig } from '@gitblocks/persistence';

import {
  startHostedRecommendationComposition,
  type HostedRecommendationCompositionV1,
} from './composition.ts';
import {
  hostedRecommendationNotReady,
  type FitAssessmentModelPort,
  type HostedRecommendationClockPort,
  type HostedRecommendationObserverV1,
} from './application.ts';
import {
  startGitBlocksMcpHttpServer,
  type GitBlocksMcpHttpServerV1,
} from './mcp-http.ts';

export interface GitBlocksMcpProcessV1 {
  readonly endpoint: URL;
  readonly close: () => Promise<void>;
}

export async function startGitBlocksMcpProcess(input: {
  readonly database: PersistenceClientConfig;
  readonly fitModel: FitAssessmentModelPort;
  readonly clock?: HostedRecommendationClockPort;
  readonly observer?: HostedRecommendationObserverV1;
  readonly host?: string;
  readonly publicHost?: string;
  readonly port: number;
  readonly token: string;
  readonly drainMilliseconds?: number;
  readonly signal?: AbortSignal;
  readonly onTransportError?: () => void;
}): Promise<GitBlocksMcpProcessV1> {
  let composition: HostedRecommendationCompositionV1 | undefined;
  let listener: GitBlocksMcpHttpServerV1 | undefined;
  try {
    const application = Object.freeze({
      recommendOss: (suppliedInput: unknown) =>
        composition === undefined
          ? Promise.resolve(hostedRecommendationNotReady())
          : composition.recommendOss(suppliedInput),
    });
    listener = await startGitBlocksMcpHttpServer({
      application,
      ...(input.host === undefined ? {} : { host: input.host }),
      ...(input.publicHost === undefined
        ? {}
        : { publicHost: input.publicHost }),
      port: input.port,
      token: input.token,
      readiness: () => composition?.readiness().ready === true,
      ...(input.drainMilliseconds === undefined
        ? {}
        : { drainMilliseconds: input.drainMilliseconds }),
      ...(input.onTransportError === undefined
        ? {}
        : { onError: input.onTransportError }),
    });
    composition = await startHostedRecommendationComposition({
      database: input.database,
      fitModel: input.fitModel,
      ...(input.clock === undefined ? {} : { clock: input.clock }),
      ...(input.observer === undefined ? {} : { observer: input.observer }),
      ...(input.signal === undefined ? {} : { signal: input.signal }),
    });
    if (!composition.readiness().ready) {
      throw new Error('Hosted recommendation composition is not ready.');
    }
    let closePromise: Promise<void> | undefined;
    const ownedComposition = composition;
    const ownedListener = listener;
    return Object.freeze({
      endpoint: ownedListener.endpoint,
      close: () => {
        closePromise ??= closeListenerAndComposition(
          ownedListener,
          ownedComposition,
        );
        return closePromise;
      },
    });
  } catch (error) {
    await listener?.close().catch(() => undefined);
    await composition?.close().catch(() => undefined);
    throw error;
  }
}

async function closeListenerAndComposition(
  listener: GitBlocksMcpHttpServerV1,
  composition: HostedRecommendationCompositionV1,
): Promise<void> {
  let listenerFailure: unknown;
  try {
    await listener.close();
  } catch (error) {
    listenerFailure = error;
  }
  try {
    await composition.close();
  } catch (error) {
    if (listenerFailure === undefined) throw error;
  }
  if (listenerFailure !== undefined) {
    throw listenerFailure instanceof Error
      ? listenerFailure
      : new Error('MCP listener shutdown failed.');
  }
}
