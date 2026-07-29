import { TextDecoder } from 'node:util';
import type { ReadableStreamReadResult } from 'node:stream/web';

import { IngestionError, asSafeErrorCode, ingestionError } from './errors.ts';
import { parseBoundedJson } from './json-boundary.ts';
import type { IngestionObserver, TransportMetrics } from './types.ts';

const RETRYABLE_STATUS = new Set([408, 500, 502, 503, 504]);

export interface TransportRequest {
  readonly url: URL;
  readonly provider: 'github' | 'npm';
  readonly operation: string;
  readonly maximumBytes: number;
  readonly authorizationToken?: string;
  readonly correlationId: string;
  readonly candidateId: string;
  readonly signal?: AbortSignal;
}

export interface TransportConfig {
  readonly fetch: typeof fetch;
  readonly sleep: (milliseconds: number, signal?: AbortSignal) => Promise<void>;
  readonly observer?: IngestionObserver;
  readonly requestTimeoutMilliseconds?: number;
  readonly maximumRedirects?: number;
  readonly maximumAttempts?: number;
  readonly nowMilliseconds?: () => number;
}

export interface JsonResponse {
  readonly value: unknown;
  readonly headers: Headers;
  readonly status: number;
}

export function createTransport(config: TransportConfig): {
  requestJson(request: TransportRequest): Promise<JsonResponse>;
  getMetrics(): TransportMetrics;
} {
  const requestTimeoutMilliseconds =
    config.requestTimeoutMilliseconds ?? 10_000;
  const maximumRedirects = config.maximumRedirects ?? 2;
  const maximumAttempts = config.maximumAttempts ?? 3;
  const nowMilliseconds = config.nowMilliseconds ?? Date.now;
  let githubBlocked = false;
  const providerRequestCounts = { github: 0, npm: 0 };
  let githubRateLimit: TransportMetrics['githubRateLimit'] = null;
  validatePositiveBound(requestTimeoutMilliseconds, 60_000);
  validatePositiveBound(maximumRedirects + 1, 6);
  validatePositiveBound(maximumAttempts, 3);

  return {
    requestJson: async (request) => {
      validateRequest(request);
      if (request.provider === 'github' && githubBlocked) {
        throw ingestionError('ingestion.provider-rate-limited');
      }
      for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
        const started = performance.now();
        config.observer?.({
          eventName: 'ingestion.request',
          correlationId: request.correlationId,
          candidateId: request.candidateId,
          provider: request.provider,
          operation: request.operation,
          outcome: 'started',
          attempt,
          durationMilliseconds: null,
          safeErrorCode: null,
        });
        try {
          const response = await requestOnce(
            config.fetch,
            request,
            requestTimeoutMilliseconds,
            maximumRedirects,
            nowMilliseconds,
            () => {
              providerRequestCounts[request.provider] += 1;
            },
            (headers) => {
              if (request.provider === 'github') {
                githubRateLimit =
                  parseGitHubRateLimit(headers) ?? githubRateLimit;
              }
            },
          );
          config.observer?.({
            eventName: 'ingestion.request',
            correlationId: request.correlationId,
            candidateId: request.candidateId,
            provider: request.provider,
            operation: request.operation,
            outcome: 'succeeded',
            attempt,
            durationMilliseconds: Math.round(performance.now() - started),
            safeErrorCode: null,
          });
          return response;
        } catch (error) {
          if (
            request.provider === 'github' &&
            error instanceof IngestionError &&
            error.code === 'ingestion.provider-rate-limited' &&
            error.retryAfterMilliseconds !== null &&
            error.retryAfterMilliseconds > 60_000
          ) {
            githubBlocked = true;
          }
          const retryable =
            error instanceof Error &&
            'retryable' in error &&
            error.retryable === true;
          if (!retryable || attempt === maximumAttempts) {
            config.observer?.({
              eventName: 'ingestion.request',
              correlationId: request.correlationId,
              candidateId: request.candidateId,
              provider: request.provider,
              operation: request.operation,
              outcome: 'failed',
              attempt,
              durationMilliseconds: Math.round(performance.now() - started),
              safeErrorCode: asSafeErrorCode(error),
            });
            throw error;
          }
          config.observer?.({
            eventName: 'ingestion.request',
            correlationId: request.correlationId,
            candidateId: request.candidateId,
            provider: request.provider,
            operation: request.operation,
            outcome: 'retried',
            attempt,
            durationMilliseconds: Math.round(performance.now() - started),
            safeErrorCode: asSafeErrorCode(error),
          });
          const requiredDelay =
            error instanceof IngestionError
              ? error.retryAfterMilliseconds
              : null;
          if (requiredDelay !== null && requiredDelay > 60_000) {
            githubBlocked = request.provider === 'github';
            throw ingestionError('ingestion.provider-rate-limited');
          }
          await config.sleep(
            requiredDelay ??
              retryDelayMilliseconds(
                attempt,
                request.candidateId,
                request.operation,
              ),
            request.signal,
          );
        }
      }
      throw ingestionError('ingestion.provider-unavailable', true);
    },
    getMetrics: () => ({
      providerRequestCounts: { ...providerRequestCounts },
      githubRateLimit,
    }),
  };
}

