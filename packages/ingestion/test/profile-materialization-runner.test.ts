import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import {
  PersistenceError,
  PROFILE_MATERIALIZATION_EXPECTED_DATABASE_SCHEMA_DIGEST,
  PROFILE_MATERIALIZATION_MIGRATION_INVENTORY_DIGEST,
  PROFILE_MATERIALIZATION_POSTGRES_IMAGE,
} from '@gitblocks/persistence';
import {
  PROFILE_MATERIALIZATION_ACCEPTED_BINDINGS,
  PROFILE_MATERIALIZATION_CREDENTIAL_NAMES,
  PROFILE_MATERIALIZATION_LIVE_ACKNOWLEDGEMENT,
  IngestionError,
  buildProfileMaterializationArtifacts,
  executeProfileMaterialization,
  parseProfileMaterializationArguments,
  preflightProfileMaterialization,
  type ProfileMaterializationLiveEffects,
} from '../src/index.ts';
import {
  buildFakePersistenceProof,
  buildFakeSourceAuthority,
} from './profile-materialization-fixtures.ts';

const ROOT = new URL('../../../', import.meta.url);
const RUN_ID = 'm7-abcdefghijklmnopqrstuvwxyz';

describe('profile-materialization atomic runner', () => {
  it('binds the receipt database digests to the exact persistence plan', () => {
    expect(
      PROFILE_MATERIALIZATION_ACCEPTED_BINDINGS.migrationInventoryDigest,
    ).toBe(PROFILE_MATERIALIZATION_MIGRATION_INVENTORY_DIGEST);
    expect(PROFILE_MATERIALIZATION_ACCEPTED_BINDINGS.databaseSchemaDigest).toBe(
      PROFILE_MATERIALIZATION_EXPECTED_DATABASE_SCHEMA_DIGEST,
    );
  });

  it('performs preflight without credential, process, database, network, or write effects', async () => {
    const fixture = await buildFakeSourceAuthority();
    const reads: string[] = [];
    const result = await preflightProfileMaterialization(argv(fixture), {
      validateFixedPaths: () => Promise.resolve(),
      readFixedFile: async (path) => {
        reads.push(path);
        return readFile(new URL(path, ROOT), 'utf8');
      },
    });
    expect(reads.sort()).toEqual([
      'catalog/capability-taxonomy/1.0.0/manifest.json',
      'catalog/public-v1/manifest.json',
      'catalog/public-v1/profile-materialization-provider-policy.json',
    ]);
    expect(result.databasePlan.identity.databaseName).toBe(
      'gitblocks_p8_m7_abcdefghijklmnopqrstuvwxyz_test',
    );
  });

  it('reads credentials only after zero-effect validation and publishes after disposal proof', async () => {
    const fixture = await buildFakeSourceAuthority();
    const events: string[] = [];
    const effects = fakeEffects(fixture, events);
    const evidence = await executeProfileMaterialization(
      argv(fixture),
      effects,
      new AbortController().signal,
    );
    expect(evidence.receipt.sameEvidenceReproduction).toBe('passed');
    expect(events.indexOf('credential')).toBeGreaterThan(
      events.lastIndexOf('read-file'),
    );
    expect(events.indexOf('publish')).toBeGreaterThan(
      events.indexOf('prove-disposed'),
    );
    expect(events).toEqual([
      'validate-paths',
      'read-file',
      'read-file',
      'read-file',
      'credential',
      'credential',
      'credential',
      'credential',
      'credential',
      'create',
      'empty',
      'prepare',
      'collect-first',
      'source-first',
      'persistence-first',
      'collect-second',
      'source-second',
      'persistence-second',
      'quarantine',
      'cancel',
      'dispose',
      'prove-disposed',
      'publish',
    ]);
  }, 20_000);

  it('never reads a credential when zero-effect validation fails', async () => {
    const fixture = await buildFakeSourceAuthority();
    const events: string[] = [];
    const effects = fakeEffects(fixture, events);
    const invalid = argv(fixture);
    invalid[invalid.indexOf('--postgres-image') + 1] = 'postgres:latest';
    await expect(
      executeProfileMaterialization(
        invalid,
        effects,
        new AbortController().signal,
      ),
    ).rejects.toThrow();
    expect(events).not.toContain('credential');
    expect(events).not.toContain('create');
  });

  it('rejects unknown, duplicate, positional, Phase 7, fallback, and aliased arguments', async () => {
    const fixture = await buildFakeSourceAuthority();
    const valid = argv(fixture);
    const cases = [
      replaceArgumentName(valid, '--concurrency', '--unexpected'),
      replaceArgumentName(valid, '--concurrency', '--run-id'),
      ['positional', ...valid.slice(1)],
      replaceArgument(valid, '--run-id', 'phase-7-abcdefghijklmnopqrstuv'),
      replaceArgument(valid, '--owner-url-env', 'DATABASE_URL'),
      replaceArgument(valid, '--database-host', 'localhost'),
      replaceArgument(valid, '--run-directory', 'verification/retrieval-v1'),
    ];
    for (const invalid of cases) {
      expect(() => parseProfileMaterializationArguments(invalid)).toThrow();
    }
  });

  it('does not read credentials when the caller is already cancelled', async () => {
    const fixture = await buildFakeSourceAuthority();
    const events: string[] = [];
    const cancellation = new AbortController();
    cancellation.abort();
    await expect(
      executeProfileMaterialization(
        argv(fixture),
        fakeEffects(fixture, events),
        cancellation.signal,
      ),
    ).rejects.toThrow();
    expect(events).not.toContain('credential');
    expect(events).not.toContain('create');
  });

  it('disposes and blocks publication after a provider or cleanup failure', async () => {
    const fixture = await buildFakeSourceAuthority();
    const events: string[] = [];
    const effects = fakeEffects(fixture, events);
    effects.collectSourceAuthority = () => {
      events.push('provider-failure');
      return Promise.reject(new Error('controlled fake failure'));
    };
    await expect(
      executeProfileMaterialization(
        argv(fixture),
        effects,
        new AbortController().signal,
      ),
    ).rejects.toThrow();
    expect(events).toContain('dispose');
    expect(events).toContain('prove-disposed');
    expect(events).not.toContain('publish');

    const cleanupEvents: string[] = [];
    const cleanupFailure = fakeEffects(fixture, cleanupEvents);
    cleanupFailure.disposeDatabase = () => {
      cleanupEvents.push('cleanup-failure');
      return Promise.reject(new Error('controlled fake cleanup failure'));
    };
    await expect(
      executeProfileMaterialization(
        argv(fixture),
        cleanupFailure,
        new AbortController().signal,
      ),
    ).rejects.toThrow();
    expect(cleanupEvents).not.toContain('publish');
  });

  it('reports exact bounded stages and safe codes for controlled execute failures', async () => {
    const fixture = await buildFakeSourceAuthority();
    const cases: readonly {
      readonly stage: string;
      readonly code: string;
      readonly configure: (effects: ProfileMaterializationLiveEffects) => void;
    }[] = [
      {
        stage: 'lazy-credential-read',
        code: 'ingestion.invalid-input',
        configure: (effects) => {
          effects.readCredential = () => {
            throw new IngestionError('ingestion.invalid-input');
          };
        },
      },
      {
        stage: 'fresh-database-create',
        code: 'ingestion.internal-invariant',
        configure: (effects) => {
          effects.createDatabase = () =>
            Promise.reject(new Error('raw database create failure'));
        },
      },
      {
        stage: 'zero-state-proof',
        code: 'ingestion.internal-invariant',
        configure: (effects) => {
          effects.proveEmptyDatabase = () =>
            Promise.reject(new Error('raw empty database failure'));
        },
      },
      {
        stage: 'zero-state-proof',
        code: 'ingestion.persistence',
        configure: (effects) => {
          effects.proveEmptyDatabase = () =>
            Promise.reject(new PersistenceError('persistence.connection'));
        },
      },
      {
        stage: 'migrate-schema-runtime-role-catalog-seed',
        code: 'ingestion.internal-invariant',
        configure: (effects) => {
          effects.prepareDatabase = () =>
            Promise.reject(new Error('raw schema failure'));
        },
      },
      {
        stage: 'first-collection',
        code: 'ingestion.provider-authentication',
        configure: (effects) => {
          effects.collectSourceAuthority = () =>
            Promise.reject(
              new IngestionError('ingestion.provider-authentication'),
            );
        },
      },
      {
        stage: 'first-source-authority-publication',
        code: 'ingestion.internal-invariant',
        configure: (effects) => {
          effects.publishSourceAuthority = () =>
            Promise.reject(new Error('raw source publication failure'));
        },
      },
      {
        stage: 'database-container-network-disposal',
        code: 'ingestion.internal-invariant',
        configure: (effects) => {
          effects.disposeDatabase = () =>
            Promise.reject(new Error('raw cleanup failure'));
        },
      },
      {
        stage: 'post-disposal-proof',
        code: 'ingestion.internal-invariant',
        configure: (effects) => {
          effects.proveDisposed = () =>
            Promise.reject(new Error('raw post-disposal failure'));
        },
      },
    ];
    for (const testCase of cases) {
      const effects = fakeEffects(fixture, []);
      testCase.configure(effects);
      await expect(
        executeProfileMaterialization(
          argv(fixture),
          effects,
          new AbortController().signal,
        ),
      ).rejects.toMatchObject({
        stage: testCase.stage,
        code: testCase.code,
      });
    }
  }, 20_000);

  it('cleans exact resources after the runtime storage proof fails', async () => {
    const fixture = await buildFakeSourceAuthority();
    const events: string[] = [];
    const effects = fakeEffects(fixture, events);
    effects.createDatabase = () => {
      events.push('storage-proof-failure');
      return Promise.reject(
        new Error('profile-materialization.database-storage-drift'),
      );
    };
    await expect(
      executeProfileMaterialization(
        argv(fixture),
        effects,
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({
      stage: 'fresh-database-create',
      code: 'ingestion.internal-invariant',
    });
    expect(events).toContain('dispose');
    expect(events).toContain('prove-disposed');
    expect(events).not.toContain('publish');
  });

  it('requires a valid persistence proof from both collections before publication', async () => {
    const fixture = await buildFakeSourceAuthority();
    for (const missingCollection of ['first', 'second'] as const) {
      const events: string[] = [];
      const effects = fakeEffects(fixture, events);
      const collect = effects.collectSourceAuthority.bind(effects);
      effects.collectSourceAuthority = async (...arguments_) => {
        const result = await collect(...arguments_);
        return arguments_[0] === missingCollection
          ? ({ sourceAuthority: result.sourceAuthority } as never)
          : result;
      };
      await expect(
        executeProfileMaterialization(
          argv(fixture),
          effects,
          new AbortController().signal,
        ),
      ).rejects.toThrow();
      expect(events).toContain('dispose');
      expect(events).not.toContain('publish');
    }
  });

  it('treats a persistence-stage failure as fatal and blocks final evidence', async () => {
    const fixture = await buildFakeSourceAuthority();
    const events: string[] = [];
    const effects = fakeEffects(fixture, events);
    effects.collectSourceAuthority = () => {
      events.push('persistence-failure');
      return Promise.reject(new Error('controlled fake persistence failure'));
    };
    await expect(
      executeProfileMaterialization(
        argv(fixture),
        effects,
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({
      stage: 'first-collection',
      code: 'ingestion.internal-invariant',
    });
    expect(events).toContain('dispose');
    expect(events).toContain('prove-disposed');
    expect(events).not.toContain('publish');
  });

  it.each([
    'create',
    'prepare',
    'first-materialization',
    'second-materialization',
    'quarantine',
    'prove-disposed',
  ] as const)('blocks publication when the %s stage fails', async (stage) => {
    const fixture = await buildFakeSourceAuthority();
    const events: string[] = [];
    const effects = fakeEffects(fixture, events);
    if (stage === 'create') {
      effects.createDatabase = () => {
        events.push(stage);
        return Promise.reject(new Error('controlled fake stage failure'));
      };
    } else if (stage === 'prepare') {
      effects.prepareDatabase = () => {
        events.push(stage);
        return Promise.reject(new Error('controlled fake stage failure'));
      };
    } else if (
      stage === 'first-materialization' ||
      stage === 'second-materialization'
    ) {
      const failOnCall = stage === 'first-materialization' ? 2 : 4;
      let calls = 0;
      effects.materializeProfiles = (preflight, authority) => {
        calls += 1;
        const result = buildProfileMaterializationArtifacts(
          preflight.catalog,
          preflight.taxonomy,
          authority,
        );
        if (calls !== failOnCall) return result;
        return {
          ...result,
          authority: {
            ...result.authority,
            semanticAuthorityDigest: 'd'.repeat(64),
          },
        };
      };
    } else if (stage === 'quarantine') {
      effects.quarantineCompletionEvidence = () => {
        events.push(stage);
        return Promise.reject(new Error('controlled fake stage failure'));
      };
    } else {
      effects.proveDisposed = () => {
        events.push(stage);
        return Promise.reject(new Error('controlled fake stage failure'));
      };
    }
    await expect(
      executeProfileMaterialization(
        argv(fixture),
        effects,
        new AbortController().signal,
      ),
    ).rejects.toThrow();
    expect(events).not.toContain('publish');
    expect(events).toContain('dispose');
  });
});

function replaceArgument(
  arguments_: readonly string[],
  name: string,
  value: string,
): string[] {
  const result = [...arguments_];
  result[result.indexOf(name) + 1] = value;
  return result;
}

function replaceArgumentName(
  arguments_: readonly string[],
  name: string,
  replacement: string,
): string[] {
  const result = [...arguments_];
  result[result.indexOf(name)] = replacement;
  return result;
}

function argv(
  fixture: Awaited<ReturnType<typeof buildFakeSourceAuthority>>,
): string[] {
  const databaseName = 'gitblocks_p8_m7_abcdefghijklmnopqrstuvwxyz_test';
  return [
    '--live-ack',
    PROFILE_MATERIALIZATION_LIVE_ACKNOWLEDGEMENT,
    '--database-ack',
    databaseName,
    '--run-id',
    RUN_ID,
    '--catalog-path',
    'catalog/public-v1/manifest.json',
    '--catalog-digest',
    fixture.catalog.manifestDigest,
    '--taxonomy-path',
    'catalog/capability-taxonomy/1.0.0/manifest.json',
    '--taxonomy-digest',
    fixture.taxonomy.semanticDigest,
    '--provider-policy-path',
    'catalog/public-v1/profile-materialization-provider-policy.json',
    '--provider-policy-version',
    fixture.policy.policyVersion,
    '--provider-policy-digest',
    fixture.policy.policySemanticDigest,
    '--postgres-image',
    PROFILE_MATERIALIZATION_POSTGRES_IMAGE,
    '--database-host',
    '127.0.0.1',
    '--database-port',
    '55432',
    '--owner-url-env',
    PROFILE_MATERIALIZATION_CREDENTIAL_NAMES.ownerUrl,
    '--owner-password-env',
    PROFILE_MATERIALIZATION_CREDENTIAL_NAMES.ownerPassword,
    '--runtime-url-env',
    PROFILE_MATERIALIZATION_CREDENTIAL_NAMES.runtimeUrl,
    '--runtime-password-env',
    PROFILE_MATERIALIZATION_CREDENTIAL_NAMES.runtimePassword,
    '--github-token-env',
    PROFILE_MATERIALIZATION_CREDENTIAL_NAMES.githubToken,
    '--concurrency',
    '3',
    '--request-timeout-ms',
    '10000',
    '--candidate-deadline-ms',
    '90000',
    '--run-deadline-ms',
    '3600000',
    '--maximum-attempts',
    '3',
    '--maximum-redirects',
    '2',
    '--run-directory',
    `verification/retrieval-v1/.profile-materialization-runs/${RUN_ID}`,
  ];
}

function fakeEffects(
  fixture: Awaited<ReturnType<typeof buildFakeSourceAuthority>>,
  events: string[],
): ProfileMaterializationLiveEffects {
  return {
    validateFixedPaths: () => {
      events.push('validate-paths');
      return Promise.resolve();
    },
    readFixedFile: async (path) => {
      events.push('read-file');
      return readFile(new URL(path, ROOT), 'utf8');
    },
    readCredential: () => {
      events.push('credential');
      return 'fake-secret-never-logged';
    },
    createDatabase: () => {
      events.push('create');
      return Promise.resolve();
    },
    proveEmptyDatabase: () => {
      events.push('empty');
      return Promise.resolve();
    },
    prepareDatabase: () => {
      events.push('prepare');
      return Promise.resolve({
        migrationInventoryDigest:
          PROFILE_MATERIALIZATION_MIGRATION_INVENTORY_DIGEST,
        migrationCount: 4,
        databaseSchemaDigest:
          PROFILE_MATERIALIZATION_ACCEPTED_BINDINGS.databaseSchemaDigest,
        productTableCount: 25,
      });
    },
    collectSourceAuthority: (collection, _preflight, _credentials, first) => {
      events.push(`collect-${collection}`);
      expect(first?.authoritySemanticDigest ?? null).toBe(
        collection === 'second'
          ? fixture.authority.authoritySemanticDigest
          : null,
      );
      return Promise.resolve({
        sourceAuthority: fixture.authority,
        persistenceProof: buildFakePersistenceProof(
          fixture.authority,
          collection,
        ),
      });
    },
    publishSourceAuthority: (collection) => {
      events.push(`source-${collection}`);
      return Promise.resolve();
    },
    publishPersistenceProof: (collection) => {
      events.push(`persistence-${collection}`);
      return Promise.resolve();
    },
    materializeProfiles: (preflight, authority) =>
      buildProfileMaterializationArtifacts(
        preflight.catalog,
        preflight.taxonomy,
        authority,
      ),
    quarantineCompletionEvidence: () => {
      events.push('quarantine');
      return Promise.resolve();
    },
    disposeDatabase: () => {
      events.push('dispose');
      return Promise.resolve();
    },
    proveDisposed: () => {
      events.push('prove-disposed');
      return Promise.resolve();
    },
    publishCompletionEvidence: () => {
      events.push('publish');
      return Promise.resolve();
    },
    cancel: () => {
      events.push('cancel');
    },
  };
}
