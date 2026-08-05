import { findGitBlocksRoot } from '../repository-root.ts';
import { generateRetrievalBaselinePredictionSetsV1 } from './baseline-generation.ts';
import {
  createRetrievalBaselineReportV1,
  type RetrievalBaselineReport,
} from './baseline-report.ts';
import type {
  RetrievalPredictionSet,
  RetrievalScoreReport,
  ValidatedRetrievalCorpus,
} from './contracts.ts';
import { loadRetrievalCorpusV1 } from './corpus.ts';
import { validateRetrievalPredictionSetV1 } from './predictions.ts';
import { scoreRetrievalPredictionSet } from './scoring.ts';
import { createRetrievalSchemaRegistry } from './schema-registry.ts';
import { runRetrievalFixtureOracle } from './synthetic-fixture-oracle.ts';

export interface RetrievalBaselineRunArtifacts {
  readonly report: RetrievalBaselineReport;
  readonly predictionSets: ReturnType<
    typeof generateRetrievalBaselinePredictionSetsV1
  >;
  readonly scoreReports: {
    readonly familyOnly: RetrievalScoreReport;
    readonly exactKeyword: RetrievalScoreReport;
    readonly aliasExpanded: RetrievalScoreReport;
    readonly alwaysAbstain: RetrievalScoreReport;
    readonly constraintViolating: RetrievalScoreReport;
  };
}

export function runRetrievalBaselinesV1(
  startDirectory = process.cwd(),
): RetrievalBaselineRunArtifacts {
  const repositoryRoot = findGitBlocksRoot(startDirectory);

  // Binding phase one: every prediction is generated, validated, and digested
  // from blind queries and safe structured authority before gold is loaded.
  const predictionSets =
    generateRetrievalBaselinePredictionSetsV1(repositoryRoot);

  // Binding phase two begins only after all prediction sets are frozen.
  const loaded = loadRetrievalCorpusV1(repositoryRoot);
  if (!loaded.ok) throw new Error('Retrieval corpus validation failed.');
  const scoreReports = {
    familyOnly: validateAndScore(
      loaded.corpus,
      predictionSets.familyOnly,
      repositoryRoot,
    ),
    exactKeyword: validateAndScore(
      loaded.corpus,
      predictionSets.exactKeyword,
      repositoryRoot,
    ),
    aliasExpanded: validateAndScore(
      loaded.corpus,
      predictionSets.aliasExpanded,
      repositoryRoot,
    ),
    alwaysAbstain: validateAndScore(
      loaded.corpus,
      predictionSets.alwaysAbstain,
      repositoryRoot,
    ),
    constraintViolating: validateAndScore(
      loaded.corpus,
      predictionSets.constraintViolating,
      repositoryRoot,
    ),
  };
  const report = createRetrievalBaselineReportV1(
    {
      corpus: loaded.corpus,
      familyOnly: {
        prediction: predictionSets.familyOnly,
        score: scoreReports.familyOnly,
      },
      exactKeyword: {
        prediction: predictionSets.exactKeyword,
        score: scoreReports.exactKeyword,
      },
      aliasExpanded: {
        prediction: predictionSets.aliasExpanded,
        score: scoreReports.aliasExpanded,
      },
      alwaysAbstain: {
        prediction: predictionSets.alwaysAbstain,
        score: scoreReports.alwaysAbstain,
      },
      constraintViolating: {
        prediction: predictionSets.constraintViolating,
        score: scoreReports.constraintViolating,
      },
      fixtureOracle: runRetrievalFixtureOracle(),
    },
    repositoryRoot,
  );
  return { report, predictionSets, scoreReports };
}

function validateAndScore(
  corpus: ValidatedRetrievalCorpus,
  predictionSet: RetrievalPredictionSet,
  repositoryRoot: string,
): RetrievalScoreReport {
  const predictionDiagnostics = validateRetrievalPredictionSetV1(
    predictionSet,
    corpus,
    repositoryRoot,
  );
  if (predictionDiagnostics.length > 0) {
    throw new Error(
      'Frozen baseline prediction set failed scoring validation.',
    );
  }
  const score = scoreRetrievalPredictionSet(corpus, predictionSet);
  if (
    createRetrievalSchemaRegistry(repositoryRoot).validate(
      'score-report',
      score,
    ).length > 0
  ) {
    throw new Error('Baseline score report failed its closed schema.');
  }
  return score;
}
