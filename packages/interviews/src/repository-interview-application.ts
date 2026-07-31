import {
  CONTRACT_VERSION,
  createModelExecutionV1,
  createRepositoryInterviewRequestV1,
  createRepositoryInterviewV1,
  modelExecutionModelProfileDigest,
  modelExecutionReuseKeyDigest,
  parseModelExecutionModelProfileV1,
  parseModelExecutionV1,
  parseRepositoryInterviewRequestV1,
  parseRepositoryInterviewV1,
  validateRepositoryInterviewExecutionV1,
  type ModelExecutionAttemptV1,
  type ModelExecutionModelProfileV1,
  type ModelExecutionOutcomeV1,
  type ModelExecutionUsageV1,
  type ModelExecutionV1,
  type RepositoryInterviewRequestV1,
  type RepositoryInterviewV1,
} from '@gitblocks/contracts';

import { canonicalizeJson } from './canonical-json.ts';
import {
  finalizeRepositoryInterviewApplicationIssues,
  repositoryInterviewApplicationIssue,
  type RepositoryInterviewApplicationIssue,
} from './repository-interview-application-issues.ts';
import * as repositoryInterviewMapping from './repository-interview-mapping.ts';
import * as repositoryInterviewPrompt from './repository-interview-prompt.ts';
import type { RenderedRepositoryInterviewPromptV1 } from './repository-interview-prompt.ts';
import type { LoadedRepositoryInterviewSpecification } from './specification.ts';

export interface ExecuteRepositoryInterviewInputV1 {
  readonly artifactSet: unknown;
  readonly artifacts: readonly unknown[];
  readonly specification: LoadedRepositoryInterviewSpecification;
  readonly modelProfile: ModelExecutionModelProfileV1;
  readonly executionMode: ModelExecutionV1['executionMode'];
  readonly forceReason: ModelExecutionV1['forceReason'];
}

export interface RepositoryInterviewProviderRequestV1 {
  readonly prompt: RenderedRepositoryInterviewPromptV1;
  readonly modelProfile: ModelExecutionModelProfileV1;
  readonly providerProjectionVersion: string;
  readonly providerProjectionDigest: string;
  readonly providerProjectionText: string;
}

type ProviderControlledFailureCode = Exclude<
  Extract<
    ModelExecutionOutcomeV1,
    { readonly status: 'failed' }
  >['failureCode'],
  'provider-output-invalid'
>;

export type RepositoryInterviewProviderEffectResultV1 =
  | {
      readonly status: 'response';
      readonly attempts: readonly ModelExecutionAttemptV1[];
      readonly usage: ModelExecutionUsageV1;
      readonly providerOutput: unknown;
    }
  | {
      readonly status: 'failed';
      readonly attempts: readonly ModelExecutionAttemptV1[];
      readonly failureCode: ProviderControlledFailureCode;
      readonly usage: ModelExecutionUsageV1 | null;
    };

export interface RepositoryInterviewProviderPortV1 {
  execute(
    request: RepositoryInterviewProviderRequestV1,
  ): Promise<RepositoryInterviewProviderEffectResultV1>;
}

export interface RepositoryInterviewClockPortV1 {
  now(): string;
}

export interface RepositoryInterviewNoncePortV1 {
  nextExecutionNonce(): string;
}

export interface RepositoryInterviewReuseLookupV1 {
  readonly requestIdentityDigest: string;
  readonly modelProfileDigest: string;
  readonly reuseKeyDigest: string;
}

export interface RepositoryInterviewReusableBundleV1 {
  readonly request: RepositoryInterviewRequestV1;
  readonly execution: ModelExecutionV1;
  readonly interview: RepositoryInterviewV1;
}

export interface RepositoryInterviewPublicationCommandV1 {
  readonly request: RepositoryInterviewRequestV1;
  readonly execution: ModelExecutionV1;
  readonly interview: RepositoryInterviewV1 | null;
}

export type RepositoryInterviewPublicationResultV1 =
  | { readonly status: 'created' }
  | {
      readonly status: 'idempotent';
      readonly record: RepositoryInterviewPublicationCommandV1;
    }
  | { readonly status: 'conflict' };

export interface RepositoryInterviewRecordPortV1 {
  findReusable(
    lookup: RepositoryInterviewReuseLookupV1,
  ): Promise<RepositoryInterviewReusableBundleV1 | null>;
  publish(
    command: RepositoryInterviewPublicationCommandV1,
  ): Promise<RepositoryInterviewPublicationResultV1>;
}

