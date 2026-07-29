import { canonicalizeJson } from './canonical-json.ts';
import { ingestionError } from './errors.ts';
import {
  isRecord,
  parseBoundedJson,
  type JsonBounds,
} from './json-boundary.ts';
import type {
  IngestionReceipt,
  IngestionReceiptCandidate,
  PublicCatalog,
  TransportMetrics,
} from './types.ts';

const RECEIPT_BOUNDS: JsonBounds = {
  maximumBytes: 1 * 1_024 * 1_024,
  maximumDepth: 10,
  maximumNodes: 20_000,
};

const OUTCOMES = [
  'created',
  'updated',
  'unchanged',
  'partial',
  'failed',
] as const;

export function createIngestionReceipt(input: {
  readonly catalog: PublicCatalog;
  readonly runId: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly candidates: readonly IngestionReceiptCandidate[];
  readonly providerMetrics: TransportMetrics;
  readonly databaseMigrationVersion: number;
  readonly requestedCandidateCount?: number;
  readonly priorReceipt?: IngestionReceipt;
}): IngestionReceipt {
  const candidates = [...input.candidates].sort((left, right) =>
    left.candidateId.localeCompare(right.candidateId),
  );
  const outcomeCounts = {
    created: countOutcome(candidates, 'created'),
    updated: countOutcome(candidates, 'updated'),
    unchanged: countOutcome(candidates, 'unchanged'),
    partial: countOutcome(candidates, 'partial'),
    failed: countOutcome(candidates, 'failed'),
  };
  const failuresByCode = failureCounts(candidates);
  const value = {
    receiptVersion: 'public-ingestion-receipt/1.0.0' as const,
    catalogVersion: input.catalog.catalogVersion,
    catalogDigest: input.catalog.manifestDigest,
    profileRulesVersion: 'public-profile-rules/1.0.0' as const,
    runId: input.runId,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
    requestedCandidateCount:
      input.requestedCandidateCount ?? input.catalog.candidates.length,
    completedCandidateCount: candidates.filter(
      (candidate) => candidate.outcome !== 'failed',
    ).length,
    candidateFamilyProfileCount: candidates.filter(
      (candidate) => candidate.snapshotId !== null,
    ).length,
    providerRequestCounts: input.providerMetrics.providerRequestCounts,
    candidatesCreated: candidates.filter(
      (candidate) => candidate.candidateState === 'created',
    ).length,
    candidatesIdempotent: candidates.filter(
      (candidate) => candidate.candidateState === 'idempotent',
    ).length,
    evidenceCreated: sum(candidates, 'evidenceAppended'),
    evidenceIdempotent: sum(candidates, 'evidenceIdempotent'),
    snapshotsCreated: candidates.filter(
      (candidate) => candidate.snapshotState === 'created',
    ).length,
    snapshotsIdempotent: candidates.filter(
      (candidate) => candidate.snapshotState === 'idempotent',
    ).length,
    supersessionCount: sum(candidates, 'evidenceSuperseded'),
    invalidationCount: sum(candidates, 'evidenceInvalidated'),
    limitationCount: sum(candidates, 'limitationCount'),
    unknownCount: sum(candidates, 'unknownCount'),
    failuresByCode,
    providerRateLimit: input.providerMetrics.githubRateLimit,
    databaseMigrationVersion: input.databaseMigrationVersion,
    idempotencyComparison:
      input.priorReceipt === undefined
        ? null
        : {
            priorReceiptDigest: input.priorReceipt.receiptDigest,
            identicalSnapshotCount: candidates.filter((candidate) => {
              const prior = input.priorReceipt?.candidates.find(
                (entry) => entry.candidateId === candidate.candidateId,
              );
              return (
                candidate.snapshotId !== null &&
                candidate.snapshotId === prior?.snapshotId
              );
            }).length,
            newEvidenceCount: sum(candidates, 'evidenceAppended'),
          },
    outcomeCounts,
    candidates,
  };
  return { ...value, receiptDigest: canonicalizeJson(value).digest };
}

