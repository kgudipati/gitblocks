import { createHash } from 'node:crypto';

import { beforeAll, describe, expect, it } from 'vitest';

import {
  createCandidateRetrievalRequestV1,
  projectDeterministicCandidateProfileAuthorityToEvaluatorV2,
} from '@gitblocks/contracts';
import {
  CANDIDATE_CONSTRAINT_EVALUATION_VERSION,
  evaluateCandidateConstraints,
  evaluateCandidateConstraintsV2,
  type CandidateConstraintEvaluation,
  type DeterministicProfileFieldRecord,
} from '@gitblocks/domain';
import {
  createApprovedMetadataLexicalChannelV1,
  createCandidateRetrievalEngineV1,
  createCandidateSearchView,
  retrieveCandidateSet,
} from '@gitblocks/retrieval';

import { findGitBlocksRoot } from '../src/repository-root.ts';
import { loadRetrievalCorpusV1 } from '../src/retrieval/corpus.ts';
import { loadRetrievalSafeAuthorityV1 } from '../src/retrieval/safe-authority.ts';
import { retrievalStableJson } from '../src/retrieval/stable-json.ts';

interface EquivalenceEvidence {
  readonly decisionsCompared: number;
  readonly perConstraintComparisons: number;
  readonly mismatches: number;
  readonly laneCountMatches: number;
  readonly finalistIdMatches: number;
  readonly responsibleOutcomeClassMatches: number;
  readonly serializedDigest: string;
}

let evidence: EquivalenceEvidence;

