import { TextDecoder } from 'node:util';

import {
  repositoryArtifactContentSha256,
  repositoryArtifactGitBlobObjectId,
} from '@gitblocks/contracts';

import { canonicalizeJson } from './canonical-json.ts';
import type { CandidateAuthorityPartialRuleResult } from './candidate-authority-partial-rules.ts';
import { ingestionError } from './errors.ts';
import { requireRecord } from './profile-materialization-contracts.ts';

const MAXIMUM_DOCKERFILE_BYTES = 256 * 1_024;
const MAXIMUM_ROOT_TREE_ENTRIES = 10_000;
const SHA1_PATTERN = /^[a-f0-9]{40}$/u;
const DIRECT_FROM_IMAGE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/:@+-]{0,254}$/u;
const STAGE_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/u;
const GLOBAL_ARG_PATTERN = /^ARG[\t ]+[A-Za-z_][A-Za-z0-9_]*(?:=(.*))?$/iu;

export interface CandidateAuthorityDockerfileRepositoryIdentity {
  readonly repositoryId: string;
  readonly owner: string;
  readonly repository: string;
}

export interface CandidateAuthorityRootDockerfileInput {
  readonly expectedRepositoryIdentity: CandidateAuthorityDockerfileRepositoryIdentity;
  readonly observedRepositoryIdentity: CandidateAuthorityDockerfileRepositoryIdentity;
  readonly expectedCommitObjectId: string;
  readonly observedCommitObjectId: string;
  readonly expectedRootTreeObjectId: string;
  readonly rootTreeValue: unknown;
  readonly blobOutcome: 'established-value' | 'temporary-unavailable';
  readonly blobValue: unknown;
}

/**
 * Validates the immutable ADR 0006 root-tree/blob chain before interpreting the
 * exact root Dockerfile as inert text. Missing source is unknown; disagreement
 * in a claimed immutable identity is invalid provider authority.
 */
export function extractRepositoryContainerBuildDeclarationFact(
  input: CandidateAuthorityRootDockerfileInput,
): CandidateAuthorityPartialRuleResult {
  requireRepositoryIdentity(
    input.expectedRepositoryIdentity,
    input.observedRepositoryIdentity,
  );
  const commitObjectId = requireSha1(input.expectedCommitObjectId);
  if (requireSha1(input.observedCommitObjectId) !== commitObjectId) invalid();
  const rootTreeObjectId = requireSha1(input.expectedRootTreeObjectId);
  const rootTree = requireRecord(input.rootTreeValue);
  if (
    requireSha1(rootTree['sha']) !== rootTreeObjectId ||
    rootTree['truncated'] !== false ||
    !Array.isArray(rootTree['tree']) ||
    rootTree['tree'].length > MAXIMUM_ROOT_TREE_ENTRIES
  )
    invalid();

  const entries = rootTree['tree'].map(parseRootTreeEntry);
  if (new Set(entries.map((entry) => entry.path)).size !== entries.length)
    invalid();
  const entry = entries.find((candidate) => candidate.path === 'Dockerfile');
  if (entry === undefined) {
    return {
      state: 'unknown',
      reason: 'root-dockerfile-absence-is-not-deployment-absence',
    };
  }
  if (
    (entry.mode !== '100644' && entry.mode !== '100755') ||
    entry.type !== 'blob'
  )
    invalid();
  if (input.blobOutcome === 'temporary-unavailable') {
    if (input.blobValue !== null) invalid();
    return { state: 'unknown', reason: 'dockerfile-source-unavailable' };
  }
  if (input.blobValue === null) invalid();

  const blob = requireRecord(input.blobValue);
  if (blob['encoding'] !== 'base64') invalid();
  const declaredBlobObjectId = requireSha1(blob['sha']);
  if (declaredBlobObjectId !== entry.sha) invalid();
  const bytes = decodeBoundedBase64(blob['content']);
  if (
    !Number.isSafeInteger(blob['size']) ||
    Number(blob['size']) !== bytes.byteLength ||
    (entry.size !== null && entry.size !== bytes.byteLength)
  )
    invalid();
  const content = decodeExactUtf8(bytes);
  if (
    repositoryArtifactGitBlobObjectId('sha1', content) !== entry.sha ||
    !Buffer.from(content, 'utf8').equals(bytes)
  )
    invalid();

  const declaration = parseConservativeDockerfileBuildDeclaration(content);
  if (!declaration) {
    return {
      state: 'unknown',
      reason: 'container-build-declaration-not-established',
    };
  }
  return {
    state: 'established-facts',
    facts: [
      {
        factCode: 'repository-container-build-declaration',
        factValue: canonicalizeJson({
          contentDigest: repositoryArtifactContentSha256(content),
          path: 'Dockerfile',
        }).text,
      },
    ],
  };
}

