import { describe, expect, it } from 'vitest';

import {
  CAPABILITY_QUERY_LIMITS,
  CAPABILITY_QUERY_NORMALIZER_VERSION,
  canonicalizeCapabilityQueryInput,
  canonicalizeCapabilityQueryLookupTermV1,
  normalizeCapabilityQuery,
  validateCandidateReferenceAuthority,
  validateCapabilityQueryInput,
  type CandidateReferenceAuthority,
  type CapabilityQueryInput,
  type CapabilityTaxonomy,
} from '../src/index.ts';

const families = [
  'authorization',
  'audit-logging',
  'background-jobs',
  'rate-limiting',
  'webhooks',
] as const;

function taxonomy(): CapabilityTaxonomy {
  const familyConcepts = families.map((family) => ({
    conceptId: family,
    kind: 'family' as const,
    displayLabel: family,
    definition: `Controlled ${family} family.`,
    applicableFamilyIds: [family],
    parentConceptId: null,
    status: 'active' as const,
    replacementConceptId: null,
  }));
  const coverageConcepts = families.flatMap((family) => [
    {
      conceptId: `${family}-test-architecture`,
      kind: 'architecture' as const,
      displayLabel: `${family} test architecture`,
      definition: `Test-only ${family} architecture coverage.`,
      applicableFamilyIds: [family],
      parentConceptId: family,
      status: 'active' as const,
      replacementConceptId: null,
    },
    {
      conceptId: `${family}-test-feature`,
      kind: 'feature' as const,
      displayLabel: `${family} test feature`,
      definition: `Test-only ${family} feature coverage.`,
      applicableFamilyIds: [family],
      parentConceptId: family,
      status: 'active' as const,
      replacementConceptId: null,
    },
  ]);
  const concepts = [
    ...familyConcepts,
    ...coverageConcepts,
    {
      conceptId: 'recurring-schedules',
      kind: 'feature' as const,
      displayLabel: 'Recurring schedules',
      definition: 'Runs work on recurring schedules.',
      applicableFamilyIds: ['background-jobs'] as const,
      parentConceptId: 'background-jobs',
      status: 'active' as const,
      replacementConceptId: null,
    },
    {
      conceptId: 'queue-worker-library',
      kind: 'architecture' as const,
      displayLabel: 'Queue and worker library',
      definition: 'A queue and worker library adoption unit.',
      applicableFamilyIds: ['background-jobs'] as const,
      parentConceptId: 'background-jobs',
      status: 'active' as const,
      replacementConceptId: null,
    },
    {
      conceptId: 'database-backed-job-queue',
      kind: 'architecture' as const,
      displayLabel: 'Database-backed job queue',
      definition: 'A database-coordinated job queue.',
      applicableFamilyIds: ['background-jobs'] as const,
      parentConceptId: 'background-jobs',
      status: 'active' as const,
      replacementConceptId: null,
    },
    {
      conceptId: 'broker-backed-job-queue',
      kind: 'architecture' as const,
      displayLabel: 'Broker-backed job queue',
      definition: 'A broker-coordinated job queue.',
      applicableFamilyIds: ['background-jobs'] as const,
      parentConceptId: 'background-jobs',
      status: 'active' as const,
      replacementConceptId: null,
    },
    {
      conceptId: 'redis',
      kind: 'infrastructure' as const,
      displayLabel: 'Redis',
      definition: 'Requires Redis infrastructure.',
      applicableFamilyIds: [...families],
      parentConceptId: null,
      status: 'active' as const,
      replacementConceptId: null,
    },
    {
      conceptId: 'retries',
      kind: 'feature' as const,
      displayLabel: 'Retries',
      definition: 'Retries failed work or delivery.',
      applicableFamilyIds: ['background-jobs', 'webhooks'] as const,
      parentConceptId: null,
      status: 'active' as const,
      replacementConceptId: null,
    },
  ];
  return {
    taxonomyVersion: '1.0.0',
    concepts,
    resolvedAliases: [
      ...concepts.map(({ conceptId }) => ({
        aliasKey: conceptId,
        conceptId,
        status: 'active' as const,
        replacementAliasKey: null,
      })),
      {
        aliasKey: 'authorisation',
        conceptId: 'authorization',
        status: 'active',
        replacementAliasKey: null,
      },
      {
        aliasKey: 'web-hook',
        conceptId: 'webhooks',
        status: 'active',
        replacementAliasKey: null,
      },
      {
        aliasKey: 'cron-scheduler',
        conceptId: 'recurring-schedules',
        status: 'active',
        replacementAliasKey: null,
      },
    ],
    ambiguities: ['job-queue', 'worker-queue', 'task-queue'].map(
      (aliasKey) => ({
        aliasKey,
        possibleConceptIds: [
          'broker-backed-job-queue',
          'database-backed-job-queue',
          'queue-worker-library',
        ],
        clarificationReasonCode: 'adoption-unit-ambiguous',
        clarificationContext:
          'Specify the library, database, or broker adoption unit.',
      }),
    ),
    exclusions: [
      {
        termKey: 'authentication',
        applicableFamilyIds: ['authorization'],
        exclusionReasonCode: 'adjacent-capability',
        explanation:
          'Authentication alone does not establish authorization semantics.',
      },
      {
        termKey: 'lightweight',
        applicableFamilyIds: [...families],
        exclusionReasonCode: 'subjective-term',
        explanation: 'Replace subjective language with explicit constraints.',
      },
    ],
  };
}

