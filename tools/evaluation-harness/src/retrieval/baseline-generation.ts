import { join } from 'node:path';

import {
  parseCapabilityTaxonomyV1,
  parseDeterministicCandidateProfileAuthorityV1,
  type CapabilityQueryNormalizationResultV1,
} from '@gitblocks/contracts';
import type {
  DeterministicCandidateProfileAuthority,
  DeterministicProfileFieldRecord,
} from '@gitblocks/domain';

import { findGitBlocksRoot } from '../repository-root.ts';
import { runAliasExpandedBaseline } from './baselines/alias-expanded.ts';
import { runAlwaysAbstainControl } from './baselines/always-abstain.ts';
import { runConstraintViolatingControl } from './baselines/constraint-violating.ts';
import {
  RETRIEVAL_BASELINE_PREDICTION_SET_IDS,
  type BaselineCandidateView,
  type BaselineQueryView,
  type BaselineStrategyResult,
  compareAscii,
} from './baselines/contracts.ts';
import { runExactKeywordBaseline } from './baselines/exact-keyword.ts';
import { runFamilyOnlyBaseline } from './baselines/family-only.ts';
import {
  loadRetrievalBlindQuerySetV1,
  loadRetrievalBlindQuerySetV2,
} from './blind-query.ts';
import {
  RETRIEVAL_V2_VERSIONS,
  RETRIEVAL_VERSIONS,
  type RetrievalAuthorityVersion,
  type GeneratedCandidateDecision,
  type NormalizationCasePrediction,
  type RetrievalCasePrediction,
  type RetrievalPredictionSet,
  type RetrievalQueryDocument,
} from './contracts.ts';
import { generateHardFilterProjection } from './hard-filter.ts';
import { loadRetrievalJsonFile } from './json-boundary.ts';
import {
  buildCandidateReferenceAuthority,
  normalizeRetrievalQuery,
  projectNormalization,
} from './normalization.ts';
import {
  retrievalPredictionSetSemanticDigest,
  validateRetrievalPredictionSetAgainstBlindAuthorityV1,
  validateRetrievalPredictionSetAgainstBlindAuthorityV2,
  type RetrievalBlindPredictionValidationAuthority,
} from './predictions.ts';

const EXPECTED_PROFILE_COUNT = 150;
const EXPECTED_TAXONOMY_VERSION = '1.0.0';
const EXPECTED_TAXONOMY_DIGEST =
  '8b2806ec8862390d0368e1c06ed657983916530f1207be9072d9e4787a61d80e';
const EXPECTED_PROFILE_AUTHORITY_DIGEST =
  '9845ff004c83879de423a566ba906f033a83f7338fca9fc38b6324feffd07bdd';
const EXPECTED_CATALOG_DIGEST =
  '4819dd94cb1bbe5e27c31ca5ca55976da1442987a792bf438d96681021cb8634';

export interface RetrievalBaselinePredictionSets {
  readonly familyOnly: RetrievalPredictionSet;
  readonly exactKeyword: RetrievalPredictionSet;
  readonly aliasExpanded: RetrievalPredictionSet;
  readonly alwaysAbstain: RetrievalPredictionSet;
  readonly constraintViolating: RetrievalPredictionSet;
}

export interface RetrievalBaselineGenerationOptions {
  readonly authorityOrder?: 'canonical' | 'reverse';
}

interface SafeAuthority {
  readonly taxonomy: unknown;
  readonly conceptIds: readonly string[];
  readonly profiles: DeterministicCandidateProfileAuthority;
}

interface PreparedQuery {
  readonly document: RetrievalQueryDocument;
  readonly normalization: CapabilityQueryNormalizationResultV1;
  readonly queryView: BaselineQueryView;
  readonly candidates: readonly BaselineCandidateView[];
  readonly generatedDecisions: readonly GeneratedCandidateDecision[];
}

/**
 * The blind loader is deliberately the first authority access in this function.
 * Full corpus loading and scoring belong to the later runner phase.
 */
export function generateRetrievalBaselinePredictionSetsV1(
  startDirectory = process.cwd(),
  options: RetrievalBaselineGenerationOptions = {},
): RetrievalBaselinePredictionSets {
  return generateRetrievalBaselinePredictionSets(startDirectory, options, 'v1');
}

export function generateRetrievalBaselinePredictionSetsV2(
  startDirectory = process.cwd(),
  options: RetrievalBaselineGenerationOptions = {},
): RetrievalBaselinePredictionSets {
  return generateRetrievalBaselinePredictionSets(startDirectory, options, 'v2');
}

