import type {
  DeterministicCandidateProfile,
  DeterministicProfileFieldRecord,
} from '@gitblocks/domain';
import { describe, expect, it } from 'vitest';

import { createHostedDiscoveryApplication } from '../src/application.ts';
import {
  capabilityInput,
  createAcceptedApplication,
  loadAcceptedAuthorities,
} from './fixtures.ts';

describe('hosted discovery application', () => {
  it('normalizes an accepted capability request and returns only bounded eligible candidates after hard exclusion', async () => {
    const [application, authorities] = await Promise.all([
      createAcceptedApplication(),
      loadAcceptedAuthorities(),
    ]);
    const discovered = application.discoverCapability(
      capabilityInput({ id: 'accepted-authorization', term: 'authorization' }),
    );

    expect(discovered.ok).toBe(true);
    if (!discovered.ok || discovered.result.outcome !== 'retrieved') return;
    expect(discovered.result.normalization.outcome).toBe('normalized');
    expect(
      discovered.result.shortlist.eligibleCandidates.length,
    ).toBeGreaterThan(0);
    expect(
      discovered.result.shortlist.eligibleCandidates.length,
    ).toBeLessThanOrEqual(10);
    expect(discovered.result.shortlist.evidenceNeededCandidates).toEqual([]);
    expect(
      discovered.result.shortlist.preRetrievalLaneCounts.excluded,
    ).toBeGreaterThan(0);

    const primaryFamilies = new Map(
      authorities.profiles.profiles.map((profile) => [
        profile.candidateId,
        primaryFamily(profile as unknown as DeterministicCandidateProfile),
      ]),
    );
    expect(
      discovered.result.shortlist.eligibleCandidates.every(
        ({ candidateId }) =>
          primaryFamilies.get(candidateId) === 'authorization',
      ),
    ).toBe(true);
  });

  it('keeps unresolved hard constraints in the evidence-needed lane instead of eligible', async () => {
    const application = await createAcceptedApplication();
    const discovered = application.discoverCapability(
      capabilityInput({
        id: 'authorization-architecture',
        term: 'authorization',
        constraints: [
          {
            constraintId: 'in-process-required',
            modality: 'required',
            statement: 'The candidate must be an in-process library.',
            originalTerm: 'in-process-authorization-library',
            facetHint: 'architecture',
            reasonCode: 'required-architecture',
          },
        ],
      }),
    );

    expect(discovered.ok).toBe(true);
    if (!discovered.ok || discovered.result.outcome !== 'retrieved') return;
    expect(discovered.result.shortlist.eligibleCandidates).toEqual([]);
    expect(
      discovered.result.shortlist.evidenceNeededCandidates.length,
    ).toBeGreaterThan(0);
    expect(
      discovered.result.shortlist.evidenceNeededCandidates.every(
        ({ unresolvedHardEvaluations }) => unresolvedHardEvaluations.length > 0,
      ),
    ).toBe(true);
  });

  it('preserves clarification-required normalization without invoking retrieval', async () => {
    const application = await createAcceptedApplication();
    const discovered = application.discoverCapability(
      capabilityInput({ id: 'subjective-capability', term: 'lightweight' }),
    );

    expect(discovered).toMatchObject({
      ok: true,
      result: {
        outcome: 'clarification-required',
        normalization: { outcome: 'clarification-required' },
      },
    });
  });

  it('preserves unsupported normalization without inventing a shortlist', async () => {
    const application = await createAcceptedApplication();
    const discovered = application.discoverCapability(
      capabilityInput({ id: 'unsupported-capability', term: 'authentication' }),
    );

    expect(discovered).toMatchObject({
      ok: true,
      result: {
        outcome: 'unsupported',
        normalization: { outcome: 'unsupported' },
      },
    });
  });

  it('rejects repository fingerprints at the retrieval use-case boundary', async () => {
    const application = await createAcceptedApplication();
    const discovered = application.discoverCapability(
      capabilityInput({
        id: 'fingerprinted-capability',
        term: 'authorization',
        repositoryFingerprintReference: {
          fingerprintId: 'target-fingerprint',
          fingerprintDigest: 'a'.repeat(64),
        },
      }),
    );

    expect(discovered).toEqual({
      ok: false,
      failure: {
        kind: 'application',
        code: 'repository-fingerprint-not-supported',
        path: '/repositoryFingerprintReference',
        message:
          'Repository fingerprints are not supported by capability discovery.',
      },
    });
  });

  it('returns contract issues for malformed external input and deterministic output for repeated valid input', async () => {
    const application = await createAcceptedApplication();
    expect(application.discoverCapability({})).toMatchObject({
      ok: false,
      failure: { kind: 'contract' },
    });

    const input = capabilityInput({
      id: 'deterministic-authorization',
      term: 'authorization',
    });
    const first = application.discoverCapability(input);
    const second = application.discoverCapability(input);
    expect(second).toEqual(first);
  });

  it('fails application construction when its engine and snapshot authority disagree', async () => {
    const authorities = await loadAcceptedAuthorities();
    const created = createHostedDiscoveryApplication({
      snapshot: {
        snapshotId: 'serving-invalid-count',
        snapshotRecordDigest: 'b'.repeat(64),
        candidateCount: 149,
      },
      taxonomy: authorities.taxonomy,
      candidateProfileAuthority: authorities.profiles,
      retrievalExpansionAuthority: authorities.retrievalExpansion,
      candidateRetrievalMetadataAuthority: authorities.metadata,
      engine: {
        candidateCount: 150,
        retrieve: () => ({ ok: false, issues: [] }),
      },
    });
    expect(created).toEqual({
      ok: false,
      code: 'invalid-application-authority',
    });
  });
});

function primaryFamily(profile: DeterministicCandidateProfile): string | null {
  const field = profile.fields.find(
    (candidate) => candidate.fieldId === 'capability-family',
  ) as DeterministicProfileFieldRecord<'capability-family'> | undefined;
  return field?.state === 'known' ? field.value.primaryFamily : null;
}
