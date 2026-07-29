declare const stableIdBrand: unique symbol;

export const CAPABILITY_FAMILIES = [
  'authorization',
  'audit-logging',
  'background-jobs',
  'rate-limiting',
  'webhooks',
] as const;

export type CapabilityFamily = (typeof CAPABILITY_FAMILIES)[number];

export type StableIdKind =
  | 'approval'
  | 'assessment'
  | 'assessment-processing-reason'
  | 'assessment-request'
  | 'candidate'
  | 'claim'
  | 'evidence'
  | 'fact-code'
  | 'fact-subject'
  | 'fact-value'
  | 'fingerprint'
  | 'hard-conflict'
  | 'hard-constraint'
  | 'inference'
  | 'limitation'
  | 'limitation-code'
  | 'preference'
  | 'reason-code'
  | 'repository-fact'
  | 'request'
  | 'success-condition'
  | 'topic'
  | 'unknown'
  | 'validation-reference';

export type StableId<Kind extends StableIdKind> = string & {
  readonly [stableIdBrand]: Kind;
};

export type ApprovalId = StableId<'approval'>;
export type AssessmentId = StableId<'assessment'>;
export type AssessmentProcessingReasonCode =
  StableId<'assessment-processing-reason'>;
export type AssessmentRequestId = StableId<'assessment-request'>;
export type CandidateId = StableId<'candidate'>;
export type EvidenceId = StableId<'evidence'>;
export type RepositoryFactCode = StableId<'fact-code'>;
export type RepositoryFactSubjectCode = StableId<'fact-subject'>;
export type RepositoryFactValueCode = StableId<'fact-value'>;
export type FingerprintId = StableId<'fingerprint'>;
export type HardConstraintConflictId = StableId<'hard-conflict'>;
export type HardConstraintId = StableId<'hard-constraint'>;
export type InferenceId = StableId<'inference'>;
export type LimitationId = StableId<'limitation'>;
export type LimitationCode = StableId<'limitation-code'>;
export type MaterialClaimId = StableId<'claim'>;
export type MaterialUnknownId = StableId<'unknown'>;
export type PreferenceId = StableId<'preference'>;
export type ReasonCode = StableId<'reason-code'>;
export type RepositoryFactId = StableId<'repository-fact'>;
export type RequestId = StableId<'request'>;
export type SuccessConditionId = StableId<'success-condition'>;
export type TopicId = StableId<'topic'>;
export type ValidationReferenceId = StableId<'validation-reference'>;

export interface SuccessCondition {
  readonly successConditionId: SuccessConditionId;
  readonly statement: string;
}

export interface HardConstraint {
  readonly hardConstraintId: HardConstraintId;
  readonly reasonCode: ReasonCode;
  readonly statement: string;
}

export interface Preference {
  readonly preferenceId: PreferenceId;
  readonly statement: string;
}

export type TransmissionFactCategory =
  | 'bounded-evidence'
  | 'candidate-dossiers'
  | 'capability-request'
  | 'repository-fingerprint';

export interface TransmissionApproval {
  readonly approvalId: ApprovalId;
  readonly status: 'approved';
  readonly approvedBy: 'request-originator';
  readonly scope: 'minimized-repository-facts';
  readonly approvedAt: string;
  readonly approvedFactCategories: readonly TransmissionFactCategory[];
}

export interface CapabilityRequest {
  readonly requestId: RequestId;
  readonly capabilityFamily: CapabilityFamily;
  readonly summary: string;
  readonly successConditions: readonly SuccessCondition[];
  readonly hardConstraints: readonly HardConstraint[];
  readonly preferences: readonly Preference[];
  readonly transmissionApproval: TransmissionApproval;
}

export type RepositoryFactSource =
  | 'configuration-shape'
  | 'lockfile'
  | 'manifest'
  | 'repository-structure'
  | 'scanner-analysis'
  | 'supplied-declaration';

export interface RepositoryFactProvenance {
  readonly kind: 'repository-local';
  readonly source: RepositoryFactSource;
  readonly epistemicStatus: 'declared' | 'derived' | 'direct';
  readonly confidence: 'high' | 'low' | 'medium' | 'unknown';
  readonly collectedAt: string;
}

export type NamedVersionFactCategory =
  | 'database'
  | 'dependency'
  | 'framework'
  | 'language'
  | 'orm'
  | 'package-manager'
  | 'runtime';

export interface NamedVersionRepositoryFact {
  readonly kind: 'named-version';
  readonly repositoryFactId: RepositoryFactId;
  readonly category: NamedVersionFactCategory;
  readonly name: string;
  readonly version: string | null;
  readonly provenance: RepositoryFactProvenance;
}

export interface DeploymentRepositoryFact {
  readonly kind: 'deployment';
  readonly repositoryFactId: RepositoryFactId;
  readonly topology:
    'long-running-container' | 'long-running-server' | 'serverless';
  readonly workerCapability: 'capable' | 'incapable' | 'unknown';
  readonly replicas: number | null;
  readonly region: string | null;
  readonly provenance: RepositoryFactProvenance;
}

