import { open } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
  readHostedFitModelConfiguration,
  readHostedServingDatabaseConfiguration,
} from './configuration.ts';
import { startHostedRecommendationComposition } from './composition.ts';
import { HostedDiscoveryError, hostedDiscoveryErrorCode } from './errors.ts';
import { createOpenAiFitAssessmentModel } from './openai-fit-model.ts';

const REQUEST_FILE_MAX_BYTES = 512 * 1024;

export interface HostedRecommendationExerciseOutput {
  readonly operation: 'hosted-recommendation.exercise';
  readonly status: 'complete';
  readonly model: string;
  readonly snapshotId: string;
  readonly candidateCount: number;
  readonly outcome: string;
  readonly finalistCount: number;
  readonly responsibleOptionCount: number;
}

export async function runHostedRecommendationExercise(input: {
  readonly arguments: readonly string[];
  readonly environment: Readonly<Record<string, string | undefined>>;
  readonly signal?: AbortSignal;
  readonly writeOutput: (text: string) => void;
  readonly writeError: (text: string) => void;
}): Promise<number> {
  let composition;
  let output: HostedRecommendationExerciseOutput | undefined;
  let failure:
    | {
        readonly operation:
          'hosted-recommendation.exercise' | 'hosted-recommendation.shutdown';
        readonly code: ReturnType<typeof hostedDiscoveryErrorCode>;
      }
    | undefined;
  try {
    const request = await readRequest(parseRequestPath(input.arguments));
    const database = readHostedServingDatabaseConfiguration(input.environment);
    const modelConfiguration = readHostedFitModelConfiguration(
      input.environment,
    );
    composition = await startHostedRecommendationComposition({
      database,
      fitModel: createOpenAiFitAssessmentModel({
        configuration: modelConfiguration,
      }),
      ...(input.signal === undefined ? {} : { signal: input.signal }),
    });
    const readiness = composition.readiness();
    if (!readiness.ready) {
      throw new HostedDiscoveryError('hosted.internal');
    }
    const result = await composition.recommendOss(request);
    if (!result.ok) {
      throw new HostedDiscoveryError('hosted.discovery-failed');
    }
    output = Object.freeze({
      operation: 'hosted-recommendation.exercise',
      status: 'complete',
      model: modelConfiguration.model,
      snapshotId: readiness.snapshot.snapshotId,
      candidateCount: readiness.snapshot.candidateCount,
      outcome: result.result.outcome,
      finalistCount:
        'shortlist' in result.result
          ? Math.min(5, result.result.shortlist.eligibleCandidates.length)
          : 0,
      responsibleOptionCount:
        result.result.outcome === 'recommend'
          ? result.result.responsibleOptions.length
          : 0,
    });
  } catch (error) {
    failure = Object.freeze({
      operation: 'hosted-recommendation.exercise',
      code: hostedDiscoveryErrorCode(error),
    });
  } finally {
    if (composition !== undefined) {
      try {
        await composition.close();
      } catch (error) {
        failure ??= Object.freeze({
          operation: 'hosted-recommendation.shutdown',
          code: hostedDiscoveryErrorCode(error),
        });
      }
    }
  }
  if (failure !== undefined || output === undefined) {
    input.writeError(
      `${JSON.stringify({
        operation: failure?.operation ?? 'hosted-recommendation.exercise',
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
