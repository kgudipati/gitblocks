import {
  modelExecutionModelProfileDigest,
  type ModelExecutionModelProfileV1,
} from '@gitblocks/contracts';
import {
  createArtifactReceipt,
  parseCompleteArtifactReceiptTextV1,
} from '@gitblocks/ingestion';
import {
  createRepositoryInterviewOperatorPolicyV1,
  createRepositoryInterviewPreliveAuthorizationV1,
  runRepositoryInterviewOperatorCliV1,
} from '@gitblocks/repository-interview-operator';
import { describe, expect, it, vi } from 'vitest';

import {
  buildRepositoryInterviewPreliveExpectedV1,
  materializeRepositoryInterviewOperatorSelectionV1,
  validateCommittedRepositoryInterviewCandidatePlanV1,
  validateCommittedRepositoryInterviewModelProfileV1,
  validateRepositoryInterviewPreliveAuthorizationClosureV1,
} from '../src/index.ts';
import { syntheticArtifactAuthorityV1 } from './prelive-fixtures.ts';

const PRICING_DIGEST = 'b'.repeat(64);
const RETENTION_DIGEST = 'c'.repeat(64);

describe('repository interview operator pre-live CLI closure', () => {
  it('accepts only either exact committed profile during plan-only dry-run', async () => {
    const expected = await buildRepositoryInterviewPreliveExpectedV1(
      process.cwd(),
    );
    const environment = vi.fn(() => 'secret sentinel');
    const createClient = vi.fn(() => {
      throw new Error('database sentinel');
    });
    const createFetch = vi.fn(() => {
      throw new Error('network sentinel');
    });
    const writeReceipt = vi.fn(() => Promise.resolve());

    for (const profile of expected.profiles) {
      const policy = createRepositoryInterviewOperatorPolicyV1(
        policyDraft(profile),
        profile,
      );
      const output: string[] = [];
      const errors: string[] = [];
      const files = new Map([
        [
          '/tmp/candidate-plan.json',
          JSON.stringify(expected.plans.calibration),
        ],
        ['/tmp/profile.json', JSON.stringify(profile)],
        ['/tmp/policy.json', JSON.stringify(policy)],
      ]);
      const exit = await runRepositoryInterviewOperatorCliV1(
        planOnlyArguments(),
        {
          readTextFile: (path) => Promise.resolve(files.get(path) ?? ''),
          readEnvironment: environment,
          createFetch,
          writeStdout: (text) => output.push(text),
          writeStderr: (text) => errors.push(text),
          writeReceipt,
          createPersistenceClient: createClient,
          validateCandidatePlan: (input) =>
            Promise.resolve(
              validateCommittedRepositoryInterviewCandidatePlanV1(
                input,
                expected.plans,
              ),
            ),
          validateModelProfile: (input) =>
            Promise.resolve(
              validateCommittedRepositoryInterviewModelProfileV1(
                input,
                expected.profiles,
              ),
            ),
        },
      );
      expect(exit).toBe(0);
      expect(errors).toEqual([]);
      expect(JSON.parse(output[0]!)).toMatchObject({
        status: 'dry-run-valid',
        modelProfileDigest: modelExecutionModelProfileDigest(profile),
        materializationChecked: false,
        liveAuthorizationChecked: false,
        liveReady: false,
      });
    }

    const profile = expected.profiles[0];
    const policy = createRepositoryInterviewOperatorPolicyV1(
      policyDraft(profile),
      profile,
    );
    const mutations: readonly unknown[] = [
      { ...profile, reasoningEffort: 'medium' },
      { ...profile, maximumOutputTokens: profile.maximumOutputTokens - 1 },
      { ...profile, maximumResponseBytes: profile.maximumResponseBytes - 1 },
      { ...profile, promptCacheRetention: '24h' },
      { ...profile, providerProjectionDigest: 'a'.repeat(64) },
      { ...profile, toolsEnabled: true },
      { ...profile, background: true },
      { ...profile, conversationState: true },
      { ...profile, previousResponseState: true },
      { ...profile, modelSnapshot: 'gpt-5.4-2026-03-06' },
      { ...profile, extra: true },
      Object.fromEntries(
        Object.entries(profile).filter(([key]) => key !== 'serviceTier'),
      ),
    ];
    for (const mutation of mutations) {
      const output: string[] = [];
      const errors: string[] = [];
      const files = new Map([
        [
          '/tmp/candidate-plan.json',
          JSON.stringify(expected.plans.calibration),
        ],
        ['/tmp/profile.json', JSON.stringify(mutation)],
        ['/tmp/policy.json', JSON.stringify(policy)],
      ]);
      const exit = await runRepositoryInterviewOperatorCliV1(
        planOnlyArguments(),
        {
          readTextFile: (path) => Promise.resolve(files.get(path) ?? ''),
          readEnvironment: environment,
          createFetch,
          writeStdout: (text) => output.push(text),
          writeStderr: (text) => errors.push(text),
          writeReceipt,
          createPersistenceClient: createClient,
          validateCandidatePlan: (input) =>
            Promise.resolve(
              validateCommittedRepositoryInterviewCandidatePlanV1(
                input,
                expected.plans,
              ),
            ),
          validateModelProfile: (input) =>
            Promise.resolve(
              validateCommittedRepositoryInterviewModelProfileV1(
                input,
                expected.profiles,
              ),
            ),
        },
      );
      expect(exit).toBe(1);
      expect(output).toEqual([]);
      expect(errors).toEqual([
        'Repository interview operator execution failed.\n',
      ]);
    }
    expect(environment).not.toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
    expect(createFetch).not.toHaveBeenCalled();
    expect(writeReceipt).not.toHaveBeenCalled();
  });

  it('accepts the complete synthetic group in dry-run with zero external effects', async () => {
    const authority = await completeAuthority();
    const output: string[] = [];
    const errors: string[] = [];
    const environment = vi.fn(() => undefined);
    const createClient = vi.fn(() => {
      throw new Error('database sentinel');
    });
    const createFetch = vi.fn(() => {
      throw new Error('network sentinel');
    });
    const writeReceipt = vi.fn(() => Promise.resolve());
    const exit = await runRepositoryInterviewOperatorCliV1(
      completeArguments(true),
      {
        readTextFile: (path) =>
          Promise.resolve(authority.files.get(path) ?? ''),
        readEnvironment: environment,
        createFetch,
        writeStdout: (text) => output.push(text),
        writeStderr: (text) => errors.push(text),
        writeReceipt,
        createPersistenceClient: createClient,
        validateCandidatePlan: (input) =>
          Promise.resolve(
            validateCommittedRepositoryInterviewCandidatePlanV1(
              input,
              authority.expected.plans,
            ),
          ),
        validateModelProfile: (input) =>
          Promise.resolve(
            validateCommittedRepositoryInterviewModelProfileV1(
              input,
              authority.expected.profiles,
            ),
          ),
        parseCompleteArtifactReceipt: (text) =>
          parseCompleteArtifactReceiptTextV1(text, {
            catalogVersion: 'public-v1',
            catalogDigest: authority.expected.manifest.catalogDigest,
            artifactManifestVersion: 'public-artifacts-v1',
            artifactManifestDigest:
              authority.expected.manifest.artifactManifestDigest,
            candidateIds: authority.fixture.candidateIds,
            databaseMigrationVersion: 4,
          }),
        validatePreliveClosure: (input) =>
          validateRepositoryInterviewPreliveAuthorizationClosureV1({
            ...input,
            calibrationCandidatePlan: authority.expected.plans.calibration,
            fullCatalogCandidateIds: authority.fixture.candidateIds,
            allowedModelProfileDigests: authority.allowedProfiles,
          }),
      },
    );
    expect(exit).toBe(0);
    expect(environment).not.toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
    expect(createFetch).not.toHaveBeenCalled();
    expect(writeReceipt).not.toHaveBeenCalled();
    expect(errors).toEqual([]);
    expect(JSON.parse(output[0]!)).toMatchObject({
      status: 'dry-run-valid',
      candidateCount: 6,
      materializationChecked: true,
      liveAuthorizationChecked: true,
      liveReady: false,
      databaseChecked: false,
      providerChecked: false,
    });
  });

  it('rejects malformed and expired authorization before either secret read', async () => {
    const authority = await completeAuthority();
    for (const [authorization, now] of [
      [
        { ...authority.authorization, authorizationDigest: 'd'.repeat(64) },
        '2026-08-02T12:00:00.000Z',
      ],
      [authority.authorization, '2026-08-03T00:00:00.000Z'],
    ] as const) {
      const files = new Map(authority.files);
      files.set('/tmp/authorization.json', JSON.stringify(authorization));
      const environment = vi.fn(() => 'secret sentinel');
      const createClient = vi.fn(() => {
        throw new Error('database sentinel');
      });
      const exit = await runRepositoryInterviewOperatorCliV1(
        completeArguments(false),
        {
          readTextFile: (path) => Promise.resolve(files.get(path) ?? ''),
          readEnvironment: environment,
          createFetch: () => {
            throw new Error('network sentinel');
          },
          writeStdout: vi.fn(),
          writeStderr: vi.fn(),
          createPersistenceClient: createClient,
          validateCandidatePlan: (input) =>
            Promise.resolve(
              validateCommittedRepositoryInterviewCandidatePlanV1(
                input,
                authority.expected.plans,
              ),
            ),
          validateModelProfile: (input) =>
            Promise.resolve(
              validateCommittedRepositoryInterviewModelProfileV1(
                input,
                authority.expected.profiles,
              ),
            ),
          parseCompleteArtifactReceipt: (text) =>
            parseCompleteArtifactReceiptTextV1(text, {
              catalogVersion: 'public-v1',
              catalogDigest: authority.expected.manifest.catalogDigest,
              artifactManifestVersion: 'public-artifacts-v1',
              artifactManifestDigest:
                authority.expected.manifest.artifactManifestDigest,
              candidateIds: authority.fixture.candidateIds,
              databaseMigrationVersion: 4,
            }),
          validatePreliveClosure: (input) =>
            validateRepositoryInterviewPreliveAuthorizationClosureV1({
              ...input,
              calibrationCandidatePlan: authority.expected.plans.calibration,
              fullCatalogCandidateIds: authority.fixture.candidateIds,
              allowedModelProfileDigests: authority.allowedProfiles,
            }),
          authorizationNow: () => now,
        },
      );
      expect(exit).toBe(1);
      expect(environment).not.toHaveBeenCalled();
      expect(createClient).not.toHaveBeenCalled();
    }
  });

  it('rejects migration 0003 before authorization, secrets, database, or provider construction', async () => {
    const authority = await completeAuthority();
    const historicalReceipt = createArtifactReceipt({
      catalog: authority.fixture.catalog,
      manifest: authority.fixture.artifactManifest,
      runId: 'synthetic-historical-cli-run',
      startedAt: '2026-07-30T18:00:00.000Z',
      completedAt: '2026-07-30T18:01:00.000Z',
      candidates: authority.fixture.receipt.candidates,
      providerMetrics: {
        providerRequestCounts: { github: 0, npm: 0 },
        githubRateLimit: null,
      },
      databaseMigrationVersion: 3,
      operationalDecodedBytes: 0,
    });
    const files = new Map(authority.files);
    files.set('/tmp/artifact-receipt.json', JSON.stringify(historicalReceipt));
    const environment = vi.fn(() => 'secret sentinel');
    const createClient = vi.fn(() => {
      throw new Error('database sentinel');
    });
    const createFetch = vi.fn(() => {
      throw new Error('provider sentinel');
    });
    const validateClosure = vi.fn(() => {
      throw new Error('authorization sentinel');
    });
    const authorizationNow = vi.fn(() => '2026-08-02T12:00:00.000Z');
    const output: string[] = [];
    const exit = await runRepositoryInterviewOperatorCliV1(
      completeArguments(false),
      {
        readTextFile: (path) => Promise.resolve(files.get(path) ?? ''),
        readEnvironment: environment,
        createFetch,
        writeStdout: (text) => output.push(text),
        writeStderr: vi.fn(),
        createPersistenceClient: createClient,
        validateCandidatePlan: (input) =>
          Promise.resolve(
            validateCommittedRepositoryInterviewCandidatePlanV1(
              input,
              authority.expected.plans,
            ),
          ),
        validateModelProfile: (input) =>
          Promise.resolve(
            validateCommittedRepositoryInterviewModelProfileV1(
              input,
              authority.expected.profiles,
            ),
          ),
        parseCompleteArtifactReceipt: (text) =>
          parseCompleteArtifactReceiptTextV1(text, {
            catalogVersion: 'public-v1',
            catalogDigest: authority.expected.manifest.catalogDigest,
            artifactManifestVersion: 'public-artifacts-v1',
            artifactManifestDigest:
              authority.expected.manifest.artifactManifestDigest,
            candidateIds: authority.fixture.candidateIds,
            databaseMigrationVersion: 4,
          }),
        validatePreliveClosure: validateClosure,
        authorizationNow,
      },
    );
    expect(exit).toBe(1);
    expect(output).toEqual([]);
    expect(validateClosure).not.toHaveBeenCalled();
    expect(authorizationNow).not.toHaveBeenCalled();
    expect(environment).not.toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
    expect(createFetch).not.toHaveBeenCalled();
  });
});

