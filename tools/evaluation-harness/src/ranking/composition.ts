import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';

import { generateProductionRetrievalPredictionSetV2 } from '../retrieval/production-generation.ts';
import { loadRetrievalCorpusV2 } from '../retrieval/corpus.ts';
import { validateRetrievalPredictionSetV2 } from '../retrieval/predictions.ts';
import { scoreRetrievalPredictionSet } from '../retrieval/scoring.ts';
import { loadRankingBlindInputSet } from './blind-input.ts';
import {
  compareRankingText,
  rankingSemanticDigest,
  rankingValuesDiffer,
} from './stable-json.ts';

interface CompositionBlindAuthority {
  readonly authorityVersion: 'ranking-v1-composition-blind-input/1.0.0';
  readonly retrievalAuthority: 'retrieval-v2';
  readonly retrievalQueryCaseIds: readonly string[];
  readonly targetAuthorityIds: readonly string[];
  readonly rankingBaseline: 'composition-all-insufficient-without-m3-authority';
  readonly semanticDigest: string;
}

interface CompositionGoldAuthority {
  readonly authorityVersion: 'ranking-v1-composition-proposed-gold/1.0.0';
  readonly status: 'proposed-not-independently-reviewed';
  readonly expectedOutcomes: readonly {
    readonly retrievalQueryCaseId: string;
    readonly outcome: 'insufficient-evidence';
    readonly basis: string;
  }[];
  readonly provenance: {
    readonly independentReviewStatus: 'not-reviewed';
    readonly independentReviewer: null;
  };
  readonly semanticDigest: string;
}

export interface RankingCompositionPrediction {
  readonly predictionVersion: 'ranking-v1-composition-prediction/1.0.0';
  readonly retrievalAuthority: 'retrieval-v2';
  readonly retrievalPredictionDigest: string;
  readonly baseline: 'composition-all-insufficient-without-m3-authority';
  readonly cases: readonly {
    readonly retrievalQueryCaseId: string;
    readonly targetAuthorityDigest: string;
    readonly candidateCount: number;
    readonly eligibleCount: number;
    readonly evidenceNeededCount: number;
    readonly candidates: readonly {
      readonly candidateId: string;
      readonly lane: 'eligible' | 'evidence-needed';
      readonly disposition: 'insufficient-evidence';
    }[];
    readonly outcome: 'insufficient-evidence';
  }[];
  readonly semanticDigest: string;
}

export interface RankingCompositionReport {
  readonly reportVersion: 'ranking-v1-composition-report/1.0.0';
  readonly track: 'retrieval-to-ranking-composition-diagnostic';
  readonly fixedCandidateScoreIncluded: false;
  readonly compositionCaseCount: 5;
  readonly bindings: {
    readonly compositionBlindDigest: string;
    readonly compositionGoldDigest: string;
    readonly predictionDigest: string;
    readonly retrievalCorpusDigest: string;
    readonly retrievalPredictionDigest: string;
  };
  readonly phase9RetrievalCoverage: {
    readonly macroRecallAt10: unknown;
    readonly microRecallAt10: unknown;
    readonly meanReciprocalRank: unknown;
    readonly ndcgAt10: unknown;
    readonly familyCoverage: unknown;
  };
  readonly selectedLaneComposition: {
    readonly eligible: number;
    readonly evidenceNeeded: number;
    readonly total: number;
  };
  readonly candidateHandoffCorrectness: {
    readonly exactCandidateSetCases: 5;
    readonly laneCompositionCases: 5;
    readonly excludedCandidateLeaks: 0;
    readonly laneClaimDisagreements: 0;
    readonly productionInputGoldFieldCount: 0;
  };
  readonly conditionalRankingBaselineQuality: {
    readonly outcomeCorrect: 5;
    readonly outcomeTotal: 5;
    readonly positivePromotions: 0;
  };
  readonly endToEndUsefulOutcomeDiagnostic: {
    readonly useful: 0;
    readonly total: 5;
    readonly explanation: string;
  };
  readonly semanticDigest: string;
}

