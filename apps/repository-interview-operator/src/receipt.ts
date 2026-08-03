import {
  canonicalizeJson,
  serializeCanonicalJson,
  sha256Digest,
} from '@gitblocks/interviews';

import { operatorIssue, type OperatorParseResult } from './operator-issues.ts';
import {
  hasExactKeys,
  isPlainRecord,
  ownAndFreezeOperatorData,
} from './plain-data.ts';

const DIGEST = /^[0-9a-f]{64}$/u;
const SAFE_ID = /^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/u;
const SAFE_CODE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/u;
const CANDIDATE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/u;
const ARTIFACT_SET = /^artifact-set-[0-9a-f]{48}$/u;
const REQUEST_ID = /^intreq-[0-9a-f]{48}$/u;
const EXECUTION_ID = /^modelexec-[0-9a-f]{48}$/u;
const INTERVIEW_ID = /^interview-[0-9a-f]{48}$/u;
const ROOT_KEYS = [
  'schemaVersion',
  'kind',
  'runId',
  'startedAt',
  'completedAt',
  'durationMilliseconds',
  'status',
  'stopCode',
  'selection',
  'authorities',
  'database',
  'executionPolicy',
  'counts',
  'semanticCounts',
  'usage',
  'cost',
  'providerSummary',
  'candidateResults',
  'immediateReuse',
  'telemetry',
  'receiptDigest',
] as const;
const SELECTION_KEYS = [
  'selectionId',
  'selectionDigest',
  'candidateCount',
] as const;
const AUTHORITY_KEYS = [
  'catalogVersion',
  'catalogDigest',
  'artifactManifestVersion',
  'artifactManifestDigest',
  'specificationVersion',
  'specificationDigest',
  'rendererVersion',
  'providerOutputSchemaVersion',
  'providerOutputSchemaDigest',
  'providerProjectionVersion',
  'providerProjectionDigest',
  'modelProfileDigest',
  'operatorPolicyDigest',
  'pricingAuthorityDate',
  'pricingAuthorityDigest',
] as const;
const DATABASE_KEYS = [
  'postgresqlVersion',
  'latestMigrationVersion',
  'migrationInventoryDigest',
  'migrationCount',
] as const;
const EXECUTION_POLICY_KEYS = [
  'executionMode',
  'forceReasonCode',
  'concurrency',
  'candidateDeadlineMilliseconds',
  'runDeadlineMilliseconds',
  'maximumRunInputTokens',
  'maximumRunCachedInputTokens',
  'maximumRunOutputTokens',
  'maximumRunReasoningTokens',
  'maximumRunTotalTokens',
  'maximumRunCostMicroUsd',
  'immediateReuseRequested',
] as const;
const COUNT_KEYS = [
  'requestedCandidates',
  'startedCandidates',
  'completedCandidates',
  'reusedCandidates',
  'createdCandidates',
  'idempotentCandidates',
  'providerFailedCandidates',
  'applicationFailedCandidates',
  'persistenceFailedCandidates',
  'notStartedCandidates',
  'providerCalls',
  'providerAttempts',
  'providerRetries',
] as const;
const SEMANTIC_COUNT_KEYS = [
  'interviews',
  'claims',
  'citations',
  'limitations',
  'contradictions',
  'unknowns',
] as const;
const USAGE_KEYS = [
  'inputTokens',
  'cachedInputTokens',
  'outputTokens',
  'reasoningTokens',
  'totalTokens',
] as const;
const COST_KEYS = [
  'currency',
  'unit',
  'totalMicroUsd',
  'maximumMicroUsd',
] as const;
const PROVIDER_SUMMARY_KEYS = [
  'responses',
  'networkErrors',
  'deadlines',
  'cancellations',
  'refusals',
  'incomplete',
  'safetyInterruptions',
  'rateLimited',
  'quotaExceeded',
  'providerErrors',
  'invalidResponses',
  'invalidUsage',
  'responseTooLarge',
  'minimumRemainingRequests',
  'minimumRemainingTokens',
  'maximumResetRequestsMilliseconds',
  'maximumResetTokensMilliseconds',
] as const;
const CANDIDATE_RESULT_KEYS = [
  'ordinal',
  'candidateId',
  'artifactSetId',
  'artifactSetIdentityDigest',
  'status',
  'disposition',
  'failureCode',
  'requestId',
  'requestRecordDigest',
  'executionId',
  'executionRecordDigest',
  'interviewId',
  'interviewRecordDigest',
  'attemptCount',
  'retryCount',
  'publicationStatus',
  'claims',
  'citations',
  'limitations',
  'contradictions',
  'unknowns',
  'usage',
  'costMicroUsd',
  'durationMilliseconds',
] as const;
const IMMEDIATE_REUSE_FALSE_KEYS = ['requested'] as const;
const IMMEDIATE_REUSE_TRUE_KEYS = [
  'requested',
  'passed',
  'candidateCount',
  'reusedCount',
  'providerCalls',
  'providerAttempts',
  'tokenUsage',
  'costMicroUsd',
] as const;
const TELEMETRY_KEYS = ['eventCount', 'telemetryFailureCount'] as const;

