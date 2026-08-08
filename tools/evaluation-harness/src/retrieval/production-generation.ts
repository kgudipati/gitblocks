import {
  createCandidateRetrievalRequestV1,
  type CandidateRetrievalRequestV1,
  type CandidateRetrievalResultV1,
  type CapabilityQueryNormalizationResultV1,
} from '@gitblocks/contracts';
import { CANDIDATE_CONSTRAINT_EVALUATION_VERSION } from '@gitblocks/domain';
import {
  createCandidateRetrievalEngineV1,
  type CandidateRetrievalEngineV1,
} from '@gitblocks/retrieval';

import { findGitBlocksRoot } from '../repository-root.ts';
import { loadRetrievalBlindQuerySetV1 } from './blind-query.ts';
import {
  RETRIEVAL_VERSIONS,
  type GeneratedHardFilterProjection,
  type NormalizationCasePrediction,
  type RetrievalCasePrediction,
  type RetrievalPredictionSet,
  type RetrievalQueryDocument,
} from './contracts.ts';
import { generateHardFilterProjection } from './hard-filter.ts';
import {
  buildCandidateReferenceAuthority,
  normalizeRetrievalQuery,
  projectNormalization,
} from './normalization.ts';
import {
  retrievalPredictionSetSemanticDigest,
  validateRetrievalPredictionSetAgainstBlindAuthorityV1,
  type RetrievalBlindPredictionValidationAuthority,
} from './predictions.ts';
import {
  loadRetrievalSafeAuthorityV1,
  type SafeRetrievalAuthorityV1,
} from './safe-authority.ts';
import { retrievalStableJson } from './stable-json.ts';

export const PRODUCTION_RETRIEVAL_PREDICTION_SET_ID =
  'production-deterministic-v1' as const;

export interface ProductionRetrievalPerformanceEvidenceV1 {
  readonly protocol: 'milestone-2-sample' | 'milestone-3-development';
  readonly candidateCount: number;
  readonly activeChannelCount: number;
  readonly engineBuildMilliseconds: number;
  readonly coldEngineConstructions: number;
  readonly p95ColdEngineBuildMilliseconds: number;
  readonly maximumColdEngineBuildMilliseconds: number;
  readonly searchViewHeapDeltaBytes: number;
  readonly retainedHeapGrowthBytes: number;
  readonly warmupRetrievalQueries: number;
  readonly measuredRetrievalQueries: number;
  readonly p95QueryMilliseconds: number;
  readonly maximumQueryMilliseconds: number;
  readonly maximumCandidatesExamined: number;
  readonly maximumCandidatesConstraintEvaluated: number;
  readonly maximumReturnedCandidates: number;
  readonly repeatedCallByteIdentity: boolean;
  readonly coldEngineResultByteIdentity: boolean;
}

export interface ProductionRetrievalDifferentialEvidenceV1 {
  readonly retrievalCasesChecked: number;
  readonly laneCountMatches: number;
  readonly eligibleLaneMatches: number;
  readonly evidenceNeededLaneMatches: number;
  readonly excludedCandidateLeaks: number;
  readonly laneClaimDisagreements: number;
  readonly noEligibleMappingMatches: number;
  readonly productionInputGoldFieldCount: 0;
}

export interface ProductionRetrievalGenerationArtifactsV1 {
  readonly predictionSet: RetrievalPredictionSet;
  readonly productResultsByCase: ReadonlyMap<
    string,
    CandidateRetrievalResultV1
  >;
  readonly generatedProjectionsByCase: ReadonlyMap<
    string,
    GeneratedHardFilterProjection
  >;
  readonly performance: ProductionRetrievalPerformanceEvidenceV1;
  readonly differential: ProductionRetrievalDifferentialEvidenceV1;
}

interface PreparedProductionQuery {
  readonly document: RetrievalQueryDocument;
  readonly normalization: CapabilityQueryNormalizationResultV1;
  readonly projection: GeneratedHardFilterProjection | null;
  readonly productResult: CandidateRetrievalResultV1 | null;
  readonly request: CandidateRetrievalRequestV1 | null;
}

export interface ProductionRetrievalGenerationOptionsV1 {
  readonly performanceProtocol?:
    'milestone-2-sample' | 'milestone-3-development';
}

