import type {
  CandidateRetrievalResultV1,
  TargetFitAssessmentResponseV1,
} from '@gitblocks/contracts';
import type { CandidateRetrievalEngineV1 } from '@gitblocks/retrieval';
import { describe, expect, it, vi } from 'vitest';

import {
  HOSTED_FIT_FINALIST_LIMIT,
  HOSTED_RESPONSIBLE_OPTION_LIMIT,
  type FitAssessmentModelRequestV1,
} from '../src/application.ts';
import {
  candidateDossier,
  acceptedRetrievalResult,
  createAcceptedApplication,
  groundedModelResponse,
  recommendationRequest,
  TEST_EVIDENCE_CUTOFF,
} from './fixtures.ts';

describe('hosted OSS recommendation application', () => {
  it('retrieves before effects, loads only the first five eligible finalists, calls the model once, and returns a bounded validated option', async () => {
    const order: string[] = [];
    const loadedCandidateIds: string[] = [];
    const modelInputs: FitAssessmentModelRequestV1[] = [];
    const application = await createAcceptedApplication({
      observer: { emit: ({ stage }) => order.push(stage) },
      dossierLoader: {
        loadActiveCandidateDossier: (command) => {
          order.push('evidence');
          loadedCandidateIds.push(command.candidateId);
          expect(command.evidenceCutoff).toBe(TEST_EVIDENCE_CUTOFF);
          return Promise.resolve(
            candidateDossier(command.candidateId, command.evidenceCutoff),
          );
        },
      },
      fitModel: {
        assess: (input) => {
          order.push('model');
          modelInputs.push(input);
          return Promise.resolve(groundedModelResponse(input));
        },
      },
    });

    const outcome = await application.recommendOss(
      recommendationRequest({ id: 'recommend-happy', term: 'authorization' }),
    );

    expect(outcome.ok).toBe(true);
    if (!outcome.ok || outcome.result.outcome !== 'recommend') return;
    expect(loadedCandidateIds).toHaveLength(HOSTED_FIT_FINALIST_LIMIT);
    expect(modelInputs).toHaveLength(1);
    expect(
      modelInputs[0]?.fitAssessmentRequest.candidates.map(
        ({ identity }) => identity.candidateId,
      ),
    ).toEqual(loadedCandidateIds);
    expect(modelInputs[0]?.fitAssessmentRequest.requestedMaximumResults).toBe(
      HOSTED_RESPONSIBLE_OPTION_LIMIT,
    );
    expect(modelInputs[0]?.fitAssessmentRequest.evidenceCutoff).toBe(
      TEST_EVIDENCE_CUTOFF,
    );
    expect(order.indexOf('retrieved')).toBeLessThan(order.indexOf('evidence'));
    expect(order.indexOf('evidence-loaded')).toBeLessThan(
      order.indexOf('model'),
    );
    expect(outcome.result.responsibleOptions).toHaveLength(1);
    expect(outcome.result.responsibleOptions.length).toBeLessThanOrEqual(
      HOSTED_RESPONSIBLE_OPTION_LIMIT,
    );
  });

  it.each([
    ['clarification-required', 'lightweight'],
    ['unsupported', 'authentication'],
  ] as const)(
    'returns %s without a PostgreSQL evidence read or model call',
    async (expected, term) => {
      const loader = vi.fn();
      const model = vi.fn();
      const application = await createAcceptedApplication({
        dossierLoader: { loadActiveCandidateDossier: loader },
        fitModel: { assess: model },
      });

      const result = await application.recommendOss(
        recommendationRequest({ id: `recommend-${expected}`, term }),
      );

      expect(result).toMatchObject({
        ok: true,
        result: { outcome: expected },
      });
      expect(loader).not.toHaveBeenCalled();
      expect(model).not.toHaveBeenCalled();
    },
  );

  it('keeps deterministic evidence-needed candidates out of the model and returns insufficient evidence when none are eligible', async () => {
    const loader = vi.fn();
    const model = vi.fn();
    const application = await createAcceptedApplication({
      dossierLoader: { loadActiveCandidateDossier: loader },
      fitModel: { assess: model },
    });
    const result = await application.recommendOss(
      recommendationRequest({
        id: 'recommend-evidence-needed',
        term: 'authorization',
        constraints: [
          {
            constraintId: 'in-process-required',
            modality: 'required',
            statement: 'The candidate must be an in-process library.',
            originalTerm: 'in-process-authorization-library',
            facetHint: 'architecture',
            reasonCode: 'required-architecture',
          },
        ],
      }),
    );

    expect(result).toMatchObject({
      ok: true,
      result: {
        outcome: 'insufficient-evidence',
        reasonCode: 'deterministic-evidence-needed',
        shortlist: { eligibleCandidates: [] },
      },
    });
    if (result.ok && 'shortlist' in result.result) {
      expect(
        result.result.shortlist.evidenceNeededCandidates.length,
      ).toBeGreaterThan(0);
    }
    expect(loader).not.toHaveBeenCalled();
    expect(model).not.toHaveBeenCalled();
  });

  it('never supplies an evidence-needed lane candidate when eligible finalists exist', async () => {
    const eligible = await acceptedRetrievalResult(
      recommendationRequest({ id: 'eligible-base', term: 'authorization' }),
    );
    const evidenceNeeded = await acceptedRetrievalResult(
      recommendationRequest({
        id: 'uncertain-base',
        term: 'authorization',
        constraints: [
          {
            constraintId: 'in-process-required',
            modality: 'required',
            statement: 'The candidate must be an in-process library.',
            originalTerm: 'in-process-authorization-library',
            facetHint: 'architecture',
            reasonCode: 'required-architecture',
          },
        ],
      }),
    );
    const eligibleCandidates = eligible.eligibleCandidates.slice(0, 2);
    const eligibleIds = new Set(
      eligibleCandidates.map(({ candidateId }) => candidateId),
    );
    const evidenceNeededCandidate =
      evidenceNeeded.evidenceNeededCandidates.find(
        ({ candidateId }) => !eligibleIds.has(candidateId),
      );
    if (evidenceNeededCandidate === undefined) {
      throw new Error('Distinct evidence-needed fixture was unavailable.');
    }
    const combined: CandidateRetrievalResultV1 = {
      ...eligible,
      eligibleCandidates,
      evidenceNeededCandidates: [evidenceNeededCandidate],
    };
    const modelInputs: FitAssessmentModelRequestV1[] = [];
    const application = await createAcceptedApplication({
      engine: fixedEngine(combined),
      fitModel: {
        assess: (input) => {
          modelInputs.push(input);
          return Promise.resolve(groundedModelResponse(input));
        },
      },
    });

    const result = await application.recommendOss(
      recommendationRequest({ id: 'lane-authority', term: 'authorization' }),
    );
    expect(result).toMatchObject({
      ok: true,
      result: { outcome: 'recommend' },
    });
    expect(
      modelInputs[0]?.fitAssessmentRequest.candidates.map(
        ({ identity }) => identity.candidateId,
      ),
    ).toEqual(
      combined.eligibleCandidates.map(({ candidateId }) => candidateId),
    );
    expect(
      modelInputs[0]?.fitAssessmentRequest.candidates.some(
        ({ identity }) =>
          identity.candidateId ===
          combined.evidenceNeededCandidates[0]?.candidateId,
      ),
    ).toBe(false);
  });

  it('returns no viable candidate without evidence or model effects when deterministic retrieval has no candidates', async () => {
    const baseline = await acceptedRetrievalResult(
      recommendationRequest({ id: 'empty-base', term: 'authorization' }),
    );
    const empty: CandidateRetrievalResultV1 = {
      ...baseline,
      eligibleCandidates: [],
      evidenceNeededCandidates: [],
    };
    const loader = vi.fn();
    const model = vi.fn();
    const application = await createAcceptedApplication({
      engine: fixedEngine(empty),
      dossierLoader: { loadActiveCandidateDossier: loader },
      fitModel: { assess: model },
    });

    expect(
      await application.recommendOss(
        recommendationRequest({ id: 'no-result', term: 'authorization' }),
      ),
    ).toMatchObject({
      ok: true,
      result: { outcome: 'no-viable-candidate' },
    });
    expect(loader).not.toHaveBeenCalled();
    expect(model).not.toHaveBeenCalled();
  });

  it('returns insufficient evidence without calling the model when every finalist dossier has no observations', async () => {
    const model = vi.fn();
    const application = await createAcceptedApplication({
      dossierLoader: {
        loadActiveCandidateDossier: (command) =>
          Promise.resolve(
            candidateDossier(command.candidateId, command.evidenceCutoff, {
              emptyEvidence: true,
            }),
          ),
      },
      fitModel: { assess: model },
    });

    expect(
      await application.recommendOss(
        recommendationRequest({ id: 'empty-evidence', term: 'authorization' }),
      ),
    ).toMatchObject({
      ok: true,
      result: {
        outcome: 'insufficient-evidence',
        reasonCode: 'no-positive-candidate-evidence',
      },
    });
    expect(model).not.toHaveBeenCalled();
  });

  it.each([
    ['restored candidate', restoreCandidate],
    ['invented evidence', inventEvidence],
    ['dropped evidence', dropEvidence],
    ['invented repository fact', inventRepositoryFact],
    ['viable hard conflict', addPositiveHardConflict],
  ] as const)(
    'fails closed for model output with %s and never retries',
    async (_name, mutate) => {
      const model = vi.fn((input: FitAssessmentModelRequestV1) => {
        const response = structuredClone(groundedModelResponse(input));
        mutate(response);
        return Promise.resolve(response);
      });
      const application = await createAcceptedApplication({
        fitModel: { assess: model },
      });

      const result = await application.recommendOss(
        recommendationRequest({
          id: `invalid-${_name.replaceAll(' ', '-')}`,
          term: 'authorization',
        }),
      );

      expect(result).toMatchObject({
        ok: false,
        failure: { code: 'invalid-target-fit-response' },
      });
      expect(model).toHaveBeenCalledTimes(1);
    },
  );

  it('rejects malformed request input before retrieval effects', async () => {
    const loader = vi.fn();
    const model = vi.fn();
    const application = await createAcceptedApplication({
      dossierLoader: { loadActiveCandidateDossier: loader },
      fitModel: { assess: model },
    });
    expect(await application.recommendOss({})).toMatchObject({
      ok: false,
      failure: { kind: 'contract' },
    });
    expect(loader).not.toHaveBeenCalled();
    expect(model).not.toHaveBeenCalled();
  });
});

