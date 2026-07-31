import type {
  RepositoryArtifactChunkV1,
  RepositoryArtifactSetV1,
  RepositoryArtifactV1,
} from './schemas.ts';

export const REPOSITORY_ARTIFACT_VERSION = 'repository-artifacts-v1';
export const REPOSITORY_ARTIFACT_CHUNKER_VERSION = 'exact-lines-v1';

type ArtifactInput = Omit<
  RepositoryArtifactV1,
  'artifactId' | 'identityDigest' | 'recordDigest'
>;
type ChunkInput = Omit<
  RepositoryArtifactChunkV1,
  'chunkId' | 'identityDigest' | 'recordDigest'
>;
type SetInput = Omit<
  RepositoryArtifactSetV1,
  'artifactSetId' | 'identityDigest' | 'recordDigest'
>;

export function createRepositoryArtifactV1(
  input: ArtifactInput,
): RepositoryArtifactV1 {
  const identityDigest = repositoryArtifactIdentityDigest(input);
  const value: Omit<RepositoryArtifactV1, 'recordDigest'> = {
    ...input,
    artifactId: `artifact-${identityDigest.slice(0, 48)}`,
    identityDigest,
  };
  return { ...value, recordDigest: repositoryArtifactRecordDigest(value) };
}

export function createRepositoryArtifactChunkV1(
  input: ChunkInput,
): RepositoryArtifactChunkV1 {
  const identityDigest = repositoryArtifactChunkIdentityDigest(input);
  const value: Omit<RepositoryArtifactChunkV1, 'recordDigest'> = {
    ...input,
    chunkId: `chunk-${identityDigest.slice(0, 48)}`,
    identityDigest,
  };
  return {
    ...value,
    recordDigest: repositoryArtifactChunkRecordDigest(value),
  };
}

export function createRepositoryArtifactSetV1(
  input: SetInput,
): RepositoryArtifactSetV1 {
  const identityDigest = repositoryArtifactSetIdentityDigest(input);
  const value: Omit<RepositoryArtifactSetV1, 'recordDigest'> = {
    ...input,
    artifactSetId: `artifact-set-${identityDigest.slice(0, 48)}`,
    identityDigest,
  };
  return { ...value, recordDigest: repositoryArtifactSetRecordDigest(value) };
}

export function repositoryArtifactIdentityDigest(
  value: Pick<
    RepositoryArtifactV1,
    | 'candidateId'
    | 'provider'
    | 'providerRepositoryId'
    | 'gitObjectAlgorithm'
    | 'commitObjectId'
    | 'path'
    | 'blobObjectId'
    | 'contentSha256'
  >,
): string {
  return digestCanonicalJson({
    candidateId: value.candidateId,
    provider: value.provider,
    providerRepositoryId: value.providerRepositoryId,
    gitObjectAlgorithm: value.gitObjectAlgorithm,
    commitObjectId: value.commitObjectId,
    path: value.path,
    blobObjectId: value.blobObjectId,
    contentSha256: value.contentSha256,
  });
}

export function repositoryArtifactChunkIdentityDigest(
  value: Pick<
    RepositoryArtifactChunkV1,
    | 'artifactId'
    | 'candidateId'
    | 'chunkerVersion'
    | 'ordinal'
    | 'startByte'
    | 'endByteExclusive'
    | 'contentSha256'
  >,
): string {
  return digestCanonicalJson({
    artifactId: value.artifactId,
    candidateId: value.candidateId,
    chunkerVersion: value.chunkerVersion,
    ordinal: value.ordinal,
    startByte: value.startByte,
    endByteExclusive: value.endByteExclusive,
    contentSha256: value.contentSha256,
  });
}

export function repositoryArtifactSetIdentityDigest(value: SetInput): string {
  return digestCanonicalJson({
    contractVersion: value.contractVersion,
    candidateId: value.candidateId,
    catalogVersion: value.catalogVersion,
    catalogDigest: value.catalogDigest,
    artifactManifestVersion: value.artifactManifestVersion,
    artifactManifestDigest: value.artifactManifestDigest,
    collectorVersion: value.collectorVersion,
    chunkerVersion: value.chunkerVersion,
    provider: value.provider,
    providerRepositoryId: value.providerRepositoryId,
    providerCanonicalOwner: value.providerCanonicalOwner,
    providerCanonicalRepository: value.providerCanonicalRepository,
    gitObjectAlgorithm: value.gitObjectAlgorithm,
    commitObjectId: value.commitObjectId,
    entries: value.entries,
  });
}

