import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import {
  canonicalizeJson,
  manifestWithDigest,
  parsePublicCatalog,
  type CatalogCandidate,
  type PublicCatalog,
} from '../src/index.ts';

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

interface CuratedSourceCandidate {
  readonly candidateId: string;
  readonly displayName: string;
  readonly family: CatalogCandidate['primaryCapabilityFamily'];
  readonly owner: string;
  readonly repository: string;
  readonly npm: string | null;
  readonly status: CatalogCandidate['status'];
}

function buildCatalog(value: unknown): PublicCatalog {
  if (!Array.isArray(value)) {
    throw new Error('Curated candidate source must be an array.');
  }
  const candidates = value
    .map(parseSourceCandidate)
    .sort((left, right) => left.candidateId.localeCompare(right.candidateId))
    .map(expandCandidate);
  return manifestWithDigest({
    catalogVersion: 'public-v1',
    publishedAt: '2026-07-29T00:00:00.000Z',
    candidates,
  });
}

function parseSourceCandidate(value: unknown): CuratedSourceCandidate {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Curated candidate source entry is invalid.');
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  if (
    keys.join(',') !==
    'candidateId,displayName,family,npm,owner,repository,status'
  ) {
    throw new Error('Curated candidate source entry is not closed.');
  }
  if (
    typeof record['candidateId'] !== 'string' ||
    typeof record['displayName'] !== 'string' ||
    typeof record['owner'] !== 'string' ||
    typeof record['repository'] !== 'string' ||
    (record['npm'] !== null && typeof record['npm'] !== 'string') ||
    ![
      'authorization',
      'audit-logging',
      'background-jobs',
      'rate-limiting',
      'webhooks',
    ].includes(String(record['family'])) ||
    !['active', 'archived', 'moved', 'negative-control'].includes(
      String(record['status']),
    )
  ) {
    throw new Error('Curated candidate source entry has invalid fields.');
  }
  return {
    candidateId: record['candidateId'],
    displayName: record['displayName'],
    family: record['family'] as CuratedSourceCandidate['family'],
    owner: record['owner'],
    repository: record['repository'],
    npm: record['npm'],
    status: record['status'] as CuratedSourceCandidate['status'],
  };
}

function expandCandidate(source: CuratedSourceCandidate): CatalogCandidate {
  const repositoryUrl = `https://github.com/${source.owner}/${source.repository}`;
  const npmUrl =
    source.npm === null
      ? null
      : `https://www.npmjs.com/package/${encodeURIComponent(source.npm)}`;
  return {
    candidateId: source.candidateId,
    displayName: source.displayName,
    github: { owner: source.owner, repository: source.repository },
    npmPackage: source.npm,
    primaryCapabilityFamily: source.family,
    additionalCapabilityFamilies: [],
    rationale:
      source.status === 'negative-control'
        ? `Curated negative control for ${source.family}; public metadata can distinguish adjacent functionality from direct capability evidence.`
        : source.status === 'archived'
          ? `Curated archived ${source.family} control for deterministic lifecycle and limitation handling.`
          : source.status === 'moved'
            ? `Curated moved-project ${source.family} control whose current canonical provider identity remains authoritative.`
            : `Curated public ${source.family} candidate spanning the V1 mix of libraries, integrations, and self-hostable services.`,
    selectionSources:
      npmUrl === null ? [repositoryUrl] : [repositoryUrl, npmUrl],
    expectedSourceTypes:
      source.npm === null
        ? ['github-release', 'github-repository']
        : [
            'github-advisory',
            'github-file',
            'github-release',
            'github-repository',
            'npm-package',
          ],
    status: source.status,
    allowlistedFiles: source.npm === null ? [] : ['package.json'],
  };
}