function input(
  overrides: Partial<CapabilityQueryInput> = {},
): CapabilityQueryInput {
  return {
    contractVersion: '1.0.0',
    queryInputId: 'query-alpha',
    scope: 'local-pre-approval',
    summary: 'Choose an authorization capability.',
    capabilityTerms: [{ termId: 'term-family', originalTerm: 'authorization' }],
    successConditions: [
      { conditionId: 'condition-policy', statement: 'Policy is enforced.' },
    ],
    draftConstraints: [],
    candidateReferences: [],
    repositoryFingerprintReference: null,
    ...overrides,
  };
}

function candidateAuthority(): CandidateReferenceAuthority {
  return {
    catalogVersion: 'public-v1',
    catalogDigest: 'a'.repeat(64),
    candidates: [
      {
        candidateId: 'auth-candidate-one',
        capabilityFamily: 'authorization',
        candidateKey: 'auth-candidate-one',
        repositoryKey: 'example/auth-one',
        npmPackageKey: '@example/auth-one',
      },
      {
        candidateId: 'auth-candidate-two',
        capabilityFamily: 'authorization',
        candidateKey: 'auth-candidate-two',
        repositoryKey: 'example/auth-two',
        npmPackageKey: null,
      },
      {
        candidateId: 'jobs-candidate-one',
        capabilityFamily: 'background-jobs',
        candidateKey: 'jobs-candidate-one',
        repositoryKey: 'example/jobs-one',
        npmPackageKey: 'jobs-one',
      },
    ],
  };
}

describe('capability-query term canonicalization', () => {
  it('uses the exact version and reviewed bounds', () => {
    expect(CAPABILITY_QUERY_NORMALIZER_VERSION).toBe('1.0.0');
    expect(CAPABILITY_QUERY_LIMITS).toMatchObject({
      capabilityTerms: 8,
      successConditions: 20,
      draftConstraints: 32,
      candidateReferences: 10,
      candidateAuthorityCandidates: 200,
      normalizationSteps: 64,
    });
  });

  it.each([
    ['Rate Limiting', 'rate-limiting'],
    ['  web   hook  ', 'web-hook'],
    ['AUTHORISATION', 'authorisation'],
    ['job---queue', 'job-queue'],
  ])('canonicalizes explicit ASCII term %s', (term, expected) => {
    expect(canonicalizeCapabilityQueryLookupTermV1(term)).toEqual({
      ok: true,
      value: expected,
    });
  });

  it.each([
    ['rаte-limiting', 'non-ascii'],
    ['web_hook', 'unsupported-character'],
    ['web/hook', 'unsupported-character'],
    ['rate.limiting', 'unsupported-character'],
    ['-webhook', 'unsupported-character'],
    ['webhook-', 'unsupported-character'],
    ['   ', 'empty'],
  ])('rejects non-exact term %s', (term, reason) => {
    expect(canonicalizeCapabilityQueryLookupTermV1(term)).toEqual({
      ok: false,
      reason,
    });
  });

  it('is locale independent and performs no fuzzy or morphological lookup', () => {
    const descriptor = Object.getOwnPropertyDescriptor(
      String.prototype,
      'localeCompare',
    );
    if (descriptor === undefined) {
      throw new Error('String localeCompare descriptor must exist.');
    }
    Object.defineProperty(String.prototype, 'localeCompare', {
      configurable: true,
      value: () => {
        throw new Error('Query normalization must not use locale comparison.');
      },
    });
    try {
      expect(canonicalizeCapabilityQueryLookupTermV1('RATE LIMITING')).toEqual({
        ok: true,
        value: 'rate-limiting',
      });
      for (const term of ['webhoo', 'webhooks-extra', 'rate-limiters']) {
        const normalized = normalizeCapabilityQuery(
          input({
            capabilityTerms: [{ termId: 'term-family', originalTerm: term }],
          }),
          taxonomy(),
        );
        expect(normalized.ok && normalized.value.outcome).toBe(
          'clarification-required',
        );
      }
    } finally {
      Object.defineProperty(String.prototype, 'localeCompare', descriptor);
    }
  });
});

