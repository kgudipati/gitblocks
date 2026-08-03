import { createHash } from 'node:crypto';

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createRepositoryArtifactSetV1,
  createRepositoryArtifactV1,
  parseModelExecutionModelProfileV1,
  splitRepositoryArtifactLogicalLines,
  validateRepositoryInterviewExecutionV1,
  type ModelExecutionAttemptV1,
  type ModelExecutionModelProfileV1,
  type ModelExecutionUsageV1,
  type RepositoryArtifactSetEntryV1,
  type RepositoryArtifactSetV1,
  type RepositoryArtifactV1,
} from '@gitblocks/contracts';

import {
  executeRepositoryInterviewV1,
  loadRepositoryInterviewSpecification,
  type ExecuteRepositoryInterviewInputV1,
  type ExecuteRepositoryInterviewResultV1,
  type LoadedRepositoryInterviewSpecification,
  type RepositoryInterviewClockPortV1,
  type RepositoryInterviewNoncePortV1,
  type RepositoryInterviewProviderEffectResultV1,
  type RepositoryInterviewProviderPortV1,
  type RepositoryInterviewProviderRequestV1,
  type RepositoryInterviewPublicationCommandV1,
  type RepositoryInterviewPublicationResultV1,
  type RepositoryInterviewRecordPortV1,
  type RepositoryInterviewReusableBundleV1,
  type RepositoryInterviewReuseLookupV1,
} from '../src/index.ts';
import * as repositoryInterviewMapping from '../src/repository-interview-mapping.ts';
import * as repositoryInterviewPrompt from '../src/repository-interview-prompt.ts';

const SPECIFICATION_DIRECTORY = 'interviews/repository/specifications/1.0.0';
const COMMIT = '1'.repeat(40);
const CANDIDATE_ID = 'synthetic-application-candidate';
const REPOSITORY_ID = '123456789';
const PROVIDER_OWNER = 'synthetic-owner';
const PROVIDER_REPOSITORY = 'synthetic-repository';
const STARTED_AT = '2026-07-30T12:00:00.000Z';
const COMPLETED_AT = '2026-07-30T12:00:01.000Z';
const PUBLISHED_AT = '2026-07-30T12:00:02.000Z';
const PROVIDER_SENTINEL = 'untrusted-provider-value-sentinel';

interface SyntheticContext {
  readonly artifactSet: RepositoryArtifactSetV1;
  readonly artifacts: readonly RepositoryArtifactV1[];
}

let specification: LoadedRepositoryInterviewSpecification;

beforeAll(async () => {
  specification = await loadRepositoryInterviewSpecification(
    SPECIFICATION_DIRECTORY,
  );
});

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('repository interview application input and effects', () => {
  it.each([
    'prompt',
    'instructionText',
    'evidenceText',
    'aliasBindings',
    'promptDigest',
    'requestId',
    'executionId',
    'interviewId',
    'executionNonce',
    'candidateId',
    'artifactSetIdentityDigest',
    'providerOutputDigest',
    'publishedAt',
    'providerOutput',
    'attempts',
    'usage',
  ])(
    'rejects the caller-supplied field %s before every effect',
    async (field) => {
      const harness = createHarness();
      const result = await executeRepositoryInterviewV1(
        { ...applicationInput(), [field]: PROVIDER_SENTINEL },
        harness.ports,
      );
      expect(result).toMatchObject({
        ok: false,
        issues: [{ code: 'application-input-invalid' }],
      });
      expectNoEffects(harness);
      expect(JSON.stringify(result)).not.toContain(PROVIDER_SENTINEL);
    },
  );

  it('rejects invalid artifact context before every effect', async () => {
    const harness = createHarness();
    const input = applicationInput();
    const result = await executeRepositoryInterviewV1(
      { ...input, artifacts: [] },
      harness.ports,
    );
    expect(result).toMatchObject({
      ok: false,
      issues: [{ code: 'prompt-render-failed' }],
    });
    expectNoEffects(harness);
  });

  it('converts exotic artifact arrays to value-free prompt failures before every effect', async () => {
    const sentinel = 'EXOTIC_APPLICATION_ARRAY_SENTINEL';
    let accessorCalls = 0;
    const accessorArray: unknown[] = [];
    Object.defineProperty(accessorArray, '0', {
      configurable: true,
      enumerable: true,
      get: () => {
        accessorCalls += 1;
        return sentinel;
      },
    });
    const throwingAccessorArray: unknown[] = [];
    Object.defineProperty(throwingAccessorArray, '0', {
      configurable: true,
      enumerable: true,
      get: () => {
        accessorCalls += 1;
        throw new Error(sentinel);
      },
    });
    const sparseArray = new Array<unknown>(1);
    const nonEnumerableEntryArray: unknown[] = [];
    Object.defineProperty(nonEnumerableEntryArray, '0', {
      configurable: true,
      enumerable: false,
      value: sentinel,
      writable: true,
    });
    const extraPropertyArray: unknown[] = [];
    Object.defineProperty(extraPropertyArray, 'unexpected', {
      configurable: true,
      enumerable: true,
      value: sentinel,
      writable: true,
    });
    const symbolPropertyArray: unknown[] = [];
    Object.defineProperty(symbolPropertyArray, Symbol('unexpected'), {
      configurable: true,
      enumerable: true,
      value: sentinel,
      writable: true,
    });
    const nonstandardPrototypeArray: unknown[] = [];
    Object.setPrototypeOf(nonstandardPrototypeArray, null);
    const throwingReflectionProxy = new Proxy([] as unknown[], {
      ownKeys: () => {
        throw new Error(sentinel);
      },
    });

    for (const artifacts of [
      accessorArray,
      throwingAccessorArray,
      sparseArray,
      nonEnumerableEntryArray,
      extraPropertyArray,
      symbolPropertyArray,
      nonstandardPrototypeArray,
      throwingReflectionProxy,
    ]) {
      const harness = createHarness();
      const result = await executeRepositoryInterviewV1(
        { ...applicationInput(), artifacts },
        harness.ports,
      );
      expect(result).toMatchObject({
        ok: false,
        issues: [{ code: 'prompt-render-failed' }],
      });
      expectNoEffects(harness);
      expect(JSON.stringify(result)).not.toContain(sentinel);
    }
    expect(accessorCalls).toBe(0);
  });

  it('catches an unexpected renderer exception before every effect', async () => {
    const harness = createHarness();
    vi.spyOn(
      repositoryInterviewPrompt,
      'renderRepositoryInterviewPromptV1',
    ).mockImplementationOnce(() => {
      throw new Error(PROVIDER_SENTINEL);
    });
    const result = await executeRepositoryInterviewV1(
      applicationInput(),
      harness.ports,
    );
    expect(result).toMatchObject({
      ok: false,
      issues: [{ code: 'prompt-render-failed' }],
    });
    expectNoEffects(harness);
    expect(JSON.stringify(result)).not.toContain(PROVIDER_SENTINEL);
  });

  it('rejects invalid specification before every effect', async () => {
    const harness = createHarness();
    const input = applicationInput();
    const result = await executeRepositoryInterviewV1(
      {
        ...input,
        specification: {
          ...specification,
          instructions: `${specification.instructions}\nmutation`,
        },
      },
      harness.ports,
    );
    expect(result).toMatchObject({
      ok: false,
      issues: [{ code: 'prompt-render-failed' }],
    });
    expectNoEffects(harness);
  });

  it('rejects an invalid or projection-mismatched profile before every effect', async () => {
    for (const modelProfile of [
      { ...profile(), modelSnapshot: 'moving-alias' },
      { ...profile(), providerProjectionDigest: '0'.repeat(64) },
    ]) {
      const harness = createHarness();
      const result = await executeRepositoryInterviewV1(
        { ...applicationInput(), modelProfile },
        harness.ports,
      );
      expect(result).toMatchObject({
        ok: false,
        issues: [{ code: 'model-profile-invalid' }],
      });
      expectNoEffects(harness);
    }
  });

  it('parses a nested model profile without creating another schema root', () => {
    expect(parseModelExecutionModelProfileV1(profile())).toMatchObject({
      ok: true,
      value: profile(),
      issues: [],
    });
    expect(
      parseModelExecutionModelProfileV1({
        ...profile(),
        unexpected: true,
      }),
    ).toMatchObject({ ok: false });
  });
});

