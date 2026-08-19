import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it, vi } from 'vitest';

import {
  CONTRACT_VERSION,
  createCandidateRetrievalMetadataAuthorityV1,
  createCandidateRetrievalRequestV1,
  createDeterministicCandidateProfileV1,
  normalizeCapabilityQueryV1,
  parseCapabilityRetrievalExpansionV1,
  parseCapabilityTaxonomyV1,
  parseDeterministicCandidateProfileAuthorityV1,
  type CandidateRetrievalRequestV1,
  type CandidateRetrievalMetadataAuthorityV1,
  type CandidateRetrievalCandidateV1,
  type CapabilityRetrievalExpansionV1,
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
  createApprovedMetadataLexicalChannelV1,
  createCandidateRetrievalEngineV1,
  type ApprovedMetadataLexicalChannelV1,
  type CandidateRetrievalEngineV1,
  type ExpectedCandidateRetrievalMetadataAuthorityBindingV1,
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
const expansionPath = fileURLToPath(
  new URL(
    '../../../catalog/capability-retrieval-expansion/1.0.0/manifest.json',
    import.meta.url,
  ),
);
let taxonomy: CapabilityTaxonomyV1;
let profileAuthority: DeterministicCandidateProfileAuthorityV1;
let rawProfileAuthority: DeterministicCandidateProfileAuthorityV1;
let retrievalExpansion: CapabilityRetrievalExpansionV1;
let metadataAuthority: CandidateRetrievalMetadataAuthorityV1;
let expectedMetadataBinding: ExpectedCandidateRetrievalMetadataAuthorityBindingV1;
let metadataChannel: ApprovedMetadataLexicalChannelV1;
let retrievalEngine: CandidateRetrievalEngineV1;

beforeAll(async () => {
  const taxonomyValue = JSON.parse(
    await readFile(taxonomyPath, 'utf8'),
  ) as unknown;
  const profileValue = JSON.parse(
    await readFile(profilesPath, 'utf8'),
  ) as unknown;
  const expansionValue = JSON.parse(
    await readFile(expansionPath, 'utf8'),
  ) as unknown;
  const parsedTaxonomy = parseCapabilityTaxonomyV1(taxonomyValue);
  const parsedProfiles =
    parseDeterministicCandidateProfileAuthorityV1(profileValue);
  const parsedExpansion = parseCapabilityRetrievalExpansionV1(expansionValue);
  if (!parsedTaxonomy.ok || !parsedProfiles.ok || !parsedExpansion.ok) {
    throw new Error('Committed retrieval authority is invalid.');
  }
  taxonomy = parsedTaxonomy.value;
  profileAuthority = parsedProfiles.value;
  rawProfileAuthority =
    profileValue as DeterministicCandidateProfileAuthorityV1;
  retrievalExpansion = parsedExpansion.value;
  expectedMetadataBinding = {
    authorityVersion: 'candidate-retrieval-metadata-authority/1.1.0',
    catalogVersion: 'public-v1',
    catalogDigest:
      '4819dd94cb1bbe5e27c31ca5ca55976da1442987a792bf438d96681021cb8634',
    providerPolicyVersion: 'candidate-retrieval-metadata-provider-policy/1.1.0',
    providerPolicyDigest:
      'b8cd159d895d4af91f92563b199c0e9beea9bddcb87b869e33429201bd9a5f2e',
    sourceProviderPolicyVersion:
      'profile-materialization-provider-policy/1.0.0',
    sourceProviderPolicyDigest:
      '0945ebd862d0a1b5f622c4f10f60b2c0e713fb127cc5dea5668be5cc40c96ede',
    sourceOperation: 'github-repository-metadata',
  };
  metadataAuthority = createCandidateRetrievalMetadataAuthorityV1({
    catalogVersion: expectedMetadataBinding.catalogVersion,
    catalogDigest: expectedMetadataBinding.catalogDigest,
    providerPolicyVersion: expectedMetadataBinding.providerPolicyVersion,
    providerPolicyDigest: expectedMetadataBinding.providerPolicyDigest,
    sourceProviderPolicyVersion:
      expectedMetadataBinding.sourceProviderPolicyVersion,
    sourceProviderPolicyDigest:
      expectedMetadataBinding.sourceProviderPolicyDigest,
    sourceOperation: expectedMetadataBinding.sourceOperation,
    collectedAt: '2026-08-08T00:00:00.000Z',
    candidates: profileAuthority.profiles.map((profile) => {
      const repository = knownField(profile, 'repository-identity');
      return {
        candidateId: profile.candidateId,
        catalogOwner: repository.value.githubOwner,
        catalogRepository: repository.value.githubRepository,
        providerCanonicalOwner: repository.value.githubOwner,
        providerCanonicalRepository: repository.value.githubRepository,
        description: null,
        topics: [],
        primaryLanguage: null,
      };
    }),
  });
  const createdMetadataChannel = createApprovedMetadataLexicalChannelV1({
    metadataAuthority,
    taxonomy,
    retrievalExpansionAuthority: retrievalExpansion,
    expectedMetadataAuthorityBinding: expectedMetadataBinding,
    expectedCandidates: profileAuthority.profiles.map((profile) => {
      const repository = knownField(profile, 'repository-identity');
      return {
        candidateId: profile.candidateId,
        catalogOwner: repository.value.githubOwner,
        catalogRepository: repository.value.githubRepository,
      };
    }),
  });
  if (!createdMetadataChannel.ok) {
    throw new Error('Committed metadata authority is invalid.');
  }
  metadataChannel = createdMetadataChannel.channel;
  const created = createCandidateRetrievalEngineV1({
    taxonomy,
    candidateProfileAuthority: profileAuthority,
    retrievalExpansionAuthority: retrievalExpansion,
    candidateRetrievalMetadataAuthority: metadataAuthority,
    expectedCandidateRetrievalMetadataAuthorityBinding: expectedMetadataBinding,
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
    expect(result.diagnostics.activeChannelCount).toBe(6);
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
      retrievalExpansion,
      metadataChannel,
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
      retrievalExpansion,
      metadataChannel,
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

  it('projects accepted repository display names into candidate identity terms', () => {
    const sourceProfile = profileAuthority.profiles.find(
      ({ candidateId }) => candidateId === 'audit-logdna-logger',
    );
    if (sourceProfile === undefined) {
      throw new Error('Synthetic profile is unavailable.');
    }
    const view = createCandidateSearchView(sourceProfile);
    expect(view?.candidateRepositoryIdentityTerms.has('logdna-node')).toBe(
      true,
    );
  });

  it('uses expansion only as bounded soft identity evidence and preserves preferred constraints', () => {
    const request = makeRequest([
      {
        constraintId: 'rbac-preferred',
        modality: 'preferred',
        statement: 'Prefer role based access control.',
        originalTerm: 'role-based-access-control',
        facetHint: 'feature',
        reasonCode: null,
      },
    ]);
    const constraintsBefore = JSON.stringify(
      request.normalization.normalizedConstraints,
    );
    const operation = requireEngine().retrieve(request);
    expect(operation.ok).toBe(true);
    if (!operation.ok) return;

    expect(JSON.stringify(request.normalization.normalizedConstraints)).toBe(
      constraintsBefore,
    );
    expect(operation.result.preRetrievalLaneCounts.eligible).toBeGreaterThan(0);
    expect(operation.result.diagnostics.expansionEdgesApplied).toBeGreaterThan(
      0,
    );
    const expanded = operation.result.eligibleCandidates.find(
      ({ candidateId }) => candidateId === 'auth-koa-roles',
    );
    const identityMatches = expanded?.channelMatches.filter(
      ({ channelId }) =>
        channelId === 'candidate-identity' || channelId === 'package-identity',
    );
    expect(identityMatches?.length).toBeGreaterThan(0);
    expect(
      identityMatches?.every(
        ({ componentScore, matchedCapabilityConceptIds }) =>
          Number.isInteger(componentScore) &&
          matchedCapabilityConceptIds.includes('role-based-access-control'),
      ),
    ).toBe(true);
    expect(
      identityMatches?.flatMap(
        ({ matchedExpansionEdgeIds }) => matchedExpansionEdgeIds,
      ).length,
    ).toBeGreaterThan(0);
  });

  it('cannot use expansion to satisfy required constraints or broaden prohibited constraints', () => {
    const constraint = {
      constraintId: 'rbac-hard',
      statement: 'Role based access control is governed as a hard declaration.',
      originalTerm: 'role-based-access-control',
      facetHint: 'feature' as const,
      reasonCode: 'rbac-hard',
    };
    const requiredRequest = makeRequest([
      { ...constraint, modality: 'required' },
    ]);
    const requiredBefore = JSON.stringify(
      requiredRequest.normalization.normalizedConstraints,
    );
    const required = requireEngine().retrieve(requiredRequest);
    expect(required.ok).toBe(true);
    if (!required.ok) return;
    expect(
      JSON.stringify(requiredRequest.normalization.normalizedConstraints),
    ).toBe(requiredBefore);
    expect(required.result.eligibleCandidates).toEqual([]);
    expect(required.result.preRetrievalLaneCounts.eligible).toBe(0);
    expect(required.result.evidenceNeededCandidates.length).toBeGreaterThan(0);
    expect(
      required.result.evidenceNeededCandidates.every(
        ({ unresolvedHardEvaluations }) => unresolvedHardEvaluations.length > 0,
      ),
    ).toBe(true);

    const prohibitedRequest = makeRequest([
      { ...constraint, modality: 'prohibited' },
    ]);
    const prohibitedBefore = JSON.stringify(
      prohibitedRequest.normalization.normalizedConstraints,
    );
    const prohibited = requireEngine().retrieve(prohibitedRequest);
    expect(prohibited.ok).toBe(true);
    if (!prohibited.ok) return;
    expect(
      JSON.stringify(prohibitedRequest.normalization.normalizedConstraints),
    ).toBe(prohibitedBefore);
    expect(
      [
        ...prohibited.result.eligibleCandidates,
        ...prohibited.result.evidenceNeededCandidates,
      ].flatMap(({ channelMatches }) =>
        channelMatches.flatMap(
          ({ matchedCapabilityConceptIds }) => matchedCapabilityConceptIds,
        ),
      ),
    ).not.toContain('role-based-access-control');
  });

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
      displayName: 'Synthetic candidate',
      repository: {
        host: 'github',
        owner: 'owner',
        name: 'repository',
      },
      package: { registry: 'npm', name: 'package-name' },
      catalogStatus: 'active',
      primaryFamily: 'authorization',
      additionalFamilies: ['audit-logging'],
      repositoryIdentity: 'owner/repository',
      catalogOwner: 'owner',
      catalogRepository: 'repository',
      packageIdentity: 'package-name',
      candidateRepositoryIdentityTerms: new Set(['owner', 'repository']),
      packageIdentityTerms: new Set(['package', 'package-name']),
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
        stateReasonCode: 'approved-structured-field-value',
        stateRuleId: 'assign-known-approved-structured-value',
        valueExtractionRuleId: `extract-${fieldId}-from-structured-authority`,
        versionScope: {
          kind: 'repository-snapshot',
          snapshotId: 'synthetic-test-snapshot',
        },
        sourceReferences: [
          {
            kind: 'structured-collection',
            sourceSnapshotId: 'synthetic-test-snapshot',
            evidenceIds: ['synthetic-test-evidence'],
            sourceTopicCodes: ['synthetic-test-topic'],
          },
        ],
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
    const {
      deterministicProfileId: ignoredId,
      semanticProfileDigest: ignoredDigest,
      ...profileInput
    } = profile;
    void ignoredId;
    void ignoredDigest;
    const enriched = createDeterministicCandidateProfileV1({
      ...profileInput,
      fields,
    } as never) as unknown as DeterministicCandidateProfile;
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

  it.each([
    [200, 900],
    [900, 200],
  ])(
    'preserves both hard lanes when a shared repository has scores %s and %s',
    (eligibleScore, evidenceNeededScore) => {
      const result = deduplicateExactIdentities([
        scored(
          'eligible-repository-candidate',
          eligibleScore,
          'owner/shared',
          'eligible-package',
          'eligible',
        ),
        scored(
          'evidence-repository-candidate',
          evidenceNeededScore,
          'owner/shared',
          'evidence-package',
          'evidence-needed',
        ),
      ]);

      expect(candidateIdsInLane(result.candidates, 'eligible')).toEqual([
        'eligible-repository-candidate',
      ]);
      expect(candidateIdsInLane(result.candidates, 'evidence-needed')).toEqual([
        'evidence-repository-candidate',
      ]);
      expect(result.exactRepositoryIdentityGroups).toBe(0);
      expect(result.exactPackageIdentityGroups).toBe(0);
      expect(result.duplicatesRemoved).toBe(0);
    },
  );

  it('preserves both hard lanes when distinct repositories share one exact package identity', () => {
    const result = deduplicateExactIdentities([
      scored(
        'eligible-package-candidate',
        200,
        'owner/eligible',
        'shared-package',
        'eligible',
      ),
      scored(
        'evidence-package-candidate',
        900,
        'owner/evidence',
        'shared-package',
        'evidence-needed',
      ),
    ]);

    expect(candidateIdsInLane(result.candidates, 'eligible')).toEqual([
      'eligible-package-candidate',
    ]);
    expect(candidateIdsInLane(result.candidates, 'evidence-needed')).toEqual([
      'evidence-package-candidate',
    ]);
    expect(result.exactRepositoryIdentityGroups).toBe(0);
    expect(result.exactPackageIdentityGroups).toBe(0);
    expect(result.duplicatesRemoved).toBe(0);
  });

  it.each(['eligible', 'evidence-needed'] as const)(
    'selects and backfills exact repository duplicates within %s only',
    (lane) => {
      const result = deduplicateExactIdentities([
        scored(
          'repository-low',
          200,
          'owner/shared',
          'repository-low-package',
          lane,
        ),
        scored(
          'repository-tie-b',
          500,
          'owner/shared',
          'repository-tie-b-package',
          lane,
        ),
        scored(
          'repository-tie-a',
          500,
          'owner/shared',
          'repository-tie-a-package',
          lane,
        ),
        scored(
          'repository-backfill',
          300,
          'owner/backfill',
          'repository-backfill-package',
          lane,
        ),
      ]);

      expect(candidateIdsInLane(result.candidates, lane)).toEqual([
        'repository-tie-a',
        'repository-backfill',
      ]);
      expect(result.exactRepositoryIdentityGroups).toBe(1);
      expect(result.exactPackageIdentityGroups).toBe(0);
      expect(result.duplicatesRemoved).toBe(2);
    },
  );

  it.each(['eligible', 'evidence-needed'] as const)(
    'selects and backfills exact package duplicates within %s only',
    (lane) => {
      const result = deduplicateExactIdentities([
        scored('package-low', 200, 'owner/package-low', 'shared-package', lane),
        scored(
          'package-tie-b',
          500,
          'owner/package-tie-b',
          'shared-package',
          lane,
        ),
        scored(
          'package-tie-a',
          500,
          'owner/package-tie-a',
          'shared-package',
          lane,
        ),
        scored(
          'package-backfill',
          300,
          'owner/package-backfill',
          'package-backfill',
          lane,
        ),
      ]);

      expect(candidateIdsInLane(result.candidates, lane)).toEqual([
        'package-tie-a',
        'package-backfill',
      ]);
      expect(result.exactRepositoryIdentityGroups).toBe(0);
      expect(result.exactPackageIdentityGroups).toBe(1);
      expect(result.duplicatesRemoved).toBe(2);
    },
  );

  it('keeps transitive identity grouping lane-local with permutation-stable diagnostics', () => {
    const eligibleA = scored(
      'eligible-a',
      500,
      'owner/eligible-shared',
      'eligible-package-a',
      'eligible',
    );
    const eligibleB = scored(
      'eligible-b',
      400,
      'owner/eligible-shared',
      'eligible-shared-package',
      'eligible',
    );
    const eligibleC = scored(
      'eligible-c',
      300,
      'owner/eligible-c',
      'eligible-shared-package',
      'eligible',
    );
    const evidenceBridge = scored(
      'evidence-bridge',
      900,
      'owner/eligible-shared',
      'cross-lane-package',
      'evidence-needed',
    );
    const evidencePeer = scored(
      'evidence-peer',
      800,
      'owner/evidence-peer',
      'cross-lane-package',
      'evidence-needed',
    );
    const permutations = [
      [eligibleA, eligibleB, eligibleC, evidenceBridge, evidencePeer],
      [evidencePeer, eligibleC, evidenceBridge, eligibleB, eligibleA],
      [eligibleB, evidenceBridge, eligibleA, evidencePeer, eligibleC],
    ];

    for (const permutation of permutations) {
      const result = deduplicateExactIdentities(permutation);
      expect(candidateIdsInLane(result.candidates, 'eligible')).toEqual([
        'eligible-a',
      ]);
      expect(candidateIdsInLane(result.candidates, 'evidence-needed')).toEqual([
        'evidence-bridge',
      ]);
      expect(result.exactRepositoryIdentityGroups).toBe(1);
      expect(result.exactPackageIdentityGroups).toBe(2);
      expect(result.duplicatesRemoved).toBe(3);
    }
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
      retrievalExpansion,
      metadataChannel,
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
        retrievalExpansion,
        metadataChannel,
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
    const mutableExpansion = structuredClone(retrievalExpansion);
    const mutableMetadata = structuredClone(metadataAuthority);
    const created = createCandidateRetrievalEngineV1({
      taxonomy,
      candidateProfileAuthority: mutableAuthority,
      retrievalExpansionAuthority: mutableExpansion,
      candidateRetrievalMetadataAuthority: mutableMetadata,
      expectedCandidateRetrievalMetadataAuthorityBinding:
        expectedMetadataBinding,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const before = created.engine.retrieve(makeRequest());
    mutableAuthority.profiles.reverse();
    mutableExpansion.edges.reverse();
    mutableMetadata.candidates.reverse();
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
    const baseRequest = makeRequest();
    const mismatchedExpansion = createCandidateRetrievalRequestV1({
      normalization: baseRequest.normalization,
      authorityBindings: {
        ...baseRequest.authorityBindings,
        retrievalExpansion: {
          ...baseRequest.authorityBindings.retrievalExpansion,
          semanticDigest: '0'.repeat(64),
        },
      },
      eligibleResultLimit: baseRequest.eligibleResultLimit,
      evidenceNeededResultLimit: baseRequest.evidenceNeededResultLimit,
    });
    expect(created.engine.retrieve(mismatchedExpansion)).toMatchObject({
      ok: false,
      issues: [{ code: 'authority-binding-mismatch' }],
    });
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
        retrievalExpansionAuthority: retrievalExpansion,
        candidateRetrievalMetadataAuthority: metadataAuthority,
        expectedCandidateRetrievalMetadataAuthorityBinding:
          expectedMetadataBinding,
      }),
    ).toMatchObject({ ok: false });
    expect(
      createCandidateRetrievalEngineV1({
        taxonomy,
        candidateProfileAuthority: profileAuthority,
        retrievalExpansionAuthority: {
          ...retrievalExpansion,
          semanticDigest: '0'.repeat(64),
        },
        candidateRetrievalMetadataAuthority: metadataAuthority,
        expectedCandidateRetrievalMetadataAuthorityBinding:
          expectedMetadataBinding,
      }),
    ).toMatchObject({
      ok: false,
      issues: [{ code: 'invalid-expansion-authority' }],
    });

    const reversedAuthority = structuredClone(rawProfileAuthority);
    reversedAuthority.profiles.reverse();
    expect(
      createCandidateRetrievalEngineV1({
        taxonomy,
        candidateProfileAuthority: reversedAuthority,
        retrievalExpansionAuthority: retrievalExpansion,
        candidateRetrievalMetadataAuthority: metadataAuthority,
        expectedCandidateRetrievalMetadataAuthorityBinding:
          expectedMetadataBinding,
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

  it('rejects a metadata snapshot mismatch before candidate evaluation', () => {
    const base = makeRequest();
    const mismatched = createCandidateRetrievalRequestV1({
      normalization: base.normalization,
      authorityBindings: {
        ...base.authorityBindings,
        retrievalMetadata: {
          ...base.authorityBindings.retrievalMetadata,
          authoritySemanticDigest: '0'.repeat(64),
        },
      },
      eligibleResultLimit: base.eligibleResultLimit,
      evidenceNeededResultLimit: base.evidenceNeededResultLimit,
    });
    const evaluator = vi.fn<typeof evaluateCandidateConstraints>();
    const views = candidateSearchViews();
    const operation = retrieveCandidateSet(
      mismatched,
      taxonomy,
      profileAuthority,
      views,
      new Map(taxonomy.concepts.map((concept) => [concept.conceptId, concept])),
      new Set(views.map(({ candidateId }) => candidateId)),
      retrievalExpansion,
      metadataChannel,
      evaluator,
    );
    expect(operation).toMatchObject({
      ok: false,
      issues: [{ code: 'metadata-snapshot-mismatch' }],
    });
    expect(evaluator).not.toHaveBeenCalled();
  });

  it('distinguishes invalid metadata from external policy and stable ownership disagreement', () => {
    const invalid = structuredClone(metadataAuthority);
    invalid.authoritySemanticDigest = '0'.repeat(64);
    expect(createEngineForMetadata(invalid)).toMatchObject({
      ok: false,
      issues: [{ code: 'invalid-metadata-authority' }],
    });

    const wrongPolicy = syntheticMetadataAuthority(new Map(), {
      ...expectedMetadataBinding,
      providerPolicyDigest: '0'.repeat(64),
    });
    expect(createEngineForMetadata(wrongPolicy)).toMatchObject({
      ok: false,
      issues: [{ code: 'metadata-authority-binding-mismatch' }],
    });

    const target = profileAuthority.profiles[0];
    if (target === undefined) throw new Error('Profile authority is empty.');
    const wrongOwnership = syntheticMetadataAuthority(
      new Map([[target.candidateId, { catalogOwner: 'wrong-owner' }]]),
    );
    expect(createEngineForMetadata(wrongOwnership)).toMatchObject({
      ok: false,
      issues: [{ code: 'metadata-authority-binding-mismatch' }],
    });
  });

  it('admits provider redirects while preserving stable profile-owned candidate identity', () => {
    const target = profileAuthority.profiles.find(
      (profile) =>
        knownField(profile, 'capability-family').value.primaryFamily ===
          'authorization' &&
        knownField(profile, 'catalog-role-status').value.catalogStatus ===
          'active',
    );
    if (target === undefined) throw new Error('Active candidate is missing.');
    const repository = knownField(target, 'repository-identity');
    const redirected = syntheticMetadataAuthority(
      new Map([
        [
          target.candidateId,
          {
            providerCanonicalOwner: 'current-provider-owner',
            providerCanonicalRepository: 'current-provider-repository',
          },
        ],
      ]),
    );
    expect(
      redirected.candidates.find(
        ({ candidateId }) => candidateId === target.candidateId,
      ),
    ).toMatchObject({
      catalogOwner: repository.value.githubOwner,
      catalogRepository: repository.value.githubRepository,
      providerCanonicalOwner: 'current-provider-owner',
      providerCanonicalRepository: 'current-provider-repository',
      repositoryIdentityState: 'redirected',
    });
    const created = createEngineForMetadata(redirected);
    expect(created.ok).toBe(true);
  });

  it('emits one bounded metadata component with normalized provenance and no provider prose', () => {
    const target = profileAuthority.profiles.find(
      (profile) =>
        profile.candidateId === 'auth-koa-roles' &&
        knownField(profile, 'catalog-role-status').value.catalogStatus !==
          'negative-control',
    );
    if (target === undefined) throw new Error('Metadata target is missing.');
    const activated = syntheticMetadataAuthority(
      new Map([
        [
          target.candidateId,
          {
            description: 'Private provider prose that must never be returned.',
            topics: ['authorization'],
            primaryLanguage: 'TypeScript',
          },
        ],
      ]),
    );
    const created = createEngineForMetadata(activated);
    if (!created.ok) throw new Error('Metadata engine creation failed.');
    const request = bindRequestToMetadata(
      makeRequest([], { kind: 'candidate-id', value: target.candidateId }),
      activated,
    );
    const operation = created.engine.retrieve(request);
    expect(operation.ok).toBe(true);
    if (!operation.ok) return;
    const candidate = operation.result.eligibleCandidates.find(
      ({ candidateId }) => candidateId === target.candidateId,
    );
    const metadataMatches = candidate?.channelMatches.filter(
      ({ channelId }) => channelId === 'approved-metadata-lexical',
    );
    expect(metadataMatches).toEqual([
      {
        channelId: 'approved-metadata-lexical',
        channelVersion: 'approved-metadata-lexical/1.0.0',
        componentScore: 300,
        matchedCapabilityConceptIds: [],
        matchedProfileFieldIds: [],
        matchedExpansionEdgeIds: [],
        matchedMetadataTerms: [
          { normalizedTerm: 'authorization', source: 'topic', points: 300 },
        ],
      },
    ]);
    expect(
      candidate?.channelMatches
        .filter(({ channelId }) => channelId !== 'approved-metadata-lexical')
        .every(({ matchedMetadataTerms }) => matchedMetadataTerms.length === 0),
    ).toBe(true);
    const serialized = JSON.stringify(operation.result);
    expect(serialized).not.toContain('Private provider prose');
    expect(serialized).not.toMatch(
      /"(?:description|topics|primaryLanguage|providerCanonicalOwner|providerCanonicalRepository)"/u,
    );
  });

  it('emits no metadata component for a zero score and keeps every channel unique and bounded', () => {
    const operation = requireEngine().retrieve(makeRequest());
    if (!operation.ok) throw new Error('Retrieval failed.');
    for (const candidate of [
      ...operation.result.eligibleCandidates,
      ...operation.result.evidenceNeededCandidates,
    ]) {
      expect(
        candidate.channelMatches.some(
          ({ channelId }) => channelId === 'approved-metadata-lexical',
        ),
      ).toBe(false);
      expect(candidate.channelMatches.length).toBeLessThanOrEqual(6);
      expect(
        new Set(candidate.channelMatches.map(({ channelId }) => channelId))
          .size,
      ).toBe(candidate.channelMatches.length);
    }
  });

  it('cannot use strong metadata to change conflicts, negative controls, hard lanes, or no-eligible state', () => {
    const conflict = profileAuthority.profiles.find(
      (profile) =>
        knownField(profile, 'capability-family').value.primaryFamily !==
          'authorization' &&
        knownField(profile, 'catalog-role-status').value.catalogStatus !==
          'negative-control',
    );
    const negative = profileAuthority.profiles.find(
      (profile) =>
        knownField(profile, 'capability-family').value.primaryFamily ===
          'authorization' &&
        knownField(profile, 'catalog-role-status').value.catalogStatus ===
          'negative-control',
    );
    if (conflict === undefined || negative === undefined) {
      throw new Error('Safety metadata targets are missing.');
    }
    const activated = syntheticMetadataAuthority(
      new Map(
        [conflict, negative].map((profile) => [
          profile.candidateId,
          {
            description: 'Authorization authorization authorization.',
            topics: ['authorization'],
            primaryLanguage: null,
          },
        ]),
      ),
    );
    const created = createEngineForMetadata(activated);
    if (!created.ok) throw new Error('Metadata engine creation failed.');
    const baseline = requireEngine().retrieve(makeRequest());
    const measured = created.engine.retrieve(
      bindRequestToMetadata(makeRequest(), activated),
    );
    expect(baseline.ok && measured.ok).toBe(true);
    if (!baseline.ok || !measured.ok) return;
    expect(measured.result.preRetrievalLaneCounts).toEqual(
      baseline.result.preRetrievalLaneCounts,
    );
    const returned = new Set(
      [
        ...measured.result.eligibleCandidates,
        ...measured.result.evidenceNeededCandidates,
      ].map(({ candidateId }) => candidateId),
    );
    expect(returned.has(conflict.candidateId)).toBe(false);
    expect(returned.has(negative.candidateId)).toBe(false);

    const evidenceRequest = makeRequest([
      {
        constraintId: 'deployment-required-metadata',
        modality: 'required',
        statement: 'Must be self hosted.',
        originalTerm: 'self-hosted',
        facetHint: 'deployment',
        reasonCode: 'deployment-required',
      },
    ]);
    const baselineEvidence = requireEngine().retrieve(evidenceRequest);
    const measuredEvidence = created.engine.retrieve(
      bindRequestToMetadata(evidenceRequest, activated),
    );
    expect(baselineEvidence.ok && measuredEvidence.ok).toBe(true);
    if (!baselineEvidence.ok || !measuredEvidence.ok) return;
    expect(measuredEvidence.result.preRetrievalLaneCounts).toEqual(
      baselineEvidence.result.preRetrievalLaneCounts,
    );
    expect(measuredEvidence.result.preRetrievalLaneCounts.eligible).toBe(0);
    for (const candidate of measuredEvidence.result.evidenceNeededCandidates) {
      expect(candidate.lane).toBe('evidence-needed');
    }
  });

  it('builds the immutable metadata view once per engine and performs no product I/O', async () => {
    const source = await readFile(
      fileURLToPath(new URL('../src/retrieval-engine.ts', import.meta.url)),
      'utf8',
    );
    expect(
      source.match(/createApprovedMetadataLexicalChannelV1\(\{/gu),
    ).toHaveLength(1);
    expect(source).not.toMatch(
      /@gitblocks\/(?:ingestion|evaluation)|(?:readFile|fetch|https?:|process\.env|database)/u,
    );

    const mutable = structuredClone(
      syntheticMetadataAuthority(
        new Map([['auth-koa-roles', { topics: ['authorization'] }]]),
      ),
    );
    const created = createEngineForMetadata(mutable);
    if (!created.ok) throw new Error('Metadata engine creation failed.');
    const request = bindRequestToMetadata(makeRequest(), mutable);
    const before = created.engine.retrieve(request);
    mutable.candidates.reverse();
    mutable.candidates[0]!.topics = ['caller-mutation'];
    const after = created.engine.retrieve(request);
    expect(before.ok && after.ok).toBe(true);
    if (before.ok && after.ok) {
      expect(JSON.stringify(after.result)).toBe(JSON.stringify(before.result));
    }
  });
});

function requireEngine() {
  return retrievalEngine;
}

type SyntheticMetadataOverride = Readonly<{
  catalogOwner?: string;
  catalogRepository?: string;
  providerCanonicalOwner?: string;
  providerCanonicalRepository?: string;
  description?: string | null;
  topics?: readonly string[];
  primaryLanguage?: string | null;
}>;

function syntheticMetadataAuthority(
  overrides: ReadonlyMap<string, SyntheticMetadataOverride> = new Map(),
  binding: ExpectedCandidateRetrievalMetadataAuthorityBindingV1 = expectedMetadataBinding,
): CandidateRetrievalMetadataAuthorityV1 {
  return createCandidateRetrievalMetadataAuthorityV1({
    catalogVersion: binding.catalogVersion,
    catalogDigest: binding.catalogDigest,
    providerPolicyVersion: binding.providerPolicyVersion,
    providerPolicyDigest: binding.providerPolicyDigest,
    sourceProviderPolicyVersion: binding.sourceProviderPolicyVersion,
    sourceProviderPolicyDigest: binding.sourceProviderPolicyDigest,
    sourceOperation: binding.sourceOperation,
    collectedAt: '2026-08-08T00:00:00.000Z',
    candidates: profileAuthority.profiles.map((profile) => {
      const repository = knownField(profile, 'repository-identity');
      const override = overrides.get(profile.candidateId);
      return {
        candidateId: profile.candidateId,
        catalogOwner: override?.catalogOwner ?? repository.value.githubOwner,
        catalogRepository:
          override?.catalogRepository ?? repository.value.githubRepository,
        providerCanonicalOwner:
          override?.providerCanonicalOwner ?? repository.value.githubOwner,
        providerCanonicalRepository:
          override?.providerCanonicalRepository ??
          repository.value.githubRepository,
        description: override?.description ?? null,
        topics: override?.topics ?? [],
        primaryLanguage: override?.primaryLanguage ?? null,
      };
    }),
  });
}

function createEngineForMetadata(
  authority: unknown,
  binding: ExpectedCandidateRetrievalMetadataAuthorityBindingV1 = expectedMetadataBinding,
) {
  return createCandidateRetrievalEngineV1({
    taxonomy,
    candidateProfileAuthority: profileAuthority,
    retrievalExpansionAuthority: retrievalExpansion,
    candidateRetrievalMetadataAuthority: authority,
    expectedCandidateRetrievalMetadataAuthorityBinding: binding,
  });
}

function bindRequestToMetadata(
  request: CandidateRetrievalRequestV1,
  authority: CandidateRetrievalMetadataAuthorityV1,
): CandidateRetrievalRequestV1 {
  return createCandidateRetrievalRequestV1({
    normalization: request.normalization,
    authorityBindings: {
      ...request.authorityBindings,
      retrievalMetadata: {
        authorityVersion: authority.authorityVersion,
        authoritySemanticDigest: authority.authoritySemanticDigest,
      },
    },
    eligibleResultLimit: request.eligibleResultLimit,
    evidenceNeededResultLimit: request.evidenceNeededResultLimit,
  });
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
      retrievalExpansion: {
        authorityVersion: retrievalExpansion.expansionVersion,
        semanticDigest: retrievalExpansion.semanticDigest,
      },
      retrievalMetadata: metadataChannel.authorityBinding,
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
  lane: CandidateRetrievalCandidateV1['lane'] = 'eligible',
): ScoredCandidate {
  const candidate: CandidateRetrievalCandidateV1 = {
    candidateId,
    lane,
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
        matchedExpansionEdgeIds: [],
        matchedMetadataTerms: [],
      },
    ],
    unresolvedHardEvaluations:
      lane === 'eligible'
        ? []
        : [
            {
              evaluationId: 'synthetic-unresolved-evaluation',
              sourceKind: 'normalized-constraint',
              modality: 'required',
              facet: 'deployment',
              conceptId: 'self-hosted-service',
              profileFieldId: 'deployment-self-hosting',
              match: 'unresolved',
              state: 'unresolved',
              ruleId: 'synthetic-unresolved-rule',
            },
          ],
  };
  return { candidate, repositoryIdentity, packageIdentity };
}

function candidateIdsInLane(
  candidates: readonly ScoredCandidate[],
  lane: CandidateRetrievalCandidateV1['lane'],
): readonly string[] {
  return candidates
    .filter(({ candidate }) => candidate.lane === lane)
    .map(({ candidate }) => candidate.candidateId);
}
