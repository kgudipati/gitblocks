import { describe, expect, it } from 'vitest';

import { validateBranchName } from '../src/branch-name.ts';

describe('validateBranchName', () => {
  it.each([
    'build/3-typescript-toolchain',
    'docs/1-project-foundation',
    'feat/24-repository-profiler',
    'fix/42-timeout',
    'security/112-webhook-signature-validation',
    'spike/90-package-resolution-benchmark',
  ])('accepts %s', (branchName) => {
    expect(validateBranchName(branchName)).toEqual([]);
  });

  it.each([
    ['feature/24-repository-profiler', 'branch.type'],
    ['feat/no-issue-repository-profiler', 'branch.format'],
    ['feat/24_repository_profiler', 'branch.format'],
    ['Feat/24-repository-profiler', 'branch.format'],
    ['feat/24/repository-profiler', 'branch.format'],
    ['feat/24-work', 'branch.vague'],
    ['feat/24-2026-07-28-profiler', 'branch.date'],
    [
      'security/112-webhook-signature-validation-with-an-excessively-long-name',
      'branch.length',
    ],
  ])('rejects %s with %s', (branchName, code) => {
    expect(
      validateBranchName(branchName).map((diagnostic) => diagnostic.code),
    ).toContain(code);
  });
});
