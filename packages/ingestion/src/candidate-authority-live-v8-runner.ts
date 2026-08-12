/* eslint-disable @typescript-eslint/no-unnecessary-condition -- Injected boundaries are revalidated before effects. */

import { canonicalizeJson } from './canonical-json.ts';
import type { CandidateAuthorityProviderRoutes } from './candidate-authority-canonical-routing-correction.ts';
import {
  CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V8_DIGEST,
  CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V8_VERSION,
  CANDIDATE_AUTHORITY_SOURCE_POLICY_V10_DIGEST,
  CANDIDATE_AUTHORITY_SOURCE_POLICY_V10_VERSION,
} from './candidate-authority-linkage-evidence-correction.ts';
import type {
  CandidateAuthorityAttemptMetrics,
  collectCandidateAuthoritySourceAuthority,
} from './candidate-authority-live-collector.ts';
import type {
  CandidateAuthoritySuccessorEffects,
  CandidateAuthoritySuccessorFailureStage,
  CandidateAuthoritySuccessorPreflightResult,
} from './candidate-authority-live-v6-runner.ts';
import {
  CANDIDATE_AUTHORITY_LIVE_OPERATOR_V8_VERSION,
  CandidateAuthorityFirstFatalError,
  type CandidateAuthoritySuccessorSourceAuthority,
} from './candidate-authority-provider-contract.ts';
import {
  CANDIDATE_AUTHORITY_ACCEPTED_CORRECTION_PARENT,
  CANDIDATE_AUTHORITY_SUCCESSOR_MAXIMUM_SOURCE_BYTES,
  CANDIDATE_AUTHORITY_SUCCESSOR_SOURCE_PATH,
  CANDIDATE_AUTHORITY_SUCCESSOR_SOURCE_STAGING_PATH,
  CANDIDATE_AUTHORITY_SUCCESSOR_TOKEN_ENVIRONMENT,
  parseCandidateAuthoritySuccessorSourceAuthority,
  serializeCandidateAuthoritySuccessorSourceAuthority,
} from './candidate-authority-successor-contracts.ts';
import {
  asSafeErrorCode,
  type IngestionErrorCode,
  ingestionError,
} from './errors.ts';

export interface CandidateAuthoritySuccessorPreflightResultV8 extends CandidateAuthoritySuccessorPreflightResult {
  readonly providerRoutes: CandidateAuthorityProviderRoutes;
}

export interface CandidateAuthoritySuccessorEffectsV8 extends Omit<
  CandidateAuthoritySuccessorEffects,
  'collect' | 'preflight'
> {
  readonly preflight: (
    acceptedHead: string,
  ) => Promise<CandidateAuthoritySuccessorPreflightResultV8>;
  readonly collect: (
    input: Omit<
      Parameters<typeof collectCandidateAuthoritySourceAuthority>[0],
      'readAttemptMetrics' | 'transport'
    >,
  ) => Promise<CandidateAuthoritySuccessorSourceAuthority>;
}

export interface CandidateAuthoritySuccessorFailureDiagnosticV8 {
  readonly status: 'failed';
  readonly operatorVersion: typeof CANDIDATE_AUTHORITY_LIVE_OPERATOR_V8_VERSION;
  readonly authorizationVersion: typeof CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V8_VERSION;
  readonly authorizationDigest: typeof CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V8_DIGEST;
  readonly executionHead: string;
  readonly collectionCutoff: string;
  readonly firstFatalCandidateId: string | null;
  readonly firstFatalOperationId: string | null;
  readonly safeErrorCode: IngestionErrorCode;
  readonly failureStage: CandidateAuthoritySuccessorFailureStage;
  readonly githubLogicalRequests: number;
  readonly npmLogicalRequests: number;
  readonly totalLogicalRequests: number;
  readonly githubAttempts: number;
  readonly npmAttempts: number;
  readonly totalAttempts: number;
  readonly retries: number;
  readonly perOperation: Readonly<
    Record<
      string,
      { readonly logicalRequests: number; readonly attempts: number }
    >
  >;
  readonly ownedStagingExisted: boolean;
  readonly ownedStagingCleaned: boolean;
  readonly sourceAuthorityPublished: false;
}

export class CandidateAuthoritySuccessorExecutionFailureV8 extends Error {
  public readonly diagnostic: CandidateAuthoritySuccessorFailureDiagnosticV8;
  public constructor(
    diagnostic: CandidateAuthoritySuccessorFailureDiagnosticV8,
  ) {
    super('Candidate authority canonical-routing successor execution failed.');
    this.name = 'CandidateAuthoritySuccessorExecutionFailureV8';
    this.diagnostic = diagnostic;
    Object.defineProperty(this, 'stack', { value: undefined });
  }
}