export function parseIngestionReceipt(text: string): IngestionReceipt {
  const parsed = parseBoundedJson(
    text,
    RECEIPT_BOUNDS,
    'ingestion.invalid-receipt',
  );
  if (!isRecord(parsed)) {
    throw ingestionError('ingestion.invalid-receipt');
  }
  requireKeys(parsed, [
    'candidateFamilyProfileCount',
    'candidates',
    'candidatesCreated',
    'candidatesIdempotent',
    'catalogDigest',
    'catalogVersion',
    'completedAt',
    'completedCandidateCount',
    'databaseMigrationVersion',
    'evidenceCreated',
    'evidenceIdempotent',
    'failuresByCode',
    'idempotencyComparison',
    'invalidationCount',
    'limitationCount',
    'outcomeCounts',
    'profileRulesVersion',
    'providerRateLimit',
    'providerRequestCounts',
    'receiptDigest',
    'receiptVersion',
    'requestedCandidateCount',
    'runId',
    'snapshotsCreated',
    'snapshotsIdempotent',
    'startedAt',
    'supersessionCount',
    'unknownCount',
  ]);
  if (
    parsed['receiptVersion'] !== 'public-ingestion-receipt/1.0.0' ||
    parsed['catalogVersion'] !== 'public-v1' ||
    parsed['profileRulesVersion'] !== 'public-profile-rules/1.0.0' ||
    !isDigest(parsed['catalogDigest']) ||
    !isDigest(parsed['receiptDigest']) ||
    !isStableId(parsed['runId']) ||
    !isTimestamp(parsed['startedAt']) ||
    !isTimestamp(parsed['completedAt']) ||
    !Array.isArray(parsed['candidates']) ||
    parsed['candidates'].length > 200 ||
    !Array.isArray(parsed['failuresByCode']) ||
    parsed['failuresByCode'].length > 20 ||
    !isRecord(parsed['outcomeCounts']) ||
    !isRecord(parsed['providerRequestCounts'])
  ) {
    throw ingestionError('ingestion.invalid-receipt');
  }
  for (const field of [
    'requestedCandidateCount',
    'completedCandidateCount',
    'candidateFamilyProfileCount',
    'candidatesCreated',
    'candidatesIdempotent',
    'evidenceCreated',
    'evidenceIdempotent',
    'snapshotsCreated',
    'snapshotsIdempotent',
    'supersessionCount',
    'invalidationCount',
    'limitationCount',
    'unknownCount',
    'databaseMigrationVersion',
  ]) {
    if (!isCount(parsed[field], 100_000)) {
      throw ingestionError('ingestion.invalid-receipt');
    }
  }
  requireKeys(parsed['outcomeCounts'], OUTCOMES);
  requireKeys(parsed['providerRequestCounts'], ['github', 'npm']);
  const outcomeCounts = {
    created: requireCount(parsed['outcomeCounts']['created']),
    updated: requireCount(parsed['outcomeCounts']['updated']),
    unchanged: requireCount(parsed['outcomeCounts']['unchanged']),
    partial: requireCount(parsed['outcomeCounts']['partial']),
    failed: requireCount(parsed['outcomeCounts']['failed']),
  };
  const providerRequestCounts = {
    github: requireCount(parsed['providerRequestCounts']['github'], 10_000),
    npm: requireCount(parsed['providerRequestCounts']['npm'], 1_000),
  };
  const candidates = parsed['candidates'].map(parseReceiptCandidate);
  const failuresByCode = parsed['failuresByCode'].map(parseFailureCount);
  const providerRateLimit = parseRateLimit(parsed['providerRateLimit']);
  const idempotencyComparison = parseComparison(
    parsed['idempotencyComparison'],
  );
  const value = {
    receiptVersion: 'public-ingestion-receipt/1.0.0' as const,
    catalogVersion: 'public-v1' as const,
    catalogDigest: parsed['catalogDigest'],
    profileRulesVersion: 'public-profile-rules/1.0.0' as const,
    runId: parsed['runId'],
    startedAt: parsed['startedAt'],
    completedAt: parsed['completedAt'],
    requestedCandidateCount: parsed['requestedCandidateCount'] as number,
    completedCandidateCount: parsed['completedCandidateCount'] as number,
    candidateFamilyProfileCount: parsed[
      'candidateFamilyProfileCount'
    ] as number,
    providerRequestCounts,
    candidatesCreated: parsed['candidatesCreated'] as number,
    candidatesIdempotent: parsed['candidatesIdempotent'] as number,
    evidenceCreated: parsed['evidenceCreated'] as number,
    evidenceIdempotent: parsed['evidenceIdempotent'] as number,
    snapshotsCreated: parsed['snapshotsCreated'] as number,
    snapshotsIdempotent: parsed['snapshotsIdempotent'] as number,
    supersessionCount: parsed['supersessionCount'] as number,
    invalidationCount: parsed['invalidationCount'] as number,
    limitationCount: parsed['limitationCount'] as number,
    unknownCount: parsed['unknownCount'] as number,
    failuresByCode,
    providerRateLimit,
    databaseMigrationVersion: parsed['databaseMigrationVersion'] as number,
    idempotencyComparison,
    outcomeCounts,
    candidates,
  };
  validateReceiptInvariants(value);
  if (canonicalizeJson(value).digest !== parsed['receiptDigest']) {
    throw ingestionError('ingestion.invalid-receipt');
  }
  return { ...value, receiptDigest: parsed['receiptDigest'] };
}

