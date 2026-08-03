import {
  modelExecutionModelProfileDigest,
  parseModelExecutionModelProfileV1,
  type ModelExecutionModelProfileV1,
} from '@gitblocks/contracts';
import {
  canonicalizeJson,
  executeRepositoryInterviewV1,
  sha256Digest,
  type LoadedRepositoryInterviewSpecification,
  type RepositoryInterviewClockPortV1,
  type RepositoryInterviewNoncePortV1,
  type RepositoryInterviewProviderEffectResultV1,
  type RepositoryInterviewProviderPortV1,
  type RepositoryInterviewProviderRequestV1,
  type RepositoryInterviewPublicationCommandV1,
  type RepositoryInterviewRecordPortV1,
  type RepositoryInterviewReuseLookupV1,
} from '@gitblocks/interviews';
import type { MigrationVerification } from '@gitblocks/persistence';

import {
  parseRepositoryInterviewCandidatePlanV1,
  type RepositoryInterviewCandidatePlanV1,
} from './candidate-plan.ts';
import {
  calculateRepositoryInterviewUsageCostMicroUsdV1,
  calculateRepositoryInterviewWorstCaseV1,
  parseRepositoryInterviewOperatorPolicyV1,
  type RepositoryInterviewOperatorPolicyV1,
  type RepositoryInterviewOperatorWorstCaseV1,
} from './operator-policy.ts';
import {
  parseRepositoryInterviewOperatorSelectionV1,
  type RepositoryInterviewOperatorSelectionMemberV1,
  type RepositoryInterviewOperatorSelectionV1,
} from './operator-selection.ts';
import {
  operatorIssue,
  type RepositoryInterviewOperatorIssueV1,
} from './operator-issues.ts';
import type { RepositoryInterviewOperatorPersistencePortV1 } from './persistence-adapter.ts';
import {
  createRepositoryInterviewOperatorReceiptV1,
  type RepositoryInterviewOperatorCandidateResultV1,
  type RepositoryInterviewOperatorReceiptV1,
  type RepositoryInterviewOperatorUsageV1,
} from './receipt.ts';
import {
  createRepositoryInterviewOperatorTelemetryV1,
  NOOP_REPOSITORY_INTERVIEW_OPERATOR_OBSERVER,
  type RepositoryInterviewOperatorEventV1,
  type RepositoryInterviewOperatorObserverV1,
} from './telemetry.ts';

const MIGRATIONS = Object.freeze([
  [
    '1',
    'evidence-persistence',
    '569d7a6d6db70b1b04cadfa8798516ce4239b1179bb2f7cdd84b27641e33755f',
  ],
  [
    '2',
    'runtime-migration-verification',
    'b61cf8ad8673663c646b77e8f0ebed452898aab795aa64f52217e1271e1dc2ae',
  ],
  [
    '3',
    'immutable-repository-artifacts',
    '0ea1e4698e8eec6d33320df7af4758ae6b3b4fcbe3da387bb042d074b86228dc',
  ],
  [
    '4',
    'repository-interviews',
    '2cd18e7d92373215b2a540cdf12e32a7e949bfb01866616e8a44ad326e45bca0',
  ],
] as const);
const FORCE_REASONS = new Set([
  'calibration',
  'review-rejected',
  'operator-recovery',
]);
const AUTHORIZED_MODEL_SNAPSHOTS = new Set([
  'gpt-5.4-2026-03-05',
  'gpt-5.4-mini-2026-03-17',
]);
const ZERO_USAGE: RepositoryInterviewOperatorUsageV1 = Object.freeze({
  inputTokens: 0,
  cachedInputTokens: 0,
  outputTokens: 0,
  reasoningTokens: 0,
  totalTokens: 0,
});

export interface RunRepositoryInterviewOperatorInputV1 {
  readonly selection: RepositoryInterviewOperatorSelectionV1;
  readonly specification: LoadedRepositoryInterviewSpecification;
  readonly modelProfile: ModelExecutionModelProfileV1;
  readonly policy: RepositoryInterviewOperatorPolicyV1;
  readonly executionMode: 'normal' | 'forced';
  readonly forceReason:
    'calibration' | 'review-rejected' | 'operator-recovery' | null;
  readonly verifyImmediateReuse: boolean;
}

export type RepositoryInterviewOperatorWallClockPortV1 =
  RepositoryInterviewClockPortV1;

export interface RepositoryInterviewOperatorMonotonicClockPortV1 {
  nowMilliseconds(): number;
}

export interface RepositoryInterviewOperatorRunIdPortV1 {
  nextRunId(): string;
}

export type RepositoryInterviewOperatorCandidateOutcomeV1 =
  'active' | 'candidate-deadline' | 'run-deadline';

export interface RepositoryInterviewOperatorCandidateControlV1 {
  readonly signal: AbortSignal;
  outcome(): RepositoryInterviewOperatorCandidateOutcomeV1;
  dispose(): void;
}

export interface RepositoryInterviewOperatorCandidateControlFactoryV1 {
  beginCandidate(input: {
    readonly ordinal: number;
    readonly timeoutMilliseconds: number;
  }): RepositoryInterviewOperatorCandidateControlV1;
}

export interface RepositoryInterviewOperatorProviderFactoryV1 {
  forCandidate(signal: AbortSignal): RepositoryInterviewProviderPortV1;
}

export interface RepositoryInterviewOperatorPortsV1 {
  readonly persistence: RepositoryInterviewOperatorPersistencePortV1;
  readonly provider: RepositoryInterviewOperatorProviderFactoryV1;
  readonly candidateControl: RepositoryInterviewOperatorCandidateControlFactoryV1;
  readonly clock: RepositoryInterviewOperatorWallClockPortV1;
  readonly monotonicClock: RepositoryInterviewOperatorMonotonicClockPortV1;
  readonly nonce: RepositoryInterviewNoncePortV1;
  readonly runId: RepositoryInterviewOperatorRunIdPortV1;
  readonly observer?: RepositoryInterviewOperatorObserverV1;
}

