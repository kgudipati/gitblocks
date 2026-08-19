import {
  CANDIDATE_RETRIEVAL_CHANNEL_BINDINGS,
  createCandidateRetrievalResultV1,
  parseCandidateRetrievalRequestV1,
  parseCapabilityRetrievalExpansionV1,
  parseCapabilityTaxonomyV1,
  parseDeterministicCandidateProfileAuthority,
  type CandidateRetrievalCandidateV1,
  type CandidateRetrievalChannelIdV1,
  type CandidateRetrievalChannelMatchV1,
  type CandidateRetrievalMetadataTermMatchV1,
  type CandidateRetrievalRequestV1,
  type CandidateRetrievalResultV1,
  type CapabilityRetrievalExpansionV1,
  type CapabilityTaxonomyV1,
} from '@gitblocks/contracts';
import {
  evaluateCandidateConstraintsV2,
  type evaluateCandidateConstraints,
  type CandidateConstraintEvaluation,
  type CandidateConstraintEvaluationItem,
  projectDeterministicCandidateProfileAuthorityToEvaluatorV2,
  projectDeterministicCandidateProfileV1ToEvaluatorV2,
  type DeterministicCandidateProfile,
  type DeterministicCandidateProfileEvaluatorAuthorityV2,
  type DeterministicCandidateProfileEvaluatorV2,
  type PublishedDeterministicCandidateProfileAuthority,
  type DeterministicProfileFieldId,
  type DeterministicProfileFieldRecord,
} from '@gitblocks/domain';

import {
  expandRetrievalTermsV1,
  type RetrievalTermExpansionV1,
} from './retrieval-expansion.ts';
import {
  createApprovedMetadataLexicalChannelV1,
  type ApprovedMetadataLexicalChannelV1,
  type ApprovedMetadataLexicalScoreResultV1,
  type ExpectedCandidateRetrievalMetadataAuthorityBindingV1,
} from './approved-metadata-lexical.ts';

const CHANNEL_WEIGHTS = Object.freeze({
  capabilityFamilyPrimary: 200,
  capabilityFamilyAdditional: 25,
  taxonomyConcept: 400,
  candidateIdentity: 1_000,
  candidateIdentityExpansionPerConcept: 100,
  packageIdentity: 900,
  packageIdentityExpansionPerConcept: 100,
  structuredProfile: 300,
});

const EMPTY_RETRIEVAL_EXPANSION: RetrievalTermExpansionV1 = Object.freeze({
  originalConceptIds: Object.freeze([]),
  expandedTerms: Object.freeze([]),
  edgesApplied: Object.freeze([]),
  edgesTruncated: 0,
});

const LEGACY_CONCEPT_SET_PROFILE_FIELDS = Object.freeze([
  'adoption-unit-type',
  'deployment-self-hosting',
] as const);

const STRUCTURED_PROFILE_FIELDS = Object.freeze([
  ...LEGACY_CONCEPT_SET_PROFILE_FIELDS,
  'capability-variants-features',
  'required-infrastructure',
  'optional-infrastructure',
  'repository-discovery-metadata',
  'language-ecosystem',
  'operational-complexity-primitives',
] as const);

export type CandidateRetrievalOperationIssueCodeV1 =
  | 'authority-binding-mismatch'
  | 'candidate-evaluation-failed'
  | 'invalid-expansion-authority'
  | 'invalid-metadata-authority'
  | 'invalid-profile-authority'
  | 'invalid-request'
  | 'invalid-taxonomy-authority'
  | 'normalization-authority-mismatch'
  | 'metadata-authority-binding-mismatch'
  | 'metadata-snapshot-mismatch'
  | 'required-profile-field-unavailable'
  | 'result-construction-failed';

export interface CandidateRetrievalOperationIssueV1 {
  readonly code: CandidateRetrievalOperationIssueCodeV1;
  readonly path:
    | 'authority'
    | 'candidate-profiles'
    | 'expansion'
    | 'metadata'
    | 'request'
    | 'result'
    | 'taxonomy';
  readonly message:
    | 'Candidate constraint evaluation failed.'
    | 'Candidate profile authority is invalid.'
    | 'Candidate retrieval authority bindings disagree.'
    | 'Candidate retrieval request is invalid.'
    | 'Candidate retrieval result construction failed.'
    | 'Capability retrieval expansion authority is invalid.'
    | 'Candidate retrieval metadata authority is invalid.'
    | 'Candidate retrieval metadata authority binding disagrees.'
    | 'Candidate retrieval metadata snapshot binding disagrees.'
    | 'Capability taxonomy authority is invalid.'
    | 'Normalization authority references are invalid.'
    | 'Required candidate profile identity field is unavailable.';
}

export type CandidateRetrievalOperationResultV1 =
  | {
      readonly ok: true;
      readonly result: CandidateRetrievalResultV1;
      readonly issues: readonly [];
    }
  | {
      readonly ok: false;
      readonly issues: readonly CandidateRetrievalOperationIssueV1[];
    };

export interface CandidateRetrievalEngineV1 {
  readonly candidateCount: number;
  readonly retrieve: (request: unknown) => CandidateRetrievalOperationResultV1;
}

export type CandidateRetrievalEngineCreationResultV1 =
  | {
      readonly ok: true;
      readonly engine: CandidateRetrievalEngineV1;
      readonly issues: readonly [];
    }
  | {
      readonly ok: false;
      readonly issues: readonly CandidateRetrievalOperationIssueV1[];
    };

export interface CandidateRetrievalAuthorityInputV1 {
  readonly taxonomy: unknown;
  readonly candidateProfileAuthority?: unknown;
  readonly candidateProfileEvaluatorAuthority?: DeterministicCandidateProfileEvaluatorAuthorityV2;
  readonly retrievalExpansionAuthority: unknown;
  readonly candidateRetrievalMetadataAuthority: unknown;
  readonly expectedCandidateRetrievalMetadataAuthorityBinding: ExpectedCandidateRetrievalMetadataAuthorityBindingV1;
}

