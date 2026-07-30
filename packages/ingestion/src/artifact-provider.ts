import { TextDecoder } from 'node:util';

import {
  createRepositoryArtifactSetV1,
  createRepositoryArtifactV1,
  parseRepositoryArtifactSetV1,
  parseRepositoryArtifactV1,
  repositoryArtifactContentSha256,
  repositoryArtifactDisplayUrl,
  repositoryArtifactGitBlobObjectId,
  type RepositoryArtifactSetEntryV1,
  type RepositoryArtifactV1,
} from '@gitblocks/contracts';
import type {
  PublishRepositoryArtifactSetCommand,
  RepositoryArtifactPublication,
} from '@gitblocks/persistence';

import { chunkRepositoryArtifact } from './artifact-chunking.ts';
import type { ArtifactDecodedByteBudgetScope } from './artifact-byte-budget.ts';
import { isSafeArtifactPath } from './artifact-manifest.ts';
import { IngestionError, ingestionError } from './errors.ts';
import { isRecord } from './json-boundary.ts';
import type { ProviderTransport } from './providers.ts';
import type {
  ArtifactSelection,
  CatalogCandidate,
  PublicArtifactManifest,
} from './types.ts';
import type { TransportRequest } from './transport.ts';

const ARTIFACT_API_VERSION = '2026-03-10';
const ARTIFACT_RESPONSE_BYTES = 512 * 1_024;
const METADATA_RESPONSE_BYTES = 256 * 1_024;
const HASH_RESPONSE_BYTES = 16 * 1_024;
const MAXIMUM_ARTIFACT_BYTES = 256 * 1_024;
const MAXIMUM_CANDIDATE_BYTES = 512 * 1_024;
const MAXIMUM_LOGICAL_LINES = 10_000;
const CANDIDATE_DEADLINE_MILLISECONDS = 120_000;
const MAXIMUM_TREE_ENTRIES = 10_000;

export interface RepositoryArtifactCollectorConfig {
  readonly transport: ProviderTransport;
  readonly githubToken: string;
}

export interface CollectRepositoryArtifactsCommand {
  readonly candidate: CatalogCandidate;
  readonly manifest: PublicArtifactManifest;
  readonly collectedAt: string;
  readonly publishedAt: string;
  readonly correlationId: string;
  readonly decodedByteBudget: ArtifactDecodedByteBudgetScope;
  readonly signal?: AbortSignal;
  readonly deadlineSignal?: AbortSignal;
}

export interface RepositoryArtifactCollector {
  collectCandidate(
    command: CollectRepositoryArtifactsCommand,
  ): Promise<PublishRepositoryArtifactSetCommand>;
}

interface RepositoryContext {
  readonly repositoryId: string;
  readonly owner: string;
  readonly repository: string;
  readonly defaultBranch: string;
  readonly commitObjectId: string;
  readonly rootTreeObjectId: string;
}

interface ContentPayload {
  readonly path: string;
  readonly blobObjectId: string;
  readonly bytes: Buffer;
}

export function createRepositoryArtifactCollector(
  config: RepositoryArtifactCollectorConfig,
): RepositoryArtifactCollector {
  if (
    config.githubToken.length < 1 ||
    config.githubToken.length > 1_024 ||
    hasControlCharacter(config.githubToken)
  ) {
    throw ingestionError('ingestion.invalid-input');
  }
  let requestTail = Promise.resolve();
  const requestJson = async (
    request: TransportRequest,
  ): Promise<Awaited<ReturnType<ProviderTransport['requestJson']>>> => {
    let release: (() => void) | undefined;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    const prior = requestTail;
    requestTail = current;
    await prior;
    try {
      return await config.transport.requestJson(request);
    } finally {
      release?.();
    }
  };

  return {
    collectCandidate: async (command) => {
      try {
        return await collectCandidate(command, config.githubToken, requestJson);
      } catch (error) {
        if (error instanceof IngestionError) {
          throw error;
        }
        throw ingestionError('ingestion.internal-invariant');
      }
    },
  };
}

