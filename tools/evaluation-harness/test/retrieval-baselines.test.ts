import { beforeAll, describe, expect, it } from 'vitest';

import { generateRetrievalBaselinePredictionSetsV1 } from '../src/retrieval/baseline-generation.ts';
import { runAliasExpandedBaseline } from '../src/retrieval/baselines/alias-expanded.ts';
import { runAlwaysAbstainControl } from '../src/retrieval/baselines/always-abstain.ts';
import { runConstraintViolatingControl } from '../src/retrieval/baselines/constraint-violating.ts';
import {
  assertBaselineCandidateView,
  assertBaselineQueryView,
  type BaselineCandidateView,
  type BaselineQueryView,
} from '../src/retrieval/baselines/contracts.ts';
import { runFamilyOnlyBaseline } from '../src/retrieval/baselines/family-only.ts';
import { runExactKeywordBaseline } from '../src/retrieval/baselines/exact-keyword.ts';
import { retrievalStableJson } from '../src/retrieval/stable-json.ts';
import { runRetrievalFixtureOracle } from '../src/retrieval/synthetic-fixture-oracle.ts';

let generated: ReturnType<typeof generateRetrievalBaselinePredictionSetsV1>;

beforeAll(() => {
  generated = generateRetrievalBaselinePredictionSetsV1();
}, 60_000);

const queryView = (): BaselineQueryView => ({
  caseKind: 'retrieval',
  rawStructuredTerms: [],
  rawStructuredConstraints: [],
  normalizedPrimaryFamily: 'authorization',
  normalizedConceptIds: [],
  normalizedConstraints: [],
  resolvedCandidateIds: [],
});

const candidate = (
  overrides: Partial<BaselineCandidateView> = {},
): BaselineCandidateView => ({
  candidateId: 'authorization-primary',
  primaryFamily: 'authorization',
  additionalFamilies: [],
  catalogStatus: 'active',
  repositoryOwner: 'owner',
  repositoryName: 'repository',
  npmPackage: null,
  hardState: 'satisfied',
  lane: 'eligible',
  ...overrides,
});

describe('retrieval baseline strategy boundary', () => {
  it('rejects identifier and authority leakage into closed strategy views', () => {
    expect(() => {
      assertBaselineQueryView({
        ...queryView(),
        caseId: 'ret-authorization-05',
      } as BaselineQueryView);
    }).toThrow('Baseline query view contains an unapproved field.');
    expect(() => {
      assertBaselineQueryView({
        ...queryView(),
        capabilityFamily: 'authorization',
      } as BaselineQueryView);
    }).toThrow('Baseline query view contains an unapproved field.');
    expect(() => {
      assertBaselineCandidateView({
        ...candidate(),
        rationale: 'untrusted catalog prose',
      } as BaselineCandidateView);
    }).toThrow('Baseline candidate view contains an unapproved field.');
  });

  it('orders primary family before additional family with ASCII ties', () => {
    const result = runFamilyOnlyBaseline(queryView(), [
      candidate({
        candidateId: 'z-additional',
        primaryFamily: 'webhooks',
        additionalFamilies: ['authorization'],
      }),
      candidate({ candidateId: 'z-primary' }),
      candidate({ candidateId: 'a-primary' }),
      candidate({
        candidateId: 'cross-family',
        primaryFamily: 'rate-limiting',
      }),
    ]);

    expect(result).toEqual({
      results: [
        { candidateId: 'a-primary', claimedLane: 'eligible' },
        { candidateId: 'z-primary', claimedLane: 'eligible' },
        { candidateId: 'z-additional', claimedLane: 'eligible' },
      ],
      noEligibleCandidate: false,
    });
  });

  it('uses evidence-needed results only when the safe eligible lane is empty', () => {
    expect(
      runFamilyOnlyBaseline(queryView(), [
        candidate({
          candidateId: 'authorization-unresolved',
          hardState: 'unresolved',
          lane: 'evidence-needed',
        }),
      ]),
    ).toEqual({
      results: [
        {
          candidateId: 'authorization-unresolved',
          claimedLane: 'evidence-needed',
        },
      ],
      noEligibleCandidate: true,
    });
    expect(
      runFamilyOnlyBaseline(queryView(), [
        candidate({
          candidateId: 'authorization-unresolved',
          hardState: 'unresolved',
          lane: 'evidence-needed',
        }),
        candidate({
          candidateId: 'cross-family-eligible',
          primaryFamily: 'webhooks',
        }),
      ]),
    ).toEqual({ results: [], noEligibleCandidate: false });
  });

  it('never emits negative controls or excluded candidates from an ordinary baseline', () => {
    const result = runFamilyOnlyBaseline(queryView(), [
      candidate({ candidateId: 'eligible' }),
      candidate({
        candidateId: 'negative',
        catalogStatus: 'negative-control',
        lane: 'excluded',
      }),
      candidate({
        candidateId: 'conflict',
        hardState: 'conflict',
        lane: 'excluded',
      }),
    ]);
    expect(result.results).toEqual([
      { candidateId: 'eligible', claimedLane: 'eligible' },
    ]);
  });
});

