import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

describe('repository artifact operator surface', () => {
  it('keeps validation, verification, live collection, and receipt commands separate', async () => {
    const packageJson = JSON.parse(
      await readFile(new URL('../../../package.json', import.meta.url), 'utf8'),
    ) as { readonly scripts?: Readonly<Record<string, string>> };
    expect(packageJson.scripts).toMatchObject({
      'artifacts:validate':
        'pnpm runtime:check && pnpm build:product && node packages/ingestion/scripts/artifact-manifest-cli.ts',
      'artifacts:test':
        'pnpm runtime:check && pnpm build:product && vitest run packages/ingestion/test/artifact-*.test.ts --config vitest.config.ts',
      'artifacts:verify':
        'pnpm artifacts:validate && pnpm artifacts:test && pnpm --filter @gitblocks/ingestion typecheck',
      'artifacts:live':
        'pnpm runtime:check && pnpm build:product && node packages/ingestion/scripts/artifacts-live-cli.ts',
      'artifacts:receipt':
        'pnpm runtime:check && pnpm build:product && node packages/ingestion/scripts/artifact-receipt-cli.ts',
    });
    expect(packageJson.scripts?.['artifacts:live']).not.toBe(
      packageJson.scripts?.['ingest:live'],
    );
  });

  it('requires explicit non-production authority and keeps operator output content-free', async () => {
    const source = await readFile(
      new URL('../scripts/artifacts-live-cli.ts', import.meta.url),
      'utf8',
    );
    expect(source).toContain(
      'approved-non-production-public-artifact-collection',
    );
    for (const required of [
      '--catalog',
      '--manifest',
      '--receipt',
      'GITBLOCKS_ARTIFACT_GITHUB_TOKEN',
      'GITBLOCKS_ARTIFACT_DB_SCOPE',
    ]) {
      expect(source).toContain(required);
    }
    expect(source).not.toContain('artifact.content');
    expect(source).not.toContain('resolvedPath');
    expect(source).not.toContain('displayUrl');
  });

  it('guards exact migration 0007 before transport, collection, and receipt writing', async () => {
    const source = await readFile(
      new URL('../scripts/artifacts-live-cli.ts', import.meta.url),
      'utf8',
    );
    const guard = source.indexOf(
      'withVerifiedArtifactLiveDatabaseMigrationV1(',
    );
    const verification = source.indexOf('verifyMigrations(client)', guard);
    const transport = source.indexOf('createTransport({', verification);
    const collector = source.indexOf(
      'createRepositoryArtifactCollector({',
      transport,
    );
    const collection = source.indexOf(
      'collectPublicRepositoryArtifacts({',
      collector,
    );
    const receiptWrite = source.indexOf('await writeFile(', collection);

    expect(guard).toBeGreaterThan(-1);
    expect(verification).toBeGreaterThan(guard);
    expect(transport).toBeGreaterThan(verification);
    expect(collector).toBeGreaterThan(transport);
    expect(collection).toBeGreaterThan(collector);
    expect(receiptWrite).toBeGreaterThan(collection);
    expect(source.slice(guard, receiptWrite)).toContain(
      'databaseMigrationVersion',
    );
    expect(source).not.toContain('databaseMigrationVersion !== 3');
    expect(source).not.toContain('migration 0003.');
    expect(source).not.toMatch(/--(?:database-)?migration/u);
    expect(source).not.toContain('GITBLOCKS_ARTIFACT_DB_MIGRATION');
  });

  it("loads materialized artifacts with the artifact set's chunker version", async () => {
    const source = await readFile(
      new URL('../src/artifact-batch.ts', import.meta.url),
      'utf8',
    );
    expect(source).toMatch(
      /chunkerVersion:\s+persisted\.artifactSet\.chunkerVersion/u,
    );
  });
});