export interface CandidateSearchView {
  readonly profile: DeterministicCandidateProfileEvaluatorV2;
  readonly candidateId: string;
  readonly displayName: string;
  readonly repository: {
    readonly host: 'github';
    readonly owner: string;
    readonly name: string;
  };
  readonly package: {
    readonly registry: 'npm';
    readonly name: string;
  } | null;
  readonly catalogStatus: 'active' | 'archived' | 'moved' | 'negative-control';
  readonly primaryFamily: string;
  readonly additionalFamilies: readonly string[];
  readonly repositoryIdentity: string;
  readonly catalogOwner: string;
  readonly catalogRepository: string;
  readonly packageIdentity: string | null;
  readonly candidateRepositoryIdentityTerms: ReadonlySet<string>;
  readonly packageIdentityTerms: ReadonlySet<string>;
  readonly conceptsByField: ReadonlyMap<
    DeterministicProfileFieldId,
    ReadonlySet<string>
  >;
}

export interface ScoredCandidate {
  readonly candidate: CandidateRetrievalCandidateV1;
  readonly repositoryIdentity: string;
  readonly packageIdentity: string | null;
}

export interface ChannelEvidence {
  readonly channelId: CandidateRetrievalChannelIdV1;
  readonly componentScore: number;
  readonly matchedCapabilityConceptIds: readonly string[];
  readonly matchedProfileFieldIds: readonly DeterministicProfileFieldId[];
  readonly matchedExpansionEdgeIds: readonly string[];
  readonly matchedMetadataTerms: readonly CandidateRetrievalMetadataTermMatchV1[];
}

interface DeduplicationResult {
  readonly candidates: readonly ScoredCandidate[];
  readonly exactRepositoryIdentityGroups: number;
  readonly exactPackageIdentityGroups: number;
  readonly duplicatesRemoved: number;
}

type ApprovedMetadataLexicalScoreSuccessV1 = Extract<
  ApprovedMetadataLexicalScoreResultV1,
  { readonly ok: true }
>;

export function createCandidateRetrievalEngineV1(
  input: CandidateRetrievalAuthorityInputV1,
): CandidateRetrievalEngineCreationResultV1 {
  const taxonomy = parseCapabilityTaxonomyV1(input.taxonomy);
  if (!taxonomy.ok) {
    return failure('invalid-taxonomy-authority', 'taxonomy');
  }
  const profiles =
    input.candidateProfileEvaluatorAuthority === undefined
      ? parseDeterministicCandidateProfileAuthority(
          input.candidateProfileAuthority,
        )
      : null;
  if (profiles !== null && !profiles.ok) {
    return failure('invalid-profile-authority', 'candidate-profiles');
  }
  const parsedProfileAuthority = profiles?.ok === true ? profiles.domain : null;
  const suppliedEvaluatorAuthority = input.candidateProfileEvaluatorAuthority;
  const profileTaxonomyVersion =
    suppliedEvaluatorAuthority?.taxonomyVersion ??
    profiles?.domain.taxonomyVersion;
  const profileTaxonomyDigest =
    suppliedEvaluatorAuthority?.taxonomySemanticDigest ??
    profiles?.domain.taxonomySemanticDigest;
  const expansion = parseCapabilityRetrievalExpansionV1(
    input.retrievalExpansionAuthority,
  );
  if (!expansion.ok) {
    return failure('invalid-expansion-authority', 'expansion');
  }
  if (
    taxonomy.value.taxonomyVersion !== profileTaxonomyVersion ||
    taxonomy.value.semanticDigest !== profileTaxonomyDigest ||
    taxonomy.value.taxonomyVersion !== expansion.value.taxonomyVersion ||
    taxonomy.value.semanticDigest !== expansion.value.taxonomySemanticDigest ||
    !expansionMatchesTaxonomy(expansion.value, taxonomy.value)
  ) {
    return failure('authority-binding-mismatch', 'authority');
  }

  let ownedTaxonomy: CapabilityTaxonomyV1;
  let ownedProfiles: DeterministicCandidateProfileEvaluatorAuthorityV2;
  let ownedExpansion: CapabilityRetrievalExpansionV1;
  let ownedExpectedMetadataBinding: ExpectedCandidateRetrievalMetadataAuthorityBindingV1;
  try {
    ownedTaxonomy = deepFreezeOwned(cloneOwned(taxonomy.value));
    if (suppliedEvaluatorAuthority === undefined) {
      if (parsedProfileAuthority === null) {
        return failure('invalid-profile-authority', 'candidate-profiles');
      }
      ownedProfiles =
        projectDeterministicCandidateProfileAuthorityToEvaluatorV2(
          parsedProfileAuthority,
        );
    } else {
      ownedProfiles = suppliedEvaluatorAuthority;
    }
    ownedExpansion = deepFreezeOwned(cloneOwned(expansion.value));
    ownedExpectedMetadataBinding = deepFreezeOwned(
      cloneOwned(input.expectedCandidateRetrievalMetadataAuthorityBinding),
    );
  } catch {
    return failure('invalid-profile-authority', 'candidate-profiles');
  }

  const searchViews: CandidateSearchView[] = [];
  for (const profile of ownedProfiles.profiles) {
    const view = createCandidateSearchView(profile);
    if (view === null) {
      return failure(
        'required-profile-field-unavailable',
        'candidate-profiles',
      );
    }
    searchViews.push(view);
  }
  searchViews.sort((left, right) =>
    compareAscii(left.candidateId, right.candidateId),
  );
  const frozenViews = deepFreezeOwned(searchViews);
  const metadataChannel = createApprovedMetadataLexicalChannelV1({
    metadataAuthority: input.candidateRetrievalMetadataAuthority,
    taxonomy: ownedTaxonomy,
    retrievalExpansionAuthority: ownedExpansion,
    expectedMetadataAuthorityBinding: ownedExpectedMetadataBinding,
    expectedCandidates: frozenViews.map(
      ({ candidateId, catalogOwner, catalogRepository }) => ({
        candidateId,
        catalogOwner,
        catalogRepository,
      }),
    ),
  });
  if (!metadataChannel.ok) {
    return metadataChannel.issue === 'invalid-authority'
      ? failure('invalid-metadata-authority', 'metadata')
      : failure('metadata-authority-binding-mismatch', 'metadata');
  }
  const taxonomyConcepts = new Map(
    ownedTaxonomy.concepts.map((concept) => [concept.conceptId, concept]),
  );
  const candidateIds = new Set(
    frozenViews.map(({ candidateId }) => candidateId),
  );

  const engine = deepFreezeOwned({
    candidateCount: frozenViews.length,
    retrieve: (suppliedRequest: unknown): CandidateRetrievalOperationResultV1 =>
      retrieveCandidateSet(
        suppliedRequest,
        ownedTaxonomy,
        ownedProfiles,
        frozenViews,
        taxonomyConcepts,
        candidateIds,
        ownedExpansion,
        metadataChannel.channel,
        evaluateCandidateConstraintsV2,
      ),
  } satisfies CandidateRetrievalEngineV1);
  return deepFreezeOwned({ ok: true, engine, issues: [] });
}

