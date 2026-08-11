import { readFile } from 'node:fs/promises';
/* eslint-disable @typescript-eslint/require-await -- Async fixture transports implement the production promise boundary without effects. */

import { readFileSync } from 'node:fs';

import { repositoryArtifactGitBlobObjectId } from '@gitblocks/contracts';
import { parseCapabilityTaxonomyV1 } from '@gitblocks/contracts';
import { describe, expect, it } from 'vitest';

import {
  CANDIDATE_AUTHORITY_SUCCESSOR_OPERATION_IDS,
  materializeCandidateAuthoritySuccessorRuntimeSourcePolicy,
} from '../src/candidate-authority-provider-contract.ts';
import { collectCandidateAuthoritySourceAuthority } from '../src/candidate-authority-live-collector.ts';
import {
  CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V4_DIGEST,
  CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V4_VERSION,
  CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_PATH,
  CANDIDATE_AUTHORITY_SOURCE_POLICY_V6_PATH,
} from '../src/candidate-authority-postmortem.ts';
import {
  CANDIDATE_AUTHORITY_FIELD_PLAN_V5_PATH,
  materializeCandidateAuthorityFieldPlanV5,
} from '../src/candidate-authority-postmortem.ts';
import { parseCandidateAuthorityPartialSemanticRegistry } from '../src/candidate-authority-partial-semantics.ts';
import {
  parseCandidateAuthorityFieldPlanV4,
  parseCandidateAuthorityReadinessPolicyV3,
} from '../src/candidate-authority-readiness.ts';
import {
  candidateAuthoritySuccessorReplaySemanticDigest,
  generateCandidateAuthoritySuccessorReplay,
} from '../src/candidate-authority-successor-replay.ts';
import { ingestionError } from '../src/errors.ts';
import { parsePublicCatalog } from '../src/manifest.ts';

const CUTOFF = '2026-08-10T12:34:56.000Z';
const HEAD = '1111111111111111111111111111111111111111';
const TREE = '2222222222222222222222222222222222222222';
const LICENSE_BLOB_SHA = '3333333333333333333333333333333333333333';
const DOT_GITHUB_TREE = '4444444444444444444444444444444444444444';
const DOCS_TREE = '5555555555555555555555555555555555555555';
const SECURITY_BLOB_SHA = '6666666666666666666666666666666666666666';
const COMPOSE = '{"services":{"app":{"build":"."}}}\n';
const DOCKERFILE =
  '# syntax=docker/dockerfile:1\nARG BASE=node:24\nFROM node:24\n';
const COMPOSE_SHA = repositoryArtifactGitBlobObjectId('sha1', COMPOSE);
const DOCKERFILE_SHA = repositoryArtifactGitBlobObjectId('sha1', DOCKERFILE);
const FIXTURE_CATALOG = JSON.parse(
  readFileSync('catalog/public-v1/manifest.json', 'utf8'),
) as {
  candidates: {
    candidateId: string;
    github: { owner: string; repository: string };
    npmPackage: string | null;
  }[];
};

