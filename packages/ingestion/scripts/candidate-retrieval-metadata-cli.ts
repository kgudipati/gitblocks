import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CANDIDATE_RETRIEVAL_METADATA_AUTHORITY_PATH,
  executeCandidateRetrievalMetadataCollection,
  preflightCandidateRetrievalMetadataCollection,
  renderCandidateRetrievalMetadataCliFailure,
  validateCandidateRetrievalMetadataAuthority,
} from '../src/index.ts';
import { createCandidateRetrievalMetadataSystemEffects } from './candidate-retrieval-metadata-system-effects.ts';

const repositoryRoot = resolve(
  fileURLToPath(new URL('../../..', import.meta.url)),
);
const [mode, ...unexpectedArguments] = process.argv.slice(2);

if (
  unexpectedArguments.length > 0 ||
  (mode !== 'preflight' && mode !== 'collect' && mode !== 'validate')
) {
  process.stderr.write(
    renderCandidateRetrievalMetadataCliFailure(mode, new Error('invalid')),
  );
  process.exitCode = 1;
} else {
  try {
    await run(mode);
  } catch (error) {
    process.stderr.write(
      renderCandidateRetrievalMetadataCliFailure(mode, error),
    );
    process.exitCode = 1;
  }
}

async function run(mode: 'preflight' | 'collect' | 'validate'): Promise<void> {
  const effects = createCandidateRetrievalMetadataSystemEffects({
    repositoryRoot,
    environment: process.env,
    fetch,
    now: () => new Date(),
  });
  if (mode === 'preflight') {
    const result = await preflightCandidateRetrievalMetadataCollection(effects);
    const operation = result.envelope.sourceOperation;
    process.stdout.write(
      `${JSON.stringify({
        status: 'passed',
        command: result.command,
        outputPath: result.outputPath,
        stagingPath: result.stagingPath,
        authorityVersion: result.envelope.policy.authority.authorityVersion,
        catalogVersion: result.catalog.catalogVersion,
        catalogDigest: result.catalog.manifestDigest,
        providerPolicyVersion: result.envelope.policy.policyVersion,
        providerPolicyDigest: result.envelope.policy.policySemanticDigest,
        sourceProviderPolicyVersion: result.sourcePolicy.policyVersion,
        sourceProviderPolicyDigest: result.sourcePolicy.policySemanticDigest,
        candidateCount: result.catalog.candidates.length,
        allowedOperations: result.envelope.policy.allowedOperations,
        logicalRequestBudget: result.envelope.policy.logicalRequestBudget,
        worstCaseRequestAttemptBudget:
          result.envelope.policy.worstCaseRequestAttemptBudget,
        host: operation.host,
        endpointTemplate: operation.endpointTemplate,
        method: operation.method,
        credentialEnvironmentName: result.credentialEnvironmentName,
        concurrency: operation.concurrency,
        maximumResponseBytes: operation.maximumResponseBytes,
        maximumJsonNodes: operation.maximumJsonNodes,
        requestTimeoutMilliseconds: operation.requestTimeoutMilliseconds,
        maximumAttempts: operation.maximumAttempts,
        maximumRedirects: operation.maximumRedirects,
        candidateDeadlineMilliseconds: operation.candidateDeadlineMilliseconds,
        runDeadlineMilliseconds: operation.runDeadlineMilliseconds,
        requirements: result.requirements,
        effectAudit: {
          networkCalls: 0,
          credentialReads: 0,
          writes: 0,
        },
      })}\n`,
    );
    return;
  }
  if (mode === 'validate') {
    const result = await validateCandidateRetrievalMetadataAuthority(effects);
    process.stdout.write(
      `${JSON.stringify({
        ...result,
        effectAudit: {
          networkCalls: 0,
          credentialReads: 0,
          writes: 0,
        },
      })}\n`,
    );
    return;
  }
  const cancellation = new AbortController();
  const cancel = (): void => {
    cancellation.abort();
  };
  process.once('SIGINT', cancel);
  process.once('SIGTERM', cancel);
  try {
    const authority = await executeCandidateRetrievalMetadataCollection(
      effects,
      cancellation.signal,
    );
    process.stdout.write(
      `${JSON.stringify({
        status: 'passed',
        operation: 'candidate-retrieval-metadata-collect',
        outputPath: CANDIDATE_RETRIEVAL_METADATA_AUTHORITY_PATH,
        snapshotId: authority.snapshotId,
        authoritySemanticDigest: authority.authoritySemanticDigest,
        candidateCount: authority.candidates.length,
      })}\n`,
    );
  } finally {
    process.removeListener('SIGINT', cancel);
    process.removeListener('SIGTERM', cancel);
  }
}
