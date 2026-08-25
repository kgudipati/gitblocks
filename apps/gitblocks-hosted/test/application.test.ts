import {
  repositoryFingerprintDigestV1,
  type OssRecommendationRequestV2,
  type CandidateRetrievalResultV1,
  type RecommendationAssessmentModelDecompositionV1,
} from '@gitblocks/contracts';
import type { CandidateRetrievalEngineV1 } from '@gitblocks/retrieval';
import { describe, expect, it, vi } from 'vitest';

import {
  HOSTED_FIT_FINALIST_LIMIT,
  HOSTED_RESPONSIBLE_OPTION_LIMIT,
  selectHostedRetrievalFinalistsV1,
  type FitAssessmentModelRequestV1,
} from '../src/application.ts';
import { HostedDiscoveryError } from '../src/errors.ts';
import {
  candidateDossier,
  acceptedRetrievalResult,
  candidateArtifactMaterial,
  createAcceptedApplication,
  candidateRepositoryHeadDossier,
  frozenBackgroundJobsDogfoodRequest,
  groundedModelResponse,
  loadAcceptedAuthorities,
  recommendationRequest,
  TEST_EVIDENCE_CUTOFF,
} from './fixtures.ts';

describe('hosted OSS recommendation application', () => {
  it('retrieves before effects, loads only the first five eligible finalists, calls the model once, and returns a bounded validated option', async () => {
    const order: string[] = [];
    const loadedCandidateIds: string[] = [];
    const modelInputs: FitAssessmentModelRequestV1[] = [];
    const application = await createAcceptedApplication({
      observer: { emit: ({ stage }) => order.push(stage) },
      dossierLoader: {
        loadActiveCandidateDossier: (command) => {
          order.push('evidence');
          loadedCandidateIds.push(command.candidateId);
          expect(command.evidenceCutoff).toBe(TEST_EVIDENCE_CUTOFF);
          return Promise.resolve(
            candidateDossier(command.candidateId, command.evidenceCutoff),
          );
        },
      },
      fitModel: {
        assess: (input) => {
          order.push('model');
          modelInputs.push(input);
          return Promise.resolve(groundedModelResponse(input));
        },
      },
    });

    const outcome = await application.recommendOss(
      recommendationRequest({ id: 'recommend-happy', term: 'authorization' }),
    );

    expect(outcome.ok).toBe(true);
    if (!outcome.ok || outcome.result.outcome !== 'recommend') return;
    expect(loadedCandidateIds).toHaveLength(HOSTED_FIT_FINALIST_LIMIT);
    expect(modelInputs).toHaveLength(1);
    expect(
      modelInputs[0]?.fitAssessmentRequest.candidates.map(
        ({ identity }) => identity.candidateId,
      ),
    ).toEqual(loadedCandidateIds);
    expect(modelInputs[0]?.fitAssessmentRequest.requestedMaximumResults).toBe(
      HOSTED_RESPONSIBLE_OPTION_LIMIT,
    );
    expect(modelInputs[0]?.fitAssessmentRequest.evidenceCutoff).toBe(
      TEST_EVIDENCE_CUTOFF,
    );
    expect(order.indexOf('retrieved')).toBeLessThan(order.indexOf('evidence'));
    expect(order.indexOf('evidence-loaded')).toBeLessThan(
      order.indexOf('model'),
    );
    expect(outcome.result.responsibleOptions).toHaveLength(1);
    expect(outcome.result.responsibleOptions[0]).toMatchObject({
      verificationStatus: 'fully-verified',
      constraintStatuses: [],
    });
    expect(outcome.result.responsibleOptions.length).toBeLessThanOrEqual(
      HOSTED_RESPONSIBLE_OPTION_LIMIT,
    );
    expect(modelInputs[0]?.retrievalFinalists).toHaveLength(
      HOSTED_FIT_FINALIST_LIMIT,
    );
    expect(
      modelInputs[0]?.retrievalFinalists.every(
        ({ lane, unresolvedHardEvaluations }) =>
          lane === 'eligible' && unresolvedHardEvaluations.length === 0,
      ),
    ).toBe(true);
    expect(outcome.result.evidenceNeededHardConstraintResolutions).toEqual([]);
    const fitAssessment = outcome.result.targetFitAssessment.fitAssessment;
    expect(fitAssessment.assessmentId).toMatch(/^assessment-[0-9a-f]{53}$/u);
    expect(fitAssessment).toMatchObject({
      assessmentRequestId: 'recommend-happy',
      correlationId: 'recommend-happy',
      evidenceCutoff: TEST_EVIDENCE_CUTOFF,
      producedAt: TEST_EVIDENCE_CUTOFF,
    });
    expect(fitAssessment.candidateLimitations.length).toBeGreaterThan(0);
    expect(
      fitAssessment.materialUnknowns.filter(
        ({ scope }) => scope === 'candidate',
      ).length,
    ).toBeGreaterThan(0);
    expect(
      fitAssessment.candidateAssessments.every(
        ({ limitationIds, unknownIds }) =>
          limitationIds.length === 0 && unknownIds.length === 0,
      ),
    ).toBe(true);
  });

  it('accepts V2, expands it before normalization, and preserves the V1 serving path', async () => {
    const modelInputs: FitAssessmentModelRequestV1[] = [];
    const application = await createAcceptedApplication({
      fitModel: {
        assess: (input) => {
          modelInputs.push(input);
          return Promise.resolve(groundedModelResponse(input));
        },
      },
    });
    const v1 = recommendationRequest({
      id: 'v2-source-fixture',
      term: 'authorization',
    });
    const request: OssRecommendationRequestV2 = {
      contractVersion: '2.0.0',
      summary: v1.capabilityQuery.summary,
      capabilityTerms: ['authorization'],
      successConditions: v1.capabilityQuery.successConditions.map(
        ({ statement }) => statement,
      ),
      constraints: [],
      repositoryFingerprint: v1.repositoryFingerprint,
      transmissionApproval: {
        approvedBy: v1.transmissionApproval.approvedBy,
        approvedAt: v1.transmissionApproval.approvedAt,
        approvedCategories: v1.transmissionApproval.approvedCategories,
        fingerprintDigest: repositoryFingerprintDigestV1(
          v1.repositoryFingerprint,
        ),
      },
    };

    const outcome = await application.recommendOss(request);

    expect(outcome).toMatchObject({
      ok: true,
      result: { outcome: 'recommend' },
    });
    expect(modelInputs).toHaveLength(1);
    const capabilityRequest =
      modelInputs[0]?.fitAssessmentRequest.capabilityRequest;
    expect(capabilityRequest?.requestId).toMatch(/^query-[0-9a-f]{48}$/u);
    expect(capabilityRequest?.transmissionApproval.approvalId).toMatch(
      /^approval-[0-9a-f]{48}$/u,
    );
    expect(capabilityRequest).toMatchObject({
      summary: request.summary,
      successConditions: [
        {
          conditionId: 'condition-001',
          statement: request.successConditions[0],
        },
      ],
      hardConstraints: [],
      preferences: [],
      transmissionApproval: {
        approvedBy: request.transmissionApproval.approvedBy,
        approvedAt: request.transmissionApproval.approvedAt,
        approvedCategories: request.transmissionApproval.approvedCategories,
        scope: 'minimized-repository-facts',
      },
    });
  });

  it('derives responsible options from positive dispositions, model order, and the requested maximum', async () => {
    let expectedOptionIds: readonly string[] = [];
    let rejectedCandidateId: string | undefined;
    const application = await createAcceptedApplication({
      fitModel: {
        assess: (input) => {
          const response = structuredClone(groundedModelResponse(input));
          for (const index of [1, 2, 3]) {
            promoteModelCandidate(response, index);
          }
          const candidateIds = input.fitAssessmentRequest.candidates.map(
            ({ identity }) => identity.candidateId,
          );
          rejectedCandidateId = candidateIds[4];
          response.orderedPositiveCandidateIds = ['f4', 'f1', 'f3'];
          expectedOptionIds = [
            candidateIds[3]!,
            candidateIds[0]!,
            candidateIds[2]!,
          ];
          return Promise.resolve(response);
        },
      },
    });

    const outcome = await application.recommendOss(
      recommendationRequest({
        id: 'recommend-derived-ranking',
        term: 'authorization',
      }),
    );

    expect(outcome.ok).toBe(true);
    if (!outcome.ok || outcome.result.outcome !== 'recommend') return;
    expect(
      outcome.result.responsibleOptions.map(({ candidateId }) => candidateId),
    ).toEqual(expectedOptionIds);
    expect(outcome.result.responsibleOptions).toHaveLength(
      HOSTED_RESPONSIBLE_OPTION_LIMIT,
    );
    expect(
      outcome.result.responsibleOptions.some(
        ({ candidateId }) => candidateId === rejectedCandidateId,
      ),
    ).toBe(false);
    expect(outcome.result.targetFitAssessment.fitAssessment.rankGroups).toEqual(
      expectedOptionIds.map((candidateId) => ({ candidateIds: [candidateId] })),
    );
  });

  it('keeps a model-authored unknown scoped to the candidate whose reason owns it', async () => {
    let unknownOwnerId: string | undefined;
    const application = await createAcceptedApplication({
      fitModel: {
        assess: (input) => {
          const response = structuredClone(groundedModelResponse(input));
          unknownOwnerId =
            input.fitAssessmentRequest.candidates[1]?.identity.candidateId;
          response.candidateAssessments[
            'f2'
          ]?.reasons[0]?.assessmentUnknowns.push({
            topic: 'runtime-support',
            statement:
              'This candidate has not established support for the target runtime.',
            evidenceIds: [],
          });
          return Promise.resolve(response);
        },
      },
    });

    const outcome = await application.recommendOss(
      recommendationRequest({
        id: 'recommend-candidate-scoped-model-unknown',
        term: 'authorization',
      }),
    );

    expect(outcome.ok).toBe(true);
    if (!outcome.ok || outcome.result.outcome !== 'recommend') return;
    const modelUnknown =
      outcome.result.targetFitAssessment.fitAssessment.materialUnknowns.find(
        ({ statement }) =>
          statement ===
          'This candidate has not established support for the target runtime.',
      );
    expect(modelUnknown).toMatchObject({
      scope: 'candidate',
      candidateId: unknownOwnerId,
      topic: 'runtime-support',
    });
  });

  it('still rejects a favorable claim that collides with an unknown owned by the same candidate', async () => {
    const application = await createAcceptedApplication({
      fitModel: {
        assess: (input) => {
          const response = structuredClone(groundedModelResponse(input));
          response.candidateAssessments[
            'f1'
          ]?.reasons[0]?.assessmentUnknowns.push({
            topic: 'runtime-support',
            statement:
              'Support for the target runtime remains unknown for this candidate.',
            evidenceIds: [],
          });
          return Promise.resolve(response);
        },
      },
    });

    const outcome = await application.recommendOss(
      recommendationRequest({
        id: 'recommend-same-candidate-model-unknown',
        term: 'authorization',
      }),
    );

    expect(outcome).toMatchObject({
      ok: false,
      failure: {
        code: 'invalid-target-fit-response',
        stage: 'response-validation',
        path: 'target-fit-exchange-validation',
      },
    });
  });

  it.each([
    ['clarification-required', 'lightweight'],
    ['unsupported', 'authentication'],
  ] as const)(
    'returns %s without a PostgreSQL evidence read or model call',
    async (expected, term) => {
      const loader = vi.fn();
      const model = vi.fn();
      const application = await createAcceptedApplication({
        dossierLoader: { loadActiveCandidateDossier: loader },
        fitModel: { assess: model },
      });

      const result = await application.recommendOss(
        recommendationRequest({ id: `recommend-${expected}`, term }),
      );

      expect(result).toMatchObject({
        ok: true,
        result: { outcome: expected },
      });
      expect(loader).not.toHaveBeenCalled();
      expect(model).not.toHaveBeenCalled();
    },
  );

  it('returns actionable corrected capability guidance without an evidence read or model call', async () => {
    const loader = vi.fn();
    const model = vi.fn();
    const application = await createAcceptedApplication({
      dossierLoader: { loadActiveCandidateDossier: loader },
      fitModel: { assess: model },
    });

    const result = await application.recommendOss(
      recommendationRequest({
        id: 'recommend-actionable-clarification',
        term: 'Next.js app',
      }),
    );

    expect(result).toMatchObject({
      ok: true,
      result: {
        outcome: 'clarification-required',
      },
    });
    if (!result.ok || result.result.outcome !== 'clarification-required') {
      return;
    }
    expect(
      result.result.normalization.clarifications.some(({ context }) =>
        context.includes('Suggested corrected value: "next-js-app".'),
      ),
    ).toBe(true);
    expect(loader).not.toHaveBeenCalled();
    expect(model).not.toHaveBeenCalled();
  });

  it('uses the current production authorities for the frozen dogfood regression and loads the first five evidence-needed finalists before the no-evidence stop', async () => {
    // This freezes current production-authority behavior, not ranking gold or a
    // claim that these candidates are good recommendations.
    const request = frozenBackgroundJobsDogfoodRequest();
    const retrieval = await acceptedRetrievalResult(request);
    const loadedCandidateIds: string[] = [];
    const expectedFirstFive = [
      'jobs-actionhero-node-resque',
      'jobs-asynq',
      'jobs-bree',
      'jobs-bullmq',
      'jobs-node-cron',
    ];
    const model = vi.fn();
    const artifactLoader = vi.fn();
    const application = await createAcceptedApplication({
      dossierLoader: {
        loadActiveCandidateDossier: (command) => {
          loadedCandidateIds.push(command.candidateId);
          return Promise.resolve(
            candidateDossier(command.candidateId, command.evidenceCutoff, {
              capabilityFamily: command.expectedCapabilityFamily,
              emptyEvidence: true,
            }),
          );
        },
      },
      artifactMaterialLoader: {
        loadCandidateRepositoryArtifactMaterial: artifactLoader,
      },
      fitModel: { assess: model },
    });
    const result = await application.recommendOss(request);

    expect(retrieval.eligibleCandidates).toHaveLength(0);
    expect(retrieval.preRetrievalLaneCounts).toMatchObject({
      eligible: 0,
      'evidence-needed': 29,
    });
    expect(retrieval.evidenceNeededCandidates).toHaveLength(10);
    expect(
      retrieval.evidenceNeededCandidates
        .slice(0, HOSTED_FIT_FINALIST_LIMIT)
        .map(({ candidateId }) => candidateId),
    ).toEqual(expectedFirstFive);
    expect(result).toMatchObject({
      ok: true,
      result: {
        outcome: 'insufficient-evidence',
        reasonCode: 'no-positive-candidate-evidence',
        normalization: { primaryFamilyId: 'background-jobs' },
        shortlist: { eligibleCandidates: [] },
      },
    });
    if (!result.ok) return;
    expect(result.result.normalization.normalizedConstraints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ modality: 'required', conceptId: 'retries' }),
        expect.objectContaining({ modality: 'prohibited', conceptId: 'redis' }),
      ]),
    );
    expect(loadedCandidateIds).toEqual(expectedFirstFive);
    expect(artifactLoader).not.toHaveBeenCalled();
    expect(model).not.toHaveBeenCalled();
  });

  it('presents a target-supported candidate with an unresolved prohibited constraint as a structurally distinguished option', async () => {
    const request = frozenBackgroundJobsDogfoodRequest();
    const application = await createAcceptedApplication({
      fitModel: {
        assess: (input) => {
          const response = structuredClone(groundedModelResponse(input));
          const positive = input.retrievalFinalists[0];
          const prohibited = positive?.unresolvedHardEvaluations.find(
            ({ modality }) => modality === 'prohibited',
          );
          const evaluationIndex =
            positive?.unresolvedHardEvaluations.findIndex(
              ({ evaluationId }) => evaluationId === prohibited?.evaluationId,
            ) ?? -1;
          const resolution =
            response.candidateAssessments['f1']?.hardEvaluations[
              `h${String(evaluationIndex + 1)}`
            ];
          if (resolution === undefined) {
            throw new Error('Prohibited hard-resolution fixture is missing.');
          }
          resolution.state = 'unresolved';
          resolution.grounding = null;
          return Promise.resolve(response);
        },
      },
    });

    const outcome = await application.recommendOss(request);

    expect(outcome.ok).toBe(true);
    if (!outcome.ok || outcome.result.outcome !== 'recommend') return;
    expect(outcome.result.responsibleOptions).toHaveLength(1);
    expect(outcome.result.responsibleOptions[0]).toMatchObject({
      verificationStatus: 'unverified-prohibited-constraint',
      constraintStatuses: [
        {
          statement:
            'The solution must provide automatic retries for failed jobs.',
          modality: 'required',
          status: 'verified',
          grounding: [
            {
              basis: 'model',
            },
          ],
        },
        {
          statement: 'The solution must not require Redis.',
          modality: 'prohibited',
          status: 'unverified',
          grounding: [],
        },
      ],
    });
    expect(
      outcome.result.responsibleOptions[0]?.constraintStatuses[0]?.grounding[0]
        ?.inferenceIds.length,
    ).toBeGreaterThan(0);
  });

  it('projects grounded conflict from model substance, rejects and unranks the candidate, and binds the exact source constraint', async () => {
    const request = frozenBackgroundJobsDogfoodRequest();
    const application = await createAcceptedApplication({
      fitModel: {
        assess: (input) => {
          const response = structuredClone(groundedModelResponse(input));
          const evaluation =
            response.candidateAssessments['f1']?.hardEvaluations['h1'];
          if (evaluation?.grounding === null || evaluation === undefined) {
            throw new Error('Grounded conflict fixture is incomplete.');
          }
          evaluation.state = 'conflict';
          evaluation.grounding.reasonStatement =
            'Candidate-owned evidence establishes the exact disclosed conflict.';
          return Promise.resolve(response);
        },
      },
    });

    const outcome = await application.recommendOss(request);

    expect(outcome).toMatchObject({
      ok: true,
      result: { outcome: 'no-viable-candidate' },
    });
    if (
      !outcome.ok ||
      outcome.result.outcome !== 'no-viable-candidate' ||
      outcome.result.targetFitAssessment === null
    ) {
      return;
    }
    const fit = outcome.result.targetFitAssessment.fitAssessment;
    const firstCandidateId = fit.suppliedCandidateIds[0];
    const firstAssessment = fit.candidateAssessments.find(
      ({ candidateId }) => candidateId === firstCandidateId,
    );
    const conflict = fit.hardConstraintConflicts[0];
    expect(firstAssessment).toMatchObject({ disposition: 'rejected' });
    expect(
      fit.rankGroups.flatMap(({ candidateIds }) => candidateIds),
    ).not.toContain(firstCandidateId);
    expect(conflict).toMatchObject({
      candidateId: firstCandidateId,
      constraintId: request.capabilityQuery.draftConstraints[0]?.constraintId,
      reasonCode: request.capabilityQuery.draftConstraints[0]?.reasonCode,
    });
  });

  it('augments eligible finalists with fit-scoped request evidence before the one model call', async () => {
    const request = recommendationRequest({
      id: 'eligible-rate-limiting-artifacts',
      term: 'rate-limiting',
    });
    const authorities = await loadAcceptedAuthorities();
    const artifactLoads: string[] = [];
    const modelInputs: FitAssessmentModelRequestV1[] = [];
    const application = await createAcceptedApplication({
      dossierLoader: {
        loadActiveCandidateDossier: (command) =>
          Promise.resolve(
            candidateRepositoryHeadDossier(
              command.candidateId,
              command.expectedCapabilityFamily,
            ),
          ),
      },
      artifactMaterialLoader: {
        loadCandidateRepositoryArtifactMaterial: (command) => {
          artifactLoads.push(command.candidateId);
          return Promise.resolve(
            artifactLoads.length === 1
              ? candidateArtifactMaterial({
                  candidateId: command.candidateId,
                  catalogDigest: authorities.profiles.catalogDigest,
                  content: [
                    'The rate limiter counts requests and blocks clients after the configured limit.',
                    'Add the limiter to Next.js middleware for application routes.',
                    'The in-process memory store avoids an external service.',
                  ].join('\n'),
                })
              : null,
          );
        },
      },
      fitModel: {
        assess: (input) => {
          modelInputs.push(input);
          return Promise.resolve(groundedModelResponse(input));
        },
      },
    });

    const result = await application.recommendOss(request);

    expect(result).toMatchObject({
      ok: true,
      result: { outcome: 'recommend' },
    });
    expect(artifactLoads).toHaveLength(HOSTED_FIT_FINALIST_LIMIT);
    expect(modelInputs).toHaveLength(1);
    expect(
      modelInputs[0]?.fitAssessmentRequest.candidates[0]?.observations
        .filter(({ topic }) => topic === 'artifact-excerpt')
        .map(({ observation }) => observation),
    ).toEqual([
      'The rate limiter counts requests and blocks clients after the configured limit.',
      'Add the limiter to Next.js middleware for application routes.',
      'The in-process memory store avoids an external service.',
    ]);
  });

  it('augments evidence-needed finalists with matching request-scoped artifact excerpts before the one model call', async () => {
    const request = frozenBackgroundJobsDogfoodRequest();
    const authorities = await loadAcceptedAuthorities();
    const artifactLoads: string[] = [];
    const modelInputs: FitAssessmentModelRequestV1[] = [];
    const application = await createAcceptedApplication({
      dossierLoader: {
        loadActiveCandidateDossier: (command) => {
          expect(command).toMatchObject({
            relevantEvidenceDimensions: ['data-store', 'integration'],
          });
          const head = candidateRepositoryHeadDossier(
            command.candidateId,
            command.expectedCapabilityFamily,
          );
          const cited = candidateDossier(
            command.candidateId,
            command.evidenceCutoff,
            { capabilityFamily: command.expectedCapabilityFamily },
          );
          const citedObservation = cited.observations[0];
          if (citedObservation === undefined) {
            throw new Error('Cited evidence fixture is missing.');
          }
          return Promise.resolve({
            ...head,
            observations: [
              ...head.observations,
              citedObservation,
              {
                ...citedObservation,
                evidenceId: `uncited-${command.candidateId}`,
                topic: 'uncited-catalog-metadata',
              },
            ],
            limitations: cited.limitations,
          });
        },
      },
      artifactMaterialLoader: {
        loadCandidateRepositoryArtifactMaterial: (command) => {
          artifactLoads.push(command.candidateId);
          expect(command).toMatchObject({
            expectedCatalogVersion: 'public-v1',
            expectedCatalogDigest: authorities.profiles.catalogDigest,
            evidenceCutoff: TEST_EVIDENCE_CUTOFF,
          });
          return Promise.resolve(
            artifactLoads.length === 1
              ? candidateArtifactMaterial({
                  candidateId: command.candidateId,
                  catalogDigest: command.expectedCatalogDigest,
                  content:
                    'Failed jobs have automatic retries with configurable backoff.\nRedis is required for coordination.',
                })
              : null,
          );
        },
      },
      fitModel: {
        assess: (input) => {
          modelInputs.push(input);
          return Promise.resolve(groundedModelResponse(input));
        },
      },
    });

    const result = await application.recommendOss(request);

    expect(result).toMatchObject({
      ok: true,
      result: { outcome: 'recommend' },
    });
    expect(artifactLoads).toEqual([
      'jobs-actionhero-node-resque',
      'jobs-asynq',
      'jobs-bree',
      'jobs-bullmq',
      'jobs-node-cron',
    ]);
    expect(modelInputs).toHaveLength(1);
    expect(
      modelInputs[0]?.fitAssessmentRequest.candidates[0]?.observations
        .filter(({ topic }) => topic === 'artifact-excerpt')
        .map(({ observation }) => observation),
    ).toEqual([
      'Failed jobs have automatic retries with configurable backoff.',
      'Redis is required for coordination.',
    ]);
    expect(
      modelInputs[0]?.fitAssessmentRequest.candidates
        .slice(1)
        .every(({ observations }) =>
          observations.every(({ topic }) => topic !== 'artifact-excerpt'),
        ),
    ).toBe(true);
    expect(
      modelInputs[0]?.fitAssessmentRequest.candidates.every(
        ({ observations }) =>
          observations.every(
            ({ topic }) =>
              topic !== 'repository-head' &&
              topic !== 'uncited-catalog-metadata',
          ) && observations.some(({ topic }) => topic === 'runtime-support'),
      ),
    ).toBe(true);
  });

  it('fills remaining finalist slots from the evidence-needed lane without displacing eligible finalists', async () => {
    const eligible = await acceptedRetrievalResult(
      recommendationRequest({ id: 'eligible-base', term: 'authorization' }),
    );
    const laneRequest = recommendationRequest({
      id: 'lane-authority',
      term: 'authorization',
      constraints: [
        {
          constraintId: 'in-process-required',
          modality: 'required',
          statement: 'The candidate must be an in-process library.',
          originalTerm: 'in-process-authorization-library',
          facetHint: 'architecture',
          reasonCode: 'required-architecture',
        },
      ],
    });
    const evidenceNeeded = await acceptedRetrievalResult(laneRequest);
    const eligibleCandidates = eligible.eligibleCandidates.slice(0, 3);
    const eligibleIds = new Set(
      eligibleCandidates.map(({ candidateId }) => candidateId),
    );
    const evidenceNeededCandidates = evidenceNeeded.evidenceNeededCandidates
      .filter(({ candidateId }) => !eligibleIds.has(candidateId))
      .slice(0, 2);
    expect(evidenceNeededCandidates).toHaveLength(2);
    const combined: CandidateRetrievalResultV1 = {
      ...eligible,
      eligibleCandidates,
      evidenceNeededCandidates,
    };
    const modelInputs: FitAssessmentModelRequestV1[] = [];
    const application = await createAcceptedApplication({
      engine: fixedEngine(combined),
      fitModel: {
        assess: (input) => {
          modelInputs.push(input);
          return Promise.resolve(groundedModelResponse(input));
        },
      },
    });

    const result = await application.recommendOss(laneRequest);
    expect(result).toMatchObject({
      ok: true,
      result: { outcome: 'recommend' },
    });
    expect(
      modelInputs[0]?.fitAssessmentRequest.candidates.map(
        ({ identity }) => identity.candidateId,
      ),
    ).toEqual(
      [
        ...combined.eligibleCandidates,
        ...combined.evidenceNeededCandidates,
      ].map(({ candidateId }) => candidateId),
    );
    expect(modelInputs[0]?.retrievalFinalists.map(({ lane }) => lane)).toEqual([
      'eligible',
      'eligible',
      'eligible',
      'evidence-needed',
      'evidence-needed',
    ]);
  });

  it('selects deterministic eligible-first finalists, never admits a candidate outside either lane, and never exceeds five', async () => {
    const eligible = await acceptedRetrievalResult(
      recommendationRequest({
        id: 'selection-eligible',
        term: 'authorization',
      }),
    );
    const evidence = await acceptedRetrievalResult(
      frozenBackgroundJobsDogfoodRequest(),
    );
    const cases = [
      {
        eligibleCandidates: eligible.eligibleCandidates.slice(0, 6),
        evidenceNeededCandidates: evidence.evidenceNeededCandidates,
        expectedLanes: Array(5).fill('eligible'),
      },
      {
        eligibleCandidates: eligible.eligibleCandidates.slice(0, 3),
        evidenceNeededCandidates: evidence.evidenceNeededCandidates,
        expectedLanes: [
          'eligible',
          'eligible',
          'eligible',
          'evidence-needed',
          'evidence-needed',
        ],
      },
      {
        eligibleCandidates: [],
        evidenceNeededCandidates: evidence.evidenceNeededCandidates,
        expectedLanes: Array(5).fill('evidence-needed'),
      },
    ];

    for (const candidateCase of cases) {
      const selected = selectHostedRetrievalFinalistsV1(candidateCase);
      expect(selected).toHaveLength(5);
      expect(selected.map(({ lane }) => lane)).toEqual(
        candidateCase.expectedLanes,
      );
      expect(selected.map(({ candidateId }) => candidateId)).toEqual(
        [
          ...candidateCase.eligibleCandidates,
          ...candidateCase.evidenceNeededCandidates,
        ]
          .slice(0, 5)
          .map(({ candidateId }) => candidateId),
      );
      expect(
        selected.some(
          ({ candidateId }) => candidateId === 'excluded-candidate',
        ),
      ).toBe(false);
    }
  });

  it('returns no viable candidate without evidence or model effects when deterministic retrieval has no candidates', async () => {
    const baseline = await acceptedRetrievalResult(
      recommendationRequest({ id: 'empty-base', term: 'authorization' }),
    );
    const empty: CandidateRetrievalResultV1 = {
      ...baseline,
      eligibleCandidates: [],
      evidenceNeededCandidates: [],
    };
    const loader = vi.fn();
    const model = vi.fn();
    const application = await createAcceptedApplication({
      engine: fixedEngine(empty),
      dossierLoader: { loadActiveCandidateDossier: loader },
      fitModel: { assess: model },
    });

    expect(
      await application.recommendOss(
        recommendationRequest({ id: 'no-result', term: 'authorization' }),
      ),
    ).toMatchObject({
      ok: true,
      result: { outcome: 'no-viable-candidate' },
    });
    expect(loader).not.toHaveBeenCalled();
    expect(model).not.toHaveBeenCalled();
  });

  it('returns insufficient evidence without calling the model when every finalist dossier has no observations', async () => {
    const model = vi.fn();
    const application = await createAcceptedApplication({
      dossierLoader: {
        loadActiveCandidateDossier: (command) =>
          Promise.resolve(
            candidateDossier(command.candidateId, command.evidenceCutoff, {
              emptyEvidence: true,
            }),
          ),
      },
      fitModel: { assess: model },
    });

    expect(
      await application.recommendOss(
        recommendationRequest({ id: 'empty-evidence', term: 'authorization' }),
      ),
    ).toMatchObject({
      ok: true,
      result: {
        outcome: 'insufficient-evidence',
        reasonCode: 'no-positive-candidate-evidence',
      },
    });
    expect(model).not.toHaveBeenCalled();
  });

  it.each([
    ['restored candidate', restoreCandidate],
    ['invented evidence', inventEvidence],
    ['untraceable reason', removeReasonTraceability],
    ['direct evidence without positive authorship', removePositiveAuthorship],
    ['invented repository fact', inventRepositoryFact],
    ['omitted positive candidate', omitPositiveCandidate],
    ['included non-positive candidate', includeNonPositiveCandidate],
    ['duplicated positive candidate', duplicatePositiveCandidate],
  ] as const)(
    'fails closed for model output with %s and never retries',
    async (_name, mutate) => {
      const model = vi.fn((input: FitAssessmentModelRequestV1) => {
        const response = structuredClone(groundedModelResponse(input));
        mutate(response);
        return Promise.resolve(response);
      });
      const application = await createAcceptedApplication({
        fitModel: { assess: model },
      });

      const result = await application.recommendOss(
        recommendationRequest({
          id: `invalid-${_name.replaceAll(' ', '-')}`,
          term: 'authorization',
        }),
      );

      expect(result).toMatchObject({
        ok: false,
        failure: {
          code: 'invalid-target-fit-response',
          stage: 'response-validation',
          path: 'target-fit-exchange-validation',
        },
      });
      expect(model).toHaveBeenCalledTimes(1);
    },
  );

  it('rejects malformed request input before retrieval effects', async () => {
    const loader = vi.fn();
    const model = vi.fn();
    const application = await createAcceptedApplication({
      dossierLoader: { loadActiveCandidateDossier: loader },
      fitModel: { assess: model },
    });
    expect(await application.recommendOss({})).toMatchObject({
      ok: false,
      failure: {
        kind: 'contract',
        code: 'invalid-recommendation-request',
        stage: 'request-validation',
        path: 'recommendation-request-parse',
      },
    });
    expect(loader).not.toHaveBeenCalled();
    expect(model).not.toHaveBeenCalled();
  });

  it('preserves a bounded model cause code without exposing the thrown error', async () => {
    const application = await createAcceptedApplication({
      fitModel: {
        assess: () =>
          Promise.reject(new HostedDiscoveryError('hosted.fit-model-timeout')),
      },
    });

    expect(
      await application.recommendOss(
        recommendationRequest({
          id: 'bounded-model-cause',
          term: 'authorization',
        }),
      ),
    ).toMatchObject({
      ok: false,
      failure: {
        kind: 'application',
        code: 'fit-model-failed',
        causeCode: 'hosted.fit-model-timeout',
        stage: 'model-assessment',
        path: 'fit-model-assessment',
      },
    });
  });
});

