import {
  contractCanonicalDigest,
  contractUtf8ByteLength,
} from './artifact-identity.ts';
import {
  contractIssue,
  finalizeContractIssues,
  type ContractIssue,
  type ContractParseResult,
} from './diagnostics.ts';
import { cloneOwnedJson } from './owned-json.ts';
import { CONTRACT_VERSION } from './schema-builders.ts';
import {
  candidateRetrievalMetadataAuthorityV1Validator,
  structurallyValidate,
} from './structural-validation.ts';
import {
  CANDIDATE_RETRIEVAL_METADATA_AUTHORITY_MAX_BYTES,
  CANDIDATE_RETRIEVAL_METADATA_AUTHORITY_VERSION,
  type CandidateRetrievalMetadataAuthorityV1,
  type CandidateRetrievalMetadataRecordV1,
} from './candidate-retrieval-metadata-schemas.ts';

export interface CandidateRetrievalMetadataRecordInputV1 {
  readonly candidateId: string;
  readonly canonicalOwner: string;
  readonly canonicalRepository: string;
  readonly description: string | null;
  readonly topics: readonly string[];
  readonly primaryLanguage: string | null;
}

export interface CandidateRetrievalMetadataAuthorityInputV1 {
  readonly catalogVersion: string;
  readonly catalogDigest: string;
  readonly providerPolicyVersion: CandidateRetrievalMetadataAuthorityV1['providerPolicyVersion'];
  readonly providerPolicyDigest: string;
  readonly sourceProviderPolicyVersion: CandidateRetrievalMetadataAuthorityV1['sourceProviderPolicyVersion'];
  readonly sourceProviderPolicyDigest: string;
  readonly sourceOperation: CandidateRetrievalMetadataAuthorityV1['sourceOperation'];
  readonly collectedAt: string;
  readonly candidates: readonly CandidateRetrievalMetadataRecordInputV1[];
}

export function createCandidateRetrievalMetadataAuthorityV1(
  input: CandidateRetrievalMetadataAuthorityInputV1,
): CandidateRetrievalMetadataAuthorityV1 {
  const candidates = input.candidates
    .map((candidate) => {
      const semantic = {
        candidateId: candidate.candidateId,
        canonicalOwner: candidate.canonicalOwner,
        canonicalRepository: candidate.canonicalRepository,
        description: candidate.description,
        topics: [...candidate.topics].sort(compareAscii),
        primaryLanguage: candidate.primaryLanguage,
      };
      return {
        ...semantic,
        sourceRecordDigest:
          candidateRetrievalMetadataSourceRecordDigest(semantic),
      };
    })
    .sort((left, right) => compareAscii(left.candidateId, right.candidateId));
  const withoutIdentity = {
    contractVersion: CONTRACT_VERSION,
    authorityVersion: CANDIDATE_RETRIEVAL_METADATA_AUTHORITY_VERSION,
    catalogVersion: input.catalogVersion,
    catalogDigest: input.catalogDigest,
    providerPolicyVersion: input.providerPolicyVersion,
    providerPolicyDigest: input.providerPolicyDigest,
    sourceProviderPolicyVersion: input.sourceProviderPolicyVersion,
    sourceProviderPolicyDigest: input.sourceProviderPolicyDigest,
    sourceOperation: input.sourceOperation,
    collectedAt: input.collectedAt,
    candidates,
  };
  const authoritySemanticDigest =
    candidateRetrievalMetadataAuthoritySemanticDigest(withoutIdentity);
  const authority = {
    ...withoutIdentity,
    snapshotId: `retrieval-metadata-snapshot-${authoritySemanticDigest.slice(0, 32)}`,
    authoritySemanticDigest,
  } satisfies CandidateRetrievalMetadataAuthorityV1;
  const parsed = parseCandidateRetrievalMetadataAuthorityV1(authority);
  if (!parsed.ok) {
    throw new Error('Candidate retrieval metadata authority input is invalid.');
  }
  return parsed.value;
}

export function parseCandidateRetrievalMetadataAuthorityV1(
  value: unknown,
): ContractParseResult<
  CandidateRetrievalMetadataAuthorityV1,
  CandidateRetrievalMetadataAuthorityV1
