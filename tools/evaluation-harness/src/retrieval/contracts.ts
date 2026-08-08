import type {
  CapabilityQueryInputV1,
  CapabilityQueryNormalizationResultV1,
} from '@gitblocks/contracts';

export const RETRIEVAL_CORPUS_ID = 'retrieval-v1' as const;
export const RETRIEVAL_VERSIONS = {
  corpus: 'retrieval-evaluation-corpus/1.0.0',
  query: 'retrieval-evaluation-query/1.0.0',
  normalizationGold: 'retrieval-normalization-gold/1.0.0',
  clarificationGold: 'retrieval-clarification-gold/1.0.0',
  hardFilterProjection: 'retrieval-hard-filter-projection/1.0.0',
  relevanceGold: 'retrieval-relevance-gold/1.0.0',
  noResultGold: 'retrieval-no-result-gold/1.0.0',
  equivalence: 'retrieval-equivalence-authority/1.0.0',
  caseClassification: 'retrieval-case-classification/1.0.0',
  predictionSet: 'retrieval-evaluation-prediction-set/1.0.0',
  scorer: 'retrieval-evaluation-scorer/1.0.0',
  scoreReport: 'retrieval-evaluation-score-report/1.0.0',
} as const;

export const RETRIEVAL_V2_VERSIONS = {
  corpusId: 'retrieval-v2',
  corpus: 'retrieval-evaluation-corpus/2.0.0',
  relevanceGold: 'retrieval-relevance-gold/2.0.0',
  predictionSet: 'retrieval-evaluation-prediction-set/2.0.0',
  scoreReport: 'retrieval-evaluation-score-report/2.0.0',
  independentReview: 'retrieval-relevance-independent-review/1.0.0',
  qualityGates: 'retrieval-quality-gates/1.0.0',
} as const;

export type RetrievalAuthorityVersion = 'v1' | 'v2';
export type RetrievalCorpusId =
  typeof RETRIEVAL_CORPUS_ID | typeof RETRIEVAL_V2_VERSIONS.corpusId;
export type RetrievalCorpusVersion =
  typeof RETRIEVAL_VERSIONS.corpus | typeof RETRIEVAL_V2_VERSIONS.corpus;

export const RETRIEVAL_FAMILIES = [
  'authorization',
  'audit-logging',
  'background-jobs',
  'rate-limiting',
  'webhooks',
] as const;

export const RETRIEVAL_CASE_CLASSIFICATIONS = [
  'active-alias',
  'alias-evaluation',
  'ambiguous-primary-family',
  'cross-family-comparison',
  'deployment-self-hosting',
  'equivalence-safety',
  'evidence-needed',
  'family-balanced',
  'infrastructure-exclusion',
  'intentional-ambiguity',
  'negative-control-safety',
  'no-eligible-candidate',
  'positive-multiple-relevant',
  'preferred-constraint',
  'prohibited-constraint',
  'prohibited-preservation',
  'required-constraint',
  'required-prohibited-conflict',
  'same-family-comparison',
  'subjective-lightweight',
  'summary-inert',
  'unicode-confusable',
  'unclear-self-hosting',
  'unknown-hard-blocking',
  'unknown-preferred-nonblocking',
  'unsupported-adjacent',
] as const;

export const RETRIEVAL_CASE_SLOTS = [
  'normalization-adversarial-special',
  'normalization-alias',
  'normalization-ambiguity',
  'normalization-contradiction',
  'retrieval-active-alias',
  'retrieval-candidate-comparison',
  'retrieval-exact-family',
  'retrieval-hard-constraint',
  'retrieval-narrower-intent',
  'retrieval-negative-control',
] as const;

export type RetrievalFamily = (typeof RETRIEVAL_FAMILIES)[number];
export type RetrievalCaseClassification =
  (typeof RETRIEVAL_CASE_CLASSIFICATIONS)[number];
export type RetrievalCaseSlot = (typeof RETRIEVAL_CASE_SLOTS)[number];
export type RetrievalCaseKind = 'normalization-adversarial' | 'retrieval';
export type HardState = 'conflict' | 'satisfied' | 'unresolved';
export type RetrievalLane = 'eligible' | 'evidence-needed' | 'excluded';

