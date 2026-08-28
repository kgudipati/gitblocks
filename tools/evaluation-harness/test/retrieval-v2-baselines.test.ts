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
      'dae6149ce048f04c5fd0c228cfc05ad54d0202e917b6254b0ad76da698e56268',
    );
    expect(first.exactKeyword.semanticDigest).toBe(
      '56d2b0a428abe6d2d4eed23d5f054db7b57021d15d963e4d57077d854f783932',
    );
    expect(first.aliasExpanded.semanticDigest).toBe(
      'b91c951d0131fe8bbd8fc1fdf95157d3c1244b5bc8bdf4046dba663a1df15629',
    );
  }, 120_000);

  it('reproduces the accepted content-free report', () => {
    const report = runRetrievalBaselinesV2(process.cwd()).report;
    expect(report.reportSemanticDigest).toBe(
      '3ea8d00bd2fe09afe23d1989f14d3385d392b515b33ad5c3fd264db69ba7e3d7',
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
          'dae6149ce048f04c5fd0c228cfc05ad54d0202e917b6254b0ad76da698e56268',
        scoreReportDigest:
          'cf769f47e6606a087decab62fe47e5caa0eba8ed47a32878cc1ba1bc0b2ecc21',
        recall: 0.528599,
      },
      {
        baselineId: 'exact-keyword',
        predictionSetDigest:
          '56d2b0a428abe6d2d4eed23d5f054db7b57021d15d963e4d57077d854f783932',
        scoreReportDigest:
          'e19f5a2321f6b05a416a3fc16ddeab275b1db1eaaa8b46119972da7814d26b9e',
        recall: 0.506449,
      },
      {
        baselineId: 'alias-expanded',
        predictionSetDigest:
          'b91c951d0131fe8bbd8fc1fdf95157d3c1244b5bc8bdf4046dba663a1df15629',
        scoreReportDigest:
          '15b63b5d0aad13090a962a297bffc477ab0e8e9f3218066894c5c998daff3b4f',
        recall: 0.608599,
      },
    ]);
  }, 30_000);
});
