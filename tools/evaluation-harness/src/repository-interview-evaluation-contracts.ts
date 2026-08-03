import type { CapabilityFamily } from './contracts.ts';

export const REPOSITORY_INTERVIEW_CORPUS_ID =
  'repository-interviews-v1' as const;
export const REPOSITORY_INTERVIEW_CORPUS_VERSION = '1.0.0' as const;

export const REPOSITORY_INTERVIEW_SELECTION_LABELS = [
  'archived-lifecycle',
  'complex-service-or-platform',
  'likely-material-unknown',
  'moved-repository',
  'negative-control',
  'readme-only',
  'rich-additional-documentation',
  'simple-library-or-helper',
] as const;

export type RepositoryInterviewSelectionLabel =
  (typeof REPOSITORY_INTERVIEW_SELECTION_LABELS)[number];

export const REPOSITORY_INTERVIEW_RATIONALE_CODES = [
  'archived-lifecycle-risk',
  'complex-operational-surface',
  'documentation-richness',
  'documentation-sparsity',
  'license-boundary-pressure',
  'material-unknown-pressure',
  'moved-identity-continuity',
  'negative-control-boundary',
  'security-boundary-pressure',
  'simple-adoption-surface',
] as const;

export type RepositoryInterviewRationaleCode =
  (typeof REPOSITORY_INTERVIEW_RATIONALE_CODES)[number];

export type CatalogCandidateStatus =
  'active' | 'archived' | 'moved' | 'negative-control';

export interface RepositoryInterviewEvaluationCandidateV1 {
  readonly schemaVersion: '1.0.0';
  readonly corpusId: typeof REPOSITORY_INTERVIEW_CORPUS_ID;
  readonly candidateId: string;
  readonly capabilityFamily: CapabilityFamily;
  readonly catalogStatus: CatalogCandidateStatus;
  readonly selectionLabels: readonly RepositoryInterviewSelectionLabel[];
  readonly selectionRationaleCodes: readonly RepositoryInterviewRationaleCode[];
  readonly calibrationMember: boolean;
  readonly calibrationOrdinal: number | null;
  readonly artifactProfile: {
    readonly presentArtifactCount: number;
    readonly notFoundSelectionCount: number;
    readonly presentArtifactKinds: readonly ('documentation' | 'readme')[];
  };
}

export interface RepositoryInterviewManifestMemberV1 {
  readonly path: string;
  readonly sha256: string;
}

export interface RepositoryInterviewEvaluationManifestV1 {
  readonly schemaVersion: '1.0.0';
  readonly corpusId: typeof REPOSITORY_INTERVIEW_CORPUS_ID;
  readonly corpusVersion: typeof REPOSITORY_INTERVIEW_CORPUS_VERSION;
  readonly status: 'development-proposed';
  readonly authority: {
    readonly catalogVersion: 'public-v1';
    readonly catalogDigest: string;
    readonly artifactManifestDigest: string;
    readonly repositoryInterviewRequestSchemaDigest: string;
    readonly modelExecutionSchemaDigest: string;
    readonly repositoryInterviewSchemaDigest: string;
    readonly specificationVersion: '1.0.0';
    readonly specificationDigest: string;
    readonly providerOutputSchemaDigest: string;
    readonly openAiProjectionDigest: string;
  };
  readonly policies: readonly RepositoryInterviewManifestMemberV1[];
  readonly schemas: readonly RepositoryInterviewManifestMemberV1[];
  readonly candidates: readonly RepositoryInterviewManifestMemberV1[];
  readonly adversarialFixtures: readonly RepositoryInterviewManifestMemberV1[];
  readonly corpusDigest: string;
}

export interface RepositoryInterviewAdversarialFixtureV1 {
  readonly schemaVersion: '1.0.0';
  readonly corpusId: typeof REPOSITORY_INTERVIEW_CORPUS_ID;
  readonly fixtureId: string;
  readonly threatCategories: readonly string[];
  readonly syntheticArtifacts: readonly {
    readonly artifactAlias: 'A1' | 'A2' | 'A3' | 'A4';
    readonly artifactKind: 'documentation' | 'readme';
    readonly lines: readonly string[];
  }[];
  readonly expectedPolicyAssertions: readonly string[];
  readonly expectedAuditRequirements: readonly string[];
}

export type RepositoryInterviewReviewStage = 'calibration' | 'gate-a';
export type RepositoryInterviewReviewerRole =
  'calibration-reviewer' | 'gate-primary' | 'gate-secondary';
export type RepositoryInterviewMateriality =
  'critical' | 'material' | 'non-material';
export type RepositoryInterviewSupportVerdict =
  | 'supported'
  | 'partially-supported'
  | 'unsupported'
  | 'contradicted'
  | 'not-applicable';

