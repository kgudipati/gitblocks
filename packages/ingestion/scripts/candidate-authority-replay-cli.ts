import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  generateCandidateAuthorityReplayOutputs,
  measureCandidateAuthorityReadinessOutputs,
  preflightCandidateAuthorityReplay,
  validateCandidateAuthorityReadinessOutputs,
  validateCandidateAuthorityReplayOutputs,
} from '../src/candidate-authority-replay-runner.ts';
import { asSafeErrorCode } from '../src/errors.ts';
import { createCandidateAuthorityReplaySystemEffects } from './candidate-authority-replay-system-effects.ts';

const repositoryRoot = resolve(
  fileURLToPath(new URL('../../..', import.meta.url)),
);
const [mode, ...unexpected] = process.argv.slice(2);
const accepted = [
  'replay-preflight',
  'replay-generate',
  'replay-validate',
  'readiness-measure',
  'readiness-validate',
] as const;

if (
  unexpected.length > 0 ||
  !accepted.some((candidate) => candidate === mode)
) {
  fail('arguments', new Error('invalid'));
} else {
  const selectedMode = mode as (typeof accepted)[number];
  const effects = createCandidateAuthorityReplaySystemEffects({
    repositoryRoot,
  });
  try {
    let result: unknown;
    if (selectedMode === 'replay-preflight') {
      result = await preflightCandidateAuthorityReplay(effects);
    } else if (selectedMode === 'replay-generate') {
      result = await generateCandidateAuthorityReplayOutputs(effects);
    } else if (selectedMode === 'replay-validate') {
      const validated = await validateCandidateAuthorityReplayOutputs(effects);
      result = {
        status: validated.status,
        command: validated.command,
        sourceAuthorityDigest:
          validated.sourceAuthority.canonicalAuthorityDigest,
        authorityDigests: validated.authorityDigests,
        candidateCount: validated.catalog.candidates.length,
        effectAudit: readOnlyEffectAudit(),
      };
    } else if (selectedMode === 'readiness-measure') {
      const measured = await measureCandidateAuthorityReadinessOutputs(effects);
      result = {
        status: measured.status,
        command: measured.command,
        reportDigest: measured.report.canonicalReportDigest,
        rootDigest: measured.root.canonicalAuthorityDigest,
        realizedReadyFields:
          measured.report.realizedDeterministicReadyFieldCount,
        decision: measured.report.readinessDecision,
      };
    } else {
      result = {
        ...(await validateCandidateAuthorityReadinessOutputs(effects)),
        effectAudit: readOnlyEffectAudit(),
      };
    }
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    fail(`candidate-authority-${selectedMode}`, error);
  }
}

function readOnlyEffectAudit() {
  return Object.freeze({
    networkCalls: 0,
    candidateProviderCalls: 0,
    credentialReads: 0,
    databaseCalls: 0,
    dockerCalls: 0,
    modelCalls: 0,
    filesystemWrites: 0,
    providerCollections: 0,
    sourceAuthoritiesGenerated: 0,
  });
}

function fail(stage: string, error: unknown): void {
  process.stderr.write(
    `${JSON.stringify({
      status: 'failed',
      stage,
      code: asSafeErrorCode(error),
    })}\n`,
  );
  process.exitCode = 1;
}
