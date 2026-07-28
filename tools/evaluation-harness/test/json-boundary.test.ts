import {
  mkdirSync,
  mkdtempSync,
  existsSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  EvaluationBoundaryError,
  loadJsonDirectory,
  loadJsonFile,
} from '../src/json-boundary.ts';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

function temporaryDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), 'gitblocks-evaluation-'));
  temporaryDirectories.push(directory);
  return directory;
}

describe('bounded JSON loading', () => {
  it('loads JSON as inert data', () => {
    const root = temporaryDirectory();
    const marker = join(root, 'executed');
    writeFileSync(
      join(root, 'value.json'),
      JSON.stringify({ value: `$(touch ${marker})`, __proto__: 'inert' }),
    );

    expect(loadJsonFile(root, 'value.json')).toEqual({
      value: `$(touch ${marker})`,
    });
    expect(() => loadJsonFile(root, 'value.json')).not.toThrow();
    expect(existsSync(marker)).toBe(false);
  });

  it('rejects oversized JSON before parsing', () => {
    const root = temporaryDirectory();
    writeFileSync(
      join(root, 'large.json'),
      JSON.stringify('x'.repeat(300_000)),
    );

    expect(() => loadJsonFile(root, 'large.json')).toThrow(
      expect.objectContaining({ code: 'json.file-size' }),
    );
  });

  it('rejects excessive nesting and node counts', () => {
    const root = temporaryDirectory();
    const deep = `${'{"x":'.repeat(70)}null${'}'.repeat(70)}`;
    writeFileSync(join(root, 'deep.json'), deep);
    writeFileSync(
      join(root, 'many.json'),
      JSON.stringify(Array.from({ length: 50_001 }, () => null)),
    );

    expect(() => loadJsonFile(root, 'deep.json')).toThrow(
      expect.objectContaining({ code: 'json.structure' }),
    );
    expect(() => loadJsonFile(root, 'many.json')).toThrow(
      expect.objectContaining({ code: 'json.structure' }),
    );
  });

  it.each(['../escape.json', '/tmp/escape.json', 'nested/../escape.json'])(
    'rejects unsafe path %s',
    (unsafePath) => {
      const root = temporaryDirectory();

      expect(() => loadJsonFile(root, unsafePath)).toThrow(
        expect.objectContaining({ code: 'json.path' }),
      );
    },
  );

  it('rejects symlink escape', () => {
    const root = temporaryDirectory();
    const outside = temporaryDirectory();
    writeFileSync(join(outside, 'outside.json'), '{}');
    symlinkSync(join(outside, 'outside.json'), join(root, 'escape.json'));

    expect(() => loadJsonFile(root, 'escape.json')).toThrow(
      expect.objectContaining({ code: 'json.symlink' }),
    );
  });

  it('loads directory files in stable order and enforces file count', () => {
    const root = temporaryDirectory();
    mkdirSync(join(root, 'values'));
    writeFileSync(join(root, 'values', 'b.json'), '{"id":"b"}');
    writeFileSync(join(root, 'values', 'a.json'), '{"id":"a"}');

    expect(loadJsonDirectory(root, 'values')).toEqual([
      { path: 'values/a.json', value: { id: 'a' } },
      { path: 'values/b.json', value: { id: 'b' } },
    ]);

    expect(() =>
      loadJsonDirectory(root, 'values', { maximumFiles: 1 }),
    ).toThrow(expect.objectContaining({ code: 'json.file-count' }));
  });

  it('uses bounded safe diagnostics', () => {
    const error = new EvaluationBoundaryError(
      'json.test',
      `failure ${'x'.repeat(2_000)}`,
    );
    expect(error.message.length).toBeLessThanOrEqual(500);
  });
});