export type RunRepositoryInterviewOperatorResultV1 =
  | {
      readonly ok: true;
      readonly receipt: RepositoryInterviewOperatorReceiptV1;
      readonly issues: readonly [];
    }
  | {
      readonly ok: false;
      readonly receipt: RepositoryInterviewOperatorReceiptV1 | null;
      readonly issues: readonly RepositoryInterviewOperatorIssueV1[];
    };

interface MutableRunState {
  stopCode: string | null;
  persistenceFailures: number;
  providerCalls: number;
  providerAttempts: number;
  providerRetries: number;
  providerSummary: MutableProviderSummary;
  results: (RepositoryInterviewOperatorCandidateResultV1 | undefined)[];
}

type MutableProviderSummary = {
  -readonly [
    Key in keyof RepositoryInterviewOperatorReceiptV1['providerSummary']
  ]: RepositoryInterviewOperatorReceiptV1['providerSummary'][Key];
};

export function validateRepositoryInterviewCandidatePlanPreflightV1(
  candidatePlanInput: unknown,
  policyInput: unknown,
  modelProfileInput: unknown,
):
  | {
      readonly ok: true;
      readonly candidatePlan: RepositoryInterviewCandidatePlanV1;
      readonly policy: RepositoryInterviewOperatorPolicyV1;
      readonly modelProfile: ModelExecutionModelProfileV1;
      readonly modelProfileDigest: string;
      readonly worstCase: RepositoryInterviewOperatorWorstCaseV1;
      readonly issues: readonly [];
    }
  | {
      readonly ok: false;
      readonly issues: readonly RepositoryInterviewOperatorIssueV1[];
    } {
  const candidatePlan =
    parseRepositoryInterviewCandidatePlanV1(candidatePlanInput);
  if (!candidatePlan.ok) return { ok: false, issues: candidatePlan.issues };
  const modelProfile = parseModelExecutionModelProfileV1(modelProfileInput);
  if (
    !modelProfile.ok ||
    !AUTHORIZED_MODEL_SNAPSHOTS.has(modelProfile.value.modelSnapshot)
  )
    return { ok: false, issues: [operatorIssue('operator.input-invalid')] };
  const policy = parseRepositoryInterviewOperatorPolicyV1(
    policyInput,
    modelProfile.value,
  );
  if (!policy.ok) return { ok: false, issues: policy.issues };
  try {
    return Object.freeze({
      ok: true,
      candidatePlan: candidatePlan.value,
      policy: policy.value,
      modelProfile: modelProfile.value,
      modelProfileDigest: modelExecutionModelProfileDigest(modelProfile.value),
      worstCase: calculateRepositoryInterviewWorstCaseV1(
        candidatePlan.value.candidateIds.length,
        policy.value,
      ),
      issues: [] as const,
    });
  } catch {
    return { ok: false, issues: [operatorIssue('operator.budget-invalid')] };
  }
}

export function validateRepositoryInterviewOperatorPreflightV1(
  selectionInput: unknown,
  policyInput: unknown,
  modelProfileInput: unknown,
):
  | {
      readonly ok: true;
      readonly selection: RepositoryInterviewOperatorSelectionV1;
      readonly policy: RepositoryInterviewOperatorPolicyV1;
      readonly modelProfile: ModelExecutionModelProfileV1;
      readonly modelProfileDigest: string;
      readonly worstCase: RepositoryInterviewOperatorWorstCaseV1;
      readonly issues: readonly [];
    }
  | {
      readonly ok: false;
      readonly issues: readonly RepositoryInterviewOperatorIssueV1[];
    } {
  const selection = parseRepositoryInterviewOperatorSelectionV1(selectionInput);
  if (!selection.ok) return { ok: false, issues: selection.issues };
  const modelProfile = parseModelExecutionModelProfileV1(modelProfileInput);
  if (!modelProfile.ok) {
    return { ok: false, issues: [operatorIssue('operator.input-invalid')] };
  }
  if (!AUTHORIZED_MODEL_SNAPSHOTS.has(modelProfile.value.modelSnapshot)) {
    return { ok: false, issues: [operatorIssue('operator.input-invalid')] };
  }
  const policy = parseRepositoryInterviewOperatorPolicyV1(
    policyInput,
    modelProfile.value,
  );
  if (!policy.ok) return { ok: false, issues: policy.issues };
  try {
    const worstCase = calculateRepositoryInterviewWorstCaseV1(
      selection.value.members.length,
      policy.value,
    );
    return Object.freeze({
      ok: true,
      selection: selection.value,
      policy: policy.value,
      modelProfile: modelProfile.value,
      modelProfileDigest: modelExecutionModelProfileDigest(modelProfile.value),
      worstCase,
      issues: [] as const,
    });
  } catch {
    return { ok: false, issues: [operatorIssue('operator.budget-invalid')] };
  }
}

