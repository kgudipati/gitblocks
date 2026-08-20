import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import {
  createCandidateRetrievalRequestV1,
  createDeterministicCandidateProfileAuthorityV2,
  createDeterministicCandidateProfileV2,
  normalizeCapabilityQueryV1,
  projectDeterministicCandidateProfileAuthorityToEvaluatorV2,
  type CandidateRetrievalAuthorityBindingsV1,
  type CandidateRetrievalMetadataAuthorityV1,
  type CandidateRetrievalRequestV1,
  type CandidateRetrievalResultV1,
  type CapabilityRetrievalExpansionV1,
  type CapabilityTaxonomyV1,
  type DeterministicCandidateProfileAuthorityV2,
} from '@gitblocks/contracts';
import {
  CANDIDATE_CONSTRAINT_EVALUATION_VERSION,
  DETERMINISTIC_CANDIDATE_PROFILE_AUTHORITY_VERSION_V2,
  DETERMINISTIC_CANDIDATE_PROFILE_VERSION_V2,
  DETERMINISTIC_PROFILE_RULES_VERSION_V2,
  DETERMINISTIC_PROFILE_DENOMINATOR_VERSION_V2,
  type DeterministicCandidateProfileAuthority,
  type DeterministicCandidateProfileEvaluatorAuthorityV2,
  type DeterministicProfileConceptAssertionFieldId,
  type DeterministicProfileConceptAssertionV2,
  type DeterministicProfileFieldRecordV2,
} from '@gitblocks/domain';
import {
  createCandidateRetrievalEngineV1,
  type CandidateRetrievalEngineV1,
} from '@gitblocks/retrieval';

import { findGitBlocksRoot } from '../repository-root.ts';
import { loadRetrievalCorpusV1 } from './corpus.ts';
import { loadRetrievalSafeAuthorityV1 } from './safe-authority.ts';
import { retrievalStableJson } from './stable-json.ts';

const WARMUP_COUNT = 100;
const MEASUREMENT_COUNT = 1_000;
const CANDIDATE_LIMIT = 150;
const SEARCH_VIEW_HEAP_LIMIT_BYTES = 16 * 1024 * 1024;
const RETAINED_HEAP_LIMIT_BYTES = 2 * 1024 * 1024;
const TRANSITION_P95_LIMIT_MILLISECONDS = 12.5;
const TRANSITION_MAXIMUM_LIMIT_MILLISECONDS = 20;
const HARD_P95_LIMIT_MILLISECONDS = 20;
const HARD_MAXIMUM_LIMIT_MILLISECONDS = 50;

interface CorpusMeasurement {
  readonly corpus: 'saturated-assertions' | 'transition-v1-projected';
  readonly warmupCount: number;
  readonly measurementCount: number;
  readonly rawSamplesMilliseconds: readonly number[];
  readonly p50Milliseconds: number;
  readonly p95Milliseconds: number;
  readonly maximumMilliseconds: number;
  readonly searchViewHeapBytes: number;
  readonly retainedHeapGrowthBytes: number;
  readonly maximumCandidatesExamined: number;
  readonly maximumCandidatesConstraintEvaluated: number;
  readonly resultDigest: string;
  readonly thresholdsPassed: boolean;
}

interface BenchmarkReport {
  readonly protocol: 'issue-122-frozen-v2-transition';
  readonly nodeVersion: string;
  readonly processId: number;
  readonly createdAt: string;
  readonly candidateCount: number;
  readonly transitionQueryCount: number;
  readonly saturatedConstraintCount: number;
  readonly saturatedFeatureAssertionCount: number;
  readonly saturatedInfrastructureAssertionCount: number;
  readonly limits: {
    readonly transitionP95Milliseconds: number;
    readonly transitionMaximumMilliseconds: number;
    readonly hardP95Milliseconds: number;
    readonly hardMaximumMilliseconds: number;
    readonly searchViewHeapBytes: number;
    readonly retainedHeapGrowthBytes: number;
    readonly maximumCandidatesConstraintEvaluated: number;
  };
  readonly corpora: readonly CorpusMeasurement[];
  readonly serializedResultDigest: string;
  readonly passed: boolean;
}