describe('exact rendered prompt identity', () => {
  it('renders once and passes one exact frozen prompt to provider and resolver', async () => {
    const harness = createHarness();
    const renderSpy = vi.spyOn(
      repositoryInterviewPrompt,
      'renderRepositoryInterviewPromptV1',
    );
    const resolveSpy = vi.spyOn(
      repositoryInterviewMapping,
      'resolveRepositoryInterviewProviderOutputV1',
    );

    const result = await executeRepositoryInterviewV1(
      applicationInput(),
      harness.ports,
    );
    expect(result).toMatchObject({ ok: true, disposition: 'created' });
    expect(renderSpy).toHaveBeenCalledTimes(1);
    expect(harness.provider.requests).toHaveLength(1);
    expect(resolveSpy).toHaveBeenCalledTimes(1);

    const providerPrompt = harness.provider.requests[0]?.prompt;
    const resolverPrompt = resolveSpy.mock.calls[0]?.[0].prompt;
    expect(providerPrompt).toBeDefined();
    expect(providerPrompt).toBe(resolverPrompt);
    expect(Object.isFrozen(providerPrompt)).toBe(true);
    expect(Object.isFrozen(providerPrompt?.aliasBindings)).toBe(true);
    expect(providerPrompt?.instructionText).toBe(
      resolverPrompt?.instructionText,
    );
    expect(providerPrompt?.evidenceText).toBe(resolverPrompt?.evidenceText);
    expect(Object.keys(harness.provider.requests[0] ?? {}).sort()).toEqual([
      'modelProfile',
      'prompt',
      'providerProjectionDigest',
      'providerProjectionText',
      'providerProjectionVersion',
    ]);
    expect(harness.provider.requests[0]).toMatchObject({
      providerProjectionVersion:
        specification.manifest.openAiProjection.version,
      providerProjectionDigest: specification.manifest.openAiProjection.digest,
      providerProjectionText: specification.openAiProjectionSnapshot,
    });
    expect(Object.keys(harness.record.publications[0] ?? {}).sort()).toEqual([
      'execution',
      'interview',
      'request',
    ]);
    expect(harness.record.publications[0]).not.toHaveProperty('prompt');
    expect(JSON.stringify(harness.record.publications[0])).not.toContain(
      'instructionText',
    );
    expect(JSON.stringify(harness.record.publications[0])).not.toContain(
      'aliasBindings',
    );
  });

  it('rejects a provider-returned replacement prompt', async () => {
    const harness = createHarness();
    harness.provider.result = {
      ...responseEffect(),
      prompt: Object.freeze({ promptDigest: '0'.repeat(64) }),
    } as unknown as RepositoryInterviewProviderEffectResultV1;
    const result = await executeRepositoryInterviewV1(
      applicationInput(),
      harness.ports,
    );
    expect(result).toMatchObject({
      ok: false,
      issues: [{ code: 'provider-port-failure' }],
    });
    expect(harness.record.publications).toHaveLength(0);
  });

  it('keeps the exact prompt unchanged after a fake provider mutation attempt', async () => {
    const harness = createHarness();
    harness.provider.mutatePrompt = true;
    const result = expectCompleted(
      await executeRepositoryInterviewV1(applicationInput(), harness.ports),
    );
    expect(result.disposition).toBe('created');
    expect(harness.provider.mutationFailed).toBe(true);
    expect(harness.provider.requests[0]?.prompt.promptDigest).toBe(
      result.request.promptDigest,
    );
  });

  it('owns reviewed specification authority before the first asynchronous effect', async () => {
    const harness = createHarness();
    const mutableSpecification = structuredClone(specification);
    harness.record.onLookup = () => {
      (
        mutableSpecification as {
          openAiProjectionSnapshot: string;
        }
      ).openAiProjectionSnapshot = PROVIDER_SENTINEL;
    };
    const result = expectCompleted(
      await executeRepositoryInterviewV1(
        applicationInput({ specification: mutableSpecification }),
        harness.ports,
      ),
    );
    expect(result.disposition).toBe('created');
    expect(harness.provider.requests[0]?.providerProjectionText).toBe(
      specification.openAiProjectionSnapshot,
    );
    expect(harness.provider.requests[0]?.providerProjectionText).not.toContain(
      PROVIDER_SENTINEL,
    );
  });
});

