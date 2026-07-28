import {
  ALLOWED_CHANGE_TYPES,
  MAX_PULL_REQUEST_TITLE_LENGTH,
} from './policy.ts';
import { diagnostic, type Diagnostic } from './types.ts';

const TITLE_PATTERN = /^([a-z]+)(?:\(([a-z0-9]+(?:-[a-z0-9]+)*)\))?(!)?: (.+)$/;
const VAGUE_WORDS = new Set([
  'change',
  'changes',
  'misc',
  'stuff',
  'update',
  'updates',
  'work',
  'wip',
]);

export function validatePullRequestTitle(title: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  if (title.length > MAX_PULL_REQUEST_TITLE_LENGTH) {
    diagnostics.push(
      diagnostic(
        'pr-title.length',
        `Pull request title must be at most ${String(MAX_PULL_REQUEST_TITLE_LENGTH)} characters.`,
      ),
    );
  }

  const match = TITLE_PATTERN.exec(title);
  if (match === null) {
    diagnostics.push(
      diagnostic(
        'pr-title.format',
        'Pull request title must match <type>[optional scope][!]: <imperative description>.',
      ),
    );
    return diagnostics;
  }

  const [, type, , , description] = match;
  if (
    type === undefined ||
    !ALLOWED_CHANGE_TYPES.some((allowedType) => allowedType === type)
  ) {
    diagnostics.push(
      diagnostic(
        'pr-title.type',
        `Pull request type must be one of: ${ALLOWED_CHANGE_TYPES.join(', ')}.`,
      ),
    );
  }

  if (description === undefined) {
    return diagnostics;
  }

  if (!/^[a-z0-9]/.test(description)) {
    diagnostics.push(
      diagnostic(
        'pr-title.description-case',
        'Pull request description must start with a lowercase letter or digit.',
      ),
    );
  }

  if (description.endsWith('.')) {
    diagnostics.push(
      diagnostic(
        'pr-title.trailing-period',
        'Pull request title must not end with a period.',
      ),
    );
  }

  const words = description
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 0);
  if (words.length > 0 && words.every((word) => VAGUE_WORDS.has(word))) {
    diagnostics.push(
      diagnostic(
        'pr-title.vague',
        'Pull request description is vague; state the concrete outcome.',
      ),
    );
  }

  return diagnostics;
}