export interface RepositoryInterviewSubjectFindingV1 {
  readonly subjectKind: 'claim' | 'contradiction' | 'limitation';
  readonly subjectId: string;
  readonly materiality: RepositoryInterviewMateriality;
  readonly criticalDomain:
    'infrastructure' | 'security' | 'license' | 'unsupported-use-case' | null;
  readonly supportVerdict: RepositoryInterviewSupportVerdict;
  readonly basisVerdict: 'correct' | 'incorrect' | 'not-applicable';
  readonly partialSupportLimitationId: string | null;
  readonly citationScopeVerdict: 'narrow' | 'overbroad' | 'not-applicable';
  readonly contradictionRepresentationVerdict:
    'honest' | 'incomplete' | 'misclassified' | 'not-applicable';
  readonly disputed: boolean;
}

export interface RepositoryInterviewUnknownFindingV1 {
  readonly auditUnknownId: string;
  readonly topic: string;
  readonly materiality: RepositoryInterviewMateriality;
  readonly disclosedUnknownId: string | null;
  readonly verdict: 'disclosed' | 'omitted' | 'misstated';
}

export interface RepositoryInterviewPolicyFindingsV1 {
  readonly promptInjection: 'pass' | 'suspected' | 'violation';
  readonly outsideKnowledge: 'pass' | 'suspected' | 'violation';
  readonly secretLeakage: 'pass' | 'violation';
  readonly prohibitedDataLeakage: 'pass' | 'violation';
  readonly poorFitCoverage: 'sufficient' | 'insufficient' | 'not-applicable';
  readonly operationalRequirementsCoverage:
    'sufficient' | 'insufficient' | 'not-applicable';
  readonly contradictionCoverage:
    'sufficient' | 'insufficient' | 'not-applicable';
}

export interface RepositoryInterviewAuditRecordV1 {
  readonly schemaVersion: '1.0.0';
  readonly corpusId: typeof REPOSITORY_INTERVIEW_CORPUS_ID;
  readonly corpusVersion: typeof REPOSITORY_INTERVIEW_CORPUS_VERSION;
  readonly stage: RepositoryInterviewReviewStage;
  readonly candidateId: string;
  readonly requestId: string;
  readonly executionId: string;
  readonly interviewId: string;
  readonly reviewId: string;
  readonly reviewerId: string;
  readonly reviewerRole: RepositoryInterviewReviewerRole;
  readonly blindToOtherReviews: boolean;
  readonly independentFromGeneration: boolean;
  readonly reviewedAt: string;
  readonly subjectFindings: readonly RepositoryInterviewSubjectFindingV1[];
  readonly unknownFindings: readonly RepositoryInterviewUnknownFindingV1[];
  readonly policyFindings: RepositoryInterviewPolicyFindingsV1;
  readonly overallUsefulness: 'useful' | 'partially-useful' | 'not-useful';
}

export interface RepositoryInterviewAuditScopeV1 {
  readonly schemaVersion: '1.0.0';
  readonly candidateId: string;
  readonly requestId: string;
  readonly executionId: string;
  readonly interviewId: string;
  readonly requestRecordDigest: string;
  readonly executionRecordDigest: string;
  readonly interviewRecordDigest: string;
  readonly claimIds: readonly string[];
  readonly limitationIds: readonly string[];
  readonly contradictionIds: readonly string[];
  readonly unknownIds: readonly string[];
  readonly inventoryDigest: string;
}

export type RepositoryInterviewPolicyField =
  | 'promptInjection'
  | 'outsideKnowledge'
  | 'secretLeakage'
  | 'prohibitedDataLeakage'
  | 'poorFitCoverage'
  | 'operationalRequirementsCoverage'
  | 'contradictionCoverage';

export type RepositoryInterviewPolicyResolutionV1 =
  | {
      readonly field: 'promptInjection';
      readonly finalValue: RepositoryInterviewPolicyFindingsV1['promptInjection'];
    }
  | {
      readonly field: 'outsideKnowledge';
      readonly finalValue: RepositoryInterviewPolicyFindingsV1['outsideKnowledge'];
    }
  | {
      readonly field: 'secretLeakage';
      readonly finalValue: RepositoryInterviewPolicyFindingsV1['secretLeakage'];
    }
  | {
      readonly field: 'prohibitedDataLeakage';
      readonly finalValue: RepositoryInterviewPolicyFindingsV1['prohibitedDataLeakage'];
    }
  | {
      readonly field: 'poorFitCoverage';
      readonly finalValue: RepositoryInterviewPolicyFindingsV1['poorFitCoverage'];
    }
  | {
      readonly field: 'operationalRequirementsCoverage';
      readonly finalValue: RepositoryInterviewPolicyFindingsV1['operationalRequirementsCoverage'];
    }
  | {
      readonly field: 'contradictionCoverage';
      readonly finalValue: RepositoryInterviewPolicyFindingsV1['contradictionCoverage'];
    };

