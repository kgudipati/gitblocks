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
