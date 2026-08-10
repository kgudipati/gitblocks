import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { describe, expect, it, vi } from 'vitest';

import {
  CANDIDATE_RETRIEVAL_METADATA_AUTHORITY_PATH,
  CANDIDATE_RETRIEVAL_METADATA_CATALOG_PATH,
  CANDIDATE_RETRIEVAL_METADATA_GITHUB_TOKEN_ENVIRONMENT,
  CANDIDATE_RETRIEVAL_METADATA_PROVIDER_POLICY_PATH,
  CANDIDATE_RETRIEVAL_METADATA_SOURCE_POLICY_PATH,
  CANDIDATE_RETRIEVAL_METADATA_STAGING_PATH,
  collectCandidateRetrievalMetadataAuthority,
  collectProfileMaterializationRepositoryMetadata,
  executeCandidateRetrievalMetadataCollection,
  parseCandidateRetrievalMetadataProviderPolicy,
  parseProfileMaterializationProviderPolicy,
  parsePublicCatalog,
  preflightCandidateRetrievalMetadataCollection,
  type CandidateRetrievalMetadataCollectionEffects,
  type JsonResponse,
  type ProviderTransport,
  type TransportRequest,
} from '../src/index.ts';

const repositoryRoot = fileURLToPath(new URL('../../..', import.meta.url));

