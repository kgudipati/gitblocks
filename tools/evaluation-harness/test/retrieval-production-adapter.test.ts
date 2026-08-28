import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

import type { RetrievalCasePrediction } from '../src/retrieval/contracts.ts';
import {
  generateProductionRetrievalPredictionSetV1,
  generateProductionRetrievalPredictionSetV2,
  mapProductionResultToEvaluationLane,
  type ProductionRetrievalGenerationArtifactsV1,
} from '../src/retrieval/production-generation.ts';
import { loadCommittedRetrievalV2QualityGates } from '../src/retrieval/quality-gates.ts';
import { retrievalStableJson } from '../src/retrieval/stable-json.ts';

let generated: ProductionRetrievalGenerationArtifactsV1;
let generatedV2: ProductionRetrievalGenerationArtifactsV1;

beforeAll(() => {
  generated = generateProductionRetrievalPredictionSetV1(process.cwd());
  generatedV2 = generateProductionRetrievalPredictionSetV2(process.cwd());
}, 90_000);

describe('production retrieval evaluation adapter differential authority', () => {
  it('matches all 30 complete pre-retrieval lane projections exactly', () => {
    expect(generated.differential).toMatchObject({
      retrievalCasesChecked: 30,
      laneCountMatches: 30,
      eligibleLaneMatches: 30,
      evidenceNeededLaneMatches: 30,
      excludedCandidateLeaks: 0,
      laneClaimDisagreements: 0,
      noEligibleMappingMatches: 30,
      productionInputGoldFieldCount: 0,
    });
    for (const [caseId, result] of generated.productResultsByCase) {
      expect(result.preRetrievalLaneCounts).toEqual(
        generated.generatedProjectionsByCase.get(caseId)?.laneCounts,
      );
    }
  });

  it('maps every returned eligible candidate to satisfied/eligible authority', () => {
    for (const [caseId, result] of generated.productResultsByCase) {
      const decisions = decisionsById(caseId);
      for (const candidate of result.eligibleCandidates) {
        expect(decisions.get(candidate.candidateId)).toMatchObject({
          hardState: 'satisfied',
          lane: 'eligible',
          negativeControl: false,
        });
      }
    }
  });

  it('maps every returned evidence-needed candidate to unresolved/evidence-needed authority', () => {
    for (const [caseId, result] of generated.productResultsByCase) {
      const decisions = decisionsById(caseId);
      for (const candidate of result.evidenceNeededCandidates) {
        expect(decisions.get(candidate.candidateId)).toMatchObject({
          hardState: 'unresolved',
          lane: 'evidence-needed',
          negativeControl: false,
        });
      }
    }
  });

  it('leaks no excluded or negative-control candidate into either product lane', () => {
    for (const [caseId, result] of generated.productResultsByCase) {
      const decisions = decisionsById(caseId);
      for (const candidate of [
        ...result.eligibleCandidates,
        ...result.evidenceNeededCandidates,
      ]) {
        const decision = decisions.get(candidate.candidateId);
        expect(decision?.lane).not.toBe('excluded');
        expect(decision?.negativeControl).toBe(false);
      }
    }
  });

  it('allows no product lane claim to disagree with domain authority', () => {
    for (const [caseId, result] of generated.productResultsByCase) {
      const decisions = decisionsById(caseId);
      for (const candidate of [
        ...result.eligibleCandidates,
        ...result.evidenceNeededCandidates,
      ]) {
        expect(decisions.get(candidate.candidateId)?.lane).toBe(candidate.lane);
      }
    }
  });

  it('derives noEligibleCandidate exclusively from the complete eligible lane count', () => {
    for (const prediction of retrievalPredictions()) {
      const result = generated.productResultsByCase.get(prediction.caseId);
      if (result === undefined) throw new Error('Product result is missing.');
      expect(prediction.noEligibleCandidate).toBe(
        result.preRetrievalLaneCounts.eligible === 0,
      );
    }
  });

  it('keeps nonzero eligible pool plus zero returned eligible results as a retrieval miss', () => {
    const mapped = mapProductionResultToEvaluationLane({
      preRetrievalLaneCounts: {
        eligible: 20,
        'evidence-needed': 10,
        excluded: 120,
      },
      eligibleCandidates: [],
      evidenceNeededCandidates: [],
    });
    expect(mapped).toEqual({
      noEligibleCandidate: false,
      ordinaryResults: [],
    });
  });

  it('uses bounded evidence-needed results only when the complete eligible pool is zero', () => {
    const actual = [...generated.productResultsByCase.values()].find(
      ({ preRetrievalLaneCounts }) => preRetrievalLaneCounts.eligible === 0,
    );
    expect(actual).toBeDefined();
    if (actual === undefined) return;
    const mapped = mapProductionResultToEvaluationLane(actual);
    expect(mapped.noEligibleCandidate).toBe(true);
    expect(mapped.ordinaryResults).toBe(actual.evidenceNeededCandidates);
  });

  it('keeps complete candidate decisions evaluation-side and production input blind to gold', () => {
    for (const prediction of retrievalPredictions()) {
      expect(prediction.candidateDecisions).toHaveLength(150);
      const product = generated.productResultsByCase.get(prediction.caseId);
      expect(product).toBeDefined();
      expect(Object.hasOwn(product ?? {}, 'candidateDecisions')).toBe(false);
      expect(
        (product?.eligibleCandidates.length ?? 0) +
          (product?.evidenceNeededCandidates.length ?? 0),
      ).toBeLessThanOrEqual(20);
    }

    const source = readFileSync(
      fileURLToPath(
        new URL('../src/retrieval/production-generation.ts', import.meta.url),
      ),
      'utf8',
    );
    expect(source).not.toMatch(/from ['"].*\/(?:corpus|scoring)['"]/u);
    expect(source).not.toMatch(/from ['"].*baseline/u);
    expect(source).not.toMatch(/evals\/retrieval-v[12]\/gold/u);
    expect(source).not.toMatch(/relevanceGold|noResultGold|equivalenceGold/u);
  });

  it('freezes predictions before scoring authority can consume them', () => {
    expect(Object.isFrozen(generated.predictionSet)).toBe(true);
    expect(Object.isFrozen(generated.predictionSet.predictions)).toBe(true);
    expect(() => {
      (generated.predictionSet.predictions as unknown as unknown[]).push({});
    }).toThrow();
  });

  it('preserves the frozen v1 prediction and binds the same product output to v2', () => {
    expect(generated.predictionSet.semanticDigest).toBe(
      'd15997c65869c819f80697a3fdbd2ae2dbdd938b10bd46926d16e90b0be77799',
    );
    expect(generatedV2.predictionSet).toMatchObject({
      predictionSetVersion: 'retrieval-evaluation-prediction-set/2.0.0',
      corpusId: 'retrieval-v2',
      corpusVersion: 'retrieval-evaluation-corpus/2.0.0',
      corpusSemanticDigest:
        '2e76715d952b84f3eb124c662ecb0b43acbbe98df1ad5f63b366d5f393a2f84e',
    });
    expect(retrievalStableJson(generated.predictionSet.predictions)).toBe(
      retrievalStableJson(generatedV2.predictionSet.predictions),
    );
    expect(retrievalStableJson([...generated.productResultsByCase])).toBe(
      retrievalStableJson([...generatedV2.productResultsByCase]),
    );
    expect(retrievalStableJson([...generated.generatedProjectionsByCase])).toBe(
      retrievalStableJson([...generatedV2.generatedProjectionsByCase]),
    );
  });

  it('authenticates frozen v2 gates before blind prediction and gold loading', () => {
    const gates = loadCommittedRetrievalV2QualityGates(process.cwd());
    expect(gates).toMatchObject({
      authorityBindings: {
        corpusSemanticDigest:
          '2e76715d952b84f3eb124c662ecb0b43acbbe98df1ad5f63b366d5f393a2f84e',
        independentReviewDigest:
          '78f7cbfbf2f2ce0651ee03a9473961cf56f6370100f838fee8cf14ca9fae2892',
        baselineReportDigest:
          '3ea8d00bd2fe09afe23d1989f14d3385d392b515b33ad5c3fd264db69ba7e3d7',
      },
      saturationProof: {
        proofDigest:
          '7d6322ba1378eaaff2f1ee18207080d470cd3586b3c674aa3d186d64e7cc58f9',
      },
      semanticDigest:
        'be500a5b9b58f1911659e050653f80e122695c83d083b9c9767421c61269b18c',
    });
    const source = readFileSync(
      fileURLToPath(
        new URL('../src/retrieval/production-runner.ts', import.meta.url),
      ),
      'utf8',
    );
    const gatesIndex = source.indexOf(
      'loadCommittedRetrievalV2QualityGates(repositoryRoot)',
    );
    const predictionIndex = source.indexOf(
      'generateProductionRetrievalPredictionSetV2(repositoryRoot',
    );
    const corpusIndex = source.indexOf('loadRetrievalCorpusV2(repositoryRoot)');
    expect(gatesIndex).toBeGreaterThan(0);
    expect(predictionIndex).toBeGreaterThan(gatesIndex);
    expect(corpusIndex).toBeGreaterThan(predictionIndex);
  });

  it('records bounded deterministic initial performance evidence', () => {
    expect(generated.performance).toMatchObject({
      candidateCount: 150,
      activeChannelCount: 6,
      measuredRetrievalQueries: 30,
      maximumCandidatesExamined: 150,
      maximumCandidatesConstraintEvaluated: 150,
      repeatedCallByteIdentity: true,
    });
    expect(generated.performance.maximumReturnedCandidates).toBeLessThanOrEqual(
      20,
    );
  });
});

function retrievalPredictions(): readonly RetrievalCasePrediction[] {
  return generated.predictionSet.predictions.filter(
    (prediction): prediction is RetrievalCasePrediction =>
      prediction.caseKind === 'retrieval',
  );
}

function decisionsById(caseId: string) {
  const projection = generated.generatedProjectionsByCase.get(caseId);
  if (projection === undefined) throw new Error('Projection is missing.');
  return new Map(
    projection.decisions.map((decision) => [decision.candidateId, decision]),
  );
}
