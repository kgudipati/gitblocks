import {
  canonicalizeFitAssessmentRequest,
  canonicalizeFitAssessmentResult,
} from './canonicalize.ts';
import { addEvidenceProvenanceIssues } from './evidence-validation.ts';
import {
  addIssue,
  addStableIdIssues,
  prefixIssues,
  resultFromIssues,
  type DomainIssue,
  type DomainResult,
} from './issues.ts';
import type {
  CandidateAssessment,
  CandidateId,
  CandidateLimitation,
  EvidenceId,
  EvidenceObservation,
  EvidenceReference,
  FitAssessmentExchange,
  FitAssessmentRequest,
  FitAssessmentResult,
  HardConstraintConflict,
  HardConstraintConflictId,
  Inference,
  InferenceId,
  LimitationId,
  MaterialClaim,
  MaterialClaimId,
  MaterialUnknown,
  MaterialUnknownId,
} from './model.ts';
import { addRankingIssues } from './ranking.ts';
import {
  addDuplicateIdIssues,
  addEvidenceReferenceIssues,
  addOwnedReferenceIssues,
  sameUniqueSet,
} from './reference-validation.ts';
import { validateFitAssessmentRequest } from './request-validation.ts';
import { parseUtcTimestamp } from './temporal.ts';

function timestampAt(
  issues: DomainIssue[],
  value: string,
  path: string,
): number | null {
  const parsed = parseUtcTimestamp(value);
  if (parsed === null) {
    addIssue(issues, 'timestamp.invalid', path);
  }
  return parsed;
}

function evidenceReferenceKey(reference: EvidenceReference): string {
  return `${reference.candidateId}\u0000${reference.evidenceId}`;
}

function sameEvidenceReferences(
  left: readonly EvidenceReference[],
  right: readonly EvidenceReference[],
): boolean {
  return (
    left.length === right.length &&
    left.every((reference, index) => {
      const matching = right[index];
      return (
        matching !== undefined &&
        evidenceReferenceKey(reference) === evidenceReferenceKey(matching)
      );
    })
  );
}

function sameEvidenceObservation(
  left: EvidenceObservation,
  right: EvidenceObservation,
): boolean {
  return (
    left.evidenceId === right.evidenceId &&
    left.candidateId === right.candidateId &&
    left.topic === right.topic &&
    left.dimension === right.dimension &&
    left.observation === right.observation &&
    sameEvidenceProvenance(left.provenance, right.provenance) &&
    left.freshness.status === right.freshness.status &&
    left.freshness.asOf === right.freshness.asOf &&
    left.freshness.scope === right.freshness.scope &&
    left.limitation === right.limitation
  );
}

function sameEvidenceProvenance(
  left: EvidenceObservation['provenance'],
  right: EvidenceObservation['provenance'],
): boolean {
  if (left.kind !== right.kind || left.sourceType !== right.sourceType) {
    return false;
  }
  switch (left.kind) {
    case 'git-commit':
      return (
        right.kind === 'git-commit' &&
        left.sourceUrl === right.sourceUrl &&
        left.commitSha === right.commitSha &&
        left.immutableUrl === right.immutableUrl &&
        left.publishedAt === right.publishedAt &&
        left.collectedAt === right.collectedAt
      );
    case 'tag':
      return (
        right.kind === 'tag' &&
        left.sourceUrl === right.sourceUrl &&
        left.tag === right.tag &&
        left.immutableUrl === right.immutableUrl &&
        left.publishedAt === right.publishedAt &&
        left.collectedAt === right.collectedAt
      );
    case 'release':
      return (
        right.kind === 'release' &&
        left.sourceUrl === right.sourceUrl &&
        left.release === right.release &&
        left.immutableUrl === right.immutableUrl &&
        left.publishedAt === right.publishedAt &&
        left.collectedAt === right.collectedAt
      );
    case 'package-version':
      return (
        right.kind === 'package-version' &&
        left.sourceUrl === right.sourceUrl &&
        left.packageVersion === right.packageVersion &&
        left.immutableUrl === right.immutableUrl &&
        left.publishedAt === right.publishedAt &&
        left.collectedAt === right.collectedAt
      );
    case 'security-advisory':
      return (
        right.kind === 'security-advisory' &&
        left.sourceUrl === right.sourceUrl &&
        left.advisoryId === right.advisoryId &&
        left.immutableUrl === right.immutableUrl &&
        left.publishedAt === right.publishedAt &&
        left.collectedAt === right.collectedAt
      );
    case 'mutable-documentation':
      return (
        right.kind === 'mutable-documentation' &&
        left.sourceUrl === right.sourceUrl &&
        left.collectedAt === right.collectedAt
      );
    case 'structured-provider-snapshot':
      return (
        right.kind === 'structured-provider-snapshot' &&
        left.provider === right.provider &&
        left.sourceClass === right.sourceClass &&
        left.sourceIdentity === right.sourceIdentity &&
        left.sourceUrl === right.sourceUrl &&
        left.sourceAuthorityDigest === right.sourceAuthorityDigest &&
        left.sourceRecordDigest === right.sourceRecordDigest &&
        left.collectedAt === right.collectedAt &&
        left.effectiveAsOf === right.effectiveAsOf &&
        left.completenessState === right.completenessState
      );
    case 'approved-validation':
      return (
        right.kind === 'approved-validation' &&
        left.validationReferenceId === right.validationReferenceId &&
        left.scope === right.scope &&
        left.validatedAt === right.validatedAt
      );
  }
}

