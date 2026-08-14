import { readFile } from 'node:fs/promises';

import { describe, expect, it, vi } from 'vitest';

import {
  assertArtifactLiveDatabaseMigrationVersionV1,
  withVerifiedArtifactLiveDatabaseMigrationV1,
} from '../scripts/artifact-live-authority.ts';

const MIGRATION_ERROR =
  'The artifact database must be verified at migration 0007.';

describe('live artifact migration authority', () => {
  it('accepts and carries only exact migration 0007', async () => {
    const version = exactVersion(7);
    expect(version).toBe(7);

    const runCollection = vi.fn((accepted: 7) => Promise.resolve(accepted));
    await expect(
      withVerifiedArtifactLiveDatabaseMigrationV1(
        () =>
          Promise.resolve({
            migrations: [
              { version: 1 },
              { version: 2 },
              { version: 3 },
              { version: 4 },
              { version: 5 },
              { version: 6 },
              { version: 7 },
            ],
          }),
        runCollection,
      ),
    ).resolves.toBe(7);
    expect(runCollection).toHaveBeenCalledExactlyOnceWith(7);
  });

  it.each([
    ['migration 0004', 4],
    ['migration 0006', 6],
    ['migration 0008', 8],
    ['missing latest migration', undefined],
    ['noninteger migration', 7.5],
    ['string migration', '7'],
    ['null migration', null],
  ] as const)('rejects %s with one fixed value-free error', (_name, value) => {
    expect(() => {
      assertArtifactLiveDatabaseMigrationVersionV1(value);
    }).toThrow(MIGRATION_ERROR);
    try {
      assertArtifactLiveDatabaseMigrationVersionV1(value);
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe(MIGRATION_ERROR);
    }
  });

  it('rejects migration 0006 before collection and receipt effects', async () => {
    const collectionEffects = vi.fn(() => Promise.resolve('receipt'));
    const receiptWrite = vi.fn();

    await expect(
      withVerifiedArtifactLiveDatabaseMigrationV1(
        () =>
          Promise.resolve({
            migrations: [
              { version: 1 },
              { version: 2 },
              { version: 3 },
              { version: 4 },
              { version: 5 },
              { version: 6 },
            ],
          }),
        collectionEffects,
      ).then(receiptWrite),
    ).rejects.toThrow(MIGRATION_ERROR);
    expect(collectionEffects).not.toHaveBeenCalled();
    expect(receiptWrite).not.toHaveBeenCalled();
  });

  it('verifies migrations before admitting the collection effect boundary', async () => {
    const events: string[] = [];
    await withVerifiedArtifactLiveDatabaseMigrationV1(
      () => {
        events.push('verify-migrations');
        return Promise.resolve({ migrations: [{ version: 7 }] });
      },
      (version) => {
        events.push(`collection-effects-${String(version)}`);
        return Promise.resolve();
      },
    );
    expect(events).toEqual(['verify-migrations', 'collection-effects-7']);
  });

  it('has no environment, argument, database, network, or dependency escape hatch', async () => {
    const source = await readFile(
      new URL('../scripts/artifact-live-authority.ts', import.meta.url),
      'utf8',
    );
    expect(source).not.toMatch(
      /process\.env|process\.argv|fetch\(|postgres|from ['"]@/u,
    );
  });
});

function exactVersion(value: unknown): 7 {
  assertArtifactLiveDatabaseMigrationVersionV1(value);
  return value;
}
