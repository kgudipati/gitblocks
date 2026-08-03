import {
  providerOutputIssue,
  type ProviderOutputIssue,
} from './provider-output-issues.ts';

interface PendingValue {
  readonly value: unknown;
  readonly depth: number;
  readonly leaving?: boolean;
}

const MAXIMUM_DEPTH = 16;
const MAXIMUM_NODES = 2_000;
const MAXIMUM_ARRAY_ITEMS = 200;
const MAXIMUM_OBJECT_PROPERTIES = 8;
const MAXIMUM_TOTAL_STRING_CODE_UNITS = 128_000;

export function preflightProviderOutput(
  value: unknown,
): readonly ProviderOutputIssue[] {
  const pending: PendingValue[] = [{ value, depth: 0 }];
  const ancestors = new WeakSet<object>();
  let nodeCount = 0;
  let totalStringCodeUnits = 0;

  try {
    while (pending.length > 0) {
      const current = pending.pop();
      if (current === undefined) {
        break;
      }
      if (current.leaving) {
        if (typeof current.value === 'object' && current.value !== null) {
          ancestors.delete(current.value);
        }
        continue;
      }
      nodeCount += 1;
      if (nodeCount > MAXIMUM_NODES || current.depth > MAXIMUM_DEPTH) {
        return [inputShapeIssue()];
      }

      if (current.value === null) {
        continue;
      }
      if (typeof current.value === 'string') {
        totalStringCodeUnits += current.value.length;
        if (totalStringCodeUnits > MAXIMUM_TOTAL_STRING_CODE_UNITS) {
          return [inputShapeIssue()];
        }
        continue;
      }
      if (
        typeof current.value === 'boolean' ||
        (typeof current.value === 'number' && Number.isFinite(current.value))
      ) {
        continue;
      }
      if (typeof current.value !== 'object') {
        return [inputShapeIssue()];
      }

      if (ancestors.has(current.value)) {
        return [inputShapeIssue()];
      }
      ancestors.add(current.value);
      pending.push({ ...current, leaving: true });

      if (Array.isArray(current.value)) {
        if (
          Object.getPrototypeOf(current.value) !== Array.prototype ||
          current.value.length > MAXIMUM_ARRAY_ITEMS
        ) {
          return [inputShapeIssue()];
        }
        const keys = Reflect.ownKeys(current.value);
        if (
          keys.length !== current.value.length + 1 ||
          keys.some((key) => typeof key !== 'string')
        ) {
          return [inputShapeIssue()];
        }
        for (let index = current.value.length - 1; index >= 0; index -= 1) {
          const descriptor = Object.getOwnPropertyDescriptor(
            current.value,
            String(index),
          );
          if (
            descriptor === undefined ||
            !descriptor.enumerable ||
            !('value' in descriptor)
          ) {
            return [inputShapeIssue()];
          }
          pending.push({
            value: descriptor.value,
            depth: current.depth + 1,
          });
        }
        continue;
      }

      const prototype = Object.getPrototypeOf(current.value) as unknown;
      if (prototype !== Object.prototype && prototype !== null) {
        return [inputShapeIssue()];
      }
      const keys = Reflect.ownKeys(current.value);
      if (
        keys.length > MAXIMUM_OBJECT_PROPERTIES ||
        keys.some((key) => typeof key !== 'string')
      ) {
        return [inputShapeIssue()];
      }
      for (const key of keys) {
        if (typeof key !== 'string') {
          return [inputShapeIssue()];
        }
        totalStringCodeUnits += key.length;
        if (totalStringCodeUnits > MAXIMUM_TOTAL_STRING_CODE_UNITS) {
          return [inputShapeIssue()];
        }
        const descriptor = Object.getOwnPropertyDescriptor(current.value, key);
        if (
          descriptor === undefined ||
          !descriptor.enumerable ||
          !('value' in descriptor)
        ) {
          return [inputShapeIssue()];
        }
        pending.push({
          value: descriptor.value,
          depth: current.depth + 1,
        });
      }
    }
  } catch {
    return [inputShapeIssue()];
  }

  return [];
}

function inputShapeIssue(): ProviderOutputIssue {
  return providerOutputIssue(
    'provider-output.input-shape',
    '',
    'Provider output input has an unsupported object shape.',
  );
}
