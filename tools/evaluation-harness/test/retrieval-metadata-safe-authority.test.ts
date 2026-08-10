import { describe, expect, it } from 'vitest';

import { createCandidateRetrievalEngineV1 } from '@gitblocks/retrieval';

import { findGitBlocksRoot } from '../src/repository-root.ts';
import { loadRetrievalSafeAuthorityV1 } from '../src/retrieval/safe-authority.ts';

describe('metadata-enabled retrieval safe authority', () => {
  it('pins and admits only the accepted 150-record metadata snapshot', () => {
    const authority = loadRetrievalSafeAuthorityV1(
      findGitBlocksRoot(process.cwd()),
    );
    expect(authority.metadata).toMatchObject({
      authorityVersion: 'candidate-retrieval-metadata-authority/1.1.0',
      authoritySemanticDigest:
        '23c38be5e5b117c74832049ae58f455f4fd1731e167cf170038da516c44e5ef1',
      snapshotId:
        'retrieval-metadata-snapshot-23c38be5e5b117c74832049ae58f455f',
      catalogDigest:
        '4819dd94cb1bbe5e27c31ca5ca55976da1442987a792bf438d96681021cb8634',
      providerPolicyVersion:
        'candidate-retrieval-metadata-provider-policy/1.1.0',
      providerPolicyDigest:
        'b8cd159d895d4af91f92563b199c0e9beea9bddcb87b869e33429201bd9a5f2e',
      sourceProviderPolicyVersion:
        'profile-materialization-provider-policy/1.0.0',
      sourceProviderPolicyDigest:
        '0945ebd862d0a1b5f622c4f10f60b2c0e713fb127cc5dea5668be5cc40c96ede',
      sourceOperation: 'github-repository-metadata',
    });
    expect(authority.metadata.candidates).toHaveLength(150);

    const created = createCandidateRetrievalEngineV1({
      taxonomy: authority.taxonomy,
      candidateProfileAuthority: authority.profiles,
      retrievalExpansionAuthority: authority.expansion,
      candidateRetrievalMetadataAuthority: authority.metadata,
      expectedCandidateRetrievalMetadataAuthorityBinding:
        authority.expectedMetadataBinding,
    });
    expect(created).toMatchObject({
      ok: true,
      engine: { candidateCount: 150 },
    });
  });
});
