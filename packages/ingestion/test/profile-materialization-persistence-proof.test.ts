import { describe, expect, it } from 'vitest';

import {
  PROFILE_MATERIALIZATION_ACCEPTED_BINDINGS,
  attachProfileMaterializationEvidenceIds,
  createProfileMaterializationPersistenceProof,
  deriveProfileMaterializationLiveIdempotency,
  parseProfileMaterializationPersistenceProof,
  persistenceProofCounts,
  profileCandidate,
  qualifiedNotPersistedEntry,
  reconcileProfileMaterializationSourceAuthority,
  repositoryFileTopic,
  selectCurrentRelease,
  type ProfileMaterializationPersistenceEntry,
  type ProfileMaterializationSourceRecordInput,
  type CandidateSourceBundle,
} from '../src/index.ts';
import { buildFakeSourceAuthority } from './profile-materialization-fixtures.ts';
import { testBundle } from './fixtures.ts';

describe('profile-materialization durable persistence proof', () => {
  it('closes 150 canonical persisted candidates and authenticates aggregate counts', async () => {
    const fixture = await buildFakeSourceAuthority();
    const proof = createProfileMaterializationPersistenceProof({
      collection: 'first',
      databaseSchemaDigest:
        PROFILE_MATERIALIZATION_ACCEPTED_BINDINGS.databaseSchemaDigest,
      migrationInventoryDigest:
        PROFILE_MATERIALIZATION_ACCEPTED_BINDINGS.migrationInventoryDigest,
      catalogDigest: fixture.catalog.manifestDigest,
      sourceAuthoritySemanticDigest: fixture.authority.authoritySemanticDigest,
      candidateCount: 150,
      entries: persistedEntries(fixture.authority.candidates, 'created'),
    });
    expect(parseProfileMaterializationPersistenceProof(proof)).toEqual(proof);
    expect(persistenceProofCounts(proof)).toMatchObject({
      persistedCandidateCount: 150,
      qualifiedNotPersistedCount: 0,
      created: 150,
      updated: 0,
      unchanged: 0,
      candidateCreated: 150,
      candidateIdempotent: 0,
      snapshotCreated: 150,
      snapshotIdempotent: 0,
    });
  });

  it('rejects missing, reordered, duplicate, and digest-drifted entries', async () => {
    const fixture = await buildFakeSourceAuthority();
    const input = {
      collection: 'first' as const,
      databaseSchemaDigest:
        PROFILE_MATERIALIZATION_ACCEPTED_BINDINGS.databaseSchemaDigest,
      migrationInventoryDigest:
        PROFILE_MATERIALIZATION_ACCEPTED_BINDINGS.migrationInventoryDigest,
      catalogDigest: fixture.catalog.manifestDigest,
      sourceAuthoritySemanticDigest: fixture.authority.authoritySemanticDigest,
      candidateCount: 150 as const,
      entries: persistedEntries(fixture.authority.candidates, 'created'),
    };
    expect(() =>
      createProfileMaterializationPersistenceProof({
        ...input,
        entries: input.entries.slice(1),
      }),
    ).toThrow();
    expect(() =>
      createProfileMaterializationPersistenceProof({
        ...input,
        entries: [...input.entries].reverse(),
      }),
    ).toThrow();
    const proof = createProfileMaterializationPersistenceProof(input);
    expect(() =>
      parseProfileMaterializationPersistenceProof({
        ...proof,
        proofSemanticDigest: '0'.repeat(64),
      }),
    ).toThrow();
  });

  it('requires database-backed unchanged replay before live idempotency passes', async () => {
    const first = await buildFakeSourceAuthority({
      collectedAt: '2026-08-05T00:00:00.000Z',
    });
    const secondCollected = await buildFakeSourceAuthority({
      collectedAt: '2026-08-05T01:00:00.000Z',
    });
    const second = reconcileProfileMaterializationSourceAuthority(
      first.authority,
      secondCollected.authority.sourceRecords,
      {
        policy: first.policy,
        catalog: first.catalog,
        taxonomy: first.taxonomy,
      },
    );
    const firstProof = createProfileMaterializationPersistenceProof({
      collection: 'first',
      databaseSchemaDigest:
        PROFILE_MATERIALIZATION_ACCEPTED_BINDINGS.databaseSchemaDigest,
      migrationInventoryDigest:
        PROFILE_MATERIALIZATION_ACCEPTED_BINDINGS.migrationInventoryDigest,
      catalogDigest: first.catalog.manifestDigest,
      sourceAuthoritySemanticDigest: first.authority.authoritySemanticDigest,
      candidateCount: 150,
      entries: persistedEntries(first.authority.candidates, 'created'),
    });
    const secondProof = createProfileMaterializationPersistenceProof({
      collection: 'second',
      databaseSchemaDigest:
        PROFILE_MATERIALIZATION_ACCEPTED_BINDINGS.databaseSchemaDigest,
      migrationInventoryDigest:
        PROFILE_MATERIALIZATION_ACCEPTED_BINDINGS.migrationInventoryDigest,
      catalogDigest: first.catalog.manifestDigest,
      sourceAuthoritySemanticDigest: second.authoritySemanticDigest,
      candidateCount: 150,
      entries: persistedEntries(second.candidates, 'unchanged'),
    });
    expect(
      deriveProfileMaterializationLiveIdempotency({
        firstAuthority: first.authority,
        secondAuthority: second,
        firstProof,
        secondProof,
      }),
    ).toBe('passed');

    const seededOnly = {
      ...secondProof,
      entries: secondProof.entries.map((entry) => ({
        ...entry,
        outcome: 'created',
        candidateState: 'created',
        snapshotState: 'created',
      })),
    };
    expect(() =>
      deriveProfileMaterializationLiveIdempotency({
        firstAuthority: first.authority,
        secondAuthority: second,
        firstProof,
        secondProof: seededOnly as never,
      }),
    ).toThrow();
  });

  it('rejects every persistence mutation or new snapshot for unchanged source content', async () => {
    const fixture = await buildFakeSourceAuthority();
    const firstProof = proofFor(
      fixture.authority,
      'first',
      persistedEntries(fixture.authority.candidates, 'created'),
    );
    const unchanged = persistedEntries(
      fixture.authority.candidates,
      'unchanged',
    );
    const mutations: readonly Partial<ProfileMaterializationPersistenceEntry>[] =
      [
        { evidenceAppended: 1 },
        { evidenceSuperseded: 1 },
        { evidenceInvalidated: 1 },
        { snapshotState: 'created' },
        { outcome: 'updated', evidenceAppended: 1 },
      ];
    for (const mutation of mutations) {
      const entries = unchanged.map((entry, index) =>
        index === 0 ? { ...entry, ...mutation } : entry,
      );
      const secondProof = proofFor(fixture.authority, 'second', entries);
      expect(() =>
        deriveProfileMaterializationLiveIdempotency({
          firstAuthority: fixture.authority,
          secondAuthority: fixture.authority,
          firstProof,
          secondProof,
        }),
      ).toThrow();
    }
  });

  it('requires persistence evidence to agree with mutable provider drift', async () => {
    const first = await buildFakeSourceAuthority();
    const changed = await buildFakeSourceAuthority({
      mutate: (records) => {
        const repository = records.find(
          (record) => record.operation === 'github-repository-metadata',
        )!;
        (repository.normalizedValue as Record<string, unknown>)['topics'] = [
          'provider-drift',
        ];
      },
    });
    const firstProof = proofFor(
      first.authority,
      'first',
      persistedEntries(first.authority.candidates, 'created'),
    );
    const unchangedWithoutEvidence = persistedEntries(
      changed.authority.candidates,
      'unchanged',
    ).map((entry) => ({ ...entry, evidenceIdempotent: 0 }));
    expect(() =>
      deriveProfileMaterializationLiveIdempotency({
        firstAuthority: first.authority,
        secondAuthority: changed.authority,
        firstProof,
        secondProof: proofFor(
          changed.authority,
          'second',
          unchangedWithoutEvidence,
        ),
      }),
    ).toThrow();

    const updated = persistedEntries(
      changed.authority.candidates,
      'unchanged',
    ).map((entry, index) =>
      index === 0
        ? {
            ...entry,
            outcome: 'updated' as const,
            evidenceAppended: 1,
            evidenceIdempotent: 0,
          }
        : entry,
    );
    expect(
      deriveProfileMaterializationLiveIdempotency({
        firstAuthority: first.authority,
        secondAuthority: changed.authority,
        firstProof,
        secondProof: proofFor(changed.authority, 'second', updated),
      }),
    ).toBe('passed-with-provider-drift');
  });

  it('maps exact controlled observation topics without reading observation prose', () => {
    const bundle = testBundle();
    const profile = profileCandidate(bundle);
    const records = evidenceMappingRecords(
      bundle.candidate.candidateId,
      bundle.advisories.advisories.map((advisory) => advisory.advisoryId),
    );
    const bound = attachProfileMaterializationEvidenceIds(records, profile);
    const byOperation = new Map(
      bound.map((record) => [record.operation, record.evidenceIds ?? []]),
    );
    expect(byOperation.get('github-repository-metadata')).toEqual(
      evidenceFor(profile, ['repository-identity', 'repository-state']),
    );
    expect(byOperation.get('github-default-branch-head')).toEqual(
      evidenceFor(profile, ['repository-head']),
    );
    expect(byOperation.get('npm-package')).toEqual(
      evidenceFor(profile, [
        'npm-latest-version',
        'npm-runtime-shape',
        'repository-package-linkage',
      ]),
    );
    expect(byOperation.get('github-advisory')).toEqual(
      evidenceFor(
        profile,
        profile.observations
          .map((observation) => observation.topic)
          .filter((topic) => topic.startsWith('security-advisory-')),
      ),
    );
    const acceptedEvidence = new Set(
      profile.observations.map((observation) => observation.evidenceId),
    );
    expect(
      bound
        .flatMap((record) => record.evidenceIds ?? [])
        .every((evidenceId) => acceptedEvidence.has(evidenceId)),
    ).toBe(true);

    const changedProse = {
      ...profile,
      observations: profile.observations.map((observation) => ({
        ...observation,
        observation: 'Untrusted prose must not select evidence.',
      })),
    };
    expect(
      attachProfileMaterializationEvidenceIds(records, changedProse).map(
        (record) => record.evidenceIds,
      ),
    ).toEqual(bound.map((record) => record.evidenceIds));

    expect(
      attachProfileMaterializationEvidenceIds(
        records.map((record) => ({
          ...record,
          evidenceIds: ['invented-evidence-id'],
        })),
        profile,
      ).flatMap((record) => record.evidenceIds ?? []),
    ).not.toContain('invented-evidence-id');
  });

  it('requires release-current evidence exactly when the shared rule selects a release', () => {
    const bundle = testBundle();
    const profile = profileCandidate(bundle);
    const record = releaseRecord(bundle, bundle.releases);
    expect(
      attachProfileMaterializationEvidenceIds([record], profile)[0]
        ?.evidenceIds,
    ).toEqual(evidenceFor(profile, ['release-current']));

    const withoutReleaseEvidence = {
      ...profile,
      observations: profile.observations.filter(
        (observation) => observation.topic !== 'release-current',
      ),
    };
    expect(() =>
      attachProfileMaterializationEvidenceIds([record], withoutReleaseEvidence),
    ).toThrow();

    const releaseObservation = profile.observations.find(
      (observation) => observation.topic === 'release-current',
    );
    if (releaseObservation?.source.kind !== 'release') {
      throw new Error('Missing selected-release fixture observation.');
    }
    const wrongSelectedRelease = replaceObservation(
      profile,
      releaseObservation.evidenceId,
      {
        source: { ...releaseObservation.source, release: 'v9.9.9' },
      },
    );
    expect(() =>
      attachProfileMaterializationEvidenceIds([record], wrongSelectedRelease),
    ).toThrow();

    const changedProse = {
      ...profile,
      observations: profile.observations.map((observation) =>
        observation.topic === 'release-current'
          ? { ...observation, observation: 'Changed untrusted release prose.' }
          : observation,
      ),
    };
    expect(
      attachProfileMaterializationEvidenceIds([record], changedProse)[0]
        ?.evidenceIds,
    ).toEqual(evidenceFor(profile, ['release-current']));
  });

  it('does not fabricate release evidence when no release is selected', () => {
    const bundle = testBundle({
      releases: [
        { ...testBundle().releases[0]!, tag: 'latest' },
        { ...testBundle().releases[0]!, tag: 'v2.0.0', isDraft: true },
      ],
    });
    const profile = profileCandidate(bundle);
    expect(profile.observations).not.toContainEqual(
      expect.objectContaining({ topic: 'release-current' }),
    );
    expect(
      attachProfileMaterializationEvidenceIds(
        [releaseRecord(bundle, bundle.releases)],
        profile,
      )[0]?.evidenceIds,
    ).toEqual([]);
  });

  it('shares the exact legacy release-selection rule with profileCandidate', () => {
    const original = testBundle().releases[0]!;
    const releases = [
      { ...original, tag: 'v9.0.0', isDraft: true },
      { ...original, tag: 'latest' },
      { ...original, tag: 'v1.2.3' },
    ];
    const selected = selectCurrentRelease(releases);
    expect(selected).toBe(releases[2]);
    const profile = profileCandidate(testBundle({ releases }));
    expect(
      profile.observations.find(
        (observation) => observation.topic === 'release-current',
      )?.source,
    ).toMatchObject({ kind: 'release', release: selected?.tag });
  });

  it('requires the exact repository-file topic, commit, and encoded path', () => {
    const bundle = testBundle();
    const profile = profileCandidate(bundle);
    const record = repositoryFileRecord(bundle, 'package.json');
    const exactTopic = repositoryFileTopic('package.json');
    const fileObservation = profile.observations.find(
      (observation) => observation.topic === exactTopic,
    );
    if (fileObservation?.source.kind !== 'git-commit') {
      throw new Error('Missing repository-file fixture observation.');
    }
    expect(
      attachProfileMaterializationEvidenceIds([record], profile)[0]
        ?.evidenceIds,
    ).toEqual([fileObservation.evidenceId]);

    const suffixCollision = replaceObservation(
      profile,
      fileObservation.evidenceId,
      {
        source: {
          ...fileObservation.source,
          immutableUrl: `https://github.com/gitblocks-test/candidate/blob/${bundle.commit.sha}/docs/package.json`,
        },
      },
    );
    expect(() =>
      attachProfileMaterializationEvidenceIds([record], suffixCollision),
    ).toThrow();

    const wrongCommit = replaceObservation(
      profile,
      fileObservation.evidenceId,
      {
        source: {
          ...fileObservation.source,
          commitSha: '2'.repeat(40),
        },
      },
    );
    expect(() =>
      attachProfileMaterializationEvidenceIds([record], wrongCommit),
    ).toThrow();

    const wrongPath = replaceObservation(profile, fileObservation.evidenceId, {
      source: {
        ...fileObservation.source,
        immutableUrl: `https://github.com/gitblocks-test/candidate/blob/${bundle.commit.sha}/other.json`,
      },
    });
    expect(() =>
      attachProfileMaterializationEvidenceIds([record], wrongPath),
    ).toThrow();

    const prefixOnlyTopic = replaceObservation(
      profile,
      fileObservation.evidenceId,
      { topic: `${fileObservation.topic}-unrelated` },
    );
    expect(() =>
      attachProfileMaterializationEvidenceIds([record], prefixOnlyTopic),
    ).toThrow();
  });

  it('permits empty evidence for established absence but rejects unrelated value mapping', () => {
    const bundle = testBundle();
    const profile = profileCandidate(bundle);
    const absent: ProfileMaterializationSourceRecordInput = {
      candidateId: bundle.candidate.candidateId,
      sourceType: 'github-license',
      operation: 'github-license',
      logicalSourceKey: `commit:${bundle.commit.sha}`,
      sourceMutability: 'immutable',
      outcome: 'established-absence',
      immutableReference: bundle.commit.sha,
      collectedAt: bundle.collectedAt,
      normalizedValue: null,
      controlledCode: 'provider-not-found',
      evidenceIds: [],
    };
    expect(
      attachProfileMaterializationEvidenceIds([absent], profile)[0]
        ?.evidenceIds,
    ).toEqual([]);

    const absentFile: ProfileMaterializationSourceRecordInput = {
      ...repositoryFileRecord(bundle, 'package.json'),
      outcome: 'established-absence',
      normalizedValue: null,
      controlledCode: 'provider-not-found',
      evidenceIds: [],
    };
    expect(
      attachProfileMaterializationEvidenceIds([absentFile], profile)[0]
        ?.evidenceIds,
    ).toEqual([]);

    const unrelated: ProfileMaterializationSourceRecordInput = {
      candidateId: bundle.candidate.candidateId,
      sourceType: 'github-file',
      operation: 'github-allowlisted-file',
      logicalSourceKey: `commit:${bundle.commit.sha}:path:UNRELATED.md`,
      sourceMutability: 'immutable',
      outcome: 'established-value',
      immutableReference: `${bundle.commit.sha}:UNRELATED.md`,
      collectedAt: bundle.collectedAt,
      normalizedValue: {
        path: 'UNRELATED.md',
        sha: bundle.commit.sha,
      },
      controlledCode: null,
      evidenceIds: [],
    };
    expect(() =>
      attachProfileMaterializationEvidenceIds([unrelated], profile),
    ).toThrow();
  });

  it('retains qualified optional-source candidates without claiming durable replay', async () => {
    const candidateId = 'auth-casbin-casbin-js';
    const fixture = await buildFakeSourceAuthority({
      mutate: (records) => {
        for (let index = 0; index < records.length; index += 1) {
          const record = records[index]!;
          if (record.candidateId !== candidateId) continue;
          records[index] = { ...record, evidenceIds: [] };
        }
        const licenseIndex = records.findIndex(
          (record) =>
            record.candidateId === candidateId &&
            record.operation === 'github-license',
        );
        records[licenseIndex] = {
          ...records[licenseIndex]!,
          outcome: 'unavailable',
          normalizedValue: null,
          controlledCode: 'provider-temporarily-unavailable',
          evidenceIds: [],
        };
      },
    });
    const entries = persistedEntries(
      fixture.authority.candidates,
      'created',
    ).map((entry) =>
      entry.candidateId === candidateId
        ? {
            candidateId,
            disposition: 'qualified-not-persisted' as const,
            controlledOptionalSourceCodes: ['provider-temporarily-unavailable'],
            outcome: null,
            candidateState: null,
            snapshotState: null,
            snapshotId: null,
            evidenceAppended: 0,
            evidenceIdempotent: 0,
            evidenceSuperseded: 0,
            evidenceInvalidated: 0,
            limitationCount: 0,
            unknownCount: 0,
          }
        : entry,
    );
    const first = createProfileMaterializationPersistenceProof({
      collection: 'first',
      databaseSchemaDigest:
        PROFILE_MATERIALIZATION_ACCEPTED_BINDINGS.databaseSchemaDigest,
      migrationInventoryDigest:
        PROFILE_MATERIALIZATION_ACCEPTED_BINDINGS.migrationInventoryDigest,
      catalogDigest: fixture.catalog.manifestDigest,
      sourceAuthoritySemanticDigest: fixture.authority.authoritySemanticDigest,
      candidateCount: 150,
      entries,
    });
    const second = createProfileMaterializationPersistenceProof({
      collection: 'second',
      databaseSchemaDigest:
        PROFILE_MATERIALIZATION_ACCEPTED_BINDINGS.databaseSchemaDigest,
      migrationInventoryDigest:
        PROFILE_MATERIALIZATION_ACCEPTED_BINDINGS.migrationInventoryDigest,
      catalogDigest: fixture.catalog.manifestDigest,
      sourceAuthoritySemanticDigest: fixture.authority.authoritySemanticDigest,
      candidateCount: 150,
      entries: entries.map((entry) =>
        entry.disposition === 'qualified-not-persisted'
          ? entry
          : {
              ...entry,
              outcome: 'unchanged' as const,
              candidateState: 'idempotent' as const,
              snapshotState: 'idempotent' as const,
              evidenceAppended: 0,
              evidenceIdempotent: 1,
            },
      ),
    });
    expect(persistenceProofCounts(first)).toMatchObject({
      persistedCandidateCount: 149,
      qualifiedNotPersistedCount: 1,
    });
    expect(
      deriveProfileMaterializationLiveIdempotency({
        firstAuthority: fixture.authority,
        secondAuthority: fixture.authority,
        firstProof: first,
        secondProof: second,
      }),
    ).toBe('qualified-optional-source-failures');
  });

  it('qualifies an immutable value-to-unavailable transition after a durable first pass', async () => {
    const candidateId = 'auth-casbin-casbin-js';
    const first = await buildFakeSourceAuthority();
    const secondCollected = await buildFakeSourceAuthority({
      collectedAt: '2026-08-05T01:00:00.000Z',
      mutate: (records) => {
        const index = records.findIndex(
          (record) =>
            record.candidateId === candidateId &&
            record.operation === 'github-license',
        );
        records[index] = {
          ...records[index]!,
          outcome: 'unavailable',
          normalizedValue: null,
          controlledCode: 'provider-temporarily-unavailable',
          evidenceIds: [],
        };
      },
    });
    const second = reconcileProfileMaterializationSourceAuthority(
      first.authority,
      secondCollected.authority.sourceRecords,
      first,
    );
    const secondEntries = persistedEntries(second.candidates, 'unchanged').map(
      (entry) =>
        entry.candidateId === candidateId
          ? qualifiedNotPersistedEntry(candidateId, [
              'provider-temporarily-unavailable',
            ])
          : entry,
    );
    expect(
      deriveProfileMaterializationLiveIdempotency({
        firstAuthority: first.authority,
        secondAuthority: second,
        firstProof: proofFor(
          first.authority,
          'first',
          persistedEntries(first.authority.candidates, 'created'),
        ),
        secondProof: proofFor(second, 'second', secondEntries),
      }),
    ).toBe('qualified-optional-source-failures');
  });
});

