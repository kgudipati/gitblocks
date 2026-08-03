import { createHash } from 'node:crypto';

import { beforeAll, describe, expect, it } from 'vitest';

import {
  createRepositoryArtifactSetV1,
  createRepositoryArtifactV1,
  splitRepositoryArtifactLogicalLines,
  type ModelExecutionModelProfileV1,
  type RepositoryArtifactSetEntryV1,
} from '@gitblocks/contracts';

import {
  createOpenAiResponsesRepositoryInterviewProviderV1,
  loadRepositoryInterviewSpecification,
  renderRepositoryInterviewPromptV1,
  type LoadedRepositoryInterviewSpecification,
  type RepositoryInterviewOpenAiAttemptControlPortV1,
  type RepositoryInterviewOpenAiClockPortV1,
  type RepositoryInterviewOpenAiCredentialPortV1,
  type RepositoryInterviewOpenAiFetchV1,
  type RepositoryInterviewOpenAiSleeperPortV1,
  type RepositoryInterviewProviderRequestV1,
} from '../src/index.ts';

const SPECIFICATION_DIRECTORY = 'interviews/repository/specifications/1.0.0';
const AUTHORIZED_MODELS = [
  'gpt-5.4-2026-03-05',
  'gpt-5.4-mini-2026-03-17',
] as const;
const TOKEN = 'synthetic_test_token';
const SENTINEL = 'SENSITIVE_PROVIDER_SENTINEL';

let specification: LoadedRepositoryInterviewSpecification;
let baseRequest: RepositoryInterviewProviderRequestV1;

beforeAll(async () => {
  specification = await loadRepositoryInterviewSpecification(
    SPECIFICATION_DIRECTORY,
  );
  const content = 'synthetic repository evidence';
  const artifact = createArtifact(content);
  const artifactSet = createRepositoryArtifactSetV1({
    contractVersion: '1.0.0',
    candidateId: 'synthetic-openai-adapter-candidate',
    catalogVersion: 'public-v1',
    catalogDigest: 'a'.repeat(64),
    artifactManifestVersion: 'public-artifacts-v1',
    artifactManifestDigest: 'b'.repeat(64),
    collectorVersion: 'repository-artifacts-v1',
    chunkerVersion: 'exact-lines-v1',
    provider: 'github',
    providerRepositoryId: '123456789',
    providerCanonicalOwner: 'synthetic-owner',
    providerCanonicalRepository: 'synthetic-repository',
    gitObjectAlgorithm: 'sha1',
    commitObjectId: '1'.repeat(40),
    entries: [presentEntry(artifact)],
    publishedAt: '2026-07-31T12:00:00.000Z',
  });
  const rendered = renderRepositoryInterviewPromptV1({
    artifactSet,
    artifacts: [artifact],
    specification,
  });
  if (!rendered.ok) {
    throw new Error('Synthetic prompt fixture failed.');
  }
  baseRequest = Object.freeze({
    prompt: rendered.value,
    modelProfile: profile(AUTHORIZED_MODELS[0]),
    providerProjectionVersion: specification.manifest.openAiProjection.version,
    providerProjectionDigest: specification.manifest.openAiProjection.digest,
    providerProjectionText: specification.openAiProjectionSnapshot,
  });
});

describe('OpenAI Responses repository-interview adapter preflight', () => {
  it.each([
    ['provider', 'synthetic'],
    ['endpointProfile', 'other-v1'],
    ['modelSnapshot', 'gpt-5.4'],
    ['store', true],
    ['toolsEnabled', true],
    ['background', true],
    ['conversationState', true],
    ['previousResponseState', true],
    ['truncation', 'auto'],
    ['promptCacheRetention', '24h'],
    ['serviceTier', 'flex'],
    ['retryPolicyVersion', 'other-retry-v1'],
  ])(
    'rejects invalid profile field %s before every effect',
    async (key, value) => {
      const harness = createHarness();
      const request = requestWith({
        modelProfile: { ...baseRequest.modelProfile, [key]: value },
      });
      await expect(harness.provider.execute(request)).rejects.toThrow(
        'OpenAI repository interview provider configuration failed.',
      );
      expectNoEffects(harness);
    },
  );

  it('rejects projection authority drift and malformed projection JSON before every effect', async () => {
    for (const request of [
      requestWith({ providerProjectionVersion: '2.0.0' }),
      requestWith({ providerProjectionDigest: '0'.repeat(64) }),
      requestWith({ providerProjectionText: '{}' }),
      requestWith({
        providerProjectionText: `${baseRequest.providerProjectionText} `,
      }),
    ]) {
      const harness = createHarness();
      await expect(harness.provider.execute(request)).rejects.toThrow(
        'OpenAI repository interview provider configuration failed.',
      );
      expectNoEffects(harness);
    }
  });

  it('rejects an accessor-backed request without invoking the accessor', async () => {
    const harness = createHarness();
    let calls = 0;
    const request = { ...baseRequest } as Record<string, unknown>;
    Object.defineProperty(request, 'modelProfile', {
      enumerable: true,
      get: () => {
        calls += 1;
        throw new Error(SENTINEL);
      },
    });
    await expect(harness.provider.execute(request as never)).rejects.toThrow(
      'OpenAI repository interview provider configuration failed.',
    );
    expect(calls).toBe(0);
    expectNoEffects(harness);
  });

  it('rejects a cloned rendered prompt and preserves the authentic prompt', async () => {
    const harness = createHarness();
    const snapshot = structuredClone(baseRequest.prompt);
    await expect(
      harness.provider.execute(
        requestWith({ prompt: { ...baseRequest.prompt } }),
      ),
    ).rejects.toThrow(
      'OpenAI repository interview provider configuration failed.',
    );
    expectNoEffects(harness);
    expect(baseRequest.prompt).toEqual(snapshot);
  });
});

