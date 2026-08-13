import { describe, expect, it, vi } from 'vitest';

import {
  PersistenceError,
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

const postgresFactory = vi.hoisted(() => vi.fn());

vi.mock('postgres', () => ({ default: postgresFactory }));

const RUN_ID = 'm7-abcdefghijklmnopqrstuvwxyz';
const REQUIRED_TMPFS_OPTIONS = 'rw,noexec,nosuid,nodev,size=1073741824';
const SECURE_TMPFS_MOUNTINFO =
  '41 30 0:39 / /var/lib/postgresql rw,nosuid,nodev,noexec,relatime - tmpfs tmpfs rw,size=1048576k,inode64';
const CURRENT_COMPATIBLE_MIGRATIONS = [
  ...PROFILE_MATERIALIZATION_EXPECTED_MIGRATIONS,
  {
    version: 5,
    name: 'retrieval-serving',
    checksum:
      '40359c6dbeaf87ee88f8d46b910f851a74c3155243ca9fa67941620eb253e448',
  },
  {
    version: 6,
    name: 'finalist-evidence-serving',
    checksum:
      '05575971fe03bea06bbd6736b15f68f98c137cf903816bbb8689e843481c70db',
  },
] as const;

describe('profile-materialization zero-state host boundary', () => {
  it('retries one transient host connection failure and then proves zero state', async () => {
    const harness = zeroStateHarness([
      { error: databaseError('ECONNREFUSED') },
      { inspection: emptyInspection() },
    ]);

    await expect(
      harness.operator.proveEmpty(
        harness.plan,
        credentials(),
        new AbortController().signal,
      ),
    ).resolves.toBeUndefined();
    expect(harness.attemptCount()).toBe(2);
    expect(harness.sleepDurations).toEqual([250]);
  });

  it('permits multiple bounded transient failures before success', async () => {
    const harness = zeroStateHarness([
      { error: databaseError('ECONNRESET') },
      { error: databaseError('ETIMEDOUT') },
      { error: databaseError('EPIPE') },
      { inspection: emptyInspection() },
    ]);

    await expect(
      harness.operator.proveEmpty(
        harness.plan,
        credentials(),
        new AbortController().signal,
      ),
    ).resolves.toBeUndefined();
    expect(harness.attemptCount()).toBe(4);
    expect(harness.sleepDurations).toEqual([250, 250, 250]);
  });

  it('returns a typed persistence connection failure after retry exhaustion', async () => {
    const harness = zeroStateHarness(
      Array.from({ length: 10 }, () => ({
        error: databaseError('CONNECTION_CLOSED'),
      })),
    );

    await expect(
      harness.operator.proveEmpty(
        harness.plan,
        credentials(),
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({
      name: 'PersistenceError',
      code: 'persistence.connection',
    });
    expect(harness.attemptCount()).toBe(10);
    expect(harness.sleepDurations).toHaveLength(9);
  });

  it.each(['ECONNREFUSED', 'CONNECT_TIMEOUT'])(
    'classifies %s as a retryable connection-establishment failure',
    async (code) => {
      const harness = zeroStateHarness([
        { error: databaseError(code) },
        { inspection: emptyInspection() },
      ]);

      await expect(
        harness.operator.proveEmpty(
          harness.plan,
          credentials(),
          new AbortController().signal,
        ),
      ).resolves.toBeUndefined();
      expect(harness.attemptCount()).toBe(2);
    },
  );

  it('does not retry PostgreSQL authentication failure', async () => {
    const harness = zeroStateHarness([
      { error: databaseError('28P01') },
      { inspection: emptyInspection() },
    ]);

    await expect(
      harness.operator.proveEmpty(
        harness.plan,
        credentials(),
        new AbortController().signal,
      ),
    ).rejects.toBeInstanceOf(PersistenceError);
    expect(harness.attemptCount()).toBe(1);
    expect(harness.sleepDurations).toEqual([]);
  });

  it('does not retry an arbitrary SQL failure', async () => {
    const primary = new Error('private database failure');
    const harness = zeroStateHarness([
      { error: primary },
      { inspection: emptyInspection() },
    ]);

    await expect(
      harness.operator.proveEmpty(
        harness.plan,
        credentials(),
        new AbortController().signal,
      ),
    ).rejects.toBe(primary);
    expect(harness.attemptCount()).toBe(1);
    expect(harness.sleepDurations).toEqual([]);
  });

  it('does not retry a deterministic nonempty zero-state result', async () => {
    const harness = zeroStateHarness([
      { inspection: { migrationTableCount: 0, productTableCount: 1 } },
      { inspection: emptyInspection() },
    ]);

    await expect(
      harness.operator.proveEmpty(
        harness.plan,
        credentials(),
        new AbortController().signal,
      ),
    ).rejects.toThrow('profile-materialization.database-not-empty');
    expect(harness.attemptCount()).toBe(1);
    expect(harness.sleepDurations).toEqual([]);
  });

  it('performs no SQL effect when already cancelled', async () => {
    const controller = new AbortController();
    controller.abort();
    const harness = zeroStateHarness([{ inspection: emptyInspection() }]);

    await expect(
      harness.operator.proveEmpty(
        harness.plan,
        credentials(),
        controller.signal,
      ),
    ).rejects.toBeInstanceOf(PersistenceError);
    expect(harness.attemptCount()).toBe(0);
  });

  it('does not start another attempt after cancellation during retry sleep', async () => {
    const controller = new AbortController();
    const harness = zeroStateHarness(
      [
        { error: databaseError('ECONNREFUSED') },
        { inspection: emptyInspection() },
      ],
      {
        onSleep: () => {
          controller.abort();
          throw new PersistenceError('persistence.deadline');
        },
      },
    );

    await expect(
      harness.operator.proveEmpty(
        harness.plan,
        credentials(),
        controller.signal,
      ),
    ).rejects.toBeInstanceOf(PersistenceError);
    expect(harness.attemptCount()).toBe(1);
  });

  it('accepts the exact 0/0 empty-state result', async () => {
    const harness = zeroStateHarness([{ inspection: emptyInspection() }]);

    await expect(
      harness.operator.proveEmpty(
        harness.plan,
        credentials(),
        new AbortController().signal,
      ),
    ).resolves.toBeUndefined();
    expect(harness.attemptCount()).toBe(1);
  });

  it.each([
    { migrationTableCount: 0, productTableCount: 1 },
    { migrationTableCount: 1, productTableCount: 0 },
  ])('rejects nonempty zero state without retry: %o', async (inspection) => {
    const harness = zeroStateHarness([{ inspection }]);

    await expect(
      harness.operator.proveEmpty(
        harness.plan,
        credentials(),
        new AbortController().signal,
      ),
    ).rejects.toThrow('profile-materialization.database-not-empty');
    expect(harness.attemptCount()).toBe(1);
  });

  it('preserves the primary query failure when teardown also fails', async () => {
    const primary = new Error('private primary query failure');
    const harness = zeroStateHarness([
      {
        error: primary,
        closeError: new Error('private teardown failure'),
      },
    ]);

    await expect(
      harness.operator.proveEmpty(
        harness.plan,
        credentials(),
        new AbortController().signal,
      ),
    ).rejects.toBe(primary);
    expect(harness.attemptCount()).toBe(1);
  });
});

describe('profile-materialization runtime-role provisioning', () => {
  it('never authors PASSWORD $1 inside CREATE ROLE utility SQL', async () => {
    const harness = prepareDatabaseHarness();

    await harness.prepare();

    expect(harness.provisioningUnsafeSql()).not.toEqual(
      expect.arrayContaining([
        expect.stringMatching(/create role[\s\S]*password \$1/iu),
      ]),
    );
  });

  it('never places the raw runtime password in unsafe SQL text', async () => {
    const runtimePassword = String.raw`hostile-'\\-runtime-password`;
    const harness = prepareDatabaseHarness({ runtimePassword });

    await harness.prepare();

    for (const text of harness.provisioningUnsafeSql()) {
      expect(text).not.toContain(runtimePassword);
    }
  });

  it('keeps hostile password characters bound without changing utility SQL shape', async () => {
    const ordinary = prepareDatabaseHarness({
      runtimePassword: 'ordinary-runtime-password',
    });
    await ordinary.prepare();
    const ordinaryUnsafeSql = ordinary.provisioningUnsafeSql();
    const ordinaryConfigurationSql = ordinary.runtimeConfigurationSql()?.text;
    const hostile = prepareDatabaseHarness({
      runtimePassword: String.raw`quote-'\\-semicolon-;--runtime-password`,
    });
    await hostile.prepare();

    expect(hostile.provisioningUnsafeSql()).toEqual(ordinaryUnsafeSql);
    expect(hostile.runtimeConfigurationSql()?.text).toBe(
      ordinaryConfigurationSql,
    );
    expect(hostile.runtimeConfigurationSql()?.values).toContain(
      String.raw`quote-'\\-semicolon-;--runtime-password`,
    );
  });

  it('formats the runtime role only as a PostgreSQL identifier', async () => {
    const harness = prepareDatabaseHarness();

    await harness.prepare();

    const utilitySql = harness.provisioningUtilitySql();
    expect(utilitySql).toContain('pg_catalog.format');
    expect(utilitySql).toContain('create role %I');
    expect(utilitySql).not.toContain(harness.plan.identity.runtimeRoleName);
    expect(harness.runtimeConfigurationSql()?.values).toContain(
      harness.plan.identity.runtimeRoleName,
    );
  });

  it('formats the runtime password only as a PostgreSQL literal', async () => {
    const harness = prepareDatabaseHarness();

    await harness.prepare();

    expect(harness.provisioningUtilitySql()).toContain('password %L');
    expect(harness.runtimeConfigurationSql()?.values).toContain(
      credentials().runtimePassword,
    );
  });

  it('sets the custom runtime password only for the owner transaction', async () => {
    const harness = prepareDatabaseHarness();

    await harness.prepare();

    const configuration = normalizeSql(
      harness.runtimeConfigurationSql()?.text ?? '',
    );
    expect(configuration).toMatch(
      /set_config\( 'gitblocks\.runtime_password', \?\?, true \) is not null as runtime_password_configured/iu,
    );
  });

  it('sets the custom runtime role only for the owner transaction', async () => {
    const harness = prepareDatabaseHarness();

    await harness.prepare();

    const configuration = normalizeSql(
      harness.runtimeConfigurationSql()?.text ?? '',
    );
    expect(configuration).toMatch(
      /set_config\( 'gitblocks\.runtime_role', \?\?, true \) is not null as runtime_role_configured/iu,
    );
  });

  it('keeps the runtime role attributes exact', async () => {
    const harness = prepareDatabaseHarness();

    await harness.prepare();

    expect(normalizeSql(harness.provisioningUtilitySql())).toContain(
      'create role %I login password %L nosuperuser nocreatedb nocreaterole inherit noreplication nobypassrls',
    );
  });

  it('grants only gitblocks_persistence membership to the runtime role', async () => {
    const harness = prepareDatabaseHarness();

    await harness.prepare();

    const utilitySql = normalizeSql(harness.provisioningUtilitySql());
    expect(utilitySql).toContain('grant gitblocks_persistence to %I');
    expect(utilitySql.match(/\bgrant\b/giu)).toHaveLength(1);
  });

  it('rolls back failed provisioning without returning a partial stage result', async () => {
    const harness = prepareDatabaseHarness({
      provisioningError: databaseError(
        'XX000',
        'private role-provisioning database failure',
      ),
    });

    await expect(harness.prepare()).rejects.toBeInstanceOf(PersistenceError);
    expect(harness.provisioningEvents).toContain('rollback');
    expect(harness.provisioningEvents).not.toContain('commit');
    expect(harness.schemaInspectionCount()).toBe(0);
    expect(harness.runtimeVerificationCount()).toBe(0);
  });

  it('cancels pending provisioning and never continues to schema inspection', async () => {
    const controller = new AbortController();
    const harness = prepareDatabaseHarness({
      cancellation: { controller },
    });

    await expect(harness.prepare(controller.signal)).rejects.toMatchObject({
      name: 'PersistenceError',
      code: 'persistence.deadline',
    });
    expect(harness.provisioningCancelCount()).toBe(1);
    expect(harness.schemaInspectionCount()).toBe(0);
    expect(harness.runtimeVerificationCount()).toBe(0);
  });

  it('bounds arbitrary role-provisioning database failures with a value-free error', async () => {
    const privateText =
      'private role failure password=raw-runtime-password postgresql://private';
    const harness = prepareDatabaseHarness({
      provisioningError: databaseError('XX000', privateText),
    });

    const failure = await harness.prepare().catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(PersistenceError);
    expect(String(failure)).not.toContain(privateText);
    expect(String(failure)).not.toContain('raw-runtime-password');
    expect((failure as Error).stack).toBeUndefined();
  });

  it('returns only harmless configuration metadata before fixed utility SQL', async () => {
    const harness = prepareDatabaseHarness();

    await harness.prepare();

    const configuration = normalizeSql(
      harness.runtimeConfigurationSql()?.text ?? '',
    );
    expect(configuration).toContain('is not null as runtime_role_configured');
    expect(configuration).toContain(
      'is not null as runtime_password_configured',
    );
    expect(configuration).not.toContain('as runtime_password ');
  });
});

describe('profile-materialization fresh database planning', () => {
  it('uses a fresh labeled dedicated bridge without the Docker internal flag', () => {
    const plan = createPlan();

    expect(plan.createNetwork.arguments).toEqual([
      'network',
      'create',
      ...plan.labels.flatMap((label) => ['--label', label]),
      plan.identity.networkName,
    ]);
    expect(plan.createNetwork.arguments).not.toContain('--internal');
    expect(plan.createNetwork.arguments).not.toContain('bridge');
    expect(plan.createContainer.arguments).toContain(plan.identity.networkName);
  });

  it('retains an exact loopback-only host publication', () => {
    const plan = createPlan();
    const publishIndex = plan.createContainer.arguments.indexOf('--publish');

    expect(plan.createContainer.arguments[publishIndex + 1]).toBe(
      '127.0.0.1:55432:5432',
    );
    expect(plan.createContainer.arguments).not.toContain('0.0.0.0:55432:5432');
    expect(plan.createContainer.arguments).not.toContain(':::55432:5432');
  });

  it('plans an exact bounded runtime published-port proof', () => {
    const plan = createPlan();
    const command = publishedPortCommand(plan);

    expect(command).toEqual({
      program: 'docker',
      arguments: ['port', plan.identity.containerName, '5432/tcp'],
      allowedEnvironmentNames: [],
      maximumOutputBytes: 4_096,
    });
  });

  it('rejects the former internal-network plan and every published-port command mutation', () => {
    const plan = createPlan();
    const mutations: ((value: Record<string, unknown>) => void)[] = [
      (value) => {
        (value['createNetwork'] as { arguments: string[] }).arguments.splice(
          2,
          0,
          '--internal',
        );
      },
      (value) => {
        (value['inspectPublishedPort'] as { program: string }).program =
          'unexpected';
      },
      (value) => {
        (
          value['inspectPublishedPort'] as { arguments: string[] }
        ).arguments[0] = 'inspect';
      },
      (value) => {
        (
          value['inspectPublishedPort'] as { arguments: string[] }
        ).arguments[1] = 'wrong-container';
      },
      (value) => {
        (
          value['inspectPublishedPort'] as { arguments: string[] }
        ).arguments[2] = '5433/tcp';
      },
      (value) => {
        (
          value['inspectPublishedPort'] as { maximumOutputBytes: number }
        ).maximumOutputBytes += 1;
      },
    ];

    expect(publishedPortCommand(plan)).toBeDefined();
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

  it('accepts one exact loopback runtime mapping after health', async () => {
    const plan = createPlan();
    const { operator, calls } = storageInspectionOperator(plan, {
      port: { exitCode: 0, stdout: '127.0.0.1:55432\n' },
    });

    await expect(
      operator.create(plan, credentials(), new AbortController().signal),
    ).resolves.toBeUndefined();
    expect(calls.at(-1)).toEqual([...publishedPortCommand(plan).arguments]);
  });

  it.each([
    { name: 'missing mapping', result: { exitCode: 0, stdout: '' } },
    {
      name: 'wildcard IPv4 mapping',
      result: { exitCode: 0, stdout: '0.0.0.0:55432\n' },
    },
    {
      name: 'wildcard IPv6 mapping',
      result: { exitCode: 0, stdout: ':::55432\n' },
    },
    {
      name: 'wrong host port',
      result: { exitCode: 0, stdout: '127.0.0.1:55433\n' },
    },
    {
      name: 'second mapping',
      result: {
        exitCode: 0,
        stdout: '127.0.0.1:55432\n127.0.0.1:55433\n',
      },
    },
    {
      name: 'malformed mapping',
      result: { exitCode: 0, stdout: 'localhost:55432\n' },
    },
    {
      name: 'oversized mapping',
      result: { exitCode: 0, stdout: 'x'.repeat(4_097) },
    },
    {
      name: 'failed docker port command',
      result: { exitCode: 125, stdout: '' },
    },
  ])('rejects $name after health', async ({ result }) => {
    const plan = createPlan();
    const { operator } = storageInspectionOperator(plan, { port: result });

    await expect(
      operator.create(plan, credentials(), new AbortController().signal),
    ).rejects.toThrow('profile-materialization.database-port-binding-drift');
  });

  it('does not return after health until the published-port proof passes', async () => {
    const plan = createPlan();
    const { operator, calls } = storageInspectionOperator(plan, {
      port: { exitCode: 125, stdout: '' },
    });

    await expect(
      operator.create(plan, credentials(), new AbortController().signal),
    ).rejects.toThrow('profile-materialization.database-port-binding-drift');
    expect(calls).toContainEqual([...publishedPortCommand(plan).arguments]);
  });

  it('proves the published port before beginning host zero-state SQL', async () => {
    const plan = createPlan();
    const { operator: createOperator, calls } = storageInspectionOperator(
      plan,
      { port: { exitCode: 0, stdout: '127.0.0.1:55432\n' } },
    );
    await createOperator.create(
      plan,
      credentials(),
      new AbortController().signal,
    );
    const zeroStateOperator = createProfileMaterializationDatabaseOperator({
      runProcess: () => Promise.reject(new Error('unexpected process effect')),
      sleep: () => Promise.resolve(),
      createZeroStateClient: () => ({
        inspect: () => {
          expect(calls).toContainEqual([
            ...publishedPortCommand(plan).arguments,
          ]);
          return Promise.resolve(emptyInspection());
        },
        close: () => Promise.resolve(),
      }),
    });

    await expect(
      zeroStateOperator.proveEmpty(
        plan,
        credentials(),
        new AbortController().signal,
      ),
    ).resolves.toBeUndefined();
  });

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
    expect(
      plan.createContainer.arguments[
        plan.createContainer.arguments.indexOf('--tmpfs') + 1
      ],
    ).toBe('/var/lib/postgresql:rw,noexec,nosuid,nodev,size=1073741824');
    expect(plan.createContainer.arguments).not.toContain('--volume');
    expect(plan.createContainer.arguments).not.toContain('--mount');
    expect(plan.inspectStorageConfiguration.arguments).toEqual([
      'inspect',
      '--format',
      '{{json .HostConfig.Tmpfs}}',
      identity.containerName,
    ]);
    expect(plan.inspectStorageConfiguration.maximumOutputBytes).toBe(16_384);
    expect(plan.inspectStorageMounts.arguments).toEqual([
      'inspect',
      '--format',
      '{{json .Mounts}}',
      identity.containerName,
    ]);
    expect(plan.inspectStorageMounts.maximumOutputBytes).toBe(16_384);
    expect(plan.inspectStorageRuntime.arguments).toEqual([
      'exec',
      identity.containerName,
      'cat',
      '/proc/self/mountinfo',
    ]);
    expect(plan.inspectStorageRuntime.maximumOutputBytes).toBe(1_048_576);
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
    expect(calls[0]).toEqual([...plan.inspectContainer.arguments]);
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

  it('authenticates every storage command, argument, and output bound in the plan digest', () => {
    const plan = createPlan();
    const commandNames = [
      'inspectStorageConfiguration',
      'inspectStorageMounts',
      'inspectStorageRuntime',
    ] as const;
    for (const commandName of commandNames) {
      const mutations: ((command: {
        program: string;
        arguments: string[];
        maximumOutputBytes: number;
      }) => void)[] = [
        (command) => {
          command.program = 'unexpected';
        },
        (command) => {
          command.arguments[0] = 'unexpected';
        },
        (command) => {
          const containerArgumentIndex =
            commandName === 'inspectStorageRuntime' ? 1 : 3;
          command.arguments[containerArgumentIndex] = 'wrong-container';
        },
        (command) => {
          command.maximumOutputBytes += 1;
        },
      ];
      if (commandName === 'inspectStorageRuntime') {
        mutations.push((command) => {
          command.arguments[3] = '/unexpected';
        });
      } else {
        mutations.push((command) => {
          command.arguments[2] = '{{json .Unexpected}}';
        });
      }
      for (const mutate of mutations) {
        const changed = structuredClone(plan) as unknown as Record<
          string,
          unknown
        >;
        mutate(changed[commandName] as never);
        expect(() => {
          validateProfileMaterializationDatabasePlan(changed as never);
        }).toThrow('profile-materialization.invalid-database-plan');
      }
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
    expect(() => {
      validateProfileMaterializationMigrationInventory([
        ...CURRENT_COMPATIBLE_MIGRATIONS,
      ]);
    }).not.toThrow();
    expect(() => {
      validateProfileMaterializationMigrationInventory([
        ...PROFILE_MATERIALIZATION_EXPECTED_MIGRATIONS,
        {
          version: 5,
          name: 'retrieval-serving',
          checksum: '0'.repeat(64),
        },
      ]);
    }).toThrow('profile-materialization.migration-drift');
  });

  it.each([
    {
      name: 'documented --tmpfs map at the PostgreSQL 18 volume root',
      inspection: {
        '/var/lib/postgresql': REQUIRED_TMPFS_OPTIONS,
      },
    },
    {
      name: 'documented --tmpfs map with reordered options',
      inspection: {
        '/var/lib/postgresql': 'size=1073741824,nodev,rw,nosuid,noexec',
      },
    },
  ])('accepts $name', async ({ inspection }) => {
    const plan = createPlan();
    const { operator, calls } = storageInspectionOperator(plan, {
      exitCode: 0,
      stdout: JSON.stringify(inspection),
    });
    await expect(
      operator.create(plan, credentials(), new AbortController().signal),
    ).resolves.toBeUndefined();
    expect(
      calls.filter(
        (arguments_) =>
          JSON.stringify(arguments_) ===
          JSON.stringify(plan.inspectStorageConfiguration.arguments),
      ),
    ).toHaveLength(1);
    expect(calls).toContainEqual([...plan.inspectStorageMounts.arguments]);
    expect(calls).toContainEqual([...plan.inspectStorageRuntime.arguments]);
  });

  it.each([
    {
      name: 'empty --tmpfs map',
      inspection: {},
    },
    {
      name: 'second --tmpfs destination',
      inspection: {
        '/var/lib/postgresql': REQUIRED_TMPFS_OPTIONS,
        '/unexpected': REQUIRED_TMPFS_OPTIONS,
      },
    },
    {
      name: 'pre-18 --tmpfs map target',
      inspection: {
        '/var/lib/postgresql/data': REQUIRED_TMPFS_OPTIONS,
      },
    },
    {
      name: 'PGDATA-only --tmpfs map target',
      inspection: {
        '/var/lib/postgresql/18/docker': REQUIRED_TMPFS_OPTIONS,
      },
    },
    {
      name: 'read-only --tmpfs map',
      inspection: {
        '/var/lib/postgresql': 'ro,noexec,nosuid,nodev,size=1073741824',
      },
    },
    {
      name: '--tmpfs map without noexec',
      inspection: {
        '/var/lib/postgresql': 'rw,nosuid,nodev,size=1073741824',
      },
    },
    {
      name: '--tmpfs map without nosuid',
      inspection: {
        '/var/lib/postgresql': 'rw,noexec,nodev,size=1073741824',
      },
    },
    {
      name: '--tmpfs map without nodev',
      inspection: {
        '/var/lib/postgresql': 'rw,noexec,nosuid,size=1073741824',
      },
    },
    {
      name: '--tmpfs map with the wrong size',
      inspection: {
        '/var/lib/postgresql': 'rw,noexec,nosuid,nodev,size=536870912',
      },
    },
    {
      name: '--tmpfs map with duplicate size options',
      inspection: {
        '/var/lib/postgresql':
          'rw,noexec,nosuid,nodev,size=1073741824,size=1073741824',
      },
    },
    {
      name: '--tmpfs map with a duplicate ordinary option',
      inspection: {
        '/var/lib/postgresql': 'rw,noexec,noexec,nosuid,nodev,size=1073741824',
      },
    },
    {
      name: '--tmpfs map with an empty option component',
      inspection: {
        '/var/lib/postgresql': 'rw,noexec,,nosuid,nodev,size=1073741824',
      },
    },
    {
      name: '--tmpfs map with exec',
      inspection: {
        '/var/lib/postgresql': 'rw,noexec,exec,nosuid,nodev,size=1073741824',
      },
    },
    {
      name: '--tmpfs map with suid',
      inspection: {
        '/var/lib/postgresql': 'rw,noexec,nosuid,suid,nodev,size=1073741824',
      },
    },
    {
      name: '--tmpfs map with dev',
      inspection: {
        '/var/lib/postgresql': 'rw,noexec,nosuid,nodev,dev,size=1073741824',
      },
    },
    {
      name: '--tmpfs map with a non-string value',
      inspection: {
        '/var/lib/postgresql': true,
      },
    },
    {
      name: '--tmpfs map with a prototype-pollution key',
      inspection: JSON.parse(
        `{"/var/lib/postgresql":"${REQUIRED_TMPFS_OPTIONS}","__proto__":"unexpected"}`,
      ) as unknown,
    },
    {
      name: 'anonymous volume array',
      inspection: [
        {
          Type: 'volume',
          Source: '/var/lib/docker/volumes/opaque/_data',
          Destination: '/var/lib/postgresql',
          RW: true,
        },
      ],
    },
    {
      name: 'bind mount array',
      inspection: [
        {
          Type: 'bind',
          Source: '/tmp/postgresql',
          Destination: '/var/lib/postgresql',
          RW: true,
        },
      ],
    },
    {
      name: 'pre-18 tmpfs array target',
      inspection: [
        {
          Type: 'tmpfs',
          Source: '',
          Destination: '/var/lib/postgresql/data',
          RW: true,
        },
      ],
    },
    {
      name: 'PGDATA-only tmpfs array target',
      inspection: [
        {
          Type: 'tmpfs',
          Source: '',
          Destination: '/var/lib/postgresql/18/docker',
          RW: true,
        },
      ],
    },
    {
      name: 'multiple mount-array entries',
      inspection: [
        {
          Type: 'tmpfs',
          Source: '',
          Destination: '/var/lib/postgresql',
          RW: true,
        },
        {
          Type: 'tmpfs',
          Source: '',
          Destination: '/unexpected',
          RW: true,
        },
      ],
    },
  ])('rejects $name storage inspection', async ({ inspection }) => {
    const plan = createPlan();
    const { operator } = storageInspectionOperator(plan, {
      exitCode: 0,
      stdout: JSON.stringify(inspection),
    });
    await expect(
      operator.create(plan, credentials(), new AbortController().signal),
    ).rejects.toThrow('profile-materialization.database-storage-drift');
  });

  it.each([
    { exitCode: 0, stdout: '{not-json' },
    { exitCode: 0, stdout: JSON.stringify('x'.repeat(16_385)) },
    { exitCode: 125, stdout: '' },
  ])('fails closed for an invalid storage inspect result', async (result) => {
    const plan = createPlan();
    const { operator } = storageInspectionOperator(plan, result);
    await expect(
      operator.create(plan, credentials(), new AbortController().signal),
    ).rejects.toThrow('profile-materialization.database-storage-drift');
  });

  it('accepts the observed empty .Mounts representation with secure runtime mountinfo', async () => {
    const plan = createPlan();
    const { operator, calls } = storageInspectionOperator(plan, {
      configuration: {
        exitCode: 0,
        stdout: JSON.stringify({
          '/var/lib/postgresql': REQUIRED_TMPFS_OPTIONS,
        }),
      },
      mounts: { exitCode: 0, stdout: '[]' },
      runtime: { exitCode: 0, stdout: SECURE_TMPFS_MOUNTINFO },
    });
    await expect(
      operator.create(plan, credentials(), new AbortController().signal),
    ).resolves.toBeUndefined();
    expect(calls).toContainEqual([
      ...plan.inspectStorageConfiguration.arguments,
    ]);
    expect(calls).toContainEqual([...plan.inspectStorageMounts.arguments]);
    expect(calls).toContainEqual([...plan.inspectStorageRuntime.arguments]);
  });

  it('accepts one compatible explicit root tmpfs mount', async () => {
    const plan = createPlan();
    const { operator } = storageInspectionOperator(plan, {
      mounts: {
        exitCode: 0,
        stdout: JSON.stringify([
          {
            Type: 'tmpfs',
            Source: '',
            Destination: '/var/lib/postgresql',
            Mode: 'rw,noexec,nosuid,nodev,size=1073741824',
            RW: true,
            Propagation: '',
          },
        ]),
      },
    });
    await expect(
      operator.create(plan, credentials(), new AbortController().signal),
    ).resolves.toBeUndefined();
  });

  it.each([
    { name: 'null map', value: null },
    {
      name: 'missing rw',
      value: {
        '/var/lib/postgresql': 'noexec,nosuid,nodev,size=1073741824',
      },
    },
    {
      name: 'extra option',
      value: {
        '/var/lib/postgresql':
          'rw,noexec,nosuid,nodev,size=1073741824,relatime',
      },
    },
    {
      name: 'contradictory option',
      value: {
        '/var/lib/postgresql': 'rw,ro,noexec,nosuid,nodev,size=1073741824',
      },
    },
  ])('rejects HostConfig $name before health polling', async ({ value }) => {
    await expectStorageDrift({
      configuration: { exitCode: 0, stdout: JSON.stringify(value) },
    });
  });

  it.each([
    {
      name: 'volume at PostgreSQL root',
      value: [mount('volume', '/var/lib/postgresql')],
    },
    {
      name: 'volume anywhere',
      value: [mount('volume', '/unrelated')],
    },
    {
      name: 'bind at PostgreSQL root',
      value: [mount('bind', '/var/lib/postgresql')],
    },
    {
      name: 'bind anywhere',
      value: [mount('bind', '/unrelated')],
    },
    {
      name: 'PGDATA conflict',
      value: [mount('tmpfs', '/var/lib/postgresql/18/docker')],
    },
    {
      name: 'pre-18 root conflict',
      value: [mount('tmpfs', '/var/lib/postgresql/data')],
    },
    {
      name: 'multiple storage conflicts',
      value: [
        mount('tmpfs', '/var/lib/postgresql'),
        mount('tmpfs', '/var/lib/postgresql/18/docker'),
      ],
    },
  ])('rejects .Mounts $name before health polling', async ({ value }) => {
    await expectStorageDrift({
      mounts: { exitCode: 0, stdout: JSON.stringify(value) },
    });
  });

  it.each([
    { name: 'malformed JSON', result: { exitCode: 0, stdout: '{not-json' } },
    {
      name: 'oversized JSON',
      result: { exitCode: 0, stdout: JSON.stringify('x'.repeat(16_385)) },
    },
    { name: 'failed inspection', result: { exitCode: 125, stdout: '' } },
  ])('rejects .Mounts $name before health polling', async ({ result }) => {
    await expectStorageDrift({ mounts: result });
  });

  it.each([
    { name: 'missing root', value: secureMountinfo('/unrelated') },
    {
      name: 'duplicate root',
      value: `${SECURE_TMPFS_MOUNTINFO}\n${SECURE_TMPFS_MOUNTINFO}`,
    },
    {
      name: 'non-tmpfs filesystem',
      value:
        '41 30 0:39 / /var/lib/postgresql rw,nosuid,nodev,noexec - ext4 /dev/root rw,size=1048576k',
    },
    { name: 'read-only root', value: secureMountinfo(undefined, 'ro') },
    {
      name: 'exec permitted',
      value: secureMountinfo(undefined, 'rw,nosuid,nodev'),
    },
    {
      name: 'suid permitted',
      value: secureMountinfo(undefined, 'rw,nodev,noexec'),
    },
    {
      name: 'device permitted',
      value: secureMountinfo(undefined, 'rw,nosuid,noexec'),
    },
    {
      name: 'size absent',
      value:
        '41 30 0:39 / /var/lib/postgresql rw,nosuid,nodev,noexec - tmpfs tmpfs rw,inode64',
    },
    { name: 'malformed mountinfo', value: 'not mountinfo' },
    { name: 'oversized mountinfo', value: 'x'.repeat(1_048_577) },
  ])(
    'rejects runtime mountinfo with $name before health polling',
    async ({ value }) => {
      await expectStorageDrift({
        runtime: { exitCode: 0, stdout: value },
      });
    },
  );

  it('rejects failed runtime docker exec before health polling', async () => {
    await expectStorageDrift({
      runtime: { exitCode: 125, stdout: '' },
    });
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

  it('orders exact container removal and absence before network removal', async () => {
    const plan = createPlan();
    const calls: string[][] = [];
    let containerPresent = true;
    let networkPresent = true;
    const operator = createProfileMaterializationDatabaseOperator({
      runProcess: (processPlan) => {
        calls.push([...processPlan.arguments]);
        if (processPlan.arguments[0] === 'inspect') {
          return Promise.resolve({
            exitCode: containerPresent ? 0 : 1,
            stdout: '',
          });
        }
        if (processPlan.arguments[0] === 'container') {
          return Promise.resolve({
            exitCode: containerPresent ? 0 : 1,
            stdout: '',
          });
        }
        if (processPlan.arguments[0] === 'rm') {
          containerPresent = false;
          return Promise.resolve({ exitCode: 0, stdout: '' });
        }
        if (
          processPlan.arguments[0] === 'network' &&
          processPlan.arguments[1] === 'inspect'
        ) {
          return Promise.resolve({
            exitCode: networkPresent ? 0 : 1,
            stdout: '',
          });
        }
        if (
          processPlan.arguments[0] === 'network' &&
          processPlan.arguments[1] === 'rm'
        ) {
          expect(containerPresent).toBe(false);
          networkPresent = false;
          return Promise.resolve({ exitCode: 0, stdout: '' });
        }
        throw new Error('unexpected fake process');
      },
      sleep: () => Promise.resolve(),
    });
    await expect(
      operator.dispose(plan, new AbortController().signal),
    ).resolves.toBeUndefined();
    expect(calls).toEqual([
      [...plan.inspectContainer.arguments],
      [...plan.removeContainer.arguments],
      [...plan.inspectContainer.arguments],
      [...plan.inspectNetwork.arguments],
      [...plan.removeNetwork.arguments],
      [...plan.inspectNetwork.arguments],
    ]);
  });

  it('stops before network cleanup when container removal fails', async () => {
    const plan = createPlan();
    const calls: string[][] = [];
    const operator = createProfileMaterializationDatabaseOperator({
      runProcess: (processPlan) => {
        calls.push([...processPlan.arguments]);
        if (processPlan.arguments[0] === 'inspect') {
          return Promise.resolve({ exitCode: 0, stdout: '' });
        }
        return Promise.resolve({ exitCode: 1, stdout: '' });
      },
      sleep: () => Promise.resolve(),
    });
    await expect(
      operator.dispose(plan, new AbortController().signal),
    ).rejects.toThrow('profile-materialization.process-failed');
    expect(calls).toEqual([
      [...plan.inspectContainer.arguments],
      [...plan.removeContainer.arguments],
    ]);
  });

  it('handles absent container with present network and both resources absent', async () => {
    const plan = createPlan();
    for (const networkPresent of [true, false]) {
      const calls: string[][] = [];
      const operator = createProfileMaterializationDatabaseOperator({
        runProcess: (processPlan) => {
          calls.push([...processPlan.arguments]);
          if (processPlan.arguments[0] === 'inspect') {
            return Promise.resolve({ exitCode: 1, stdout: '' });
          }
          if (
            processPlan.arguments[0] === 'network' &&
            processPlan.arguments[1] === 'inspect'
          ) {
            const priorRemoval = calls.some(
              (entry) => entry[0] === 'network' && entry[1] === 'rm',
            );
            return Promise.resolve({
              exitCode: networkPresent && !priorRemoval ? 0 : 1,
              stdout: '',
            });
          }
          return Promise.resolve({ exitCode: 0, stdout: '' });
        },
        sleep: () => Promise.resolve(),
      });
      await expect(
        operator.dispose(plan, new AbortController().signal),
      ).resolves.toBeUndefined();
      expect(calls.some((entry) => entry[0] === 'rm')).toBe(false);
      expect(
        calls.some((entry) => entry[0] === 'network' && entry[1] === 'rm'),
      ).toBe(networkPresent);
    }
  });

  it('rejects network removal failure and a failed final absence proof', async () => {
    const plan = createPlan();
    for (const finalInspectionExitCode of [0, 125]) {
      let networkInspections = 0;
      const operator = createProfileMaterializationDatabaseOperator({
        runProcess: (processPlan) => {
          if (processPlan.arguments[0] === 'inspect') {
            return Promise.resolve({ exitCode: 1, stdout: '' });
          }
          if (
            processPlan.arguments[0] === 'network' &&
            processPlan.arguments[1] === 'inspect'
          ) {
            networkInspections += 1;
            return Promise.resolve({
              exitCode: networkInspections === 1 ? 0 : finalInspectionExitCode,
              stdout: '',
            });
          }
          return Promise.resolve({ exitCode: 0, stdout: '' });
        },
        sleep: () => Promise.resolve(),
      });
      await expect(
        operator.dispose(plan, new AbortController().signal),
      ).rejects.toThrow();
    }

    const removalFailure = createProfileMaterializationDatabaseOperator({
      runProcess: (processPlan) => {
        if (processPlan.arguments[0] === 'inspect') {
          return Promise.resolve({ exitCode: 1, stdout: '' });
        }
        if (
          processPlan.arguments[0] === 'network' &&
          processPlan.arguments[1] === 'inspect'
        ) {
          return Promise.resolve({ exitCode: 0, stdout: '' });
        }
        return Promise.resolve({ exitCode: 1, stdout: '' });
      },
      sleep: () => Promise.resolve(),
    });
    await expect(
      removalFailure.dispose(plan, new AbortController().signal),
    ).rejects.toThrow('profile-materialization.process-failed');
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

interface RecordedSqlCall {
  readonly kind: 'tag' | 'unsafe';
  readonly text: string;
  readonly values: readonly unknown[];
}

interface FakePendingQuery<Rows> extends Promise<Rows> {
  cancel(): void;
  execute(): FakePendingQuery<Rows>;
  simple(): FakePendingQuery<Rows>;
}

function prepareDatabaseHarness(
  options: {
    readonly runtimePassword?: string;
    readonly provisioningError?: Error;
    readonly cancellation?: { readonly controller: AbortController };
  } = {},
) {
  const plan = createPlan();
  const runtimePassword =
    options.runtimePassword ?? credentials().runtimePassword;
  const preparationCredentials = credentials({ runtimePassword });
  const provisioningCalls: RecordedSqlCall[] = [];
  const provisioningEvents: string[] = [];
  let schemaInspections = 0;
  let runtimeVerifications = 0;
  let provisioningCancellations = 0;

  const migrationSql = fakeSql({
    taggedRows: (text) => {
      if (text.includes("current_setting('server_version')")) {
        return [{ server_version: '18.4', server_version_num: 180_004 }];
      }
      if (text.includes('from gitblocks.schema_migrations')) return [];
      return [];
    },
  });
  const provisioningSql = fakeSql({
    calls: provisioningCalls,
    events: provisioningEvents,
    taggedRows: (text) => {
      if (text.includes('runtime_role_safe')) {
        schemaInspections += 1;
        return [
          {
            product_table_count: 25,
            policy_count: 0,
            function_count: 7,
            trigger_count: 48,
            index_count: 15,
            runtime_role_safe: true,
            runtime_membership: true,
          },
        ];
      }
      return [];
    },
    unsafeQuery: () => {
      if (options.provisioningError !== undefined) {
        return rejectedPendingQuery(options.provisioningError);
      }
      if (options.cancellation !== undefined) {
        return cancellationPendingQuery(options.cancellation.controller, () => {
          provisioningCancellations += 1;
        });
      }
      return resolvedPendingQuery([]);
    },
  });
  const runtimeSql = fakeSql({
    onBegin: () => {
      runtimeVerifications += 1;
    },
    taggedRows: (text) => {
      if (text.includes("current_setting('server_version')")) {
        return [{ server_version: '18.4', server_version_num: 180_004 }];
      }
      if (text.includes('from gitblocks.schema_migrations')) {
        return CURRENT_COMPATIBLE_MIGRATIONS.map((migration) => ({
          ...migration,
        }));
      }
      return [];
    },
  });
  const sqlInstances = [migrationSql, provisioningSql, runtimeSql];
  let sqlInstanceIndex = 0;
  postgresFactory.mockReset();
  postgresFactory.mockImplementation(() => {
    const sql = sqlInstances[sqlInstanceIndex];
    sqlInstanceIndex += 1;
    if (sql === undefined) throw new Error('unexpected PostgreSQL client');
    return sql;
  });
  const operator = createProfileMaterializationDatabaseOperator({
    runProcess: () => Promise.reject(new Error('unexpected process effect')),
    sleep: () => Promise.resolve(),
  });

  return {
    plan,
    provisioningEvents,
    prepare: (signal = new AbortController().signal) =>
      operator.prepare(plan, preparationCredentials, signal),
    provisioningUnsafeSql: () =>
      provisioningCalls
        .filter((call) => call.kind === 'unsafe')
        .map((call) => call.text),
    provisioningUtilitySql: () =>
      provisioningCalls.find((call) => call.kind === 'unsafe')?.text ?? '',
    runtimeConfigurationSql: () =>
      provisioningCalls.find(
        (call) =>
          call.kind === 'tag' && call.text.includes('gitblocks.runtime_role'),
      ),
    schemaInspectionCount: () => schemaInspections,
    runtimeVerificationCount: () => runtimeVerifications,
    provisioningCancelCount: () => provisioningCancellations,
  };
}

function fakeSql(options: {
  readonly calls?: RecordedSqlCall[];
  readonly events?: string[];
  readonly onBegin?: () => void;
  readonly taggedRows: (text: string) => readonly Record<string, unknown>[];
  readonly unsafeQuery?: (
    text: string,
    values: readonly unknown[],
  ) => FakePendingQuery<readonly Record<string, unknown>[]>;
}) {
  const transaction = Object.assign(
    (strings: TemplateStringsArray, ...values: readonly unknown[]) => {
      const text = strings.join('??');
      options.calls?.push({ kind: 'tag', text, values });
      return resolvedPendingQuery(options.taggedRows(text));
    },
    {
      unsafe: (text: string, values: readonly unknown[] = []) => {
        options.calls?.push({ kind: 'unsafe', text, values });
        return options.unsafeQuery?.(text, values) ?? resolvedPendingQuery([]);
      },
    },
  );
  return Object.assign(transaction, {
    begin: async (...arguments_: readonly unknown[]) => {
      options.onBegin?.();
      const callback = arguments_.at(-1);
      if (typeof callback !== 'function') {
        throw new Error('unexpected transaction callback');
      }
      options.events?.push('begin');
      try {
        const result = await (
          callback as (value: typeof transaction) => Promise<unknown>
        )(transaction);
        options.events?.push('commit');
        return result;
      } catch (error) {
        options.events?.push('rollback');
        throw error;
      }
    },
    end: () => Promise.resolve(),
  });
}

function resolvedPendingQuery<Rows>(rows: Rows): FakePendingQuery<Rows> {
  return decoratePendingQuery(Promise.resolve(rows), () => undefined);
}

function rejectedPendingQuery<Rows>(error: Error): FakePendingQuery<Rows> {
  return decoratePendingQuery(Promise.reject(error), () => undefined);
}

function cancellationPendingQuery(
  controller: AbortController,
  onCancel: () => void,
): FakePendingQuery<readonly Record<string, unknown>[]> {
  let resolveQuery: (rows: readonly Record<string, unknown>[]) => void = () =>
    undefined;
  let rejectQuery: (error: Error) => void = () => undefined;
  const promise = new Promise<readonly Record<string, unknown>[]>(
    (resolve, reject) => {
      resolveQuery = resolve;
      rejectQuery = reject;
    },
  );
  queueMicrotask(() => {
    controller.abort();
    queueMicrotask(() => {
      resolveQuery([]);
    });
  });
  return decoratePendingQuery(promise, () => {
    onCancel();
    rejectQuery(databaseError('57014'));
  });
}

function decoratePendingQuery<Rows>(
  promise: Promise<Rows>,
  cancel: () => void,
): FakePendingQuery<Rows> {
  const pending = promise as FakePendingQuery<Rows>;
  pending.cancel = cancel;
  pending.execute = () => pending;
  pending.simple = () => pending;
  return pending;
}

function normalizeSql(text: string): string {
  return text.replace(/\s+/gu, ' ').trim();
}

function storageInspectionOperator(
  plan: ReturnType<typeof createPlan>,
  storageResults:
    | { readonly exitCode: number; readonly stdout: string }
    | Partial<{
        configuration: { readonly exitCode: number; readonly stdout: string };
        mounts: { readonly exitCode: number; readonly stdout: string };
        runtime: { readonly exitCode: number; readonly stdout: string };
        port: { readonly exitCode: number; readonly stdout: string };
      }>,
) {
  const calls: string[][] = [];
  let initialContainerInspection = true;
  const defaults = {
    configuration: {
      exitCode: 0,
      stdout: JSON.stringify({
        '/var/lib/postgresql': REQUIRED_TMPFS_OPTIONS,
      }),
    },
    mounts: { exitCode: 0, stdout: '[]' },
    runtime: { exitCode: 0, stdout: SECURE_TMPFS_MOUNTINFO },
    port: { exitCode: 0, stdout: '127.0.0.1:55432\n' },
  };
  const resolvedResults =
    'exitCode' in storageResults
      ? { ...defaults, configuration: storageResults }
      : { ...defaults, ...storageResults };
  const operator = createProfileMaterializationDatabaseOperator({
    runProcess: (command) => {
      calls.push([...command.arguments]);
      if (command === plan.inspectStorageConfiguration) {
        return Promise.resolve(resolvedResults.configuration);
      }
      if (command === plan.inspectStorageMounts) {
        return Promise.resolve(resolvedResults.mounts);
      }
      if (command === plan.inspectStorageRuntime) {
        return Promise.resolve(resolvedResults.runtime);
      }
      if (command === publishedPortCommand(plan)) {
        return Promise.resolve(resolvedResults.port);
      }
      if (command === plan.inspectContainer) {
        if (initialContainerInspection) {
          initialContainerInspection = false;
          return Promise.resolve({ exitCode: 1, stdout: '' });
        }
        return Promise.resolve({ exitCode: 0, stdout: '"healthy"' });
      }
      if (command === plan.inspectNetwork) {
        return Promise.resolve({ exitCode: 1, stdout: '' });
      }
      return Promise.resolve({ exitCode: 0, stdout: '' });
    },
    sleep: () => Promise.resolve(),
  });
  return { operator, calls };
}

function publishedPortCommand(plan: ReturnType<typeof createPlan>) {
  return (
    plan as unknown as {
      readonly inspectPublishedPort: {
        readonly program: 'docker';
        readonly arguments: readonly string[];
        readonly allowedEnvironmentNames: readonly string[];
        readonly maximumOutputBytes: number;
      };
    }
  ).inspectPublishedPort;
}

async function expectStorageDrift(
  storageResults: Partial<{
    configuration: { readonly exitCode: number; readonly stdout: string };
    mounts: { readonly exitCode: number; readonly stdout: string };
    runtime: { readonly exitCode: number; readonly stdout: string };
  }>,
) {
  const plan = createPlan();
  const { operator, calls } = storageInspectionOperator(plan, storageResults);
  await expect(
    operator.create(plan, credentials(), new AbortController().signal),
  ).rejects.toThrow('profile-materialization.database-storage-drift');
  expect(
    calls.filter(
      (arguments_) =>
        JSON.stringify(arguments_) ===
        JSON.stringify(plan.inspectContainer.arguments),
    ),
  ).toHaveLength(1);
}

function mount(type: string, destination: string) {
  return {
    Type: type,
    Source: type === 'tmpfs' ? '' : '/opaque',
    Destination: destination,
    RW: true,
  };
}

function secureMountinfo(
  destination = '/var/lib/postgresql',
  options = 'rw,nosuid,nodev,noexec',
) {
  return `41 30 0:39 / ${destination} ${options} - tmpfs tmpfs rw,size=1048576k,inode64`;
}

interface ZeroStateInspectionFixture {
  readonly migrationTableCount: number;
  readonly productTableCount: number;
}

interface ZeroStateAttemptFixture {
  readonly inspection?: ZeroStateInspectionFixture;
  readonly error?: Error;
  readonly closeError?: Error;
}

function emptyInspection(): ZeroStateInspectionFixture {
  return { migrationTableCount: 0, productTableCount: 0 };
}

function databaseError(
  code: string,
  message = 'private database error text',
): Error {
  const error = new Error(message);
  Object.defineProperty(error, 'code', {
    configurable: false,
    enumerable: true,
    value: code,
    writable: false,
  });
  return error;
}

function zeroStateHarness(
  outcomes: readonly ZeroStateAttemptFixture[],
  options: { readonly onSleep?: () => void } = {},
) {
  const plan = createPlan();
  let attempts = 0;
  const sleepDurations: number[] = [];
  const createZeroStateClient = () => {
    const outcome = outcomes[attempts];
    attempts += 1;
    if (outcome === undefined) {
      throw new Error('unexpected zero-state attempt');
    }
    return {
      inspect: (signal: AbortSignal) => {
        if (signal.aborted) {
          return Promise.reject(new PersistenceError('persistence.deadline'));
        }
        if (outcome.error !== undefined) {
          return Promise.reject(outcome.error);
        }
        return Promise.resolve(outcome.inspection ?? emptyInspection());
      },
      close: () =>
        outcome.closeError === undefined
          ? Promise.resolve()
          : Promise.reject(outcome.closeError),
    };
  };

  postgresFactory.mockReset();
  postgresFactory.mockImplementation(() => {
    const client = createZeroStateClient();
    return Object.assign(
      () => ({
        execute: () =>
          client.inspect(new AbortController().signal).then((inspection) => [
            {
              migration_table_count: inspection.migrationTableCount,
              product_table_count: inspection.productTableCount,
            },
          ]),
      }),
      { end: () => client.close() },
    );
  });

  const adapters = {
    runProcess: () =>
      Promise.reject(new Error('unexpected process effect during zero state')),
    sleep: (milliseconds: number, signal: AbortSignal) => {
      sleepDurations.push(milliseconds);
      options.onSleep?.();
      return signal.aborted
        ? Promise.reject(new PersistenceError('persistence.deadline'))
        : Promise.resolve();
    },
    createZeroStateClient: () => createZeroStateClient(),
  };
  return {
    plan,
    operator: createProfileMaterializationDatabaseOperator(adapters),
    attemptCount: () => attempts,
    sleepDurations,
  };
}
