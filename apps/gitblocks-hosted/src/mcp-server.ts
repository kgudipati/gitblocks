import {
  getContractSchemaV1,
  type CapabilityQueryInputV1,
} from '@gitblocks/contracts';
import {
  fromJsonSchema,
  McpServer,
  type CallToolResult,
  type JsonSchemaType,
} from '@modelcontextprotocol/server';

import type {
  HostedDiscoveryApplicationV1,
  HostedDiscoveryResultV1,
} from './application.ts';

export const GITBLOCKS_DISCOVER_OSS_TOOL_NAME = 'discover_oss';

export const GITBLOCKS_DISCOVER_OSS_TOOL_DESCRIPTION =
  "Retrieve plausible open-source candidates for a structured capability request using GitBlocks' deterministic catalog intelligence. Returns a shortlist, not a final adoption recommendation. Does not inspect or modify the caller's local repository.";

type HostedDiscoveryOperation = Pick<
  HostedDiscoveryApplicationV1,
  'discoverCapability'
>;

export function createGitBlocksMcpServer(
  application: HostedDiscoveryOperation,
): McpServer {
  const server = new McpServer({
    name: 'gitblocks-hosted',
    version: '0.0.0',
  });

  server.registerTool(
    GITBLOCKS_DISCOVER_OSS_TOOL_NAME,
    {
      description: GITBLOCKS_DISCOVER_OSS_TOOL_DESCRIPTION,
      inputSchema: fromJsonSchema<CapabilityQueryInputV1>(
        capabilityQueryInputSchema(),
      ),
    },
    (arguments_) => callHostedDiscovery(application, arguments_),
  );

  return server;
}

function callHostedDiscovery(
  application: HostedDiscoveryOperation,
  arguments_: CapabilityQueryInputV1,
): CallToolResult {
  try {
    const outcome = application.discoverCapability(arguments_);
    if (!outcome.ok) return boundedToolFailure();
    return successfulToolResult(outcome.result);
  } catch {
    return boundedToolFailure();
  }
}

function successfulToolResult(result: HostedDiscoveryResultV1): CallToolResult {
  return {
    content: [
      {
        type: 'text',
        text: `GitBlocks discovery outcome: ${result.outcome}.`,
      },
    ],
    structuredContent: result,
  };
}

function boundedToolFailure(): CallToolResult {
  return {
    content: [
      {
        type: 'text',
        text: 'GitBlocks discovery failed.',
      },
    ],
    isError: true,
  };
}

function capabilityQueryInputSchema(): JsonSchemaType {
  const schema = getContractSchemaV1('capability-query-input');
  if (typeof schema !== 'object' || schema === null || Array.isArray(schema)) {
    throw new TypeError('Capability query input schema must be an object.');
  }
  return schema as JsonSchemaType;
}