export interface RepositoryInterviewApplicationPortsV1 {
  readonly provider: RepositoryInterviewProviderPortV1;
  readonly record: RepositoryInterviewRecordPortV1;
  readonly clock: RepositoryInterviewClockPortV1;
  readonly nonce: RepositoryInterviewNoncePortV1;
}

type SuccessfulDisposition = 'created' | 'idempotent' | 'reused';

export type ExecuteRepositoryInterviewResultV1 =
  | {
      readonly ok: true;
      readonly disposition: SuccessfulDisposition;
      readonly request: RepositoryInterviewRequestV1;
      readonly execution: ModelExecutionV1;
      readonly interview: RepositoryInterviewV1;
      readonly issues: readonly [];
    }
  | {
      readonly ok: true;
      readonly disposition: 'provider-failed';
      readonly request: RepositoryInterviewRequestV1;
      readonly execution: ModelExecutionV1;
      readonly interview: null;
      readonly issues: readonly [];
    }
  | {
      readonly ok: false;
      readonly issues: readonly RepositoryInterviewApplicationIssue[];
    };

const APPLICATION_INPUT_KEYS = Object.freeze([
  'artifactSet',
  'artifacts',
  'specification',
  'modelProfile',
  'executionMode',
  'forceReason',
] as const);

const NONCE_PATTERN = /^[0-9a-f]{32}$/u;
const TIMESTAMP_PATTERN =
  /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,3}))?Z$/u;
const CONTROLLED_FAILURE_CODES = new Set<ProviderControlledFailureCode>([
  'refused',
  'incomplete',
  'safety-interrupted',
  'deadline-exceeded',
  'cancelled',
  'not-authorized',
  'quota-exceeded',
  'rate-limited',
  'provider-error',
  'transport-error',
  'response-too-large',
  'invalid-response',
  'invalid-usage',
]);

