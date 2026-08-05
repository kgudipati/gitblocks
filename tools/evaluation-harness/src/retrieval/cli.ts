import type { RetrievalPredictionSet } from './contracts.ts';
import { loadRetrievalCorpusV1 } from './corpus.ts';
import { runRetrievalScorerFixtures } from './fixtures.ts';
import { loadRetrievalJsonFile } from './json-boundary.ts';
import { validateRetrievalPredictionSetV1 } from './predictions.ts';
import { scoreRetrievalPredictionSet } from './scoring.ts';
import { createRetrievalSchemaRegistry } from './schema-registry.ts';
import { retrievalStableJson } from './stable-json.ts';
import { findGitBlocksRoot } from '../repository-root.ts';

export interface RetrievalCliOutput {
  readonly error: (line: string) => void;
  readonly log: (line: string) => void;
}

export function runRetrievalCli(
  args: readonly string[],
  startDirectory = process.cwd(),
  output: RetrievalCliOutput = console,
): number {
  let repositoryRoot: string;
  try {
    repositoryRoot = findGitBlocksRoot(startDirectory);
  } catch {
    output.error('Retrieval evaluation repository root was not found.');
    return 1;
  }
  const command = args[0];
  if (command === 'fixtures') {
    try {
      output.log(retrievalStableJson(runRetrievalScorerFixtures()).trimEnd());
      return 0;
    } catch {
      output.error('Retrieval scorer fixtures failed.');
      return 1;
    }
  }
  if (command !== 'score' && command !== 'validate') {
    output.error('Use validate, fixtures, or score --prediction <path>.');
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
  const loaded = loadRetrievalCorpusV1(repositoryRoot);
  if (!loaded.ok) {
    for (const diagnostic of loaded.diagnostics) {
      output.error(`${diagnostic.code} ${diagnostic.path}`.trim());
    }
    return 1;
  }
  if (command === 'validate') {
    output.log(
      `retrieval-v1 valid (${String(loaded.corpus.retrievalCases.length)} retrieval; ${String(loaded.corpus.normalizationCases.length)} normalization; ${loaded.corpus.manifest.corpusSemanticDigest}).`,
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