export type RepositoryFactCategory =
  | 'data-policy'
  | 'identity'
  | 'operations'
  | 'repository-capability'
  | 'repository-structure';

export type CodedRepositoryFactValue =
  | {
      readonly kind: 'classification';
      readonly code: RepositoryFactValueCode;
    }
  | {
      readonly kind: 'code-set';
      readonly codes: readonly RepositoryFactValueCode[];
    }
  | {
      readonly kind: 'integer';
      readonly value: number;
    }
  | {
      readonly kind: 'presence';
      readonly state: 'absent' | 'present' | 'unknown';
    };

export interface CodedRepositoryFact {
  readonly kind: 'coded';
  readonly repositoryFactId: RepositoryFactId;
  readonly category: RepositoryFactCategory;
  readonly code: RepositoryFactCode;
  readonly subjectCode: RepositoryFactSubjectCode | null;
  readonly value: CodedRepositoryFactValue;
  readonly provenance: RepositoryFactProvenance;
}

export type RepositoryFact =
  CodedRepositoryFact | DeploymentRepositoryFact | NamedVersionRepositoryFact;

export type RepositoryFactVocabularyVersion = string;

export type WithheldRepositoryCategory =
  | 'command-output'
  | 'configuration-values'
  | 'credentials'
  | 'data-facts'
  | 'database-content'
  | 'dependency-facts'
  | 'environment'
  | 'identity-facts'
  | 'logs'
  | 'operational-facts'
  | 'raw-source'
  | 'untracked-files';

export interface RepositoryFingerprint {
  readonly fingerprintId: FingerprintId;
  readonly factVocabularyVersion: RepositoryFactVocabularyVersion;
  readonly facts: readonly RepositoryFact[];
  readonly omittedCategories: readonly WithheldRepositoryCategory[];
}

export interface CandidateIdentity {
  readonly candidateId: CandidateId;
  readonly project: string;
  readonly packageName: string | null;
  readonly repository: string;
}

export type EvidenceDimension =
  | 'capability-family'
  | 'data-store'
  | 'deployment'
  | 'freshness'
  | 'identity'
  | 'integration'
  | 'license'
  | 'limitation'
  | 'maintenance'
  | 'provenance'
  | 'repository-package'
  | 'runtime-framework'
  | 'security'
  | 'version-release';

interface PublicImmutableEvidenceProvenance {
  readonly sourceUrl: string;
  readonly immutableUrl: string;
  readonly publishedAt: string;
  readonly collectedAt: string;
}

export type EvidenceProvenance =
  | (PublicImmutableEvidenceProvenance & {
      readonly kind: 'git-commit';
      readonly sourceType:
        'license' | 'official-documentation' | 'official-repository';
      readonly commitSha: string;
    })
  | (PublicImmutableEvidenceProvenance & {
      readonly kind: 'tag';
      readonly sourceType:
        'license' | 'official-documentation' | 'official-repository';
      readonly tag: string;
    })
  | (PublicImmutableEvidenceProvenance & {
      readonly kind: 'release';
      readonly sourceType: 'official-release';
      readonly release: string;
    })
  | (PublicImmutableEvidenceProvenance & {
      readonly kind: 'package-version';
      readonly sourceType: 'package-registry';
      readonly packageVersion: string;
    })
  | (PublicImmutableEvidenceProvenance & {
      readonly kind: 'security-advisory';
      readonly sourceType: 'security-advisory';
      readonly advisoryId: string;
    })
  | {
      readonly kind: 'mutable-documentation';
      readonly sourceType: 'official-documentation';
      readonly sourceUrl: string;
      readonly limitationCode: 'source-is-mutable';
      readonly collectedAt: string;
    }
  | {
      readonly kind: 'approved-validation';
      readonly sourceType: 'approved-validation';
      readonly validationReferenceId: ValidationReferenceId;
      readonly scope: TopicId;
      readonly validatedAt: string;
    };

export interface EvidenceObservation {
  readonly kind: 'evidence-observation';
  readonly evidenceId: EvidenceId;
  readonly candidateId: CandidateId;
  readonly topic: TopicId;
  readonly dimension: EvidenceDimension;
  readonly observation: string;
  readonly provenance: EvidenceProvenance;
  readonly directness: 'direct';
  readonly freshness: EvidenceFreshness;
  readonly limitation: string | null;
}

export interface EvidenceFreshness {
  readonly status: 'current' | 'stale' | 'unknown';
  readonly asOf: string;
  readonly scope: string;
}

export interface EvidenceReference {
  readonly kind: 'evidence-reference';
  readonly evidenceId: EvidenceId;
  readonly candidateId: CandidateId;
}

export interface Inference {
  readonly kind: 'inference';
  readonly inferenceId: InferenceId;
  readonly candidateId: CandidateId;
  readonly topic: TopicId;
  readonly statement: string;
  readonly rationale: string;
  readonly evidenceReferences: readonly EvidenceReference[];
}

