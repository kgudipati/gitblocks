import { canonicalizeJson } from './canonical-json.ts';
import { ingestionError } from './errors.ts';
import {
  isRecord,
  parseBoundedJson,
  type JsonBounds,
} from './json-boundary.ts';
import type {
  ArtifactKind,
  ArtifactRequirement,
  ArtifactSelection,
  ArtifactSelectionSource,
  PathArtifactSelection,
  PublicArtifactManifest,
  PublicCatalog,
} from './types.ts';

const ARTIFACT_MANIFEST_BOUNDS: JsonBounds = {
  maximumBytes: 512 * 1_024,
  maximumDepth: 10,
  maximumNodes: 5_000,
};

const ARTIFACT_KINDS = new Set<ArtifactKind>([
  'readme',
  'documentation',
  'security-policy',
  'changelog',
  'license',
  'contributing',
]);

const PATH_ARTIFACT_KINDS = new Set<Exclude<ArtifactKind, 'readme'>>([
  'documentation',
  'security-policy',
  'changelog',
  'license',
  'contributing',
]);

const REQUIREMENTS = new Set<ArtifactRequirement>(['required', 'optional']);

const SUPPORTED_EXTENSIONS = new Set([
  '.md',
  '.markdown',
  '.mdown',
  '.mkd',
  '.mdx',
  '.rst',
  '.adoc',
  '.asciidoc',
  '.txt',
]);

const SUPPORTED_EXTENSIONLESS_NAMES = new Set([
  'CHANGELOG',
  'CHANGES',
  'CONTRIBUTING',
  'COPYING',
  'LICENSE',
  'NOTICE',
  'README',
  'SECURITY',
]);

const MANIFEST_ROOT_KEYS = [
  'artifactManifestVersion',
  'candidates',
  'catalogDigest',
  'catalogVersion',
  'manifestDigest',
] as const;

const SOURCE_ROOT_KEYS = ['artifactManifestVersion', 'candidates'] as const;
const CANDIDATE_KEYS = ['candidateId', 'selections'] as const;
const ROOT_SELECTION_KEYS = [
  'artifactKind',
  'requirement',
  'selectionId',
  'selector',
] as const;
const PATH_SELECTION_KEYS = [
  'artifactKind',
  'path',
  'rationale',
  'requirement',
  'selectionId',
  'selector',
] as const;
const SOURCE_SELECTION_KEYS = [
  'artifactKind',
  'path',
  'rationale',
  'requirement',
] as const;

export function parsePublicArtifactManifest(
  text: string,
  catalog: PublicCatalog,
): PublicArtifactManifest {
  const parsed = parseBoundedJson(
    text,
    ARTIFACT_MANIFEST_BOUNDS,
    'ingestion.invalid-manifest',
  );
  if (!isRecord(parsed)) {
    throw ingestionError('ingestion.invalid-manifest');
  }
  requireExactKeys(parsed, MANIFEST_ROOT_KEYS);
  if (
    parsed['artifactManifestVersion'] !== 'public-artifacts-v1' ||
    parsed['catalogVersion'] !== catalog.catalogVersion ||
    parsed['catalogDigest'] !== catalog.manifestDigest ||
    !isDigest(parsed['manifestDigest']) ||
    !Array.isArray(parsed['candidates']) ||
    parsed['candidates'].length !== catalog.candidates.length
  ) {
    throw ingestionError('ingestion.invalid-manifest');
  }

  const candidates = parsed['candidates'].map(parseManifestCandidate);
  validateManifestCandidates(candidates, catalog);
  const manifest = {
    artifactManifestVersion: 'public-artifacts-v1' as const,
    catalogVersion: 'public-v1' as const,
    catalogDigest: parsed['catalogDigest'],
    candidates,
  };
  if (artifactManifestDigest(manifest) !== parsed['manifestDigest']) {
    throw ingestionError('ingestion.invalid-manifest');
  }
  return { ...manifest, manifestDigest: parsed['manifestDigest'] };
}

