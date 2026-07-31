export type RepositoryInterviewApplicationIssueCode =
  | 'application-input-invalid'
  | 'prompt-render-failed'
  | 'model-profile-invalid'
  | 'reuse-record-invalid'
  | 'provider-port-failure'
  | 'publication-time-invalid'
  | 'record-port-failure'
  | 'record-port-conflict'
  | 'application-closure';

export type RepositoryInterviewApplicationIssueMessage =
  | 'Repository interview application input is invalid.'
  | 'Repository interview prompt rendering failed.'
  | 'Repository interview model profile is invalid.'
  | 'Repository interview reuse record is invalid.'
  | 'Repository interview provider operation failed.'
  | 'Repository interview publication time is invalid.'
  | 'Repository interview record operation failed.'
  | 'Repository interview record publication conflicted.'
  | 'Repository interview application closure failed.';

export interface RepositoryInterviewApplicationIssue {
  readonly code: RepositoryInterviewApplicationIssueCode;
  readonly path: string;
  readonly message: RepositoryInterviewApplicationIssueMessage;
}

const MAXIMUM_ISSUES = 20;
const MAXIMUM_PATH_LENGTH = 256;

const MESSAGES: Readonly<
  Record<
    RepositoryInterviewApplicationIssueCode,
    RepositoryInterviewApplicationIssueMessage
  >
> = Object.freeze({
  'application-input-invalid':
    'Repository interview application input is invalid.',
  'prompt-render-failed': 'Repository interview prompt rendering failed.',
  'model-profile-invalid': 'Repository interview model profile is invalid.',
  'reuse-record-invalid': 'Repository interview reuse record is invalid.',
  'provider-port-failure': 'Repository interview provider operation failed.',
  'publication-time-invalid':
    'Repository interview publication time is invalid.',
  'record-port-failure': 'Repository interview record operation failed.',
  'record-port-conflict': 'Repository interview record publication conflicted.',
  'application-closure': 'Repository interview application closure failed.',
});

export function repositoryInterviewApplicationIssue(
  code: RepositoryInterviewApplicationIssueCode,
  path: string,
): RepositoryInterviewApplicationIssue {
  return {
    code,
    path: path.slice(0, MAXIMUM_PATH_LENGTH),
    message: MESSAGES[code],
  };
}

export function finalizeRepositoryInterviewApplicationIssues(
  issues: readonly RepositoryInterviewApplicationIssue[],
): readonly RepositoryInterviewApplicationIssue[] {
  const unique = new Map<string, RepositoryInterviewApplicationIssue>();
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
