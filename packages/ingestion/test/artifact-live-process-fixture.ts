import { readFile } from 'node:fs/promises';

import type {
  MigrationVerification,
  PersistenceClient,
} from '@gitblocks/persistence';

import {
  runArtifactLiveCliV1,
  type ArtifactLiveCliDependenciesV1,
} from '../scripts/artifact-live-command.ts';
import type {
  ArtifactReceipt,
  RepositoryArtifactCollector,
} from '../src/index.ts';

const events: string[] = [];
const environment: Readonly<Record<string, string>> = {
  GITBLOCKS_ARTIFACT_ACKNOWLEDGEMENT:
    'approved-non-production-public-artifact-collection',
  GITBLOCKS_ARTIFACT_DB_SCOPE: 'persistent-private-alpha-dogfood',
  GITBLOCKS_ARTIFACT_PERSISTENT_ACK:
    'approved-private-alpha-persistent-dogfood-artifact-collection',
  GITBLOCKS_ARTIFACT_DB_HOST: '127.0.0.1',
  GITBLOCKS_ARTIFACT_DB_PORT: '49152',
  GITBLOCKS_ARTIFACT_DB_DATABASE: 'gitblocks_dogfood_test',
  GITBLOCKS_ARTIFACT_DB_USERNAME: 'gitblocks_persistence_dogfood',
  GITBLOCKS_ARTIFACT_DB_PASSWORD: 'offline-password-sentinel',
  GITBLOCKS_ARTIFACT_DB_SSL: 'false',
  GITBLOCKS_ARTIFACT_GITHUB_TOKEN: 'offline-github-token-sentinel',
};
const client = Object.freeze({
  kind: 'gitblocks-postgresql-persistence' as const,
}) as PersistenceClient;
const transport = {
  requestJson: () => Promise.reject(new Error('real network is forbidden')),
  getMetrics: () => ({
    providerRequestCounts: { github: 0, npm: 0 },
    githubRateLimit: null,
  }),
};
const collector: RepositoryArtifactCollector = {
  collectCandidate: () =>
    Promise.reject(new Error('real collection is forbidden')),
};
const receipt = Object.freeze({
  receiptVersion: 'public-artifact-receipt/1.0.0',
  catalogVersion: 'public-v1',
  catalogDigest: '1'.repeat(64),
  artifactManifestVersion: 'public-artifacts-v1',
  artifactManifestDigest: '2'.repeat(64),
  collectorVersion: 'repository-artifacts-v1',
  chunkerVersion: 'exact-lines-v1',
  runId: `artifact-run-${'3'.repeat(48)}`,
  startedAt: '2026-08-13T00:00:00.000Z',
  completedAt: '2026-08-13T00:00:01.000Z',
  requestedCandidateCount: 1,
  completedCandidateCount: 1,
  artifactCount: 1,
  chunkCount: 1,
  absenceCount: 0,
  operationalDecodedBytes: 12,
  materializedArtifactBytes: 12,
  githubRequestCount: 1,
  providerRateLimit: null,
  databaseMigrationVersion: 7,
  inserted: { artifacts: 1, chunks: 1, artifactSets: 1, entries: 1 },
  failuresByCode: [],
  outcomeCounts: { created: 1, idempotent: 0, failed: 0 },
  rerunComparison: null,
  candidates: [],
  receiptDigest: '4'.repeat(64),
} satisfies ArtifactReceipt);

const dependencies: ArtifactLiveCliDependenciesV1 = {
  readTextFile: (path) => readFile(path, 'utf8'),
  writeTextFileExclusive: () => {
    events.push('write-receipt-fake');
    return Promise.resolve();
  },
  readEnvironment: (name) => environment[name],
  createPersistenceClient: () => {
    events.push('create-client');
    return client;
  },
  closePersistenceClient: () => {
    events.push('close-client');
    return Promise.resolve();
  },
  verifyMigrations: () => {
    events.push('verify-migration-7');
    return Promise.resolve({
      postgresqlVersion: '18.4',
      migrations: [
        { version: 7, name: 'synthetic-migration', checksum: '5'.repeat(64) },
      ],
    } satisfies MigrationVerification);
  },
  createTransport: () => {
    events.push('create-transport');
    return transport;
  },
  createRepositoryArtifactCollector: () => {
    events.push('create-collector');
    return collector;
  },
  collectPublicRepositoryArtifacts: () => {
    events.push('collect-artifacts');
    events.push('provider-request-fake');
    events.push('persistence-publication-fake');
    return Promise.resolve(receipt);
  },
  fetch: () => Promise.reject(new Error('real network is forbidden')),
  sleep: () => Promise.resolve(),
  clock: { now: () => new Date('2026-08-13T00:00:00.000Z') },
  writeStdout: () => events.push('stdout'),
  writeStderr: () => undefined,
};

await runArtifactLiveCliV1(
  [
    '--catalog',
    'catalog/public-v1/manifest.json',
    '--manifest',
    'catalog/public-v1/artifact-manifest.json',
    '--receipt',
    '/not-written/artifact-receipt.json',
  ],
  dependencies,
);
process.stdout.write(`${JSON.stringify(events)}\n`);
