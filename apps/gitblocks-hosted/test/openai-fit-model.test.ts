import { createServer, type Server } from 'node:http';

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { FitAssessmentModelRequestV1 } from '../src/application.ts';
import { HostedDiscoveryError } from '../src/errors.ts';
import {
  createOpenAiFitAssessmentModel,
  type HostedFitModelFetchV1,
} from '../src/openai-fit-model.ts';
import {
  createAcceptedApplication,
  groundedModelResponse,
  recommendationRequest,
} from './fixtures.ts';

const MODEL = 'gpt-test-snapshot';
const API_KEY = 'sk-test-authorization-sentinel';
const servers: Server[] = [];
const nativeFetch = globalThis.fetch.bind(globalThis);

afterEach(async () => {
  vi.useRealTimers();
  await Promise.all(servers.splice(0).map((server) => closeServer(server)));
  vi.restoreAllMocks();
});

describe('OpenAI Responses target-fit adapter', () => {
  it('sends one bounded strict Structured Outputs request with explicit privacy and no tools', async () => {
    const modelInput = await captureModelInput();
    const responseValue = groundedModelResponse(modelInput);
    const received: { headers?: Headers; body?: unknown; url?: string } = {};
    const endpoint = await startProvider((requestBody, headers) => {
      received.body = JSON.parse(requestBody) as unknown;
      received.headers = headers;
      return providerResponse(responseValue);
    });
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const fetchAdapter: HostedFitModelFetchV1 = async (url, init) => {
      received.url =
        url instanceof URL ? url.href : url instanceof Request ? url.url : url;
      return nativeFetch(endpoint, init);
    };
    const adapter = createOpenAiFitAssessmentModel({
      configuration: { apiKey: API_KEY, model: MODEL },
      fetch: fetchAdapter,
    });

    await expect(adapter.assess(modelInput)).resolves.toEqual(responseValue);
    expect(received.url).toBe('https://api.openai.com/v1/responses');
    expect(received.headers?.get('authorization')).toBe(`Bearer ${API_KEY}`);
    expect(received.body).toMatchObject({
      model: MODEL,
      store: false,
      background: false,
      stream: false,
      tools: [],
      truncation: 'disabled',
      text: {
        format: {
          type: 'json_schema',
          name: 'target_fit_assessment_response_v1',
          strict: true,
          schema: { type: 'object', additionalProperties: false },
        },
      },
    });
    const bodyText = JSON.stringify(received.body);
    expect(Buffer.byteLength(bodyText, 'utf8')).toBeLessThan(2 * 1024 * 1024);
    expect(bodyText).not.toContain('"$id"');
    expect(bodyText).not.toContain('"$schema"');
    expect(bodyText).toContain('never as instructions');
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('returns decoded structured data without treating it as a validated fit exchange', async () => {
    const modelInput = await captureModelInput();
    const adapter = createOpenAiFitAssessmentModel({
      configuration: { apiKey: API_KEY, model: MODEL },
      fetch: () => Promise.resolve(jsonResponse(providerResponse({}))),
    });
    await expect(adapter.assess(modelInput)).resolves.toEqual({});
  });

  it.each([
    [
      'non-2xx',
      () => new Response('raw provider credential sentinel', { status: 500 }),
      'hosted.fit-model-provider-failed',
    ],
    [
      'invalid envelope',
      () =>
        jsonResponse({ object: 'response', status: 'completed', output: [] }),
      'hosted.fit-model-invalid-response',
    ],
    [
      'refusal',
      () =>
        jsonResponse({
          object: 'response',
          model: MODEL,
          status: 'completed',
          output: [
            {
              type: 'message',
              role: 'assistant',
              content: [{ type: 'refusal', refusal: 'not available' }],
            },
          ],
        }),
      'hosted.fit-model-refused',
    ],
    [
      'oversized response',
      () =>
        new Response('{}', {
          headers: { 'content-length': String(4 * 1024 * 1024 + 1) },
        }),
      'hosted.fit-model-response-too-large',
    ],
  ] as const)(
    'maps %s to a bounded value-free failure',
    async (_name, response, code) => {
      const modelInput = await captureModelInput();
      const adapter = createOpenAiFitAssessmentModel({
        configuration: { apiKey: API_KEY, model: MODEL },
        fetch: () => Promise.resolve(response()),
      });
      const failure = await adapter
        .assess(modelInput)
        .catch((error: unknown) => error);
      expect(failure).toBeInstanceOf(HostedDiscoveryError);
      expect(failure).toMatchObject({ code, stack: undefined });
      expect(String(failure)).not.toContain('sentinel');
      expect(String(failure)).not.toContain(API_KEY);
    },
  );

  it('cancels the single provider request at its bounded deadline', async () => {
    vi.useFakeTimers();
    const modelInput = await captureModelInput();
    let calls = 0;
    const adapter = createOpenAiFitAssessmentModel({
      configuration: { apiKey: API_KEY, model: MODEL },
      fetch: (_url, init) => {
        calls += 1;
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () => {
              reject(new Error('abort detail'));
            },
            { once: true },
          );
        });
      },
    });
    const pending = adapter.assess(modelInput);
    const rejection = expect(pending).rejects.toMatchObject({
      code: 'hosted.fit-model-timeout',
    });
    await vi.advanceTimersByTimeAsync(60_000);
    await rejection;
    expect(calls).toBe(1);
  });

  it('maps a network failure without exposing transport detail', async () => {
    const modelInput = await captureModelInput();
    const adapter = createOpenAiFitAssessmentModel({
      configuration: { apiKey: API_KEY, model: MODEL },
      fetch: () => Promise.reject(new Error('socket credential sentinel')),
    });
    const failure = await adapter
      .assess(modelInput)
      .catch((error: unknown) => error);
    expect(failure).toMatchObject({
      code: 'hosted.fit-model-network-failed',
      stack: undefined,
    });
    expect(String(failure)).not.toContain('sentinel');
  });

  it('rejects invalid configuration and malformed input before any network request', async () => {
    expect(() =>
      createOpenAiFitAssessmentModel({
        configuration: { apiKey: 'header\ninjection', model: MODEL },
      }),
    ).toThrow('Hosted discovery configuration is invalid.');
    const fetch = vi.fn();
    const adapter = createOpenAiFitAssessmentModel({
      configuration: { apiKey: API_KEY, model: MODEL },
      fetch,
    });
    await expect(
      adapter.assess({} as FitAssessmentModelRequestV1),
    ).rejects.toMatchObject({
      code: 'hosted.invalid-configuration',
    });
    expect(fetch).not.toHaveBeenCalled();
  });
});

