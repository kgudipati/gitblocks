import { pathToFileURL } from 'node:url';

import { findGitBlocksRoot } from './repository-root.ts';
import { loadRepositoryInterviewEvaluationCorpusV1 } from './repository-interview-evaluation-corpus.ts';
import { writeRepositoryInterviewEvaluationAssetsV1 } from './repository-interview-evaluation-assets.ts';
import {
  runRepositoryInterviewGateFixturesV1,
  type RepositoryInterviewGateFixtureResultV1,
} from './repository-interview-evaluation-fixtures.ts';

type RepositoryInterviewGateFixtureRunnerV1 =
  () => RepositoryInterviewGateFixtureResultV1;

export function runRepositoryInterviewEvaluationCli(
  argv: readonly string[],
  startDirectory = process.cwd(),
  runGateFixtures: RepositoryInterviewGateFixtureRunnerV1 = runRepositoryInterviewGateFixturesV1,
): number {
  const root = findGitBlocksRoot(startDirectory);
  const command = argv[0];
  if (command === 'generate') {
    writeRepositoryInterviewEvaluationAssetsV1(root);
    process.stdout.write('repository-interviews-v1 assets generated\n');
    return 0;
  }
  if (command === 'validate') {
    const result = loadRepositoryInterviewEvaluationCorpusV1(root);
    if (!result.ok) {
      for (const issue of result.diagnostics)
        process.stderr.write(`${issue.code} ${issue.path}\n`);
      return 1;
    }
    const { corpus } = result;
    process.stdout.write(
      [
        `${corpus.manifest.corpusId} ${corpus.manifest.corpusVersion}`,
        `corpus digest ${corpus.manifest.corpusDigest}`,
        `candidates ${String(corpus.candidates.length)}`,
        `families ${Object.values(corpus.derived.familyCounts).join('/')}`,
        `lifecycle ${String(corpus.derived.negativeControlCount)}/${String(corpus.derived.archivedCount)}/${String(corpus.derived.movedCount)}`,
        `documentation ${String(corpus.derived.richDocumentationCount)}/${String(corpus.derived.readmeOnlyCount)}`,
        `calibration ${String(corpus.derived.calibrationCount)}`,
        `adversarial ${String(corpus.adversarialFixtures.length)}`,
        `review status ${corpus.manifest.status}`,
      ].join('\n') + '\n',
    );
    return 0;
  }
  if (command === 'fixtures') {
    const result = runGateFixtures();
    for (const scenario of result.scenarios)
      process.stdout.write(
        `${scenario.name} ${scenario.passed ? 'pass' : 'fail'}\n`,
      );
    return result.ok ? 0 : 1;
  }
  process.stderr.write(
    'Usage: repository-interview-evaluation-cli <generate|validate|fixtures>\n',
  );
  return 1;
}

const invokedPath = process.argv[1];
if (
  invokedPath !== undefined &&
  import.meta.url === pathToFileURL(invokedPath).href
) {
  process.exitCode = runRepositoryInterviewEvaluationCli(process.argv.slice(2));
}