describe('OpenAI Responses request bytes and credential boundary', () => {
  it.each(AUTHORIZED_MODELS)(
    'sends the exact deterministic request for %s',
    async (model) => {
      const harness = createHarness();
      harness.responses.push(successResponse(model));
      const request = requestWith({ modelProfile: profile(model) });
      const first = await harness.provider.execute(request);
      expect(first.status).toBe('response');
      expect(harness.fetchCalls).toHaveLength(1);
      const call = harness.fetchCalls[0];
      expect(call?.url).toBe('https://api.openai.com/v1/responses');
      expect(call?.init.method).toBe('POST');
      expect(call?.init.redirect).toBe('error');
      const headers = new Headers(call?.init.headers);
      expect([...headers.keys()].sort()).toEqual([
        'accept',
        'authorization',
        'content-type',
      ]);
      expect(headers.get('authorization')).toBe(`Bearer ${TOKEN}`);
      const body = requireBody(call?.init.body);
      const parsed = JSON.parse(body) as Record<string, unknown>;
      expect(Object.keys(parsed)).toEqual([
        'model',
        'input',
        'reasoning',
        'text',
        'max_output_tokens',
        'store',
        'background',
        'stream',
        'tools',
        'truncation',
        'service_tier',
        'prompt_cache_retention',
      ]);
      expect(parsed).toMatchObject({
        model,
        reasoning: { effort: 'low' },
        max_output_tokens: 8_192,
        store: false,
        background: false,
        stream: false,
        tools: [],
        truncation: 'disabled',
        service_tier: 'default',
        prompt_cache_retention: 'in_memory',
      });
      const text = parsed['text'] as Record<string, unknown>;
      const format = text['format'] as Record<string, unknown>;
      const expectedSchema: unknown = JSON.parse(
        specification.openAiProjectionSnapshot,
      );
      expect(format).toEqual({
        type: 'json_schema',
        name: 'repository_interview_v1',
        schema: expectedSchema,
        strict: true,
      });
      expect(parsed).not.toHaveProperty('prompt_cache_options');
      expect(parsed).not.toHaveProperty('prompt_cache_key');
      expect(body).not.toContain('24h');
      expect(body.match(/prompt_cache_retention/gu)).toHaveLength(1);
      expect(parsed['input']).toEqual([
        {
          role: 'developer',
          content: [
            { type: 'input_text', text: baseRequest.prompt.instructionText },
          ],
        },
        {
          role: 'user',
          content: [
            { type: 'input_text', text: baseRequest.prompt.evidenceText },
          ],
        },
      ]);
      expect(body).not.toContain(baseRequest.prompt.candidateId);
      expect(body).not.toContain(baseRequest.prompt.artifactSetId);
      expect(body).not.toContain(baseRequest.prompt.promptDigest);
      expect(harness.credential.calls).toBe(1);
      expect(JSON.stringify(first)).not.toContain(TOKEN);

      const secondHarness = createHarness();
      secondHarness.responses.push(successResponse(model));
      await secondHarness.provider.execute(request);
      expect(requireBody(secondHarness.fetchCalls[0]?.init.body)).toBe(body);
    },
  );

  it.each([
    '',
    'token with space',
    'token\nnewline',
    '\u0000',
    'x'.repeat(1_025),
  ])(
    'rejects an invalid credential without creating an attempt',
    async (token) => {
      const harness = createHarness({ token });
      await expect(harness.provider.execute(baseRequest)).rejects.toThrow(
        'OpenAI repository interview provider configuration failed.',
      );
      expect(harness.credential.calls).toBe(1);
      expect(harness.fetchCalls).toHaveLength(0);
      expect(harness.clock.calls).toBe(0);
      expect(harness.attemptControl.calls).toBe(0);
    },
  );

  it('does not let injected effects override cache retention', async () => {
    const harness = createHarness({ token: 'in_memory_24h_transport_value' });
    harness.responses.push(
      successResponse(AUTHORIZED_MODELS[0], {
        prompt_cache_retention: '24h',
      }),
    );
    await harness.provider.execute(baseRequest);
    const body = requireBody(harness.fetchCalls[0]?.init.body);
    expect(JSON.parse(body)).toHaveProperty(
      'prompt_cache_retention',
      'in_memory',
    );
    expect(body).not.toContain('24h');
  });
});

describe('OpenAI Responses completed output and data minimization', () => {
  it('maps a completed response, ignores reasoning and additive root fields, and freezes owned values', async () => {
    const output = { synthetic: ['value'] };
    const harness = createHarness();
    harness.responses.push(
      response(
        {
          ...completedEnvelope(AUTHORIZED_MODELS[0], output),
          future_optional_property: { ignored: true },
          output: [
            { type: 'reasoning', id: 'reasoning-safe' },
            ...completedEnvelope(AUTHORIZED_MODELS[0], output).output,
          ],
        },
        200,
        {
          'x-request-id': 'req_safe-1',
          'openai-processing-ms': '250',
        },
      ),
    );
    const result = await harness.provider.execute(baseRequest);
    expect(result).toMatchObject({
      status: 'response',
      usage: {
        inputTokens: 10,
        cachedInputTokens: 2,
        outputTokens: 5,
        reasoningTokens: 1,
        totalTokens: 15,
      },
      providerOutput: output,
      providerOutputDiagnosticCode: null,
      attempts: [
        {
          transportOutcome: 'response',
          httpStatus: 200,
          providerRequestId: 'req_safe-1',
          responseId: 'resp_safe-1',
          providerProcessingMilliseconds: 250,
        },
      ],
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.attempts)).toBe(true);
    expect(Object.isFrozen(result.attempts[0])).toBe(true);
    if (result.status === 'response') {
      expect(Object.isFrozen(result.usage)).toBe(true);
      expect(Object.isFrozen(result.providerOutput)).toBe(true);
    }
  });

  it('accepts unsafe opaque identifiers as null without leaking them', async () => {
    const harness = createHarness();
    harness.responses.push(
      response(
        { ...completedEnvelope(AUTHORIZED_MODELS[0]), id: 'https://bad/id' },
        200,
        { 'x-request-id': 'request: unsafe' },
      ),
    );
    const result = await harness.provider.execute(baseRequest);
    expect(result.attempts[0]).toMatchObject({
      providerRequestId: null,
      responseId: null,
    });
    expect(JSON.stringify(result)).not.toContain('https://bad/id');
    expect(JSON.stringify(result)).not.toContain('request: unsafe');
  });

  it('classifies malformed JSON without retaining provider text', async () => {
    const harness = createHarness();
    harness.responses.push(
      completedTextResponse(AUTHORIZED_MODELS[0], '{"unexpected":true}'),
      completedTextResponse(AUTHORIZED_MODELS[0], SENTINEL),
    );
    const first = await harness.provider.execute(baseRequest);
    const second = await harness.provider.execute(baseRequest);
    expect(first).toMatchObject({
      status: 'response',
      providerOutput: { unexpected: true },
      providerOutputDiagnosticCode: null,
    });
    expect(second).toMatchObject({
      status: 'response',
      providerOutput: null,
      providerOutputDiagnosticCode: 'provider-output-json-decoding',
    });
    expect(JSON.stringify(second)).not.toContain(SENTINEL);
  });

  it('classifies decoded JSON that exceeds the owned-data boundary', async () => {
    const harness = createHarness();
    let text = 'null';
    for (let depth = 0; depth < 34; depth += 1) {
      text = `{"value":${text}}`;
    }
    harness.responses.push(completedTextResponse(AUTHORIZED_MODELS[0], text));

    expect(await harness.provider.execute(baseRequest)).toMatchObject({
      status: 'response',
      providerOutput: null,
      providerOutputDiagnosticCode: 'provider-output-json-boundary',
    });
  });

  it.each([
    ['model mismatch', { model: 'other-model-2026-03-05' }],
    ['multiple messages', { output: [message('{}'), message('{}')] }],
    ['tool call', { output: [{ type: 'function_call' }] }],
    ['wrong role', { output: [{ ...message('{}'), role: 'user' }] }],
    [
      'active annotations',
      {
        output: [
          {
            ...message('{}'),
            content: [{ type: 'output_text', text: '{}', annotations: [{}] }],
          },
        ],
      },
    ],
    ['missing output', { output: [] }],
    ['empty output', { output: [message('')] }],
    [
      'mixed refusal and output',
      {
        output: [
          {
            type: 'message',
            role: 'assistant',
            content: [
              { type: 'refusal', refusal: SENTINEL },
              { type: 'output_text', text: '{}', annotations: [] },
            ],
          },
        ],
      },
    ],
    [
      'multiple output texts',
      {
        output: [
          {
            type: 'message',
            role: 'assistant',
            content: [
              { type: 'output_text', text: '{}', annotations: [] },
              { type: 'output_text', text: '{}', annotations: [] },
            ],
          },
        ],
      },
    ],
    ['unknown active item', { output: [{ type: 'future_active_item' }] }],
  ])('maps %s to invalid-response without retry', async (_name, override) => {
    const harness = createHarness();
    harness.responses.push(
      response({ ...completedEnvelope(AUTHORIZED_MODELS[0]), ...override }),
    );
    const result = await harness.provider.execute(baseRequest);
    expect(result).toMatchObject({
      status: 'failed',
      failureCode: 'invalid-response',
    });
    expect(harness.fetchCalls).toHaveLength(1);
  });
});

