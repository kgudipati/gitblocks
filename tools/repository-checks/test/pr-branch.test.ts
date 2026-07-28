import { describe, expect, it } from 'vitest';

import { validatePullRequestBranch } from '../src/pr-branch.ts';

describe('validatePullRequestBranch', () => {
  it.each([
    ['maintainer', 'fix/42-timeout'],
    ['contributor', 'build/3-typescript-toolchain'],
  ])('accepts human actor %s on %s', (actor, branchName) => {
    expect(validatePullRequestBranch(actor, branchName)).toEqual([]);
  });

  it('applies the existing issue-linked policy to an invalid human branch', () => {
    expect(validatePullRequestBranch('maintainer', 'feature/no-issue')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'branch.format' }),
      ]),
    );
  });

  it.each([
    'dependabot/npm_and_yarn/typescript-6.0.4',
    'dependabot/npm_and_yarn/@types/node-24.13.4',
    'dependabot/github_actions/actions/checkout-8.0.0',
  ])('accepts the GitHub-managed Dependabot branch %s', (branchName) => {
    expect(validatePullRequestBranch('dependabot[bot]', branchName)).toEqual(
      [],
    );
  });

  it('rejects a malformed Dependabot branch for the Dependabot actor', () => {
    expect(
      validatePullRequestBranch(
        'dependabot[bot]',
        'dependabot/npm_and_yarn/../typescript',
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'pr-branch.dependabot-format' }),
      ]),
    );
  });

  it('does not grant the Dependabot exception to a human actor', () => {
    expect(
      validatePullRequestBranch(
        'maintainer',
        'dependabot/npm_and_yarn/typescript-6.0.4',
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'branch.format' }),
      ]),
    );
  });

  it('does not grant the Dependabot exception to a lookalike actor', () => {
    expect(
      validatePullRequestBranch(
        'dependabot-bot',
        'dependabot/npm_and_yarn/typescript-6.0.4',
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'branch.format' }),
      ]),
    );
  });
});
