import { describe, expect, it } from 'vitest';

import {
  DETERMINISTIC_CANDIDATE_PROFILE_VERSION,
  DETERMINISTIC_PROFILE_FIELD_IDS,
  DETERMINISTIC_PROFILE_RULES_VERSION,
  evaluateCandidateConstraintProfileState,
  evaluateCandidateConstraints,
  evaluateCandidateConstraintsV2,
  getDeterministicProfileFieldRegistry,
  projectDeterministicCandidateProfileV1ToEvaluatorV2,
  type CandidateConstraintNormalizationInput,
  type DeterministicCandidateProfile,
  type DeterministicCandidateProfileEvaluatorV2,
  type DeterministicProfileConceptFieldRecordV2,
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

  it('emits one hard evaluation when a declaration normalized to a controlled concept', () => {
    const normalized = constraint('feature', 'decision-caching');
    const result = evaluate(profile(), {
      ...normalization([normalized]),
      preservedDeclarations: [
        {
          constraintId: normalized.sourceConstraintIds[0]!,
          modality: normalized.modality,
          statement: 'Require decision caching.',
          originalTerm: 'decision-caching',
          facet: normalized.facet,
          reasonCode: 'decision-caching-required',
        },
      ],
    });

    expect(userConstraintEvaluations(result)).toEqual([
      expect.objectContaining({
        evaluationId: normalized.normalizedConstraintId,
        sourceKind: 'normalized-constraint',
      }),
    ]);
  });

  it('emits one preserved evaluation when a declaration has no controlled normalization', () => {
    const result = evaluate(profile(), {
      ...normalization([
        {
          normalizedConstraintId: 'normalized-runtime-custom-runtime',
          sourceConstraintIds: ['constraint-runtime-custom-runtime'],
          modality: 'required',
          facet: 'runtime',
          resolutionBasis: 'preserved-declaration',
          ruleId: 'preserve-explicit-declaration',
          conceptId: null,
          canonicalTerm: null,
        },
      ]),
      preservedDeclarations: [
        {
          constraintId: 'constraint-runtime-custom-runtime',
          modality: 'required',
          statement: 'Require the declared custom runtime.',
          originalTerm: 'custom-runtime',
          facet: 'runtime',
          reasonCode: 'custom-runtime-required',
        },
      ],
    });

    expect(userConstraintEvaluations(result)).toEqual([
      expect.objectContaining({
        evaluationId: 'constraint-runtime-custom-runtime',
        sourceKind: 'preserved-declaration',
        state: 'unresolved',
      }),
    ]);
    expect(result.overallHardState).toBe('unresolved');
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

  it('satisfies required infrastructure when a V1 profile establishes optional support', () => {
    const result = evaluate(
      profile('authorization', {
        'required-infrastructure': knownSet('required-infrastructure', []),
        'optional-infrastructure': knownSet('optional-infrastructure', [
          'postgresql',
        ]),
      }),
      normalization([constraint('infrastructure', 'postgresql')]),
    );
    expect(result.evaluations.at(-1)).toMatchObject({
      match: 'match',
      state: 'satisfied',
      ruleId: 'evaluate-required-or-optional-infrastructure',
    });
    expect(result.overallHardState).toBe('satisfied');
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

  it.each([
    ['partial', [], 'unresolved'],
    ['complete', [], 'mismatch'],
    ['partial', [assertion('decision-caching', 'present')], 'match'],
    ['partial', [assertion('decision-caching', 'absent')], 'mismatch'],
    ['partial', [conflictingAssertion('decision-caching')], 'unresolved'],
  ] as const)(
    'applies V2 %s coverage and concept-local assertions',
    (coverage, assertions, expectedMatch) => {
      const result = evaluateV2(
        evaluatorProfile(
          conceptField('capability-variants-features', coverage, assertions),
        ),
        normalization([constraint('feature', 'decision-caching')]),
      );
      expect(result.evaluations.at(-1)).toMatchObject({
        match: expectedMatch,
      });
    },
  );

  it.each([
    ['present', 'present', 'satisfied', 'satisfied', 'conflict'],
    ['present', 'absent', 'satisfied', 'satisfied', 'conflict'],
    ['present', 'unknown', 'satisfied', 'satisfied', 'conflict'],
    ['present', 'conflict', 'satisfied', 'satisfied', 'conflict'],
    ['absent', 'present', 'satisfied', 'satisfied', 'satisfied'],
    ['absent', 'absent', 'conflict', 'conflict', 'satisfied'],
    ['absent', 'unknown', 'unresolved', 'unresolved', 'satisfied'],
    ['absent', 'conflict', 'unresolved', 'unresolved', 'satisfied'],
    ['unknown', 'present', 'satisfied', 'satisfied', 'unresolved'],
    ['unknown', 'absent', 'unresolved', 'unresolved', 'unresolved'],
    ['unknown', 'unknown', 'unresolved', 'unresolved', 'unresolved'],
    ['unknown', 'conflict', 'unresolved', 'unresolved', 'unresolved'],
    ['conflict', 'present', 'satisfied', 'satisfied', 'unresolved'],
    ['conflict', 'absent', 'unresolved', 'unresolved', 'unresolved'],
    ['conflict', 'unknown', 'unresolved', 'unresolved', 'unresolved'],
    ['conflict', 'conflict', 'unresolved', 'unresolved', 'unresolved'],
  ] as const)(
    'evaluates V2 infrastructure required=%s optional=%s across every modality',
    (
      requiredState,
      optionalState,
      requiredExpected,
      preferredExpected,
      prohibitedExpected,
    ) => {
      const candidate = evaluatorProfile(
        infrastructureField('required-infrastructure', requiredState),
        infrastructureField('optional-infrastructure', optionalState),
      );
      for (const [modality, expectedState] of [
        ['required', requiredExpected],
        ['preferred', preferredExpected],
        ['prohibited', prohibitedExpected],
      ] as const) {
        const result = evaluateV2(
          candidate,
          normalization([constraint('infrastructure', 'postgresql', modality)]),
        );
        expect(result.evaluations.at(-1)).toMatchObject({
          state: expectedState,
          ruleId:
            modality === 'prohibited'
              ? 'evaluate-required-infrastructure-only'
              : 'evaluate-required-or-optional-infrastructure',
        });
      }
    },
  );

  it('treats complete coverage without an infrastructure assertion as established absence', () => {
    const result = evaluateV2(
      evaluatorProfile(
        conceptField('required-infrastructure', 'complete', []),
        conceptField('optional-infrastructure', 'complete', []),
      ),
      normalization([constraint('infrastructure', 'postgresql')]),
    );
    expect(result.evaluations.at(-1)).toMatchObject({
      match: 'mismatch',
      state: 'conflict',
    });
  });

  it('projects V1 unknown to unknown-empty and retains whole-field conflict claims unchanged', () => {
    const unknownView =
      projectDeterministicCandidateProfileV1ToEvaluatorV2(profile());
    const unknownFeature = unknownView.fields.find(
      ({ fieldId }) => fieldId === 'capability-variants-features',
    );
    expect(unknownFeature).toMatchObject({
      coverage: 'unknown',
      assertions: [],
    });
    expect(unknownFeature).not.toHaveProperty('state');

    const claims = [
      claim(['decision-caching'], 'snapshot-a'),
      claim([], 'snapshot-b'),
    ].map((entry) => ({
      ...entry,
      valueExtractionRuleId:
        'extract-capability-variants-features-from-structured-authority' as const,
    }));
    const conflict = {
      ...knownSet('capability-variants-features', ['decision-caching']),
      state: 'conflict' as const,
      stateReasonCode: 'conflicting-approved-structured-values' as const,
      stateRuleId: 'retain-conflicting-approved-claims' as const,
      valueExtractionRuleId: null,
      sourceReferences: [],
      claims,
    };
    delete (conflict as { value?: unknown }).value;
    const conflictView = projectDeterministicCandidateProfileV1ToEvaluatorV2(
      profile('authorization', {
        'capability-variants-features': conflict,
      }),
    );
    const projected = conflictView.fields.find(
      ({ fieldId }) => fieldId === 'capability-variants-features',
    );
    expect(projected).toMatchObject({
      coverage: 'unknown',
      assertions: [],
      legacyWholeFieldConflict: {
        kind: 'v1-whole-field-conflict',
        claims,
      },
    });
    expect(projected).not.toBe(conflict);
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

function evaluateV2(
  candidate: DeterministicCandidateProfileEvaluatorV2,
  query: CandidateConstraintNormalizationInput,
) {
  const result = evaluateCandidateConstraintsV2({
    profile: candidate,
    normalization: query,
  });
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error('Expected valid V2 evaluation.');
  return result.value;
}

function userConstraintEvaluations(evaluation: ReturnType<typeof evaluate>) {
  return evaluation.evaluations.filter(
    ({ sourceKind }) => sourceKind !== 'primary-family',
  );
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

function evaluatorProfile(
  ...replacements: readonly DeterministicProfileConceptFieldRecordV2[]
): DeterministicCandidateProfileEvaluatorV2 {
  const base = projectDeterministicCandidateProfileV1ToEvaluatorV2(profile());
  const byId = new Map<string, DeterministicProfileConceptFieldRecordV2>(
    replacements.map((field) => [field.fieldId, field]),
  );
  return {
    ...base,
    fields: base.fields.map((field) => byId.get(field.fieldId) ?? field),
  };
}

function conceptField(
  fieldId:
    | 'capability-variants-features'
    | 'optional-infrastructure'
    | 'required-infrastructure',
  coverage: 'complete' | 'partial' | 'unknown',
  assertions: readonly ReturnType<
    typeof assertion | typeof conflictingAssertion
  >[],
): DeterministicProfileConceptFieldRecordV2 {
  return {
    fieldId,
    scope:
      fieldId === 'capability-variants-features'
        ? 'candidate-wide'
        : 'version-specific',
    coverage,
    stateReasonCode:
      coverage === 'unknown'
        ? 'structured-provider-value-not-committed'
        : 'approved-structured-field-value',
    stateRuleId:
      coverage === 'unknown'
        ? 'assign-unknown-structured-provider-value-missing'
        : 'assign-known-approved-structured-value',
    versionScope:
      fieldId === 'capability-variants-features' || coverage === 'unknown'
        ? null
        : { kind: 'repository-snapshot', snapshotId: 'snapshot-one' },
    sourceReferences:
      coverage === 'unknown' ? [] : [structured('snapshot-one')],
    assertions,
  } as DeterministicProfileConceptFieldRecordV2;
}

function assertion(conceptId: string, state: 'absent' | 'present') {
  return {
    conceptId,
    state,
    valueExtractionRuleId:
      'extract-capability-variants-features-from-structured-authority' as const,
    sourceReferences: [structured('snapshot-one')],
  };
}

function conflictingAssertion(conceptId: string) {
  return {
    conceptId,
    state: 'conflict' as const,
    claims: [
      {
        state: 'absent' as const,
        valueExtractionRuleId:
          'extract-capability-variants-features-from-structured-authority' as const,
        sourceReferences: [structured('snapshot-one')],
      },
      {
        state: 'present' as const,
        valueExtractionRuleId:
          'extract-capability-variants-features-from-structured-authority' as const,
        sourceReferences: [structured('snapshot-two')],
      },
    ],
  };
}

function infrastructureField(
  fieldId: 'optional-infrastructure' | 'required-infrastructure',
  state: 'absent' | 'conflict' | 'present' | 'unknown',
): DeterministicProfileConceptFieldRecordV2 {
  if (state === 'unknown') return conceptField(fieldId, 'unknown', []);
  return conceptField(fieldId, 'partial', [
    state === 'conflict'
      ? conflictingAssertion('postgresql')
      : assertion('postgresql', state),
  ]);
}

expect(DETERMINISTIC_PROFILE_FIELD_IDS).toHaveLength(27);
