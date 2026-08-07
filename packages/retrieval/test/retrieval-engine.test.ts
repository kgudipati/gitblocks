import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it, vi } from 'vitest';

import {
  CONTRACT_VERSION,
  createCandidateRetrievalRequestV1,
  normalizeCapabilityQueryV1,
  parseCapabilityTaxonomyV1,
  parseDeterministicCandidateProfileAuthorityV1,
  type CandidateRetrievalRequestV1,
  type CandidateRetrievalCandidateV1,
  type CapabilityQueryDraftConstraintV1,
  type CapabilityTaxonomyV1,
  type DeterministicCandidateProfileAuthorityV1,
} from '@gitblocks/contracts';
import {
  CANDIDATE_CONSTRAINT_EVALUATION_VERSION,
  type DeterministicCandidateProfile,
  type DeterministicProfileFieldRecord,
  type evaluateCandidateConstraints,
} from '@gitblocks/domain';

import {
  createCandidateRetrievalEngineV1,
  type CandidateRetrievalEngineV1,
} from '../src/index.ts';
import {
  createCandidateSearchView,
  deduplicateExactIdentities,
  executeRetrievalChannels,
  retrieveCandidateSet,
  type CandidateSearchView,
  type ScoredCandidate,
} from '../src/retrieval-engine.ts';

const taxonomyPath = fileURLToPath(
  new URL(
    '../../../catalog/capability-taxonomy/1.0.0/manifest.json',
    import.meta.url,
  ),
);
const profilesPath = fileURLToPath(
  new URL(
    '../../../catalog/public-v1/candidate-profile-authority.json',
    import.meta.url,
  ),
);

let taxonomy: CapabilityTaxonomyV1;
let profileAuthority: DeterministicCandidateProfileAuthorityV1;
let rawProfileAuthority: DeterministicCandidateProfileAuthorityV1;
let retrievalEngine: CandidateRetrievalEngineV1;

beforeAll(async () => {
  const taxonomyValue = JSON.parse(
    await readFile(taxonomyPath, 'utf8'),
  ) as unknown;
  const profileValue = JSON.parse(
    await readFile(profilesPath, 'utf8'),
  ) as unknown;
  const parsedTaxonomy = parseCapabilityTaxonomyV1(taxonomyValue);
  const parsedProfiles =
    parseDeterministicCandidateProfileAuthorityV1(profileValue);
  if (!parsedTaxonomy.ok || !parsedProfiles.ok) {
    throw new Error('Committed retrieval authority is invalid.');
  }
  taxonomy = parsedTaxonomy.value;
  profileAuthority = parsedProfiles.value;
  rawProfileAuthority =
    profileValue as DeterministicCandidateProfileAuthorityV1;
  const created = createCandidateRetrievalEngineV1({
    taxonomy,
    candidateProfileAuthority: profileAuthority,
  });
  if (!created.ok) throw new Error('Retrieval engine creation failed.');
  retrievalEngine = created.engine;
}, 60_000);

