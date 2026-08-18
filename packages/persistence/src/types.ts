import type {
  CandidateDossierV1,
  CandidateRetrievalMetadataAuthorityV1,
  DeterministicCandidateProfileAuthorityV1,
  EvidenceObservationV1,
  ModelExecutionV1,
  RepositoryArtifactChunkV1,
  RepositoryArtifactSetV1,
  RepositoryArtifactV1,
  RepositoryInterviewRequestV1,
  RepositoryInterviewV1,
} from '@gitblocks/contracts';

export type CandidateIdentityV1 = CandidateDossierV1['identity'];
export type CandidateLimitationV1 = CandidateDossierV1['limitations'][number];
export type CandidateUnknownV1 = CandidateDossierV1['unknowns'][number];
export type CapabilityFamilyV1 = CandidateDossierV1['capabilityFamily'];

export interface PersistenceClientConfig {
  readonly host: string;
  readonly port: number;
  readonly database: string;
  readonly username: string;
  readonly password: string;
  readonly ssl: false | 'allow' | 'prefer' | 'require' | 'verify-full';
  readonly maximumConnections?: number;
  readonly connectTimeoutMilliseconds?: number;
  readonly idleTimeoutMilliseconds?: number;
  readonly statementTimeoutMilliseconds?: number;
  readonly lockTimeoutMilliseconds?: number;
}

export interface OperationControl {
  readonly signal?: AbortSignal;
  readonly statementTimeoutMilliseconds?: number;
  readonly lockTimeoutMilliseconds?: number;
}

export interface PutCatalogCandidateCommand {
  readonly identity: CandidateIdentityV1;
  readonly createdAt: string;
}

export interface SetCandidateCapabilityFamiliesCommand {
  readonly candidateId: string;
  readonly capabilityFamilies: readonly CapabilityFamilyV1[];
}

export interface AppendEvidenceObservationCommand {
  readonly observation: EvidenceObservationV1;
  readonly createdAt: string;
}

export interface AppendCandidateLimitationCommand {
  readonly limitation: CandidateLimitationV1;
  readonly createdAt: string;
}

export interface AppendCandidateUnknownCommand {
  readonly unknown: CandidateUnknownV1;
  readonly createdAt: string;
}

interface EvidenceLifecycleCommand {
  readonly candidateId: string;
  readonly reasonCode: string;
  readonly effectiveAt: string;
  readonly createdAt: string;
}

export interface RecordEvidenceSupersessionCommand extends EvidenceLifecycleCommand {
  readonly supersessionId: string;
  readonly supersededEvidenceId: string;
  readonly supersedingEvidenceId: string;
}

export interface RecordEvidenceInvalidationCommand extends EvidenceLifecycleCommand {
  readonly invalidationId: string;
  readonly evidenceId: string;
}

export interface CreateCandidateDossierSnapshotCommand {
  readonly snapshotId: string;
  readonly dossier: CandidateDossierV1;
  readonly evidenceCutoff: string;
  readonly createdAt: string;
}

export interface LoadCandidateDossierSnapshotCommand {
  readonly snapshotId: string;
}

export interface SelectActiveDossierMaterialCommand {
  readonly candidateId: string;
  readonly evidenceCutoff: string;
}

export interface LoadActiveCandidateDossierCommand {
  readonly candidateId: string;
  readonly expectedCapabilityFamily: CapabilityFamilyV1;
  readonly evidenceCutoff: string;
}

export interface ActiveDossierMaterial {
  readonly observations: readonly EvidenceObservationV1[];
  readonly limitations: readonly CandidateLimitationV1[];
  readonly unknowns: readonly CandidateUnknownV1[];
}

export interface MigrationRecord {
  readonly version: number;
  readonly name: string;
  readonly checksum: string;
}

export interface MigrationVerification {
  readonly postgresqlVersion: string;
  readonly migrations: readonly MigrationRecord[];
}

export interface PublishServingCatalogSnapshotCommand {
  readonly candidateProfileAuthority: DeterministicCandidateProfileAuthorityV1;
  readonly candidateRetrievalMetadataAuthority: CandidateRetrievalMetadataAuthorityV1;
  readonly publishedAt: string;
}

