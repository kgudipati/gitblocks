import { open, realpath, stat, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

import {
  parseCapabilityTaxonomyV1,
  parseDeterministicCandidateProfileAuthorityV1,
  serializeDeterministicCandidateProfileAuthorityV1,
} from '@gitblocks/contracts';

import {
  buildCandidateProfileArtifacts,
  parsePublicCatalog,
} from '../src/index.ts';

const CATALOG_RELATIVE_PATH = join('catalog', 'public-v1', 'manifest.json');
const TAXONOMY_RELATIVE_PATH = join(
  'catalog',
  'capability-taxonomy',
  '1.0.0',
  'manifest.json',
);
const PROFILE_AUTHORITY_RELATIVE_PATH = join(
  'catalog',
  'public-v1',
  'candidate-profile-authority.json',
);
const COVERAGE_RELATIVE_PATH = join(
  'verification',
  'retrieval-v1',
  'profile-coverage.json',
);

const MAXIMUM_CATALOG_BYTES = 2 * 1_024 * 1_024;
const MAXIMUM_TAXONOMY_BYTES = 1 * 1_024 * 1_024;
const MAXIMUM_PROFILE_AUTHORITY_BYTES = 4 * 1_024 * 1_024;
const MAXIMUM_COVERAGE_REPORT_BYTES = 256 * 1_024;

export type CandidateProfileCommandMode = 'generate' | 'validate';
export interface CandidateProfileCommandResult {
  readonly mode: CandidateProfileCommandMode;
  readonly profiles: number;
  readonly known: number;
  readonly unknown: number;
  readonly notApplicable: number;
  readonly conflict: number;
  readonly authorityDigest: string;
  readonly coverageDigest: string;
}

export type CandidateProfileCommandErrorCode =
  | 'profile-command.invalid-authority'
  | 'profile-command.invalid-catalog'
  | 'profile-command.invalid-taxonomy'
  | 'profile-command.path-boundary'
  | 'profile-command.read-failed'
  | 'profile-command.source-drift'
  | 'profile-command.write-failed';

const MESSAGES: Readonly<Record<CandidateProfileCommandErrorCode, string>> = {
  'profile-command.invalid-authority':
    'Committed candidate-profile authority is invalid.',
  'profile-command.invalid-catalog': 'Committed public catalog is invalid.',
  'profile-command.invalid-taxonomy':
    'Committed capability taxonomy is invalid.',
  'profile-command.path-boundary':
    'Candidate-profile command path is outside its fixed authority boundary.',
  'profile-command.read-failed':
    'Candidate-profile authority could not be read safely.',
  'profile-command.source-drift':
    'Committed candidate-profile artifacts do not match approved authorities.',
  'profile-command.write-failed':
    'Generated candidate-profile artifacts could not be written safely.',
};

export class CandidateProfileCommandError extends Error {
  public readonly code: CandidateProfileCommandErrorCode;

  public constructor(code: CandidateProfileCommandErrorCode) {
    super(MESSAGES[code]);
    this.name = 'CandidateProfileCommandError';
    this.code = code;
  }
}

export async function runCandidateProfileCommand(
  repositoryRoot: string,
  mode: CandidateProfileCommandMode,
): Promise<CandidateProfileCommandResult> {
  const trustedRoot = await resolveTrustedRoot(repositoryRoot);
  const catalogPath = join(trustedRoot, CATALOG_RELATIVE_PATH);
  const taxonomyPath = join(trustedRoot, TAXONOMY_RELATIVE_PATH);
  const authorityPath = join(trustedRoot, PROFILE_AUTHORITY_RELATIVE_PATH);
  const coveragePath = join(trustedRoot, COVERAGE_RELATIVE_PATH);

  let catalog;
  try {
    catalog = parsePublicCatalog(
      await readBoundedRegularFile(
        catalogPath,
        trustedRoot,
        MAXIMUM_CATALOG_BYTES,
      ),
    );
  } catch (error) {
    if (error instanceof CandidateProfileCommandError) throw error;
    throw new CandidateProfileCommandError('profile-command.invalid-catalog');
  }
  const taxonomyText = await readBoundedRegularFile(
    taxonomyPath,
    trustedRoot,
    MAXIMUM_TAXONOMY_BYTES,
  );
  const taxonomy = parseCapabilityTaxonomyV1(
    parseJson(taxonomyText, 'profile-command.invalid-taxonomy'),
  );
  if (!taxonomy.ok) {
    throw new CandidateProfileCommandError('profile-command.invalid-taxonomy');
  }

  const generated = buildCandidateProfileArtifacts(catalog, taxonomy.value);
  const authorityText = serializeDeterministicCandidateProfileAuthorityV1(
    generated.authority,
  );
  const coverageText = `${JSON.stringify(generated.coverage, null, 2)}\n`;

  if (mode === 'generate') {
    await writeFixedFile(
      authorityPath,
      trustedRoot,
      authorityText,
      MAXIMUM_PROFILE_AUTHORITY_BYTES,
    );
    await writeFixedFile(
      coveragePath,
      trustedRoot,
      coverageText,
      MAXIMUM_COVERAGE_REPORT_BYTES,
    );
  } else {
    const committedAuthorityText = await readBoundedRegularFile(
      authorityPath,
      trustedRoot,
      MAXIMUM_PROFILE_AUTHORITY_BYTES,
    );
    const parsedAuthority = parseDeterministicCandidateProfileAuthorityV1(
      parseJson(committedAuthorityText, 'profile-command.invalid-authority'),
    );
    if (!parsedAuthority.ok) {
      throw new CandidateProfileCommandError(
        'profile-command.invalid-authority',
      );
    }
    const committedCoverageText = await readBoundedRegularFile(
      coveragePath,
      trustedRoot,
      MAXIMUM_COVERAGE_REPORT_BYTES,
    );
    if (
      committedAuthorityText !== authorityText ||
      committedCoverageText !== coverageText
    ) {
      throw new CandidateProfileCommandError('profile-command.source-drift');
    }
  }

  return {
    mode,
    profiles: generated.coverage.totals.profiles,
    known: generated.coverage.totals.known,
    unknown: generated.coverage.totals.unknown,
    notApplicable: generated.coverage.totals.notApplicable,
    conflict: generated.coverage.totals.conflict,
    authorityDigest: generated.authority.semanticAuthorityDigest,
    coverageDigest: generated.coverage.reportDigest,
  };
}

async function resolveTrustedRoot(repositoryRoot: string): Promise<string> {
  const resolved = resolve(repositoryRoot);
  try {
    const canonical = await realpath(resolved);
    if (canonical !== resolved) {
      throw new CandidateProfileCommandError('profile-command.path-boundary');
    }
    return canonical;
  } catch (error) {
    if (error instanceof CandidateProfileCommandError) throw error;
    throw new CandidateProfileCommandError('profile-command.path-boundary');
  }
}

async function readBoundedRegularFile(
  path: string,
  trustedRoot: string,
  maximumBytes: number,
): Promise<string> {
  ensureContainedPath(path, trustedRoot);
  try {
    if ((await realpath(path)) !== path) {
      throw new CandidateProfileCommandError('profile-command.path-boundary');
    }
    const handle = await open(path, 'r');
    try {
      const metadata = await handle.stat();
      if (
        !metadata.isFile() ||
        metadata.size < 1 ||
        metadata.size > maximumBytes
      ) {
        throw new CandidateProfileCommandError('profile-command.read-failed');
      }
      return await handle.readFile({ encoding: 'utf8' });
    } finally {
      await handle.close();
    }
  } catch (error) {
    if (error instanceof CandidateProfileCommandError) throw error;
    throw new CandidateProfileCommandError('profile-command.read-failed');
  }
}

async function writeFixedFile(
  path: string,
  trustedRoot: string,
  content: string,
  maximumBytes: number,
): Promise<void> {
  ensureContainedPath(path, trustedRoot);
  if (Buffer.byteLength(content, 'utf8') > maximumBytes) {
    throw new CandidateProfileCommandError('profile-command.write-failed');
  }
  const parent = resolve(path, '..');
  try {
    if ((await realpath(parent)) !== parent) {
      throw new CandidateProfileCommandError('profile-command.path-boundary');
    }
    try {
      const existing = await stat(path);
      if (!existing.isFile() || (await realpath(path)) !== path) {
        throw new CandidateProfileCommandError('profile-command.path-boundary');
      }
    } catch (error) {
      if (
        error instanceof CandidateProfileCommandError ||
        !isNodeErrorWithCode(error, 'ENOENT')
      ) {
        throw error;
      }
    }
    await writeFile(path, content, { encoding: 'utf8', flag: 'w' });
  } catch (error) {
    if (error instanceof CandidateProfileCommandError) throw error;
    throw new CandidateProfileCommandError('profile-command.write-failed');
  }
}

function ensureContainedPath(path: string, trustedRoot: string): void {
  const relation = relative(trustedRoot, path);
  if (
    relation === '' ||
    relation.startsWith('..') ||
    resolve(trustedRoot, relation) !== path
  ) {
    throw new CandidateProfileCommandError('profile-command.path-boundary');
  }
}

function parseJson(
  text: string,
  code: CandidateProfileCommandErrorCode,
): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new CandidateProfileCommandError(code);
  }
}

function isNodeErrorWithCode(error: unknown, code: string): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    Reflect.get(error, 'code') === code
  );
}
