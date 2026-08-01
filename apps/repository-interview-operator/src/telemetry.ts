import { ownAndFreezeOperatorData } from './plain-data.ts';

export const REPOSITORY_INTERVIEW_OPERATOR_EVENT_NAMES = Object.freeze([
  'operator-started',
  'candidate-started',
  'candidate-reused',
  'provider-completed',
  'publication-completed',
  'candidate-completed',
  'operator-stopped',
  'operator-completed',
] as const);

export type RepositoryInterviewOperatorEventName =
  (typeof REPOSITORY_INTERVIEW_OPERATOR_EVENT_NAMES)[number];

export interface RepositoryInterviewOperatorEventV1 {
  readonly schemaVersion: '1.0.0';
  readonly event: RepositoryInterviewOperatorEventName;
  readonly sequence: number;
  readonly runId: string;
  readonly candidateOrdinal: number | null;
  readonly executionId: string | null;
  readonly interviewId: string | null;
  readonly resultCode: string | null;
  readonly disposition: string | null;
  readonly durationMilliseconds: number | null;
  readonly attemptCount: number | null;
  readonly retryCount: number | null;
  readonly requestBytesBucket: string | null;
  readonly responseBytesBucket: string | null;
  readonly inputTokens: number | null;
  readonly cachedInputTokens: number | null;
  readonly outputTokens: number | null;
  readonly reasoningTokens: number | null;
  readonly totalTokens: number | null;
  readonly costMicroUsd: number | null;
  readonly publicationStatus: string | null;
  readonly failureCode: string | null;
}

export interface RepositoryInterviewOperatorObserverV1 {
  observe(event: RepositoryInterviewOperatorEventV1): void | Promise<void>;
}

type EventDraft = Omit<
  RepositoryInterviewOperatorEventV1,
  'schemaVersion' | 'sequence' | 'runId'
>;

export function createRepositoryInterviewOperatorTelemetryV1(
  runId: string,
  observer: RepositoryInterviewOperatorObserverV1,
): {
  emit(event: EventDraft): Promise<void>;
  readonly eventCount: number;
  readonly failureCount: number;
} {
  let sequence = 0;
  let failures = 0;
  return {
    async emit(draft: EventDraft): Promise<void> {
      const event = ownAndFreezeOperatorData({
        schemaVersion: '1.0.0',
        event: draft.event,
        sequence,
        runId,
        candidateOrdinal: draft.candidateOrdinal,
        executionId: draft.executionId,
        interviewId: draft.interviewId,
        resultCode: draft.resultCode,
        disposition: draft.disposition,
        durationMilliseconds: draft.durationMilliseconds,
        attemptCount: draft.attemptCount,
        retryCount: draft.retryCount,
        requestBytesBucket: draft.requestBytesBucket,
        responseBytesBucket: draft.responseBytesBucket,
        inputTokens: draft.inputTokens,
        cachedInputTokens: draft.cachedInputTokens,
        outputTokens: draft.outputTokens,
        reasoningTokens: draft.reasoningTokens,
        totalTokens: draft.totalTokens,
        costMicroUsd: draft.costMicroUsd,
        publicationStatus: draft.publicationStatus,
        failureCode: draft.failureCode,
      }) as RepositoryInterviewOperatorEventV1;
      sequence += 1;
      try {
        await observer.observe(event);
      } catch {
        failures = Math.min(failures + 1, 1_000_000);
      }
    },
    get eventCount(): number {
      return sequence;
    },
    get failureCount(): number {
      return failures;
    },
  };
}

export const NOOP_REPOSITORY_INTERVIEW_OPERATOR_OBSERVER = Object.freeze({
  observe: () => undefined,
}) satisfies RepositoryInterviewOperatorObserverV1;
