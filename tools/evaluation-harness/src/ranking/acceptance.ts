import { rankingSemanticDigest } from './stable-json.ts';

export const RANKING_V1_REVIEWED_CONTENT_HEAD =
  '700e84b6c50b326d3c6d2913634a221d4643756e' as const;
export const RANKING_V1_ACCEPTED_GOLD_DIGEST =
  '48644422e325ecf385ae8fe3ef71a936549eab6ae0f1f75b98feaadc8640b081' as const;
export const RANKING_V1_ACCEPTED_CORE_AUTHORITY_DIGEST =
  '061e4774c1ab5f9a3793aaa46dfd917597f0378fb882c80f30b15a6431fb225e' as const;

const ACCEPTED_CASE_IDS = [
  'rank-audit-01-controlled-a',
  'rank-audit-02-controlled-b',
  'rank-audit-03-no-viable',
  'rank-audit-04-insufficient',
  'rank-audit-05-popularity-over-fit',
  'rank-audit-06-incomparable',
  'rank-auth-01-controlled-a',
  'rank-auth-02-controlled-b',
  'rank-auth-03-no-viable',
  'rank-auth-04-insufficient',
  'rank-auth-05-popularity-over-fit',
  'rank-auth-06-tie',
  'rank-jobs-01-controlled-a',
  'rank-jobs-02-controlled-b',
  'rank-jobs-03-no-viable',
  'rank-jobs-04-insufficient',
  'rank-jobs-05-popularity-over-fit',
  'rank-jobs-06-tie',
  'rank-rate-01-controlled-a',
  'rank-rate-02-controlled-b',
  'rank-rate-03-no-viable',
  'rank-rate-04-insufficient',
  'rank-rate-05-popularity-over-fit',
  'rank-rate-06-incomparable',
  'rank-webhook-01-controlled-a',
  'rank-webhook-02-controlled-b',
  'rank-webhook-03-no-viable',
  'rank-webhook-04-insufficient',
  'rank-webhook-05-popularity-over-fit',
  'rank-webhook-06-tie',
] as const;

const REVIEWED_CONTENT_FILES = [
  reviewedFile(
    'audit-classification',
    'audit/case-classifications.json',
    'beec5453a60944fec81b1cfbfe1530ccf82189df3efcceec9eb97c162bc1d36d',
  ),
  reviewedFile(
    'baseline-prediction',
    'baselines/predictions/all-insufficient.json',
    'bca29fe94135565b6a89007fd28a95b4e2d51aee72b81ba34a1073a28aac8015',
  ),
  reviewedFile(
    'baseline-prediction',
    'baselines/predictions/hard-conflict-control.json',
    '7848c6ec31f3b5b53ed696172647bd34c2bc0d6a393e680e286d256b1973a9ec',
  ),
  reviewedFile(
    'baseline-prediction',
    'baselines/predictions/retrieval-order.json',
    '4fb9699f67bd2697f9e40aa6b08f2af45d33df6609ad38f5c480f69e2667efb6',
  ),
  reviewedFile(
    'baseline-prediction',
    'baselines/predictions/target-aware.json',
    'ac2e8104393139434852bac4d0449058f2dd6db4f0ac7ba44ad3385020bda983',
  ),
  reviewedFile(
    'baseline-prediction',
    'baselines/predictions/target-blind.json',
    'c69fb21918e732adf302c760ec45c4426e23a87587601ab4ad8dbe1049e69511',
  ),
  reviewedFile(
    'baseline-specifications',
    'baselines/specifications.json',
    '1157ea3ba959432950433154e9f12c49fc167a423fd197a4ada945f70b1e0cfe',
  ),
  reviewedFile(
    'blind-cases',
    'blind/cases.json',
    'b366b393ac125b06644ee6041117f244fa20fe0312c9b6b8a0731f49e257b3c9',
  ),
  reviewedFile(
    'composition-input',
    'composition/blind-inputs.json',
    'e7c7646cb3f57d459f8feb1a5eae7b3be22a3bba31230e12f065b1d7dfbe89bc',
  ),
  reviewedFile(
    'composition-gold',
    'composition/gold.json',
    '06fa26bc60242a15f3a1bc6cc5733d1df30438bfdac1204a91c404ce2afa6fe8',
  ),
  reviewedFile(
    'composition-prediction',
    'composition/predictions.json',
    '4bcbf2c13b51dad18ebd0a0051586dcfab86fdcc21de812dc6af51c43e4b7682',
  ),
  reviewedFile(
    'candidate-evidence',
    'evidence/candidate-evidence.json',
    '8f73c6e213fd4da46cf14cabf6822e6936bc44c8107e0e2250c310d225bbb4c0',
  ),
  reviewedFile(
    'scorer-fixture-summary',
    'fixtures/scorer-fixture-summary.json',
    '6878c80bca0ff585ccc53e4d93150d776ef40a497e6c84302d4526a143fe7e0d',
  ),
  reviewedFile(
    'gate-review-input',
    'gates/proposed-review-inputs.json',
    '219a03d4645207aedd9cb1e6531b03c6260fc903dcbab8c3c02667e701ea522a',
  ),
  reviewedFile(
    'proposed-gold',
    'gold/outcomes.json',
    '0b81f2a4c1c80f46a0deeff4c6cecb7ad750c0f0861d30ff1ad27c6c8aad9635',
  ),
  reviewedFile(
    'phase9-handoff',
    'handoff/phase9-lanes.json',
    '236c9e691edacff9022621e17f09c5618252220151f9c719f683d1e3fa636ef1',
  ),
  reviewedFile(
    'baseline-report',
    'reports/baseline-report.json',
    'e0048fb799f2dad0ea06b307e1af0ab0686659213f3d4885e0acbe1f884861a8',
  ),
  reviewedFile(
    'composition-report',
    'reports/composition-report.json',
    '5ae883e408ab5987feac37da145bbf6fcf015c463bfc687c7fbd3d03164d29a0',
  ),
  reviewedFile(
    'performance-reference',
    'reports/performance-reference.json',
    'b0cda6174e8464169152f100fc7408aa5b198529f993ee183e0089c65f58ecf9',
  ),
  reviewedFile(
    'review-record',
    'reviews/proposed-review-record.json',
    'ab8981840fd50b65896e77df6471b4236ad90bea540dfe5e719fb51235475121',
  ),
  reviewedFile(
    'reviewer-rationale',
    'reviews/reviewer-rationale.json',
    '9e6d0491a7bf27f983ae3987d832e035eff1612b8a36a2b96f316ad1e5395074',
  ),
] as const;

