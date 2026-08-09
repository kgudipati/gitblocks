import {
  RETRIEVAL_V2_VERSIONS,
  type ReviewedRelevanceProvenance,
  type RetrievalDiagnostic,
} from './contracts.ts';
import { loadRetrievalJsonFile } from './json-boundary.ts';
import { createRetrievalSchemaRegistry } from './schema-registry.ts';
import { retrievalSemanticDigest } from './stable-json.ts';

export const RETRIEVAL_V2_REVIEW_RECORD_RELATIVE_PATH =
  'verification/retrieval-v2/independent-review.json' as const;

export interface ReviewedGradeCorrection {
  readonly caseId: string;
  readonly candidateId: string;
  readonly oldGrade: 0;
  readonly newGrade: 1 | 2 | 3;
  readonly reasonCode:
    | 'committed-curation-adjacent-match'
    | 'committed-curation-direct-match'
    | 'committed-curation-relevant-match';
}

export const RETRIEVAL_V2_REVIEWED_GRADE_CORRECTIONS = [
  correction('ret-audit-logging-03', 'audit-fluent-bit', 1),
  correction('ret-audit-logging-03', 'audit-fluentd', 1),
  correction('ret-audit-logging-03', 'audit-google-logging-winston', 1),
  correction('ret-audit-logging-03', 'audit-grafana-loki', 1),
  correction('ret-audit-logging-03', 'audit-logdna-logger', 1),
  correction('ret-audit-logging-03', 'audit-openobserve', 1),
  correction('ret-audit-logging-03', 'audit-sematext-logagent', 1),
  correction('ret-audit-logging-03', 'audit-syslog-ng', 1),
  correction('ret-audit-logging-03', 'audit-vector', 1),
  correction('ret-audit-logging-03', 'audit-winston-syslog', 1),
  correction('ret-audit-logging-03', 'audit-winston-transport', 1),
  correction('ret-authorization-03', 'auth-authzed-spicedb', 3),
  correction('ret-authorization-03', 'auth-openfga', 3),
  correction('ret-authorization-03', 'auth-ory-keto', 3),
  correction('ret-authorization-03', 'auth-permify', 3),
  correction('ret-authorization-03', 'auth-warrant', 3),
  correction('ret-background-jobs-03', 'jobs-bee-queue', 2),
  correction('ret-background-jobs-03', 'jobs-kue', 2),
  correction('ret-background-jobs-03', 'jobs-resque', 2),
  correction('ret-background-jobs-03', 'jobs-rq', 3),
  correction('ret-rate-limiting-03', 'rate-apisix', 1),
  correction('ret-rate-limiting-03', 'rate-envoy-ratelimit', 2),
  correction('ret-rate-limiting-03', 'rate-express-rate-limit', 2),
  correction('ret-rate-limiting-03', 'rate-fastify-rate-limit', 2),
  correction('ret-rate-limiting-03', 'rate-gravitee', 1),
  correction('ret-rate-limiting-03', 'rate-koa-ratelimit', 2),
  correction('ret-rate-limiting-03', 'rate-kong', 1),
  correction('ret-rate-limiting-03', 'rate-krakend', 1),
  correction('ret-rate-limiting-03', 'rate-nestjs-throttler', 2),
  correction('ret-rate-limiting-03', 'rate-node-ratelimiter', 2),
  correction('ret-rate-limiting-03', 'rate-tyk', 1),
  correction('ret-webhooks-03', 'webhook-adnanh', 2),
  correction('ret-webhooks-03', 'webhook-webhook-site', 1),
] as const satisfies readonly ReviewedGradeCorrection[];

