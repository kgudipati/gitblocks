import { createHash } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  realpathSync,
} from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

import {
  createRankingAcceptedGateAuthority,
  createRankingAcceptedReviewRecord,
  RANKING_V1_ACCEPTED_CORE_AUTHORITY_DIGEST,
  RANKING_V1_ACCEPTED_GOLD_DIGEST,
  type RankingAcceptedGateAuthority,
  type RankingAcceptedReviewRecord,
} from './acceptance.ts';
import {
  RANKING_FAMILIES,
  type RankingAcceptedValidatedCorpus,
  type RankingAuditAuthority,
  type RankingBlindCaseAuthority,
  type RankingCorpusManifest,
  type RankingCriterionAuthority,
  type RankingCriterionBinding,
  type RankingDiagnostic,
  type RankingEvidenceAuthority,
  type RankingEvidenceSet,
  type RankingGoldAuthority,
  type RankingHandoffAuthority,
  type RankingManifestFile,
  type RankingResolvedCase,
  type RankingReviewRecord,
  type RankingReviewerRationaleAuthority,
  type RankingValidatedCorpus,
} from './contracts.ts';
import {
  compareCandidateFit,
  createPartialOrderPresentation,
  deriveCandidateFit,
  deriveDecisionEvidenceIds,
  derivePreferenceConsequences,
} from './evaluation-rules.ts';
import {
  compareRankingText,
  rankingDigest,
  rankingSemanticDigest,
  rankingStableJson,
  rankingValuesDiffer,
} from './stable-json.ts';

const CORPUS_RELATIVE_ROOT = 'evals/ranking-v1';
const MAXIMUM_JSON_BYTES = 8 * 1024 * 1024;
const EXPECTED_PILOT_V1_DIGEST =
  'b8a744a34e133ad4f4ecf34fd5c3ee7c2cd65be23ae75c76390f8d3f11390e96';
const REQUIRED_AUTHORITY_PATHS = {
  blind: 'blind/cases.json',
  evidence: 'evidence/candidate-evidence.json',
  handoff: 'handoff/phase9-lanes.json',
  gold: 'gold/outcomes.json',
  audit: 'audit/case-classifications.json',
  reviewerRationale: 'reviews/reviewer-rationale.json',
  review: 'reviews/proposed-review-record.json',
  acceptedReview: 'reviews/accepted-review-record.json',
  acceptedGates: 'gates/accepted-gates.json',
} as const;

export type RankingCorpusLoadResult =
  | {
      readonly ok: true;
      readonly manifest: RankingCorpusManifest;
      readonly corpus: RankingAcceptedValidatedCorpus;
      readonly cases: readonly RankingResolvedCase[];
      readonly diagnostics: readonly [];
    }
  | {
      readonly ok: false;
      readonly diagnostics: readonly RankingDiagnostic[];
    };

export function loadRankingCorpus(
  repositoryRoot: string,
): RankingCorpusLoadResult {
  const corpusRoot = join(repositoryRoot, CORPUS_RELATIVE_ROOT);
  const diagnostics: RankingDiagnostic[] = [];
  let manifest: RankingCorpusManifest;
  let corpus: RankingAcceptedValidatedCorpus;
  try {
    manifest = loadJson(corpusRoot, 'manifest.json') as RankingCorpusManifest;
    corpus = {
      blind: loadJson(
        corpusRoot,
        REQUIRED_AUTHORITY_PATHS.blind,
      ) as RankingBlindCaseAuthority,
      evidence: loadJson(
        corpusRoot,
        REQUIRED_AUTHORITY_PATHS.evidence,
      ) as RankingEvidenceAuthority,
      handoff: loadJson(
        corpusRoot,
        REQUIRED_AUTHORITY_PATHS.handoff,
      ) as RankingHandoffAuthority,
      gold: loadJson(
        corpusRoot,
        REQUIRED_AUTHORITY_PATHS.gold,
      ) as RankingGoldAuthority,
      audit: loadJson(
        corpusRoot,
        REQUIRED_AUTHORITY_PATHS.audit,
      ) as RankingAuditAuthority,
      reviewerRationale: loadJson(
        corpusRoot,
        REQUIRED_AUTHORITY_PATHS.reviewerRationale,
      ) as RankingReviewerRationaleAuthority,
      review: loadJson(
        corpusRoot,
        REQUIRED_AUTHORITY_PATHS.review,
      ) as RankingReviewRecord,
      acceptedReview: loadJson(
        corpusRoot,
        REQUIRED_AUTHORITY_PATHS.acceptedReview,
      ) as RankingAcceptedReviewRecord,
      acceptedGates: loadJson(
        corpusRoot,
        REQUIRED_AUTHORITY_PATHS.acceptedGates,
      ) as RankingAcceptedGateAuthority,
    };
  } catch {
    return {
      ok: false,
      diagnostics: [
        diagnostic(
          'ranking.boundary.invalid',
          CORPUS_RELATIVE_ROOT,
          'Ranking authority could not be loaded from bounded regular JSON files.',
        ),
      ],
    };
  }

  validateManifest(corpusRoot, manifest, diagnostics);
  validateCorpusAuthorities(corpusRoot, corpus, diagnostics);
  validatePilotImmutability(repositoryRoot, diagnostics);
  const cases = resolveRankingCases(corpus, diagnostics);
  validateCaseClosure(corpus, cases, diagnostics);
  const finalized = finalizeDiagnostics(diagnostics);
  return finalized.length === 0
    ? { ok: true, manifest, corpus, cases, diagnostics: [] }
    : { ok: false, diagnostics: finalized };
}

export function resolveRankingCases(
  corpus: RankingValidatedCorpus,
  diagnostics: RankingDiagnostic[] = [],
): readonly RankingResolvedCase[] {
  const requests = keyed(corpus.blind.requests, 'requestAuthorityId');
  const criteria = keyed(
    corpus.blind.criterionAuthorities,
    'criterionAuthorityId',
  );
  const targets = keyed(corpus.blind.targets, 'targetAuthorityId');
  const candidateSets = keyed(corpus.blind.candidateSets, 'candidateSetId');
  const evidenceSets = keyed(corpus.evidence.evidenceSets, 'evidenceSetId');
  const handoffs = keyed(corpus.handoff.handoffSets, 'handoffAuthorityId');
  const resolved: RankingResolvedCase[] = [];
  for (const binding of corpus.blind.cases) {
    const request = requests.get(binding.requestAuthorityId);
    const criterion = criteria.get(binding.criterionAuthorityId);
    const target = targets.get(binding.targetAuthorityId);
    const candidateSet = candidateSets.get(binding.candidateSetId);
    const evidence = evidenceSets.get(binding.evidenceSetId);
    const handoff = handoffs.get(binding.handoffAuthorityId);
    if (
      request === undefined ||
      criterion === undefined ||
      target === undefined ||
      candidateSet === undefined ||
      evidence === undefined ||
      handoff === undefined
    ) {
      diagnostics.push(
        diagnostic(
          'ranking.case.reference',
          binding.caseId,
          'Ranking case references an authority outside the corpus closure.',
        ),
      );
      continue;
    }
    resolved.push({
      binding,
      request,
      criteria: criterion,
      target,
      candidateSet,
      evidence,
      handoff,
    });
  }
  return resolved.sort((left, right) =>
    compareRankingText(left.binding.caseId, right.binding.caseId),
  );
}

