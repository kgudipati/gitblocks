import { constants, open } from 'node:fs/promises';

import { parseCompleteArtifactReceiptTextV1 } from '@gitblocks/ingestion';
import { modelExecutionModelProfileDigest } from '@gitblocks/contracts';
import { runRepositoryInterviewOperatorCliV1 } from '@gitblocks/repository-interview-operator';

import { validateRepositoryInterviewPreliveAuthorizationClosureV1 } from './authorization.ts';
import {
  validateCommittedRepositoryInterviewCandidatePlanV1,
  validateRepositoryInterviewPreliveFilesV1,
} from './verification.ts';

let expectedPromise:
  ReturnType<typeof validateRepositoryInterviewPreliveFilesV1> | undefined;
const expected = () =>
  (expectedPromise ??= validateRepositoryInterviewPreliveFilesV1(
    process.cwd(),
  ));

const exitCode = await runRepositoryInterviewOperatorCliV1(
  process.argv.slice(2),
  {
    async readTextFile(path, maximumBytes) {
      const handle = await open(
        path,
        constants.O_RDONLY | constants.O_NOFOLLOW,
      );
      try {
        const stat = await handle.stat();
        if (!stat.isFile() || stat.size > maximumBytes) throw invalid();
        const bytes = await handle.readFile();
        if (bytes.byteLength > maximumBytes) throw invalid();
        return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      } finally {
        await handle.close().catch(() => undefined);
      }
    },
    readEnvironment: (name) => process.env[name],
    createFetch: () => globalThis.fetch.bind(globalThis),
    writeStdout: (text) => process.stdout.write(text),
    writeStderr: (text) => process.stderr.write(text),
    async validateCandidatePlan(candidatePlan) {
      const authority = await expected();
      return validateCommittedRepositoryInterviewCandidatePlanV1(
        candidatePlan,
        authority.plans,
      );
    },
    async parseCompleteArtifactReceipt(text) {
      const authority = await expected();
      return parseCompleteArtifactReceiptTextV1(text, {
        catalogVersion: 'public-v1',
        catalogDigest: authority.manifest.catalogDigest,
        artifactManifestVersion: 'public-artifacts-v1',
        artifactManifestDigest: authority.manifest.artifactManifestDigest,
        candidateIds: authority.catalogCandidateIds,
      });
    },
    async validatePreliveClosure(input) {
      const authority = await expected();
      const profiles = authority.profiles
        .map(modelExecutionModelProfileDigest)
        .sort() as [string, string];
      return validateRepositoryInterviewPreliveAuthorizationClosureV1({
        candidatePlan: input.candidatePlan,
        calibrationCandidatePlan: authority.plans.calibration,
        artifactReceipt: input.artifactReceipt,
        fullCatalogCandidateIds: authority.catalogCandidateIds,
        selection: input.selection,
        materialization: input.materialization,
        authorization: input.authorization,
        modelProfile: input.modelProfile,
        operatorPolicy: input.operatorPolicy,
        allowedModelProfileDigests: profiles,
        specificationDigest: input.specificationDigest,
        ...(input.now === undefined ? {} : { now: input.now }),
      });
    },
    authorizationNow: () => new Date().toISOString(),
  },
);

process.exitCode = exitCode;

function invalid(): Error {
  const error = new Error('Repository interview operator file is invalid.');
  Object.defineProperty(error, 'stack', { value: undefined });
  return error;
}
