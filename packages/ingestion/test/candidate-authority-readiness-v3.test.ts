import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import {
  CANDIDATE_AUTHORITY_PLANNED_CAPABLE_COUNT,
  CANDIDATE_AUTHORITY_PARTIAL_EVIDENCE_CONTRACT_DIGEST,
  canonicalizeJson,
  evaluateCandidateAuthorityRealizedReadiness,
  extractApplicableSecurityAdvisoryFacts,
  extractDatastoreRequirementFact,
  extractFrameworkPeerRelationFacts,
  extractImportableRuntimePackageAdoptionFact,
  extractPublishedReleaseFacts,
  extractRecognizedLicenseSpdxFact,
  extractRepositoryPrimaryLanguageFact,
  extractRepositorySelfBuildComposeServiceFacts,
  parseCandidateAuthorityFieldPlanV3,
  parseCandidateAuthorityPartialSemanticRegistry,
  parseCandidateAuthorityReadinessPolicyV3,
  parseCandidateAuthoritySourcePolicyV3,
  qualifiesPlannedDeterministicExtraction,
  resolveExactGitHeadFromReferenceAndCommit,
  type CandidateAuthorityCellOriginCounts,
  type CandidateAuthorityFieldPlanV3,
} from '../src/index.ts';

const ROOT = new URL('../../../', import.meta.url);
const SHA = '0123456789abcdef0123456789abcdef01234567';
const TREE_SHA = 'fedcba9876543210fedcba9876543210fedcba98';

async function authorities() {
  const registry = parseCandidateAuthorityPartialSemanticRegistry(
    await readJson(
      'catalog/public-v1/candidate-authority-partial-field-semantics.json',
    ),
  );
  const policy = parseCandidateAuthorityReadinessPolicyV3(
    await readJson(
      'catalog/public-v1/candidate-authority-readiness-policy-v3.json',
    ),
  );
  const plan = parseCandidateAuthorityFieldPlanV3(
    await readJson('catalog/public-v1/candidate-authority-field-plan-v3.json'),
    policy,
    registry,
  );
  const sourcePolicy = parseCandidateAuthoritySourcePolicyV3(
    await readJson(
      'catalog/public-v1/candidate-authority-source-policy-v3.json',
    ),
    plan,
  );
  return { plan, policy, registry, sourcePolicy };
}

