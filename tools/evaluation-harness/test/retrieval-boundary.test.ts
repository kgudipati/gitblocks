import { mkdtempSync, mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  RetrievalBoundaryError,
  loadRetrievalJsonFile,
  listRetrievalJsonFiles,
} from '../src/retrieval/json-boundary.ts';

function fixtureRoot(): string {
  return mkdtempSync(join(tmpdir(), 'gitblocks-retrieval-boundary-'));
}

describe('retrieval JSON boundary', () => {
  it('rejects duplicate keys, hostile depth, and excessive nodes', () => {
    const root = fixtureRoot();
    writeFileSync(join(root, 'duplicate.json'), '{"caseId":"a","caseId":"b"}');
    writeFileSync(
      join(root, 'depth.json'),
      `${'['.repeat(65)}null${']'.repeat(65)}`,
    );
    writeFileSync(
      join(root, 'nodes.json'),
      JSON.stringify(Array(50_001).fill(0)),
    );
    writeFileSync(join(root, 'hostile.json'), '{"secret":"do-not-echo",}');

    expect(() => loadRetrievalJsonFile(root, 'duplicate.json')).toThrow(
      RetrievalBoundaryError,
    );
    expect(() => loadRetrievalJsonFile(root, 'depth.json')).toThrow(
      RetrievalBoundaryError,
    );
    expect(() => loadRetrievalJsonFile(root, 'nodes.json')).toThrow(
      RetrievalBoundaryError,
    );
    try {
      loadRetrievalJsonFile(root, 'hostile.json');
    } catch (error) {
      expect(String(error)).not.toContain('do-not-echo');
    }
  });

  it('rejects traversal, aliases, symlinks, oversized files, and excessive membership', () => {
    const root = fixtureRoot();
    const outside = fixtureRoot();
    writeFileSync(join(outside, 'outside.json'), '{}');
    symlinkSync(join(outside, 'outside.json'), join(root, 'linked.json'));
    writeFileSync(join(root, 'large.json'), `"${'x'.repeat(256 * 1024)}"`);
    mkdirSync(join(root, 'many'));
    for (let index = 0; index < 3; index += 1) {
      writeFileSync(join(root, 'many', `${String(index)}.json`), '{}');
    }

    expect(() => loadRetrievalJsonFile(root, '../outside.json')).toThrow(
      RetrievalBoundaryError,
    );
    expect(() => loadRetrievalJsonFile(root, './large.json')).toThrow(
      RetrievalBoundaryError,
    );
    expect(() => loadRetrievalJsonFile(root, 'linked.json')).toThrow(
      RetrievalBoundaryError,
    );
    expect(() => loadRetrievalJsonFile(root, 'large.json')).toThrow(
      RetrievalBoundaryError,
    );
    expect(() => listRetrievalJsonFiles(root, { maximumFiles: 2 })).toThrow(
      RetrievalBoundaryError,
    );
    expect(() =>
      listRetrievalJsonFiles(root, { maximumTotalBytes: 1 }),
    ).toThrow(RetrievalBoundaryError);
  });
});
