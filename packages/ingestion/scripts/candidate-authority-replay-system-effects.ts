import { execFile } from 'node:child_process';
import {
  constants,
  link,
  lstat,
  open,
  realpath,
  unlink,
  type FileHandle,
} from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { promisify } from 'node:util';

import {
  CANDIDATE_AUTHORITY_DOSSIER_PROJECTION_STAGING_PATH,
  CANDIDATE_AUTHORITY_DOSSIER_STAGING_PATH,
  CANDIDATE_AUTHORITY_EVIDENCE_STAGING_PATH,
  CANDIDATE_AUTHORITY_PARTIAL_STAGING_PATH,
  CANDIDATE_AUTHORITY_PROFILE_STAGING_PATH,
  CANDIDATE_AUTHORITY_READINESS_STAGING_PATH,
  CANDIDATE_AUTHORITY_ROOT_STAGING_PATH,
  CANDIDATE_AUTHORITY_SOURCE_AUTHORITY_PATH,
  CANDIDATE_AUTHORITY_SOURCE_MAXIMUM_SERIALIZED_BYTES,
} from '../src/candidate-authority-live-contracts.ts';
import {
  CANDIDATE_AUTHORITY_READINESS_OUTPUTS,
  CANDIDATE_AUTHORITY_REPLAY_OUTPUTS,
  type CandidateAuthorityReplayGitState,
  type CandidateAuthorityReplayWriteEffects,
} from '../src/candidate-authority-replay-runner.ts';
import { IngestionError, ingestionError } from '../src/errors.ts';

const execFileAsync = promisify(execFile);
const STAGING_BY_FINAL = new Map<string, string>([
  [
    CANDIDATE_AUTHORITY_REPLAY_OUTPUTS[0].path,
    CANDIDATE_AUTHORITY_PROFILE_STAGING_PATH,
  ],
  [
    CANDIDATE_AUTHORITY_REPLAY_OUTPUTS[1].path,
    CANDIDATE_AUTHORITY_PARTIAL_STAGING_PATH,
  ],
  [
    CANDIDATE_AUTHORITY_REPLAY_OUTPUTS[2].path,
    CANDIDATE_AUTHORITY_EVIDENCE_STAGING_PATH,
  ],
  [
    CANDIDATE_AUTHORITY_REPLAY_OUTPUTS[3].path,
    CANDIDATE_AUTHORITY_DOSSIER_STAGING_PATH,
  ],
  [
    CANDIDATE_AUTHORITY_REPLAY_OUTPUTS[4].path,
    CANDIDATE_AUTHORITY_DOSSIER_PROJECTION_STAGING_PATH,
  ],
  [
    CANDIDATE_AUTHORITY_READINESS_OUTPUTS[0].path,
    CANDIDATE_AUTHORITY_READINESS_STAGING_PATH,
  ],
  [
    CANDIDATE_AUTHORITY_READINESS_OUTPUTS[1].path,
    CANDIDATE_AUTHORITY_ROOT_STAGING_PATH,
  ],
]);

export function createCandidateAuthorityReplaySystemEffects(config: {
  readonly repositoryRoot: string;
}): CandidateAuthorityReplayWriteEffects {
  return {
    readFixedFile: async (path, maximumBytes) =>
      readBoundedNoFollow(
        await fixedPath(config.repositoryRoot, path),
        maximumBytes,
      ),
    requirePathMissing: async (path) => {
      const target = await fixedPath(config.repositoryRoot, path);
      try {
        await lstat(target);
      } catch (error) {
        if (isMissing(error)) return;
        throw safeFileError(error);
      }
      throw ingestionError('ingestion.invalid-input');
    },
    readGitState: () => readGitState(config.repositoryRoot),
    publishExclusive: async (outputs) => {
      validateOutputSet(outputs);
      const staged: string[] = [];
      const published: string[] = [];
      try {
        for (const output of outputs) {
          const stagingPath = STAGING_BY_FINAL.get(output.path);
          if (stagingPath === undefined) invalid();
          const staging = await fixedPath(config.repositoryRoot, stagingPath);
          await stageCompleteBytes(staging, output.text);
          staged.push(staging);
        }
        for (const output of outputs) {
          const stagingPath = STAGING_BY_FINAL.get(output.path);
          if (stagingPath === undefined) invalid();
          const staging = await fixedPath(config.repositoryRoot, stagingPath);
          const final = await fixedPath(config.repositoryRoot, output.path);
          await link(staging, final);
          published.push(final);
        }
        for (const staging of staged) await unlink(staging);
        await flushDirectory(dirname(staged[0] ?? invalid()));
      } catch (error) {
        await Promise.allSettled(published.map((path) => unlink(path)));
        await Promise.allSettled(staged.map((path) => unlink(path)));
        throw safeFileError(error);
      }
    },
  };
}

