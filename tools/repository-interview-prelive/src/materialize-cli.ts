import { runRepositoryInterviewPreliveMaterializeCommandV1 } from './materialize-command.ts';

try {
  await runRepositoryInterviewPreliveMaterializeCommandV1(
    process.argv.slice(2),
    {
      repositoryRoot: process.cwd(),
      readEnvironment: (name) => process.env[name],
    },
  );
  process.stdout.write('Repository interview materialization completed.\n');
} catch {
  process.stderr.write('Repository interview materialization failed.\n');
  process.exitCode = 1;
}
