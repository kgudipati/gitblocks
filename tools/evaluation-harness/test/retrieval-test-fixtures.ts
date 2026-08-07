import { createHash } from 'node:crypto';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import type { RetrievalCorpusManifest } from '../src/retrieval/contracts.ts';
import { retrievalCorpusSemanticDigest } from '../src/retrieval/corpus.ts';
import { retrievalStableJson } from '../src/retrieval/stable-json.ts';
import { findGitBlocksRoot } from '../src/repository-root.ts';

export function createRetrievalRepositoryFixture(): string {
  const source = findGitBlocksRoot(process.cwd());
  const root = mkdtempSync(join(tmpdir(), 'gitblocks-retrieval-corpus-'));
  copyDirectory(source, root, 'evals/retrieval-v1');
  copyDirectory(source, root, 'schemas/evaluation/retrieval');
  copyFile(source, root, 'catalog/capability-taxonomy/1.0.0/manifest.json');
  copyFile(source, root, 'catalog/public-v1/candidate-profile-authority.json');
  return root;
}

export function readFixtureJson(
  repositoryRoot: string,
  relativePath: string,
): unknown {
  return JSON.parse(
    readFileSync(join(repositoryRoot, relativePath), 'utf8'),
  ) as unknown;
}

export function writeFixtureJson(
  repositoryRoot: string,
  relativePath: string,
  value: unknown,
): void {
  writeFileSync(
    join(repositoryRoot, relativePath),
    retrievalStableJson(value),
    'utf8',
  );
}

export function mutateRetrievalDocument(
  repositoryRoot: string,
  corpusPath: string,
  mutate: (value: Record<string, unknown>) => Record<string, unknown>,
): void {
  const relativePath = `evals/retrieval-v1/${corpusPath}`;
  const changed = mutate(
    readFixtureJson(repositoryRoot, relativePath) as Record<string, unknown>,
  );
  writeFixtureJson(repositoryRoot, relativePath, changed);
  const manifestPath = 'evals/retrieval-v1/manifest.json';
  const manifest = readFixtureJson(
    repositoryRoot,
    manifestPath,
  ) as RetrievalCorpusManifest;
  const bytes = readFileSync(join(repositoryRoot, relativePath));
  const files = manifest.files.map((entry) =>
    entry.path === corpusPath
      ? {
          ...entry,
          sha256: createHash('sha256').update(bytes).digest('hex'),
        }
      : entry,
  );
  const withoutDigest = { ...manifest, files };
  const closed = {
    ...withoutDigest,
    corpusSemanticDigest: retrievalCorpusSemanticDigest(withoutDigest),
  };
  writeFixtureJson(repositoryRoot, manifestPath, closed);
}

export function mutateRetrievalManifest(
  repositoryRoot: string,
  mutate: (value: RetrievalCorpusManifest) => RetrievalCorpusManifest,
  reDigest = true,
): void {
  const path = 'evals/retrieval-v1/manifest.json';
  const changed = mutate(
    readFixtureJson(repositoryRoot, path) as RetrievalCorpusManifest,
  );
  writeFixtureJson(
    repositoryRoot,
    path,
    reDigest
      ? {
          ...changed,
          corpusSemanticDigest: retrievalCorpusSemanticDigest(changed),
        }
      : changed,
  );
}

function copyDirectory(
  source: string,
  target: string,
  relativePath: string,
): void {
  const destination = join(target, relativePath);
  mkdirSync(dirname(destination), { recursive: true });
  cpSync(join(source, relativePath), destination, { recursive: true });
}

function copyFile(source: string, target: string, relativePath: string): void {
  const destination = join(target, relativePath);
  mkdirSync(dirname(destination), { recursive: true });
  cpSync(join(source, relativePath), destination);
}
