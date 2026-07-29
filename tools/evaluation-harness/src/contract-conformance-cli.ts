import { fileURLToPath } from 'node:url';

import { validateLoadedCorpusContractConformance } from './contract-conformance.ts';
import { loadCorpus } from './corpus.ts';
import { EvaluationBoundaryError } from './json-boundary.ts';
import { findGitBlocksRoot } from './repository-root.ts';

export const CONTRACT_CONFORMANCE_EXIT_CODES = {
  success: 0,
  validation: 1,
  usage: 2,
  internal: 3,
} as const;

interface Output {
  readonly error: (message: string) => void;
  readonly log: (message: string) => void;
}

export function runContractConformanceCli(
  arguments_: readonly string[],
  workingDirectory: string,
  output: Output,
): number {
  try {
    if (arguments_.length > 0) {
      output.error('usage: evaluation-contract-conformance');
      return CONTRACT_CONFORMANCE_EXIT_CODES.usage;
    }

    const repositoryRoot = findGitBlocksRoot(workingDirectory);
    const corpus = loadCorpus(repositoryRoot);
    if (!corpus.ok) {
      reportDiagnostics(corpus.diagnostics, output);
      return CONTRACT_CONFORMANCE_EXIT_CODES.validation;
    }

    const conformance = validateLoadedCorpusContractConformance(
      corpus.manifest,
      corpus.bundles,
    );
    if (!conformance.ok) {
      reportDiagnostics(conformance.diagnostics, output);
      return CONTRACT_CONFORMANCE_EXIT_CODES.validation;
    }

    output.log(
      [
        'Product contract conformance passed',
        `(${String(conformance.summary.caseCount)} cases,`,
        `${String(conformance.summary.candidateCount)} supplied candidates,`,
        `${conformance.summary.goldStatus}/${conformance.summary.independentReviewStatus},`,
        `${conformance.summary.purpose}).`,
      ].join(' '),
    );
    return CONTRACT_CONFORMANCE_EXIT_CODES.success;
  } catch (error: unknown) {
    if (error instanceof EvaluationBoundaryError) {
      output.error(`${error.code}: ${error.message}`);
    } else {
      output.error('evaluation.internal: Unexpected internal error.');
    }
    return CONTRACT_CONFORMANCE_EXIT_CODES.internal;
  }
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
  process.exitCode = runContractConformanceCli(
    process.argv.slice(2),
    process.cwd(),
    console,
  );
}
