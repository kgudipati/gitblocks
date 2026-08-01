import type { ModelExecutionModelProfileV1 } from '@gitblocks/contracts';
import {
  calculateRepositoryInterviewWorstCaseV1,
  parseRepositoryInterviewCandidatePlanV1,
  parseRepositoryInterviewOperatorPolicyV1,
  type RepositoryInterviewCandidatePlanV1,
  type RepositoryInterviewOperatorPolicyV1,
  type RepositoryInterviewOperatorWorstCaseV1,
} from '@gitblocks/repository-interview-operator';

const PLAN_LIMITS = Object.freeze({
  'repository-interview-calibration-six-v1': {
    count: 6,
    maximumCostMicroUsd: 10_000_000,
  },
  'repository-interview-gate-a-thirty-v1': {
    count: 30,
    maximumCostMicroUsd: 40_000_000,
  },
  'repository-interview-gate-b-one-hundred-fifty-v1': {
    count: 150,
    maximumCostMicroUsd: 120_000_000,
  },
});

export function validateRepositoryInterviewPrelivePolicyMatrixV1(
  candidatePlanInput: RepositoryInterviewCandidatePlanV1,
  policyInput: RepositoryInterviewOperatorPolicyV1,
  modelProfile: ModelExecutionModelProfileV1,
): RepositoryInterviewOperatorWorstCaseV1 {
  const plan = parseRepositoryInterviewCandidatePlanV1(candidatePlanInput);
  const policy = parseRepositoryInterviewOperatorPolicyV1(
    policyInput,
    modelProfile,
  );
  if (!plan.ok || !policy.ok) throw invalid();
  const limits = PLAN_LIMITS[plan.value.planId as keyof typeof PLAN_LIMITS] as
    | { readonly count: number; readonly maximumCostMicroUsd: number }
    | undefined;
  if (
    plan.value.candidateIds.length !== limits?.count ||
    policy.value.maximumCandidates !== limits.count ||
    policy.value.maximumOutputTokensPerProviderCall !== 8_192 ||
    policy.value.candidateDeadlineMilliseconds < 300_000 ||
    policy.value.runDeadlineMilliseconds > 86_400_000 ||
    policy.value.maximumRunCostMicroUsd > limits.maximumCostMicroUsd
  )
    throw invalid();
  try {
    return calculateRepositoryInterviewWorstCaseV1(limits.count, policy.value);
  } catch {
    throw invalid();
  }
}

function invalid(): Error {
  const error = new Error('Repository interview synthetic policy is invalid.');
  Object.defineProperty(error, 'stack', { value: undefined });
  return error;
}
