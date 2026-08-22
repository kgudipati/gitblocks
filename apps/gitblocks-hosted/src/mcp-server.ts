import {
  getContractSchemaV1,
  ossRecommendationRequestId,
  type CandidateRetrievalCandidateV1,
  type OssRecommendationRequest,
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
import type { HostedFitModelProviderFailureV1 } from './errors.ts';

export const GITBLOCKS_RECOMMEND_OSS_TOOL_NAME = 'recommend_oss';

export const GITBLOCKS_RECOMMEND_OSS_TOOL_DESCRIPTION =
  'Given a structured capability request and a minimized repository fingerprint, GitBlocks deterministically retrieves OSS candidates without known hard conflicts, loads attributable candidate evidence, evaluates codebase-specific fit, and returns up to three validated responsible options with explicit per-constraint verification status. It does not modify the target repository.';

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
  readonly providerFailure?: HostedFitModelProviderFailureV1;
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
      inputSchema: fromJsonSchema<OssRecommendationRequest>(
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
  arguments_: OssRecommendationRequest,
  recommendationFailureObserver?: HostedRecommendationFailureObserverV1,
): Promise<CallToolResult> {
  try {
    const outcome = await application.recommendOss(arguments_);
    if (!outcome.ok) {
      emitRecommendationFailure(
        recommendationFailureObserver,
        operationFailureEvent(
          ossRecommendationRequestId(arguments_),
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
        correlationId: ossRecommendationRequestId(arguments_),
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
    ...('providerFailure' in failure
      ? { providerFailure: failure.providerFailure }
      : {}),
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
        text: primaryRecommendationText(result.outcome),
      },
    ],
    structuredContent: agentFacingRecommendationResult(result),
  };
}

function primaryRecommendationText(
  outcome: HostedRecommendationResultV1['outcome'],
): string {
  const outcomeText = `GitBlocks recommendation outcome: ${outcome}.`;
  return outcome === 'insufficient-evidence' ||
    outcome === 'unsupported' ||
    outcome === 'no-viable-candidate'
    ? `${outcomeText} GitBlocks validated no candidate; claims obtained from any other source are not GitBlocks results.`
    : outcomeText;
}

function agentFacingRecommendationResult(
  result: HostedRecommendationResultV1,
): Record<string, unknown> {
  if (
    result.outcome !== 'insufficient-evidence' &&
    result.outcome !== 'no-viable-candidate'
  ) {
    return { ...result };
  }
  return {
    ...result,
    shortlist: {
      ...result.shortlist,
      eligibleCandidates: result.shortlist.eligibleCandidates.map(
        agentFacingRetrievalCandidate,
      ),
      evidenceNeededCandidates: result.shortlist.evidenceNeededCandidates.map(
        agentFacingRetrievalCandidate,
      ),
    },
  };
}

function agentFacingRetrievalCandidate(
  candidate: CandidateRetrievalCandidateV1,
): Record<string, unknown> {
  return {
    candidateId: candidate.candidateId,
    ...(candidate.displayName === undefined
      ? {}
      : { displayName: candidate.displayName }),
    ...(candidate.repository === undefined
      ? {}
      : { repository: candidate.repository }),
    ...(candidate.package === undefined ? {} : { package: candidate.package }),
    matchedCapabilityConceptIds: candidate.matchedCapabilityConceptIds,
    matchedProfileFieldIds: candidate.matchedProfileFieldIds,
    channelMatches: candidate.channelMatches,
    lane: candidate.lane,
    unresolvedHardEvaluations: candidate.unresolvedHardEvaluations,
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
