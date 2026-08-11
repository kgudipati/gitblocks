import type {
  CandidateAssessment,
  CandidateDossier,
  CandidateLimitation,
  CandidateMaterialUnknown,
  CapabilityRequest,
  EvidenceObservation,
  EvidenceProvenance,
  EvidenceReference,
  ExplicitRankRelation,
  FitAssessmentRequest,
  FitAssessmentResult,
  HardConstraintConflict,
  IncomparablePair,
  Inference,
  MaterialClaim,
  MaterialUnknown,
  RepositoryFact,
  RepositoryFingerprint,
} from './model.ts';
import { compareText } from './issues.ts';

function sortBy<Value>(
  values: readonly Value[],
  key: (value: Value) => string,
): Value[] {
  return [...values].sort((left, right) => {
    const keyOrder = compareText(key(left), key(right));
    return keyOrder === 0
      ? compareText(JSON.stringify(left), JSON.stringify(right))
      : keyOrder;
  });
}

function canonicalizeEvidenceReference(
  reference: EvidenceReference,
): EvidenceReference {
  return {
    kind: 'evidence-reference',
    evidenceId: reference.evidenceId,
    candidateId: reference.candidateId,
  };
}

function canonicalizeEvidenceReferences(
  references: readonly EvidenceReference[],
): readonly EvidenceReference[] {
  return sortBy(
    references.map(canonicalizeEvidenceReference),
    (reference) => `${reference.candidateId}\u0000${reference.evidenceId}`,
  );
}

function canonicalizeEvidenceObservation(
  observation: EvidenceObservation,
): EvidenceObservation {
  return {
    kind: 'evidence-observation',
    evidenceId: observation.evidenceId,
    candidateId: observation.candidateId,
    topic: observation.topic,
    dimension: observation.dimension,
    observation: observation.observation,
    provenance: canonicalizeEvidenceProvenance(observation.provenance),
    directness: observation.directness,
    freshness: { ...observation.freshness },
    limitation: observation.limitation,
  };
}

function canonicalizeEvidenceProvenance(
  provenance: EvidenceProvenance,
): EvidenceProvenance {
  switch (provenance.kind) {
    case 'git-commit':
    case 'tag':
    case 'release':
    case 'package-version':
    case 'security-advisory':
    case 'mutable-documentation':
    case 'structured-provider-snapshot':
    case 'approved-validation':
      return { ...provenance };
  }
}

function canonicalizeInference(inference: Inference): Inference {
  return {
    kind: 'inference',
    inferenceId: inference.inferenceId,
    candidateId: inference.candidateId,
    topic: inference.topic,
    statement: inference.statement,
    rationale: inference.rationale,
    evidenceReferences: canonicalizeEvidenceReferences(
      inference.evidenceReferences,
    ),
  };
}

function canonicalizeUnknown(unknown: MaterialUnknown): MaterialUnknown {
  const common = {
    kind: 'material-unknown' as const,
    unknownId: unknown.unknownId,
    topic: unknown.topic,
    statement: unknown.statement,
    evidenceReferences: canonicalizeEvidenceReferences(
      unknown.evidenceReferences,
    ),
  };
  return unknown.scope === 'candidate'
    ? {
        ...common,
        scope: 'candidate',
        candidateId: unknown.candidateId,
      }
    : { ...common, scope: 'assessment' };
}

function canonicalizeCandidateUnknown(
  unknown: CandidateMaterialUnknown,
): CandidateMaterialUnknown {
  return {
    kind: 'material-unknown',
    scope: 'candidate',
    unknownId: unknown.unknownId,
    candidateId: unknown.candidateId,
    topic: unknown.topic,
    statement: unknown.statement,
    evidenceReferences: canonicalizeEvidenceReferences(
      unknown.evidenceReferences,
    ),
  };
}

function canonicalizeClaim(claim: MaterialClaim): MaterialClaim {
  return {
    kind: 'material-claim',
    claimId: claim.claimId,
    candidateId: claim.candidateId,
    topic: claim.topic,
    direction: claim.direction,
    statement: claim.statement,
    evidenceReferences: canonicalizeEvidenceReferences(
      claim.evidenceReferences,
    ),
    inferenceIds: [...claim.inferenceIds].sort(compareText),
  };
}

function canonicalizeLimitation(
  limitation: CandidateLimitation,
): CandidateLimitation {
  return {
    limitationId: limitation.limitationId,
    limitationCode: limitation.limitationCode,
    candidateId: limitation.candidateId,
    statement: limitation.statement,
    evidenceReferences: canonicalizeEvidenceReferences(
      limitation.evidenceReferences,
    ),
  };
}

