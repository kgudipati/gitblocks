import {
  CANDIDATE_RETRIEVAL_CHANNEL_BINDINGS,
  createCandidateRetrievalResultV1,
  parseCandidateRetrievalRequestV1,
  parseCapabilityTaxonomyV1,
  parseDeterministicCandidateProfileAuthorityV1,
  type CandidateRetrievalCandidateV1,
  type CandidateRetrievalChannelIdV1,
  type CandidateRetrievalChannelMatchV1,
  type CandidateRetrievalRequestV1,
  type CandidateRetrievalResultV1,
  type CapabilityTaxonomyV1,
} from '@gitblocks/contracts';
import {
  evaluateCandidateConstraints,
  type CandidateConstraintEvaluation,
  type CandidateConstraintEvaluationItem,
  type DeterministicCandidateProfile,
  type DeterministicCandidateProfileAuthority,
  type DeterministicProfileFieldId,
  type DeterministicProfileFieldRecord,
} from '@gitblocks/domain';

const CHANNEL_WEIGHTS = Object.freeze({
  capabilityFamilyPrimary: 200,
  capabilityFamilyAdditional: 25,
  taxonomyConcept: 400,
  candidateIdentity: 1_000,
  packageIdentity: 900,
  structuredProfile: 300,
});

const CONCEPT_SET_PROFILE_FIELDS = Object.freeze([
  'adoption-unit-type',
  'capability-variants-features',
  'required-infrastructure',
  'optional-infrastructure',
  'deployment-self-hosting',
] as const);

const STRUCTURED_PROFILE_FIELDS = Object.freeze([
  ...CONCEPT_SET_PROFILE_FIELDS,
  'repository-discovery-metadata',
  'language-ecosystem',
  'operational-complexity-primitives',
] as const);

export type CandidateRetrievalOperationIssueCodeV1 =
  | 'authority-binding-mismatch'
  | 'candidate-evaluation-failed'
  | 'invalid-profile-authority'
  | 'invalid-request'
  | 'invalid-taxonomy-authority'
  | 'normalization-authority-mismatch'
  | 'required-profile-field-unavailable'
  | 'result-construction-failed';

export interface CandidateRetrievalOperationIssueV1 {
  readonly code: CandidateRetrievalOperationIssueCodeV1;
  readonly path:
    'authority' | 'candidate-profiles' | 'request' | 'result' | 'taxonomy';
  readonly message:
    | 'Candidate constraint evaluation failed.'
    | 'Candidate profile authority is invalid.'
    | 'Candidate retrieval authority bindings disagree.'
    | 'Candidate retrieval request is invalid.'
    | 'Candidate retrieval result construction failed.'
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
  readonly candidateProfileAuthority: unknown;
}

export interface CandidateSearchView {
  readonly profile: DeterministicCandidateProfile;
  readonly candidateId: string;
  readonly catalogStatus: 'active' | 'archived' | 'moved' | 'negative-control';
  readonly primaryFamily: string;
  readonly additionalFamilies: readonly string[];
  readonly repositoryIdentity: string;
  readonly packageIdentity: string | null;
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
}

interface DeduplicationResult {
  readonly candidates: readonly ScoredCandidate[];
  readonly exactRepositoryIdentityGroups: number;
  readonly exactPackageIdentityGroups: number;
  readonly duplicatesRemoved: number;
}

export function createCandidateRetrievalEngineV1(
  input: CandidateRetrievalAuthorityInputV1,
): CandidateRetrievalEngineCreationResultV1 {
  const taxonomy = parseCapabilityTaxonomyV1(input.taxonomy);
  if (!taxonomy.ok) {
    return failure('invalid-taxonomy-authority', 'taxonomy');
  }
  const profiles = parseDeterministicCandidateProfileAuthorityV1(
    input.candidateProfileAuthority,
  );
  if (!profiles.ok) {
    return failure('invalid-profile-authority', 'candidate-profiles');
  }
  if (
    taxonomy.value.taxonomyVersion !== profiles.domain.taxonomyVersion ||
    taxonomy.value.semanticDigest !== profiles.domain.taxonomySemanticDigest
  ) {
    return failure('authority-binding-mismatch', 'authority');
  }

  let ownedTaxonomy: CapabilityTaxonomyV1;
  let ownedProfiles: DeterministicCandidateProfileAuthority;
  try {
    ownedTaxonomy = deepFreezeOwned(cloneOwned(taxonomy.value));
    ownedProfiles = deepFreezeOwned(cloneOwned(profiles.domain));
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
      ),
  } satisfies CandidateRetrievalEngineV1);
  return deepFreezeOwned({ ok: true, engine, issues: [] });
}