/**
 * The blind query loader is deliberately the first authority access. This
 * module imports no corpus, relevance, no-result, equivalence, classification,
 * score, or baseline output authority.
 */
export function generateProductionRetrievalPredictionSetV1(
  startDirectory = process.cwd(),
  options: ProductionRetrievalGenerationOptionsV1 = {},
): ProductionRetrievalGenerationArtifactsV1 {
  const repositoryRoot = findGitBlocksRoot(startDirectory);
  const blind = loadRetrievalBlindQuerySetV1(repositoryRoot);
  if (!blind.ok) throw new Error('Retrieval blind query authority is invalid.');

  const safeAuthority = loadRetrievalSafeAuthorityV1(repositoryRoot);
  const heapBefore = measuredHeapBytes();
  const buildStart = performance.now();
  const createdEngine = createCandidateRetrievalEngineV1({
    taxonomy: safeAuthority.taxonomy,
    candidateProfileAuthority: safeAuthority.profiles,
    retrievalExpansionAuthority: safeAuthority.expansion,
  });
  const engineBuildMilliseconds = elapsedMilliseconds(buildStart);
  const heapAfter = measuredHeapBytes();
  if (!createdEngine.ok) {
    throw new Error('Production retrieval engine authority admission failed.');
  }
  const engine = createdEngine.engine;
  const candidateReferenceAuthority = buildCandidateReferenceAuthority(
    safeAuthority.profiles,
  );
  const queryDurations: number[] = [];
  let maximumCandidatesExamined = 0;
  let maximumCandidatesConstraintEvaluated = 0;
  let maximumReturnedCandidates = 0;

  const prepared = blind.querySet.queries.map(
    (document): PreparedProductionQuery => {
      const normalization = normalizeRetrievalQuery(
        document,
        safeAuthority.taxonomy,
        candidateReferenceAuthority,
      );
      if (document.caseKind === 'normalization-adversarial') {
        return {
          document,
          normalization,
          projection: null,
          productResult: null,
          request: null,
        };
      }
      const request = createCandidateRetrievalRequestV1({
        normalization,
        authorityBindings: {
          taxonomy: {
            taxonomyVersion: safeAuthority.taxonomy.taxonomyVersion,
            taxonomySemanticDigest: safeAuthority.taxonomy.semanticDigest,
          },
          candidateProfiles: {
            authorityVersion: safeAuthority.profiles.authorityVersion,
            semanticAuthorityDigest:
              safeAuthority.profiles.semanticAuthorityDigest,
            profileRulesVersion: safeAuthority.profiles.profileRulesVersion,
          },
          catalog: {
            catalogVersion: safeAuthority.profiles.catalogVersion,
            catalogDigest: safeAuthority.profiles.catalogDigest,
          },
          candidateConstraintEvaluationVersion:
            CANDIDATE_CONSTRAINT_EVALUATION_VERSION,
          retrievalExpansion: {
            authorityVersion: safeAuthority.expansion.expansionVersion,
            semanticDigest: safeAuthority.expansion.semanticDigest,
          },
        },
        eligibleResultLimit: 10,
        evidenceNeededResultLimit: 10,
      });
      const queryStart = performance.now();
      const operation = engine.retrieve(request);
      queryDurations.push(elapsedMilliseconds(queryStart));
      if (!operation.ok) {
        throw new Error('Production retrieval request failed.');
      }
      const repeat = engine.retrieve(request);
      if (
        !repeat.ok ||
        retrievalStableJson(repeat.result) !==
          retrievalStableJson(operation.result)
      ) {
        throw new Error('Production retrieval repeatability failed.');
      }
      const result = operation.result;
      maximumCandidatesExamined = Math.max(
        maximumCandidatesExamined,
        result.diagnostics.candidatesExamined,
      );
      maximumCandidatesConstraintEvaluated = Math.max(
        maximumCandidatesConstraintEvaluated,
        result.diagnostics.candidatesConstraintEvaluated,
      );
      maximumReturnedCandidates = Math.max(
        maximumReturnedCandidates,
        result.eligibleCandidates.length +
          result.evidenceNeededCandidates.length,
      );
      const projection = generateHardFilterProjection(
        normalization,
        safeAuthority.profiles,
      );
      assertProductionDifferential(result, projection);
      return {
        document,
        normalization,
        projection,
        productResult: result,
        request,
      };
    },
  );

  const generatedProjectionsByCase = new Map(
    prepared
      .filter(
        (
          entry,
        ): entry is PreparedProductionQuery & {
          readonly projection: GeneratedHardFilterProjection;
          readonly productResult: CandidateRetrievalResultV1;
        } => entry.projection !== null && entry.productResult !== null,
      )
      .map((entry) => [entry.document.caseId, entry.projection]),
  );
  const productResultsByCase = new Map(
    prepared
      .filter(
        (
          entry,
        ): entry is PreparedProductionQuery & {
          readonly projection: GeneratedHardFilterProjection;
          readonly productResult: CandidateRetrievalResultV1;
        } => entry.projection !== null && entry.productResult !== null,
      )
      .map((entry) => [entry.document.caseId, entry.productResult]),
  );
  const validationAuthority: RetrievalBlindPredictionValidationAuthority = {
    corpusVersion: blind.querySet.corpusVersion,
    corpusSemanticDigest: blind.querySet.corpusSemanticDigest,
    queries: blind.querySet.queries,
    candidateIds: safeAuthority.profiles.profiles.map(
      ({ candidateId }) => candidateId,
    ),
    conceptIds: safeAuthority.conceptIds,
    generatedDecisionsByCase: new Map(
      [...generatedProjectionsByCase].map(([caseId, projection]) => [
        caseId,
        projection.decisions,
      ]),
    ),
  };
  const predictions = prepared.map((entry) => createPrediction(entry));
  const withoutDigest = {
    predictionSetVersion: RETRIEVAL_VERSIONS.predictionSet,
    predictionSetId: PRODUCTION_RETRIEVAL_PREDICTION_SET_ID,
    corpusId: blind.querySet.corpusId,
    corpusVersion: blind.querySet.corpusVersion,
    corpusSemanticDigest: blind.querySet.corpusSemanticDigest,
    predictions,
  };
  const predictionSet = deepFreeze({
    ...withoutDigest,
    semanticDigest: retrievalPredictionSetSemanticDigest(withoutDigest),
  }) as RetrievalPredictionSet;
  const diagnostics = validateRetrievalPredictionSetAgainstBlindAuthorityV1(
    predictionSet,
    validationAuthority,
    repositoryRoot,
  );
  if (diagnostics.length > 0) {
    throw new Error('Production prediction failed blind schema validation.');
  }
  const performanceProtocol =
    options.performanceProtocol ?? 'milestone-2-sample';
  const retrievalEntries = prepared.filter(
    (
      entry,
    ): entry is PreparedProductionQuery & {
      readonly productResult: CandidateRetrievalResultV1;
      readonly request: CandidateRetrievalRequestV1;
    } => entry.productResult !== null && entry.request !== null,
  );
  const developmentPerformance =
    performanceProtocol === 'milestone-3-development'
      ? measureDevelopmentPerformance(
          engine,
          retrievalEntries,
          safeAuthority,
          engineBuildMilliseconds,
        )
      : {
          queryDurations,
          warmupRetrievalQueries: 0,
          retainedHeapGrowthBytes: 0,
          coldBuildDurations: [engineBuildMilliseconds],
          coldEngineResultByteIdentity: true,
        };
  const sortedDurations = [...developmentPerformance.queryDurations].sort(
    (left, right) => left - right,
  );
  const sortedColdBuildDurations = [
    ...developmentPerformance.coldBuildDurations,
  ].sort((left, right) => left - right);
  const p95Index = Math.max(0, Math.ceil(sortedDurations.length * 0.95) - 1);
  const coldP95Index = Math.max(
    0,
    Math.ceil(sortedColdBuildDurations.length * 0.95) - 1,
  );
  return {
    predictionSet,
    productResultsByCase,
    generatedProjectionsByCase,
    performance: {
      protocol: performanceProtocol,
      candidateCount: engine.candidateCount,
      activeChannelCount: 5,
      engineBuildMilliseconds: roundMilliseconds(engineBuildMilliseconds),
      coldEngineConstructions: sortedColdBuildDurations.length,
      p95ColdEngineBuildMilliseconds: roundMilliseconds(
        sortedColdBuildDurations[coldP95Index] ?? 0,
      ),
      maximumColdEngineBuildMilliseconds: roundMilliseconds(
        sortedColdBuildDurations.at(-1) ?? 0,
      ),
      searchViewHeapDeltaBytes: Math.max(0, heapAfter - heapBefore),
      retainedHeapGrowthBytes: developmentPerformance.retainedHeapGrowthBytes,
      warmupRetrievalQueries: developmentPerformance.warmupRetrievalQueries,
      measuredRetrievalQueries: developmentPerformance.queryDurations.length,
      p95QueryMilliseconds: roundMilliseconds(sortedDurations[p95Index] ?? 0),
      maximumQueryMilliseconds: roundMilliseconds(sortedDurations.at(-1) ?? 0),
      maximumCandidatesExamined,
      maximumCandidatesConstraintEvaluated,
      maximumReturnedCandidates,
      repeatedCallByteIdentity: true,
      coldEngineResultByteIdentity:
        developmentPerformance.coldEngineResultByteIdentity,
    },
    differential: {
      retrievalCasesChecked: generatedProjectionsByCase.size,
      laneCountMatches: generatedProjectionsByCase.size,
      eligibleLaneMatches: generatedProjectionsByCase.size,
      evidenceNeededLaneMatches: generatedProjectionsByCase.size,
      excludedCandidateLeaks: 0,
      laneClaimDisagreements: 0,
      noEligibleMappingMatches: generatedProjectionsByCase.size,
      productionInputGoldFieldCount: 0,
    },
  };
}