export interface RepositoryInterviewOperatorUsageV1 {
  readonly inputTokens: number;
  readonly cachedInputTokens: number;
  readonly outputTokens: number;
  readonly reasoningTokens: number;
  readonly totalTokens: number;
}

export interface RepositoryInterviewOperatorCandidateResultV1 {
  readonly ordinal: number;
  readonly candidateId: string;
  readonly artifactSetId: string;
  readonly artifactSetIdentityDigest: string;
  readonly status:
    | 'completed'
    | 'provider-failed'
    | 'application-failed'
    | 'persistence-failed';
  readonly disposition:
    'created' | 'idempotent' | 'reused' | 'provider-failed' | null;
  readonly failureCode: string | null;
  readonly requestId: string | null;
  readonly requestRecordDigest: string | null;
  readonly executionId: string | null;
  readonly executionRecordDigest: string | null;
  readonly interviewId: string | null;
  readonly interviewRecordDigest: string | null;
  readonly attemptCount: number;
  readonly retryCount: number;
  readonly publicationStatus: 'created' | 'idempotent' | 'reused' | null;
  readonly claims: number;
  readonly citations: number;
  readonly limitations: number;
  readonly contradictions: number;
  readonly unknowns: number;
  readonly usage: RepositoryInterviewOperatorUsageV1;
  readonly costMicroUsd: number;
  readonly durationMilliseconds: number;
}