interface MaterialUnknownBase {
  readonly kind: 'material-unknown';
  readonly unknownId: MaterialUnknownId;
  readonly topic: TopicId;
  readonly statement: string;
  readonly evidenceReferences: readonly EvidenceReference[];
}

export interface CandidateMaterialUnknown extends MaterialUnknownBase {
  readonly scope: 'candidate';
  readonly candidateId: CandidateId;
}

export interface AssessmentMaterialUnknown extends MaterialUnknownBase {
  readonly scope: 'assessment';
}

export type MaterialUnknown =
  AssessmentMaterialUnknown | CandidateMaterialUnknown;

export interface MaterialClaim {
  readonly kind: 'material-claim';
  readonly claimId: MaterialClaimId;
  readonly candidateId: CandidateId;
  readonly topic: TopicId;
  readonly direction: 'favorable' | 'neutral' | 'unfavorable';
  readonly statement: string;
  readonly evidenceReferences: readonly EvidenceReference[];
  readonly inferenceIds: readonly InferenceId[];
}

export interface CandidateLimitation {
  readonly limitationId: LimitationId;
  readonly limitationCode: LimitationCode;
  readonly candidateId: CandidateId;
  readonly statement: string;
  readonly evidenceReferences: readonly EvidenceReference[];
}

export interface CandidateDossier {
  readonly identity: CandidateIdentity;
  readonly capabilityFamily: CapabilityFamily;
  readonly versionScope: string | null;
  readonly evidence: readonly EvidenceObservation[];
  readonly limitations: readonly CandidateLimitation[];
  readonly unknowns: readonly CandidateMaterialUnknown[];
}

export type CandidateDisposition =
  'insufficient-evidence' | 'recommended' | 'rejected' | 'viable';

export interface CandidateReason {
  readonly candidateId: CandidateId;
  readonly reasonCode: ReasonCode;
  readonly statement: string;
  readonly evidenceReferences: readonly EvidenceReference[];
  readonly inferenceIds: readonly InferenceId[];
  readonly unknownIds: readonly MaterialUnknownId[];
}

export interface HardConstraintConflict {
  readonly hardConstraintConflictId: HardConstraintConflictId;
  readonly candidateId: CandidateId;
  readonly hardConstraintId: HardConstraintId;
  readonly reasonCode: ReasonCode;
  readonly evidenceReferences: readonly EvidenceReference[];
}

export interface CandidateAssessment {
  readonly candidateId: CandidateId;
  readonly disposition: CandidateDisposition;
  readonly reasons: readonly CandidateReason[];
  readonly evidenceReferences: readonly EvidenceReference[];
  readonly inferenceIds: readonly InferenceId[];
  readonly unknownIds: readonly MaterialUnknownId[];
  readonly claimIds: readonly MaterialClaimId[];
  readonly hardConflictIds: readonly HardConstraintConflictId[];
  readonly limitationIds: readonly LimitationId[];
}

export interface RankGroup {
  readonly candidateIds: readonly CandidateId[];
}

export interface ExplicitRankRelation {
  readonly higherCandidateId: CandidateId;
  readonly lowerCandidateId: CandidateId;
}

export interface IncomparablePair {
  readonly leftCandidateId: CandidateId;
  readonly rightCandidateId: CandidateId;
}

export type ResponsibleOutcome =
  'insufficient-evidence' | 'no-viable-candidate' | 'recommend';

export interface FitAssessmentRequest {
  readonly assessmentRequestId: AssessmentRequestId;
  readonly capabilityRequest: CapabilityRequest;
  readonly repositoryFingerprint: RepositoryFingerprint;
  readonly candidateDossiers: readonly CandidateDossier[];
  readonly evidenceCutoff: string;
  readonly requestedMaximumResults: number;
  readonly correlationId: string;
}

export interface FitAssessmentResult {
  readonly assessmentId: AssessmentId;
  readonly assessmentRequestId: AssessmentRequestId;
  readonly correlationId: string;
  readonly outcome: ResponsibleOutcome;
  readonly suppliedCandidateIds: readonly CandidateId[];
  readonly assessments: readonly CandidateAssessment[];
  readonly evidence: readonly EvidenceObservation[];
  readonly inferences: readonly Inference[];
  readonly candidateLimitations: readonly CandidateLimitation[];
  readonly unknowns: readonly MaterialUnknown[];
  readonly claims: readonly MaterialClaim[];
  readonly hardConstraintConflicts: readonly HardConstraintConflict[];
  readonly rankGroups: readonly RankGroup[];
  readonly rankRelations: readonly ExplicitRankRelation[];
  readonly incomparablePairs: readonly IncomparablePair[];
  readonly evidenceCutoff: string;
  readonly producedAt: string;
  readonly assessmentProcessing:
    | {
        readonly state: 'complete';
        readonly incompleteReasonCodes: readonly AssessmentProcessingReasonCode[];
      }
    | {
        readonly state: 'partial-evidence';
        readonly incompleteReasonCodes: readonly AssessmentProcessingReasonCode[];
      };
}

export interface FitAssessmentExchange {
  readonly request: FitAssessmentRequest;
  readonly result: FitAssessmentResult;
}
