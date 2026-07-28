import { ALLOWED_CHANGE_TYPES, MAX_BRANCH_NAME_LENGTH } from './policy.ts';
import { diagnostic, type Diagnostic } from './types.ts';

const BRANCH_PATTERN = /^([a-z]+)\/([1-9][0-9]*)-([a-z0-9]+(?:-[a-z0-9]+)*)$/;
const DATE_TOKEN_PATTERN =
  /(?:^|-)(?:19|20)[0-9]{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12][0-9]|3[01])(?:-|$)/;
const VAGUE_TOKENS = new Set(['changes', 'misc', 'updates', 'work']);

export function validateBranchName(branchName: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  if (branchName.length > MAX_BRANCH_NAME_LENGTH) {
    diagnostics.push(
      diagnostic(
        'branch.length',
        `Branch name must be at most ${String(MAX_BRANCH_NAME_LENGTH)} characters.`,
      ),
    );
  }

  const match = BRANCH_PATTERN.exec(branchName);
  if (match === null) {
    diagnostics.push(
      diagnostic(
        'branch.format',
        'Branch name must match <type>/<issue-number>-<short-kebab-description> using lowercase ASCII.',
      ),
    );
    return diagnostics;
  }

  const [, type, , description] = match;
  if (
    type === undefined ||
    !ALLOWED_CHANGE_TYPES.some((allowedType) => allowedType === type)
  ) {
    diagnostics.push(
      diagnostic(
        'branch.type',
        `Branch type must be one of: ${ALLOWED_CHANGE_TYPES.join(', ')}.`,
      ),
    );
  }

  if (description === undefined) {
    return diagnostics;
  }

  const descriptionTokens = description.split('-');
  if (descriptionTokens.some((token) => VAGUE_TOKENS.has(token))) {
    diagnostics.push(
      diagnostic(
        'branch.vague',
        'Branch description contains a vague term; describe the concrete outcome.',
      ),
    );
  }

  if (DATE_TOKEN_PATTERN.test(description)) {
    diagnostics.push(
      diagnostic(
        'branch.date',
        'Branch description must not contain a calendar date.',
      ),
    );
  }

  return diagnostics;
}
