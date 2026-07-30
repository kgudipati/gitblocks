import {
  createRepositoryArtifactChunkV1,
  parseRepositoryArtifactChunkV1,
  parseRepositoryArtifactV1,
  repositoryArtifactContentSha256,
  type RepositoryArtifactChunkV1,
  type RepositoryArtifactV1,
} from '@gitblocks/contracts';

const MAXIMUM_CHUNK_BYTES = 16 * 1_024;
const MAXIMUM_CHUNK_LINES = 200;
const MAXIMUM_CHUNKS = 64;

interface LineUnit {
  readonly startByte: number;
  readonly endByteExclusive: number;
  readonly line: number;
}

export function chunkRepositoryArtifact(
  artifact: RepositoryArtifactV1,
): readonly RepositoryArtifactChunkV1[] {
  const parsed = parseRepositoryArtifactV1(artifact);
  if (!parsed.ok) {
    throw new Error('Repository artifact is invalid.');
  }
  const bytes = Buffer.from(parsed.value.content, 'utf8');
  if (bytes.byteLength === 0) {
    return [createChunk(parsed.value, bytes, 0, 0, 0, 1, 1)];
  }

  const spans: {
    readonly startByte: number;
    readonly endByteExclusive: number;
    readonly startLine: number;
    readonly endLine: number;
  }[] = [];
  let pending:
    | {
        startByte: number;
        endByteExclusive: number;
        startLine: number;
        endLine: number;
      }
    | undefined;

  const flush = (): void => {
    if (pending !== undefined) {
      spans.push(pending);
      pending = undefined;
    }
  };

  for (const unit of logicalLineUnits(bytes)) {
    let cursor = unit.startByte;
    while (cursor < unit.endByteExclusive) {
      let pieceEnd = utf8BoundaryAtOrBefore(
        bytes,
        cursor,
        Math.min(unit.endByteExclusive, cursor + MAXIMUM_CHUNK_BYTES),
      );
      // CRLF is one logical terminator. Keep its two bytes together so a
      // physical chunk boundary cannot make the next chunk appear to start on
      // a new logical line that has no independently addressable bytes.
      if (
        pieceEnd < unit.endByteExclusive &&
        bytes[pieceEnd - 1] === 0x0d &&
        bytes[pieceEnd] === 0x0a
      ) {
        pieceEnd -= 1;
      }
      if (pieceEnd <= cursor) {
        throw new Error(
          'Unable to split repository artifact at UTF-8 boundary.',
        );
      }
      const pieceBytes = pieceEnd - cursor;
      const pendingBytes =
        pending === undefined
          ? 0
          : pending.endByteExclusive - pending.startByte;
      const pendingLines =
        pending === undefined ? 0 : unit.line - pending.startLine + 1;
      if (
        pending !== undefined &&
        (pendingBytes + pieceBytes > MAXIMUM_CHUNK_BYTES ||
          pendingLines > MAXIMUM_CHUNK_LINES)
      ) {
        flush();
      }
      if (pending === undefined) {
        pending = {
          startByte: cursor,
          endByteExclusive: pieceEnd,
          startLine: unit.line,
          endLine: unit.line,
        };
      } else {
        pending.endByteExclusive = pieceEnd;
        pending.endLine = unit.line;
      }
      cursor = pieceEnd;
      if (cursor < unit.endByteExclusive) {
        flush();
      }
    }
  }
  flush();

  if (spans.length < 1 || spans.length > MAXIMUM_CHUNKS) {
    throw new Error('Repository artifact exceeds the chunk-count bound.');
  }
  const chunks = spans.map((span, ordinal) =>
    createChunk(
      parsed.value,
      bytes,
      ordinal,
      span.startByte,
      span.endByteExclusive,
      span.startLine,
      span.endLine,
    ),
  );
  if (!verifyRepositoryArtifactChunks(parsed.value, chunks)) {
    throw new Error('Repository artifact chunk reconstruction failed.');
  }
  return chunks;
}