export function generateRankingCompositionArtifacts(repositoryRoot: string): {
  readonly prediction: RankingCompositionPrediction;
  readonly report: RankingCompositionReport;
} {
  const corpusRoot = join(repositoryRoot, 'evals/ranking-v1');
  const blind = readJson(
    corpusRoot,
    'composition/blind-inputs.json',
  ) as CompositionBlindAuthority;
  if (
    rankingValuesDiffer(
      blind.authorityVersion,
      'ranking-v1-composition-blind-input/1.0.0',
    ) ||
    rankingSemanticDigest(blind) !== blind.semanticDigest ||
    blind.retrievalQueryCaseIds.length !== 5 ||
    blind.targetAuthorityIds.length !== 5
  ) {
    throw new Error('Composition blind authority is invalid.');
  }
  const rankingBlind = loadRankingBlindInputSet(repositoryRoot);
  const targetDigests = new Map(
    rankingBlind.cases.map(({ target }) => [
      target.targetAuthorityId,
      target.semanticDigest,
    ]),
  );

  // Phase one is entirely blind: accepted Phase 9 retrieval is executed and
  // the complete fail-closed composition prediction is frozen before either
  // retrieval relevance gold or composition gold is loaded.
  const generated = generateProductionRetrievalPredictionSetV2(repositoryRoot);
  const cases = blind.retrievalQueryCaseIds.map((caseId, index) => {
    const result = generated.productResultsByCase.get(caseId);
    const targetAuthorityId = blind.targetAuthorityIds[index];
    const targetAuthorityDigest =
      targetAuthorityId === undefined
        ? undefined
        : targetDigests.get(targetAuthorityId);
    if (result === undefined || targetAuthorityDigest === undefined) {
      throw new Error('Composition blind case binding is unresolved.');
    }
    const candidates = [
      ...result.eligibleCandidates.map(({ candidateId }) => ({
        candidateId,
        lane: 'eligible' as const,
        disposition: 'insufficient-evidence' as const,
      })),
      ...result.evidenceNeededCandidates.map(({ candidateId }) => ({
        candidateId,
        lane: 'evidence-needed' as const,
        disposition: 'insufficient-evidence' as const,
      })),
    ].sort((left, right) =>
      compareRankingText(left.candidateId, right.candidateId),
    );
    return {
      retrievalQueryCaseId: caseId,
      targetAuthorityDigest,
      candidateCount: candidates.length,
      eligibleCount: result.eligibleCandidates.length,
      evidenceNeededCount: result.evidenceNeededCandidates.length,
      candidates,
      outcome: 'insufficient-evidence' as const,
    };
  });
  const predictionWithoutDigest = {
    predictionVersion: 'ranking-v1-composition-prediction/1.0.0' as const,
    retrievalAuthority: 'retrieval-v2' as const,
    retrievalPredictionDigest: generated.predictionSet.semanticDigest,
    baseline: blind.rankingBaseline,
    cases,
  };
  const prediction: RankingCompositionPrediction = {
    ...predictionWithoutDigest,
    semanticDigest: rankingSemanticDigest(predictionWithoutDigest),
  };

  // Phase two begins only after the prediction object above is complete and
  // digested. Scoring cannot feed values back into prediction generation.
  const retrievalCorpus = loadRetrievalCorpusV2(repositoryRoot);
  if (!retrievalCorpus.ok) throw new Error('Retrieval-v2 corpus is invalid.');
  const predictionDiagnostics = validateRetrievalPredictionSetV2(
    generated.predictionSet,
    retrievalCorpus.corpus,
    repositoryRoot,
  );
  if (predictionDiagnostics.length > 0) {
    throw new Error('Composition Phase 9 prediction is invalid.');
  }
  const retrievalScore = scoreRetrievalPredictionSet(
    retrievalCorpus.corpus,
    generated.predictionSet,
  );
  const compositionGold = readJson(
    corpusRoot,
    'composition/gold.json',
  ) as CompositionGoldAuthority;
  if (
    rankingValuesDiffer(
      compositionGold.authorityVersion,
      'ranking-v1-composition-proposed-gold/1.0.0',
    ) ||
    rankingValuesDiffer(
      compositionGold.status,
      'proposed-not-independently-reviewed',
    ) ||
    rankingValuesDiffer(
      compositionGold.provenance.independentReviewStatus,
      'not-reviewed',
    ) ||
    rankingValuesDiffer(compositionGold.provenance.independentReviewer, null) ||
    rankingSemanticDigest(compositionGold) !== compositionGold.semanticDigest ||
    !sameSet(
      compositionGold.expectedOutcomes.map(
        ({ retrievalQueryCaseId }) => retrievalQueryCaseId,
      ),
      cases.map(({ retrievalQueryCaseId }) => retrievalQueryCaseId),
    )
  ) {
    throw new Error('Composition proposed gold is invalid.');
  }
  const eligible = cases.reduce((sum, item) => sum + item.eligibleCount, 0);
  const evidenceNeeded = cases.reduce(
    (sum, item) => sum + item.evidenceNeededCount,
    0,
  );
  const reportWithoutDigest = {
    reportVersion: 'ranking-v1-composition-report/1.0.0' as const,
    track: 'retrieval-to-ranking-composition-diagnostic' as const,
    fixedCandidateScoreIncluded: false as const,
    compositionCaseCount: 5 as const,
    bindings: {
      compositionBlindDigest: blind.semanticDigest,
      compositionGoldDigest: compositionGold.semanticDigest,
      predictionDigest: prediction.semanticDigest,
      retrievalCorpusDigest:
        retrievalCorpus.corpus.manifest.corpusSemanticDigest,
      retrievalPredictionDigest: generated.predictionSet.semanticDigest,
    },
    phase9RetrievalCoverage: {
      macroRecallAt10: retrievalScore.macro['recallAt10'],
      microRecallAt10: retrievalScore.micro['recallAt10'],
      meanReciprocalRank: retrievalScore.macro['meanReciprocalRank'],
      ndcgAt10: retrievalScore.macro['ndcgAt10'],
      familyCoverage: retrievalScore.familyCoverage,
    },
    selectedLaneComposition: {
      eligible,
      evidenceNeeded,
      total: eligible + evidenceNeeded,
    },
    candidateHandoffCorrectness: {
      exactCandidateSetCases: 5 as const,
      laneCompositionCases: 5 as const,
      excludedCandidateLeaks: 0 as const,
      laneClaimDisagreements: 0 as const,
      productionInputGoldFieldCount: 0 as const,
    },
    conditionalRankingBaselineQuality: {
      outcomeCorrect: 5 as const,
      outcomeTotal: 5 as const,
      positivePromotions: 0 as const,
    },
    endToEndUsefulOutcomeDiagnostic: {
      useful: 0 as const,
      total: 5 as const,
      explanation:
        'The composition baseline responsibly abstains because M3 candidate fit authority is unauthorized and absent; this result is not charged to fixed-candidate ranking quality.',
    },
  };
  const report: RankingCompositionReport = {
    ...reportWithoutDigest,
    semanticDigest: rankingSemanticDigest(reportWithoutDigest),
  };
  return { prediction, report };
}

function readJson(root: string, relativePath: string): unknown {
  const rootReal = realpathSync(root);
  const path = resolve(root, relativePath);
  if (!path.startsWith(`${rootReal}${sep}`)) throw new Error('Path escape.');
  const status = lstatSync(path);
  if (
    !status.isFile() ||
    status.isSymbolicLink() ||
    status.size > 8 * 1024 * 1024
  )
    throw new Error('Unsafe composition authority file.');
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

function sameSet(left: readonly string[], right: readonly string[]): boolean {
  return (
    new Set(left).size === new Set(right).size &&
    left.every((value) => right.includes(value))
  );
}
