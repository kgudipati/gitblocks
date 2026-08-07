import type { RetrievalFamily } from '../contracts.ts';
import {
  type BaselineCandidateView,
  type BaselineQueryView,
  type BaselineStrategyResult,
  compareAscii,
} from './contracts.ts';
import { assertStrategyInputs, runOrdinaryBaseline } from './common.ts';

export function runFamilyOnlyBaseline(
  query: BaselineQueryView,
  candidates: readonly BaselineCandidateView[],
): BaselineStrategyResult {
  assertStrategyInputs(query, candidates);
  if (
    query.caseKind !== 'retrieval' ||
    query.normalizedPrimaryFamily === null
  ) {
    return { results: [], noEligibleCandidate: true };
  }
  const family = query.normalizedPrimaryFamily;
  const matches = candidates
    .filter((candidate) => familyMatch(candidate, family) > 0)
    .sort((left, right) => {
      const familyOrder =
        familyMatch(right, family) - familyMatch(left, family);
      return familyOrder || compareAscii(left.candidateId, right.candidateId);
    });
  return runOrdinaryBaseline(query, candidates, matches);
}

function familyMatch(
  candidate: BaselineCandidateView,
  family: RetrievalFamily,
): number {
  return candidate.primaryFamily === family
    ? 2
    : candidate.additionalFamilies.includes(family)
      ? 1
      : 0;
}
