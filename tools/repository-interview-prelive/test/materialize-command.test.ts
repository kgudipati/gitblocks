import { mkdtemp, readFile, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { serializeCanonicalJson } from '@gitblocks/interviews';
import { createArtifactReceipt } from '@gitblocks/ingestion';
import type { PersistenceClient } from '@gitblocks/persistence';
import { describe, expect, it, vi } from 'vitest';

import {
  buildRepositoryInterviewPreliveExpectedV1,
  parseRepositoryInterviewPreliveMaterializeArgumentsV1,
  runRepositoryInterviewPreliveMaterializeCommandV1,
  writeExclusiveAtomicPreliveOutputsV1,
} from '../src/index.ts';
import { syntheticArtifactAuthorityV1 } from './prelive-fixtures.ts';

describe('repository interview pre-live materialize command', () => {
  it('rejects unknown, duplicate, positional, missing, empty, and acknowledgement drift', () => {
    const valid = argumentsFor();
    expect(
      parseRepositoryInterviewPreliveMaterializeArgumentsV1(valid).selectionId,
    ).toBe('synthetic-materialized-selection');
    for (const invalid of [
      [...valid, '--unknown', 'value'],
      [...valid, '--database-name', 'duplicate'],
      [...valid, 'positional'],
      valid.slice(0, -2),
      replace(valid, '--selection-id', ''),
      replace(valid, '--acknowledge-ephemeral-non-production', 'different'),
      replace(valid, '--database-password-env', 'unsafe-name'),
    ]) {
      expect(() =>
        parseRepositoryInterviewPreliveMaterializeArgumentsV1(invalid),
      ).toThrow('configuration is invalid');
    }
  });

  it('validates arguments and files before its sole named database-password read', async () => {
    const environment = vi.fn(() => 'database-secret-sentinel');
    const createClient = vi.fn(() => {
      throw new Error('database construction sentinel');
    });
    await expect(
      runRepositoryInterviewPreliveMaterializeCommandV1(argumentsFor(), {
        repositoryRoot: process.cwd(),
        readTextFile: () => Promise.resolve('{}'),
        readEnvironment: environment,
        createPersistenceClient: createClient,
      }),
    ).rejects.toThrow('materialization');
    expect(environment).not.toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
  });

  it('rejects a digest-correct migration-0003 receipt before every external effect', async () => {
    const fixture = await syntheticArtifactAuthorityV1();
    const expected = await buildRepositoryInterviewPreliveExpectedV1(
      process.cwd(),
    );
    const historicalReceipt = createArtifactReceipt({
      catalog: fixture.catalog,
      manifest: fixture.artifactManifest,
      runId: 'synthetic-historical-materialization-run',
      startedAt: '2026-07-30T18:00:00.000Z',
      completedAt: '2026-07-30T18:01:00.000Z',
      candidates: fixture.receipt.candidates,
      providerMetrics: {
        providerRequestCounts: { github: 0, npm: 0 },
        githubRateLimit: null,
      },
      databaseMigrationVersion: 3,
      operationalDecodedBytes: 0,
    });
    const files = new Map([
      [
        '/tmp/calibration.plan.json',
        serializeCanonicalJson(expected.plans.calibration),
      ],
      ['/tmp/fresh-receipt.json', serializeCanonicalJson(historicalReceipt)],
    ]);
    const environment = vi.fn(() => 'database-secret-sentinel');
    const createClient = vi.fn(() => {
      throw new Error('database construction sentinel');
    });
    const loadArtifactSet = vi.fn(() => {
      throw new Error('artifact load sentinel');
    });
    const writeOutputs = vi.fn(() => Promise.resolve());

    await expect(
      runRepositoryInterviewPreliveMaterializeCommandV1(argumentsFor(), {
        repositoryRoot: process.cwd(),
        readTextFile: (path) => Promise.resolve(files.get(path) ?? ''),
        readEnvironment: environment,
        createPersistenceClient: createClient,
        loadArtifactSet,
        writeOutputs,
      }),
    ).rejects.toThrow('materialization');
    expect(environment).not.toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
    expect(loadArtifactSet).not.toHaveBeenCalled();
    expect(writeOutputs).not.toHaveBeenCalled();
  });

  it('uses only receipt-named loads and writes only selection and binding bytes', async () => {
    const fixture = await syntheticArtifactAuthorityV1();
    const expected = await buildRepositoryInterviewPreliveExpectedV1(
      process.cwd(),
    );
    const files = new Map([
      [
        '/tmp/calibration.plan.json',
        serializeCanonicalJson(expected.plans.calibration),
      ],
      ['/tmp/fresh-receipt.json', serializeCanonicalJson(fixture.receipt)],
    ]);
    const environment = vi.fn((name: string) =>
      name === 'SYNTHETIC_DB_PASSWORD' ? 'database-secret-sentinel' : undefined,
    );
    const fakeClient = Object.freeze({
      kind: 'gitblocks-postgresql-persistence' as const,
    }) as PersistenceClient;
    const loads: string[] = [];
    const writes = vi.fn(
      (outputs: Parameters<typeof writeExclusiveAtomicPreliveOutputsV1>[0]) => {
        void outputs;
        return Promise.resolve();
      },
    );
    await runRepositoryInterviewPreliveMaterializeCommandV1(argumentsFor(), {
      repositoryRoot: process.cwd(),
      readTextFile: (path) => Promise.resolve(files.get(path) ?? ''),
      readEnvironment: environment,
      createPersistenceClient: () => fakeClient,
      closePersistenceClient: () => Promise.resolve(),
      verifyMigrations: () =>
        Promise.resolve({
          postgresqlVersion: '18.4',
          migrations: migrationInventory(),
        }),
      loadArtifactSet: (_client, artifactSetId) => {
        loads.push(artifactSetId);
        return Promise.resolve(fixture.sets.get(artifactSetId)!);
      },
      writeOutputs: writes,
    });
    expect(environment).toHaveBeenCalledTimes(1);
    expect(environment).toHaveBeenCalledWith('SYNTHETIC_DB_PASSWORD');
    expect(loads).toEqual(
      expected.plans.calibration.candidateIds.map(
        (candidateId) =>
          fixture.receipt.candidates.find(
            (candidate) => candidate.candidateId === candidateId,
          )!.artifactSetId,
      ),
    );
    expect(writes).toHaveBeenCalledTimes(1);
    const outputs = writes.mock.calls[0]?.[0];
    expect(outputs).toHaveLength(2);
    const serialized = JSON.stringify(outputs);
    expect(serialized).not.toContain('database-secret-sentinel');
    expect(serialized).not.toContain('synthetic-db-host');
    expect(serialized).not.toContain('synthetic-db');
  });

  it('publishes 0600 outputs exclusively without following or replacing a final symlink', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'gitblocks-prelive-'));
    const selection = join(directory, 'selection.json');
    const materialization = join(directory, 'materialization.json');
    await writeExclusiveAtomicPreliveOutputsV1([
      { path: selection, content: '{"selection":true}\n' },
      { path: materialization, content: '{"materialization":true}\n' },
    ]);
    expect(await readFile(selection, 'utf8')).toBe('{"selection":true}\n');
    expect((await stat(selection)).mode & 0o777).toBe(0o600);
    expect((await stat(materialization)).mode & 0o777).toBe(0o600);
    await expect(
      writeExclusiveAtomicPreliveOutputsV1([
        { path: selection, content: '{}\n' },
        { path: join(directory, 'other.json'), content: '{}\n' },
      ]),
    ).rejects.toThrow('file operation failed');

    const target = join(directory, 'target.json');
    const link = join(directory, 'link.json');
    await writeFile(target, 'unchanged', 'utf8');
    await symlink(target, link);
    await expect(
      writeExclusiveAtomicPreliveOutputsV1([
        { path: link, content: '{}\n' },
        { path: join(directory, 'unused.json'), content: '{}\n' },
      ]),
    ).rejects.toThrow('file operation failed');
    expect(await readFile(target, 'utf8')).toBe('unchanged');
  });
});

function argumentsFor(): string[] {
  return [
    '--candidate-plan-file',
    '/tmp/calibration.plan.json',
    '--artifact-receipt-file',
    '/tmp/fresh-receipt.json',
    '--database-host',
    'synthetic-db-host',
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
    '--acknowledge-ephemeral-non-production',
    'synthetic-db',
    '--selection-id',
    'synthetic-materialized-selection',
    '--selection-output-path',
    resolve('/tmp/synthetic-selection.json'),
    '--materialization-output-path',
    resolve('/tmp/synthetic-materialization.json'),
  ];
}

function replace(
  input: readonly string[],
  key: string,
  value: string,
): string[] {
  const copy = [...input];
  copy[copy.indexOf(key) + 1] = value;
  return copy;
}

function migrationInventory() {
  return [
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
  ];
}