function parseReceiptCandidate(value: unknown): IngestionReceiptCandidate {
  if (!isRecord(value)) {
    throw ingestionError('ingestion.invalid-receipt');
  }
  requireKeys(value, [
    'candidateId',
    'candidateState',
    'evidenceAppended',
    'evidenceIdempotent',
    'evidenceInvalidated',
    'evidenceSuperseded',
    'incompleteSourceCodes',
    'limitationCount',
    'outcome',
    'safeErrorCode',
    'snapshotId',
    'snapshotState',
    'unknownCount',
  ]);
  if (
    !isStableId(value['candidateId']) ||
    !OUTCOMES.some((outcome) => outcome === value['outcome']) ||
    (value['snapshotId'] !== null && !isStableId(value['snapshotId'])) ||
    (value['candidateState'] !== null &&
      value['candidateState'] !== 'created' &&
      value['candidateState'] !== 'idempotent') ||
    (value['snapshotState'] !== null &&
      value['snapshotState'] !== 'created' &&
      value['snapshotState'] !== 'idempotent') ||
    !Array.isArray(value['incompleteSourceCodes']) ||
    value['incompleteSourceCodes'].length > 20 ||
    value['incompleteSourceCodes'].some((code) => !isStableId(code)) ||
    (value['safeErrorCode'] !== null && !isBoundedCode(value['safeErrorCode']))
  ) {
    throw ingestionError('ingestion.invalid-receipt');
  }
  for (const field of [
    'evidenceAppended',
    'evidenceIdempotent',
    'evidenceInvalidated',
    'evidenceSuperseded',
    'limitationCount',
    'unknownCount',
  ]) {
    if (!isCount(value[field], 100)) {
      throw ingestionError('ingestion.invalid-receipt');
    }
  }
  return {
    candidateId: value['candidateId'],
    outcome: value['outcome'] as IngestionReceiptCandidate['outcome'],
    snapshotId: value['snapshotId'],
    evidenceAppended: value['evidenceAppended'] as number,
    evidenceIdempotent: value['evidenceIdempotent'] as number,
    evidenceSuperseded: value['evidenceSuperseded'] as number,
    evidenceInvalidated: value['evidenceInvalidated'] as number,
    limitationCount: value['limitationCount'] as number,
    unknownCount: value['unknownCount'] as number,
    candidateState: value['candidateState'],
    snapshotState: value['snapshotState'],
    incompleteSourceCodes: value['incompleteSourceCodes'] as string[],
    safeErrorCode: value['safeErrorCode'],
  };
}

function parseFailureCount(value: unknown): {
  readonly code: string;
  readonly count: number;
} {
  if (!isRecord(value)) {
    throw ingestionError('ingestion.invalid-receipt');
  }
  requireKeys(value, ['code', 'count']);
  if (!isBoundedCode(value['code']) || !isCount(value['count'], 200)) {
    throw ingestionError('ingestion.invalid-receipt');
  }
  return { code: value['code'], count: value['count'] };
}

function parseRateLimit(value: unknown): IngestionReceipt['providerRateLimit'] {
  if (value === null) {
    return null;
  }
  if (!isRecord(value)) {
    throw ingestionError('ingestion.invalid-receipt');
  }
  requireKeys(value, ['limit', 'remaining', 'resetAt']);
  if (
    !isCount(value['limit'], 1_000_000_000) ||
    !isCount(value['remaining'], 1_000_000_000) ||
    value['remaining'] > value['limit'] ||
    !isTimestamp(value['resetAt'])
  ) {
    throw ingestionError('ingestion.invalid-receipt');
  }
  return {
    limit: value['limit'],
    remaining: value['remaining'],
    resetAt: value['resetAt'],
  };
}

function parseComparison(
  value: unknown,
): IngestionReceipt['idempotencyComparison'] {
  if (value === null) {
    return null;
  }
  if (!isRecord(value)) {
    throw ingestionError('ingestion.invalid-receipt');
  }
  requireKeys(value, [
    'identicalSnapshotCount',
    'newEvidenceCount',
    'priorReceiptDigest',
  ]);
  if (
    !isDigest(value['priorReceiptDigest']) ||
    !isCount(value['identicalSnapshotCount'], 200) ||
    !isCount(value['newEvidenceCount'], 20_000)
  ) {
    throw ingestionError('ingestion.invalid-receipt');
  }
  return {
    priorReceiptDigest: value['priorReceiptDigest'],
    identicalSnapshotCount: value['identicalSnapshotCount'],
    newEvidenceCount: value['newEvidenceCount'],
  };
}

