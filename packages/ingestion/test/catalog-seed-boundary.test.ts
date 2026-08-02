import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

describe('catalog seed process and repository policy boundary', () => {
  it('keeps catalog seeding distinct from validation, ingestion, and artifact collection', async () => {
    const packageJson = JSON.parse(
      await readFile(new URL('../../../package.json', import.meta.url), 'utf8'),
    ) as { readonly scripts?: Readonly<Record<string, string>> };
    const seed = packageJson.scripts?.['catalog:seed'];

    expect(seed).toBe(
      'pnpm runtime:check && pnpm build:product && node packages/ingestion/scripts/catalog-seed-cli.ts',
    );
    expect(seed).not.toBe(packageJson.scripts?.['catalog:validate']);
    expect(seed).not.toBe(packageJson.scripts?.['ingest:live']);
    expect(seed).not.toBe(packageJson.scripts?.['artifacts:live']);
    expect(seed).not.toContain('live-cli.ts');
    expect(seed).not.toContain('artifacts-live-cli.ts');
  });

  it('keeps production catalog seeding free of provider, profiler, artifact, interview, evaluation, network, timer, and file-write paths', async () => {
    const sources = await Promise.all(
      [
        '../src/catalog-persistence.ts',
        '../src/catalog-seed.ts',
        '../scripts/catalog-seed-command.ts',
        '../scripts/catalog-seed-cli.ts',
      ].map((path) => readFile(new URL(path, import.meta.url), 'utf8')),
    );
    const source = sources.join('\n');

    for (const forbidden of [
      'ingestPublicCatalog',
      'profileCandidate',
      'createTransport',
      'collectCandidateSources',
      'collectPublicRepositoryArtifacts',
      'createRepositoryArtifactCollector',
      'repository-interview',
      'evaluation-harness',
      'fetch(',
      'setTimeout(',
      'abortableSleep',
      'writeFile',
      'GITBLOCKS_INGEST_GITHUB_TOKEN',
      'GITBLOCKS_ARTIFACT_GITHUB_TOKEN',
      'OPENAI_API_KEY',
    ]) {
      expect(source).not.toContain(forbidden);
    }
    expect(source).toContain('putCatalogCandidate');
    expect(source).toContain('setCandidateCapabilityFamilies');
    expect(source).not.toContain('appendEvidenceObservation');
    expect(source).not.toContain('appendCandidateLimitation');
    expect(source).not.toContain('appendCandidateUnknown');
    expect(source).not.toContain('createCandidateDossierSnapshot');
    expect(source).not.toContain('publishRepositoryArtifactSet');
    expect(source).not.toContain('publishRepositoryInterviewExchange');
  });

  it('requires an explicit catalog path and fixed ephemeral database authority without alternate credential channels', async () => {
    const source = await readFile(
      new URL('../scripts/catalog-seed-command.ts', import.meta.url),
      'utf8',
    );

    for (const required of [
      '--catalog',
      'approved-non-production-public-catalog-seed',
      'ephemeral-non-production',
      'GITBLOCKS_CATALOG_SEED_DB_HOST',
      'GITBLOCKS_CATALOG_SEED_DB_PORT',
      'GITBLOCKS_CATALOG_SEED_DB_DATABASE',
      'GITBLOCKS_CATALOG_SEED_DB_USERNAME',
      'GITBLOCKS_CATALOG_SEED_DB_PASSWORD',
      'GITBLOCKS_CATALOG_SEED_DB_SSL',
      'verifyMigrations',
    ]) {
      expect(source).toContain(required);
    }
    expect(source).not.toContain('DATABASE_URL');
    expect(source).not.toContain('connectionString');
    expect(source).not.toContain('dotenv');
    expect(source).not.toMatch(/--password/u);
    expect(source).not.toMatch(/--(?:database-)?migration/u);
  });
});
