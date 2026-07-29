import { readFile } from 'node:fs/promises';

import { parseIngestionReceipt } from '../src/index.ts';

const path = process.argv[2];
if (path === undefined || path.length === 0) {
  throw new Error('An explicit ingestion receipt path is required.');
}
const receipt = parseIngestionReceipt(await readFile(path, 'utf8'));
process.stdout.write(
  `Ingestion receipt valid (${receipt.runId}; ${String(receipt.completedCandidateCount)}/${String(receipt.requestedCandidateCount)} completed; ${receipt.receiptDigest}).\n`,
);
