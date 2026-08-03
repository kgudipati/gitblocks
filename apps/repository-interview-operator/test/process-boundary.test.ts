import { mkdtemp, readFile, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { beforeAll, describe, expect, it, vi } from 'vitest';

import { createRepositoryArtifactSetV1 } from '@gitblocks/contracts';
import {
  loadRepositoryInterviewSpecification,
  type LoadedRepositoryInterviewSpecification,
} from '@gitblocks/interviews';
import type * as InterviewsModule from '@gitblocks/interviews';
import type * as PersistenceModule from '@gitblocks/persistence';
import type * as PersistenceAdapterModule from '../src/persistence-adapter.ts';

const processBoundaryMocks = vi.hoisted(() => ({
  createProvider: vi.fn(),
  createPersistenceAdapter: vi.fn(),
  validateSelectionPersistence: vi.fn(),
  verifyMigrations: vi.fn(),
}));

vi.mock('@gitblocks/interviews', async (importOriginal) => ({
  ...(await importOriginal<typeof InterviewsModule>()),
  createOpenAiResponsesRepositoryInterviewProviderV1:
    processBoundaryMocks.createProvider,
}));

vi.mock('@gitblocks/persistence', async (importOriginal) => ({
  ...(await importOriginal<typeof PersistenceModule>()),
  verifyMigrations: processBoundaryMocks.verifyMigrations,
}));

vi.mock('../src/persistence-adapter.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof PersistenceAdapterModule>()),
  createRepositoryInterviewPersistenceAdapterV1:
    processBoundaryMocks.createPersistenceAdapter,
  validateRepositoryInterviewOperatorSelectionPersistenceV1:
    processBoundaryMocks.validateSelectionPersistence,
}));

import { runRepositoryInterviewOperatorCliV1 } from '../src/cli.ts';
import {
  createRepositoryInterviewOperatorPolicyV1,
  createRepositoryInterviewCandidatePlanV1,
  createRepositoryInterviewOperatorSelectionV1,
  parseRepositoryInterviewOperatorArgumentsV1,
  parseRepositoryInterviewOperatorReceiptV1,
  REPOSITORY_INTERVIEW_ARTIFACT_MANIFEST_DIGEST,
  REPOSITORY_INTERVIEW_CATALOG_DIGEST,
  repositoryInterviewOperatorReceiptDigestV1,
} from '../src/index.ts';
import {
  createExplicitGlobalFetchPortV1,
  createProcessAttemptControlPortV1,
  createProcessCandidateControlFactoryV1,
  createProcessRunDeadlineControlV1,
  createProcessSleeperPortV1,
  writeRepositoryInterviewOperatorReceiptFileV1,
} from '../src/process-ports.ts';

const DIGEST = 'a'.repeat(64);
let specification: LoadedRepositoryInterviewSpecification;

beforeAll(async () => {
  specification = await loadRepositoryInterviewSpecification(
    'interviews/repository/specifications/1.0.0',
  );
});

