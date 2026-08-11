import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CANDIDATE_AUTHORITY_FIELD_PLAN_V4_PATH,
  CANDIDATE_AUTHORITY_PARTIAL_EVIDENCE_CONTRACT_DIGEST,
  CANDIDATE_AUTHORITY_PARTIAL_EVIDENCE_VERSION,
  CANDIDATE_AUTHORITY_PARTIAL_SEMANTIC_REGISTRY_PATH,
  CANDIDATE_AUTHORITY_READINESS_POLICY_V3_PATH,
  CANDIDATE_AUTHORITY_SOURCE_POLICY_V5_PATH,
  parseCandidateAuthorityFieldPlanV4,
  parseCandidateAuthorityPartialSemanticRegistry,
  parseCandidateAuthorityReadinessPolicyV3,
  parseCandidateAuthoritySourcePolicyV5,
} from '../src/index.ts';

const repositoryRoot = resolve(
  fileURLToPath(new URL('../../..', import.meta.url)),
);
const [mode, ...unexpected] = process.argv.slice(2);

if ((mode !== 'validate' && mode !== 'preflight') || unexpected.length > 0) {
  process.stderr.write('candidate-authority-correction: invalid mode\n');
  process.exitCode = 1;
} else {
  try {
    const partialSemanticRegistry =
      parseCandidateAuthorityPartialSemanticRegistry(
        await readJson(CANDIDATE_AUTHORITY_PARTIAL_SEMANTIC_REGISTRY_PATH),
      );
    const readinessPolicy = parseCandidateAuthorityReadinessPolicyV3(
      await readJson(CANDIDATE_AUTHORITY_READINESS_POLICY_V3_PATH),
    );
    const fieldPlan = parseCandidateAuthorityFieldPlanV4(
      await readJson(CANDIDATE_AUTHORITY_FIELD_PLAN_V4_PATH),
      readinessPolicy,
      partialSemanticRegistry,
    );
    const sourcePolicy = parseCandidateAuthoritySourcePolicyV5(
      await readJson(CANDIDATE_AUTHORITY_SOURCE_POLICY_V5_PATH),
      fieldPlan,
    );
    const effectAudit = {
      networkCalls: 0,
      candidateProviderCalls: 0,
      credentialReads: 0,
      databaseCalls: 0,
      dockerCalls: 0,
      modelCalls: 0,
      filesystemWrites: 0,
      providerCollections: 0,
      sourceAuthoritiesGenerated: 0,
      allCandidateProjections: 0,
      coverageCalculations: 0,
    } as const;
    process.stdout.write(
      `${JSON.stringify({
        status: 'passed',
        operation: `candidate-authority-correction-${mode}`,
        decision: fieldPlan.goDecision,
        readinessPolicyVersion: readinessPolicy.policyVersion,
        readinessPolicyDigest: readinessPolicy.policySemanticDigest,
        fieldPlanVersion: fieldPlan.planVersion,
        fieldPlanDigest: fieldPlan.planSemanticDigest,
        sourcePolicyVersion: sourcePolicy.policyVersion,
        sourcePolicyDigest: sourcePolicy.policySemanticDigest,
        partialSemanticRegistryVersion: partialSemanticRegistry.registryVersion,
        partialSemanticRegistryDigest:
          partialSemanticRegistry.registrySemanticDigest,
        partialEvidenceContractVersion:
          CANDIDATE_AUTHORITY_PARTIAL_EVIDENCE_VERSION,
        partialEvidenceContractDigest:
          CANDIDATE_AUTHORITY_PARTIAL_EVIDENCE_CONTRACT_DIGEST,
        denominatorSize: fieldPlan.frozenGate.denominatorSize,
        minimumRealizedReadyFields:
          fieldPlan.frozenGate.minimumRealizedReadyFields,
        exactPercentage: fieldPlan.frozenGate.exactPercentage,
        plannedExtractionCapableFields:
          fieldPlan.plannedDeterministicExtractionCapableFieldCount,
        realizedReadyFields: null,
        plannedFullClosureFields:
          fieldPlan.plannedDeterministicFullClosureFieldCount,
        githubLogicalRequestBudget:
          sourcePolicy.requestBudget.githubLogicalRequests,
        npmLogicalRequestBudget: sourcePolicy.requestBudget.npmLogicalRequests,
        totalLogicalRequestBudget:
          sourcePolicy.requestBudget.totalLogicalRequests,
        effectAudit,
      })}\n`,
    );
  } catch {
    process.stderr.write('candidate-authority-correction: validation failed\n');
    process.exitCode = 1;
  }
}

async function readJson(path: string): Promise<unknown> {
  const text = await readFile(resolve(repositoryRoot, path), 'utf8');
  if (Buffer.byteLength(text, 'utf8') > 1_048_576) {
    throw new Error('bounded-input-exceeded');
  }
  return JSON.parse(text) as unknown;
}
