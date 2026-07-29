import { describe, expect, it } from 'vitest';

import {
  parseCapabilityRequestV1,
  parseFitAssessmentResponseV1,
  parseRepositoryFingerprintV1,
  type ContractIssueCode,
  type ContractParseResult,
  type FitAssessmentResponseV1,
} from '../src/index.ts';
import {
  cloneValue,
  createCapabilityRequest,
  createFitAssessmentResponse,
  createRepositoryFingerprint,
} from './fixtures.ts';

describe('identifier and reference integrity', () => {
  it('rejects duplicate stable IDs in a local catalog', () => {
    const request = createCapabilityRequest();
    request.successConditions.push({
      ...request.successConditions[0]!,
      statement: 'A contradictory duplicate condition.',
    });

    expectFailureCode(
      parseCapabilityRequestV1(request),
      'domain.reference.duplicate-id',
    );
  });

  it('rejects an unresolved candidate reference', () => {
    const response = createFitAssessmentResponse();
    response.candidateAssessments[0]!.candidateId = 'candidate-ghost';

    expectFailureCode(
      parseFitAssessmentResponseV1(response),
      'domain.reference.unknown-candidate',
    );
  });

  it('rejects an unresolved evidence reference', () => {
    const response = createFitAssessmentResponse();
    response.candidateAssessments[0]!.evidenceIds = ['evidence-missing'];

    expectFailureCode(
      parseFitAssessmentResponseV1(response),
      'domain.reference.unknown-evidence',
    );
  });

  it('rejects an unresolved inference reference', () => {
    const response = createFitAssessmentResponse();
    response.materialClaims[0]!.inferenceIds = ['inference-missing'];

    expectFailureCode(
      parseFitAssessmentResponseV1(response),
      'domain.reference.unknown-inference',
    );
  });

  it('rejects an unresolved unknown reference', () => {
    const response = createFitAssessmentResponse();
    response.candidateAssessments[0]!.unknownIds = ['unknown-missing'];

    expectFailureCode(
      parseFitAssessmentResponseV1(response),
      'domain.reference.unknown-unknown',
    );
  });

  it('rejects a response that omits a supplied candidate', () => {
    const response = createFitAssessmentResponse();
    response.candidateAssessments.pop();

    expectFailureCode(
      parseFitAssessmentResponseV1(response),
      'domain.reference.candidate-set',
    );
  });

  it('rejects a duplicate candidate assessment', () => {
    const response = createFitAssessmentResponse();
    response.candidateAssessments[1] = cloneValue(
      response.candidateAssessments[0]!,
    );

    expectFailureCode(
      parseFitAssessmentResponseV1(response),
      'domain.reference.candidate-set',
    );
  });

  it('rejects a reason moved to another candidate', () => {
    const response = createFitAssessmentResponse();
    response.candidateAssessments[0]!.reasons[0]!.candidateId =
      'candidate-beta';

    expectFailureCode(
      parseFitAssessmentResponseV1(response),
      'domain.reference.candidate-ownership',
    );
  });

  it('rejects evidence moved to another candidate', () => {
    const response = createFitAssessmentResponse();
    response.candidateAssessments[0]!.evidenceIds = ['evidence-beta'];

    expectFailureCode(
      parseFitAssessmentResponseV1(response),
      'domain.reference.candidate-ownership',
    );
  });
});

