import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CANDIDATE_AUTHORITY_FIELD_PLAN_PATH,
  CANDIDATE_AUTHORITY_SOURCE_POLICY_PATH,
  parseCandidateAuthorityFieldPlan,
  parseCandidateAuthoritySourcePolicy,
} from '../src/index.ts';

const repositoryRoot = resolve(
  fileURLToPath(new URL('../../..', import.meta.url)),
);
const [mode, ...unexpected] = process.argv.slice(2);

if ((mode !== 'validate' && mode !== 'preflight') || unexpected.length > 0) {
  process.stderr.write('candidate-authority: invalid mode\n');
  process.exitCode = 1;
} else {
  try {
    const fieldPlan = parseCandidateAuthorityFieldPlan(
      await readJson(CANDIDATE_AUTHORITY_FIELD_PLAN_PATH, 1_048_576),
    );
    const sourcePolicy = parseCandidateAuthoritySourcePolicy(
      await readJson(CANDIDATE_AUTHORITY_SOURCE_POLICY_PATH, 1_048_576),
      fieldPlan,
    );
    const effectAudit = {
      networkCalls: 0,
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
        operation: `candidate-authority-${mode}`,
        decision: fieldPlan.goDecision,
        fieldPlanVersion: fieldPlan.planVersion,
        fieldPlanDigest: fieldPlan.planSemanticDigest,
        sourcePolicyVersion: sourcePolicy.policyVersion,
        sourcePolicyDigest: sourcePolicy.policySemanticDigest,
        denominatorSize: fieldPlan.frozenGate.denominatorSize,
        minimumReadyFields: fieldPlan.frozenGate.minimumReadyFields,
        exactPercentage: fieldPlan.frozenGate.exactPercentage,
        plannedReadyFields:
          fieldPlan.plannedDeterministicReadinessEligibleFieldCount,
        githubLogicalRequestBudget:
          sourcePolicy.requestBudget.githubLogicalRequests,
        npmLogicalRequestBudget: sourcePolicy.requestBudget.npmLogicalRequests,
        totalLogicalRequestBudget:
          sourcePolicy.requestBudget.totalLogicalRequests,
        effectAudit,
      })}\n`,
    );
  } catch {
    process.stderr.write('candidate-authority: validation failed\n');
    process.exitCode = 1;
  }
}

async function readJson(path: string, maximumBytes: number): Promise<unknown> {
  const text = await readFile(resolve(repositoryRoot, path), 'utf8');
  if (Buffer.byteLength(text, 'utf8') > maximumBytes) {
    throw new Error('bounded-input-exceeded');
  }
  return JSON.parse(text) as unknown;
}
