import { execFileSync } from 'node:child_process';
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, join, normalize, posix, resolve, sep } from 'node:path';

import { diagnostic, type Diagnostic } from './types.ts';

const MAX_DIRECTORY_ASCENTS = 32;
const MAX_FILE_BYTES = 1024 * 1024;
const MAX_PATH_BYTES = 1024;
const MAX_TEXT_BYTES = 16 * 1024 * 1024;
const MAX_TRACKED_FILES = 5_000;
const MAX_GIT_OUTPUT_BYTES = 4 * 1024 * 1024;

export interface RepositorySnapshot {
  readonly diagnostics: readonly Diagnostic[];
  readonly root: string;
  readonly textFiles: ReadonlyMap<string, string>;
  readonly trackedPaths: ReadonlySet<string>;
}

export class RepositoryBoundaryError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'RepositoryBoundaryError';
    this.code = code;
  }
}

export function readRepository(startDirectory: string): RepositorySnapshot {
  const root = findRepositoryRoot(startDirectory);
  const trackedPaths = listTrackedPaths(root);
  const diagnostics: Diagnostic[] = [];
  const textFiles = new Map<string, string>();
  let totalTextBytes = 0;

  for (const trackedPath of trackedPaths) {
    if (!shouldReadText(trackedPath)) {
      continue;
    }

    const absolutePath = resolveTrackedPath(root, trackedPath);
    let fileStatus;
    try {
      fileStatus = lstatSync(absolutePath);
    } catch {
      diagnostics.push(
        diagnostic(
          'repository.unreadable-file',
          'Tracked file could not be inspected.',
          trackedPath,
        ),
      );
      continue;
    }

    if (fileStatus.isSymbolicLink()) {
      diagnostics.push(
        diagnostic(
          'repository.symlink',
          'Tracked text files must not be symbolic links.',
          trackedPath,
        ),
      );
      continue;
    }
    if (!fileStatus.isFile()) {
      diagnostics.push(
        diagnostic(
          'repository.file-type',
          'Tracked text path must be a regular file.',
          trackedPath,
        ),
      );
      continue;
    }
    if (fileStatus.size > MAX_FILE_BYTES) {
      diagnostics.push(
        diagnostic(
          'repository.file-size',
          `Tracked text file exceeds the ${String(MAX_FILE_BYTES)}-byte read limit.`,
          trackedPath,
        ),
      );
      continue;
    }
    if (totalTextBytes + fileStatus.size > MAX_TEXT_BYTES) {
      diagnostics.push(
        diagnostic(
          'repository.total-size',
          `Tracked text exceeds the ${String(MAX_TEXT_BYTES)}-byte aggregate read limit.`,
          trackedPath,
        ),
      );
      break;
    }

    let canonicalPath: string;
    try {
      canonicalPath = realpathSync(absolutePath);
    } catch {
      diagnostics.push(
        diagnostic(
          'repository.unreadable-file',
          'Tracked file could not be resolved.',
          trackedPath,
        ),
      );
      continue;
    }
    if (!isPathInside(root, canonicalPath)) {
      diagnostics.push(
        diagnostic(
          'repository.path-escape',
          'Tracked file resolves outside the repository root.',
          trackedPath,
        ),
      );
      continue;
    }

    try {
      textFiles.set(trackedPath, readFileSync(canonicalPath, 'utf8'));
      totalTextBytes += fileStatus.size;
    } catch {
      diagnostics.push(
        diagnostic(
          'repository.unreadable-file',
          'Tracked file could not be read as UTF-8 text.',
          trackedPath,
        ),
      );
    }
  }

  return { diagnostics, root, textFiles, trackedPaths };
}

