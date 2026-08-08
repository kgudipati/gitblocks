/* eslint-disable @typescript-eslint/no-unnecessary-condition -- Parsed literal authorities are rechecked against independently loaded accepted bindings. */

import {
  CANDIDATE_RETRIEVAL_METADATA_AUTHORITY_MAX_BYTES,
  CANDIDATE_RETRIEVAL_METADATA_CANDIDATE_COUNT,
  parseCandidateRetrievalMetadataAuthorityV1,
  serializeCandidateRetrievalMetadataAuthorityV1,
  type CandidateRetrievalMetadataAuthorityV1,
} from '@gitblocks/contracts';

import {
  asSafeErrorCode,
  ingestionError,
  type IngestionErrorCode,
} from './errors.ts';
import { parsePublicCatalog } from './manifest.ts';
import type { ProfileMaterializationProviderPolicy } from './profile-materialization-contracts.ts';
import { parseProfileMaterializationProviderPolicy } from './profile-materialization-policy.ts';
import {
  CANDIDATE_RETRIEVAL_METADATA_AUTHORITY_PATH,
  CANDIDATE_RETRIEVAL_METADATA_FUTURE_COLLECTION_COMMAND,
  CANDIDATE_RETRIEVAL_METADATA_GITHUB_TOKEN_ENVIRONMENT,
  CANDIDATE_RETRIEVAL_METADATA_PROVIDER_POLICY_PATH,
  CANDIDATE_RETRIEVAL_METADATA_SOURCE_POLICY_PATH,
  CANDIDATE_RETRIEVAL_METADATA_STAGING_PATH,
  CANDIDATE_RETRIEVAL_METADATA_VALIDATION_COMMAND,
  parseCandidateRetrievalMetadataProviderPolicy,
  type CandidateRetrievalMetadataCollectionEnvelope,
} from './candidate-retrieval-metadata-policy.ts';
import type { PublicCatalog } from './types.ts';

export const CANDIDATE_RETRIEVAL_METADATA_CATALOG_PATH =
  'catalog/public-v1/manifest.json' as const;
export const CANDIDATE_RETRIEVAL_METADATA_INPUT_MAX_BYTES = 32 * 1_024 * 1_024;

export const CANDIDATE_RETRIEVAL_METADATA_COLLECTION_STAGES = [
  'preflight',
  'credential-read',
  'collection',
  'authority-validation',
  'staging-write',
  'atomic-publication',
  'staging-cleanup',
] as const;
export const CANDIDATE_RETRIEVAL_METADATA_VALIDATION_STAGES = [
  'validation-inputs',
  'authority-read',
  'authority-validation',
] as const;

export type CandidateRetrievalMetadataCollectionStage =
  (typeof CANDIDATE_RETRIEVAL_METADATA_COLLECTION_STAGES)[number];
export type CandidateRetrievalMetadataValidationStage =
  (typeof CANDIDATE_RETRIEVAL_METADATA_VALIDATION_STAGES)[number];
export type CandidateRetrievalMetadataOperationStage =
  | CandidateRetrievalMetadataCollectionStage
  | CandidateRetrievalMetadataValidationStage;
export type CandidateRetrievalMetadataSafeErrorCode =
  IngestionErrorCode | 'authority-missing';

export interface CandidateRetrievalMetadataPreflightEffects {
  readonly readFixedFile: (
    path: string,
    maximumBytes: number,
  ) => Promise<string>;
  readonly requirePathMissing: (path: string) => Promise<void>;
}

export interface CandidateRetrievalMetadataCollectionEffects extends CandidateRetrievalMetadataPreflightEffects {
  readonly readCredential: (name: string) => string;
  readonly collect: (
    preflight: CandidateRetrievalMetadataPreflightResult,
    credential: string,
    signal: AbortSignal,
  ) => Promise<CandidateRetrievalMetadataAuthorityV1>;
  readonly stageExclusive: (path: string, text: string) => Promise<void>;
  readonly publishStagedExclusive: (
    stagingPath: string,
    finalPath: string,
  ) => Promise<void>;
  readonly removeOwnedStaging: (path: string) => Promise<void>;
}

export interface CandidateRetrievalMetadataValidationEffects {
  readonly readFixedFile: (
    path: string,
    maximumBytes: number,
  ) => Promise<string>;
  readonly readAuthorityFile: (
    path: string,
    maximumBytes: number,
  ) => Promise<
    | { readonly ok: true; readonly text: string }
    | { readonly ok: false; readonly issue: 'authority-missing' }
  >;
}

