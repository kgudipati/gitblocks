import { fileURLToPath } from 'node:url';

import {
  appendCandidateLimitation,
  appendCandidateUnknown,
  appendEvidenceObservation,
  closePersistenceClient,
  createCandidateDossierSnapshot,
  createPersistenceClient,
  createTenant,
  loadCandidateDossierSnapshot,
  putCatalogCandidate,
  setCandidateCapabilityFamilies,
  type PersistenceClientConfig,
  type StorageScope,
} from '@gitblocks/persistence';
import { describe, expect, it } from 'vitest';

import {
  mapBundleForContractConformance,
  validateLoadedCorpusContractConformance,
} from '../src/contract-conformance.ts';
import { loadCorpus } from '../src/corpus.ts';
import { stableJson } from '../src/stable-json.ts';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const CONFIG = readDatabaseConfig();
const CREATED_AT = '2026-07-29T00:00:00Z';
const EXPIRES_AT = '2027-07-29T00:00:00Z';

describe('evaluation persistence conformance', () => {
  it('stores and reconstructs every dossier in all ten proposed pilot cases without changing scoring authority', async () => {
    const corpus = loadCorpus(REPOSITORY_ROOT);
    expect(corpus.ok).toBe(true);
    if (!corpus.ok) {
      return;
    }
    const conformance = validateLoadedCorpusContractConformance(
      corpus.manifest,
      corpus.bundles,
    );
    expect(conformance).toEqual({
      ok: true,
      summary: {
        caseCount: 10,
        candidateCount: 40,
        contractVersion: '1.0.0',
        goldStatus: 'proposed',
        independentReviewStatus: 'not-reviewed',
        purpose: 'representability-only',
      },
      diagnostics: [],
    });
    const corpusBefore = stableJson({
      manifest: corpus.manifest,
      bundles: corpus.bundles,
    });

    const client = createPersistenceClient(CONFIG);
    let reconstructed = 0;
    try {
      for (const [caseIndex, bundle] of corpus.bundles.entries()) {
        const tenantId = tenantIdFor(caseIndex);
        const scope: StorageScope = {
          kind: 'tenant',
          tenantId,
          expiresAt: EXPIRES_AT,
        };
        await createTenant(client, { tenantId, createdAt: CREATED_AT });
        const mapped = mapBundleForContractConformance(bundle);
        for (const [
          candidateIndex,
          dossier,
        ] of mapped.candidateDossiers.entries()) {
          await putCatalogCandidate(client, {
            scope,
            identity: dossier.identity,
            createdAt: CREATED_AT,
          });
          await setCandidateCapabilityFamilies(client, {
            scope,
            candidateId: dossier.identity.candidateId,
            capabilityFamilies: [dossier.capabilityFamily],
          });
          for (const observation of dossier.observations) {
            await appendEvidenceObservation(client, {
              scope,
              observation,
              createdAt: CREATED_AT,
            });
          }
          for (const limitation of dossier.limitations) {
            await appendCandidateLimitation(client, {
              scope,
              limitation,
              createdAt: CREATED_AT,
            });
          }
          for (const unknown of dossier.unknowns) {
            await appendCandidateUnknown(client, {
              scope,
              unknown,
              createdAt: CREATED_AT,
            });
          }
          const snapshotId = `pilot-${String(caseIndex + 1)}-${String(candidateIndex + 1)}`;
          await createCandidateDossierSnapshot(client, {
            scope,
            snapshotId,
            dossier,
            evidenceCutoff: mapped.assessmentRequest.evidenceCutoff,
            createdAt: CREATED_AT,
          });
          const loaded = await loadCandidateDossierSnapshot(client, {
            scope,
            snapshotId,
          });
          expect(loaded).toEqual(dossier);
          reconstructed += 1;
        }
      }
    } finally {
      await closePersistenceClient(client);
    }

    expect(reconstructed).toBe(40);
    expect(
      stableJson({ manifest: corpus.manifest, bundles: corpus.bundles }),
    ).toBe(corpusBefore);
    expect(corpus.manifest.provenance.goldStatus).toBe('proposed');
    expect(corpus.manifest.provenance.independentReviewStatus).toBe(
      'not-reviewed',
    );
  });
});

function tenantIdFor(index: number): string {
  const suffix = String(index + 1).padStart(12, '0');
  return `90000000-0000-4000-8000-${suffix}`;
}

function readDatabaseConfig(): PersistenceClientConfig {
  if (process.env['GITBLOCKS_DB_TEST_ACK'] !== 'ephemeral') {
    throw new Error('PostgreSQL integration database must be ephemeral.');
  }
  return {
    host: requiredEnvironment('GITBLOCKS_TEST_DB_HOST'),
    port: parsePort(requiredEnvironment('GITBLOCKS_TEST_DB_PORT')),
    database: requiredEnvironment('GITBLOCKS_TEST_DB_DATABASE'),
    username: 'gitblocks_runtime_test',
    password: 'runtime-test-only',
    ssl: false,
    maximumConnections: 5,
    connectTimeoutMilliseconds: 5_000,
    idleTimeoutMilliseconds: 5_000,
    statementTimeoutMilliseconds: 10_000,
    lockTimeoutMilliseconds: 5_000,
  };
}

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    throw new Error('PostgreSQL integration configuration is required.');
  }
  return value;
}

function parsePort(value: string): number {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PostgreSQL integration configuration is invalid.');
  }
  return port;
}