export function createRankingManifest(
  repositoryRoot: string,
): RankingCorpusManifest {
  const corpusRoot = join(repositoryRoot, CORPUS_RELATIVE_ROOT);
  const paths = listJsonFiles(corpusRoot).filter(
    (path) => path !== 'manifest.json',
  );
  const files = paths.map((path): RankingManifestFile => ({
    kind: classifyManifestPath(path),
    path,
    sha256: hashFile(join(corpusRoot, path)),
  }));
  const withoutDigest = {
    manifestVersion: 'ranking-v1-manifest/4.0.0' as const,
    corpusId: 'ranking-v1' as const,
    corpusVersion: '3.0.0' as const,
    status: 'accepted' as const,
    evidenceCutoff: '2026-08-10',
    caseCount: 30 as const,
    familyCounts: Object.fromEntries(
      RANKING_FAMILIES.map((family) => [family, 6 as const]),
    ) as Record<(typeof RANKING_FAMILIES)[number], 6>,
    files,
  };
  return {
    ...withoutDigest,
    corpusSemanticDigest: rankingDigest(withoutDigest),
  };
}

function validateManifest(
  corpusRoot: string,
  manifest: RankingCorpusManifest,
  diagnostics: RankingDiagnostic[],
): void {
  if (
    rankingValuesDiffer(
      manifest.manifestVersion,
      'ranking-v1-manifest/4.0.0',
    ) ||
    rankingValuesDiffer(manifest.corpusId, 'ranking-v1') ||
    rankingValuesDiffer(manifest.corpusVersion, '3.0.0') ||
    rankingValuesDiffer(manifest.status, 'accepted') ||
    manifest.evidenceCutoff !== '2026-08-10' ||
    rankingValuesDiffer(manifest.caseCount, 30) ||
    RANKING_FAMILIES.some((family) =>
      rankingValuesDiffer(manifest.familyCounts[family], 6),
    ) ||
    rankingDigest({
      manifestVersion: manifest.manifestVersion,
      corpusId: manifest.corpusId,
      corpusVersion: manifest.corpusVersion,
      status: manifest.status,
      evidenceCutoff: manifest.evidenceCutoff,
      caseCount: manifest.caseCount,
      familyCounts: manifest.familyCounts,
      files: manifest.files,
    }) !== manifest.corpusSemanticDigest
  ) {
    diagnostics.push(
      diagnostic(
        'ranking.manifest.binding',
        'manifest.json',
        'Ranking manifest identity or digest is inconsistent.',
      ),
    );
  }
  const actualPaths = listJsonFiles(corpusRoot).filter(
    (path) => path !== 'manifest.json',
  );
  const manifestPaths = manifest.files.map(({ path }) => path);
  if (!sameOrderedValues(actualPaths, manifestPaths)) {
    diagnostics.push(
      diagnostic(
        'ranking.manifest.closure',
        'manifest.files',
        'Ranking manifest must bind every and only committed authority JSON file.',
      ),
    );
  }
  for (const file of manifest.files) {
    try {
      if (
        classifyManifestPath(file.path) !== file.kind ||
        hashFile(join(corpusRoot, file.path)) !== file.sha256
      ) {
        diagnostics.push(
          diagnostic(
            'ranking.manifest.file-binding',
            file.path,
            'Ranking authority file digest or kind is inconsistent.',
          ),
        );
      }
    } catch {
      diagnostics.push(
        diagnostic(
          'ranking.manifest.file-boundary',
          file.path,
          'Ranking manifest file is missing or not a bounded regular file.',
        ),
      );
    }
  }
  for (const [kind, path] of Object.entries(REQUIRED_AUTHORITY_PATHS)) {
    if (!manifest.files.some((file) => file.path === path)) {
      diagnostics.push(
        diagnostic(
          'ranking.manifest.required-authority',
          kind,
          'Ranking manifest omits a physically separated required authority.',
        ),
      );
    }
  }
}

function validateCorpusAuthorities(
  corpusRoot: string,
  corpus: RankingAcceptedValidatedCorpus,
  diagnostics: RankingDiagnostic[],
): void {
  const authorities: readonly [string, object, string][] = [
    ['blind/cases.json', corpus.blind, corpus.blind.semanticDigest],
    [
      'evidence/candidate-evidence.json',
      corpus.evidence,
      corpus.evidence.semanticDigest,
    ],
    [
      'handoff/phase9-lanes.json',
      corpus.handoff,
      corpus.handoff.semanticDigest,
    ],
    ['gold/outcomes.json', corpus.gold, corpus.gold.semanticDigest],
    [
      'audit/case-classifications.json',
      corpus.audit,
      corpus.audit.semanticDigest,
    ],
    [
      'reviews/reviewer-rationale.json',
      corpus.reviewerRationale,
      corpus.reviewerRationale.semanticDigest,
    ],
    [
      'reviews/proposed-review-record.json',
      corpus.review,
      corpus.review.semanticDigest,
    ],
    [
      'reviews/accepted-review-record.json',
      corpus.acceptedReview,
      corpus.acceptedReview.semanticDigest,
    ],
    [
      'gates/accepted-gates.json',
      corpus.acceptedGates,
      corpus.acceptedGates.semanticDigest,
    ],
  ];
  for (const [path, authority, digest] of authorities) {
    if (rankingSemanticDigest(authority) !== digest) {
      diagnostics.push(
        diagnostic(
          'ranking.authority.semantic-digest',
          path,
          'Ranking authority semantic digest is inconsistent.',
        ),
      );
    }
  }
  if (
    rankingValuesDiffer(
      corpus.blind.authorityVersion,
      'ranking-v1-blind-cases/3.0.0',
    ) ||
    rankingValuesDiffer(
      corpus.evidence.authorityVersion,
      'ranking-v1-candidate-evidence/2.0.0',
    ) ||
    rankingValuesDiffer(
      corpus.handoff.authorityVersion,
      'ranking-v1-phase9-handoff/2.0.0',
    ) ||
    rankingValuesDiffer(
      corpus.gold.authorityVersion,
      'ranking-v1-proposed-gold/3.0.0',
    ) ||
    rankingValuesDiffer(
      corpus.audit.authorityVersion,
      'ranking-v1-audit-classification/2.0.0',
    ) ||
    rankingValuesDiffer(
      corpus.reviewerRationale.authorityVersion,
      'ranking-v1-reviewer-rationale/2.0.0',
    ) ||
    rankingValuesDiffer(
      corpus.review.reviewRecordVersion,
      'ranking-v1-review-record/3.0.0',
    )
  ) {
    diagnostics.push(
      diagnostic(
        'ranking.authority.version',
        CORPUS_RELATIVE_ROOT,
        'Ranking authority version is not the frozen M2 authoring version.',
      ),
    );
  }
  if (
    rankingValuesDiffer(
      corpus.gold.reviewStatus,
      'proposed-not-independently-reviewed',
    ) ||
    rankingValuesDiffer(corpus.review.status, 'independent-review-pending') ||
    rankingValuesDiffer(corpus.review.author, 'Codex') ||
    rankingValuesDiffer(corpus.review.independentReviewer, null) ||
    rankingValuesDiffer(corpus.review.reviewedAt, null) ||
    rankingValuesDiffer(corpus.review.adjudication, 'not-started') ||
    rankingValuesDiffer(corpus.review.acceptedCaseIds.length, 0) ||
    corpus.review.goldDigest !== corpus.gold.semanticDigest ||
    corpus.review.reviewerRationaleDigest !==
      corpus.reviewerRationale.semanticDigest
  ) {
    diagnostics.push(
      diagnostic(
        'ranking.review.self-acceptance',
        'reviews/proposed-review-record.json',
        'Authored gold must remain proposed with independent review pending.',
      ),
    );
  }
  if (
    corpus.gold.cases.some(
      ({ provenance }) =>
        rankingValuesDiffer(provenance.status, 'proposed') ||
        rankingValuesDiffer(
          provenance.authoringSession,
          'phase-10-m2-ranking-authoring',
        ) ||
        rankingValuesDiffer(
          provenance.independentReviewStatus,
          'not-reviewed',
        ) ||
        rankingValuesDiffer(provenance.independentReviewer, null) ||
        rankingValuesDiffer(provenance.reviewedAt, null) ||
        rankingValuesDiffer(provenance.reviewReference, null),
    )
  ) {
    diagnostics.push(
      diagnostic(
        'ranking.gold.provenance',
        'gold/outcomes.json',
        'Every ranking gold case must remain explicitly proposed and unreviewed.',
      ),
    );
  }
  validateAcceptedAuthority(corpusRoot, corpus, diagnostics);
  auditBlindAuthority(corpus.blind, diagnostics);
  auditCandidateEvidence(corpus, diagnostics);
}