function generateRetrievalBaselinePredictionSets(
  startDirectory: string,
  options: RetrievalBaselineGenerationOptions,
  authorityVersion: RetrievalAuthorityVersion,
): RetrievalBaselinePredictionSets {
  const repositoryRoot = findGitBlocksRoot(startDirectory);
  const blind =
    authorityVersion === 'v1'
      ? loadRetrievalBlindQuerySetV1(repositoryRoot)
      : loadRetrievalBlindQuerySetV2(repositoryRoot);
  if (!blind.ok) throw new Error('Retrieval blind query authority is invalid.');

  const authority = loadSafeAuthority(
    repositoryRoot,
    options.authorityOrder ?? 'canonical',
  );
  const candidateReferenceAuthority = buildCandidateReferenceAuthority(
    authority.profiles,
  );
  const prepared = blind.querySet.queries.map((document): PreparedQuery => {
    const normalization = normalizeRetrievalQuery(
      document,
      authority.taxonomy,
      candidateReferenceAuthority,
    );
    const queryView = createBaselineQueryView(document, normalization);
    if (document.caseKind === 'normalization-adversarial') {
      return {
        document,
        normalization,
        queryView,
        candidates: [],
        generatedDecisions: [],
      };
    }
    const projection = generateHardFilterProjection(
      normalization,
      authority.profiles,
    );
    return {
      document,
      normalization,
      queryView,
      candidates: createBaselineCandidateViews(
        authority.profiles,
        projection.decisions,
      ),
      generatedDecisions: projection.decisions,
    };
  });
  const validationAuthority: RetrievalBlindPredictionValidationAuthority = {
    corpusVersion: blind.querySet.corpusVersion,
    corpusSemanticDigest: blind.querySet.corpusSemanticDigest,
    queries: blind.querySet.queries,
    candidateIds: authority.profiles.profiles.map(
      ({ candidateId }) => candidateId,
    ),
    conceptIds: authority.conceptIds,
    generatedDecisionsByCase: new Map(
      prepared
        .filter(({ document }) => document.caseKind === 'retrieval')
        .map(({ document, generatedDecisions }) => [
          document.caseId,
          generatedDecisions,
        ]),
    ),
  };
  const common = {
    corpusId: blind.querySet.corpusId,
    corpusVersion: blind.querySet.corpusVersion,
    corpusSemanticDigest: blind.querySet.corpusSemanticDigest,
  } as const;

  return deepFreeze({
    familyOnly: createPredictionSet(
      RETRIEVAL_BASELINE_PREDICTION_SET_IDS.familyOnly,
      common,
      prepared,
      validationAuthority,
      runFamilyOnlyBaseline,
      authorityVersion,
    ),
    exactKeyword: createPredictionSet(
      RETRIEVAL_BASELINE_PREDICTION_SET_IDS.exactKeyword,
      common,
      prepared,
      validationAuthority,
      runExactKeywordBaseline,
      authorityVersion,
    ),
    aliasExpanded: createPredictionSet(
      RETRIEVAL_BASELINE_PREDICTION_SET_IDS.aliasExpanded,
      common,
      prepared,
      validationAuthority,
      runAliasExpandedBaseline,
      authorityVersion,
    ),
    alwaysAbstain: createPredictionSet(
      RETRIEVAL_BASELINE_PREDICTION_SET_IDS.alwaysAbstain,
      common,
      prepared,
      validationAuthority,
      runAlwaysAbstainControl,
      authorityVersion,
    ),
    constraintViolating: createConstraintViolatingPredictionSet(
      common,
      prepared,
      validationAuthority,
      authorityVersion,
    ),
  });
}

