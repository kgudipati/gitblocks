import { posix as path } from 'node:path';

import {
  inspectMarkdownFiles,
  MARKDOWN_LIMITS,
  type MarkdownFileInspection,
  type MarkdownRepositoryInspection,
} from './markdown-inspection.ts';
import { diagnostic, type Diagnostic } from './types.ts';

const EXTERNAL_LINK_PATTERN = /^[a-z][a-z0-9+.-]*:/i;

export interface MarkdownRepository {
  readonly inspection?: MarkdownRepositoryInspection;
  readonly markdownFiles: ReadonlyMap<string, string>;
  readonly trackedPaths: ReadonlySet<string>;
}

export function validateMarkdownLinks(
  repository: MarkdownRepository,
): Diagnostic[] {
  const inspection =
    repository.inspection ?? inspectMarkdownFiles(repository.markdownFiles);
  const diagnostics: Diagnostic[] = [...inspection.diagnostics];
  if (diagnostics.length >= MARKDOWN_LIMITS.diagnostics) {
    return diagnostics.slice(0, MARKDOWN_LIMITS.diagnostics);
  }
  const markdownPaths = [...repository.markdownFiles.keys()].sort(compareText);

  const trackedDirectories = collectTrackedDirectories(repository.trackedPaths);
  for (const markdownPath of markdownPaths) {
    const fileInspection = inspection.files.get(markdownPath);
    if (fileInspection === undefined) {
      continue;
    }
    for (const link of fileInspection.links) {
      const linkDiagnostic = validateLocalLink(
        markdownPath,
        link,
        repository.trackedPaths,
        trackedDirectories,
        inspection.files,
      );
      if (linkDiagnostic !== undefined) {
        diagnostics.push(linkDiagnostic);
      }
      if (diagnostics.length >= MARKDOWN_LIMITS.diagnostics) {
        return diagnostics.slice(0, MARKDOWN_LIMITS.diagnostics);
      }
    }
  }

  return diagnostics;
}

function validateLocalLink(
  sourcePath: string,
  link: string,
  trackedPaths: ReadonlySet<string>,
  trackedDirectories: ReadonlySet<string>,
  inspections: ReadonlyMap<string, MarkdownFileInspection>,
): Diagnostic | undefined {
  if (EXTERNAL_LINK_PATTERN.test(link) || link.startsWith('//')) {
    return undefined;
  }

  const hashIndex = link.indexOf('#');
  const pathAndQuery = hashIndex === -1 ? link : link.slice(0, hashIndex);
  const encodedFragment =
    hashIndex === -1 ? undefined : link.slice(hashIndex + 1);
  const queryIndex = pathAndQuery.indexOf('?');
  const encodedPath =
    queryIndex === -1 ? pathAndQuery : pathAndQuery.slice(0, queryIndex);

  let decodedPath: string;
  let decodedFragment: string | undefined;
  try {
    decodedPath = decodeURIComponent(encodedPath);
    decodedFragment =
      encodedFragment === undefined
        ? undefined
        : decodeURIComponent(encodedFragment);
  } catch {
    return diagnostic(
      'markdown.invalid-encoding',
      `Local link ${displayLink(link)} contains invalid percent encoding.`,
      sourcePath,
    );
  }

  if (
    decodedPath.includes('\0') ||
    decodedPath.includes('\\') ||
    path.isAbsolute(decodedPath)
  ) {
    return diagnostic(
      'markdown.unsafe-path',
      `Local link ${displayLink(link)} is not a safe repository-relative path.`,
      sourcePath,
    );
  }

  const targetPath =
    decodedPath.length === 0
      ? sourcePath
      : path.normalize(path.join(path.dirname(sourcePath), decodedPath));
  if (
    targetPath === '..' ||
    targetPath.startsWith('../') ||
    targetPath.startsWith('/')
  ) {
    return diagnostic(
      'markdown.unsafe-path',
      `Local link ${displayLink(link)} escapes the repository root.`,
      sourcePath,
    );
  }

  const targetIsFile = trackedPaths.has(targetPath);
  const targetIsDirectory = trackedDirectories.has(
    targetPath.endsWith('/') ? targetPath.slice(0, -1) : targetPath,
  );
  if (!targetIsFile && !targetIsDirectory) {
    return diagnostic(
      'markdown.missing-target',
      `Local link ${displayLink(link)} does not resolve to a tracked file or directory.`,
      sourcePath,
    );
  }

  if (decodedFragment !== undefined && decodedFragment.length > 0) {
    const targetInspection = inspections.get(targetPath);
    if (!targetInspection?.headingSlugs.has(decodedFragment)) {
      return diagnostic(
        'markdown.missing-fragment',
        `Local link ${displayLink(link)} does not resolve to a Markdown heading.`,
        sourcePath,
      );
    }
  }

  return undefined;
}

function collectTrackedDirectories(
  trackedPaths: ReadonlySet<string>,
): ReadonlySet<string> {
  const directories = new Set<string>(['.']);
  for (const trackedPath of trackedPaths) {
    let directory = path.dirname(trackedPath);
    while (directory !== '.' && !directories.has(directory)) {
      directories.add(directory);
      directory = path.dirname(directory);
    }
  }
  return directories;
}

function displayLink(link: string): string {
  const withoutQuery = link.split('?', 1)[0] ?? '';
  const escaped = Array.from(withoutQuery)
    .map((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint < 32 || codePoint === 127
        ? `\\u${codePoint.toString(16).padStart(4, '0')}`
        : character;
    })
    .join('');
  const bounded = escaped.slice(0, 160);
  return JSON.stringify(
    escaped.length > bounded.length ? `${bounded}…` : bounded,
  );
}

function compareText(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  return left > right ? 1 : 0;
}
