import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
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
    expect(productIndex).not.toContain('evaluateCandidateConstraints');
    expect(productIndex).not.toContain(
      'evaluateCandidateConstraintProfileState',
    );
  });

  it('declares and uses the domain evaluator directly', () => {
    const root = new URL('../../..', import.meta.url).pathname;
    const manifest = JSON.parse(
      readFileSync(join(root, 'tools/evaluation-harness/package.json'), 'utf8'),
    ) as { dependencies: Record<string, string> };
    expect(manifest.dependencies['@gitblocks/domain']).toBe('workspace:0.0.0');
    const hardFilter = readFileSync(
      join(root, 'tools/evaluation-harness/src/retrieval/hard-filter.ts'),
      'utf8',
    );
    expect(hardFilter).toContain("from '@gitblocks/domain'");
    expect(hardFilter).not.toMatch(
      /evaluateCandidateConstraints[\s\S]*from '@gitblocks\/contracts'/u,
    );
  });

  it('keeps mechanical authoring from owning relevance or equivalence judgments', () => {
    const root = new URL('../../..', import.meta.url).pathname;
    const source = readFileSync(
      join(root, 'tools/evaluation-harness/scripts/author-retrieval-v1.mjs'),
      'utf8',
    );
    expect(source).not.toContain('familyDesign.anchor');
    expect(source).not.toMatch(/\banchor\s*:/u);
    expect(source).not.toContain('rmSync(corpusRoot');
    expect(source).not.toContain('write(\n    `gold/relevance/');
    expect(source).not.toContain("write('equivalence.json'");
    expect(source).toContain('registerExisting(\n    `gold/relevance/');
    expect(source).toContain("registerExisting('equivalence.json'");
    const registration = source.slice(
      source.indexOf('function registerExisting'),
      source.indexOf('function write(path'),
    );
    expect(registration).toContain('lstatSync');
    expect(registration).toContain('readFileSync');
    expect(registration).toContain('files.set');
    expect(registration).not.toContain('writeFile');
    expect(registration).not.toContain('rmSync');
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

  it('keeps the retrieval harness offline and outside ingestion, Phase 7, and models', () => {
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

  it('keeps the report evaluation-only and commits no prediction set', () => {
    const root = new URL('../../..', import.meta.url).pathname;
    const productSchemaCatalog = readFileSync(
      join(root, 'packages/contracts/src/schema-catalog.ts'),
      'utf8',
    );
    expect(productSchemaCatalog).not.toContain('baseline-report');
    expect(
      existsSync(
        join(root, 'schemas/evaluation/retrieval/baseline-report.schema.json'),
      ),
    ).toBe(true);
    const verificationFiles = readdirSync(
      join(root, 'verification/retrieval-v1'),
    ).sort();
    expect(verificationFiles).toEqual([
      'baseline-report.json',
      'profile-coverage.json',
    ]);
    expect(verificationFiles.join('\n')).not.toContain('prediction');
  });

  it('makes the blind loader the only permitted baseline-style input boundary', () => {
    const root = new URL('../src/retrieval', import.meta.url).pathname;
    const blindSource = readFileSync(join(root, 'blind-query.ts'), 'utf8');
    expect(blindSource).toContain('loadRetrievalBlindQuerySetV1');
    expect(blindSource).not.toContain('gold/');
    expect(blindSource).not.toContain('equivalence.json');
    expect(isPermittedBaselineStyleSource(blindSource)).toBe(true);
    expect(
      isPermittedBaselineStyleSource(
        "import { loadRetrievalCorpusV1 } from '../corpus.ts';",
      ),
    ).toBe(false);

    const futureBaselineRoot = join(root, 'baselines');
    if (existsSync(futureBaselineRoot)) {
      for (const path of sourceFiles(futureBaselineRoot)) {
        expect(
          isPermittedBaselineStyleSource(readFileSync(path, 'utf8')),
          path,
        ).toBe(true);
      }
    }
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
        '4dd72b224967f5bb886af51c9ca4bb7f71ba50a5608b781d26b261a30cda738f',
      'packages/ingestion/src/profile.ts':
        '735ae75a1509c9fa909bd1a97ff3d3be06bb628d4197561984924132290e92d9',
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

function isPermittedBaselineStyleSource(source: string): boolean {
  return (
    !source.includes('loadRetrievalCorpusV1') &&
    !source.includes("from '../corpus") &&
    !source.includes('gold/') &&
    !source.includes('equivalence.json')
  );
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
