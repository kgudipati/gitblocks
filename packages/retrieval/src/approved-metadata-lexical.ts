/* eslint-disable @typescript-eslint/no-unnecessary-condition -- Caller-owned authority bindings are rechecked at the runtime trust boundary. */

import {
  parseCandidateRetrievalMetadataAuthorityV1,
  parseCapabilityRetrievalExpansionV1,
  parseCapabilityTaxonomyV1,
  type CandidateRetrievalMetadataAuthorityV1,
  type CandidateRetrievalMetadataRecordV1,
  type CapabilityQueryNormalizationResultV1,
} from '@gitblocks/contracts';

import { expandRetrievalTermsV1 } from './retrieval-expansion.ts';

export const APPROVED_METADATA_LEXICAL_CHANNEL_VERSION =
  'approved-metadata-lexical/1.0.0' as const;
export const APPROVED_METADATA_LEXICAL_MAX_NGRAM = 4;
export const APPROVED_METADATA_LEXICAL_MAX_TOKEN_CODE_UNITS = 32;
export const APPROVED_METADATA_LEXICAL_COMPONENT_CAP = 900;
export const APPROVED_METADATA_LEXICAL_WEIGHTS = Object.freeze({
  topic: 300,
  description: 100,
  primaryLanguage: 100,
} as const);

export type ApprovedMetadataLexicalSource =
  'topic' | 'description' | 'primary-language';

export interface ApprovedMetadataLexicalMatchV1 {
  readonly normalizedTerm: string;
  readonly source: ApprovedMetadataLexicalSource;
  readonly points: number;
}

export type ApprovedMetadataLexicalScoreResultV1 =
  | {
      readonly ok: true;
      readonly channelVersion: typeof APPROVED_METADATA_LEXICAL_CHANNEL_VERSION;
      readonly candidateId: string;
      readonly componentScore: number;
      readonly matches: readonly ApprovedMetadataLexicalMatchV1[];
    }
  | {
      readonly ok: false;
      readonly issue:
        | 'invalid-authority'
        | 'authority-binding-mismatch'
        | 'unknown-candidate';
    };

export type ApprovedMetadataLexicalChannelCreationResultV1 =
  | {
      readonly ok: true;
      readonly channel: ApprovedMetadataLexicalChannelV1;
    }
  | {
      readonly ok: false;
      readonly issue: 'invalid-authority' | 'authority-binding-mismatch';
    };

export interface ApprovedMetadataLexicalChannelV1 {
  readonly channelVersion: typeof APPROVED_METADATA_LEXICAL_CHANNEL_VERSION;
  readonly candidateCount: number;
  readonly score: (
    candidateId: string,
    normalization: CapabilityQueryNormalizationResultV1,
  ) => ApprovedMetadataLexicalScoreResultV1;
}

export interface ApprovedMetadataLexicalAuthorityInputV1 {
  readonly metadataAuthority: unknown;
  readonly taxonomy: unknown;
  readonly retrievalExpansionAuthority: unknown;
  readonly expectedMetadataAuthorityBinding: ExpectedCandidateRetrievalMetadataAuthorityBindingV1;
  readonly expectedCandidates: readonly ExpectedCandidateRetrievalMetadataCandidateV1[];
}

export interface ExpectedCandidateRetrievalMetadataAuthorityBindingV1 {
  readonly authorityVersion: CandidateRetrievalMetadataAuthorityV1['authorityVersion'];
  readonly catalogVersion: string;
  readonly catalogDigest: string;
  readonly providerPolicyVersion: CandidateRetrievalMetadataAuthorityV1['providerPolicyVersion'];
  readonly providerPolicyDigest: string;
  readonly sourceProviderPolicyVersion: CandidateRetrievalMetadataAuthorityV1['sourceProviderPolicyVersion'];
  readonly sourceProviderPolicyDigest: string;
  readonly sourceOperation: CandidateRetrievalMetadataAuthorityV1['sourceOperation'];
}

export interface ExpectedCandidateRetrievalMetadataCandidateV1 {
  readonly candidateId: string;
  readonly catalogOwner: string;
  readonly catalogRepository: string;
}

/**
 * Prepares the reviewed sixth channel without activating it in the production
 * retrieval engine. All provider-derived text remains owned, inert data.
 */
