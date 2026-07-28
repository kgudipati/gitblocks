import type {
  CaseBundle,
  Prediction,
  ReferenceDiagnostic,
} from './contracts.ts';
import { loadJsonDirectory, loadJsonFile } from './json-boundary.ts';
import { validatePrediction } from './referential-integrity.ts';
import { createSchemaRegistry } from './schema-registry.ts';

export type PredictionLoadResult =
  | {
      readonly ok: true;
      readonly predictions: readonly Prediction[];
      readonly bundles: readonly CaseBundle[];
    }
  | {
      readonly ok: false;
      readonly diagnostics: readonly ReferenceDiagnostic[];
    };

export function loadPredictions(
  repositoryRoot: string,
  relativePath: string,
  bundles: readonly CaseBundle[],
): PredictionLoadResult {
  const registry = createSchemaRegistry(repositoryRoot);
  const entries = relativePath.endsWith('.json')
    ? [
        {
          path: relativePath,
          value: loadJsonFile(repositoryRoot, relativePath),
        },
      ]
    : loadJsonDirectory(repositoryRoot, relativePath, { maximumFiles: 100 });
  const diagnostics: ReferenceDiagnostic[] = [];
  const predictions: Prediction[] = [];

  for (const entry of entries) {
    const schemaDiagnostics = registry.validate('prediction', entry.value);
    diagnostics.push(
      ...schemaDiagnostics.map((item) => ({
        code: item.code,
        message: item.message,
        path: `${entry.path}${item.path}`,
      })),
    );
    if (schemaDiagnostics.length > 0) {
      continue;
    }
    const prediction = entry.value as Prediction;
    const bundle = bundles.find(
      (candidate) => candidate.caseDocument.caseId === prediction.caseId,
    );
    if (bundle === undefined) {
      diagnostics.push({
        code: 'prediction.unknown-case',
        message: 'Prediction references a case outside the corpus.',
        path: entry.path,
      });
      continue;
    }
    diagnostics.push(
      ...validatePrediction(
        bundle.caseDocument,
        bundle.evidence,
        prediction,
      ).map((item) => ({ ...item, path: `${entry.path}:${item.path}` })),
    );
    predictions.push(prediction);
  }

  const predictionCaseIds = predictions.map((prediction) => prediction.caseId);
  if (new Set(predictionCaseIds).size !== predictionCaseIds.length) {
    diagnostics.push({
      code: 'prediction.duplicate-case',
      message: 'Prediction set must contain at most one file per case.',
      path: relativePath,
    });
  }
  if (!relativePath.endsWith('.json')) {
    const corpusCaseIds = bundles.map((bundle) => bundle.caseDocument.caseId);
    if (!sameSet(predictionCaseIds, corpusCaseIds)) {
      diagnostics.push({
        code: 'prediction.case-set',
        message:
          'Prediction directory must contain exactly one corpus prediction per case.',
        path: relativePath,
      });
    }
  }
  if (diagnostics.length > 0) {
    return {
      ok: false,
      diagnostics: diagnostics.sort((left, right) =>
        compareText(
          `${left.path}\0${left.code}`,
          `${right.path}\0${right.code}`,
        ),
      ),
    };
  }

  predictions.sort((left, right) => compareText(left.caseId, right.caseId));
  const selectedCaseIds = new Set(predictionCaseIds);
  return {
    ok: true,
    predictions,
    bundles: bundles.filter((bundle) =>
      selectedCaseIds.has(bundle.caseDocument.caseId),
    ),
  };
}

function sameSet(left: readonly string[], right: readonly string[]): boolean {
  return (
    new Set(left).size === new Set(right).size &&
    left.every((value) => right.includes(value))
  );
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