function expansionMatchesTaxonomy(
  expansion: CapabilityRetrievalExpansionV1,
  taxonomy: CapabilityTaxonomyV1,
): boolean {
  const conceptIds = new Set(
    taxonomy.concepts.map(({ conceptId }) => conceptId),
  );
  const activeAliases = new Set(
    taxonomy.resolvedAliases
      .filter(({ status }) => status === 'active')
      .map(({ aliasKey, conceptId }) => `${conceptId}\0${aliasKey}`),
  );
  return expansion.edges.every(
    ({ sourceConceptId, targetTerm, relationshipKind }) =>
      conceptIds.has(sourceConceptId) &&
      (relationshipKind !== 'taxonomy-alias' ||
        activeAliases.has(`${sourceConceptId}\0${targetTerm}`)),
  );
}

export function retrieveCandidateSet(
  suppliedRequest: unknown,
  taxonomy: CapabilityTaxonomyV1,
  authority:
    | DeterministicCandidateProfileEvaluatorAuthorityV2
    | PublishedDeterministicCandidateProfileAuthority,
  candidates: readonly CandidateSearchView[],
  taxonomyConcepts: ReadonlyMap<
    string,
    CapabilityTaxonomyV1['concepts'][number]
  >,
  candidateIds: ReadonlySet<string>,
  retrievalExpansionAuthority: CapabilityRetrievalExpansionV1,
  metadataChannel: ApprovedMetadataLexicalChannelV1,
  constraintEvaluator:
    | typeof evaluateCandidateConstraintsV2
    | typeof evaluateCandidateConstraints = evaluateCandidateConstraintsV2,
): CandidateRetrievalOperationResultV1 {
  const evaluatorAuthority =
    'runtimeAuthorityKind' in authority
      ? authority
      : projectDeterministicCandidateProfileAuthorityToEvaluatorV2(authority);
  const parsedRequest = parseCandidateRetrievalRequestV1(suppliedRequest);
  if (!parsedRequest.ok) return failure('invalid-request', 'request');
  const request = parsedRequest.value;
  if (
    request.authorityBindings.retrievalMetadata.authoritySemanticDigest !==
    metadataChannel.authorityBinding.authoritySemanticDigest
  ) {
    return failure('metadata-snapshot-mismatch', 'request');
  }
  if (
    !requestBindingsMatch(
      request,
      taxonomy,
      evaluatorAuthority,
      retrievalExpansionAuthority,
    )
  ) {
    return failure('authority-binding-mismatch', 'request');
  }
  if (
    !normalizationReferencesMatch(
      request,
      taxonomyConcepts,
      candidateIds,
      candidates,
    )
  ) {
    return failure('normalization-authority-mismatch', 'request');
  }

  const laneCounts = {
    eligible: 0,
    'evidence-needed': 0,
    excluded: 0,
  };
  let negativeControlsExcluded = 0;
  let candidateChannelMatches = 0;
  let candidateExpansionMatches = 0;
  const scored: ScoredCandidate[] = [];
  const constraintEvaluatedCandidateIds = new Set<string>();
  const expandedTerms = expandRetrievalTermsV1(
    expansionSourceConceptIds(request),
    retrievalExpansionAuthority,
  );

  for (const candidate of candidates) {
    if (constraintEvaluatedCandidateIds.has(candidate.candidateId)) {
      return failure('candidate-evaluation-failed', 'candidate-profiles');
    }
    constraintEvaluatedCandidateIds.add(candidate.candidateId);
    const evaluated = (
      constraintEvaluator as typeof evaluateCandidateConstraintsV2
    )({
      profile: candidate.profile,
      normalization: {
        outcome: request.normalization.outcome,
        taxonomyVersion: request.normalization.taxonomyVersion,
        taxonomySemanticDigest: request.normalization.taxonomySemanticDigest,
        primaryFamilyId: request.normalization.primaryFamilyId,
        normalizedConstraints: request.normalization.normalizedConstraints,
        preservedDeclarations: request.normalization.preservedDeclarations,
      },
    });
    if (!evaluated.ok) {
      return failure('candidate-evaluation-failed', 'candidate-profiles');
    }
    const negativeControl = candidate.catalogStatus === 'negative-control';
    const lane =
      evaluated.value.overallHardState === 'conflict' || negativeControl
        ? 'excluded'
        : evaluated.value.overallHardState === 'unresolved'
          ? 'evidence-needed'
          : 'eligible';
    laneCounts[lane] += 1;
    if (negativeControl) negativeControlsExcluded += 1;
    if (lane === 'excluded') continue;

    const metadataScore = metadataChannel.score(
      candidate.candidateId,
      request.normalization,
    );
    if (!metadataScore.ok) {
      return failure('metadata-authority-binding-mismatch', 'metadata');
    }

    const evidence = executeRetrievalChannels(
      request,
      candidate,
      taxonomyConcepts,
      expandedTerms,
      metadataScore,
    );
    candidateChannelMatches += evidence.length;
    candidateExpansionMatches += evidence.reduce(
      (sum, item) => sum + item.matchedExpansionEdgeIds.length,
      0,
    );
    if (evidence.length === 0) continue;
    const retrievalCandidate = createCandidateRecord(
      candidate,
      lane,
      evidence,
      evaluated.value,
    );
    scored.push({
      candidate: retrievalCandidate,
      repositoryIdentity: candidate.repositoryIdentity,
      packageIdentity: candidate.packageIdentity,
    });
  }

  const deduplicated = deduplicateExactIdentities(scored);
  const eligiblePool = deduplicated.candidates
    .filter(({ candidate }) => candidate.lane === 'eligible')
    .sort(compareScoredCandidates);
  const evidencePool = deduplicated.candidates
    .filter(({ candidate }) => candidate.lane === 'evidence-needed')
    .sort(compareScoredCandidates);
  const eligibleCandidates = eligiblePool
    .slice(0, request.eligibleResultLimit)
    .map(({ candidate }) => candidate)
    .filter(
      (
        candidate,
      ): candidate is Extract<
        CandidateRetrievalCandidateV1,
        { readonly lane: 'eligible' }
      > => candidate.lane === 'eligible',
    );
  const evidenceNeededCandidates = evidencePool
    .slice(0, request.evidenceNeededResultLimit)
    .map(({ candidate }) => candidate)
    .filter(
      (
        candidate,
      ): candidate is Extract<
        CandidateRetrievalCandidateV1,
        { readonly lane: 'evidence-needed' }
      > => candidate.lane === 'evidence-needed',
    );

  try {
    const result = createCandidateRetrievalResultV1({
      retrievalRequestId: request.retrievalRequestId,
      normalizationId: request.normalization.normalizationId,
      normalizationSemanticDigest: request.normalization.semanticDigest,
      authorityBindings: request.authorityBindings,
      channelBindings: CANDIDATE_RETRIEVAL_CHANNEL_BINDINGS.map((binding) => ({
        ...binding,
      })),
      eligibleResultLimit: request.eligibleResultLimit,
      evidenceNeededResultLimit: request.evidenceNeededResultLimit,
      preRetrievalLaneCounts: laneCounts,
      eligibleCandidates,
      evidenceNeededCandidates,
      diagnostics: {
        candidatesExamined: candidates.length,
        candidatesConstraintEvaluated: constraintEvaluatedCandidateIds.size,
        activeChannelCount: CANDIDATE_RETRIEVAL_CHANNEL_BINDINGS.length,
        candidateChannelMatches,
        negativeControlsExcluded,
        exactRepositoryIdentityGroups:
          deduplicated.exactRepositoryIdentityGroups,
        exactPackageIdentityGroups: deduplicated.exactPackageIdentityGroups,
        exactIdentityDuplicatesRemoved: deduplicated.duplicatesRemoved,
        eligibleCandidatesTruncated: Math.max(
          0,
          eligiblePool.length - eligibleCandidates.length,
        ),
        evidenceNeededCandidatesTruncated: Math.max(
          0,
          evidencePool.length - evidenceNeededCandidates.length,
        ),
        expansionSourceConcepts: new Set(
          expandedTerms.edgesApplied.map(
            ({ sourceConceptId }) => sourceConceptId,
          ),
        ).size,
        expansionEdgesApplied: expandedTerms.edgesApplied.length,
        expansionEdgesTruncated: expandedTerms.edgesTruncated,
        candidateExpansionMatches,
      },
    });
    return deepFreezeOwned({ ok: true, result, issues: [] });
  } catch {
    return failure('result-construction-failed', 'result');
  }
}