async function requestOnce(
  fetchImplementation: typeof fetch,
  request: TransportRequest,
  timeoutMilliseconds: number,
  maximumRedirects: number,
  nowMilliseconds: () => number,
  onRequest: () => void,
  onResponse: (headers: Headers) => void,
): Promise<JsonResponse> {
  let url = new URL(request.url);
  for (let redirectCount = 0; ; redirectCount += 1) {
    validateProviderUrl(url, request.provider);
    const timeoutSignal = AbortSignal.timeout(timeoutMilliseconds);
    const signal =
      request.signal === undefined
        ? timeoutSignal
        : AbortSignal.any([request.signal, timeoutSignal]);
    let response: Response;
    try {
      onRequest();
      response = await fetchImplementation(url, {
        method: 'GET',
        redirect: 'manual',
        signal,
        headers: requestHeaders(request),
      });
    } catch {
      if (signal.aborted) {
        throw ingestionError('ingestion.deadline-exceeded');
      }
      throw ingestionError('ingestion.provider-unavailable', true);
    }
    onResponse(response.headers);
    if (response.status >= 300 && response.status < 400) {
      if (redirectCount >= maximumRedirects) {
        await cancelBody(response);
        throw ingestionError('ingestion.redirect');
      }
      const location = response.headers.get('location');
      await cancelBody(response);
      if (location === null) {
        throw ingestionError('ingestion.redirect');
      }
      let redirected: URL;
      try {
        redirected = new URL(location, url);
      } catch {
        throw ingestionError('ingestion.redirect');
      }
      validateProviderUrl(redirected, request.provider);
      url = redirected;
      continue;
    }
    if (!response.ok) {
      await cancelBody(response);
      if (
        request.provider === 'github' &&
        (response.status === 403 || response.status === 429)
      ) {
        const delay = githubRateLimitDelay(response.headers, nowMilliseconds());
        throw ingestionError(
          'ingestion.provider-rate-limited',
          delay <= 60_000,
          delay,
        );
      }
      if (response.status === 429) {
        throw ingestionError('ingestion.provider-rate-limited', true);
      }
      if (RETRYABLE_STATUS.has(response.status)) {
        throw ingestionError('ingestion.provider-unavailable', true);
      }
      throw ingestionError('ingestion.provider-response');
    }
    const contentType = response.headers.get('content-type') ?? '';
    if (!/^application\/(?:[\w.+-]*\+)?json(?:\s*;|$)/iu.test(contentType)) {
      await cancelBody(response);
      throw ingestionError('ingestion.content-type');
    }
    const text = await readBoundedText(response, request.maximumBytes);
    return {
      value: parseBoundedJson(
        text,
        {
          maximumBytes: request.maximumBytes,
          maximumDepth: 32,
          maximumNodes: 100_000,
        },
        'ingestion.provider-response',
      ),
      headers: response.headers,
      status: response.status,
    };
  }
}

function requestHeaders(request: TransportRequest): Headers {
  const headers = new Headers({
    accept:
      request.provider === 'github'
        ? 'application/vnd.github+json'
        : 'application/json',
    'accept-encoding': 'identity',
    'user-agent': 'gitblocks-ingestion/1',
  });
  if (request.provider === 'github') {
    headers.set('x-github-api-version', '2026-03-10');
    if (request.authorizationToken !== undefined) {
      headers.set('authorization', `Bearer ${request.authorizationToken}`);
    }
  }
  return headers;
}

function validateRequest(request: TransportRequest): void {
  validatePositiveBound(request.maximumBytes, 16 * 1_024 * 1_024);
  validateProviderUrl(request.url, request.provider);
  if (
    request.authorizationToken !== undefined &&
    (request.authorizationToken.length < 1 ||
      request.authorizationToken.length > 1_024 ||
      hasControlCharacter(request.authorizationToken))
  ) {
    throw ingestionError('ingestion.invalid-input');
  }
}

