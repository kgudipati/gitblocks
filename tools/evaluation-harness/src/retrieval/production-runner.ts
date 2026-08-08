import { findGitBlocksRoot } from '../repository-root.ts';
import {
  RETRIEVAL_FAMILIES,
  type MetricValue,
  type RetrievalCaseScore,
  type RetrievalFamily,
  type RetrievalScoreReport,
} from './contracts.ts';
import { loadRetrievalCorpusV1 } from './corpus.ts';
import {
  generateProductionRetrievalPredictionSetV1,
  type ProductionRetrievalDifferentialEvidenceV1,
  type ProductionRetrievalPerformanceEvidenceV1,
} from './production-generation.ts';
import { validateRetrievalPredictionSetV1 } from './predictions.ts';
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
  readonly differential: ProductionRetrievalDifferentialEvidenceV1;
  readonly performance: ProductionRetrievalPerformanceEvidenceV1;
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

  return deepFreeze({
    evaluationPathVersion: 'production-retrieval-evaluation/1.0.0',
    score,
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
    differential: generated.differential,
    performance: generated.performance,
  });
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