function persistedEntries(
  candidates: readonly { readonly candidateId: string }[],
  outcome: 'created' | 'unchanged',
): readonly ProfileMaterializationPersistenceEntry[] {
  return candidates.map((candidate, index) => ({
    candidateId: candidate.candidateId,
    disposition: 'persisted',
    controlledOptionalSourceCodes: [],
    outcome,
    candidateState: outcome === 'created' ? 'created' : 'idempotent',
    snapshotState: outcome === 'created' ? 'created' : 'idempotent',
    snapshotId: `snap-${String(index).padStart(3, '0')}`,
    evidenceAppended: outcome === 'created' ? 1 : 0,
    evidenceIdempotent: outcome === 'created' ? 0 : 1,
    evidenceSuperseded: 0,
    evidenceInvalidated: 0,
    limitationCount: 0,
    unknownCount: 1,
  }));
}

function proofFor(
  authority: Awaited<ReturnType<typeof buildFakeSourceAuthority>>['authority'],
  collection: 'first' | 'second',
  entries: readonly ProfileMaterializationPersistenceEntry[],
) {
  return createProfileMaterializationPersistenceProof({
    collection,
    databaseSchemaDigest:
      PROFILE_MATERIALIZATION_ACCEPTED_BINDINGS.databaseSchemaDigest,
    migrationInventoryDigest:
      PROFILE_MATERIALIZATION_ACCEPTED_BINDINGS.migrationInventoryDigest,
    catalogDigest: authority.catalogDigest,
    sourceAuthoritySemanticDigest: authority.authoritySemanticDigest,
    candidateCount: 150,
    entries,
  });
}

