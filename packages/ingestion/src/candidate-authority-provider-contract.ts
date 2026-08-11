import { createHash } from 'node:crypto';
import { TextDecoder } from 'node:util';

import { canonicalizeJson } from './canonical-json.ts';
import {
  asSafeErrorCode,
  ingestionError,
  type IngestionErrorCode,
} from './errors.ts';
import { requireRecord } from './profile-materialization-contracts.ts';

export const CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_VERSION =
  'candidate-authority-provider-contract/1.0.0' as const;
export const CANDIDATE_AUTHORITY_LIVE_OPERATOR_V4_VERSION =
  'candidate-authority-live-operator/4.0.0' as const;
export const CANDIDATE_AUTHORITY_LIVE_OPERATOR_V5_VERSION =
  'candidate-authority-live-operator/5.0.0' as const;
export const CANDIDATE_AUTHORITY_LIVE_OPERATOR_V6_VERSION =
  'candidate-authority-live-operator/6.0.0' as const;
export const CANDIDATE_AUTHORITY_REPLAY_V3_VERSION =
  'candidate-authority-pure-replay/3.0.0' as const;

export const CANDIDATE_AUTHORITY_SUCCESSOR_OPERATION_IDS = [
  'github-repository-metadata',
  'github-default-branch-ref',
  'github-head-commit-object',
  'github-maintenance-window',
  'github-license',
  'github-release-window',
  'github-advisories',
  'npm-selected-version-metadata',
  'github-root-tree',
  'github-security-dot-github-tree',
  'github-security-docs-tree',
  'github-compose-json-blob',
  'github-dockerfile-blob',
] as const;

export const CANDIDATE_AUTHORITY_SUCCESSOR_V5_OPERATION_IDS = [
  'github-repository-metadata',
  'github-default-branch-ref',
  'github-head-commit-object',
  'github-maintenance-window',
  'github-license',
  'github-release-window',
  'github-advisories',
  'npm-package-metadata',
  'github-root-tree',
  'github-security-dot-github-tree',
  'github-security-docs-tree',
  'github-compose-json-blob',
  'github-dockerfile-blob',
] as const;

export type CandidateAuthoritySuccessorOperationId =
  (typeof CANDIDATE_AUTHORITY_SUCCESSOR_OPERATION_IDS)[number];

export interface CandidateAuthoritySuccessorRuntimeOperation {
  readonly operationId: CandidateAuthoritySuccessorOperationId;
  readonly provider: 'github' | 'npm';
  readonly host: 'api.github.com' | 'registry.npmjs.org';
  readonly maximumResponseBytes: number;
  readonly maximumJsonNodes: number;
  readonly timeoutMilliseconds: number;
  readonly maximumTotalLogicalRequests: number;
}

export interface CandidateAuthoritySuccessorRuntimeSourcePolicy {
  readonly policyVersion:
    | 'candidate-authority-source-policy/6.0.0'
    | 'candidate-authority-source-policy/7.0.0'
    | 'candidate-authority-source-policy/8.0.0';
  readonly policySemanticDigest: string;
  readonly requestBudget: {
    readonly githubLogicalRequests: 1810;
    readonly npmLogicalRequests: 80;
    readonly totalLogicalRequests: 1890;
    readonly githubWorstCaseAttempts: 5430;
    readonly npmWorstCaseAttempts: 240;
    readonly totalWorstCaseAttempts: 5670;
  };
  readonly operations: readonly CandidateAuthoritySuccessorRuntimeOperation[];
}

export interface CandidateAuthoritySuccessorSourceDatum {
  readonly operationId: CandidateAuthoritySuccessorOperationId;
  readonly outcome:
    | 'established-absence'
    | 'established-value'
    | 'not-applicable'
    | 'qualified-unknown';
  readonly completeness: 'complete' | 'partial' | 'not-applicable';
  readonly limitationCode: string | null;
  readonly value: unknown;
}

export interface CandidateAuthoritySuccessorSourceCandidate {
  readonly candidateId: string;
  readonly github: { readonly owner: string; readonly repository: string };
  readonly npmPackage: string | null;
  readonly sources: readonly CandidateAuthoritySuccessorSourceDatum[];
  readonly candidateSourceDigest: string;
}

