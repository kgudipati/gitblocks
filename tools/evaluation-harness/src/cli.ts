import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadCorpus } from './corpus.ts';
import { EvaluationBoundaryError } from './json-boundary.ts';
import { loadPredictions } from './predictions.ts';
import { validatePrediction } from './referential-integrity.ts';
import { findGitBlocksRoot } from './repository-root.ts';
import { createSchemaRegistry } from './schema-registry.ts';
import { scoreCorpus } from './scoring.ts';
import { stableJson } from './stable-json.ts';
import { createWeakPredictionSet, WEAK_STRATEGIES } from './weak-fixtures.ts';

export const EXIT_CODES = {
  success: 0,
  validation: 1,
  usage: 2,
  internal: 3,
} as const;

interface Output {
  readonly error: (message: string) => void;
  readonly log: (message: string) => void;
}

export function runCli(
  arguments_: readonly string[],
  workingDirectory: string,
  output: Output,
): number {
  try {
    const repositoryRoot = findGitBlocksRoot(workingDirectory);
    const corpus = loadCorpus(repositoryRoot);
    if (!corpus.ok) {
      reportDiagnostics(corpus.diagnostics, output);
      return EXIT_CODES.validation;
    }
    const [command, ...values] = arguments_;
    if (command === 'validate' && values.length === 0) {
      output.log(
        `Evaluation corpus validation passed (${String(corpus.bundles.length)} cases).`,
      );
      return EXIT_CODES.success;
    }
    if (
      command === 'score' &&
      values.length === 2 &&
      values[0] === '--prediction' &&
      values[1] !== undefined
    ) {
      const loaded = loadPredictions(repositoryRoot, values[1], corpus.bundles);
      if (!loaded.ok) {
        reportDiagnostics(loaded.diagnostics, output);
        return EXIT_CODES.validation;
      }
      const predictionSetId = normalizePredictionSetId(values[1]);
      const report = scoreCorpus(
        corpus.manifest.corpusId,
        predictionSetId,
        loaded.bundles,
        loaded.predictions,
      );
      const scoreSchemaDiagnostics = createSchemaRegistry(
        repositoryRoot,
      ).validate('score', report);
      if (scoreSchemaDiagnostics.length > 0) {
        scoreSchemaDiagnostics.forEach((item) => {
          output.error(`${item.path}: ${item.code}: ${item.message}`);
        });
        return EXIT_CODES.internal;
      }
      output.log(stableJson(report).trimEnd());
      return EXIT_CODES.success;
    }
    if (command === 'fixtures' && values.length === 0) {
      const summaries = WEAK_STRATEGIES.map((strategy) => {
        const predictions = createWeakPredictionSet(strategy, corpus.bundles);
        for (const [index, prediction] of predictions.entries()) {
          const bundle = corpus.bundles[index];
          if (bundle === undefined) {
            throw new Error('Weak fixture bundle ordering is inconsistent.');
          }
          const predictionDiagnostics = loadPredictionsFromValue(
            repositoryRoot,
            bundle,
            prediction,
          );
          if (predictionDiagnostics.length > 0) {
            throw new Error(
              `Weak fixture ${strategy} failed prediction validation.`,
            );
          }
        }
        const report = scoreCorpus(
          corpus.manifest.corpusId,
          strategy,
          corpus.bundles,
          predictions,
        );
        return {
          strategy,
          safe: report.safety.safe,
          unsafeCount: report.safety.unsafeCount,
          macroDispositionF1: report.aggregate.macroDisposition.f1,
          outcomeAccuracy: report.aggregate.outcomeAccuracy,
          rankingAgreement: report.aggregate.rankingAgreement,
          unknownRecall: report.aggregate.unknownRecall,
          evidenceRecall: report.aggregate.evidenceRecall,
          reasonRecall: report.aggregate.reasonRecall,
        };
      });
      output.log(
        stableJson({ corpusId: corpus.manifest.corpusId, summaries }).trimEnd(),
      );
      return EXIT_CODES.success;
    }

    output.error(
      'usage: evaluation-harness <validate|fixtures|score --prediction <path>>',
    );
    return EXIT_CODES.usage;
  } catch (error: unknown) {
    if (error instanceof EvaluationBoundaryError) {
      output.error(`${error.code}: ${error.message}`);
    } else {
      output.error('evaluation.internal: Unexpected internal error.');
    }
    return EXIT_CODES.internal;
  }
}

function loadPredictionsFromValue(
  repositoryRoot: string,
  bundle: Parameters<typeof scoreCorpus>[2][number],
  prediction: Parameters<typeof scoreCorpus>[3][number],
) {
  const schemaDiagnostics = createSchemaRegistry(repositoryRoot).validate(
    'prediction',
    prediction,
  );
  if (schemaDiagnostics.length > 0) {
    return schemaDiagnostics;
  }
  return validatePrediction(bundle.caseDocument, bundle.evidence, prediction);
}

function reportDiagnostics(
  diagnostics: readonly {
    readonly code: string;
    readonly message: string;
    readonly path: string;
  }[],
  output: Output,
): void {
  for (const item of diagnostics.slice(0, 500)) {
    output.error(
      `${sanitize(item.path)}: ${item.code}: ${sanitize(item.message)}`,
    );
  }
}

function normalizePredictionSetId(path: string): string {
  const raw = basename(path, '.json').toLowerCase();
  const normalized = raw
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return normalized.length >= 2 ? normalized : 'prediction-set';
}

function sanitize(value: string): string {
  return Array.from(value)
    .map((character) => {
      const point = character.codePointAt(0) ?? 0;
      return point <= 31 || point === 127
        ? `\\u${point.toString(16).padStart(4, '0')}`
        : character;
    })
    .join('')
    .slice(0, 500);
}

if (
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === process.argv[1]
) {
  process.exitCode = runCli(process.argv.slice(2), process.cwd(), console);
}