describe('OpenAI Responses status and usage mapping', () => {
  it.each([
    ['incomplete', {}, 'incomplete'],
    [
      'incomplete',
      { incomplete_details: { reason: 'content_filter' } },
      'safety-interrupted',
    ],
    ['failed', {}, 'provider-error'],
    ['cancelled', {}, 'cancelled'],
    ['queued', {}, 'invalid-response'],
    ['in_progress', {}, 'invalid-response'],
  ])('maps response status %s to %s', async (status, extra, failureCode) => {
    const harness = createHarness();
    harness.responses.push(
      response({
        id: 'resp_safe-1',
        object: 'response',
        model: AUTHORIZED_MODELS[0],
        status,
        output: [],
        ...extra,
      }),
    );
    const result = await harness.provider.execute(baseRequest);
    expect(result).toMatchObject({ status: 'failed', failureCode });
    expect(harness.fetchCalls).toHaveLength(1);
  });

  it('preserves HTTP provenance for provider-envelope cancellation', async () => {
    const envelope = {
      id: 'resp_cancelled-1',
      object: 'response',
      model: AUTHORIZED_MODELS[0],
      status: 'cancelled',
      output: [],
      usage: usage(),
      cancellation_detail: SENTINEL,
    };
    const expectedBytes = Buffer.byteLength(JSON.stringify(envelope));
    const harness = createHarness();
    harness.responses.push(
      response(envelope, 200, {
        'x-request-id': 'req_cancelled-1',
        'openai-processing-ms': '321',
        'x-ratelimit-remaining-requests': '9',
        'x-ratelimit-remaining-tokens': '99',
        'x-ratelimit-reset-requests': '1s',
        'x-ratelimit-reset-tokens': '2s',
      }),
    );

    const result = await harness.provider.execute(baseRequest);

    expect(result).toMatchObject({
      status: 'failed',
      failureCode: 'cancelled',
      usage: {
        inputTokens: 10,
        cachedInputTokens: 2,
        outputTokens: 5,
        reasoningTokens: 1,
        totalTokens: 15,
      },
      attempts: [
        {
          transportOutcome: 'response',
          httpStatus: 200,
          providerRequestId: 'req_cancelled-1',
          responseId: 'resp_cancelled-1',
          responseBytes: expectedBytes,
          providerProcessingMilliseconds: 321,
          remainingRequests: 9,
          remainingTokens: 99,
          resetRequestsMilliseconds: 1_000,
          resetTokensMilliseconds: 2_000,
        },
      ],
    });
    expect(harness.fetchCalls).toHaveLength(1);
    expect(harness.sleeper.delays).toEqual([]);
    expect(JSON.stringify(result)).not.toContain(SENTINEL);

    const external = createHarness();
    external.attemptControl.outcomeSequences = [['cancelled', 'cancelled']];
    external.responses.push(
      successResponse(AUTHORIZED_MODELS[0], {
        late_response: SENTINEL,
      }),
    );
    const externalResult = await external.provider.execute(baseRequest);
    expect(externalResult).toMatchObject({
      status: 'failed',
      failureCode: 'cancelled',
      usage: null,
      attempts: [
        {
          transportOutcome: 'cancelled',
          httpStatus: null,
          providerRequestId: null,
          responseId: null,
          responseBytes: 0,
        },
      ],
    });
    expect(external.fetchCalls).toHaveLength(1);
    expect(external.sleeper.delays).toEqual([]);
    expect(externalResult.attempts[0]).not.toEqual(result.attempts[0]);
    expect(JSON.stringify(externalResult)).not.toContain(SENTINEL);
  });

  it('maps a refusal without retaining refusal text', async () => {
    const harness = createHarness();
    harness.responses.push(
      response({
        ...completedEnvelope(AUTHORIZED_MODELS[0]),
        output: [
          {
            type: 'message',
            role: 'assistant',
            content: [{ type: 'refusal', refusal: SENTINEL }],
          },
        ],
      }),
    );
    const result = await harness.provider.execute(baseRequest);
    expect(result).toMatchObject({ status: 'failed', failureCode: 'refused' });
    expect(JSON.stringify(result)).not.toContain(SENTINEL);
  });

  it.each([
    ['missing usage', undefined],
    ['negative input', usage({ input_tokens: -1 })],
    [
      'cached exceeds input',
      usage({ input_tokens_details: { cached_tokens: 11 } }),
    ],
    [
      'reasoning exceeds output',
      usage({ output_tokens_details: { reasoning_tokens: 6 } }),
    ],
    ['incorrect total', usage({ total_tokens: 99 })],
    ['unsafe integer', usage({ total_tokens: Number.MAX_SAFE_INTEGER + 1 })],
  ])(
    'maps %s to invalid-usage without inspecting output or retrying',
    async (_name, invalidUsage) => {
      const harness = createHarness();
      const body: Record<string, unknown> = {
        ...completedEnvelope(AUTHORIZED_MODELS[0]),
        output: [{ type: 'function_call', sentinel: SENTINEL }],
      };
      if (invalidUsage === undefined) {
        delete body['usage'];
      } else {
        body['usage'] = invalidUsage;
      }
      harness.responses.push(response(body));
      const result = await harness.provider.execute(baseRequest);
      expect(result).toMatchObject({
        status: 'failed',
        failureCode: 'invalid-usage',
        usage: null,
      });
      expect(harness.fetchCalls).toHaveLength(1);
      expect(JSON.stringify(result)).not.toContain(SENTINEL);
    },
  );

  it('accepts exact zero usage', async () => {
    const harness = createHarness();
    harness.responses.push(
      response({
        ...completedEnvelope(AUTHORIZED_MODELS[0]),
        usage: usage({
          input_tokens: 0,
          input_tokens_details: { cached_tokens: 0 },
          output_tokens: 0,
          output_tokens_details: { reasoning_tokens: 0 },
          total_tokens: 0,
        }),
      }),
    );
    const result = await harness.provider.execute(baseRequest);
    expect(result).toMatchObject({
      status: 'response',
      usage: {
        inputTokens: 0,
        cachedInputTokens: 0,
        outputTokens: 0,
        reasoningTokens: 0,
        totalTokens: 0,
      },
    });
  });
});

