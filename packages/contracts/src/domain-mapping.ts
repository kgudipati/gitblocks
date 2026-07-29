import {
  createStableId,
  type AssessmentId,
  type AssessmentRequestId,
  type CandidateAssessment,
  type CandidateDossier,
  type CandidateId,
  type CandidateLimitation,
  type CandidateMaterialUnknown,
  type CapabilityRequest,
  type EvidenceId,
  type EvidenceObservation,
  type EvidenceReference,
  type FingerprintId,
  type FitAssessmentRequest,
  type FitAssessmentResult,
  type HardConstraintConflict,
  type HardConstraintConflictId,
  type HardConstraintId,
  type Inference,
  type InferenceId,
  type LimitationId,
  type MaterialClaim,
  type MaterialClaimId,
  type MaterialUnknown,
  type MaterialUnknownId,
  type PreferenceId,
  type ReasonCode,
  type RepositoryFact,
  type RepositoryFactId,
  type RepositoryFingerprint,
  type RequestId,
  type StableId,
  type StableIdKind,
  type SuccessConditionId,
  type TopicId,
} from '@gitblocks/domain';

import type {
  CandidateDossierV1,
  CapabilityRequestV1,
  EvidenceObservationV1,
  FitAssessmentRequestV1,
  FitAssessmentResponseV1,
  MaterialUnknownV1,
  RepositoryFingerprintV1,
} from './schemas.ts';

export function mapCapabilityRequestV1ToDomain(
  value: CapabilityRequestV1,
): CapabilityRequest {
  return {
    requestId: requestIdAt(value.requestId, 'requestId'),
    capabilityFamily: value.capabilityFamily,
    summary: value.summary,
    successConditions: value.successConditions.map((condition, index) => ({
      successConditionId: successConditionIdAt(
        condition.conditionId,
        `successConditions[${String(index)}].conditionId`,
      ),
      statement: condition.statement,
    })),
    hardConstraints: value.hardConstraints.map((constraint, index) => ({
      hardConstraintId: ownedId(
        'hard-constraint',
        constraint.constraintId,
        `hardConstraints[${String(index)}].constraintId`,
      ),
      reasonCode: ownedId(
        'reason-code',
        constraint.reasonCode,
        `hardConstraints[${String(index)}].reasonCode`,
      ),
      statement: constraint.statement,
    })),
    preferences: value.preferences.map((preference, index) => ({
      preferenceId: preferenceIdAt(
        preference.preferenceId,
        `preferences[${String(index)}].preferenceId`,
      ),
      statement: preference.statement,
    })),
    transmissionApproval: {
      approvalId: ownedId(
        'approval',
        value.transmissionApproval.approvalId,
        'transmissionApproval.approvalId',
      ),
      status: 'approved',
      approvedBy: value.transmissionApproval.approvedBy,
      scope: value.transmissionApproval.scope,
      approvedAt: value.transmissionApproval.approvedAt,
      approvedFactCategories: value.transmissionApproval.approvedCategories,
    },
  };
}

export function mapRepositoryFingerprintV1ToDomain(
  value: RepositoryFingerprintV1,
): RepositoryFingerprint {
  return {
    fingerprintId: fingerprintIdAt(value.fingerprintId, 'fingerprintId'),
    facts: value.facts.map((fact, index) => mapRepositoryFact(fact, index)),
    omittedCategories: value.withheldCategories,
  };
}

export function mapCandidateDossierV1ToDomain(
  value: CandidateDossierV1,
): CandidateDossier {
  const candidateId = candidateIdAt(
    value.identity.candidateId,
    'identity.candidateId',
  );
  return {
    identity: {
      candidateId,
      project: value.identity.displayName,
      packageName: value.identity.package?.name ?? null,
      repository: `https://github.com/${value.identity.repository.owner}/${value.identity.repository.name}`,
    },
    capabilityFamily: value.capabilityFamily,
    versionScope: value.versionScope,
    evidence: value.observations.map(mapEvidenceObservation),
    limitations: value.limitations.map((limitation, index) =>
      mapCandidateLimitation(limitation, index),
    ),
    unknowns: value.unknowns.map((unknown, index) =>
      mapCandidateUnknown(unknown, index),
    ),
  };
}