async function collectCandidate(
  command: CollectRepositoryArtifactsCommand,
  githubToken: string,
  requestJson: ProviderTransport['requestJson'],
): Promise<PublishRepositoryArtifactSetCommand> {
  const manifestCandidate = command.manifest.candidates.find(
    ({ candidateId }) => candidateId === command.candidate.candidateId,
  );
  if (
    manifestCandidate === undefined ||
    manifestCandidate.selections.length < 1 ||
    manifestCandidate.selections.length > 4
  ) {
    throw ingestionError('ingestion.invalid-manifest');
  }
  const candidateDeadline = AbortSignal.timeout(
    CANDIDATE_DEADLINE_MILLISECONDS,
  );
  const deadlineSignal =
    command.deadlineSignal === undefined
      ? candidateDeadline
      : AbortSignal.any([candidateDeadline, command.deadlineSignal]);
  const request = (
    operation: string,
    path: string,
    maximumBytes: number,
  ): ReturnType<ProviderTransport['requestJson']> =>
    requestJson({
      url: new URL(path, 'https://api.github.com'),
      provider: 'github',
      operation,
      maximumBytes,
      authorizationToken: githubToken,
      githubApiVersion: ARTIFACT_API_VERSION,
      correlationId: command.correlationId,
      candidateId: command.candidate.candidateId,
      ...(command.signal === undefined ? {} : { signal: command.signal }),
      deadlineSignal,
    });

  const context = await loadRepositoryContext(command.candidate, request);
  const artifactsById = new Map<string, RepositoryArtifactPublication>();
  const entries: RepositoryArtifactSetEntryV1[] = [];
  const treeCache = new Map<string, readonly TreeEntry[]>();
  let candidateBytes = 0;

  for (const [ordinal, selection] of manifestCandidate.selections.entries()) {
    let content: ContentPayload;
    try {
      content = await retrieveSelection(
        selection,
        context,
        request,
        command.decodedByteBudget,
      );
    } catch (error) {
      if (
        error instanceof IngestionError &&
        error.code === 'ingestion.provider-not-found' &&
        selection.requirement === 'optional'
      ) {
        entries.push(absentEntry(selection, ordinal));
        continue;
      }
      throw error;
    }
    const treeEntry = await verifyTreePath(
      content.path,
      context,
      request,
      treeCache,
    );
    if (
      treeEntry.sha !== content.blobObjectId ||
      (treeEntry.size !== null && treeEntry.size !== content.bytes.byteLength)
    ) {
      throw ingestionError('ingestion.artifact-hash-mismatch');
    }
    const blobBytes = await retrieveBlob(
      content.blobObjectId,
      context,
      request,
      command.decodedByteBudget,
    );
    if (!blobBytes.equals(content.bytes)) {
      throw ingestionError('ingestion.artifact-hash-mismatch');
    }
    const exact = validateExactText(blobBytes);
    const artifact = createRepositoryArtifactV1({
      contractVersion: '1.0.0',
      candidateId: command.candidate.candidateId,
      provider: 'github',
      providerRepositoryId: context.repositoryId,
      gitObjectAlgorithm: 'sha1',
      commitObjectId: context.commitObjectId,
      path: content.path,
      blobObjectId: content.blobObjectId,
      blobApiUrl: immutableBlobApiUrl(
        context.repositoryId,
        content.blobObjectId,
      ),
      displayUrl: repositoryArtifactDisplayUrl({
        providerOwner: context.owner,
        providerRepository: context.repository,
        commitObjectId: context.commitObjectId,
        path: content.path,
      }),
      mediaType: 'text/plain',
      encoding: 'utf-8',
      contentSha256: repositoryArtifactContentSha256(exact.text),
      byteCount: blobBytes.byteLength,
      lineCount: exact.lineCount,
      content: exact.text,
      firstMaterialization: {
        catalogOwner: command.candidate.github.owner,
        catalogRepository: command.candidate.github.repository,
        providerOwner: context.owner,
        providerRepository: context.repository,
        collectedAt: command.collectedAt,
      },
    });
    const parsedArtifact = parseRepositoryArtifactV1(artifact);
    if (!parsedArtifact.ok) {
      throw ingestionError('ingestion.internal-invariant');
    }
    if (!artifactsById.has(parsedArtifact.value.artifactId)) {
      if (candidateBytes > MAXIMUM_CANDIDATE_BYTES - blobBytes.byteLength) {
        throw ingestionError('ingestion.body-too-large');
      }
      candidateBytes += blobBytes.byteLength;
      artifactsById.set(parsedArtifact.value.artifactId, {
        artifact: parsedArtifact.value,
        chunks: chunkRepositoryArtifact(parsedArtifact.value),
      });
    }
    entries.push(presentEntry(selection, ordinal, content.path, artifact));
  }

  const artifactSet = createRepositoryArtifactSetV1({
    contractVersion: '1.0.0',
    candidateId: command.candidate.candidateId,
    catalogVersion: command.manifest.catalogVersion,
    catalogDigest: command.manifest.catalogDigest,
    artifactManifestVersion: command.manifest.artifactManifestVersion,
    artifactManifestDigest: command.manifest.manifestDigest,
    collectorVersion: 'repository-artifacts-v1',
    chunkerVersion: 'exact-lines-v1',
    provider: 'github',
    providerRepositoryId: context.repositoryId,
    providerCanonicalOwner: context.owner,
    providerCanonicalRepository: context.repository,
    gitObjectAlgorithm: 'sha1',
    commitObjectId: context.commitObjectId,
    entries,
    publishedAt: command.publishedAt,
  });
  const parsedSet = parseRepositoryArtifactSetV1(artifactSet);
  if (!parsedSet.ok) {
    throw ingestionError('ingestion.internal-invariant');
  }
  return {
    artifactSet: parsedSet.value,
    artifacts: [...artifactsById.values()],
  };
}

