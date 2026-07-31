import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import {
  REQUIRED_REPOSITORY_INTERVIEW_ADVERSARIAL_FIXTURE_IDS,
  REQUIRED_REPOSITORY_INTERVIEW_CALIBRATION,
  REQUIRED_REPOSITORY_INTERVIEW_CANDIDATE_IDS,
} from './repository-interview-evaluation-authority.ts';
import {
  REPOSITORY_INTERVIEW_EVALUATION_AUTHORITY,
  buildRepositoryInterviewEvaluationAssetsV1,
} from './repository-interview-evaluation-assets.ts';
import type {
  CatalogCandidateStatus,
  RepositoryInterviewAdversarialFixtureV1,
  RepositoryInterviewEvaluationCandidateV1,
  RepositoryInterviewEvaluationCorpusV1,
  RepositoryInterviewEvaluationDiagnostic,
  RepositoryInterviewEvaluationManifestV1,
  RepositoryInterviewCohortPolicyV1,
  RepositoryInterviewGatePolicyV1,
  RepositoryInterviewReviewPolicyV1,
  RepositoryInterviewRubricV1,
} from './repository-interview-evaluation-contracts.ts';
import { repositoryInterviewEvaluationCorpusDigestV1 } from './repository-interview-evaluation-digests.ts';
import {
  EvaluationBoundaryError,
  hashJsonFile,
  loadJsonDirectory,
  loadJsonFile,
} from './json-boundary.ts';
import { createRepositoryInterviewEvaluationSchemaRegistry } from './repository-interview-evaluation-schema-registry.ts';
import { stableJson } from './stable-json.ts';

export {
  REQUIRED_REPOSITORY_INTERVIEW_ADVERSARIAL_FIXTURE_IDS,
  REQUIRED_REPOSITORY_INTERVIEW_CALIBRATION,
  REQUIRED_REPOSITORY_INTERVIEW_CANDIDATE_IDS,
};

export type RepositoryInterviewEvaluationCorpusLoadResultV1 =
  | {
      readonly ok: true;
      readonly corpus: RepositoryInterviewEvaluationCorpusV1;
      readonly diagnostics: readonly [];
    }
  | {
      readonly ok: false;
      readonly diagnostics: readonly RepositoryInterviewEvaluationDiagnostic[];
    };

interface CatalogAuthorityCandidate {
  readonly candidateId: string;
  readonly primaryCapabilityFamily: RepositoryInterviewEvaluationCandidateV1['capabilityFamily'];
  readonly status: CatalogCandidateStatus;
}

interface ArtifactSelectionAuthority {
  readonly candidateId: string;
  readonly selections: readonly {
    readonly artifactKind: 'documentation' | 'readme';
  }[];
}

export function loadRepositoryInterviewEvaluationCorpusV1(
  repositoryRoot: string,
): RepositoryInterviewEvaluationCorpusLoadResultV1 {
  try {
    return load(repositoryRoot);
  } catch (error) {
    const code =
      error instanceof EvaluationBoundaryError
        ? error.code
        : 'evaluation.boundary';
    return {
      ok: false,
      diagnostics: [
        issue(
          code,
          'Repository-interview evaluation authority could not be loaded.',
          '',
        ),
      ],
    };
  }
}

