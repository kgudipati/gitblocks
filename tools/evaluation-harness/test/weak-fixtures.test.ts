import { describe, expect, it } from 'vitest';

import {
  createWeakPredictionSet,
  WEAK_STRATEGIES,
} from '../src/weak-fixtures.ts';
import { scoreCorpus } from '../src/scoring.ts';
import { createCase, createEvidence, createGold } from './test-documents.ts';

describe('weak deterministic fixtures', () => {
  it('produces valid-sized deterministic predictions and distinct profiles', () => {
    const bundle = {
      caseDocument: createCase(),
      evidence: createEvidence(),
      gold: createGold(),
    };
    const reports = WEAK_STRATEGIES.map((strategy) => {
      const predictions = createWeakPredictionSet(strategy, [bundle]);
      return scoreCorpus('pilot-v1', strategy, [bundle], predictions);
    });

    expect(
      new Set(
        reports.map((report) =>
          JSON.stringify({
            disposition: report.aggregate.macroDisposition.f1,
            outcome: report.aggregate.outcomeAccuracy,
            unknown: report.aggregate.unknownRecall,
            unsafe: report.safety.unsafeCount,
          }),
        ),
      ).size,
    ).toBe(WEAK_STRATEGIES.length);
    expect(createWeakPredictionSet('perfect', [bundle])).toEqual(
      createWeakPredictionSet('perfect', [bundle]),
    );
  });
});
