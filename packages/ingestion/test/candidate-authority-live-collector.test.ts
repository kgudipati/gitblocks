import { readFile } from 'node:fs/promises';
/* eslint-disable @typescript-eslint/require-await -- Async fixture transports implement the production promise boundary without effects. */

import { readFileSync } from 'node:fs';

import { repositoryArtifactGitBlobObjectId } from '@gitblocks/contracts';
import { parseCapabilityTaxonomyV1 } from '@gitblocks/contracts';
import { describe, expect, it } from 'vitest';

import {
  CANDIDATE_AUTHORITY_SUCCESSOR_OPERATION_IDS,
  materializeCandidateAuthoritySuccessorRuntimeSourcePolicyV8,
} from '../src/candidate-authority-provider-contract.ts';
import { collectCandidateAuthoritySourceAuthority } from '../src/candidate-authority-live-collector.ts';
import {
  parseCandidateAuthoritySuccessorSourceAuthority,
  serializeCandidateAuthoritySuccessorSourceAuthority,
} from '../src/candidate-authority-successor-contracts.ts';
import {
  CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_PATH,
  CANDIDATE_AUTHORITY_SOURCE_POLICY_V6_PATH,
} from '../src/candidate-authority-postmortem.ts';
import {
  CANDIDATE_AUTHORITY_FIELD_PLAN_V5_PATH,
  materializeCandidateAuthorityFieldPlanV5,
} from '../src/candidate-authority-postmortem.ts';
import {
  parseCandidateAuthorityPartialSemanticRegistry,
  parseCandidateAuthorityPartialSemanticRegistryV3,
} from '../src/candidate-authority-partial-semantics.ts';
import {
  CANDIDATE_AUTHORITY_FIELD_PLAN_V6_PATH,
  CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V6_DIGEST,
  CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V6_VERSION,
  CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V3_PATH,
  CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V2_PATH,
  CANDIDATE_AUTHORITY_SOURCE_POLICY_V8_PATH,
  CANDIDATE_AUTHORITY_SOURCE_POLICY_V7_PATH,
  materializeCandidateAuthorityFieldPlanV6,
} from '../src/candidate-authority-npm-source-correction.ts';
import {
  parseCandidateAuthorityFieldPlanV4,
  parseCandidateAuthorityReadinessPolicyV3,
} from '../src/candidate-authority-readiness.ts';
import {
  candidateAuthoritySuccessorReplaySemanticDigest,
  generateCandidateAuthoritySuccessorReplay,
} from '../src/candidate-authority-successor-replay.ts';
import { measureCandidateAuthoritySuccessorReadiness } from '../src/candidate-authority-successor-measurement.ts';
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
    const requests: { candidateId: string; operation: string; url: string }[] =
      [];
    const transport = {
      requestJson: async (request: {
        provider: 'github' | 'npm';
        operation: string;
        candidateId: string;
        url: URL;
      }) => {
        requests.push({
          candidateId: request.candidateId,
          operation: request.operation,
          url: request.url.href,
        });
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
        CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V6_VERSION,
      liveAuthorizationDigest: CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V6_DIGEST,
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
    const serialized =
      serializeCandidateAuthoritySuccessorSourceAuthority(authority);
    expect(
      parseCandidateAuthoritySuccessorSourceAuthority({
        text: serialized,
        catalog,
        acceptedExecutionHead: HEAD,
      }),
    ).toEqual(authority);
    const npmRequests = requests.filter(
      ({ operation }) => operation === 'npm-selected-version-metadata',
    );
    expect(npmRequests).toHaveLength(80);
    expect(npmRequests.every(({ url }) => url.endsWith('/latest'))).toBe(true);
    expect(requests.some(({ url }) => url.includes('/-/v1/search'))).toBe(
      false,
    );
    for (const candidate of catalog.candidates.filter(
      ({ npmPackage }) => npmPackage === null,
    )) {
      expect(
        requests.some(
          ({ candidateId, operation }) =>
            candidateId === candidate.candidateId &&
            (operation === 'npm-selected-version-metadata' ||
              operation === 'github-advisories'),
        ),
      ).toBe(false);
    }

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

    const [
      taxonomyText,
      readinessText,
      registryV2Text,
      registryV3Text,
      planV4Text,
      planV5Text,
      planV6Text,
    ] = await Promise.all([
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
        'catalog/public-v1/candidate-authority-partial-field-semantics-v3.json',
        'utf8',
      ),
      readFile(
        'catalog/public-v1/candidate-authority-field-plan-v4.json',
        'utf8',
      ),
      readFile(CANDIDATE_AUTHORITY_FIELD_PLAN_V5_PATH, 'utf8'),
      readFile(CANDIDATE_AUTHORITY_FIELD_PLAN_V6_PATH, 'utf8'),
    ]);
    const taxonomy = parseCapabilityTaxonomyV1(JSON.parse(taxonomyText));
    expect(taxonomy.ok).toBe(true);
    if (!taxonomy.ok) throw new Error('fixture taxonomy invalid');
    const registryV2 = parseCandidateAuthorityPartialSemanticRegistry(
      JSON.parse(registryV2Text),
    );
    const registry = parseCandidateAuthorityPartialSemanticRegistryV3(
      JSON.parse(registryV3Text),
    );
    const readiness = parseCandidateAuthorityReadinessPolicyV3(
      JSON.parse(readinessText),
    );
    const planV4 = parseCandidateAuthorityFieldPlanV4(
      JSON.parse(planV4Text),
      readiness,
      registryV2,
    );
    const fieldPlanV5 = materializeCandidateAuthorityFieldPlanV5({
      predecessor: planV4,
      successorAuthority: JSON.parse(planV5Text),
    });
    const fieldPlan = materializeCandidateAuthorityFieldPlanV6({
      predecessor: fieldPlanV5,
      successorAuthority: JSON.parse(planV6Text),
      partialSemanticRegistry: registry,
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
    const syntheticReadiness = measureCandidateAuthoritySuccessorReadiness({
      catalog,
      sourceAuthority: authority,
      fieldPlan,
      replay: normal,
    });
    const publicationReadiness = syntheticReadiness.report.fields.find(
      ({ fieldId }) => fieldId === 'package-publication-version',
    );
    expect(publicationReadiness).toMatchObject({
      plannedCapable: true,
      realizedReady: true,
      deterministicFullClosure: false,
    });
    expect(
      publicationReadiness?.origins['deterministic-partial-direct-evidence'],
    ).toBe(80);
    expect(publicationReadiness?.origins.unknown).toBe(0);
    expect(publicationReadiness?.origins['deterministic-not-applicable']).toBe(
      70,
    );
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
      firstNpmFields?.find(
        (field) => field.fieldId === 'package-publication-version',
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
    ).toBe('unknown');
    expect(
      normal.partial.records.some(
        (record) =>
          record.candidateId === firstNpmCandidate?.candidateId &&
          record.factCode === 'registry-resolved-package-version' &&
          record.source.kind === 'structured-provider-snapshot' &&
          !('publishedAt' in record.source),
      ),
    ).toBe(true);
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
  }, 15_000);

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
        CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V6_VERSION,
      liveAuthorizationDigest: CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V6_DIGEST,
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
          CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V6_VERSION,
        liveAuthorizationDigest:
          CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V6_DIGEST,
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

  it.each([
    'ingestion.body-too-large',
    'ingestion.provider-not-found',
  ] as const)(
    'fails closed for mapped selected-version %s without aborting or querying advisories',
    async (code) => {
      const { catalog, sourcePolicy } = await authorities();
      const target = catalog.candidates.find(
        ({ npmPackage }) => npmPackage !== null,
      );
      expect(target).toBeDefined();
      const attempts = {
        githubAttempts: 0,
        npmAttempts: 0,
        retries: 0,
        perOperationAttempts: {} as Record<string, number>,
      };
      const advisoryCalls: string[] = [];
      const authority = await collectCandidateAuthoritySourceAuthority({
        catalog,
        sourcePolicy,
        liveAuthorizationVersion:
          CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V6_VERSION,
        liveAuthorizationDigest:
          CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V6_DIGEST,
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
              request.candidateId === target?.candidateId &&
              request.operation === 'npm-selected-version-metadata'
            )
              throw ingestionError(code);
            if (
              request.candidateId === target?.candidateId &&
              request.operation === 'github-advisories'
            )
              advisoryCalls.push(request.candidateId);
            return fakeResponse(
              request,
              catalog.candidates[0]?.candidateId ?? '',
            );
          },
        },
        readAttemptMetrics: () => attempts,
      });
      const targetSource = authority.candidates.find(
        ({ candidateId }) => candidateId === target?.candidateId,
      );
      expect(targetSource?.sources).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            operationId: 'npm-selected-version-metadata',
            outcome: 'qualified-unknown',
            limitationCode: code,
          }),
          expect.objectContaining({
            operationId: 'github-advisories',
            outcome: 'qualified-unknown',
            limitationCode: 'npm-version-scope-unavailable',
          }),
        ]),
      );
      expect(advisoryCalls).toEqual([]);
      expect(
        JSON.stringify(targetSource).includes(
          'registry-resolved-package-version',
        ),
      ).toBe(false);
      expect(
        authority.effectReceipt.controlledOptionalSourceFailures[
          `npm-selected-version-metadata:${code}`
        ],
      ).toBe(1);
      expect(authority.candidateCount).toBe(150);
    },
  );

  it.each([
    ['identity disagreement', 'ingestion.provider-identity'],
    ['unsafe redirect', 'ingestion.redirect'],
  ] as const)(
    'keeps mapped selected-version %s fatal',
    async (_label, code) => {
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
            CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V6_VERSION,
          liveAuthorizationDigest:
            CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V6_DIGEST,
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
              if (request.operation === 'npm-selected-version-metadata') {
                if (code === 'ingestion.redirect') throw ingestionError(code);
                return {
                  value: {
                    name: 'synthetic-identity-mismatch',
                    version: '1.0.0',
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
      ).rejects.toMatchObject({ safeCode: code });
    },
  );

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
          CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V6_VERSION,
        liveAuthorizationDigest:
          CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V6_DIGEST,
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
        CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V6_VERSION,
      liveAuthorizationDigest: CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V6_DIGEST,
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
  const [
    catalogText,
    sourceV6Text,
    providerV1Text,
    sourceV7Text,
    providerV2Text,
    sourceV8Text,
    providerV3Text,
  ] = await Promise.all([
    readFile('catalog/public-v1/manifest.json', 'utf8'),
    readFile(CANDIDATE_AUTHORITY_SOURCE_POLICY_V6_PATH, 'utf8'),
    readFile(CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_PATH, 'utf8'),
    readFile(CANDIDATE_AUTHORITY_SOURCE_POLICY_V7_PATH, 'utf8'),
    readFile(CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V2_PATH, 'utf8'),
    readFile(CANDIDATE_AUTHORITY_SOURCE_POLICY_V8_PATH, 'utf8'),
    readFile(CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V3_PATH, 'utf8'),
  ]);
  const catalog = parsePublicCatalog(catalogText);
  return {
    catalog,
    sourcePolicy: materializeCandidateAuthoritySuccessorRuntimeSourcePolicyV8({
      sourcePolicyV6: JSON.parse(sourceV6Text),
      providerContractV1: JSON.parse(providerV1Text),
      sourcePolicyV7: JSON.parse(sourceV7Text),
      providerContractV2: JSON.parse(providerV2Text),
      sourcePolicyV8: JSON.parse(sourceV8Text),
      providerContractV3: JSON.parse(providerV3Text),
    }),
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
    case 'npm-selected-version-metadata': {
      expect(request.url.pathname.endsWith('/latest')).toBe(true);
      const packageName = decodeURIComponent(
        request.url.pathname.slice(1, -'/latest'.length),
      );
      const unsupported = npmOrdinal === 1;
      return response({
        name: packageName,
        version: '1.2.3',
        _id: `${packageName}@1.2.3`,
        engines: unsupported ? 'unsupported' : undefined,
        exports: unsupported ? 42 : './index.js',
        type: unsupported ? { unexpected: true } : 'module',
        repository: unsupported
          ? { url: 42 }
          : `https://github.com/${candidate.github.owner}/${candidate.github.repository}.git`,
        peerDependencies: unsupported ? { express: 5 } : { express: '^5.0.0' },
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
    consumedV5ExecutionHead: '799f88735885c656de0ad25bc42ca3a90adbe082',
    failureRecordVersion: 'candidate-authority-live-failure-record/2.0.0',
    failureRecordDigest:
      'ebfd078f675c4ce33bba2c9edb7eac1c9cd967bbe6a6a5a35614b77f893dc0a5',
    readinessPolicyVersion: 'ranking-v1-deterministic-readiness-policy/3.0.0',
    readinessPolicyDigest:
      'f0095da4e9932cf93ce5cde6fecea1a2480aeb7b055d4b5917420303d8575752',
    fieldPlanVersion: 'candidate-authority-field-plan/6.0.0',
    fieldPlanDigest:
      '104a8c5ee46aa42dc4fd5ef0b558500809636c38d36f78bcd4f24c284f586409',
    sourcePolicyVersion: 'candidate-authority-source-policy/8.0.0',
    sourcePolicyDigest:
      'd043c6b1842791a2348b6f4eeb8644ac0a366f48aa8f585aab45aefdd97563ca',
    providerContractVersion: 'candidate-authority-provider-contract/3.0.0',
    providerContractDigest:
      '37ac4bf0fa5aa7045737f262b34a21f910ca67f20cadac2dbf915dbb8b7abe57',
    replayAlgorithmVersion: 'candidate-authority-pure-replay/5.0.0',
    replayAlgorithmDigest:
      '71215716755000ea5d0705df5b41e92dee0b8b9178268745a7c536c89128bfc8',
    partialSemanticRegistryVersion:
      'candidate-authority-partial-field-semantics/3.0.0',
    partialSemanticRegistryDigest:
      '8aa2e5a9ede84f871eb057ad10850b01daae9302b3b20450d97fecc115857b7b',
    partialEvidenceVersion: 'candidate-authority-partial-field-evidence/3.0.0',
    partialEvidenceDigest:
      '6020d9ec109e73242cf110aad468beca29b3aed79838f419c5e23d0f714b4e8e',
    architectureDecision: 'ADR-0014-proposed-no-provider-effect',
  };
}
