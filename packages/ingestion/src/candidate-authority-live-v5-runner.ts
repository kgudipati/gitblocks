/* eslint-disable @typescript-eslint/no-unnecessary-condition -- Injected boundaries are revalidated before effects. */

import { canonicalizeJson } from './canonical-json.ts';
import type {
  CandidateAuthorityAttemptMetrics,
  collectCandidateAuthoritySourceAuthority,
} from './candidate-authority-live-collector.ts';
import {
  CANDIDATE_AUTHORITY_LIVE_OPERATOR_V5_VERSION,
  CandidateAuthorityFirstFatalError,
  type CandidateAuthoritySuccessorRuntimeSourcePolicy,
  type CandidateAuthoritySuccessorSourceAuthority,
} from './candidate-authority-provider-contract.ts';
import {
  CANDIDATE_AUTHORITY_ACCEPTED_POSTMORTEM_HEAD,
  CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V5_DIGEST,
  CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V5_VERSION,
  CANDIDATE_AUTHORITY_SOURCE_POLICY_V7_DIGEST,
  CANDIDATE_AUTHORITY_SOURCE_POLICY_V7_VERSION,
  CANDIDATE_AUTHORITY_SUCCESSOR_MAXIMUM_SOURCE_BYTES,
  CANDIDATE_AUTHORITY_SUCCESSOR_SOURCE_PATH,
  CANDIDATE_AUTHORITY_SUCCESSOR_SOURCE_STAGING_PATH,
  CANDIDATE_AUTHORITY_SUCCESSOR_TOKEN_ENVIRONMENT,
  parseCandidateAuthoritySuccessorSourceAuthority,
  serializeCandidateAuthoritySuccessorSourceAuthority,
  type CandidateAuthoritySuccessorAuthorization,
} from './candidate-authority-successor-contracts.ts';
import {
  asSafeErrorCode,
  type IngestionErrorCode,
  ingestionError,
} from './errors.ts';
import type { PublicCatalog } from './types.ts';

export type CandidateAuthoritySuccessorFailureStage =
  | 'candidate-authority-successor-collect'
  | 'candidate-authority-successor-source-serialization-validation'
  | 'candidate-authority-successor-staging'
  | 'candidate-authority-successor-publication'
  | 'candidate-authority-successor-staging-cleanup';

export interface CandidateAuthoritySuccessorPreflightResult {
  readonly status: 'passed';
  readonly acceptedHead: string;
  readonly branch: 'feat/32-codebase-conditioned-ranking';
  readonly head: string;
  readonly originHead: string;
  readonly parentHead: typeof CANDIDATE_AUTHORITY_ACCEPTED_POSTMORTEM_HEAD;
  readonly activationCommitCount: 1;
  readonly clean: true;
  readonly outputAndStagingPathsAbsent: true;
  readonly catalog: PublicCatalog;
  readonly sourcePolicy: CandidateAuthoritySuccessorRuntimeSourcePolicy;
  readonly authorization: CandidateAuthoritySuccessorAuthorization;
  readonly effectAudit: CandidateAuthoritySuccessorZeroEffectAudit;
}

export interface CandidateAuthoritySuccessorZeroEffectAudit {
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
}

export const CANDIDATE_AUTHORITY_SUCCESSOR_ZERO_EFFECT_AUDIT = Object.freeze({
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
} as const);

export interface CandidateAuthoritySuccessorEffects {
  readonly preflight: (
    acceptedHead: string,
  ) => Promise<CandidateAuthoritySuccessorPreflightResult>;
  readonly readCredential: (
    name: typeof CANDIDATE_AUTHORITY_SUCCESSOR_TOKEN_ENVIRONMENT,
  ) => string;
  readonly now: () => Date;
  readonly collect: (
    input: Omit<
      Parameters<typeof collectCandidateAuthoritySourceAuthority>[0],
      'readAttemptMetrics' | 'transport'
    >,
  ) => Promise<CandidateAuthoritySuccessorSourceAuthority>;
  readonly readAttemptMetrics: () => CandidateAuthorityAttemptMetrics;
  readonly stageExclusive: (path: string, text: string) => Promise<void>;
  readonly publishStagedExclusive: (
    stagingPath: string,
    finalPath: string,
  ) => Promise<void>;
  readonly removeOwnedStaging: (path: string) => Promise<void>;
}