function validateCaseClosure(
  corpus: RankingValidatedCorpus,
  cases: readonly RankingResolvedCase[],
  diagnostics: RankingDiagnostic[],
): void {
  const caseIds = corpus.blind.cases.map(({ caseId }) => caseId);
  if (
    caseIds.length !== 30 ||
    !isSortedUnique(caseIds) ||
    cases.length !== 30 ||
    !sameOrderedValues(
      caseIds,
      corpus.gold.cases.map(({ caseId }) => caseId),
    ) ||
    !sameOrderedValues(
      caseIds,
      corpus.audit.cases.map(({ caseId }) => caseId),
    ) ||
    !sameOrderedValues(
      caseIds,
      corpus.reviewerRationale.cases.map(({ caseId }) => caseId),
    )
  ) {
    diagnostics.push(
      diagnostic(
        'ranking.case.set',
        'blind.cases',
        'Ranking corpus requires exactly the same sorted 30-case set across blind, gold, audit, and reviewer-rationale authorities.',
      ),
    );
  }
  for (const family of RANKING_FAMILIES) {
    if (
      cases.filter(({ binding }) => binding.capabilityFamily === family)
        .length !== 6
    ) {
      diagnostics.push(
        diagnostic(
          'ranking.case.family-balance',
          family,
          'Ranking corpus requires exactly six cases per capability family.',
        ),
      );
    }
  }
  const goldByCase = new Map(
    corpus.gold.cases.map((gold) => [gold.caseId, gold]),
  );
  const auditByCase = new Map(
    corpus.audit.cases.map((audit) => [audit.caseId, audit]),
  );
  for (const resolved of cases) {
    const { binding, request, criteria, candidateSet, evidence, handoff } =
      resolved;
    const gold = goldByCase.get(binding.caseId);
    const audit = auditByCase.get(binding.caseId);
    const candidateIds = candidateSet.candidates.map(
      ({ candidateId }) => candidateId,
    );
    const evidenceCandidateIds = evidence.candidates.map(
      ({ candidateId }) => candidateId,
    );
    const handoffCandidateIds = handoff.candidates.map(
      ({ candidateId }) => candidateId,
    );
    if (
      gold === undefined ||
      audit === undefined ||
      request.capabilityFamily !== binding.capabilityFamily ||
      candidateSet.capabilityFamily !== binding.capabilityFamily ||
      criteria.requestAuthorityId !== request.requestAuthorityId ||
      binding.evidenceCutoff !== corpus.blind.evidenceCutoff ||
      new Set(candidateIds).size !== candidateIds.length ||
      !sameSet(candidateIds, evidenceCandidateIds) ||
      !sameSet(candidateIds, handoffCandidateIds) ||
      handoff.excludedCandidateIds.some((id) => candidateIds.includes(id)) ||
      !sameSet(
        candidateIds,
        gold.candidates.map(({ candidateId }) => candidateId),
      )
    ) {
      diagnostics.push(
        diagnostic(
          'ranking.case.authority-closure',
          binding.caseId,
          'Ranking case candidate, family, cutoff, or authority closure is inconsistent.',
        ),
      );
      continue;
    }
    validateCriterionClosure(request, criteria, binding.caseId, diagnostics);
    validateCriterionEvidenceReachability(resolved, diagnostics);
    validateHandoffClosure(resolved, gold, diagnostics);
    validateGoldClosure(resolved, gold, diagnostics);
  }
  validateAuditPattern(corpus, diagnostics);
  validateControlledPairs(corpus, cases, diagnostics);
  validateCriterionCoverage(corpus, cases, diagnostics);
  validateReviewerRationales(corpus, cases, diagnostics);
}

export function isBoundMaterialSuccessReachable(
  binding: RankingCriterionBinding,
  evidence: RankingEvidenceSet,
): boolean {
  if (
    binding.criterionKind !== 'success-condition' ||
    binding.bindingState !== 'bound' ||
    binding.materiality !== 'material'
  ) {
    return true;
  }
  if (
    binding.candidateFeatureDependencies.length !== 1 ||
    binding.expectedValues.length === 0
  ) {
    return false;
  }
  const featureId = binding.candidateFeatureDependencies[0];
  return evidence.candidates.some((candidate) =>
    candidate.observations.some(
      (observation) =>
        observation.featureId === featureId &&
        observation.state === 'known' &&
        binding.expectedValues.every((value) =>
          observation.values.includes(value),
        ),
    ),
  );
}

function validateCriterionEvidenceReachability(
  resolved: RankingResolvedCase,
  diagnostics: RankingDiagnostic[],
): void {
  for (const binding of resolved.criteria.bindings) {
    if (binding.bindingState !== 'bound') continue;
    const candidateFeatureId = binding.candidateFeatureDependencies[0];
    const everyCandidateHasDimension =
      binding.candidateFeatureDependencies.length === 1 &&
      resolved.evidence.candidates.every((candidate) =>
        candidate.observations.some(
          ({ featureId }) => featureId === candidateFeatureId,
        ),
      );
    const ruleShapeValid =
      (binding.comparisonRuleId === 'candidate-has-all/1.0.0' &&
        binding.targetFactDependencies.length === 0 &&
        binding.expectedValues.length > 0) ||
      (binding.comparisonRuleId === 'prefer-available-candidate-values/1.0.0' &&
        binding.criterionKind === 'preference' &&
        binding.targetFactDependencies.length === 1 &&
        binding.expectedValues.length === 0) ||
      (binding.comparisonRuleId === 'prefer-candidate-values/1.0.0' &&
        binding.criterionKind === 'preference' &&
        binding.targetFactDependencies.length === 0 &&
        binding.expectedValues.length > 0);
    if (!everyCandidateHasDimension || !ruleShapeValid) {
      diagnostics.push(
        diagnostic(
          'ranking.criterion.fact-binding',
          `${resolved.binding.caseId}/${binding.criterionId}`,
          'Every bound criterion must name one available candidate fact dimension and a comparison rule whose target and expected-value shape matches that fact.',
        ),
      );
    }
    if (!isBoundMaterialSuccessReachable(binding, resolved.evidence)) {
      diagnostics.push(
        diagnostic(
          'ranking.criterion.bound-material-unreachable',
          `${resolved.binding.caseId}/${binding.criterionId}`,
          'A bound material success criterion must be satisfiable by a known value at its declared candidate fact dimension; ranking-v1 has no deliberate-zero-coverage case.',
        ),
      );
    }
  }
}

function validateCriterionClosure(
  request: RankingResolvedCase['request'],
  criteria: RankingCriterionAuthority,
  caseId: string,
  diagnostics: RankingDiagnostic[],
): void {
  const criterionIds = [
    ...request.successConditions.map(({ criterionId }) => criterionId),
    ...request.preferences.map(({ criterionId }) => criterionId),
  ];
  const bindingIds = criteria.bindings.map(({ criterionId }) => criterionId);
  const hardRuleIds = criteria.hardConstraintRules.map(
    ({ constraintId }) => constraintId,
  );
  if (
    !isSortedUnique([...bindingIds].sort(compareRankingText)) ||
    !sameSet(criterionIds, bindingIds) ||
    !sameSet(
      request.hardConstraints.map(({ criterionId }) => criterionId),
      hardRuleIds,
    ) ||
    criteria.bindings.some((binding) => {
      const isSuccess = request.successConditions.some(
        ({ criterionId }) => criterionId === binding.criterionId,
      );
      return isSuccess !== (binding.criterionKind === 'success-condition');
    })
  ) {
    diagnostics.push(
      diagnostic(
        'ranking.criterion.closure',
        caseId,
        'Criterion authority must close every success condition, preference, and hard constraint without candidate answer mappings.',
      ),
    );
  }
}

