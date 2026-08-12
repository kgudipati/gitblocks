import { fileURLToPath } from 'node:url';

import { PersistenceError } from '@gitblocks/persistence';
import type * as PersistenceModule from '@gitblocks/persistence';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { readHostedServingDatabaseConfiguration } from '../src/configuration.ts';
import { startHostedDiscoveryComposition } from '../src/composition.ts';
import { runHostedDiscoveryExercise } from '../src/exercise.ts';
import { HostedDiscoveryError } from '../src/errors.ts';
import {
  loadAcceptedHostedDiscoveryStaticPolicyV1,
  parseHostedDiscoveryStaticPolicyV1,
} from '../src/static-policy.ts';
import {
  capabilityInput,
  expectedMetadataBinding,
  loadAcceptedAuthorities,
} from './fixtures.ts';

const persistence = vi.hoisted(() => ({
  client: Object.freeze({ kind: 'gitblocks-postgresql-persistence' as const }),
  close: vi.fn<() => Promise<void>>(),
  create: vi.fn(),
  load: vi.fn(),
}));

vi.mock('@gitblocks/persistence', async (importOriginal) => {
  const actual = await importOriginal<typeof PersistenceModule>();
  return {
    ...actual,
    closePersistenceClient: persistence.close,
    createPersistenceClient: persistence.create,
    loadServingCatalogSnapshot: persistence.load,
  };
});

beforeEach(async () => {
  vi.clearAllMocks();
  const authorities = await loadAcceptedAuthorities();
  persistence.create.mockReturnValue(persistence.client);
  persistence.close.mockResolvedValue(undefined);
  persistence.load.mockResolvedValue({
    snapshotId: 'serving-hosted-composition-test',
    snapshotRecordDigest: 'c'.repeat(64),
    publishedAt: '2026-08-12T00:00:00.000Z',
    candidateCount: 150,
    candidateProfileAuthority: authorities.profiles,
    candidateRetrievalMetadataAuthority: authorities.metadata,
    expectedCandidateRetrievalMetadataAuthorityBinding: expectedMetadataBinding(
      authorities.metadata,
    ),
  });
});