export interface CandidateAuthoritySuccessorFailureDiagnostic {
  readonly status: 'failed';
  readonly operatorVersion: typeof CANDIDATE_AUTHORITY_LIVE_OPERATOR_V5_VERSION;
  readonly authorizationVersion: typeof CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V5_VERSION;
  readonly authorizationDigest: typeof CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V5_DIGEST;
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

export class CandidateAuthoritySuccessorExecutionFailure extends Error {
  public readonly diagnostic: CandidateAuthoritySuccessorFailureDiagnostic;
  public constructor(diagnostic: CandidateAuthoritySuccessorFailureDiagnostic) {
    super('Candidate authority successor execution failed.');
    this.name = 'CandidateAuthoritySuccessorExecutionFailure';
    this.diagnostic = diagnostic;
    Object.defineProperty(this, 'stack', { value: undefined });
  }
}

export async function preflightCandidateAuthoritySuccessor(
  effects: Pick<CandidateAuthoritySuccessorEffects, 'preflight'>,
  acceptedHead: string,
): Promise<CandidateAuthoritySuccessorPreflightResult> {
  requireSha(acceptedHead);
  const value = await effects.preflight(acceptedHead);
  if (
    value.status !== 'passed' ||
    value.acceptedHead !== acceptedHead ||
    value.head !== acceptedHead ||
    value.originHead !== acceptedHead ||
    value.branch !== 'feat/32-codebase-conditioned-ranking' ||
    value.parentHead !== CANDIDATE_AUTHORITY_ACCEPTED_POSTMORTEM_HEAD ||
    value.activationCommitCount !== 1 ||
    !value.clean ||
    !value.outputAndStagingPathsAbsent ||
    value.catalog.candidates.length !== 150 ||
    value.catalog.candidates.filter(
      (candidate) => candidate.npmPackage !== null,
    ).length !== 80 ||
    value.sourcePolicy.policyVersion !==
      CANDIDATE_AUTHORITY_SOURCE_POLICY_V7_VERSION ||
    value.sourcePolicy.policySemanticDigest !==
      CANDIDATE_AUTHORITY_SOURCE_POLICY_V7_DIGEST ||
    value.authorization.version !==
      CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V5_VERSION ||
    value.authorization.digest !==
      CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V5_DIGEST ||
    value.authorization.conditionalCollections !== 1 ||
    value.authorization.activeCollections !== 0 ||
    value.authorization.automaticRerun ||
    Object.values(value.effectAudit).some((count) => count !== 0)
  )
    throw ingestionError('ingestion.invalid-input');
  return value;
}

export async function executeCandidateAuthoritySuccessor(
  effects: CandidateAuthoritySuccessorEffects,
  acceptedHead: string,
  signal?: AbortSignal,
): Promise<CandidateAuthoritySuccessorSourceAuthority> {
  const preflight = await preflightCandidateAuthoritySuccessor(
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
      liveAuthorizationVersion: preflight.authorization.version,
      liveAuthorizationDigest: preflight.authorization.digest,
      liveAuthorizationBindings: preflight.authorization.bindings,
      executionHead: preflight.head,
      githubToken: credential,
      collectionCutoff: cutoff,
      operatorVersion: CANDIDATE_AUTHORITY_LIVE_OPERATOR_V5_VERSION,
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
    throw new CandidateAuthoritySuccessorExecutionFailure(
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

export function renderCandidateAuthoritySuccessorFailure(
  error: unknown,
): string {
  if (error instanceof CandidateAuthoritySuccessorExecutionFailure)
    return `${canonicalizeJson(error.diagnostic).text}\n`;
  return `${JSON.stringify({
    status: 'failed',
    operatorVersion: CANDIDATE_AUTHORITY_LIVE_OPERATOR_V5_VERSION,
    failureStage: 'candidate-authority-successor-pre-effect',
    safeErrorCode: asSafeErrorCode(error),
    credentialReads: 0,
    candidateProviderCalls: 0,
  })}\n`;
}

function failureDiagnostic(input: {
  readonly preflight: CandidateAuthoritySuccessorPreflightResult;
  readonly cutoff: string;
  readonly stage: CandidateAuthoritySuccessorFailureStage;
  readonly causal: unknown;
  readonly authority?: CandidateAuthoritySuccessorSourceAuthority;
  readonly attempts: CandidateAuthorityAttemptMetrics;
  readonly stagingExisted: boolean;
  readonly stagingCleaned: boolean;
}): CandidateAuthoritySuccessorFailureDiagnostic {
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
    operatorVersion: CANDIDATE_AUTHORITY_LIVE_OPERATOR_V5_VERSION,
    authorizationVersion: CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V5_VERSION,
    authorizationDigest: CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V5_DIGEST,
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
