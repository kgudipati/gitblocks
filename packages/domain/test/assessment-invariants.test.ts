import { describe, expect, it } from 'vitest';

import {
  validateFitAssessmentExchange,
  validateFitAssessmentResult,
} from '../src/index.ts';
import {
  candidateId,
  createEvidence,
  createFitAssessmentRequest,
  createFitAssessmentResult,
  createUnknown,
  evidenceReference,
  stableId,
  topicId,
} from './fixtures.ts';

function codes(
  result:
    | { readonly ok: true }
    | {
        readonly ok: false;
        readonly issues: readonly { readonly code: string }[];
      },
): readonly string[] {
  return result.ok ? [] : result.issues.map((issue) => issue.code);
}

describe('fit assessment identity and reference integrity', () => {
  it('accepts and canonicalizes one assessment per supplied candidate', () => {
    const result = createFitAssessmentResult();
    const before = structuredClone(result);
    result.suppliedCandidateIds.reverse();
    result.assessments.reverse();
    result.evidence.reverse();
    result.claims.reverse();
    const atCall = structuredClone(result);

    const validation = validateFitAssessmentResult(result);

    expect(validation.ok).toBe(true);
    if (validation.ok) {
      expect(validation.value.suppliedCandidateIds).toEqual(['alpha', 'beta']);
      expect(
        validation.value.assessments.map(
          (assessment) => assessment.candidateId,
        ),
      ).toEqual(['alpha', 'beta']);
      expect(validation.value).not.toBe(result);
    }
    expect(result).not.toEqual(before);
    expect(result.suppliedCandidateIds).toEqual(['beta', 'alpha']);
    expect(result).toEqual(atCall);
  });

  it('rejects omitted, duplicate, and unknown candidate assessments', () => {
    const omitted = createFitAssessmentResult();
    omitted.assessments.pop();

    const duplicated = createFitAssessmentResult();
    duplicated.assessments[1] = { ...duplicated.assessments[0]! };

    const unknown = createFitAssessmentResult();
    unknown.assessments[1] = {
      ...unknown.assessments[1]!,
      candidateId: candidateId('gamma'),
    };

    expect(codes(validateFitAssessmentResult(omitted))).toContain(
      'reference.candidate-set',
    );
    expect(codes(validateFitAssessmentResult(duplicated))).toEqual(
      expect.arrayContaining([
        'reference.candidate-set',
        'reference.duplicate-id',
      ]),
    );
    expect(codes(validateFitAssessmentResult(unknown))).toEqual(
      expect.arrayContaining([
        'reference.candidate-set',
        'reference.unknown-candidate',
      ]),
    );
  });

  it.each([
    ['evidenceReferences', 'missing-evidence', 'reference.unknown-evidence'],
    ['inferenceIds', 'missing-inference', 'reference.unknown-inference'],
    ['unknownIds', 'missing-unknown', 'reference.unknown-unknown'],
    ['claimIds', 'missing-claim', 'reference.unknown-claim'],
    ['hardConflictIds', 'missing-conflict', 'reference.unknown-conflict'],
  ] as const)(
    'rejects unresolved assessment %s',
    (field, missingId, expectedCode) => {
      const result = createFitAssessmentResult();
      const assessment = result.assessments[0]!;
      if (field === 'evidenceReferences') {
        assessment.evidenceReferences = [evidenceReference('alpha', missingId)];
      } else if (field === 'inferenceIds') {
        assessment.inferenceIds = [stableId<'inference'>(missingId)];
      } else if (field === 'unknownIds') {
        assessment.unknownIds = [stableId<'unknown'>(missingId)];
      } else if (field === 'claimIds') {
        assessment.claimIds = [stableId<'claim'>(missingId)];
      } else {
        assessment.hardConflictIds = [stableId<'hard-conflict'>(missingId)];
      }

      expect(codes(validateFitAssessmentResult(result))).toContain(
        expectedCode,
      );
    },
  );

  it('keeps candidate reasons and direct evidence with their owner', () => {
    const result = createFitAssessmentResult();
    result.assessments[1]!.reasons = [
      {
        candidateId: candidateId('alpha'),
        reasonCode: stableId<'reason-code'>('maintenance-risk'),
        statement: 'Maintenance evidence is incomplete.',
        evidenceReferences: [],
        inferenceIds: [],
        unknownIds: [],
      },
    ];
    result.assessments[1]!.evidenceReferences = [
      evidenceReference('alpha', 'alpha-license'),
    ];

    expect(codes(validateFitAssessmentResult(result))).toContain(
      'reference.candidate-ownership',
    );
  });

  it('resolves evidence, inference, and unknown references carried by a candidate reason', () => {
    const result = createFitAssessmentResult();
    result.assessments[0]!.reasons = [
      {
        candidateId: candidateId('alpha'),
        reasonCode: stableId<'reason-code'>('integration-risk'),
        statement: 'The integration conclusion has unresolved support.',
        evidenceReferences: [evidenceReference('alpha', 'missing-evidence')],
        inferenceIds: [stableId<'inference'>('missing-inference')],
        unknownIds: [stableId<'unknown'>('missing-unknown')],
      },
    ];

    expect(codes(validateFitAssessmentResult(result))).toEqual(
      expect.arrayContaining([
        'reference.unknown-evidence',
        'reference.unknown-inference',
        'reference.unknown-unknown',
      ]),
    );
  });
});

