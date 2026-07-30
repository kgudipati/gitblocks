export type ProviderOutputIssueCode =
  | 'provider-output.bounds'
  | 'provider-output.citation-count'
  | 'provider-output.citation-range'
  | 'provider-output.duplicate-citation'
  | 'provider-output.duplicate-item'
  | 'provider-output.inference-rationale'
  | 'provider-output.input-shape'
  | 'provider-output.limitation-basis'
  | 'provider-output.string-policy'
  | 'provider-output.structure'
  | 'provider-output.topic-coverage'
  | 'provider-output.contradiction-sides'
  | 'provider-output.unknown-scope';

export interface ProviderOutputIssue {
  readonly code: ProviderOutputIssueCode;
  readonly path: string;
  readonly message: ProviderOutputIssueMessage;
}

export type ProviderOutputIssueMessage =
  | 'Provider output citation count is outside the allowed bound.'
  | 'Provider output citation interval is invalid.'
  | 'Provider output contains a duplicate citation.'
  | 'Provider output contains a duplicate semantic item.'
  | 'Provider output contradiction sides must be distinct.'
  | 'Provider output inference rationale must add an inferential bridge.'
  | 'Provider output input has an unsupported object shape.'
  | 'Provider output limitation basis is inconsistent.'
  | 'Provider output semantic text violates the safe text policy.'
  | 'Provider output topic coverage is incomplete.'
  | 'Provider output unknown is not scoped to the supplied artifact set.'
  | 'Provider output value is outside the allowed bounds.'
  | 'Provider output value does not match the required closed structure.';

const MAX_ISSUES = 20;
const MAX_PATH_LENGTH = 256;

export function providerOutputIssue(
  code: ProviderOutputIssueCode,
  path: string,
  message: ProviderOutputIssueMessage,
): ProviderOutputIssue {
  return {
    code,
    path: path.slice(0, MAX_PATH_LENGTH),
    message,
  };
}

export function finalizeProviderOutputIssues(
  issues: readonly ProviderOutputIssue[],
): readonly ProviderOutputIssue[] {
  const unique = new Map<string, ProviderOutputIssue>();
  for (const issue of issues) {
    const key = `${issue.path}\0${issue.code}\0${issue.message}`;
    if (!unique.has(key)) {
      unique.set(key, issue);
    }
  }
  return [...unique.values()]
    .sort((left, right) =>
      compareText(`${left.path}\0${left.code}`, `${right.path}\0${right.code}`),
    )
    .slice(0, MAX_ISSUES);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
