import { createHash } from 'node:crypto';

import {
  repositoryArtifactDisplayUrl,
  splitRepositoryArtifactLogicalLines,
  type CandidateDossierV1,
  type CapabilityQueryInputV1,
  type CapabilityQueryNormalizationResultV1,
  type CapabilityRetrievalExpansionV1,
  type EvidenceObservationV1,
  type RecommendationRetrievalFinalistV1,
  type RepositoryFingerprintV1,
  type RepositoryArtifactChunkV1,
  type RepositoryArtifactSetV1,
  type RepositoryArtifactV1,
} from '@gitblocks/contracts';
import { expandRetrievalTermsV1 } from '@gitblocks/retrieval';

export const MAX_ARTIFACT_EVIDENCE_PER_EVALUATION = 2;
export const MAX_ARTIFACT_EVIDENCE_PER_CANDIDATE = 8;
export const MAX_ARTIFACT_EVIDENCE_PER_RECOMMENDATION = 32;

const MAX_DOSSIER_OBSERVATIONS = 100;
const MAX_RENDERED_EXCERPT_CODE_UNITS = 1_800;
const MAX_APPROVED_TERMS_PER_NEED = 40;
const MAX_SUCCESS_CONDITION_TERMS_PER_CONDITION = 12;
const ARTIFACT_EXCERPT_LIMITATION =
  'Whitespace is normalized from exact immutable repository lines; the linked commit and line range remain authoritative.';
const MARKDOWN_REFERENCE_DEFINITION =
  /^\[[^[\]\r\n]{1,200}\]: (?:<[^<>\s]+>|\S+)(?: (?:"[^"\r\n]*"|'[^'\r\n]*'|\([^()\r\n]*\)))?$/u;
const PURE_MARKDOWN_LINK_OR_IMAGE_LINE =
  /^(?:(?:[-*+]|\d{1,3}[.)]) )?(?:(?:\[!\[[^\]\r\n]*\]\([^\r\n)]*\)\]\([^\r\n)]*\)|!?\[[^\]\r\n]+\](?:\([^\r\n)]*\)|\[[^\]\r\n]*\])?)(?: )?)+$/u;
const LICENSE_OR_BOILERPLATE =
  /\b(?:all rights reserved|copyright|governing permissions and limitations|licensed? under|permission is hereby granted|spdx-license-identifier|terms and conditions|without warrant(?:y|ies))\b/iu;
const DEFINING_STATEMENT_FORM =
  /\b(?:allows?|blocks?|built-in|comes? with|defaults? to|ensures?|includes?|is|offers?|prevents?|provides?|requires?|strategy|supports?|uses?|works? with)\b|\bapi\b/iu;
const ELIGIBLE_INTEGRATION_TERMS = Object.freeze([
  'application route',
  'configure',
  'configuration',
  'installation',
  'integrate',
  'integration',
  'middleware',
  'plugin',
  'request handler',
  'route handler',
]);
const ELIGIBLE_OPERATIONAL_TERMS = Object.freeze([
  'cluster',
  'connection',
  'control plane',
  'credential',
  'database/store',
  'database',
  'data store',
  'datastore',
  'dependency',
  'distributed',
  'environment variable',
  'external service',
  'failover',
  'fallback',
  'in-memory',
  'latency',
  'memory store',
  'postgres',
  'postgresql',
  'redis',
  'self-hosted',
  'serverless',
  'timeout',
  'worker process',
]);
const ELIGIBLE_UNAVAILABLE_STATE_EVIDENCE_TERMS = Object.freeze([
  'database/store is down',
  'failover',
  'fallback',
  'insurance',
  'insurance strategy',
  'pass on store error',
  'passonstoreerror',
  'skip on error',
  'skiponerror',
  'store error',
  'store is down',
  'store unavailable',
]);
const SUCCESS_CONDITION_STOP_WORDS = new Set([
  'all',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'been',
  'being',
  'by',
  'can',
  'each',
  'every',
  'for',
  'from',
  'has',
  'have',
  'in',
  'into',
  'is',
  'it',
  'its',
  'must',
  'of',
  'on',
  'or',
  'record',
  'records',
  'should',
  'that',
  'the',
  'their',
  'this',
  'to',
  'with',
]);
const SUCCESS_CONDITION_LEXICAL_ALIASES: Readonly<
  Record<
    string,
    readonly {
      readonly value: string;
      readonly specificity: 1 | 2;
    }[]
  >
> = Object.freeze({
  actor: Object.freeze([
    Object.freeze({ value: 'authenticated user', specificity: 1 }),
    Object.freeze({ value: 'req.username', specificity: 1 }),
    Object.freeze({ value: 'user authenticated', specificity: 1 }),
    Object.freeze({ value: 'remote user', specificity: 2 }),
    Object.freeze({ value: 'remote-user', specificity: 2 }),
    Object.freeze({ value: 'username', specificity: 2 }),
  ]),
  actors: Object.freeze([
    Object.freeze({ value: 'authenticated user', specificity: 1 }),
    Object.freeze({ value: 'req.username', specificity: 1 }),
    Object.freeze({ value: 'user authenticated', specificity: 1 }),
    Object.freeze({ value: 'remote user', specificity: 2 }),
    Object.freeze({ value: 'remote-user', specificity: 2 }),
    Object.freeze({ value: 'username', specificity: 2 }),
  ]),
  structured: Object.freeze([
    Object.freeze({ value: 'json log', specificity: 1 }),
    Object.freeze({ value: 'json logging', specificity: 1 }),
    Object.freeze({ value: 'key value', specificity: 1 }),
    Object.freeze({ value: 'key-value', specificity: 1 }),
    Object.freeze({ value: 'json', specificity: 2 }),
  ]),
});

const PROHIBITION_ALTERNATIVE_EVIDENCE_TERMS: Readonly<
  Record<string, readonly string[]>
