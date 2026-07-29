import { describe, expect, it } from 'vitest';

import {
  MAX_INPUT_DEPTH,
  MAX_INPUT_NODES,
  MAX_INPUT_STRING_CODE_UNITS,
  MAX_INPUT_TOTAL_STRING_CODE_UNITS,
  MAX_OBJECT_PROPERTIES,
  parseCandidateDossierV1,
  parseCapabilityRequestV1,
  parseErrorEnvelopeV1,
  parseFitAssessmentRequestV1,
  parseFitAssessmentResponseV1,
  parseRepositoryFingerprintV1,
  validateFitAssessmentExchangeV1,
  type CandidateDossierV1,
  type FitAssessmentResponseV1,
} from '../src/index.ts';
import {
  EVIDENCE_CUTOFF,
  PRODUCED_AT,
  createCandidateDossier,
  createCapabilityRequest,
  createErrorEnvelope,
  createEvidence,
  createFitAssessmentRequest,
  createRepositoryFingerprint,
  type MutableValue,
} from './fixtures.ts';

describe('valid minimum forms', () => {
  it('accepts the minimum capability request', () => {
    const request = createCapabilityRequest();
    request.hardConstraints = [];
    request.preferences = [];
    request.transmissionApproval.approvedCategories = [
      'repository-fingerprint',
    ];

    expect(parseCapabilityRequestV1(request).ok).toBe(true);
  });

  it('accepts the minimum repository fingerprint', () => {
    const fingerprint = createRepositoryFingerprint();
    fingerprint.facts = [];
    fingerprint.withheldCategories = [];

    expect(parseRepositoryFingerprintV1(fingerprint).ok).toBe(true);
  });

  it('accepts a dossier with every unobserved dimension absent', () => {
    const dossier = createCandidateDossier('candidate-alpha');
    dossier.versionScope = null;
    dossier.observations = [];
    dossier.limitations = [];
    dossier.unknowns = [];

    expect(parseCandidateDossierV1(dossier).ok).toBe(true);
  });

  it('accepts a one-candidate fit-assessment request', () => {
    const request = createFitAssessmentRequest();
    request.candidates = [request.candidates[0]!];
    request.requestedMaximumResults = 1;

    expect(parseFitAssessmentRequestV1(request).ok).toBe(true);
  });

  it('accepts a one-candidate insufficient-evidence response', () => {
    const response: MutableValue<FitAssessmentResponseV1> = {
      contractVersion: '1.0.0',
      assessmentId: 'assessment-minimum',
      assessmentRequestId: 'assessment-request-minimum',
      correlationId: 'correlation-minimum',
      outcome: 'insufficient-evidence',
      suppliedCandidateIds: ['candidate-alpha'],
      candidateAssessments: [
        {
          candidateId: 'candidate-alpha',
          disposition: 'insufficient-evidence',
          reasons: [
            {
              candidateId: 'candidate-alpha',
              reasonCode: 'evidence-insufficient',
              statement: 'No bounded evidence establishes fit.',
              evidenceIds: [],
              inferenceIds: [],
              unknownIds: [],
            },
          ],
          evidenceIds: [],
          inferenceIds: [],
          claimIds: [],
          unknownIds: [],
          hardConstraintConflictIds: [],
        },
      ],
      evidence: [],
      inferences: [],
      materialClaims: [],
      materialUnknowns: [],
      hardConstraintConflicts: [],
      rankGroups: [],
      rankRelations: [],
      incomparablePairs: [],
      evidenceCutoff: EVIDENCE_CUTOFF,
      producedAt: PRODUCED_AT,
      completeness: 'partial-evidence',
    };

    expect(parseFitAssessmentResponseV1(response).ok).toBe(true);
  });

  it('accepts a neutral error with no field issues or correlation ID', () => {
    const envelope = createErrorEnvelope();
    envelope.issues = [];
    delete envelope.correlationId;

    expect(parseErrorEnvelopeV1(envelope).ok).toBe(true);
  });
});

