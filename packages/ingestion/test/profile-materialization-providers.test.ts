import { describe, expect, it } from 'vitest';

import {
  mapProfilePrimaryLanguage,
  parseProfileMaterializationCommunityResponse,
  parseProfileMaterializationRepositoryResponse,
  projectForkUpstreamState,
} from '../src/index.ts';

function repositoryResponse(overrides: Record<string, unknown> = {}): unknown {
  return {
    owner: { login: 'owner' },
    name: 'repository',
    html_url: 'https://github.com/owner/repository',
    description: null,
    homepage: null,
    topics: ['authorization'],
    default_branch: 'main',
    private: false,
    fork: false,
    archived: false,
    pushed_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-02T00:00:00Z',
    license: { spdx_id: 'MIT' },
    language: 'TypeScript',
    ...overrides,
  };
}

describe('profile-materialization strict provider parsing', () => {
  it('maps only the reviewed primary-language spellings', () => {
    expect(mapProfilePrimaryLanguage('JavaScript')).toBe('javascript');
    expect(mapProfilePrimaryLanguage('TypeScript')).toBe('typescript');
    expect(mapProfilePrimaryLanguage('Python')).toBe('python');
    expect(mapProfilePrimaryLanguage('Go')).toBe('go');
    expect(mapProfilePrimaryLanguage('Java')).toBe('java');
    expect(mapProfilePrimaryLanguage('Ruby')).toBe('ruby');
    expect(mapProfilePrimaryLanguage('Rust')).toBe('rust');
    expect(mapProfilePrimaryLanguage('PHP')).toBe('php');
    expect(mapProfilePrimaryLanguage('C#')).toBe('dotnet');
    expect(mapProfilePrimaryLanguage('F#')).toBe('dotnet');
    expect(mapProfilePrimaryLanguage(null)).toBeNull();
    expect(mapProfilePrimaryLanguage('Kotlin')).toBeUndefined();
  });

  it('retains exact fork parents and leaves missing fork parents unknown', () => {
    const notFork =
      parseProfileMaterializationRepositoryResponse(repositoryResponse());
    expect(projectForkUpstreamState(notFork)).toEqual({
      fork: false,
      upstreamRepository: null,
    });
    const fork = parseProfileMaterializationRepositoryResponse(
      repositoryResponse({
        fork: true,
        parent: { owner: { login: 'upstream' }, name: 'project' },
      }),
    );
    expect(projectForkUpstreamState(fork)).toEqual({
      fork: true,
      upstreamRepository: 'upstream/project',
    });
    const missing = parseProfileMaterializationRepositoryResponse(
      repositoryResponse({ fork: true }),
    );
    expect(projectForkUpstreamState(missing)).toBeNull();
  });

  it('accepts only explicit object/null community security boundaries', () => {
    expect(
      parseProfileMaterializationCommunityResponse({
        health_percentage: 90,
        files: { security: { url: 'untrusted-and-ignored' } },
      }).hasSecurityPolicy,
    ).toBe(true);
    expect(
      parseProfileMaterializationCommunityResponse({
        health_percentage: 90,
        files: { security: null },
      }).hasSecurityPolicy,
    ).toBe(false);
    expect(() =>
      parseProfileMaterializationCommunityResponse({
        health_percentage: 90,
        files: {},
      }),
    ).toThrow();
    for (const malformed of [undefined, 'yes', 1, false, []]) {
      expect(() =>
        parseProfileMaterializationCommunityResponse({
          health_percentage: 90,
          files: { security: malformed },
        }),
      ).toThrow();
    }
  });
});