async function loadRepositoryContext(
  candidate: CatalogCandidate,
  request: (
    operation: string,
    path: string,
    maximumBytes: number,
  ) => ReturnType<ProviderTransport['requestJson']>,
): Promise<RepositoryContext> {
  const aliasPath = repositoryPath(
    candidate.github.owner,
    candidate.github.repository,
  );
  const repositoryResponse = await request(
    'artifact-repository',
    aliasPath,
    METADATA_RESPONSE_BYTES,
  );
  const repository = requireRecord(repositoryResponse.value);
  const owner = requireRecord(repository['owner']);
  const canonicalOwner = requireSafeName(owner['login']);
  const canonicalRepository = requireSafeName(repository['name']);
  const identityChanged =
    canonicalOwner.toLowerCase() !== candidate.github.owner.toLowerCase() ||
    canonicalRepository.toLowerCase() !==
      candidate.github.repository.toLowerCase();
  if (identityChanged && candidate.status !== 'moved') {
    throw ingestionError('ingestion.provider-identity');
  }
  if (repository['private'] !== false) {
    throw ingestionError('ingestion.provider-identity');
  }
  const repositoryId = requireRepositoryId(repository['id']);
  const defaultBranch = requireSafeName(repository['default_branch'], 255);
  const canonicalPath = repositoryPath(canonicalOwner, canonicalRepository);

  const hashResponse = await request(
    'artifact-hash-algorithm',
    `${canonicalPath}/hash-algorithm`,
    HASH_RESPONSE_BYTES,
  );
  const hash = requireRecord(hashResponse.value)['hash_algorithm'];
  if (hash !== 'sha1') {
    throw ingestionError('ingestion.unsupported-git-object-algorithm');
  }

  const referenceResponse = await request(
    'artifact-default-branch-ref',
    `${canonicalPath}/git/ref/heads/${encodePath(defaultBranch)}`,
    METADATA_RESPONSE_BYTES,
  );
  const reference = requireRecord(referenceResponse.value);
  const referenceObject = requireRecord(reference['object']);
  if (
    reference['ref'] !== `refs/heads/${defaultBranch}` ||
    referenceObject['type'] !== 'commit'
  ) {
    throw ingestionError('ingestion.provider-response');
  }
  const commitObjectId = requireSha1(referenceObject['sha']);

  const commitResponse = await request(
    'artifact-exact-commit',
    `${canonicalPath}/git/commits/${commitObjectId}`,
    METADATA_RESPONSE_BYTES,
  );
  const commit = requireRecord(commitResponse.value);
  if (requireSha1(commit['sha']) !== commitObjectId) {
    throw ingestionError('ingestion.provider-response');
  }
  const tree = requireRecord(commit['tree']);
  const rootTreeObjectId = requireSha1(tree['sha']);
  return {
    repositoryId,
    owner: canonicalOwner,
    repository: canonicalRepository,
    defaultBranch,
    commitObjectId,
    rootTreeObjectId,
  };
}

