import type { PersistenceClientConfig } from '@gitblocks/persistence';

import {
  startHostedDiscoveryComposition,
  type HostedDiscoveryCompositionV1,
} from './composition.ts';
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
  readonly port: number;
  readonly signal?: AbortSignal;
  readonly onTransportError?: () => void;
}): Promise<GitBlocksMcpProcessV1> {
  let composition: HostedDiscoveryCompositionV1 | undefined;
  let listener: GitBlocksMcpHttpServerV1 | undefined;
  try {
    composition = await startHostedDiscoveryComposition({
      database: input.database,
      ...(input.signal === undefined ? {} : { signal: input.signal }),
    });
    if (!composition.readiness().ready) {
      throw new Error('Hosted discovery composition is not ready.');
    }
    listener = await startGitBlocksMcpHttpServer({
      application: composition,
      port: input.port,
      ...(input.onTransportError === undefined
        ? {}
        : { onError: input.onTransportError }),
    });
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
  composition: HostedDiscoveryCompositionV1,
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
