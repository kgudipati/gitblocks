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
const REQUIRED_TMPFS_OPTIONS = 'rw,noexec,nosuid,nodev,size=1073741824';
const SECURE_TMPFS_MOUNTINFO =
  '41 30 0:39 / /var/lib/postgresql rw,nosuid,nodev,noexec,relatime - tmpfs tmpfs rw,size=1048576k,inode64';

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

function storageInspectionOperator(
  plan: ReturnType<typeof createPlan>,
  storageResults:
    | { readonly exitCode: number; readonly stdout: string }
    | Partial<{
        configuration: { readonly exitCode: number; readonly stdout: string };
        mounts: { readonly exitCode: number; readonly stdout: string };
        runtime: { readonly exitCode: number; readonly stdout: string };
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
