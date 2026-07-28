import { join } from 'node:path';

import type {
  CaseBundle,
  CorpusManifest,
  EvaluationCase,
  EvidenceSet,
  GoldResult,
  ReferenceDiagnostic,
} from './contracts.ts';
import {
  hashJsonFile,
  loadJsonDirectory,
  loadJsonFile,
} from './json-boundary.ts';
import { validateCaseBundle } from './referential-integrity.ts';
import { createSchemaRegistry } from './schema-registry.ts';
import { stableJson } from './stable-json.ts';

export interface ManifestHashReference {
  readonly path: string;
  readonly sha256: string;
}

export type CorpusLoadResult =
  | {
      readonly ok: true;
      readonly manifest: CorpusManifest;
      readonly bundles: readonly CaseBundle[];
      readonly diagnostics: readonly [];
    }
  | {
      readonly ok: false;
      readonly diagnostics: readonly ReferenceDiagnostic[];
    };

export interface CorpusLoadOptions {
  readonly expectedCaseCount?: number;
  readonly enforcePilotDiversity?: boolean;
}

export function loadCorpus(
  repositoryRoot: string,
  corpusId = 'pilot-v1',
  options: CorpusLoadOptions = {},
): CorpusLoadResult {
  const corpusRoot = join(repositoryRoot, 'evals', corpusId);
  const registry = createSchemaRegistry(repositoryRoot);
  const manifestValue = loadJsonFile(corpusRoot, 'manifest.json');
  const manifestSchemaDiagnostics = registry.validate(
    'manifest',
    manifestValue,
  );
  if (manifestSchemaDiagnostics.length > 0) {
    return {
      ok: false,
      diagnostics: schemaDiagnostics(
        manifestSchemaDiagnostics,
        'manifest.json',
      ),
    };
  }
  const manifest = manifestValue as CorpusManifest;
  const diagnostics: ReferenceDiagnostic[] = [];
  const expectedCaseCount = options.expectedCaseCount ?? 10;
  const enforcePilotDiversity = options.enforcePilotDiversity ?? true;

  if (manifest.corpusId !== corpusId) {
    diagnostics.push(
      diagnostic(
        'manifest.corpus-id',
        'Manifest corpus ID must match its directory.',
        'manifest.json',
      ),
    );
  }
  if (manifest.cases.length !== expectedCaseCount) {
    diagnostics.push(
      diagnostic(
        'manifest.case-count',
        `Corpus must contain exactly ${String(expectedCaseCount)} cases.`,
        'manifest.json',
      ),
    );
  }
  const manifestCaseIds = manifest.cases.map((entry) => entry.caseId);
  reportDuplicates(diagnostics, manifestCaseIds, 'manifest.json');
  if (!isSorted(manifestCaseIds)) {
    diagnostics.push(
      diagnostic(
        'manifest.case-order',
        'Manifest cases must be sorted by case ID.',
        'manifest.json',
      ),
    );
  }

  const manifestPaths = manifest.cases.flatMap((entry) => [
    entry.casePath,
    entry.evidencePath,
    entry.goldPath,
  ]);
  const actualPaths = [
    ...loadJsonDirectory(corpusRoot, 'cases', { maximumFiles: 100 }),
    ...loadJsonDirectory(corpusRoot, 'evidence', { maximumFiles: 100 }),
    ...loadJsonDirectory(corpusRoot, 'gold', { maximumFiles: 100 }),
  ].map((entry) => entry.path);
  if (!sameSet(manifestPaths, actualPaths)) {
    diagnostics.push(
      diagnostic(
        'manifest.membership',
        'Manifest paths must exactly match corpus case, evidence, and gold files.',
        'manifest.json',
      ),
    );
  }

  diagnostics.push(
    ...validateManifestHashes(
      corpusRoot,
      manifest.cases.flatMap((entry) => [
        { path: entry.casePath, sha256: entry.caseSha256 },
        { path: entry.evidencePath, sha256: entry.evidenceSha256 },
        { path: entry.goldPath, sha256: entry.goldSha256 },
      ]),
    ),
  );

  const bundles: CaseBundle[] = [];
  for (const entry of manifest.cases) {
    const expectedPaths = [
      `cases/${entry.caseId}.json`,
      `evidence/${entry.caseId}.json`,
      `gold/${entry.caseId}.json`,
    ];
    if (
      entry.casePath !== expectedPaths[0] ||
      entry.evidencePath !== expectedPaths[1] ||
      entry.goldPath !== expectedPaths[2]
    ) {
      diagnostics.push(
        diagnostic(
          'manifest.case-path',
          'Manifest paths must use the entry case ID in the owned directories.',
          `manifest.${entry.caseId}`,
        ),
      );
      continue;
    }
    const caseValue = loadJsonFile(corpusRoot, entry.casePath);
    const evidenceValue = loadJsonFile(corpusRoot, entry.evidencePath);
    const goldValue = loadJsonFile(corpusRoot, entry.goldPath);
    const documentDiagnostics = [
      ...schemaDiagnostics(
        registry.validate('case', caseValue),
        entry.casePath,
      ),
      ...schemaDiagnostics(
        registry.validate('evidence', evidenceValue),
        entry.evidencePath,
      ),
      ...schemaDiagnostics(
        registry.validate('gold', goldValue),
        entry.goldPath,
      ),
    ];
    diagnostics.push(...documentDiagnostics);
    if (documentDiagnostics.length > 0) {
      continue;
    }
    const bundle: CaseBundle = {
      caseDocument: caseValue as EvaluationCase,
      evidence: evidenceValue as EvidenceSet,
      gold: goldValue as GoldResult,
    };
    if (bundle.caseDocument.capabilityFamily !== entry.capabilityFamily) {
      diagnostics.push(
        diagnostic(
          'manifest.family',
          'Manifest family must match the case document.',
          `manifest.${entry.caseId}`,
        ),
      );
    }
    if (
      bundle.caseDocument.evidenceCutoff !== manifest.evidenceCutoff ||
      bundle.evidence.evidenceCutoff !== manifest.evidenceCutoff ||
      bundle.gold.evidenceCutoff !== manifest.evidenceCutoff
    ) {
      diagnostics.push(
        diagnostic(
          'manifest.evidence-cutoff',
          'Every corpus document must use the manifest evidence cutoff.',
          entry.caseId,
        ),
      );
    }
    diagnostics.push(
      ...validateCaseBundle(bundle.caseDocument, bundle.evidence, bundle.gold),
    );
    bundles.push(bundle);
  }

  validateFamilyCounts(diagnostics, manifest, bundles);
  if (enforcePilotDiversity && bundles.length === expectedCaseCount) {
    diagnostics.push(...validatePilotScope(bundles));
    diagnostics.push(...validateComparisonPairs(bundles));
    validatePilotDiversity(diagnostics, manifest, bundles);
  }
  diagnostics.push(...validateCorpusProvenance(manifest, bundles));

  if (diagnostics.length > 0) {
    return { ok: false, diagnostics: finalize(diagnostics) };
  }
  return { ok: true, manifest, bundles, diagnostics: [] };
}

