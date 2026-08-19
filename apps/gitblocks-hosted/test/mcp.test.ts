import { readFile } from 'node:fs/promises';
import { once } from 'node:events';
import { request as httpRequest } from 'node:http';
import { createConnection } from 'node:net';

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
  GITBLOCKS_HEALTH_PATH,
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

  it('exposes self-contained construction examples for structured recommendation inputs', async () => {
    const application = await createAcceptedApplication();
    const { client } = await connectClient(application);
    const listed = await client.listTools();
    const inputSchema = listed.tools[0]?.inputSchema;

    expect(
      schemaDescription(inputSchema, [
        'properties',
        'capabilityQuery',
        'properties',
        'capabilityTerms',
      ]),
    ).toContain(
      '[{"termId":"term-authorization","originalTerm":"authorization"}]',
    );
    expect(
      schemaDescription(inputSchema, [
        'properties',
        'capabilityQuery',
        'properties',
        'successConditions',
      ]),
    ).toContain(
      '[{"conditionId":"condition-policy","statement":"Enforce repository policy."}]',
    );
    expect(
      schemaDescription(inputSchema, [
        'properties',
        'capabilityQuery',
        'properties',
        'draftConstraints',
      ]),
    ).toContain(
      '[{"constraintId":"constraint-runtime","modality":"required","statement":"Support Node.js 24.","originalTerm":"Node.js 24","facetHint":"runtime","reasonCode":"user-required"}]',
    );
    expect(
      schemaDescription(inputSchema, [
        'properties',
        'transmissionApproval',
        'properties',
        'approvedCategories',
      ]),
    ).toContain(
      '["bounded-evidence","candidate-dossiers","capability-request","repository-fingerprint"]',
    );
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
      failure: {
        kind: 'application',
        code: 'fit-model-failed',
        stage: 'model-assessment',
        path: 'fit-model-assessment',
        causeCode: 'hosted.fit-model-timeout',
      },
    };
    const failureEvents: unknown[] = [];
    const recommendOss = vi
      .fn<(input: unknown) => Promise<HostedRecommendationOperationResultV1>>()
      .mockResolvedValueOnce(failure)
      .mockRejectedValueOnce(new Error('provider credential sentinel'));
    const { client } = await connectClient({ recommendOss }, (event) =>
      failureEvents.push(event),
    );
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
    expect(failureEvents).toEqual([
      {
        operation: 'hosted.recommendation',
        correlationId: 'mcp-bounded-failure',
        status: 'failed',
        stage: 'model-assessment',
        path: 'fit-model-assessment',
        code: 'fit-model-failed',
        causeCode: 'hosted.fit-model-timeout',
      },
      {
        operation: 'hosted.recommendation',
        correlationId: 'mcp-bounded-failure',
        status: 'failed',
        stage: 'mcp',
        path: 'application-call',
        code: 'unexpected-application-error',
        causeCode: 'hosted.internal',
      },
    ]);
    expect(JSON.stringify(failureEvents)).not.toContain('sentinel');
  });

  it('keeps the bounded client failure unchanged when the log sink throws', async () => {
    const recommendOss = vi.fn(() =>
      Promise.resolve<HostedRecommendationOperationResultV1>({
        ok: false,
        failure: {
          kind: 'application',
          code: 'fit-model-failed',
          stage: 'model-assessment',
          path: 'fit-model-assessment',
          causeCode: 'hosted.fit-model-provider-failed',
        },
      }),
    );
    const { client } = await connectClient({ recommendOss }, () => {
      throw new Error('logging output sentinel');
    });

    expect(
      await client.callTool({
        name: GITBLOCKS_RECOMMEND_OSS_TOOL_NAME,
        arguments: recommendationRequest({
          id: 'mcp-failing-log-sink',
          term: 'authorization',
        }),
      }),
    ).toEqual(
      expect.objectContaining({
        isError: true,
        content: [{ type: 'text', text: 'GitBlocks recommendation failed.' }],
      }),
    );
  });

  it('keeps loopback authority behavior unchanged when the public host is unset', async () => {
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

  it('keeps non-loopback bind authority behavior unchanged when the public host is unset', async () => {
    const application = await createAcceptedApplication();
    const server = await startGitBlocksMcpHttpServer({
      application,
      host: '0.0.0.0',
      port: 0,
      token: MCP_TOKEN,
    });
    servers.push(server);

    expect(
      await rawStatus(server.endpoint, GITBLOCKS_MCP_PATH, {
        host: 'public.example.test',
      }),
    ).toBe(403);
    expect(
      await rawStatus(server.endpoint, GITBLOCKS_MCP_PATH, {
        host: '0.0.0.0',
        origin: 'https://public.example.test',
      }),
    ).toBe(403);
    expect(
      await rawStatus(server.endpoint, GITBLOCKS_MCP_PATH, {
        host: '0.0.0.0',
      }),
    ).toBe(401);
  });

  it('uses a distinct public host for port-agnostic authority validation before the unchanged bearer check', async () => {
    const application = await createAcceptedApplication();
    const server = await startGitBlocksMcpHttpServer({
      application,
      host: '0.0.0.0',
      publicHost: 'example-app.fly.dev',
      port: 0,
      token: MCP_TOKEN,
    });
    servers.push(server);

    expect(
      await rawStatus(server.endpoint, GITBLOCKS_MCP_PATH, {
        host: 'different.example.test',
      }),
    ).toBe(403);
    expect(
      await rawStatus(server.endpoint, GITBLOCKS_MCP_PATH, {
        host: 'example-app.fly.dev',
      }),
    ).toBe(401);
    expect(
      await rawStatus(server.endpoint, GITBLOCKS_MCP_PATH, {
        host: 'example-app.fly.dev:8443',
        origin: 'https://example-app.fly.dev:443',
      }),
    ).toBe(401);
  });

  it('reports not-ready before snapshot readiness and ready afterwards without a credential', async () => {
    const application = await createAcceptedApplication();
    let ready = false;
    const server = await startGitBlocksMcpHttpServer({
      application,
      port: 0,
      token: MCP_TOKEN,
      readiness: () => ready,
    });
    servers.push(server);

    expect(await rawResponse(server.endpoint, GITBLOCKS_HEALTH_PATH)).toEqual(
      expect.objectContaining({
        status: 503,
        body: '{"status":"not-ready"}',
      }),
    );
    ready = true;
    expect(await rawResponse(server.endpoint, GITBLOCKS_HEALTH_PATH)).toEqual(
      expect.objectContaining({
        status: 200,
        body: '{"status":"ready"}',
      }),
    );
  });

  it('bounds listener drain time before forcibly closing an unfinished connection', async () => {
    const application = await createAcceptedApplication();
    const server = await startGitBlocksMcpHttpServer({
      application,
      port: 0,
      token: MCP_TOKEN,
      drainMilliseconds: 25,
    });
    servers.push(server);
    const socket = createConnection({
      host: server.endpoint.hostname,
      port: Number(server.endpoint.port),
    });
    await once(socket, 'connect');
    socket.write(
      `POST ${GITBLOCKS_MCP_PATH} HTTP/1.1\r\nHost: ${server.endpoint.host}\r\nAuthorization: Bearer ${MCP_TOKEN}\r\nContent-Length: 100\r\nContent-Type: application/json\r\n\r\n{`,
    );
    await new Promise((resolve) => setTimeout(resolve, 5));

    const startedAt = Date.now();
    await server.close();
    const elapsed = Date.now() - startedAt;

    expect(elapsed).toBeGreaterThanOrEqual(15);
    expect(elapsed).toBeLessThan(500);
    socket.destroy();
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
  onRecommendationFailure?: (event: unknown) => void,
): Promise<{
  readonly client: Client;
  readonly server: GitBlocksMcpHttpServerV1;
}> {
  const server = await startGitBlocksMcpHttpServer({
    application,
    port: 0,
    token: MCP_TOKEN,
    ...(onRecommendationFailure === undefined
      ? {}
      : {
          recommendationFailureObserver: {
            emit: onRecommendationFailure,
          },
        }),
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

function schemaDescription(
  schema: unknown,
  path: readonly string[],
): string | undefined {
  let current = schema;
  for (const segment of path) {
    if (
      typeof current !== 'object' ||
      current === null ||
      Array.isArray(current) ||
      !(segment in current)
    ) {
      return undefined;
    }
    current = Reflect.get(current, segment);
  }
  return typeof current === 'object' &&
    current !== null &&
    !Array.isArray(current) &&
    'description' in current &&
    typeof current.description === 'string'
    ? current.description
    : undefined;
}