async function completeAuthority() {
  const expected = await buildRepositoryInterviewPreliveExpectedV1(
    process.cwd(),
  );
  const fixture = await syntheticArtifactAuthorityV1();
  const materialized = await materializeRepositoryInterviewOperatorSelectionV1(
    {
      candidatePlan: expected.plans.calibration,
      artifactReceipt: fixture.receipt,
      fullCatalogCandidateIds: fixture.candidateIds,
      selectionId: 'synthetic-cli-selection',
    },
    {
      loadRepositoryArtifactSet(artifactSetId) {
        return Promise.resolve(fixture.sets.get(artifactSetId)!);
      },
    },
  );
  const modelProfile = expected.profiles[0];
  const policy = createRepositoryInterviewOperatorPolicyV1(
    policyDraft(modelProfile),
    modelProfile,
  );
  const allowedProfiles = expected.profiles
    .map(modelExecutionModelProfileDigest)
    .sort() as [string, string];
  const authorization = createRepositoryInterviewPreliveAuthorizationV1({
    schemaVersion: '1.0.0',
    authorizationId: 'synthetic-cli-authorization',
    scope: 'calibration-six',
    status: 'approved',
    candidatePlanId: expected.plans.calibration.planId,
    candidatePlanDigest: expected.plans.calibration.planDigest,
    artifactCollectionReceiptVersion: fixture.receipt.receiptVersion,
    artifactCollectionReceiptDigest: fixture.receipt.receiptDigest,
    selectionMaterializationDigest:
      materialized.materialization.materializationDigest,
    selectionId: materialized.selection.selectionId,
    selectionDigest: materialized.selection.selectionDigest,
    allowedModelProfileDigests: allowedProfiles,
    specificationDigest: expected.manifest.specificationDigest,
    catalogDigest: expected.manifest.catalogDigest,
    artifactManifestDigest: expected.manifest.artifactManifestDigest,
    operatorPolicyDigest: policy.policyDigest,
    pricingAuthorityDigest: PRICING_DIGEST,
    retentionAuthorityDigest: RETENTION_DIGEST,
    databaseScope: 'ephemeral-non-production',
    maximumProviderCalls: 12,
    maximumCostMicroUsd: 10_000_000,
    authorizedAt: '2026-08-02T00:00:00.000Z',
    expiresAt: '2026-08-03T00:00:00.000Z',
  });
  const files = new Map([
    ['/tmp/candidate-plan.json', JSON.stringify(expected.plans.calibration)],
    ['/tmp/artifact-receipt.json', JSON.stringify(fixture.receipt)],
    ['/tmp/selection.json', JSON.stringify(materialized.selection)],
    ['/tmp/materialization.json', JSON.stringify(materialized.materialization)],
    ['/tmp/authorization.json', JSON.stringify(authorization)],
    ['/tmp/profile.json', JSON.stringify(modelProfile)],
    ['/tmp/policy.json', JSON.stringify(policy)],
  ]);
  return {
    expected,
    fixture,
    allowedProfiles,
    authorization,
    files,
  };
}

