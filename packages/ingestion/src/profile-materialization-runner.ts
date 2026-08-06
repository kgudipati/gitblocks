/* eslint-disable @typescript-eslint/no-unnecessary-condition -- Trust-boundary validation intentionally rechecks literal command and proof fields at runtime. */

import {
  PROFILE_MATERIALIZATION_DATABASE_EXPECTATIONS,
  PROFILE_MATERIALIZATION_POSTGRES_IMAGE,
  createProfileMaterializationDatabasePlan,
  deriveProfileMaterializationDatabaseIdentity,
  isPhase7LikeIdentity,
  type ProfileMaterializationDatabasePlan,
} from '@gitblocks/persistence';
import {
  parseCapabilityTaxonomyV1,
  type CapabilityTaxonomyV1,
} from '@gitblocks/contracts';

import {
  parseProfileMaterializationCoverage,
  type ProfileMaterializationArtifacts,
  type ProfileMaterializationCoverageReport,
} from './profile-materialization-coverage.ts';
import { canonicalizeJson } from './canonical-json.ts';
import { ingestionError } from './errors.ts';
import { parsePublicCatalog } from './manifest.ts';
import {
  PROFILE_MATERIALIZATION_ACCEPTED_BINDINGS,
  PROFILE_MATERIALIZATION_OPERATOR_VERSION,
  PROFILE_MATERIALIZATION_PERSISTENCE_PROOF_VERSION,
  PROFILE_MATERIALIZATION_PROVIDER_POLICY_VERSION,
  PROFILE_MATERIALIZATION_SOURCE_AUTHORITY_VERSION,
  parseProfileMaterializationReceipt,
  type ProfileMaterializationProviderPolicy,
  type ProfileMaterializationPersistenceProof,
  type ProfileMaterializationReceipt,
  type ProfileMaterializationSourceAuthority,
} from './profile-materialization-contracts.ts';
import {
  deriveProfileMaterializationLiveIdempotency,
  parseProfileMaterializationPersistenceProof,
  persistenceProofCounts,
} from './profile-materialization-persistence-proof.ts';
import {
  PROFILE_MATERIALIZATION_PROVIDER_POLICY_PATH,
  validateProfileMaterializationProviderPolicy,
} from './profile-materialization-policy.ts';
import {
  buildProfileMaterializationReceipt,
  compareProfileMaterializationSources,
  controlledFailureCounts,
  renderProfileMaterializationCompletion,
  sourceOutcomeCounts,
  sourceRecordCounts,
} from './profile-materialization-receipt.ts';
import { parseProfileMaterializationSourceAuthority } from './profile-materialization-source-authority.ts';
import type { PublicCatalog } from './types.ts';

export const PROFILE_MATERIALIZATION_LIVE_ACKNOWLEDGEMENT =
  'phase-8-milestone-7-live-public-profile-materialization' as const;
export const PROFILE_MATERIALIZATION_CREDENTIAL_NAMES = {
  githubToken: 'GITBLOCKS_PROFILE_MATERIALIZATION_GITHUB_TOKEN',
  ownerUrl: 'GITBLOCKS_PROFILE_MATERIALIZATION_DB_OWNER_URL',
  ownerPassword: 'GITBLOCKS_PROFILE_MATERIALIZATION_DB_OWNER_PASSWORD',
  runtimeUrl: 'GITBLOCKS_PROFILE_MATERIALIZATION_DB_RUNTIME_URL',
  runtimePassword: 'GITBLOCKS_PROFILE_MATERIALIZATION_DB_RUNTIME_PASSWORD',
} as const;

export const PROFILE_MATERIALIZATION_FIXED_PATHS = {
  catalog: 'catalog/public-v1/manifest.json',
  taxonomy: 'catalog/capability-taxonomy/1.0.0/manifest.json',
  policy: PROFILE_MATERIALIZATION_PROVIDER_POLICY_PATH,
  receipt: 'verification/retrieval-v1/profile-materialization-receipt.json',
  coverage: 'verification/retrieval-v1/profile-materialization-coverage.json',
  completion: 'catalog/public-v1/profile-materialization-completion.md',
} as const;