export async function runRepositoryInterviewOperatorV1(
  input: RunRepositoryInterviewOperatorInputV1,
  ports: RepositoryInterviewOperatorPortsV1,
): Promise<RunRepositoryInterviewOperatorResultV1> {
  const preflight = validateRepositoryInterviewOperatorPreflightV1(
    input.selection,
    input.policy,
    input.modelProfile,
  );
  if (
    !preflight.ok ||
    (input.executionMode === 'normal' && input.forceReason !== null) ||
    (input.executionMode === 'forced' &&
      (input.forceReason === null || !FORCE_REASONS.has(input.forceReason))) ||
    (input.executionMode === 'forced' && input.verifyImmediateReuse)
  ) {
    return {
      ok: false,
      receipt: null,
      issues: preflight.ok
        ? [operatorIssue('operator.input-invalid')]
        : preflight.issues,
    };
  }

  let runId: string;
  let startedAt: string;
  let operationStart: number;
  try {
    runId = ports.runId.nextRunId();
    startedAt = ports.clock.now();
    operationStart = readMonotonic(ports.monotonicClock);
    if (
      !/^interview-run-[0-9a-f]{48}$/u.test(runId) ||
      !isTimestamp(startedAt)
    ) {
      throw new Error('Operator authority is invalid.');
    }
  } catch {
    return failureWithoutReceipt('operator.input-invalid');
  }
  const telemetry = createRepositoryInterviewOperatorTelemetryV1(
    runId,
    ports.observer ?? NOOP_REPOSITORY_INTERVIEW_OPERATOR_OBSERVER,
  );
  await telemetry.emit(event('operator-started'));

  let migration: MigrationVerification;
  try {
    migration = await ports.persistence.verifyMigrations();
    validateMigrationAuthority(migration);
  } catch {
    return failureWithoutReceipt('operator.migration-invalid');
  }

  const state: MutableRunState = {
    stopCode: null,
    persistenceFailures: 0,
    providerCalls: 0,
    providerAttempts: 0,
    providerRetries: 0,
    providerSummary: emptyProviderSummary(),
    results: Array.from(
      { length: preflight.selection.members.length },
      (): RepositoryInterviewOperatorCandidateResultV1 | undefined => undefined,
    ),
  };
  let next = 0;
  const firstPassByCandidate = new Map<
    string,
    { executionId: string; interviewId: string }
  >();

  const worker = async (): Promise<void> => {
    for (;;) {
      const index = next;
      if (
        index >= preflight.selection.members.length ||
        state.stopCode !== null
      ) {
        return;
      }
      if (
        readMonotonic(ports.monotonicClock) - operationStart >=
        preflight.policy.runDeadlineMilliseconds
      ) {
        state.stopCode = 'run-deadline';
        return;
      }
      next += 1;
      const member = preflight.selection.members.at(index);
      if (member === undefined) return;
      const result = await executeMember(
        member,
        preflight.selection,
        input,
        preflight.policy,
        ports,
        telemetry,
        state,
      );
      state.results[index] = result;
      if (
        result.status === 'completed' &&
        result.executionId !== null &&
        result.interviewId !== null
      ) {
        firstPassByCandidate.set(member.candidateId, {
          executionId: result.executionId,
          interviewId: result.interviewId,
        });
      } else {
        state.stopCode ??= result.failureCode ?? 'candidate-failed';
      }
    }
  };
  try {
    await Promise.all(
      Array.from({ length: preflight.policy.concurrency }, () => worker()),
    );
  } catch {
    return failureWithoutReceipt('operator.application-failed');
  }

  let immediateReuse: RepositoryInterviewOperatorReceiptV1['immediateReuse'] =
    input.verifyImmediateReuse
      ? Object.freeze({
          requested: true,
          passed: false,
          candidateCount: preflight.selection.members.length,
          reusedCount: 0,
          providerCalls: 0,
          providerAttempts: 0,
          tokenUsage: 0,
          costMicroUsd: 0,
        })
      : Object.freeze({ requested: false });
  if (input.verifyImmediateReuse && state.stopCode === null) {
    const proof = await verifyImmediateReuse(
      preflight.selection,
      input,
      ports,
      firstPassByCandidate,
    );
    immediateReuse = proof;
    if (!proof.passed) state.stopCode = 'immediate-reuse-failed';
  }

  let completedAt: string;
  let completedMonotonic: number;
  try {
    completedAt = ports.clock.now();
    completedMonotonic = readMonotonic(ports.monotonicClock);
    if (
      !isTimestamp(completedAt) ||
      completedAt < startedAt ||
      completedMonotonic < operationStart
    ) {
      throw new Error('Operator authority is invalid.');
    }
  } catch {
    return failureWithoutReceipt('operator.input-invalid');
  }
  const results = state.results.filter(
    (value): value is RepositoryInterviewOperatorCandidateResultV1 =>
      value !== undefined,
  );
  await telemetry.emit(
    event(state.stopCode === null ? 'operator-completed' : 'operator-stopped', {
      resultCode: state.stopCode ?? 'completed',
      durationMilliseconds: completedMonotonic - operationStart,
    }),
  );
  let receipt: RepositoryInterviewOperatorReceiptV1;
  try {
    receipt = buildReceipt({
      runId,
      startedAt,
      completedAt,
      durationMilliseconds: completedMonotonic - operationStart,
      input,
      preflight,
      migration,
      state,
      results,
      immediateReuse,
      telemetryEventCount: telemetry.eventCount,
      telemetryFailureCount: telemetry.failureCount,
    });
  } catch {
    return failureWithoutReceipt('operator.receipt-invalid');
  }
  return state.stopCode === null
    ? { ok: true, receipt, issues: [] }
    : {
        ok: false,
        receipt,
        issues: [
          operatorIssue(
            state.stopCode === 'immediate-reuse-failed'
              ? 'operator.immediate-reuse-failed'
              : 'operator.application-failed',
          ),
        ],
      };
}

