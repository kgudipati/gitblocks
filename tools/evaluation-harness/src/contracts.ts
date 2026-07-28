export type CapabilityFamily =
  | 'authorization'
  | 'audit-logging'
  | 'background-jobs'
  | 'rate-limiting'
  | 'webhooks';

export type Outcome =
  'recommend' | 'no-viable-candidate' | 'insufficient-evidence';

export type DispositionLabel =
  'recommended' | 'viable' | 'rejected' | 'insufficient-evidence';

export interface NamedVersion {
  name: string;
  version: string;
}

export interface Candidate {
  candidateId: string;
  project: string;
  package: string | null;
  repository: string;
}

export interface CatalogItem {
  id: string;
  description: string;
}

export interface EvaluationCase {
  schemaVersion: '1.0.0';
  caseId: string;
  capabilityFamily: CapabilityFamily;
  userRequest: string;
  successConditions: string[];
  repositoryProfile: {
    runtime: NamedVersion;
    framework: NamedVersion;
    packageManager: NamedVersion;
    database: NamedVersion;
    orm: NamedVersion & { name: 'prisma' | 'drizzle' };
    deployment: {
      topology: 'serverless' | 'long-running-container' | 'long-running-server';
      workerCapability: 'capable' | 'incapable';
      replicas: number;
      region: string;
    };
    dependencies: NamedVersion[];
    hasRedis: boolean;
    tenantModel: 'single-tenant' | 'multi-tenant';
    identityFacts: string[];
    dataFacts: string[];
    operationalFacts: string[];
  };
  hardConstraints: {
    constraintId: string;
    reasonCode: string;
    statement: string;
  }[];
  preferences: { preferenceId: string; statement: string }[];
  candidates: Candidate[];
  evidenceIds: string[];
  reasonCodes: CatalogItem[];
  unknowns: CatalogItem[];
  difficulty: 'medium' | 'hard';
  failureModes: string[];
  authoredAt: string;
  evidenceCutoff: string;
}

export interface EvidenceObservation {
  evidenceId: string;
  subjectType: 'candidate' | 'case';
  candidateId: string | null;
  sourceType:
    | 'official-documentation'
    | 'official-repository'
    | 'official-release'
    | 'package-registry'
    | 'security-advisory'
    | 'license'
    | 'case-local-fact';
  sourceUrl: string;
  collectedAt: string;
  publishedAt: string | null;
  observation: string;
  freshnessScope: string;
  directness: 'direct' | 'case-local';
  limitation: string;
}

export interface EvidenceSet {
  schemaVersion: '1.0.0';
  caseId: string;
  evidenceCutoff: string;
  observations: EvidenceObservation[];
}

export interface CandidateDisposition {
  candidateId: string;
  disposition: DispositionLabel;
  reasonCodes: string[];
  evidenceIds: string[];
  rationale?: string;
}

export interface RankRelation {
  higherCandidateId: string;
  lowerCandidateId: string;
}

export interface GoldResult {
  schemaVersion: '1.0.0';
  caseId: string;
  outcome: Outcome;
  allowedAlternativeOutcomes: Outcome[];
  dispositions: CandidateDisposition[];
  rankGroups: string[][];
  rankRelations: RankRelation[];
  incomparablePairs: string[][];
  hardConstraintConflicts: {
    candidateId: string;
    constraintId: string;
    reasonCode: string;
    evidenceIds: string[];
  }[];
  requiredUnknownIds: string[];
  requiredEvidenceIds: string[];
  requiredReasonCodes: string[];
  rationaleNotes: string[];
  evidenceCutoff: string;
  provenance: {
    status: 'proposed';
    authoringSession: string;
    independentReviewStatus: 'not-reviewed';
    independentReviewer: null;
    reviewedAt: null;
  };
}

export interface Prediction {
  schemaVersion: '1.0.0';
  caseId: string;
  outcome: Outcome;
  candidates: CandidateDisposition[];
  rankGroups: string[][];
  rankRelations: RankRelation[];
  disclosedUnknownIds: string[];
  run: {
    runId: string;
    producer: string;
    producedAt: string;
  };
}

export interface CorpusManifestEntry {
  caseId: string;
  capabilityFamily: CapabilityFamily;
  casePath: string;
  caseSha256: string;
  evidencePath: string;
  evidenceSha256: string;
  goldPath: string;
  goldSha256: string;
}

export interface CorpusManifest {
  schemaVersion: '1.0.0';
  corpusId: string;
  corpusVersion: '1.0.0';
  evidenceCutoff: string;
  status: 'development-proposed';
  cases: CorpusManifestEntry[];
  familyCounts: Record<CapabilityFamily, number>;
  diversity: {
    pairedDifferentWinners: number;
    responsibleAbstentions: number;
    popularHardConstraintRejections: number;
    includesPrisma: true;
    includesDrizzle: true;
    includesServerless: true;
    includesLongRunning: true;
    includesWorkerCapable: true;
    includesWorkerIncapable: true;
    includesRedis: true;
    includesNoRedis: true;
    includesSingleTenant: true;
    includesMultiTenant: true;
    includesLicenseConstraint: true;
    includesRuntimeConstraint: true;
    includesResidencyConstraint: true;
    includesEvidenceInsufficiency: true;
    includesTieOrPartialOrder: true;
    popularityDiffersFromFit: true;
  };
  provenance: {
    authoringSession: string;
    goldStatus: 'proposed';
    independentReviewStatus: 'not-reviewed';
  };
}

export interface CaseBundle {
  caseDocument: EvaluationCase;
  evidence: EvidenceSet;
  gold: GoldResult;
}

export interface ReferenceDiagnostic {
  code: string;
  message: string;
  path: string;
}

export interface Counts {
  truePositive: number;
  falsePositive: number;
  falseNegative: number;
}

export interface LabelMetric {
  counts: Counts;
  precision: number;
  recall: number;
  f1: number;
}

export interface MetricSet {
  caseCount: number;
  dispositions: Record<DispositionLabel, LabelMetric>;
  macroDisposition: {
    precision: number;
    recall: number;
    f1: number;
  };
  rankingAgreement: number;
  outcomeAccuracy: number;
  outcomeByLabel: Record<Outcome, number>;
  unknownRecall: number;
  evidenceRecall: number;
  reasonRecall: number;
}

export interface SafetyViolation {
  caseId: string;
  candidateId: string;
  reasonCodes: string[];
}

export interface SafetyReport {
  safe: boolean;
  unsafeCount: number;
  violations: SafetyViolation[];
}

export interface ScoreReport {
  schemaVersion: '1.0.0';
  corpusId: string;
  predictionSetId: string;
  caseCount: number;
  safety: SafetyReport;
  aggregate: MetricSet;
  byFamily: Partial<Record<CapabilityFamily, MetricSet>>;
  byFailureMode: Record<string, MetricSet>;
}