function sameCandidateUnknown(
  left: Extract<MaterialUnknown, { readonly scope: 'candidate' }>,
  right: Extract<MaterialUnknown, { readonly scope: 'candidate' }>,
): boolean {
  return (
    left.unknownId === right.unknownId &&
    left.candidateId === right.candidateId &&
    left.topic === right.topic &&
    left.statement === right.statement &&
    sameEvidenceReferences(left.evidenceReferences, right.evidenceReferences)
  );
}

function sameCandidateLimitation(
  left: CandidateLimitation,
  right: CandidateLimitation,
): boolean {
  return (
    left.limitationId === right.limitationId &&
    left.limitationCode === right.limitationCode &&
    left.candidateId === right.candidateId &&
    left.statement === right.statement &&
    sameEvidenceReferences(left.evidenceReferences, right.evidenceReferences)
  );
}

function addCandidateCatalogOwnerIssue(
  issues: DomainIssue[],
  candidateId: CandidateId,
  suppliedCandidates: ReadonlySet<CandidateId>,
  path: string,
): void {
  addStableIdIssues(issues, candidateId, `${path}.candidateId`);
  if (!suppliedCandidates.has(candidateId)) {
    addIssue(issues, 'reference.unknown-candidate', path);
  }
}

function addUnknownReferenceIssues(
  issues: DomainIssue[],
  references: readonly MaterialUnknownId[],
  unknownsById: ReadonlyMap<MaterialUnknownId, MaterialUnknown>,
  candidateId: CandidateId,
  path: string,
): void {
  addDuplicateIdIssues(issues, references, path);
  for (const reference of references) {
    addStableIdIssues(issues, reference, path);
    const unknown = unknownsById.get(reference);
    if (unknown === undefined) {
      addIssue(issues, 'reference.unknown-unknown', path);
    } else if (
      unknown.scope === 'candidate' &&
      unknown.candidateId !== candidateId
    ) {
      addIssue(issues, 'reference.candidate-ownership', path);
    }
  }
}

function addInferenceReferenceIssues(
  issues: DomainIssue[],
  references: readonly InferenceId[],
  inferencesById: ReadonlyMap<InferenceId, Inference>,
  candidateId: CandidateId,
  path: string,
): void {
  addOwnedReferenceIssues(
    issues,
    references,
    inferencesById,
    candidateId,
    'reference.unknown-inference',
    path,
  );
}

function addClaimReferenceIssues(
  issues: DomainIssue[],
  references: readonly MaterialClaimId[],
  claimsById: ReadonlyMap<MaterialClaimId, MaterialClaim>,
  candidateId: CandidateId,
  path: string,
): void {
  addOwnedReferenceIssues(
    issues,
    references,
    claimsById,
    candidateId,
    'reference.unknown-claim',
    path,
  );
}

function addConflictReferenceIssues(
  issues: DomainIssue[],
  references: readonly HardConstraintConflictId[],
  conflictsById: ReadonlyMap<HardConstraintConflictId, HardConstraintConflict>,
  candidateId: CandidateId,
  path: string,
): void {
  addOwnedReferenceIssues(
    issues,
    references,
    conflictsById,
    candidateId,
    'reference.unknown-conflict',
    path,
  );
}

function addLimitationReferenceIssues(
  issues: DomainIssue[],
  references: readonly LimitationId[],
  limitationsById: ReadonlyMap<LimitationId, CandidateLimitation>,
  candidateId: CandidateId,
  path: string,
): void {
  addOwnedReferenceIssues(
    issues,
    references,
    limitationsById,
    candidateId,
    'reference.unknown-limitation',
    path,
  );
}

