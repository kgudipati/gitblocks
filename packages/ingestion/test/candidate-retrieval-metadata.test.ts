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
    expect(authority.candidates[0]?.topics).toEqual(['audit-logging']);
    expect(authority.candidates[0]?.primaryLanguage).toBe('TypeScript');
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