> = Object.freeze({
  redis: Object.freeze([
    'built-in memory store',
    'file-based policy',
    'in-memory store',
    'memory limiter',
    'policy file',
    'postgresql',
    'prisma',
    'sqlite',
  ]),
  'external-hosted-service': Object.freeze([
    'on-prem',
    'on premises',
    'run locally',
    'self hosted',
    'self-hosted',
  ]),
  'separate-control-plane': Object.freeze([
    'application process',
    'built-in',
    'embedded',
    'in-process',
    'local library',
  ]),
});

export interface LoadedCandidateRepositoryArtifactV1 {
  readonly artifact: RepositoryArtifactV1;
  readonly chunks: readonly RepositoryArtifactChunkV1[];
}

export interface CandidateRepositoryArtifactMaterialV1 {
  readonly artifactSet: RepositoryArtifactSetV1;
  readonly artifacts: readonly LoadedCandidateRepositoryArtifactV1[];
}

export interface CandidateArtifactMaterialLoaderPort {
  readonly loadCandidateRepositoryArtifactMaterial: (input: {
    readonly candidateId: string;
    readonly expectedCatalogVersion: 'public-v1';
    readonly expectedCatalogDigest: string;
    readonly commitSha: string;
    readonly evidenceCutoff: string;
  }) => Promise<CandidateRepositoryArtifactMaterialV1 | null>;
}

interface ApprovedTerm {
  readonly value: string;
  readonly precedence: 0 | 1;
  readonly specificity: 0 | 1 | 2 | 3;
  readonly searchKind: 'evaluation' | 'prohibition-alternative';
  readonly coverageKeys?: readonly string[];
  readonly requiresLexicalBoundaries?: boolean;
}

interface MatchingLine {
  readonly artifact: RepositoryArtifactV1;
  readonly chunk: RepositoryArtifactChunkV1;
  readonly entryOrdinal: number;
  readonly lineNumber: number;
  readonly normalizedExcerpt: string;
  readonly boilerplatePenalty: 0 | 1;
  readonly specificityPenalty: 0 | 1 | 2 | 3;
  readonly definingStatementPenalty: 0 | 1;
  readonly markdownContextPenalty: 0 | 1 | 2 | 3;
  readonly termPrecedence: 0 | 1;
  readonly matchOffset: number;
  readonly matchedTerm: string;
  readonly matchesEvaluationTerm: boolean;
  readonly matchesProhibitionAlternative: boolean;
  readonly coverageKeys: readonly string[];
}

interface ArtifactEvidenceNeed {
  readonly dimension: EvidenceObservationV1['dimension'];
  readonly terms: readonly ApprovedTerm[];
  readonly balanceProhibitionEvidence: boolean;
  readonly priorityTerms?: readonly string[];
  readonly balanceCoverage?: boolean;
}

export function selectCandidateArtifactEvidenceV1(input: {
  readonly finalist: RecommendationRetrievalFinalistV1;
  readonly dossier: CandidateDossierV1;
  readonly capabilityQuery: CapabilityQueryInputV1;
  readonly normalization: CapabilityQueryNormalizationResultV1;
  readonly repositoryFingerprint: RepositoryFingerprintV1;
  readonly retrievalExpansionAuthority: CapabilityRetrievalExpansionV1;
  readonly material: CandidateRepositoryArtifactMaterialV1;
  readonly maximumObservations: number;
}): readonly EvidenceObservationV1[] {
  if (
    input.finalist.candidateId !== input.dossier.identity.candidateId ||
    input.normalization.outcome !== 'normalized'
  ) {
    return Object.freeze([]);
  }
  const head = usableRepositoryHead(input.dossier);
  if (
    head === null ||
    !materialMatchesHead(input.material, input.finalist.candidateId, head)
  ) {
    return Object.freeze([]);
  }
  const requestedCapacity = Number.isInteger(input.maximumObservations)
    ? input.maximumObservations
    : 0;
  const capacity = Math.max(
    0,
    Math.min(
      MAX_ARTIFACT_EVIDENCE_PER_CANDIDATE,
      requestedCapacity,
      MAX_DOSSIER_OBSERVATIONS - input.dossier.observations.length,
    ),
  );
  if (capacity === 0) return Object.freeze([]);

  const observations: EvidenceObservationV1[] = [];
  const suppliedEvidenceIds = new Set(
    input.dossier.observations.map(({ evidenceId }) => evidenceId),
  );
  const needs: readonly ArtifactEvidenceNeed[] =
    input.finalist.lane === 'evidence-needed'
      ? input.finalist.unresolvedHardEvaluations.map((evaluation) => ({
          dimension: evidenceDimensionForFacet(evaluation.facet),
          terms: approvedTermsForEvaluation({
            evaluation,
            capabilityQuery: input.capabilityQuery,
            normalization: input.normalization,
            retrievalExpansionAuthority: input.retrievalExpansionAuthority,
          }),
          balanceProhibitionEvidence: evaluation.modality === 'prohibited',
        }))
      : approvedEligibleFitNeeds({
          capabilityQuery: input.capabilityQuery,
          normalization: input.normalization,
          repositoryFingerprint: input.repositoryFingerprint,
          retrievalExpansionAuthority: input.retrievalExpansionAuthority,
        });
  for (const need of needs) {
    if (observations.length >= capacity) break;
    if (need.terms.length === 0) continue;
    let selectedForNeed = 0;
    const matches = matchingLines(input.material, need.terms);
    const orderedMatches = need.balanceProhibitionEvidence
      ? balanceProhibitionEvidence(matches)
      : need.balanceCoverage === true
        ? balanceCoverageEvidence(matches)
        : need.priorityTerms === undefined || need.priorityTerms.length === 0
          ? matches
          : balancePriorityEvidence(matches, need.priorityTerms);
    for (const match of orderedMatches) {
      if (
        observations.length >= capacity ||
        selectedForNeed >= MAX_ARTIFACT_EVIDENCE_PER_EVALUATION
      ) {
        break;
      }
      const evidence = evidenceFromMatch(
        input.finalist.candidateId,
        need.dimension,
        head,
        input.material.artifactSet.commitObjectId,
        match,
      );
      selectedForNeed += 1;
      if (suppliedEvidenceIds.has(evidence.evidenceId)) continue;
      suppliedEvidenceIds.add(evidence.evidenceId);
      observations.push(evidence);
    }
  }
  return Object.freeze(observations);
}