async function executeMember(
  member: RepositoryInterviewOperatorSelectionMemberV1,
  selection: RepositoryInterviewOperatorSelectionV1,
  input: RunRepositoryInterviewOperatorInputV1,
  policy: RepositoryInterviewOperatorPolicyV1,
  ports: RepositoryInterviewOperatorPortsV1,
  telemetry: ReturnType<typeof createRepositoryInterviewOperatorTelemetryV1>,
  state: MutableRunState,
): Promise<RepositoryInterviewOperatorCandidateResultV1> {
  const control = ports.candidateControl.beginCandidate({
    ordinal: member.ordinal,
    timeoutMilliseconds: policy.candidateDeadlineMilliseconds,
  });
  if (!(control.signal instanceof AbortSignal)) {
    throw new Error('Candidate control is invalid.');
  }
  const started = readMonotonic(ports.monotonicClock);
  try {
    const initialDeadline = candidateDeadline(control);
    if (initialDeadline !== null) {
      state.stopCode ??= initialDeadline;
      return failedCandidate(member, initialDeadline, started, ports);
    }
    await telemetry.emit(
      event('candidate-started', { candidateOrdinal: member.ordinal }),
    );
    const afterStart = candidateDeadline(control);
    if (afterStart !== null) {
      state.stopCode ??= afterStart;
      return failedCandidate(member, afterStart, started, ports);
    }
    const candidatePersistence = ports.persistence.forCandidate(control.signal);
    let context: Awaited<
      ReturnType<typeof candidatePersistence.loadArtifactContext>
    >;
    try {
      context = await candidatePersistence.loadArtifactContext(
        member,
        selection,
      );
    } catch {
      const deadline = candidateDeadline(control);
      if (deadline !== null) {
        state.stopCode ??= deadline;
        return failedCandidate(member, deadline, started, ports);
      }
      state.persistenceFailures += 1;
      return failedCandidate(
        member,
        'persistence-failed',
        started,
        ports,
        'persistence-failed',
      );
    }
    const afterArtifacts = candidateDeadline(control);
    if (afterArtifacts !== null) {
      state.stopCode ??= afterArtifacts;
      return failedCandidate(member, afterArtifacts, started, ports);
    }
    const candidateProvider = ports.provider.forCandidate(control.signal);
    const provider: RepositoryInterviewProviderPortV1 = Object.freeze({
      execute: async (request: RepositoryInterviewProviderRequestV1) => {
        if (candidateDeadline(control) !== null) {
          throw new Error('Repository interview provider operation failed.');
        }
        state.providerCalls += 1;
        let effect: Awaited<
          ReturnType<RepositoryInterviewProviderPortV1['execute']>
        >;
        try {
          effect = await candidateProvider.execute(request);
        } catch {
          await telemetry.emit(
            event('provider-completed', {
              candidateOrdinal: member.ordinal,
              resultCode: 'provider-port-failure',
              failureCode: 'provider-port-failure',
            }),
          );
          throw new Error('Repository interview provider operation failed.');
        }
        state.providerAttempts += effect.attempts.length;
        state.providerRetries += Math.max(0, effect.attempts.length - 1);
        recordProviderEffect(state.providerSummary, effect);
        await telemetry.emit(
          event('provider-completed', {
            candidateOrdinal: member.ordinal,
            resultCode: effect.status,
            attemptCount: effect.attempts.length,
            retryCount: Math.max(0, effect.attempts.length - 1),
            requestBytesBucket: byteBucket(
              request.prompt.instructionUtf8Bytes +
                request.prompt.evidenceUtf8Bytes,
            ),
            responseBytesBucket: byteBucket(
              effect.attempts.reduce(
                (total, attempt) => total + attempt.responseBytes,
                0,
              ),
            ),
            inputTokens: effect.usage?.inputTokens ?? null,
            cachedInputTokens: effect.usage?.cachedInputTokens ?? null,
            outputTokens: effect.usage?.outputTokens ?? null,
            reasoningTokens: effect.usage?.reasoningTokens ?? null,
            totalTokens: effect.usage?.totalTokens ?? null,
            failureCode: effect.status === 'failed' ? effect.failureCode : null,
          }),
        );
        if (candidateDeadline(control) !== null) {
          throw new Error('Repository interview provider operation failed.');
        }
        return effect;
      },
    });
    let publicationStatus: 'created' | 'idempotent' | null = null;
    const record: RepositoryInterviewRecordPortV1 = Object.freeze({
      async findReusable(lookup: RepositoryInterviewReuseLookupV1) {
        if (candidateDeadline(control) !== null) {
          throw new Error('Repository interview persistence operation failed.');
        }
        const reusable = await candidatePersistence.record.findReusable(lookup);
        if (candidateDeadline(control) !== null) {
          throw new Error('Repository interview persistence operation failed.');
        }
        return reusable;
      },
      async publish(command: RepositoryInterviewPublicationCommandV1) {
        if (candidateDeadline(control) !== null) {
          throw new Error('Repository interview persistence operation failed.');
        }
        const publication = await candidatePersistence.record.publish(command);
        if (
          publication.status === 'created' ||
          publication.status === 'idempotent'
        ) {
          publicationStatus = publication.status;
        }
        return publication;
      },
    });
    const beforeApplication = candidateDeadline(control);
    if (beforeApplication !== null) {
      state.stopCode ??= beforeApplication;
      return failedCandidate(member, beforeApplication, started, ports);
    }
    const result = await executeRepositoryInterviewV1(
      {
        artifactSet: context.artifactSet,
        artifacts: context.artifacts,
        specification: input.specification,
        modelProfile: input.modelProfile,
        executionMode: input.executionMode,
        forceReason: input.forceReason,
      },
      {
        provider,
        record,
        clock: ports.clock,
        nonce: ports.nonce,
      },
    );
    const afterApplication = candidateDeadline(control);
    const duration = readMonotonic(ports.monotonicClock) - started;
    if (!result.ok) {
      if (afterApplication !== null) {
        state.stopCode ??= afterApplication;
        return failedCandidate(member, afterApplication, started, ports);
      }
      const failureCode = result.issues[0]?.code ?? 'application-failed';
      const persistenceFailure =
        failureCode === 'record-port-failure' ||
        failureCode === 'record-port-conflict' ||
        failureCode === 'reuse-record-invalid';
      if (persistenceFailure) state.persistenceFailures += 1;
      return failedCandidate(
        member,
        failureCode,
        started,
        ports,
        persistenceFailure ? 'persistence-failed' : 'application-failed',
      );
    }
    const attempts = result.execution.attempts;
    const providerOutputDiagnosticCode =
      result.disposition === 'provider-failed'
        ? result.providerOutputDiagnosticCode
        : null;
    if (providerOutputDiagnosticCode !== null) {
      state.stopCode ??= providerOutputDiagnosticCode;
    }
    const usage =
      result.disposition === 'reused'
        ? ZERO_USAGE
        : (result.execution.outcome.usage ?? ZERO_USAGE);
    const cost = calculateRepositoryInterviewUsageCostMicroUsdV1(
      usage,
      policy.pricing,
    );
    const interview = result.interview;
    const status = interview === null ? 'provider-failed' : 'completed';
    const durablePublicationStatus =
      result.disposition === 'reused'
        ? 'reused'
        : result.disposition === 'created' ||
            result.disposition === 'idempotent'
          ? result.disposition
          : publicationStatus;
    if (durablePublicationStatus === null) {
      if (afterApplication !== null) state.stopCode ??= afterApplication;
      return failedCandidate(member, 'application-closure', started, ports);
    }
    const candidate: RepositoryInterviewOperatorCandidateResultV1 =
      Object.freeze({
        ordinal: member.ordinal,
        candidateId: member.candidateId,
        artifactSetId: member.artifactSetId,
        artifactSetIdentityDigest: member.artifactSetIdentityDigest,
        status,
        disposition: result.disposition,
        failureCode:
          result.execution.outcome.status === 'failed'
            ? result.execution.outcome.failureCode
            : null,
        requestId: result.request.requestId,
        requestRecordDigest: result.request.recordDigest,
        executionId: result.execution.executionId,
        executionRecordDigest: result.execution.recordDigest,
        interviewId: interview?.interviewId ?? null,
        interviewRecordDigest: interview?.recordDigest ?? null,
        attemptCount: result.disposition === 'reused' ? 0 : attempts.length,
        retryCount:
          result.disposition === 'reused'
            ? 0
            : Math.max(0, attempts.length - 1),
        publicationStatus: durablePublicationStatus,
        claims: interview?.claims.length ?? 0,
        citations: interview?.citations.length ?? 0,
        limitations: interview?.limitations.length ?? 0,
        contradictions: interview?.contradictions.length ?? 0,
        unknowns: interview?.unknowns.length ?? 0,
        usage,
        costMicroUsd: cost,
        durationMilliseconds: duration,
      });
    if (afterApplication !== null) state.stopCode ??= afterApplication;
    if (
      usage.inputTokens > policy.maximumInputTokensPerProviderCall ||
      usage.outputTokens > policy.maximumOutputTokensPerProviderCall ||
      usage.cachedInputTokens > policy.maximumRunCachedInputTokens ||
      usage.reasoningTokens > policy.maximumRunReasoningTokens ||
      duration > policy.candidateDeadlineMilliseconds ||
      exceedsCurrentRunBudget(state.results, candidate, policy)
    ) {
      state.stopCode ??=
        duration > policy.candidateDeadlineMilliseconds
          ? 'candidate-deadline'
          : 'budget-exhausted';
    }
    if (result.disposition !== 'reused') {
      await telemetry.emit(
        event('publication-completed', {
          candidateOrdinal: member.ordinal,
          executionId: candidate.executionId,
          interviewId: candidate.interviewId,
          disposition: candidate.disposition,
          publicationStatus: candidate.publicationStatus,
        }),
      );
    }
    await telemetry.emit(
      event(
        result.disposition === 'reused'
          ? 'candidate-reused'
          : 'candidate-completed',
        {
          candidateOrdinal: member.ordinal,
          executionId: candidate.executionId,
          interviewId: candidate.interviewId,
          disposition: candidate.disposition,
          durationMilliseconds: duration,
          attemptCount: candidate.attemptCount,
          retryCount: candidate.retryCount,
          inputTokens: usage.inputTokens,
          cachedInputTokens: usage.cachedInputTokens,
          outputTokens: usage.outputTokens,
          reasoningTokens: usage.reasoningTokens,
          totalTokens: usage.totalTokens,
          costMicroUsd: cost,
          failureCode: candidate.failureCode,
          ...(providerOutputDiagnosticCode === null
            ? {}
            : { resultCode: providerOutputDiagnosticCode }),
        },
      ),
    );
    const finalDeadline = candidateDeadline(control);
    if (finalDeadline !== null) state.stopCode ??= finalDeadline;
    return candidate;
  } finally {
    control.dispose();
  }
}

