import { randomBytes } from 'node:crypto';
import { constants, link, open, unlink } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

import type {
  RepositoryInterviewOpenAiAttemptControlPortV1,
  RepositoryInterviewOpenAiClockPortV1,
  RepositoryInterviewOpenAiCredentialPortV1,
  RepositoryInterviewOpenAiFetchV1,
  RepositoryInterviewOpenAiSleeperPortV1,
} from '@gitblocks/interviews';

import type {
  RepositoryInterviewOperatorMonotonicClockPortV1,
  RepositoryInterviewOperatorRunIdPortV1,
  RepositoryInterviewOperatorWallClockPortV1,
} from './operator.ts';

export class RepositoryInterviewOperatorProcessError extends Error {
  public constructor() {
    super('Repository interview operator process operation failed.');
    this.name = 'RepositoryInterviewOperatorProcessError';
    Object.defineProperty(this, 'stack', { value: undefined });
  }
}

export function createLazyEnvironmentCredentialPortV1(
  variableName: string,
  readEnvironment: (name: string) => string | undefined,
): RepositoryInterviewOpenAiCredentialPortV1 {
  return Object.freeze({
    getBearerToken() {
      const token = readEnvironment(variableName);
      if (
        typeof token !== 'string' ||
        token.length < 1 ||
        token.length > 4_096 ||
        hasControlCharacter(token)
      )
        return Promise.reject(new RepositoryInterviewOperatorProcessError());
      return Promise.resolve(token);
    },
  });
}

function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint !== undefined && (codePoint <= 0x1f || codePoint === 0x7f)) {
      return true;
    }
  }
  return false;
}

export function createExplicitGlobalFetchPortV1(
  fetchImplementation: typeof globalThis.fetch,
): RepositoryInterviewOpenAiFetchV1 {
  return async (input, init) => fetchImplementation(input, init);
}

export function createProcessClockPortsV1(): {
  readonly wall: RepositoryInterviewOperatorWallClockPortV1;
  readonly monotonic: RepositoryInterviewOperatorMonotonicClockPortV1;
  readonly openAi: RepositoryInterviewOpenAiClockPortV1;
} {
  let lastWall = 0;
  let lastMonotonic = 0;
  const read = () => {
    const wall = Date.now();
    const monotonic = Math.floor(performance.now());
    if (wall < lastWall || monotonic < lastMonotonic) {
      throw new RepositoryInterviewOperatorProcessError();
    }
    lastWall = wall;
    lastMonotonic = monotonic;
    return { wall, monotonic };
  };
  return Object.freeze({
    wall: Object.freeze({ now: () => new Date(read().wall).toISOString() }),
    monotonic: Object.freeze({ nowMilliseconds: () => read().monotonic }),
    openAi: Object.freeze({
      now: () => {
        const value = read();
        return Object.freeze({
          timestamp: new Date(value.wall).toISOString(),
          monotonicMilliseconds: value.monotonic,
        });
      },
    }),
  });
}

export function createProcessNoncePortV1(): {
  nextExecutionNonce(): string;
} {
  return Object.freeze({
    nextExecutionNonce: () => randomBytes(16).toString('hex'),
  });
}

export function createProcessRunIdPortV1(): RepositoryInterviewOperatorRunIdPortV1 {
  return Object.freeze({
    nextRunId: () => `interview-run-${randomBytes(24).toString('hex')}`,
  });
}

export function createProcessSleeperPortV1(): RepositoryInterviewOpenAiSleeperPortV1 {
  return Object.freeze({
    sleep: (milliseconds: number) =>
      new Promise<void>((resolve) => {
        setTimeout(resolve, milliseconds);
      }),
  });
}

export function createProcessAttemptControlPortV1(
  runSignal?: AbortSignal,
): RepositoryInterviewOpenAiAttemptControlPortV1 {
  return Object.freeze({
    beginAttempt({
      timeoutMilliseconds,
    }: {
      readonly ordinal: 1 | 2;
      readonly timeoutMilliseconds: 120_000;
    }) {
      const controller = new AbortController();
      let outcome: 'completed' | 'deadline-exceeded' | 'cancelled' =
        'completed';
      const onRunAbort = () => {
        outcome = 'cancelled';
        controller.abort();
      };
      runSignal?.addEventListener('abort', onRunAbort, { once: true });
      const timer = setTimeout(() => {
        if (outcome === 'completed') outcome = 'deadline-exceeded';
        controller.abort();
      }, timeoutMilliseconds);
      timer.unref();
      let disposed = false;
      return Object.freeze({
        signal: controller.signal,
        outcome: () => outcome,
        dispose: () => {
          if (disposed) return;
          disposed = true;
          clearTimeout(timer);
          runSignal?.removeEventListener('abort', onRunAbort);
        },
      });
    },
  });
}

export function createProcessRunDeadlineControlV1(
  controller: AbortController,
  timeoutMilliseconds: number,
): { dispose(): void } {
  if (
    !Number.isSafeInteger(timeoutMilliseconds) ||
    timeoutMilliseconds < 1 ||
    timeoutMilliseconds > 86_400_000
  ) {
    throw new RepositoryInterviewOperatorProcessError();
  }
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMilliseconds);
  let disposed = false;
  return Object.freeze({
    dispose() {
      if (disposed) return;
      disposed = true;
      clearTimeout(timer);
    },
  });
}

export async function writeRepositoryInterviewOperatorReceiptFileV1(
  finalPath: string,
  content: string,
): Promise<void> {
  const directory = dirname(finalPath);
  const temporaryPath = join(
    directory,
    `.${basename(finalPath)}.${randomBytes(16).toString('hex')}.tmp`,
  );
  let temporaryCreated = false;
  let finalCreated = false;
  try {
    const file = await open(
      temporaryPath,
      constants.O_CREAT |
        constants.O_EXCL |
        constants.O_WRONLY |
        constants.O_NOFOLLOW,
      0o600,
    );
    temporaryCreated = true;
    try {
      await file.writeFile(content, { encoding: 'utf8' });
      await file.sync();
    } finally {
      await file.close().catch(() => undefined);
    }
    await link(temporaryPath, finalPath);
    finalCreated = true;
    await unlink(temporaryPath);
    temporaryCreated = false;
    const directoryHandle = await open(directory, constants.O_RDONLY);
    try {
      await directoryHandle.sync();
    } finally {
      await directoryHandle.close().catch(() => undefined);
    }
  } catch {
    if (temporaryCreated) await unlink(temporaryPath).catch(() => undefined);
    if (finalCreated) await unlink(finalPath).catch(() => undefined);
    throw new RepositoryInterviewOperatorProcessError();
  }
}