describe('candidate-authority one-shot live collector with inert providers', () => {
  it('executes every frozen operation, retains only normalized facts, and stays within exact budgets', async () => {
    const { catalog, sourcePolicy } = await authorities();
    const attempts = {
      githubAttempts: 0,
      npmAttempts: 0,
      retries: 0,
      perOperationAttempts: {} as Record<string, number>,
    };
    const transport = {
      requestJson: async (request: {
        provider: 'github' | 'npm';
        operation: string;
        candidateId: string;
        url: URL;
      }) => {
        if (request.provider === 'github') attempts.githubAttempts += 1;
        else attempts.npmAttempts += 1;
        attempts.perOperationAttempts[request.operation] =
          (attempts.perOperationAttempts[request.operation] ?? 0) + 1;
        return fakeResponse(request, catalog.candidates[0]?.candidateId ?? '');
      },
    };
    const authority = await collectCandidateAuthoritySourceAuthority({
      catalog,
      sourcePolicy,
      liveAuthorizationVersion:
        CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V4_VERSION,
      liveAuthorizationDigest: CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V4_DIGEST,
      liveAuthorizationBindings: liveAuthorizationBindings(
        catalog.manifestDigest,
      ),
      executionHead: HEAD,
      githubToken: 'inert-fixture-token',
      collectionCutoff: CUTOFF,
      transport,
      readAttemptMetrics: () => attempts,
    });
    const text = JSON.stringify(authority);
    expect(authority.candidateCount).toBe(150);
    expect(authority.effectReceipt.githubLogicalRequests).toBeLessThanOrEqual(
      1810,
    );
    expect(authority.effectReceipt.npmLogicalRequests).toBe(80);
    expect(authority.effectReceipt.totalLogicalRequests).toBeLessThanOrEqual(
      1890,
    );
    expect(
      authority.effectReceipt.perOperation.map((entry) => entry.operationId),
    ).toEqual(CANDIDATE_AUTHORITY_SUCCESSOR_OPERATION_IDS);
    expect(
      authority.effectReceipt.perOperation.every(
        (entry) => entry.logicalRequests > 0,
      ),
    ).toBe(true);
    expect(text).not.toContain('inert-fixture-token');
    expect(text).not.toContain('boundedBase64Content');

    const first = authority.candidates[0];
    expect(first).toBeDefined();
    const compose = first?.sources.find(
      (source) => source.operationId === 'github-compose-json-blob',
    );
    const dockerfile = first?.sources.find(
      (source) => source.operationId === 'github-dockerfile-blob',
    );
    expect(compose?.value).toMatchObject({
      parserOutcome: 'established-facts',
    });
    expect(dockerfile?.value).toMatchObject({
      parserOutcome: 'established-facts',
    });
    const license = first?.sources.find(
      (source) => source.operationId === 'github-license',
    );
    expect(license?.value).toMatchObject({
      headSha: HEAD,
      path: 'LICENSE.md',
      blobSha: LICENSE_BLOB_SHA,
      spdxId: 'MIT',
      partialFacts: [{ factCode: 'recognized-license-spdx', factValue: 'MIT' }],
    });
    expect(JSON.stringify(license?.value)).not.toMatch(
      /content|download_url|authorization/iu,
    );

    const [taxonomyText, readinessText, registryText, planV4Text, planV5Text] =
      await Promise.all([
        readFile('catalog/capability-taxonomy/1.0.0/manifest.json', 'utf8'),
        readFile(
          'catalog/public-v1/candidate-authority-readiness-policy-v3.json',
          'utf8',
        ),
        readFile(
          'catalog/public-v1/candidate-authority-partial-field-semantics-v2.json',
          'utf8',
        ),
        readFile(
          'catalog/public-v1/candidate-authority-field-plan-v4.json',
          'utf8',
        ),
        readFile(CANDIDATE_AUTHORITY_FIELD_PLAN_V5_PATH, 'utf8'),
      ]);
    const taxonomy = parseCapabilityTaxonomyV1(JSON.parse(taxonomyText));
    expect(taxonomy.ok).toBe(true);
    if (!taxonomy.ok) throw new Error('fixture taxonomy invalid');
    const registry = parseCandidateAuthorityPartialSemanticRegistry(
      JSON.parse(registryText),
    );
    const readiness = parseCandidateAuthorityReadinessPolicyV3(
      JSON.parse(readinessText),
    );
    const planV4 = parseCandidateAuthorityFieldPlanV4(
      JSON.parse(planV4Text),
      readiness,
      registry,
    );
    const fieldPlan = materializeCandidateAuthorityFieldPlanV5({
      predecessor: planV4,
      successorAuthority: JSON.parse(planV5Text),
    });
    const replayInput = {
      catalog,
      taxonomy: taxonomy.value,
      sourceAuthority: authority,
      fieldPlan,
      partialSemanticRegistry: registry,
    };
    let normal: ReturnType<typeof generateCandidateAuthoritySuccessorReplay>;
    try {
      normal = generateCandidateAuthoritySuccessorReplay(replayInput);
    } catch (error) {
      throw new Error('full successor normal replay fixture failed', {
        cause: error,
      });
    }
    const repeat = generateCandidateAuthoritySuccessorReplay(replayInput);
    const reverse = generateCandidateAuthoritySuccessorReplay({
      ...replayInput,
      catalog: {
        ...catalog,
        candidates: [...catalog.candidates].reverse(),
      },
      sourceAuthority: {
        ...authority,
        candidates: [...authority.candidates].reverse(),
      },
    });
    const permutation = generateCandidateAuthoritySuccessorReplay({
      ...replayInput,
      sourceAuthority: {
        ...authority,
        candidates: authority.candidates.map((candidate) => ({
          ...candidate,
          sources: [...candidate.sources].reverse(),
        })),
      },
    });
    const normalDigest =
      candidateAuthoritySuccessorReplaySemanticDigest(normal);
    expect([
      candidateAuthoritySuccessorReplaySemanticDigest(repeat),
      candidateAuthoritySuccessorReplaySemanticDigest(reverse),
      candidateAuthoritySuccessorReplaySemanticDigest(permutation),
    ]).toEqual([normalDigest, normalDigest, normalDigest]);
    expect(normal.dossiers.dossiers).toHaveLength(150);
    expect(normal.profiles.profileAuthority.profiles).toHaveLength(150);
    const firstNpmCandidate = catalog.candidates.find(
      (candidate) => candidate.npmPackage !== null,
    );
    const firstNpmProfile = normal.profiles.profileAuthority.profiles.find(
      (profile) => profile.candidateId === firstNpmCandidate?.candidateId,
    );
    const firstNpmFields = firstNpmProfile?.fields as unknown as
      | readonly { readonly fieldId: string; readonly state: string }[]
      | undefined;
    expect(
      firstNpmFields?.find(
        (field) => field.fieldId === 'security-advisory-state',
      )?.state,
    ).toBe('unknown');
    expect(
      firstNpmFields?.find((field) => field.fieldId === 'release-state-recency')
        ?.state,
    ).toBe('unknown');
    expect(
      normal.partial.records.some(
        (record) =>
          record.candidateId === firstNpmCandidate?.candidateId &&
          record.factCode === 'applicable-security-advisory' &&
          record.factValue.includes('"severity":"moderate"'),
      ),
    ).toBe(true);
    expect(
      normal.partial.records.some(
        (record) =>
          record.candidateId === firstNpmCandidate?.candidateId &&
          record.factCode === 'published-release',
      ),
    ).toBe(true);
    const localSecurityProfile = normal.profiles.profileAuthority.profiles[0];
    const absentSecurityProfile = normal.profiles.profileAuthority.profiles[1];
    const securityState = (profile: typeof localSecurityProfile) =>
      (
        profile?.fields as unknown as readonly {
          readonly fieldId: string;
          readonly state: string;
        }[]
      ).find((field) => field.fieldId === 'security-policy-presence')?.state;
    expect(securityState(localSecurityProfile)).toBe('known');
    expect(securityState(absentSecurityProfile)).toBe('unknown');
    expect(
      normal.partial.records.some(
        (record) =>
          record.factCode === 'repository-self-build-compose-service' ||
          record.factCode === 'repository-container-build-declaration',
      ),
    ).toBe(true);
    const unsupportedCandidate = catalog.candidates.filter(
      (candidate) => candidate.npmPackage !== null,
    )[1];
    const unsupportedProfile = normal.profiles.profileAuthority.profiles.find(
      (profile) => profile.candidateId === unsupportedCandidate?.candidateId,
    );
    const unsupportedFields = unsupportedProfile?.fields as unknown as
      | readonly { readonly fieldId: string; readonly state: string }[]
      | undefined;
    expect(
      unsupportedFields?.find(
        (field) => field.fieldId === 'package-publication-version',
      )?.state,
    ).toBe('known');
    expect(
      unsupportedFields?.find(
        (field) => field.fieldId === 'runtime-package-format',
      )?.state,
    ).toBe('unknown');
    expect(
      unsupportedFields?.find(
        (field) => field.fieldId === 'package-repository-linkage',
      )?.state,
    ).toBe('unknown');
  });

  it('treats optional transient sources as qualified unknown but fails required identity', async () => {
    const { catalog, sourcePolicy } = await authorities();
    const attempts = {
      githubAttempts: 0,
      npmAttempts: 0,
      retries: 0,
      perOperationAttempts: {} as Record<string, number>,
    };
    const optionalUnknownTransport = {
      requestJson: async (request: {
        provider: 'github' | 'npm';
        operation: string;
        candidateId: string;
        url: URL;
      }) => {
        if (request.provider === 'github') attempts.githubAttempts += 1;
        else attempts.npmAttempts += 1;
        attempts.perOperationAttempts[request.operation] =
          (attempts.perOperationAttempts[request.operation] ?? 0) + 1;
        if (request.operation === 'github-security-docs-tree')
          throw ingestionError('ingestion.provider-unavailable');
        return fakeResponse(request, catalog.candidates[0]?.candidateId ?? '');
      },
    };
    const authority = await collectCandidateAuthoritySourceAuthority({
      catalog,
      sourcePolicy,
      liveAuthorizationVersion:
        CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V4_VERSION,
      liveAuthorizationDigest: CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V4_DIGEST,
      liveAuthorizationBindings: liveAuthorizationBindings(
        catalog.manifestDigest,
      ),
      executionHead: HEAD,
      githubToken: 'inert-fixture-token',
      collectionCutoff: CUTOFF,
      transport: optionalUnknownTransport,
      readAttemptMetrics: () => attempts,
    });
    expect(
      authority.effectReceipt.controlledOptionalSourceFailures[
        'github-security-docs-tree:ingestion.provider-unavailable'
      ],
    ).toBe(150);

    const fatalAttempts = {
      githubAttempts: 1,
      npmAttempts: 0,
      retries: 0,
      perOperationAttempts: { 'github-repository-metadata': 1 },
    };
    await expect(
      collectCandidateAuthoritySourceAuthority({
        catalog,
        sourcePolicy,
        liveAuthorizationVersion:
          CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V4_VERSION,
        liveAuthorizationDigest:
          CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V4_DIGEST,
        liveAuthorizationBindings: liveAuthorizationBindings(
          catalog.manifestDigest,
        ),
        executionHead: HEAD,
        githubToken: 'inert-fixture-token',
        collectionCutoff: CUTOFF,
        transport: {
          requestJson: async () => {
            throw ingestionError('ingestion.provider-identity');
          },
        },
        readAttemptMetrics: () => fatalAttempts,
      }),
    ).rejects.toMatchObject({ safeCode: 'ingestion.provider-identity' });
  });

  it('fails closed on an unsafe provider-returned license path', async () => {
    const { catalog, sourcePolicy } = await authorities();
    const attempts = {
      githubAttempts: 0,
      npmAttempts: 0,
      retries: 0,
      perOperationAttempts: {} as Record<string, number>,
    };
    await expect(
      collectCandidateAuthoritySourceAuthority({
        catalog,
        sourcePolicy,
        liveAuthorizationVersion:
          CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V4_VERSION,
        liveAuthorizationDigest:
          CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V4_DIGEST,
        liveAuthorizationBindings: liveAuthorizationBindings(
          catalog.manifestDigest,
        ),
        executionHead: HEAD,
        githubToken: 'inert-fixture-token',
        collectionCutoff: CUTOFF,
        transport: {
          requestJson: async (request) => {
            if (request.provider === 'github') attempts.githubAttempts += 1;
            else attempts.npmAttempts += 1;
            attempts.perOperationAttempts[request.operation] =
              (attempts.perOperationAttempts[request.operation] ?? 0) + 1;
            if (request.operation === 'github-license') {
              return {
                value: {
                  path: '../LICENSE',
                  sha: LICENSE_BLOB_SHA,
                  license: { spdx_id: 'MIT' },
                },
                headers: new Headers(),
                status: 200,
              };
            }
            return fakeResponse(
              request,
              catalog.candidates[0]?.candidateId ?? '',
            );
          },
        },
        readAttemptMetrics: () => attempts,
      }),
    ).rejects.toMatchObject({ safeCode: 'ingestion.provider-response' });
  });

  it('treats valid non-normal Compose and Dockerfile entries as qualified unknown without blob requests', async () => {
    const { catalog, sourcePolicy } = await authorities();
    const attempts = {
      githubAttempts: 0,
      npmAttempts: 0,
      retries: 0,
      perOperationAttempts: {} as Record<string, number>,
    };
    const firstCandidateId = catalog.candidates[0]?.candidateId ?? '';
    const forbiddenBlobCalls: string[] = [];
    const authority = await collectCandidateAuthoritySourceAuthority({
      catalog,
      sourcePolicy,
      liveAuthorizationVersion:
        CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V4_VERSION,
      liveAuthorizationDigest: CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V4_DIGEST,
      liveAuthorizationBindings: liveAuthorizationBindings(
        catalog.manifestDigest,
      ),
      executionHead: HEAD,
      githubToken: 'inert-fixture-token',
      collectionCutoff: CUTOFF,
      transport: {
        requestJson: async (request) => {
          if (request.provider === 'github') attempts.githubAttempts += 1;
          else attempts.npmAttempts += 1;
          attempts.perOperationAttempts[request.operation] =
            (attempts.perOperationAttempts[request.operation] ?? 0) + 1;
          if (
            request.candidateId === firstCandidateId &&
            request.operation === 'github-root-tree'
          ) {
            return {
              value: {
                sha: TREE,
                truncated: false,
                tree: [
                  {
                    path: '.github',
                    mode: '040000',
                    type: 'tree',
                    sha: DOT_GITHUB_TREE,
                  },
                  {
                    path: 'docs',
                    mode: '040000',
                    type: 'tree',
                    sha: DOCS_TREE,
                  },
                  {
                    path: 'compose.json',
                    mode: '120000',
                    type: 'blob',
                    sha: '7'.repeat(40),
                    size: 12,
                  },
                  {
                    path: 'Dockerfile',
                    mode: '160000',
                    type: 'commit',
                    sha: '8'.repeat(40),
                  },
                ],
              },
              headers: new Headers(),
              status: 200,
            };
          }
          if (
            request.candidateId === firstCandidateId &&
            (request.operation === 'github-compose-json-blob' ||
              request.operation === 'github-dockerfile-blob')
          ) {
            forbiddenBlobCalls.push(request.operation);
            throw new Error('blob request must not occur');
          }
          return fakeResponse(request, firstCandidateId);
        },
      },
      readAttemptMetrics: () => attempts,
    });
    const first = authority.candidates[0];
    expect(forbiddenBlobCalls).toEqual([]);
    expect(
      first?.sources.find(
        (source) => source.operationId === 'github-compose-json-blob',
      ),
    ).toMatchObject({
      outcome: 'qualified-unknown',
      limitationCode: 'unsupported-structured-value',
    });
    expect(
      first?.sources.find(
        (source) => source.operationId === 'github-dockerfile-blob',
      ),
    ).toMatchObject({
      outcome: 'qualified-unknown',
      limitationCode: 'unsupported-structured-value',
    });
  });
});

