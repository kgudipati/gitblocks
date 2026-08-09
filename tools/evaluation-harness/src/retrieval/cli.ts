import type { RetrievalPredictionSet } from './contracts.ts';
import {
  runRetrievalBaselinesV1,
  runRetrievalBaselinesV2,
} from './baseline-runner.ts';
import {
  writeRetrievalBaselineReportV1,
  writeRetrievalBaselineReportV2,
} from './baseline-writer.ts';
import { verifyRetrievalBaselinesV1 } from './baseline-verification.ts';
import { verifyRetrievalBaselinesV2 } from './baseline-verification-v2.ts';
import { loadRetrievalCorpusV1, loadRetrievalCorpusV2 } from './corpus.ts';
import { runRetrievalScorerFixtures } from './fixtures.ts';
import { loadRetrievalJsonFile } from './json-boundary.ts';
import { validateRetrievalPredictionSetV1 } from './predictions.ts';
import {
  validateRetrievalV2GateAuthorities,
  writeRetrievalV2GateAuthorities,
} from './quality-gates.ts';
import { scoreRetrievalPredictionSet } from './scoring.ts';
import { createRetrievalSchemaRegistry } from './schema-registry.ts';
import { retrievalStableJson } from './stable-json.ts';
import { findGitBlocksRoot } from '../repository-root.ts';
import {
  runProductionRetrievalEvaluationV1,
  runProductionRetrievalEvaluationV2,
} from './production-runner.ts';

export interface RetrievalCliOutput {
  readonly error: (line: string) => void;
  readonly log: (line: string) => void;
}