export interface RepositoryInterviewOperatorReceiptV1 {
  readonly schemaVersion: '1.0.0';
  readonly kind: 'repository-interview-operator-receipt';
  readonly runId: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly durationMilliseconds: number;
  readonly status: 'completed' | 'stopped' | 'failed';
  readonly stopCode: string | null;
  readonly selection: {
    readonly selectionId: string;
    readonly selectionDigest: string;
    readonly candidateCount: number;
  };
  readonly authorities: {
    readonly catalogVersion: string;
    readonly catalogDigest: string;
    readonly artifactManifestVersion: string;
    readonly artifactManifestDigest: string;
    readonly specificationVersion: string;
    readonly specificationDigest: string;
    readonly rendererVersion: string;
    readonly providerOutputSchemaVersion: string;
    readonly providerOutputSchemaDigest: string;
    readonly providerProjectionVersion: string;
    readonly providerProjectionDigest: string;
    readonly modelProfileDigest: string;
    readonly operatorPolicyDigest: string;
    readonly pricingAuthorityDate: string;
    readonly pricingAuthorityDigest: string;
  };
  readonly database: {
    readonly postgresqlVersion: string;
    readonly latestMigrationVersion: number;
    readonly migrationInventoryDigest: string;
    readonly migrationCount: number;
  };
  readonly executionPolicy: {
    readonly executionMode: 'normal' | 'forced';
    readonly forceReasonCode: string | null;
    readonly concurrency: 1 | 2;
    readonly candidateDeadlineMilliseconds: number;
    readonly runDeadlineMilliseconds: number;
    readonly maximumRunInputTokens: number;
    readonly maximumRunCachedInputTokens: number;
    readonly maximumRunOutputTokens: number;
    readonly maximumRunReasoningTokens: number;
    readonly maximumRunTotalTokens: number;
    readonly maximumRunCostMicroUsd: number;
    readonly immediateReuseRequested: boolean;
  };
  readonly counts: {
    readonly requestedCandidates: number;
    readonly startedCandidates: number;
    readonly completedCandidates: number;
    readonly reusedCandidates: number;
    readonly createdCandidates: number;
    readonly idempotentCandidates: number;
    readonly providerFailedCandidates: number;
    readonly applicationFailedCandidates: number;
    readonly persistenceFailedCandidates: number;
    readonly notStartedCandidates: number;
    readonly providerCalls: number;
    readonly providerAttempts: number;
    readonly providerRetries: number;
  };
  readonly semanticCounts: {
    readonly interviews: number;
    readonly claims: number;
    readonly citations: number;
    readonly limitations: number;
    readonly contradictions: number;
    readonly unknowns: number;
  };
  readonly usage: RepositoryInterviewOperatorUsageV1;
  readonly cost: {
    readonly currency: 'USD';
    readonly unit: 'micro-usd';
    readonly totalMicroUsd: number;
    readonly maximumMicroUsd: number;
  };
  readonly providerSummary: {
    readonly responses: number;
    readonly networkErrors: number;
    readonly deadlines: number;
    readonly cancellations: number;
    readonly refusals: number;
    readonly incomplete: number;
    readonly safetyInterruptions: number;
    readonly rateLimited: number;
    readonly quotaExceeded: number;
    readonly providerErrors: number;
    readonly invalidResponses: number;
    readonly invalidUsage: number;
    readonly responseTooLarge: number;
    readonly minimumRemainingRequests: number | null;
    readonly minimumRemainingTokens: number | null;
    readonly maximumResetRequestsMilliseconds: number | null;
    readonly maximumResetTokensMilliseconds: number | null;
  };
  readonly candidateResults: readonly RepositoryInterviewOperatorCandidateResultV1[];
  readonly immediateReuse:
    | { readonly requested: false }
    | {
        readonly requested: true;
        readonly passed: boolean;
        readonly candidateCount: number;
        readonly reusedCount: number;
        readonly providerCalls: number;
        readonly providerAttempts: number;
        readonly tokenUsage: number;
        readonly costMicroUsd: number;
      };
  readonly telemetry: {
    readonly eventCount: number;
    readonly telemetryFailureCount: number;
  };
  readonly receiptDigest: string;
}

type ReceiptDraft = Omit<RepositoryInterviewOperatorReceiptV1, 'receiptDigest'>;

export function repositoryInterviewOperatorReceiptDigestV1(
  receipt: ReceiptDraft,
): string {
  return sha256Digest(
    `gitblocks\0repository-interview-operator-receipt\0v1\0${canonicalizeJson(receipt)}`,
  );
}

export function createRepositoryInterviewOperatorReceiptV1(
  draft: ReceiptDraft,
): RepositoryInterviewOperatorReceiptV1 {
  const base = ownAndFreezeOperatorData(draft) as ReceiptDraft;
  const value = {
    ...base,
    receiptDigest: repositoryInterviewOperatorReceiptDigestV1(base),
  };
  const parsed = parseRepositoryInterviewOperatorReceiptV1(value);
  if (!parsed.ok) throw new Error('Operator receipt is invalid.');
  return parsed.value;
}

export function parseRepositoryInterviewOperatorReceiptV1(
  input: unknown,
): OperatorParseResult<RepositoryInterviewOperatorReceiptV1> {
  try {
    const value = ownAndFreezeOperatorData(input);
    if (!isPlainRecord(value) || !hasExactKeys(value, ROOT_KEYS)) return bad();
    if (
      value['schemaVersion'] !== '1.0.0' ||
      value['kind'] !== 'repository-interview-operator-receipt' ||
      typeof value['runId'] !== 'string' ||
      !SAFE_ID.test(value['runId']) ||
      !isTimestamp(value['startedAt']) ||
      !isTimestamp(value['completedAt']) ||
      value['completedAt'] < value['startedAt'] ||
      !isCount(value['durationMilliseconds']) ||
      (value['status'] !== 'completed' &&
        value['status'] !== 'stopped' &&
        value['status'] !== 'failed') ||
      (value['status'] === 'completed'
        ? value['stopCode'] !== null
        : typeof value['stopCode'] !== 'string') ||
      !Array.isArray(value['candidateResults']) ||
      value['candidateResults'].length > 150 ||
      !validateReceiptSections(value) ||
      !DIGEST.test(String(value['receiptDigest']))
    )
      return bad();
    const typed = value as unknown as RepositoryInterviewOperatorReceiptV1;
    if (
      typed.candidateResults.some(
        (result, index) => result.ordinal !== index,
      ) ||
      !candidateClosure(typed.candidateResults)
    )
      return bad();
    const { receiptDigest, ...base } = typed;
    if (repositoryInterviewOperatorReceiptDigestV1(base) !== receiptDigest) {
      return bad();
    }
    return Object.freeze({ ok: true, value: typed, issues: [] as const });
  } catch {
    return bad();
  }
}

