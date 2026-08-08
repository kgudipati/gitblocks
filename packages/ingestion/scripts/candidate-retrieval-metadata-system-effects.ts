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

import { CANDIDATE_RETRIEVAL_METADATA_AUTHORITY_MAX_BYTES } from '@gitblocks/contracts';

import { collectCandidateRetrievalMetadataAuthority } from '../src/candidate-retrieval-metadata-collector.ts';
import { probeCandidateRetrievalMetadataIdentities } from '../src/candidate-retrieval-metadata-identity-probe.ts';
import {
  CANDIDATE_RETRIEVAL_METADATA_AUTHORITY_PATH,
  CANDIDATE_RETRIEVAL_METADATA_GITHUB_TOKEN_ENVIRONMENT,
  CANDIDATE_RETRIEVAL_METADATA_STAGING_PATH,
} from '../src/candidate-retrieval-metadata-policy.ts';
import type {
  CandidateRetrievalMetadataCollectionEffects,
  CandidateRetrievalMetadataIdentityProbeEffects,
  CandidateRetrievalMetadataValidationEffects,
} from '../src/candidate-retrieval-metadata-runner.ts';
import { IngestionError, ingestionError } from '../src/errors.ts';
import { abortableSleep, createTransport } from '../src/transport.ts';

export interface CandidateRetrievalMetadataSystemEffectsConfig {
  readonly repositoryRoot: string;
  readonly environment: Readonly<Record<string, string | undefined>>;
  readonly fetch: typeof fetch;
  readonly now: () => Date;
  readonly collect?: CandidateRetrievalMetadataCollectionEffects['collect'];
  readonly probeIdentities?: CandidateRetrievalMetadataIdentityProbeEffects['probeIdentities'];
}

export type CandidateRetrievalMetadataSystemEffects =
  CandidateRetrievalMetadataCollectionEffects &
    CandidateRetrievalMetadataIdentityProbeEffects &
    CandidateRetrievalMetadataValidationEffects;

export function createCandidateRetrievalMetadataSystemEffects(
  config: CandidateRetrievalMetadataSystemEffectsConfig,
): CandidateRetrievalMetadataSystemEffects {
  return {
    readFixedFile: async (path, maximumBytes) => {
      const target = await fixedPath(config.repositoryRoot, path);
      return readBoundedNoFollow(target, maximumBytes);
    },
    readAuthorityFile: async (path, maximumBytes) => {
      if (path !== CANDIDATE_RETRIEVAL_METADATA_AUTHORITY_PATH) {
        throw ingestionError('ingestion.invalid-input');
      }
      const target = await fixedPath(config.repositoryRoot, path);
      try {
        return {
          ok: true as const,
          text: await readBoundedNoFollow(target, maximumBytes),
        };
      } catch (error) {
        if (isMissing(error)) {
          return { ok: false as const, issue: 'authority-missing' as const };
        }
        throw safeFileError(error);
      }
    },
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
    readCredential: (name) => {
      if (name !== CANDIDATE_RETRIEVAL_METADATA_GITHUB_TOKEN_ENVIRONMENT) {
        throw ingestionError('ingestion.invalid-input');
      }
      const value = config.environment[name];
      if (value === undefined || value.length < 1 || value.length > 4_096) {
        throw ingestionError('ingestion.invalid-input');
      }
      return value;
    },
    collect:
      config.collect ??
      (async (preflight, credential, signal) => {
        const operation = preflight.envelope.sourceOperation;
        const transport = createTransport({
          fetch: config.fetch,
          sleep: abortableSleep,
          requestTimeoutMilliseconds: operation.requestTimeoutMilliseconds,
          maximumRedirects: operation.maximumRedirects,
          maximumAttempts: operation.maximumAttempts,
        });
        const collectedAt = config.now().toISOString();
        return collectCandidateRetrievalMetadataAuthority(preflight.catalog, {
          transport,
          sourceProviderPolicy: preflight.sourcePolicy,
          collectionEnvelope: preflight.envelope,
          githubToken: credential,
          correlationId: `retrieval-metadata-${collectedAt}`,
          collectedAt,
          signal,
        });
      }),
    probeIdentities:
      config.probeIdentities ??
      (async (preflight, credential, signal) => {
        const attempts = { requestAttempts: 0, retries: 0 };
        const operation = preflight.sourceOperation;
        const transport = createTransport({
          fetch: config.fetch,
          sleep: abortableSleep,
          requestTimeoutMilliseconds: operation.requestTimeoutMilliseconds,
          maximumRedirects: operation.maximumRedirects,
          maximumAttempts: operation.maximumAttempts,
          observer: (event) => {
            if (event.outcome === 'started') attempts.requestAttempts += 1;
            if (event.outcome === 'retried') attempts.retries += 1;
          },
        });
        const probedAt = config.now().toISOString();
        return probeCandidateRetrievalMetadataIdentities(preflight.catalog, {
          transport,
          sourceProviderPolicy: preflight.sourcePolicy,
          githubToken: credential,
          correlationId: `retrieval-metadata-identity-probe-${probedAt}`,
          concurrency: operation.concurrency,
          candidateDeadlineMilliseconds:
            operation.candidateDeadlineMilliseconds,
          runDeadlineMilliseconds: operation.runDeadlineMilliseconds,
          readAttemptMetrics: () => ({ ...attempts }),
          signal,
        });
      }),
    stageExclusive: async (path, text) => {
      if (
        path !== CANDIDATE_RETRIEVAL_METADATA_STAGING_PATH ||
        !text.endsWith('\n') ||
        Buffer.byteLength(text, 'utf8') >
          CANDIDATE_RETRIEVAL_METADATA_AUTHORITY_MAX_BYTES
      ) {
        throw ingestionError('ingestion.invalid-input');
      }
      const stagingPath = await fixedPath(config.repositoryRoot, path);
      await stageCompleteBytes(stagingPath, text);
    },
    publishStagedExclusive: async (stagingPath, finalPath) => {
      if (
        stagingPath !== CANDIDATE_RETRIEVAL_METADATA_STAGING_PATH ||
        finalPath !== CANDIDATE_RETRIEVAL_METADATA_AUTHORITY_PATH
      ) {
        throw ingestionError('ingestion.invalid-input');
      }
      const staging = await fixedPath(config.repositoryRoot, stagingPath);
      const final = await fixedPath(config.repositoryRoot, finalPath);
      if (dirname(staging) !== dirname(final)) {
        throw ingestionError('ingestion.invalid-input');
      }
      await publishHardLinkNoReplace(staging, final);
    },
    removeOwnedStaging: async (path) => {
      if (path !== CANDIDATE_RETRIEVAL_METADATA_STAGING_PATH) {
        throw ingestionError('ingestion.invalid-input');
      }
      const staging = await fixedPath(config.repositoryRoot, path);
      try {
        await unlink(staging);
        await flushDirectory(dirname(staging));
      } catch (error) {
        if (isMissing(error)) return;
        throw safeFileError(error);
      }
    },
  };
}

