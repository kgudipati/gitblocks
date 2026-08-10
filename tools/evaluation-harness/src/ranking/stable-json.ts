import { createHash } from 'node:crypto';

export function rankingStableJson(value: unknown): string {
  return `${JSON.stringify(sortValue(value), null, 2)}\n`;
}

export function rankingDigest(value: unknown): string {
  return createHash('sha256').update(rankingStableJson(value)).digest('hex');
}

export function rankingSemanticDigest(value: object): string {
  const semantic = { ...value } as Record<string, unknown>;
  delete semantic['semanticDigest'];
  return rankingDigest(semantic);
}

export function compareRankingText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/** Retains runtime boundary checks when a parsed authority has a literal type. */
export function rankingValuesDiffer(left: unknown, right: unknown): boolean {
  return left !== right;
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => sortValue(item));
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => compareRankingText(left, right))
      .map(([key, child]) => [key, sortValue(child)]),
  );
}
