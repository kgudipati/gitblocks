import {
  compareAscii,
  type BaselineCandidateView,
  type BaselineQueryView,
  type BaselineStrategyResult,
} from './contracts.ts';
import { assertStrategyInputs, runOrdinaryBaseline } from './common.ts';
import { exactCandidateKeys, rawQueryKeys } from './exact-keyword.ts';

interface AliasMatch {
  readonly candidate: BaselineCandidateView;
  readonly referenced: boolean;
  readonly normalizedMatches: number;
  readonly rawMatches: number;
  readonly primaryMatch: boolean;
  readonly additionalMatch: boolean;
}

export function runAliasExpandedBaseline(
  query: BaselineQueryView,
  candidates: readonly BaselineCandidateView[],
): BaselineStrategyResult {
  assertStrategyInputs(query, candidates);
  if (query.caseKind !== 'retrieval') {
    return { results: [], noEligibleCandidate: true };
  }
  const rawKeys = rawQueryKeys(query);
  const normalizedKeys = new Set([
    ...(query.normalizedPrimaryFamily === null
      ? []
      : [query.normalizedPrimaryFamily]),
    ...query.normalizedConceptIds,
    ...query.normalizedConstraints.flatMap(({ conceptId, canonicalTerm }) => [
      ...(conceptId === null ? [] : [conceptId]),
      ...(canonicalTerm === null ? [] : [canonicalTerm]),
    ]),
  ]);
  const references = new Set(query.resolvedCandidateIds);
  const matches = candidates
    .map((candidate): AliasMatch => {
      const keys = exactCandidateKeys(candidate);
      let rawMatches = 0;
      let normalizedMatches = 0;
      for (const key of rawKeys) if (keys.has(key)) rawMatches += 1;
      for (const key of normalizedKeys)
        if (keys.has(key)) normalizedMatches += 1;
      return {
        candidate,
        referenced: references.has(candidate.candidateId),
        normalizedMatches,
        rawMatches,
        primaryMatch: query.normalizedPrimaryFamily === candidate.primaryFamily,
        additionalMatch:
          query.normalizedPrimaryFamily !== null &&
          candidate.additionalFamilies.includes(query.normalizedPrimaryFamily),
      };
    })
    .filter(
      ({ normalizedMatches, rawMatches, referenced }) =>
        normalizedMatches > 0 || rawMatches > 0 || referenced,
    )
    .sort(compareAliasMatches)
    .map(({ candidate }) => candidate);
  return runOrdinaryBaseline(query, candidates, matches);
}

function compareAliasMatches(left: AliasMatch, right: AliasMatch): number {
  return (
    Number(right.referenced) - Number(left.referenced) ||
    right.normalizedMatches - left.normalizedMatches ||
    right.rawMatches - left.rawMatches ||
    Number(right.primaryMatch) - Number(left.primaryMatch) ||
    Number(right.additionalMatch) - Number(left.additionalMatch) ||
    compareAscii(left.candidate.candidateId, right.candidate.candidateId)
  );
}
