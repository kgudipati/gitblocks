import { mkdtemp, readFile, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { beforeAll, describe, expect, it, vi } from 'vitest';

import {
  loadRepositoryInterviewSpecification,
  type LoadedRepositoryInterviewSpecification,
} from '@gitblocks/interviews';

import { runRepositoryInterviewOperatorCliV1 } from '../src/cli.ts';
import {
  createRepositoryInterviewOperatorPolicyV1,
  createRepositoryInterviewOperatorSelectionV1,
  parseRepositoryInterviewOperatorArgumentsV1,
} from '../src/index.ts';
import {
  createProcessRunDeadlineControlV1,
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
    const selection = createRepositoryInterviewOperatorSelectionV1({
      schemaVersion: '1.0.0',
      selectionId: 'dry-run-selection',
      catalogVersion: 'public-v1',
      catalogDigest: DIGEST,
      artifactManifestVersion: 'public-artifacts-v1',
      artifactManifestDigest: DIGEST,
      members: [
        {
          ordinal: 0,
          candidateId: 'dry-run-candidate',
          artifactSetId: `artifact-set-${'b'.repeat(48)}`,
          artifactSetIdentityDigest: DIGEST,
        },
      ],
    });
    const policy = createRepositoryInterviewOperatorPolicyV1(
      policyDraft(profile),
      profile,
    );
    const files = new Map([
      ['/tmp/selection.json', JSON.stringify(selection)],
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
});

function argumentsFor(): string[] {
  return [
    '--acknowledge-ephemeral-non-production',
    'synthetic-db',
    '--selection-file',
    '/tmp/selection.json',
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