describe('exact-keyword baseline', () => {
  it('matches exact candidate and structured repository/npm references through accepted resolution', () => {
    const exactCandidate = candidate({
      candidateId: 'authorization-casbin',
      repositoryOwner: 'casbin',
      repositoryName: 'node-casbin',
      npmPackage: 'casbin',
    });
    const resolved = {
      ...queryView(),
      rawStructuredTerms: [],
      resolvedCandidateIds: ['authorization-casbin'],
    };
    expect(runExactKeywordBaseline(resolved, [exactCandidate]).results).toEqual(
      [{ candidateId: 'authorization-casbin', claimedLane: 'eligible' }],
    );
    expect(
      runExactKeywordBaseline(
        { ...queryView(), rawStructuredTerms: ['authorization-casbin'] },
        [exactCandidate],
      ).results,
    ).toHaveLength(1);
  });

  it.each([
    ['substring', 'cas'],
    ['stemming', 'casbins'],
    ['fuzzy', 'casbni'],
    ['unicode folding', 'cаsbin'],
    ['alias family fallback', 'authz'],
  ])('does not use %s matching', (_label, term) => {
    expect(
      runExactKeywordBaseline({ ...queryView(), rawStructuredTerms: [term] }, [
        candidate({
          candidateId: 'authorization-casbin',
          repositoryOwner: 'casbin',
          repositoryName: 'node-casbin',
          npmPackage: 'casbin',
        }),
      ]).results,
    ).toEqual([]);
  });
});

describe('alias-expanded baseline', () => {
  it('uses only accepted normalized family and concept output with stable ties', () => {
    const result = runAliasExpandedBaseline(
      {
        ...queryView(),
        rawStructuredTerms: ['authz'],
        normalizedConceptIds: ['authorization'],
      },
      [
        candidate({ candidateId: 'z-authorization' }),
        candidate({ candidateId: 'a-authorization' }),
      ],
    );
    expect(result.results.map(({ candidateId }) => candidateId)).toEqual([
      'a-authorization',
      'z-authorization',
    ]);
    expect(
      runAliasExpandedBaseline(
        {
          ...queryView(),
          normalizedPrimaryFamily: null,
          normalizedConceptIds: ['unrelated-concept'],
        },
        [candidate()],
      ).results,
    ).toEqual([]);
  });
});

describe('retrieval baseline controls and prediction closure', () => {
  it('always abstains without changing the supplied decisions', () => {
    const input = [candidate()];
    const before = retrievalStableJson(input);
    expect(runAlwaysAbstainControl(queryView(), input)).toEqual({
      results: [],
      noEligibleCandidate: true,
    });
    expect(retrievalStableJson(input)).toBe(before);
  });

  it('selects deterministic distinct negative-control and conflict candidates', () => {
    const control = runConstraintViolatingControl(queryView(), [
      candidate({
        candidateId: 'z-negative',
        catalogStatus: 'negative-control',
        lane: 'excluded',
      }),
      candidate({
        candidateId: 'a-negative',
        catalogStatus: 'negative-control',
        lane: 'excluded',
      }),
      candidate({
        candidateId: 'z-conflict',
        hardState: 'conflict',
        lane: 'excluded',
      }),
      candidate({
        candidateId: 'a-conflict',
        hardState: 'conflict',
        lane: 'excluded',
      }),
    ]);
    expect(control.selectedCandidateIds).toEqual(['a-negative', 'a-conflict']);
    expect(control.noEligibleCandidate).toBe(false);
  });

  it('generates frozen complete prediction sets before scoring', () => {
    const predictionSets = [
      generated.familyOnly,
      generated.exactKeyword,
      generated.aliasExpanded,
      generated.alwaysAbstain,
      generated.constraintViolating,
    ];
    for (const predictionSet of predictionSets) {
      expect(predictionSet.predictions).toHaveLength(50);
      expect(Object.isFrozen(predictionSet)).toBe(true);
      for (const prediction of predictionSet.predictions) {
        if (prediction.caseKind === 'retrieval') {
          expect(prediction.candidateDecisions).toHaveLength(150);
          expect(
            new Set(
              prediction.candidateDecisions.map(
                ({ candidateId }) => candidateId,
              ),
            ).size,
          ).toBe(150);
          expect(
            new Set(prediction.results.map(({ candidateId }) => candidateId))
              .size,
          ).toBe(prediction.results.length);
          expect(prediction.results).toHaveLength(
            Math.min(prediction.results.length, 10),
          );
          const laneById = new Map(
            prediction.candidateDecisions.map(({ candidateId, lane }) => [
              candidateId,
              lane,
            ]),
          );
          for (const result of prediction.results) {
            expect(laneById.get(result.candidateId)).toBe(result.claimedLane);
          }
        }
      }
    }
    for (const prediction of generated.alwaysAbstain.predictions) {
      if (prediction.caseKind === 'retrieval') {
        expect(prediction.results).toEqual([]);
        expect(prediction.noEligibleCandidate).toBe(true);
      }
    }
    for (const prediction of generated.constraintViolating.predictions) {
      if (prediction.caseKind === 'retrieval') {
        expect(prediction.results).toHaveLength(2);
        expect(prediction.noEligibleCandidate).toBe(false);
      }
    }
  });

  it('is byte-identical across repeated and reversed-authority generation', () => {
    const repeated = generateRetrievalBaselinePredictionSetsV1();
    const reversed = generateRetrievalBaselinePredictionSetsV1(process.cwd(), {
      authorityOrder: 'reverse',
    });
    expect(retrievalStableJson(repeated)).toBe(retrievalStableJson(generated));
    expect(retrievalStableJson(reversed)).toBe(retrievalStableJson(generated));
  }, 60_000);

  it('keeps the fixture oracle synthetic and exactly perfect', () => {
    const oracle = runRetrievalFixtureOracle();
    expect(oracle).toMatchObject({
      realCorpusUsed: false,
      producedRealPredictionSet: false,
      expectationsSatisfied: true,
      metrics: {
        recallAt10: { value: 1 },
        meanReciprocalRank: { value: 1 },
        ndcgAt10: { value: 1 },
        hardFilterAccuracy: { value: 1 },
      },
    });
  });
});