function validateHandoffClosure(
  resolved: RankingResolvedCase,
  gold: RankingGoldAuthority['cases'][number],
  diagnostics: RankingDiagnostic[],
): void {
  const evidenceByCandidate = new Map(
    resolved.evidence.candidates.map((candidate) => [
      candidate.candidateId,
      candidate,
    ]),
  );
  const expectedResolutionKeys: string[] = [];
  for (const candidate of resolved.handoff.candidates) {
    const unresolved = candidate.unresolvedHardEvaluations;
    if (
      (candidate.lane === 'eligible' && unresolved.length !== 0) ||
      (candidate.lane === 'evidence-needed' && unresolved.length === 0)
    ) {
      diagnostics.push(
        diagnostic(
          'ranking.handoff.lane-state',
          resolved.binding.caseId,
          'Phase 9 handoff lane and unresolved-evaluation state disagree.',
        ),
      );
    }
    for (const item of unresolved) {
      expectedResolutionKeys.push(
        associationKey(candidate.candidateId, item.evaluationId),
      );
      const evidenceCandidate = evidenceByCandidate.get(candidate.candidateId);
      if (
        rankingValuesDiffer(item.match, 'unresolved') ||
        rankingValuesDiffer(item.state, 'unresolved') ||
        item.candidateFeatureDependencies.length === 0 ||
        item.candidateFeatureDependencies.some(
          (featureId) =>
            !evidenceCandidate?.observations.some(
              (observation) => observation.featureId === featureId,
            ),
        ) ||
        item.ruleId.length === 0
      ) {
        diagnostics.push(
          diagnostic(
            'ranking.handoff.closure-evidence',
            resolved.binding.caseId,
            'Every unresolved Phase 9 evaluation must retain unresolved handoff state and reference request-independent facts plus a closure rule.',
          ),
        );
      }
    }
  }
  const goldResolutionKeys = gold.evidenceNeededResolutions.map((item) =>
    associationKey(item.candidateId, item.evaluationId),
  );
  if (!sameSet(expectedResolutionKeys, goldResolutionKeys)) {
    diagnostics.push(
      diagnostic(
        'ranking.handoff.gold-resolution',
        resolved.binding.caseId,
        'Gold must explicitly resolve every and only supplied evidence-needed evaluation.',
      ),
    );
  }
}

function validateGoldClosure(
  resolved: RankingResolvedCase,
  gold: RankingGoldAuthority['cases'][number],
  diagnostics: RankingDiagnostic[],
): void {
  const candidateIds = resolved.candidateSet.candidates.map(
    ({ candidateId }) => candidateId,
  );
  const evidenceIds = new Set(
    resolved.evidence.candidates.flatMap(({ observations }) =>
      observations.map(({ evidenceId }) => evidenceId),
    ),
  );
  const evidenceOwner = new Map(
    resolved.evidence.candidates.flatMap((candidate) =>
      candidate.observations.map(
        ({ evidenceId }) => [evidenceId, candidate.candidateId] as const,
      ),
    ),
  );
  const positive = gold.candidates.filter(
    ({ disposition }) =>
      disposition === 'recommended' || disposition === 'viable',
  );
  const rejected = gold.candidates.filter(
    ({ disposition }) => disposition === 'rejected',
  );
  const insufficient = gold.candidates.filter(
    ({ disposition }) => disposition === 'insufficient-evidence',
  );
  const outcomeValid =
    (gold.outcome === 'recommend' && positive.length > 0) ||
    (gold.outcome === 'no-viable-candidate' &&
      rejected.length === candidateIds.length) ||
    (gold.outcome === 'insufficient-evidence' &&
      positive.length === 0 &&
      insufficient.length > 0);
  const positiveTraceable = positive.every(
    ({ evidenceIds: ids, reasonCodes }) =>
      ids.length > 0 &&
      reasonCodes.length > 0 &&
      ids.every((id) => evidenceIds.has(id)),
  );
  const conflictTraceable = gold.hardConstraintConflicts.every(
    (conflict) =>
      candidateIds.includes(conflict.candidateId) &&
      conflict.evidenceIds.length > 0 &&
      conflict.evidenceIds.every((id) => evidenceIds.has(id)) &&
      resolved.request.hardConstraints.find(
        ({ criterionId }) => criterionId === conflict.constraintId,
      )?.reasonCode === conflict.reasonCode &&
      gold.candidates.find(
        ({ candidateId }) => candidateId === conflict.candidateId,
      )?.disposition === 'rejected',
  );
  const referencesValid = [
    ...gold.presentation,
    ...gold.rankGroups.flat(),
    ...gold.rankRelations.flatMap((relation) => [
      relation.higherCandidateId,
      relation.lowerCandidateId,
    ]),
    ...gold.incomparablePairs.flat(),
  ].every((candidateId) => candidateIds.includes(candidateId));
  const rankingReferenceIds = new Set([
    ...gold.rankGroups.flat(),
    ...gold.rankRelations.flatMap((relation) => [
      relation.higherCandidateId,
      relation.lowerCandidateId,
    ]),
    ...gold.incomparablePairs.flat(),
  ]);
  const presentationIds = new Set(gold.presentation);
  const maximumResultsClosure =
    presentationIds.size === gold.presentation.length &&
    rankingReferenceIds.size <= resolved.binding.requestedMaximumResults &&
    [...rankingReferenceIds].every((candidateId) =>
      presentationIds.has(candidateId),
    ) &&
    (gold.presentation.length > 0 ||
      (gold.rankGroups.length === 0 &&
        gold.rankRelations.length === 0 &&
        gold.incomparablePairs.length === 0));
  const candidateEvidenceOwned = gold.candidates.every((candidate) =>
    candidate.evidenceIds.every(
      (evidenceId) => evidenceOwner.get(evidenceId) === candidate.candidateId,
    ),
  );
  const conflictEvidenceOwned = gold.hardConstraintConflicts.every((conflict) =>
    conflict.evidenceIds.every(
      (evidenceId) => evidenceOwner.get(evidenceId) === conflict.candidateId,
    ),
  );
  const resolutionEvidenceOwned = gold.evidenceNeededResolutions.every(
    (resolution) =>
      resolution.evidenceIds.every(
        (evidenceId) =>
          evidenceOwner.get(evidenceId) === resolution.candidateId,
      ),
  );
  if (
    !outcomeValid ||
    !positiveTraceable ||
    !conflictTraceable ||
    !referencesValid ||
    !maximumResultsClosure ||
    !candidateEvidenceOwned ||
    !conflictEvidenceOwned ||
    !resolutionEvidenceOwned ||
    gold.presentation.length > resolved.binding.requestedMaximumResults ||
    gold.candidates.some((candidate) =>
      candidate.evidenceIds.some((id) => !evidenceIds.has(id)),
    ) ||
    gold.allowedAlternativeOutcomes.length !== 0 ||
    rankingValuesDiffer(gold.noPreferenceHardening, true)
  ) {
    diagnostics.push(
      diagnostic(
        'ranking.gold.closure',
        resolved.binding.caseId,
        'Gold outcome, candidate, traceability, ranking, or safety closure is inconsistent.',
      ),
    );
  }
  validateDerivedGoldClosure(resolved, gold, diagnostics);
  const positiveIds = positive
    .map(({ candidateId }) => candidateId)
    .filter((candidateId) => presentationIds.has(candidateId));
  for (let leftIndex = 0; leftIndex < positiveIds.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < positiveIds.length;
      rightIndex += 1
    ) {
      const left = positiveIds[leftIndex];
      const right = positiveIds[rightIndex];
      if (left === undefined || right === undefined) continue;
      const deliberateCount =
        Number(
          gold.rankGroups.some(
            (group) => group.includes(left) && group.includes(right),
          ),
        ) +
        Number(
          gold.rankRelations.some(
            ({ higherCandidateId, lowerCandidateId }) =>
              (higherCandidateId === left && lowerCandidateId === right) ||
              (higherCandidateId === right && lowerCandidateId === left),
          ),
        ) +
        Number(
          gold.incomparablePairs.some(
            (pair) => pair.includes(left) && pair.includes(right),
          ),
        );
      if (deliberateCount !== 1) {
        diagnostics.push(
          diagnostic(
            'ranking.gold.positive-pair-semantics',
            resolved.binding.caseId,
            'Every material positive pair must be deliberately and exclusively tied, ordered, or incomparable; non-positive pairs are intentionally not presented.',
          ),
        );
      }
    }
  }
  if (
    gold.hardConstraintConflicts.length === 0 ||
    gold.preferenceConsequences.some(({ affectedPairs }) =>
      affectedPairs
        .flat()
        .some((candidateId) => !candidateIds.includes(candidateId)),
    ) ||
    gold.unboundPreferenceCounterfactuals.some(({ candidatePair }) =>
      candidatePair.some((candidateId) => !candidateIds.includes(candidateId)),
    )
  ) {
    diagnostics.push(
      diagnostic(
        'ranking.gold.review-coverage',
        resolved.binding.caseId,
        'Gold must expose a safety opportunity and keep preference comparison references inside the fixed candidate set.',
      ),
    );
  }
  const successIds = resolved.request.successConditions.map(
    ({ criterionId }) => criterionId,
  );
  if (
    !sameSet(
      gold.successConditionCoverage.map((entry) =>
        associationKey(entry.candidateId, entry.criterionId),
      ),
      candidateIds.flatMap((candidateId) =>
        successIds.map((criterionId) =>
          associationKey(candidateId, criterionId),
        ),
      ),
    ) ||
    !sameSet(
      gold.preferenceConsequences.map(({ criterionId }) => criterionId),
      resolved.request.preferences.map(({ criterionId }) => criterionId),
    )
  ) {
    diagnostics.push(
      diagnostic(
        'ranking.gold.criterion-closure',
        resolved.binding.caseId,
        'Gold must state every candidate success-condition consequence and every preference consequence.',
      ),
    );
  }
}

