import { canonicalizeJson, sha256Digest } from '@gitblocks/interviews';

import {
  REPOSITORY_INTERVIEW_ARTIFACT_MANIFEST_DIGEST,
  REPOSITORY_INTERVIEW_ARTIFACT_MANIFEST_VERSION,
  REPOSITORY_INTERVIEW_CATALOG_DIGEST,
  REPOSITORY_INTERVIEW_CATALOG_VERSION,
} from './candidate-plan.ts';
import { operatorIssue, type OperatorParseResult } from './operator-issues.ts';
import {
  hasExactKeys,
  isPlainRecord,
  ownAndFreezeOperatorData,
} from './plain-data.ts';

const DIGEST = /^[0-9a-f]{64}$/u;
const SAFE_ID = /^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/u;
const ROOT_KEYS = [
  'schemaVersion',
  'materializationId',
  'candidatePlanId',
  'candidatePlanDigest',
  'artifactCollectionReceiptVersion',
  'artifactCollectionReceiptDigest',
  'catalogVersion',
  'catalogDigest',
  'artifactManifestVersion',
  'artifactManifestDigest',
  'operatorSelectionId',
  'operatorSelectionDigest',
  'candidateCount',
  'materializationDigest',
] as const;

export interface RepositoryInterviewSelectionMaterializationV1 {
  readonly schemaVersion: '1.0.0';
  readonly materializationId: string;
  readonly candidatePlanId: string;
  readonly candidatePlanDigest: string;
  readonly artifactCollectionReceiptVersion: 'public-artifact-receipt/1.0.0';
  readonly artifactCollectionReceiptDigest: string;
  readonly catalogVersion: 'public-v1';
  readonly catalogDigest: typeof REPOSITORY_INTERVIEW_CATALOG_DIGEST;
  readonly artifactManifestVersion: 'public-artifacts-v1';
  readonly artifactManifestDigest: typeof REPOSITORY_INTERVIEW_ARTIFACT_MANIFEST_DIGEST;
  readonly operatorSelectionId: string;
  readonly operatorSelectionDigest: string;
  readonly candidateCount: number;
  readonly materializationDigest: string;
}

type MaterializationDraft = Omit<
  RepositoryInterviewSelectionMaterializationV1,
  'materializationDigest'
>;

export function repositoryInterviewSelectionMaterializationDigestV1(
  materialization: MaterializationDraft,
): string {
  return sha256Digest(
    `gitblocks\0repository-interview-selection-materialization\0v1\0${canonicalizeJson(materialization)}`,
  );
}

export function createRepositoryInterviewSelectionMaterializationV1(
  draft: MaterializationDraft,
): RepositoryInterviewSelectionMaterializationV1 {
  const base = ownAndFreezeOperatorData(draft) as MaterializationDraft;
  const parsed = parseRepositoryInterviewSelectionMaterializationV1({
    ...base,
    materializationDigest:
      repositoryInterviewSelectionMaterializationDigestV1(base),
  });
  if (!parsed.ok) throw new Error('Selection materialization is invalid.');
  return parsed.value;
}

export function parseRepositoryInterviewSelectionMaterializationV1(
  input: unknown,
): OperatorParseResult<RepositoryInterviewSelectionMaterializationV1> {
  try {
    const value = ownAndFreezeOperatorData(input);
    if (!isPlainRecord(value) || !hasExactKeys(value, ROOT_KEYS)) return bad();
    if (
      value['schemaVersion'] !== '1.0.0' ||
      !safeId(value['materializationId']) ||
      !safeId(value['candidatePlanId']) ||
      !digest(value['candidatePlanDigest']) ||
      value['artifactCollectionReceiptVersion'] !==
        'public-artifact-receipt/1.0.0' ||
      !digest(value['artifactCollectionReceiptDigest']) ||
      value['catalogVersion'] !== REPOSITORY_INTERVIEW_CATALOG_VERSION ||
      value['catalogDigest'] !== REPOSITORY_INTERVIEW_CATALOG_DIGEST ||
      value['artifactManifestVersion'] !==
        REPOSITORY_INTERVIEW_ARTIFACT_MANIFEST_VERSION ||
      value['artifactManifestDigest'] !==
        REPOSITORY_INTERVIEW_ARTIFACT_MANIFEST_DIGEST ||
      !safeId(value['operatorSelectionId']) ||
      !digest(value['operatorSelectionDigest']) ||
      !Number.isSafeInteger(value['candidateCount']) ||
      Number(value['candidateCount']) < 1 ||
      Number(value['candidateCount']) > 150 ||
      !digest(value['materializationDigest'])
    )
      return bad();
    const typed =
      value as unknown as RepositoryInterviewSelectionMaterializationV1;
    const { materializationDigest, ...base } = typed;
    if (
      repositoryInterviewSelectionMaterializationDigestV1(base) !==
      materializationDigest
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

function bad(): OperatorParseResult<never> {
  return Object.freeze({
    ok: false,
    issues: Object.freeze([
      operatorIssue('operator.selection-materialization-invalid'),
    ]),
  });
}
