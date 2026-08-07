import {
  type BaselineCandidateView,
  type BaselineQueryView,
  type BaselineStrategyResult,
} from './contracts.ts';
import { assertStrategyInputs } from './common.ts';

export function runAlwaysAbstainControl(
  query: BaselineQueryView,
  candidates: readonly BaselineCandidateView[],
): BaselineStrategyResult {
  assertStrategyInputs(query, candidates);
  return { results: [], noEligibleCandidate: true };
}
