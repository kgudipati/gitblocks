import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  modelExecutionModelProfileDigest,
  parseModelExecutionModelProfileV1,
  type ModelExecutionModelProfileV1,
} from '@gitblocks/contracts';
import { loadRepositoryInterviewEvaluationCorpusV1 } from '@gitblocks/evaluation-harness';
import {
  parsePublicArtifactManifest,
  parsePublicCatalog,
} from '@gitblocks/ingestion';
import {
  loadRepositoryInterviewSpecification,
  serializeCanonicalJson,
  sha256Digest,
} from '@gitblocks/interviews';
import {
  createRepositoryInterviewCandidatePlanV1,
  parseRepositoryInterviewCandidatePlanV1,
  REPOSITORY_INTERVIEW_ARTIFACT_MANIFEST_DIGEST,
  REPOSITORY_INTERVIEW_CATALOG_DIGEST,
  REPOSITORY_INTERVIEW_OPERATOR_SCHEMA_SNAPSHOTS,
  type RepositoryInterviewCandidatePlanV1,
} from '@gitblocks/repository-interview-operator';

import {
  createRepositoryInterviewOfflineVerificationReportV1,
  createRepositoryInterviewPreliveManifestV1,
  createRepositoryInterviewPreliveReadinessPolicyV1,
  parseRepositoryInterviewOfflineVerificationReportV1,
  parseRepositoryInterviewPreliveManifestV1,
  parseRepositoryInterviewPreliveReadinessPolicyV1,
  type RepositoryInterviewOfflineVerificationReportV1,
  type RepositoryInterviewPreliveManifestV1,
  type RepositoryInterviewPreliveReadinessPolicyV1,
} from './authorities.ts';

const VERIFICATION_RELATIVE_ROOT = 'verification/repository-interviews-v1';
const CALIBRATION_PLAN_PATH = 'plans/calibration-six.plan.json';
const GATE_A_PLAN_PATH = 'plans/gate-a-thirty.plan.json';
const GATE_B_PLAN_PATH = 'plans/gate-b-one-hundred-fifty.plan.json';
const FULL_PROFILE_PATH = 'profiles/gpt-5.4-2026-03-05.json';
const MINI_PROFILE_PATH = 'profiles/gpt-5.4-mini-2026-03-17.json';
const READINESS_PATH = 'readiness-policy.json';
const REPORT_PATH = 'offline-verification-report.json';
const MANIFEST_PATH = 'manifest.json';

const OPERATOR_SELECTION_SCHEMA_DIGEST =
  'e66956879ecfd3ef878513dcaa9f454d6b4cc7a035b5176c26a7b9f4a204c7a3';
const OPERATOR_POLICY_SCHEMA_DIGEST =
  '6147c1a4e47680a6c5e6a760bbc27d4bdfea5e8b1a7dd93e67a080bb6ce7184e';
const OPERATOR_RECEIPT_SCHEMA_DIGEST =
  '934ba36ee7bf6640b1886507123978e0421dc56bc98c2fe02583f31a402187c5';

export interface RepositoryInterviewPreliveExpectedV1 {
  readonly files: ReadonlyMap<string, string>;
  readonly catalogCandidateIds: readonly string[];
  readonly plans: {
    readonly calibration: RepositoryInterviewCandidatePlanV1;
    readonly gateA: RepositoryInterviewCandidatePlanV1;
    readonly gateB: RepositoryInterviewCandidatePlanV1;
  };
  readonly profiles: readonly [
    ModelExecutionModelProfileV1,
    ModelExecutionModelProfileV1,
  ];
  readonly readiness: RepositoryInterviewPreliveReadinessPolicyV1;
  readonly report: RepositoryInterviewOfflineVerificationReportV1;
  readonly manifest: RepositoryInterviewPreliveManifestV1;
  readonly schemaDigests: {
    readonly candidatePlan: string;
    readonly selectionMaterialization: string;
    readonly preliveAuthorization: string;
  };
}

