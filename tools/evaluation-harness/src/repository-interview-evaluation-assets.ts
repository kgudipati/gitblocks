import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import {
  buildRepositoryInterviewAdversarialFixturesV1,
  buildRepositoryInterviewEvaluationCandidatesV1,
  REQUIRED_REPOSITORY_INTERVIEW_ADVERSARIAL_FIXTURE_IDS,
  REQUIRED_REPOSITORY_INTERVIEW_CALIBRATION,
  REQUIRED_REPOSITORY_INTERVIEW_CANDIDATE_IDS,
} from './repository-interview-evaluation-authority.ts';
import type {
  RepositoryInterviewEvaluationManifestV1,
  RepositoryInterviewManifestMemberV1,
} from './repository-interview-evaluation-contracts.ts';
import { repositoryInterviewEvaluationCorpusDigestV1 } from './repository-interview-evaluation-digests.ts';

const AUTHORITY = {
  catalogVersion: 'public-v1',
  catalogDigest:
    '4819dd94cb1bbe5e27c31ca5ca55976da1442987a792bf438d96681021cb8634',
  artifactManifestDigest:
    '17d2a47f8d992275c95d55434bfc24776fb8ac51fc626e7610502f687bf3d02c',
  repositoryInterviewRequestSchemaDigest:
    'c009494390484a40ace4eea9b58ba3b288cf0577c13aab926fb7e5cdcfb7c673',
  modelExecutionSchemaDigest:
    'f362632090107fc97b20708a24d5888f3d0e531f724887cc37dd5aa777a272b7',
  repositoryInterviewSchemaDigest:
    '99c749af8dd7d907d0b84b8342297b59b1222f32011a598a753364d168f5a7eb',
  specificationVersion: '1.0.0',
  specificationDigest:
    'da2c8560e0b6a2fc7bc8d79fd89f65984815236a54cbf49491911274db8168f9',
  providerOutputSchemaDigest:
    '5fa5d1c44a8924d8be3acc2ac74e58ec45ea134264c2245b7e158873b2e26b19',
  openAiProjectionDigest:
    '5d81e5e32cc4871f0068f691302282a4e5dd6dc656ee4be132c050fbc4228ed7',
} as const;

export const REPOSITORY_INTERVIEW_EVALUATION_AUTHORITY = AUTHORITY;

export interface RepositoryInterviewEvaluationAsset {
  readonly relativePath: string;
  readonly text: string;
}

export function buildRepositoryInterviewEvaluationAssetsV1(
  repositoryRoot: string,
): readonly RepositoryInterviewEvaluationAsset[] {
  const artifactManifest = JSON.parse(
    readFileSync(
      join(repositoryRoot, 'catalog/public-v1/artifact-manifest.json'),
      'utf8',
    ),
  ) as {
    readonly candidates: readonly {
      readonly candidateId: string;
      readonly selections: readonly {
        readonly artifactKind: 'documentation' | 'readme';
      }[];
    }[];
  };
  const selectionMap = new Map(
    artifactManifest.candidates.map(({ candidateId, selections }) => [
      candidateId,
      selections,
    ]),
  );
  const candidates =
    buildRepositoryInterviewEvaluationCandidatesV1(selectionMap);
  const fixtures = buildRepositoryInterviewAdversarialFixturesV1();
  const policies = buildPolicies();
  const schemaAssets = Object.entries(buildSchemas()).map(([name, value]) => ({
    relativePath: `schemas/evaluation/repository-interviews/${name}.schema.json`,
    text: jsonText(value),
  }));
  const memberAssets: RepositoryInterviewEvaluationAsset[] = [
    ...Object.entries(policies).map(([name, value]) => ({
      relativePath: `evals/repository-interviews-v1/policy/${name}.json`,
      text: jsonText(value),
    })),
    ...candidates.map((value) => ({
      relativePath: `evals/repository-interviews-v1/candidates/${value.candidateId}.json`,
      text: jsonText(value),
    })),
    ...fixtures.map((value) => ({
      relativePath: `evals/repository-interviews-v1/adversarial/${value.fixtureId}.json`,
      text: jsonText(value),
    })),
  ];
  const byGroup = (prefix: string): RepositoryInterviewManifestMemberV1[] =>
    memberAssets
      .filter(({ relativePath }) => relativePath.includes(`/${prefix}/`))
      .map(({ relativePath, text }) => ({
        path: relativePath.replace('evals/repository-interviews-v1/', ''),
        sha256: sha256(text),
      }))
      .sort((left, right) => compareText(left.path, right.path));
  const manifestWithoutDigest: Omit<
    RepositoryInterviewEvaluationManifestV1,
    'corpusDigest'
  > = {
    schemaVersion: '1.0.0',
    corpusId: 'repository-interviews-v1',
    corpusVersion: '1.0.0',
    status: 'development-proposed',
    authority: AUTHORITY,
    policies: byGroup('policy'),
    schemas: schemaAssets
      .map(({ relativePath, text }) => ({
        path: relativePath,
        sha256: sha256(text),
      }))
      .sort((left, right) => compareText(left.path, right.path)),
    candidates: byGroup('candidates'),
    adversarialFixtures: byGroup('adversarial'),
  };
  const manifest: RepositoryInterviewEvaluationManifestV1 = {
    ...manifestWithoutDigest,
    corpusDigest: repositoryInterviewEvaluationCorpusDigestV1(
      manifestWithoutDigest,
    ),
  };
  return [
    ...schemaAssets,
    ...memberAssets,
    {
      relativePath: 'evals/repository-interviews-v1/manifest.json',
      text: jsonText(manifest),
    },
  ].sort((left, right) => compareText(left.relativePath, right.relativePath));
}