function load(
  repositoryRoot: string,
): RepositoryInterviewEvaluationCorpusLoadResultV1 {
  const root = join(repositoryRoot, 'evals/repository-interviews-v1');
  const registry =
    createRepositoryInterviewEvaluationSchemaRegistry(repositoryRoot);
  const diagnostics: RepositoryInterviewEvaluationDiagnostic[] = [];
  const manifestValue = loadJsonFile(root, 'manifest.json');
  pushSchema(
    diagnostics,
    registry.validate('manifest', manifestValue),
    'manifest.json',
  );
  if (diagnostics.length > 0) return failure(diagnostics);
  const manifest = manifestValue as RepositoryInterviewEvaluationManifestV1;

  const policyEntries = loadJsonDirectory(root, 'policy', { maximumFiles: 4 });
  const candidateEntries = loadJsonDirectory(root, 'candidates', {
    maximumFiles: 30,
  });
  const adversarialEntries = loadJsonDirectory(root, 'adversarial', {
    maximumFiles: 12,
  });
  const schemaDirectory = join(
    repositoryRoot,
    'schemas/evaluation/repository-interviews',
  );
  const schemaPaths = readdirSync(schemaDirectory)
    .filter((name) => name.endsWith('.schema.json'))
    .map((name) => `schemas/evaluation/repository-interviews/${name}`)
    .sort(compareText);
  for (const directory of ['policy', 'candidates', 'adversarial']) {
    if (
      readdirSync(join(root, directory)).some(
        (name) => !/^[a-z0-9]+(?:-[a-z0-9]+)*\.json$/u.test(name),
      )
    ) {
      diagnostics.push(
        issue(
          'manifest.unexpected-file',
          'Owned evaluation directories may contain only declared JSON members.',
          directory,
        ),
      );
    }
  }
  const groups = [
    { manifest: manifest.policies, actual: policyEntries, schema: null },
    {
      manifest: manifest.candidates,
      actual: candidateEntries,
      schema: 'candidate' as const,
    },
    {
      manifest: manifest.adversarialFixtures,
      actual: adversarialEntries,
      schema: 'adversarial-fixture' as const,
    },
  ];
  for (const group of groups) {
    const declared = group.manifest.map(({ path }) => path);
    const actual = group.actual.map(({ path }) => path);
    if (!sameArray(declared, [...declared].sort(compareText)))
      diagnostics.push(
        issue(
          'manifest.order',
          'Manifest members must use deterministic path order.',
          'manifest.json',
        ),
      );
    if (!sameArray(declared, actual))
      diagnostics.push(
        issue(
          'manifest.membership',
          'Manifest membership must exactly match owned JSON files.',
          'manifest.json',
        ),
      );
    for (const member of group.manifest) {
      if (hashJsonFile(root, member.path) !== member.sha256)
        diagnostics.push(
          issue(
            'manifest.hash',
            'Manifest member digest does not match file bytes.',
            member.path,
          ),
        );
    }
    if (group.schema !== null) {
      for (const entry of group.actual)
        pushSchema(
          diagnostics,
          registry.validate(group.schema, entry.value),
          entry.path,
        );
    }
  }
  const declaredSchemaPaths = manifest.schemas.map(({ path }) => path);
  if (
    !sameArray(declaredSchemaPaths, [...declaredSchemaPaths].sort(compareText))
  )
    diagnostics.push(
      issue(
        'manifest.order',
        'Manifest members must use deterministic path order.',
        'manifest.json',
      ),
    );
  if (!sameArray(declaredSchemaPaths, schemaPaths))
    diagnostics.push(
      issue(
        'manifest.membership',
        'Manifest schema membership must exactly match owned schema files.',
        'manifest.json',
      ),
    );
  for (const member of manifest.schemas)
    if (hashJsonFile(repositoryRoot, member.path) !== member.sha256)
      diagnostics.push(
        issue(
          'manifest.hash',
          'Manifest member digest does not match file bytes.',
          member.path,
        ),
      );
  const policySchemas = [
    ['policy/cohort-policy.json', 'cohort-policy'],
    ['policy/gate-policy.json', 'gate-policy'],
    ['policy/review-policy.json', 'review-policy'],
    ['policy/rubric.json', 'rubric'],
  ] as const;
  const policies = new Map(
    policyEntries.map((entry) => [entry.path, entry.value]),
  );
  for (const [path, schema] of policySchemas)
    pushSchema(
      diagnostics,
      registry.validate(schema, policies.get(path)),
      path,
    );

  const candidates = candidateEntries.map(
    ({ value }) => value as RepositoryInterviewEvaluationCandidateV1,
  );
  const fixtures = adversarialEntries.map(
    ({ value }) => value as RepositoryInterviewAdversarialFixtureV1,
  );
  const catalog = loadJsonFile(
    repositoryRoot,
    'catalog/public-v1/manifest.json',
  ) as {
    readonly manifestDigest: string;
    readonly candidates: readonly CatalogAuthorityCandidate[];
  };
  const artifacts = loadJsonFile(
    repositoryRoot,
    'catalog/public-v1/artifact-manifest.json',
  ) as {
    readonly manifestDigest: string;
    readonly candidates: readonly ArtifactSelectionAuthority[];
  };
  diagnostics.push(
    ...validateRepositoryInterviewEvaluationCohortV1(
      candidates,
      catalog.candidates,
      artifacts.candidates,
    ),
  );
  validateManifest(
    diagnostics,
    manifest,
    catalog.manifestDigest,
    artifacts.manifestDigest,
  );
  validateFixtures(diagnostics, fixtures);
  validateProhibitedFields(diagnostics, [
    ...policyEntries,
    ...candidateEntries,
    ...adversarialEntries,
  ]);
  validateGeneratedDrift(diagnostics, repositoryRoot);
  if (diagnostics.length > 0) return failure(diagnostics);

  const orderedCandidates = REQUIRED_REPOSITORY_INTERVIEW_CANDIDATE_IDS.map(
    (candidateId) =>
      candidates.find((candidate) => candidate.candidateId === candidateId),
  ).filter(
    (value): value is RepositoryInterviewEvaluationCandidateV1 =>
      value !== undefined,
  );
  const familyCounts = Object.fromEntries(
    [
      'authorization',
      'audit-logging',
      'background-jobs',
      'rate-limiting',
      'webhooks',
    ].map((family) => [
      family,
      orderedCandidates.filter(
        (candidate) => candidate.capabilityFamily === family,
      ).length,
    ]),
  ) as RepositoryInterviewEvaluationCorpusV1['derived']['familyCounts'];
  return {
    ok: true,
    corpus: {
      manifest,
      candidates: orderedCandidates,
      adversarialFixtures: fixtures.sort((left, right) =>
        compareText(left.fixtureId, right.fixtureId),
      ),
      policies: {
        cohort: policies.get(
          'policy/cohort-policy.json',
        ) as RepositoryInterviewCohortPolicyV1,
        review: policies.get(
          'policy/review-policy.json',
        ) as RepositoryInterviewReviewPolicyV1,
        rubric: policies.get(
          'policy/rubric.json',
        ) as RepositoryInterviewRubricV1,
        gate: policies.get(
          'policy/gate-policy.json',
        ) as RepositoryInterviewGatePolicyV1,
      },
      policyDigests: {
        cohort: policyDigest(manifest, 'policy/cohort-policy.json'),
        review: policyDigest(manifest, 'policy/review-policy.json'),
        rubric: policyDigest(manifest, 'policy/rubric.json'),
        gate: policyDigest(manifest, 'policy/gate-policy.json'),
      },
      derived: {
        familyCounts,
        negativeControlCount: countStatus(
          orderedCandidates,
          'negative-control',
        ),
        archivedCount: countStatus(orderedCandidates, 'archived'),
        movedCount: countStatus(orderedCandidates, 'moved'),
        richDocumentationCount: countLabel(
          orderedCandidates,
          'rich-additional-documentation',
        ),
        readmeOnlyCount: countLabel(orderedCandidates, 'readme-only'),
        calibrationCount: orderedCandidates.filter(
          ({ calibrationMember }) => calibrationMember,
        ).length,
      },
    },
    diagnostics: [],
  };
}

