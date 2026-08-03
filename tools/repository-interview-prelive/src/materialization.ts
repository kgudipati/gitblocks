import {
  parseRepositoryArtifactSetV1,
  type RepositoryArtifactSetV1,
} from '@gitblocks/contracts';
import {
  parseCompleteArtifactReceiptV1,
  type ArtifactReceipt,
} from '@gitblocks/ingestion';
import {
  createRepositoryInterviewOperatorSelectionV1,
  createRepositoryInterviewSelectionMaterializationV1,
  parseRepositoryInterviewCandidatePlanV1,
  parseRepositoryInterviewOperatorSelectionV1,
  parseRepositoryInterviewSelectionMaterializationV1,
  REPOSITORY_INTERVIEW_ARTIFACT_MANIFEST_DIGEST,
  REPOSITORY_INTERVIEW_ARTIFACT_MANIFEST_VERSION,
  REPOSITORY_INTERVIEW_CATALOG_DIGEST,
  REPOSITORY_INTERVIEW_CATALOG_VERSION,
  type RepositoryInterviewCandidatePlanV1,
  type RepositoryInterviewOperatorSelectionV1,
  type RepositoryInterviewSelectionMaterializationV1,
} from '@gitblocks/repository-interview-operator';

export interface RepositoryInterviewArtifactSetLoadPortV1 {
  loadRepositoryArtifactSet(
    artifactSetId: string,
  ): Promise<RepositoryArtifactSetV1>;
}

export interface MaterializeRepositoryInterviewOperatorSelectionInputV1 {
  readonly candidatePlan: RepositoryInterviewCandidatePlanV1;
  readonly artifactReceipt: ArtifactReceipt;
  readonly fullCatalogCandidateIds: readonly string[];
  readonly selectionId: string;
}

export interface MaterializeRepositoryInterviewOperatorSelectionResultV1 {
  readonly selection: RepositoryInterviewOperatorSelectionV1;
  readonly materialization: RepositoryInterviewSelectionMaterializationV1;
}

export async function materializeRepositoryInterviewOperatorSelectionV1(
  input: MaterializeRepositoryInterviewOperatorSelectionInputV1,
  persistence: RepositoryInterviewArtifactSetLoadPortV1,
): Promise<MaterializeRepositoryInterviewOperatorSelectionResultV1> {
  const parsedPlan = parseRepositoryInterviewCandidatePlanV1(
    input.candidatePlan,
  );
  if (!parsedPlan.ok) throw invalid();
  const plan = parsedPlan.value;
  const receipt = parseCompleteArtifactReceiptV1(input.artifactReceipt, {
    catalogVersion: REPOSITORY_INTERVIEW_CATALOG_VERSION,
    catalogDigest: REPOSITORY_INTERVIEW_CATALOG_DIGEST,
    artifactManifestVersion: REPOSITORY_INTERVIEW_ARTIFACT_MANIFEST_VERSION,
    artifactManifestDigest: REPOSITORY_INTERVIEW_ARTIFACT_MANIFEST_DIGEST,
    candidateIds: input.fullCatalogCandidateIds,
    databaseMigrationVersion: 4,
  });
  const receiptCandidates = new Map(
    receipt.candidates.map((candidate) => [candidate.candidateId, candidate]),
  );
  const members = [];
  for (let ordinal = 0; ordinal < plan.candidateIds.length; ordinal += 1) {
    const candidateId = plan.candidateIds[ordinal];
    const receiptCandidate =
      candidateId === undefined
        ? undefined
        : receiptCandidates.get(candidateId);
    if (
      candidateId === undefined ||
      receiptCandidate === undefined ||
      receiptCandidate.outcome === 'failed' ||
      receiptCandidate.artifactSetId === null
    )
      throw invalid();
    let loaded: unknown;
    try {
      loaded = await persistence.loadRepositoryArtifactSet(
        receiptCandidate.artifactSetId,
      );
    } catch {
      throw invalid();
    }
    const parsedSet = parseRepositoryArtifactSetV1(loaded);
    if (
      !parsedSet.ok ||
      parsedSet.value.artifactSetId !== receiptCandidate.artifactSetId ||
      parsedSet.value.candidateId !== candidateId ||
      parsedSet.value.catalogDigest !== plan.catalogDigest ||
      parsedSet.value.artifactManifestDigest !== plan.artifactManifestDigest
    )
      throw invalid();
    members.push({
      ordinal,
      candidateId,
      artifactSetId: parsedSet.value.artifactSetId,
      artifactSetIdentityDigest: parsedSet.value.identityDigest,
    });
  }
  const selection = createRepositoryInterviewOperatorSelectionV1({
    schemaVersion: '1.0.0',
    selectionId: input.selectionId,
    catalogVersion: plan.catalogVersion,
    catalogDigest: plan.catalogDigest,
    artifactManifestVersion: plan.artifactManifestVersion,
    artifactManifestDigest: plan.artifactManifestDigest,
    members,
  });
  const materialization = createRepositoryInterviewSelectionMaterializationV1({
    schemaVersion: '1.0.0',
    materializationId: `materialization-${selection.selectionDigest.slice(0, 48)}`,
    candidatePlanId: plan.planId,
    candidatePlanDigest: plan.planDigest,
    artifactCollectionReceiptVersion: receipt.receiptVersion,
    artifactCollectionReceiptDigest: receipt.receiptDigest,
    catalogVersion: plan.catalogVersion,
    catalogDigest: plan.catalogDigest,
    artifactManifestVersion: plan.artifactManifestVersion,
    artifactManifestDigest: plan.artifactManifestDigest,
    operatorSelectionId: selection.selectionId,
    operatorSelectionDigest: selection.selectionDigest,
    candidateCount: selection.members.length,
  });
  return Object.freeze({ selection, materialization });
}

