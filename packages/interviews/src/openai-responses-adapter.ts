import {
  parseModelExecutionModelProfileV1,
  type ModelExecutionAttemptV1,
  type ModelExecutionModelProfileV1,
  type ModelExecutionUsageV1,
} from '@gitblocks/contracts';

import {
  type RepositoryInterviewProviderEffectResultV1,
  type RepositoryInterviewProviderPortV1,
  type RepositoryInterviewProviderRequestV1,
} from './repository-interview-application.ts';
import {
  REPOSITORY_INTERVIEW_PROMPT_BOUNDS,
  isValidatedRenderedRepositoryInterviewPromptV1,
  repositoryInterviewPromptDigest,
  type RenderedRepositoryInterviewPromptV1,
} from './repository-interview-prompt.ts';
import {
  getOpenAiStrictSchemaSnapshot,
  OPENAI_RESPONSES_STRICT_PROJECTION_VERSION,
} from './schema-projection.ts';
import {
  REPOSITORY_INTERVIEW_RENDERER_VERSION,
  REPOSITORY_INTERVIEW_SPECIFICATION_VERSION,
} from './specification.ts';
import { sha256Digest } from './canonical-json.ts';

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const CONFIGURATION_ERROR =
  'OpenAI repository interview provider configuration failed.';
const OPERATION_ERROR =
  'OpenAI repository interview provider operation failed.';
const PROVIDER_IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;
const CONTRACT_TIMESTAMP_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?Z$/u;
const AUTHORIZED_MODELS = new Set([
  'gpt-5.4-2026-03-05',
  'gpt-5.4-mini-2026-03-17',
]);
const PROVIDER_REQUEST_KEYS = Object.freeze([
  'prompt',
  'modelProfile',
  'providerProjectionVersion',
  'providerProjectionDigest',
  'providerProjectionText',
] as const);
const PROMPT_KEYS = Object.freeze([
  'candidateId',
  'artifactSetId',
  'artifactSetIdentityDigest',
  'rendererVersion',
  'specificationVersion',
  'specificationDigest',
  'instructionText',
  'evidenceText',
  'promptDigest',
  'aliasBindings',
  'instructionUtf8Bytes',
  'evidenceUtf8Bytes',
  'artifactUtf8Bytes',
  'totalLogicalLines',
] as const);

const OPENAI_RESPONSES_REPOSITORY_INTERVIEW_LIMITS = Object.freeze({
  maximumRequestBytes: 10_485_760,
  maximumAttempts: 2,
  attemptDeadlineMilliseconds: 120_000,
  operationDeadlineMilliseconds: 300_000,
  fallbackRetryDelayMilliseconds: 1_000,
  maximumRetryAfterMilliseconds: 30_000,
} as const);

export interface RepositoryInterviewOpenAiCredentialPortV1 {
  getBearerToken(): Promise<string>;
}

export type RepositoryInterviewOpenAiFetchV1 = (
  url: string,
  init: RequestInit,
) => Promise<Response>;

export interface RepositoryInterviewOpenAiClockReadingV1 {
  readonly timestamp: string;
  readonly monotonicMilliseconds: number;
}

export interface RepositoryInterviewOpenAiClockPortV1 {
  now(): RepositoryInterviewOpenAiClockReadingV1;
}

export interface RepositoryInterviewOpenAiSleeperPortV1 {
  sleep(milliseconds: number): Promise<void>;
}

export type RepositoryInterviewOpenAiAttemptOutcomeV1 =
  'completed' | 'deadline-exceeded' | 'cancelled';

export interface RepositoryInterviewOpenAiAttemptControlV1 {
  readonly signal: AbortSignal;
  outcome(): RepositoryInterviewOpenAiAttemptOutcomeV1;
  dispose(): void;
}

export interface RepositoryInterviewOpenAiAttemptControlPortV1 {
  beginAttempt(input: {
    readonly ordinal: 1 | 2;
    readonly timeoutMilliseconds: 120_000;
  }): RepositoryInterviewOpenAiAttemptControlV1;
}

export interface OpenAiResponsesRepositoryInterviewProviderDependenciesV1 {
  readonly credential: RepositoryInterviewOpenAiCredentialPortV1;
  readonly fetch: RepositoryInterviewOpenAiFetchV1;
  readonly clock: RepositoryInterviewOpenAiClockPortV1;
  readonly sleeper: RepositoryInterviewOpenAiSleeperPortV1;
  readonly attemptControl: RepositoryInterviewOpenAiAttemptControlPortV1;
}

type FailedEffect = Extract<
  RepositoryInterviewProviderEffectResultV1,
  { readonly status: 'failed' }
>;
type FailureCode = FailedEffect['failureCode'];

interface PreflightResult {
  readonly request: RepositoryInterviewProviderRequestV1;
  readonly modelProfile: ModelExecutionModelProfileV1;
  readonly requestBody: string;
}

interface ClockState {
  lastTimestampMilliseconds: number | null;
  lastMonotonicMilliseconds: number | null;
}

interface SafeHeaders {
  readonly providerRequestId: string | null;
  readonly providerProcessingMilliseconds: number | null;
  readonly retryAfter: string | null;
  readonly remainingRequests: number | null;
  readonly remainingTokens: number | null;
  readonly resetRequestsMilliseconds: number | null;
  readonly resetTokensMilliseconds: number | null;
}