export function createApprovedMetadataLexicalChannelV1(
  input: ApprovedMetadataLexicalAuthorityInputV1,
): ApprovedMetadataLexicalChannelCreationResultV1 {
  const metadata = parseCandidateRetrievalMetadataAuthorityV1(
    input.metadataAuthority,
  );
  const taxonomy = parseCapabilityTaxonomyV1(input.taxonomy);
  const expansion = parseCapabilityRetrievalExpansionV1(
    input.retrievalExpansionAuthority,
  );
  if (!metadata.ok || !taxonomy.ok || !expansion.ok) {
    return { ok: false, issue: 'invalid-authority' };
  }
  const expectedBinding = input.expectedMetadataAuthorityBinding;
  const expectedCandidates = expectedCandidatesById(input.expectedCandidates);
  if (
    !validExpectedBinding(expectedBinding) ||
    expectedCandidates === null ||
    metadata.value.authorityVersion !== expectedBinding.authorityVersion ||
    metadata.value.catalogVersion !== expectedBinding.catalogVersion ||
    metadata.value.catalogDigest !== expectedBinding.catalogDigest ||
    metadata.value.providerPolicyVersion !==
      expectedBinding.providerPolicyVersion ||
    metadata.value.providerPolicyDigest !==
      expectedBinding.providerPolicyDigest ||
    metadata.value.sourceProviderPolicyVersion !==
      expectedBinding.sourceProviderPolicyVersion ||
    metadata.value.sourceProviderPolicyDigest !==
      expectedBinding.sourceProviderPolicyDigest ||
    metadata.value.sourceOperation !== expectedBinding.sourceOperation ||
    taxonomy.value.taxonomyVersion !== expansion.value.taxonomyVersion ||
    taxonomy.value.semanticDigest !== expansion.value.taxonomySemanticDigest ||
    metadata.value.candidates.length !== input.expectedCandidates.length ||
    metadata.value.candidates.some((candidate) => {
      const expected = expectedCandidates.get(candidate.candidateId);
      return (
        expected === undefined ||
        catalogRepositoryIdentityKey(candidate) !==
          catalogRepositoryIdentityKey(expected)
      );
    })
  ) {
    return { ok: false, issue: 'authority-binding-mismatch' };
  }
  const records = new Map(
    metadata.value.candidates.map((record) => [record.candidateId, record]),
  );
  const aliasesByConcept = new Map<string, string[]>();
  for (const alias of taxonomy.value.resolvedAliases) {
    if (alias.status !== 'active') continue;
    const aliases = aliasesByConcept.get(alias.conceptId) ?? [];
    aliases.push(alias.aliasKey);
    aliasesByConcept.set(alias.conceptId, aliases);
  }
  const channel: ApprovedMetadataLexicalChannelV1 = Object.freeze({
    channelVersion: APPROVED_METADATA_LEXICAL_CHANNEL_VERSION,
    candidateCount: records.size,
    score: (
      candidateId: string,
      normalization: CapabilityQueryNormalizationResultV1,
    ): ApprovedMetadataLexicalScoreResultV1 => {
      const record = records.get(candidateId);
      if (record === undefined) {
        return { ok: false, issue: 'unknown-candidate' as const };
      }
      return scoreApprovedMetadataLexicalRecordV1(record, [
        ...queryTerms(normalization, aliasesByConcept, expansion.value),
      ]);
    },
  });
  return { ok: true, channel };
}

export function normalizeApprovedMetadataLexicalTerms(
  value: string,
): readonly string[] {
  const tokens = value
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .filter(
      (token) =>
        token.length > 0 &&
        token.length <= APPROVED_METADATA_LEXICAL_MAX_TOKEN_CODE_UNITS,
    );
  const terms: string[] = [];
  for (let start = 0; start < tokens.length; start += 1) {
    for (
      let length = 1;
      length <= APPROVED_METADATA_LEXICAL_MAX_NGRAM &&
      start + length <= tokens.length;
      length += 1
    ) {
      terms.push(tokens.slice(start, start + length).join('-'));
    }
  }
  return uniqueSorted(terms);
}

function queryTerms(
  normalization: CapabilityQueryNormalizationResultV1,
  aliasesByConcept: ReadonlyMap<string, readonly string[]>,
  expansion: Parameters<typeof expandRetrievalTermsV1>[1],
): ReadonlySet<string> {
  const conceptIds = uniqueSorted([
    ...normalization.normalizedCapabilityConcepts.map(
      ({ conceptId }) => conceptId,
    ),
    ...normalization.normalizedConstraints
      .filter(
        ({ modality, resolutionBasis, conceptId }) =>
          modality !== 'prohibited' &&
          resolutionBasis === 'controlled-taxonomy' &&
          conceptId !== null,
      )
      .flatMap(({ conceptId }) => (conceptId === null ? [] : [conceptId])),
  ]);
  const supplied = [
    ...conceptIds,
    ...conceptIds.flatMap((conceptId) => aliasesByConcept.get(conceptId) ?? []),
    ...normalization.normalizedConstraints
      .filter(
        ({ modality, resolutionBasis, canonicalTerm }) =>
          modality !== 'prohibited' &&
          resolutionBasis === 'controlled-taxonomy' &&
          canonicalTerm !== null,
      )
      .flatMap(({ canonicalTerm }) =>
        canonicalTerm === null ? [] : [canonicalTerm],
      ),
    ...expandRetrievalTermsV1(conceptIds, expansion).expandedTerms,
  ];
  return new Set(supplied.flatMap((term) => normalizeQueryAuthorityTerm(term)));
}