export function mapFitAssessmentRequestV1ToDomain(
  value: FitAssessmentRequestV1,
): FitAssessmentRequest {
  return {
    assessmentRequestId: ownedId(
      'assessment-request',
      value.assessmentRequestId,
      'assessmentRequestId',
    ),
    capabilityRequest: mapCapabilityRequestV1ToDomain(value.capabilityRequest),
    repositoryFingerprint: mapRepositoryFingerprintV1ToDomain(
      value.repositoryFingerprint,
    ),
    candidateDossiers: value.candidates.map(mapCandidateDossierV1ToDomain),
    evidenceCutoff: value.evidenceCutoff,
    requestedMaximumResults: value.requestedMaximumResults,
    correlationId: value.correlationId,
  };
}

export function mapFitAssessmentResponseV1ToDomain(
  value: FitAssessmentResponseV1,
): FitAssessmentResult {
  const evidenceOwnerById = new Map<string, string>();
  for (const observation of value.evidence) {
    const previous = evidenceOwnerById.get(observation.evidenceId);
    if (previous === undefined || observation.candidateId < previous) {
      evidenceOwnerById.set(observation.evidenceId, observation.candidateId);
    }
  }
  const firstSuppliedCandidateId = [...value.suppliedCandidateIds].sort(
    (left, right) => (left < right ? -1 : left > right ? 1 : 0),
  )[0];
  if (firstSuppliedCandidateId === undefined) {
    throw new Error(
      'Structurally validated response has no supplied candidate.',
    );
  }
  const fallbackCandidateId = candidateIdAt(
    firstSuppliedCandidateId,
    'suppliedCandidateIds[0]',
  );
  return {
    assessmentId: assessmentIdAt(value.assessmentId, 'assessmentId'),
    assessmentRequestId: assessmentRequestIdAt(
      value.assessmentRequestId,
      'assessmentRequestId',
    ),
    correlationId: value.correlationId,
    outcome: value.outcome,
    suppliedCandidateIds: value.suppliedCandidateIds.map((candidateId, index) =>
      candidateIdAt(candidateId, `suppliedCandidateIds[${String(index)}]`),
    ),
    assessments: value.candidateAssessments.map((assessment, index) =>
      mapCandidateAssessment(assessment, index),
    ),
    evidence: value.evidence.map(mapEvidenceObservation),
    inferences: value.inferences.map((inference, index) =>
      mapInference(inference, index),
    ),
    unknowns: value.materialUnknowns.map((unknown, index) =>
      mapMaterialUnknown(
        unknown,
        index,
        evidenceOwnerById,
        fallbackCandidateId,
      ),
    ),
    claims: value.materialClaims.map((claim, index) =>
      mapMaterialClaim(claim, index),
    ),
    hardConstraintConflicts: value.hardConstraintConflicts.map(
      (conflict, index) => mapHardConstraintConflict(conflict, index),
    ),
    rankGroups: value.rankGroups.map((group, groupIndex) => ({
      candidateIds: group.candidateIds.map((candidateId, candidateIndex) =>
        candidateIdAt(
          candidateId,
          `rankGroups[${String(groupIndex)}].candidateIds[${String(candidateIndex)}]`,
        ),
      ),
    })),
    rankRelations: value.rankRelations.map((relation, index) => ({
      higherCandidateId: candidateIdAt(
        relation.higherCandidateId,
        `rankRelations[${String(index)}].higherCandidateId`,
      ),
      lowerCandidateId: candidateIdAt(
        relation.lowerCandidateId,
        `rankRelations[${String(index)}].lowerCandidateId`,
      ),
    })),
    incomparablePairs: value.incomparablePairs.map((pair, index) => ({
      leftCandidateId: candidateIdAt(
        pair.leftCandidateId,
        `incomparablePairs[${String(index)}].leftCandidateId`,
      ),
      rightCandidateId: candidateIdAt(
        pair.rightCandidateId,
        `incomparablePairs[${String(index)}].rightCandidateId`,
      ),
    })),
    evidenceCutoff: value.evidenceCutoff,
    producedAt: value.producedAt,
    completeness: value.completeness,
  };
}

