/* eslint-disable @typescript-eslint/no-unnecessary-condition -- Committed authorities are independently revalidated at this effect boundary. */

import {
  CANDIDATE_AUTHORITY_PARTIAL_EVIDENCE_CONTRACT_DIGEST,
  CANDIDATE_AUTHORITY_PARTIAL_EVIDENCE_VERSION,
} from './candidate-authority-partial-evidence.ts';
import {
  CANDIDATE_AUTHORITY_PARTIAL_SEMANTIC_REGISTRY_PATH,
  parseCandidateAuthorityPartialSemanticRegistry,
} from './candidate-authority-partial-semantics.ts';
import { canonicalizeJson } from './canonical-json.ts';
import {
  CANDIDATE_AUTHORITY_ACCEPTED_PRELIVE_HEAD,
  CANDIDATE_AUTHORITY_DOSSIER_AUTHORITY_PATH,
  CANDIDATE_AUTHORITY_DOSSIER_PROJECTION_AUTHORITY_PATH,
  CANDIDATE_AUTHORITY_EVIDENCE_AUTHORITY_PATH,
  CANDIDATE_AUTHORITY_GITHUB_TOKEN_ENVIRONMENT,
  CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_DIGEST,
  CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_PATH,
  CANDIDATE_AUTHORITY_PARTIAL_AUTHORITY_PATH,
  CANDIDATE_AUTHORITY_PARTIAL_STAGING_PATH,
  CANDIDATE_AUTHORITY_PRIOR_OPERATOR_HEAD,
  CANDIDATE_AUTHORITY_PRIOR_LIVE_AUTHORIZATION_DIGEST,
  CANDIDATE_AUTHORITY_PRIOR_LIVE_AUTHORIZATION_PATH,
  CANDIDATE_AUTHORITY_PRIOR_LIVE_AUTHORIZATION_VERSION,
  CANDIDATE_AUTHORITY_PROFILE_AUTHORITY_PATH,
  CANDIDATE_AUTHORITY_PROFILE_STAGING_PATH,
  CANDIDATE_AUTHORITY_READINESS_STAGING_PATH,
  CANDIDATE_AUTHORITY_ROOT_STAGING_PATH,
  CANDIDATE_AUTHORITY_SOURCE_AUTHORITY_PATH,
  CANDIDATE_AUTHORITY_SOURCE_MAXIMUM_SERIALIZED_BYTES,
  CANDIDATE_AUTHORITY_SOURCE_STAGING_PATH,
  CANDIDATE_AUTHORITY_DOSSIER_STAGING_PATH,
  CANDIDATE_AUTHORITY_DOSSIER_PROJECTION_STAGING_PATH,
  CANDIDATE_AUTHORITY_EVIDENCE_STAGING_PATH,
  parseCandidateAuthorityLiveAuthorization,
  parseCandidateAuthoritySourceAuthority,
  serializeCandidateAuthoritySourceAuthority,
  type CandidateAuthorityLiveAuthorizationV2,
  type CandidateAuthoritySourceAuthorityV1,
} from './candidate-authority-live-contracts.ts';
import type { CandidateAuthorityAttemptMetrics } from './candidate-authority-live-collector.ts';
import { asSafeErrorCode, ingestionError } from './errors.ts';
import { parsePublicCatalog } from './manifest.ts';
import {
  CANDIDATE_AUTHORITY_FIELD_PLAN_V4_DIGEST,
  CANDIDATE_AUTHORITY_FIELD_PLAN_V4_PATH,
  CANDIDATE_AUTHORITY_FIELD_PLAN_V4_VERSION,
  CANDIDATE_AUTHORITY_READINESS_POLICY_V3_DIGEST,
  CANDIDATE_AUTHORITY_READINESS_POLICY_V3_PATH,
  CANDIDATE_AUTHORITY_READINESS_POLICY_V3_VERSION,
  CANDIDATE_AUTHORITY_SOURCE_POLICY_V4_DIGEST,
  CANDIDATE_AUTHORITY_SOURCE_POLICY_V4_PATH,
  CANDIDATE_AUTHORITY_SOURCE_POLICY_V4_VERSION,
  parseCandidateAuthorityFieldPlanV4,
  parseCandidateAuthorityReadinessPolicyV3,
  parseCandidateAuthoritySourcePolicyV4,
  type CandidateAuthoritySourcePolicyV4,
} from './candidate-authority-readiness.ts';
import type { PublicCatalog } from './types.ts';

export const CANDIDATE_AUTHORITY_LIVE_CATALOG_PATH =
  'catalog/public-v1/manifest.json' as const;
export const CANDIDATE_AUTHORITY_LIVE_TAXONOMY_PATH =
  'catalog/capability-taxonomy/1.0.0/manifest.json' as const;