interface ResponseBodyRead {
  readonly status: 'complete' | 'too-large' | 'invalid-utf8';
  readonly text: string | null;
  readonly responseBytes: number;
}

interface ProtocolResponse {
  readonly effect:
    | {
        readonly status: 'response';
        readonly usage: ModelExecutionUsageV1;
        readonly providerOutput: unknown;
      }
    | {
        readonly status: 'failed';
        readonly failureCode: FailureCode;
        readonly usage: ModelExecutionUsageV1 | null;
      };
  readonly responseId: string | null;
  readonly retryable: boolean;
}

interface AttemptResult {
  readonly attempt: ModelExecutionAttemptV1;
  readonly effect:
    | {
        readonly status: 'response';
        readonly usage: ModelExecutionUsageV1;
        readonly providerOutput: unknown;
      }
    | {
        readonly status: 'failed';
        readonly failureCode: FailureCode;
        readonly usage: ModelExecutionUsageV1 | null;
      };
  readonly retryable: boolean;
}

export function createOpenAiResponsesRepositoryInterviewProviderV1(
  dependencies: OpenAiResponsesRepositoryInterviewProviderDependenciesV1,
): RepositoryInterviewProviderPortV1 {
  return Object.freeze({
    execute: async (
      input: RepositoryInterviewProviderRequestV1,
    ): Promise<RepositoryInterviewProviderEffectResultV1> => {
      const preflight = preflightProviderRequest(input);
      let credential: string;
      try {
        credential = await dependencies.credential.getBearerToken();
      } catch {
        throw configurationError();
      }
      if (!isSafeCredential(credential)) {
        throw configurationError();
      }

      const attempts: ModelExecutionAttemptV1[] = [];
      const clockState: ClockState = {
        lastTimestampMilliseconds: null,
        lastMonotonicMilliseconds: null,
      };
      const operationStart = readClock(dependencies.clock, clockState);

      for (
        let ordinal = 1;
        ordinal <= OPENAI_RESPONSES_REPOSITORY_INTERVIEW_LIMITS.maximumAttempts;
        ordinal += 1
      ) {
        const start =
          ordinal === 1
            ? operationStart
            : readClock(dependencies.clock, clockState);
        const attempt = await executeAttempt(
          ordinal as 1 | 2,
          start,
          credential,
          preflight,
          dependencies,
          clockState,
        );
        attempts.push(attempt.attempt);

        if (!attempt.retryable || ordinal === 2) {
          return ownedResult(attempt.effect, attempts);
        }

        const retryDelay =
          attempt.attempt.retryAfterMilliseconds ??
          OPENAI_RESPONSES_REPOSITORY_INTERVIEW_LIMITS.fallbackRetryDelayMilliseconds;
        const elapsed =
          (clockState.lastMonotonicMilliseconds ??
            operationStart.monotonicMilliseconds) -
          operationStart.monotonicMilliseconds;
        const requiredRemaining =
          retryDelay +
          OPENAI_RESPONSES_REPOSITORY_INTERVIEW_LIMITS.attemptDeadlineMilliseconds;
        if (
          elapsed + requiredRemaining >
          OPENAI_RESPONSES_REPOSITORY_INTERVIEW_LIMITS.operationDeadlineMilliseconds
        ) {
          return ownedResult(attempt.effect, attempts);
        }
        try {
          await dependencies.sleeper.sleep(retryDelay);
        } catch {
          throw operationError();
        }
      }
      throw operationError();
    },
  });
}

