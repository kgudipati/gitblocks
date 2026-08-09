import {
  closeSync,
  constants,
  existsSync,
  fstatSync,
  ftruncateSync,
  lstatSync,
  openSync,
  realpathSync,
  statSync,
  writeSync,
  fsyncSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import type { RetrievalBaselineReport } from './baseline-report.ts';
import { retrievalStableJson } from './stable-json.ts';

export const RETRIEVAL_BASELINE_REPORT_RELATIVE_PATH =
  'verification/retrieval-v1/baseline-report.json' as const;
export const RETRIEVAL_V2_BASELINE_REPORT_RELATIVE_PATH =
  'verification/retrieval-v2/baseline-report.json' as const;
const MAXIMUM_REPORT_BYTES = 2 * 1024 * 1024;

export function writeRetrievalBaselineReportV1(
  repositoryRoot: string,
  report: RetrievalBaselineReport,
): void {
  writeRetrievalBaselineReport(
    repositoryRoot,
    report,
    RETRIEVAL_BASELINE_REPORT_RELATIVE_PATH,
  );
}

export function writeRetrievalBaselineReportV2(
  repositoryRoot: string,
  report: RetrievalBaselineReport,
): void {
  writeRetrievalBaselineReport(
    repositoryRoot,
    report,
    RETRIEVAL_V2_BASELINE_REPORT_RELATIVE_PATH,
  );
}

function writeRetrievalBaselineReport(
  repositoryRoot: string,
  report: RetrievalBaselineReport,
  relativePath:
    | typeof RETRIEVAL_BASELINE_REPORT_RELATIVE_PATH
    | typeof RETRIEVAL_V2_BASELINE_REPORT_RELATIVE_PATH,
): void {
  const root = resolve(repositoryRoot);
  if (realpathSync(root) !== root || !statSync(root).isDirectory()) {
    throw new Error('Baseline report repository root must be canonical.');
  }
  const parent = dirname(join(root, relativePath));
  if (realpathSync(parent) !== parent || !statSync(parent).isDirectory()) {
    throw new Error('Baseline report parent must be a canonical directory.');
  }
  const path = join(root, relativePath);
  if (existsSync(path) && lstatSync(path).isSymbolicLink()) {
    throw new Error('Baseline report path must not be a symbolic link.');
  }
  const bytes = Buffer.from(retrievalStableJson(report), 'utf8');
  if (bytes.length > MAXIMUM_REPORT_BYTES) {
    throw new Error('Baseline report exceeds its fixed byte limit.');
  }
  let descriptor: number | undefined;
  try {
    descriptor = openSync(
      path,
      constants.O_WRONLY | constants.O_CREAT | constants.O_NOFOLLOW,
      0o644,
    );
    if (!fstatSync(descriptor).isFile()) {
      throw new Error('Baseline report target must be a regular file.');
    }
    ftruncateSync(descriptor, 0);
    let offset = 0;
    while (offset < bytes.length) {
      const written = writeSync(
        descriptor,
        bytes,
        offset,
        bytes.length - offset,
      );
      if (written <= 0)
        throw new Error('Baseline report write was incomplete.');
      offset += written;
    }
    fsyncSync(descriptor);
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}