async function retrieveSelection(
  selection: ArtifactSelection,
  context: RepositoryContext,
  request: (
    operation: string,
    path: string,
    maximumBytes: number,
  ) => ReturnType<ProviderTransport['requestJson']>,
  decodedByteBudget: ArtifactDecodedByteBudgetScope,
): Promise<ContentPayload> {
  const base = repositoryPath(context.owner, context.repository);
  const endpoint =
    selection.selector === 'root-readme'
      ? `${base}/readme?ref=${encodeURIComponent(context.commitObjectId)}`
      : `${base}/contents/${encodePath(selection.path)}?ref=${encodeURIComponent(
          context.commitObjectId,
        )}`;
  const response = await request(
    selection.selector === 'root-readme'
      ? 'artifact-readme'
      : 'artifact-content',
    endpoint,
    ARTIFACT_RESPONSE_BYTES,
  );
  const payload = requireRecord(response.value);
  if (payload['type'] !== 'file' || payload['encoding'] !== 'base64') {
    throw ingestionError('ingestion.unsupported-artifact-type');
  }
  const path = requireArtifactPath(payload['path']);
  if (selection.selector === 'path' && path !== selection.path) {
    throw ingestionError('ingestion.provider-response');
  }
  const bytes = decodeBase64(payload['content'], decodedByteBudget);
  const declaredSize = payload['size'];
  if (
    !Number.isSafeInteger(declaredSize) ||
    Number(declaredSize) !== bytes.byteLength
  ) {
    throw ingestionError('ingestion.provider-response');
  }
  const blobObjectId = requireSha1(payload['sha']);
  if (
    bytes.byteLength > MAXIMUM_ARTIFACT_BYTES ||
    repositoryArtifactGitBlobObjectId('sha1', validateExactText(bytes).text) !==
      blobObjectId
  ) {
    throw ingestionError(
      bytes.byteLength > MAXIMUM_ARTIFACT_BYTES
        ? 'ingestion.body-too-large'
        : 'ingestion.artifact-hash-mismatch',
    );
  }
  return { path, blobObjectId, bytes };
}

interface TreeEntry {
  readonly path: string;
  readonly mode: string;
  readonly type: string;
  readonly size: number | null;
  readonly sha: string;
}