function evidenceMappingRecords(
  candidateId: string,
  advisoryIds: readonly string[],
): readonly ProfileMaterializationSourceRecordInput[] {
  const collectedAt = '2026-08-05T00:00:00.000Z';
  const base = {
    candidateId,
    logicalSourceKey: 'singleton',
    outcome: 'established-value' as const,
    immutableReference: null,
    collectedAt,
    controlledCode: null,
    evidenceIds: [],
  };
  return [
    {
      ...base,
      sourceType: 'github-repository',
      operation: 'github-repository-metadata',
      sourceMutability: 'mutable',
      normalizedValue: {},
    },
    {
      ...base,
      sourceType: 'github-head-commit',
      operation: 'github-default-branch-head',
      sourceMutability: 'mutable',
      normalizedValue: {},
    },
    {
      ...base,
      sourceType: 'npm-package',
      operation: 'npm-package',
      sourceMutability: 'mutable',
      normalizedValue: {},
    },
    {
      ...base,
      sourceType: 'github-advisory',
      operation: 'github-advisory',
      sourceMutability: 'mutable',
      normalizedValue: {
        advisories: advisoryIds.map((advisoryId) => ({ advisoryId })),
      },
    },
  ];
}

function evidenceFor(
  profile: ReturnType<typeof profileCandidate>,
  topics: readonly string[],
): readonly string[] {
  return profile.observations
    .filter((observation) => topics.includes(observation.topic))
    .map((observation) => observation.evidenceId)
    .sort();
}

