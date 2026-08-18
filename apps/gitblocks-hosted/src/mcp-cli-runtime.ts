import { HostedConfigurationError } from './configuration.ts';
import { hostedDiscoveryErrorCode } from './errors.ts';
import type { GitBlocksMcpProcessV1 } from './mcp-process.ts';

type HostedShutdownSignalV1 = 'SIGINT' | 'SIGTERM';

export interface HostedMcpSignalSourceV1 {
  readonly once: (
    signal: HostedShutdownSignalV1,
    listener: () => void,
  ) => unknown;
  readonly removeListener: (
    signal: HostedShutdownSignalV1,
    listener: () => void,
  ) => unknown;
}

export async function runGitBlocksMcpCli(input: {
  readonly signalSource: HostedMcpSignalSourceV1;
  readonly start: (signal: AbortSignal) => Promise<GitBlocksMcpProcessV1>;
  readonly writeStdout: (text: string) => void;
  readonly writeStderr: (text: string) => void;
}): Promise<0 | 1> {
  const controller = new AbortController();
  const abort = (): void => {
    controller.abort();
  };
  input.signalSource.once('SIGINT', abort);
  input.signalSource.once('SIGTERM', abort);

  let hostedProcess: GitBlocksMcpProcessV1 | undefined;
  try {
    hostedProcess = await input.start(controller.signal);
    input.writeStdout(
      `${JSON.stringify({
        operation: 'hosted-mcp.start',
        status: 'ready',
        endpoint: hostedProcess.endpoint.href,
      })}\n`,
    );
    await waitForAbort(controller.signal);
    await hostedProcess.close();
    input.writeStdout(
      '{"operation":"hosted-mcp.shutdown","status":"complete"}\n',
    );
    return 0;
  } catch (error) {
    if (controller.signal.aborted && hostedProcess === undefined) {
      input.writeStdout(
        '{"operation":"hosted-mcp.shutdown","status":"complete"}\n',
      );
      return 0;
    }
    input.writeStderr(
      `${JSON.stringify({
        operation:
          hostedProcess === undefined
            ? 'hosted-mcp.start'
            : 'hosted-mcp.shutdown',
        status: 'failed',
        code: hostedDiscoveryErrorCode(error),
        ...(error instanceof HostedConfigurationError
          ? { problems: error.problems }
          : {}),
      })}\n`,
    );
    return 1;
  } finally {
    input.signalSource.removeListener('SIGINT', abort);
    input.signalSource.removeListener('SIGTERM', abort);
  }
}

function waitForAbort(signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    signal.addEventListener(
      'abort',
      () => {
        resolve();
      },
      { once: true },
    );
  });
}
