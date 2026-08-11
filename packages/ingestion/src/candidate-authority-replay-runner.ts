import {
  parseCapabilityTaxonomyV1,
  type CapabilityTaxonomyV1,
} from '@gitblocks/contracts';

import {
  CANDIDATE_AUTHORITY_DOSSIER_AUTHORITY_PATH,
  CANDIDATE_AUTHORITY_DOSSIER_PROJECTION_AUTHORITY_PATH,
  CANDIDATE_AUTHORITY_EVIDENCE_AUTHORITY_PATH,
  CANDIDATE_AUTHORITY_EVIDENCE_STAGING_PATH,
  CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_DIGEST,
  CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_PATH,
  CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_VERSION,
  CANDIDATE_AUTHORITY_PARTIAL_AUTHORITY_PATH,
  CANDIDATE_AUTHORITY_PARTIAL_STAGING_PATH,
  CANDIDATE_AUTHORITY_PROFILE_AUTHORITY_PATH,
  CANDIDATE_AUTHORITY_PROFILE_STAGING_PATH,
  CANDIDATE_AUTHORITY_READINESS_REPORT_PATH,
  CANDIDATE_AUTHORITY_READINESS_STAGING_PATH,
  CANDIDATE_AUTHORITY_ROOT_INSTANCE_PATH,
  CANDIDATE_AUTHORITY_ROOT_STAGING_PATH,
  CANDIDATE_AUTHORITY_SOURCE_AUTHORITY_PATH,
  CANDIDATE_AUTHORITY_SOURCE_MAXIMUM_SERIALIZED_BYTES,
  CANDIDATE_AUTHORITY_DOSSIER_PROJECTION_STAGING_PATH,
  CANDIDATE_AUTHORITY_DOSSIER_STAGING_PATH,
  parseCandidateAuthorityLiveAuthorization,
  parseCandidateAuthoritySourceAuthority,
  serializeCandidateAuthoritySourceAuthority,
  type CandidateAuthoritySourceAuthorityV1,
} from './candidate-authority-live-contracts.ts';
import { measureCandidateAuthorityReadiness } from './candidate-authority-measurement.ts';
import {
  CANDIDATE_AUTHORITY_PARTIAL_EVIDENCE_CONTRACT_DIGEST,
  CANDIDATE_AUTHORITY_PARTIAL_EVIDENCE_VERSION,
} from './candidate-authority-partial-evidence.ts';
import {
  CANDIDATE_AUTHORITY_PARTIAL_SEMANTIC_REGISTRY_DIGEST,
  CANDIDATE_AUTHORITY_PARTIAL_SEMANTIC_REGISTRY_PATH,
  CANDIDATE_AUTHORITY_PARTIAL_SEMANTIC_REGISTRY_VERSION,
  parseCandidateAuthorityPartialSemanticRegistry,
  type CandidateAuthorityPartialSemanticRegistry,
} from './candidate-authority-partial-semantics.ts';
import {
  CANDIDATE_AUTHORITY_DOSSIER_MAXIMUM_SERIALIZED_BYTES,
  CANDIDATE_AUTHORITY_DOSSIER_PROJECTION_MAXIMUM_SERIALIZED_BYTES,
  CANDIDATE_AUTHORITY_EVIDENCE_MAXIMUM_SERIALIZED_BYTES,
  CANDIDATE_AUTHORITY_PARTIAL_MAXIMUM_SERIALIZED_BYTES,
  CANDIDATE_AUTHORITY_PROFILE_MAXIMUM_SERIALIZED_BYTES,
  CANDIDATE_AUTHORITY_READINESS_MAXIMUM_SERIALIZED_BYTES,
  CANDIDATE_AUTHORITY_ROOT_MAXIMUM_SERIALIZED_BYTES,
  canonicalReplayAuthorityText,
  type CandidateAuthorityRealizedReadinessReportV1,
  type CandidateAuthorityReplayBundle,
} from './candidate-authority-replay-contracts.ts';
import {
  CANDIDATE_AUTHORITY_FIELD_PLAN_V4_DIGEST,
  CANDIDATE_AUTHORITY_FIELD_PLAN_V4_PATH,
  CANDIDATE_AUTHORITY_FIELD_PLAN_V4_VERSION,
  CANDIDATE_AUTHORITY_READINESS_POLICY_V3_DIGEST,
  CANDIDATE_AUTHORITY_READINESS_POLICY_V3_PATH,
  CANDIDATE_AUTHORITY_READINESS_POLICY_V3_VERSION,
  CANDIDATE_AUTHORITY_SOURCE_POLICY_V5_DIGEST,
  CANDIDATE_AUTHORITY_SOURCE_POLICY_V5_PATH,
  CANDIDATE_AUTHORITY_SOURCE_POLICY_V5_VERSION,
  candidateAuthorityRootV4SemanticDigest,
  parseCandidateAuthorityFieldPlanV4,
  parseCandidateAuthorityReadinessPolicyV3,
  parseCandidateAuthoritySourcePolicyV5,
  type CandidateAuthorityFieldPlanV4,
  type CandidateAuthorityRootV4,
} from './candidate-authority-readiness.ts';
import { generateCandidateAuthorityReplay } from './candidate-authority-replay.ts';
import { ingestionError } from './errors.ts';
import { parsePublicCatalog } from './manifest.ts';
import type { PublicCatalog } from './types.ts';