export function validateCommittedRepositoryInterviewCandidatePlanV1(
  input: unknown,
  plans: RepositoryInterviewPreliveExpectedV1['plans'],
): RepositoryInterviewCandidatePlanV1 {
  const parsed = parseRepositoryInterviewCandidatePlanV1(input);
  if (!parsed.ok) throw invalid();
  const accepted = Object.values(plans).find(
    (plan) =>
      plan.planId === parsed.value.planId &&
      plan.planDigest === parsed.value.planDigest,
  );
  if (accepted === undefined) throw invalid();
  return accepted;
}

export function validateCommittedRepositoryInterviewModelProfileV1(
  input: unknown,
  profiles: RepositoryInterviewPreliveExpectedV1['profiles'],
): ModelExecutionModelProfileV1 {
  const parsed = parseModelExecutionModelProfileV1(input);
  if (!parsed.ok) throw invalid();
  const parsedDigest = modelExecutionModelProfileDigest(parsed.value);
  const parsedBytes = serializeCanonicalJson(parsed.value);
  const accepted = profiles.find(
    (profile) =>
      modelExecutionModelProfileDigest(profile) === parsedDigest &&
      serializeCanonicalJson(profile) === parsedBytes,
  );
  if (accepted === undefined) throw invalid();
  return Object.freeze({ ...accepted });
}

