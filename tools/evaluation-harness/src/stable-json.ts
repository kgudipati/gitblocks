const MAXIMUM_REPORT_BYTES = 4 * 1024 * 1024;

export function stableJson(value: unknown): string {
  const serialized = `${JSON.stringify(sortValue(value), null, 2)}\n`;
  if (Buffer.byteLength(serialized, 'utf8') > MAXIMUM_REPORT_BYTES) {
    throw new Error('Evaluation report exceeds the serialization byte limit.');
  }
  return serialized;
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortValue(item));
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => compareText(left, right))
        .map(([key, child]) => [key, sortValue(child)]),
    );
  }
  return value;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
