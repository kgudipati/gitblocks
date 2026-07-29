import type {
  CandidateDossierV1,
  EvidenceObservationV1,
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
  readonly ssl: false | 'require';
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

export type StorageScope =
  | {
      readonly kind: 'public';
    }
  | {
      readonly kind: 'tenant';
      readonly tenantId: string;
      readonly expiresAt: string;
    };

export interface CreateTenantCommand {
  readonly tenantId: string;
  readonly createdAt: string;
}

export interface PutCatalogCandidateCommand {
  readonly scope: StorageScope;
  readonly identity: CandidateIdentityV1;
  readonly createdAt: string;
}

export interface SetCandidateCapabilityFamiliesCommand {
  readonly scope: StorageScope;
  readonly candidateId: string;
  readonly capabilityFamilies: readonly CapabilityFamilyV1[];
}

export interface AppendEvidenceObservationCommand {
  readonly scope: StorageScope;
  readonly observation: EvidenceObservationV1;
  readonly createdAt: string;
}

export interface AppendCandidateLimitationCommand {
  readonly scope: StorageScope;
  readonly limitation: CandidateLimitationV1;
  readonly createdAt: string;
}

export interface AppendCandidateUnknownCommand {
  readonly scope: StorageScope;
  readonly unknown: CandidateUnknownV1;
  readonly createdAt: string;
}

interface EvidenceLifecycleCommand {
  readonly scope: StorageScope;
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
  readonly scope: StorageScope;
  readonly snapshotId: string;
  readonly dossier: CandidateDossierV1;
  readonly evidenceCutoff: string;
  readonly createdAt: string;
}

export interface LoadCandidateDossierSnapshotCommand {
  readonly scope: StorageScope;
  readonly snapshotId: string;
}

export interface SelectActiveDossierMaterialCommand {
  readonly scope: StorageScope;
  readonly candidateId: string;
  readonly evidenceCutoff: string;
  readonly limit: number;
  readonly afterEvidenceId?: string;
}

export interface ActiveDossierMaterial {
  readonly observations: readonly EvidenceObservationV1[];
  readonly limitations: readonly CandidateLimitationV1[];
  readonly unknowns: readonly CandidateUnknownV1[];
}

export interface PurgeExpiredTenantDataCommand {
  readonly tenantId: string;
  readonly expiresBeforeOrAt: string;
  readonly batchSize: number;
}

export interface PurgeExpiredTenantDataResult {
  readonly deletedSnapshots: number;
  readonly deletedCandidates: number;
}

export interface DeleteTenantDataCommand {
  readonly tenantId: string;
  readonly deletedAt: string;
  readonly reasonCode: string;
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
