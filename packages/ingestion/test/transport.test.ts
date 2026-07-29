import { describe, expect, it } from 'vitest';

import {
  IngestionError,
  createTransport,
  type TransportRequest,
} from '../src/index.ts';

const REQUEST: TransportRequest = {
  url: new URL('https://api.github.com/repos/example/project'),
  provider: 'github',
  operation: 'repository',
  maximumBytes: 1_024,
  authorizationToken: 'test-token-value',
  correlationId: 'correlation-1',
  candidateId: 'candidate-1',
};

describe('bounded provider transport', () => {
  it('sends the pinned GitHub media/API headers without exposing the token', async () => {
    let capturedHeaders: Headers | undefined;
    const fetchImplementation: typeof fetch = (_input, init) => {
      capturedHeaders = new Headers(init?.headers);
      return Promise.resolve(jsonResponse({ ok: true }));
    };
    const transport = createTransport({
      fetch: fetchImplementation,
      sleep: () => Promise.resolve(),
    });
    await expect(transport.requestJson(REQUEST)).resolves.toMatchObject({
      value: { ok: true },
      status: 200,
    });
    expect(capturedHeaders?.get('x-github-api-version')).toBe('2026-03-10');
    expect(capturedHeaders?.get('authorization')).toBe(
      'Bearer test-token-value',
    );
  });

  it('rejects arbitrary hosts and same-provider redirects to another host', async () => {
    const transport = createTransport({
      fetch: () =>
        Promise.resolve(
          new Response(null, {
            status: 302,
            headers: { location: 'https://example.com/private' },
          }),
        ),
      sleep: () => Promise.resolve(),
    });
    await expect(transport.requestJson(REQUEST)).rejects.toMatchObject({
      code: 'ingestion.redirect',
      message: 'The approved public provider returned an unsafe redirect.',
      stack: undefined,
    });
    await expect(
      transport.requestJson({
        ...REQUEST,
        url: new URL('https://example.com/repository'),
      }),
    ).rejects.toBeInstanceOf(IngestionError);
  });

  it('retries bounded transient failures and rejects oversized bodies', async () => {
    let attempts = 0;
    const delays: number[] = [];
    const transport = createTransport({
      fetch: () => {
        attempts += 1;
        return Promise.resolve(
          attempts === 1
            ? new Response(null, { status: 503 })
            : jsonResponse({ ok: true }),
        );
      },
      sleep: (milliseconds) => {
        delays.push(milliseconds);
        return Promise.resolve();
      },
    });
    await expect(transport.requestJson(REQUEST)).resolves.toBeDefined();
    expect(attempts).toBe(2);
    expect(delays).toHaveLength(1);
    expect(delays[0]).toBeGreaterThanOrEqual(250);
    expect(delays[0]).toBeLessThanOrEqual(500);

    const oversized = createTransport({
      fetch: () =>
        Promise.resolve(
          new Response('{"ok":true}', {
            headers: {
              'content-length': '2048',
              'content-type': 'application/json',
            },
          }),
        ),
      sleep: () => Promise.resolve(),
    });
    await expect(oversized.requestJson(REQUEST)).rejects.toMatchObject({
      code: 'ingestion.body-too-large',
    });
  });

  it('honors bounded GitHub Retry-After and stops retrying an excessive wait', async () => {
    const delays: number[] = [];
    let attempts = 0;
    const transport = createTransport({
      fetch: () => {
        attempts += 1;
        return Promise.resolve(
          attempts === 1
            ? new Response(null, {
                status: 429,
                headers: { 'retry-after': '2' },
              })
            : jsonResponse({ ok: true }),
        );
      },
      sleep: (milliseconds) => {
        delays.push(milliseconds);
        return Promise.resolve();
      },
    });
    await transport.requestJson(REQUEST);
    expect(delays).toEqual([2_000]);

    const blocked = createTransport({
      fetch: () =>
        Promise.resolve(
          new Response(null, {
            status: 429,
            headers: { 'retry-after': '61' },
          }),
        ),
      sleep: () => Promise.resolve(),
    });
    await expect(blocked.requestJson(REQUEST)).rejects.toMatchObject({
      code: 'ingestion.provider-rate-limited',
    });
    await expect(blocked.requestJson(REQUEST)).rejects.toMatchObject({
      code: 'ingestion.provider-rate-limited',
    });
  });

  it('honors npm Retry-After and preserves the rate-limit outcome', async () => {
    const delays: number[] = [];
    let attempts = 0;
    const transport = createTransport({
      fetch: () => {
        attempts += 1;
        return Promise.resolve(
          attempts === 1
            ? new Response(null, {
                status: 429,
                headers: { 'retry-after': '3' },
              })
            : jsonResponse({ ok: true }),
        );
      },
      sleep: (milliseconds) => {
        delays.push(milliseconds);
        return Promise.resolve();
      },
    });
    await transport.requestJson({
      operation: REQUEST.operation,
      maximumBytes: REQUEST.maximumBytes,
      correlationId: REQUEST.correlationId,
      candidateId: REQUEST.candidateId,
      provider: 'npm',
      url: new URL('https://registry.npmjs.org/example'),
    });
    expect(delays).toEqual([3_000]);
  });

  it('rejects unsupported content, malformed or excessive JSON, and timed-out fetches', async () => {
    const responses = [
      new Response('{}', { headers: { 'content-type': 'text/plain' } }),
      new Response('{', {
        headers: { 'content-type': 'application/json' },
      }),
      new Response(`${'['.repeat(34)}0${']'.repeat(34)}`, {
        headers: { 'content-type': 'application/json' },
      }),
    ];
    for (const response of responses) {
      const transport = createTransport({
        fetch: () => Promise.resolve(response),
        sleep: () => Promise.resolve(),
      });
      await expect(transport.requestJson(REQUEST)).rejects.toBeInstanceOf(
        IngestionError,
      );
    }

    const timedOut = createTransport({
      fetch: (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () => {
              reject(new Error('untrusted abort detail'));
            },
            { once: true },
          );
        }),
      sleep: () => Promise.resolve(),
      requestTimeoutMilliseconds: 1,
    });
    await expect(timedOut.requestJson(REQUEST)).rejects.toMatchObject({
      code: 'ingestion.deadline-exceeded',
      message: 'The ingestion deadline was exceeded.',
    });
  });

  it('preserves caller cancellation separately from an internal deadline', async () => {
    const controller = new AbortController();
    const transport = createTransport({
      fetch: (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () => {
              reject(new Error('untrusted cancellation detail'));
            },
            { once: true },
          );
          controller.abort();
        }),
      sleep: () => Promise.resolve(),
    });
    await expect(
      transport.requestJson({ ...REQUEST, signal: controller.signal }),
    ).rejects.toMatchObject({
      code: 'ingestion.cancelled',
      message: 'The ingestion request was cancelled by the caller.',
    });
  });

  it.each([
    [401, 'ingestion.provider-authentication'],
    [403, 'ingestion.provider-authorization'],
    [404, 'ingestion.provider-not-found'],
  ] as const)(
    'classifies HTTP %s without downgrading it',
    async (status, code) => {
      const transport = createTransport({
        fetch: () => Promise.resolve(new Response(null, { status })),
        sleep: () => Promise.resolve(),
      });
      await expect(transport.requestJson(REQUEST)).rejects.toMatchObject({
        code,
      });
    },
  );
});

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}
