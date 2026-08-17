import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  CONTRACT_SCHEMA_NAMES,
  REPOSITORY_INTERVIEW_TOPICS,
  createModelExecutionV1,
  createRepositoryInterviewRequestV1,
  createRepositoryInterviewV1,
  getContractSchemaV1,
  modelExecutionModelProfileDigest,
  modelExecutionRecordDigest,
  parseModelExecutionV1,
  parseRepositoryInterviewRequestV1,
  parseRepositoryInterviewV1,
  serializeContractSchemaV1,
  validateRepositoryInterviewExecutionV1,
  type ModelExecutionInputV1,
  type ModelExecutionV1,
  type RepositoryInterviewInputV1,
  type RepositoryInterviewRequestInputV1,
  type RepositoryInterviewRequestV1,
} from '../src/index.ts';

const DIGEST = {
  artifactSet: '1'.repeat(64),
  specification: '2'.repeat(64),
  providerSchema: '3'.repeat(64),
  prompt: '4'.repeat(64),
  providerProjection: '5'.repeat(64),
  providerOutput: '6'.repeat(64),
} as const;

const EXISTING_SCHEMA_DIGESTS = {
  'candidate-dossier':
    'd16d0424ed45edcf61d8084cbd21ebbb396366522d1b1a425b6cf8405e0680af',
  'capability-request':
    '3d1f213efdacd6ff550a66a74703b94abc56aead59cdcb08b7a2769b5a5a1ab9',
  'error-envelope':
    '7a708cc440a7992cb164715dce6029befbe78970c3283d8a1bff9298c87603d0',
  'fit-assessment-request':
    'c130a56044cbb043fac97e66db4c372d48990d672784b4abfde9ab9e78c9e504',
  'fit-assessment-response':
    '330b5b3940858428b1881701774bac785a7c93cf2d50e6dcb4ec37091a696a4d',
  'repository-artifact':
    '994643368bdc95a5279a2d939ec350ed65932ad16a3c937ae32f52ff87113d16',
  'repository-artifact-chunk':
    'd79d2803e3e11e83a9554eae4a38bba1bf379da6f767be402105cc3bf57508a6',
  'repository-artifact-set':
    '0d78814c3361e76e9d82c29cc6464fbedb3e6b761269dba3641c0e1c2c894e54',
  'repository-fingerprint':
    '73f42c7a7cd20de24372ecddb7afa33925ca1f4d67cb1f9598cd9d56ea87477c',
} as const;

function requestInput(
  overrides: Partial<RepositoryInterviewRequestInputV1> = {},
): RepositoryInterviewRequestInputV1 {
  return {
    contractVersion: '1.0.0',
    candidateId: 'synthetic-candidate',
    artifactSetId: `artifact-set-${'a'.repeat(48)}`,
    artifactSetIdentityDigest: DIGEST.artifactSet,
    specificationVersion: '1.0.0',
    specificationDigest: DIGEST.specification,
    rendererVersion: 'repository-interview-renderer-v1',
    providerOutputSchemaVersion: '1.0.0',
    providerOutputSchemaDigest: DIGEST.providerSchema,
    promptDigest: DIGEST.prompt,
    ...overrides,
  };
}

