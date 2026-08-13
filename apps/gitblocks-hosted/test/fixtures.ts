import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import {
  CONTRACT_VERSION,
  createCandidateRetrievalRequestV1,
  normalizeCapabilityQueryV1,
  parseCandidateRetrievalMetadataAuthorityV1,
  parseCapabilityRetrievalExpansionV1,
  parseCapabilityTaxonomyV1,
  parseDeterministicCandidateProfileAuthorityV1,
  repositoryFingerprintDigestV1,
  type CandidateDossierV1,
  type CandidateRetrievalMetadataAuthorityV1,
  type CandidateRetrievalResultV1,
  type CapabilityQueryDraftConstraintV1,
  type CapabilityRetrievalExpansionV1,
  type CapabilityTaxonomyV1,
  type DeterministicCandidateProfileAuthorityV1,
  type OssRecommendationRequestV1,
  type RepositoryFingerprintV1,
  type RecommendationAssessmentResponseV1,
} from '@gitblocks/contracts';
import { createCandidateRetrievalEngineV1 } from '@gitblocks/retrieval';
import type { CandidateRetrievalEngineV1 } from '@gitblocks/retrieval';
import { CANDIDATE_CONSTRAINT_EVALUATION_VERSION } from '@gitblocks/domain';

import {
  createHostedRecommendationApplication,
  type CandidateDossierLoaderPort,
  type FitAssessmentModelPort,
  type FitAssessmentModelRequestV1,
  type HostedRecommendationApplicationV1,
  type HostedRecommendationObserverV1,
} from '../src/application.ts';

export const TEST_EVIDENCE_CUTOFF = '2026-08-12T12:00:00.000Z';

export interface AcceptedHostedDiscoveryAuthorities {
  readonly profiles: DeterministicCandidateProfileAuthorityV1;
  readonly metadata: CandidateRetrievalMetadataAuthorityV1;
  readonly taxonomy: CapabilityTaxonomyV1;
  readonly retrievalExpansion: CapabilityRetrievalExpansionV1;
}

let acceptedAuthoritiesPromise:
  Promise<AcceptedHostedDiscoveryAuthorities> | undefined;

export function loadAcceptedAuthorities(): Promise<AcceptedHostedDiscoveryAuthorities> {
  acceptedAuthoritiesPromise ??= loadAcceptedAuthoritiesOnce();
  return acceptedAuthoritiesPromise;
}

export async function createAcceptedApplication(
  input: {
    readonly dossierLoader?: CandidateDossierLoaderPort;
    readonly fitModel?: FitAssessmentModelPort;
    readonly engine?: CandidateRetrievalEngineV1;
    readonly observer?: HostedRecommendationObserverV1;
  } = {},
): Promise<HostedRecommendationApplicationV1> {
  const authorities = await loadAcceptedAuthorities();
  const engine = createCandidateRetrievalEngineV1({
    taxonomy: authorities.taxonomy,
    candidateProfileAuthority: authorities.profiles,
    retrievalExpansionAuthority: authorities.retrievalExpansion,
    candidateRetrievalMetadataAuthority: authorities.metadata,
    expectedCandidateRetrievalMetadataAuthorityBinding: expectedMetadataBinding(
      authorities.metadata,
    ),
  });
  if (!engine.ok) {
    throw new Error('Accepted retrieval engine construction failed.');
  }
  const created = createHostedRecommendationApplication({
    snapshot: {
      snapshotId: 'serving-accepted-hosted-test',
      snapshotRecordDigest: 'a'.repeat(64),
      candidateCount: 150,
    },
    taxonomy: authorities.taxonomy,
    candidateProfileAuthority: authorities.profiles,
    retrievalExpansionAuthority: authorities.retrievalExpansion,
    candidateRetrievalMetadataAuthority: authorities.metadata,
    engine: input.engine ?? engine.engine,
    dossierLoader:
      input.dossierLoader ??
      Object.freeze({
        loadActiveCandidateDossier: (
          command: Parameters<
            CandidateDossierLoaderPort['loadActiveCandidateDossier']
          >[0],
        ) =>
          Promise.resolve(
            candidateDossier(command.candidateId, command.evidenceCutoff, {
              capabilityFamily: command.expectedCapabilityFamily,
            }),
          ),
      }),
    fitModel:
      input.fitModel ??
      Object.freeze({
        assess: (request: FitAssessmentModelRequestV1) =>
          Promise.resolve(groundedModelResponse(request)),
      }),
    clock: Object.freeze({ now: () => TEST_EVIDENCE_CUTOFF }),
    ...(input.observer === undefined ? {} : { observer: input.observer }),
  });
  if (!created.ok) {
    throw new Error('Accepted hosted application construction failed.');
  }
  return created.application;
}

