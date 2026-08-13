import {
  getContractSchemaV1,
  type OssRecommendationRequestV1,
} from '@gitblocks/contracts';
import {
  fromJsonSchema,
  McpServer,
  type CallToolResult,
  type JsonSchemaType,
} from '@modelcontextprotocol/server';

import type {
  HostedRecommendationApplicationV1,
  HostedRecommendationResultV1,
} from './application.ts';

export const GITBLOCKS_RECOMMEND_OSS_TOOL_NAME = 'recommend_oss';

export const GITBLOCKS_RECOMMEND_OSS_TOOL_DESCRIPTION =
  'Given a structured capability request and a minimized repository fingerprint, GitBlocks deterministically retrieves viable OSS candidates, loads attributable candidate evidence, evaluates codebase-specific fit, and returns up to three validated responsible options. It does not modify the target repository.';

type HostedRecommendationOperation = Pick<
  HostedRecommendationApplicationV1,
  'recommendOss'
>;

export function createGitBlocksMcpServer(
  application: HostedRecommendationOperation,
): McpServer {
  const server = new McpServer({
    name: 'gitblocks-hosted',
    version: '0.0.0',
  });

  server.registerTool(
    GITBLOCKS_RECOMMEND_OSS_TOOL_NAME,
    {
      description: GITBLOCKS_RECOMMEND_OSS_TOOL_DESCRIPTION,
      inputSchema: fromJsonSchema<OssRecommendationRequestV1>(
        recommendationRequestSchema(),
      ),
    },
    (arguments_) => callHostedRecommendation(application, arguments_),
  );

  return server;
}

async function callHostedRecommendation(
  application: HostedRecommendationOperation,
  arguments_: OssRecommendationRequestV1,
): Promise<CallToolResult> {
  try {
    const outcome = await application.recommendOss(arguments_);
    if (!outcome.ok) return boundedToolFailure();
    return successfulToolResult(outcome.result);
  } catch {
    return boundedToolFailure();
  }
}

function successfulToolResult(
  result: HostedRecommendationResultV1,
): CallToolResult {
  return {
    content: [
      {
        type: 'text',
        text: `GitBlocks recommendation outcome: ${result.outcome}.`,
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
        text: 'GitBlocks recommendation failed.',
      },
    ],
    isError: true,
  };
}

function recommendationRequestSchema(): JsonSchemaType {
  const schema = getContractSchemaV1('oss-recommendation-request');
  if (typeof schema !== 'object' || schema === null || Array.isArray(schema)) {
    throw new TypeError('Recommendation request schema must be an object.');
  }
  return schema as JsonSchemaType;
}
