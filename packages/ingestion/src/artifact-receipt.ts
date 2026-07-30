import { canonicalizeJson } from './canonical-json.ts';
import { ingestionError } from './errors.ts';
import { isRecord, parseBoundedJson } from './json-boundary.ts';
import type {
  ArtifactReceipt,
  ArtifactReceiptCandidate,
  PublicArtifactManifest,
  PublicCatalog,
  TransportMetrics,
} from './types.ts';

const RECEIPT_MAXIMUM_BYTES = 512 * 1_024;
const ROOT_KEYS = [
  'absenceCount',
  'artifactCount',
  'artifactManifestDigest',
  'artifactManifestVersion',
  'candidates',
  'catalogDigest',
  'catalogVersion',
  'chunkCount',
  'chunkerVersion',
  'collectorVersion',
  'completedAt',
  'completedCandidateCount',
  'databaseMigrationVersion',
  'materializedArtifactBytes',
  'operationalDecodedBytes',
  'failuresByCode',
  'githubRequestCount',
  'inserted',
  'outcomeCounts',
  'providerRateLimit',
  'receiptDigest',
  'receiptVersion',
  'requestedCandidateCount',
  'rerunComparison',
  'runId',
  'startedAt',
] as const;
const CANDIDATE_KEYS = [
  'absenceCount',
  'artifactCount',
  'artifactSetId',
  'candidateId',
  'chunkCount',
  'materializedArtifactBytes',
  'operationalDecodedBytes',
  'inserted',
  'materializationDigest',
  'outcome',
  'safeErrorCode',
] as const;
const INSERTED_KEYS = [
  'artifactSets',
  'artifacts',
  'chunks',
  'entries',
] as const;

export function createArtifactReceipt(input: {
  readonly catalog: PublicCatalog;
  readonly manifest: PublicArtifactManifest;
  readonly runId: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly candidates: readonly ArtifactReceiptCandidate[];
  readonly providerMetrics: TransportMetrics;
  readonly databaseMigrationVersion: number;
  readonly requestedCandidateCount?: number;
  readonly operationalDecodedBytes: number;
  readonly priorReceipt?: ArtifactReceipt;
}): ArtifactReceipt {
  if (
    input.manifest.catalogDigest !== input.catalog.manifestDigest ||
    input.providerMetrics.providerRequestCounts.npm !== 0
  ) {
    throw ingestionError('ingestion.invalid-receipt');
  }
  const candidates = [...input.candidates].sort(compareCandidates);
  validateCandidateCollection(candidates);
  const inserted = sumInserted(candidates);
  const outcomeCounts = {
    created: countOutcome(candidates, 'created'),
    idempotent: countOutcome(candidates, 'idempotent'),
    failed: countOutcome(candidates, 'failed'),
  };
  const value = {
    receiptVersion: 'public-artifact-receipt/1.0.0' as const,
    catalogVersion: input.catalog.catalogVersion,
    catalogDigest: input.catalog.manifestDigest,
    artifactManifestVersion: input.manifest.artifactManifestVersion,
    artifactManifestDigest: input.manifest.manifestDigest,
    collectorVersion: 'repository-artifacts-v1' as const,
    chunkerVersion: 'exact-lines-v1' as const,
    runId: input.runId,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
    requestedCandidateCount:
      input.requestedCandidateCount ?? input.catalog.candidates.length,
    completedCandidateCount: candidates.length - outcomeCounts.failed,
    artifactCount: sum(candidates, 'artifactCount'),
    chunkCount: sum(candidates, 'chunkCount'),
    absenceCount: sum(candidates, 'absenceCount'),
    operationalDecodedBytes: input.operationalDecodedBytes,
    materializedArtifactBytes: sum(candidates, 'materializedArtifactBytes'),
    githubRequestCount: input.providerMetrics.providerRequestCounts.github,
    providerRateLimit: input.providerMetrics.githubRateLimit,
    databaseMigrationVersion: input.databaseMigrationVersion,
    inserted,
    failuresByCode: failureCounts(candidates),
    outcomeCounts,
    rerunComparison:
      input.priorReceipt === undefined
        ? null
        : compareRerun(candidates, input.priorReceipt),
    candidates,
  };
  validateReceipt(value);
  return { ...value, receiptDigest: canonicalizeJson(value).digest };
}