export function repositoryFingerprint(): RepositoryFingerprintV1 {
  return {
    contractVersion: CONTRACT_VERSION,
    factVocabularyVersion: '1.0.0',
    fingerprintId: 'fingerprint-hosted-test',
    facts: [
      {
        kind: 'component',
        factId: 'fact-runtime',
        component: 'runtime',
        name: 'node',
        version: '24.12.0',
        provenance: {
          origin: 'repository-structure',
          epistemicStatus: 'direct',
          confidence: 'high',
          observedAt: '2026-08-12T10:00:00.000Z',
        },
      },
    ],
    withheldCategories: [
      'raw-source',
      'configuration-values',
      'environment',
      'credentials',
      'logs',
      'database-content',
      'untracked-files',
      'command-output',
    ],
  };
}

export async function acceptedRetrievalResult(
  input: OssRecommendationRequestV1,
): Promise<CandidateRetrievalResultV1> {
  const authorities = await loadAcceptedAuthorities();
  const normalized = normalizeCapabilityQueryV1(
    input.capabilityQuery,
    authorities.taxonomy,
  );
  if (!normalized.ok || normalized.value.outcome !== 'normalized') {
    throw new Error('Accepted retrieval fixture did not normalize.');
  }
  const engine = createCandidateRetrievalEngineV1({
    taxonomy: authorities.taxonomy,
    candidateProfileAuthority: authorities.profiles,
    retrievalExpansionAuthority: authorities.retrievalExpansion,
    candidateRetrievalMetadataAuthority: authorities.metadata,
    expectedCandidateRetrievalMetadataAuthorityBinding: expectedMetadataBinding(
      authorities.metadata,
    ),
  });
  if (!engine.ok) throw new Error('Accepted retrieval fixture engine failed.');
  const request = createCandidateRetrievalRequestV1({
    normalization: normalized.value,
    authorityBindings: {
      taxonomy: {
        taxonomyVersion: authorities.taxonomy.taxonomyVersion,
        taxonomySemanticDigest: authorities.taxonomy.semanticDigest,
      },
      candidateProfiles: {
        authorityVersion: authorities.profiles.authorityVersion,
        semanticAuthorityDigest: authorities.profiles.semanticAuthorityDigest,
        profileRulesVersion: authorities.profiles.profileRulesVersion,
      },
      catalog: {
        catalogVersion: authorities.profiles.catalogVersion,
        catalogDigest: authorities.profiles.catalogDigest,
      },
      candidateConstraintEvaluationVersion:
        CANDIDATE_CONSTRAINT_EVALUATION_VERSION,
      retrievalExpansion: {
        authorityVersion: authorities.retrievalExpansion.expansionVersion,
        semanticDigest: authorities.retrievalExpansion.semanticDigest,
      },
      retrievalMetadata: {
        authorityVersion: authorities.metadata.authorityVersion,
        authoritySemanticDigest: authorities.metadata.authoritySemanticDigest,
      },
    },
    eligibleResultLimit: 10,
    evidenceNeededResultLimit: 10,
  });
  const retrieved = engine.engine.retrieve(request);
  if (!retrieved.ok) throw new Error('Accepted retrieval fixture failed.');
  return retrieved.result;
}

