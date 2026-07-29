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
  | 'assessment-request'
  | 'candidate'
  | 'claim'
  | 'evidence'
  | 'fingerprint'
  | 'hard-conflict'
  | 'hard-constraint'
  | 'inference'
  | 'limitation'
  | 'preference'
  | 'reason-code'
  | 'repository-fact'
  | 'request'
  | 'success-condition'
  | 'topic'
  | 'unknown';

export type StableId<Kind extends StableIdKind> = string & {
  readonly [stableIdBrand]: Kind;
};

export type ApprovalId = StableId<'approval'>;
export type AssessmentId = StableId<'assessment'>;
export type AssessmentRequestId = StableId<'assessment-request'>;
export type CandidateId = StableId<'candidate'>;
export type EvidenceId = StableId<'evidence'>;
export type FingerprintId = StableId<'fingerprint'>;
export type HardConstraintConflictId = StableId<'hard-conflict'>;
export type HardConstraintId = StableId<'hard-constraint'>;
export type InferenceId = StableId<'inference'>;
export type LimitationId = StableId<'limitation'>;
export type MaterialClaimId = StableId<'claim'>;
export type MaterialUnknownId = StableId<'unknown'>;
export type PreferenceId = StableId<'preference'>;
export type ReasonCode = StableId<'reason-code'>;
export type RepositoryFactId = StableId<'repository-fact'>;
export type RequestId = StableId<'request'>;
export type SuccessConditionId = StableId<'success-condition'>;
export type TopicId = StableId<'topic'>;

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
  | 'supplied-declaration';

