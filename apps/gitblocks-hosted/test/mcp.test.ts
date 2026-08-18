import { readFile } from 'node:fs/promises';
import { request as httpRequest } from 'node:http';

import {
  Client,
  StreamableHTTPClientTransport,
  type FetchLike,
} from '@modelcontextprotocol/client';
import { getContractSchemaV1 } from '@gitblocks/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type {
  HostedRecommendationApplicationV1,
  HostedRecommendationOperationResultV1,
} from '../src/application.ts';
import {
  GITBLOCKS_MCP_HOST,
  GITBLOCKS_MCP_PATH,
  startGitBlocksMcpHttpServer,
  type GitBlocksMcpHttpServerV1,
} from '../src/mcp-http.ts';
import { GITBLOCKS_RECOMMEND_OSS_TOOL_NAME } from '../src/mcp-server.ts';
import {
  createAcceptedApplication,
  recommendationRequest,
} from './fixtures.ts';

const nativeFetch = globalThis.fetch.bind(globalThis);
const MCP_TOKEN = 'test-only-mcp-bearer-token';
const loopbackFetch: FetchLike = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.hostname !== GITBLOCKS_MCP_HOST) {
    throw new Error('MCP tests permit loopback HTTP only.');
  }
  return nativeFetch(input, init);
};

const clients: Client[] = [];
const servers: GitBlocksMcpHttpServerV1[] = [];

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()));
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe('GitBlocks recommendation MCP adapter', () => {
  it('uses the official modern client to expose exactly recommend_oss with the authoritative request schema', async () => {
    const application = await createAcceptedApplication();
    const recommendOss = vi.fn((input: unknown) =>
      application.recommendOss(input),
    );
    const { client } = await connectClient({ recommendOss });

    expect(client.getProtocolEra()).toBe('modern');
    const listed = await client.listTools();
    expect(listed.tools).toHaveLength(1);
    expect(listed.tools[0]).toMatchObject({
      name: GITBLOCKS_RECOMMEND_OSS_TOOL_NAME,
      inputSchema: getContractSchemaV1('oss-recommendation-request'),
    });
    expect(listed.tools.some(({ name }) => name === 'discover_oss')).toBe(
      false,
    );

    const called = await client.callTool({
      name: GITBLOCKS_RECOMMEND_OSS_TOOL_NAME,
      arguments: recommendationRequest({
        id: 'mcp-recommendation',
        term: 'authorization',
      }),
    });
    expect(recommendOss).toHaveBeenCalledTimes(1);
    expect(called.isError).not.toBe(true);
    expect(called.structuredContent).toMatchObject({
      outcome: 'recommend',
    });
    const options = responsibleOptions(called.structuredContent);
    expect(options.length).toBeGreaterThan(0);
    expect(options.length).toBeLessThanOrEqual(3);
    expect(candidateId(options[0])).not.toBeNull();
  });

  it.each([
    ['clarification-required', 'lightweight'],
    ['unsupported', 'authentication'],
  ] as const)(
    'returns %s as a valid responsible outcome',
    async (expected, term) => {
      const application = await createAcceptedApplication();
      const { client } = await connectClient(application);
      const result = await client.callTool({
        name: GITBLOCKS_RECOMMEND_OSS_TOOL_NAME,
        arguments: recommendationRequest({ id: `mcp-${expected}`, term }),
      });
      expect(result.isError).not.toBe(true);
      expect(result.structuredContent).toMatchObject({ outcome: expected });
    },
  );

  it('maps application and unexpected failures to one bounded value-free error', async () => {
    const failure: HostedRecommendationOperationResultV1 = {
      ok: false,
      failure: { kind: 'application', code: 'fit-model-failed' },
    };
    const recommendOss = vi
      .fn<(input: unknown) => Promise<HostedRecommendationOperationResultV1>>()
      .mockResolvedValueOnce(failure)
      .mockRejectedValueOnce(new Error('provider credential sentinel'));
    const { client } = await connectClient({ recommendOss });
    const request = recommendationRequest({
      id: 'mcp-bounded-failure',
      term: 'authorization',
    });

    const first = await client.callTool({
      name: GITBLOCKS_RECOMMEND_OSS_TOOL_NAME,
      arguments: request,
    });
    const second = await client.callTool({
      name: GITBLOCKS_RECOMMEND_OSS_TOOL_NAME,
      arguments: request,
    });
    expect([first, second]).toEqual([
      expect.objectContaining({
        isError: true,
        content: [{ type: 'text', text: 'GitBlocks recommendation failed.' }],
      }),
      expect.objectContaining({
        isError: true,
        content: [{ type: 'text', text: 'GitBlocks recommendation failed.' }],
      }),
    ]);
    expect(JSON.stringify([first, second])).not.toContain('sentinel');
  });

  it('keeps the listener loopback-only and rejects non-MCP or non-loopback authority', async () => {
    const application = await createAcceptedApplication();
    const server = await startGitBlocksMcpHttpServer({
      application,
      port: 0,
      token: MCP_TOKEN,
    });
    servers.push(server);
    expect(server.endpoint.hostname).toBe(GITBLOCKS_MCP_HOST);
    expect(server.endpoint.pathname).toBe(GITBLOCKS_MCP_PATH);
    expect(await rawStatus(server.endpoint, '/not-mcp')).toBe(404);
    expect(
      await rawStatus(server.endpoint, GITBLOCKS_MCP_PATH, {
        host: 'public.example.test',
      }),
    ).toBe(403);
    expect(
      await rawStatus(server.endpoint, GITBLOCKS_MCP_PATH, {
        origin: 'https://public.example.test',
      }),
    ).toBe(403);
  });

  it('returns the bounded unauthorized response when Authorization is missing', async () => {
    const server = await startServer();

    expect(
      await rawResponse(server.endpoint, GITBLOCKS_MCP_PATH),
    ).toMatchObject({
      status: 401,
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: '{"error":"unauthorized"}',
    });
  });

  it('returns the same bounded unauthorized response for a wrong bearer token', async () => {
    const server = await startServer();

    expect(
      await rawResponse(server.endpoint, GITBLOCKS_MCP_PATH, {
        authorization: 'Bearer wrong-test-token',
      }),
    ).toMatchObject({
      status: 401,
      body: '{"error":"unauthorized"}',
    });
  });

  it('returns the same bounded unauthorized response for malformed Authorization', async () => {
    const server = await startServer();

    expect(
      await rawResponse(server.endpoint, GITBLOCKS_MCP_PATH, {
        authorization: `Basic ${MCP_TOKEN}`,
      }),
    ).toMatchObject({
      status: 401,
      body: '{"error":"unauthorized"}',
    });
  });

  it('never exposes bearer-token values through the response or transport error observer', async () => {
    const onError = vi.fn();
    const server = await startServer(onError);
    const wrongToken = 'wrong-token-output-sentinel';

    const response = await rawResponse(server.endpoint, GITBLOCKS_MCP_PATH, {
      authorization: `Bearer ${wrongToken}`,
    });

    expect(onError).not.toHaveBeenCalled();
    expect(JSON.stringify({ response, calls: onError.mock.calls })).not.toMatch(
      new RegExp(`${MCP_TOKEN}|${wrongToken}`, 'u'),
    );
  });

  it('keeps the MCP adapter free of persistence, retrieval, and model implementation imports', async () => {
    const source = await readFile(
      new URL('../src/mcp-server.ts', import.meta.url),
      'utf8',
    );
    expect(source).not.toMatch(
      /@gitblocks\/(?:persistence|retrieval)|openai-fit-model|loadActiveCandidateDossier/u,
    );
  });
});