function profile(
  overrides: Partial<ModelExecutionInputV1['modelProfile']> = {},
): ModelExecutionInputV1['modelProfile'] {
  return {
    provider: 'openai',
    endpointProfile: 'responses-v1',
    modelSnapshot: 'gpt-5.4-mini-2026-03-17',
    providerProjectionVersion: '1.0.0',
    providerProjectionDigest: DIGEST.providerProjection,
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

function executionInput(
  request: RepositoryInterviewRequestV1,
  overrides: Partial<ModelExecutionInputV1> = {},
): ModelExecutionInputV1 {
  return {
    contractVersion: '1.0.0',
    requestId: request.requestId,
    requestIdentityDigest: request.identityDigest,
    executionNonce: 'b'.repeat(32),
    executionMode: 'normal',
    forceReason: null,
    modelProfile: profile(),
    startedAt: '2026-07-30T12:00:00.000Z',
    completedAt: '2026-07-30T12:00:01.000Z',
    attempts: [
      {
        ordinal: 1,
        startedAt: '2026-07-30T12:00:00.000Z',
        completedAt: '2026-07-30T12:00:01.000Z',
        transportOutcome: 'response',
        httpStatus: 200,
        providerRequestId: 'req_synthetic',
        responseId: 'resp_synthetic',
        responseBytes: 1_024,
        providerProcessingMilliseconds: 800,
        retryAfterMilliseconds: null,
        remainingRequests: 99,
        remainingTokens: 999_999,
        resetRequestsMilliseconds: 1_000,
        resetTokensMilliseconds: 1_000,
      },
    ],
    outcome: {
      status: 'succeeded',
      failureCode: null,
      providerOutputDigest: DIGEST.providerOutput,
      usage: {
        inputTokens: 1_000,
        cachedInputTokens: 100,
        outputTokens: 200,
        reasoningTokens: 50,
        totalTokens: 1_200,
      },
    },
    ...overrides,
  };
}

const CITATION_ONE = {
  artifactId: `artifact-${'c'.repeat(48)}`,
  startLine: 1,
  endLine: 4,
} as const;
const CITATION_TWO = {
  artifactId: `artifact-${'d'.repeat(48)}`,
  startLine: 8,
  endLine: 10,
} as const;

function interviewInput(
  request: RepositoryInterviewRequestV1,
  execution: ModelExecutionV1,
  overrides: Partial<RepositoryInterviewInputV1> = {},
): RepositoryInterviewInputV1 {
  return {
    contractVersion: '1.0.0',
    candidateId: request.candidateId,
    artifactSetId: request.artifactSetId,
    artifactSetIdentityDigest: request.artifactSetIdentityDigest,
    requestId: request.requestId,
    requestIdentityDigest: request.identityDigest,
    executionId: execution.executionId,
    executionIdentityDigest: execution.identityDigest,
    providerOutputDigest: DIGEST.providerOutput,
    specificationVersion: request.specificationVersion,
    specificationDigest: request.specificationDigest,
    rendererVersion: request.rendererVersion,
    providerOutputSchemaVersion: request.providerOutputSchemaVersion,
    providerOutputSchemaDigest: request.providerOutputSchemaDigest,
    providerProjectionVersion: execution.modelProfile.providerProjectionVersion,
    providerProjectionDigest: execution.modelProfile.providerProjectionDigest,
    promptDigest: request.promptDigest,
    modelProfileDigest: execution.modelProfileDigest,
    citations: [CITATION_TWO, CITATION_ONE],
    claims: REPOSITORY_INTERVIEW_TOPICS.map((topic, index) => ({
      kind: 'documented-position' as const,
      topic,
      statement: `Synthetic documented position ${String(index + 1)}.`,
      rationale: null,
      confidence: 'high' as const,
      citations: [index % 2 === 0 ? CITATION_ONE : CITATION_TWO],
    })),
    limitations: [],
    contradictions: [],
    unknowns: [],
    publishedAt: '2026-07-30T12:01:00.000Z',
    ...overrides,
  };
}

function expectRejected(
  result:
    | ReturnType<typeof parseRepositoryInterviewRequestV1>
    | ReturnType<typeof parseModelExecutionV1>
    | ReturnType<typeof parseRepositoryInterviewV1>,
): void {
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.issues.length).toBeGreaterThan(0);
    for (const issue of result.issues) {
      expect(issue.message.length).toBeLessThanOrEqual(160);
    }
  }
}

describe('shared repository interview topic authority', () => {
  it('exports the frozen ordered vocabulary', () => {
    expect(REPOSITORY_INTERVIEW_TOPICS).toEqual([
      'purpose-and-scope',
      'runtime-and-framework',
      'integration-surface',
      'data-and-state',
      'deployment-and-operations',
      'security-and-trust',
      'maintenance-and-support',
      'adoption-and-limitations',
    ]);
    expect(Object.isFrozen(REPOSITORY_INTERVIEW_TOPICS)).toBe(true);
  });
});

