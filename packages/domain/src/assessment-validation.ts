import {
  canonicalizeFitAssessmentRequest,
  canonicalizeFitAssessmentResult,
} from './canonicalize.ts';
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
    left.provenance.sourceType === right.provenance.sourceType &&
    left.provenance.sourceUrl === right.provenance.sourceUrl &&
    left.provenance.revision.kind === right.provenance.revision.kind &&
    left.provenance.revision.value === right.provenance.revision.value &&
    left.provenance.revision.immutableUrl ===
      right.provenance.revision.immutableUrl &&
    left.provenance.collectedAt === right.provenance.collectedAt &&
    left.provenance.publishedAt === right.provenance.publishedAt &&
    left.freshness.status === right.freshness.status &&
    left.freshness.asOf === right.freshness.asOf &&
    left.freshness.scope === right.freshness.scope &&
    left.limitation === right.limitation
  );
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
}

function validateCatalogCoverage(
  issues: DomainIssue[],
  assessmentByCandidate: ReadonlyMap<CandidateId, CandidateAssessment>,
  inferences: readonly Inference[],
  unknowns: readonly MaterialUnknown[],
  claims: readonly MaterialClaim[],
  conflicts: readonly HardConstraintConflict[],
): void {
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
    const collectedAt = timestampAt(
      issues,
      observation.provenance.collectedAt,
      `${path}.provenance.collectedAt`,
    );
    const publishedAt =
      observation.provenance.publishedAt === null
        ? null
        : timestampAt(
            issues,
            observation.provenance.publishedAt,
            `${path}.provenance.publishedAt`,
          );
    const freshnessAsOf = timestampAt(
      issues,
      observation.freshness.asOf,
      `${path}.freshness.asOf`,
    );
    if (
      (collectedAt !== null &&
        publishedAt !== null &&
        publishedAt > collectedAt) ||
      (evidenceCutoff !== null &&
        ((collectedAt !== null && collectedAt > evidenceCutoff) ||
          (freshnessAsOf !== null && freshnessAsOf > evidenceCutoff)))
    ) {
      addIssue(issues, 'evidence.temporal-order', path);
    }
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
  if (
    result.completeness === 'complete' &&
    (result.unknowns.length > 0 ||
      result.outcome === 'insufficient-evidence' ||
      result.assessments.some(
        (assessment) => assessment.disposition === 'insufficient-evidence',
      ))
  ) {
    addIssue(issues, 'result.completeness', 'completeness');
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
  const suppliedUnknowns = new Map<
    MaterialUnknownId,
    Extract<MaterialUnknown, { readonly scope: 'candidate' }>
  >();
  for (const dossier of request.candidateDossiers) {
    for (const observation of dossier.evidence) {
      suppliedEvidence.set(observation.evidenceId, observation);
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