describe('normal reuse and forced execution', () => {
  it('creates deterministic request/reuse authority and reuses a valid bundle without effects', async () => {
    const first = createHarness();
    const created = expectCompleted(
      await executeRepositoryInterviewV1(applicationInput(), first.ports),
    );
    expect(created.disposition).toBe('created');
    if (created.interview === null) {
      throw new Error('Expected a synthetic interview.');
    }

    const second = createHarness();
    second.record.reusable = {
      request: created.request,
      execution: created.execution,
      interview: created.interview,
    };
    const reused = expectCompleted(
      await executeRepositoryInterviewV1(applicationInput(), second.ports),
    );
    expect(reused).toEqual({ ...created, disposition: 'reused' });
    expect(second.record.lookups).toEqual([
      {
        requestIdentityDigest: created.request.identityDigest,
        modelProfileDigest: created.execution.modelProfileDigest,
        reuseKeyDigest: created.execution.reuseKeyDigest,
      },
    ]);
    expect(second.provider.requests).toHaveLength(0);
    expect(second.nonce.calls).toBe(0);
    expect(second.clock.calls).toBe(0);
    expect(second.record.publications).toHaveLength(0);
  });

  it.each([
    'request',
    'model-profile',
    'reuse-key',
    'failed-execution',
    'interview',
  ])(
    'fails closed for a poisoned reusable %s without provider fallback',
    async (kind) => {
      const seed = createHarness();
      const created = expectCompleted(
        await executeRepositoryInterviewV1(applicationInput(), seed.ports),
      );
      if (created.interview === null) {
        throw new Error('Expected a synthetic interview.');
      }
      const poisoned = structuredClone({
        request: created.request,
        execution: created.execution,
        interview: created.interview,
      }) as Record<string, unknown>;
      if (kind === 'request') {
        (poisoned['request'] as Record<string, unknown>)['promptDigest'] =
          '0'.repeat(64);
      } else if (kind === 'model-profile') {
        (poisoned['execution'] as Record<string, unknown>)[
          'modelProfileDigest'
        ] = '0'.repeat(64);
      } else if (kind === 'reuse-key') {
        (poisoned['execution'] as Record<string, unknown>)['reuseKeyDigest'] =
          '0'.repeat(64);
      } else if (kind === 'failed-execution') {
        (poisoned['execution'] as Record<string, unknown>)['outcome'] = {
          status: 'failed',
          failureCode: 'provider-error',
          providerOutputDigest: null,
          usage: null,
        };
      } else {
        (poisoned['interview'] as Record<string, unknown>)['candidateId'] =
          'different-candidate';
      }

      const harness = createHarness();
      harness.record.reusable =
        poisoned as unknown as RepositoryInterviewReusableBundleV1;
      const result = await executeRepositoryInterviewV1(
        applicationInput(),
        harness.ports,
      );
      expect(result).toMatchObject({
        ok: false,
        issues: [{ code: 'reuse-record-invalid' }],
      });
      expect(harness.provider.requests).toHaveLength(0);
      expect(harness.nonce.calls).toBe(0);
      expect(harness.record.publications).toHaveLength(0);
    },
  );

  it('forces a new execution, skips reuse, retains the reuse key, and preserves prior records', async () => {
    const seed = createHarness();
    const prior = expectCompleted(
      await executeRepositoryInterviewV1(applicationInput(), seed.ports),
    );
    if (prior.interview === null) {
      throw new Error('Expected a synthetic interview.');
    }
    const priorSnapshot = structuredClone(prior);

    const forced = createHarness();
    forced.record.reusable = {
      request: prior.request,
      execution: prior.execution,
      interview: prior.interview,
    };
    forced.nonce.values = ['2'.repeat(32)];
    const result = expectCompleted(
      await executeRepositoryInterviewV1(
        {
          ...applicationInput(),
          executionMode: 'forced',
          forceReason: 'calibration',
        },
        forced.ports,
      ),
    );
    expect(result.disposition).toBe('created');
    expect(forced.record.lookups).toHaveLength(0);
    expect(forced.nonce.calls).toBe(1);
    expect(forced.provider.requests).toHaveLength(1);
    expect(result.execution.executionNonce).toBe('2'.repeat(32));
    expect(result.execution.executionId).not.toBe(prior.execution.executionId);
    expect(result.execution.reuseKeyDigest).toBe(
      prior.execution.reuseKeyDigest,
    );
    expect(result.execution.forceReason).toBe('calibration');
    expect(prior).toEqual(priorSnapshot);
  });
});