export async function buildRepositoryInterviewPreliveExpectedV1(
  repositoryRoot: string,
): Promise<RepositoryInterviewPreliveExpectedV1> {
  const catalog = parsePublicCatalog(
    await readFile(
      join(repositoryRoot, 'catalog/public-v1/manifest.json'),
      'utf8',
    ),
  );
  const artifactManifest = parsePublicArtifactManifest(
    await readFile(
      join(repositoryRoot, 'catalog/public-v1/artifact-manifest.json'),
      'utf8',
    ),
    catalog,
  );
  if (
    catalog.manifestDigest !== REPOSITORY_INTERVIEW_CATALOG_DIGEST ||
    artifactManifest.manifestDigest !==
      REPOSITORY_INTERVIEW_ARTIFACT_MANIFEST_DIGEST ||
    catalog.candidates.length !== 150
  )
    throw invalid();
  const evaluation = loadRepositoryInterviewEvaluationCorpusV1(repositoryRoot);
  if (!evaluation.ok) throw invalid();
  const specification = await loadRepositoryInterviewSpecification(
    join(repositoryRoot, 'interviews/repository/specifications/1.0.0'),
  );
  const calibrationIds = [
    ...evaluation.corpus.policies.cohort.calibrationCandidateIds,
  ].sort(compareText);
  const gateAIds = [...evaluation.corpus.policies.cohort.candidateIds].sort(
    compareText,
  );
  const catalogCandidateIds = catalog.candidates.map(
    ({ candidateId }) => candidateId,
  );
  if (
    calibrationIds.length !== 6 ||
    gateAIds.length !== 30 ||
    catalogCandidateIds.length !== 150 ||
    !sameSet(calibrationIds, [
      'audit-datadog-trace-js',
      'auth-warrant',
      'jobs-dagster',
      'jobs-node-cron',
      'rate-redis-cell',
      'webhook-hookdeck',
    ])
  )
    throw invalid();
  const calibration = plan(
    'repository-interview-calibration-six-v1',
    calibrationIds,
  );
  const gateA = plan('repository-interview-gate-a-thirty-v1', gateAIds);
  const gateB = plan(
    'repository-interview-gate-b-one-hundred-fifty-v1',
    catalogCandidateIds,
  );
  const profiles = Object.freeze([
    profile('gpt-5.4-2026-03-05'),
    profile('gpt-5.4-mini-2026-03-17'),
  ] as const);
  const schemaFiles = new Map(
    Object.entries(REPOSITORY_INTERVIEW_OPERATOR_SCHEMA_SNAPSHOTS).map(
      ([name, schema]) => [name, serializeCanonicalJson(schema)],
    ),
  );
  const schemaDigest = (name: string): string => {
    const bytes = schemaFiles.get(name);
    if (bytes === undefined) throw invalid();
    return sha256Digest(bytes);
  };
  if (
    schemaDigest('repository-interview-operator-selection-v1.schema.json') !==
      OPERATOR_SELECTION_SCHEMA_DIGEST ||
    schemaDigest('repository-interview-operator-policy-v1.schema.json') !==
      OPERATOR_POLICY_SCHEMA_DIGEST ||
    schemaDigest('repository-interview-operator-receipt-v1.schema.json') !==
      OPERATOR_RECEIPT_SCHEMA_DIGEST
  )
    throw invalid();
  const schemaDigests = Object.freeze({
    candidatePlan: schemaDigest(
      'repository-interview-candidate-plan-v1.schema.json',
    ),
    selectionMaterialization: schemaDigest(
      'repository-interview-selection-materialization-v1.schema.json',
    ),
    preliveAuthorization: schemaDigest(
      'repository-interview-prelive-authorization-v1.schema.json',
    ),
  });
  const readiness = createRepositoryInterviewPreliveReadinessPolicyV1({
    'offline-verification': 'satisfied',
    'fresh-artifact-materialization': 'unsatisfied',
    'retention-authority': 'unsatisfied',
    'pricing-authority': 'unsatisfied',
    'model-calibration': 'unsatisfied',
    'maintainer-live-authorization': 'unsatisfied',
    'ephemeral-database': 'unsatisfied',
    'provider-credential': 'unsatisfied',
    'audit-assignment-readiness': 'unsatisfied',
  });
  const profileDigests = profiles
    .map(modelExecutionModelProfileDigest)
    .sort(compareText) as [string, string];
  const report = createRepositoryInterviewOfflineVerificationReportV1({
    catalogDigest: catalog.manifestDigest,
    artifactManifestDigest: artifactManifest.manifestDigest,
    specificationDigest: specification.manifest.specificationDigest,
    providerOutputSchemaDigest:
      specification.manifest.providerOutputSchema.digest,
    providerProjectionDigest: specification.manifest.openAiProjection.digest,
    evaluationCorpusDigest: evaluation.corpus.manifest.corpusDigest,
    operatorSelectionSchemaDigest: OPERATOR_SELECTION_SCHEMA_DIGEST,
    operatorPolicySchemaDigest: OPERATOR_POLICY_SCHEMA_DIGEST,
    operatorReceiptSchemaDigest: OPERATOR_RECEIPT_SCHEMA_DIGEST,
    candidatePlanSchemaDigest: schemaDigests.candidatePlan,
    selectionMaterializationSchemaDigest:
      schemaDigests.selectionMaterialization,
    preliveAuthorizationSchemaDigest: schemaDigests.preliveAuthorization,
    calibrationPlanDigest: calibration.planDigest,
    gateAPlanDigest: gateA.planDigest,
    gateBPlanDigest: gateB.planDigest,
    fullCandidateCount: 150,
    calibrationCandidateCount: 6,
    gateACandidateCount: 30,
    modelProfileDigests: profileDigests,
  });
  const files = new Map<string, string>([
    [CALIBRATION_PLAN_PATH, serializeCanonicalJson(calibration)],
    [GATE_A_PLAN_PATH, serializeCanonicalJson(gateA)],
    [GATE_B_PLAN_PATH, serializeCanonicalJson(gateB)],
    [FULL_PROFILE_PATH, serializeCanonicalJson(profiles[0])],
    [MINI_PROFILE_PATH, serializeCanonicalJson(profiles[1])],
    [READINESS_PATH, serializeCanonicalJson(readiness)],
    [REPORT_PATH, serializeCanonicalJson(report)],
  ]);
  const manifest = createRepositoryInterviewPreliveManifestV1({
    schemaVersion: '1.0.0',
    verificationId: 'repository-interviews-prelive-v1',
    verificationVersion: '1.0.0',
    status: 'offline-verified-live-blocked',
    catalogVersion: 'public-v1',
    catalogDigest: catalog.manifestDigest,
    artifactManifestVersion: 'public-artifacts-v1',
    artifactManifestDigest: artifactManifest.manifestDigest,
    specificationVersion: '1.0.0',
    specificationDigest: specification.manifest.specificationDigest,
    providerOutputSchemaDigest:
      specification.manifest.providerOutputSchema.digest,
    providerProjectionDigest: specification.manifest.openAiProjection.digest,
    evaluationCorpusId: 'repository-interviews-v1',
    evaluationCorpusVersion: '1.0.0',
    evaluationCorpusDigest: evaluation.corpus.manifest.corpusDigest,
    operatorSelectionSchemaDigest: OPERATOR_SELECTION_SCHEMA_DIGEST,
    operatorPolicySchemaDigest: OPERATOR_POLICY_SCHEMA_DIGEST,
    operatorReceiptSchemaDigest: OPERATOR_RECEIPT_SCHEMA_DIGEST,
    candidatePlanSchemaDigest: schemaDigests.candidatePlan,
    selectionMaterializationSchemaDigest:
      schemaDigests.selectionMaterialization,
    preliveAuthorizationSchemaDigest: schemaDigests.preliveAuthorization,
    candidatePlanMembers: [
      member(CALIBRATION_PLAN_PATH, files),
      member(GATE_A_PLAN_PATH, files),
      member(GATE_B_PLAN_PATH, files),
    ],
    modelProfileMembers: [
      {
        path: FULL_PROFILE_PATH,
        modelProfileDigest: modelExecutionModelProfileDigest(profiles[0]),
      },
      {
        path: MINI_PROFILE_PATH,
        modelProfileDigest: modelExecutionModelProfileDigest(profiles[1]),
      },
    ],
    readinessPolicy: member(READINESS_PATH, files),
    offlineReport: member(REPORT_PATH, files),
  });
  files.set(MANIFEST_PATH, serializeCanonicalJson(manifest));
  return Object.freeze({
    files,
    catalogCandidateIds: Object.freeze(catalogCandidateIds),
    plans: Object.freeze({ calibration, gateA, gateB }),
    profiles,
    readiness,
    report,
    manifest,
    schemaDigests,
  });
}

