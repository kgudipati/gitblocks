import type {
  RankingAcceptedGateAuthority,
  RankingAcceptedReviewRecord,
} from './acceptance.ts';

export const RANKING_FAMILIES = [
  'authorization',
  'audit-logging',
  'background-jobs',
  'rate-limiting',
  'webhooks',
] as const;

export type RankingFamily = (typeof RANKING_FAMILIES)[number];
export type RankingOutcome =
  'recommend' | 'no-viable-candidate' | 'insufficient-evidence';
export type RankingDisposition =
  'recommended' | 'viable' | 'rejected' | 'insufficient-evidence';
export type EvidenceNeededResolution = 'satisfied' | 'conflict' | 'unresolved';

export interface RankingCandidateIdentity {
  readonly candidateId: string;
  readonly displayName: string;
  readonly repository: string;
  readonly packageName: string | null;
  readonly identityKind:
    'committed-catalog-candidate' | 'scenario-synthetic-candidate';
}

export interface RankingCriterion {
  readonly criterionId: string;
  readonly statement: string;
}

export interface RankingRequestAuthority {
  readonly requestAuthorityId: string;
  readonly capabilityFamily: RankingFamily;
  readonly summary: string;
  readonly successConditions: readonly RankingCriterion[];
  readonly hardConstraints: readonly (RankingCriterion & {
    readonly reasonCode: string;
  })[];
  readonly preferences: readonly (RankingCriterion & {
    readonly source:
      'normalized-preferred-constraint' | 'explicit-structured-approval';
  })[];
}

export interface RankingCriterionBinding {
  readonly criterionId: string;
  readonly criterionKind: 'success-condition' | 'preference';
  readonly bindingState: 'bound' | 'unbound';
  readonly materiality: 'material' | 'non-material' | null;
  readonly semanticFacet: string | null;
  readonly semanticConcept: string | null;
  readonly targetFactDependencies: readonly string[];
  readonly candidateFeatureDependencies: readonly string[];
  readonly comparisonRuleId: string | null;
  readonly expectedValues: readonly string[];
  readonly evidenceRequired: boolean;
  readonly provenance:
    | 'approved-query-normalization'
    | 'explicit-structured-approval'
    | 'explicit-unbound-review';
}

export interface RankingHardConstraintRule {
  readonly constraintId: string;
  readonly modality: 'required' | 'prohibited';
  readonly semanticFacet: string;
  readonly semanticConcept: string;
  readonly targetFactDependencies: readonly string[];
  readonly candidateFeatureDependencies: readonly string[];
  readonly evaluationRuleId: string;
  readonly expectedValues: readonly string[];
}

export interface RankingCriterionAuthority {
  readonly criterionAuthorityId: string;
  readonly requestAuthorityId: string;
  readonly sourceQueryDigest: string;
  readonly normalizationDigest: string;
  readonly requestDigest: string;
  readonly approvalDigest: string;
  readonly bindings: readonly RankingCriterionBinding[];
  readonly hardConstraintRules: readonly RankingHardConstraintRule[];
  readonly semanticDigest: string;
}

export interface RankingTargetFacts {
  readonly runtime: string;
  readonly framework: string;
  readonly packageManager: string;
  readonly database: string;
  readonly redis: 'present' | 'absent' | 'unknown';
  readonly orm: string;
  readonly workerCapability: 'capable' | 'incapable' | 'unknown';
  readonly deployment: 'serverless' | 'long-running-container';
  readonly replicas: number;
  readonly region: string;
  readonly identity: readonly string[];
  readonly resources: readonly string[];
  readonly dataPolicies: readonly string[];
  readonly externalNetwork: 'available' | 'prohibited' | 'unknown';
}

export interface RankingTargetAuthority {
  readonly targetAuthorityId: string;
  readonly fingerprintId: string;
  readonly facts: RankingTargetFacts;
  readonly withheldCategories: readonly string[];
  readonly semanticDigest: string;
}

