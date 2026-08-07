import {
  createCandidateRetrievalRequestV1,
  type CandidateRetrievalResultV1,
  type CapabilityQueryNormalizationResultV1,
} from '@gitblocks/contracts';
import { CANDIDATE_CONSTRAINT_EVALUATION_VERSION } from '@gitblocks/domain';
import { createCandidateRetrievalEngineV1 } from '@gitblocks/retrieval';

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
import { loadRetrievalSafeAuthorityV1 } from './safe-authority.ts';
import { retrievalStableJson } from './stable-json.ts';

export const PRODUCTION_RETRIEVAL_PREDICTION_SET_ID =
  'production-deterministic-v1' as const;

export interface ProductionRetrievalPerformanceEvidenceV1 {
  readonly candidateCount: number;
  readonly activeChannelCount: number;
  readonly engineBuildMilliseconds: number;
  readonly searchViewHeapDeltaBytes: number;
  readonly measuredRetrievalQueries: number;
  readonly p95QueryMilliseconds: number;
  readonly maximumQueryMilliseconds: number;
  readonly maximumCandidatesExamined: number;
  readonly maximumCandidatesConstraintEvaluated: number;
  readonly maximumReturnedCandidates: number;
  readonly repeatedCallByteIdentity: boolean;
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
}

/**
 * The blind query loader is deliberately the first authority access. This
 * module imports no corpus, relevance, no-result, equivalence, classification,
 * score, or baseline output authority.
 */
export function generateProductionRetrievalPredictionSetV1(
  startDirectory = process.cwd(),
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
      return { document, normalization, projection, productResult: result };
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
  const sortedDurations = [...queryDurations].sort(
    (left, right) => left - right,
  );
  const p95Index = Math.max(0, Math.ceil(sortedDurations.length * 0.95) - 1);
  return {
    predictionSet,
    productResultsByCase,
    generatedProjectionsByCase,
    performance: {
      candidateCount: engine.candidateCount,
      activeChannelCount: 5,
      engineBuildMilliseconds: roundMilliseconds(engineBuildMilliseconds),
      searchViewHeapDeltaBytes: Math.max(0, heapAfter - heapBefore),
      measuredRetrievalQueries: queryDurations.length,
      p95QueryMilliseconds: roundMilliseconds(sortedDurations[p95Index] ?? 0),
      maximumQueryMilliseconds: roundMilliseconds(sortedDurations.at(-1) ?? 0),
      maximumCandidatesExamined,
      maximumCandidatesConstraintEvaluated,
      maximumReturnedCandidates,
      repeatedCallByteIdentity: true,
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
