import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  CAPABILITY_QUERY_LIMITS,
  type CandidateReferenceAuthority,
} from '@gitblocks/domain';

import {
  buildCapabilityTaxonomyV1,
  capabilityQueryInputDigest,
  capabilityQueryNormalizationSemanticDigest,
  getContractSchemaV1,
  normalizeCapabilityQueryV1,
  parseCapabilityQueryInputV1,
  parseCapabilityQueryNormalizationResultV1,
  serializeContractSchemaV1,
  validateCapabilityQueryNormalizationExchangeV1,
  type CapabilityQueryInputV1,
  type CapabilityQueryNormalizationResultV1,
  type CapabilityTaxonomyV1,
  type CapabilityTaxonomySourceV1,
} from '../src/index.ts';

const taxonomyPath = fileURLToPath(
  new URL(
    '../../../catalog/capability-taxonomy/1.0.0/manifest.json',
    import.meta.url,
  ),
);
const taxonomySourcePath = fileURLToPath(
  new URL(
    '../../../catalog/capability-taxonomy/1.0.0/source.json',
    import.meta.url,
  ),
);

const taxonomyFixture = readFile(taxonomyPath, 'utf8').then(
  (contents) => JSON.parse(contents) as CapabilityTaxonomyV1,
);
const taxonomySourceFixture = readFile(taxonomySourcePath, 'utf8').then(
  (contents) => JSON.parse(contents) as CapabilityTaxonomySourceV1,
);

async function taxonomy(): Promise<CapabilityTaxonomyV1> {
  return structuredClone(await taxonomyFixture);
}

async function taxonomySource(): Promise<CapabilityTaxonomySourceV1> {
  return structuredClone(await taxonomySourceFixture);
}

function input(
  overrides: Partial<CapabilityQueryInputV1> = {},
): CapabilityQueryInputV1 {
  return {
    contractVersion: '1.0.0',
    queryInputId: 'query-alpha',
    scope: 'local-pre-approval',
    summary: 'Choose a rate-limiting capability.',
    capabilityTerms: [{ termId: 'term-family', originalTerm: 'Rate Limiting' }],
    successConditions: [
      {
        conditionId: 'condition-quota',
        statement: 'The selected approach enforces request quotas.',
      },
    ],
    draftConstraints: [],
    candidateReferences: [],
    repositoryFingerprintReference: null,
    ...overrides,
  };
}

function candidateAuthority(
  digest = 'a'.repeat(64),
): CandidateReferenceAuthority {
  return {
    catalogVersion: 'public-v1',
    catalogDigest: digest,
    candidates: [
      {
        candidateId: 'auth-candidate-one',
        capabilityFamily: 'authorization',
        repositoryKey: 'example/auth-one',
        npmPackageKey: '@example/auth-one',
      },
      {
        candidateId: 'auth-candidate-two',
        capabilityFamily: 'authorization',
        repositoryKey: 'example/auth-two',
        npmPackageKey: null,
      },
      {
        candidateId: 'jobs-candidate-one',
        capabilityFamily: 'background-jobs',
        repositoryKey: 'example/jobs-one',
        npmPackageKey: 'jobs-one',
      },
    ],
  };
}

async function normalize(
  value: CapabilityQueryInputV1 = input(),
  authority?: CandidateReferenceAuthority,
): Promise<CapabilityQueryNormalizationResultV1> {
  const result = normalizeCapabilityQueryV1(value, await taxonomy(), authority);
  if (!result.ok) throw new Error('Test query must normalize.');
  return result.value;
}

function clone<Value>(value: Value): Value {
  return structuredClone(value);
}

function withRecomputedNormalizationIdentity(
  value: CapabilityQueryNormalizationResultV1,
): CapabilityQueryNormalizationResultV1 {
  const semanticDigest = capabilityQueryNormalizationSemanticDigest(value);
  return {
    ...value,
    normalizationId: `normalization-${semanticDigest.slice(0, 48)}`,
    semanticDigest,
  };
}

