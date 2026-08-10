import { arch, platform, release, totalmem } from 'node:os';

import { rankingStableJson, rankingSemanticDigest } from './stable-json.ts';

export interface RankingPerformanceReference {
  readonly evidenceVersion: 'ranking-v1-performance-reference/2.0.0';
  readonly claimScope: 'gold-blind-evaluation-data-operations-only';
  readonly productionRankingBenchmark: false;
  readonly fixture: {
    readonly candidateCount: 20;
    readonly evidenceCount: 2000;
    readonly criterionCount: 60;
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
    readonly evidenceVisitsPerMeasurement: 2000;
    readonly criterionVisitsPerMeasurement: 60;
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
    evidenceVersion: 'ranking-v1-performance-reference/2.0.0' as const,
    claimScope: 'gold-blind-evaluation-data-operations-only' as const,
    productionRankingBenchmark: false as const,
    fixture: {
      candidateCount: 20 as const,
      evidenceCount: 2000 as const,
      criterionCount: 60 as const,
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
      evidenceVisitsPerMeasurement: 2000 as const,
      criterionVisitsPerMeasurement: 60 as const,
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
        'An independent reviewer should repeat this maximum-legal reference on the supported CI class, establish separate ceilings for parse, traversal, pair enumeration, canonicalization, and combined work, apply an explicit runtime-noise and regression margin, and decline to reinterpret the result as production ranking latency.',
    },
  };
  return {
    ...withoutDigest,
    semanticDigest: rankingSemanticDigest(withoutDigest),
  };
}

function createMaximumFixture() {
  const criteria = Array.from({ length: 60 }, (_, index) => ({
    criterionId: `criterion-${String(index).padStart(2, '0')}`,
    kind:
      index < 20
        ? 'success-condition'
        : index < 40
          ? 'hard-constraint'
          : 'preference',
    bindingState: index % 7 === 0 ? 'unbound' : 'bound',
    semanticFacet: `facet-${String(index % 12).padStart(2, '0')}`,
    comparisonRuleId:
      index % 3 === 0
        ? 'candidate-has-all/1.0.0'
        : 'candidate-target-match/1.0.0',
    candidateFeatureDependencies: [
      `feature-${String(index % 25).padStart(2, '0')}`,
    ],
    targetFactDependencies: [
      ['runtime', 'framework', 'resources', 'data-policy'][index % 4],
    ],
  }));
  const candidates = Array.from({ length: 20 }, (_, candidateIndex) => ({
    candidateId: `candidate-${String(candidateIndex).padStart(2, '0')}`,
    evidence: Array.from({ length: 100 }, (_, evidenceIndex) => ({
      evidenceId: `evidence-${String(candidateIndex).padStart(2, '0')}-${String(evidenceIndex).padStart(3, '0')}`,
      candidateId: `candidate-${String(candidateIndex).padStart(2, '0')}`,
      featureId: `feature-${String(evidenceIndex % 25).padStart(2, '0')}`,
      state: evidenceIndex % 19 === 0 ? 'unknown' : 'known',
      values:
        evidenceIndex % 19 === 0
          ? []
          : [
              `value-${String((candidateIndex + evidenceIndex) % 17)}`,
              `value-${String((candidateIndex * 3 + evidenceIndex) % 17)}`,
            ],
      completeness: evidenceIndex % 11 === 0 ? 'partial' : 'complete',
      provenance: {
        kind: 'evaluation-owned-bounded-fixture',
        claimScope: 'scenario-synthetic-not-project-authority',
        productionAuthority: false,
      },
    })),
  }));
  return {
    fixtureVersion: 'ranking-v1-maximum-gold-blind/2.0.0',
    request: {
      successConditionCount: 20,
      hardConstraintCount: 20,
      preferenceCount: 20,
      requestedMaximumResults: 3,
    },
    target: {
      runtime: 'node',
      framework: 'fastify',
      resources: ['postgres', 'redis', 'worker', 'stdout-collector'],
      dataPolicies: ['regional-processing', 'sensitive-field-exclusion'],
      withheldCategories: ['identity-detail'],
    },
    criteria,
    candidates,
  };
}

function parseValidation(bytes: string): number {
  const value = JSON.parse(bytes) as {
    candidates?: { evidence?: unknown[] }[];
    criteria?: unknown[];
  };
  const evidenceCount =
    value.candidates?.reduce(
      (sum, candidate) => sum + (candidate.evidence?.length ?? 0),
      0,
    ) ?? 0;
  if (
    value.candidates?.length !== 20 ||
    value.criteria?.length !== 60 ||
    evidenceCount !== 2000
  ) {
    throw new Error('Maximum fixture parse validation failed.');
  }
  return value.candidates.length + value.criteria.length + evidenceCount;
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
  if (visits !== 2080) throw new Error('Maximum fixture traversal drifted.');
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
  if (values.length !== 2000) {
    throw new Error('Performance sample count drifted.');
  }
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