describe('RepositoryInterviewRequestV1', () => {
  it('creates one byte-stable request without wall-clock or conditioning fields', () => {
    const first = createRepositoryInterviewRequestV1(requestInput());
    expect(first).toEqual(createRepositoryInterviewRequestV1(requestInput()));
    expect(first.requestId).toBe(`intreq-${first.identityDigest.slice(0, 48)}`);
    expect(Object.keys(first).sort()).toEqual(
      [
        'contractVersion',
        'requestId',
        'candidateId',
        'artifactSetId',
        'artifactSetIdentityDigest',
        'specificationVersion',
        'specificationDigest',
        'rendererVersion',
        'providerOutputSchemaVersion',
        'providerOutputSchemaDigest',
        'promptDigest',
        'identityDigest',
        'recordDigest',
      ].sort(),
    );
    expect(Object.keys(first)).not.toEqual(
      expect.arrayContaining([
        'requestedAt',
        'dossierId',
        'modelProfile',
        'reviewState',
        'ranking',
        'recommendation',
      ]),
    );
    expect(parseRepositoryInterviewRequestV1(first)).toMatchObject({
      ok: true,
    });
  });

  it('changes identity for prompt, specification, or schema authority changes', () => {
    const base = createRepositoryInterviewRequestV1(requestInput());
    for (const variant of [
      createRepositoryInterviewRequestV1(
        requestInput({ promptDigest: '7'.repeat(64) }),
      ),
      createRepositoryInterviewRequestV1(
        requestInput({ specificationDigest: '8'.repeat(64) }),
      ),
      createRepositoryInterviewRequestV1(
        requestInput({ providerOutputSchemaDigest: '9'.repeat(64) }),
      ),
    ]) {
      expect(variant.identityDigest).not.toBe(base.identityDigest);
      expect(variant.requestId).not.toBe(base.requestId);
    }
  });

  it('rejects closed-root, collision, digest, and exotic input violations', () => {
    const value = createRepositoryInterviewRequestV1(requestInput());
    expectRejected(
      parseRepositoryInterviewRequestV1({ ...value, requestedAt: null }),
    );
    expectRejected(
      parseRepositoryInterviewRequestV1({
        ...value,
        requestId: `intreq-${'0'.repeat(48)}`,
      }),
    );
    expectRejected(
      parseRepositoryInterviewRequestV1({
        ...value,
        identityDigest: '0'.repeat(64),
      }),
    );
    const cyclic: Record<string, unknown> = { ...requestInput() };
    cyclic['cycle'] = cyclic;
    expect(() => createRepositoryInterviewRequestV1(cyclic as never)).toThrow(
      /invalid/u,
    );
    const accessor = { ...requestInput() };
    Object.defineProperty(accessor, 'candidateId', {
      enumerable: true,
      get: () => 'synthetic-candidate',
    });
    expect(() => createRepositoryInterviewRequestV1(accessor as never)).toThrow(
      /invalid/u,
    );
  });

  it('returns owned inert parsed data', () => {
    const source = structuredClone(
      createRepositoryInterviewRequestV1(requestInput()),
    );
    const parsed = parseRepositoryInterviewRequestV1(source);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      (source as { candidateId: string }).candidateId = 'mutated';
      expect(parsed.value.candidateId).toBe('synthetic-candidate');
      expect(parsed.domain).toBe(parsed.value);
    }
  });
});