async function authorities() {
  const [catalogText, sourceText, providerText] = await Promise.all([
    readFile('catalog/public-v1/manifest.json', 'utf8'),
    readFile(CANDIDATE_AUTHORITY_SOURCE_POLICY_V6_PATH, 'utf8'),
    readFile(CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_PATH, 'utf8'),
  ]);
  const catalog = parsePublicCatalog(catalogText);
  return {
    catalog,
    sourcePolicy: materializeCandidateAuthoritySuccessorRuntimeSourcePolicy(
      JSON.parse(sourceText),
      JSON.parse(providerText),
    ),
  };
}

function fakeResponse(
  request: {
    operation: string;
    candidateId: string;
    url: URL;
  },
  firstCandidateId: string,
) {
  const first = request.candidateId === firstCandidateId;
  const candidate = FIXTURE_CATALOG.candidates.find(
    (value) => value.candidateId === request.candidateId,
  );
  if (candidate === undefined) throw new Error('fixture candidate missing');
  const npmCandidates = FIXTURE_CATALOG.candidates.filter(
    (value) => value.npmPackage !== null,
  );
  const npmOrdinal = npmCandidates.findIndex(
    (value) => value.candidateId === candidate.candidateId,
  );
  const firstNpm = npmOrdinal === 0;
  const response = (value: unknown, headers: Headers = new Headers()) => ({
    value,
    headers,
    status: 200,
  });
  switch (request.operation) {
    case 'github-repository-metadata':
      return response({
        id: FIXTURE_CATALOG.candidates.indexOf(candidate) + 1,
        full_name: `${candidate.github.owner}/${candidate.github.repository}`,
        default_branch: 'main',
        archived: false,
        language: 'TypeScript',
      });
    case 'github-default-branch-ref':
      return response({
        ref: 'refs/heads/main',
        object: { type: 'commit', sha: HEAD },
      });
    case 'github-head-commit-object':
      return response({
        sha: HEAD,
        tree: { sha: TREE },
        author: { date: '2026-08-01T00:00:00Z' },
        committer: { date: '2026-08-01T00:00:00Z' },
      });
    case 'github-root-tree':
      return response({
        sha: TREE,
        truncated: false,
        tree: [
          {
            path: '.github',
            mode: '040000',
            type: 'tree',
            sha: DOT_GITHUB_TREE,
          },
          {
            path: 'docs',
            mode: '040000',
            type: 'tree',
            sha: DOCS_TREE,
          },
          ...(first
            ? [
                {
                  path: 'Dockerfile',
                  mode: '100644',
                  type: 'blob',
                  sha: DOCKERFILE_SHA,
                  size: Buffer.byteLength(DOCKERFILE),
                },
                {
                  path: 'compose.json',
                  mode: '100644',
                  type: 'blob',
                  sha: COMPOSE_SHA,
                  size: Buffer.byteLength(COMPOSE),
                },
              ]
            : []),
        ],
      });
    case 'github-maintenance-window':
      return response([]);
    case 'github-license':
      return response({
        path: 'LICENSE.md',
        sha: LICENSE_BLOB_SHA,
        license: { spdx_id: 'MIT' },
      });
    case 'github-security-dot-github-tree':
      return response({
        sha: DOT_GITHUB_TREE,
        truncated: false,
        tree: first
          ? [
              {
                path: 'SECURITY.md',
                mode: '100644',
                type: 'blob',
                sha: SECURITY_BLOB_SHA,
              },
            ]
          : [],
      });
    case 'github-security-docs-tree':
      return response({ sha: DOCS_TREE, truncated: false, tree: [] });
    case 'github-release-window':
      return response(
        firstNpm
          ? [
              {
                draft: false,
                tag_name: 'v1.2.3',
                published_at: '2026-07-01T00:00:00Z',
                prerelease: false,
                html_url: `https://github.com/${candidate.github.owner}/${candidate.github.repository}/releases/tag/v1.2.3`,
              },
              {
                draft: false,
                tag_name: 'rolling',
                published_at: '2026-07-02T00:00:00Z',
                prerelease: false,
                html_url: `https://github.com/${candidate.github.owner}/${candidate.github.repository}/releases/tag/rolling`,
              },
            ]
          : [],
      );
    case 'npm-package-metadata': {
      const packageName = decodeURIComponent(request.url.pathname.slice(1));
      const unsupported = npmOrdinal === 1;
      return response({
        name: packageName,
        'dist-tags': { latest: '1.2.3' },
        time: { '1.2.3': '2026-07-01T00:00:00Z' },
        versions: {
          '1.2.3': {
            name: packageName,
            version: '1.2.3',
            engines: unsupported ? 'unsupported' : undefined,
            exports: unsupported ? 42 : './index.js',
            type: unsupported ? { unexpected: true } : 'module',
            repository: unsupported
              ? { url: 42 }
              : `https://github.com/${candidate.github.owner}/${candidate.github.repository}.git`,
            peerDependencies: unsupported
              ? { express: 5 }
              : { express: '^5.0.0' },
          },
        },
      });
    }
    case 'github-advisories':
      expect(request.url.searchParams.get('type')).toBe('reviewed');
      expect(request.url.searchParams.get('is_withdrawn')).toBe('false');
      return response(
        firstNpm
          ? [
              {
                ghsa_id: 'GHSA-2345-6789-CFGH',
                severity: 'medium',
                withdrawn_at: null,
              },
              {
                ghsa_id: 'GHSA-6789-CFGH-JMPQ',
                severity: 'unknown',
                withdrawn_at: null,
              },
              {
                ghsa_id: 'GHSA-CFGH-JMPQ-RVWX',
                severity: 'high',
                withdrawn_at: '2026-01-01T00:00:00Z',
              },
            ]
          : [],
      );
    case 'github-compose-json-blob':
      return response({
        sha: COMPOSE_SHA,
        size: Buffer.byteLength(COMPOSE),
        encoding: 'base64',
        content: Buffer.from(COMPOSE).toString('base64'),
      });
    case 'github-dockerfile-blob':
      return response({
        sha: DOCKERFILE_SHA,
        size: Buffer.byteLength(DOCKERFILE),
        encoding: 'base64',
        content: Buffer.from(DOCKERFILE).toString('base64'),
      });
    default:
      throw new Error(`unhandled fixture operation ${request.operation}`);
  }
}