function validateProviderUrl(url: URL, provider: 'github' | 'npm'): void {
  const expectedHost =
    provider === 'github' ? 'api.github.com' : 'registry.npmjs.org';
  if (
    url.protocol !== 'https:' ||
    url.hostname !== expectedHost ||
    url.port !== '' ||
    url.username !== '' ||
    url.password !== '' ||
    url.hash !== ''
  ) {
    throw ingestionError('ingestion.redirect');
  }
}

async function readBoundedText(
  response: Response,
  maximumBytes: number,
): Promise<string> {
  const contentLength = response.headers.get('content-length');
  if (
    contentLength !== null &&
    (!/^\d+$/u.test(contentLength) || Number(contentLength) > maximumBytes)
  ) {
    await cancelBody(response);
    throw ingestionError('ingestion.body-too-large');
  }
  if (response.body === null) {
    throw ingestionError('ingestion.provider-response');
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let total = 0;
  let text = '';
  try {
    for (;;) {
      const result: ReadableStreamReadResult<Uint8Array> = await reader.read();
      if (result.done) {
        break;
      }
      total += result.value.byteLength;
      if (total > maximumBytes) {
        await reader.cancel();
        throw ingestionError('ingestion.body-too-large');
      }
      text += decoder.decode(result.value, { stream: true });
    }
    text += decoder.decode();
    return text;
  } catch (error) {
    if (error instanceof Error && error.name === 'IngestionError') {
      throw error;
    }
    throw ingestionError('ingestion.provider-response');
  } finally {
    reader.releaseLock();
  }
}

function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 31 || code === 127) {
      return true;
    }
  }
  return false;
}

async function cancelBody(response: Response): Promise<void> {
  await response.body?.cancel().catch(() => undefined);
}

function retryDelayMilliseconds(
  attempt: number,
  candidateId: string,
  operation: string,
): number {
  const seed = `${candidateId}:${operation}:${String(attempt)}`;
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 251;
  }
  return Math.min(5_000, 250 * 2 ** (attempt - 1) + hash);
}

function githubRateLimitDelay(
  headers: Headers,
  nowMilliseconds: number,
): number {
  const retryAfter = headers.get('retry-after');
  if (retryAfter !== null && /^\d{1,5}$/u.test(retryAfter)) {
    return Number(retryAfter) * 1_000;
  }
  const remaining = headers.get('x-ratelimit-remaining');
  const reset = headers.get('x-ratelimit-reset');
  if (remaining === '0' && reset !== null && /^\d{1,12}$/u.test(reset)) {
    return Math.max(0, Number(reset) * 1_000 - nowMilliseconds);
  }
  return 60_000;
}

function parseGitHubRateLimit(
  headers: Headers,
): TransportMetrics['githubRateLimit'] {
  const limit = headers.get('x-ratelimit-limit');
  const remaining = headers.get('x-ratelimit-remaining');
  const reset = headers.get('x-ratelimit-reset');
  if (
    limit === null ||
    remaining === null ||
    reset === null ||
    !/^\d{1,10}$/u.test(limit) ||
    !/^\d{1,10}$/u.test(remaining) ||
    !/^\d{1,12}$/u.test(reset)
  ) {
    return null;
  }
  const limitValue = Number(limit);
  const remainingValue = Number(remaining);
  const resetMilliseconds = Number(reset) * 1_000;
  if (
    limitValue > 1_000_000_000 ||
    remainingValue > limitValue ||
    !Number.isFinite(resetMilliseconds)
  ) {
    return null;
  }
  return {
    limit: limitValue,
    remaining: remainingValue,
    resetAt: new Date(resetMilliseconds).toISOString(),
  };
}

function validatePositiveBound(value: number, maximum: number): void {
  if (!Number.isInteger(value) || value < 1 || value > maximum) {
    throw ingestionError('ingestion.invalid-input');
  }
}

export async function abortableSleep(
  milliseconds: number,
  signal?: AbortSignal,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    if (signal?.aborted === true) {
      reject(ingestionError('ingestion.deadline-exceeded'));
      return;
    }
    const timeout = setTimeout(resolve, milliseconds);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timeout);
        reject(ingestionError('ingestion.deadline-exceeded'));
      },
      { once: true },
    );
  });
}
