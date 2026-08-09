import { join } from 'node:path';

import {
  parseCapabilityTaxonomyV1,
  parseDeterministicCandidateProfileAuthorityV1,
} from '@gitblocks/contracts';
import type {
  DeterministicCandidateProfileAuthority,
  DeterministicProfileFieldRecord,
} from '@gitblocks/domain';

import {
  RETRIEVAL_CORPUS_ID,
  RETRIEVAL_FAMILIES,
  RETRIEVAL_V2_VERSIONS,
  RETRIEVAL_VERSIONS,
  type ClarificationGoldDocument,
  type EquivalenceAuthority,
  type HardFilterGoldDocument,
  type NormalizationCaseBundle,
  type NormalizationGoldDocument,
  type NoResultGoldDocument,
  type RelevanceGoldDocument,
  type RetrievalAuthorityVersion,
  type RetrievalCaseBundle,
  type RetrievalCaseClassificationAuthority,
  type RetrievalCorpusManifest,
  type RetrievalDiagnostic,
  type RetrievalManifestFile,
  type RetrievalQueryDocument,
  type RetrievalProvenance,
  type ValidatedRetrievalCorpus,
} from './contracts.ts';
import { generateHardFilterProjection } from './hard-filter.ts';
import {
  hashRetrievalJsonFile,
  listRetrievalJsonFiles,
  loadRetrievalJsonFile,
} from './json-boundary.ts';
import {
  buildCandidateReferenceAuthority,
  normalizeRetrievalQuery,
  projectNormalization,
} from './normalization.ts';
import {
  RETRIEVAL_V2_REVIEWED_GRADE_CORRECTIONS,
  loadRetrievalIndependentReviewRecordV2,
  reviewedRelevanceProvenance,
  type RetrievalIndependentReviewRecordV2,
} from './reviewed-relevance.ts';
import { createRetrievalSchemaRegistry } from './schema-registry.ts';
import {
  retrievalCorpusSemanticDigest,
  retrievalStableJson,
} from './stable-json.ts';
export { retrievalCorpusSemanticDigest } from './stable-json.ts';

const EXPECTED_LISTED_FILE_COUNT = 212;
const EXPECTED_JSON_FILE_COUNT = 213;
const EXPECTED_PROFILE_COUNT = 150;
const EXPECTED_QUERY_INPUT_SCHEMA_DIGEST =
  'd48e018b71f8e6947f60f4d3559c48047daba8a335168b51f37bfb5199c81b9b';
const EXPECTED_NORMALIZATION_SCHEMA_DIGEST =
  'bdd7db9510937c0728f87b0d83f75dbd374555fa17c2b1e4a56399d9f9f2d06b';
const EXPECTED_PROFILE_SCHEMA_DIGEST =
  '3bbfdf2050c13a3d70e9dc289db7c8768a6fdcba8605cf12191e08560387af61';
const EXPECTED_PROFILE_AUTHORITY_SCHEMA_DIGEST =
  '7a79a1671bf461127099e3ae2f75d29e949387987041bd3402f2614b747ed8cf';

export type RetrievalCorpusLoadResult =
  | { readonly ok: true; readonly corpus: ValidatedRetrievalCorpus }
  | {
      readonly ok: false;
      readonly diagnostics: readonly RetrievalDiagnostic[];
    };

export function loadRetrievalCorpusV1(
  repositoryRoot: string,
): RetrievalCorpusLoadResult {
  return loadRetrievalCorpus(repositoryRoot, 'v1');
}

export function loadRetrievalCorpusV2(
  repositoryRoot: string,
): RetrievalCorpusLoadResult {
  return loadRetrievalCorpus(repositoryRoot, 'v2');
}