export function serializeRepositoryInterviewOperatorReceiptV1(
  receipt: RepositoryInterviewOperatorReceiptV1,
): string {
  const parsed = parseRepositoryInterviewOperatorReceiptV1(receipt);
  if (!parsed.ok) throw new Error('Operator receipt is invalid.');
  return serializeCanonicalJson(parsed.value);
}

function candidateClosure(
  results: readonly RepositoryInterviewOperatorCandidateResultV1[],
): boolean {
  return results.every((result, index) => {
    if (
      !isPlainRecord(result) ||
      !hasExactKeys(result, CANDIDATE_RESULT_KEYS) ||
      result.ordinal !== index ||
      !CANDIDATE.test(result.candidateId) ||
      !ARTIFACT_SET.test(result.artifactSetId) ||
      !DIGEST.test(result.artifactSetIdentityDigest) ||
      !isUsage(result.usage) ||
      ![
        result.attemptCount,
        result.retryCount,
        result.claims,
        result.citations,
        result.limitations,
        result.contradictions,
        result.unknowns,
        result.costMicroUsd,
        result.durationMilliseconds,
      ].every(isCount) ||
      result.retryCount > Math.max(0, result.attemptCount - 1) ||
      (result.failureCode !== null && !SAFE_CODE.test(result.failureCode))
    )
      return false;
    if (result.status === 'completed') {
      return (
        result.failureCode === null &&
        result.requestId !== null &&
        REQUEST_ID.test(result.requestId) &&
        result.requestRecordDigest !== null &&
        DIGEST.test(result.requestRecordDigest) &&
        result.executionId !== null &&
        EXECUTION_ID.test(result.executionId) &&
        result.executionRecordDigest !== null &&
        DIGEST.test(result.executionRecordDigest) &&
        result.interviewId !== null &&
        INTERVIEW_ID.test(result.interviewId) &&
        result.interviewRecordDigest !== null &&
        DIGEST.test(result.interviewRecordDigest) &&
        (result.disposition === 'created' ||
          result.disposition === 'idempotent' ||
          result.disposition === 'reused') &&
        result.publicationStatus === result.disposition &&
        (result.disposition !== 'reused' ||
          (result.attemptCount === 0 &&
            result.retryCount === 0 &&
            isZeroUsage(result.usage) &&
            result.costMicroUsd === 0))
      );
    }
    if (result.status === 'provider-failed') {
      return (
        result.disposition === 'provider-failed' &&
        result.failureCode !== null &&
        result.requestId !== null &&
        REQUEST_ID.test(result.requestId) &&
        result.requestRecordDigest !== null &&
        DIGEST.test(result.requestRecordDigest) &&
        result.executionId !== null &&
        EXECUTION_ID.test(result.executionId) &&
        result.executionRecordDigest !== null &&
        DIGEST.test(result.executionRecordDigest) &&
        result.interviewId === null &&
        result.interviewRecordDigest === null &&
        (result.publicationStatus === 'created' ||
          result.publicationStatus === 'idempotent') &&
        result.claims === 0 &&
        result.citations === 0 &&
        result.limitations === 0 &&
        result.contradictions === 0 &&
        result.unknowns === 0
      );
    }
    return (
      result.disposition === null &&
      result.failureCode !== null &&
      result.requestId === null &&
      result.requestRecordDigest === null &&
      result.executionId === null &&
      result.executionRecordDigest === null &&
      result.interviewId === null &&
      result.interviewRecordDigest === null &&
      result.publicationStatus === null &&
      result.attemptCount === 0 &&
      result.retryCount === 0 &&
      result.claims === 0 &&
      result.citations === 0 &&
      result.limitations === 0 &&
      result.contradictions === 0 &&
      result.unknowns === 0 &&
      isZeroUsage(result.usage) &&
      result.costMicroUsd === 0
    );
  });
}

