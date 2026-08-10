import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { generateRankingBaselinePredictionSets } from '../src/ranking/baselines.ts';
import {
  createRankingStrategyInput,
  loadRankingBlindInputSet,
} from '../src/ranking/blind-input.ts';
import { loadCommittedRankingPredictions } from '../src/ranking/reports.ts';
import { rankingStableJson } from '../src/ranking/stable-json.ts';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

describe('ranking-v1 blind baseline boundary', () => {
  it('reproduces frozen predictions in forward and reverse case order', () => {
    const forward = generateRankingBaselinePredictionSets(REPOSITORY_ROOT);
    const reverse = generateRankingBaselinePredictionSets(
      REPOSITORY_ROOT,
      'reverse',
    );
    const committed = loadCommittedRankingPredictions(REPOSITORY_ROOT);
    expect(rankingStableJson(forward)).toBe(rankingStableJson(reverse));
    expect(rankingStableJson(forward)).toBe(rankingStableJson(committed));
  });

  it('gives the target-blind strategy neither target facts nor case identity', () => {
    const blind = loadRankingBlindInputSet(REPOSITORY_ROOT);
    const first = blind.cases[0];
    expect(first).toBeDefined();
    if (first === undefined) return;
    const input = createRankingStrategyInput(first, false, true);
    expect(input.target).toBeNull();
    expect(Object.keys(input)).not.toContain('caseId');
    expect(rankingStableJson(input)).not.toContain(first.binding.caseId);
  });

  it('keeps ordinary baseline source disconnected from gold and audit loaders', () => {
    const baselineSource = readFileSync(
      join(
        REPOSITORY_ROOT,
        'tools/evaluation-harness/src/ranking/baselines.ts',
      ),
      'utf8',
    );
    const blindLoaderSource = readFileSync(
      join(
        REPOSITORY_ROOT,
        'tools/evaluation-harness/src/ranking/blind-input.ts',
      ),
      'utf8',
    );
    expect(baselineSource).not.toMatch(/from ['"].*(?:corpus|scoring)['"]/u);
    expect(blindLoaderSource).not.toMatch(
      /readJson\([^)]*['"](?:gold|audit|reviews|reports|gates)\//u,
    );
  });
});