describe('readiness policy v3', () => {
  it('separates planned capability, realized readiness, and full closure', async () => {
    const { plan } = await authorities();
    expect(plan.frozenGate).toEqual({
      denominatorSize: 18,
      minimumRealizedReadyFields: 13,
      exactPercentage: 72.222222,
      minimumFieldPerBreadthGroup: 1,
    });
    expect(plan.plannedDeterministicExtractionCapableFieldCount).toBe(13);
    expect(CANDIDATE_AUTHORITY_PLANNED_CAPABLE_COUNT).toBe(13);
    expect(plan.plannedDeterministicFullClosureFieldCount).toBe(6);
    expect(
      plan.fields.filter((field) => field.plannedExtractionCapable),
    ).toHaveLength(13);
    expect(
      plan.fields.every(
        (field) =>
          field.plannedExtractionCapable ===
          qualifiesPlannedDeterministicExtraction(field),
      ),
    ).toBe(true);
  });

  it('freezes one affirmative registry definition per partial field semantic', async () => {
    const { registry } = await authorities();
    expect(
      registry.definitions.map((definition) => [
        definition.factCode,
        definition.fieldId,
        definition.allowedPolarities,
        definition.valueSyntax.kind,
      ]),
    ).toEqual([
      [
        'applicable-security-advisory',
        'security-advisory-state',
        ['affirmative'],
        'canonical-security-advisory-v1',
      ],
      [
        'declared-framework-peer-relation',
        'framework-compatibility',
        ['affirmative'],
        'canonical-framework-peer-relation-v1',
      ],
      [
        'importable-runtime-package-surface',
        'adoption-unit-type',
        ['affirmative'],
        'canonical-importable-runtime-package-surface-v1',
      ],
      [
        'published-release',
        'release-state-recency',
        ['affirmative'],
        'canonical-published-release-v1',
      ],
      [
        'recognized-license-spdx',
        'license-identity',
        ['affirmative'],
        'recognized-spdx-v1',
      ],
      [
        'repository-primary-language',
        'language-ecosystem',
        ['affirmative'],
        'controlled-language-ecosystem-v1',
      ],
      [
        'repository-self-build-compose-service',
        'deployment-self-hosting',
        ['affirmative'],
        'pattern-v1',
      ],
    ]);
    const schema = await readJson(
      'schemas/operations/candidate-authority/partial-field-evidence-v2.schema.json',
    );
    expect(canonicalizeJson(schema).digest).toBe(
      CANDIDATE_AUTHORITY_PARTIAL_EVIDENCE_CONTRACT_DIGEST,
    );
  });

  it('does not let zero-output or N/A-only fields enter realized readiness', async () => {
    const { plan } = await authorities();
    const passing = evaluateCandidateAuthorityRealizedReadiness({
      candidateCount: 1,
      fieldPlan: plan,
      fields: realizationFixtures(plan),
    });
    expect(passing.realizedDeterministicReadyFieldCount).toBe(13);
    expect(passing.decision).toBe('go');

    const zeroOutput = evaluateCandidateAuthorityRealizedReadiness({
      candidateCount: 1,
      fieldPlan: plan,
      fields: realizationFixtures(plan, {
        fieldId: 'adoption-unit-type',
        origins: origins({ unknown: 1 }),
      }),
    });
    expect(zeroOutput.realizedDeterministicReadyFieldCount).toBe(12);
    expect(zeroOutput.realizedBreadthGroups['capability-adoption']).toEqual([]);
    expect(zeroOutput.decision).toBe('no-go');

    const notApplicableOnly = evaluateCandidateAuthorityRealizedReadiness({
      candidateCount: 1,
      fieldPlan: plan,
      fields: realizationFixtures(plan, {
        fieldId: 'adoption-unit-type',
        origins: origins({ 'deterministic-not-applicable': 1 }),
      }),
    });
    expect(notApplicableOnly.realizedDeterministicReadyFieldCount).toBe(12);
    expect(notApplicableOnly.decision).toBe('no-go');
  });

  it('keeps the future realized breadth gate independent from planned breadth', async () => {
    const { plan } = await authorities();
    const result = evaluateCandidateAuthorityRealizedReadiness({
      candidateCount: 1,
      fieldPlan: plan,
      fields: realizationFixtures(plan, {
        fieldId: 'deployment-self-hosting',
        origins: origins({ unknown: 1 }),
      }),
    });
    expect(result.plannedBreadthGroups['infrastructure-deployment']).toEqual([
      'deployment-self-hosting',
    ]);
    expect(result.realizedBreadthGroups['infrastructure-deployment']).toEqual(
      [],
    );
    expect(result.decision).toBe('no-go');
  });

  it('excludes human-reviewed and model-derived cells from realized readiness', async () => {
    const { plan } = await authorities();
    for (const origin of [
      'human-reviewed-structured',
      'model-derived',
    ] as const) {
      const result = evaluateCandidateAuthorityRealizedReadiness({
        candidateCount: 1,
        fieldPlan: plan,
        fields: realizationFixtures(plan, {
          fieldId: 'adoption-unit-type',
          origins: origins({ [origin]: 1 }),
        }),
      });
      expect(result.realizedDeterministicReadyFields).not.toContain(
        'adoption-unit-type',
      );
      expect(result.decision).toBe('no-go');
    }
  });

  it('keeps accepted ranking authorities bound to their accepted semantic digests', async () => {
    const review = (await readJson(
      'evals/ranking-v1/reviews/accepted-review-record.json',
    )) as { semanticDigest: string };
    const gates = (await readJson(
      'evals/ranking-v1/gates/accepted-gates.json',
    )) as { semanticDigest: string };
    expect(review.semanticDigest).toBe(
      '18ba16b1266423fc18d3c8ffc2b39c2d399453ed0f24bc5e89c9d4f967a42cef',
    );
    expect(gates.semanticDigest).toBe(
      'b44de7aaf3fc997c10c31739862836f6f1a05fe1f80b1a19bc53c4dec7084460',
    );
  });
});