export interface RankingCandidateSetAuthority {
  readonly candidateSetId: string;
  readonly capabilityFamily: RankingFamily;
  readonly candidates: readonly RankingCandidateIdentity[];
  readonly semanticDigest: string;
}

export interface RankingCaseBinding {
  readonly caseId: string;
  readonly capabilityFamily: RankingFamily;
  readonly requestAuthorityId: string;
  readonly criterionAuthorityId: string;
  readonly targetAuthorityId: string;
  readonly candidateSetId: string;
  readonly evidenceSetId: string;
  readonly handoffAuthorityId: string;
  readonly requestedMaximumResults: 3;
  readonly evidenceCutoff: string;
}

export interface RankingBlindCaseAuthority {
  readonly authorityVersion: 'ranking-v1-blind-cases/3.0.0';
  readonly corpusId: 'ranking-v1';
  readonly corpusVersion: '3.0.0';
  readonly evidenceCutoff: string;
  readonly requests: readonly RankingRequestAuthority[];
  readonly criterionAuthorities: readonly RankingCriterionAuthority[];
  readonly targets: readonly RankingTargetAuthority[];
  readonly candidateSets: readonly RankingCandidateSetAuthority[];
  readonly cases: readonly RankingCaseBinding[];
  readonly semanticDigest: string;
}

export interface RankingEvidenceObservation {
  readonly evidenceId: string;
  readonly candidateId: string;
  readonly featureId: string;
  readonly state: 'known' | 'unknown';
  readonly values: readonly string[];
  readonly completeness: 'complete' | 'partial';
  readonly provenance: {
    readonly kind: 'evaluation-owned-bounded-fixture';
    readonly basis:
      | 'committed-catalog-identity'
      | 'committed-pilot-evidence-concept'
      | 'ranking-v1-controlled-fixture';
    readonly sourceReference: string | null;
    readonly claimScope:
      | 'concept-crosswalk-not-current-project-authority'
      | 'scenario-synthetic-not-project-authority';
    readonly productionAuthority: false;
  };
  readonly limitation: string;
}

export interface RankingCandidateEvidence {
  readonly candidateId: string;
  readonly observations: readonly RankingEvidenceObservation[];
}

export interface RankingEvidenceSet {
  readonly evidenceSetId: string;
  readonly candidates: readonly RankingCandidateEvidence[];
  readonly semanticDigest: string;
}

export interface RankingEvidenceAuthority {
  readonly authorityVersion: 'ranking-v1-candidate-evidence/2.0.0';
  readonly corpusId: 'ranking-v1';
  readonly evidenceCutoff: string;
  readonly evidenceSets: readonly RankingEvidenceSet[];
  readonly semanticDigest: string;
}

export interface RankingUnresolvedEvaluation {
  readonly evaluationId: string;
  readonly sourceKind:
    'normalized-constraint' | 'preserved-declaration' | 'primary-family';
  readonly modality: 'required' | 'prohibited';
  readonly facet: string;
  readonly conceptId: string | null;
  readonly expectedValues: readonly string[];
  readonly targetFactDependencies: readonly string[];
  readonly candidateFeatureDependencies: readonly string[];
  readonly profileFieldId: string | null;
  readonly match: 'unresolved';
  readonly state: 'unresolved';
  readonly ruleId: string;
}

export interface RankingHandoffCandidate {
  readonly candidateId: string;
  readonly lane: 'eligible' | 'evidence-needed';
  readonly retrievalOrder: number;
  readonly retrievalScore: number;
  readonly unresolvedHardEvaluations: readonly RankingUnresolvedEvaluation[];
}

export interface RankingHandoffSet {
  readonly handoffAuthorityId: string;
  readonly retrievalRequestVersion: 'candidate-retrieval-request/1.2.0';
  readonly retrievalResultVersion: 'candidate-retrieval-result/1.3.0';
  readonly retrievalAlgorithmVersion: 'deterministic-candidate-retrieval/1.3.0';
  readonly candidates: readonly RankingHandoffCandidate[];
  readonly excludedCandidateIds: readonly string[];
  readonly semanticDigest: string;
}

