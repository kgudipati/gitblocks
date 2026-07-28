import type {
  CandidateDisposition,
  EvaluationCase,
  EvidenceObservation,
  EvidenceSet,
  GoldResult,
  Outcome,
  Prediction,
  RankRelation,
  ReferenceDiagnostic,
} from './contracts.ts';

const MAXIMUM_DIAGNOSTICS = 500;

export function validateCaseBundle(
  caseDocument: EvaluationCase,
  evidence: EvidenceSet,
  gold: GoldResult,
): readonly ReferenceDiagnostic[] {
  const diagnostics: ReferenceDiagnostic[] = [];
  const candidateIds = caseDocument.candidates.map(
    (candidate) => candidate.candidateId,
  );
  const constraintIds = caseDocument.hardConstraints.map(
    (constraint) => constraint.constraintId,
  );
  const reasonIds = caseDocument.reasonCodes.map((reason) => reason.id);
  const unknownIds = caseDocument.unknowns.map((unknown) => unknown.id);
  const evidenceIds = evidence.observations.map(
    (observation) => observation.evidenceId,
  );

  reportDuplicates(diagnostics, candidateIds, 'case.candidates');
  reportDuplicates(diagnostics, constraintIds, 'case.hardConstraints');
  reportDuplicates(diagnostics, reasonIds, 'case.reasonCodes');
  reportDuplicates(diagnostics, unknownIds, 'case.unknowns');
  reportDuplicates(diagnostics, evidenceIds, 'evidence.observations');

  if (!isSorted(candidateIds)) {
    diagnostics.push(
      diagnostic(
        'reference.candidate-order',
        'Case candidates must use neutral lexical candidate ID order.',
        'case.candidates',
      ),
    );
  }

  if (
    evidence.caseId !== caseDocument.caseId ||
    gold.caseId !== caseDocument.caseId
  ) {
    diagnostics.push(
      diagnostic(
        'reference.case-id',
        'Case, evidence, and gold case IDs must agree.',
        'caseId',
      ),
    );
  }
  if (
    evidence.evidenceCutoff !== caseDocument.evidenceCutoff ||
    gold.evidenceCutoff !== caseDocument.evidenceCutoff
  ) {
    diagnostics.push(
      diagnostic(
        'reference.evidence-cutoff',
        'Case, evidence, and gold cutoff dates must agree.',
        'evidenceCutoff',
      ),
    );
  }
  if (!sameSet(caseDocument.evidenceIds, evidenceIds)) {
    diagnostics.push(
      diagnostic(
        'reference.evidence-set',
        'Case evidence IDs must exactly match the evidence observations.',
        'case.evidenceIds',
      ),
    );
  }

  const candidateSet = new Set(candidateIds);
  const reasonSet = new Set(reasonIds);
  const unknownSet = new Set(unknownIds);
  const evidenceById = new Map(
    evidence.observations.map((observation) => [
      observation.evidenceId,
      observation,
    ]),
  );

  for (const constraint of caseDocument.hardConstraints) {
    if (!reasonSet.has(constraint.reasonCode)) {
      diagnostics.push(
        diagnostic(
          'reference.unknown-reason',
          'Hard constraint reason code is not in the case catalog.',
          `case.hardConstraints.${constraint.constraintId}`,
        ),
      );
    }
  }
  for (const observation of evidence.observations) {
    validateEvidenceSubject(diagnostics, observation, candidateSet);
    validateEvidenceRevision(diagnostics, observation);
    validateEvidenceCutoff(
      diagnostics,
      observation,
      caseDocument.evidenceCutoff,
    );
  }

  const dispositionIds = gold.dispositions.map(
    (disposition) => disposition.candidateId,
  );
  reportDuplicates(diagnostics, dispositionIds, 'gold.dispositions');
  if (!sameSet(candidateIds, dispositionIds)) {
    diagnostics.push(
      diagnostic(
        'reference.candidate-set',
        'Gold must contain exactly one disposition for every case candidate.',
        'gold.dispositions',
      ),
    );
  }
  validateDispositionReferences(
    diagnostics,
    gold.dispositions,
    candidateSet,
    reasonSet,
    evidenceById,
    'gold.dispositions',
  );
  validateOutcome(diagnostics, gold.outcome, gold.dispositions, 'gold.outcome');
  if (gold.allowedAlternativeOutcomes.includes(gold.outcome)) {
    diagnostics.push(
      diagnostic(
        'reference.outcome',
        'Gold alternative outcomes must not repeat the primary outcome.',
        'gold.allowedAlternativeOutcomes',
      ),
    );
  }
  for (const [
    index,
    alternative,
  ] of gold.allowedAlternativeOutcomes.entries()) {
    validateOutcome(
      diagnostics,
      alternative,
      gold.dispositions,
      `gold.allowedAlternativeOutcomes.${String(index)}`,
    );
  }

  validateRanking(
    diagnostics,
    gold.dispositions,
    gold.rankGroups,
    gold.rankRelations,
    gold.incomparablePairs,
    'gold',
    true,
  );

  const constraintSet = new Set(constraintIds);
  const constraintsById = new Map(
    caseDocument.hardConstraints.map((constraint) => [
      constraint.constraintId,
      constraint,
    ]),
  );
  const dispositionsByCandidate = new Map(
    gold.dispositions.map((disposition) => [
      disposition.candidateId,
      disposition,
    ]),
  );
  for (const [index, conflict] of gold.hardConstraintConflicts.entries()) {
    const path = `gold.hardConstraintConflicts.${String(index)}`;
    if (!candidateSet.has(conflict.candidateId)) {
      diagnostics.push(
        diagnostic(
          'reference.unknown-candidate',
          'Hard conflict references an unknown candidate.',
          path,
        ),
      );
    }
    if (!constraintSet.has(conflict.constraintId)) {
      diagnostics.push(
        diagnostic(
          'reference.unknown-constraint',
          'Hard conflict references an unknown constraint.',
          path,
        ),
      );
    }
    if (!reasonSet.has(conflict.reasonCode)) {
      diagnostics.push(
        diagnostic(
          'reference.unknown-reason',
          'Hard conflict references an unknown reason.',
          path,
        ),
      );
    }
    const constraint = constraintsById.get(conflict.constraintId);
    if (
      constraint !== undefined &&
      constraint.reasonCode !== conflict.reasonCode
    ) {
      diagnostics.push(
        diagnostic(
          'reference.conflict-reason',
          'Hard conflict reason must match its referenced constraint.',
          path,
        ),
      );
    }
    validateEvidenceReferences(
      diagnostics,
      conflict.candidateId,
      conflict.evidenceIds,
      evidenceById,
      path,
    );
    const disposition = dispositionsByCandidate.get(conflict.candidateId);
    if (
      disposition !== undefined &&
      (!disposition.reasonCodes.includes(conflict.reasonCode) ||
        conflict.evidenceIds.some(
          (evidenceId) => !disposition.evidenceIds.includes(evidenceId),
        ))
    ) {
      diagnostics.push(
        diagnostic(
          'reference.conflict-disposition',
          'Hard conflict reason and evidence must be retained on the candidate disposition.',
          path,
        ),
      );
    }
    if (disposition !== undefined && disposition.disposition !== 'rejected') {
      diagnostics.push(
        diagnostic(
          'reference.conflict-disposition',
          'A candidate with a recorded hard-constraint conflict must be rejected.',
          path,
        ),
      );
    }
  }

  const conflictingCandidates = new Set(
    gold.hardConstraintConflicts.map((conflict) => conflict.candidateId),
  );
  for (const disposition of gold.dispositions) {
    if (
      conflictingCandidates.has(disposition.candidateId) &&
      (disposition.disposition === 'recommended' ||
        disposition.disposition === 'viable')
    ) {
      diagnostics.push(
        diagnostic(
          'reference.gold-safety',
          'Gold cannot recommend or mark viable a hard-conflicting candidate.',
          `gold.dispositions.${disposition.candidateId}`,
        ),
      );
    }
  }

  validateCatalogReferences(
    diagnostics,
    gold.requiredUnknownIds,
    unknownSet,
    'reference.unknown-unknown',
    'gold.requiredUnknownIds',
  );

  return finalize(diagnostics);
}

