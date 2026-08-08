import { lstat, readFile, writeFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CANDIDATE_RETRIEVAL_METADATA_GITHUB_TOKEN_ENVIRONMENT,
  abortableSleep,
  collectCandidateRetrievalMetadataAuthority,
  createTransport,
  executeCandidateRetrievalMetadataCollection,
  preflightCandidateRetrievalMetadataCollection,
  type CandidateRetrievalMetadataCollectionEffects,
} from '../src/index.ts';

const repositoryRoot = resolve(
  fileURLToPath(new URL('../../..', import.meta.url)),
);
const [mode, ...unexpectedArguments] = process.argv.slice(2);

if (
  unexpectedArguments.length > 0 ||
  (mode !== 'preflight' && mode !== 'collect')
) {
  throw new Error('Retrieval metadata command rejected unexpected arguments.');
}

const effects = createEffects();
if (mode === 'preflight') {
  const result = await preflightCandidateRetrievalMetadataCollection(effects);
  const operation = result.envelope.sourceOperation;
  process.stdout.write(
    `${JSON.stringify({
      status: 'passed',
      command: result.command,
      outputPath: result.outputPath,
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
} else {
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
      `Candidate retrieval metadata authority collected (${authority.authoritySemanticDigest}).\n`,
    );
  } finally {
    process.removeListener('SIGINT', cancel);
    process.removeListener('SIGTERM', cancel);
  }
}

function createEffects(): CandidateRetrievalMetadataCollectionEffects {
  return {
    readFixedFile,
    requireOutputMissing: async (path) => {
      const target = fixedPath(path);
      try {
        await lstat(target);
      } catch (error) {
        if (isMissing(error)) return;
        throw error;
      }
      throw new Error('Candidate retrieval metadata authority already exists.');
    },
    readCredential: (name) => {
      if (name !== CANDIDATE_RETRIEVAL_METADATA_GITHUB_TOKEN_ENVIRONMENT) {
        throw new Error('Unexpected credential name.');
      }
      const credential = process.env[name];
      if (credential === undefined || credential.length === 0) {
        throw new Error(
          'Candidate retrieval metadata credential is unavailable.',
        );
      }
      return credential;
    },
    collect: async (preflight, credential, signal) => {
      const operation = preflight.envelope.sourceOperation;
      const transport = createTransport({
        fetch,
        sleep: abortableSleep,
        requestTimeoutMilliseconds: operation.requestTimeoutMilliseconds,
        maximumRedirects: operation.maximumRedirects,
        maximumAttempts: operation.maximumAttempts,
      });
      const collectedAt = new Date().toISOString();
      return collectCandidateRetrievalMetadataAuthority(preflight.catalog, {
        transport,
        sourceProviderPolicy: preflight.sourcePolicy,
        collectionEnvelope: preflight.envelope,
        githubToken: credential,
        correlationId: `retrieval-metadata-${collectedAt}`,
        collectedAt,
        signal,
      });
    },
    writeExclusive: async (path, text) => {
      await writeFile(fixedPath(path), text, { encoding: 'utf8', flag: 'wx' });
    },
  };
}

async function readFixedFile(path: string): Promise<string> {
  const target = fixedPath(path);
  const stat = await lstat(target);
  if (
    !stat.isFile() ||
    stat.isSymbolicLink() ||
    stat.size > 32 * 1_024 * 1_024
  ) {
    throw new Error('Candidate retrieval metadata input path is unsafe.');
  }
  return readFile(target, 'utf8');
}

function fixedPath(path: string): string {
  const target = resolve(repositoryRoot, path);
  if (!target.startsWith(`${repositoryRoot}${sep}`)) {
    throw new Error(
      'Candidate retrieval metadata path escaped the repository.',
    );
  }
  return target;
}

function isMissing(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ENOENT'
  );
}
