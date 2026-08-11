import { canonicalizeJson } from './canonical-json.ts';
import { ingestionError } from './errors.ts';

export type CandidateAuthorityRuleResult<T> =
  | { readonly state: 'known'; readonly value: T }
  | { readonly state: 'unknown'; readonly reason: string }
  | { readonly state: 'conflict'; readonly reason: string };

export interface CandidateAuthorityReleaseValue {
  readonly snapshotAt: string;
  readonly latestReleaseVersion: string | null;
  readonly latestReleasePublishedAt: string | null;
  readonly prerelease: boolean | null;
}

export interface CandidateAuthorityAdvisoryValue {
  readonly snapshotAt: string;
  readonly applicableAdvisoryCount: number;
  readonly highestSeverity: 'critical' | 'high' | 'low' | 'moderate' | null;
}

export interface CandidateAuthorityMaintenanceValue {
  readonly snapshotAt: string;
  readonly lastCommitAt: string | null;
  readonly commitsInPrevious90Days: number;
}

export function projectCandidateAuthorityReleaseState(input: {
  readonly snapshotAt: string;
  readonly outcome:
    'established-absence' | 'established-value' | 'temporary-unavailable';
  readonly complete: boolean;
  readonly releases: readonly {
    readonly tagName: string;
    readonly publishedAt: string;
    readonly draft: boolean;
    readonly prerelease: boolean;
  }[];
}): CandidateAuthorityRuleResult<CandidateAuthorityReleaseValue> {
  requireTimestamp(input.snapshotAt);
  if (input.outcome === 'temporary-unavailable') {
    return {
      state: 'unknown',
      reason: 'release-source-temporarily-unavailable',
    };
  }
  if (input.outcome === 'established-absence') {
    if (!input.complete || input.releases.length !== 0) invalid();
    return { state: 'known', value: emptyReleaseValue(input.snapshotAt) };
  }
  for (const release of input.releases) {
    requireTimestamp(release.publishedAt);
    if (!isExactReleaseToken(release.tagName)) invalid();
  }
  if (!input.complete) {
    return { state: 'unknown', reason: 'release-window-not-complete' };
  }
  const selected = input.releases.find((release) => !release.draft);
  if (selected !== undefined) {
    return {
      state: 'known',
      value: {
        snapshotAt: input.snapshotAt,
        latestReleaseVersion: selected.tagName,
        latestReleasePublishedAt: selected.publishedAt,
        prerelease: selected.prerelease,
      },
    };
  }
  return { state: 'known', value: emptyReleaseValue(input.snapshotAt) };
}

export function projectCandidateAuthorityAdvisoryState(input: {
  readonly snapshotAt: string;
  readonly expectedPackageName: string | null;
  readonly expectedPackageVersion: string | null;
  readonly sourcePackageName: string | null;
  readonly sourcePackageVersion: string | null;
  readonly outcome: 'established-value' | 'temporary-unavailable';
  readonly complete: boolean;
  readonly advisories: readonly {
    readonly advisoryId: string;
    readonly severity: 'critical' | 'high' | 'low' | 'moderate';
  }[];
}): CandidateAuthorityRuleResult<CandidateAuthorityAdvisoryValue> {
  requireTimestamp(input.snapshotAt);
  if (
    input.expectedPackageName === null ||
    input.expectedPackageVersion === null
  ) {
    return {
      state: 'unknown',
      reason: 'repository-only-advisory-scope-cannot-be-not-applicable',
    };
  }
  if (
    input.sourcePackageName !== input.expectedPackageName ||
    input.sourcePackageVersion !== input.expectedPackageVersion
  ) {
    invalid();
  }
  if (input.outcome === 'temporary-unavailable' || !input.complete) {
    return {
      state: 'unknown',
      reason:
        input.outcome === 'temporary-unavailable'
          ? 'advisory-source-temporarily-unavailable'
          : 'advisory-pagination-not-complete',
    };
  }
  const seen = new Set<string>();
  for (const advisory of input.advisories) {
    if (!/^[a-z0-9][a-z0-9-]{0,63}$/u.test(advisory.advisoryId)) invalid();
    if (seen.has(advisory.advisoryId)) invalid();
    seen.add(advisory.advisoryId);
  }
  const severityOrder = ['low', 'moderate', 'high', 'critical'] as const;
  const highestSeverity = input.advisories.reduce<
    CandidateAuthorityAdvisoryValue['highestSeverity']
  >((highest, advisory) => {
    if (highest === null) return advisory.severity;
    return severityOrder.indexOf(advisory.severity) >
      severityOrder.indexOf(highest)
      ? advisory.severity
      : highest;
  }, null);
  return {
    state: 'known',
    value: {
      snapshotAt: input.snapshotAt,
      applicableAdvisoryCount: input.advisories.length,
      highestSeverity,
    },
  };
}