export async function executeRepositoryInterviewV1(
  input: unknown,
  ports: RepositoryInterviewApplicationPortsV1,
): Promise<ExecuteRepositoryInterviewResultV1> {
  const applicationInput = parseApplicationInput(input);
  if (applicationInput === null) {
    return failure('application-input-invalid', '');
  }

  let specification: LoadedRepositoryInterviewSpecification;
  try {
    specification = deepFreeze(structuredClone(applicationInput.specification));
  } catch {
    return failure('prompt-render-failed', '/specification');
  }

  const rendered = repositoryInterviewPrompt.renderRepositoryInterviewPromptV1({
    artifactSet: applicationInput.artifactSet,
    artifacts: applicationInput.artifacts,
    specification,
  });
  if (!rendered.ok) {
    return failure('prompt-render-failed', '/artifactSet');
  }
  const prompt = rendered.value;

  let request: RepositoryInterviewRequestV1;
  try {
    request = createRepositoryInterviewRequestV1({
      contractVersion: CONTRACT_VERSION,
      candidateId: prompt.candidateId,
      artifactSetId: prompt.artifactSetId,
      artifactSetIdentityDigest: prompt.artifactSetIdentityDigest,
      specificationVersion: prompt.specificationVersion,
      specificationDigest: prompt.specificationDigest,
      rendererVersion: prompt.rendererVersion,
      providerOutputSchemaVersion:
        specification.manifest.providerOutputSchema.version,
      providerOutputSchemaDigest:
        specification.manifest.providerOutputSchema.digest,
      promptDigest: prompt.promptDigest,
    });
  } catch {
    return failure('application-closure', '/request');
  }

  const parsedProfile = parseModelExecutionModelProfileV1(
    applicationInput.modelProfile,
  );
  if (
    !parsedProfile.ok ||
    parsedProfile.value.providerProjectionVersion !==
      specification.manifest.openAiProjection.version ||
    parsedProfile.value.providerProjectionDigest !==
      specification.manifest.openAiProjection.digest
  ) {
    return failure('model-profile-invalid', '/modelProfile');
  }
  const modelProfile = deepFreeze(parsedProfile.value);
  const modelProfileDigest = modelExecutionModelProfileDigest(modelProfile);
  const reuseKeyDigest = modelExecutionReuseKeyDigest({
    contractVersion: CONTRACT_VERSION,
    requestIdentityDigest: request.identityDigest,
    modelProfileDigest,
  });
  const ownedRequest = deepFreeze(request);

  if (applicationInput.executionMode === 'normal') {
    let reusable: RepositoryInterviewReusableBundleV1 | null;
    try {
      reusable = await ports.record.findReusable(
        deepFreeze({
          requestIdentityDigest: ownedRequest.identityDigest,
          modelProfileDigest,
          reuseKeyDigest,
        }),
      );
    } catch {
      return failure('record-port-failure', '/record/findReusable');
    }
    if (reusable !== null) {
      const validated = validateReusableBundle(
        reusable,
        ownedRequest,
        modelProfileDigest,
        reuseKeyDigest,
      );
      if (validated === null) {
        return failure('reuse-record-invalid', '/record/findReusable');
      }
      return {
        ok: true,
        disposition: 'reused',
        ...validated,
        issues: [],
      };
    }
  }

  let executionNonce: string;
  try {
    executionNonce = ports.nonce.nextExecutionNonce();
  } catch {
    return failure('application-closure', '/nonce');
  }
  if (!NONCE_PATTERN.test(executionNonce)) {
    return failure('application-closure', '/nonce');
  }

  const providerRequest = deepFreeze({
    prompt,
    modelProfile,
    providerProjectionVersion: specification.manifest.openAiProjection.version,
    providerProjectionDigest: specification.manifest.openAiProjection.digest,
    providerProjectionText: specification.openAiProjectionSnapshot,
  });
  let providerEffect: unknown;
  try {
    providerEffect = await ports.provider.execute(providerRequest);
  } catch {
    return failure('provider-port-failure', '/provider');
  }
  const parsedEffect = parseProviderEffect(providerEffect);
  if (parsedEffect === null) {
    return failure('provider-port-failure', '/provider');
  }

  if (parsedEffect.status === 'failed') {
    const execution = createFailedExecution(
      ownedRequest,
      modelProfile,
      executionNonce,
      applicationInput.executionMode,
      applicationInput.forceReason,
      parsedEffect.attempts,
      parsedEffect.failureCode,
      parsedEffect.usage,
    );
    if (execution === null) {
      return failure('provider-port-failure', '/provider');
    }
    return publishProviderFailure(ownedRequest, execution, ports.record);
  }

  const mapped =
    repositoryInterviewMapping.resolveRepositoryInterviewProviderOutputV1({
      providerOutput: parsedEffect.providerOutput,
      prompt,
      specification,
    });
  if (!mapped.ok) {
    const execution = createFailedExecution(
      ownedRequest,
      modelProfile,
      executionNonce,
      applicationInput.executionMode,
      applicationInput.forceReason,
      parsedEffect.attempts,
      'provider-output-invalid',
      parsedEffect.usage,
    );
    if (execution === null) {
      return failure('provider-port-failure', '/provider');
    }
    return publishProviderFailure(ownedRequest, execution, ports.record);
  }

  const execution = createSuccessfulExecution(
    ownedRequest,
    modelProfile,
    executionNonce,
    applicationInput.executionMode,
    applicationInput.forceReason,
    parsedEffect.attempts,
    parsedEffect.usage,
    mapped.value.providerOutputDigest,
  );
  if (execution === null) {
    const invalidUsageExecution = createFailedExecution(
      ownedRequest,
      modelProfile,
      executionNonce,
      applicationInput.executionMode,
      applicationInput.forceReason,
      parsedEffect.attempts,
      'invalid-usage',
      null,
    );
    return invalidUsageExecution === null
      ? failure('provider-port-failure', '/provider')
      : publishProviderFailure(
          ownedRequest,
          invalidUsageExecution,
          ports.record,
        );
  }

  let publishedAt: string;
  try {
    publishedAt = ports.clock.now();
  } catch {
    return failure('publication-time-invalid', '/clock');
  }
  const publicationTimestamp = timestampValue(publishedAt);
  const completionTimestamp = timestampValue(execution.completedAt);
  if (
    publicationTimestamp === null ||
    completionTimestamp === null ||
    publicationTimestamp < completionTimestamp
  ) {
    return failure('publication-time-invalid', '/clock');
  }

  let interview: RepositoryInterviewV1;
  try {
    interview = createRepositoryInterviewV1({
      contractVersion: CONTRACT_VERSION,
      candidateId: mapped.value.candidateId,
      artifactSetId: mapped.value.artifactSetId,
      artifactSetIdentityDigest: mapped.value.artifactSetIdentityDigest,
      requestId: ownedRequest.requestId,
      requestIdentityDigest: ownedRequest.identityDigest,
      executionId: execution.executionId,
      executionIdentityDigest: execution.identityDigest,
      providerOutputDigest: mapped.value.providerOutputDigest,
      specificationVersion: ownedRequest.specificationVersion,
      specificationDigest: ownedRequest.specificationDigest,
      rendererVersion: ownedRequest.rendererVersion,
      providerOutputSchemaVersion: ownedRequest.providerOutputSchemaVersion,
      providerOutputSchemaDigest: ownedRequest.providerOutputSchemaDigest,
      providerProjectionVersion:
        execution.modelProfile.providerProjectionVersion,
      providerProjectionDigest: execution.modelProfile.providerProjectionDigest,
      promptDigest: mapped.value.promptDigest,
      modelProfileDigest: execution.modelProfileDigest,
      citations: mapped.value.citations,
      claims: mapped.value.claims,
      limitations: mapped.value.limitations,
      contradictions: mapped.value.contradictions,
      unknowns: mapped.value.unknowns,
      publishedAt,
    });
  } catch {
    return failure('application-closure', '/interview');
  }
  const exchange = validateRepositoryInterviewExecutionV1(
    ownedRequest,
    execution,
    interview,
  );
  if (!exchange.ok) {
    return failure('application-closure', '/exchange');
  }
  return publishSuccessfulExchange(
    deepFreeze(exchange.request),
    deepFreeze(exchange.execution),
    deepFreeze(exchange.interview),
    ports.record,
  );
}