export function verifyRepositoryArtifactChunks(
  artifact: RepositoryArtifactV1,
  chunks: readonly RepositoryArtifactChunkV1[],
): boolean {
  const parsedArtifact = parseRepositoryArtifactV1(artifact);
  if (
    !parsedArtifact.ok ||
    chunks.length < 1 ||
    chunks.length > MAXIMUM_CHUNKS
  ) {
    return false;
  }
  const buffers: Buffer[] = [];
  let expectedStart = 0;
  for (const [ordinal, chunk] of chunks.entries()) {
    const parsedChunk = parseRepositoryArtifactChunkV1(chunk);
    if (
      !parsedChunk.ok ||
      parsedChunk.value.artifactId !== parsedArtifact.value.artifactId ||
      parsedChunk.value.candidateId !== parsedArtifact.value.candidateId ||
      parsedChunk.value.ordinal !== ordinal ||
      parsedChunk.value.startByte !== expectedStart ||
      parsedChunk.value.endByteExclusive < parsedChunk.value.startByte ||
      parsedChunk.value.byteCount > MAXIMUM_CHUNK_BYTES ||
      parsedChunk.value.endLine - parsedChunk.value.startLine + 1 >
        MAXIMUM_CHUNK_LINES
    ) {
      return false;
    }
    const buffer = Buffer.from(parsedChunk.value.content, 'utf8');
    const expectedLines = lineRangeForInterval(
      artifactBytes(parsedArtifact.value),
      parsedChunk.value.startByte,
      parsedChunk.value.endByteExclusive,
    );
    if (
      buffer.byteLength !== parsedChunk.value.byteCount ||
      parsedChunk.value.startLine !== expectedLines.startLine ||
      parsedChunk.value.endLine !== expectedLines.endLine ||
      repositoryArtifactContentSha256(parsedChunk.value.content) !==
        parsedChunk.value.contentSha256
    ) {
      return false;
    }
    expectedStart = parsedChunk.value.endByteExclusive;
    buffers.push(buffer);
  }
  const reconstructed = Buffer.concat(buffers);
  const artifactBytesValue = artifactBytes(parsedArtifact.value);
  return (
    expectedStart === parsedArtifact.value.byteCount &&
    reconstructed.equals(artifactBytesValue)
  );
}

function createChunk(
  artifact: RepositoryArtifactV1,
  bytes: Buffer,
  ordinal: number,
  startByte: number,
  endByteExclusive: number,
  startLine: number,
  endLine: number,
): RepositoryArtifactChunkV1 {
  const content = bytes.subarray(startByte, endByteExclusive).toString('utf8');
  return createRepositoryArtifactChunkV1({
    contractVersion: artifact.contractVersion,
    artifactId: artifact.artifactId,
    candidateId: artifact.candidateId,
    chunkerVersion: 'exact-lines-v1',
    ordinal,
    startByte,
    endByteExclusive,
    byteCount: endByteExclusive - startByte,
    startLine,
    endLine,
    contentSha256: repositoryArtifactContentSha256(content),
    content,
  });
}

function logicalLineUnits(bytes: Buffer): readonly LineUnit[] {
  const units: LineUnit[] = [];
  let startByte = 0;
  let line = 1;
  for (let index = 0; index < bytes.byteLength; index += 1) {
    const byte = bytes[index];
    if (byte !== 0x0a && byte !== 0x0d) {
      continue;
    }
    if (
      byte === 0x0d &&
      index + 1 < bytes.byteLength &&
      bytes[index + 1] === 0x0a
    ) {
      index += 1;
    }
    units.push({ startByte, endByteExclusive: index + 1, line });
    startByte = index + 1;
    line += 1;
  }
  if (startByte < bytes.byteLength) {
    units.push({ startByte, endByteExclusive: bytes.byteLength, line });
  }
  // A final terminator increments artifact.lineCount, but its terminal empty
  // logical line has no byte interval and therefore no LineUnit or chunk.
  return units;
}

function lineRangeForInterval(
  bytes: Buffer,
  startByte: number,
  endByteExclusive: number,
): { readonly startLine: number; readonly endLine: number } {
  if (bytes.byteLength === 0) {
    return { startLine: 1, endLine: 1 };
  }
  const units = logicalLineUnits(bytes);
  const start = units.find(
    (unit) => startByte >= unit.startByte && startByte < unit.endByteExclusive,
  );
  const finalByte = Math.max(startByte, endByteExclusive - 1);
  const end = units.find(
    (unit) => finalByte >= unit.startByte && finalByte < unit.endByteExclusive,
  );
  if (start === undefined || end === undefined) {
    return { startLine: 0, endLine: 0 };
  }
  return { startLine: start.line, endLine: end.line };
}

function artifactBytes(artifact: RepositoryArtifactV1): Buffer {
  return Buffer.from(artifact.content, 'utf8');
}

function utf8BoundaryAtOrBefore(
  bytes: Buffer,
  startByte: number,
  proposedEnd: number,
): number {
  if (proposedEnd >= bytes.byteLength) {
    return proposedEnd;
  }
  let end = proposedEnd;
  while (
    end > startByte &&
    (bytes[end] ?? 0) >= 0x80 &&
    (bytes[end] ?? 0) <= 0xbf
  ) {
    end -= 1;
  }
  return end;
}