beforeAll(() => {
  const root = findGitBlocksRoot(process.cwd());
  const safe = loadRetrievalSafeAuthorityV1(root);
  const loadedCorpus = loadRetrievalCorpusV1(root);
  if (!loadedCorpus.ok) throw new Error('Expected accepted retrieval corpus.');
  const evaluator = projectDeterministicCandidateProfileAuthorityToEvaluatorV2(
    safe.profiles,
  );
  const v2EngineResult = createCandidateRetrievalEngineV1({
    taxonomy: safe.taxonomy,
    candidateProfileEvaluatorAuthority: evaluator,
    retrievalExpansionAuthority: safe.expansion,
    candidateRetrievalMetadataAuthority: safe.metadata,
    expectedCandidateRetrievalMetadataAuthorityBinding:
      safe.expectedMetadataBinding,
  });
  if (!v2EngineResult.ok) throw new Error('V2 retrieval engine is invalid.');
  const searchViews = safe.profiles.profiles.map((profile) => {
    const view = createCandidateSearchView(profile);
    if (view === null) throw new Error('V1 candidate search view is invalid.');
    return view;
  });
  const metadataChannelResult = createApprovedMetadataLexicalChannelV1({
    metadataAuthority: safe.metadata,
    taxonomy: safe.taxonomy,
    retrievalExpansionAuthority: safe.expansion,
    expectedMetadataAuthorityBinding: safe.expectedMetadataBinding,
    expectedCandidates: searchViews.map(
      ({ candidateId, catalogOwner, catalogRepository }) => ({
        candidateId,
        catalogOwner,
        catalogRepository,
      }),
    ),
  });
  if (!metadataChannelResult.ok)
    throw new Error('Metadata channel is invalid.');
  const taxonomyConcepts = new Map(
    safe.taxonomy.concepts.map((concept) => [concept.conceptId, concept]),
  );
  const candidateIds = new Set(
    safe.profiles.profiles.map(({ candidateId }) => candidateId),
  );
  const v1ById = new Map(
    safe.profiles.profiles.map((profile) => [profile.candidateId, profile]),
  );
  const v1CompatibilityEvaluator: typeof evaluateCandidateConstraintsV2 = ({
    profile,
    normalization,
  }) => {
    const v1Profile = v1ById.get(profile.candidateId);
    if (v1Profile === undefined) {
      throw new Error('V1 candidate profile is missing.');
    }
    return evaluateCandidateConstraints({ profile: v1Profile, normalization });
  };
  const projectedById = new Map(
    evaluator.profiles.map((profile) => [profile.candidateId, profile]),
  );
  const serializedDecisions: unknown[] = [];
  let decisionsCompared = 0;
  let perConstraintComparisons = 0;
  let mismatches = 0;
  let laneCountMatches = 0;
  let finalistIdMatches = 0;
  let responsibleOutcomeClassMatches = 0;

  for (const bundle of loadedCorpus.corpus.retrievalCases) {
    const v2LaneCounts = { eligible: 0, 'evidence-needed': 0, excluded: 0 };
    for (const profile of safe.profiles.profiles) {
      const normalization = {
        outcome: bundle.normalizationResult.outcome,
        taxonomyVersion: bundle.normalizationResult.taxonomyVersion,
        taxonomySemanticDigest:
          bundle.normalizationResult.taxonomySemanticDigest,
        primaryFamilyId: bundle.normalizationResult.primaryFamilyId,
        normalizedConstraints: bundle.normalizationResult.normalizedConstraints,
        preservedDeclarations: bundle.normalizationResult.preservedDeclarations,
      } as const;
      const v1 = evaluateCandidateConstraints({ profile, normalization });
      const projected = projectedById.get(profile.candidateId);
      if (!v1.ok || projected === undefined) {
        throw new Error('V1 equivalence input is invalid.');
      }
      const v2 = evaluateCandidateConstraintsV2({
        profile: projected,
        normalization,
      });
      if (!v2.ok) throw new Error('Projected V2 evaluation failed.');

      decisionsCompared += 1;
      perConstraintComparisons += v1.value.evaluations.length;
      const equivalent = evaluationProjection(v1.value);
      const actual = evaluationProjection(v2.value);
      if (retrievalStableJson(equivalent) !== retrievalStableJson(actual)) {
        mismatches += 1;
      }
      const negativeControl = catalogStatus(profile) === 'negative-control';
      const lane = laneFor(v2.value, negativeControl);
      v2LaneCounts[lane] += 1;
      const expected = bundle.generatedProjection.decisions.find(
        ({ candidateId }) => candidateId === profile.candidateId,
      );
      if (
        expected?.hardState !== v2.value.overallHardState ||
        expected.lane !== lane
      ) {
        mismatches += 1;
      }
      serializedDecisions.push({
        caseId: bundle.query.caseId,
        candidateId: profile.candidateId,
        evaluation: actual,
        lane,
      });
    }
    if (
      retrievalStableJson(v2LaneCounts) ===
      retrievalStableJson(bundle.generatedProjection.laneCounts)
    ) {
      laneCountMatches += 1;
    } else {
      mismatches += 1;
    }
    const request = createCandidateRetrievalRequestV1({
      normalization: bundle.normalizationResult,
      authorityBindings: {
        taxonomy: {
          taxonomyVersion: safe.taxonomy.taxonomyVersion,
          taxonomySemanticDigest: safe.taxonomy.semanticDigest,
        },
        candidateProfiles: {
          authorityVersion: safe.profiles.authorityVersion,
          semanticAuthorityDigest: safe.profiles.semanticAuthorityDigest,
          profileRulesVersion: safe.profiles.profileRulesVersion,
        },
        catalog: {
          catalogVersion: safe.profiles.catalogVersion,
          catalogDigest: safe.profiles.catalogDigest,
        },
        candidateConstraintEvaluationVersion:
          CANDIDATE_CONSTRAINT_EVALUATION_VERSION,
        retrievalExpansion: {
          authorityVersion: safe.expansion.expansionVersion,
          semanticDigest: safe.expansion.semanticDigest,
        },
        retrievalMetadata: {
          authorityVersion: safe.metadata.authorityVersion,
          authoritySemanticDigest: safe.metadata.authoritySemanticDigest,
        },
      },
      eligibleResultLimit: 10,
      evidenceNeededResultLimit: 10,
    });
    const currentV1 = retrieveCandidateSet(
      request,
      safe.taxonomy,
      evaluator,
      searchViews,
      taxonomyConcepts,
      candidateIds,
      safe.expansion,
      metadataChannelResult.channel,
      v1CompatibilityEvaluator,
    );
    const projectedV2 = v2EngineResult.engine.retrieve(request);
    if (!currentV1.ok || !projectedV2.ok) {
      throw new Error('Equivalence retrieval failed.');
    }
    const v1Retrieval = retrievalProjection(currentV1.result);
    const v2Retrieval = retrievalProjection(projectedV2.result);
    if (retrievalStableJson(v1Retrieval) === retrievalStableJson(v2Retrieval)) {
      finalistIdMatches += 1;
    } else {
      mismatches += 1;
    }
    const v1Class = responsibleOutcomeClass(
      currentV1.result.preRetrievalLaneCounts,
    );
    const v2Class = responsibleOutcomeClass(
      projectedV2.result.preRetrievalLaneCounts,
    );
    if (v1Class === v2Class) responsibleOutcomeClassMatches += 1;
    else mismatches += 1;
    serializedDecisions.push({
      caseId: bundle.query.caseId,
      currentV1: v1Retrieval,
      projectedV2: v2Retrieval,
      responsibleOutcomeClass: v2Class,
    });
  }

  evidence = {
    decisionsCompared,
    perConstraintComparisons,
    mismatches,
    laneCountMatches,
    finalistIdMatches,
    responsibleOutcomeClassMatches,
    serializedDigest: createHash('sha256')
      .update(retrievalStableJson(serializedDecisions))
      .digest('hex'),
  };
}, 120_000);

