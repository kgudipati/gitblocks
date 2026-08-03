import {
  modelExecutionModelProfileDigest,
  parseModelExecutionModelProfileV1,
  type ModelExecutionModelProfileV1,
  type ModelExecutionUsageV1,
} from '@gitblocks/contracts';
import { canonicalizeJson, sha256Digest } from '@gitblocks/interviews';

import { operatorIssue, type OperatorParseResult } from './operator-issues.ts';
import {
  hasExactKeys,
  isPlainRecord,
  ownAndFreezeOperatorData,
} from './plain-data.ts';

const DIGEST = /^[0-9a-f]{64}$/u;
const SAFE_ID = /^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/u;
const DATE = /^\d{4}-\d{2}-\d{2}$/u;
const DATED_MODEL_SNAPSHOT =
  /^[A-Za-z0-9][A-Za-z0-9._-]{0,102}-[0-9]{4}-[0-9]{2}-[0-9]{2}$/u;
const ROOT_KEYS = [
  'schemaVersion',
  'policyId',
  'maximumCandidates',
  'concurrency',
  'candidateDeadlineMilliseconds',
  'runDeadlineMilliseconds',
  'statementTimeoutMilliseconds',
  'lockTimeoutMilliseconds',
  'maximumInputTokensPerProviderCall',
  'maximumOutputTokensPerProviderCall',
  'maximumRunInputTokens',
  'maximumRunCachedInputTokens',
  'maximumRunOutputTokens',
  'maximumRunReasoningTokens',
  'maximumRunTotalTokens',
  'maximumRunCostMicroUsd',
  'pricing',
  'policyDigest',
] as const;
const PRICING_KEYS = [
  'provider',
  'modelSnapshot',
  'inputMicroUsdPerMillionTokens',
  'cachedInputMicroUsdPerMillionTokens',
  'outputMicroUsdPerMillionTokens',
  'pricingAuthorityDate',
  'pricingAuthorityDigest',
] as const;

export interface RepositoryInterviewOperatorPricingV1 {
  readonly provider: 'openai';
  readonly modelSnapshot: string;
  readonly inputMicroUsdPerMillionTokens: number;
  readonly cachedInputMicroUsdPerMillionTokens: number;
  readonly outputMicroUsdPerMillionTokens: number;
  readonly pricingAuthorityDate: string;
  readonly pricingAuthorityDigest: string;
}

export interface RepositoryInterviewOperatorPolicyV1 {
  readonly schemaVersion: '1.0.0';
  readonly policyId: string;
  readonly maximumCandidates: number;
  readonly concurrency: 1 | 2;
  readonly candidateDeadlineMilliseconds: number;
  readonly runDeadlineMilliseconds: number;
  readonly statementTimeoutMilliseconds: number;
  readonly lockTimeoutMilliseconds: number;
  readonly maximumInputTokensPerProviderCall: number;
  readonly maximumOutputTokensPerProviderCall: number;
  readonly maximumRunInputTokens: number;
  readonly maximumRunCachedInputTokens: number;
  readonly maximumRunOutputTokens: number;
  readonly maximumRunReasoningTokens: number;
  readonly maximumRunTotalTokens: number;
  readonly maximumRunCostMicroUsd: number;
  readonly pricing: RepositoryInterviewOperatorPricingV1;
  readonly policyDigest: string;
}

export interface RepositoryInterviewOperatorWorstCaseV1 {
  readonly candidateCount: number;
  readonly inputTokens: number;
  readonly cachedInputTokens: number;
  readonly outputTokens: number;
  readonly reasoningTokens: number;
  readonly totalTokens: number;
  readonly costMicroUsd: number;
}

type PolicyDraft = Omit<RepositoryInterviewOperatorPolicyV1, 'policyDigest'>;

export function repositoryInterviewOperatorPolicyDigestV1(
  policy: PolicyDraft,
): string {
  return sha256Digest(
    `gitblocks\0repository-interview-operator-policy\0v1\0${canonicalizeJson(policy)}`,
  );
}

export function createRepositoryInterviewOperatorPolicyV1(
  draft: PolicyDraft,
  modelProfile?: ModelExecutionModelProfileV1,
): RepositoryInterviewOperatorPolicyV1 {
  const base = ownAndFreezeOperatorData(draft) as PolicyDraft;
  const parsed = parseRepositoryInterviewOperatorPolicyV1(
    {
      ...base,
      policyDigest: repositoryInterviewOperatorPolicyDigestV1(base),
    },
    modelProfile,
  );
  if (!parsed.ok) throw new Error('Operator policy is invalid.');
  return parsed.value;
}