export function validateRepositoryInterviewSelectionMaterializationClosureV1(input: {
  readonly candidatePlan: unknown;
  readonly artifactReceipt: unknown;
  readonly fullCatalogCandidateIds: readonly string[];
  readonly selection: unknown;
  readonly materialization: unknown;
}): {
  readonly candidatePlan: RepositoryInterviewCandidatePlanV1;
  readonly artifactReceipt: ArtifactReceipt;
  readonly selection: RepositoryInterviewOperatorSelectionV1;
  readonly materialization: RepositoryInterviewSelectionMaterializationV1;
} {
  const plan = parseRepositoryInterviewCandidatePlanV1(input.candidatePlan);
  const selection = parseRepositoryInterviewOperatorSelectionV1(
    input.selection,
  );
  const materialization = parseRepositoryInterviewSelectionMaterializationV1(
    input.materialization,
  );
  if (!plan.ok || !selection.ok || !materialization.ok) throw invalid();
  const receipt = parseCompleteArtifactReceiptV1(input.artifactReceipt, {
    catalogVersion: REPOSITORY_INTERVIEW_CATALOG_VERSION,
    catalogDigest: REPOSITORY_INTERVIEW_CATALOG_DIGEST,
    artifactManifestVersion: REPOSITORY_INTERVIEW_ARTIFACT_MANIFEST_VERSION,
    artifactManifestDigest: REPOSITORY_INTERVIEW_ARTIFACT_MANIFEST_DIGEST,
    candidateIds: input.fullCatalogCandidateIds,
    databaseMigrationVersion: 4,
  });
  const selectedCandidateIds = selection.value.members.map(
    ({ candidateId }) => candidateId,
  );
  const receiptByCandidate = new Map(
    receipt.candidates.map((candidate) => [candidate.candidateId, candidate]),
  );
  if (
    plan.value.candidateIds.length !== selection.value.members.length ||
    plan.value.candidateIds.some(
      (candidateId, index) => candidateId !== selectedCandidateIds[index],
    ) ||
    selection.value.members.some(
      (member) =>
        receiptByCandidate.get(member.candidateId)?.artifactSetId !==
        member.artifactSetId,
    ) ||
    selection.value.catalogVersion !== plan.value.catalogVersion ||
    selection.value.catalogDigest !== plan.value.catalogDigest ||
    selection.value.artifactManifestVersion !==
      plan.value.artifactManifestVersion ||
    selection.value.artifactManifestDigest !==
      plan.value.artifactManifestDigest ||
    materialization.value.candidatePlanId !== plan.value.planId ||
    materialization.value.candidatePlanDigest !== plan.value.planDigest ||
    materialization.value.artifactCollectionReceiptDigest !==
      receipt.receiptDigest ||
    materialization.value.operatorSelectionId !== selection.value.selectionId ||
    materialization.value.operatorSelectionDigest !==
      selection.value.selectionDigest ||
    materialization.value.candidateCount !== selection.value.members.length
  )
    throw invalid();
  return Object.freeze({
    candidatePlan: plan.value,
    artifactReceipt: receipt,
    selection: selection.value,
    materialization: materialization.value,
  });
}

function invalid(): Error {
  const error = new Error('Repository interview materialization is invalid.');
  Object.defineProperty(error, 'stack', { value: undefined });
  return error;
}