export interface RetrievalIndependentReviewRecordV2 {
  readonly reviewVersion: typeof RETRIEVAL_V2_VERSIONS.independentReview;
  readonly sourceAuthority: {
    readonly corpusVersion: 'retrieval-evaluation-corpus/1.0.0';
    readonly corpusSemanticDigest: string;
  };
  readonly evidence: {
    readonly blindBundleSha256: string;
    readonly independentReviewSha256: string;
    readonly comparisonSummarySha256: string;
    readonly gradeDisagreementsSha256: string;
    readonly binaryRelevanceDisagreementsSha256: string;
  };
  readonly scope: {
    readonly reviewedCases: 30;
    readonly reviewedJudgments: 636;
  };
  readonly comparison: {
    readonly proposedGradeDistribution: GradeDistribution;
    readonly independentGradeDistribution: GradeDistribution;
    readonly exactGradeAgreements: 274;
    readonly exactGradeDisagreements: 362;
    readonly binaryAgreements: 595;
    readonly binaryDisagreements: 41;
    readonly proposedIrrelevantIndependentRelevant: 41;
    readonly proposedRelevantIndependentIrrelevant: 0;
    readonly preferredCaseBinaryDisagreements: 33;
    readonly namedComparisonBinaryDisagreements: 8;
    readonly proposedToIndependentMatrix: readonly (readonly [
      number,
      number,
      number,
      number,
    ])[];
  };
  readonly reconciliation: {
    readonly rules: readonly [
      'preferred-is-soft',
      'strict-graded-calibration',
      'explicit-named-comparison-remains-narrow',
    ];
    readonly acceptedPreferredCorrections: 33;
    readonly rejectedComparisonCompanionChanges: 8;
    readonly retainedSameBinaryCalibrationJudgments: 321;
    readonly unchangedProposedGrades: 603;
    readonly finalGradeDistribution: GradeDistribution;
  };
  readonly semanticDigest: string;
}

interface GradeDistribution {
  readonly grade0: number;
  readonly grade1: number;
  readonly grade2: number;
  readonly grade3: number;
}

function correction(
  caseId: string,
  candidateId: string,
  newGrade: 1 | 2 | 3,
): ReviewedGradeCorrection {
  return {
    caseId,
    candidateId,
    oldGrade: 0,
    newGrade,
    reasonCode:
      newGrade === 1
        ? 'committed-curation-adjacent-match'
        : newGrade === 2
          ? 'committed-curation-relevant-match'
          : 'committed-curation-direct-match',
  };
}

export function createRetrievalIndependentReviewRecordV2(): RetrievalIndependentReviewRecordV2 {
  const withoutDigest = {
    reviewVersion: RETRIEVAL_V2_VERSIONS.independentReview,
    sourceAuthority: {
      corpusVersion: 'retrieval-evaluation-corpus/1.0.0' as const,
      corpusSemanticDigest:
        '3638596a5c330c3516003beab908b0b5631c84f41d957f78ce2cc1379cc682de',
    },
    evidence: {
      blindBundleSha256:
        'd1517ef206081d4e03bbff4588b7954742e47deae627bec34a9544954a32ae29',
      independentReviewSha256:
        'a2e137c05d88c6db71e28cfaad99aafa66b1d2b460d5fcee2ea6f958a1148e5c',
      comparisonSummarySha256:
        'bf3093fc38d0a390cfb42e5e4853f9ae85c3bfd5df2171a6f650f687295649b2',
      gradeDisagreementsSha256:
        '92d7771ada7f055365a80b8c1965b0925dab612c88476a78311dc734353866b6',
      binaryRelevanceDisagreementsSha256:
        '72c87ff93424cfb0e35f4f2183902fec8842fbb1962bbdd090f9cd6249766ccb',
    },
    scope: { reviewedCases: 30 as const, reviewedJudgments: 636 as const },
    comparison: {
      proposedGradeDistribution: {
        grade0: 130,
        grade1: 62,
        grade2: 388,
        grade3: 56,
      },
      independentGradeDistribution: {
        grade0: 89,
        grade1: 27,
        grade2: 197,
        grade3: 323,
      },
      exactGradeAgreements: 274 as const,
      exactGradeDisagreements: 362 as const,
      binaryAgreements: 595 as const,
      binaryDisagreements: 41 as const,
      proposedIrrelevantIndependentRelevant: 41 as const,
      proposedRelevantIndependentIrrelevant: 0 as const,
      preferredCaseBinaryDisagreements: 33 as const,
      namedComparisonBinaryDisagreements: 8 as const,
      proposedToIndependentMatrix: [
        [89, 13, 20, 8],
        [0, 4, 46, 12],
        [0, 10, 128, 250],
        [0, 0, 3, 53],
      ] as const,
    },
    reconciliation: {
      rules: [
        'preferred-is-soft',
        'strict-graded-calibration',
        'explicit-named-comparison-remains-narrow',
      ] as const,
      acceptedPreferredCorrections: 33 as const,
      rejectedComparisonCompanionChanges: 8 as const,
      retainedSameBinaryCalibrationJudgments: 321 as const,
      unchangedProposedGrades: 603 as const,
      finalGradeDistribution: {
        grade0: 97,
        grade1: 79,
        grade2: 398,
        grade3: 62,
      },
    },
  };
  return {
    ...withoutDigest,
    semanticDigest: retrievalIndependentReviewSemanticDigest(withoutDigest),
  };
}