function measureDevelopmentPerformance(
  engine: CandidateRetrievalEngineV1,
  entries: readonly (PreparedProductionQuery & {
    readonly productResult: CandidateRetrievalResultV1;
    readonly request: CandidateRetrievalRequestV1;
  })[],
  safeAuthority: SafeRetrievalAuthorityV1,
  initialEngineBuildMilliseconds: number,
): {
  readonly queryDurations: readonly number[];
  readonly warmupRetrievalQueries: number;
  readonly retainedHeapGrowthBytes: number;
  readonly coldBuildDurations: readonly number[];
  readonly coldEngineResultByteIdentity: boolean;
} {
  if (entries.length === 0) {
    throw new Error('Production performance query authority is empty.');
  }
  const warmupRetrievalQueries = 100;
  for (let index = 0; index < warmupRetrievalQueries; index += 1) {
    const entry = entries[index % entries.length];
    if (entry === undefined || !engine.retrieve(entry.request).ok) {
      throw new Error('Production retrieval warm-up failed.');
    }
  }
  const retainedHeapBefore = measuredHeapBytes();
  const measuredRetrievalQueries = 1_000;
  const queryDurations: number[] = [];
  for (let index = 0; index < measuredRetrievalQueries; index += 1) {
    const entry = entries[index % entries.length];
    if (entry === undefined) {
      throw new Error('Production performance query is missing.');
    }
    const started = performance.now();
    const operation = engine.retrieve(entry.request);
    queryDurations.push(elapsedMilliseconds(started));
    if (
      !operation.ok ||
      retrievalStableJson(operation.result) !==
        retrievalStableJson(entry.productResult)
    ) {
      throw new Error('Production retrieval measured repeat failed.');
    }
  }
  const retainedHeapAfter = measuredHeapBytes();

  const coldBuildDurations = [initialEngineBuildMilliseconds];
  let coldEngineResultByteIdentity = true;
  const probe = entries[0];
  if (probe === undefined) {
    throw new Error('Production performance probe is missing.');
  }
  for (let index = 1; index < 5; index += 1) {
    const started = performance.now();
    const created = createCandidateRetrievalEngineV1({
      taxonomy: safeAuthority.taxonomy,
      candidateProfileAuthority: safeAuthority.profiles,
      retrievalExpansionAuthority: safeAuthority.expansion,
    });
    coldBuildDurations.push(elapsedMilliseconds(started));
    if (!created.ok) {
      throw new Error('Production cold engine construction failed.');
    }
    const operation = created.engine.retrieve(probe.request);
    coldEngineResultByteIdentity &&=
      operation.ok &&
      retrievalStableJson(operation.result) ===
        retrievalStableJson(probe.productResult);
  }
  if (!coldEngineResultByteIdentity) {
    throw new Error('Production cold engine result identity failed.');
  }
  return {
    queryDurations,
    warmupRetrievalQueries,
    retainedHeapGrowthBytes: Math.max(
      0,
      retainedHeapAfter - retainedHeapBefore,
    ),
    coldBuildDurations,
    coldEngineResultByteIdentity,
  };
}

