import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import { generateRetrievalBaselinePredictionSetsV1 } from './baseline-generation.ts';
import {
  createRetrievalBaselineReportV1,
  validateRetrievalBaselineReportV1,
} from './baseline-report.ts';
import { RETRIEVAL_BASELINE_REPORT_RELATIVE_PATH } from './baseline-writer.ts';
import type {
  RetrievalPredictionSet,
  RetrievalScoreReport,
  ValidatedRetrievalCorpus,
} from './contracts.ts';
import { loadRetrievalCorpusV1 } from './corpus.ts';
import { runRetrievalScorerFixtures } from './fixtures.ts';
import { validateRetrievalPredictionSetV1 } from './predictions.ts';
import { scoreRetrievalPredictionSet } from './scoring.ts';
import { createRetrievalSchemaRegistry } from './schema-registry.ts';
import { retrievalStableJson } from './stable-json.ts';
import { runRetrievalFixtureOracle } from './synthetic-fixture-oracle.ts';

export interface RetrievalBaselineVerificationEvidence {
  readonly verificationVersion: 'retrieval-baseline-verification/1.0.0';
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

export function verifyRetrievalBaselinesV1(
  repositoryRoot: string,
): RetrievalBaselineVerificationEvidence {
  const reportPath = join(
    repositoryRoot,
    RETRIEVAL_BASELINE_REPORT_RELATIVE_PATH,
  );
  const before = effectSnapshot(reportPath);

  validateCorpusInIsolatedProcess(repositoryRoot);
  const fixtures = runRetrievalScorerFixtures();

  const first = generateRetrievalBaselinePredictionSetsV1(repositoryRoot);
  const second = generateRetrievalBaselinePredictionSetsV1(repositoryRoot);
  if (retrievalStableJson(first) !== retrievalStableJson(second)) {
    throw new Error('Repeated baseline prediction generation drifted.');
  }
  const reversed = generateRetrievalBaselinePredictionSetsV1(repositoryRoot, {
    authorityOrder: 'reverse',
  });
  if (retrievalStableJson(first) !== retrievalStableJson(reversed)) {
    throw new Error('Reversed candidate authority order changed predictions.');
  }

  const loaded = loadRetrievalCorpusV1(repositoryRoot);
  if (!loaded.ok) throw new Error('Retrieval corpus validation failed.');
  const firstScores = scoreAll(loaded.corpus, first, repositoryRoot);
  const secondScores = scoreAll(loaded.corpus, second, repositoryRoot);
  if (retrievalStableJson(firstScores) !== retrievalStableJson(secondScores)) {
    throw new Error('Repeated baseline scoring drifted.');
  }
  const fixtureOracle = runRetrievalFixtureOracle();
  const firstReport = createReport(
    loaded.corpus,
    first,
    firstScores,
    fixtureOracle,
    repositoryRoot,
  );
  const secondReport = createReport(
    loaded.corpus,
    second,
    secondScores,
    fixtureOracle,
    repositoryRoot,
  );
  const generatedBytes = retrievalStableJson(firstReport);
  if (generatedBytes !== retrievalStableJson(secondReport)) {
    throw new Error('Repeated baseline report aggregation drifted.');
  }
  if (!existsSync(reportPath) || lstatSync(reportPath).isSymbolicLink()) {
    throw new Error('Committed baseline report is missing or symlinked.');
  }
  const committedBytes = readFileSync(reportPath, 'utf8');
  if (committedBytes !== generatedBytes) {
    throw new Error('Committed baseline report differs from generation.');
  }
  const parsed = JSON.parse(committedBytes) as unknown;
  if (validateRetrievalBaselineReportV1(parsed, repositoryRoot).length > 0) {
    throw new Error('Committed baseline report failed validation.');
  }
  const after = effectSnapshot(reportPath);
  if (retrievalStableJson(before) !== retrievalStableJson(after)) {
    throw new Error('Read-only baseline verification changed report state.');
  }
  return {
    verificationVersion: 'retrieval-baseline-verification/1.0.0',
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
  predictions: ReturnType<typeof generateRetrievalBaselinePredictionSetsV1>,
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
    validateRetrievalPredictionSetV1(prediction, corpus, repositoryRoot)
      .length > 0
  ) {
    throw new Error('Frozen baseline prediction failed full validation.');
  }
  const score = scoreRetrievalPredictionSet(corpus, prediction);
  if (
    createRetrievalSchemaRegistry(repositoryRoot).validate(
      'score-report',
      score,
    ).length > 0
  ) {
    throw new Error('Repeated baseline score failed schema validation.');
  }
  return score;
}

function createReport(
  corpus: ValidatedRetrievalCorpus,
  predictions: ReturnType<typeof generateRetrievalBaselinePredictionSetsV1>,
  scores: ReturnType<typeof scoreAll>,
  fixtureOracle: ReturnType<typeof runRetrievalFixtureOracle>,
  repositoryRoot: string,
) {
  return createRetrievalBaselineReportV1(
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
      fixtureOracle,
    },
    repositoryRoot,
  );
}

function validateCorpusInIsolatedProcess(repositoryRoot: string): void {
  const cli = fileURLToPath(new URL('./cli.ts', import.meta.url));
  const result = spawnSync(process.execPath, [cli, 'validate'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
    timeout: 60_000,
  });
  if (
    result.status !== 0 ||
    !result.stdout.includes(
      'retrieval-v1 valid (30 retrieval; 20 normalization;',
    )
  ) {
    throw new Error('Isolated retrieval corpus validation failed.');
  }
}

interface EffectSnapshot {
  readonly exists: boolean;
  readonly bytesDigest: string | null;
  readonly size: number | null;
  readonly mode: number | null;
  readonly modifiedMilliseconds: number | null;
  readonly changedMilliseconds: number | null;
}

function effectSnapshot(path: string): EffectSnapshot {
  if (!existsSync(path)) {
    return {
      exists: false,
      bytesDigest: null,
      size: null,
      mode: null,
      modifiedMilliseconds: null,
      changedMilliseconds: null,
    };
  }
  const status = lstatSync(path);
  return {
    exists: true,
    bytesDigest: status.isFile() ? sha256(readFileSync(path)) : null,
    size: status.size,
    mode: status.mode,
    modifiedMilliseconds: status.mtimeMs,
    changedMilliseconds: status.ctimeMs,
  };
}

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}