export const CANDIDATE_AUTHORITY_REPLAY_CATALOG_PATH =
  'catalog/public-v1/manifest.json' as const;
export const CANDIDATE_AUTHORITY_REPLAY_TAXONOMY_PATH =
  'catalog/capability-taxonomy/1.0.0/manifest.json' as const;
export const CANDIDATE_AUTHORITY_REPLAY_INPUT_MAXIMUM_BYTES =
  32 * 1_024 * 1_024;

export const CANDIDATE_AUTHORITY_REPLAY_OUTPUTS = Object.freeze([
  Object.freeze({
    path: CANDIDATE_AUTHORITY_PROFILE_AUTHORITY_PATH,
    maximumBytes: CANDIDATE_AUTHORITY_PROFILE_MAXIMUM_SERIALIZED_BYTES,
  }),
  Object.freeze({
    path: CANDIDATE_AUTHORITY_PARTIAL_AUTHORITY_PATH,
    maximumBytes: CANDIDATE_AUTHORITY_PARTIAL_MAXIMUM_SERIALIZED_BYTES,
  }),
  Object.freeze({
    path: CANDIDATE_AUTHORITY_EVIDENCE_AUTHORITY_PATH,
    maximumBytes: CANDIDATE_AUTHORITY_EVIDENCE_MAXIMUM_SERIALIZED_BYTES,
  }),
  Object.freeze({
    path: CANDIDATE_AUTHORITY_DOSSIER_AUTHORITY_PATH,
    maximumBytes: CANDIDATE_AUTHORITY_DOSSIER_MAXIMUM_SERIALIZED_BYTES,
  }),
  Object.freeze({
    path: CANDIDATE_AUTHORITY_DOSSIER_PROJECTION_AUTHORITY_PATH,
    maximumBytes:
      CANDIDATE_AUTHORITY_DOSSIER_PROJECTION_MAXIMUM_SERIALIZED_BYTES,
  }),
] as const);

export const CANDIDATE_AUTHORITY_READINESS_OUTPUTS = Object.freeze([
  Object.freeze({
    path: CANDIDATE_AUTHORITY_READINESS_REPORT_PATH,
    maximumBytes: CANDIDATE_AUTHORITY_READINESS_MAXIMUM_SERIALIZED_BYTES,
  }),
  Object.freeze({
    path: CANDIDATE_AUTHORITY_ROOT_INSTANCE_PATH,
    maximumBytes: CANDIDATE_AUTHORITY_ROOT_MAXIMUM_SERIALIZED_BYTES,
  }),
] as const);

export const CANDIDATE_AUTHORITY_REPLAY_STAGING_PATHS = Object.freeze([
  CANDIDATE_AUTHORITY_PROFILE_STAGING_PATH,
  CANDIDATE_AUTHORITY_PARTIAL_STAGING_PATH,
  CANDIDATE_AUTHORITY_EVIDENCE_STAGING_PATH,
  CANDIDATE_AUTHORITY_DOSSIER_STAGING_PATH,
  CANDIDATE_AUTHORITY_DOSSIER_PROJECTION_STAGING_PATH,
  CANDIDATE_AUTHORITY_READINESS_STAGING_PATH,
  CANDIDATE_AUTHORITY_ROOT_STAGING_PATH,
] as const);

