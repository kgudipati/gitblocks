import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { hashJsonFile } from '../src/json-boundary.ts';
import { validateManifestHashes } from '../src/corpus.ts';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe('corpus manifest hashes', () => {
  it('accepts current SHA-256 hashes and detects drift', () => {
    const root = mkdtempSync(join(tmpdir(), 'gitblocks-manifest-'));
    temporaryDirectories.push(root);
    writeFileSync(join(root, 'case.json'), '{"caseId":"example"}\n');
    const expectedHash = hashJsonFile(root, 'case.json');

    expect(
      validateManifestHashes(root, [
        { path: 'case.json', sha256: expectedHash },
      ]),
    ).toEqual([]);

    writeFileSync(join(root, 'case.json'), '{"caseId":"changed"}\n');
    expect(
      validateManifestHashes(root, [
        { path: 'case.json', sha256: expectedHash },
      ]),
    ).toEqual([
      expect.objectContaining({
        code: 'manifest.hash',
        path: 'case.json',
      }),
    ]);
  });

  it('rejects duplicate manifest paths', () => {
    const root = mkdtempSync(join(tmpdir(), 'gitblocks-manifest-'));
    temporaryDirectories.push(root);
    writeFileSync(join(root, 'case.json'), '{}');
    const hash = hashJsonFile(root, 'case.json');

    expect(
      validateManifestHashes(root, [
        { path: 'case.json', sha256: hash },
        { path: 'case.json', sha256: hash },
      ]).map((diagnostic) => diagnostic.code),
    ).toContain('manifest.duplicate-path');
  });
});