export interface CandidateAuthoritySuccessorOperationReceipt {
  readonly operationId: CandidateAuthoritySuccessorOperationId;
  readonly logicalRequests: number;
  readonly attempts: number;
  readonly establishedAbsences: number;
  readonly qualifiedUnknowns: number;
}

export interface CandidateAuthoritySuccessorSourceAuthority {
  readonly authorityVersion:
    | 'candidate-authority-source-authority/2.0.0'
    | 'candidate-authority-source-authority/3.0.0';
  readonly operatorVersion:
    | typeof CANDIDATE_AUTHORITY_LIVE_OPERATOR_V4_VERSION
    | typeof CANDIDATE_AUTHORITY_LIVE_OPERATOR_V5_VERSION
    | typeof CANDIDATE_AUTHORITY_LIVE_OPERATOR_V6_VERSION;
  readonly bindings: Readonly<Record<string, string>>;
  readonly collectionCutoff: string;
  readonly candidateCount: 150;
  readonly orderedCandidateIds: readonly string[];
  readonly candidates: readonly CandidateAuthoritySuccessorSourceCandidate[];
  readonly effectReceipt: {
    readonly collectionExecutions: 1;
    readonly githubLogicalRequests: number;
    readonly npmLogicalRequests: number;
    readonly totalLogicalRequests: number;
    readonly githubAttempts: number;
    readonly npmAttempts: number;
    readonly totalAttempts: number;
    readonly retries: number;
    readonly perOperation: readonly CandidateAuthoritySuccessorOperationReceipt[];
    readonly controlledOptionalSourceFailures: Readonly<Record<string, number>>;
    readonly credentialAvailable: true;
    readonly databaseCalls: 0;
    readonly dockerCalls: 0;
    readonly modelCalls: 0;
    readonly candidateExecutions: 0;
    readonly allCandidateProjections: 0;
    readonly coverageCalculations: 0;
  };
  readonly canonicalAuthorityDigest: string;
}

export function createCandidateAuthoritySuccessorSourceCandidate(
  input: Omit<
    CandidateAuthoritySuccessorSourceCandidate,
    'candidateSourceDigest'
  >,
): CandidateAuthoritySuccessorSourceCandidate {
  const ordered = {
    ...input,
    sources: [...input.sources].sort(
      (left, right) =>
        CANDIDATE_AUTHORITY_SUCCESSOR_OPERATION_IDS.indexOf(left.operationId) -
        CANDIDATE_AUTHORITY_SUCCESSOR_OPERATION_IDS.indexOf(right.operationId),
    ),
  };
  return Object.freeze({
    ...ordered,
    candidateSourceDigest: canonicalizeJson(ordered).digest,
  });
}

export function createCandidateAuthoritySuccessorSourceAuthority(
  input: Omit<
    CandidateAuthoritySuccessorSourceAuthority,
    'canonicalAuthorityDigest'
  >,
): CandidateAuthoritySuccessorSourceAuthority {
  return Object.freeze({
    ...input,
    canonicalAuthorityDigest: canonicalizeJson(input).digest,
  });
}