function mapRepositoryFact(
  fact: RepositoryFingerprintV1['facts'][number],
  index: number,
): RepositoryFact {
  const repositoryFactId = repositoryFactIdAt(
    fact.factId,
    `facts[${String(index)}].factId`,
  );
  const provenance = {
    kind: 'repository-local' as const,
    source: fact.provenance.origin,
    directness:
      fact.provenance.directness === 'direct'
        ? ('direct' as const)
        : ('derived' as const),
    confidence: fact.provenance.confidence,
    collectedAt: fact.provenance.observedAt,
  };
  switch (fact.kind) {
    case 'component':
      return {
        kind: 'named-version',
        repositoryFactId,
        category: fact.component,
        name: fact.name,
        version: fact.version,
        provenance,
      };
    case 'deployment':
      return {
        kind: 'deployment',
        repositoryFactId,
        topology: fact.topology,
        workerCapability: fact.workerCapability,
        replicas: fact.replicas,
        region: fact.region,
        provenance,
      };
    case 'capability':
      return {
        kind: 'capability',
        repositoryFactId,
        capability: topicIdAt(
          fact.capabilityCode,
          `facts[${String(index)}].capabilityCode`,
        ),
        present: fact.state === 'supported',
        provenance,
      };
    case 'credential-policy':
      return {
        kind: 'credential-policy',
        repositoryFactId,
        owner: fact.owner,
        scope: fact.scope,
        isolation: fact.isolation,
        rotation: fact.rotation,
        provenance,
      };
    case 'data-exclusion':
      return {
        kind: 'data-exclusion',
        repositoryFactId,
        destination: fact.destination,
        categories: fact.categories,
        provenance,
      };
    case 'data-lifecycle':
      return fact.category === 'rate-limit-counter'
        ? {
            kind: 'data-lifecycle',
            repositoryFactId,
            category: 'rate-limit-counter',
            policy: 'reset-on-planned-restart-allowed',
            provenance,
          }
        : {
            kind: 'data-lifecycle',
            repositoryFactId,
            category: 'raw-webhook-body',
            policy: 'retain-until-signature-verification',
            provenance,
          };
    case 'data-residency':
      return {
        kind: 'data-residency',
        repositoryFactId,
        categories: fact.categories,
        storage: fact.storage,
        region: fact.region,
        provenance,
      };
    case 'data-shape':
      return {
        kind: 'data-shape',
        repositoryFactId,
        shape: fact.shape,
        provenance,
      };
    case 'data-store':
      return fact.category === 'rate-limit-counter'
        ? {
            kind: 'data-store',
            repositoryFactId,
            category: 'rate-limit-counter',
            stores: fact.stores,
            contents: 'operational-counters-only',
            provenance,
          }
        : {
            kind: 'data-store',
            repositoryFactId,
            category: 'media-and-queue-state',
            stores: fact.stores,
            contents: 'repository-declared',
            provenance,
          };
    case 'identity-context':
      return {
        kind: 'identity-context',
        repositoryFactId,
        sourceContext: fact.sourceContext,
        identifiers: fact.identifiers,
        normalization: fact.normalization,
        credentials: fact.credentials,
        provenance,
      };
    case 'infrastructure':
      return fact.resource === 'additional-self-hosted-service'
        ? {
            kind: 'infrastructure',
            repositoryFactId,
            resource: 'additional-self-hosted-service',
            availability: 'available',
            backingStore: 'postgresql',
            maximumAdditionalInstances: 1,
            provenance,
          }
        : {
            kind: 'infrastructure',
            repositoryFactId,
            resource: fact.resource,
            availability: fact.availability,
            backingStore: 'none',
            maximumAdditionalInstances: null,
            provenance,
          };
    case 'tenant':
      return {
        kind: 'tenant',
        repositoryFactId,
        tenantModel: fact.tenantModel,
        provenance,
      };
  }
}

