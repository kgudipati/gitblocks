import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  PROFILE_MATERIALIZATION_FIXED_PATHS,
  type ProfileMaterializationArguments,
} from '../src/index.ts';
import { createProfileMaterializationSystemEffects } from '../scripts/profile-materialization-system-effects.ts';

describe('profile-materialization fixed filesystem boundary', () => {
  it('rejects symlinked fixed inputs without consulting clock, environment, fetch, or database', async () => {
    const root = await mkdtemp(join(tmpdir(), 'gitblocks-m7a-path-'));
    try {
      const target = join(root, 'controlled.json');
      const catalogDirectory = join(root, 'catalog/public-v1');
      await mkdir(catalogDirectory, { recursive: true });
      await writeFile(target, '{}', { mode: 0o600 });
      await symlink(
        target,
        join(catalogDirectory, 'profile-materialization-provider-policy.json'),
      );
      const effects = createProfileMaterializationSystemEffects({
        repositoryRoot: root,
        environment: new Proxy(
          {},
          {
            get: () => {
              throw new Error('environment access was not expected');
            },
          },
        ),
        fetch: () => {
          throw new Error('fetch was not expected');
        },
        now: () => {
          throw new Error('clock access was not expected');
        },
        databaseOperator: deniedDatabase(),
      });
      await expect(
        effects.readFixedFile(PROFILE_MATERIALIZATION_FIXED_PATHS.policy),
      ).rejects.toThrow();
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });

  it('rejects a symlinked run-directory parent before any credential read', async () => {
    const root = await mkdtemp(join(tmpdir(), 'gitblocks-m7a-path-'));
    try {
      for (const path of [
        PROFILE_MATERIALIZATION_FIXED_PATHS.catalog,
        PROFILE_MATERIALIZATION_FIXED_PATHS.taxonomy,
        PROFILE_MATERIALIZATION_FIXED_PATHS.policy,
      ]) {
        const target = join(root, path);
        await mkdir(join(target, '..'), { recursive: true });
        await writeFile(target, '{}', { mode: 0o600 });
      }
      await mkdir(join(root, 'outside'), { mode: 0o700 });
      await mkdir(join(root, 'verification/retrieval-v1'), {
        recursive: true,
      });
      await symlink(
        join(root, 'outside'),
        join(root, 'verification/retrieval-v1/.profile-materialization-runs'),
      );
      const effects = createProfileMaterializationSystemEffects({
        repositoryRoot: root,
        environment: {},
        fetch: () => {
          throw new Error('fetch was not expected');
        },
        now: () => {
          throw new Error('clock access was not expected');
        },
        databaseOperator: deniedDatabase(),
      });
      await expect(
        effects.validateFixedPaths({
          catalogPath: PROFILE_MATERIALIZATION_FIXED_PATHS.catalog,
          taxonomyPath: PROFILE_MATERIALIZATION_FIXED_PATHS.taxonomy,
          providerPolicyPath: PROFILE_MATERIALIZATION_FIXED_PATHS.policy,
          runDirectory:
            'verification/retrieval-v1/.profile-materialization-runs/m7-abcdefghijklmnopqrstuvwxyz',
        } as ProfileMaterializationArguments),
      ).rejects.toThrow();
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });
});

function deniedDatabase() {
  const denied = (): never => {
    throw new Error('database access was not expected');
  };
  return {
    create: denied,
    proveEmpty: denied,
    prepare: denied,
    dispose: denied,
    proveDisposed: denied,
  };
}