function validateReceiptInvariants(
  value: Omit<IngestionReceipt, 'receiptDigest'>,
): void {
  if (
    value.candidates.some(
      (candidate, index) =>
        index > 0 &&
        candidate.candidateId.localeCompare(
          value.candidates[index - 1]?.candidateId ?? '',
        ) <= 0,
    ) ||
    Object.values(value.outcomeCounts).reduce(
      (total, count) => total + count,
      0,
    ) !== value.candidates.length ||
    OUTCOMES.some(
      (outcome) =>
        value.outcomeCounts[outcome] !==
        countOutcome(value.candidates, outcome),
    ) ||
    value.completedCandidateCount !==
      value.candidates.filter((candidate) => candidate.outcome !== 'failed')
        .length ||
    value.requestedCandidateCount !== value.candidates.length ||
    value.candidateFamilyProfileCount !==
      value.candidates.filter((candidate) => candidate.snapshotId !== null)
        .length ||
    value.candidatesCreated !==
      value.candidates.filter(
        (candidate) => candidate.candidateState === 'created',
      ).length ||
    value.candidatesIdempotent !==
      value.candidates.filter(
        (candidate) => candidate.candidateState === 'idempotent',
      ).length ||
    value.evidenceCreated !== sum(value.candidates, 'evidenceAppended') ||
    value.evidenceIdempotent !== sum(value.candidates, 'evidenceIdempotent') ||
    value.snapshotsCreated !==
      value.candidates.filter(
        (candidate) => candidate.snapshotState === 'created',
      ).length ||
    value.snapshotsIdempotent !==
      value.candidates.filter(
        (candidate) => candidate.snapshotState === 'idempotent',
      ).length ||
    value.supersessionCount !== sum(value.candidates, 'evidenceSuperseded') ||
    value.invalidationCount !== sum(value.candidates, 'evidenceInvalidated') ||
    value.limitationCount !== sum(value.candidates, 'limitationCount') ||
    value.unknownCount !== sum(value.candidates, 'unknownCount') ||
    canonicalizeJson(value.failuresByCode).digest !==
      canonicalizeJson(failureCounts(value.candidates)).digest ||
    (value.idempotencyComparison !== null &&
      value.idempotencyComparison.newEvidenceCount !== value.evidenceCreated) ||
    Date.parse(value.completedAt) < Date.parse(value.startedAt) ||
    value.candidates.some(
      (candidate) =>
        (candidate.outcome === 'failed' &&
          (candidate.snapshotId !== null ||
            candidate.candidateState !== null ||
            candidate.snapshotState !== null)) ||
        (candidate.outcome !== 'failed' &&
          (candidate.snapshotId === null ||
            candidate.candidateState === null ||
            candidate.snapshotState === null)),
    ) ||
    value.failuresByCode.some(
      (failure, index) =>
        index > 0 &&
        failure.code.localeCompare(
          value.failuresByCode[index - 1]?.code ?? '',
        ) <= 0,
    )
  ) {
    throw ingestionError('ingestion.invalid-receipt');
  }
}

function countOutcome(
  candidates: readonly IngestionReceiptCandidate[],
  outcome: IngestionReceiptCandidate['outcome'],
): number {
  return candidates.filter((candidate) => candidate.outcome === outcome).length;
}

function sum(
  candidates: readonly IngestionReceiptCandidate[],
  field:
    | 'evidenceAppended'
    | 'evidenceIdempotent'
    | 'evidenceSuperseded'
    | 'evidenceInvalidated'
    | 'limitationCount'
    | 'unknownCount',
): number {
  return candidates.reduce((total, candidate) => total + candidate[field], 0);
}

function failureCounts(
  candidates: readonly IngestionReceiptCandidate[],
): readonly { readonly code: string; readonly count: number }[] {
  const counts = new Map<string, number>();
  for (const candidate of candidates) {
    if (candidate.safeErrorCode !== null) {
      counts.set(
        candidate.safeErrorCode,
        (counts.get(candidate.safeErrorCode) ?? 0) + 1,
      );
    }
  }
  return [...counts]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([code, count]) => ({ code, count }));
}

function requireKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): void {
  const actual = Object.keys(value).sort();
  const sorted = [...expected].sort();
  if (
    actual.length !== sorted.length ||
    actual.some((key, index) => key !== sorted[index])
  ) {
    throw ingestionError('ingestion.invalid-receipt');
  }
}

function isTimestamp(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}

function isStableId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= 64 &&
    /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/u.test(value)
  );
}

function isBoundedCode(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= 64 &&
    /^[a-z][a-z0-9.-]*$/u.test(value)
  );
}

function isDigest(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
}

function isCount(value: unknown, maximum: number): value is number {
  return (
    Number.isInteger(value) && Number(value) >= 0 && Number(value) <= maximum
  );
}

function requireCount(value: unknown, maximum = 200): number {
  if (!isCount(value, maximum)) {
    throw ingestionError('ingestion.invalid-receipt');
  }
  return value;
}
