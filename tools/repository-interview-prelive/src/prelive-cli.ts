import { serializeCanonicalJson } from '@gitblocks/interviews';

import {
  generateRepositoryInterviewPreliveFilesV1,
  repositoryInterviewPreliveSummaryV1,
  validateRepositoryInterviewPreliveFilesV1,
} from './verification.ts';

const command = process.argv[2];
if (command !== 'generate' && command !== 'validate') {
  throw new Error('Repository interview pre-live command is invalid.');
}
const repositoryRoot = process.cwd();
const expected =
  command === 'generate'
    ? await generateRepositoryInterviewPreliveFilesV1(repositoryRoot)
    : await validateRepositoryInterviewPreliveFilesV1(repositoryRoot);
process.stdout.write(
  serializeCanonicalJson(repositoryInterviewPreliveSummaryV1(expected)),
);
