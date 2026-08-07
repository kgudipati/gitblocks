import type { PredictedResult } from '../contracts.ts';
import {
  assertBaselineCandidateView,
  assertBaselineQueryView,
  compareAscii,
  type BaselineCandidateView,
  type BaselineQueryView,
  type BaselineStrategyResult,
} from './contracts.ts';

export function runOrdinaryBaseline(
  query: BaselineQueryView,
  candidates: readonly BaselineCandidateView[],
  orderedMatches: readonly BaselineCandidateView[],
): BaselineStrategyResult {
  assertStrategyInputs(query, candidates);
  const safeCandidates = candidates.filter(
    ({ catalogStatus }) => catalogStatus !== 'negative-control',
  );
  const eligibleCount = safeCandidates.filter(
    ({ lane }) => lane === 'eligible',
  ).length;
  const allowedLane =
    eligibleCount === 0 ? ('evidence-needed' as const) : ('eligible' as const);
  const known = new Map(
    safeCandidates.map((candidate) => [candidate.candidateId, candidate]),
  );
  const seen = new Set<string>();
  const results: PredictedResult[] = [];
  for (const match of orderedMatches) {
    const candidate = known.get(match.candidateId);
    if (
      candidate === undefined ||
      seen.has(candidate.candidateId) ||
      candidate.lane !== allowedLane
    ) {
      continue;
    }
    seen.add(candidate.candidateId);
    results.push({
      candidateId: candidate.candidateId,
      claimedLane: allowedLane,
    });
    if (results.length === 10) break;
  }
  return { results, noEligibleCandidate: eligibleCount === 0 };
}

export function assertStrategyInputs(
  query: BaselineQueryView,
  candidates: readonly BaselineCandidateView[],
): void {
  assertBaselineQueryView(query);
  const seen = new Set<string>();
  for (const candidate of candidates) {
    assertBaselineCandidateView(candidate);
    if (seen.has(candidate.candidateId)) {
      throw new Error(
        'Baseline candidate view contains a duplicate candidate.',
      );
    }
    seen.add(candidate.candidateId);
  }
}

export function sortedCandidates(
  candidates: readonly BaselineCandidateView[],
): BaselineCandidateView[] {
  return [...candidates].sort((left, right) =>
    compareAscii(left.candidateId, right.candidateId),
  );
}