export function repositoryArtifactRecordDigest(
  value: Omit<RepositoryArtifactV1, 'recordDigest'> | RepositoryArtifactV1,
): string {
  return digestCanonicalJson({
    contractVersion: value.contractVersion,
    artifactId: value.artifactId,
    candidateId: value.candidateId,
    provider: value.provider,
    providerRepositoryId: value.providerRepositoryId,
    gitObjectAlgorithm: value.gitObjectAlgorithm,
    commitObjectId: value.commitObjectId,
    path: value.path,
    blobObjectId: value.blobObjectId,
    blobApiUrl: value.blobApiUrl,
    displayUrl: value.displayUrl,
    mediaType: value.mediaType,
    encoding: value.encoding,
    contentSha256: value.contentSha256,
    byteCount: value.byteCount,
    lineCount: value.lineCount,
    content: value.content,
    firstMaterialization: value.firstMaterialization,
    identityDigest: value.identityDigest,
  });
}

export function repositoryArtifactChunkRecordDigest(
  value:
    Omit<RepositoryArtifactChunkV1, 'recordDigest'> | RepositoryArtifactChunkV1,
): string {
  return digestCanonicalJson({
    contractVersion: value.contractVersion,
    chunkId: value.chunkId,
    artifactId: value.artifactId,
    candidateId: value.candidateId,
    chunkerVersion: value.chunkerVersion,
    ordinal: value.ordinal,
    startByte: value.startByte,
    endByteExclusive: value.endByteExclusive,
    byteCount: value.byteCount,
    startLine: value.startLine,
    endLine: value.endLine,
    contentSha256: value.contentSha256,
    content: value.content,
    identityDigest: value.identityDigest,
  });
}

export function repositoryArtifactSetRecordDigest(
  value:
    Omit<RepositoryArtifactSetV1, 'recordDigest'> | RepositoryArtifactSetV1,
): string {
  return digestCanonicalJson({
    contractVersion: value.contractVersion,
    artifactSetId: value.artifactSetId,
    candidateId: value.candidateId,
    catalogVersion: value.catalogVersion,
    catalogDigest: value.catalogDigest,
    artifactManifestVersion: value.artifactManifestVersion,
    artifactManifestDigest: value.artifactManifestDigest,
    collectorVersion: value.collectorVersion,
    chunkerVersion: value.chunkerVersion,
    provider: value.provider,
    providerRepositoryId: value.providerRepositoryId,
    providerCanonicalOwner: value.providerCanonicalOwner,
    providerCanonicalRepository: value.providerCanonicalRepository,
    gitObjectAlgorithm: value.gitObjectAlgorithm,
    commitObjectId: value.commitObjectId,
    entries: value.entries,
    publishedAt: value.publishedAt,
    identityDigest: value.identityDigest,
  });
}

export function repositoryArtifactContentSha256(content: string): string {
  return sha256Hex(utf8Bytes(content));
}

export function repositoryArtifactGitBlobObjectId(
  algorithm: RepositoryArtifactV1['gitObjectAlgorithm'],
  content: string,
): string {
  const bytes = utf8Bytes(content);
  const header = utf8Bytes(`blob ${String(bytes.byteLength)}\0`);
  const object = new Uint8Array(header.byteLength + bytes.byteLength);
  object.set(header);
  object.set(bytes, header.byteLength);
  const hashers: Readonly<
    Record<RepositoryArtifactV1['gitObjectAlgorithm'], typeof sha1Hex>
  > = { sha1: sha1Hex };
  return hashers[algorithm](object);
}

export function repositoryArtifactUtf8ByteLength(value: string): number {
  return utf8Bytes(value).byteLength;
}

export function repositoryArtifactDisplayUrl(value: {
  readonly providerOwner: string;
  readonly providerRepository: string;
  readonly commitObjectId: string;
  readonly path: string;
}): string {
  const encodedPath = value.path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return `https://github.com/${encodeURIComponent(
    value.providerOwner,
  )}/${encodeURIComponent(value.providerRepository)}/blob/${
    value.commitObjectId
  }/${encodedPath}`;
}

