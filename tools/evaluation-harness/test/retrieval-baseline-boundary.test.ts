import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const BASELINE_ROOT = new URL('../src/retrieval/baselines/', import.meta.url);

describe('retrieval baseline gold isolation', () => {
  it('keeps every strategy module independent from gold and case identity', () => {
    const forbidden = [
      'loadRetrievalCorpusV1',
      'scoring.ts',
      'case-classification',
      'gold/',
      'equivalence.json',
      'caseId',
      'queryInputId',
      'sourceTermId',
      'sourceConstraintId',
      'sourceReferenceId',
      'sourceConditionId',
      'capabilityFamily',
      'summary',
      'successCondition',
    ] as const;

    for (const entry of readdirSync(BASELINE_ROOT)) {
      if (!entry.endsWith('.ts')) continue;
      const source = readFileSync(join(BASELINE_ROOT.pathname, entry), 'utf8');
      for (const token of forbidden) expect(source).not.toContain(token);
    }
  });

  it('keeps blind generation free of full corpus, scoring, and gold imports', () => {
    const source = readFileSync(
      new URL('../src/retrieval/baseline-generation.ts', import.meta.url),
      'utf8',
    );
    const authorityLoad = source.indexOf(
      'const authority = loadSafeAuthority(',
    );
    expect(source.indexOf('loadRetrievalBlindQuerySetV1')).toBeLessThan(
      authorityLoad,
    );
    expect(source.indexOf('loadRetrievalBlindQuerySetV2')).toBeLessThan(
      authorityLoad,
    );
    for (const token of [
      'loadRetrievalCorpusV1',
      "from './scoring.ts'",
      'case-classification',
      'gold/',
      'equivalence.json',
      'rationale',
      'selectionSources',
    ]) {
      expect(source).not.toContain(token);
    }
  });

  it('rejects mutable, locale, clock, random, environment, and network semantics', () => {
    const roots = [
      BASELINE_ROOT,
      new URL('../src/retrieval/baseline-generation.ts', import.meta.url),
    ];
    const sources = roots.flatMap((root) => {
      if (root.pathname.endsWith('.ts')) return [readFileSync(root, 'utf8')];
      return readdirSync(root)
        .filter((entry) => entry.endsWith('.ts'))
        .map((entry) => readFileSync(join(root.pathname, entry), 'utf8'));
    });
    for (const source of sources) {
      for (const token of [
        'localeCompare',
        'Date.now',
        'new Date',
        'Math.random',
        'process.env',
        'fetch(',
        'readdirSync',
      ]) {
        expect(source).not.toContain(token);
      }
    }
  });

  it('keeps the synthetic fixture oracle independent from real authorities', () => {
    const source = readFileSync(
      new URL('../src/retrieval/synthetic-fixture-oracle.ts', import.meta.url),
      'utf8',
    );
    expect(source).not.toContain('loadRetrievalCorpusV1');
    expect(source).not.toContain('loadRetrievalBlindQuerySetV1');
    expect(source).not.toContain('retrieval-v1');
    expect(source).not.toContain('RetrievalPredictionSet');
  });
});