function fixedEngine(
  result: CandidateRetrievalResultV1,
): CandidateRetrievalEngineV1 {
  return Object.freeze({
    candidateCount: 150,
    retrieve: () => Object.freeze({ ok: true, result, issues: [] as const }),
  });
}

function restoreCandidate(value: TargetFitAssessmentResponseV1): void {
  value.fitAssessment.suppliedCandidateIds[0] = 'candidate-invented';
}

function inventEvidence(value: TargetFitAssessmentResponseV1): void {
  const first = value.fitAssessment.evidence[0];
  if (first !== undefined) first.observation = 'Invented evidence text.';
}

function dropEvidence(value: TargetFitAssessmentResponseV1): void {
  value.fitAssessment.evidence = value.fitAssessment.evidence.slice(1);
}

function inventRepositoryFact(value: TargetFitAssessmentResponseV1): void {
  const first = value.inferenceRepositoryFactBindings[0];
  if (first !== undefined) first.repositoryFactIds = ['fact-invented'];
}

function addPositiveHardConflict(value: TargetFitAssessmentResponseV1): void {
  const assessment = value.fitAssessment.candidateAssessments[0];
  const evidence = value.fitAssessment.evidence[0];
  if (assessment === undefined || evidence === undefined) return;
  assessment.hardConstraintConflictIds = ['conflict-invented'];
  value.fitAssessment.hardConstraintConflicts = [
    {
      conflictId: 'conflict-invented',
      candidateId: assessment.candidateId,
      constraintId: 'constraint-invented',
      reasonCode: 'constraint-invented',
      evidenceIds: [evidence.evidenceId],
    },
  ];
}