function approvedEligibleFitNeeds(input: {
  readonly capabilityQuery: CapabilityQueryInputV1;
  readonly normalization: CapabilityQueryNormalizationResultV1;
  readonly repositoryFingerprint: RepositoryFingerprintV1;
  readonly retrievalExpansionAuthority: CapabilityRetrievalExpansionV1;
}): readonly ArtifactEvidenceNeed[] {
  const { primaryFamilyId } = input.normalization;
  if (
    input.normalization.outcome !== 'normalized' ||
    primaryFamilyId === null
  ) {
    return Object.freeze([]);
  }
  const capabilityConcepts = uniqueTerms([
    primaryFamilyId,
    ...input.normalization.normalizedCapabilityConcepts.map(
      ({ conceptId }) => conceptId,
    ),
  ]);
  const capabilityPrimary = eligibleTermVariants([
    ...capabilityConcepts,
    ...input.capabilityQuery.capabilityTerms.map(
      ({ originalTerm }) => originalTerm,
    ),
    ...input.capabilityQuery.draftConstraints
      .filter(
        ({ facetHint }) =>
          facetHint === 'capability' || facetHint === 'feature',
      )
      .map(({ originalTerm }) => originalTerm),
  ]);
  const capabilityExpansion = capabilityConcepts.flatMap((conceptId) =>
    expandRetrievalTermsV1(
      [conceptId],
      input.retrievalExpansionAuthority,
    ).edgesApplied.flatMap(({ relationshipKind, targetTerm }) =>
      eligibleTermVariants([targetTerm]).map((value) => ({
        value,
        specificity:
          relationshipKind === 'taxonomy-alias' ? (1 as const) : (3 as const),
      })),
    ),
  );

  const targetTerms = eligibleTermVariants([
    ...input.normalization.preservedDeclarations
      .filter(({ facet }) =>
        [
          'architecture',
          'deployment',
          'ecosystem',
          'framework',
          'runtime',
        ].includes(facet),
      )
      .map(({ originalTerm }) => originalTerm),
    ...repositoryFingerprintComponentTerms(input.repositoryFingerprint),
    ...approvedTermsPresentInSuccessConditions(
      input.capabilityQuery,
      ELIGIBLE_INTEGRATION_TERMS,
    ),
  ]);
  const operationalTerms = eligibleTermVariants([
    ...input.normalization.preservedDeclarations
      .filter(({ facet }) =>
        ['architecture', 'datastore', 'deployment', 'infrastructure'].includes(
          facet,
        ),
      )
      .map(({ originalTerm }) => originalTerm),
    ...repositoryFingerprintOperationalTerms(input.repositoryFingerprint),
    ...approvedTermsPresentInSuccessConditions(
      input.capabilityQuery,
      ELIGIBLE_OPERATIONAL_TERMS,
    ),
    ...unavailableStateEvidenceTerms(input.capabilityQuery),
  ]);
  const unavailableStateTerms = unavailableStateEvidenceTerms(
    input.capabilityQuery,
  );
  const successConditionNeed = approvedSuccessConditionNeed(
    input.capabilityQuery,
    capabilityConcepts,
  );

  return Object.freeze([
    Object.freeze({
      dimension: 'integration' as const,
      terms: approvedFitTerms(capabilityPrimary, capabilityExpansion),
      balanceProhibitionEvidence: false,
    }),
    Object.freeze({
      dimension: 'runtime-framework' as const,
      terms: approvedFitTerms(
        targetTerms,
        ELIGIBLE_INTEGRATION_TERMS.map((value) => ({
          value,
          specificity: 3 as const,
        })),
      ),
      balanceProhibitionEvidence: false,
    }),
    Object.freeze({
      dimension: 'deployment' as const,
      terms: approvedFitTerms(
        operationalTerms,
        ELIGIBLE_OPERATIONAL_TERMS.map((value) => ({
          value,
          specificity: 3 as const,
        })),
      ),
      balanceProhibitionEvidence: false,
      priorityTerms: unavailableStateTerms,
    }),
    successConditionNeed,
  ]);
}

function approvedSuccessConditionNeed(
  capabilityQuery: CapabilityQueryInputV1,
  capabilityConcepts: readonly string[],
): ArtifactEvidenceNeed {
  const ignoredTerms = new Set(
    uniqueTerms([
      ...capabilityConcepts,
      ...capabilityQuery.capabilityTerms.map(
        ({ originalTerm }) => originalTerm,
      ),
    ]).flatMap((value) => successConditionWords(value)),
  );
  const conditions = [...capabilityQuery.successConditions].sort(
    (left, right) => compareAscii(left.conditionId, right.conditionId),
  );
  const termsByCondition = conditions.map(({ conditionId, statement }) => ({
    conditionId,
    terms: approvedTermsForSuccessCondition(
      conditionId,
      statement,
      ignoredTerms,
    ),
  }));
  const selectedTerms: ApprovedTerm[] = [];
  for (
    let ordinal = 0;
    selectedTerms.length < MAX_APPROVED_TERMS_PER_NEED;
    ordinal += 1
  ) {
    let added = false;
    for (const { terms } of termsByCondition) {
      const term = terms[ordinal];
      if (term === undefined) continue;
      selectedTerms.push(term);
      added = true;
      if (selectedTerms.length >= MAX_APPROVED_TERMS_PER_NEED) break;
    }
    if (!added) break;
  }
  return Object.freeze({
    dimension: 'integration',
    terms: mergeSuccessConditionTerms(selectedTerms),
    balanceProhibitionEvidence: false,
    balanceCoverage: true,
  });
}

