import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  readdir,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import {
  runTaxonomyCommand,
  TaxonomyCommandError,
} from '../scripts/taxonomy-command.ts';

const sourcePath = fileURLToPath(
  new URL(
    '../../../catalog/capability-taxonomy/1.0.0/source.json',
    import.meta.url,
  ),
);
const manifestPath = fileURLToPath(
  new URL(
    '../../../catalog/capability-taxonomy/1.0.0/manifest.json',
    import.meta.url,
  ),
);
const temporaryRoots: string[] = [];

afterEach(async () => {
  for (const path of temporaryRoots.splice(0)) {
    await import('node:fs/promises').then(({ rm }) =>
      rm(path, { recursive: true, force: true }),
    );
  }
});

async function createRepositoryFixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'gitblocks-taxonomy-'));
  temporaryRoots.push(root);
  const authorityDirectory = join(
    root,
    'catalog',
    'capability-taxonomy',
    '1.0.0',
  );
  await mkdir(authorityDirectory, { recursive: true });
  await copyFile(sourcePath, join(authorityDirectory, 'source.json'));
  await copyFile(manifestPath, join(authorityDirectory, 'manifest.json'));
  return realpath(root);
}

describe('taxonomy authority command', () => {
  it('has no filesystem or process effect when product and command modules import', async () => {
    const emptyRoot = await mkdtemp(
      join(tmpdir(), 'gitblocks-taxonomy-import-'),
    );
    temporaryRoots.push(emptyRoot);
    const modules = [
      new URL('../src/capability-taxonomy-contracts.ts', import.meta.url).href,
      new URL('../scripts/taxonomy-command.ts', import.meta.url).href,
    ];

    const result = spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '--eval',
        `for (const moduleUrl of ${JSON.stringify(modules)}) await import(moduleUrl);`,
      ],
      { cwd: emptyRoot, encoding: 'utf8' },
    );

    expect(result.status).toBe(0);
    expect(result.signal).toBeNull();
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe('');
    expect(await readdir(emptyRoot)).toEqual([]);
  }, 30_000);

  it('validates without writing and generates byte-identical authority', async () => {
    const root = await createRepositoryFixture();
    const path = join(
      root,
      'catalog',
      'capability-taxonomy',
      '1.0.0',
      'manifest.json',
    );
    const before = await readFile(path, 'utf8');

    await expect(runTaxonomyCommand(root, 'validate')).resolves.toMatchObject({
      mode: 'validate',
      concepts: 86,
      resolvedAliases: 133,
      ambiguities: 11,
      exclusions: 26,
    });
    expect(await readFile(path, 'utf8')).toBe(before);
    await expect(runTaxonomyCommand(root, 'generate')).resolves.toMatchObject({
      mode: 'generate',
    });
    expect(await readFile(path, 'utf8')).toBe(before);
  });

  it('fails closed on manifest drift and source drift', async () => {
    const root = await createRepositoryFixture();
    const authorityDirectory = join(
      root,
      'catalog',
      'capability-taxonomy',
      '1.0.0',
    );
    const manifest = JSON.parse(
      await readFile(join(authorityDirectory, 'manifest.json'), 'utf8'),
    ) as Record<string, unknown>;
    manifest['semanticDigest'] = '0'.repeat(64);
    await writeFile(
      join(authorityDirectory, 'manifest.json'),
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
    await expect(runTaxonomyCommand(root, 'validate')).rejects.toMatchObject({
      code: 'taxonomy-command.invalid-authority',
    });

    await copyFile(manifestPath, join(authorityDirectory, 'manifest.json'));
    const source = JSON.parse(
      await readFile(join(authorityDirectory, 'source.json'), 'utf8'),
    ) as { releaseMetadata: { notes: string } };
    source.releaseMetadata.notes = 'Changed release metadata.';
    await writeFile(
      join(authorityDirectory, 'source.json'),
      `${JSON.stringify(source, null, 2)}\n`,
    );
    await expect(runTaxonomyCommand(root, 'validate')).rejects.toMatchObject({
      code: 'taxonomy-command.source-drift',
    });
  });

  it('rejects a symlinked source and a symlinked repository root', async () => {
    const root = await createRepositoryFixture();
    const authorityDirectory = join(
      root,
      'catalog',
      'capability-taxonomy',
      '1.0.0',
    );
    const external = join(root, 'external-source.json');
    await copyFile(sourcePath, external);
    await import('node:fs/promises').then(({ rm }) =>
      rm(join(authorityDirectory, 'source.json')),
    );
    await symlink(external, join(authorityDirectory, 'source.json'));

    await expect(runTaxonomyCommand(root, 'validate')).rejects.toMatchObject({
      code: 'taxonomy-command.path-boundary',
    });

    const target = await createRepositoryFixture();
    const linkParent = await mkdtemp(
      join(tmpdir(), 'gitblocks-taxonomy-link-'),
    );
    temporaryRoots.push(linkParent);
    const linkedRoot = join(linkParent, 'repository');
    await symlink(target, linkedRoot);
    await expect(
      runTaxonomyCommand(linkedRoot, 'validate'),
    ).rejects.toMatchObject({
      code: 'taxonomy-command.path-boundary',
    });
  });

  it('returns bounded value-free diagnostics for hostile source text', async () => {
    const root = await createRepositoryFixture();
    const hostile = 'do-not-echo-this-hostile-taxonomy-value';
    await writeFile(
      join(root, 'catalog', 'capability-taxonomy', '1.0.0', 'source.json'),
      JSON.stringify({ hostile }),
    );

    let caught: unknown;
    try {
      await runTaxonomyCommand(root, 'validate');
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(TaxonomyCommandError);
    expect(String(caught)).not.toContain(hostile);
    expect(String(caught).length).toBeLessThan(160);
  });
});
