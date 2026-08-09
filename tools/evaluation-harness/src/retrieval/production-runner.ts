import { findGitBlocksRoot } from '../repository-root.ts';
import {
  RETRIEVAL_FAMILIES,
  type MetricValue,
  type RetrievalCaseScore,
  type RetrievalFamily,
  type RetrievalScoreReport,
} from './contracts.ts';
import { loadRetrievalCorpusV1, loadRetrievalCorpusV2 } from './corpus.ts';
import {
  generateProductionRetrievalPredictionSetV1,
  generateProductionRetrievalPredictionSetV2,
  type ProductionRetrievalDifferentialEvidenceV1,
  type ProductionRetrievalGenerationArtifactsV1,
  type ProductionRetrievalPerformanceEvidenceV1,
} from './production-generation.ts';
import {
  validateRetrievalPredictionSetV1,
  validateRetrievalPredictionSetV2,
} from './predictions.ts';
import {
  loadCommittedRetrievalV2QualityGates,
  type RetrievalV2QualityGates,
} from './quality-gates.ts';
import { scoreRetrievalPredictionSet, summarizeMetrics } from './scoring.ts';
import { createRetrievalSchemaRegistry } from './schema-registry.ts';

export interface ProductionRetrievalEvaluationReportV1 {
  readonly evaluationPathVersion: 'production-retrieval-evaluation/1.0.0';
  readonly score: RetrievalScoreReport;
  readonly qualitySummary: {
    readonly macroRecallAt10: MetricValue;
    readonly positiveCaseHitRate: {
      readonly hits: number;
      readonly cases: number;
    };
    readonly familyRecallAt10: Readonly<Record<RetrievalFamily, MetricValue>>;
    readonly macroMeanReciprocalRank: MetricValue;
    readonly macroNdcgAt10: MetricValue;
  };
  readonly safetySummary: {
    readonly candidateHardFilterCorrectness: MetricValue;
    readonly prohibitedConstraintPreservation: MetricValue;
    readonly noEligibleCandidateCorrectness: MetricValue;
    readonly top10ConflictViolations: number;
    readonly top10NegativeControlViolations: number;
    readonly top10LaneViolations: number;
    readonly exactDuplicateRate: MetricValue;
    readonly controlledEquivalenceDuplicateRate: MetricValue;
  };
  readonly productIdentityDiagnostics: {
    readonly exactRepositoryIdentityGroups: number;
    readonly exactPackageIdentityGroups: number;
    readonly exactIdentityDuplicatesRemoved: number;
  };
  readonly productExpansionDiagnostics: {
    readonly casesWithAppliedEdges: number;
    readonly casesWithCandidateMatches: number;
    readonly sourceConceptsApplied: number;
    readonly edgesApplied: number;
    readonly edgesTruncated: number;
    readonly candidateMatches: number;
  };
  readonly productMetadataDiagnostics: {
    readonly casesWithMetadataCandidateMatches: number;
    readonly candidateCaseMetadataComponents: number;
    readonly metadataMatchedTermOccurrences: number;
    readonly topicMatchOccurrences: number;
    readonly descriptionMatchOccurrences: number;
    readonly primaryLanguageMatchOccurrences: number;
  };
  readonly differential: ProductionRetrievalDifferentialEvidenceV1;
  readonly performance: ProductionRetrievalPerformanceEvidenceV1;
}

interface ScalarGateEvaluation {
  readonly measured: number;
  readonly required: number;
  readonly pass: boolean;
}

interface ExactGateValue {
  readonly numerator: number;
  readonly denominator: number;
}

interface ExactGateEvaluation {
  readonly measured: ExactGateValue;
  readonly required: ExactGateValue;
  readonly pass: boolean;
}

export interface ProductionRetrievalGateEvaluationV2 {
  readonly authorityBindings: {
    readonly corpusSemanticDigest: string;
    readonly independentReviewDigest: string;
    readonly baselineReportDigest: string;
    readonly saturationProofDigest: string;
    readonly qualityGateDigest: string;
  };
  readonly quality: {
    readonly macroRecallAt10: ScalarGateEvaluation;
    readonly familyRecallAt10: Readonly<
      Record<RetrievalFamily, ScalarGateEvaluation>
    >;
    readonly positiveCaseHitRate: ExactGateEvaluation;
    readonly meanReciprocalRank: ScalarGateEvaluation;
    readonly ndcgAt10: ScalarGateEvaluation;
  };
  readonly safety: {
    readonly candidateHardFilterCorrectness: ExactGateEvaluation;
    readonly prohibitedConstraintPreservation: ExactGateEvaluation;
    readonly noEligibleCandidateCorrectness: ExactGateEvaluation;
    readonly hardConflictResults: ScalarGateEvaluation;
    readonly laneViolations: ScalarGateEvaluation;
    readonly negativeControlViolations: ScalarGateEvaluation;
    readonly exactDuplicates: ScalarGateEvaluation;
    readonly controlledEquivalenceDuplicates: ScalarGateEvaluation;
  };
  readonly overallPass: boolean;
}

