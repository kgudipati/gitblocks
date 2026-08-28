import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

const ROOT = new URL('../../../', import.meta.url);

const ACCEPTED_BYTES = {
  '.github/workflows/ci.yml':
    '9132cbb3d598664db90073863cc754821e3bed7b2fbf3e4f71e53027c2b8f31d',
  'catalog/public-v1/candidate-profile-authority.json':
    '9bb38d297df247c2d00acf4ce45a5e52b72c78177d128138e2fc1d4151477230',
  'catalog/public-v1/candidates.json':
    '07d572ceaeb760acc7443b4d1736e77a6790018bb7a7fae9e006b6f2cd59446f',
  'catalog/public-v1/manifest.json':
    '1209e94d17041691d9766eeedb699bc5303ec075d166eb7ef4dff9e35d112f94',
  'packages/contracts/src/deterministic-candidate-profile-schemas.ts':
    'f2fcde9b9749ec22c4421e3de2961b4aeb60e080bcdaadf8f89d135669847ecc',
  'packages/domain/src/deterministic-candidate-profile.ts':
    'c019b67b3a436f64fc440b0152bfc98f575ae1d6fa62ae5479b5257e3462dbce',
  'packages/persistence/migrations/0001_evidence_persistence.sql':
    '569d7a6d6db70b1b04cadfa8798516ce4239b1179bb2f7cdd84b27641e33755f',
  'packages/persistence/migrations/0002_runtime_migration_verification.sql':
    'b61cf8ad8673663c646b77e8f0ebed452898aab795aa64f52217e1271e1dc2ae',
  'packages/persistence/migrations/0003_immutable_repository_artifacts.sql':
    '0ea1e4698e8eec6d33320df7af4758ae6b3b4fcbe3da387bb042d074b86228dc',
  'packages/persistence/migrations/0004_repository_interviews.sql':
    '2cd18e7d92373215b2a540cdf12e32a7e949bfb01866616e8a44ad326e45bca0',
  'pnpm-lock.yaml':
    '36fb9579f09af54aac8ed0600fd1966710e6796caeecf58aeaba46191888a707',
  'verification/retrieval-v1/profile-coverage.json':
    'a1c0427ac4e0c4997204aab74ddcef8713eecf674b907eab139b057c82c54cb6',
} as const;

const MATERIALIZATION_IMPLEMENTATION = [
  'packages/ingestion/src/candidate-profile-materialization.ts',
  'packages/ingestion/src/profile-materialization-contracts.ts',
  'packages/ingestion/src/profile-materialization-coverage.ts',
  'packages/ingestion/src/profile-materialization-policy.ts',
  'packages/ingestion/src/profile-materialization-providers.ts',
  'packages/ingestion/src/profile-materialization-receipt.ts',
  'packages/ingestion/src/profile-materialization-runner.ts',
  'packages/ingestion/src/profile-materialization-source-authority.ts',
] as const;

describe('profile-materialization Milestone 7A scope', () => {
  it('preserves workflow, migrations, product profile authority, and lockfile bytes', async () => {
    for (const [path, expected] of Object.entries(ACCEPTED_BYTES)) {
      const bytes = await readFile(new URL(path, ROOT));
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(expected);
    }
  });

  it('contains no dossier/model/evaluation import in the controlled implementation', async () => {
    for (const path of MATERIALIZATION_IMPLEMENTATION) {
      const source = await readFile(new URL(path, ROOT), 'utf8');
      expect(source).not.toMatch(/CandidateDossier|profileCandidate\s*\(/u);
      expect(source).not.toMatch(/OPENAI|ModelExecution|provider-model/iu);
      expect(source).not.toMatch(
        /(?:from|import\s*)[^\n]*(?:evals\/|evaluation-harness)/u,
      );
    }
  });

  it('keeps pure projection free of clock, randomness, environment, provider, database, and prose parsing', async () => {
    for (const path of [
      'packages/ingestion/src/candidate-profile-materialization.ts',
      'packages/ingestion/src/profile-materialization-coverage.ts',
    ]) {
      const source = await readFile(new URL(path, ROOT), 'utf8');
      expect(source).not.toMatch(
        /(?:Date\.now|new Date|Math\.random|process\.env|fetch\s*\(|postgres|createPersistence|README|rationale)/iu,
      );
    }
  });

  it('does not create Milestone 7B fixed evidence in the implementation change', async () => {
    for (const path of [
      'catalog/public-v1/profile-materialization-completion.md',
      'verification/retrieval-v1/profile-materialization-coverage.json',
      'verification/retrieval-v1/profile-materialization-receipt.json',
    ]) {
      await expect(readFile(new URL(path, ROOT))).rejects.toMatchObject({
        code: 'ENOENT',
      });
    }
  });
});