describe('field-semantic partial rules', () => {
  it('requires an explicit importable package entry point for adoption', () => {
    const publicationOnly = extractImportableRuntimePackageAdoptionFact({
      catalogPackageName: '@example/tool',
      sourcePackageName: '@example/tool',
      selectedVersion: '1.2.3',
      sourceComplete: true,
      exportsValue: null,
      main: null,
      module: null,
    });
    expect(publicationOnly).toEqual({
      state: 'unknown',
      reason: 'importable-runtime-entry-point-not-established',
    });
    expect(
      extractImportableRuntimePackageAdoptionFact({
        catalogPackageName: '@example/tool',
        sourcePackageName: '@example/tool',
        selectedVersion: '1.2.3',
        sourceComplete: true,
        exportsValue: { '.': { types: './dist/index.d.ts' } },
        main: null,
        module: null,
      }),
    ).toEqual({
      state: 'unknown',
      reason: 'importable-runtime-entry-point-not-established',
    });
    expect(
      extractImportableRuntimePackageAdoptionFact({
        catalogPackageName: '@example/tool',
        sourcePackageName: '@example/tool',
        selectedVersion: '1.2.3',
        sourceComplete: true,
        exportsValue: { '.': './dist/index.js' },
        main: null,
        module: null,
      }),
    ).toEqual({
      state: 'established-facts',
      facts: [
        {
          factCode: 'importable-runtime-package-surface',
          factValue:
            '{"entryPointKind":"exports","packageName":"@example/tool","packageVersion":"1.2.3"}',
        },
      ],
    });
  });

  it('derives language only from the structured repository primary language', () => {
    expect(
      extractRepositoryPrimaryLanguageFact({
        primaryLanguage: 'TypeScript',
        sourceComplete: true,
      }),
    ).toEqual({
      state: 'established-facts',
      facts: [
        { factCode: 'repository-primary-language', factValue: 'typescript' },
      ],
    });
    expect(
      extractRepositoryPrimaryLanguageFact({
        primaryLanguage: null,
        sourceComplete: true,
      }),
    ).toEqual({
      state: 'unknown',
      reason: 'repository-primary-language-not-established',
    });
    const npmOnly = {
      primaryLanguage: null,
      sourceComplete: true,
      packageEcosystem: 'npm',
    };
    expect(extractRepositoryPrimaryLanguageFact(npmOnly)).toEqual({
      state: 'unknown',
      reason: 'repository-primary-language-not-established',
    });
  });

  it('keeps runtime dependencies distinct from framework peer relations and datastore requirements', () => {
    const runtimeDependencyOnly = {
      peerDependencies: null,
      sourceComplete: true,
      dependencies: { express: '^5.0.0' },
    };
    expect(extractFrameworkPeerRelationFacts(runtimeDependencyOnly)).toEqual({
      state: 'unknown',
      reason: 'framework-peer-relation-not-established',
    });
    expect(
      extractFrameworkPeerRelationFacts({
        peerDependencies: { fastify: '^5.0.0' },
        sourceComplete: true,
      }),
    ).toEqual({
      state: 'established-facts',
      facts: [
        {
          factCode: 'declared-framework-peer-relation',
          factValue:
            '{"framework":"fastify","packageName":"fastify","range":"^5.0.0"}',
        },
      ],
    });
    expect(
      extractDatastoreRequirementFact({
        dependencies: { pg: '^9.0.0' },
        sourceComplete: true,
      }),
    ).toEqual({
      state: 'unknown',
      reason: 'package-dependency-does-not-prove-datastore-requirement',
    });
  });

  it('requires a repository-root self-build service rather than a generic Compose map', () => {
    expect(
      extractRepositorySelfBuildComposeServiceFacts({
        pathOutcome: 'established-value',
        contentTreeBlobIdentityVerified: true,
        content: JSON.stringify({
          services: { database: { image: 'postgres' } },
        }),
      }),
    ).toEqual({
      state: 'unknown',
      reason: 'repository-self-build-compose-service-not-established',
    });
    expect(
      extractRepositorySelfBuildComposeServiceFacts({
        pathOutcome: 'established-value',
        contentTreeBlobIdentityVerified: true,
        content: JSON.stringify({
          services: { app: { build: { context: '.' } } },
        }),
      }),
    ).toEqual({
      state: 'established-facts',
      facts: [
        { factCode: 'repository-self-build-compose-service', factValue: 'app' },
      ],
    });
  });

  it('emits only affirmative field-semantic release, advisory, and license facts', () => {
    expect(
      extractPublishedReleaseFacts({
        outcome: 'established-value',
        releases: [
          {
            tagName: 'v2.1.0',
            publishedAt: '2026-07-30T00:00:00.000Z',
            draft: false,
            prerelease: false,
          },
        ],
      }),
    ).toEqual({
      state: 'established-facts',
      facts: [
        {
          factCode: 'published-release',
          factValue:
            '{"prerelease":false,"publishedAt":"2026-07-30T00:00:00.000Z","tag":"v2.1.0"}',
        },
      ],
    });
    expect(
      extractApplicableSecurityAdvisoryFacts({
        expectedPackageName: 'example',
        expectedPackageVersion: '1.0.0',
        sourcePackageName: 'example',
        sourcePackageVersion: '1.0.0',
        outcome: 'established-value',
        advisories: [{ advisoryId: 'ghsa-2345-6789-cfgh', severity: 'high' }],
      }),
    ).toEqual({
      state: 'established-facts',
      facts: [
        {
          factCode: 'applicable-security-advisory',
          factValue: '{"advisoryId":"GHSA-2345-6789-CFGH","severity":"high"}',
        },
      ],
    });
    expect(
      extractRecognizedLicenseSpdxFact({
        spdxId: 'NOASSERTION',
        sourceComplete: true,
      }),
    ).toEqual({
      state: 'unknown',
      reason: 'recognized-license-not-established',
    });
    expect(
      extractRecognizedLicenseSpdxFact({
        spdxId: 'Apache-2.0',
        sourceComplete: true,
      }),
    ).toEqual({
      state: 'established-facts',
      facts: [{ factCode: 'recognized-license-spdx', factValue: 'Apache-2.0' }],
    });
  });
});

