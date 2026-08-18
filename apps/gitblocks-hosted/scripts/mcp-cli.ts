import { readHostedRuntimeConfiguration } from '../src/configuration.ts';
import { runGitBlocksMcpCli } from '../src/mcp-cli-runtime.ts';
import { startGitBlocksMcpProcess } from '../src/mcp-process.ts';
import { createOpenAiFitAssessmentModel } from '../src/openai-fit-model.ts';

process.exitCode = await runGitBlocksMcpCli({
  signalSource: process,
  start: (signal) => {
    const configuration = readHostedRuntimeConfiguration(process.env);
    return startGitBlocksMcpProcess({
      database: configuration.database,
      fitModel: createOpenAiFitAssessmentModel({
        configuration: configuration.fitModel,
      }),
      host: configuration.host,
      publicHost: configuration.publicHost,
      port: configuration.port,
      token: configuration.token,
      signal,
      onTransportError: () => {
        process.stderr.write(
          '{"operation":"hosted-mcp.transport","status":"failed","code":"hosted.internal"}\n',
        );
      },
    });
  },
  writeStdout: (text) => process.stdout.write(text),
  writeStderr: (text) => process.stderr.write(text),
});
