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
    const [cliSource, commandSource, policySource] = await Promise.all([
      readFile(
        new URL('../scripts/artifacts-live-cli.ts', import.meta.url),
        'utf8',
      ),
      readFile(
        new URL('../scripts/artifact-live-command.ts', import.meta.url),
        'utf8',
      ),
      readFile(
        new URL('../scripts/artifact-live-scope-policy.ts', import.meta.url),
        'utf8',
      ),
    ]);
    expect(cliSource).toBe(
      "import { runArtifactLiveCliV1 } from './artifact-live-command.ts';\n\n" +
        'await runArtifactLiveCliV1(process.argv.slice(2));\n',
    );
    expect(policySource).toContain(
      'approved-non-production-public-artifact-collection',
    );
    expect(policySource).toContain('ephemeral-non-production');
    expect(policySource).toContain('persistent-private-alpha-dogfood');
    expect(policySource).toContain(
      'approved-private-alpha-persistent-dogfood-artifact-collection',
    );
    for (const required of [
      '--catalog',
      '--manifest',
      '--receipt',
      'GITBLOCKS_ARTIFACT_GITHUB_TOKEN',
      'GITBLOCKS_ARTIFACT_DB_SCOPE',
      'GITBLOCKS_ARTIFACT_PERSISTENT_ACK',
    ]) {
      expect(commandSource).toContain(required);
    }
    expect(`${commandSource}${policySource}`).not.toContain('artifact.content');
    expect(`${commandSource}${policySource}`).not.toContain('resolvedPath');
    expect(`${commandSource}${policySource}`).not.toContain('displayUrl');
    expect(policySource).not.toMatch(
      /['"](?:production|persistent-production|staging|shared-development|remote-database)['"]/u,
    );
  });

  it('guards exact migration 0007 before transport, collection, and receipt writing', async () => {
    const source = await readFile(
      new URL('../scripts/artifact-live-command.ts', import.meta.url),
      'utf8',
    );
    const command = source.indexOf(
      'export async function runArtifactLiveCliV1(',
    );
    const globalAuthority = source.indexOf(
      'requireGlobalAcknowledgement(dependencies)',
      command,
    );
    const scopeAuthority = source.indexOf(
      'assertArtifactLiveDatabaseScopeAuthorityV1(scopeAuthority)',
      globalAuthority,
    );
    const databaseAuthority = source.indexOf(
      'validateArtifactLiveDatabaseScopeV1({',
      scopeAuthority,
    );
    const client = source.indexOf(
      'dependencies.createPersistenceClient({',
      databaseAuthority,
    );
    const guard = source.indexOf(
      'withVerifiedArtifactLiveDatabaseMigrationV1(',
      client,
    );
    const verification = source.indexOf(
      'dependencies.verifyMigrations(client)',
      guard,
    );
    const transport = source.indexOf(
      'dependencies.createTransport({',
      verification,
    );
    const collector = source.indexOf(
      'dependencies.createRepositoryArtifactCollector({',
      transport,
    );
    const collection = source.indexOf(
      'dependencies.collectPublicRepositoryArtifacts({',
      collector,
    );
    const receiptWrite = source.indexOf(
      'await dependencies.writeTextFileExclusive(',
      collection,
    );

    expect(command).toBeGreaterThan(-1);
    expect(globalAuthority).toBeGreaterThan(command);
    expect(scopeAuthority).toBeGreaterThan(globalAuthority);
    expect(databaseAuthority).toBeGreaterThan(scopeAuthority);
    expect(client).toBeGreaterThan(databaseAuthority);
    expect(guard).toBeGreaterThan(-1);
    expect(verification).toBeGreaterThan(client);
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
