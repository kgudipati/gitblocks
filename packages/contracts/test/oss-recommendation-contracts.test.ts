import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import {
  createCapabilityRequestFromRecommendationV1,
  getContractSchemaV1,
  normalizeCapabilityQueryV1,
  parseOssRecommendationRequestV1,
  parseTargetFitAssessmentResponseV1,
  repositoryFingerprintDigestV1,
  validateTargetFitAssessmentExchangeV1,
  type CapabilityQueryInputV1,
  type CapabilityTaxonomyV1,
  type OssRecommendationRequestV1,
  type TargetFitAssessmentResponseV1,
} from '../src/index.ts';
import {
  cloneValue,
  createCapabilityRequest,
  createFitAssessmentRequest,
  createFitAssessmentResponse,
  createRepositoryFingerprint,
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

  it('retains the existing fit exchange evidence-preservation authority', () => {
    const { request, response } = createGroundedExchange();
    const droppedEvidence = cloneValue(response);
    droppedEvidence.fitAssessment.evidence =
      droppedEvidence.fitAssessment.evidence.slice(0, 1);
    expect(
      validateTargetFitAssessmentExchangeV1(request, droppedEvidence),
    ).toMatchObject({ ok: false });

    const inventedEvidence = cloneValue(response);
    inventedEvidence.fitAssessment.evidence[0]!.observation =
      'Invented replacement evidence.';
    expect(
      validateTargetFitAssessmentExchangeV1(request, inventedEvidence),
    ).toMatchObject({ ok: false });
  });
});

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