function mapEvidenceObservation(
  observation: EvidenceObservationV1,
  index = 0,
): EvidenceObservation {
  const base = `evidence[${String(index)}]`;
  return {
    kind: 'evidence-observation',
    evidenceId: evidenceIdAt(observation.evidenceId, `${base}.evidenceId`),
    candidateId: candidateIdAt(observation.candidateId, `${base}.candidateId`),
    topic: topicIdAt(observation.topic, `${base}.topic`),
    dimension: observation.dimension,
    observation: observation.observation,
    provenance: {
      sourceType: observation.source.sourceType,
      sourceUrl: observation.source.sourceUrl,
      revision: { ...observation.source.revision },
      collectedAt: observation.source.collectedAt,
      publishedAt: observation.source.publishedAt,
    },
    directness: observation.directness,
    freshness: { ...observation.freshness },
    limitation: observation.limitation,
  };
}

function mapCandidateLimitation(
  limitation: CandidateDossierV1['limitations'][number],
  index: number,
): CandidateLimitation {
  const candidateId = candidateIdAt(
    limitation.candidateId,
    `limitations[${String(index)}].candidateId`,
  );
  return {
    limitationId: limitationIdAt(
      limitation.limitationId,
      `limitations[${String(index)}].limitationId`,
    ),
    candidateId,
    statement: limitation.statement,
    evidenceReferences: limitation.evidenceIds.map((evidenceId, refIndex) =>
      evidenceReference(
        candidateId,
        evidenceId,
        `limitations[${String(index)}].evidenceIds[${String(refIndex)}]`,
      ),
    ),
  };
}

function mapCandidateUnknown(
  unknown: CandidateDossierV1['unknowns'][number],
  index: number,
): CandidateMaterialUnknown {
  const candidateId = candidateIdAt(
    unknown.candidateId,
    `unknowns[${String(index)}].candidateId`,
  );
  return {
    kind: 'material-unknown',
    scope: 'candidate',
    unknownId: unknownIdAt(
      unknown.unknownId,
      `unknowns[${String(index)}].unknownId`,
    ),
    candidateId,
    topic: topicIdAt(unknown.topic, `unknowns[${String(index)}].topic`),
    statement: unknown.statement,
    evidenceReferences: unknown.evidenceIds.map((evidenceId, refIndex) =>
      evidenceReference(
        candidateId,
        evidenceId,
        `unknowns[${String(index)}].evidenceIds[${String(refIndex)}]`,
      ),
    ),
  };
}

function mapInference(
  inference: FitAssessmentResponseV1['inferences'][number],
  index: number,
): Inference {
  const candidateId = candidateIdAt(
    inference.candidateId,
    `inferences[${String(index)}].candidateId`,
  );
  return {
    kind: 'inference',
    inferenceId: inferenceIdAt(
      inference.inferenceId,
      `inferences[${String(index)}].inferenceId`,
    ),
    candidateId,
    topic: topicIdAt(inference.topic, `inferences[${String(index)}].topic`),
    statement: inference.statement,
    rationale: inference.rationale,
    evidenceReferences: inference.evidenceIds.map((evidenceId, refIndex) =>
      evidenceReference(
        candidateId,
        evidenceId,
        `inferences[${String(index)}].evidenceIds[${String(refIndex)}]`,
      ),
    ),
  };
}

function mapMaterialUnknown(
  unknown: MaterialUnknownV1,
  index: number,
  evidenceOwnerById: ReadonlyMap<string, string>,
  fallbackCandidateId: CandidateId,
): MaterialUnknown {
  const common = {
    kind: 'material-unknown' as const,
    unknownId: unknownIdAt(
      unknown.unknownId,
      `materialUnknowns[${String(index)}].unknownId`,
    ),
    topic: topicIdAt(unknown.topic, `materialUnknowns[${String(index)}].topic`),
    statement: unknown.statement,
  };
  if (unknown.scope === 'candidate') {
    const candidateId = candidateIdAt(
      unknown.candidateId,
      `materialUnknowns[${String(index)}].candidateId`,
    );
    return {
      ...common,
      scope: 'candidate',
      candidateId,
      evidenceReferences: unknown.evidenceIds.map((evidenceId, refIndex) =>
        evidenceReference(
          candidateId,
          evidenceId,
          `materialUnknowns[${String(index)}].evidenceIds[${String(refIndex)}]`,
        ),
      ),
    };
  }
  return {
    ...common,
    scope: 'assessment',
    evidenceReferences: unknown.evidenceIds.map((evidenceId, refIndex) => {
      const owner = evidenceOwnerById.get(evidenceId) ?? fallbackCandidateId;
      return evidenceReference(
        candidateIdAt(owner, 'materialUnknowns.evidenceOwner'),
        evidenceId,
        `materialUnknowns[${String(index)}].evidenceIds[${String(refIndex)}]`,
      );
    }),
  };
}

