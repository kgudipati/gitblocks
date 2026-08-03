export function copyBoundedPlainArray(
  value: unknown,
  maximumLength: number,
): readonly unknown[] | null {
  try {
    if (
      !Array.isArray(value) ||
      Reflect.getPrototypeOf(value) !== Array.prototype
    ) {
      return null;
    }

    const keys = Reflect.ownKeys(value);
    if (keys.some((key) => typeof key !== 'string')) {
      return null;
    }

    const lengthDescriptor = Reflect.getOwnPropertyDescriptor(value, 'length');
    if (
      lengthDescriptor === undefined ||
      !('value' in lengthDescriptor) ||
      lengthDescriptor.enumerable ||
      typeof lengthDescriptor.value !== 'number' ||
      !Number.isSafeInteger(lengthDescriptor.value) ||
      lengthDescriptor.value < 0 ||
      lengthDescriptor.value > maximumLength
    ) {
      return null;
    }

    const length = lengthDescriptor.value;
    if (keys.length !== length + 1 || !keys.includes('length')) {
      return null;
    }

    const owned: unknown[] = [];
    for (let index = 0; index < length; index += 1) {
      const key = String(index);
      if (!keys.includes(key)) {
        return null;
      }
      const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
      if (
        descriptor === undefined ||
        !descriptor.enumerable ||
        !('value' in descriptor)
      ) {
        return null;
      }
      owned.push(descriptor.value);
    }
    return Object.freeze(owned);
  } catch {
    return null;
  }
}
