import { findGitBlocksRoot } from '../repository-root.ts';
import {
  RETRIEVAL_CORPUS_ID,
  RETRIEVAL_V2_VERSIONS,
  RETRIEVAL_VERSIONS,
  type RetrievalAuthorityVersion,
  type GeneratedCandidateDecision,
  type NormalizationPrediction,
  type RetrievalBlindQuerySet,
  type RetrievalCasePrediction,
  type RetrievalDiagnostic,
  type RetrievalPredictionSet,
  type RetrievalQueryDocument,
  type ValidatedRetrievalCorpus,
} from './contracts.ts';
import { createRetrievalSchemaRegistry } from './schema-registry.ts';
import { retrievalSemanticDigest, retrievalStableJson } from './stable-json.ts';

export function retrievalPredictionSetSemanticDigest(
  value:
    Omit<RetrievalPredictionSet, 'semanticDigest'> | RetrievalPredictionSet,
): string {
  const { semanticDigest, ...projection } = value as RetrievalPredictionSet;
  void semanticDigest;
  return retrievalSemanticDigest(projection);
}

export function validateRetrievalPredictionSetV1(
  value: unknown,
  corpus: ValidatedRetrievalCorpus | undefined,
  startDirectory = process.cwd(),
): readonly RetrievalDiagnostic[] {
  return validateRetrievalPredictionSet(value, corpus, startDirectory, 'v1');
}

export function validateRetrievalPredictionSetV2(
  value: unknown,
  corpus: ValidatedRetrievalCorpus | undefined,
  startDirectory = process.cwd(),
): readonly RetrievalDiagnostic[] {
  return validateRetrievalPredictionSet(value, corpus, startDirectory, 'v2');
}

function validateRetrievalPredictionSet(
  value: unknown,
  corpus: ValidatedRetrievalCorpus | undefined,
  startDirectory: string,
  authorityVersion: RetrievalAuthorityVersion,
): readonly RetrievalDiagnostic[] {
  const diagnostics: RetrievalDiagnostic[] = [];
  let repositoryRoot: string;
  try {
    repositoryRoot = findGitBlocksRoot(startDirectory);
  } catch {
    return [diagnostic('retrieval.prediction.root', '')];
  }
  const schema = createRetrievalSchemaRegistry(
    repositoryRoot,
    authorityVersion,
  ).validate('prediction-set', value);
  diagnostics.push(...schema);
  if (schema.length > 0 || corpus === undefined) {
    if (corpus === undefined)
      diagnostics.push(diagnostic('retrieval.prediction.corpus', ''));
    return diagnostics.slice(0, 500);
  }
  const predictionSet = value as RetrievalPredictionSet;
  const cases = [...corpus.normalizationCases, ...corpus.retrievalCases].sort(
    (left, right) => compareText(left.query.caseId, right.query.caseId),
  );
  return validateAgainstAuthority(
    predictionSet,
    {
      corpusVersion: corpus.manifest.corpusVersion,
      corpusSemanticDigest: corpus.manifest.corpusSemanticDigest,
      queries: cases.map(({ query }) => query),
      candidateIds: corpus.candidateIds,
      conceptIds: corpus.conceptIds,
      generatedDecisionsByCase: new Map(
        corpus.retrievalCases.map((bundle) => [
          bundle.query.caseId,
          bundle.generatedProjection.decisions,
        ]),
      ),
    },
    diagnostics,
    authorityVersion,
  );
}

export interface RetrievalBlindPredictionValidationAuthority {
  readonly corpusVersion: RetrievalBlindQuerySet['corpusVersion'];
  readonly corpusSemanticDigest: string;
  readonly queries: readonly RetrievalQueryDocument[];
  readonly candidateIds: readonly string[];
  readonly conceptIds: readonly string[];
  readonly generatedDecisionsByCase: ReadonlyMap<
    string,
    readonly GeneratedCandidateDecision[]
  >;
}

export function validateRetrievalPredictionSetAgainstBlindAuthorityV1(
  value: unknown,
  authority: RetrievalBlindPredictionValidationAuthority,
  startDirectory = process.cwd(),
): readonly RetrievalDiagnostic[] {
  return validateRetrievalPredictionSetAgainstBlindAuthority(
    value,
    authority,
    startDirectory,
    'v1',
  );
}

export function validateRetrievalPredictionSetAgainstBlindAuthorityV2(
  value: unknown,
  authority: RetrievalBlindPredictionValidationAuthority,
  startDirectory = process.cwd(),
): readonly RetrievalDiagnostic[] {
  return validateRetrievalPredictionSetAgainstBlindAuthority(
    value,
    authority,
    startDirectory,
    'v2',
  );
}