export interface RepositoryFactProvenance {
  readonly kind: 'repository-local';
  readonly source: RepositoryFactSource;
  readonly directness: 'direct' | 'derived';
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

export interface CapabilityRepositoryFact {
  readonly kind: 'capability';
  readonly repositoryFactId: RepositoryFactId;
  readonly capability: TopicId;
  readonly present: boolean;
  readonly provenance: RepositoryFactProvenance;
}

export type RepositoryIdentityIdentifier =
  | 'account'
  | 'actor'
  | 'client'
  | 'correlation'
  | 'invoice'
  | 'media'
  | 'organization'
  | 'route'
  | 'source'
  | 'tenant';

export interface IdentityContextRepositoryFact {
  readonly kind: 'identity-context';
  readonly repositoryFactId: RepositoryFactId;
  readonly sourceContext:
    'access-token' | 'job-payload' | 'request' | 'route-key' | 'session';
  readonly identifiers: readonly RepositoryIdentityIdentifier[];
  readonly normalization: 'none' | 'normalized';
  readonly credentials: 'excluded' | 'not-stated';
  readonly provenance: RepositoryFactProvenance;
}

export interface CredentialPolicyRepositoryFact {
  readonly kind: 'credential-policy';
  readonly repositoryFactId: RepositoryFactId;
  readonly owner: 'provider' | 'tenant';
  readonly scope: 'webhook-endpoint';
  readonly isolation: 'per-provider-endpoint' | 'per-tenant';
  readonly rotation: 'independently-rotatable' | 'not-stated';
  readonly provenance: RepositoryFactProvenance;
}

export interface DataExclusionRepositoryFact {
  readonly kind: 'data-exclusion';
  readonly repositoryFactId: RepositoryFactId;
  readonly destination: 'audit-payload';
  readonly categories: readonly (
    'access-token' | 'cookie' | 'customer-email'
  )[];
  readonly provenance: RepositoryFactProvenance;
}

export type RepositoryDataCategory =
  | 'audit-data'
  | 'billing-data'
  | 'invoice-state'
  | 'job-state'
  | 'regulated-customer-data';

export interface DataResidencyRepositoryFact {
  readonly kind: 'data-residency';
  readonly repositoryFactId: RepositoryFactId;
  readonly categories: readonly RepositoryDataCategory[];
  readonly storage: 'existing-postgresql' | 'unspecified';
  readonly region: 'eu' | 'eu-central-1' | 'existing-region';
  readonly provenance: RepositoryFactProvenance;
}

export interface DataShapeRepositoryFact {
  readonly kind: 'data-shape';
  readonly repositoryFactId: RepositoryFactId;
  readonly shape:
    | 'document-tenant-owner-classification'
    | 'team-project-document-relationships';
  readonly provenance: RepositoryFactProvenance;
}

interface DataLifecycleRepositoryFactBase {
  readonly kind: 'data-lifecycle';
  readonly repositoryFactId: RepositoryFactId;
  readonly provenance: RepositoryFactProvenance;
}

export type DataLifecycleRepositoryFact = DataLifecycleRepositoryFactBase &
  (
    | {
        readonly category: 'rate-limit-counter';
        readonly policy: 'reset-on-planned-restart-allowed';
      }
    | {
        readonly category: 'raw-webhook-body';
        readonly policy: 'retain-until-signature-verification';
      }
  );

interface DataStoreRepositoryFactBase {
  readonly kind: 'data-store';
  readonly repositoryFactId: RepositoryFactId;
  readonly provenance: RepositoryFactProvenance;
}

export type DataStoreRepositoryFact = DataStoreRepositoryFactBase &
  (
    | {
        readonly category: 'media-and-queue-state';
        readonly stores: readonly ('existing-postgresql' | 'existing-redis')[];
        readonly contents: 'repository-declared';
      }
    | {
        readonly category: 'rate-limit-counter';
        readonly stores: readonly 'upstash-redis'[];
        readonly contents: 'operational-counters-only';
      }
  );

interface InfrastructureRepositoryFactBase {
  readonly kind: 'infrastructure';
  readonly repositoryFactId: RepositoryFactId;
  readonly provenance: RepositoryFactProvenance;
}

type OrdinaryInfrastructureResource =
  | 'background-worker'
  | 'container-service'
  | 'database-custom-extensions'
  | 'database-shared-preload-libraries'
  | 'durable-process-singleton'
  | 'external-network'
  | 'fetch'
  | 'long-lived-tcp'
  | 'long-running-node-worker'
  | 'node-worker-thread'
  | 'persistent-policy-service'
  | 'persistent-redis'
  | 'sidecar'
  | 'stdout-json-regional-archive'
  | 'worker-container';

export type InfrastructureRepositoryFact = InfrastructureRepositoryFactBase &
  (
    | {
        readonly resource: 'additional-self-hosted-service';
        readonly availability: 'available';
        readonly backingStore: 'postgresql';
        readonly maximumAdditionalInstances: 1;
      }
    | {
        readonly resource: OrdinaryInfrastructureResource;
        readonly availability: 'available' | 'unavailable';
        readonly backingStore: 'none';
        readonly maximumAdditionalInstances: null;
      }
  );

export interface TenantRepositoryFact {
  readonly kind: 'tenant';
  readonly repositoryFactId: RepositoryFactId;
  readonly tenantModel: 'multi-tenant' | 'single-tenant' | 'unknown';
  readonly provenance: RepositoryFactProvenance;
}

export type RepositoryFact =
  | CapabilityRepositoryFact
  | CredentialPolicyRepositoryFact
  | DataExclusionRepositoryFact
  | DataLifecycleRepositoryFact
  | DataResidencyRepositoryFact
  | DataShapeRepositoryFact
  | DataStoreRepositoryFact
  | DeploymentRepositoryFact
  | IdentityContextRepositoryFact
  | InfrastructureRepositoryFact
  | NamedVersionRepositoryFact
  | TenantRepositoryFact;

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

export type EvidenceSourceType =
  | 'approved-validation'
  | 'license'
  | 'official-documentation'
  | 'official-release'
  | 'official-repository'
  | 'package-registry'
  | 'security-advisory';

export interface EvidenceProvenance {
  readonly sourceType: EvidenceSourceType;
  readonly sourceUrl: string;
  readonly revision: EvidenceSourceRevision;
  readonly collectedAt: string;
  readonly publishedAt: string | null;
}

export interface EvidenceSourceRevision {
  readonly kind:
    'git-commit' | 'mutable-documentation' | 'release' | 'tag' | 'version';
  readonly value: string;
  readonly immutableUrl: string | null;
}

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
  readonly unknowns: readonly MaterialUnknown[];
  readonly claims: readonly MaterialClaim[];
  readonly hardConstraintConflicts: readonly HardConstraintConflict[];
  readonly rankGroups: readonly RankGroup[];
  readonly rankRelations: readonly ExplicitRankRelation[];
  readonly incomparablePairs: readonly IncomparablePair[];
  readonly evidenceCutoff: string;
  readonly producedAt: string;
  readonly completeness: 'complete' | 'partial-evidence';
}

export interface FitAssessmentExchange {
  readonly request: FitAssessmentRequest;
  readonly result: FitAssessmentResult;
}
