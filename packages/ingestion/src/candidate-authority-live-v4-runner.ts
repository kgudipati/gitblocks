/* eslint-disable @typescript-eslint/no-unnecessary-condition -- Injected preflight values are revalidated at the effect boundary. */

import { canonicalizeJson } from './canonical-json.ts';
import { collectCandidateAuthoritySourceAuthority } from './candidate-authority-live-collector.ts';
import {
  CANDIDATE_AUTHORITY_LIVE_OPERATOR_V4_VERSION,
  CandidateAuthorityFirstFatalError,
  createCandidateAuthorityFatalDiagnostic,
  serializeCandidateAuthorityFatalDiagnostic,
  type CandidateAuthorityFatalDiagnosticEnvelope,
  type CandidateAuthoritySuccessorRuntimeSourcePolicy,
  type CandidateAuthoritySuccessorSourceAuthority,
} from './candidate-authority-provider-contract.ts';
import {
  CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V4_DIGEST,
  CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V4_VERSION,
} from './candidate-authority-postmortem.ts';
import { asSafeErrorCode, ingestionError } from './errors.ts';
import type { PublicCatalog } from './types.ts';

export const CANDIDATE_AUTHORITY_SUCCESSOR_SOURCE_PATH =
  'catalog/public-v1/candidate-authority-source-authority-v2.json' as const;
export const CANDIDATE_AUTHORITY_SUCCESSOR_STAGING_PATH =
  'catalog/public-v1/candidate-authority-source-authority-v2.staging.json' as const;
export const CANDIDATE_AUTHORITY_SUCCESSOR_TOKEN_ENVIRONMENT =
  'GITBLOCKS_CANDIDATE_AUTHORITY_GITHUB_TOKEN' as const;

export interface CandidateAuthorityLiveV4Preflight {
  readonly status: 'passed';
  readonly exactCorrectionHeadIndependentlyAccepted: true;
  readonly head: string;
  readonly originHead: string;
  readonly parentHead: '2cfe0682617fb303ebbb2deb7dd7bd34a383c912';
  readonly clean: true;
  readonly outputAndStagingPathsAbsent: true;
  readonly catalog: PublicCatalog;
  readonly sourcePolicy: CandidateAuthoritySuccessorRuntimeSourcePolicy;
  readonly authorization: {
    readonly version: typeof CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V4_VERSION;
    readonly digest: typeof CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V4_DIGEST;
    readonly bindings: Readonly<Record<string, string>>;
    readonly successorProviderEffectCollections: 1;
    readonly automaticRerun: false;
  };
  readonly effectAudit: {
    readonly networkCalls: 0;
    readonly candidateProviderCalls: 0;
    readonly credentialReads: 0;
    readonly databaseCalls: 0;
    readonly dockerCalls: 0;
    readonly modelCalls: 0;
    readonly filesystemWrites: 0;
    readonly providerCollections: 0;
    readonly sourceAuthoritiesGenerated: 0;
    readonly allCandidateProjections: 0;
    readonly coverageCalculations: 0;
  };
}

export interface CandidateAuthorityLiveV4Effects {
  readonly preflight: () => Promise<CandidateAuthorityLiveV4Preflight>;
  readonly readCredential: (
    name: typeof CANDIDATE_AUTHORITY_SUCCESSOR_TOKEN_ENVIRONMENT,
  ) => string;
  readonly now: () => Date;
  readonly collect?: typeof collectCandidateAuthoritySourceAuthority;
  readonly stageExclusive: (
    path: typeof CANDIDATE_AUTHORITY_SUCCESSOR_STAGING_PATH,
    text: string,
  ) => Promise<void>;
  readonly publishStagedExclusive: (
    staging: typeof CANDIDATE_AUTHORITY_SUCCESSOR_STAGING_PATH,
    final: typeof CANDIDATE_AUTHORITY_SUCCESSOR_SOURCE_PATH,
  ) => Promise<void>;
  readonly removeOwnedStaging: (
    path: typeof CANDIDATE_AUTHORITY_SUCCESSOR_STAGING_PATH,
  ) => Promise<void>;
}

export class CandidateAuthorityLiveV4ExecutionFailure extends Error {
  public readonly diagnostic: CandidateAuthorityFatalDiagnosticEnvelope;

  public constructor(diagnostic: CandidateAuthorityFatalDiagnosticEnvelope) {
    super('Candidate authority successor collection failed.');
    this.name = 'CandidateAuthorityLiveV4ExecutionFailure';
    this.diagnostic = diagnostic;
    Object.defineProperty(this, 'stack', { value: undefined });
  }
}