function loadRetrievalCorpus(
  repositoryRoot: string,
  authorityVersion: RetrievalAuthorityVersion,
): RetrievalCorpusLoadResult {
  try {
    const corpusRoot = join(
      repositoryRoot,
      `evals/retrieval-${authorityVersion}`,
    );
    const registry = createRetrievalSchemaRegistry(
      repositoryRoot,
      authorityVersion,
    );
    const manifestValue = loadRetrievalJsonFile(corpusRoot, 'manifest.json');
    assertSchema(registry, 'manifest', manifestValue, 'manifest.json');
    const manifest = manifestValue as RetrievalCorpusManifest;
    validateManifest(corpusRoot, manifest, authorityVersion);
    const independentReview =
      authorityVersion === 'v2'
        ? loadRetrievalIndependentReviewRecordV2(repositoryRoot)
        : undefined;
    if (
      independentReview !== undefined &&
      (manifest.relevanceReviewVersion !== independentReview.reviewVersion ||
        manifest.relevanceReviewDigest !== independentReview.semanticDigest)
    ) {
      fail('retrieval.manifest.review-binding', 'manifest.json');
    }

    const taxonomyValue = loadRetrievalJsonFile(
      join(repositoryRoot, 'catalog/capability-taxonomy/1.0.0'),
      'manifest.json',
    );
    const taxonomy = parseCapabilityTaxonomyV1(taxonomyValue);
    if (!taxonomy.ok) fail('retrieval.authority.taxonomy', 'taxonomy');
    const profileValue = loadRetrievalJsonFile(
      join(repositoryRoot, 'catalog/public-v1'),
      'candidate-profile-authority.json',
      { maximumFileBytes: 4 * 1024 * 1024 },
    );
    const parsedProfiles =
      parseDeterministicCandidateProfileAuthorityV1(profileValue);
    if (!parsedProfiles.ok) fail('retrieval.authority.profiles', 'profiles');
    const profiles = parsedProfiles.domain;
    validateBindings(manifest, profiles);
    const candidateAuthority = buildCandidateReferenceAuthority(profiles);
    const caseClassification = loadTyped(
      corpusRoot,
      registry,
      'audit/case-classification.json',
      'case-classification',
    ) as RetrievalCaseClassificationAuthority;
    validateCaseClassification(caseClassification, manifest);
    const classificationsByCaseId = new Map(
      caseClassification.entries.map((entry) => [entry.caseId, entry]),
    );
    const equivalence = loadTyped(
      corpusRoot,
      registry,
      'equivalence.json',
      'equivalence',
    ) as EquivalenceAuthority;
    validateEquivalence(equivalence, profiles, manifest);

    const retrievalCases: RetrievalCaseBundle[] = [];
    const normalizationCases: NormalizationCaseBundle[] = [];
    const allProvenance: RetrievalProvenance[] = [
      manifest.provenance,
      caseClassification.provenance,
      ...caseClassification.entries.map(({ provenance }) => provenance),
      equivalence.provenance,
      ...equivalence.groups.flatMap((group) => [group.provenance]),
    ];
    const queryEntries = manifest.files.filter(
      ({ kind }) =>
        kind === 'retrieval-query' || kind === 'normalization-query',
    );
    for (const entry of queryEntries) {
      const query = loadTyped(
        corpusRoot,
        registry,
        entry.path,
        'query',
      ) as RetrievalQueryDocument;
      validateCaseFilename(query, entry);
      const classification = classificationsByCaseId.get(query.caseId);
      if (classification === undefined) {
        fail('retrieval.classification.case-closure', query.caseId);
      }
      const normalizationResult = normalizeRetrievalQuery(
        query,
        taxonomy.value,
        candidateAuthority,
      );
      if (
        query.caseKind === 'retrieval' &&
        (normalizationResult.outcome !== 'normalized' ||
          normalizationResult.primaryFamilyId !== query.capabilityFamily)
      ) {
        fail('retrieval.case.family-assignment', query.caseId);
      }
      const normalizationGold = loadGold(
        corpusRoot,
        registry,
        `gold/normalization/${query.caseId}.json`,
        'normalization-gold',
        query.caseId,
      ) as NormalizationGoldDocument;
      if (
        retrievalStableJson(normalizationGold.expected) !==
        retrievalStableJson(projectNormalization(normalizationResult))
      ) {
        fail('retrieval.gold.normalization-drift', query.caseId);
      }
      allProvenance.push(normalizationGold.provenance);
      if (query.caseKind === 'normalization-adversarial') {
        const clarificationGold = loadGold(
          corpusRoot,
          registry,
          `gold/clarification/${query.caseId}.json`,
          'clarification-gold',
          query.caseId,
        ) as ClarificationGoldDocument;
        validateClarificationGold(clarificationGold, normalizationGold);
        allProvenance.push(clarificationGold.provenance);
        normalizationCases.push({
          query,
          classification,
          normalizationResult,
          normalizationGold,
          clarificationGold,
        });
        continue;
      }
      const hardFilterGold = loadGold(
        corpusRoot,
        registry,
        `gold/hard-filters/${query.caseId}.json`,
        'hard-filter-projection',
        query.caseId,
      ) as HardFilterGoldDocument;
      const generatedProjection = generateHardFilterProjection(
        normalizationResult,
        profiles,
      );
      validateHardFilterGold(
        hardFilterGold,
        generatedProjection,
        profiles,
        manifest,
        query,
      );
      const relevanceGold = loadGold(
        corpusRoot,
        registry,
        `gold/relevance/${query.caseId}.json`,
        'relevance-gold',
        query.caseId,
      ) as RelevanceGoldDocument;
      validateRelevanceGold(
        query,
        relevanceGold,
        generatedProjection,
        profiles,
      );
      const noResultGold = loadGold(
        corpusRoot,
        registry,
        `gold/no-result/${query.caseId}.json`,
        'no-result-gold',
        query.caseId,
      ) as NoResultGoldDocument;
      validateNoResultGold(noResultGold, generatedProjection);
      allProvenance.push(
        hardFilterGold.provenance,
        ...hardFilterGold.auditSample.map(({ provenance }) => provenance),
        relevanceGold.provenance,
        ...relevanceGold.judgments.map(({ provenance }) => provenance),
        noResultGold.provenance,
      );
      retrievalCases.push({
        query,
        classification,
        normalizationResult,
        normalizationGold,
        hardFilterGold,
        generatedProjection,
        relevanceGold,
        noResultGold,
      });
    }
    validateCorpusBalance(retrievalCases, normalizationCases);
    validateRelevanceVariation(retrievalCases, authorityVersion);
    validateProvenance(allProvenance, authorityVersion, independentReview);
    if (authorityVersion === 'v2') {
      validateV2Reconciliation(repositoryRoot, manifest, retrievalCases);
    }
    return {
      ok: true,
      corpus: {
        manifest,
        caseClassification,
        equivalence,
        retrievalCases,
        normalizationCases,
        allProvenance,
        candidateIds: profiles.profiles.map(({ candidateId }) => candidateId),
        conceptIds: taxonomy.value.concepts.map(({ conceptId }) => conceptId),
      },
    };
  } catch (error) {
    const diagnostic =
      error instanceof RetrievalCorpusError
        ? error.diagnostic
        : {
            code: 'retrieval.corpus.invalid',
            path: '',
            message:
              error instanceof Error
                ? error.message.slice(0, 500)
                : 'Retrieval corpus validation failed.',
          };
    return { ok: false, diagnostics: [diagnostic] };
  }
}