function approvedTermsForSuccessCondition(
  conditionId: string,
  statement: string,
  ignoredTerms: ReadonlySet<string>,
): readonly ApprovedTerm[] {
  const words = successConditionWords(statement).filter(
    (word) =>
      !SUCCESS_CONDITION_STOP_WORDS.has(word) && !ignoredTerms.has(word),
  );
  const directValues = uniqueTerms([
    ...words.flatMap((_, index) => {
      const values: string[] = [];
      const pair = words.slice(index, index + 2);
      const triple = words.slice(index, index + 3);
      if (pair.length === 2) values.push(pair.join(' '));
      if (triple.length === 3) values.push(triple.join(' '));
      return values;
    }),
    ...words,
  ]);
  const directTerms = directValues.map((value) => ({
    value,
    precedence: 0 as const,
    specificity: value.includes(' ') ? (0 as const) : (2 as const),
    searchKind: 'evaluation' as const,
    coverageKeys: Object.freeze([conditionId]),
    requiresLexicalBoundaries: true,
  }));
  const aliases = uniqueSuccessConditionAliases(words).map(
    ({ specificity, value }) => ({
      value,
      precedence: 1 as const,
      specificity,
      searchKind: 'evaluation' as const,
      coverageKeys: Object.freeze([conditionId]),
      requiresLexicalBoundaries: true,
    }),
  );
  return Object.freeze(
    [...directTerms, ...aliases]
      .sort(compareSuccessConditionTerms)
      .slice(0, MAX_SUCCESS_CONDITION_TERMS_PER_CONDITION),
  );
}

function successConditionWords(value: string): readonly string[] {
  return canonicalSearchText(value).match(/[a-z0-9]+/gu) ?? Object.freeze([]);
}

function uniqueSuccessConditionAliases(
  words: readonly string[],
): readonly { readonly value: string; readonly specificity: 1 | 2 }[] {
  const aliases = new Map<
    string,
    { readonly value: string; readonly specificity: 1 | 2 }
  >();
  for (const word of new Set(words)) {
    for (const alias of SUCCESS_CONDITION_LEXICAL_ALIASES[word] ?? []) {
      const key = lower(alias.value);
      const existing = aliases.get(key);
      if (
        existing === undefined ||
        alias.specificity < existing.specificity ||
        (alias.specificity === existing.specificity &&
          compareAscii(alias.value, existing.value) < 0)
      ) {
        aliases.set(key, alias);
      }
    }
  }
  return [...aliases.values()].sort(
    (left, right) =>
      left.specificity - right.specificity ||
      compareAscii(left.value, right.value),
  );
}

function compareSuccessConditionTerms(
  left: ApprovedTerm,
  right: ApprovedTerm,
): number {
  return (
    left.specificity - right.specificity ||
    left.precedence - right.precedence ||
    compareAscii(left.value, right.value)
  );
}

function mergeSuccessConditionTerms(
  terms: readonly ApprovedTerm[],
): readonly ApprovedTerm[] {
  const merged = new Map<string, ApprovedTerm>();
  for (const term of terms) {
    const key = lower(term.value);
    const existing = merged.get(key);
    if (existing === undefined) {
      merged.set(key, term);
      continue;
    }
    const preferred =
      compareSuccessConditionTerms(term, existing) < 0 ? term : existing;
    merged.set(key, {
      ...preferred,
      coverageKeys: Object.freeze(
        uniqueTerms([
          ...(existing.coverageKeys ?? []),
          ...(term.coverageKeys ?? []),
        ]),
      ),
    });
  }
  return Object.freeze([...merged.values()].sort(compareSuccessConditionTerms));
}

function unavailableStateEvidenceTerms(
  capabilityQuery: CapabilityQueryInputV1,
): readonly string[] {
  const successText = capabilityQuery.successConditions
    .map(({ statement }) => canonicalSearchText(statement))
    .join(' ');
  return /\b(?:database|limiter|state|storage|store)\b/u.test(successText) &&
    /\b(?:down|fails?|failure|unavailable)\b/u.test(successText)
    ? ELIGIBLE_UNAVAILABLE_STATE_EVIDENCE_TERMS
    : Object.freeze([]);
}

function approvedFitTerms(
  primary: readonly string[],
  secondary: readonly {
    readonly value: string;
    readonly specificity: 1 | 2 | 3;
  }[],
): readonly ApprovedTerm[] {
  const primaryTerms = uniqueTerms(primary).map((value) => ({
    value,
    precedence: 0 as const,
    specificity: 0 as const,
    searchKind: 'evaluation' as const,
  }));
  const primaryKeys = new Set(primaryTerms.map(({ value }) => lower(value)));
  const secondaryByNormalized = new Map<
    string,
    { readonly value: string; readonly specificity: 1 | 2 | 3 }
  >();
  for (const term of secondary) {
    const key = lower(term.value);
    if (primaryKeys.has(key)) continue;
    const existing = secondaryByNormalized.get(key);
    if (
      existing === undefined ||
      term.specificity < existing.specificity ||
      (term.specificity === existing.specificity &&
        compareAscii(term.value, existing.value) < 0)
    ) {
      secondaryByNormalized.set(key, term);
    }
  }
  const secondaryTerms = [...secondaryByNormalized.values()].map(
    ({ specificity, value }) => ({
      value,
      precedence: 1 as const,
      specificity,
      searchKind: 'evaluation' as const,
    }),
  );
  return Object.freeze(
    [...primaryTerms, ...secondaryTerms]
      .sort(compareApprovedTerms)
      .slice(0, MAX_APPROVED_TERMS_PER_NEED),
  );
}

