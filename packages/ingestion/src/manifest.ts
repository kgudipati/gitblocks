import { canonicalizeJson } from './canonical-json.ts';
import { ingestionError } from './errors.ts';
import {
  isRecord,
  parseBoundedJson,
  type JsonBounds,
} from './json-boundary.ts';
import {
  CAPABILITY_FAMILIES,
  type CatalogCandidate,
  type CapabilityFamily,
  type PublicCatalog,
} from './types.ts';

const MANIFEST_BOUNDS: JsonBounds = {
  maximumBytes: 2 * 1_024 * 1_024,
  maximumDepth: 12,
  maximumNodes: 20_000,
};

const ROOT_KEYS = [
  'candidates',
  'catalogVersion',
  'manifestDigest',
  'publishedAt',
] as const;

const CANDIDATE_KEYS = [
  'additionalCapabilityFamilies',
  'allowlistedFiles',
  'candidateId',
  'displayName',
  'expectedSourceTypes',
  'github',
  'introducedAt',
  'npmPackage',
  'primaryCapabilityFamily',
  'rationale',
  'selectionSources',
  'status',
] as const;

const EXPECTED_SOURCE_TYPES = new Set([
  'github-repository',
  'github-release',
  'github-tag',
  'github-license',
  'github-community',
  'github-file',
  'npm-package',
  'github-advisory',
]);

const ALLOWLISTED_FILES = new Set([
  'SECURITY.md',
  'LICENSE',
  'LICENSE.md',
  'LICENSE.txt',
  'package.json',
]);

export function parsePublicCatalog(text: string): PublicCatalog {
  const parsed = parseBoundedJson(
    text,
    MANIFEST_BOUNDS,
    'ingestion.invalid-manifest',
  );
  if (!isRecord(parsed)) {
    throw ingestionError('ingestion.invalid-manifest');
  }
  requireExactKeys(parsed, ROOT_KEYS);
  if (
    parsed['catalogVersion'] !== 'public-v1' ||
    !isTimestamp(parsed['publishedAt']) ||
    !isDigest(parsed['manifestDigest']) ||
    !Array.isArray(parsed['candidates']) ||
    parsed['candidates'].length < 100 ||
    parsed['candidates'].length > 200
  ) {
    throw ingestionError('ingestion.invalid-manifest');
  }

  const candidates = parsed['candidates'].map(parseCandidate);
  validateCatalogSet(candidates, parsed['publishedAt']);
  const expectedDigest = digestCatalog({
    catalogVersion: 'public-v1',
    publishedAt: parsed['publishedAt'],
    candidates,
  });
  if (expectedDigest !== parsed['manifestDigest']) {
    throw ingestionError('ingestion.invalid-manifest');
  }

  return {
    catalogVersion: 'public-v1',
    publishedAt: new Date(parsed['publishedAt']).toISOString(),
    manifestDigest: parsed['manifestDigest'],
    candidates,
  };
}

export function digestCatalog(
  catalog: Omit<PublicCatalog, 'manifestDigest'>,
): string {
  return canonicalizeJson(catalog).digest;
}

export function manifestWithDigest(
  catalog: Omit<PublicCatalog, 'manifestDigest'>,
): PublicCatalog {
  return { ...catalog, manifestDigest: digestCatalog(catalog) };
}