describe('valid maximum forms', () => {
  it('accepts maximum capability-request collections', () => {
    const request = createCapabilityRequest();
    request.successConditions = Array.from({ length: 20 }, (_, index) => ({
      conditionId: numberedId('success', index),
      statement: `Success condition ${String(index + 1)}.`,
    }));
    request.hardConstraints = Array.from({ length: 20 }, (_, index) => ({
      constraintId: numberedId('constraint', index),
      reasonCode: numberedId('constraint-reason', index),
      statement: `Hard constraint ${String(index + 1)}.`,
    }));
    request.preferences = Array.from({ length: 20 }, (_, index) => ({
      preferenceId: numberedId('preference', index),
      statement: `Preference ${String(index + 1)}.`,
    }));

    expect(parseCapabilityRequestV1(request).ok).toBe(true);
  });

  it('accepts 200 unique minimized facts and every withheld category', () => {
    const fingerprint = createRepositoryFingerprint();
    const provenance = fingerprint.facts[0]!.provenance;
    fingerprint.facts = Array.from({ length: 200 }, (_, index) => ({
      kind: 'component',
      factId: numberedId('fact', index),
      component: 'dependency',
      name: numberedId('dependency', index),
      version: `1.0.${String(index)}`,
      provenance: { ...provenance },
    }));
    fingerprint.withheldCategories = [
      'command-output',
      'configuration-values',
      'credentials',
      'data-facts',
      'database-content',
      'dependency-facts',
      'environment',
      'identity-facts',
      'logs',
      'operational-facts',
      'raw-source',
      'untracked-files',
    ];

    expect(parseRepositoryFingerprintV1(fingerprint).ok).toBe(true);
  });

  it('accepts maximum dossier evidence, limitations, and unknowns', () => {
    const dossier = createCandidateDossier('candidate-alpha');
    dossier.observations = Array.from({ length: 100 }, (_, index) => ({
      ...createEvidence('candidate-alpha'),
      evidenceId: numberedId('evidence', index),
      topic: numberedId('topic', index),
      source: {
        ...createEvidence('candidate-alpha').source,
        revision: {
          ...createEvidence('candidate-alpha').source.revision,
          value: numberedId('revision', index),
        },
      },
    }));
    dossier.limitations = Array.from({ length: 40 }, (_, index) => ({
      limitationId: numberedId('limitation', index),
      candidateId: 'candidate-alpha',
      statement: `Bounded limitation ${String(index + 1)}.`,
      evidenceIds: [numberedId('evidence', index)],
    }));
    dossier.unknowns = Array.from({ length: 40 }, (_, index) => ({
      scope: 'candidate',
      unknownId: numberedId('unknown', index),
      candidateId: 'candidate-alpha',
      topic: numberedId('unknown-topic', index),
      statement: `Material unknown ${String(index + 1)}.`,
      evidenceIds: [],
    }));

    expect(parseCandidateDossierV1(dossier).ok).toBe(true);
  });

  it('accepts the maximum supplied candidate set', () => {
    const request = createFitAssessmentRequest();
    request.candidates = Array.from({ length: 20 }, (_, index) =>
      minimalCandidate(numberedId('candidate', index)),
    );
    request.requestedMaximumResults = 20;

    expect(parseFitAssessmentRequestV1(request).ok).toBe(true);
  });

  it('represents and preserves 40 unknowns for each of 20 candidates', () => {
    const request = createFitAssessmentRequest();
    request.candidates = Array.from({ length: 20 }, (_, candidateIndex) => {
      const candidate = minimalCandidate(
        numberedId('candidate', candidateIndex),
      );
      candidate.unknowns = Array.from({ length: 40 }, (_, unknownIndex) => ({
        scope: 'candidate',
        unknownId: `unknown-${String(candidateIndex + 1).padStart(2, '0')}-${String(unknownIndex + 1).padStart(2, '0')}`,
        candidateId: candidate.identity.candidateId,
        topic: numberedId('unknown-topic', unknownIndex),
        statement: `Material unknown ${String(unknownIndex + 1)}.`,
        evidenceIds: [],
      }));
      return candidate;
    });
    request.requestedMaximumResults = 20;

    const response = maximumCandidateResponse();
    response.assessmentRequestId = request.assessmentRequestId;
    response.correlationId = request.correlationId;
    response.evidenceCutoff = request.evidenceCutoff;
    response.outcome = 'insufficient-evidence';
    response.evidence = [];
    response.materialClaims = [];
    response.rankGroups = [];
    response.materialUnknowns = request.candidates.flatMap(
      (candidate) => candidate.unknowns,
    );
    for (const [index, assessment] of response.candidateAssessments.entries()) {
      assessment.disposition = 'insufficient-evidence';
      assessment.evidenceIds = [];
      assessment.claimIds = [];
      assessment.unknownIds = request.candidates[index]!.unknowns.map(
        (unknown) => unknown.unknownId,
      );
      assessment.reasons = [
        {
          candidateId: assessment.candidateId,
          reasonCode: 'evidence-insufficient',
          statement: 'Material unknowns prevent a supported disposition.',
          evidenceIds: [],
          inferenceIds: [],
          unknownIds: assessment.unknownIds.slice(0, 20),
        },
      ];
    }

    expect(response.materialUnknowns).toHaveLength(800);
    expect(validateFitAssessmentExchangeV1(request, response).ok).toBe(true);
  });

  it('accepts all 190 acyclic explicit relations over 20 viable candidates', () => {
    const response = maximumCandidateResponse();
    response.rankGroups = [];
    response.rankRelations = allCandidatePairs().map(([higher, lower]) => ({
      higherCandidateId: higher,
      lowerCandidateId: lower,
    }));

    expect(response.rankRelations).toHaveLength(190);
    expect(parseFitAssessmentResponseV1(response).ok).toBe(true);
  });

  it('accepts all 190 incomparable pairs over 20 viable candidates', () => {
    const response = maximumCandidateResponse();
    response.rankGroups = [];
    response.incomparablePairs = allCandidatePairs().map(([left, right]) => ({
      leftCandidateId: left,
      rightCandidateId: right,
    }));

    expect(response.incomparablePairs).toHaveLength(190);
    expect(parseFitAssessmentResponseV1(response).ok).toBe(true);
  });

  it('accepts the maximum safe error issue collection', () => {
    const envelope = createErrorEnvelope();
    const paths = [
      'assessment',
      'assessment-id',
      'assessment-request-id',
      'candidate-assessments',
      'candidate-dossiers',
      'candidate-identity',
      'capability-family',
      'completeness',
      'contract',
      'contract-version',
      'correlation-id',
      'evidence',
      'evidence-cutoff',
      'hard-constraint-conflicts',
      'hard-constraints',
      'inferences',
      'limitations',
      'material-claims',
      'material-unknowns',
      'observations',
    ] as const;
    envelope.issues = paths.map((path) => ({
      code: 'field.invalid',
      path,
    }));

    expect(parseErrorEnvelopeV1(envelope).ok).toBe(true);
  });

  it('accepts a response with every bounded catalog and reference collection at its composable maximum', () => {
    const response = composedMaximumResponse();

    expect(response.evidence).toHaveLength(2_000);
    expect(response.inferences).toHaveLength(400);
    expect(response.materialClaims).toHaveLength(800);
    expect(response.materialUnknowns).toHaveLength(800);
    expect(response.hardConstraintConflicts).toHaveLength(400);
    expect(parseFitAssessmentResponseV1(response).ok).toBe(true);
  }, 30_000);
});