function loadSafeAuthority(
  repositoryRoot: string,
  order: 'canonical' | 'reverse',
): SafeAuthority {
  const taxonomyValue = loadRetrievalJsonFile(
    join(repositoryRoot, 'catalog/capability-taxonomy/1.0.0'),
    'manifest.json',
  );
  const taxonomy = parseCapabilityTaxonomyV1(taxonomyValue);
  if (
    !taxonomy.ok ||
    taxonomy.value.taxonomyVersion !== EXPECTED_TAXONOMY_VERSION ||
    taxonomy.value.semanticDigest !== EXPECTED_TAXONOMY_DIGEST
  ) {
    throw new Error('Baseline taxonomy authority is invalid.');
  }
  const profileValue = loadRetrievalJsonFile(
    join(repositoryRoot, 'catalog/public-v1'),
    'candidate-profile-authority.json',
    { maximumFileBytes: 4 * 1024 * 1024 },
  );
  const parsed = parseDeterministicCandidateProfileAuthorityV1(profileValue);
  if (
    !parsed.ok ||
    parsed.domain.profiles.length !== EXPECTED_PROFILE_COUNT ||
    parsed.domain.semanticAuthorityDigest !==
      EXPECTED_PROFILE_AUTHORITY_DIGEST ||
    parsed.domain.catalogDigest !== EXPECTED_CATALOG_DIGEST
  ) {
    throw new Error('Baseline candidate-profile authority is invalid.');
  }
  const inputProfiles =
    order === 'reverse'
      ? [...parsed.domain.profiles].reverse()
      : [...parsed.domain.profiles];
  const profiles = {
    ...parsed.domain,
    profiles: inputProfiles.sort((left, right) =>
      compareAscii(left.candidateId, right.candidateId),
    ),
  };
  return {
    taxonomy: taxonomy.value,
    conceptIds: taxonomy.value.concepts
      .map(({ conceptId }) => conceptId)
      .sort(compareAscii),
    profiles,
  };
}

function createBaselineQueryView(
  document: RetrievalQueryDocument,
  normalization: CapabilityQueryNormalizationResultV1,
): BaselineQueryView {
  return deepFreeze({
    caseKind: document.caseKind,
    rawStructuredTerms: document.queryInput.capabilityTerms.map(
      ({ originalTerm }) => originalTerm,
    ),
    rawStructuredConstraints: document.queryInput.draftConstraints.map(
      ({ modality, facetHint, originalTerm }) => ({
        modality,
        facet: facetHint,
        originalTerm,
      }),
    ),
    normalizedPrimaryFamily:
      normalization.outcome === 'normalized'
        ? normalization.primaryFamilyId
        : null,
    normalizedConceptIds: normalization.normalizedCapabilityConcepts.map(
      ({ conceptId }) => conceptId,
    ),
    normalizedConstraints: normalization.normalizedConstraints.map(
      ({ modality, facet, resolutionBasis, conceptId, canonicalTerm }) => ({
        modality,
        facet,
        resolutionBasis,
        conceptId,
        canonicalTerm,
      }),
    ),
    resolvedCandidateIds: normalization.resolvedCandidateReferences.map(
      ({ candidateId }) => candidateId,
    ),
  });
}

function createBaselineCandidateViews(
  authority: DeterministicCandidateProfileAuthority,
  decisions: readonly GeneratedCandidateDecision[],
): readonly BaselineCandidateView[] {
  const decisionsById = new Map(
    decisions.map((decision) => [decision.candidateId, decision]),
  );
  return deepFreeze(
    authority.profiles.map((profile): BaselineCandidateView => {
      const status = knownField(profile.fields, 'catalog-role-status');
      const family = knownField(profile.fields, 'capability-family');
      const repository = knownField(profile.fields, 'repository-identity');
      const packageMapping = knownField(
        profile.fields,
        'package-identity-mapping',
      );
      const decision = decisionsById.get(profile.candidateId);
      if (decision === undefined) {
        throw new Error('Baseline hard-filter projection is incomplete.');
      }
      return {
        candidateId: profile.candidateId,
        primaryFamily: family.value.primaryFamily,
        additionalFamilies: [...family.value.additionalFamilies],
        catalogStatus: status.value.catalogStatus,
        repositoryOwner: repository.value.githubOwner,
        repositoryName: repository.value.githubRepository,
        npmPackage:
          packageMapping.value.mapping === 'mapped'
            ? packageMapping.value.packageName
            : null,
        hardState: decision.hardState,
        lane: decision.lane,
      };
    }),
  );
}

function knownField<
  Id extends
    | 'capability-family'
    | 'catalog-role-status'
    | 'package-identity-mapping'
    | 'repository-identity',
>(
  fields: readonly DeterministicProfileFieldRecord[],
  fieldId: Id,
): Extract<DeterministicProfileFieldRecord<Id>, { readonly state: 'known' }> {
  const field = fields.find((candidate) => candidate.fieldId === fieldId) as
    DeterministicProfileFieldRecord<Id> | undefined;
  if (field?.state !== 'known') {
    throw new Error('Baseline structured candidate authority is incomplete.');
  }
  return field;
}