export interface ProfileMaterializationArguments {
  readonly liveAcknowledgement: string;
  readonly databaseAcknowledgement: string;
  readonly runId: string;
  readonly catalogPath: typeof PROFILE_MATERIALIZATION_FIXED_PATHS.catalog;
  readonly catalogDigest: string;
  readonly taxonomyPath: typeof PROFILE_MATERIALIZATION_FIXED_PATHS.taxonomy;
  readonly taxonomyDigest: string;
  readonly providerPolicyPath: typeof PROFILE_MATERIALIZATION_FIXED_PATHS.policy;
  readonly providerPolicyVersion: typeof PROFILE_MATERIALIZATION_PROVIDER_POLICY_VERSION;
  readonly providerPolicyDigest: string;
  readonly postgresImage: typeof PROFILE_MATERIALIZATION_POSTGRES_IMAGE;
  readonly databaseHost: '127.0.0.1';
  readonly databasePort: number;
  readonly ownerUrlEnvironmentName: typeof PROFILE_MATERIALIZATION_CREDENTIAL_NAMES.ownerUrl;
  readonly ownerPasswordEnvironmentName: typeof PROFILE_MATERIALIZATION_CREDENTIAL_NAMES.ownerPassword;
  readonly runtimeUrlEnvironmentName: typeof PROFILE_MATERIALIZATION_CREDENTIAL_NAMES.runtimeUrl;
  readonly runtimePasswordEnvironmentName: typeof PROFILE_MATERIALIZATION_CREDENTIAL_NAMES.runtimePassword;
  readonly githubTokenEnvironmentName: typeof PROFILE_MATERIALIZATION_CREDENTIAL_NAMES.githubToken;
  readonly concurrency: 3;
  readonly requestTimeoutMilliseconds: 10000;
  readonly candidateDeadlineMilliseconds: 90000;
  readonly runDeadlineMilliseconds: 3600000;
  readonly maximumAttempts: 3;
  readonly maximumRedirects: 2;
  readonly runDirectory: string;
}

export interface ProfileMaterializationPreflightEffects {
  readFixedFile(path: string): Promise<string>;
  validateFixedPaths(
    arguments_: ProfileMaterializationArguments,
  ): Promise<void>;
}

export interface ProfileMaterializationPreflightResult {
  readonly arguments: ProfileMaterializationArguments;
  readonly catalog: PublicCatalog;
  readonly taxonomy: CapabilityTaxonomyV1;
  readonly policy: ProfileMaterializationProviderPolicy;
  readonly databasePlan: ProfileMaterializationDatabasePlan;
  readonly commandPlanDigest: string;
}

export interface ProfileMaterializationDatabaseProof {
  readonly migrationInventoryDigest: string;
  readonly migrationCount: 4;
  readonly databaseSchemaDigest: string;
  readonly productTableCount: 25;
}

export interface ProfileMaterializationCollectionAuthority {
  readonly sourceAuthority: ProfileMaterializationSourceAuthority;
  readonly persistenceProof: ProfileMaterializationPersistenceProof;
}

export interface ProfileMaterializationLiveEffects extends ProfileMaterializationPreflightEffects {
  readCredential(name: string): string;
  createDatabase(
    plan: ProfileMaterializationDatabasePlan,
    credentials: ProfileMaterializationCredentials,
    signal: AbortSignal,
  ): Promise<void>;
  proveEmptyDatabase(
    plan: ProfileMaterializationDatabasePlan,
    credentials: ProfileMaterializationCredentials,
    signal: AbortSignal,
  ): Promise<void>;
  prepareDatabase(
    preflight: ProfileMaterializationPreflightResult,
    credentials: ProfileMaterializationCredentials,
    signal: AbortSignal,
  ): Promise<ProfileMaterializationDatabaseProof>;
  collectSourceAuthority(
    collection: 'first' | 'second',
    preflight: ProfileMaterializationPreflightResult,
    credentials: ProfileMaterializationCredentials,
    firstAuthority: ProfileMaterializationSourceAuthority | null,
    signal: AbortSignal,
  ): Promise<ProfileMaterializationCollectionAuthority>;
  publishSourceAuthority(
    collection: 'first' | 'second',
    authority: ProfileMaterializationSourceAuthority,
    preflight: ProfileMaterializationPreflightResult,
  ): Promise<void>;
  publishPersistenceProof(
    collection: 'first' | 'second',
    proof: ProfileMaterializationPersistenceProof,
    preflight: ProfileMaterializationPreflightResult,
  ): Promise<void>;
  materializeProfiles(
    preflight: ProfileMaterializationPreflightResult,
    authority: ProfileMaterializationSourceAuthority,
  ): ProfileMaterializationArtifacts;
  quarantineCompletionEvidence(
    evidence: ProfileMaterializationCompletionEvidence,
    preflight: ProfileMaterializationPreflightResult,
  ): Promise<void>;
  disposeDatabase(
    plan: ProfileMaterializationDatabasePlan,
    signal: AbortSignal,
  ): Promise<void>;
  proveDisposed(
    plan: ProfileMaterializationDatabasePlan,
    signal: AbortSignal,
  ): Promise<void>;
  publishCompletionEvidence(
    preflight: ProfileMaterializationPreflightResult,
  ): Promise<void>;
  cancel(): void;
}