describe('ModelExecutionV1', () => {
  it('separates profile, reuse, nonce, and forced identity', () => {
    const request = createRepositoryInterviewRequestV1(requestInput());
    const normal = createModelExecutionV1(executionInput(request));
    const anotherNonce = createModelExecutionV1(
      executionInput(request, { executionNonce: 'c'.repeat(32) }),
    );
    const forced = createModelExecutionV1(
      executionInput(request, {
        executionMode: 'forced',
        forceReason: 'calibration',
      }),
    );
    expect(normal.modelProfileDigest).toBe(
      modelExecutionModelProfileDigest(normal.modelProfile),
    );
    expect(normal.reuseKeyDigest).toBe(anotherNonce.reuseKeyDigest);
    expect(normal.executionId).not.toBe(anotherNonce.executionId);
    expect(normal.executionId).not.toBe(forced.executionId);
  });

  it('rejects moving snapshots and widened controls', () => {
    const request = createRepositoryInterviewRequestV1(requestInput());
    for (const modelSnapshot of ['gpt-5.4', '-bad', 'bad snapshot']) {
      expect(() =>
        createModelExecutionV1(
          executionInput(request, {
            modelProfile: profile({ modelSnapshot }),
          }),
        ),
      ).toThrow(/invalid/u);
    }
    for (const mutation of [
      { toolsEnabled: true },
      { store: true },
      { background: true },
      { conversationState: true },
      { previousResponseState: true },
      { truncation: 'auto' },
    ]) {
      expect(() =>
        createModelExecutionV1(
          executionInput(request, {
            modelProfile: { ...profile(), ...mutation } as never,
          }),
        ),
      ).toThrow(/invalid/u);
    }
  });

  it('requires real dated snapshots while preserving planned calibration profiles', () => {
    const request = createRepositoryInterviewRequestV1(requestInput());
    for (const modelSnapshot of [
      'gpt-5.4-2026-00-01',
      'gpt-5.4-2026-13-01',
      'gpt-5.4-2026-02-30',
      'gpt-5.4-2026-99-99',
      'gpt-5.4-2025-02-29',
    ]) {
      expect(() =>
        createModelExecutionV1(
          executionInput(request, {
            modelProfile: profile({ modelSnapshot }),
          }),
        ),
      ).toThrow(/invalid/u);
    }
    for (const modelSnapshot of [
      'gpt-5.4-2026-03-05',
      'gpt-5.4-mini-2026-03-17',
      'synthetic-model-2024-02-29',
    ]) {
      expect(
        createModelExecutionV1(
          executionInput(request, {
            modelProfile: profile({ modelSnapshot }),
          }),
        ).modelProfile.modelSnapshot,
      ).toBe(modelSnapshot);
    }
  });

  it('accepts only nullable narrow provider identifiers without leaking rejected values', () => {
    const request = createRepositoryInterviewRequestV1(requestInput());
    const accepted = [null, 'req_abc123', 'resp-123', 'request.v1', 'A1'];
    for (const providerIdentifier of accepted) {
      const attempt = {
        ...executionInput(request).attempts[0]!,
        providerRequestId: providerIdentifier,
        responseId: providerIdentifier,
      };
      expect(
        createModelExecutionV1(executionInput(request, { attempts: [attempt] }))
          .attempts[0],
      ).toMatchObject({
        providerRequestId: providerIdentifier,
        responseId: providerIdentifier,
      });
    }

    const rejected = [
      'https://example.invalid/request',
      'request: abc',
      'request abc',
      'request/abc',
      'request\nabc',
      'request\tabc',
      '',
      'a'.repeat(129),
    ];
    const base = createModelExecutionV1(executionInput(request));
    for (const providerIdentifier of rejected) {
      for (const field of ['providerRequestId', 'responseId'] as const) {
        const changedAttempt =
          field === 'providerRequestId'
            ? { ...base.attempts[0]!, providerRequestId: providerIdentifier }
            : { ...base.attempts[0]!, responseId: providerIdentifier };
        const changed = {
          ...base,
          attempts: [changedAttempt],
        } as ModelExecutionV1;
        const value = {
          ...changed,
          recordDigest: modelExecutionRecordDigest(changed),
        };
        const parsed = parseModelExecutionV1(value);
        expectRejected(parsed);
        if (!parsed.ok && providerIdentifier.length > 0) {
          expect(
            parsed.issues.map((issue) => issue.message).join('\n'),
          ).not.toContain(providerIdentifier);
        }
      }
    }
  });

  it('enforces modes, attempts, timestamps, response status, and retry bounds', () => {
    const request = createRepositoryInterviewRequestV1(requestInput());
    const base = createModelExecutionV1(executionInput(request));
    for (const value of [
      { ...base, executionMode: 'normal', forceReason: 'calibration' },
      { ...base, executionMode: 'forced', forceReason: null },
      { ...base, attempts: [] },
      { ...base, attempts: [{ ...base.attempts[0]!, ordinal: 2 }] },
      {
        ...base,
        attempts: [
          {
            ...base.attempts[0]!,
            startedAt: '2026-07-30T12:00:02.000Z',
          },
        ],
      },
      {
        ...base,
        attempts: [
          {
            ...base.attempts[0]!,
            transportOutcome: 'network-error',
            httpStatus: 200,
          },
        ],
      },
      {
        ...base,
        attempts: [{ ...base.attempts[0]!, retryAfterMilliseconds: 30_001 }],
      },
      {
        ...base,
        attempts: [
          {
            ...base.attempts[0]!,
            completedAt: '2026-07-30T12:00:00.750Z',
          },
          {
            ...base.attempts[0]!,
            ordinal: 2,
            startedAt: '2026-07-30T12:00:00.500Z',
          },
        ],
      },
      {
        ...base,
        startedAt: '2026-02-31T12:00:00.000Z',
      },
      {
        ...base,
        attempts: [
          {
            ...base.attempts[0]!,
            responseBytes: base.modelProfile.maximumResponseBytes + 1,
          },
        ],
      },
    ]) {
      expectRejected(parseModelExecutionV1(value));
    }

    const firstAttempt = {
      ...executionInput(request).attempts[0]!,
      completedAt: '2026-07-30T12:00:00.500Z',
      httpStatus: 429,
      retryAfterMilliseconds: 250,
    };
    const secondAttempt = {
      ...executionInput(request).attempts[0]!,
      ordinal: 2,
      startedAt: '2026-07-30T12:00:00.500Z',
    };
    expect(
      createModelExecutionV1(
        executionInput(request, {
          attempts: [firstAttempt, secondAttempt],
        }),
      ).attempts,
    ).toHaveLength(2);
  });

  it('enforces terminal outcome and token arithmetic', () => {
    const request = createRepositoryInterviewRequestV1(requestInput());
    const base = createModelExecutionV1(executionInput(request));
    for (const value of [
      { ...base, outcome: { ...base.outcome, providerOutputDigest: null } },
      {
        ...base,
        outcome: {
          status: 'failed',
          failureCode: 'provider-error',
          providerOutputDigest: DIGEST.providerOutput,
          usage: null,
        },
      },
      {
        ...base,
        outcome: {
          ...base.outcome,
          usage: { ...base.outcome.usage!, cachedInputTokens: 1_001 },
        },
      },
      {
        ...base,
        outcome: {
          ...base.outcome,
          usage: { ...base.outcome.usage!, reasoningTokens: 201 },
        },
      },
      {
        ...base,
        outcome: {
          ...base.outcome,
          usage: { ...base.outcome.usage!, totalTokens: 1_201 },
        },
      },
    ]) {
      expectRejected(parseModelExecutionV1(value));
    }
  });

  it('requires a final successful 2xx response for successful outcomes', () => {
    const request = createRepositoryInterviewRequestV1(requestInput());
    const baseAttempt = executionInput(request).attempts[0]!;
    for (const attempt of [
      {
        ...baseAttempt,
        transportOutcome: 'network-error' as const,
        httpStatus: null,
      },
      {
        ...baseAttempt,
        transportOutcome: 'deadline-exceeded' as const,
        httpStatus: null,
      },
      {
        ...baseAttempt,
        transportOutcome: 'cancelled' as const,
        httpStatus: null,
      },
      ...[400, 429, 500].map((httpStatus) => ({
        ...baseAttempt,
        httpStatus,
      })),
    ]) {
      expect(() =>
        createModelExecutionV1(
          executionInput(request, { attempts: [attempt] }),
        ),
      ).toThrow(/invalid/u);
    }
    for (const httpStatus of [200, 299]) {
      expect(
        createModelExecutionV1(
          executionInput(request, {
            attempts: [{ ...baseAttempt, httpStatus }],
          }),
        ).outcome.status,
      ).toBe('succeeded');
    }
  });

  it('closes transport-terminal failure codes without overmapping provider failures', () => {
    const request = createRepositoryInterviewRequestV1(requestInput());
    const baseAttempt = executionInput(request).attempts[0]!;
    for (const failureCode of [
      'transport-error',
      'deadline-exceeded',
    ] as const) {
      expect(() =>
        createModelExecutionV1(
          executionInput(request, {
            attempts: [{ ...baseAttempt, transportOutcome: 'response' }],
            outcome: {
              status: 'failed',
              failureCode,
              providerOutputDigest: null,
              usage: null,
            },
          }),
        ),
      ).toThrow(/invalid/u);
    }

    for (const [failureCode, transportOutcome] of [
      ['transport-error', 'network-error'],
      ['deadline-exceeded', 'deadline-exceeded'],
      ['cancelled', 'cancelled'],
    ] as const) {
      expect(
        createModelExecutionV1(
          executionInput(request, {
            attempts: [
              {
                ...baseAttempt,
                transportOutcome,
                httpStatus: null,
              },
            ],
            outcome: {
              status: 'failed',
              failureCode,
              providerOutputDigest: null,
              usage: null,
            },
          }),
        ).outcome.failureCode,
      ).toBe(failureCode);
    }

    expect(
      createModelExecutionV1(
        executionInput(request, {
          attempts: [{ ...baseAttempt, httpStatus: 200 }],
          outcome: {
            status: 'failed',
            failureCode: 'cancelled',
            providerOutputDigest: null,
            usage: null,
          },
        }),
      ).attempts[0],
    ).toMatchObject({
      transportOutcome: 'response',
      httpStatus: 200,
    });

    for (const httpStatus of [199, 300, 500]) {
      expect(() =>
        createModelExecutionV1(
          executionInput(request, {
            attempts: [{ ...baseAttempt, httpStatus }],
            outcome: {
              status: 'failed',
              failureCode: 'cancelled',
              providerOutputDigest: null,
              usage: null,
            },
          }),
        ),
      ).toThrow(/invalid/u);
    }

    for (const [failureCode, httpStatus] of [
      ['provider-output-invalid', 200],
      ['invalid-response', 299],
      ['rate-limited', 429],
      ['provider-error', 500],
    ] as const) {
      expect(
        createModelExecutionV1(
          executionInput(request, {
            attempts: [{ ...baseAttempt, httpStatus }],
            outcome: {
              status: 'failed',
              failureCode,
              providerOutputDigest: null,
              usage: null,
            },
          }),
        ).outcome.failureCode,
      ).toBe(failureCode);
    }
  });

  it('partitions identity from record-only execution facts', () => {
    const request = createRepositoryInterviewRequestV1(requestInput());
    const base = createModelExecutionV1(executionInput(request));
    const changedRecord = createModelExecutionV1(
      executionInput(request, {
        completedAt: '2026-07-30T12:00:02.000Z',
        attempts: [
          {
            ...executionInput(request).attempts[0]!,
            completedAt: '2026-07-30T12:00:02.000Z',
            responseBytes: 1_025,
          },
        ],
        outcome: {
          ...executionInput(request).outcome,
          usage: {
            inputTokens: 1_001,
            cachedInputTokens: 100,
            outputTokens: 200,
            reasoningTokens: 50,
            totalTokens: 1_201,
          },
        },
      }),
    );
    expect(changedRecord.reuseKeyDigest).toBe(base.reuseKeyDigest);
    expect(changedRecord.identityDigest).toBe(base.identityDigest);
    expect(changedRecord.recordDigest).not.toBe(base.recordDigest);
    const changedProfile = createModelExecutionV1(
      executionInput(request, {
        modelProfile: profile({ maximumOutputTokens: 4_096 }),
      }),
    );
    expect(changedProfile.reuseKeyDigest).not.toBe(base.reuseKeyDigest);
    expect(changedProfile.identityDigest).not.toBe(base.identityDigest);
    expectRejected(parseModelExecutionV1({ ...base, rawError: 'no' }));
  });
});

