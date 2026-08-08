import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import { findGitBlocksRoot } from '../src/repository-root.ts';
import {
  RETRIEVAL_V2_VERSIONS,
  type ValidatedRetrievalCorpus,
} from '../src/retrieval/contracts.ts';
import { loadRetrievalCorpusV2 } from '../src/retrieval/corpus.ts';
import {
  RETRIEVAL_V2_REVIEWED_GRADE_CORRECTIONS,
  loadRetrievalIndependentReviewRecordV2,
} from '../src/retrieval/reviewed-relevance.ts';
import { retrievalStableJson } from '../src/retrieval/stable-json.ts';

let root: string;
let corpus: ValidatedRetrievalCorpus;

beforeAll(() => {
  root = findGitBlocksRoot(process.cwd());
  const loaded = loadRetrievalCorpusV2(root);
  if (!loaded.ok) throw new Error('Retrieval-v2 corpus must validate.');
  corpus = loaded.corpus;
}, 60_000);

describe('retrieval-v2 reviewed relevance authority', () => {
  it('closes the additive reviewed corpus without changing case structure', () => {
    expect(corpus.manifest.corpusId).toBe('retrieval-v2');
    expect(corpus.manifest.corpusVersion).toBe(RETRIEVAL_V2_VERSIONS.corpus);
    expect(corpus.retrievalCases).toHaveLength(30);
    expect(corpus.normalizationCases).toHaveLength(20);
    expect(corpus.manifest.files).toHaveLength(212);
    expect(
      corpus.retrievalCases.reduce(
        (count, bundle) => count + bundle.relevanceGold.judgments.length,
        0,
      ),
    ).toBe(636);
  });

  it('changes exactly the independently reconciled 33 grades', () => {
    const v1 = JSON.parse(
      readFileSync(join(root, 'evals/retrieval-v1/manifest.json'), 'utf8'),
    ) as { files: readonly { path: string; sha256: string }[] };
    const v2 = corpus.manifest;
    const v1Hashes = new Map(
      v1.files.map((entry) => [entry.path, entry.sha256]),
    );
    const changedPaths = v2.files
      .filter((entry) => v1Hashes.get(entry.path) !== entry.sha256)
      .map((entry) => entry.path);
    expect(changedPaths).toHaveLength(30);
    expect(
      changedPaths.every((path) => path.startsWith('gold/relevance/')),
    ).toBe(true);
    expect(RETRIEVAL_V2_REVIEWED_GRADE_CORRECTIONS).toHaveLength(33);

    const grades = [0, 0, 0, 0];
    for (const bundle of corpus.retrievalCases) {
      for (const judgment of bundle.relevanceGold.judgments) {
        grades[judgment.grade]! += 1;
      }
    }
    expect(grades).toEqual([97, 79, 398, 62]);
  });

  it('retains explicit-target-only named comparison grades', () => {
    const rejectedCompanions = [
      ['ret-audit-logging-04', 'audit-google-logging-winston'],
      ['ret-audit-logging-04', 'audit-winston-syslog'],
      ['ret-audit-logging-04', 'audit-winston-transport'],
      ['ret-authorization-04', 'auth-casbin-casbin'],
      ['ret-background-jobs-04', 'jobs-agenda'],
      ['ret-background-jobs-04', 'jobs-bree'],
      ['ret-background-jobs-04', 'jobs-toad-scheduler'],
      ['ret-webhooks-04', 'webhook-octokit-methods'],
    ] as const;
    for (const [caseId, candidateId] of rejectedCompanions) {
      const bundle = corpus.retrievalCases.find(
        (candidate) => candidate.query.caseId === caseId,
      );
      expect(
        bundle?.relevanceGold.judgments.find(
          (judgment) => judgment.candidateId === candidateId,
        )?.grade,
      ).toBe(0);
    }
  });

  it('binds every reviewed relevance record to one content-free review authority', () => {
    const review = loadRetrievalIndependentReviewRecordV2(root);
    expect(review.reviewVersion).toBe(
      'retrieval-relevance-independent-review/1.0.0',
    );
    expect(review.scope).toEqual({ reviewedCases: 30, reviewedJudgments: 636 });
    expect(review.reconciliation).toMatchObject({
      acceptedPreferredCorrections: 33,
      rejectedComparisonCompanionChanges: 8,
      retainedSameBinaryCalibrationJudgments: 321,
      finalGradeDistribution: {
        grade0: 97,
        grade1: 79,
        grade2: 398,
        grade3: 62,
      },
    });
    const expected = {
      status: 'accepted',
      reviewStatus: 'independently-reviewed',
      reviewAuthorityVersion: review.reviewVersion,
      reviewAuthorityDigest: review.semanticDigest,
      reviewReference: 'issue-23',
    };
    for (const bundle of corpus.retrievalCases) {
      expect(bundle.relevanceGold.provenance).toEqual(expected);
      expect(
        bundle.relevanceGold.judgments.map(({ provenance }) => provenance),
      ).toEqual(bundle.relevanceGold.judgments.map(() => expected));
    }
  });

  it('keeps query and non-relevance authority bytes identical to v1', () => {
    const v1 = JSON.parse(
      readFileSync(join(root, 'evals/retrieval-v1/manifest.json'), 'utf8'),
    ) as { files: readonly { path: string; sha256: string }[] };
    const v1Hashes = new Map(
      v1.files.map((entry) => [entry.path, entry.sha256]),
    );
    expect(
      corpus.manifest.files
        .filter((entry) => entry.kind !== 'relevance-gold')
        .every((entry) => v1Hashes.get(entry.path) === entry.sha256),
    ).toBe(true);
    expect(
      retrievalStableJson(
        corpus.manifest.files
          .filter((entry) => entry.kind.includes('query'))
          .map(({ path, sha256 }) => ({ path, sha256 })),
      ),
    ).toBe(
      retrievalStableJson(
        v1.files
          .filter((entry) => entry.path.startsWith('queries/'))
          .map(({ path, sha256 }) => ({ path, sha256 })),
      ),
    );
  });
});
