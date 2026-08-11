import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  executeCandidateAuthorityLiveCollection,
  preflightCandidateAuthorityLiveCollection,
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
  const effects = createCandidateAuthorityLiveSystemEffects({
    repositoryRoot,
    environment: process.env,
    fetch,
    now: () => new Date(),
  });
  try {
    if (mode === 'preflight') {
      const result = await preflightCandidateAuthorityLiveCollection(effects);
      process.stdout.write(
        `${JSON.stringify({
          status: result.status,
          command: result.command,
          branch: result.git.branch,
          head: result.git.head,
          originHead: result.git.originHead,
          acceptedPreLiveParentHead: result.git.parentHead,
          catalogVersion: result.catalog.catalogVersion,
          catalogDigest: result.catalog.manifestDigest,
          candidateCount: result.catalog.candidates.length,
          mappedNpmCount: result.catalog.candidates.filter(
            (candidate) => candidate.npmPackage !== null,
          ).length,
          liveAuthorizationVersion: result.authorization.authorizationVersion,
          liveAuthorizationDigest:
            result.authorization.authorizationSemanticDigest,
          sourcePolicyVersion: result.sourcePolicy.policyVersion,
          sourcePolicyDigest: result.sourcePolicy.policySemanticDigest,
          sourceOutputPath: result.authorization.paths.sourceAuthority,
          ownedStagingPath: result.authorization.paths.ownedStaging,
          githubLogicalRequestCeiling:
            result.authorization.collection.githubLogicalRequestCeiling,
          npmLogicalRequestCeiling:
            result.authorization.collection.npmLogicalRequestCeiling,
          totalLogicalRequestCeiling:
            result.authorization.collection.totalLogicalRequestCeiling,
          githubAttemptCeiling:
            result.authorization.collection.githubAttemptCeiling,
          npmAttemptCeiling: result.authorization.collection.npmAttemptCeiling,
          totalAttemptCeiling:
            result.authorization.collection.totalAttemptCeiling,
          exactlyOneCollection:
            result.authorization.collection.collectionAuthorizations,
          automaticRerun: result.authorization.collection.automaticRerun,
          effects: result.authorization.effects,
          effectAudit: result.effectAudit,
        })}\n`,
      );
    } else if (mode === 'source-validate') {
      process.stdout.write(
        `${JSON.stringify(await validateCandidateAuthorityLiveSource(effects))}\n`,
      );
    } else {
      const cancellation = new AbortController();
      const cancel = (): void => {
        cancellation.abort();
      };
      process.once('SIGINT', cancel);
      process.once('SIGTERM', cancel);
      try {
        const result = await executeCandidateAuthorityLiveCollection(
          effects,
          cancellation.signal,
        );
        process.stdout.write(
          `${JSON.stringify({
            status: result.status,
            command: result.command,
            credentialAvailable: result.credentialAvailable,
            collectionCutoff: result.collectionCutoff,
            outputPath: result.outputPath,
            authorityVersion: result.authority.authorityVersion,
            authorityDigest: result.authority.canonicalAuthorityDigest,
            effectReceipt: result.authority.effectReceipt,
          })}\n`,
        );
      } finally {
        process.removeListener('SIGINT', cancel);
        process.removeListener('SIGTERM', cancel);
      }
    }
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