export interface CandidateRetrievalMetadataPreflightResult {
  readonly command: typeof CANDIDATE_RETRIEVAL_METADATA_FUTURE_COLLECTION_COMMAND;
  readonly outputPath: typeof CANDIDATE_RETRIEVAL_METADATA_AUTHORITY_PATH;
  readonly stagingPath: typeof CANDIDATE_RETRIEVAL_METADATA_STAGING_PATH;
  readonly credentialEnvironmentName: typeof CANDIDATE_RETRIEVAL_METADATA_GITHUB_TOKEN_ENVIRONMENT;
  readonly catalog: PublicCatalog;
  readonly sourcePolicy: ProfileMaterializationProviderPolicy;
  readonly envelope: CandidateRetrievalMetadataCollectionEnvelope;
  readonly requirements: {
    readonly database: false;
    readonly docker: false;
    readonly model: false;
    readonly npm: false;
    readonly artifactBodies: false;
  };
}

export interface CandidateRetrievalMetadataValidationResult {
  readonly status: 'passed';
  readonly command: typeof CANDIDATE_RETRIEVAL_METADATA_VALIDATION_COMMAND;
  readonly outputPath: typeof CANDIDATE_RETRIEVAL_METADATA_AUTHORITY_PATH;
  readonly authorityVersion: CandidateRetrievalMetadataAuthorityV1['authorityVersion'];
  readonly catalogVersion: string;
  readonly catalogDigest: string;
  readonly providerPolicyVersion: CandidateRetrievalMetadataAuthorityV1['providerPolicyVersion'];
  readonly providerPolicyDigest: string;
  readonly sourceProviderPolicyVersion: CandidateRetrievalMetadataAuthorityV1['sourceProviderPolicyVersion'];
  readonly sourceProviderPolicyDigest: string;
  readonly sourceOperation: CandidateRetrievalMetadataAuthorityV1['sourceOperation'];
  readonly candidateCount: typeof CANDIDATE_RETRIEVAL_METADATA_CANDIDATE_COUNT;
  readonly serializedBytes: number;
  readonly snapshotId: string;
  readonly authoritySemanticDigest: string;
}

export class CandidateRetrievalMetadataOperationFailure extends Error {
  public readonly operation: 'collect' | 'validate';
  public readonly stage: CandidateRetrievalMetadataOperationStage;
  public readonly code: CandidateRetrievalMetadataSafeErrorCode;

  public constructor(
    operation: 'collect' | 'validate',
    stage: CandidateRetrievalMetadataOperationStage,
    code: CandidateRetrievalMetadataSafeErrorCode,
  ) {
    super('Candidate retrieval metadata operation failed safely.');
    this.name = 'CandidateRetrievalMetadataOperationFailure';
    this.operation = operation;
    this.stage = stage;
    this.code = code;
    Object.defineProperty(this, 'stack', {
      configurable: false,
      enumerable: false,
      value: undefined,
      writable: false,
    });
  }
}

export async function preflightCandidateRetrievalMetadataCollection(
  effects: CandidateRetrievalMetadataPreflightEffects,
): Promise<CandidateRetrievalMetadataPreflightResult> {
  try {
    const authorities = await loadAcceptedCollectionAuthorities(effects);
    await effects.requirePathMissing(
      CANDIDATE_RETRIEVAL_METADATA_AUTHORITY_PATH,
    );
    await effects.requirePathMissing(CANDIDATE_RETRIEVAL_METADATA_STAGING_PATH);
    return Object.freeze({
      command: CANDIDATE_RETRIEVAL_METADATA_FUTURE_COLLECTION_COMMAND,
      outputPath: CANDIDATE_RETRIEVAL_METADATA_AUTHORITY_PATH,
      stagingPath: CANDIDATE_RETRIEVAL_METADATA_STAGING_PATH,
      credentialEnvironmentName:
        CANDIDATE_RETRIEVAL_METADATA_GITHUB_TOKEN_ENVIRONMENT,
      ...authorities,
      requirements: Object.freeze({
        database: false,
        docker: false,
        model: false,
        npm: false,
        artifactBodies: false,
      }),
    });
  } catch (error) {
    throw operationFailure('collect', 'preflight', error);
  }
}

