import {
  canonicalizeCandidateDossier,
  canonicalizeCapabilityRequest,
  canonicalizeFitAssessmentRequest,
  canonicalizeRepositoryFingerprint,
} from './canonicalize.ts';
import {
  addIssue,
  addStableIdIssues,
  prefixIssues,
  resultFromIssues,
  type DomainIssue,
  type DomainResult,
} from './issues.ts';
import {
  CAPABILITY_FAMILIES,
  type CandidateDossier,
  type CapabilityRequest,
  type EvidenceId,
  type EvidenceObservation,
  type FitAssessmentRequest,
  type MaterialUnknownId,
  type RepositoryFact,
  type RepositoryFingerprint,
  type TransmissionFactCategory,
} from './model.ts';
import {
  addDuplicateIdIssues,
  addDuplicateTextIssues,
  addEvidenceReferenceIssues,
} from './reference-validation.ts';
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

function isSupportedCapabilityFamily(value: string): boolean {
  return CAPABILITY_FAMILIES.some((family) => family === value);
}

export function validateCapabilityRequest(
  input: CapabilityRequest,
): DomainResult<CapabilityRequest> {
  const request = canonicalizeCapabilityRequest(input);
  const issues: DomainIssue[] = [];
  addStableIdIssues(issues, request.requestId, 'requestId');
  if (!isSupportedCapabilityFamily(request.capabilityFamily)) {
    addIssue(issues, 'capability.family', 'capabilityFamily');
  }
  addDuplicateIdIssues(
    issues,
    request.successConditions.map((condition) => condition.successConditionId),
    'successConditions',
  );
  for (const [index, condition] of request.successConditions.entries()) {
    addStableIdIssues(
      issues,
      condition.successConditionId,
      `successConditions[${String(index)}].successConditionId`,
    );
  }
  addDuplicateIdIssues(
    issues,
    request.hardConstraints.map((constraint) => constraint.hardConstraintId),
    'hardConstraints',
  );
  for (const [index, constraint] of request.hardConstraints.entries()) {
    addStableIdIssues(
      issues,
      constraint.hardConstraintId,
      `hardConstraints[${String(index)}].hardConstraintId`,
    );
    addStableIdIssues(
      issues,
      constraint.reasonCode,
      `hardConstraints[${String(index)}].reasonCode`,
    );
  }
  addDuplicateIdIssues(
    issues,
    request.preferences.map((preference) => preference.preferenceId),
    'preferences',
  );
  for (const [index, preference] of request.preferences.entries()) {
    addStableIdIssues(
      issues,
      preference.preferenceId,
      `preferences[${String(index)}].preferenceId`,
    );
  }
  addStableIdIssues(
    issues,
    request.transmissionApproval.approvalId,
    'transmissionApproval.approvalId',
  );
  timestampAt(
    issues,
    request.transmissionApproval.approvedAt,
    'transmissionApproval.approvedAt',
  );
  addDuplicateTextIssues(
    issues,
    request.transmissionApproval.approvedFactCategories,
    'transmissionApproval.approvedFactCategories',
  );
  return resultFromIssues(request, issues);
}

function factSemanticAssertions(
  fact: RepositoryFact,
): readonly (readonly [key: string, value: string])[] {
  switch (fact.kind) {
    case 'capability':
      return [
        [
          `capability\u0000${fact.capability}`,
          fact.present ? 'present' : 'absent',
        ],
      ];
    case 'credential-policy':
      return [
        [
          `credential-policy\u0000${fact.owner}\u0000${fact.scope}`,
          `${fact.isolation}\u0000${fact.rotation}`,
        ],
      ];
    case 'data-exclusion':
      return fact.categories.map((category) => [
        `data-exclusion\u0000${fact.destination}\u0000${category}`,
        'excluded',
      ]);
    case 'data-lifecycle':
      return [[`data-lifecycle\u0000${fact.category}`, fact.policy]];
    case 'data-residency':
      return fact.categories.map((category) => [
        `data-residency\u0000${category}`,
        `${fact.storage}\u0000${fact.region}`,
      ]);
    case 'data-shape':
      return [[`data-shape\u0000${fact.shape}`, 'present']];
    case 'data-store':
      return [
        [
          `data-store\u0000${fact.category}`,
          `${fact.stores.join('\u0000')}\u0000${fact.contents}`,
        ],
      ];
    case 'deployment':
      return [
        [
          'deployment',
          [
            fact.topology,
            fact.workerCapability,
            fact.replicas === null ? 'null' : String(fact.replicas),
            fact.region ?? 'null',
          ].join('\u0000'),
        ],
      ];
    case 'identity-context':
      return fact.identifiers.map((identifier) => [
        `identity-context\u0000${fact.sourceContext}\u0000${identifier}`,
        `${fact.normalization}\u0000${fact.credentials}`,
      ]);
    case 'infrastructure':
      return [
        [
          `infrastructure\u0000${fact.resource}`,
          [
            fact.availability,
            fact.backingStore,
            fact.maximumAdditionalInstances === null
              ? 'null'
              : String(fact.maximumAdditionalInstances),
          ].join('\u0000'),
        ],
      ];
    case 'named-version':
      return [
        [
          fact.category === 'dependency'
            ? `named-version\u0000dependency\u0000${fact.name}`
            : `named-version\u0000${fact.category}`,
          `${fact.name}\u0000${fact.version ?? 'null'}`,
        ],
      ];
    case 'tenant':
      return [['tenant', fact.tenantModel]];
  }
}

