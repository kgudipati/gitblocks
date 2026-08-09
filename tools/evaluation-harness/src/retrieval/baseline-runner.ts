import { findGitBlocksRoot } from '../repository-root.ts';
import {
  generateRetrievalBaselinePredictionSetsV1,
  generateRetrievalBaselinePredictionSetsV2,
} from './baseline-generation.ts';
import {
  createRetrievalBaselineReportV1,
  createRetrievalBaselineReportV2,
  type RetrievalBaselineReport,
} from './baseline-report.ts';
import type {
  RetrievalPredictionSet,
  RetrievalScoreReport,
  ValidatedRetrievalCorpus,
} from './contracts.ts';
import { loadRetrievalCorpusV1, loadRetrievalCorpusV2 } from './corpus.ts';
import {
  validateRetrievalPredictionSetV1,
  validateRetrievalPredictionSetV2,
} from './predictions.ts';
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
  return runRetrievalBaselines(startDirectory, 'v1');
}

export function runRetrievalBaselinesV2(
  startDirectory = process.cwd(),
): RetrievalBaselineRunArtifacts {
  return runRetrievalBaselines(startDirectory, 'v2');
}

function runRetrievalBaselines(
  startDirectory: string,
  authorityVersion: 'v1' | 'v2',
): RetrievalBaselineRunArtifacts {
  const repositoryRoot = findGitBlocksRoot(startDirectory);

  // Binding phase one: every prediction is generated, validated, and digested
  // from blind queries and safe structured authority before gold is loaded.
  const predictionSets =
    authorityVersion === 'v1'
      ? generateRetrievalBaselinePredictionSetsV1(repositoryRoot)
      : generateRetrievalBaselinePredictionSetsV2(repositoryRoot);

  // Binding phase two begins only after all prediction sets are frozen.
  const loaded =
    authorityVersion === 'v1'
      ? loadRetrievalCorpusV1(repositoryRoot)
      : loadRetrievalCorpusV2(repositoryRoot);
  if (!loaded.ok) throw new Error('Retrieval corpus validation failed.');
  const scoreReports = {
    familyOnly: validateAndScore(
      loaded.corpus,
      predictionSets.familyOnly,
      repositoryRoot,
      authorityVersion,
    ),
    exactKeyword: validateAndScore(
      loaded.corpus,
      predictionSets.exactKeyword,
      repositoryRoot,
      authorityVersion,
    ),
    aliasExpanded: validateAndScore(
      loaded.corpus,
      predictionSets.aliasExpanded,
      repositoryRoot,
      authorityVersion,
    ),
    alwaysAbstain: validateAndScore(
      loaded.corpus,
      predictionSets.alwaysAbstain,
      repositoryRoot,
      authorityVersion,
    ),
    constraintViolating: validateAndScore(
      loaded.corpus,
      predictionSets.constraintViolating,
      repositoryRoot,
      authorityVersion,
    ),
  };
  const reportInputs = {
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
  };
  const report =
    authorityVersion === 'v1'
      ? createRetrievalBaselineReportV1(reportInputs, repositoryRoot)
      : createRetrievalBaselineReportV2(reportInputs, repositoryRoot);
  return { report, predictionSets, scoreReports };
}

function validateAndScore(
  corpus: ValidatedRetrievalCorpus,
  predictionSet: RetrievalPredictionSet,
  repositoryRoot: string,
  authorityVersion: 'v1' | 'v2',
): RetrievalScoreReport {
  const predictionDiagnostics =
    authorityVersion === 'v1'
      ? validateRetrievalPredictionSetV1(predictionSet, corpus, repositoryRoot)
      : validateRetrievalPredictionSetV2(predictionSet, corpus, repositoryRoot);
  if (predictionDiagnostics.length > 0) {
    throw new Error(
      'Frozen baseline prediction set failed scoring validation.',
    );
  }
  const score = scoreRetrievalPredictionSet(corpus, predictionSet);
  if (
    createRetrievalSchemaRegistry(repositoryRoot, authorityVersion).validate(
      'score-report',
      score,
    ).length > 0
  ) {
    throw new Error('Baseline score report failed its closed schema.');
  }
  return score;
}