class RetrievalCorpusError extends Error {
  readonly diagnostic: RetrievalDiagnostic;

  constructor(diagnostic: RetrievalDiagnostic) {
    super(diagnostic.message);
    this.diagnostic = diagnostic;
  }
}

function fail(code: string, path: string): never {
  throw new RetrievalCorpusError({
    code,
    path: path.slice(0, 256),
    message: 'Retrieval corpus authority is inconsistent.',
  });
}

function assertSchema(
  registry: ReturnType<typeof createRetrievalSchemaRegistry>,
  schema: Parameters<typeof registry.validate>[0],
  value: unknown,
  path: string,
): void {
  const diagnostics = registry.validate(schema, value);
  if (diagnostics.length > 0)
    fail(diagnostics[0]?.code ?? 'retrieval.schema', path);
}

function loadTyped(
  root: string,
  registry: ReturnType<typeof createRetrievalSchemaRegistry>,
  path: string,
  schema: Parameters<typeof registry.validate>[0],
): unknown {
  const value = loadRetrievalJsonFile(root, path);
  assertSchema(registry, schema, value, path);
  return value;
}

function loadGold(
  root: string,
  registry: ReturnType<typeof createRetrievalSchemaRegistry>,
  path: string,
  schema: Parameters<typeof registry.validate>[0],
  caseId: string,
): { readonly caseId: string } {
  const value = loadTyped(root, registry, path, schema) as {
    readonly caseId: string;
  };
  if (value.caseId !== caseId) fail('retrieval.case.binding', path);
  return value;
}

function validateManifest(
  root: string,
  manifest: RetrievalCorpusManifest,
  authorityVersion: RetrievalAuthorityVersion,
): void {
  const corpusId: unknown = manifest.corpusId;
  const corpusVersion: unknown = manifest.corpusVersion;
  const expectedCorpusId =
    authorityVersion === 'v1'
      ? RETRIEVAL_CORPUS_ID
      : RETRIEVAL_V2_VERSIONS.corpusId;
  const expectedCorpusVersion =
    authorityVersion === 'v1'
      ? RETRIEVAL_VERSIONS.corpus
      : RETRIEVAL_V2_VERSIONS.corpus;
  if (
    corpusId !== expectedCorpusId ||
    corpusVersion !== expectedCorpusVersion ||
    manifest.files.length !== EXPECTED_LISTED_FILE_COUNT
  ) {
    fail('retrieval.manifest.identity', 'manifest.json');
  }
  const paths = manifest.files.map(({ path }) => path);
  if (!isSortedUnique(paths))
    fail('retrieval.manifest.order', 'manifest.files');
  const actual = listRetrievalJsonFiles(root, {
    maximumFiles: EXPECTED_JSON_FILE_COUNT,
  });
  if (
    actual.length !== EXPECTED_JSON_FILE_COUNT ||
    retrievalStableJson(actual.map(({ path }) => path)) !==
      retrievalStableJson(['manifest.json', ...paths].sort(compareText))
  ) {
    fail('retrieval.manifest.membership', 'manifest.files');
  }
  for (const entry of manifest.files) {
    validateManifestEntry(entry);
    if (hashRetrievalJsonFile(root, entry.path) !== entry.sha256) {
      fail('retrieval.manifest.hash', entry.path);
    }
  }
  const expectedKindCounts: Readonly<
    Record<RetrievalManifestFile['kind'], number>
  > = {
    'case-classification': 1,
    'clarification-gold': 20,
    equivalence: 1,
    'hard-filter-gold': 30,
    'normalization-gold': 50,
    'no-result-gold': 30,
    'normalization-query': 20,
    'relevance-gold': 30,
    'retrieval-query': 30,
  };
  for (const [kind, count] of Object.entries(expectedKindCounts)) {
    if (
      manifest.files.filter((entry) => entry.kind === kind).length !== count
    ) {
      fail('retrieval.manifest.kind-count', kind);
    }
  }
  if (
    retrievalCorpusSemanticDigest(manifest) !== manifest.corpusSemanticDigest
  ) {
    fail('retrieval.manifest.semantic-digest', 'manifest.corpusSemanticDigest');
  }
}

function validateManifestEntry(entry: RetrievalManifestFile): void {
  const expectedPrefix: Record<RetrievalManifestFile['kind'], string> = {
    'case-classification': 'audit/case-classification.json',
    'clarification-gold': 'gold/clarification/',
    equivalence: 'equivalence.json',
    'hard-filter-gold': 'gold/hard-filters/',
    'normalization-gold': 'gold/normalization/',
    'no-result-gold': 'gold/no-result/',
    'normalization-query': 'queries/normalization/',
    'relevance-gold': 'gold/relevance/',
    'retrieval-query': 'queries/retrieval/',
  };
  const corpusLevelKind =
    entry.kind === 'equivalence' || entry.kind === 'case-classification';
  if (
    (corpusLevelKind &&
      (entry.path !== expectedPrefix[entry.kind] || entry.caseId !== null)) ||
    (!corpusLevelKind &&
      (!entry.path.startsWith(expectedPrefix[entry.kind]) ||
        entry.caseId === null))
  ) {
    fail('retrieval.manifest.directory', entry.path);
  }
  if (
    entry.caseId !== null &&
    entry.path.slice(entry.path.lastIndexOf('/') + 1) !== `${entry.caseId}.json`
  ) {
    fail('retrieval.manifest.case-filename', entry.path);
  }
}