function liveAuthorizationBindings(catalogDigest: string) {
  return {
    catalogVersion: 'public-v1',
    catalogDigest,
    taxonomyVersion: '1.0.0',
    taxonomyDigest:
      '838fa85b2e6937866854b6f733fe7045cf49d5f811cb5e4a8d503bfbd76a61c9',
    acceptedPreLiveHead: '47397ce92ee500c011fe39820053ba22fd6b397b',
    priorOperatorHead: 'a1c141e87c96187c8edb5779709fa5ef04089390',
    priorReplayOperatorHead: '4152fb744086bb13ad581b461044a0e2670df1f4',
    priorLiveAuthorizationVersion:
      'candidate-authority-live-authorization/2.0.0',
    priorLiveAuthorizationDigest:
      '9184ce87d1e74e10d2dcfa91f7b4302292d7f92fa5e1e5bb8378d97339074129',
    priorInvocationDisposition: 'pre-effect-credential-gate-failure',
    adr0012: 'accepted',
    readinessPolicyVersion: 'ranking-v1-deterministic-readiness-policy/3.0.0',
    readinessPolicyDigest:
      'f0095da4e9932cf93ce5cde6fecea1a2480aeb7b055d4b5917420303d8575752',
    fieldPlanVersion: 'candidate-authority-field-plan/4.0.0',
    fieldPlanDigest:
      '84796407204bdb7f08efd053b71afc169312e22af2f104fca23d7e8581cb5997',
    sourcePolicyVersion: 'candidate-authority-source-policy/5.0.0',
    sourcePolicyDigest:
      'f1fb17132e42769385e0c4b8e9bb555dd31cdb1fccec3bc93f9c173f6bab725b',
    replayAlgorithmVersion: 'candidate-authority-pure-replay/2.0.0',
    partialSemanticRegistryVersion:
      'candidate-authority-partial-field-semantics/2.0.0',
    partialSemanticRegistryDigest:
      'baf99884171e6407dcfe173ff6ab80b5d30719d5cd1babd5aa310ef44ef9243e',
    partialEvidenceVersion: 'candidate-authority-partial-field-evidence/3.0.0',
    partialEvidenceDigest:
      '6020d9ec109e73242cf110aad468beca29b3aed79838f419c5e23d0f714b4e8e',
    rootVersion: 'candidate-authority-root/4.0.0',
  };
}
