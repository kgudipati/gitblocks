import { describe, expect, it } from 'vitest';

import {
  CANDIDATE_AUTHORITY_MAXIMUM_LICENSE_PATH_BYTES,
  candidateAuthorityImmutableGitHubFileLocation,
  isCandidateAuthorityGitObjectSha,
  isSafeCandidateAuthorityRepositoryRelativePath,
} from '../src/candidate-authority-license-provenance.ts';

const HEAD = '0123456789abcdef0123456789abcdef01234567';

describe('candidate-authority GitHub license provenance', () => {
  it('preserves and segment-encodes an exact safe provider path at an immutable commit', () => {
    const location = candidateAuthorityImmutableGitHubFileLocation({
      owner: 'example-owner',
      repository: 'example-repository',
      commitSha: HEAD,
      path: 'legal/licenses/Apache License 2.0.txt',
    });

    expect(location.sourceUrl).toBe(
      'https://github.com/example-owner/example-repository',
    );
    expect(location.immutableUrl).toBe(
      `https://github.com/example-owner/example-repository/blob/${HEAD}/legal/licenses/Apache%20License%202.0.txt`,
    );
    expect(new URL(location.immutableUrl).search).toBe('');
    expect(new URL(location.immutableUrl).hash).toBe('');
  });

  it.each([
    '',
    '/LICENSE',
    '../LICENSE',
    'legal/../LICENSE',
    './LICENSE',
    'legal//LICENSE',
    'LICENSE\u0000',
    'LICENSE\n',
    'LICENSE?raw=1',
    'LICENSE#fragment',
    'https://example.com/LICENSE',
    'C:\\LICENSE',
  ])('rejects unsafe repository-relative path %j', (path) => {
    expect(isSafeCandidateAuthorityRepositoryRelativePath(path)).toBe(false);
  });

  it('enforces the frozen byte bound and exact provider Git object syntax', () => {
    expect(
      isSafeCandidateAuthorityRepositoryRelativePath(
        'a'.repeat(CANDIDATE_AUTHORITY_MAXIMUM_LICENSE_PATH_BYTES),
      ),
    ).toBe(true);
    expect(
      isSafeCandidateAuthorityRepositoryRelativePath(
        'a'.repeat(CANDIDATE_AUTHORITY_MAXIMUM_LICENSE_PATH_BYTES + 1),
      ),
    ).toBe(false);
    expect(isCandidateAuthorityGitObjectSha(HEAD)).toBe(true);
    expect(isCandidateAuthorityGitObjectSha(HEAD.toUpperCase())).toBe(false);
    expect(isCandidateAuthorityGitObjectSha('a'.repeat(64))).toBe(false);
  });
});
