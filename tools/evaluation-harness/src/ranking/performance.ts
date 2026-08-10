import { arch, platform, release, totalmem } from 'node:os';

import { rankingStableJson, rankingSemanticDigest } from './stable-json.ts';

export interface RankingPerformanceReference {
  readonly evidenceVersion: 'ranking-v1-performance-reference/1.0.0';
  readonly claimScope: 'gold-blind-evaluation-data-operations-only';
  readonly productionRankingBenchmark: false;
  readonly fixture: {
    readonly candidateCount: 20;
    readonly evidenceCount: 240;
    readonly criterionCount: 40;
    readonly pairCount: 190;
    readonly fixtureBytes: number;
    readonly canonicalOutputBytes: number;
  };
  readonly protocol: {
    readonly warmups: 200;
    readonly measurements: 2000;
    readonly exposedGarbageCollector: boolean;
  };
  readonly latencyMilliseconds: {
    readonly parseValidation: LatencySummary;
    readonly candidateEvidenceTraversal: LatencySummary;
    readonly pairEnumeration: LatencySummary;
    readonly canonicalization: LatencySummary;
    readonly combinedBoundedOperations: LatencySummary;
  };
  readonly retainedMemory: {
    readonly beforeBytes: number;
    readonly afterBytes: number;
    readonly growthBytes: number;
    readonly processHeapUsedBytes: number;
    readonly systemTotalMemoryBytes: number;
  };
  readonly operationCounts: {
    readonly parseObjectsPerMeasurement: 1;
    readonly candidateVisitsPerMeasurement: 20;
    readonly evidenceVisitsPerMeasurement: 240;
    readonly criterionVisitsPerMeasurement: 40;
    readonly pairVisitsPerMeasurement: 190;
    readonly boundedWorkProved: true;
  };
  readonly runtime: {
    readonly node: string;
    readonly platform: string;
    readonly release: string;
    readonly architecture: string;
  };
  readonly marginProtocol: {
    readonly status: 'proposed-for-independent-review';
    readonly finalBudgetSelected: false;
    readonly proposal: string;
  };
  readonly semanticDigest: string;
}

interface LatencySummary {
  readonly p50: number;
  readonly p95: number;
  readonly maximum: number;
}

export function measureRankingPerformanceReference(): RankingPerformanceReference {
  const fixture = createMaximumFixture();
  const bytes = rankingStableJson(fixture);
  const operations = [
    () => parseValidation(bytes),
    () => traverse(fixture),
    () => enumeratePairs(fixture.candidates),
    () => rankingStableJson(fixture),
  ] as const;
  for (let index = 0; index < 200; index += 1) {
    for (const operation of operations) operation();
  }
  const garbageCollector = globalThis.gc;
  if (garbageCollector !== undefined) garbageCollector();
  const beforeBytes = process.memoryUsage().heapUsed;
  const measurements: number[][] = operations.map(() => []);
  const combined: number[] = [];
  for (let index = 0; index < 2000; index += 1) {
    const combinedStart = performance.now();
    operations.forEach((operation, operationIndex) => {
      const started = performance.now();
      operation();
      measurements[operationIndex]?.push(performance.now() - started);
    });
    combined.push(performance.now() - combinedStart);
  }
  if (garbageCollector !== undefined) garbageCollector();
  const afterBytes = process.memoryUsage().heapUsed;
  const withoutDigest = {
    evidenceVersion: 'ranking-v1-performance-reference/1.0.0' as const,
    claimScope: 'gold-blind-evaluation-data-operations-only' as const,
    productionRankingBenchmark: false as const,
    fixture: {
      candidateCount: 20 as const,
      evidenceCount: 240 as const,
      criterionCount: 40 as const,
      pairCount: 190 as const,
      fixtureBytes: Buffer.byteLength(bytes),
      canonicalOutputBytes: Buffer.byteLength(rankingStableJson(fixture)),
    },
    protocol: {
      warmups: 200 as const,
      measurements: 2000 as const,
      exposedGarbageCollector: garbageCollector !== undefined,
    },
    latencyMilliseconds: {
      parseValidation: summarize(measurements[0] ?? []),
      candidateEvidenceTraversal: summarize(measurements[1] ?? []),
      pairEnumeration: summarize(measurements[2] ?? []),
      canonicalization: summarize(measurements[3] ?? []),
      combinedBoundedOperations: summarize(combined),
    },
    retainedMemory: {
      beforeBytes,
      afterBytes,
      growthBytes: Math.max(0, afterBytes - beforeBytes),
      processHeapUsedBytes: process.memoryUsage().heapUsed,
      systemTotalMemoryBytes: totalmem(),
    },
    operationCounts: {
      parseObjectsPerMeasurement: 1 as const,
      candidateVisitsPerMeasurement: 20 as const,
      evidenceVisitsPerMeasurement: 240 as const,
      criterionVisitsPerMeasurement: 40 as const,
      pairVisitsPerMeasurement: 190 as const,
      boundedWorkProved: true as const,
    },
    runtime: {
      node: process.version,
      platform: platform(),
      release: release(),
      architecture: arch(),
    },
    marginProtocol: {
      status: 'proposed-for-independent-review' as const,
      finalBudgetSelected: false as const,
      proposal:
        'An independent reviewer should select a multiplier only after repeating this reference on the supported CI class, separating parse/traversal/pair/canonicalization ceilings, reserving explicit regression and runtime-noise margins, and declining to reinterpret these evaluation-only measurements as production ranker latency.',
    },
  };
  return {
    ...withoutDigest,
    semanticDigest: rankingSemanticDigest(withoutDigest),
  };
}