export function validatePrediction(
  caseDocument: EvaluationCase,
  evidence: EvidenceSet,
  prediction: Prediction,
): readonly ReferenceDiagnostic[] {
  const diagnostics: ReferenceDiagnostic[] = [];
  const candidateIds = caseDocument.candidates.map(
    (candidate) => candidate.candidateId,
  );
  const predictionIds = prediction.candidates.map(
    (candidate) => candidate.candidateId,
  );
  const candidateSet = new Set(candidateIds);
  const reasonSet = new Set(
    caseDocument.reasonCodes.map((reason) => reason.id),
  );
  const unknownSet = new Set(
    caseDocument.unknowns.map((unknown) => unknown.id),
  );
  const evidenceById = new Map(
    evidence.observations.map((observation) => [
      observation.evidenceId,
      observation,
    ]),
  );

  if (prediction.caseId !== caseDocument.caseId) {
    diagnostics.push(
      diagnostic(
        'reference.case-id',
        'Prediction case ID must match the case.',
        'prediction.caseId',
      ),
    );
  }
  reportDuplicates(diagnostics, predictionIds, 'prediction.candidates');
  if (!sameSet(candidateIds, predictionIds)) {
    diagnostics.push(
      diagnostic(
        'reference.candidate-set',
        'Prediction must contain exactly one disposition for every case candidate.',
        'prediction.candidates',
      ),
    );
  }
  validateDispositionReferences(
    diagnostics,
    prediction.candidates,
    candidateSet,
    reasonSet,
    evidenceById,
    'prediction.candidates',
  );
  validateCatalogReferences(
    diagnostics,
    prediction.disclosedUnknownIds,
    unknownSet,
    'reference.unknown-unknown',
    'prediction.disclosedUnknownIds',
  );
  validateOutcome(
    diagnostics,
    prediction.outcome,
    prediction.candidates,
    'prediction.outcome',
  );
  validateRanking(
    diagnostics,
    prediction.candidates,
    prediction.rankGroups,
    prediction.rankRelations,
    [],
    'prediction',
    false,
  );
  return finalize(diagnostics);
}

