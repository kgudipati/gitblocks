import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';

import type {
  RankingBaselineSpecificationAuthority,
  RankingBlindCaseAuthority,
  RankingBlindStrategyInput,
  RankingEvidenceAuthority,
  RankingHandoffAuthority,
  RankingResolvedCase,
} from './contracts.ts';
import {
  compareRankingText,
  rankingDigest,
  rankingSemanticDigest,
  rankingValuesDiffer,
} from './stable-json.ts';

export interface RankingBlindInputSet {
  readonly corpusId: 'ranking-v1';
  readonly corpusVersion: '1.0.0';
  readonly blindInputDigest: string;
  readonly cases: readonly RankingResolvedCase[];
  readonly specifications: RankingBaselineSpecificationAuthority;
}

/**
 * This loader is the only authority entrypoint used by ordinary baseline
 * generation. It cannot read gold, audit classifications, review records,
 * score reports, gate inputs, or thresholds.
 */
export function loadRankingBlindInputSet(
  repositoryRoot: string,
  order: 'forward' | 'reverse' = 'forward',
): RankingBlindInputSet {
  const root = join(repositoryRoot, 'evals/ranking-v1');
  const blind = readJson(root, 'blind/cases.json') as RankingBlindCaseAuthority;
  const evidence = readJson(
    root,
    'evidence/candidate-evidence.json',
  ) as RankingEvidenceAuthority;
  const handoff = readJson(
    root,
    'handoff/phase9-lanes.json',
  ) as RankingHandoffAuthority;
  const specifications = readJson(
    root,
    'baselines/specifications.json',
  ) as RankingBaselineSpecificationAuthority;
  if (
    rankingValuesDiffer(
      blind.authorityVersion,
      'ranking-v1-blind-cases/1.0.0',
    ) ||
    rankingValuesDiffer(
      evidence.authorityVersion,
      'ranking-v1-candidate-evidence/1.0.0',
    ) ||
    rankingValuesDiffer(
      handoff.authorityVersion,
      'ranking-v1-phase9-handoff/1.0.0',
    ) ||
    rankingValuesDiffer(
      specifications.authorityVersion,
      'ranking-v1-baseline-specifications/1.0.0',
    ) ||
    rankingSemanticDigest(specifications) !== specifications.semanticDigest ||
    specifications.specifications.some((specification) => {
      const semantic = { ...specification } as Record<string, unknown>;
      delete semantic['specificationDigest'];
      return rankingDigest(semantic) !== specification.specificationDigest;
    })
  ) {
    throw new Error('Ranking blind authority version is inconsistent.');
  }
  const requests = new Map(
    blind.requests.map((item) => [item.requestAuthorityId, item]),
  );
  const criteria = new Map(
    blind.criterionAuthorities.map((item) => [item.criterionAuthorityId, item]),
  );
  const targets = new Map(
    blind.targets.map((item) => [item.targetAuthorityId, item]),
  );
  const candidateSets = new Map(
    blind.candidateSets.map((item) => [item.candidateSetId, item]),
  );
  const evidenceSets = new Map(
    evidence.evidenceSets.map((item) => [item.evidenceSetId, item]),
  );
  const handoffSets = new Map(
    handoff.handoffSets.map((item) => [item.handoffAuthorityId, item]),
  );
  const cases = blind.cases.map((binding): RankingResolvedCase => {
    const request = requests.get(binding.requestAuthorityId);
    const criterion = criteria.get(binding.criterionAuthorityId);
    const target = targets.get(binding.targetAuthorityId);
    const candidateSet = candidateSets.get(binding.candidateSetId);
    const evidenceSet = evidenceSets.get(binding.evidenceSetId);
    const handoffSet = handoffSets.get(binding.handoffAuthorityId);
    if (
      request === undefined ||
      criterion === undefined ||
      target === undefined ||
      candidateSet === undefined ||
      evidenceSet === undefined ||
      handoffSet === undefined
    ) {
      throw new Error('Ranking blind authority reference is unresolved.');
    }
    return {
      binding,
      request,
      criteria: criterion,
      target,
      candidateSet,
      evidence: evidenceSet,
      handoff: handoffSet,
    };
  });
  cases.sort((left, right) =>
    compareRankingText(left.binding.caseId, right.binding.caseId),
  );
  if (order === 'reverse') cases.reverse();
  return {
    corpusId: 'ranking-v1',
    corpusVersion: '1.0.0',
    blindInputDigest: rankingDigest({ blind, evidence, handoff }),
    cases,
    specifications,
  };
}

export function createRankingStrategyInput(
  resolved: RankingResolvedCase,
  includeTarget: boolean,
  includeEvidence: boolean,
): RankingBlindStrategyInput {
  const input: RankingBlindStrategyInput = {
    capabilityFamily: resolved.binding.capabilityFamily,
    request: resolved.request,
    criteria: resolved.criteria,
    target: includeTarget ? resolved.target : null,
    candidates: [...resolved.candidateSet.candidates].sort((left, right) =>
      compareRankingText(left.candidateId, right.candidateId),
    ),
    candidateEvidence: includeEvidence
      ? [...resolved.evidence.candidates].sort((left, right) =>
          compareRankingText(left.candidateId, right.candidateId),
        )
      : [],
    handoffCandidates: [...resolved.handoff.candidates].sort(
      (left, right) => left.retrievalOrder - right.retrievalOrder,
    ),
    requestedMaximumResults: resolved.binding.requestedMaximumResults,
  };
  assertRankingStrategyInput(input);
  return input;
}

export function assertRankingStrategyInput(
  input: RankingBlindStrategyInput,
): void {
  const forbidden = new Set([
    'auditLabels',
    'caseId',
    'controlledPairDirections',
    'disposition',
    'gold',
    'outcome',
    'primaryClass',
    'rationaleNotes',
    'reviewStatus',
    'threshold',
    'winner',
  ]);
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (typeof value !== 'object' || value === null) return;
    for (const [key, child] of Object.entries(value)) {
      if (forbidden.has(key)) {
        throw new Error('Ranking baseline received a prohibited field.');
      }
      visit(child);
    }
  };
  visit(input);
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
    throw new Error('Unsafe blind authority file.');
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}