function validateReceiptSections(
  value: Readonly<Record<string, unknown>>,
): boolean {
  const selection = exactRecord(value['selection'], SELECTION_KEYS);
  const authorities = exactRecord(value['authorities'], AUTHORITY_KEYS);
  const database = exactRecord(value['database'], DATABASE_KEYS);
  const executionPolicy = exactRecord(
    value['executionPolicy'],
    EXECUTION_POLICY_KEYS,
  );
  const counts = exactRecord(value['counts'], COUNT_KEYS);
  const semanticCounts = exactRecord(
    value['semanticCounts'],
    SEMANTIC_COUNT_KEYS,
  );
  const usage = exactRecord(value['usage'], USAGE_KEYS);
  const cost = exactRecord(value['cost'], COST_KEYS);
  const providerSummary = exactRecord(
    value['providerSummary'],
    PROVIDER_SUMMARY_KEYS,
  );
  const immediateReuse = isPlainRecord(value['immediateReuse'])
    ? value['immediateReuse']
    : null;
  const telemetry = exactRecord(value['telemetry'], TELEMETRY_KEYS);
  if (
    selection === null ||
    authorities === null ||
    database === null ||
    executionPolicy === null ||
    counts === null ||
    semanticCounts === null ||
    usage === null ||
    cost === null ||
    providerSummary === null ||
    immediateReuse === null ||
    telemetry === null ||
    !validateSelectionSection(selection) ||
    !validateAuthoritySection(authorities) ||
    !validateDatabaseSection(database) ||
    !validateExecutionPolicySection(executionPolicy) ||
    !allCounts(counts, COUNT_KEYS) ||
    !allCounts(semanticCounts, SEMANTIC_COUNT_KEYS) ||
    !isUsage(usage) ||
    cost['currency'] !== 'USD' ||
    cost['unit'] !== 'micro-usd' ||
    !isCount(cost['totalMicroUsd']) ||
    !isCount(cost['maximumMicroUsd']) ||
    !validateProviderSummary(providerSummary) ||
    !validateImmediateReuse(immediateReuse) ||
    !allCounts(telemetry, TELEMETRY_KEYS)
  )
    return false;
  const candidateResults = value['candidateResults'];
  if (!Array.isArray(candidateResults)) return false;
  const typedResults =
    candidateResults as readonly RepositoryInterviewOperatorCandidateResultV1[];
  if (!candidateClosure(typedResults)) return false;
  const typedCounts =
    counts as unknown as RepositoryInterviewOperatorReceiptV1['counts'];
  const typedSemantic =
    semanticCounts as unknown as RepositoryInterviewOperatorReceiptV1['semanticCounts'];
  const typedUsage = usage as unknown as RepositoryInterviewOperatorUsageV1;
  const completed = typedResults.filter(
    (result) => result.status === 'completed',
  );
  const expectedUsage = aggregateUsage(typedResults);
  return (
    selection['candidateCount'] === typedCounts.requestedCandidates &&
    typedCounts.startedCandidates === typedResults.length &&
    typedCounts.completedCandidates === completed.length &&
    typedCounts.reusedCandidates === dispositionCount(typedResults, 'reused') &&
    typedCounts.createdCandidates ===
      dispositionCount(typedResults, 'created') &&
    typedCounts.idempotentCandidates ===
      dispositionCount(typedResults, 'idempotent') &&
    typedCounts.providerFailedCandidates ===
      typedResults.filter((result) => result.status === 'provider-failed')
        .length &&
    typedCounts.applicationFailedCandidates ===
      typedResults.filter((result) => result.status === 'application-failed')
        .length &&
    typedCounts.persistenceFailedCandidates ===
      typedResults.filter((result) => result.status === 'persistence-failed')
        .length &&
    typedCounts.notStartedCandidates ===
      typedCounts.requestedCandidates - typedCounts.startedCandidates &&
    typedCounts.providerAttempts >=
      typedResults.reduce((total, result) => total + result.attemptCount, 0) &&
    typedCounts.providerRetries >=
      typedResults.reduce((total, result) => total + result.retryCount, 0) &&
    typedCounts.providerRetries <= typedCounts.providerAttempts &&
    typedCounts.providerAttempts <= typedCounts.providerCalls * 2 &&
    typedSemantic.interviews === completed.length &&
    typedSemantic.claims === aggregate(typedResults, 'claims') &&
    typedSemantic.citations === aggregate(typedResults, 'citations') &&
    typedSemantic.limitations === aggregate(typedResults, 'limitations') &&
    typedSemantic.contradictions ===
      aggregate(typedResults, 'contradictions') &&
    typedSemantic.unknowns === aggregate(typedResults, 'unknowns') &&
    canonicalizeJson(expectedUsage) === canonicalizeJson(typedUsage) &&
    cost['totalMicroUsd'] ===
      typedResults.reduce((total, result) => total + result.costMicroUsd, 0) &&
    validateTopLevelStatus(value, typedCounts) &&
    validateImmediateReuseClosure(immediateReuse, executionPolicy)
  );
}

