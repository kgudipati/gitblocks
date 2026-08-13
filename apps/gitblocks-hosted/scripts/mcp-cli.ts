import {
  readHostedMcpPortConfiguration,
  readHostedFitModelConfiguration,
  readHostedServingDatabaseConfiguration,
} from '../src/configuration.ts';
import { hostedDiscoveryErrorCode } from '../src/errors.ts';
import { startGitBlocksMcpProcess } from '../src/mcp-process.ts';
import { createOpenAiFitAssessmentModel } from '../src/openai-fit-model.ts';

const controller = new AbortController();
const abort = (): void => {
  controller.abort();
};
process.once('SIGINT', abort);
process.once('SIGTERM', abort);

let hostedProcess;
try {
  const database = readHostedServingDatabaseConfiguration(process.env);
  const port = readHostedMcpPortConfiguration(process.env);
  const fitModel = createOpenAiFitAssessmentModel({
    configuration: readHostedFitModelConfiguration(process.env),
  });
  hostedProcess = await startGitBlocksMcpProcess({
    database,
    fitModel,
    port,
    signal: controller.signal,
    onTransportError: () => {
      process.stderr.write(
        '{"operation":"hosted-mcp.transport","status":"failed","code":"hosted.internal"}\n',
      );
    },
  });
  process.stdout.write(
    `${JSON.stringify({
      operation: 'hosted-mcp.start',
      status: 'ready',
      endpoint: hostedProcess.endpoint.href,
    })}\n`,
  );
  await waitForAbort(controller.signal);
  await hostedProcess.close();
  process.stdout.write(
    '{"operation":"hosted-mcp.shutdown","status":"complete"}\n',
  );
} catch (error) {
  process.stderr.write(
    `${JSON.stringify({
      operation:
        hostedProcess === undefined
          ? 'hosted-mcp.start'
          : 'hosted-mcp.shutdown',
      status: 'failed',
      code: hostedDiscoveryErrorCode(error),
    })}\n`,
  );
  process.exitCode = 1;
} finally {
  process.removeListener('SIGINT', abort);
  process.removeListener('SIGTERM', abort);
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