describe('CapabilityQueryInputV1', () => {
  it('parses the minimum and maximum bounded local input without mutation', () => {
    const minimum = input();
    const before = clone(minimum);
    expect(parseCapabilityQueryInputV1(minimum)).toMatchObject({ ok: true });
    expect(minimum).toEqual(before);

    const maximum = input({
      summary: 'x'.repeat(1_000),
      capabilityTerms: Array.from({ length: 8 }, (_, index) => ({
        termId: `term-${String(index)}`,
        originalTerm: 'x'.repeat(120),
      })),
      successConditions: Array.from({ length: 20 }, (_, index) => ({
        conditionId: `condition-${String(index)}`,
        statement: 'x'.repeat(500),
      })),
      draftConstraints: Array.from({ length: 32 }, (_, index) => ({
        constraintId: `constraint-${String(index)}`,
        modality: 'preferred' as const,
        statement: 'x'.repeat(500),
        originalTerm: 'x'.repeat(120),
        facetHint: 'other' as const,
        reasonCode: null,
      })),
      candidateReferences: Array.from({ length: 10 }, (_, index) => ({
        referenceId: `reference-${String(index)}`,
        kind: 'candidate-id' as const,
        value: `candidate-${String(index)}`,
        intent: 'compare' as const,
      })),
    });
    expect(parseCapabilityQueryInputV1(maximum)).toMatchObject({ ok: true });
  });

  it.each([
    { ...input(), contractVersion: '1.0.1' },
    { ...input(), scope: 'approved' },
    { ...input(), unknown: true },
    { ...input(), capabilityTerms: [] },
    {
      ...input(),
      capabilityTerms: Array.from({ length: 9 }, (_, index) => ({
        termId: `term-${String(index)}`,
        originalTerm: 'webhooks',
      })),
    },
    { ...input(), summary: 'x'.repeat(1_001) },
    { ...input(), queryInputId: 123 },
    {
      ...input(),
      candidateReferences: [
        {
          referenceId: 'reference-url',
          kind: 'repository',
          value: 'https://github.com/example/repo',
          intent: 'compare',
        },
      ],
    },
    {
      ...input(),
      draftConstraints: [
        {
          constraintId: 'constraint-hard',
          modality: 'required',
          statement: 'Require Redis.',
          originalTerm: 'redis',
          facetHint: 'infrastructure',
          reasonCode: null,
        },
      ],
    },
  ])(
    'rejects closed, version, bounds, URL, and hard-reason violations',
    (value) => {
      expect(parseCapabilityQueryInputV1(value).ok).toBe(false);
    },
  );

  it('rejects accessors, exotic prototypes, cycles, sparse arrays, and prototype keys safely', () => {
    const accessor = input() as CapabilityQueryInputV1 & { hostile?: unknown };
    Object.defineProperty(accessor, 'hostile', {
      enumerable: true,
      get: () => {
        throw new Error('must remain value-safe');
      },
    });
    expect(parseCapabilityQueryInputV1(accessor)).toMatchObject({
      ok: false,
      issues: [{ code: 'contract.input-shape' }],
    });

    const exotic: unknown = Object.setPrototypeOf(
      { ...input() },
      { inherited: true },
    );
    expect(parseCapabilityQueryInputV1(exotic).ok).toBe(false);

    const cyclic = input() as CapabilityQueryInputV1 & { cycle?: unknown };
    cyclic.cycle = cyclic;
    expect(parseCapabilityQueryInputV1(cyclic).ok).toBe(false);

    const sparse = input();
    sparse.capabilityTerms = Array(1) as never;
    expect(parseCapabilityQueryInputV1(sparse).ok).toBe(false);

    const polluted = JSON.parse(
      `${JSON.stringify(input()).slice(0, -1)},"__proto__":{"polluted":true}}`,
    ) as unknown;
    expect(parseCapabilityQueryInputV1(polluted).ok).toBe(false);
    expect(Reflect.get(Object.prototype, 'polluted')).toBeUndefined();
  });

  it('canonicalizes unordered records for a stable complete-input digest', () => {
    const original = input({
      capabilityTerms: [
        { termId: 'term-z', originalTerm: 'rate limiting' },
        { termId: 'term-a', originalTerm: 'token bucket' },
      ],
    });
    const reversed = {
      ...original,
      capabilityTerms: [...original.capabilityTerms].reverse(),
    };
    expect(capabilityQueryInputDigest(original)).toBe(
      capabilityQueryInputDigest(reversed),
    );
    expect(
      capabilityQueryInputDigest({ ...original, summary: 'Changed summary.' }),
    ).not.toBe(capabilityQueryInputDigest(original));
  });
});

