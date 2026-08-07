import { describe, expect, it } from 'vitest';

import {
  DETERMINISTIC_CANDIDATE_PROFILE_VERSION,
  DETERMINISTIC_PROFILE_FIELD_IDS,
  DETERMINISTIC_PROFILE_RULES_VERSION,
  evaluateCandidateConstraintProfileState,
  evaluateCandidateConstraints,
  getDeterministicProfileFieldRegistry,
  type CandidateConstraintNormalizationInput,
  type DeterministicCandidateProfile,
  type DeterministicProfileFieldId,
} from '../src/index.ts';

const taxonomyDigest = '1'.repeat(64);

describe('candidate constraint evaluation', () => {
  it('satisfies a primary family match and conflicts on a mismatch', () => {
    expect(evaluate(profile(), normalization()).overallHardState).toBe(
      'satisfied',
    );
    expect(
      evaluate(profile('audit-logging'), normalization()).overallHardState,
    ).toBe('conflict');
  });

  it('keeps unknown architecture unresolved and evaluates complete known sets conservatively', () => {
    expect(
      evaluate(
        profile(),
        normalization([constraint('architecture', 'library')]),
      ).overallHardState,
    ).toBe('unresolved');
    expect(
      evaluate(
        profile('authorization', {
          'adoption-unit-type': knownSet('adoption-unit-type', ['library']),
        }),
        normalization([constraint('architecture', 'library')]),
      ).overallHardState,
    ).toBe('satisfied');
    expect(
      evaluate(
        profile('authorization', {
          'adoption-unit-type': knownSet('adoption-unit-type', []),
        }),
        normalization([constraint('architecture', 'library')]),
      ).overallHardState,
    ).toBe('conflict');
  });

  it('conflicts on prohibited known-present and satisfies prohibited known-absent', () => {
    expect(
      evaluate(
        profile('authorization', {
          'capability-variants-features': knownSet(
            'capability-variants-features',
            ['decision-caching'],
          ),
        }),
        normalization([
          constraint('feature', 'decision-caching', 'prohibited'),
        ]),
      ).overallHardState,
    ).toBe('conflict');
    expect(
      evaluate(
        profile('authorization', {
          'capability-variants-features': knownSet(
            'capability-variants-features',
            [],
          ),
        }),
        normalization([
          constraint('feature', 'decision-caching', 'prohibited'),
        ]),
      ).overallHardState,
    ).toBe('satisfied');
  });

  it('treats profile conflicts as unresolved', () => {
    const conflict = {
      ...knownSet('adoption-unit-type', ['library']),
      state: 'conflict' as const,
      stateReasonCode: 'conflicting-approved-structured-values' as const,
      stateRuleId: 'retain-conflicting-approved-claims' as const,
      valueExtractionRuleId: null,
      sourceReferences: [],
      claims: [
        claim(['library'], 'snapshot-a'),
        claim(['service'], 'snapshot-b'),
      ],
    };
    delete (conflict as { value?: unknown }).value;
    expect(
      evaluate(
        profile('authorization', { 'adoption-unit-type': conflict }),
        normalization([constraint('architecture', 'library')]),
      ).overallHardState,
    ).toBe('unresolved');
  });

  it('applies not-applicable modality rules without treating absence as unknown', () => {
    expect(
      evaluateCandidateConstraintProfileState({
        profileState: 'not-applicable',
        modality: 'required',
      }),
    ).toEqual({ match: 'mismatch', state: 'conflict' });
    expect(
      evaluateCandidateConstraintProfileState({
        profileState: 'not-applicable',
        modality: 'prohibited',
      }),
    ).toEqual({ match: 'mismatch', state: 'satisfied' });
    expect(
      evaluateCandidateConstraintProfileState({
        profileState: 'not-applicable',
        modality: 'preferred',
      }),
    ).toEqual({ match: 'mismatch', state: 'conflict' });
  });

  it('does not let a preferred mismatch change the hard state', () => {
    const result = evaluate(
      profile('authorization', {
        'capability-variants-features': knownSet(
          'capability-variants-features',
          [],
        ),
      }),
      normalization([constraint('feature', 'decision-caching', 'preferred')]),
    );
    expect(result.evaluations.at(-1)).toMatchObject({
      match: 'mismatch',
      state: 'conflict',
    });
    expect(result.overallHardState).toBe('satisfied');
  });

  it('keeps hard non-taxonomy declarations unresolved without parsing text', () => {
    const result = evaluate(profile(), {
      ...normalization(),
      preservedDeclarations: [
        {
          constraintId: 'constraint-runtime',
          modality: 'required',
          statement: 'do not parse Node 24 from this statement',
          originalTerm: 'node-24',
          facet: 'runtime',
          reasonCode: null,
        },
      ],
    });
    expect(result.overallHardState).toBe('unresolved');
    expect(result.evaluations.at(-1)).toMatchObject({
      match: 'unresolved',
      profileFieldId: null,
    });
  });

  it('does not treat optional infrastructure support as a prohibited dependency', () => {
    const result = evaluate(
      profile('authorization', {
        'required-infrastructure': knownSet('required-infrastructure', []),
        'optional-infrastructure': knownSet('optional-infrastructure', [
          'redis',
        ]),
      }),
      normalization([constraint('infrastructure', 'redis', 'prohibited')]),
    );
    expect(result.overallHardState).toBe('satisfied');
    expect(result.evaluations.at(-1)?.ruleId).toBe(
      'evaluate-required-infrastructure-only',
    );
  });

  it('rejects non-normalized input and taxonomy mismatches', () => {
    expect(
      evaluateCandidateConstraints({
        profile: profile(),
        normalization: {
          ...normalization(),
          outcome: 'clarification-required',
        },
      }).ok,
    ).toBe(false);
    expect(
      evaluateCandidateConstraints({
        profile: profile(),
        normalization: {
          ...normalization(),
          taxonomySemanticDigest: '2'.repeat(64),
        },
      }).ok,
    ).toBe(false);
  });
});