function validateSelectionSection(
  value: Readonly<Record<string, unknown>>,
): boolean {
  return (
    typeof value['selectionId'] === 'string' &&
    SAFE_ID.test(value['selectionId']) &&
    DIGEST.test(String(value['selectionDigest'])) &&
    isCount(value['candidateCount']) &&
    value['candidateCount'] >= 1 &&
    value['candidateCount'] <= 150
  );
}

function validateAuthoritySection(
  value: Readonly<Record<string, unknown>>,
): boolean {
  for (const key of AUTHORITY_KEYS) {
    if (typeof value[key] !== 'string') return false;
    if (key.endsWith('Digest') && !DIGEST.test(value[key])) return false;
  }
  return true;
}

function validateDatabaseSection(
  value: Readonly<Record<string, unknown>>,
): boolean {
  return (
    typeof value['postgresqlVersion'] === 'string' &&
    /^18[.]4(?:[.\s]|$)/u.test(value['postgresqlVersion']) &&
    value['latestMigrationVersion'] === 4 &&
    DIGEST.test(String(value['migrationInventoryDigest'])) &&
    value['migrationCount'] === 4
  );
}

function validateExecutionPolicySection(
  value: Readonly<Record<string, unknown>>,
): boolean {
  const mode = value['executionMode'];
  const forceReason = value['forceReasonCode'];
  return (
    (mode === 'normal' || mode === 'forced') &&
    (mode === 'normal'
      ? forceReason === null
      : typeof forceReason === 'string' && SAFE_CODE.test(forceReason)) &&
    (value['concurrency'] === 1 || value['concurrency'] === 2) &&
    allCounts(
      value,
      EXECUTION_POLICY_KEYS.filter(
        (key) =>
          key !== 'executionMode' &&
          key !== 'forceReasonCode' &&
          key !== 'concurrency' &&
          key !== 'immediateReuseRequested',
      ),
    ) &&
    typeof value['immediateReuseRequested'] === 'boolean'
  );
}

function validateProviderSummary(
  value: Readonly<Record<string, unknown>>,
): boolean {
  return PROVIDER_SUMMARY_KEYS.every((key) => {
    const item = value[key];
    return key.startsWith('minimum') || key.startsWith('maximum')
      ? item === null || isCount(item)
      : isCount(item);
  });
}

function validateImmediateReuse(
  value: Readonly<Record<string, unknown>>,
): boolean {
  if (value['requested'] === false) {
    return hasExactKeys(value, IMMEDIATE_REUSE_FALSE_KEYS);
  }
  return (
    value['requested'] === true &&
    hasExactKeys(value, IMMEDIATE_REUSE_TRUE_KEYS) &&
    typeof value['passed'] === 'boolean' &&
    allCounts(
      value,
      IMMEDIATE_REUSE_TRUE_KEYS.filter(
        (key) => key !== 'requested' && key !== 'passed',
      ),
    ) &&
    (!value['passed'] ||
      (value['reusedCount'] === value['candidateCount'] &&
        value['providerCalls'] === 0 &&
        value['providerAttempts'] === 0 &&
        value['tokenUsage'] === 0 &&
        value['costMicroUsd'] === 0))
  );
}