describe('OpenAI Responses HTTP, retry, and attempt closure', () => {
  it.each([
    [401, {}, 'not-authorized', 1],
    [403, {}, 'not-authorized', 1],
    [402, {}, 'quota-exceeded', 1],
    [
      429,
      { error: { code: 'insufficient_quota', message: SENTINEL } },
      'quota-exceeded',
      1,
    ],
    [400, { error: { message: SENTINEL } }, 'provider-error', 1],
  ])('maps HTTP %i safely', async (status, body, failureCode, calls) => {
    const harness = createHarness();
    harness.responses.push(response(body, status));
    const result = await harness.provider.execute(baseRequest);
    expect(result).toMatchObject({ status: 'failed', failureCode });
    expect(harness.fetchCalls).toHaveLength(calls);
    expect(JSON.stringify(result)).not.toContain(SENTINEL);
  });

  it.each([
    [408, 'provider-error'],
    [409, 'provider-error'],
    [429, 'rate-limited'],
    [500, 'provider-error'],
    [599, 'provider-error'],
  ])('retries HTTP %i exactly once and then succeeds', async (status) => {
    const harness = createHarness();
    harness.responses.push(
      response({}, status, { 'retry-after': '1' }),
      successResponse(AUTHORIZED_MODELS[0]),
    );
    const result = await harness.provider.execute(baseRequest);
    expect(result.status).toBe('response');
    expect(result.attempts).toHaveLength(2);
    expect(result.attempts.map((attempt) => attempt.ordinal)).toEqual([1, 2]);
    expect(harness.fetchCalls).toHaveLength(2);
    expect(harness.sleeper.delays).toEqual([1_000]);
  });

  it('never begins a third attempt after two retryable failures', async () => {
    const harness = createHarness();
    harness.responses.push(response({}, 500), response({}, 500));
    const result = await harness.provider.execute(baseRequest);
    expect(result).toMatchObject({
      status: 'failed',
      failureCode: 'provider-error',
    });
    expect(result.attempts.map((attempt) => attempt.ordinal)).toEqual([1, 2]);
    expect(harness.fetchCalls).toHaveLength(2);
    expect(harness.attemptControl.calls).toBe(2);
    expect(harness.sleeper.delays).toEqual([1_000]);
  });

  it.each([
    ['network-error', 'completed'],
    ['deadline-exceeded', 'deadline-exceeded'],
  ] as const)(
    'retries %s exactly once and then succeeds',
    async (_name, outcome) => {
      const harness = createHarness();
      harness.attemptControl.outcomes = [outcome, 'completed'];
      harness.responses.push(
        new Error(SENTINEL),
        successResponse(AUTHORIZED_MODELS[0]),
      );
      const result = await harness.provider.execute(baseRequest);
      expect(result.status).toBe('response');
      expect(result.attempts).toHaveLength(2);
      expect(harness.sleeper.delays).toEqual([1_000]);
      expect(JSON.stringify(result)).not.toContain(SENTINEL);
    },
  );

  it('does not retry external cancellation', async () => {
    const harness = createHarness();
    harness.attemptControl.outcomes = ['cancelled'];
    harness.responses.push(new Error(SENTINEL));
    const result = await harness.provider.execute(baseRequest);
    expect(result).toMatchObject({
      status: 'failed',
      failureCode: 'cancelled',
    });
    expect(harness.fetchCalls).toHaveLength(1);
    expect(harness.sleeper.delays).toEqual([]);
  });

  it('lets attempt deadline authority discard a late successful response and retry once', async () => {
    const harness = createHarness();
    harness.attemptControl.outcomeSequences = [
      ['deadline-exceeded', 'deadline-exceeded'],
      ['completed', 'completed'],
    ];
    harness.responses.push(
      successResponse(AUTHORIZED_MODELS[0], { late_response: SENTINEL }),
      successResponse(AUTHORIZED_MODELS[0]),
    );

    const result = await harness.provider.execute(baseRequest);

    expect(result.status).toBe('response');
    expect(result.attempts[0]).toMatchObject({
      transportOutcome: 'deadline-exceeded',
      httpStatus: null,
      providerRequestId: null,
      responseId: null,
      responseBytes: 0,
    });
    expect(harness.fetchCalls).toHaveLength(2);
    expect(harness.sleeper.delays).toEqual([1_000]);
    expect(JSON.stringify(result)).not.toContain(SENTINEL);
  });

  it('lets attempt cancellation authority discard a late successful response without retry', async () => {
    const harness = createHarness();
    harness.attemptControl.outcomeSequences = [['cancelled', 'cancelled']];
    harness.responses.push(
      successResponse(AUTHORIZED_MODELS[0], { late_response: SENTINEL }),
    );

    const result = await harness.provider.execute(baseRequest);

    expect(result).toMatchObject({
      status: 'failed',
      failureCode: 'cancelled',
      usage: null,
      attempts: [
        {
          transportOutcome: 'cancelled',
          httpStatus: null,
          providerRequestId: null,
          responseId: null,
          responseBytes: 0,
        },
      ],
    });
    expect(harness.fetchCalls).toHaveLength(1);
    expect(harness.sleeper.delays).toEqual([]);
    expect(JSON.stringify(result)).not.toContain(SENTINEL);
  });

  it.each(['deadline-exceeded', 'cancelled'] as const)(
    'lets a final %s outcome override a response parsed after body settlement',
    async (finalOutcome) => {
      const harness = createHarness();
      harness.attemptControl.outcomeSequences = [['completed', finalOutcome]];
      if (finalOutcome === 'deadline-exceeded') {
        harness.clock.setNextIncrement(181_000);
      }
      harness.responses.push(
        successResponse(AUTHORIZED_MODELS[0], {
          parsed_late_response: SENTINEL,
        }),
      );

      const result = await harness.provider.execute(baseRequest);

      expect(result).toMatchObject({
        status: 'failed',
        failureCode: finalOutcome,
        usage: null,
        attempts: [
          {
            transportOutcome: finalOutcome,
            httpStatus: null,
            providerRequestId: null,
            responseId: null,
            responseBytes: 0,
          },
        ],
      });
      expect(harness.attemptControl.outcomeCalls).toEqual([2]);
      expect(harness.fetchCalls).toHaveLength(1);
      expect(harness.sleeper.delays).toEqual([]);
      expect(JSON.stringify(result)).not.toContain(SENTINEL);
    },
  );

  it('rejects invalid or throwing attempt-outcome authority with a value-free error', async () => {
    for (const outcome of ['invalid-outcome', new Error(SENTINEL)]) {
      const harness = createHarness();
      harness.attemptControl.outcomeSequences = [[outcome]];
      harness.responses.push(successResponse(AUTHORIZED_MODELS[0]));
      let message = '';
      try {
        await harness.provider.execute(baseRequest);
      } catch (error) {
        message = error instanceof Error ? error.message : String(error);
      }
      expect(message).toBe(
        'OpenAI repository interview provider operation failed.',
      );
      expect(message).not.toContain(SENTINEL);
      expect(harness.attemptControl.outcomeCalls[0]).toBe(1);
    }
  });

  it('rejects a contradictory terminal attempt outcome with a value-free error', async () => {
    const harness = createHarness();
    harness.attemptControl.outcomeSequences = [
      ['deadline-exceeded', 'completed'],
    ];
    harness.responses.push(successResponse(AUTHORIZED_MODELS[0]));

    await expect(harness.provider.execute(baseRequest)).rejects.toThrow(
      'OpenAI repository interview provider operation failed.',
    );
    expect(harness.attemptControl.outcomeCalls).toEqual([2]);
  });

  it('uses capped Retry-After and safe rate-limit metadata only', async () => {
    const harness = createHarness();
    harness.responses.push(
      response({}, 429, {
        'retry-after': '999',
        'x-ratelimit-remaining-requests': '12',
        'x-ratelimit-remaining-tokens': '34',
        'x-ratelimit-reset-requests': '250ms',
        'x-ratelimit-reset-tokens': '1m30s',
        'x-unapproved-sentinel': SENTINEL,
      }),
      successResponse(AUTHORIZED_MODELS[0]),
    );
    const result = await harness.provider.execute(baseRequest);
    expect(result.attempts[0]).toMatchObject({
      retryAfterMilliseconds: 30_000,
      remainingRequests: 12,
      remainingTokens: 34,
      resetRequestsMilliseconds: 250,
      resetTokensMilliseconds: 90_000,
    });
    expect(harness.sleeper.delays).toEqual([30_000]);
    expect(JSON.stringify(result)).not.toContain(SENTINEL);
  });

  it('parses HTTP-date Retry-After and falls back for an invalid value', async () => {
    const dated = createHarness();
    dated.responses.push(
      response({}, 429, { 'retry-after': 'Fri, 31 Jul 2026 12:00:01 GMT' }),
      successResponse(AUTHORIZED_MODELS[0]),
    );
    const datedResult = await dated.provider.execute(baseRequest);
    expect(datedResult.attempts[0]?.retryAfterMilliseconds).toBe(990);
    expect(dated.sleeper.delays).toEqual([990]);

    const invalid = createHarness();
    invalid.responses.push(
      response({}, 500, { 'retry-after': '-1' }),
      successResponse(AUTHORIZED_MODELS[0]),
    );
    const invalidResult = await invalid.provider.execute(baseRequest);
    expect(invalidResult.attempts[0]?.retryAfterMilliseconds).toBeNull();
    expect(invalid.sleeper.delays).toEqual([1_000]);

    for (const retryAfter of [
      '2026-07-31T12:00:01Z',
      'Thu, 31 Jul 2026 12:00:01 GMT',
      'Fri, 32 Jul 2026 12:00:01 GMT',
    ]) {
      const malformed = createHarness();
      malformed.responses.push(
        response({}, 500, { 'retry-after': retryAfter }),
        successResponse(AUTHORIZED_MODELS[0]),
      );
      const result = await malformed.provider.execute(baseRequest);
      expect(result.attempts[0]?.retryAfterMilliseconds).toBeNull();
      expect(malformed.sleeper.delays).toEqual([1_000]);
    }
  });

  it('does not begin a second attempt outside the total deadline', async () => {
    const harness = createHarness();
    harness.clock.setNextIncrement(181_000);
    harness.responses.push(
      response({}, 500),
      successResponse(AUTHORIZED_MODELS[0]),
    );
    const result = await harness.provider.execute(baseRequest);
    expect(result).toMatchObject({
      status: 'failed',
      failureCode: 'provider-error',
    });
    expect(harness.fetchCalls).toHaveLength(1);
    expect(harness.sleeper.delays).toEqual([]);
  });

  it('rechecks the total deadline after retry sleep at the exact attempt-budget boundary', async () => {
    const exact = createHarness();
    exact.sleeper.advanceOverride = 179_970;
    exact.responses.push(
      response({}, 500, { 'retry-after': '0' }),
      successResponse(AUTHORIZED_MODELS[0]),
    );
    const exactResult = await exact.provider.execute(baseRequest);
    expect(exactResult.status).toBe('response');
    expect(exact.fetchCalls).toHaveLength(2);
    expect(exact.attemptControl.calls).toBe(2);
    expect(exact.sleeper.delays).toEqual([0]);
    expect(exactResult.attempts[1]?.startedAt).toBe('2026-07-31T12:03:00.000Z');

    const short = createHarness();
    short.sleeper.advanceOverride = 179_971;
    short.responses.push(
      response({}, 500, { 'retry-after': '0' }),
      successResponse(AUTHORIZED_MODELS[0]),
    );
    const shortResult = await short.provider.execute(baseRequest);
    expect(shortResult).toMatchObject({
      status: 'failed',
      failureCode: 'provider-error',
    });
    expect(short.fetchCalls).toHaveLength(1);
    expect(short.attemptControl.calls).toBe(1);
    expect(short.sleeper.delays).toEqual([0]);
    expect(short.clock.calls).toBeGreaterThanOrEqual(4);
  });

  it('does not let retry-sleep overshoot start a second attempt', async () => {
    const harness = createHarness();
    harness.sleeper.advanceOverride = 300_000;
    harness.responses.push(
      response({}, 500),
      successResponse(AUTHORIZED_MODELS[0]),
    );

    const result = await harness.provider.execute(baseRequest);

    expect(result).toMatchObject({
      status: 'failed',
      failureCode: 'provider-error',
    });
    expect(harness.fetchCalls).toHaveLength(1);
    expect(harness.attemptControl.calls).toBe(1);
    expect(harness.sleeper.delays).toEqual([1_000]);
    expect(result.attempts).toHaveLength(1);
  });

  it('maps retry-sleep failure to the fixed value-free operation error', async () => {
    const harness = createHarness();
    harness.sleeper.failure = new Error(SENTINEL);
    harness.responses.push(response({}, 500));

    let message = '';
    try {
      await harness.provider.execute(baseRequest);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toBe(
      'OpenAI repository interview provider operation failed.',
    );
    expect(message).not.toContain(SENTINEL);
    expect(harness.fetchCalls).toHaveLength(1);
    expect(harness.attemptControl.calls).toBe(1);
  });

  it('timestamps completion after protocol interpretation and keeps retry attempts nonoverlapping', async () => {
    const harness = createHarness();
    harness.responses.push(
      response({}, 500),
      response({
        id: 'resp_cancelled-chronology',
        object: 'response',
        model: AUTHORIZED_MODELS[0],
        status: 'cancelled',
        output: [],
      }),
    );

    const result = await harness.provider.execute(baseRequest);

    expect(result).toMatchObject({
      status: 'failed',
      failureCode: 'cancelled',
      attempts: [
        { completedAt: '2026-07-31T12:00:00.020Z' },
        {
          startedAt: '2026-07-31T12:00:01.030Z',
          completedAt: '2026-07-31T12:00:01.050Z',
          transportOutcome: 'response',
        },
      ],
    });
    expect(
      Date.parse(result.attempts[1]?.startedAt ?? '') >=
        Date.parse(result.attempts[0]?.completedAt ?? ''),
    ).toBe(true);
    expect(harness.attemptControl.outcomeCalls).toEqual([2, 2]);
  });

  it('parses controlled reset units and nulls malformed safe headers', async () => {
    const harness = createHarness();
    harness.responses.push(
      response(completedEnvelope(AUTHORIZED_MODELS[0]), 200, {
        'openai-processing-ms': '+1',
        'x-ratelimit-remaining-requests': '01',
        'x-ratelimit-remaining-tokens': '9007199254740992',
        'x-ratelimit-reset-requests': '1s',
        'x-ratelimit-reset-tokens': '2h',
      }),
    );
    const result = await harness.provider.execute(baseRequest);
    expect(result.attempts[0]).toMatchObject({
      providerProcessingMilliseconds: null,
      remainingRequests: null,
      remainingTokens: null,
      resetRequestsMilliseconds: 1_000,
      resetTokensMilliseconds: 7_200_000,
    });
  });
});

describe('OpenAI Responses body bounds and offline behavior', () => {
  it('cancels a pending response reader before retrying an attempt deadline', async () => {
    const pending = pendingResponse();
    const harness = createHarness();
    pending.onCancel = () => {
      pending.fetchCallsAtCancel = harness.fetchCalls.length;
    };
    harness.attemptControl.outcomeSequences = [
      ['deadline-exceeded', 'deadline-exceeded'],
      ['completed', 'completed'],
    ];
    harness.responses.push(
      pending.response,
      successResponse(AUTHORIZED_MODELS[0]),
    );

    const execution = harness.provider.execute(baseRequest);
    await pending.readStarted;
    harness.attemptControl.abort(0);
    const result = await execution;

    expect(result.status).toBe('response');
    expect(result.attempts[0]).toMatchObject({
      transportOutcome: 'deadline-exceeded',
      httpStatus: null,
      providerRequestId: null,
      responseId: null,
      responseBytes: 0,
    });
    expect(pending.cancelCalls).toBe(1);
    expect(pending.fetchCallsAtCancel).toBe(1);
    expect(pending.response.body?.locked).toBe(false);
    expect(harness.fetchCalls).toHaveLength(2);
    expect(JSON.stringify(result)).not.toContain(SENTINEL);
  });

  it('cancels a pending response reader for external cancellation without retrying', async () => {
    const pending = pendingResponse({ lateChunkAfterCancel: true });
    const harness = createHarness();
    harness.attemptControl.outcomeSequences = [['cancelled', 'cancelled']];
    harness.responses.push(pending.response);

    const execution = harness.provider.execute(baseRequest);
    await pending.readStarted;
    harness.attemptControl.abort(0);
    const result = await execution;
    await pending.lateChunkSettled;

    expect(result).toMatchObject({
      status: 'failed',
      failureCode: 'cancelled',
      usage: null,
      attempts: [
        {
          transportOutcome: 'cancelled',
          httpStatus: null,
          providerRequestId: null,
          responseId: null,
          responseBytes: 0,
        },
      ],
    });
    expect(pending.cancelCalls).toBe(1);
    expect(pending.response.body?.locked).toBe(false);
    expect(harness.fetchCalls).toHaveLength(1);
    expect(harness.sleeper.delays).toEqual([]);
    expect(pending.lateChunkAttempts).toBe(1);
    expect(JSON.stringify(result)).not.toContain(SENTINEL);
  });

  it.each(['deadline-exceeded', 'cancelled'] as const)(
    'preserves %s when pending-reader cancellation rejects',
    async (outcome) => {
      const pending = pendingResponse({ cancelFailure: new Error(SENTINEL) });
      const harness = createHarness();
      harness.attemptControl.outcomeSequences = [[outcome, outcome]];
      if (outcome === 'deadline-exceeded') {
        harness.attemptControl.outcomeSequences.push([
          'completed',
          'completed',
        ]);
        harness.responses.push(
          pending.response,
          successResponse(AUTHORIZED_MODELS[0]),
        );
      } else {
        harness.responses.push(pending.response);
      }

      const execution = harness.provider.execute(baseRequest);
      await pending.readStarted;
      harness.attemptControl.abort(0);
      const result = await execution;

      expect(result.attempts[0]).toMatchObject({
        transportOutcome: outcome,
        httpStatus: null,
        responseBytes: 0,
      });
      expect(pending.cancelCalls).toBe(1);
      expect(pending.response.body?.locked).toBe(false);
      expect(harness.fetchCalls).toHaveLength(
        outcome === 'deadline-exceeded' ? 2 : 1,
      );
      expect(harness.sleeper.delays).toEqual(
        outcome === 'deadline-exceeded' ? [1_000] : [],
      );
      expect(JSON.stringify(result)).not.toContain(SENTINEL);
    },
  );

  it('cancels and releases the reader after an independent read failure', async () => {
    const failedRead = failedReaderResponse();
    const harness = createHarness();
    harness.responses.push(
      failedRead.response,
      successResponse(AUTHORIZED_MODELS[0]),
    );

    const result = await harness.provider.execute(baseRequest);

    expect(result.status).toBe('response');
    expect(result.attempts[0]).toMatchObject({
      transportOutcome: 'network-error',
      httpStatus: null,
      responseBytes: 0,
    });
    expect(failedRead.cancelCalls).toBe(1);
    expect(failedRead.releaseCalls).toBe(1);
    expect(harness.fetchCalls).toHaveLength(2);
    expect(JSON.stringify(result)).not.toContain(SENTINEL);
  });

  it('cancels an invalid reader chunk without exposing its value', async () => {
    const invalidChunk = invalidChunkReaderResponse();
    const harness = createHarness();
    harness.responses.push(
      invalidChunk.response,
      successResponse(AUTHORIZED_MODELS[0]),
    );

    const result = await harness.provider.execute(baseRequest);

    expect(result.status).toBe('response');
    expect(result.attempts[0]).toMatchObject({
      transportOutcome: 'network-error',
      responseBytes: 0,
    });
    expect(invalidChunk.cancelCalls).toBe(1);
    expect(invalidChunk.releaseCalls).toBe(1);
    expect(JSON.stringify(result)).not.toContain(SENTINEL);
  });

  it('cancels once when the signal is already aborted before the first read', async () => {
    const pending = pendingResponse();
    const harness = createHarness();
    harness.attemptControl.outcomeSequences = [['cancelled', 'cancelled']];
    harness.attemptControl.abortOnBegin = [true];
    harness.responses.push(pending.response);

    const result = await harness.provider.execute(baseRequest);

    expect(result).toMatchObject({
      status: 'failed',
      failureCode: 'cancelled',
      attempts: [{ transportOutcome: 'cancelled', responseBytes: 0 }],
    });
    expect(pending.readCalls).toBe(0);
    expect(pending.cancelCalls).toBe(1);
    expect(pending.response.body?.locked).toBe(false);
    expect(harness.fetchCalls).toHaveLength(1);
  });

  it('settles once and cancels once when read rejection races with abort', async () => {
    const racing = controllableReaderResponse();
    const harness = createHarness();
    harness.attemptControl.outcomeSequences = [['cancelled', 'cancelled']];
    harness.responses.push(racing.response);

    const execution = harness.provider.execute(baseRequest);
    await racing.readStarted;
    harness.attemptControl.abort(0);
    racing.rejectRead(new Error(SENTINEL));
    const result = await execution;

    expect(result).toMatchObject({
      status: 'failed',
      failureCode: 'cancelled',
      attempts: [{ transportOutcome: 'cancelled', responseBytes: 0 }],
    });
    expect(racing.cancelCalls).toBe(1);
    expect(racing.releaseCalls).toBe(1);
    expect(harness.fetchCalls).toHaveLength(1);
    expect(JSON.stringify(result)).not.toContain(SENTINEL);
  });

  it('discards a completed chunk when its read races with abort', async () => {
    const racing = controllableReaderResponse();
    const harness = createHarness();
    harness.attemptControl.outcomeSequences = [['cancelled', 'cancelled']];
    harness.responses.push(racing.response);

    const execution = harness.provider.execute(baseRequest);
    await racing.readStarted;
    racing.resolveRead({
      done: false,
      value: new TextEncoder().encode(SENTINEL),
    });
    harness.attemptControl.abort(0);
    const result = await execution;

    expect(result).toMatchObject({
      status: 'failed',
      failureCode: 'cancelled',
      attempts: [{ transportOutcome: 'cancelled', responseBytes: 0 }],
    });
    expect(racing.cancelCalls).toBe(1);
    expect(racing.releaseCalls).toBe(1);
    expect(harness.fetchCalls).toHaveLength(1);
    expect(JSON.stringify(result)).not.toContain(SENTINEL);
  });

  it('rejects a declared oversized body without buffering or retrying', async () => {
    const harness = createHarness();
    let pulled = 0;
    let cancelled = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += 1;
        controller.enqueue(new TextEncoder().encode(SENTINEL));
        controller.close();
      },
      cancel() {
        cancelled += 1;
      },
    });
    harness.responses.push(
      new Response(body, {
        status: 200,
        headers: { 'content-length': '1001' },
      }),
    );
    const result = await harness.provider.execute(
      requestWith({
        modelProfile: profile(AUTHORIZED_MODELS[0], {
          maximumResponseBytes: 1_000,
        }),
      }),
    );
    expect(result).toMatchObject({
      status: 'failed',
      failureCode: 'response-too-large',
      attempts: [{ responseBytes: 0 }],
    });
    expect(pulled).toBeLessThanOrEqual(1);
    expect(cancelled).toBe(1);
    expect(harness.fetchCalls).toHaveLength(1);
    expect(JSON.stringify(result)).not.toContain(SENTINEL);
  });

  it('stops a chunked body at the exact limit and rejects invalid UTF-8', async () => {
    const oversizedHarness = createHarness();
    let overflowCancellations = 0;
    oversizedHarness.responses.push(
      chunkedResponse([new Uint8Array(8), new Uint8Array(8)], () => {
        overflowCancellations += 1;
      }),
    );
    const oversized = await oversizedHarness.provider.execute(
      requestWith({
        modelProfile: profile(AUTHORIZED_MODELS[0], {
          maximumResponseBytes: 10,
        }),
      }),
    );
    expect(oversized).toMatchObject({
      status: 'failed',
      failureCode: 'response-too-large',
      attempts: [{ responseBytes: 10 }],
    });
    expect(overflowCancellations).toBe(1);

    const utf8Harness = createHarness();
    utf8Harness.responses.push(chunkedResponse([new Uint8Array([0xff])]));
    const invalidUtf8 = await utf8Harness.provider.execute(baseRequest);
    expect(invalidUtf8).toMatchObject({
      status: 'failed',
      failureCode: 'invalid-response',
    });
  });

  it('accepts a valid JSON body exactly at the profile byte limit', async () => {
    const maximumResponseBytes = 1_024;
    const envelope = completedEnvelope(AUTHORIZED_MODELS[0]);
    const empty = JSON.stringify({ ...envelope, padding: '' });
    const text = JSON.stringify({
      ...envelope,
      padding: 'x'.repeat(maximumResponseBytes - Buffer.byteLength(empty)),
    });
    expect(Buffer.byteLength(text)).toBe(maximumResponseBytes);
    const harness = createHarness();
    harness.responses.push(
      new Response(text, {
        status: 200,
        headers: { 'content-length': String(maximumResponseBytes) },
      }),
    );
    const result = await harness.provider.execute(
      requestWith({
        modelProfile: profile(AUTHORIZED_MODELS[0], {
          maximumResponseBytes,
        }),
      }),
    );
    expect(result).toMatchObject({
      status: 'response',
      attempts: [{ responseBytes: maximumResponseBytes }],
    });
  });

  it('does not cancel a completely consumed valid response', async () => {
    let cancellations = 0;
    const harness = createHarness();
    harness.responses.push(
      chunkedResponse(
        [
          new TextEncoder().encode(
            JSON.stringify(completedEnvelope(AUTHORIZED_MODELS[0])),
          ),
        ],
        () => {
          cancellations += 1;
        },
      ),
    );

    const result = await harness.provider.execute(baseRequest);

    expect(result.status).toBe('response');
    expect(cancellations).toBe(0);
  });

  it('constructs without effects and never falls back to global fetch', () => {
    const harness = createHarness();
    expectNoEffects(harness);
  });
});

