import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    fileParallelism: false,
    include: [
      'packages/persistence/test/integration/**/*.integration.ts',
      'tools/evaluation-harness/test/**/*.persistence-integration.ts',
    ],
    maxWorkers: 1,
    passWithNoTests: false,
    restoreMocks: true,
    hookTimeout: 30_000,
    testTimeout: 30_000,
  },
});