function requestBindingsMatch(
  request: CandidateRetrievalRequestV1,
  taxonomy: CapabilityTaxonomyV1,
  authority: DeterministicCandidateProfileEvaluatorAuthorityV2,
  retrievalExpansionAuthority: CapabilityRetrievalExpansionV1,
): boolean {
  return (
    request.authorityBindings.taxonomy.taxonomyVersion ===
      taxonomy.taxonomyVersion &&
    request.authorityBindings.taxonomy.taxonomySemanticDigest ===
      taxonomy.semanticDigest &&
    request.authorityBindings.candidateProfiles.semanticAuthorityDigest ===
      authority.semanticAuthorityDigest &&
    request.authorityBindings.catalog.catalogVersion ===
      authority.catalogVersion &&
    request.authorityBindings.catalog.catalogDigest ===
      authority.catalogDigest &&
    request.authorityBindings.retrievalExpansion.semanticDigest ===
      retrievalExpansionAuthority.semanticDigest
  );
}

function normalizationReferencesMatch(
  request: CandidateRetrievalRequestV1,
  taxonomyConcepts: ReadonlyMap<
    string,
    CapabilityTaxonomyV1['concepts'][number]
  >,
  candidateIds: ReadonlySet<string>,
  candidates: readonly CandidateSearchView[],
): boolean {
  for (const concept of request.normalization.normalizedCapabilityConcepts) {
    if (!taxonomyConcepts.has(concept.conceptId)) return false;
  }
  for (const constraint of request.normalization.normalizedConstraints) {
    if (
      constraint.conceptId !== null &&
      !taxonomyConcepts.has(constraint.conceptId)
    ) {
      return false;
    }
  }
  const candidateById = new Map(
    candidates.map((candidate) => [candidate.candidateId, candidate]),
  );
  for (const reference of request.normalization.resolvedCandidateReferences) {
    const candidate = candidateById.get(reference.candidateId);
    if (
      !candidateIds.has(reference.candidateId) ||
      candidate?.primaryFamily !== reference.capabilityFamily ||
      (reference.referenceKind === 'npm-package' &&
        candidate.packageIdentity === null)
    ) {
      return false;
    }
  }
  return true;
}