export async function preflightCandidateAuthoritySuccessorV8(
  effects: Pick<CandidateAuthoritySuccessorEffectsV8, 'preflight'>,
  acceptedHead: string,
): Promise<CandidateAuthoritySuccessorPreflightResultV8> {
  requireSha(acceptedHead);
  const value = await effects.preflight(acceptedHead);
  if (
    value.status !== 'passed' ||
    value.acceptedHead !== acceptedHead ||
    value.head !== acceptedHead ||
    value.originHead !== acceptedHead ||
    value.branch !== 'feat/32-codebase-conditioned-ranking' ||
    value.parentHead !== CANDIDATE_AUTHORITY_ACCEPTED_CORRECTION_PARENT ||
    value.activationCommitCount !== 1 ||
    !value.clean ||
    !value.outputAndStagingPathsAbsent ||
    value.catalog.candidates.length !== 150 ||
    value.catalog.candidates.filter(
      (candidate) => candidate.npmPackage !== null,
    ).length !== 80 ||
    value.providerRoutes.routes.length !== 150 ||
    value.providerRoutes.unchangedCount +
      value.providerRoutes.redirectedCount !==
      150 ||
    value.sourcePolicy.policyVersion !==
      CANDIDATE_AUTHORITY_SOURCE_POLICY_V10_VERSION ||
    value.sourcePolicy.policySemanticDigest !==
      CANDIDATE_AUTHORITY_SOURCE_POLICY_V10_DIGEST ||
    value.authorization.version !==
      CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V8_VERSION ||
    value.authorization.digest !==
      CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V8_DIGEST ||
    value.authorization.conditionalCollections !== 1 ||
    value.authorization.activeCollections !== 0 ||
    value.authorization.automaticRerun ||
    Object.values(value.effectAudit).some((count) => count !== 0)
  )
    throw ingestionError('ingestion.invalid-input');
  return value;
}

export async function executeCandidateAuthoritySuccessorV8(
  effects: CandidateAuthoritySuccessorEffectsV8,
  acceptedHead: string,
  signal?: AbortSignal,
): Promise<CandidateAuthoritySuccessorSourceAuthority> {
  const preflight = await preflightCandidateAuthoritySuccessorV8(
    effects,
    acceptedHead,
  );
  const credential = effects.readCredential(
    CANDIDATE_AUTHORITY_SUCCESSOR_TOKEN_ENVIRONMENT,
  );
  const cutoff = effects.now().toISOString();
  requireTimestamp(cutoff);
  let authority: CandidateAuthoritySuccessorSourceAuthority | undefined;
  let stage: CandidateAuthoritySuccessorFailureStage =
    'candidate-authority-successor-collect';
  let stagingExisted = false;
  let stagingCleaned = false;
  let causal: unknown;
  try {
    authority = await effects.collect({
      catalog: preflight.catalog,
      sourcePolicy: preflight.sourcePolicy,
      providerRoutes: preflight.providerRoutes.byCandidateId,
      liveAuthorizationVersion: preflight.authorization.version,
      liveAuthorizationDigest: preflight.authorization.digest,
      liveAuthorizationBindings: preflight.authorization.bindings,
      executionHead: preflight.head,
      githubToken: credential,
      collectionCutoff: cutoff,
      operatorVersion: CANDIDATE_AUTHORITY_LIVE_OPERATOR_V8_VERSION,
      ...(signal === undefined ? {} : { signal }),
    });
    stage = 'candidate-authority-successor-source-serialization-validation';
    const text = serializeCandidateAuthoritySuccessorSourceAuthority(authority);
    if (
      Buffer.byteLength(text, 'utf8') >
      CANDIDATE_AUTHORITY_SUCCESSOR_MAXIMUM_SOURCE_BYTES
    )
      throw ingestionError('ingestion.invalid-input');
    parseCandidateAuthoritySuccessorSourceAuthority({
      text,
      catalog: preflight.catalog,
      providerRoutes: preflight.providerRoutes,
      acceptedExecutionHead: preflight.head,
    });
    stage = 'candidate-authority-successor-staging';
    await effects.stageExclusive(
      CANDIDATE_AUTHORITY_SUCCESSOR_SOURCE_STAGING_PATH,
      text,
    );
    stagingExisted = true;
    stage = 'candidate-authority-successor-publication';
    await effects.publishStagedExclusive(
      CANDIDATE_AUTHORITY_SUCCESSOR_SOURCE_STAGING_PATH,
      CANDIDATE_AUTHORITY_SUCCESSOR_SOURCE_PATH,
    );
    stagingExisted = false;
    return authority;
  } catch (error) {
    causal = error;
    if (stagingExisted || stage === 'candidate-authority-successor-staging') {
      try {
        await effects.removeOwnedStaging(
          CANDIDATE_AUTHORITY_SUCCESSOR_SOURCE_STAGING_PATH,
        );
        stagingCleaned = true;
      } catch (cleanupError) {
        stage = 'candidate-authority-successor-staging-cleanup';
        causal = cleanupError;
      }
    }
    throw new CandidateAuthoritySuccessorExecutionFailureV8(
      failureDiagnostic({
        preflight,
        cutoff,
        stage,
        causal,
        ...(authority === undefined ? {} : { authority }),
        attempts: effects.readAttemptMetrics(),
        stagingExisted,
        stagingCleaned,
      }),
    );
  }
}

