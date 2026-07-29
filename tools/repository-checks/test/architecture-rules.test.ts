import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

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
    ['contracts-outward', 'no-contracts-outward-dependency'],
    ['contracts-disallowed-package', 'no-contracts-outward-dependency'],
    ['product-to-tools', 'no-product-to-tools'],
    ['product-test-to-tools', 'no-product-to-tools'],
    ['product-to-evaluation', 'no-product-to-evaluation'],
    ['product-test-to-evaluation', 'no-product-to-evaluation'],
    ['product-to-outward-layer', 'no-product-to-outward-layer'],
    ['product-test-to-outward-layer', 'no-product-to-outward-layer'],
    ['production-to-evaluation-gold', 'no-production-to-evaluation-gold'],
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

  it('allows tools to consume contracts and contracts to consume only domain, Ajv, and TypeBox', () => {
    const sourceFixturePath = join(
      REPOSITORY_ROOT,
      'tools/repository-checks/architecture-fixtures/allowed-product-direction',
    );
    const temporaryRoot = mkdtempSync(
      join(tmpdir(), 'gitblocks-architecture-fixture-'),
    );
    const fixturePath = join(temporaryRoot, 'fixture');

    try {
      cpSync(sourceFixturePath, fixturePath, { recursive: true });
      writeFixturePackage(fixturePath, 'ajv', 'export default class Ajv {};\n');
      writeFixturePackage(
        fixturePath,
        'typebox',
        'export const Type = Object.freeze({});\n',
      );
      writeFixturePackage(
        fixturePath,
        'vitest',
        'export function describe() {}\n',
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

      expect(`${result.stdout}\n${result.stderr}`).not.toContain('error ');
      expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    } finally {
      rmSync(temporaryRoot, { force: true, recursive: true });
    }
  });
});

function writeFixturePackage(
  fixturePath: string,
  packageName: string,
  source: string,
): void {
  const packagePath = join(fixturePath, 'node_modules', packageName);
  mkdirSync(packagePath, { recursive: true });
  writeFileSync(
    join(packagePath, 'package.json'),
    JSON.stringify({
      name: packageName,
      version: packageName === 'ajv' ? '8.20.0' : '1.3.8',
      type: 'module',
      module: './build/index.mjs',
      exports: {
        '.': {
          import: './build/index.mjs',
          default: './build/index.mjs',
        },
      },
    }),
    'utf8',
  );
  mkdirSync(join(packagePath, 'build'), { recursive: true });
  writeFileSync(join(packagePath, 'build/index.mjs'), source, 'utf8');
}