function releaseRecord(
  bundle: CandidateSourceBundle,
  releases: CandidateSourceBundle['releases'],
): ProfileMaterializationSourceRecordInput {
  return {
    candidateId: bundle.candidate.candidateId,
    sourceType: 'github-release',
    operation: 'github-release',
    logicalSourceKey: 'singleton',
    sourceMutability: 'mutable',
    outcome: 'established-value',
    immutableReference: null,
    collectedAt: bundle.collectedAt,
    normalizedValue: {
      releases: releases.map((release) => ({
        tag: release.tag,
        publishedAt: release.publishedAt,
        isDraft: release.isDraft,
        isPrerelease: release.isPrerelease,
      })),
    },
    controlledCode: null,
    evidenceIds: [],
  };
}

function repositoryFileRecord(
  bundle: CandidateSourceBundle,
  path: string,
): ProfileMaterializationSourceRecordInput {
  return {
    candidateId: bundle.candidate.candidateId,
    sourceType: 'github-file',
    operation: 'github-allowlisted-file',
    logicalSourceKey: `commit:${bundle.commit.sha}:path:${path}`,
    sourceMutability: 'immutable',
    outcome: 'established-value',
    immutableReference: `${bundle.commit.sha}:${path}`,
    collectedAt: bundle.collectedAt,
    normalizedValue: {
      path,
      sha: bundle.files[0]?.sha ?? '2'.repeat(40),
    },
    controlledCode: null,
    evidenceIds: [],
  };
}

function replaceObservation(
  profile: ReturnType<typeof profileCandidate>,
  evidenceId: string,
  replacement: Partial<
    ReturnType<typeof profileCandidate>['observations'][number]
  >,
): ReturnType<typeof profileCandidate> {
  return {
    ...profile,
    observations: profile.observations.map((observation) =>
      observation.evidenceId === evidenceId
        ? { ...observation, ...replacement }
        : observation,
    ),
  };
}