export interface ProductionRetrievalEvaluationReportV2 extends Omit<
  ProductionRetrievalEvaluationReportV1,
  'evaluationPathVersion'
> {
  readonly evaluationPathVersion: 'production-retrieval-evaluation/2.0.0';
  readonly gateEvaluation: ProductionRetrievalGateEvaluationV2;
}

export function runProductionRetrievalEvaluationV1(
  startDirectory = process.cwd(),
): ProductionRetrievalEvaluationReportV1 {
  const repositoryRoot = findGitBlocksRoot(startDirectory);

  // Predictions and product results are complete, validated, digested, and
  // frozen from blind inputs before any gold-bearing corpus is loaded.
  const generated = generateProductionRetrievalPredictionSetV1(repositoryRoot, {
    performanceProtocol: 'milestone-3-development',
  });

  const loaded = loadRetrievalCorpusV1(repositoryRoot);
  if (!loaded.ok) throw new Error('Retrieval corpus validation failed.');
  const predictionDiagnostics = validateRetrievalPredictionSetV1(
    generated.predictionSet,
    loaded.corpus,
    repositoryRoot,
  );
  if (predictionDiagnostics.length > 0) {
    throw new Error('Frozen production prediction failed scoring validation.');
  }
  const score = scoreRetrievalPredictionSet(
    loaded.corpus,
    generated.predictionSet,
  );
  if (
    createRetrievalSchemaRegistry(repositoryRoot).validate(
      'score-report',
      score,
    ).length > 0
  ) {
    throw new Error('Production retrieval score failed the existing schema.');
  }
  return deepFreeze({
    evaluationPathVersion: 'production-retrieval-evaluation/1.0.0',
    score,
    ...createProductionReportEvidence(score, generated),
  });
}

export function runProductionRetrievalEvaluationV2(
  startDirectory = process.cwd(),
): ProductionRetrievalEvaluationReportV2 {
  const repositoryRoot = findGitBlocksRoot(startDirectory);

  // Gate authority is authenticated before prediction and remains an input to
  // measurement. This boundary loads no relevance gold or scorer output.
  const qualityGates = loadCommittedRetrievalV2QualityGates(repositoryRoot);

  // Predictions and product results are complete, validated, digested, and
  // frozen from blind inputs before any gold-bearing corpus is loaded.
  const generated = generateProductionRetrievalPredictionSetV2(repositoryRoot, {
    performanceProtocol: 'milestone-3-development',
  });

  const loaded = loadRetrievalCorpusV2(repositoryRoot);
  if (!loaded.ok) throw new Error('Retrieval-v2 corpus validation failed.');
  const predictionDiagnostics = validateRetrievalPredictionSetV2(
    generated.predictionSet,
    loaded.corpus,
    repositoryRoot,
  );
  if (predictionDiagnostics.length > 0) {
    throw new Error(
      'Frozen production-v2 prediction failed scoring validation.',
    );
  }
  const score = scoreRetrievalPredictionSet(
    loaded.corpus,
    generated.predictionSet,
  );
  if (
    createRetrievalSchemaRegistry(repositoryRoot, 'v2').validate(
      'score-report',
      score,
    ).length > 0
  ) {
    throw new Error('Production retrieval-v2 score failed its closed schema.');
  }
  const evidence = createProductionReportEvidence(score, generated);
  return deepFreeze({
    evaluationPathVersion: 'production-retrieval-evaluation/2.0.0',
    score,
    ...evidence,
    gateEvaluation: evaluateProductionRetrievalGatesV2(
      score,
      evidence,
      qualityGates,
    ),
  });
}

function createProductionReportEvidence(
  score: RetrievalScoreReport,
  generated: ProductionRetrievalGenerationArtifactsV1,
): Omit<
  ProductionRetrievalEvaluationReportV1,
  'evaluationPathVersion' | 'score'
