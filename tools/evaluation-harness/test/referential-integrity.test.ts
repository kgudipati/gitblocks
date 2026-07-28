import { describe, expect, it } from 'vitest';

import {
  validateCaseBundle,
  validatePrediction,
} from '../src/referential-integrity.ts';
import {
  createCase,
  createEvidence,
  createGold,
  createPrediction,
} from './test-documents.ts';

function codes(diagnostics: readonly { readonly code: string }[]): string[] {
  return diagnostics.map((diagnostic) => diagnostic.code);
}

describe('case/evidence/gold referential integrity', () => {
  it('accepts a complete valid bundle', () => {
    expect(
      validateCaseBundle(createCase(), createEvidence(), createGold()),
    ).toEqual([]);
  });

  it.each(['candidate', 'constraint', 'evidence', 'reason', 'unknown'])(
    'rejects duplicate %s IDs',
    (kind) => {
      const caseDocument = createCase();
      const evidence = createEvidence();
      if (kind === 'candidate') {
        caseDocument.candidates[1] = { ...caseDocument.candidates[0]! };
      } else if (kind === 'constraint') {
        caseDocument.hardConstraints.push({
          ...caseDocument.hardConstraints[0]!,
        });
      } else if (kind === 'evidence') {
        evidence.observations[1] = { ...evidence.observations[0]! };
      } else if (kind === 'reason') {
        caseDocument.reasonCodes.push({ ...caseDocument.reasonCodes[0]! });
      } else {
        caseDocument.unknowns.push({ ...caseDocument.unknowns[0]! });
      }

      expect(
        codes(validateCaseBundle(caseDocument, evidence, createGold())),
      ).toContain('reference.duplicate-id');
    },
  );

  it('rejects unknown and unrelated evidence references', () => {
    const gold = createGold();
    gold.dispositions[0]!.evidenceIds = ['missing-evidence'];
    gold.dispositions[1]!.evidenceIds = ['alpha-license'];

    const result = codes(
      validateCaseBundle(createCase(), createEvidence(), gold),
    );
    expect(result).toContain('reference.unknown-evidence');
    expect(result).toContain('reference.unrelated-evidence');
  });

  it('rejects omitted dispositions and contradictory outcomes', () => {
    const gold = createGold();
    gold.dispositions.pop();
    gold.outcome = 'no-viable-candidate';

    const result = codes(
      validateCaseBundle(createCase(), createEvidence(), gold),
    );
    expect(result).toContain('reference.candidate-set');
    expect(result).toContain('reference.outcome');
  });

  it('rejects invalid rank groups, duplicates, and rank cycles', () => {
    const gold = createGold();
    gold.rankGroups = [['alpha', 'gamma'], ['alpha']];
    gold.rankRelations = [
      { higherCandidateId: 'alpha', lowerCandidateId: 'beta' },
      { higherCandidateId: 'beta', lowerCandidateId: 'alpha' },
    ];

    const result = codes(
      validateCaseBundle(createCase(), createEvidence(), gold),
    );
    expect(result).toContain('reference.rank-candidate');
    expect(result).toContain('reference.duplicate-rank');
    expect(result).toContain('reference.rank-cycle');
  });

  it('accepts chained partial-order relations with a shared middle candidate', () => {
    const testCase = createCase();
    testCase.hardConstraints = [];
    const gold = createGold();
    gold.dispositions = gold.dispositions.map((disposition) => ({
      ...disposition,
      disposition: 'viable',
    }));
    gold.rankGroups = [];
    gold.rankRelations = [
      { higherCandidateId: 'alpha', lowerCandidateId: 'beta' },
      { higherCandidateId: 'beta', lowerCandidateId: 'gamma' },
    ];
    gold.hardConstraintConflicts = [];

    expect(validateCaseBundle(testCase, createEvidence(), gold)).toStrictEqual(
      [],
    );
  });

  it('accepts gold expressed only as an incomparable pair', () => {
    const gold = createGold();
    gold.rankGroups = [];
    gold.incomparablePairs = [['alpha', 'beta']];

    expect(
      validateCaseBundle(createCase(), createEvidence(), gold),
    ).toStrictEqual([]);
  });

  it('rejects a pair that is both tied and ordered', () => {
    const gold = createGold();
    gold.rankGroups = [['alpha', 'beta']];
    gold.rankRelations = [
      { higherCandidateId: 'alpha', lowerCandidateId: 'beta' },
    ];

    expect(
      codes(validateCaseBundle(createCase(), createEvidence(), gold)),
    ).toContain('reference.rank-contradiction');
  });

  it('rejects gold recommendations with hard conflicts', () => {
    const gold = createGold();
    gold.dispositions[2]!.disposition = 'recommended';

    expect(
      codes(validateCaseBundle(createCase(), createEvidence(), gold)),
    ).toContain('reference.gold-safety');
  });

  it('requires neutral lexical candidate order', () => {
    const caseDocument = createCase();
    caseDocument.candidates.reverse();

    expect(
      codes(validateCaseBundle(caseDocument, createEvidence(), createGold())),
    ).toContain('reference.candidate-order');
  });
});

describe('prediction referential integrity', () => {
  it('accepts a complete prediction', () => {
    expect(
      validatePrediction(createCase(), createEvidence(), createPrediction()),
    ).toEqual([]);
  });

  it('accepts an intentionally partial prediction ordering', () => {
    const prediction = createPrediction();
    prediction.rankGroups = [];

    expect(
      validatePrediction(createCase(), createEvidence(), prediction),
    ).toStrictEqual([]);
  });

  it('rejects omitted candidates and unknown references', () => {
    const prediction = createPrediction();
    prediction.candidates.pop();
    prediction.candidates[0]!.reasonCodes = ['unknown-reason'];
    prediction.disclosedUnknownIds = ['unknown-unknown'];

    const result = codes(
      validatePrediction(createCase(), createEvidence(), prediction),
    );
    expect(result).toContain('reference.candidate-set');
    expect(result).toContain('reference.unknown-reason');
    expect(result).toContain('reference.unknown-unknown');
  });

  it('rejects contradictory outcome, rank membership, and cycles', () => {
    const prediction = createPrediction();
    prediction.outcome = 'no-viable-candidate';
    prediction.rankGroups = [['gamma']];
    prediction.rankRelations = [
      { higherCandidateId: 'alpha', lowerCandidateId: 'beta' },
      { higherCandidateId: 'beta', lowerCandidateId: 'alpha' },
    ];

    const result = codes(
      validatePrediction(createCase(), createEvidence(), prediction),
    );
    expect(result).toContain('reference.outcome');
    expect(result).toContain('reference.rank-candidate');
    expect(result).toContain('reference.rank-cycle');
  });
});
