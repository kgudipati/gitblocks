import { describe, expect, it } from 'vitest';

import {
  catalogCandidateCapabilityFamilies,
  catalogCandidateIdentity,
  profileCandidate,
  type CatalogCandidate,
} from '../src/index.ts';
import { TEST_CANDIDATE, testBundle } from './fixtures.ts';

describe('catalog persistence mapping authority', () => {
  it('maps exact repository identity and an npm package into owned frozen values', () => {
    const identity = catalogCandidateIdentity(TEST_CANDIDATE);

    expect(identity).toEqual({
      candidateId: TEST_CANDIDATE.candidateId,
      displayName: TEST_CANDIDATE.displayName,
      repository: {
        host: 'github',
        owner: TEST_CANDIDATE.github.owner,
        name: TEST_CANDIDATE.github.repository,
      },
      package: {
        registry: 'npm',
        name: TEST_CANDIDATE.npmPackage,
      },
    });
    expect(Object.isFrozen(identity)).toBe(true);
    expect(Object.isFrozen(identity.repository)).toBe(true);
    expect(Object.isFrozen(identity.package)).toBe(true);
    expect(identity.repository).not.toBe(TEST_CANDIDATE.github);
  });

  it('maps an absent npm package to null', () => {
    expect(
      catalogCandidateIdentity({
        ...TEST_CANDIDATE,
        npmPackage: null,
        expectedSourceTypes: TEST_CANDIDATE.expectedSourceTypes.filter(
          (sourceType) =>
            sourceType !== 'npm-package' && sourceType !== 'github-advisory',
        ),
      }).package,
    ).toBeNull();
  });

  it('deduplicates and canonically sorts primary and additional families', () => {
    const candidate = {
      ...TEST_CANDIDATE,
      primaryCapabilityFamily: 'webhooks',
      additionalCapabilityFamilies: [
        'rate-limiting',
        'authorization',
        'webhooks',
        'authorization',
      ],
    } as CatalogCandidate;
    const families = catalogCandidateCapabilityFamilies(candidate);

    expect(families).toEqual(['authorization', 'rate-limiting', 'webhooks']);
    expect(Object.isFrozen(families)).toBe(true);
  });

  it('keeps normal profiling on the same identity and family authority', () => {
    const bundle = testBundle({
      candidate: {
        ...TEST_CANDIDATE,
        primaryCapabilityFamily: 'webhooks',
        additionalCapabilityFamilies: ['authorization', 'rate-limiting'],
      },
    });
    const profile = profileCandidate(bundle);

    expect(profile.identity).toEqual(
      catalogCandidateIdentity(bundle.candidate),
    );
    expect(profile.capabilityFamilies).toEqual(
      catalogCandidateCapabilityFamilies(bundle.candidate),
    );
  });
});