describe('evidence, inference, claims, and unknowns', () => {
  it('accepts an evidence-derived inference as a distinct variant', () => {
    const response = createFitAssessmentResponse();
    response.inferences.push({
      kind: 'inference',
      inferenceId: 'inference-alpha',
      candidateId: 'candidate-alpha',
      topic: 'runtime-support',
      statement: 'The pinned evidence supports runtime compatibility.',
      rationale: 'The official compatibility statement is direct.',
      evidenceIds: ['evidence-alpha'],
    });
    response.candidateAssessments[0]!.inferenceIds = ['inference-alpha'];
    response.materialClaims[0]!.inferenceIds = ['inference-alpha'];

    expect(parseFitAssessmentResponseV1(response).ok).toBe(true);
  });

  it('rejects an inference without evidence structurally', () => {
    const response = createFitAssessmentResponse();
    response.inferences.push({
      kind: 'inference',
      inferenceId: 'inference-alpha',
      candidateId: 'candidate-alpha',
      topic: 'runtime-support',
      statement: 'An unsupported inference.',
      rationale: 'No evidence was supplied.',
      evidenceIds: [],
    });

    expectFailureCode(
      parseFitAssessmentResponseV1(response),
      'contract.bounds',
    );
  });

  it('rejects an identifier used as both evidence and inference', () => {
    const response = createFitAssessmentResponse();
    response.inferences.push({
      kind: 'inference',
      inferenceId: 'evidence-alpha',
      candidateId: 'candidate-alpha',
      topic: 'runtime-support',
      statement: 'A disguised inference.',
      rationale: 'The identifier attempts to collapse two variants.',
      evidenceIds: ['evidence-alpha'],
    });
    response.candidateAssessments[0]!.inferenceIds = ['evidence-alpha'];

    expectFailureCode(
      parseFitAssessmentResponseV1(response),
      'domain.evidence.kind-conflict',
    );
  });

  it('rejects evidence structurally disguised as an inference', () => {
    const response = createFitAssessmentResponse();
    response.evidence[0] = {
      kind: 'inference',
      inferenceId: 'inference-alpha',
      candidateId: 'candidate-alpha',
      topic: 'runtime-support',
      statement: 'Not direct evidence.',
      rationale: 'Wrong variant.',
      evidenceIds: ['evidence-alpha'],
    } as never;

    expectFailureCode(
      parseFitAssessmentResponseV1(response),
      'contract.required',
    );
  });

  it('rejects a material claim with no evidence or inference', () => {
    const response = createFitAssessmentResponse();
    response.materialClaims[0]!.evidenceIds = [];
    response.materialClaims[0]!.inferenceIds = [];

    expectFailureCode(
      parseFitAssessmentResponseV1(response),
      'domain.claim.traceability',
    );
  });

  it('does not permit an unresolved unknown to become favorable certainty', () => {
    const response = createFitAssessmentResponse();
    response.materialUnknowns.push({
      scope: 'candidate',
      unknownId: 'unknown-runtime',
      candidateId: 'candidate-alpha',
      topic: 'runtime-support',
      statement: 'Runtime behavior remains materially unknown.',
      evidenceIds: [],
    });
    response.candidateAssessments[0]!.unknownIds = ['unknown-runtime'];

    expectFailureCode(
      parseFitAssessmentResponseV1(response),
      'domain.claim.unresolved-unknown',
    );
  });
});

