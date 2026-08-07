import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

import {
  retrievalBaselineReportSemanticDigest,
  validateRetrievalBaselineReportV1,
  type RetrievalBaselineReport,
} from '../src/retrieval/baseline-report.ts';
import { writeRetrievalBaselineReportV1 } from '../src/retrieval/baseline-writer.ts';

const report = JSON.parse(
  readFileSync(
    fileURLToPath(
      new URL(
        '../../../verification/retrieval-v1/baseline-report.json',
        import.meta.url,
      ),
    ),
    'utf8',
  ),
) as RetrievalBaselineReport;
const temporaryRoots: string[] = [];

afterAll(() => {
  for (const root of temporaryRoots)
    rmSync(root, { force: true, recursive: true });
});

describe('content-free retrieval baseline report', () => {
  it('validates exact bindings, sections, safety controls, and semantic digest', () => {
    expect(validateRetrievalBaselineReportV1(report)).toEqual([]);
    expect(report.reportSemanticDigest).toBe(
      retrievalBaselineReportSemanticDigest(report),
    );
    expect(
      report.ordinaryBaselines.map(({ baselineId }) => baselineId),
    ).toEqual(['family-only', 'exact-keyword', 'alias-expanded']);
    expect(report.weakControls[0]?.emittedResultCount).toBe(0);
    const safety = report.safetyControls[0]?.safety;
    expect(safety?.hardFilterErrors).toBeGreaterThan(0);
    expect(safety?.top10Violations.conflict).toBeGreaterThan(0);
    expect(safety?.top10Violations.negativeControl).toBeGreaterThan(0);
    expect(safety?.top10Violations.laneError).toBeGreaterThan(0);
  });

  it.each([
    ['query text', { queryInput: 'find authorization tools' }],
    ['case identity', { caseId: 'ret-authorization-05' }],
    ['candidate identity', { candidateId: 'auth-casbin-node-casbin' }],
    ['ordered results', { results: [] }],
    ['reason code', { reasonCode: 'relevant' }],
    ['reviewer', { reviewer: 'person' }],
    ['source URL', { selectionSource: 'https://example.invalid' }],
    ['timestamp', { timestamp: '2026-01-01T00:00:00Z' }],
    ['winner', { winner: 'family-only' }],
    ['per-case score', { perCase: [] }],
  ])('rejects forbidden %s content', (_label, addition) => {
    const value = withDigest({ ...report, ...addition });
    expect(validateRetrievalBaselineReportV1(value).length).toBeGreaterThan(0);
  });

  it('rejects authority, version, section-order, denominator, and digest drift', () => {
    const mutations = [
      withDigest({
        ...report,
        taxonomy: { ...report.taxonomy, semanticDigest: '0'.repeat(64) },
      }),
      withDigest({
        ...report,
        ordinaryBaselines: [...report.ordinaryBaselines].reverse(),
      }),
      withDigest({
        ...report,
        weakControls: report.weakControls.map((control) => ({
          ...control,
          baselineVersion: 'wrong-version',
        })),
      }),
      withDigest({
        ...report,
        weakControls: report.weakControls.map((control) => ({
          ...control,
          aggregateMetrics: {
            ...control.aggregateMetrics,
            micro: {
              ...control.aggregateMetrics.micro,
              exactDuplicateRate: {
                numerator: 0,
                denominator: 0,
                value: 0,
                status: 'applicable',
              },
            },
          },
        })),
      }),
      { ...report, reportSemanticDigest: '0'.repeat(64) },
    ];
    for (const mutation of mutations) {
      expect(
        validateRetrievalBaselineReportV1(mutation).length,
      ).toBeGreaterThan(0);
    }
  });

  it('writes only canonical fixed-path bytes and rejects a symlink target', () => {
    const root = realpathSync(
      mkdtempSync(join(tmpdir(), 'gitblocks-baseline-writer-')),
    );
    temporaryRoots.push(root);
    const parent = join(root, 'verification/retrieval-v1');
    mkdirSync(parent, { recursive: true });
    writeRetrievalBaselineReportV1(root, report);
    const path = join(parent, 'baseline-report.json');
    expect(readdirSync(parent)).toEqual(['baseline-report.json']);
    const first = readFileSync(path);
    writeRetrievalBaselineReportV1(root, report);
    expect(readFileSync(path)).toEqual(first);
    rmSync(path);
    const outside = join(root, 'outside.json');
    writeFileSync(outside, 'unchanged');
    symlinkSync(outside, path);
    expect(() => {
      writeRetrievalBaselineReportV1(root, report);
    }).toThrow('Baseline report path must not be a symbolic link.');
    expect(readFileSync(outside, 'utf8')).toBe('unchanged');
  });

  it('rejects a symlinked report parent alias', () => {
    const root = realpathSync(
      mkdtempSync(join(tmpdir(), 'gitblocks-baseline-parent-')),
    );
    temporaryRoots.push(root);
    mkdirSync(join(root, 'verification'));
    const realParent = join(root, 'real-parent');
    mkdirSync(realParent);
    symlinkSync(realParent, join(root, 'verification/retrieval-v1'));
    expect(() => {
      writeRetrievalBaselineReportV1(root, report);
    }).toThrow('Baseline report parent must be a canonical directory.');
    expect(readdirSync(realParent)).toEqual([]);
  });
});

function withDigest(
  value: Omit<RetrievalBaselineReport, 'reportSemanticDigest'> &
    Partial<Pick<RetrievalBaselineReport, 'reportSemanticDigest'>>,
): unknown {
  const { reportSemanticDigest, ...projection } = value;
  void reportSemanticDigest;
  return {
    ...projection,
    reportSemanticDigest: retrievalBaselineReportSemanticDigest(projection),
  };
}