async function readGitState(
  repositoryRoot: string,
): Promise<CandidateAuthorityReplayGitState> {
  const options = {
    cwd: repositoryRoot,
    encoding: 'utf8' as const,
    maxBuffer: CANDIDATE_AUTHORITY_SOURCE_MAXIMUM_SERIALIZED_BYTES + 1024,
  };
  const [branch, head, originHead, status] = await Promise.all([
    execFileAsync('git', ['branch', '--show-current'], options),
    execFileAsync('git', ['rev-parse', 'HEAD'], options),
    execFileAsync(
      'git',
      ['rev-parse', 'origin/feat/32-codebase-conditioned-ranking'],
      options,
    ),
    execFileAsync(
      'git',
      ['status', '--porcelain=v1', '-z', '--untracked-files=all'],
      options,
    ),
  ]);
  const freeze = await execFileAsync(
    'git',
    [
      'log',
      '--diff-filter=A',
      '--format=%H',
      '-n',
      '1',
      '--',
      CANDIDATE_AUTHORITY_SOURCE_AUTHORITY_PATH,
    ],
    options,
  );
  const sourceFreezeHead = freeze.stdout.trim() || null;
  let sourceFreezeParentHead: string | null = null;
  let sourceFreezeIsAncestor = false;
  let sourceCommitPaths: readonly string[] = [];
  let sourceBytesAtFreezeHead: string | null = null;
  if (sourceFreezeHead !== null) {
    const [parent, paths, sourceAtFreeze] = await Promise.all([
      execFileAsync('git', ['rev-parse', `${sourceFreezeHead}^`], options),
      execFileAsync(
        'git',
        ['diff-tree', '--no-commit-id', '--name-only', '-r', sourceFreezeHead],
        options,
      ),
      execFileAsync(
        'git',
        [
          'show',
          `${sourceFreezeHead}:${CANDIDATE_AUTHORITY_SOURCE_AUTHORITY_PATH}`,
        ],
        options,
      ),
    ]);
    sourceFreezeParentHead = parent.stdout.trim();
    sourceCommitPaths = lines(paths.stdout);
    sourceBytesAtFreezeHead = sourceAtFreeze.stdout;
    try {
      await execFileAsync(
        'git',
        ['merge-base', '--is-ancestor', sourceFreezeHead, 'HEAD'],
        options,
      );
      sourceFreezeIsAncestor = true;
    } catch {
      // A non-ancestor source freeze is reported as false and rejected by replay.
    }
  }
  const sourceBytesAtHead = await readGitPathOrNull(
    CANDIDATE_AUTHORITY_SOURCE_AUTHORITY_PATH,
    options,
  );
  return Object.freeze({
    branch: branch.stdout.trim(),
    head: head.stdout.trim(),
    originHead: originHead.stdout.trim(),
    sourceFreezeHead,
    sourceFreezeParentHead,
    sourceFreezeIsAncestor,
    clean: status.stdout.length === 0,
    sourceCommitPaths,
    workingPaths: porcelainPaths(status.stdout),
    sourceTrackedAtHead: sourceBytesAtHead !== null,
    sourceBytesAtHead,
    sourceBytesAtFreezeHead,
  });
}