export function parseArtifactReceipt(text: string): ArtifactReceipt {
  const parsed = parseBoundedJson(
    text,
    {
      maximumBytes: RECEIPT_MAXIMUM_BYTES,
      maximumDepth: 10,
      maximumNodes: 10_000,
    },
    'ingestion.invalid-receipt',
  );
  if (!isRecord(parsed)) {
    throw ingestionError('ingestion.invalid-receipt');
  }
  requireKeys(parsed, ROOT_KEYS);
  if (
    parsed['receiptVersion'] !== 'public-artifact-receipt/1.0.0' ||
    parsed['catalogVersion'] !== 'public-v1' ||
    parsed['artifactManifestVersion'] !== 'public-artifacts-v1' ||
    parsed['collectorVersion'] !== 'repository-artifacts-v1' ||
    parsed['chunkerVersion'] !== 'exact-lines-v1' ||
    !isDigest(parsed['catalogDigest']) ||
    !isDigest(parsed['artifactManifestDigest']) ||
    !isDigest(parsed['receiptDigest']) ||
    !isStableId(parsed['runId']) ||
    !isTimestamp(parsed['startedAt']) ||
    !isTimestamp(parsed['completedAt']) ||
    !Array.isArray(parsed['candidates']) ||
    parsed['candidates'].length > 150 ||
    !Array.isArray(parsed['failuresByCode']) ||
    !isRecord(parsed['inserted']) ||
    !isRecord(parsed['outcomeCounts'])
  ) {
    throw ingestionError('ingestion.invalid-receipt');
  }
  const candidates = parsed['candidates'].map(parseCandidate);
  const value = {
    receiptVersion: 'public-artifact-receipt/1.0.0' as const,
    catalogVersion: 'public-v1' as const,
    catalogDigest: parsed['catalogDigest'],
    artifactManifestVersion: 'public-artifacts-v1' as const,
    artifactManifestDigest: parsed['artifactManifestDigest'],
    collectorVersion: 'repository-artifacts-v1' as const,
    chunkerVersion: 'exact-lines-v1' as const,
    runId: parsed['runId'],
    startedAt: parsed['startedAt'],
    completedAt: parsed['completedAt'],
    requestedCandidateCount: requireCount(
      parsed['requestedCandidateCount'],
      150,
    ),
    completedCandidateCount: requireCount(
      parsed['completedCandidateCount'],
      150,
    ),
    artifactCount: requireCount(parsed['artifactCount'], 600),
    chunkCount: requireCount(parsed['chunkCount'], 38_400),
    absenceCount: requireCount(parsed['absenceCount'], 600),
    operationalDecodedBytes: requireCount(
      parsed['operationalDecodedBytes'],
      64 * 1_024 * 1_024,
    ),
    materializedArtifactBytes: requireCount(
      parsed['materializedArtifactBytes'],
      64 * 1_024 * 1_024,
    ),
    githubRequestCount: requireCount(parsed['githubRequestCount'], 10_000),
    providerRateLimit: parseRateLimit(parsed['providerRateLimit']),
    databaseMigrationVersion: requireCount(
      parsed['databaseMigrationVersion'],
      10_000,
    ),
    inserted: parseInserted(parsed['inserted']),
    failuresByCode: parsed['failuresByCode'].map(parseFailure),
    outcomeCounts: parseOutcomeCounts(parsed['outcomeCounts']),
    rerunComparison: parseRerunComparison(parsed['rerunComparison']),
    candidates,
  };
  validateReceipt(value);
  if (canonicalizeJson(value).digest !== parsed['receiptDigest']) {
    throw ingestionError('ingestion.invalid-receipt');
  }
  return { ...value, receiptDigest: parsed['receiptDigest'] };
}

