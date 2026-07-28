import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import { describe, expect, it } from 'vitest';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const DEPENDENCY_CRUISER_BIN = join(
  REPOSITORY_ROOT,
  'node_modules',
  'dependency-cruiser',
  'bin',
  'dependency-cruise.mjs',
);
const DEPENDENCY_CRUISER_CONFIG = join(
  REPOSITORY_ROOT,
  'dependency-cruiser.config.mjs',
);

describe('dependency-cruiser architecture rules', () => {
  it.each([
    ['circular', 'no-circular'],
    ['unresolved', 'no-unresolved'],
    ['production-to-test', 'no-production-to-test'],
    ['production-to-dev', 'no-production-to-dev-dependency'],
    ['domain-outward', 'no-domain-outward-dependency'],
    ['product-to-tools', 'no-product-to-tools'],
    ['deep-workspace-import', 'no-deep-workspace-import'],
  ] as const)('rejects the %s fixture with %s', (fixture, ruleName) => {
    const fixturePath = join(
      REPOSITORY_ROOT,
      'tools/repository-checks/architecture-fixtures',
      fixture,
    );
    const result = spawnSync(
      process.execPath,
      [
        DEPENDENCY_CRUISER_BIN,
        '--config',
        DEPENDENCY_CRUISER_CONFIG,
        '--output-type',
        'err',
        '.',
      ],
      {
        cwd: fixturePath,
        encoding: 'utf8',
      },
    );

    expect(result.status, result.stderr).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain(`error ${ruleName}`);
  });
});
