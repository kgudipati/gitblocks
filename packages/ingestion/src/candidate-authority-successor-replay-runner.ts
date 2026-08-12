import {
  parseCapabilityTaxonomyV1,
  type CapabilityTaxonomyV1,
} from '@gitblocks/contracts';

import { canonicalizeJson } from './canonical-json.ts';
import {
  CANDIDATE_AUTHORITY_FIELD_PLAN_V7_PATH,
  CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V4_PATH,
  CANDIDATE_AUTHORITY_ROUTING_PATH,
  CANDIDATE_AUTHORITY_SOURCE_POLICY_V9_PATH,
  materializeCandidateAuthorityFieldPlanV7,
  parseCandidateAuthorityProviderRoutes,
  type CandidateAuthorityFieldPlanV7Runtime,
  type CandidateAuthorityProviderRoutes,
} from './candidate-authority-canonical-routing-correction.ts';
import {
  CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V8_PATH,
  CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V5_PATH,
  CANDIDATE_AUTHORITY_REPLAY_V7_PATH,
  CANDIDATE_AUTHORITY_SOURCE_POLICY_V10_PATH,
} from './candidate-authority-linkage-evidence-correction.ts';
import {
  CANDIDATE_AUTHORITY_PARTIAL_SEMANTIC_REGISTRY_PATH,
  CANDIDATE_AUTHORITY_PARTIAL_SEMANTIC_REGISTRY_V3_PATH,
  parseCandidateAuthorityPartialSemanticRegistry,
  parseCandidateAuthorityPartialSemanticRegistryV3,
  type CandidateAuthorityPartialSemanticRegistry,
} from './candidate-authority-partial-semantics.ts';
import {
  CANDIDATE_AUTHORITY_FIELD_PLAN_V6_PATH,
  CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V3_PATH,
  CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V2_PATH,
  CANDIDATE_AUTHORITY_SOURCE_POLICY_V8_PATH,
  CANDIDATE_AUTHORITY_SOURCE_POLICY_V7_PATH,
  materializeCandidateAuthorityFieldPlanV6,
} from './candidate-authority-npm-source-correction.ts';
import {
  CANDIDATE_AUTHORITY_FIELD_PLAN_V5_PATH,
  CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_PATH,
  CANDIDATE_AUTHORITY_SOURCE_POLICY_V6_PATH,
  materializeCandidateAuthorityFieldPlanV5,
} from './candidate-authority-postmortem.ts';
import {
  CANDIDATE_AUTHORITY_DOSSIER_MAXIMUM_SERIALIZED_BYTES,
  CANDIDATE_AUTHORITY_DOSSIER_PROJECTION_MAXIMUM_SERIALIZED_BYTES,
  CANDIDATE_AUTHORITY_EVIDENCE_MAXIMUM_SERIALIZED_BYTES,
  CANDIDATE_AUTHORITY_PARTIAL_MAXIMUM_SERIALIZED_BYTES,
  CANDIDATE_AUTHORITY_PROFILE_MAXIMUM_SERIALIZED_BYTES,
  CANDIDATE_AUTHORITY_READINESS_MAXIMUM_SERIALIZED_BYTES,
  CANDIDATE_AUTHORITY_ROOT_MAXIMUM_SERIALIZED_BYTES,
  canonicalReplayAuthorityText,
} from './candidate-authority-replay-contracts.ts';
import {
  CANDIDATE_AUTHORITY_FIELD_PLAN_V4_PATH,
  CANDIDATE_AUTHORITY_READINESS_POLICY_V3_PATH,
  parseCandidateAuthorityFieldPlanV4,
  parseCandidateAuthorityReadinessPolicyV3,
} from './candidate-authority-readiness.ts';
import {
  measureCandidateAuthoritySuccessorReadiness,
  type CandidateAuthorityRootV8,
  type CandidateAuthoritySuccessorReadinessReport,
} from './candidate-authority-successor-measurement.ts';
import {
  generateCandidateAuthoritySuccessorReplay,
  type CandidateAuthoritySuccessorReplayBundle,
} from './candidate-authority-successor-replay.ts';
import {
  CANDIDATE_AUTHORITY_SUCCESSOR_DOSSIER_PATH,
  CANDIDATE_AUTHORITY_SUCCESSOR_EVIDENCE_PATH,
  CANDIDATE_AUTHORITY_SUCCESSOR_MAXIMUM_SOURCE_BYTES,
  CANDIDATE_AUTHORITY_SUCCESSOR_PARTIAL_PATH,
  CANDIDATE_AUTHORITY_SUCCESSOR_PROFILE_PATH,
  CANDIDATE_AUTHORITY_SUCCESSOR_PROJECTION_PATH,
  CANDIDATE_AUTHORITY_SUCCESSOR_READINESS_PATH,
  CANDIDATE_AUTHORITY_SUCCESSOR_ROOT_PATH,
  CANDIDATE_AUTHORITY_SUCCESSOR_SOURCE_PATH,
  parseCandidateAuthoritySuccessorFixedAuthorities,
  parseCandidateAuthoritySuccessorSourceAuthority,
  serializeCandidateAuthoritySuccessorSourceAuthority,
} from './candidate-authority-successor-contracts.ts';
import { ingestionError } from './errors.ts';
import { parsePublicCatalog } from './manifest.ts';
import type { PublicCatalog } from './types.ts';