export function validateManifestHashes(
  corpusRoot: string,
  references: readonly ManifestHashReference[],
): readonly ReferenceDiagnostic[] {
  const diagnostics: ReferenceDiagnostic[] = [];
  const seen = new Set<string>();
  for (const reference of references) {
    if (seen.has(reference.path)) {
      diagnostics.push({
        code: 'manifest.duplicate-path',
        message: 'Manifest paths must be unique.',
        path: reference.path,
      });
      continue;
    }
    seen.add(reference.path);
    const actual = hashJsonFile(corpusRoot, reference.path);
    if (actual !== reference.sha256) {
      diagnostics.push({
        code: 'manifest.hash',
        message: 'Manifest SHA-256 does not match the current file bytes.',
        path: reference.path,
      });
    }
  }
  return diagnostics.sort((left, right) =>
    compareText(`${left.path}\0${left.code}`, `${right.path}\0${right.code}`),
  );
}

function validateFamilyCounts(
  diagnostics: ReferenceDiagnostic[],
  manifest: CorpusManifest,
  bundles: readonly CaseBundle[],
): void {
  for (const family of [
    'authorization',
    'audit-logging',
    'background-jobs',
    'rate-limiting',
    'webhooks',
  ] as const) {
    const actual = bundles.filter(
      (bundle) => bundle.caseDocument.capabilityFamily === family,
    ).length;
    if (manifest.familyCounts[family] !== actual) {
      diagnostics.push(
        diagnostic(
          'manifest.family-count',
          'Manifest family count does not match loaded cases.',
          `manifest.familyCounts.${family}`,
        ),
      );
    }
    if (manifest.cases.length === 10 && actual !== 2) {
      diagnostics.push(
        diagnostic(
          'manifest.family-balance',
          'Pilot corpus must contain exactly two cases per family.',
          `manifest.familyCounts.${family}`,
        ),
      );
    }
  }
}