export interface RankingHandoffAuthority {
  readonly authorityVersion: 'ranking-v1-phase9-handoff/2.0.0';
  readonly corpusId: 'ranking-v1';
  readonly handoffSets: readonly RankingHandoffSet[];
  readonly semanticDigest: string;
}

export interface RankingGoldCandidate {
  readonly candidateId: string;
  readonly disposition: RankingDisposition;
  readonly reasonCodes: readonly string[];
  readonly evidenceIds: readonly string[];
  readonly unknownIds: readonly string[];
}

export interface RankingGoldCase {
  readonly caseId: string;
  readonly outcome: RankingOutcome;
  readonly allowedAlternativeOutcomes: readonly RankingOutcome[];
  readonly candidates: readonly RankingGoldCandidate[];
  readonly presentation: readonly string[];
  readonly rankGroups: readonly (readonly string[])[];
  readonly rankRelations: readonly {
    readonly higherCandidateId: string;
    readonly lowerCandidateId: string;
  }[];
  readonly incomparablePairs: readonly (readonly [string, string])[];
  readonly hardConstraintConflicts: readonly {
    readonly candidateId: string;
    readonly constraintId: string;
    readonly reasonCode: string;
    readonly evidenceIds: readonly string[];
  }[];
  readonly requiredUnknowns: readonly {
    readonly candidateId: string;
    readonly unknownId: string;
  }[];
  readonly evidenceNeededResolutions: readonly {
    readonly candidateId: string;
    readonly evaluationId: string;
    readonly resolution: EvidenceNeededResolution;
    readonly evidenceIds: readonly string[];
  }[];
  readonly successConditionCoverage: readonly {
    readonly candidateId: string;
    readonly criterionId: string;
    readonly state:
      | 'covered'
      | 'not-covered'
      | 'fail-closed'
      | 'not-counted-approved-non-material';
  }[];
  readonly preferenceConsequences: readonly {
    readonly criterionId: string;
    readonly state:
      | 'applied-and-changed-supported-comparison'
      | 'bound-but-no-applicable-positive-comparison'
      | 'ignored-unbound';
    readonly affectedPairs: readonly (readonly [string, string])[];
  }[];
  readonly unboundPreferenceCounterfactuals: readonly {
    readonly criterionId: string;
    readonly candidatePair: readonly [string, string];
    readonly relationWithoutPreference:
      'tie' | 'left-higher' | 'right-higher' | 'incomparable';
  }[];
  readonly noPreferenceHardening: true;
  readonly provenance: {
    readonly status: 'proposed';
    readonly authoringSession: 'phase-10-m2-ranking-authoring';
    readonly independentReviewStatus: 'not-reviewed';
    readonly independentReviewer: null;
    readonly reviewedAt: null;
    readonly reviewReference: null;
  };
}

export interface RankingGoldAuthority {
  readonly authorityVersion: 'ranking-v1-proposed-gold/3.0.0';
  readonly corpusId: 'ranking-v1';
  readonly reviewStatus: 'proposed-not-independently-reviewed';
  readonly cases: readonly RankingGoldCase[];
  readonly controlledPairDirections: readonly {
    readonly pairId: string;
    readonly firstCaseId: string;
    readonly firstMaximalCandidateIds: readonly string[];
    readonly secondCaseId: string;
    readonly secondMaximalCandidateIds: readonly string[];
  }[];
  readonly semanticDigest: string;
}

export interface RankingAuditCase {
  readonly caseId: string;
  readonly family: RankingFamily;
  readonly primaryClass:
    | 'controlled-target-pair'
    | 'hard-conflict-no-viable'
    | 'evidence-insufficient'
    | 'popularity-over-fit'
    | 'tie'
    | 'explicit-incomparability';
  readonly auditLabels: readonly string[];
}

