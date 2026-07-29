import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      enabled: false,
      exclude: [
        'packages/contracts/src/index.ts',
        'packages/domain/src/index.ts',
        'packages/persistence/src/index.ts',
        'packages/ingestion/src/index.ts',
        'tools/evaluation-harness/src/cli.ts',
        'tools/evaluation-harness/src/contract-conformance-cli.ts',
        'tools/evaluation-harness/src/index.ts',
        'tools/repository-checks/src/cli.ts',
        'tools/repository-checks/src/index.ts',
      ],
      include: [
        'packages/contracts/src/**/*.ts',
        'packages/domain/src/**/*.ts',
        'packages/persistence/src/**/*.ts',
        'packages/ingestion/src/**/*.ts',
        'tools/evaluation-harness/src/**/*.ts',
        'tools/repository-checks/src/**/*.ts',
        'tools/runtime-preflight.mjs',
      ],
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      reportsDirectory: 'coverage',
    },
    include: [
      'packages/contracts/test/**/*.test.ts',
      'packages/domain/test/**/*.test.ts',
      'packages/persistence/test/**/*.test.ts',
      'packages/ingestion/test/**/*.test.ts',
      'tools/evaluation-harness/test/**/*.test.ts',
      'tools/repository-checks/test/**/*.test.{mjs,ts}',
    ],
    passWithNoTests: false,
    restoreMocks: true,
  },
});
