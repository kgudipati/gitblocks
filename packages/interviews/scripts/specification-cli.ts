import { fileURLToPath } from 'node:url';

import {
  REPOSITORY_INTERVIEW_CURRENT_SPECIFICATION_VERSION,
  REPOSITORY_INTERVIEW_SPECIFICATION_VERSION,
  validateRepositoryInterviewSpecification,
  writeRepositoryInterviewSpecification,
} from '../src/index.ts';

const specificationDirectories = Object.freeze({
  [REPOSITORY_INTERVIEW_SPECIFICATION_VERSION]: fileURLToPath(
    new URL(
      '../../../interviews/repository/specifications/1.0.0/',
      import.meta.url,
    ),
  ),
  [REPOSITORY_INTERVIEW_CURRENT_SPECIFICATION_VERSION]: fileURLToPath(
    new URL(
      '../../../interviews/repository/specifications/1.0.1/',
      import.meta.url,
    ),
  ),
});
const mode = process.argv[2];

try {
  const summaries =
    mode === 'validate'
      ? await Promise.all(
          Object.values(specificationDirectories).map((directory) =>
            validateRepositoryInterviewSpecification(directory),
          ),
        )
      : mode === 'generate'
        ? [
            await writeRepositoryInterviewSpecification(
              specificationDirectories[
                REPOSITORY_INTERVIEW_CURRENT_SPECIFICATION_VERSION
              ],
            ),
          ]
        : null;
  if (summaries === null || process.argv.length !== 3) {
    process.stderr.write('Usage: specification-cli.ts <generate|validate>\\n');
    process.exitCode = 2;
  } else {
    for (const summary of summaries) {
      process.stdout.write(
        `Repository interview specification ${mode === 'generate' ? 'generated' : 'valid'} ` +
          `(${summary.specificationVersion}; ${summary.specificationDigest}; ` +
          `${summary.providerOutputSchemaDigest}; ${summary.openAiProjectionDigest}).\n`,
      );
    }
  }
} catch {
  process.stderr.write(
    'Repository interview specification validation failed.\n',
  );
  process.exitCode = 1;
}