export const CANDIDATE_AUTHORITY_LIVE_INPUT_MAX_BYTES = 32 * 1_024 * 1_024;

const ABSENT_BEFORE_COLLECTION = [
  CANDIDATE_AUTHORITY_SOURCE_AUTHORITY_PATH,
  CANDIDATE_AUTHORITY_SOURCE_STAGING_PATH,
  'catalog/public-v1/candidate-authority-root-v4.json',
  'catalog/public-v1/candidate-authority-readiness-report-v1.json',
  CANDIDATE_AUTHORITY_PROFILE_AUTHORITY_PATH,
  CANDIDATE_AUTHORITY_PARTIAL_AUTHORITY_PATH,
  CANDIDATE_AUTHORITY_EVIDENCE_AUTHORITY_PATH,
  CANDIDATE_AUTHORITY_DOSSIER_AUTHORITY_PATH,
  CANDIDATE_AUTHORITY_DOSSIER_PROJECTION_AUTHORITY_PATH,
  CANDIDATE_AUTHORITY_PROFILE_STAGING_PATH,
  CANDIDATE_AUTHORITY_PARTIAL_STAGING_PATH,
  CANDIDATE_AUTHORITY_EVIDENCE_STAGING_PATH,
  CANDIDATE_AUTHORITY_DOSSIER_STAGING_PATH,
  CANDIDATE_AUTHORITY_DOSSIER_PROJECTION_STAGING_PATH,
  CANDIDATE_AUTHORITY_READINESS_STAGING_PATH,
  CANDIDATE_AUTHORITY_ROOT_STAGING_PATH,
] as const;

export interface CandidateAuthorityLiveGitState {
  readonly branch: string;
  readonly head: string;
  readonly originHead: string;
  readonly parentHead: string;
  readonly priorOperatorParentHead: string;
  readonly correctionCommitCount: number;
  readonly clean: boolean;
}

export interface CandidateAuthorityLiveInputEffects {
  readonly readFixedFile: (
    path: string,
    maximumBytes: number,
  ) => Promise<string>;
  readonly requirePathMissing: (path: string) => Promise<void>;
  readonly readGitState: () => Promise<CandidateAuthorityLiveGitState>;
}

export interface CandidateAuthorityLiveCollectionEffects extends CandidateAuthorityLiveInputEffects {
  readonly readCredential: (name: string) => string;
  readonly now: () => Date;
  readonly collect: (input: {
    readonly catalog: PublicCatalog;
    readonly sourcePolicy: CandidateAuthoritySourcePolicyV4;
    readonly authorization: CandidateAuthorityLiveAuthorizationV2;
    readonly executionHead: string;
    readonly credential: string;
    readonly collectionCutoff: string;
    readonly signal?: AbortSignal;
  }) => Promise<CandidateAuthoritySourceAuthorityV1>;
  readonly stageExclusive: (path: string, text: string) => Promise<void>;
  readonly publishStagedExclusive: (
    stagingPath: string,
    finalPath: string,
  ) => Promise<void>;
  readonly removeOwnedStaging: (path: string) => Promise<void>;
}

export interface CandidateAuthorityLiveValidationEffects {
  readonly readFixedFile: (
    path: string,
    maximumBytes: number,
  ) => Promise<string>;
}

export interface CandidateAuthorityLivePreflightResult {
  readonly status: 'passed';
  readonly command: 'candidate-authority-live-preflight';
  readonly git: CandidateAuthorityLiveGitState;
  readonly catalog: PublicCatalog;
  readonly sourcePolicy: CandidateAuthoritySourcePolicyV4;
  readonly authorization: CandidateAuthorityLiveAuthorizationV2;
  readonly effectAudit: {
    readonly networkCalls: 0;
    readonly candidateProviderCalls: 0;
    readonly credentialReads: 0;
    readonly databaseCalls: 0;
    readonly dockerCalls: 0;
    readonly modelCalls: 0;
    readonly sourceAuthoritiesGenerated: 0;
    readonly allCandidateProjections: 0;
    readonly coverageCalculations: 0;
    readonly filesystemWrites: 0;
    readonly providerCollections: 0;
  };
}

export interface CandidateAuthorityLiveCollectionResult {
  readonly status: 'passed';
  readonly command: 'candidate-authority-live-collect';
  readonly credentialAvailable: true;
  readonly collectionCutoff: string;
  readonly outputPath: typeof CANDIDATE_AUTHORITY_SOURCE_AUTHORITY_PATH;
  readonly authority: CandidateAuthoritySourceAuthorityV1;
}

