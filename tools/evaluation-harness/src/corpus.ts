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
    validatePilotDiversity(diagnostics, bundles);
  }

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

function validatePilotDiversity(
  diagnostics: ReferenceDiagnostic[],
  bundles: readonly CaseBundle[],
): void {
  const profiles = bundles.map(
    (bundle) => bundle.caseDocument.repositoryProfile,
  );
  const outcomes = bundles.map((bundle) => bundle.gold.outcome);
  requireDiversity(
    diagnostics,
    profiles.some((profile) => profile.orm.name === 'prisma'),
    'includes Prisma',
  );
  requireDiversity(
    diagnostics,
    profiles.some((profile) => profile.orm.name === 'drizzle'),
    'includes Drizzle',
  );
  requireDiversity(
    diagnostics,
    profiles.some((profile) => profile.deployment.topology === 'serverless'),
    'includes serverless deployment',
  );
  requireDiversity(
    diagnostics,
    profiles.some((profile) =>
      profile.deployment.topology.startsWith('long-running'),
    ),
    'includes long-running deployment',
  );
  requireDiversity(
    diagnostics,
    profiles.some(
      (profile) => profile.deployment.workerCapability === 'capable',
    ),
    'includes worker-capable deployment',
  );
  requireDiversity(
    diagnostics,
    profiles.some(
      (profile) => profile.deployment.workerCapability === 'incapable',
    ),
    'includes worker-incapable deployment',
  );
  requireDiversity(
    diagnostics,
    profiles.some((profile) => profile.hasRedis),
    'includes Redis',
  );
  requireDiversity(
    diagnostics,
    profiles.some((profile) => !profile.hasRedis),
    'includes repository without Redis',
  );
  requireDiversity(
    diagnostics,
    profiles.some((profile) => profile.tenantModel === 'single-tenant'),
    'includes single-tenant case',
  );
  requireDiversity(
    diagnostics,
    profiles.some((profile) => profile.tenantModel === 'multi-tenant'),
    'includes multi-tenant case',
  );
  requireDiversity(
    diagnostics,
    outcomes.filter((outcome) => outcome !== 'recommend').length >= 2,
    'includes at least two responsible abstentions',
  );
  requireDiversity(
    diagnostics,
    hasConstraintToken(bundles, 'license'),
    'includes a license constraint',
  );
  requireDiversity(
    diagnostics,
    hasConstraintToken(bundles, 'runtime'),
    'includes a runtime constraint',
  );
  requireDiversity(
    diagnostics,
    hasConstraintToken(bundles, 'residency') ||
      hasConstraintToken(bundles, 'external-service'),
    'includes a residency or external-service constraint',
  );
  requireDiversity(
    diagnostics,
    bundles.some(
      (bundle) =>
        bundle.gold.outcome === 'insufficient-evidence' ||
        bundle.gold.dispositions.some(
          (disposition) => disposition.disposition === 'insufficient-evidence',
        ),
    ),
    'includes evidence insufficiency',
  );
  requireDiversity(
    diagnostics,
    bundles.some(
      (bundle) =>
        bundle.gold.rankGroups.some((group) => group.length > 1) ||
        bundle.gold.rankRelations.length > 0 ||
        bundle.gold.incomparablePairs.length > 0,
    ),
    'includes a tie or partial order',
  );
  requireDiversity(
    diagnostics,
    bundles.filter(
      (bundle) =>
        bundle.caseDocument.failureModes.includes('popular-hard-constraint') &&
        bundle.gold.hardConstraintConflicts.length > 0,
    ).length >= 3,
    'includes three popular hard-constraint rejections',
  );
  requireDiversity(
    diagnostics,
    bundles.some((bundle) =>
      bundle.caseDocument.failureModes.includes('popularity-over-fit'),
    ),
    'includes popularity order differing from fit',
  );

  const pairedTags = new Map<string, CaseBundle[]>();
  for (const bundle of bundles) {
    for (const tag of bundle.caseDocument.failureModes.filter((failureMode) =>
      failureMode.startsWith('paired-'),
    )) {
      const paired = pairedTags.get(tag) ?? [];
      paired.push(bundle);
      pairedTags.set(tag, paired);
    }
  }
  const validPairs = [...pairedTags.values()].filter((pair) => {
    if (pair.length !== 2) {
      return false;
    }
    const winners = pair.map((bundle) =>
      bundle.gold.dispositions
        .filter((disposition) => disposition.disposition === 'recommended')
        .map((disposition) => disposition.candidateId)
        .sort(compareText)
        .join(','),
    );
    return winners[0] !== winners[1];
  });
  requireDiversity(
    diagnostics,
    validPairs.length >= 2,
    'includes two paired requests with different winners',
  );
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