describe('hard constraints and responsible outcomes', () => {
  it('rejects an unsupported recommendation when the dossier supplied no evidence', () => {
    const response = createFitAssessmentResponse();
    response.suppliedCandidateIds = ['candidate-alpha'];
    response.candidateAssessments = [response.candidateAssessments[0]!];
    response.candidateAssessments[0]!.evidenceIds = [];
    response.candidateAssessments[0]!.inferenceIds = [];
    response.candidateAssessments[0]!.claimIds = [];
    response.candidateAssessments[0]!.unknownIds = [];
    response.candidateAssessments[0]!.reasons[0]!.evidenceIds = [];
    response.candidateAssessments[0]!.reasons[0]!.inferenceIds = [];
    response.candidateAssessments[0]!.reasons[0]!.unknownIds = [];
    response.evidence = [];
    response.inferences = [];
    response.materialClaims = [];
    response.materialUnknowns = [];
    response.hardConstraintConflicts = [];
    response.rankGroups = [{ candidateIds: ['candidate-alpha'] }];
    response.completeness = 'complete';

    expectFailureCode(
      parseFitAssessmentResponseV1(response),
      'domain.disposition.support',
    );
  });

  it('rejects a hard-conflicting candidate marked viable', () => {
    const response = createFitAssessmentResponse();
    response.candidateAssessments[1]!.disposition = 'viable';

    expectFailureCode(
      parseFitAssessmentResponseV1(response),
      'domain.constraint.disposition',
    );
  });

  it('rejects a hard-conflicting candidate in the viable ranking', () => {
    const response = createFitAssessmentResponse();
    response.rankGroups.push({ candidateIds: ['candidate-beta'] });

    expectFailureCode(
      parseFitAssessmentResponseV1(response),
      'domain.ranking.candidate',
    );
  });

  it('rejects a hard conflict whose reason is not preserved', () => {
    const response = createFitAssessmentResponse();
    response.candidateAssessments[1]!.reasons[0]!.reasonCode =
      'different-reason';

    expectFailureCode(
      parseFitAssessmentResponseV1(response),
      'domain.constraint.preservation',
    );
  });

  it('accepts each responsible outcome with its required dispositions', () => {
    const recommend = createFitAssessmentResponse();

    const noViable = createFitAssessmentResponse();
    noViable.outcome = 'no-viable-candidate';
    noViable.candidateAssessments[0]!.disposition = 'rejected';
    noViable.rankGroups = [];
    noViable.materialClaims[0]!.direction = 'unfavorable';

    const insufficient = createFitAssessmentResponse();
    insufficient.outcome = 'insufficient-evidence';
    insufficient.candidateAssessments[0]!.disposition = 'insufficient-evidence';
    insufficient.rankGroups = [];
    insufficient.materialClaims[0]!.direction = 'neutral';

    expect(parseFitAssessmentResponseV1(recommend).ok).toBe(true);
    expect(parseFitAssessmentResponseV1(noViable).ok).toBe(true);
    expect(parseFitAssessmentResponseV1(insufficient).ok).toBe(true);
  });

  it.each([
    ['recommend', 'rejected', 'rejected'],
    ['no-viable-candidate', 'recommended', 'rejected'],
    ['insufficient-evidence', 'viable', 'rejected'],
  ] as const)(
    'rejects invalid outcome %s with dispositions %s/%s',
    (outcome, alphaDisposition, betaDisposition) => {
      const response = createFitAssessmentResponse();
      response.outcome = outcome;
      response.candidateAssessments[0]!.disposition = alphaDisposition;
      response.candidateAssessments[1]!.disposition = betaDisposition;
      response.rankGroups = [];

      expectFailureCode(
        parseFitAssessmentResponseV1(response),
        'domain.outcome.disposition',
      );
    },
  );

  it('checks all outcome and two-candidate disposition combinations', () => {
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
          const response = createBothViableResponse();
          response.outcome = outcome;
          response.candidateAssessments[0]!.disposition = left;
          response.candidateAssessments[1]!.disposition = right;
          response.rankGroups = [];
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
          const parsed = parseFitAssessmentResponseV1(response);
          const outcomeFailed =
            !parsed.ok &&
            parsed.issues.some(
              (issue) => issue.code === 'domain.outcome.disposition',
            );

          if (expectedValid) {
            expect(parsed.ok, `${outcome}: ${left}/${right}`).toBe(true);
          } else {
            expect(outcomeFailed, `${outcome}: ${left}/${right}`).toBe(true);
          }
        }
      }
    }
  });
});

