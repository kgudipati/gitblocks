import {
  contractIssue,
  finalizeContractIssues,
  type ContractIssue,
} from './diagnostics.ts';
import {
  MAX_INPUT_DEPTH,
  MAX_INPUT_NODES,
  MAX_INPUT_STRING_CODE_UNITS,
  MAX_INPUT_TOTAL_STRING_CODE_UNITS,
  MAX_OBJECT_PROPERTIES,
} from './schema-builders.ts';

interface PendingValue {
  readonly value: unknown;
  readonly depth: number;
  readonly path: string;
  readonly leaving?: boolean;
}

const MAX_PREFLIGHT_ARRAY_ITEMS = 2_000;

export function preflightContractValue(
  value: unknown,
): readonly ContractIssue[] {
  const pending: PendingValue[] = [{ value, depth: 0, path: '' }];
  const ancestors = new WeakSet<object>();
  const issues: ContractIssue[] = [];
  let nodeCount = 0;
  let scheduledNodeCount = 1;
  let totalStringCodeUnits = 0;
  const consumeStringBudget = (stringValue: string): boolean => {
    const stringLength = stringValue.length;
    if (
      stringLength > MAX_INPUT_STRING_CODE_UNITS ||
      totalStringCodeUnits > MAX_INPUT_TOTAL_STRING_CODE_UNITS - stringLength
    ) {
      return false;
    }
    totalStringCodeUnits += stringLength;
    return true;
  };

  try {
    while (pending.length > 0 && issues.length === 0) {
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
      if (nodeCount > MAX_INPUT_NODES) {
        issues.push(
          contractIssue(
            'contract.input-complexity',
            current.path,
            'Contract input exceeds the maximum complexity.',
          ),
        );
        break;
      }
      if (current.depth > MAX_INPUT_DEPTH) {
        issues.push(
          contractIssue(
            'contract.input-depth',
            current.path,
            'Contract input exceeds the maximum nesting depth.',
          ),
        );
        break;
      }

      if (current.value === null) {
        continue;
      }
      const valueType = typeof current.value;
      if (valueType === 'string') {
        if (!consumeStringBudget(current.value as string)) {
          issues.push(
            contractIssue(
              'contract.input-complexity',
              current.path,
              'Contract input exceeds the maximum complexity.',
            ),
          );
          break;
        }
        continue;
      }
      if (
        valueType === 'boolean' ||
        (valueType === 'number' && Number.isFinite(current.value))
      ) {
        continue;
      }
      if (valueType !== 'object') {
        issues.push(
          contractIssue(
            'contract.input-shape',
            current.path,
            'Contract input has an unsupported object shape.',
          ),
        );
        break;
      }

      const objectValue = current.value as object;
      if (ancestors.has(objectValue)) {
        issues.push(
          contractIssue(
            'contract.input-shape',
            current.path,
            'Contract input has an unsupported object shape.',
          ),
        );
        break;
      }
      ancestors.add(objectValue);
      pending.push({ ...current, leaving: true });

      if (Array.isArray(objectValue)) {
        const prototype = Reflect.getPrototypeOf(objectValue);
        const keys = Reflect.ownKeys(objectValue);
        const lengthDescriptor = Object.getOwnPropertyDescriptor(
          objectValue,
          'length',
        );
        const arrayLength: unknown =
          lengthDescriptor !== undefined && 'value' in lengthDescriptor
            ? lengthDescriptor.value
            : undefined;
        if (
          prototype !== Array.prototype ||
          typeof arrayLength !== 'number' ||
          !Number.isSafeInteger(arrayLength) ||
          arrayLength < 0 ||
          keys.length !== arrayLength + 1 ||
          keys.some((key) => typeof key !== 'string')
        ) {
          issues.push(
            contractIssue(
              'contract.input-shape',
              current.path,
              'Contract input has an unsupported object shape.',
            ),
          );
          break;
        }
        if (
          keys.some(
            (key) => typeof key === 'string' && !consumeStringBudget(key),
          )
        ) {
          issues.push(
            contractIssue(
              'contract.input-complexity',
              current.path,
              'Contract input exceeds the maximum complexity.',
            ),
          );
          break;
        }
        if (
          arrayLength > MAX_PREFLIGHT_ARRAY_ITEMS ||
          scheduledNodeCount + arrayLength > MAX_INPUT_NODES
        ) {
          issues.push(
            contractIssue(
              'contract.input-complexity',
              current.path,
              'Contract input exceeds the maximum complexity.',
            ),
          );
          break;
        }
        scheduledNodeCount += arrayLength;
        for (let index = arrayLength - 1; index >= 0; index -= 1) {
          const descriptor = Object.getOwnPropertyDescriptor(
            objectValue,
            String(index),
          );
          if (
            descriptor === undefined ||
            !descriptor.enumerable ||
            !('value' in descriptor)
          ) {
            issues.push(
              contractIssue(
                'contract.input-shape',
                current.path,
                'Contract input has an unsupported object shape.',
              ),
            );
            break;
          }
          pending.push({
            value: descriptor.value,
            depth: current.depth + 1,
            path: `${current.path}/${String(index)}`,
          });
        }
        continue;
      }

      const prototype = Reflect.getPrototypeOf(objectValue);
      if (prototype !== Object.prototype && prototype !== null) {
        issues.push(
          contractIssue(
            'contract.input-shape',
            current.path,
            'Contract input has an unsupported object shape.',
          ),
        );
        break;
      }
      const keys = Reflect.ownKeys(objectValue);
      if (
        keys.length > MAX_OBJECT_PROPERTIES ||
        keys.some((key) => typeof key === 'symbol')
      ) {
        issues.push(
          contractIssue(
            'contract.input-complexity',
            current.path,
            'Contract input exceeds the maximum complexity.',
          ),
        );
        break;
      }
      if (
        keys.some((key) => typeof key === 'string' && !consumeStringBudget(key))
      ) {
        issues.push(
          contractIssue(
            'contract.input-complexity',
            current.path,
            'Contract input exceeds the maximum complexity.',
          ),
        );
        break;
      }
      if (scheduledNodeCount + keys.length > MAX_INPUT_NODES) {
        issues.push(
          contractIssue(
            'contract.input-complexity',
            current.path,
            'Contract input exceeds the maximum complexity.',
          ),
        );
        break;
      }
      scheduledNodeCount += keys.length;
      for (const key of keys.reverse()) {
        if (typeof key !== 'string') {
          continue;
        }
        const descriptor = Object.getOwnPropertyDescriptor(objectValue, key);
        if (
          descriptor === undefined ||
          !descriptor.enumerable ||
          !('value' in descriptor)
        ) {
          issues.push(
            contractIssue(
              'contract.input-shape',
              current.path,
              'Contract input has an unsupported object shape.',
            ),
          );
          break;
        }
        pending.push({
          value: descriptor.value,
          depth: current.depth + 1,
          // Object keys are untrusted content and never enter diagnostics.
          path: current.path,
        });
      }
    }
  } catch {
    issues.push(
      contractIssue(
        'contract.input-shape',
        '',
        'Contract input has an unsupported object shape.',
      ),
    );
  }

  return finalizeContractIssues(issues);
}