export interface ProfileMaterializationCredentials {
  readonly githubToken: string;
  readonly ownerUrl: string;
  readonly ownerPassword: string;
  readonly runtimeUrl: string;
  readonly runtimePassword: string;
}

export interface ProfileMaterializationCompletionEvidence {
  readonly receipt: ProfileMaterializationReceipt;
  readonly coverage: ProfileMaterializationCoverageReport;
  readonly completionMarkdown: string;
}

const ARGUMENT_NAMES = [
  '--candidate-deadline-ms',
  '--catalog-digest',
  '--catalog-path',
  '--concurrency',
  '--database-ack',
  '--database-host',
  '--database-port',
  '--github-token-env',
  '--live-ack',
  '--maximum-attempts',
  '--maximum-redirects',
  '--owner-password-env',
  '--owner-url-env',
  '--postgres-image',
  '--provider-policy-digest',
  '--provider-policy-path',
  '--provider-policy-version',
  '--request-timeout-ms',
  '--run-deadline-ms',
  '--run-directory',
  '--run-id',
  '--runtime-password-env',
  '--runtime-url-env',
  '--taxonomy-digest',
  '--taxonomy-path',
] as const;

export function parseProfileMaterializationArguments(
  argv: readonly string[],
): ProfileMaterializationArguments {
  if (argv.length !== ARGUMENT_NAMES.length * 2) {
    throw ingestionError('ingestion.invalid-input');
  }
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (
      name === undefined ||
      value === undefined ||
      !ARGUMENT_NAMES.includes(name as (typeof ARGUMENT_NAMES)[number]) ||
      values.has(name) ||
      value.length === 0 ||
      value.startsWith('--')
    ) {
      throw ingestionError('ingestion.invalid-input');
    }
    values.set(name, value);
  }
  const runId = requireArgument(values, '--run-id');
  const identity = deriveProfileMaterializationDatabaseIdentity(runId);
  const result = {
    liveAcknowledgement: requireArgument(values, '--live-ack'),
    databaseAcknowledgement: requireArgument(values, '--database-ack'),
    runId,
    catalogPath: requireArgument(values, '--catalog-path'),
    catalogDigest: requireArgument(values, '--catalog-digest'),
    taxonomyPath: requireArgument(values, '--taxonomy-path'),
    taxonomyDigest: requireArgument(values, '--taxonomy-digest'),
    providerPolicyPath: requireArgument(values, '--provider-policy-path'),
    providerPolicyVersion: requireArgument(values, '--provider-policy-version'),
    providerPolicyDigest: requireArgument(values, '--provider-policy-digest'),
    postgresImage: requireArgument(values, '--postgres-image'),
    databaseHost: requireArgument(values, '--database-host'),
    databasePort: parseInteger(values, '--database-port'),
    ownerUrlEnvironmentName: requireArgument(values, '--owner-url-env'),
    ownerPasswordEnvironmentName: requireArgument(
      values,
      '--owner-password-env',
    ),
    runtimeUrlEnvironmentName: requireArgument(values, '--runtime-url-env'),
    runtimePasswordEnvironmentName: requireArgument(
      values,
      '--runtime-password-env',
    ),
    githubTokenEnvironmentName: requireArgument(values, '--github-token-env'),
    concurrency: parseInteger(values, '--concurrency'),
    requestTimeoutMilliseconds: parseInteger(values, '--request-timeout-ms'),
    candidateDeadlineMilliseconds: parseInteger(
      values,
      '--candidate-deadline-ms',
    ),
    runDeadlineMilliseconds: parseInteger(values, '--run-deadline-ms'),
    maximumAttempts: parseInteger(values, '--maximum-attempts'),
    maximumRedirects: parseInteger(values, '--maximum-redirects'),
    runDirectory: requireArgument(values, '--run-directory'),
  } as ProfileMaterializationArguments;
  const expectedRunDirectory = `verification/retrieval-v1/.profile-materialization-runs/${runId}`;
  if (
    result.liveAcknowledgement !==
      PROFILE_MATERIALIZATION_LIVE_ACKNOWLEDGEMENT ||
    result.databaseAcknowledgement !== identity.databaseName ||
    result.catalogPath !== PROFILE_MATERIALIZATION_FIXED_PATHS.catalog ||
    result.taxonomyPath !== PROFILE_MATERIALIZATION_FIXED_PATHS.taxonomy ||
    result.providerPolicyPath !== PROFILE_MATERIALIZATION_FIXED_PATHS.policy ||
    result.providerPolicyVersion !==
      PROFILE_MATERIALIZATION_PROVIDER_POLICY_VERSION ||
    result.postgresImage !== PROFILE_MATERIALIZATION_POSTGRES_IMAGE ||
    result.databaseHost !== '127.0.0.1' ||
    result.databasePort < 1_024 ||
    result.databasePort > 65_535 ||
    result.ownerUrlEnvironmentName !==
      PROFILE_MATERIALIZATION_CREDENTIAL_NAMES.ownerUrl ||
    result.ownerPasswordEnvironmentName !==
      PROFILE_MATERIALIZATION_CREDENTIAL_NAMES.ownerPassword ||
    result.runtimeUrlEnvironmentName !==
      PROFILE_MATERIALIZATION_CREDENTIAL_NAMES.runtimeUrl ||
    result.runtimePasswordEnvironmentName !==
      PROFILE_MATERIALIZATION_CREDENTIAL_NAMES.runtimePassword ||
    result.githubTokenEnvironmentName !==
      PROFILE_MATERIALIZATION_CREDENTIAL_NAMES.githubToken ||
    result.concurrency !== 3 ||
    result.requestTimeoutMilliseconds !== 10_000 ||
    result.candidateDeadlineMilliseconds !== 90_000 ||
    result.runDeadlineMilliseconds !== 3_600_000 ||
    result.maximumAttempts !== 3 ||
    result.maximumRedirects !== 2 ||
    result.runDirectory !== expectedRunDirectory ||
    Object.values(result).some(
      (value) => typeof value === 'string' && isPhase7LikeIdentity(value),
    ) ||
    !/^[a-f0-9]{64}$/u.test(result.catalogDigest) ||
    !/^[a-f0-9]{64}$/u.test(result.taxonomyDigest) ||
    !/^[a-f0-9]{64}$/u.test(result.providerPolicyDigest)
  ) {
    throw ingestionError('ingestion.invalid-input');
  }
  return Object.freeze(result);
}