function mapMaterialClaim(
  claim: FitAssessmentResponseV1['materialClaims'][number],
  index: number,
): MaterialClaim {
  const candidateId = candidateIdAt(
    claim.candidateId,
    `materialClaims[${String(index)}].candidateId`,
  );
  return {
    kind: 'material-claim',
    claimId: claimIdAt(
      claim.claimId,
      `materialClaims[${String(index)}].claimId`,
    ),
    candidateId,
    topic: topicIdAt(claim.topic, `materialClaims[${String(index)}].topic`),
    direction: claim.direction,
    statement: claim.statement,
    evidenceReferences: claim.evidenceIds.map((evidenceId, refIndex) =>
      evidenceReference(
        candidateId,
        evidenceId,
        `materialClaims[${String(index)}].evidenceIds[${String(refIndex)}]`,
      ),
    ),
    inferenceIds: claim.inferenceIds.map((inferenceId, refIndex) =>
      inferenceIdAt(
        inferenceId,
        `materialClaims[${String(index)}].inferenceIds[${String(refIndex)}]`,
      ),
    ),
  };
}

function mapCandidateAssessment(
  assessment: FitAssessmentResponseV1['candidateAssessments'][number],
  index: number,
): CandidateAssessment {
  const candidateId = candidateIdAt(
    assessment.candidateId,
    `candidateAssessments[${String(index)}].candidateId`,
  );
  return {
    candidateId,
    disposition: assessment.disposition,
    reasons: assessment.reasons.map((reason, reasonIndex) => {
      const reasonCandidateId = candidateIdAt(
        reason.candidateId,
        `candidateAssessments[${String(index)}].reasons[${String(reasonIndex)}].candidateId`,
      );
      return {
        candidateId: reasonCandidateId,
        reasonCode: reasonCodeAt(
          reason.reasonCode,
          `candidateAssessments[${String(index)}].reasons[${String(reasonIndex)}].reasonCode`,
        ),
        statement: reason.statement,
        evidenceReferences: reason.evidenceIds.map((evidenceId, refIndex) =>
          evidenceReference(
            reasonCandidateId,
            evidenceId,
            `candidateAssessments[${String(index)}].reasons[${String(reasonIndex)}].evidenceIds[${String(refIndex)}]`,
          ),
        ),
        inferenceIds: reason.inferenceIds.map((inferenceId, refIndex) =>
          inferenceIdAt(
            inferenceId,
            `candidateAssessments[${String(index)}].reasons[${String(reasonIndex)}].inferenceIds[${String(refIndex)}]`,
          ),
        ),
        unknownIds: reason.unknownIds.map((unknownId, refIndex) =>
          unknownIdAt(
            unknownId,
            `candidateAssessments[${String(index)}].reasons[${String(reasonIndex)}].unknownIds[${String(refIndex)}]`,
          ),
        ),
      };
    }),
    evidenceReferences: assessment.evidenceIds.map((evidenceId, refIndex) =>
      evidenceReference(
        candidateId,
        evidenceId,
        `candidateAssessments[${String(index)}].evidenceIds[${String(refIndex)}]`,
      ),
    ),
    inferenceIds: assessment.inferenceIds.map((inferenceId, refIndex) =>
      inferenceIdAt(
        inferenceId,
        `candidateAssessments[${String(index)}].inferenceIds[${String(refIndex)}]`,
      ),
    ),
    unknownIds: assessment.unknownIds.map((unknownId, refIndex) =>
      unknownIdAt(
        unknownId,
        `candidateAssessments[${String(index)}].unknownIds[${String(refIndex)}]`,
      ),
    ),
    claimIds: assessment.claimIds.map((claimId, refIndex) =>
      claimIdAt(
        claimId,
        `candidateAssessments[${String(index)}].claimIds[${String(refIndex)}]`,
      ),
    ),
    hardConflictIds: assessment.hardConstraintConflictIds.map(
      (conflictId, refIndex) =>
        hardConflictIdAt(
          conflictId,
          `candidateAssessments[${String(index)}].hardConstraintConflictIds[${String(refIndex)}]`,
        ),
    ),
  };
}