export interface RankingAuditAuthority {
  readonly authorityVersion: 'ranking-v1-audit-classification/2.0.0';
  readonly corpusId: 'ranking-v1';
  readonly cases: readonly RankingAuditCase[];
  readonly controlledPairs: readonly {
    readonly pairId: string;
    readonly firstCaseId: string;
    readonly secondCaseId: string;
    readonly changedTargetPaths: readonly string[];
  }[];
  readonly semanticDigest: string;
}

export interface RankingReviewerRationaleCase {
  readonly caseId: string;
  readonly requestRequirements: readonly string[];
  readonly materialTargetFacts: readonly string[];
  readonly coverageEvidence: readonly string[];
  readonly hardConflictEvidence: readonly string[];
  readonly materialInsufficiency: readonly string[];
  readonly preferenceAnalysis: readonly string[];
  readonly maximalSetAnalysis: readonly string[];
  readonly partialOrderAnalysis: readonly string[];
  readonly controlledPairChange: string | null;
  readonly criterionBindingCrosswalk: readonly {
    readonly criterionId: string;
    readonly bindingState: 'bound' | 'unbound';
    readonly candidateFeatureDependencies: readonly string[];
    readonly expectedValues: readonly string[];
    readonly candidateFacts: readonly {
      readonly candidateId: string;
      readonly evidenceId: string | null;
      readonly observedValues: readonly string[];
      readonly coverageState: RankingGoldCase['successConditionCoverage'][number]['state'];
    }[];
  }[];
}

export interface RankingReviewerRationaleAuthority {
  readonly authorityVersion: 'ranking-v1-reviewer-rationale/2.0.0';
  readonly corpusId: 'ranking-v1';
  readonly status: 'author-rationale-for-independent-review';
  readonly cases: readonly RankingReviewerRationaleCase[];
  readonly semanticDigest: string;
}

export interface RankingReviewRecord {
  readonly reviewRecordVersion: 'ranking-v1-review-record/3.0.0';
  readonly corpusId: 'ranking-v1';
  readonly goldAuthorityVersion: 'ranking-v1-proposed-gold/3.0.0';
  readonly reviewerRationaleVersion: 'ranking-v1-reviewer-rationale/2.0.0';
  readonly status: 'independent-review-pending';
  readonly author: 'Codex';
  readonly independentReviewer: null;
  readonly reviewedAt: null;
  readonly adjudication: 'not-started';
  readonly disputedCaseIds: readonly [];
  readonly acceptedCaseIds: readonly [];
  readonly goldDigest: string;
  readonly reviewerRationaleDigest: string;
  readonly semanticDigest: string;
}

export interface RankingPredictionCandidate {
  readonly candidateId: string;
  readonly disposition: RankingDisposition;
  readonly reasonCodes: readonly string[];
  readonly evidenceIds: readonly string[];
  readonly unknownIds: readonly string[];
}

export interface RankingCasePrediction {
  readonly caseId: string;
  readonly outcome: RankingOutcome;
  readonly candidates: readonly RankingPredictionCandidate[];
  readonly presentation: readonly string[];
  readonly rankGroups: readonly (readonly string[])[];
  readonly rankRelations: readonly {
    readonly higherCandidateId: string;
    readonly lowerCandidateId: string;
  }[];
  readonly incomparablePairs: readonly (readonly [string, string])[];
  readonly hardConstraintConflicts: readonly {
    readonly candidateId: string;
    readonly constraintId: string;
    readonly reasonCode: string;
    readonly evidenceIds: readonly string[];
  }[];
  readonly evidenceNeededResolutions: readonly {
    readonly candidateId: string;
    readonly evaluationId: string;
    readonly resolution: EvidenceNeededResolution;
    readonly evidenceIds: readonly string[];
  }[];
  readonly successConditionCoverage: readonly {
    readonly candidateId: string;
    readonly criterionId: string;
    readonly state:
      | 'covered'
      | 'not-covered'
      | 'fail-closed'
      | 'not-counted-approved-non-material';
  }[];
  readonly preferenceConsequences: RankingGoldCase['preferenceConsequences'];
  readonly unboundPreferenceCounterfactuals: RankingGoldCase['unboundPreferenceCounterfactuals'];
  readonly hardenedPreferenceIds: readonly string[];
}

