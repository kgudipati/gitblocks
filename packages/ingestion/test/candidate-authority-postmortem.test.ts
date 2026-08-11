import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { materializeCandidateAuthoritySuccessorRuntimeSourcePolicy } from '../src/candidate-authority-provider-contract.ts';
import {
  CANDIDATE_AUTHORITY_FAILURE_RECORD_PATH,
  CANDIDATE_AUTHORITY_FIELD_PLAN_V5_PATH,
  CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V4_PATH,
  CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_PATH,
  CANDIDATE_AUTHORITY_REPLAY_V3_PATH,
  CANDIDATE_AUTHORITY_SOURCE_POLICY_V6_PATH,
  materializeCandidateAuthorityFieldPlanV5,
  parseCandidateAuthorityPostmortemAuthorities,
} from '../src/candidate-authority-postmortem.ts';
import {
  CANDIDATE_AUTHORITY_FIELD_PLAN_V4_PATH,
  CANDIDATE_AUTHORITY_READINESS_POLICY_V3_PATH,
  parseCandidateAuthorityFieldPlanV4,
  parseCandidateAuthorityReadinessPolicyV3,
} from '../src/candidate-authority-readiness.ts';
import {
  CANDIDATE_AUTHORITY_PARTIAL_SEMANTIC_REGISTRY_PATH,
  parseCandidateAuthorityPartialSemanticRegistry,
} from '../src/candidate-authority-partial-semantics.ts';

describe('candidate authority postmortem successor authorities', () => {
  it('validates the immutable failure record and inactive successor binding chain', () => {
    const values = authorities();
    const parsed = parseCandidateAuthorityPostmortemAuthorities(values);
    expect(parsed.failureRecord['observedExecutionFacts']).toMatchObject({
      providerEffectCollectionsConsumed: 1,
      candidateId: 'unknown',
      operationId: 'unknown',
      sourceAuthority: 'absent',
      readinessMeasurement: 'not-performed',
    });
    expect(parsed.authorization).toMatchObject({
      status: 'proposed-inactive-pending-independent-exact-head-acceptance',
      priorConsumedExperiment: {
        providerEffectCollectionsConsumed: 1,
        remainingProviderEffectCollections: 0,
      },
      successorExperiment: {
        conditionallyAuthorizedProviderEffectCollections: 1,
        activeProviderEffectCollections: 0,
        automaticRerun: false,
      },
    });
  });

  it('materializes exactly 13 capable fields, five full-closure candidates, and the successor operation budgets', () => {
    const values = authorities();
    const registry = parseCandidateAuthorityPartialSemanticRegistry(
      json(CANDIDATE_AUTHORITY_PARTIAL_SEMANTIC_REGISTRY_PATH),
    );
    const readiness = parseCandidateAuthorityReadinessPolicyV3(
      json(CANDIDATE_AUTHORITY_READINESS_POLICY_V3_PATH),
    );
    const predecessor = parseCandidateAuthorityFieldPlanV4(
      json(CANDIDATE_AUTHORITY_FIELD_PLAN_V4_PATH),
      readiness,
      registry,
    );
    const plan = materializeCandidateAuthorityFieldPlanV5({
      predecessor,
      successorAuthority: values.fieldPlan,
    });
    expect(
      plan.fields.filter((field) => field.plannedExtractionCapable),
    ).toHaveLength(13);
    expect(
      plan.fields
        .filter((field) => field.deterministicFullClosureCandidate)
        .map((field) => field.fieldId),
    ).toEqual([
      'package-publication-version',
      'runtime-package-format',
      'package-repository-linkage',
      'archived-state',
      'maintenance-activity',
    ]);
    expect(
      plan.fields.find((field) => field.fieldId === 'security-policy-presence'),
    ).toMatchObject({
      posture: 'deterministic-partial-path',
      plannedExtractionCapable: true,
      deterministicFullClosureCandidate: false,
      providerOperations: [
        'github-root-tree',
        'github-security-dot-github-tree',
        'github-security-docs-tree',
      ],
    });

    const source = materializeCandidateAuthoritySuccessorRuntimeSourcePolicy(
      values.sourcePolicy,
      values.providerContract,
    );
    expect(source.requestBudget).toEqual({
      githubLogicalRequests: 1810,
      npmLogicalRequests: 80,
      totalLogicalRequests: 1890,
      githubWorstCaseAttempts: 5430,
      npmWorstCaseAttempts: 240,
      totalWorstCaseAttempts: 5670,
    });
    expect(
      source.operations.map((operation) => operation.operationId),
    ).not.toEqual(
      expect.arrayContaining([
        'github-community-profile',
        'github-compose-json-content',
      ]),
    );
  });
});

function authorities() {
  return {
    failureRecord: json(CANDIDATE_AUTHORITY_FAILURE_RECORD_PATH),
    providerContract: json(CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_PATH),
    fieldPlan: json(CANDIDATE_AUTHORITY_FIELD_PLAN_V5_PATH),
    sourcePolicy: json(CANDIDATE_AUTHORITY_SOURCE_POLICY_V6_PATH),
    replay: json(CANDIDATE_AUTHORITY_REPLAY_V3_PATH),
    authorization: json(CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V4_PATH),
  };
}

function json(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}
