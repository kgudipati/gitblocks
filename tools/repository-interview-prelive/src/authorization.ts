import {
  modelExecutionModelProfileDigest,
  parseModelExecutionModelProfileV1,
  type ModelExecutionModelProfileV1,
} from '@gitblocks/contracts';
import type { ArtifactReceipt } from '@gitblocks/ingestion';
import {
  parseRepositoryInterviewOperatorPolicyV1,
  parseRepositoryInterviewPreliveAuthorizationV1,
  type RepositoryInterviewCandidatePlanV1,
  type RepositoryInterviewOperatorPolicyV1,
  type RepositoryInterviewOperatorSelectionV1,
  type RepositoryInterviewPreliveAuthorizationV1,
  type RepositoryInterviewSelectionMaterializationV1,
} from '@gitblocks/repository-interview-operator';

import { validateRepositoryInterviewSelectionMaterializationClosureV1 } from './materialization.ts';

export interface ValidateRepositoryInterviewPreliveAuthorizationClosureInputV1 {
  readonly candidatePlan: unknown;
  readonly calibrationCandidatePlan: RepositoryInterviewCandidatePlanV1;
  readonly artifactReceipt: unknown;
  readonly fullCatalogCandidateIds: readonly string[];
  readonly selection: unknown;
  readonly materialization: unknown;
  readonly authorization: unknown;
  readonly modelProfile: unknown;
  readonly operatorPolicy: unknown;
  readonly allowedModelProfileDigests: readonly [string, string];
  readonly specificationDigest: string;
  readonly now?: string;
}

export interface ValidatedRepositoryInterviewPreliveAuthorizationClosureV1 {
  readonly candidatePlan: RepositoryInterviewCandidatePlanV1;
  readonly artifactReceipt: ArtifactReceipt;
  readonly selection: RepositoryInterviewOperatorSelectionV1;
  readonly materialization: RepositoryInterviewSelectionMaterializationV1;
  readonly authorization: RepositoryInterviewPreliveAuthorizationV1;
  readonly modelProfile: ModelExecutionModelProfileV1;
  readonly operatorPolicy: RepositoryInterviewOperatorPolicyV1;
}

export function validateRepositoryInterviewPreliveAuthorizationClosureV1(
  input: ValidateRepositoryInterviewPreliveAuthorizationClosureInputV1,
): ValidatedRepositoryInterviewPreliveAuthorizationClosureV1 {
  const materialized =
    validateRepositoryInterviewSelectionMaterializationClosureV1(input);
  const authorization = parseRepositoryInterviewPreliveAuthorizationV1(
    input.authorization,
  );
  const modelProfile = parseModelExecutionModelProfileV1(input.modelProfile);
  if (!authorization.ok || !modelProfile.ok) throw invalid();
  const policy = parseRepositoryInterviewOperatorPolicyV1(
    input.operatorPolicy,
    modelProfile.value,
  );
  if (!policy.ok) throw invalid();
  const expectedProfiles = [...input.allowedModelProfileDigests].sort(
    compareText,
  );
  const authorizedProfiles = [
    ...authorization.value.allowedModelProfileDigests,
  ];
  if (
    materialized.candidatePlan.planId !==
      input.calibrationCandidatePlan.planId ||
    materialized.candidatePlan.planDigest !==
      input.calibrationCandidatePlan.planDigest ||
    materialized.candidatePlan.candidateIds.length !== 6 ||
    authorization.value.candidatePlanId !== materialized.candidatePlan.planId ||
    authorization.value.candidatePlanDigest !==
      materialized.candidatePlan.planDigest ||
    authorization.value.artifactCollectionReceiptDigest !==
      materialized.artifactReceipt.receiptDigest ||
    authorization.value.selectionMaterializationDigest !==
      materialized.materialization.materializationDigest ||
    authorization.value.selectionId !== materialized.selection.selectionId ||
    authorization.value.selectionDigest !==
      materialized.selection.selectionDigest ||
    expectedProfiles.length !== 2 ||
    expectedProfiles.some(
      (profile, index) => profile !== authorizedProfiles[index],
    ) ||
    !expectedProfiles.includes(
      modelExecutionModelProfileDigest(modelProfile.value),
    ) ||
    authorization.value.specificationDigest !== input.specificationDigest ||
    authorization.value.catalogDigest !==
      materialized.candidatePlan.catalogDigest ||
    authorization.value.artifactManifestDigest !==
      materialized.candidatePlan.artifactManifestDigest ||
    authorization.value.operatorPolicyDigest !== policy.value.policyDigest ||
    authorization.value.pricingAuthorityDigest !==
      policy.value.pricing.pricingAuthorityDigest ||
    authorization.value.maximumProviderCalls !== 12 ||
    authorization.value.maximumCostMicroUsd > 10_000_000 ||
    policy.value.maximumRunCostMicroUsd >
      authorization.value.maximumCostMicroUsd
  )
    throw invalid();
  if (input.now !== undefined) {
    if (!timestamp(input.now)) throw invalid();
    const now = Date.parse(input.now);
    if (
      Date.parse(authorization.value.authorizedAt) > now ||
      Date.parse(authorization.value.expiresAt) <= now
    )
      throw invalid();
  }
  return Object.freeze({
    ...materialized,
    authorization: authorization.value,
    modelProfile: modelProfile.value,
    operatorPolicy: policy.value,
  });
}

function timestamp(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value
  );
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function invalid(): Error {
  const error = new Error(
    'Repository interview pre-live authorization closure is invalid.',
  );
  Object.defineProperty(error, 'stack', { value: undefined });
  return error;
}