function canonicalizeRepositoryFact(fact: RepositoryFact): RepositoryFact {
  const provenance = {
    kind: 'repository-local' as const,
    source: fact.provenance.source,
    epistemicStatus: fact.provenance.epistemicStatus,
    confidence: fact.provenance.confidence,
    collectedAt: fact.provenance.collectedAt,
  };
  switch (fact.kind) {
    case 'coded':
      return {
        kind: 'coded',
        repositoryFactId: fact.repositoryFactId,
        category: fact.category,
        code: fact.code,
        subjectCode: fact.subjectCode,
        value:
          fact.value.kind === 'code-set'
            ? {
                kind: 'code-set',
                codes: [...fact.value.codes].sort(compareText),
              }
            : { ...fact.value },
        provenance,
      };
    case 'deployment':
      return {
        kind: 'deployment',
        repositoryFactId: fact.repositoryFactId,
        topology: fact.topology,
        workerCapability: fact.workerCapability,
        replicas: fact.replicas,
        region: fact.region,
        provenance,
      };
    case 'named-version':
      return {
        kind: 'named-version',
        repositoryFactId: fact.repositoryFactId,
        category: fact.category,
        name: fact.name,
        version: fact.version,
        provenance,
      };
  }
}

export function canonicalizeCapabilityRequest(
  request: CapabilityRequest,
): CapabilityRequest {
  return {
    requestId: request.requestId,
    capabilityFamily: request.capabilityFamily,
    summary: request.summary,
    successConditions: sortBy(
      request.successConditions.map((condition) => ({ ...condition })),
      (condition) => condition.successConditionId,
    ),
    hardConstraints: sortBy(
      request.hardConstraints.map((constraint) => ({ ...constraint })),
      (constraint) => constraint.hardConstraintId,
    ),
    preferences: sortBy(
      request.preferences.map((preference) => ({ ...preference })),
      (preference) => preference.preferenceId,
    ),
    transmissionApproval: {
      approvalId: request.transmissionApproval.approvalId,
      status: request.transmissionApproval.status,
      approvedBy: request.transmissionApproval.approvedBy,
      scope: request.transmissionApproval.scope,
      approvedAt: request.transmissionApproval.approvedAt,
      approvedFactCategories: [
        ...request.transmissionApproval.approvedFactCategories,
      ].sort(compareText),
    },
  };
}

export function canonicalizeRepositoryFingerprint(
  fingerprint: RepositoryFingerprint,
): RepositoryFingerprint {
  return {
    fingerprintId: fingerprint.fingerprintId,
    factVocabularyVersion: fingerprint.factVocabularyVersion,
    facts: sortBy(
      fingerprint.facts.map(canonicalizeRepositoryFact),
      (fact) => fact.repositoryFactId,
    ),
    omittedCategories: [...fingerprint.omittedCategories].sort(compareText),
  };
}

export function canonicalizeCandidateDossier(
  dossier: CandidateDossier,
): CandidateDossier {
  return {
    identity: { ...dossier.identity },
    capabilityFamily: dossier.capabilityFamily,
    versionScope: dossier.versionScope,
    evidence: sortBy(
      dossier.evidence.map(canonicalizeEvidenceObservation),
      (observation) => observation.evidenceId,
    ),
    limitations: sortBy(
      dossier.limitations.map(canonicalizeLimitation),
      (limitation) => limitation.limitationId,
    ),
    unknowns: sortBy(
      dossier.unknowns.map(canonicalizeCandidateUnknown),
      (unknown) => unknown.unknownId,
    ),
  };
}

function canonicalizeAssessment(
  assessment: CandidateAssessment,
): CandidateAssessment {
  return {
    candidateId: assessment.candidateId,
    disposition: assessment.disposition,
    reasons: sortBy(
      assessment.reasons.map((reason) => ({
        ...reason,
        evidenceReferences: canonicalizeEvidenceReferences(
          reason.evidenceReferences,
        ),
        inferenceIds: [...reason.inferenceIds].sort(compareText),
        unknownIds: [...reason.unknownIds].sort(compareText),
      })),
      (reason) => `${reason.candidateId}\u0000${reason.reasonCode}`,
    ),
    evidenceReferences: canonicalizeEvidenceReferences(
      assessment.evidenceReferences,
    ),
    inferenceIds: [...assessment.inferenceIds].sort(compareText),
    unknownIds: [...assessment.unknownIds].sort(compareText),
    claimIds: [...assessment.claimIds].sort(compareText),
    hardConflictIds: [...assessment.hardConflictIds].sort(compareText),
    limitationIds: [...assessment.limitationIds].sort(compareText),
  };
}