function validateRetrievalPredictionSetAgainstBlindAuthority(
  value: unknown,
  authority: RetrievalBlindPredictionValidationAuthority,
  startDirectory: string,
  authorityVersion: RetrievalAuthorityVersion,
): readonly RetrievalDiagnostic[] {
  let repositoryRoot: string;
  try {
    repositoryRoot = findGitBlocksRoot(startDirectory);
  } catch {
    return [diagnostic('retrieval.prediction.root', '')];
  }
  const diagnostics = [
    ...createRetrievalSchemaRegistry(repositoryRoot, authorityVersion).validate(
      'prediction-set',
      value,
    ),
  ];
  if (diagnostics.length > 0) return diagnostics.slice(0, 500);
  return validateAgainstAuthority(
    value as RetrievalPredictionSet,
    authority,
    diagnostics,
    authorityVersion,
  );
}

function validateAgainstAuthority(
  predictionSet: RetrievalPredictionSet,
  authority: RetrievalBlindPredictionValidationAuthority,
  diagnostics: RetrievalDiagnostic[],
  authorityVersion: RetrievalAuthorityVersion,
): readonly RetrievalDiagnostic[] {
  const predictionSetVersion: unknown = predictionSet.predictionSetVersion;
  const corpusId: unknown = predictionSet.corpusId;
  const corpusVersion: unknown = predictionSet.corpusVersion;
  const expectedPredictionSetVersion =
    authorityVersion === 'v1'
      ? RETRIEVAL_VERSIONS.predictionSet
      : RETRIEVAL_V2_VERSIONS.predictionSet;
  const expectedCorpusId =
    authorityVersion === 'v1'
      ? RETRIEVAL_CORPUS_ID
      : RETRIEVAL_V2_VERSIONS.corpusId;
  if (
    predictionSetVersion !== expectedPredictionSetVersion ||
    corpusId !== expectedCorpusId ||
    corpusVersion !== authority.corpusVersion ||
    predictionSet.corpusSemanticDigest !== authority.corpusSemanticDigest
  )
    add(diagnostics, 'retrieval.prediction.binding', '');
  if (
    retrievalPredictionSetSemanticDigest(predictionSet) !==
    predictionSet.semanticDigest
  ) {
    add(diagnostics, 'retrieval.prediction.digest', '/semanticDigest');
  }
  const cases = [...authority.queries].sort((left, right) =>
    compareText(left.caseId, right.caseId),
  );
  const expectedCaseIds = cases.map(({ caseId }) => caseId);
  const predictedCaseIds = predictionSet.predictions.map(
    ({ caseId }) => caseId,
  );
  if (!sameValues(expectedCaseIds, predictedCaseIds)) {
    add(diagnostics, 'retrieval.prediction.case-closure', '/predictions');
  }
  const casesById = new Map(cases.map((query) => [query.caseId, query]));
  const candidateIds = authority.candidateIds;
  const candidateSet = new Set(candidateIds);
  const conceptSet = new Set(authority.conceptIds);
  for (const [index, prediction] of predictionSet.predictions.entries()) {
    const path = `/predictions/${String(index)}`;
    const query = casesById.get(prediction.caseId);
    if (query === undefined) {
      add(diagnostics, 'retrieval.prediction.unknown-case', path);
      continue;
    }
    if (prediction.caseKind !== query.caseKind) {
      add(diagnostics, 'retrieval.prediction.case-kind', path);
      continue;
    }
    validateNormalizationPrediction(
      prediction.normalization,
      query,
      conceptSet,
      diagnostics,
      `${path}/normalization`,
    );
    if (prediction.caseKind !== 'retrieval' || query.caseKind !== 'retrieval')
      continue;
    const generated = authority.generatedDecisionsByCase.get(query.caseId);
    if (generated === undefined) {
      add(diagnostics, 'retrieval.prediction.generated-authority', path);
      continue;
    }
    validateRetrievalPrediction(
      prediction,
      generated,
      candidateIds,
      candidateSet,
      diagnostics,
      path,
    );
  }
  return diagnostics.slice(0, 500);
}

