import { existsSync, mkdirSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { runRepositoryChecks } from '../src/repository-runner.ts';
import {
  createMinimalTemporaryRepository,
  createValidTemporaryRepository,
  removeTemporaryRepository,
  stageRepository,
  writeRepositoryFile,
} from './temp-repository.ts';

const temporaryRepositories: string[] = [];

afterEach(() => {
  for (const repositoryRoot of temporaryRepositories.splice(0)) {
    removeTemporaryRepository(repositoryRoot);
  }
});

function track(repositoryRoot: string): string {
  temporaryRepositories.push(repositoryRoot);
  return repositoryRoot;
}

describe('runRepositoryChecks', () => {
  it('accepts a valid repository from a nested working directory', () => {
    const repositoryRoot = track(createValidTemporaryRepository());
    const nestedDirectory = join(repositoryRoot, 'nested', 'directory');
    mkdirSync(nestedDirectory, { recursive: true });

    expect(runRepositoryChecks(nestedDirectory)).toEqual([]);
  });

  it('sorts diagnostics deterministically', () => {
    const repositoryRoot = track(createMinimalTemporaryRepository());

    const firstRun = runRepositoryChecks(repositoryRoot);
    const secondRun = runRepositoryChecks(repositoryRoot);

    expect(firstRun).toEqual(secondRun);
    expect(firstRun).toEqual(
      [...firstRun].sort((left, right) => {
        const leftKey = `${left.path ?? ''}\0${left.code}\0${left.message}`;
        const rightKey = `${right.path ?? ''}\0${right.code}\0${right.message}`;
        return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
      }),
    );
  });

  it('rejects a tracked symlink instead of following it', () => {
    const repositoryRoot = track(createValidTemporaryRepository());
    const outsideDirectory = track(createMinimalTemporaryRepository());
    symlinkSync(
      join(outsideDirectory, 'README.md'),
      join(repositoryRoot, 'escape.md'),
    );
    stageRepository(repositoryRoot);

    expect(
      runRepositoryChecks(repositoryRoot).map(
        (repositoryDiagnostic) => repositoryDiagnostic.code,
      ),
    ).toContain('repository.symlink');
  });

  it('keeps malicious repository text inert', () => {
    const repositoryRoot = track(createValidTemporaryRepository());
    const markerPath = join(repositoryRoot, 'malicious-text-executed');
    writeRepositoryFile(
      repositoryRoot,
      'README.md',
      `# GitBlocks\n\n\`\`\`sh\n$(touch ${markerPath})\n\`\`\`\n`,
    );
    stageRepository(repositoryRoot);

    expect(runRepositoryChecks(repositoryRoot)).toEqual([]);
    expect(existsSync(markerPath)).toBe(false);
  });

  it('fails capitalization inspection safely when Markdown limits are exceeded', () => {
    const repositoryRoot = track(createValidTemporaryRepository());
    const nestedStrong = '**'.repeat(80);
    writeRepositoryFile(
      repositoryRoot,
      'README.md',
      `# ${nestedStrong}Gitblocks${nestedStrong}\n`,
    );
    stageRepository(repositoryRoot);

    const diagnostics = runRepositoryChecks(repositoryRoot);

    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'markdown.structure-limit',
          path: 'README.md',
        }),
      ]),
    );
    expect(
      diagnostics.map((repositoryDiagnostic) => repositoryDiagnostic.code),
    ).not.toContain('repository.product-capitalization');
  });
});