export const CANDIDATE_AUTHORITY_SUCCESSOR_REPLAY_CATALOG_PATH =
  'catalog/public-v1/manifest.json' as const;
export const CANDIDATE_AUTHORITY_SUCCESSOR_REPLAY_TAXONOMY_PATH =
  'catalog/capability-taxonomy/1.0.0/manifest.json' as const;
export const CANDIDATE_AUTHORITY_SUCCESSOR_REPLAY_INPUT_MAXIMUM_BYTES =
  32 * 1024 * 1024;

export const CANDIDATE_AUTHORITY_SUCCESSOR_REPLAY_OUTPUTS = Object.freeze([
  {
    path: CANDIDATE_AUTHORITY_SUCCESSOR_PROFILE_PATH,
    maximumBytes: CANDIDATE_AUTHORITY_PROFILE_MAXIMUM_SERIALIZED_BYTES,
  },
  {
    path: CANDIDATE_AUTHORITY_SUCCESSOR_PARTIAL_PATH,
    maximumBytes: CANDIDATE_AUTHORITY_PARTIAL_MAXIMUM_SERIALIZED_BYTES,
  },
  {
    path: CANDIDATE_AUTHORITY_SUCCESSOR_EVIDENCE_PATH,
    maximumBytes: CANDIDATE_AUTHORITY_EVIDENCE_MAXIMUM_SERIALIZED_BYTES,
  },
  {
    path: CANDIDATE_AUTHORITY_SUCCESSOR_DOSSIER_PATH,
    maximumBytes: CANDIDATE_AUTHORITY_DOSSIER_MAXIMUM_SERIALIZED_BYTES,
  },
  {
    path: CANDIDATE_AUTHORITY_SUCCESSOR_PROJECTION_PATH,
    maximumBytes:
      CANDIDATE_AUTHORITY_DOSSIER_PROJECTION_MAXIMUM_SERIALIZED_BYTES,
  },
] as const);
export const CANDIDATE_AUTHORITY_SUCCESSOR_READINESS_OUTPUTS = Object.freeze([
  {
    path: CANDIDATE_AUTHORITY_SUCCESSOR_READINESS_PATH,
    maximumBytes: CANDIDATE_AUTHORITY_READINESS_MAXIMUM_SERIALIZED_BYTES,
  },
  {
    path: CANDIDATE_AUTHORITY_SUCCESSOR_ROOT_PATH,
    maximumBytes: CANDIDATE_AUTHORITY_ROOT_MAXIMUM_SERIALIZED_BYTES,
  },
] as const);