function validateDerivedGoldClosure(
  resolved: RankingResolvedCase,
  gold: RankingGoldAuthority['cases'][number],
  diagnostics: RankingDiagnostic[],
): void {
  const input = {
    capabilityFamily: resolved.binding.capabilityFamily,
    request: resolved.request,
    criteria: resolved.criteria,
    target: resolved.target,
    candidates: [...resolved.candidateSet.candidates].sort((left, right) =>
      compareRankingText(left.candidateId, right.candidateId),
    ),
    candidateEvidence: [...resolved.evidence.candidates].sort((left, right) =>
      compareRankingText(left.candidateId, right.candidateId),
    ),
    handoffCandidates: [...resolved.handoff.candidates].sort(
      (left, right) => left.retrievalOrder - right.retrievalOrder,
    ),
    requestedMaximumResults: resolved.binding.requestedMaximumResults,
  };
  const fits = input.candidates.map(({ candidateId }) =>
    deriveCandidateFit(input, candidateId, true),
  );
  const positives = fits.filter(({ disposition }) => disposition === 'viable');
  const preferenceIds = resolved.criteria.bindings
    .filter(
      ({ criterionKind, bindingState }) =>
        criterionKind === 'preference' && bindingState === 'bound',
    )
    .map(({ criterionId }) => criterionId)
    .sort(compareRankingText);
  const maximalIds = new Set(
    positives
      .filter(
        (candidate) =>
          !positives.some(
            (other) =>
              other.candidateId !== candidate.candidateId &&
              compareCandidateFit(other, candidate, preferenceIds) ===
                'left-higher',
          ),
      )
      .map(({ candidateId }) => candidateId),
  );
  const ranking = createPartialOrderPresentation(
    positives,
    preferenceIds,
    resolved.binding.requestedMaximumResults,
  );
  const preferenceConsequences = derivePreferenceConsequences(
    fits,
    resolved.criteria.bindings,
  );
  const expectedCandidates = fits
    .map((fit) => ({
      candidateId: fit.candidateId,
      disposition:
        fit.disposition === 'viable' && maximalIds.has(fit.candidateId)
          ? ('recommended' as const)
          : fit.disposition,
      reasonCodes: fit.reasonCodes,
      evidenceIds: deriveDecisionEvidenceIds(
        fit,
        fits,
        ranking.presentation,
        preferenceIds,
        preferenceConsequences,
      ),
      unknownIds: fit.unknownIds,
    }))
    .sort((left, right) =>
      compareRankingText(left.candidateId, right.candidateId),
    );
  const expected = {
    outcome:
      positives.length > 0
        ? ('recommend' as const)
        : fits.some(
              ({ disposition }) => disposition === 'insufficient-evidence',
            )
          ? ('insufficient-evidence' as const)
          : ('no-viable-candidate' as const),
    candidates: expectedCandidates,
    ...ranking,
    hardConstraintConflicts: fits
      .flatMap(({ hardConflicts }) => hardConflicts)
      .sort((left, right) =>
        compareRankingText(
          `${left.candidateId}\0${left.constraintId}`,
          `${right.candidateId}\0${right.constraintId}`,
        ),
      ),
    requiredUnknowns: fits
      .flatMap((fit) =>
        fit.unknownIds.map((unknownId) => ({
          candidateId: fit.candidateId,
          unknownId,
        })),
      )
      .sort((left, right) =>
        compareRankingText(
          `${left.candidateId}\0${left.unknownId}`,
          `${right.candidateId}\0${right.unknownId}`,
        ),
      ),
    evidenceNeededResolutions: fits
      .flatMap(({ resolutions }) => resolutions)
      .sort((left, right) =>
        compareRankingText(
          `${left.candidateId}\0${left.evaluationId}`,
          `${right.candidateId}\0${right.evaluationId}`,
        ),
      ),
    successConditionCoverage: fits
      .flatMap(({ coverage }) => coverage)
      .sort((left, right) =>
        compareRankingText(
          `${left.candidateId}\0${left.criterionId}`,
          `${right.candidateId}\0${right.criterionId}`,
        ),
      ),
    preferenceConsequences,
  };
  const actual = {
    outcome: gold.outcome,
    candidates: gold.candidates,
    presentation: gold.presentation,
    rankGroups: gold.rankGroups,
    rankRelations: gold.rankRelations,
    incomparablePairs: gold.incomparablePairs,
    hardConstraintConflicts: gold.hardConstraintConflicts,
    requiredUnknowns: gold.requiredUnknowns,
    evidenceNeededResolutions: gold.evidenceNeededResolutions,
    successConditionCoverage: gold.successConditionCoverage,
    preferenceConsequences: gold.preferenceConsequences,
  };
  if (rankingStableJson(expected) !== rankingStableJson(actual)) {
    diagnostics.push(
      diagnostic(
        'ranking.gold.derived-authority-drift',
        resolved.binding.caseId,
        'Proposed gold must be derived consistently from request, criteria, target, candidate facts, handoff state, and frozen evaluation rules, including decision-minimal evidence associations.',
      ),
    );
  }
}

