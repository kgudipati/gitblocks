import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import {
  createCapabilityRequestFromRecommendationV1,
  getContractSchemaV1,
  normalizeCapabilityQueryV1,
  parseOssRecommendationRequestV1,
  parseRecommendationAssessmentModelResponseV1,
  parseRecommendationAssessmentResponseV1,
  parseTargetFitAssessmentResponseV1,
  repositoryFingerprintDigestV1,
  validateRecommendationAssessmentExchangeV1,
  validateRecommendationModelAssessmentExchangeV1,
  validateTargetFitAssessmentExchangeV1,
  type CapabilityQueryInputV1,
  type CapabilityTaxonomyV1,
  type FitAssessmentRequestV1,
  type OssRecommendationRequestV1,
  type RecommendationAssessmentResponseV1,
  type RecommendationAssessmentModelResponseV1,
  type RecommendationRetrievalFinalistV1,
  type TargetFitAssessmentResponseV1,
} from '../src/index.ts';
import {
  cloneValue,
  createCapabilityRequest,
  createFitAssessmentRequest,
  createFitAssessmentResponse,
  createRepositoryFingerprint,
  type MutableValue,
} from './fixtures.ts';

const taxonomyFixture = readFile(
  new URL(
    '../../../catalog/capability-taxonomy/1.0.0/manifest.json',
    import.meta.url,
  ),
  'utf8',
).then((text) => JSON.parse(text) as CapabilityTaxonomyV1);

describe('OssRecommendationRequestV1', () => {
  it('parses a bound request and exports the authoritative closed schema', () => {
    const request = createRecommendationRequest();
    expect(parseOssRecommendationRequestV1(request)).toMatchObject({
      ok: true,
    });
    expect(getContractSchemaV1('oss-recommendation-request')).toMatchObject({
      $id: 'https://gitblocks.dev/schemas/contracts/oss-recommendation-request/1.0.0',
      additionalProperties: false,
    });
  });

  it('rejects missing or mismatched fingerprint binding and invalid nested fingerprints', () => {
    const request = createRecommendationRequest();
    expect(
      parseOssRecommendationRequestV1({
        ...request,
        capabilityQuery: {
          ...request.capabilityQuery,
          repositoryFingerprintReference: null,
        },
      }),
    ).toMatchObject({ ok: false });
    expect(
      parseOssRecommendationRequestV1({
        ...request,
        capabilityQuery: {
          ...request.capabilityQuery,
          repositoryFingerprintReference: {
            fingerprintId: request.repositoryFingerprint.fingerprintId,
            fingerprintDigest: '0'.repeat(64),
          },
        },
      }),
    ).toMatchObject({ ok: false });
    expect(
      parseOssRecommendationRequestV1({
        ...request,
        repositoryFingerprint: {
          ...request.repositoryFingerprint,
          facts: [
            request.repositoryFingerprint.facts[0],
            request.repositoryFingerprint.facts[0],
          ],
        },
      }),
    ).toMatchObject({ ok: false });
  });

  it('digests canonical fingerprint content independent of set ordering', () => {
    const first = createRepositoryFingerprint();
    const second = cloneValue(first);
    second.facts.reverse();
    second.withheldCategories.reverse();
    const codeSet = second.facts.find(
      (fact) => fact.kind === 'coded' && fact.value.kind === 'code-set',
    );
    if (codeSet?.kind === 'coded' && codeSet.value.kind === 'code-set') {
      codeSet.value.codes.reverse();
    }
    expect(repositoryFingerprintDigestV1(second)).toBe(
      repositoryFingerprintDigestV1(first),
    );
  });

  it('constructs the existing capability request without weakening modality or identity', async () => {
    const request = createRecommendationRequest({
      draftConstraints: [
        {
          constraintId: 'constraint-runtime',
          modality: 'required',
          statement: 'Require an in-process integration.',
          originalTerm: 'in-process-authorization-library',
          facetHint: 'architecture',
          reasonCode: 'runtime-required',
        },
        {
          constraintId: 'constraint-redis',
          modality: 'prohibited',
          statement: 'Do not require Redis.',
          originalTerm: 'redis',
          facetHint: 'infrastructure',
          reasonCode: 'redis-prohibited',
        },
        {
          constraintId: 'constraint-api',
          modality: 'preferred',
          statement: 'Prefer a small integration API.',
          originalTerm: 'small-api',
          facetHint: 'other',
          reasonCode: null,
        },
      ],
    });
    const normalized = normalizeCapabilityQueryV1(
      request.capabilityQuery,
      cloneValue(await taxonomyFixture),
    );
    expect(normalized).toMatchObject({ ok: true });
    if (!normalized.ok || normalized.value.outcome !== 'normalized') return;

    const bridged = createCapabilityRequestFromRecommendationV1({
      recommendationRequest: request,
      normalization: normalized.value,
    });
    expect(bridged).toMatchObject({
      requestId: request.capabilityQuery.queryInputId,
      capabilityFamily: 'authorization',
      summary: request.capabilityQuery.summary,
      successConditions: request.capabilityQuery.successConditions,
      hardConstraints: [
        {
          constraintId: 'constraint-runtime',
          reasonCode: 'runtime-required',
          statement: 'Require an in-process integration.',
        },
        {
          constraintId: 'constraint-redis',
          reasonCode: 'redis-prohibited',
          statement: 'Do not require Redis.',
        },
      ],
      preferences: [
        {
          preferenceId: 'constraint-api',
          statement: 'Prefer a small integration API.',
        },
      ],
      transmissionApproval: request.transmissionApproval,
    });
    expect(normalized.value.normalizedConstraints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ modality: 'required' }),
        expect.objectContaining({ modality: 'prohibited' }),
        expect.objectContaining({ modality: 'preferred' }),
      ]),
    );
  });

  it('rejects otherwise valid query input that exceeds existing fit-request collection bounds', () => {
    const request = createRecommendationRequest({
      draftConstraints: Array.from({ length: 21 }, (_, index) => ({
        constraintId: `preference-${String(index)}`,
        modality: 'preferred' as const,
        statement: `Prefer integration property ${String(index)}.`,
        originalTerm: `property-${String(index)}`,
        facetHint: 'other' as const,
        reasonCode: null,
      })),
    });
    expect(parseOssRecommendationRequestV1(request)).toMatchObject({
      ok: false,
      issues: [
        expect.objectContaining({
          code: 'domain.recommendation.fit-request-bounds',
        }),
      ],
    });
  });
});

