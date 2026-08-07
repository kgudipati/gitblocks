import { canonicalizeCapabilityQueryLookupTermV1 } from '@gitblocks/domain';

import {
  compareAscii,
  type BaselineCandidateView,
  type BaselineQueryView,
  type BaselineStrategyResult,
} from './contracts.ts';
import { assertStrategyInputs, runOrdinaryBaseline } from './common.ts';

interface ExactMatch {
  readonly candidate: BaselineCandidateView;
  readonly referenced: boolean;
  readonly rawMatches: number;
  readonly primaryMatch: boolean;
  readonly additionalMatch: boolean;
}

export function runExactKeywordBaseline(
  query: BaselineQueryView,
  candidates: readonly BaselineCandidateView[],
): BaselineStrategyResult {
  assertStrategyInputs(query, candidates);
  if (query.caseKind !== 'retrieval') {
    return { results: [], noEligibleCandidate: true };
  }
  const keys = rawQueryKeys(query);
  const references = new Set(query.resolvedCandidateIds);
  const matches = candidates
    .map((candidate): ExactMatch => {
      const candidateKeys = exactCandidateKeys(candidate);
      let rawMatches = 0;
      for (const key of keys) if (candidateKeys.has(key)) rawMatches += 1;
      return {
        candidate,
        referenced: references.has(candidate.candidateId),
        rawMatches,
        primaryMatch: query.normalizedPrimaryFamily === candidate.primaryFamily,
        additionalMatch:
          query.normalizedPrimaryFamily !== null &&
          candidate.additionalFamilies.includes(query.normalizedPrimaryFamily),
      };
    })
    .filter(({ rawMatches, referenced }) => rawMatches > 0 || referenced)
    .sort(compareExactMatches)
    .map(({ candidate }) => candidate);
  return runOrdinaryBaseline(query, candidates, matches);
}

export function rawQueryKeys(query: BaselineQueryView): ReadonlySet<string> {
  return canonicalKeys([
    ...query.rawStructuredTerms,
    ...query.rawStructuredConstraints.map(({ originalTerm }) => originalTerm),
    ...query.resolvedCandidateIds,
  ]);
}

export function exactCandidateKeys(
  candidate: BaselineCandidateView,
): ReadonlySet<string> {
  return canonicalKeys([
    candidate.candidateId,
    ...candidate.candidateId.split('-'),
    candidate.repositoryOwner,
    candidate.repositoryName,
    `${candidate.repositoryOwner}/${candidate.repositoryName}`,
    ...(candidate.npmPackage === null ? [] : [candidate.npmPackage]),
    candidate.primaryFamily,
    ...candidate.additionalFamilies,
  ]);
}

function canonicalKeys(values: readonly string[]): ReadonlySet<string> {
  const keys = new Set<string>();
  for (const value of values) {
    const result = canonicalizeCapabilityQueryLookupTermV1(value);
    if (result.ok) keys.add(result.value);
  }
  return keys;
}

function compareExactMatches(left: ExactMatch, right: ExactMatch): number {
  return (
    Number(right.referenced) - Number(left.referenced) ||
    right.rawMatches - left.rawMatches ||
    Number(right.primaryMatch) - Number(left.primaryMatch) ||
    Number(right.additionalMatch) - Number(left.additionalMatch) ||
    compareAscii(left.candidate.candidateId, right.candidate.candidateId)
  );
}