export async function preflightProfileMaterialization(
  argv: readonly string[],
  effects: ProfileMaterializationPreflightEffects,
): Promise<ProfileMaterializationPreflightResult> {
  const arguments_ = parseProfileMaterializationArguments(argv);
  await effects.validateFixedPaths(arguments_);
  const [catalogText, taxonomyText, policyText] = await Promise.all([
    effects.readFixedFile(arguments_.catalogPath),
    effects.readFixedFile(arguments_.taxonomyPath),
    effects.readFixedFile(arguments_.providerPolicyPath),
  ]);
  const catalog = parsePublicCatalog(catalogText);
  const taxonomyResult = parseCapabilityTaxonomyV1(JSON.parse(taxonomyText));
  if (!taxonomyResult.ok) throw ingestionError('ingestion.invalid-manifest');
  const taxonomy = taxonomyResult.value;
  const policy = validateProfileMaterializationProviderPolicy(
    JSON.parse(policyText),
    catalog,
  );
  if (
    arguments_.catalogDigest !== catalog.manifestDigest ||
    arguments_.taxonomyDigest !== taxonomy.semanticDigest ||
    arguments_.providerPolicyDigest !== policy.policySemanticDigest
  ) {
    throw ingestionError('ingestion.invalid-manifest');
  }
  const databasePlan = createProfileMaterializationDatabasePlan({
    runId: arguments_.runId,
    image: arguments_.postgresImage,
    host: arguments_.databaseHost,
    port: arguments_.databasePort,
    ownerPasswordEnvironmentName: arguments_.ownerPasswordEnvironmentName,
  });
  const commandPlanDigest = canonicalizeJson({
    operatorVersion: PROFILE_MATERIALIZATION_OPERATOR_VERSION,
    arguments: arguments_,
    providerPolicyDigest: policy.policySemanticDigest,
    databasePlanDigest: databasePlan.planDigest,
    stages: EXECUTE_STAGES,
  }).digest;
  return Object.freeze({
    arguments: arguments_,
    catalog,
    taxonomy,
    policy,
    databasePlan,
    commandPlanDigest,
  });
}