async function main(): Promise<void> {
  if (process.version !== 'v24.18.0') {
    throw new Error(`Expected Node v24.18.0, received ${process.version}.`);
  }
  if (globalThis.gc === undefined) {
    throw new Error('The V2 benchmark requires node --expose-gc.');
  }
  const outputArgument = process.argv[2];
  if (outputArgument === undefined) {
    throw new Error('Pass the raw benchmark JSON output path.');
  }
  const outputPath = resolve(outputArgument);
  const repositoryRoot = findGitBlocksRoot(process.cwd());
  const safe = loadRetrievalSafeAuthorityV1(repositoryRoot);
  const loadedCorpus = loadRetrievalCorpusV1(repositoryRoot);
  if (!loadedCorpus.ok) {
    throw new Error('The fixed V1 retrieval corpus is invalid.');
  }
  const transitionRequests = loadedCorpus.corpus.retrievalCases.map((bundle) =>
    createRequest(
      bundle.normalizationResult,
      safe.profiles,
      safe.taxonomy,
      safe.expansion,
      safe.metadata,
    ),
  );
  if (
    safe.profiles.profiles.length !== CANDIDATE_LIMIT ||
    transitionRequests.length !== 30
  ) {
    throw new Error('The transition benchmark authority shape changed.');
  }

  const transitionEvaluator =
    projectDeterministicCandidateProfileAuthorityToEvaluatorV2(safe.profiles);
  const transition = measureCorpus({
    corpus: 'transition-v1-projected',
    evaluator: transitionEvaluator,
    requests: transitionRequests,
    taxonomy: safe.taxonomy,
    expansion: safe.expansion,
    metadata: safe.metadata,
    expectedMetadataBinding: safe.expectedMetadataBinding,
  });

  const saturatedAuthority = createSaturatedAuthority(
    safe.profiles,
    safe.taxonomy,
  );
  const saturatedEvaluator =
    projectDeterministicCandidateProfileAuthorityToEvaluatorV2(
      saturatedAuthority,
    );
  const saturatedNormalization = createSaturatedNormalization(safe.taxonomy);
  const saturatedRequest = createRequest(
    saturatedNormalization,
    saturatedAuthority,
    safe.taxonomy,
    safe.expansion,
    safe.metadata,
  );
  const saturated = measureCorpus({
    corpus: 'saturated-assertions',
    evaluator: saturatedEvaluator,
    requests: [saturatedRequest],
    taxonomy: safe.taxonomy,
    expansion: safe.expansion,
    metadata: safe.metadata,
    expectedMetadataBinding: safe.expectedMetadataBinding,
  });

  const featureCount = safe.taxonomy.concepts.filter(
    ({ kind }) => kind === 'feature',
  ).length;
  const infrastructureCount = safe.taxonomy.concepts.filter(
    ({ kind }) => kind === 'infrastructure',
  ).length;
  const serializedResultDigest = digest([
    transition.resultDigest,
    saturated.resultDigest,
  ]);
  const corpora = [transition.measurement, saturated.measurement];
  const report: BenchmarkReport = {
    protocol: 'issue-122-frozen-v2-transition',
    nodeVersion: process.version,
    processId: process.pid,
    createdAt: new Date().toISOString(),
    candidateCount: safe.profiles.profiles.length,
    transitionQueryCount: transitionRequests.length,
    saturatedConstraintCount:
      saturatedNormalization.normalizedConstraints.length,
    saturatedFeatureAssertionCount: featureCount,
    saturatedInfrastructureAssertionCount: infrastructureCount,
    limits: {
      transitionP95Milliseconds: TRANSITION_P95_LIMIT_MILLISECONDS,
      transitionMaximumMilliseconds: TRANSITION_MAXIMUM_LIMIT_MILLISECONDS,
      hardP95Milliseconds: HARD_P95_LIMIT_MILLISECONDS,
      hardMaximumMilliseconds: HARD_MAXIMUM_LIMIT_MILLISECONDS,
      searchViewHeapBytes: SEARCH_VIEW_HEAP_LIMIT_BYTES,
      retainedHeapGrowthBytes: RETAINED_HEAP_LIMIT_BYTES,
      maximumCandidatesConstraintEvaluated: CANDIDATE_LIMIT,
    },
    corpora,
    serializedResultDigest,
    passed: corpora.every(({ thresholdsPassed }) => thresholdsPassed),
  };

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify(reportSummary(report), null, 2)}\n`);
  if (!report.passed) process.exitCode = 1;
}

function measureCorpus(input: {
  readonly corpus: CorpusMeasurement['corpus'];
  readonly evaluator: DeterministicCandidateProfileEvaluatorAuthorityV2;
  readonly requests: readonly CandidateRetrievalRequestV1[];
  readonly taxonomy: unknown;
  readonly expansion: unknown;
  readonly metadata: unknown;
  readonly expectedMetadataBinding: Parameters<
    typeof createCandidateRetrievalEngineV1
  >[0]['expectedCandidateRetrievalMetadataAuthorityBinding'];
}): { readonly measurement: CorpusMeasurement; readonly resultDigest: string } {
  forceGarbageCollection();
  const heapBeforeSearchView = process.memoryUsage().heapUsed;
  const created = createCandidateRetrievalEngineV1({
    taxonomy: input.taxonomy,
    candidateProfileEvaluatorAuthority: input.evaluator,
    retrievalExpansionAuthority: input.expansion,
    candidateRetrievalMetadataAuthority: input.metadata,
    expectedCandidateRetrievalMetadataAuthorityBinding:
      input.expectedMetadataBinding,
  });
  if (!created.ok) throw new Error(`${input.corpus} engine admission failed.`);
  const engine = created.engine;
  forceGarbageCollection();
  const searchViewHeapBytes = Math.max(
    0,
    process.memoryUsage().heapUsed - heapBeforeSearchView,
  );

  const referenceResults = input.requests.map((request) =>
    acceptedResult(engine, request),
  );
  const resultDigest = digest(referenceResults);
  for (let index = 0; index < WARMUP_COUNT; index += 1) {
    acceptedResult(
      engine,
      requiredAt(input.requests, index % input.requests.length),
    );
  }
  forceGarbageCollection();
  const retainedHeapBefore = process.memoryUsage().heapUsed;
  const rawSamplesMilliseconds: number[] = [];
  let maximumCandidatesExamined = 0;
  let maximumCandidatesConstraintEvaluated = 0;
  for (let index = 0; index < MEASUREMENT_COUNT; index += 1) {
    const request = requiredAt(input.requests, index % input.requests.length);
    const started = performance.now();
    const result = acceptedResult(engine, request);
    rawSamplesMilliseconds.push(performance.now() - started);
    maximumCandidatesExamined = Math.max(
      maximumCandidatesExamined,
      result.diagnostics.candidatesExamined,
    );
    maximumCandidatesConstraintEvaluated = Math.max(
      maximumCandidatesConstraintEvaluated,
      result.diagnostics.candidatesConstraintEvaluated,
    );
    const expected = requiredAt(
      referenceResults,
      index % referenceResults.length,
    );
    if (retrievalStableJson(result) !== retrievalStableJson(expected)) {
      throw new Error(
        `${input.corpus} result bytes changed during measurement.`,
      );
    }
  }
  forceGarbageCollection();
  const retainedHeapGrowthBytes = Math.max(
    0,
    process.memoryUsage().heapUsed - retainedHeapBefore,
  );
  const sorted = [...rawSamplesMilliseconds].sort(
    (left, right) => left - right,
  );
  const p50Milliseconds = percentile(sorted, 0.5);
  const p95Milliseconds = percentile(sorted, 0.95);
  const maximumMilliseconds = requiredAt(sorted, sorted.length - 1);
  const corpusSpecificThresholdsPass =
    input.corpus === 'transition-v1-projected'
      ? p95Milliseconds <= TRANSITION_P95_LIMIT_MILLISECONDS &&
        maximumMilliseconds <= TRANSITION_MAXIMUM_LIMIT_MILLISECONDS
      : true;
  const thresholdsPassed =
    corpusSpecificThresholdsPass &&
    p95Milliseconds <= HARD_P95_LIMIT_MILLISECONDS &&
    maximumMilliseconds <= HARD_MAXIMUM_LIMIT_MILLISECONDS &&
    searchViewHeapBytes <= SEARCH_VIEW_HEAP_LIMIT_BYTES &&
    retainedHeapGrowthBytes <= RETAINED_HEAP_LIMIT_BYTES &&
    maximumCandidatesExamined <= CANDIDATE_LIMIT &&
    maximumCandidatesConstraintEvaluated <= CANDIDATE_LIMIT;
  return {
    resultDigest,
    measurement: {
      corpus: input.corpus,
      warmupCount: WARMUP_COUNT,
      measurementCount: MEASUREMENT_COUNT,
      rawSamplesMilliseconds,
      p50Milliseconds,
      p95Milliseconds,
      maximumMilliseconds,
      searchViewHeapBytes,
      retainedHeapGrowthBytes,
      maximumCandidatesExamined,
      maximumCandidatesConstraintEvaluated,
      resultDigest,
      thresholdsPassed,
    },
  };
}

function createSaturatedAuthority(
  v1: DeterministicCandidateProfileAuthority,
  taxonomy: CapabilityTaxonomyV1,
): DeterministicCandidateProfileAuthorityV2 {
  const featureConceptIds = taxonomy.concepts
    .filter(({ kind }) => kind === 'feature')
    .map(({ conceptId }) => conceptId)
    .sort(compareText);
  const infrastructureConceptIds = taxonomy.concepts
    .filter(({ kind }) => kind === 'infrastructure')
    .map(({ conceptId }) => conceptId)
    .sort(compareText);
  if (
    featureConceptIds.length !== 38 ||
    infrastructureConceptIds.length !== 7
  ) {
    throw new Error('The saturated concept fixture denominator changed.');
  }
  const profiles = v1.profiles.map((profile, profileIndex) =>
    createDeterministicCandidateProfileV2({
      contractVersion: '2.0.0',
      profileVersion: DETERMINISTIC_CANDIDATE_PROFILE_VERSION_V2,
      candidateId: profile.candidateId,
      catalogBinding: profile.catalogBinding,
      taxonomyBinding: profile.taxonomyBinding,
      profileRulesVersion: DETERMINISTIC_PROFILE_RULES_VERSION_V2,
      fields: profile.fields.map((field) => {
        if (field.fieldId === 'capability-variants-features') {
          return saturatedField(field.fieldId, featureConceptIds, profileIndex);
        }
        if (
          field.fieldId === 'required-infrastructure' ||
          field.fieldId === 'optional-infrastructure'
        ) {
          return saturatedField(
            field.fieldId,
            infrastructureConceptIds,
            profileIndex +
              (field.fieldId === 'optional-infrastructure' ? 1 : 0),
          );
        }
        return field;
      }) as readonly DeterministicProfileFieldRecordV2[],
    }),
  );
  return createDeterministicCandidateProfileAuthorityV2({
    contractVersion: '2.0.0',
    authorityVersion: DETERMINISTIC_CANDIDATE_PROFILE_AUTHORITY_VERSION_V2,
    denominatorVersion: DETERMINISTIC_PROFILE_DENOMINATOR_VERSION_V2,
    catalogVersion: v1.catalogVersion,
    catalogDigest: v1.catalogDigest,
    taxonomyVersion: v1.taxonomyVersion,
    taxonomySemanticDigest: v1.taxonomySemanticDigest,
    profileRulesVersion: DETERMINISTIC_PROFILE_RULES_VERSION_V2,
    profiles,
  });
}

function saturatedField(
  fieldId: DeterministicProfileConceptAssertionFieldId,
  conceptIds: readonly string[],
  seed: number,
): Extract<
  DeterministicProfileFieldRecordV2,
  { readonly fieldId: DeterministicProfileConceptAssertionFieldId }
> {
  const source = {
    kind: 'structured-collection' as const,
    sourceSnapshotId: 'saturated-assertion-snapshot',
    evidenceIds: ['saturated-assertion-evidence'],
    sourceTopicCodes: ['saturated-assertion-fixture'],
  };
  const assertions = conceptIds.map((conceptId, assertionIndex) => {
    const state = (assertionIndex + seed) % 3;
    if (state === 2) {
      return {
        conceptId,
        state: 'conflict' as const,
        claims: [
          {
            state: 'absent' as const,
            valueExtractionRuleId:
              `extract-${fieldId}-from-structured-authority` as const,
            sourceReferences: [source],
          },
          {
            state: 'present' as const,
            valueExtractionRuleId:
              `extract-${fieldId}-from-structured-authority` as const,
            sourceReferences: [source],
          },
        ],
      } satisfies DeterministicProfileConceptAssertionV2;
    }
    return {
      conceptId,
      state: state === 0 ? ('present' as const) : ('absent' as const),
      valueExtractionRuleId:
        `extract-${fieldId}-from-structured-authority` as const,
      sourceReferences: [source],
    } satisfies DeterministicProfileConceptAssertionV2;
  });
  return {
    fieldId,
    scope:
      fieldId === 'capability-variants-features'
        ? 'candidate-wide'
        : 'version-specific',
    coverage: seed % 2 === 0 ? 'complete' : 'partial',
    stateReasonCode: 'approved-structured-field-value',
    stateRuleId: 'assign-known-approved-structured-value',
    versionScope:
      fieldId === 'capability-variants-features'
        ? null
        : { kind: 'repository-snapshot', snapshotId: 'saturated-scope' },
    sourceReferences: [source],
    assertions,
  };
}

function createSaturatedNormalization(taxonomy: CapabilityTaxonomyV1) {
  const concepts = taxonomy.concepts
    .filter(({ kind }) => kind === 'feature' || kind === 'infrastructure')
    .sort((left, right) => compareText(left.conceptId, right.conceptId))
    .slice(0, 32);
  const normalized = normalizeCapabilityQueryV1(
    {
      contractVersion: '1.0.0',
      queryInputId: 'query-saturated-v2-assertions',
      scope: 'local-pre-approval',
      summary: 'Exercise the saturated V2 concept assertion authority.',
      capabilityTerms: [
        {
          termId: 'term-saturated-capability',
          originalTerm: 'background jobs',
        },
      ],
      successConditions: [
        {
          conditionId: 'condition-saturated-assertions',
          statement: 'All bounded concept assertions are evaluated.',
        },
      ],
      draftConstraints: concepts.map((concept, index) => ({
        constraintId: `constraint-saturated-${String(index + 1).padStart(2, '0')}`,
        modality:
          index % 2 === 0 ? ('required' as const) : ('prohibited' as const),
        statement: `Evaluate the ${concept.conceptId} concept.`,
        originalTerm: concept.conceptId,
        facetHint: concept.kind,
        reasonCode: index % 2 === 0 ? 'user-required' : 'user-prohibited',
      })),
      candidateReferences: [],
      repositoryFingerprintReference: null,
    },
    taxonomy,
  );
  if (
    !normalized.ok ||
    normalized.value.outcome !== 'normalized' ||
    normalized.value.normalizedConstraints.length !== 32 ||
    normalized.value.normalizedConstraints.some(
      ({ resolutionBasis, conceptId }) =>
        resolutionBasis !== 'controlled-taxonomy' || conceptId === null,
    )
  ) {
    throw new Error(
      'The saturated 32-constraint query did not normalize exactly.',
    );
  }
  return normalized.value;
}

function createRequest(
  normalization: Parameters<
    typeof createCandidateRetrievalRequestV1
  >[0]['normalization'],
  profiles:
    | DeterministicCandidateProfileAuthority
    | DeterministicCandidateProfileAuthorityV2,
  taxonomy: CapabilityTaxonomyV1,
  expansion: CapabilityRetrievalExpansionV1,
  metadata: CandidateRetrievalMetadataAuthorityV1,
): CandidateRetrievalRequestV1 {
  const candidateProfiles: CandidateRetrievalAuthorityBindingsV1['candidateProfiles'] =
    profiles.authorityVersion ===
    DETERMINISTIC_CANDIDATE_PROFILE_AUTHORITY_VERSION_V2
      ? {
          authorityVersion: profiles.authorityVersion,
          semanticAuthorityDigest: profiles.semanticAuthorityDigest,
          profileRulesVersion: profiles.profileRulesVersion,
        }
      : {
          authorityVersion: profiles.authorityVersion,
          semanticAuthorityDigest: profiles.semanticAuthorityDigest,
          profileRulesVersion: profiles.profileRulesVersion,
        };
  return createCandidateRetrievalRequestV1({
    normalization,
    authorityBindings: {
      taxonomy: {
        taxonomyVersion: taxonomy.taxonomyVersion,
        taxonomySemanticDigest: taxonomy.semanticDigest,
      },
      candidateProfiles,
      catalog: {
        catalogVersion: profiles.catalogVersion,
        catalogDigest: profiles.catalogDigest,
      },
      candidateConstraintEvaluationVersion:
        CANDIDATE_CONSTRAINT_EVALUATION_VERSION,
      retrievalExpansion: {
        authorityVersion: expansion.expansionVersion,
        semanticDigest: expansion.semanticDigest,
      },
      retrievalMetadata: {
        authorityVersion: metadata.authorityVersion,
        authoritySemanticDigest: metadata.authoritySemanticDigest,
      },
    },
    eligibleResultLimit: 10,
    evidenceNeededResultLimit: 10,
  });
}

function acceptedResult(
  engine: CandidateRetrievalEngineV1,
  request: CandidateRetrievalRequestV1,
): CandidateRetrievalResultV1 {
  const operation = engine.retrieve(request);
  if (!operation.ok) throw new Error('A benchmark retrieval request failed.');
  return operation.result;
}

function percentile(sorted: readonly number[], proportion: number): number {
  return requiredAt(
    sorted,
    Math.max(0, Math.ceil(sorted.length * proportion) - 1),
  );
}

function digest(value: unknown): string {
  return createHash('sha256').update(retrievalStableJson(value)).digest('hex');
}

function forceGarbageCollection(): void {
  globalThis.gc?.();
  globalThis.gc?.();
}

function requiredAt<T>(values: readonly T[], index: number): T {
  const value = values[index];
  if (value === undefined)
    throw new Error('Benchmark fixture entry is missing.');
  return value;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function reportSummary(report: BenchmarkReport): unknown {
  return {
    protocol: report.protocol,
    nodeVersion: report.nodeVersion,
    outputPassed: report.passed,
    serializedResultDigest: report.serializedResultDigest,
    corpora: report.corpora.map((corpus) => ({
      corpus: corpus.corpus,
      p50Milliseconds: corpus.p50Milliseconds,
      p95Milliseconds: corpus.p95Milliseconds,
      maximumMilliseconds: corpus.maximumMilliseconds,
      searchViewHeapBytes: corpus.searchViewHeapBytes,
      retainedHeapGrowthBytes: corpus.retainedHeapGrowthBytes,
      maximumCandidatesConstraintEvaluated:
        corpus.maximumCandidatesConstraintEvaluated,
      thresholdsPassed: corpus.thresholdsPassed,
    })),
  };
}

await main();