function validateOutcome(
  issues: DomainIssue[],
  result: FitAssessmentResult,
): void {
  const viableCount = result.assessments.filter(
    (assessment) =>
      assessment.disposition === 'recommended' ||
      assessment.disposition === 'viable',
  ).length;
  const rejectedCount = result.assessments.filter(
    (assessment) => assessment.disposition === 'rejected',
  ).length;
  const insufficientCount = result.assessments.filter(
    (assessment) => assessment.disposition === 'insufficient-evidence',
  ).length;
  const valid =
    result.outcome === 'recommend'
      ? viableCount > 0
      : result.outcome === 'no-viable-candidate'
        ? rejectedCount === result.assessments.length
        : viableCount === 0 && insufficientCount > 0;
  if (!valid) {
    addIssue(issues, 'outcome.disposition', 'outcome');
  }
}

function validateCandidateReason(
  issues: DomainIssue[],
  assessment: CandidateAssessment,
  assessmentIndex: number,
  reasonIndex: number,
  evidenceById: ReadonlyMap<EvidenceId, EvidenceObservation>,
  inferencesById: ReadonlyMap<InferenceId, Inference>,
  unknownsById: ReadonlyMap<MaterialUnknownId, MaterialUnknown>,
  conflicts: readonly HardConstraintConflict[],
): void {
  const reason = assessment.reasons[reasonIndex];
  if (reason === undefined) {
    return;
  }
  const path = `assessments[${String(assessmentIndex)}].reasons[${String(reasonIndex)}]`;
  addStableIdIssues(issues, reason.candidateId, `${path}.candidateId`);
  addStableIdIssues(issues, reason.reasonCode, `${path}.reasonCode`);
  if (reason.candidateId !== assessment.candidateId) {
    addIssue(issues, 'reference.candidate-ownership', path);
  }
  addEvidenceReferenceIssues(
    issues,
    reason.evidenceReferences,
    evidenceById,
    assessment.candidateId,
    `${path}.evidenceReferences`,
  );
  addInferenceReferenceIssues(
    issues,
    reason.inferenceIds,
    inferencesById,
    assessment.candidateId,
    `${path}.inferenceIds`,
  );
  addUnknownReferenceIssues(
    issues,
    reason.unknownIds,
    unknownsById,
    assessment.candidateId,
    `${path}.unknownIds`,
  );
  const hasCandidateEvidence = reason.evidenceReferences.some(
    (reference) =>
      reference.candidateId === assessment.candidateId &&
      evidenceById.get(reference.evidenceId)?.candidateId ===
        assessment.candidateId,
  );
  const hasCandidateInference = reason.inferenceIds.some(
    (inferenceId) =>
      inferencesById.get(inferenceId)?.candidateId === assessment.candidateId,
  );
  const hasDisclosedUnknown = reason.unknownIds.some((unknownId) => {
    const unknown = unknownsById.get(unknownId);
    return (
      unknown?.scope === 'assessment' ||
      (unknown?.scope === 'candidate' &&
        unknown.candidateId === assessment.candidateId)
    );
  });
  const reasonEvidence = new Set(
    reason.evidenceReferences.map(evidenceReferenceKey),
  );
  const assessmentEvidence = new Set(
    assessment.evidenceReferences.map(evidenceReferenceKey),
  );
  const hasPreservedHardConflict = conflicts.some(
    (conflict) =>
      conflict.candidateId === assessment.candidateId &&
      conflict.reasonCode === reason.reasonCode &&
      conflict.evidenceReferences.length > 0 &&
      conflict.evidenceReferences.every((reference) => {
        const key = evidenceReferenceKey(reference);
        return reasonEvidence.has(key) && assessmentEvidence.has(key);
      }),
  );
  if (
    !hasCandidateEvidence &&
    !hasCandidateInference &&
    !hasDisclosedUnknown &&
    !hasPreservedHardConflict
  ) {
    addIssue(issues, 'reason.traceability', path);
  }
}