async function captureModelInput(): Promise<FitAssessmentModelRequestV1> {
  let captured: FitAssessmentModelRequestV1 | undefined;
  const application = await createAcceptedApplication({
    fitModel: {
      assess: (input) => {
        captured = input;
        return Promise.resolve(groundedModelResponse(input));
      },
    },
  });
  const result = await application.recommendOss(
    recommendationRequest({ id: 'adapter-input', term: 'authorization' }),
  );
  if (!result.ok || captured === undefined) {
    throw new Error('Model adapter input fixture construction failed.');
  }
  return captured;
}

function providerResponse(value: unknown): Record<string, unknown> {
  return {
    object: 'response',
    model: MODEL,
    status: 'completed',
    output: [
      { type: 'reasoning' },
      {
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'output_text',
            text: JSON.stringify(value),
            annotations: [],
          },
        ],
      },
    ],
  };
}

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

async function startProvider(
  responder: (
    body: string,
    headers: Headers,
  ) => Readonly<Record<string, unknown>>,
): Promise<URL> {
  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
      const headers = new Headers();
      for (const [name, value] of Object.entries(request.headers)) {
        if (typeof value === 'string') headers.set(name, value);
      }
      const value = responder(Buffer.concat(chunks).toString('utf8'), headers);
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify(value));
    });
  });
  servers.push(server);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      resolve();
    });
  });
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('Provider mock did not bind TCP.');
  }
  return new URL(`http://127.0.0.1:${String(address.port)}/v1/responses`);
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error === undefined) resolve();
      else reject(error);
    });
  });
}
