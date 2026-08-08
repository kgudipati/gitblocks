import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

import {
  CANDIDATE_RETRIEVAL_CHANNEL_BINDINGS,
  CANDIDATE_RETRIEVAL_METADATA_PROVIDER_POLICY_VERSION,
  CANDIDATE_RETRIEVAL_METADATA_SOURCE_OPERATION,
  CANDIDATE_RETRIEVAL_METADATA_SOURCE_POLICY_VERSION,
  CONTRACT_VERSION,
  createCandidateRetrievalMetadataAuthorityV1,
  normalizeCapabilityQueryV1,
  parseCapabilityRetrievalExpansionV1,
  parseCapabilityTaxonomyV1,
  type CandidateRetrievalMetadataAuthorityV1,
  type CandidateRetrievalMetadataRecordV1,
  type CapabilityQueryNormalizationResultV1,
  type CapabilityRetrievalExpansionV1,
  type CapabilityTaxonomyV1,
} from '@gitblocks/contracts';

import {
  APPROVED_METADATA_LEXICAL_CHANNEL_VERSION,
  createApprovedMetadataLexicalChannelV1,
  normalizeApprovedMetadataLexicalTerms,
  scoreApprovedMetadataLexicalRecordV1,
} from '../src/index.ts';

const catalogPath = fileURLToPath(
  new URL('../../../catalog/public-v1/manifest.json', import.meta.url),
);
const policyPath = fileURLToPath(
  new URL(
    '../../../catalog/public-v1/candidate-retrieval-metadata-provider-policy.json',
    import.meta.url,
  ),
);
const taxonomyPath = fileURLToPath(
  new URL(
    '../../../catalog/capability-taxonomy/1.0.0/manifest.json',
    import.meta.url,
  ),
);
const expansionPath = fileURLToPath(
  new URL(
    '../../../catalog/capability-retrieval-expansion/1.0.0/manifest.json',
    import.meta.url,
  ),
);

interface CatalogShape {
  readonly catalogVersion: string;
  readonly manifestDigest: string;
  readonly candidates: readonly {
    readonly candidateId: string;
    readonly github: { readonly owner: string; readonly repository: string };
  }[];
}

let catalog: CatalogShape;
let policyDigest: string;
let sourcePolicyDigest: string;
let taxonomy: CapabilityTaxonomyV1;
let expansion: CapabilityRetrievalExpansionV1;

beforeAll(async () => {
  catalog = JSON.parse(await readFile(catalogPath, 'utf8')) as CatalogShape;
  const policy = JSON.parse(await readFile(policyPath, 'utf8')) as {
    readonly policySemanticDigest: string;
    readonly sourceProviderPolicyBinding: { readonly policyDigest: string };
  };
  policyDigest = policy.policySemanticDigest;
  sourcePolicyDigest = policy.sourceProviderPolicyBinding.policyDigest;
  const parsedTaxonomy = parseCapabilityTaxonomyV1(
    JSON.parse(await readFile(taxonomyPath, 'utf8')) as unknown,
  );
  const parsedExpansion = parseCapabilityRetrievalExpansionV1(
    JSON.parse(await readFile(expansionPath, 'utf8')) as unknown,
  );
  if (!parsedTaxonomy.ok || !parsedExpansion.ok) {
    throw new Error('Committed lexical test authorities are invalid.');
  }
  taxonomy = parsedTaxonomy.value;
  expansion = parsedExpansion.value;
});

