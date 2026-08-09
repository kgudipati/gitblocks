import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import { generateRetrievalBaselinePredictionSetsV2 } from './baseline-generation.ts';
import {
  createRetrievalBaselineReportV2,
  validateRetrievalBaselineReportV2,
} from './baseline-report.ts';
import { RETRIEVAL_V2_BASELINE_REPORT_RELATIVE_PATH } from './baseline-writer.ts';
import type {
  RetrievalPredictionSet,
  RetrievalScoreReport,
  ValidatedRetrievalCorpus,
} from './contracts.ts';
import { loadRetrievalCorpusV2 } from './corpus.ts';
import { runRetrievalScorerFixtures } from './fixtures.ts';
import { validateRetrievalPredictionSetV2 } from './predictions.ts';
import { scoreRetrievalPredictionSet } from './scoring.ts';
import { createRetrievalSchemaRegistry } from './schema-registry.ts';
import { retrievalStableJson } from './stable-json.ts';
import { runRetrievalFixtureOracle } from './synthetic-fixture-oracle.ts';

export interface RetrievalBaselineVerificationEvidenceV2 {
  readonly verificationVersion: 'retrieval-baseline-verification/2.0.0';
  readonly corpusValidation: 'passed-in-isolated-process';
  readonly scorerFixtureCount: 26;
  readonly predictionSetCount: 5;
  readonly predictionGenerationCount: 2;
  readonly reverseAuthorityOrderMatched: true;
  readonly scoreReportCount: 5;
  readonly reportDigest: string;
  readonly committedBytesDigest: string;
  readonly effectAudit: 'no-write';
}

export function verifyRetrievalBaselinesV2(
  repositoryRoot: string,
): RetrievalBaselineVerificationEvidenceV2 {
  const reportPath = join(
    repositoryRoot,
    RETRIEVAL_V2_BASELINE_REPORT_RELATIVE_PATH,
  );
  const before = effectSnapshot(reportPath);
  validateCorpusInIsolatedProcess(repositoryRoot);
  const fixtures = runRetrievalScorerFixtures();
  const first = generateRetrievalBaselinePredictionSetsV2(repositoryRoot);
  const second = generateRetrievalBaselinePredictionSetsV2(repositoryRoot);
  if (retrievalStableJson(first) !== retrievalStableJson(second)) {
    throw new Error('Repeated retrieval-v2 baseline generation drifted.');
  }
  const reversed = generateRetrievalBaselinePredictionSetsV2(repositoryRoot, {
    authorityOrder: 'reverse',
  });
  if (retrievalStableJson(first) !== retrievalStableJson(reversed)) {
    throw new Error(
      'Reversed authority order changed retrieval-v2 predictions.',
    );
  }
  const loaded = loadRetrievalCorpusV2(repositoryRoot);
  if (!loaded.ok) throw new Error('Retrieval-v2 corpus validation failed.');
  const firstScores = scoreAll(loaded.corpus, first, repositoryRoot);
  const secondScores = scoreAll(loaded.corpus, second, repositoryRoot);
  if (retrievalStableJson(firstScores) !== retrievalStableJson(secondScores)) {
    throw new Error('Repeated retrieval-v2 scoring drifted.');
  }
  const firstReport = createReport(
    loaded.corpus,
    first,
    firstScores,
    repositoryRoot,
  );
  const secondReport = createReport(
    loaded.corpus,
    second,
    secondScores,
    repositoryRoot,
  );
  const generatedBytes = retrievalStableJson(firstReport);
  if (generatedBytes !== retrievalStableJson(secondReport)) {
    throw new Error('Repeated retrieval-v2 report aggregation drifted.');
  }
  if (!existsSync(reportPath) || lstatSync(reportPath).isSymbolicLink()) {
    throw new Error('Committed retrieval-v2 baseline report is missing.');
  }
  const committedBytes = readFileSync(reportPath, 'utf8');
  if (
    committedBytes !== generatedBytes ||
    validateRetrievalBaselineReportV2(
      JSON.parse(committedBytes),
      repositoryRoot,
    ).length > 0
  ) {
    throw new Error('Committed retrieval-v2 baseline report drifted.');
  }
  if (
    retrievalStableJson(before) !==
    retrievalStableJson(effectSnapshot(reportPath))
  ) {
    throw new Error(
      'Read-only retrieval-v2 verification changed report state.',
    );
  }
  return {
    verificationVersion: 'retrieval-baseline-verification/2.0.0',
    corpusValidation: 'passed-in-isolated-process',
    scorerFixtureCount: fixtures.fixtureCount,
    predictionSetCount: 5,
    predictionGenerationCount: 2,
    reverseAuthorityOrderMatched: true,
    scoreReportCount: 5,
    reportDigest: firstReport.reportSemanticDigest,
    committedBytesDigest: sha256(committedBytes),
    effectAudit: 'no-write',
  };
}