function compareApprovedTerms(left: ApprovedTerm, right: ApprovedTerm): number {
  return (
    left.precedence - right.precedence ||
    left.specificity - right.specificity ||
    compareAscii(left.value, right.value)
  );
}

function repositoryFingerprintComponentTerms(
  fingerprint: RepositoryFingerprintV1,
): readonly string[] {
  return fingerprint.facts.flatMap((fact) =>
    fact.kind === 'component' &&
    fact.component !== 'dependency' &&
    fact.component !== 'package-manager'
      ? componentTermVariants(fact.name)
      : [],
  );
}

function repositoryFingerprintOperationalTerms(
  fingerprint: RepositoryFingerprintV1,
): readonly string[] {
  return fingerprint.facts.flatMap((fact) => {
    if (
      fact.kind === 'component' &&
      (fact.component === 'database' || fact.component === 'orm')
    ) {
      return componentTermVariants(fact.name);
    }
    if (fact.kind === 'deployment') {
      return fact.topology === 'long-running-container'
        ? ['container', 'long-running container']
        : fact.topology === 'long-running-server'
          ? ['long-running server', 'server']
          : ['serverless'];
    }
    return [];
  });
}

function componentTermVariants(value: string): readonly string[] {
  switch (lower(value)) {
    case 'next':
    case 'next.js':
    case 'nextjs':
      return ['next.js', 'nextjs'];
    case 'node':
    case 'node.js':
    case 'nodejs':
      return ['node.js', 'nodejs'];
    case 'postgres':
    case 'postgresql':
      return ['postgres', 'postgresql'];
    default:
      return value.length >= 3 ? [value] : [];
  }
}

function approvedTermsPresentInSuccessConditions(
  capabilityQuery: CapabilityQueryInputV1,
  approvedTerms: readonly string[],
): readonly string[] {
  const successText = capabilityQuery.successConditions
    .map(({ statement }) => canonicalSearchText(statement))
    .join(' ');
  return approvedTerms.filter((term) =>
    successText.includes(canonicalSearchText(term)),
  );
}

function eligibleTermVariants(values: readonly string[]): readonly string[] {
  return uniqueTerms(
    values.flatMap((value) => {
      const spaced = value.replace(/[-_]+/gu, ' ');
      return spaced === value ? [value] : [value, spaced];
    }),
  );
}