function validateOutputSet(
  outputs: readonly {
    readonly path: string;
    readonly text: string;
    readonly maximumBytes: number;
  }[],
): void {
  const acceptedSets = [
    CANDIDATE_AUTHORITY_REPLAY_OUTPUTS,
    CANDIDATE_AUTHORITY_READINESS_OUTPUTS,
  ];
  const accepted = acceptedSets.some(
    (set) =>
      outputs.length === set.length &&
      outputs.every((output, index) =>
        sameOutputDescriptor(output, set[index]),
      ),
  );
  if (!accepted) invalid();
  for (const output of outputs) {
    if (
      !output.text.endsWith('\n') ||
      Buffer.byteLength(output.text, 'utf8') > output.maximumBytes ||
      STAGING_BY_FINAL.get(output.path) === undefined
    )
      invalid();
  }
}

function sameOutputDescriptor(
  output: { readonly path: string; readonly maximumBytes: number },
  expected:
    { readonly path: string; readonly maximumBytes: number } | undefined,
): boolean {
  return (
    output.path === expected?.path &&
    output.maximumBytes === expected.maximumBytes
  );
}

async function readGitPathOrNull(
  path: string,
  options: {
    readonly cwd: string;
    readonly encoding: 'utf8';
    readonly maxBuffer: number;
  },
): Promise<string | null> {
  try {
    return (await execFileAsync('git', ['show', `HEAD:${path}`], options))
      .stdout;
  } catch {
    return null;
  }
}

function lines(value: string): readonly string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .sort(compare);
}

function porcelainPaths(value: string): readonly string[] {
  const records = value.split('\0').filter((entry) => entry.length > 0);
  const paths: string[] = [];
  for (const record of records) {
    if (/^.. /u.test(record)) paths.push(record.slice(3));
    else paths.push(record);
  }
  return [...new Set(paths)].sort(compare);
}

async function stageCompleteBytes(path: string, text: string): Promise<void> {
  let handle: FileHandle | undefined;
  let owns = false;
  try {
    handle = await open(
      path,
      constants.O_CREAT |
        constants.O_EXCL |
        constants.O_NOFOLLOW |
        constants.O_WRONLY,
      0o600,
    );
    owns = true;
    await handle.writeFile(text, 'utf8');
    await handle.sync();
    await handle.close();
    handle = undefined;
    await flushDirectory(dirname(path));
  } catch (error) {
    if (handle !== undefined) await handle.close().catch(() => undefined);
    if (owns) await unlink(path).catch(() => undefined);
    throw safeFileError(error);
  }
}

async function readBoundedNoFollow(
  path: string,
  maximumBytes: number,
): Promise<string> {
  let handle: FileHandle | undefined;
  try {
    handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > maximumBytes)
      throw ingestionError('ingestion.body-too-large');
    return await handle.readFile('utf8');
  } catch (error) {
    throw safeFileError(error);
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

async function fixedPath(root: string, relativePath: string): Promise<string> {
  if (
    relativePath.length < 1 ||
    relativePath.startsWith('/') ||
    relativePath
      .split('/')
      .some((segment) => segment === '..' || segment === '')
  )
    invalid();
  const canonicalRoot = await realpath(root);
  const target = resolve(canonicalRoot, relativePath);
  if (!target.startsWith(`${canonicalRoot}${sep}`)) invalid();
  const canonicalParent = await realpath(dirname(target));
  if (!canonicalParent.startsWith(`${canonicalRoot}${sep}`)) invalid();
  return target;
}

async function flushDirectory(path: string): Promise<void> {
  const handle = await open(path, constants.O_RDONLY);
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isMissing(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ENOENT'
  );
}

function safeFileError(error: unknown): IngestionError {
  if (error instanceof IngestionError) return error;
  return ingestionError('ingestion.invalid-input');
}

function invalid(): never {
  throw ingestionError('ingestion.invalid-input');
}