function parseApplicationInput(
  value: unknown,
): ExecuteRepositoryInterviewInputV1 | null {
  const fields = readExactDataProperties(value, APPLICATION_INPUT_KEYS);
  if (
    fields === null ||
    !Array.isArray(fields['artifacts']) ||
    (fields['executionMode'] !== 'normal' &&
      fields['executionMode'] !== 'forced') ||
    (fields['executionMode'] === 'normal' && fields['forceReason'] !== null) ||
    (fields['executionMode'] === 'forced' &&
      fields['forceReason'] !== 'calibration' &&
      fields['forceReason'] !== 'review-rejected' &&
      fields['forceReason'] !== 'operator-recovery')
  ) {
    return null;
  }
  return {
    artifactSet: fields['artifactSet'],
    artifacts: fields['artifacts'],
    specification: fields[
      'specification'
    ] as LoadedRepositoryInterviewSpecification,
    modelProfile: fields['modelProfile'] as ModelExecutionModelProfileV1,
    executionMode: fields['executionMode'],
    forceReason: fields['forceReason'] as ModelExecutionV1['forceReason'],
  };
}

function parseProviderEffect(
  value: unknown,
): RepositoryInterviewProviderEffectResultV1 | null {
  const status = readStatus(value);
  if (status === 'response') {
    const fields = readExactDataProperties(value, [
      'status',
      'attempts',
      'usage',
      'providerOutput',
    ]);
    if (
      fields === null ||
      !isOneOrTwoItemArray(fields['attempts']) ||
      fields['usage'] === null ||
      typeof fields['usage'] !== 'object'
    ) {
      return null;
    }
    return fields as unknown as RepositoryInterviewProviderEffectResultV1;
  }
  if (status === 'failed') {
    const fields = readExactDataProperties(value, [
      'status',
      'attempts',
      'failureCode',
      'usage',
    ]);
    if (
      fields === null ||
      !isOneOrTwoItemArray(fields['attempts']) ||
      !CONTROLLED_FAILURE_CODES.has(
        fields['failureCode'] as ProviderControlledFailureCode,
      ) ||
      (fields['usage'] !== null && typeof fields['usage'] !== 'object')
    ) {
      return null;
    }
    return fields as unknown as RepositoryInterviewProviderEffectResultV1;
  }
  return null;
}

function readStatus(value: unknown): unknown {
  const fields = readDataProperties(value);
  return fields?.get('status');
}

function createSuccessfulExecution(
  request: RepositoryInterviewRequestV1,
  modelProfile: ModelExecutionModelProfileV1,
  executionNonce: string,
  executionMode: ModelExecutionV1['executionMode'],
  forceReason: ModelExecutionV1['forceReason'],
  attempts: readonly ModelExecutionAttemptV1[],
  usage: ModelExecutionUsageV1,
  providerOutputDigest: string,
): ModelExecutionV1 | null {
  try {
    return deepFreeze(
      createModelExecutionV1({
        contractVersion: CONTRACT_VERSION,
        requestId: request.requestId,
        requestIdentityDigest: request.identityDigest,
        executionNonce,
        executionMode,
        forceReason,
        modelProfile,
        startedAt: attempts[0]?.startedAt ?? '',
        completedAt: attempts.at(-1)?.completedAt ?? '',
        attempts: [...attempts],
        outcome: {
          status: 'succeeded',
          failureCode: null,
          providerOutputDigest,
          usage,
        },
      }),
    );
  } catch {
    return null;
  }
}