export async function executeCandidateAuthorityLiveV4(
  effects: CandidateAuthorityLiveV4Effects,
  signal?: AbortSignal,
): Promise<CandidateAuthoritySuccessorSourceAuthority> {
  let stagingExisted = false;
  let stagingCleaned = false;
  let preflight: CandidateAuthorityLiveV4Preflight | undefined;
  let cutoff: string | undefined;
  try {
    preflight = await effects.preflight();
    preflightCandidateAuthorityLiveV4(preflight);
    const credential = effects.readCredential(
      CANDIDATE_AUTHORITY_SUCCESSOR_TOKEN_ENVIRONMENT,
    );
    cutoff = effects.now().toISOString();
    requireTimestamp(cutoff);
    const collect = effects.collect ?? collectCandidateAuthoritySourceAuthority;
    const authority = await collect({
      catalog: preflight.catalog,
      sourcePolicy: preflight.sourcePolicy,
      liveAuthorizationVersion: preflight.authorization.version,
      liveAuthorizationDigest: preflight.authorization.digest,
      liveAuthorizationBindings: preflight.authorization.bindings,
      executionHead: preflight.head,
      githubToken: credential,
      collectionCutoff: cutoff,
      // A production effect adapter injects the bounded transport. Tests and
      // the later activation adapter may inject the entire collector instead.
      transport: {
        requestJson: () =>
          Promise.reject(ingestionError('ingestion.internal-invariant')),
      },
      readAttemptMetrics: () => ({
        githubAttempts: 0,
        npmAttempts: 0,
        retries: 0,
        perOperationAttempts: {},
      }),
      ...(signal === undefined ? {} : { signal }),
    });
    const text = `${canonicalizeJson(authority).text}\n`;
    if (Buffer.byteLength(text, 'utf8') > 268_435_456)
      throw ingestionError('ingestion.invalid-input');
    await effects.stageExclusive(
      CANDIDATE_AUTHORITY_SUCCESSOR_STAGING_PATH,
      text,
    );
    stagingExisted = true;
    await effects.publishStagedExclusive(
      CANDIDATE_AUTHORITY_SUCCESSOR_STAGING_PATH,
      CANDIDATE_AUTHORITY_SUCCESSOR_SOURCE_PATH,
    );
    stagingExisted = false;
    return authority;
  } catch (error) {
    if (stagingExisted) {
      await effects.removeOwnedStaging(
        CANDIDATE_AUTHORITY_SUCCESSOR_STAGING_PATH,
      );
      stagingCleaned = true;
    }
    if (
      preflight !== undefined &&
      cutoff !== undefined &&
      error instanceof CandidateAuthorityFirstFatalError
    ) {
      throw new CandidateAuthorityLiveV4ExecutionFailure(
        createCandidateAuthorityFatalDiagnostic({
          authorizationVersion: preflight.authorization.version,
          authorizationDigest: preflight.authorization.digest,
          executionHead: preflight.head,
          collectionCutoff: cutoff,
          fatal: error,
          ownedStagingExisted: stagingExisted,
          ownedStagingCleaned: stagingCleaned,
        }),
      );
    }
    throw error;
  }
}

export function renderCandidateAuthorityLiveV4Failure(error: unknown): string {
  if (error instanceof CandidateAuthorityLiveV4ExecutionFailure) {
    return serializeCandidateAuthorityFatalDiagnostic(error.diagnostic);
  }
  return `${JSON.stringify({
    status: 'failed',
    operatorVersion: CANDIDATE_AUTHORITY_LIVE_OPERATOR_V4_VERSION,
    failureStage: 'candidate-authority-live-v4-pre-effect',
    safeErrorCode: asSafeErrorCode(error),
  })}\n`;
}

export function preflightCandidateAuthorityLiveV4(
  value: CandidateAuthorityLiveV4Preflight,
): CandidateAuthorityLiveV4Preflight {
  const mappedNpmCount = value.catalog.candidates.filter(
    (candidate) => candidate.npmPackage !== null,
  ).length;
  if (
    value.status !== 'passed' ||
    !value.exactCorrectionHeadIndependentlyAccepted ||
    value.head !== value.originHead ||
    !/^[a-f0-9]{40}$/u.test(value.head) ||
    value.parentHead !== '2cfe0682617fb303ebbb2deb7dd7bd34a383c912' ||
    !value.clean ||
    !value.outputAndStagingPathsAbsent ||
    value.catalog.candidates.length !== 150 ||
    mappedNpmCount !== 80 ||
    value.sourcePolicy.policyVersion !==
      'candidate-authority-source-policy/6.0.0' ||
    value.sourcePolicy.policySemanticDigest !==
      'c972e3c3ea25a8d0e456e759b2898ca2837bcd82e701cfc1f3a0caaba1753510' ||
    value.sourcePolicy.requestBudget.githubLogicalRequests !== 1810 ||
    value.sourcePolicy.requestBudget.npmLogicalRequests !== 80 ||
    value.sourcePolicy.requestBudget.totalLogicalRequests !== 1890 ||
    value.sourcePolicy.requestBudget.githubWorstCaseAttempts !== 5430 ||
    value.sourcePolicy.requestBudget.npmWorstCaseAttempts !== 240 ||
    value.sourcePolicy.requestBudget.totalWorstCaseAttempts !== 5670 ||
    value.authorization.version !==
      CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V4_VERSION ||
    value.authorization.digest !==
      CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V4_DIGEST ||
    value.authorization.successorProviderEffectCollections !== 1 ||
    value.authorization.automaticRerun ||
    Object.values(value.effectAudit).some((count) => count !== 0)
  )
    throw ingestionError('ingestion.invalid-input');
  return value;
}

function requireTimestamp(value: string): void {
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value) ||
    !Number.isFinite(Date.parse(value))
  )
    throw ingestionError('ingestion.invalid-input');
}
