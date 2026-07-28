export const ALLOWED_CHANGE_TYPES = [
  'build',
  'chore',
  'ci',
  'docs',
  'feat',
  'fix',
  'perf',
  'refactor',
  'security',
  'spike',
  'test',
] as const;

export const MAX_BRANCH_NAME_LENGTH = 60;
export const MAX_PULL_REQUEST_TITLE_LENGTH = 100;
