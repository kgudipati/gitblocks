import { EventEmitter } from 'node:events';

import { describe, expect, it, vi } from 'vitest';

import { HostedConfigurationError } from '../src/configuration.ts';
import { runGitBlocksMcpCli } from '../src/mcp-cli-runtime.ts';

describe('hosted MCP CLI lifecycle', () => {
  it('drains on SIGTERM and returns exit code zero', async () => {
    const signalSource = new EventEmitter();
    const stdout: string[] = [];
    let finishDrain: (() => void) | undefined;
    const close = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishDrain = resolve;
        }),
    );
    const running = runGitBlocksMcpCli({
      signalSource,
      start: () =>
        Promise.resolve({
          endpoint: new URL('http://127.0.0.1:3333/mcp'),
          close,
        }),
      writeStdout: (text) => stdout.push(text),
      writeStderr: vi.fn(),
    });
    await vi.waitFor(() => {
      expect(stdout.join('')).toContain('"status":"ready"');
    });

    signalSource.emit('SIGTERM');
    await vi.waitFor(() => {
      expect(close).toHaveBeenCalledTimes(1);
    });
    let settled = false;
    void running.then(() => {
      settled = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(settled).toBe(false);

    finishDrain?.();
    expect(await running).toBe(0);
    expect(stdout.join('')).toContain(
      '{"operation":"hosted-mcp.shutdown","status":"complete"}',
    );
  });

  it('writes aggregate configuration problems without supplied values', async () => {
    const signalSource = new EventEmitter();
    const stderr: string[] = [];
    const suppliedValue = 'configuration-value-output-sentinel';
    const exitCode = await runGitBlocksMcpCli({
      signalSource,
      start: () =>
        Promise.reject(
          new HostedConfigurationError([
            {
              variable: 'GITBLOCKS_HOSTED_SERVING_DB_HOST',
              expected: 'non-empty text',
            },
            {
              variable: 'GITBLOCKS_HOSTED_SERVING_DB_SSL',
              expected: 'one of: disable, require',
            },
          ]),
        ),
      writeStdout: vi.fn(),
      writeStderr: (text) => stderr.push(text),
    });

    expect(exitCode).toBe(1);
    expect(stderr.join('')).toContain('GITBLOCKS_HOSTED_SERVING_DB_HOST');
    expect(stderr.join('')).toContain('one of: disable, require');
    expect(stderr.join('')).not.toContain(suppliedValue);
  });
});
