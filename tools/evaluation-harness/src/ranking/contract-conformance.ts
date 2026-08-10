import { createHash } from 'node:crypto';

import {
  validateFitAssessmentExchangeV1,
  type ContractIssue,
} from '@gitblocks/contracts';

import type { RankingGoldCase, RankingResolvedCase } from './contracts.ts';
import { loadRankingCorpus } from './corpus.ts';
import { compareRankingText } from './stable-json.ts';

export interface RankingContractConformanceSummary {
  readonly caseCount: 30;
  readonly candidateCount: 120;
  readonly productContractVersion: '1.0.0';
  readonly goldStatus: 'proposed';
  readonly independentReviewStatus: 'not-reviewed';
  readonly purpose: 'representability-and-mapping-completeness-only';
  readonly criterionBindingProductSchemaAdded: false;
}

export type RankingContractConformanceResult =
  | {
      readonly ok: true;
      readonly summary: RankingContractConformanceSummary;
      readonly diagnostics: readonly [];
    }
  | {
      readonly ok: false;
      readonly diagnostics: readonly {
        readonly code: string;
        readonly path: string;
        readonly message: string;
      }[];
    };

interface ConformanceProvenance {
  readonly origin: 'supplied-declaration';
  readonly epistemicStatus: 'declared';
  readonly confidence: 'unknown';
  readonly observedAt: string;
}

export function validateRankingContractConformance(
  repositoryRoot: string,
): RankingContractConformanceResult {
  const loaded = loadRankingCorpus(repositoryRoot);
  if (!loaded.ok) return { ok: false, diagnostics: loaded.diagnostics };
  const goldByCase = new Map(
    loaded.corpus.gold.cases.map((gold) => [gold.caseId, gold]),
  );
  const diagnostics: { code: string; path: string; message: string }[] = [];
  for (const resolved of loaded.cases) {
    const gold = goldByCase.get(resolved.binding.caseId);
    if (gold === undefined) {
      diagnostics.push(
        diagnostic('ranking.contracts.gold', resolved.binding.caseId),
      );
      continue;
    }
    try {
      const mapped = mapRankingCase(resolved, gold);
      const result = validateFitAssessmentExchangeV1(
        mapped.request,
        mapped.response,
      );
      if (!result.ok) {
        diagnostics.push(
          ...result.issues.map((issue) =>
            contractDiagnostic(resolved.binding.caseId, issue),
          ),
        );
      }
    } catch {
      diagnostics.push(
        diagnostic('ranking.contracts.mapping', resolved.binding.caseId),
      );
    }
  }
  diagnostics.sort((left, right) =>
    compareRankingText(
      `${left.path}\0${left.code}`,
      `${right.path}\0${right.code}`,
    ),
  );
  if (diagnostics.length > 0) {
    return { ok: false, diagnostics: diagnostics.slice(0, 500) };
  }
  return {
    ok: true,
    summary: {
      caseCount: 30,
      candidateCount: 120,
      productContractVersion: '1.0.0',
      goldStatus: 'proposed',
      independentReviewStatus: 'not-reviewed',
      purpose: 'representability-and-mapping-completeness-only',
      criterionBindingProductSchemaAdded: false,
    },
    diagnostics: [],
  };
}

