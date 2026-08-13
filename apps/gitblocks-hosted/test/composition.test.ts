import { PersistenceError } from '@gitblocks/persistence';
import type * as PersistenceModule from '@gitblocks/persistence';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { FitAssessmentModelRequestV1 } from '../src/application.ts';
import {
  DEFAULT_HOSTED_MCP_PORT,
  HOSTED_FIT_MODEL,
  readHostedFitModelConfiguration,
  readHostedMcpPortConfiguration,
  readHostedServingDatabaseConfiguration,
} from '../src/configuration.ts';
import { startHostedRecommendationComposition } from '../src/composition.ts';
import { HostedDiscoveryError } from '../src/errors.ts';
import {
  loadAcceptedHostedDiscoveryStaticPolicyV1,
  parseHostedDiscoveryStaticPolicyV1,
} from '../src/static-policy.ts';
import {
  candidateDossier,
  expectedMetadataBinding,
  groundedModelResponse,
  loadAcceptedAuthorities,
  recommendationRequest,
} from './fixtures.ts';

const persistence = vi.hoisted(() => ({
  client: Object.freeze({ kind: 'gitblocks-postgresql-persistence' as const }),
  close: vi.fn<() => Promise<void>>(),
  create: vi.fn(),
  loadDossier: vi.fn(),
  loadSnapshot: vi.fn(),
}));

vi.mock('@gitblocks/persistence', async (importOriginal) => {
  const actual = await importOriginal<typeof PersistenceModule>();
  return {
    ...actual,
    closePersistenceClient: persistence.close,
    createPersistenceClient: persistence.create,
    loadActiveCandidateDossier: persistence.loadDossier,
    loadServingCatalogSnapshot: persistence.loadSnapshot,
  };
});

beforeEach(async () => {
  vi.clearAllMocks();
  const authorities = await loadAcceptedAuthorities();
  persistence.create.mockReturnValue(persistence.client);
  persistence.close.mockResolvedValue(undefined);
  persistence.loadSnapshot.mockResolvedValue({
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
  persistence.loadDossier.mockImplementation(
    (
      _client: unknown,
      command: { candidateId: string; evidenceCutoff: string },
    ) =>
      Promise.resolve(
        candidateDossier(command.candidateId, command.evidenceCutoff),
      ),
  );
});

describe('hosted recommendation composition', () => {
  it('loads the serving snapshot once, reuses the immutable retrieval engine, and performs request-time evidence reads only for finalists', async () => {
    const model = vi.fn((input: FitAssessmentModelRequestV1) =>
      Promise.resolve(groundedModelResponse(input)),
    );
    const composition = await startHostedRecommendationComposition({
      database: databaseConfiguration(),
      fitModel: { assess: model },
      clock: { now: () => '2026-08-12T12:00:00.000Z' },
    });
    expect(composition.readiness()).toMatchObject({
      ready: true,
      snapshot: { candidateCount: 150 },
    });
    expect(persistence.loadSnapshot).toHaveBeenCalledTimes(1);

    const request = recommendationRequest({
      id: 'composition-authorization',
      term: 'authorization',
    });
    const first = await composition.recommendOss(request);
    const second = await composition.recommendOss(request);
    expect(first).toMatchObject({ ok: true, result: { outcome: 'recommend' } });
    expect(second).toMatchObject({
      ok: true,
      result: { outcome: 'recommend' },
    });
    expect(persistence.loadSnapshot).toHaveBeenCalledTimes(1);
    expect(persistence.loadDossier).toHaveBeenCalledTimes(10);
    expect(model).toHaveBeenCalledTimes(2);

    await Promise.all([composition.close(), composition.close()]);
    expect(persistence.close).toHaveBeenCalledTimes(1);
    expect(composition.readiness()).toEqual({ ready: false });
    expect(await composition.recommendOss(request)).toMatchObject({
      ok: false,
      failure: { code: 'hosted-recommendation-not-ready' },
    });
  });

  it('fails closed and closes the client when no current serving snapshot exists', async () => {
    persistence.loadSnapshot.mockRejectedValueOnce(
      new PersistenceError('persistence.not-found'),
    );
    await expect(
      startHostedRecommendationComposition({
        database: databaseConfiguration(),
        fitModel: { assess: vi.fn() },
      }),
    ).rejects.toMatchObject({ code: 'persistence.not-found' });
    expect(persistence.close).toHaveBeenCalledTimes(1);
  });

  it('loads and validates only the accepted checked-in normalization policy', async () => {
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
  });

  it('accepts only bounded explicit database, MCP, credential, and fit-model configuration', () => {
    const environment = databaseEnvironment();
    expect(readHostedServingDatabaseConfiguration(environment)).toEqual(
      databaseConfiguration(),
    );
    expect(readHostedMcpPortConfiguration({})).toBe(DEFAULT_HOSTED_MCP_PORT);
    expect(
      readHostedFitModelConfiguration({
        OPENAI_API_KEY: 'sk-test-only',
        GITBLOCKS_HOSTED_FIT_MODEL: HOSTED_FIT_MODEL,
      }),
    ).toEqual({ apiKey: 'sk-test-only', model: HOSTED_FIT_MODEL });
    for (const rejectedModel of [
      'gpt-5.4-mini',
      'gpt-5.4-2026-03-05',
      'gpt-5.4',
      'gpt-5.4-nano-2026-03-17',
      'gpt-5-mini-2025-08-07',
      'ft:anything',
      'arbitrary-model',
    ]) {
      expect(() =>
        readHostedFitModelConfiguration({
          OPENAI_API_KEY: 'sk-test-only',
          GITBLOCKS_HOSTED_FIT_MODEL: rejectedModel,
        }),
      ).toThrow('Hosted discovery configuration is invalid.');
    }
    expect(() =>
      readHostedFitModelConfiguration({ OPENAI_API_KEY: 'credential-only' }),
    ).toThrow('Hosted discovery configuration is invalid.');
    expect(() =>
      readHostedServingDatabaseConfiguration({
        ...environment,
        GITBLOCKS_HOSTED_SERVING_DB_SSL: 'prefer',
      }),
    ).toThrow('Hosted discovery configuration is invalid.');
    expect(() =>
      readHostedMcpPortConfiguration({ GITBLOCKS_HOSTED_MCP_PORT: '0' }),
    ).toThrow('Hosted discovery configuration is invalid.');
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
