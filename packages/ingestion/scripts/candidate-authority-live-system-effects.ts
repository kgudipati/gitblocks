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
  CANDIDATE_AUTHORITY_GITHUB_TOKEN_ENVIRONMENT,
  CANDIDATE_AUTHORITY_SOURCE_AUTHORITY_PATH,
  CANDIDATE_AUTHORITY_SOURCE_MAXIMUM_SERIALIZED_BYTES,
  CANDIDATE_AUTHORITY_SOURCE_STAGING_PATH,
} from '../src/candidate-authority-live-contracts.ts';
import { collectCandidateAuthoritySourceAuthority } from '../src/candidate-authority-live-collector.ts';
import type {
  CandidateAuthorityLiveCollectionEffects,
  CandidateAuthorityLiveValidationEffects,
} from '../src/candidate-authority-live-runner.ts';
import { IngestionError, ingestionError } from '../src/errors.ts';
import { abortableSleep, createTransport } from '../src/transport.ts';

const execFileAsync = promisify(execFile);

export function createCandidateAuthorityLiveSystemEffects(config: {
  readonly repositoryRoot: string;
  readonly environment: Readonly<Record<string, string | undefined>>;
  readonly fetch: typeof fetch;
  readonly now: () => Date;
  readonly collect?: CandidateAuthorityLiveCollectionEffects['collect'];
}): CandidateAuthorityLiveCollectionEffects &
  CandidateAuthorityLiveValidationEffects {
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
    readGitState: async () => {
      const options = {
        cwd: config.repositoryRoot,
        encoding: 'utf8' as const,
        maxBuffer: 1024 * 1024,
      };
      const [branch, head, originHead, parentHead, status] = await Promise.all([
        execFileAsync('git', ['branch', '--show-current'], options),
        execFileAsync('git', ['rev-parse', 'HEAD'], options),
        execFileAsync(
          'git',
          ['rev-parse', 'origin/feat/32-codebase-conditioned-ranking'],
          options,
        ),
        execFileAsync('git', ['rev-parse', 'HEAD^'], options),
        execFileAsync(
          'git',
          ['status', '--porcelain=v1', '--untracked-files=all'],
          options,
        ),
      ]);
      return {
        branch: branch.stdout.trim(),
        head: head.stdout.trim(),
        originHead: originHead.stdout.trim(),
        parentHead: parentHead.stdout.trim(),
        clean: status.stdout.length === 0,
      };
    },
    readCredential: (name) => {
      if (name !== CANDIDATE_AUTHORITY_GITHUB_TOKEN_ENVIRONMENT)
        throw ingestionError('ingestion.invalid-input');
      const value = config.environment[name];
      if (
        value === undefined ||
        value.length < 1 ||
        value.length > 4_096 ||
        hasControlCharacter(value)
      )
        throw ingestionError('ingestion.invalid-input');
      return value;
    },
    now: config.now,
    collect:
      config.collect ??
      (async ({
        catalog,
        sourcePolicy,
        authorization,
        credential,
        collectionCutoff,
        signal,
      }) => {
        const attempts = {
          githubAttempts: 0,
          npmAttempts: 0,
          retries: 0,
          perOperationAttempts: {} as Record<string, number>,
        };
        const transport = createTransport({
          fetch: config.fetch,
          sleep: abortableSleep,
          maximumRedirects: 0,
          maximumAttempts: 3,
          observer: (event) => {
            if (event.outcome === 'started') {
              if (event.provider === 'github') attempts.githubAttempts += 1;
              else attempts.npmAttempts += 1;
              attempts.perOperationAttempts[event.operation] =
                (attempts.perOperationAttempts[event.operation] ?? 0) + 1;
            }
            if (event.outcome === 'retried') attempts.retries += 1;
          },
        });
        return collectCandidateAuthoritySourceAuthority({
          catalog,
          sourcePolicy,
          liveAuthorizationVersion: authorization.authorizationVersion,
          liveAuthorizationDigest: authorization.authorizationSemanticDigest,
          liveAuthorizationBindings: authorization.bindings,
          githubToken: credential,
          collectionCutoff,
          transport,
          readAttemptMetrics: () => ({
            ...attempts,
            perOperationAttempts: { ...attempts.perOperationAttempts },
          }),
          ...(signal === undefined ? {} : { signal }),
        });
      }),
    stageExclusive: async (path, text) => {
      if (
        path !== CANDIDATE_AUTHORITY_SOURCE_STAGING_PATH ||
        !text.endsWith('\n') ||
        Buffer.byteLength(text, 'utf8') >
          CANDIDATE_AUTHORITY_SOURCE_MAXIMUM_SERIALIZED_BYTES
      )
        throw ingestionError('ingestion.invalid-input');
      await stageCompleteBytes(
        await fixedPath(config.repositoryRoot, path),
        text,
      );
    },
    publishStagedExclusive: async (stagingPath, finalPath) => {
      if (
        stagingPath !== CANDIDATE_AUTHORITY_SOURCE_STAGING_PATH ||
        finalPath !== CANDIDATE_AUTHORITY_SOURCE_AUTHORITY_PATH
      )
        throw ingestionError('ingestion.invalid-input');
      const staging = await fixedPath(config.repositoryRoot, stagingPath);
      const final = await fixedPath(config.repositoryRoot, finalPath);
      if (dirname(staging) !== dirname(final))
        throw ingestionError('ingestion.invalid-input');
      await publishHardLinkNoReplace(staging, final);
    },
    removeOwnedStaging: async (path) => {
      if (path !== CANDIDATE_AUTHORITY_SOURCE_STAGING_PATH)
        throw ingestionError('ingestion.invalid-input');
      const staging = await fixedPath(config.repositoryRoot, path);
      try {
        await unlink(staging);
        await flushDirectory(dirname(staging));
      } catch (error) {
        if (!isMissing(error)) throw safeFileError(error);
      }
    },
  };
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

async function publishHardLinkNoReplace(
  staging: string,
  final: string,
): Promise<void> {
  let linked = false;
  try {
    await link(staging, final);
    linked = true;
    await unlink(staging);
    await flushDirectory(dirname(final));
  } catch (error) {
    if (linked) await unlink(final).catch(() => undefined);
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
    const bytes = await handle.readFile();
    if (bytes.byteLength > maximumBytes)
      throw ingestionError('ingestion.body-too-large');
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch (error) {
    if (isMissing(error)) throw error;
    throw safeFileError(error);
  } finally {
    if (handle !== undefined) await handle.close().catch(() => undefined);
  }
}

async function fixedPath(
  repositoryRoot: string,
  relativePath: string,
): Promise<string> {
  if (
    relativePath.startsWith('/') ||
    relativePath.includes('\\') ||
    relativePath
      .split('/')
      .some((part) => part === '' || part === '.' || part === '..')
  )
    throw ingestionError('ingestion.invalid-input');
  const root = await realpath(repositoryRoot);
  const target = resolve(root, relativePath);
  if (!target.startsWith(`${root}${sep}`))
    throw ingestionError('ingestion.invalid-input');
  let current = dirname(target);
  while (current !== root) {
    const stat = await lstat(current);
    if (!stat.isDirectory() || stat.isSymbolicLink())
      throw ingestionError('ingestion.invalid-input');
    current = dirname(current);
  }
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

function safeFileError(error: unknown): IngestionError {
  return error instanceof IngestionError
    ? error
    : ingestionError('ingestion.internal-invariant');
}

function isMissing(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { readonly code?: unknown }).code === 'ENOENT'
  );
}

function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 31 || code === 127) return true;
  }
  return false;
}
