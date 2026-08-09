import { describe, expect, it } from 'vitest';

import { runRetrievalCli } from '../src/retrieval/cli.ts';

describe('retrieval CLI', () => {
  it('validates the corpus and runs only hand-calculated fixtures', () => {
    const lines: string[] = [];
    const output = {
      error: (line: string) => lines.push(line),
      log: (line: string) => lines.push(line),
    };
    expect(runRetrievalCli(['validate'], process.cwd(), output)).toBe(0);
    expect(runRetrievalCli(['fixtures'], process.cwd(), output)).toBe(0);
    expect(lines.join('\n')).not.toContain('baseline');
  }, 60_000);

  it('fails closed for missing, non-JSON, and unknown score commands', () => {
    const lines: string[] = [];
    const output = {
      error: (line: string) => lines.push(line),
      log: (line: string) => lines.push(line),
    };
    expect(runRetrievalCli(['score'], process.cwd(), output)).toBe(1);
    expect(
      runRetrievalCli(
        ['score', '--prediction', 'README.md'],
        process.cwd(),
        output,
      ),
    ).toBe(1);
    expect(runRetrievalCli(['baseline'], process.cwd(), output)).toBe(1);
    expect(
      runRetrievalCli(['production-v2', 'unexpected'], process.cwd(), output),
    ).toBe(1);
    expect(lines.join('\n')).not.toContain('GitBlocks is');
  }, 60_000);
});
