export {
  closePersistenceClient,
  createPersistenceClient,
  type PersistenceClient,
} from './client.ts';
export { PersistenceError, type PersistenceErrorCode } from './errors.ts';
export {
  loadRepositoryArtifact,
  loadRepositoryArtifactSet,
  publishRepositoryArtifactSet,
} from './artifact-operations.ts';
export {
  applyMigrations,
  knownMigrationInventory,
  verifyMigrations,
} from './migrations.ts';
export {
  appendCandidateLimitation,
  appendCandidateUnknown,
  appendEvidenceObservation,
  createCandidateDossierSnapshot,
  loadCandidateDossierSnapshot,
  putCatalogCandidate,
  recordEvidenceInvalidation,
  recordEvidenceSupersession,
  selectActiveDossierMaterial,
  setCandidateCapabilityFamilies,
} from './operations.ts';
export type {
  ActiveDossierMaterial,
  AppendCandidateLimitationCommand,
  AppendCandidateUnknownCommand,
  AppendEvidenceObservationCommand,
  CandidateIdentityV1,
  CandidateLimitationV1,
  CandidateUnknownV1,
  CapabilityFamilyV1,
  CreateCandidateDossierSnapshotCommand,
  LoadCandidateDossierSnapshotCommand,
  MigrationRecord,
  MigrationVerification,
  LoadedRepositoryArtifact,
  LoadRepositoryArtifactCommand,
  LoadRepositoryArtifactSetCommand,
  OperationControl,
  PersistenceClientConfig,
  PutCatalogCandidateCommand,
  PublishRepositoryArtifactSetCommand,
  PublishRepositoryArtifactSetResult,
  RecordEvidenceInvalidationCommand,
  RecordEvidenceSupersessionCommand,
  SelectActiveDossierMaterialCommand,
  SetCandidateCapabilityFamiliesCommand,
  RepositoryArtifactPublication,
} from './types.ts';
