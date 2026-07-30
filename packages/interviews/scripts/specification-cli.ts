import { fileURLToPath } from 'node:url';

import {
  validateRepositoryInterviewSpecification,
  writeRepositoryInterviewSpecification,
} from '../src/index.ts';

const specificationDirectory = fileURLToPath(
  new URL(
    '../../../interviews/repository/specifications/1.0.0/',
    import.meta.url,
  ),
);
const mode = process.argv[2];

try {
  const summary =
    mode === 'validate'
      ? await validateRepositoryInterviewSpecification(specificationDirectory)
      : mode === 'generate'
        ? await writeRepositoryInterviewSpecification(specificationDirectory)
        : null;
  if (summary === null || process.argv.length !== 3) {
    process.stderr.write('Usage: specification-cli.ts <generate|validate>\\n');
    process.exitCode = 2;
  } else {
    process.stdout.write(
      `Repository interview specification ${mode === 'generate' ? 'generated' : 'valid'} ` +
        `(${summary.specificationVersion}; ${summary.specificationDigest}; ` +
        `${summary.providerOutputSchemaDigest}; ${summary.openAiProjectionDigest}).\n`,
    );
  }
} catch {
  process.stderr.write(
    'Repository interview specification validation failed.\n',
  );
  process.exitCode = 1;
}
