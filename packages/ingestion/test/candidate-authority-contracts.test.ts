import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import {
  CANDIDATE_AUTHORITY_PLANNED_READY_COUNT,
  RANKING_DECISION_FIELD_IDS,
  candidateAuthorityRootSemanticDigest,
  parseCandidateAuthorityFieldPlan,
  parseCandidateAuthoritySourcePolicy,
} from '../src/index.ts';

const ROOT = new URL('../../../', import.meta.url);

async function authorities() {
  const planValue = JSON.parse(
    await readFile(
      new URL('catalog/public-v1/candidate-authority-field-plan.json', ROOT),
      'utf8',
    ),
  ) as unknown;
  const plan = parseCandidateAuthorityFieldPlan(planValue);
  const policyValue = JSON.parse(
    await readFile(
      new URL('catalog/public-v1/candidate-authority-source-policy.json', ROOT),
      'utf8',
    ),
  ) as unknown;
  return {
    planValue,
    policyValue,
    plan,
    policy: parseCandidateAuthoritySourcePolicy(policyValue, plan),
  };
}

describe('candidate-authority pre-live authorities', () => {
  it('freezes the unchanged denominator and an explicit scientific NO-GO', async () => {
    const { plan } = await authorities();
    expect(plan.fields.map((field) => field.fieldId)).toEqual(
      RANKING_DECISION_FIELD_IDS,
    );
    expect(plan.frozenGate).toEqual({
      denominatorSize: 18,
      minimumReadyFields: 13,
      exactPercentage: 72.222222,
      minimumReadyFieldPerBreadthGroup: 1,
    });
    expect(
      plan.fields.filter((field) => field.deterministicReadinessEligible),
    ).toHaveLength(CANDIDATE_AUTHORITY_PLANNED_READY_COUNT);
    expect(
      plan.fields
        .filter((field) => field.deterministicReadinessEligible)
        .map((field) => field.fieldId),
    ).toEqual([
      'package-publication-version',
      'runtime-package-format',
      'package-repository-linkage',
      'archived-state',
      'maintenance-activity',
      'security-policy-presence',
    ]);
    for (const breadthGroup of [
      'capability-adoption',
      'infrastructure-deployment',
    ] as const) {
      expect(
        plan.fields.some(
          (field) =>
            field.breadthGroup === breadthGroup &&
            field.deterministicReadinessEligible,
        ),
      ).toBe(false);
    }
    expect(plan.goDecision).toBe('no-go');
  });

  it('rejects a post-freeze eligibility change even when it would improve the count', async () => {
    const { planValue } = await authorities();
    const changed = structuredClone(planValue) as {
      fields: { deterministicReadinessEligible: boolean }[];
    };
    changed.fields[0]!.deterministicReadinessEligible = true;
    expect(() => parseCandidateAuthorityFieldPlan(changed)).toThrow();
  });

  it('binds bounded zero-effect source policy and exact budgets', async () => {
    const { policy } = await authorities();
    expect(Object.values(policy.authorization)).toEqual([
      false,
      false,
      false,
      false,
      false,
      false,
    ]);
    expect(policy.requestBudget).toEqual({
      candidateCount: 150,
      mappedPackageCount: 80,
      githubLogicalRequests: 1060,
      npmLogicalRequests: 80,
      totalLogicalRequests: 1140,
      githubWorstCaseAttempts: 3180,
      npmWorstCaseAttempts: 240,
      totalWorstCaseAttempts: 3420,
    });
    expect(
      policy.operations.map((operation) => ({
        method: operation.method,
        attempts: operation.maximumAttempts,
        redirects: operation.redirectPolicy,
      })),
    ).toEqual(
      Array.from({ length: 8 }, () => ({
        method: 'GET',
        attempts: 3,
        redirects: 'zero redirects',
      })),
    );
  });

  it('defines a canonical all-candidate root digest without constructing one', () => {
    const root = {
      authorityVersion: 'candidate-authority-root/1.0.0' as const,
      catalogBinding: { version: 'public-v1' as const, digest: 'a'.repeat(64) },
      taxonomyBinding: { version: '1.0.0' as const, digest: 'b'.repeat(64) },
      deterministicProfileBinding: {
        denominatorVersion: 'candidate-profile-denominator/1.0.0',
        rulesVersion: 'candidate-profile-rules/1.0.0',
      },
      rankingDecisionBinding: {
        denominatorVersion: 'ranking-decision-denominator/1.0.0' as const,
        readinessPolicyDigest: 'c'.repeat(64),
      },
      fieldPlanBinding: {
        version: 'candidate-authority-field-plan/1.0.0',
        digest: 'd'.repeat(64),
      },
      sourcePolicyBinding: {
        version: 'candidate-authority-source-policy/1.0.0',
        digest: 'e'.repeat(64),
      },
      collection: {
        cutoff: '2026-08-01T00:00:00.000Z',
        candidateCount: 150 as const,
        orderedCandidateIds: ['fixture-candidate'],
        orderedCandidateIdentitiesDigest: 'f'.repeat(64),
      },
      authorityDigests: {
        source: '1'.repeat(64),
        deterministicProfiles: '2'.repeat(64),
        evidence: '3'.repeat(64),
        dossiers: '4'.repeat(64),
        dossierProjection: '5'.repeat(64),
        coverageReadinessReport: '6'.repeat(64),
      },
      qualificationCounts: {
        known: 0,
        notApplicable: 0,
        unknown: 0,
        conflict: 0,
      },
    };
    expect(candidateAuthorityRootSemanticDigest(root)).toMatch(
      /^[a-f0-9]{64}$/u,
    );
    expect(candidateAuthorityRootSemanticDigest(root)).toBe(
      candidateAuthorityRootSemanticDigest(structuredClone(root)),
    );
  });
});
