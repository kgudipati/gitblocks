import { readFile } from 'node:fs/promises';
/* eslint-disable @typescript-eslint/require-await -- Async fixture transports implement the production promise boundary without effects. */

import { readFileSync } from 'node:fs';

import { repositoryArtifactGitBlobObjectId } from '@gitblocks/contracts';
import { describe, expect, it } from 'vitest';

import {
  CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_DIGEST,
  CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_VERSION,
  CANDIDATE_AUTHORITY_OPERATION_IDS,
  parseCandidateAuthoritySourceAuthority,
  serializeCandidateAuthoritySourceAuthority,
} from '../src/candidate-authority-live-contracts.ts';
import { collectCandidateAuthoritySourceAuthority } from '../src/candidate-authority-live-collector.ts';
import {
  CANDIDATE_AUTHORITY_FIELD_PLAN_V4_PATH,
  CANDIDATE_AUTHORITY_PARTIAL_SEMANTIC_REGISTRY_PATH,
  CANDIDATE_AUTHORITY_READINESS_POLICY_V3_PATH,
  CANDIDATE_AUTHORITY_SOURCE_POLICY_V5_PATH,
  parseCandidateAuthorityFieldPlanV4,
  parseCandidateAuthorityPartialSemanticRegistry,
  parseCandidateAuthorityReadinessPolicyV3,
  parseCandidateAuthoritySourcePolicyV5,
} from '../src/index.ts';
import { ingestionError } from '../src/errors.ts';
import { parsePublicCatalog } from '../src/manifest.ts';

const CUTOFF = '2026-08-10T12:34:56.000Z';
const HEAD = '1111111111111111111111111111111111111111';
const TREE = '2222222222222222222222222222222222222222';
const LICENSE_BLOB_SHA = '3333333333333333333333333333333333333333';
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
      liveAuthorizationVersion: CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_VERSION,
      liveAuthorizationDigest: CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_DIGEST,
      liveAuthorizationBindings: liveAuthorizationBindings(
        catalog.manifestDigest,
      ),
      executionHead: HEAD,
      githubToken: 'inert-fixture-token',
      collectionCutoff: CUTOFF,
      transport,
      readAttemptMetrics: () => attempts,
    });
    const text = serializeCandidateAuthoritySourceAuthority(authority);
    expect(parseCandidateAuthoritySourceAuthority(JSON.parse(text))).toEqual(
      authority,
    );
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
    ).toEqual(CANDIDATE_AUTHORITY_OPERATION_IDS);
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
        if (request.operation === 'github-community-profile')
          throw ingestionError('ingestion.provider-unavailable');
        return fakeResponse(request, catalog.candidates[0]?.candidateId ?? '');
      },
    };
    const authority = await collectCandidateAuthoritySourceAuthority({
      catalog,
      sourcePolicy,
      liveAuthorizationVersion: CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_VERSION,
      liveAuthorizationDigest: CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_DIGEST,
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
        'github-community-profile:ingestion.provider-unavailable'
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
          CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_VERSION,
        liveAuthorizationDigest: CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_DIGEST,
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
    ).rejects.toMatchObject({ code: 'ingestion.provider-identity' });
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
          CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_VERSION,
        liveAuthorizationDigest: CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_DIGEST,
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
    ).rejects.toMatchObject({ code: 'ingestion.provider-response' });
  });
});

async function authorities() {
  const [catalogText, readinessText, registryText, planText, sourceText] =
    await Promise.all([
      readFile('catalog/public-v1/manifest.json', 'utf8'),
      readFile(CANDIDATE_AUTHORITY_READINESS_POLICY_V3_PATH, 'utf8'),
      readFile(CANDIDATE_AUTHORITY_PARTIAL_SEMANTIC_REGISTRY_PATH, 'utf8'),
      readFile(CANDIDATE_AUTHORITY_FIELD_PLAN_V4_PATH, 'utf8'),
      readFile(CANDIDATE_AUTHORITY_SOURCE_POLICY_V5_PATH, 'utf8'),
    ]);
  const catalog = parsePublicCatalog(catalogText);
  const registry = parseCandidateAuthorityPartialSemanticRegistry(
    JSON.parse(registryText),
  );
  const readiness = parseCandidateAuthorityReadinessPolicyV3(
    JSON.parse(readinessText),
  );
  const plan = parseCandidateAuthorityFieldPlanV4(
    JSON.parse(planText),
    readiness,
    registry,
  );
  return {
    catalog,
    sourcePolicy: parseCandidateAuthoritySourcePolicyV5(
      JSON.parse(sourceText),
      plan,
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
        tree: first
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
          : [],
      });
    case 'github-maintenance-window':
      return response([]);
    case 'github-license':
      return response({
        path: 'LICENSE.md',
        sha: LICENSE_BLOB_SHA,
        license: { spdx_id: 'MIT' },
      });
    case 'github-community-profile':
      return response({ files: { security_policy: {} } });
    case 'github-release-window':
      return response([]);
    case 'npm-package-metadata': {
      const packageName = decodeURIComponent(request.url.pathname.slice(1));
      return response({
        name: packageName,
        'dist-tags': { latest: '1.2.3' },
        time: { '1.2.3': '2026-07-01T00:00:00Z' },
        versions: {
          '1.2.3': {
            name: packageName,
            version: '1.2.3',
            exports: './index.js',
            type: 'module',
            repository: `https://github.com/${candidate.github.owner}/${candidate.github.repository}.git`,
            peerDependencies: { express: '^5.0.0' },
          },
        },
      });
    }
    case 'github-advisories':
      return response([]);
    case 'github-compose-json-content':
      if (!first) throw ingestionError('ingestion.provider-not-found');
      return response({
        path: 'compose.json',
        sha: COMPOSE_SHA,
        size: Buffer.byteLength(COMPOSE),
        encoding: 'base64',
        content: Buffer.from(COMPOSE).toString('base64'),
      });
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