function reviewedFile(kind: string, path: string, sha256: string) {
  return { kind, path, sha256 } as const;
}

export function createRankingAcceptedReviewRecord() {
  const withoutDigest = {
    reviewRecordVersion: 'ranking-v1-accepted-review/1.0.0' as const,
    corpusId: 'ranking-v1' as const,
    status: 'accepted' as const,
    author: 'Codex' as const,
    reviewRole: 'independent-maintainer-review' as const,
    reviewerIdentity: null,
    reviewBasis: {
      description:
        'Independent maintainer review of the exact corrected Milestone 2 content head.',
      reviewedContentHead: RANKING_V1_REVIEWED_CONTENT_HEAD,
      reviewedManifestVersion: 'ranking-v1-manifest/3.0.0' as const,
      reviewedManifestDigest:
        '458b7d521ec56cbb3c0593336f46ad12581f190412527948ea47f61e1e27787b',
      publishedCorrectionSequence: [
        'd4d9c4f482ee23e953f62dc334aa1b7c8e7ab71d',
        '167bc89b3bf1ed48821c9f4b66c10d261be841ec',
        RANKING_V1_REVIEWED_CONTENT_HEAD,
      ],
    },
    bindings: {
      goldAuthorityVersion: 'ranking-v1-proposed-gold/3.0.0' as const,
      goldDigest: RANKING_V1_ACCEPTED_GOLD_DIGEST,
      coreAuthorityDigest: RANKING_V1_ACCEPTED_CORE_AUTHORITY_DIGEST,
      scorerVersion: 'ranking-v1-scorer/2.0.0' as const,
      baselineSpecificationAuthorityVersion:
        'ranking-v1-baseline-specifications/3.0.0' as const,
      baselineSpecificationAuthorityDigest:
        '7b26826f7e85eef3c6bbd887a21f76a2bb4d2519e2997ddb7a11148e38823061',
      reviewerRationaleVersion: 'ranking-v1-reviewer-rationale/2.0.0' as const,
      reviewerRationaleDigest:
        '3be6bd29185c67be39b6c09bd0976d47da09731824b1ca3199746594c19ea779',
      baselineReportVersion: 'ranking-v1-baseline-report/3.0.0' as const,
      baselineReportDigest:
        '627b05e21eb1595855d20e7325e79872924933216377edfe0ca97cfcb39dd34d',
    },
    reviewedContentFiles: REVIEWED_CONTENT_FILES,
    productRankingOutputObservedBeforeReview: false as const,
    candidateAuthorityM3OutputObservedBeforeReview: false as const,
    acceptedCaseIds: ACCEPTED_CASE_IDS,
    disputedCaseIds: [] as const,
    adjudication:
      'accepted-as-authored-after-published-correction-sequence' as const,
    reviewReference: {
      governingIssue: '#32' as const,
      authority: 'phase-10-m2-acceptance-bookkeeping' as const,
    },
    reviewedAt: '2026-08-10T22:57:55Z' as const,
  };
  return {
    ...withoutDigest,
    semanticDigest: rankingSemanticDigest(withoutDigest),
  };
}