export function validatePilotScope(
  bundles: readonly CaseBundle[],
): readonly ReferenceDiagnostic[] {
  const diagnostics: ReferenceDiagnostic[] = [];
  for (const bundle of bundles) {
    const { caseDocument } = bundle;
    const { repositoryProfile } = caseDocument;
    const fields = [
      ['language', repositoryProfile.language.name, 'typescript'],
      ['framework', repositoryProfile.framework.name, 'nextjs'],
      ['database', repositoryProfile.database.name, 'postgresql'],
    ] as const;
    for (const [field, actual, expected] of fields) {
      if (actual !== expected) {
        diagnostics.push(
          diagnostic(
            'manifest.pilot-scope',
            `Pilot ${field} must be ${expected}.`,
            `${caseDocument.caseId}.repositoryProfile.${field}.name`,
          ),
        );
      }
    }
    if (
      !['node', 'node-serverless', 'node-edge', 'edge-fetch'].includes(
        repositoryProfile.runtime.name,
      )
    ) {
      diagnostics.push(
        diagnostic(
          'manifest.pilot-scope',
          'Pilot runtime must be a supported Node.js or Next.js Edge execution topology.',
          `${caseDocument.caseId}.repositoryProfile.runtime.name`,
        ),
      );
    }
    if (
      repositoryProfile.orm.name !== 'prisma' &&
      repositoryProfile.orm.name !== 'drizzle'
    ) {
      diagnostics.push(
        diagnostic(
          'manifest.pilot-scope',
          'Pilot ORM must be Prisma or Drizzle.',
          `${caseDocument.caseId}.repositoryProfile.orm.name`,
        ),
      );
    }
  }
  return finalize(diagnostics);
}

export function validateComparisonPairs(
  bundles: readonly CaseBundle[],
): readonly ReferenceDiagnostic[] {
  return analyzeComparisonPairs(bundles).diagnostics;
}

