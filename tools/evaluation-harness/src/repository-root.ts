import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const MAXIMUM_DIRECTORY_ASCENTS = 16;

export function findGitBlocksRoot(startDirectory: string): string {
  let directory = resolve(startDirectory);
  for (let depth = 0; depth <= MAXIMUM_DIRECTORY_ASCENTS; depth += 1) {
    try {
      const packageText = readFileSync(join(directory, 'package.json'), 'utf8');
      const packageValue = JSON.parse(packageText) as unknown;
      if (
        isRecord(packageValue) &&
        packageValue['name'] === 'gitblocks' &&
        packageValue['private'] === true
      ) {
        return directory;
      }
    } catch {
      // A non-root directory is expected during the bounded parent walk.
    }
    const parent = dirname(directory);
    if (parent === directory) {
      break;
    }
    directory = parent;
  }
  throw new Error('GitBlocks repository root could not be resolved.');
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
