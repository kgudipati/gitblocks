import { createHash } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

import { generateRankingBaselinePredictionSets } from './baselines.ts';
import { generateRankingCompositionArtifacts } from './composition.ts';
import { validateRankingContractConformance } from './contract-conformance.ts';
import { createRankingManifest, loadRankingCorpus } from './corpus.ts';
import { runRankingScorerFixtures } from './fixtures.ts';
import {
  measureRankingPerformanceReference,
  type RankingPerformanceReference,
} from './performance.ts';
import {
  createRankingBaselineReport,
  createRankingGateReviewInputs,
  loadCommittedRankingPredictions,
  rankingCoreAuthorityDigest,
  rankingPredictionPaths,
  validateRankingBaselineArtifacts,
  type RankingBaselineReport,
  type RankingGateReviewInputs,
} from './reports.ts';
import {
  compareRankingText,
  rankingSemanticDigest,
  rankingStableJson,
  rankingValuesDiffer,
} from './stable-json.ts';

const CORPUS_RELATIVE_ROOT = 'evals/ranking-v1';
const WRITABLE_PATHS = new Set([
  ...Object.values(rankingPredictionPaths()),
  'composition/predictions.json',
  'fixtures/scorer-fixture-summary.json',
  'reports/baseline-report.json',
  'reports/composition-report.json',
  'reports/performance-reference.json',
  'gates/proposed-review-inputs.json',
  'manifest.json',
]);

export const RANKING_EXIT_CODES = {
  success: 0,
  validation: 1,
  usage: 2,
  internal: 3,
} as const;

interface Output {
  readonly log: (message: string) => void;
  readonly error: (message: string) => void;
}

