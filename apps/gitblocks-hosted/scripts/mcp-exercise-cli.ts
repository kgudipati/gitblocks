import { open } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
  Client,
  StreamableHTTPClientTransport,
} from '@modelcontextprotocol/client';

import {
  readHostedMcpPortConfiguration,
  readHostedMcpTokenConfiguration,
} from '../src/configuration.ts';
import { GITBLOCKS_MCP_HOST, GITBLOCKS_MCP_PATH } from '../src/mcp-http.ts';
import { GITBLOCKS_RECOMMEND_OSS_TOOL_NAME } from '../src/mcp-server.ts';

const EXPECTED_ARGUMENTS = 2;
const REQUEST_FILE_MAX_BYTES = 64 * 1024;

let client: Client | undefined;
try {
  const request = await readRequest(parseRequestPath(process.argv.slice(2)));
  const port = readHostedMcpPortConfiguration(process.env);
  const token = readHostedMcpTokenConfiguration(process.env);
  const endpoint = new URL(
    `http://${GITBLOCKS_MCP_HOST}:${String(port)}${GITBLOCKS_MCP_PATH}`,
  );
  client = new Client(
    { name: 'gitblocks-hosted-local-exercise', version: '0.0.0' },
    { versionNegotiation: { mode: { pin: '2026-07-28' } } },
  );
  await client.connect(
    new StreamableHTTPClientTransport(endpoint, {
      authProvider: { token: () => Promise.resolve(token) },
    }),
  );
  const listed = await client.listTools();
  if (
    client.getProtocolEra() !== 'modern' ||
    listed.tools.length !== 1 ||
    listed.tools[0]?.name !== GITBLOCKS_RECOMMEND_OSS_TOOL_NAME
  ) {
    throw new Error('GitBlocks MCP tool discovery failed.');
  }
  const called = await client.callTool({
    name: GITBLOCKS_RECOMMEND_OSS_TOOL_NAME,
    arguments: request,
  });
  if (called.isError === true) {
    throw new Error('GitBlocks MCP tool call failed.');
  }
  const optionCount = responsibleOptionCount(called.structuredContent);
  process.stdout.write(
    `${JSON.stringify({
      operation: 'hosted-mcp.exercise',
      status: 'complete',
      protocolEra: client.getProtocolEra(),
      toolNames: listed.tools.map(({ name }) => name),
      responsibleOptionCount: optionCount,
    })}\n`,
  );
} catch {
  process.stderr.write(
    '{"operation":"hosted-mcp.exercise","status":"failed","code":"hosted.internal"}\n',
  );
  process.exitCode = 1;
} finally {
  await client?.close().catch(() => undefined);
}

function parseRequestPath(arguments_: readonly string[]): string {
  if (
    arguments_.length !== EXPECTED_ARGUMENTS ||
    arguments_[0] !== '--request' ||
    arguments_[1] === undefined ||
    arguments_[1].length === 0
  ) {
    throw new Error('A bounded request file is required.');
  }
  return resolve(arguments_[1]);
}

async function readRequest(path: string): Promise<Record<string, unknown>> {
  let handle;
  try {
    handle = await open(path, 'r');
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size < 1 || stat.size > REQUEST_FILE_MAX_BYTES) {
      throw new Error('Request file is outside the accepted bound.');
    }
    const value = JSON.parse(await handle.readFile('utf8')) as unknown;
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new Error('Request file must contain a JSON object.');
    }
    return value as Record<string, unknown>;
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

function responsibleOptionCount(value: unknown): number {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('outcome' in value) ||
    value.outcome !== 'recommend' ||
    !('responsibleOptions' in value) ||
    !Array.isArray(value.responsibleOptions) ||
    value.responsibleOptions.length > 3
  ) {
    throw new Error('GitBlocks MCP result was not a bounded recommendation.');
  }
  return value.responsibleOptions.length;
}