describe('provider responses, failures, and publication', () => {
  it('creates and publishes one complete five-family exchange', async () => {
    const harness = createHarness();
    harness.provider.result = responseEffect(allFamilyProviderOutput());
    const result = expectCompleted(
      await executeRepositoryInterviewV1(applicationInput(), harness.ports),
    );
    expect(result.disposition).toBe('created');
    expect(result.execution.outcome.status).toBe('succeeded');
    expect(result.interview).not.toBeNull();
    if (result.interview === null) {
      throw new Error('Expected a synthetic interview.');
    }
    expect(
      result.interview.claims.some(({ kind }) => kind === 'inference'),
    ).toBe(true);
    expect(result.interview.limitations).toHaveLength(1);
    expect(result.interview.contradictions).toHaveLength(1);
    expect(result.interview.unknowns).toHaveLength(1);
    expect(result.interview.citations).toHaveLength(8);
    expect(
      validateRepositoryInterviewExecutionV1(
        result.request,
        result.execution,
        result.interview,
      ),
    ).toMatchObject({ ok: true, issues: [] });
    expect(Date.parse(result.interview.publishedAt)).toBeGreaterThanOrEqual(
      Date.parse(result.execution.completedAt),
    );
    expect(harness.record.publications).toHaveLength(1);
    expect(Object.isFrozen(result.request)).toBe(true);
    expect(Object.isFrozen(result.execution)).toBe(true);
    expect(Object.isFrozen(result.interview)).toBe(true);
  });

  it('represents created and validated idempotent publication dispositions', async () => {
    const createdHarness = createHarness();
    expect(
      expectCompleted(
        await executeRepositoryInterviewV1(
          applicationInput(),
          createdHarness.ports,
        ),
      ).disposition,
    ).toBe('created');

    const idempotentHarness = createHarness();
    idempotentHarness.record.publicationResultFactory = (command) => ({
      status: 'idempotent',
      record: command,
    });
    expect(
      expectCompleted(
        await executeRepositoryInterviewV1(
          applicationInput(),
          idempotentHarness.ports,
        ),
      ).disposition,
    ).toBe('idempotent');
    expect(idempotentHarness.record.publications).toHaveLength(1);
  });

  it('fails closed when an idempotent publication returns different record digests', async () => {
    const harness = createHarness();
    harness.record.publicationResultFactory = (command) => ({
      status: 'idempotent',
      record: {
        ...command,
        request: {
          ...command.request,
          recordDigest: '0'.repeat(64),
        },
      },
    });
    expect(
      await executeRepositoryInterviewV1(applicationInput(), harness.ports),
    ).toMatchObject({
      ok: false,
      issues: [{ code: 'record-port-failure' }],
    });
  });

  it('accepts publication exactly at execution completion', async () => {
    const harness = createHarness();
    harness.clock.value = COMPLETED_AT;
    const result = expectCompleted(
      await executeRepositoryInterviewV1(applicationInput(), harness.ports),
    );
    expect(result.interview?.publishedAt).toBe(COMPLETED_AT);
  });

  it.each([
    {
      name: 'a final network error',
      effect: () =>
        responseEffectWith({
          attempts: [transportAttempt('network-error')],
        }),
    },
    {
      name: 'a final deadline',
      effect: () =>
        responseEffectWith({
          attempts: [transportAttempt('deadline-exceeded')],
        }),
    },
    {
      name: 'a final cancellation',
      effect: () =>
        responseEffectWith({
          attempts: [transportAttempt('cancelled')],
        }),
    },
    ...[199, 300, 400, 429, 500].map((httpStatus) => ({
      name: `final HTTP ${String(httpStatus)}`,
      effect: () =>
        responseEffectWith({ attempts: [responseAttempt(httpStatus)] }),
    })),
    {
      name: 'a missing final HTTP status',
      effect: () =>
        responseEffectWith({
          attempts: [
            {
              ...responseAttempt(200),
              httpStatus: null,
            },
          ],
        }),
    },
    {
      name: 'a noncontiguous attempt ordinal',
      effect: () =>
        responseEffectWith({
          attempts: [responseAttempt(200, { ordinal: 2 })],
        }),
    },
    {
      name: 'overlapping attempts',
      effect: () =>
        responseEffectWith({
          attempts: [
            responseAttempt(429),
            responseAttempt(200, {
              ordinal: 2,
              startedAt: '2026-07-30T12:00:00.500Z',
              completedAt: '2026-07-30T12:00:02.000Z',
            }),
          ],
        }),
    },
    {
      name: 'an invalid provider identifier',
      effect: () =>
        responseEffectWith({
          attempts: [
            responseAttempt(200, {
              providerRequestId: `https://${PROVIDER_SENTINEL}.invalid`,
            }),
          ],
        }),
    },
    {
      name: 'response bytes above the profile bound',
      effect: () =>
        responseEffectWith({
          attempts: [
            responseAttempt(200, {
              responseBytes: profile().maximumResponseBytes + 1,
            }),
          ],
        }),
    },
  ])(
    'rejects a response effect with $name before mapping or publication',
    async ({ effect }) => {
      const harness = createHarness();
      const resolveSpy = vi.spyOn(
        repositoryInterviewMapping,
        'resolveRepositoryInterviewProviderOutputV1',
      );
      harness.provider.result = effect();
      const result = await executeRepositoryInterviewV1(
        applicationInput(),
        harness.ports,
      );
      expect(result).toMatchObject({
        ok: false,
        issues: [{ code: 'provider-port-failure' }],
      });
      expect(resolveSpy).not.toHaveBeenCalled();
      expect(harness.record.publications).toHaveLength(0);
      expect(harness.clock.calls).toBe(0);
      expect(JSON.stringify(result)).not.toContain(PROVIDER_SENTINEL);
    },
  );

  it.each([
    {
      name: 'cached input tokens above input tokens',
      invalidUsage: {
        ...usage(),
        cachedInputTokens: usage().inputTokens + 1,
      },
    },
    {
      name: 'reasoning tokens above output tokens',
      invalidUsage: {
        ...usage(),
        reasoningTokens: usage().outputTokens + 1,
      },
    },
    {
      name: 'an incorrect total token count',
      invalidUsage: {
        ...usage(),
        totalTokens: usage().totalTokens + 1,
      },
    },
    {
      name: 'structurally invalid token accounting',
      invalidUsage: {
        unexpected: PROVIDER_SENTINEL,
      },
    },
  ])(
    'publishes genuine invalid usage for $name without semantic mapping',
    async ({ invalidUsage }) => {
      const harness = createHarness();
      const resolveSpy = vi.spyOn(
        repositoryInterviewMapping,
        'resolveRepositoryInterviewProviderOutputV1',
      );
      harness.provider.result = responseEffectWith({
        usage: invalidUsage as ModelExecutionUsageV1,
      });
      const result = expectCompleted(
        await executeRepositoryInterviewV1(applicationInput(), harness.ports),
      );
      expect(result).toMatchObject({
        disposition: 'provider-failed',
        interview: null,
        execution: {
          outcome: {
            status: 'failed',
            failureCode: 'invalid-usage',
            providerOutputDigest: null,
            usage: null,
          },
        },
      });
      expect(resolveSpy).not.toHaveBeenCalled();
      expect(harness.record.publications).toHaveLength(1);
      expect(harness.record.publications[0]?.interview).toBeNull();
      expect(harness.clock.calls).toBe(0);
      expect(JSON.stringify(result)).not.toContain(PROVIDER_SENTINEL);
      expect(JSON.stringify(harness.record.publications)).not.toContain(
        PROVIDER_SENTINEL,
      );
    },
  );

  it('accepts controlled failures only when their declared metadata is valid', async () => {
    const nullUsageHarness = createHarness();
    nullUsageHarness.provider.result = failedEffect(
      'provider-error',
      responseAttempt(500),
    );
    expect(
      expectCompleted(
        await executeRepositoryInterviewV1(
          applicationInput(),
          nullUsageHarness.ports,
        ),
      ).disposition,
    ).toBe('provider-failed');
    expect(nullUsageHarness.record.publications).toHaveLength(1);

    const validUsageHarness = createHarness();
    validUsageHarness.provider.result = failedEffect(
      'provider-error',
      responseAttempt(500),
      usage(),
    );
    const validUsageResult = expectCompleted(
      await executeRepositoryInterviewV1(
        applicationInput(),
        validUsageHarness.ports,
      ),
    );
    expect(validUsageResult.execution.outcome).toMatchObject({
      status: 'failed',
      failureCode: 'provider-error',
      usage: usage(),
    });
    expect(validUsageHarness.record.publications).toHaveLength(1);

    for (const effect of [
      failedEffect('provider-error', responseAttempt(500), {
        ...usage(),
        cachedInputTokens: usage().inputTokens + 1,
      }),
      failedEffect(
        'provider-error',
        responseAttempt(500, {
          providerRequestId: `https://${PROVIDER_SENTINEL}.invalid`,
        }),
      ),
    ]) {
      const harness = createHarness();
      harness.provider.result = effect;
      const result = await executeRepositoryInterviewV1(
        applicationInput(),
        harness.ports,
      );
      expect(result).toMatchObject({
        ok: false,
        issues: [{ code: 'provider-port-failure' }],
      });
      expect(harness.record.publications).toHaveLength(0);
      expect(harness.clock.calls).toBe(0);
      expect(JSON.stringify(result)).not.toContain(PROVIDER_SENTINEL);
    }
  });

  it.each([
    {
      name: 'refusal',
      effect: failedEffect('refused', responseAttempt(200)),
    },
    {
      name: 'incomplete response',
      effect: failedEffect('incomplete', responseAttempt(200)),
    },
    {
      name: 'rate limit',
      effect: failedEffect('rate-limited', responseAttempt(429)),
    },
    {
      name: 'network error',
      effect: failedEffect(
        'transport-error',
        transportAttempt('network-error'),
      ),
    },
    {
      name: 'deadline',
      effect: failedEffect(
        'deadline-exceeded',
        transportAttempt('deadline-exceeded'),
      ),
    },
    {
      name: 'cancellation',
      effect: failedEffect('cancelled', transportAttempt('cancelled')),
    },
    {
      name: 'provider-envelope cancellation',
      effect: failedEffect(
        'cancelled',
        responseAttempt(200, {
          providerRequestId: 'req_provider_cancelled',
          responseId: 'resp_provider_cancelled',
          responseBytes: 2_048,
          providerProcessingMilliseconds: 321,
        }),
        usage(),
      ),
    },
  ])(
    'publishes controlled $name as a valid failed execution',
    async ({ effect }) => {
      const harness = createHarness();
      harness.provider.result = effect;
      const result = expectCompleted(
        await executeRepositoryInterviewV1(applicationInput(), harness.ports),
      );
      expect(result).toMatchObject({
        disposition: 'provider-failed',
        providerOutputDiagnosticCode: null,
        interview: null,
        execution: { outcome: { status: 'failed' } },
      });
      expect(harness.record.publications).toHaveLength(1);
      expect(harness.record.publications[0]?.interview).toBeNull();
      expect(harness.clock.calls).toBe(0);
      if (effect.status === 'failed' && effect.failureCode === 'cancelled') {
        expect(result.execution.attempts).toEqual(effect.attempts);
      }
      expect(JSON.stringify(result)).not.toContain(PROVIDER_SENTINEL);
    },
  );

  it.each([
    {
      name: 'structurally invalid',
      output: { secret: PROVIDER_SENTINEL },
      diagnosticCode: 'provider-output-structure',
    },
    {
      name: 'unknown alias',
      output: mutateFirstCitation(allFamilyProviderOutput(), {
        artifactAlias: 'A4',
        startLine: 1,
        endLine: 1,
      }),
      diagnosticCode: 'provider-output-unknown-artifact-alias',
    },
    {
      name: 'out-of-range citation',
      output: mutateFirstCitation(allFamilyProviderOutput(), {
        artifactAlias: 'A1',
        startLine: 99,
        endLine: 99,
      }),
      diagnosticCode: 'provider-output-citation-out-of-range',
    },
  ])(
    'maps $name provider output to content-free provider-output-invalid',
    async ({ output, diagnosticCode }) => {
      const harness = createHarness();
      harness.provider.result = responseEffect(output);
      const result = expectCompleted(
        await executeRepositoryInterviewV1(applicationInput(), harness.ports),
      );
      expect(result).toMatchObject({
        disposition: 'provider-failed',
        providerOutputDiagnosticCode: diagnosticCode,
        interview: null,
        execution: {
          outcome: {
            status: 'failed',
            failureCode: 'provider-output-invalid',
            providerOutputDigest: null,
          },
        },
      });
      expect(JSON.stringify(result)).not.toContain(PROVIDER_SENTINEL);
      expect(JSON.stringify(harness.record.publications)).not.toContain(
        PROVIDER_SENTINEL,
      );
      expect(harness.record.publications[0]).not.toHaveProperty(
        'providerOutput',
      );
      expect(harness.record.publications[0]).not.toHaveProperty(
        'providerOutputDiagnosticCode',
      );
    },
  );

  it('publishes an adapter-classified provider-output failure without persisting its diagnostic', async () => {
    const harness = createHarness();
    harness.provider.result = responseEffectWith({
      providerOutput: null,
      providerOutputDiagnosticCode: 'provider-output-json-decoding',
    });
    const result = expectCompleted(
      await executeRepositoryInterviewV1(applicationInput(), harness.ports),
    );
    expect(result).toMatchObject({
      disposition: 'provider-failed',
      providerOutputDiagnosticCode: 'provider-output-json-decoding',
      interview: null,
      execution: {
        outcome: {
          status: 'failed',
          failureCode: 'provider-output-invalid',
          providerOutputDigest: null,
        },
      },
    });
    expect(harness.record.publications).toHaveLength(1);
    expect(harness.record.publications[0]).not.toHaveProperty(
      'providerOutputDiagnosticCode',
    );
  });
});

