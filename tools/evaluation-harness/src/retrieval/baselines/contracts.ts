import type {
  HardState,
  PredictedResult,
  RetrievalCaseKind,
  RetrievalFamily,
  RetrievalLane,
} from '../contracts.ts';

export const RETRIEVAL_BASELINE_VERSIONS = {
  runner: 'retrieval-baseline-runner/1.0.0',
  familyOnly: 'retrieval-family-only-baseline/1.0.0',
  exactKeyword: 'retrieval-exact-keyword-baseline/1.0.0',
  aliasExpanded: 'retrieval-alias-expanded-baseline/1.0.0',
  alwaysAbstain: 'retrieval-always-abstain-control/1.0.0',
  constraintViolating: 'retrieval-constraint-violating-control/1.0.0',
  fixtureOracle: 'retrieval-fixture-oracle-control/1.0.0',
  report: 'retrieval-baseline-report/1.0.0',
  reportV2: 'retrieval-baseline-report/2.0.0',
} as const;

export const RETRIEVAL_BASELINE_PREDICTION_SET_IDS = {
  familyOnly: 'retrieval-family-only-baseline-predictions',
  exactKeyword: 'retrieval-exact-keyword-baseline-predictions',
  aliasExpanded: 'retrieval-alias-expanded-baseline-predictions',
  alwaysAbstain: 'retrieval-always-abstain-control-predictions',
  constraintViolating: 'retrieval-constraint-violating-control-predictions',
} as const;

export interface BaselineQueryView {
  readonly caseKind: RetrievalCaseKind;
  readonly rawStructuredTerms: readonly string[];
  readonly rawStructuredConstraints: readonly {
    readonly modality: 'preferred' | 'prohibited' | 'required';
    readonly facet: string;
    readonly originalTerm: string;
  }[];
  readonly normalizedPrimaryFamily: RetrievalFamily | null;
  readonly normalizedConceptIds: readonly string[];
  readonly normalizedConstraints: readonly {
    readonly modality: 'preferred' | 'prohibited' | 'required';
    readonly facet: string;
    readonly resolutionBasis: string;
    readonly conceptId: string | null;
    readonly canonicalTerm: string | null;
  }[];
  readonly resolvedCandidateIds: readonly string[];
}

export interface BaselineCandidateView {
  readonly candidateId: string;
  readonly primaryFamily: RetrievalFamily;
  readonly additionalFamilies: readonly RetrievalFamily[];
  readonly catalogStatus: 'active' | 'archived' | 'moved' | 'negative-control';
  readonly repositoryOwner: string;
  readonly repositoryName: string;
  readonly npmPackage: string | null;
  readonly hardState: HardState;
  readonly lane: RetrievalLane;
}

export interface BaselineStrategyResult {
  readonly results: readonly PredictedResult[];
  readonly noEligibleCandidate: boolean;
}

const QUERY_KEYS = [
  'caseKind',
  'normalizedConceptIds',
  'normalizedConstraints',
  'normalizedPrimaryFamily',
  'rawStructuredConstraints',
  'rawStructuredTerms',
  'resolvedCandidateIds',
] as const;
const RAW_CONSTRAINT_KEYS = ['facet', 'modality', 'originalTerm'] as const;
const NORMALIZED_CONSTRAINT_KEYS = [
  'canonicalTerm',
  'conceptId',
  'facet',
  'modality',
  'resolutionBasis',
] as const;
const CANDIDATE_KEYS = [
  'additionalFamilies',
  'candidateId',
  'catalogStatus',
  'hardState',
  'lane',
  'npmPackage',
  'primaryFamily',
  'repositoryName',
  'repositoryOwner',
] as const;

export function assertBaselineQueryView(
  value: BaselineQueryView,
): asserts value is BaselineQueryView {
  assertExactKeys(value, QUERY_KEYS, 'Baseline query view');
  for (const constraint of value.rawStructuredConstraints) {
    assertExactKeys(constraint, RAW_CONSTRAINT_KEYS, 'Baseline query view');
  }
  for (const constraint of value.normalizedConstraints) {
    assertExactKeys(
      constraint,
      NORMALIZED_CONSTRAINT_KEYS,
      'Baseline query view',
    );
  }
}

export function assertBaselineCandidateView(
  value: BaselineCandidateView,
): asserts value is BaselineCandidateView {
  assertExactKeys(value, CANDIDATE_KEYS, 'Baseline candidate view');
}

function assertExactKeys(
  value: object,
  allowed: readonly string[],
  label: string,
): void {
  const keys = Object.keys(value).sort(compareAscii);
  if (
    keys.length !== allowed.length ||
    keys.some((key, index) => key !== allowed[index])
  ) {
    throw new Error(`${label} contains an unapproved field.`);
  }
}

export function compareAscii(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
