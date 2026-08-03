export type RepositoryInterviewMappingIssueCode =
  | 'artifact-context-invalid'
  | 'artifact-set-closure'
  | 'prompt-too-large'
  | 'unknown-artifact-alias'
  | 'citation-out-of-range'
  | 'provider-output-invalid'
  | 'mapping-closure';

export type RepositoryInterviewMappingIssueMessage =
  | 'Repository interview artifact contract input is invalid.'
  | 'Repository interview artifact set does not close over supplied artifacts.'
  | 'Repository interview prompt exceeds an approved bound.'
  | 'Provider output citation refers to an unavailable artifact alias.'
  | 'Provider output citation falls outside the rendered artifact.'
  | 'Provider output does not satisfy the repository interview schema.'
  | 'Repository interview semantic mapping does not close.';

export interface RepositoryInterviewMappingIssue {
  readonly code: RepositoryInterviewMappingIssueCode;
  readonly path: string;
  readonly message: RepositoryInterviewMappingIssueMessage;
}

const MAXIMUM_ISSUES = 20;
const MAXIMUM_PATH_LENGTH = 256;

const MESSAGES: Readonly<
  Record<
    RepositoryInterviewMappingIssueCode,
    RepositoryInterviewMappingIssueMessage
  >
> = Object.freeze({
  'artifact-context-invalid':
    'Repository interview artifact contract input is invalid.',
  'artifact-set-closure':
    'Repository interview artifact set does not close over supplied artifacts.',
  'prompt-too-large': 'Repository interview prompt exceeds an approved bound.',
  'unknown-artifact-alias':
    'Provider output citation refers to an unavailable artifact alias.',
  'citation-out-of-range':
    'Provider output citation falls outside the rendered artifact.',
  'provider-output-invalid':
    'Provider output does not satisfy the repository interview schema.',
  'mapping-closure': 'Repository interview semantic mapping does not close.',
});

export function repositoryInterviewMappingIssue(
  code: RepositoryInterviewMappingIssueCode,
  path: string,
): RepositoryInterviewMappingIssue {
  return {
    code,
    path: path.slice(0, MAXIMUM_PATH_LENGTH),
    message: MESSAGES[code],
  };
}

export function finalizeRepositoryInterviewMappingIssues(
  issues: readonly RepositoryInterviewMappingIssue[],
): readonly RepositoryInterviewMappingIssue[] {
  const unique = new Map<string, RepositoryInterviewMappingIssue>();
  for (const issue of issues) {
    const key = `${issue.path}\0${issue.code}`;
    if (!unique.has(key)) {
      unique.set(key, issue);
    }
  }
  return [...unique.values()]
    .sort((left, right) =>
      compareText(`${left.path}\0${left.code}`, `${right.path}\0${right.code}`),
    )
    .slice(0, MAXIMUM_ISSUES);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