/**
 * Recognizes only the prefix through the first build stage. It permits the
 * Dockerfile constructs that may precede FROM, but never interpolates ARG or
 * interprets instructions after the established stage declaration.
 */
export function parseConservativeDockerfileBuildDeclaration(
  content: string,
): boolean {
  if (
    content.length === 0 ||
    Buffer.byteLength(content, 'utf8') > MAXIMUM_DOCKERFILE_BYTES ||
    content.includes('\0') ||
    /\r(?!\n)/u.test(content)
  )
    return false;
  for (const line of content.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith('#')) continue;
    if (trimmed.endsWith('\\')) return false;
    const globalArgument = GLOBAL_ARG_PATTERN.exec(trimmed);
    if (
      globalArgument !== null &&
      (globalArgument[1] === undefined ||
        !containsControlCharacter(globalArgument[1]))
    )
      continue;
    const from = /^FROM[\t ]+([^\t ]+)(?:[\t ]+AS[\t ]+([^\t ]+))?$/iu.exec(
      trimmed,
    );
    if (from === null) return false;
    const image = from[1];
    const stage = from[2];
    return (
      image !== undefined &&
      DIRECT_FROM_IMAGE_PATTERN.test(image) &&
      !image.includes('$') &&
      (stage === undefined || STAGE_NAME_PATTERN.test(stage))
    );
  }
  return false;
}

interface RootTreeEntry {
  readonly path: string;
  readonly mode: string;
  readonly type: string;
  readonly sha: string;
  readonly size: number | null;
}

function parseRootTreeEntry(value: unknown): RootTreeEntry {
  const entry = requireRecord(value);
  const path = requireSafeToken(entry['path'], 255);
  const mode = requireSafeToken(entry['mode'], 6);
  const type = requireSafeToken(entry['type'], 16);
  const size =
    entry['size'] === undefined
      ? null
      : Number.isSafeInteger(entry['size']) && Number(entry['size']) >= 0
        ? Number(entry['size'])
        : invalid();
  return { path, mode, type, sha: requireSha1(entry['sha']), size };
}

function decodeBoundedBase64(value: unknown): Buffer {
  if (typeof value !== 'string' || value.length > 512 * 1_024) invalid();
  const compact = value.replaceAll(/\r\n|\n|\r/gu, '');
  if (
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(
      compact,
    )
  )
    invalid();
  const paddingBytes = compact.endsWith('==')
    ? 2
    : compact.endsWith('=')
      ? 1
      : 0;
  const decodedByteCount = (compact.length / 4) * 3 - paddingBytes;
  if (decodedByteCount > MAXIMUM_DOCKERFILE_BYTES) invalid();
  const bytes = Buffer.from(compact, 'base64');
  if (bytes.toString('base64') !== compact) invalid();
  return bytes;
}

function decodeExactUtf8(bytes: Buffer): string {
  let content: string;
  try {
    content = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return invalid();
  }
  if (content.includes('\0')) invalid();
  return content;
}

function requireRepositoryIdentity(
  expected: CandidateAuthorityDockerfileRepositoryIdentity,
  observed: CandidateAuthorityDockerfileRepositoryIdentity,
): void {
  for (const value of [
    expected.repositoryId,
    expected.owner,
    expected.repository,
    observed.repositoryId,
    observed.owner,
    observed.repository,
  ]) {
    requireSafeToken(value, 255);
  }
  if (
    expected.repositoryId !== observed.repositoryId ||
    expected.owner !== observed.owner ||
    expected.repository !== observed.repository
  )
    invalid();
}

function requireSafeToken(value: unknown, maximumLength: number): string {
  if (
    typeof value !== 'string' ||
    value.length < 1 ||
    value.length > maximumLength ||
    containsControlCharacter(value)
  )
    invalid();
  return value;
}

function containsControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit <= 0x1f || codeUnit === 0x7f) return true;
  }
  return false;
}

function requireSha1(value: unknown): string {
  if (typeof value !== 'string' || !SHA1_PATTERN.test(value)) invalid();
  return value;
}

function invalid(): never {
  throw ingestionError('ingestion.provider-response');
}
