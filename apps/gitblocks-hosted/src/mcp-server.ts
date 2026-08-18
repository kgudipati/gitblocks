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
  HostedRecommendationFailureCauseCodeV1,
  HostedRecommendationFailurePathV1,
  HostedRecommendationFailureStageV1,
  HostedRecommendationFailureV1,
  HostedRecommendationResultV1,
} from './application.ts';

export const GITBLOCKS_RECOMMEND_OSS_TOOL_NAME = 'recommend_oss';

export const GITBLOCKS_RECOMMEND_OSS_TOOL_DESCRIPTION =
  'Given a structured capability request and a minimized repository fingerprint, GitBlocks deterministically retrieves viable OSS candidates, loads attributable candidate evidence, evaluates codebase-specific fit, and returns up to three validated responsible options. It does not modify the target repository.';

type HostedRecommendationOperation = Pick<
  HostedRecommendationApplicationV1,
  'recommendOss'
>;

export interface HostedRecommendationFailureLogEventV1 {
  readonly operation: 'hosted.recommendation';
  readonly correlationId: string;
  readonly status: 'failed';
  readonly stage: HostedRecommendationFailureStageV1 | 'mcp';
  readonly path: HostedRecommendationFailurePathV1 | 'application-call';
  readonly code:
    HostedRecommendationFailureV1['code'] | 'unexpected-application-error';
  readonly causeCode?: HostedRecommendationFailureCauseCodeV1;
}

export interface HostedRecommendationFailureObserverV1 {
  readonly emit: (event: HostedRecommendationFailureLogEventV1) => void;
}

export function createGitBlocksMcpServer(
  application: HostedRecommendationOperation,
  recommendationFailureObserver?: HostedRecommendationFailureObserverV1,
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
    (arguments_) =>
      callHostedRecommendation(
        application,
        arguments_,
        recommendationFailureObserver,
      ),
  );

  return server;
}

async function callHostedRecommendation(
  application: HostedRecommendationOperation,
  arguments_: OssRecommendationRequestV1,
  recommendationFailureObserver?: HostedRecommendationFailureObserverV1,
): Promise<CallToolResult> {
  try {
    const outcome = await application.recommendOss(arguments_);
    if (!outcome.ok) {
      emitRecommendationFailure(
        recommendationFailureObserver,
        operationFailureEvent(
          arguments_.recommendationRequestId,
          outcome.failure,
        ),
      );
      return boundedToolFailure();
    }
    return successfulToolResult(outcome.result);
  } catch {
    emitRecommendationFailure(
      recommendationFailureObserver,
      Object.freeze({
        operation: 'hosted.recommendation',
        correlationId: arguments_.recommendationRequestId,
        status: 'failed',
        stage: 'mcp',
        path: 'application-call',
        code: 'unexpected-application-error',
        causeCode: 'hosted.internal',
      }),
    );
    return boundedToolFailure();
  }
}

function operationFailureEvent(
  correlationId: string,
  failure: HostedRecommendationFailureV1,
): HostedRecommendationFailureLogEventV1 {
  return Object.freeze({
    operation: 'hosted.recommendation',
    correlationId,
    status: 'failed',
    stage: failure.stage,
    path: failure.path,
    code: failure.code,
    ...('causeCode' in failure ? { causeCode: failure.causeCode } : {}),
  });
}

function emitRecommendationFailure(
  observer: HostedRecommendationFailureObserverV1 | undefined,
  event: HostedRecommendationFailureLogEventV1,
): void {
  try {
    observer?.emit(event);
  } catch {
    // Observability must not alter the bounded client response.
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