function canonicalSearchText(value: string): string {
  return lower(value)
    .replace(/[-_.]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function usableRepositoryHead(
  dossier: CandidateDossierV1,
): Extract<
  CandidateDossierV1['observations'][number]['source'],
  { kind: 'git-commit' }
> | null {
  const heads = dossier.observations.filter(
    ({ topic }) => topic === 'repository-head',
  );
  if (heads.length !== 1) return null;
  const source = heads[0]?.source;
  return source?.kind === 'git-commit' &&
    source.sourceType === 'official-repository'
    ? source
    : null;
}

function materialMatchesHead(
  material: CandidateRepositoryArtifactMaterialV1,
  candidateId: string,
  head: Extract<
    CandidateDossierV1['observations'][number]['source'],
    { kind: 'git-commit' }
  >,
): boolean {
  const { artifactSet } = material;
  if (
    artifactSet.candidateId !== candidateId ||
    artifactSet.commitObjectId !== head.commitSha ||
    material.artifacts.length > 4
  ) {
    return false;
  }
  const artifactsById = new Map(
    material.artifacts.map((loaded) => [loaded.artifact.artifactId, loaded]),
  );
  const presentEntries = artifactSet.entries.filter(
    ({ outcome }) => outcome === 'present',
  );
  if (presentEntries.length !== material.artifacts.length) return false;
  return presentEntries.every((entry) => {
    if (entry.outcome !== 'present') return false;
    const loaded = artifactsById.get(entry.artifactId);
    if (loaded === undefined) return false;
    const expectedDisplayUrl = repositoryArtifactDisplayUrl({
      providerOwner: loaded.artifact.firstMaterialization.providerOwner,
      providerRepository:
        loaded.artifact.firstMaterialization.providerRepository,
      commitObjectId: loaded.artifact.commitObjectId,
      path: loaded.artifact.path,
    });
    return (
      loaded.artifact.candidateId === candidateId &&
      loaded.artifact.commitObjectId === head.commitSha &&
      loaded.artifact.path === entry.resolvedPath &&
      loaded.artifact.displayUrl === expectedDisplayUrl &&
      loaded.chunks.length >= 1 &&
      loaded.chunks.length <= 64 &&
      loaded.chunks.every(
        (chunk, ordinal) =>
          chunk.candidateId === candidateId &&
          chunk.artifactId === loaded.artifact.artifactId &&
          chunk.ordinal === ordinal,
      )
    );
  });
}

function approvedTermsForEvaluation(input: {
  readonly evaluation: RecommendationRetrievalFinalistV1['unresolvedHardEvaluations'][number];
  readonly capabilityQuery: CapabilityQueryInputV1;
  readonly normalization: CapabilityQueryNormalizationResultV1;
  readonly retrievalExpansionAuthority: CapabilityRetrievalExpansionV1;
}): readonly ApprovedTerm[] {
  const primary: string[] = [];
  const { evaluation } = input;
  if (evaluation.conceptId !== null) primary.push(evaluation.conceptId);

  if (evaluation.sourceKind === 'normalized-constraint') {
    const normalized = input.normalization.normalizedConstraints.find(
      ({ normalizedConstraintId }) =>
        normalizedConstraintId === evaluation.evaluationId,
    );
    if (
      normalized?.modality !== evaluation.modality ||
      normalized.facet !== evaluation.facet ||
      normalized.conceptId !== evaluation.conceptId
    ) {
      return Object.freeze([]);
    }
    if (normalized.canonicalTerm !== null) {
      primary.push(normalized.canonicalTerm);
    }
    const sourceIds = new Set(normalized.sourceConstraintIds);
    primary.push(
      ...input.capabilityQuery.draftConstraints
        .filter(({ constraintId }) => sourceIds.has(constraintId))
        .map(({ originalTerm }) => originalTerm),
    );
  } else if (evaluation.sourceKind === 'preserved-declaration') {
    const declaration = input.normalization.preservedDeclarations.find(
      ({ constraintId }) => constraintId === evaluation.evaluationId,
    );
    if (
      declaration?.modality !== evaluation.modality ||
      declaration.facet !== evaluation.facet ||
      evaluation.conceptId !== null
    ) {
      return Object.freeze([]);
    }
    primary.push(declaration.originalTerm);
  } else if (
    evaluation.evaluationId === 'primary-capability-family' &&
    evaluation.conceptId === input.normalization.primaryFamilyId
  ) {
    primary.push(
      ...input.capabilityQuery.capabilityTerms.map(
        ({ originalTerm }) => originalTerm,
      ),
    );
  } else {
    return Object.freeze([]);
  }

  const primaryTerms = uniqueTerms(primary).map((value) => ({
    value,
    precedence: 0 as const,
    specificity: 0 as const,
    searchKind: 'evaluation' as const,
  }));
  const expansion =
    evaluation.conceptId === null
      ? null
      : expandRetrievalTermsV1(
          [evaluation.conceptId],
          input.retrievalExpansionAuthority,
        );
  const primaryKeys = new Set(primaryTerms.map(({ value }) => lower(value)));
  const expansionTerms = (expansion?.edgesApplied ?? [])
    .filter(({ targetTerm }) => !primaryKeys.has(lower(targetTerm)))
    .map(({ relationshipKind, targetTerm }) => ({
      value: targetTerm,
      precedence: 1 as const,
      specificity:
        relationshipKind === 'taxonomy-alias' ? (1 as const) : (3 as const),
      searchKind: 'evaluation' as const,
    }));
  const usedKeys = new Set(
    [...primaryTerms, ...expansionTerms].map(({ value }) => lower(value)),
  );
  const alternativeTerms =
    evaluation.modality === 'prohibited' && evaluation.conceptId !== null
      ? uniqueTerms(
          PROHIBITION_ALTERNATIVE_EVIDENCE_TERMS[evaluation.conceptId] ?? [],
        )
          .filter((value) => !usedKeys.has(lower(value)))
          .map((value) => ({
            value,
            precedence: 1 as const,
            specificity: 2 as const,
            searchKind: 'prohibition-alternative' as const,
          }))
      : [];
  return Object.freeze(
    [...primaryTerms, ...expansionTerms, ...alternativeTerms].slice(
      0,
      MAX_APPROVED_TERMS_PER_NEED,
    ),
  );
}

function matchingLines(
  material: CandidateRepositoryArtifactMaterialV1,
  terms: readonly ApprovedTerm[],
): readonly MatchingLine[] {
  const artifactsById = new Map(
    material.artifacts.map((loaded) => [loaded.artifact.artifactId, loaded]),
  );
  const matches: MatchingLine[] = [];
  for (const entry of material.artifactSet.entries) {
    if (
      entry.outcome !== 'present' ||
      (entry.artifactKind !== 'readme' &&
        entry.artifactKind !== 'documentation')
    ) {
      continue;
    }
    const loaded = artifactsById.get(entry.artifactId);
    if (loaded === undefined) continue;
    let markdownFence: MarkdownFence | null = null;
    for (const chunk of loaded.chunks) {
      const lines = splitRepositoryArtifactLogicalLines(chunk.content);
      for (const [index, exactLine] of lines.entries()) {
        const fenceDelimiter = markdownFenceDelimiter(exactLine);
        const insideMarkdownFence =
          markdownFence !== null || fenceDelimiter !== null;
        markdownFence = advanceMarkdownFence(markdownFence, fenceDelimiter);
        const normalizedExcerpt = normalizeExcerpt(exactLine);
        if (
          normalizedExcerpt === null ||
          !isArtifactEvidenceLineEligible(normalizedExcerpt)
        ) {
          continue;
        }
        const normalizedMatchLine = lower(normalizedExcerpt);
        let best:
          | {
              readonly term: ApprovedTerm;
              readonly matchOffset: number;
              readonly markdownContextPenalty: 0 | 1 | 2 | 3;
            }
          | undefined;
        let matchesEvaluationTerm = false;
        let matchesProhibitionAlternative = false;
        const coverageKeys = new Set<string>();
        for (const term of terms) {
          const normalizedTerm = lower(term.value);
          let searchOffset = 0;
          for (;;) {
            const matchOffset = normalizedMatchLine.indexOf(
              normalizedTerm,
              searchOffset,
            );
            if (matchOffset < 0) break;
            if (
              term.requiresLexicalBoundaries === true &&
              !hasLexicalBoundaries(
                normalizedMatchLine,
                matchOffset,
                normalizedTerm.length,
              )
            ) {
              searchOffset = matchOffset + Math.max(1, normalizedTerm.length);
              continue;
            }
            if (term.searchKind === 'evaluation') matchesEvaluationTerm = true;
            else matchesProhibitionAlternative = true;
            for (const coverageKey of term.coverageKeys ?? []) {
              coverageKeys.add(coverageKey);
            }
            const markdownContextPenalty = insideMarkdownFence
              ? 1
              : markdownMatchContextPenalty(
                  normalizedExcerpt,
                  matchOffset,
                  normalizedTerm.length,
                );
            if (
              best === undefined ||
              term.specificity < best.term.specificity ||
              (term.specificity === best.term.specificity &&
                (markdownContextPenalty < best.markdownContextPenalty ||
                  (markdownContextPenalty === best.markdownContextPenalty &&
                    (term.precedence < best.term.precedence ||
                      (term.precedence === best.term.precedence &&
                        (matchOffset < best.matchOffset ||
                          (matchOffset === best.matchOffset &&
                            compareAscii(term.value, best.term.value) < 0)))))))
            ) {
              best = { term, matchOffset, markdownContextPenalty };
            }
            searchOffset = matchOffset + Math.max(1, normalizedTerm.length);
          }
        }
        if (best === undefined) continue;
        const canonicalMatchLine = normalizedMatchLine.replace(/[-_]+/gu, ' ');
        const namesCanonicalConcept = terms.some(
          ({ coverageKeys, precedence, searchKind, value }) =>
            precedence === 0 &&
            searchKind === 'evaluation' &&
            coverageKeys === undefined &&
            canonicalMatchLine.includes(lower(value).replace(/[-_]+/gu, ' ')),
        );
        matches.push({
          artifact: loaded.artifact,
          chunk,
          entryOrdinal: entry.ordinal,
          lineNumber: chunk.startLine + index,
          normalizedExcerpt,
          boilerplatePenalty: LICENSE_OR_BOILERPLATE.test(normalizedExcerpt)
            ? 1
            : 0,
          specificityPenalty: namesCanonicalConcept ? 0 : best.term.specificity,
          definingStatementPenalty: isDefiningStatement(normalizedExcerpt)
            ? 0
            : 1,
          markdownContextPenalty: best.markdownContextPenalty,
          termPrecedence: best.term.precedence,
          matchOffset: best.matchOffset,
          matchedTerm: best.term.value,
          matchesEvaluationTerm,
          matchesProhibitionAlternative,
          coverageKeys: Object.freeze([...coverageKeys].sort(compareAscii)),
        });
      }
    }
  }
  matches.sort(compareMatchingLines);
  return matches;
}

function compareMatchingLines(left: MatchingLine, right: MatchingLine): number {
  return (
    left.boilerplatePenalty - right.boilerplatePenalty ||
    left.specificityPenalty - right.specificityPenalty ||
    left.definingStatementPenalty - right.definingStatementPenalty ||
    left.markdownContextPenalty - right.markdownContextPenalty ||
    left.termPrecedence - right.termPrecedence ||
    left.entryOrdinal - right.entryOrdinal ||
    left.chunk.ordinal - right.chunk.ordinal ||
    left.lineNumber - right.lineNumber ||
    left.matchOffset - right.matchOffset ||
    compareAscii(left.matchedTerm, right.matchedTerm) ||
    compareAscii(left.artifact.artifactId, right.artifact.artifactId) ||
    compareAscii(left.chunk.chunkId, right.chunk.chunkId)
  );
}

function balanceProhibitionEvidence(
  matches: readonly MatchingLine[],
): readonly MatchingLine[] {
  const firstEvaluation = matches.find(
    ({ matchesEvaluationTerm }) => matchesEvaluationTerm,
  );
  const firstAlternative = matches.find(
    ({ matchesProhibitionAlternative }) => matchesProhibitionAlternative,
  );
  if (
    firstEvaluation === undefined ||
    firstAlternative === undefined ||
    firstEvaluation === firstAlternative
  ) {
    return matches;
  }
  const priority = [firstEvaluation, firstAlternative].sort(
    (left, right) => matches.indexOf(left) - matches.indexOf(right),
  );
  const prioritySet = new Set(priority);
  return [...priority, ...matches.filter((match) => !prioritySet.has(match))];
}

function balancePriorityEvidence(
  matches: readonly MatchingLine[],
  priorityTerms: readonly string[],
): readonly MatchingLine[] {
  const normalizedPriorityTerms = uniqueTerms(priorityTerms).map(lower);
  const isPriority = ({ normalizedExcerpt }: MatchingLine) => {
    const normalized = lower(normalizedExcerpt);
    return normalizedPriorityTerms.some((term) => normalized.includes(term));
  };
  const firstPriority = matches.find(isPriority);
  const firstGeneral = matches.find((match) => !isPriority(match));
  if (
    firstPriority === undefined ||
    firstGeneral === undefined ||
    firstPriority === firstGeneral
  ) {
    return matches;
  }
  const priority = [firstPriority, firstGeneral].sort(
    (left, right) => matches.indexOf(left) - matches.indexOf(right),
  );
  const prioritySet = new Set(priority);
  return [...priority, ...matches.filter((match) => !prioritySet.has(match))];
}

function balanceCoverageEvidence(
  matches: readonly MatchingLine[],
): readonly MatchingLine[] {
  const remaining = [...matches];
  const prioritized: MatchingLine[] = [];
  const covered = new Set<string>();
  for (;;) {
    const index = remaining.findIndex(({ coverageKeys }) =>
      coverageKeys.some((key) => !covered.has(key)),
    );
    if (index < 0) break;
    const [match] = remaining.splice(index, 1);
    if (match === undefined) break;
    prioritized.push(match);
    for (const key of match.coverageKeys) covered.add(key);
  }
  return [...prioritized, ...remaining];
}

function evidenceFromMatch(
  candidateId: string,
  dimension: EvidenceObservationV1['dimension'],
  head: Extract<
    CandidateDossierV1['observations'][number]['source'],
    { kind: 'git-commit' }
  >,
  commitSha: string,
  match: MatchingLine,
): EvidenceObservationV1 {
  const derivedDisplayUrl = repositoryArtifactDisplayUrl({
    providerOwner: match.artifact.firstMaterialization.providerOwner,
    providerRepository: match.artifact.firstMaterialization.providerRepository,
    commitObjectId: commitSha,
    path: match.artifact.path,
  });
  const lineFragment = `#L${String(match.lineNumber)}`;
  const immutableUrl = `${derivedDisplayUrl}${lineFragment}`;
  const evidenceDigest = createHash('sha256')
    .update(
      JSON.stringify([
        candidateId,
        match.artifact.artifactId,
        match.chunk.chunkId,
        commitSha,
        match.artifact.path,
        match.lineNumber,
        match.lineNumber,
        match.normalizedExcerpt,
      ]),
      'utf8',
    )
    .digest('hex');
  return Object.freeze({
    kind: 'evidence',
    evidenceId: `artifact-evidence-${evidenceDigest.slice(0, 40)}`,
    candidateId,
    topic: 'artifact-excerpt',
    dimension,
    observation: match.normalizedExcerpt,
    source: Object.freeze({
      kind: 'git-commit',
      sourceType: 'official-repository',
      sourceUrl: immutableUrl,
      commitSha,
      immutableUrl,
      publishedAt: head.publishedAt,
      collectedAt: match.artifact.firstMaterialization.collectedAt,
    }),
    freshness: Object.freeze({
      status: 'current',
      asOf: match.artifact.firstMaterialization.collectedAt,
      scope: 'Exact immutable repository lines at the active repository head.',
    }),
    directness: 'direct',
    limitation: ARTIFACT_EXCERPT_LIMITATION,
  });
}

function normalizeExcerpt(exactLine: string): string | null {
  const normalized = exactLine.replace(/\s+/gu, ' ').trim();
  return normalized.length > 0 &&
    normalized.length <= MAX_RENDERED_EXCERPT_CODE_UNITS &&
    !containsControlCodeUnit(normalized)
    ? normalized
    : null;
}

interface MarkdownFence {
  readonly marker: '`' | '~';
  readonly length: number;
}

function markdownFenceDelimiter(exactLine: string): MarkdownFence | null {
  const match = /^ {0,3}(?<fence>`{3,}|~{3,})/u.exec(exactLine);
  const fence = match?.groups?.['fence'];
  if (fence === undefined) return null;
  const marker = fence[0];
  return marker === '`' || marker === '~'
    ? { marker, length: fence.length }
    : null;
}

function advanceMarkdownFence(
  current: MarkdownFence | null,
  delimiter: MarkdownFence | null,
): MarkdownFence | null {
  if (delimiter === null) return current;
  if (current === null) return delimiter;
  return delimiter.marker === current.marker &&
    delimiter.length >= current.length
    ? null
    : current;
}

function markdownMatchContextPenalty(
  line: string,
  matchOffset: number,
  matchLength: number,
): 0 | 2 | 3 {
  const matchEnd = matchOffset + matchLength;
  for (const pattern of [
    /!?\[(?<label>[^\]\r\n]*)\]\((?<target>[^)\r\n]*)\)/gu,
    /!?\[(?<label>[^\]\r\n]*)\]\[(?<target>[^\]\r\n]*)\]/gu,
  ]) {
    for (const markdownMatch of line.matchAll(pattern)) {
      const full = markdownMatch[0];
      const fullOffset = markdownMatch.index;
      const label = markdownMatch.groups?.['label'];
      const target = markdownMatch.groups?.['target'];
      if (label === undefined || target === undefined) {
        continue;
      }
      const labelRelativeOffset = full.indexOf(label);
      const targetRelativeOffset = full.lastIndexOf(target);
      const labelStart = fullOffset + labelRelativeOffset;
      const labelEnd = labelStart + label.length;
      const targetStart = fullOffset + targetRelativeOffset;
      const targetEnd = targetStart + target.length;
      if (matchOffset >= targetStart && matchEnd <= targetEnd) return 3;
      if (matchOffset >= labelStart && matchEnd <= labelEnd) return 2;
    }
  }
  return 0;
}

