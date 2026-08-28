import { createHash } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import { findGitBlocksRoot } from '../repository-root.ts';
import {
  RETRIEVAL_V2_VERSIONS,
  type RelevanceGoldDocument,
  type RetrievalCorpusManifest,
} from './contracts.ts';
import {
  RETRIEVAL_V2_REVIEWED_GRADE_CORRECTIONS,
  RETRIEVAL_V2_REVIEW_RECORD_RELATIVE_PATH,
  createRetrievalIndependentReviewRecordV2,
  reviewedRelevanceProvenance,
} from './reviewed-relevance.ts';
import {
  retrievalCorpusSemanticDigest,
  retrievalStableJson,
} from './stable-json.ts';

const V1_ROOT = 'evals/retrieval-v1';
const V2_ROOT = 'evals/retrieval-v2';

export interface RetrievalV2AuthoringEvidence {
  readonly corpusVersion: typeof RETRIEVAL_V2_VERSIONS.corpus;
  readonly corpusSemanticDigest: string;
  readonly relevanceReviewDigest: string;
  readonly changedGradeCount: 33;
  readonly manifestEntryCount: 212;
}

export function generateRetrievalV2Authority(
  startDirectory = process.cwd(),
): RetrievalV2AuthoringEvidence {
  const repositoryRoot = findGitBlocksRoot(startDirectory);
  requireCanonicalRoot(repositoryRoot);
  const v1Root = join(repositoryRoot, V1_ROOT);
  const v2Root = join(repositoryRoot, V2_ROOT);
  rejectSymlinkIfPresent(v2Root);

  const v1Manifest = JSON.parse(
    readFileSync(join(v1Root, 'manifest.json'), 'utf8'),
  ) as RetrievalCorpusManifest;
  if (
    v1Manifest.corpusId !== 'retrieval-v1' ||
    v1Manifest.corpusVersion !== 'retrieval-evaluation-corpus/1.0.0' ||
    v1Manifest.corpusSemanticDigest !==
      'f92eac1a3963c4f52fb135189e82a0196dbccd559af32bc57a6a7e64226eb842' ||
    v1Manifest.files.length !== 212
  ) {
    throw new Error('Retrieval-v1 source authority is not the accepted input.');
  }

  const review = createRetrievalIndependentReviewRecordV2();
  writeFixedJson(
    repositoryRoot,
    RETRIEVAL_V2_REVIEW_RECORD_RELATIVE_PATH,
    review,
  );
  const corrections = new Map(
    RETRIEVAL_V2_REVIEWED_GRADE_CORRECTIONS.map((correction) => [
      `${correction.caseId}\u0000${correction.candidateId}`,
      correction,
    ]),
  );
  const applied = new Set<string>();
  const files = v1Manifest.files.map((entry) => {
    const sourcePath = join(v1Root, entry.path);
    const targetPath = join(v2Root, entry.path);
    mkdirSync(dirname(targetPath), { recursive: true });
    if (entry.kind !== 'relevance-gold') {
      writeFileSync(targetPath, readFileSync(sourcePath));
      return { ...entry };
    }
    const source = JSON.parse(
      readFileSync(sourcePath, 'utf8'),
    ) as RelevanceGoldDocument;
    const provenance = reviewedRelevanceProvenance(review);
    const judgments = source.judgments.map((judgment) => {
      const key = `${source.caseId}\u0000${judgment.candidateId}`;
      const correction = corrections.get(key);
      if (correction === undefined) {
        return { ...judgment, provenance };
      }
      if (judgment.grade !== correction.oldGrade || applied.has(key)) {
        throw new Error('Reviewed grade correction source is inconsistent.');
      }
      applied.add(key);
      return {
        ...judgment,
        grade: correction.newGrade,
        reasonCodes: [correction.reasonCode],
        provenance,
      };
    });
    writeFileSync(
      targetPath,
      retrievalStableJson({
        ...source,
        relevanceGoldVersion: RETRIEVAL_V2_VERSIONS.relevanceGold,
        judgments,
        provenance,
      }),
      'utf8',
    );
    return { ...entry, sha256: sha256(readFileSync(targetPath)) };
  });
  if (applied.size !== 33 || applied.size !== corrections.size) {
    throw new Error('Reviewed grade correction closure is incomplete.');
  }

  const withoutDigest = {
    ...v1Manifest,
    corpusId: RETRIEVAL_V2_VERSIONS.corpusId,
    corpusVersion: RETRIEVAL_V2_VERSIONS.corpus,
    files,
    relevanceReviewVersion: review.reviewVersion,
    relevanceReviewDigest: review.semanticDigest,
  };
  const manifest = {
    ...withoutDigest,
    corpusSemanticDigest: retrievalCorpusSemanticDigest(withoutDigest),
  };
  writeFixedJson(repositoryRoot, `${V2_ROOT}/manifest.json`, manifest);
  writeFileSync(
    join(v2Root, 'README.md'),
    `# Retrieval-v2 evaluation corpus\n\nThis additive evaluation-only corpus preserves retrieval-v1 query, normalization, clarification, hard-filter, no-result, and equivalence semantics while binding independently reviewed relevance authority. See [Plan 0023](../../docs/plans/0023-retrieval-v2-reviewed-relevance.md).\n`,
    'utf8',
  );
  return {
    corpusVersion: RETRIEVAL_V2_VERSIONS.corpus,
    corpusSemanticDigest: manifest.corpusSemanticDigest,
    relevanceReviewDigest: review.semanticDigest,
    changedGradeCount: 33,
    manifestEntryCount: 212,
  };
}

function writeFixedJson(
  repositoryRoot: string,
  relativePath: string,
  value: unknown,
): void {
  const target = join(repositoryRoot, relativePath);
  rejectSymlinkIfPresent(target);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, retrievalStableJson(value), 'utf8');
}

function rejectSymlinkIfPresent(path: string): void {
  if (existsSync(path) && lstatSync(path).isSymbolicLink()) {
    throw new Error('Retrieval-v2 authoring target must not be a symlink.');
  }
}

function requireCanonicalRoot(repositoryRoot: string): void {
  const root = resolve(repositoryRoot);
  if (realpathSync(root) !== root || !statSync(root).isDirectory()) {
    throw new Error('Retrieval-v2 authoring root is not canonical.');
  }
}

function sha256(value: Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

if (
  process.argv[1]?.endsWith('retrieval/v2-authoring.ts') === true ||
  process.argv[1]?.endsWith('retrieval/v2-authoring.js') === true
) {
  process.stdout.write(
    `${retrievalStableJson(generateRetrievalV2Authority()).trimEnd()}\n`,
  );
}