function mapRankingCase(resolved: RankingResolvedCase, gold: RankingGoldCase) {
  const timestamp = `${resolved.binding.evidenceCutoff}T23:59:59Z`;
  const evidenceId = (value: string) => shortId('rv1-e', value);
  const unknownId = (value: string) => shortId('rv1-u', value);
  const claimId = (value: string) => shortId('rv1-c', value);
  const conflictId = (candidateId: string, constraintId: string) =>
    shortId('rv1-h', `${candidateId}\0${constraintId}`);
  const observations = resolved.evidence.candidates.flatMap((candidate) =>
    candidate.observations.map((observation) => ({
      kind: 'evidence' as const,
      evidenceId: evidenceId(observation.evidenceId),
      candidateId: observation.candidateId,
      topic: stableToken(observation.featureId),
      dimension: 'integration' as const,
      observation: `The bounded evaluation fixture records ${observation.featureId} with state ${observation.state} and values ${observation.values.join(', ') || 'none'}.`,
      source: {
        kind: 'approved-validation' as const,
        sourceType: 'approved-validation' as const,
        validationReferenceId: evidenceId(observation.evidenceId),
        scope: stableToken(observation.featureId),
        validatedAt: timestamp,
      },
      freshness: {
        status: 'unknown' as const,
        asOf: timestamp,
        scope: 'Ranking-v1 evaluation-owned fixture at the declared cutoff.',
      },
      directness: 'direct' as const,
      limitation: observation.limitation,
    })),
  );
  const observationsByCandidate = new Map(
    resolved.candidateSet.candidates.map(({ candidateId }) => [
      candidateId,
      observations.filter(
        (observation) => observation.candidateId === candidateId,
      ),
    ]),
  );
  const candidateDossiers = resolved.candidateSet.candidates.map(
    (candidate) => {
      const [owner, name] = candidate.repository.split('/');
      if (owner === undefined || name === undefined) {
        throw new Error('Candidate repository identity is invalid.');
      }
      return {
        contractVersion: '1.0.0' as const,
        identity: {
          candidateId: candidate.candidateId,
          displayName: candidate.displayName,
          repository: { host: 'github' as const, owner, name },
          package:
            candidate.packageName === null
              ? null
              : { registry: 'npm' as const, name: candidate.packageName },
        },
        capabilityFamily: resolved.binding.capabilityFamily,
        versionScope: null,
        observations: observationsByCandidate.get(candidate.candidateId) ?? [],
        limitations: [],
        unknowns: [],
      };
    },
  );
  const capabilityRequest = {
    contractVersion: '1.0.0' as const,
    requestId: resolved.request.requestAuthorityId,
    capabilityFamily: resolved.request.capabilityFamily,
    summary: resolved.request.summary,
    successConditions: resolved.request.successConditions.map((criterion) => ({
      conditionId: criterion.criterionId,
      statement: criterion.statement,
    })),
    hardConstraints: resolved.request.hardConstraints.map((criterion) => ({
      constraintId: criterion.criterionId,
      reasonCode: criterion.reasonCode,
      statement: criterion.statement,
    })),
    preferences: resolved.request.preferences.map((criterion) => ({
      preferenceId: criterion.criterionId,
      statement: criterion.statement,
    })),
    transmissionApproval: {
      approvalId: `${resolved.binding.caseId}-conformance-approval`,
      approvedAt: timestamp,
      approvedBy: 'request-originator' as const,
      scope: 'minimized-repository-facts' as const,
      approvedCategories: [
        ...([
          'bounded-evidence',
          'candidate-dossiers',
          'capability-request',
          'repository-fingerprint',
        ] as const),
      ],
    },
  };
  const target = resolved.target.facts;
  const provenance: ConformanceProvenance = {
    origin: 'supplied-declaration' as const,
    epistemicStatus: 'declared' as const,
    confidence: 'unknown' as const,
    observedAt: timestamp,
  };
  const repositoryFingerprint = {
    contractVersion: '1.0.0' as const,
    factVocabularyVersion: '1.0.0',
    fingerprintId: resolved.target.fingerprintId,
    facts: [
      component('runtime', target.runtime, resolved, provenance),
      component('framework', target.framework, resolved, provenance),
      component('package-manager', target.packageManager, resolved, provenance),
      component('database', target.database, resolved, provenance),
      component('orm', target.orm, resolved, provenance),
      {
        kind: 'deployment' as const,
        factId: `${resolved.binding.caseId}-deployment`,
        topology: target.deployment,
        workerCapability: target.workerCapability,
        replicas: target.replicas,
        region: target.region,
        provenance,
      },
      codedPresence(
        `${resolved.binding.caseId}-redis`,
        'repository-capability',
        'redis',
        target.redis,
        provenance,
      ),
      ...target.identity.flatMap((value) =>
        mappedIdentityFacts(resolved.binding.caseId, value, provenance),
      ),
      ...target.resources.flatMap((value) =>
        mappedResourceFacts(resolved.binding.caseId, value, provenance),
      ),
      ...target.dataPolicies.flatMap((value) =>
        mappedDataPolicyFacts(resolved.binding.caseId, value, provenance),
      ),
    ],
    withheldCategories: resolved.target.withheldCategories.flatMap(
      (category) =>
        category === 'data-policy' ? (['data-facts'] as const) : [],
    ),
  };
  const request = {
    contractVersion: '1.0.0' as const,
    assessmentRequestId: `${resolved.binding.caseId}-assessment-request`,
    capabilityRequest,
    repositoryFingerprint,
    candidates: candidateDossiers,
    evidenceCutoff: timestamp,
    requestedMaximumResults: resolved.binding.requestedMaximumResults,
    correlationId: `${resolved.binding.caseId}-correlation`,
  };
  const goldCandidates = new Map(
    gold.candidates.map((candidate) => [candidate.candidateId, candidate]),
  );
  const hardConflicts = gold.hardConstraintConflicts.map((conflict) => ({
    conflictId: conflictId(conflict.candidateId, conflict.constraintId),
    candidateId: conflict.candidateId,
    constraintId: conflict.constraintId,
    reasonCode: conflict.reasonCode,
    evidenceIds: conflict.evidenceIds.map(evidenceId),
  }));
  const materialUnknowns = gold.requiredUnknowns.map((unknown) => ({
    scope: 'assessment' as const,
    unknownId: unknownId(unknown.unknownId),
    topic: shortId('rv1-ut', unknown.unknownId),
    statement:
      'Material target-conditioned adoption-fit authority remains unknown.',
    evidenceIds: [],
  }));
  const candidateAssessments = resolved.candidateSet.candidates.map(
    (candidate) => {
      const candidateGold = goldCandidates.get(candidate.candidateId);
      if (candidateGold === undefined)
        throw new Error('Gold candidate missing.');
      const candidateConflicts = hardConflicts.filter(
        (conflict) => conflict.candidateId === candidate.candidateId,
      );
      return {
        candidateId: candidate.candidateId,
        disposition: candidateGold.disposition,
        reasons: candidateGold.reasonCodes.map((reasonCode) => ({
          candidateId: candidate.candidateId,
          reasonCode,
          statement: `The proposed evaluation disposition records ${reasonCode}.`,
          evidenceIds: unique([
            ...candidateGold.evidenceIds.map(evidenceId),
            ...candidateConflicts.flatMap((conflict) => conflict.evidenceIds),
          ]),
          inferenceIds: [],
          unknownIds: candidateGold.unknownIds.map(unknownId),
        })),
        evidenceIds: unique([
          ...candidateGold.evidenceIds.map(evidenceId),
          ...candidateConflicts.flatMap((conflict) => conflict.evidenceIds),
        ]),
        inferenceIds: [],
        claimIds: [claimId(candidate.candidateId)],
        unknownIds: candidateGold.unknownIds.map(unknownId),
        hardConstraintConflictIds: candidateConflicts.map(
          ({ conflictId }) => conflictId,
        ),
        limitationIds: [],
      };
    },
  );
  const response = {
    contractVersion: '1.0.0' as const,
    assessmentId: `${resolved.binding.caseId}-assessment`,
    assessmentRequestId: request.assessmentRequestId,
    correlationId: request.correlationId,
    outcome: gold.outcome,
    suppliedCandidateIds: resolved.candidateSet.candidates.map(
      ({ candidateId }) => candidateId,
    ),
    candidateAssessments,
    evidence: observations,
    inferences: [],
    candidateLimitations: [],
    materialClaims: resolved.candidateSet.candidates.map((candidate) => {
      const candidateGold = goldCandidates.get(candidate.candidateId);
      if (candidateGold === undefined)
        throw new Error('Gold candidate missing.');
      return {
        claimId: claimId(candidate.candidateId),
        candidateId: candidate.candidateId,
        topic: 'responsible-adoption-fit',
        direction:
          candidateGold.disposition === 'rejected'
            ? ('unfavorable' as const)
            : candidateGold.disposition === 'insufficient-evidence'
              ? ('neutral' as const)
              : ('favorable' as const),
        statement: `The proposed evaluation disposition is ${candidateGold.disposition}.`,
        evidenceIds: candidateGold.evidenceIds.map(evidenceId),
        inferenceIds: [],
      };
    }),
    materialUnknowns,
    hardConstraintConflicts: hardConflicts,
    rankGroups: gold.rankGroups.map((candidateIds) => ({
      candidateIds: [...candidateIds],
    })),
    rankRelations: gold.rankRelations.map((relation) => ({ ...relation })),
    incomparablePairs: gold.incomparablePairs.map(
      ([leftCandidateId, rightCandidateId]) => ({
        leftCandidateId,
        rightCandidateId,
      }),
    ),
    evidenceCutoff: timestamp,
    producedAt: timestamp,
    assessmentProcessing: {
      state: 'complete' as const,
      incompleteReasonCodes: [],
    },
  };
  return { request, response };
}

