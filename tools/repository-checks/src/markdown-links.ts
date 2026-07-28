import { posix as path } from 'node:path';

import GithubSlugger from 'github-slugger';
import { fromMarkdown } from 'mdast-util-from-markdown';

import { diagnostic, type Diagnostic } from './types.ts';

const MAX_MARKDOWN_BYTES = 512 * 1024;
const MAX_MARKDOWN_DEPTH = 64;
const MAX_MARKDOWN_FILES = 2_000;
const MAX_MARKDOWN_NODES = 20_000;
const MAX_DIAGNOSTICS = 200;
const EXTERNAL_LINK_PATTERN = /^[a-z][a-z0-9+.-]*:/i;

export interface MarkdownRepository {
  readonly markdownFiles: ReadonlyMap<string, string>;
  readonly trackedPaths: ReadonlySet<string>;
}

interface MarkdownInspection {
  readonly headingSlugs: ReadonlySet<string>;
  readonly links: readonly string[];
}

export function validateMarkdownLinks(
  repository: MarkdownRepository,
): Diagnostic[] {
  if (repository.markdownFiles.size > MAX_MARKDOWN_FILES) {
    return [
      diagnostic(
        'markdown.file-count',
        `Repository exceeds the ${String(MAX_MARKDOWN_FILES)}-file Markdown limit.`,
      ),
    ];
  }

  const diagnostics: Diagnostic[] = [];
  const inspections = new Map<string, MarkdownInspection>();
  const markdownPaths = [...repository.markdownFiles.keys()].sort(compareText);

  for (const markdownPath of markdownPaths) {
    const content = repository.markdownFiles.get(markdownPath);
    if (content === undefined) {
      continue;
    }
    if (Buffer.byteLength(content, 'utf8') > MAX_MARKDOWN_BYTES) {
      diagnostics.push(
        diagnostic(
          'markdown.file-size',
          `Markdown file exceeds the ${String(MAX_MARKDOWN_BYTES)}-byte parsing limit.`,
          markdownPath,
        ),
      );
      continue;
    }

    const inspection = inspectMarkdown(content);
    if (inspection === undefined) {
      diagnostics.push(
        diagnostic(
          'markdown.structure-limit',
          'Markdown exceeds the allowed node count or nesting depth.',
          markdownPath,
        ),
      );
      continue;
    }
    inspections.set(markdownPath, inspection);
  }

  const trackedDirectories = collectTrackedDirectories(repository.trackedPaths);
  for (const markdownPath of markdownPaths) {
    const inspection = inspections.get(markdownPath);
    if (inspection === undefined) {
      continue;
    }
    for (const link of inspection.links) {
      const linkDiagnostic = validateLocalLink(
        markdownPath,
        link,
        repository.trackedPaths,
        trackedDirectories,
        inspections,
      );
      if (linkDiagnostic !== undefined) {
        diagnostics.push(linkDiagnostic);
      }
      if (diagnostics.length >= MAX_DIAGNOSTICS) {
        return diagnostics;
      }
    }
  }

  return diagnostics;
}

function inspectMarkdown(content: string): MarkdownInspection | undefined {
  const root = fromMarkdown(content) as unknown;
  const slugger = new GithubSlugger();
  const headingSlugs = new Set<string>();
  const links: string[] = [];
  let nodeCount = 0;
  const traversalState = { exceeded: false };

  function visit(node: unknown, depth: number): void {
    if (traversalState.exceeded) {
      return;
    }
    nodeCount += 1;
    if (nodeCount > MAX_MARKDOWN_NODES || depth > MAX_MARKDOWN_DEPTH) {
      traversalState.exceeded = true;
      return;
    }
    if (!isRecord(node)) {
      return;
    }

    if (node['type'] === 'heading') {
      headingSlugs.add(slugger.slug(plainText(node)));
    }
    if (
      (node['type'] === 'link' ||
        node['type'] === 'image' ||
        node['type'] === 'definition') &&
      typeof node['url'] === 'string'
    ) {
      links.push(node['url']);
    }

    if (Array.isArray(node['children'])) {
      for (const child of node['children']) {
        visit(child, depth + 1);
      }
    }
  }

  visit(root, 0);
  return traversalState.exceeded ? undefined : { headingSlugs, links };
}

function validateLocalLink(
  sourcePath: string,
  link: string,
  trackedPaths: ReadonlySet<string>,
  trackedDirectories: ReadonlySet<string>,
  inspections: ReadonlyMap<string, MarkdownInspection>,
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

function plainText(node: Readonly<Record<string, unknown>>): string {
  if (
    (node['type'] === 'text' || node['type'] === 'inlineCode') &&
    typeof node['value'] === 'string'
  ) {
    return node['value'];
  }
  if (!Array.isArray(node['children'])) {
    return '';
  }
  return node['children']
    .map((child) => (isRecord(child) ? plainText(child) : ''))
    .join('');
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

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