export interface CandidateAuthorityReplayGitState {
  readonly branch: string;
  readonly head: string;
  readonly originHead: string;
  readonly sourceFreezeHead: string | null;
  readonly sourceFreezeParentHead: string | null;
  readonly sourceFreezeIsAncestor: boolean;
  readonly clean: boolean;
  readonly sourceCommitPaths: readonly string[];
  readonly workingPaths: readonly string[];
  readonly sourceTrackedAtHead: boolean;
  readonly sourceBytesAtHead: string | null;
  readonly sourceBytesAtFreezeHead: string | null;
}

export interface CandidateAuthorityReplayReadEffects {
  readonly readFixedFile: (
    path: string,
    maximumBytes: number,
  ) => Promise<string>;
  readonly requirePathMissing: (path: string) => Promise<void>;
  readonly readGitState: () => Promise<CandidateAuthorityReplayGitState>;
}

export interface CandidateAuthorityReplayWriteEffects extends CandidateAuthorityReplayReadEffects {
  readonly publishExclusive: (
    outputs: readonly {
      readonly path: string;
      readonly text: string;
      readonly maximumBytes: number;
    }[],
  ) => Promise<void>;
}

interface LoadedReplayInputs {
  readonly catalog: PublicCatalog;
  readonly taxonomy: CapabilityTaxonomyV1;
  readonly sourceAuthority: CandidateAuthoritySourceAuthorityV1;
  readonly fieldPlan: CandidateAuthorityFieldPlanV4;
  readonly partialSemanticRegistry: CandidateAuthorityPartialSemanticRegistry;
}

export interface CandidateAuthorityReplayPreflightResult {
  readonly status: 'passed';
  readonly command: 'candidate-authority-replay-preflight';
  readonly git: CandidateAuthorityReplayGitState;
  readonly sourceAuthorityDigest: string;
  readonly candidateCount: 150;
  readonly effectAudit: CandidateAuthorityReplayZeroEffectAudit;
}

export interface CandidateAuthorityReplayZeroEffectAudit {
  readonly networkCalls: 0;
  readonly candidateProviderCalls: 0;
  readonly credentialReads: 0;
  readonly databaseCalls: 0;
  readonly dockerCalls: 0;
  readonly modelCalls: 0;
  readonly filesystemWrites: 0;
  readonly providerCollections: 0;
  readonly sourceAuthoritiesGenerated: 0;
  readonly allCandidateProjections: 0;
  readonly coverageCalculations: 0;
}

