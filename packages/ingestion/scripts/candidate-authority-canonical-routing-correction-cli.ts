import { readFile } from 'node:fs/promises';

import {
  CANDIDATE_AUTHORITY_FAILURE_RECORD_V3_PATH,
  CANDIDATE_AUTHORITY_FIELD_PLAN_V7_PATH,
  CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V7_PATH,
  CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V4_PATH,
  CANDIDATE_AUTHORITY_REPLAY_V6_PATH,
  CANDIDATE_AUTHORITY_ROUTING_PATH,
  CANDIDATE_AUTHORITY_SOURCE_POLICY_V9_PATH,
  materializeCandidateAuthorityFieldPlanV7,
  parseCandidateAuthorityProviderRoutes,
  validateCandidateAuthorityCanonicalRoutingAuthorities,
} from '../src/candidate-authority-canonical-routing-correction.ts';
import {
  CANDIDATE_AUTHORITY_FIELD_PLAN_V6_PATH,
  CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V2_PATH,
  CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V3_PATH,
  CANDIDATE_AUTHORITY_SOURCE_POLICY_V7_PATH,
  CANDIDATE_AUTHORITY_SOURCE_POLICY_V8_PATH,
  materializeCandidateAuthorityFieldPlanV6,
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
import { parseCandidateAuthoritySuccessorFixedAuthorities } from '../src/candidate-authority-successor-contracts.ts';
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
  process.stderr.write(
    'usage: canonical-routing-correction <validate|preflight>\n',
  );
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
  const paths = [
    'catalog/public-v1/manifest.json',
    CANDIDATE_AUTHORITY_ROUTING_PATH,
    CANDIDATE_AUTHORITY_READINESS_POLICY_V3_PATH,
    CANDIDATE_AUTHORITY_PARTIAL_SEMANTIC_REGISTRY_PATH,
    CANDIDATE_AUTHORITY_PARTIAL_SEMANTIC_REGISTRY_V3_PATH,
    CANDIDATE_AUTHORITY_FIELD_PLAN_V4_PATH,
    CANDIDATE_AUTHORITY_FIELD_PLAN_V5_PATH,
    CANDIDATE_AUTHORITY_FIELD_PLAN_V6_PATH,
    CANDIDATE_AUTHORITY_FIELD_PLAN_V7_PATH,
    CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_PATH,
    CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V2_PATH,
    CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V3_PATH,
    CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V4_PATH,
    CANDIDATE_AUTHORITY_SOURCE_POLICY_V6_PATH,
    CANDIDATE_AUTHORITY_SOURCE_POLICY_V7_PATH,
    CANDIDATE_AUTHORITY_SOURCE_POLICY_V8_PATH,
    CANDIDATE_AUTHORITY_SOURCE_POLICY_V9_PATH,
    CANDIDATE_AUTHORITY_REPLAY_V6_PATH,
    CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V7_PATH,
    CANDIDATE_AUTHORITY_FAILURE_RECORD_V3_PATH,
  ] as const;
  const values = await Promise.all(paths.map((path) => readFile(path, 'utf8')));
  const byPath = new Map(paths.map((path, index) => [path, values[index]]));
  const text = (path: (typeof paths)[number]): string => {
    const value = byPath.get(path);
    if (value === undefined) throw new Error(`missing fixed authority ${path}`);
    return value;
  };
  const json = (path: (typeof paths)[number]): unknown =>
    JSON.parse(text(path)) as unknown;
  const catalog = parsePublicCatalog(text('catalog/public-v1/manifest.json'));
  const routes = parseCandidateAuthorityProviderRoutes({
    catalog,
    authority: json(CANDIDATE_AUTHORITY_ROUTING_PATH),
  });
  const fixed = parseCandidateAuthoritySuccessorFixedAuthorities({
    providerContractV1: text(CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_PATH),
    providerContractV2: text(CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V2_PATH),
    providerContractV3: text(CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V3_PATH),
    providerContractV4: text(CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V4_PATH),
    sourcePolicyV6: text(CANDIDATE_AUTHORITY_SOURCE_POLICY_V6_PATH),
    sourcePolicyV7: text(CANDIDATE_AUTHORITY_SOURCE_POLICY_V7_PATH),
    sourcePolicyV8: text(CANDIDATE_AUTHORITY_SOURCE_POLICY_V8_PATH),
    sourcePolicyV9: text(CANDIDATE_AUTHORITY_SOURCE_POLICY_V9_PATH),
    replayV6: text(CANDIDATE_AUTHORITY_REPLAY_V6_PATH),
    authorizationV7: text(CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V7_PATH),
  });
  validateCandidateAuthorityCanonicalRoutingAuthorities({
    failureRecordV3: json(CANDIDATE_AUTHORITY_FAILURE_RECORD_V3_PATH),
    fieldPlanV7: json(CANDIDATE_AUTHORITY_FIELD_PLAN_V7_PATH),
    providerContractV4: json(CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V4_PATH),
    sourcePolicyV9: json(CANDIDATE_AUTHORITY_SOURCE_POLICY_V9_PATH),
    replayV6: json(CANDIDATE_AUTHORITY_REPLAY_V6_PATH),
    authorizationV7: json(CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V7_PATH),
  });
  const registryV2 = parseCandidateAuthorityPartialSemanticRegistry(
    json(CANDIDATE_AUTHORITY_PARTIAL_SEMANTIC_REGISTRY_PATH),
  );
  const registryV3 = parseCandidateAuthorityPartialSemanticRegistryV3(
    json(CANDIDATE_AUTHORITY_PARTIAL_SEMANTIC_REGISTRY_V3_PATH),
  );
  const planV4 = parseCandidateAuthorityFieldPlanV4(
    json(CANDIDATE_AUTHORITY_FIELD_PLAN_V4_PATH),
    parseCandidateAuthorityReadinessPolicyV3(
      json(CANDIDATE_AUTHORITY_READINESS_POLICY_V3_PATH),
    ),
    registryV2,
  );
  const planV7 = materializeCandidateAuthorityFieldPlanV7({
    predecessor: materializeCandidateAuthorityFieldPlanV6({
      predecessor: materializeCandidateAuthorityFieldPlanV5({
        predecessor: planV4,
        successorAuthority: json(CANDIDATE_AUTHORITY_FIELD_PLAN_V5_PATH),
      }),
      successorAuthority: json(CANDIDATE_AUTHORITY_FIELD_PLAN_V6_PATH),
      partialSemanticRegistry: registryV3,
    }),
    successorAuthority: json(CANDIDATE_AUTHORITY_FIELD_PLAN_V7_PATH),
  });
  return Object.freeze({
    status: 'passed',
    candidateCount: catalog.candidates.length,
    mappedNpmCount: catalog.candidates.filter(
      ({ npmPackage }) => npmPackage !== null,
    ).length,
    routeCount: routes.routes.length,
    unchangedRoutes: routes.unchangedCount,
    redirectedRoutes: routes.redirectedCount,
    sourcePolicyVersion: fixed.sourcePolicy.policyVersion,
    authorizationVersion: fixed.authorization.version,
    operationCount: fixed.sourcePolicy.operations.length,
    plannedExtractionCapable: planV7.fields.filter(
      ({ plannedExtractionCapable }) => plannedExtractionCapable,
    ).length,
    plannedDeterministicFullClosure: planV7.fields.filter(
      ({ deterministicFullClosureCandidate }) =>
        deterministicFullClosureCandidate,
    ).length,
    requestCeilings: fixed.sourcePolicy.requestBudget,
  });
}