function validateImmediateReuseClosure(
  reuse: Readonly<Record<string, unknown>>,
  policy: Readonly<Record<string, unknown>>,
): boolean {
  return (
    reuse['requested'] === policy['immediateReuseRequested'] &&
    (reuse['requested'] !== true || policy['executionMode'] === 'normal')
  );
}

function validateTopLevelStatus(
  value: Readonly<Record<string, unknown>>,
  counts: RepositoryInterviewOperatorReceiptV1['counts'],
): boolean {
  if (value['status'] === 'completed') {
    return (
      value['stopCode'] === null &&
      counts.completedCandidates === counts.requestedCandidates &&
      counts.providerFailedCandidates === 0 &&
      counts.applicationFailedCandidates === 0 &&
      counts.notStartedCandidates === 0
    );
  }
  return (
    typeof value['stopCode'] === 'string' && SAFE_CODE.test(value['stopCode'])
  );
}

function exactRecord(
  value: unknown,
  keys: readonly string[],
): Readonly<Record<string, unknown>> | null {
  return isPlainRecord(value) && hasExactKeys(value, keys) ? value : null;
}

function allCounts(
  value: Readonly<Record<string, unknown>>,
  keys: readonly string[],
): boolean {
  return keys.every((key) => isCount(value[key]));
}

function isUsage(value: unknown): value is RepositoryInterviewOperatorUsageV1 {
  if (!isPlainRecord(value) || !hasExactKeys(value, USAGE_KEYS)) return false;
  if (!allCounts(value, USAGE_KEYS)) return false;
  return (
    Number(value['cachedInputTokens']) <= Number(value['inputTokens']) &&
    Number(value['reasoningTokens']) <= Number(value['outputTokens']) &&
    Number(value['totalTokens']) ===
      Number(value['inputTokens']) + Number(value['outputTokens'])
  );
}

function isZeroUsage(value: RepositoryInterviewOperatorUsageV1): boolean {
  return USAGE_KEYS.every((key) => value[key] === 0);
}

function aggregateUsage(
  results: readonly RepositoryInterviewOperatorCandidateResultV1[],
): RepositoryInterviewOperatorUsageV1 {
  return Object.freeze({
    inputTokens: aggregateUsageField(results, 'inputTokens'),
    cachedInputTokens: aggregateUsageField(results, 'cachedInputTokens'),
    outputTokens: aggregateUsageField(results, 'outputTokens'),
    reasoningTokens: aggregateUsageField(results, 'reasoningTokens'),
    totalTokens: aggregateUsageField(results, 'totalTokens'),
  });
}

function aggregateUsageField(
  results: readonly RepositoryInterviewOperatorCandidateResultV1[],
  key: keyof RepositoryInterviewOperatorUsageV1,
): number {
  return results.reduce((total, result) => total + result.usage[key], 0);
}

function aggregate(
  results: readonly RepositoryInterviewOperatorCandidateResultV1[],
  key: 'claims' | 'citations' | 'limitations' | 'contradictions' | 'unknowns',
): number {
  return results.reduce((total, result) => total + result[key], 0);
}

function dispositionCount(
  results: readonly RepositoryInterviewOperatorCandidateResultV1[],
  disposition: 'created' | 'idempotent' | 'reused',
): number {
  return results.filter((result) => result.disposition === disposition).length;
}

function isTimestamp(value: unknown): value is string {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[.]\d{3}Z$/u.test(value)
  )
    return false;
  const milliseconds = Date.parse(value);
  return (
    Number.isFinite(milliseconds) &&
    new Date(milliseconds).toISOString() === value
  );
}

function isCount(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function bad(): OperatorParseResult<never> {
  return Object.freeze({
    ok: false,
    issues: Object.freeze([operatorIssue('operator.receipt-invalid')]),
  });
}
