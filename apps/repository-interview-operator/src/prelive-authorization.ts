import { canonicalizeJson, sha256Digest } from '@gitblocks/interviews';

import { operatorIssue, type OperatorParseResult } from './operator-issues.ts';
import {
  compareText,
  hasExactKeys,
  isPlainRecord,
  ownAndFreezeOperatorData,
} from './plain-data.ts';

const DIGEST = /^[0-9a-f]{64}$/u;
const SAFE_ID = /^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/u;
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const ROOT_KEYS = [
  'schemaVersion',
  'authorizationId',
  'scope',
  'status',
  'candidatePlanId',
  'candidatePlanDigest',
  'artifactCollectionReceiptVersion',
  'artifactCollectionReceiptDigest',
  'selectionMaterializationDigest',
  'selectionId',
  'selectionDigest',
  'allowedModelProfileDigests',
  'specificationDigest',
  'catalogDigest',
  'artifactManifestDigest',
  'operatorPolicyDigest',
  'pricingAuthorityDigest',
  'retentionAuthorityDigest',
  'databaseScope',
  'maximumProviderCalls',
  'maximumCostMicroUsd',
  'authorizedAt',
  'expiresAt',
  'authorizationDigest',
] as const;

export interface RepositoryInterviewPreliveAuthorizationV1 {
  readonly schemaVersion: '1.0.0';
  readonly authorizationId: string;
  readonly scope: 'calibration-six';
  readonly status: 'approved';
  readonly candidatePlanId: string;
  readonly candidatePlanDigest: string;
  readonly artifactCollectionReceiptVersion: 'public-artifact-receipt/1.0.0';
  readonly artifactCollectionReceiptDigest: string;
  readonly selectionMaterializationDigest: string;
  readonly selectionId: string;
  readonly selectionDigest: string;
  readonly allowedModelProfileDigests: readonly [string, string];
  readonly specificationDigest: string;
  readonly catalogDigest: string;
  readonly artifactManifestDigest: string;
  readonly operatorPolicyDigest: string;
  readonly pricingAuthorityDigest: string;
  readonly retentionAuthorityDigest: string;
  readonly databaseScope: 'ephemeral-non-production';
  readonly maximumProviderCalls: number;
  readonly maximumCostMicroUsd: number;
  readonly authorizedAt: string;
  readonly expiresAt: string;
  readonly authorizationDigest: string;
}

type AuthorizationDraft = Omit<
  RepositoryInterviewPreliveAuthorizationV1,
  'authorizationDigest'
>;

export function repositoryInterviewPreliveAuthorizationDigestV1(
  authorization: AuthorizationDraft,
): string {
  return sha256Digest(
    `gitblocks\0repository-interview-prelive-authorization\0v1\0${canonicalizeJson(authorization)}`,
  );
}

export function createRepositoryInterviewPreliveAuthorizationV1(
  draft: AuthorizationDraft,
): RepositoryInterviewPreliveAuthorizationV1 {
  const base = ownAndFreezeOperatorData(draft) as AuthorizationDraft;
  const parsed = parseRepositoryInterviewPreliveAuthorizationV1({
    ...base,
    authorizationDigest: repositoryInterviewPreliveAuthorizationDigestV1(base),
  });
  if (!parsed.ok) throw new Error('Pre-live authorization is invalid.');
  return parsed.value;
}

export function parseRepositoryInterviewPreliveAuthorizationV1(
  input: unknown,
): OperatorParseResult<RepositoryInterviewPreliveAuthorizationV1> {
  try {
    const value = ownAndFreezeOperatorData(input);
    if (!isPlainRecord(value) || !hasExactKeys(value, ROOT_KEYS)) return bad();
    const profiles = value['allowedModelProfileDigests'];
    if (
      value['schemaVersion'] !== '1.0.0' ||
      !safeId(value['authorizationId']) ||
      value['scope'] !== 'calibration-six' ||
      value['status'] !== 'approved' ||
      !safeId(value['candidatePlanId']) ||
      !digest(value['candidatePlanDigest']) ||
      value['artifactCollectionReceiptVersion'] !==
        'public-artifact-receipt/1.0.0' ||
      !digest(value['artifactCollectionReceiptDigest']) ||
      !digest(value['selectionMaterializationDigest']) ||
      !safeId(value['selectionId']) ||
      !digest(value['selectionDigest']) ||
      !Array.isArray(profiles) ||
      profiles.length !== 2 ||
      !digest(profiles[0]) ||
      !digest(profiles[1]) ||
      compareText(profiles[0], profiles[1]) >= 0 ||
      !digest(value['specificationDigest']) ||
      !digest(value['catalogDigest']) ||
      !digest(value['artifactManifestDigest']) ||
      !digest(value['operatorPolicyDigest']) ||
      !digest(value['pricingAuthorityDigest']) ||
      !digest(value['retentionAuthorityDigest']) ||
      value['databaseScope'] !== 'ephemeral-non-production' ||
      value['maximumProviderCalls'] !== 12 ||
      !integerBetween(value['maximumCostMicroUsd'], 0, 10_000_000) ||
      !timestamp(value['authorizedAt']) ||
      !timestamp(value['expiresAt']) ||
      Date.parse(value['expiresAt']) <= Date.parse(value['authorizedAt']) ||
      !digest(value['authorizationDigest'])
    )
      return bad();
    const typed = value as unknown as RepositoryInterviewPreliveAuthorizationV1;
    const { authorizationDigest, ...base } = typed;
    if (
      repositoryInterviewPreliveAuthorizationDigestV1(base) !==
      authorizationDigest
    )
      return bad();
    return Object.freeze({ ok: true, value: typed, issues: [] as const });
  } catch {
    return bad();
  }
}

function safeId(value: unknown): value is string {
  return typeof value === 'string' && SAFE_ID.test(value);
}

function digest(value: unknown): value is string {
  return typeof value === 'string' && DIGEST.test(value);
}

function integerBetween(
  value: unknown,
  minimum: number,
  maximum: number,
): boolean {
  return (
    Number.isSafeInteger(value) &&
    Number(value) >= minimum &&
    Number(value) <= maximum
  );
}

function timestamp(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    TIMESTAMP.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value
  );
}

function bad(): OperatorParseResult<never> {
  return Object.freeze({
    ok: false,
    issues: Object.freeze([
      operatorIssue('operator.prelive-authorization-invalid'),
    ]),
  });
}