describe('capability-query input invariants', () => {
  it('validates and canonically orders the local pre-approval input', () => {
    const value = input({
      capabilityTerms: [
        { termId: 'term-z', originalTerm: 'authorization' },
        { termId: 'term-a', originalTerm: 'role-based-access-control' },
      ],
    });
    expect(validateCapabilityQueryInput(value).ok).toBe(true);
    expect(
      canonicalizeCapabilityQueryInput(value).capabilityTerms.map(
        ({ termId }) => termId,
      ),
    ).toEqual(['term-a', 'term-z']);
  });

  it('rejects duplicate source IDs, URL-bearing fields, and missing hard reasons', () => {
    expect(
      validateCapabilityQueryInput(
        input({
          draftConstraints: [
            {
              constraintId: 'term-family',
              modality: 'required',
              statement: 'See https://example.test.',
              originalTerm: 'redis',
              facetHint: 'infrastructure',
              reasonCode: null,
            },
          ],
        }),
      ).ok,
    ).toBe(false);
  });

  it('never mines the summary for modality or taxonomy terms', () => {
    const normalized = normalizeCapabilityQuery(
      input({
        summary: 'No Redis; must use webhooks.',
        capabilityTerms: [
          { termId: 'term-family', originalTerm: 'authorization' },
        ],
      }),
      taxonomy(),
    );
    expect(normalized.ok).toBe(true);
    if (!normalized.ok) return;
    expect(normalized.value.primaryFamilyId).toBe('authorization');
    expect(normalized.value.normalizedConstraints).toEqual([]);
    expect(normalized.value.normalizedCapabilityConcepts).toHaveLength(1);
  });
});