export function parseRepositoryInterviewOperatorPolicyV1(
  input: unknown,
  modelProfile?: ModelExecutionModelProfileV1,
): OperatorParseResult<RepositoryInterviewOperatorPolicyV1> {
  try {
    const value = ownAndFreezeOperatorData(input);
    if (!isPlainRecord(value) || !hasExactKeys(value, ROOT_KEYS)) return bad();
    const pricing = value['pricing'];
    if (!isPlainRecord(pricing) || !hasExactKeys(pricing, PRICING_KEYS)) {
      return bad();
    }
    const integers = [
      value['maximumCandidates'],
      value['concurrency'],
      value['candidateDeadlineMilliseconds'],
      value['runDeadlineMilliseconds'],
      value['statementTimeoutMilliseconds'],
      value['lockTimeoutMilliseconds'],
      value['maximumInputTokensPerProviderCall'],
      value['maximumOutputTokensPerProviderCall'],
      value['maximumRunInputTokens'],
      value['maximumRunCachedInputTokens'],
      value['maximumRunOutputTokens'],
      value['maximumRunReasoningTokens'],
      value['maximumRunTotalTokens'],
      value['maximumRunCostMicroUsd'],
      pricing['inputMicroUsdPerMillionTokens'],
      pricing['cachedInputMicroUsdPerMillionTokens'],
      pricing['outputMicroUsdPerMillionTokens'],
    ];
    if (
      value['schemaVersion'] !== '1.0.0' ||
      typeof value['policyId'] !== 'string' ||
      !SAFE_ID.test(value['policyId']) ||
      integers.some((integer) => !isSafeNonnegativeInteger(integer)) ||
      !between(value['maximumCandidates'], 1, 150) ||
      (value['concurrency'] !== 1 && value['concurrency'] !== 2) ||
      !between(value['candidateDeadlineMilliseconds'], 300_000, 86_400_000) ||
      !between(value['runDeadlineMilliseconds'], 1, 86_400_000) ||
      !between(value['statementTimeoutMilliseconds'], 1, 60_000) ||
      !between(value['lockTimeoutMilliseconds'], 1, 30_000) ||
      !between(value['maximumInputTokensPerProviderCall'], 1, 10_000_000) ||
      !between(value['maximumOutputTokensPerProviderCall'], 1, 8_192) ||
      !between(value['maximumRunCostMicroUsd'], 0, 120_000_000) ||
      Number(value['maximumRunCachedInputTokens']) >
        Number(value['maximumRunInputTokens']) ||
      Number(value['maximumRunReasoningTokens']) >
        Number(value['maximumRunOutputTokens']) ||
      pricing['provider'] !== 'openai' ||
      typeof pricing['modelSnapshot'] !== 'string' ||
      pricing['modelSnapshot'].length < 12 ||
      pricing['modelSnapshot'].length > 128 ||
      !DATED_MODEL_SNAPSHOT.test(pricing['modelSnapshot']) ||
      !isRealDate(pricing['modelSnapshot'].slice(-10)) ||
      typeof pricing['pricingAuthorityDate'] !== 'string' ||
      !DATE.test(pricing['pricingAuthorityDate']) ||
      !isRealDate(pricing['pricingAuthorityDate']) ||
      !DIGEST.test(String(pricing['pricingAuthorityDigest'])) ||
      !DIGEST.test(String(value['policyDigest']))
    )
      return bad();
    const typed = value as unknown as RepositoryInterviewOperatorPolicyV1;
    const { policyDigest, ...base } = typed;
    if (repositoryInterviewOperatorPolicyDigestV1(base) !== policyDigest) {
      return bad();
    }
    if (modelProfile !== undefined) {
      const parsedProfile = parseModelExecutionModelProfileV1(modelProfile);
      if (
        !parsedProfile.ok ||
        typed.pricing.modelSnapshot !== parsedProfile.value.modelSnapshot ||
        typed.maximumOutputTokensPerProviderCall !==
          parsedProfile.value.maximumOutputTokens
      )
        return bad();
      modelExecutionModelProfileDigest(parsedProfile.value);
    }
    return Object.freeze({ ok: true, value: typed, issues: [] as const });
  } catch {
    return bad();
  }
}