function validateCaseClassification(
  authority: RetrievalCaseClassificationAuthority,
  manifest: RetrievalCorpusManifest,
): void {
  const classificationVersion: unknown = authority.classificationVersion;
  const manifestCaseIds = manifest.files
    .filter(
      ({ kind }) =>
        kind === 'retrieval-query' || kind === 'normalization-query',
    )
    .map(({ caseId }) => caseId)
    .filter((caseId): caseId is string => caseId !== null);
  const authorityCaseIds = authority.entries.map(({ caseId }) => caseId);
  if (
    classificationVersion !== RETRIEVAL_VERSIONS.caseClassification ||
    authority.entries.length !== 50 ||
    !isSortedUnique(authorityCaseIds) ||
    retrievalStableJson(authorityCaseIds) !==
      retrievalStableJson(manifestCaseIds)
  ) {
    fail(
      'retrieval.classification.case-closure',
      'audit/case-classification.json',
    );
  }
  for (const entry of authority.entries) {
    const suffix = Number(entry.caseId.slice(-2));
    const expectedSlot = entry.caseId.startsWith('ret-')
      ? (
          [
            'retrieval-exact-family',
            'retrieval-active-alias',
            'retrieval-narrower-intent',
            'retrieval-candidate-comparison',
            'retrieval-hard-constraint',
            'retrieval-negative-control',
          ] as const
        )[suffix - 1]
      : (
          [
            'normalization-alias',
            'normalization-ambiguity',
            'normalization-contradiction',
            'normalization-adversarial-special',
          ] as const
        )[suffix - 1];
    if (
      expectedSlot === undefined ||
      entry.slotId !== expectedSlot ||
      !isSortedUnique(entry.classifications)
    ) {
      fail('retrieval.classification.order', entry.caseId);
    }
  }
}

function validateBindings(
  manifest: RetrievalCorpusManifest,
  profiles: DeterministicCandidateProfileAuthority,
): void {
  if (
    profiles.profiles.length !== EXPECTED_PROFILE_COUNT ||
    manifest.queryInputSchemaDigest !== EXPECTED_QUERY_INPUT_SCHEMA_DIGEST ||
    manifest.normalizationResultSchemaDigest !==
      EXPECTED_NORMALIZATION_SCHEMA_DIGEST ||
    manifest.profileSchemaDigest !== EXPECTED_PROFILE_SCHEMA_DIGEST ||
    manifest.profileAuthoritySchemaDigest !==
      EXPECTED_PROFILE_AUTHORITY_SCHEMA_DIGEST ||
    manifest.taxonomyVersion !== profiles.taxonomyVersion ||
    manifest.taxonomyDigest !== profiles.taxonomySemanticDigest ||
    manifest.catalogVersion !== profiles.catalogVersion ||
    manifest.catalogDigest !== profiles.catalogDigest ||
    manifest.profileAuthorityVersion !== profiles.authorityVersion ||
    manifest.profileAuthorityDigest !== profiles.semanticAuthorityDigest
  ) {
    fail('retrieval.manifest.authority-binding', 'manifest.json');
  }
}

function validateCaseFilename(
  query: RetrievalQueryDocument,
  entry: RetrievalManifestFile,
): void {
  if (
    entry.caseId !== query.caseId ||
    !entry.path.endsWith(`/${query.caseId}.json`) ||
    (query.caseKind === 'retrieval') !== (entry.kind === 'retrieval-query')
  ) {
    fail('retrieval.case.filename', entry.path);
  }
}

function validateClarificationGold(
  gold: ClarificationGoldDocument,
  normalization: NormalizationGoldDocument,
): void {
  const expectedRequired =
    normalization.expected.outcome === 'clarification-required';
  if (
    gold.clarificationRequired !== expectedRequired ||
    gold.terminalUnsupported !==
      (normalization.expected.outcome === 'unsupported') ||
    retrievalStableJson(gold.clarifications) !==
      retrievalStableJson(normalization.expected.clarifications)
  ) {
    fail('retrieval.gold.clarification-drift', gold.caseId);
  }
}