export function parseArtifactSelectionSource(
  text: string,
): ArtifactSelectionSource {
  const parsed = parseBoundedJson(
    text,
    ARTIFACT_MANIFEST_BOUNDS,
    'ingestion.invalid-manifest',
  );
  if (!isRecord(parsed)) {
    throw ingestionError('ingestion.invalid-manifest');
  }
  requireExactKeys(parsed, SOURCE_ROOT_KEYS);
  if (
    parsed['artifactManifestVersion'] !== 'public-artifacts-v1' ||
    !Array.isArray(parsed['candidates']) ||
    parsed['candidates'].length < 30 ||
    parsed['candidates'].length > 150
  ) {
    throw ingestionError('ingestion.invalid-manifest');
  }

  const candidates = parsed['candidates'].map((candidate) => {
    if (!isRecord(candidate)) {
      throw ingestionError('ingestion.invalid-manifest');
    }
    requireExactKeys(candidate, CANDIDATE_KEYS);
    if (
      !isStableId(candidate['candidateId']) ||
      !Array.isArray(candidate['selections']) ||
      candidate['selections'].length < 1 ||
      candidate['selections'].length > 3
    ) {
      throw ingestionError('ingestion.invalid-manifest');
    }
    const selections = candidate['selections'].map(parseSourceSelection);
    validatePathSelections(candidate['candidateId'], selections);
    return { candidateId: candidate['candidateId'], selections };
  });

  if (
    !isStrictlySorted(candidates.map(({ candidateId }) => candidateId)) ||
    new Set(candidates.map(({ candidateId }) => candidateId)).size !==
      candidates.length
  ) {
    throw ingestionError('ingestion.invalid-manifest');
  }
  return {
    artifactManifestVersion: 'public-artifacts-v1',
    candidates,
  };
}

export function buildArtifactManifest(
  catalog: PublicCatalog,
  source: ArtifactSelectionSource,
): PublicArtifactManifest {
  const catalogIds = new Set(
    catalog.candidates.map(({ candidateId }) => candidateId),
  );
  const sourceByCandidate = new Map(
    source.candidates.map((candidate) => [candidate.candidateId, candidate]),
  );
  if (
    source.candidates.some(({ candidateId }) => !catalogIds.has(candidateId))
  ) {
    throw ingestionError('ingestion.invalid-manifest');
  }

  const candidates = catalog.candidates.map(({ candidateId }) => {
    const rootDescriptor = {
      candidateId,
      selector: 'root-readme' as const,
      artifactKind: 'readme' as const,
      requirement: 'optional' as const,
    };
    const additional = sourceByCandidate.get(candidateId)?.selections ?? [];
    return {
      candidateId,
      selections: [
        {
          selectionId: selectionId(rootDescriptor),
          selector: 'root-readme' as const,
          artifactKind: 'readme' as const,
          requirement: 'optional' as const,
        },
        ...additional.map((selection) => {
          const descriptor = {
            candidateId,
            selector: 'path' as const,
            ...selection,
          };
          return {
            selectionId: selectionId(descriptor),
            selector: 'path' as const,
            ...selection,
          };
        }),
      ],
    };
  });
  const manifest = artifactManifestWithDigest({
    artifactManifestVersion: 'public-artifacts-v1',
    catalogVersion: catalog.catalogVersion,
    catalogDigest: catalog.manifestDigest,
    candidates,
  });
  return parsePublicArtifactManifest(JSON.stringify(manifest), catalog);
}

export function selectionId(descriptor: {
  readonly candidateId: string;
  readonly selector: 'root-readme' | 'path';
  readonly path?: string;
  readonly artifactKind: ArtifactKind;
  readonly requirement: ArtifactRequirement;
  readonly rationale?: string;
}): string {
  return `selection-${canonicalizeJson(descriptor).digest.slice(0, 48)}`;
}

export function artifactManifestDigest(
  manifest: Omit<PublicArtifactManifest, 'manifestDigest'>,
): string {
  return canonicalizeJson(manifest).digest;
}

