import type { CandidateId, FitAssessmentResult } from './model.ts';
import {
  addIssue,
  addStableIdIssues,
  compareText,
  type DomainIssue,
} from './issues.ts';

type DirectedEdge = readonly [CandidateId, CandidateId];

function directedKey(higher: CandidateId, lower: CandidateId): string {
  return `${higher}\u0000${lower}`;
}

function pairKey(left: CandidateId, right: CandidateId): string {
  return compareText(left, right) <= 0
    ? `${left}\u0000${right}`
    : `${right}\u0000${left}`;
}

function addRankCandidateIssue(
  issues: DomainIssue[],
  candidateId: CandidateId,
  viableCandidates: ReadonlySet<CandidateId>,
  path: string,
): boolean {
  addStableIdIssues(issues, candidateId, path);
  if (!viableCandidates.has(candidateId)) {
    addIssue(issues, 'ranking.candidate', path);
    return false;
  }
  return true;
}

function adjacencyFor(
  edges: readonly DirectedEdge[],
): ReadonlyMap<CandidateId, ReadonlySet<CandidateId>> {
  const adjacency = new Map<CandidateId, Set<CandidateId>>();
  for (const [higher, lower] of edges) {
    const targets = adjacency.get(higher) ?? new Set<CandidateId>();
    targets.add(lower);
    adjacency.set(higher, targets);
    if (!adjacency.has(lower)) {
      adjacency.set(lower, new Set<CandidateId>());
    }
  }
  return adjacency;
}

function hasDirectedPath(
  adjacency: ReadonlyMap<CandidateId, ReadonlySet<CandidateId>>,
  source: CandidateId,
  target: CandidateId,
): boolean {
  const pending = [source];
  const visited = new Set<CandidateId>();
  while (pending.length > 0) {
    const current = pending.pop();
    if (current === undefined || visited.has(current)) {
      continue;
    }
    visited.add(current);
    for (const next of adjacency.get(current) ?? []) {
      if (next === target) {
        return true;
      }
      pending.push(next);
    }
  }
  return false;
}

function hasDirectedCycle(
  adjacency: ReadonlyMap<CandidateId, ReadonlySet<CandidateId>>,
): boolean {
  const visiting = new Set<CandidateId>();
  const visited = new Set<CandidateId>();

  const visit = (candidateId: CandidateId): boolean => {
    if (visiting.has(candidateId)) {
      return true;
    }
    if (visited.has(candidateId)) {
      return false;
    }
    visiting.add(candidateId);
    for (const lower of adjacency.get(candidateId) ?? []) {
      if (visit(lower)) {
        return true;
      }
    }
    visiting.delete(candidateId);
    visited.add(candidateId);
    return false;
  };

  return [...adjacency.keys()].some((candidateId) => visit(candidateId));
}

