import type {
  CandidateDossierV1,
  EvidenceObservationV1,
} from '@gitblocks/contracts';
import type {
  CandidateIdentityV1,
  CandidateLimitationV1,
  CandidateUnknownV1,
  CapabilityFamilyV1,
} from '@gitblocks/persistence';

export const CAPABILITY_FAMILIES = [
  'authorization',
  'audit-logging',
  'background-jobs',
  'rate-limiting',
  'webhooks',
] as const satisfies readonly CapabilityFamilyV1[];

export type CapabilityFamily = (typeof CAPABILITY_FAMILIES)[number];

export interface CatalogCandidate {
  readonly candidateId: string;
  readonly displayName: string;
  readonly introducedAt: string;
  readonly github: {
    readonly owner: string;
    readonly repository: string;
  };
  readonly npmPackage: string | null;
  readonly primaryCapabilityFamily: CapabilityFamily;
  readonly additionalCapabilityFamilies: readonly CapabilityFamily[];
  readonly rationale: string;
  readonly selectionSources: readonly string[];
  readonly expectedSourceTypes: readonly (
    | 'github-repository'
    | 'github-release'
    | 'github-tag'
    | 'github-license'
    | 'github-community'
    | 'github-file'
    | 'npm-package'
    | 'github-advisory'
  )[];
  readonly status: 'active' | 'archived' | 'moved' | 'negative-control';
  readonly allowlistedFiles: readonly string[];
}

export interface PublicCatalog {
  readonly catalogVersion: 'public-v1';
  readonly publishedAt: string;
  readonly manifestDigest: string;
  readonly candidates: readonly CatalogCandidate[];
}

export type ArtifactKind =
  | 'readme'
  | 'documentation'
  | 'security-policy'
  | 'changelog'
  | 'license'
  | 'contributing';

export type ArtifactRequirement = 'required' | 'optional';

export interface RootReadmeArtifactSelection {
  readonly selectionId: string;
  readonly selector: 'root-readme';
  readonly artifactKind: 'readme';
  readonly requirement: 'optional';
}

export interface PathArtifactSelection {
  readonly selectionId: string;
  readonly selector: 'path';
  readonly path: string;
  readonly artifactKind: Exclude<ArtifactKind, 'readme'>;
  readonly requirement: ArtifactRequirement;
  readonly rationale: string;
}

export type ArtifactSelection =
  RootReadmeArtifactSelection | PathArtifactSelection;

export interface PublicArtifactManifest {
  readonly artifactManifestVersion: 'public-artifacts-v1';
  readonly catalogVersion: 'public-v1';
  readonly catalogDigest: string;
  readonly candidates: readonly {
    readonly candidateId: string;
    readonly selections: readonly ArtifactSelection[];
  }[];
  readonly manifestDigest: string;
}

export interface ArtifactSelectionSource {
  readonly artifactManifestVersion: 'public-artifacts-v1';
  readonly candidates: readonly {
    readonly candidateId: string;
    readonly selections: readonly Omit<
      PathArtifactSelection,
      'selectionId' | 'selector'
    >[];
  }[];
}

export interface GitHubRepositorySource {
  readonly canonicalOwner: string;
  readonly canonicalRepository: string;
  readonly htmlUrl: string;
  readonly description: string | null;
  readonly homepage: string | null;
  readonly topics: readonly string[];
  readonly defaultBranch: string;
  readonly isPublic: boolean;
  readonly isFork: boolean;
  readonly isArchived: boolean;
  readonly pushedAt: string;
  readonly updatedAt: string;
  readonly licenseSpdxId: string | null;
}

export interface GitHubCommitSource {
  readonly sha: string;
  readonly htmlUrl: string;
  readonly committedAt: string;
}

export interface GitHubReleaseSource {
  readonly tag: string;
  readonly htmlUrl: string;
  readonly publishedAt: string;
  readonly isDraft: boolean;
  readonly isPrerelease: boolean;
}

export interface GitHubTagSource {
  readonly name: string;
  readonly commitSha: string;
}

export interface GitHubLicenseSource {
  readonly spdxId: string | null;
  readonly path: string;
  readonly sha: string | null;
  readonly sourceUrl: string;
  readonly immutableUrl: string;
}

