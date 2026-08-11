import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import {
  CANDIDATE_AUTHORITY_EXTRACTION_ELIGIBLE_COUNT,
  CANDIDATE_AUTHORITY_FULL_CLOSURE_COUNT,
  extractComposeServiceFact,
  extractPackageDependencyFacts,
  extractPackageEcosystemFact,
  extractPublishedPackageAdoptionFact,
  parseCandidateAuthorityFieldPlanV2,
  parseCandidateAuthorityReadinessPolicyV2,
  parseCandidateAuthoritySourcePolicyV2,
  qualifiesDeterministicExtraction,
} from '../src/index.ts';

const ROOT = new URL('../../../', import.meta.url);

async function authorities() {
  const policy = parseCandidateAuthorityReadinessPolicyV2(
    JSON.parse(
      await readFile(
        new URL(
          'catalog/public-v1/candidate-authority-readiness-policy.json',
          ROOT,
        ),
        'utf8',
      ),
    ) as unknown,
  );
  const plan = parseCandidateAuthorityFieldPlanV2(
    JSON.parse(
      await readFile(
        new URL(
          'catalog/public-v1/candidate-authority-field-plan-v2.json',
          ROOT,
        ),
        'utf8',
      ),
    ) as unknown,
    policy,
  );
  const sourcePolicy = parseCandidateAuthoritySourcePolicyV2(
    JSON.parse(
      await readFile(
        new URL(
          'catalog/public-v1/candidate-authority-source-policy-v2.json',
          ROOT,
        ),
        'utf8',
      ),
    ) as unknown,
    plan,
  );
  return { policy, plan, sourcePolicy };
}

describe('candidate-authority readiness correction', () => {
  it('separates extraction-path eligibility from full closure while preserving the gate', async () => {
    const { plan } = await authorities();
    expect(plan.frozenGate).toEqual({
      denominatorSize: 18,
      minimumEligibleFields: 13,
      exactPercentage: 72.222222,
      minimumEligibleFieldPerBreadthGroup: 1,
    });
    expect(
      plan.fields.filter((field) => field.deterministicExtractionEligible),
    ).toHaveLength(CANDIDATE_AUTHORITY_EXTRACTION_ELIGIBLE_COUNT);
    expect(
      plan.fields.filter((field) => field.deterministicFullClosureCandidate),
    ).toHaveLength(CANDIDATE_AUTHORITY_FULL_CLOSURE_COUNT);
    expect(
      CANDIDATE_AUTHORITY_EXTRACTION_ELIGIBLE_COUNT,
    ).toBeGreaterThanOrEqual(plan.frozenGate.minimumEligibleFields);
    expect(CANDIDATE_AUTHORITY_FULL_CLOSURE_COUNT).toBe(6);
    expect(plan.goDecision).toBe('go-pending-independent-review');
  });

  it('uses extraction paths for all four breadth groups', async () => {
    const { plan, policy } = await authorities();
    for (const breadthGroup of Object.keys(policy.breadthGroups)) {
      expect(
        plan.fields.some(
          (field) =>
            field.breadthGroup === breadthGroup &&
            field.deterministicExtractionEligible,
        ),
      ).toBe(true);
    }
  });

  it('qualifies a partial deterministic extractor but rejects always-unknown, human, and model generation', async () => {
    const { plan } = await authorities();
    const partial = plan.fields.find(
      (field) => field.fieldId === 'adoption-unit-type',
    );
    if (partial === undefined) throw new Error('fixture field missing');
    expect(partial.deterministicFullClosureCandidate).toBe(false);
    expect(qualifiesDeterministicExtraction(partial)).toBe(true);
    expect(
      qualifiesDeterministicExtraction({
        ...partial,
        canEmitMeaningfulNonUnknownFact: false,
        positiveFacts: [],
      }),
    ).toBe(false);
    for (const generationOrigin of [
      'human-reviewed',
      'model-derived',
    ] as const) {
      expect(
        qualifiesDeterministicExtraction({
          ...partial,
          generationOrigin,
        }),
      ).toBe(false);
    }
  });

  it('derives eligibility from plan semantics without candidate values or coverage', async () => {
    const { plan } = await authorities();
    for (const field of plan.fields) {
      expect(field).not.toHaveProperty('candidateValues');
      expect(field).not.toHaveProperty('coverage');
      expect(field.deterministicExtractionEligible).toBe(
        qualifiesDeterministicExtraction(field),
      );
    }
  });

  it('keeps human and model cells outside the deterministic numerator', async () => {
    const { policy } = await authorities();
    expect(policy.numeratorExclusions).toContain(
      'human-reviewed structured values',
    );
    expect(policy.numeratorExclusions).toContain('model-derived values');
    expect(policy.perCellOrigins).toContain('human-reviewed-structured');
    expect(policy.perCellOrigins).toContain('model-derived');
  });

  it('binds the revised bounded request budget without authorization', async () => {
    const { sourcePolicy } = await authorities();
    expect(sourcePolicy.requestBudget).toEqual({
      candidateCount: 150,
      mappedPackageCount: 80,
      githubLogicalRequests: 1510,
      npmLogicalRequests: 80,
      totalLogicalRequests: 1590,
      githubWorstCaseAttempts: 4530,
      npmWorstCaseAttempts: 240,
      totalWorstCaseAttempts: 4770,
    });
    expect(Object.values(sourcePolicy.authorization)).toEqual(
      Array.from({ length: 6 }, () => false),
    );
  });

  it('keeps accepted ranking authorities bound to their accepted semantic digests', async () => {
    const review = JSON.parse(
      await readFile(
        new URL('evals/ranking-v1/reviews/accepted-review-record.json', ROOT),
        'utf8',
      ),
    ) as { semanticDigest: string };
    const gates = JSON.parse(
      await readFile(
        new URL('evals/ranking-v1/gates/accepted-gates.json', ROOT),
        'utf8',
      ),
    ) as { semanticDigest: string };
    expect(review.semanticDigest).toBe(
      '18ba16b1266423fc18d3c8ffc2b39c2d399453ed0f24bc5e89c9d4f967a42cef',
    );
    expect(gates.semanticDigest).toBe(
      'b44de7aaf3fc997c10c31739862836f6f1a05fe1f80b1a19bc53c4dec7084460',
    );
  });
});

