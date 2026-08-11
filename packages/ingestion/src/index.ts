export {
  StableIdRegistry,
  stableId,
  canonicalizeJson,
} from './canonical-json.ts';
export {
  IngestionError,
  asSafeErrorCode,
  providerOutcomeClass,
  type IngestionErrorCode,
  type ProviderOutcomeClass,
} from './errors.ts';
export {
  digestCatalog,
  manifestWithDigest,
  parsePublicCatalog,
} from './manifest.ts';
export {
  catalogCandidateCapabilityFamilies,
  catalogCandidateIdentity,
} from './catalog-persistence.ts';
export {
  createPublicCatalogSeedPlan,
  PUBLIC_CATALOG_V1_CANDIDATE_COUNT,
  PUBLIC_CATALOG_V1_DIGEST,
  seedPublicCatalogV1,
  type CatalogSeedPersistencePort,
  type PublicCatalogSeedEntry,
  type PublicCatalogSeedPlan,
  type PublicCatalogSeedSummaryV1,
} from './catalog-seed.ts';
export {
  chunkRepositoryArtifact,
  verifyRepositoryArtifactChunks,
} from './artifact-chunking.ts';
export {
  createArtifactDecodedByteBudget,
  type ArtifactDecodedByteBudget,
  type ArtifactDecodedByteBudgetScope,
} from './artifact-byte-budget.ts';
export {
  collectPublicRepositoryArtifacts,
  type CollectPublicRepositoryArtifactsConfig,
} from './artifact-batch.ts';
export {
  createRepositoryArtifactCollector,
  type CollectRepositoryArtifactsCommand,
  type RepositoryArtifactCollectorConfig,
  type RepositoryArtifactCollector,
} from './artifact-provider.ts';
export {
  createArtifactReceipt,
  parseCompleteArtifactReceiptTextV1,
  parseCompleteArtifactReceiptV1,
  parseArtifactReceipt,
  type CompleteArtifactReceiptAuthorityV1,
} from './artifact-receipt.ts';
export {
  artifactManifestDigest,
  artifactManifestWithDigest,
  buildArtifactManifest,
  isSafeArtifactPath,
  parseArtifactSelectionSource,
  parsePublicArtifactManifest,
  selectionId,
} from './artifact-manifest.ts';
export { persistCandidateProfile, loadPriorMaterial } from './persist.ts';
export {
  profileCandidate,
  repositoryFileTopic,
  selectCurrentRelease,
} from './profile.ts';
export {
  CANDIDATE_PROFILE_COVERAGE_REPORT_VERSION,
  buildCandidateProfileArtifacts,
  projectCandidateProfile,
  type CandidateProfileCoverageReportV1,
  type CandidateProfileGeneratedArtifacts,
} from './candidate-profile-projection.ts';
export {
  CANDIDATE_AUTHORITY_CANDIDATE_COUNT,
  CANDIDATE_AUTHORITY_EVENTUAL_ROOT_PATH,
  CANDIDATE_AUTHORITY_FIELD_PLAN_DIGEST,
  CANDIDATE_AUTHORITY_FIELD_PLAN_PATH,
  CANDIDATE_AUTHORITY_FIELD_PLAN_VERSION,
  CANDIDATE_AUTHORITY_PLANNED_READY_COUNT,
  CANDIDATE_AUTHORITY_READY_MINIMUM,
  CANDIDATE_AUTHORITY_READY_PERCENTAGE,
  CANDIDATE_AUTHORITY_ROOT_VERSION,
  CANDIDATE_AUTHORITY_SOURCE_POLICY_PATH,
  CANDIDATE_AUTHORITY_SOURCE_POLICY_DIGEST,
  CANDIDATE_AUTHORITY_SOURCE_POLICY_VERSION,
  RANKING_DECISION_FIELD_IDS,
  candidateAuthorityRootSemanticDigest,
  parseCandidateAuthorityFieldPlan,
  parseCandidateAuthoritySourcePolicy,
  type CandidateAuthorityBreadthGroup,
  type CandidateAuthorityDecisionFieldId,
  type CandidateAuthorityEvidenceDimension,
  type CandidateAuthorityFieldPlan,
  type CandidateAuthorityFieldPlanEntry,
  type CandidateAuthorityFieldPosture,
  type CandidateAuthorityRootV1,
  type CandidateAuthoritySourceOperation,
  type CandidateAuthoritySourcePolicy,
} from './candidate-authority-contracts.ts';
export {
  projectCandidateAuthorityDossier,
  type CandidateAuthorityDossierProjection,
  type CandidateAuthorityEvidenceBinding,
} from './candidate-authority-evidence.ts';
export {
  CANDIDATE_AUTHORITY_PARTIAL_EVIDENCE_VERSION,
  CANDIDATE_AUTHORITY_PARTIAL_FACT_CODES,
  createCandidateAuthorityPartialFieldEvidence,
  projectPartialFieldEvidenceToDossier,
  type CandidateAuthorityPartialDossierProjection,
  type CandidateAuthorityPartialFactCode,
  type CandidateAuthorityPartialFieldEvidence,
} from './candidate-authority-partial-evidence.ts';
export {
  extractComposeServiceFact,
  extractPackageDependencyFacts,
  extractPackageEcosystemFact,
  extractPublishedPackageAdoptionFact,
  type CandidateAuthorityPartialRuleResult,
} from './candidate-authority-partial-rules.ts';
export {
  CANDIDATE_AUTHORITY_EXTRACTION_ELIGIBLE_COUNT,
  CANDIDATE_AUTHORITY_FIELD_PLAN_V2_DIGEST,
  CANDIDATE_AUTHORITY_FIELD_PLAN_V2_PATH,
  CANDIDATE_AUTHORITY_FIELD_PLAN_V2_VERSION,
  CANDIDATE_AUTHORITY_FULL_CLOSURE_COUNT,
  CANDIDATE_AUTHORITY_READINESS_POLICY_DIGEST,
  CANDIDATE_AUTHORITY_READINESS_POLICY_PATH,
  CANDIDATE_AUTHORITY_ROOT_V2_VERSION,
  CANDIDATE_AUTHORITY_SOURCE_POLICY_V2_DIGEST,
  CANDIDATE_AUTHORITY_SOURCE_POLICY_V2_PATH,
  CANDIDATE_AUTHORITY_SOURCE_POLICY_V2_VERSION,
  candidateAuthorityRootV2SemanticDigest,
  parseCandidateAuthorityFieldPlanV2,
  parseCandidateAuthorityReadinessPolicyV2,
  parseCandidateAuthoritySourcePolicyV2,
  qualifiesDeterministicExtraction,
  type CandidateAuthorityCellOrigin,
  type CandidateAuthorityFieldPlanEntryV2,
  type CandidateAuthorityFieldPlanV2,
  type CandidateAuthorityFieldPostureV2,
  type CandidateAuthorityReadinessPolicyV2,
  type CandidateAuthorityRootV2,
  type CandidateAuthoritySourcePolicyV2,
} from './candidate-authority-readiness.ts';
export {
  projectCandidateAuthorityAdvisoryState,
  projectCandidateAuthorityMaintenance,
  projectCandidateAuthorityReleaseState,
  projectCandidateAuthoritySecurityPolicyPresence,
  resolveCandidateAuthorityRuleConflict,
  type CandidateAuthorityAdvisoryValue,
  type CandidateAuthorityMaintenanceValue,
  type CandidateAuthorityReleaseValue,
  type CandidateAuthorityRuleResult,
} from './candidate-authority-rules.ts';
export {
  collectCandidateSources,
  providerRequestBudget,
  type ProviderTransport,
  type PublicProviderConfig,
} from './providers.ts';
export {
  PROFILE_MATERIALIZATION_AUTHORIZED_FIELD_IDS,
  PROFILE_MATERIALIZATION_ACCEPTED_BINDINGS,
  PROFILE_MATERIALIZATION_COVERAGE_VERSION,
  PROFILE_MATERIALIZATION_OPERATIONS,
  PROFILE_MATERIALIZATION_OPERATOR_VERSION,
  PROFILE_MATERIALIZATION_PERSISTENCE_PROOF_VERSION,
  PROFILE_MATERIALIZATION_PROJECTION_VERSION,
  PROFILE_MATERIALIZATION_PROVIDER_POLICY_VERSION,
  PROFILE_MATERIALIZATION_RECEIPT_VERSION,
  PROFILE_MATERIALIZATION_SOURCE_AUTHORITY_VERSION,
  PROFILE_MATERIALIZATION_SOURCE_TYPES,
  createProfileMaterializationReceipt,
  parseProfileMaterializationReceipt,
  type ProfileMaterializationAuthorizedFieldId,
  type ProfileMaterializationOperation,
  type ProfileMaterializationPersistenceCounts,
  type ProfileMaterializationPersistenceEntry,
  type ProfileMaterializationPersistenceProof,
  type ProfileMaterializationProviderOperationPolicy,
  type ProfileMaterializationProviderPolicy,
  type ProfileMaterializationReceipt,
  type ProfileMaterializationSourceAuthority,
  type ProfileMaterializationSourceRecord,
  type ProfileMaterializationSourceType,
} from './profile-materialization-contracts.ts';
export {
  PROFILE_MATERIALIZATION_PROVIDER_POLICY_PATH,
  deriveProfileMaterializationRequestBudget,
  operationPolicy,
  parseProfileMaterializationProviderPolicy,
  validateProfileMaterializationProviderPolicy,
} from './profile-materialization-policy.ts';
export {
  createProfileMaterializationSourceAuthority,
  createProfileMaterializationSourceRecord,
  parseProfileMaterializationSourceAuthority,
  reconcileProfileMaterializationSourceAuthority,
  sourceAuthoritySemanticDigest,
  sourceRecordContentDigest,
  type CreateProfileMaterializationSourceAuthorityInput,
  type ProfileMaterializationSourceRecordInput,
} from './profile-materialization-source-authority.ts';
export {
  attachProfileMaterializationEvidenceIds,
  createProfileMaterializationPersistenceProof,
  deriveProfileMaterializationLiveIdempotency,
  parseProfileMaterializationPersistenceProof,
  persistenceEntryFromResult,
  persistenceProofCounts,
  qualifiedNotPersistedEntry,
  type ProfileMaterializationPersistenceProofInput,
} from './profile-materialization-persistence-proof.ts';
export {
  collectProfileMaterializationSources,
  collectProfileMaterializationRepositoryMetadata,
  mapProfilePrimaryLanguage,
  parseProfileMaterializationCommunityResponse,
  parseProfileMaterializationRepositoryResponse,
  projectForkUpstreamState,
  type ProfileMaterializationCollectionResult,
  type ProfileMaterializationProviderConfig,
  type ProfileMaterializationRepositorySource,
} from './profile-materialization-providers.ts';
export {
  collectCandidateRetrievalMetadataAuthority,
  type CandidateRetrievalMetadataCollectorConfig,
} from './candidate-retrieval-metadata-collector.ts';
export {
  CANDIDATE_RETRIEVAL_METADATA_AUTHORITY_PATH,
  CANDIDATE_RETRIEVAL_METADATA_FUTURE_COLLECTION_COMMAND,
  CANDIDATE_RETRIEVAL_METADATA_GITHUB_TOKEN_ENVIRONMENT,
  CANDIDATE_RETRIEVAL_METADATA_PROVIDER_POLICY_PATH,
  CANDIDATE_RETRIEVAL_METADATA_RETAINED_FIELDS,
  CANDIDATE_RETRIEVAL_METADATA_SOURCE_POLICY_PATH,
  CANDIDATE_RETRIEVAL_METADATA_STAGING_PATH,
  CANDIDATE_RETRIEVAL_METADATA_VALIDATION_COMMAND,
  parseCandidateRetrievalMetadataProviderPolicy,
  type CandidateRetrievalMetadataCollectionEnvelope,
  type CandidateRetrievalMetadataProviderPolicy,
} from './candidate-retrieval-metadata-policy.ts';
export {
  CANDIDATE_RETRIEVAL_METADATA_CATALOG_PATH,
  CANDIDATE_RETRIEVAL_METADATA_COLLECTION_STAGES,
  CANDIDATE_RETRIEVAL_METADATA_INPUT_MAX_BYTES,
  CANDIDATE_RETRIEVAL_METADATA_VALIDATION_STAGES,
  CandidateRetrievalMetadataOperationFailure,
  executeCandidateRetrievalMetadataCollection,
  preflightCandidateRetrievalMetadataCollection,
  renderCandidateRetrievalMetadataCliFailure,
  validateCandidateRetrievalMetadataAuthority,
  type CandidateRetrievalMetadataCollectionEffects,
  type CandidateRetrievalMetadataCollectionStage,
  type CandidateRetrievalMetadataOperationStage,
  type CandidateRetrievalMetadataPreflightEffects,
  type CandidateRetrievalMetadataPreflightResult,
  type CandidateRetrievalMetadataSafeErrorCode,
  type CandidateRetrievalMetadataValidationEffects,
  type CandidateRetrievalMetadataValidationResult,
  type CandidateRetrievalMetadataValidationStage,
} from './candidate-retrieval-metadata-runner.ts';
export {
  materializeCandidateProfile,
  materializeCandidateProfiles,
  type MaterializedCandidateProfileAuthority,
} from './candidate-profile-materialization.ts';
export {
  ACCEPTED_OFFLINE_PROFILE_AUTHORITY_DIGEST,
  ACCEPTED_OFFLINE_PROFILE_COVERAGE_DIGEST,
  buildProfileMaterializationArtifacts,
  compareProfileMaterializationCoverage,
  parseProfileMaterializationCoverage,
  type ProfileMaterializationArtifacts,
  type ProfileMaterializationCoverageReport,
} from './profile-materialization-coverage.ts';
export {
  buildProfileMaterializationReceipt,
  compareProfileMaterializationSources,
  controlledFailureCounts,
  renderProfileMaterializationCompletion,
  sourceOutcomeCounts,
  sourceRecordCounts,
  validateProfileMaterializationCompletion,
  validateProfileMaterializationReceipt,
  type ProfileMaterializationSourceDrift,
} from './profile-materialization-receipt.ts';
export {
  EXECUTE_STAGES,
  PROFILE_MATERIALIZATION_CREDENTIAL_NAMES,
  PROFILE_MATERIALIZATION_FIXED_PATHS,
  PROFILE_MATERIALIZATION_LIVE_ACKNOWLEDGEMENT,
  executeProfileMaterialization,
  ProfileMaterializationExecuteFailure,
  parseProfileMaterializationArguments,
  preflightProfileMaterialization,
  renderProfileMaterializationCliFailure,
  renderProfileMaterializationExecuteSuccess,
  verifyProfileMaterializationEvidence,
  type ProfileMaterializationArguments,
  type ProfileMaterializationCompletionEvidence,
  type ProfileMaterializationCredentials,
  type ProfileMaterializationExecuteStage,
  type ProfileMaterializationDatabaseProof,
  type ProfileMaterializationLiveEffects,
  type ProfileMaterializationPreflightEffects,
  type ProfileMaterializationPreflightResult,
} from './profile-materialization-runner.ts';
export { planCandidateRefresh } from './refresh.ts';
export { createIngestionReceipt, parseIngestionReceipt } from './receipt.ts';
export {
  abortableSleep,
  createTransport,
  type JsonResponse,
  type TransportConfig,
  type TransportRequest,
} from './transport.ts';
export { ingestPublicCatalog, type IngestCatalogConfig } from './batch.ts';
export {
  CAPABILITY_FAMILIES,
  SYSTEM_CLOCK,
  type AdvisoryCollection,
  type AdvisorySource,
  type ArtifactKind,
  type ArtifactReceipt,
  type ArtifactReceiptCandidate,
  type ArtifactRequirement,
  type ArtifactSelection,
  type ArtifactSelectionSource,
  type CandidateSourceBundle,
  type CandidateCollectionResult,
  type CatalogCandidate,
  type Clock,
  type GitHubCommitSource,
  type GitHubCommunitySource,
  type GitHubLicenseSource,
  type GitHubReleaseSource,
  type GitHubRepositorySource,
  type GitHubTagSource,
  type IngestionObserver,
  type IngestionReceipt,
  type IngestionReceiptCandidate,
  type NpmPackageSource,
  type ProfileResult,
  type PublicArtifactManifest,
  type PublicCatalog,
  type RefreshPlan,
  type RepositoryFileSource,
  type SafeTelemetryEvent,
  type TransportMetrics,
} from './types.ts';
