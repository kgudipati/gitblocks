import { readFile } from 'node:fs/promises';

import { materializeCandidateAuthoritySuccessorRuntimeSourcePolicyV8 } from '../src/candidate-authority-provider-contract.ts';
import {
  CANDIDATE_AUTHORITY_FAILURE_RECORD_V2_PATH,
  CANDIDATE_AUTHORITY_FIELD_PLAN_V6_PATH,
  CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V6_PATH,
  CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V2_PATH,
  CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V3_PATH,
  CANDIDATE_AUTHORITY_REPLAY_V5_PATH,
  CANDIDATE_AUTHORITY_SOURCE_POLICY_V7_PATH,
  CANDIDATE_AUTHORITY_SOURCE_POLICY_V8_PATH,
  materializeCandidateAuthorityFieldPlanV6,
  validateCandidateAuthorityNpmCorrectionAuthorities,
} from '../src/candidate-authority-npm-source-correction.ts';
import {
  CANDIDATE_AUTHORITY_FIELD_PLAN_V5_PATH,
  CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_PATH,
  CANDIDATE_AUTHORITY_SOURCE_POLICY_V6_PATH,
  materializeCandidateAuthorityFieldPlanV5,
} from '../src/candidate-authority-postmortem.ts';
import {
  CANDIDATE_AUTHORITY_PARTIAL_SEMANTIC_REGISTRY_PATH,
  CANDIDATE_AUTHORITY_PARTIAL_SEMANTIC_REGISTRY_V3_PATH,
  parseCandidateAuthorityPartialSemanticRegistry,
  parseCandidateAuthorityPartialSemanticRegistryV3,
} from '../src/candidate-authority-partial-semantics.ts';
import {
  CANDIDATE_AUTHORITY_FIELD_PLAN_V4_PATH,
  CANDIDATE_AUTHORITY_READINESS_POLICY_V3_PATH,
  parseCandidateAuthorityFieldPlanV4,
  parseCandidateAuthorityReadinessPolicyV3,
} from '../src/candidate-authority-readiness.ts';
import { parsePublicCatalog } from '../src/manifest.ts';

const ZERO_EFFECT_AUDIT = Object.freeze({
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
});

const command = process.argv[2];
if (command !== 'validate' && command !== 'preflight') {
  process.stderr.write('usage: npm-source-correction <validate|preflight>\n');
  process.exitCode = 1;
} else {
  const result = await validateCorrection();
  process.stdout.write(
    `${JSON.stringify(
      command === 'preflight'
        ? { ...result, effectAudit: ZERO_EFFECT_AUDIT }
        : result,
      null,
      2,
    )}\n`,
  );
}

async function validateCorrection() {
  const [
    catalogText,
    readinessText,
    registryV2Text,
    registryV3Text,
    planV4Text,
    planV5Text,
    planV6Text,
    providerV1,
    providerV2,
    providerV3,
    sourceV6,
    sourceV7,
    sourceV8,
    replayV5,
    authorizationV6,
    failureV2,
  ] = await Promise.all([
    readFile('catalog/public-v1/manifest.json', 'utf8'),
    readFile(CANDIDATE_AUTHORITY_READINESS_POLICY_V3_PATH, 'utf8'),
    readFile(CANDIDATE_AUTHORITY_PARTIAL_SEMANTIC_REGISTRY_PATH, 'utf8'),
    readFile(CANDIDATE_AUTHORITY_PARTIAL_SEMANTIC_REGISTRY_V3_PATH, 'utf8'),
    readFile(CANDIDATE_AUTHORITY_FIELD_PLAN_V4_PATH, 'utf8'),
    readFile(CANDIDATE_AUTHORITY_FIELD_PLAN_V5_PATH, 'utf8'),
    readFile(CANDIDATE_AUTHORITY_FIELD_PLAN_V6_PATH, 'utf8'),
    readFile(CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_PATH, 'utf8'),
    readFile(CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V2_PATH, 'utf8'),
    readFile(CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V3_PATH, 'utf8'),
    readFile(CANDIDATE_AUTHORITY_SOURCE_POLICY_V6_PATH, 'utf8'),
    readFile(CANDIDATE_AUTHORITY_SOURCE_POLICY_V7_PATH, 'utf8'),
    readFile(CANDIDATE_AUTHORITY_SOURCE_POLICY_V8_PATH, 'utf8'),
    readFile(CANDIDATE_AUTHORITY_REPLAY_V5_PATH, 'utf8'),
    readFile(CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V6_PATH, 'utf8'),
    readFile(CANDIDATE_AUTHORITY_FAILURE_RECORD_V2_PATH, 'utf8'),
  ]);
  const json = (text: string): unknown => JSON.parse(text) as unknown;
  validateCandidateAuthorityNpmCorrectionAuthorities({
    failureRecordV2: json(failureV2),
    fieldPlanV6: json(planV6Text),
    providerContractV3: json(providerV3),
    sourcePolicyV8: json(sourceV8),
    replayV5: json(replayV5),
    authorizationV6: json(authorizationV6),
  });
  const sourcePolicy =
    materializeCandidateAuthoritySuccessorRuntimeSourcePolicyV8({
      sourcePolicyV6: json(sourceV6),
      providerContractV1: json(providerV1),
      sourcePolicyV7: json(sourceV7),
      providerContractV2: json(providerV2),
      sourcePolicyV8: json(sourceV8),
      providerContractV3: json(providerV3),
    });
  const registryV2 = parseCandidateAuthorityPartialSemanticRegistry(
    json(registryV2Text),
  );
  const registryV3 = parseCandidateAuthorityPartialSemanticRegistryV3(
    json(registryV3Text),
  );
  const planV4 = parseCandidateAuthorityFieldPlanV4(
    json(planV4Text),
    parseCandidateAuthorityReadinessPolicyV3(json(readinessText)),
    registryV2,
  );
  const planV6 = materializeCandidateAuthorityFieldPlanV6({
    predecessor: materializeCandidateAuthorityFieldPlanV5({
      predecessor: planV4,
      successorAuthority: json(planV5Text),
    }),
    successorAuthority: json(planV6Text),
    partialSemanticRegistry: registryV3,
  });
  const catalog = parsePublicCatalog(catalogText);
  return Object.freeze({
    status: 'passed',
    candidateCount: catalog.candidates.length,
    mappedNpmCount: catalog.candidates.filter(
      ({ npmPackage }) => npmPackage !== null,
    ).length,
    sourcePolicyVersion: sourcePolicy.policyVersion,
    authorizationVersion: 'candidate-authority-live-authorization/6.0.0',
    operationCount: sourcePolicy.operations.length,
    plannedExtractionCapable: planV6.fields.filter(
      ({ plannedExtractionCapable }) => plannedExtractionCapable,
    ).length,
    plannedDeterministicFullClosure: planV6.fields.filter(
      ({ deterministicFullClosureCandidate }) =>
        deterministicFullClosureCandidate,
    ).length,
  });
}