function validateHardFilterGold(
  gold: HardFilterGoldDocument,
  generated: ReturnType<typeof generateHardFilterProjection>,
  profiles: DeterministicCandidateProfileAuthority,
  manifest: RetrievalCorpusManifest,
  query: RetrievalQueryDocument,
): void {
  if (
    gold.projectionDigest !== generated.digest ||
    retrievalStableJson(gold.hardStateCounts) !==
      retrievalStableJson(generated.hardStateCounts) ||
    retrievalStableJson(gold.laneCounts) !==
      retrievalStableJson(generated.laneCounts) ||
    gold.profileAuthorityVersion !== profiles.authorityVersion ||
    gold.profileAuthorityDigest !== profiles.semanticAuthorityDigest ||
    gold.taxonomyVersion !== manifest.taxonomyVersion ||
    gold.taxonomyDigest !== manifest.taxonomyDigest ||
    gold.catalogVersion !== manifest.catalogVersion ||
    gold.catalogDigest !== manifest.catalogDigest
  ) {
    fail('retrieval.gold.hard-filter-drift', gold.caseId);
  }
  const decisions = new Map(
    generated.decisions.map((value) => [value.candidateId, value]),
  );
  const roles = new Set(gold.auditSample.map(({ sampleRole }) => sampleRole));
  if (!isSortedUnique(gold.auditSample.map(({ sampleRole }) => sampleRole))) {
    fail('retrieval.gold.audit-order', gold.caseId);
  }
  if (
    !isSortedUnique(
      gold.auditSample.map(({ candidateId }) => candidateId).sort(compareText),
    )
  ) {
    fail('retrieval.gold.audit-candidate-uniqueness', gold.caseId);
  }
  const profilesByCandidateId = new Map(
    profiles.profiles.map((profile) => [profile.candidateId, profile]),
  );
  const reasonByRole = {
    'cross-family': 'generated-cross-family',
    eligible: 'generated-eligible-lane',
    'evidence-needed': 'generated-evidence-needed-lane',
    'hard-conflict': 'generated-hard-conflict',
    'negative-control': 'catalog-negative-control-exclusion',
  } as const;
  for (const sample of gold.auditSample) {
    const expected = decisions.get(sample.candidateId);
    const profile = profilesByCandidateId.get(sample.candidateId);
    const family = profile?.fields.find(
      (field) => field.fieldId === 'capability-family',
    ) as DeterministicProfileFieldRecord<'capability-family'> | undefined;
    const roleValid =
      (sample.sampleRole === 'eligible' &&
        expected?.lane === 'eligible' &&
        expected.hardState === 'satisfied' &&
        !expected.negativeControl) ||
      (sample.sampleRole === 'evidence-needed' &&
        expected?.lane === 'evidence-needed' &&
        expected.hardState === 'unresolved' &&
        !expected.negativeControl) ||
      (sample.sampleRole === 'hard-conflict' &&
        expected?.hardState === 'conflict') ||
      (sample.sampleRole === 'negative-control' &&
        expected?.negativeControl === true &&
        expected.lane === 'excluded') ||
      (sample.sampleRole === 'cross-family' &&
        family?.state === 'known' &&
        family.value.primaryFamily !== query.capabilityFamily);
    if (
      sample.hardState !== expected?.hardState ||
      sample.lane !== expected.lane ||
      sample.reasonCode !== reasonByRole[sample.sampleRole] ||
      !roleValid
    ) {
      fail('retrieval.gold.audit-sample', gold.caseId);
    }
  }
  for (const [state, count] of Object.entries(generated.hardStateCounts)) {
    if (
      count > 0 &&
      !roles.has(
        state === 'conflict'
          ? 'hard-conflict'
          : state === 'unresolved'
            ? 'evidence-needed'
            : 'eligible',
      )
    ) {
      fail('retrieval.gold.audit-coverage', gold.caseId);
    }
  }
  if (!roles.has('negative-control') || !roles.has('cross-family')) {
    fail('retrieval.gold.audit-coverage', gold.caseId);
  }
}

function validateRelevanceGold(
  query: RetrievalQueryDocument,
  gold: RelevanceGoldDocument,
  generated: ReturnType<typeof generateHardFilterProjection>,
  profiles: DeterministicCandidateProfileAuthority,
): void {
  const universe = profiles.profiles
    .filter((profile) => {
      const family = profile.fields.find(
        (field) => field.fieldId === 'capability-family',
      ) as DeterministicProfileFieldRecord<'capability-family'> | undefined;
      const status = profile.fields.find(
        (field) => field.fieldId === 'catalog-role-status',
      ) as DeterministicProfileFieldRecord<'catalog-role-status'> | undefined;
      return (
        family?.state === 'known' &&
        status?.state === 'known' &&
        status.value.catalogStatus !== 'negative-control' &&
        (family.value.primaryFamily === query.capabilityFamily ||
          family.value.additionalFamilies.includes(query.capabilityFamily))
      );
    })
    .map(({ candidateId }) => candidateId);
  if (
    !isSortedUnique(gold.judgments.map(({ candidateId }) => candidateId)) ||
    retrievalStableJson(
      gold.judgments.map(({ candidateId }) => candidateId),
    ) !== retrievalStableJson(universe)
  ) {
    fail('retrieval.gold.relevance-universe', gold.caseId);
  }
  const state = new Map(
    generated.decisions.map((value) => [value.candidateId, value]),
  );
  const eligibleRelevant = gold.judgments.filter(
    ({ candidateId, grade }) =>
      grade > 0 && state.get(candidateId)?.lane === 'eligible',
  ).length;
  const noResult = generated.laneCounts.eligible === 0;
  if (!noResult && eligibleRelevant === 0) {
    fail('retrieval.gold.positive-denominator', gold.caseId);
  }
}

function validateNoResultGold(
  gold: NoResultGoldDocument,
  generated: ReturnType<typeof generateHardFilterProjection>,
): void {
  const expected =
    generated.laneCounts.eligible === 0
      ? 'no-eligible-candidate'
      : 'eligible-candidates-present';
  if (
    gold.expectedOutcome !== expected ||
    gold.eligibleCount !== generated.laneCounts.eligible ||
    gold.evidenceNeededCount !== generated.laneCounts['evidence-needed'] ||
    gold.excludedCount !== generated.laneCounts.excluded
  ) {
    fail('retrieval.gold.no-result-drift', gold.caseId);
  }
}