export function validateRepositoryFingerprint(
  input: RepositoryFingerprint,
): DomainResult<RepositoryFingerprint> {
  const fingerprint = canonicalizeRepositoryFingerprint(input);
  const issues: DomainIssue[] = [];
  addStableIdIssues(issues, fingerprint.fingerprintId, 'fingerprintId');
  addDuplicateIdIssues(
    issues,
    fingerprint.facts.map((fact) => fact.repositoryFactId),
    'facts',
  );
  addDuplicateTextIssues(
    issues,
    fingerprint.omittedCategories,
    'omittedCategories',
  );

  const semanticFacts = new Map<string, string>();
  for (const [index, fact] of fingerprint.facts.entries()) {
    const path = `facts[${String(index)}]`;
    addStableIdIssues(
      issues,
      fact.repositoryFactId,
      `${path}.repositoryFactId`,
    );
    timestampAt(
      issues,
      fact.provenance.collectedAt,
      `${path}.provenance.collectedAt`,
    );
    if (fact.kind === 'capability') {
      addStableIdIssues(issues, fact.capability, `${path}.capability`);
    } else if (fact.kind === 'data-exclusion') {
      addDuplicateTextIssues(issues, fact.categories, `${path}.categories`);
    } else if (fact.kind === 'data-residency') {
      addDuplicateTextIssues(issues, fact.categories, `${path}.categories`);
    } else if (fact.kind === 'data-store') {
      addDuplicateTextIssues(issues, fact.stores, `${path}.stores`);
    } else if (fact.kind === 'identity-context') {
      addDuplicateTextIssues(issues, fact.identifiers, `${path}.identifiers`);
    }
    for (const [key, value] of factSemanticAssertions(fact)) {
      const previous = semanticFacts.get(key);
      if (previous !== undefined) {
        addIssue(
          issues,
          previous === value ? 'fact.duplicate' : 'fact.contradictory',
          'facts',
        );
      } else {
        semanticFacts.set(key, value);
      }
    }
  }
  return resultFromIssues(fingerprint, issues);
}

function validateCandidateDossierValue(
  dossier: CandidateDossier,
  issues: DomainIssue[],
): void {
  const candidateId = dossier.identity.candidateId;
  addStableIdIssues(issues, candidateId, 'identity.candidateId');
  if (!isSupportedCapabilityFamily(dossier.capabilityFamily)) {
    addIssue(issues, 'capability.family', 'capabilityFamily');
  }
  addDuplicateIdIssues(
    issues,
    dossier.evidence.map((observation) => observation.evidenceId),
    'evidence',
  );
  const evidenceById = new Map<EvidenceId, EvidenceObservation>();
  for (const [index, observation] of dossier.evidence.entries()) {
    const path = `evidence[${String(index)}]`;
    addStableIdIssues(issues, observation.evidenceId, `${path}.evidenceId`);
    addStableIdIssues(issues, observation.candidateId, `${path}.candidateId`);
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
    timestampAt(issues, observation.freshness.asOf, `${path}.freshness.asOf`);
    if (
      collectedAt !== null &&
      publishedAt !== null &&
      publishedAt > collectedAt
    ) {
      addIssue(issues, 'evidence.temporal-order', path);
    }
    if (observation.candidateId !== candidateId) {
      addIssue(issues, 'reference.candidate-ownership', path);
    }
    evidenceById.set(observation.evidenceId, observation);
  }

  addDuplicateIdIssues(
    issues,
    dossier.unknowns.map((unknown) => unknown.unknownId),
    'unknowns',
  );
  for (const [index, unknown] of dossier.unknowns.entries()) {
    const path = `unknowns[${String(index)}]`;
    addStableIdIssues(issues, unknown.unknownId, `${path}.unknownId`);
    addStableIdIssues(issues, unknown.candidateId, `${path}.candidateId`);
    addStableIdIssues(issues, unknown.topic, `${path}.topic`);
    if (unknown.candidateId !== candidateId) {
      addIssue(issues, 'reference.candidate-ownership', path);
    }
    addEvidenceReferenceIssues(
      issues,
      unknown.evidenceReferences,
      evidenceById,
      candidateId,
      `${path}.evidenceReferences`,
    );
  }

  addDuplicateIdIssues(
    issues,
    dossier.limitations.map((limitation) => limitation.limitationId),
    'limitations',
  );
  for (const [index, limitation] of dossier.limitations.entries()) {
    const path = `limitations[${String(index)}]`;
    addStableIdIssues(issues, limitation.limitationId, `${path}.limitationId`);
    addStableIdIssues(issues, limitation.candidateId, `${path}.candidateId`);
    if (limitation.candidateId !== candidateId) {
      addIssue(issues, 'reference.candidate-ownership', path);
    }
    addEvidenceReferenceIssues(
      issues,
      limitation.evidenceReferences,
      evidenceById,
      candidateId,
      `${path}.evidenceReferences`,
    );
  }
}

