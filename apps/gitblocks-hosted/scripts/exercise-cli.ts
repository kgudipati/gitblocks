import { runHostedDiscoveryExercise } from '../src/exercise.ts';

const controller = new AbortController();
const abort = (): void => {
  controller.abort();
};
process.once('SIGINT', abort);
process.once('SIGTERM', abort);

try {
  process.exitCode = await runHostedDiscoveryExercise({
    arguments: process.argv.slice(2),
    environment: process.env,
    signal: controller.signal,
    writeOutput: (text) => process.stdout.write(text),
    writeError: (text) => process.stderr.write(text),
  });
} finally {
  process.removeListener('SIGINT', abort);
  process.removeListener('SIGTERM', abort);
}