function component(
  componentName:
    'runtime' | 'framework' | 'package-manager' | 'database' | 'orm',
  name: string,
  resolved: RankingResolvedCase,
  provenance: ConformanceProvenance,
) {
  return {
    kind: 'component' as const,
    factId: `${resolved.binding.caseId}-${componentName}`,
    component: componentName,
    name,
    version: null,
    provenance,
  };
}

function codedPresence(
  factId: string,
  category: 'repository-capability',
  code: 'redis',
  state: 'absent' | 'present' | 'unknown',
  provenance: ConformanceProvenance,
) {
  return {
    kind: 'coded' as const,
    factId,
    category,
    code,
    subjectCode: null,
    value: { kind: 'presence' as const, state },
    provenance,
  };
}

function mappedIdentityFacts(
  caseId: string,
  value: string,
  provenance: ConformanceProvenance,
) {
  const mappings: Readonly<
    Record<string, readonly (readonly [string, readonly string[]])[]>
  > = {
    'actor-tenant-correlation': [
      ['request', ['actor', 'correlation', 'tenant']],
    ],
    'normalized-client-route-key': [['route-key', ['client', 'route']]],
    'tenant-job-payload': [['job-payload', ['tenant']]],
    'tenant-session': [['session', ['tenant']]],
  };
  return (mappings[value] ?? []).flatMap(([subjectCode, codes], index) => [
    {
      kind: 'coded' as const,
      factId: shortId(
        'rv1-rf',
        `${caseId}\0identity\0${value}\0${String(index)}`,
      ),
      category: 'identity' as const,
      code: 'context-identifiers',
      subjectCode,
      value: { kind: 'code-set' as const, codes: [...codes] },
      provenance,
    },
    ...(value === 'normalized-client-route-key'
      ? [
          {
            kind: 'coded' as const,
            factId: shortId('rv1-rf', `${caseId}\0identity-normalization`),
            category: 'identity' as const,
            code: 'identifier-normalization',
            subjectCode,
            value: { kind: 'classification' as const, code: 'normalized' },
            provenance,
          },
        ]
      : []),
  ]);
}

