import { open } from 'node:fs/promises';
import { resolve } from 'node:path';

import { readHostedServingDatabaseConfiguration } from './configuration.ts';
import { startHostedDiscoveryComposition } from './composition.ts';
import { HostedDiscoveryError, hostedDiscoveryErrorCode } from './errors.ts';

const REQUEST_FILE_MAX_BYTES = 64 * 1024;

export interface HostedDiscoveryExerciseOutput {
  readonly operation: 'hosted-discovery.exercise';
  readonly status: 'complete';
  readonly snapshotId: string;
  readonly snapshotRecordDigest: string;
  readonly candidateCount: number;
  readonly servingSnapshotLoads: 1;
  readonly discoveryRequests: 2;
  readonly deterministicReplay: true;
  readonly resultSemanticDigest: string;
  readonly eligibleCandidateIds: readonly string[];
  readonly evidenceNeededCandidateIds: readonly string[];
}

export async function runHostedDiscoveryExercise(input: {
  readonly arguments: readonly string[];
  readonly environment: Readonly<Record<string, string | undefined>>;
  readonly signal?: AbortSignal;
  readonly writeOutput: (text: string) => void;
  readonly writeError: (text: string) => void;
}): Promise<number> {
  let composition;
  let output: HostedDiscoveryExerciseOutput | undefined;
  let failure:
    | {
        readonly operation:
          'hosted-discovery.exercise' | 'hosted-discovery.shutdown';
        readonly code: ReturnType<typeof hostedDiscoveryErrorCode>;
      }
    | undefined;
  try {
    const requestPath = parseRequestPath(input.arguments);
    const request = await readRequest(requestPath);
    const database = readHostedServingDatabaseConfiguration(input.environment);
    composition = await startHostedDiscoveryComposition({
      database,
      ...(input.signal === undefined ? {} : { signal: input.signal }),
    });
    const readiness = composition.readiness();
    if (!readiness.ready) {
      throw new HostedDiscoveryError('hosted.internal');
    }
    const first = composition.discoverCapability(request);
    const second = composition.discoverCapability(request);
    if (
      !first.ok ||
      !second.ok ||
      first.result.outcome !== 'retrieved' ||
      second.result.outcome !== 'retrieved' ||
      JSON.stringify(first.result) !== JSON.stringify(second.result)
    ) {
      throw new HostedDiscoveryError('hosted.discovery-failed');
    }
    output = Object.freeze({
      operation: 'hosted-discovery.exercise',
      status: 'complete',
      snapshotId: readiness.snapshot.snapshotId,
      snapshotRecordDigest: readiness.snapshot.snapshotRecordDigest,
      candidateCount: readiness.snapshot.candidateCount,
      servingSnapshotLoads: 1,
      discoveryRequests: 2,
      deterministicReplay: true,
      resultSemanticDigest: first.result.shortlist.semanticDigest,
      eligibleCandidateIds: first.result.shortlist.eligibleCandidates.map(
        ({ candidateId }) => candidateId,
      ),
      evidenceNeededCandidateIds:
        first.result.shortlist.evidenceNeededCandidates.map(
          ({ candidateId }) => candidateId,
        ),
    });
  } catch (error) {
    failure = Object.freeze({
      operation: 'hosted-discovery.exercise',
      code: hostedDiscoveryErrorCode(error),
    });
  } finally {
    if (composition !== undefined) {
      try {
        await composition.close();
      } catch (error) {
        failure ??= Object.freeze({
          operation: 'hosted-discovery.shutdown',
          code: hostedDiscoveryErrorCode(error),
        });
      }
    }
  }
  if (failure !== undefined || output === undefined) {
    input.writeError(
      `${JSON.stringify({
        operation: failure?.operation ?? 'hosted-discovery.exercise',
        status: 'failed',
        code: failure?.code ?? 'hosted.internal',
      })}\n`,
    );
    return 1;
  }
  input.writeOutput(`${JSON.stringify(output)}\n`);
  return 0;
}

function parseRequestPath(arguments_: readonly string[]): string {
  if (
    arguments_.length !== 2 ||
    arguments_[0] !== '--request' ||
    arguments_[1] === undefined ||
    arguments_[1].length === 0
  ) {
    throw new HostedDiscoveryError('hosted.invalid-request-file');
  }
  return resolve(arguments_[1]);
}

async function readRequest(path: string): Promise<unknown> {
  let handle;
  try {
    handle = await open(path, 'r');
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size < 1 || stat.size > REQUEST_FILE_MAX_BYTES) {
      throw new HostedDiscoveryError('hosted.invalid-request-file');
    }
    const text = await handle.readFile({ encoding: 'utf8' });
    if (Buffer.byteLength(text, 'utf8') > REQUEST_FILE_MAX_BYTES) {
      throw new HostedDiscoveryError('hosted.invalid-request-file');
    }
    return JSON.parse(text) as unknown;
  } catch (error) {
    if (error instanceof HostedDiscoveryError) throw error;
    throw new HostedDiscoveryError('hosted.invalid-request-file');
  } finally {
    await handle?.close().catch(() => undefined);
  }
}
