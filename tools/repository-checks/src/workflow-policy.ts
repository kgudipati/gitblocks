import { parseBoundedYaml, YAML_LIMITS } from './bounded-yaml.ts';
import { diagnostic, type Diagnostic } from './types.ts';

const FULL_COMMIT_PATTERN = /^[^@\s]+@[0-9a-f]{40}$/;
const MAX_WORKFLOW_DIAGNOSTICS = 200;
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
  const parsed = parseBoundedYaml(file.content);
  if (!parsed.ok) {
    return [workflowYamlDiagnostic(parsed.failure, file.path)];
  }

  const root = parsed.value;
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
  if (diagnostics.length >= MAX_WORKFLOW_DIAGNOSTICS) {
    return diagnostics.slice(0, MAX_WORKFLOW_DIAGNOSTICS);
  }

  const usesEntries = collectUsesEntries(root);
  if (usesEntries === undefined) {
    diagnostics.push(
      diagnostic(
        'workflow.structure-limit',
        'Workflow exceeds the allowed YAML node count or nesting depth.',
        file.path,
      ),
    );
    return diagnostics;
  }
  const usesOccurrences = new Map<string, number>();
  for (const entry of usesEntries) {
    const occurrence = usesOccurrences.get(entry.value) ?? 0;
    usesOccurrences.set(entry.value, occurrence + 1);
    diagnostics.push(...validateUsesEntry(entry, file, occurrence));
    if (diagnostics.length >= MAX_WORKFLOW_DIAGNOSTICS) {
      return diagnostics.slice(0, MAX_WORKFLOW_DIAGNOSTICS);
    }
  }

  return diagnostics;
}

function validateWorkflowPermissions(
  root: Readonly<Record<string, unknown>>,
  path: string,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const hasWorkflowPermissions = root['permissions'] !== undefined;
  if (hasWorkflowPermissions) {
    diagnostics.push(...validatePermissionValue(root['permissions'], path));
  }
  const jobs = root['jobs'];
  if (!isRecord(jobs)) {
    if (!hasWorkflowPermissions) {
      diagnostics.push(
        diagnostic(
          'workflow.permissions-missing',
          'Workflow must declare explicit least-privilege permissions.',
          path,
        ),
      );
    }
    return diagnostics;
  }

  const jobValues = Object.values(jobs);
  if (jobValues.length === 0 && !hasWorkflowPermissions) {
    diagnostics.push(
      diagnostic(
        'workflow.permissions-missing',
        'Workflow or every job must declare explicit least-privilege permissions.',
        path,
      ),
    );
  }

  for (const job of jobValues) {
    if (!isRecord(job) || job['permissions'] === undefined) {
      if (!hasWorkflowPermissions) {
        diagnostics.push(
          diagnostic(
            'workflow.permissions-missing',
            'Workflow or every job must declare explicit least-privilege permissions.',
            path,
          ),
        );
      }
      continue;
    }
    diagnostics.push(...validatePermissionValue(job['permissions'], path));
    if (diagnostics.length >= MAX_WORKFLOW_DIAGNOSTICS) {
      return diagnostics.slice(0, MAX_WORKFLOW_DIAGNOSTICS);
    }
  }

  return diagnostics;
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

  const diagnostics: Diagnostic[] = [];
  for (const [permission, access] of Object.entries(value)) {
    if (access === 'write') {
      diagnostics.push(
        diagnostic(
          'workflow.permissions-writable',
          `Workflow permission ${permission} must not grant write access.`,
          path,
        ),
      );
    } else if (access !== 'read' && access !== 'none') {
      diagnostics.push(
        diagnostic(
          'workflow.permissions-invalid',
          `Workflow permission ${permission} must use read or none access.`,
          path,
        ),
      );
    }
    if (diagnostics.length >= MAX_WORKFLOW_DIAGNOSTICS) {
      break;
    }
  }
  return diagnostics;
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

  if (entry.value.startsWith('actions/cache@')) {
    diagnostics.push(
      diagnostic(
        'workflow.dependency-cache',
        'Dependency caching is prohibited in Phase 1.',
        file.path,
      ),
    );
  }

  if (entry.value.startsWith('actions/setup-node@')) {
    const withValue = entry.container['with'];
    const packageManagerCache = isRecord(withValue)
      ? withValue['package-manager-cache']
      : undefined;
    const explicitCache = isRecord(withValue) ? withValue['cache'] : undefined;
    if (
      (packageManagerCache !== false && packageManagerCache !== 'false') ||
      (explicitCache !== undefined && explicitCache !== '')
    ) {
      diagnostics.push(
        diagnostic(
          'workflow.dependency-cache',
          'actions/setup-node must explicitly disable package-manager caching and omit its cache input.',
          file.path,
        ),
      );
    }
  }

  return diagnostics;
}

function collectUsesEntries(value: unknown): UsesEntry[] | undefined {
  const entries: UsesEntry[] = [];
  const pending: unknown[] = [value];
  let visitedValues = 0;

  while (pending.length > 0) {
    const current = pending.pop();
    visitedValues += 1;
    if (visitedValues > YAML_LIMITS.nodes) {
      return undefined;
    }
    if (Array.isArray(current)) {
      for (let index = current.length - 1; index >= 0; index -= 1) {
        pending.push(current[index]);
      }
      continue;
    }
    if (!isRecord(current)) {
      continue;
    }

    if (typeof current['uses'] === 'string') {
      entries.push({ container: current, value: current['uses'] });
    }
    const children = Object.values(current);
    for (let index = children.length - 1; index >= 0; index -= 1) {
      pending.push(children[index]);
    }
  }

  return entries;
}

function workflowYamlDiagnostic(
  failure: 'alias' | 'file-size' | 'structure' | 'syntax',
  path: string,
): Diagnostic {
  switch (failure) {
    case 'alias':
      return diagnostic(
        'workflow.yaml-alias',
        'Workflow YAML aliases are prohibited to keep parsing bounded and explicit.',
        path,
      );
    case 'file-size':
      return diagnostic(
        'workflow.file-size',
        `Workflow exceeds the ${String(YAML_LIMITS.bytes)}-byte parsing limit.`,
        path,
      );
    case 'structure':
      return diagnostic(
        'workflow.structure-limit',
        'Workflow exceeds the allowed YAML node count or nesting depth.',
        path,
      );
    case 'syntax':
      return diagnostic(
        'workflow.yaml',
        'Workflow must be valid YAML with unique mapping keys and supported tags.',
        path,
      );
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
