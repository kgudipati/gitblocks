import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  CONTRACT_CONFORMANCE_EXIT_CODES,
  runContractConformanceCli,
} from '../src/contract-conformance-cli.ts';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

function output() {
  const errors: string[] = [];
  const logs: string[] = [];
  return {
    errors,
    logs,
    writer: {
      error: (message: string) => errors.push(message),
      log: (message: string) => logs.push(message),
    },
  };
}

describe('product contract conformance CLI', () => {
  it('reports conformance without scoring or accepting proposed gold', () => {
    const capture = output();
    const exitCode = runContractConformanceCli(
      [],
      join(REPOSITORY_ROOT, 'tools', 'evaluation-harness', 'test'),
      capture.writer,
    );

    expect(exitCode).toBe(CONTRACT_CONFORMANCE_EXIT_CODES.success);
    expect(capture.errors).toEqual([]);
    expect(capture.logs).toEqual([
      'Product contract conformance passed (10 cases, 40 supplied candidates, proposed/not-reviewed, representability-only).',
    ]);
  });

  it('rejects arguments at the narrow process boundary', () => {
    const capture = output();

    expect(
      runContractConformanceCli(['contracts'], REPOSITORY_ROOT, capture.writer),
    ).toBe(CONTRACT_CONFORMANCE_EXIT_CODES.usage);
    expect(capture.logs).toEqual([]);
    expect(capture.errors).toEqual(['usage: evaluation-contract-conformance']);
  });
});
