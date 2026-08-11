import { readFile } from 'node:fs/promises';

import type { CandidateDossierV1 } from '@gitblocks/contracts';
import { describe, expect, it } from 'vitest';

import { canonicalizeJson } from '../src/canonical-json.ts';
import {
  closePersistenceClient,
  createCandidateDossierSnapshot,
  createPersistenceClient,
  knownMigrationInventory,
  loadRepositoryArtifact,
  PersistenceError,
  putCatalogCandidate,
  selectActiveDossierMaterial,
  type PersistenceClientConfig,
} from '../src/index.ts';
import { createCandidateDossier, type MutableValue } from './fixtures.ts';

const UNREACHABLE_CONFIG: PersistenceClientConfig = {
  host: '127.0.0.1',
  port: 1,
  database: 'gitblocks_test',
  username: 'gitblocks_test',
  password: 'test-only',
  ssl: false,
  connectTimeoutMilliseconds: 250,
};

describe('persistence package boundary', () => {
  it('creates and closes a lazy injected client without connecting', async () => {
    const client = createPersistenceClient(UNREACHABLE_CONFIG);

    await expect(closePersistenceClient(client)).resolves.toBeUndefined();
    await expect(closePersistenceClient(client)).resolves.toBeUndefined();
  });

  it('rejects invalid client configuration with a stable value-free error', () => {
    let caught: unknown;
    try {
      createPersistenceClient({
        ...UNREACHABLE_CONFIG,
        host: 'unsafe\nhost',
        password: 'password-sentinel',
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(PersistenceError);
    expect(caught).toMatchObject({
      code: 'persistence.invalid-input',
      message: 'Persistence input is invalid.',
      stack: undefined,
    });
    expect(JSON.stringify(caught)).not.toContain('password-sentinel');
  });

  it('rejects malformed immutable creation metadata before database I/O', async () => {
    const client = createPersistenceClient(UNREACHABLE_CONFIG);
    const dossier = createCandidateDossier('candidate-alpha');

    try {
      await expect(
        putCatalogCandidate(client, {
          identity: dossier.identity,
          createdAt: 'malformed-timestamp',
        }),
      ).rejects.toMatchObject({ code: 'persistence.invalid-input' });
    } finally {
      await closePersistenceClient(client);
    }
  });

  it('rejects a malformed evidence cutoff before database I/O', async () => {
    const client = createPersistenceClient(UNREACHABLE_CONFIG);

    try {
      await expect(
        selectActiveDossierMaterial(client, {
          candidateId: 'candidate-alpha',
          evidenceCutoff: 'malformed-timestamp',
        }),
      ).rejects.toMatchObject({ code: 'persistence.invalid-input' });
    } finally {
      await closePersistenceClient(client);
    }
  });

  it('rejects candidate-authority snapshot evidence until a migration is authorized', async () => {
    const client = createPersistenceClient(UNREACHABLE_CONFIG);
    const dossier: MutableValue<CandidateDossierV1> =
      createCandidateDossier('candidate-alpha');
    dossier.observations[0]!.source = {
      kind: 'structured-provider-snapshot',
      sourceType: 'public-structured-provider',
      provider: 'github',
      sourceClass: 'repository-metadata',
      sourceIdentity: 'github-example-alpha',
      sourceUrl: 'https://api.github.com/repos/example/alpha',
      sourceAuthorityDigest: 'a'.repeat(64),
      sourceRecordDigest: 'b'.repeat(64),
      collectedAt: '2026-07-28T20:30:00Z',
      effectiveAsOf: '2026-07-28T20:30:00Z',
      sourceMutability: 'mutable',
      completenessState: 'complete',
      limitationCode: 'source-is-mutable',
    };
    try {
      await expect(
        createCandidateDossierSnapshot(client, {
          snapshotId: 'snapshot-candidate-authority',
          dossier,
          evidenceCutoff: '2026-07-28T21:00:00Z',
          createdAt: '2026-07-28T21:00:00Z',
        }),
      ).rejects.toMatchObject({ code: 'persistence.invalid-input' });
    } finally {
      await closePersistenceClient(client);
    }
  });

  it('rejects missing or unsupported artifact chunker versions before database I/O', async () => {
    const client = createPersistenceClient(UNREACHABLE_CONFIG);
    const artifactId = `artifact-${'a'.repeat(48)}`;

    try {
      await expect(
        loadRepositoryArtifact(client, { artifactId } as never),
      ).rejects.toMatchObject({ code: 'persistence.invalid-input' });
      await expect(
        loadRepositoryArtifact(client, {
          artifactId,
          chunkerVersion: 'unsupported-chunker',
        } as never),
      ).rejects.toMatchObject({ code: 'persistence.invalid-input' });
    } finally {
      await closePersistenceClient(client);
    }
  });

  it('canonicalizes object key order and distinguishes changed values', () => {
    const left = canonicalizeJson({
      beta: ['one', { delta: true, gamma: null }],
      alpha: 1,
    });
    const right = canonicalizeJson({
      alpha: 1,
      beta: ['one', { gamma: null, delta: true }],
    });
    const changed = canonicalizeJson({
      alpha: 2,
      beta: ['one', { gamma: null, delta: true }],
    });

    expect(left.json).toBe(right.json);
    expect(left.digest).toBe(right.digest);
    expect(changed.digest).not.toBe(left.digest);
  });

  it('rejects executable or non-JSON canonical input', () => {
    expect(() => canonicalizeJson(new Date())).toThrow(
      expect.objectContaining({ code: 'persistence.invalid-input' }),
    );
    expect(() => canonicalizeJson({ value: undefined })).toThrow(
      expect.objectContaining({ code: 'persistence.invalid-input' }),
    );
  });

  it('exposes only the fixed forward migration inventory', () => {
    expect(knownMigrationInventory()).toEqual([
      {
        version: 1,
        name: 'evidence-persistence',
        fileName: '0001_evidence_persistence.sql',
      },
      {
        version: 2,
        name: 'runtime-migration-verification',
        fileName: '0002_runtime_migration_verification.sql',
      },
      {
        version: 3,
        name: 'immutable-repository-artifacts',
        fileName: '0003_immutable_repository_artifacts.sql',
      },
      {
        version: 4,
        name: 'repository-interviews',
        fileName: '0004_repository_interviews.sql',
      },
    ]);
  });

  it('contains no environment reads, runtime raw SQL, or logging calls', async () => {
    const [clientSource, indexSource, operationsSource, artifactSource] =
      await Promise.all([
        readFile(new URL('../src/client.ts', import.meta.url), 'utf8'),
        readFile(new URL('../src/index.ts', import.meta.url), 'utf8'),
        readFile(new URL('../src/operations.ts', import.meta.url), 'utf8'),
        readFile(
          new URL('../src/artifact-operations.ts', import.meta.url),
          'utf8',
        ),
      ]);

    expect(clientSource).not.toContain('process.env');
    expect(operationsSource).not.toContain('.unsafe(');
    expect(operationsSource).not.toMatch(/\bconsole\./u);
    expect(operationsSource).not.toMatch(/\b(?:eval|Function)\s*\(/u);
    expect(artifactSource).not.toContain('.unsafe(');
    expect(artifactSource).not.toMatch(/\bconsole\./u);
    expect(artifactSource).not.toMatch(/\b(?:eval|Function)\s*\(/u);
    expect(artifactSource).toContain('and chunker_version = ${chunkerVersion}');
    expect(indexSource).not.toMatch(
      /\b(?:tenant|expiry|purge|tombstone|StorageScope)\b/iu,
    );
  });
});