export function executeRetrievalChannels(
  request: CandidateRetrievalRequestV1,
  candidate: CandidateSearchView,
  taxonomyConcepts: ReadonlyMap<
    string,
    CapabilityTaxonomyV1['concepts'][number]
  >,
  expansion: RetrievalTermExpansionV1 = EMPTY_RETRIEVAL_EXPANSION,
  metadataScore?: ApprovedMetadataLexicalScoreSuccessV1,
): readonly ChannelEvidence[] {
  const evidence: ChannelEvidence[] = [];
  const primaryFamily = request.normalization.primaryFamilyId;
  if (primaryFamily === null) return evidence;

  const queryFamilies = new Set<string>([primaryFamily]);
  for (const normalized of request.normalization.normalizedCapabilityConcepts) {
    const concept = taxonomyConcepts.get(normalized.conceptId);
    concept?.applicableFamilyIds.forEach((family) => queryFamilies.add(family));
  }
  const additionalMatches = candidate.additionalFamilies.filter((family) =>
    queryFamilies.has(family),
  );
  if (
    candidate.primaryFamily === primaryFamily ||
    additionalMatches.length > 0
  ) {
    evidence.push({
      channelId: 'capability-family',
      componentScore:
        (candidate.primaryFamily === primaryFamily
          ? CHANNEL_WEIGHTS.capabilityFamilyPrimary
          : 0) +
        additionalMatches.length * CHANNEL_WEIGHTS.capabilityFamilyAdditional,
      matchedCapabilityConceptIds: uniqueSorted([
        ...(candidate.primaryFamily === primaryFamily ? [primaryFamily] : []),
        ...additionalMatches,
      ]),
      matchedProfileFieldIds: ['capability-family'],
      matchedExpansionEdgeIds: [],
      matchedMetadataTerms: [],
    });
  }

  const normalizedConceptIds =
    request.normalization.normalizedCapabilityConcepts.map(
      ({ conceptId }) => conceptId,
    );
  const taxonomyMatches = matchConceptsAcrossFields(
    normalizedConceptIds,
    candidate,
    STRUCTURED_PROFILE_FIELDS,
  );
  if (taxonomyMatches.concepts.length > 0) {
    evidence.push({
      channelId: 'taxonomy-concept',
      componentScore: Math.min(
        1_200,
        taxonomyMatches.concepts.length * CHANNEL_WEIGHTS.taxonomyConcept,
      ),
      matchedCapabilityConceptIds: taxonomyMatches.concepts,
      matchedProfileFieldIds: taxonomyMatches.fields,
      matchedExpansionEdgeIds: [],
      matchedMetadataTerms: [],
    });
  }

  const candidateReferences =
    request.normalization.resolvedCandidateReferences.filter(
      (reference) =>
        reference.candidateId === candidate.candidateId &&
        reference.referenceKind !== 'npm-package',
    );
  const repositoryExpansionMatches = matchExpansionTerms(
    expansion,
    candidate.candidateRepositoryIdentityTerms,
  );
  if (
    candidateReferences.length > 0 ||
    repositoryExpansionMatches.edgeIds.length > 0
  ) {
    evidence.push({
      channelId: 'candidate-identity',
      componentScore: Math.min(
        2_000,
        (candidateReferences.length > 0
          ? CHANNEL_WEIGHTS.candidateIdentity
          : 0) +
          repositoryExpansionMatches.sourceConceptIds.length *
            CHANNEL_WEIGHTS.candidateIdentityExpansionPerConcept,
      ),
      matchedCapabilityConceptIds: repositoryExpansionMatches.sourceConceptIds,
      matchedProfileFieldIds: ['repository-identity'],
      matchedExpansionEdgeIds: repositoryExpansionMatches.edgeIds,
      matchedMetadataTerms: [],
    });
  }
  const packageReferences =
    request.normalization.resolvedCandidateReferences.filter(
      (reference) =>
        reference.candidateId === candidate.candidateId &&
        reference.referenceKind === 'npm-package',
    );
  const packageExpansionMatches = matchExpansionTerms(
    expansion,
    candidate.packageIdentityTerms,
  );
  if (
    candidate.packageIdentity !== null &&
    (packageReferences.length > 0 || packageExpansionMatches.edgeIds.length > 0)
  ) {
    evidence.push({
      channelId: 'package-identity',
      componentScore: Math.min(
        2_000,
        (packageReferences.length > 0 ? CHANNEL_WEIGHTS.packageIdentity : 0) +
          packageExpansionMatches.sourceConceptIds.length *
            CHANNEL_WEIGHTS.packageIdentityExpansionPerConcept,
      ),
      matchedCapabilityConceptIds: packageExpansionMatches.sourceConceptIds,
      matchedProfileFieldIds: ['package-identity-mapping'],
      matchedExpansionEdgeIds: packageExpansionMatches.edgeIds,
      matchedMetadataTerms: [],
    });
  }

  const structuredConceptIds = request.normalization.normalizedConstraints
    .filter(
      ({ modality, resolutionBasis, conceptId }) =>
        modality !== 'prohibited' &&
        resolutionBasis === 'controlled-taxonomy' &&
        conceptId !== null,
    )
    .map(({ conceptId }) => conceptId)
    .filter((conceptId): conceptId is string => conceptId !== null);
  const structuredMatches = matchConceptsAcrossFields(
    structuredConceptIds,
    candidate,
    STRUCTURED_PROFILE_FIELDS,
  );
  if (structuredMatches.concepts.length > 0) {
    evidence.push({
      channelId: 'structured-profile',
      componentScore: Math.min(
        900,
        structuredMatches.concepts.length * CHANNEL_WEIGHTS.structuredProfile,
      ),
      matchedCapabilityConceptIds: structuredMatches.concepts,
      matchedProfileFieldIds: structuredMatches.fields,
      matchedExpansionEdgeIds: [],
      matchedMetadataTerms: [],
    });
  }
  if (metadataScore !== undefined && metadataScore.componentScore > 0) {
    evidence.push({
      channelId: 'approved-metadata-lexical',
      componentScore: metadataScore.componentScore,
      matchedCapabilityConceptIds: [],
      matchedProfileFieldIds: [],
      matchedExpansionEdgeIds: [],
      matchedMetadataTerms: metadataScore.matches.map(
        ({ normalizedTerm, source, points }) => ({
          normalizedTerm,
          source,
          points,
        }),
      ),
    });
  }
  return evidence.sort(
    (left, right) =>
      channelOrdinal(left.channelId) - channelOrdinal(right.channelId),
  );
}