export function recommendationRequest(input: {
  readonly id: string;
  readonly term: string;
  readonly constraints?: readonly CapabilityQueryDraftConstraintV1[];
}): OssRecommendationRequestV1 {
  const fingerprint = repositoryFingerprint();
  return {
    contractVersion: CONTRACT_VERSION,
    recommendationRequestId: input.id,
    capabilityQuery: {
      contractVersion: CONTRACT_VERSION,
      queryInputId: input.id,
      scope: 'local-pre-approval',
      summary: 'Select an OSS authorization capability for this repository.',
      capabilityTerms: [
        { termId: `${input.id}-term`, originalTerm: input.term },
      ],
      successConditions: [
        {
          conditionId: `${input.id}-result`,
          statement: 'Return validated codebase-conditioned OSS options.',
        },
      ],
      draftConstraints: [...(input.constraints ?? [])],
      candidateReferences: [],
      repositoryFingerprintReference: {
        fingerprintId: fingerprint.fingerprintId,
        fingerprintDigest: repositoryFingerprintDigestV1(fingerprint),
      },
    },
    repositoryFingerprint: fingerprint,
    transmissionApproval: {
      approvalId: `${input.id}-approval`,
      approvedAt: '2026-08-12T10:30:00.000Z',
      approvedBy: 'request-originator',
      scope: 'minimized-repository-facts',
      approvedCategories: [
        'bounded-evidence',
        'candidate-dossiers',
        'capability-request',
        'repository-fingerprint',
      ],
    },
  };
}

export function frozenBackgroundJobsDogfoodRequest(): OssRecommendationRequestV1 {
  const fingerprint = repositoryFingerprint();
  return {
    contractVersion: CONTRACT_VERSION,
    recommendationRequestId: 'r8-background-jobs-no-redis',
    capabilityQuery: {
      contractVersion: CONTRACT_VERSION,
      queryInputId: 'r8-background-jobs-no-redis',
      scope: 'local-pre-approval',
      summary:
        'Choose a durable background job library with automatic retries that does not require Redis.',
      capabilityTerms: [
        { termId: 'r8-term-background-jobs', originalTerm: 'background-jobs' },
      ],
      successConditions: [
        {
          conditionId: 'r8-condition-durable-jobs',
          statement:
            'Durable jobs must survive application or worker restarts and be processable by a separate worker.',
        },
        {
          conditionId: 'r8-condition-retry-backoff',
          statement:
            'Failed jobs must retry automatically with configurable backoff.',
        },
      ],
      draftConstraints: [
        {
          constraintId: 'automatic-retries',
          modality: 'required',
          statement:
            'The solution must provide automatic retries for failed jobs.',
          originalTerm: 'retries',
          facetHint: 'feature',
          reasonCode: 'automatic-retry-required',
        },
        {
          constraintId: 'no-redis',
          modality: 'prohibited',
          statement: 'The solution must not require Redis.',
          originalTerm: 'redis',
          facetHint: 'infrastructure',
          reasonCode: 'redis-unavailable',
        },
      ],
      candidateReferences: [],
      repositoryFingerprintReference: {
        fingerprintId: fingerprint.fingerprintId,
        fingerprintDigest: repositoryFingerprintDigestV1(fingerprint),
      },
    },
    repositoryFingerprint: fingerprint,
    transmissionApproval: {
      approvalId: 'r8-background-jobs-approval',
      approvedAt: '2026-08-12T10:30:00.000Z',
      approvedBy: 'request-originator',
      scope: 'minimized-repository-facts',
      approvedCategories: [
        'bounded-evidence',
        'candidate-dossiers',
        'capability-request',
        'repository-fingerprint',
      ],
    },
  };
}

