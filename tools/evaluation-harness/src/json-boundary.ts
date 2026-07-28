import { lstatSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { isAbsolute, normalize, posix, resolve, sep } from 'node:path';

const DEFAULT_MAXIMUM_FILE_BYTES = 256 * 1024;
const DEFAULT_MAXIMUM_FILES = 500;
const MAXIMUM_JSON_DEPTH = 64;
const MAXIMUM_JSON_NODES = 50_000;
const MAXIMUM_PATH_BYTES = 1_024;
const MAXIMUM_DIAGNOSTIC_CHARACTERS = 500;

export interface JsonDirectoryEntry {
  readonly path: string;
  readonly value: unknown;
}

export interface JsonDirectoryOptions {
  readonly maximumFiles?: number;
}

export class EvaluationBoundaryError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(sanitize(message));
    this.name = 'EvaluationBoundaryError';
    this.code = code;
  }
}

export function loadJsonFile(
  rootDirectory: string,
  relativePath: string,
): unknown {
  const canonicalPath = inspectJsonFile(rootDirectory, relativePath);

  let value: unknown;
  try {
    value = JSON.parse(readFileSync(canonicalPath, 'utf8')) as unknown;
  } catch {
    throw new EvaluationBoundaryError(
      'json.syntax',
      'JSON file must contain valid JSON.',
    );
  }
  validateStructure(value);
  return value;
}

export function hashJsonFile(
  rootDirectory: string,
  relativePath: string,
): string {
  const canonicalPath = inspectJsonFile(rootDirectory, relativePath);
  return createHash('sha256').update(readFileSync(canonicalPath)).digest('hex');
}

export function loadJsonDirectory(
  rootDirectory: string,
  relativeDirectory: string,
  options: JsonDirectoryOptions = {},
): readonly JsonDirectoryEntry[] {
  validateRelativePath(relativeDirectory);
  const canonicalRoot = resolveCanonicalRoot(rootDirectory);
  const directoryPath = resolve(canonicalRoot, ...relativeDirectory.split('/'));
  if (!isInside(canonicalRoot, directoryPath)) {
    throw new EvaluationBoundaryError(
      'json.path',
      'JSON directory escapes the allowed root.',
    );
  }

  let names: string[];
  try {
    names = readdirSync(directoryPath);
  } catch {
    throw new EvaluationBoundaryError(
      'json.unreadable',
      'JSON directory could not be read.',
    );
  }
  const jsonNames = names
    .filter((name) => name.endsWith('.json'))
    .sort(compareText);
  const maximumFiles = options.maximumFiles ?? DEFAULT_MAXIMUM_FILES;
  if (jsonNames.length > maximumFiles) {
    throw new EvaluationBoundaryError(
      'json.file-count',
      `JSON directory exceeds the ${String(maximumFiles)}-file limit.`,
    );
  }
  return jsonNames.map((name) => {
    const path = `${relativeDirectory}/${name}`;
    return { path, value: loadJsonFile(canonicalRoot, path) };
  });
}

function validateRelativePath(relativePath: string): void {
  if (
    relativePath.length === 0 ||
    Buffer.byteLength(relativePath, 'utf8') > MAXIMUM_PATH_BYTES ||
    isAbsolute(relativePath) ||
    posix.isAbsolute(relativePath) ||
    posix.normalize(relativePath) !== relativePath ||
    relativePath.split('/').some((segment) => segment.length === 0) ||
    Array.from(relativePath).some((character) => {
      const point = character.codePointAt(0) ?? 0;
      return point <= 31 || point === 127;
    })
  ) {
    throw new EvaluationBoundaryError(
      'json.path',
      'JSON path is unsafe or unsupported.',
    );
  }
}

function inspectJsonFile(rootDirectory: string, relativePath: string): string {
  validateRelativePath(relativePath);
  const canonicalRoot = resolveCanonicalRoot(rootDirectory);
  const absolutePath = resolve(canonicalRoot, ...relativePath.split('/'));
  if (!isInside(canonicalRoot, absolutePath)) {
    throw new EvaluationBoundaryError(
      'json.path',
      'JSON path escapes the allowed root.',
    );
  }

  let status;
  try {
    status = lstatSync(absolutePath);
  } catch {
    throw new EvaluationBoundaryError(
      'json.unreadable',
      'JSON file could not be inspected.',
    );
  }
  if (status.isSymbolicLink()) {
    throw new EvaluationBoundaryError(
      'json.symlink',
      'JSON files must not be symbolic links.',
    );
  }
  if (!status.isFile()) {
    throw new EvaluationBoundaryError(
      'json.file-type',
      'JSON path must be a regular file.',
    );
  }
  if (status.size > DEFAULT_MAXIMUM_FILE_BYTES) {
    throw new EvaluationBoundaryError(
      'json.file-size',
      `JSON file exceeds the ${String(DEFAULT_MAXIMUM_FILE_BYTES)}-byte limit.`,
    );
  }

  let canonicalPath: string;
  try {
    canonicalPath = realpathSync(absolutePath);
  } catch {
    throw new EvaluationBoundaryError(
      'json.unreadable',
      'JSON file could not be resolved.',
    );
  }
  if (!isInside(canonicalRoot, canonicalPath)) {
    throw new EvaluationBoundaryError(
      'json.path',
      'JSON file resolves outside the allowed root.',
    );
  }
  return canonicalPath;
}

function validateStructure(value: unknown): void {
  const stack: { readonly depth: number; readonly value: unknown }[] = [
    { depth: 0, value },
  ];
  let nodes = 0;
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined) {
      break;
    }
    nodes += 1;
    if (nodes > MAXIMUM_JSON_NODES || current.depth > MAXIMUM_JSON_DEPTH) {
      throw new EvaluationBoundaryError(
        'json.structure',
        'JSON exceeds the node-count or nesting-depth limit.',
      );
    }
    if (Array.isArray(current.value)) {
      for (const child of current.value) {
        stack.push({ depth: current.depth + 1, value: child });
      }
    } else if (isRecord(current.value)) {
      for (const [key, child] of Object.entries(current.value)) {
        if (hasControlCharacter(key)) {
          throw new EvaluationBoundaryError(
            'json.key',
            'JSON object key contains unsupported control characters.',
          );
        }
        stack.push({ depth: current.depth + 1, value: child });
      }
    }
  }
}

function resolveCanonicalRoot(rootDirectory: string): string {
  try {
    return realpathSync(rootDirectory);
  } catch {
    throw new EvaluationBoundaryError(
      'json.root',
      'JSON root could not be resolved.',
    );
  }
}

function isInside(root: string, candidate: string): boolean {
  const normalizedRoot = normalize(root);
  const normalizedCandidate = normalize(candidate);
  return (
    normalizedCandidate === normalizedRoot ||
    normalizedCandidate.startsWith(`${normalizedRoot}${sep}`)
  );
}

function hasControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const point = character.codePointAt(0) ?? 0;
    return point <= 31 || point === 127;
  });
}

function sanitize(value: string): string {
  const escaped = Array.from(value)
    .map((character) => {
      const point = character.codePointAt(0) ?? 0;
      return point <= 31 || point === 127
        ? `\\u${point.toString(16).padStart(4, '0')}`
        : character;
    })
    .join('');
  return escaped.slice(0, MAXIMUM_DIAGNOSTIC_CHARACTERS);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