export function runRankingCli(
  arguments_: readonly string[],
  workingDirectory: string,
  output: Output,
): number {
  try {
    const repositoryRoot = findRepositoryRoot(workingDirectory);
    const [command, ...values] = arguments_;
    if (values.length !== 0) return usage(output);
    if (command === 'validate') {
      const loaded = loadRankingCorpus(repositoryRoot);
      if (!loaded.ok) return reportDiagnostics(loaded.diagnostics, output);
      output.log(
        'ranking-v1 valid (30 cases; 6 per family; proposed gold; independent review pending)',
      );
      return RANKING_EXIT_CODES.success;
    }
    if (command === 'fixtures') {
      const summary = runRankingScorerFixtures();
      output.log(
        `ranking-v1 scorer fixtures passed (${String(summary.fixtureCount)} fixtures; ${String(summary.assertionCount)} assertions)`,
      );
      return RANKING_EXIT_CODES.success;
    }
    if (command === 'fixtures-generate') {
      writeAuthority(
        repositoryRoot,
        'fixtures/scorer-fixture-summary.json',
        runRankingScorerFixtures(),
      );
      output.log('ranking-v1 scorer fixture summary generated');
      return RANKING_EXIT_CODES.success;
    }
    if (command === 'baselines-generate') {
      const predictions = generateRankingBaselinePredictionSets(repositoryRoot);
      for (const [key, path] of Object.entries(rankingPredictionPaths())) {
        writeAuthority(
          repositoryRoot,
          path,
          predictions[key as keyof typeof predictions],
        );
      }
      output.log(
        'ranking-v1 blind baseline predictions generated (5 complete sets)',
      );
      return RANKING_EXIT_CODES.success;
    }
    if (command === 'baselines-score') {
      const loaded = loadRankingCorpus(repositoryRoot);
      if (!loaded.ok) return reportDiagnostics(loaded.diagnostics, output);
      const predictions = loadCommittedRankingPredictions(repositoryRoot);
      const report = createRankingBaselineReport(
        loaded.corpus,
        loaded.cases,
        rankingCoreAuthorityDigest(loaded.corpus),
        predictions,
      );
      writeAuthority(repositoryRoot, 'reports/baseline-report.json', report);
      output.log(
        'ranking-v1 frozen baseline predictions scored (content-free report)',
      );
      return RANKING_EXIT_CODES.success;
    }
    if (command === 'composition-generate') {
      const artifacts = generateRankingCompositionArtifacts(repositoryRoot);
      writeAuthority(
        repositoryRoot,
        'composition/predictions.json',
        artifacts.prediction,
      );
      writeAuthority(
        repositoryRoot,
        'reports/composition-report.json',
        artifacts.report,
      );
      output.log(
        'ranking-v1 retrieval-to-ranking composition diagnostic generated',
      );
      return RANKING_EXIT_CODES.success;
    }
    if (command === 'performance-generate') {
      writeAuthority(
        repositoryRoot,
        'reports/performance-reference.json',
        measureRankingPerformanceReference(),
      );
      output.log('ranking-v1 evaluation-data performance reference generated');
      return RANKING_EXIT_CODES.success;
    }
    if (command === 'gates-generate') {
      const loaded = loadRankingCorpus(repositoryRoot);
      if (!loaded.ok) return reportDiagnostics(loaded.diagnostics, output);
      const report = readAuthority<RankingBaselineReport>(
        repositoryRoot,
        'reports/baseline-report.json',
      );
      const performance = readAuthority<RankingPerformanceReference>(
        repositoryRoot,
        'reports/performance-reference.json',
      );
      const gateInputs = createRankingGateReviewInputs(
        loaded.corpus,
        rankingCoreAuthorityDigest(loaded.corpus),
        report,
        performance,
      );
      writeAuthority(
        repositoryRoot,
        'gates/proposed-review-inputs.json',
        gateInputs,
      );
      output.log(
        'ranking-v1 proposed gate review inputs generated (no thresholds selected)',
      );
      return RANKING_EXIT_CODES.success;
    }
    if (command === 'manifest-generate') {
      writeAuthority(
        repositoryRoot,
        'manifest.json',
        createRankingManifest(repositoryRoot),
      );
      output.log('ranking-v1 manifest generated');
      return RANKING_EXIT_CODES.success;
    }
    if (command === 'baselines') {
      verifyBaselineReproduction(repositoryRoot);
      output.log(
        'ranking-v1 baselines reproduced (forward/reverse blind generation; frozen scores)',
      );
      return RANKING_EXIT_CODES.success;
    }
    if (command === 'verify') {
      const before = effectSnapshot(repositoryRoot);
      const loaded = loadRankingCorpus(repositoryRoot);
      if (!loaded.ok) return reportDiagnostics(loaded.diagnostics, output);
      const fixtureSummary = runRankingScorerFixtures();
      const committedFixtures = readAuthority<
        ReturnType<typeof runRankingScorerFixtures>
      >(repositoryRoot, 'fixtures/scorer-fixture-summary.json');
      if (
        rankingStableJson(fixtureSummary) !==
        rankingStableJson(committedFixtures)
      ) {
        throw new Error('Committed scorer fixture summary drifted.');
      }
      verifyBaselineReproduction(repositoryRoot);
      verifyCompositionReproduction(repositoryRoot);
      verifyPerformanceReference(repositoryRoot);
      verifyGateReviewInputs(repositoryRoot, loaded.corpus);
      const conformance = validateRankingContractConformance(repositoryRoot);
      if (!conformance.ok) {
        return reportDiagnostics(conformance.diagnostics, output);
      }
      verifyArchitecture(repositoryRoot);
      const after = effectSnapshot(repositoryRoot);
      if (rankingStableJson(before) !== rankingStableJson(after)) {
        throw new Error(
          'Read-only ranking verification changed filesystem state.',
        );
      }
      output.log(
        'ranking-v1 verification passed (corpus, contracts, fixtures, blind baselines, composition, reports, effects)',
      );
      return RANKING_EXIT_CODES.success;
    }
    return usage(output);
  } catch (error) {
    output.error(
      error instanceof Error
        ? `ranking.internal: ${sanitize(error.message)}`
        : 'ranking.internal: unexpected failure',
    );
    return RANKING_EXIT_CODES.internal;
  }
}

function verifyBaselineReproduction(repositoryRoot: string): void {
  const forward = generateRankingBaselinePredictionSets(repositoryRoot);
  const reverse = generateRankingBaselinePredictionSets(
    repositoryRoot,
    'reverse',
  );
  const committed = loadCommittedRankingPredictions(repositoryRoot);
  if (
    rankingStableJson(forward) !== rankingStableJson(reverse) ||
    rankingStableJson(forward) !== rankingStableJson(committed)
  ) {
    throw new Error('Ranking baseline prediction reproduction drifted.');
  }
  const artifacts = validateRankingBaselineArtifacts(repositoryRoot);
  const committedReport = readAuthority<RankingBaselineReport>(
    repositoryRoot,
    'reports/baseline-report.json',
  );
  if (
    committedReport.semanticDigest !== rankingSemanticDigest(committedReport) ||
    rankingStableJson(artifacts.report) !== rankingStableJson(committedReport)
  ) {
    throw new Error('Committed ranking baseline report drifted.');
  }
}