describe('resource and text bounds', () => {
  it('rejects control characters in human-supplied text', () => {
    const request = createCapabilityRequest();
    request.summary = 'Unsafe terminal text\u001b[31m';

    expect(parseCapabilityRequestV1(request)).toMatchObject({
      ok: false,
      issues: [{ code: 'contract.pattern' }],
    });
  });

  it('rejects bidirectional control characters in human-supplied text', () => {
    const request = createCapabilityRequest();
    request.summary = 'Misleading text\u202etxt.exe';

    expect(parseCapabilityRequestV1(request)).toMatchObject({
      ok: false,
      issues: [{ code: 'contract.pattern' }],
    });
  });

  it('rejects out-of-range timestamp components', () => {
    const request = createCapabilityRequest();
    request.transmissionApproval.approvedAt = '2026-99-99T99:99:99Z';

    expect(parseCapabilityRequestV1(request)).toMatchObject({
      ok: false,
      issues: [{ code: 'contract.pattern' }],
    });
  });

  it('rejects calendar-impossible timestamps after structural matching', () => {
    const request = createCapabilityRequest();
    request.transmissionApproval.approvedAt = '2026-02-31T00:00:00Z';

    expect(parseCapabilityRequestV1(request)).toMatchObject({
      ok: false,
      issues: [{ code: 'domain.timestamp.invalid' }],
    });
  });

  it('rejects evidence collected or assessed after its request cutoff', () => {
    const request = createFitAssessmentRequest();
    request.candidates[0]!.observations[0]!.source.collectedAt =
      '2026-07-28T22:00:00Z';
    request.candidates[0]!.observations[0]!.freshness.asOf =
      '2026-07-28T22:00:00Z';

    expect(parseFitAssessmentRequestV1(request)).toMatchObject({
      ok: false,
      issues: [{ code: 'domain.request.evidence-cutoff' }],
    });
  });

  it('rejects repository facts observed after the assessment cutoff', () => {
    const request = createFitAssessmentRequest();
    request.repositoryFingerprint.facts[0]!.provenance.observedAt =
      '2026-07-28T22:00:00Z';

    expect(parseFitAssessmentRequestV1(request)).toMatchObject({
      ok: false,
      issues: [{ code: 'domain.request.evidence-cutoff' }],
    });
  });

  it('rejects publication after collection and production before cutoff', () => {
    const dossier = createCandidateDossier('candidate-alpha');
    dossier.observations[0]!.source.publishedAt = '2026-07-28T20:45:00Z';
    expect(parseCandidateDossierV1(dossier)).toMatchObject({
      ok: false,
      issues: [{ code: 'domain.evidence.temporal-order' }],
    });

    const response = maximumCandidateResponse();
    response.producedAt = '2026-07-28T20:00:00Z';
    expect(parseFitAssessmentResponseV1(response)).toMatchObject({
      ok: false,
      issues: [{ code: 'domain.result.temporal-order' }],
    });
  });

  it.each([
    'https://credential@example.com/repository',
    'https://example.com/repository?access_token=private-sentinel',
  ])('rejects potentially secret-bearing evidence URL forms', (sourceUrl) => {
    const dossier = createCandidateDossier('candidate-alpha');
    dossier.observations[0]!.source.sourceUrl = sourceUrl;

    const result = parseCandidateDossierV1(dossier);

    expect(result).toMatchObject({
      ok: false,
      issues: [{ code: 'contract.pattern' }],
    });
    expect(JSON.stringify(result.issues)).not.toContain('private-sentinel');
    expect(JSON.stringify(result.issues)).not.toContain('credential');
  });

  it('rejects an oversized string', () => {
    const request = createCapabilityRequest();
    request.summary = 'x'.repeat(2_001);

    expect(parseCapabilityRequestV1(request)).toMatchObject({
      ok: false,
      issues: [{ code: 'contract.bounds' }],
    });
  });

  it('rejects a multi-megabyte scalar before validator pattern work', () => {
    const value = 'x'.repeat(4_000_000);

    const result = parseCapabilityRequestV1(value);

    expect(result).toMatchObject({
      ok: false,
      issues: [{ code: 'contract.input-complexity' }],
    });
    expect(JSON.stringify(result.issues)).not.toContain(value.slice(-128));
  });

  it('rejects an aggregate string-work flood below the node budget', () => {
    const maximumWidthString = '\u{1f642}'.repeat(
      MAX_INPUT_STRING_CODE_UNITS / 2,
    );
    const stringCount =
      Math.floor(
        MAX_INPUT_TOTAL_STRING_CODE_UNITS / maximumWidthString.length,
      ) + 1;
    const value = Array.from(
      { length: Math.ceil(stringCount / 2_000) },
      (_, chunkIndex) =>
        Array.from(
          {
            length: Math.min(2_000, stringCount - chunkIndex * 2_000),
          },
          () => maximumWidthString,
        ),
    );

    expect(parseCapabilityRequestV1(value)).toMatchObject({
      ok: false,
      issues: [{ code: 'contract.input-complexity' }],
    });
  });

  it('rejects a multi-megabyte unknown property name without echoing it', () => {
    const hiddenKey = 'x'.repeat(4_000_000);
    const value = { [hiddenKey]: null };

    const result = parseCapabilityRequestV1(value);

    expect(result).toMatchObject({
      ok: false,
      issues: [{ code: 'contract.input-complexity' }],
    });
    expect(JSON.stringify(result.issues)).not.toContain(hiddenKey.slice(-128));
  });

  it('counts aggregate property-name work below the node budget', () => {
    const keyPrefix = 'k'.repeat(MAX_INPUT_STRING_CODE_UNITS - 6);
    const keys = Array.from(
      { length: MAX_OBJECT_PROPERTIES },
      (_, index) => `${keyPrefix}${String(index).padStart(6, '0')}`,
    );
    const keyCount =
      Math.floor(
        MAX_INPUT_TOTAL_STRING_CODE_UNITS / MAX_INPUT_STRING_CODE_UNITS,
      ) + 1;
    const value = Array.from(
      { length: Math.ceil(keyCount / keys.length) },
      (_, objectIndex) =>
        Object.fromEntries(
          keys
            .slice(
              0,
              Math.min(keys.length, keyCount - objectIndex * keys.length),
            )
            .map((key) => [key, null]),
        ),
    );

    expect(parseCapabilityRequestV1(value)).toMatchObject({
      ok: false,
      issues: [{ code: 'contract.input-complexity' }],
    });
  });

  it('rejects an oversized contract array', () => {
    const request = createCapabilityRequest();
    request.successConditions = Array.from({ length: 21 }, (_, index) => ({
      conditionId: numberedId('success', index),
      statement: `Success condition ${String(index + 1)}.`,
    }));

    expect(parseCapabilityRequestV1(request)).toMatchObject({
      ok: false,
      issues: [{ code: 'contract.bounds' }],
    });
  });

  it('rejects nesting beyond the object-value boundary', () => {
    let nested: unknown = 'leaf';
    for (let index = 0; index <= MAX_INPUT_DEPTH; index += 1) {
      nested = { child: nested };
    }

    expect(
      parseCapabilityRequestV1({
        ...createCapabilityRequest(),
        hidden: nested,
      }),
    ).toMatchObject({
      ok: false,
      issues: [{ code: 'contract.input-depth' }],
    });
  });

  it('rejects graph node floods composed from individually bounded arrays', () => {
    const chunkSize = 2_000;
    const value = Array.from(
      { length: Math.floor(MAX_INPUT_NODES / chunkSize) + 1 },
      () => Array.from({ length: chunkSize }, () => null),
    );

    expect(parseCapabilityRequestV1(value)).toMatchObject({
      ok: false,
      issues: [{ code: 'contract.input-complexity' }],
    });
  });

  it('rejects array breadth before queueing an unbounded traversal', () => {
    const value = Array.from({ length: 2_001 }, () => null);

    expect(parseCapabilityRequestV1(value)).toMatchObject({
      ok: false,
      issues: [{ code: 'contract.input-complexity' }],
    });
  });

  it('rejects per-object property floods', () => {
    const value = Object.fromEntries(
      Array.from({ length: MAX_OBJECT_PROPERTIES + 1 }, (_, index) => [
        `field-${String(index)}`,
        null,
      ]),
    );

    expect(parseCapabilityRequestV1(value)).toMatchObject({
      ok: false,
      issues: [{ code: 'contract.input-complexity' }],
    });
  });

  it.each([new Date(), new Map(), Object.create({ inherited: true })])(
    'rejects non-JSON object forms',
    (value) => {
      expect(parseCapabilityRequestV1(value)).toMatchObject({
        ok: false,
        issues: [{ code: 'contract.input-shape' }],
      });
    },
  );
});