export function renderCandidateAuthoritySuccessorFailureV8(
  error: unknown,
): string {
  if (error instanceof CandidateAuthoritySuccessorExecutionFailureV8)
    return `${canonicalizeJson(error.diagnostic).text}\n`;
  return `${JSON.stringify({
    status: 'failed',
    operatorVersion: CANDIDATE_AUTHORITY_LIVE_OPERATOR_V8_VERSION,
    failureStage: 'candidate-authority-successor-pre-effect',
    safeErrorCode: asSafeErrorCode(error),
    credentialReads: 0,
    candidateProviderCalls: 0,
  })}\n`;
}

function failureDiagnostic(input: {
  readonly preflight: CandidateAuthoritySuccessorPreflightResultV8;
  readonly cutoff: string;
  readonly stage: CandidateAuthoritySuccessorFailureStage;
  readonly causal: unknown;
  readonly authority?: CandidateAuthoritySuccessorSourceAuthority;
  readonly attempts: CandidateAuthorityAttemptMetrics;
  readonly stagingExisted: boolean;
  readonly stagingCleaned: boolean;
}): CandidateAuthoritySuccessorFailureDiagnosticV8 {
  const fatal =
    input.causal instanceof CandidateAuthorityFirstFatalError
      ? input.causal
      : undefined;
  const receipt = input.authority?.effectReceipt;
  const githubLogical =
    fatal?.counters.githubLogicalRequests ??
    receipt?.githubLogicalRequests ??
    input.attempts.githubLogicalRequests ??
    0;
  const npmLogical =
    fatal?.counters.npmLogicalRequests ??
    receipt?.npmLogicalRequests ??
    input.attempts.npmLogicalRequests ??
    0;
  const githubAttempts =
    fatal?.counters.githubAttempts ??
    receipt?.githubAttempts ??
    input.attempts.githubAttempts;
  const npmAttempts =
    fatal?.counters.npmAttempts ??
    receipt?.npmAttempts ??
    input.attempts.npmAttempts;
  const perOperation =
    fatal?.counters.perOperation ??
    (receipt === undefined
      ? Object.fromEntries(
          Object.entries(input.attempts.perOperationAttempts).map(
            ([operation, attempts]) => [
              operation,
              {
                logicalRequests:
                  input.attempts.perOperationLogicalRequests?.[operation] ?? 0,
                attempts,
              },
            ],
          ),
        )
      : Object.fromEntries(
          receipt.perOperation.map((row) => [
            row.operationId,
            { logicalRequests: row.logicalRequests, attempts: row.attempts },
          ]),
        ));
  return Object.freeze({
    status: 'failed',
    operatorVersion: CANDIDATE_AUTHORITY_LIVE_OPERATOR_V8_VERSION,
    authorizationVersion: CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V8_VERSION,
    authorizationDigest: CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V8_DIGEST,
    executionHead: input.preflight.head,
    collectionCutoff: input.cutoff,
    firstFatalCandidateId: fatal?.candidateId ?? null,
    firstFatalOperationId: fatal?.operationId ?? null,
    safeErrorCode: fatal?.safeCode ?? asSafeErrorCode(input.causal),
    failureStage: input.stage,
    githubLogicalRequests: githubLogical,
    npmLogicalRequests: npmLogical,
    totalLogicalRequests: githubLogical + npmLogical,
    githubAttempts,
    npmAttempts,
    totalAttempts: githubAttempts + npmAttempts,
    retries:
      fatal?.counters.retries ?? receipt?.retries ?? input.attempts.retries,
    perOperation,
    ownedStagingExisted: input.stagingExisted,
    ownedStagingCleaned: input.stagingCleaned,
    sourceAuthorityPublished: false,
  });
}

function requireSha(value: string): void {
  if (!/^[a-f0-9]{40}$/u.test(value))
    throw ingestionError('ingestion.invalid-input');
}

function requireTimestamp(value: string): void {
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value) ||
    !Number.isFinite(Date.parse(value))
  )
    throw ingestionError('ingestion.invalid-input');
}
