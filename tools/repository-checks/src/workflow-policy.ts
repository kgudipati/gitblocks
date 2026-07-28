import { parseDocument, visit } from 'yaml';

import { diagnostic, type Diagnostic } from './types.ts';

const MAX_WORKFLOW_BYTES = 256 * 1024;
const MAX_WORKFLOW_DEPTH = 64;
const MAX_WORKFLOW_NODES = 10_000;
const FULL_COMMIT_PATTERN = /^[^@\s]+@[0-9a-f]{40}$/;
const VERSION_COMMENT_PATTERN = /\bv?[0-9]+\.[0-9]+(?:\.[0-9]+)?\b/i;

export interface WorkflowFile {
  readonly content: string;
  readonly path: string;
}

interface UsesEntry {
  readonly container: Readonly<Record<string, unknown>>;
  readonly value: string;
}

export function validateWorkflowFile(file: WorkflowFile): Diagnostic[] {
  if (Buffer.byteLength(file.content, 'utf8') > MAX_WORKFLOW_BYTES) {
    return [
      diagnostic(
        'workflow.file-size',
        `Workflow exceeds the ${String(MAX_WORKFLOW_BYTES)}-byte parsing limit.`,
        file.path,
      ),
    ];
  }

  const document = parseDocument(file.content, {
    prettyErrors: false,
    uniqueKeys: true,
    version: '1.2',
  });
  if (document.errors.length > 0) {
    return [
      diagnostic(
        'workflow.yaml',
        'Workflow must be valid YAML with unique mapping keys.',
        file.path,
      ),
    ];
  }

  const traversalState = {
    aliasFound: false,
    nodeCount: 0,
    structureExceeded: false,
  };
  visit(document, {
    Alias() {
      traversalState.aliasFound = true;
    },
    Node(_key, _node, path) {
      traversalState.nodeCount += 1;
      if (
        traversalState.nodeCount > MAX_WORKFLOW_NODES ||
        path.length > MAX_WORKFLOW_DEPTH
      ) {
        traversalState.structureExceeded = true;
        return visit.BREAK;
      }
      return undefined;
    },
  });

  if (traversalState.aliasFound) {
    return [
      diagnostic(
        'workflow.yaml-alias',
        'Workflow YAML aliases are prohibited to keep parsing bounded and explicit.',
        file.path,
      ),
    ];
  }
  if (traversalState.structureExceeded) {
    return [
      diagnostic(
        'workflow.structure-limit',
        'Workflow exceeds the allowed YAML node count or nesting depth.',
        file.path,
      ),
    ];
  }

  const root = document.toJS({ maxAliasCount: 0 }) as unknown;
  if (!isRecord(root)) {
    return [
      diagnostic(
        'workflow.root',
        'Workflow root must be a YAML mapping.',
        file.path,
      ),
    ];
  }

  const diagnostics: Diagnostic[] = [];
  if (hasPullRequestTarget(root['on'])) {
    diagnostics.push(
      diagnostic(
        'workflow.pull-request-target',
        'pull_request_target is prohibited without a future security ADR.',
        file.path,
      ),
    );
  }

  diagnostics.push(...validateWorkflowPermissions(root, file.path));

  const usesEntries: UsesEntry[] = [];
  collectUsesEntries(root, usesEntries);
  const usesOccurrences = new Map<string, number>();
  for (const entry of usesEntries) {
    const occurrence = usesOccurrences.get(entry.value) ?? 0;
    usesOccurrences.set(entry.value, occurrence + 1);
    diagnostics.push(...validateUsesEntry(entry, file, occurrence));
  }

  return diagnostics;
}

function validateWorkflowPermissions(
  root: Readonly<Record<string, unknown>>,
  path: string,
): Diagnostic[] {
  if (root['permissions'] !== undefined) {
    return validatePermissionValue(root['permissions'], path);
  }

  const jobs = root['jobs'];
  if (!isRecord(jobs)) {
    return [
      diagnostic(
        'workflow.permissions-missing',
        'Workflow must declare explicit least-privilege permissions.',
        path,
      ),
    ];
  }

  const jobValues = Object.values(jobs).filter(isRecord);
  if (
    jobValues.length === 0 ||
    jobValues.some((job) => job['permissions'] === undefined)
  ) {
    return [
      diagnostic(
        'workflow.permissions-missing',
        'Workflow or every job must declare explicit least-privilege permissions.',
        path,
      ),
    ];
  }

  return jobValues.flatMap((job) =>
    validatePermissionValue(job['permissions'], path),
  );
}