function candidateDeadline(
  control: RepositoryInterviewOperatorCandidateControlV1,
): Exclude<RepositoryInterviewOperatorCandidateOutcomeV1, 'active'> | null {
  const outcome = control.outcome();
  if (outcome === 'active') {
    if (control.signal.aborted) {
      throw new Error('Candidate control is inconsistent.');
    }
    return null;
  }
  if (!control.signal.aborted) {
    throw new Error('Candidate control is inconsistent.');
  }
  return outcome;
}

async function verifyImmediateReuse(
  selection: RepositoryInterviewOperatorSelectionV1,
  input: RunRepositoryInterviewOperatorInputV1,
  ports: RepositoryInterviewOperatorPortsV1,
  first: ReadonlyMap<string, { executionId: string; interviewId: string }>,
): Promise<
  Extract<
    RepositoryInterviewOperatorReceiptV1['immediateReuse'],
    { requested: true }
  >
> {
  let reused = 0;
  let providerCalls = 0;
  for (const member of selection.members) {
    const control = ports.candidateControl.beginCandidate({
      ordinal: member.ordinal,
      timeoutMilliseconds: input.policy.candidateDeadlineMilliseconds,
    });
    try {
      if (candidateDeadline(control) !== null) {
        return immediateReuseFailure(
          selection.members.length,
          reused,
          providerCalls,
        );
      }
      const persistence = ports.persistence.forCandidate(control.signal);
      const context = await persistence.loadArtifactContext(member, selection);
      if (candidateDeadline(control) !== null) {
        return immediateReuseFailure(
          selection.members.length,
          reused,
          providerCalls,
        );
      }
      const result = await executeRepositoryInterviewV1(
        {
          artifactSet: context.artifactSet,
          artifacts: context.artifacts,
          specification: input.specification,
          modelProfile: input.modelProfile,
          executionMode: 'normal',
          forceReason: null,
        },
        {
          provider: Object.freeze({
            execute: () => {
              providerCalls += 1;
              return Promise.reject(
                new Error('Immediate reuse provider guard.'),
              );
            },
          }),
          record: persistence.record,
          clock: ports.clock,
          nonce: ports.nonce,
        },
      );
      const authority = first.get(member.candidateId);
      if (
        !result.ok ||
        result.disposition !== 'reused' ||
        result.execution.executionId !== authority?.executionId ||
        result.interview.interviewId !== authority.interviewId
      )
        return immediateReuseFailure(
          selection.members.length,
          reused,
          providerCalls,
        );
      reused += 1;
    } catch {
      return immediateReuseFailure(
        selection.members.length,
        reused,
        providerCalls,
      );
    } finally {
      control.dispose();
    }
  }
  return Object.freeze({
    requested: true,
    passed: true,
    candidateCount: selection.members.length,
    reusedCount: reused,
    providerCalls: 0,
    providerAttempts: 0,
    tokenUsage: 0,
    costMicroUsd: 0,
  });
}