export async function executeCandidateRetrievalMetadataCollection(
  effects: CandidateRetrievalMetadataCollectionEffects,
  signal: AbortSignal,
): Promise<CandidateRetrievalMetadataAuthorityV1> {
  let stage: CandidateRetrievalMetadataCollectionStage = 'preflight';
  let ownsStaging = false;
  try {
    const preflight =
      await preflightCandidateRetrievalMetadataCollection(effects);
    if (signal.aborted) throw ingestionError('ingestion.cancelled');
    stage = 'credential-read';
    const credential = effects.readCredential(
      preflight.credentialEnvironmentName,
    );
    stage = 'collection';
    const collected = await effects.collect(preflight, credential, signal);
    stage = 'authority-validation';
    const authority = validateAuthorityBinding(collected, preflight);
    const serialized =
      serializeCandidateRetrievalMetadataAuthorityV1(authority);
    if (
      Buffer.byteLength(serialized, 'utf8') >
      CANDIDATE_RETRIEVAL_METADATA_AUTHORITY_MAX_BYTES
    ) {
      throw ingestionError('ingestion.body-too-large');
    }
    stage = 'staging-write';
    await effects.stageExclusive(preflight.stagingPath, serialized);
    ownsStaging = true;
    stage = 'atomic-publication';
    await effects.publishStagedExclusive(
      preflight.stagingPath,
      preflight.outputPath,
    );
    ownsStaging = false;
    return authority;
  } catch (error) {
    const failure = operationFailure('collect', stage, error);
    if (ownsStaging) {
      try {
        await effects.removeOwnedStaging(
          CANDIDATE_RETRIEVAL_METADATA_STAGING_PATH,
        );
      } catch (cleanupError) {
        throw operationFailure('collect', 'staging-cleanup', cleanupError);
      }
    }
    throw failure;
  }
}

export async function validateCandidateRetrievalMetadataAuthority(
  effects: CandidateRetrievalMetadataValidationEffects,
): Promise<CandidateRetrievalMetadataValidationResult> {
  let stage: CandidateRetrievalMetadataValidationStage = 'validation-inputs';
  try {
    const authorities = await loadAcceptedCollectionAuthorities(effects);
    stage = 'authority-read';
    const authorityFile = await effects.readAuthorityFile(
      CANDIDATE_RETRIEVAL_METADATA_AUTHORITY_PATH,
      CANDIDATE_RETRIEVAL_METADATA_AUTHORITY_MAX_BYTES,
    );
    if (!authorityFile.ok) {
      throw new CandidateRetrievalMetadataOperationFailure(
        'validate',
        stage,
        'authority-missing',
      );
    }
    stage = 'authority-validation';
    const parsedJson = JSON.parse(authorityFile.text) as unknown;
    const authority = validateAuthorityBinding(parsedJson, authorities);
    if (
      authorityFile.text !==
      serializeCandidateRetrievalMetadataAuthorityV1(authority)
    ) {
      throw ingestionError('ingestion.invalid-manifest');
    }
    return Object.freeze({
      status: 'passed',
      command: CANDIDATE_RETRIEVAL_METADATA_VALIDATION_COMMAND,
      outputPath: CANDIDATE_RETRIEVAL_METADATA_AUTHORITY_PATH,
      authorityVersion: authority.authorityVersion,
      catalogVersion: authority.catalogVersion,
      catalogDigest: authority.catalogDigest,
      providerPolicyVersion: authority.providerPolicyVersion,
      providerPolicyDigest: authority.providerPolicyDigest,
      sourceProviderPolicyVersion: authority.sourceProviderPolicyVersion,
      sourceProviderPolicyDigest: authority.sourceProviderPolicyDigest,
      sourceOperation: authority.sourceOperation,
      candidateCount: CANDIDATE_RETRIEVAL_METADATA_CANDIDATE_COUNT,
      serializedBytes: Buffer.byteLength(authorityFile.text, 'utf8'),
      snapshotId: authority.snapshotId,
      authoritySemanticDigest: authority.authoritySemanticDigest,
    });
  } catch (error) {
    throw operationFailure('validate', stage, error);
  }
}

export function renderCandidateRetrievalMetadataCliFailure(
  mode: string | undefined,
  error: unknown,
): string {
  return (mode === 'collect' || mode === 'validate') &&
    error instanceof CandidateRetrievalMetadataOperationFailure
    ? `Candidate retrieval metadata operation failed safely (operation=${error.operation}; stage=${error.stage}; code=${error.code}).\n`
    : 'Candidate retrieval metadata operation failed safely.\n';
}

