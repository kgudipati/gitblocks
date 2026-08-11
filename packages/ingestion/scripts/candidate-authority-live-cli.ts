import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  renderCandidateAuthorityLiveFailure,
  validateCandidateAuthorityLiveSource,
} from '../src/candidate-authority-live-runner.ts';
import { createCandidateAuthorityLiveSystemEffects } from './candidate-authority-live-system-effects.ts';

const repositoryRoot = resolve(
  fileURLToPath(new URL('../../..', import.meta.url)),
);
const [mode, ...unexpected] = process.argv.slice(2);

if (
  (mode !== 'preflight' && mode !== 'collect' && mode !== 'source-validate') ||
  unexpected.length > 0
) {
  process.stderr.write(
    renderCandidateAuthorityLiveFailure('arguments', new Error('invalid')),
  );
  process.exitCode = 1;
} else {
  if (mode === 'preflight' || mode === 'collect') {
    process.stderr.write(
      `${JSON.stringify({
        status: 'failed',
        stage: `candidate-authority-live-${mode}`,
        code: 'ingestion.invalid-input',
        priorAuthorization: 'consumed-no-remaining-collections',
        successorAuthorization:
          'inactive-pending-independent-exact-head-acceptance',
        credentialReads: 0,
        candidateProviderCalls: 0,
      })}\n`,
    );
    process.exitCode = 1;
  } else {
    const effects = createCandidateAuthorityLiveSystemEffects({
      repositoryRoot,
      environment: process.env,
      fetch,
      now: () => new Date(),
    });
    try {
      process.stdout.write(
        `${JSON.stringify(await validateCandidateAuthorityLiveSource(effects))}\n`,
      );
    } catch (error) {
      process.stderr.write(
        renderCandidateAuthorityLiveFailure(
          `candidate-authority-live-${mode}`,
          error,
        ),
      );
      process.exitCode = 1;
    }
  }
}