function analyzeComparisonPairs(bundles: readonly CaseBundle[]): {
  readonly validPairCount: number;
  readonly diagnostics: readonly ReferenceDiagnostic[];
} {
  const diagnostics: ReferenceDiagnostic[] = [];
  const pairs = new Map<string, CaseBundle[]>();
  for (const bundle of bundles) {
    const pairId = bundle.caseDocument.comparisonPairId;
    if (pairId === null) {
      continue;
    }
    const members = pairs.get(pairId) ?? [];
    members.push(bundle);
    pairs.set(pairId, members);
  }

  let validPairCount = 0;
  for (const [pairId, members] of [...pairs.entries()].sort(([left], [right]) =>
    compareText(left, right),
  )) {
    const path = `comparisonPair.${pairId}`;
    if (members.length !== 2) {
      diagnostics.push(
        diagnostic(
          'manifest.comparison-pair-size',
          'A declared comparison pair must contain exactly two cases.',
          path,
        ),
      );
      continue;
    }
    const [left, right] = members as [CaseBundle, CaseBundle];
    const conditioningVariablesDiffer = !sameJson(
      normalizedConditioning(left.caseDocument),
      normalizedConditioning(right.caseDocument),
    );
    const checks = [
      {
        condition:
          left.caseDocument.capabilityFamily ===
          right.caseDocument.capabilityFamily,
        code: 'manifest.comparison-pair-family',
        message: 'Comparison pair cases must use the same capability family.',
      },
      {
        condition:
          left.caseDocument.decisionObjective ===
          right.caseDocument.decisionObjective,
        code: 'manifest.comparison-pair-objective',
        message: 'Comparison pair cases must use the same decision objective.',
      },
      {
        condition:
          left.caseDocument.userRequest === right.caseDocument.userRequest,
        code: 'manifest.comparison-pair-request',
        message: 'Comparison pair cases must use the identical user request.',
      },
      {
        condition: sameJson(
          left.caseDocument.successConditions,
          right.caseDocument.successConditions,
        ),
        code: 'manifest.comparison-pair-success',
        message: 'Comparison pair cases must use identical success conditions.',
      },
      {
        condition: sameJson(
          normalizedCandidates(left.caseDocument),
          normalizedCandidates(right.caseDocument),
        ),
        code: 'manifest.comparison-pair-candidates',
        message:
          'Comparison pair cases must use the same candidate IDs and normalized projects.',
      },
      {
        condition: conditioningVariablesDiffer,
        code: 'manifest.comparison-pair-conditioning',
        message:
          'Comparison pair cases must differ in repository profile or hard constraints.',
      },
      {
        condition: !sameSet(
          recommendedCandidates(left.gold),
          recommendedCandidates(right.gold),
        ),
        code: 'manifest.comparison-pair-winner',
        message:
          'Comparison pair cases must have different proposed recommended candidate sets.',
      },
    ] as const;
    for (const check of checks) {
      if (!check.condition) {
        diagnostics.push(diagnostic(check.code, check.message, path));
      }
    }
    if (checks.every((check) => check.condition)) {
      validPairCount += 1;
    }
  }
  if (validPairCount < 2) {
    diagnostics.push(
      diagnostic(
        'manifest.diversity',
        'Pilot diversity check failed: includes two controlled comparison pairs.',
        'manifest.diversity',
      ),
    );
  }
  return { validPairCount, diagnostics: finalize(diagnostics) };
}

