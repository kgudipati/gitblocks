import { createHash } from 'node:crypto';

import type { RetrievalCorpusManifest } from './contracts.ts';

const MAXIMUM_SERIALIZED_BYTES = 16 * 1024 * 1024;

export function retrievalStableJson(value: unknown): string {
  const serialized = `${JSON.stringify(sortObjectKeys(value), null, 2)}\n`;
  if (Buffer.byteLength(serialized, 'utf8') > MAXIMUM_SERIALIZED_BYTES) {
    throw new Error('Retrieval JSON exceeds its serialization byte limit.');
  }
  return serialized;
}

export function retrievalSemanticDigest(value: unknown): string {
  return createHash('sha256').update(retrievalStableJson(value)).digest('hex');
}

export function retrievalCorpusSemanticDigest(
  manifest:
    | Omit<RetrievalCorpusManifest, 'corpusSemanticDigest'>
    | RetrievalCorpusManifest,
): string {
  const { corpusSemanticDigest, ...projection } =
    manifest as RetrievalCorpusManifest;
  void corpusSemanticDigest;
  return retrievalSemanticDigest(projection);
}

function sortObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortObjectKeys);
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => compareText(left, right))
        .map(([key, child]) => [key, sortObjectKeys(child)]),
    );
  }
  return value;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
