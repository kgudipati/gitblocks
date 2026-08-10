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

    const oversizedMaximal = createPartialOrderPresentation(
      [fit('d', [2]), fit('b', [2]), fit('a', [2]), fit('c', [2])],
      [],
      3,
    );
    expect(oversizedMaximal.presentation).toEqual([]);
    expect(oversizedMaximal.rankGroups).toEqual([]);
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
