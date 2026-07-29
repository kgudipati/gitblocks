import { describe, expect, it } from 'vitest';

import { validateFitAssessmentResult } from '../src/index.ts';
import {
  candidateId,
  createEvidence,
  createFitAssessmentResult,
  evidenceReference,
  stableId,
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

function addGamma(result: ReturnType<typeof createFitAssessmentResult>): void {
  result.suppliedCandidateIds.push(candidateId('gamma'));
  result.evidence.push(createEvidence('gamma', 'gamma-license'));
  result.claims.push({
    kind: 'material-claim',
    claimId: stableId<'claim'>('gamma-license-fit'),
    candidateId: candidateId('gamma'),
    topic: stableId<'topic'>('license'),
    direction: 'favorable',
    statement: 'The license evidence supports candidate viability.',
    evidenceReferences: [evidenceReference('gamma', 'gamma-license')],
    inferenceIds: [],
  });
  result.assessments.push({
    candidateId: candidateId('gamma'),
    disposition: 'viable',
    reasons: [],
    evidenceReferences: [evidenceReference('gamma', 'gamma-license')],
    inferenceIds: [],
    unknownIds: [],
    claimIds: [stableId<'claim'>('gamma-license-fit')],
    hardConflictIds: [],
  });
}

describe('partial ranking invariants', () => {
  it('accepts ordered tie groups, explicit partial order, and incomparability', () => {
    const result = createFitAssessmentResult();
    addGamma(result);
    result.rankGroups = [
      { candidateIds: [candidateId('beta'), candidateId('alpha')] },
    ];
    result.rankRelations = [
      {
        higherCandidateId: candidateId('alpha'),
        lowerCandidateId: candidateId('gamma'),
      },
    ];
    result.incomparablePairs = [];

    const validation = validateFitAssessmentResult(result);

    expect(validation.ok).toBe(true);
    if (validation.ok) {
      expect(validation.value.rankGroups[0]!.candidateIds).toEqual([
        'alpha',
        'beta',
      ]);
    }

    result.rankRelations = [];
    result.incomparablePairs = [
      {
        leftCandidateId: candidateId('alpha'),
        rightCandidateId: candidateId('gamma'),
      },
    ];
    expect(validateFitAssessmentResult(result).ok).toBe(true);
  });

  it('rejects rejected or insufficient-evidence ranking members', () => {
    const result = createFitAssessmentResult();
    result.assessments[1]!.disposition = 'insufficient-evidence';

    expect(codes(validateFitAssessmentResult(result))).toContain(
      'ranking.candidate',
    );
  });

  it('rejects empty tie groups and duplicate ranking membership', () => {
    const result = createFitAssessmentResult();
    result.rankGroups = [
      { candidateIds: [] },
      {
        candidateIds: [candidateId('alpha'), candidateId('alpha')],
      },
    ];

    expect(codes(validateFitAssessmentResult(result))).toEqual(
      expect.arrayContaining([
        'ranking.duplicate-membership',
        'ranking.empty-group',
      ]),
    );
  });

  it('rejects directed ranking cycles', () => {
    const result = createFitAssessmentResult();
    result.rankGroups = [];
    result.rankRelations = [
      {
        higherCandidateId: candidateId('alpha'),
        lowerCandidateId: candidateId('beta'),
      },
      {
        higherCandidateId: candidateId('beta'),
        lowerCandidateId: candidateId('alpha'),
      },
    ];

    expect(codes(validateFitAssessmentResult(result))).toContain(
      'ranking.cycle',
    );
  });

  it('rejects a pair that is tied and explicitly ordered', () => {
    const result = createFitAssessmentResult();
    result.rankGroups = [
      {
        candidateIds: [candidateId('alpha'), candidateId('beta')],
      },
    ];
    result.rankRelations = [
      {
        higherCandidateId: candidateId('alpha'),
        lowerCandidateId: candidateId('beta'),
      },
    ];

    expect(codes(validateFitAssessmentResult(result))).toContain(
      'ranking.contradiction',
    );
  });

  it('rejects a pair that is tied and incomparable', () => {
    const result = createFitAssessmentResult();
    result.rankGroups = [
      {
        candidateIds: [candidateId('alpha'), candidateId('beta')],
      },
    ];
    result.incomparablePairs = [
      {
        leftCandidateId: candidateId('alpha'),
        rightCandidateId: candidateId('beta'),
      },
    ];

    expect(codes(validateFitAssessmentResult(result))).toContain(
      'ranking.contradiction',
    );
  });

  it('rejects a pair that is ordered and incomparable', () => {
    const result = createFitAssessmentResult();
    result.incomparablePairs = [
      {
        leftCandidateId: candidateId('alpha'),
        rightCandidateId: candidateId('beta'),
      },
    ];

    expect(codes(validateFitAssessmentResult(result))).toContain(
      'ranking.contradiction',
    );
  });

  it('rejects a candidate declared incomparable with itself', () => {
    const result = createFitAssessmentResult();
    result.incomparablePairs = [
      {
        leftCandidateId: candidateId('alpha'),
        rightCandidateId: candidateId('alpha'),
      },
    ];

    expect(codes(validateFitAssessmentResult(result))).toContain(
      'ranking.contradiction',
    );
  });

  it('propagates tie equivalence through ordering and incomparability', () => {
    const result = createFitAssessmentResult();
    addGamma(result);
    result.rankGroups = [
      {
        candidateIds: [candidateId('alpha'), candidateId('beta')],
      },
    ];
    result.rankRelations = [
      {
        higherCandidateId: candidateId('alpha'),
        lowerCandidateId: candidateId('gamma'),
      },
    ];
    result.incomparablePairs = [
      {
        leftCandidateId: candidateId('beta'),
        rightCandidateId: candidateId('gamma'),
      },
    ];

    expect(codes(validateFitAssessmentResult(result))).toContain(
      'ranking.contradiction',
    );
  });

  it('returns diagnostics in stable path/code order independent of catalog insertion order', () => {
    const first = createFitAssessmentResult();
    first.assessments[0]!.claimIds = [
      stableId<'claim'>('missing-z'),
      stableId<'claim'>('missing-a'),
    ];
    const second = createFitAssessmentResult();
    second.assessments.reverse();
    second.assessments[1]!.claimIds = [
      stableId<'claim'>('missing-a'),
      stableId<'claim'>('missing-z'),
    ];

    const firstResult = validateFitAssessmentResult(first);
    const secondResult = validateFitAssessmentResult(second);
    expect(firstResult.ok).toBe(false);
    expect(secondResult.ok).toBe(false);
    if (!firstResult.ok && !secondResult.ok) {
      expect(
        firstResult.issues.map(({ code, path }) => ({ code, path })),
      ).toEqual(secondResult.issues.map(({ code, path }) => ({ code, path })));
    }
  });
});