export function materializeCandidateAuthoritySuccessorRuntimeSourcePolicy(
  sourcePolicy: unknown,
  providerContract: unknown,
): CandidateAuthoritySuccessorRuntimeSourcePolicy {
  const source = requireRecord(sourcePolicy);
  const contract = requireRecord(providerContract);
  const inventory = source['operationInventory'];
  const operations = contract['operations'];
  const budget = requireRecord(source['requestBudget']);
  if (!Array.isArray(inventory) || !Array.isArray(operations)) invalidInput();
  const runtimeOperations = operations.map((raw, index) => {
    const matrix = requireRecord(raw);
    const inventoryEntry = requireRecord(inventory[index]);
    const limits = requireRecord(matrix['limits']);
    const operationId = matrix['operationId'];
    if (
      operationId !== CANDIDATE_AUTHORITY_SUCCESSOR_V5_OPERATION_IDS[index] ||
      inventoryEntry['operationId'] !== operationId ||
      inventoryEntry['maximumTotalLogicalRequests'] !==
        matrix['requestCeiling'] ||
      (matrix['provider'] !== 'github' && matrix['provider'] !== 'npm')
    )
      invalidInput();
    return Object.freeze({
      operationId: operationId as CandidateAuthoritySuccessorOperationId,
      provider: matrix['provider'],
      host:
        matrix['provider'] === 'github'
          ? ('api.github.com' as const)
          : ('registry.npmjs.org' as const),
      maximumResponseBytes: nonnegativeInteger(limits['responseBytes']),
      maximumJsonNodes: nonnegativeInteger(limits['jsonNodes']),
      timeoutMilliseconds: 15_000,
      maximumTotalLogicalRequests: nonnegativeInteger(matrix['requestCeiling']),
    });
  });
  if (
    source['policyVersion'] !== 'candidate-authority-source-policy/6.0.0' ||
    typeof source['policySemanticDigest'] !== 'string' ||
    budget['githubLogicalRequests'] !== 1810 ||
    budget['npmLogicalRequests'] !== 80 ||
    budget['totalLogicalRequests'] !== 1890 ||
    budget['githubWorstCaseAttempts'] !== 5430 ||
    budget['npmWorstCaseAttempts'] !== 240 ||
    budget['totalWorstCaseAttempts'] !== 5670
  )
    invalidInput();
  return Object.freeze({
    policyVersion: 'candidate-authority-source-policy/6.0.0',
    policySemanticDigest: source['policySemanticDigest'],
    requestBudget: {
      githubLogicalRequests: 1810,
      npmLogicalRequests: 80,
      totalLogicalRequests: 1890,
      githubWorstCaseAttempts: 5430,
      npmWorstCaseAttempts: 240,
      totalWorstCaseAttempts: 5670,
    } as const,
    operations: Object.freeze(runtimeOperations),
  });
}

export function materializeCandidateAuthoritySuccessorRuntimeSourcePolicyV8(input: {
  readonly sourcePolicyV6: unknown;
  readonly providerContractV1: unknown;
  readonly sourcePolicyV7: unknown;
  readonly providerContractV2: unknown;
  readonly sourcePolicyV8: unknown;
  readonly providerContractV3: unknown;
}): CandidateAuthoritySuccessorRuntimeSourcePolicy {
  const base = materializeCandidateAuthoritySuccessorRuntimeSourcePolicy(
    input.sourcePolicyV6,
    input.providerContractV1,
  );
  const source = requireRecord(input.sourcePolicyV8);
  const contract = requireRecord(input.providerContractV3);
  const sourceV7 = requireRecord(input.sourcePolicyV7);
  const contractV2 = requireRecord(input.providerContractV2);
  const v7Composition = requireRecord(sourceV7['completeOperationMatrix']);
  const v2Composition = requireRecord(contractV2['completeMatrixComposition']);
  const replacement = requireRecord(contract['operationReplacement']);
  const added = requireRecord(replacement['added']);
  const limits = requireRecord(added['limits']);
  const budget = requireRecord(source['requestBudget']);
  if (
    source['policyVersion'] !== 'candidate-authority-source-policy/8.0.0' ||
    typeof source['policySemanticDigest'] !== 'string' ||
    contract['contractVersion'] !==
      'candidate-authority-provider-contract/3.0.0' ||
    sourceV7['policyVersion'] !== 'candidate-authority-source-policy/7.0.0' ||
    sourceV7['policySemanticDigest'] !==
      '237b707fce608b4518ae09fcd07f7e08c315f7f323e56fb338990e1102fd29d7' ||
    v7Composition['operationCount'] !== 13 ||
    contractV2['contractVersion'] !==
      'candidate-authority-provider-contract/2.0.0' ||
    contractV2['contractSemanticDigest'] !==
      'edfd7ebcd8d42cbb65de4e79307ab91df81bd104b4039179082e1ff22686187b' ||
    v2Composition['operationCount'] !== 13 ||
    replacement['removedOperationId'] !== 'npm-package-metadata' ||
    added['operationId'] !== 'npm-selected-version-metadata' ||
    added['provider'] !== 'npm' ||
    added['endpoint'] !== 'GET /{urlEncodedExactCatalogPackageName}/latest' ||
    added['requestCeiling'] !== 80 ||
    limits['responseBytes'] !== 2_097_152 ||
    limits['jsonNodes'] !== 100_000 ||
    budget['githubLogicalRequests'] !== 1810 ||
    budget['npmLogicalRequests'] !== 80 ||
    budget['totalLogicalRequests'] !== 1890 ||
    budget['githubWorstCaseAttempts'] !== 5430 ||
    budget['npmWorstCaseAttempts'] !== 240 ||
    budget['totalWorstCaseAttempts'] !== 5670
  )
    invalidInput();
  const operations = base.operations.map((operation) =>
    isHistoricalNpmOperation(operation.operationId)
      ? Object.freeze({
          operationId: 'npm-selected-version-metadata' as const,
          provider: 'npm' as const,
          host: 'registry.npmjs.org' as const,
          maximumResponseBytes: 2_097_152,
          maximumJsonNodes: 100_000,
          timeoutMilliseconds: 15_000,
          maximumTotalLogicalRequests: 80,
        })
      : operation,
  );
  if (
    operations.length !== CANDIDATE_AUTHORITY_SUCCESSOR_OPERATION_IDS.length ||
    operations.some(
      (operation, index) =>
        operation.operationId !==
        CANDIDATE_AUTHORITY_SUCCESSOR_OPERATION_IDS[index],
    )
  )
    invalidInput();
  return Object.freeze({
    policyVersion: 'candidate-authority-source-policy/8.0.0',
    policySemanticDigest: source['policySemanticDigest'],
    requestBudget: base.requestBudget,
    operations: Object.freeze(operations),
  });
}