describe('TargetFitAssessmentResponseV1 repository grounding', () => {
  it('accepts candidate-evidence and supplied-target-fact grounded positive fit', () => {
    const { request, response } = createGroundedExchange();
    expect(parseTargetFitAssessmentResponseV1(response)).toMatchObject({
      ok: true,
    });
    expect(
      validateTargetFitAssessmentExchangeV1(request, response),
    ).toMatchObject({ ok: true });
  });

  it('rejects unknown repository facts and positive dispositions without target-grounded favorable support', () => {
    const { request, response } = createGroundedExchange();
    const inventedFact = cloneValue(response);
    inventedFact.inferenceRepositoryFactBindings[0]!.repositoryFactIds = [
      'fact-invented',
    ];
    expect(
      validateTargetFitAssessmentExchangeV1(request, inventedFact),
    ).toMatchObject({
      ok: false,
      issues: [
        expect.objectContaining({
          code: 'domain.target-fit.repository-fact-reference',
        }),
      ],
    });

    const ungrounded = cloneValue(response);
    ungrounded.inferenceRepositoryFactBindings = [];
    expect(
      validateTargetFitAssessmentExchangeV1(request, ungrounded),
    ).toMatchObject({
      ok: false,
      issues: [
        expect.objectContaining({
          code: 'domain.target-fit.positive-support',
        }),
      ],
    });
  });

  it('rejects duplicate or unknown inference bindings before exchange validation', () => {
    const { response } = createGroundedExchange();
    const duplicate = cloneValue(response);
    duplicate.inferenceRepositoryFactBindings.push({
      inferenceId: 'inference-alpha',
      repositoryFactIds: ['fact-deployment'],
    });
    expect(parseTargetFitAssessmentResponseV1(duplicate)).toMatchObject({
      ok: false,
      issues: [
        expect.objectContaining({
          code: 'domain.target-fit.binding-duplicate',
        }),
      ],
    });

    const unknown = cloneValue(response);
    unknown.inferenceRepositoryFactBindings[0]!.inferenceId =
      'inference-invented';
    expect(parseTargetFitAssessmentResponseV1(unknown)).toMatchObject({
      ok: false,
      issues: [
        expect.objectContaining({
          code: 'domain.target-fit.inference-reference',
        }),
      ],
    });
  });

  it('allows omitted supplied evidence but rejects a differing declared copy', () => {
    const { request, response } = createGroundedExchange();
    const droppedEvidence = cloneValue(response);
    droppedEvidence.fitAssessment.evidence =
      droppedEvidence.fitAssessment.evidence.slice(0, 1);
    expect(
      validateTargetFitAssessmentExchangeV1(request, droppedEvidence),
    ).toMatchObject({ ok: true });

    const inventedEvidence = cloneValue(response);
    inventedEvidence.fitAssessment.evidence[0]!.observation =
      'Invented replacement evidence.';
    const validation = validateTargetFitAssessmentExchangeV1(
      request,
      inventedEvidence,
    );
    expect(validation.ok).toBe(false);
    if (validation.ok) return;
    expect(validation.issues.map(({ code }) => code)).toContain(
      'domain.exchange.evidence-preservation',
    );
  });
});

