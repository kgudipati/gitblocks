import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import {
  candidateAuthorityProviderRouteFromRecord,
  parseCandidateAuthorityProviderRoutes,
} from '../src/candidate-authority-canonical-routing-correction.ts';
import {
  candidateAuthorityRepositoryPath,
  parseCandidateAuthorityRepositoryMetadata,
} from '../src/candidate-authority-live-collector.ts';
import { classifyCandidateAuthorityPackageRepositoryLinkage } from '../src/candidate-authority-replay.ts';
import { parsePublicCatalog } from '../src/manifest.ts';
import { createTransport } from '../src/transport.ts';

describe('candidate authority canonical provider routing correction', () => {
  it('preserves the complete safe v6 failure history without redirect reconstruction', async () => {
    const record = JSON.parse(
      await readFile(
        'catalog/public-v1/candidate-authority-live-failure-record-v3.json',
        'utf8',
      ),
    ) as Record<string, unknown>;
    expect(record).toMatchObject({
      recordVersion: 'candidate-authority-live-failure-record/3.0.0',
      executionHead: '895980891665e373ccf72e63a6b12cf4f09b63c1',
      authorization: {
        version: 'candidate-authority-live-authorization/6.0.0',
        providerEffectCollectionsConsumed: 1,
        remainingProviderEffectCollections: 0,
        rerunPermitted: false,
      },
      operatorVersion: 'candidate-authority-live-operator/6.0.0',
      observedExecutionFacts: {
        collectionCutoff: '2026-08-11T23:11:04.311Z',
        candidateProviderEffectsReached: true,
        failureStage: 'candidate-authority-successor-collect',
        safeErrorCode: 'ingestion.redirect',
        firstFatalCandidateId: 'auth-casbin-casbin',
        firstFatalOperationId: 'github-repository-metadata',
        metrics: {
          githubLogicalRequests: 291,
          npmLogicalRequests: 20,
          totalLogicalRequests: 311,
          githubAttempts: 291,
          npmAttempts: 20,
          totalAttempts: 311,
          retries: 0,
        },
        ownedStagingExisted: false,
        ownedStagingCleaned: false,
        sourceAuthorityPublished: false,
        sourceValidation: 'not-performed',
        replay: 'not-performed',
        readiness: 'not-performed',
        milestone4: 'not-started',
      },
      prohibitedHistoricalReconstruction: {
        redirectLocationHeaderRetained: false,
        redirectLocationHeaderInspected: false,
        redirectTargetObserved: false,
        providerResponseBodyRetained: false,
        providerResponseBodyReconstructed: false,
        credentialMaterialRetained: false,
        candidateFactsReconstructed: false,
      },
    });
    const operations = Object.keys(
      (
        record['observedExecutionFacts'] as {
          metrics: { perOperation: Record<string, unknown> };
        }
      ).metrics.perOperation,
    );
    expect(operations).toHaveLength(13);
  });

  it('validates exactly one accepted Phase 9 route for every catalog candidate', async () => {
    const [catalogText, authorityText] = await Promise.all([
      readFile('catalog/public-v1/manifest.json', 'utf8'),
      readFile(
        'catalog/public-v1/candidate-retrieval-metadata-authority.json',
        'utf8',
      ),
    ]);
    const routes = parseCandidateAuthorityProviderRoutes({
      catalog: parsePublicCatalog(catalogText),
      authority: JSON.parse(authorityText),
    });
    expect(routes.routes).toHaveLength(150);
    expect(routes.byCandidateId.size).toBe(150);
    expect(routes.unchangedCount).toBe(146);
    expect(routes.redirectedCount).toBe(4);
    expect(
      new Set(routes.routes.map(({ candidateId }) => candidateId)).size,
    ).toBe(150);
    expect(
      new Set(
        routes.routes.map(
          ({ providerCanonicalOwner, providerCanonicalRepository }) =>
            `${providerCanonicalOwner}/${providerCanonicalRepository}`.toLowerCase(),
        ),
      ).size,
    ).toBe(150);
  });

  it('routes a redirected synthetic candidate only to the frozen canonical repository', () => {
    const route = candidateAuthorityProviderRouteFromRecord({
      candidateId: 'synthetic-route',
      catalogOwner: 'old-owner',
      catalogRepository: 'project',
      providerCanonicalOwner: 'new-owner',
      providerCanonicalRepository: 'project',
      repositoryIdentityState: 'redirected',
      sourceRecordDigest:
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    });
    expect(candidateAuthorityRepositoryPath(route)).toBe(
      '/repos/new-owner/project',
    );
    expect(candidateAuthorityRepositoryPath(route)).not.toContain('old-owner');
    expect(
      parseCandidateAuthorityRepositoryMetadata(
        {
          id: 42,
          full_name: 'new-owner/project',
          owner: { login: 'new-owner' },
          name: 'project',
          default_branch: 'main',
          archived: false,
          language: 'TypeScript',
        },
        route,
        true,
      ),
    ).toMatchObject({
      repositoryId: '42',
      canonicalOwner: 'new-owner',
      canonicalRepository: 'project',
    });
    for (const fullName of ['old-owner/project', 'third-owner/project']) {
      expect(() =>
        parseCandidateAuthorityRepositoryMetadata(
          {
            id: 42,
            full_name: fullName,
            owner: { login: fullName.split('/')[0] },
            name: 'project',
            default_branch: 'main',
            archived: false,
            language: null,
          },
          route,
          true,
        ),
      ).toThrow(
        expect.objectContaining({ code: 'ingestion.provider-identity' }),
      );
    }
  });

  it('matches only the historical catalog and accepted canonical linkage aliases', () => {
    const base = {
      repositoryState: 'supported' as const,
      catalogRepository: { owner: 'old-owner', repository: 'project' },
      providerCanonicalRepository: {
        owner: 'new-owner',
        repository: 'project',
      },
    };
    expect(
      classifyCandidateAuthorityPackageRepositoryLinkage({
        ...base,
        declaredRepository: { owner: 'old-owner', repository: 'project' },
      }),
    ).toBe('matched');
    expect(
      classifyCandidateAuthorityPackageRepositoryLinkage({
        ...base,
        declaredRepository: { owner: 'new-owner', repository: 'project' },
      }),
    ).toBe('matched');
    expect(
      classifyCandidateAuthorityPackageRepositoryLinkage({
        ...base,
        declaredRepository: { owner: 'unrelated', repository: 'project' },
      }),
    ).toBe('mismatched');
    expect(
      classifyCandidateAuthorityPackageRepositoryLinkage({
        ...base,
        repositoryState: 'absent',
        declaredRepository: null,
      }),
    ).toBe('undeclared');
    expect(
      classifyCandidateAuthorityPackageRepositoryLinkage({
        ...base,
        repositoryState: 'unsupported',
        declaredRepository: { owner: 'new-owner', repository: 'project' },
      }),
    ).toBe('unknown');
  });

  it('isolates routing from Phase 9 description, topics, and language metadata', () => {
    const record = {
      candidateId: 'synthetic-route',
      catalogOwner: 'old-owner',
      catalogRepository: 'project',
      providerCanonicalOwner: 'new-owner',
      providerCanonicalRepository: 'project',
      repositoryIdentityState: 'redirected' as const,
      sourceRecordDigest:
        'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      description: 'first',
      topics: ['first'],
      primaryLanguage: 'TypeScript',
    };
    const changedMetadata = {
      ...record,
      description: 'changed',
      topics: ['changed'],
      primaryLanguage: 'Rust',
    };
    expect(candidateAuthorityProviderRouteFromRecord(record)).toEqual(
      candidateAuthorityProviderRouteFromRecord(changedMetadata),
    );
  });

  it('keeps zero redirects and contains no candidate-specific production routing branch', async () => {
    const [effects, collector, replay] = await Promise.all([
      readFile(
        'packages/ingestion/scripts/candidate-authority-successor-system-effects.ts',
        'utf8',
      ),
      readFile(
        'packages/ingestion/src/candidate-authority-live-collector.ts',
        'utf8',
      ),
      readFile('packages/ingestion/src/candidate-authority-replay.ts', 'utf8'),
    ]);
    expect(effects).toContain('maximumRedirects: 0');
    expect(effects).toContain('maximumAttempts: 3');
    for (const text of [effects, collector, replay]) {
      expect(text).not.toMatch(
        /auth-casbin-casbin|casbin\/casbin|apache\/casbin|request ordinal 311|github request count 291/iu,
      );
    }
  });

  it('fails an accepted canonical-route redirect without following or inspecting Location', async () => {
    let fetchCalls = 0;
    let locationReads = 0;
    const headers = {
      get: (name: string) => {
        if (name.toLowerCase() === 'location') locationReads += 1;
        return null;
      },
    } as unknown as Headers;
    const transport = createTransport({
      maximumRedirects: 0,
      maximumAttempts: 3,
      fetch: () => {
        fetchCalls += 1;
        return Promise.resolve({
          status: 301,
          headers,
          body: null,
        } as unknown as Response);
      },
      sleep: () => Promise.resolve(),
    });
    await expect(
      transport.requestJson({
        url: new URL('https://api.github.com/repos/new-owner/project'),
        provider: 'github',
        operation: 'github-repository-metadata',
        maximumBytes: 1_024,
        maximumNodes: 100,
        correlationId: 'synthetic-canonical-route',
        candidateId: 'synthetic-route',
      }),
    ).rejects.toMatchObject({ code: 'ingestion.redirect' });
    expect(fetchCalls).toBe(1);
    expect(locationReads).toBe(0);
  });
});