function minimalCandidate(
  candidateId: string,
): MutableValue<CandidateDossierV1> {
  return {
    contractVersion: '1.0.0',
    identity: {
      candidateId,
      displayName: candidateId,
      repository: {
        host: 'github',
        owner: 'example',
        name: candidateId,
      },
      package: null,
    },
    capabilityFamily: 'authorization',
    versionScope: null,
    observations: [],
    limitations: [],
    unknowns: [],
  };
}

function maximumCandidateResponse(): MutableValue<FitAssessmentResponseV1> {
  const candidateIds = Array.from({ length: 20 }, (_, index) =>
    numberedId('candidate', index),
  );
  const evidence = candidateIds.map((candidateId, index) => {
    const observation = createEvidence('candidate-alpha');
    return {
      ...observation,
      evidenceId: numberedId('evidence', index),
      candidateId,
      topic: numberedId('viability', index),
      observation: 'Direct evidence supports candidate viability.',
    };
  });
  const materialClaims = candidateIds.map((candidateId, index) => ({
    claimId: numberedId('claim', index),
    candidateId,
    topic: numberedId('viability', index),
    direction: 'favorable' as const,
    statement: 'The attributable evidence supports candidate viability.',
    evidenceIds: [numberedId('evidence', index)],
    inferenceIds: [],
  }));
  return {
    contractVersion: '1.0.0',
    assessmentId: 'assessment-maximum',
    assessmentRequestId: 'assessment-request-maximum',
    correlationId: 'correlation-maximum',
    outcome: 'recommend',
    suppliedCandidateIds: candidateIds,
    candidateAssessments: candidateIds.map((candidateId, index) => ({
      candidateId,
      disposition: 'viable',
      reasons: [
        {
          candidateId,
          reasonCode: 'candidate-viable',
          statement: 'The supplied candidate is viable.',
          evidenceIds: [numberedId('evidence', index)],
          inferenceIds: [],
          unknownIds: [],
        },
      ],
      evidenceIds: [numberedId('evidence', index)],
      inferenceIds: [],
      claimIds: [numberedId('claim', index)],
      unknownIds: [],
      hardConstraintConflictIds: [],
    })),
    evidence,
    inferences: [],
    materialClaims,
    materialUnknowns: [],
    hardConstraintConflicts: [],
    rankGroups: [{ candidateIds }],
    rankRelations: [],
    incomparablePairs: [],
    evidenceCutoff: EVIDENCE_CUTOFF,
    producedAt: PRODUCED_AT,
    completeness: 'partial-evidence',
  };
}

