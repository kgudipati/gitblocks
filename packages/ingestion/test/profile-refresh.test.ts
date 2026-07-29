import { describe, expect, it } from 'vitest';

import {
  CAPABILITY_FAMILIES,
  planCandidateRefresh,
  profileCandidate,
} from '../src/index.ts';
import { testBundle } from './fixtures.ts';

describe('deterministic candidate profiling and refresh', () => {
  it('produces a contract-valid bounded dossier without interpreting file text as instructions', () => {
    const profile = profileCandidate(testBundle());
    expect(profile.dossier.contractVersion).toBe('1.0.0');
    expect(profile.dossier.identity.package?.name).toBe(
      '@gitblocks-test/candidate',
    );
    expect(profile.observations.length).toBeLessThanOrEqual(100);
    expect(
      profile.observations.some((observation) =>
        observation.observation.includes('untrusted-and-never-executed'),
      ),
    ).toBe(false);
    expect(profile.unknowns.map((unknown) => unknown.topic)).toContain(
      'capability-fit-unknown',
    );
  });

  it('represents every retained capability family without ranking or viability output', () => {
    for (const family of CAPABILITY_FAMILIES) {
      const profile = profileCandidate(
        testBundle({
          candidate: {
            ...testBundle().candidate,
            primaryCapabilityFamily: family,
          },
        }),
      );
      expect(profile.dossier.capabilityFamily).toBe(family);
      expect(profile.dossier).not.toHaveProperty('score');
      expect(profile.dossier).not.toHaveProperty('disposition');
    }
  });

  it('creates deterministic archive, deprecation, package-link, and advisory limitations', () => {
    const base = testBundle();
    const profile = profileCandidate(
      testBundle({
        repository: { ...base.repository, isArchived: true },
        npm:
          base.npm === null
            ? null
            : {
                ...base.npm,
                deprecated: true,
                repositoryUrl: 'https://github.com/another/project',
              },
        advisories: {
          complete: true,
          limitationCode: null,
          advisories: [
            {
              advisoryId: 'ghsa-2345-6789-cfgh',
              htmlUrl: 'https://github.com/advisories/GHSA-2345-6789-cfgh',
              publishedAt: '2026-07-26T12:00:00.000Z',
              updatedAt: '2026-07-27T12:00:00.000Z',
              withdrawnAt: null,
              severity: 'high',
            },
          ],
        },
      }),
    );
    expect(profile.limitations.map((entry) => entry.limitationCode)).toEqual(
      expect.arrayContaining([
        'repository-archived',
        'npm-version-deprecated',
        'package-repository-mismatch',
        'known-applicable-advisory',
      ]),
    );
  });

  it('reuses exact prior evidence and keeps the snapshot stable on an unchanged rerun', () => {
    const first = profileCandidate(testBundle());
    const second = profileCandidate(
      testBundle({ collectedAt: '2026-07-30T12:00:00.000Z' }),
      first.observations,
    );
    expect(second.observations).toEqual(first.observations);
    expect(second.evidenceCutoff).toBe(first.evidenceCutoff);
    expect(second.snapshotId).toBe(first.snapshotId);
    expect(planCandidateRefresh(first.observations, second)).toEqual({
      observationsToAppend: [],
      supersessions: [],
      invalidations: [],
      unchangedEvidenceIds: first.observations
        .map((observation) => observation.evidenceId)
        .sort(),
    });
  });

  it('supersedes changed head evidence and avoids invalidation for incomplete optional sources', () => {
    const first = profileCandidate(testBundle());
    const changed = profileCandidate(
      testBundle({
        collectedAt: '2026-07-30T12:00:00.000Z',
        commit: {
          sha: '3333333333333333333333333333333333333333',
          htmlUrl:
            'https://github.com/gitblocks-test/candidate/commit/3333333333333333333333333333333333333333',
          committedAt: '2026-07-30T10:00:00.000Z',
        },
        releases: [],
        incompleteSourceCodes: ['github-releases-unavailable'],
      }),
      first.observations,
    );
    const refresh = planCandidateRefresh(first.observations, changed);
    expect(
      refresh.supersessions.some((record) => {
        const old = first.observations.find(
          (observation) =>
            observation.evidenceId === record.supersededEvidenceId,
        );
        return old?.topic === 'repository-head';
      }),
    ).toBe(true);
    expect(
      refresh.invalidations.some((record) => {
        const old = first.observations.find(
          (observation) => observation.evidenceId === record.evidenceId,
        );
        return old?.topic === 'release-current';
      }),
    ).toBe(false);
  });
});