export interface ProposedProvenance {
  readonly status: 'proposed';
  readonly reviewStatus: 'not-reviewed';
  readonly reviewer: null;
  readonly reviewedAt: null;
  readonly reviewReference: null;
}

export interface ReviewedRelevanceProvenance {
  readonly status: 'accepted';
  readonly reviewStatus: 'independently-reviewed';
  readonly reviewAuthorityVersion: typeof RETRIEVAL_V2_VERSIONS.independentReview;
  readonly reviewAuthorityDigest: string;
  readonly reviewReference: 'issue-23';
}

export type RetrievalProvenance =
  ProposedProvenance | ReviewedRelevanceProvenance;

export interface RetrievalQueryDocument {
  readonly queryVersion: typeof RETRIEVAL_VERSIONS.query;
  readonly caseId: string;
  readonly caseKind: RetrievalCaseKind;
  readonly capabilityFamily: RetrievalFamily;
  readonly queryInput: CapabilityQueryInputV1;
}

export interface RetrievalCaseClassificationEntry {
  readonly caseId: string;
  readonly slotId: RetrievalCaseSlot;
  readonly classifications: readonly RetrievalCaseClassification[];
  readonly provenance: ProposedProvenance;
}

export interface RetrievalCaseClassificationAuthority {
  readonly classificationVersion: typeof RETRIEVAL_VERSIONS.caseClassification;
  readonly entries: readonly RetrievalCaseClassificationEntry[];
  readonly provenance: ProposedProvenance;
}

export interface NormalizedConceptProjection {
  readonly conceptId: string;
  readonly sourceTermIds: readonly string[];
  readonly ruleId: string;
}

export interface NormalizedConstraintProjection {
  readonly sourceConstraintIds: readonly string[];
  readonly modality: 'preferred' | 'prohibited' | 'required';
  readonly facet: string;
  readonly resolutionBasis: string;
  readonly ruleId: string;
  readonly conceptId: string | null;
  readonly canonicalTerm: string | null;
}

export interface UnresolvedProjection {
  readonly sourceIds: readonly string[];
  readonly reasonCode: string;
  readonly blocking: boolean;
}

export interface NoticeProjection {
  readonly reasonCode: string;
  readonly sourceIds: readonly string[];
  readonly replacementAliasKey: string;
}

export interface ClarificationProjection {
  readonly reasonCode: string;
  readonly sourceIds: readonly string[];
  readonly possibleConceptIds: readonly string[];
}

export interface NormalizationProjection {
  readonly outcome: 'clarification-required' | 'normalized' | 'unsupported';
  readonly primaryFamily: RetrievalFamily | null;
  readonly normalizedConcepts: readonly NormalizedConceptProjection[];
  readonly normalizedConstraints: readonly NormalizedConstraintProjection[];
  readonly unresolved: readonly UnresolvedProjection[];
  readonly clarifications: readonly ClarificationProjection[];
  readonly notices: readonly NoticeProjection[];
}

export interface NormalizationGoldDocument {
  readonly normalizationGoldVersion: typeof RETRIEVAL_VERSIONS.normalizationGold;
  readonly caseId: string;
  readonly expected: NormalizationProjection;
  readonly provenance: ProposedProvenance;
}

export interface ClarificationGoldDocument {
  readonly clarificationGoldVersion: typeof RETRIEVAL_VERSIONS.clarificationGold;
  readonly caseId: string;
  readonly clarificationRequired: boolean;
  readonly clarifications: readonly ClarificationProjection[];
  readonly terminalUnsupported: boolean;
  readonly provenance: ProposedProvenance;
}

export interface GeneratedCandidateDecision {
  readonly candidateId: string;
  readonly hardState: HardState;
  readonly lane: RetrievalLane;
  readonly negativeControl: boolean;
}

export interface GeneratedHardFilterProjection {
  readonly decisions: readonly GeneratedCandidateDecision[];
  readonly digest: string;
  readonly hardStateCounts: Readonly<Record<HardState, number>>;
  readonly laneCounts: Readonly<Record<RetrievalLane, number>>;
}