describe('candidate retrieval metadata collection boundary', () => {
  it('preflights the exact narrow envelope without credentials, network, or writes', async () => {
    const credential = vi.fn(() => 'must-not-be-read');
    const network = vi.fn();
    const write = vi.fn();
    const missingChecks: string[] = [];
    const result = await preflightCandidateRetrievalMetadataCollection({
      readFixedFile,
      requirePathMissing: (path) => {
        missingChecks.push(path);
        return Promise.resolve();
      },
    });
    expect(missingChecks).toEqual([
      CANDIDATE_RETRIEVAL_METADATA_AUTHORITY_PATH,
      CANDIDATE_RETRIEVAL_METADATA_STAGING_PATH,
    ]);
    expect(result.catalog.candidates).toHaveLength(150);
    expect(result.envelope.policy.allowedOperations).toEqual([
      'github-repository-metadata',
    ]);
    expect(result.envelope.policy.logicalRequestBudget).toBe(150);
    expect(result.envelope.policy.worstCaseRequestAttemptBudget).toBe(450);
    expect(result.envelope.sourceOperation.endpointTemplate).toBe(
      '/repos/{owner}/{repository}',
    );
    expect(result.requirements).toEqual({
      database: false,
      docker: false,
      model: false,
      npm: false,
      artifactBodies: false,
    });
    expect(credential).not.toHaveBeenCalled();
    expect(network).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
  });

  it('collects exactly one existing repository-metadata operation per candidate', async () => {
    const catalog = parsePublicCatalog(
      await readFixedFile(CANDIDATE_RETRIEVAL_METADATA_CATALOG_PATH),
    );
    const sourcePolicy = parseProfileMaterializationProviderPolicy(
      catalog,
      JSON.parse(
        await readFixedFile(CANDIDATE_RETRIEVAL_METADATA_SOURCE_POLICY_PATH),
      ) as unknown,
    );
    const envelope = parseCandidateRetrievalMetadataProviderPolicy(
      catalog,
      sourcePolicy,
      JSON.parse(
        await readFixedFile(CANDIDATE_RETRIEVAL_METADATA_PROVIDER_POLICY_PATH),
      ) as unknown,
    );
    const requests: TransportRequest[] = [];
    const candidates = new Map(
      catalog.candidates.map((candidate) => [candidate.candidateId, candidate]),
    );
    const transport: ProviderTransport = {
      requestJson: (request): Promise<JsonResponse> => {
        requests.push(request);
        const candidate = candidates.get(request.candidateId);
        if (candidate === undefined) throw new Error('Unexpected candidate.');
        return Promise.resolve({
          status: 200,
          headers: new Headers(),
          value: repositoryResponse(
            candidate.github.owner,
            candidate.github.repository,
          ),
        });
      },
    };
    const authority = await collectCandidateRetrievalMetadataAuthority(
      catalog,
      {
        transport,
        sourceProviderPolicy: sourcePolicy,
        collectionEnvelope: envelope,
        githubToken: 'synthetic-token',
        correlationId: 'synthetic-retrieval-metadata-test',
        collectedAt: '2026-08-07T00:00:00.000Z',
      },
    );
    expect(authority.candidates).toHaveLength(150);
    expect(requests).toHaveLength(150);
    expect(new Set(requests.map(({ candidateId }) => candidateId)).size).toBe(
      150,
    );
    for (const request of requests) {
      expect(request.provider).toBe('github');
      expect(request.operation).toBe('github-repository-metadata');
      expect(request.url.host).toBe('api.github.com');
      expect(request.url.pathname).toMatch(/^\/repos\/[^/]+\/[^/]+$/u);
      expect(request.authorizationToken).toBe('synthetic-token');
      expect(request.maximumBytes).toBe(2 * 1_024 * 1_024);
      expect(request.maximumNodes).toBe(100_000);
    }
    expect(authority.candidates[0]?.description).toBe(
      'Synthetic repository-owned description.',
    );
    expect(authority.candidates[0]).toMatchObject({
      catalogOwner: catalog.candidates[0]?.github.owner,
      catalogRepository: catalog.candidates[0]?.github.repository,
      providerCanonicalOwner: catalog.candidates[0]?.github.owner,
      providerCanonicalRepository: catalog.candidates[0]?.github.repository,
      repositoryIdentityState: 'unchanged',
    });
    expect(authority.candidates[0]?.topics).toEqual(['audit-logging']);
    expect(authority.candidates[0]?.primaryLanguage).toBe('TypeScript');
  }, 30_000);

  it('retains the three known moved catalog locators and records current provider identities', async () => {
    const { catalog, sourcePolicy, envelope } = await collectionAuthorities();
    const redirects = new Map<string, readonly [string, string]>([
      ['auth-casbin-casbin', ['apache', 'casbin']],
      ['auth-casbin-casbin-js', ['apache', 'casbin-casbin.js']],
      ['auth-casbin-node-casbin', ['apache', 'casbin-node-casbin']],
    ] as const);
    const authority = await collectCandidateRetrievalMetadataAuthority(
      catalog,
      {
        transport: repositoryTransport(catalog, (candidate) => {
          const redirected = redirects.get(candidate.candidateId);
          return (
            redirected ?? [candidate.github.owner, candidate.github.repository]
          );
        }),
        sourceProviderPolicy: sourcePolicy,
        collectionEnvelope: envelope,
        githubToken: 'synthetic-token',
        correlationId: 'synthetic-known-moved-patterns',
        collectedAt: '2026-08-07T00:00:00.000Z',
      },
    );

    for (const [candidateId, [owner, repository]] of redirects) {
      const catalogCandidate = catalog.candidates.find(
        (candidate) => candidate.candidateId === candidateId,
      );
      expect(catalogCandidate?.status).toBe('moved');
      expect(
        authority.candidates.find(
          (candidate) => candidate.candidateId === candidateId,
        ),
      ).toMatchObject({
        candidateId,
        catalogOwner: catalogCandidate?.github.owner,
        catalogRepository: catalogCandidate?.github.repository,
        providerCanonicalOwner: owner,
        providerCanonicalRepository: repository,
        repositoryIdentityState: 'redirected',
      });
    }
  }, 30_000);

  it('fails closed on duplicate or malformed provider-canonical identity and non-public repositories', async () => {
    const { catalog, sourcePolicy, envelope } = await collectionAuthorities();
    const first = catalog.candidates[0]!;
    const second = catalog.candidates[1]!;
    const baseConfig = {
      sourceProviderPolicy: sourcePolicy,
      collectionEnvelope: envelope,
      githubToken: 'synthetic-token',
      correlationId: 'synthetic-identity-failure',
      collectedAt: '2026-08-07T00:00:00.000Z',
    } as const;

    await expect(
      collectCandidateRetrievalMetadataAuthority(catalog, {
        ...baseConfig,
        transport: repositoryTransport(catalog, (candidate) =>
          candidate.candidateId === first.candidateId ||
          candidate.candidateId === second.candidateId
            ? ['shared-provider-owner', 'shared-provider-repository']
            : [candidate.github.owner, candidate.github.repository],
        ),
      }),
    ).rejects.toMatchObject({ code: 'ingestion.invalid-manifest' });

    await expect(
      collectCandidateRetrievalMetadataAuthority(catalog, {
        ...baseConfig,
        transport: repositoryTransport(catalog, (candidate) =>
          candidate.candidateId === first.candidateId
            ? ['malformed/provider', 'repository']
            : [candidate.github.owner, candidate.github.repository],
        ),
      }),
    ).rejects.toMatchObject({ code: 'ingestion.invalid-manifest' });

    await expect(
      collectCandidateRetrievalMetadataAuthority(catalog, {
        ...baseConfig,
        transport: repositoryTransport(
          catalog,
          (candidate) => [candidate.github.owner, candidate.github.repository],
          first.candidateId,
        ),
      }),
    ).rejects.toMatchObject({ code: 'ingestion.provider-identity' });
  }, 30_000);

  it('preserves the Phase 8 status-gated repository identity behavior', async () => {
    const { catalog, sourcePolicy } = await collectionAuthorities();
    const active = catalog.candidates.find(
      (candidate) => candidate.status === 'active',
    );
    const moved = catalog.candidates.find(
      (candidate) => candidate.status === 'moved',
    );
    if (active === undefined || moved === undefined) {
      throw new Error('Phase 8 identity fixtures unavailable.');
    }
    const config = {
      transport: repositoryTransport(catalog, () => [
        'phase8-provider-owner',
        'phase8-provider-repository',
      ]),
      policy: sourcePolicy,
      githubToken: 'synthetic-token',
      correlationId: 'phase8-identity-regression',
    } as const;

    await expect(
      collectProfileMaterializationRepositoryMetadata(active, config),
    ).rejects.toMatchObject({ code: 'ingestion.provider-identity' });
    await expect(
      collectProfileMaterializationRepositoryMetadata(moved, config),
    ).resolves.toMatchObject({
      canonicalOwner: 'phase8-provider-owner',
      canonicalRepository: 'phase8-provider-repository',
    });
  });

  it('retains stable candidate ownership when an active repository redirects', async () => {
    const catalog = parsePublicCatalog(
      await readFixedFile(CANDIDATE_RETRIEVAL_METADATA_CATALOG_PATH),
    );
    const sourcePolicy = parseProfileMaterializationProviderPolicy(
      catalog,
      JSON.parse(
        await readFixedFile(CANDIDATE_RETRIEVAL_METADATA_SOURCE_POLICY_PATH),
      ) as unknown,
    );
    const envelope = parseCandidateRetrievalMetadataProviderPolicy(
      catalog,
      sourcePolicy,
      JSON.parse(
        await readFixedFile(CANDIDATE_RETRIEVAL_METADATA_PROVIDER_POLICY_PATH),
      ) as unknown,
    );
    const redirected = catalog.candidates.find(
      (candidate) => candidate.status === 'active',
    );
    if (redirected === undefined)
      throw new Error('Active fixture unavailable.');
    const transport: ProviderTransport = {
      requestJson: (request) => {
        const candidate = catalog.candidates.find(
          ({ candidateId }) => candidateId === request.candidateId,
        );
        if (candidate === undefined) throw new Error('Unexpected candidate.');
        return Promise.resolve({
          status: 200,
          headers: new Headers(),
          value:
            candidate.candidateId === redirected.candidateId
              ? repositoryResponse(
                  'provider-redirected-owner',
                  'provider-redirected-repository',
                )
              : repositoryResponse(
                  candidate.github.owner,
                  candidate.github.repository,
                ),
        });
      },
    };

    const authority = await collectCandidateRetrievalMetadataAuthority(
      catalog,
      {
        transport,
        sourceProviderPolicy: sourcePolicy,
        collectionEnvelope: envelope,
        githubToken: 'synthetic-token',
        correlationId: 'synthetic-active-redirect-regression',
        collectedAt: '2026-08-07T00:00:00.000Z',
      },
    );

    expect(
      authority.candidates.find(
        ({ candidateId }) => candidateId === redirected.candidateId,
      ),
    ).toMatchObject({
      candidateId: redirected.candidateId,
      catalogOwner: redirected.github.owner,
      catalogRepository: redirected.github.repository,
      providerCanonicalOwner: 'provider-redirected-owner',
      providerCanonicalRepository: 'provider-redirected-repository',
      repositoryIdentityState: 'redirected',
    });
  }, 30_000);

  it('binds the policy digest and accesses a fake credential only after preflight', async () => {
    const reads: string[] = [];
    const publications: string[] = [];
    const fakeAuthority = vi.fn();
    const base: CandidateRetrievalMetadataCollectionEffects = {
      readFixedFile: async (path) => {
        reads.push(path);
        return readFixedFile(path);
      },
      requirePathMissing: () => Promise.resolve(),
      readCredential: (name) => {
        expect(name).toBe(
          CANDIDATE_RETRIEVAL_METADATA_GITHUB_TOKEN_ENVIRONMENT,
        );
        return 'fake-only';
      },
      collect: async (preflight, credential) => {
        expect(credential).toBe('fake-only');
        const transport: ProviderTransport = {
          requestJson: (request) => {
            const candidate = preflight.catalog.candidates.find(
              ({ candidateId }) => candidateId === request.candidateId,
            );
            if (candidate === undefined) throw new Error('Unknown candidate.');
            return Promise.resolve({
              status: 200,
              headers: new Headers(),
              value: repositoryResponse(
                candidate.github.owner,
                candidate.github.repository,
              ),
            });
          },
        };
        const authority = await collectCandidateRetrievalMetadataAuthority(
          preflight.catalog,
          {
            transport,
            sourceProviderPolicy: preflight.sourcePolicy,
            collectionEnvelope: preflight.envelope,
            githubToken: credential,
            correlationId: 'fake-execute',
            collectedAt: '2026-08-07T00:00:00.000Z',
          },
        );
        fakeAuthority(authority);
        return authority;
      },
      stageExclusive: (path, text) => {
        expect(text.endsWith('\n')).toBe(true);
        publications.push(`stage:${path}`);
        return Promise.resolve();
      },
      publishStagedExclusive: (stagingPath, finalPath) => {
        publications.push(`publish:${stagingPath}:${finalPath}`);
        return Promise.resolve();
      },
      removeOwnedStaging: (path) => {
        publications.push(`cleanup:${path}`);
        return Promise.resolve();
      },
    };
    await executeCandidateRetrievalMetadataCollection(
      base,
      new AbortController().signal,
    );
    expect(reads).toEqual([
      CANDIDATE_RETRIEVAL_METADATA_CATALOG_PATH,
      CANDIDATE_RETRIEVAL_METADATA_SOURCE_POLICY_PATH,
      CANDIDATE_RETRIEVAL_METADATA_PROVIDER_POLICY_PATH,
    ]);
    expect(fakeAuthority).toHaveBeenCalledOnce();
    expect(publications).toEqual([
      `stage:${CANDIDATE_RETRIEVAL_METADATA_STAGING_PATH}`,
      `publish:${CANDIDATE_RETRIEVAL_METADATA_STAGING_PATH}:${CANDIDATE_RETRIEVAL_METADATA_AUTHORITY_PATH}`,
    ]);
  }, 30_000);

  it('rejects drift in the narrow policy before collection', async () => {
    const catalog = parsePublicCatalog(
      await readFixedFile(CANDIDATE_RETRIEVAL_METADATA_CATALOG_PATH),
    );
    const sourcePolicy = parseProfileMaterializationProviderPolicy(
      catalog,
      JSON.parse(
        await readFixedFile(CANDIDATE_RETRIEVAL_METADATA_SOURCE_POLICY_PATH),
      ) as unknown,
    );
    const policy = JSON.parse(
      await readFixedFile(CANDIDATE_RETRIEVAL_METADATA_PROVIDER_POLICY_PATH),
    ) as Record<string, unknown>;
    policy['logicalRequestBudget'] = 151;
    expect(() =>
      parseCandidateRetrievalMetadataProviderPolicy(
        catalog,
        sourcePolicy,
        policy,
      ),
    ).toThrow();
  });
});