describe('operator process boundary', () => {
  it('requires exact nonproduction acknowledgement and closed CLI arguments', () => {
    const valid = argumentsFor();
    expect(parseRepositoryInterviewOperatorArgumentsV1(valid).dryRun).toBe(
      true,
    );
    expect(() =>
      parseRepositoryInterviewOperatorArgumentsV1(
        replaceArgument(
          valid,
          '--acknowledge-ephemeral-non-production',
          'other',
        ),
      ),
    ).toThrow('configuration is invalid');
    expect(() =>
      parseRepositoryInterviewOperatorArgumentsV1([...valid, '--unknown']),
    ).toThrow('configuration is invalid');
    expect(() =>
      parseRepositoryInterviewOperatorArgumentsV1([
        ...valid,
        '--database-name',
        'duplicate',
      ]),
    ).toThrow('configuration is invalid');
    expect(() =>
      parseRepositoryInterviewOperatorArgumentsV1([...valid, 'positional']),
    ).toThrow('configuration is invalid');
    expect(() =>
      parseRepositoryInterviewOperatorArgumentsV1([
        ...valid,
        '--selection-file',
        '/tmp/selection.json',
      ]),
    ).toThrow('configuration is invalid');
    expect(() =>
      parseRepositoryInterviewOperatorArgumentsV1(
        replaceArgument(valid, '--openai-token-env', 'unsafe-name'),
      ),
    ).toThrow('configuration is invalid');
    expect(() =>
      parseRepositoryInterviewOperatorArgumentsV1([
        ...valid.filter((argument) => argument !== '--dry-run'),
        '--force',
      ]),
    ).toThrow('configuration is invalid');
    expect(() =>
      parseRepositoryInterviewOperatorArgumentsV1([
        ...valid.filter((argument) => argument !== '--dry-run'),
        '--force',
        '--force-reason',
        'operator-recovery',
        '--verify-immediate-reuse',
      ]),
    ).toThrow('configuration is invalid');
  });

  it('performs a deterministic dry run without secret, database, provider, clock, telemetry, or receipt effects', async () => {
    const profile = modelProfile();
    const candidatePlan = createRepositoryInterviewCandidatePlanV1({
      schemaVersion: '1.0.0',
      planId: 'dry-run-candidate-plan',
      catalogVersion: 'public-v1',
      catalogDigest: REPOSITORY_INTERVIEW_CATALOG_DIGEST,
      artifactManifestVersion: 'public-artifacts-v1',
      artifactManifestDigest: REPOSITORY_INTERVIEW_ARTIFACT_MANIFEST_DIGEST,
      candidateIds: ['dry-run-candidate'],
    });
    const policy = createRepositoryInterviewOperatorPolicyV1(
      policyDraft(profile),
      profile,
    );
    const files = new Map([
      ['/tmp/candidate-plan.json', JSON.stringify(candidatePlan)],
      ['/tmp/profile.json', JSON.stringify(profile)],
      ['/tmp/policy.json', JSON.stringify(policy)],
    ]);
    const output: string[] = [];
    const errors: string[] = [];
    const environment = vi.fn(() => undefined);
    const createClient = vi.fn(() => {
      throw new Error('database sentinel');
    });
    const createFetch = vi.fn(() =>
      vi.fn(() => Promise.reject(new Error('network sentinel'))),
    );
    const receipt = vi.fn(() => Promise.resolve());
    const exit = await runRepositoryInterviewOperatorCliV1(argumentsFor(), {
      readTextFile: (path) => Promise.resolve(files.get(path) ?? ''),
      readEnvironment: environment,
      createFetch,
      writeStdout: (text) => output.push(text),
      writeStderr: (text) => errors.push(text),
      writeReceipt: receipt,
      createPersistenceClient: createClient,
    });
    expect(exit).toBe(0);
    expect(environment).not.toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
    expect(createFetch).not.toHaveBeenCalled();
    expect(receipt).not.toHaveBeenCalled();
    expect(errors).toEqual([]);
    expect(output).toHaveLength(1);
    expect(JSON.parse(output[0]!)).toMatchObject({
      status: 'dry-run-valid',
      materializationChecked: false,
      liveAuthorizationChecked: false,
      liveReady: false,
      databaseChecked: false,
      providerChecked: false,
      candidateCount: 1,
    });
    expect(output[0]).not.toContain('synthetic-db');
    expect(output[0]).not.toContain('TOKEN');

    const overBudget = createRepositoryInterviewOperatorPolicyV1(
      {
        ...policyDraft(profile),
        maximumRunInputTokens: 999,
        maximumRunCachedInputTokens: 999,
      },
      profile,
    );
    files.set('/tmp/policy.json', JSON.stringify(overBudget));
    expect(
      await runRepositoryInterviewOperatorCliV1(argumentsFor(), {
        readTextFile: (path) => Promise.resolve(files.get(path) ?? ''),
        readEnvironment: environment,
        createFetch,
        writeStdout: (text) => output.push(text),
        writeStderr: (text) => errors.push(text),
        writeReceipt: receipt,
        createPersistenceClient: createClient,
      }),
    ).toBe(1);
    expect(environment).not.toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
    expect(createFetch).not.toHaveBeenCalled();
    expect(receipt).not.toHaveBeenCalled();
  });

  it('writes one stopped receipt and exits one after a completed response fails mapping', async () => {
    const profile = modelProfile();
    const candidatePlan = createRepositoryInterviewCandidatePlanV1({
      schemaVersion: '1.0.0',
      planId: 'stopped-candidate-plan',
      catalogVersion: 'public-v1',
      catalogDigest: REPOSITORY_INTERVIEW_CATALOG_DIGEST,
      artifactManifestVersion: 'public-artifacts-v1',
      artifactManifestDigest: REPOSITORY_INTERVIEW_ARTIFACT_MANIFEST_DIGEST,
      candidateIds: ['stopped-candidate'],
    });
    const policy = createRepositoryInterviewOperatorPolicyV1(
      policyDraft(profile),
      profile,
    );
    const artifactSet = createRepositoryArtifactSetV1({
      contractVersion: '1.0.0',
      candidateId: 'stopped-candidate',
      catalogVersion: 'public-v1',
      catalogDigest: REPOSITORY_INTERVIEW_CATALOG_DIGEST,
      artifactManifestVersion: 'public-artifacts-v1',
      artifactManifestDigest: REPOSITORY_INTERVIEW_ARTIFACT_MANIFEST_DIGEST,
      collectorVersion: 'repository-artifacts-v1',
      chunkerVersion: 'exact-lines-v1',
      provider: 'github',
      providerRepositoryId: '789',
      providerCanonicalOwner: 'owner-safe',
      providerCanonicalRepository: 'repository-safe',
      gitObjectAlgorithm: 'sha1',
      commitObjectId: '3'.repeat(40),
      entries: [
        {
          selectionId: `selection-${'5'.repeat(48)}`,
          ordinal: 0,
          selector: 'root-readme',
          artifactKind: 'readme',
          requirement: 'optional',
          rationale: null,
          requestedPath: null,
          resolvedPath: null,
          outcome: 'not-found',
          artifactId: null,
        },
      ],
      publishedAt: '2026-07-31T12:00:00.000Z',
    });
    const selection = createRepositoryInterviewOperatorSelectionV1({
      schemaVersion: '1.0.0',
      selectionId: 'stopped-selection',
      catalogVersion: 'public-v1',
      catalogDigest: REPOSITORY_INTERVIEW_CATALOG_DIGEST,
      artifactManifestVersion: 'public-artifacts-v1',
      artifactManifestDigest: REPOSITORY_INTERVIEW_ARTIFACT_MANIFEST_DIGEST,
      members: [
        {
          ordinal: 0,
          candidateId: artifactSet.candidateId,
          artifactSetId: artifactSet.artifactSetId,
          artifactSetIdentityDigest: artifactSet.identityDigest,
        },
      ],
    });
    const files = new Map([
      ['/tmp/candidate-plan.json', JSON.stringify(candidatePlan)],
      ['/tmp/profile.json', JSON.stringify(profile)],
      ['/tmp/policy.json', JSON.stringify(policy)],
      ['/tmp/artifact-receipt.json', '{}'],
      ['/tmp/selection.json', '{}'],
      ['/tmp/materialization.json', '{}'],
      ['/tmp/authorization.json', '{}'],
    ]);
    const migration = migrationAuthority();
    const publications: unknown[] = [];
    const persistence = {
      verifyMigrations: () => Promise.resolve(migration),
      forCandidate: () => ({
        loadArtifactContext: () =>
          Promise.resolve({ artifactSet, artifacts: [] }),
        record: {
          findReusable: () => Promise.resolve(null),
          publish: (command: unknown) => {
            publications.push(command);
            return Promise.resolve({ status: 'created' as const });
          },
        },
      }),
    };
    let providerCalls = 0;
    processBoundaryMocks.verifyMigrations.mockResolvedValue(migration);
    processBoundaryMocks.validateSelectionPersistence.mockResolvedValue(
      undefined,
    );
    processBoundaryMocks.createPersistenceAdapter.mockReturnValue(persistence);
    processBoundaryMocks.createProvider.mockReturnValue({
      execute: () => {
        providerCalls += 1;
        return Promise.resolve({
          status: 'response' as const,
          attempts: [processAttempt()],
          usage: {
            inputTokens: 10,
            cachedInputTokens: 0,
            outputTokens: 5,
            reasoningTokens: 1,
            totalTokens: 15,
          },
          providerOutput: { unexpected: 'PROCESS_SEMANTIC_SENTINEL' },
          providerOutputDiagnosticCode: null,
        });
      },
    });
    const receipts: string[] = [];
    const environmentReads: string[] = [];
    const fetch = vi.fn(() =>
      Promise.reject(new Error('network transport must remain unused')),
    );
    const exit = await runRepositoryInterviewOperatorCliV1(liveArguments(), {
      readTextFile: (path) => Promise.resolve(files.get(path) ?? ''),
      readEnvironment: (name) => {
        environmentReads.push(name);
        return name === 'SYNTHETIC_DB_PASSWORD'
          ? 'database-password'
          : undefined;
      },
      createFetch: () => fetch,
      writeStdout: () => undefined,
      writeStderr: () => undefined,
      writeReceipt: (_path, content) => {
        receipts.push(content);
        return Promise.resolve();
      },
      createPersistenceClient: (() => Object.freeze({})) as never,
      closePersistenceClient: () => Promise.resolve(),
      parseCompleteArtifactReceipt: () => ({}),
      validatePreliveClosure: () => ({ selection }),
      authorizationNow: () => '2026-07-31T12:00:00.000Z',
    });

    expect(exit).toBe(1);
    expect(providerCalls).toBe(1);
    expect(fetch).not.toHaveBeenCalled();
    expect(environmentReads).toEqual(['SYNTHETIC_DB_PASSWORD']);
    expect(publications).toHaveLength(1);
    expect(receipts).toHaveLength(1);
    const parsed = parseRepositoryInterviewOperatorReceiptV1(
      JSON.parse(receipts[0]!) as unknown,
    );
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value).toMatchObject({
        status: 'stopped',
        stopCode: 'provider-output-structure',
        candidateResults: [
          {
            status: 'provider-failed',
            failureCode: 'provider-output-invalid',
            interviewId: null,
          },
        ],
        immediateReuse: {
          requested: true,
          passed: false,
          candidateCount: 1,
          reusedCount: 0,
          providerCalls: 0,
          providerAttempts: 0,
          tokenUsage: 0,
          costMicroUsd: 0,
        },
      });
      const { receiptDigest, ...draft } = parsed.value;
      expect(receiptDigest).toBe(
        repositoryInterviewOperatorReceiptDigestV1(draft),
      );
    }
    expect(receipts[0]).not.toContain('PROCESS_SEMANTIC_SENTINEL');
    expect(receipts[0]).not.toContain('owner-safe');
    expect(receipts[0]).not.toContain('repository-safe');
  });

  it('writes one exclusive 0600 canonical receipt file and rejects files and symlinks', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'gitblocks-operator-'));
    const path = join(directory, 'receipt.json');
    await writeRepositoryInterviewOperatorReceiptFileV1(
      path,
      '{"safe":true}\n',
    );
    expect(await readFile(path, 'utf8')).toBe('{"safe":true}\n');
    expect((await stat(path)).mode & 0o777).toBe(0o600);
    await expect(
      writeRepositoryInterviewOperatorReceiptFileV1(path, '{}\n'),
    ).rejects.toThrow('process operation failed');
    const target = join(directory, 'target');
    const link = join(directory, 'link.json');
    await writeFile(target, 'unchanged', 'utf8');
    await symlink(target, link);
    await expect(
      writeRepositoryInterviewOperatorReceiptFileV1(link, '{}\n'),
    ).rejects.toThrow('process operation failed');
    expect(await readFile(target, 'utf8')).toBe('unchanged');
  });

  it('propagates and disposes the bounded run deadline signal', () => {
    vi.useFakeTimers();
    try {
      const expired = new AbortController();
      createProcessRunDeadlineControlV1(expired, 1_000);
      vi.advanceTimersByTime(1_000);
      expect(expired.signal.aborted).toBe(true);

      const disposed = new AbortController();
      const deadline = createProcessRunDeadlineControlV1(disposed, 1_000);
      deadline.dispose();
      deadline.dispose();
      vi.advanceTimersByTime(1_000);
      expect(disposed.signal.aborted).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('immediately closes candidate and attempt controls over an already-aborted parent', () => {
    vi.useFakeTimers();
    try {
      const parent = new AbortController();
      parent.abort();
      const candidates = createProcessCandidateControlFactoryV1(parent.signal);
      const candidate = candidates.beginCandidate({
        ordinal: 0,
        timeoutMilliseconds: 300_000,
      });
      expect(candidate.signal.aborted).toBe(true);
      expect(candidate.outcome()).toBe('run-deadline');
      candidate.dispose();
      candidate.dispose();

      const attempt = createProcessAttemptControlPortV1(
        parent.signal,
      ).beginAttempt({ ordinal: 1, timeoutMilliseconds: 120_000 });
      expect(attempt.signal.aborted).toBe(true);
      expect(attempt.outcome()).toBe('cancelled');
      attempt.dispose();
      attempt.dispose();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('composes exact candidate and parent run deadline authority', () => {
    vi.useFakeTimers();
    try {
      const parent = new AbortController();
      const factory = createProcessCandidateControlFactoryV1(parent.signal);
      const candidate = factory.beginCandidate({
        ordinal: 0,
        timeoutMilliseconds: 300_000,
      });
      vi.advanceTimersByTime(299_999);
      expect(candidate.outcome()).toBe('active');
      vi.advanceTimersByTime(1);
      expect(candidate.signal.aborted).toBe(true);
      expect(candidate.outcome()).toBe('candidate-deadline');
      parent.abort();
      expect(candidate.outcome()).toBe('candidate-deadline');
      candidate.dispose();

      const secondParent = new AbortController();
      const secondFactory = createProcessCandidateControlFactoryV1(
        secondParent.signal,
      );
      const runOwned = secondFactory.beginCandidate({
        ordinal: 1,
        timeoutMilliseconds: 300_000,
      });
      secondParent.abort();
      expect(runOwned.signal.aborted).toBe(true);
      expect(runOwned.outcome()).toBe('run-deadline');
      runOwned.dispose();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not invoke fetch for an already-aborted request signal', async () => {
    const controller = new AbortController();
    controller.abort();
    const underlying = vi.fn(() => Promise.resolve(new Response('{}')));
    const fetch = createExplicitGlobalFetchPortV1(underlying);
    await expect(
      fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        signal: controller.signal,
      }),
    ).rejects.toThrow('process operation failed');
    expect(underlying).not.toHaveBeenCalled();
  });

  it('cancels retry sleep without retaining an abort reason', async () => {
    vi.useFakeTimers();
    try {
      const controller = new AbortController();
      const sleeper = createProcessSleeperPortV1(controller.signal);
      const sleeping = sleeper.sleep(30_000);
      controller.abort('abort sentinel');
      await expect(sleeping).rejects.toThrow('process operation failed');
      expect(vi.getTimerCount()).toBe(0);
      await expect(sleeping).rejects.not.toThrow('abort sentinel');
    } finally {
      vi.useRealTimers();
    }
  });
});

function argumentsFor(): string[] {
  return [
    '--acknowledge-ephemeral-non-production',
    'synthetic-db',
    '--candidate-plan-file',
    '/tmp/candidate-plan.json',
    '--specification-directory',
    resolve('interviews/repository/specifications/1.0.0'),
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
    '/tmp/receipt.json',
    '--dry-run',
  ];
}

function liveArguments(): string[] {
  return [
    ...argumentsFor().filter((argument) => argument !== '--dry-run'),
    '--artifact-receipt-file',
    '/tmp/artifact-receipt.json',
    '--selection-file',
    '/tmp/selection.json',
    '--selection-materialization-file',
    '/tmp/materialization.json',
    '--prelive-authorization-file',
    '/tmp/authorization.json',
    '--verify-immediate-reuse',
  ];
}

function replaceArgument(
  input: readonly string[],
  key: string,
  value: string,
): string[] {
  const copy = [...input];
  const index = copy.indexOf(key);
  copy[index + 1] = value;
  return copy;
}

function modelProfile() {
  return {
    provider: 'openai' as const,
    endpointProfile: 'responses-v1' as const,
    modelSnapshot: 'gpt-5.4-mini-2026-03-17',
    providerProjectionVersion: specification.manifest.openAiProjection.version,
    providerProjectionDigest: specification.manifest.openAiProjection.digest,
    reasoningEffort: 'low' as const,
    maximumOutputTokens: 8_192,
    maximumResponseBytes: 2_097_152,
    store: false as const,
    toolsEnabled: false as const,
    background: false as const,
    conversationState: false as const,
    previousResponseState: false as const,
    truncation: 'disabled' as const,
    promptCacheRetention: 'in-memory' as const,
    serviceTier: 'default' as const,
    retryPolicyVersion: 'repository-interview-retry-v1' as const,
  };
}

function policyDraft(profile: ReturnType<typeof modelProfile>) {
  return {
    schemaVersion: '1.0.0' as const,
    policyId: 'dry-run-policy',
    maximumCandidates: 1,
    concurrency: 1 as const,
    candidateDeadlineMilliseconds: 300_000,
    runDeadlineMilliseconds: 600_000,
    statementTimeoutMilliseconds: 10_000,
    lockTimeoutMilliseconds: 5_000,
    maximumInputTokensPerProviderCall: 1_000,
    maximumOutputTokensPerProviderCall: 8_192,
    maximumRunInputTokens: 1_000,
    maximumRunCachedInputTokens: 1_000,
    maximumRunOutputTokens: 8_192,
    maximumRunReasoningTokens: 8_192,
    maximumRunTotalTokens: 9_192,
    maximumRunCostMicroUsd: 120_000_000,
    pricing: {
      provider: 'openai' as const,
      modelSnapshot: profile.modelSnapshot,
      inputMicroUsdPerMillionTokens: 1_000_000,
      cachedInputMicroUsdPerMillionTokens: 100_000,
      outputMicroUsdPerMillionTokens: 2_000_000,
      pricingAuthorityDate: '2026-07-31',
      pricingAuthorityDigest: DIGEST,
    },
  };
}

function processAttempt() {
  return {
    ordinal: 1 as const,
    startedAt: '2026-07-31T12:00:00.000Z',
    completedAt: '2026-07-31T12:00:01.000Z',
    transportOutcome: 'response' as const,
    httpStatus: 200,
    providerRequestId: null,
    responseId: null,
    responseBytes: 256,
    providerProcessingMilliseconds: 100,
    retryAfterMilliseconds: null,
    remainingRequests: null,
    remainingTokens: null,
    resetRequestsMilliseconds: null,
    resetTokensMilliseconds: null,
  };
}

function migrationAuthority() {
  return {
    postgresqlVersion: '18.4',
    migrations: [
      {
        version: 1,
        name: 'evidence-persistence',
        checksum:
          '569d7a6d6db70b1b04cadfa8798516ce4239b1179bb2f7cdd84b27641e33755f',
      },
      {
        version: 2,
        name: 'runtime-migration-verification',
        checksum:
          'b61cf8ad8673663c646b77e8f0ebed452898aab795aa64f52217e1271e1dc2ae',
      },
      {
        version: 3,
        name: 'immutable-repository-artifacts',
        checksum:
          '0ea1e4698e8eec6d33320df7af4758ae6b3b4fcbe3da387bb042d074b86228dc',
      },
      {
        version: 4,
        name: 'repository-interviews',
        checksum:
          '2cd18e7d92373215b2a540cdf12e32a7e949bfb01866616e8a44ad326e45bca0',
      },
    ],
  };
}
