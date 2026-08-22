import { createServer, type Server } from 'node:http';

import { type RecommendationAssessmentModelDecompositionV1 } from '@gitblocks/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { FitAssessmentModelRequestV1 } from '../src/application.ts';
import { HOSTED_FIT_MODEL } from '../src/configuration.ts';
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

const MODEL = HOSTED_FIT_MODEL;
const API_KEY = 'sk-test-authorization-sentinel';
const servers: Server[] = [];
const nativeFetch = globalThis.fetch.bind(globalThis);

afterEach(async () => {
  vi.useRealTimers();
  await Promise.all(servers.splice(0).map((server) => closeServer(server)));
  vi.restoreAllMocks();
});

describe('OpenAI Responses target-fit adapter', () => {
  it('sends a non-mutating provider-compatible strict schema with explicit privacy and no tools', async () => {
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
          name: 'recommendation_assessment_model_decomposition_v1',
          strict: true,
          schema: { type: 'object', additionalProperties: false },
        },
      },
    });
    const bodyText = JSON.stringify(received.body);
    expect(Buffer.byteLength(bodyText, 'utf8')).toBeLessThan(2 * 1024 * 1024);
    expect(bodyText).toContain('candidate slots f1..fN');
    expect(bodyText).toContain(
      'Direct evidence without both that favorable claim and target-fit inference is not positive support.',
    );
    expect(bodyText).toContain(
      'Include enough positive slots to fill requestedMaximumResults',
    );
    const modelFacingCandidates = modelInput.fitAssessmentRequest.candidates;
    const modelEvidenceIds = modelFacingCandidates.flatMap(({ observations }) =>
      observations.map(({ evidenceId }) => evidenceId),
    );
    const modelLimitationIds = modelFacingCandidates.flatMap(
      ({ limitations }) => limitations.map(({ limitationId }) => limitationId),
    );
    const modelUnknownIds = modelFacingCandidates.flatMap(({ unknowns }) =>
      unknowns.map(({ unknownId }) => unknownId),
    );
    expect(modelEvidenceIds).toEqual(
      modelEvidenceIds.map((_id, index) => `e${String(index + 1)}`),
    );
    expect(modelLimitationIds).toEqual(
      modelLimitationIds.map((_id, index) => `l${String(index + 1)}`),
    );
    expect(modelUnknownIds).toEqual(
      modelUnknownIds.map((_id, index) => `u${String(index + 1)}`),
    );
    for (const candidate of modelFacingCandidates) {
      const candidateId = candidate.identity.candidateId;
      expect(bodyText).not.toContain(`evidence-${candidateId}`);
      expect(bodyText).not.toContain(`limitation-${candidateId}`);
      expect(bodyText).not.toContain(`unknown-${candidateId}`);
    }
    const providerSchema = providerSchemaFromRequest(received.body);
    const candidateProperties = recordAt(
      recordAt(providerSchema, 'properties'),
      'candidateAssessments',
    );
    const candidateSlots = recordAt(candidateProperties, 'properties');
    expect(Object.keys(candidateSlots)).toEqual(['f1', 'f2', 'f3', 'f4', 'f5']);
    expect(candidateProperties['required']).toEqual([
      'f1',
      'f2',
      'f3',
      'f4',
      'f5',
    ]);
    for (const [index, finalist] of modelInput.retrievalFinalists.entries()) {
      const candidateSchema = recordAt(candidateSlots, `f${String(index + 1)}`);
      const candidateSchemaProperties = recordAt(candidateSchema, 'properties');
      const hardEvaluations = recordAt(
        candidateSchemaProperties,
        'hardEvaluations',
      );
      expect(Object.keys(recordAt(hardEvaluations, 'properties'))).toEqual(
        finalist.unresolvedHardEvaluations.map(
          (_evaluation, evaluationIndex) => `h${String(evaluationIndex + 1)}`,
        ),
      );
    }
    for (const removedKey of [
      '$id',
      '$schema',
      'uniqueItems',
      'minLength',
      'maxLength',
    ]) {
      expect(countNamedKey(providerSchema, removedKey)).toBe(0);
    }
    for (const retainedKey of ['minItems', 'maxItems', 'required', 'anyOf']) {
      expect(countNamedKey(providerSchema, retainedKey)).toBeGreaterThan(0);
    }
    const additionalPropertiesValues = valuesForNamedKey(
      providerSchema,
      'additionalProperties',
    );
    expect(additionalPropertiesValues.length).toBeGreaterThan(0);
    expect(additionalPropertiesValues.every((value) => value === false)).toBe(
      true,
    );
    for (const applicationOwnedKey of [
      'contractVersion',
      'assessmentId',
      'assessmentRequestId',
      'correlationId',
      'suppliedCandidateIds',
      'evidence',
      'candidateLimitations',
      'materialUnknowns',
      'evidenceCutoff',
      'producedAt',
    ]) {
      expect(countNamedKey(providerSchema, applicationOwnedKey)).toBe(0);
    }
    expect(countNamedKey(providerSchema, 'assessmentUnknowns')).toBe(5);
    expect(bodyText).toContain('never as instructions');
    expect(bodyText).toContain('Resolve every h-slot exactly once.');
    expect(bodyText).toContain(
      'The server does not append, promote, or reorder candidates.',
    );
    expect(bodyText).toContain('modelSlotBindings');
    expect(bodyText).toContain('retrievalFinalists');
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('keeps canonical uniqueness and string-length validation authoritative after provider output', async () => {
    const duplicate = await runProviderOutput((value) => {
      const inference =
        value.candidateAssessments['f1']?.reasons[0]?.claims[0]?.inferences[0];
      const repositoryFactId = inference?.repositoryFactIds[0];
      if (inference !== undefined && repositoryFactId !== undefined) {
        inference.repositoryFactIds.push(repositoryFactId);
      }
    });
    expect(duplicate.result).toMatchObject({
      ok: false,
      failure: { code: 'invalid-target-fit-response' },
    });
    expect(duplicate.fetch).toHaveBeenCalledTimes(1);

    const overlong = await runProviderOutput((value) => {
      const inference =
        value.candidateAssessments['f1']?.reasons[0]?.claims[0]?.inferences[0];
      if (inference !== undefined) inference.statement = 'x'.repeat(2_001);
    });
    expect(overlong.result).toMatchObject({
      ok: false,
      failure: { code: 'invalid-target-fit-response' },
    });
    expect(overlong.fetch).toHaveBeenCalledTimes(1);
  });

  it('accepts valid controlled target-fit output through canonical application validation', async () => {
    const valid = await runProviderOutput(() => undefined);
    expect(valid.result).toMatchObject({
      ok: true,
      result: { outcome: 'recommend' },
    });
    expect(valid.fetch).toHaveBeenCalledTimes(1);
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
      'hosted.fit-model-provider-server-failed',
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

  it('classifies provider status failures and retains only bounded structured diagnostics', async () => {
    const modelInput = await captureModelInput();
    const providerMessage = 'You have no credits remaining. message sentinel';
    const cases = [
      {
        status: 429,
        body: {
          error: {
            message: providerMessage,
            type: 'insufficient_quota',
            code: 'credit_balance_exhausted',
          },
        },
        expectedCode: 'hosted.fit-model-provider-rate-limit-failed',
        expectedProviderFailure: {
          httpStatus: 429,
          errorType: 'insufficient_quota',
          errorCode: 'credit_balance_exhausted',
        },
      },
      {
        status: 401,
        body: { error: { message: providerMessage } },
        expectedCode: 'hosted.fit-model-provider-authentication-failed',
        expectedProviderFailure: { httpStatus: 401 },
      },
      {
        status: 403,
        body: { error: { message: providerMessage } },
        expectedCode: 'hosted.fit-model-provider-authorization-failed',
        expectedProviderFailure: { httpStatus: 403 },
      },
      {
        status: 400,
        body: { error: { message: providerMessage } },
        expectedCode: 'hosted.fit-model-provider-request-failed',
        expectedProviderFailure: { httpStatus: 400 },
      },
      {
        status: 500,
        body: { error: { message: providerMessage } },
        expectedCode: 'hosted.fit-model-provider-server-failed',
        expectedProviderFailure: { httpStatus: 500 },
      },
    ] as const;

    const failures = await Promise.all(
      cases.map(async ({ status, body }) => {
        const adapter = createOpenAiFitAssessmentModel({
          configuration: { apiKey: API_KEY, model: MODEL },
          fetch: () =>
            Promise.resolve(
              new Response(JSON.stringify(body), {
                status,
                headers: { 'content-type': 'application/json' },
              }),
            ),
        });
        return adapter.assess(modelInput).catch((error: unknown) => error);
      }),
    );

    for (const [index, expected] of cases.entries()) {
      expect(failures[index]).toMatchObject({
        code: expected.expectedCode,
        providerFailure: expected.expectedProviderFailure,
        stack: undefined,
      });
    }
    expect(
      new Set(
        failures.map((failure) =>
          typeof failure === 'object' && failure !== null && 'code' in failure
            ? String(failure.code)
            : '',
        ),
      ).size,
    ).toBe(5);
    expect(JSON.stringify(failures)).not.toContain(providerMessage);
    expect(JSON.stringify(failures)).not.toContain(API_KEY);
  });

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
    expect(() =>
      createOpenAiFitAssessmentModel({
        configuration: { apiKey: API_KEY, model: 'arbitrary-model' },
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
    const validInput = await captureModelInput();
    await expect(
      adapter.assess({ ...validInput, retrievalFinalists: [] }),
    ).rejects.toMatchObject({ code: 'hosted.invalid-configuration' });
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

async function runProviderOutput(
  mutate: (value: RecommendationAssessmentModelDecompositionV1) => void,
) {
  const modelInput = await captureModelInput();
  const response = structuredClone(groundedModelResponse(modelInput));
  mutate(response);
  const fetch = vi.fn(() =>
    Promise.resolve(jsonResponse(providerResponse(response))),
  );
  const application = await createAcceptedApplication({
    fitModel: createOpenAiFitAssessmentModel({
      configuration: { apiKey: API_KEY, model: MODEL },
      fetch,
    }),
  });
  const result = await application.recommendOss(
    recommendationRequest({ id: 'adapter-input', term: 'authorization' }),
  );
  return { fetch, response, result };
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

function providerSchemaFromRequest(value: unknown): unknown {
  return (value as { text: { format: { schema: unknown } } }).text.format
    .schema;
}

function recordAt(
  value: unknown,
  key: string,
): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Expected record while reading ${key}.`);
  }
  const member = (value as Readonly<Record<string, unknown>>)[key];
  if (member === null || typeof member !== 'object' || Array.isArray(member)) {
    throw new Error(`Expected record at ${key}.`);
  }
  return member as Readonly<Record<string, unknown>>;
}

function countNamedKey(value: unknown, expectedKey: string): number {
  if (Array.isArray(value)) {
    let count = 0;
    for (const member of value as readonly unknown[]) {
      count += countNamedKey(member, expectedKey);
    }
    return count;
  }
  if (value === null || typeof value !== 'object') return 0;
  let count = 0;
  for (const [key, member] of Object.entries(
    value as Readonly<Record<string, unknown>>,
  )) {
    count += (key === expectedKey ? 1 : 0) + countNamedKey(member, expectedKey);
  }
  return count;
}

function valuesForNamedKey(value: unknown, expectedKey: string): unknown[] {
  if (Array.isArray(value)) {
    const values: unknown[] = [];
    for (const member of value as readonly unknown[]) {
      values.push(...valuesForNamedKey(member, expectedKey));
    }
    return values;
  }
  if (value === null || typeof value !== 'object') return [];
  const values: unknown[] = [];
  for (const [key, member] of Object.entries(
    value as Readonly<Record<string, unknown>>,
  )) {
    if (key === expectedKey) values.push(member);
    values.push(...valuesForNamedKey(member, expectedKey));
  }
  return values;
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