function createPrediction(
  entry: PreparedProductionQuery,
): NormalizationCasePrediction | RetrievalCasePrediction {
  const normalization = projectNormalization(entry.normalization);
  if (entry.document.caseKind === 'normalization-adversarial') {
    return {
      caseId: entry.document.caseId,
      caseKind: entry.document.caseKind,
      normalization,
    };
  }
  if (entry.projection === null || entry.productResult === null) {
    throw new Error('Production retrieval case is incomplete.');
  }
  const { noEligibleCandidate, ordinaryResults } =
    mapProductionResultToEvaluationLane(entry.productResult);
  return {
    caseId: entry.document.caseId,
    caseKind: entry.document.caseKind,
    normalization,
    candidateDecisions: entry.projection.decisions.map(
      ({ candidateId, hardState, lane }) => ({ candidateId, hardState, lane }),
    ),
    results: ordinaryResults.map(({ candidateId, lane }) => ({
      candidateId,
      claimedLane: lane,
    })),
    noEligibleCandidate,
  };
}

export function mapProductionResultToEvaluationLane(
  result: Pick<
    CandidateRetrievalResultV1,
    'eligibleCandidates' | 'evidenceNeededCandidates' | 'preRetrievalLaneCounts'
  >,
): {
  readonly noEligibleCandidate: boolean;
  readonly ordinaryResults: CandidateRetrievalResultV1[
    'eligibleCandidates' | 'evidenceNeededCandidates'];
} {
  const noEligibleCandidate = result.preRetrievalLaneCounts.eligible === 0;
  return {
    noEligibleCandidate,
    ordinaryResults: noEligibleCandidate
      ? result.evidenceNeededCandidates
      : result.eligibleCandidates,
  };
}