describe('hosted discovery composition', () => {
  it('loads the serving snapshot once, reuses the immutable engine, and closes once', async () => {
    const composition = await startHostedDiscoveryComposition({
      database: databaseConfiguration(),
    });
    expect(composition.readiness()).toMatchObject({
      ready: true,
      snapshot: { candidateCount: 150 },
    });
    expect(persistence.load).toHaveBeenCalledTimes(1);
    expect(persistence.load).toHaveBeenCalledWith(
      persistence.client,
      { selection: 'current' },
      undefined,
    );

    const request = capabilityInput({
      id: 'composition-authorization',
      term: 'authorization',
    });
    const first = composition.discoverCapability(request);
    const second = composition.discoverCapability(request);
    expect(second).toEqual(first);
    expect(persistence.load).toHaveBeenCalledTimes(1);

    await Promise.all([composition.close(), composition.close()]);
    expect(persistence.close).toHaveBeenCalledTimes(1);
    expect(composition.readiness()).toEqual({ ready: false });
    expect(composition.discoverCapability(request)).toMatchObject({
      ok: false,
      failure: { code: 'hosted-discovery-not-ready' },
    });
  });

  it('fails closed and closes the client when no current serving snapshot exists', async () => {
    persistence.load.mockRejectedValueOnce(
      new PersistenceError('persistence.not-found'),
    );
    await expect(
      startHostedDiscoveryComposition({ database: databaseConfiguration() }),
    ).rejects.toMatchObject({ code: 'persistence.not-found' });
    expect(persistence.close).toHaveBeenCalledTimes(1);
  });

  it('loads and validates only the accepted checked-in static policy', async () => {
    const policy = await loadAcceptedHostedDiscoveryStaticPolicyV1();
    expect(policy.taxonomy.taxonomyVersion).toBe('1.0.0');
    expect(policy.retrievalExpansion.expansionVersion).toBe(
      'capability-retrieval-expansion/1.0.0',
    );
    expect(() =>
      parseHostedDiscoveryStaticPolicyV1({
        taxonomy: {},
        retrievalExpansion: policy.retrievalExpansion,
      }),
    ).toThrow(HostedDiscoveryError);
    expect(() =>
      parseHostedDiscoveryStaticPolicyV1({
        taxonomy: policy.taxonomy,
        retrievalExpansion: {},
      }),
    ).toThrow(HostedDiscoveryError);
  });

  it('accepts exactly the six serving database settings and rejects unsafe variants value-free', () => {
    const environment = databaseEnvironment();
    expect(readHostedServingDatabaseConfiguration(environment)).toEqual(
      databaseConfiguration(),
    );
    expect(() =>
      readHostedServingDatabaseConfiguration({
        ...environment,
        GITBLOCKS_HOSTED_SERVING_DB_SSL: 'prefer',
      }),
    ).toThrow(new HostedDiscoveryError('hosted.invalid-configuration').message);
    expect(() =>
      readHostedServingDatabaseConfiguration({
        ...environment,
        GITBLOCKS_HOSTED_SERVING_DB_PORT: 'credential-sentinel',
      }),
    ).toThrow('Hosted discovery configuration is invalid.');
  });

  it('reports one-shot configuration failure without request or credential values', async () => {
    const output: string[] = [];
    const error: string[] = [];
    const exitCode = await runHostedDiscoveryExercise({
      arguments: [
        '--request',
        fileURLToPath(
          new URL(
            '../examples/authorization-discovery-request.json',
            import.meta.url,
          ),
        ),
      ],
      environment: {
        ...databaseEnvironment(),
        GITBLOCKS_HOSTED_SERVING_DB_PORT: 'credential-sentinel',
      },
      writeOutput: (text) => output.push(text),
      writeError: (text) => error.push(text),
    });
    expect(exitCode).toBe(1);
    expect(output).toEqual([]);
    expect(error.join('')).toBe(
      '{"operation":"hosted-discovery.exercise","status":"failed","code":"hosted.invalid-configuration"}\n',
    );
    expect(error.join('')).not.toContain('credential-sentinel');
    expect(persistence.load).not.toHaveBeenCalled();
  });

  it('fails the one-shot operation when graceful shutdown cannot close the client', async () => {
    persistence.close.mockRejectedValueOnce(new Error('driver detail'));
    const output: string[] = [];
    const error: string[] = [];
    const exitCode = await runHostedDiscoveryExercise({
      arguments: [
        '--request',
        fileURLToPath(
          new URL(
            '../examples/authorization-discovery-request.json',
            import.meta.url,
          ),
        ),
      ],
      environment: databaseEnvironment(),
      writeOutput: (text) => output.push(text),
      writeError: (text) => error.push(text),
    });
    expect(exitCode).toBe(1);
    expect(output).toEqual([]);
    expect(error).toEqual([
      '{"operation":"hosted-discovery.shutdown","status":"failed","code":"hosted.internal"}\n',
    ]);
    expect(error.join('')).not.toContain('driver detail');
  });
});

function databaseConfiguration() {
  return {
    host: '127.0.0.1',
    port: 5432,
    database: 'gitblocks',
    username: 'gitblocks_serving_login',
    password: 'test-only-password',
    ssl: false as const,
  };
}

function databaseEnvironment(): Readonly<Record<string, string>> {
  return {
    GITBLOCKS_HOSTED_SERVING_DB_HOST: '127.0.0.1',
    GITBLOCKS_HOSTED_SERVING_DB_PORT: '5432',
    GITBLOCKS_HOSTED_SERVING_DB_DATABASE: 'gitblocks',
    GITBLOCKS_HOSTED_SERVING_DB_USERNAME: 'gitblocks_serving_login',
    GITBLOCKS_HOSTED_SERVING_DB_PASSWORD: 'test-only-password',
    GITBLOCKS_HOSTED_SERVING_DB_SSL: 'disable',
  };
}
