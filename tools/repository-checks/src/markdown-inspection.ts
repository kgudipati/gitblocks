import GithubSlugger from 'github-slugger';
import { fromMarkdown } from 'mdast-util-from-markdown';

import { diagnostic, type Diagnostic } from './types.ts';

export const MARKDOWN_LIMITS = {
  bytes: 512 * 1024,
  depth: 64,
  diagnostics: 200,
  files: 2_000,
  nodes: 20_000,
} as const;

export interface MarkdownFileInspection {
  readonly hasProductCapitalizationViolation: boolean;
  readonly headingSlugs: ReadonlySet<string>;
  readonly links: readonly string[];
}

export interface MarkdownRepositoryInspection {
  readonly diagnostics: readonly Diagnostic[];
  readonly files: ReadonlyMap<string, MarkdownFileInspection>;
}

interface EnterFrame {
  readonly depth: number;
  readonly headingText: string[] | undefined;
  readonly insideLink: boolean;
  readonly kind: 'enter';
  readonly node: unknown;
}

interface FinishHeadingFrame {
  readonly headingText: readonly string[];
  readonly kind: 'finish-heading';
}

type TraversalFrame = EnterFrame | FinishHeadingFrame;

export function inspectMarkdownFiles(
  markdownFiles: ReadonlyMap<string, string>,
): MarkdownRepositoryInspection {
  if (markdownFiles.size > MARKDOWN_LIMITS.files) {
    return {
      diagnostics: [
        diagnostic(
          'markdown.file-count',
          `Repository exceeds the ${String(MARKDOWN_LIMITS.files)}-file Markdown limit.`,
        ),
      ],
      files: new Map(),
    };
  }

  const diagnostics: Diagnostic[] = [];
  const files = new Map<string, MarkdownFileInspection>();
  for (const markdownPath of [...markdownFiles.keys()].sort(compareText)) {
    if (diagnostics.length >= MARKDOWN_LIMITS.diagnostics) {
      break;
    }
    const content = markdownFiles.get(markdownPath);
    if (content === undefined) {
      continue;
    }
    if (Buffer.byteLength(content, 'utf8') > MARKDOWN_LIMITS.bytes) {
      diagnostics.push(
        diagnostic(
          'markdown.file-size',
          `Markdown file exceeds the ${String(MARKDOWN_LIMITS.bytes)}-byte parsing limit.`,
          markdownPath,
        ),
      );
      continue;
    }

    let root: unknown;
    try {
      root = fromMarkdown(markdownInspectionContent(markdownPath, content));
    } catch {
      diagnostics.push(
        diagnostic(
          'markdown.parse',
          'Markdown could not be parsed safely as inert CommonMark data.',
          markdownPath,
        ),
      );
      continue;
    }

    const inspection = inspectMarkdownTree(root);
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
    files.set(markdownPath, inspection);
  }

  return { diagnostics, files };
}

function markdownInspectionContent(
  markdownPath: string,
  content: string,
): string {
  if (markdownPath !== 'SKILL.md' && !markdownPath.endsWith('/SKILL.md')) {
    return content;
  }
  return content.replace(
    /^---\r?\nname:[^\r\n]*\r?\n/u,
    '---\nname: skill-slug\n',
  );
}

function inspectMarkdownTree(
  root: unknown,
): MarkdownFileInspection | undefined {
  const slugger = new GithubSlugger();
  const headingSlugs = new Set<string>();
  const links: string[] = [];
  const pending: TraversalFrame[] = [
    {
      depth: 0,
      headingText: undefined,
      insideLink: false,
      kind: 'enter',
      node: root,
    },
  ];
  let hasProductCapitalizationViolation = false;
  let nodeCount = 0;

  while (pending.length > 0) {
    const frame = pending.pop();
    if (frame === undefined) {
      break;
    }
    if (frame.kind === 'finish-heading') {
      headingSlugs.add(slugger.slug(frame.headingText.join('')));
      continue;
    }

    nodeCount += 1;
    if (
      nodeCount > MARKDOWN_LIMITS.nodes ||
      frame.depth > MARKDOWN_LIMITS.depth
    ) {
      return undefined;
    }
    if (!isRecord(frame.node)) {
      continue;
    }

    const nodeType = frame.node['type'];
    const insideLink =
      frame.insideLink ||
      nodeType === 'link' ||
      nodeType === 'linkReference' ||
      nodeType === 'definition';
    if (
      (nodeType === 'link' ||
        nodeType === 'image' ||
        nodeType === 'definition') &&
      typeof frame.node['url'] === 'string'
    ) {
      links.push(frame.node['url']);
    }
    if (
      (nodeType === 'text' || nodeType === 'inlineCode') &&
      typeof frame.node['value'] === 'string'
    ) {
      frame.headingText?.push(frame.node['value']);
      if (
        nodeType === 'text' &&
        !insideLink &&
        hasIncorrectProductCapitalization(frame.node['value'])
      ) {
        hasProductCapitalizationViolation = true;
      }
    }

    const children = Array.isArray(frame.node['children'])
      ? frame.node['children']
      : [];
    const headingText: string[] | undefined =
      nodeType === 'heading' ? [] : frame.headingText;
    if (nodeType === 'heading') {
      if (headingText === undefined) {
        return undefined;
      }
      pending.push({ headingText, kind: 'finish-heading' });
    }
    for (let index = children.length - 1; index >= 0; index -= 1) {
      pending.push({
        depth: frame.depth + 1,
        headingText,
        insideLink,
        kind: 'enter',
        node: children[index],
      });
    }
  }

  return {
    hasProductCapitalizationViolation,
    headingSlugs,
    links,
  };
}

function hasIncorrectProductCapitalization(value: string): boolean {
  const matches = value.match(/\bgitblocks\b/gi) ?? [];
  return matches.some((match) => match !== 'GitBlocks');
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