describe('application and effect-port failures', () => {
  it('converts unexpected provider throws to one value-free issue', async () => {
    const harness = createHarness();
    harness.provider.throwMessage = PROVIDER_SENTINEL;
    const result = await executeRepositoryInterviewV1(
      applicationInput(),
      harness.ports,
    );
    expect(result).toMatchObject({
      ok: false,
      issues: [{ code: 'provider-port-failure' }],
    });
    expect(JSON.stringify(result)).not.toContain(PROVIDER_SENTINEL);
  });

  it('converts record lookup and publication throws to value-free issues', async () => {
    const lookupHarness = createHarness();
    lookupHarness.record.lookupThrowMessage = PROVIDER_SENTINEL;
    const lookup = await executeRepositoryInterviewV1(
      applicationInput(),
      lookupHarness.ports,
    );
    expect(lookup).toMatchObject({
      ok: false,
      issues: [{ code: 'record-port-failure' }],
    });
    expect(lookupHarness.provider.requests).toHaveLength(0);
    expect(JSON.stringify(lookup)).not.toContain(PROVIDER_SENTINEL);

    const publishHarness = createHarness();
    publishHarness.record.publicationThrowMessage = PROVIDER_SENTINEL;
    const publication = await executeRepositoryInterviewV1(
      applicationInput(),
      publishHarness.ports,
    );
    expect(publication).toMatchObject({
      ok: false,
      issues: [{ code: 'record-port-failure' }],
    });
    expect(JSON.stringify(publication)).not.toContain(PROVIDER_SENTINEL);
  });

  it('fails closed on publication conflict', async () => {
    const harness = createHarness();
    harness.record.publicationResultFactory = () => ({ status: 'conflict' });
    expect(
      await executeRepositoryInterviewV1(applicationInput(), harness.ports),
    ).toMatchObject({
      ok: false,
      issues: [{ code: 'record-port-conflict' }],
    });
  });

  it('rejects a clock before execution completion before publication', async () => {
    const harness = createHarness();
    harness.clock.value = '2026-07-30T12:00:00.999Z';
    const result = await executeRepositoryInterviewV1(
      applicationInput(),
      harness.ports,
    );
    expect(result).toMatchObject({
      ok: false,
      issues: [{ code: 'publication-time-invalid' }],
    });
    expect(harness.record.publications).toHaveLength(0);
  });
});