function isHistoricalNpmOperation(operationId: string): boolean {
  return operationId === 'npm-package-metadata';
}

export type CandidateAuthorityQualifiedUnknownCode =
  | 'documented-optional-property-absent'
  | 'optional-source-unavailable'
  | 'pagination-unclosed'
  | 'tree-truncated'
  | 'tree-local-semantic-bound-exceeded'
  | 'unsupported-optional-content'
  | 'unsupported-structured-value'
  | 'unresolved-provider-severity';

export type CandidateAuthorityProviderSeverity =
  'critical' | 'high' | 'low' | 'medium' | 'unknown';
export type CandidateAuthorityProductSeverity =
  'critical' | 'high' | 'low' | 'moderate';

export function normalizeCandidateAuthorityAdvisorySeverity(value: unknown): {
  readonly providerSeverity: CandidateAuthorityProviderSeverity;
  readonly normalizedSeverity: CandidateAuthorityProductSeverity | null;
} | null {
  switch (value) {
    case 'low':
      return { providerSeverity: value, normalizedSeverity: 'low' };
    case 'medium':
      return { providerSeverity: value, normalizedSeverity: 'moderate' };
    case 'high':
      return { providerSeverity: value, normalizedSeverity: 'high' };
    case 'critical':
      return { providerSeverity: value, normalizedSeverity: 'critical' };
    case 'unknown':
      return { providerSeverity: value, normalizedSeverity: null };
    default:
      return null;
  }
}

export type CandidateAuthorityAdvisoryParseResult =
  | {
      readonly kind: 'value';
      readonly advisory: {
        readonly advisoryId: string;
        readonly providerSeverity: CandidateAuthorityProviderSeverity;
        readonly normalizedSeverity: CandidateAuthorityProductSeverity | null;
      };
    }
  | { readonly kind: 'withdrawn' }
  | { readonly kind: 'unsupported' };

export function parseCandidateAuthorityAdvisory(
  value: unknown,
): CandidateAuthorityAdvisoryParseResult {
  const record = requireRecord(value);
  const advisoryId = boundedString(record['ghsa_id'], 64).toUpperCase();
  if (
    !/^GHSA-[23456789CFGHJMPQRVWX]{4}-[23456789CFGHJMPQRVWX]{4}-[23456789CFGHJMPQRVWX]{4}$/u.test(
      advisoryId,
    )
  )
    malformed();
  if (record['withdrawn_at'] !== undefined && record['withdrawn_at'] !== null) {
    exactTimestamp(record['withdrawn_at']);
    return { kind: 'withdrawn' };
  }
  const severity = normalizeCandidateAuthorityAdvisorySeverity(
    record['severity'],
  );
  return severity === null
    ? { kind: 'unsupported' }
    : { kind: 'value', advisory: { advisoryId, ...severity } };
}

export interface CandidateAuthorityTreeEntry {
  readonly path: string;
  readonly mode: string;
  readonly type: string;
  readonly sha: string;
  readonly size: number | null;
}

export type CandidateAuthorityTreeResult =
  | {
      readonly state: 'established-value';
      readonly sha: string;
      readonly entries: readonly CandidateAuthorityTreeEntry[];
    }
  | {
      readonly state: 'qualified-unknown';
      readonly reason: 'tree-truncated' | 'tree-local-semantic-bound-exceeded';
    };