export interface RepositoryInterviewAdjudicationRecordV1 {
  readonly schemaVersion: '1.0.0';
  readonly corpusId: typeof REPOSITORY_INTERVIEW_CORPUS_ID;
  readonly corpusVersion: typeof REPOSITORY_INTERVIEW_CORPUS_VERSION;
  readonly stage: RepositoryInterviewReviewStage;
  readonly candidateId: string;
  readonly requestId: string;
  readonly executionId: string;
  readonly interviewId: string;
  readonly adjudicationId: string;
  readonly adjudicatorId: string;
  readonly sourceReviewIds: readonly [string, string];
  readonly independentFromGeneration: boolean;
  readonly adjudicatedAt: string;
  readonly subjectResolutions: readonly {
    readonly subjectKind: RepositoryInterviewSubjectFindingV1['subjectKind'];
    readonly subjectId: string;
    readonly finalFinding: RepositoryInterviewSubjectFindingV1;
  }[];
  readonly unknownResolutions: readonly {
    readonly auditUnknownId: string;
    readonly finalFinding: RepositoryInterviewUnknownFindingV1;
  }[];
  readonly policyResolutions: readonly RepositoryInterviewPolicyResolutionV1[];
}

export type RepositoryInterviewRunStatus =
  | 'completed'
  | 'provider-failed'
  | 'schema-failed'
  | 'citation-failed'
  | 'persistence-failed'
  | 'policy-failed';

interface RepositoryInterviewCandidateRunResultBaseV1 {
  readonly candidateId: string;
  readonly requestId: string;
  readonly executionId: string;
  readonly contractValid: boolean;
  readonly citationClosed: boolean;
  readonly crossCandidateReferenceCount: number;
  readonly crossArtifactSetReferenceCount: number;
}

export type RepositoryInterviewCandidateRunResultV1 =
  | (RepositoryInterviewCandidateRunResultBaseV1 & {
      readonly status: 'completed';
      readonly interviewId: string;
      readonly auditScope: RepositoryInterviewAuditScopeV1;
    })
  | (RepositoryInterviewCandidateRunResultBaseV1 & {
      readonly status: Exclude<RepositoryInterviewRunStatus, 'completed'>;
      readonly interviewId: null;
      readonly auditScope: null;
    });

export interface RepositoryInterviewRunSummaryV1 {
  readonly schemaVersion: '1.0.0';
  readonly corpusId: typeof REPOSITORY_INTERVIEW_CORPUS_ID;
  readonly corpusVersion: typeof REPOSITORY_INTERVIEW_CORPUS_VERSION;
  readonly stage: RepositoryInterviewReviewStage;
  readonly runId: string;
  readonly modelProfileDigest: string;
  readonly corpusDigest: string;
  readonly cohortPolicyDigest: string;
  readonly reviewPolicyDigest: string;
  readonly rubricDigest: string;
  readonly gatePolicyDigest: string;
  readonly candidateResults: readonly RepositoryInterviewCandidateRunResultV1[];
}

export interface RepositoryInterviewSecondarySubjectV1 {
  readonly candidateId: string;
  readonly subjectKind: 'claim' | 'contradiction' | 'limitation';
  readonly subjectId: string;
}

export interface RepositoryInterviewGateRateV1 {
  readonly numerator: number;
  readonly denominator: number;
  readonly decimal: string | null;
}

export interface RepositoryInterviewGateReportV1 {
  readonly schemaVersion: '1.0.0';
  readonly corpusId: typeof REPOSITORY_INTERVIEW_CORPUS_ID;
  readonly corpusVersion: typeof REPOSITORY_INTERVIEW_CORPUS_VERSION;
  readonly runId: string;
  readonly stage: RepositoryInterviewReviewStage;
  readonly corpusDigest: string;
  readonly cohortPolicyDigest: string;
  readonly reviewPolicyDigest: string;
  readonly rubricDigest: string;
  readonly gatePolicyDigest: string;
  readonly modelProfileDigest: string;
  readonly runSummaryDigest: string;
  readonly auditScopeSetDigest: string;
  readonly auditSetDigest: string;
  readonly adjudicationSetDigest: string;
  readonly candidateCount: number;
  readonly completedCandidateCount: number;
  readonly operationalFailureCount: number;
  readonly contractInvalidCount: number;
  readonly citationInvalidCount: number;
  readonly crossCandidateReferenceCount: number;
  readonly crossArtifactSetReferenceCount: number;
  readonly humanReviewCount: number;
  readonly mandatorySecondaryCount: number;
  readonly sampledSecondaryCount: number;
  readonly adjudicationCount: number;
  readonly criticalDefectCount: number;
  readonly noncriticalUnsupported: RepositoryInterviewGateRateV1;
  readonly noncriticalPartial: RepositoryInterviewGateRateV1;
  readonly unknownRecall: RepositoryInterviewGateRateV1;
  readonly basisCorrectness: RepositoryInterviewGateRateV1;
  readonly contradictionDefectCount: number;
  readonly promptInjectionViolationCount: number;
  readonly outsideKnowledgeViolationCount: number;
  readonly secretLeakageCount: number;
  readonly prohibitedDataLeakageCount: number;
  readonly passed: boolean;
  readonly failureCodes: readonly string[];
  readonly reportDigest: string;
}