class FakeProvider implements RepositoryInterviewProviderPortV1 {
  public readonly requests: RepositoryInterviewProviderRequestV1[] = [];
  public result: RepositoryInterviewProviderEffectResultV1 = responseEffect();
  public throwMessage: string | null = null;
  public mutatePrompt = false;
  public mutationFailed = false;
  private readonly order: string[];

  public constructor(order: string[]) {
    this.order = order;
  }

  public execute(
    request: RepositoryInterviewProviderRequestV1,
  ): Promise<RepositoryInterviewProviderEffectResultV1> {
    this.order.push('provider');
    this.requests.push(request);
    if (this.throwMessage !== null) {
      return Promise.reject(new Error(this.throwMessage));
    }
    if (this.mutatePrompt) {
      try {
        (
          request.prompt as unknown as {
            promptDigest: string;
          }
        ).promptDigest = '0'.repeat(64);
      } catch {
        this.mutationFailed = true;
      }
    }
    return Promise.resolve(this.result);
  }
}

class FakeRecord implements RepositoryInterviewRecordPortV1 {
  public readonly lookups: RepositoryInterviewReuseLookupV1[] = [];
  public readonly publications: RepositoryInterviewPublicationCommandV1[] = [];
  public reusable: RepositoryInterviewReusableBundleV1 | null = null;
  public lookupThrowMessage: string | null = null;
  public publicationThrowMessage: string | null = null;
  public onLookup: (() => void) | null = null;
  public publicationResultFactory: (
    command: RepositoryInterviewPublicationCommandV1,
  ) => RepositoryInterviewPublicationResultV1 = () => ({ status: 'created' });
  private readonly order: string[];

