import { spawnSync } from 'node:child_process';
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import {
  CandidateProfileCommandError,
  runCandidateProfileCommand,
} from '../scripts/candidate-profile-command.ts';

const repositoryRoot = fileURLToPath(new URL('../../..', import.meta.url));
const temporaryRoots: string[] = [];

afterEach(async () => {
  for (const path of temporaryRoots.splice(0)) {
    await rm(path, { recursive: true, force: true });
  }
});

describe('candidate profile authority command', () => {
  it('has no filesystem or process effects when product and command modules import', async () => {
    const emptyRoot = await mkdtemp(
      join(tmpdir(), 'gitblocks-profile-import-'),
    );
    temporaryRoots.push(emptyRoot);
    const modules = [
      new URL('../src/candidate-profile-projection.ts', import.meta.url).href,
      new URL('../scripts/candidate-profile-command.ts', import.meta.url).href,
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
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe('');
    expect(await readdir(emptyRoot)).toEqual([]);
  }, 30_000);

  it('validates without writing and generates byte-identical files', async () => {
    const root = await fixture();
    const authorityPath = profileAuthorityPath(root);
    const coveragePath = profileCoveragePath(root);
    const curationPath = curationAuthorityPath(root);
    const beforeAuthority = await readFile(authorityPath, 'utf8');
    const beforeCoverage = await readFile(coveragePath, 'utf8');
    const beforeCuration = await readFile(curationPath, 'utf8');
    await expect(
      runCandidateProfileCommand(root, 'validate'),
    ).resolves.toMatchObject({
      mode: 'validate',
      profiles: 150,
      known: 600,
      unknown: 3_240,
      notApplicable: 210,
      conflict: 0,
      partial: 0,
      complete: 0,
    });
    expect(await readFile(authorityPath, 'utf8')).toBe(beforeAuthority);
    expect(await readFile(coveragePath, 'utf8')).toBe(beforeCoverage);
    expect(await readFile(curationPath, 'utf8')).toBe(beforeCuration);
    await expect(
      runCandidateProfileCommand(root, 'generate'),
    ).resolves.toMatchObject({
      mode: 'generate',
    });
    expect(await readFile(authorityPath, 'utf8')).toBe(beforeAuthority);
    expect(await readFile(coveragePath, 'utf8')).toBe(beforeCoverage);
    expect(await readFile(curationPath, 'utf8')).toBe(beforeCuration);
  }, 60_000);

  it('rejects committed authority and source/coverage drift', async () => {
    const root = await fixture();
    const authority = JSON.parse(
      await readFile(profileAuthorityPath(root), 'utf8'),
    ) as Record<string, unknown>;
    authority['semanticAuthorityDigest'] = '0'.repeat(64);
    await writeFile(
      profileAuthorityPath(root),
      `${JSON.stringify(authority, null, 2)}\n`,
    );
    await expect(
      runCandidateProfileCommand(root, 'validate'),
    ).rejects.toMatchObject({
      code: 'profile-command.invalid-authority',
    });

    await copyFile(
      join(
        repositoryRoot,
        'catalog',
        'public-v1',
        'candidate-profile-authority-v2.json',
      ),
      profileAuthorityPath(root),
    );
    const coverage = await readFile(profileCoveragePath(root), 'utf8');
    await writeFile(
      profileCoveragePath(root),
      coverage.replace('"known": 600', '"known": 599'),
    );
    await expect(
      runCandidateProfileCommand(root, 'validate'),
    ).rejects.toMatchObject({
      code: 'profile-command.source-drift',
    });
  }, 30_000);

  it('rejects symlinked authorities, outputs, and repository-root path escape', async () => {
    const root = await fixture();
    const external = join(root, 'external-catalog.json');
    await copyFile(catalogPath(repositoryRoot), external);
    await rm(catalogPath(root));
    await symlink(external, catalogPath(root));
    await expect(
      runCandidateProfileCommand(root, 'validate'),
    ).rejects.toMatchObject({
      code: 'profile-command.path-boundary',
    });

    const outputRoot = await fixture();
    const externalAuthority = join(outputRoot, 'external-authority.json');
    await copyFile(profileAuthorityPath(repositoryRoot), externalAuthority);
    await rm(profileAuthorityPath(outputRoot));
    await symlink(externalAuthority, profileAuthorityPath(outputRoot));
    await expect(
      runCandidateProfileCommand(outputRoot, 'generate'),
    ).rejects.toMatchObject({
      code: 'profile-command.path-boundary',
    });

    const target = await fixture();
    const parent = await mkdtemp(join(tmpdir(), 'gitblocks-profile-link-'));
    temporaryRoots.push(parent);
    const linkedRoot = join(parent, 'repository');
    await symlink(target, linkedRoot);
    await expect(
      runCandidateProfileCommand(linkedRoot, 'validate'),
    ).rejects.toMatchObject({
      code: 'profile-command.path-boundary',
    });
  }, 30_000);

  it('rejects excessive fixed-authority input with bounded value-free diagnostics', async () => {
    const root = await fixture();
    const hostile = 'do-not-echo-hostile-profile-source';
    await writeFile(
      catalogPath(root),
      `${hostile}${'x'.repeat(2 * 1_024 * 1_024)}`,
    );
    let caught: unknown;
    try {
      await runCandidateProfileCommand(root, 'validate');
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(CandidateProfileCommandError);
    expect(String(caught)).not.toContain(hostile);
    expect(String(caught).length).toBeLessThan(180);
  });
});

async function fixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'gitblocks-profile-command-'));
  temporaryRoots.push(root);
  await mkdir(join(root, 'catalog', 'public-v1'), { recursive: true });
  await mkdir(join(root, 'catalog', 'capability-taxonomy', '1.0.0'), {
    recursive: true,
  });
  await mkdir(join(root, 'verification', 'retrieval-v2'), { recursive: true });
  await copyFile(catalogPath(repositoryRoot), catalogPath(root));
  await copyFile(taxonomyPath(repositoryRoot), taxonomyPath(root));
  await copyFile(
    profileAuthorityPath(repositoryRoot),
    profileAuthorityPath(root),
  );
  await copyFile(
    curationAuthorityPath(repositoryRoot),
    curationAuthorityPath(root),
  );
  await copyFile(
    profileCoveragePath(repositoryRoot),
    profileCoveragePath(root),
  );
  return realpath(root);
}

function catalogPath(root: string): string {
  return join(root, 'catalog', 'public-v1', 'manifest.json');
}
function taxonomyPath(root: string): string {
  return join(root, 'catalog', 'capability-taxonomy', '1.0.0', 'manifest.json');
}
function profileAuthorityPath(root: string): string {
  return join(
    root,
    'catalog',
    'public-v1',
    'candidate-profile-authority-v2.json',
  );
}
function curationAuthorityPath(root: string): string {
  return join(
    root,
    'catalog',
    'public-v1',
    'candidate-profile-reviewed-curation-v2.json',
  );
}
function profileCoveragePath(root: string): string {
  return join(root, 'verification', 'retrieval-v2', 'profile-coverage.json');
}