function validateRelevanceVariation(
  cases: readonly RetrievalCaseBundle[],
  authorityVersion: RetrievalAuthorityVersion,
): void {
  if (
    cases
      .flatMap(({ relevanceGold }) => relevanceGold.judgments)
      .every(({ grade }) => grade > 0)
  ) {
    fail('retrieval.gold.relevance-degenerate', 'gold/relevance');
  }
  for (const family of RETRIEVAL_FAMILIES) {
    const familyCases = cases.filter(
      ({ query }) => query.capabilityFamily === family,
    );
    const vectors = new Set(
      familyCases.map(({ relevanceGold }) =>
        retrievalStableJson(
          relevanceGold.judgments.map(({ candidateId, grade }) => ({
            candidateId,
            grade,
          })),
        ),
      ),
    );
    if (vectors.size < 3) {
      fail('retrieval.gold.relevance-case-variation', family);
    }
    const fixedGradeThree = familyCases
      .map(
        ({ relevanceGold }) =>
          new Set(
            relevanceGold.judgments
              .filter(({ grade }) => grade === 3)
              .map(({ candidateId }) => candidateId),
          ),
      )
      .reduce(
        (intersection, values) =>
          new Set(
            [...intersection].filter((candidateId) => values.has(candidateId)),
          ),
      );
    if (fixedGradeThree.size > 0) {
      fail('retrieval.gold.relevance-fixed-anchor', family);
    }
    const narrower = familyCases.find(
      ({ classification }) =>
        classification.slotId === 'retrieval-narrower-intent',
    );
    if (
      narrower === undefined ||
      new Set(narrower.relevanceGold.judgments.map(({ grade }) => grade)).size <
        3 ||
      (authorityVersion === 'v1' &&
        !narrower.relevanceGold.judgments.some(({ grade }) => grade === 0))
    ) {
      fail('retrieval.gold.relevance-narrower-differentiation', family);
    }
    const comparison = familyCases.find(
      ({ classification }) =>
        classification.slotId === 'retrieval-candidate-comparison',
    );
    const named = new Set(
      comparison?.query.queryInput.candidateReferences.map(({ value }) =>
        value.toLowerCase(),
      ) ?? [],
    );
    if (
      comparison === undefined ||
      comparison.relevanceGold.judgments.some(
        ({ candidateId, grade }) => grade === 3 && !named.has(candidateId),
      )
    ) {
      fail('retrieval.gold.relevance-comparison-anchor', family);
    }
  }
}

function validateEquivalence(
  authority: EquivalenceAuthority,
  profiles: DeterministicCandidateProfileAuthority,
  manifest: RetrievalCorpusManifest,
): void {
  if (
    authority.catalogVersion !== manifest.catalogVersion ||
    authority.catalogDigest !== manifest.catalogDigest ||
    authority.groups.length > 100 ||
    !isSortedUnique(authority.groups.map(({ groupId }) => groupId))
  )
    fail('retrieval.equivalence.identity', 'equivalence.json');
  const candidateIds = new Set(
    profiles.profiles.map(({ candidateId }) => candidateId),
  );
  const seen = new Set<string>();
  for (const group of authority.groups) {
    if (
      group.candidateIds.length < 2 ||
      group.candidateIds.length > 20 ||
      !isSortedUnique(group.candidateIds)
    ) {
      fail('retrieval.equivalence.group', group.groupId);
    }
    for (const candidateId of group.candidateIds) {
      if (!candidateIds.has(candidateId) || seen.has(candidateId)) {
        fail('retrieval.equivalence.member', group.groupId);
      }
      seen.add(candidateId);
    }
  }
}