> {
  const retrievalScores = score.perCase.filter(
    (caseScore): caseScore is RetrievalCaseScore =>
      caseScore.caseKind === 'retrieval',
  );
  const positiveCases = retrievalScores.filter(
    ({ eligibleRelevantHit }) => eligibleRelevantHit !== null,
  );
  const familyRecallAt10 = Object.fromEntries(
    RETRIEVAL_FAMILIES.map((family) => [
      family,
      summarizeMetrics(
        retrievalScores
          .filter((caseScore) => caseScore.family === family)
          .map(({ recallAt10 }) => recallAt10),
      ),
    ]),
  ) as Readonly<Record<RetrievalFamily, MetricValue>>;
  const productResults = [...generated.productResultsByCase.values()];
  const metadataMatchesByResult = productResults.map((result) =>
    [...result.eligibleCandidates, ...result.evidenceNeededCandidates].flatMap(
      ({ channelMatches }) =>
        channelMatches.filter(
          ({ channelId }) => channelId === 'approved-metadata-lexical',
        ),
    ),
  );
  const metadataMatches = metadataMatchesByResult.flat();
  const metadataTerms = metadataMatches.flatMap(
    ({ matchedMetadataTerms }) => matchedMetadataTerms,
  );

  return {
    qualitySummary: {
      macroRecallAt10: requireMetric(score.macro, 'recallAt10'),
      positiveCaseHitRate: {
        hits: positiveCases.filter(
          ({ eligibleRelevantHit }) => eligibleRelevantHit === true,
        ).length,
        cases: positiveCases.length,
      },
      familyRecallAt10,
      macroMeanReciprocalRank: requireMetric(score.macro, 'meanReciprocalRank'),
      macroNdcgAt10: requireMetric(score.macro, 'ndcgAt10'),
    },
    safetySummary: {
      candidateHardFilterCorrectness: requireMetric(
        score.micro,
        'hardFilterAccuracy',
      ),
      prohibitedConstraintPreservation: requireMetric(
        score.micro,
        'prohibitedConstraintPreservation',
      ),
      noEligibleCandidateCorrectness: requireMetric(
        score.micro,
        'noEligibleCandidateAccuracy',
      ),
      top10ConflictViolations: score.safetyViolations.conflict,
      top10NegativeControlViolations: score.safetyViolations.negativeControl,
      top10LaneViolations: score.safetyViolations.laneError,
      exactDuplicateRate: requireMetric(score.micro, 'exactDuplicateRate'),
      controlledEquivalenceDuplicateRate: requireMetric(
        score.micro,
        'equivalenceDuplicateRate',
      ),
    },
    productIdentityDiagnostics: {
      exactRepositoryIdentityGroups: productResults.reduce(
        (sum, result) => sum + result.diagnostics.exactRepositoryIdentityGroups,
        0,
      ),
      exactPackageIdentityGroups: productResults.reduce(
        (sum, result) => sum + result.diagnostics.exactPackageIdentityGroups,
        0,
      ),
      exactIdentityDuplicatesRemoved: productResults.reduce(
        (sum, result) =>
          sum + result.diagnostics.exactIdentityDuplicatesRemoved,
        0,
      ),
    },
    productExpansionDiagnostics: {
      casesWithAppliedEdges: productResults.filter(
        ({ diagnostics }) => diagnostics.expansionEdgesApplied > 0,
      ).length,
      casesWithCandidateMatches: productResults.filter(
        ({ diagnostics }) => diagnostics.candidateExpansionMatches > 0,
      ).length,
      sourceConceptsApplied: productResults.reduce(
        (sum, { diagnostics }) => sum + diagnostics.expansionSourceConcepts,
        0,
      ),
      edgesApplied: productResults.reduce(
        (sum, { diagnostics }) => sum + diagnostics.expansionEdgesApplied,
        0,
      ),
      edgesTruncated: productResults.reduce(
        (sum, { diagnostics }) => sum + diagnostics.expansionEdgesTruncated,
        0,
      ),
      candidateMatches: productResults.reduce(
        (sum, { diagnostics }) => sum + diagnostics.candidateExpansionMatches,
        0,
      ),
    },
    productMetadataDiagnostics: {
      casesWithMetadataCandidateMatches: metadataMatchesByResult.filter(
        (matches) => matches.length > 0,
      ).length,
      candidateCaseMetadataComponents: metadataMatches.length,
      metadataMatchedTermOccurrences: metadataTerms.length,
      topicMatchOccurrences: metadataTerms.filter(
        ({ source }) => source === 'topic',
      ).length,
      descriptionMatchOccurrences: metadataTerms.filter(
        ({ source }) => source === 'description',
      ).length,
      primaryLanguageMatchOccurrences: metadataTerms.filter(
        ({ source }) => source === 'primary-language',
      ).length,
    },
    differential: generated.differential,
    performance: generated.performance,
  };
}

