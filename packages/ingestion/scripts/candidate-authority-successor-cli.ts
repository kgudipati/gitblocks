import { resolve } from 'node:path';

import {
  executeCandidateAuthoritySuccessorV7,
  preflightCandidateAuthoritySuccessorV7,
  renderCandidateAuthoritySuccessorFailureV7,
} from '../src/candidate-authority-live-v7-runner.ts';
import { CANDIDATE_AUTHORITY_SUCCESSOR_SOURCE_PATH } from '../src/candidate-authority-successor-contracts.ts';
import {
  createCandidateAuthoritySuccessorSystemEffects,
  validateCandidateAuthoritySuccessorPublishedSource,
} from './candidate-authority-successor-system-effects.ts';

const repositoryRoot = resolve(import.meta.dirname, '../../..');
const [mode, flag, acceptedHead, ...unexpected] = process.argv.slice(2);

if (
  !['preflight', 'collect', 'source-validate'].includes(mode ?? '') ||
  flag !== '--accepted-head' ||
  acceptedHead === undefined ||
  !/^[a-f0-9]{40}$/u.test(acceptedHead) ||
  unexpected.length > 0
) {
  process.stderr.write(
    renderCandidateAuthoritySuccessorFailureV7(new Error('invalid arguments')),
  );
  process.exitCode = 1;
} else {
  const effects = createCandidateAuthoritySuccessorSystemEffects({
    repositoryRoot,
    environment: process.env,
    fetch,
    now: () => new Date(),
  });
  try {
    if (mode === 'preflight') {
      const result = await preflightCandidateAuthoritySuccessorV7(
        effects,
        acceptedHead,
      );
      process.stdout.write(
        `${JSON.stringify({
          status: result.status,
          command: 'candidate-authority-successor-preflight',
          acceptedHead: result.acceptedHead,
          branch: result.branch,
          head: result.head,
          originHead: result.originHead,
          parentHead: result.parentHead,
          candidateCount: result.catalog.candidates.length,
          mappedNpmCount: result.catalog.candidates.filter(
            (candidate) => candidate.npmPackage !== null,
          ).length,
          unchangedRouteCount: result.providerRoutes.unchangedCount,
          redirectedRouteCount: result.providerRoutes.redirectedCount,
          sourcePolicyVersion: result.sourcePolicy.policyVersion,
          authorizationVersion: result.authorization.version,
          effectAudit: result.effectAudit,
        })}\n`,
      );
    } else if (mode === 'collect') {
      const authority = await executeCandidateAuthoritySuccessorV7(
        effects,
        acceptedHead,
      );
      process.stdout.write(
        `${JSON.stringify({
          status: 'passed',
          command: 'candidate-authority-successor-collect',
          outputPath: CANDIDATE_AUTHORITY_SUCCESSOR_SOURCE_PATH,
          collectionCutoff: authority.collectionCutoff,
          sourceDigest: authority.canonicalAuthorityDigest,
          effectReceipt: authority.effectReceipt,
        })}\n`,
      );
    } else {
      const authority =
        await validateCandidateAuthoritySuccessorPublishedSource({
          repositoryRoot,
          acceptedHead,
        });
      process.stdout.write(
        `${JSON.stringify({
          status: 'passed',
          command: 'candidate-authority-successor-source-validate',
          acceptedHead,
          candidateCount: authority.candidateCount,
          authorityVersion: authority.authorityVersion,
          operatorVersion: authority.operatorVersion,
          sourceDigest: authority.canonicalAuthorityDigest,
          effectAudit: {
            networkCalls: 0,
            candidateProviderCalls: 0,
            credentialReads: 0,
            databaseCalls: 0,
            dockerCalls: 0,
            modelCalls: 0,
            filesystemWrites: 0,
            providerCollections: 0,
            sourceAuthoritiesGenerated: 0,
            allCandidateProjections: 0,
            coverageCalculations: 0,
          },
        })}\n`,
      );
    }
  } catch (error) {
    process.stderr.write(renderCandidateAuthoritySuccessorFailureV7(error));
    process.exitCode = 1;
  }
}