function validateCorpusBalance(
  retrievalCases: readonly RetrievalCaseBundle[],
  normalizationCases: readonly NormalizationCaseBundle[],
): void {
  if (retrievalCases.length !== 30 || normalizationCases.length !== 20) {
    fail('retrieval.balance.split', 'manifest.caseCounts');
  }
  const caseIds = [...retrievalCases, ...normalizationCases]
    .map(({ query }) => query.caseId)
    .sort(compareText);
  if (!isSortedUnique(caseIds)) {
    fail('retrieval.balance.case-id', 'queries');
  }
  if (
    !isSortedUnique(retrievalCases.map(({ query }) => query.caseId)) ||
    !isSortedUnique(normalizationCases.map(({ query }) => query.caseId))
  ) {
    fail('retrieval.balance.case-order', 'queries');
  }
  for (const family of RETRIEVAL_FAMILIES) {
    const familyRetrieval = retrievalCases.filter(
      ({ query }) => query.capabilityFamily === family,
    );
    const familyNormalization = normalizationCases.filter(
      ({ query }) => query.capabilityFamily === family,
    );
    if (familyRetrieval.length !== 6 || familyNormalization.length !== 4) {
      fail('retrieval.balance.family', family);
    }
    for (const slotId of [
      'retrieval-exact-family',
      'retrieval-active-alias',
      'retrieval-narrower-intent',
      'retrieval-candidate-comparison',
      'retrieval-hard-constraint',
      'retrieval-negative-control',
    ] as const) {
      if (
        familyRetrieval.filter(
          ({ classification }) => classification.slotId === slotId,
        ).length !== 1
      ) {
        fail('retrieval.balance.family-slot', family);
      }
    }
    for (const tag of [
      'alias-evaluation',
      'intentional-ambiguity',
      'required-prohibited-conflict',
    ] as const) {
      if (
        !familyNormalization.some(({ classification }) =>
          classification.classifications.includes(tag),
        )
      ) {
        fail('retrieval.balance.family-slot', family);
      }
    }
  }
  const retrievalTags = new Set(
    retrievalCases.flatMap(
      ({ classification }) => classification.classifications,
    ),
  );
  for (const tag of [
    'required-constraint',
    'preferred-constraint',
    'prohibited-constraint',
    'infrastructure-exclusion',
    'deployment-self-hosting',
    'evidence-needed',
    'equivalence-safety',
    'no-eligible-candidate',
  ] as const)
    if (!retrievalTags.has(tag)) fail('retrieval.balance.tag', tag);
  for (const tag of [
    'active-alias',
    'negative-control-safety',
    'required-constraint',
    'preferred-constraint',
    'prohibited-constraint',
    'infrastructure-exclusion',
    'deployment-self-hosting',
    'evidence-needed',
    'no-eligible-candidate',
    'same-family-comparison',
  ] as const) {
    if (countTagged(retrievalCases, tag) !== 5) {
      fail('retrieval.balance.tag-count', tag);
    }
  }
  if (
    countTagged(retrievalCases, 'equivalence-safety') < 5 ||
    countTagged(retrievalCases, 'positive-multiple-relevant') < 10
  ) {
    fail('retrieval.balance.tag-count', 'retrieval-diversity');
  }
  for (const bundle of retrievalCases) {
    const { classification, query } = bundle;
    const modalities = new Set(
      query.queryInput.draftConstraints.map(({ modality }) => modality),
    );
    for (const [tag, modality] of [
      ['required-constraint', 'required'],
      ['preferred-constraint', 'preferred'],
      ['prohibited-constraint', 'prohibited'],
    ] as const) {
      if (
        classification.classifications.includes(tag) &&
        !modalities.has(modality)
      ) {
        fail('retrieval.balance.modality', query.caseId);
      }
    }
    if (
      classification.classifications.includes('infrastructure-exclusion') &&
      !query.queryInput.draftConstraints.some(
        ({ facetHint, modality }) =>
          facetHint === 'infrastructure' && modality === 'prohibited',
      )
    ) {
      fail('retrieval.balance.infrastructure', query.caseId);
    }
    if (
      classification.classifications.includes('deployment-self-hosting') &&
      !query.queryInput.draftConstraints.some(
        ({ facetHint }) => facetHint === 'deployment',
      )
    ) {
      fail('retrieval.balance.deployment', query.caseId);
    }
    if (
      classification.classifications.includes('same-family-comparison') &&
      query.queryInput.candidateReferences.length < 2
    ) {
      fail('retrieval.balance.comparison', query.caseId);
    }
    if (
      classification.classifications.includes('active-alias') &&
      !bundle.normalizationGold.expected.normalizedConcepts.some(
        ({ ruleId }) => ruleId === 'taxonomy-active-alias',
      )
    ) {
      fail('retrieval.balance.alias', query.caseId);
    }
    if (
      classification.classifications.includes('evidence-needed') &&
      bundle.generatedProjection.laneCounts['evidence-needed'] === 0
    ) {
      fail('retrieval.balance.evidence-needed', query.caseId);
    }
    if (
      classification.classifications.includes('negative-control-safety') &&
      !query.queryInput.candidateReferences.some(({ value }) =>
        bundle.generatedProjection.decisions.some(
          ({ candidateId, negativeControl, lane }) =>
            candidateId === value && negativeControl && lane === 'excluded',
        ),
      )
    ) {
      fail('retrieval.balance.negative-control', query.caseId);
    }
  }
  const normalizationTags = new Set(
    normalizationCases.flatMap(
      ({ classification }) => classification.classifications,
    ),
  );
  for (const tag of [
    'alias-evaluation',
    'intentional-ambiguity',
    'required-prohibited-conflict',
    'prohibited-preservation',
    'subjective-lightweight',
    'unsupported-adjacent',
    'unicode-confusable',
    'same-family-comparison',
    'cross-family-comparison',
    'unclear-self-hosting',
    'ambiguous-primary-family',
    'unknown-preferred-nonblocking',
    'unknown-hard-blocking',
    'summary-inert',
  ] as const)
    if (!normalizationTags.has(tag)) fail('retrieval.balance.tag', tag);
  const noResults = retrievalCases.filter(
    ({ noResultGold }) =>
      noResultGold.expectedOutcome === 'no-eligible-candidate',
  );
  if (noResults.length !== 5) {
    fail('retrieval.balance.no-result-count', 'gold/no-result');
  }
  for (const family of RETRIEVAL_FAMILIES) {
    if (!noResults.some(({ query }) => query.capabilityFamily === family)) {
      fail('retrieval.balance.no-result-family', family);
    }
    const familyCases = retrievalCases.filter(
      ({ query }) => query.capabilityFamily === family,
    );
    const positiveMultiple = familyCases.filter((bundle) => {
      const decisions = new Map(
        bundle.generatedProjection.decisions.map((decision) => [
          decision.candidateId,
          decision,
        ]),
      );
      return (
        bundle.relevanceGold.judgments.filter(
          ({ candidateId, grade }) =>
            grade > 0 && decisions.get(candidateId)?.lane === 'eligible',
        ).length >= 2
      );
    });
    if (positiveMultiple.length < 2) {
      fail('retrieval.balance.multiple-relevant', family);
    }
    if (
      !familyCases.some((bundle) => {
        const decisions = new Map(
          bundle.generatedProjection.decisions.map((decision) => [
            decision.candidateId,
            decision,
          ]),
        );
        return bundle.relevanceGold.judgments.some(
          ({ candidateId, grade }) =>
            grade > 0 && decisions.get(candidateId)?.lane !== 'eligible',
        );
      })
    ) {
      fail('retrieval.balance.relevance-eligibility', family);
    }
  }
}

