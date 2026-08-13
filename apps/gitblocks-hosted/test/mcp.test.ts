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
  HostedDiscoveryApplicationV1,
  HostedDiscoveryOperationResultV1,
} from '../src/application.ts';
import {
  GITBLOCKS_MCP_HOST,
  GITBLOCKS_MCP_PATH,
  startGitBlocksMcpHttpServer,
  type GitBlocksMcpHttpServerV1,
} from '../src/mcp-http.ts';
import { GITBLOCKS_DISCOVER_OSS_TOOL_NAME } from '../src/mcp-server.ts';
import { capabilityInput, createAcceptedApplication } from './fixtures.ts';

const AUTHORIZATION_DIGEST =
  '4b1b67eda39c618ae67738e7776957c6ea45315d0893199c90e42f7bc39d9b00';
const nativeFetch = globalThis.fetch.bind(globalThis);
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

describe('GitBlocks MCP adapter', () => {
  it('uses the official modern client to list one schema-derived tool and retrieve the exact R4 shortlist', async () => {
    const application = await createAcceptedApplication();
    const discoverCapability = vi.fn((input: unknown) =>
      application.discoverCapability(input),
    );
    const { client } = await connectClient({ discoverCapability });

    expect(client.getProtocolEra()).toBe('modern');
    expect(client.getNegotiatedProtocolVersion()).toBe('2026-07-28');
    const listed = await client.listTools();
    expect(listed.tools).toHaveLength(1);
    expect(listed.tools[0]).toMatchObject({
      name: GITBLOCKS_DISCOVER_OSS_TOOL_NAME,
      inputSchema: getContractSchemaV1('capability-query-input'),
    });

    const request = JSON.parse(
      await readFile(
        new URL(
          '../examples/authorization-discovery-request.json',
          import.meta.url,
        ),
        'utf8',
      ),
    ) as Record<string, unknown>;
    const first = await client.callTool({
      name: GITBLOCKS_DISCOVER_OSS_TOOL_NAME,
      arguments: request,
    });
    expect(discoverCapability).toHaveBeenCalledTimes(1);
    const second = await client.callTool({
      name: GITBLOCKS_DISCOVER_OSS_TOOL_NAME,
      arguments: request,
    });
    expect(discoverCapability).toHaveBeenCalledTimes(2);
    expect(retrievedDigest(first.structuredContent)).toBe(AUTHORIZATION_DIGEST);
    expect(second.structuredContent).toEqual(first.structuredContent);
    expect(first.isError).not.toBe(true);
  });

  it.each([
    ['clarification-required', 'lightweight'],
    ['unsupported', 'authentication'],
  ] as const)(
    'returns %s as a valid product outcome',
    async (expectedOutcome, term) => {
      const application = await createAcceptedApplication();
      const { client } = await connectClient(application);
      const result = await client.callTool({
        name: GITBLOCKS_DISCOVER_OSS_TOOL_NAME,
        arguments: capabilityInput({
          id: `mcp-${expectedOutcome}`,
          term,
        }),
      });

      expect(result.isError).not.toBe(true);
      expect(result.structuredContent).toMatchObject({
        outcome: expectedOutcome,
        normalization: { outcome: expectedOutcome },
      });
    },
  );

  it('maps application and unexpected failures to the same bounded tool error', async () => {
    const internalDetail = 'sql credential and stack sentinel';
    const contractFailure: HostedDiscoveryOperationResultV1 = {
      ok: false,
      failure: { kind: 'contract', issues: [] },
    };
    const applicationFailure = vi
      .fn<(input: unknown) => HostedDiscoveryOperationResultV1>()
      .mockReturnValueOnce(contractFailure)
      .mockImplementationOnce(() => {
        throw new Error(internalDetail);
      });
    const { client } = await connectClient({
      discoverCapability: applicationFailure,
    });
    const request = capabilityInput({
      id: 'mcp-bounded-failure',
      term: 'authorization',
    });

    const contractResult = await client.callTool({
      name: GITBLOCKS_DISCOVER_OSS_TOOL_NAME,
      arguments: request,
    });
    const thrownResult = await client.callTool({
      name: GITBLOCKS_DISCOVER_OSS_TOOL_NAME,
      arguments: request,
    });

    expect(applicationFailure).toHaveBeenCalledTimes(2);
    expect(contractResult).toMatchObject({
      isError: true,
      content: [{ type: 'text', text: 'GitBlocks discovery failed.' }],
    });
    expect(thrownResult).toMatchObject({
      isError: true,
      content: [{ type: 'text', text: 'GitBlocks discovery failed.' }],
    });
    expect(JSON.stringify([contractResult, thrownResult])).not.toContain(
      internalDetail,
    );
  });

  it('preserves the R4 rejection of repository fingerprint requests', async () => {
    const application = await createAcceptedApplication();
    const discoverCapability = vi.fn((input: unknown) =>
      application.discoverCapability(input),
    );
    const { client } = await connectClient({ discoverCapability });
    const result = await client.callTool({
      name: GITBLOCKS_DISCOVER_OSS_TOOL_NAME,
      arguments: capabilityInput({
        id: 'mcp-fingerprint-not-supported',
        term: 'authorization',
        repositoryFingerprintReference: {
          fingerprintId: 'target-fingerprint',
          fingerprintDigest: 'a'.repeat(64),
        },
      }),
    });

    expect(discoverCapability).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      isError: true,
      content: [{ type: 'text', text: 'GitBlocks discovery failed.' }],
    });
  });

  it('keeps the listener loopback-only and rejects non-MCP or non-loopback HTTP authority', async () => {
    const application = await createAcceptedApplication();
    const server = await startGitBlocksMcpHttpServer({
      application,
      port: 0,
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
});

async function connectClient(
  application: Pick<HostedDiscoveryApplicationV1, 'discoverCapability'>,
): Promise<{
  readonly client: Client;
  readonly server: GitBlocksMcpHttpServerV1;
}> {
  const server = await startGitBlocksMcpHttpServer({ application, port: 0 });
  servers.push(server);
  const client = new Client(
    { name: 'gitblocks-hosted-test', version: '0.0.0' },
    { versionNegotiation: { mode: { pin: '2026-07-28' } } },
  );
  clients.push(client);
  await client.connect(
    new StreamableHTTPClientTransport(server.endpoint, {
      fetch: loopbackFetch,
    }),
  );
  return { client, server };
}

function retrievedDigest(value: unknown): string | undefined {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('shortlist' in value) ||
    typeof value.shortlist !== 'object' ||
    value.shortlist === null ||
    !('semanticDigest' in value.shortlist)
  ) {
    return undefined;
  }
  return typeof value.shortlist.semanticDigest === 'string'
    ? value.shortlist.semanticDigest
    : undefined;
}

function rawStatus(
  endpoint: URL,
  path: string,
  headers: Readonly<Record<string, string>> = {},
): Promise<number | undefined> {
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
        response.resume();
        response.once('end', () => {
          resolve(response.statusCode);
        });
      },
    );
    request.once('error', reject);
    request.end();
  });
}