function validateReceipt(value: Omit<ArtifactReceipt, 'receiptDigest'>): void {
  validateCandidateCollection(value.candidates);
  const inserted = sumInserted(value.candidates);
  const outcomeCounts = {
    created: countOutcome(value.candidates, 'created'),
    idempotent: countOutcome(value.candidates, 'idempotent'),
    failed: countOutcome(value.candidates, 'failed'),
  };
  if (
    !isTimestamp(value.startedAt) ||
    !isTimestamp(value.completedAt) ||
    Date.parse(value.completedAt) < Date.parse(value.startedAt) ||
    value.requestedCandidateCount < value.candidates.length ||
    value.completedCandidateCount !==
      value.candidates.length - outcomeCounts.failed ||
    value.artifactCount !== sum(value.candidates, 'artifactCount') ||
    value.chunkCount !== sum(value.candidates, 'chunkCount') ||
    value.absenceCount !== sum(value.candidates, 'absenceCount') ||
    value.operationalDecodedBytes !==
      sum(value.candidates, 'operationalDecodedBytes') ||
    value.materializedArtifactBytes !==
      sum(value.candidates, 'materializedArtifactBytes') ||
    !sameInserted(value.inserted, inserted) ||
    value.outcomeCounts.created !== outcomeCounts.created ||
    value.outcomeCounts.idempotent !== outcomeCounts.idempotent ||
    value.outcomeCounts.failed !== outcomeCounts.failed ||
    value.failuresByCode.length > 20 ||
    canonicalizeJson(value.failuresByCode).text !==
      canonicalizeJson(failureCounts(value.candidates)).text
  ) {
    throw ingestionError('ingestion.invalid-receipt');
  }
}

function validateCandidateCollection(
  candidates: readonly ArtifactReceiptCandidate[],
): void {
  if (
    candidates.length > 150 ||
    new Set(candidates.map(({ candidateId }) => candidateId)).size !==
      candidates.length ||
    candidates.some((candidate, index) => {
      if (
        !isStableId(candidate.candidateId) ||
        (index > 0 &&
          compareText(
            candidates[index - 1]?.candidateId ?? '',
            candidate.candidateId,
          ) >= 0)
      ) {
        return true;
      }
      const insertedRows = insertedRowCount(candidate.inserted);
      if (candidate.outcome === 'failed') {
        return (
          candidate.artifactSetId !== null ||
          candidate.materializationDigest !== null ||
          candidate.safeErrorCode === null ||
          candidate.artifactCount !== 0 ||
          candidate.chunkCount !== 0 ||
          candidate.absenceCount !== 0 ||
          candidate.materializedArtifactBytes !== 0 ||
          insertedRows !== 0
        );
      }
      return (
        candidate.artifactSetId === null ||
        !isStableId(candidate.artifactSetId) ||
        candidate.materializationDigest === null ||
        !isDigest(candidate.materializationDigest) ||
        candidate.safeErrorCode !== null ||
        candidate.artifactCount + candidate.absenceCount < 1 ||
        candidate.artifactCount + candidate.absenceCount > 4 ||
        candidate.chunkCount < candidate.artifactCount ||
        candidate.materializedArtifactBytes > 512 * 1_024 ||
        candidate.operationalDecodedBytes > 64 * 1_024 * 1_024 ||
        (candidate.outcome === 'idempotent' && insertedRows !== 0) ||
        (candidate.outcome === 'created' && insertedRows < 1)
      );
    })
  ) {
    throw ingestionError('ingestion.invalid-receipt');
  }
}