function validatePermissionValue(value: unknown, path: string): Diagnostic[] {
  if (value === 'write-all') {
    return [
      diagnostic(
        'workflow.permissions-writable',
        'Workflow permissions must not grant write access.',
        path,
      ),
    ];
  }
  if (value === 'read-all') {
    return [
      diagnostic(
        'workflow.permissions-excessive',
        'read-all is broader than an explicit least-privilege permission map.',
        path,
      ),
    ];
  }
  if (!isRecord(value)) {
    return [
      diagnostic(
        'workflow.permissions-invalid',
        'Workflow permissions must be an explicit mapping.',
        path,
      ),
    ];
  }

  return Object.entries(value)
    .filter(([, access]) => access === 'write')
    .map(([permission]) =>
      diagnostic(
        'workflow.permissions-writable',
        `Workflow permission ${permission} must not grant write access.`,
        path,
      ),
    );
}

function validateUsesEntry(
  entry: UsesEntry,
  file: WorkflowFile,
  occurrence: number,
): Diagnostic[] {
  if (entry.value.startsWith('./')) {
    return [];
  }

  const diagnostics: Diagnostic[] = [];
  if (!FULL_COMMIT_PATTERN.test(entry.value)) {
    diagnostics.push(
      diagnostic(
        'workflow.action-pin',
        `External action ${entry.value} must use a full 40-character commit SHA.`,
        file.path,
      ),
    );
  }

  const comment = findUsesComment(file.content, entry.value, occurrence);
  if (comment === undefined || !VERSION_COMMENT_PATTERN.test(comment)) {
    diagnostics.push(
      diagnostic(
        'workflow.action-comment',
        `External action ${entry.value} must have a same-line human-readable release comment.`,
        file.path,
      ),
    );
  }

  if (entry.value.startsWith('actions/checkout@')) {
    const withValue = entry.container['with'];
    const persistCredentials = isRecord(withValue)
      ? withValue['persist-credentials']
      : undefined;
    if (persistCredentials !== false && persistCredentials !== 'false') {
      diagnostics.push(
        diagnostic(
          'workflow.checkout-credentials',
          'actions/checkout must set persist-credentials: false.',
          file.path,
        ),
      );
    }
  }

  return diagnostics;
}

function collectUsesEntries(value: unknown, entries: UsesEntry[]): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectUsesEntries(item, entries);
    }
    return;
  }
  if (!isRecord(value)) {
    return;
  }

  if (typeof value['uses'] === 'string') {
    entries.push({ container: value, value: value['uses'] });
  }
  for (const child of Object.values(value)) {
    collectUsesEntries(child, entries);
  }
}

function findUsesComment(
  content: string,
  usesValue: string,
  occurrence: number,
): string | undefined {
  let matchedOccurrence = 0;
  for (const line of content.split(/\r?\n/)) {
    const usesIndex = line.indexOf('uses:');
    const firstCommentIndex = line.indexOf('#');
    if (
      usesIndex === -1 ||
      (firstCommentIndex !== -1 && firstCommentIndex < usesIndex)
    ) {
      continue;
    }
    const commentIndex = line.indexOf('#', usesIndex + 5);
    const valueSection =
      commentIndex === -1
        ? line.slice(usesIndex + 5)
        : line.slice(usesIndex + 5, commentIndex);
    if (!valueSection.includes(usesValue)) {
      continue;
    }
    if (matchedOccurrence < occurrence) {
      matchedOccurrence += 1;
      continue;
    }
    return commentIndex === -1
      ? undefined
      : line.slice(commentIndex + 1).trim();
  }
  return undefined;
}

function hasPullRequestTarget(trigger: unknown): boolean {
  if (trigger === 'pull_request_target') {
    return true;
  }
  if (Array.isArray(trigger)) {
    return trigger.some((value) => value === 'pull_request_target');
  }
  return isRecord(trigger) && 'pull_request_target' in trigger;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