async function readFixedFile(path: string): Promise<string> {
  return readFile(new URL(path, `file://${repositoryRoot}/`), 'utf8');
}

async function collectionAuthorities() {
  const catalog = parsePublicCatalog(
    await readFixedFile(CANDIDATE_RETRIEVAL_METADATA_CATALOG_PATH),
  );
  const sourcePolicy = parseProfileMaterializationProviderPolicy(
    catalog,
    JSON.parse(
      await readFixedFile(CANDIDATE_RETRIEVAL_METADATA_SOURCE_POLICY_PATH),
    ) as unknown,
  );
  const envelope = parseCandidateRetrievalMetadataProviderPolicy(
    catalog,
    sourcePolicy,
    JSON.parse(
      await readFixedFile(CANDIDATE_RETRIEVAL_METADATA_PROVIDER_POLICY_PATH),
    ) as unknown,
  );
  return { catalog, sourcePolicy, envelope };
}

function repositoryTransport(
  catalog: ReturnType<typeof parsePublicCatalog>,
  identity: (
    candidate: ReturnType<typeof parsePublicCatalog>['candidates'][number],
  ) => readonly [string, string],
  nonPublicCandidateId?: string,
): ProviderTransport {
  return {
    requestJson: (request) => {
      const candidate = catalog.candidates.find(
        ({ candidateId }) => candidateId === request.candidateId,
      );
      if (candidate === undefined) throw new Error('Unexpected candidate.');
      const [owner, repository] = identity(candidate);
      return Promise.resolve({
        status: 200,
        headers: new Headers(),
        value: {
          ...(repositoryResponse(owner, repository) as Record<string, unknown>),
          private: candidate.candidateId === nonPublicCandidateId,
        },
      });
    },
  };
}

function repositoryResponse(owner: string, repository: string): unknown {
  return {
    owner: { login: owner },
    name: repository,
    html_url: `https://github.com/${owner}/${repository}`,
    description: 'Synthetic repository-owned description.',
    homepage: null,
    topics: ['audit-logging'],
    default_branch: 'main',
    private: false,
    fork: false,
    archived: false,
    pushed_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-02T00:00:00Z',
    license: { spdx_id: 'MIT' },
    language: 'TypeScript',
  };
}