describe('RecommendationAssessmentResponseV1', () => {
  it('wraps the immutable target-fit response with additive hard resolutions', () => {
    const { response: targetFitAssessment } = createGroundedExchange();
    const response: RecommendationAssessmentResponseV1 = {
      contractVersion: '1.0.0',
      targetFitAssessment,
      evidenceNeededHardConstraintResolutions: [],
    };

    expect(parseRecommendationAssessmentResponseV1(response)).toMatchObject({
      ok: true,
    });
    expect(
      getContractSchemaV1('recommendation-assessment-response'),
    ).toMatchObject({
      $id: 'https://gitblocks.dev/schemas/contracts/recommendation-assessment-response/1.0.0',
      additionalProperties: false,
    });
  });

  it('defines a compact model contract and hydrates trusted response-owned fields', async () => {
    const exchange = await createHardResolutionExchange();
    const compact = compactModelResponse(exchange.request, exchange.response);
    const inferenceEvidenceId =
      exchange.response.targetFitAssessment.fitAssessment.inferences[0]
        ?.evidenceIds[0];
    const suppliedEvidenceIds = exchange.request.candidates.flatMap(
      ({ observations }) => observations.map(({ evidenceId }) => evidenceId),
    );
    const inferenceEvidenceIndex =
      inferenceEvidenceId === undefined
        ? -1
        : suppliedEvidenceIds.indexOf(inferenceEvidenceId);
    if (inferenceEvidenceIndex < 0) {
      throw new Error('Compact inference fixture is incomplete.');
    }
    expect(
      compact.targetFitAssessment.fitAssessment.inferences[0]?.evidenceIds,
    ).toEqual([`e${String(inferenceEvidenceIndex + 1)}`]);

    expect(parseRecommendationAssessmentModelResponseV1(compact)).toMatchObject(
      {
        ok: true,
      },
    );
    expect(compact.targetFitAssessment.fitAssessment).not.toHaveProperty(
      'assessmentId',
    );
    expect(compact.targetFitAssessment.fitAssessment).not.toHaveProperty(
      'producedAt',
    );
    expect(compact.targetFitAssessment.fitAssessment).not.toHaveProperty(
      'evidence',
    );
    expect(compact.targetFitAssessment.fitAssessment).not.toHaveProperty(
      'candidateLimitations',
    );
    for (const applicationOwnedField of [
      { assessmentId: 'assessment-model-controlled' },
      { producedAt: exchange.request.evidenceCutoff },
    ]) {
      expect(
        parseRecommendationAssessmentModelResponseV1({
          ...compact,
          targetFitAssessment: {
            ...compact.targetFitAssessment,
            fitAssessment: {
              ...compact.targetFitAssessment.fitAssessment,
              ...applicationOwnedField,
            },
          },
        }),
      ).toMatchObject({ ok: false });
    }

    const validation = validateRecommendationModelAssessmentExchangeV1({
      ...exchange,
      response: compact,
      assessmentId: 'assessment-hydrated',
      producedAt: exchange.request.evidenceCutoff,
    });
    expect(validation).toMatchObject({ ok: true });
    if (!validation.ok) return;
    expect(
      validation.response.targetFitAssessment.fitAssessment.inferences[0]
        ?.evidenceIds,
    ).toEqual([inferenceEvidenceId]);
    expect(validation.response.targetFitAssessment.fitAssessment).toMatchObject(
      {
        assessmentId: 'assessment-hydrated',
        assessmentRequestId: exchange.request.assessmentRequestId,
        correlationId: exchange.request.correlationId,
        evidenceCutoff: exchange.request.evidenceCutoff,
        producedAt: exchange.request.evidenceCutoff,
        evidence: exchange.request.candidates.flatMap(
          ({ observations }) => observations,
        ),
        candidateLimitations: exchange.request.candidates.flatMap(
          ({ limitations }) => limitations,
        ),
      },
    );
  });

  it('rejects compact declared-record ID collisions before hydration', async () => {
    const exchange = await createHardResolutionExchange();
    const compact = compactModelResponse(exchange.request, exchange.response);
    const accepted = validateRecommendationModelAssessmentExchangeV1({
      ...exchange,
      response: compact,
      assessmentId: 'assessment-collision',
      producedAt: exchange.request.evidenceCutoff,
    });
    if (!accepted.ok) {
      throw new Error('Compact collision fixture is incomplete.');
    }
    const mappedInferenceId =
      accepted.response.targetFitAssessment.fitAssessment.inferences[0]
        ?.inferenceId;
    const suppliedEvidence = exchange.request.candidates[0]?.observations[0];
    if (mappedInferenceId === undefined || suppliedEvidence === undefined) {
      throw new Error('Compact collision fixture is incomplete.');
    }
    const priorEvidenceId = suppliedEvidence.evidenceId;
    suppliedEvidence.evidenceId = mappedInferenceId;
    for (const limitation of exchange.request.candidates[0]?.limitations ??
      []) {
      limitation.evidenceIds = limitation.evidenceIds.map((evidenceId) =>
        evidenceId === priorEvidenceId ? mappedInferenceId : evidenceId,
      );
    }
    for (const unknown of exchange.request.candidates[0]?.unknowns ?? []) {
      unknown.evidenceIds = unknown.evidenceIds.map((evidenceId) =>
        evidenceId === priorEvidenceId ? mappedInferenceId : evidenceId,
      );
    }

    const validation = validateRecommendationModelAssessmentExchangeV1({
      ...exchange,
      response: compact,
      assessmentId: 'assessment-collision',
      producedAt: exchange.request.evidenceCutoff,
    });
    expect(validation).toMatchObject({
      ok: false,
      issues: [
        expect.objectContaining({
          code: 'domain.recommendation-assessment.catalog-id-collision',
        }),
      ],
    });
  });

  it('rejects invented evidence references in compact model output', async () => {
    const exchange = await createHardResolutionExchange();
    const compact = compactModelResponse(exchange.request, exchange.response);
    const inference = compact.targetFitAssessment.fitAssessment.inferences[0];
    if (inference === undefined)
      throw new Error('Compact inference fixture is incomplete.');
    inference.evidenceIds = ['e999'];

    const validation = validateRecommendationModelAssessmentExchangeV1({
      ...exchange,
      response: compact,
      assessmentId: 'assessment-invented-evidence',
      producedAt: exchange.request.evidenceCutoff,
    });
    expect(validation).toMatchObject({ ok: false });
    if (validation.ok) return;
    expect(validation.issues.map(({ code }) => code)).toContain(
      'domain.recommendation-assessment.surrogate-reference',
    );
  });

  it('rejects a mutated supplied-evidence surrogate without repair', async () => {
    const exchange = await createHardResolutionExchange();
    const compact = compactModelResponse(exchange.request, exchange.response);
    const inference = compact.targetFitAssessment.fitAssessment.inferences[0];
    if (inference === undefined)
      throw new Error('Compact inference fixture is incomplete.');
    inference.evidenceIds = ['ev-e1'];

    const validation = validateRecommendationModelAssessmentExchangeV1({
      ...exchange,
      response: compact,
      assessmentId: 'assessment-mutated-evidence',
      producedAt: exchange.request.evidenceCutoff,
    });
    expect(validation).toMatchObject({ ok: false });
    if (validation.ok) return;
    expect(validation.issues.map(({ code }) => code)).toContain(
      'contract.pattern',
    );
  });

  it('rejects a cited but undeclared compact claim token', async () => {
    const exchange = await createHardResolutionExchange();
    const compact = compactModelResponse(exchange.request, exchange.response);
    compact.targetFitAssessment.fitAssessment.materialClaims = [];

    const validation = validateRecommendationModelAssessmentExchangeV1({
      ...exchange,
      response: compact,
      assessmentId: 'assessment-undeclared-claim',
      producedAt: exchange.request.evidenceCutoff,
    });
    expect(validation.ok).toBe(false);
    if (validation.ok) return;
    expect(validation.issues.map(({ code }) => code)).toContain(
      'domain.reference.unknown-claim',
    );
  });

  it('accepts a declared compact claim token and preserves its exact content through hydration', async () => {
    const exchange = await createHardResolutionExchange();
    const compact = compactModelResponse(exchange.request, exchange.response);
    const fit = compact.targetFitAssessment.fitAssessment;
    const assessment = fit.candidateAssessments.find(
      ({ candidateId }) => candidateId === 'candidate-alpha',
    );
    const claim = fit.materialClaims.find(
      ({ candidateId }) => candidateId === 'candidate-alpha',
    );
    if (assessment === undefined || claim === undefined) {
      throw new Error('Compact claim fixture is incomplete.');
    }
    claim.claimId = 'c1';
    claim.topic = 'target-runtime-fit';
    claim.statement =
      'The declared claim content must survive hydration exactly.';
    assessment.claimIds = ['c1'];
    const declaredContent = {
      candidateId: claim.candidateId,
      topic: claim.topic,
      direction: claim.direction,
      statement: claim.statement,
    };

    const validation = validateRecommendationModelAssessmentExchangeV1({
      ...exchange,
      response: compact,
      assessmentId: 'assessment-declared-claim',
      producedAt: exchange.request.evidenceCutoff,
    });
    expect(
      validation.ok,
      validation.ok ? undefined : JSON.stringify(validation.issues),
    ).toBe(true);
    if (!validation.ok) return;
    const hydratedFit = validation.response.targetFitAssessment.fitAssessment;
    const hydratedClaimId = hydratedFit.candidateAssessments.find(
      ({ candidateId }) => candidateId === claim.candidateId,
    )?.claimIds[0];
    const hydratedClaim = hydratedFit.materialClaims.find(
      ({ claimId }) => claimId === hydratedClaimId,
    );
    expect(hydratedClaimId).not.toBe('c1');
    expect(hydratedClaim).toMatchObject(declaredContent);
  });

  it.each([
    [
      'candidate ownership',
      'domain.reference.candidate-ownership',
      (response: RecommendationAssessmentModelResponseV1) => {
        const crossOwned =
          response.targetFitAssessment.fitAssessment.candidateAssessments[1]
            ?.evidenceIds[0];
        if (crossOwned !== undefined) {
          response.targetFitAssessment.fitAssessment.candidateAssessments[0]!.evidenceIds =
            [crossOwned];
        }
      },
    ],
    [
      'inference grounding',
      'domain.reference.candidate-ownership',
      (response: RecommendationAssessmentModelResponseV1) => {
        const crossOwned =
          response.targetFitAssessment.fitAssessment.candidateAssessments[1]
            ?.evidenceIds[0];
        if (crossOwned !== undefined) {
          response.targetFitAssessment.fitAssessment.inferences[0]!.evidenceIds =
            [crossOwned];
        }
      },
    ],
    [
      'reason traceability',
      'domain.reason.traceability',
      (response: RecommendationAssessmentModelResponseV1) => {
        const reason =
          response.targetFitAssessment.fitAssessment.candidateAssessments[0]!
            .reasons[0]!;
        reason.evidenceIds = [];
        reason.inferenceIds = [];
        reason.unknownIds = [];
      },
    ],
    [
      'disposition rules',
      'domain.outcome.disposition',
      (response: RecommendationAssessmentModelResponseV1) => {
        for (const assessment of response.targetFitAssessment.fitAssessment
          .candidateAssessments) {
          assessment.disposition = 'rejected';
        }
      },
    ],
  ] as const)(
    'preserves %s validation',
    async (_name, expectedCode, mutate) => {
      const exchange = await createHardResolutionExchange();
      const compact = compactModelResponse(exchange.request, exchange.response);
      mutate(compact);

      const validation = validateRecommendationModelAssessmentExchangeV1({
        ...exchange,
        response: compact,
        assessmentId: `assessment-${_name.replaceAll(' ', '-')}`,
        producedAt: exchange.request.evidenceCutoff,
      });
      expect(validation.ok).toBe(false);
      if (validation.ok) return;
      expect(validation.issues.map(({ code }) => code)).toContain(expectedCode);
    },
  );

  it('accepts exact evidence-needed coverage grounded in candidate-owned inferences', async () => {
    const exchange = await createHardResolutionExchange();
    const validation = validateRecommendationAssessmentExchangeV1(exchange);
    expect(
      validation.ok,
      validation.ok ? undefined : JSON.stringify(validation.issues),
    ).toBe(true);
  });

  it('accepts hard-resolution inference grounding against supplied evidence without a response echo', async () => {
    const exchange = await createHardResolutionExchange();
    exchange.response.targetFitAssessment.fitAssessment.evidence = [];

    const validation = validateRecommendationAssessmentExchangeV1(exchange);
    expect(
      validation.ok,
      validation.ok ? undefined : JSON.stringify(validation.issues),
    ).toBe(true);
  });

  it('binds preserved-declaration evaluations by exact original constraint ID', async () => {
    const exchange = await createHardResolutionExchange([
      {
        constraintId: 'custom-runtime-required',
        modality: 'required',
        statement: 'The candidate must use the declared custom runtime.',
        originalTerm: 'custom-runtime',
        facetHint: 'runtime',
        reasonCode: 'custom-runtime-required',
      },
    ]);
    expect(
      exchange.retrievalFinalists[1]?.unresolvedHardEvaluations.map(
        ({ sourceKind }) => sourceKind,
      ),
    ).toEqual(['normalized-constraint', 'preserved-declaration']);
    expect(validateRecommendationAssessmentExchangeV1(exchange)).toMatchObject({
      ok: true,
    });
  });

  it('allows one candidate-owned artifact inference to ground both normalized and preserved resolutions', async () => {
    const exchange = await createHardResolutionExchange([
      {
        constraintId: 'custom-runtime-required',
        modality: 'required',
        statement: 'The candidate must use the declared custom runtime.',
        originalTerm: 'custom-runtime',
        facetHint: 'runtime',
        reasonCode: 'custom-runtime-required',
      },
    ]);
    const requestEvidence = exchange.request.candidates
      .find(({ identity }) => identity.candidateId === 'candidate-alpha')
      ?.observations.find(({ evidenceId }) => evidenceId === 'evidence-alpha');
    const responseEvidence =
      exchange.response.targetFitAssessment.fitAssessment.evidence.find(
        ({ evidenceId }) => evidenceId === 'evidence-alpha',
      );
    const inference =
      exchange.response.targetFitAssessment.fitAssessment.inferences.find(
        ({ inferenceId }) => inferenceId === 'inference-alpha',
      );
    if (
      requestEvidence === undefined ||
      responseEvidence === undefined ||
      inference === undefined
    ) {
      throw new Error('Shared artifact-grounding fixture is incomplete.');
    }
    for (const evidence of [requestEvidence, responseEvidence]) {
      evidence.topic = 'artifact-excerpt';
      evidence.observation =
        'The exact immutable artifact line supports this candidate constraint.';
      if (evidence.source.kind === 'git-commit') {
        evidence.source.sourceUrl =
          'https://github.com/example/alpha/blob/0123456789abcdef0123456789abcdef01234567/README.md#L7';
        evidence.source.immutableUrl =
          'https://github.com/example/alpha/blob/0123456789abcdef0123456789abcdef01234567/README.md#L7';
      }
    }

    expect(
      exchange.retrievalFinalists[1]?.unresolvedHardEvaluations.map(
        ({ sourceKind }) => sourceKind,
      ),
    ).toEqual(['normalized-constraint', 'preserved-declaration']);
    expect(
      exchange.response.evidenceNeededHardConstraintResolutions.map(
        ({ inferenceIds }) => inferenceIds,
      ),
    ).toEqual([['inference-alpha'], ['inference-alpha']]);
    expect(inference.evidenceIds).toEqual(['evidence-alpha']);
    expect(
      exchange.response.targetFitAssessment.fitAssessment.evidence.filter(
        ({ evidenceId }) => evidenceId === 'evidence-alpha',
      ),
    ).toHaveLength(1);
    expect(validateRecommendationAssessmentExchangeV1(exchange)).toMatchObject({
      ok: true,
    });
  });

  it.each([
    [
      'missing resolution',
      (exchange: HardResolutionExchange) => {
        exchange.response.evidenceNeededHardConstraintResolutions.pop();
      },
    ],
    [
      'duplicate resolution',
      (exchange: HardResolutionExchange) => {
        exchange.response.evidenceNeededHardConstraintResolutions.push(
          cloneValue(
            exchange.response.evidenceNeededHardConstraintResolutions[0]!,
          ),
        );
      },
    ],
    [
      'invented evaluation',
      (exchange: HardResolutionExchange) => {
        exchange.response.evidenceNeededHardConstraintResolutions[0]!.evaluationId =
          'evaluation-invented';
      },
    ],
    [
      'wrong candidate pairing',
      (exchange: HardResolutionExchange) => {
        exchange.response.evidenceNeededHardConstraintResolutions[0]!.candidateId =
          'candidate-beta';
      },
    ],
    [
      'eligible candidate resolution',
      (exchange: HardResolutionExchange) => {
        exchange.response.evidenceNeededHardConstraintResolutions.push({
          candidateId: 'candidate-beta',
          evaluationId: 'evaluation-invented',
          state: 'unresolved',
          inferenceIds: [],
        });
      },
    ],
    [
      'non-finalist resolution',
      (exchange: HardResolutionExchange) => {
        exchange.response.evidenceNeededHardConstraintResolutions.push({
          candidateId: 'candidate-outside',
          evaluationId: 'evaluation-invented',
          state: 'unresolved',
          inferenceIds: [],
        });
      },
    ],
    [
      'satisfied without inference grounding',
      (exchange: HardResolutionExchange) => {
        exchange.response.evidenceNeededHardConstraintResolutions[0]!.inferenceIds =
          [];
      },
    ],
    [
      'inference owned by another candidate',
      (exchange: HardResolutionExchange) => {
        exchange.response.targetFitAssessment.fitAssessment.inferences[0]!.candidateId =
          'candidate-beta';
      },
    ],
    [
      'normalization source mismatch',
      (exchange: HardResolutionExchange) => {
        exchange.retrievalFinalists[1]!.unresolvedHardEvaluations[0]!.conceptId =
          'concept-invented';
      },
    ],
  ] as const)('rejects %s', async (_name, mutate) => {
    const exchange = await createHardResolutionExchange();
    mutate(exchange);
    expect(validateRecommendationAssessmentExchangeV1(exchange)).toMatchObject({
      ok: false,
    });
  });

  it.each(['recommended', 'viable'] as const)(
    'rejects an unresolved hard evaluation with %s disposition',
    async (disposition) => {
      const exchange = await createHardResolutionExchange();
      exchange.response.evidenceNeededHardConstraintResolutions[0]!.state =
        'unresolved';
      exchange.response.evidenceNeededHardConstraintResolutions[0]!.inferenceIds =
        [];
      exchange.response.targetFitAssessment.fitAssessment.candidateAssessments[0]!.disposition =
        disposition;
      expect(
        validateRecommendationAssessmentExchangeV1(exchange),
      ).toMatchObject({ ok: false });
    },
  );

  it('rejects partial satisfaction for a positive evidence-needed candidate', async () => {
    const exchange = await createHardResolutionExchange();
    exchange.response.evidenceNeededHardConstraintResolutions[1]!.state =
      'unresolved';
    exchange.response.evidenceNeededHardConstraintResolutions[1]!.inferenceIds =
      [];
    expect(validateRecommendationAssessmentExchangeV1(exchange)).toMatchObject({
      ok: false,
    });
  });

  it('accepts a grounded conflict only when the candidate is rejected, unranked, and bound to the exact original reason code', async () => {
    const exchange = await createHardResolutionExchange();
    const resolution =
      exchange.response.evidenceNeededHardConstraintResolutions.find(
        (candidate) =>
          sourceConstraintIdForResolution(exchange, candidate.evaluationId) ===
          'runtime-required',
      );
    if (resolution === undefined)
      throw new Error('Runtime resolution is missing.');
    const sourceConstraintId = 'runtime-required';
    const assessment =
      exchange.response.targetFitAssessment.fitAssessment
        .candidateAssessments[0]!;
    resolution.state = 'conflict';
    assessment.disposition = 'rejected';
    assessment.reasons[0]!.reasonCode = 'runtime-required';
    assessment.hardConstraintConflictIds = ['conflict-alpha-r8'];
    exchange.response.targetFitAssessment.fitAssessment.hardConstraintConflicts.push(
      {
        conflictId: 'conflict-alpha-r8',
        candidateId: 'candidate-alpha',
        constraintId: sourceConstraintId,
        reasonCode: 'runtime-required',
        evidenceIds: ['evidence-alpha'],
      },
    );
    exchange.response.targetFitAssessment.fitAssessment.rankGroups = [];
    exchange.response.targetFitAssessment.fitAssessment.outcome =
      'no-viable-candidate';

    expect(validateRecommendationAssessmentExchangeV1(exchange)).toMatchObject({
      ok: true,
    });

    const ungrounded = cloneValue(exchange);
    const ungroundedResolution =
      ungrounded.response.evidenceNeededHardConstraintResolutions.find(
        ({ state }) => state === 'conflict',
      );
    if (ungroundedResolution === undefined)
      throw new Error('Conflict resolution is missing.');
    ungroundedResolution.inferenceIds = [];
    expect(
      validateRecommendationAssessmentExchangeV1(ungrounded),
    ).toMatchObject({ ok: false });

    for (const disposition of ['recommended', 'viable'] as const) {
      const promoted = cloneValue(exchange);
      promoted.response.targetFitAssessment.fitAssessment.candidateAssessments[0]!.disposition =
        disposition;
      expect(
        validateRecommendationAssessmentExchangeV1(promoted),
      ).toMatchObject({ ok: false });
    }

    const ranked = cloneValue(exchange);
    ranked.response.targetFitAssessment.fitAssessment.rankGroups = [
      { candidateIds: ['candidate-alpha'] },
    ];
    expect(validateRecommendationAssessmentExchangeV1(ranked)).toMatchObject({
      ok: false,
    });

    const wrongSource = cloneValue(exchange);
    wrongSource.response.targetFitAssessment.fitAssessment.hardConstraintConflicts[1]!.constraintId =
      'constraint-invented';
    expect(
      validateRecommendationAssessmentExchangeV1(wrongSource),
    ).toMatchObject({ ok: false });

    const wrongReason = cloneValue(exchange);
    wrongReason.response.targetFitAssessment.fitAssessment.hardConstraintConflicts[1]!.reasonCode =
      'wrong-reason';
    expect(
      validateRecommendationAssessmentExchangeV1(wrongReason),
    ).toMatchObject({ ok: false });
  });
});