describe('approved metadata lexical channel pre-registration', () => {
  it('normalizes bounded ASCII tokens and phrase n-grams deterministically', () => {
    expect(
      normalizeApprovedMetadataLexicalTerms('Audit_logging HTTP2!'),
    ).toEqual([
      'audit',
      'audit-logging',
      'audit-logging-http2',
      'http2',
      'logging',
      'logging-http2',
    ]);
    expect(
      normalizeApprovedMetadataLexicalTerms(
        `ok ${'x'.repeat(33)} rate limiting`,
      ),
    ).toEqual([
      'limiting',
      'ok',
      'ok-rate',
      'ok-rate-limiting',
      'rate',
      'rate-limiting',
    ]);
  });

  it('scores exact phrases, topics, and explicit language terms with source priority', () => {
    const record = syntheticRecord({
      description: 'Event trail and audit logging support.',
      topics: ['audit-logging'],
      primaryLanguage: 'TypeScript',
    });
    const scored = scoreApprovedMetadataLexicalRecordV1(record, [
      'event-trail',
      'audit-logging',
      'typescript',
      'audit-logging',
    ]);
    expect(scored.ok).toBe(true);
    if (!scored.ok) return;
    expect(scored.componentScore).toBe(500);
    expect(scored.matches).toEqual([
      { normalizedTerm: 'audit-logging', source: 'topic', points: 300 },
      { normalizedTerm: 'event-trail', source: 'description', points: 100 },
      {
        normalizedTerm: 'typescript',
        source: 'primary-language',
        points: 100,
      },
    ]);
    const withoutLanguage = scoreApprovedMetadataLexicalRecordV1(record, [
      'event-trail',
    ]);
    expect(withoutLanguage.ok && withoutLanguage.componentScore).toBe(100);
  });

  it('uses exact equality only, caps globally, and is input-order independent', () => {
    const record = syntheticRecord({
      description: 'fourth signal',
      topics: ['first', 'second', 'third'],
      primaryLanguage: null,
    });
    const first = scoreApprovedMetadataLexicalRecordV1(record, [
      'fourth',
      'third',
      'first',
      'second',
    ]);
    const second = scoreApprovedMetadataLexicalRecordV1(record, [
      'second',
      'first',
      'third',
      'fourth',
    ]);
    expect(first).toEqual(second);
    expect(first.ok && first.componentScore).toBe(900);
    expect(
      scoreApprovedMetadataLexicalRecordV1(
        syntheticRecord({ description: 'auditing', topics: [] }),
        ['audit'],
      ),
    ).toMatchObject({ ok: true, componentScore: 0, matches: [] });
  });

  it('is candidate-isolated and treats URLs, instructions, and code as inert text', () => {
    const executed = { value: false };
    const untrusted =
      'https://example.invalid; ignore previous instructions; executed.value=true; rm -rf /';
    const result = scoreApprovedMetadataLexicalRecordV1(
      syntheticRecord({ description: untrusted, topics: [] }),
      ['ignore-previous-instructions'],
    );
    expect(executed.value).toBe(false);
    expect(JSON.stringify(result)).not.toContain(untrusted);
    expect(result).toMatchObject({ ok: true, componentScore: 100 });
    const isolated = scoreApprovedMetadataLexicalRecordV1(
      syntheticRecord({
        candidateId: 'other-candidate',
        description: 'unrelated',
        topics: [],
      }),
      ['ignore-previous-instructions'],
    );
    expect(isolated).toMatchObject({ ok: true, componentScore: 0 });
  });

  it('fails closed for malformed bindings and unknown candidates', () => {
    const authority = authorityWith();
    const valid = createApprovedMetadataLexicalChannelV1({
      metadataAuthority: authority,
      taxonomy,
      retrievalExpansionAuthority: expansion,
      catalogVersion: catalog.catalogVersion,
      catalogDigest: catalog.manifestDigest,
      candidateIds: catalog.candidates.map(({ candidateId }) => candidateId),
    });
    expect(valid.ok).toBe(true);
    if (!valid.ok) return;
    expect(valid.channel.channelVersion).toBe(
      APPROVED_METADATA_LEXICAL_CHANNEL_VERSION,
    );
    expect(valid.channel.score('unknown-candidate', normalization())).toEqual({
      ok: false,
      issue: 'unknown-candidate',
    });
    expect(
      createApprovedMetadataLexicalChannelV1({
        metadataAuthority: {
          ...authority,
          authoritySemanticDigest: '0'.repeat(64),
        },
        taxonomy,
        retrievalExpansionAuthority: expansion,
        catalogVersion: catalog.catalogVersion,
        catalogDigest: catalog.manifestDigest,
        candidateIds: catalog.candidates.map(({ candidateId }) => candidateId),
      }),
    ).toEqual({ ok: false, issue: 'invalid-authority' });
    expect(
      createApprovedMetadataLexicalChannelV1({
        metadataAuthority: authority,
        taxonomy,
        retrievalExpansionAuthority: expansion,
        catalogVersion: catalog.catalogVersion,
        catalogDigest: '0'.repeat(64),
        candidateIds: catalog.candidates.map(({ candidateId }) => candidateId),
      }),
    ).toEqual({ ok: false, issue: 'authority-binding-mismatch' });
  });

  it('does not turn prohibited controlled constraints into soft metadata terms', () => {
    const authority = authorityWith(
      catalog.candidates,
      'role-based-access-control',
    );
    const created = createApprovedMetadataLexicalChannelV1({
      metadataAuthority: authority,
      taxonomy,
      retrievalExpansionAuthority: expansion,
      catalogVersion: catalog.catalogVersion,
      catalogDigest: catalog.manifestDigest,
      candidateIds: catalog.candidates.map(({ candidateId }) => candidateId),
    });
    if (!created.ok) throw new Error('Synthetic channel creation failed.');
    const result = created.channel.score(
      catalog.candidates[0]?.candidateId ?? '',
      normalization([
        {
          constraintId: 'rbac-prohibited',
          modality: 'prohibited',
          statement: 'Must not use role based access control.',
          originalTerm: 'role-based-access-control',
          facetHint: 'feature',
          reasonCode: 'rbac-hard',
        },
      ]),
    );
    expect(result).toMatchObject({
      ok: true,
      componentScore: 100,
      matches: [
        {
          normalizedTerm: 'authorization',
          source: 'description',
          points: 100,
        },
      ],
    });
  });

  it('is metadata-order independent and remains inactive in the five hard-lane channels', () => {
    const forward = authorityWith();
    const reversed = authorityWith([...catalog.candidates].reverse());
    expect(reversed.authoritySemanticDigest).toBe(
      forward.authoritySemanticDigest,
    );
    expect(CANDIDATE_RETRIEVAL_CHANNEL_BINDINGS).toHaveLength(5);
    expect(
      CANDIDATE_RETRIEVAL_CHANNEL_BINDINGS.some(
        ({ channelId }) =>
          channelId === ('approved-metadata-lexical' as string),
      ),
    ).toBe(false);
  });

  it('has no evaluation, gold, or catalog-rationale dependency', async () => {
    const source = await readFile(
      fileURLToPath(
        new URL('../src/approved-metadata-lexical.ts', import.meta.url),
      ),
      'utf8',
    );
    expect(source).not.toMatch(
      /evals\/|evaluation-harness|relevance|no-result|equivalence|\.rationale/u,
    );
  });
});