describe('positive-only partial extraction rules', () => {
  it('proves exact package adoption and ecosystem facts without excluding other forms', () => {
    expect(
      extractPublishedPackageAdoptionFact({
        catalogPackageName: '@example/tool',
        sourcePackageName: '@example/tool',
        selectedVersion: '1.2.3',
        sourceComplete: true,
      }),
    ).toEqual({
      state: 'established-facts',
      facts: [
        {
          factCode: 'published-installable-package',
          factValue: '@example/tool@1.2.3',
        },
      ],
    });
    expect(
      extractPackageEcosystemFact({
        packageName: '@example/tool',
        selectedVersion: '1.2.3',
        sourceComplete: true,
      }).state,
    ).toBe('established-facts');
    expect(
      extractPublishedPackageAdoptionFact({
        catalogPackageName: null,
        sourcePackageName: null,
        selectedVersion: null,
        sourceComplete: true,
      }),
    ).toEqual({ state: 'unknown', reason: 'no-catalog-package-mapping' });
  });

  it('emits controlled dependency positives and treats omission or incomplete source as unknown', () => {
    const result = extractPackageDependencyFacts({
      dependencies: { fastify: '^5.0.0', pg: '^9.0.0' },
      peerDependencies: null,
      sourceComplete: true,
    });
    expect(result.state).toBe('established-facts');
    if (result.state === 'established-facts') {
      expect(result.facts.map((fact) => fact.factCode)).toEqual([
        'declared-datastore-runtime-dependency',
        'declared-framework-compatibility-dependency',
      ]);
    }
    expect(
      extractPackageDependencyFacts({
        dependencies: {},
        peerDependencies: {},
        sourceComplete: true,
      }),
    ).toEqual({
      state: 'unknown',
      reason: 'no-controlled-positive-dependency-fact',
    });
    expect(
      extractPackageDependencyFacts({
        dependencies: { fastify: '^5.0.0' },
        peerDependencies: null,
        sourceComplete: false,
      }),
    ).toEqual({
      state: 'unknown',
      reason: 'package-dependency-source-incomplete',
    });
  });

  it('proves only exact parsed Compose service structure and never infers absence', () => {
    expect(
      extractComposeServiceFact({
        pathOutcome: 'established-value',
        contentTreeBlobIdentityVerified: true,
        content: JSON.stringify({
          services: { api: { image: 'example/api' } },
        }),
      }),
    ).toEqual({
      state: 'established-facts',
      facts: [{ factCode: 'compose-service-declaration', factValue: 'api' }],
    });
    expect(
      extractComposeServiceFact({
        pathOutcome: 'established-absence',
        contentTreeBlobIdentityVerified: false,
        content: null,
      }),
    ).toEqual({
      state: 'unknown',
      reason: 'compose-path-absence-is-not-deployment-absence',
    });
    expect(
      extractComposeServiceFact({
        pathOutcome: 'established-value',
        contentTreeBlobIdentityVerified: false,
        content: JSON.stringify({ services: { api: {} } }),
      }).state,
    ).toBe('unknown');
    expect(
      extractComposeServiceFact({
        pathOutcome: 'established-value',
        contentTreeBlobIdentityVerified: true,
        content: '{not-json',
      }),
    ).toEqual({ state: 'unknown', reason: 'unsupported-compose-json' });
    let deep: unknown = { services: { api: {} } };
    for (let depth = 0; depth < 34; depth += 1) deep = { nested: deep };
    expect(() =>
      extractComposeServiceFact({
        pathOutcome: 'established-value',
        contentTreeBlobIdentityVerified: true,
        content: JSON.stringify(deep),
      }),
    ).toThrow();
  });
});