export function parseCandidateAuthorityGitTree(input: {
  readonly value: unknown;
  readonly expectedSha: string;
  readonly localSemanticEntryLimit: number;
}): CandidateAuthorityTreeResult {
  requireSha1(input.expectedSha);
  if (
    !Number.isSafeInteger(input.localSemanticEntryLimit) ||
    input.localSemanticEntryLimit < 1
  )
    invalidInput();
  const tree = requireRecord(input.value);
  if (tree['sha'] !== input.expectedSha) identity();
  if (typeof tree['truncated'] !== 'boolean' || !Array.isArray(tree['tree']))
    malformed();
  if (tree['truncated']) {
    return { state: 'qualified-unknown', reason: 'tree-truncated' };
  }
  if (tree['tree'].length > input.localSemanticEntryLimit) {
    return {
      state: 'qualified-unknown',
      reason: 'tree-local-semantic-bound-exceeded',
    };
  }
  const entries = tree['tree'].map(parseTreeEntry);
  if (new Set(entries.map((entry) => entry.path)).size !== entries.length)
    malformed();
  return { state: 'established-value', sha: input.expectedSha, entries };
}

export type CandidateAuthoritySecurityPolicyResult =
  | {
      readonly state: 'known';
      readonly value: { readonly present: true };
      readonly path: '.github/SECURITY.md' | 'SECURITY.md' | 'docs/SECURITY.md';
      readonly blobSha: string;
    }
  | {
      readonly state: 'unknown';
      readonly reason:
        | 'account-level-default-policy-unresolved'
        | 'local-security-tree-unavailable';
    };

export function projectCandidateAuthorityLocalSecurityPolicy(input: {
  readonly root: CandidateAuthorityTreeResult;
  readonly dotGithub: CandidateAuthorityTreeResult | null;
  readonly docs: CandidateAuthorityTreeResult | null;
}): CandidateAuthoritySecurityPolicyResult {
  if (input.root.state !== 'established-value') {
    return { state: 'unknown', reason: 'local-security-tree-unavailable' };
  }
  const root = exactNormalBlob(input.root.entries, 'SECURITY.md');
  if (root !== null) {
    return {
      state: 'known',
      value: { present: true },
      path: 'SECURITY.md',
      blobSha: root.sha,
    };
  }
  const nested: readonly [
    CandidateAuthorityTreeResult | null,
    '.github/SECURITY.md' | 'docs/SECURITY.md',
  ][] = [
    [input.dotGithub, '.github/SECURITY.md'],
    [input.docs, 'docs/SECURITY.md'],
  ];
  for (const [tree, path] of nested) {
    if (tree?.state !== 'established-value') continue;
    const entry = exactNormalBlob(tree.entries, 'SECURITY.md');
    if (entry !== null) {
      return {
        state: 'known',
        value: { present: true },
        path,
        blobSha: entry.sha,
      };
    }
  }
  if (
    nested.some(([tree]) => tree !== null && tree.state === 'qualified-unknown')
  ) {
    return { state: 'unknown', reason: 'local-security-tree-unavailable' };
  }
  return {
    state: 'unknown',
    reason: 'account-level-default-policy-unresolved',
  };
}

export type CandidateAuthorityOptionalBlobResult =
  | { readonly state: 'established-value'; readonly content: string }
  | {
      readonly state: 'qualified-unknown';
      readonly reason: 'unsupported-optional-content';
    };