export interface HardFilterAuditSample {
  readonly sampleRole:
    | 'cross-family'
    | 'eligible'
    | 'evidence-needed'
    | 'hard-conflict'
    | 'negative-control';
  readonly candidateId: string;
  readonly hardState: HardState;
  readonly lane: RetrievalLane;
  readonly reasonCode:
    | 'catalog-negative-control-exclusion'
    | 'generated-cross-family'
    | 'generated-eligible-lane'
    | 'generated-evidence-needed-lane'
    | 'generated-hard-conflict';
  readonly provenance: ProposedProvenance;
}

export interface HardFilterGoldDocument {
  readonly projectionVersion: typeof RETRIEVAL_VERSIONS.hardFilterProjection;
  readonly caseId: string;
  readonly profileAuthorityVersion: string;
  readonly profileAuthorityDigest: string;
  readonly taxonomyVersion: string;
  readonly taxonomyDigest: string;
  readonly catalogVersion: string;
  readonly catalogDigest: string;
  readonly projectionDigest: string;
  readonly hardStateCounts: Readonly<Record<HardState, number>>;
  readonly laneCounts: Readonly<Record<RetrievalLane, number>>;
  readonly auditSample: readonly HardFilterAuditSample[];
  readonly provenance: ProposedProvenance;
}

export interface RelevanceJudgment {
  readonly candidateId: string;
  readonly grade: 0 | 1 | 2 | 3;
  readonly reasonCodes: readonly string[];
  readonly provenance: RetrievalProvenance;
}

export interface RelevanceGoldDocument {
  readonly relevanceGoldVersion:
    | typeof RETRIEVAL_VERSIONS.relevanceGold
    | typeof RETRIEVAL_V2_VERSIONS.relevanceGold;
  readonly caseId: string;
  readonly judgments: readonly RelevanceJudgment[];
  readonly provenance: RetrievalProvenance;
}

export interface NoResultGoldDocument {
  readonly noResultGoldVersion: typeof RETRIEVAL_VERSIONS.noResultGold;
  readonly caseId: string;
  readonly expectedOutcome:
    'eligible-candidates-present' | 'no-eligible-candidate';
  readonly eligibleCount: number;
  readonly evidenceNeededCount: number;
  readonly excludedCount: number;
  readonly provenance: ProposedProvenance;
}

export interface EquivalenceGroup {
  readonly groupId: string;
  readonly relationshipKind:
    | 'actual-fork'
    | 'duplicate-catalog-identity'
    | 'interchangeable-distribution-variant'
    | 'mirror'
    | 'superseding-alias';
  readonly candidateIds: readonly string[];
  readonly provenance: ProposedProvenance;
}

export interface EquivalenceAuthority {
  readonly equivalenceVersion: typeof RETRIEVAL_VERSIONS.equivalence;
  readonly catalogVersion: string;
  readonly catalogDigest: string;
  readonly groups: readonly EquivalenceGroup[];
  readonly provenance: ProposedProvenance;
}

export type RetrievalManifestFileKind =
  | 'case-classification'
  | 'clarification-gold'
  | 'equivalence'
  | 'hard-filter-gold'
  | 'normalization-gold'
  | 'no-result-gold'
  | 'normalization-query'
  | 'relevance-gold'
  | 'retrieval-query';

export interface RetrievalManifestFile {
  readonly path: string;
  readonly sha256: string;
  readonly kind: RetrievalManifestFileKind;
  readonly caseId: string | null;
}

export interface RetrievalCorpusManifest {
  readonly corpusId: RetrievalCorpusId;
  readonly corpusVersion: RetrievalCorpusVersion;
  readonly taxonomyVersion: string;
  readonly taxonomyDigest: string;
  readonly queryInputSchemaDigest: string;
  readonly normalizationResultSchemaDigest: string;
  readonly profileSchemaDigest: string;
  readonly profileAuthoritySchemaDigest: string;
  readonly profileAuthorityVersion: string;
  readonly profileAuthorityDigest: string;
  readonly catalogVersion: string;
  readonly catalogDigest: string;
  readonly caseCounts: { readonly normalization: 20; readonly retrieval: 30 };
  readonly familyCounts: Readonly<
    Record<
      RetrievalFamily,
      { readonly normalization: 4; readonly retrieval: 6 }
    >
  >;
  readonly files: readonly RetrievalManifestFile[];
  readonly relevanceReviewVersion?: typeof RETRIEVAL_V2_VERSIONS.independentReview;
  readonly relevanceReviewDigest?: string;
  readonly corpusSemanticDigest: string;
  readonly provenance: ProposedProvenance;
}

