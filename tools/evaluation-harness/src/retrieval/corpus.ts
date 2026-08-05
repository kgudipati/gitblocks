import { join } from 'node:path';

import {
  parseCapabilityTaxonomyV1,
  parseDeterministicCandidateProfileAuthorityV1,
  type DeterministicCandidateProfileAuthority,
  type DeterministicProfileFieldRecord,
} from '@gitblocks/contracts';

import {
  RETRIEVAL_CORPUS_ID,
  RETRIEVAL_FAMILIES,
  RETRIEVAL_VERSIONS,
  type ClarificationGoldDocument,
  type EquivalenceAuthority,
  type HardFilterGoldDocument,
  type NormalizationCaseBundle,
  type NormalizationGoldDocument,
  type NoResultGoldDocument,
  type ProposedProvenance,
  type RelevanceGoldDocument,
  type RetrievalCaseBundle,
  type RetrievalCorpusManifest,
  type RetrievalDiagnostic,
  type RetrievalManifestFile,
  type RetrievalQueryDocument,
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
import { createRetrievalSchemaRegistry } from './schema-registry.ts';
import { retrievalSemanticDigest, retrievalStableJson } from './stable-json.ts';

const EXPECTED_LISTED_FILE_COUNT = 211;
const EXPECTED_JSON_FILE_COUNT = 212;
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

export function retrievalCorpusSemanticDigest(
  manifest:
    | Omit<RetrievalCorpusManifest, 'corpusSemanticDigest'>
    | RetrievalCorpusManifest,
): string {
  const { corpusSemanticDigest, ...projection } =
    manifest as RetrievalCorpusManifest;
  void corpusSemanticDigest;
  return retrievalSemanticDigest(projection);
}

export function loadRetrievalCorpusV1(
  repositoryRoot: string,
): RetrievalCorpusLoadResult {
  try {
    const corpusRoot = join(repositoryRoot, 'evals/retrieval-v1');
    const registry = createRetrievalSchemaRegistry(repositoryRoot);
    const manifestValue = loadRetrievalJsonFile(corpusRoot, 'manifest.json');
    assertSchema(registry, 'manifest', manifestValue, 'manifest.json');
    const manifest = manifestValue as RetrievalCorpusManifest;
    validateManifest(corpusRoot, manifest);

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
    const equivalence = loadTyped(
      corpusRoot,
      registry,
      'equivalence.json',
      'equivalence',
    ) as EquivalenceAuthority;
    validateEquivalence(equivalence, profiles, manifest);

    const retrievalCases: RetrievalCaseBundle[] = [];
    const normalizationCases: NormalizationCaseBundle[] = [];
    const allProvenance: ProposedProvenance[] = [
      manifest.provenance,
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
        normalizationResult,
        normalizationGold,
        hardFilterGold,
        generatedProjection,
        relevanceGold,
        noResultGold,
      });
    }
    validateCorpusBalance(retrievalCases, normalizationCases);
    validateProvenance(allProvenance);
    return {
      ok: true,
      corpus: {
        manifest,
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
): void {
  const corpusId: unknown = manifest.corpusId;
  const corpusVersion: unknown = manifest.corpusVersion;
  if (
    corpusId !== RETRIEVAL_CORPUS_ID ||
    corpusVersion !== RETRIEVAL_VERSIONS.corpus ||
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
    'clarification-gold': 'gold/clarification/',
    equivalence: 'equivalence.json',
    'hard-filter-gold': 'gold/hard-filters/',
    'normalization-gold': 'gold/normalization/',
    'no-result-gold': 'gold/no-result/',
    'normalization-query': 'queries/normalization/',
    'relevance-gold': 'gold/relevance/',
    'retrieval-query': 'queries/retrieval/',
  };
  if (
    (entry.kind === 'equivalence' &&
      (entry.path !== 'equivalence.json' || entry.caseId !== null)) ||
    (entry.kind !== 'equivalence' &&
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
  for (const sample of gold.auditSample) {
    const expected = decisions.get(sample.candidateId);
    if (
      sample.hardState !== expected?.hardState ||
      sample.lane !== expected.lane
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
  if (
    !roles.has('negative-control') ||
    !roles.has('cross-family') ||
    !roles.has('material-edge')
  ) {
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

function validateEquivalence(
  authority: EquivalenceAuthority,
  profiles: DeterministicCandidateProfileAuthority,
  manifest: RetrievalCorpusManifest,
): void {
  if (
    authority.catalogVersion !== manifest.catalogVersion ||
    authority.catalogDigest !== manifest.catalogDigest ||
    authority.groups.length < 5 ||
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
    for (const tag of [
      'slot-exact-family',
      'slot-active-alias',
      'slot-narrower-intent',
      'slot-candidate-comparison',
      'slot-hard-constraint',
      'slot-negative-control',
    ] as const) {
      if (
        familyRetrieval.filter(({ query }) => query.tags.includes(tag))
          .length !== 1
      ) {
        fail('retrieval.balance.family-slot', family);
      }
    }
    for (const tag of [
      'alias-evaluation',
      'intentional-ambiguity',
      'required-prohibited-conflict',
    ] as const) {
      if (!familyNormalization.some(({ query }) => query.tags.includes(tag))) {
        fail('retrieval.balance.family-slot', family);
      }
    }
  }
  const retrievalTags = new Set(
    retrievalCases.flatMap(({ query }) => query.tags),
  );
  for (const tag of [
    'slot-exact-family',
    'slot-active-alias',
    'slot-narrower-intent',
    'slot-candidate-comparison',
    'slot-hard-constraint',
    'slot-negative-control',
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
    const { query } = bundle;
    const modalities = new Set(
      query.queryInput.draftConstraints.map(({ modality }) => modality),
    );
    for (const [tag, modality] of [
      ['required-constraint', 'required'],
      ['preferred-constraint', 'preferred'],
      ['prohibited-constraint', 'prohibited'],
    ] as const) {
      if (query.tags.includes(tag) && !modalities.has(modality)) {
        fail('retrieval.balance.modality', query.caseId);
      }
    }
    if (
      query.tags.includes('infrastructure-exclusion') &&
      !query.queryInput.draftConstraints.some(
        ({ facetHint, modality }) =>
          facetHint === 'infrastructure' && modality === 'prohibited',
      )
    ) {
      fail('retrieval.balance.infrastructure', query.caseId);
    }
    if (
      query.tags.includes('deployment-self-hosting') &&
      !query.queryInput.draftConstraints.some(
        ({ facetHint }) => facetHint === 'deployment',
      )
    ) {
      fail('retrieval.balance.deployment', query.caseId);
    }
    if (
      query.tags.includes('same-family-comparison') &&
      query.queryInput.candidateReferences.length < 2
    ) {
      fail('retrieval.balance.comparison', query.caseId);
    }
    if (
      query.tags.includes('active-alias') &&
      !bundle.normalizationGold.expected.normalizedConcepts.some(
        ({ ruleId }) => ruleId === 'taxonomy-active-alias',
      )
    ) {
      fail('retrieval.balance.alias', query.caseId);
    }
    if (
      query.tags.includes('evidence-needed') &&
      bundle.generatedProjection.laneCounts['evidence-needed'] === 0
    ) {
      fail('retrieval.balance.evidence-needed', query.caseId);
    }
    if (
      query.tags.includes('negative-control-safety') &&
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
    normalizationCases.flatMap(({ query }) => query.tags),
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
  tag: RetrievalCaseBundle['query']['tags'][number],
): number {
  return cases.filter(({ query }) => query.tags.includes(tag)).length;
}

function validateProvenance(values: readonly unknown[]): void {
  if (
    values.some(
      (value) =>
        !isRecord(value) ||
        value['status'] !== 'proposed' ||
        value['reviewStatus'] !== 'not-reviewed' ||
        value['reviewer'] !== null ||
        value['reviewedAt'] !== null ||
        value['reviewReference'] !== null,
    )
  )
    fail('retrieval.provenance', 'provenance');
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
