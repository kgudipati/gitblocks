import type {
  CandidateDisposition,
  CaseBundle,
  Prediction,
} from './contracts.ts';

export const WEAK_STRATEGIES = [
  'first-candidate',
  'all-viable',
  'always-abstain',
  'omit-unknowns',
  'perfect',
] as const;

export type WeakStrategy = (typeof WEAK_STRATEGIES)[number];

export function createWeakPredictionSet(
  strategy: WeakStrategy,
  bundles: readonly CaseBundle[],
): Prediction[] {
  return bundles
    .map((bundle) => createWeakPrediction(strategy, bundle))
    .sort((left, right) => compareText(left.caseId, right.caseId));
}

function createWeakPrediction(
  strategy: WeakStrategy,
  bundle: CaseBundle,
): Prediction {
  const { caseDocument, gold } = bundle;
  let outcome: Prediction['outcome'];
  let candidates: CandidateDisposition[];
  let rankGroups: string[][];
  let rankRelations: Prediction['rankRelations'] = [];
  let disclosedUnknownIds: string[];

  if (strategy === 'first-candidate') {
    outcome = 'recommend';
    candidates = caseDocument.candidates.map((candidate, index) => ({
      candidateId: candidate.candidateId,
      disposition: index === 0 ? 'recommended' : 'rejected',
      reasonCodes: [],
      evidenceIds: [],
    }));
    rankGroups = [[caseDocument.candidates[0]?.candidateId ?? 'missing']];
    disclosedUnknownIds = [];
  } else if (strategy === 'all-viable') {
    outcome = 'recommend';
    candidates = caseDocument.candidates.map((candidate) => ({
      candidateId: candidate.candidateId,
      disposition: 'viable',
      reasonCodes: [],
      evidenceIds: [],
    }));
    rankGroups = [
      caseDocument.candidates.map((candidate) => candidate.candidateId),
    ];
    disclosedUnknownIds = [];
  } else if (strategy === 'always-abstain') {
    outcome = 'insufficient-evidence';
    candidates = caseDocument.candidates.map((candidate) => ({
      candidateId: candidate.candidateId,
      disposition: 'insufficient-evidence',
      reasonCodes: [],
      evidenceIds: [],
    }));
    rankGroups = [];
    disclosedUnknownIds = caseDocument.unknowns.map((unknown) => unknown.id);
  } else {
    outcome = gold.outcome;
    candidates = gold.dispositions.map((disposition) => ({
      candidateId: disposition.candidateId,
      disposition: disposition.disposition,
      reasonCodes: [...disposition.reasonCodes],
      evidenceIds: [...disposition.evidenceIds],
    }));
    rankGroups = gold.rankGroups.map((group) => [...group]);
    rankRelations = gold.rankRelations.map((relation) => ({ ...relation }));
    disclosedUnknownIds =
      strategy === 'perfect' ? [...gold.requiredUnknownIds] : [];
  }

  return {
    schemaVersion: '1.0.0',
    caseId: caseDocument.caseId,
    outcome,
    candidates,
    rankGroups,
    rankRelations,
    disclosedUnknownIds,
    run: {
      runId: `${strategy}-${caseDocument.caseId}`,
      producer: `deterministic weak fixture: ${strategy}`,
      producedAt: `${caseDocument.evidenceCutoff}T00:00:00Z`,
    },
  };
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