export function candidateDossier(
  candidateId: string,
  evidenceCutoff = TEST_EVIDENCE_CUTOFF,
  options: {
    readonly emptyEvidence?: boolean;
    readonly capabilityFamily?: CandidateDossierV1['capabilityFamily'];
  } = {},
): CandidateDossierV1 {
  const evidenceId = `evidence-${candidateId}`;
  const observations: CandidateDossierV1['observations'] =
    options.emptyEvidence === true
      ? []
      : [
          {
            kind: 'evidence',
            evidenceId,
            candidateId,
            topic: 'runtime-support',
            dimension: 'runtime-framework',
            observation:
              'Official repository evidence states support for current Node.js runtimes.',
            source: {
              kind: 'git-commit',
              sourceType: 'official-repository',
              sourceUrl: `https://github.com/example/${candidateId}`,
              commitSha: '0123456789abcdef0123456789abcdef01234567',
              immutableUrl: `https://github.com/example/${candidateId}/tree/0123456789abcdef0123456789abcdef01234567`,
              publishedAt: '2026-08-11T09:00:00.000Z',
              collectedAt: '2026-08-12T09:00:00.000Z',
            },
            freshness: {
              status: 'current',
              asOf: evidenceCutoff,
              scope: 'Runtime support at the pinned repository revision.',
            },
            directness: 'direct',
            limitation: 'Candidate code was not installed or executed.',
          },
        ];
  return {
    contractVersion: CONTRACT_VERSION,
    identity: {
      candidateId,
      displayName: candidateId,
      repository: { host: 'github', owner: 'example', name: candidateId },
      package: null,
    },
    capabilityFamily: options.capabilityFamily ?? 'authorization',
    versionScope: null,
    observations,
    limitations:
      observations.length === 0
        ? []
        : [
            {
              limitationId: `limitation-${candidateId}`,
              limitationCode: 'live-validation-not-performed',
              candidateId,
              statement: 'Candidate code was not installed or executed.',
              evidenceIds: [evidenceId],
            },
          ],
    unknowns: [
      {
        scope: 'candidate',
        unknownId: `unknown-${candidateId}`,
        candidateId,
        topic: 'deployment-details',
        statement: 'Production deployment behavior remains unverified.',
        evidenceIds: [],
      },
    ],
  };
}

export function groundedModelResponse(
  input: FitAssessmentModelRequestV1,
): RecommendationAssessmentResponseV1 {
  const candidates = input.fitAssessmentRequest.candidates;
  const positive = candidates[0];
  if (positive?.observations[0] === undefined) {
    throw new Error('Grounded response fixture requires candidate evidence.');
  }
  const positiveCandidateId = positive.identity.candidateId;
  const inferenceId = `inference-${positiveCandidateId}`;
  const evidenceNeededCandidateIds = new Set(
    input.retrievalFinalists
      .filter(({ lane }) => lane === 'evidence-needed')
      .map(({ candidateId }) => candidateId),
  );
  return {
    contractVersion: CONTRACT_VERSION,
    targetFitAssessment: {
      contractVersion: CONTRACT_VERSION,
      fitAssessment: {
        contractVersion: CONTRACT_VERSION,
        assessmentId: `assessment-${input.fitAssessmentRequest.assessmentRequestId}`,
        assessmentRequestId: input.fitAssessmentRequest.assessmentRequestId,
        correlationId: input.fitAssessmentRequest.correlationId,
        outcome: 'recommend',
        suppliedCandidateIds: candidates.map(
          ({ identity }) => identity.candidateId,
        ),
        candidateAssessments: candidates.map((dossier, index) => {
          const candidateId = dossier.identity.candidateId;
          const evidenceIds = dossier.observations.map(
            ({ evidenceId }) => evidenceId,
          );
          const isPositive = index === 0;
          return {
            candidateId,
            disposition: isPositive
              ? ('recommended' as const)
              : evidenceNeededCandidateIds.has(candidateId)
                ? ('insufficient-evidence' as const)
                : ('rejected' as const),
            reasons: [
              {
                candidateId,
                reasonCode: isPositive ? 'target-runtime-fit' : 'not-selected',
                statement: isPositive
                  ? 'Candidate evidence and the supplied target runtime align.'
                  : 'Another supplied candidate has stronger target-grounded support.',
                evidenceIds,
                inferenceIds: isPositive ? [inferenceId] : [],
                unknownIds: [],
              },
            ],
            evidenceIds,
            inferenceIds: isPositive ? [inferenceId] : [],
            claimIds: [`claim-${candidateId}`],
            unknownIds: dossier.unknowns.map(({ unknownId }) => unknownId),
            hardConstraintConflictIds: [],
            limitationIds: dossier.limitations.map(
              ({ limitationId }) => limitationId,
            ),
          };
        }),
        evidence: candidates.flatMap(({ observations }) => observations),
        inferences: [
          {
            kind: 'inference',
            inferenceId,
            candidateId: positiveCandidateId,
            topic: 'runtime-support',
            statement:
              'The candidate runtime support matches the target runtime.',
            rationale:
              'Supplied candidate evidence and repository fact fact-runtime align.',
            evidenceIds: [positive.observations[0].evidenceId],
          },
        ],
        candidateLimitations: candidates.flatMap(
          ({ limitations }) => limitations,
        ),
        materialClaims: candidates.map((dossier, index) => ({
          claimId: `claim-${dossier.identity.candidateId}`,
          candidateId: dossier.identity.candidateId,
          topic: 'runtime-support',
          direction:
            index === 0 ? ('favorable' as const) : ('unfavorable' as const),
          statement:
            index === 0
              ? 'The candidate fits the supplied target runtime.'
              : 'The candidate was not selected for the target runtime.',
          evidenceIds: dossier.observations.map(({ evidenceId }) => evidenceId),
          inferenceIds: index === 0 ? [inferenceId] : [],
        })),
        materialUnknowns: candidates.flatMap(({ unknowns }) => unknowns),
        hardConstraintConflicts: [],
        rankGroups: [{ candidateIds: [positiveCandidateId] }],
        rankRelations: [],
        incomparablePairs: [],
        evidenceCutoff: input.fitAssessmentRequest.evidenceCutoff,
        producedAt: input.fitAssessmentRequest.evidenceCutoff,
        assessmentProcessing: {
          state: 'complete',
          incompleteReasonCodes: [],
        },
      },
      inferenceRepositoryFactBindings: [
        { inferenceId, repositoryFactIds: ['fact-runtime'] },
      ],
    },
    evidenceNeededHardConstraintResolutions: input.retrievalFinalists.flatMap(
      (finalist) =>
        finalist.lane !== 'evidence-needed'
          ? []
          : finalist.unresolvedHardEvaluations.map((evaluation) => ({
              candidateId: finalist.candidateId,
              evaluationId: evaluation.evaluationId,
              state:
                finalist.candidateId === positiveCandidateId
                  ? ('satisfied' as const)
                  : ('unresolved' as const),
              inferenceIds:
                finalist.candidateId === positiveCandidateId
                  ? [inferenceId]
                  : [],
            })),
    ),
  };
}

