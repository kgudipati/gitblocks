import { readFile } from 'node:fs/promises';

import {
  CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V4_PATH,
  CANDIDATE_AUTHORITY_ROUTING_PATH,
} from '../src/candidate-authority-canonical-routing-correction.ts';
import {
  CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V8_DIGEST,
  CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V8_PATH,
  CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V5_DIGEST,
  CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V5_PATH,
  CANDIDATE_AUTHORITY_REPLAY_V7_DIGEST,
  CANDIDATE_AUTHORITY_REPLAY_V7_PATH,
  CANDIDATE_AUTHORITY_SOURCE_POLICY_V10_DIGEST,
  CANDIDATE_AUTHORITY_SOURCE_POLICY_V10_PATH,
  validateCandidateAuthorityLinkageEvidenceAuthorities,
} from '../src/candidate-authority-linkage-evidence-correction.ts';
import { parseCandidateAuthorityProviderRoutes } from '../src/candidate-authority-canonical-routing-correction.ts';
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
    'usage: linkage-evidence-correction <validate|preflight>\n',
  );
  process.exitCode = 1;
} else {
  const [
    catalogText,
    routingText,
    providerV4Text,
    providerV5Text,
    sourceV10Text,
    replayV7Text,
    authorizationV8Text,
    adr15,
    adr16,
  ] = await Promise.all([
    readFile('catalog/public-v1/manifest.json', 'utf8'),
    readFile(CANDIDATE_AUTHORITY_ROUTING_PATH, 'utf8'),
    readFile(CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V4_PATH, 'utf8'),
    readFile(CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V5_PATH, 'utf8'),
    readFile(CANDIDATE_AUTHORITY_SOURCE_POLICY_V10_PATH, 'utf8'),
    readFile(CANDIDATE_AUTHORITY_REPLAY_V7_PATH, 'utf8'),
    readFile(CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V8_PATH, 'utf8'),
    readFile(
      'docs/architecture/decisions/0015-bind-canonical-provider-routes.md',
      'utf8',
    ),
    readFile(
      'docs/architecture/decisions/0016-ground-derived-package-linkage-with-complete-multi-source-evidence.md',
      'utf8',
    ),
  ]);
  validateCandidateAuthorityLinkageEvidenceAuthorities({
    providerContractV5: JSON.parse(providerV5Text) as unknown,
    sourcePolicyV10: JSON.parse(sourceV10Text) as unknown,
    replayV7: JSON.parse(replayV7Text) as unknown,
    authorizationV8: JSON.parse(authorizationV8Text) as unknown,
  });
  const catalog = parsePublicCatalog(catalogText);
  const routes = parseCandidateAuthorityProviderRoutes({
    catalog,
    authority: JSON.parse(routingText) as unknown,
  });
  const providerV4 = JSON.parse(providerV4Text) as Readonly<
    Record<string, unknown>
  >;
  if (
    routes.routes.length !== 150 ||
    routes.unchangedCount !== 146 ||
    routes.redirectedCount !== 4 ||
    providerV4['contractVersion'] !==
      'candidate-authority-provider-contract/4.0.0' ||
    !adr15.includes('Status: Accepted') ||
    !adr15.includes('2be3d5950cc69572b5b45fc641848fed112fc112') ||
    !adr16.includes('Status: Proposed for independent exact-head acceptance')
  ) {
    throw new Error('linkage evidence correction authority mismatch');
  }
  const result = {
    status: 'passed',
    command: `candidate-authority-linkage-evidence-${command}`,
    candidateCount: catalog.candidates.length,
    routeCount: routes.routes.length,
    unchangedRoutes: routes.unchangedCount,
    redirectedRoutes: routes.redirectedCount,
    providerContractDigest: CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V5_DIGEST,
    sourcePolicyDigest: CANDIDATE_AUTHORITY_SOURCE_POLICY_V10_DIGEST,
    replayDigest: CANDIDATE_AUTHORITY_REPLAY_V7_DIGEST,
    authorizationDigest: CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V8_DIGEST,
    maximumCompleteSourcesPerKnownField: 2,
    operationCount: 13,
    ...(command === 'preflight' ? { effectAudit: ZERO_EFFECT_AUDIT } : {}),
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