export const EXECUTE_STAGES = [
  'zero-effect-validation',
  'lazy-credential-read',
  'fresh-database-create',
  'zero-state-proof',
  'migrate-schema-runtime-role-catalog-seed',
  'first-collection',
  'first-source-authority-publication',
  'first-persistence-proof-publication',
  'first-materialization-a',
  'first-materialization-b',
  'second-collection',
  'second-source-authority-publication-and-drift',
  'second-persistence-proof-publication',
  'second-materialization-a',
  'second-materialization-b',
  'quarantined-completion-evidence',
  'database-container-network-disposal',
  'post-disposal-proof',
  'fixed-completion-evidence-publication',
] as const;

export async function executeProfileMaterialization(
  argv: readonly string[],
  effects: ProfileMaterializationLiveEffects,
  signal: AbortSignal,
): Promise<ProfileMaterializationCompletionEvidence> {
  const preflight = await preflightProfileMaterialization(argv, effects);
  if (signal.aborted) throw ingestionError('ingestion.cancelled');
  const credentials = readCredentials(preflight.arguments, effects);
  const runDeadline = AbortSignal.timeout(
    preflight.arguments.runDeadlineMilliseconds,
  );
  const combinedSignal = AbortSignal.any([signal, runDeadline]);
  let databaseCreationAttempted = false;
  let disposed = false;
  let evidence: ProfileMaterializationCompletionEvidence | undefined;
  let failure: unknown;
  try {
    databaseCreationAttempted = true;
    await effects.createDatabase(
      preflight.databasePlan,
      credentials,
      combinedSignal,
    );
    await effects.proveEmptyDatabase(
      preflight.databasePlan,
      credentials,
      combinedSignal,
    );
    const databaseProof = await effects.prepareDatabase(
      preflight,
      credentials,
      combinedSignal,
    );
    validateDatabaseProof(databaseProof);
    const firstCollected = await effects.collectSourceAuthority(
      'first',
      preflight,
      credentials,
      null,
      combinedSignal,
    );
    const first = parseProfileMaterializationSourceAuthority(
      firstCollected.sourceAuthority,
      preflight,
    );
    const candidateIds = first.candidates.map((entry) => entry.candidateId);
    const firstPersistenceProof = parseProfileMaterializationPersistenceProof(
      firstCollected.persistenceProof,
      { collection: 'first', sourceAuthority: first, candidateIds },
    );
    await effects.publishSourceAuthority('first', first, preflight);
    await effects.publishPersistenceProof(
      'first',
      firstPersistenceProof,
      preflight,
    );
    const firstA = effects.materializeProfiles(preflight, first);
    const firstB = effects.materializeProfiles(preflight, first);
    assertSamePass(firstA, firstB);
    const secondCollected = await effects.collectSourceAuthority(
      'second',
      preflight,
      credentials,
      first,
      combinedSignal,
    );
    const second = parseProfileMaterializationSourceAuthority(
      secondCollected.sourceAuthority,
      preflight,
    );
    const secondPersistenceProof = parseProfileMaterializationPersistenceProof(
      secondCollected.persistenceProof,
      { collection: 'second', sourceAuthority: second, candidateIds },
    );
    await effects.publishSourceAuthority('second', second, preflight);
    await effects.publishPersistenceProof(
      'second',
      secondPersistenceProof,
      preflight,
    );
    const drift = compareProfileMaterializationSources(first, second);
    const secondA = effects.materializeProfiles(preflight, second);
    const secondB = effects.materializeProfiles(preflight, second);
    assertSamePass(secondA, secondB);
    const failures = controlledFailureCounts([first, second]);
    const liveIdempotency = deriveProfileMaterializationLiveIdempotency({
      firstAuthority: first,
      secondAuthority: second,
      firstProof: firstPersistenceProof,
      secondProof: secondPersistenceProof,
    });
    const receipt = buildProfileMaterializationReceipt({
      receiptVersion: 'profile-materialization-receipt/1.0.0',
      operatorVersion: PROFILE_MATERIALIZATION_OPERATOR_VERSION,
      providerPolicyVersion: preflight.policy.policyVersion,
      providerPolicyDigest: preflight.policy.policySemanticDigest,
      sourceAuthorityVersion: PROFILE_MATERIALIZATION_SOURCE_AUTHORITY_VERSION,
      persistenceProofVersion:
        PROFILE_MATERIALIZATION_PERSISTENCE_PROOF_VERSION,
      firstPersistenceProofSemanticDigest:
        firstPersistenceProof.proofSemanticDigest,
      secondPersistenceProofSemanticDigest:
        secondPersistenceProof.proofSemanticDigest,
      firstPersistenceCounts: persistenceProofCounts(firstPersistenceProof),
      secondPersistenceCounts: persistenceProofCounts(secondPersistenceProof),
      firstSourceAuthoritySemanticDigest: first.authoritySemanticDigest,
      secondSourceAuthoritySemanticDigest: second.authoritySemanticDigest,
      finalSourceAuthoritySemanticDigest: second.authoritySemanticDigest,
      firstSourceRecordCounts: sourceRecordCounts(first),
      secondSourceRecordCounts: sourceRecordCounts(second),
      firstSourceOutcomeCounts: sourceOutcomeCounts(first),
      secondSourceOutcomeCounts: sourceOutcomeCounts(second),
      sourceDriftComparisonDigest: drift.comparisonDigest,
      sourceDriftCounts: drift.counts,
      firstPassA: passDigests(firstA),
      firstPassB: passDigests(firstB),
      secondPassA: passDigests(secondA),
      secondPassB: passDigests(secondB),
      sameEvidenceReproduction: 'passed',
      liveIdempotency,
      qualification:
        failures.length === 0
          ? 'complete'
          : 'qualified-optional-source-failures',
      catalogVersion: preflight.catalog.catalogVersion,
      catalogDigest: preflight.catalog.manifestDigest,
      taxonomyVersion: '1.0.0',
      taxonomyDigest: preflight.taxonomy.semanticDigest,
      profileSchemaDigest:
        PROFILE_MATERIALIZATION_ACCEPTED_BINDINGS.profileSchemaDigest,
      profileAuthoritySchemaDigest:
        PROFILE_MATERIALIZATION_ACCEPTED_BINDINGS.profileAuthoritySchemaDigest,
      profileRulesVersion: 'deterministic-candidate-profile-rules/1.0.0',
      projectionVersion: 'profile-materialization-projection/1.0.0',
      ...databaseProof,
      candidateCount: 150,
      aggregateFieldStates: secondA.coverage.aggregate.final,
      fieldCoverage: secondA.coverage.perField.map((field) => ({
        fieldId: field.fieldId,
        ...field.final,
      })),
      familyCoverage: secondA.coverage.perFamily.map((family) => ({
        family: family.family,
        ...family.final,
      })),
      controlledFailureCounts: failures,
      runIdDigest: preflight.databasePlan.identity.runIdDigest,
    });
    evidence = {
      receipt,
      coverage: secondA.coverage,
      completionMarkdown: renderProfileMaterializationCompletion(
        receipt,
        secondA.coverage.coverageSemanticDigest,
      ),
    };
    await effects.quarantineCompletionEvidence(evidence, preflight);
  } catch (error) {
    failure = error;
  } finally {
    if (databaseCreationAttempted) {
      try {
        effects.cancel();
        const cleanupSignal = AbortSignal.timeout(30_000);
        await effects.disposeDatabase(preflight.databasePlan, cleanupSignal);
        await effects.proveDisposed(preflight.databasePlan, cleanupSignal);
        disposed = true;
      } catch (cleanupError) {
        failure = cleanupError;
      }
    }
  }
  if (failure !== undefined || !disposed || evidence === undefined) {
    throw failure instanceof Error
      ? failure
      : ingestionError('ingestion.internal-invariant');
  }
  await effects.publishCompletionEvidence(preflight);
  return evidence;
}