function validateCatalogCoverage(
  issues: DomainIssue[],
  assessmentByCandidate: ReadonlyMap<CandidateId, CandidateAssessment>,
  limitations: readonly CandidateLimitation[],
  inferences: readonly Inference[],
  unknowns: readonly MaterialUnknown[],
  claims: readonly MaterialClaim[],
  conflicts: readonly HardConstraintConflict[],
): void {
  for (const limitation of limitations) {
    if (
      !assessmentByCandidate
        .get(limitation.candidateId)
        ?.limitationIds.includes(limitation.limitationId)
    ) {
      addIssue(issues, 'reference.catalog-coverage', 'candidateLimitations');
    }
  }
  for (const inference of inferences) {
    if (
      !assessmentByCandidate
        .get(inference.candidateId)
        ?.inferenceIds.includes(inference.inferenceId)
    ) {
      addIssue(issues, 'reference.catalog-coverage', 'inferences');
    }
  }
  for (const unknown of unknowns) {
    if (
      unknown.scope === 'candidate' &&
      !assessmentByCandidate
        .get(unknown.candidateId)
        ?.unknownIds.includes(unknown.unknownId)
    ) {
      addIssue(issues, 'reference.catalog-coverage', 'unknowns');
    }
  }
  for (const claim of claims) {
    if (
      !assessmentByCandidate
        .get(claim.candidateId)
        ?.claimIds.includes(claim.claimId)
    ) {
      addIssue(issues, 'reference.catalog-coverage', 'claims');
    }
  }
  for (const conflict of conflicts) {
    if (
      !assessmentByCandidate
        .get(conflict.candidateId)
        ?.hardConflictIds.includes(conflict.hardConstraintConflictId)
    ) {
      addIssue(issues, 'reference.catalog-coverage', 'hardConstraintConflicts');
    }
  }
}

function validatePositiveDispositionSupport(
  issues: DomainIssue[],
  assessmentByCandidate: ReadonlyMap<CandidateId, CandidateAssessment>,
  claimsById: ReadonlyMap<MaterialClaimId, MaterialClaim>,
): void {
  for (const assessment of assessmentByCandidate.values()) {
    if (
      assessment.disposition !== 'recommended' &&
      assessment.disposition !== 'viable'
    ) {
      continue;
    }
    const hasFavorableAttributableClaim = assessment.claimIds.some(
      (claimId) => {
        const claim = claimsById.get(claimId);
        return (
          claim?.candidateId === assessment.candidateId &&
          claim.direction === 'favorable' &&
          (claim.evidenceReferences.length > 0 || claim.inferenceIds.length > 0)
        );
      },
    );
    if (!hasFavorableAttributableClaim) {
      addIssue(issues, 'disposition.support', 'assessments');
    }
  }
}

function validateHardConflictPreservation(
  issues: DomainIssue[],
  result: FitAssessmentResult,
  assessmentByCandidate: ReadonlyMap<CandidateId, CandidateAssessment>,
): void {
  const rankedCandidates = new Set<CandidateId>();
  for (const group of result.rankGroups) {
    for (const candidateId of group.candidateIds) {
      rankedCandidates.add(candidateId);
    }
  }
  for (const relation of result.rankRelations) {
    rankedCandidates.add(relation.higherCandidateId);
    rankedCandidates.add(relation.lowerCandidateId);
  }
  for (const pair of result.incomparablePairs) {
    rankedCandidates.add(pair.leftCandidateId);
    rankedCandidates.add(pair.rightCandidateId);
  }

  for (const conflict of result.hardConstraintConflicts) {
    const assessment = assessmentByCandidate.get(conflict.candidateId);
    if (assessment === undefined) {
      continue;
    }
    if (assessment.disposition !== 'rejected') {
      addIssue(issues, 'constraint.disposition', 'hardConstraintConflicts');
    }
    if (rankedCandidates.has(conflict.candidateId)) {
      addIssue(issues, 'constraint.ranking', 'rankGroups');
    }
    const conflictReferences = new Set(
      conflict.evidenceReferences.map(evidenceReferenceKey),
    );
    const assessmentReferences = new Set(
      assessment.evidenceReferences.map(evidenceReferenceKey),
    );
    const matchingReason = assessment.reasons.find(
      (reason) =>
        reason.candidateId === conflict.candidateId &&
        reason.reasonCode === conflict.reasonCode,
    );
    const reasonReferences = new Set(
      matchingReason?.evidenceReferences.map(evidenceReferenceKey) ?? [],
    );
    if (
      conflict.evidenceReferences.length === 0 ||
      matchingReason === undefined ||
      [...conflictReferences].some(
        (reference) =>
          !assessmentReferences.has(reference) ||
          !reasonReferences.has(reference),
      )
    ) {
      addIssue(issues, 'constraint.preservation', 'hardConstraintConflicts');
    }
  }
}