interface HardResolutionExchange {
  request: ReturnType<typeof createFitAssessmentRequest>;
  normalization: Awaited<ReturnType<typeof normalizeHardResolutionQuery>>;
  retrievalFinalists: MutableValue<RecommendationRetrievalFinalistV1>[];
  response: MutableValue<RecommendationAssessmentResponseV1>;
}

async function createHardResolutionExchange(
  draftConstraints: CapabilityQueryInputV1['draftConstraints'] = [
    {
      constraintId: 'runtime-required',
      modality: 'required',
      statement: 'The candidate must be an in-process library.',
      originalTerm: 'in-process-authorization-library',
      facetHint: 'architecture',
      reasonCode: 'runtime-required',
    },
    {
      constraintId: 'redis-prohibited',
      modality: 'prohibited',
      statement: 'The candidate must not require Redis.',
      originalTerm: 'redis',
      facetHint: 'infrastructure',
      reasonCode: 'redis-prohibited',
    },
  ],
): Promise<HardResolutionExchange> {
  const recommendationRequest = createRecommendationRequest({
    draftConstraints,
  });
  const normalization = await normalizeHardResolutionQuery(
    recommendationRequest,
  );
  const request = createFitAssessmentRequest();
  request.capabilityRequest = createCapabilityRequestFromRecommendationV1({
    recommendationRequest,
    normalization,
  });
  request.candidates.reverse();
  const evaluations = [
    ...normalization.normalizedConstraints.map((constraint) => ({
      evaluationId: constraint.normalizedConstraintId,
      sourceKind: 'normalized-constraint' as const,
      modality: constraint.modality as 'required' | 'prohibited',
      facet: constraint.facet,
      conceptId: constraint.conceptId,
      profileFieldId:
        constraint.facet === 'architecture'
          ? ('adoption-unit-type' as const)
          : constraint.facet === 'infrastructure'
            ? ('required-infrastructure' as const)
            : null,
      match: 'unresolved' as const,
      state: 'unresolved' as const,
      ruleId: 'r8-test-unresolved-profile-field',
    })),
    ...normalization.preservedDeclarations.map((declaration) => ({
      evaluationId: declaration.constraintId,
      sourceKind: 'preserved-declaration' as const,
      modality: declaration.modality as 'required' | 'prohibited',
      facet: declaration.facet,
      conceptId: null,
      profileFieldId: null,
      match: 'unresolved' as const,
      state: 'unresolved' as const,
      ruleId: 'preserved-declaration-has-no-controlled-profile-mapping',
    })),
  ];
  const retrievalFinalists: MutableValue<RecommendationRetrievalFinalistV1>[] =
    [
      {
        candidateId: 'candidate-beta',
        lane: 'eligible',
        unresolvedHardEvaluations: [],
      },
      {
        candidateId: 'candidate-alpha',
        lane: 'evidence-needed',
        unresolvedHardEvaluations: evaluations,
      },
    ];
  const targetFitAssessment = cloneValue(createGroundedExchange().response);
  const firstHardConstraint = request.capabilityRequest.hardConstraints[0];
  const betaConflict =
    targetFitAssessment.fitAssessment.hardConstraintConflicts[0];
  const betaReason =
    targetFitAssessment.fitAssessment.candidateAssessments[1]?.reasons[0];
  if (
    firstHardConstraint === undefined ||
    betaConflict === undefined ||
    betaReason === undefined
  ) {
    throw new Error('Hard-resolution target-fit fixture is incomplete.');
  }
  betaConflict.constraintId = firstHardConstraint.constraintId;
  betaConflict.reasonCode = firstHardConstraint.reasonCode;
  betaReason.reasonCode = firstHardConstraint.reasonCode;
  const response: MutableValue<RecommendationAssessmentResponseV1> = {
    contractVersion: '1.0.0',
    targetFitAssessment,
    evidenceNeededHardConstraintResolutions: evaluations.map((evaluation) => ({
      candidateId: 'candidate-alpha',
      evaluationId: evaluation.evaluationId,
      state: 'satisfied',
      inferenceIds: ['inference-alpha'],
    })),
  };
  return { request, normalization, retrievalFinalists, response };
}