interface FetchCall {
  readonly url: string;
  readonly init: RequestInit;
}

function createHarness(options: { readonly token?: string } = {}) {
  const fetchCalls: FetchCall[] = [];
  const responses: (Response | Error)[] = [];
  const credential: RepositoryInterviewOpenAiCredentialPortV1 & {
    calls: number;
  } = {
    calls: 0,
    getBearerToken() {
      this.calls += 1;
      return Promise.resolve(options.token ?? TOKEN);
    },
  };
  const fetch: RepositoryInterviewOpenAiFetchV1 = (url, init) => {
    fetchCalls.push({ url, init });
    const next = responses.shift();
    if (next instanceof Error) {
      return Promise.reject(next);
    }
    if (next === undefined) {
      return Promise.reject(new Error('No synthetic response configured.'));
    }
    return Promise.resolve(next);
  };
  const clock = new FakeClock();
  const sleeper: RepositoryInterviewOpenAiSleeperPortV1 & {
    delays: number[];
    advanceOverride: number | null;
    failure: Error | null;
  } = {
    delays: [],
    advanceOverride: null,
    failure: null,
    sleep(milliseconds) {
      this.delays.push(milliseconds);
      if (this.failure !== null) {
        return Promise.reject(this.failure);
      }
      clock.advance(this.advanceOverride ?? milliseconds);
      return Promise.resolve();
    },
  };
  const attemptControl = new FakeAttemptControl();
  const provider = createOpenAiResponsesRepositoryInterviewProviderV1({
    credential,
    fetch,
    clock,
    sleeper,
    attemptControl,
  });
  return {
    provider,
    credential,
    fetchCalls,
    responses,
    clock,
    sleeper,
    attemptControl,
  };
}

