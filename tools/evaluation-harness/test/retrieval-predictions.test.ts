import { beforeAll, describe, expect, it } from 'vitest';

import { findGitBlocksRoot } from '../src/repository-root.ts';
import type {
  RetrievalCasePrediction,
  RetrievalPredictionSet,
  ValidatedRetrievalCorpus,
} from '../src/retrieval/contracts.ts';
import { loadRetrievalCorpusV1 } from '../src/retrieval/corpus.ts';
import {
  retrievalPredictionSetSemanticDigest,
  validateRetrievalPredictionSetV1,
} from '../src/retrieval/predictions.ts';

let corpus: ValidatedRetrievalCorpus;
let predictionSet: RetrievalPredictionSet;

beforeAll(() => {
  const loaded = loadRetrievalCorpusV1(findGitBlocksRoot(process.cwd()));
  if (!loaded.ok) throw new Error('Retrieval corpus fixture must validate.');
  corpus = loaded.corpus;
  predictionSet = validPredictionSet(corpus);
}, 60_000);

describe('retrieval prediction validation', () => {
  it('accepts exact case and 150-candidate closure in canonical order', () => {
    expect(validateRetrievalPredictionSetV1(predictionSet, corpus)).toEqual([]);
  });

  it('rejects version, corpus binding, and semantic-digest drift', () => {
    for (const value of [
      { ...predictionSet, predictionSetVersion: 'wrong-version' },
      { ...predictionSet, corpusId: 'wrong-corpus' },
      { ...predictionSet, corpusSemanticDigest: '0'.repeat(64) },
      { ...predictionSet, semanticDigest: '0'.repeat(64) },
    ]) {
      expect(
        validateRetrievalPredictionSetV1(value, corpus).length,
      ).toBeGreaterThan(0);
    }
  });

  it('rejects missing, duplicate, unknown, wrong-kind, and noncanonical cases', () => {
    const first = predictionSet.predictions[0]!;
    for (const predictions of [
      predictionSet.predictions.slice(1),
      [first, first, ...predictionSet.predictions.slice(2)],
      [
        { ...first, caseId: 'unknown-case' },
        ...predictionSet.predictions.slice(1),
      ],
      [
        { ...first, caseKind: 'retrieval' },
        ...predictionSet.predictions.slice(1),
      ],
      [
        predictionSet.predictions[1]!,
        first,
        ...predictionSet.predictions.slice(2),
      ],
    ]) {
      expect(
        validateRetrievalPredictionSetV1(
          { ...predictionSet, predictions },
          corpus,
        ).length,
      ).toBeGreaterThan(0);
    }
  });

  it('rejects candidate closure, result duplicates, excess results, and lane drift', () => {
    const retrievalIndex = predictionSet.predictions.findIndex(
      ({ caseKind }) => caseKind === 'retrieval',
    );
    const retrieval = predictionSet.predictions[
      retrievalIndex
    ] as RetrievalCasePrediction;
    const returned = retrieval.candidateDecisions.filter(
      (
        decision,
      ): decision is typeof decision & {
        readonly lane: 'eligible' | 'evidence-needed';
      } => decision.lane !== 'excluded',
    );
    const generated = corpus.retrievalCases.find(
      ({ query }) => query.caseId === retrieval.caseId,
    )?.generatedProjection.decisions;
    const generatedById = new Map(
      (generated ?? []).map((decision) => [decision.candidateId, decision]),
    );
    const laneTargetIndex = retrieval.candidateDecisions.findIndex(
      ({ candidateId, lane }) =>
        lane !== 'eligible' &&
        generatedById.get(candidateId)?.negativeControl === false,
    );
    const mutations: RetrievalCasePrediction[] = [
      {
        ...retrieval,
        candidateDecisions: retrieval.candidateDecisions.slice(1),
      },
      {
        ...retrieval,
        candidateDecisions: [
          retrieval.candidateDecisions[0]!,
          retrieval.candidateDecisions[0]!,
          ...retrieval.candidateDecisions.slice(2),
        ],
      },
      {
        ...retrieval,
        candidateDecisions: [
          {
            ...retrieval.candidateDecisions[0]!,
            candidateId: 'unknown-candidate',
          },
          ...retrieval.candidateDecisions.slice(1),
        ],
      },
      {
        ...retrieval,
        candidateDecisions: [
          retrieval.candidateDecisions[1]!,
          retrieval.candidateDecisions[0]!,
          ...retrieval.candidateDecisions.slice(2),
        ],
      },
      {
        ...retrieval,
        results: [
          {
            candidateId: returned[0]!.candidateId,
            claimedLane: returned[0]!.lane,
          },
          {
            candidateId: returned[0]!.candidateId,
            claimedLane: returned[0]!.lane,
          },
        ],
      },
      {
        ...retrieval,
        results: [
          {
            candidateId: 'unknown-candidate',
            claimedLane: 'eligible',
          },
        ],
      },
      {
        ...retrieval,
        results: [
          {
            candidateId: returned[0]!.candidateId,
            claimedLane:
              returned[0]!.lane === 'eligible' ? 'evidence-needed' : 'eligible',
          },
        ],
      },
      {
        ...retrieval,
        results: returned.slice(0, 11).map(({ candidateId, lane }) => ({
          candidateId,
          claimedLane: lane,
        })),
      },
      {
        ...retrieval,
        candidateDecisions: retrieval.candidateDecisions.map(
          (decision, index) =>
            index === laneTargetIndex
              ? { ...decision, lane: 'eligible' }
              : decision,
        ),
      },
    ];
    for (const mutation of mutations) {
      const predictions = [...predictionSet.predictions];
      predictions[retrievalIndex] = mutation;
      expect(
        validateRetrievalPredictionSetV1(
          withDigest({ ...predictionSet, predictions }),
          corpus,
        ).length,
      ).toBeGreaterThan(0);
    }
  });

  it('rejects invented sources, weakened modalities, unknown concepts, scores, and rationale', () => {
    const index = predictionSet.predictions.findIndex(
      (prediction) =>
        prediction.normalization.normalizedConstraints.length > 0 &&
        prediction.normalization.normalizedConcepts.length > 0,
    );
    const original = predictionSet.predictions[index]!;
    const inventedSource = {
      ...original,
      normalization: {
        ...original.normalization,
        normalizedConcepts: original.normalization.normalizedConcepts.map(
          (concept, conceptIndex) =>
            conceptIndex === 0
              ? { ...concept, sourceTermIds: ['invented-source'] }
              : concept,
        ),
      },
    };
    const weakened = {
      ...original,
      normalization: {
        ...original.normalization,
        normalizedConstraints: original.normalization.normalizedConstraints.map(
          (constraint, constraintIndex) =>
            constraintIndex === 0
              ? { ...constraint, modality: 'required' as const }
              : constraint,
        ),
      },
    };
    const unknownConcept = {
      ...original,
      normalization: {
        ...original.normalization,
        normalizedConcepts: original.normalization.normalizedConcepts.map(
          (concept, conceptIndex) =>
            conceptIndex === 0
              ? { ...concept, conceptId: 'invented-concept' }
              : concept,
        ),
      },
    };
    for (const mutation of [inventedSource, weakened, unknownConcept]) {
      const predictions = [...predictionSet.predictions];
      predictions[index] = mutation;
      expect(
        validateRetrievalPredictionSetV1(
          withDigest({ ...predictionSet, predictions }),
          corpus,
        ).length,
      ).toBeGreaterThan(0);
    }
    expect(
      validateRetrievalPredictionSetV1(
        { ...predictionSet, score: 0.9, rationale: 'not allowed' },
        corpus,
      ).length,
    ).toBeGreaterThan(0);
    expect(
      validateRetrievalPredictionSetV1(
        {
          ...predictionSet,
          arbitraryUrl: 'https://example.invalid',
          targetSource: 'repository-source',
        },
        corpus,
      ).length,
    ).toBeGreaterThan(0);
  });
});