export function artifactManifestWithDigest(
  manifest: Omit<PublicArtifactManifest, 'manifestDigest'>,
): PublicArtifactManifest {
  return { ...manifest, manifestDigest: artifactManifestDigest(manifest) };
}

export function isSafeArtifactPath(path: string): boolean {
  if (
    path.length === 0 ||
    Buffer.byteLength(path, 'utf8') > 512 ||
    path !== path.normalize('NFC') ||
    path.startsWith('/') ||
    path.endsWith('/') ||
    path.includes('\\') ||
    path.includes('%') ||
    path.includes('?') ||
    path.includes('#') ||
    /[\p{Cc}\p{Cf}]/u.test(path)
  ) {
    return false;
  }
  const segments = path.split('/');
  if (
    segments.length > 8 ||
    segments.some(
      (segment) =>
        segment.length === 0 ||
        segment === '.' ||
        segment === '..' ||
        segment.trim() !== segment,
    )
  ) {
    return false;
  }
  const leaf = segments.at(-1);
  if (leaf === undefined) {
    return false;
  }
  const dot = leaf.lastIndexOf('.');
  if (dot < 0) {
    return SUPPORTED_EXTENSIONLESS_NAMES.has(leaf.toUpperCase());
  }
  return SUPPORTED_EXTENSIONS.has(leaf.slice(dot).toLowerCase());
}

function parseManifestCandidate(value: unknown): {
  readonly candidateId: string;
  readonly selections: readonly ArtifactSelection[];
} {
  if (!isRecord(value)) {
    throw ingestionError('ingestion.invalid-manifest');
  }
  requireExactKeys(value, CANDIDATE_KEYS);
  if (
    !isStableId(value['candidateId']) ||
    !Array.isArray(value['selections']) ||
    value['selections'].length < 1 ||
    value['selections'].length > 4
  ) {
    throw ingestionError('ingestion.invalid-manifest');
  }
  const candidateId = value['candidateId'];
  const selections = value['selections'].map((selection) =>
    parseManifestSelection(candidateId, selection),
  );
  validateManifestSelections(candidateId, selections);
  return { candidateId, selections };
}

function parseManifestSelection(
  candidateId: string,
  value: unknown,
): ArtifactSelection {
  if (!isRecord(value)) {
    throw ingestionError('ingestion.invalid-manifest');
  }
  if (value['selector'] === 'root-readme') {
    requireExactKeys(value, ROOT_SELECTION_KEYS);
    const descriptor = {
      candidateId,
      selector: 'root-readme' as const,
      artifactKind: 'readme' as const,
      requirement: 'optional' as const,
    };
    if (
      value['artifactKind'] !== 'readme' ||
      value['requirement'] !== 'optional' ||
      value['selectionId'] !== selectionId(descriptor)
    ) {
      throw ingestionError('ingestion.invalid-manifest');
    }
    return {
      selectionId: value['selectionId'],
      selector: 'root-readme',
      artifactKind: 'readme',
      requirement: 'optional',
    };
  }
  if (value['selector'] !== 'path') {
    throw ingestionError('ingestion.invalid-manifest');
  }
  requireExactKeys(value, PATH_SELECTION_KEYS);
  const selection = parsePathSelection(value);
  const descriptor = {
    candidateId,
    selector: 'path' as const,
    ...selection,
  };
  if (value['selectionId'] !== selectionId(descriptor)) {
    throw ingestionError('ingestion.invalid-manifest');
  }
  return {
    selectionId: value['selectionId'],
    selector: 'path',
    ...selection,
  };
}

function parseSourceSelection(
  value: unknown,
): Omit<PathArtifactSelection, 'selectionId' | 'selector'> {
  if (!isRecord(value)) {
    throw ingestionError('ingestion.invalid-manifest');
  }
  requireExactKeys(value, SOURCE_SELECTION_KEYS);
  return parsePathSelection(value);
}