class FakeClock implements RepositoryInterviewOpenAiClockPortV1 {
  public calls = 0;
  private milliseconds = Date.parse('2026-07-31T12:00:00.000Z');
  private nextIncrement = 10;

  public now() {
    const value = {
      timestamp: new Date(this.milliseconds).toISOString(),
      monotonicMilliseconds:
        this.milliseconds - Date.parse('2026-07-31T12:00:00.000Z'),
    };
    this.calls += 1;
    this.milliseconds += this.nextIncrement;
    this.nextIncrement = 10;
    return value;
  }

  public advance(milliseconds: number): void {
    this.milliseconds += milliseconds;
  }

  public setNextIncrement(milliseconds: number): void {
    this.nextIncrement = milliseconds;
  }
}

class FakeAttemptControl implements RepositoryInterviewOpenAiAttemptControlPortV1 {
  public calls = 0;
  public outcomes: ('completed' | 'deadline-exceeded' | 'cancelled')[] = [];
  public outcomeSequences: unknown[][] = [];
  public outcomeCalls: number[] = [];
  public abortOnBegin: boolean[] = [];
  private readonly controllers: AbortController[] = [];

  public beginAttempt() {
    const attemptIndex = this.calls;
    const outcome = this.outcomes[attemptIndex] ?? 'completed';
    const sequence = this.outcomeSequences[attemptIndex] ?? [outcome];
    this.calls += 1;
    const controller = new AbortController();
    this.controllers[attemptIndex] = controller;
    if (this.abortOnBegin[attemptIndex] === true) {
      controller.abort();
    }
    let outcomeIndex = 0;
    return {
      signal: controller.signal,
      outcome: () => {
        this.outcomeCalls[attemptIndex] =
          (this.outcomeCalls[attemptIndex] ?? 0) + 1;
        const next = sequence[Math.min(outcomeIndex, sequence.length - 1)];
        outcomeIndex += 1;
        if (next instanceof Error) {
          throw next;
        }
        return next as 'completed' | 'deadline-exceeded' | 'cancelled';
      },
      dispose: () => undefined,
    };
  }