describe('deterministic capability-query normalization', () => {
  it.each([
    ['Rate Limiting', 'rate-limiting'],
    ['web hook', 'webhooks'],
    ['AUTHORISATION', 'authorization'],
    ['cron scheduler', 'recurring-schedules'],
  ])('resolves accepted taxonomy terminology %s', (term, conceptId) => {
    const result = normalizeCapabilityQuery(
      input({
        capabilityTerms: [{ termId: 'term-family', originalTerm: term }],
      }),
      taxonomy(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.outcome).toBe('normalized');
    expect(result.value.normalizedCapabilityConcepts).toEqual([
      expect.objectContaining({ conceptId }),
    ]);
  });

  it.each(['job queue', 'worker queue', 'task queue'])(
    'retains every queue possibility for %s without order selection',
    (term) => {
      const result = normalizeCapabilityQuery(
        input({
          capabilityTerms: [{ termId: 'term-family', originalTerm: term }],
        }),
        taxonomy(),
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.outcome).toBe('clarification-required');
      expect(result.value.clarifications[0]).toMatchObject({
        reasonCode: 'adoption-unit-ambiguous',
        possibleConceptIds: [
          'broker-backed-job-queue',
          'database-backed-job-queue',
          'queue-worker-library',
        ],
      });
      expect(result.value.normalizedCapabilityConcepts).toEqual([]);
    },
  );

  it('distinguishes unsupported adjacent capability from subjective clarification', () => {
    const unsupported = normalizeCapabilityQuery(
      input({
        capabilityTerms: [
          { termId: 'term-family', originalTerm: 'authentication' },
        ],
      }),
      taxonomy(),
    );
    const subjective = normalizeCapabilityQuery(
      input({
        capabilityTerms: [
          { termId: 'term-family', originalTerm: 'lightweight' },
        ],
      }),
      taxonomy(),
    );
    expect(unsupported.ok && unsupported.value.outcome).toBe('unsupported');
    expect(subjective.ok && subjective.value.outcome).toBe(
      'clarification-required',
    );
  });

  it('supports a synthetic deprecated alias without rewriting source identity', () => {
    const active = taxonomy();
    const withDeprecated: CapabilityTaxonomy = {
      ...active,
      resolvedAliases: [
        ...active.resolvedAliases,
        {
          aliasKey: 'old-authorization',
          conceptId: 'authorization',
          status: 'deprecated',
          replacementAliasKey: 'authorization',
        },
      ],
    };
    const result = normalizeCapabilityQuery(
      input({
        capabilityTerms: [
          { termId: 'term-family', originalTerm: 'old authorization' },
        ],
      }),
      withDeprecated,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.outcome).toBe('normalized');
    expect(result.value.normalizedCapabilityConcepts[0]).toMatchObject({
      conceptId: 'authorization',
      sourceTermIds: ['term-family'],
      ruleId: 'taxonomy-deprecated-alias',
    });
    expect(result.value.notices).toEqual([
      expect.objectContaining({
        sourceIds: ['term-family'],
        replacementAliasKey: 'authorization',
      }),
    ]);
  });

  it('preserves modalities, merges identical declarations, and retains every source', () => {
    const result = normalizeCapabilityQuery(
      input({
        capabilityTerms: [
          { termId: 'term-family', originalTerm: 'rate limiting' },
        ],
        draftConstraints: [
          {
            constraintId: 'constraint-redis-a',
            modality: 'prohibited',
            statement: 'Do not require Redis.',
            originalTerm: 'Redis',
            facetHint: 'infrastructure',
            reasonCode: 'no-redis',
          },
          {
            constraintId: 'constraint-redis-b',
            modality: 'prohibited',
            statement: 'Redis is prohibited.',
            originalTerm: 'redis',
            facetHint: 'infrastructure',
            reasonCode: 'no-redis',
          },
          {
            constraintId: 'constraint-license',
            modality: 'required',
            statement: 'Use an approved license.',
            originalTerm: 'apache-2-0',
            facetHint: 'license',
            reasonCode: 'approved-license',
          },
        ],
      }),
      taxonomy(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.outcome).toBe('normalized');
    expect(result.value.normalizedConstraints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          modality: 'prohibited',
          conceptId: 'redis',
          sourceConstraintIds: ['constraint-redis-a', 'constraint-redis-b'],
          resolutionBasis: 'controlled-taxonomy',
        }),
        expect.objectContaining({
          modality: 'required',
          facet: 'license',
          conceptId: null,
          resolutionBasis: 'preserved-declaration',
        }),
      ]),
    );
    expect(result.value.preservedDeclarations).toHaveLength(3);
  });

  it('blocks hard unknowns and contradictions but discloses unknown preferences', () => {
    const hardUnknown = normalizeCapabilityQuery(
      input({
        draftConstraints: [
          {
            constraintId: 'constraint-hard',
            modality: 'required',
            statement: 'Require an exact feature.',
            originalTerm: 'unknown-feature',
            facetHint: 'feature',
            reasonCode: 'feature-required',
          },
        ],
      }),
      taxonomy(),
    );
    const preferredUnknown = normalizeCapabilityQuery(
      input({
        draftConstraints: [
          {
            constraintId: 'constraint-preferred',
            modality: 'preferred',
            statement: 'Prefer this feature.',
            originalTerm: 'unknown-feature',
            facetHint: 'feature',
            reasonCode: null,
          },
        ],
      }),
      taxonomy(),
    );
    const contradiction = normalizeCapabilityQuery(
      input({
        draftConstraints: [
          {
            constraintId: 'constraint-required',
            modality: 'required',
            statement: 'Require Redis.',
            originalTerm: 'redis',
            facetHint: 'infrastructure',
            reasonCode: 'redis-required',
          },
          {
            constraintId: 'constraint-prohibited',
            modality: 'prohibited',
            statement: 'Prohibit Redis.',
            originalTerm: 'redis',
            facetHint: 'infrastructure',
            reasonCode: 'redis-prohibited',
          },
        ],
      }),
      taxonomy(),
    );
    expect(hardUnknown.ok && hardUnknown.value.outcome).toBe(
      'clarification-required',
    );
    expect(preferredUnknown.ok && preferredUnknown.value.outcome).toBe(
      'normalized',
    );
    expect(
      preferredUnknown.ok && preferredUnknown.value.unresolvedTerms,
    ).toHaveLength(1);
    expect(contradiction.ok && contradiction.value.outcome).toBe(
      'clarification-required',
    );
    expect(
      contradiction.ok &&
        contradiction.value.normalizedConstraints.every(
          ({ resolutionBasis }) => resolutionBasis === 'contradiction',
        ),
    ).toBe(true);
  });

  it('requires a unique family and rejects cross-family explicit concepts', () => {
    const sharedOnly = normalizeCapabilityQuery(
      input({
        capabilityTerms: [{ termId: 'term-shared', originalTerm: 'retries' }],
      }),
      taxonomy(),
    );
    const crossed = normalizeCapabilityQuery(
      input({
        capabilityTerms: [
          { termId: 'term-auth', originalTerm: 'authorization' },
          { termId: 'term-webhooks', originalTerm: 'webhooks' },
        ],
      }),
      taxonomy(),
    );
    expect(sharedOnly.ok && sharedOnly.value.outcome).toBe(
      'clarification-required',
    );
    expect(sharedOnly.ok && sharedOnly.value.primaryFamilyId).toBeNull();
    expect(crossed.ok && crossed.value.outcome).toBe('clarification-required');
  });

  it('produces identical semantic output for input permutations', () => {
    const original = input({
      capabilityTerms: [
        { termId: 'term-family', originalTerm: 'background-jobs' },
        { termId: 'term-cron', originalTerm: 'cron scheduler' },
      ],
    });
    const reversed = {
      ...original,
      capabilityTerms: [...original.capabilityTerms].reverse(),
    };
    expect(normalizeCapabilityQuery(original, taxonomy())).toEqual(
      normalizeCapabilityQuery(reversed, taxonomy()),
    );
  });
});