describe('evidence, inference, claims, and unknowns', () => {
  it('requires inference support and keeps inference IDs distinct from evidence', () => {
    const result = createFitAssessmentResult();
    result.inferences.push({
      kind: 'inference',
      inferenceId: stableId<'inference'>('alpha-license'),
      candidateId: candidateId('alpha'),
      topic: topicId('license'),
      statement: 'The package is likely suitable.',
      rationale: 'Derived from the published license.',
      evidenceReferences: [],
    });
    result.assessments[0]!.inferenceIds = [
      stableId<'inference'>('alpha-license'),
    ];

    expect(codes(validateFitAssessmentResult(result))).toEqual(
      expect.arrayContaining([
        'evidence.inference-empty',
        'evidence.kind-conflict',
      ]),
    );
  });

  it('rejects an inference supported by another candidate evidence item', () => {
    const result = createFitAssessmentResult();
    result.inferences.push({
      kind: 'inference',
      inferenceId: stableId<'inference'>('beta-derived'),
      candidateId: candidateId('beta'),
      topic: topicId('license'),
      statement: 'Beta is likely permissively licensed.',
      rationale: 'Derived from evidence.',
      evidenceReferences: [evidenceReference('beta', 'alpha-license')],
    });
    result.assessments[1]!.inferenceIds = [
      stableId<'inference'>('beta-derived'),
    ];

    expect(codes(validateFitAssessmentResult(result))).toContain(
      'reference.candidate-ownership',
    );
  });

  it('requires every material claim to trace to evidence or inference', () => {
    const result = createFitAssessmentResult();
    result.claims[0] = {
      ...result.claims[0]!,
      evidenceReferences: [],
      inferenceIds: [],
    };

    expect(codes(validateFitAssessmentResult(result))).toContain(
      'claim.traceability',
    );
  });

  it('does not allow a preserved unknown to become a favorable claim', () => {
    const result = createFitAssessmentResult();
    result.unknowns.push(
      createUnknown('alpha', 'alpha-license-unknown', 'license'),
    );
    result.assessments[0]!.unknownIds = [
      stableId<'unknown'>('alpha-license-unknown'),
    ];

    expect(codes(validateFitAssessmentResult(result))).toContain(
      'claim.unresolved-unknown',
    );
  });

  it('does not turn an assessment-scoped unknown into a favorable claim', () => {
    const result = createFitAssessmentResult();
    result.unknowns.push({
      kind: 'material-unknown',
      scope: 'assessment',
      unknownId: stableId<'unknown'>('assessment-license-unknown'),
      topic: topicId('license'),
      statement: 'License interpretation remains unknown for the assessment.',
      evidenceReferences: [],
    });

    expect(codes(validateFitAssessmentResult(result))).toContain(
      'claim.unresolved-unknown',
    );
  });

  it('requires every owned inference, claim, unknown, and conflict to be exposed by its assessment', () => {
    const result = createFitAssessmentResult();
    result.assessments[1]!.unknownIds = [];

    expect(codes(validateFitAssessmentResult(result))).toContain(
      'reference.catalog-coverage',
    );
  });

  it('preserves an assessment-scoped unknown without assigning it to a candidate', () => {
    const result = createFitAssessmentResult();
    result.unknowns.push({
      kind: 'material-unknown',
      scope: 'assessment',
      unknownId: stableId<'unknown'>('global-consistency-tolerance'),
      topic: topicId('consistency-tolerance'),
      statement: 'The acceptable consistency tradeoff is not established.',
      evidenceReferences: [
        evidenceReference('alpha', 'alpha-license'),
        evidenceReference('beta', 'beta-license'),
      ],
    });

    expect(validateFitAssessmentResult(result).ok).toBe(true);
  });
});