export function validateRepositoryInterviewEvaluationCohortV1(
  candidates: readonly RepositoryInterviewEvaluationCandidateV1[],
  catalogCandidates: readonly CatalogAuthorityCandidate[],
  artifactCandidates: readonly ArtifactSelectionAuthority[],
): readonly RepositoryInterviewEvaluationDiagnostic[] {
  const diagnostics: RepositoryInterviewEvaluationDiagnostic[] = [];
  const ids = candidates.map(({ candidateId }) => candidateId);
  if (
    ids.length !== 30 ||
    !sameSet(ids, REQUIRED_REPOSITORY_INTERVIEW_CANDIDATE_IDS)
  )
    diagnostics.push(
      issue(
        'cohort.membership',
        'Cohort must contain the exact amended candidate membership.',
        'candidates',
      ),
    );
  if (new Set(ids).size !== ids.length)
    diagnostics.push(
      issue('cohort.duplicate', 'Candidate IDs must be unique.', 'candidates'),
    );
  const catalogMap = new Map(
    catalogCandidates.map((candidate) => [candidate.candidateId, candidate]),
  );
  const artifactMap = new Map(
    artifactCandidates.map((candidate) => [candidate.candidateId, candidate]),
  );
  const families = [
    'authorization',
    'audit-logging',
    'background-jobs',
    'rate-limiting',
    'webhooks',
  ] as const;
  for (const [index, candidate] of candidates.entries()) {
    const path = `candidates/${String(index)}`;
    const catalog = catalogMap.get(candidate.candidateId);
    if (catalog === undefined)
      diagnostics.push(
        issue(
          'cohort.catalog',
          'Candidate must exist in committed catalog authority.',
          path,
        ),
      );
    else {
      if (catalog.primaryCapabilityFamily !== candidate.capabilityFamily)
        diagnostics.push(
          issue(
            'cohort.family',
            'Candidate family must match committed catalog authority.',
            path,
          ),
        );
      if (catalog.status !== candidate.catalogStatus)
        diagnostics.push(
          issue(
            'cohort.status',
            'Candidate status must match committed catalog authority.',
            path,
          ),
        );
    }
    if (!isSortedUnique(candidate.selectionLabels))
      diagnostics.push(
        issue(
          'cohort.labels',
          'Selection labels must be sorted and unique.',
          path,
        ),
      );
    validateStatusLabel(
      diagnostics,
      candidate,
      'negative-control',
      'negative-control',
      path,
    );
    validateStatusLabel(
      diagnostics,
      candidate,
      'archived',
      'archived-lifecycle',
      path,
    );
    validateStatusLabel(
      diagnostics,
      candidate,
      'moved',
      'moved-repository',
      path,
    );
    const documentationLabels = candidate.selectionLabels.filter(
      (label) =>
        label === 'readme-only' || label === 'rich-additional-documentation',
    );
    if (documentationLabels.length !== 1)
      diagnostics.push(
        issue(
          'cohort.documentation-scope',
          'Candidate must have exactly one documentation-scope label.',
          path,
        ),
      );
    if (candidate.calibrationMember !== (candidate.calibrationOrdinal !== null))
      diagnostics.push(
        issue(
          'cohort.calibration-ordinal',
          'Calibration membership and ordinal must agree.',
          path,
        ),
      );
    const artifact = artifactMap.get(candidate.candidateId);
    if (artifact === undefined)
      diagnostics.push(
        issue(
          'cohort.artifact-profile',
          'Candidate must exist in committed artifact authority.',
          path,
        ),
      );
    else {
      const expectedKinds = artifact.selections.map(
        ({ artifactKind }) => artifactKind,
      );
      if (
        candidate.artifactProfile.presentArtifactCount !==
          expectedKinds.length ||
        candidate.artifactProfile.notFoundSelectionCount !== 0 ||
        !sameArray(
          candidate.artifactProfile.presentArtifactKinds,
          expectedKinds,
        )
      )
        diagnostics.push(
          issue(
            'cohort.artifact-profile',
            'Artifact profile must match committed content-free artifact authority.',
            path,
          ),
        );
      const expectedLabel =
        expectedKinds.length > 1
          ? 'rich-additional-documentation'
          : 'readme-only';
      if (!candidate.selectionLabels.includes(expectedLabel))
        diagnostics.push(
          issue(
            'cohort.documentation-scope',
            'Documentation-scope label must match committed artifact authority.',
            path,
          ),
        );
    }
  }
  for (const family of families) {
    const members = candidates.filter(
      (candidate) => candidate.capabilityFamily === family,
    );
    if (members.length !== 6)
      diagnostics.push(
        issue(
          'cohort.family-count',
          'Every capability family must contain exactly six candidates.',
          family,
        ),
      );
    if (
      members.filter(
        ({ catalogStatus }) => catalogStatus === 'negative-control',
      ).length !== 1
    )
      diagnostics.push(
        issue(
          'cohort.family-negative-control',
          'Every capability family must contain exactly one negative control.',
          family,
        ),
      );
    for (const label of [
      'simple-library-or-helper',
      'complex-service-or-platform',
      'likely-material-unknown',
    ] as const)
      if (
        !members.some((candidate) => candidate.selectionLabels.includes(label))
      )
        diagnostics.push(
          issue(
            'cohort.family-coverage',
            'Every family must cover each required adoption challenge.',
            family,
          ),
        );
  }
  if (
    countStatus(candidates, 'negative-control') !== 5 ||
    countStatus(candidates, 'archived') !== 3 ||
    countStatus(candidates, 'moved') !== 2
  )
    diagnostics.push(
      issue(
        'cohort.lifecycle-count',
        'Cohort lifecycle counts must match amended authority.',
        'candidates',
      ),
    );
  if (
    countLabel(candidates, 'rich-additional-documentation') !== 12 ||
    countLabel(candidates, 'readme-only') !== 18
  )
    diagnostics.push(
      issue(
        'cohort.documentation-count',
        'Cohort documentation-scope counts must match amended authority.',
        'candidates',
      ),
    );
  validateCalibration(diagnostics, candidates);
  return finalize(diagnostics);
}