function immediateReuseFailure(
  candidateCount: number,
  reusedCount: number,
  providerCalls: number,
): Extract<
  RepositoryInterviewOperatorReceiptV1['immediateReuse'],
  { requested: true }
> {
  return Object.freeze({
    requested: true,
    passed: false,
    candidateCount,
    reusedCount,
    providerCalls,
    providerAttempts: 0,
    tokenUsage: 0,
    costMicroUsd: 0,
  });
}

function buildReceipt(args: {
  runId: string;
  startedAt: string;
  completedAt: string;
  durationMilliseconds: number;
  input: RunRepositoryInterviewOperatorInputV1;
  preflight: Extract<
    ReturnType<typeof validateRepositoryInterviewOperatorPreflightV1>,
    { ok: true }
  >;
  migration: MigrationVerification;
  state: MutableRunState;
  results: readonly RepositoryInterviewOperatorCandidateResultV1[];
  immediateReuse: RepositoryInterviewOperatorReceiptV1['immediateReuse'];
  telemetryEventCount: number;
  telemetryFailureCount: number;
}): RepositoryInterviewOperatorReceiptV1 {
  const { input, preflight, results } = args;
  const usage = sumUsage(results);
  const totalCost = results.reduce(
    (total, result) => total + result.costMicroUsd,
    0,
  );
  const completed = results.filter((result) => result.status === 'completed');
  const specification = input.specification.manifest;
  return createRepositoryInterviewOperatorReceiptV1({
    schemaVersion: '1.0.0',
    kind: 'repository-interview-operator-receipt',
    runId: args.runId,
    startedAt: args.startedAt,
    completedAt: args.completedAt,
    durationMilliseconds: args.durationMilliseconds,
    status: args.state.stopCode === null ? 'completed' : 'stopped',
    stopCode: args.state.stopCode,
    selection: {
      selectionId: preflight.selection.selectionId,
      selectionDigest: preflight.selection.selectionDigest,
      candidateCount: preflight.selection.members.length,
    },
    authorities: {
      catalogVersion: preflight.selection.catalogVersion,
      catalogDigest: preflight.selection.catalogDigest,
      artifactManifestVersion: preflight.selection.artifactManifestVersion,
      artifactManifestDigest: preflight.selection.artifactManifestDigest,
      specificationVersion: specification.specificationVersion,
      specificationDigest: specification.specificationDigest,
      rendererVersion: specification.rendererVersion,
      providerOutputSchemaVersion: specification.providerOutputSchema.version,
      providerOutputSchemaDigest: specification.providerOutputSchema.digest,
      providerProjectionVersion: specification.openAiProjection.version,
      providerProjectionDigest: specification.openAiProjection.digest,
      modelProfileDigest: preflight.modelProfileDigest,
      operatorPolicyDigest: preflight.policy.policyDigest,
      pricingAuthorityDate: preflight.policy.pricing.pricingAuthorityDate,
      pricingAuthorityDigest: preflight.policy.pricing.pricingAuthorityDigest,
    },
    database: {
      postgresqlVersion: args.migration.postgresqlVersion,
      latestMigrationVersion: 4,
      migrationInventoryDigest: migrationDigest(args.migration),
      migrationCount: args.migration.migrations.length,
    },
    executionPolicy: {
      executionMode: input.executionMode,
      forceReasonCode: input.forceReason,
      concurrency: preflight.policy.concurrency,
      candidateDeadlineMilliseconds:
        preflight.policy.candidateDeadlineMilliseconds,
      runDeadlineMilliseconds: preflight.policy.runDeadlineMilliseconds,
      maximumRunInputTokens: preflight.policy.maximumRunInputTokens,
      maximumRunCachedInputTokens: preflight.policy.maximumRunCachedInputTokens,
      maximumRunOutputTokens: preflight.policy.maximumRunOutputTokens,
      maximumRunReasoningTokens: preflight.policy.maximumRunReasoningTokens,
      maximumRunTotalTokens: preflight.policy.maximumRunTotalTokens,
      maximumRunCostMicroUsd: preflight.policy.maximumRunCostMicroUsd,
      immediateReuseRequested: input.verifyImmediateReuse,
    },
    counts: {
      requestedCandidates: preflight.selection.members.length,
      startedCandidates: results.length,
      completedCandidates: completed.length,
      reusedCandidates: countDisposition(results, 'reused'),
      createdCandidates: countDisposition(results, 'created'),
      idempotentCandidates: countDisposition(results, 'idempotent'),
      providerFailedCandidates: results.filter(
        (r) => r.status === 'provider-failed',
      ).length,
      applicationFailedCandidates: results.filter(
        (r) => r.status === 'application-failed',
      ).length,
      persistenceFailedCandidates: args.state.persistenceFailures,
      notStartedCandidates: preflight.selection.members.length - results.length,
      providerCalls: args.state.providerCalls,
      providerAttempts: args.state.providerAttempts,
      providerRetries: args.state.providerRetries,
    },
    semanticCounts: {
      interviews: completed.length,
      claims: sum(results, 'claims'),
      citations: sum(results, 'citations'),
      limitations: sum(results, 'limitations'),
      contradictions: sum(results, 'contradictions'),
      unknowns: sum(results, 'unknowns'),
    },
    usage,
    cost: {
      currency: 'USD',
      unit: 'micro-usd',
      totalMicroUsd: totalCost,
      maximumMicroUsd: preflight.policy.maximumRunCostMicroUsd,
    },
    providerSummary: args.state.providerSummary,
    candidateResults: results,
    immediateReuse: args.immediateReuse,
    telemetry: {
      eventCount: args.telemetryEventCount,
      telemetryFailureCount: args.telemetryFailureCount,
    },
  });
}