function countTagged(
  cases: readonly RetrievalCaseBundle[],
  tag: RetrievalCaseBundle['classification']['classifications'][number],
): number {
  return cases.filter(({ classification }) =>
    classification.classifications.includes(tag),
  ).length;
}

function validateProvenance(
  values: readonly unknown[],
  authorityVersion: RetrievalAuthorityVersion,
  independentReview: RetrievalIndependentReviewRecordV2 | undefined,
): void {
  const expectedReviewed =
    independentReview === undefined
      ? undefined
      : reviewedRelevanceProvenance(independentReview);
  let reviewed = 0;
  for (const value of values) {
    if (isProposedProvenance(value)) continue;
    if (
      authorityVersion === 'v2' &&
      expectedReviewed !== undefined &&
      retrievalStableJson(value) === retrievalStableJson(expectedReviewed)
    ) {
      reviewed += 1;
      continue;
    }
    fail('retrieval.provenance', 'provenance');
  }
  if (
    (authorityVersion === 'v1' && reviewed !== 0) ||
    (authorityVersion === 'v2' && reviewed !== 666)
  ) {
    fail('retrieval.provenance', 'provenance');
  }
}

function isProposedProvenance(value: unknown): boolean {
  return (
    isRecord(value) &&
    value['status'] === 'proposed' &&
    value['reviewStatus'] === 'not-reviewed' &&
    value['reviewer'] === null &&
    value['reviewedAt'] === null &&
    value['reviewReference'] === null
  );
}

function validateV2Reconciliation(
  repositoryRoot: string,
  manifest: RetrievalCorpusManifest,
  cases: readonly RetrievalCaseBundle[],
): void {
  const v1Root = join(repositoryRoot, 'evals/retrieval-v1');
  const v1Manifest = loadRetrievalJsonFile(
    v1Root,
    'manifest.json',
  ) as RetrievalCorpusManifest;
  if (
    v1Manifest.corpusId !== RETRIEVAL_CORPUS_ID ||
    v1Manifest.corpusVersion !== RETRIEVAL_VERSIONS.corpus ||
    v1Manifest.corpusSemanticDigest !==
      '3638596a5c330c3516003beab908b0b5631c84f41d957f78ce2cc1379cc682de'
  ) {
    fail('retrieval.v2.source-binding', 'evals/retrieval-v1/manifest.json');
  }
  const v1ByPath = new Map(
    v1Manifest.files.map((entry) => [entry.path, entry]),
  );
  for (const entry of manifest.files) {
    if (
      entry.kind !== 'relevance-gold' &&
      entry.sha256 !== v1ByPath.get(entry.path)?.sha256
    ) {
      fail('retrieval.v2.unchanged-authority', entry.path);
    }
  }

  const corrections = new Map(
    RETRIEVAL_V2_REVIEWED_GRADE_CORRECTIONS.map((correction) => [
      `${correction.caseId}\0${correction.candidateId}`,
      correction,
    ]),
  );
  const observedCorrections = new Set<string>();
  const gradeCounts = [0, 0, 0, 0];
  for (const bundle of cases) {
    const caseId = bundle.query.caseId;
    const v1 = loadRetrievalJsonFile(
      v1Root,
      `gold/relevance/${caseId}.json`,
    ) as RelevanceGoldDocument;
    if (v1.judgments.length !== bundle.relevanceGold.judgments.length) {
      fail('retrieval.v2.relevance-key-closure', caseId);
    }
    const v1ByCandidate = new Map(
      v1.judgments.map((judgment) => [judgment.candidateId, judgment]),
    );
    for (const judgment of bundle.relevanceGold.judgments) {
      const source = v1ByCandidate.get(judgment.candidateId);
      if (source === undefined) {
        fail('retrieval.v2.relevance-key-closure', caseId);
      }
      gradeCounts[judgment.grade] = (gradeCounts[judgment.grade] ?? 0) + 1;
      const key = `${caseId}\0${judgment.candidateId}`;
      const correction = corrections.get(key);
      if (correction === undefined) {
        if (
          judgment.grade !== source.grade ||
          retrievalStableJson(judgment.reasonCodes) !==
            retrievalStableJson(source.reasonCodes)
        ) {
          fail('retrieval.v2.unapproved-grade-change', key);
        }
        continue;
      }
      if (
        source.grade !== correction.oldGrade ||
        judgment.grade !== correction.newGrade ||
        retrievalStableJson(judgment.reasonCodes) !==
          retrievalStableJson([correction.reasonCode])
      ) {
        fail('retrieval.v2.reviewed-grade-change', key);
      }
      observedCorrections.add(key);
    }
    if (v1ByCandidate.size !== bundle.relevanceGold.judgments.length) {
      fail('retrieval.v2.relevance-key-closure', caseId);
    }
  }
  if (
    observedCorrections.size !== corrections.size ||
    retrievalStableJson(gradeCounts) !== retrievalStableJson([97, 79, 398, 62])
  ) {
    fail('retrieval.v2.reviewed-grade-closure', 'gold/relevance');
  }
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSortedUnique(values: readonly string[]): boolean {
  return values.every(
    (value, index) => index === 0 || (values[index - 1] ?? '') < value,
  );
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