function parseCandidate(value: unknown): CatalogCandidate {
  if (!isRecord(value)) {
    throw ingestionError('ingestion.invalid-manifest');
  }
  requireExactKeys(value, CANDIDATE_KEYS);
  if (
    !isStableId(value['candidateId']) ||
    !isBoundedText(value['displayName'], 160) ||
    !isTimestamp(value['introducedAt']) ||
    !isRecord(value['github']) ||
    !isCapabilityFamily(value['primaryCapabilityFamily']) ||
    !isBoundedText(value['rationale'], 320) ||
    value['rationale'].length < 20 ||
    (value['status'] !== 'active' &&
      value['status'] !== 'archived' &&
      value['status'] !== 'moved' &&
      value['status'] !== 'negative-control') ||
    !Array.isArray(value['additionalCapabilityFamilies']) ||
    !Array.isArray(value['selectionSources']) ||
    !Array.isArray(value['expectedSourceTypes']) ||
    !Array.isArray(value['allowlistedFiles'])
  ) {
    throw ingestionError('ingestion.invalid-manifest');
  }
  requireExactKeys(value['github'], ['owner', 'repository']);
  const owner = value['github']['owner'];
  const repository = value['github']['repository'];
  if (!isRepositoryPart(owner) || !isRepositoryPart(repository)) {
    throw ingestionError('ingestion.invalid-manifest');
  }
  const additional = value['additionalCapabilityFamilies'];
  if (
    additional.some((family) => !isCapabilityFamily(family)) ||
    !isSortedUnique(additional) ||
    additional.includes(value['primaryCapabilityFamily'])
  ) {
    throw ingestionError('ingestion.invalid-manifest');
  }
  const selectionSources = value['selectionSources'];
  if (
    selectionSources.length < 1 ||
    selectionSources.length > 3 ||
    selectionSources.some((source) => !isSelectionSource(source)) ||
    !isSortedUnique(selectionSources)
  ) {
    throw ingestionError('ingestion.invalid-manifest');
  }
  const validatedSelectionSources = selectionSources as string[];
  const repositorySelectionPrefix =
    `https://github.com/${owner}/${repository}/`.toLowerCase();
  if (
    !validatedSelectionSources.some((source) =>
      source.toLowerCase().startsWith(repositorySelectionPrefix),
    )
  ) {
    throw ingestionError('ingestion.invalid-manifest');
  }
  const expectedSourceTypes = value['expectedSourceTypes'];
  if (
    expectedSourceTypes.length < 1 ||
    expectedSourceTypes.length > 8 ||
    expectedSourceTypes.some(
      (sourceType) =>
        typeof sourceType !== 'string' ||
        !EXPECTED_SOURCE_TYPES.has(sourceType),
    ) ||
    !isSortedUnique(expectedSourceTypes) ||
    !expectedSourceTypes.includes('github-repository') ||
    isGenericRationale(value['rationale']) ||
    !value['rationale']
      .toLowerCase()
      .includes(value['displayName'].toLowerCase())
  ) {
    throw ingestionError('ingestion.invalid-manifest');
  }
  const npmPackage = value['npmPackage'];
  if (npmPackage !== null && !isNpmPackage(npmPackage)) {
    throw ingestionError('ingestion.invalid-manifest');
  }
  if (
    (npmPackage === null && expectedSourceTypes.includes('npm-package')) ||
    (npmPackage !== null && !expectedSourceTypes.includes('npm-package')) ||
    (expectedSourceTypes.includes('github-advisory') &&
      !expectedSourceTypes.includes('npm-package'))
  ) {
    throw ingestionError('ingestion.invalid-manifest');
  }
  const allowlistedFiles = value['allowlistedFiles'];
  if (
    allowlistedFiles.length > 3 ||
    allowlistedFiles.some((path) => !isAllowlistedPath(path)) ||
    !isSortedUnique(allowlistedFiles) ||
    (allowlistedFiles.length === 0 &&
      expectedSourceTypes.includes('github-file')) ||
    (allowlistedFiles.length > 0 &&
      !expectedSourceTypes.includes('github-file'))
  ) {
    throw ingestionError('ingestion.invalid-manifest');
  }

  return {
    candidateId: value['candidateId'],
    displayName: value['displayName'],
    introducedAt: new Date(value['introducedAt']).toISOString(),
    github: { owner, repository },
    npmPackage,
    primaryCapabilityFamily: value['primaryCapabilityFamily'],
    additionalCapabilityFamilies: additional as CapabilityFamily[],
    rationale: value['rationale'],
    selectionSources: validatedSelectionSources,
    expectedSourceTypes:
      expectedSourceTypes as CatalogCandidate['expectedSourceTypes'],
    status: value['status'],
    allowlistedFiles: allowlistedFiles as string[],
  };
}

