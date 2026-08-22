import {
  repositoryFingerprintDigestV1,
  type OssRecommendationRequestV2,
  type CandidateRetrievalResultV1,
  type RecommendationAssessmentModelResponseV1,
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
          const candidateIds =
            response.targetFitAssessment.fitAssessment.candidateAssessments.map(
              ({ candidateId }) => candidateId,
            );
          rejectedCandidateId = candidateIds[4];
          response.targetFitAssessment.fitAssessment.orderedViableCandidateIds =
            [
              candidateIds[4]!,
              candidateIds[3]!,
              candidateIds[0]!,
              candidateIds[2]!,
              candidateIds[1]!,
            ];
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
          const resolution =
            response.evidenceNeededHardConstraintResolutions.find(
              (candidate) =>
                candidate.candidateId === positive?.candidateId &&
                candidate.evaluationId === prohibited?.evaluationId,
            );
          if (resolution === undefined) {
            throw new Error('Prohibited hard-resolution fixture is missing.');
          }
          resolution.state = 'unresolved';
          resolution.inferenceIds = [];
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

  it('augments only evidence-needed finalists with matching request-scoped artifact excerpts before the one model call', async () => {
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
    ['invented repository fact', inventRepositoryFact],
    ['viable hard conflict', addPositiveHardConflict],
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
  value: RecommendationAssessmentModelResponseV1,
): void {
  const first = value.targetFitAssessment.fitAssessment.candidateAssessments[0];
  if (first !== undefined) first.candidateId = 'candidate-invented';
}

function inventEvidence(value: RecommendationAssessmentModelResponseV1): void {
  const first = value.targetFitAssessment.fitAssessment.inferences[0];
  if (first !== undefined) first.evidenceIds = ['evidence-invented'];
}

function removeReasonTraceability(
  value: RecommendationAssessmentModelResponseV1,
): void {
  const first =
    value.targetFitAssessment.fitAssessment.candidateAssessments[0]?.reasons[0];
  if (first === undefined) return;
  first.evidenceIds = [];
  first.inferenceIds = [];
  first.unknownIds = [];
}

function inventRepositoryFact(
  value: RecommendationAssessmentModelResponseV1,
): void {
  const first = value.targetFitAssessment.inferenceRepositoryFactBindings[0];
  if (first !== undefined) first.repositoryFactIds = ['fact-invented'];
}

function addPositiveHardConflict(
  value: RecommendationAssessmentModelResponseV1,
): void {
  const assessment =
    value.targetFitAssessment.fitAssessment.candidateAssessments[0];
  const evidenceId = assessment?.evidenceIds[0];
  if (assessment === undefined || evidenceId === undefined) return;
  assessment.hardConstraintConflictIds = ['conflict-invented'];
  value.targetFitAssessment.fitAssessment.hardConstraintConflicts = [
    {
      conflictId: 'conflict-invented',
      candidateId: assessment.candidateId,
      constraintId: 'constraint-invented',
      reasonCode: 'constraint-invented',
      evidenceIds: [evidenceId],
    },
  ];
}

function promoteModelCandidate(
  value: RecommendationAssessmentModelResponseV1,
  index: number,
): void {
  const fit = value.targetFitAssessment.fitAssessment;
  const assessment = fit.candidateAssessments[index];
  const claim = fit.materialClaims[index];
  const evidenceId = assessment?.evidenceIds[0];
  const reason = assessment?.reasons[0];
  if (
    assessment === undefined ||
    claim === undefined ||
    evidenceId === undefined ||
    reason === undefined
  ) {
    throw new Error('Ranking promotion fixture is incomplete.');
  }
  const inferenceId = `i${String(index + 1)}`;
  assessment.disposition = 'viable';
  assessment.inferenceIds = [inferenceId];
  reason.inferenceIds = [inferenceId];
  claim.direction = 'favorable';
  claim.inferenceIds = [inferenceId];
  fit.inferences.push({
    kind: 'inference',
    inferenceId,
    candidateId: assessment.candidateId,
    topic: 'runtime-support',
    statement: 'The candidate runtime support matches the target runtime.',
    rationale:
      'Supplied candidate evidence and repository fact fact-runtime align.',
    evidenceIds: [evidenceId],
  });
  value.targetFitAssessment.inferenceRepositoryFactBindings.push({
    inferenceId,
    repositoryFactIds: ['fact-runtime'],
  });
}
