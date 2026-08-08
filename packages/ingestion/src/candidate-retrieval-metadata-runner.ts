import {
  serializeCandidateRetrievalMetadataAuthorityV1,
  type CandidateRetrievalMetadataAuthorityV1,
} from '@gitblocks/contracts';

import { parsePublicCatalog } from './manifest.ts';
import type { ProfileMaterializationProviderPolicy } from './profile-materialization-contracts.ts';
import { parseProfileMaterializationProviderPolicy } from './profile-materialization-policy.ts';
import {
  CANDIDATE_RETRIEVAL_METADATA_AUTHORITY_PATH,
  CANDIDATE_RETRIEVAL_METADATA_FUTURE_COLLECTION_COMMAND,
  CANDIDATE_RETRIEVAL_METADATA_GITHUB_TOKEN_ENVIRONMENT,
  CANDIDATE_RETRIEVAL_METADATA_PROVIDER_POLICY_PATH,
  CANDIDATE_RETRIEVAL_METADATA_SOURCE_POLICY_PATH,
  parseCandidateRetrievalMetadataProviderPolicy,
  type CandidateRetrievalMetadataCollectionEnvelope,
} from './candidate-retrieval-metadata-policy.ts';
import type { PublicCatalog } from './types.ts';

export const CANDIDATE_RETRIEVAL_METADATA_CATALOG_PATH =
  'catalog/public-v1/manifest.json' as const;

export interface CandidateRetrievalMetadataPreflightEffects {
  readonly readFixedFile: (path: string) => Promise<string>;
  readonly requireOutputMissing: (path: string) => Promise<void>;
}

export interface CandidateRetrievalMetadataCollectionEffects extends CandidateRetrievalMetadataPreflightEffects {
  readonly readCredential: (name: string) => string;
  readonly collect: (
    preflight: CandidateRetrievalMetadataPreflightResult,
    credential: string,
    signal: AbortSignal,
  ) => Promise<CandidateRetrievalMetadataAuthorityV1>;
  readonly writeExclusive: (path: string, text: string) => Promise<void>;
}

export interface CandidateRetrievalMetadataPreflightResult {
  readonly command: typeof CANDIDATE_RETRIEVAL_METADATA_FUTURE_COLLECTION_COMMAND;
  readonly outputPath: typeof CANDIDATE_RETRIEVAL_METADATA_AUTHORITY_PATH;
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

export async function preflightCandidateRetrievalMetadataCollection(
  effects: CandidateRetrievalMetadataPreflightEffects,
): Promise<CandidateRetrievalMetadataPreflightResult> {
  const [catalogText, sourcePolicyText, policyText] = await Promise.all([
    effects.readFixedFile(CANDIDATE_RETRIEVAL_METADATA_CATALOG_PATH),
    effects.readFixedFile(CANDIDATE_RETRIEVAL_METADATA_SOURCE_POLICY_PATH),
    effects.readFixedFile(CANDIDATE_RETRIEVAL_METADATA_PROVIDER_POLICY_PATH),
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
  await effects.requireOutputMissing(
    CANDIDATE_RETRIEVAL_METADATA_AUTHORITY_PATH,
  );
  return Object.freeze({
    command: CANDIDATE_RETRIEVAL_METADATA_FUTURE_COLLECTION_COMMAND,
    outputPath: CANDIDATE_RETRIEVAL_METADATA_AUTHORITY_PATH,
    credentialEnvironmentName:
      CANDIDATE_RETRIEVAL_METADATA_GITHUB_TOKEN_ENVIRONMENT,
    catalog,
    sourcePolicy,
    envelope,
    requirements: Object.freeze({
      database: false,
      docker: false,
      model: false,
      npm: false,
      artifactBodies: false,
    }),
  });
}

export async function executeCandidateRetrievalMetadataCollection(
  effects: CandidateRetrievalMetadataCollectionEffects,
  signal: AbortSignal,
): Promise<CandidateRetrievalMetadataAuthorityV1> {
  const preflight =
    await preflightCandidateRetrievalMetadataCollection(effects);
  const credential = effects.readCredential(
    preflight.credentialEnvironmentName,
  );
  const authority = await effects.collect(preflight, credential, signal);
  await effects.writeExclusive(
    preflight.outputPath,
    serializeCandidateRetrievalMetadataAuthorityV1(authority),
  );
  return authority;
}