async function verifyTreePath(
  path: string,
  context: RepositoryContext,
  request: (
    operation: string,
    path: string,
    maximumBytes: number,
  ) => ReturnType<ProviderTransport['requestJson']>,
  cache: Map<string, readonly TreeEntry[]>,
): Promise<TreeEntry> {
  const segments = path.split('/');
  let treeObjectId = context.rootTreeObjectId;
  for (const [index, segment] of segments.entries()) {
    let entries = cache.get(treeObjectId);
    if (entries === undefined) {
      const response = await request(
        'artifact-tree',
        `${repositoryPath(context.owner, context.repository)}/git/trees/${treeObjectId}`,
        ARTIFACT_RESPONSE_BYTES,
      );
      const value = requireRecord(response.value);
      if (
        requireSha1(value['sha']) !== treeObjectId ||
        value['truncated'] !== false ||
        !Array.isArray(value['tree'])
      ) {
        throw ingestionError('ingestion.provider-response');
      }
      if (value['tree'].length > MAXIMUM_TREE_ENTRIES) {
        throw ingestionError('ingestion.body-too-large');
      }
      entries = value['tree'].map(parseTreeEntry);
      if (
        new Set(entries.map(({ path: entryPath }) => entryPath)).size !==
        entries.length
      ) {
        throw ingestionError('ingestion.provider-response');
      }
      cache.set(treeObjectId, entries);
    }
    const entry = entries.find(({ path: entryPath }) => entryPath === segment);
    if (entry === undefined) {
      throw ingestionError('ingestion.provider-response');
    }
    const final = index === segments.length - 1;
    if (final) {
      if (!['100644', '100755'].includes(entry.mode) || entry.type !== 'blob') {
        throw ingestionError('ingestion.unsupported-artifact-type');
      }
      return entry;
    }
    if (entry.mode !== '040000' || entry.type !== 'tree') {
      throw ingestionError('ingestion.unsupported-artifact-type');
    }
    treeObjectId = entry.sha;
  }
  throw ingestionError('ingestion.internal-invariant');
}

async function retrieveBlob(
  blobObjectId: string,
  context: RepositoryContext,
  request: (
    operation: string,
    path: string,
    maximumBytes: number,
  ) => ReturnType<ProviderTransport['requestJson']>,
  decodedByteBudget: ArtifactDecodedByteBudgetScope,
): Promise<Buffer> {
  const response = await request(
    'artifact-blob',
    `/repositories/${context.repositoryId}/git/blobs/${blobObjectId}`,
    ARTIFACT_RESPONSE_BYTES,
  );
  const payload = requireRecord(response.value);
  if (payload['encoding'] !== 'base64') {
    throw ingestionError('ingestion.unsupported-artifact-type');
  }
  const bytes = decodeBase64(payload['content'], decodedByteBudget);
  if (
    !Number.isSafeInteger(payload['size']) ||
    Number(payload['size']) !== bytes.byteLength
  ) {
    throw ingestionError('ingestion.provider-response');
  }
  const declaredObjectId = requireSha1(payload['sha']);
  const exact = validateExactText(bytes);
  const computedObjectId = repositoryArtifactGitBlobObjectId(
    'sha1',
    exact.text,
  );
  if (declaredObjectId !== blobObjectId || computedObjectId !== blobObjectId) {
    throw ingestionError('ingestion.artifact-hash-mismatch');
  }
  return bytes;
}

function validateExactText(bytes: Buffer): {
  readonly text: string;
  readonly lineCount: number;
} {
  if (bytes.byteLength > MAXIMUM_ARTIFACT_BYTES) {
    throw ingestionError('ingestion.body-too-large');
  }
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw ingestionError('ingestion.provider-response');
  }
  if (text.includes('\0') || !Buffer.from(text, 'utf8').equals(bytes)) {
    throw ingestionError('ingestion.provider-response');
  }
  const lineCount = text.split(/\r\n|\r|\n/u).length;
  if (lineCount > MAXIMUM_LOGICAL_LINES) {
    throw ingestionError('ingestion.body-too-large');
  }
  return { text, lineCount };
}

