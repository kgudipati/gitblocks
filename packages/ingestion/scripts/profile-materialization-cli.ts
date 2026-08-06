import { lstat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  PROFILE_MATERIALIZATION_FIXED_PATHS,
  executeProfileMaterialization,
  preflightProfileMaterialization,
  verifyProfileMaterializationEvidence,
} from '../src/index.ts';
import { createProfileMaterializationSystemEffects } from './profile-materialization-system-effects.ts';

const repositoryRoot = fileURLToPath(new URL('../../..', import.meta.url));
const [mode, ...arguments_] = process.argv.slice(2);

try {
  if (mode === 'preflight') {
    const result = await preflightProfileMaterialization(
      arguments_,
      createEffects(),
    );
    process.stdout.write(
      `Profile materialization preflight passed (${result.commandPlanDigest}; ${result.databasePlan.planDigest}).\n`,
    );
  } else if (mode === 'execute') {
    const cancellation = new AbortController();
    const cancel = (): void => {
      cancellation.abort();
    };
    process.once('SIGINT', cancel);
    process.once('SIGTERM', cancel);
    try {
      const evidence = await executeProfileMaterialization(
        arguments_,
        createEffects(),
        cancellation.signal,
      );
      process.stdout.write(
        `Profile materialization completed (${evidence.receipt.receiptSemanticDigest}; ${evidence.receipt.receiptRecordDigest}).\n`,
      );
    } finally {
      process.removeListener('SIGINT', cancel);
      process.removeListener('SIGTERM', cancel);
    }
  } else if (mode === 'verify' && arguments_.length === 0) {
    const effects = createEffects();
    const paths = Object.values(PROFILE_MATERIALIZATION_FIXED_PATHS).filter(
      (path) =>
        path.includes('profile-materialization-') &&
        !path.endsWith('provider-policy.json'),
    );
    const before = await Promise.all(
      paths.map(async (path) => ({
        path,
        stat: await fixedEvidenceStat(path),
      })),
    );
    const [receiptText, coverageText, completionText] = await Promise.all([
      effects.readFixedFile(PROFILE_MATERIALIZATION_FIXED_PATHS.receipt),
      effects.readFixedFile(PROFILE_MATERIALIZATION_FIXED_PATHS.coverage),
      effects.readFixedFile(PROFILE_MATERIALIZATION_FIXED_PATHS.completion),
    ]);
    const evidence = verifyProfileMaterializationEvidence(
      JSON.parse(receiptText),
      JSON.parse(coverageText),
      completionText,
    );
    const after = await Promise.all(
      paths.map(async (path) => ({
        path,
        stat: await fixedEvidenceStat(path),
      })),
    );
    if (
      before.some((entry, index) => {
        const current = after[index];
        return (
          current?.path !== entry.path ||
          current.stat.size !== entry.stat.size ||
          current.stat.mode !== entry.stat.mode ||
          current.stat.mtimeMs !== entry.stat.mtimeMs ||
          current.stat.ctimeMs !== entry.stat.ctimeMs
        );
      })
    ) {
      throw new Error('Profile materialization verification observed a write.');
    }
    process.stdout.write(
      `Profile materialization evidence verified read-only (${evidence.receipt.receiptSemanticDigest}; effect-audit=no-write).\n`,
    );
  } else {
    process.stderr.write(
      'Profile materialization command rejected unexpected arguments.\n',
    );
    process.exitCode = 2;
  }
} catch {
  process.stderr.write('Profile materialization command failed safely.\n');
  process.exitCode = 1;
}

function createEffects() {
  return createProfileMaterializationSystemEffects({
    repositoryRoot,
    environment: process.env,
    fetch,
    now: () => new Date(),
  });
}

async function fixedEvidenceStat(path: string) {
  const file = await lstat(resolve(repositoryRoot, path));
  if (!file.isFile() || file.isSymbolicLink()) {
    throw new Error('Profile materialization evidence path is unsafe.');
  }
  return file;
}
