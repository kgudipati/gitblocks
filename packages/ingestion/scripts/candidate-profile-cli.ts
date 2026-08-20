import { fileURLToPath } from 'node:url';

import {
  CandidateProfileCommandError,
  runCandidateProfileCommand,
} from './candidate-profile-command.ts';

const repositoryRoot = fileURLToPath(new URL('../../..', import.meta.url));
const args = process.argv.slice(2);
const mode =
  args.length === 0
    ? 'validate'
    : args.length === 1 && args[0] === '--write'
      ? 'generate'
      : null;

if (mode === null) {
  process.stderr.write(
    'Candidate-profile command accepts only the optional --write flag.\n',
  );
  process.exitCode = 2;
} else {
  try {
    const result = await runCandidateProfileCommand(repositoryRoot, mode);
    process.stdout.write(
      `Candidate profiles ${result.mode === 'generate' ? 'written' : 'valid'} ` +
        `(${String(result.profiles)} profiles; known=${String(result.known)}; ` +
        `unknown=${String(result.unknown)}; not-applicable=${String(result.notApplicable)}; ` +
        `conflict=${String(result.conflict)}; partial=${String(result.partial)}; ` +
        `complete=${String(result.complete)}; ${result.authorityDigest}; ` +
        `${result.coverageDigest}).\n`,
    );
  } catch (error) {
    process.stderr.write(
      `${
        error instanceof CandidateProfileCommandError
          ? error.message
          : 'Candidate-profile command failed safely.'
      }\n`,
    );
    process.exitCode = 1;
  }
}