const ZERO_EFFECT_AUDIT: CandidateAuthorityReplayZeroEffectAudit =
  Object.freeze({
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

export async function preflightCandidateAuthorityReplay(
  effects: CandidateAuthorityReplayReadEffects,
): Promise<CandidateAuthorityReplayPreflightResult> {
  const [loaded, git] = await Promise.all([
    loadReplayInputs(effects),
    effects.readGitState(),
    ...[
      ...CANDIDATE_AUTHORITY_REPLAY_OUTPUTS.map(({ path }) => path),
      ...CANDIDATE_AUTHORITY_READINESS_OUTPUTS.map(({ path }) => path),
      ...CANDIDATE_AUTHORITY_REPLAY_STAGING_PATHS,
    ].map((path) => effects.requirePathMissing(path)),
  ]);
  requireCommittedSource(git, loaded.sourceAuthority);
  if (!git.clean) invalid();
  return Object.freeze({
    status: 'passed',
    command: 'candidate-authority-replay-preflight',
    git,
    sourceAuthorityDigest: loaded.sourceAuthority.canonicalAuthorityDigest,
    candidateCount: 150,
    effectAudit: ZERO_EFFECT_AUDIT,
  });
}

export async function generateCandidateAuthorityReplayOutputs(
  effects: CandidateAuthorityReplayWriteEffects,
): Promise<{
  readonly status: 'passed';
  readonly command: 'candidate-authority-replay-generate';
  readonly authorityDigests: Readonly<Record<string, string>>;
}> {
  await preflightCandidateAuthorityReplay(effects);
  const [loaded, git] = await Promise.all([
    loadReplayInputs(effects),
    effects.readGitState(),
  ]);
  requireCommittedSource(git, loaded.sourceAuthority);
  if (!git.clean) invalid();
  const replay = generateCandidateAuthorityReplay(loaded);
  const outputs = replayOutputTexts(replay);
  await effects.publishExclusive(outputs);
  return Object.freeze({
    status: 'passed',
    command: 'candidate-authority-replay-generate',
    authorityDigests: replayDigests(replay),
  });
}

export async function validateCandidateAuthorityReplayOutputs(
  effects: CandidateAuthorityReplayReadEffects,
): Promise<{
  readonly status: 'passed';
  readonly command: 'candidate-authority-replay-validate';
  readonly replay: CandidateAuthorityReplayBundle;
  readonly sourceAuthority: CandidateAuthoritySourceAuthorityV1;
  readonly catalog: PublicCatalog;
  readonly taxonomyVersion: string;
  readonly taxonomyDigest: string;
  readonly fieldPlan: CandidateAuthorityFieldPlanV4;
  readonly authorityDigests: Readonly<Record<string, string>>;
}> {
  return validateReplayOutputsWithAllowedWorkingPaths(
    effects,
    CANDIDATE_AUTHORITY_REPLAY_OUTPUTS,
  );
}

async function validateReplayOutputsWithAllowedWorkingPaths(
  effects: CandidateAuthorityReplayReadEffects,
  allowedWorkingPaths: readonly { readonly path: string }[],
): Promise<{
  readonly status: 'passed';
  readonly command: 'candidate-authority-replay-validate';
  readonly replay: CandidateAuthorityReplayBundle;
  readonly sourceAuthority: CandidateAuthoritySourceAuthorityV1;
  readonly catalog: PublicCatalog;
  readonly taxonomyVersion: string;
  readonly taxonomyDigest: string;
  readonly fieldPlan: CandidateAuthorityFieldPlanV4;
  readonly authorityDigests: Readonly<Record<string, string>>;
}> {
  const [loaded, git] = await Promise.all([
    loadReplayInputs(effects),
    effects.readGitState(),
  ]);
  requireCommittedSource(git, loaded.sourceAuthority);
  requireOnlyExpectedWorkingPaths(git, allowedWorkingPaths);
  const replay = generateCandidateAuthorityReplay(loaded);
  const expected = replayOutputTexts(replay);
  await requireExactOutputs(effects, expected);
  return Object.freeze({
    status: 'passed',
    command: 'candidate-authority-replay-validate',
    replay,
    sourceAuthority: loaded.sourceAuthority,
    catalog: loaded.catalog,
    taxonomyVersion: loaded.taxonomy.taxonomyVersion,
    taxonomyDigest: loaded.taxonomy.semanticDigest,
    fieldPlan: loaded.fieldPlan,
    authorityDigests: replayDigests(replay),
  });
}

export async function measureCandidateAuthorityReadinessOutputs(
  effects: CandidateAuthorityReplayWriteEffects,
): Promise<{
  readonly status: 'passed';
  readonly command: 'candidate-authority-readiness-measure';
  readonly report: CandidateAuthorityRealizedReadinessReportV1;
  readonly root: CandidateAuthorityRootV4;
}> {
  await Promise.all(
    [
      ...CANDIDATE_AUTHORITY_READINESS_OUTPUTS.map(({ path }) => path),
      CANDIDATE_AUTHORITY_READINESS_STAGING_PATH,
      CANDIDATE_AUTHORITY_ROOT_STAGING_PATH,
    ].map((path) => effects.requirePathMissing(path)),
  );
  const validated = await validateCandidateAuthorityReplayOutputs(effects);
  const measured = measureCandidateAuthorityReadiness({
    catalog: validated.catalog,
    taxonomyVersion: validated.taxonomyVersion,
    taxonomyDigest: validated.taxonomyDigest,
    sourceAuthority: validated.sourceAuthority,
    fieldPlan: validated.fieldPlan,
    replay: validated.replay,
  });
  await effects.publishExclusive(readinessOutputTexts(measured));
  return Object.freeze({
    status: 'passed',
    command: 'candidate-authority-readiness-measure',
    ...measured,
  });
}

export async function validateCandidateAuthorityReadinessOutputs(
  effects: CandidateAuthorityReplayReadEffects,
): Promise<{
  readonly status: 'passed';
  readonly command: 'candidate-authority-readiness-validate';
  readonly reportDigest: string;
  readonly rootDigest: string;
  readonly decision: 'go' | 'no-go';
}> {
  const validated = await validateReplayOutputsWithAllowedWorkingPaths(
    effects,
    [
      ...CANDIDATE_AUTHORITY_REPLAY_OUTPUTS,
      ...CANDIDATE_AUTHORITY_READINESS_OUTPUTS,
    ],
  );
  const git = await effects.readGitState();
  requireOnlyExpectedWorkingPaths(git, [
    ...CANDIDATE_AUTHORITY_REPLAY_OUTPUTS,
    ...CANDIDATE_AUTHORITY_READINESS_OUTPUTS,
  ]);
  const measured = measureCandidateAuthorityReadiness({
    catalog: validated.catalog,
    taxonomyVersion: validated.taxonomyVersion,
    taxonomyDigest: validated.taxonomyDigest,
    sourceAuthority: validated.sourceAuthority,
    fieldPlan: validated.fieldPlan,
    replay: validated.replay,
  });
  await requireExactOutputs(effects, readinessOutputTexts(measured));
  return Object.freeze({
    status: 'passed',
    command: 'candidate-authority-readiness-validate',
    reportDigest: measured.report.canonicalReportDigest,
    rootDigest: measured.root.canonicalAuthorityDigest,
    decision: measured.report.readinessDecision,
  });
}

async function loadReplayInputs(
  effects: CandidateAuthorityReplayReadEffects,
): Promise<LoadedReplayInputs> {
  const [
    catalogText,
    taxonomyText,
    readinessText,
    registryText,
    planText,
    sourcePolicyText,
    authorizationText,
    sourceText,
  ] = await Promise.all([
    readInput(effects, CANDIDATE_AUTHORITY_REPLAY_CATALOG_PATH),
    readInput(effects, CANDIDATE_AUTHORITY_REPLAY_TAXONOMY_PATH),
    readInput(effects, CANDIDATE_AUTHORITY_READINESS_POLICY_V3_PATH),
    readInput(effects, CANDIDATE_AUTHORITY_PARTIAL_SEMANTIC_REGISTRY_PATH),
    readInput(effects, CANDIDATE_AUTHORITY_FIELD_PLAN_V4_PATH),
    readInput(effects, CANDIDATE_AUTHORITY_SOURCE_POLICY_V5_PATH),
    readInput(effects, CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_PATH),
    effects.readFixedFile(
      CANDIDATE_AUTHORITY_SOURCE_AUTHORITY_PATH,
      CANDIDATE_AUTHORITY_SOURCE_MAXIMUM_SERIALIZED_BYTES,
    ),
  ]);
  const catalog = parsePublicCatalog(catalogText);
  const taxonomyResult = parseCapabilityTaxonomyV1(
    JSON.parse(taxonomyText) as unknown,
  );
  if (!taxonomyResult.ok) invalid();
  const registry = parseCandidateAuthorityPartialSemanticRegistry(
    JSON.parse(registryText) as unknown,
  );
  const readiness = parseCandidateAuthorityReadinessPolicyV3(
    JSON.parse(readinessText) as unknown,
  );
  const fieldPlan = parseCandidateAuthorityFieldPlanV4(
    JSON.parse(planText) as unknown,
    readiness,
    registry,
  );
  const sourcePolicy = parseCandidateAuthoritySourcePolicyV5(
    JSON.parse(sourcePolicyText) as unknown,
    fieldPlan,
  );
  const authorization = parseCandidateAuthorityLiveAuthorization(
    JSON.parse(authorizationText) as unknown,
  );
  const sourceAuthority = parseCandidateAuthoritySourceAuthority(
    JSON.parse(sourceText) as unknown,
  );
  if (
    serializeCandidateAuthoritySourceAuthority(sourceAuthority) !== sourceText
  )
    invalid();
  const bindings = sourceAuthority.bindings;
  if (
    catalog.candidates.length !== 150 ||
    sourceAuthority.orderedCandidateIds.some(
      (candidateId, index) =>
        candidateId !== catalog.candidates[index]?.candidateId,
    ) ||
    bindings['catalogVersion'] !== catalog.catalogVersion ||
    bindings['catalogDigest'] !== catalog.manifestDigest ||
    bindings['taxonomyVersion'] !== taxonomyResult.value.taxonomyVersion ||
    bindings['taxonomyDigest'] !== taxonomyResult.value.semanticDigest ||
    bindings['readinessPolicyVersion'] !==
      CANDIDATE_AUTHORITY_READINESS_POLICY_V3_VERSION ||
    bindings['readinessPolicyDigest'] !==
      CANDIDATE_AUTHORITY_READINESS_POLICY_V3_DIGEST ||
    bindings['fieldPlanVersion'] !==
      CANDIDATE_AUTHORITY_FIELD_PLAN_V4_VERSION ||
    bindings['fieldPlanDigest'] !== CANDIDATE_AUTHORITY_FIELD_PLAN_V4_DIGEST ||
    bindings['sourcePolicyVersion'] !==
      CANDIDATE_AUTHORITY_SOURCE_POLICY_V5_VERSION ||
    bindings['sourcePolicyDigest'] !==
      CANDIDATE_AUTHORITY_SOURCE_POLICY_V5_DIGEST ||
    bindings['partialSemanticRegistryVersion'] !==
      CANDIDATE_AUTHORITY_PARTIAL_SEMANTIC_REGISTRY_VERSION ||
    bindings['partialSemanticRegistryDigest'] !==
      CANDIDATE_AUTHORITY_PARTIAL_SEMANTIC_REGISTRY_DIGEST ||
    bindings['partialEvidenceVersion'] !==
      CANDIDATE_AUTHORITY_PARTIAL_EVIDENCE_VERSION ||
    bindings['partialEvidenceDigest'] !==
      CANDIDATE_AUTHORITY_PARTIAL_EVIDENCE_CONTRACT_DIGEST ||
    bindings['liveAuthorizationVersion'] !==
      CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_VERSION ||
    bindings['liveAuthorizationDigest'] !==
      CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_DIGEST ||
    authorization.authorizationSemanticDigest !==
      CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_DIGEST ||
    sourcePolicy.policySemanticDigest !==
      CANDIDATE_AUTHORITY_SOURCE_POLICY_V5_DIGEST
  )
    invalid();
  return Object.freeze({
    catalog,
    taxonomy: taxonomyResult.value,
    sourceAuthority,
    fieldPlan,
    partialSemanticRegistry: registry,
  });
}

function requireCommittedSource(
  git: CandidateAuthorityReplayGitState,
  sourceAuthority: CandidateAuthoritySourceAuthorityV1,
): void {
  validateCandidateAuthoritySourceCommitProof({
    git,
    serializedSourceAuthority:
      serializeCandidateAuthoritySourceAuthority(sourceAuthority),
    collectionExecutionHead:
      sourceAuthority.bindings['collectionExecutionHead'] ?? invalid(),
  });
}

export function validateCandidateAuthoritySourceCommitProof(input: {
  readonly git: CandidateAuthorityReplayGitState;
  readonly serializedSourceAuthority: string;
  readonly collectionExecutionHead: string;
}): void {
  const { git } = input;
  if (
    git.branch !== 'feat/32-codebase-conditioned-ranking' ||
    git.head !== git.originHead ||
    !git.sourceTrackedAtHead ||
    git.sourceBytesAtHead !== input.serializedSourceAuthority ||
    git.sourceBytesAtFreezeHead !== input.serializedSourceAuthority ||
    git.sourceFreezeHead === null ||
    git.sourceFreezeParentHead !== input.collectionExecutionHead ||
    !git.sourceFreezeIsAncestor ||
    git.sourceCommitPaths.length !== 1 ||
    git.sourceCommitPaths[0] !== CANDIDATE_AUTHORITY_SOURCE_AUTHORITY_PATH
  )
    invalid();
}

function requireOnlyExpectedWorkingPaths(
  git: CandidateAuthorityReplayGitState,
  allowed: readonly { readonly path: string }[],
): void {
  if (
    git.branch !== 'feat/32-codebase-conditioned-ranking' ||
    git.head !== git.originHead ||
    !git.sourceTrackedAtHead ||
    git.sourceBytesAtHead === null ||
    git.sourceCommitPaths.length !== 1 ||
    git.sourceCommitPaths[0] !== CANDIDATE_AUTHORITY_SOURCE_AUTHORITY_PATH
  )
    invalid();
  if (git.clean) return;
  const allowedPaths = new Set(allowed.map(({ path }) => path));
  if (
    git.workingPaths.length < 1 ||
    git.workingPaths.some((path) => !allowedPaths.has(path))
  )
    invalid();
}

function replayOutputTexts(replay: CandidateAuthorityReplayBundle): readonly {
  readonly path: string;
  readonly text: string;
  readonly maximumBytes: number;
}[] {
  return [
    output(CANDIDATE_AUTHORITY_REPLAY_OUTPUTS[0], replay.profiles),
    output(CANDIDATE_AUTHORITY_REPLAY_OUTPUTS[1], replay.partial),
    output(CANDIDATE_AUTHORITY_REPLAY_OUTPUTS[2], replay.evidence),
    output(CANDIDATE_AUTHORITY_REPLAY_OUTPUTS[3], replay.dossiers),
    output(CANDIDATE_AUTHORITY_REPLAY_OUTPUTS[4], replay.dossierProjection),
  ];
}

function readinessOutputTexts(input: {
  readonly report: CandidateAuthorityRealizedReadinessReportV1;
  readonly root: CandidateAuthorityRootV4;
}): readonly {
  readonly path: string;
  readonly text: string;
  readonly maximumBytes: number;
}[] {
  const { canonicalAuthorityDigest, ...rootWithoutDigest } = input.root;
  if (
    candidateAuthorityRootV4SemanticDigest(rootWithoutDigest) !==
    canonicalAuthorityDigest
  )
    invalid();
  return [
    output(CANDIDATE_AUTHORITY_READINESS_OUTPUTS[0], input.report),
    output(CANDIDATE_AUTHORITY_READINESS_OUTPUTS[1], input.root),
  ];
}

function output(
  descriptor: { readonly path: string; readonly maximumBytes: number },
  value: unknown,
): {
  readonly path: string;
  readonly text: string;
  readonly maximumBytes: number;
} {
  return Object.freeze({
    ...descriptor,
    text: canonicalReplayAuthorityText(value, descriptor.maximumBytes),
  });
}

async function requireExactOutputs(
  effects: CandidateAuthorityReplayReadEffects,
  expected: readonly {
    readonly path: string;
    readonly text: string;
    readonly maximumBytes: number;
  }[],
): Promise<void> {
  const actual = await Promise.all(
    expected.map(({ path, maximumBytes }) =>
      effects.readFixedFile(path, maximumBytes),
    ),
  );
  if (actual.some((text, index) => text !== expected[index]?.text)) invalid();
}

function replayDigests(
  replay: CandidateAuthorityReplayBundle,
): Readonly<Record<string, string>> {
  return Object.freeze({
    deterministicProfiles: replay.profiles.canonicalAuthorityDigest,
    partialFieldEvidence: replay.partial.canonicalAuthorityDigest,
    fitConsumableEvidence: replay.evidence.canonicalAuthorityDigest,
    dossiers: replay.dossiers.canonicalAuthorityDigest,
    dossierProjection: replay.dossierProjection.canonicalAuthorityDigest,
  });
}

async function readInput(
  effects: CandidateAuthorityReplayReadEffects,
  path: string,
): Promise<string> {
  return effects.readFixedFile(
    path,
    CANDIDATE_AUTHORITY_REPLAY_INPUT_MAXIMUM_BYTES,
  );
}

function invalid(): never {
  throw ingestionError('ingestion.invalid-input');
}
