import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import { canonicalizeJson } from '../src/canonical-json.ts';
import {
  closePersistenceClient,
  createPersistenceClient,
  knownMigrationInventory,
  PersistenceError,
  putCatalogCandidate,
  selectActiveDossierMaterial,
  type PersistenceClientConfig,
  type StorageScope,
} from '../src/index.ts';
import { createCandidateDossier } from './fixtures.ts';

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

  it('requires explicit tenant expiry before attempting database I/O', async () => {
    const client = createPersistenceClient(UNREACHABLE_CONFIG);
    const dossier = createCandidateDossier('candidate-alpha');
    const malformedScope = {
      kind: 'tenant',
      tenantId: '11111111-1111-4111-8111-111111111111',
    } as unknown as StorageScope;

    try {
      await expect(
        putCatalogCandidate(client, {
          scope: malformedScope,
          identity: dossier.identity,
          createdAt: '2026-07-28T22:00:00Z',
        }),
      ).rejects.toMatchObject({ code: 'persistence.invalid-input' });
    } finally {
      await closePersistenceClient(client);
    }
  });

  it('rejects an unbounded active-material page before database I/O', async () => {
    const client = createPersistenceClient(UNREACHABLE_CONFIG);

    try {
      await expect(
        selectActiveDossierMaterial(client, {
          scope: { kind: 'public' },
          candidateId: 'candidate-alpha',
          evidenceCutoff: '2026-07-28T21:00:00Z',
          limit: 101,
        }),
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
    ]);
  });

  it('contains no environment reads, runtime raw SQL, or logging calls', async () => {
    const [clientSource, operationsSource] = await Promise.all([
      readFile(new URL('../src/client.ts', import.meta.url), 'utf8'),
      readFile(new URL('../src/operations.ts', import.meta.url), 'utf8'),
    ]);

    expect(clientSource).not.toContain('process.env');
    expect(operationsSource).not.toContain('.unsafe(');
    expect(operationsSource).not.toMatch(/\bconsole\./u);
    expect(operationsSource).not.toMatch(/\b(?:eval|Function)\s*\(/u);
  });
});