function createMaximumFixture() {
  const criteria = Array.from({ length: 40 }, (_, index) => ({
    criterionId: `criterion-${String(index).padStart(2, '0')}`,
    state: index % 3 === 0 ? 'bound' : 'unbound',
  }));
  const candidates = Array.from({ length: 20 }, (_, candidateIndex) => ({
    candidateId: `candidate-${String(candidateIndex).padStart(2, '0')}`,
    evidence: Array.from({ length: 12 }, (_, evidenceIndex) => ({
      evidenceId: `evidence-${String(candidateIndex).padStart(2, '0')}-${String(evidenceIndex).padStart(2, '0')}`,
      feature: `feature-${String(evidenceIndex).padStart(2, '0')}`,
      value: `value-${String((candidateIndex + evidenceIndex) % 7)}`,
    })),
  }));
  return {
    fixtureVersion: 'ranking-v1-maximum-gold-blind/1.0.0',
    criteria,
    candidates,
  };
}

function parseValidation(bytes: string): number {
  const value = JSON.parse(bytes) as {
    candidates?: unknown[];
    criteria?: unknown[];
  };
  if (value.candidates?.length !== 20 || value.criteria?.length !== 40) {
    throw new Error('Maximum fixture parse validation failed.');
  }
  return value.candidates.length + value.criteria.length;
}

function traverse(fixture: ReturnType<typeof createMaximumFixture>): number {
  let visits = 0;
  for (const candidate of fixture.candidates) {
    visits += 1;
    for (const evidence of candidate.evidence) {
      visits += evidence.evidenceId.length > 0 ? 1 : 0;
    }
  }
  for (const criterion of fixture.criteria) {
    visits += criterion.criterionId.length > 0 ? 1 : 0;
  }
  if (visits !== 300) throw new Error('Maximum fixture traversal drifted.');
  return visits;
}

function enumeratePairs(
  candidates: ReturnType<typeof createMaximumFixture>['candidates'],
): number {
  let count = 0;
  for (let left = 0; left < candidates.length; left += 1) {
    for (let right = left + 1; right < candidates.length; right += 1) {
      if (candidates[left] === undefined || candidates[right] === undefined) {
        throw new Error('Maximum fixture pair is missing.');
      }
      count += 1;
    }
  }
  if (count !== 190) throw new Error('Maximum fixture pair count drifted.');
  return count;
}

function summarize(values: readonly number[]): LatencySummary {
  if (values.length !== 2000)
    throw new Error('Performance sample count drifted.');
  const sorted = [...values].sort((left, right) => left - right);
  return {
    p50: round(sorted[Math.ceil(sorted.length * 0.5) - 1] ?? 0),
    p95: round(sorted[Math.ceil(sorted.length * 0.95) - 1] ?? 0),
    maximum: round(sorted.at(-1) ?? 0),
  };
}

function round(value: number): number {
  return Number(value.toFixed(6));
}
