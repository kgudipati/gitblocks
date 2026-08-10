import { open, realpath, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import {
  buildCapabilityRetrievalExpansionV1,
  parseCapabilityRetrievalExpansionSourceV1,
  parseCapabilityRetrievalExpansionV1,
  parseCapabilityTaxonomyV1,
  serializeCapabilityRetrievalExpansionV1,
} from '@gitblocks/contracts';

const SOURCE_RELATIVE_PATH = join(
  'catalog',
  'capability-retrieval-expansion',
  '1.0.0',
  'source.json',
);
const MANIFEST_RELATIVE_PATH = join(
  'catalog',
  'capability-retrieval-expansion',
  '1.0.0',
  'manifest.json',
);
const TAXONOMY_RELATIVE_PATH = join(
  'catalog',
  'capability-taxonomy',
  '1.0.0',
  'manifest.json',
);
const MAXIMUM_AUTHORITY_FILE_BYTES = 1_048_576;

export type RetrievalExpansionCommandMode = 'generate' | 'validate';

export interface RetrievalExpansionCommandResult {
  readonly mode: RetrievalExpansionCommandMode;
  readonly edges: number;
  readonly sourceConcepts: number;
  readonly semanticDigest: string;
}

export class RetrievalExpansionCommandError extends Error {
  public readonly code: RetrievalExpansionCommandErrorCode;

  public constructor(code: RetrievalExpansionCommandErrorCode) {
    super(RETRIEVAL_EXPANSION_COMMAND_MESSAGES[code]);
    this.name = 'RetrievalExpansionCommandError';
    this.code = code;
  }
}

export type RetrievalExpansionCommandErrorCode =
  | 'retrieval-expansion-command.invalid-authority'
  | 'retrieval-expansion-command.invalid-source'
  | 'retrieval-expansion-command.invalid-taxonomy'
  | 'retrieval-expansion-command.path-boundary'
  | 'retrieval-expansion-command.read-failed'
  | 'retrieval-expansion-command.source-drift'
  | 'retrieval-expansion-command.write-failed';

const RETRIEVAL_EXPANSION_COMMAND_MESSAGES: Readonly<
  Record<RetrievalExpansionCommandErrorCode, string>
> = {
  'retrieval-expansion-command.invalid-authority':
    'Committed retrieval expansion authority is invalid.',
  'retrieval-expansion-command.invalid-source':
    'Reviewed retrieval expansion source is invalid.',
  'retrieval-expansion-command.invalid-taxonomy':
    'Bound capability taxonomy authority is invalid.',
  'retrieval-expansion-command.path-boundary':
    'Retrieval expansion command path is outside its fixed authority boundary.',
  'retrieval-expansion-command.read-failed':
    'Retrieval expansion authority could not be read safely.',
  'retrieval-expansion-command.source-drift':
    'Committed retrieval expansion authority does not match its reviewed source.',
  'retrieval-expansion-command.write-failed':
    'Generated retrieval expansion authority could not be written safely.',
};

export async function runRetrievalExpansionCommand(
  repositoryRoot: string,
  mode: RetrievalExpansionCommandMode,
): Promise<RetrievalExpansionCommandResult> {
  const trustedRoot = await resolveTrustedRoot(repositoryRoot);
  const sourcePath = join(trustedRoot, SOURCE_RELATIVE_PATH);
  const manifestPath = join(trustedRoot, MANIFEST_RELATIVE_PATH);
  const taxonomyPath = join(trustedRoot, TAXONOMY_RELATIVE_PATH);
  const source = parseJson(
    await readBoundedRegularFile(sourcePath, trustedRoot),
    'retrieval-expansion-command.invalid-source',
  );
  const taxonomy = parseJson(
    await readBoundedRegularFile(taxonomyPath, trustedRoot),
    'retrieval-expansion-command.invalid-taxonomy',
  );
  const parsedSource = parseCapabilityRetrievalExpansionSourceV1(source);
  const parsedTaxonomy = parseCapabilityTaxonomyV1(taxonomy);
  if (!parsedSource.ok) {
    throw new RetrievalExpansionCommandError(
      'retrieval-expansion-command.invalid-source',
    );
  }
  if (!parsedTaxonomy.ok) {
    throw new RetrievalExpansionCommandError(
      'retrieval-expansion-command.invalid-taxonomy',
    );
  }
  let expected;
  try {
    expected = buildCapabilityRetrievalExpansionV1(
      parsedSource.value,
      parsedTaxonomy.value,
    );
  } catch {
    throw new RetrievalExpansionCommandError(
      'retrieval-expansion-command.invalid-source',
    );
  }
  const expectedText = serializeCapabilityRetrievalExpansionV1(expected);

  if (mode === 'generate') {
    await writeFixedManifest(manifestPath, trustedRoot, expectedText);
  } else {
    const committedText = await readBoundedRegularFile(
      manifestPath,
      trustedRoot,
    );
    const committed = parseJson(
      committedText,
      'retrieval-expansion-command.invalid-authority',
    );
    if (!parseCapabilityRetrievalExpansionV1(committed).ok) {
      throw new RetrievalExpansionCommandError(
        'retrieval-expansion-command.invalid-authority',
      );
    }
    if (committedText !== expectedText) {
      throw new RetrievalExpansionCommandError(
        'retrieval-expansion-command.source-drift',
      );
    }
  }

  return {
    mode,
    edges: expected.edges.length,
    sourceConcepts: new Set(
      expected.edges.map(({ sourceConceptId }) => sourceConceptId),
    ).size,
    semanticDigest: expected.semanticDigest,
  };
}

async function resolveTrustedRoot(repositoryRoot: string): Promise<string> {
  const resolved = resolve(repositoryRoot);
  try {
    const canonical = await realpath(resolved);
    if (canonical !== resolved) {
      throw new RetrievalExpansionCommandError(
        'retrieval-expansion-command.path-boundary',
      );
    }
    return canonical;
  } catch (error) {
    if (error instanceof RetrievalExpansionCommandError) throw error;
    throw new RetrievalExpansionCommandError(
      'retrieval-expansion-command.path-boundary',
    );
  }
}

async function readBoundedRegularFile(
  path: string,
  trustedRoot: string,
): Promise<string> {
  ensureContainedPath(path, trustedRoot);
  try {
    const canonical = await realpath(path);
    if (canonical !== path) {
      throw new RetrievalExpansionCommandError(
        'retrieval-expansion-command.path-boundary',
      );
    }
    const handle = await open(path, 'r');
    try {
      const metadata = await handle.stat();
      if (
        !metadata.isFile() ||
        metadata.size < 1 ||
        metadata.size > MAXIMUM_AUTHORITY_FILE_BYTES
      ) {
        throw new RetrievalExpansionCommandError(
          'retrieval-expansion-command.read-failed',
        );
      }
      return await handle.readFile({ encoding: 'utf8' });
    } finally {
      await handle.close();
    }
  } catch (error) {
    if (error instanceof RetrievalExpansionCommandError) throw error;
    throw new RetrievalExpansionCommandError(
      'retrieval-expansion-command.read-failed',
    );
  }
}

async function writeFixedManifest(
  path: string,
  trustedRoot: string,
  content: string,
): Promise<void> {
  ensureContainedPath(path, trustedRoot);
  if (Buffer.byteLength(content, 'utf8') > MAXIMUM_AUTHORITY_FILE_BYTES) {
    throw new RetrievalExpansionCommandError(
      'retrieval-expansion-command.write-failed',
    );
  }
  const parent = resolve(path, '..');
  try {
    if ((await realpath(parent)) !== parent) {
      throw new RetrievalExpansionCommandError(
        'retrieval-expansion-command.path-boundary',
      );
    }
    try {
      const existing = await stat(path, { bigint: false });
      if (!existing.isFile() || (await realpath(path)) !== path) {
        throw new RetrievalExpansionCommandError(
          'retrieval-expansion-command.path-boundary',
        );
      }
    } catch (error) {
      if (
        error instanceof RetrievalExpansionCommandError ||
        !isNodeErrorWithCode(error, 'ENOENT')
      ) {
        throw error;
      }
    }
    await writeFile(path, content, { encoding: 'utf8', flag: 'w' });
  } catch (error) {
    if (error instanceof RetrievalExpansionCommandError) throw error;
    throw new RetrievalExpansionCommandError(
      'retrieval-expansion-command.write-failed',
    );
  }
}

function ensureContainedPath(path: string, trustedRoot: string): void {
  if (!path.startsWith(`${trustedRoot}/`)) {
    throw new RetrievalExpansionCommandError(
      'retrieval-expansion-command.path-boundary',
    );
  }
}

function parseJson(
  value: string,
  code: RetrievalExpansionCommandErrorCode,
): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new RetrievalExpansionCommandError(code);
  }
}

function isNodeErrorWithCode(error: unknown, code: string): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    Reflect.get(error, 'code') === code
  );
}
