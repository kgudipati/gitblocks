import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import {
  createCandidateRetrievalRequestV1,
  parseDeterministicCandidateProfileAuthorityV2,
  projectDeterministicCandidateProfileAuthorityToEvaluatorV2,
} from '@gitblocks/contracts';
import {
  CANDIDATE_CONSTRAINT_EVALUATION_VERSION,
  evaluateCandidateConstraints,
  evaluateCandidateConstraintsV2,
  type CandidateConstraintEvaluation,
  type DeterministicProfileFieldRecord,
  type PublishedDeterministicCandidateProfileAuthority,
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
  readonly differences: readonly string[];
  readonly serializedDigest: string;
}

let evidence: EquivalenceEvidence;

beforeAll(() => {
  const root = findGitBlocksRoot(process.cwd());
  const safe = loadRetrievalSafeAuthorityV1(root);
  const parsedNativeV2 = parseDeterministicCandidateProfileAuthorityV2(
    JSON.parse(
      readFileSync(
        join(
          root,
          'catalog',
          'public-v1',
          'candidate-profile-authority-v2.json',
        ),
        'utf8',
      ),
    ) as unknown,
  );
  if (!parsedNativeV2.ok) {
    throw new Error('Expected generated native V2 profile authority.');
  }
  const loadedCorpus = loadRetrievalCorpusV1(root);
  if (!loadedCorpus.ok) throw new Error('Expected accepted retrieval corpus.');
  const projectedV1Evaluator =
    projectDeterministicCandidateProfileAuthorityToEvaluatorV2(safe.profiles);
  const evaluator = projectDeterministicCandidateProfileAuthorityToEvaluatorV2(
    parsedNativeV2.value,
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
  const differences: string[] = [];

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
        differences.push(
          `evaluation:${bundle.query.caseId}:${profile.candidateId}`,
        );
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
        differences.push(
          `accepted-projection:${bundle.query.caseId}:${profile.candidateId}`,
        );
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
      differences.push(`lane-counts:${bundle.query.caseId}`);
    }
    const request = createRequest(safe.profiles);
    const nativeV2Request = createRequest(parsedNativeV2.value);
    function createRequest(
      profileAuthority: PublishedDeterministicCandidateProfileAuthority,
    ) {
      const candidateProfiles =
        profileAuthority.authorityVersion ===
        'deterministic-candidate-profile-authority/1.0.0'
          ? {
              authorityVersion: profileAuthority.authorityVersion,
              semanticAuthorityDigest: profileAuthority.semanticAuthorityDigest,
              profileRulesVersion: profileAuthority.profileRulesVersion,
            }
          : {
              authorityVersion: profileAuthority.authorityVersion,
              semanticAuthorityDigest: profileAuthority.semanticAuthorityDigest,
              profileRulesVersion: profileAuthority.profileRulesVersion,
            };
      return createCandidateRetrievalRequestV1({
        normalization: bundle.normalizationResult,
        authorityBindings: {
          taxonomy: {
            taxonomyVersion: safe.taxonomy.taxonomyVersion,
            taxonomySemanticDigest: safe.taxonomy.semanticDigest,
          },
          candidateProfiles,
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
    }
    const currentV1 = retrieveCandidateSet(
      request,
      safe.taxonomy,
      projectedV1Evaluator,
      searchViews,
      taxonomyConcepts,
      candidateIds,
      safe.expansion,
      metadataChannelResult.channel,
      v1CompatibilityEvaluator,
    );
    const projectedV2 = v2EngineResult.engine.retrieve(nativeV2Request);
    if (!currentV1.ok || !projectedV2.ok) {
      throw new Error('Equivalence retrieval failed.');
    }
    const v1Retrieval = retrievalProjection(currentV1.result);
    const v2Retrieval = retrievalProjection(projectedV2.result);
    if (retrievalStableJson(v1Retrieval) === retrievalStableJson(v2Retrieval)) {
      finalistIdMatches += 1;
    } else {
      mismatches += 1;
      differences.push(`finalists:${bundle.query.caseId}`);
    }
    const v1Class = responsibleOutcomeClass(
      currentV1.result.preRetrievalLaneCounts,
    );
    const v2Class = responsibleOutcomeClass(
      projectedV2.result.preRetrievalLaneCounts,
    );
    if (v1Class === v2Class) responsibleOutcomeClassMatches += 1;
    else {
      mismatches += 1;
      differences.push(`outcome-class:${bundle.query.caseId}`);
    }
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
    differences,
    serializedDigest: createHash('sha256')
      .update(retrievalStableJson(serializedDecisions))
      .digest('hex'),
  };
}, 120_000);

describe('reviewed-curation native V2 divergence from the current V1 authority', () => {
  it('keeps every intentional difference bounded to the curated authorization case', () => {
    expect(evidence.differences).toEqual([
      'evaluation:ret-authorization-03:auth-aserto-topaz',
      'evaluation:ret-authorization-03:auth-casbin-casbin',
      'evaluation:ret-authorization-03:auth-casbin-casbin-js',
      'evaluation:ret-authorization-03:auth-casbin-node-casbin',
      'evaluation:ret-authorization-03:auth-casdoor-casdoor',
      'evaluation:ret-authorization-03:auth-koa-roles',
      'evaluation:ret-authorization-03:auth-oso',
      'evaluation:ret-authorization-03:auth-permify',
      'evaluation:ret-authorization-03:auth-warrant',
      'evaluation:ret-authorization-03:auth-zitadel',
      'finalists:ret-authorization-03',
    ]);
    expect(evidence).toMatchObject({
      decisionsCompared: 4_500,
      mismatches: 11,
      laneCountMatches: 30,
      finalistIdMatches: 29,
      responsibleOutcomeClassMatches: 30,
    });
    expect(evidence.perConstraintComparisons).toBeGreaterThanOrEqual(4_500);
    expect(evidence.serializedDigest).toBe(
      '1c804265c8f583c78e27b04dbfbf220d7d1e052d007bd19c790c32db7e92d948',
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
