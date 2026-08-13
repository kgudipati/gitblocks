import type * as CompositionModule from '../src/composition.ts';
import type * as HttpModule from '../src/mcp-http.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const lifecycle = vi.hoisted(() => ({
  events: [] as string[],
  compositionClose: vi.fn<() => Promise<void>>(),
  listenerClose: vi.fn<() => Promise<void>>(),
  startComposition:
    vi.fn<typeof CompositionModule.startHostedDiscoveryComposition>(),
  startListener: vi.fn<typeof HttpModule.startGitBlocksMcpHttpServer>(),
}));

vi.mock('../src/composition.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof CompositionModule>();
  return {
    ...actual,
    startHostedDiscoveryComposition: lifecycle.startComposition,
  };
});

vi.mock('../src/mcp-http.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof HttpModule>();
  return {
    ...actual,
    startGitBlocksMcpHttpServer: lifecycle.startListener,
  };
});

import { startGitBlocksMcpProcess } from '../src/mcp-process.ts';

beforeEach(() => {
  vi.clearAllMocks();
  lifecycle.events.length = 0;
  lifecycle.compositionClose.mockImplementation(() => {
    lifecycle.events.push('composition-close');
    return Promise.resolve();
  });
  lifecycle.listenerClose.mockImplementation(() => {
    lifecycle.events.push('listener-close');
    return Promise.resolve();
  });
  lifecycle.startComposition.mockImplementation(() => {
    lifecycle.events.push('composition-ready');
    return Promise.resolve({
      discoverCapability: () => ({
        ok: false,
        failure: {
          kind: 'application',
          code: 'hosted-discovery-not-ready',
          path: '',
          message: 'Hosted discovery is not ready.',
        },
      }),
      readiness: () => ({ ready: true, snapshot: snapshot() }),
      close: lifecycle.compositionClose,
    });
  });
  lifecycle.startListener.mockImplementation(() => {
    lifecycle.events.push('listener-ready');
    return Promise.resolve({
      endpoint: new URL('http://127.0.0.1:3333/mcp'),
      close: lifecycle.listenerClose,
    });
  });
});

describe('GitBlocks MCP process lifecycle', () => {
  it('waits for R4 readiness before listening and closes listener before composition exactly once', async () => {
    const process = await startGitBlocksMcpProcess({
      database: databaseConfiguration(),
      port: 3333,
    });

    expect(lifecycle.events).toEqual(['composition-ready', 'listener-ready']);
    const listenerInput = lifecycle.startListener.mock.calls[0]?.[0];
    expect(listenerInput?.port).toBe(3333);
    expect(typeof listenerInput?.application.discoverCapability).toBe(
      'function',
    );
    await Promise.all([process.close(), process.close()]);
    expect(lifecycle.events).toEqual([
      'composition-ready',
      'listener-ready',
      'listener-close',
      'composition-close',
    ]);
    expect(lifecycle.listenerClose).toHaveBeenCalledTimes(1);
    expect(lifecycle.compositionClose).toHaveBeenCalledTimes(1);
  });

  it('does not listen when R4 startup fails', async () => {
    lifecycle.startComposition.mockRejectedValueOnce(
      new Error('bounded startup failure'),
    );
    await expect(
      startGitBlocksMcpProcess({
        database: databaseConfiguration(),
        port: 3333,
      }),
    ).rejects.toThrow('bounded startup failure');
    expect(lifecycle.startListener).not.toHaveBeenCalled();
  });

  it('closes the ready composition when listener startup fails', async () => {
    lifecycle.startListener.mockRejectedValueOnce(
      new Error('listener startup failure'),
    );
    await expect(
      startGitBlocksMcpProcess({
        database: databaseConfiguration(),
        port: 3333,
      }),
    ).rejects.toThrow('listener startup failure');
    expect(lifecycle.compositionClose).toHaveBeenCalledTimes(1);
  });
});

function snapshot() {
  return {
    snapshotId: 'mcp-process-test',
    snapshotRecordDigest: 'd'.repeat(64),
    candidateCount: 150,
  };
}

function databaseConfiguration() {
  return {
    host: '127.0.0.1',
    port: 5432,
    database: 'gitblocks',
    username: 'gitblocks_serving_login',
    password: 'test-only-password',
    ssl: false as const,
  };
}