function validateMigrationAuthority(value: MigrationVerification): void {
  if (
    !/^18[.]4(?:[.\s]|$)/u.test(value.postgresqlVersion) ||
    value.migrations.length !== 4
  ) {
    throw new Error('Migration authority is invalid.');
  }
  for (let index = 0; index < MIGRATIONS.length; index += 1) {
    const expected = MIGRATIONS[index];
    const actual = value.migrations[index];
    if (
      expected === undefined ||
      actual === undefined ||
      String(actual.version) !== expected[0] ||
      actual.name !== expected[1] ||
      actual.checksum !== expected[2]
    )
      throw new Error('Migration authority is invalid.');
  }
}

function migrationDigest(value: MigrationVerification): string {
  return sha256Digest(
    `gitblocks\0repository-interview-migration-inventory\0v1\0${canonicalizeJson(value)}`,
  );
}

function failedCandidate(
  member: RepositoryInterviewOperatorSelectionMemberV1,
  failureCode: string,
  started: number,
  ports: RepositoryInterviewOperatorPortsV1,
  status: 'application-failed' | 'persistence-failed' = 'application-failed',
): RepositoryInterviewOperatorCandidateResultV1 {
  return Object.freeze({
    ordinal: member.ordinal,
    candidateId: member.candidateId,
    artifactSetId: member.artifactSetId,
    artifactSetIdentityDigest: member.artifactSetIdentityDigest,
    status,
    disposition: null,
    failureCode,
    requestId: null,
    requestRecordDigest: null,
    executionId: null,
    executionRecordDigest: null,
    interviewId: null,
    interviewRecordDigest: null,
    attemptCount: 0,
    retryCount: 0,
    publicationStatus: null,
    claims: 0,
    citations: 0,
    limitations: 0,
    contradictions: 0,
    unknowns: 0,
    usage: ZERO_USAGE,
    costMicroUsd: 0,
    durationMilliseconds: readMonotonic(ports.monotonicClock) - started,
  });
}

function sumUsage(
  results: readonly RepositoryInterviewOperatorCandidateResultV1[],
): RepositoryInterviewOperatorUsageV1 {
  return Object.freeze({
    inputTokens: sumUsageField(results, 'inputTokens'),
    cachedInputTokens: sumUsageField(results, 'cachedInputTokens'),
    outputTokens: sumUsageField(results, 'outputTokens'),
    reasoningTokens: sumUsageField(results, 'reasoningTokens'),
    totalTokens: sumUsageField(results, 'totalTokens'),
  });
}

function sumUsageField(
  results: readonly RepositoryInterviewOperatorCandidateResultV1[],
  field: keyof RepositoryInterviewOperatorUsageV1,
): number {
  return results.reduce((total, result) => total + result.usage[field], 0);
}

function exceedsCurrentRunBudget(
  current: readonly (
    RepositoryInterviewOperatorCandidateResultV1 | undefined
  )[],
  candidate: RepositoryInterviewOperatorCandidateResultV1,
  policy: RepositoryInterviewOperatorPolicyV1,
): boolean {
  const results = [
    ...current.filter(
      (value): value is RepositoryInterviewOperatorCandidateResultV1 =>
        value !== undefined,
    ),
    candidate,
  ];
  const usage = sumUsage(results);
  const cost = results.reduce(
    (total, result) => total + result.costMicroUsd,
    0,
  );
  return (
    usage.inputTokens > policy.maximumRunInputTokens ||
    usage.cachedInputTokens > policy.maximumRunCachedInputTokens ||
    usage.outputTokens > policy.maximumRunOutputTokens ||
    usage.reasoningTokens > policy.maximumRunReasoningTokens ||
    usage.totalTokens > policy.maximumRunTotalTokens ||
    cost > policy.maximumRunCostMicroUsd
  );
}

