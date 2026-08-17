import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  readdir,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import {
  RetrievalExpansionCommandError,
  runRetrievalExpansionCommand,
} from '../scripts/retrieval-expansion-command.ts';

const sourcePath = fileURLToPath(
  new URL(
    '../../../catalog/capability-retrieval-expansion/1.0.0/source.json',
    import.meta.url,
  ),
);
const manifestPath = fileURLToPath(
  new URL(
    '../../../catalog/capability-retrieval-expansion/1.0.0/manifest.json',
    import.meta.url,
  ),
);
const taxonomyPath = fileURLToPath(
  new URL(
    '../../../catalog/capability-taxonomy/1.0.0/manifest.json',
    import.meta.url,
  ),
);
const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});

async function createRepositoryFixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'gitblocks-expansion-'));
  temporaryRoots.push(root);
  const expansionDirectory = join(
    root,
    'catalog',
    'capability-retrieval-expansion',
    '1.0.0',
  );
  const taxonomyDirectory = join(
    root,
    'catalog',
    'capability-taxonomy',
    '1.0.0',
  );
  await mkdir(expansionDirectory, { recursive: true });
  await mkdir(taxonomyDirectory, { recursive: true });
  await copyFile(sourcePath, join(expansionDirectory, 'source.json'));
  await copyFile(manifestPath, join(expansionDirectory, 'manifest.json'));
  await copyFile(taxonomyPath, join(taxonomyDirectory, 'manifest.json'));
  return realpath(root);
}

describe('retrieval expansion authority command', () => {
  it('has no filesystem or process effect when modules import', async () => {
    const emptyRoot = await mkdtemp(
      join(tmpdir(), 'gitblocks-expansion-import-'),
    );
    temporaryRoots.push(emptyRoot);
    const modules = [
      new URL(
        '../src/capability-retrieval-expansion-contracts.ts',
        import.meta.url,
      ).href,
      new URL('../scripts/retrieval-expansion-command.ts', import.meta.url)
        .href,
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
      'capability-retrieval-expansion',
      '1.0.0',
      'manifest.json',
    );
    const before = await readFile(path, 'utf8');

    await expect(
      runRetrievalExpansionCommand(root, 'validate'),
    ).resolves.toMatchObject({
      mode: 'validate',
      edges: 170,
      sourceConcepts: 55,
      semanticDigest:
        '0068e4e007ce87abd3bf80fed0918b04d9f225a0c32a1aa924a1284865c54948',
    });
    expect(await readFile(path, 'utf8')).toBe(before);
    await expect(
      runRetrievalExpansionCommand(root, 'generate'),
    ).resolves.toMatchObject({ mode: 'generate' });
    expect(await readFile(path, 'utf8')).toBe(before);
  });

  it('fails closed on committed authority and source drift', async () => {
    const root = await createRepositoryFixture();
    const directory = join(
      root,
      'catalog',
      'capability-retrieval-expansion',
      '1.0.0',
    );
    const manifest = JSON.parse(
      await readFile(join(directory, 'manifest.json'), 'utf8'),
    ) as Record<string, unknown>;
    manifest['semanticDigest'] = '0'.repeat(64);
    await writeFile(
      join(directory, 'manifest.json'),
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
    await expect(
      runRetrievalExpansionCommand(root, 'validate'),
    ).rejects.toMatchObject({
      code: 'retrieval-expansion-command.invalid-authority',
    });

    await copyFile(manifestPath, join(directory, 'manifest.json'));
    const source = JSON.parse(
      await readFile(join(directory, 'source.json'), 'utf8'),
    ) as { releaseMetadata: { notes: string } };
    source.releaseMetadata.notes = 'Changed release metadata.';
    await writeFile(
      join(directory, 'source.json'),
      `${JSON.stringify(source, null, 2)}\n`,
    );
    await expect(
      runRetrievalExpansionCommand(root, 'validate'),
    ).rejects.toMatchObject({
      code: 'retrieval-expansion-command.source-drift',
    });
  });

  it('rejects symlinked authority input and repository root', async () => {
    const root = await createRepositoryFixture();
    const source = join(
      root,
      'catalog',
      'capability-retrieval-expansion',
      '1.0.0',
      'source.json',
    );
    const external = join(root, 'external-source.json');
    await copyFile(sourcePath, external);
    await rm(source);
    await symlink(external, source);
    await expect(
      runRetrievalExpansionCommand(root, 'validate'),
    ).rejects.toMatchObject({
      code: 'retrieval-expansion-command.path-boundary',
    });

    const target = await createRepositoryFixture();
    const linkParent = await mkdtemp(
      join(tmpdir(), 'gitblocks-expansion-link-'),
    );
    temporaryRoots.push(linkParent);
    const linkedRoot = join(linkParent, 'repository');
    await symlink(target, linkedRoot);
    await expect(
      runRetrievalExpansionCommand(linkedRoot, 'validate'),
    ).rejects.toMatchObject({
      code: 'retrieval-expansion-command.path-boundary',
    });
  });

  it('returns bounded value-free diagnostics for hostile source text', async () => {
    const root = await createRepositoryFixture();
    const hostile = 'do-not-echo-this-hostile-expansion-value';
    await writeFile(
      join(
        root,
        'catalog',
        'capability-retrieval-expansion',
        '1.0.0',
        'source.json',
      ),
      JSON.stringify({ hostile }),
    );

    let caught: unknown;
    try {
      await runRetrievalExpansionCommand(root, 'validate');
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(RetrievalExpansionCommandError);
    expect(String(caught)).not.toContain(hostile);
    expect(String(caught).length).toBeLessThan(180);
  });
});