function validateEvidenceSubject(
  diagnostics: ReferenceDiagnostic[],
  observation: EvidenceObservation,
  candidates: ReadonlySet<string>,
): void {
  const path = `evidence.observations.${observation.evidenceId}`;
  if (observation.subjectType === 'candidate') {
    if (
      observation.candidateId === null ||
      !candidates.has(observation.candidateId)
    ) {
      diagnostics.push(
        diagnostic(
          'reference.unknown-candidate',
          'Candidate evidence must reference a supplied candidate.',
          path,
        ),
      );
    }
    if (observation.directness !== 'direct') {
      diagnostics.push(
        diagnostic(
          'reference.evidence-directness',
          'Candidate evidence must be classified as direct.',
          path,
        ),
      );
    }
  } else if (
    observation.candidateId !== null ||
    observation.directness !== 'case-local' ||
    observation.sourceType !== 'case-local-fact'
  ) {
    diagnostics.push(
      diagnostic(
        'reference.evidence-directness',
        'Case evidence must be null-subject case-local evidence.',
        path,
      ),
    );
  }
}

function validateEvidenceRevision(
  diagnostics: ReferenceDiagnostic[],
  observation: EvidenceObservation,
): void {
  const path = `evidence.observations.${observation.evidenceId}.sourceRevision`;
  const { kind, value, immutableUrl } = observation.sourceRevision;
  const allowedKinds: Record<
    EvidenceObservation['sourceType'],
    readonly EvidenceObservation['sourceRevision']['kind'][]
  > = {
    'official-documentation': [
      'git-commit',
      'tag',
      'release',
      'version',
      'mutable-documentation',
    ],
    'official-repository': ['git-commit', 'tag', 'release'],
    'official-release': ['tag', 'release'],
    'package-registry': ['version'],
    'security-advisory': ['release', 'version'],
    license: ['git-commit', 'tag', 'release'],
    'case-local-fact': ['case-version'],
  };
  if (!allowedKinds[observation.sourceType].includes(kind)) {
    diagnostics.push(
      diagnostic(
        'reference.evidence-revision-kind',
        'Evidence revision kind is not valid for the source type.',
        path,
      ),
    );
  }

  if (kind === 'git-commit') {
    const commitPattern = /^[a-f0-9]{40}$/u;
    const pinnedUrlPattern = new RegExp(
      `/(?:blob|tree|commit)/${escapeRegExp(value)}(?:/|$|#)`,
      'u',
    );
    if (
      !commitPattern.test(value) ||
      immutableUrl === null ||
      !pinnedUrlPattern.test(immutableUrl) ||
      observation.publishedAt === null
    ) {
      diagnostics.push(
        diagnostic(
          'reference.evidence-revision',
          'Git commit evidence requires a full SHA, matching immutable URL, and commit timestamp.',
          path,
        ),
      );
    }
  } else if (kind === 'mutable-documentation') {
    if (
      immutableUrl !== null ||
      !observation.limitation.toLowerCase().includes('mutable')
    ) {
      diagnostics.push(
        diagnostic(
          'reference.evidence-revision',
          'Mutable documentation requires a null immutable URL and an explicit mutable-source limitation.',
          path,
        ),
      );
    }
  } else if (kind === 'case-version') {
    if (
      immutableUrl !== null ||
      observation.publishedAt !== null ||
      observation.sourceType !== 'case-local-fact'
    ) {
      diagnostics.push(
        diagnostic(
          'reference.evidence-revision',
          'Case-version evidence is local, unlinked, and has no publication timestamp.',
          path,
        ),
      );
    }
  } else if (immutableUrl === null) {
    diagnostics.push(
      diagnostic(
        'reference.evidence-revision',
        'Versioned, tagged, or released evidence requires an immutable locator.',
        path,
      ),
    );
  } else {
    const mutableAliasPattern =
      /^(?:canary|current|head|latest|main|master|next|stable)$/iu;
    if (
      mutableAliasPattern.test(value) ||
      !hasExactRevisionLocator(immutableUrl, value)
    ) {
      diagnostics.push(
        diagnostic(
          'reference.evidence-revision',
          'Versioned, tagged, or released evidence requires an exact non-mutable value present in its immutable locator.',
          path,
        ),
      );
    }
  }
}