  public constructor(order: string[]) {
    this.order = order;
  }

  public findReusable(
    lookup: RepositoryInterviewReuseLookupV1,
  ): Promise<RepositoryInterviewReusableBundleV1 | null> {
    this.order.push('lookup');
    this.lookups.push(lookup);
    this.onLookup?.();
    if (this.lookupThrowMessage !== null) {
      return Promise.reject(new Error(this.lookupThrowMessage));
    }
    return Promise.resolve(this.reusable);
  }

  public publish(
    command: RepositoryInterviewPublicationCommandV1,
  ): Promise<RepositoryInterviewPublicationResultV1> {
    this.order.push('publish');
    this.publications.push(command);
    if (this.publicationThrowMessage !== null) {
      return Promise.reject(new Error(this.publicationThrowMessage));
    }
    return Promise.resolve(this.publicationResultFactory(command));
  }
}

class FakeClock implements RepositoryInterviewClockPortV1 {
  public calls = 0;
  public value = PUBLISHED_AT;
  private readonly order: string[];

  public constructor(order: string[]) {
    this.order = order;
  }

  public now(): string {
    this.order.push('clock');
    this.calls += 1;
    return this.value;
  }
}

class FakeNonce implements RepositoryInterviewNoncePortV1 {
  public calls = 0;
  public values = ['1'.repeat(32)];
  private readonly order: string[];

  public constructor(order: string[]) {
    this.order = order;
  }

  public nextExecutionNonce(): string {
    this.order.push('nonce');
    const value = this.values[this.calls];
    this.calls += 1;
    return value ?? 'f'.repeat(32);
  }
}

function createHarness(): {
  readonly order: string[];
  readonly provider: FakeProvider;
  readonly record: FakeRecord;
  readonly clock: FakeClock;
  readonly nonce: FakeNonce;
  readonly ports: {
    readonly provider: FakeProvider;
    readonly record: FakeRecord;
    readonly clock: FakeClock;
    readonly nonce: FakeNonce;
  };
} {
  const order: string[] = [];
  const provider = new FakeProvider(order);
  const record = new FakeRecord(order);
  const clock = new FakeClock(order);
  const nonce = new FakeNonce(order);
  return {
    order,
    provider,
    record,
    clock,
    nonce,
    ports: { provider, record, clock, nonce },
  };
}

function applicationInput(
  overrides: Partial<ExecuteRepositoryInterviewInputV1> = {},
): ExecuteRepositoryInterviewInputV1 {
  const context = createPresentContext(numberedContent(12));
  return {
    artifactSet: context.artifactSet,
    artifacts: context.artifacts,
    specification,
    modelProfile: profile(),
    executionMode: 'normal',
    forceReason: null,
    ...overrides,
  };
}