describe('hard constraints and responsible outcomes', () => {
  it('rejects a positive disposition without an attributable favorable claim', () => {
    const result = createFitAssessmentResult();
    result.suppliedCandidateIds = [candidateId('alpha')];
    result.assessments = [result.assessments[0]!];
    result.assessments[0]!.evidenceReferences = [];
    result.assessments[0]!.claimIds = [];
    result.evidence = [];
    result.inferences = [];
    result.unknowns = [];
    result.claims = [];
    result.rankGroups = [{ candidateIds: [candidateId('alpha')] }];
    expect(codes(validateFitAssessmentResult(result))).toContain(
      'disposition.support',
    );
  });

  function addHardConflict(
    result: ReturnType<typeof createFitAssessmentResult>,
    disposition: 'recommended' | 'viable' | 'rejected',
  ): void {
    result.assessments[0]!.disposition = disposition;
    result.assessments[0]!.reasons = [
      {
        candidateId: candidateId('alpha'),
        reasonCode: stableId<'reason-code'>('license-required'),
        statement: 'The license violates the required policy.',
        evidenceReferences: [evidenceReference('alpha', 'alpha-license')],
        inferenceIds: [],
        unknownIds: [],
      },
    ];
    result.assessments[0]!.hardConflictIds = [
      stableId<'hard-conflict'>('alpha-license-conflict'),
    ];
    result.hardConstraintConflicts.push({
      hardConstraintConflictId: stableId<'hard-conflict'>(
        'alpha-license-conflict',
      ),
      candidateId: candidateId('alpha'),
      hardConstraintId: stableId<'hard-constraint'>('permissive-license'),
      reasonCode: stableId<'reason-code'>('license-required'),
      evidenceReferences: [evidenceReference('alpha', 'alpha-license')],
    });
  }

  it.each(['recommended', 'viable'] as const)(
    'rejects a hard-conflicting candidate marked %s',
    (disposition) => {
      const result = createFitAssessmentResult();
      addHardConflict(result, disposition);

      expect(codes(validateFitAssessmentResult(result))).toContain(
        'constraint.disposition',
      );
    },
  );

  it('preserves hard-conflict reason and evidence on the candidate assessment', () => {
    const result = createFitAssessmentResult();
    addHardConflict(result, 'rejected');
    result.assessments[0]!.reasons = [];
    result.assessments[0]!.evidenceReferences = [];

    expect(codes(validateFitAssessmentResult(result))).toContain(
      'constraint.preservation',
    );
  });

  it('rejects a hard conflict with no preserved evidence', () => {
    const result = createFitAssessmentResult();
    addHardConflict(result, 'rejected');
    result.hardConstraintConflicts[0]!.evidenceReferences = [];

    expect(codes(validateFitAssessmentResult(result))).toContain(
      'constraint.preservation',
    );
  });

  it('rejects a hard-conflicting candidate retained in any ranking form', () => {
    const result = createFitAssessmentResult();
    addHardConflict(result, 'rejected');
    result.outcome = 'insufficient-evidence';

    expect(codes(validateFitAssessmentResult(result))).toContain(
      'constraint.ranking',
    );
  });

  it.each([
    ['recommend', ['rejected', 'rejected'], false],
    ['recommend', ['recommended', 'rejected'], true],
    ['no-viable-candidate', ['rejected', 'rejected'], true],
    ['no-viable-candidate', ['rejected', 'insufficient-evidence'], false],
    ['insufficient-evidence', ['rejected', 'insufficient-evidence'], true],
    ['insufficient-evidence', ['viable', 'insufficient-evidence'], false],
    ['insufficient-evidence', ['rejected', 'rejected'], false],
  ] as const)(
    'validates %s against candidate dispositions',
    (outcome, dispositions, valid) => {
      const result = createFitAssessmentResult();
      result.outcome = outcome;
      result.assessments[0]!.disposition = dispositions[0];
      result.assessments[1]!.disposition = dispositions[1];
      result.rankGroups = [];
      if (valid) {
        expect(codes(validateFitAssessmentResult(result))).not.toContain(
          'outcome.disposition',
        );
      } else {
        expect(codes(validateFitAssessmentResult(result))).toContain(
          'outcome.disposition',
        );
      }
    },
  );

  it('checks every outcome against every two-candidate disposition pair', () => {
    const outcomes = [
      'recommend',
      'no-viable-candidate',
      'insufficient-evidence',
    ] as const;
    const dispositions = [
      'recommended',
      'viable',
      'rejected',
      'insufficient-evidence',
    ] as const;

    for (const outcome of outcomes) {
      for (const left of dispositions) {
        for (const right of dispositions) {
          const result = createFitAssessmentResult();
          result.outcome = outcome;
          result.assessments[0]!.disposition = left;
          result.assessments[1]!.disposition = right;
          result.rankGroups = [];
          const viableCount = [left, right].filter(
            (value) => value === 'recommended' || value === 'viable',
          ).length;
          const rejectedCount = [left, right].filter(
            (value) => value === 'rejected',
          ).length;
          const insufficientCount = [left, right].filter(
            (value) => value === 'insufficient-evidence',
          ).length;
          const expectedValid =
            outcome === 'recommend'
              ? viableCount > 0
              : outcome === 'no-viable-candidate'
                ? rejectedCount === 2
                : viableCount === 0 && insufficientCount > 0;

          expect(
            codes(validateFitAssessmentResult(result)).includes(
              'outcome.disposition',
            ),
            `${outcome}: ${left}/${right}`,
          ).toBe(!expectedValid);
        }
      }
    }
  });

  it('accepts complete processing while uncertainty remains material', () => {
    const result = createFitAssessmentResult();

    expect(codes(validateFitAssessmentResult(result))).not.toContain(
      'result.processing-state',
    );
  });

  it('requires disclosed uncertainty for an insufficient-evidence candidate', () => {
    const result = createFitAssessmentResult();
    result.outcome = 'insufficient-evidence';
    result.assessments[0]!.disposition = 'insufficient-evidence';
    result.assessments[1]!.disposition = 'rejected';
    result.assessments[0]!.unknownIds = [];
    result.rankGroups = [];

    expect(codes(validateFitAssessmentResult(result))).toContain(
      'disposition.uncertainty',
    );
  });

  it('rejects incomplete reason codes on a complete processing state', () => {
    const result = createFitAssessmentResult();
    result.assessmentProcessing = {
      state: 'complete',
      incompleteReasonCodes: [
        stableId<'assessment-processing-reason'>('upstream-source-unavailable'),
      ],
    };

    expect(codes(validateFitAssessmentResult(result))).toContain(
      'result.processing-state',
    );
  });

  it('bounds diagnostics before expanding an invalid ranking graph', () => {
    const result = createFitAssessmentResult();
    result.rankGroups = Array.from({ length: 20 }, (_, groupIndex) => ({
      candidateIds: Array.from({ length: 20 }, (_, candidateIndex) =>
        candidateId(
          `unknown-${String(groupIndex + 1)}-${String(candidateIndex + 1)}`,
        ),
      ),
    }));
    result.rankRelations = Array.from({ length: 190 }, (_, index) => ({
      higherCandidateId: candidateId(`relation-${String(index + 1)}-higher`),
      lowerCandidateId: candidateId(`relation-${String(index + 1)}-lower`),
    }));

    const validation = validateFitAssessmentResult(result);

    expect(validation.ok).toBe(false);
    if (!validation.ok) {
      expect(validation.issues.length).toBeLessThanOrEqual(100);
      expect(validation.issues.map((issue) => issue.code)).toContain(
        'ranking.candidate',
      );
    }
  });
});