function validateCalibration(
  diagnostics: RepositoryInterviewEvaluationDiagnostic[],
  candidates: readonly RepositoryInterviewEvaluationCandidateV1[],
): void {
  const calibration = candidates
    .filter(({ calibrationMember }) => calibrationMember)
    .sort(
      (left, right) =>
        (left.calibrationOrdinal ?? 99) - (right.calibrationOrdinal ?? 99),
    );
  if (
    !sameArray(
      calibration.map(({ candidateId }) => candidateId),
      REQUIRED_REPOSITORY_INTERVIEW_CALIBRATION,
    ) ||
    !sameArray(
      calibration.map(({ calibrationOrdinal }) => calibrationOrdinal),
      [0, 1, 2, 3, 4, 5],
    )
  )
    diagnostics.push(
      issue(
        'cohort.calibration-membership',
        'Calibration membership and ordinals must match amended authority.',
        'candidates',
      ),
    );
  const counts = new Map<string, number>();
  for (const candidate of calibration)
    counts.set(
      candidate.capabilityFamily,
      (counts.get(candidate.capabilityFamily) ?? 0) + 1,
    );
  if (counts.size !== 5 || [...counts.values()].some((count) => count > 2))
    diagnostics.push(
      issue(
        'cohort.calibration-family',
        'Calibration must preserve reviewed family diversity.',
        'candidates',
      ),
    );
  const requiredLabels = [
    'archived-lifecycle',
    'negative-control',
    'readme-only',
    'simple-library-or-helper',
    'rich-additional-documentation',
    'complex-service-or-platform',
    'likely-material-unknown',
  ] as const;
  if (
    requiredLabels.some(
      (label) =>
        !calibration.some((candidate) =>
          candidate.selectionLabels.includes(label),
        ),
    )
  )
    diagnostics.push(
      issue(
        'cohort.calibration-challenge',
        'Calibration must preserve reviewed challenge diversity.',
        'candidates',
      ),
    );
}

