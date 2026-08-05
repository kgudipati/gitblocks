import {
  type BaselineCandidateView,
  type BaselineQueryView,
  type BaselineStrategyResult,
  compareAscii,
} from './contracts.ts';
import { assertStrategyInputs } from './common.ts';

export interface ConstraintViolatingSelection extends BaselineStrategyResult {
  readonly selectedCandidateIds: readonly [string, string];
}

export function runConstraintViolatingControl(
  query: BaselineQueryView,
  candidates: readonly BaselineCandidateView[],
): ConstraintViolatingSelection {
  assertStrategyInputs(query, candidates);
  if (query.caseKind !== 'retrieval') {
    throw new Error('Constraint-violating control requires a retrieval query.');
  }
  const ordered = [...candidates].sort((left, right) =>
    compareAscii(left.candidateId, right.candidateId),
  );
  const negative = ordered.find(
    ({ catalogStatus }) => catalogStatus === 'negative-control',
  );
  const conflict = ordered.find(
    ({ catalogStatus, hardState }) =>
      catalogStatus !== 'negative-control' && hardState === 'conflict',
  );
  if (negative === undefined || conflict === undefined) {
    throw new Error(
      'Constraint-violating control authority is missing distinct candidates.',
    );
  }
  return {
    selectedCandidateIds: [negative.candidateId, conflict.candidateId],
    results: [negative, conflict].map(({ candidateId }) => ({
      candidateId,
      claimedLane: 'eligible' as const,
    })),
    noEligibleCandidate: false,
  };
}