describe('partial ranking', () => {
  it('accepts ties, explicit partial ordering, and incomparability', () => {
    const tied = createBothViableResponse();
    tied.rankGroups = [{ candidateIds: ['candidate-alpha', 'candidate-beta'] }];

    const ordered = createBothViableResponse();
    ordered.rankRelations = [
      {
        higherCandidateId: 'candidate-alpha',
        lowerCandidateId: 'candidate-beta',
      },
    ];

    const incomparable = createBothViableResponse();
    incomparable.incomparablePairs = [
      {
        leftCandidateId: 'candidate-alpha',
        rightCandidateId: 'candidate-beta',
      },
    ];

    expect(parseFitAssessmentResponseV1(tied).ok).toBe(true);
    expect(parseFitAssessmentResponseV1(ordered).ok).toBe(true);
    expect(parseFitAssessmentResponseV1(incomparable).ok).toBe(true);
  });

  it('rejects a ranking cycle', () => {
    const response = createBothViableResponse();
    response.rankRelations = [
      {
        higherCandidateId: 'candidate-alpha',
        lowerCandidateId: 'candidate-beta',
      },
      {
        higherCandidateId: 'candidate-beta',
        lowerCandidateId: 'candidate-alpha',
      },
    ];

    expectFailureCode(
      parseFitAssessmentResponseV1(response),
      'domain.ranking.cycle',
    );
  });

  it('rejects a pair that is tied and ordered', () => {
    const response = createBothViableResponse();
    response.rankGroups = [
      { candidateIds: ['candidate-alpha', 'candidate-beta'] },
    ];
    response.rankRelations = [
      {
        higherCandidateId: 'candidate-alpha',
        lowerCandidateId: 'candidate-beta',
      },
    ];

    expectFailureCode(
      parseFitAssessmentResponseV1(response),
      'domain.ranking.contradiction',
    );
  });

  it('rejects a pair that is tied and incomparable', () => {
    const response = createBothViableResponse();
    response.rankGroups = [
      { candidateIds: ['candidate-alpha', 'candidate-beta'] },
    ];
    response.incomparablePairs = [
      {
        leftCandidateId: 'candidate-alpha',
        rightCandidateId: 'candidate-beta',
      },
    ];

    expectFailureCode(
      parseFitAssessmentResponseV1(response),
      'domain.ranking.contradiction',
    );
  });

  it('rejects a pair that is ordered and incomparable', () => {
    const response = createBothViableResponse();
    response.rankRelations = [
      {
        higherCandidateId: 'candidate-alpha',
        lowerCandidateId: 'candidate-beta',
      },
    ];
    response.incomparablePairs = [
      {
        leftCandidateId: 'candidate-alpha',
        rightCandidateId: 'candidate-beta',
      },
    ];

    expectFailureCode(
      parseFitAssessmentResponseV1(response),
      'domain.ranking.contradiction',
    );
  });

  it('rejects duplicate rank-group membership', () => {
    const response = createBothViableResponse();
    response.rankGroups = [
      { candidateIds: ['candidate-alpha'] },
      { candidateIds: ['candidate-alpha', 'candidate-beta'] },
    ];

    expectFailureCode(
      parseFitAssessmentResponseV1(response),
      'domain.ranking.duplicate-membership',
    );
  });
});

describe('repository fact consistency', () => {
  it('rejects contradictory duplicate facts instead of merging them', () => {
    const fingerprint = createRepositoryFingerprint();
    fingerprint.facts.push({
      kind: 'component',
      factId: 'fact-runtime-conflict',
      component: 'runtime',
      name: 'node',
      version: '22.0.0',
      provenance: {
        origin: 'supplied-declaration',
        directness: 'declared',
        confidence: 'high',
        observedAt: '2026-07-28T20:00:00Z',
      },
    });

    expectFailureCode(
      parseRepositoryFingerprintV1(fingerprint),
      'domain.fact.contradictory',
    );
  });
});

describe('diagnostic determinism', () => {
  it('does not depend on duplicate evidence catalog order', () => {
    const forward = createFitAssessmentResponse();
    const duplicateId = forward.evidence[0]!.evidenceId;
    forward.evidence[1]!.evidenceId = duplicateId;
    forward.materialUnknowns.push({
      scope: 'assessment',
      unknownId: 'assessment-evidence-unknown',
      topic: 'evidence-ownership',
      statement: 'Evidence ownership is ambiguous.',
      evidenceIds: [duplicateId],
    });
    const reversed = structuredClone(forward);
    reversed.evidence.reverse();

    expect(parseFitAssessmentResponseV1(forward)).toEqual(
      parseFitAssessmentResponseV1(reversed),
    );
  });
});

function createBothViableResponse(): FitAssessmentResponseV1 {
  const response = createFitAssessmentResponse();
  response.candidateAssessments[1]!.disposition = 'viable';
  response.candidateAssessments[1]!.hardConstraintConflictIds = [];
  response.candidateAssessments[1]!.reasons[0]!.reasonCode =
    'runtime-compatible';
  response.hardConstraintConflicts = [];
  response.materialClaims[1]!.direction = 'favorable';
  response.rankGroups = [];
  return response;
}

function expectFailureCode<Dto, Domain>(
  result: ContractParseResult<Dto, Domain>,
  code: ContractIssueCode,
): void {
  expect(result.ok).toBe(false);
  expect(result.issues.map((issue) => issue.code)).toContain(code);
}