function validateManifest(
  diagnostics: RepositoryInterviewEvaluationDiagnostic[],
  manifest: RepositoryInterviewEvaluationManifestV1,
  catalogDigest: string,
  artifactDigest: string,
): void {
  if (
    stableJson(manifest.authority) !==
      stableJson(REPOSITORY_INTERVIEW_EVALUATION_AUTHORITY) ||
    catalogDigest !== manifest.authority.catalogDigest ||
    artifactDigest !== manifest.authority.artifactManifestDigest
  )
    diagnostics.push(
      issue(
        'manifest.authority',
        'Manifest authority bindings must match committed authority.',
        'manifest.json',
      ),
    );
  const { corpusDigest: ignored, ...withoutDigest } = manifest;
  void ignored;
  if (
    repositoryInterviewEvaluationCorpusDigestV1(withoutDigest) !==
    manifest.corpusDigest
  )
    diagnostics.push(
      issue(
        'manifest.corpus-digest',
        'Corpus digest must match canonical manifest authority.',
        'manifest.json',
      ),
    );
}

function validateFixtures(
  diagnostics: RepositoryInterviewEvaluationDiagnostic[],
  fixtures: readonly RepositoryInterviewAdversarialFixtureV1[],
): void {
  const ids = fixtures.map(({ fixtureId }) => fixtureId);
  if (
    !sameSet(ids, REQUIRED_REPOSITORY_INTERVIEW_ADVERSARIAL_FIXTURE_IDS) ||
    ids.length !== 12
  )
    diagnostics.push(
      issue(
        'adversarial.membership',
        'Adversarial fixtures must match exact synthetic authority.',
        'adversarial',
      ),
    );
  for (const fixture of fixtures) {
    if (
      fixture.syntheticArtifacts.some(({ lines }) =>
        lines.some((line) =>
          /(?:audit-|auth-|jobs-|rate-|webhook-)(?:vector|winston|bunyan|warrant|dagster|hookdeck)/u.test(
            line,
          ),
        ),
      )
    )
      diagnostics.push(
        issue(
          'adversarial.synthetic-only',
          'Adversarial fixtures must use synthetic-only content.',
          `adversarial/${fixture.fixtureId}`,
        ),
      );
  }
}

function validateGeneratedDrift(
  diagnostics: RepositoryInterviewEvaluationDiagnostic[],
  repositoryRoot: string,
): void {
  for (const asset of buildRepositoryInterviewEvaluationAssetsV1(
    repositoryRoot,
  )) {
    let actual: string;
    try {
      actual = readFileSync(join(repositoryRoot, asset.relativePath), 'utf8');
    } catch {
      diagnostics.push(
        issue(
          'evaluation.missing',
          'Generated evaluation authority file is missing.',
          asset.relativePath,
        ),
      );
      continue;
    }
    if (actual !== asset.text)
      diagnostics.push(
        issue(
          'evaluation.drift',
          'Committed evaluation authority differs from deterministic source.',
          asset.relativePath,
        ),
      );
  }
}

