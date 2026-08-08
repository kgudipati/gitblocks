import { describe, expect, it } from 'vitest';

import {
  CANDIDATE_RETRIEVAL_METADATA_AUTHORITY_MAX_BYTES,
  CANDIDATE_RETRIEVAL_METADATA_CANDIDATE_COUNT,
  CANDIDATE_RETRIEVAL_METADATA_PROVIDER_POLICY_VERSION,
  CANDIDATE_RETRIEVAL_METADATA_SOURCE_OPERATION,
  CANDIDATE_RETRIEVAL_METADATA_SOURCE_POLICY_VERSION,
  createCandidateRetrievalMetadataAuthorityV1,
  parseCandidateRetrievalMetadataAuthorityV1,
  serializeCandidateRetrievalMetadataAuthorityV1,
  type CandidateRetrievalMetadataAuthorityV1,
  type CandidateRetrievalMetadataRecordInputV1,
} from '../src/index.ts';

describe('CandidateRetrievalMetadataAuthorityV1', () => {
  it('creates one canonical digest-bound 150-candidate snapshot', () => {
    const authority = authorityFixture();
    const parsed = parseCandidateRetrievalMetadataAuthorityV1(authority);

    expect(parsed.ok).toBe(true);
    expect(authority.candidates).toHaveLength(
      CANDIDATE_RETRIEVAL_METADATA_CANDIDATE_COUNT,
    );
    expect(authority.candidates[0]).toMatchObject({
      candidateId: 'candidate-000',
      description: 'Structured audit event collection',
      topics: ['audit-logging', 'structured-events'],
      primaryLanguage: 'TypeScript',
    });
    expect(authority.snapshotId).toBe(
      `retrieval-metadata-snapshot-${authority.authoritySemanticDigest.slice(0, 32)}`,
    );
    expect(
      Buffer.byteLength(
        serializeCandidateRetrievalMetadataAuthorityV1(authority),
        'utf8',
      ),
    ).toBeLessThanOrEqual(CANDIDATE_RETRIEVAL_METADATA_AUTHORITY_MAX_BYTES);
    expect(Object.isFrozen(authority)).toBe(false);
  });

  it('canonicalizes candidate and topic order independently of input order', () => {
    const forward = authorityFixture();
    const reversed = authorityFixture(
      candidateInputs()
        .reverse()
        .map((candidate) => ({
          ...candidate,
          topics: [...candidate.topics].reverse(),
        })),
    );

    expect(reversed).toEqual(forward);
  });

  it('rejects record, authority, snapshot, ordering, and repository closure drift', () => {
    const authority = authorityFixture();
    const challenges: CandidateRetrievalMetadataAuthorityV1[] = [];

    challenges.push({
      ...authority,
      authoritySemanticDigest: '0'.repeat(64),
    });
    challenges.push({
      ...authority,
      snapshotId: `retrieval-metadata-snapshot-${'0'.repeat(32)}`,
    });
    challenges.push({
      ...authority,
      candidates: authority.candidates.map((candidate, index) =>
        index === 0
          ? { ...candidate, sourceRecordDigest: '0'.repeat(64) }
          : candidate,
      ),
    });
    challenges.push({
      ...authority,
      candidates: [
        authority.candidates[1]!,
        authority.candidates[0]!,
        ...authority.candidates.slice(2),
      ],
    });
    challenges.push({
      ...authority,
      candidates: authority.candidates.map((candidate, index) =>
        index === 1
          ? {
              ...candidate,
              canonicalOwner: authority.candidates[0]!.canonicalOwner,
              canonicalRepository: authority.candidates[0]!.canonicalRepository,
            }
          : candidate,
      ),
    });

    for (const challenge of challenges) {
      expect(parseCandidateRetrievalMetadataAuthorityV1(challenge).ok).toBe(
        false,
      );
    }
  });

  it('fails closed on unsafe, oversized, unknown, or malformed repository metadata', () => {
    const authority = authorityFixture();
    const first = authority.candidates[0]!;
    const replaceFirst = (replacement: unknown): unknown => ({
      ...authority,
      candidates: [replacement, ...authority.candidates.slice(1)],
    });
    const challenges = [
      replaceFirst({ ...first, description: `safe\u202eunsafe` }),
      replaceFirst({ ...first, description: 'x'.repeat(501) }),
      replaceFirst({ ...first, topics: ['safe', `bad\u0000topic`] }),
      replaceFirst({
        ...first,
        topics: Array.from(
          { length: 21 },
          (_, index) => `topic-${String(index).padStart(2, '0')}`,
        ),
      }),
      replaceFirst({ ...first, primaryLanguage: 'x'.repeat(101) }),
      replaceFirst({ ...first, unexpected: 'field' }),
      { ...authority, candidates: authority.candidates.slice(1) },
    ];

    for (const challenge of challenges) {
      expect(parseCandidateRetrievalMetadataAuthorityV1(challenge).ok).toBe(
        false,
      );
    }
  });
});

function authorityFixture(
  candidates: readonly CandidateRetrievalMetadataRecordInputV1[] = candidateInputs(),
): CandidateRetrievalMetadataAuthorityV1 {
  return createCandidateRetrievalMetadataAuthorityV1({
    catalogVersion: 'public-v1',
    catalogDigest: '1'.repeat(64),
    providerPolicyVersion: CANDIDATE_RETRIEVAL_METADATA_PROVIDER_POLICY_VERSION,
    providerPolicyDigest: '2'.repeat(64),
    sourceProviderPolicyVersion:
      CANDIDATE_RETRIEVAL_METADATA_SOURCE_POLICY_VERSION,
    sourceProviderPolicyDigest: '3'.repeat(64),
    sourceOperation: CANDIDATE_RETRIEVAL_METADATA_SOURCE_OPERATION,
    collectedAt: '2026-08-07T12:00:00.000Z',
    candidates,
  });
}

function candidateInputs(): CandidateRetrievalMetadataRecordInputV1[] {
  return Array.from(
    { length: CANDIDATE_RETRIEVAL_METADATA_CANDIDATE_COUNT },
    (_, index) => ({
      candidateId: `candidate-${String(index).padStart(3, '0')}`,
      canonicalOwner: `owner-${String(index).padStart(3, '0')}`,
      canonicalRepository: `repository-${String(index).padStart(3, '0')}`,
      description: index === 0 ? 'Structured audit event collection' : null,
      topics:
        index === 0
          ? ['structured-events', 'audit-logging']
          : [`topic-${String(index).padStart(3, '0')}`],
      primaryLanguage: index === 0 ? 'TypeScript' : null,
    }),
  );
}
