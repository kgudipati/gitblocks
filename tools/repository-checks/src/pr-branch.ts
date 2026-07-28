import { validateBranchName } from './branch-name.ts';
import { diagnostic, type Diagnostic } from './types.ts';

const DEPENDABOT_ACTOR = 'dependabot[bot]';
const MAX_DEPENDABOT_BRANCH_LENGTH = 120;
const MAX_DEPENDABOT_TAIL_SEGMENTS = 8;
const MAX_DEPENDABOT_SEGMENT_LENGTH = 64;
const DEPENDABOT_PREFIX_PATTERN =
  /^dependabot\/(npm_and_yarn|github_actions)\/(.+)$/;
const DEPENDABOT_SEGMENT_PATTERN =
  /^(?:@[a-z0-9](?:[a-z0-9._+-]*[a-z0-9])?|[a-z0-9](?:[a-z0-9._+-]*[a-z0-9])?)$/;

export function validatePullRequestBranch(
  actor: string,
  branchName: string,
): Diagnostic[] {
  if (actor !== DEPENDABOT_ACTOR) {
    return validateBranchName(branchName);
  }

  return isValidDependabotBranch(branchName)
    ? []
    : [
        diagnostic(
          'pr-branch.dependabot-format',
          'Dependabot branches must use a bounded dependabot/<configured-ecosystem>/<update> format.',
        ),
      ];
}

function isValidDependabotBranch(branchName: string): boolean {
  if (branchName.length > MAX_DEPENDABOT_BRANCH_LENGTH) {
    return false;
  }

  const match = DEPENDABOT_PREFIX_PATTERN.exec(branchName);
  const tail = match?.[2];
  if (tail === undefined) {
    return false;
  }

  const segments = tail.split('/');
  return (
    segments.length > 0 &&
    segments.length <= MAX_DEPENDABOT_TAIL_SEGMENTS &&
    segments.every(
      (segment) =>
        segment.length > 0 &&
        segment.length <= MAX_DEPENDABOT_SEGMENT_LENGTH &&
        segment !== '.' &&
        segment !== '..' &&
        !segment.includes('..') &&
        !segment.endsWith('.') &&
        !segment.endsWith('.lock') &&
        DEPENDABOT_SEGMENT_PATTERN.test(segment),
    )
  );
}
