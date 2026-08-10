import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  compareCandidateFit,
  createPartialOrderPresentation,
  deriveCandidateFit,
  type DerivedCandidateFit,
} from '../src/ranking/evaluation-rules.ts';
import {
  createRankingStrategyInput,
  loadRankingBlindInputSet,
} from '../src/ranking/blind-input.ts';
import { rankingStableJson } from '../src/ranking/stable-json.ts';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

describe('ranking-v1 baseline comparison semantics', () => {
  it('freezes target-aware tie and result-limit semantics exactly as implemented', () => {
    const authority = JSON.parse(
      readFileSync(
        join(REPOSITORY_ROOT, 'evals/ranking-v1/baselines/specifications.json'),
        'utf8',
      ),
    ) as {
      specifications: readonly {
        baselineId: string;
        baselineVersion: string;
        tieBehavior: string;
        maximumResultBehavior: string;
      }[];
    };
    const specification = authority.specifications.find(
      ({ baselineId }) =>
        baselineId === 'weak-target-aware-exact-compatibility',
    );
    expect(specification).toEqual(
      expect.objectContaining({
        baselineVersion: 'ranking-weak-target-aware-exact-compatibility/3.0.0',
        tieBehavior:
          'Success and preference vectors are ignored after disposition and coverage. Equal preregistered target-compatibility vectors form complete tie groups; independent target-vector trade-offs are incomparable. Candidate ID only canonicalizes members inside an already-derived relation.',
      }),
    );
    expect(specification?.maximumResultBehavior).toContain(
      'omit that layer and every rank relation or incomparable pair involving an omitted candidate',
    );
  });

  it('preserves a partial tie below a unique leader', () => {
    const result = createPartialOrderPresentation(
      [fit('leader', [2]), fit('beta', [1]), fit('alpha', [1])],
      [],
      3,
    );
    expect(result.presentation).toEqual(['leader', 'alpha', 'beta']);
    expect(result.rankGroups).toEqual([['leader'], ['alpha', 'beta']]);
  });

  it('preserves maximal ties and never splits a complete group at the result limit', () => {
    const maximalTie = createPartialOrderPresentation(
      [fit('beta', [2]), fit('alpha', [2]), fit('lower', [1])],
      [],
      3,
    );
    expect(maximalTie.presentation).toEqual(['alpha', 'beta', 'lower']);
    expect(maximalTie.rankGroups[0]).toEqual(['alpha', 'beta']);

    const crossingTie = createPartialOrderPresentation(
      [
        fit('leader', [2]),
        fit('lower-c', [1]),
        fit('lower-a', [1]),
        fit('lower-b', [1]),
      ],
      [],
      3,
    );
    expect(crossingTie.presentation).toEqual(['leader']);

    const oversizedCandidates = [
      fit('d', [2]),
      fit('b', [2]),
      fit('a', [2]),
      fit('c', [2]),
    ];
    for (const permutation of permutations(oversizedCandidates)) {
      const oversizedMaximal = createPartialOrderPresentation(
        permutation,
        [],
        3,
      );
      expect(oversizedMaximal.presentation).toEqual([]);
      expect(oversizedMaximal.rankGroups).toEqual([]);
      expect(oversizedMaximal.rankRelations).toEqual([]);
      expect(oversizedMaximal.incomparablePairs).toEqual([]);
      expect(referencedCandidates(oversizedMaximal).size).toBeLessThanOrEqual(
        3,
      );
    }
  });

  it('omits every ranking reference for a lower layer that crosses the result limit', () => {
    const lowerTie = createPartialOrderPresentation(
      [
        fit('leader', [2]),
        fit('lower-a', [1]),
        fit('lower-b', [1]),
        fit('lower-c', [1]),
      ],
      [],
      3,
    );
    expect(lowerTie.presentation).toEqual(['leader']);
    expect(lowerTie.rankGroups).toEqual([['leader']]);
    expect(lowerTie.rankRelations).toEqual([]);
    expect(lowerTie.incomparablePairs).toEqual([]);
    expect(referencedCandidates(lowerTie).size).toBeLessThanOrEqual(3);

    const lowerIncomparable = createPartialOrderPresentation(
      [
        fit('leader', [2, 2, 2]),
        fit('lower-a', [1, 0, 0]),
        fit('lower-b', [0, 1, 0]),
        fit('lower-c', [0, 0, 1]),
      ],
      [],
      3,
    );
    expect(lowerIncomparable.presentation).toEqual(['leader']);
    expect(lowerIncomparable.rankGroups).toEqual([['leader']]);
    expect(lowerIncomparable.rankRelations).toEqual([]);
    expect(lowerIncomparable.incomparablePairs).toEqual([]);
    expect(referencedCandidates(lowerIncomparable).size).toBeLessThanOrEqual(3);
  });

  it('closes every ranking surface when an incomparable maximal layer exceeds the limit', () => {
    const candidates = [
      fit('candidate-a', [2, 0, 0]),
      fit('candidate-b', [0, 2, 0]),
      fit('candidate-c', [0, 0, 2]),
      fit('candidate-d', [1, 1, 1]),
    ];
    const expected = {
      presentation: [],
      rankGroups: [],
      rankRelations: [],
      incomparablePairs: [],
    };
    for (const permutation of permutations(candidates)) {
      const result = createPartialOrderPresentation(permutation, [], 3);
      expect(result).toEqual(expected);
      expect(referencedCandidates(result).size).toBeLessThanOrEqual(3);
    }
  });

  it('is invariant across all candidate permutations and never uses candidate ID as fit evidence', () => {
    const candidates = [
      fit('candidate-z', [2]),
      fit('candidate-a', [2]),
      fit('candidate-m', [1]),
      fit('candidate-b', [0]),
    ];
    const expected = rankingStableJson(
      createPartialOrderPresentation(candidates, [], 3),
    );
    const allPermutations = permutations(candidates);
    expect(allPermutations).toHaveLength(24);
    for (const permutation of allPermutations) {
      expect(
        rankingStableJson(createPartialOrderPresentation(permutation, [], 3)),
      ).toBe(expected);
    }
    expect(compareCandidateFit(candidates[0]!, candidates[1]!, [])).toBe('tie');

    const source = ['baselines.ts', 'evaluation-rules.ts']
      .map((path) =>
        readFileSync(
          join(REPOSITORY_ROOT, 'tools/evaluation-harness/src/ranking', path),
          'utf8',
        ),
      )
      .join('\n');
    const candidateIds = loadRankingBlindInputSet(
      REPOSITORY_ROOT,
    ).cases.flatMap(({ candidateSet }) =>
      candidateSet.candidates.map(({ candidateId }) => candidateId),
    );
    expect(
      candidateIds.some((candidateId) => source.includes(candidateId)),
    ).toBe(false);
  });

  it('gives no exact-compatibility credit to an undocumented wildcard', () => {
    const resolved = loadRankingBlindInputSet(REPOSITORY_ROOT).cases.find(
      ({ binding }) => binding.caseId === 'rank-auth-01-controlled-a',
    );
    expect(resolved).toBeDefined();
    if (resolved === undefined) return;
    const input = createRankingStrategyInput(resolved, true, true);
    const candidateId = input.candidates[0]?.candidateId;
    expect(candidateId).toBeDefined();
    if (candidateId === undefined) return;
    const evidence = input.candidateEvidence.find(
      (candidate) => candidate.candidateId === candidateId,
    );
    expect(evidence).toBeDefined();
    if (evidence === undefined) return;
    const runtime = evidence.observations.find(
      ({ featureId }) => featureId === 'runtime-support',
    );
    expect(runtime).toBeDefined();
    if (runtime === undefined) return;

    const deriveRuntime = (values: string[]) => {
      const candidateEvidence = input.candidateEvidence.map((candidate) =>
        candidate.candidateId !== candidateId
          ? candidate
          : {
              ...candidate,
              observations: candidate.observations.map((observation) =>
                observation.evidenceId === runtime.evidenceId
                  ? { ...observation, values }
                  : observation,
              ),
            },
      );
      return deriveCandidateFit(
        { ...input, candidateEvidence },
        candidateId,
        true,
      ).targetVector[0];
    };
    expect(deriveRuntime(['*'])).toBe(0);
    expect(deriveRuntime(['universal'])).toBe(1);
    expect(deriveRuntime([input.target!.facts.runtime])).toBe(2);
  });
});

function fit(
  candidateId: string,
  successVector: number[],
): DerivedCandidateFit {
  return {
    candidateId,
    hardConflicts: [],
    resolutions: [],
    coverage: [],
    disposition: 'viable',
    reasonCodes: [],
    evidenceIds: [],
    unknownIds: [],
    hardRuleEvidenceIds: [],
    successEvidenceIds: [],
    preferenceEvidenceIds: new Map(),
    targetEvidenceIds: [],
    successVector,
    preferenceVectors: new Map(),
    targetVector: [],
  };
}

function permutations<Value>(values: readonly Value[]): Value[][] {
  if (values.length === 0) return [[]];
  return values.flatMap((value, index) =>
    permutations(values.filter((_item, itemIndex) => itemIndex !== index)).map(
      (rest) => [value, ...rest],
    ),
  );
}

function referencedCandidates(
  result: ReturnType<typeof createPartialOrderPresentation>,
): Set<string> {
  return new Set([
    ...result.presentation,
    ...result.rankGroups.flat(),
    ...result.rankRelations.flatMap(
      ({ higherCandidateId, lowerCandidateId }) => [
        higherCandidateId,
        lowerCandidateId,
      ],
    ),
    ...result.incomparablePairs.flat(),
  ]);
}