function validateAuditPattern(
  corpus: RankingValidatedCorpus,
  diagnostics: RankingDiagnostic[],
): void {
  for (const family of RANKING_FAMILIES) {
    const classes = corpus.audit.cases
      .filter((entry) => entry.family === family)
      .map(({ primaryClass }) => primaryClass);
    const required = [
      'controlled-target-pair',
      'controlled-target-pair',
      'hard-conflict-no-viable',
      'evidence-insufficient',
      'popularity-over-fit',
    ];
    if (
      required.some(
        (value) =>
          classes.filter((candidate) => candidate === value).length !==
          required.filter((candidate) => candidate === value).length,
      ) ||
      classes.filter(
        (value) => value === 'tie' || value === 'explicit-incomparability',
      ).length !== 1
    ) {
      diagnostics.push(
        diagnostic(
          'ranking.audit.family-pattern',
          family,
          'Each family must contain the exact controlled-pair, no-viable, insufficient, popularity-over-fit, and tie/incomparability pattern.',
        ),
      );
    }
  }
  if (
    !corpus.audit.cases.some(({ primaryClass }) => primaryClass === 'tie') ||
    !corpus.audit.cases.some(
      ({ primaryClass }) => primaryClass === 'explicit-incomparability',
    )
  ) {
    diagnostics.push(
      diagnostic(
        'ranking.audit.partial-order-balance',
        'audit.cases',
        'The complete authority must contain both ties and explicit incomparable pairs.',
      ),
    );
  }
}

function validateControlledPairs(
  corpus: RankingValidatedCorpus,
  cases: readonly RankingResolvedCase[],
  diagnostics: RankingDiagnostic[],
): void {
  const byCase = new Map(cases.map((entry) => [entry.binding.caseId, entry]));
  if (
    corpus.audit.controlledPairs.length !== 5 ||
    corpus.gold.controlledPairDirections.length !== 5
  ) {
    diagnostics.push(
      diagnostic(
        'ranking.controlled-pair.count',
        'audit.controlledPairs',
        'Ranking authority requires exactly one controlled pair per family.',
      ),
    );
    return;
  }
  for (const pair of corpus.audit.controlledPairs) {
    const first = byCase.get(pair.firstCaseId);
    const second = byCase.get(pair.secondCaseId);
    const direction = corpus.gold.controlledPairDirections.find(
      ({ pairId }) => pairId === pair.pairId,
    );
    if (
      first === undefined ||
      second === undefined ||
      direction === undefined ||
      first.binding.capabilityFamily !== second.binding.capabilityFamily ||
      first.binding.requestAuthorityId !== second.binding.requestAuthorityId ||
      first.binding.criterionAuthorityId !==
        second.binding.criterionAuthorityId ||
      first.binding.candidateSetId !== second.binding.candidateSetId ||
      first.binding.evidenceSetId !== second.binding.evidenceSetId ||
      first.binding.handoffAuthorityId !== second.binding.handoffAuthorityId ||
      first.binding.evidenceCutoff !== second.binding.evidenceCutoff ||
      rankingValuesDiffer(
        first.binding.requestedMaximumResults,
        second.binding.requestedMaximumResults,
      ) ||
      direction.firstCaseId !== pair.firstCaseId ||
      direction.secondCaseId !== pair.secondCaseId ||
      direction.firstMaximalCandidateIds.length !== 1 ||
      direction.secondMaximalCandidateIds.length !== 1 ||
      sameSet(
        direction.firstMaximalCandidateIds,
        direction.secondMaximalCandidateIds,
      ) ||
      !sameSet(
        direction.firstMaximalCandidateIds,
        corpus.gold.cases
          .find(({ caseId }) => caseId === pair.firstCaseId)
          ?.candidates.filter(
            ({ disposition }) => disposition === 'recommended',
          )
          .map(({ candidateId }) => candidateId) ?? [],
      ) ||
      !sameSet(
        direction.secondMaximalCandidateIds,
        corpus.gold.cases
          .find(({ caseId }) => caseId === pair.secondCaseId)
          ?.candidates.filter(
            ({ disposition }) => disposition === 'recommended',
          )
          .map(({ candidateId }) => candidateId) ?? [],
      ) ||
      !sameOrderedValues(
        diffPaths(first.target, second.target).filter(
          (path) =>
            path !== '/targetAuthorityId' &&
            path !== '/fingerprintId' &&
            path !== '/semanticDigest',
        ),
        pair.changedTargetPaths,
      )
    ) {
      diagnostics.push(
        diagnostic(
          'ranking.controlled-pair.invariant',
          pair.pairId,
          'Controlled pair may differ only at declared target facts and must require a different preferred candidate.',
        ),
      );
    }
  }
}

function validateCriterionCoverage(
  corpus: RankingValidatedCorpus,
  cases: readonly RankingResolvedCase[],
  diagnostics: RankingDiagnostic[],
): void {
  const bindings = cases.flatMap(({ criteria }) => criteria.bindings);
  const requests = cases.map(({ request }) => request);
  const checks = [
    bindings.some(
      (binding) =>
        binding.criterionKind === 'success-condition' &&
        binding.bindingState === 'bound',
    ),
    requests.some(({ successConditions }) => successConditions.length > 1),
    bindings.some(
      (binding) =>
        binding.criterionKind === 'success-condition' &&
        binding.bindingState === 'unbound' &&
        binding.materiality === 'material',
    ),
    bindings.some(
      (binding) =>
        binding.criterionKind === 'success-condition' &&
        binding.bindingState === 'unbound' &&
        binding.materiality === 'non-material',
    ),
    requests.some(({ preferences }) =>
      preferences.some(
        ({ source }) => source === 'normalized-preferred-constraint',
      ),
    ),
    requests.some(({ preferences }) =>
      preferences.some(
        ({ source }) => source === 'explicit-structured-approval',
      ),
    ),
    bindings.some(
      (binding) =>
        binding.criterionKind === 'preference' &&
        binding.bindingState === 'unbound',
    ),
    bindings.some(
      (binding) =>
        binding.criterionKind === 'success-condition' &&
        binding.bindingState === 'unbound' &&
        binding.materiality === null,
    ),
  ];
  if (checks.some((value) => !value)) {
    diagnostics.push(
      diagnostic(
        'ranking.criterion.coverage',
        'blind.criterionAuthorities',
        'Ranking corpus omits one or more required criterion-binding semantics.',
      ),
    );
  }
  for (const family of RANKING_FAMILIES) {
    const familyCaseIds = new Set(
      cases
        .filter(({ binding }) => binding.capabilityFamily === family)
        .map(({ binding }) => binding.caseId),
    );
    if (
      !corpus.gold.cases.some(
        (gold) =>
          familyCaseIds.has(gold.caseId) &&
          gold.preferenceConsequences.some(
            ({ state, affectedPairs }) =>
              state === 'applied-and-changed-supported-comparison' &&
              affectedPairs.length > 0,
          ),
      )
    ) {
      diagnostics.push(
        diagnostic(
          'ranking.criterion.preference-causal-family-coverage',
          family,
          'Every capability family requires at least one bound preference that causally changes a supported positive comparison without becoming a hard constraint.',
        ),
      );
    }
  }
}

function auditBlindAuthority(
  blind: RankingBlindCaseAuthority,
  diagnostics: RankingDiagnostic[],
): void {
  const forbiddenKeys = new Set([
    'allowedAlternativeOutcomes',
    'auditLabels',
    'controlledPairDirections',
    'disposition',
    'gold',
    'independentReviewer',
    'outcome',
    'primaryClass',
    'rankGroups',
    'rankRelations',
    'rationaleNotes',
    'recommendedCandidateId',
    'reviewStatus',
    'threshold',
    'winner',
  ]);
  const visit = (value: unknown, path: string): void => {
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        visit(item, `${path}/${String(index)}`);
      });
      return;
    }
    if (typeof value !== 'object' || value === null) return;
    for (const [key, child] of Object.entries(value)) {
      if (forbiddenKeys.has(key)) {
        diagnostics.push(
          diagnostic(
            'ranking.blind.gold-leakage',
            `${path}/${key}`,
            'Blind ranking authority contains a gold, audit, review, or gate field.',
          ),
        );
      }
      visit(child, `${path}/${key}`);
    }
  };
  visit(blind, 'blind');
}