function validateCatalogSet(
  candidates: readonly CatalogCandidate[],
  publishedAt: string,
): void {
  const identifiers = new Set<string>();
  const repositories = new Set<string>();
  const packages = new Set<string>();
  const counts = new Map<CapabilityFamily, number>(
    CAPABILITY_FAMILIES.map((family) => [family, 0]),
  );
  let previous = '';
  for (const candidate of candidates) {
    const candidateKey = candidate.candidateId.toLowerCase();
    const repositoryKey =
      `${candidate.github.owner}/${candidate.github.repository}`.toLowerCase();
    const packageKey = candidate.npmPackage?.toLowerCase();
    if (
      Date.parse(candidate.introducedAt) > Date.parse(publishedAt) ||
      candidate.candidateId.localeCompare(previous) <= 0 ||
      identifiers.has(candidateKey) ||
      repositories.has(repositoryKey) ||
      (packageKey !== undefined && packages.has(packageKey))
    ) {
      throw ingestionError('ingestion.invalid-manifest');
    }
    previous = candidate.candidateId;
    identifiers.add(candidateKey);
    repositories.add(repositoryKey);
    if (packageKey !== undefined) {
      packages.add(packageKey);
    }
    counts.set(
      candidate.primaryCapabilityFamily,
      (counts.get(candidate.primaryCapabilityFamily) ?? 0) + 1,
    );
  }
  if (CAPABILITY_FAMILIES.some((family) => (counts.get(family) ?? 0) < 20)) {
    throw ingestionError('ingestion.invalid-manifest');
  }
}

function requireExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): void {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  if (
    actual.length !== sortedExpected.length ||
    actual.some((key, index) => key !== sortedExpected[index])
  ) {
    throw ingestionError('ingestion.invalid-manifest');
  }
}

function isTimestamp(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}

function isDigest(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
}

function isStableId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/u.test(value)
  );
}

function isBoundedText(value: unknown, maximum: number): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= maximum &&
    !hasControlCharacter(value)
  );
}

function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 31 || code === 127) {
      return true;
    }
  }
  return false;
}

function isRepositoryPart(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 100 &&
    /^[A-Za-z0-9_.-]+$/u.test(value) &&
    value !== '.' &&
    value !== '..'
  );
}

function isNpmPackage(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= 201 &&
    /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/u.test(value)
  );
}

function isSelectionSource(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2_048) {
    return false;
  }
  try {
    const url = new URL(value);
    const isGitHubClassificationSource =
      url.hostname === 'github.com' &&
      /^\/[^/]+\/[^/]+\/(?:blob|tree)\/[^/]+\/.+/u.test(url.pathname);
    const isNpmClassificationSource =
      url.hostname === 'www.npmjs.com' &&
      /^\/package\/[^/]+(?:\/[^/]+)?(?:\/v\/[^/]+)?$/u.test(url.pathname);
    return (
      url.protocol === 'https:' &&
      url.username === '' &&
      url.password === '' &&
      url.port === '' &&
      (isGitHubClassificationSource || isNpmClassificationSource)
    );
  } catch {
    return false;
  }
}

function isGenericRationale(value: string): boolean {
  const normalized = value.toLowerCase();
  return (
    normalized.includes('spanning the v1 mix') ||
    normalized.includes('official project material describes') ||
    normalized.includes('curated public candidate') ||
    normalized.includes('curated negative control for') ||
    normalized.includes('curated archived') ||
    normalized.includes('curated moved-project')
  );
}

function isCapabilityFamily(value: unknown): value is CapabilityFamily {
  return CAPABILITY_FAMILIES.some((family) => family === value);
}

function isAllowlistedPath(value: unknown): value is string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > 120 ||
    value.includes('\\') ||
    value.includes('%') ||
    value.startsWith('/') ||
    value.endsWith('/') ||
    value
      .split('/')
      .some((segment) => segment === '' || segment === '.' || segment === '..')
  ) {
    return false;
  }
  if (ALLOWLISTED_FILES.has(value)) {
    return true;
  }
  const segments = value.split('/');
  return (
    segments.length === 2 &&
    segments[1] === 'package.json' &&
    /^[A-Za-z0-9_.-]+$/u.test(segments[0] ?? '')
  );
}

function isSortedUnique(values: readonly unknown[]): boolean {
  return values.every(
    (value, index) =>
      typeof value === 'string' &&
      (index === 0 || value.localeCompare(String(values[index - 1])) > 0),
  );
}