function createFailedExecution(
  request: RepositoryInterviewRequestV1,
  modelProfile: ModelExecutionModelProfileV1,
  executionNonce: string,
  executionMode: ModelExecutionV1['executionMode'],
  forceReason: ModelExecutionV1['forceReason'],
  attempts: readonly ModelExecutionAttemptV1[],
  failureCode: Extract<
    ModelExecutionOutcomeV1,
    { readonly status: 'failed' }
  >['failureCode'],
  usage: ModelExecutionUsageV1 | null,
): ModelExecutionV1 | null {
  const create = (safeUsage: ModelExecutionUsageV1 | null) =>
    deepFreeze(
      createModelExecutionV1({
        contractVersion: CONTRACT_VERSION,
        requestId: request.requestId,
        requestIdentityDigest: request.identityDigest,
        executionNonce,
        executionMode,
        forceReason,
        modelProfile,
        startedAt: attempts[0]?.startedAt ?? '',
        completedAt: attempts.at(-1)?.completedAt ?? '',
        attempts: [...attempts],
        outcome: {
          status: 'failed',
          failureCode,
          providerOutputDigest: null,
          usage: safeUsage,
        },
      }),
    );
  try {
    return create(usage);
  } catch {
    if (usage !== null) {
      try {
        return create(null);
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function publishSuccessfulExchange(
  request: RepositoryInterviewRequestV1,
  execution: ModelExecutionV1,
  interview: RepositoryInterviewV1,
  recordPort: RepositoryInterviewRecordPortV1,
): Promise<ExecuteRepositoryInterviewResultV1> {
  const publication = await publish(
    deepFreeze({ request, execution, interview }),
    recordPort,
  );
  if (!publication.ok) {
    return publication;
  }
  if (publication.record.interview === null) {
    return failure('application-closure', '/record/publish');
  }
  return {
    ok: true,
    disposition: publication.status,
    request: publication.record.request,
    execution: publication.record.execution,
    interview: publication.record.interview,
    issues: [],
  };
}

async function publishProviderFailure(
  request: RepositoryInterviewRequestV1,
  execution: ModelExecutionV1,
  recordPort: RepositoryInterviewRecordPortV1,
): Promise<ExecuteRepositoryInterviewResultV1> {
  const publication = await publish(
    deepFreeze({ request, execution, interview: null }),
    recordPort,
  );
  if (!publication.ok) {
    return publication;
  }
  return {
    ok: true,
    disposition: 'provider-failed',
    request: publication.record.request,
    execution: publication.record.execution,
    interview: null,
    issues: [],
  };
}

async function publish(
  command: RepositoryInterviewPublicationCommandV1,
  recordPort: RepositoryInterviewRecordPortV1,
): Promise<
  | {
      readonly ok: true;
      readonly status: 'created' | 'idempotent';
      readonly record: RepositoryInterviewPublicationCommandV1;
    }
  | Extract<ExecuteRepositoryInterviewResultV1, { readonly ok: false }>
> {
  let result: unknown;
  try {
    result = await recordPort.publish(command);
  } catch {
    return failure('record-port-failure', '/record/publish');
  }
  const status = readStatus(result);
  if (
    (status === 'created' || status === 'conflict') &&
    readExactDataProperties(result, ['status']) !== null
  ) {
    return status === 'conflict'
      ? failure('record-port-conflict', '/record/publish')
      : { ok: true, status, record: command };
  }
  if (status !== 'idempotent') {
    return failure('record-port-failure', '/record/publish');
  }
  const fields = readExactDataProperties(result, ['status', 'record']);
  if (fields === null) {
    return failure('record-port-failure', '/record/publish');
  }
  const record = validatePublicationRecord(fields['record'], command);
  return record === null
    ? failure('record-port-failure', '/record/publish')
    : { ok: true, status: 'idempotent', record };
}

function validateReusableBundle(
  value: unknown,
  request: RepositoryInterviewRequestV1,
  modelProfileDigest: string,
  reuseKeyDigest: string,
): RepositoryInterviewReusableBundleV1 | null {
  const fields = readExactDataProperties(value, [
    'request',
    'execution',
    'interview',
  ]);
  if (fields === null || fields['interview'] === null) {
    return null;
  }
  const parsedRequest = parseRepositoryInterviewRequestV1(fields['request']);
  const parsedExecution = parseModelExecutionV1(fields['execution']);
  const parsedInterview = parseRepositoryInterviewV1(fields['interview']);
  if (
    !parsedRequest.ok ||
    !parsedExecution.ok ||
    !parsedInterview.ok ||
    parsedExecution.value.outcome.status !== 'succeeded' ||
    canonicalizeJson(parsedRequest.value) !== canonicalizeJson(request) ||
    parsedExecution.value.modelProfileDigest !== modelProfileDigest ||
    parsedExecution.value.reuseKeyDigest !== reuseKeyDigest
  ) {
    return null;
  }
  const exchange = validateRepositoryInterviewExecutionV1(
    parsedRequest.value,
    parsedExecution.value,
    parsedInterview.value,
  );
  return exchange.ok
    ? deepFreeze({
        request: exchange.request,
        execution: exchange.execution,
        interview: exchange.interview,
      })
    : null;
}

function validatePublicationRecord(
  value: unknown,
  expected: RepositoryInterviewPublicationCommandV1,
): RepositoryInterviewPublicationCommandV1 | null {
  const fields = readExactDataProperties(value, [
    'request',
    'execution',
    'interview',
  ]);
  if (fields === null) {
    return null;
  }
  const parsedRequest = parseRepositoryInterviewRequestV1(fields['request']);
  const parsedExecution = parseModelExecutionV1(fields['execution']);
  if (
    !parsedRequest.ok ||
    !parsedExecution.ok ||
    parsedRequest.value.recordDigest !== expected.request.recordDigest ||
    parsedExecution.value.recordDigest !== expected.execution.recordDigest ||
    parsedExecution.value.requestId !== parsedRequest.value.requestId ||
    parsedExecution.value.requestIdentityDigest !==
      parsedRequest.value.identityDigest
  ) {
    return null;
  }
  if (expected.interview === null) {
    return fields['interview'] === null &&
      parsedExecution.value.outcome.status === 'failed'
      ? deepFreeze({
          request: parsedRequest.value,
          execution: parsedExecution.value,
          interview: null,
        })
      : null;
  }
  const parsedInterview = parseRepositoryInterviewV1(fields['interview']);
  if (
    !parsedInterview.ok ||
    parsedInterview.value.recordDigest !== expected.interview.recordDigest
  ) {
    return null;
  }
  const exchange = validateRepositoryInterviewExecutionV1(
    parsedRequest.value,
    parsedExecution.value,
    parsedInterview.value,
  );
  return exchange.ok
    ? deepFreeze({
        request: exchange.request,
        execution: exchange.execution,
        interview: exchange.interview,
      })
    : null;
}

function isOneOrTwoItemArray(
  value: unknown,
): value is readonly ModelExecutionAttemptV1[] {
  return Array.isArray(value) && value.length >= 1 && value.length <= 2;
}

function readExactDataProperties(
  value: unknown,
  expectedKeys: readonly string[],
): Readonly<Record<string, unknown>> | null {
  const properties = readDataProperties(value);
  if (properties === null) {
    return null;
  }
  const actualKeys = [...properties.keys()].sort(compareText);
  const expected = [...expectedKeys].sort(compareText);
  if (
    actualKeys.length !== expected.length ||
    actualKeys.some((key, index) => key !== expected[index])
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

function timestampValue(value: string): number | null {
  const parsed = Date.parse(value);
  const match = TIMESTAMP_PATTERN.exec(value);
  if (!Number.isFinite(parsed) || match === null) {
    return null;
  }
  const prefix = match[1];
  if (prefix === undefined) {
    return null;
  }
  const normalized = `${prefix}.${(match[2] ?? '').padEnd(3, '0')}Z`;
  return new Date(parsed).toISOString() === normalized ? parsed : null;
}

function deepFreeze<T>(value: T): T {
  const seen = new WeakSet<object>();
  const freeze = (candidate: unknown): void => {
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
        freeze(descriptor.value);
      }
    }
    Object.freeze(candidate);
  };
  freeze(value);
  return value;
}

function failure(
  code: RepositoryInterviewApplicationIssue['code'],
  path: string,
): Extract<ExecuteRepositoryInterviewResultV1, { readonly ok: false }> {
  return {
    ok: false,
    issues: finalizeRepositoryInterviewApplicationIssues([
      repositoryInterviewApplicationIssue(code, path),
    ]),
  };
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