export async function generateRepositoryInterviewPreliveFilesV1(
  repositoryRoot: string,
): Promise<RepositoryInterviewPreliveExpectedV1> {
  const expected =
    await buildRepositoryInterviewPreliveExpectedV1(repositoryRoot);
  const root = join(repositoryRoot, VERIFICATION_RELATIVE_ROOT);
  await mkdir(join(root, 'plans'), { recursive: true });
  await mkdir(join(root, 'profiles'), { recursive: true });
  for (const [path, content] of expected.files) {
    await writeFile(join(root, path), content, 'utf8');
  }
  return expected;
}

export async function validateRepositoryInterviewPreliveFilesV1(
  repositoryRoot: string,
): Promise<RepositoryInterviewPreliveExpectedV1> {
  const expected =
    await buildRepositoryInterviewPreliveExpectedV1(repositoryRoot);
  const root = join(repositoryRoot, VERIFICATION_RELATIVE_ROOT);
  const actualPaths = (await listFiles(root)).sort(compareText);
  const expectedPaths = ['README.md', ...expected.files.keys()].sort(
    compareText,
  );
  if (!sameSet(actualPaths, expectedPaths)) throw invalid();
  for (const [path, content] of expected.files) {
    const actual = await readFile(join(root, path), 'utf8');
    if (actual !== content || actual.charCodeAt(0) === 0xfeff) throw invalid();
  }
  for (const [name, schema] of Object.entries(
    REPOSITORY_INTERVIEW_OPERATOR_SCHEMA_SNAPSHOTS,
  )) {
    const actual = await readFile(
      join(repositoryRoot, 'apps/repository-interview-operator/schemas', name),
      'utf8',
    );
    if (actual !== serializeCanonicalJson(schema)) throw invalid();
  }
  for (const path of [
    CALIBRATION_PLAN_PATH,
    GATE_A_PLAN_PATH,
    GATE_B_PLAN_PATH,
  ]) {
    const parsed = parseRepositoryInterviewCandidatePlanV1(
      JSON.parse(await readFile(join(root, path), 'utf8')) as unknown,
    );
    if (!parsed.ok) throw invalid();
  }
  for (const path of [FULL_PROFILE_PATH, MINI_PROFILE_PATH]) {
    const parsed = parseModelExecutionModelProfileV1(
      JSON.parse(await readFile(join(root, path), 'utf8')) as unknown,
    );
    if (!parsed.ok) throw invalid();
  }
  parseRepositoryInterviewPreliveReadinessPolicyV1(
    JSON.parse(await readFile(join(root, READINESS_PATH), 'utf8')) as unknown,
  );
  parseRepositoryInterviewOfflineVerificationReportV1(
    JSON.parse(await readFile(join(root, REPORT_PATH), 'utf8')) as unknown,
  );
  const manifest = parseRepositoryInterviewPreliveManifestV1(
    JSON.parse(await readFile(join(root, MANIFEST_PATH), 'utf8')) as unknown,
  );
  for (const member of manifest.candidatePlanMembers) {
    if (sha256Digest(await readFile(join(root, member.path))) !== member.sha256)
      throw invalid();
  }
  for (const member of [manifest.readinessPolicy, manifest.offlineReport]) {
    if (sha256Digest(await readFile(join(root, member.path))) !== member.sha256)
      throw invalid();
  }
  return expected;
}