export function contractCanonicalDigest(value: unknown): string {
  return sha256Hex(utf8Bytes(serializeCanonicalJson(value, new Set<object>())));
}

function digestCanonicalJson(value: unknown): string {
  return contractCanonicalDigest(value);
}

function serializeCanonicalJson(
  value: unknown,
  ancestors: Set<object>,
): string {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return JSON.stringify(value);
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return JSON.stringify(Object.is(value, -0) ? 0 : value);
  }
  if (Array.isArray(value)) {
    return withAncestor(value, ancestors, () => {
      return `[${value
        .map((entry) => serializeCanonicalJson(entry, ancestors))
        .join(',')}]`;
    });
  }
  if (!isPlainRecord(value)) {
    throw new Error('Artifact digest input must be plain JSON data.');
  }
  return withAncestor(value, ancestors, () => {
    const entries = Object.keys(value)
      .sort(compareText)
      .map((key) => {
        const entry = value[key];
        if (entry === undefined) {
          throw new Error('Artifact digest input must not contain undefined.');
        }
        return `${JSON.stringify(key)}:${serializeCanonicalJson(
          entry,
          ancestors,
        )}`;
      });
    return `{${entries.join(',')}}`;
  });
}

function withAncestor<T>(
  value: object,
  ancestors: Set<object>,
  callback: () => T,
): T {
  if (ancestors.has(value)) {
    throw new Error('Artifact digest input must not be cyclic.');
  }
  ancestors.add(value);
  try {
    return callback();
  } finally {
    ancestors.delete(value);
  }
}

function isPlainRecord(
  value: unknown,
): value is Readonly<Record<string, unknown>> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value) as unknown;
  return prototype === Object.prototype || prototype === null;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function utf8Bytes(value: string): Uint8Array {
  const bytes: number[] = [];
  for (let index = 0; index < value.length; index += 1) {
    let codePoint = value.charCodeAt(index);
    if (codePoint >= 0xd800 && codePoint <= 0xdbff) {
      const low = value.charCodeAt(index + 1);
      if (low < 0xdc00 || low > 0xdfff) {
        throw new Error('Artifact text contains invalid Unicode.');
      }
      codePoint = 0x10000 + ((codePoint - 0xd800) << 10) + (low - 0xdc00);
      index += 1;
    } else if (codePoint >= 0xdc00 && codePoint <= 0xdfff) {
      throw new Error('Artifact text contains invalid Unicode.');
    }

    if (codePoint <= 0x7f) {
      bytes.push(codePoint);
    } else if (codePoint <= 0x7ff) {
      bytes.push(0xc0 | (codePoint >>> 6), 0x80 | (codePoint & 0x3f));
    } else if (codePoint <= 0xffff) {
      bytes.push(
        0xe0 | (codePoint >>> 12),
        0x80 | ((codePoint >>> 6) & 0x3f),
        0x80 | (codePoint & 0x3f),
      );
    } else {
      bytes.push(
        0xf0 | (codePoint >>> 18),
        0x80 | ((codePoint >>> 12) & 0x3f),
        0x80 | ((codePoint >>> 6) & 0x3f),
        0x80 | (codePoint & 0x3f),
      );
    }
  }
  return Uint8Array.from(bytes);
}