function isDefiningStatement(value: string): boolean {
  return (
    DEFINING_STATEMENT_FORM.test(value) ||
    /(?:^|\s)[^\s]{1,80}(?::|=)(?:\s|$)/u.test(value)
  );
}

function hasLexicalBoundaries(
  value: string,
  matchOffset: number,
  matchLength: number,
): boolean {
  const before = value[matchOffset - 1];
  const after = value[matchOffset + matchLength];
  return (
    (before === undefined || !/[a-z0-9]/u.test(before)) &&
    (after === undefined || !/[a-z0-9]/u.test(after))
  );
}

function isArtifactEvidenceLineEligible(value: string): boolean {
  return (
    !MARKDOWN_REFERENCE_DEFINITION.test(value) &&
    !PURE_MARKDOWN_LINK_OR_IMAGE_LINE.test(value)
  );
}

function containsControlCodeUnit(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit <= 0x1f || (codeUnit >= 0x7f && codeUnit <= 0x9f)) {
      return true;
    }
  }
  return false;
}

function uniqueTerms(values: readonly string[]): readonly string[] {
  const byNormalized = new Map<string, string>();
  for (const value of values) {
    const normalized = value.trim();
    if (normalized.length === 0) continue;
    const key = lower(normalized);
    const existing = byNormalized.get(key);
    if (existing === undefined || compareAscii(normalized, existing) < 0) {
      byNormalized.set(key, normalized);
    }
  }
  return [...byNormalized.values()].sort(compareAscii);
}

function lower(value: string): string {
  return value.toLowerCase();
}

function compareAscii(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function evidenceDimensionForFacet(
  facet: RecommendationRetrievalFinalistV1['unresolvedHardEvaluations'][number]['facet'],
): EvidenceObservationV1['dimension'] {
  switch (facet) {
    case 'architecture':
    case 'deployment':
      return 'deployment';
    case 'infrastructure':
    case 'datastore':
      return 'data-store';
    case 'runtime':
    case 'framework':
      return 'runtime-framework';
    case 'license':
      return 'license';
    case 'repository-state':
    case 'maintenance':
      return 'maintenance';
    case 'release':
      return 'version-release';
    case 'security':
      return 'security';
    case 'capability':
    case 'feature':
    case 'ecosystem':
    case 'other':
      return 'integration';
  }
}