describe('CapabilityQueryNormalizationResultV1', () => {
  it.each([
    ['Rate Limiting', 'normalized'],
    ['job queue', 'clarification-required'],
    ['authentication', 'unsupported'],
  ] as const)('produces and parses the %s outcome', async (term, outcome) => {
    const result = await normalize(
      input({
        capabilityTerms: [{ termId: 'term-family', originalTerm: term }],
      }),
    );
    expect(result).toMatchObject({
      contractVersion: '1.0.0',
      scope: 'local-pre-approval',
      outcome,
      taxonomyVersion: '1.0.0',
      taxonomySemanticDigest:
        '838fa85b2e6937866854b6f733fe7045cf49d5f811cb5e4a8d503bfbd76a61c9',
      normalizerVersion: '1.0.0',
    });
    expect(parseCapabilityQueryNormalizationResultV1(result)).toMatchObject({
      ok: true,
    });
  });

  it('preserves exact modalities and never parses summary prose', async () => {
    const result = await normalize(
      input({
        summary: 'No Redis. Prefer a webhook product.',
        draftConstraints: [
          {
            constraintId: 'constraint-redis',
            modality: 'prohibited',
            statement: 'Do not require Redis.',
            originalTerm: 'Redis',
            facetHint: 'infrastructure',
            reasonCode: 'no-redis',
          },
        ],
      }),
    );
    expect(result.normalizedConstraints).toEqual([
      expect.objectContaining({
        modality: 'prohibited',
        conceptId: 'redis',
        sourceConstraintIds: ['constraint-redis'],
      }),
    ]);
    expect(result.normalizedCapabilityConcepts).toHaveLength(1);
  });

  it.each([
    ['web hook', 'webhooks'],
    ['AUTHORISATION', 'authorization'],
    ['cron scheduler', 'recurring-schedules'],
    ['audit log router', 'audit-pipeline-router'],
  ] as const)(
    'uses accepted exact taxonomy alias %s',
    async (term, conceptId) => {
      const result = await normalize(
        input({
          capabilityTerms: [{ termId: 'term-family', originalTerm: term }],
        }),
      );
      expect(result.outcome).toBe('normalized');
      expect(result.normalizedCapabilityConcepts).toEqual([
        expect.objectContaining({ conceptId }),
      ]);
      expect(result.notices).toEqual([]);
    },
  );

  it.each([
    'job queue',
    'worker queue',
    'task queue',
    'hosted service',
    'policy engine',
    'throttling',
    'webhook platform',
  ])(
    'turns accepted intentional ambiguity %s into clarification',
    async (term) => {
      const result = await normalize(
        input({
          capabilityTerms: [{ termId: 'term-family', originalTerm: term }],
        }),
      );
      expect(result.outcome).toBe('clarification-required');
      expect(result.clarifications.length).toBeGreaterThan(0);
      expect(result.normalizedCapabilityConcepts).toEqual([]);
    },
  );

  it('retains all three queue architectures without declaration-order selection', async () => {
    for (const term of ['job queue', 'worker queue', 'task queue']) {
      const result = await normalize(
        input({
          capabilityTerms: [{ termId: 'term-family', originalTerm: term }],
        }),
      );
      expect(result.clarifications).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            possibleConceptIds: [
              'broker-backed-job-queue',
              'database-backed-job-queue',
              'queue-worker-library',
            ],
          }),
        ]),
      );
    }
  });

  it('keeps adjacent and subjective terms out of favorable resolution', async () => {
    const logRouter = await normalize(
      input({
        capabilityTerms: [
          { termId: 'term-family', originalTerm: 'log router' },
        ],
      }),
    );
    const lightweight = await normalize(
      input({
        capabilityTerms: [
          { termId: 'term-family', originalTerm: 'lightweight' },
        ],
      }),
    );
    const unsupportedCharacters = await normalize(
      input({
        capabilityTerms: [
          { termId: 'term-family', originalTerm: 'rate/limiting' },
        ],
      }),
    );
    expect(logRouter.outcome).toBe('unsupported');
    expect(logRouter.normalizedCapabilityConcepts).toEqual([]);
    expect(lightweight.outcome).toBe('clarification-required');
    expect(unsupportedCharacters.outcome).toBe('clarification-required');
  });

  it.each([
    ['authorization', 'authentication'],
    ['webhooks', 'generic-http-client'],
    ['audit-logging', 'generic-log-formatting'],
    ['background-jobs', 'promise-concurrency'],
    ['webhooks', 'broad-sdk-with-incidental-webhooks'],
  ])(
    'requires clarification when supported %s is mixed with excluded %s',
    async (family, excludedTerm) => {
      const result = await normalize(
        input({
          capabilityTerms: [
            { termId: 'term-family', originalTerm: family },
            { termId: 'term-excluded', originalTerm: excludedTerm },
          ],
        }),
      );
      expect(result.outcome).toBe('clarification-required');
      expect(result.unresolvedTerms).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            sourceIds: ['term-excluded'],
            blocking: true,
          }),
        ]),
      );
      expect(result.clarifications).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ sourceIds: ['term-excluded'] }),
        ]),
      );
    },
  );

  it('requires clarification for an unclear hard self-hosting declaration', async () => {
    const result = await normalize(
      input({
        draftConstraints: [
          {
            constraintId: 'constraint-self-hosting',
            modality: 'required',
            statement: 'Require self hosting.',
            originalTerm: 'self hosting',
            facetHint: 'deployment',
            reasonCode: 'self-hosting-required',
          },
        ],
      }),
    );
    expect(result.outcome).toBe('clarification-required');
    expect(result.unresolvedTerms).toEqual([
      expect.objectContaining({
        sourceIds: ['constraint-self-hosting'],
        blocking: true,
      }),
    ]);
  });

  it('binds candidate authority only when exact candidate references are used', async () => {
    const taxonomyAuthority = await taxonomy();
    const withoutReferences = normalizeCapabilityQueryV1(
      input(),
      taxonomyAuthority,
      candidateAuthority(),
    );
    const withReferencesInput = input({
      capabilityTerms: [{ termId: 'term-family', originalTerm: 'redis' }],
      candidateReferences: [
        {
          referenceId: 'reference-auth',
          kind: 'repository',
          value: 'example/auth-one',
          intent: 'compare',
        },
      ],
    });
    const first = normalizeCapabilityQueryV1(
      withReferencesInput,
      taxonomyAuthority,
      candidateAuthority(),
    );
    const changed = normalizeCapabilityQueryV1(
      withReferencesInput,
      taxonomyAuthority,
      candidateAuthority('b'.repeat(64)),
    );
    expect(
      withoutReferences.ok && withoutReferences.value.candidateCatalogBinding,
    ).toBeNull();
    const withoutReferencesChanged = normalizeCapabilityQueryV1(
      input(),
      taxonomyAuthority,
      candidateAuthority('b'.repeat(64)),
    );
    expect(
      withoutReferences.ok &&
        withoutReferencesChanged.ok &&
        withoutReferences.value.semanticDigest,
    ).toBe(
      withoutReferencesChanged.ok
        ? withoutReferencesChanged.value.semanticDigest
        : '',
    );
    expect(first.ok && first.value.candidateCatalogBinding).toEqual({
      catalogVersion: 'public-v1',
      catalogDigest: 'a'.repeat(64),
    });
    expect(first.ok && changed.ok && first.value.semanticDigest).not.toBe(
      changed.ok ? changed.value.semanticDigest : '',
    );
  });

  it('does not let candidate references override an explicit family', async () => {
    const result = normalizeCapabilityQueryV1(
      input({
        capabilityTerms: [
          { termId: 'term-family', originalTerm: 'authorization' },
        ],
        candidateReferences: [
          {
            referenceId: 'reference-jobs',
            kind: 'candidate-id',
            value: 'jobs-candidate-one',
            intent: 'compare',
          },
        ],
      }),
      await taxonomy(),
      candidateAuthority(),
    );
    expect(result.ok && result.value.outcome).toBe('clarification-required');
    expect(result.ok && result.value.primaryFamilyId).toBeNull();
  });

  it('preserves only the fingerprint identity and derives no fact or family from it', async () => {
    const result = await normalize(
      input({
        repositoryFingerprintReference: {
          fingerprintId: 'fingerprint-alpha',
          fingerprintDigest: 'c'.repeat(64),
        },
      }),
    );
    expect(result.repositoryFingerprintReference).toEqual({
      fingerprintId: 'fingerprint-alpha',
      fingerprintDigest: 'c'.repeat(64),
    });
    expect(JSON.stringify(result)).not.toContain('facts');
  });

  it('derives one stable normalization ID from the complete semantic digest', async () => {
    const first = await normalize();
    const second = await normalize();
    expect(second).toEqual(first);
    expect(first.normalizationId).toBe(
      `normalization-${first.semanticDigest.slice(0, 48)}`,
    );
    expect(capabilityQueryNormalizationSemanticDigest(first)).toBe(
      first.semanticDigest,
    );
    expect(Object.keys(first)).not.toContain('recordDigest');
    expect(JSON.stringify(first)).not.toContain('timestamp');
  });

  it('binds the exact taxonomy digest into semantic identity', async () => {
    const source = await taxonomySource();
    const changedTaxonomy = buildCapabilityTaxonomyV1({
      ...source,
      concepts: source.concepts.map((concept, index) =>
        index === 0
          ? {
              ...concept,
              definition: `${concept.definition} Exact query scope.`,
            }
          : concept,
      ),
    });
    const original = normalizeCapabilityQueryV1(input(), await taxonomy());
    const changed = normalizeCapabilityQueryV1(input(), changedTaxonomy);
    expect(original.ok && changed.ok).toBe(true);
    expect(original.ok && changed.ok && original.value.semanticDigest).not.toBe(
      changed.ok ? changed.value.semanticDigest : '',
    );
  });

  it('rejects unknown fields, wrong versions, malformed IDs, and digest drift', async () => {
    const result = await normalize();
    for (const invalid of [
      { ...result, extra: true },
      { ...result, contractVersion: '1.0.1' },
      { ...result, normalizationId: 'Invalid_ID' },
      { ...result, semanticDigest: '0'.repeat(64) },
      {
        ...result,
        normalizationSteps: Array.from({ length: 65 }, (_, index) => ({
          ...result.normalizationSteps[0]!,
          stepId: `step-extra-${String(index)}`,
        })),
      },
    ]) {
      expect(parseCapabilityQueryNormalizationResultV1(invalid).ok).toBe(false);
    }
  });

  it('represents the derived maximum of 50 independently unresolved sources', async () => {
    const maximum = input({
      capabilityTerms: Array.from(
        { length: CAPABILITY_QUERY_LIMITS.capabilityTerms },
        (_, index) => ({
          termId: `term-${String(index).padStart(2, '0')}`,
          originalTerm: `unknown-capability-${String(index)}`,
        }),
      ),
      draftConstraints: Array.from(
        { length: CAPABILITY_QUERY_LIMITS.draftConstraints },
        (_, index) => ({
          constraintId: `constraint-${String(index).padStart(2, '0')}`,
          modality:
            index % 2 === 0 ? ('required' as const) : ('prohibited' as const),
          statement: `Hard unknown constraint ${String(index)}.`,
          originalTerm: `unknown-feature-${String(index)}`,
          facetHint: 'feature' as const,
          reasonCode: `hard-reason-${String(index)}`,
        }),
      ),
      candidateReferences: Array.from(
        { length: CAPABILITY_QUERY_LIMITS.candidateReferences },
        (_, index) => ({
          referenceId: `reference-${String(index).padStart(2, '0')}`,
          kind: 'candidate-id' as const,
          value: `unknown-candidate-${String(index)}`,
          intent: 'compare' as const,
        }),
      ),
    });
    const first = normalizeCapabilityQueryV1(maximum, await taxonomy());
    const second = normalizeCapabilityQueryV1(maximum, await taxonomy());
    expect(first.ok).toBe(true);
    expect(second).toEqual(first);
    if (!first.ok) return;
    expect(first.value.outcome).toBe('clarification-required');
    expect(first.value.unresolvedTerms).toHaveLength(50);
    expect(first.value.normalizationSteps.length).toBeLessThanOrEqual(
      CAPABILITY_QUERY_LIMITS.normalizationSteps,
    );
    expect(first.value.clarifications.length).toBeLessThanOrEqual(
      CAPABILITY_QUERY_LIMITS.clarifications,
    );
    expect(parseCapabilityQueryNormalizationResultV1(first.value).ok).toBe(
      true,
    );
  });

  it('rejects correctly digested but semantically impossible standalone results', async () => {
    const normalized = await normalize();
    const withConstraint = await normalize(
      input({
        draftConstraints: [
          {
            constraintId: 'constraint-redis',
            modality: 'required',
            statement: 'Require Redis.',
            originalTerm: 'redis',
            facetHint: 'infrastructure',
            reasonCode: 'redis-required',
          },
        ],
      }),
    );
    const withCandidate = await normalize(
      input({
        capabilityTerms: [{ termId: 'term-shared', originalTerm: 'redis' }],
        candidateReferences: [
          {
            referenceId: 'reference-auth',
            kind: 'candidate-id',
            value: 'auth-candidate-one',
            intent: 'compare',
          },
        ],
      }),
      candidateAuthority(),
    );
    const [firstSourceStep, secondSourceStep, ...remainingSteps] =
      withConstraint.normalizationSteps;
    if (firstSourceStep === undefined || secondSourceStep === undefined) {
      throw new Error('Test result must contain two source steps.');
    }
    const noncanonicalSteps = [
      secondSourceStep,
      firstSourceStep,
      ...remainingSteps,
    ].map((step, index) => ({
      ...step,
      stepId: `step-${String(index + 1).padStart(3, '0')}`,
    }));
    const forgeries = [
      { ...normalized, primaryFamilyId: null },
      {
        ...normalized,
        unresolvedTerms: [
          {
            unresolvedId: 'unresolved-001',
            sourceKind: 'capability-term' as const,
            sourceIds: ['term-family'],
            canonicalTerm: 'unknown-capability',
            reasonCode: 'unknown-primary-capability',
            blocking: true,
          },
        ],
      },
      {
        ...normalized,
        clarifications: [
          {
            clarificationId: 'clarification-001',
            reasonCode: 'invented-clarification',
            sourceIds: ['term-family'],
            possibleConceptIds: [],
            context: 'This clarification contradicts normalized outcome.',
          },
        ],
      },
      { ...normalized, outcome: 'clarification-required' as const },
      {
        ...withCandidate,
        outcome: 'unsupported' as const,
        primaryFamilyId: null,
      },
      {
        ...withConstraint,
        normalizedConstraints: withConstraint.normalizedConstraints.map(
          (constraint) => ({ ...constraint, conceptId: null }),
        ),
      },
      { ...withCandidate, candidateCatalogBinding: null },
      {
        ...normalized,
        normalizationSteps: [...normalized.normalizationSteps].reverse(),
      },
      { ...withConstraint, normalizationSteps: noncanonicalSteps },
    ].map((forgery) => withRecomputedNormalizationIdentity(forgery));
    for (const [index, forgery] of forgeries.entries()) {
      expect(
        parseCapabilityQueryNormalizationResultV1(forgery).ok,
        `forgery ${String(index + 1)} must fail closed`,
      ).toBe(false);
    }

    for (const genuine of [
      normalized,
      await normalize(
        input({
          capabilityTerms: [
            { termId: 'term-family', originalTerm: 'job queue' },
          ],
        }),
      ),
      await normalize(
        input({
          capabilityTerms: [
            { termId: 'term-family', originalTerm: 'authentication' },
          ],
        }),
      ),
    ]) {
      expect(parseCapabilityQueryNormalizationResultV1(genuine).ok).toBe(true);
    }
  });
});