function validatePilotDiversity(
  diagnostics: ReferenceDiagnostic[],
  manifest: CorpusManifest,
  bundles: readonly CaseBundle[],
): void {
  const derived = derivePilotDiversity(bundles);
  requireDiversity(diagnostics, derived.includesPrisma, 'includes Prisma');
  requireDiversity(diagnostics, derived.includesDrizzle, 'includes Drizzle');
  requireDiversity(
    diagnostics,
    derived.includesServerless,
    'includes serverless deployment',
  );
  requireDiversity(
    diagnostics,
    derived.includesLongRunning,
    'includes long-running deployment',
  );
  requireDiversity(
    diagnostics,
    derived.includesWorkerCapable,
    'includes worker-capable deployment',
  );
  requireDiversity(
    diagnostics,
    derived.includesWorkerIncapable,
    'includes worker-incapable deployment',
  );
  requireDiversity(diagnostics, derived.includesRedis, 'includes Redis');
  requireDiversity(
    diagnostics,
    derived.includesNoRedis,
    'includes repository without Redis',
  );
  requireDiversity(
    diagnostics,
    derived.includesSingleTenant,
    'includes single-tenant case',
  );
  requireDiversity(
    diagnostics,
    derived.includesMultiTenant,
    'includes multi-tenant case',
  );
  requireDiversity(
    diagnostics,
    derived.responsibleAbstentions >= 2,
    'includes at least two responsible abstentions',
  );
  requireDiversity(
    diagnostics,
    derived.includesLicenseConstraint,
    'includes a license constraint',
  );
  requireDiversity(
    diagnostics,
    derived.includesRuntimeConstraint,
    'includes a runtime constraint',
  );
  requireDiversity(
    diagnostics,
    derived.includesResidencyConstraint,
    'includes a residency or external-service constraint',
  );
  requireDiversity(
    diagnostics,
    derived.includesEvidenceInsufficiency,
    'includes evidence insufficiency',
  );
  requireDiversity(
    diagnostics,
    derived.includesTieOrPartialOrder,
    'includes a tie or partial order',
  );
  requireDiversity(
    diagnostics,
    derived.popularHardConstraintRejections >= 3,
    'includes three popular hard-constraint rejections',
  );
  requireDiversity(
    diagnostics,
    derived.popularityDiffersFromFit,
    'includes popularity order differing from fit',
  );
  requireDiversity(
    diagnostics,
    derived.pairedDifferentWinners >= 2,
    'includes two controlled comparisons with different winners',
  );

  for (const key of Object.keys(derived) as (keyof typeof derived)[]) {
    if (manifest.diversity[key] !== derived[key]) {
      diagnostics.push(
        diagnostic(
          'manifest.diversity-drift',
          'Stored manifest diversity must exactly match derived corpus data.',
          `manifest.diversity.${key}`,
        ),
      );
    }
  }
}

export function derivePilotDiversity(
  bundles: readonly CaseBundle[],
): CorpusManifest['diversity'] {
  const profiles = bundles.map(
    (bundle) => bundle.caseDocument.repositoryProfile,
  );
  const outcomes = bundles.map((bundle) => bundle.gold.outcome);
  return {
    pairedDifferentWinners: analyzeComparisonPairs(bundles).validPairCount,
    responsibleAbstentions: outcomes.filter(
      (outcome) => outcome !== 'recommend',
    ).length,
    popularHardConstraintRejections: bundles.filter(
      (bundle) =>
        bundle.caseDocument.failureModes.includes('popular-hard-constraint') &&
        bundle.gold.hardConstraintConflicts.length > 0,
    ).length,
    includesPrisma: profiles.some((profile) => profile.orm.name === 'prisma'),
    includesDrizzle: profiles.some((profile) => profile.orm.name === 'drizzle'),
    includesServerless: profiles.some(
      (profile) => profile.deployment.topology === 'serverless',
    ),
    includesLongRunning: profiles.some((profile) =>
      profile.deployment.topology.startsWith('long-running'),
    ),
    includesWorkerCapable: profiles.some(
      (profile) => profile.deployment.workerCapability === 'capable',
    ),
    includesWorkerIncapable: profiles.some(
      (profile) => profile.deployment.workerCapability === 'incapable',
    ),
    includesRedis: profiles.some((profile) => profile.hasRedis),
    includesNoRedis: profiles.some((profile) => !profile.hasRedis),
    includesSingleTenant: profiles.some(
      (profile) => profile.tenantModel === 'single-tenant',
    ),
    includesMultiTenant: profiles.some(
      (profile) => profile.tenantModel === 'multi-tenant',
    ),
    includesLicenseConstraint: hasConstraintToken(bundles, 'license'),
    includesRuntimeConstraint: hasConstraintToken(bundles, 'runtime'),
    includesResidencyConstraint:
      hasConstraintToken(bundles, 'residency') ||
      hasConstraintToken(bundles, 'external-service'),
    includesEvidenceInsufficiency: bundles.some(
      (bundle) =>
        bundle.gold.outcome === 'insufficient-evidence' ||
        bundle.gold.dispositions.some(
          (disposition) => disposition.disposition === 'insufficient-evidence',
        ),
    ),
    includesTieOrPartialOrder: bundles.some(
      (bundle) =>
        bundle.gold.rankGroups.some((group) => group.length > 1) ||
        bundle.gold.rankRelations.length > 0 ||
        bundle.gold.incomparablePairs.length > 0,
    ),
    popularityDiffersFromFit: bundles.some((bundle) =>
      bundle.caseDocument.failureModes.includes('popularity-over-fit'),
    ),
  };
}