function verifyCompositionReproduction(repositoryRoot: string): void {
  const first = generateRankingCompositionArtifacts(repositoryRoot);
  const second = generateRankingCompositionArtifacts(repositoryRoot);
  const committedPrediction = readAuthority<typeof first.prediction>(
    repositoryRoot,
    'composition/predictions.json',
  );
  const committedReport = readAuthority<typeof first.report>(
    repositoryRoot,
    'reports/composition-report.json',
  );
  if (
    rankingStableJson(first) !== rankingStableJson(second) ||
    rankingStableJson(first.prediction) !==
      rankingStableJson(committedPrediction) ||
    rankingStableJson(first.report) !== rankingStableJson(committedReport)
  ) {
    throw new Error('Ranking composition reproduction drifted.');
  }
}

function verifyPerformanceReference(repositoryRoot: string): void {
  const performance = readAuthority<RankingPerformanceReference>(
    repositoryRoot,
    'reports/performance-reference.json',
  );
  if (
    rankingValuesDiffer(
      performance.evidenceVersion,
      'ranking-v1-performance-reference/1.0.0',
    ) ||
    rankingValuesDiffer(
      performance.claimScope,
      'gold-blind-evaluation-data-operations-only',
    ) ||
    rankingValuesDiffer(performance.productionRankingBenchmark, false) ||
    rankingValuesDiffer(performance.fixture.candidateCount, 20) ||
    rankingValuesDiffer(performance.fixture.evidenceCount, 240) ||
    rankingValuesDiffer(performance.fixture.criterionCount, 40) ||
    rankingValuesDiffer(performance.fixture.pairCount, 190) ||
    rankingValuesDiffer(performance.protocol.warmups, 200) ||
    rankingValuesDiffer(performance.protocol.measurements, 2000) ||
    rankingValuesDiffer(performance.operationCounts.boundedWorkProved, true) ||
    rankingValuesDiffer(
      performance.marginProtocol.finalBudgetSelected,
      false,
    ) ||
    performance.semanticDigest !== rankingSemanticDigest(performance)
  ) {
    throw new Error('Ranking performance reference authority is invalid.');
  }
}

function verifyGateReviewInputs(
  repositoryRoot: string,
  corpus: Parameters<typeof rankingCoreAuthorityDigest>[0],
): void {
  const report = readAuthority<RankingBaselineReport>(
    repositoryRoot,
    'reports/baseline-report.json',
  );
  const performance = readAuthority<RankingPerformanceReference>(
    repositoryRoot,
    'reports/performance-reference.json',
  );
  const committed = readAuthority<RankingGateReviewInputs>(
    repositoryRoot,
    'gates/proposed-review-inputs.json',
  );
  const expected = createRankingGateReviewInputs(
    corpus,
    rankingCoreAuthorityDigest(corpus),
    report,
    performance,
  );
  if (
    rankingStableJson(expected) !== rankingStableJson(committed) ||
    rankingValuesDiffer(committed.qualityGateEvidence.finalThresholds, null) ||
    rankingValuesDiffer(
      committed.qualityGateEvidence.finalThresholdsSelected,
      false,
    ) ||
    rankingValuesDiffer(committed.deterministicReadiness.selected, null) ||
    rankingValuesDiffer(
      committed.deterministicReadiness.selectedPolicyDigest,
      null,
    ) ||
    rankingValuesDiffer(
      committed.deterministicReadiness.preFreezeM3OutputAdmissible,
      false,
    )
  ) {
    throw new Error('Ranking gate review inputs drifted or selected a gate.');
  }
}