describe('V1 projection through the V2 evaluator', () => {
  it('matches every decision, evaluation item, lane, finalist, and outcome class', () => {
    expect(evidence).toMatchObject({
      decisionsCompared: 4_500,
      mismatches: 0,
      laneCountMatches: 30,
      finalistIdMatches: 30,
      responsibleOutcomeClassMatches: 30,
    });
    expect(evidence.perConstraintComparisons).toBeGreaterThanOrEqual(4_500);
    expect(evidence.serializedDigest).toBe(
      '37963e5bec0b03d202fb5d422b16ceb6f845947bdea058a4143375802895733e',
    );
  });
});

function evaluationProjection(evaluation: CandidateConstraintEvaluation) {
  return {
    overallHardState: evaluation.overallHardState,
    evaluations: evaluation.evaluations.map(
      ({ evaluationId, match, state }) => ({ evaluationId, match, state }),
    ),
  };
}

function retrievalProjection(result: {
  readonly preRetrievalLaneCounts: {
    readonly eligible: number;
    readonly 'evidence-needed': number;
    readonly excluded: number;
  };
  readonly eligibleCandidates: readonly { readonly candidateId: string }[];
  readonly evidenceNeededCandidates: readonly {
    readonly candidateId: string;
  }[];
}) {
  return {
    laneCounts: result.preRetrievalLaneCounts,
    eligibleIds: result.eligibleCandidates.map(
      ({ candidateId }) => candidateId,
    ),
    evidenceNeededIds: result.evidenceNeededCandidates.map(
      ({ candidateId }) => candidateId,
    ),
    finalistIds: [
      ...result.eligibleCandidates.slice(0, 5),
      ...result.evidenceNeededCandidates.slice(
        0,
        Math.max(0, 5 - result.eligibleCandidates.length),
      ),
    ].map(({ candidateId }) => candidateId),
  };
}

function catalogStatus(
  profile: ReturnType<
    typeof loadRetrievalSafeAuthorityV1
  >['profiles']['profiles'][number],
) {
  const field = profile.fields.find(
    ({ fieldId }) => fieldId === 'catalog-role-status',
  ) as DeterministicProfileFieldRecord<'catalog-role-status'> | undefined;
  if (field?.state !== 'known') throw new Error('Catalog status is missing.');
  return field.value.catalogStatus;
}

function laneFor(
  evaluation: CandidateConstraintEvaluation,
  negativeControl: boolean,
): 'eligible' | 'evidence-needed' | 'excluded' {
  return evaluation.overallHardState === 'conflict' || negativeControl
    ? 'excluded'
    : evaluation.overallHardState === 'unresolved'
      ? 'evidence-needed'
      : 'eligible';
}

function responsibleOutcomeClass(counts: {
  readonly eligible: number;
  readonly 'evidence-needed': number;
}): 'candidate-assessment' | 'insufficient-evidence' | 'no-viable-candidate' {
  return counts.eligible > 0
    ? 'candidate-assessment'
    : counts['evidence-needed'] > 0
      ? 'insufficient-evidence'
      : 'no-viable-candidate';
}