function validateProhibitedFields(
  diagnostics: RepositoryInterviewEvaluationDiagnostic[],
  entries: readonly { readonly path: string; readonly value: unknown }[],
): void {
  const prohibited = new Set([
    'primaryStratum',
    'artifactPath',
    'requestedPath',
    'resolvedPath',
    'artifactId',
    'repositoryText',
    'sourceExcerpt',
    'expectedClaim',
    'expectedLimitation',
    'expectedUnknownText',
    'targetRepository',
    'rankingPreference',
    'promptText',
    'providerOutput',
    'reviewerName',
    'reviewerEmail',
    'reviewerNotes',
  ]);
  for (const entry of entries) {
    const stack = [entry.value];
    while (stack.length > 0) {
      const value = stack.pop();
      if (value === null || typeof value !== 'object') continue;
      for (const [key, child] of Object.entries(value)) {
        if (prohibited.has(key))
          diagnostics.push(
            issue(
              'evaluation.prohibited-field',
              'Evaluation authority contains a prohibited field.',
              entry.path,
            ),
          );
        stack.push(child);
      }
    }
  }
}

function validateStatusLabel(
  diagnostics: RepositoryInterviewEvaluationDiagnostic[],
  candidate: RepositoryInterviewEvaluationCandidateV1,
  status: CatalogCandidateStatus,
  label: RepositoryInterviewEvaluationCandidateV1['selectionLabels'][number],
  path: string,
): void {
  if (
    (candidate.catalogStatus === status) !==
    candidate.selectionLabels.includes(label)
  )
    diagnostics.push(
      issue(
        'cohort.status-label',
        'Lifecycle labels must agree exactly with catalog status.',
        path,
      ),
    );
}

function policyDigest(
  manifest: RepositoryInterviewEvaluationManifestV1,
  path: string,
): string {
  const digest = manifest.policies.find(
    (member) => member.path === path,
  )?.sha256;
  if (digest === undefined)
    throw new Error('Repository-interview evaluation policy is unavailable.');
  return digest;
}

function pushSchema(
  diagnostics: RepositoryInterviewEvaluationDiagnostic[],
  schemaDiagnostics: readonly {
    readonly code: string;
    readonly message: string;
    readonly path: string;
  }[],
  prefix: string,
): void {
  for (const diagnostic of schemaDiagnostics)
    diagnostics.push(
      issue(diagnostic.code, diagnostic.message, `${prefix}${diagnostic.path}`),
    );
}

function countStatus(
  candidates: readonly RepositoryInterviewEvaluationCandidateV1[],
  status: CatalogCandidateStatus,
): number {
  return candidates.filter((candidate) => candidate.catalogStatus === status)
    .length;
}
function countLabel(
  candidates: readonly RepositoryInterviewEvaluationCandidateV1[],
  label: RepositoryInterviewEvaluationCandidateV1['selectionLabels'][number],
): number {
  return candidates.filter((candidate) =>
    candidate.selectionLabels.includes(label),
  ).length;
}
function isSortedUnique(values: readonly string[]): boolean {
  return (
    new Set(values).size === values.length &&
    sameArray(values, [...values].sort(compareText))
  );
}
function sameSet(left: readonly string[], right: readonly string[]): boolean {
  return (
    left.length === right.length &&
    new Set(left).size === left.length &&
    left.every((value) => right.includes(value))
  );
}
function sameArray(
  left: readonly unknown[],
  right: readonly unknown[],
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}
function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
function issue(
  code: string,
  message: string,
  path: string,
): RepositoryInterviewEvaluationDiagnostic {
  return { code, message, path: path.slice(0, 256) };
}
function finalize(
  diagnostics: readonly RepositoryInterviewEvaluationDiagnostic[],
): readonly RepositoryInterviewEvaluationDiagnostic[] {
  return [...diagnostics]
    .sort((left, right) =>
      compareText(`${left.path}\0${left.code}`, `${right.path}\0${right.code}`),
    )
    .slice(0, 20);
}
function failure(
  diagnostics: readonly RepositoryInterviewEvaluationDiagnostic[],
): RepositoryInterviewEvaluationCorpusLoadResultV1 {
  return { ok: false, diagnostics: finalize(diagnostics) };
}