function hasExactRevisionLocator(
  immutableUrl: string,
  revision: string,
): boolean {
  return [revision, encodeURIComponent(revision)].some((candidate) => {
    const escaped = escapeRegExp(candidate);
    return new RegExp(`(?:^|[/=?#&@])${escaped}(?:$|[/#?&])`, 'u').test(
      immutableUrl,
    );
  });
}

function validateEvidenceCutoff(
  diagnostics: ReferenceDiagnostic[],
  observation: EvidenceObservation,
  evidenceCutoff: string,
): void {
  const path = `evidence.observations.${observation.evidenceId}`;
  if (
    observation.collectedAt.slice(0, 10) > evidenceCutoff ||
    (observation.publishedAt !== null &&
      observation.publishedAt.slice(0, 10) > evidenceCutoff)
  ) {
    diagnostics.push(
      diagnostic(
        'reference.evidence-cutoff',
        'Evidence collection and publication dates must not be after the case cutoff.',
        path,
      ),
    );
  }
  if (
    observation.publishedAt !== null &&
    observation.publishedAt > observation.collectedAt
  ) {
    diagnostics.push(
      diagnostic(
        'reference.evidence-chronology',
        'Evidence publication time must not be after its collection time.',
        path,
      ),
    );
  }
}

function validateDispositionReferences(
  diagnostics: ReferenceDiagnostic[],
  dispositions: readonly CandidateDisposition[],
  candidates: ReadonlySet<string>,
  reasons: ReadonlySet<string>,
  evidenceById: ReadonlyMap<string, EvidenceObservation>,
  pathPrefix: string,
): void {
  for (const disposition of dispositions) {
    const path = `${pathPrefix}.${disposition.candidateId}`;
    if (!candidates.has(disposition.candidateId)) {
      diagnostics.push(
        diagnostic(
          'reference.unknown-candidate',
          'Disposition references an unknown candidate.',
          path,
        ),
      );
    }
    validateCatalogReferences(
      diagnostics,
      disposition.reasonCodes,
      reasons,
      'reference.unknown-reason',
      `${path}.reasonCodes`,
    );
    validateEvidenceReferences(
      diagnostics,
      disposition.candidateId,
      disposition.evidenceIds,
      evidenceById,
      `${path}.evidenceIds`,
    );
  }
}

