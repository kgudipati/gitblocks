import { fileURLToPath } from 'node:url';

import {
  RetrievalExpansionCommandError,
  runRetrievalExpansionCommand,
} from './retrieval-expansion-command.ts';

const repositoryRoot = fileURLToPath(new URL('../../..', import.meta.url));
const argumentsAfterCommand = process.argv.slice(2);
const mode =
  argumentsAfterCommand.length === 0
    ? 'validate'
    : argumentsAfterCommand.length === 1 &&
        argumentsAfterCommand[0] === '--write'
      ? 'generate'
      : null;

if (mode === null) {
  process.stderr.write(
    'Retrieval expansion command accepts only the optional --write flag.\n',
  );
  process.exitCode = 2;
} else {
  try {
    const result = await runRetrievalExpansionCommand(repositoryRoot, mode);
    process.stdout.write(
      `Capability retrieval expansion ${result.mode === 'generate' ? 'written' : 'valid'} ` +
        `(${String(result.edges)} edges; ${String(result.sourceConcepts)} sources; ` +
        `${result.semanticDigest}).\n`,
    );
  } catch (error) {
    const message =
      error instanceof RetrievalExpansionCommandError
        ? error.message
        : 'Capability retrieval expansion command failed safely.';
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}
