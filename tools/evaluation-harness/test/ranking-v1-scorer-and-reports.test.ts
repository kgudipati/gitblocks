import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { runRankingScorerFixtures } from '../src/ranking/fixtures.ts';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

describe('ranking-v1 scorer and content-free reports', () => {
  it('passes every hand-calculated scorer fixture', () => {
    const summary = runRankingScorerFixtures();
    expect(summary.fixtureCount).toBe(15);
    expect(summary.assertionCount).toBe(34);
    expect(summary.fixtures.map(({ result }) => result)).toEqual(
      Array.from({ length: 15 }, () => 'passed'),
    );
    expect(summary.syntheticOracleOnly).toBe(true);
    expect(summary.productComparator).toBe(false);
  });

  it('publishes only aggregate baseline report state and selects no gate', () => {
    const report = JSON.parse(
      readFileSync(
        join(REPOSITORY_ROOT, 'evals/ranking-v1/reports/baseline-report.json'),
        'utf8',
      ),
    ) as Record<string, unknown>;
    const gates = JSON.parse(
      readFileSync(
        join(
          REPOSITORY_ROOT,
          'evals/ranking-v1/gates/proposed-review-inputs.json',
        ),
        'utf8',
      ),
    ) as {
      qualityGateEvidence: {
        finalThresholds: unknown;
        finalThresholdsSelected: boolean;
      };
      deterministicReadiness: { selected: unknown };
    };
    const forbiddenReportKeys = new Set([
      'candidateId',
      'caseId',
      'evidenceIds',
      'rankGroups',
      'rankRelations',
      'rationaleNotes',
    ]);
    expect(
      collectKeys(report).filter((key) => forbiddenReportKeys.has(key)),
    ).toEqual([]);
    expect(report['finalQualityThresholdSelected']).toBe(false);
    expect(gates.qualityGateEvidence.finalThresholds).toBeNull();
    expect(gates.qualityGateEvidence.finalThresholdsSelected).toBe(false);
    expect(gates.deterministicReadiness.selected).toBeNull();
  });
});

function collectKeys(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(collectKeys);
  if (typeof value !== 'object' || value === null) return [];
  return Object.entries(value).flatMap(([key, child]) => [
    key,
    ...collectKeys(child),
  ]);
}