export interface GitHubCommunitySource {
  readonly healthPercentage: number;
  readonly hasSecurityPolicy: boolean;
}

export interface RepositoryFileSource {
  readonly path: string;
  readonly sha: string;
  readonly htmlUrl: string;
  readonly text: string;
}

export interface NpmPackageSource {
  readonly name: string;
  readonly latestVersion: string;
  readonly publishedAt: string;
  readonly registryUrl: string;
  readonly repositoryUrl: string | null;
  readonly license: string | null;
  readonly nodeEngine: string | null;
  readonly moduleType: string | null;
  readonly exportShape: 'declared' | 'not-declared';
  readonly deprecated: boolean;
  readonly distTags: Readonly<Record<string, string>>;
}

export interface AdvisorySource {
  readonly advisoryId: string;
  readonly htmlUrl: string;
  readonly publishedAt: string;
  readonly updatedAt: string;
  readonly withdrawnAt: string | null;
  readonly severity: string;
}

export interface AdvisoryCollection {
  readonly advisories: readonly AdvisorySource[];
  readonly complete: boolean;
  readonly limitationCode: string | null;
}

export interface CandidateSourceBundle {
  readonly candidate: CatalogCandidate;
  readonly collectedAt: string;
  readonly repository: GitHubRepositorySource;
  readonly commit: GitHubCommitSource;
  readonly releases: readonly GitHubReleaseSource[];
  readonly tags: readonly GitHubTagSource[];
  readonly license: GitHubLicenseSource | null;
  readonly community: GitHubCommunitySource | null;
  readonly files: readonly RepositoryFileSource[];
  readonly npm: NpmPackageSource | null;
  readonly advisories: AdvisoryCollection;
}

export type CandidateCollectionResult =
  | {
      readonly outcome: 'complete';
      readonly bundle: CandidateSourceBundle;
    }
  | {
      readonly outcome: 'partial';
      readonly incompleteSourceCodes: readonly string[];
    };

export interface ProfileResult {
  readonly identity: CandidateIdentityV1;
  readonly capabilityFamilies: readonly CapabilityFamily[];
  readonly dossier: CandidateDossierV1;
  readonly observations: readonly EvidenceObservationV1[];
  readonly limitations: readonly CandidateLimitationV1[];
  readonly unknowns: readonly CandidateUnknownV1[];
  readonly evidenceCutoff: string;
  readonly snapshotId: string;
  readonly authoritativeTopics: readonly string[];
}

export interface RefreshPlan {
  readonly observationsToAppend: readonly EvidenceObservationV1[];
  readonly supersessions: readonly {
    readonly supersessionId: string;
    readonly supersededEvidenceId: string;
    readonly supersedingEvidenceId: string;
    readonly reasonCode: string;
  }[];
  readonly invalidations: readonly {
    readonly invalidationId: string;
    readonly evidenceId: string;
    readonly reasonCode: string;
  }[];
  readonly unchangedEvidenceIds: readonly string[];
}

export interface IngestionReceiptCandidate {
  readonly candidateId: string;
  readonly outcome: 'created' | 'updated' | 'unchanged' | 'partial' | 'failed';
  readonly snapshotId: string | null;
  readonly evidenceAppended: number;
  readonly evidenceIdempotent: number;
  readonly evidenceSuperseded: number;
  readonly evidenceInvalidated: number;
  readonly limitationCount: number;
  readonly unknownCount: number;
  readonly candidateState: 'created' | 'idempotent' | null;
  readonly snapshotState: 'created' | 'idempotent' | null;
  readonly incompleteSourceCodes: readonly string[];
  readonly safeErrorCode: string | null;
}