async function connectClient(
  application: Pick<HostedRecommendationApplicationV1, 'recommendOss'>,
): Promise<{
  readonly client: Client;
  readonly server: GitBlocksMcpHttpServerV1;
}> {
  const server = await startGitBlocksMcpHttpServer({
    application,
    port: 0,
    token: MCP_TOKEN,
  });
  servers.push(server);
  const client = new Client(
    { name: 'gitblocks-hosted-test', version: '0.0.0' },
    { versionNegotiation: { mode: { pin: '2026-07-28' } } },
  );
  clients.push(client);
  await client.connect(
    new StreamableHTTPClientTransport(server.endpoint, {
      authProvider: { token: () => Promise.resolve(MCP_TOKEN) },
      fetch: loopbackFetch,
    }),
  );
  return { client, server };
}

function responsibleOptions(value: unknown): readonly unknown[] {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('responsibleOptions' in value) ||
    !Array.isArray(value.responsibleOptions)
  ) {
    return [];
  }
  return value.responsibleOptions;
}

function rawStatus(
  endpoint: URL,
  path: string,
  headers: Readonly<Record<string, string>> = {},
): Promise<number | undefined> {
  return rawResponse(endpoint, path, headers).then(({ status }) => status);
}

function rawResponse(
  endpoint: URL,
  path: string,
  headers: Readonly<Record<string, string>> = {},
): Promise<{
  readonly status: number | undefined;
  readonly headers: Readonly<Record<string, string | string[] | undefined>>;
  readonly body: string;
}> {
  return new Promise((resolve, reject) => {
    const request = httpRequest(
      {
        host: endpoint.hostname,
        port: endpoint.port,
        path,
        method: 'GET',
        headers,
      },
      (response) => {
        response.setEncoding('utf8');
        let body = '';
        response.on('data', (chunk: string) => {
          body += chunk;
        });
        response.once('end', () => {
          resolve({
            status: response.statusCode,
            headers: response.headers,
            body,
          });
        });
      },
    );
    request.once('error', reject);
    request.end();
  });
}

async function startServer(onError?: () => void) {
  const application = await createAcceptedApplication();
  const server = await startGitBlocksMcpHttpServer({
    application,
    port: 0,
    token: MCP_TOKEN,
    ...(onError === undefined ? {} : { onError }),
  });
  servers.push(server);
  return server;
}

function candidateId(value: unknown): string | null {
  return typeof value === 'object' &&
    value !== null &&
    'candidateId' in value &&
    typeof value.candidateId === 'string'
    ? value.candidateId
    : null;
}
