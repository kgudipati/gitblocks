import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';

import {
  localhostHostValidation,
  localhostOriginValidation,
  toNodeHandler,
} from '@modelcontextprotocol/node';
import {
  createMcpHandler,
  type McpHttpHandler,
} from '@modelcontextprotocol/server';

import type { HostedRecommendationApplicationV1 } from './application.ts';
import { createGitBlocksMcpServer } from './mcp-server.ts';

export const GITBLOCKS_MCP_HOST = '127.0.0.1';
export const GITBLOCKS_MCP_PATH = '/mcp';

export interface GitBlocksMcpHttpServerV1 {
  readonly endpoint: URL;
  readonly close: () => Promise<void>;
}

export function createGitBlocksMcpHandler(
  application: Pick<HostedRecommendationApplicationV1, 'recommendOss'>,
): McpHttpHandler {
  return createMcpHandler(() => createGitBlocksMcpServer(application));
}

export async function startGitBlocksMcpHttpServer(input: {
  readonly application: Pick<HostedRecommendationApplicationV1, 'recommendOss'>;
  readonly port: number;
  readonly onError?: () => void;
}): Promise<GitBlocksMcpHttpServerV1> {
  const handler = createGitBlocksMcpHandler(input.application);
  const nodeHandler = toNodeHandler(handler, {
    onerror: () => input.onError?.(),
  }) as unknown as (
    request: IncomingMessage,
    response: ServerResponse,
  ) => Promise<void>;
  const validateHost = localhostHostValidation();
  const validateOrigin = localhostOriginValidation();
  const server = createServer((request, response) => {
    if (
      !validateHost(request, response) ||
      !validateOrigin(request, response)
    ) {
      return;
    }
    const path = new URL(request.url ?? '/', `http://${GITBLOCKS_MCP_HOST}`)
      .pathname;
    if (path !== GITBLOCKS_MCP_PATH) {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Not found.');
      return;
    }
    void nodeHandler(request, response).catch(() => input.onError?.());
  });

  try {
    const port = await listenOnLoopback(server, input.port);
    let closePromise: Promise<void> | undefined;
    return Object.freeze({
      endpoint: new URL(
        `http://${GITBLOCKS_MCP_HOST}:${String(port)}${GITBLOCKS_MCP_PATH}`,
      ),
      close: () => {
        closePromise ??= closeServerAndHandler(server, handler);
        return closePromise;
      },
    });
  } catch (error) {
    await handler.close().catch(() => undefined);
    throw error;
  }
}

function listenOnLoopback(server: Server, port: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const onError = (error: Error): void => {
      reject(error);
    };
    server.once('error', onError);
    server.listen(port, GITBLOCKS_MCP_HOST, () => {
      server.removeListener('error', onError);
      const address = server.address();
      if (address === null || typeof address === 'string') {
        reject(new Error('MCP listener did not expose a TCP address.'));
        return;
      }
      resolve(address.port);
    });
  });
}

async function closeServerAndHandler(
  server: Server,
  handler: McpHttpHandler,
): Promise<void> {
  let listenerFailure: unknown;
  try {
    await closeHttpServer(server);
  } catch (error) {
    listenerFailure = error;
  }
  try {
    await handler.close();
  } catch (error) {
    if (listenerFailure === undefined) throw error;
  }
  if (listenerFailure !== undefined) throw asError(listenerFailure);
}

function asError(value: unknown): Error {
  return value instanceof Error ? value : new Error('MCP listener failed.');
}

function closeHttpServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error === undefined) resolve();
      else reject(error);
    });
  });
}
