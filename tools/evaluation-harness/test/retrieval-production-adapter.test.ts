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
      '94313f9b9694bbe7fe5b04307730d8d262236846c3bc8ec01a346f661b56de44',
    );
    expect(generatedV2.predictionSet).toMatchObject({
      predictionSetVersion: 'retrieval-evaluation-prediction-set/2.0.0',
      corpusId: 'retrieval-v2',
      corpusVersion: 'retrieval-evaluation-corpus/2.0.0',
      corpusSemanticDigest:
        '05e03c9b60f05b893b20c9f5687f387f23e5ba5076e96fad1eaec7d01175b12c',
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
          '05e03c9b60f05b893b20c9f5687f387f23e5ba5076e96fad1eaec7d01175b12c',
        independentReviewDigest:
          'c64f49c7a7211b5e0304fd9e568dcd625e669d4f31395d21c815d9fe92f91f20',
        baselineReportDigest:
          '789bee30451d82276b224b1693710fbb66c3722b625c81cbd45b2453a8354140',
      },
      saturationProof: {
        proofDigest:
          '4fde078b679dea3c434f77392b4b2f2a5b0c3a477b383d0699024b6414287921',
      },
      semanticDigest:
        '27550bd7d676a51b98177184b72a6ac11d7ccee350cee1b0d105915b6ce13261',
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