export function retrieveCandidateSet(
  suppliedRequest: unknown,
  taxonomy: CapabilityTaxonomyV1,
  authority: DeterministicCandidateProfileAuthority,
  candidates: readonly CandidateSearchView[],
  taxonomyConcepts: ReadonlyMap<
    string,
    CapabilityTaxonomyV1['concepts'][number]
  >,
  candidateIds: ReadonlySet<string>,
  constraintEvaluator: typeof evaluateCandidateConstraints = evaluateCandidateConstraints,
): CandidateRetrievalOperationResultV1 {
  const parsedRequest = parseCandidateRetrievalRequestV1(suppliedRequest);
  if (!parsedRequest.ok) return failure('invalid-request', 'request');
  const request = parsedRequest.value;
  if (!requestBindingsMatch(request, taxonomy, authority)) {
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
  const scored: ScoredCandidate[] = [];
  const constraintEvaluatedCandidateIds = new Set<string>();

  for (const candidate of candidates) {
    if (constraintEvaluatedCandidateIds.has(candidate.candidateId)) {
      return failure('candidate-evaluation-failed', 'candidate-profiles');
    }
    constraintEvaluatedCandidateIds.add(candidate.candidateId);
    const evaluated = constraintEvaluator({
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

    const evidence = executeRetrievalChannels(
      request,
      candidate,
      taxonomyConcepts,
    );
    candidateChannelMatches += evidence.length;
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
  authority: DeterministicCandidateProfileAuthority,
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
    request.authorityBindings.catalog.catalogDigest === authority.catalogDigest
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
    });
  }

  const candidateReferences =
    request.normalization.resolvedCandidateReferences.filter(
      (reference) =>
        reference.candidateId === candidate.candidateId &&
        reference.referenceKind !== 'npm-package',
    );
  if (candidateReferences.length > 0) {
    evidence.push({
      channelId: 'candidate-identity',
      componentScore: CHANNEL_WEIGHTS.candidateIdentity,
      matchedCapabilityConceptIds: [],
      matchedProfileFieldIds: ['repository-identity'],
    });
  }
  const packageReferences =
    request.normalization.resolvedCandidateReferences.filter(
      (reference) =>
        reference.candidateId === candidate.candidateId &&
        reference.referenceKind === 'npm-package',
    );
  if (packageReferences.length > 0 && candidate.packageIdentity !== null) {
    evidence.push({
      channelId: 'package-identity',
      componentScore: CHANNEL_WEIGHTS.packageIdentity,
      matchedCapabilityConceptIds: [],
      matchedProfileFieldIds: ['package-identity-mapping'],
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
  profile: DeterministicCandidateProfile,
): CandidateSearchView | null {
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
  for (const fieldId of CONCEPT_SET_PROFILE_FIELDS) {
    const field = knownField(profile, fieldId);
    if (field === null) continue;
    conceptsByField.set(fieldId, new Set(field.value.conceptIds));
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
    catalogStatus: status.value.catalogStatus,
    primaryFamily: family.value.primaryFamily,
    additionalFamilies: [...family.value.additionalFamilies].sort(compareAscii),
    repositoryIdentity:
      `${repository.value.githubOwner}/${repository.value.githubRepository}`.toLowerCase(),
    packageIdentity:
      packageMapping.value.mapping === 'mapped'
        ? packageMapping.value.packageName.toLowerCase()
        : null,
    conceptsByField,
  };
}

function knownField<Id extends DeterministicProfileFieldId>(
  profile: DeterministicCandidateProfile,
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
    'invalid-profile-authority': 'Candidate profile authority is invalid.',
    'invalid-request': 'Candidate retrieval request is invalid.',
    'invalid-taxonomy-authority': 'Capability taxonomy authority is invalid.',
    'normalization-authority-mismatch':
      'Normalization authority references are invalid.',
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