async function normalizeHardResolutionQuery(
  request: OssRecommendationRequestV1,
) {
  const normalized = normalizeCapabilityQueryV1(
    request.capabilityQuery,
    cloneValue(await taxonomyFixture),
  );
  if (!normalized.ok || normalized.value.outcome !== 'normalized') {
    throw new Error('Hard-resolution test query must normalize.');
  }
  return normalized.value;
}

function sourceConstraintIdForResolution(
  exchange: HardResolutionExchange,
  evaluationId: string,
): string {
  const source = exchange.normalization.normalizedConstraints.find(
    ({ normalizedConstraintId }) => normalizedConstraintId === evaluationId,
  )?.sourceConstraintIds[0];
  if (source === undefined)
    throw new Error('Resolution source is unavailable.');
  return source;
}

function compactModelResponse(
  request: FitAssessmentRequestV1,
  response: RecommendationAssessmentResponseV1,
): MutableValue<RecommendationAssessmentModelResponseV1> {
  const fit = response.targetFitAssessment.fitAssessment;
  const evidenceTokens = new Map<string, string>();
  const limitationTokens = new Map<string, string>();
  const candidateUnknownTokens = new Map<string, string>();
  for (const candidate of request.candidates) {
    for (const evidence of candidate.observations) {
      evidenceTokens.set(
        evidence.evidenceId,
        `e${String(evidenceTokens.size + 1)}`,
      );
    }
  }
  for (const candidate of request.candidates) {
    for (const limitation of candidate.limitations) {
      limitationTokens.set(
        limitation.limitationId,
        `l${String(limitationTokens.size + 1)}`,
      );
    }
  }
  for (const candidate of request.candidates) {
    for (const unknown of candidate.unknowns) {
      candidateUnknownTokens.set(
        unknown.unknownId,
        `u${String(candidateUnknownTokens.size + 1)}`,
      );
    }
  }
  const inferenceTokens = new Map(
    fit.inferences.map(({ inferenceId }, index) => [
      inferenceId,
      `i${String(index + 1)}`,
    ]),
  );
  const claimTokens = new Map(
    fit.materialClaims.map(({ claimId }, index) => [
      claimId,
      `c${String(index + 1)}`,
    ]),
  );
  const assessmentUnknownTokens = new Map(
    fit.materialUnknowns
      .filter((unknown) => unknown.scope === 'assessment')
      .map(({ unknownId }, index) => [unknownId, `a${String(index + 1)}`]),
  );
  const conflictTokens = new Map(
    fit.hardConstraintConflicts.map(({ conflictId }, index) => [
      conflictId,
      `x${String(index + 1)}`,
    ]),
  );
  const token = (catalog: ReadonlyMap<string, string>, id: string): string => {
    const mapped = catalog.get(id);
    if (mapped === undefined) throw new Error('Compact fixture is incomplete.');
    return mapped;
  };
  const unknownToken = (id: string): string =>
    candidateUnknownTokens.get(id) ?? token(assessmentUnknownTokens, id);
  return cloneValue({
    targetFitAssessment: {
      fitAssessment: {
        outcome: fit.outcome,
        candidateAssessments: fit.candidateAssessments.map((assessment) => ({
          ...assessment,
          reasons: assessment.reasons.map((reason) => ({
            ...reason,
            evidenceIds: reason.evidenceIds.map((id) =>
              token(evidenceTokens, id),
            ),
            inferenceIds: reason.inferenceIds.map((id) =>
              token(inferenceTokens, id),
            ),
            unknownIds: reason.unknownIds.map(unknownToken),
          })),
          evidenceIds: assessment.evidenceIds.map((id) =>
            token(evidenceTokens, id),
          ),
          inferenceIds: assessment.inferenceIds.map((id) =>
            token(inferenceTokens, id),
          ),
          claimIds: assessment.claimIds.map((id) => token(claimTokens, id)),
          unknownIds: assessment.unknownIds.map(unknownToken),
          hardConstraintConflictIds: assessment.hardConstraintConflictIds.map(
            (id) => token(conflictTokens, id),
          ),
          limitationIds: assessment.limitationIds.map((id) =>
            token(limitationTokens, id),
          ),
        })),
        inferences: fit.inferences.map((inference) => ({
          ...inference,
          inferenceId: token(inferenceTokens, inference.inferenceId),
          evidenceIds: inference.evidenceIds.map((id) =>
            token(evidenceTokens, id),
          ),
        })),
        materialClaims: fit.materialClaims.map((claim) => ({
          ...claim,
          claimId: token(claimTokens, claim.claimId),
          evidenceIds: claim.evidenceIds.map((id) => token(evidenceTokens, id)),
          inferenceIds: claim.inferenceIds.map((id) =>
            token(inferenceTokens, id),
          ),
        })),
        assessmentUnknowns: fit.materialUnknowns
          .filter((unknown) => unknown.scope === 'assessment')
          .map((unknown) => ({
            ...unknown,
            unknownId: token(assessmentUnknownTokens, unknown.unknownId),
            evidenceIds: unknown.evidenceIds.map((id) =>
              token(evidenceTokens, id),
            ),
          })),
        hardConstraintConflicts: fit.hardConstraintConflicts.map(
          (conflict) => ({
            ...conflict,
            conflictId: token(conflictTokens, conflict.conflictId),
            evidenceIds: conflict.evidenceIds.map((id) =>
              token(evidenceTokens, id),
            ),
          }),
        ),
        rankGroups: fit.rankGroups,
        rankRelations: fit.rankRelations,
        incomparablePairs: fit.incomparablePairs,
        assessmentProcessing: fit.assessmentProcessing,
      },
      inferenceRepositoryFactBindings:
        response.targetFitAssessment.inferenceRepositoryFactBindings.map(
          (binding) => ({
            ...binding,
            inferenceId: token(inferenceTokens, binding.inferenceId),
          }),
        ),
    },
    evidenceNeededHardConstraintResolutions:
      response.evidenceNeededHardConstraintResolutions.map((resolution) => ({
        ...resolution,
        inferenceIds: resolution.inferenceIds.map((id) =>
          token(inferenceTokens, id),
        ),
      })),
  });
}