  public abort(attemptIndex: number): void {
    this.controllers[attemptIndex]?.abort();
  }
}

function requestWith(
  overrides: Partial<RepositoryInterviewProviderRequestV1>,
): RepositoryInterviewProviderRequestV1 {
  return Object.freeze({ ...baseRequest, ...overrides });
}

function profile(
  modelSnapshot: (typeof AUTHORIZED_MODELS)[number],
  overrides: Partial<ModelExecutionModelProfileV1> = {},
): ModelExecutionModelProfileV1 {
  return {
    provider: 'openai',
    endpointProfile: 'responses-v1',
    modelSnapshot,
    providerProjectionVersion: specification.manifest.openAiProjection.version,
    providerProjectionDigest: specification.manifest.openAiProjection.digest,
    reasoningEffort: 'low',
    maximumOutputTokens: 8_192,
    maximumResponseBytes: 2_097_152,
    store: false,
    toolsEnabled: false,
    background: false,
    conversationState: false,
    previousResponseState: false,
    truncation: 'disabled',
    promptCacheRetention: 'in-memory',
    serviceTier: 'default',
    retryPolicyVersion: 'repository-interview-retry-v1',
    ...overrides,
  };
}

function successResponse(
  model: string,
  extra: Record<string, unknown> = {},
): Response {
  return response({ ...completedEnvelope(model), ...extra });
}

function completedTextResponse(model: string, text: string): Response {
  return response({
    ...completedEnvelope(model),
    output: [message(text)],
  });
}

function completedEnvelope(
  model: string,
  output: unknown = { synthetic: 'output' },
) {
  return {
    id: 'resp_safe-1',
    object: 'response',
    model,
    status: 'completed',
    output: [message(JSON.stringify(output))],
    usage: usage(),
  };
}

function message(text: string) {
  return {
    type: 'message',
    role: 'assistant',
    content: [{ type: 'output_text', text, annotations: [] }],
  };
}

function usage(overrides: Record<string, unknown> = {}) {
  return {
    input_tokens: 10,
    input_tokens_details: { cached_tokens: 2 },
    output_tokens: 5,
    output_tokens_details: { reasoning_tokens: 1 },
    total_tokens: 15,
    ...overrides,
  };
}

function response(
  value: unknown,
  status = 200,
  headers: ConstructorParameters<typeof Headers>[0] = {},
): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set('content-type', 'application/json');
  return new Response(JSON.stringify(value), {
    status,
    headers: responseHeaders,
  });
}

