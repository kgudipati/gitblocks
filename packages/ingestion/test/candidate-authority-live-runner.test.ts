/* eslint-disable @typescript-eslint/require-await -- Inert effect fakes implement asynchronous production ports without real I/O. */

import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import {
  CANDIDATE_AUTHORITY_ACCEPTED_PRELIVE_HEAD,
  CANDIDATE_AUTHORITY_OPERATION_IDS,
  CANDIDATE_AUTHORITY_PRIOR_OPERATOR_HEAD,
  CANDIDATE_AUTHORITY_SOURCE_AUTHORITY_PATH,
  CANDIDATE_AUTHORITY_SOURCE_STAGING_PATH,
  createCandidateAuthoritySourceAuthority,
  createCandidateAuthoritySourceCandidate,
} from '../src/candidate-authority-live-contracts.ts';
import {
  executeCandidateAuthorityLiveCollection,
  preflightCandidateAuthorityLiveCollection,
  type CandidateAuthorityLiveCollectionEffects,
} from '../src/candidate-authority-live-runner.ts';
import { ingestionError } from '../src/errors.ts';

describe('candidate-authority live effect boundary', () => {
  it('preflights with exactly zero credential, provider, or write effects', async () => {
    const counters = { credentials: 0, writes: 0, providers: 0 };
    const effects = fakeEffects(counters);
    const result = await preflightCandidateAuthorityLiveCollection(effects);
    expect(result.effectAudit).toEqual({
      networkCalls: 0,
      candidateProviderCalls: 0,
      credentialReads: 0,
      databaseCalls: 0,
      dockerCalls: 0,
      modelCalls: 0,
      sourceAuthoritiesGenerated: 0,
      allCandidateProjections: 0,
      coverageCalculations: 0,
      filesystemWrites: 0,
      providerCollections: 0,
    });
    expect(counters).toEqual({ credentials: 0, writes: 0, providers: 0 });
  });

  it('reads only the scoped credential after preflight and cleans owned staging on publication failure', async () => {
    const counters = { credentials: 0, writes: 0, providers: 0 };
    const removed: string[] = [];
    const effects = fakeEffects(counters, {
      collect: async () => {
        counters.providers += 1;
        throw ingestionError('ingestion.provider-response');
      },
      removeOwnedStaging: async (path) => {
        removed.push(path);
      },
    });
    await expect(
      executeCandidateAuthorityLiveCollection(effects),
    ).rejects.toMatchObject({ code: 'ingestion.provider-response' });
    expect(counters.credentials).toBe(1);
    expect(counters.providers).toBe(1);
    expect(counters.writes).toBe(0);
    expect(removed).toEqual([]);
  });

  it('removes only owned staging when atomic publication fails after a complete authority is staged', async () => {
    const counters = { credentials: 0, writes: 0, providers: 0 };
    const removed: string[] = [];
    const effects = fakeEffects(counters, {
      collect: async ({
        catalog,
        sourcePolicy,
        authorization,
        executionHead,
        collectionCutoff,
      }) => {
        counters.providers += 1;
        return createCandidateAuthoritySourceAuthority({
          authorityVersion: 'candidate-authority-source-authority/1.0.0',
          operatorVersion: 'candidate-authority-live-operator/2.0.0',
          bindings: {
            ...authorization.bindings,
            catalogVersion: catalog.catalogVersion,
            catalogDigest: catalog.manifestDigest,
            sourcePolicyVersion: sourcePolicy.policyVersion,
            sourcePolicyDigest: sourcePolicy.policySemanticDigest,
            liveAuthorizationVersion: authorization.authorizationVersion,
            liveAuthorizationDigest: authorization.authorizationSemanticDigest,
            collectionExecutionHead: executionHead,
          },
          collectionCutoff,
          candidateCount: 150,
          orderedCandidateIds: catalog.candidates.map(
            (candidate) => candidate.candidateId,
          ),
          candidates: catalog.candidates.map((candidate) =>
            createCandidateAuthoritySourceCandidate({
              candidateId: candidate.candidateId,
              github: candidate.github,
              npmPackage: candidate.npmPackage,
              sources: CANDIDATE_AUTHORITY_OPERATION_IDS.map((operationId) => ({
                operationId,
                outcome: 'qualified-unknown' as const,
                completeness: 'partial' as const,
                limitationCode: 'inert-fixture-no-source',
                value: null,
              })),
            }),
          ),
          effectReceipt: {
            collectionExecutions: 1,
            githubLogicalRequests: 0,
            npmLogicalRequests: 0,
            totalLogicalRequests: 0,
            githubAttempts: 0,
            npmAttempts: 0,
            totalAttempts: 0,
            retries: 0,
            perOperation: CANDIDATE_AUTHORITY_OPERATION_IDS.map(
              (operationId) => ({
                operationId,
                logicalRequests: 0,
                attempts: 0,
                establishedAbsences: 0,
                qualifiedUnknowns: 0,
              }),
            ),
            controlledOptionalSourceFailures: {},
            credentialAvailable: true,
            databaseCalls: 0,
            dockerCalls: 0,
            modelCalls: 0,
            candidateExecutions: 0,
            allCandidateProjections: 0,
            coverageCalculations: 0,
          },
        });
      },
      publishStagedExclusive: async () => {
        counters.writes += 1;
        throw ingestionError('ingestion.internal-invariant');
      },
      removeOwnedStaging: async (path) => {
        removed.push(path);
      },
    });
    await expect(
      executeCandidateAuthorityLiveCollection(effects),
    ).rejects.toMatchObject({ code: 'ingestion.internal-invariant' });
    expect(counters).toEqual({ credentials: 1, writes: 2, providers: 1 });
    expect(removed).toEqual([CANDIDATE_AUTHORITY_SOURCE_STAGING_PATH]);
  });

  it('rejects a dirty or non-direct execution head before credential access', async () => {
    const counters = { credentials: 0, writes: 0, providers: 0 };
    const effects = fakeEffects(counters, {
      readGitState: async () => ({
        branch: 'feat/32-codebase-conditioned-ranking',
        head: 'f'.repeat(40),
        originHead: 'f'.repeat(40),
        parentHead: 'e'.repeat(40),
        priorOperatorParentHead: 'd'.repeat(40),
        correctionCommitCount: 2,
        clean: false,
      }),
    });
    await expect(
      preflightCandidateAuthorityLiveCollection(effects),
    ).rejects.toMatchObject({ code: 'ingestion.invalid-input' });
    expect(counters.credentials).toBe(0);
  });
});