export function validateCorpusProvenance(
  manifest: CorpusManifest,
  bundles: readonly CaseBundle[],
): readonly ReferenceDiagnostic[] {
  const diagnostics: ReferenceDiagnostic[] = [];
  for (const bundle of bundles) {
    if (
      bundle.gold.provenance.status !== manifest.provenance.goldStatus ||
      bundle.gold.provenance.authoringSession !==
        manifest.provenance.authoringSession
    ) {
      diagnostics.push(
        diagnostic(
          'manifest.provenance',
          'Every gold provenance status and authoring session must agree with the manifest.',
          bundle.caseDocument.caseId,
        ),
      );
    }
  }
  return finalize(diagnostics);
}

function normalizedCandidates(caseDocument: EvaluationCase): readonly {
  readonly candidateId: string;
  readonly project: string;
  readonly package: string | null;
  readonly repository: string;
}[] {
  return caseDocument.candidates.map((candidate) => ({
    candidateId: candidate.candidateId,
    project: candidate.project,
    package: candidate.package,
    repository: candidate.repository,
  }));
}

function normalizedConditioning(caseDocument: EvaluationCase): unknown {
  const profile = caseDocument.repositoryProfile;
  return {
    repositoryProfile: {
      ...profile,
      dependencies: [...profile.dependencies].sort((left, right) =>
        compareText(
          `${left.name}\0${left.version}`,
          `${right.name}\0${right.version}`,
        ),
      ),
      identityFacts: [...profile.identityFacts].sort(compareText),
      dataFacts: [...profile.dataFacts].sort(compareText),
      operationalFacts: [...profile.operationalFacts].sort(compareText),
    },
    hardConstraints: [...caseDocument.hardConstraints].sort((left, right) =>
      compareText(left.constraintId, right.constraintId),
    ),
  };
}

function recommendedCandidates(gold: GoldResult): string[] {
  return gold.dispositions
    .filter((disposition) => disposition.disposition === 'recommended')
    .map((disposition) => disposition.candidateId)
    .sort(compareText);
}

function sameJson(left: unknown, right: unknown): boolean {
  return stableJson(left) === stableJson(right);
}

function hasConstraintToken(
  bundles: readonly CaseBundle[],
  token: string,
): boolean {
  return bundles.some((bundle) =>
    bundle.caseDocument.hardConstraints.some(
      (constraint) =>
        constraint.constraintId.includes(token) ||
        constraint.reasonCode.includes(token),
    ),
  );
}

function requireDiversity(
  diagnostics: ReferenceDiagnostic[],
  condition: boolean,
  requirement: string,
): void {
  if (!condition) {
    diagnostics.push(
      diagnostic(
        'manifest.diversity',
        `Pilot diversity check failed: ${requirement}.`,
        'manifest.diversity',
      ),
    );
  }
}

function schemaDiagnostics(
  diagnostics: readonly {
    readonly code: string;
    readonly message: string;
    readonly path: string;
  }[],
  filePath: string,
): ReferenceDiagnostic[] {
  return diagnostics.map((item) => ({
    code: item.code,
    message: item.message,
    path: `${filePath}${item.path}`,
  }));
}

function reportDuplicates(
  diagnostics: ReferenceDiagnostic[],
  values: readonly string[],
  path: string,
): void {
  if (new Set(values).size !== values.length) {
    diagnostics.push(
      diagnostic(
        'manifest.duplicate-id',
        'Manifest case IDs must be unique.',
        path,
      ),
    );
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
    .slice(0, 500);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