function validPredictionSet(
  authority: ValidatedRetrievalCorpus,
): RetrievalPredictionSet {
  const predictions = [
    ...authority.normalizationCases.map((bundle) => ({
      caseId: bundle.query.caseId,
      caseKind: 'normalization-adversarial' as const,
      normalization: bundle.normalizationGold.expected,
    })),
    ...authority.retrievalCases.map((bundle) => ({
      caseId: bundle.query.caseId,
      caseKind: 'retrieval' as const,
      normalization: bundle.normalizationGold.expected,
      candidateDecisions: bundle.generatedProjection.decisions.map(
        ({ candidateId, hardState, lane }) => ({
          candidateId,
          hardState,
          lane,
        }),
      ),
      results: [],
      noEligibleCandidate:
        bundle.noResultGold.expectedOutcome === 'no-eligible-candidate',
    })),
  ].sort((left, right) => compareText(left.caseId, right.caseId));
  return withDigest({
    predictionSetVersion: 'retrieval-evaluation-prediction-set/1.0.0',
    predictionSetId: 'prediction-validation-fixture',
    corpusId: 'retrieval-v1',
    corpusVersion: authority.manifest.corpusVersion,
    corpusSemanticDigest: authority.manifest.corpusSemanticDigest,
    predictions,
    semanticDigest: '0'.repeat(64),
  });
}

function withDigest(value: RetrievalPredictionSet): RetrievalPredictionSet {
  return {
    ...value,
    semanticDigest: retrievalPredictionSetSemanticDigest(value),
  };
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