function fakeEffects(
  counters: { credentials: number; writes: number; providers: number },
  overrides: Partial<CandidateAuthorityLiveCollectionEffects> = {},
): CandidateAuthorityLiveCollectionEffects {
  const head = 'f'.repeat(40);
  return {
    readFixedFile: async (path) => readFile(path, 'utf8'),
    requirePathMissing: async () => undefined,
    readGitState: async () => ({
      branch: 'feat/32-codebase-conditioned-ranking',
      head,
      originHead: head,
      parentHead: CANDIDATE_AUTHORITY_PRIOR_OPERATOR_HEAD,
      priorOperatorParentHead: CANDIDATE_AUTHORITY_ACCEPTED_PRELIVE_HEAD,
      correctionCommitCount: 1,
      clean: true,
    }),
    readCredential: (name) => {
      counters.credentials += 1;
      expect(name).toBe('GITBLOCKS_CANDIDATE_AUTHORITY_GITHUB_TOKEN');
      return 'inert-fixture-token';
    },
    now: () => new Date('2026-08-10T12:34:56.000Z'),
    collect: async () => {
      counters.providers += 1;
      throw ingestionError('ingestion.internal-invariant');
    },
    stageExclusive: async (path) => {
      counters.writes += 1;
      expect(path).toBe(CANDIDATE_AUTHORITY_SOURCE_STAGING_PATH);
    },
    publishStagedExclusive: async (staging, final) => {
      counters.writes += 1;
      expect(staging).toBe(CANDIDATE_AUTHORITY_SOURCE_STAGING_PATH);
      expect(final).toBe(CANDIDATE_AUTHORITY_SOURCE_AUTHORITY_PATH);
    },
    removeOwnedStaging: async () => undefined,
    ...overrides,
  };
}