export interface RetrievalCaseBundle {
  readonly query: RetrievalQueryDocument;
  readonly classification: RetrievalCaseClassificationEntry;
  readonly normalizationResult: CapabilityQueryNormalizationResultV1;
  readonly normalizationGold: NormalizationGoldDocument;
  readonly hardFilterGold: HardFilterGoldDocument;
  readonly generatedProjection: GeneratedHardFilterProjection;
  readonly relevanceGold: RelevanceGoldDocument;
  readonly noResultGold: NoResultGoldDocument;
}

export interface NormalizationCaseBundle {
  readonly query: RetrievalQueryDocument;
  readonly classification: RetrievalCaseClassificationEntry;
  readonly normalizationResult: CapabilityQueryNormalizationResultV1;
  readonly normalizationGold: NormalizationGoldDocument;
  readonly clarificationGold: ClarificationGoldDocument;
}

export interface ValidatedRetrievalCorpus {
  readonly manifest: RetrievalCorpusManifest;
  readonly caseClassification: RetrievalCaseClassificationAuthority;
  readonly equivalence: EquivalenceAuthority;
  readonly retrievalCases: readonly RetrievalCaseBundle[];
  readonly normalizationCases: readonly NormalizationCaseBundle[];
  readonly allProvenance: readonly RetrievalProvenance[];
  readonly candidateIds: readonly string[];
  readonly conceptIds: readonly string[];
}

export interface RetrievalBlindQuerySet {
  readonly corpusId: RetrievalCorpusId;
  readonly corpusVersion: RetrievalCorpusVersion;
  readonly corpusSemanticDigest: string;
  readonly caseCounts: RetrievalCorpusManifest['caseCounts'];
  readonly familyCounts: RetrievalCorpusManifest['familyCounts'];
  readonly queries: readonly RetrievalQueryDocument[];
}

export type RetrievalBlindQuerySetLoadResult =
  | { readonly ok: true; readonly querySet: RetrievalBlindQuerySet }
  | {
      readonly ok: false;
      readonly diagnostics: readonly RetrievalDiagnostic[];
    };

export interface RetrievalDiagnostic {
  readonly code: string;
  readonly path: string;
  readonly message: string;
}

export interface PredictedCandidateDecision {
  readonly candidateId: string;
  readonly hardState: HardState;
  readonly lane: RetrievalLane;
}

export interface PredictedResult {
  readonly candidateId: string;
  readonly claimedLane: 'eligible' | 'evidence-needed';
}

export type NormalizationPrediction = NormalizationProjection;

export interface NormalizationCasePrediction {
  readonly caseId: string;
  readonly caseKind: 'normalization-adversarial';
  readonly normalization: NormalizationPrediction;
}

export interface RetrievalCasePrediction {
  readonly caseId: string;
  readonly caseKind: 'retrieval';
  readonly normalization: NormalizationPrediction;
  readonly candidateDecisions: readonly PredictedCandidateDecision[];
  readonly results: readonly PredictedResult[];
  readonly noEligibleCandidate: boolean;
}

export interface RetrievalPredictionSet {
  readonly predictionSetVersion:
    | typeof RETRIEVAL_VERSIONS.predictionSet
    | typeof RETRIEVAL_V2_VERSIONS.predictionSet;
  readonly predictionSetId: string;
  readonly corpusId: RetrievalCorpusId;
  readonly corpusVersion: RetrievalCorpusVersion;
  readonly corpusSemanticDigest: string;
  readonly predictions: readonly (
    NormalizationCasePrediction | RetrievalCasePrediction
  )[];
  readonly semanticDigest: string;
}

export interface MetricValue {
  readonly numerator: number;
  readonly denominator: number;
  readonly value: number | null;
  readonly status: 'applicable' | 'not-applicable';
}