describe('bounded Git head resolution policy', () => {
  it('uses the accepted exact Git ref and commit-object identity contract', () => {
    expect(
      resolveExactGitHeadFromReferenceAndCommit(
        'main',
        {
          ref: 'refs/heads/main',
          object: { type: 'commit', sha: SHA },
        },
        {
          sha: SHA,
          tree: { sha: TREE_SHA },
        },
      ),
    ).toEqual({ commitObjectId: SHA, rootTreeObjectId: TREE_SHA });
    expect(() =>
      resolveExactGitHeadFromReferenceAndCommit(
        'main',
        {
          ref: 'refs/heads/other',
          object: { type: 'commit', sha: SHA },
        },
        {
          sha: SHA,
          tree: { sha: TREE_SHA },
        },
      ),
    ).toThrow();
  });

  it('prohibits the expansive repository-commit endpoint', async () => {
    const { sourcePolicy } = await authorities();
    expect(
      sourcePolicy.operations.map((operation) => operation.endpointShape),
    ).not.toContain('/repos/{owner}/{repository}/commits/{defaultBranch}');
    expect(
      sourcePolicy.operations.map((operation) => operation.operationId),
    ).toContain('github-default-branch-ref');
    expect(
      sourcePolicy.operations.map((operation) => operation.operationId),
    ).toContain('github-head-commit-object');
  });
});

function realizationFixtures(
  plan: CandidateAuthorityFieldPlanV3,
  override?: {
    readonly fieldId: CandidateAuthorityFieldPlanV3['fields'][number]['fieldId'];
    readonly origins: CandidateAuthorityCellOriginCounts;
  },
) {
  return plan.fields.map((field) => ({
    fieldId: field.fieldId,
    origins:
      override?.fieldId === field.fieldId
        ? override.origins
        : field.plannedExtractionCapable
          ? field.deterministicFullClosureCandidate
            ? origins({ 'deterministic-known': 1 })
            : origins({ 'deterministic-partial-direct-evidence': 1 })
          : origins({ unknown: 1 }),
    validatedPartialEvidenceCellCount:
      override?.fieldId === field.fieldId
        ? override.origins['deterministic-partial-direct-evidence']
        : field.plannedExtractionCapable &&
            !field.deterministicFullClosureCandidate
          ? 1
          : 0,
  }));
}

function origins(
  input: Partial<CandidateAuthorityCellOriginCounts>,
): CandidateAuthorityCellOriginCounts {
  return {
    'deterministic-known': 0,
    'deterministic-not-applicable': 0,
    'deterministic-partial-direct-evidence': 0,
    'human-reviewed-structured': 0,
    'model-derived': 0,
    unknown: 0,
    conflict: 0,
    ...input,
  };
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(new URL(path, ROOT), 'utf8')) as unknown;
}
