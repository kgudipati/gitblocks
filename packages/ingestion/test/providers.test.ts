import { describe, expect, it } from 'vitest';

import {
  collectCandidateSources,
  IngestionError,
  profileCandidate,
  providerOutcomeClass,
  providerRequestBudget,
  type IngestionErrorCode,
  type JsonResponse,
  type ProviderTransport,
  type TransportRequest,
} from '../src/index.ts';
import { TEST_CANDIDATE } from './fixtures.ts';

describe('public provider mapping', () => {
  it('exposes the closed value-free provider outcome taxonomy', () => {
    const codes: readonly IngestionErrorCode[] = [
      'ingestion.provider-not-found',
      'ingestion.provider-unavailable',
      'ingestion.provider-rate-limited',
      'ingestion.cancelled',
      'ingestion.deadline-exceeded',
      'ingestion.provider-authentication',
      'ingestion.provider-authorization',
      'ingestion.provider-identity',
      'ingestion.provider-response',
      'ingestion.content-type',
      'ingestion.body-too-large',
      'ingestion.redirect',
      'ingestion.internal-invariant',
    ];
    expect(codes.map((code) => providerOutcomeClass(code))).toEqual([
      'established-absence',
      'retry-exhausted-temporary-unavailability',
      'rate-limited',
      'caller-cancellation',
      'deadline',
      'authentication-failure',
      'authorization-failure',
      'identity-mismatch',
      'malformed-response',
      'unsupported-content-type',
      'body-too-large',
      'unsafe-redirect',
      'internal-invariant-failure',
    ]);
  });

  it('maps closed GitHub, npm, file, and advisory fields without retaining raw text', async () => {
    const requests: TransportRequest[] = [];
    const transport: ProviderTransport = {
      requestJson: (request) => {
        requests.push(request);
        return Promise.resolve(providerResponse(request));
      },
    };
    const collection = await collectCandidateSources(
      TEST_CANDIDATE,
      '2026-07-29T12:00:00.000Z',
      {
        transport,
        githubToken: 'injected-test-token',
        correlationId: 'correlation-test',
      },
    );
    expect(collection.outcome).toBe('complete');
    if (collection.outcome !== 'complete') {
      return;
    }
    const bundle = collection.bundle;
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
    expect(requests.map((request) => request.operation)).toEqual([
      'repository',
      'head-commit',
      'releases',
      'tags',
      'license',
      'community',
      'file-package-json',
      'package-metadata',
      'advisories',
    ]);
    expect(providerRequestBudget(TEST_CANDIDATE)).toEqual({
      github: 9,
      npm: 1,
      total: 10,
    });
    expect(
      providerRequestBudget({
        ...TEST_CANDIDATE,
        allowlistedFiles: ['LICENSE', 'SECURITY.md', 'package.json'],
      }).total,
    ).toBe(12);
    expect(
      requests
        .find((request) => request.operation === 'license')
        ?.url.searchParams.get('ref'),
    ).toBe('1111111111111111111111111111111111111111');
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
    expect(moved.outcome).toBe('complete');
    if (moved.outcome !== 'complete') {
      return;
    }
    expect(moved.bundle.repository).toMatchObject({
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

  it.each([
    'ingestion.deadline-exceeded',
    'ingestion.cancelled',
    'ingestion.provider-rate-limited',
    'ingestion.provider-authentication',
    'ingestion.provider-authorization',
    'ingestion.provider-response',
    'ingestion.provider-identity',
    'ingestion.body-too-large',
    'ingestion.content-type',
    'ingestion.redirect',
    'ingestion.internal-invariant',
  ] as const)(
    'does not swallow fatal optional-source outcome %s',
    async (code) => {
      const transport: ProviderTransport = {
        requestJson: (request) => {
          if (request.operation === 'releases') {
            return Promise.reject(new IngestionError(code));
          }
          return Promise.resolve(providerResponse(request));
        },
      };
      await expect(
        collectCandidateSources(TEST_CANDIDATE, '2026-07-29T12:00:00.000Z', {
          transport,
          githubToken: 'injected-test-token',
          correlationId: 'correlation-test',
        }),
      ).rejects.toMatchObject({ code });
    },
  );

  it('requests only optional sources declared by the candidate', async () => {
    const requests: TransportRequest[] = [];
    const transport: ProviderTransport = {
      requestJson: (request) => {
        requests.push(request);
        return Promise.resolve(providerResponse(request));
      },
    };
    await collectCandidateSources(
      {
        ...TEST_CANDIDATE,
        npmPackage: null,
        expectedSourceTypes: ['github-repository'],
        allowlistedFiles: [],
      },
      '2026-07-29T12:00:00.000Z',
      {
        transport,
        githubToken: 'injected-test-token',
        correlationId: 'correlation-test',
      },
    );
    expect(requests.map((request) => request.operation)).toEqual([
      'repository',
      'head-commit',
    ]);
  });

  it('allows an approved optional absence to produce a complete profile', async () => {
    const transport: ProviderTransport = {
      requestJson: (request) =>
        request.operation === 'releases'
          ? Promise.reject(new IngestionError('ingestion.provider-not-found'))
          : Promise.resolve(providerResponse(request)),
    };
    const collection = await collectCandidateSources(
      TEST_CANDIDATE,
      '2026-07-29T12:00:00.000Z',
      {
        transport,
        githubToken: 'injected-test-token',
        correlationId: 'correlation-test',
      },
    );
    expect(collection.outcome).toBe('complete');
    if (collection.outcome !== 'complete') {
      return;
    }
    expect(collection.bundle.releases).toEqual([]);
    expect(
      profileCandidate(collection.bundle).unknowns.map(
        (unknown) => unknown.topic,
      ),
    ).toContain('release-state-unknown');
  });

  it('keeps license provenance pinned when the default branch changes after head collection', async () => {
    const transport: ProviderTransport = {
      requestJson: (request) => {
        const result = providerResponse(request);
        if (request.operation === 'license') {
          expect(request.url.searchParams.get('ref')).toBe(
            '1111111111111111111111111111111111111111',
          );
          return Promise.resolve({
            ...result,
            value: {
              ...(result.value as Record<string, unknown>),
              html_url:
                'https://github.com/gitblocks-test/candidate/blob/new-default/LICENSE',
            },
          });
        }
        return Promise.resolve(result);
      },
    };
    const collection = await collectCandidateSources(
      TEST_CANDIDATE,
      '2026-07-29T12:00:00.000Z',
      {
        transport,
        githubToken: 'injected-test-token',
        correlationId: 'correlation-test',
      },
    );
    expect(collection.outcome).toBe('complete');
    if (collection.outcome !== 'complete') {
      return;
    }
    expect(collection.bundle.license?.immutableUrl).toBe(
      'https://github.com/gitblocks-test/candidate/blob/1111111111111111111111111111111111111111/LICENSE',
    );
    const licenseEvidence = profileCandidate(
      collection.bundle,
    ).observations.find(
      (observation) => observation.topic === 'license-declared',
    );
    expect(licenseEvidence?.source).toMatchObject({
      kind: 'git-commit',
      commitSha: '1111111111111111111111111111111111111111',
      immutableUrl:
        'https://github.com/gitblocks-test/candidate/blob/1111111111111111111111111111111111111111/LICENSE',
    });
  });

  it.each([{ name: 'NOT-LICENSE' }, { sha: 'not-a-git-object-sha' }])(
    'rejects malformed returned license identity %#',
    async (override) => {
      const transport: ProviderTransport = {
        requestJson: (request) => {
          const result = providerResponse(request);
          return Promise.resolve(
            request.operation === 'license'
              ? {
                  ...result,
                  value: {
                    ...(result.value as Record<string, unknown>),
                    ...override,
                  },
                }
              : result,
          );
        },
      };
      await expect(
        collectCandidateSources(TEST_CANDIDATE, '2026-07-29T12:00:00.000Z', {
          transport,
          githubToken: 'injected-test-token',
          correlationId: 'correlation-test',
        }),
      ).rejects.toMatchObject({ code: 'ingestion.provider-response' });
    },
  );
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
      name: 'LICENSE',
      path: 'LICENSE',
      sha: '2222222222222222222222222222222222222222',
      html_url:
        'https://github.com/gitblocks-test/candidate/blob/1111111111111111111111111111111111111111/LICENSE',
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
