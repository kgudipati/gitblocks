import { open, realpath, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import {
  buildCapabilityTaxonomyV1,
  parseCapabilityTaxonomySourceV1,
  parseCapabilityTaxonomyV1,
  serializeCapabilityTaxonomyV1,
} from '@gitblocks/contracts';

const SOURCE_RELATIVE_PATH = join(
  'catalog',
  'capability-taxonomy',
  '1.0.0',
  'source.json',
);
const MANIFEST_RELATIVE_PATH = join(
  'catalog',
  'capability-taxonomy',
  '1.0.0',
  'manifest.json',
);
const MAXIMUM_TAXONOMY_FILE_BYTES = 1_048_576;

export type TaxonomyCommandMode = 'generate' | 'validate';

export interface TaxonomyCommandResult {
  readonly concepts: number;
  readonly resolvedAliases: number;
  readonly ambiguities: number;
  readonly exclusions: number;
  readonly semanticDigest: string;
  readonly mode: TaxonomyCommandMode;
}

export class TaxonomyCommandError extends Error {
  public readonly code: TaxonomyCommandErrorCode;

  public constructor(code: TaxonomyCommandErrorCode) {
    super(TAXONOMY_COMMAND_MESSAGES[code]);
    this.name = 'TaxonomyCommandError';
    this.code = code;
  }
}

export type TaxonomyCommandErrorCode =
  | 'taxonomy-command.invalid-authority'
  | 'taxonomy-command.invalid-source'
  | 'taxonomy-command.path-boundary'
  | 'taxonomy-command.read-failed'
  | 'taxonomy-command.source-drift'
  | 'taxonomy-command.write-failed';

const TAXONOMY_COMMAND_MESSAGES: Readonly<
  Record<TaxonomyCommandErrorCode, string>
> = {
  'taxonomy-command.invalid-authority':
    'Committed taxonomy authority is invalid.',
  'taxonomy-command.invalid-source': 'Reviewed taxonomy source is invalid.',
  'taxonomy-command.path-boundary':
    'Taxonomy command path is outside its fixed authority boundary.',
  'taxonomy-command.read-failed':
    'Taxonomy authority could not be read safely.',
  'taxonomy-command.source-drift':
    'Committed taxonomy authority does not match its reviewed source.',
  'taxonomy-command.write-failed':
    'Generated taxonomy authority could not be written safely.',
};

export async function runTaxonomyCommand(
  repositoryRoot: string,
  mode: TaxonomyCommandMode,
): Promise<TaxonomyCommandResult> {
  const trustedRoot = await resolveTrustedRoot(repositoryRoot);
  const sourcePath = join(trustedRoot, SOURCE_RELATIVE_PATH);
  const manifestPath = join(trustedRoot, MANIFEST_RELATIVE_PATH);
  const sourceText = await readBoundedRegularFile(sourcePath, trustedRoot);
  const source = parseJson(sourceText, 'taxonomy-command.invalid-source');
  const parsedSource = parseCapabilityTaxonomySourceV1(source);
  if (!parsedSource.ok) {
    throw new TaxonomyCommandError('taxonomy-command.invalid-source');
  }
  const expected = buildCapabilityTaxonomyV1(parsedSource.value);
  const expectedText = serializeCapabilityTaxonomyV1(expected);

  if (mode === 'generate') {
    await writeFixedManifest(manifestPath, trustedRoot, expectedText);
  } else {
    const committedText = await readBoundedRegularFile(
      manifestPath,
      trustedRoot,
    );
    const committed = parseJson(
      committedText,
      'taxonomy-command.invalid-authority',
    );
    if (!parseCapabilityTaxonomyV1(committed).ok) {
      throw new TaxonomyCommandError('taxonomy-command.invalid-authority');
    }
    if (committedText !== expectedText) {
      throw new TaxonomyCommandError('taxonomy-command.source-drift');
    }
  }

  return {
    mode,
    concepts: expected.concepts.length,
    resolvedAliases: expected.resolvedAliases.length,
    ambiguities: expected.ambiguities.length,
    exclusions: expected.exclusions.length,
    semanticDigest: expected.semanticDigest,
  };
}

async function resolveTrustedRoot(repositoryRoot: string): Promise<string> {
  const resolved = resolve(repositoryRoot);
  try {
    const canonical = await realpath(resolved);
    if (canonical !== resolved) {
      throw new TaxonomyCommandError('taxonomy-command.path-boundary');
    }
    return canonical;
  } catch (error) {
    if (error instanceof TaxonomyCommandError) {
      throw error;
    }
    throw new TaxonomyCommandError('taxonomy-command.path-boundary');
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
      throw new TaxonomyCommandError('taxonomy-command.path-boundary');
    }
    const handle = await open(path, 'r');
    try {
      const metadata = await handle.stat();
      if (
        !metadata.isFile() ||
        metadata.size < 1 ||
        metadata.size > MAXIMUM_TAXONOMY_FILE_BYTES
      ) {
        throw new TaxonomyCommandError('taxonomy-command.read-failed');
      }
      return await handle.readFile({ encoding: 'utf8' });
    } finally {
      await handle.close();
    }
  } catch (error) {
    if (error instanceof TaxonomyCommandError) {
      throw error;
    }
    throw new TaxonomyCommandError('taxonomy-command.read-failed');
  }
}

async function writeFixedManifest(
  path: string,
  trustedRoot: string,
  content: string,
): Promise<void> {
  ensureContainedPath(path, trustedRoot);
  if (Buffer.byteLength(content, 'utf8') > MAXIMUM_TAXONOMY_FILE_BYTES) {
    throw new TaxonomyCommandError('taxonomy-command.write-failed');
  }
  const parent = resolve(path, '..');
  try {
    if ((await realpath(parent)) !== parent) {
      throw new TaxonomyCommandError('taxonomy-command.path-boundary');
    }
    try {
      const existing = await stat(path, { bigint: false });
      if (!existing.isFile() || (await realpath(path)) !== path) {
        throw new TaxonomyCommandError('taxonomy-command.path-boundary');
      }
    } catch (error) {
      if (
        error instanceof TaxonomyCommandError ||
        !isNodeErrorWithCode(error, 'ENOENT')
      ) {
        throw error;
      }
    }
    await writeFile(path, content, { encoding: 'utf8', flag: 'w' });
  } catch (error) {
    if (error instanceof TaxonomyCommandError) {
      throw error;
    }
    throw new TaxonomyCommandError('taxonomy-command.write-failed');
  }
}

function ensureContainedPath(path: string, trustedRoot: string): void {
  const boundary = `${trustedRoot}/`;
  if (!path.startsWith(boundary)) {
    throw new TaxonomyCommandError('taxonomy-command.path-boundary');
  }
}

function parseJson(value: string, code: TaxonomyCommandErrorCode): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new TaxonomyCommandError(code);
  }
}

function isNodeErrorWithCode(error: unknown, code: string): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    Reflect.get(error, 'code') === code
  );
}
