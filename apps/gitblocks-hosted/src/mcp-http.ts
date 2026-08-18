import { createHash, timingSafeEqual } from 'node:crypto';
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';

import {
  hostHeaderValidation,
  localhostHostValidation,
  localhostOriginValidation,
  originValidation,
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
export const GITBLOCKS_HEALTH_PATH = '/health';
export const GITBLOCKS_HTTP_DRAIN_MILLISECONDS = 10_000;
const UNAUTHORIZED_RESPONSE_BODY = '{"error":"unauthorized"}';
const READY_RESPONSE_BODY = '{"status":"ready"}';
const NOT_READY_RESPONSE_BODY = '{"status":"not-ready"}';

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
  readonly host?: string;
  readonly publicHost?: string;
  readonly port: number;
  readonly token: string;
  readonly readiness?: () => boolean;
  readonly drainMilliseconds?: number;
  readonly onError?: () => void;
}): Promise<GitBlocksMcpHttpServerV1> {
  if (input.token.length === 0) {
    throw new Error('MCP bearer token is required.');
  }
  const bindHost = input.host ?? GITBLOCKS_MCP_HOST;
  const publicHost = input.publicHost ?? bindHost;
  const drainMilliseconds =
    input.drainMilliseconds ?? GITBLOCKS_HTTP_DRAIN_MILLISECONDS;
  if (bindHost.length === 0) {
    throw new Error('MCP bind host is required.');
  }
  if (publicHost.length === 0) {
    throw new Error('MCP public host is required.');
  }
  if (!Number.isInteger(drainMilliseconds) || drainMilliseconds < 0) {
    throw new Error('MCP drain period must be a non-negative integer.');
  }
  const expectedTokenDigest = tokenDigest(input.token);
  const handler = createGitBlocksMcpHandler(input.application);
  const nodeHandler = toNodeHandler(handler, {
    onerror: () => input.onError?.(),
  }) as unknown as (
    request: IncomingMessage,
    response: ServerResponse,
  ) => Promise<void>;
  const { validateHost, validateOrigin } = authorityValidators(publicHost);
  const readiness = input.readiness ?? (() => true);
  const server = createServer((request, response) => {
    if (
      !validateHost(request, response) ||
      !validateOrigin(request, response)
    ) {
      return;
    }
    const path = new URL(request.url ?? '/', 'http://localhost').pathname;
    if (path === GITBLOCKS_HEALTH_PATH) {
      if (request.method !== 'GET') {
        response.writeHead(405, {
          allow: 'GET',
          'content-type': 'text/plain; charset=utf-8',
        });
        response.end('Method not allowed.');
        return;
      }
      writeHealthResponse(response, readiness);
      return;
    }
    if (path !== GITBLOCKS_MCP_PATH) {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Not found.');
      return;
    }
    if (!hasExpectedBearerToken(request, expectedTokenDigest)) {
      response.writeHead(401, {
        'cache-control': 'no-store',
        'content-length': String(Buffer.byteLength(UNAUTHORIZED_RESPONSE_BODY)),
        'content-type': 'application/json; charset=utf-8',
      });
      response.end(UNAUTHORIZED_RESPONSE_BODY);
      return;
    }
    void nodeHandler(request, response).catch(() => input.onError?.());
  });

  try {
    const port = await listen(server, bindHost, input.port);
    let closePromise: Promise<void> | undefined;
    return Object.freeze({
      endpoint: new URL(
        `http://${urlHost(bindHost)}:${String(port)}${GITBLOCKS_MCP_PATH}`,
      ),
      close: () => {
        closePromise ??= closeServerAndHandler(
          server,
          handler,
          drainMilliseconds,
        );
        return closePromise;
      },
    });
  } catch (error) {
    await handler.close().catch(() => undefined);
    throw error;
  }
}

function hasExpectedBearerToken(
  request: IncomingMessage,
  expectedTokenDigest: Buffer,
): boolean {
  const authorizations = request.headersDistinct['authorization'];
  if (authorizations?.length !== 1) return false;
  const match = /^Bearer ([^\s]+)$/iu.exec(authorizations[0] ?? '');
  if (match?.[1] === undefined) return false;
  return timingSafeEqual(tokenDigest(match[1]), expectedTokenDigest);
}

function tokenDigest(token: string): Buffer {
  return createHash('sha256').update(token, 'utf8').digest();
}

function listen(
  server: Server,
  bindHost: string,
  port: number,
): Promise<number> {
  return new Promise((resolve, reject) => {
    const onError = (error: Error): void => {
      reject(error);
    };
    server.once('error', onError);
    server.listen(port, bindHost, () => {
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
  drainMilliseconds: number,
): Promise<void> {
  let listenerFailure: unknown;
  try {
    await closeHttpServer(server, drainMilliseconds);
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

function closeHttpServer(
  server: Server,
  drainMilliseconds: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const drainTimer = setTimeout(() => {
      server.closeAllConnections();
    }, drainMilliseconds);
    drainTimer.unref();
    server.close((error) => {
      clearTimeout(drainTimer);
      if (error === undefined) resolve();
      else reject(error);
    });
    server.closeIdleConnections();
  });
}

function authorityValidators(host: string): {
  readonly validateHost: ReturnType<typeof localhostHostValidation>;
  readonly validateOrigin: ReturnType<typeof localhostOriginValidation>;
} {
  if (host === '127.0.0.1' || host === 'localhost' || host === '::1') {
    return Object.freeze({
      validateHost: localhostHostValidation(),
      validateOrigin: localhostOriginValidation(),
    });
  }
  const allowedAuthority = urlHost(host).toLowerCase();
  return Object.freeze({
    validateHost: hostHeaderValidation([allowedAuthority]),
    validateOrigin: originValidation([allowedAuthority]),
  });
}

function urlHost(host: string): string {
  return host.includes(':') ? `[${host}]` : host;
}

function writeHealthResponse(
  response: ServerResponse,
  readiness: () => boolean,
): void {
  const ready = readReadiness(readiness);
  const body = ready ? READY_RESPONSE_BODY : NOT_READY_RESPONSE_BODY;
  response.writeHead(ready ? 200 : 503, {
    'cache-control': 'no-store',
    'content-length': String(Buffer.byteLength(body)),
    'content-type': 'application/json; charset=utf-8',
  });
  response.end(body);
}

function readReadiness(readiness: () => boolean): boolean {
  try {
    return readiness();
  } catch {
    return false;
  }
}
