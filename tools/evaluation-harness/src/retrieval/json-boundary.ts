import {
  lstatSync,
  readdirSync,
  readFileSync,
  realpathSync,
  type Stats,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { isAbsolute, normalize, posix, resolve, sep } from 'node:path';

const MAXIMUM_FILE_BYTES = 256 * 1024;
const MAXIMUM_CORPUS_BYTES = 16 * 1024 * 1024;
const MAXIMUM_FILES = 500;
const MAXIMUM_DEPTH = 64;
const MAXIMUM_NODES = 50_000;
const MAXIMUM_PATH_BYTES = 1_024;
const MAXIMUM_DIAGNOSTIC_CHARACTERS = 500;

export interface RetrievalJsonFile {
  readonly path: string;
  readonly bytes: number;
}

export interface RetrievalJsonListOptions {
  readonly maximumFiles?: number;
  readonly maximumTotalBytes?: number;
}

export interface RetrievalJsonLoadOptions {
  readonly maximumFileBytes?: number;
}

export class RetrievalBoundaryError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(sanitize(message));
    this.name = 'RetrievalBoundaryError';
    this.code = code;
  }
}

export function loadRetrievalJsonFile(
  rootDirectory: string,
  relativePath: string,
  options: RetrievalJsonLoadOptions = {},
): unknown {
  const path = inspectRegularFile(
    rootDirectory,
    relativePath,
    options.maximumFileBytes ?? MAXIMUM_FILE_BYTES,
  );
  const text = readFileSync(path, 'utf8');
  validateJsonGrammar(text);
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new RetrievalBoundaryError(
      'retrieval.json.syntax',
      'Retrieval JSON must be valid UTF-8 JSON.',
    );
  }
}