describe('RepositoryInterviewV1', () => {
  it('derives stable nested IDs, canonical order, and complete state', () => {
    const request = createRepositoryInterviewRequestV1(requestInput());
    const execution = createModelExecutionV1(executionInput(request));
    const first = createRepositoryInterviewV1(
      interviewInput(request, execution),
    );
    const second = createRepositoryInterviewV1(
      interviewInput(request, execution, {
        citations: [CITATION_ONE, CITATION_TWO],
        claims: [...interviewInput(request, execution).claims].reverse(),
      }),
    );
    expect(first).toEqual(second);
    expect(first.processingState).toBe('complete');
    expect(first.interviewId).toBe(
      `interview-${first.identityDigest.slice(0, 48)}`,
    );
    expect(first.citations.map((item) => item.artifactId)).toEqual([
      CITATION_ONE.artifactId,
      CITATION_TWO.artifactId,
    ]);
    expect(parseRepositoryInterviewV1(first)).toMatchObject({ ok: true });
  });

  it('derives every nested semantic ID family', () => {
    const request = createRepositoryInterviewRequestV1(requestInput());
    const execution = createModelExecutionV1(executionInput(request));
    const base = interviewInput(request, execution);
    const value = createRepositoryInterviewV1({
      ...base,
      limitations: [
        {
          topic: 'adoption-and-limitations',
          basis: 'documented-position',
          statement: 'The supplied artifacts state a synthetic limitation.',
          rationale: null,
          confidence: 'medium',
          citations: [CITATION_ONE],
        },
        {
          topic: 'deployment-and-operations',
          basis: 'inference',
          statement: 'A synthetic operational limitation is inferable.',
          rationale: 'The supplied artifacts require a bounded bridge.',
          confidence: 'low',
          citations: [CITATION_TWO],
        },
      ],
      contradictions: [
        {
          topic: 'maintenance-and-support',
          kind: 'version-dependent',
          explanation: 'Two synthetic version positions differ.',
          positions: [
            {
              statement: 'Synthetic position A applies.',
              citations: [CITATION_ONE],
            },
            {
              statement: 'Synthetic position B applies.',
              citations: [CITATION_TWO],
            },
          ],
        },
      ],
      unknowns: [
        {
          topic: 'security-and-trust',
          reason: 'insufficient-detail',
          statement:
            'The supplied artifact set does not establish one synthetic trust detail.',
          partialCitations: [CITATION_ONE],
        },
      ],
    });
    expect(
      value.citations.every((item) => item.citationId.startsWith('intcite-')),
    ).toBe(true);
    expect(
      value.claims.every((item) => item.claimId.startsWith('intclaim-')),
    ).toBe(true);
    expect(
      value.limitations.every((item) =>
        item.limitationId.startsWith('intlimit-'),
      ),
    ).toBe(true);
    expect(
      value.contradictions.every((item) =>
        item.contradictionId.startsWith('intcontra-'),
      ),
    ).toBe(true);
    expect(
      value.unknowns.every((item) => item.unknownId.startsWith('intunknown-')),
    ).toBe(true);
    expect(value.processingState).toBe('partial-evidence');
  });

  it('canonicalizes contradiction position order', () => {
    const request = createRepositoryInterviewRequestV1(requestInput());
    const execution = createModelExecutionV1(executionInput(request));
    const base = interviewInput(request, execution);
    const positionA = {
      statement: 'Synthetic position A.',
      citations: [CITATION_ONE],
    };
    const positionB = {
      statement: 'Synthetic position B.',
      citations: [CITATION_TWO],
    };
    const make = (
      positions: RepositoryInterviewInputV1['contradictions'][number]['positions'],
    ) =>
      createRepositoryInterviewV1({
        ...base,
        contradictions: [
          {
            topic: 'adoption-and-limitations',
            kind: 'direct',
            explanation: 'The two synthetic positions conflict.',
            positions,
          },
        ],
      });
    expect(make([positionA, positionB])).toEqual(make([positionB, positionA]));
  });

  it('keeps canonically equivalent Unicode byte-distinct', () => {
    const request = createRepositoryInterviewRequestV1(requestInput());
    const execution = createModelExecutionV1(executionInput(request));
    const make = (statement: string) =>
      createRepositoryInterviewV1(
        interviewInput(request, execution, {
          claims: interviewInput(request, execution).claims.map(
            (claim, index) => (index === 0 ? { ...claim, statement } : claim),
          ),
        }),
      );
    expect(make('Caf\u00e9 is synthetic.').identityDigest).not.toBe(
      make('Cafe\u0301 is synthetic.').identityDigest,
    );
  });

  it('canonicalizes citation references and rejects unsafe semantic strings', () => {
    const request = createRepositoryInterviewRequestV1(requestInput());
    const execution = createModelExecutionV1(executionInput(request));
    const base = interviewInput(request, execution);
    const make = (
      citations: RepositoryInterviewInputV1['claims'][number]['citations'],
    ) =>
      createRepositoryInterviewV1({
        ...base,
        claims: base.claims.map((claim, index) =>
          index === 0 ? { ...claim, citations } : claim,
        ),
      });
    expect(make([CITATION_ONE, CITATION_TWO])).toEqual(
      make([CITATION_TWO, CITATION_ONE]),
    );
    for (const statement of [
      ' leading',
      'trailing ',
      'Synthetic https://example.com value.',
      'Synthetic [link](relative) value.',
      'Synthetic <script>active</script> value.',
      'Synthetic\u0000value.',
      'Synthetic\u200bvalue.',
      '😀'.repeat(501),
      'é'.repeat(1_025),
    ]) {
      expect(() =>
        createRepositoryInterviewV1({
          ...base,
          claims: base.claims.map((claim, index) =>
            index === 0 ? { ...claim, statement } : claim,
          ),
        }),
      ).toThrow(/invalid/u);
    }
  });

  it('derives partial and insufficient evidence states', () => {
    const request = createRepositoryInterviewRequestV1(requestInput());
    const execution = createModelExecutionV1(executionInput(request));
    const base = interviewInput(request, execution);
    const unknowns = (
      topics: readonly (typeof REPOSITORY_INTERVIEW_TOPICS)[number][],
    ) =>
      topics.map((topic, index) => ({
        topic,
        reason: 'not-documented' as const,
        statement: `The supplied artifact set does not establish synthetic topic ${String(index + 1)}.`,
        partialCitations: [],
      }));
    expect(
      createRepositoryInterviewV1({
        ...base,
        claims: base.claims.slice(0, 1),
        unknowns: unknowns(REPOSITORY_INTERVIEW_TOPICS.slice(1)),
        citations: [CITATION_ONE],
      }).processingState,
    ).toBe('partial-evidence');
    expect(
      createRepositoryInterviewV1({
        ...base,
        claims: [],
        unknowns: unknowns(REPOSITORY_INTERVIEW_TOPICS),
        citations: [],
      }).processingState,
    ).toBe('insufficient-evidence');
  });

  it('rejects duplicate semantics, unresolved references, and orphan citations', () => {
    const request = createRepositoryInterviewRequestV1(requestInput());
    const execution = createModelExecutionV1(executionInput(request));
    const input = interviewInput(request, execution);
    expect(() =>
      createRepositoryInterviewV1({
        ...input,
        claims: [input.claims[0]!, input.claims[0]!, ...input.claims.slice(1)],
      }),
    ).toThrow(/invalid/u);
    expect(() =>
      createRepositoryInterviewV1({
        ...input,
        citations: [...input.citations, CITATION_ONE],
      }),
    ).toThrow(/invalid/u);
    const durable = createRepositoryInterviewV1(input);
    expectRejected(
      parseRepositoryInterviewV1({
        ...durable,
        claims: [
          {
            ...durable.claims[0]!,
            citationIds: [`intcite-${'0'.repeat(48)}`],
          },
          ...durable.claims.slice(1),
        ],
      }),
    );
    expectRejected(
      parseRepositoryInterviewV1({
        ...durable,
        citations: [
          ...durable.citations,
          {
            ...durable.citations[0]!,
            citationId: `intcite-${'f'.repeat(48)}`,
            identityDigest: 'f'.repeat(64),
            recordDigest: 'f'.repeat(64),
          },
        ],
      }),
    );
    expect(() =>
      createRepositoryInterviewV1({
        ...input,
        claims: input.claims.slice(0, -1),
      }),
    ).toThrow(/invalid/u);
    expect(() =>
      createRepositoryInterviewV1({
        ...input,
        limitations: [
          {
            topic: 'adoption-and-limitations',
            basis: 'documented-position',
            statement: 'Synthetic limitation.',
            rationale: 'Invalid rationale.',
            confidence: 'low',
            citations: [CITATION_ONE],
          } as never,
        ],
      }),
    ).toThrow(/invalid/u);
    expect(() =>
      createRepositoryInterviewV1({
        ...input,
        unknowns: [
          {
            topic: 'security-and-trust',
            reason: 'not-documented',
            statement: 'Authentication does not exist anywhere.',
            partialCitations: [],
          },
        ],
      }),
    ).toThrow(/invalid/u);
  });

  it('keeps publication time record-only and excludes deferred state', () => {
    const request = createRepositoryInterviewRequestV1(requestInput());
    const execution = createModelExecutionV1(executionInput(request));
    const first = createRepositoryInterviewV1(
      interviewInput(request, execution),
    );
    const second = createRepositoryInterviewV1(
      interviewInput(request, execution, {
        publishedAt: '2026-07-30T12:02:00.000Z',
      }),
    );
    expect(second.identityDigest).toBe(first.identityDigest);
    expect(second.recordDigest).not.toBe(first.recordDigest);
    expect(JSON.stringify(first)).not.toMatch(
      /reviewState|accepted|selected|current|dossier|capabilityRequest|targetRepository|ranking|recommendation|promptText|artifactText|providerResponse|reasoningText|rawError/u,
    );
    expectRejected(
      parseRepositoryInterviewV1({ ...first, reviewState: 'unreviewed' }),
    );
  });

  it('validates cross-root provenance and rejects failed ownership', () => {
    const request = createRepositoryInterviewRequestV1(requestInput());
    const execution = createModelExecutionV1(executionInput(request));
    const interview = createRepositoryInterviewV1(
      interviewInput(request, execution),
    );
    expect(
      validateRepositoryInterviewExecutionV1(request, execution, interview),
    ).toMatchObject({ ok: true });
    const another = createRepositoryInterviewRequestV1(
      requestInput({ candidateId: 'another-candidate' }),
    );
    expect(
      validateRepositoryInterviewExecutionV1(another, execution, interview),
    ).toMatchObject({ ok: false });
    const failed = createModelExecutionV1(
      executionInput(request, {
        outcome: {
          status: 'failed',
          failureCode: 'provider-error',
          providerOutputDigest: null,
          usage: null,
        },
      }),
    );
    expect(
      validateRepositoryInterviewExecutionV1(request, failed, interview),
    ).toMatchObject({ ok: false });
    expect(
      validateRepositoryInterviewExecutionV1(request, execution, {
        ...interview,
        providerProjectionDigest: 'f'.repeat(64),
      }),
    ).toMatchObject({ ok: false });
  });

  it('requires publication at or after execution completion', () => {
    const request = createRepositoryInterviewRequestV1(requestInput());
    const execution = createModelExecutionV1(executionInput(request));
    const beforeCompletion = createRepositoryInterviewV1(
      interviewInput(request, execution, {
        publishedAt: '2026-07-30T12:00:00.999Z',
      }),
    );
    expect(
      validateRepositoryInterviewExecutionV1(
        request,
        execution,
        beforeCompletion,
      ),
    ).toMatchObject({ ok: false });

    const atCompletion = createRepositoryInterviewV1(
      interviewInput(request, execution, {
        publishedAt: execution.completedAt,
      }),
    );
    expect(
      validateRepositoryInterviewExecutionV1(request, execution, atCompletion),
    ).toMatchObject({ ok: true });
  });
});