export function projectCandidateAuthoritySecurityPolicyPresence(input: {
  readonly outcome:
    'established-absence' | 'established-value' | 'temporary-unavailable';
  readonly present: boolean | null;
}): CandidateAuthorityRuleResult<{ readonly present: boolean }> {
  if (input.outcome === 'temporary-unavailable') {
    return {
      state: 'unknown',
      reason: 'community-profile-temporarily-unavailable',
    };
  }
  if (input.outcome === 'established-absence') {
    if (input.present !== null) invalid();
    return { state: 'known', value: { present: false } };
  }
  if (typeof input.present !== 'boolean') invalid();
  return { state: 'known', value: { present: input.present } };
}

export function projectCandidateAuthorityMaintenance(input: {
  readonly snapshotAt: string;
  readonly headSha: string;
  readonly lastCommitAt: string | null;
  readonly windowOutcome: 'complete' | 'temporary-unavailable' | 'unclosed';
  readonly commitsInPrevious90Days: number | null;
}): CandidateAuthorityRuleResult<CandidateAuthorityMaintenanceValue> {
  requireTimestamp(input.snapshotAt);
  if (!/^[a-f0-9]{40}$/u.test(input.headSha)) invalid();
  if (input.lastCommitAt !== null) requireTimestamp(input.lastCommitAt);
  if (input.windowOutcome !== 'complete') {
    if (input.commitsInPrevious90Days !== null) invalid();
    return {
      state: 'unknown',
      reason:
        input.windowOutcome === 'temporary-unavailable'
          ? 'maintenance-source-temporarily-unavailable'
          : 'maintenance-pagination-not-complete',
    };
  }
  if (
    input.commitsInPrevious90Days === null ||
    !Number.isSafeInteger(input.commitsInPrevious90Days) ||
    input.commitsInPrevious90Days < 0 ||
    input.commitsInPrevious90Days > 100_000
  ) {
    invalid();
  }
  return {
    state: 'known',
    value: {
      snapshotAt: input.snapshotAt,
      lastCommitAt: input.lastCommitAt,
      commitsInPrevious90Days: input.commitsInPrevious90Days,
    },
  };
}

export function resolveCandidateAuthorityRuleConflict<T>(
  left: CandidateAuthorityRuleResult<T>,
  right: CandidateAuthorityRuleResult<T>,
): CandidateAuthorityRuleResult<T> {
  if (left.state !== 'known') return left;
  if (right.state !== 'known') return right;
  return canonicalizeJson(left.value).digest ===
    canonicalizeJson(right.value).digest
    ? left
    : { state: 'conflict', reason: 'accepted-structured-sources-disagree' };
}

function emptyReleaseValue(snapshotAt: string): CandidateAuthorityReleaseValue {
  return {
    snapshotAt,
    latestReleaseVersion: null,
    latestReleasePublishedAt: null,
    prerelease: null,
  };
}

function isExactReleaseToken(value: string): boolean {
  return (
    /^[A-Za-z0-9][A-Za-z0-9._+/@-]{0,99}$/u.test(value) &&
    !/(?:^|[._+/@-])(?:canary|current|head|latest|main|master|next|stable)(?:$|[._+/@-])/iu.test(
      value,
    )
  );
}

function requireTimestamp(value: string): void {
  const parsed = Date.parse(value);
  if (
    !Number.isFinite(parsed) ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/u.test(value)
  )
    invalid();
}

function invalid(): never {
  throw ingestionError('ingestion.invalid-input');
}