function scoreAll(
  corpus: ValidatedRetrievalCorpus,
  predictions: ReturnType<typeof generateRetrievalBaselinePredictionSetsV2>,
  repositoryRoot: string,
): Record<keyof typeof predictions, RetrievalScoreReport> {
  return {
    familyOnly: scoreOne(corpus, predictions.familyOnly, repositoryRoot),
    exactKeyword: scoreOne(corpus, predictions.exactKeyword, repositoryRoot),
    aliasExpanded: scoreOne(corpus, predictions.aliasExpanded, repositoryRoot),
    alwaysAbstain: scoreOne(corpus, predictions.alwaysAbstain, repositoryRoot),
    constraintViolating: scoreOne(
      corpus,
      predictions.constraintViolating,
      repositoryRoot,
    ),
  };
}

function scoreOne(
  corpus: ValidatedRetrievalCorpus,
  prediction: RetrievalPredictionSet,
  repositoryRoot: string,
): RetrievalScoreReport {
  if (
    validateRetrievalPredictionSetV2(prediction, corpus, repositoryRoot)
      .length > 0
  ) {
    throw new Error('Frozen retrieval-v2 prediction failed validation.');
  }
  const score = scoreRetrievalPredictionSet(corpus, prediction);
  if (
    createRetrievalSchemaRegistry(repositoryRoot, 'v2').validate(
      'score-report',
      score,
    ).length > 0
  ) {
    throw new Error('Retrieval-v2 score report failed schema validation.');
  }
  return score;
}

function createReport(
  corpus: ValidatedRetrievalCorpus,
  predictions: ReturnType<typeof generateRetrievalBaselinePredictionSetsV2>,
  scores: ReturnType<typeof scoreAll>,
  repositoryRoot: string,
) {
  return createRetrievalBaselineReportV2(
    {
      corpus,
      familyOnly: {
        prediction: predictions.familyOnly,
        score: scores.familyOnly,
      },
      exactKeyword: {
        prediction: predictions.exactKeyword,
        score: scores.exactKeyword,
      },
      aliasExpanded: {
        prediction: predictions.aliasExpanded,
        score: scores.aliasExpanded,
      },
      alwaysAbstain: {
        prediction: predictions.alwaysAbstain,
        score: scores.alwaysAbstain,
      },
      constraintViolating: {
        prediction: predictions.constraintViolating,
        score: scores.constraintViolating,
      },
      fixtureOracle: runRetrievalFixtureOracle(),
    },
    repositoryRoot,
  );
}

function validateCorpusInIsolatedProcess(repositoryRoot: string): void {
  const cli = fileURLToPath(new URL('./cli.ts', import.meta.url));
  const result = spawnSync(process.execPath, [cli, 'validate-v2'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
    timeout: 60_000,
  });
  if (
    result.status !== 0 ||
    !result.stdout.includes(
      'retrieval-v2 valid (30 retrieval; 20 normalization;',
    )
  ) {
    throw new Error('Isolated retrieval-v2 corpus validation failed.');
  }
}

function effectSnapshot(path: string) {
  if (!existsSync(path)) return { exists: false } as const;
  const status = lstatSync(path);
  return {
    exists: true,
    bytesDigest: status.isFile() ? sha256(readFileSync(path)) : null,
    size: status.size,
    mode: status.mode,
    modifiedMilliseconds: status.mtimeMs,
    changedMilliseconds: status.ctimeMs,
  } as const;
}

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}