export async function preflightCandidateAuthorityLiveCollection(
  effects: CandidateAuthorityLiveInputEffects,
): Promise<CandidateAuthorityLivePreflightResult> {
  const [
    catalogText,
    readinessText,
    registryText,
    planText,
    sourceText,
    priorAuthorizationText,
    authorizationText,
    git,
  ] = await Promise.all([
    read(effects, CANDIDATE_AUTHORITY_LIVE_CATALOG_PATH),
    read(effects, CANDIDATE_AUTHORITY_READINESS_POLICY_V3_PATH),
    read(effects, CANDIDATE_AUTHORITY_PARTIAL_SEMANTIC_REGISTRY_PATH),
    read(effects, CANDIDATE_AUTHORITY_FIELD_PLAN_V4_PATH),
    read(effects, CANDIDATE_AUTHORITY_SOURCE_POLICY_V4_PATH),
    read(effects, CANDIDATE_AUTHORITY_PRIOR_LIVE_AUTHORIZATION_PATH),
    read(effects, CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_PATH),
    effects.readGitState(),
    ...ABSENT_BEFORE_COLLECTION.map((path) => effects.requirePathMissing(path)),
  ]);
  const catalog = parsePublicCatalog(catalogText);
  const registry = parseCandidateAuthorityPartialSemanticRegistry(
    JSON.parse(registryText) as unknown,
  );
  const readiness = parseCandidateAuthorityReadinessPolicyV3(
    JSON.parse(readinessText) as unknown,
  );
  const plan = parseCandidateAuthorityFieldPlanV4(
    JSON.parse(planText) as unknown,
    readiness,
    registry,
  );
  const sourcePolicy = parseCandidateAuthoritySourcePolicyV4(
    JSON.parse(sourceText) as unknown,
    plan,
  );
  const authorization = parseCandidateAuthorityLiveAuthorization(
    JSON.parse(authorizationText) as unknown,
  );
  const priorAuthorization = JSON.parse(priorAuthorizationText) as unknown;
  if (
    typeof priorAuthorization !== 'object' ||
    priorAuthorization === null ||
    Array.isArray(priorAuthorization)
  )
    throw ingestionError('ingestion.invalid-input');
  const priorRecord = priorAuthorization as Record<string, unknown>;
  const priorWithoutDigest = { ...priorRecord };
  delete priorWithoutDigest['authorizationSemanticDigest'];
  if (
    priorRecord['authorizationVersion'] !==
      CANDIDATE_AUTHORITY_PRIOR_LIVE_AUTHORIZATION_VERSION ||
    priorRecord['authorizationSemanticDigest'] !==
      CANDIDATE_AUTHORITY_PRIOR_LIVE_AUTHORIZATION_DIGEST ||
    canonicalizeJson(priorWithoutDigest).digest !==
      CANDIDATE_AUTHORITY_PRIOR_LIVE_AUTHORIZATION_DIGEST
  )
    throw ingestionError('ingestion.invalid-input');
  const mappedNpm = catalog.candidates.filter(
    (candidate) => candidate.npmPackage !== null,
  ).length;
  if (
    catalog.candidates.length !== 150 ||
    mappedNpm !== 80 ||
    git.branch !== 'feat/32-codebase-conditioned-ranking' ||
    git.head !== git.originHead ||
    git.parentHead !== CANDIDATE_AUTHORITY_PRIOR_OPERATOR_HEAD ||
    git.priorOperatorParentHead !== CANDIDATE_AUTHORITY_ACCEPTED_PRELIVE_HEAD ||
    git.correctionCommitCount !== 1 ||
    !git.clean ||
    authorization.bindings['catalogVersion'] !== catalog.catalogVersion ||
    authorization.bindings['catalogDigest'] !== catalog.manifestDigest ||
    authorization.bindings['readinessPolicyVersion'] !==
      CANDIDATE_AUTHORITY_READINESS_POLICY_V3_VERSION ||
    authorization.bindings['readinessPolicyDigest'] !==
      CANDIDATE_AUTHORITY_READINESS_POLICY_V3_DIGEST ||
    authorization.bindings['fieldPlanVersion'] !==
      CANDIDATE_AUTHORITY_FIELD_PLAN_V4_VERSION ||
    authorization.bindings['fieldPlanDigest'] !==
      CANDIDATE_AUTHORITY_FIELD_PLAN_V4_DIGEST ||
    authorization.bindings['sourcePolicyVersion'] !==
      CANDIDATE_AUTHORITY_SOURCE_POLICY_V4_VERSION ||
    authorization.bindings['sourcePolicyDigest'] !==
      CANDIDATE_AUTHORITY_SOURCE_POLICY_V4_DIGEST ||
    authorization.bindings['partialSemanticRegistryVersion'] !==
      registry.registryVersion ||
    authorization.bindings['partialSemanticRegistryDigest'] !==
      registry.registrySemanticDigest ||
    authorization.bindings['partialEvidenceVersion'] !==
      CANDIDATE_AUTHORITY_PARTIAL_EVIDENCE_VERSION ||
    authorization.bindings['partialEvidenceDigest'] !==
      CANDIDATE_AUTHORITY_PARTIAL_EVIDENCE_CONTRACT_DIGEST ||
    authorization.bindings['acceptedPreLiveHead'] !==
      CANDIDATE_AUTHORITY_ACCEPTED_PRELIVE_HEAD ||
    authorization.bindings['priorOperatorHead'] !==
      CANDIDATE_AUTHORITY_PRIOR_OPERATOR_HEAD ||
    authorization.authorizationSemanticDigest !==
      CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_DIGEST ||
    sourcePolicy.requestBudget.githubLogicalRequests !== 1810 ||
    sourcePolicy.requestBudget.npmLogicalRequests !== 80 ||
    sourcePolicy.requestBudget.totalLogicalRequests !== 1890 ||
    sourcePolicy.requestBudget.githubWorstCaseAttempts !== 5430 ||
    sourcePolicy.requestBudget.npmWorstCaseAttempts !== 240 ||
    sourcePolicy.requestBudget.totalWorstCaseAttempts !== 5670
  )
    throw ingestionError('ingestion.invalid-input');
  return Object.freeze({
    status: 'passed',
    command: 'candidate-authority-live-preflight',
    git,
    catalog,
    sourcePolicy,
    authorization,
    effectAudit: Object.freeze({
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
    }),
  });
}