function mappedResourceFacts(
  caseId: string,
  value: string,
  provenance: ConformanceProvenance,
) {
  const resources: Readonly<Record<string, readonly string[]>> = {
    'postgres-extension': ['database-custom-extensions'],
    'postgres-worker': ['background-worker'],
    'redis-cluster': ['persistent-redis'],
    'redis-worker': ['background-worker', 'persistent-redis'],
    'stdout-json-archive': ['stdout-json-regional-archive'],
  };
  return (resources[value] ?? []).map((subjectCode) => ({
    kind: 'coded' as const,
    factId: shortId('rv1-rf', `${caseId}\0resource\0${subjectCode}`),
    category: 'operations' as const,
    code: 'resource-availability',
    subjectCode,
    value: { kind: 'presence' as const, state: 'present' as const },
    provenance,
  }));
}

function mappedDataPolicyFacts(
  caseId: string,
  value: string,
  provenance: ConformanceProvenance,
) {
  if (value === 'regulated-data') {
    return [
      {
        kind: 'coded' as const,
        factId: shortId('rv1-rf', `${caseId}\0data\0${value}`),
        category: 'data-policy' as const,
        code: 'data-storage',
        subjectCode: 'regulated-customer-data',
        value: {
          kind: 'classification' as const,
          code: 'existing-postgresql',
        },
        provenance,
      },
    ];
  }
  const code =
    value === 'eu-residency'
      ? 'eu'
      : value === 'regional-storage'
        ? 'existing-region'
        : null;
  return code === null
    ? []
    : [
        {
          kind: 'coded' as const,
          factId: shortId('rv1-rf', `${caseId}\0data\0${value}`),
          category: 'data-policy' as const,
          code: 'data-residency',
          subjectCode: 'audit-data',
          value: { kind: 'classification' as const, code },
          provenance,
        },
      ];
}

function stableToken(value: string): string {
  const token = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 64)
    .replace(/-+$/gu, '');
  return token.length === 0 ? 'ranking-evidence' : token;
}

function shortId(prefix: string, value: string): string {
  return `${prefix}-${createHash('sha256').update(value).digest('hex').slice(0, 40)}`;
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareRankingText);
}

function contractDiagnostic(caseId: string, issue: ContractIssue) {
  return {
    code: `ranking.contracts.${issue.code}`,
    path: `${caseId}${issue.path}`,
    message:
      'Ranking evaluation mapping is not representable by the accepted assessment contracts.',
  };
}

function diagnostic(code: string, path: string) {
  return {
    code,
    path,
    message: 'Ranking evaluation contract conformance failed.',
  };
}