const SHA256_CONSTANTS = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function sha256Hex(input: Uint8Array): string {
  const padded = padHashInput(input);
  const schedule = new Uint32Array(64);
  const state = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c,
    0x1f83d9ab, 0x5be0cd19,
  ]);
  const view = new DataView(
    padded.buffer,
    padded.byteOffset,
    padded.byteLength,
  );

  for (let offset = 0; offset < padded.byteLength; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      schedule[index] = view.getUint32(offset + index * 4, false);
    }
    for (let index = 16; index < 64; index += 1) {
      const word15 = schedule[index - 15] ?? 0;
      const word2 = schedule[index - 2] ?? 0;
      const small0 =
        rotateRight(word15, 7) ^ rotateRight(word15, 18) ^ (word15 >>> 3);
      const small1 =
        rotateRight(word2, 17) ^ rotateRight(word2, 19) ^ (word2 >>> 10);
      schedule[index] =
        ((schedule[index - 16] ?? 0) +
          small0 +
          (schedule[index - 7] ?? 0) +
          small1) >>>
        0;
    }

    let a = state[0] ?? 0;
    let b = state[1] ?? 0;
    let c = state[2] ?? 0;
    let d = state[3] ?? 0;
    let e = state[4] ?? 0;
    let f = state[5] ?? 0;
    let g = state[6] ?? 0;
    let h = state[7] ?? 0;
    for (let index = 0; index < 64; index += 1) {
      const big1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choice = (e & f) ^ (~e & g);
      const temporary1 =
        (h +
          big1 +
          choice +
          (SHA256_CONSTANTS[index] ?? 0) +
          (schedule[index] ?? 0)) >>>
        0;
      const big0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temporary2 = (big0 + majority) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temporary1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temporary1 + temporary2) >>> 0;
    }
    state[0] = ((state[0] ?? 0) + a) >>> 0;
    state[1] = ((state[1] ?? 0) + b) >>> 0;
    state[2] = ((state[2] ?? 0) + c) >>> 0;
    state[3] = ((state[3] ?? 0) + d) >>> 0;
    state[4] = ((state[4] ?? 0) + e) >>> 0;
    state[5] = ((state[5] ?? 0) + f) >>> 0;
    state[6] = ((state[6] ?? 0) + g) >>> 0;
    state[7] = ((state[7] ?? 0) + h) >>> 0;
  }
  return wordsToHex(state);
}

function sha1Hex(input: Uint8Array): string {
  const padded = padHashInput(input);
  const schedule = new Uint32Array(80);
  const state = new Uint32Array([
    0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0,
  ]);
  const view = new DataView(
    padded.buffer,
    padded.byteOffset,
    padded.byteLength,
  );
  for (let offset = 0; offset < padded.byteLength; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      schedule[index] = view.getUint32(offset + index * 4, false);
    }
    for (let index = 16; index < 80; index += 1) {
      schedule[index] = rotateLeft(
        (schedule[index - 3] ?? 0) ^
          (schedule[index - 8] ?? 0) ^
          (schedule[index - 14] ?? 0) ^
          (schedule[index - 16] ?? 0),
        1,
      );
    }
    let a = state[0] ?? 0;
    let b = state[1] ?? 0;
    let c = state[2] ?? 0;
    let d = state[3] ?? 0;
    let e = state[4] ?? 0;
    for (let index = 0; index < 80; index += 1) {
      let mix: number;
      let constant: number;
      if (index < 20) {
        mix = (b & c) | (~b & d);
        constant = 0x5a827999;
      } else if (index < 40) {
        mix = b ^ c ^ d;
        constant = 0x6ed9eba1;
      } else if (index < 60) {
        mix = (b & c) | (b & d) | (c & d);
        constant = 0x8f1bbcdc;
      } else {
        mix = b ^ c ^ d;
        constant = 0xca62c1d6;
      }
      const temporary =
        (rotateLeft(a, 5) + mix + e + constant + (schedule[index] ?? 0)) >>> 0;
      e = d;
      d = c;
      c = rotateLeft(b, 30);
      b = a;
      a = temporary;
    }
    state[0] = ((state[0] ?? 0) + a) >>> 0;
    state[1] = ((state[1] ?? 0) + b) >>> 0;
    state[2] = ((state[2] ?? 0) + c) >>> 0;
    state[3] = ((state[3] ?? 0) + d) >>> 0;
    state[4] = ((state[4] ?? 0) + e) >>> 0;
  }
  return wordsToHex(state);
}

function padHashInput(input: Uint8Array): Uint8Array {
  const paddedLength = Math.ceil((input.byteLength + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(input);
  padded[input.byteLength] = 0x80;
  const bitLength = input.byteLength * 8;
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x1_0000_0000));
  view.setUint32(paddedLength - 4, bitLength >>> 0);
  return padded;
}

function rotateRight(value: number, shift: number): number {
  return (value >>> shift) | (value << (32 - shift));
}

function rotateLeft(value: number, shift: number): number {
  return ((value << shift) | (value >>> (32 - shift))) >>> 0;
}

function wordsToHex(words: Uint32Array): string {
  return [...words].map((word) => word.toString(16).padStart(8, '0')).join('');
}