export function validateCandidateDossier(
  input: CandidateDossier,
): DomainResult<CandidateDossier> {
  const dossier = canonicalizeCandidateDossier(input);
  const issues: DomainIssue[] = [];
  validateCandidateDossierValue(dossier, issues);
  return resultFromIssues(dossier, issues);
}

export function validateFitAssessmentRequest(
  input: FitAssessmentRequest,
): DomainResult<FitAssessmentRequest> {
  const request = canonicalizeFitAssessmentRequest(input);
  const issues: DomainIssue[] = [];
  addStableIdIssues(issues, request.assessmentRequestId, 'assessmentRequestId');
  const evidenceCutoff = timestampAt(
    issues,
    request.evidenceCutoff,
    'evidenceCutoff',
  );
  const capabilityResult = validateCapabilityRequest(request.capabilityRequest);
  if (!capabilityResult.ok) {
    prefixIssues(issues, 'capabilityRequest', capabilityResult.issues);
  }
  const fingerprintResult = validateRepositoryFingerprint(
    request.repositoryFingerprint,
  );
  if (!fingerprintResult.ok) {
    prefixIssues(issues, 'repositoryFingerprint', fingerprintResult.issues);
  }
  if (
    evidenceCutoff !== null &&
    request.repositoryFingerprint.facts.some((fact) => {
      const collectedAt = parseUtcTimestamp(fact.provenance.collectedAt);
      return collectedAt !== null && collectedAt > evidenceCutoff;
    })
  ) {
    addIssue(issues, 'request.evidence-cutoff', 'repositoryFingerprint.facts');
  }

  if (
    request.candidateDossiers.length < 1 ||
    request.candidateDossiers.length > 20
  ) {
    addIssue(issues, 'request.candidate-count', 'candidateDossiers');
  }
  if (
    !Number.isInteger(request.requestedMaximumResults) ||
    request.requestedMaximumResults < 1 ||
    request.requestedMaximumResults > request.candidateDossiers.length
  ) {
    addIssue(issues, 'request.maximum-results', 'requestedMaximumResults');
  }

  const candidateIds = request.candidateDossiers.map(
    (dossier) => dossier.identity.candidateId,
  );
  addDuplicateIdIssues(issues, candidateIds, 'candidateDossiers');
  const allEvidenceIds: EvidenceId[] = [];
  const allUnknownIds: MaterialUnknownId[] = [];
  for (const [index, dossier] of request.candidateDossiers.entries()) {
    const path = `candidateDossiers[${String(index)}]`;
    const dossierResult = validateCandidateDossier(dossier);
    if (!dossierResult.ok) {
      prefixIssues(issues, path, dossierResult.issues);
    }
    if (
      dossier.capabilityFamily !== request.capabilityRequest.capabilityFamily
    ) {
      addIssue(issues, 'request.candidate-family', `${path}.capabilityFamily`);
    }
    allEvidenceIds.push(
      ...dossier.evidence.map((observation) => observation.evidenceId),
    );
    if (evidenceCutoff !== null) {
      for (const observation of dossier.evidence) {
        const collectedAt = parseUtcTimestamp(
          observation.provenance.collectedAt,
        );
        const freshnessAsOf = parseUtcTimestamp(observation.freshness.asOf);
        if (
          (collectedAt !== null && collectedAt > evidenceCutoff) ||
          (freshnessAsOf !== null && freshnessAsOf > evidenceCutoff)
        ) {
          addIssue(issues, 'request.evidence-cutoff', path);
        }
      }
    }
    allUnknownIds.push(...dossier.unknowns.map((unknown) => unknown.unknownId));
  }
  addDuplicateIdIssues(issues, allEvidenceIds, 'candidateDossiers.evidence');
  addDuplicateIdIssues(issues, allUnknownIds, 'candidateDossiers.unknowns');
  const approvedCategories = new Set(
    request.capabilityRequest.transmissionApproval.approvedFactCategories,
  );
  const requiredCategories: TransmissionFactCategory[] = [
    'capability-request',
    'repository-fingerprint',
    'candidate-dossiers',
  ];
  if (allEvidenceIds.length > 0) {
    requiredCategories.push('bounded-evidence');
  }
  if (
    requiredCategories.some((category) => !approvedCategories.has(category))
  ) {
    addIssue(
      issues,
      'request.transmission-approval',
      'capabilityRequest.transmissionApproval.approvedFactCategories',
    );
  }
  return resultFromIssues(request, issues);
}