function validateNormalizationPrediction(
  prediction: NormalizationPrediction,
  query: RetrievalQueryDocument,
  conceptIds: ReadonlySet<string>,
  diagnostics: RetrievalDiagnostic[],
  path: string,
): void {
  const termIds = new Set(
    query.queryInput.capabilityTerms.map(({ termId }) => termId),
  );
  const constraints = new Map(
    query.queryInput.draftConstraints.map((constraint) => [
      constraint.constraintId,
      constraint,
    ]),
  );
  const sourceIds = new Set([
    ...termIds,
    ...constraints.keys(),
    ...query.queryInput.candidateReferences.map(
      ({ referenceId }) => referenceId,
    ),
  ]);
  for (const concept of prediction.normalizedConcepts) {
    if (
      !conceptIds.has(concept.conceptId) ||
      concept.sourceTermIds.some((id) => !termIds.has(id))
    ) {
      add(diagnostics, 'retrieval.prediction.normalization-concept', path);
    }
  }
  for (const constraint of prediction.normalizedConstraints) {
    if (
      constraint.conceptId !== null &&
      !conceptIds.has(constraint.conceptId)
    ) {
      add(diagnostics, 'retrieval.prediction.normalization-concept', path);
    }
    for (const sourceId of constraint.sourceConstraintIds) {
      const input = constraints.get(sourceId);
      if (input?.modality !== constraint.modality) {
        add(diagnostics, 'retrieval.prediction.constraint-modality', path);
      }
    }
  }
  for (const unresolved of prediction.unresolved) {
    if (unresolved.sourceIds.some((id) => !sourceIds.has(id))) {
      add(diagnostics, 'retrieval.prediction.source-id', path);
    }
  }
  for (const clarification of prediction.clarifications) {
    if (
      clarification.sourceIds.some((id) => !sourceIds.has(id)) ||
      clarification.possibleConceptIds.some((id) => !conceptIds.has(id))
    )
      add(diagnostics, 'retrieval.prediction.clarification', path);
  }
  for (const notice of prediction.notices) {
    if (notice.sourceIds.some((id) => !sourceIds.has(id))) {
      add(diagnostics, 'retrieval.prediction.source-id', path);
    }
  }
}

function validateRetrievalPrediction(
  prediction: RetrievalCasePrediction,
  generated: readonly GeneratedCandidateDecision[],
  candidateIds: readonly string[],
  candidateSet: ReadonlySet<string>,
  diagnostics: RetrievalDiagnostic[],
  path: string,
): void {
  if (
    !sameValues(
      prediction.candidateDecisions.map(({ candidateId }) => candidateId),
      candidateIds,
    )
  ) {
    add(
      diagnostics,
      'retrieval.prediction.candidate-closure',
      `${path}/candidateDecisions`,
    );
  }
  const generatedById = new Map(
    generated.map((decision) => [decision.candidateId, decision]),
  );
  const predictedById = new Map<
    string,
    (typeof prediction.candidateDecisions)[number]
  >();
  for (const decision of prediction.candidateDecisions) {
    const authority = generatedById.get(decision.candidateId);
    if (
      !candidateSet.has(decision.candidateId) ||
      predictedById.has(decision.candidateId)
    ) {
      add(
        diagnostics,
        'retrieval.prediction.candidate',
        `${path}/candidateDecisions`,
      );
    }
    predictedById.set(decision.candidateId, decision);
    const stateLane =
      decision.hardState === 'conflict'
        ? 'excluded'
        : decision.hardState === 'unresolved'
          ? 'evidence-needed'
          : 'eligible';
    const laneIsValid =
      decision.lane === stateLane ||
      (authority?.negativeControl === true && decision.lane === 'excluded');
    if (!laneIsValid) {
      add(
        diagnostics,
        'retrieval.prediction.decision-lane',
        `${path}/candidateDecisions`,
      );
    }
  }
  const resultIds = new Set<string>();
  for (const result of prediction.results) {
    if (
      !candidateSet.has(result.candidateId) ||
      resultIds.has(result.candidateId)
    ) {
      add(
        diagnostics,
        'retrieval.prediction.result-candidate',
        `${path}/results`,
      );
    }
    resultIds.add(result.candidateId);
    if (predictedById.get(result.candidateId)?.lane !== result.claimedLane) {
      add(diagnostics, 'retrieval.prediction.result-lane', `${path}/results`);
    }
  }
}

function sameValues(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return retrievalStableJson(left) === retrievalStableJson(right);
}

function add(
  diagnostics: RetrievalDiagnostic[],
  code: string,
  path: string,
): void {
  if (diagnostics.length < 500) diagnostics.push(diagnostic(code, path));
}

function diagnostic(code: string, path: string): RetrievalDiagnostic {
  return {
    code,
    path: path.slice(0, 256),
    message: 'Retrieval prediction set is inconsistent.',
  };
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
