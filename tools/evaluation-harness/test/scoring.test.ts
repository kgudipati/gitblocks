import { describe, expect, it } from 'vitest';

import { scoreCorpus, scoreSingleCase } from '../src/scoring.ts';
import { stableJson } from '../src/stable-json.ts';
import {
  createCase,
  createEvidence,
  createGold,
  createPrediction,
} from './test-documents.ts';

describe('deterministic evaluation scoring', () => {
  it('scores a perfect prediction', () => {
    const score = scoreSingleCase(
      createCase(),
      createGold(),
      createPrediction(),
    );

    expect(score.safety).toEqual({
      safe: true,
      unsafeCount: 0,
      violations: [],
    });
    expect(score.metrics.macroDisposition).toEqual({
      precision: 0.75,
      recall: 0.75,
      f1: 0.75,
    });
    expect(score.metrics.rankingAgreement).toBe(1);
    expect(score.metrics.outcomeAccuracy).toBe(1);
    expect(score.metrics.unknownRecall).toBe(1);
    expect(score.metrics.evidenceRecall).toBe(1);
    expect(score.metrics.reasonRecall).toBe(1);
  });

  it('surfaces unsafe viable or recommended hard conflicts separately', () => {
    const prediction = createPrediction();
    prediction.candidates[2]!.disposition = 'viable';
    prediction.rankGroups.push(['gamma']);

    const score = scoreSingleCase(createCase(), createGold(), prediction);

    expect(score.safety.safe).toBe(false);
    expect(score.safety.unsafeCount).toBe(1);
    expect(score.safety.violations[0]).toEqual({
      caseId: 'authorization-example',
      candidateId: 'gamma',
      reasonCodes: ['tenant-isolation-required'],
    });
  });

  it('uses zero for disposition metric zero denominators', () => {
    const score = scoreSingleCase(
      createCase(),
      createGold(),
      createPrediction(),
    );

    expect(score.metrics.dispositions['insufficient-evidence']).toEqual({
      counts: { truePositive: 0, falsePositive: 0, falseNegative: 0 },
      precision: 0,
      recall: 0,
      f1: 0,
    });
  });

  it('handles ties, partial order, and incomparable pairs', () => {
    const gold = createGold();
    gold.rankGroups = [['alpha', 'beta']];
    gold.incomparablePairs = [['alpha', 'beta']];
    const prediction = createPrediction();
    prediction.rankGroups = [['beta'], ['alpha']];

    expect(
      scoreSingleCase(createCase(), gold, prediction).metrics.rankingAgreement,
    ).toBe(1);

    gold.incomparablePairs = [];
    expect(
      scoreSingleCase(createCase(), gold, prediction).metrics.rankingAgreement,
    ).toBe(0);
  });

  it('scores abstention independently of dispositions', () => {
    const gold = createGold();
    gold.outcome = 'insufficient-evidence';
    gold.allowedAlternativeOutcomes = ['no-viable-candidate'];
    const prediction = createPrediction();
    prediction.outcome = 'no-viable-candidate';

    const metrics = scoreSingleCase(createCase(), gold, prediction).metrics;
    expect(metrics.outcomeAccuracy).toBe(1);
    expect(metrics.outcomeByLabel['insufficient-evidence']).toBe(1);
    expect(metrics.outcomeByLabel['no-viable-candidate']).toBe(0);
  });

  it('scores unknown, evidence, and reason recall by stable ID', () => {
    const prediction = createPrediction();
    prediction.disclosedUnknownIds = [];
    prediction.candidates[1]!.evidenceIds = [];
    prediction.candidates[2]!.reasonCodes = [];

    const metrics = scoreSingleCase(
      createCase(),
      createGold(),
      prediction,
    ).metrics;
    expect(metrics.unknownRecall).toBe(0);
    expect(metrics.evidenceRecall).toBe(0.666667);
    expect(metrics.reasonRecall).toBe(0);
  });

  it('aggregates by family and failure mode with stable serialization', () => {
    const bundle = {
      caseDocument: createCase(),
      evidence: createEvidence(),
      gold: createGold(),
    };
    const report = scoreCorpus(
      'pilot-v1',
      'perfect',
      [bundle],
      [createPrediction()],
    );

    expect(report.aggregate.caseCount).toBe(1);
    expect(report.byFamily.authorization?.caseCount).toBe(1);
    expect(report.byFailureMode['popularity-over-fit']?.caseCount).toBe(1);
    expect(stableJson(report)).toBe(stableJson(report));
    expect(Object.keys(JSON.parse(stableJson(report)) as object)).toEqual([
      'aggregate',
      'byFailureMode',
      'byFamily',
      'caseCount',
      'corpusId',
      'predictionSetId',
      'safety',
      'schemaVersion',
    ]);
  });
});
