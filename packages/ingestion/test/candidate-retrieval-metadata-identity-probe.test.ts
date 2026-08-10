import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { describe, expect, it, vi } from 'vitest';

import {
  CANDIDATE_RETRIEVAL_METADATA_CATALOG_PATH,
  CANDIDATE_RETRIEVAL_METADATA_GITHUB_TOKEN_ENVIRONMENT,
  CANDIDATE_RETRIEVAL_METADATA_SOURCE_POLICY_PATH,
  parseProfileMaterializationProviderPolicy,
  parsePublicCatalog,
  type JsonResponse,
  type ProviderTransport,
  type PublicCatalog,
  type TransportRequest,
} from '../src/index.ts';
import { probeCandidateRetrievalMetadataIdentities } from '../src/candidate-retrieval-metadata-identity-probe.ts';
import {
  CandidateRetrievalMetadataOperationFailure,
  executeCandidateRetrievalMetadataIdentityProbe,
  preflightCandidateRetrievalMetadataIdentityProbe,
  renderCandidateRetrievalMetadataCliFailure,
  type CandidateRetrievalMetadataIdentityProbeEffects,
} from '../src/candidate-retrieval-metadata-runner.ts';

const repositoryRoot = fileURLToPath(new URL('../../..', import.meta.url));
const fakeCredential = 'probe-credential-never-render-this';
const prohibitedProviderText =
  'PROBE_DESCRIPTION PROBE_TOPIC PROBE_LANGUAGE PROBE_BODY PROBE_HEADER';