export interface RetrievalScoringFixture {
  readonly family: RetrievalFamily;
  readonly judgments: readonly {
    readonly candidateId: string;
    readonly grade: 0 | 1 | 2 | 3;
    readonly eligible: boolean;
  }[];
  readonly results: readonly PredictedResult[];
  readonly equivalenceGroups: readonly (readonly string[])[];
  readonly generatedDecisions: readonly GeneratedCandidateDecision[];
  readonly predictedDecisions: readonly PredictedCandidateDecision[];
  readonly expectedNoEligibleCandidate: boolean;
  readonly predictedNoEligibleCandidate: boolean;
}

export interface RetrievalFixtureScore {
  readonly recallAt10: MetricValue;
  readonly meanReciprocalRank: MetricValue;
  readonly ndcgAt10: MetricValue;
  readonly exactDuplicateRate: MetricValue;
  readonly equivalenceDuplicateRate: MetricValue;
  readonly hardFilterAccuracy: MetricValue;
  readonly noEligibleCandidateAccuracy: MetricValue;
  readonly top10Violations: {
    readonly conflict: number;
    readonly negativeControl: number;
    readonly laneError: number;
  };
}

export interface HardFilterStateMetrics {
  readonly accuracy: MetricValue;
  readonly perState: Readonly<
    Record<
      HardState,
      {
        readonly precision: MetricValue;
        readonly recall: MetricValue;
      }
    >
  >;
}

export interface NormalizationCaseScore {
  readonly caseId: string;
  readonly caseKind: RetrievalCaseKind;
  readonly family: RetrievalFamily;
  readonly clarificationAccuracy: MetricValue;
  readonly aliasExpansionCorrectness: MetricValue;
  readonly prohibitedConstraintPreservation: MetricValue;
}

export interface RetrievalCaseScore extends NormalizationCaseScore {
  readonly caseKind: 'retrieval';
  readonly recallAt10: MetricValue;
  readonly meanReciprocalRank: MetricValue;
  readonly ndcgAt10: MetricValue;
  readonly exactDuplicateRate: MetricValue;
  readonly equivalenceDuplicateRate: MetricValue;
  readonly hardFilter: HardFilterStateMetrics;
  readonly noEligibleCandidateAccuracy: MetricValue;
  readonly eligibleRelevantHit: boolean | null;
  readonly top10Violations: {
    readonly conflict: number;
    readonly negativeControl: number;
    readonly laneError: number;
  };
}

export interface RetrievalFamilyScore {
  readonly family: RetrievalFamily;
  readonly retrievalCases: number;
  readonly positiveCases: number;
  readonly positiveCaseHitRate: MetricValue;
  readonly hardFilterAccuracy: MetricValue;
  readonly clarificationAccuracy: MetricValue;
  readonly aliasExpansionCorrectness: MetricValue;
  readonly prohibitedConstraintPreservation: MetricValue;
}

export interface RetrievalScoreReport {
  readonly scoreReportVersion:
    | typeof RETRIEVAL_VERSIONS.scoreReport
    | typeof RETRIEVAL_V2_VERSIONS.scoreReport;
  readonly corpusId: RetrievalCorpusId;
  readonly corpusVersion: RetrievalCorpusVersion;
  readonly corpusSemanticDigest: string;
  readonly scorerVersion: typeof RETRIEVAL_VERSIONS.scorer;
  readonly predictionSetId: string;
  readonly predictionSetDigest: string;
  readonly authorityBindings: {
    readonly taxonomyVersion: string;
    readonly taxonomyDigest: string;
    readonly catalogVersion: string;
    readonly catalogDigest: string;
    readonly profileAuthorityVersion: string;
    readonly profileAuthorityDigest: string;
    readonly equivalenceVersion: typeof RETRIEVAL_VERSIONS.equivalence;
  };
  readonly caseCounts: { readonly normalization: 20; readonly retrieval: 30 };
  readonly perCase: readonly (NormalizationCaseScore | RetrievalCaseScore)[];
  readonly perFamily: readonly RetrievalFamilyScore[];
  readonly macro: Readonly<Record<string, MetricValue>>;
  readonly micro: Readonly<Record<string, MetricValue>>;
  readonly familyCoverage: MetricValue;
  readonly safetyViolations: {
    readonly conflict: number;
    readonly negativeControl: number;
    readonly laneError: number;
  };
  readonly semanticDigest: string;
}