export function expectedMetadataBinding(
  authority: CandidateRetrievalMetadataAuthorityV1,
) {
  return {
    authorityVersion: authority.authorityVersion,
    catalogVersion: authority.catalogVersion,
    catalogDigest: authority.catalogDigest,
    providerPolicyVersion: authority.providerPolicyVersion,
    providerPolicyDigest: authority.providerPolicyDigest,
    sourceProviderPolicyVersion: authority.sourceProviderPolicyVersion,
    sourceProviderPolicyDigest: authority.sourceProviderPolicyDigest,
    sourceOperation: authority.sourceOperation,
  };
}

async function loadAcceptedAuthoritiesOnce(): Promise<AcceptedHostedDiscoveryAuthorities> {
  const [profileText, metadataText, taxonomyText, expansionText] =
    await Promise.all([
      catalogText('public-v1/candidate-profile-authority.json'),
      catalogText('public-v1/candidate-retrieval-metadata-authority.json'),
      catalogText('capability-taxonomy/1.0.0/manifest.json'),
      catalogText('capability-retrieval-expansion/1.0.0/manifest.json'),
    ]);
  const profiles = parseDeterministicCandidateProfileAuthorityV1(
    JSON.parse(profileText) as unknown,
  );
  const metadata = parseCandidateRetrievalMetadataAuthorityV1(
    JSON.parse(metadataText) as unknown,
  );
  const taxonomy = parseCapabilityTaxonomyV1(
    JSON.parse(taxonomyText) as unknown,
  );
  const retrievalExpansion = parseCapabilityRetrievalExpansionV1(
    JSON.parse(expansionText) as unknown,
  );
  if (!profiles.ok || !metadata.ok || !taxonomy.ok || !retrievalExpansion.ok) {
    throw new Error('Accepted hosted recommendation authorities are invalid.');
  }
  return Object.freeze({
    profiles: profiles.value,
    metadata: metadata.value,
    taxonomy: taxonomy.value,
    retrievalExpansion: retrievalExpansion.value,
  });
}

function catalogText(relativePath: string): Promise<string> {
  return readFile(
    fileURLToPath(new URL(`../../../catalog/${relativePath}`, import.meta.url)),
    'utf8',
  );
}
