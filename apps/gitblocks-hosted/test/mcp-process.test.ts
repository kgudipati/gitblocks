import type * as CompositionModule from '../src/composition.ts';
import type * as HttpModule from '../src/mcp-http.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const lifecycle = vi.hoisted(() => ({
  events: [] as string[],
  compositionClose: vi.fn<() => Promise<void>>(),
  listenerClose: vi.fn<() => Promise<void>>(),
  startComposition:
    vi.fn<typeof CompositionModule.startHostedRecommendationComposition>(),
  startListener: vi.fn<typeof HttpModule.startGitBlocksMcpHttpServer>(),
}));

vi.mock('../src/composition.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof CompositionModule>();
  return {
    ...actual,
    startHostedRecommendationComposition: lifecycle.startComposition,
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

const fitModel = Object.freeze({ assess: vi.fn() });
const MCP_TOKEN = 'test-only-mcp-token';

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
      recommendOss: () =>
        Promise.resolve({
          ok: false,
          failure: {
            kind: 'application',
            code: 'hosted-recommendation-not-ready',
          },
        }),
      readiness: () => ({ ready: true, snapshot: snapshot() }),
      close: lifecycle.compositionClose,
    });
  });
  lifecycle.startListener.mockImplementation((input) => {
    lifecycle.events.push('listener-ready');
    lifecycle.events.push(
      input.readiness?.() === false
        ? 'listener-not-ready'
        : 'listener-ready-too-early',
    );
    return Promise.resolve({
      endpoint: new URL('http://127.0.0.1:3333/mcp'),
      close: lifecycle.listenerClose,
    });
  });
});

describe('GitBlocks recommendation MCP process lifecycle', () => {
  it('listens with not-ready health during snapshot load and closes listener before composition exactly once', async () => {
    const process = await startGitBlocksMcpProcess({
      database: databaseConfiguration(),
      fitModel,
      host: '0.0.0.0',
      publicHost: 'example-app.fly.dev',
      port: 3333,
      token: MCP_TOKEN,
    });
    expect(lifecycle.events).toEqual([
      'listener-ready',
      'listener-not-ready',
      'composition-ready',
    ]);
    const listenerInput = lifecycle.startListener.mock.calls[0]?.[0];
    expect(listenerInput?.port).toBe(3333);
    expect(listenerInput?.host).toBe('0.0.0.0');
    expect(listenerInput?.publicHost).toBe('example-app.fly.dev');
    expect(listenerInput?.token).toBe(MCP_TOKEN);
    expect(typeof listenerInput?.application.recommendOss).toBe('function');
    expect(listenerInput?.readiness?.()).toBe(true);
    expect(lifecycle.startComposition.mock.calls[0]?.[0].fitModel).toBe(
      fitModel,
    );
    await Promise.all([process.close(), process.close()]);
    expect(lifecycle.events).toEqual([
      'listener-ready',
      'listener-not-ready',
      'composition-ready',
      'listener-close',
      'composition-close',
    ]);
    expect(lifecycle.listenerClose).toHaveBeenCalledTimes(1);
    expect(lifecycle.compositionClose).toHaveBeenCalledTimes(1);
  });

  it('closes the not-ready listener when recommendation startup fails', async () => {
    lifecycle.startComposition.mockRejectedValueOnce(
      new Error('bounded startup failure'),
    );
    await expect(
      startGitBlocksMcpProcess({
        database: databaseConfiguration(),
        fitModel,
        port: 3333,
        token: MCP_TOKEN,
      }),
    ).rejects.toThrow('bounded startup failure');
    expect(lifecycle.startListener).toHaveBeenCalledTimes(1);
    expect(lifecycle.listenerClose).toHaveBeenCalledTimes(1);
  });

  it('does not start the composition when listener startup fails', async () => {
    lifecycle.startListener.mockRejectedValueOnce(
      new Error('listener startup failure'),
    );
    await expect(
      startGitBlocksMcpProcess({
        database: databaseConfiguration(),
        fitModel,
        port: 3333,
        token: MCP_TOKEN,
      }),
    ).rejects.toThrow('listener startup failure');
    expect(lifecycle.startComposition).not.toHaveBeenCalled();
    expect(lifecycle.compositionClose).not.toHaveBeenCalled();
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