function parsePathSelection(
  value: Record<string, unknown>,
): Omit<PathArtifactSelection, 'selectionId' | 'selector'> {
  if (
    typeof value['path'] !== 'string' ||
    !isSafeArtifactPath(value['path']) ||
    typeof value['artifactKind'] !== 'string' ||
    !PATH_ARTIFACT_KINDS.has(
      value['artifactKind'] as Exclude<ArtifactKind, 'readme'>,
    ) ||
    typeof value['requirement'] !== 'string' ||
    !REQUIREMENTS.has(value['requirement'] as ArtifactRequirement) ||
    !isRationale(value['rationale'])
  ) {
    throw ingestionError('ingestion.invalid-manifest');
  }
  return {
    path: value['path'],
    artifactKind: value['artifactKind'] as Exclude<ArtifactKind, 'readme'>,
    requirement: value['requirement'] as ArtifactRequirement,
    rationale: value['rationale'],
  };
}

function validateManifestCandidates(
  candidates: PublicArtifactManifest['candidates'],
  catalog: PublicCatalog,
): void {
  if (
    !isStrictlySorted(candidates.map(({ candidateId }) => candidateId)) ||
    candidates.some(
      ({ candidateId }, index) =>
        candidateId !== catalog.candidates[index]?.candidateId,
    )
  ) {
    throw ingestionError('ingestion.invalid-manifest');
  }
  const additionalCandidateIds = new Set(
    candidates
      .filter(({ selections }) => selections.length > 1)
      .map(({ candidateId }) => candidateId),
  );
  if (additionalCandidateIds.size < 30) {
    throw ingestionError('ingestion.invalid-manifest');
  }
  for (const family of [
    'authorization',
    'audit-logging',
    'background-jobs',
    'rate-limiting',
    'webhooks',
  ] as const) {
    const count = catalog.candidates.filter(
      ({ candidateId, primaryCapabilityFamily }) =>
        primaryCapabilityFamily === family &&
        additionalCandidateIds.has(candidateId),
    ).length;
    if (count < 6) {
      throw ingestionError('ingestion.invalid-manifest');
    }
  }
}

function validateManifestSelections(
  candidateId: string,
  selections: readonly ArtifactSelection[],
): void {
  const [root, ...paths] = selections;
  if (
    root?.selector !== 'root-readme' ||
    selections.filter(({ selector }) => selector === 'root-readme').length !==
      1 ||
    new Set(selections.map(({ selectionId }) => selectionId)).size !==
      selections.length
  ) {
    throw ingestionError('ingestion.invalid-manifest');
  }
  validatePathSelections(
    candidateId,
    paths.map((selection) => {
      if (selection.selector !== 'path') {
        throw ingestionError('ingestion.invalid-manifest');
      }
      return {
        path: selection.path,
        artifactKind: selection.artifactKind,
        requirement: selection.requirement,
        rationale: selection.rationale,
      };
    }),
  );
}

function validatePathSelections(
  _candidateId: string,
  selections: readonly Omit<
    PathArtifactSelection,
    'selectionId' | 'selector'
  >[],
): void {
  const paths = selections.map(({ path }) => path);
  if (
    new Set(paths).size !== paths.length ||
    !isStrictlySorted(paths) ||
    selections.some(({ artifactKind }) => !ARTIFACT_KINDS.has(artifactKind))
  ) {
    throw ingestionError('ingestion.invalid-manifest');
  }
}

function isRationale(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length >= 40 &&
    value.length <= 300 &&
    value.trim() === value &&
    !/[\p{Cc}\p{Cf}]/u.test(value)
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

function isStrictlySorted(values: readonly string[]): boolean {
  return values.every((value, index) => {
    const prior = values[index - 1];
    return prior === undefined || compareCodePoints(prior, value) < 0;
  });
}

function compareCodePoints(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function requireExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): void {
  const actual = Object.keys(value).sort(compareCodePoints);
  const sortedExpected = [...expected].sort(compareCodePoints);
  if (
    actual.length !== sortedExpected.length ||
    actual.some((key, index) => key !== sortedExpected[index])
  ) {
    throw ingestionError('ingestion.invalid-manifest');
  }
}
