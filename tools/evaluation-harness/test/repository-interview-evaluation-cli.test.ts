import { afterEach, describe, expect, it, vi } from 'vitest';

import { runRepositoryInterviewEvaluationCli } from '../src/repository-interview-evaluation-cli.ts';
import { findGitBlocksRoot } from '../src/repository-root.ts';

const root = findGitBlocksRoot(process.cwd());

afterEach(() => {
  vi.restoreAllMocks();
});

describe('repository-interview evaluation CLI', () => {
  it('prints only content-free validation authority', () => {
    const output: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((value) => {
      output.push(String(value));
      return true;
    });
    expect(runRepositoryInterviewEvaluationCli(['validate'], root)).toBe(0);
    const text = output.join('');
    expect(text).toContain('candidates 30');
    expect(text).toContain('families 6/6/6/6/6');
    expect(text).not.toContain('selectionRationaleCodes');
    expect(text).not.toContain('Ignore previous instructions');
  });

  it('reports only deterministic scenario names and expected results', () => {
    const output: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((value) => {
      output.push(String(value));
      return true;
    });
    expect(runRepositoryInterviewEvaluationCli(['fixtures'], root)).toBe(0);
    expect(output.join('')).toContain('perfect-pass pass');
    expect(output.join('')).not.toContain('subjectId');
  });

  it('fails closed on an unknown command', () => {
    const errors: string[] = [];
    vi.spyOn(process.stderr, 'write').mockImplementation((value) => {
      errors.push(String(value));
      return true;
    });
    expect(runRepositoryInterviewEvaluationCli(['unknown'], root)).toBe(1);
    expect(errors.join('')).toContain('Usage:');
  });
});