function auditCandidateEvidence(
  corpus: RankingValidatedCorpus,
  diagnostics: RankingDiagnostic[],
): void {
  const requestCriterionIds = new Set(
    corpus.blind.requests.flatMap((request) => [
      ...request.successConditions.map(({ criterionId }) => criterionId),
      ...request.hardConstraints.map(({ criterionId }) => criterionId),
      ...request.preferences.map(({ criterionId }) => criterionId),
    ]),
  );
  const forbiddenKeyPattern =
    /^(?:supportedSuccessConditionIds|supportedPreferenceIds|closureAssertions|resolution|disposition|rank|winner)$/u;
  const forbiddenFeaturePattern =
    /(?:success-condition|preference|hard-constraint|evidence-needed-closure)/u;
  const visit = (value: unknown, path: string): void => {
    if (Array.isArray(value)) {
      value.forEach((child, index) => {
        visit(child, `${path}/${String(index)}`);
      });
      return;
    }
    if (typeof value !== 'object' || value === null) return;
    for (const [key, child] of Object.entries(value)) {
      if (forbiddenKeyPattern.test(key)) {
        diagnostics.push(
          diagnostic(
            'ranking.evidence.request-answer-leakage',
            `${path}/${key}`,
            'Candidate evidence contains a request-conditioned answer field.',
          ),
        );
      }
      visit(child, `${path}/${key}`);
    }
  };
  visit(corpus.evidence, 'evidence');
  for (const evidenceSet of corpus.evidence.evidenceSets) {
    for (const candidate of evidenceSet.candidates) {
      for (const observation of candidate.observations) {
        if (
          observation.candidateId !== candidate.candidateId ||
          forbiddenFeaturePattern.test(observation.featureId) ||
          observation.values.some(
            (value) =>
              requestCriterionIds.has(value) ||
              value === 'satisfied' ||
              value === 'conflict' ||
              value === 'unresolved',
          ) ||
          rankingValuesDiffer(
            observation.provenance.productionAuthority,
            false,
          ) ||
          (observation.provenance.basis === 'committed-pilot-evidence-concept'
            ? observation.provenance.sourceReference === null ||
              observation.provenance.claimScope !==
                'concept-crosswalk-not-current-project-authority'
            : observation.provenance.basis === 'ranking-v1-controlled-fixture'
              ? observation.provenance.sourceReference !== null ||
                observation.provenance.claimScope !==
                  'scenario-synthetic-not-project-authority'
              : true)
        ) {
          diagnostics.push(
            diagnostic(
              'ranking.evidence.request-independent-fact',
              `${evidenceSet.evidenceSetId}/${candidate.candidateId}/${observation.evidenceId}`,
              'Candidate evidence must be request-independent, provenance-bound evaluation authority and must not contain a final fit or closure answer.',
            ),
          );
        }
      }
    }
  }
}

function validateReviewerRationales(
  corpus: RankingValidatedCorpus,
  cases: readonly RankingResolvedCase[],
  diagnostics: RankingDiagnostic[],
): void {
  const controlledCaseIds = new Set(
    corpus.audit.controlledPairs.flatMap(({ firstCaseId, secondCaseId }) => [
      firstCaseId,
      secondCaseId,
    ]),
  );
  const resolvedByCase = new Map(
    cases.map((resolved) => [resolved.binding.caseId, resolved]),
  );
  const goldByCase = new Map(
    corpus.gold.cases.map((gold) => [gold.caseId, gold]),
  );
  for (const rationale of corpus.reviewerRationale.cases) {
    const resolved = resolvedByCase.get(rationale.caseId);
    const gold = goldByCase.get(rationale.caseId);
    const requiredSections = [
      rationale.requestRequirements,
      rationale.materialTargetFacts,
      rationale.coverageEvidence,
      rationale.hardConflictEvidence,
      rationale.materialInsufficiency,
      rationale.preferenceAnalysis,
      rationale.maximalSetAnalysis,
      rationale.partialOrderAnalysis,
    ];
    if (
      requiredSections.some(
        (section) =>
          section.length === 0 ||
          section.some((entry) => entry.trim().length < 12),
      ) ||
      controlledCaseIds.has(rationale.caseId) !==
        (rationale.controlledPairChange !== null)
    ) {
      diagnostics.push(
        diagnostic(
          'ranking.review.rationale-completeness',
          rationale.caseId,
          'Every case requires substantive author rationale, and every controlled half requires an exact target-change explanation.',
        ),
      );
    }
    if (resolved === undefined || gold === undefined) continue;
    const bindings = resolved.criteria.bindings.filter(
      ({ criterionKind }) => criterionKind === 'success-condition',
    );
    const coverageByKey = new Map(
      gold.successConditionCoverage.map((coverage) => [
        associationKey(coverage.candidateId, coverage.criterionId),
        coverage.state,
      ]),
    );
    const crosswalkByCriterion = new Map(
      rationale.criterionBindingCrosswalk.map((crosswalk) => [
        crosswalk.criterionId,
        crosswalk,
      ]),
    );
    let crosswalkValid = sameSet(
      bindings.map(({ criterionId }) => criterionId),
      rationale.criterionBindingCrosswalk.map(({ criterionId }) => criterionId),
    );
    for (const binding of bindings) {
      const crosswalk = crosswalkByCriterion.get(binding.criterionId);
      if (crosswalk === undefined) {
        crosswalkValid = false;
        continue;
      }
      crosswalkValid &&=
        crosswalk.bindingState === binding.bindingState &&
        sameOrderedValues(
          crosswalk.candidateFeatureDependencies,
          binding.candidateFeatureDependencies,
        ) &&
        sameOrderedValues(crosswalk.expectedValues, binding.expectedValues) &&
        sameSet(
          crosswalk.candidateFacts.map(({ candidateId }) => candidateId),
          resolved.candidateSet.candidates.map(
            ({ candidateId }) => candidateId,
          ),
        );
      for (const candidate of resolved.candidateSet.candidates) {
        const candidateFact = crosswalk.candidateFacts.find(
          ({ candidateId }) => candidateId === candidate.candidateId,
        );
        const evidenceCandidate = resolved.evidence.candidates.find(
          ({ candidateId }) => candidateId === candidate.candidateId,
        );
        const observation = evidenceCandidate?.observations.find(
          ({ featureId }) =>
            featureId === binding.candidateFeatureDependencies[0],
        );
        const expectedEvidenceId =
          binding.bindingState === 'bound'
            ? (observation?.evidenceId ?? null)
            : null;
        const expectedValues =
          binding.bindingState === 'bound' ? (observation?.values ?? []) : [];
        const expectedCoverage = coverageByKey.get(
          associationKey(candidate.candidateId, binding.criterionId),
        );
        const coverageStatement = rationale.coverageEvidence.find((entry) =>
          entry.startsWith(
            `${candidate.candidateId} ${String(expectedCoverage)} ${binding.criterionId}:`,
          ),
        );
        crosswalkValid &&=
          candidateFact?.evidenceId === expectedEvidenceId &&
          sameOrderedValues(candidateFact.observedValues, expectedValues) &&
          candidateFact.coverageState === expectedCoverage &&
          coverageStatement !== undefined &&
          (binding.bindingState === 'unbound' ||
            (coverageStatement.includes(
              `feature=${binding.candidateFeatureDependencies.join(',')}`,
            ) &&
              coverageStatement.includes(
                `evidence=${expectedEvidenceId ?? 'none'}`,
              )));
      }
    }
    if (!crosswalkValid) {
      diagnostics.push(
        diagnostic(
          'ranking.review.rationale-binding-crosswalk',
          rationale.caseId,
          'Reviewer rationale criterion paths, evidence facts, and coverage states must exactly match the criterion binding, candidate-owned observation, and proposed gold.',
        ),
      );
    }
  }
}