export function repositoryInterviewPreliveSummaryV1(
  expected: RepositoryInterviewPreliveExpectedV1,
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    status: expected.manifest.status,
    candidatePlanCounts: Object.freeze({
      calibration: expected.plans.calibration.candidateIds.length,
      gateA: expected.plans.gateA.candidateIds.length,
      gateB: expected.plans.gateB.candidateIds.length,
    }),
    modelProfileCount: expected.profiles.length,
    modelSelected: false,
    liveReady: expected.readiness.liveReady,
    manifestDigest: expected.manifest.manifestDigest,
  });
}

function plan(
  planId: string,
  candidateIds: readonly string[],
): RepositoryInterviewCandidatePlanV1 {
  return createRepositoryInterviewCandidatePlanV1({
    schemaVersion: '1.0.0',
    planId,
    catalogVersion: 'public-v1',
    catalogDigest: REPOSITORY_INTERVIEW_CATALOG_DIGEST,
    artifactManifestVersion: 'public-artifacts-v1',
    artifactManifestDigest: REPOSITORY_INTERVIEW_ARTIFACT_MANIFEST_DIGEST,
    candidateIds,
  });
}

function profile(modelSnapshot: string): ModelExecutionModelProfileV1 {
  const parsed = parseModelExecutionModelProfileV1({
    provider: 'openai',
    endpointProfile: 'responses-v1',
    modelSnapshot,
    providerProjectionVersion: '1.0.0',
    providerProjectionDigest:
      '5d81e5e32cc4871f0068f691302282a4e5dd6dc656ee4be132c050fbc4228ed7',
    reasoningEffort: 'low',
    maximumOutputTokens: 8_192,
    maximumResponseBytes: 2_097_152,
    store: false,
    toolsEnabled: false,
    background: false,
    conversationState: false,
    previousResponseState: false,
    truncation: 'disabled',
    promptCacheRetention: 'in-memory',
    serviceTier: 'default',
    retryPolicyVersion: 'repository-interview-retry-v1',
  });
  if (!parsed.ok) throw invalid();
  return parsed.value;
}

function member(path: string, files: ReadonlyMap<string, string>) {
  const content = files.get(path);
  if (content === undefined) throw invalid();
  return Object.freeze({ path, sha256: sha256Digest(content) });
}

async function listFiles(root: string, prefix = ''): Promise<string[]> {
  const entries = await readdir(join(root, prefix), { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = prefix.length === 0 ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory()) files.push(...(await listFiles(root, path)));
    else if (entry.isFile()) files.push(path);
    else throw invalid();
  }
  return files;
}

function sameSet(left: readonly string[], right: readonly string[]): boolean {
  return (
    left.length === right.length &&
    [...left]
      .sort(compareText)
      .every((value, index) => value === [...right].sort(compareText)[index])
  );
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function invalid(): Error {
  const error = new Error('Repository interview pre-live verification failed.');
  Object.defineProperty(error, 'stack', { value: undefined });
  return error;
}