export function parseCandidateAuthorityOptionalGitBlob(input: {
  readonly value: unknown;
  readonly expectedEntry: CandidateAuthorityTreeEntry;
  readonly semanticMaximumBytes: number;
}): CandidateAuthorityOptionalBlobResult {
  const entry = input.expectedEntry;
  requireNormalBlob(entry);
  if (
    !Number.isSafeInteger(input.semanticMaximumBytes) ||
    input.semanticMaximumBytes < 1
  )
    invalidInput();
  const blob = requireRecord(input.value);
  if (blob['sha'] !== entry.sha) identity();
  if (blob['encoding'] !== 'base64') malformed();
  const declaredSize = nonnegativeInteger(blob['size']);
  const encoded = boundedString(blob['content'], 3_000_000).replaceAll(
    /\r\n|\n|\r/gu,
    '',
  );
  if (
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(
      encoded,
    )
  )
    malformed();
  const bytes = Buffer.from(encoded, 'base64');
  if (
    bytes.byteLength !== declaredSize ||
    (entry.size !== null && entry.size !== declaredSize) ||
    bytes.toString('base64') !== encoded
  )
    identity();
  const objectId = createHash('sha1')
    .update(Buffer.from(`blob ${String(bytes.byteLength)}\0`, 'utf8'))
    .update(bytes)
    .digest('hex');
  if (objectId !== entry.sha) identity();
  if (bytes.byteLength > input.semanticMaximumBytes)
    return {
      state: 'qualified-unknown',
      reason: 'unsupported-optional-content',
    };
  let content: string;
  try {
    content = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return {
      state: 'qualified-unknown',
      reason: 'unsupported-optional-content',
    };
  }
  if (content.includes('\0') || !Buffer.from(content, 'utf8').equals(bytes)) {
    return {
      state: 'qualified-unknown',
      reason: 'unsupported-optional-content',
    };
  }
  return { state: 'established-value', content };
}

export interface CandidateAuthorityReleaseRecord {
  readonly tagName: string;
  readonly publishedAt: string;
  readonly prerelease: boolean;
  readonly htmlUrl: string;
}

export function parseCandidateAuthorityReleaseWindow(value: unknown): {
  readonly releases: readonly CandidateAuthorityReleaseRecord[];
  readonly ignoredDraftCount: number;
  readonly unsupportedPublishedReleaseCount: number;
} {
  if (!Array.isArray(value) || value.length > 5) malformed();
  const releases: CandidateAuthorityReleaseRecord[] = [];
  let ignoredDraftCount = 0;
  let unsupportedPublishedReleaseCount = 0;
  for (const item of value) {
    const release = requireRecord(item);
    const draft = exactBoolean(release['draft']);
    if (draft) {
      ignoredDraftCount += 1;
      continue;
    }
    const tagName = boundedString(release['tag_name'], 200);
    const publishedAt = exactTimestamp(release['published_at']);
    const prerelease = exactBoolean(release['prerelease']);
    const htmlUrl = exactGithubUrl(release['html_url']);
    if (!isExactReleaseToken(tagName)) {
      unsupportedPublishedReleaseCount += 1;
      continue;
    }
    releases.push({ tagName, publishedAt, prerelease, htmlUrl });
  }
  releases.sort(
    (left, right) =>
      right.publishedAt.localeCompare(left.publishedAt) ||
      left.tagName.localeCompare(right.tagName),
  );
  return { releases, ignoredDraftCount, unsupportedPublishedReleaseCount };
}

export type CandidateAuthorityOptionalProperty<T> =
  | { readonly state: 'absent'; readonly value: null }
  | { readonly state: 'supported'; readonly value: T }
  | { readonly state: 'unsupported'; readonly value: null };

export function parseCandidateAuthorityOptionalString(
  value: unknown,
  maximum: number,
): CandidateAuthorityOptionalProperty<string> {
  if (value === undefined) return { state: 'absent', value: null };
  if (
    typeof value !== 'string' ||
    value.length < 1 ||
    value.length > maximum ||
    hasControl(value)
  )
    return { state: 'unsupported', value: null };
  return { state: 'supported', value };
}

export function parseCandidateAuthorityOptionalStringRecord(
  value: unknown,
  maximumValue: number,
): CandidateAuthorityOptionalProperty<Readonly<Record<string, string>>> {
  if (value === undefined) return { state: 'absent', value: null };
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return { state: 'unsupported', value: null };
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > 1000) return { state: 'unsupported', value: null };
  const output: Record<string, string> = {};
  for (const [key, item] of entries.sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    const parsedKey = parseCandidateAuthorityOptionalString(key, 214);
    const parsedValue = parseCandidateAuthorityOptionalString(
      item,
      maximumValue,
    );
    if (parsedKey.state !== 'supported' || parsedValue.state !== 'supported')
      return { state: 'unsupported', value: null };
    output[parsedKey.value] = parsedValue.value;
  }
  return { state: 'supported', value: Object.freeze(output) };
}

export interface CandidateAuthorityFatalCounters {
  readonly githubLogicalRequests: number;
  readonly npmLogicalRequests: number;
  readonly githubAttempts: number;
  readonly npmAttempts: number;
  readonly retries: number;
  readonly perOperation: Readonly<
    Record<
      string,
      { readonly logicalRequests: number; readonly attempts: number }
    >
  >;
}