function chunkedResponse(
  chunks: readonly Uint8Array[],
  onReaderCancel: () => void = () => undefined,
): Response {
  let index = 0;
  const response = new Response(
    new ReadableStream<Uint8Array>({
      pull(controller) {
        const chunk = chunks[index];
        index += 1;
        if (chunk === undefined) {
          controller.close();
        } else {
          controller.enqueue(chunk);
        }
      },
    }),
    { status: 200 },
  );
  const body = response.body;
  if (body === null) {
    throw new Error('Synthetic chunked response body is absent.');
  }
  const getReader = body.getReader.bind(body);
  Object.defineProperty(body, 'getReader', {
    value: () => {
      const reader = getReader();
      const cancel = reader.cancel.bind(reader);
      Object.defineProperty(reader, 'cancel', {
        value: () => {
          onReaderCancel();
          return cancel();
        },
      });
      return reader;
    },
  });
  return response;
}

interface PendingResponse {
  readonly response: Response;
  readonly readStarted: Promise<void>;
  readonly lateChunkSettled: Promise<void>;
  readCalls: number;
  cancelCalls: number;
  lateChunkAttempts: number;
  fetchCallsAtCancel: number | null;
  onCancel: () => void;
}

function pendingResponse(
  options: {
    readonly cancelFailure?: Error;
    readonly lateChunkAfterCancel?: boolean;
  } = {},
): PendingResponse {
  let resolveReadStarted: () => void = () => undefined;
  let resolveLateChunkSettled: () => void = () => undefined;
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  const state: PendingResponse = {
    response: undefined as unknown as Response,
    readStarted: new Promise<void>((resolve) => {
      resolveReadStarted = resolve;
    }),
    lateChunkSettled: new Promise<void>((resolve) => {
      resolveLateChunkSettled = resolve;
    }),
    readCalls: 0,
    cancelCalls: 0,
    lateChunkAttempts: 0,
    fetchCallsAtCancel: null,
    onCancel: () => undefined,
  };
  const stream = new ReadableStream<Uint8Array>({
    start(value) {
      controller = value;
      if (options.lateChunkAfterCancel !== true) {
        resolveLateChunkSettled();
      }
    },
    pull() {
      return new Promise<void>(() => undefined);
    },
    cancel() {
      state.cancelCalls += 1;
      state.onCancel();
      if (options.lateChunkAfterCancel === true) {
        queueMicrotask(() => {
          state.lateChunkAttempts += 1;
          try {
            controller?.enqueue(new TextEncoder().encode(SENTINEL));
          } catch {
            // The attempted late chunk must remain outside adapter ownership.
          }
          resolveLateChunkSettled();
        });
      }
      if (options.cancelFailure !== undefined) {
        return Promise.reject(options.cancelFailure);
      }
      return undefined;
    },
  });
  const response = new Response(stream, { status: 200 });
  const body = response.body;
  if (body === null) {
    throw new Error('Synthetic pending response body is absent.');
  }
  const getReader = body.getReader.bind(body);
  Object.defineProperty(body, 'getReader', {
    value: () => {
      const reader = getReader();
      const read = reader.read.bind(reader);
      Object.defineProperty(reader, 'read', {
        value: () => {
          state.readCalls += 1;
          resolveReadStarted();
          return read();
        },
      });
      return reader;
    },
  });
  Object.defineProperty(state, 'response', { value: response });
  return state;
}

function failedReaderResponse(): {
  readonly response: Response;
  readonly cancelCalls: number;
  readonly releaseCalls: number;
} {
  return syntheticReaderResponse(() => Promise.reject(new Error(SENTINEL)));
}

function invalidChunkReaderResponse(): {
  readonly response: Response;
  readonly cancelCalls: number;
  readonly releaseCalls: number;
} {
  return syntheticReaderResponse(() =>
    Promise.resolve({ done: false, value: SENTINEL }),
  );
}

function controllableReaderResponse(): {
  readonly response: Response;
  readonly readStarted: Promise<void>;
  readonly cancelCalls: number;
  readonly releaseCalls: number;
  resolveRead(result: {
    readonly done: boolean;
    readonly value: unknown;
  }): void;
  rejectRead(error: Error): void;
} {
  let settleRead: (result: {
    readonly done: boolean;
    readonly value: unknown;
  }) => void = () => undefined;
  let rejectRead: (error: Error) => void = () => undefined;
  let resolveReadStarted: () => void = () => undefined;
  const readStarted = new Promise<void>((resolve) => {
    resolveReadStarted = resolve;
  });
  const result = syntheticReaderResponse(
    () =>
      new Promise((resolve, reject) => {
        settleRead = resolve;
        rejectRead = reject;
        resolveReadStarted();
      }),
  );
  return {
    response: result.response,
    readStarted,
    get cancelCalls() {
      return result.cancelCalls;
    },
    get releaseCalls() {
      return result.releaseCalls;
    },
    resolveRead(value) {
      settleRead(value);
    },
    rejectRead(error) {
      rejectRead(error);
    },
  };
}

function syntheticReaderResponse(
  read: () => Promise<{ readonly done: boolean; readonly value: unknown }>,
): {
  readonly response: Response;
  readonly cancelCalls: number;
  readonly releaseCalls: number;
} {
  const state = {
    cancelCalls: 0,
    releaseCalls: 0,
  };
  const reader = {
    read,
    cancel() {
      state.cancelCalls += 1;
      return Promise.resolve();
    },
    releaseLock() {
      state.releaseCalls += 1;
    },
  };
  const response = {
    body: {
      getReader() {
        return reader;
      },
    },
    headers: new Headers(),
    status: 200,
  } as unknown as Response;
  return {
    response,
    get cancelCalls() {
      return state.cancelCalls;
    },
    get releaseCalls() {
      return state.releaseCalls;
    },
  };
}

function requireBody(body: RequestInit['body']): string {
  if (typeof body !== 'string') {
    throw new Error('Synthetic request body is absent.');
  }
  return body;
}

function expectNoEffects(harness: ReturnType<typeof createHarness>): void {
  expect(harness.credential.calls).toBe(0);
  expect(harness.fetchCalls).toHaveLength(0);
  expect(harness.clock.calls).toBe(0);
  expect(harness.sleeper.delays).toHaveLength(0);
  expect(harness.attemptControl.calls).toBe(0);
}

function createArtifact(content: string) {
  const bytes = Buffer.from(content, 'utf8');
  const blobObjectId = createHash('sha1')
    .update(`blob ${String(bytes.byteLength)}\0`, 'utf8')
    .update(bytes)
    .digest('hex');
  return createRepositoryArtifactV1({
    contractVersion: '1.0.0',
    candidateId: 'synthetic-openai-adapter-candidate',
    provider: 'github',
    providerRepositoryId: '123456789',
    gitObjectAlgorithm: 'sha1',
    commitObjectId: '1'.repeat(40),
    path: 'README.md',
    blobObjectId,
    blobApiUrl: `https://api.github.com/repositories/123456789/git/blobs/${blobObjectId}`,
    displayUrl: `https://github.com/synthetic-owner/synthetic-repository/blob/${'1'.repeat(40)}/README.md`,
    mediaType: 'text/plain',
    encoding: 'utf-8',
    contentSha256: createHash('sha256').update(content).digest('hex'),
    byteCount: bytes.byteLength,
    lineCount: splitRepositoryArtifactLogicalLines(content).length,
    content,
    firstMaterialization: {
      catalogOwner: 'synthetic-owner',
      catalogRepository: 'synthetic-repository',
      providerOwner: 'synthetic-owner',
      providerRepository: 'synthetic-repository',
      collectedAt: '2026-07-31T11:59:00.000Z',
    },
  });
}

function presentEntry(
  artifact: ReturnType<typeof createArtifact>,
): RepositoryArtifactSetEntryV1 {
  return {
    selectionId: `selection-${'1'.repeat(48)}`,
    ordinal: 0,
    selector: 'root-readme',
    artifactKind: 'readme',
    requirement: 'optional',
    rationale: null,
    requestedPath: null,
    resolvedPath: artifact.path,
    outcome: 'present',
    artifactId: artifact.artifactId,
  };
}
