import { beforeAll } from 'vitest';

beforeAll(() => {
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    value: (): never => {
      throw new Error(
        'Unexpected provider networking is prohibited in the test suite.',
      );
    },
    writable: true,
  });
});
