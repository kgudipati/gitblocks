import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('retrieval evaluation architecture', () => {
  it('keeps retrieval evaluation out of product schema roots and product imports', () => {
    const contractCatalog = readFileSync(
      new URL(
        '../../../packages/contracts/src/schema-catalog.ts',
        import.meta.url,
      ),
      'utf8',
    );
    const productIndex = readFileSync(
      new URL('../../../packages/contracts/src/index.ts', import.meta.url),
      'utf8',
    );
    expect(contractCatalog).not.toContain('retrieval-evaluation');
    expect(productIndex).not.toContain('evals/retrieval-v1');
  });

  it('keeps product sources independent from retrieval evaluation authority', () => {
    const root = new URL('../../..', import.meta.url).pathname;
    const productText = [join(root, 'packages'), join(root, 'apps')]
      .flatMap(sourceFiles)
      .map((path) => readFileSync(path, 'utf8'))
      .join('\n');
    expect(productText).not.toContain('evals/retrieval-v1');
    expect(productText).not.toContain('schemas/evaluation/retrieval');
    expect(productText).not.toContain('evaluation-harness/src/retrieval');
  });

  it('keeps the retrieval harness offline and outside ingestion, Phase 7, models, and baselines', () => {
    const root = new URL('../src/retrieval', import.meta.url).pathname;
    const text = sourceFiles(root)
      .map((path) => readFileSync(path, 'utf8'))
      .join('\n');
    for (const forbidden of [
      '@gitblocks/ingestion',
      'process.env',
      'node:http',
      'node:https',
      'node:net',
      'repository-interviews-v1',
      'CandidateDossier',
      'model-provider',
      'baseline-report',
    ]) {
      expect(text).not.toContain(forbidden);
    }
    expect(readFileSync(join(root, 'normalization.ts'), 'utf8')).not.toContain(
      'gold/',
    );
    expect(readFileSync(join(root, 'scoring.ts'), 'utf8')).not.toContain(
      'writeFile',
    );
  });

  it('leaves pilot-v1 and repository-interviews-v1 byte-identical', () => {
    const root = new URL('../../..', import.meta.url).pathname;
    expect(directoryDigest(join(root, 'evals/pilot-v1'))).toBe(
      'b8a744a34e133ad4f4ecf34fd5c3ee7c2cd65be23ae75c76390f8d3f11390e96',
    );
    expect(directoryDigest(join(root, 'evals/repository-interviews-v1'))).toBe(
      '98182f594efad339e8099df7c4cd5d6d38e18ac380ea390d60ec39a977e2b62b',
    );
  });

  it('leaves accepted taxonomy, catalog, profile authority, coverage, and profile implementations byte-identical', () => {
    const root = new URL('../../..', import.meta.url).pathname;
    const expected = {
      'catalog/capability-taxonomy/1.0.0/source.json':
        'abad6b37466be5a0704f9d397359c7cd033d4776b8a8de662fa406f4ecf0cfa1',
      'catalog/capability-taxonomy/1.0.0/manifest.json':
        '66d328c04d060e62aa9480c3f5a564334969a3c6421d8b3a51e52a21051e77ba',
      'catalog/public-v1/candidates.json':
        '07d572ceaeb760acc7443b4d1736e77a6790018bb7a7fae9e006b6f2cd59446f',
      'catalog/public-v1/manifest.json':
        '1209e94d17041691d9766eeedb699bc5303ec075d166eb7ef4dff9e35d112f94',
      'catalog/public-v1/candidate-profile-authority.json':
        '20394e3e7cbec698714f41bdb35d6073e17d9eb2e82d121b952d539cddc8be8d',
      'verification/retrieval-v1/profile-coverage.json':
        'e40137bc8b1e8b978a4e3008b876d1a284de0eca61daeda841c6492bdb24eaf8',
      'packages/ingestion/src/candidate-profile-projection.ts':
        'b7a8146372bb0077b3591d03c2cd5a29cd77b5b101ac570b89f50e329b8dbf68',
      'packages/ingestion/src/profile.ts':
        '80322be6a7562d2afdfc86e931bdcab2b927fe74153b57be03bbf927ae37b4b7',
      'packages/domain/src/deterministic-candidate-profile.ts':
        'c019b67b3a436f64fc440b0152bfc98f575ae1d6fa62ae5479b5257e3462dbce',
      'packages/contracts/src/deterministic-candidate-profile-contracts.ts':
        '980481c2d833c764d62817aed8beb628d84886936b3f814d52d435cb97b1c813',
      'packages/contracts/src/deterministic-candidate-profile-schemas.ts':
        'ab7ce453bc40b7be70e97dbfa9ae5465113d4878b05e68b641523ea7d1d8f2ee',
    } as const;
    for (const [path, digest] of Object.entries(expected)) {
      expect(fileDigest(join(root, path)), path).toBe(digest);
    }
  });
});

function sourceFiles(root: string): string[] {
  return readdirSync(root)
    .sort()
    .flatMap((name) => {
      const path = join(root, name);
      return statSync(path).isDirectory()
        ? sourceFiles(path)
        : /[.](?:mjs|ts)$/u.test(name)
          ? [path]
          : [];
    });
}

function directoryDigest(root: string): string {
  const digest = createHash('sha256');
  for (const path of allFiles(root)) {
    digest.update(relative(root, path));
    digest.update('\0');
    digest.update(
      createHash('sha256').update(readFileSync(path)).digest('hex'),
    );
    digest.update('\n');
  }
  return digest.digest('hex');
}

function fileDigest(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function allFiles(root: string): string[] {
  return readdirSync(root)
    .sort()
    .flatMap((name) => {
      const path = join(root, name);
      return statSync(path).isDirectory() ? allFiles(path) : [path];
    });
}