export interface RankingPredictionSet {
  readonly predictionSetVersion: 'ranking-v1-prediction-set/3.0.0';
  readonly predictionSetId: string;
  readonly baselineId: string;
  readonly baselineVersion: string;
  readonly baselineSpecificationDigest: string;
  readonly corpusId: 'ranking-v1';
  readonly corpusVersion: '3.0.0';
  readonly blindInputDigest: string;
  readonly predictions: readonly RankingCasePrediction[];
  readonly semanticDigest: string;
}

export interface RankingBaselineSpecification {
  readonly baselineId: string;
  readonly baselineVersion: string;
  readonly role:
    'ordinary-baseline' | 'negative-control' | 'scorer-only-oracle';
  readonly permittedBlindInputs: readonly string[];
  readonly prohibitedInputs: readonly string[];
  readonly deterministicDecisionRules: readonly string[];
  readonly tieBehavior: string;
  readonly evidenceNeededBehavior: string;
  readonly maximumResultBehavior: string;
  readonly specificationDigest: string;
}

export interface RankingBaselineSpecificationAuthority {
  readonly authorityVersion: 'ranking-v1-baseline-specifications/3.0.0';
  readonly frozenBeforeScoring: true;
  readonly omissions: readonly {
    readonly baseline: 'popularity-health';
    readonly reason: string;
  }[];
  readonly specifications: readonly RankingBaselineSpecification[];
  readonly semanticDigest: string;
}

export interface ExactMetric {
  readonly correct: number;
  readonly total: number;
  readonly errors: number;
  readonly value: number | null;
}

export interface ClassificationMetric {
  readonly truePositive: number;
  readonly falsePositive: number;
  readonly falseNegative: number;
  readonly trueNegative: number;
  readonly precision: number | null;
  readonly recall: number | null;
  readonly f1: number | null;
}

export interface RankingSafetyCounts {
  readonly knownHardConflictRecommended: number;
  readonly knownHardConflictViable: number;
  readonly knownHardConflictRanked: number;
  readonly candidateInvention: number;
  readonly candidateSetMismatch: number;
  readonly excludedCandidateLeakage: number;
  readonly unresolvedEvidenceNeededPositivePromotion: number;
  readonly missingEvidenceNeededResolution: number;
  readonly preferenceHardenedIntoHardConflict: number;
  readonly unboundSuccessConditionCountedFavorable: number;
  readonly unboundPreferenceAffectedOrder: number;
}

export interface RankingMetricSet {
  readonly caseCount: number;
  readonly dispositions: Readonly<
    Record<RankingDisposition, ClassificationMetric>
  >;
  readonly macroDisposition: {
    readonly precision: number | null;
    readonly recall: number | null;
    readonly f1: number | null;
  };
  readonly outcome: {
    readonly overall: ExactMetric;
    readonly byLabel: Readonly<Record<RankingOutcome, ExactMetric>>;
    readonly confusion: Readonly<
      Record<RankingOutcome, Readonly<Record<RankingOutcome, number>>>
    >;
  };
  readonly partialOrder: {
    readonly overall: ExactMetric;
    readonly ties: ExactMetric;
    readonly ordered: ExactMetric;
    readonly incomparable: ExactMetric;
    readonly falseOrdersOfIncomparable: number;
  };
  readonly topThreeUsefulness: ExactMetric;
  readonly evidenceNeeded: {
    readonly overall: ExactMetric;
    readonly satisfied: ExactMetric;
    readonly conflict: ExactMetric;
    readonly unresolved: ExactMetric;
    readonly illegalPromotions: number;
  };
  readonly traceability: {
    readonly evidenceAssociations: ExactMetric;
    readonly reasonCodes: ExactMetric;
    readonly materialUnknowns: ExactMetric;
    readonly hardConflicts: ExactMetric;
    readonly unsupportedExtraAssociations: number;
  };
  readonly criterionBinding: {
    readonly boundSuccessConditionCoverage: ExactMetric;
    readonly materialUnboundFailClosed: ExactMetric;
    readonly approvedNonMaterialUnbound: ExactMetric;
    readonly boundPreferenceComparisonConsequence: ExactMetric;
    readonly unboundPreferenceCounterfactualNonEffect: ExactMetric;
    readonly noPreferenceHardening: ExactMetric;
  };
}