function createRecommendationRequest(
  input: {
    readonly draftConstraints?: CapabilityQueryInputV1['draftConstraints'];
  } = {},
): OssRecommendationRequestV1 {
  const fingerprint = createRepositoryFingerprint();
  const approval = createCapabilityRequest().transmissionApproval;
  return {
    contractVersion: '1.0.0',
    recommendationRequestId: 'recommendation-alpha',
    capabilityQuery: {
      contractVersion: '1.0.0',
      queryInputId: 'query-recommendation-alpha',
      scope: 'local-pre-approval',
      summary: 'Select an authorization capability for this repository.',
      capabilityTerms: [
        { termId: 'term-authorization', originalTerm: 'authorization' },
      ],
      successConditions: [
        {
          conditionId: 'condition-policy',
          statement: 'The result can enforce repository authorization policy.',
        },
      ],
      draftConstraints: [...(input.draftConstraints ?? [])],
      candidateReferences: [],
      repositoryFingerprintReference: {
        fingerprintId: fingerprint.fingerprintId,
        fingerprintDigest: repositoryFingerprintDigestV1(fingerprint),
      },
    },
    repositoryFingerprint: fingerprint,
    transmissionApproval: approval,
  };
}

function createGroundedExchange(): {
  readonly request: ReturnType<typeof createFitAssessmentRequest>;
  readonly response: TargetFitAssessmentResponseV1;
} {
  const request = createFitAssessmentRequest();
  const fitAssessment = createFitAssessmentResponse();
  fitAssessment.inferences = [
    {
      kind: 'inference',
      inferenceId: 'inference-alpha',
      candidateId: 'candidate-alpha',
      topic: 'runtime-support',
      statement:
        'Candidate runtime support matches the supplied target runtime.',
      rationale: 'Candidate evidence and the supplied runtime fact align.',
      evidenceIds: ['evidence-alpha'],
    },
  ];
  fitAssessment.candidateAssessments[0]!.inferenceIds = ['inference-alpha'];
  fitAssessment.candidateAssessments[0]!.reasons[0]!.inferenceIds = [
    'inference-alpha',
  ];
  fitAssessment.materialClaims[0]!.inferenceIds = ['inference-alpha'];
  return {
    request,
    response: {
      contractVersion: '1.0.0',
      fitAssessment,
      inferenceRepositoryFactBindings: [
        {
          inferenceId: 'inference-alpha',
          repositoryFactIds: ['fact-runtime'],
        },
      ],
    },
  };
}
