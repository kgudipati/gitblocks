import { describe, expect, it } from 'vitest';

import { findGitBlocksRoot } from '../src/repository-root.ts';
import { generateRetrievalBaselinePredictionSetsV2 } from '../src/retrieval/baseline-generation.ts';
import { runRetrievalBaselinesV2 } from '../src/retrieval/baseline-runner.ts';
import { retrievalStableJson } from '../src/retrieval/stable-json.ts';

describe('retrieval-v2 unchanged baselines', () => {
  it('generates byte-identical predictions repeatedly and under reversed authority order', () => {
    const root = findGitBlocksRoot(process.cwd());
    const first = generateRetrievalBaselinePredictionSetsV2(root);
    const second = generateRetrievalBaselinePredictionSetsV2(root);
    const reversed = generateRetrievalBaselinePredictionSetsV2(root, {
      authorityOrder: 'reverse',
    });
    expect(retrievalStableJson(first)).toBe(retrievalStableJson(second));
    expect(retrievalStableJson(first)).toBe(retrievalStableJson(reversed));
    expect(first.familyOnly.semanticDigest).toBe(
      '58cc659edcb578e8af0acf0f8d9a7a85222573ff8ee1efd90b0b2b424f2908db',
    );
    expect(first.exactKeyword.semanticDigest).toBe(
      '75ec31137b5a7c429175e461b0cea5def007fdfb50f18057d32c4c13ec372751',
    );
    expect(first.aliasExpanded.semanticDigest).toBe(
      '83e0f40a5e507a85f52b068d7a6465f399f2234c93490392997aa5c29025820c',
    );
  }, 120_000);

  it('reproduces the accepted content-free report', () => {
    const report = runRetrievalBaselinesV2(process.cwd()).report;
    expect(report.reportSemanticDigest).toBe(
      '789bee30451d82276b224b1693710fbb66c3722b625c81cbd45b2453a8354140',
    );
    expect(
      report.ordinaryBaselines.map((baseline) => ({
        baselineId: baseline.baselineId,
        predictionSetDigest: baseline.predictionSetDigest,
        scoreReportDigest: baseline.scoreReportDigest,
        recall: baseline.aggregateMetrics.macro['recallAt10']?.value,
      })),
    ).toEqual([
      {
        baselineId: 'family-only',
        predictionSetDigest:
          '58cc659edcb578e8af0acf0f8d9a7a85222573ff8ee1efd90b0b2b424f2908db',
        scoreReportDigest:
          'f515951d5094b7e680335988d90d9fa43a9bcdf8b1299e864123236659f95b54',
        recall: 0.528599,
      },
      {
        baselineId: 'exact-keyword',
        predictionSetDigest:
          '75ec31137b5a7c429175e461b0cea5def007fdfb50f18057d32c4c13ec372751',
        scoreReportDigest:
          'ed82f67ed70d5f5c712ce7fdb21568625dd7be9752484fafcee7d14b455d203c',
        recall: 0.506449,
      },
      {
        baselineId: 'alias-expanded',
        predictionSetDigest:
          '83e0f40a5e507a85f52b068d7a6465f399f2234c93490392997aa5c29025820c',
        scoreReportDigest:
          '269df994a4bd22a417847846f5f8ec39f4588401d9ed1239674f79d0bd7c92fc',
        recall: 0.608599,
      },
    ]);
  }, 30_000);
});