describe('exact candidate-reference authority', () => {
  it('rejects collisions and enforces the candidate ceiling', () => {
    const base = candidateAuthority();
    const duplicate = {
      ...base,
      candidates: [
        ...base.candidates,
        { ...base.candidates[0]!, candidateId: 'auth-candidate-duplicate' },
      ],
    };
    expect(validateCandidateReferenceAuthority(duplicate).ok).toBe(false);

    const excessive = {
      ...base,
      candidates: Array.from(
        { length: CAPABILITY_QUERY_LIMITS.candidateAuthorityCandidates + 1 },
        (_, index) => ({
          ...base.candidates[0]!,
          candidateId: `candidate-${String(index)}`,
          candidateKey: `candidate-${String(index)}`,
          repositoryKey: `example/candidate-${String(index)}`,
        }),
      ),
    };
    expect(validateCandidateReferenceAuthority(excessive).ok).toBe(false);
  });

  it.each([
    ['candidate-id', 'auth-candidate-one'],
    ['repository', 'example/auth-one'],
    ['npm-package', '@example/auth-one'],
  ] as const)(
    'resolves exact %s references and binds authority',
    (kind, value) => {
      const result = normalizeCapabilityQuery(
        input({
          capabilityTerms: [{ termId: 'term-shared', originalTerm: 'redis' }],
          candidateReferences: [
            { referenceId: 'reference-one', kind, value, intent: 'compare' },
          ],
        }),
        taxonomy(),
        candidateAuthority(),
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.outcome).toBe('normalized');
      expect(result.value.primaryFamilyId).toBe('authorization');
      expect(result.value.resolvedCandidateReferences).toEqual([
        expect.objectContaining({
          referenceId: 'reference-one',
          candidateId: 'auth-candidate-one',
        }),
      ]);
      expect(result.value.candidateAuthorityUsed).toBe(true);
    },
  );

  it('fails closed for partial, display-name, unknown, and cross-family references', () => {
    const unknown = normalizeCapabilityQuery(
      input({
        candidateReferences: [
          {
            referenceId: 'reference-unknown',
            kind: 'repository',
            value: 'example/missing',
            intent: 'named-candidate',
          },
        ],
      }),
      taxonomy(),
      candidateAuthority(),
    );
    const crossed = normalizeCapabilityQuery(
      input({
        capabilityTerms: [{ termId: 'term-shared', originalTerm: 'redis' }],
        candidateReferences: [
          {
            referenceId: 'reference-auth',
            kind: 'candidate-id',
            value: 'auth-candidate-one',
            intent: 'compare',
          },
          {
            referenceId: 'reference-jobs',
            kind: 'candidate-id',
            value: 'jobs-candidate-one',
            intent: 'compare',
          },
        ],
      }),
      taxonomy(),
      candidateAuthority(),
    );
    expect(unknown.ok && unknown.value.outcome).toBe('clarification-required');
    expect(crossed.ok && crossed.value.outcome).toBe('clarification-required');
  });

  it('does not derive family or constraints from a repository fingerprint reference', () => {
    const result = normalizeCapabilityQuery(
      input({
        capabilityTerms: [{ termId: 'term-shared', originalTerm: 'redis' }],
        repositoryFingerprintReference: {
          fingerprintId: 'fingerprint-alpha',
          fingerprintDigest: 'b'.repeat(64),
        },
      }),
      taxonomy(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.outcome).toBe('clarification-required');
    expect(result.value.primaryFamilyId).toBeNull();
    expect(result.value.normalizedConstraints).toEqual([]);
  });
});