async function loadAcceptedCollectionAuthorities(effects: {
  readonly readFixedFile: (
    path: string,
    maximumBytes: number,
  ) => Promise<string>;
}): Promise<{
  readonly catalog: PublicCatalog;
  readonly sourcePolicy: ProfileMaterializationProviderPolicy;
  readonly envelope: CandidateRetrievalMetadataCollectionEnvelope;
}> {
  const [catalogText, sourcePolicyText, policyText] = await Promise.all([
    effects.readFixedFile(
      CANDIDATE_RETRIEVAL_METADATA_CATALOG_PATH,
      CANDIDATE_RETRIEVAL_METADATA_INPUT_MAX_BYTES,
    ),
    effects.readFixedFile(
      CANDIDATE_RETRIEVAL_METADATA_SOURCE_POLICY_PATH,
      CANDIDATE_RETRIEVAL_METADATA_INPUT_MAX_BYTES,
    ),
    effects.readFixedFile(
      CANDIDATE_RETRIEVAL_METADATA_PROVIDER_POLICY_PATH,
      CANDIDATE_RETRIEVAL_METADATA_INPUT_MAX_BYTES,
    ),
  ]);
  const catalog = parsePublicCatalog(catalogText);
  const sourcePolicy = parseProfileMaterializationProviderPolicy(
    catalog,
    JSON.parse(sourcePolicyText) as unknown,
  );
  const envelope = parseCandidateRetrievalMetadataProviderPolicy(
    catalog,
    sourcePolicy,
    JSON.parse(policyText) as unknown,
  );
  return { catalog, sourcePolicy, envelope };
}

function validateAuthorityBinding(
  supplied: unknown,
  accepted: {
    readonly catalog: PublicCatalog;
    readonly sourcePolicy: ProfileMaterializationProviderPolicy;
    readonly envelope: CandidateRetrievalMetadataCollectionEnvelope;
  },
): CandidateRetrievalMetadataAuthorityV1 {
  const parsed = parseCandidateRetrievalMetadataAuthorityV1(supplied);
  if (!parsed.ok) throw ingestionError('ingestion.invalid-manifest');
  const authority = parsed.value;
  const policy = accepted.envelope.policy;
  const expectedCandidates = new Map(
    accepted.catalog.candidates.map((candidate) => [
      candidate.candidateId,
      `${candidate.github.owner}/${candidate.github.repository}`.toLowerCase(),
    ]),
  );
  if (
    authority.catalogVersion !== accepted.catalog.catalogVersion ||
    authority.catalogDigest !== accepted.catalog.manifestDigest ||
    authority.authorityVersion !== policy.authority.authorityVersion ||
    authority.providerPolicyVersion !== policy.policyVersion ||
    authority.providerPolicyDigest !== policy.policySemanticDigest ||
    authority.sourceProviderPolicyVersion !==
      policy.sourceProviderPolicyBinding.policyVersion ||
    authority.sourceProviderPolicyDigest !==
      policy.sourceProviderPolicyBinding.policyDigest ||
    authority.sourceProviderPolicyDigest !==
      accepted.sourcePolicy.policySemanticDigest ||
    authority.sourceOperation !== accepted.envelope.sourceOperation.operation ||
    authority.candidates.length !==
      CANDIDATE_RETRIEVAL_METADATA_CANDIDATE_COUNT ||
    expectedCandidates.size !== CANDIDATE_RETRIEVAL_METADATA_CANDIDATE_COUNT ||
    authority.candidates.some(
      (candidate) =>
        expectedCandidates.get(candidate.candidateId) !==
        `${candidate.canonicalOwner}/${candidate.canonicalRepository}`.toLowerCase(),
    )
  ) {
    throw ingestionError('ingestion.invalid-manifest');
  }
  return authority;
}

function operationFailure(
  operation: 'collect' | 'validate',
  stage: CandidateRetrievalMetadataOperationStage,
  error: unknown,
): CandidateRetrievalMetadataOperationFailure {
  return error instanceof CandidateRetrievalMetadataOperationFailure
    ? error
    : new CandidateRetrievalMetadataOperationFailure(
        operation,
        stage,
        asSafeErrorCode(error),
      );
}