export interface CandidateAuthorityFatalContext {
  readonly candidateId: string;
  readonly operationId: string;
}

export class CandidateAuthorityFirstFatalError extends Error {
  public readonly candidateId: string;
  public readonly operationId: string;
  public readonly safeCode: IngestionErrorCode;
  public readonly counters: CandidateAuthorityFatalCounters;

  public constructor(input: {
    readonly context: CandidateAuthorityFatalContext;
    readonly cause: unknown;
    readonly counters: CandidateAuthorityFatalCounters;
  }) {
    super(
      'Candidate authority collection stopped after its first fatal error.',
    );
    this.name = 'CandidateAuthorityFirstFatalError';
    this.candidateId = input.context.candidateId;
    this.operationId = input.context.operationId;
    this.safeCode = asSafeErrorCode(input.cause);
    this.counters = input.counters;
    Object.defineProperty(this, 'stack', { value: undefined });
  }
}

export async function runCandidateAuthorityFatalCancellingWorkers<T>(input: {
  readonly items: readonly T[];
  readonly workerCount: 5;
  readonly callerSignal?: AbortSignal;
  readonly context: (item: T, error: unknown) => CandidateAuthorityFatalContext;
  readonly execute: (item: T, signal: AbortSignal) => Promise<void>;
  readonly readFinalCounters: () => CandidateAuthorityFatalCounters;
}): Promise<void> {
  const internal = new AbortController();
  const signal =
    input.callerSignal === undefined
      ? internal.signal
      : AbortSignal.any([input.callerSignal, internal.signal]);
  let cursor = 0;
  let firstFatal:
    | {
        readonly context: CandidateAuthorityFatalContext;
        readonly cause: unknown;
      }
    | undefined;
  const workers = Array.from({ length: input.workerCount }, async () => {
    for (;;) {
      if (signal.aborted || firstFatal !== undefined) return;
      const index = cursor;
      cursor += 1;
      const item = input.items[index];
      if (item === undefined) return;
      try {
        await input.execute(item, signal);
      } catch (error) {
        if (input.callerSignal?.aborted) return;
        // Concurrent siblings may have populated this shared slot while this
        // worker awaited its in-flight request.
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (firstFatal === undefined) {
          firstFatal = { context: input.context(item, error), cause: error };
          internal.abort();
        }
        return;
      }
    }
  });
  await Promise.allSettled(workers);
  if (firstFatal !== undefined) {
    throw new CandidateAuthorityFirstFatalError({
      context: firstFatal.context,
      cause: firstFatal.cause,
      counters: input.readFinalCounters(),
    });
  }
  if (input.callerSignal?.aborted) throw ingestionError('ingestion.cancelled');
}

export interface CandidateAuthorityFatalDiagnosticEnvelope {
  readonly status: 'failed';
  readonly operatorVersion: typeof CANDIDATE_AUTHORITY_LIVE_OPERATOR_V4_VERSION;
  readonly authorizationVersion: string;
  readonly authorizationDigest: string;
  readonly executionHead: string;
  readonly collectionCutoff: string;
  readonly firstFatalCandidateId: string;
  readonly firstFatalOperationId: string;
  readonly safeErrorCode: IngestionErrorCode;
  readonly failureStage: 'candidate-authority-live-collect';
  readonly githubLogicalRequests: number;
  readonly npmLogicalRequests: number;
  readonly totalLogicalRequests: number;
  readonly githubAttempts: number;
  readonly npmAttempts: number;
  readonly totalAttempts: number;
  readonly retries: number;
  readonly perOperation: CandidateAuthorityFatalCounters['perOperation'];
  readonly ownedStagingExisted: boolean;
  readonly ownedStagingCleaned: boolean;
  readonly sourceAuthorityPublished: false;
}