function createReadinessPolicy() {
  const withoutDigest = {
    policyVersion: 'ranking-v1-deterministic-readiness-policy/1.0.0' as const,
    denominatorAuthority: 'ranking-decision-denominator/1.0.0' as const,
    denominatorSize: 18 as const,
    minimumReadyFields: 13 as const,
    exactPercentage: 72.222222 as const,
    readyFieldDefinition:
      'A field counts only when an explicit, versioned, reproducible deterministic extraction rule produces the field from accepted bounded source authority without human/model judgment in the generation step, and every applicable catalog candidate has accepted known or deterministic-not-applicable closure under accepted freshness/version semantics.',
    numeratorExclusions: [
      'human-reviewed-structured-values',
      'model-derived-values',
      'unknown-values',
    ] as const,
    unknownValuesNeverFavorable: true as const,
    breadthQualification: {
      rule: 'At least one ready deterministic field is required from every breadth group.',
      groups: {
        capabilityAdoption: [
          'adoption-unit-type',
          'capability-variants-features',
        ],
        stackPackage: [
          'language-ecosystem',
          'package-publication-version',
          'runtime-package-format',
          'framework-compatibility',
          'datastore-requirements',
          'package-repository-linkage',
        ],
        infrastructureDeployment: [
          'required-infrastructure',
          'optional-infrastructure',
          'deployment-self-hosting',
          'operational-complexity-primitives',
        ],
        policyRisk: [
          'license-identity',
          'archived-state',
          'maintenance-activity',
          'release-state-recency',
          'security-advisory-state',
          'security-policy-presence',
        ],
      },
    },
    m3MayExceedMinimum: true as const,
    coverageObservedBeforeSelection: false as const,
    changeControl:
      'Any denominator, qualification, or percentage change requires independent ADR review before production ranking output exists.',
  };
  return {
    ...withoutDigest,
    semanticDigest: rankingSemanticDigest(withoutDigest),
  };
}