describe('deterministic production retrieval vertical slice', () => {
  it('admits exact authority, evaluates all 150 candidates once, and returns bounded safe lanes', () => {
    const engine = requireEngine();
    const operation = engine.retrieve(makeRequest());
    expect(operation.ok).toBe(true);
    if (!operation.ok) return;
    const result = operation.result;
    expect(result.diagnostics.candidatesExamined).toBe(150);
    expect(result.diagnostics.candidatesConstraintEvaluated).toBe(150);
    expect(result.diagnostics.activeChannelCount).toBe(5);
    expect(
      result.preRetrievalLaneCounts.eligible +
        result.preRetrievalLaneCounts['evidence-needed'] +
        result.preRetrievalLaneCounts.excluded,
    ).toBe(150);
    expect(result.eligibleCandidates.length).toBeGreaterThan(0);
    expect(result.eligibleCandidates.length).toBeLessThanOrEqual(10);
    expect(result.evidenceNeededCandidates).toEqual([]);
    expect(
      new Set(result.eligibleCandidates.map(({ candidateId }) => candidateId))
        .size,
    ).toBe(result.eligibleCandidates.length);
  });

  it('never returns conflict candidates or satisfied catalog negative controls', () => {
    const operation = requireEngine().retrieve(makeRequest());
    if (!operation.ok) throw new Error('Retrieval failed.');
    const returned = new Set(
      operation.result.eligibleCandidates.map(({ candidateId }) => candidateId),
    );
    for (const profile of profileAuthority.profiles) {
      const family = knownField(profile, 'capability-family');
      const status = knownField(profile, 'catalog-role-status');
      if (
        family.value.primaryFamily !== 'authorization' ||
        status.value.catalogStatus === 'negative-control'
      ) {
        expect(returned.has(profile.candidateId)).toBe(false);
      }
    }
    expect(
      operation.result.diagnostics.negativeControlsExcluded,
    ).toBeGreaterThan(0);
  });

  it('keeps unresolved hard evidence only in evidence-needed and discloses it', () => {
    const operation = requireEngine().retrieve(
      makeRequest([
        {
          constraintId: 'deployment-required',
          modality: 'required',
          statement: 'Must be self hosted.',
          originalTerm: 'self-hosted',
          facetHint: 'deployment',
          reasonCode: 'deployment-required',
        },
      ]),
    );
    expect(operation.ok).toBe(true);
    if (!operation.ok) return;
    expect(operation.result.preRetrievalLaneCounts.eligible).toBe(0);
    expect(operation.result.eligibleCandidates).toEqual([]);
    expect(operation.result.evidenceNeededCandidates.length).toBeGreaterThan(0);
    for (const candidate of operation.result.evidenceNeededCandidates) {
      expect(candidate.lane).toBe('evidence-needed');
      expect(candidate.unresolvedHardEvaluations.length).toBeGreaterThan(0);
      expect(
        candidate.unresolvedHardEvaluations.map(({ state }) => state),
      ).toEqual(
        Array.from(
          { length: candidate.unresolvedHardEvaluations.length },
          () => 'unresolved',
        ),
      );
      expect(
        candidate.unresolvedHardEvaluations.every(
          ({ evaluationId, ruleId }) =>
            evaluationId.length > 0 && ruleId.length > 0,
        ),
      ).toBe(true);
    }
  });

  it('does not turn a preferred-only unknown into a hard conflict', () => {
    const operation = requireEngine().retrieve(
      makeRequest([
        {
          constraintId: 'deployment-preferred',
          modality: 'preferred',
          statement: 'Prefer self hosted.',
          originalTerm: 'self-hosted',
          facetHint: 'deployment',
          reasonCode: null,
        },
      ]),
    );
    expect(operation.ok).toBe(true);
    if (!operation.ok) return;
    expect(operation.result.preRetrievalLaneCounts.eligible).toBeGreaterThan(0);
    expect(operation.result.eligibleCandidates.length).toBeGreaterThan(0);
  });

  it('evaluates each candidate once and can populate two pools smaller than their bounds', () => {
    const candidateIds = profileAuthority.profiles
      .filter((profile) => {
        const family = knownField(profile, 'capability-family');
        const status = knownField(profile, 'catalog-role-status');
        return (
          family.value.primaryFamily === 'authorization' &&
          status.value.catalogStatus === 'active'
        );
      })
      .slice(0, 2)
      .map(({ candidateId }) => candidateId);
    const [eligibleId, evidenceNeededId] = candidateIds;
    if (eligibleId === undefined || evidenceNeededId === undefined) {
      throw new Error('Two active authorization candidates are required.');
    }
    const evaluator = vi.fn<typeof evaluateCandidateConstraints>();
    evaluator.mockImplementation(({ profile, normalization }) => {
      const state =
        profile.candidateId === eligibleId
          ? 'satisfied'
          : profile.candidateId === evidenceNeededId
            ? 'unresolved'
            : 'conflict';
      const match =
        state === 'satisfied'
          ? 'match'
          : state === 'unresolved'
            ? 'unresolved'
            : 'mismatch';
      return {
        ok: true,
        value: {
          candidateId: profile.candidateId,
          normalizationTaxonomyVersion: normalization.taxonomyVersion,
          normalizationTaxonomySemanticDigest:
            normalization.taxonomySemanticDigest,
          overallHardState: state,
          evaluations: [
            {
              evaluationId: 'primary-capability-family',
              sourceKind: 'primary-family',
              modality: 'required',
              facet: 'capability',
              conceptId: 'authorization',
              profileFieldId: 'capability-family',
              match,
              state,
              ruleId: 'evaluate-primary-capability-family',
            },
          ],
        },
      };
    });
    const views = candidateSearchViews();
    const operation = retrieveCandidateSet(
      makeRequest(),
      taxonomy,
      profileAuthority,
      views,
      new Map(taxonomy.concepts.map((concept) => [concept.conceptId, concept])),
      new Set(views.map(({ candidateId }) => candidateId)),
      evaluator,
    );
    expect(operation.ok).toBe(true);
    if (!operation.ok) return;
    expect(evaluator).toHaveBeenCalledTimes(150);
    expect(
      new Set(evaluator.mock.calls.map(([input]) => input.profile.candidateId))
        .size,
    ).toBe(150);
    expect(operation.result.preRetrievalLaneCounts).toEqual({
      eligible: 1,
      'evidence-needed': 1,
      excluded: 148,
    });
    expect(operation.result.eligibleCandidates).toHaveLength(1);
    expect(operation.result.evidenceNeededCandidates).toHaveLength(1);
    expect(operation.result.eligibleCandidates[0]?.candidateId).toBe(
      eligibleId,
    );
    expect(operation.result.evidenceNeededCandidates[0]?.candidateId).toBe(
      evidenceNeededId,
    );

    evaluator.mockClear();
    const rejected = retrieveCandidateSet(
      { ...makeRequest(), eligibleResultLimit: 0 },
      taxonomy,
      profileAuthority,
      views,
      new Map(taxonomy.concepts.map((concept) => [concept.conceptId, concept])),
      new Set(views.map(({ candidateId }) => candidateId)),
      evaluator,
    );
    expect(rejected.ok).toBe(false);
    expect(evaluator).not.toHaveBeenCalled();
  });

  it.each([
    ['candidate-id', 'auth-koa-roles', 'candidate-identity'],
    ['repository', 'koajs/koa-roles', 'candidate-identity'],
    ['npm-package', 'koa-roles', 'package-identity'],
  ] as const)(
    'uses exact %s authority without network lookup',
    (kind, value, expectedChannel) => {
      const operation = requireEngine().retrieve(
        makeRequest([], { kind, value }),
      );
      expect(operation.ok).toBe(true);
      if (!operation.ok) return;
      const candidate = operation.result.eligibleCandidates.find(
        ({ candidateId }) => candidateId === 'auth-koa-roles',
      );
      expect(
        candidate?.channelMatches.map(({ channelId }) => channelId),
      ).toContain(expectedChannel);
    },
  );

  it('implements exact family, additional-family, taxonomy, structured, and unknown-field channel rules', () => {
    const baseRequest = makeRequest();
    const profile = profileAuthority.profiles[0];
    if (profile === undefined) throw new Error('Profile authority is empty.');
    const concepts = new Map([
      ['adoption-unit-type' as const, new Set(['authorization'])],
      ['deployment-self-hosting' as const, new Set(['self-hosted-service'])],
    ]);
    const view: CandidateSearchView = {
      profile,
      candidateId: 'synthetic-candidate',
      catalogStatus: 'active',
      primaryFamily: 'authorization',
      additionalFamilies: ['audit-logging'],
      repositoryIdentity: 'owner/repository',
      packageIdentity: 'package-name',
      conceptsByField: concepts,
    };
    const taxonomyById = new Map(
      taxonomy.concepts.map((concept) => [concept.conceptId, concept]),
    );
    const base = executeRetrievalChannels(baseRequest, view, taxonomyById);
    expect(base.map(({ channelId }) => channelId)).toEqual([
      'capability-family',
      'taxonomy-concept',
    ]);

    const additionalRequest = {
      ...baseRequest,
      normalization: {
        ...baseRequest.normalization,
        normalizedCapabilityConcepts: [
          ...baseRequest.normalization.normalizedCapabilityConcepts,
          {
            conceptId: 'always-on-worker',
            sourceTermIds: ['capability-one'],
            ruleId: 'synthetic-channel-proof',
          },
        ],
      },
    } as CandidateRetrievalRequestV1;
    const additional = executeRetrievalChannels(
      additionalRequest,
      view,
      taxonomyById,
    ).find(({ channelId }) => channelId === 'capability-family');
    expect(additional?.componentScore).toBe(225);

    const structuredRequest = makeRequest([
      {
        constraintId: 'deployment-preferred',
        modality: 'preferred',
        statement: 'Prefer self hosted.',
        originalTerm: 'self-hosted',
        facetHint: 'deployment',
        reasonCode: null,
      },
    ]);
    expect(
      executeRetrievalChannels(structuredRequest, view, taxonomyById).map(
        ({ channelId }) => channelId,
      ),
    ).toContain('structured-profile');
    expect(
      executeRetrievalChannels(
        structuredRequest,
        { ...view, conceptsByField: new Map() },
        taxonomyById,
      ).map(({ channelId }) => channelId),
    ).not.toContain('structured-profile');
  });

  it('projects every accepted known structured field as exact controlled tokens', () => {
    const profile = profileAuthority.profiles[0];
    if (profile === undefined) throw new Error('Profile authority is empty.');
    const fields = structuredClone(profile.fields) as unknown as (Record<
      string,
      unknown
    > & { fieldId: string })[];
    const setKnownValue = (fieldId: string, value: unknown): void => {
      const index = fields.findIndex((field) => field.fieldId === fieldId);
      const field = fields[index];
      if (field === undefined) throw new Error('Profile field is missing.');
      fields[index] = {
        ...field,
        state: 'known',
        stateReasonCode: 'approved-catalog-field-value',
        stateRuleId: 'assign-known-approved-catalog-value',
        valueExtractionRuleId: 'extract-synthetic-test-value',
        sourceReferences: [],
        value,
      };
    };
    setKnownValue('repository-discovery-metadata', {
      repositoryTopics: ['task-queue'],
      primaryLanguage: 'typescript',
    });
    setKnownValue('language-ecosystem', {
      ecosystems: ['javascript', 'typescript'],
    });
    setKnownValue('operational-complexity-primitives', {
      processRoles: ['background-worker'],
      requiresScheduledExecution: false,
      requiresPersistentStorage: false,
    });
    const enriched = {
      ...profile,
      fields,
    } as unknown as DeterministicCandidateProfile;
    const view = createCandidateSearchView(enriched);
    expect(view?.conceptsByField.get('repository-discovery-metadata')).toEqual(
      new Set(['task-queue', 'typescript']),
    );
    expect(view?.conceptsByField.get('language-ecosystem')).toEqual(
      new Set(['javascript', 'typescript']),
    );
    expect(
      view?.conceptsByField.get('operational-complexity-primitives'),
    ).toEqual(new Set(['background-worker']));
  });

  it('uses stable integer fusion, channel order, ASCII ties, and exact identity deduplication', () => {
    const left = scored('candidate-a', 200, 'owner/shared', 'shared-package');
    const right = scored('candidate-b', 200, 'owner/shared', 'other-package');
    const packagePeer = scored(
      'candidate-c',
      200,
      'owner/package-peer',
      'shared-package',
    );
    const permutations = [
      [left, right, packagePeer],
      [left, packagePeer, right],
      [right, left, packagePeer],
      [right, packagePeer, left],
      [packagePeer, left, right],
      [packagePeer, right, left],
    ];
    for (const permutation of permutations) {
      const result = deduplicateExactIdentities(permutation);
      expect(
        result.candidates.map(({ candidate }) => candidate.candidateId),
      ).toEqual(['candidate-a']);
      expect(result.exactRepositoryIdentityGroups).toBe(1);
      expect(result.exactPackageIdentityGroups).toBe(1);
      expect(result.duplicatesRemoved).toBe(2);
    }
    const firstBackfill = scored(
      'candidate-d',
      200,
      'owner/distinct-d',
      'distinct-d',
    );
    const secondBackfill = scored(
      'candidate-e',
      200,
      'owner/distinct-e',
      'distinct-e',
    );
    expect(
      deduplicateExactIdentities([
        right,
        secondBackfill,
        packagePeer,
        firstBackfill,
        left,
      ]).candidates.map(({ candidate }) => candidate.candidateId),
    ).toEqual(['candidate-a', 'candidate-d', 'candidate-e']);
    expect(Number.isInteger(left.candidate.retrievalScore)).toBe(true);
  });

  it.each([1, 10])('obeys an explicit %s-result lane limit', (limit) => {
    const operation = requireEngine().retrieve(
      makeRequest([], undefined, limit),
    );
    expect(operation.ok).toBe(true);
    if (!operation.ok) return;
    expect(operation.result.eligibleCandidates.length).toBeLessThanOrEqual(
      limit,
    );
    expect(
      operation.result.evidenceNeededCandidates.length,
    ).toBeLessThanOrEqual(limit);
    expect(
      operation.result.eligibleCandidates.length +
        operation.result.evidenceNeededCandidates.length,
    ).toBeLessThanOrEqual(20);
  });

  it('returns byte-repeatable immutable owned results', () => {
    const engine = requireEngine();
    const request = structuredClone(makeRequest());
    const first = engine.retrieve(request);
    const second = engine.retrieve(request);
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    const serialized = JSON.stringify(first.result);
    expect(serialized).toBe(JSON.stringify(second.result));
    (
      request.authorityBindings.taxonomy as {
        taxonomySemanticDigest: string;
      }
    ).taxonomySemanticDigest = '0'.repeat(64);
    expect(JSON.stringify(first.result)).toBe(serialized);
    expect(Object.isFrozen(first.result)).toBe(true);
    expect(Object.isFrozen(first.result.eligibleCandidates)).toBe(true);
    expect(() => {
      (first.result.eligibleCandidates as unknown as unknown[]).push({});
    }).toThrow();
  });

  it('is result-identical across 20 fixed admitted search-view permutations', () => {
    const views = candidateSearchViews();
    const taxonomyConcepts = new Map(
      taxonomy.concepts.map((concept) => [concept.conceptId, concept]),
    );
    const candidateIds = new Set(views.map(({ candidateId }) => candidateId));
    const request = makeRequest();
    const expected = retrieveCandidateSet(
      request,
      taxonomy,
      profileAuthority,
      views,
      taxonomyConcepts,
      candidateIds,
    );
    expect(expected.ok).toBe(true);
    if (!expected.ok) return;
    for (let index = 0; index < 20; index += 1) {
      const offset = (index * 17) % views.length;
      const rotated = [...views.slice(offset), ...views.slice(0, offset)];
      const permutation = index % 2 === 0 ? rotated : rotated.reverse();
      const actual = retrieveCandidateSet(
        request,
        taxonomy,
        profileAuthority,
        permutation,
        taxonomyConcepts,
        candidateIds,
      );
      expect(actual.ok).toBe(true);
      if (actual.ok) {
        expect(JSON.stringify(actual.result)).toBe(
          JSON.stringify(expected.result),
        );
      }
    }
  });

  it('owns injected authority and rejects malformed, mismatched, duplicate, and confusable inputs', () => {
    const mutableAuthority = structuredClone(rawProfileAuthority);
    const created = createCandidateRetrievalEngineV1({
      taxonomy,
      candidateProfileAuthority: mutableAuthority,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const before = created.engine.retrieve(makeRequest());
    mutableAuthority.profiles.reverse();
    const after = created.engine.retrieve(makeRequest());
    expect(before.ok && after.ok).toBe(true);
    if (before.ok && after.ok) {
      expect(JSON.stringify(before.result)).toBe(JSON.stringify(after.result));
    }

    const mismatched = structuredClone(makeRequest());
    mismatched.authorityBindings.taxonomy.taxonomySemanticDigest = '0'.repeat(
      64,
    );
    expect(created.engine.retrieve(mismatched)).toMatchObject({ ok: false });
    expect(
      created.engine.retrieve({
        ...makeRequest(),
        rawQuery: '../../etc/passwd',
      }),
    ).toMatchObject({
      ok: false,
    });
    expect(
      createCandidateRetrievalEngineV1({
        taxonomy,
        candidateProfileAuthority: {
          ...profileAuthority,
          profiles: [
            profileAuthority.profiles[0],
            profileAuthority.profiles[0],
            ...profileAuthority.profiles.slice(2),
          ],
        },
      }),
    ).toMatchObject({ ok: false });

    const reversedAuthority = structuredClone(rawProfileAuthority);
    reversedAuthority.profiles.reverse();
    expect(
      createCandidateRetrievalEngineV1({
        taxonomy,
        candidateProfileAuthority: reversedAuthority,
      }),
    ).toMatchObject({
      ok: false,
      issues: [{ code: 'invalid-profile-authority' }],
    });

    const unmapped = profileAuthority.profiles.find(
      (profile) =>
        knownField(profile, 'capability-family').value.primaryFamily ===
          'authorization' &&
        knownField(profile, 'package-identity-mapping').value.mapping ===
          'unmapped',
    );
    if (unmapped === undefined) {
      throw new Error('An unmapped authorization candidate is required.');
    }
    const referenceAuthority = candidateReferenceAuthority();
    const fabricatedPackageAuthority = {
      ...referenceAuthority,
      candidates: referenceAuthority.candidates.map((candidate) =>
        candidate.candidateId === unmapped.candidateId
          ? { ...candidate, npmPackageKey: 'fabricated-package' }
          : candidate,
      ),
    };
    const impossiblePackage = normalizeCapabilityQueryV1(
      {
        ...queryInput('authorization'),
        candidateReferences: [
          {
            referenceId: 'fabricated-package-reference',
            kind: 'npm-package',
            value: 'fabricated-package',
            intent: 'named-candidate',
          },
        ],
      },
      taxonomy,
      fabricatedPackageAuthority,
    );
    expect(impossiblePackage.ok).toBe(true);
    if (!impossiblePackage.ok) return;
    const impossibleRequest = createCandidateRetrievalRequestV1({
      normalization: impossiblePackage.value,
      authorityBindings: makeRequest().authorityBindings,
      eligibleResultLimit: 10,
      evidenceNeededResultLimit: 10,
    });
    expect(created.engine.retrieve(impossibleRequest)).toMatchObject({
      ok: false,
      issues: [{ code: 'normalization-authority-mismatch' }],
    });

    const confusable = normalizeCapabilityQueryV1(
      queryInput('authоrization'),
      taxonomy,
    );
    expect(confusable.ok).toBe(true);
    if (confusable.ok) expect(confusable.value.outcome).not.toBe('normalized');
  });
});

function requireEngine() {
  return retrievalEngine;
}

function candidateSearchViews(): readonly CandidateSearchView[] {
  return profileAuthority.profiles.map((profile) => {
    const view = createCandidateSearchView(profile);
    if (view === null) throw new Error('Candidate search view is invalid.');
    return view;
  });
}

function makeRequest(
  draftConstraints: readonly CapabilityQueryDraftConstraintV1[] = [],
  reference?: {
    readonly kind: 'candidate-id' | 'npm-package' | 'repository';
    readonly value: string;
  },
  limit = 10,
): CandidateRetrievalRequestV1 {
  const normalized = normalizeCapabilityQueryV1(
    {
      ...queryInput('authorization'),
      draftConstraints: [...draftConstraints],
      candidateReferences:
        reference === undefined
          ? []
          : [
              {
                referenceId: 'candidate-reference-one',
                kind: reference.kind,
                value: reference.value,
                intent: 'named-candidate',
              },
            ],
    },
    taxonomy,
    reference === undefined ? undefined : candidateReferenceAuthority(),
  );
  if (!normalized.ok || normalized.value.outcome !== 'normalized') {
    throw new Error('Synthetic retrieval query did not normalize.');
  }
  return createCandidateRetrievalRequestV1({
    normalization: normalized.value,
    authorityBindings: {
      taxonomy: {
        taxonomyVersion: taxonomy.taxonomyVersion,
        taxonomySemanticDigest: taxonomy.semanticDigest,
      },
      candidateProfiles: {
        authorityVersion: profileAuthority.authorityVersion,
        semanticAuthorityDigest: profileAuthority.semanticAuthorityDigest,
        profileRulesVersion: profileAuthority.profileRulesVersion,
      },
      catalog: {
        catalogVersion: profileAuthority.catalogVersion,
        catalogDigest: profileAuthority.catalogDigest,
      },
      candidateConstraintEvaluationVersion:
        CANDIDATE_CONSTRAINT_EVALUATION_VERSION,
    },
    eligibleResultLimit: limit,
    evidenceNeededResultLimit: limit,
  });
}

function queryInput(originalTerm: string) {
  return {
    contractVersion: CONTRACT_VERSION,
    queryInputId: 'retrieval-engine-query',
    scope: 'local-pre-approval' as const,
    summary: 'Retrieve authorization candidates.',
    capabilityTerms: [{ termId: 'capability-one', originalTerm }],
    successConditions: [
      {
        conditionId: 'success-one',
        statement: 'Return plausible candidates.',
      },
    ],
    draftConstraints: [],
    candidateReferences: [],
    repositoryFingerprintReference: null,
  };
}

function candidateReferenceAuthority() {
  return {
    catalogVersion: profileAuthority.catalogVersion,
    catalogDigest: profileAuthority.catalogDigest,
    candidates: profileAuthority.profiles.map((profile) => {
      const family = knownField(profile, 'capability-family');
      const repository = knownField(profile, 'repository-identity');
      const packageMapping = knownField(profile, 'package-identity-mapping');
      return {
        candidateId: profile.candidateId,
        capabilityFamily: family.value.primaryFamily,
        repositoryKey:
          `${repository.value.githubOwner}/${repository.value.githubRepository}`.toLowerCase(),
        npmPackageKey:
          packageMapping.value.mapping === 'mapped'
            ? packageMapping.value.packageName.toLowerCase()
            : null,
      };
    }),
  };
}

function knownField<
  Id extends
    | 'capability-family'
    | 'catalog-role-status'
    | 'package-identity-mapping'
    | 'repository-identity',
>(profile: DeterministicCandidateProfile, fieldId: Id) {
  const field = profile.fields.find(
    (candidate) => candidate.fieldId === fieldId,
  ) as DeterministicProfileFieldRecord<Id> | undefined;
  if (field?.state !== 'known') throw new Error('Known field is unavailable.');
  return field;
}

function scored(
  candidateId: string,
  score: number,
  repositoryIdentity: string,
  packageIdentity: string,
): ScoredCandidate {
  const candidate: CandidateRetrievalCandidateV1 = {
    candidateId,
    lane: 'eligible',
    retrievalScore: score,
    matchedCapabilityConceptIds: ['authorization'],
    matchedProfileFieldIds: ['capability-family'],
    channelMatches: [
      {
        channelId: 'capability-family',
        channelVersion: 'capability-family/1.0.0',
        componentScore: score,
        matchedCapabilityConceptIds: ['authorization'],
        matchedProfileFieldIds: ['capability-family'],
      },
    ],
    unresolvedHardEvaluations: [],
  };
  return { candidate, repositoryIdentity, packageIdentity };
}