function validateEvidenceReferences(
  diagnostics: ReferenceDiagnostic[],
  candidateId: string,
  evidenceIds: readonly string[],
  evidenceById: ReadonlyMap<string, EvidenceObservation>,
  path: string,
): void {
  for (const evidenceId of evidenceIds) {
    const observation = evidenceById.get(evidenceId);
    if (observation === undefined) {
      diagnostics.push(
        diagnostic(
          'reference.unknown-evidence',
          'Evidence reference is not available to the case.',
          path,
        ),
      );
    } else if (
      observation.subjectType === 'candidate' &&
      observation.candidateId !== candidateId
    ) {
      diagnostics.push(
        diagnostic(
          'reference.unrelated-evidence',
          'Candidate claim references evidence for another candidate.',
          path,
        ),
      );
    }
  }
}

function validateOutcome(
  diagnostics: ReferenceDiagnostic[],
  outcome: Outcome,
  dispositions: readonly CandidateDisposition[],
  path: string,
): void {
  const viable = dispositions.filter(
    (disposition) =>
      disposition.disposition === 'recommended' ||
      disposition.disposition === 'viable',
  ).length;
  const rejected = dispositions.filter(
    (disposition) => disposition.disposition === 'rejected',
  ).length;
  const insufficientEvidence = dispositions.filter(
    (disposition) => disposition.disposition === 'insufficient-evidence',
  ).length;
  const valid =
    outcome === 'recommend'
      ? viable > 0
      : outcome === 'no-viable-candidate'
        ? rejected === dispositions.length
        : viable === 0 && insufficientEvidence > 0;
  if (!valid) {
    diagnostics.push(
      diagnostic(
        'reference.outcome',
        'Responsible outcome contradicts the candidate dispositions.',
        path,
      ),
    );
  }
}