function planOnlyArguments(): string[] {
  return completeArguments(true).filter((argument, index, values) => {
    const omitted = new Set([
      '--artifact-receipt-file',
      '--selection-file',
      '--selection-materialization-file',
      '--prelive-authorization-file',
    ]);
    return !omitted.has(argument) && !omitted.has(values[index - 1] ?? '');
  });
}

function completeArguments(dryRun: boolean): string[] {
  return [
    '--acknowledge-ephemeral-non-production',
    'synthetic-db',
    '--candidate-plan-file',
    '/tmp/candidate-plan.json',
    '--artifact-receipt-file',
    '/tmp/artifact-receipt.json',
    '--selection-file',
    '/tmp/selection.json',
    '--selection-materialization-file',
    '/tmp/materialization.json',
    '--prelive-authorization-file',
    '/tmp/authorization.json',
    '--specification-directory',
    `${process.cwd()}/interviews/repository/specifications/1.0.0`,
    '--model-profile-file',
    '/tmp/profile.json',
    '--operator-policy-file',
    '/tmp/policy.json',
    '--database-host',
    'localhost',
    '--database-port',
    '5432',
    '--database-name',
    'synthetic-db',
    '--database-user',
    'synthetic-user',
    '--database-ssl',
    'disabled',
    '--database-password-env',
    'SYNTHETIC_DB_PASSWORD',
    '--openai-token-env',
    'SYNTHETIC_OPENAI_TOKEN',
    '--receipt-path',
    '/tmp/operator-receipt.json',
    ...(dryRun ? ['--dry-run'] : []),
  ];
}

