import { describe, expect, it } from 'vitest';

import {
  PROFILE_MATERIALIZATION_DATABASE_EXPECTATIONS,
  PROFILE_MATERIALIZATION_EXPECTED_MIGRATIONS,
  PROFILE_MATERIALIZATION_POSTGRES_IMAGE,
  createProfileMaterializationDatabasePlan,
  createProfileMaterializationDatabaseOperator,
  deriveProfileMaterializationDatabaseIdentity,
  validateProfileMaterializationEmptyDatabaseInspection,
  validateProfileMaterializationMigrationInventory,
  validateProfileMaterializationDatabasePlan,
  validateProfileMaterializationSchemaInspection,
} from '../src/index.ts';

const RUN_ID = 'm7-abcdefghijklmnopqrstuvwxyz';

describe('profile-materialization fresh database planning', () => {
  it('derives isolated names and the exact tmpfs-only Docker plan', () => {
    const identity = deriveProfileMaterializationDatabaseIdentity(RUN_ID);
    const plan = createProfileMaterializationDatabasePlan({
      runId: RUN_ID,
      image: PROFILE_MATERIALIZATION_POSTGRES_IMAGE,
      host: '127.0.0.1',
      port: 55432,
      ownerPasswordEnvironmentName:
        'GITBLOCKS_PROFILE_MATERIALIZATION_DB_OWNER_PASSWORD',
    });
    expect(plan.identity).toEqual(identity);
    expect(plan.createContainer.arguments).toContain('--tmpfs');
    expect(plan.createContainer.arguments).not.toContain('--volume');
    expect(plan.createContainer.arguments).not.toContain('--mount');
    expect(plan.image).toBe(
      'postgres:18.4-bookworm@sha256:1961f96e6029a02c3812d7cb329a3b03a3ac2bb067058dec17b0f5596aca9296',
    );
    expect(plan.expectations).toEqual(
      PROFILE_MATERIALIZATION_DATABASE_EXPECTATIONS,
    );
    expect(plan.migrations).toEqual(
      PROFILE_MATERIALIZATION_EXPECTED_MIGRATIONS,
    );
    expect(() => {
      validateProfileMaterializationDatabasePlan(plan);
    }).not.toThrow();
  });

  it('rejects wrong images, hosts, ports, credential names, and Phase 7 identity', () => {
    const base = {
      runId: RUN_ID,
      image: PROFILE_MATERIALIZATION_POSTGRES_IMAGE,
      host: '127.0.0.1',
      port: 55432,
      ownerPasswordEnvironmentName:
        'GITBLOCKS_PROFILE_MATERIALIZATION_DB_OWNER_PASSWORD',
    };
    for (const override of [
      { image: 'postgres:18' },
      { host: 'localhost' },
      { port: 543 },
      { ownerPasswordEnvironmentName: 'DATABASE_URL' },
      { runId: 'phase-7-abcdefghijklmnopqrstu' },
    ]) {
      expect(() =>
        createProfileMaterializationDatabasePlan({ ...base, ...override }),
      ).toThrow();
    }
  });

  it('rejects plan mutation, preexisting identities, and database URL identity mismatch', async () => {
    const plan = createPlan();
    const mutated = structuredClone(plan) as unknown as Record<string, unknown>;
    (mutated['labels'] as string[]).push('unexpected=true');
    expect(() => {
      validateProfileMaterializationDatabasePlan(mutated as never);
    }).toThrow();

    const calls: string[][] = [];
    const operator = createProfileMaterializationDatabaseOperator({
      runProcess: (command) => {
        calls.push([...command.arguments]);
        return Promise.resolve({ exitCode: 0, stdout: '{}' });
      },
      sleep: () => Promise.resolve(),
    });
    await expect(
      operator.create(
        plan,
        credentials({ ownerUrl: 'postgresql://wrong@127.0.0.1:55432/wrong' }),
        new AbortController().signal,
      ),
    ).rejects.toThrow();
    expect(calls).toHaveLength(0);

    await expect(
      operator.create(plan, credentials(), new AbortController().signal),
    ).rejects.toThrow('profile-materialization.database-identity-collision');
    expect(calls[0]).toEqual([
      'container',
      'inspect',
      plan.identity.containerName,
    ]);
  });

  it('rejects named/bind volumes, label drift, and expectation drift', () => {
    const plan = createPlan();
    const mutations = [
      (value: Record<string, unknown>) => {
        (value['createContainer'] as { arguments: string[] }).arguments.push(
          '--volume',
          'named-data:/var/lib/postgresql/data',
        );
      },
      (value: Record<string, unknown>) => {
        (value['createContainer'] as { arguments: string[] }).arguments.push(
          '--mount',
          'type=bind,source=/tmp,target=/var/lib/postgresql/data',
        );
      },
      (value: Record<string, unknown>) => {
        (value['labels'] as string[])[0] = 'wrong-label=true';
      },
      (value: Record<string, unknown>) => {
        (value['expectations'] as Record<string, unknown>)[
          'finalMigrationCount'
        ] = 5;
      },
    ];
    for (const mutate of mutations) {
      const changed = structuredClone(plan) as unknown as Record<
        string,
        unknown
      >;
      mutate(changed);
      expect(() => {
        validateProfileMaterializationDatabasePlan(changed as never);
      }).toThrow('profile-materialization.invalid-database-plan');
    }
  });

  it('rejects nonempty state and migration inventory drift without database effects', () => {
    expect(() => {
      validateProfileMaterializationEmptyDatabaseInspection({
        migrationTableCount: 0,
        productTableCount: 1,
      });
    }).toThrow('profile-materialization.database-not-empty');
    expect(() => {
      validateProfileMaterializationMigrationInventory(
        PROFILE_MATERIALIZATION_EXPECTED_MIGRATIONS.slice(0, 3),
      );
    }).toThrow('profile-materialization.migration-drift');
    expect(() => {
      validateProfileMaterializationMigrationInventory(
        PROFILE_MATERIALIZATION_EXPECTED_MIGRATIONS.map((migration, index) =>
          index === 3 ? { ...migration, checksum: '0'.repeat(64) } : migration,
        ),
      );
    }).toThrow('profile-materialization.migration-drift');
  });

  it('rejects every schema-count and runtime-role privilege drift', () => {
    const accepted = {
      productTableCount: 25,
      rowSecurityPolicyCount: 0,
      schemaFunctionCount: 7,
      noninternalTriggerCount: 48,
      requiredIndexCount: 15,
      runtimeRoleSafe: true,
      runtimeMembership: true,
    };
    expect(() => {
      validateProfileMaterializationSchemaInspection(accepted);
    }).not.toThrow();
    for (const override of [
      { productTableCount: 24 },
      { rowSecurityPolicyCount: 1 },
      { schemaFunctionCount: 6 },
      { noninternalTriggerCount: 47 },
      { requiredIndexCount: 14 },
      { runtimeRoleSafe: false },
      { runtimeMembership: false },
    ]) {
      expect(() => {
        validateProfileMaterializationSchemaInspection({
          ...accepted,
          ...override,
        });
      }).toThrow('profile-materialization.database-schema-drift');
    }
  });

  it('requires exact post-disposal absence for both isolated resources', async () => {
    const plan = createPlan();
    const operator = createProfileMaterializationDatabaseOperator({
      runProcess: () => Promise.resolve({ exitCode: 0, stdout: '{}' }),
      sleep: () => Promise.resolve(),
    });
    await expect(
      operator.proveDisposed(plan, new AbortController().signal),
    ).rejects.toThrow('profile-materialization.database-identity-collision');
  });

  it('does not confuse an inspection failure with resource absence', async () => {
    const plan = createPlan();
    const operator = createProfileMaterializationDatabaseOperator({
      runProcess: () => Promise.resolve({ exitCode: 125, stdout: '' }),
      sleep: () => Promise.resolve(),
    });
    await expect(
      operator.proveDisposed(plan, new AbortController().signal),
    ).rejects.toThrow('profile-materialization.resource-inspection-failed');
  });

  it('attempts both exact cleanup targets even when one process fails', async () => {
    const plan = createPlan();
    const calls: string[][] = [];
    const operator = createProfileMaterializationDatabaseOperator({
      runProcess: (processPlan) => {
        calls.push([...processPlan.arguments]);
        return processPlan.arguments[0] === 'rm'
          ? Promise.reject(new Error('controlled fake process failure'))
          : Promise.resolve({ exitCode: 0, stdout: '' });
      },
      sleep: () => Promise.resolve(),
    });
    await expect(
      operator.dispose(plan, new AbortController().signal),
    ).rejects.toThrow('profile-materialization.cleanup-failed');
    expect(calls).toEqual([
      [...plan.removeContainer.arguments],
      [...plan.removeNetwork.arguments],
    ]);
  });
});

function createPlan() {
  return createProfileMaterializationDatabasePlan({
    runId: RUN_ID,
    image: PROFILE_MATERIALIZATION_POSTGRES_IMAGE,
    host: '127.0.0.1',
    port: 55432,
    ownerPasswordEnvironmentName:
      'GITBLOCKS_PROFILE_MATERIALIZATION_DB_OWNER_PASSWORD',
  });
}

function credentials(
  override: Partial<{
    ownerUrl: string;
    ownerPassword: string;
    runtimeUrl: string;
    runtimePassword: string;
  }> = {},
) {
  return {
    ownerUrl:
      'postgresql://gitblocks_p8_m7_abcdefghijklmnopqrstuvwxyz_owner@127.0.0.1:55432/gitblocks_p8_m7_abcdefghijklmnopqrstuvwxyz_test',
    ownerPassword: 'owner-password',
    runtimeUrl:
      'postgresql://gitblocks_p8_m7_abcdefghijklmnopqrstuvwxyz_runtime@127.0.0.1:55432/gitblocks_p8_m7_abcdefghijklmnopqrstuvwxyz_test',
    runtimePassword: 'runtime-password',
    ...override,
  };
}
