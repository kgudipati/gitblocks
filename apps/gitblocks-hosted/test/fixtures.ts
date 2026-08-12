import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import {
  CONTRACT_VERSION,
  parseCandidateRetrievalMetadataAuthorityV1,
  parseCapabilityRetrievalExpansionV1,
  parseCapabilityTaxonomyV1,
  parseDeterministicCandidateProfileAuthorityV1,
  type CandidateRetrievalMetadataAuthorityV1,
  type CapabilityQueryDraftConstraintV1,
  type CapabilityQueryInputV1,
  type CapabilityRetrievalExpansionV1,
  type CapabilityTaxonomyV1,
  type DeterministicCandidateProfileAuthorityV1,
} from '@gitblocks/contracts';
import { createCandidateRetrievalEngineV1 } from '@gitblocks/retrieval';

import {
  createHostedDiscoveryApplication,
  type HostedDiscoveryApplicationV1,
} from '../src/application.ts';

export interface AcceptedHostedDiscoveryAuthorities {
  readonly profiles: DeterministicCandidateProfileAuthorityV1;
  readonly metadata: CandidateRetrievalMetadataAuthorityV1;
  readonly taxonomy: CapabilityTaxonomyV1;
  readonly retrievalExpansion: CapabilityRetrievalExpansionV1;
}

let acceptedAuthoritiesPromise:
  Promise<AcceptedHostedDiscoveryAuthorities> | undefined;

export function loadAcceptedAuthorities(): Promise<AcceptedHostedDiscoveryAuthorities> {
  acceptedAuthoritiesPromise ??= loadAcceptedAuthoritiesOnce();
  return acceptedAuthoritiesPromise;
}

export async function createAcceptedApplication(): Promise<HostedDiscoveryApplicationV1> {
  const authorities = await loadAcceptedAuthorities();
  const engine = createCandidateRetrievalEngineV1({
    taxonomy: authorities.taxonomy,
    candidateProfileAuthority: authorities.profiles,
    retrievalExpansionAuthority: authorities.retrievalExpansion,
    candidateRetrievalMetadataAuthority: authorities.metadata,
    expectedCandidateRetrievalMetadataAuthorityBinding: expectedMetadataBinding(
      authorities.metadata,
    ),
  });
  if (!engine.ok) {
    throw new Error('Accepted retrieval engine construction failed.');
  }
  const created = createHostedDiscoveryApplication({
    snapshot: {
      snapshotId: 'serving-accepted-hosted-test',
      snapshotRecordDigest: 'a'.repeat(64),
      candidateCount: 150,
    },
    taxonomy: authorities.taxonomy,
    candidateProfileAuthority: authorities.profiles,
    retrievalExpansionAuthority: authorities.retrievalExpansion,
    candidateRetrievalMetadataAuthority: authorities.metadata,
    engine: engine.engine,
  });
  if (!created.ok) {
    throw new Error('Accepted hosted application construction failed.');
  }
  return created.application;
}

export function capabilityInput(input: {
  readonly id: string;
  readonly term: string;
  readonly constraints?: readonly CapabilityQueryDraftConstraintV1[];
  readonly repositoryFingerprintReference?: CapabilityQueryInputV1['repositoryFingerprintReference'];
}): CapabilityQueryInputV1 {
  return {
    contractVersion: CONTRACT_VERSION,
    queryInputId: input.id,
    scope: 'local-pre-approval',
    summary: 'Discover capability candidates.',
    capabilityTerms: [{ termId: `${input.id}-term`, originalTerm: input.term }],
    successConditions: [
      {
        conditionId: `${input.id}-result`,
        statement: 'Return a bounded candidate shortlist.',
      },
    ],
    draftConstraints: [...(input.constraints ?? [])],
    candidateReferences: [],
    repositoryFingerprintReference:
      input.repositoryFingerprintReference ?? null,
  };
}

export function expectedMetadataBinding(
  authority: CandidateRetrievalMetadataAuthorityV1,
) {
  return {
    authorityVersion: authority.authorityVersion,
    catalogVersion: authority.catalogVersion,
    catalogDigest: authority.catalogDigest,
    providerPolicyVersion: authority.providerPolicyVersion,
    providerPolicyDigest: authority.providerPolicyDigest,
    sourceProviderPolicyVersion: authority.sourceProviderPolicyVersion,
    sourceProviderPolicyDigest: authority.sourceProviderPolicyDigest,
    sourceOperation: authority.sourceOperation,
  };
}

async function loadAcceptedAuthoritiesOnce(): Promise<AcceptedHostedDiscoveryAuthorities> {
  const [profileText, metadataText, taxonomyText, expansionText] =
    await Promise.all([
      catalogText('public-v1/candidate-profile-authority.json'),
      catalogText('public-v1/candidate-retrieval-metadata-authority.json'),
      catalogText('capability-taxonomy/1.0.0/manifest.json'),
      catalogText('capability-retrieval-expansion/1.0.0/manifest.json'),
    ]);
  const profiles = parseDeterministicCandidateProfileAuthorityV1(
    JSON.parse(profileText) as unknown,
  );
  const metadata = parseCandidateRetrievalMetadataAuthorityV1(
    JSON.parse(metadataText) as unknown,
  );
  const taxonomy = parseCapabilityTaxonomyV1(
    JSON.parse(taxonomyText) as unknown,
  );
  const retrievalExpansion = parseCapabilityRetrievalExpansionV1(
    JSON.parse(expansionText) as unknown,
  );
  if (!profiles.ok || !metadata.ok || !taxonomy.ok || !retrievalExpansion.ok) {
    throw new Error('Accepted hosted discovery authorities are invalid.');
  }
  return Object.freeze({
    profiles: profiles.value,
    metadata: metadata.value,
    taxonomy: taxonomy.value,
    retrievalExpansion: retrievalExpansion.value,
  });
}

function catalogText(relativePath: string): Promise<string> {
  return readFile(
    fileURLToPath(new URL(`../../../catalog/${relativePath}`, import.meta.url)),
    'utf8',
  );
}
