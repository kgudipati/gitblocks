import { describe, expect, it } from 'vitest';

import { validatePullRequestTitle } from '../src/pr-title.ts';

describe('validatePullRequestTitle', () => {
  it.each([
    'build: establish TypeScript workspace and verification pipeline',
    'feat(profiler): detect Prisma and Drizzle versions',
    'fix(webhooks): reject replayed delivery identifiers',
    'refactor(core)!: remove legacy result shape',
    'security: harden dependency installation policy',
  ])('accepts %s', (title) => {
    expect(validatePullRequestTitle(title)).toEqual([]);
  });

  it.each([
    ['update dependencies', 'pr-title.format'],
    ['feature: add profiler', 'pr-title.type'],
    ['fix: Fix replay handling', 'pr-title.description-case'],
    ['fix: reject replayed deliveries.', 'pr-title.trailing-period'],
    ['fix: stuff', 'pr-title.vague'],
    ['fix(Bad Scope): reject replay', 'pr-title.format'],
    ['fix:reject replay', 'pr-title.format'],
    [
      'build: establish a verification pipeline whose intentionally oversized description exceeds the documented title bound for review',
      'pr-title.length',
    ],
  ])('rejects %s with %s', (title, code) => {
    expect(
      validatePullRequestTitle(title).map((diagnostic) => diagnostic.code),
    ).toContain(code);
  });
});
