import { readFileSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { runRetrievalCli } from '../src/retrieval/cli.ts';

describe('retrieval baseline CLI', () => {
  let inProcessReport: string | undefined;

  it.each(['baselines', 'baselines-generate', 'verify'])(
    'rejects unexpected arguments for %s',
    (command) => {
      const output = capture();
      expect(
        runRetrievalCli(
          [command, '--output', 'arbitrary.json'],
          process.cwd(),
          output,
        ),
      ).toBe(1);
      expect(output.errors).toEqual([
        'Unexpected retrieval baseline arguments.',
      ]);
    },
  );

  it('prints canonical content in-process without writing', () => {
    const reportPath = fileURLToPath(
      new URL(
        '../../../verification/retrieval-v1/baseline-report.json',
        import.meta.url,
      ),
    );
    const before = {
      bytes: readFileSync(reportPath),
      modified: statSync(reportPath).mtimeMs,
    };
    const output = capture();
    expect(runRetrievalCli(['baselines'], process.cwd(), output)).toBe(0);
    expect(output.errors).toEqual([]);
    expect(output.logs).toHaveLength(1);
    inProcessReport = output.logs[0];
    expect(inProcessReport).not.toMatch(
      /\b(?:ret|norm)-(?:authorization|audit-logging|background-jobs|rate-limiting|webhooks)-\d{2}\b/u,
    );
    const after = {
      bytes: readFileSync(reportPath),
      modified: statSync(reportPath).mtimeMs,
    };
    expect(after).toEqual(before);
  }, 90_000);

  it('matches canonical in-process output in a fresh process without writing', () => {
    const reportPath = fileURLToPath(
      new URL(
        '../../../verification/retrieval-v1/baseline-report.json',
        import.meta.url,
      ),
    );
    const before = {
      bytes: readFileSync(reportPath),
      modified: statSync(reportPath).mtimeMs,
    };
    const cli = fileURLToPath(
      new URL('../src/retrieval/cli.ts', import.meta.url),
    );
    const fresh = spawnSync(process.execPath, [cli, 'baselines'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      maxBuffer: 2 * 1024 * 1024,
      timeout: 60_000,
    });
    expect(fresh.status).toBe(0);
    expect(fresh.stderr).toBe('');
    expect(inProcessReport).toBeDefined();
    expect(fresh.stdout).toBe(`${inProcessReport ?? ''}\n`);
    const after = {
      bytes: readFileSync(reportPath),
      modified: statSync(reportPath).mtimeMs,
    };
    expect(after).toEqual(before);
  }, 90_000);

  it('runs read-only verification without changing the committed report', () => {
    const reportPath = fileURLToPath(
      new URL(
        '../../../verification/retrieval-v1/baseline-report.json',
        import.meta.url,
      ),
    );
    const before = {
      bytes: readFileSync(reportPath),
      modified: statSync(reportPath).mtimeMs,
      changed: statSync(reportPath).ctimeMs,
    };
    const output = capture();
    expect(runRetrievalCli(['verify'], process.cwd(), output)).toBe(0);
    expect(output.errors).toEqual([]);
    expect(JSON.parse(output.logs[0] ?? '{}')).toMatchObject({
      effectAudit: 'no-write',
      predictionGenerationCount: 2,
      reverseAuthorityOrderMatched: true,
    });
    const after = {
      bytes: readFileSync(reportPath),
      modified: statSync(reportPath).mtimeMs,
      changed: statSync(reportPath).ctimeMs,
    };
    expect(after).toEqual(before);
  }, 90_000);
});

function capture(): {
  readonly errors: string[];
  readonly logs: string[];
  readonly error: (line: string) => void;
  readonly log: (line: string) => void;
} {
  const errors: string[] = [];
  const logs: string[] = [];
  return {
    errors,
    logs,
    error: (line) => errors.push(line),
    log: (line) => logs.push(line),
  };
}