function matchConceptsAcrossFields(
  queryConceptIds: readonly string[],
  candidate: CandidateSearchView,
  fieldIds: readonly DeterministicProfileFieldId[],
): {
  readonly concepts: readonly string[];
  readonly fields: readonly DeterministicProfileFieldId[];
} {
  const concepts = new Set<string>();
  const fields = new Set<DeterministicProfileFieldId>();
  for (const fieldId of fieldIds) {
    const values = candidate.conceptsByField.get(fieldId);
    if (values === undefined) continue;
    for (const conceptId of queryConceptIds) {
      if (values.has(conceptId)) {
        concepts.add(conceptId);
        fields.add(fieldId);
      }
    }
  }
  return {
    concepts: [...concepts].sort(compareAscii),
    fields: [...fields].sort(compareAscii),
  };
}

function createCandidateRecord(
  candidate: CandidateSearchView,
  lane: 'eligible' | 'evidence-needed',
  evidence: readonly ChannelEvidence[],
  evaluation: CandidateConstraintEvaluation,
): CandidateRetrievalCandidateV1 {
  const channelMatches: CandidateRetrievalChannelMatchV1[] = evidence.map(
    (item) => {
      const binding = CANDIDATE_RETRIEVAL_CHANNEL_BINDINGS.find(
        ({ channelId }) => channelId === item.channelId,
      );
      if (binding === undefined) throw new Error('Unknown retrieval channel.');
      return {
        channelId: item.channelId,
        channelVersion: binding.channelVersion,
        componentScore: item.componentScore,
        matchedCapabilityConceptIds: [...item.matchedCapabilityConceptIds],
        matchedProfileFieldIds: [...item.matchedProfileFieldIds],
        matchedExpansionEdgeIds: [...item.matchedExpansionEdgeIds],
        matchedMetadataTerms: item.matchedMetadataTerms.map((term) => ({
          ...term,
        })),
      };
    },
  );
  const matchedCapabilityConceptIds = uniqueSorted(
    channelMatches.flatMap(
      ({ matchedCapabilityConceptIds }) => matchedCapabilityConceptIds,
    ),
  );
  const matchedProfileFieldIds = uniqueSorted(
    channelMatches.flatMap(
      ({ matchedProfileFieldIds }) => matchedProfileFieldIds,
    ),
  );
  const common = {
    candidateId: candidate.candidateId,
    displayName: candidate.displayName,
    repository: candidate.repository,
    package: candidate.package,
    retrievalScore: channelMatches.reduce(
      (sum, { componentScore }) => sum + componentScore,
      0,
    ),
    matchedCapabilityConceptIds,
    matchedProfileFieldIds,
    channelMatches,
  };
  if (lane === 'eligible') {
    return { ...common, lane, unresolvedHardEvaluations: [] };
  }
  return {
    ...common,
    lane,
    unresolvedHardEvaluations: evaluation.evaluations
      .filter(isMaterialUnresolvedEvaluation)
      .map((item) => ({
        evaluationId: item.evaluationId,
        sourceKind: item.sourceKind,
        modality: item.modality,
        facet: item.facet,
        conceptId: item.conceptId,
        profileFieldId: item.profileFieldId,
        match: 'unresolved' as const,
        state: 'unresolved' as const,
        ruleId: item.ruleId,
      })),
  };
}

function isMaterialUnresolvedEvaluation(
  item: CandidateConstraintEvaluationItem,
): item is CandidateConstraintEvaluationItem & {
  readonly modality: 'required' | 'prohibited';
  readonly match: 'unresolved';
  readonly state: 'unresolved';
} {
  return (
    (item.modality === 'required' || item.modality === 'prohibited') &&
    item.match === 'unresolved' &&
    item.state === 'unresolved'
  );
}

export function deduplicateExactIdentities(
  scored: readonly ScoredCandidate[],
): DeduplicationResult {
  const eligible = deduplicateLaneExactIdentities(
    scored.filter(({ candidate }) => candidate.lane === 'eligible'),
  );
  const evidenceNeeded = deduplicateLaneExactIdentities(
    scored.filter(({ candidate }) => candidate.lane === 'evidence-needed'),
  );
  return {
    candidates: [...eligible.candidates, ...evidenceNeeded.candidates].sort(
      compareScoredCandidates,
    ),
    exactRepositoryIdentityGroups:
      eligible.exactRepositoryIdentityGroups +
      evidenceNeeded.exactRepositoryIdentityGroups,
    exactPackageIdentityGroups:
      eligible.exactPackageIdentityGroups +
      evidenceNeeded.exactPackageIdentityGroups,
    duplicatesRemoved:
      eligible.duplicatesRemoved + evidenceNeeded.duplicatesRemoved,
  };
}

function deduplicateLaneExactIdentities(
  scored: readonly ScoredCandidate[],
): DeduplicationResult {
  const parent = new Map(
    scored.map(({ candidate }) => [
      candidate.candidateId,
      candidate.candidateId,
    ]),
  );
  const byRepository = groupBy(
    scored,
    ({ repositoryIdentity }) => repositoryIdentity,
  );
  const byPackage = groupBy(
    scored.filter(({ packageIdentity }) => packageIdentity !== null),
    ({ packageIdentity }) => packageIdentity ?? '',
  );
  const unionGroup = (group: readonly ScoredCandidate[]): void => {
    const first = group[0]?.candidate.candidateId;
    if (first === undefined) return;
    for (const member of group.slice(1)) {
      union(parent, first, member.candidate.candidateId);
    }
  };
  byRepository.forEach(unionGroup);
  byPackage.forEach(unionGroup);
  const groups = new Map<string, ScoredCandidate[]>();
  for (const candidate of scored) {
    const root = findRoot(parent, candidate.candidate.candidateId);
    const group = groups.get(root) ?? [];
    group.push(candidate);
    groups.set(root, group);
  }
  const representatives = [...groups.values()]
    .map((group) => [...group].sort(compareScoredCandidates)[0])
    .filter((value): value is ScoredCandidate => value !== undefined);
  return {
    candidates: representatives.sort(compareScoredCandidates),
    exactRepositoryIdentityGroups: [...byRepository.values()].filter(
      (group) => group.length > 1,
    ).length,
    exactPackageIdentityGroups: [...byPackage.values()].filter(
      (group) => group.length > 1,
    ).length,
    duplicatesRemoved: scored.length - representatives.length,
  };
}