function evaluate(
  candidate: DeterministicCandidateProfile,
  query: CandidateConstraintNormalizationInput,
) {
  const result = evaluateCandidateConstraints({
    profile: candidate,
    normalization: query,
  });
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error('Expected valid evaluation.');
  return result.value;
}

function normalization(
  constraints: CandidateConstraintNormalizationInput['normalizedConstraints'] = [],
): CandidateConstraintNormalizationInput {
  return {
    outcome: 'normalized',
    taxonomyVersion: '1.0.0',
    taxonomySemanticDigest: taxonomyDigest,
    primaryFamilyId: 'authorization',
    normalizedConstraints: constraints,
    preservedDeclarations: [],
  };
}

function constraint(
  facet: 'architecture' | 'feature' | 'infrastructure',
  conceptId: string,
  modality: 'preferred' | 'prohibited' | 'required' = 'required',
) {
  return {
    normalizedConstraintId: `normalized-${facet}-${conceptId}`,
    sourceConstraintIds: [`constraint-${facet}-${conceptId}`],
    modality,
    facet,
    resolutionBasis: 'controlled-taxonomy' as const,
    ruleId: 'resolve-exact-taxonomy-constraint',
    conceptId,
    canonicalTerm: conceptId,
  };
}

function profile(
  family: 'audit-logging' | 'authorization' = 'authorization',
  replacements: Partial<Record<DeterministicProfileFieldId, object>> = {},
): DeterministicCandidateProfile {
  const registry = getDeterministicProfileFieldRegistry();
  const fields = registry.map((definition) => {
    const defaultField =
      definition.fieldId === 'capability-family'
        ? {
            fieldId: definition.fieldId,
            scope: definition.scope,
            state: 'known',
            stateReasonCode: 'approved-catalog-field-value',
            stateRuleId: 'assign-known-approved-catalog-value',
            valueExtractionRuleId: 'extract-capability-family',
            versionScope: null,
            sourceReferences: [
              {
                kind: 'catalog-field',
                candidateId: 'candidate-one',
                catalogField: 'additional-capability-families',
              },
              {
                kind: 'catalog-field',
                candidateId: 'candidate-one',
                catalogField: 'primary-capability-family',
              },
            ],
            value: { primaryFamily: family, additionalFamilies: [] },
          }
        : unknown(definition.fieldId, definition.scope);
    return replacements[definition.fieldId] ?? defaultField;
  });
  return {
    contractVersion: '1.0.0',
    profileVersion: DETERMINISTIC_CANDIDATE_PROFILE_VERSION,
    deterministicProfileId: `profile-${'1'.repeat(48)}`,
    candidateId: 'candidate-one',
    catalogBinding: {
      catalogVersion: 'public-v1',
      catalogDigest: '2'.repeat(64),
    },
    taxonomyBinding: {
      taxonomyVersion: '1.0.0',
      taxonomySemanticDigest: taxonomyDigest,
    },
    profileRulesVersion: DETERMINISTIC_PROFILE_RULES_VERSION,
    fields: fields as DeterministicCandidateProfile['fields'],
    semanticProfileDigest: '3'.repeat(64),
  };
}

function unknown(
  fieldId: DeterministicProfileFieldId,
  scope: 'candidate-wide' | 'version-specific',
) {
  return {
    fieldId,
    scope,
    state: 'unknown',
    stateReasonCode: 'structured-provider-value-not-committed',
    stateRuleId: 'assign-unknown-structured-provider-value-missing',
    valueExtractionRuleId: null,
    versionScope: null,
    sourceReferences: [],
  };
}

function knownSet(fieldId: DeterministicProfileFieldId, conceptIds: string[]) {
  const scope =
    getDeterministicProfileFieldRegistry().find(
      (definition) => definition.fieldId === fieldId,
    )?.scope ?? 'candidate-wide';
  return {
    fieldId,
    scope,
    state: 'known',
    stateReasonCode: 'approved-structured-field-value',
    stateRuleId: 'assign-known-approved-structured-value',
    valueExtractionRuleId: `extract-${fieldId}-from-structured-authority`,
    versionScope:
      scope === 'version-specific'
        ? { kind: 'repository-snapshot', snapshotId: 'snapshot-one' }
        : null,
    sourceReferences: [structured('snapshot-one')],
    value: { completeness: 'complete', conceptIds },
  };
}

function claim(conceptIds: string[], snapshotId: string) {
  return {
    value: { completeness: 'complete', conceptIds },
    valueExtractionRuleId:
      'extract-adoption-unit-type-from-structured-authority',
    sourceReferences: [structured(snapshotId)],
  };
}

function structured(sourceSnapshotId: string) {
  return {
    kind: 'structured-collection',
    sourceSnapshotId,
    evidenceIds: [],
    sourceTopicCodes: ['adoption-unit'],
  };
}

expect(DETERMINISTIC_PROFILE_FIELD_IDS).toHaveLength(27);