function parseCandidate(value: unknown): ArtifactReceiptCandidate {
  if (!isRecord(value)) {
    throw ingestionError('ingestion.invalid-receipt');
  }
  requireKeys(value, CANDIDATE_KEYS);
  const outcome = value['outcome'];
  if (
    outcome !== 'created' &&
    outcome !== 'idempotent' &&
    outcome !== 'failed'
  ) {
    throw ingestionError('ingestion.invalid-receipt');
  }
  return {
    candidateId: requireStableId(value['candidateId']),
    outcome,
    artifactSetId:
      value['artifactSetId'] === null
        ? null
        : requireStableId(value['artifactSetId']),
    artifactCount: requireCount(value['artifactCount'], 4),
    chunkCount: requireCount(value['chunkCount'], 256),
    absenceCount: requireCount(value['absenceCount'], 4),
    operationalDecodedBytes: requireCount(
      value['operationalDecodedBytes'],
      64 * 1_024 * 1_024,
    ),
    materializedArtifactBytes: requireCount(
      value['materializedArtifactBytes'],
      512 * 1_024,
    ),
    inserted: parseInserted(value['inserted']),
    materializationDigest:
      value['materializationDigest'] === null
        ? null
        : requireDigest(value['materializationDigest']),
    safeErrorCode:
      value['safeErrorCode'] === null
        ? null
        : requireSafeCode(value['safeErrorCode']),
  };
}

function parseInserted(value: unknown): ArtifactReceiptCandidate['inserted'] {
  if (!isRecord(value)) {
    throw ingestionError('ingestion.invalid-receipt');
  }
  requireKeys(value, INSERTED_KEYS);
  return {
    artifacts: requireCount(value['artifacts'], 600),
    chunks: requireCount(value['chunks'], 38_400),
    artifactSets: requireCount(value['artifactSets'], 150),
    entries: requireCount(value['entries'], 600),
  };
}

function parseOutcomeCounts(
  value: Record<string, unknown>,
): ArtifactReceipt['outcomeCounts'] {
  requireKeys(value, ['created', 'failed', 'idempotent']);
  return {
    created: requireCount(value['created'], 150),
    idempotent: requireCount(value['idempotent'], 150),
    failed: requireCount(value['failed'], 150),
  };
}

function parseFailure(value: unknown): {
  readonly code: string;
  readonly count: number;
} {
  if (!isRecord(value)) {
    throw ingestionError('ingestion.invalid-receipt');
  }
  requireKeys(value, ['code', 'count']);
  return {
    code: requireSafeCode(value['code']),
    count: requireCount(value['count'], 150),
  };
}

function parseRateLimit(value: unknown): ArtifactReceipt['providerRateLimit'] {
  if (value === null) {
    return null;
  }
  if (!isRecord(value)) {
    throw ingestionError('ingestion.invalid-receipt');
  }
  requireKeys(value, ['limit', 'remaining', 'resetAt']);
  const limit = requireCount(value['limit'], 1_000_000_000);
  const remaining = requireCount(value['remaining'], limit);
  return { limit, remaining, resetAt: requireTimestamp(value['resetAt']) };
}

function parseRerunComparison(
  value: unknown,
): ArtifactReceipt['rerunComparison'] {
  if (value === null) {
    return null;
  }
  if (!isRecord(value)) {
    throw ingestionError('ingestion.invalid-receipt');
  }
  requireKeys(value, [
    'identicalArtifactSetCount',
    'identicalMaterializationCount',
    'newRowCount',
    'priorReceiptDigest',
    'zeroNewRowCandidateCount',
  ]);
  return {
    priorReceiptDigest: requireDigest(value['priorReceiptDigest']),
    identicalArtifactSetCount: requireCount(
      value['identicalArtifactSetCount'],
      150,
    ),
    identicalMaterializationCount: requireCount(
      value['identicalMaterializationCount'],
      150,
    ),
    zeroNewRowCandidateCount: requireCount(
      value['zeroNewRowCandidateCount'],
      150,
    ),
    newRowCount: requireCount(value['newRowCount'], 40_000),
  };
}

function compareRerun(
  candidates: readonly ArtifactReceiptCandidate[],
  prior: ArtifactReceipt,
): NonNullable<ArtifactReceipt['rerunComparison']> {
  const priorByCandidate = new Map(
    prior.candidates.map((candidate) => [candidate.candidateId, candidate]),
  );
  return {
    priorReceiptDigest: prior.receiptDigest,
    identicalArtifactSetCount: candidates.filter(
      (candidate) =>
        candidate.artifactSetId !== null &&
        candidate.artifactSetId ===
          priorByCandidate.get(candidate.candidateId)?.artifactSetId,
    ).length,
    identicalMaterializationCount: candidates.filter(
      (candidate) =>
        candidate.materializationDigest !== null &&
        candidate.materializationDigest ===
          priorByCandidate.get(candidate.candidateId)?.materializationDigest,
    ).length,
    zeroNewRowCandidateCount: candidates.filter(
      (candidate) =>
        candidate.outcome !== 'failed' &&
        insertedRowCount(candidate.inserted) === 0,
    ).length,
    newRowCount: candidates.reduce(
      (total, candidate) => total + insertedRowCount(candidate.inserted),
      0,
    ),
  };
}

