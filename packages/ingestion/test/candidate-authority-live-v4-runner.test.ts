/* eslint-disable @typescript-eslint/require-await -- Inert fixtures implement asynchronous effect interfaces without real effects. */

import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import {
  CANDIDATE_AUTHORITY_SUCCESSOR_STAGING_PATH,
  executeCandidateAuthorityLiveV4,
  renderCandidateAuthorityLiveV4Failure,
  type CandidateAuthorityLiveV4Effects,
  type CandidateAuthorityLiveV4Preflight,
} from '../src/candidate-authority-live-v4-runner.ts';
import {
  CandidateAuthorityFirstFatalError,
  materializeCandidateAuthoritySuccessorRuntimeSourcePolicy,
} from '../src/candidate-authority-provider-contract.ts';
import {
  CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V4_DIGEST,
  CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V4_VERSION,
  CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_PATH,
  CANDIDATE_AUTHORITY_SOURCE_POLICY_V6_PATH,
} from '../src/candidate-authority-postmortem.ts';
import { ingestionError } from '../src/errors.ts';
import { parsePublicCatalog } from '../src/manifest.ts';

describe('candidate authority live operator v4 boundary', () => {
  it('emits final safe fatal metrics only after the collector has settled and produces no source or staging', async () => {
    const preflight = await fakePreflight();
    const effectsCount = {
      credentials: 0,
      stages: 0,
      publications: 0,
      cleanups: 0,
    };
    const effects: CandidateAuthorityLiveV4Effects = {
      preflight: async () => preflight,
      readCredential: () => {
        effectsCount.credentials += 1;
        return 'inert-fixture-token';
      },
      now: () => new Date('2026-08-11T12:00:00.000Z'),
      collect: async () => {
        throw new CandidateAuthorityFirstFatalError({
          context: {
            candidateId: 'candidate-safe-id',
            operationId: 'github-advisories',
          },
          cause: ingestionError('ingestion.provider-response'),
          counters: {
            githubLogicalRequests: 11,
            npmLogicalRequests: 2,
            githubAttempts: 13,
            npmAttempts: 2,
            retries: 2,
            perOperation: {
              'github-advisories': { logicalRequests: 11, attempts: 13 },
              'npm-package-metadata': { logicalRequests: 2, attempts: 2 },
            },
          },
        });
      },
      stageExclusive: async () => {
        effectsCount.stages += 1;
      },
      publishStagedExclusive: async () => {
        effectsCount.publications += 1;
      },
      removeOwnedStaging: async (path) => {
        expect(path).toBe(CANDIDATE_AUTHORITY_SUCCESSOR_STAGING_PATH);
        effectsCount.cleanups += 1;
      },
    };
    let failure: unknown;
    try {
      await executeCandidateAuthorityLiveV4(effects);
    } catch (error) {
      failure = error;
    }
    const rendered = renderCandidateAuthorityLiveV4Failure(failure);
    expect(JSON.parse(rendered)).toMatchObject({
      collectionCutoff: '2026-08-11T12:00:00.000Z',
      firstFatalCandidateId: 'candidate-safe-id',
      firstFatalOperationId: 'github-advisories',
      safeErrorCode: 'ingestion.provider-response',
      totalLogicalRequests: 13,
      totalAttempts: 15,
      retries: 2,
      ownedStagingExisted: false,
      ownedStagingCleaned: false,
      sourceAuthorityPublished: false,
    });
    expect(effectsCount).toEqual({
      credentials: 1,
      stages: 0,
      publications: 0,
      cleanups: 0,
    });
    expect(rendered).not.toContain('inert-fixture-token');
  });

  it('rejects an unaccepted exact head before credential access or cutoff creation', async () => {
    const preflight = await fakePreflight();
    let credentials = 0;
    let clockReads = 0;
    await expect(
      executeCandidateAuthorityLiveV4({
        preflight: async () => ({
          ...preflight,
          head: '0'.repeat(40),
          originHead: '1'.repeat(40),
        }),
        readCredential: () => {
          credentials += 1;
          return 'inert-fixture-token';
        },
        now: () => {
          clockReads += 1;
          return new Date('2026-08-11T12:00:00.000Z');
        },
        collect: async () => {
          throw new Error('must not run');
        },
        stageExclusive: async () => undefined,
        publishStagedExclusive: async () => undefined,
        removeOwnedStaging: async () => undefined,
      }),
    ).rejects.toMatchObject({ code: 'ingestion.invalid-input' });
    expect({ credentials, clockReads }).toEqual({
      credentials: 0,
      clockReads: 0,
    });
  });
});

async function fakePreflight(): Promise<CandidateAuthorityLiveV4Preflight> {
  const [catalogText, sourceText, providerText] = await Promise.all([
    readFile('catalog/public-v1/manifest.json', 'utf8'),
    readFile(CANDIDATE_AUTHORITY_SOURCE_POLICY_V6_PATH, 'utf8'),
    readFile(CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_PATH, 'utf8'),
  ]);
  const head = 'a'.repeat(40);
  return {
    status: 'passed',
    exactCorrectionHeadIndependentlyAccepted: true,
    head,
    originHead: head,
    parentHead: '2cfe0682617fb303ebbb2deb7dd7bd34a383c912',
    clean: true,
    outputAndStagingPathsAbsent: true,
    catalog: parsePublicCatalog(catalogText),
    sourcePolicy: materializeCandidateAuthoritySuccessorRuntimeSourcePolicy(
      JSON.parse(sourceText),
      JSON.parse(providerText),
    ),
    authorization: {
      version: CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V4_VERSION,
      digest: CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V4_DIGEST,
      bindings: {},
      successorProviderEffectCollections: 1,
      automaticRerun: false,
    },
    effectAudit: {
      networkCalls: 0,
      candidateProviderCalls: 0,
      credentialReads: 0,
      databaseCalls: 0,
      dockerCalls: 0,
      modelCalls: 0,
      filesystemWrites: 0,
      providerCollections: 0,
      sourceAuthoritiesGenerated: 0,
      allCandidateProjections: 0,
      coverageCalculations: 0,
    },
  };
}