function findRepositoryRoot(startDirectory: string): string {
  let currentDirectory: string;
  try {
    currentDirectory = realpathSync(startDirectory);
  } catch {
    throw new RepositoryBoundaryError(
      'repository.root',
      'Starting directory could not be resolved.',
    );
  }

  for (let depth = 0; depth <= MAX_DIRECTORY_ASCENTS; depth += 1) {
    try {
      const gitMetadata = lstatSync(join(currentDirectory, '.git'));
      if (gitMetadata.isDirectory() || gitMetadata.isFile()) {
        return currentDirectory;
      }
    } catch {
      // A missing .git entry means the bounded parent walk should continue.
    }

    const parentDirectory = dirname(currentDirectory);
    if (parentDirectory === currentDirectory) {
      break;
    }
    currentDirectory = parentDirectory;
  }

  throw new RepositoryBoundaryError(
    'repository.root',
    `No Git repository root was found within ${String(MAX_DIRECTORY_ASCENTS)} parent directories.`,
  );
}

function listTrackedPaths(repositoryRoot: string): ReadonlySet<string> {
  let output: string;
  try {
    output = execFileSync(
      'git',
      [
        '-c',
        'core.fsmonitor=false',
        '-c',
        'core.hooksPath=/dev/null',
        '-C',
        repositoryRoot,
        'ls-files',
        '-z',
        '--full-name',
      ],
      {
        encoding: 'utf8',
        env: {
          ...process.env,
          GIT_ATTR_NOSYSTEM: '1',
          GIT_CONFIG_GLOBAL: '/dev/null',
          GIT_CONFIG_NOSYSTEM: '1',
          GIT_OPTIONAL_LOCKS: '0',
        },
        maxBuffer: MAX_GIT_OUTPUT_BYTES,
        stdio: ['ignore', 'pipe', 'ignore'],
      },
    );
  } catch {
    throw new RepositoryBoundaryError(
      'repository.git-index',
      'The tracked-file index could not be read safely.',
    );
  }

  const paths = output.endsWith('\0')
    ? output.slice(0, -1).split('\0')
    : output.length === 0
      ? []
      : output.split('\0');
  if (paths.length > MAX_TRACKED_FILES) {
    throw new RepositoryBoundaryError(
      'repository.file-count',
      `Repository exceeds the ${String(MAX_TRACKED_FILES)}-tracked-file limit.`,
    );
  }

  const trackedPaths = new Set<string>();
  for (const trackedPath of paths) {
    validateTrackedPath(trackedPath);
    trackedPaths.add(trackedPath);
  }
  return new Set([...trackedPaths].sort(compareText));
}

function validateTrackedPath(trackedPath: string): void {
  if (
    trackedPath.length === 0 ||
    Buffer.byteLength(trackedPath, 'utf8') > MAX_PATH_BYTES ||
    posix.isAbsolute(trackedPath) ||
    posix.normalize(trackedPath) !== trackedPath ||
    Array.from(trackedPath).some((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint <= 31 || codePoint === 127;
    })
  ) {
    throw new RepositoryBoundaryError(
      'repository.tracked-path',
      'The Git index contains an unsafe or unsupported tracked path.',
    );
  }
}

function resolveTrackedPath(
  repositoryRoot: string,
  trackedPath: string,
): string {
  const absolutePath = resolve(repositoryRoot, ...trackedPath.split('/'));
  if (!isPathInside(repositoryRoot, absolutePath)) {
    throw new RepositoryBoundaryError(
      'repository.path-escape',
      'A tracked path escapes the repository root.',
    );
  }
  return absolutePath;
}

function isPathInside(repositoryRoot: string, candidatePath: string): boolean {
  const normalizedRoot = normalize(repositoryRoot);
  const normalizedCandidate = normalize(candidatePath);
  return (
    normalizedCandidate === normalizedRoot ||
    normalizedCandidate.startsWith(`${normalizedRoot}${sep}`)
  );
}

function shouldReadText(trackedPath: string): boolean {
  return (
    trackedPath.endsWith('.md') ||
    trackedPath.endsWith('package.json') ||
    trackedPath === 'pnpm-workspace.yaml' ||
    (/^\.github\/workflows\/.+\.ya?ml$/u.test(trackedPath) &&
      !trackedPath.endsWith('/'))
  );
}

function compareText(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  return left > right ? 1 : 0;
}