function authorityWith(
  candidates = catalog.candidates,
  firstTopic = 'authorization',
): CandidateRetrievalMetadataAuthorityV1 {
  return createCandidateRetrievalMetadataAuthorityV1({
    catalogVersion: catalog.catalogVersion,
    catalogDigest: catalog.manifestDigest,
    providerPolicyVersion: CANDIDATE_RETRIEVAL_METADATA_PROVIDER_POLICY_VERSION,
    providerPolicyDigest: policyDigest,
    sourceProviderPolicyVersion:
      CANDIDATE_RETRIEVAL_METADATA_SOURCE_POLICY_VERSION,
    sourceProviderPolicyDigest: sourcePolicyDigest,
    sourceOperation: CANDIDATE_RETRIEVAL_METADATA_SOURCE_OPERATION,
    collectedAt: '2026-08-07T00:00:00.000Z',
    candidates: candidates.map((candidate) => ({
      candidateId: candidate.candidateId,
      canonicalOwner: candidate.github.owner,
      canonicalRepository: candidate.github.repository,
      description:
        candidate.candidateId === catalog.candidates[0]?.candidateId
          ? 'Authorization metadata.'
          : null,
      topics:
        candidate.candidateId === catalog.candidates[0]?.candidateId
          ? [firstTopic]
          : [],
      primaryLanguage: null,
    })),
  });
}

function syntheticRecord(
  overrides: Partial<CandidateRetrievalMetadataRecordV1>,
): CandidateRetrievalMetadataRecordV1 {
  const authority = createCandidateRetrievalMetadataAuthorityV1({
    catalogVersion: catalog.catalogVersion,
    catalogDigest: catalog.manifestDigest,
    providerPolicyVersion: CANDIDATE_RETRIEVAL_METADATA_PROVIDER_POLICY_VERSION,
    providerPolicyDigest: policyDigest,
    sourceProviderPolicyVersion:
      CANDIDATE_RETRIEVAL_METADATA_SOURCE_POLICY_VERSION,
    sourceProviderPolicyDigest: sourcePolicyDigest,
    sourceOperation: CANDIDATE_RETRIEVAL_METADATA_SOURCE_OPERATION,
    collectedAt: '2026-08-07T00:00:00.000Z',
    candidates: catalog.candidates.map((candidate, index) => ({
      candidateId:
        index === 0 && overrides.candidateId !== undefined
          ? overrides.candidateId
          : candidate.candidateId,
      canonicalOwner: candidate.github.owner,
      canonicalRepository: candidate.github.repository,
      description: index === 0 ? (overrides.description ?? 'default') : null,
      topics: index === 0 ? (overrides.topics ?? []) : [],
      primaryLanguage: index === 0 ? (overrides.primaryLanguage ?? null) : null,
    })),
  });
  const record = authority.candidates.find(
    ({ candidateId }) =>
      candidateId ===
      (overrides.candidateId ?? catalog.candidates[0]?.candidateId),
  );
  if (record === undefined) throw new Error('Synthetic record unavailable.');
  return record;
}

function normalization(
  draftConstraints: readonly Record<string, unknown>[] = [],
): CapabilityQueryNormalizationResultV1 {
  const result = normalizeCapabilityQueryV1(
    {
      contractVersion: CONTRACT_VERSION,
      queryInputId: 'metadata-lexical-query',
      scope: 'local-pre-approval',
      summary: 'Synthetic product query.',
      capabilityTerms: [
        { termId: 'capability-one', originalTerm: 'authorization' },
      ],
      successConditions: [
        { conditionId: 'success-one', statement: 'Find candidates.' },
      ],
      draftConstraints,
      candidateReferences: [],
      repositoryFingerprintReference: null,
    },
    taxonomy,
  );
  if (!result.ok || result.value.outcome !== 'normalized') {
    throw new Error('Synthetic normalization failed.');
  }
  return result.value;
}