export function retrievalIndependentReviewSemanticDigest(
  value:
    | RetrievalIndependentReviewRecordV2
    | Omit<RetrievalIndependentReviewRecordV2, 'semanticDigest'>,
): string {
  const { semanticDigest, ...projection } =
    value as RetrievalIndependentReviewRecordV2;
  void semanticDigest;
  return retrievalSemanticDigest(projection);
}

export function reviewedRelevanceProvenance(
  review: RetrievalIndependentReviewRecordV2,
): ReviewedRelevanceProvenance {
  return {
    status: 'accepted',
    reviewStatus: 'independently-reviewed',
    reviewAuthorityVersion: review.reviewVersion,
    reviewAuthorityDigest: review.semanticDigest,
    reviewReference: 'issue-23',
  };
}

export function loadRetrievalIndependentReviewRecordV2(
  repositoryRoot: string,
): RetrievalIndependentReviewRecordV2 {
  const value = loadRetrievalJsonFile(
    repositoryRoot,
    RETRIEVAL_V2_REVIEW_RECORD_RELATIVE_PATH,
  );
  const diagnostics = createRetrievalSchemaRegistry(
    repositoryRoot,
    'v2',
  ).validate('independent-review', value);
  if (diagnostics.length > 0) {
    throw new Error('Retrieval independent-review record is invalid.');
  }
  const review = value as RetrievalIndependentReviewRecordV2;
  if (
    retrievalIndependentReviewSemanticDigest(review) !==
      review.semanticDigest ||
    review.semanticDigest !==
      createRetrievalIndependentReviewRecordV2().semanticDigest
  ) {
    throw new Error('Retrieval independent-review record digest is invalid.');
  }
  const contentDiagnostics = auditIndependentReviewContent(review);
  if (contentDiagnostics.length > 0) {
    throw new Error('Retrieval independent-review record is not content-free.');
  }
  return review;
}

export function auditIndependentReviewContent(
  value: unknown,
): readonly RetrievalDiagnostic[] {
  const forbiddenKeys = new Set([
    'candidateId',
    'description',
    'mrr',
    'ndcg',
    'rank',
    'recall',
    'repository',
    'retrievalScore',
    'score',
    'topic',
  ]);
  const diagnostics: RetrievalDiagnostic[] = [];
  const visit = (node: unknown, path: string): void => {
    if (Array.isArray(node)) {
      node.forEach((child, index) => {
        visit(child, `${path}/${String(index)}`);
      });
      return;
    }
    if (typeof node !== 'object' || node === null) return;
    for (const [key, child] of Object.entries(node)) {
      if (forbiddenKeys.has(key)) {
        diagnostics.push({
          code: 'retrieval.review-record.content',
          path: `${path}/${key}`,
          message: 'Review record must remain content-free.',
        });
      }
      visit(child, `${path}/${key}`);
    }
  };
  visit(value, '');
  return diagnostics.slice(0, 500);
}