function verifyArchitecture(repositoryRoot: string): void {
  const rankingSourceRoot = join(
    repositoryRoot,
    'tools/evaluation-harness/src/ranking',
  );
  const forbiddenSourcePatterns = [
    /from ['"]@gitblocks\/persistence['"]/u,
    /from ['"]@gitblocks\/ingestion['"]/u,
    /from ['"]openai['"]/u,
    /from ['"]node:(?:http|https|net|tls|dns)['"]/u,
    /\bfetch\s*\(/u,
    /process\.env/u,
    /child_process/u,
    /docker/iu,
  ];
  for (const path of listFiles(rankingSourceRoot).filter(
    (path) => path.endsWith('.ts') && path !== 'cli.ts',
  )) {
    const source = readFileSync(join(rankingSourceRoot, path), 'utf8');
    if (forbiddenSourcePatterns.some((pattern) => pattern.test(source))) {
      throw new Error(
        'Ranking evaluation source contains an unauthorized effect.',
      );
    }
  }
  const packagesRoot = join(repositoryRoot, 'packages');
  const productSourcePaths = readdirSync(packagesRoot)
    .sort(compareRankingText)
    .flatMap((packageName) => {
      const sourceRoot = join(packagesRoot, packageName, 'src');
      return existsSync(sourceRoot)
        ? listFiles(sourceRoot).map((path) => join(packageName, 'src', path))
        : [];
    })
    .filter((path) => /\.(?:ts|json)$/u.test(path));
  for (const path of productSourcePaths) {
    const source = readFileSync(join(packagesRoot, path), 'utf8');
    if (
      /ranking-v1|ranking-v1-scorer|proposed-gold|baseline-specifications/u.test(
        source,
      )
    ) {
      throw new Error(
        'Product package depends on ranking evaluation authority.',
      );
    }
  }
  if (existsSync(join(repositoryRoot, 'packages/ranking'))) {
    throw new Error('M2 must not create packages/ranking.');
  }
}

function writeAuthority(
  repositoryRoot: string,
  relativePath: string,
  value: unknown,
): void {
  if (!WRITABLE_PATHS.has(relativePath)) {
    throw new Error('Ranking writer destination is not authorized.');
  }
  const root = join(repositoryRoot, CORPUS_RELATIVE_ROOT);
  mkdirSync(root, { recursive: true });
  const rootReal = realpathSync(root);
  const path = resolve(rootReal, relativePath);
  if (!path.startsWith(`${rootReal}${sep}`)) throw new Error('Path escape.');
  mkdirSync(dirname(path), { recursive: true });
  if (existsSync(path) && lstatSync(path).isSymbolicLink()) {
    throw new Error('Ranking writer rejects symlink destinations.');
  }
  writeFileSync(path, rankingStableJson(value), {
    encoding: 'utf8',
    mode: 0o644,
  });
}

function readAuthority<Value>(
  repositoryRoot: string,
  relativePath: string,
  validate?: (value: unknown) => value is Value,
): Value {
  const root = realpathSync(join(repositoryRoot, CORPUS_RELATIVE_ROOT));
  const path = resolve(root, relativePath);
  if (!path.startsWith(`${root}${sep}`)) throw new Error('Path escape.');
  const status = lstatSync(path);
  if (
    !status.isFile() ||
    status.isSymbolicLink() ||
    status.size > 32 * 1024 * 1024
  )
    throw new Error('Unsafe ranking authority file.');
  const value: unknown = JSON.parse(readFileSync(path, 'utf8'));
  if (validate !== undefined && !validate(value)) {
    throw new Error('Ranking authority shape is invalid.');
  }
  return value as Value;
}

function effectSnapshot(repositoryRoot: string) {
  const root = join(repositoryRoot, CORPUS_RELATIVE_ROOT);
  return listFiles(root).map((path) => {
    const absolute = join(root, path);
    const status = lstatSync(absolute);
    return {
      path,
      digest: createHash('sha256').update(readFileSync(absolute)).digest('hex'),
      size: status.size,
      mode: status.mode,
      modifiedMilliseconds: status.mtimeMs,
    };
  });
}

function listFiles(root: string): string[] {
  if (!existsSync(root)) return [];
  const rootReal = realpathSync(root);
  const files: string[] = [];
  const walk = (directory: string): void => {
    for (const name of readdirSync(directory).sort(compareRankingText)) {
      const path = join(directory, name);
      const status = lstatSync(path);
      if (status.isSymbolicLink())
        throw new Error('Authority symlink rejected.');
      if (status.isDirectory()) walk(path);
      else if (status.isFile()) files.push(relative(rootReal, path));
    }
  };
  walk(rootReal);
  return files.sort(compareRankingText);
}

function findRepositoryRoot(start: string): string {
  let current = realpathSync(start);
  for (;;) {
    if (
      existsSync(join(current, 'pnpm-workspace.yaml')) &&
      existsSync(join(current, 'package.json'))
    ) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) throw new Error('Repository root not found.');
    current = parent;
  }
}

function reportDiagnostics(
  diagnostics: readonly { code: string; path: string; message: string }[],
  output: Output,
): number {
  diagnostics.slice(0, 500).forEach((item) => {
    output.error(
      `${sanitize(item.path)}: ${sanitize(item.code)}: ${sanitize(item.message)}`,
    );
  });
  return RANKING_EXIT_CODES.validation;
}

function usage(output: Output): number {
  output.error(
    'usage: ranking-evaluation <validate|fixtures|fixtures-generate|baselines-generate|baselines-score|baselines|composition-generate|performance-generate|gates-generate|manifest-generate|verify>',
  );
  return RANKING_EXIT_CODES.usage;
}

function sanitize(value: string): string {
  return Array.from(value)
    .map((character) => {
      const point = character.codePointAt(0) ?? 0;
      return point <= 31 || point === 127 ? ' ' : character;
    })
    .join('')
    .slice(0, 512);
}

if (
  process.argv[1] !== undefined &&
  import.meta.url.endsWith(process.argv[1])
) {
  process.exitCode = runRankingCli(
    process.argv.slice(2),
    process.cwd(),
    console,
  );
}