export function createCandidateSearchView(
  suppliedProfile:
    DeterministicCandidateProfileEvaluatorV2 | DeterministicCandidateProfile,
): CandidateSearchView | null {
  const profile = isEvaluatorProfile(suppliedProfile)
    ? suppliedProfile
    : projectDeterministicCandidateProfileV1ToEvaluatorV2(suppliedProfile);
  const status = knownField(profile, 'catalog-role-status');
  const family = knownField(profile, 'capability-family');
  const repository = knownField(profile, 'repository-identity');
  const packageMapping = knownField(profile, 'package-identity-mapping');
  if (
    status === null ||
    family === null ||
    repository === null ||
    packageMapping === null ||
    repository.value.candidateId !== profile.candidateId
  ) {
    return null;
  }
  const conceptsByField = new Map<
    DeterministicProfileFieldId,
    ReadonlySet<string>
  >();
  for (const fieldId of LEGACY_CONCEPT_SET_PROFILE_FIELDS) {
    const field = knownField(profile, fieldId);
    if (field === null) continue;
    conceptsByField.set(fieldId, new Set(field.value.conceptIds));
  }
  for (const fieldId of [
    'capability-variants-features',
    'required-infrastructure',
    'optional-infrastructure',
  ] as const) {
    const field = evaluatorField(profile, fieldId);
    if (field === null || field.legacyWholeFieldConflict !== undefined) {
      continue;
    }
    conceptsByField.set(
      fieldId,
      new Set(
        field.assertions
          .filter(({ state }) => state === 'present')
          .map(({ conceptId }) => conceptId),
      ),
    );
  }
  const discovery = knownField(profile, 'repository-discovery-metadata');
  if (discovery !== null) {
    conceptsByField.set(
      'repository-discovery-metadata',
      new Set([
        ...discovery.value.repositoryTopics,
        ...(discovery.value.primaryLanguage === null
          ? []
          : [discovery.value.primaryLanguage]),
      ]),
    );
  }
  const ecosystems = knownField(profile, 'language-ecosystem');
  if (ecosystems !== null) {
    conceptsByField.set(
      'language-ecosystem',
      new Set(ecosystems.value.ecosystems),
    );
  }
  const operations = knownField(profile, 'operational-complexity-primitives');
  if (operations !== null) {
    conceptsByField.set(
      'operational-complexity-primitives',
      new Set(operations.value.processRoles),
    );
  }
  return {
    profile,
    candidateId: profile.candidateId,
    displayName: repository.value.displayName,
    repository: {
      host: 'github',
      owner: repository.value.githubOwner,
      name: repository.value.githubRepository,
    },
    package:
      packageMapping.value.mapping === 'mapped'
        ? { registry: 'npm', name: packageMapping.value.packageName }
        : null,
    catalogStatus: status.value.catalogStatus,
    primaryFamily: family.value.primaryFamily,
    additionalFamilies: [...family.value.additionalFamilies].sort(compareAscii),
    catalogOwner: repository.value.githubOwner,
    catalogRepository: repository.value.githubRepository,
    repositoryIdentity:
      `${repository.value.githubOwner}/${repository.value.githubRepository}`.toLowerCase(),
    packageIdentity:
      packageMapping.value.mapping === 'mapped'
        ? packageMapping.value.packageName.toLowerCase()
        : null,
    candidateRepositoryIdentityTerms: identityTerms([
      profile.candidateId,
      repository.value.displayName,
      repository.value.githubOwner,
      repository.value.githubRepository,
    ]),
    packageIdentityTerms:
      packageMapping.value.mapping === 'mapped'
        ? identityTerms([packageMapping.value.packageName])
        : new Set<string>(),
    conceptsByField,
  };
}

function expansionSourceConceptIds(
  request: CandidateRetrievalRequestV1,
): readonly string[] {
  return uniqueSorted([
    ...request.normalization.normalizedCapabilityConcepts.map(
      ({ conceptId }) => conceptId,
    ),
    ...request.normalization.normalizedConstraints
      .filter(
        ({ modality, resolutionBasis, conceptId }) =>
          modality !== 'prohibited' &&
          resolutionBasis === 'controlled-taxonomy' &&
          conceptId !== null,
      )
      .map(({ conceptId }) => conceptId)
      .filter((conceptId): conceptId is string => conceptId !== null),
  ]);
}

function matchExpansionTerms(
  expansion: RetrievalTermExpansionV1,
  identityTermSet: ReadonlySet<string>,
): {
  readonly edgeIds: readonly string[];
  readonly sourceConceptIds: readonly string[];
} {
  const matchedEdges = expansion.edgesApplied.filter(({ targetTerm }) =>
    identityTermSet.has(targetTerm),
  );
  const directSourceConceptIds = expansion.originalConceptIds.filter(
    (conceptId) => identityTermSet.has(conceptId),
  );
  return {
    edgeIds: uniqueSorted(matchedEdges.map(({ edgeId }) => edgeId)),
    sourceConceptIds: uniqueSorted(
      directSourceConceptIds.concat(
        matchedEdges.map(({ sourceConceptId }) => sourceConceptId),
      ),
    ),
  };
}