function fixedEngine(
  result: CandidateRetrievalResultV1,
): CandidateRetrievalEngineV1 {
  return Object.freeze({
    candidateCount: 150,
    retrieve: () => Object.freeze({ ok: true, result, issues: [] as const }),
  });
}

function restoreCandidate(
  value: RecommendationAssessmentModelDecompositionV1,
): void {
  const first = value.candidateAssessments['f1'];
  if (first === undefined) return;
  delete (value.candidateAssessments as Record<string, unknown>)['f1'];
  (value.candidateAssessments as Record<string, unknown>)['f6'] = first;
}

function inventEvidence(
  value: RecommendationAssessmentModelDecompositionV1,
): void {
  const first =
    value.candidateAssessments['f1']?.reasons[0]?.claims[0]?.inferences[0];
  if (first !== undefined) first.evidenceIds = ['e999'];
}

function removeReasonTraceability(
  value: RecommendationAssessmentModelDecompositionV1,
): void {
  const first = value.candidateAssessments['f1']?.reasons[0];
  if (first === undefined) return;
  first.evidenceIds = [];
  first.claims = [];
  first.candidateUnknownIds = [];
  first.assessmentUnknowns = [];
}

function inventRepositoryFact(
  value: RecommendationAssessmentModelDecompositionV1,
): void {
  const first =
    value.candidateAssessments['f1']?.reasons[0]?.claims[0]?.inferences[0];
  if (first !== undefined) first.repositoryFactIds = ['fact-invented'];
}