function sum(
  results: readonly RepositoryInterviewOperatorCandidateResultV1[],
  field: 'claims' | 'citations' | 'limitations' | 'contradictions' | 'unknowns',
): number {
  return results.reduce((total, result) => total + result[field], 0);
}

function countDisposition(
  results: readonly RepositoryInterviewOperatorCandidateResultV1[],
  disposition: 'created' | 'idempotent' | 'reused',
): number {
  return results.filter((result) => result.disposition === disposition).length;
}

function emptyProviderSummary(): MutableProviderSummary {
  return {
    responses: 0,
    networkErrors: 0,
    deadlines: 0,
    cancellations: 0,
    refusals: 0,
    incomplete: 0,
    safetyInterruptions: 0,
    rateLimited: 0,
    quotaExceeded: 0,
    providerErrors: 0,
    invalidResponses: 0,
    invalidUsage: 0,
    responseTooLarge: 0,
    minimumRemainingRequests: null,
    minimumRemainingTokens: null,
    maximumResetRequestsMilliseconds: null,
    maximumResetTokensMilliseconds: null,
  };
}

function recordProviderEffect(
  summary: MutableProviderSummary,
  effect: RepositoryInterviewProviderEffectResultV1,
): void {
  for (const attempt of effect.attempts) {
    if (attempt.transportOutcome === 'response') summary.responses += 1;
    if (attempt.transportOutcome === 'network-error')
      summary.networkErrors += 1;
    if (attempt.transportOutcome === 'deadline-exceeded')
      summary.deadlines += 1;
    summary.minimumRemainingRequests = minimumNullable(
      summary.minimumRemainingRequests,
      attempt.remainingRequests,
    );
    summary.minimumRemainingTokens = minimumNullable(
      summary.minimumRemainingTokens,
      attempt.remainingTokens,
    );
    summary.maximumResetRequestsMilliseconds = maximumNullable(
      summary.maximumResetRequestsMilliseconds,
      attempt.resetRequestsMilliseconds,
    );
    summary.maximumResetTokensMilliseconds = maximumNullable(
      summary.maximumResetTokensMilliseconds,
      attempt.resetTokensMilliseconds,
    );
  }
  if (effect.status !== 'failed') return;
  switch (effect.failureCode) {
    case 'cancelled':
      summary.cancellations += 1;
      break;
    case 'refused':
      summary.refusals += 1;
      break;
    case 'incomplete':
      summary.incomplete += 1;
      break;
    case 'safety-interrupted':
      summary.safetyInterruptions += 1;
      break;
    case 'rate-limited':
      summary.rateLimited += 1;
      break;
    case 'quota-exceeded':
      summary.quotaExceeded += 1;
      break;
    case 'provider-error':
      summary.providerErrors += 1;
      break;
    case 'invalid-response':
      summary.invalidResponses += 1;
      break;
    case 'invalid-usage':
      summary.invalidUsage += 1;
      break;
    case 'response-too-large':
      summary.responseTooLarge += 1;
      break;
    case 'deadline-exceeded':
    case 'not-authorized':
    case 'transport-error':
      break;
  }
}

function minimumNullable(
  current: number | null,
  value: number | null,
): number | null {
  if (value === null) return current;
  return current === null ? value : Math.min(current, value);
}

function maximumNullable(
  current: number | null,
  value: number | null,
): number | null {
  if (value === null) return current;
  return current === null ? value : Math.max(current, value);
}

function byteBucket(value: number): string {
  if (value === 0) return '0';
  if (value <= 1_024) return '1-1024';
  if (value <= 65_536) return '1025-65536';
  if (value <= 1_048_576) return '65537-1048576';
  return '1048577-plus';
}

function event(
  name: RepositoryInterviewOperatorEventV1['event'],
  values: Partial<
    Omit<
      RepositoryInterviewOperatorEventV1,
      'schemaVersion' | 'event' | 'sequence' | 'runId'
    >
  > = {},
): Omit<
  RepositoryInterviewOperatorEventV1,
  'schemaVersion' | 'sequence' | 'runId'
> {
  return {
    event: name,
    candidateOrdinal: values.candidateOrdinal ?? null,
    executionId: values.executionId ?? null,
    interviewId: values.interviewId ?? null,
    resultCode: values.resultCode ?? null,
    disposition: values.disposition ?? null,
    durationMilliseconds: values.durationMilliseconds ?? null,
    attemptCount: values.attemptCount ?? null,
    retryCount: values.retryCount ?? null,
    requestBytesBucket: values.requestBytesBucket ?? null,
    responseBytesBucket: values.responseBytesBucket ?? null,
    inputTokens: values.inputTokens ?? null,
    cachedInputTokens: values.cachedInputTokens ?? null,
    outputTokens: values.outputTokens ?? null,
    reasoningTokens: values.reasoningTokens ?? null,
    totalTokens: values.totalTokens ?? null,
    costMicroUsd: values.costMicroUsd ?? null,
    publicationStatus: values.publicationStatus ?? null,
    failureCode: values.failureCode ?? null,
  };
}

function readMonotonic(
  port: RepositoryInterviewOperatorMonotonicClockPortV1,
): number {
  const value = port.nowMilliseconds();
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error('Monotonic clock is invalid.');
  }
  return value;
}

function failureWithoutReceipt(
  code: Parameters<typeof operatorIssue>[0],
): RunRepositoryInterviewOperatorResultV1 {
  return { ok: false, receipt: null, issues: [operatorIssue(code)] };
}

function isTimestamp(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[.]\d{3}Z$/u.test(value)) {
    return false;
  }
  const milliseconds = Date.parse(value);
  return (
    Number.isFinite(milliseconds) &&
    new Date(milliseconds).toISOString() === value
  );
}
