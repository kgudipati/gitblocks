import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      enabled: false,
      exclude: [
        'tools/evaluation-harness/src/cli.ts',
        'tools/evaluation-harness/src/index.ts',
        'tools/repository-checks/src/cli.ts',
        'tools/repository-checks/src/index.ts',
      ],
      include: [
        'tools/evaluation-harness/src/**/*.ts',
        'tools/repository-checks/src/**/*.ts',
        'tools/runtime-preflight.mjs',
      ],
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      reportsDirectory: 'coverage',
    },
    include: [
      'tools/evaluation-harness/test/**/*.test.ts',
      'tools/repository-checks/test/**/*.test.{mjs,ts}',
    ],
    passWithNoTests: false,
    restoreMocks: true,
  },
});