function removePositiveAuthorship(
  value: RecommendationAssessmentModelDecompositionV1,
): void {
  const reason = value.candidateAssessments['f1']?.reasons[0];
  const evidenceId = reason?.claims[0]?.inferences[0]?.evidenceIds[0];
  if (reason === undefined || evidenceId === undefined) return;
  reason.evidenceIds = [evidenceId];
  reason.claims = [];
}

function omitPositiveCandidate(
  value: RecommendationAssessmentModelDecompositionV1,
): void {
  value.orderedPositiveCandidateIds = [];
}

function includeNonPositiveCandidate(
  value: RecommendationAssessmentModelDecompositionV1,
): void {
  value.orderedPositiveCandidateIds = ['f1', 'f2'];
}

function duplicatePositiveCandidate(
  value: RecommendationAssessmentModelDecompositionV1,
): void {
  value.orderedPositiveCandidateIds = ['f1', 'f1'];
}

function promoteModelCandidate(
  value: RecommendationAssessmentModelDecompositionV1,
  index: number,
): void {
  const assessment = value.candidateAssessments[`f${String(index + 1)}`];
  const reason = assessment?.reasons[0];
  const claim = reason?.claims[0];
  const evidenceId = claim?.evidenceIds[0];
  if (assessment === undefined || reason === undefined || claim === undefined) {
    throw new Error('Ranking promotion fixture is incomplete.');
  }
  const selectedEvidenceId = evidenceId ?? claim.inferences[0]?.evidenceIds[0];
  if (selectedEvidenceId === undefined) {
    throw new Error('Ranking promotion evidence fixture is incomplete.');
  }
  assessment.fitJudgment = 'viable';
  claim.direction = 'favorable';
  claim.evidenceIds = [];
  claim.inferences = [
    {
      topic: 'runtime-support',
      statement: 'The candidate runtime support matches the target runtime.',
      rationale:
        'Supplied candidate evidence and the selected repository fact align.',
      evidenceIds: [selectedEvidenceId],
      repositoryFactIds: ['fact-runtime'],
    },
  ];
}