export function createRankingAcceptedGateAuthority() {
  const readinessPolicy = createReadinessPolicy();
  const withoutDigest = {
    authorityVersion: 'ranking-v1-accepted-gates/1.0.0' as const,
    corpusId: 'ranking-v1' as const,
    status: 'accepted' as const,
    reviewedContentHead: RANKING_V1_REVIEWED_CONTENT_HEAD,
    bindings: {
      acceptedReviewVersion: 'ranking-v1-accepted-review/1.0.0' as const,
      acceptedReviewDigest: createRankingAcceptedReviewRecord().semanticDigest,
      goldDigest: RANKING_V1_ACCEPTED_GOLD_DIGEST,
      coreAuthorityDigest: RANKING_V1_ACCEPTED_CORE_AUTHORITY_DIGEST,
      scorerVersion: 'ranking-v1-scorer/2.0.0' as const,
      baselineSpecificationAuthorityVersion:
        'ranking-v1-baseline-specifications/3.0.0' as const,
      baselineSpecificationAuthorityDigest:
        '7b26826f7e85eef3c6bbd887a21f76a2bb4d2519e2997ddb7a11148e38823061',
      reviewerRationaleVersion: 'ranking-v1-reviewer-rationale/2.0.0' as const,
      reviewerRationaleDigest:
        '3be6bd29185c67be39b6c09bd0976d47da09731824b1ca3199746594c19ea779',
      baselineReportDigest:
        '627b05e21eb1595855d20e7325e79872924933216377edfe0ca97cfcb39dd34d',
      performanceReferenceDigest:
        'f848f261551f7bda8322dd4ab244646d50ec6cdcb5ff1bf019a802de2f435f30',
      compositionReportDigest:
        '94fd46d697beed27e76c732236c5ea3dbc44eebbbc764d6f829a79db2d085899',
    },
    interpretation: {
      acceptedAs:
        'independently-reviewed-deterministic-scenario-conformance-authority-for-ranking-v1' as const,
      notClaims: [
        'evaluation-fixtures-are-current-production-truth-about-named-projects',
        'statistical-open-world-ranking-accuracy',
        'gitblocks-beats-unaided-expert-or-general-agent-research',
        'production-candidate-authority',
      ] as const,
      fixtureEvidenceScope:
        'Scenario-synthetic and pilot-crosswalk evidence is evaluation authority only; current candidate facts remain Milestone 3 responsibility.',
    },
    fixedCandidateQualityGate: {
      track: 'fixed-candidate-ranking' as const,
      suiteInterpretation:
        'deterministic-acceptance-suite-not-statistical-sample' as const,
      safety: {
        requiredValue: 0 as const,
        metrics: [
          'knownHardConflictRecommended',
          'knownHardConflictViable',
          'knownHardConflictRanked',
          'candidateInvention',
          'candidateSetMismatch',
          'excludedCandidateLeakage',
          'unresolvedEvidenceNeededPositivePromotion',
          'missingEvidenceNeededResolution',
          'preferenceHardenedIntoHardConflict',
          'unboundSuccessConditionCountedFavorable',
          'unboundPreferenceAffectedOrder',
        ],
        rankingReferenceInvariants: [
          'no-candidate-reference-outside-supplied-candidate-set',
          'ranking-reference-union-does-not-exceed-requested-maximum-results',
          'no-omitted-overflow-candidate-in-rank-groups-relations-or-incomparable-pairs',
        ],
      },
      responsibleOutcome: {
        overall: exact(30),
        perFamily: {
          authorization: exact(6),
          'audit-logging': exact(6),
          'background-jobs': exact(6),
          'rate-limiting': exact(6),
          webhooks: exact(6),
        },
        byLabel: {
          recommend: exact(20),
          'no-viable-candidate': exact(5),
          'insufficient-evidence': exact(5),
        },
      },
      candidateDispositions: {
        exactAssessments: exact(120),
        maximumOffDiagonalConfusion: 0 as const,
        applicablePerDispositionPrecision: 1 as const,
        applicablePerDispositionRecall: 1 as const,
        applicablePerDispositionF1: 1 as const,
      },
      controlledTargetPairs: {
        exactPairCorrect: exact(5),
        wrongMaximalSet: 0 as const,
        wrongDirection: 0 as const,
        unchangedWhenChangeRequired: 0 as const,
        supersetRecommendationPasses: false as const,
      },
      partialOrder: {
        overall: exact(22),
        ordered: exact(16),
        ties: exact(4),
        incomparable: exact(2),
        falseOrdersOfIncomparable: 0 as const,
      },
      topThreeUsefulness: exact(20),
      evidenceNeededClosure: {
        overall: exact(35),
        satisfied: exact(15),
        conflict: exact(10),
        unresolved: exact(10),
        illegalPromotions: 0 as const,
      },
      criterionBinding: {
        boundSuccessConditionCoverage: exact(208),
        materialUnboundFailClosed: exact(20),
        approvedNonMaterialUnbound: exact(12),
        boundPreferenceComparisonConsequence: exact(25),
        unboundPreferenceCounterfactualNonEffect: exact(5),
        noPreferenceHardening: exact(30),
      },
      traceability: {
        requiredEvidenceAssociations: exact(225),
        requiredReasonCodes: exact(120),
        requiredMaterialUnknowns: exact(30),
        requiredHardConflicts: exact(70),
        unsupportedExtraAssociations: 0 as const,
        evidenceAssociationMeaning:
          'decision-relevant-evidence-not-all-available-observations' as const,
        fullEvidencePreservationIsSeparateContractConformance: true as const,
      },
    },
    baselineReferenceFloor: {
      baselineId: 'weak-target-aware-exact-compatibility' as const,
      baselineVersion:
        'ranking-weak-target-aware-exact-compatibility/3.0.0' as const,
      specificationDigest:
        '07ac2b65b9b3bc2c762f52e8a2aa93ff2966edf0d7a2f836631d41eae649b9b3',
      predictionDigest:
        '84917eb98dde5d0282fbf06723a23a54a1d67ad7ba08ec2cca9412963f607762',
      scoreDigest:
        '1cf06939ef87ece46813f09ad6079dc8dc9e30abda7c08f0e5d2fd49f56f146d',
      observedReference: {
        responsibleOutcome: exact(30),
        topThreeUsefulness: exact(20),
        safetyViolations: 0 as const,
        controlledTargetPairs: { correct: 2 as const, total: 5 as const },
        partialOrder: { correct: 6 as const, total: 22 as const },
        preferenceAndEvidenceAssociationBehavior: 'incomplete' as const,
      },
      interpretation:
        'reference-floor-not-acceptance-ceiling; production must demonstrate the ranking intelligence missing from this baseline',
    },
    compositionDiagnostic: {
      authorityScope:
        'five-case-retrieval-to-ranking-handoff-diagnostic-only' as const,
      reportVersion: 'ranking-v1-composition-report/2.0.0' as const,
      reportDigest:
        '94fd46d697beed27e76c732236c5ea3dbc44eebbbc764d6f829a79db2d085899',
      temporaryInsufficientEvidenceOutcomesAreProductionTargets: false as const,
      fixedCandidateQualityGate: false as const,
      m6Requirements: [
        'accepted-phase9-retrieval-unchanged',
        'exact-candidate-handoff',
        'zero-excluded-or-invented-candidate-leakage',
        'retrieval-score-and-order-never-become-fit-evidence',
        'clean-authority-and-version-binding',
      ] as const,
      futureCandidateAuthorityClaimsRequireAcceptedM3Authority: true as const,
      acceptedFixedCandidateGoldMayBeMutated: false as const,
    },
    deterministicReadiness: readinessPolicy,
    performanceResourceGate: {
      maximumLegalEnvelope: {
        candidates: 20 as const,
        candidateEvidenceObservations: 2000 as const,
        rankingCriteria: 60 as const,
        unorderedCandidatePairs: 190 as const,
      },
      referenceEvidence: {
        version: 'ranking-v1-performance-reference/2.0.0' as const,
        digest:
          'f848f261551f7bda8322dd4ab244646d50ec6cdcb5ff1bf019a802de2f435f30',
        scope: 'evaluation-data-evidence' as const,
        productionRankingBenchmark: false as const,
      },
      productionPureEngineBudgets: {
        parseValidationP95Milliseconds: 50 as const,
        candidateEvidenceTraversalP95Milliseconds: 25 as const,
        pairEnumerationP95Milliseconds: 10 as const,
        canonicalizationP95Milliseconds: 75 as const,
        combinedBoundedRankingWorkP95Milliseconds: 100 as const,
        combinedMaximumMilliseconds: 250 as const,
        retainedHeapGrowthMaximumMebibytes: 16 as const,
        retainedHeapGrowthMaximumBytes: 16_777_216 as const,
      },
      contextRecordingRequired: true as const,
    },
    determinismMechanicalGate: {
      repeatedIdenticalExecutions: 100 as const,
      inputOrderPermutations: 20 as const,
      freshProcessExecutions: 10 as const,
      canonicalOutputRequirement: 'byte-identical' as const,
      permutationRequirement: 'byte-identical-semantic-output' as const,
      freshProcessRequirement: 'identical-canonical-result-and-digest' as const,
      prohibitedDependencies: [
        'ambient-random-source',
        'ambient-clock',
        'environment-variable-behavior',
        'network',
        'filesystem-mutation',
        'database',
        'model-or-provider',
      ] as const,
      candidateIdMayDecideFit: false as const,
      candidateIdMayCanonicalizeAlreadyDerivedRelation: true as const,
      retrievalOrderOrScoreMayDecideFit: false as const,
      m6MayStrengthenButNotWeakenAfterProductOutput: true as const,
    },
    milestoneAuthorization: {
      milestone2: 'accepted' as const,
      milestone3: 'authorized-but-not-begun' as const,
      milestone3AllowedScope: [
        'adr-0011-candidate-authority-successor',
        'ordinary-runtime-authority-for-all-150-catalog-candidates',
        'accepted-ranking-v1-consumed-facts-and-evidence-only',
        'compatible-accepted-phase8-deterministic-collection-and-projection-reuse',
        'fit-consumable-evidence-and-dossier-projections',
        'measurement-against-frozen-readiness-policy',
      ] as const,
      milestone3ProhibitedScope: [
        'production-ranking-package',
        'ranking-benchmark-output',
        'm4-contracts-or-package',
        'm5-ranking-behavior',
        'models-or-interviews',
        'vectors-or-search-infrastructure',
        'scanner-mcp-api-or-skill',
        'database-resurrection',
        'phase8-execute-5',
      ] as const,
      milestone3WorkBeganInAcceptanceOperation: false as const,
    },
  };
  return {
    ...withoutDigest,
    semanticDigest: rankingSemanticDigest(withoutDigest),
  };
}

function exact(total: number) {
  return { correct: total, total } as const;
}

export type RankingAcceptedReviewRecord = ReturnType<
  typeof createRankingAcceptedReviewRecord
>;
export type RankingAcceptedGateAuthority = ReturnType<
  typeof createRankingAcceptedGateAuthority
>;