async function executeAttempt(
  ordinal: 1 | 2,
  start: RepositoryInterviewOpenAiClockReadingV1,
  credential: string,
  preflight: PreflightResult,
  dependencies: OpenAiResponsesRepositoryInterviewProviderDependenciesV1,
  clockState: ClockState,
): Promise<AttemptResult> {
  let control: RepositoryInterviewOpenAiAttemptControlV1;
  try {
    control = dependencies.attemptControl.beginAttempt({
      ordinal,
      timeoutMilliseconds:
        OPENAI_RESPONSES_REPOSITORY_INTERVIEW_LIMITS.attemptDeadlineMilliseconds,
    });
  } catch {
    throw operationError();
  }

  try {
    let response: Response;
    try {
      response = await dependencies.fetch(OPENAI_RESPONSES_URL, {
        method: 'POST',
        redirect: 'error',
        signal: control.signal,
        headers: {
          Authorization: `Bearer ${credential}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: preflight.requestBody,
      });
    } catch {
      const completion = readClock(dependencies.clock, clockState);
      const outcome = safeAttemptOutcome(control);
      const transportOutcome =
        outcome === 'deadline-exceeded'
          ? 'deadline-exceeded'
          : outcome === 'cancelled'
            ? 'cancelled'
            : 'network-error';
      const failureCode: FailureCode =
        transportOutcome === 'deadline-exceeded'
          ? 'deadline-exceeded'
          : transportOutcome === 'cancelled'
            ? 'cancelled'
            : 'transport-error';
      return {
        attempt: transportAttempt(
          ordinal,
          start.timestamp,
          completion.timestamp,
          transportOutcome,
        ),
        effect: { status: 'failed', failureCode, usage: null },
        retryable: transportOutcome !== 'cancelled',
      };
    }

    const status = safeHttpStatus(response);
    const safeHeaders = captureSafeHeaders(response.headers);
    let body: ResponseBodyRead;
    try {
      body = await readBoundedResponseBody(
        response,
        preflight.modelProfile.maximumResponseBytes,
      );
    } catch {
      const completion = readClock(dependencies.clock, clockState);
      const outcome = safeAttemptOutcome(control);
      const transportOutcome =
        outcome === 'deadline-exceeded'
          ? 'deadline-exceeded'
          : outcome === 'cancelled'
            ? 'cancelled'
            : 'network-error';
      const failureCode: FailureCode =
        transportOutcome === 'deadline-exceeded'
          ? 'deadline-exceeded'
          : transportOutcome === 'cancelled'
            ? 'cancelled'
            : 'transport-error';
      return {
        attempt: transportAttempt(
          ordinal,
          start.timestamp,
          completion.timestamp,
          transportOutcome,
        ),
        effect: { status: 'failed', failureCode, usage: null },
        retryable: transportOutcome !== 'cancelled',
      };
    }
    const completion = readClock(dependencies.clock, clockState);
    const parsedHeaders = parseSafeHeaders(safeHeaders, completion.timestamp);

    if (body.status === 'too-large') {
      return {
        attempt: responseAttempt(
          ordinal,
          start.timestamp,
          completion.timestamp,
          status,
          parsedHeaders,
          null,
          body.responseBytes,
        ),
        effect: {
          status: 'failed',
          failureCode: 'response-too-large',
          usage: null,
        },
        retryable: false,
      };
    }
    if (body.status === 'invalid-utf8' || body.text === null) {
      return {
        attempt: responseAttempt(
          ordinal,
          start.timestamp,
          completion.timestamp,
          status,
          parsedHeaders,
          null,
          body.responseBytes,
        ),
        effect: {
          status: 'failed',
          failureCode: 'invalid-response',
          usage: null,
        },
        retryable: false,
      };
    }

    if (status < 200 || status > 299) {
      const http = parseHttpFailure(status, body.text);
      return {
        attempt: responseAttempt(
          ordinal,
          start.timestamp,
          completion.timestamp,
          status,
          parsedHeaders,
          null,
          body.responseBytes,
        ),
        effect: {
          status: 'failed',
          failureCode: http.failureCode,
          usage: null,
        },
        retryable: http.retryable,
      };
    }

    const protocol = parseSuccessfulResponse(
      body.text,
      preflight.modelProfile.modelSnapshot,
    );
    if (
      protocol.effect.status === 'failed' &&
      protocol.effect.failureCode === 'cancelled'
    ) {
      return {
        attempt: transportAttempt(
          ordinal,
          start.timestamp,
          completion.timestamp,
          'cancelled',
        ),
        effect: protocol.effect,
        retryable: false,
      };
    }
    return {
      attempt: responseAttempt(
        ordinal,
        start.timestamp,
        completion.timestamp,
        status,
        parsedHeaders,
        protocol.responseId,
        body.responseBytes,
      ),
      effect: protocol.effect,
      retryable: protocol.retryable,
    };
  } finally {
    try {
      control.dispose();
    } catch {
      // Cleanup cannot replace an already classified provider outcome.
    }
  }
}

function preflightProviderRequest(value: unknown): PreflightResult {
  const fields = readExactDataProperties(value, PROVIDER_REQUEST_KEYS);
  if (fields === null) {
    throw configurationError();
  }
  const parsedProfile = parseModelExecutionModelProfileV1(
    fields['modelProfile'],
  );
  if (!parsedProfile.ok) {
    throw configurationError();
  }
  const modelProfile = parsedProfile.value;
  if (
    !AUTHORIZED_MODELS.has(modelProfile.modelSnapshot) ||
    fields['providerProjectionVersion'] !==
      modelProfile.providerProjectionVersion ||
    fields['providerProjectionDigest'] !==
      modelProfile.providerProjectionDigest ||
    fields['providerProjectionVersion'] !==
      OPENAI_RESPONSES_STRICT_PROJECTION_VERSION ||
    typeof fields['providerProjectionText'] !== 'string' ||
    sha256Digest(fields['providerProjectionText']) !==
      modelProfile.providerProjectionDigest ||
    fields['providerProjectionText'] !== getOpenAiStrictSchemaSnapshot()
  ) {
    throw configurationError();
  }
  const prompt = validatePrompt(fields['prompt']);
  let schema: unknown;
  try {
    schema = copyOwnedJson(JSON.parse(fields['providerProjectionText']), {
      maximumDepth: 32,
      maximumNodes: 10_000,
      maximumArrayItems: 1_000,
      maximumObjectProperties: 1_000,
      maximumStringBytes: 262_144,
    });
  } catch {
    throw configurationError();
  }
  const requestBody = JSON.stringify({
    model: modelProfile.modelSnapshot,
    input: [
      {
        role: 'developer',
        content: [{ type: 'input_text', text: prompt.instructionText }],
      },
      {
        role: 'user',
        content: [{ type: 'input_text', text: prompt.evidenceText }],
      },
    ],
    reasoning: { effort: modelProfile.reasoningEffort },
    text: {
      format: {
        type: 'json_schema',
        name: 'repository_interview_v1',
        schema,
        strict: true,
      },
    },
    max_output_tokens: modelProfile.maximumOutputTokens,
    store: false,
    background: false,
    stream: false,
    tools: [],
    truncation: 'disabled',
    service_tier: 'default',
    prompt_cache_retention: 'in_memory',
  });
  if (
    utf8ByteLength(requestBody) >
    OPENAI_RESPONSES_REPOSITORY_INTERVIEW_LIMITS.maximumRequestBytes
  ) {
    throw configurationError();
  }
  return {
    request: value as RepositoryInterviewProviderRequestV1,
    modelProfile,
    requestBody,
  };
}

function validatePrompt(value: unknown): RenderedRepositoryInterviewPromptV1 {
  const fields = readExactDataProperties(value, PROMPT_KEYS);
  if (
    fields === null ||
    !Object.isFrozen(value) ||
    !isValidatedRenderedRepositoryInterviewPromptV1(value)
  ) {
    throw configurationError();
  }
  const stringKeys = [
    'candidateId',
    'artifactSetId',
    'artifactSetIdentityDigest',
    'rendererVersion',
    'specificationVersion',
    'specificationDigest',
    'instructionText',
    'evidenceText',
    'promptDigest',
  ] as const;
  if (stringKeys.some((key) => typeof fields[key] !== 'string')) {
    throw configurationError();
  }
  const instructionText = fields['instructionText'] as string;
  const evidenceText = fields['evidenceText'] as string;
  const instructionBytes = utf8ByteLength(instructionText);
  const evidenceBytes = utf8ByteLength(evidenceText);
  if (
    fields['rendererVersion'] !== REPOSITORY_INTERVIEW_RENDERER_VERSION ||
    fields['specificationVersion'] !==
      REPOSITORY_INTERVIEW_SPECIFICATION_VERSION ||
    !isDigest(fields['specificationDigest']) ||
    !isDigest(fields['artifactSetIdentityDigest']) ||
    !isDigest(fields['promptDigest']) ||
    fields['instructionUtf8Bytes'] !== instructionBytes ||
    fields['evidenceUtf8Bytes'] !== evidenceBytes ||
    instructionBytes >
      REPOSITORY_INTERVIEW_PROMPT_BOUNDS.maximumInstructionUtf8Bytes ||
    evidenceBytes >
      REPOSITORY_INTERVIEW_PROMPT_BOUNDS.maximumEvidenceUtf8Bytes ||
    instructionBytes + evidenceBytes >
      REPOSITORY_INTERVIEW_PROMPT_BOUNDS.maximumCombinedUtf8Bytes ||
    !isBoundedInteger(
      fields['artifactUtf8Bytes'],
      REPOSITORY_INTERVIEW_PROMPT_BOUNDS.maximumArtifactUtf8Bytes,
    ) ||
    !isBoundedInteger(
      fields['totalLogicalLines'],
      REPOSITORY_INTERVIEW_PROMPT_BOUNDS.maximumLogicalLines,
    )
  ) {
    throw configurationError();
  }
  const aliases = readPlainArray(
    fields['aliasBindings'],
    REPOSITORY_INTERVIEW_PROMPT_BOUNDS.maximumArtifacts,
  );
  if (aliases === null || !Object.isFrozen(fields['aliasBindings'])) {
    throw configurationError();
  }
  for (const alias of aliases) {
    const binding = readExactDataProperties(alias, [
      'alias',
      'artifactId',
      'artifactKind',
      'artifactSetEntryOrdinal',
      'lineCount',
    ]);
    if (binding === null || !Object.isFrozen(alias)) {
      throw configurationError();
    }
  }
  const expectedDigest = repositoryInterviewPromptDigest({
    rendererVersion: fields['rendererVersion'],
    specificationVersion: fields['specificationVersion'],
    specificationDigest: fields['specificationDigest'],
    instructionText,
    evidenceText,
  });
  if (expectedDigest !== fields['promptDigest']) {
    throw configurationError();
  }
  return value;
}

async function readBoundedResponseBody(
  response: Response,
  maximumBytes: number,
): Promise<ResponseBodyRead> {
  const declaredLength = response.headers.get('content-length');
  if (
    declaredLength !== null &&
    /^\d+$/u.test(declaredLength) &&
    Number(declaredLength) > maximumBytes
  ) {
    await cancelResponseBody(response);
    return { status: 'too-large', text: null, responseBytes: 0 };
  }
  if (response.body === null) {
    return { status: 'invalid-utf8', text: null, responseBytes: 0 };
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const result = await reader.read();
      if (result.done) {
        break;
      }
      if (!(result.value instanceof Uint8Array)) {
        throw operationError();
      }
      const remaining = maximumBytes - total;
      if (result.value.byteLength > remaining) {
        if (remaining > 0) {
          chunks.push(result.value.slice(0, remaining));
        }
        total = maximumBytes;
        await reader.cancel().catch(() => undefined);
        return { status: 'too-large', text: null, responseBytes: total };
      }
      chunks.push(result.value.slice());
      total += result.value.byteLength;
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return {
      status: 'complete',
      text: new TextDecoder('utf-8', { fatal: true }).decode(bytes),
      responseBytes: total,
    };
  } catch {
    return { status: 'invalid-utf8', text: null, responseBytes: total };
  }
}

function parseHttpFailure(
  status: number,
  text: string,
): { readonly failureCode: FailureCode; readonly retryable: boolean } {
  if (status === 401 || status === 403) {
    return { failureCode: 'not-authorized', retryable: false };
  }
  if (status === 402) {
    return { failureCode: 'quota-exceeded', retryable: false };
  }
  if (status === 429) {
    const code = parseProviderErrorCode(text);
    return code === 'insufficient_quota'
      ? { failureCode: 'quota-exceeded', retryable: false }
      : { failureCode: 'rate-limited', retryable: true };
  }
  return {
    failureCode: 'provider-error',
    retryable:
      status === 408 || status === 409 || (status >= 500 && status <= 599),
  };
}

function parseProviderErrorCode(text: string): string | null {
  try {
    const parsed: unknown = JSON.parse(text);
    const root = readDataProperties(parsed);
    const error = readDataProperties(root?.get('error'));
    const code = error?.get('code');
    return typeof code === 'string' && code.length <= 128 ? code : null;
  } catch {
    return null;
  }
}

function parseSuccessfulResponse(
  text: string,
  model: string,
): ProtocolResponse {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return failedProtocol('invalid-response');
  }
  const root = readDataProperties(parsed);
  const object = root?.get('object');
  const returnedModel = root?.get('model');
  const status = root?.get('status');
  const output = readPlainArray(root?.get('output'), 128);
  const responseId = safeProviderIdentifier(root?.get('id'));
  if (
    root === null ||
    object !== 'response' ||
    returnedModel !== model ||
    typeof status !== 'string' ||
    output === null
  ) {
    return failedProtocol('invalid-response', responseId);
  }

  if (status !== 'completed') {
    const optionalUsage = parseUsage(root.get('usage'));
    if (status === 'incomplete') {
      const details = readDataProperties(root.get('incomplete_details'));
      const reason = details?.get('reason');
      return failedProtocol(
        reason === 'content_filter' || reason === 'safety'
          ? 'safety-interrupted'
          : 'incomplete',
        responseId,
        optionalUsage,
      );
    }
    if (status === 'failed') {
      return failedProtocol('provider-error', responseId, optionalUsage);
    }
    if (status === 'cancelled') {
      return failedProtocol('cancelled', responseId, optionalUsage);
    }
    return failedProtocol('invalid-response', responseId, optionalUsage);
  }

  const usage = parseUsage(root.get('usage'));
  if (usage === null) {
    return failedProtocol('invalid-usage', responseId);
  }
  const outputResult = parseCompletedOutput(output);
  if (outputResult.status === 'invalid') {
    return failedProtocol('invalid-response', responseId, usage);
  }
  if (outputResult.status === 'refused') {
    return failedProtocol('refused', responseId, usage);
  }
  return {
    effect: {
      status: 'response',
      usage,
      providerOutput: outputResult.providerOutput,
    },
    responseId,
    retryable: false,
  };
}

function parseCompletedOutput(
  output: readonly unknown[],
):
  | { readonly status: 'valid'; readonly providerOutput: unknown }
  | { readonly status: 'refused' }
  | { readonly status: 'invalid' } {
  let messageValue: unknown = null;
  for (const item of output) {
    const record = readDataProperties(item);
    const type = record?.get('type');
    if (type === 'reasoning') {
      continue;
    }
    if (type !== 'message' || messageValue !== null) {
      return { status: 'invalid' };
    }
    messageValue = item;
  }
  const message = readDataProperties(messageValue);
  const content = readPlainArray(message?.get('content'), 2);
  if (message?.get('role') !== 'assistant' || content?.length !== 1) {
    return { status: 'invalid' };
  }
  const item = readDataProperties(content[0]);
  if (item?.get('type') === 'refusal') {
    return typeof item.get('refusal') === 'string'
      ? { status: 'refused' }
      : { status: 'invalid' };
  }
  const annotations = readPlainArray(item?.get('annotations'), 64);
  const text = item?.get('text');
  if (
    item?.get('type') !== 'output_text' ||
    typeof text !== 'string' ||
    text.length === 0 ||
    annotations?.length !== 0
  ) {
    return { status: 'invalid' };
  }
  try {
    return {
      status: 'valid',
      providerOutput: copyOwnedJson(JSON.parse(text), {
        maximumDepth: 32,
        maximumNodes: 10_000,
        maximumArrayItems: 1_000,
        maximumObjectProperties: 1_000,
        maximumStringBytes: 262_144,
      }),
    };
  } catch {
    return { status: 'valid', providerOutput: null };
  }
}

function parseUsage(value: unknown): ModelExecutionUsageV1 | null {
  const usage = readDataProperties(value);
  const inputDetails = readDataProperties(usage?.get('input_tokens_details'));
  const outputDetails = readDataProperties(usage?.get('output_tokens_details'));
  const inputTokens = usage?.get('input_tokens');
  const cachedInputTokens = inputDetails?.get('cached_tokens');
  const outputTokens = usage?.get('output_tokens');
  const reasoningTokens = outputDetails?.get('reasoning_tokens');
  const totalTokens = usage?.get('total_tokens');
  if (
    !isSafeNonnegativeInteger(inputTokens) ||
    !isSafeNonnegativeInteger(cachedInputTokens) ||
    !isSafeNonnegativeInteger(outputTokens) ||
    !isSafeNonnegativeInteger(reasoningTokens) ||
    !isSafeNonnegativeInteger(totalTokens) ||
    cachedInputTokens > inputTokens ||
    reasoningTokens > outputTokens ||
    totalTokens !== inputTokens + outputTokens
  ) {
    return null;
  }
  return deepFreeze({
    inputTokens,
    cachedInputTokens,
    outputTokens,
    reasoningTokens,
    totalTokens,
  });
}

function failedProtocol(
  failureCode: FailureCode,
  responseId: string | null = null,
  usage: ModelExecutionUsageV1 | null = null,
): ProtocolResponse {
  return {
    effect: { status: 'failed', failureCode, usage },
    responseId,
    retryable: false,
  };
}

function captureSafeHeaders(headers: Headers): SafeHeaders {
  try {
    return {
      providerRequestId: safeProviderIdentifier(headers.get('x-request-id')),
      providerProcessingMilliseconds: canonicalInteger(
        headers.get('openai-processing-ms'),
      ),
      retryAfter: headers.get('retry-after'),
      remainingRequests: canonicalInteger(
        headers.get('x-ratelimit-remaining-requests'),
      ),
      remainingTokens: canonicalInteger(
        headers.get('x-ratelimit-remaining-tokens'),
      ),
      resetRequestsMilliseconds: parseResetDuration(
        headers.get('x-ratelimit-reset-requests'),
      ),
      resetTokensMilliseconds: parseResetDuration(
        headers.get('x-ratelimit-reset-tokens'),
      ),
    };
  } catch {
    return {
      providerRequestId: null,
      providerProcessingMilliseconds: null,
      retryAfter: null,
      remainingRequests: null,
      remainingTokens: null,
      resetRequestsMilliseconds: null,
      resetTokensMilliseconds: null,
    };
  }
}

function parseSafeHeaders(
  captured: SafeHeaders,
  nowTimestamp: string,
): Omit<SafeHeaders, 'retryAfter'> & {
  readonly retryAfterMilliseconds: number | null;
} {
  return {
    providerRequestId: captured.providerRequestId,
    providerProcessingMilliseconds: captured.providerProcessingMilliseconds,
    retryAfterMilliseconds: parseRetryAfter(captured.retryAfter, nowTimestamp),
    remainingRequests: captured.remainingRequests,
    remainingTokens: captured.remainingTokens,
    resetRequestsMilliseconds: captured.resetRequestsMilliseconds,
    resetTokensMilliseconds: captured.resetTokensMilliseconds,
  };
}

function parseRetryAfter(
  value: string | null,
  nowTimestamp: string,
): number | null {
  if (value === null) {
    return null;
  }
  if (/^(?:0|[1-9]\d*)$/u.test(value)) {
    const milliseconds = Number(value) * 1_000;
    return Number.isSafeInteger(milliseconds)
      ? Math.min(
          milliseconds,
          OPENAI_RESPONSES_REPOSITORY_INTERVIEW_LIMITS.maximumRetryAfterMilliseconds,
        )
      : null;
  }
  if (!isValidHttpDate(value)) {
    return null;
  }
  const retryAt = Date.parse(value);
  const now = timestampMilliseconds(nowTimestamp);
  if (!Number.isFinite(retryAt) || now === null || retryAt <= now) {
    return null;
  }
  const milliseconds = retryAt - now;
  return Number.isSafeInteger(milliseconds)
    ? Math.min(
        milliseconds,
        OPENAI_RESPONSES_REPOSITORY_INTERVIEW_LIMITS.maximumRetryAfterMilliseconds,
      )
    : null;
}

function isValidHttpDate(value: string): boolean {
  const match =
    /^(Sun|Mon|Tue|Wed|Thu|Fri|Sat), (\d{2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{4}) (\d{2}):(\d{2}):(\d{2}) GMT$/u.exec(
      value,
    );
  if (match === null) {
    return false;
  }
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const weekday = match[1];
  const day = Number(match[2]);
  const month = months.indexOf(match[3] ?? '') + 1;
  const year = Number(match[4]);
  const hour = Number(match[5]);
  const minute = Number(match[6]);
  const second = Number(match[7]);
  if (
    weekday === undefined ||
    month < 1 ||
    year < 1 ||
    day < 1 ||
    day > daysInMonth(year, month) ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  ) {
    return false;
  }
  const offsets = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
  const adjustedYear = month < 3 ? year - 1 : year;
  const weekdayIndex =
    (adjustedYear +
      Math.floor(adjustedYear / 4) -
      Math.floor(adjustedYear / 100) +
      Math.floor(adjustedYear / 400) +
      (offsets[month - 1] ?? 0) +
      day) %
    7;
  return weekdays[weekdayIndex] === weekday;
}

function parseResetDuration(value: string | null): number | null {
  if (value === null || !/^(?:\d+(?:ms|s|m|h))+$/u.test(value)) {
    return null;
  }
  const units: Readonly<Record<string, number>> = {
    ms: 1,
    s: 1_000,
    m: 60_000,
    h: 3_600_000,
  };
  const matcher = /(\d+)(ms|s|m|h)/gu;
  let total = 0;
  let consumed = '';
  for (const match of value.matchAll(matcher)) {
    const amountText = match[1];
    const unit = match[2];
    if (amountText === undefined || unit === undefined) {
      return null;
    }
    const amount = Number(amountText);
    const multiplier = units[unit];
    if (!Number.isSafeInteger(amount) || multiplier === undefined) {
      return null;
    }
    total += amount * multiplier;
    if (!Number.isSafeInteger(total)) {
      return null;
    }
    consumed += match[0];
  }
  return consumed === value ? total : null;
}

function canonicalInteger(value: string | null): number | null {
  if (value === null || !/^(?:0|[1-9]\d*)$/u.test(value)) {
    return null;
  }
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function responseAttempt(
  ordinal: 1 | 2,
  startedAt: string,
  completedAt: string,
  httpStatus: number,
  headers: ReturnType<typeof parseSafeHeaders>,
  responseId: string | null,
  responseBytes: number,
): ModelExecutionAttemptV1 {
  return deepFreeze({
    ordinal,
    startedAt,
    completedAt,
    transportOutcome: 'response' as const,
    httpStatus,
    providerRequestId: headers.providerRequestId,
    responseId,
    responseBytes,
    providerProcessingMilliseconds: headers.providerProcessingMilliseconds,
    retryAfterMilliseconds: headers.retryAfterMilliseconds,
    remainingRequests: headers.remainingRequests,
    remainingTokens: headers.remainingTokens,
    resetRequestsMilliseconds: headers.resetRequestsMilliseconds,
    resetTokensMilliseconds: headers.resetTokensMilliseconds,
  });
}

function transportAttempt(
  ordinal: 1 | 2,
  startedAt: string,
  completedAt: string,
  transportOutcome: 'network-error' | 'deadline-exceeded' | 'cancelled',
): ModelExecutionAttemptV1 {
  return deepFreeze({
    ordinal,
    startedAt,
    completedAt,
    transportOutcome,
    httpStatus: null,
    providerRequestId: null,
    responseId: null,
    responseBytes: 0,
    providerProcessingMilliseconds: null,
    retryAfterMilliseconds: null,
    remainingRequests: null,
    remainingTokens: null,
    resetRequestsMilliseconds: null,
    resetTokensMilliseconds: null,
  });
}

function ownedResult(
  effect: AttemptResult['effect'],
  attempts: readonly ModelExecutionAttemptV1[],
): RepositoryInterviewProviderEffectResultV1 {
  return effect.status === 'response'
    ? deepFreeze({
        status: 'response',
        attempts: [...attempts],
        usage: { ...effect.usage },
        providerOutput: effect.providerOutput,
      })
    : deepFreeze({
        status: 'failed',
        attempts: [...attempts],
        failureCode: effect.failureCode,
        usage: effect.usage === null ? null : { ...effect.usage },
      });
}

function readClock(
  clock: RepositoryInterviewOpenAiClockPortV1,
  state: ClockState,
): RepositoryInterviewOpenAiClockReadingV1 {
  let reading: RepositoryInterviewOpenAiClockReadingV1;
  try {
    reading = clock.now();
  } catch {
    throw operationError();
  }
  const milliseconds = timestampMilliseconds(reading.timestamp);
  if (
    milliseconds === null ||
    !Number.isSafeInteger(reading.monotonicMilliseconds) ||
    reading.monotonicMilliseconds < 0 ||
    (state.lastTimestampMilliseconds !== null &&
      milliseconds < state.lastTimestampMilliseconds) ||
    (state.lastMonotonicMilliseconds !== null &&
      reading.monotonicMilliseconds < state.lastMonotonicMilliseconds)
  ) {
    throw operationError();
  }
  state.lastTimestampMilliseconds = milliseconds;
  state.lastMonotonicMilliseconds = reading.monotonicMilliseconds;
  return { ...reading };
}

function timestampMilliseconds(value: string): number | null {
  const match = CONTRACT_TIMESTAMP_PATTERN.exec(value);
  if (match === null) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const fraction = match[7] ?? '';
  const yearText = match[1];
  const monthText = match[2];
  const dayText = match[3];
  const hourText = match[4];
  const minuteText = match[5];
  const secondText = match[6];
  if (
    yearText === undefined ||
    monthText === undefined ||
    dayText === undefined ||
    hourText === undefined ||
    minuteText === undefined ||
    secondText === undefined ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth(year, month) ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  ) {
    return null;
  }
  const parsed = Date.parse(
    `${yearText}-${monthText}-${dayText}T${hourText}:${minuteText}:${secondText}.${fraction.padEnd(3, '0')}Z`,
  );
  return Number.isFinite(parsed) ? parsed : null;
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function safeAttemptOutcome(
  control: RepositoryInterviewOpenAiAttemptControlV1,
): RepositoryInterviewOpenAiAttemptOutcomeV1 {
  try {
    const outcome: unknown = control.outcome();
    if (
      outcome === 'completed' ||
      outcome === 'deadline-exceeded' ||
      outcome === 'cancelled'
    ) {
      return outcome;
    }
  } catch {
    // Fall through to the value-free adapter error.
  }
  throw operationError();
}

function safeHttpStatus(response: Response): number {
  let status: number;
  try {
    status = response.status;
  } catch {
    throw operationError();
  }
  if (!Number.isInteger(status) || status < 100 || status > 599) {
    throw operationError();
  }
  return status;
}

function safeProviderIdentifier(value: unknown): string | null {
  return typeof value === 'string' && PROVIDER_IDENTIFIER_PATTERN.test(value)
    ? value
    : null;
}

function isSafeCredential(value: unknown): value is string {
  if (typeof value !== 'string' || value.length < 1 || value.length > 1_024) {
    return false;
  }
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 33 || code > 126) {
      return false;
    }
  }
  return true;
}

function isDigest(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{64}$/u.test(value);
}

function isBoundedInteger(value: unknown, maximum: number): value is number {
  return (
    Number.isInteger(value) && Number(value) >= 0 && Number(value) <= maximum
  );
}

function isSafeNonnegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function utf8ByteLength(value: string): number {
  return Buffer.byteLength(value, 'utf8');
}

function readExactDataProperties(
  value: unknown,
  expectedKeys: readonly string[],
): Readonly<Record<string, unknown>> | null {
  const properties = readDataProperties(value);
  if (properties === null) {
    return null;
  }
  const actual = [...properties.keys()].sort(compareText);
  const expected = [...expectedKeys].sort(compareText);
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) {
    return null;
  }
  return Object.fromEntries(properties);
}

function readDataProperties(
  value: unknown,
): ReadonlyMap<string, unknown> | null {
  try {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return null;
    }
    const prototype = Reflect.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      return null;
    }
    const keys = Reflect.ownKeys(value);
    if (keys.some((key) => typeof key !== 'string')) {
      return null;
    }
    const properties = new Map<string, unknown>();
    for (const key of keys as string[]) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        descriptor === undefined ||
        !descriptor.enumerable ||
        !('value' in descriptor)
      ) {
        return null;
      }
      properties.set(key, descriptor.value);
    }
    return properties;
  } catch {
    return null;
  }
}

function readPlainArray(
  value: unknown,
  maximum: number,
): readonly unknown[] | null {
  try {
    if (
      !Array.isArray(value) ||
      Reflect.getPrototypeOf(value) !== Array.prototype ||
      value.length > maximum
    ) {
      return null;
    }
    const keys = Reflect.ownKeys(value);
    if (
      keys.length !== value.length + 1 ||
      keys.some((key) => typeof key !== 'string')
    ) {
      return null;
    }
    const copied: unknown[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (
        descriptor === undefined ||
        !descriptor.enumerable ||
        !('value' in descriptor)
      ) {
        return null;
      }
      copied.push(descriptor.value);
    }
    return copied;
  } catch {
    return null;
  }
}

interface CopyBounds {
  readonly maximumDepth: number;
  readonly maximumNodes: number;
  readonly maximumArrayItems: number;
  readonly maximumObjectProperties: number;
  readonly maximumStringBytes: number;
}

function copyOwnedJson(value: unknown, bounds: CopyBounds): unknown {
  const ancestors = new WeakSet<object>();
  let nodes = 0;
  let stringBytes = 0;
  const copy = (candidate: unknown, depth: number): unknown => {
    nodes += 1;
    if (nodes > bounds.maximumNodes || depth > bounds.maximumDepth) {
      throw operationError();
    }
    if (candidate === null || typeof candidate === 'boolean') {
      return candidate;
    }
    if (typeof candidate === 'string') {
      stringBytes += utf8ByteLength(candidate);
      if (stringBytes > bounds.maximumStringBytes) {
        throw operationError();
      }
      return candidate;
    }
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return Object.is(candidate, -0) ? 0 : candidate;
    }
    if (typeof candidate !== 'object' || ancestors.has(candidate)) {
      throw operationError();
    }
    ancestors.add(candidate);
    try {
      if (Array.isArray(candidate)) {
        const values = readPlainArray(candidate, bounds.maximumArrayItems);
        if (values === null) {
          throw operationError();
        }
        return Object.freeze(values.map((child) => copy(child, depth + 1)));
      }
      const properties = readDataProperties(candidate);
      if (
        properties === null ||
        properties.size > bounds.maximumObjectProperties
      ) {
        throw operationError();
      }
      const owned: Record<string, unknown> = {};
      for (const [key, child] of properties) {
        stringBytes += utf8ByteLength(key);
        if (stringBytes > bounds.maximumStringBytes) {
          throw operationError();
        }
        owned[key] = copy(child, depth + 1);
      }
      return Object.freeze(owned);
    } finally {
      ancestors.delete(candidate);
    }
  };
  return copy(value, 0);
}

function deepFreeze<T>(value: T): T {
  const seen = new WeakSet<object>();
  const visit = (candidate: unknown): void => {
    if (
      typeof candidate !== 'object' ||
      candidate === null ||
      seen.has(candidate)
    ) {
      return;
    }
    seen.add(candidate);
    for (const key of Reflect.ownKeys(candidate)) {
      const descriptor = Object.getOwnPropertyDescriptor(candidate, key);
      if (descriptor !== undefined && 'value' in descriptor) {
        visit(descriptor.value);
      }
    }
    Object.freeze(candidate);
  };
  visit(value);
  return value;
}

async function cancelResponseBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // Cleanup cannot replace the response-too-large classification.
  }
}

function configurationError(): Error {
  return new Error(CONFIGURATION_ERROR);
}

function operationError(): Error {
  return new Error(OPERATION_ERROR);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