export function validateFitAssessmentResult(
  input: FitAssessmentResult,
): DomainResult<FitAssessmentResult> {
  const result = canonicalizeFitAssessmentResult(input);
  const issues: DomainIssue[] = [];
  addStableIdIssues(issues, result.assessmentId, 'assessmentId');
  addStableIdIssues(issues, result.assessmentRequestId, 'assessmentRequestId');
  const evidenceCutoff = timestampAt(
    issues,
    result.evidenceCutoff,
    'evidenceCutoff',
  );
  const producedAt = timestampAt(issues, result.producedAt, 'producedAt');
  if (
    evidenceCutoff !== null &&
    producedAt !== null &&
    producedAt < evidenceCutoff
  ) {
    addIssue(issues, 'result.temporal-order', 'producedAt');
  }

  addDuplicateIdIssues(
    issues,
    result.suppliedCandidateIds,
    'suppliedCandidateIds',
  );
  for (const candidateId of result.suppliedCandidateIds) {
    addStableIdIssues(issues, candidateId, 'suppliedCandidateIds');
  }
  const suppliedCandidates = new Set(result.suppliedCandidateIds);
  if (
    result.suppliedCandidateIds.length < 1 ||
    result.suppliedCandidateIds.length > 20
  ) {
    addIssue(issues, 'reference.candidate-set', 'suppliedCandidateIds');
  }

  addDuplicateIdIssues(
    issues,
    result.evidence.map((observation) => observation.evidenceId),
    'evidence',
  );
  const evidenceById = new Map<EvidenceId, EvidenceObservation>();
  for (const [index, observation] of result.evidence.entries()) {
    const path = `evidence[${String(index)}]`;
    addStableIdIssues(issues, observation.evidenceId, `${path}.evidenceId`);
    addCandidateCatalogOwnerIssue(
      issues,
      observation.candidateId,
      suppliedCandidates,
      path,
    );
    addStableIdIssues(issues, observation.topic, `${path}.topic`);
    addEvidenceProvenanceIssues(
      issues,
      observation.provenance,
      observation.freshness,
      result.evidenceCutoff,
      path,
    );
    evidenceById.set(observation.evidenceId, observation);
  }
  const evidenceIdentifierValues = new Set<string>(evidenceById.keys());

  addDuplicateIdIssues(
    issues,
    result.inferences.map((inference) => inference.inferenceId),
    'inferences',
  );
  const inferencesById = new Map<InferenceId, Inference>();
  for (const [index, inference] of result.inferences.entries()) {
    const path = `inferences[${String(index)}]`;
    addStableIdIssues(issues, inference.inferenceId, `${path}.inferenceId`);
    addCandidateCatalogOwnerIssue(
      issues,
      inference.candidateId,
      suppliedCandidates,
      path,
    );
    addStableIdIssues(issues, inference.topic, `${path}.topic`);
    if (inference.evidenceReferences.length === 0) {
      addIssue(issues, 'evidence.inference-empty', 'inferences');
    }
    if (evidenceIdentifierValues.has(inference.inferenceId)) {
      addIssue(issues, 'evidence.kind-conflict', 'inferences');
    }
    addEvidenceReferenceIssues(
      issues,
      inference.evidenceReferences,
      evidenceById,
      inference.candidateId,
      `${path}.evidenceReferences`,
    );
    inferencesById.set(inference.inferenceId, inference);
  }

  addDuplicateIdIssues(
    issues,
    result.candidateLimitations.map((limitation) => limitation.limitationId),
    'candidateLimitations',
  );
  const limitationsById = new Map<LimitationId, CandidateLimitation>();
  const limitationAssertions = new Map<string, string>();
  const limitationContent = new Set<string>();
  for (const [index, limitation] of result.candidateLimitations.entries()) {
    const path = `candidateLimitations[${String(index)}]`;
    addStableIdIssues(issues, limitation.limitationId, `${path}.limitationId`);
    addStableIdIssues(
      issues,
      limitation.limitationCode,
      `${path}.limitationCode`,
    );
    addCandidateCatalogOwnerIssue(
      issues,
      limitation.candidateId,
      suppliedCandidates,
      path,
    );
    addEvidenceReferenceIssues(
      issues,
      limitation.evidenceReferences,
      evidenceById,
      limitation.candidateId,
      `${path}.evidenceReferences`,
    );
    const semanticKey = `${limitation.candidateId}\u0000${limitation.limitationCode}`;
    const assertion = `${limitation.statement}\u0000${limitation.evidenceReferences
      .map(evidenceReferenceKey)
      .join('\u0001')}`;
    const previous = limitationAssertions.get(semanticKey);
    const duplicateByCode = previous === assertion;
    if (previous !== undefined) {
      addIssue(
        issues,
        duplicateByCode ? 'limitation.duplicate' : 'limitation.contradictory',
        'candidateLimitations',
      );
    } else {
      limitationAssertions.set(semanticKey, assertion);
    }
    const contentKey = `${limitation.candidateId}\u0000${limitation.statement}`;
    if (limitationContent.has(contentKey)) {
      if (!duplicateByCode) {
        addIssue(issues, 'limitation.duplicate', 'candidateLimitations');
      }
    } else {
      limitationContent.add(contentKey);
    }
    limitationsById.set(limitation.limitationId, limitation);
  }

  addDuplicateIdIssues(
    issues,
    result.unknowns.map((unknown) => unknown.unknownId),
    'unknowns',
  );
  const unknownsById = new Map<MaterialUnknownId, MaterialUnknown>();
  for (const [index, unknown] of result.unknowns.entries()) {
    const path = `unknowns[${String(index)}]`;
    addStableIdIssues(issues, unknown.unknownId, `${path}.unknownId`);
    addStableIdIssues(issues, unknown.topic, `${path}.topic`);
    if (unknown.scope === 'candidate') {
      addCandidateCatalogOwnerIssue(
        issues,
        unknown.candidateId,
        suppliedCandidates,
        path,
      );
    }
    addEvidenceReferenceIssues(
      issues,
      unknown.evidenceReferences,
      evidenceById,
      unknown.scope === 'candidate' ? unknown.candidateId : undefined,
      `${path}.evidenceReferences`,
    );
    unknownsById.set(unknown.unknownId, unknown);
  }

  addDuplicateIdIssues(
    issues,
    result.claims.map((claim) => claim.claimId),
    'claims',
  );
  const claimsById = new Map<MaterialClaimId, MaterialClaim>();
  for (const [index, claim] of result.claims.entries()) {
    const path = `claims[${String(index)}]`;
    addStableIdIssues(issues, claim.claimId, `${path}.claimId`);
    addCandidateCatalogOwnerIssue(
      issues,
      claim.candidateId,
      suppliedCandidates,
      path,
    );
    addStableIdIssues(issues, claim.topic, `${path}.topic`);
    if (
      claim.evidenceReferences.length === 0 &&
      claim.inferenceIds.length === 0
    ) {
      addIssue(issues, 'claim.traceability', 'claims');
    }
    addEvidenceReferenceIssues(
      issues,
      claim.evidenceReferences,
      evidenceById,
      claim.candidateId,
      `${path}.evidenceReferences`,
    );
    addInferenceReferenceIssues(
      issues,
      claim.inferenceIds,
      inferencesById,
      claim.candidateId,
      `${path}.inferenceIds`,
    );
    if (
      claim.direction === 'favorable' &&
      result.unknowns.some(
        (unknown) =>
          unknown.topic === claim.topic &&
          (unknown.scope === 'assessment' ||
            unknown.candidateId === claim.candidateId),
      )
    ) {
      addIssue(issues, 'claim.unresolved-unknown', 'claims');
    }
    claimsById.set(claim.claimId, claim);
  }

  addDuplicateIdIssues(
    issues,
    result.hardConstraintConflicts.map(
      (conflict) => conflict.hardConstraintConflictId,
    ),
    'hardConstraintConflicts',
  );
  const conflictsById = new Map<
    HardConstraintConflictId,
    HardConstraintConflict
  >();
  for (const [index, conflict] of result.hardConstraintConflicts.entries()) {
    const path = `hardConstraintConflicts[${String(index)}]`;
    addStableIdIssues(
      issues,
      conflict.hardConstraintConflictId,
      `${path}.hardConstraintConflictId`,
    );
    addCandidateCatalogOwnerIssue(
      issues,
      conflict.candidateId,
      suppliedCandidates,
      path,
    );
    addStableIdIssues(
      issues,
      conflict.hardConstraintId,
      `${path}.hardConstraintId`,
    );
    addStableIdIssues(issues, conflict.reasonCode, `${path}.reasonCode`);
    addEvidenceReferenceIssues(
      issues,
      conflict.evidenceReferences,
      evidenceById,
      conflict.candidateId,
      `${path}.evidenceReferences`,
    );
    conflictsById.set(conflict.hardConstraintConflictId, conflict);
  }

  addDuplicateIdIssues(
    issues,
    result.assessments.map((assessment) => assessment.candidateId),
    'assessments',
  );
  const assessmentByCandidate = new Map<CandidateId, CandidateAssessment>();
  for (const [index, assessment] of result.assessments.entries()) {
    const path = `assessments[${String(index)}]`;
    addCandidateCatalogOwnerIssue(
      issues,
      assessment.candidateId,
      suppliedCandidates,
      path,
    );
    addDuplicateIdIssues(
      issues,
      assessment.reasons.map((reason) => reason.reasonCode),
      `${path}.reasons`,
    );
    for (
      let reasonIndex = 0;
      reasonIndex < assessment.reasons.length;
      reasonIndex += 1
    ) {
      validateCandidateReason(
        issues,
        assessment,
        index,
        reasonIndex,
        evidenceById,
        inferencesById,
        unknownsById,
        result.hardConstraintConflicts,
      );
    }
    addEvidenceReferenceIssues(
      issues,
      assessment.evidenceReferences,
      evidenceById,
      assessment.candidateId,
      `${path}.evidenceReferences`,
    );
    addInferenceReferenceIssues(
      issues,
      assessment.inferenceIds,
      inferencesById,
      assessment.candidateId,
      `${path}.inferenceIds`,
    );
    addUnknownReferenceIssues(
      issues,
      assessment.unknownIds,
      unknownsById,
      assessment.candidateId,
      `${path}.unknownIds`,
    );
    if (
      assessment.disposition === 'insufficient-evidence' &&
      !assessment.unknownIds.some((unknownId) => {
        const unknown = unknownsById.get(unknownId);
        return (
          unknown?.scope === 'assessment' ||
          (unknown?.scope === 'candidate' &&
            unknown.candidateId === assessment.candidateId)
        );
      })
    ) {
      addIssue(issues, 'disposition.uncertainty', path);
    }
    addClaimReferenceIssues(
      issues,
      assessment.claimIds,
      claimsById,
      assessment.candidateId,
      `${path}.claimIds`,
    );
    addConflictReferenceIssues(
      issues,
      assessment.hardConflictIds,
      conflictsById,
      assessment.candidateId,
      `${path}.hardConflictIds`,
    );
    addLimitationReferenceIssues(
      issues,
      assessment.limitationIds,
      limitationsById,
      assessment.candidateId,
      `${path}.limitationIds`,
    );
    if (!assessmentByCandidate.has(assessment.candidateId)) {
      assessmentByCandidate.set(assessment.candidateId, assessment);
    }
  }
  if (
    !sameUniqueSet(
      result.suppliedCandidateIds,
      result.assessments.map((assessment) => assessment.candidateId),
    )
  ) {
    addIssue(issues, 'reference.candidate-set', 'assessments');
  }

  if (assessmentByCandidate.size === result.assessments.length) {
    validateCatalogCoverage(
      issues,
      assessmentByCandidate,
      result.candidateLimitations,
      result.inferences,
      result.unknowns,
      result.claims,
      result.hardConstraintConflicts,
    );
    validatePositiveDispositionSupport(
      issues,
      assessmentByCandidate,
      claimsById,
    );
    validateHardConflictPreservation(issues, result, assessmentByCandidate);
  }
  validateOutcome(issues, result);
  addDuplicateIdIssues(
    issues,
    result.assessmentProcessing.incompleteReasonCodes,
    'assessmentProcessing.incompleteReasonCodes',
  );
  for (const [
    index,
    code,
  ] of result.assessmentProcessing.incompleteReasonCodes.entries()) {
    addStableIdIssues(
      issues,
      code,
      `assessmentProcessing.incompleteReasonCodes[${String(index)}]`,
    );
  }
  if (
    (result.assessmentProcessing.state === 'complete' &&
      result.assessmentProcessing.incompleteReasonCodes.length !== 0) ||
    (result.assessmentProcessing.state === 'partial-evidence' &&
      (result.assessmentProcessing.incompleteReasonCodes.length < 1 ||
        result.assessmentProcessing.incompleteReasonCodes.length > 20))
  ) {
    addIssue(issues, 'result.processing-state', 'assessmentProcessing');
  }
  addRankingIssues(issues, result);
  return resultFromIssues(result, issues);
}