function createPredictionSet(
  predictionSetId: string,
  common: Pick<
    RetrievalPredictionSet,
    'corpusId' | 'corpusVersion' | 'corpusSemanticDigest'
  >,
  prepared: readonly PreparedQuery[],
  validationAuthority: RetrievalBlindPredictionValidationAuthority,
  strategy: (
    query: BaselineQueryView,
    candidates: readonly BaselineCandidateView[],
  ) => BaselineStrategyResult,
  authorityVersion: RetrievalAuthorityVersion,
): RetrievalPredictionSet {
  const predictions = prepared.map(
    ({
      document,
      normalization,
      queryView,
      candidates,
      generatedDecisions,
    }) => {
      const normalizationPrediction = projectNormalization(normalization);
      if (document.caseKind === 'normalization-adversarial') {
        return {
          caseId: document.caseId,
          caseKind: document.caseKind,
          normalization: normalizationPrediction,
        } satisfies NormalizationCasePrediction;
      }
      const output = strategy(queryView, candidates);
      return {
        caseId: document.caseId,
        caseKind: document.caseKind,
        normalization: normalizationPrediction,
        candidateDecisions: generatedDecisions.map(
          ({ candidateId, hardState, lane }) => ({
            candidateId,
            hardState,
            lane,
          }),
        ),
        results: output.results.map((result) => ({ ...result })),
        noEligibleCandidate: output.noEligibleCandidate,
      } satisfies RetrievalCasePrediction;
    },
  );
  return finalizePredictionSet(
    { predictionSetId, ...common, predictions },
    validationAuthority,
    authorityVersion,
  );
}

function createConstraintViolatingPredictionSet(
  common: Pick<
    RetrievalPredictionSet,
    'corpusId' | 'corpusVersion' | 'corpusSemanticDigest'
  >,
  prepared: readonly PreparedQuery[],
  validationAuthority: RetrievalBlindPredictionValidationAuthority,
  authorityVersion: RetrievalAuthorityVersion,
): RetrievalPredictionSet {
  const predictions = prepared.map(
    ({
      document,
      normalization,
      queryView,
      candidates,
      generatedDecisions,
    }) => {
      const normalizationPrediction = projectNormalization(normalization);
      if (document.caseKind === 'normalization-adversarial') {
        return {
          caseId: document.caseId,
          caseKind: document.caseKind,
          normalization: normalizationPrediction,
        } satisfies NormalizationCasePrediction;
      }
      const control = runConstraintViolatingControl(queryView, candidates);
      const selected = new Set(control.selectedCandidateIds);
      return {
        caseId: document.caseId,
        caseKind: document.caseKind,
        normalization: normalizationPrediction,
        candidateDecisions: generatedDecisions.map(
          ({ candidateId, hardState, lane }) =>
            selected.has(candidateId)
              ? {
                  candidateId,
                  hardState: 'satisfied' as const,
                  lane: 'eligible' as const,
                }
              : { candidateId, hardState, lane },
        ),
        results: control.results.map((result) => ({ ...result })),
        noEligibleCandidate: false,
      } satisfies RetrievalCasePrediction;
    },
  );
  return finalizePredictionSet(
    {
      predictionSetId:
        RETRIEVAL_BASELINE_PREDICTION_SET_IDS.constraintViolating,
      ...common,
      predictions,
    },
    validationAuthority,
    authorityVersion,
  );
}

function finalizePredictionSet(
  value: Omit<
    RetrievalPredictionSet,
    'predictionSetVersion' | 'semanticDigest'
  >,
  validationAuthority: RetrievalBlindPredictionValidationAuthority,
  authorityVersion: RetrievalAuthorityVersion,
): RetrievalPredictionSet {
  const withoutDigest = {
    predictionSetVersion:
      authorityVersion === 'v1'
        ? RETRIEVAL_VERSIONS.predictionSet
        : RETRIEVAL_V2_VERSIONS.predictionSet,
    ...value,
  };
  const predictionSet = deepFreeze({
    ...withoutDigest,
    semanticDigest: retrievalPredictionSetSemanticDigest(
      withoutDigest as RetrievalPredictionSet,
    ),
  }) as RetrievalPredictionSet;
  const diagnostics =
    authorityVersion === 'v1'
      ? validateRetrievalPredictionSetAgainstBlindAuthorityV1(
          predictionSet,
          validationAuthority,
        )
      : validateRetrievalPredictionSetAgainstBlindAuthorityV2(
          predictionSet,
          validationAuthority,
        );
  if (diagnostics.length > 0) {
    throw new Error(
      `Baseline prediction set failed blind validation: ${diagnostics[0]?.code ?? 'unknown'}.`,
    );
  }
  return predictionSet;
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) {
    return value;
  }
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