function identityTerms(identities: readonly string[]): ReadonlySet<string> {
  const terms = new Set<string>();
  for (const identity of identities) {
    const tokens = identity
      .toLowerCase()
      .split(/[^a-z0-9]+/u)
      .filter((token) => token.length >= 2 && token.length <= 32);
    for (let start = 0; start < tokens.length; start += 1) {
      for (
        let length = 1;
        length <= 4 && start + length <= tokens.length;
        length += 1
      ) {
        terms.add(tokens.slice(start, start + length).join('-'));
      }
    }
  }
  return terms;
}

function knownField<Id extends DeterministicProfileFieldId>(
  profile: DeterministicCandidateProfileEvaluatorV2,
  fieldId: Id,
): Extract<
  DeterministicProfileFieldRecord<Id>,
  { readonly state: 'known' }
> | null {
  const field = profile.fields.find(
    (candidate) => candidate.fieldId === fieldId,
  ) as DeterministicProfileFieldRecord<Id> | undefined;
  return field?.state === 'known' ? field : null;
}

function evaluatorField<
  Id extends
    | 'capability-variants-features'
    | 'optional-infrastructure'
    | 'required-infrastructure',
>(
  profile: DeterministicCandidateProfileEvaluatorV2,
  fieldId: Id,
): Extract<
  DeterministicCandidateProfileEvaluatorV2['fields'][number],
  { readonly fieldId: Id }
> | null {
  const field = profile.fields.find(
    (candidate) => candidate.fieldId === fieldId,
  );
  return field?.fieldId === fieldId
    ? (field as Extract<
        DeterministicCandidateProfileEvaluatorV2['fields'][number],
        { readonly fieldId: Id }
      >)
    : null;
}

function isEvaluatorProfile(
  profile:
    DeterministicCandidateProfileEvaluatorV2 | DeterministicCandidateProfile,
): profile is DeterministicCandidateProfileEvaluatorV2 {
  const field = profile.fields.find(
    ({ fieldId }) => fieldId === 'capability-variants-features',
  );
  return field !== undefined && 'coverage' in field;
}

function groupBy<T>(
  values: readonly T[],
  key: (value: T) => string,
): ReadonlyMap<string, readonly T[]> {
  const groups = new Map<string, T[]>();
  for (const value of values) {
    const groupKey = key(value);
    const group = groups.get(groupKey) ?? [];
    group.push(value);
    groups.set(groupKey, group);
  }
  return groups;
}

function findRoot(parent: Map<string, string>, value: string): string {
  const next = parent.get(value);
  if (next === undefined || next === value) return value;
  const root = findRoot(parent, next);
  parent.set(value, root);
  return root;
}

function union(parent: Map<string, string>, left: string, right: string): void {
  const leftRoot = findRoot(parent, left);
  const rightRoot = findRoot(parent, right);
  if (leftRoot === rightRoot) return;
  const [first, second] = [leftRoot, rightRoot].sort(compareAscii);
  if (first !== undefined && second !== undefined) parent.set(second, first);
}

function compareScoredCandidates(
  left: ScoredCandidate,
  right: ScoredCandidate,
): number {
  return (
    right.candidate.retrievalScore - left.candidate.retrievalScore ||
    compareAscii(left.candidate.candidateId, right.candidate.candidateId)
  );
}

function channelOrdinal(channelId: CandidateRetrievalChannelIdV1): number {
  return CANDIDATE_RETRIEVAL_CHANNEL_BINDINGS.findIndex(
    (binding) => binding.channelId === channelId,
  );
}

function uniqueSorted<Value extends string>(values: readonly Value[]): Value[] {
  return [...new Set(values)].sort(compareAscii);
}

function failure(
  code: CandidateRetrievalOperationIssueCodeV1,
  path: CandidateRetrievalOperationIssueV1['path'],
): Extract<CandidateRetrievalOperationResultV1, { readonly ok: false }> {
  const messages: Record<
    CandidateRetrievalOperationIssueCodeV1,
    CandidateRetrievalOperationIssueV1['message']
  > = {
    'authority-binding-mismatch':
      'Candidate retrieval authority bindings disagree.',
    'candidate-evaluation-failed': 'Candidate constraint evaluation failed.',
    'invalid-expansion-authority':
      'Capability retrieval expansion authority is invalid.',
    'invalid-metadata-authority':
      'Candidate retrieval metadata authority is invalid.',
    'invalid-profile-authority': 'Candidate profile authority is invalid.',
    'invalid-request': 'Candidate retrieval request is invalid.',
    'invalid-taxonomy-authority': 'Capability taxonomy authority is invalid.',
    'normalization-authority-mismatch':
      'Normalization authority references are invalid.',
    'metadata-authority-binding-mismatch':
      'Candidate retrieval metadata authority binding disagrees.',
    'metadata-snapshot-mismatch':
      'Candidate retrieval metadata snapshot binding disagrees.',
    'required-profile-field-unavailable':
      'Required candidate profile identity field is unavailable.',
    'result-construction-failed':
      'Candidate retrieval result construction failed.',
  };
  return deepFreezeOwned({
    ok: false,
    issues: [{ code, path, message: messages[code] }],
  });
}

function deepFreezeOwned<T>(value: T): T {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) {
    return value;
  }
  if (value instanceof Map) {
    for (const [key, child] of value) {
      deepFreezeOwned(key);
      deepFreezeOwned(child);
    }
    return Object.freeze(value) as T;
  }
  if (value instanceof Set) {
    for (const child of value) deepFreezeOwned(child);
    return Object.freeze(value) as T;
  }
  for (const child of Object.values(value as Record<string, unknown>)) {
    deepFreezeOwned(child);
  }
  return Object.freeze(value);
}

function cloneOwned<T>(value: T): T {
  return cloneOwnedValue(value) as T;
}

function cloneOwnedValue(value: unknown): unknown {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value))
  ) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((child) => cloneOwnedValue(child));
  }
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [
        key,
        cloneOwnedValue(child),
      ]),
    );
  }
  throw new Error('Retrieval authority is not owned JSON data.');
}

function compareAscii(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
