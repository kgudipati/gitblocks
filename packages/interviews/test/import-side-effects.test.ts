import { describe, expect, it, vi } from 'vitest';

const readFile = vi.fn();
const writeFile = vi.fn();
const mkdir = vi.fn();
const fetch = vi.fn();

vi.mock('node:fs/promises', () => ({
  readFile,
  writeFile,
  mkdir,
}));

describe('package import boundary', () => {
  it('performs no filesystem or network operation during import', async () => {
    vi.stubGlobal('fetch', fetch);
    await expect(import('../src/index.ts')).resolves.toBeDefined();
    expect(readFile).not.toHaveBeenCalled();
    expect(writeFile).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  }, 30_000);
});