async function stageCompleteBytes(path: string, text: string): Promise<void> {
  let handle: FileHandle | undefined;
  let ownsPath = false;
  try {
    handle = await open(
      path,
      constants.O_CREAT |
        constants.O_EXCL |
        constants.O_NOFOLLOW |
        constants.O_WRONLY,
      0o600,
    );
    ownsPath = true;
    await handle.writeFile(text, 'utf8');
    await handle.sync();
    await handle.close();
    handle = undefined;
    await flushDirectory(dirname(path));
  } catch (error) {
    if (handle !== undefined) await handle.close().catch(() => undefined);
    if (ownsPath) {
      await unlink(path).catch(() => undefined);
      await flushDirectory(dirname(path)).catch(() => undefined);
    }
    throw safeFileError(error);
  }
}

async function publishHardLinkNoReplace(
  stagingPath: string,
  finalPath: string,
): Promise<void> {
  let finalLinked = false;
  try {
    await link(stagingPath, finalPath);
    finalLinked = true;
    await unlink(stagingPath);
    await flushDirectory(dirname(finalPath));
  } catch (error) {
    if (finalLinked) {
      await unlink(finalPath).catch(() => undefined);
      await flushDirectory(dirname(finalPath)).catch(() => undefined);
    }
    throw safeFileError(error);
  }
}

async function readBoundedNoFollow(
  path: string,
  maximumBytes: number,
): Promise<string> {
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes < 1) {
    throw ingestionError('ingestion.invalid-input');
  }
  let handle: FileHandle | undefined;
  try {
    handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > maximumBytes) {
      throw ingestionError('ingestion.body-too-large');
    }
    const bytes = await handle.readFile();
    if (bytes.byteLength > maximumBytes) {
      throw ingestionError('ingestion.body-too-large');
    }
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
  ) {
    throw ingestionError('ingestion.invalid-input');
  }
  let root: string;
  try {
    root = await realpath(repositoryRoot);
  } catch (error) {
    throw safeFileError(error);
  }
  const target = resolve(root, relativePath);
  if (!target.startsWith(`${root}${sep}`)) {
    throw ingestionError('ingestion.invalid-input');
  }
  let current = dirname(target);
  while (current !== root) {
    try {
      const stat = await lstat(current);
      if (!stat.isDirectory() || stat.isSymbolicLink()) {
        throw ingestionError('ingestion.invalid-input');
      }
    } catch (error) {
      throw safeFileError(error);
    }
    current = dirname(current);
  }
  return target;
}

async function flushDirectory(path: string): Promise<void> {
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    await handle.sync();
  } finally {
    await handle.close().catch(() => undefined);
  }
}

function safeFileError(error: unknown): IngestionError {
  if (error instanceof IngestionError) return error;
  return ingestionError('ingestion.internal-invariant');
}

function isMissing(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { readonly code?: unknown }).code === 'ENOENT'
  );
}