export function runRetrievalCli(
  args: readonly string[],
  startDirectory = process.cwd(),
  output: RetrievalCliOutput = console,
): number {
  const command = args[0];
  if (
    (command === 'baselines' ||
      command === 'baselines-generate' ||
      command === 'baselines-v2' ||
      command === 'baselines-generate-v2' ||
      command === 'verify' ||
      command === 'verify-v2' ||
      command === 'gates-generate-v2' ||
      command === 'gates-validate-v2' ||
      command === 'production' ||
      command === 'production-v2') &&
    args.length !== 1
  ) {
    output.error('Unexpected retrieval baseline arguments.');
    return 1;
  }
  let repositoryRoot: string;
  try {
    repositoryRoot = findGitBlocksRoot(startDirectory);
  } catch {
    output.error('Retrieval evaluation repository root was not found.');
    return 1;
  }
  if (command === 'baselines') {
    try {
      output.log(
        retrievalStableJson(
          runRetrievalBaselinesV1(repositoryRoot).report,
        ).trimEnd(),
      );
      return 0;
    } catch {
      output.error('Retrieval baseline run failed.');
      return 1;
    }
  }
  if (command === 'baselines-v2') {
    try {
      output.log(
        retrievalStableJson(
          runRetrievalBaselinesV2(repositoryRoot).report,
        ).trimEnd(),
      );
      return 0;
    } catch {
      output.error('Retrieval-v2 baseline run failed.');
      return 1;
    }
  }
  if (command === 'baselines-generate') {
    try {
      const report = runRetrievalBaselinesV1(repositoryRoot).report;
      writeRetrievalBaselineReportV1(repositoryRoot, report);
      output.log('Retrieval baseline report generated at its fixed path.');
      return 0;
    } catch {
      output.error('Retrieval baseline report generation failed.');
      return 1;
    }
  }
  if (command === 'baselines-generate-v2') {
    try {
      const report = runRetrievalBaselinesV2(repositoryRoot).report;
      writeRetrievalBaselineReportV2(repositoryRoot, report);
      output.log('Retrieval-v2 baseline report generated at its fixed path.');
      return 0;
    } catch {
      output.error('Retrieval-v2 baseline report generation failed.');
      return 1;
    }
  }
  if (command === 'verify') {
    try {
      output.log(
        retrievalStableJson(
          verifyRetrievalBaselinesV1(repositoryRoot),
        ).trimEnd(),
      );
      return 0;
    } catch {
      output.error('Retrieval baseline verification failed.');
      return 1;
    }
  }
  if (command === 'verify-v2') {
    try {
      output.log(
        retrievalStableJson(
          verifyRetrievalBaselinesV2(repositoryRoot),
        ).trimEnd(),
      );
      return 0;
    } catch {
      output.error('Retrieval-v2 baseline verification failed.');
      return 1;
    }
  }
  if (command === 'gates-generate-v2') {
    try {
      const authorities = writeRetrievalV2GateAuthorities(repositoryRoot);
      output.log(
        retrievalStableJson({
          qualityGateDigest: authorities.qualityGates.semanticDigest,
          saturationProofDigest: authorities.saturationProof.semanticDigest,
        }).trimEnd(),
      );
      return 0;
    } catch {
      output.error('Retrieval-v2 gate generation failed.');
      return 1;
    }
  }
  if (command === 'gates-validate-v2') {
    try {
      const authorities = validateRetrievalV2GateAuthorities(repositoryRoot);
      output.log(
        retrievalStableJson({
          qualityGateDigest: authorities.qualityGates.semanticDigest,
          saturationProofDigest: authorities.saturationProof.semanticDigest,
        }).trimEnd(),
      );
      return 0;
    } catch {
      output.error('Retrieval-v2 gate validation failed.');
      return 1;
    }
  }
  if (command === 'production') {
    try {
      output.log(
        retrievalStableJson(
          runProductionRetrievalEvaluationV1(repositoryRoot),
        ).trimEnd(),
      );
      return 0;
    } catch {
      output.error('Production retrieval evaluation failed.');
      return 1;
    }
  }
  if (command === 'production-v2') {
    try {
      output.log(
        retrievalStableJson(
          runProductionRetrievalEvaluationV2(repositoryRoot),
        ).trimEnd(),
      );
      return 0;
    } catch {
      output.error('Production retrieval-v2 evaluation failed.');
      return 1;
    }
  }
  if (command === 'fixtures') {
    try {
      output.log(retrievalStableJson(runRetrievalScorerFixtures()).trimEnd());
      return 0;
    } catch {
      output.error('Retrieval scorer fixtures failed.');
      return 1;
    }
  }
  if (
    command !== 'score' &&
    command !== 'validate' &&
    command !== 'validate-v2'
  ) {
    output.error(
      'Use validate, validate-v2, fixtures, baselines, baselines-v2, baselines-generate, baselines-generate-v2, verify, verify-v2, gates-generate-v2, gates-validate-v2, production, production-v2, or score --prediction <path>.',
    );
    return 1;
  }
  const predictionFlag = args.indexOf('--prediction');
  const predictionPath = args[predictionFlag + 1];
  if (
    command === 'score' &&
    (predictionFlag < 0 || predictionPath === undefined)
  ) {
    output.error('A repository-relative prediction path is required.');
    return 1;
  }
  const scorePredictionPath = predictionPath ?? '';
  const loaded =
    command === 'validate-v2'
      ? loadRetrievalCorpusV2(repositoryRoot)
      : loadRetrievalCorpusV1(repositoryRoot);
  if (!loaded.ok) {
    for (const diagnostic of loaded.diagnostics) {
      output.error(`${diagnostic.code} ${diagnostic.path}`.trim());
    }
    return 1;
  }
  if (command === 'validate' || command === 'validate-v2') {
    output.log(
      `${loaded.corpus.manifest.corpusId} valid (${String(loaded.corpus.retrievalCases.length)} retrieval; ${String(loaded.corpus.normalizationCases.length)} normalization; ${loaded.corpus.manifest.corpusSemanticDigest}).`,
    );
    return 0;
  }
  try {
    const value = loadRetrievalJsonFile(repositoryRoot, scorePredictionPath);
    const diagnostics = validateRetrievalPredictionSetV1(
      value,
      loaded.corpus,
      repositoryRoot,
    );
    if (diagnostics.length > 0) {
      diagnostics.forEach(({ code, path }) => {
        output.error(`${code} ${path}`.trim());
      });
      return 1;
    }
    const report = scoreRetrievalPredictionSet(
      loaded.corpus,
      value as RetrievalPredictionSet,
    );
    if (
      createRetrievalSchemaRegistry(repositoryRoot).validate(
        'score-report',
        report,
      ).length > 0
    ) {
      output.error('Retrieval score report failed its closed schema.');
      return 1;
    }
    output.log(retrievalStableJson(report).trimEnd());
    return 0;
  } catch {
    output.error('Retrieval prediction could not be read or scored.');
    return 1;
  }
}

if (
  process.argv[1]?.endsWith('retrieval/cli.ts') === true ||
  process.argv[1]?.endsWith('retrieval/cli.js') === true
) {
  process.exitCode = runRetrievalCli(process.argv.slice(2));
}
