import { constants, open } from 'node:fs/promises';

import { runRepositoryInterviewOperatorCliV1 } from '../src/cli.ts';

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
        if (!stat.isFile() || stat.size > maximumBytes) {
          throw new Error('Configuration file is invalid.');
        }
        const bytes = await handle.readFile();
        if (bytes.byteLength > maximumBytes) {
          throw new Error('Configuration file is invalid.');
        }
        return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      } finally {
        await handle.close().catch(() => undefined);
      }
    },
    readEnvironment: (name) => process.env[name],
    createFetch: () => globalThis.fetch.bind(globalThis),
    writeStdout: (text) => process.stdout.write(text),
    writeStderr: (text) => process.stderr.write(text),
  },
);

process.exitCode = exitCode;
