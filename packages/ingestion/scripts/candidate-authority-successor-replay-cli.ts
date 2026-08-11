import { resolve } from 'node:path';

import {
  generateCandidateAuthoritySuccessorReplayOutputs,
  measureCandidateAuthoritySuccessorReadinessOutputs,
  preflightCandidateAuthoritySuccessorReplay,
  validateCandidateAuthoritySuccessorReadinessOutputs,
  validateCandidateAuthoritySuccessorReplayOutputs,
} from '../src/candidate-authority-successor-replay-runner.ts';
import { asSafeErrorCode } from '../src/errors.ts';
import { createCandidateAuthoritySuccessorReplaySystemEffects } from './candidate-authority-successor-replay-system-effects.ts';

const repositoryRoot = resolve(import.meta.dirname, '../../..');
const [mode, ...unexpected] = process.argv.slice(2);
const commands = {
  'replay-preflight': preflightCandidateAuthoritySuccessorReplay,
  'replay-generate': generateCandidateAuthoritySuccessorReplayOutputs,
  'replay-validate': validateCandidateAuthoritySuccessorReplayOutputs,
  'readiness-measure': measureCandidateAuthoritySuccessorReadinessOutputs,
  'readiness-validate': validateCandidateAuthoritySuccessorReadinessOutputs,
} as const;

const command =
  mode === undefined || !Object.hasOwn(commands, mode)
    ? undefined
    : commands[mode as keyof typeof commands];
if (command === undefined || unexpected.length > 0) {
  process.stderr.write(
    `${JSON.stringify({
      status: 'failed',
      stage: 'candidate-authority-successor-replay-arguments',
      code: 'ingestion.invalid-input',
      credentialReads: 0,
      candidateProviderCalls: 0,
    })}\n`,
  );
  process.exitCode = 1;
} else {
  const effects = createCandidateAuthoritySuccessorReplaySystemEffects({
    repositoryRoot,
  });
  try {
    const result = await command(effects);
    const safe = JSON.parse(JSON.stringify(result)) as Record<string, unknown>;
    delete safe['replay'];
    delete safe['catalog'];
    delete safe['sourceAuthority'];
    delete safe['fieldPlan'];
    process.stdout.write(`${JSON.stringify(safe)}\n`);
  } catch (error) {
    process.stderr.write(
      `${JSON.stringify({
        status: 'failed',
        stage: `candidate-authority-successor-${mode ?? 'unknown'}`,
        code: asSafeErrorCode(error),
        networkCalls: 0,
        credentialReads: 0,
        candidateProviderCalls: 0,
      })}\n`,
    );
    process.exitCode = 1;
  }
}