export interface CandidateAuthoritySuccessorReplayGitState {
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

export interface CandidateAuthoritySuccessorReplayReadEffects {
  readonly readFixedFile: (
    path: string,
    maximumBytes: number,
  ) => Promise<string>;
  readonly requirePathMissing: (path: string) => Promise<void>;
  readonly readGitState: () => Promise<CandidateAuthoritySuccessorReplayGitState>;
}
export interface CandidateAuthoritySuccessorReplayWriteEffects extends CandidateAuthoritySuccessorReplayReadEffects {
  readonly publishExclusive: (
    outputs: readonly {
      readonly path: string;
      readonly text: string;
      readonly maximumBytes: number;
    }[],
  ) => Promise<void>;
}

interface Loaded {
  readonly catalog: PublicCatalog;
  readonly taxonomy: CapabilityTaxonomyV1;
  readonly sourceAuthority: ReturnType<
    typeof parseCandidateAuthoritySuccessorSourceAuthority
  >;
  readonly fieldPlan: CandidateAuthorityFieldPlanV7Runtime;
  readonly partialSemanticRegistry: CandidateAuthorityPartialSemanticRegistry;
  readonly providerRoutes: CandidateAuthorityProviderRoutes;
}

const ZERO_EFFECT = Object.freeze({
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
} as const);

export async function preflightCandidateAuthoritySuccessorReplay(
  effects: CandidateAuthoritySuccessorReplayReadEffects,
) {
  const [loaded, git] = await Promise.all([
    load(effects),
    effects.readGitState(),
    ...[
      ...CANDIDATE_AUTHORITY_SUCCESSOR_REPLAY_OUTPUTS,
      ...CANDIDATE_AUTHORITY_SUCCESSOR_READINESS_OUTPUTS,
    ].flatMap(({ path }) => [
      effects.requirePathMissing(path),
      effects.requirePathMissing(path.replace(/\.json$/u, '.staging.json')),
    ]),
  ]);
  requireSourceFreeze(git, loaded.sourceAuthority);
  if (!git.clean) invalid();
  return Object.freeze({
    status: 'passed' as const,
    command: 'candidate-authority-successor-replay-preflight' as const,
    sourceAuthorityDigest: loaded.sourceAuthority.canonicalAuthorityDigest,
    sourceFreezeHead: git.sourceFreezeHead,
    sourceFreezeParentHead: git.sourceFreezeParentHead,
    candidateCount: 150 as const,
    effectAudit: ZERO_EFFECT,
  });
}

export async function generateCandidateAuthoritySuccessorReplayOutputs(
  effects: CandidateAuthoritySuccessorReplayWriteEffects,
) {
  await preflightCandidateAuthoritySuccessorReplay(effects);
  const loaded = await load(effects);
  const replay = generateCandidateAuthoritySuccessorReplay(loaded);
  await effects.publishExclusive(replayTexts(replay));
  return Object.freeze({
    status: 'passed' as const,
    command: 'candidate-authority-successor-replay-generate' as const,
    authorityDigests: digests(replay),
  });
}

export async function validateCandidateAuthoritySuccessorReplayOutputs(
  effects: CandidateAuthoritySuccessorReplayReadEffects,
) {
  return validateReplay(effects, CANDIDATE_AUTHORITY_SUCCESSOR_REPLAY_OUTPUTS);
}

export async function measureCandidateAuthoritySuccessorReadinessOutputs(
  effects: CandidateAuthoritySuccessorReplayWriteEffects,
) {
  await Promise.all(
    CANDIDATE_AUTHORITY_SUCCESSOR_READINESS_OUTPUTS.flatMap(({ path }) => [
      effects.requirePathMissing(path),
      effects.requirePathMissing(path.replace(/\.json$/u, '.staging.json')),
    ]),
  );
  const validated = await validateReplay(
    effects,
    CANDIDATE_AUTHORITY_SUCCESSOR_REPLAY_OUTPUTS,
  );
  const measured = measureCandidateAuthoritySuccessorReadiness(validated);
  await effects.publishExclusive(readinessTexts(measured));
  return Object.freeze({
    status: 'passed' as const,
    command: 'candidate-authority-successor-readiness-measure' as const,
    ...measured,
  });
}

export async function validateCandidateAuthoritySuccessorReadinessOutputs(
  effects: CandidateAuthoritySuccessorReplayReadEffects,
) {
  const validated = await validateReplay(effects, [
    ...CANDIDATE_AUTHORITY_SUCCESSOR_REPLAY_OUTPUTS,
    ...CANDIDATE_AUTHORITY_SUCCESSOR_READINESS_OUTPUTS,
  ]);
  const measured = measureCandidateAuthoritySuccessorReadiness(validated);
  await requireExact(effects, readinessTexts(measured));
  return Object.freeze({
    status: 'passed' as const,
    command: 'candidate-authority-successor-readiness-validate' as const,
    reportDigest: measured.report.canonicalReportDigest,
    rootDigest: measured.root.canonicalAuthorityDigest,
    decision: measured.report.readinessDecision,
  });
}

async function validateReplay(
  effects: CandidateAuthoritySuccessorReplayReadEffects,
  allowed: readonly { readonly path: string }[],
) {
  const [loaded, git] = await Promise.all([
    load(effects),
    effects.readGitState(),
  ]);
  requireSourceFreeze(git, loaded.sourceAuthority);
  requireOnlyAllowed(git, allowed);
  const replay = generateCandidateAuthoritySuccessorReplay(loaded);
  await requireExact(effects, replayTexts(replay));
  return Object.freeze({
    ...loaded,
    replay,
    authorityDigests: digests(replay),
  });
}

async function load(
  effects: CandidateAuthoritySuccessorReplayReadEffects,
): Promise<Loaded> {
  const [
    catalogText,
    taxonomyText,
    readinessText,
    registryV2Text,
    registryV3Text,
    planV4Text,
    planV5Text,
    planV6Text,
    planV7Text,
    providerV1,
    providerV2,
    providerV3,
    providerV4,
    providerV5,
    sourceV6,
    sourceV7,
    sourceV8,
    sourceV9,
    sourceV10,
    replayV7,
    authorizationV8,
    routingText,
    sourceText,
  ] = await Promise.all([
    read(effects, CANDIDATE_AUTHORITY_SUCCESSOR_REPLAY_CATALOG_PATH),
    read(effects, CANDIDATE_AUTHORITY_SUCCESSOR_REPLAY_TAXONOMY_PATH),
    read(effects, CANDIDATE_AUTHORITY_READINESS_POLICY_V3_PATH),
    read(effects, CANDIDATE_AUTHORITY_PARTIAL_SEMANTIC_REGISTRY_PATH),
    read(effects, CANDIDATE_AUTHORITY_PARTIAL_SEMANTIC_REGISTRY_V3_PATH),
    read(effects, CANDIDATE_AUTHORITY_FIELD_PLAN_V4_PATH),
    read(effects, CANDIDATE_AUTHORITY_FIELD_PLAN_V5_PATH),
    read(effects, CANDIDATE_AUTHORITY_FIELD_PLAN_V6_PATH),
    read(effects, CANDIDATE_AUTHORITY_FIELD_PLAN_V7_PATH),
    read(effects, CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_PATH),
    read(effects, CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V2_PATH),
    read(effects, CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V3_PATH),
    read(effects, CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V4_PATH),
    read(effects, CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V5_PATH),
    read(effects, CANDIDATE_AUTHORITY_SOURCE_POLICY_V6_PATH),
    read(effects, CANDIDATE_AUTHORITY_SOURCE_POLICY_V7_PATH),
    read(effects, CANDIDATE_AUTHORITY_SOURCE_POLICY_V8_PATH),
    read(effects, CANDIDATE_AUTHORITY_SOURCE_POLICY_V9_PATH),
    read(effects, CANDIDATE_AUTHORITY_SOURCE_POLICY_V10_PATH),
    read(effects, CANDIDATE_AUTHORITY_REPLAY_V7_PATH),
    read(effects, CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V8_PATH),
    read(effects, CANDIDATE_AUTHORITY_ROUTING_PATH),
    effects.readFixedFile(
      CANDIDATE_AUTHORITY_SUCCESSOR_SOURCE_PATH,
      CANDIDATE_AUTHORITY_SUCCESSOR_MAXIMUM_SOURCE_BYTES,
    ),
  ]);
  parseCandidateAuthoritySuccessorFixedAuthorities({
    providerContractV1: providerV1,
    providerContractV2: providerV2,
    providerContractV3: providerV3,
    providerContractV4: providerV4,
    providerContractV5: providerV5,
    sourcePolicyV6: sourceV6,
    sourcePolicyV7: sourceV7,
    sourcePolicyV8: sourceV8,
    sourcePolicyV9: sourceV9,
    sourcePolicyV10: sourceV10,
    replayV7,
    authorizationV8,
  });
  const catalog = parsePublicCatalog(catalogText);
  const taxonomyResult = parseCapabilityTaxonomyV1(
    JSON.parse(taxonomyText) as unknown,
  );
  if (!taxonomyResult.ok) invalid();
  const registryV2 = parseCandidateAuthorityPartialSemanticRegistry(
    JSON.parse(registryV2Text) as unknown,
  );
  const registry = parseCandidateAuthorityPartialSemanticRegistryV3(
    JSON.parse(registryV3Text) as unknown,
  );
  const readiness = parseCandidateAuthorityReadinessPolicyV3(
    JSON.parse(readinessText) as unknown,
  );
  const planV4 = parseCandidateAuthorityFieldPlanV4(
    JSON.parse(planV4Text) as unknown,
    readiness,
    registryV2,
  );
  const fieldPlanV5 = materializeCandidateAuthorityFieldPlanV5({
    predecessor: planV4,
    successorAuthority: JSON.parse(planV5Text) as unknown,
  });
  const fieldPlanV6 = materializeCandidateAuthorityFieldPlanV6({
    predecessor: fieldPlanV5,
    successorAuthority: JSON.parse(planV6Text) as unknown,
    partialSemanticRegistry: registry,
  });
  const fieldPlan = materializeCandidateAuthorityFieldPlanV7({
    predecessor: fieldPlanV6,
    successorAuthority: JSON.parse(planV7Text) as unknown,
  });
  const providerRoutes = parseCandidateAuthorityProviderRoutes({
    catalog,
    authority: JSON.parse(routingText) as unknown,
  });
  const sourceAuthority = parseCandidateAuthoritySuccessorSourceAuthority({
    text: sourceText,
    catalog,
    providerRoutes,
  });
  if (
    sourceAuthority.bindings['taxonomyVersion'] !==
      taxonomyResult.value.taxonomyVersion ||
    sourceAuthority.bindings['taxonomyDigest'] !==
      taxonomyResult.value.semanticDigest
  )
    invalid();
  return Object.freeze({
    catalog,
    taxonomy: taxonomyResult.value,
    sourceAuthority,
    fieldPlan,
    partialSemanticRegistry: registry,
    providerRoutes,
  });
}

export function validateCandidateAuthoritySuccessorSourceCommitProof(input: {
  readonly git: CandidateAuthoritySuccessorReplayGitState;
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
    git.sourceCommitPaths[0] !== CANDIDATE_AUTHORITY_SUCCESSOR_SOURCE_PATH
  )
    invalid();
}

function requireSourceFreeze(
  git: CandidateAuthoritySuccessorReplayGitState,
  source: Loaded['sourceAuthority'],
): void {
  validateCandidateAuthoritySuccessorSourceCommitProof({
    git,
    serializedSourceAuthority:
      serializeCandidateAuthoritySuccessorSourceAuthority(source),
    collectionExecutionHead:
      source.bindings['collectionExecutionHead'] ?? invalid(),
  });
}

function requireOnlyAllowed(
  git: CandidateAuthoritySuccessorReplayGitState,
  allowed: readonly { readonly path: string }[],
): void {
  if (git.clean) return;
  const paths = new Set(allowed.map(({ path }) => path));
  if (
    git.workingPaths.length < 1 ||
    git.workingPaths.some((path) => !paths.has(path))
  )
    invalid();
}

function replayTexts(replay: CandidateAuthoritySuccessorReplayBundle) {
  return [
    output(CANDIDATE_AUTHORITY_SUCCESSOR_REPLAY_OUTPUTS[0], replay.profiles),
    output(CANDIDATE_AUTHORITY_SUCCESSOR_REPLAY_OUTPUTS[1], replay.partial),
    output(CANDIDATE_AUTHORITY_SUCCESSOR_REPLAY_OUTPUTS[2], replay.evidence),
    output(CANDIDATE_AUTHORITY_SUCCESSOR_REPLAY_OUTPUTS[3], replay.dossiers),
    output(
      CANDIDATE_AUTHORITY_SUCCESSOR_REPLAY_OUTPUTS[4],
      replay.dossierProjection,
    ),
  ];
}

function readinessTexts(input: {
  readonly report: CandidateAuthoritySuccessorReadinessReport;
  readonly root: CandidateAuthorityRootV8;
}) {
  return [
    output(CANDIDATE_AUTHORITY_SUCCESSOR_READINESS_OUTPUTS[0], input.report),
    output(CANDIDATE_AUTHORITY_SUCCESSOR_READINESS_OUTPUTS[1], input.root),
  ];
}

function output(
  descriptor: { readonly path: string; readonly maximumBytes: number },
  value: unknown,
) {
  return {
    ...descriptor,
    text: canonicalReplayAuthorityText(value, descriptor.maximumBytes),
  };
}

async function requireExact(
  effects: CandidateAuthoritySuccessorReplayReadEffects,
  outputs: readonly {
    readonly path: string;
    readonly text: string;
    readonly maximumBytes: number;
  }[],
): Promise<void> {
  for (const output of outputs) {
    if (
      (await effects.readFixedFile(output.path, output.maximumBytes)) !==
      output.text
    )
      invalid();
  }
}

function digests(replay: CandidateAuthoritySuccessorReplayBundle) {
  return Object.freeze({
    deterministicProfiles: replay.profiles.canonicalAuthorityDigest,
    partialFieldEvidence: replay.partial.canonicalAuthorityDigest,
    fitEvidence: replay.evidence.canonicalAuthorityDigest,
    dossiers: replay.dossiers.canonicalAuthorityDigest,
    dossierProjection: replay.dossierProjection.canonicalAuthorityDigest,
    bundle: canonicalizeJson(replay).digest,
  });
}

async function read(
  effects: CandidateAuthoritySuccessorReplayReadEffects,
  path: string,
) {
  return effects.readFixedFile(
    path,
    CANDIDATE_AUTHORITY_SUCCESSOR_REPLAY_INPUT_MAXIMUM_BYTES,
  );
}

function invalid(): never {
  throw ingestionError('ingestion.invalid-input');
}
