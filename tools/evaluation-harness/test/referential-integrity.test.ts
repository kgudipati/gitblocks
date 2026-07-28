import { describe, expect, it } from 'vitest';

import {
  validateCaseBundle,
  validatePrediction,
} from '../src/referential-integrity.ts';
import type { EvidenceObservation } from '../src/contracts.ts';
import {
  createCase,
  createEvidence,
  createGold,
  createPrediction,
} from './test-documents.ts';

function codes(diagnostics: readonly { readonly code: string }[]): string[] {
  return diagnostics.map((diagnostic) => diagnostic.code);
}

const COMMIT_SHA = 'a'.repeat(40);
const SOURCE_REVISION_CASES: readonly {
  readonly sourceType: EvidenceObservation['sourceType'];
  readonly revision: EvidenceObservation['sourceRevision'];
  readonly caseLocal?: boolean;
}[] = [
  {
    sourceType: 'official-documentation',
    revision: {
      kind: 'git-commit',
      value: COMMIT_SHA,
      immutableUrl: `https://github.com/example/project/tree/${COMMIT_SHA}/docs`,
    },
  },
  {
    sourceType: 'official-repository',
    revision: {
      kind: 'git-commit',
      value: COMMIT_SHA,
      immutableUrl: `https://github.com/example/project/tree/${COMMIT_SHA}`,
    },
  },
  {
    sourceType: 'official-release',
    revision: {
      kind: 'release',
      value: 'v1.2.3',
      immutableUrl: 'https://github.com/example/project/releases/tag/v1.2.3',
    },
  },
  {
    sourceType: 'package-registry',
    revision: {
      kind: 'version',
      value: '1.2.3',
      immutableUrl: 'https://www.npmjs.com/package/example/v/1.2.3',
    },
  },
  {
    sourceType: 'security-advisory',
    revision: {
      kind: 'version',
      value: 'GHSA-abcd-efgh-ijkl',
      immutableUrl: 'https://github.com/advisories/GHSA-abcd-efgh-ijkl',
    },
  },
  {
    sourceType: 'license',
    revision: {
      kind: 'git-commit',
      value: COMMIT_SHA,
      immutableUrl: `https://github.com/example/project/blob/${COMMIT_SHA}/LICENSE`,
    },
  },
  {
    sourceType: 'case-local-fact',
    revision: {
      kind: 'case-version',
      value: '1.0.0',
      immutableUrl: null,
    },
    caseLocal: true,
  },
];

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

  it('rejects incomplete or mismatched evidence revision metadata', () => {
    const evidence = createEvidence();
    evidence.observations[0]!.sourceRevision.value = 'short-sha';
    evidence.observations[1]!.sourceRevision = {
      kind: 'mutable-documentation',
      value: 'unversioned',
      immutableUrl: null,
    };
    evidence.observations[1]!.sourceType = 'official-documentation';

    const result = codes(
      validateCaseBundle(createCase(), evidence, createGold()),
    );
    expect(result).toContain('reference.evidence-revision');
  });

  it.each(SOURCE_REVISION_CASES)(
    'accepts appropriate $sourceType revision metadata',
    ({ sourceType, revision, caseLocal }) => {
      const evidence = createEvidence();
      const observation = evidence.observations[0]!;
      observation.sourceType = sourceType;
      observation.sourceRevision = revision;
      if (caseLocal === true) {
        observation.subjectType = 'case';
        observation.candidateId = null;
        observation.sourceUrl =
          'case://authorization-example/repository-runtime';
        observation.publishedAt = null;
        observation.directness = 'case-local';
      }

      expect(
        validateCaseBundle(createCase(), evidence, createGold()),
      ).toStrictEqual([]);
    },
  );

  it.each([
    ['official-documentation', 'case-version'],
    ['official-repository', 'version'],
    ['official-release', 'git-commit'],
    ['package-registry', 'release'],
    ['security-advisory', 'git-commit'],
    ['license', 'version'],
    ['case-local-fact', 'release'],
  ] as const)(
    'rejects %s evidence with revision kind %s',
    (sourceType, kind) => {
      const evidence = createEvidence();
      const observation = evidence.observations[0]!;
      observation.sourceType = sourceType;
      observation.sourceRevision =
        kind === 'git-commit'
          ? {
              kind,
              value: COMMIT_SHA,
              immutableUrl: `https://github.com/example/project/commit/${COMMIT_SHA}`,
            }
          : kind === 'case-version'
            ? { kind, value: '1.0.0', immutableUrl: null }
            : {
                kind,
                value: 'v1.2.3',
                immutableUrl:
                  'https://github.com/example/project/releases/tag/v1.2.3',
              };
      if (sourceType === 'case-local-fact') {
        observation.subjectType = 'case';
        observation.candidateId = null;
        observation.sourceUrl =
          'case://authorization-example/repository-runtime';
        observation.publishedAt = null;
        observation.directness = 'case-local';
      }

      expect(
        codes(validateCaseBundle(createCase(), evidence, createGold())),
      ).toContain('reference.evidence-revision-kind');
    },
  );

  it('accepts explicitly limited mutable official documentation', () => {
    const evidence = createEvidence();
    const observation = evidence.observations[0]!;
    observation.sourceType = 'official-documentation';
    observation.sourceRevision = {
      kind: 'mutable-documentation',
      value: 'unversioned',
      immutableUrl: null,
    };
    observation.limitation =
      'The official page is mutable and publishes no revision metadata.';

    expect(
      validateCaseBundle(createCase(), evidence, createGold()),
    ).toStrictEqual([]);
  });

  it('rejects mutable aliases and source-type-inappropriate revisions', () => {
    const evidence = createEvidence();
    evidence.observations[0]!.sourceType = 'package-registry';
    evidence.observations[0]!.sourceRevision = {
      kind: 'version',
      value: 'latest',
      immutableUrl: 'https://registry.example.com/alpha/latest',
    };
    evidence.observations[1]!.sourceType = 'official-release';
    evidence.observations[1]!.sourceRevision.kind = 'git-commit';

    const result = codes(
      validateCaseBundle(createCase(), evidence, createGold()),
    );
    expect(result).toContain('reference.evidence-revision-kind');
    expect(result).toContain('reference.evidence-revision');
  });

  it('rejects a version that appears only as a substring of a locator', () => {
    const evidence = createEvidence();
    evidence.observations[0]!.sourceType = 'package-registry';
    evidence.observations[0]!.sourceRevision = {
      kind: 'version',
      value: '1.2.3',
      immutableUrl: 'https://registry.example.com/alpha/11.2.30',
    };

    expect(
      codes(validateCaseBundle(createCase(), evidence, createGold())),
    ).toContain('reference.evidence-revision');
  });

  it('rejects evidence published or collected after the case cutoff', () => {
    const evidence = createEvidence();
    evidence.observations[0]!.publishedAt = '2026-07-29T01:00:00Z';
    evidence.observations[1]!.collectedAt = '2026-07-29T01:00:00Z';

    expect(
      codes(validateCaseBundle(createCase(), evidence, createGold())),
    ).toContain('reference.evidence-cutoff');
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

  it.each([
    {
      outcome: 'recommend' as const,
      labels: ['rejected', 'rejected', 'rejected'] as const,
    },
    {
      outcome: 'no-viable-candidate' as const,
      labels: ['rejected', 'insufficient-evidence', 'rejected'] as const,
    },
    {
      outcome: 'no-viable-candidate' as const,
      labels: [
        'insufficient-evidence',
        'insufficient-evidence',
        'insufficient-evidence',
      ] as const,
    },
    {
      outcome: 'insufficient-evidence' as const,
      labels: ['rejected', 'rejected', 'rejected'] as const,
    },
    {
      outcome: 'insufficient-evidence' as const,
      labels: ['viable', 'insufficient-evidence', 'rejected'] as const,
    },
    {
      outcome: 'insufficient-evidence' as const,
      labels: ['recommended', 'insufficient-evidence', 'rejected'] as const,
    },
  ])(
    'rejects $outcome with incompatible dispositions $labels',
    ({ outcome, labels }) => {
      const gold = createGold();
      gold.outcome = outcome;
      gold.rankGroups = [];
      gold.dispositions.forEach((disposition, index) => {
        disposition.disposition = labels[index]!;
      });

      expect(
        codes(validateCaseBundle(createCase(), createEvidence(), gold)),
      ).toContain('reference.outcome');
    },
  );

  it.each([
    {
      outcome: 'recommend' as const,
      labels: ['recommended', 'rejected', 'rejected'] as const,
    },
    {
      outcome: 'recommend' as const,
      labels: ['viable', 'rejected', 'rejected'] as const,
    },
    {
      outcome: 'no-viable-candidate' as const,
      labels: ['rejected', 'rejected', 'rejected'] as const,
    },
    {
      outcome: 'insufficient-evidence' as const,
      labels: ['insufficient-evidence', 'rejected', 'rejected'] as const,
    },
  ])(
    'accepts the valid $outcome disposition combination',
    ({ outcome, labels }) => {
      const testCase = createCase();
      testCase.hardConstraints = [];
      const gold = createGold();
      gold.outcome = outcome;
      gold.rankGroups =
        outcome === 'recommend' ? [[gold.dispositions[0]!.candidateId]] : [];
      gold.hardConstraintConflicts = [];
      gold.dispositions.forEach((disposition, index) => {
        disposition.disposition = labels[index]!;
      });

      expect(
        validateCaseBundle(testCase, createEvidence(), gold),
      ).toStrictEqual([]);
    },
  );

  it('rejects alternative outcomes incompatible with the same dispositions', () => {
    const gold = createGold();
    gold.allowedAlternativeOutcomes = ['no-viable-candidate'];

    expect(
      codes(validateCaseBundle(createCase(), createEvidence(), gold)),
    ).toContain('reference.outcome');
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

  it('rejects a tied pair that is also transitively ordered', () => {
    const gold = createGold();
    gold.dispositions[2]!.disposition = 'viable';
    gold.hardConstraintConflicts = [];
    gold.rankGroups = [['alpha', 'beta']];
    gold.rankRelations = [
      { higherCandidateId: 'alpha', lowerCandidateId: 'gamma' },
      { higherCandidateId: 'gamma', lowerCandidateId: 'beta' },
    ];

    expect(
      codes(validateCaseBundle(createCase(), createEvidence(), gold)),
    ).toContain('reference.rank-contradiction');
  });

  it('rejects a pair that is both ordered and incomparable', () => {
    const gold = createGold();
    gold.incomparablePairs = [['alpha', 'beta']];

    expect(
      codes(validateCaseBundle(createCase(), createEvidence(), gold)),
    ).toContain('reference.rank-contradiction');
  });

  it('propagates an order across a tie before checking incomparability', () => {
    const gold = createGold();
    gold.dispositions[2]!.disposition = 'viable';
    gold.hardConstraintConflicts = [];
    gold.rankGroups = [['alpha', 'beta']];
    gold.rankRelations = [
      { higherCandidateId: 'alpha', lowerCandidateId: 'gamma' },
    ];
    gold.incomparablePairs = [['beta', 'gamma']];

    expect(
      codes(validateCaseBundle(createCase(), createEvidence(), gold)),
    ).toContain('reference.rank-contradiction');
  });

  it('rejects a pair that is both tied and incomparable', () => {
    const gold = createGold();
    gold.rankGroups = [['alpha', 'beta']];
    gold.incomparablePairs = [['alpha', 'beta']];

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

  it('requires a hard-conflicting gold candidate to be rejected', () => {
    const gold = createGold();
    gold.dispositions[2]!.disposition = 'insufficient-evidence';

    expect(
      codes(validateCaseBundle(createCase(), createEvidence(), gold)),
    ).toContain('reference.conflict-disposition');
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

  it.each([
    {
      outcome: 'recommend' as const,
      labels: ['rejected', 'rejected', 'rejected'] as const,
    },
    {
      outcome: 'no-viable-candidate' as const,
      labels: ['rejected', 'insufficient-evidence', 'rejected'] as const,
    },
    {
      outcome: 'no-viable-candidate' as const,
      labels: [
        'insufficient-evidence',
        'insufficient-evidence',
        'insufficient-evidence',
      ] as const,
    },
    {
      outcome: 'insufficient-evidence' as const,
      labels: ['rejected', 'rejected', 'rejected'] as const,
    },
    {
      outcome: 'insufficient-evidence' as const,
      labels: ['viable', 'insufficient-evidence', 'rejected'] as const,
    },
    {
      outcome: 'insufficient-evidence' as const,
      labels: ['recommended', 'insufficient-evidence', 'rejected'] as const,
    },
  ])(
    'rejects prediction outcome $outcome with incompatible dispositions $labels',
    ({ outcome, labels }) => {
      const prediction = createPrediction();
      prediction.outcome = outcome;
      prediction.rankGroups = [];
      prediction.candidates.forEach((candidate, index) => {
        candidate.disposition = labels[index]!;
      });

      expect(
        codes(validatePrediction(createCase(), createEvidence(), prediction)),
      ).toContain('reference.outcome');
    },
  );

  it.each([
    {
      outcome: 'recommend' as const,
      labels: ['recommended', 'rejected', 'rejected'] as const,
    },
    {
      outcome: 'recommend' as const,
      labels: ['viable', 'rejected', 'rejected'] as const,
    },
    {
      outcome: 'no-viable-candidate' as const,
      labels: ['rejected', 'rejected', 'rejected'] as const,
    },
    {
      outcome: 'insufficient-evidence' as const,
      labels: ['insufficient-evidence', 'rejected', 'rejected'] as const,
    },
  ])(
    'accepts prediction outcome $outcome with its valid disposition combination',
    ({ outcome, labels }) => {
      const prediction = createPrediction();
      prediction.outcome = outcome;
      prediction.rankGroups =
        outcome === 'recommend'
          ? [[prediction.candidates[0]!.candidateId]]
          : [];
      prediction.rankRelations = [];
      prediction.candidates.forEach((candidate, index) => {
        candidate.disposition = labels[index]!;
      });

      expect(
        validatePrediction(createCase(), createEvidence(), prediction),
      ).toStrictEqual([]);
    },
  );
});
