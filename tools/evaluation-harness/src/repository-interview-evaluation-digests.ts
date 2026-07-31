import { createHash } from 'node:crypto';

import type {
  RepositoryInterviewEvaluationManifestV1,
  RepositoryInterviewGateReportV1,
} from './repository-interview-evaluation-contracts.ts';
import { stableJson } from './stable-json.ts';

const CORPUS_DOMAIN = 'gitblocks\0repository-interview-evaluation-corpus\0v1\0';
const REPORT_DOMAIN = 'gitblocks\0repository-interview-gate-report\0v1\0';

export function repositoryInterviewEvaluationCorpusDigestV1(
  manifest: Omit<RepositoryInterviewEvaluationManifestV1, 'corpusDigest'>,
): string {
  return digest(CORPUS_DOMAIN, {
    kind: 'repository-interview-evaluation-corpus',
    digestVersion: 1,
    corpusId: manifest.corpusId,
    corpusVersion: manifest.corpusVersion,
    authority: manifest.authority,
    policies: manifest.policies,
    candidates: manifest.candidates,
    adversarialFixtures: manifest.adversarialFixtures,
  });
}

export function repositoryInterviewGateReportDigestV1(
  report: Omit<RepositoryInterviewGateReportV1, 'reportDigest'>,
): string {
  return digest(REPORT_DOMAIN, report);
}

function digest(domain: string, value: unknown): string {
  const bytes = Buffer.from(stableJson(value), 'utf8');
  const length = Buffer.alloc(8);
  length.writeBigUInt64BE(BigInt(bytes.length));
  return createHash('sha256')
    .update(domain, 'utf8')
    .update(length)
    .update(bytes)
    .digest('hex');
}
