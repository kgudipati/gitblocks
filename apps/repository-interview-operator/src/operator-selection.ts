import { canonicalizeJson, sha256Digest } from '@gitblocks/interviews';

import { operatorIssue, type OperatorParseResult } from './operator-issues.ts';
import {
  compareText,
  hasExactKeys,
  isPlainRecord,
  ownAndFreezeOperatorData,
} from './plain-data.ts';

const DIGEST = /^[0-9a-f]{64}$/u;
const CANDIDATE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/u;
const ARTIFACT_SET = /^artifact-set-[0-9a-f]{48}$/u;
const SAFE_ID = /^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/u;
const ROOT_KEYS = [
  'schemaVersion',
  'selectionId',
  'catalogVersion',
  'catalogDigest',
  'artifactManifestVersion',
  'artifactManifestDigest',
  'members',
  'selectionDigest',
] as const;
const MEMBER_KEYS = [
  'ordinal',
  'candidateId',
  'artifactSetId',
  'artifactSetIdentityDigest',
] as const;

export interface RepositoryInterviewOperatorSelectionMemberV1 {
  readonly ordinal: number;
  readonly candidateId: string;
  readonly artifactSetId: string;
  readonly artifactSetIdentityDigest: string;
}

export interface RepositoryInterviewOperatorSelectionV1 {
  readonly schemaVersion: '1.0.0';
  readonly selectionId: string;
  readonly catalogVersion: string;
  readonly catalogDigest: string;
  readonly artifactManifestVersion: string;
  readonly artifactManifestDigest: string;
  readonly members: readonly RepositoryInterviewOperatorSelectionMemberV1[];
  readonly selectionDigest: string;
}

type SelectionDraft = Omit<
  RepositoryInterviewOperatorSelectionV1,
  'selectionDigest'
> & { readonly selectionDigest?: undefined };

export function repositoryInterviewOperatorSelectionDigestV1(
  selection: Omit<RepositoryInterviewOperatorSelectionV1, 'selectionDigest'>,
): string {
  return sha256Digest(
    `gitblocks\0repository-interview-operator-selection\0v1\0${canonicalizeJson(selection)}`,
  );
}

export function createRepositoryInterviewOperatorSelectionV1(
  draft: SelectionDraft,
): RepositoryInterviewOperatorSelectionV1 {
  const base = ownAndFreezeOperatorData({
    schemaVersion: draft.schemaVersion,
    selectionId: draft.selectionId,
    catalogVersion: draft.catalogVersion,
    catalogDigest: draft.catalogDigest,
    artifactManifestVersion: draft.artifactManifestVersion,
    artifactManifestDigest: draft.artifactManifestDigest,
    members: draft.members,
  }) as Omit<RepositoryInterviewOperatorSelectionV1, 'selectionDigest'>;
  const value = {
    ...base,
    selectionDigest: repositoryInterviewOperatorSelectionDigestV1(base),
  };
  const parsed = parseRepositoryInterviewOperatorSelectionV1(value);
  if (!parsed.ok) throw new Error('Operator selection is invalid.');
  return parsed.value;
}

export function parseRepositoryInterviewOperatorSelectionV1(
  input: unknown,
): OperatorParseResult<RepositoryInterviewOperatorSelectionV1> {
  try {
    const value = ownAndFreezeOperatorData(input);
    if (!isPlainRecord(value) || !hasExactKeys(value, ROOT_KEYS)) return bad();
    const members = value['members'];
    if (
      value['schemaVersion'] !== '1.0.0' ||
      typeof value['selectionId'] !== 'string' ||
      !SAFE_ID.test(value['selectionId']) ||
      typeof value['catalogVersion'] !== 'string' ||
      !SAFE_ID.test(value['catalogVersion']) ||
      !DIGEST.test(String(value['catalogDigest'])) ||
      typeof value['artifactManifestVersion'] !== 'string' ||
      !SAFE_ID.test(value['artifactManifestVersion']) ||
      !DIGEST.test(String(value['artifactManifestDigest'])) ||
      !Array.isArray(members) ||
      members.length < 1 ||
      members.length > 150 ||
      !DIGEST.test(String(value['selectionDigest']))
    )
      return bad();
    const seenCandidates = new Set<string>();
    const seenSets = new Set<string>();
    let priorKey = '';
    for (let index = 0; index < members.length; index += 1) {
      const member: unknown = members[index];
      if (
        !isPlainRecord(member) ||
        !hasExactKeys(member, MEMBER_KEYS) ||
        member['ordinal'] !== index ||
        typeof member['candidateId'] !== 'string' ||
        !CANDIDATE.test(member['candidateId']) ||
        typeof member['artifactSetId'] !== 'string' ||
        !ARTIFACT_SET.test(member['artifactSetId']) ||
        !DIGEST.test(String(member['artifactSetIdentityDigest'])) ||
        seenCandidates.has(member['candidateId']) ||
        seenSets.has(member['artifactSetId'])
      )
        return bad();
      const orderKey = `${member['candidateId']}\0${member['artifactSetId']}`;
      if (index > 0 && compareText(priorKey, orderKey) >= 0) return bad();
      priorKey = orderKey;
      seenCandidates.add(member['candidateId']);
      seenSets.add(member['artifactSetId']);
    }
    const typed = value as unknown as RepositoryInterviewOperatorSelectionV1;
    const { selectionDigest, ...base } = typed;
    if (repositoryInterviewOperatorSelectionDigestV1(base) !== selectionDigest)
      return bad();
    return Object.freeze({ ok: true, value: typed, issues: [] as const });
  } catch {
    return bad();
  }
}

function bad(): OperatorParseResult<never> {
  return Object.freeze({
    ok: false,
    issues: Object.freeze([operatorIssue('operator.selection-invalid')]),
  });
}