function decodeBase64(
  value: unknown,
  decodedByteBudget: ArtifactDecodedByteBudgetScope,
): Buffer {
  if (typeof value !== 'string' || value.length > ARTIFACT_RESPONSE_BYTES) {
    throw ingestionError('ingestion.provider-response');
  }
  const compact = value.replaceAll(/\r\n|\n|\r/gu, '');
  if (
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(
      compact,
    )
  ) {
    throw ingestionError('ingestion.provider-response');
  }
  const paddingBytes = compact.endsWith('==')
    ? 2
    : compact.endsWith('=')
      ? 1
      : 0;
  const decodedByteCount = (compact.length / 4) * 3 - paddingBytes;
  if (decodedByteCount > MAXIMUM_ARTIFACT_BYTES) {
    throw ingestionError('ingestion.body-too-large');
  }
  decodedByteBudget.reserve(decodedByteCount);
  const bytes = Buffer.from(compact, 'base64');
  if (bytes.toString('base64') !== compact) {
    throw ingestionError('ingestion.provider-response');
  }
  return bytes;
}

function parseTreeEntry(value: unknown): TreeEntry {
  const entry = requireRecord(value);
  const path = requireSafeName(entry['path'], 255);
  const mode = requireSafeName(entry['mode'], 6);
  const type = requireSafeName(entry['type'], 16);
  const size =
    entry['size'] === undefined
      ? null
      : Number.isSafeInteger(entry['size']) && Number(entry['size']) >= 0
        ? Number(entry['size'])
        : null;
  if (entry['size'] !== undefined && size === null) {
    throw ingestionError('ingestion.provider-response');
  }
  return { path, mode, type, size, sha: requireSha1(entry['sha']) };
}

function presentEntry(
  selection: ArtifactSelection,
  ordinal: number,
  resolvedPath: string,
  artifact: RepositoryArtifactV1,
): RepositoryArtifactSetEntryV1 {
  return {
    selectionId: selection.selectionId,
    ordinal,
    selector: selection.selector,
    artifactKind: selection.artifactKind,
    requirement: selection.requirement,
    rationale: selection.selector === 'path' ? selection.rationale : null,
    requestedPath: selection.selector === 'path' ? selection.path : null,
    resolvedPath,
    outcome: 'present',
    artifactId: artifact.artifactId,
  };
}

function absentEntry(
  selection: ArtifactSelection,
  ordinal: number,
): RepositoryArtifactSetEntryV1 {
  return {
    selectionId: selection.selectionId,
    ordinal,
    selector: selection.selector,
    artifactKind: selection.artifactKind,
    requirement: 'optional',
    rationale: selection.selector === 'path' ? selection.rationale : null,
    requestedPath: selection.selector === 'path' ? selection.path : null,
    resolvedPath: null,
    outcome: 'not-found',
    artifactId: null,
  };
}

function immutableBlobApiUrl(
  repositoryId: string,
  blobObjectId: string,
): string {
  return `https://api.github.com/repositories/${repositoryId}/git/blobs/${blobObjectId}`;
}

function repositoryPath(owner: string, repository: string): string {
  return `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}`;
}

function encodePath(path: string): string {
  return path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function requireRecord(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    throw ingestionError('ingestion.provider-response');
  }
  return value;
}

function requireSafeName(value: unknown, maximum = 100): string {
  if (
    typeof value !== 'string' ||
    value.length < 1 ||
    value.length > maximum ||
    hasControlCharacter(value)
  ) {
    throw ingestionError('ingestion.provider-response');
  }
  return value;
}

function requireRepositoryId(value: unknown): string {
  if (
    !Number.isSafeInteger(value) ||
    Number(value) < 1 ||
    String(value).length > 20
  ) {
    throw ingestionError('ingestion.provider-response');
  }
  return String(value);
}

function requireSha1(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{40}$/u.test(value)) {
    throw ingestionError('ingestion.provider-response');
  }
  return value;
}

function requireArtifactPath(value: unknown): string {
  if (typeof value !== 'string' || !isSafeArtifactPath(value)) {
    throw ingestionError('ingestion.unsupported-artifact-type');
  }
  return value;
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