function sumInserted(
  candidates: readonly ArtifactReceiptCandidate[],
): ArtifactReceiptCandidate['inserted'] {
  return {
    artifacts: candidates.reduce(
      (total, candidate) => total + candidate.inserted.artifacts,
      0,
    ),
    chunks: candidates.reduce(
      (total, candidate) => total + candidate.inserted.chunks,
      0,
    ),
    artifactSets: candidates.reduce(
      (total, candidate) => total + candidate.inserted.artifactSets,
      0,
    ),
    entries: candidates.reduce(
      (total, candidate) => total + candidate.inserted.entries,
      0,
    ),
  };
}

function failureCounts(
  candidates: readonly ArtifactReceiptCandidate[],
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
  return [...counts.entries()]
    .sort(([left], [right]) => compareText(left, right))
    .map(([code, count]) => ({ code, count }));
}

function countOutcome(
  candidates: readonly ArtifactReceiptCandidate[],
  outcome: ArtifactReceiptCandidate['outcome'],
): number {
  return candidates.filter((candidate) => candidate.outcome === outcome).length;
}

function sum(
  candidates: readonly ArtifactReceiptCandidate[],
  field:
    | 'artifactCount'
    | 'chunkCount'
    | 'absenceCount'
    | 'operationalDecodedBytes'
    | 'materializedArtifactBytes',
): number {
  return candidates.reduce((total, candidate) => total + candidate[field], 0);
}

function insertedRowCount(
  inserted: ArtifactReceiptCandidate['inserted'],
): number {
  return (
    inserted.artifacts +
    inserted.chunks +
    inserted.artifactSets +
    inserted.entries
  );
}

function sameInserted(
  left: ArtifactReceiptCandidate['inserted'],
  right: ArtifactReceiptCandidate['inserted'],
): boolean {
  return INSERTED_KEYS.every((key) => left[key] === right[key]);
}

function requireKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): void {
  const actual = Object.keys(value).sort(compareText);
  const expected = [...keys].sort(compareText);
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) {
    throw ingestionError('ingestion.invalid-receipt');
  }
}

function requireCount(value: unknown, maximum: number): number {
  if (
    !Number.isSafeInteger(value) ||
    Number(value) < 0 ||
    Number(value) > maximum
  ) {
    throw ingestionError('ingestion.invalid-receipt');
  }
  return Number(value);
}

function requireDigest(value: unknown): string {
  if (!isDigest(value)) {
    throw ingestionError('ingestion.invalid-receipt');
  }
  return value;
}

function requireStableId(value: unknown): string {
  if (!isStableId(value)) {
    throw ingestionError('ingestion.invalid-receipt');
  }
  return value;
}

function requireSafeCode(value: unknown): string {
  if (
    typeof value !== 'string' ||
    value.length < 1 ||
    value.length > 100 ||
    !/^[a-z0-9][a-z0-9.-]*$/u.test(value)
  ) {
    throw ingestionError('ingestion.invalid-receipt');
  }
  return value;
}

function requireTimestamp(value: unknown): string {
  if (!isTimestamp(value)) {
    throw ingestionError('ingestion.invalid-receipt');
  }
  return value;
}

function isDigest(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{64}$/u.test(value);
}

function isStableId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= 64 &&
    /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/u.test(value)
  );
}

function isTimestamp(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}

function compareCandidates(
  left: ArtifactReceiptCandidate,
  right: ArtifactReceiptCandidate,
): number {
  return compareText(left.candidateId, right.candidateId);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