export function verifyProfileMaterializationEvidence(
  receiptValue: unknown,
  coverageValue: unknown,
  completionText: string,
): ProfileMaterializationCompletionEvidence {
  const receipt = parseProfileMaterializationReceipt(receiptValue);
  const coverage = parseProfileMaterializationCoverage(coverageValue);
  if (
    receipt.finalSourceAuthoritySemanticDigest !==
      coverage.finalSourceAuthorityDigest ||
    receipt.secondPassA.profileAuthorityDigest !==
      coverage.finalProfileAuthorityDigest ||
    receipt.secondPassA.profileCoverageDigest !==
      coverage.coverageSemanticDigest ||
    completionText !==
      renderProfileMaterializationCompletion(
        receipt,
        coverage.coverageSemanticDigest,
      )
  ) {
    throw ingestionError('ingestion.invalid-receipt');
  }
  return { receipt, coverage, completionMarkdown: completionText };
}

function readCredentials(
  arguments_: ProfileMaterializationArguments,
  effects: ProfileMaterializationLiveEffects,
): ProfileMaterializationCredentials {
  const credentials = {
    githubToken: effects.readCredential(arguments_.githubTokenEnvironmentName),
    ownerUrl: effects.readCredential(arguments_.ownerUrlEnvironmentName),
    ownerPassword: effects.readCredential(
      arguments_.ownerPasswordEnvironmentName,
    ),
    runtimeUrl: effects.readCredential(arguments_.runtimeUrlEnvironmentName),
    runtimePassword: effects.readCredential(
      arguments_.runtimePasswordEnvironmentName,
    ),
  };
  if (
    Object.values(credentials).some(
      (credential) =>
        credential.length < 1 ||
        credential.length > 2_048 ||
        hasControlCharacter(credential),
    )
  ) {
    throw ingestionError('ingestion.invalid-input');
  }
  return credentials;
}

function hasControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 31 || codePoint === 127;
  });
}

function assertSamePass(
  left: ProfileMaterializationArtifacts,
  right: ProfileMaterializationArtifacts,
): void {
  if (
    canonicalizeJson(left).text !== canonicalizeJson(right).text ||
    left.authority.semanticAuthorityDigest !==
      right.authority.semanticAuthorityDigest ||
    left.coverage.coverageSemanticDigest !==
      right.coverage.coverageSemanticDigest
  ) {
    throw ingestionError('ingestion.internal-invariant');
  }
}

function passDigests(artifacts: ProfileMaterializationArtifacts): {
  readonly profileAuthorityDigest: string;
  readonly profileCoverageDigest: string;
} {
  return {
    profileAuthorityDigest: artifacts.authority.semanticAuthorityDigest,
    profileCoverageDigest: artifacts.coverage.coverageSemanticDigest,
  };
}

function validateDatabaseProof(
  proof: ProfileMaterializationDatabaseProof,
): void {
  if (
    proof.migrationCount !==
      PROFILE_MATERIALIZATION_DATABASE_EXPECTATIONS.finalMigrationCount ||
    proof.productTableCount !==
      PROFILE_MATERIALIZATION_DATABASE_EXPECTATIONS.finalProductTableCount ||
    proof.migrationInventoryDigest !==
      PROFILE_MATERIALIZATION_ACCEPTED_BINDINGS.migrationInventoryDigest ||
    proof.databaseSchemaDigest !==
      PROFILE_MATERIALIZATION_ACCEPTED_BINDINGS.databaseSchemaDigest
  ) {
    throw ingestionError('ingestion.persistence');
  }
}

function requireArgument(
  values: ReadonlyMap<string, string>,
  name: string,
): string {
  const value = values.get(name);
  if (value === undefined) throw ingestionError('ingestion.invalid-input');
  return value;
}

function parseInteger(
  values: ReadonlyMap<string, string>,
  name: string,
): number {
  const value = requireArgument(values, name);
  if (!/^\d{1,10}$/u.test(value))
    throw ingestionError('ingestion.invalid-input');
  return Number(value);
}