export function createCandidateAuthorityFatalDiagnostic(input: {
  readonly authorizationVersion: string;
  readonly authorizationDigest: string;
  readonly executionHead: string;
  readonly collectionCutoff: string;
  readonly fatal: CandidateAuthorityFirstFatalError;
  readonly ownedStagingExisted: boolean;
  readonly ownedStagingCleaned: boolean;
}): CandidateAuthorityFatalDiagnosticEnvelope {
  requireSafeToken(input.authorizationVersion, 200);
  requireSha256(input.authorizationDigest);
  requireSha1(input.executionHead);
  exactTimestamp(input.collectionCutoff);
  requireSafeToken(input.fatal.candidateId, 100);
  requireSafeToken(input.fatal.operationId, 100);
  const counters = input.fatal.counters;
  return Object.freeze({
    status: 'failed',
    operatorVersion: CANDIDATE_AUTHORITY_LIVE_OPERATOR_V4_VERSION,
    authorizationVersion: input.authorizationVersion,
    authorizationDigest: input.authorizationDigest,
    executionHead: input.executionHead,
    collectionCutoff: input.collectionCutoff,
    firstFatalCandidateId: input.fatal.candidateId,
    firstFatalOperationId: input.fatal.operationId,
    safeErrorCode: input.fatal.safeCode,
    failureStage: 'candidate-authority-live-collect',
    githubLogicalRequests: counters.githubLogicalRequests,
    npmLogicalRequests: counters.npmLogicalRequests,
    totalLogicalRequests:
      counters.githubLogicalRequests + counters.npmLogicalRequests,
    githubAttempts: counters.githubAttempts,
    npmAttempts: counters.npmAttempts,
    totalAttempts: counters.githubAttempts + counters.npmAttempts,
    retries: counters.retries,
    perOperation: counters.perOperation,
    ownedStagingExisted: input.ownedStagingExisted,
    ownedStagingCleaned: input.ownedStagingCleaned,
    sourceAuthorityPublished: false,
  });
}

export function serializeCandidateAuthorityFatalDiagnostic(
  value: CandidateAuthorityFatalDiagnosticEnvelope,
): string {
  return `${canonicalizeJson(value).text}\n`;
}

function parseTreeEntry(value: unknown): CandidateAuthorityTreeEntry {
  const entry = requireRecord(value);
  return {
    path: requireSafeToken(entry['path'], 255),
    mode: requireSafeToken(entry['mode'], 6),
    type: requireSafeToken(entry['type'], 16),
    sha: requireSha1(entry['sha']),
    size:
      entry['size'] === undefined ? null : nonnegativeInteger(entry['size']),
  };
}

function exactNormalBlob(
  entries: readonly CandidateAuthorityTreeEntry[],
  path: string,
): CandidateAuthorityTreeEntry | null {
  const entry = entries.find((candidate) => candidate.path === path);
  if (entry === undefined) return null;
  return (entry.mode === '100644' || entry.mode === '100755') &&
    entry.type === 'blob'
    ? entry
    : null;
}

function requireNormalBlob(entry: CandidateAuthorityTreeEntry): void {
  if (
    (entry.mode !== '100644' && entry.mode !== '100755') ||
    entry.type !== 'blob'
  )
    identity();
}

function isExactReleaseToken(value: string): boolean {
  return /^v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u.test(
    value,
  );
}

function exactGithubUrl(value: unknown): string {
  const result = boundedString(value, 1000);
  let url: URL;
  try {
    url = new URL(result);
  } catch {
    return malformed();
  }
  if (url.protocol !== 'https:' || url.hostname !== 'github.com') malformed();
  return result;
}

function exactTimestamp(value: unknown): string {
  const result = boundedString(value, 40);
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/u.test(result) ||
    !Number.isFinite(Date.parse(result))
  )
    malformed();
  return new Date(result).toISOString();
}

function exactBoolean(value: unknown): boolean {
  if (typeof value !== 'boolean') malformed();
  return value;
}

function boundedString(value: unknown, maximum: number): string {
  if (
    typeof value !== 'string' ||
    value.length < 1 ||
    value.length > maximum ||
    hasControl(value)
  )
    malformed();
  return value;
}

function nonnegativeInteger(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0) malformed();
  return Number(value);
}

function requireSafeToken(value: unknown, maximum: number): string {
  return boundedString(value, maximum);
}

function requireSha1(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-f0-9]{40}$/u.test(value)) malformed();
  return value;
}

function requireSha256(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/u.test(value)) malformed();
  return value;
}

function hasControl(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 31 || code === 127) return true;
  }
  return false;
}

function identity(): never {
  throw ingestionError('ingestion.provider-identity');
}

function malformed(): never {
  throw ingestionError('ingestion.provider-response');
}

function invalidInput(): never {
  throw ingestionError('ingestion.invalid-input');
}