export interface PublishServingCatalogSnapshotResult {
  readonly status: 'created' | 'idempotent';
  readonly snapshotId: string;
  readonly snapshotRecordDigest: string;
  readonly publishedAt: string;
  readonly candidateCount: 150;
}

export type LoadServingCatalogSnapshotCommand =
  | { readonly selection: 'current' }
  | { readonly selection: 'snapshot-id'; readonly snapshotId: string };

export type ServingCandidateRetrievalMetadataBinding = Pick<
  CandidateRetrievalMetadataAuthorityV1,
  | 'authorityVersion'
  | 'catalogVersion'
  | 'catalogDigest'
  | 'providerPolicyVersion'
  | 'providerPolicyDigest'
  | 'sourceProviderPolicyVersion'
  | 'sourceProviderPolicyDigest'
  | 'sourceOperation'
>;

export interface LoadedServingCatalogSnapshot {
  readonly snapshotId: string;
  readonly snapshotRecordDigest: string;
  readonly publishedAt: string;
  readonly candidateCount: 150;
  readonly candidateProfileAuthority: DeterministicCandidateProfileAuthorityV1;
  readonly candidateRetrievalMetadataAuthority: CandidateRetrievalMetadataAuthorityV1;
  readonly expectedCandidateRetrievalMetadataAuthorityBinding: ServingCandidateRetrievalMetadataBinding;
}

export interface RepositoryArtifactPublication {
  readonly artifact: RepositoryArtifactV1;
  readonly chunks: readonly RepositoryArtifactChunkV1[];
}

export interface PublishRepositoryArtifactSetCommand {
  readonly artifactSet: RepositoryArtifactSetV1;
  readonly artifacts: readonly RepositoryArtifactPublication[];
}

export interface PublishRepositoryArtifactSetResult {
  readonly artifactSet: RepositoryArtifactSetV1;
  readonly inserted: {
    readonly artifacts: number;
    readonly chunks: number;
    readonly artifactSets: number;
    readonly entries: number;
  };
}

export interface LoadRepositoryArtifactCommand {
  readonly artifactId: string;
  readonly chunkerVersion: 'exact-lines-v1';
}

export interface LoadedRepositoryArtifact {
  readonly artifact: RepositoryArtifactV1;
  readonly chunks: readonly RepositoryArtifactChunkV1[];
}

export interface LoadRepositoryArtifactSetCommand {
  readonly artifactSetId: string;
}

export interface LoadCandidateRepositoryArtifactMaterialCommand {
  readonly candidateId: string;
  readonly expectedCatalogVersion: 'public-v1';
  readonly expectedCatalogDigest: string;
  readonly commitSha: string;
  readonly evidenceCutoff: string;
}

export interface CandidateRepositoryArtifactMaterial {
  readonly artifactSet: RepositoryArtifactSetV1;
  readonly artifacts: readonly LoadedRepositoryArtifact[];
}

export interface PublishRepositoryInterviewExchangeCommand {
  readonly request: RepositoryInterviewRequestV1;
  readonly execution: ModelExecutionV1;
  readonly interview: RepositoryInterviewV1 | null;
}

export interface RepositoryInterviewStoredExchange {
  readonly request: RepositoryInterviewRequestV1;
  readonly execution: ModelExecutionV1;
  readonly interview: RepositoryInterviewV1 | null;
}

export interface RepositoryInterviewReusableExchange {
  readonly request: RepositoryInterviewRequestV1;
  readonly execution: ModelExecutionV1;
  readonly interview: RepositoryInterviewV1;
}

export interface PublishRepositoryInterviewExchangeResult {
  readonly status: 'created' | 'idempotent';
  readonly record: RepositoryInterviewStoredExchange;
  readonly inserted: {
    readonly requests: number;
    readonly executions: number;
    readonly interviews: number;
    readonly citations: number;
    readonly claims: number;
    readonly limitations: number;
    readonly contradictions: number;
    readonly unknowns: number;
  };
}

export interface FindReusableRepositoryInterviewCommand {
  readonly requestIdentityDigest: string;
  readonly modelProfileDigest: string;
  readonly reuseKeyDigest: string;
}

export type LoadRepositoryInterviewExchangeCommand =
  | {
      readonly by: 'execution-id';
      readonly executionId: string;
    }
  | {
      readonly by: 'interview-id';
      readonly interviewId: string;
    };
