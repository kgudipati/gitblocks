import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      enabled: false,
      exclude: [
        'tools/repository-checks/src/cli.ts',
        'tools/repository-checks/src/index.ts',
      ],
      include: [
        'tools/repository-checks/src/**/*.ts',
        'tools/runtime-preflight.mjs',
      ],
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      reportsDirectory: 'coverage',
    },
    include: ['tools/repository-checks/test/**/*.test.{mjs,ts}'],
    passWithNoTests: false,
    restoreMocks: true,
  },
});
