import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { canonicalizeJson, parsePublicCatalog } from '../src/index.ts';
import type { PublicCatalog } from '../src/index.ts';

const sourcePath = fileURLToPath(
  new URL('../../../catalog/public-v1/candidates.json', import.meta.url),
);
const manifestPath = fileURLToPath(
  new URL('../../../catalog/public-v1/manifest.json', import.meta.url),
);

const sourceText = await readFile(sourcePath, 'utf8');
const generated = buildCatalog(JSON.parse(sourceText) as unknown);

if (process.argv.includes('--write')) {
  await writeFile(manifestPath, `${JSON.stringify(generated, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'w',
  });
  process.stdout.write(
    `Public catalog written (${String(generated.candidates.length)} candidates; ${generated.manifestDigest}).\n`,
  );
} else {
  const committedText = await readFile(manifestPath, 'utf8');
  const committed = parsePublicCatalog(committedText);
  if (
    canonicalizeJson(committed).digest !== canonicalizeJson(generated).digest
  ) {
    throw new Error(
      'Committed public catalog does not match its curated candidate source.',
    );
  }
  const familyCounts = Object.fromEntries(
    [
      'authorization',
      'audit-logging',
      'background-jobs',
      'rate-limiting',
      'webhooks',
    ].map((family) => [
      family,
      committed.candidates.filter(
        (candidate) => candidate.primaryCapabilityFamily === family,
      ).length,
    ]),
  );
  process.stdout.write(
    `Public catalog valid (${String(committed.candidates.length)} candidates; ${JSON.stringify(familyCounts)}; ${committed.manifestDigest}).\n`,
  );
}

function buildCatalog(value: unknown): PublicCatalog {
  if (!Array.isArray(value)) {
    throw new Error('Curated candidate source must be an array.');
  }
  const sourceCandidates: readonly unknown[] = value;
  const candidates = sourceCandidates
    .map((entry) => {
      if (
        typeof entry !== 'object' ||
        entry === null ||
        Array.isArray(entry) ||
        typeof (entry as Record<string, unknown>)['candidateId'] !== 'string'
      ) {
        throw new Error('Curated candidate source entry is invalid.');
      }
      return entry as Record<string, unknown>;
    })
    .sort((left, right) =>
      String(left['candidateId']).localeCompare(String(right['candidateId'])),
    );
  const catalog = {
    catalogVersion: 'public-v1',
    publishedAt: '2026-07-29T00:00:00.000Z',
    candidates,
  };
  const generated = {
    ...catalog,
    manifestDigest: canonicalizeJson(catalog).digest,
  };
  return parsePublicCatalog(JSON.stringify(generated));
}