function canonicalizeConflict(
  conflict: HardConstraintConflict,
): HardConstraintConflict {
  return {
    hardConstraintConflictId: conflict.hardConstraintConflictId,
    candidateId: conflict.candidateId,
    hardConstraintId: conflict.hardConstraintId,
    reasonCode: conflict.reasonCode,
    evidenceReferences: canonicalizeEvidenceReferences(
      conflict.evidenceReferences,
    ),
  };
}

function canonicalizeRankRelation(
  relation: ExplicitRankRelation,
): ExplicitRankRelation {
  return {
    higherCandidateId: relation.higherCandidateId,
    lowerCandidateId: relation.lowerCandidateId,
  };
}

function canonicalizeIncomparablePair(
  pair: IncomparablePair,
): IncomparablePair {
  return compareText(pair.leftCandidateId, pair.rightCandidateId) <= 0
    ? {
        leftCandidateId: pair.leftCandidateId,
        rightCandidateId: pair.rightCandidateId,
      }
    : {
        leftCandidateId: pair.rightCandidateId,
        rightCandidateId: pair.leftCandidateId,
      };
}

export function canonicalizeFitAssessmentRequest(
  request: FitAssessmentRequest,
): FitAssessmentRequest {
  return {
    assessmentRequestId: request.assessmentRequestId,
    capabilityRequest: canonicalizeCapabilityRequest(request.capabilityRequest),
    repositoryFingerprint: canonicalizeRepositoryFingerprint(
      request.repositoryFingerprint,
    ),
    candidateDossiers: sortBy(
      request.candidateDossiers.map(canonicalizeCandidateDossier),
      (dossier) => dossier.identity.candidateId,
    ),
    evidenceCutoff: request.evidenceCutoff,
    requestedMaximumResults: request.requestedMaximumResults,
    correlationId: request.correlationId,
  };
}

export function canonicalizeFitAssessmentResult(
  result: FitAssessmentResult,
): FitAssessmentResult {
  return {
    assessmentId: result.assessmentId,
    assessmentRequestId: result.assessmentRequestId,
    correlationId: result.correlationId,
    outcome: result.outcome,
    suppliedCandidateIds: [...result.suppliedCandidateIds].sort(compareText),
    assessments: sortBy(
      result.assessments.map(canonicalizeAssessment),
      (assessment) => assessment.candidateId,
    ),
    evidence: sortBy(
      result.evidence.map(canonicalizeEvidenceObservation),
      (observation) => observation.evidenceId,
    ),
    inferences: sortBy(
      result.inferences.map(canonicalizeInference),
      (inference) => inference.inferenceId,
    ),
    candidateLimitations: sortBy(
      result.candidateLimitations.map(canonicalizeLimitation),
      (limitation) => limitation.limitationId,
    ),
    unknowns: sortBy(
      result.unknowns.map(canonicalizeUnknown),
      (unknown) => unknown.unknownId,
    ),
    claims: sortBy(
      result.claims.map(canonicalizeClaim),
      (claim) => claim.claimId,
    ),
    hardConstraintConflicts: sortBy(
      result.hardConstraintConflicts.map(canonicalizeConflict),
      (conflict) => conflict.hardConstraintConflictId,
    ),
    rankGroups: result.rankGroups.map((group) => ({
      candidateIds: [...group.candidateIds].sort(compareText),
    })),
    rankRelations: sortBy(
      result.rankRelations.map(canonicalizeRankRelation),
      (relation) =>
        `${relation.higherCandidateId}\u0000${relation.lowerCandidateId}`,
    ),
    incomparablePairs: sortBy(
      result.incomparablePairs.map(canonicalizeIncomparablePair),
      (pair) => `${pair.leftCandidateId}\u0000${pair.rightCandidateId}`,
    ),
    evidenceCutoff: result.evidenceCutoff,
    producedAt: result.producedAt,
    assessmentProcessing: {
      state: result.assessmentProcessing.state,
      incompleteReasonCodes: [
        ...result.assessmentProcessing.incompleteReasonCodes,
      ].sort(compareText),
    },
  };
}