function policyDraft(profile: ModelExecutionModelProfileV1) {
  return {
    schemaVersion: '1.0.0' as const,
    policyId: 'synthetic-cli-policy',
    maximumCandidates: 6,
    concurrency: 1 as const,
    candidateDeadlineMilliseconds: 300_000,
    runDeadlineMilliseconds: 86_400_000,
    statementTimeoutMilliseconds: 10_000,
    lockTimeoutMilliseconds: 5_000,
    maximumInputTokensPerProviderCall: 1_000,
    maximumOutputTokensPerProviderCall: 8_192,
    maximumRunInputTokens: 6_000,
    maximumRunCachedInputTokens: 6_000,
    maximumRunOutputTokens: 49_152,
    maximumRunReasoningTokens: 49_152,
    maximumRunTotalTokens: 55_152,
    maximumRunCostMicroUsd: 10_000_000,
    pricing: {
      provider: 'openai' as const,
      modelSnapshot: profile.modelSnapshot,
      inputMicroUsdPerMillionTokens: 10,
      cachedInputMicroUsdPerMillionTokens: 5,
      outputMicroUsdPerMillionTokens: 20,
      pricingAuthorityDate: '2026-08-01',
      pricingAuthorityDigest: PRICING_DIGEST,
    },
  };
}