export interface IngestionReceipt {
  readonly receiptVersion: 'public-ingestion-receipt/1.0.0';
  readonly catalogVersion: 'public-v1';
  readonly catalogDigest: string;
  readonly profileRulesVersion: 'public-profile-rules/1.0.0';
  readonly runId: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly requestedCandidateCount: number;
  readonly completedCandidateCount: number;
  readonly candidateFamilyProfileCount: number;
  readonly providerRequestCounts: {
    readonly github: number;
    readonly npm: number;
  };
  readonly candidatesCreated: number;
  readonly candidatesIdempotent: number;
  readonly evidenceCreated: number;
  readonly evidenceIdempotent: number;
  readonly snapshotsCreated: number;
  readonly snapshotsIdempotent: number;
  readonly supersessionCount: number;
  readonly invalidationCount: number;
  readonly limitationCount: number;
  readonly unknownCount: number;
  readonly failuresByCode: readonly {
    readonly code: string;
    readonly count: number;
  }[];
  readonly providerRateLimit: {
    readonly limit: number;
    readonly remaining: number;
    readonly resetAt: string;
  } | null;
  readonly databaseMigrationVersion: number;
  readonly idempotencyComparison: {
    readonly priorReceiptDigest: string;
    readonly identicalSnapshotCount: number;
    readonly newEvidenceCount: number;
  } | null;
  readonly outcomeCounts: Readonly<
    Record<'created' | 'updated' | 'unchanged' | 'partial' | 'failed', number>
  >;
  readonly candidates: readonly IngestionReceiptCandidate[];
  readonly receiptDigest: string;
}

export interface ArtifactReceiptCandidate {
  readonly candidateId: string;
  readonly outcome: 'created' | 'idempotent' | 'failed';
  readonly artifactSetId: string | null;
  readonly artifactCount: number;
  readonly chunkCount: number;
  readonly absenceCount: number;
  readonly operationalDecodedBytes: number;
  readonly materializedArtifactBytes: number;
  readonly inserted: {
    readonly artifacts: number;
    readonly chunks: number;
    readonly artifactSets: number;
    readonly entries: number;
  };
  readonly materializationDigest: string | null;
  readonly safeErrorCode: string | null;
}

export interface ArtifactReceipt {
  readonly receiptVersion: 'public-artifact-receipt/1.0.0';
  readonly catalogVersion: 'public-v1';
  readonly catalogDigest: string;
  readonly artifactManifestVersion: 'public-artifacts-v1';
  readonly artifactManifestDigest: string;
  readonly collectorVersion: 'repository-artifacts-v1';
  readonly chunkerVersion: 'exact-lines-v1';
  readonly runId: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly requestedCandidateCount: number;
  readonly completedCandidateCount: number;
  readonly artifactCount: number;
  readonly chunkCount: number;
  readonly absenceCount: number;
  readonly operationalDecodedBytes: number;
  readonly materializedArtifactBytes: number;
  readonly githubRequestCount: number;
  readonly providerRateLimit: {
    readonly limit: number;
    readonly remaining: number;
    readonly resetAt: string;
  } | null;
  readonly databaseMigrationVersion: number;
  readonly inserted: {
    readonly artifacts: number;
    readonly chunks: number;
    readonly artifactSets: number;
    readonly entries: number;
  };
  readonly failuresByCode: readonly {
    readonly code: string;
    readonly count: number;
  }[];
  readonly outcomeCounts: Readonly<
    Record<'created' | 'idempotent' | 'failed', number>
  >;
  readonly rerunComparison: {
    readonly priorReceiptDigest: string;
    readonly identicalArtifactSetCount: number;
    readonly identicalMaterializationCount: number;
    readonly zeroNewRowCandidateCount: number;
    readonly newRowCount: number;
  } | null;
  readonly candidates: readonly ArtifactReceiptCandidate[];
  readonly receiptDigest: string;
}

export interface TransportMetrics {
  readonly providerRequestCounts: {
    readonly github: number;
    readonly npm: number;
  };
  readonly githubRateLimit: {
    readonly limit: number;
    readonly remaining: number;
    readonly resetAt: string;
  } | null;
}

export interface SafeTelemetryEvent {
  readonly eventName:
    | 'ingestion.request'
    | 'ingestion.candidate'
    | 'ingestion.batch'
    | 'artifact.candidate'
    | 'artifact.batch';
  readonly correlationId: string;
  readonly candidateId: string | null;
  readonly provider: 'github' | 'npm' | 'persistence' | null;
  readonly operation: string;
  readonly outcome: 'started' | 'succeeded' | 'failed' | 'partial' | 'retried';
  readonly attempt: number | null;
  readonly durationMilliseconds: number | null;
  readonly safeErrorCode: string | null;
}

export type IngestionObserver = (event: SafeTelemetryEvent) => void;

export interface Clock {
  now(): Date;
}

export const SYSTEM_CLOCK: Clock = {
  now: () => new Date(),
};
