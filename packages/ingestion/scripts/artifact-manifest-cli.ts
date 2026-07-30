import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import {
  buildArtifactManifest,
  canonicalizeJson,
  parseArtifactSelectionSource,
  parsePublicArtifactManifest,
  parsePublicCatalog,
} from '../src/index.ts';

const catalogPath = fileURLToPath(
  new URL('../../../catalog/public-v1/manifest.json', import.meta.url),
);
const sourcePath = fileURLToPath(
  new URL(
    '../../../catalog/public-v1/artifact-selections.json',
    import.meta.url,
  ),
);
const manifestPath = fileURLToPath(
  new URL('../../../catalog/public-v1/artifact-manifest.json', import.meta.url),
);

const catalog = parsePublicCatalog(await readFile(catalogPath, 'utf8'));
const source = parseArtifactSelectionSource(await readFile(sourcePath, 'utf8'));
const generated = buildArtifactManifest(catalog, source);

if (process.argv.includes('--write')) {
  await writeFile(manifestPath, `${JSON.stringify(generated, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'w',
  });
} else {
  const committed = parsePublicArtifactManifest(
    await readFile(manifestPath, 'utf8'),
    catalog,
  );
  if (
    canonicalizeJson(committed).digest !== canonicalizeJson(generated).digest
  ) {
    throw new Error(
      'Committed public artifact manifest does not match its curator source.',
    );
  }
}

const additionalCandidates = generated.candidates.filter(
  ({ selections }) => selections.length > 1,
);
const familyCounts = Object.fromEntries(
  [
    'authorization',
    'audit-logging',
    'background-jobs',
    'rate-limiting',
    'webhooks',
  ].map((family) => {
    const familyCandidateIds = new Set(
      catalog.candidates
        .filter(
          ({ primaryCapabilityFamily }) => primaryCapabilityFamily === family,
        )
        .map(({ candidateId }) => candidateId),
    );
    return [
      family,
      additionalCandidates.filter(({ candidateId }) =>
        familyCandidateIds.has(candidateId),
      ).length,
    ];
  }),
);

process.stdout.write(
  `Public artifact manifest ${process.argv.includes('--write') ? 'written' : 'valid'} ` +
    `(${String(generated.candidates.length)} candidates; ` +
    `${String(generated.candidates.length)} root README attempts; ` +
    `${String(additionalCandidates.length)} additional-path candidates; ` +
    `${JSON.stringify(familyCounts)}; ${generated.manifestDigest}).\n`,
);