export function assertProductionDifferential(
  result: CandidateRetrievalResultV1,
  projection: GeneratedHardFilterProjection,
): void {
  if (
    retrievalStableJson(result.preRetrievalLaneCounts) !==
    retrievalStableJson(projection.laneCounts)
  ) {
    throw new Error('Production pre-retrieval lane counts disagree.');
  }
  const decisions = new Map(
    projection.decisions.map((decision) => [decision.candidateId, decision]),
  );
  for (const candidate of result.eligibleCandidates) {
    const decision = decisions.get(candidate.candidateId);
    if (
      decision?.hardState !== 'satisfied' ||
      decision.lane !== 'eligible' ||
      decision.negativeControl
    ) {
      throw new Error('Production eligible lane disagrees with authority.');
    }
  }
  for (const candidate of result.evidenceNeededCandidates) {
    const decision = decisions.get(candidate.candidateId);
    if (
      decision?.hardState !== 'unresolved' ||
      decision.lane !== 'evidence-needed' ||
      decision.negativeControl
    ) {
      throw new Error(
        'Production evidence-needed lane disagrees with authority.',
      );
    }
  }
  const returned = new Set([
    ...result.eligibleCandidates.map(({ candidateId }) => candidateId),
    ...result.evidenceNeededCandidates.map(({ candidateId }) => candidateId),
  ]);
  if (
    projection.decisions.some(
      (decision) =>
        returned.has(decision.candidateId) &&
        (decision.lane === 'excluded' || decision.negativeControl),
    )
  ) {
    throw new Error('Production result leaked an excluded candidate.');
  }
}

function measuredHeapBytes(): number {
  const runtime = globalThis as typeof globalThis & { gc?: () => void };
  runtime.gc?.();
  return process.memoryUsage().heapUsed;
}

function elapsedMilliseconds(start: number): number {
  return performance.now() - start;
}

function roundMilliseconds(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) {
    return value;
  }
  if (value instanceof Map) {
    for (const child of value.values()) deepFreeze(child);
    return Object.freeze(value) as T;
  }
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