function validateRanking(
  diagnostics: ReferenceDiagnostic[],
  dispositions: readonly CandidateDisposition[],
  rankGroups: readonly (readonly string[])[],
  rankRelations: readonly RankRelation[],
  incomparablePairs: readonly (readonly string[])[],
  pathPrefix: string,
  requireCoverage: boolean,
): void {
  const viableCandidates = new Set(
    dispositions
      .filter(
        (disposition) =>
          disposition.disposition === 'recommended' ||
          disposition.disposition === 'viable',
      )
      .map((disposition) => disposition.candidateId),
  );
  const groupedCandidates: string[] = [];
  for (const group of rankGroups) {
    groupedCandidates.push(...group);
  }
  const rankedCandidates = new Set(groupedCandidates);
  for (const relation of rankRelations) {
    rankedCandidates.add(relation.higherCandidateId);
    rankedCandidates.add(relation.lowerCandidateId);
  }
  for (const candidateId of rankedCandidates) {
    if (!viableCandidates.has(candidateId)) {
      diagnostics.push(
        diagnostic(
          'reference.rank-candidate',
          'Only recommended or viable candidates may be ranked.',
          `${pathPrefix}.rankGroups`,
        ),
      );
    }
  }
  reportDuplicates(
    diagnostics,
    groupedCandidates,
    `${pathPrefix}.rankGroups`,
    true,
  );
  const directedEdges: (readonly [string, string])[] = [];
  const tieKeys = new Set<string>();
  const tiePairs: (readonly [string, string])[] = [];
  const tiedMembersByCandidate = new Map<string, readonly string[]>();
  for (let higherIndex = 0; higherIndex < rankGroups.length; higherIndex += 1) {
    const higherGroup = rankGroups[higherIndex] ?? [];
    for (const candidateId of higherGroup) {
      tiedMembersByCandidate.set(candidateId, higherGroup);
    }
    for (let leftIndex = 0; leftIndex < higherGroup.length; leftIndex += 1) {
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < higherGroup.length;
        rightIndex += 1
      ) {
        const tiePair = [
          higherGroup[leftIndex] ?? '',
          higherGroup[rightIndex] ?? '',
        ] as const;
        tieKeys.add(pairKey(...tiePair));
        tiePairs.push(tiePair);
      }
    }
    for (
      let lowerIndex = higherIndex + 1;
      lowerIndex < rankGroups.length;
      lowerIndex += 1
    ) {
      const lowerGroup = rankGroups[lowerIndex] ?? [];
      for (const higher of higherGroup) {
        for (const lower of lowerGroup) {
          directedEdges.push([higher, lower]);
        }
      }
    }
  }
  for (const relation of rankRelations) {
    const higherMembers = tiedMembersByCandidate.get(
      relation.higherCandidateId,
    ) ?? [relation.higherCandidateId];
    const lowerMembers = tiedMembersByCandidate.get(
      relation.lowerCandidateId,
    ) ?? [relation.lowerCandidateId];
    for (const higher of higherMembers) {
      for (const lower of lowerMembers) {
        directedEdges.push([higher, lower]);
      }
    }
  }
  const edgeKeys = directedEdges.map(
    ([higher, lower]) => `${higher}\0${lower}`,
  );
  reportDuplicates(diagnostics, edgeKeys, `${pathPrefix}.rankRelations`, true);
  if (
    tiePairs.some(
      ([left, right]) =>
        hasDirectedPath(directedEdges, left, right) ||
        hasDirectedPath(directedEdges, right, left),
    )
  ) {
    diagnostics.push(
      diagnostic(
        'reference.rank-contradiction',
        'A pair cannot be both tied and ordered.',
        `${pathPrefix}.rankRelations`,
      ),
    );
  }
  if (hasDirectedCycle(directedEdges)) {
    diagnostics.push(
      diagnostic(
        'reference.rank-cycle',
        'Ranking relations must not contain a directed cycle.',
        `${pathPrefix}.rankRelations`,
      ),
    );
  }

  const incomparableKeys: string[] = [];
  const coveredCandidates = new Set(rankedCandidates);
  for (const pair of incomparablePairs) {
    const [left, right] = pair;
    if (
      left === undefined ||
      right === undefined ||
      !viableCandidates.has(left) ||
      !viableCandidates.has(right)
    ) {
      diagnostics.push(
        diagnostic(
          'reference.rank-candidate',
          'Incomparable pairs must contain supplied viable candidates.',
          `${pathPrefix}.incomparablePairs`,
        ),
      );
      continue;
    }
    coveredCandidates.add(left);
    coveredCandidates.add(right);
    const key = pairKey(left, right);
    incomparableKeys.push(key);
    if (tieKeys.has(key)) {
      diagnostics.push(
        diagnostic(
          'reference.rank-contradiction',
          'A pair cannot be both tied and incomparable.',
          `${pathPrefix}.incomparablePairs`,
        ),
      );
    }
    if (
      hasDirectedPath(directedEdges, left, right) ||
      hasDirectedPath(directedEdges, right, left)
    ) {
      diagnostics.push(
        diagnostic(
          'reference.rank-contradiction',
          'A pair cannot be both ordered and incomparable.',
          `${pathPrefix}.incomparablePairs`,
        ),
      );
    }
  }
  reportDuplicates(
    diagnostics,
    incomparableKeys,
    `${pathPrefix}.incomparablePairs`,
  );
  if (
    requireCoverage &&
    !sameSet([...viableCandidates], [...coveredCandidates])
  ) {
    diagnostics.push(
      diagnostic(
        'reference.rank-set',
        'Gold must classify every recommended or viable candidate in its partial order.',
        `${pathPrefix}.rankGroups`,
      ),
    );
  }
}