function profile(
  overrides: Partial<ModelExecutionModelProfileV1> = {},
): ModelExecutionModelProfileV1 {
  return {
    provider: 'openai',
    endpointProfile: 'responses-v1',
    modelSnapshot: 'synthetic-model-2024-02-29',
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

function responseEffect(
  providerOutput: unknown = allFamilyProviderOutput(),
): RepositoryInterviewProviderEffectResultV1 {
  return {
    status: 'response',
    attempts: [responseAttempt(200)],
    usage: usage(),
    providerOutput,
    providerOutputDiagnosticCode: null,
  };
}

function responseEffectWith(
  overrides: Partial<
    Extract<
      RepositoryInterviewProviderEffectResultV1,
      { readonly status: 'response' }
    >
  >,
): RepositoryInterviewProviderEffectResultV1 {
  return {
    ...responseEffect(),
    ...overrides,
    status: 'response',
  } as RepositoryInterviewProviderEffectResultV1;
}

function failedEffect(
  failureCode: Extract<
    RepositoryInterviewProviderEffectResultV1,
    { readonly status: 'failed' }
  >['failureCode'],
  attempt: ModelExecutionAttemptV1,
  effectUsage: ModelExecutionUsageV1 | null = null,
): RepositoryInterviewProviderEffectResultV1 {
  return {
    status: 'failed',
    attempts: [attempt],
    failureCode,
    usage: effectUsage,
  };
}

function responseAttempt(
  httpStatus: number,
  overrides: Partial<ModelExecutionAttemptV1> = {},
): ModelExecutionAttemptV1 {
  return {
    ordinal: 1,
    startedAt: STARTED_AT,
    completedAt: COMPLETED_AT,
    transportOutcome: 'response',
    httpStatus,
    providerRequestId: 'req_synthetic',
    responseId: 'resp_synthetic',
    responseBytes: 1_024,
    providerProcessingMilliseconds: 500,
    retryAfterMilliseconds: httpStatus === 429 ? 1_000 : null,
    remainingRequests: null,
    remainingTokens: null,
    resetRequestsMilliseconds: null,
    resetTokensMilliseconds: null,
    ...overrides,
  };
}

function transportAttempt(
  transportOutcome: 'network-error' | 'deadline-exceeded' | 'cancelled',
): ModelExecutionAttemptV1 {
  return {
    ...responseAttempt(200),
    transportOutcome,
    httpStatus: null,
    providerRequestId: null,
    responseId: null,
    responseBytes: 0,
    providerProcessingMilliseconds: null,
    retryAfterMilliseconds: null,
  };
}

function usage(): ModelExecutionUsageV1 {
  return {
    inputTokens: 100,
    cachedInputTokens: 0,
    outputTokens: 100,
    reasoningTokens: 10,
    totalTokens: 200,
  };
}

function allFamilyProviderOutput(): Record<string, unknown> {
  const citation = (line: number) => ({
    artifactAlias: 'A1',
    startLine: line,
    endLine: line,
  });
  return {
    documentedPositions: [
      {
        topic: 'purpose-and-scope',
        statement: 'The supplied artifacts state a synthetic purpose.',
        confidence: 'high',
        citations: [citation(1)],
      },
      {
        topic: 'runtime-and-framework',
        statement: 'The supplied artifacts state a synthetic runtime.',
        confidence: 'medium',
        citations: [citation(1)],
      },
      {
        topic: 'integration-surface',
        statement: 'The supplied artifacts state a synthetic integration.',
        confidence: 'high',
        citations: [citation(2)],
      },
      {
        topic: 'data-and-state',
        statement: 'The supplied artifacts state synthetic state behavior.',
        confidence: 'high',
        citations: [citation(3)],
      },
    ],
    inferences: [
      {
        topic: 'deployment-and-operations',
        statement: 'The supplied artifacts imply synthetic operations.',
        rationale: 'The cited operational description supports this bridge.',
        confidence: 'medium',
        citations: [citation(4)],
      },
    ],
    limitations: [
      {
        topic: 'security-and-trust',
        basis: 'documented-position',
        statement: 'The supplied artifacts state a synthetic security limit.',
        rationale: null,
        confidence: 'high',
        citations: [citation(5)],
      },
    ],
    contradictions: [
      {
        topic: 'maintenance-and-support',
        kind: 'direct',
        explanation: 'The supplied positions describe opposing support states.',
        positionA: {
          statement: 'The supplied artifacts state synthetic support.',
          citations: [citation(6)],
        },
        positionB: {
          statement: 'The supplied artifacts state synthetic deprecation.',
          citations: [citation(7)],
        },
      },
    ],
    unknowns: [
      {
        topic: 'adoption-and-limitations',
        reason: 'insufficient-detail',
        statement:
          'The supplied artifacts do not establish synthetic adoption effort.',
        partialCitations: [citation(8)],
      },
    ],
  };
}

function mutateFirstCitation(
  output: Record<string, unknown>,
  citation: Record<string, unknown>,
): Record<string, unknown> {
  const cloned = structuredClone(output);
  const positions = cloned['documentedPositions'];
  if (!Array.isArray(positions)) {
    throw new Error('Synthetic provider output is malformed.');
  }
  const first = positions[0] as Record<string, unknown>;
  first['citations'] = [citation];
  return cloned;
}

function createPresentContext(content: string): SyntheticContext {
  const artifact = createArtifact(content);
  return {
    artifactSet: createRepositoryArtifactSetV1({
      contractVersion: '1.0.0',
      candidateId: CANDIDATE_ID,
      catalogVersion: 'public-v1',
      catalogDigest: 'a'.repeat(64),
      artifactManifestVersion: 'public-artifacts-v1',
      artifactManifestDigest: 'b'.repeat(64),
      collectorVersion: 'repository-artifacts-v1',
      chunkerVersion: 'exact-lines-v1',
      provider: 'github',
      providerRepositoryId: REPOSITORY_ID,
      providerCanonicalOwner: PROVIDER_OWNER,
      providerCanonicalRepository: PROVIDER_REPOSITORY,
      gitObjectAlgorithm: 'sha1',
      commitObjectId: COMMIT,
      entries: [presentEntry(artifact)],
      publishedAt: STARTED_AT,
    }),
    artifacts: [artifact],
  };
}

function createArtifact(content: string): RepositoryArtifactV1 {
  const path = 'README.md';
  const blobObjectId = gitBlobSha1(content);
  return createRepositoryArtifactV1({
    contractVersion: '1.0.0',
    candidateId: CANDIDATE_ID,
    provider: 'github',
    providerRepositoryId: REPOSITORY_ID,
    gitObjectAlgorithm: 'sha1',
    commitObjectId: COMMIT,
    path,
    blobObjectId,
    blobApiUrl: `https://api.github.com/repositories/${REPOSITORY_ID}/git/blobs/${blobObjectId}`,
    displayUrl: `https://github.com/${PROVIDER_OWNER}/${PROVIDER_REPOSITORY}/blob/${COMMIT}/${path}`,
    mediaType: 'text/plain',
    encoding: 'utf-8',
    contentSha256: sha256(content),
    byteCount: Buffer.byteLength(content),
    lineCount: splitRepositoryArtifactLogicalLines(content).length,
    content,
    firstMaterialization: {
      catalogOwner: PROVIDER_OWNER,
      catalogRepository: PROVIDER_REPOSITORY,
      providerOwner: PROVIDER_OWNER,
      providerRepository: PROVIDER_REPOSITORY,
      collectedAt: '2026-07-30T11:59:00.000Z',
    },
  });
}

function presentEntry(
  artifact: RepositoryArtifactV1,
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

function numberedContent(lines: number): string {
  return Array.from(
    { length: lines },
    (_, index) => `synthetic line ${String(index + 1)}`,
  ).join('\n');
}

function expectCompleted(
  result: ExecuteRepositoryInterviewResultV1,
): Extract<ExecuteRepositoryInterviewResultV1, { readonly ok: true }> {
  expect(result).toMatchObject({ ok: true, issues: [] });
  if (!result.ok) {
    throw new Error('Synthetic repository interview execution failed.');
  }
  return result;
}

function expectNoEffects(harness: ReturnType<typeof createHarness>): void {
  expect(harness.record.lookups).toHaveLength(0);
  expect(harness.provider.requests).toHaveLength(0);
  expect(harness.nonce.calls).toBe(0);
  expect(harness.clock.calls).toBe(0);
  expect(harness.record.publications).toHaveLength(0);
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function gitBlobSha1(value: string): string {
  const bytes = Buffer.from(value, 'utf8');
  return createHash('sha1')
    .update(`blob ${String(bytes.byteLength)}\0`, 'utf8')
    .update(bytes)
    .digest('hex');
}