export async function executeCandidateAuthorityLiveCollection(
  effects: CandidateAuthorityLiveCollectionEffects,
  signal?: AbortSignal,
): Promise<CandidateAuthorityLiveCollectionResult> {
  let stagingOwned = false;
  try {
    const preflight = await preflightCandidateAuthorityLiveCollection(effects);
    const credential = effects.readCredential(
      CANDIDATE_AUTHORITY_GITHUB_TOKEN_ENVIRONMENT,
    );
    const collectionCutoff = effects.now().toISOString();
    if (
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(collectionCutoff)
    )
      throw ingestionError('ingestion.invalid-input');
    const authority = await effects.collect({
      catalog: preflight.catalog,
      sourcePolicy: preflight.sourcePolicy,
      authorization: preflight.authorization,
      executionHead: preflight.git.head,
      credential,
      collectionCutoff,
      ...(signal === undefined ? {} : { signal }),
    });
    const text = serializeCandidateAuthoritySourceAuthority(authority);
    await effects.stageExclusive(CANDIDATE_AUTHORITY_SOURCE_STAGING_PATH, text);
    stagingOwned = true;
    await effects.publishStagedExclusive(
      CANDIDATE_AUTHORITY_SOURCE_STAGING_PATH,
      CANDIDATE_AUTHORITY_SOURCE_AUTHORITY_PATH,
    );
    stagingOwned = false;
    return {
      status: 'passed',
      command: 'candidate-authority-live-collect',
      credentialAvailable: true,
      collectionCutoff,
      outputPath: CANDIDATE_AUTHORITY_SOURCE_AUTHORITY_PATH,
      authority,
    };
  } catch (error) {
    if (stagingOwned)
      await effects.removeOwnedStaging(CANDIDATE_AUTHORITY_SOURCE_STAGING_PATH);
    throw error;
  }
}

export async function validateCandidateAuthorityLiveSource(
  effects: CandidateAuthorityLiveValidationEffects,
) {
  const text = await effects.readFixedFile(
    CANDIDATE_AUTHORITY_SOURCE_AUTHORITY_PATH,
    CANDIDATE_AUTHORITY_SOURCE_MAXIMUM_SERIALIZED_BYTES,
  );
  const authority = parseCandidateAuthoritySourceAuthority(
    JSON.parse(text) as unknown,
  );
  if (serializeCandidateAuthoritySourceAuthority(authority) !== text)
    throw ingestionError('ingestion.invalid-input');
  return {
    status: 'passed' as const,
    command: 'candidate-authority-live-source-validate' as const,
    authorityVersion: authority.authorityVersion,
    canonicalAuthorityDigest: authority.canonicalAuthorityDigest,
    serializedBytes: Buffer.byteLength(text, 'utf8'),
    candidateCount: authority.candidateCount,
    effectReceipt: authority.effectReceipt,
    effectAudit: {
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
    },
  };
}

async function read(
  effects: CandidateAuthorityLiveInputEffects,
  path: string,
): Promise<string> {
  return effects.readFixedFile(path, CANDIDATE_AUTHORITY_LIVE_INPUT_MAX_BYTES);
}

export function renderCandidateAuthorityLiveFailure(
  stage: string,
  error: unknown,
): string {
  return `${JSON.stringify({
    status: 'failed',
    stage,
    code: asSafeErrorCode(error),
  })}\n`;
}

export type { CandidateAuthorityAttemptMetrics };
