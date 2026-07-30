import { readFile } from 'node:fs/promises';

import { parseArtifactReceipt } from '../src/index.ts';

const path = process.argv[2];
if (path === undefined || path.length === 0) {
  throw new Error('An explicit repository artifact receipt path is required.');
}
const receipt = parseArtifactReceipt(await readFile(path, 'utf8'));
process.stdout.write(
  `Repository artifact receipt valid (${receipt.runId}; ` +
    `${String(receipt.completedCandidateCount)}/${String(
      receipt.requestedCandidateCount,
    )} completed; ${String(receipt.artifactCount)} artifacts; ` +
    `${receipt.receiptDigest}).\n`,
);
