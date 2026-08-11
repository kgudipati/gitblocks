import { describe, expect, it } from 'vitest';

import {
  projectCandidateAuthorityAdvisoryState,
  projectCandidateAuthorityMaintenance,
  projectCandidateAuthorityReleaseState,
  projectCandidateAuthoritySecurityPolicyPresence,
  resolveCandidateAuthorityRuleConflict,
} from '../src/index.ts';

const SNAPSHOT = '2026-08-01T00:00:00.000Z';
const HEAD = '0123456789abcdef0123456789abcdef01234567';

describe('candidate-authority additive successor rules', () => {
  it('preserves complete release absence as a known nullable value', () => {
    expect(
      projectCandidateAuthorityReleaseState({
        snapshotAt: SNAPSHOT,
        outcome: 'established-absence',
        complete: true,
        releases: [],
      }),
    ).toEqual({
      state: 'known',
      value: {
        snapshotAt: SNAPSHOT,
        latestReleaseVersion: null,
        latestReleasePublishedAt: null,
        prerelease: null,
      },
    });
  });

  it('projects a positive release but refuses an unresolved bounded window', () => {
    expect(
      projectCandidateAuthorityReleaseState({
        snapshotAt: SNAPSHOT,
        outcome: 'established-value',
        complete: false,
        releases: [
          {
            tagName: 'v2.1.0',
            publishedAt: '2026-07-30T00:00:00.000Z',
            draft: false,
            prerelease: false,
          },
        ],
      }),
    ).toMatchObject({
      state: 'known',
      value: { latestReleaseVersion: 'v2.1.0' },
    });
    expect(
      projectCandidateAuthorityReleaseState({
        snapshotAt: SNAPSHOT,
        outcome: 'established-value',
        complete: false,
        releases: [
          {
            tagName: 'v3.0.0-rc.1',
            publishedAt: '2026-07-31T00:00:00.000Z',
            draft: true,
            prerelease: true,
          },
        ],
      }),
    ).toEqual({ state: 'unknown', reason: 'release-window-not-complete' });
  });

  it('preserves complete zero advisories but does not manufacture repo-only not-applicability', () => {
    expect(
      projectCandidateAuthorityAdvisoryState({
        snapshotAt: SNAPSHOT,
        expectedPackageName: 'example',
        expectedPackageVersion: '1.0.0',
        sourcePackageName: 'example',
        sourcePackageVersion: '1.0.0',
        outcome: 'established-value',
        complete: true,
        advisories: [],
      }),
    ).toEqual({
      state: 'known',
      value: {
        snapshotAt: SNAPSHOT,
        applicableAdvisoryCount: 0,
        highestSeverity: null,
      },
    });
    expect(
      projectCandidateAuthorityAdvisoryState({
        snapshotAt: SNAPSHOT,
        expectedPackageName: null,
        expectedPackageVersion: null,
        sourcePackageName: null,
        sourcePackageVersion: null,
        outcome: 'established-value',
        complete: true,
        advisories: [],
      }),
    ).toMatchObject({
      state: 'unknown',
      reason: 'repository-only-advisory-scope-cannot-be-not-applicable',
    });
  });

  it('rejects package identity mismatch and malformed or unsupported input', () => {
    expect(() =>
      projectCandidateAuthorityAdvisoryState({
        snapshotAt: SNAPSHOT,
        expectedPackageName: 'expected',
        expectedPackageVersion: '1.0.0',
        sourcePackageName: 'other',
        sourcePackageVersion: '1.0.0',
        outcome: 'established-value',
        complete: true,
        advisories: [],
      }),
    ).toThrow();
    expect(() =>
      projectCandidateAuthorityReleaseState({
        snapshotAt: SNAPSHOT,
        outcome: 'established-value',
        complete: true,
        releases: [
          {
            tagName: 'latest',
            publishedAt: SNAPSHOT,
            draft: false,
            prerelease: false,
          },
        ],
      }),
    ).toThrow();
  });

  it('maps accepted community-profile absence to false and temporary failure to unknown', () => {
    expect(
      projectCandidateAuthoritySecurityPolicyPresence({
        outcome: 'established-absence',
        present: null,
      }),
    ).toEqual({ state: 'known', value: { present: false } });
    expect(
      projectCandidateAuthoritySecurityPolicyPresence({
        outcome: 'temporary-unavailable',
        present: null,
      }),
    ).toMatchObject({ state: 'unknown' });
  });

  it('requires pagination closure for maintenance, including a valid known zero', () => {
    expect(
      projectCandidateAuthorityMaintenance({
        snapshotAt: SNAPSHOT,
        headSha: HEAD,
        lastCommitAt: null,
        windowOutcome: 'complete',
        commitsInPrevious90Days: 0,
      }),
    ).toEqual({
      state: 'known',
      value: {
        snapshotAt: SNAPSHOT,
        lastCommitAt: null,
        commitsInPrevious90Days: 0,
      },
    });
    expect(
      projectCandidateAuthorityMaintenance({
        snapshotAt: SNAPSHOT,
        headSha: HEAD,
        lastCommitAt: '2026-07-30T00:00:00.000Z',
        windowOutcome: 'unclosed',
        commitsInPrevious90Days: null,
      }),
    ).toEqual({
      state: 'unknown',
      reason: 'maintenance-pagination-not-complete',
    });
  });

  it('emits conflict rather than selecting a convenient disagreeing value', () => {
    expect(
      resolveCandidateAuthorityRuleConflict(
        { state: 'known', value: { present: true } },
        { state: 'known', value: { present: false } },
      ),
    ).toEqual({
      state: 'conflict',
      reason: 'accepted-structured-sources-disagree',
    });
  });
});