describe('capability-query normalization exchange closure', () => {
  it('accepts canonical contradiction pairs and rejects re-digested missing or split pairs', async () => {
    const taxonomyAuthority = await taxonomy();
    const query = input({
      draftConstraints: [
        {
          constraintId: 'constraint-prohibited',
          modality: 'prohibited',
          statement: 'Do not require Redis.',
          originalTerm: 'redis',
          facetHint: 'infrastructure',
          reasonCode: 'redis-prohibited',
        },
        {
          constraintId: 'constraint-required',
          modality: 'required',
          statement: 'Require Redis.',
          originalTerm: 'redis',
          facetHint: 'infrastructure',
          reasonCode: 'redis-required',
        },
      ],
    });
    const created = normalizeCapabilityQueryV1(query, taxonomyAuthority);
    expect(created).toMatchObject({ ok: true });
    if (!created.ok) return;
    expect(created.value.outcome).toBe('clarification-required');
    expect(
      created.value.normalizedConstraints.map(
        ({ modality, resolutionBasis, ruleId }) => ({
          modality,
          resolutionBasis,
          ruleId,
        }),
      ),
    ).toEqual([
      {
        modality: 'prohibited',
        resolutionBasis: 'contradiction',
        ruleId: 'constraint-modality-conflict',
      },
      {
        modality: 'required',
        resolutionBasis: 'contradiction',
        ruleId: 'constraint-modality-conflict',
      },
    ]);
    expect(
      parseCapabilityQueryNormalizationResultV1(created.value),
    ).toMatchObject({ ok: true });
    expect(
      validateCapabilityQueryNormalizationExchangeV1(
        query,
        created.value,
        taxonomyAuthority,
      ),
    ).toEqual({ ok: true, issues: [] });

    for (const removedModality of ['required', 'prohibited'] as const) {
      const forged = withRecomputedNormalizationIdentity({
        ...created.value,
        normalizedConstraints: created.value.normalizedConstraints.filter(
          ({ modality }) => modality !== removedModality,
        ),
      });
      const parsed = parseCapabilityQueryNormalizationResultV1(forged);
      expect(parsed.ok).toBe(false);
      if (!parsed.ok) {
        expect(
          parsed.issues.some(({ path }) =>
            path.includes('normalizedConstraints'),
          ),
        ).toBe(true);
      }
    }

    for (const change of [
      { conceptId: 'token-bucket', canonicalTerm: 'token-bucket' },
      { facet: 'feature' as const },
    ]) {
      const forged = withRecomputedNormalizationIdentity({
        ...created.value,
        normalizedConstraints: created.value.normalizedConstraints.map(
          (constraint) =>
            constraint.modality === 'prohibited'
              ? { ...constraint, ...change }
              : constraint,
        ),
      });
      expect(parseCapabilityQueryNormalizationResultV1(forged).ok).toBe(false);
    }
  });

  it('reproduces the exact exchange and rejects source, modality, outcome, and authority drift', async () => {
    const taxonomyAuthority = await taxonomy();
    const query = input({
      draftConstraints: [
        {
          constraintId: 'constraint-redis',
          modality: 'prohibited',
          statement: 'Do not require Redis.',
          originalTerm: 'redis',
          facetHint: 'infrastructure',
          reasonCode: 'no-redis',
        },
      ],
    });
    const created = normalizeCapabilityQueryV1(query, taxonomyAuthority);
    if (!created.ok) throw new Error('Test exchange must normalize.');
    expect(
      validateCapabilityQueryNormalizationExchangeV1(
        query,
        created.value,
        taxonomyAuthority,
      ),
    ).toEqual({ ok: true, issues: [] });

    const changes: CapabilityQueryNormalizationResultV1[] = [
      { ...created.value, queryInputId: 'query-other' },
      { ...created.value, outcome: 'unsupported' },
      {
        ...created.value,
        normalizedConstraints: created.value.normalizedConstraints.map(
          (constraint) => ({ ...constraint, modality: 'preferred' }),
        ),
      },
      {
        ...created.value,
        clarifications: [
          ...created.value.clarifications,
          {
            clarificationId: 'clarification-invented',
            reasonCode: 'invented',
            sourceIds: ['term-family'],
            possibleConceptIds: [],
            context: 'Invented clarification.',
          },
        ],
      },
    ];
    for (const changed of changes) {
      expect(
        validateCapabilityQueryNormalizationExchangeV1(
          query,
          changed,
          taxonomyAuthority,
        ).ok,
      ).toBe(false);
    }
  });

  it('detects cross-input references and catalog-digest changes', async () => {
    const taxonomyAuthority = await taxonomy();
    const query = input({
      capabilityTerms: [{ termId: 'term-shared', originalTerm: 'redis' }],
      candidateReferences: [
        {
          referenceId: 'reference-auth',
          kind: 'candidate-id',
          value: 'auth-candidate-one',
          intent: 'compare',
        },
      ],
    });
    const created = normalizeCapabilityQueryV1(
      query,
      taxonomyAuthority,
      candidateAuthority(),
    );
    if (!created.ok) throw new Error('Test exchange must normalize.');
    expect(
      validateCapabilityQueryNormalizationExchangeV1(
        { ...query, queryInputId: 'query-other' },
        created.value,
        taxonomyAuthority,
        candidateAuthority(),
      ).ok,
    ).toBe(false);
    expect(
      validateCapabilityQueryNormalizationExchangeV1(
        query,
        created.value,
        taxonomyAuthority,
        candidateAuthority('b'.repeat(64)),
      ).ok,
    ).toBe(false);
  });
});

describe('additive query schemas', () => {
  it('exports deterministic closed roots without changing taxonomy schema artifacts', () => {
    for (const name of [
      'capability-query-input',
      'capability-query-normalization-result',
    ] as const) {
      const schema = getContractSchemaV1(name);
      expect(JSON.stringify(schema)).not.toContain('"default"');
      expect(serializeContractSchemaV1(name)).toBe(
        `${JSON.stringify(schema, null, 2)}\n`,
      );
    }
    expect(
      createHash('sha256')
        .update(serializeContractSchemaV1('capability-taxonomy'))
        .digest('hex'),
    ).toBe('d8d4c875fc38696e6ead9dcc2821e04754135aa4af71f0fb85198a98187d3f70');
    expect(
      createHash('sha256')
        .update(serializeContractSchemaV1('capability-taxonomy-source'))
        .digest('hex'),
    ).toBe('357f34187ff26ea70c663f6009b07841b8045493ad54d2393713f7329a9e7933');
  });
});