export interface RankingScoreReport {
  readonly scoreVersion: 'ranking-v1-scorer/2.0.0';
  readonly corpusId: 'ranking-v1';
  readonly predictionSetId: string;
  readonly predictionDigest: string;
  readonly safety: RankingSafetyCounts;
  readonly overall: RankingMetricSet;
  readonly perFamily: Readonly<Record<RankingFamily, RankingMetricSet>>;
  readonly controlledPairs: {
    readonly total: number;
    readonly exactPairCorrect: number;
    readonly wrongMaximalSet: number;
    readonly wrongDirection: number;
    readonly unchangedWhenChangeRequired: number;
  };
  readonly semanticDigest: string;
}

export interface RankingValidatedCorpus {
  readonly blind: RankingBlindCaseAuthority;
  readonly evidence: RankingEvidenceAuthority;
  readonly handoff: RankingHandoffAuthority;
  readonly gold: RankingGoldAuthority;
  readonly audit: RankingAuditAuthority;
  readonly reviewerRationale: RankingReviewerRationaleAuthority;
  readonly review: RankingReviewRecord;
}

export interface RankingAcceptedValidatedCorpus extends RankingValidatedCorpus {
  readonly acceptedReview: RankingAcceptedReviewRecord;
  readonly acceptedGates: RankingAcceptedGateAuthority;
}

export interface RankingDiagnostic {
  readonly code: string;
  readonly path: string;
  readonly message: string;
}

export interface RankingManifestFile {
  readonly kind:
    | 'blind-cases'
    | 'candidate-evidence'
    | 'phase9-handoff'
    | 'proposed-gold'
    | 'audit-classification'
    | 'reviewer-rationale'
    | 'review-record'
    | 'baseline-specifications'
    | 'baseline-prediction'
    | 'composition-input'
    | 'composition-gold'
    | 'composition-prediction'
    | 'baseline-report'
    | 'composition-report'
    | 'performance-reference'
    | 'gate-review-input'
    | 'accepted-review-record'
    | 'accepted-gates'
    | 'scorer-fixture-summary';
  readonly path: string;
  readonly sha256: string;
}

export interface RankingCorpusManifest {
  readonly manifestVersion: 'ranking-v1-manifest/4.0.0';
  readonly corpusId: 'ranking-v1';
  readonly corpusVersion: '3.0.0';
  readonly status: 'accepted';
  readonly evidenceCutoff: string;
  readonly caseCount: 30;
  readonly familyCounts: Readonly<Record<RankingFamily, 6>>;
  readonly files: readonly RankingManifestFile[];
  readonly corpusSemanticDigest: string;
}

export interface RankingResolvedCase {
  readonly binding: RankingCaseBinding;
  readonly request: RankingRequestAuthority;
  readonly criteria: RankingCriterionAuthority;
  readonly target: RankingTargetAuthority;
  readonly candidateSet: RankingCandidateSetAuthority;
  readonly evidence: RankingEvidenceSet;
  readonly handoff: RankingHandoffSet;
}

export interface RankingBlindStrategyInput {
  readonly capabilityFamily: RankingFamily;
  readonly request: RankingRequestAuthority;
  readonly criteria: RankingCriterionAuthority;
  readonly target: RankingTargetAuthority | null;
  readonly candidates: readonly RankingCandidateIdentity[];
  readonly candidateEvidence: readonly RankingCandidateEvidence[];
  readonly handoffCandidates: readonly RankingHandoffCandidate[];
  readonly requestedMaximumResults: 3;
}
