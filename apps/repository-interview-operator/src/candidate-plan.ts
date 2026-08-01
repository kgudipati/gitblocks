import { canonicalizeJson, sha256Digest } from '@gitblocks/interviews';

import { operatorIssue, type OperatorParseResult } from './operator-issues.ts';
import {
  compareText,
  hasExactKeys,
  isPlainRecord,
  ownAndFreezeOperatorData,
} from './plain-data.ts';

export const REPOSITORY_INTERVIEW_CATALOG_VERSION = 'public-v1' as const;
export const REPOSITORY_INTERVIEW_CATALOG_DIGEST =
  '4819dd94cb1bbe5e27c31ca5ca55976da1442987a792bf438d96681021cb8634' as const;
export const REPOSITORY_INTERVIEW_ARTIFACT_MANIFEST_VERSION =
  'public-artifacts-v1' as const;
export const REPOSITORY_INTERVIEW_ARTIFACT_MANIFEST_DIGEST =
  '17d2a47f8d992275c95d55434bfc24776fb8ac51fc626e7610502f687bf3d02c' as const;

const DIGEST = /^[0-9a-f]{64}$/u;
const CANDIDATE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/u;
const SAFE_ID = /^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/u;
const ROOT_KEYS = [
  'schemaVersion',
  'planId',
  'catalogVersion',
  'catalogDigest',
  'artifactManifestVersion',
  'artifactManifestDigest',
  'candidateIds',
  'planDigest',
] as const;

export interface RepositoryInterviewCandidatePlanV1 {
  readonly schemaVersion: '1.0.0';
  readonly planId: string;
  readonly catalogVersion: 'public-v1';
  readonly catalogDigest: typeof REPOSITORY_INTERVIEW_CATALOG_DIGEST;
  readonly artifactManifestVersion: 'public-artifacts-v1';
  readonly artifactManifestDigest: typeof REPOSITORY_INTERVIEW_ARTIFACT_MANIFEST_DIGEST;
  readonly candidateIds: readonly string[];
  readonly planDigest: string;
}

type CandidatePlanDraft = Omit<
  RepositoryInterviewCandidatePlanV1,
  'planDigest'
>;

export function repositoryInterviewCandidatePlanDigestV1(
  plan: CandidatePlanDraft,
): string {
  return sha256Digest(
    `gitblocks\0repository-interview-candidate-plan\0v1\0${canonicalizeJson(plan)}`,
  );
}

export function createRepositoryInterviewCandidatePlanV1(
  draft: CandidatePlanDraft,
): RepositoryInterviewCandidatePlanV1 {
  const base = ownAndFreezeOperatorData(draft) as CandidatePlanDraft;
  const parsed = parseRepositoryInterviewCandidatePlanV1({
    ...base,
    planDigest: repositoryInterviewCandidatePlanDigestV1(base),
  });
  if (!parsed.ok) throw new Error('Candidate plan is invalid.');
  return parsed.value;
}

export function parseRepositoryInterviewCandidatePlanV1(
  input: unknown,
): OperatorParseResult<RepositoryInterviewCandidatePlanV1> {
  try {
    const value = ownAndFreezeOperatorData(input);
    if (!isPlainRecord(value) || !hasExactKeys(value, ROOT_KEYS)) return bad();
    const candidateIds = value['candidateIds'];
    if (
      value['schemaVersion'] !== '1.0.0' ||
      typeof value['planId'] !== 'string' ||
      !SAFE_ID.test(value['planId']) ||
      value['catalogVersion'] !== REPOSITORY_INTERVIEW_CATALOG_VERSION ||
      value['catalogDigest'] !== REPOSITORY_INTERVIEW_CATALOG_DIGEST ||
      value['artifactManifestVersion'] !==
        REPOSITORY_INTERVIEW_ARTIFACT_MANIFEST_VERSION ||
      value['artifactManifestDigest'] !==
        REPOSITORY_INTERVIEW_ARTIFACT_MANIFEST_DIGEST ||
      !Array.isArray(candidateIds) ||
      candidateIds.length < 1 ||
      candidateIds.length > 150 ||
      !DIGEST.test(String(value['planDigest']))
    )
      return bad();
    for (let index = 0; index < candidateIds.length; index += 1) {
      const candidateId: unknown = candidateIds[index];
      if (
        typeof candidateId !== 'string' ||
        !CANDIDATE.test(candidateId) ||
        (index > 0 &&
          compareText(String(candidateIds[index - 1]), candidateId) >= 0)
      )
        return bad();
    }
    const typed = value as unknown as RepositoryInterviewCandidatePlanV1;
    const { planDigest, ...base } = typed;
    if (repositoryInterviewCandidatePlanDigestV1(base) !== planDigest) {
      return bad();
    }
    return Object.freeze({ ok: true, value: typed, issues: [] as const });
  } catch {
    return bad();
  }
}

function bad(): OperatorParseResult<never> {
  return Object.freeze({
    ok: false,
    issues: Object.freeze([operatorIssue('operator.candidate-plan-invalid')]),
  });
}
