import { describe, expect, it } from 'vitest';

import {
  collectCandidateSources,
  type JsonResponse,
  type ProviderTransport,
  type TransportRequest,
} from '../src/index.ts';
import { TEST_CANDIDATE } from './fixtures.ts';

describe('public provider mapping', () => {
  it('maps closed GitHub, npm, file, and advisory fields without retaining raw text', async () => {
    const requests: TransportRequest[] = [];
    const transport: ProviderTransport = {
      requestJson: (request) => {
        requests.push(request);
        return Promise.resolve(providerResponse(request));
      },
    };
    const bundle = await collectCandidateSources(
      TEST_CANDIDATE,
      '2026-07-29T12:00:00.000Z',
      {
        transport,
        githubToken: 'injected-test-token',
        correlationId: 'correlation-test',
      },
    );
    expect(bundle.repository.canonicalOwner).toBe('gitblocks-test');
    expect(bundle.commit.sha).toBe('1111111111111111111111111111111111111111');
    expect(bundle.npm).toMatchObject({
      name: '@gitblocks-test/candidate',
      latestVersion: '1.2.3',
      nodeEngine: '>=24',
      moduleType: 'module',
      exportShape: 'declared',
      deprecated: false,
    });
    expect(bundle.files).toEqual([
      expect.objectContaining({
        path: 'package.json',
        text: '{"name":"untrusted"}',
      }),
    ]);
    expect(bundle.advisories).toEqual({
      advisories: [],
      complete: true,
      limitationCode: null,
    });
    expect(requests).toHaveLength(9);
    expect(
      requests.every(
        (request) =>
          request.url.hostname === 'api.github.com' ||
          request.url.hostname === 'registry.npmjs.org',
      ),
    ).toBe(true);
  });

  it('rejects a private or canonically mismatched required repository', async () => {
    const transport: ProviderTransport = {
      requestJson: (request) => {
        const result = providerResponse(request);
        if (
          request.provider === 'github' &&
          request.url.pathname === '/repos/gitblocks-test/candidate'
        ) {
          return Promise.resolve({
            ...result,
            value: {
              ...(result.value as Record<string, unknown>),
              private: true,
            },
          });
        }
        return Promise.resolve(result);
      },
    };
    await expect(
      collectCandidateSources(TEST_CANDIDATE, '2026-07-29T12:00:00.000Z', {
        transport,
        githubToken: 'injected-test-token',
        correlationId: 'correlation-test',
      }),
    ).rejects.toMatchObject({ code: 'ingestion.provider-identity' });
  });

  it('accepts a canonical identity change only for an explicitly moved candidate', async () => {
    const transport: ProviderTransport = {
      requestJson: (request) => {
        const result = providerResponse(request);
        if (
          request.provider === 'github' &&
          request.url.pathname === '/repos/gitblocks-test/candidate'
        ) {
          return Promise.resolve({
            ...result,
            value: {
              ...(result.value as Record<string, unknown>),
              owner: { login: 'gitblocks-moved' },
              name: 'candidate-current',
              html_url: 'https://github.com/gitblocks-moved/candidate-current',
            },
          });
        }
        return Promise.resolve(result);
      },
    };
    const moved = await collectCandidateSources(
      { ...TEST_CANDIDATE, status: 'moved' },
      '2026-07-29T12:00:00.000Z',
      {
        transport,
        githubToken: 'injected-test-token',
        correlationId: 'correlation-test',
      },
    );
    expect(moved.repository).toMatchObject({
      canonicalOwner: 'gitblocks-moved',
      canonicalRepository: 'candidate-current',
    });
    await expect(
      collectCandidateSources(TEST_CANDIDATE, '2026-07-29T12:00:00.000Z', {
        transport,
        githubToken: 'injected-test-token',
        correlationId: 'correlation-test',
      }),
    ).rejects.toMatchObject({ code: 'ingestion.provider-identity' });
  });
});

function providerResponse(request: TransportRequest): JsonResponse {
  const path = request.url.pathname;
  if (request.provider === 'npm') {
    return response({
      name: '@gitblocks-test/candidate',
      'dist-tags': { latest: '1.2.3' },
      versions: {
        '1.2.3': {
          repository: {
            type: 'git',
            url: 'git+https://github.com/gitblocks-test/candidate.git',
          },
          license: 'Apache-2.0',
          engines: { node: '>=24' },
          type: 'module',
          exports: { '.': './index.js' },
        },
      },
      time: { '1.2.3': '2026-07-27T12:00:00.000Z' },
    });
  }
  if (path === '/advisories') {
    return response([]);
  }
  if (path.endsWith('/commits/main')) {
    return response({
      sha: '1111111111111111111111111111111111111111',
      html_url:
        'https://github.com/gitblocks-test/candidate/commit/1111111111111111111111111111111111111111',
      commit: { committer: { date: '2026-07-28T12:00:00.000Z' } },
    });
  }
  if (path.endsWith('/releases')) {
    return response([
      {
        tag_name: 'v1.2.3',
        html_url:
          'https://github.com/gitblocks-test/candidate/releases/tag/v1.2.3',
        published_at: '2026-07-27T12:00:00.000Z',
        draft: false,
        prerelease: false,
      },
    ]);
  }
  if (path.endsWith('/tags')) {
    return response([
      {
        name: 'v1.2.3',
        commit: { sha: '1111111111111111111111111111111111111111' },
      },
    ]);
  }
  if (path.endsWith('/license')) {
    return response({
      html_url: 'https://github.com/gitblocks-test/candidate/blob/main/LICENSE',
      license: { spdx_id: 'Apache-2.0' },
    });
  }
  if (path.endsWith('/community/profile')) {
    return response({
      health_percentage: 80,
      files: { security: { url: 'not-retained' } },
    });
  }
  if (path.endsWith('/contents/package.json')) {
    return response({
      type: 'file',
      encoding: 'base64',
      content: Buffer.from('{"name":"untrusted"}').toString('base64'),
      size: Buffer.byteLength('{"name":"untrusted"}'),
      sha: '2222222222222222222222222222222222222222',
      html_url:
        'https://github.com/gitblocks-test/candidate/blob/main/package.json',
    });
  }
  return response({
    owner: { login: 'gitblocks-test' },
    name: 'candidate',
    html_url: 'https://github.com/gitblocks-test/candidate',
    description: 'Provider description.',
    homepage: null,
    topics: ['authorization'],
    default_branch: 'main',
    private: false,
    fork: false,
    archived: false,
    pushed_at: '2026-07-28T12:00:00.000Z',
    updated_at: '2026-07-28T12:00:00.000Z',
    license: { spdx_id: 'Apache-2.0' },
  });
}

function response(value: unknown): JsonResponse {
  return {
    value,
    headers: new Headers(),
    status: 200,
  };
}
