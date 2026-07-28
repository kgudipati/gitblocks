import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { EXIT_CODES, runCli } from '../src/cli.ts';
import { loadCorpus } from '../src/corpus.ts';
import { createWeakPredictionSet } from '../src/weak-fixtures.ts';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

function output() {
  const errors: string[] = [];
  const logs: string[] = [];
  return {
    errors,
    logs,
    writer: {
      error: (message: string) => errors.push(message),
      log: (message: string) => logs.push(message),
    },
  };
}

function temporaryPredictionPath(value: unknown): string {
  const directory = mkdtempSync(join(REPOSITORY_ROOT, '.evaluation-cli-'));
  temporaryDirectories.push(directory);
  const predictionPath = join(directory, 'prediction.json');
  writeFileSync(predictionPath, `${JSON.stringify(value)}\n`);
  return `${basename(directory)}/prediction.json`;
}

function parseJson(value: string): unknown {
  return JSON.parse(value) as unknown;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

describe('evaluation CLI', () => {
  it('validates from a repository subdirectory', () => {
    const capture = output();
    const exitCode = runCli(
      ['validate'],
      join(REPOSITORY_ROOT, 'tools', 'evaluation-harness', 'test'),
      capture.writer,
    );

    expect(exitCode).toBe(EXIT_CODES.success);
    expect(capture.errors).toEqual([]);
    expect(capture.logs).toEqual([
      'Evaluation corpus validation passed (10 cases).',
    ]);
  });

  it('reports deterministic fixture summaries and invalid usage', () => {
    const fixtures = output();
    expect(runCli(['fixtures'], REPOSITORY_ROOT, fixtures.writer)).toBe(
      EXIT_CODES.success,
    );
    const fixtureResult = parseJson(fixtures.logs[0] ?? '{}');
    expect(isRecord(fixtureResult)).toBe(true);
    if (!isRecord(fixtureResult)) {
      return;
    }
    expect(fixtureResult['corpusId']).toBe('pilot-v1');
    const summaries = fixtureResult['summaries'];
    expect(Array.isArray(summaries)).toBe(true);
    if (!Array.isArray(summaries)) {
      return;
    }
    const strategies = summaries
      .filter(isRecord)
      .map((summary) => [summary['strategy'], summary['safe']]);
    expect(strategies).toContainEqual(['perfect', true]);
    expect(strategies).toContainEqual(['all-viable', false]);

    const usage = output();
    expect(runCli([], REPOSITORY_ROOT, usage.writer)).toBe(EXIT_CODES.usage);
    expect(usage.errors[0]).toMatch(/^usage:/u);
  });

  it('scores a valid file and distinguishes validation from boundary failures', () => {
    const corpus = loadCorpus(REPOSITORY_ROOT);
    expect(corpus.ok).toBe(true);
    if (!corpus.ok) {
      return;
    }
    const bundle = corpus.bundles[0];
    expect(bundle).toBeDefined();
    if (bundle === undefined) {
      return;
    }
    const prediction = createWeakPredictionSet('perfect', [bundle])[0];
    const validPath = temporaryPredictionPath(prediction);
    const scored = output();

    expect(
      runCli(
        ['score', '--prediction', validPath],
        REPOSITORY_ROOT,
        scored.writer,
      ),
    ).toBe(EXIT_CODES.success);
    expect(parseJson(scored.logs[0] ?? '{}')).toEqual(
      expect.objectContaining({ caseCount: 1, predictionSetId: 'prediction' }),
    );

    const invalidPath = temporaryPredictionPath({ caseId: 'invalid' });
    const invalid = output();
    expect(
      runCli(
        ['score', '--prediction', invalidPath],
        REPOSITORY_ROOT,
        invalid.writer,
      ),
    ).toBe(EXIT_CODES.validation);
    expect(invalid.errors.length).toBeGreaterThan(0);

    const missing = output();
    expect(
      runCli(
        ['score', '--prediction', 'missing.json'],
        REPOSITORY_ROOT,
        missing.writer,
      ),
    ).toBe(EXIT_CODES.internal);
    expect(missing.errors).toEqual([
      'json.unreadable: JSON file could not be inspected.',
    ]);
  });
});