export function evaluateProductionRetrievalGatesV2(
  score: RetrievalScoreReport,
  evidence: Omit<
    ProductionRetrievalEvaluationReportV1,
    'evaluationPathVersion' | 'score'
  >,
  gates: RetrievalV2QualityGates,
): ProductionRetrievalGateEvaluationV2 {
  const familyFloors = new Map(
    gates.gates.familyRecallAt10.map(({ family, floor }) => [family, floor]),
  );
  const familyRecallAt10 = Object.fromEntries(
    RETRIEVAL_FAMILIES.map((family) => [
      family,
      scalarMinimumGate(
        requireMetricValue(evidence.qualitySummary.familyRecallAt10[family]),
        requireNumber(familyFloors.get(family)),
      ),
    ]),
  ) as Readonly<Record<RetrievalFamily, ScalarGateEvaluation>>;
  const quality = {
    macroRecallAt10: scalarMinimumGate(
      requireMetricValue(evidence.qualitySummary.macroRecallAt10),
      gates.gates.macroRecallAt10,
    ),
    familyRecallAt10,
    positiveCaseHitRate: exactGate(
      {
        numerator: evidence.qualitySummary.positiveCaseHitRate.hits,
        denominator: evidence.qualitySummary.positiveCaseHitRate.cases,
      },
      gates.gates.positiveCaseHitRate,
    ),
    meanReciprocalRank: scalarMinimumGate(
      requireMetricValue(evidence.qualitySummary.macroMeanReciprocalRank),
      gates.gates.meanReciprocalRank,
    ),
    ndcgAt10: scalarMinimumGate(
      requireMetricValue(evidence.qualitySummary.macroNdcgAt10),
      gates.gates.ndcgAt10,
    ),
  };
  const safety = {
    candidateHardFilterCorrectness: exactGate(
      metricCounts(evidence.safetySummary.candidateHardFilterCorrectness),
      gates.gates.exactCorrectness.hardFilter,
    ),
    prohibitedConstraintPreservation: exactGate(
      metricCounts(evidence.safetySummary.prohibitedConstraintPreservation),
      gates.gates.exactCorrectness.prohibitedPreservation,
    ),
    noEligibleCandidateCorrectness: exactGate(
      metricCounts(evidence.safetySummary.noEligibleCandidateCorrectness),
      gates.gates.exactCorrectness.noEligible,
    ),
    hardConflictResults: scalarMaximumGate(
      score.safetyViolations.conflict,
      gates.gates.maximumViolations.hardConflictResults,
    ),
    laneViolations: scalarMaximumGate(
      score.safetyViolations.laneError,
      gates.gates.maximumViolations.lane,
    ),
    negativeControlViolations: scalarMaximumGate(
      score.safetyViolations.negativeControl,
      gates.gates.maximumViolations.negativeControl,
    ),
    exactDuplicates: scalarMaximumGate(
      evidence.safetySummary.exactDuplicateRate.numerator,
      gates.gates.maximumViolations.exactDuplicates,
    ),
    controlledEquivalenceDuplicates: scalarMaximumGate(
      evidence.safetySummary.controlledEquivalenceDuplicateRate.numerator,
      gates.gates.maximumViolations.controlledEquivalenceDuplicates,
    ),
  };
  return {
    authorityBindings: {
      corpusSemanticDigest: gates.authorityBindings.corpusSemanticDigest,
      independentReviewDigest: gates.authorityBindings.independentReviewDigest,
      baselineReportDigest: gates.authorityBindings.baselineReportDigest,
      saturationProofDigest: gates.saturationProof.proofDigest,
      qualityGateDigest: gates.semanticDigest,
    },
    quality,
    safety,
    overallPass: [
      quality.macroRecallAt10,
      ...Object.values(quality.familyRecallAt10),
      quality.positiveCaseHitRate,
      quality.meanReciprocalRank,
      quality.ndcgAt10,
      ...Object.values(safety),
    ].every(({ pass }) => pass),
  };
}

function scalarMinimumGate(
  measured: number,
  required: number,
): ScalarGateEvaluation {
  return { measured, required, pass: measured >= required };
}

function scalarMaximumGate(
  measured: number,
  required: number,
): ScalarGateEvaluation {
  return { measured, required, pass: measured <= required };
}

function exactGate(
  measured: ExactGateValue,
  required: ExactGateValue,
): ExactGateEvaluation {
  return {
    measured,
    required,
    pass:
      measured.numerator === required.numerator &&
      measured.denominator === required.denominator,
  };
}

function metricCounts(value: MetricValue): ExactGateValue {
  return { numerator: value.numerator, denominator: value.denominator };
}

function requireMetricValue(value: MetricValue): number {
  if (value.value === null) throw new Error('Required metric is inapplicable.');
  return value.value;
}

function requireNumber(value: number | undefined): number {
  if (value === undefined) throw new Error('Required gate is missing.');
  return value;
}

function requireMetric(
  metrics: Readonly<Record<string, MetricValue>>,
  name: string,
): MetricValue {
  const value = metrics[name];
  if (value === undefined)
    throw new Error('Expected retrieval metric missing.');
  return value;
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) {
    return value;
  }
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