export function calculateRepositoryInterviewUsageCostMicroUsdV1(
  usage: ModelExecutionUsageV1,
  rates: Pick<
    RepositoryInterviewOperatorPricingV1,
    | 'inputMicroUsdPerMillionTokens'
    | 'cachedInputMicroUsdPerMillionTokens'
    | 'outputMicroUsdPerMillionTokens'
  >,
): number {
  if (
    !isSafeNonnegativeInteger(usage.inputTokens) ||
    !isSafeNonnegativeInteger(usage.cachedInputTokens) ||
    !isSafeNonnegativeInteger(usage.outputTokens) ||
    !isSafeNonnegativeInteger(usage.reasoningTokens) ||
    !isSafeNonnegativeInteger(usage.totalTokens) ||
    usage.cachedInputTokens > usage.inputTokens ||
    usage.reasoningTokens > usage.outputTokens ||
    usage.totalTokens !== usage.inputTokens + usage.outputTokens
  )
    throw new Error('Usage is invalid.');
  const input = BigInt(usage.inputTokens - usage.cachedInputTokens);
  const cached = BigInt(usage.cachedInputTokens);
  const output = BigInt(usage.outputTokens);
  const cost =
    ceilMillion(input * rate(rates.inputMicroUsdPerMillionTokens)) +
    ceilMillion(cached * rate(rates.cachedInputMicroUsdPerMillionTokens)) +
    ceilMillion(output * rate(rates.outputMicroUsdPerMillionTokens));
  if (cost > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Cost overflow.');
  return Number(cost);
}

export function calculateRepositoryInterviewWorstCaseV1(
  candidateCount: number,
  policy: RepositoryInterviewOperatorPolicyV1,
): RepositoryInterviewOperatorWorstCaseV1 {
  if (!between(candidateCount, 1, policy.maximumCandidates)) {
    throw new Error('Candidate count exceeds policy.');
  }
  const input = multiplySafe(
    candidateCount,
    policy.maximumInputTokensPerProviderCall,
  );
  const output = multiplySafe(
    candidateCount,
    policy.maximumOutputTokensPerProviderCall,
  );
  const cachedInput = input;
  const reasoning = output;
  const total = addSafe(input, output);
  const worstCaseUsage = {
    inputTokens: policy.maximumInputTokensPerProviderCall,
    outputTokens: policy.maximumOutputTokensPerProviderCall,
    reasoningTokens: policy.maximumOutputTokensPerProviderCall,
    totalTokens:
      policy.maximumInputTokensPerProviderCall +
      policy.maximumOutputTokensPerProviderCall,
  };
  const costPerCandidate = Math.max(
    calculateRepositoryInterviewUsageCostMicroUsdV1(
      { ...worstCaseUsage, cachedInputTokens: 0 },
      policy.pricing,
    ),
    calculateRepositoryInterviewUsageCostMicroUsdV1(
      {
        ...worstCaseUsage,
        cachedInputTokens: policy.maximumInputTokensPerProviderCall,
      },
      policy.pricing,
    ),
  );
  const cost = multiplySafe(candidateCount, costPerCandidate);
  if (
    input > policy.maximumRunInputTokens ||
    cachedInput > policy.maximumRunCachedInputTokens ||
    output > policy.maximumRunOutputTokens ||
    reasoning > policy.maximumRunReasoningTokens ||
    total > policy.maximumRunTotalTokens ||
    cost > policy.maximumRunCostMicroUsd
  )
    throw new Error('Worst-case run exceeds policy.');
  return Object.freeze({
    candidateCount,
    inputTokens: input,
    cachedInputTokens: cachedInput,
    outputTokens: output,
    reasoningTokens: reasoning,
    totalTokens: total,
    costMicroUsd: cost,
  });
}

function rate(value: number): bigint {
  if (!isSafeNonnegativeInteger(value)) throw new Error('Rate is invalid.');
  return BigInt(value);
}

function ceilMillion(value: bigint): bigint {
  return value === 0n ? 0n : (value + 999_999n) / 1_000_000n;
}

function multiplySafe(left: number, right: number): number {
  const value = BigInt(left) * BigInt(right);
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Overflow.');
  return Number(value);
}

function addSafe(left: number, right: number): number {
  if (left > Number.MAX_SAFE_INTEGER - right) throw new Error('Overflow.');
  return left + right;
}

function isSafeNonnegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function between(value: unknown, minimum: number, maximum: number): boolean {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= minimum &&
    value <= maximum
  );
}

function isRealDate(value: string): boolean {
  const [yearText, monthText, dayText] = value.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(0, 0, 0, 0);
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function bad(): OperatorParseResult<never> {
  return Object.freeze({
    ok: false,
    issues: Object.freeze([operatorIssue('operator.policy-invalid')]),
  });
}