function mapHardConstraintConflict(
  conflict: FitAssessmentResponseV1['hardConstraintConflicts'][number],
  index: number,
): HardConstraintConflict {
  const candidateId = candidateIdAt(
    conflict.candidateId,
    `hardConstraintConflicts[${String(index)}].candidateId`,
  );
  return {
    hardConstraintConflictId: hardConflictIdAt(
      conflict.conflictId,
      `hardConstraintConflicts[${String(index)}].conflictId`,
    ),
    candidateId,
    hardConstraintId: hardConstraintIdAt(
      conflict.constraintId,
      `hardConstraintConflicts[${String(index)}].constraintId`,
    ),
    reasonCode: reasonCodeAt(
      conflict.reasonCode,
      `hardConstraintConflicts[${String(index)}].reasonCode`,
    ),
    evidenceReferences: conflict.evidenceIds.map((evidenceId, refIndex) =>
      evidenceReference(
        candidateId,
        evidenceId,
        `hardConstraintConflicts[${String(index)}].evidenceIds[${String(refIndex)}]`,
      ),
    ),
  };
}

function evidenceReference(
  candidateId: CandidateId,
  evidenceId: string,
  path: string,
): EvidenceReference {
  return {
    kind: 'evidence-reference',
    candidateId,
    evidenceId: evidenceIdAt(evidenceId, path),
  };
}

function ownedId<Kind extends StableIdKind>(
  kind: Kind,
  value: string,
  path: string,
): StableId<Kind> {
  const result = createStableId(kind, value, path);
  if (!result.ok) {
    throw new Error(
      'Structurally validated identifier could not map into the domain.',
    );
  }
  return result.value;
}

function assessmentIdAt(value: string, path: string): AssessmentId {
  return ownedId('assessment', value, path);
}

function assessmentRequestIdAt(
  value: string,
  path: string,
): AssessmentRequestId {
  return ownedId('assessment-request', value, path);
}

function candidateIdAt(value: string, path: string): CandidateId {
  return ownedId('candidate', value, path);
}

function evidenceIdAt(value: string, path: string): EvidenceId {
  return ownedId('evidence', value, path);
}

function fingerprintIdAt(value: string, path: string): FingerprintId {
  return ownedId('fingerprint', value, path);
}

function hardConflictIdAt(
  value: string,
  path: string,
): HardConstraintConflictId {
  return ownedId('hard-conflict', value, path);
}

function hardConstraintIdAt(value: string, path: string): HardConstraintId {
  return ownedId('hard-constraint', value, path);
}

function inferenceIdAt(value: string, path: string): InferenceId {
  return ownedId('inference', value, path);
}

function limitationIdAt(value: string, path: string): LimitationId {
  return ownedId('limitation', value, path);
}

function claimIdAt(value: string, path: string): MaterialClaimId {
  return ownedId('claim', value, path);
}

function unknownIdAt(value: string, path: string): MaterialUnknownId {
  return ownedId('unknown', value, path);
}

function reasonCodeAt(value: string, path: string): ReasonCode {
  return ownedId('reason-code', value, path);
}

function repositoryFactIdAt(value: string, path: string): RepositoryFactId {
  return ownedId('repository-fact', value, path);
}

function requestIdAt(value: string, path: string): RequestId {
  return ownedId('request', value, path);
}

function successConditionIdAt(value: string, path: string): SuccessConditionId {
  return ownedId('success-condition', value, path);
}

function preferenceIdAt(value: string, path: string): PreferenceId {
  return ownedId('preference', value, path);
}

function topicIdAt(value: string, path: string): TopicId {
  return ownedId('topic', value, path);
}