describe('request/result consistency', () => {
  it('accepts a response for the exact supplied request candidates', () => {
    expect(
      validateFitAssessmentExchange(
        createFitAssessmentRequest(),
        createFitAssessmentResult(),
      ).ok,
    ).toBe(true);
  });

  it('accepts references to supplied evidence without a response echo', () => {
    const result = createFitAssessmentResult();
    result.evidence = [];

    expect(
      validateFitAssessmentExchange(createFitAssessmentRequest(), result),
    ).toMatchObject({ ok: true });
  });

  it('rejects an invented evidence reference when supplied evidence is not echoed', () => {
    const result = createFitAssessmentResult();
    result.evidence = [];
    result.claims[0]!.evidenceReferences = [
      evidenceReference('alpha', 'invented-evidence'),
    ];

    expect(
      codes(
        validateFitAssessmentExchange(createFitAssessmentRequest(), result),
      ),
    ).toContain('reference.unknown-evidence');
  });

  it('rejects a response for a different supplied candidate set', () => {
    const result = createFitAssessmentResult();
    result.suppliedCandidateIds[1] = candidateId('gamma');

    expect(
      codes(
        validateFitAssessmentExchange(createFitAssessmentRequest(), result),
      ),
    ).toContain('exchange.candidate-set');
  });

  it('rejects mismatched request linkage and correlation identifiers', () => {
    const result = createFitAssessmentResult();
    result.assessmentRequestId =
      stableId<'assessment-request'>('different-request');
    result.correlationId = 'different-trace';

    expect(
      codes(
        validateFitAssessmentExchange(createFitAssessmentRequest(), result),
      ),
    ).toContain('exchange.request-link');
  });

  it('rejects candidate evidence moved from its supplied dossier', () => {
    const result = createFitAssessmentResult();
    result.evidence[0] = {
      ...result.evidence[0]!,
      candidateId: candidateId('beta'),
    };
    result.assessments[0]!.evidenceReferences = [];
    result.assessments[1]!.evidenceReferences.push(
      evidenceReference('beta', 'alpha-license'),
    );
    result.claims[0] = {
      ...result.claims[0]!,
      candidateId: candidateId('beta'),
      evidenceReferences: [evidenceReference('beta', 'alpha-license')],
    };
    result.assessments[0]!.claimIds = [];
    result.assessments[1]!.claimIds.push(
      stableId<'claim'>('alpha-license-fit'),
    );

    expect(
      codes(
        validateFitAssessmentExchange(createFitAssessmentRequest(), result),
      ),
    ).toContain('exchange.evidence-ownership');
  });

  it('rejects altered supplied evidence with the same ID and owner', () => {
    const result = createFitAssessmentResult();
    result.evidence[0] = {
      ...result.evidence[0]!,
      observation: 'A materially different observation.',
    };

    expect(
      codes(
        validateFitAssessmentExchange(createFitAssessmentRequest(), result),
      ),
    ).toContain('exchange.evidence-preservation');
  });

  it('rejects a supplied material unknown omitted from the result', () => {
    const result = createFitAssessmentResult();
    result.unknowns = [];
    result.assessments[1]!.unknownIds = [];

    expect(
      codes(
        validateFitAssessmentExchange(createFitAssessmentRequest(), result),
      ),
    ).toContain('exchange.unknown-preservation');
  });

  it('rejects altered supplied unknown content and references', () => {
    const result = createFitAssessmentResult();
    result.unknowns[0] = {
      ...result.unknowns[0]!,
      statement: 'The unknown was silently rewritten.',
      evidenceReferences: [evidenceReference('beta', 'beta-license')],
    };

    expect(
      codes(
        validateFitAssessmentExchange(createFitAssessmentRequest(), result),
      ),
    ).toContain('exchange.unknown-preservation');
  });

  it('enforces the requested maximum across ranking forms', () => {
    const request = createFitAssessmentRequest();
    request.requestedMaximumResults = 1;

    expect(
      codes(
        validateFitAssessmentExchange(request, createFitAssessmentResult()),
      ),
    ).toContain('exchange.maximum-results');
  });

  it('resolves conflict constraints and stable reason codes against the request', () => {
    const result = createFitAssessmentResult();
    result.outcome = 'insufficient-evidence';
    result.assessments[0]!.disposition = 'rejected';
    result.assessments[0]!.reasons = [
      {
        candidateId: candidateId('alpha'),
        reasonCode: stableId<'reason-code'>('different-reason'),
        statement: 'A conflicting constraint applies.',
        evidenceReferences: [evidenceReference('alpha', 'alpha-license')],
        inferenceIds: [],
        unknownIds: [],
      },
    ];
    result.assessments[0]!.hardConflictIds = [
      stableId<'hard-conflict'>('unknown-constraint-conflict'),
    ];
    result.hardConstraintConflicts = [
      {
        hardConstraintConflictId: stableId<'hard-conflict'>(
          'unknown-constraint-conflict',
        ),
        candidateId: candidateId('alpha'),
        hardConstraintId: stableId<'hard-constraint'>('unknown-constraint'),
        reasonCode: stableId<'reason-code'>('different-reason'),
        evidenceReferences: [evidenceReference('alpha', 'alpha-license')],
      },
    ];
    result.rankGroups = [{ candidateIds: [candidateId('beta')] }];

    expect(
      codes(
        validateFitAssessmentExchange(createFitAssessmentRequest(), result),
      ),
    ).toContain('exchange.constraint-reference');
  });

  it('rejects response evidence not supplied in any dossier', () => {
    const result = createFitAssessmentResult();
    result.evidence.push(createEvidence('alpha', 'invented-evidence'));

    expect(
      codes(
        validateFitAssessmentExchange(createFitAssessmentRequest(), result),
      ),
    ).toContain('exchange.evidence-reference');
  });
});