function hasDirectedPath(
  edges: readonly (readonly [string, string])[],
  source: string,
  target: string,
): boolean {
  const adjacency = new Map<string, Set<string>>();
  for (const [higher, lower] of edges) {
    const targets = adjacency.get(higher) ?? new Set<string>();
    targets.add(lower);
    adjacency.set(higher, targets);
  }
  const pending = [source];
  const visited = new Set<string>();
  while (pending.length > 0) {
    const candidate = pending.pop();
    if (candidate === undefined || visited.has(candidate)) {
      continue;
    }
    visited.add(candidate);
    for (const next of adjacency.get(candidate) ?? []) {
      if (next === target) {
        return true;
      }
      pending.push(next);
    }
  }
  return false;
}

function hasDirectedCycle(
  edges: readonly (readonly [string, string])[],
): boolean {
  const adjacency = new Map<string, Set<string>>();
  for (const [higher, lower] of edges) {
    const targets = adjacency.get(higher) ?? new Set<string>();
    targets.add(lower);
    adjacency.set(higher, targets);
    if (!adjacency.has(lower)) {
      adjacency.set(lower, new Set());
    }
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (node: string): boolean => {
    if (visiting.has(node)) {
      return true;
    }
    if (visited.has(node)) {
      return false;
    }
    visiting.add(node);
    for (const target of adjacency.get(node) ?? []) {
      if (visit(target)) {
        return true;
      }
    }
    visiting.delete(node);
    visited.add(node);
    return false;
  };
  return [...adjacency.keys()].some((node) => visit(node));
}

function validateCatalogReferences(
  diagnostics: ReferenceDiagnostic[],
  references: readonly string[],
  catalog: ReadonlySet<string>,
  code: string,
  path: string,
): void {
  for (const reference of references) {
    if (!catalog.has(reference)) {
      diagnostics.push(
        diagnostic(code, 'Reference is not in the case catalog.', path),
      );
    }
  }
}

function reportDuplicates(
  diagnostics: ReferenceDiagnostic[],
  values: readonly string[],
  path: string,
  rankDuplicate = false,
): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      diagnostics.push(
        diagnostic(
          rankDuplicate ? 'reference.duplicate-rank' : 'reference.duplicate-id',
          rankDuplicate
            ? 'Candidate appears more than once in the ranking.'
            : 'Stable IDs must be unique within their catalog.',
          path,
        ),
      );
      return;
    }
    seen.add(value);
  }
}

function sameSet(left: readonly string[], right: readonly string[]): boolean {
  return (
    new Set(left).size === new Set(right).size &&
    left.every((value) => right.includes(value))
  );
}

function isSorted(values: readonly string[]): boolean {
  return values.every(
    (value, index) => index === 0 || (values[index - 1] ?? '') < value,
  );
}

function pairKey(left: string, right: string): string {
  return left < right ? `${left}\0${right}` : `${right}\0${left}`;
}

function escapeRegExp(value: string): string {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function diagnostic(
  code: string,
  message: string,
  path: string,
): ReferenceDiagnostic {
  return { code, message, path };
}

function finalize(
  diagnostics: readonly ReferenceDiagnostic[],
): readonly ReferenceDiagnostic[] {
  return [...diagnostics]
    .sort((left, right) =>
      compareText(
        `${left.path}\0${left.code}\0${left.message}`,
        `${right.path}\0${right.code}\0${right.message}`,
      ),
    )
    .slice(0, MAXIMUM_DIAGNOSTICS);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