function validatePilotImmutability(
  repositoryRoot: string,
  diagnostics: RankingDiagnostic[],
): void {
  const pilotRoot = join(repositoryRoot, 'evals/pilot-v1');
  const files = listFiles(pilotRoot);
  const hash = createHash('sha256');
  for (const path of files) {
    hash.update(path);
    hash.update('\0');
    hash.update(hashFile(join(pilotRoot, path)));
    hash.update('\n');
  }
  if (files.length !== 31 || hash.digest('hex') !== EXPECTED_PILOT_V1_DIGEST) {
    diagnostics.push(
      diagnostic(
        'ranking.pilot-v1.immutable',
        'evals/pilot-v1',
        'Historical pilot-v1 authority must remain byte-for-byte immutable.',
      ),
    );
  }
}

function validateAcceptedAuthority(
  corpusRoot: string,
  corpus: RankingAcceptedValidatedCorpus,
  diagnostics: RankingDiagnostic[],
): void {
  const expectedReview = createRankingAcceptedReviewRecord();
  const expectedGates = createRankingAcceptedGateAuthority();
  const coreAuthorityDigest = rankingDigest({
    blind: corpus.blind.semanticDigest,
    evidence: corpus.evidence.semanticDigest,
    handoff: corpus.handoff.semanticDigest,
    gold: corpus.gold.semanticDigest,
    audit: corpus.audit.semanticDigest,
    reviewerRationale: corpus.reviewerRationale.semanticDigest,
    review: corpus.review.semanticDigest,
  });
  const reviewedFilesMatch = corpus.acceptedReview.reviewedContentFiles.every(
    ({ path, sha256 }) => {
      try {
        return hashFile(join(corpusRoot, path)) === sha256;
      } catch {
        return false;
      }
    },
  );
  if (
    rankingStableJson(corpus.acceptedReview) !==
      rankingStableJson(expectedReview) ||
    rankingStableJson(corpus.acceptedGates) !==
      rankingStableJson(expectedGates) ||
    !reviewedFilesMatch ||
    corpus.gold.semanticDigest !== RANKING_V1_ACCEPTED_GOLD_DIGEST ||
    coreAuthorityDigest !== RANKING_V1_ACCEPTED_CORE_AUTHORITY_DIGEST ||
    corpus.acceptedGates.bindings.acceptedReviewDigest !==
      corpus.acceptedReview.semanticDigest ||
    !sameOrderedValues(
      corpus.acceptedReview.acceptedCaseIds,
      corpus.gold.cases.map(({ caseId }) => caseId),
    )
  ) {
    diagnostics.push(
      diagnostic(
        'ranking.acceptance.binding',
        'reviews/accepted-review-record.json',
        'Accepted review, gates, reviewed content, or all-case adjudication binding is inconsistent.',
      ),
    );
  }
}

function classifyManifestPath(path: string): RankingManifestFile['kind'] {
  if (path === REQUIRED_AUTHORITY_PATHS.blind) return 'blind-cases';
  if (path === REQUIRED_AUTHORITY_PATHS.evidence) return 'candidate-evidence';
  if (path === REQUIRED_AUTHORITY_PATHS.handoff) return 'phase9-handoff';
  if (path === REQUIRED_AUTHORITY_PATHS.gold) return 'proposed-gold';
  if (path === REQUIRED_AUTHORITY_PATHS.audit) return 'audit-classification';
  if (path === REQUIRED_AUTHORITY_PATHS.reviewerRationale)
    return 'reviewer-rationale';
  if (path === REQUIRED_AUTHORITY_PATHS.review) return 'review-record';
  if (path === REQUIRED_AUTHORITY_PATHS.acceptedReview)
    return 'accepted-review-record';
  if (path === REQUIRED_AUTHORITY_PATHS.acceptedGates) return 'accepted-gates';
  if (path === 'baselines/specifications.json')
    return 'baseline-specifications';
  if (path.startsWith('baselines/predictions/')) return 'baseline-prediction';
  if (path === 'composition/blind-inputs.json') return 'composition-input';
  if (path === 'composition/gold.json') return 'composition-gold';
  if (path === 'composition/predictions.json') return 'composition-prediction';
  if (path === 'reports/baseline-report.json') return 'baseline-report';
  if (path === 'reports/composition-report.json') return 'composition-report';
  if (path === 'reports/performance-reference.json')
    return 'performance-reference';
  if (path === 'gates/proposed-review-inputs.json') return 'gate-review-input';
  if (path === 'fixtures/scorer-fixture-summary.json')
    return 'scorer-fixture-summary';
  throw new Error(`Unrecognized ranking-v1 authority path: ${path}`);
}

function loadJson(root: string, relativePath: string): unknown {
  const rootReal = realpathSync(root);
  const path = resolve(root, relativePath);
  if (!path.startsWith(`${rootReal}${sep}`)) throw new Error('Path escape.');
  const status = lstatSync(path);
  if (
    !status.isFile() ||
    status.isSymbolicLink() ||
    status.size > MAXIMUM_JSON_BYTES
  )
    throw new Error('Unsafe authority file.');
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

function listJsonFiles(root: string): string[] {
  return listFiles(root).filter((path) => path.endsWith('.json'));
}

function listFiles(root: string): string[] {
  if (!existsSync(root) || !lstatSync(root).isDirectory()) return [];
  const rootReal = realpathSync(root);
  const paths: string[] = [];
  const walk = (directory: string): void => {
    for (const name of readdirSync(directory).sort(compareRankingText)) {
      const path = join(directory, name);
      const status = lstatSync(path);
      if (status.isSymbolicLink())
        throw new Error('Authority symlink rejected.');
      if (status.isDirectory()) walk(path);
      else if (status.isFile()) paths.push(relative(rootReal, path));
    }
  };
  walk(rootReal);
  return paths.sort(compareRankingText);
}

function hashFile(path: string): string {
  const status = lstatSync(path);
  if (!status.isFile() || status.isSymbolicLink())
    throw new Error('Unsafe file.');
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function keyed<Item extends object, Key extends keyof Item>(
  items: readonly Item[],
  key: Key,
): Map<Item[Key], Item> {
  return new Map(items.map((item) => [item[key], item]));
}

function diffPaths(left: unknown, right: unknown, path = ''): string[] {
  if (rankingDigest(left) === rankingDigest(right)) return [];
  if (
    typeof left !== 'object' ||
    left === null ||
    typeof right !== 'object' ||
    right === null ||
    Array.isArray(left) !== Array.isArray(right)
  ) {
    return [path || '/'];
  }
  const leftObject = left as Record<string, unknown>;
  const rightObject = right as Record<string, unknown>;
  const keys = [
    ...new Set([...Object.keys(leftObject), ...Object.keys(rightObject)]),
  ].sort(compareRankingText);
  return keys.flatMap((key) =>
    diffPaths(leftObject[key], rightObject[key], `${path}/${key}`),
  );
}

function sameSet(left: readonly string[], right: readonly string[]): boolean {
  return (
    new Set(left).size === new Set(right).size &&
    left.every((value) => right.includes(value))
  );
}

function sameOrderedValues(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function isSortedUnique(values: readonly string[]): boolean {
  return values.every(
    (value, index) => index === 0 || (values[index - 1] ?? '') < value,
  );
}

function associationKey(left: string, right: string): string {
  return `${left}\0${right}`;
}

function diagnostic(
  code: string,
  path: string,
  message: string,
): RankingDiagnostic {
  return { code, path: path.slice(0, 256), message };
}

function finalizeDiagnostics(
  diagnostics: readonly RankingDiagnostic[],
): readonly RankingDiagnostic[] {
  return [...diagnostics]
    .sort((left, right) =>
      compareRankingText(
        `${left.path}\0${left.code}`,
        `${right.path}\0${right.code}`,
      ),
    )
    .slice(0, 500);
}