function composedMaximumResponse(): MutableValue<FitAssessmentResponseV1> {
  const candidateIds = Array.from({ length: 20 }, (_, index) =>
    numberedId('candidate', index),
  );
  const response = maximumCandidateResponse();
  response.outcome = 'no-viable-candidate';
  response.rankGroups = [];
  response.evidence = [];
  response.inferences = [];
  response.materialClaims = [];
  response.materialUnknowns = [];
  response.hardConstraintConflicts = [];
  response.candidateAssessments = [];

  for (const [candidateIndex, candidateId] of candidateIds.entries()) {
    const suffix = String(candidateIndex + 1).padStart(2, '0');
    const evidenceIds = Array.from({ length: 100 }, (_, index) =>
      numberedId(`evidence-${suffix}`, index),
    );
    const inferenceIds = Array.from({ length: 20 }, (_, index) =>
      numberedId(`inference-${suffix}`, index),
    );
    const claimIds = Array.from({ length: 40 }, (_, index) =>
      numberedId(`claim-${suffix}`, index),
    );
    const unknownIds = Array.from({ length: 40 }, (_, index) =>
      numberedId(`unknown-${suffix}`, index),
    );
    const conflictIds = Array.from({ length: 20 }, (_, index) =>
      numberedId(`conflict-${suffix}`, index),
    );
    const commonEvidenceIds = evidenceIds.slice(0, 20);

    response.evidence.push(
      ...evidenceIds.map((evidenceId, index) => {
        const observation = createEvidence('candidate-alpha');
        return {
          ...observation,
          evidenceId,
          candidateId,
          topic: numberedId('evidence-topic', index),
          observation: 'Direct bounded evidence for the supplied candidate.',
          source: {
            ...observation.source,
            revision: {
              ...observation.source.revision,
              value: numberedId(`revision-${suffix}`, index),
            },
          },
        };
      }),
    );
    response.inferences.push(
      ...inferenceIds.map((inferenceId, index) => ({
        kind: 'inference' as const,
        inferenceId,
        candidateId,
        topic: numberedId('inference-topic', index),
        statement: 'A bounded inference derived from attributable evidence.',
        rationale: 'The cited direct observations support this inference.',
        evidenceIds: commonEvidenceIds,
      })),
    );
    response.materialClaims.push(
      ...claimIds.map((claimId, index) => ({
        claimId,
        candidateId,
        topic: numberedId('claim-topic', index),
        direction: 'unfavorable' as const,
        statement: 'The attributable evidence supports this material claim.',
        evidenceIds: commonEvidenceIds,
        inferenceIds,
      })),
    );
    response.materialUnknowns.push(
      ...unknownIds.map((unknownId, index) => ({
        scope: 'candidate' as const,
        unknownId,
        candidateId,
        topic: numberedId('unknown-topic', index),
        statement: 'This material topic remains explicitly unknown.',
        evidenceIds: commonEvidenceIds,
      })),
    );
    response.hardConstraintConflicts.push(
      ...conflictIds.map((conflictId, index) => ({
        conflictId,
        candidateId,
        constraintId: numberedId('constraint', index),
        reasonCode: numberedId('hard-reason', index),
        evidenceIds: commonEvidenceIds,
      })),
    );
    response.candidateAssessments.push({
      candidateId,
      disposition: 'rejected',
      reasons: conflictIds.map((_, index) => ({
        candidateId,
        reasonCode: numberedId('hard-reason', index),
        statement: 'The supplied candidate has a known hard conflict.',
        evidenceIds: commonEvidenceIds,
        inferenceIds,
        unknownIds: unknownIds.slice(0, 20),
      })),
      evidenceIds,
      inferenceIds,
      claimIds,
      unknownIds,
      hardConstraintConflictIds: conflictIds,
    });
  }

  return response;
}

function allCandidatePairs(): readonly (readonly [string, string])[] {
  const ids = Array.from({ length: 20 }, (_, index) =>
    numberedId('candidate', index),
  );
  return ids.flatMap((higher, higherIndex) =>
    ids.slice(higherIndex + 1).map((lower) => [higher, lower] as const),
  );
}

function numberedId(prefix: string, index: number): string {
  return `${prefix}-${String(index + 1).padStart(3, '0')}`;
}