export function addRankingIssues(
  issues: DomainIssue[],
  result: FitAssessmentResult,
): void {
  const viableCandidates = new Set(
    result.assessments
      .filter(
        (assessment) =>
          assessment.disposition === 'recommended' ||
          assessment.disposition === 'viable',
      )
      .map((assessment) => assessment.candidateId),
  );
  let candidatesValid = true;
  const rankedCandidates = new Set<CandidateId>();
  for (const [index, group] of result.rankGroups.entries()) {
    const path = `rankGroups[${String(index)}].candidateIds`;
    for (const candidateId of group.candidateIds) {
      rankedCandidates.add(candidateId);
      candidatesValid =
        addRankCandidateIssue(issues, candidateId, viableCandidates, path) &&
        candidatesValid;
    }
  }
  for (const relation of result.rankRelations) {
    rankedCandidates.add(relation.higherCandidateId);
    rankedCandidates.add(relation.lowerCandidateId);
    candidatesValid =
      addRankCandidateIssue(
        issues,
        relation.higherCandidateId,
        viableCandidates,
        'rankRelations',
      ) && candidatesValid;
    candidatesValid =
      addRankCandidateIssue(
        issues,
        relation.lowerCandidateId,
        viableCandidates,
        'rankRelations',
      ) && candidatesValid;
  }
  for (const pair of result.incomparablePairs) {
    rankedCandidates.add(pair.leftCandidateId);
    rankedCandidates.add(pair.rightCandidateId);
    candidatesValid =
      addRankCandidateIssue(
        issues,
        pair.leftCandidateId,
        viableCandidates,
        'incomparablePairs',
      ) && candidatesValid;
    candidatesValid =
      addRankCandidateIssue(
        issues,
        pair.rightCandidateId,
        viableCandidates,
        'incomparablePairs',
      ) && candidatesValid;
  }
  if (
    !candidatesValid ||
    rankedCandidates.size > result.suppliedCandidateIds.length
  ) {
    return;
  }

  const groupMembersByCandidate = new Map<
    CandidateId,
    readonly CandidateId[]
  >();
  const groupMembership = new Set<CandidateId>();
  const tieKeys = new Set<string>();
  const tiePairs: DirectedEdge[] = [];
  const edges: DirectedEdge[] = [];

  for (
    let higherGroupIndex = 0;
    higherGroupIndex < result.rankGroups.length;
    higherGroupIndex += 1
  ) {
    const higherGroup = result.rankGroups[higherGroupIndex];
    if (higherGroup === undefined) {
      continue;
    }
    const groupPath = `rankGroups[${String(higherGroupIndex)}].candidateIds`;
    if (higherGroup.candidateIds.length === 0) {
      addIssue(issues, 'ranking.empty-group', groupPath);
    }
    for (const candidate of higherGroup.candidateIds) {
      if (groupMembership.has(candidate)) {
        addIssue(issues, 'ranking.duplicate-membership', 'rankGroups');
      }
      groupMembership.add(candidate);
      groupMembersByCandidate.set(candidate, higherGroup.candidateIds);
    }
    for (
      let leftIndex = 0;
      leftIndex < higherGroup.candidateIds.length;
      leftIndex += 1
    ) {
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < higherGroup.candidateIds.length;
        rightIndex += 1
      ) {
        const left = higherGroup.candidateIds[leftIndex];
        const right = higherGroup.candidateIds[rightIndex];
        if (left === undefined || right === undefined) {
          continue;
        }
        tieKeys.add(pairKey(left, right));
        tiePairs.push([left, right]);
      }
    }
    for (
      let lowerGroupIndex = higherGroupIndex + 1;
      lowerGroupIndex < result.rankGroups.length;
      lowerGroupIndex += 1
    ) {
      const lowerGroup = result.rankGroups[lowerGroupIndex];
      if (lowerGroup === undefined) {
        continue;
      }
      for (const higher of higherGroup.candidateIds) {
        for (const lower of lowerGroup.candidateIds) {
          edges.push([higher, lower]);
        }
      }
    }
  }

  const declaredRelations = new Set<string>();
  for (const relation of result.rankRelations) {
    const declarationKey = directedKey(
      relation.higherCandidateId,
      relation.lowerCandidateId,
    );
    if (declaredRelations.has(declarationKey)) {
      addIssue(issues, 'ranking.duplicate-relation', 'rankRelations');
    }
    declaredRelations.add(declarationKey);
    const higherMembers = groupMembersByCandidate.get(
      relation.higherCandidateId,
    ) ?? [relation.higherCandidateId];
    const lowerMembers = groupMembersByCandidate.get(
      relation.lowerCandidateId,
    ) ?? [relation.lowerCandidateId];
    for (const higher of higherMembers) {
      for (const lower of lowerMembers) {
        edges.push([higher, lower]);
      }
    }
  }

  const adjacency = adjacencyFor(edges);
  if (
    tiePairs.some(
      ([left, right]) =>
        hasDirectedPath(adjacency, left, right) ||
        hasDirectedPath(adjacency, right, left),
    )
  ) {
    addIssue(issues, 'ranking.contradiction', 'rankRelations');
  }
  if (hasDirectedCycle(adjacency)) {
    addIssue(issues, 'ranking.cycle', 'rankRelations');
  }

  const incomparableDeclarations = new Set<string>();
  for (const pair of result.incomparablePairs) {
    const key = pairKey(pair.leftCandidateId, pair.rightCandidateId);
    if (incomparableDeclarations.has(key)) {
      addIssue(issues, 'ranking.duplicate-relation', 'incomparablePairs');
    }
    incomparableDeclarations.add(key);
    if (
      pair.leftCandidateId === pair.rightCandidateId ||
      tieKeys.has(key) ||
      hasDirectedPath(adjacency, pair.leftCandidateId, pair.rightCandidateId) ||
      hasDirectedPath(adjacency, pair.rightCandidateId, pair.leftCandidateId)
    ) {
      addIssue(issues, 'ranking.contradiction', 'incomparablePairs');
    }
  }
}
