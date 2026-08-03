import {
  parseModelExecutionV1,
  parseRepositoryInterviewRequestV1,
  parseRepositoryInterviewV1,
  validateRepositoryInterviewExecutionV1,
} from '@gitblocks/contracts';

import type { RepositoryInterviewAuditScopeV1 } from './repository-interview-evaluation-contracts.ts';
import { repositoryInterviewAuditInventoryDigestV1 } from './repository-interview-evaluation-digests.ts';

export function createRepositoryInterviewAuditScopeV1(
  requestValue: unknown,
  executionValue: unknown,
  interviewValue: unknown,
): RepositoryInterviewAuditScopeV1 {
  const request = parseRepositoryInterviewRequestV1(requestValue);
  const execution = parseModelExecutionV1(executionValue);
  const interview = parseRepositoryInterviewV1(interviewValue);
  if (!request.ok || !execution.ok || !interview.ok) throw invalidScope();
  const exchange = validateRepositoryInterviewExecutionV1(
    request.value,
    execution.value,
    interview.value,
  );
  if (!exchange.ok || execution.value.outcome.status !== 'succeeded')
    throw invalidScope();
  const withoutDigest: Omit<
    RepositoryInterviewAuditScopeV1,
    'inventoryDigest'
  > = {
    schemaVersion: '1.0.0',
    candidateId: interview.value.candidateId,
    requestId: request.value.requestId,
    executionId: execution.value.executionId,
    interviewId: interview.value.interviewId,
    requestRecordDigest: request.value.recordDigest,
    executionRecordDigest: execution.value.recordDigest,
    interviewRecordDigest: interview.value.recordDigest,
    claimIds: interview.value.claims.map(({ claimId }) => claimId),
    limitationIds: interview.value.limitations.map(
      ({ limitationId }) => limitationId,
    ),
    contradictionIds: interview.value.contradictions.map(
      ({ contradictionId }) => contradictionId,
    ),
    unknownIds: interview.value.unknowns.map(({ unknownId }) => unknownId),
  };
  return {
    ...withoutDigest,
    inventoryDigest: repositoryInterviewAuditInventoryDigestV1(withoutDigest),
  };
}

function invalidScope(): Error {
  return new Error('Repository interview audit scope input is invalid.');
}