export interface RepositoryInterviewCohortPolicyV1 {
  readonly schemaVersion: '1.0.0';
  readonly corpusId: typeof REPOSITORY_INTERVIEW_CORPUS_ID;
  readonly candidateIds: readonly string[];
  readonly calibrationCandidateIds: readonly string[];
  readonly requiredCounts: {
    readonly candidates: number;
    readonly candidatesPerFamily: number;
    readonly negativeControls: number;
    readonly negativeControlsPerFamily: number;
    readonly archived: number;
    readonly moved: number;
    readonly richAdditionalDocumentation: number;
    readonly readmeOnly: number;
  };
  readonly lifecycleDiversityScope: 'cohort';
}

export interface RepositoryInterviewReviewPolicyV1 {
  readonly schemaVersion: '1.0.0';
  readonly corpusId: typeof REPOSITORY_INTERVIEW_CORPUS_ID;
  readonly calibrationReviewersPerCandidate: 2;
  readonly calibrationBlind: true;
  readonly gatePrimaryReviewersPerCandidate: 1;
  readonly secondarySampleNumerator: number;
  readonly secondarySampleDenominator: number;
  readonly secondarySampleRounding: 'ceiling' | 'floor';
  readonly secondarySampleScope: 'complete-gate-a-cohort';
  readonly mandatorySecondaryReasons: readonly string[];
  readonly adjudicationTrigger: 'material-human-disagreement';
}

export interface RepositoryInterviewRubricV1 {
  readonly schemaVersion: '1.0.0';
  readonly corpusId: typeof REPOSITORY_INTERVIEW_CORPUS_ID;
  readonly support: Readonly<Record<string, string>>;
  readonly basis: Readonly<Record<string, string>>;
  readonly criticalDomains: readonly string[];
  readonly unknownRecall: string;
  readonly promptInjection: string;
  readonly outsideKnowledge: string;
}

export interface RepositoryInterviewGatePolicyV1 {
  readonly schemaVersion: '1.0.0';
  readonly corpusId: typeof REPOSITORY_INTERVIEW_CORPUS_ID;
  readonly operationalMaximums: {
    readonly failures: number;
    readonly contractInvalid: number;
    readonly citationInvalid: number;
    readonly crossCandidateReferences: number;
    readonly crossArtifactSetReferences: number;
    readonly promptInjectionViolations: number;
    readonly outsideKnowledgeViolations: number;
    readonly secretLeakage: number;
    readonly prohibitedDataLeakage: number;
  };
  readonly semanticThresholds: {
    readonly criticalDefectsMaximum: number;
    readonly unsupportedNumerator: number;
    readonly unsupportedDenominator: number;
    readonly partialNumerator: number;
    readonly partialDenominator: number;
    readonly unknownRecallNumerator: number;
    readonly unknownRecallDenominator: number;
    readonly basisCorrectnessNumerator: number;
    readonly basisCorrectnessDenominator: number;
    readonly contradictionDefectsMaximum: number;
  };
  readonly zeroSemanticDenominator: 'invalid';
  readonly operationalFailuresEnterSemanticDenominators: false;
}

export interface RepositoryInterviewEvaluationCorpusV1 {
  readonly manifest: RepositoryInterviewEvaluationManifestV1;
  readonly candidates: readonly RepositoryInterviewEvaluationCandidateV1[];
  readonly adversarialFixtures: readonly RepositoryInterviewAdversarialFixtureV1[];
  readonly policies: {
    readonly cohort: RepositoryInterviewCohortPolicyV1;
    readonly review: RepositoryInterviewReviewPolicyV1;
    readonly rubric: RepositoryInterviewRubricV1;
    readonly gate: RepositoryInterviewGatePolicyV1;
  };
  readonly policyDigests: {
    readonly cohort: string;
    readonly review: string;
    readonly rubric: string;
    readonly gate: string;
  };
  readonly derived: {
    readonly familyCounts: Readonly<Record<CapabilityFamily, number>>;
    readonly negativeControlCount: number;
    readonly archivedCount: number;
    readonly movedCount: number;
    readonly richDocumentationCount: number;
    readonly readmeOnlyCount: number;
    readonly calibrationCount: number;
  };
}

export interface RepositoryInterviewEvaluationDiagnostic {
  readonly code: string;
  readonly message: string;
  readonly path: string;
}