export function validateFitAssessmentExchange(
  inputRequest: FitAssessmentRequest,
  inputResult: FitAssessmentResult,
): DomainResult<FitAssessmentExchange> {
  const request = canonicalizeFitAssessmentRequest(inputRequest);
  const result = canonicalizeFitAssessmentResult(inputResult);
  const issues: DomainIssue[] = [];
  const requestValidation = validateFitAssessmentRequest(request);
  if (!requestValidation.ok) {
    prefixIssues(issues, 'request', requestValidation.issues);
  }
  const resultValidation = validateFitAssessmentResult(result);
  if (!resultValidation.ok) {
    prefixIssues(issues, 'result', resultValidation.issues);
  }

  const requestedCandidateIds = request.candidateDossiers.map(
    (dossier) => dossier.identity.candidateId,
  );
  if (!sameUniqueSet(requestedCandidateIds, result.suppliedCandidateIds)) {
    addIssue(issues, 'exchange.candidate-set', 'result.suppliedCandidateIds');
  }
  if (
    result.assessmentRequestId !== request.assessmentRequestId ||
    result.correlationId !== request.correlationId
  ) {
    addIssue(issues, 'exchange.request-link', 'result.assessmentRequestId');
  }
  if (result.evidenceCutoff !== request.evidenceCutoff) {
    addIssue(issues, 'exchange.evidence-cutoff', 'result.evidenceCutoff');
  }

  const suppliedEvidence = new Map<EvidenceId, EvidenceObservation>();
  const suppliedLimitations = new Map<LimitationId, CandidateLimitation>();
  const suppliedUnknowns = new Map<
    MaterialUnknownId,
    Extract<MaterialUnknown, { readonly scope: 'candidate' }>
  >();
  for (const dossier of request.candidateDossiers) {
    for (const observation of dossier.evidence) {
      suppliedEvidence.set(observation.evidenceId, observation);
    }
    for (const limitation of dossier.limitations) {
      suppliedLimitations.set(limitation.limitationId, limitation);
    }
    for (const unknown of dossier.unknowns) {
      suppliedUnknowns.set(unknown.unknownId, unknown);
    }
  }
  for (const observation of result.evidence) {
    const supplied = suppliedEvidence.get(observation.evidenceId);
    if (supplied === undefined) {
      addIssue(issues, 'exchange.evidence-reference', 'result.evidence');
    } else if (supplied.candidateId !== observation.candidateId) {
      addIssue(issues, 'exchange.evidence-ownership', 'result.evidence');
    } else if (!sameEvidenceObservation(supplied, observation)) {
      addIssue(issues, 'exchange.evidence-preservation', 'result.evidence');
    }
  }
  const resultEvidence = new Map(
    result.evidence.map((observation) => [observation.evidenceId, observation]),
  );
  for (const supplied of suppliedEvidence.values()) {
    const retained = resultEvidence.get(supplied.evidenceId);
    if (retained === undefined) {
      addIssue(issues, 'exchange.evidence-preservation', 'result.evidence');
    }
  }
  for (const limitation of result.candidateLimitations) {
    const supplied = suppliedLimitations.get(limitation.limitationId);
    if (supplied === undefined) {
      addIssue(
        issues,
        'exchange.limitation-reference',
        'result.candidateLimitations',
      );
    } else if (supplied.candidateId !== limitation.candidateId) {
      addIssue(
        issues,
        'exchange.limitation-ownership',
        'result.candidateLimitations',
      );
    } else if (!sameCandidateLimitation(supplied, limitation)) {
      addIssue(
        issues,
        'exchange.limitation-preservation',
        'result.candidateLimitations',
      );
    }
  }
  const resultLimitations = new Map(
    result.candidateLimitations.map((limitation) => [
      limitation.limitationId,
      limitation,
    ]),
  );
  for (const supplied of suppliedLimitations.values()) {
    const retained = resultLimitations.get(supplied.limitationId);
    if (
      retained === undefined ||
      !sameCandidateLimitation(supplied, retained)
    ) {
      addIssue(
        issues,
        'exchange.limitation-preservation',
        'result.candidateLimitations',
      );
    }
  }
  const resultUnknowns = new Map(
    result.unknowns.map((unknown) => [unknown.unknownId, unknown]),
  );
  for (const supplied of suppliedUnknowns.values()) {
    const retained = resultUnknowns.get(supplied.unknownId);
    if (retained?.scope !== 'candidate') {
      addIssue(issues, 'exchange.unknown-preservation', 'result.unknowns');
    } else if (!sameCandidateUnknown(supplied, retained)) {
      addIssue(issues, 'exchange.unknown-preservation', 'result.unknowns');
    }
  }

  const rankedCandidates = new Set<CandidateId>();
  for (const group of result.rankGroups) {
    group.candidateIds.forEach((candidateId) =>
      rankedCandidates.add(candidateId),
    );
  }
  for (const relation of result.rankRelations) {
    rankedCandidates.add(relation.higherCandidateId);
    rankedCandidates.add(relation.lowerCandidateId);
  }
  for (const pair of result.incomparablePairs) {
    rankedCandidates.add(pair.leftCandidateId);
    rankedCandidates.add(pair.rightCandidateId);
  }
  if (rankedCandidates.size > request.requestedMaximumResults) {
    addIssue(issues, 'exchange.maximum-results', 'result.rankGroups');
  }

  const constraintsById = new Map(
    request.capabilityRequest.hardConstraints.map((constraint) => [
      constraint.hardConstraintId,
      constraint,
    ]),
  );
  for (const conflict of result.hardConstraintConflicts) {
    const constraint = constraintsById.get(conflict.hardConstraintId);
    if (constraint?.reasonCode !== conflict.reasonCode) {
      addIssue(
        issues,
        'exchange.constraint-reference',
        'result.hardConstraintConflicts',
      );
    }
  }
  return resultFromIssues({ request, result }, issues);
}
