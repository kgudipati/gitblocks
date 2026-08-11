import { addIssue, addStableIdIssues, type DomainIssue } from './issues.ts';
import type { EvidenceFreshness, EvidenceProvenance } from './model.ts';
import { parseUtcTimestamp } from './temporal.ts';

const FULL_LOWERCASE_GIT_SHA_PATTERN = /^[a-f0-9]{40}$/u;
const FULL_LOWERCASE_SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const EXACT_REVISION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._+/@-]{0,99}$/u;
const EXACT_PACKAGE_VERSION_PATTERN =
  /^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)(?:-(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u;
const EXACT_OPTIONAL_V_SEMANTIC_VERSION_PATTERN =
  /^v?(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)(?:-(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u;
const MUTABLE_REVISION_ALIAS_TOKEN_PATTERN =
  /(?:^|[._+/@-])(?:canary|current|head|latest|main|master|next|stable)(?:$|[._+/@-])/iu;
const MUTABLE_BRANCH_REFERENCE_PATTERN =
  /^(?:origin\/|refs\/(?:heads|remotes)\/)/iu;
const QUERY_LIKE_FRAGMENT_PATTERN = /[?&=]/u;
const ENCODED_QUERY_LIKE_FRAGMENT_PATTERN = /%(?:25)*(?:26|3d|3f)/iu;
const SAFE_EVIDENCE_URL_PATTERN =
  /^https:\/\/(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,62}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}(?::[0-9]{1,5})?(?:\/[A-Za-z0-9._~!$&()*+,;=:@%/-]*)?(?:#[A-Za-z0-9._~!$()*+,;:@%/-]*)?$/u;

type ImmutableEvidenceProvenance = Extract<
  EvidenceProvenance,
  {
    readonly kind:
      | 'git-commit'
      | 'package-version'
      | 'release'
      | 'security-advisory'
      | 'tag';
  }
>;

export function isMutableEvidenceRevisionAlias(value: string): boolean {
  if (EXACT_OPTIONAL_V_SEMANTIC_VERSION_PATTERN.test(value)) {
    return false;
  }
  return (
    MUTABLE_REVISION_ALIAS_TOKEN_PATTERN.test(value) ||
    MUTABLE_BRANCH_REFERENCE_PATTERN.test(value)
  );
}

function hasQueryLikeFragment(value: string): boolean {
  if (
    QUERY_LIKE_FRAGMENT_PATTERN.test(value) ||
    ENCODED_QUERY_LIKE_FRAGMENT_PATTERN.test(value)
  ) {
    return true;
  }
  try {
    return QUERY_LIKE_FRAGMENT_PATTERN.test(decodeURIComponent(value));
  } catch {
    return true;
  }
}

export function isSafeEvidenceUrl(value: string): boolean {
  if (!SAFE_EVIDENCE_URL_PATTERN.test(value)) {
    return false;
  }
  const fragmentIndex = value.indexOf('#');
  return (
    fragmentIndex < 0 || !hasQueryLikeFragment(value.slice(fragmentIndex + 1))
  );
}

export function hasExactEvidenceRevisionLocator(
  immutableUrl: string,
  revision: string,
): boolean {
  if (!isSafeEvidenceUrl(immutableUrl)) {
    return false;
  }

  const fragmentIndex = immutableUrl.indexOf('#');
  const location =
    fragmentIndex < 0 ? immutableUrl : immutableUrl.slice(0, fragmentIndex);
  const pathStart = location.indexOf('/', 'https://'.length);
  const path = pathStart < 0 ? '' : location.slice(pathStart);
  return path
    .split('/')
    .filter((segment) => segment.length > 0)
    .some((segment) => {
      if (segment === revision || segment === encodeURIComponent(revision)) {
        return true;
      }
      try {
        return decodeURIComponent(segment) === revision;
      } catch {
        return false;
      }
    });
}

function timestampAt(
  issues: DomainIssue[],
  value: string,
  path: string,
): number | null {
  const timestamp = parseUtcTimestamp(value);
  if (timestamp === null) {
    addIssue(issues, 'timestamp.invalid', path);
  }
  return timestamp;
}

function hasCompatibleSourceType(provenance: EvidenceProvenance): boolean {
  const sourceType = provenance.sourceType as string;
  switch (provenance.kind) {
    case 'git-commit':
    case 'tag':
      return (
        sourceType === 'license' ||
        sourceType === 'official-documentation' ||
        sourceType === 'official-repository'
      );
    case 'release':
      return sourceType === 'official-release';
    case 'package-version':
      return sourceType === 'package-registry';
    case 'security-advisory':
      return sourceType === 'security-advisory';
    case 'mutable-documentation':
      return sourceType === 'official-documentation';
    case 'structured-provider-snapshot':
      return sourceType === 'public-structured-provider';
    case 'approved-validation':
      return sourceType === 'approved-validation';
  }
}

function revisionOf(provenance: ImmutableEvidenceProvenance): string {
  switch (provenance.kind) {
    case 'git-commit':
      return provenance.commitSha;
    case 'tag':
      return provenance.tag;
    case 'release':
      return provenance.release;
    case 'package-version':
      return provenance.packageVersion;
    case 'security-advisory':
      return provenance.advisoryId;
  }
}

function addImmutableProvenanceIssues(
  issues: DomainIssue[],
  provenance: ImmutableEvidenceProvenance,
  path: string,
): readonly [publishedAt: number | null, collectedAt: number | null] {
  if (!isSafeEvidenceUrl(provenance.sourceUrl)) {
    addIssue(issues, 'evidence.url', `${path}.sourceUrl`);
  }
  if (!isSafeEvidenceUrl(provenance.immutableUrl)) {
    addIssue(issues, 'evidence.url', `${path}.immutableUrl`);
  }

  const revision = revisionOf(provenance);
  if (
    provenance.kind === 'git-commit' &&
    !FULL_LOWERCASE_GIT_SHA_PATTERN.test(revision)
  ) {
    addIssue(issues, 'evidence.revision', `${path}.commitSha`);
  }
  if (
    (provenance.kind === 'tag' || provenance.kind === 'release') &&
    (!EXACT_REVISION_PATTERN.test(revision) ||
      isMutableEvidenceRevisionAlias(revision))
  ) {
    addIssue(issues, 'evidence.revision', path);
  }
  if (
    provenance.kind === 'package-version' &&
    !EXACT_PACKAGE_VERSION_PATTERN.test(revision)
  ) {
    addIssue(issues, 'evidence.revision', `${path}.packageVersion`);
  }
  if (provenance.kind === 'security-advisory') {
    addStableIdIssues(issues, provenance.advisoryId, `${path}.advisoryId`);
  }
  if (!hasExactEvidenceRevisionLocator(provenance.immutableUrl, revision)) {
    addIssue(issues, 'evidence.locator', `${path}.immutableUrl`);
  }

  return [
    timestampAt(issues, provenance.publishedAt, `${path}.publishedAt`),
    timestampAt(issues, provenance.collectedAt, `${path}.collectedAt`),
  ];
}

function addTemporalOrderIssue(
  issues: DomainIssue[],
  eventTimes: readonly (number | null)[],
  freshnessAsOf: number | null,
  evidenceCutoff: number | null,
  path: string,
): void {
  const orderedTimes = [...eventTimes, freshnessAsOf];
  for (let index = 1; index < orderedTimes.length; index += 1) {
    const previous = orderedTimes[index - 1];
    const current = orderedTimes[index];
    if (
      previous !== null &&
      previous !== undefined &&
      current !== null &&
      current !== undefined &&
      previous > current
    ) {
      addIssue(issues, 'evidence.temporal-order', path);
      return;
    }
  }
  if (
    evidenceCutoff !== null &&
    orderedTimes.some(
      (timestamp) => timestamp !== null && timestamp > evidenceCutoff,
    )
  ) {
    addIssue(issues, 'evidence.temporal-order', path);
  }
}

export function addEvidenceProvenanceIssues(
  issues: DomainIssue[],
  provenance: EvidenceProvenance,
  freshness: EvidenceFreshness,
  evidenceCutoff: string | null,
  path: string,
): void {
  if (!hasCompatibleSourceType(provenance)) {
    addIssue(
      issues,
      'evidence.source-compatibility',
      `${path}.provenance.sourceType`,
    );
  }

  const freshnessAsOf = timestampAt(
    issues,
    freshness.asOf,
    `${path}.freshness.asOf`,
  );
  const cutoff =
    evidenceCutoff === null ? null : parseUtcTimestamp(evidenceCutoff);

  switch (provenance.kind) {
    case 'git-commit':
    case 'tag':
    case 'release':
    case 'package-version':
    case 'security-advisory': {
      const [publishedAt, collectedAt] = addImmutableProvenanceIssues(
        issues,
        provenance,
        `${path}.provenance`,
      );
      addTemporalOrderIssue(
        issues,
        [publishedAt, collectedAt],
        freshnessAsOf,
        cutoff,
        path,
      );
      return;
    }
    case 'mutable-documentation': {
      if (!isSafeEvidenceUrl(provenance.sourceUrl)) {
        addIssue(issues, 'evidence.url', `${path}.provenance.sourceUrl`);
      }
      const limitationCode: string = provenance.limitationCode;
      if (limitationCode !== 'source-is-mutable') {
        addIssue(issues, 'evidence.revision', `${path}.provenance`);
      }
      const collectedAt = timestampAt(
        issues,
        provenance.collectedAt,
        `${path}.provenance.collectedAt`,
      );
      addTemporalOrderIssue(issues, [collectedAt], freshnessAsOf, cutoff, path);
      return;
    }
    case 'structured-provider-snapshot': {
      if (!isSafeEvidenceUrl(provenance.sourceUrl)) {
        addIssue(issues, 'evidence.url', `${path}.provenance.sourceUrl`);
      }
      addStableIdIssues(
        issues,
        provenance.sourceIdentity,
        `${path}.provenance.sourceIdentity`,
      );
      const provider: string = provenance.provider;
      const sourceClass: string = provenance.sourceClass;
      const sourceMutability: string = provenance.sourceMutability;
      const completenessState: string = provenance.completenessState;
      const limitationCode: string = provenance.limitationCode;
      if (
        !['github', 'npm'].includes(provider) ||
        ![
          'package-metadata',
          'repository-community-profile',
          'repository-maintenance',
          'repository-metadata',
          'repository-release-state',
          'security-advisory-index',
        ].includes(sourceClass) ||
        sourceMutability !== 'mutable' ||
        !['complete', 'established-absence'].includes(completenessState) ||
        limitationCode !== 'source-is-mutable'
      ) {
        addIssue(issues, 'evidence.source-compatibility', `${path}.provenance`);
      }
      for (const [name, digest] of [
        ['sourceAuthorityDigest', provenance.sourceAuthorityDigest],
        ['sourceRecordDigest', provenance.sourceRecordDigest],
      ] as const) {
        if (!FULL_LOWERCASE_SHA256_PATTERN.test(digest)) {
          addIssue(issues, 'evidence.revision', `${path}.provenance.${name}`);
        }
      }
      const effectiveAsOf = timestampAt(
        issues,
        provenance.effectiveAsOf,
        `${path}.provenance.effectiveAsOf`,
      );
      const collectedAt = timestampAt(
        issues,
        provenance.collectedAt,
        `${path}.provenance.collectedAt`,
      );
      addTemporalOrderIssue(
        issues,
        [effectiveAsOf, collectedAt],
        freshnessAsOf,
        cutoff,
        path,
      );
      return;
    }
    case 'approved-validation': {
      addStableIdIssues(
        issues,
        provenance.validationReferenceId,
        `${path}.provenance.validationReferenceId`,
      );
      addStableIdIssues(issues, provenance.scope, `${path}.provenance.scope`);
      const validatedAt = timestampAt(
        issues,
        provenance.validatedAt,
        `${path}.provenance.validatedAt`,
      );
      addTemporalOrderIssue(issues, [validatedAt], freshnessAsOf, cutoff, path);
    }
  }
}