describe('schema compatibility', () => {
  it('retains interview roots alongside additive taxonomy, query, and profile roots', () => {
    expect(CONTRACT_SCHEMA_NAMES).toEqual([
      'candidate-dossier',
      'capability-request',
      'error-envelope',
      'fit-assessment-request',
      'fit-assessment-response',
      'repository-artifact',
      'repository-artifact-chunk',
      'repository-artifact-set',
      'repository-fingerprint',
      'repository-interview-request',
      'model-execution',
      'repository-interview',
      'capability-taxonomy',
      'capability-taxonomy-source',
      'capability-query-input',
      'capability-query-normalization-result',
      'deterministic-candidate-profile',
      'deterministic-candidate-profile-authority',
      'candidate-retrieval-request',
      'candidate-retrieval-result',
      'capability-retrieval-expansion',
      'capability-retrieval-expansion-source',
      'candidate-retrieval-metadata-authority',
      'oss-recommendation-request',
      'target-fit-assessment-response',
      'recommendation-assessment-response',
      'recommendation-assessment-model-response',
    ]);
    for (const [name, digest] of Object.entries(EXISTING_SCHEMA_DIGESTS)) {
      expect(
        createHash('sha256')
          .update(serializeContractSchemaV1(name as never))
          .digest('hex'),
      ).toBe(digest);
    }
    for (const name of [
      'repository-interview-request',
      'model-execution',
      'repository-interview',
    ] as const) {
      expect(serializeContractSchemaV1(name)).toBe(
        serializeContractSchemaV1(name),
      );
      expect(getContractSchemaV1(name)).toMatchObject({
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        additionalProperties: false,
      });
    }
  });
});
