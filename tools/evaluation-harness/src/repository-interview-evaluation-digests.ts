import { createHash } from 'node:crypto';

import type {
  RepositoryInterviewAdjudicationRecordV1,
  RepositoryInterviewAuditRecordV1,
  RepositoryInterviewAuditScopeV1,
  RepositoryInterviewEvaluationManifestV1,
  RepositoryInterviewGateReportV1,
  RepositoryInterviewRunSummaryV1,
} from './repository-interview-evaluation-contracts.ts';
import { stableJson } from './stable-json.ts';

const CORPUS_DOMAIN = 'gitblocks\0repository-interview-evaluation-corpus\0v1\0';
const REPORT_DOMAIN = 'gitblocks\0repository-interview-gate-report\0v1\0';
const INVENTORY_DOMAIN =
  'gitblocks\0repository-interview-audit-inventory\0v1\0';
const RUN_DOMAIN = 'gitblocks\0repository-interview-run-summary\0v1\0';
const SCOPE_SET_DOMAIN =
  'gitblocks\0repository-interview-audit-scope-set\0v1\0';
const AUDIT_SET_DOMAIN = 'gitblocks\0repository-interview-audit-set\0v1\0';
const ADJUDICATION_SET_DOMAIN =
  'gitblocks\0repository-interview-adjudication-set\0v1\0';

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
    schemas: manifest.schemas,
    candidates: manifest.candidates,
    adversarialFixtures: manifest.adversarialFixtures,
  });
}

export function repositoryInterviewAuditInventoryDigestV1(
  scope: Omit<RepositoryInterviewAuditScopeV1, 'inventoryDigest'>,
): string {
  return digest(INVENTORY_DOMAIN, scope);
}

export function repositoryInterviewRunSummaryDigestV1(
  run: RepositoryInterviewRunSummaryV1,
): string {
  return digest(RUN_DOMAIN, run);
}

export function repositoryInterviewAuditScopeSetDigestV1(
  scopes: readonly RepositoryInterviewAuditScopeV1[],
): string {
  return digest(
    SCOPE_SET_DOMAIN,
    [...scopes].sort((left, right) =>
      compareText(left.candidateId, right.candidateId),
    ),
  );
}

export function repositoryInterviewAuditSetDigestV1(
  audits: readonly RepositoryInterviewAuditRecordV1[],
): string {
  return digest(
    AUDIT_SET_DOMAIN,
    [...audits].sort((left, right) =>
      compareText(left.reviewId, right.reviewId),
    ),
  );
}

export function repositoryInterviewAdjudicationSetDigestV1(
  adjudications: readonly RepositoryInterviewAdjudicationRecordV1[],
): string {
  return digest(
    ADJUDICATION_SET_DOMAIN,
    [...adjudications].sort((left, right) =>
      compareText(left.adjudicationId, right.adjudicationId),
    ),
  );
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

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
