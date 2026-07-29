import {
  addIssue,
  addStableIdIssues,
  type DomainIssue,
  type DomainIssueCode,
} from './issues.ts';
import type {
  CandidateId,
  EvidenceId,
  EvidenceObservation,
  EvidenceReference,
  StableId,
  StableIdKind,
} from './model.ts';

export function addDuplicateIdIssues<Kind extends StableIdKind>(
  issues: DomainIssue[],
  values: readonly StableId<Kind>[],
  path: string,
): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      addIssue(issues, 'reference.duplicate-id', path);
    }
    seen.add(value);
  }
}

export function addDuplicateTextIssues(
  issues: DomainIssue[],
  values: readonly string[],
  path: string,
): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      addIssue(issues, 'reference.duplicate-reference', path);
    }
    seen.add(value);
  }
}

export function addEvidenceReferenceIssues(
  issues: DomainIssue[],
  references: readonly EvidenceReference[],
  evidenceById: ReadonlyMap<EvidenceId, EvidenceObservation>,
  expectedCandidateId: CandidateId | undefined,
  path: string,
): void {
  const referenceKeys: string[] = [];
  for (const reference of references) {
    addStableIdIssues(issues, reference.candidateId, `${path}.candidateId`);
    addStableIdIssues(issues, reference.evidenceId, `${path}.evidenceId`);
    referenceKeys.push(`${reference.candidateId}\u0000${reference.evidenceId}`);
    if (
      expectedCandidateId !== undefined &&
      reference.candidateId !== expectedCandidateId
    ) {
      addIssue(issues, 'reference.candidate-ownership', path);
    }
    const evidence = evidenceById.get(reference.evidenceId);
    if (evidence === undefined) {
      addIssue(issues, 'reference.unknown-evidence', path);
    } else if (evidence.candidateId !== reference.candidateId) {
      addIssue(issues, 'reference.candidate-ownership', path);
    }
  }
  addDuplicateTextIssues(issues, referenceKeys, path);
}

export function addOwnedReferenceIssues<
  Kind extends StableIdKind,
  Value extends { readonly candidateId: CandidateId },
>(
  issues: DomainIssue[],
  references: readonly StableId<Kind>[],
  catalog: ReadonlyMap<StableId<Kind>, Value>,
  candidateId: CandidateId,
  unknownCode: DomainIssueCode,
  path: string,
): void {
  addDuplicateIdIssues(issues, references, path);
  for (const reference of references) {
    addStableIdIssues(issues, reference, path);
    const value = catalog.get(reference);
    if (value === undefined) {
      addIssue(issues, unknownCode, path);
    } else if (value.candidateId !== candidateId) {
      addIssue(issues, 'reference.candidate-ownership', path);
    }
  }
}

export function sameUniqueSet(
  left: readonly string[],
  right: readonly string[],
): boolean {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  return (
    leftSet.size === left.length &&
    rightSet.size === right.length &&
    leftSet.size === rightSet.size &&
    [...leftSet].every((value) => rightSet.has(value))
  );
}
