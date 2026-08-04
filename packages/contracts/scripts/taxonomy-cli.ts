import { fileURLToPath } from 'node:url';

import {
  runTaxonomyCommand,
  TaxonomyCommandError,
} from './taxonomy-command.ts';

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
    'Taxonomy command accepts only the optional --write flag.\n',
  );
  process.exitCode = 2;
} else {
  try {
    const result = await runTaxonomyCommand(repositoryRoot, mode);
    process.stdout.write(
      `Capability taxonomy ${result.mode === 'generate' ? 'written' : 'valid'} ` +
        `(${String(result.concepts)} concepts; ` +
        `${String(result.resolvedAliases)} resolved aliases; ` +
        `${String(result.ambiguities)} ambiguities; ` +
        `${String(result.exclusions)} exclusions; ${result.semanticDigest}).\n`,
    );
  } catch (error) {
    const message =
      error instanceof TaxonomyCommandError
        ? error.message
        : 'Taxonomy command failed safely.';
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}
