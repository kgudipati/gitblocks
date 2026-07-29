export {
  closePersistenceClient,
  createPersistenceClient,
  type PersistenceClient,
} from './client.ts';
export { PersistenceError, type PersistenceErrorCode } from './errors.ts';
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
  OperationControl,
  PersistenceClientConfig,
  PutCatalogCandidateCommand,
  RecordEvidenceInvalidationCommand,
  RecordEvidenceSupersessionCommand,
  SelectActiveDossierMaterialCommand,
  SetCandidateCapabilityFamiliesCommand,
} from './types.ts';