export function hashRetrievalJsonFile(
  rootDirectory: string,
  relativePath: string,
): string {
  const path = inspectRegularFile(
    rootDirectory,
    relativePath,
    MAXIMUM_FILE_BYTES,
  );
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

export function listRetrievalJsonFiles(
  rootDirectory: string,
  options: RetrievalJsonListOptions = {},
): readonly RetrievalJsonFile[] {
  const canonicalRoot = canonicalRootPath(rootDirectory);
  const files: RetrievalJsonFile[] = [];
  const pending = [{ absolute: canonicalRoot, relative: '' }];
  while (pending.length > 0) {
    const current = pending.pop();
    if (current === undefined) break;
    let names: string[];
    try {
      names = readdirSync(current.absolute).sort(compareText);
    } catch {
      throw new RetrievalBoundaryError(
        'retrieval.json.unreadable',
        'Retrieval corpus directory could not be read.',
      );
    }
    for (const name of names) {
      const relative =
        current.relative.length === 0 ? name : `${current.relative}/${name}`;
      validateRelativePath(relative);
      const absolute = resolve(canonicalRoot, ...relative.split('/'));
      const status = safeLstat(absolute);
      if (status.isSymbolicLink()) {
        throw new RetrievalBoundaryError(
          'retrieval.json.symlink',
          'Retrieval corpus entries must not be symbolic links.',
        );
      }
      if (status.isDirectory()) {
        pending.push({ absolute, relative });
      } else if (status.isFile() && name.endsWith('.json')) {
        if (status.size > MAXIMUM_FILE_BYTES) {
          throw new RetrievalBoundaryError(
            'retrieval.json.file-size',
            'Retrieval JSON exceeds the individual file byte limit.',
          );
        }
        files.push({ path: relative, bytes: status.size });
      }
    }
  }
  files.sort((left, right) => compareText(left.path, right.path));
  const maximumFiles = options.maximumFiles ?? MAXIMUM_FILES;
  if (files.length > maximumFiles) {
    throw new RetrievalBoundaryError(
      'retrieval.json.file-count',
      'Retrieval corpus exceeds its JSON file-count limit.',
    );
  }
  const total = files.reduce((sum, file) => sum + file.bytes, 0);
  if (total > (options.maximumTotalBytes ?? MAXIMUM_CORPUS_BYTES)) {
    throw new RetrievalBoundaryError(
      'retrieval.json.corpus-size',
      'Retrieval corpus exceeds its aggregate byte limit.',
    );
  }
  return files;
}

function inspectRegularFile(
  rootDirectory: string,
  relativePath: string,
  maximumFileBytes: number,
): string {
  validateRelativePath(relativePath);
  const root = canonicalRootPath(rootDirectory);
  const absolute = resolve(root, ...relativePath.split('/'));
  if (!isInside(root, absolute)) {
    throw new RetrievalBoundaryError(
      'retrieval.json.path',
      'Retrieval JSON path escapes its fixed root.',
    );
  }
  const status = safeLstat(absolute);
  if (status.isSymbolicLink()) {
    throw new RetrievalBoundaryError(
      'retrieval.json.symlink',
      'Retrieval JSON must not be a symbolic link.',
    );
  }
  if (!status.isFile()) {
    throw new RetrievalBoundaryError(
      'retrieval.json.file-type',
      'Retrieval JSON path must be a regular file.',
    );
  }
  if (status.size > maximumFileBytes) {
    throw new RetrievalBoundaryError(
      'retrieval.json.file-size',
      'Retrieval JSON exceeds the individual file byte limit.',
    );
  }
  let canonical: string;
  try {
    canonical = realpathSync(absolute);
  } catch {
    throw new RetrievalBoundaryError(
      'retrieval.json.unreadable',
      'Retrieval JSON could not be resolved.',
    );
  }
  if (!isInside(root, canonical)) {
    throw new RetrievalBoundaryError(
      'retrieval.json.path',
      'Retrieval JSON resolves outside its fixed root.',
    );
  }
  return canonical;
}

function validateJsonGrammar(text: string): void {
  let index = 0;
  let nodes = 0;
  const visitNode = (depth: number): void => {
    nodes += 1;
    if (nodes > MAXIMUM_NODES || depth > MAXIMUM_DEPTH) {
      throw new RetrievalBoundaryError(
        'retrieval.json.structure',
        'Retrieval JSON exceeds its depth or node-count limit.',
      );
    }
    skipWhitespace();
    const character = text[index];
    if (character === '{') {
      index += 1;
      skipWhitespace();
      const keys = new Set<string>();
      if (text[index] === '}') {
        index += 1;
        return;
      }
      for (;;) {
        const key = readString();
        if (keys.has(key)) {
          throw new RetrievalBoundaryError(
            'retrieval.json.duplicate-key',
            'Retrieval JSON object keys must be unique.',
          );
        }
        keys.add(key);
        skipWhitespace();
        requireCharacter(':');
        visitNode(depth + 1);
        skipWhitespace();
        if (text[index] === '}') {
          index += 1;
          return;
        }
        requireCharacter(',');
        skipWhitespace();
      }
    }
    if (character === '[') {
      index += 1;
      skipWhitespace();
      if (text[index] === ']') {
        index += 1;
        return;
      }
      for (;;) {
        visitNode(depth + 1);
        skipWhitespace();
        if (text[index] === ']') {
          index += 1;
          return;
        }
        requireCharacter(',');
      }
    }
    if (character === '"') {
      readString();
      return;
    }
    const remainder = text.slice(index);
    const token =
      /^(?:true|false|null|-?(?:0|[1-9][0-9]*)(?:[.][0-9]+)?(?:[eE][+-]?[0-9]+)?)/u.exec(
        remainder,
      )?.[0];
    if (token === undefined) syntaxError();
    index += token.length;
  };
  const readString = (): string => {
    skipWhitespace();
    if (text[index] !== '"') syntaxError();
    const start = index;
    index += 1;
    while (index < text.length) {
      const character = text[index];
      if (character === '"') {
        index += 1;
        try {
          return JSON.parse(text.slice(start, index)) as string;
        } catch {
          syntaxError();
        }
      }
      if (character === '\\') {
        index += 1;
        if (text[index] === 'u') index += 4;
      }
      index += 1;
    }
    syntaxError();
  };
  const skipWhitespace = (): void => {
    while (/\s/u.test(text[index] ?? '')) index += 1;
  };
  const requireCharacter = (expected: string): void => {
    skipWhitespace();
    if (text[index] !== expected) syntaxError();
    index += 1;
  };
  function syntaxError(): never {
    throw new RetrievalBoundaryError(
      'retrieval.json.syntax',
      'Retrieval JSON must contain valid JSON.',
    );
  }
  visitNode(0);
  skipWhitespace();
  if (index !== text.length) syntaxError();
}

function validateRelativePath(path: string): void {
  if (
    path.length === 0 ||
    Buffer.byteLength(path, 'utf8') > MAXIMUM_PATH_BYTES ||
    isAbsolute(path) ||
    posix.isAbsolute(path) ||
    posix.normalize(path) !== path ||
    path.split('/').some((part) => part.length === 0) ||
    Array.from(path).some((character) => {
      const point = character.codePointAt(0) ?? 0;
      return point <= 31 || point === 127;
    })
  ) {
    throw new RetrievalBoundaryError(
      'retrieval.json.path',
      'Retrieval JSON path is unsafe or noncanonical.',
    );
  }
}

function canonicalRootPath(root: string): string {
  try {
    return realpathSync(root);
  } catch {
    throw new RetrievalBoundaryError(
      'retrieval.json.root',
      'Retrieval JSON root could not be resolved.',
    );
  }
}

function safeLstat(path: string): Stats {
  try {
    return lstatSync(path);
  } catch {
    throw new RetrievalBoundaryError(
      'retrieval.json.unreadable',
      'Retrieval corpus entry could not be inspected.',
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

function sanitize(value: string): string {
  return value.slice(0, MAXIMUM_DIAGNOSTIC_CHARACTERS);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