function normalizeQueryAuthorityTerm(value: string): readonly string[] {
  const tokens = value
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .filter(
      (token) =>
        token.length > 0 &&
        token.length <= APPROVED_METADATA_LEXICAL_MAX_TOKEN_CODE_UNITS,
    );
  return tokens.length > 0 &&
    tokens.length <= APPROVED_METADATA_LEXICAL_MAX_NGRAM
    ? [tokens.join('-')]
    : [];
}

export function scoreApprovedMetadataLexicalRecordV1(
  record: CandidateRetrievalMetadataRecordV1,
  normalizedQueryTerms: readonly string[],
): ApprovedMetadataLexicalScoreResultV1 {
  const query = new Set(
    normalizedQueryTerms.flatMap(normalizeQueryAuthorityTerm),
  );
  const candidateSources = new Map<string, ApprovedMetadataLexicalMatchV1>();
  addTerms(
    candidateSources,
    record.description,
    'description',
    APPROVED_METADATA_LEXICAL_WEIGHTS.description,
  );
  for (const topic of record.topics) {
    addTerms(
      candidateSources,
      topic,
      'topic',
      APPROVED_METADATA_LEXICAL_WEIGHTS.topic,
    );
  }
  if (record.primaryLanguage !== null) {
    addTerms(
      candidateSources,
      record.primaryLanguage,
      'primary-language',
      APPROVED_METADATA_LEXICAL_WEIGHTS.primaryLanguage,
    );
  }
  const matches = [...candidateSources.values()]
    .filter(({ normalizedTerm }) => query.has(normalizedTerm))
    .sort(
      (left, right) =>
        right.points - left.points ||
        compareAscii(left.normalizedTerm, right.normalizedTerm),
    );
  const capped: ApprovedMetadataLexicalMatchV1[] = [];
  let componentScore = 0;
  for (const match of matches) {
    if (
      componentScore + match.points >
      APPROVED_METADATA_LEXICAL_COMPONENT_CAP
    ) {
      continue;
    }
    capped.push(match);
    componentScore += match.points;
  }
  return Object.freeze({
    ok: true,
    channelVersion: APPROVED_METADATA_LEXICAL_CHANNEL_VERSION,
    candidateId: record.candidateId,
    componentScore,
    matches: Object.freeze(capped),
  });
}

function addTerms(
  target: Map<string, ApprovedMetadataLexicalMatchV1>,
  value: string | null,
  source: ApprovedMetadataLexicalSource,
  points: number,
): void {
  if (value === null) return;
  for (const normalizedTerm of normalizeApprovedMetadataLexicalTerms(value)) {
    const current = target.get(normalizedTerm);
    if (current === undefined || points > current.points) {
      target.set(normalizedTerm, { normalizedTerm, source, points });
    }
  }
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareAscii);
}

function expectedCandidatesById(
  candidates: readonly ExpectedCandidateRetrievalMetadataCandidateV1[],
): ReadonlyMap<string, ExpectedCandidateRetrievalMetadataCandidateV1> | null {
  const byId = new Map<string, ExpectedCandidateRetrievalMetadataCandidateV1>();
  const repositories = new Set<string>();
  for (const candidate of candidates) {
    const repositoryKey = catalogRepositoryIdentityKey(candidate);
    if (
      !/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/u.test(candidate.candidateId) ||
      !/^[A-Za-z0-9_.-]{1,100}$/u.test(candidate.catalogOwner) ||
      !/^[A-Za-z0-9_.-]{1,100}$/u.test(candidate.catalogRepository) ||
      byId.has(candidate.candidateId) ||
      repositories.has(repositoryKey)
    ) {
      return null;
    }
    byId.set(candidate.candidateId, candidate);
    repositories.add(repositoryKey);
  }
  return byId;
}

function validExpectedBinding(
  binding: ExpectedCandidateRetrievalMetadataAuthorityBindingV1,
): boolean {
  const safeVersion = /^[a-z0-9][a-z0-9./-]{0,127}$/u;
  const digest = /^[a-f0-9]{64}$/u;
  return (
    safeVersion.test(binding.authorityVersion) &&
    /^[a-z0-9](?:[a-z0-9.-]{0,62}[a-z0-9])?$/u.test(binding.catalogVersion) &&
    digest.test(binding.catalogDigest) &&
    safeVersion.test(binding.providerPolicyVersion) &&
    digest.test(binding.providerPolicyDigest) &&
    safeVersion.test(binding.sourceProviderPolicyVersion) &&
    digest.test(binding.sourceProviderPolicyDigest) &&
    safeVersion.test(binding.sourceOperation)
  );
}

function catalogRepositoryIdentityKey(candidate: {
  readonly catalogOwner: string;
  readonly catalogRepository: string;
}): string {
  return `${candidate.catalogOwner}/${candidate.catalogRepository}`.toLowerCase();
}

function compareAscii(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
