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
  CANDIDATE_AUTHORITY_SUCCESSOR_MAXIMUM_SOURCE_BYTES,
  CANDIDATE_AUTHORITY_SUCCESSOR_SOURCE_PATH,
} from '../src/candidate-authority-successor-contracts.ts';
import {
  CANDIDATE_AUTHORITY_SUCCESSOR_READINESS_OUTPUTS,
  CANDIDATE_AUTHORITY_SUCCESSOR_REPLAY_OUTPUTS,
  type CandidateAuthoritySuccessorReplayGitState,
  type CandidateAuthoritySuccessorReplayWriteEffects,
} from '../src/candidate-authority-successor-replay-runner.ts';
import { IngestionError, ingestionError } from '../src/errors.ts';

const execFileAsync = promisify(execFile);
const ALL_OUTPUTS = [
  ...CANDIDATE_AUTHORITY_SUCCESSOR_REPLAY_OUTPUTS,
  ...CANDIDATE_AUTHORITY_SUCCESSOR_READINESS_OUTPUTS,
] as const;
const STAGING_BY_FINAL: ReadonlyMap<string, string> = new Map<string, string>(
  ALL_OUTPUTS.map(({ path }) => [
    path,
    path.replace(/\.json$/u, '.staging.json'),
  ]),
);

export function createCandidateAuthoritySuccessorReplaySystemEffects(config: {
  readonly repositoryRoot: string;
}): CandidateAuthoritySuccessorReplayWriteEffects {
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
      invalid();
    },
    readGitState: () => readGitState(config.repositoryRoot),
    publishExclusive: async (outputs) => {
      validateOutputSet(outputs);
      const staged: string[] = [];
      const published: string[] = [];
      try {
        for (const output of outputs) {
          const stagingRelative =
            STAGING_BY_FINAL.get(output.path) ?? invalid();
          const staging = await fixedPath(
            config.repositoryRoot,
            stagingRelative,
          );
          await stageCompleteBytes(staging, output.text);
          staged.push(staging);
        }
        for (const output of outputs) {
          const staging = await fixedPath(
            config.repositoryRoot,
            STAGING_BY_FINAL.get(output.path) ?? invalid(),
          );
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
): Promise<CandidateAuthoritySuccessorReplayGitState> {
  const options = {
    cwd: repositoryRoot,
    encoding: 'utf8' as const,
    maxBuffer: CANDIDATE_AUTHORITY_SUCCESSOR_MAXIMUM_SOURCE_BYTES + 1024,
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
  const freezeResult = await execFileAsync(
    'git',
    [
      'log',
      '--diff-filter=A',
      '--format=%H',
      '-n',
      '1',
      '--',
      CANDIDATE_AUTHORITY_SUCCESSOR_SOURCE_PATH,
    ],
    options,
  );
  const sourceFreezeHead = freezeResult.stdout.trim() || null;
  let sourceFreezeParentHead: string | null = null;
  let sourceFreezeIsAncestor = false;
  let sourceCommitPaths: readonly string[] = [];
  let sourceBytesAtFreezeHead: string | null = null;
  if (sourceFreezeHead !== null) {
    const [parent, paths, source] = await Promise.all([
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
          `${sourceFreezeHead}:${CANDIDATE_AUTHORITY_SUCCESSOR_SOURCE_PATH}`,
        ],
        options,
      ),
    ]);
    sourceFreezeParentHead = parent.stdout.trim();
    sourceCommitPaths = lines(paths.stdout);
    sourceBytesAtFreezeHead = source.stdout;
    try {
      await execFileAsync(
        'git',
        ['merge-base', '--is-ancestor', sourceFreezeHead, 'HEAD'],
        options,
      );
      sourceFreezeIsAncestor = true;
    } catch {
      sourceFreezeIsAncestor = false;
    }
  }
  const sourceBytesAtHead = await readGitPathOrNull(
    CANDIDATE_AUTHORITY_SUCCESSOR_SOURCE_PATH,
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
  const accepted = [
    CANDIDATE_AUTHORITY_SUCCESSOR_REPLAY_OUTPUTS,
    CANDIDATE_AUTHORITY_SUCCESSOR_READINESS_OUTPUTS,
  ].some(
    (set) =>
      outputs.length === set.length &&
      outputs.every(
        (output, index) =>
          output.path === set[index]?.path &&
          output.maximumBytes === set[index].maximumBytes,
      ),
  );
  if (!accepted) invalid();
  for (const output of outputs) {
    if (
      !output.text.endsWith('\n') ||
      Buffer.byteLength(output.text, 'utf8') > output.maximumBytes ||
      !STAGING_BY_FINAL.has(output.path)
    )
      invalid();
  }
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
    .filter(Boolean)
    .sort();
}

function porcelainPaths(value: string): readonly string[] {
  return [
    ...new Set(
      value
        .split('\0')
        .filter(Boolean)
        .map((record) => (/^.. /u.test(record) ? record.slice(3) : record)),
    ),
  ].sort();
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
    await handle?.close().catch(() => undefined);
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
    if (!stat.isFile() || stat.size > maximumBytes) invalid();
    return await handle.readFile('utf8');
  } catch (error) {
    throw safeFileError(error);
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

async function fixedPath(
  rootInput: string,
  relativePath: string,
): Promise<string> {
  if (
    relativePath.length < 1 ||
    relativePath.startsWith('/') ||
    relativePath.includes('\\') ||
    relativePath
      .split('/')
      .some((part) => part === '' || part === '.' || part === '..')
  )
    invalid();
  const root = await realpath(rootInput);
  const target = resolve(root, relativePath);
  if (!target.startsWith(`${root}${sep}`)) invalid();
  const parent = await realpath(dirname(target));
  if (!parent.startsWith(`${root}${sep}`)) invalid();
  return target;
}

async function flushDirectory(path: string): Promise<void> {
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
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
  return error instanceof IngestionError
    ? error
    : ingestionError('ingestion.invalid-input');
}

function invalid(): never {
  throw ingestionError('ingestion.invalid-input');
}