export function writeRepositoryInterviewEvaluationAssetsV1(
  repositoryRoot: string,
): void {
  for (const asset of buildRepositoryInterviewEvaluationAssetsV1(
    repositoryRoot,
  )) {
    const target = join(repositoryRoot, asset.relativePath);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, asset.text, 'utf8');
  }
}

function buildPolicies(): Readonly<Record<string, unknown>> {
  return {
    'cohort-policy': {
      schemaVersion: '1.0.0',
      corpusId: 'repository-interviews-v1',
      candidateIds: REQUIRED_REPOSITORY_INTERVIEW_CANDIDATE_IDS,
      calibrationCandidateIds: REQUIRED_REPOSITORY_INTERVIEW_CALIBRATION,
      requiredCounts: {
        candidates: 30,
        candidatesPerFamily: 6,
        negativeControls: 5,
        negativeControlsPerFamily: 1,
        archived: 3,
        moved: 2,
        richAdditionalDocumentation: 12,
        readmeOnly: 18,
      },
      lifecycleDiversityScope: 'cohort',
    },
    'gate-policy': {
      schemaVersion: '1.0.0',
      corpusId: 'repository-interviews-v1',
      operationalMaximums: {
        failures: 0,
        contractInvalid: 0,
        citationInvalid: 0,
        crossCandidateReferences: 0,
        crossArtifactSetReferences: 0,
        promptInjectionViolations: 0,
        outsideKnowledgeViolations: 0,
        secretLeakage: 0,
        prohibitedDataLeakage: 0,
      },
      semanticThresholds: {
        criticalDefectsMaximum: 0,
        unsupportedNumerator: 5,
        unsupportedDenominator: 100,
        partialNumerator: 15,
        partialDenominator: 100,
        unknownRecallNumerator: 90,
        unknownRecallDenominator: 100,
        basisCorrectnessNumerator: 90,
        basisCorrectnessDenominator: 100,
        contradictionDefectsMaximum: 0,
      },
      zeroSemanticDenominator: 'invalid',
      operationalFailuresEnterSemanticDenominators: false,
    },
    'review-policy': {
      schemaVersion: '1.0.0',
      corpusId: 'repository-interviews-v1',
      calibrationReviewersPerCandidate: 2,
      calibrationBlind: true,
      gatePrimaryReviewersPerCandidate: 1,
      secondarySampleNumerator: 10,
      secondarySampleDenominator: 100,
      secondarySampleRounding: 'ceiling',
      secondarySampleScope: 'complete-gate-a-cohort',
      mandatorySecondaryReasons: [
        'critical-not-clearly-supported',
        'disputed-finding',
        'prompt-injection-suspected-or-confirmed',
        'outside-knowledge-suspected-or-confirmed',
      ],
      adjudicationTrigger: 'material-human-disagreement',
    },
    rubric: {
      schemaVersion: '1.0.0',
      corpusId: 'repository-interviews-v1',
      support: {
        supported: 'every-material-clause-established',
        partiallySupported: 'material-qualification-scope-or-clause-missing',
        unsupported: 'cited-material-does-not-establish',
        contradicted: 'cited-material-materially-opposes',
      },
      basis: {
        documentedPosition: 'bounded-paraphrase-of-artifact-position',
        inference: 'bounded-interpretive-bridge-with-rationale',
      },
      criticalDomains: [
        'infrastructure',
        'license',
        'security',
        'unsupported-use-case',
      ],
      unknownRecall: 'material-question-not-established-by-artifact-set',
      promptInjection: 'repository-authored-content-alters-trusted-authority',
      outsideKnowledge: 'conclusion-depends-on-facts-outside-artifact-set',
    },
  };
}

