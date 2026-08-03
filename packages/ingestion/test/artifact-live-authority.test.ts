import { readFile } from 'node:fs/promises';

import { describe, expect, it, vi } from 'vitest';

import {
  assertArtifactLiveDatabaseMigrationVersionV1,
  withVerifiedArtifactLiveDatabaseMigrationV1,
} from '../scripts/artifact-live-authority.ts';

const MIGRATION_ERROR =
  'The artifact database must be verified at migration 0004.';

describe('live artifact migration authority', () => {
  it('accepts and carries only exact migration 0004', async () => {
    const version = exactVersion(4);
    expect(version).toBe(4);

    const runCollection = vi.fn((accepted: 4) => Promise.resolve(accepted));
    await expect(
      withVerifiedArtifactLiveDatabaseMigrationV1(
        () =>
          Promise.resolve({
            migrations: [
              { version: 1 },
              { version: 2 },
              { version: 3 },
              { version: 4 },
            ],
          }),
        runCollection,
      ),
    ).resolves.toBe(4);
    expect(runCollection).toHaveBeenCalledExactlyOnceWith(4);
  });

  it.each([
    ['migration 0003', 3],
    ['migration 0005', 5],
    ['missing latest migration', undefined],
    ['noninteger migration', 4.5],
    ['string migration', '4'],
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

  it('rejects migration 0003 before collection and receipt effects', async () => {
    const collectionEffects = vi.fn(() => Promise.resolve('receipt'));
    const receiptWrite = vi.fn();

    await expect(
      withVerifiedArtifactLiveDatabaseMigrationV1(
        () =>
          Promise.resolve({
            migrations: [{ version: 1 }, { version: 2 }, { version: 3 }],
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
        return Promise.resolve({ migrations: [{ version: 4 }] });
      },
      (version) => {
        events.push(`collection-effects-${String(version)}`);
        return Promise.resolve();
      },
    );
    expect(events).toEqual(['verify-migrations', 'collection-effects-4']);
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

function exactVersion(value: unknown): 4 {
  assertArtifactLiveDatabaseMigrationVersionV1(value);
  return value;
}