> {
  const structural = structurallyValidate(
    value,
    candidateRetrievalMetadataAuthorityV1Validator,
  );
  if (!structural.ok) return structural;
  const issues = validateAuthoritySemantics(structural.value);
  return issues.length === 0
    ? {
        ok: true,
        value: cloneOwnedJson(structural.value),
        domain: cloneOwnedJson(structural.value),
        issues: [],
      }
    : { ok: false, issues: finalizeContractIssues(issues) };
}

export function candidateRetrievalMetadataSourceRecordDigest(
  value: Omit<CandidateRetrievalMetadataRecordV1, 'sourceRecordDigest'>,
): string {
  return contractCanonicalDigest({
    candidateId: value.candidateId,
    canonicalOwner: value.canonicalOwner,
    canonicalRepository: value.canonicalRepository,
    description: value.description,
    topics: value.topics,
    primaryLanguage: value.primaryLanguage,
  });
}

export function candidateRetrievalMetadataAuthoritySemanticDigest(
  value:
    | Omit<
        CandidateRetrievalMetadataAuthorityV1,
        'snapshotId' | 'authoritySemanticDigest'
      >
    | CandidateRetrievalMetadataAuthorityV1,
): string {
  return contractCanonicalDigest({
    contractVersion: value.contractVersion,
    authorityVersion: value.authorityVersion,
    catalogVersion: value.catalogVersion,
    catalogDigest: value.catalogDigest,
    providerPolicyVersion: value.providerPolicyVersion,
    providerPolicyDigest: value.providerPolicyDigest,
    sourceProviderPolicyVersion: value.sourceProviderPolicyVersion,
    sourceProviderPolicyDigest: value.sourceProviderPolicyDigest,
    sourceOperation: value.sourceOperation,
    collectedAt: value.collectedAt,
    candidates: value.candidates,
  });
}

export function serializeCandidateRetrievalMetadataAuthorityV1(
  value: CandidateRetrievalMetadataAuthorityV1,
): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function validateAuthoritySemantics(
  authority: CandidateRetrievalMetadataAuthorityV1,
): readonly ContractIssue[] {
  const issues: ContractIssue[] = [];
  const candidateIds = new Set<string>();
  const repositories = new Set<string>();
  for (const [index, candidate] of authority.candidates.entries()) {
    const previous = authority.candidates[index - 1];
    const repositoryKey =
      `${candidate.canonicalOwner}/${candidate.canonicalRepository}`.toLowerCase();
    if (
      candidateIds.has(candidate.candidateId) ||
      repositories.has(repositoryKey) ||
      (previous !== undefined &&
        compareAscii(previous.candidateId, candidate.candidateId) >= 0) ||
      candidate.topics.some(
        (topic, topicIndex) =>
          topicIndex > 0 && topic <= (candidate.topics[topicIndex - 1] ?? ''),
      ) ||
      candidate.sourceRecordDigest !==
        candidateRetrievalMetadataSourceRecordDigest(candidate)
    ) {
      issues.push(bindingIssue(`/candidates/${String(index)}`));
    }
    candidateIds.add(candidate.candidateId);
    repositories.add(repositoryKey);
  }
  const expectedDigest =
    candidateRetrievalMetadataAuthoritySemanticDigest(authority);
  if (
    authority.authoritySemanticDigest !== expectedDigest ||
    authority.snapshotId !==
      `retrieval-metadata-snapshot-${expectedDigest.slice(0, 32)}`
  ) {
    issues.push(bindingIssue('/authoritySemanticDigest'));
  }
  if (
    contractUtf8ByteLength(
      serializeCandidateRetrievalMetadataAuthorityV1(authority),
    ) > CANDIDATE_RETRIEVAL_METADATA_AUTHORITY_MAX_BYTES
  ) {
    issues.push(
      contractIssue(
        'contract.bounds',
        '',
        'Contract value is outside the allowed bounds.',
      ),
    );
  }
  return finalizeContractIssues(issues);
}

function bindingIssue(path: string): ContractIssue {
  return contractIssue(
    'contract.literal',
    path,
    'Contract value does not match the required literal.',
  );
}

function compareAscii(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