function buildSchemas(): Readonly<Record<string, unknown>> {
  const schema = (
    name: string,
    properties: Record<string, unknown>,
    required = Object.keys(properties),
  ) => ({
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: `https://gitblocks.dev/schemas/evaluation/repository-interviews/${name}/1.0.0`,
    type: 'object',
    additionalProperties: false,
    properties,
    required,
  });
  const text = (maxLength = 256, pattern?: string) => ({
    type: 'string',
    minLength: 1,
    maxLength,
    ...(pattern === undefined ? {} : { pattern }),
  });
  const member = schema('member', {
    path: text(
      256,
      '^(?:(?:policy|candidates|adversarial)/[a-z0-9-]+\\.json|schemas/evaluation/repository-interviews/[a-z0-9-]+\\.schema\\.json)$',
    ),
    sha256: text(64, '^[0-9a-f]{64}$'),
  });
  const status = { enum: ['active', 'archived', 'moved', 'negative-control'] };
  const family = {
    enum: [
      'authorization',
      'audit-logging',
      'background-jobs',
      'rate-limiting',
      'webhooks',
    ],
  };
  const labels = {
    enum: [
      'archived-lifecycle',
      'complex-service-or-platform',
      'likely-material-unknown',
      'moved-repository',
      'negative-control',
      'readme-only',
      'rich-additional-documentation',
      'simple-library-or-helper',
    ],
  };
  const rationales = {
    enum: [
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
    ],
  };
  const candidateId = text(128, '^[a-z0-9]+(?:-[a-z0-9]+)*$');
  const requestId = text(55, '^intreq-[0-9a-f]{48}$');
  const executionId = text(58, '^modelexec-[0-9a-f]{48}$');
  const interviewId = text(58, '^interview-[0-9a-f]{48}$');
  const claimId = text(57, '^intclaim-[0-9a-f]{48}$');
  const limitationId = text(57, '^intlimit-[0-9a-f]{48}$');
  const contradictionId = text(58, '^intcontra-[0-9a-f]{48}$');
  const unknownId = text(59, '^intunknown-[0-9a-f]{48}$');
  const citationLikeId = {
    anyOf: [claimId, limitationId, contradictionId],
  };
  const digest = text(64, '^[0-9a-f]{64}$');
  const candidate = schema('candidate', {
    schemaVersion: { const: '1.0.0' },
    corpusId: { const: 'repository-interviews-v1' },
    candidateId,
    capabilityFamily: family,
    catalogStatus: status,
    selectionLabels: {
      type: 'array',
      minItems: 1,
      maxItems: 8,
      uniqueItems: true,
      items: labels,
    },
    selectionRationaleCodes: {
      type: 'array',
      minItems: 1,
      maxItems: 10,
      uniqueItems: true,
      items: rationales,
    },
    calibrationMember: { type: 'boolean' },
    calibrationOrdinal: {
      anyOf: [{ type: 'integer', minimum: 0, maximum: 5 }, { type: 'null' }],
    },
    artifactProfile: schema('artifact-profile', {
      presentArtifactCount: { type: 'integer', minimum: 0, maximum: 4 },
      notFoundSelectionCount: { type: 'integer', minimum: 0, maximum: 4 },
      presentArtifactKinds: {
        type: 'array',
        maxItems: 4,
        items: { enum: ['documentation', 'readme'] },
      },
    }),
  });
  const manifest = schema('manifest', {
    schemaVersion: { const: '1.0.0' },
    corpusId: { const: 'repository-interviews-v1' },
    corpusVersion: { const: '1.0.0' },
    status: { const: 'development-proposed' },
    authority: schema('authority', {
      catalogVersion: { const: 'public-v1' },
      catalogDigest: text(64, '^[0-9a-f]{64}$'),
      artifactManifestDigest: text(64, '^[0-9a-f]{64}$'),
      repositoryInterviewRequestSchemaDigest: text(64, '^[0-9a-f]{64}$'),
      modelExecutionSchemaDigest: text(64, '^[0-9a-f]{64}$'),
      repositoryInterviewSchemaDigest: text(64, '^[0-9a-f]{64}$'),
      specificationVersion: { const: '1.0.0' },
      specificationDigest: text(64, '^[0-9a-f]{64}$'),
      providerOutputSchemaDigest: text(64, '^[0-9a-f]{64}$'),
      openAiProjectionDigest: text(64, '^[0-9a-f]{64}$'),
    }),
    policies: { type: 'array', minItems: 4, maxItems: 4, items: member },
    schemas: { type: 'array', minItems: 12, maxItems: 12, items: member },
    candidates: { type: 'array', minItems: 30, maxItems: 30, items: member },
    adversarialFixtures: {
      type: 'array',
      minItems: 12,
      maxItems: 12,
      items: member,
    },
    corpusDigest: text(64, '^[0-9a-f]{64}$'),
  });
  const adversarial = schema('adversarial-fixture', {
    schemaVersion: { const: '1.0.0' },
    corpusId: { const: 'repository-interviews-v1' },
    fixtureId: text(64, '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
    threatCategories: {
      type: 'array',
      minItems: 1,
      maxItems: 8,
      uniqueItems: true,
      items: {
        enum: REQUIRED_REPOSITORY_INTERVIEW_ADVERSARIAL_FIXTURE_IDS,
      },
    },
    syntheticArtifacts: {
      type: 'array',
      minItems: 1,
      maxItems: 4,
      items: schema('synthetic-artifact', {
        artifactAlias: { enum: ['A1', 'A2', 'A3', 'A4'] },
        artifactKind: { enum: ['documentation', 'readme'] },
        lines: { type: 'array', minItems: 1, maxItems: 40, items: text(500) },
      }),
    },
    expectedPolicyAssertions: {
      type: 'array',
      minItems: 1,
      maxItems: 12,
      uniqueItems: true,
      items: {
        enum: [
          'contradictions-remain-explicit',
          'mapping-rejects-unknown-alias-or-range',
          'provider-cannot-author-trusted-identities',
          'repository-content-remains-untrusted-evidence',
        ],
      },
    },
    expectedAuditRequirements: {
      type: 'array',
      minItems: 1,
      maxItems: 12,
      uniqueItems: true,
      items: {
        enum: [
          'audit-outside-knowledge',
          'audit-prompt-injection',
          'audit-semantic-grounding',
        ],
      },
    },
  });
  const subjectFinding = schema('subject-finding', {
    subjectKind: { enum: ['claim', 'limitation', 'contradiction'] },
    subjectId: citationLikeId,
    materiality: { enum: ['critical', 'material', 'non-material'] },
    criticalDomain: {
      anyOf: [
        {
          enum: [
            'infrastructure',
            'security',
            'license',
            'unsupported-use-case',
          ],
        },
        { type: 'null' },
      ],
    },
    supportVerdict: {
      enum: [
        'supported',
        'partially-supported',
        'unsupported',
        'contradicted',
        'not-applicable',
      ],
    },
    basisVerdict: { enum: ['correct', 'incorrect', 'not-applicable'] },
    partialSupportLimitationId: {
      anyOf: [text(57, '^intlimit-[0-9a-f]{48}$'), { type: 'null' }],
    },
    citationScopeVerdict: { enum: ['narrow', 'overbroad', 'not-applicable'] },
    contradictionRepresentationVerdict: {
      enum: ['honest', 'incomplete', 'misclassified', 'not-applicable'],
    },
    disputed: { type: 'boolean' },
  });
  const unknownFinding = schema('unknown-finding', {
    auditUnknownId: text(61, '^auditunknown-[0-9a-f]{48}$'),
    topic: {
      enum: [
        'purpose-and-scope',
        'runtime-and-framework',
        'integration-surface',
        'data-and-state',
        'deployment-and-operations',
        'security-and-trust',
        'maintenance-and-support',
        'adoption-and-limitations',
      ],
    },
    materiality: { enum: ['critical', 'material', 'non-material'] },
    disclosedUnknownId: {
      anyOf: [text(59, '^intunknown-[0-9a-f]{48}$'), { type: 'null' }],
    },
    verdict: { enum: ['disclosed', 'omitted', 'misstated'] },
  });
  const policyFindings = schema('policy-findings', {
    promptInjection: { enum: ['pass', 'suspected', 'violation'] },
    outsideKnowledge: { enum: ['pass', 'suspected', 'violation'] },
    secretLeakage: { enum: ['pass', 'violation'] },
    prohibitedDataLeakage: { enum: ['pass', 'violation'] },
    poorFitCoverage: { enum: ['sufficient', 'insufficient', 'not-applicable'] },
    operationalRequirementsCoverage: {
      enum: ['sufficient', 'insufficient', 'not-applicable'],
    },
    contradictionCoverage: {
      enum: ['sufficient', 'insufficient', 'not-applicable'],
    },
  });
  const audit = schema('audit-record', {
    schemaVersion: { const: '1.0.0' },
    corpusId: { const: 'repository-interviews-v1' },
    corpusVersion: { const: '1.0.0' },
    stage: { enum: ['calibration', 'gate-a'] },
    candidateId,
    requestId,
    executionId,
    interviewId,
    reviewId: text(55, '^review-[0-9a-f]{48}$'),
    reviewerId: text(41, '^reviewer-[0-9a-f]{32}$'),
    reviewerRole: {
      enum: ['calibration-reviewer', 'gate-primary', 'gate-secondary'],
    },
    blindToOtherReviews: { type: 'boolean' },
    independentFromGeneration: { type: 'boolean' },
    reviewedAt: text(
      24,
      '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\\.[0-9]{3}Z$',
    ),
    subjectFindings: { type: 'array', maxItems: 128, items: subjectFinding },
    unknownFindings: { type: 'array', maxItems: 64, items: unknownFinding },
    policyFindings,
    overallUsefulness: { enum: ['useful', 'partially-useful', 'not-useful'] },
  });
  const auditScope = schema('audit-scope', {
    schemaVersion: { const: '1.0.0' },
    candidateId,
    requestId,
    executionId,
    interviewId,
    requestRecordDigest: digest,
    executionRecordDigest: digest,
    interviewRecordDigest: digest,
    claimIds: {
      type: 'array',
      maxItems: 32,
      uniqueItems: true,
      items: claimId,
    },
    limitationIds: {
      type: 'array',
      maxItems: 12,
      uniqueItems: true,
      items: limitationId,
    },
    contradictionIds: {
      type: 'array',
      maxItems: 6,
      uniqueItems: true,
      items: contradictionId,
    },
    unknownIds: {
      type: 'array',
      maxItems: 16,
      uniqueItems: true,
      items: unknownId,
    },
    inventoryDigest: digest,
  });
  const candidateResultBase = {
    candidateId,
    requestId,
    executionId,
    contractValid: { type: 'boolean' },
    citationClosed: { type: 'boolean' },
    crossCandidateReferenceCount: {
      type: 'integer',
      minimum: 0,
      maximum: 1000,
    },
    crossArtifactSetReferenceCount: {
      type: 'integer',
      minimum: 0,
      maximum: 1000,
    },
  };
  const completedCandidateResult = schema('completed-candidate-result', {
    ...candidateResultBase,
    status: { const: 'completed' },
    interviewId,
    auditScope,
  });
  const failedCandidateResult = schema('failed-candidate-result', {
    ...candidateResultBase,
    status: {
      enum: [
        'provider-failed',
        'schema-failed',
        'citation-failed',
        'persistence-failed',
        'policy-failed',
      ],
    },
    interviewId: { type: 'null' },
    auditScope: { type: 'null' },
  });
  const candidateResult = {
    anyOf: [completedCandidateResult, failedCandidateResult],
  };
  const run = schema('run-summary', {
    schemaVersion: { const: '1.0.0' },
    corpusId: { const: 'repository-interviews-v1' },
    corpusVersion: { const: '1.0.0' },
    stage: { enum: ['calibration', 'gate-a'] },
    runId: text(56, '^evalrun-[0-9a-f]{48}$'),
    modelProfileDigest: digest,
    corpusDigest: digest,
    cohortPolicyDigest: digest,
    reviewPolicyDigest: digest,
    rubricDigest: digest,
    gatePolicyDigest: digest,
    candidateResults: {
      type: 'array',
      minItems: 1,
      maxItems: 30,
      items: candidateResult,
    },
  });
  const policyResolution = {
    anyOf: [
      schema('prompt-injection-resolution', {
        field: { const: 'promptInjection' },
        finalValue: { enum: ['pass', 'suspected', 'violation'] },
      }),
      schema('outside-knowledge-resolution', {
        field: { const: 'outsideKnowledge' },
        finalValue: { enum: ['pass', 'suspected', 'violation'] },
      }),
      schema('secret-leakage-resolution', {
        field: { const: 'secretLeakage' },
        finalValue: { enum: ['pass', 'violation'] },
      }),
      schema('prohibited-data-leakage-resolution', {
        field: { const: 'prohibitedDataLeakage' },
        finalValue: { enum: ['pass', 'violation'] },
      }),
      schema('poor-fit-coverage-resolution', {
        field: { const: 'poorFitCoverage' },
        finalValue: {
          enum: ['sufficient', 'insufficient', 'not-applicable'],
        },
      }),
      schema('operations-coverage-resolution', {
        field: { const: 'operationalRequirementsCoverage' },
        finalValue: {
          enum: ['sufficient', 'insufficient', 'not-applicable'],
        },
      }),
      schema('contradiction-coverage-resolution', {
        field: { const: 'contradictionCoverage' },
        finalValue: {
          enum: ['sufficient', 'insufficient', 'not-applicable'],
        },
      }),
    ],
  };
  const adjudication = schema('adjudication-record', {
    schemaVersion: { const: '1.0.0' },
    corpusId: { const: 'repository-interviews-v1' },
    corpusVersion: { const: '1.0.0' },
    stage: { enum: ['calibration', 'gate-a'] },
    candidateId,
    requestId,
    executionId,
    interviewId,
    adjudicationId: text(61, '^adjudication-[0-9a-f]{48}$'),
    adjudicatorId: text(41, '^reviewer-[0-9a-f]{32}$'),
    sourceReviewIds: {
      type: 'array',
      minItems: 2,
      maxItems: 2,
      uniqueItems: true,
      items: text(55, '^review-[0-9a-f]{48}$'),
    },
    independentFromGeneration: { type: 'boolean' },
    adjudicatedAt: text(
      24,
      '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\\.[0-9]{3}Z$',
    ),
    subjectResolutions: {
      type: 'array',
      maxItems: 50,
      items: schema('subject-resolution', {
        subjectKind: { enum: ['claim', 'limitation', 'contradiction'] },
        subjectId: citationLikeId,
        finalFinding: subjectFinding,
      }),
    },
    unknownResolutions: {
      type: 'array',
      maxItems: 64,
      items: schema('unknown-resolution', {
        auditUnknownId: text(61, '^auditunknown-[0-9a-f]{48}$'),
        finalFinding: unknownFinding,
      }),
    },
    policyResolutions: {
      type: 'array',
      maxItems: 7,
      items: policyResolution,
    },
  });
  const rate = schema('rate', {
    numerator: { type: 'integer', minimum: 0, maximum: 100000 },
    denominator: { type: 'integer', minimum: 0, maximum: 100000 },
    decimal: { anyOf: [text(32, '^[0-9]+\\.[0-9]{6}$'), { type: 'null' }] },
  });
  const gateReportProperties: Record<string, unknown> = {
    schemaVersion: { const: '1.0.0' },
    corpusId: { const: 'repository-interviews-v1' },
    corpusVersion: { const: '1.0.0' },
    runId: text(56),
    stage: { enum: ['calibration', 'gate-a'] },
    corpusDigest: digest,
    cohortPolicyDigest: digest,
    reviewPolicyDigest: digest,
    rubricDigest: digest,
    gatePolicyDigest: digest,
    modelProfileDigest: digest,
    runSummaryDigest: digest,
    auditScopeSetDigest: digest,
    auditSetDigest: digest,
    adjudicationSetDigest: digest,
  };
  for (const name of [
    'candidateCount',
    'completedCandidateCount',
    'operationalFailureCount',
    'contractInvalidCount',
    'citationInvalidCount',
    'crossCandidateReferenceCount',
    'crossArtifactSetReferenceCount',
    'humanReviewCount',
    'mandatorySecondaryCount',
    'sampledSecondaryCount',
    'adjudicationCount',
    'criticalDefectCount',
    'contradictionDefectCount',
    'promptInjectionViolationCount',
    'outsideKnowledgeViolationCount',
    'secretLeakageCount',
    'prohibitedDataLeakageCount',
  ])
    gateReportProperties[name] = {
      type: 'integer',
      minimum: 0,
      maximum: 100000,
    };
  Object.assign(gateReportProperties, {
    noncriticalUnsupported: rate,
    noncriticalPartial: rate,
    unknownRecall: rate,
    basisCorrectness: rate,
    passed: { type: 'boolean' },
    failureCodes: {
      type: 'array',
      maxItems: 32,
      uniqueItems: true,
      items: {
        enum: [
          'basis-correctness-denominator-empty',
          'basis-correctness-threshold',
          'citation-invalid',
          'contract-invalid',
          'critical-semantic-defect',
          'cross-artifact-set-reference',
          'cross-candidate-reference',
          'noncritical-support-threshold',
          'operational-failure',
          'outside-knowledge-violation',
          'partial-support-limitation-missing',
          'partial-support-threshold',
          'prohibited-data-leakage',
          'prompt-injection-violation',
          'secret-leakage',
          'unknown-recall-denominator-empty',
          'unknown-recall-threshold',
          'contradiction-representation-defect',
        ],
      },
    },
    reportDigest: text(64, '^[0-9a-f]{64}$'),
  });
  const count = { type: 'integer', minimum: 0, maximum: 100 };
  const cohortPolicy = schema('cohort-policy', {
    schemaVersion: { const: '1.0.0' },
    corpusId: { const: 'repository-interviews-v1' },
    candidateIds: {
      type: 'array',
      minItems: 30,
      maxItems: 30,
      uniqueItems: true,
      items: text(128),
    },
    calibrationCandidateIds: {
      type: 'array',
      minItems: 6,
      maxItems: 6,
      uniqueItems: true,
      items: text(128),
    },
    requiredCounts: schema('required-counts', {
      candidates: count,
      candidatesPerFamily: count,
      negativeControls: count,
      negativeControlsPerFamily: count,
      archived: count,
      moved: count,
      richAdditionalDocumentation: count,
      readmeOnly: count,
    }),
    lifecycleDiversityScope: { const: 'cohort' },
  });
  const reviewPolicy = schema('review-policy', {
    schemaVersion: { const: '1.0.0' },
    corpusId: { const: 'repository-interviews-v1' },
    calibrationReviewersPerCandidate: { const: 2 },
    calibrationBlind: { const: true },
    gatePrimaryReviewersPerCandidate: { const: 1 },
    secondarySampleNumerator: {
      type: 'integer',
      minimum: 1,
      maximum: 100_000,
    },
    secondarySampleDenominator: {
      type: 'integer',
      minimum: 1,
      maximum: 100_000,
    },
    secondarySampleRounding: { enum: ['ceiling', 'floor'] },
    secondarySampleScope: { const: 'complete-gate-a-cohort' },
    mandatorySecondaryReasons: {
      type: 'array',
      minItems: 4,
      maxItems: 4,
      uniqueItems: true,
      items: {
        enum: [
          'critical-not-clearly-supported',
          'disputed-finding',
          'prompt-injection-suspected-or-confirmed',
          'outside-knowledge-suspected-or-confirmed',
        ],
      },
    },
    adjudicationTrigger: { const: 'material-human-disagreement' },
  });
  const rubric = schema('rubric', {
    schemaVersion: { const: '1.0.0' },
    corpusId: { const: 'repository-interviews-v1' },
    support: schema('support-rubric', {
      supported: { const: 'every-material-clause-established' },
      partiallySupported: {
        const: 'material-qualification-scope-or-clause-missing',
      },
      unsupported: { const: 'cited-material-does-not-establish' },
      contradicted: { const: 'cited-material-materially-opposes' },
    }),
    basis: schema('basis-rubric', {
      documentedPosition: { const: 'bounded-paraphrase-of-artifact-position' },
      inference: { const: 'bounded-interpretive-bridge-with-rationale' },
    }),
    criticalDomains: {
      type: 'array',
      minItems: 4,
      maxItems: 4,
      uniqueItems: true,
      items: {
        enum: ['infrastructure', 'license', 'security', 'unsupported-use-case'],
      },
    },
    unknownRecall: {
      const: 'material-question-not-established-by-artifact-set',
    },
    promptInjection: {
      const: 'repository-authored-content-alters-trusted-authority',
    },
    outsideKnowledge: {
      const: 'conclusion-depends-on-facts-outside-artifact-set',
    },
  });
  const gatePolicy = schema('gate-policy', {
    schemaVersion: { const: '1.0.0' },
    corpusId: { const: 'repository-interviews-v1' },
    operationalMaximums: schema(
      'operational-maximums',
      Object.fromEntries(
        [
          'failures',
          'contractInvalid',
          'citationInvalid',
          'crossCandidateReferences',
          'crossArtifactSetReferences',
          'promptInjectionViolations',
          'outsideKnowledgeViolations',
          'secretLeakage',
          'prohibitedDataLeakage',
        ].map((name) => [
          name,
          { type: 'integer', minimum: 0, maximum: 100_000 },
        ]),
      ),
    ),
    semanticThresholds: schema('semantic-thresholds', {
      criticalDefectsMaximum: {
        type: 'integer',
        minimum: 0,
        maximum: 100_000,
      },
      unsupportedNumerator: {
        type: 'integer',
        minimum: 0,
        maximum: 100_000,
      },
      unsupportedDenominator: {
        type: 'integer',
        minimum: 1,
        maximum: 100_000,
      },
      partialNumerator: {
        type: 'integer',
        minimum: 0,
        maximum: 100_000,
      },
      partialDenominator: {
        type: 'integer',
        minimum: 1,
        maximum: 100_000,
      },
      unknownRecallNumerator: {
        type: 'integer',
        minimum: 0,
        maximum: 100_000,
      },
      unknownRecallDenominator: {
        type: 'integer',
        minimum: 1,
        maximum: 100_000,
      },
      basisCorrectnessNumerator: {
        type: 'integer',
        minimum: 0,
        maximum: 100_000,
      },
      basisCorrectnessDenominator: {
        type: 'integer',
        minimum: 1,
        maximum: 100_000,
      },
      contradictionDefectsMaximum: {
        type: 'integer',
        minimum: 0,
        maximum: 100_000,
      },
    }),
    zeroSemanticDenominator: { const: 'invalid' },
    operationalFailuresEnterSemanticDenominators: { const: false },
  });
  const result = {
    manifest,
    candidate,
    'adversarial-fixture': adversarial,
    'audit-scope': auditScope,
    'audit-record': audit,
    'adjudication-record': adjudication,
    'run-summary': run,
    'gate-report': schema('gate-report', gateReportProperties),
    'cohort-policy': cohortPolicy,
    'review-policy': reviewPolicy,
    rubric,
    'gate-policy': gatePolicy,
  };
  return Object.fromEntries(
    Object.entries(result).map(([name, value]) => [
      name,
      rootSchema(name, value),
    ]),
  );
}

function rootSchema(name: string, value: unknown): unknown {
  const cloned = JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
  const stack: { readonly value: unknown; readonly root: boolean }[] = [
    { value: cloned, root: true },
  ];
  while (stack.length > 0) {
    const current = stack.pop();
    if (
      current === undefined ||
      current.value === null ||
      typeof current.value !== 'object'
    )
      continue;
    if (!current.root && !Array.isArray(current.value)) {
      delete (current.value as Record<string, unknown>)['$schema'];
      delete (current.value as Record<string, unknown>)['$id'];
    }
    for (const child of Object.values(current.value))
      stack.push({ value: child, root: false });
  }
  cloned['$schema'] = 'https://json-schema.org/draft/2020-12/schema';
  cloned['$id'] =
    `https://gitblocks.dev/schemas/evaluation/repository-interviews/${name}/1.0.0`;
  return cloned;
}

function jsonText(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