describe('candidate retrieval metadata identity probe', () => {
  it('preflights exactly 150 identity-only requests with zero external effects', async () => {
    const credential = vi.fn();
    const network = vi.fn();
    const write = vi.fn();
    const reads: string[] = [];
    const effects = {
      readFixedFile: async (path: string) => {
        reads.push(path);
        return readRepositoryFile(path);
      },
      readCredential: credential,
      probeIdentities: network,
      stageExclusive: write,
    };
    const result =
      await preflightCandidateRetrievalMetadataIdentityProbe(effects);

    expect(reads).toEqual([
      CANDIDATE_RETRIEVAL_METADATA_CATALOG_PATH,
      CANDIDATE_RETRIEVAL_METADATA_SOURCE_POLICY_PATH,
    ]);
    expect(result).toMatchObject({
      status: 'passed',
      command: 'pnpm retrieval:metadata:identity-probe:preflight',
      futureCommand: 'pnpm retrieval:metadata:identity-probe',
      credentialEnvironmentName:
        CANDIDATE_RETRIEVAL_METADATA_GITHUB_TOKEN_ENVIRONMENT,
      logicalRequestBudget: 150,
      worstCaseRequestAttemptBudget: 450,
      writePaths: [],
      requirements: {
        database: false,
        docker: false,
        model: false,
        npm: false,
        artifactBodies: false,
      },
    });
    expect(result.catalog.catalogVersion).toBe('public-v1');
    expect(result.catalog.manifestDigest).toBe(
      '4819dd94cb1bbe5e27c31ca5ca55976da1442987a792bf438d96681021cb8634',
    );
    expect(result.sourceOperation).toMatchObject({
      operation: 'github-repository-metadata',
      method: 'GET',
      host: 'api.github.com',
      endpointTemplate: '/repos/{owner}/{repository}',
      maximumAttempts: 3,
    });
    expect(credential).not.toHaveBeenCalled();
    expect(network).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
  });

  it('reports only bounded identity facts and aggregate attempt diagnostics', async () => {
    const { catalog, sourcePolicy } = await acceptedAuthorities();
    const requests: TransportRequest[] = [];
    const [redirected, nonPublic, malformed, duplicateOne, duplicateTwo] =
      catalog.candidates;
    if (
      redirected === undefined ||
      nonPublic === undefined ||
      malformed === undefined ||
      duplicateOne === undefined ||
      duplicateTwo === undefined
    ) {
      throw new Error('Identity probe fixtures unavailable.');
    }
    const transport: ProviderTransport = {
      requestJson: (request): Promise<JsonResponse> => {
        requests.push(request);
        const candidate = catalog.candidates.find(
          ({ candidateId }) => candidateId === request.candidateId,
        );
        if (candidate === undefined) throw new Error('Unexpected candidate.');
        if (candidate.candidateId === malformed.candidateId) {
          return Promise.resolve({
            status: 200,
            headers: new Headers({ 'x-probe-secret': prohibitedProviderText }),
            value: { malformed: prohibitedProviderText },
          });
        }
        const [owner, repository] =
          candidate.candidateId === redirected.candidateId
            ? ['redirected-provider-owner', 'redirected-provider-repository']
            : candidate.candidateId === duplicateOne.candidateId ||
                candidate.candidateId === duplicateTwo.candidateId
              ? ['duplicate-provider-owner', 'duplicate-provider-repository']
              : [candidate.github.owner, candidate.github.repository];
        return Promise.resolve({
          status: 200,
          headers: new Headers({ 'x-probe-secret': prohibitedProviderText }),
          value: repositoryResponse(
            owner,
            repository,
            candidate.candidateId !== nonPublic.candidateId,
          ),
        });
      },
    };

    const result = await probeCandidateRetrievalMetadataIdentities(catalog, {
      transport,
      sourceProviderPolicy: sourcePolicy,
      githubToken: fakeCredential,
      correlationId: 'synthetic-identity-probe',
      concurrency: 3,
      candidateDeadlineMilliseconds: 90_000,
      runDeadlineMilliseconds: 3_600_000,
      readAttemptMetrics: () => ({ requestAttempts: 150, retries: 0 }),
    });

    expect(requests).toHaveLength(150);
    expect(
      requests.every(
        (request) =>
          request.operation === 'github-repository-metadata' &&
          request.provider === 'github' &&
          request.url.host === 'api.github.com' &&
          /^\/repos\/[^/]+\/[^/]+$/u.test(request.url.pathname),
      ),
    ).toBe(true);
    expect(result).toMatchObject({
      requestedCandidates: 150,
      completedCandidates: 149,
      failedCandidates: 1,
      unchangedCount: 145,
      redirectedCount: 3,
      nonPublicCount: 1,
      providerCanonicalDuplicateCount: 1,
      logicalRequests: 150,
      requestAttempts: 150,
      retries: 0,
    });
    expect(result.identityDifferences).toHaveLength(5);
    expect(
      result.identityDifferences.find(
        ({ candidateId }) => candidateId === redirected.candidateId,
      ),
    ).toMatchObject({
      catalogOwner: redirected.github.owner,
      catalogRepository: redirected.github.repository,
      providerCanonicalOwner: 'redirected-provider-owner',
      providerCanonicalRepository: 'redirected-provider-repository',
      identityState: 'redirected',
    });
    expect(
      result.identityDifferences.find(
        ({ candidateId }) => candidateId === nonPublic.candidateId,
      ),
    ).toMatchObject({ identityState: 'non-public' });
    expect(
      result.identityDifferences.find(
        ({ candidateId }) => candidateId === malformed.candidateId,
      ),
    ).toMatchObject({
      providerCanonicalOwner: null,
      providerCanonicalRepository: null,
      identityState: 'failed',
    });
    const output = JSON.stringify(result);
    expect(output).not.toContain(prohibitedProviderText);
    expect(output).not.toContain(fakeCredential);
    expect(output).not.toMatch(/description|topics?|language|headers?|body/iu);
  }, 30_000);

  it('has no write surface and renders probe failures without credential values', async () => {
    const source = await readFile(
      new URL(
        '../src/candidate-retrieval-metadata-identity-probe.ts',
        import.meta.url,
      ),
      'utf8',
    );
    expect(source).not.toMatch(
      /node:fs|stageExclusive|publishStaged|writeFile/u,
    );
    const effects: CandidateRetrievalMetadataIdentityProbeEffects = {
      readFixedFile: readRepositoryFile,
      readCredential: () => fakeCredential,
      probeIdentities: () =>
        Promise.reject(new Error(`hostile:${fakeCredential}`)),
    };
    let failure: CandidateRetrievalMetadataOperationFailure;
    try {
      await executeCandidateRetrievalMetadataIdentityProbe(
        effects,
        new AbortController().signal,
      );
      throw new Error('Expected identity probe failure.');
    } catch (error) {
      expect(error).toBeInstanceOf(CandidateRetrievalMetadataOperationFailure);
      failure = error as CandidateRetrievalMetadataOperationFailure;
    }
    const rendered = renderCandidateRetrievalMetadataCliFailure(
      'identity-probe',
      failure,
    );
    expect(rendered).toBe(
      'Candidate retrieval metadata operation failed safely (operation=identity-probe; stage=identity-probe-execution; code=ingestion.internal-invariant).\n',
    );
    expect(rendered).not.toContain(fakeCredential);
  });
});

async function acceptedAuthorities(): Promise<{
  readonly catalog: PublicCatalog;
  readonly sourcePolicy: ReturnType<
    typeof parseProfileMaterializationProviderPolicy
  >;
}> {
  const catalog = parsePublicCatalog(
    await readRepositoryFile(CANDIDATE_RETRIEVAL_METADATA_CATALOG_PATH),
  );
  const sourcePolicy = parseProfileMaterializationProviderPolicy(
    catalog,
    JSON.parse(
      await readRepositoryFile(CANDIDATE_RETRIEVAL_METADATA_SOURCE_POLICY_PATH),
    ) as unknown,
  );
  return { catalog, sourcePolicy };
}

async function readRepositoryFile(path: string): Promise<string> {
  return readFile(new URL(path, `file://${repositoryRoot}/`), 'utf8');
}

function repositoryResponse(
  owner: string,
  repository: string,
  isPublic: boolean,
): unknown {
  return {
    owner: { login: owner },
    name: repository,
    html_url: `https://github.com/${owner}/${repository}`,
    description: prohibitedProviderText,
    homepage: null,
    topics: [prohibitedProviderText],
    default_branch: 'main',
    private: !isPublic,
    fork: false,
    archived: false,
    pushed_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-02T00:00:00Z',
    license: { spdx_id: 'MIT' },
    language: prohibitedProviderText,
  };
}
