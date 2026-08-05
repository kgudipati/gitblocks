import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import process from 'node:process';

import {
  parseCapabilityTaxonomyV1,
  parseDeterministicCandidateProfileAuthorityV1,
} from '@gitblocks/contracts';

import {
  RETRIEVAL_FAMILIES,
  RETRIEVAL_VERSIONS,
} from '../dist/src/retrieval/contracts.js';
import { generateHardFilterProjection } from '../dist/src/retrieval/hard-filter.js';
import {
  buildCandidateReferenceAuthority,
  normalizeRetrievalQuery,
  projectNormalization,
} from '../dist/src/retrieval/normalization.js';
import { retrievalCorpusSemanticDigest } from '../dist/src/retrieval/corpus.js';
import { retrievalStableJson } from '../dist/src/retrieval/stable-json.js';

const repositoryRoot = process.cwd();
const corpusRoot = join(repositoryRoot, 'evals/retrieval-v1');
const taxonomy = json('catalog/capability-taxonomy/1.0.0/manifest.json');
const profileValue = json('catalog/public-v1/candidate-profile-authority.json');
const parsedTaxonomy = parseCapabilityTaxonomyV1(taxonomy);
const parsedProfiles =
  parseDeterministicCandidateProfileAuthorityV1(profileValue);
if (!parsedTaxonomy.ok || !parsedProfiles.ok)
  throw new Error('Accepted authority failed.');
const profiles = parsedProfiles.domain;
const candidateAuthority = buildCandidateReferenceAuthority(profiles);
const candidateRecords = new Map(
  profiles.profiles.map((profile) => {
    const family = field(profile, 'capability-family').value;
    const status = field(profile, 'catalog-role-status').value.catalogStatus;
    return [
      profile.candidateId,
      {
        family: family.primaryFamily,
        additional: family.additionalFamilies,
        status,
      },
    ];
  }),
);
const provenance = Object.freeze({
  status: 'proposed',
  reviewStatus: 'not-reviewed',
  reviewer: null,
  reviewedAt: null,
  reviewReference: null,
});
const familyDesign = {
  authorization: {
    alias: 'authz',
    narrow: 'role-based-access-control',
    compare: ['auth-casbin-casbin-js', 'auth-casbin-node-casbin'],
    negative: 'auth-auth0-node-jsonwebtoken',
    ambiguity: 'access-control',
    contradiction: 'role-based-access-control',
    anchor: 'auth-open-policy-agent',
  },
  'audit-logging': {
    alias: 'audit-trail',
    narrow: 'actor-request-context',
    compare: ['audit-winston', 'audit-winston-daily'],
    negative: 'audit-datadog-trace-js',
    ambiguity: 'event-logging',
    contradiction: 'structured-audit-events',
    anchor: 'audit-winston',
  },
  'background-jobs': {
    alias: 'background-job',
    narrow: 'delayed-jobs',
    compare: ['jobs-node-cron', 'jobs-node-schedule'],
    negative: 'jobs-p-queue',
    ambiguity: 'job-queue',
    contradiction: 'delayed-jobs',
    anchor: 'jobs-bullmq',
  },
  'rate-limiting': {
    alias: 'rate-limiter',
    narrow: 'token-bucket',
    compare: ['rate-envoy', 'rate-envoy-ratelimit'],
    negative: 'rate-envoy',
    ambiguity: 'throttling',
    contradiction: 'token-bucket',
    anchor: 'rate-express-rate-limit',
  },
  webhooks: {
    alias: 'web-hook',
    narrow: 'signature-verification',
    compare: ['webhook-octokit-app', 'webhook-octokit-webhooks'],
    negative: 'webhook-localtunnel',
    ambiguity: 'webhook-platform',
    contradiction: 'signature-verification',
    anchor: 'webhook-svix',
  },
};

rmSync(corpusRoot, { recursive: true, force: true });
const files = new Map();

for (const family of RETRIEVAL_FAMILIES) {
  const design = familyDesign[family];
  for (let slot = 1; slot <= 6; slot += 1) {
    const caseId = `ret-${family}-${String(slot).padStart(2, '0')}`;
    const tags = retrievalTags(slot);
    const constraints = [];
    const references = [];
    let term = family;
    if (slot === 2) term = design.alias;
    if (slot === 3) {
      constraints.push(
        constraint(
          caseId,
          'preferred',
          'feature',
          design.narrow,
          'preferred capability detail',
        ),
      );
    }
    if (slot === 4) {
      references.push(
        ...design.compare.map((candidateId, index) =>
          reference(caseId, candidateId, index),
        ),
      );
    }
    if (slot === 5) {
      constraints.push(
        constraint(
          caseId,
          'required',
          'deployment',
          'self-hosted',
          'must be self hosted',
        ),
        constraint(
          caseId,
          'prohibited',
          'infrastructure',
          'external-hosted-service',
          'must not require an external hosted service',
        ),
        constraint(
          caseId,
          'prohibited',
          'infrastructure',
          'kubernetes',
          'must not require kubernetes',
        ),
      );
    }
    if (slot === 6) references.push(reference(caseId, design.negative, 0));
    const query = queryDocument(
      caseId,
      'retrieval',
      family,
      tags,
      [term],
      constraints,
      references,
    );
    write(`queries/retrieval/${caseId}.json`, query, 'retrieval-query', caseId);
    authorGold(query, slot, design);
  }
  for (let slot = 1; slot <= 4; slot += 1) {
    const caseId = `norm-${family}-${String(slot).padStart(2, '0')}`;
    const authored = normalizationCase(caseId, family, slot, design);
    const query = queryDocument(
      caseId,
      'normalization-adversarial',
      family,
      authored.tags,
      authored.terms,
      authored.constraints,
      authored.references,
      authored.summary,
    );
    write(
      `queries/normalization/${caseId}.json`,
      query,
      'normalization-query',
      caseId,
    );
    authorNormalizationGold(query, true);
  }
}

const equivalence = {
  equivalenceVersion: RETRIEVAL_VERSIONS.equivalence,
  catalogVersion: profiles.catalogVersion,
  catalogDigest: profiles.catalogDigest,
  groups: [
    group('equiv-casbin-implementations', 'ecosystem-implementation-variant', [
      'auth-casbin-casbin',
      'auth-casbin-casbin-js',
      'auth-casbin-node-casbin',
    ]),
    group('equiv-envoy-rate-limit-companions', 'parent-focused-companion', [
      'rate-envoy',
      'rate-envoy-ratelimit',
    ]),
    group('equiv-in-process-job-schedulers', 'functional-overlap', [
      'jobs-bree',
      'jobs-node-cron',
      'jobs-node-schedule',
      'jobs-toad-scheduler',
    ]),
    group('equiv-octokit-webhook-ecosystem', 'ecosystem-companion', [
      'webhook-octokit-app',
      'webhook-octokit-methods',
      'webhook-octokit-webhooks',
    ]),
    group('equiv-winston-ecosystem', 'ecosystem-companion', [
      'audit-google-logging-winston',
      'audit-winston',
      'audit-winston-daily',
      'audit-winston-logform',
      'audit-winston-syslog',
      'audit-winston-transport',
    ]),
  ],
  provenance,
};
write('equivalence.json', equivalence, 'equivalence', null);

const sortedFiles = [...files.values()].sort((a, b) => compare(a.path, b.path));
const manifestWithoutDigest = {
  corpusId: 'retrieval-v1',
  corpusVersion: RETRIEVAL_VERSIONS.corpus,
  taxonomyVersion: profiles.taxonomyVersion,
  taxonomyDigest: profiles.taxonomySemanticDigest,
  queryInputSchemaDigest:
    'd48e018b71f8e6947f60f4d3559c48047daba8a335168b51f37bfb5199c81b9b',
  normalizationResultSchemaDigest:
    'bdd7db9510937c0728f87b0d83f75dbd374555fa17c2b1e4a56399d9f9f2d06b',
  profileSchemaDigest:
    '3bbfdf2050c13a3d70e9dc289db7c8768a6fdcba8605cf12191e08560387af61',
  profileAuthoritySchemaDigest:
    '7a79a1671bf461127099e3ae2f75d29e949387987041bd3402f2614b747ed8cf',
  profileAuthorityVersion: profiles.authorityVersion,
  profileAuthorityDigest: profiles.semanticAuthorityDigest,
  catalogVersion: profiles.catalogVersion,
  catalogDigest: profiles.catalogDigest,
  caseCounts: { normalization: 20, retrieval: 30 },
  familyCounts: Object.fromEntries(
    RETRIEVAL_FAMILIES.map((family) => [
      family,
      { normalization: 4, retrieval: 6 },
    ]),
  ),
  files: sortedFiles,
  provenance,
};
const manifest = {
  ...manifestWithoutDigest,
  corpusSemanticDigest: retrievalCorpusSemanticDigest(manifestWithoutDigest),
};
writeFile('manifest.json', manifest);
writeText(
  'README.md',
  `# retrieval-v1\n\nThis immutable, offline evaluation-only corpus contains 30 retrieval cases and\n20 normalization/adversarial cases, exactly six and four per capability family.\nIts version is \`retrieval-evaluation-corpus/1.0.0\`, and its semantic digest is\n\`e133c0fa00b6063e7360ce5ebfdf27893f72ee5ca5e39fbe5d82c1e944831917\`.\n\nQuery inputs are blind. Normalization, clarification, hard-filter, relevance,\nequivalence, and no-result gold are physically separate and proposed/not\nindependently reviewed. Hard-filter matrices are regenerated from the accepted\n150-profile authority; they are not committed. Relevance measures\ncapability-query relevance, not viability, adoption fit, quality, ranking, or\nrecommendation. See the\n[authoring and scoring protocol](../../docs/evaluation/retrieval-v1-authoring-protocol.md).\nMilestone 6 owns all deterministic baselines and any baseline report.\n`,
);

function authorGold(query, slot, design) {
  const normalized = authorNormalizationGold(query, false);
  if (normalized.outcome !== 'normalized')
    throw new Error(`Retrieval case did not normalize: ${query.caseId}`);
  const generated = generateHardFilterProjection(normalized, profiles);
  const auditSample = auditSamples(query, generated, design);
  write(
    `gold/hard-filters/${query.caseId}.json`,
    {
      projectionVersion: RETRIEVAL_VERSIONS.hardFilterProjection,
      caseId: query.caseId,
      profileAuthorityVersion: profiles.authorityVersion,
      profileAuthorityDigest: profiles.semanticAuthorityDigest,
      taxonomyVersion: profiles.taxonomyVersion,
      taxonomyDigest: profiles.taxonomySemanticDigest,
      catalogVersion: profiles.catalogVersion,
      catalogDigest: profiles.catalogDigest,
      projectionDigest: generated.digest,
      hardStateCounts: generated.hardStateCounts,
      laneCounts: generated.laneCounts,
      auditSample,
      provenance,
    },
    'hard-filter-gold',
    query.caseId,
  );
  const universe = profiles.profiles
    .filter((profile) => {
      const record = candidateRecords.get(profile.candidateId);
      return (
        record.status !== 'negative-control' &&
        (record.family === query.capabilityFamily ||
          record.additional.includes(query.capabilityFamily))
      );
    })
    .map(({ candidateId }) => candidateId);
  const named = new Set(
    query.queryInput.candidateReferences.map(({ value }) => value),
  );
  const judgments = universe.map((candidateId) => {
    let grade = slot === 3 || slot === 4 ? 1 : 2;
    if (candidateId === design.anchor || named.has(candidateId)) grade = 3;
    return {
      candidateId,
      grade,
      reasonCodes: [
        named.has(candidateId)
          ? 'explicit-candidate-intent'
          : slot === 3
            ? 'family-adjacent-narrow-intent'
            : 'catalog-family-capability-match',
      ],
      provenance,
    };
  });
  write(
    `gold/relevance/${query.caseId}.json`,
    {
      relevanceGoldVersion: RETRIEVAL_VERSIONS.relevanceGold,
      caseId: query.caseId,
      judgments,
      provenance,
    },
    'relevance-gold',
    query.caseId,
  );
  write(
    `gold/no-result/${query.caseId}.json`,
    {
      noResultGoldVersion: RETRIEVAL_VERSIONS.noResultGold,
      caseId: query.caseId,
      expectedOutcome:
        generated.laneCounts.eligible === 0
          ? 'no-eligible-candidate'
          : 'eligible-candidates-present',
      eligibleCount: generated.laneCounts.eligible,
      evidenceNeededCount: generated.laneCounts['evidence-needed'],
      excludedCount: generated.laneCounts.excluded,
      provenance,
    },
    'no-result-gold',
    query.caseId,
  );
}

function authorNormalizationGold(query, clarification) {
  const result = normalizeRetrievalQuery(
    query,
    parsedTaxonomy.value,
    candidateAuthority,
  );
  const expected = projectNormalization(result);
  write(
    `gold/normalization/${query.caseId}.json`,
    {
      normalizationGoldVersion: RETRIEVAL_VERSIONS.normalizationGold,
      caseId: query.caseId,
      expected,
      provenance,
    },
    'normalization-gold',
    query.caseId,
  );
  if (clarification) {
    write(
      `gold/clarification/${query.caseId}.json`,
      {
        clarificationGoldVersion: RETRIEVAL_VERSIONS.clarificationGold,
        caseId: query.caseId,
        clarificationRequired: result.outcome === 'clarification-required',
        clarifications: expected.clarifications,
        terminalUnsupported: result.outcome === 'unsupported',
        provenance,
      },
      'clarification-gold',
      query.caseId,
    );
  }
  return result;
}

function auditSamples(query, generated, design) {
  const pick = (predicate) => generated.decisions.find(predicate);
  const familyOf = (candidateId) => candidateRecords.get(candidateId).family;
  const roles = [
    ['eligible', pick((entry) => entry.lane === 'eligible')],
    ['evidence-needed', pick((entry) => entry.lane === 'evidence-needed')],
    ['hard-conflict', pick((entry) => entry.hardState === 'conflict')],
    [
      'cross-family',
      pick((entry) => familyOf(entry.candidateId) !== query.capabilityFamily),
    ],
    ['negative-control', pick((entry) => entry.negativeControl)],
    [
      'material-edge',
      generated.decisions.find(
        ({ candidateId }) => candidateId === design.negative,
      ) ?? generated.decisions[0],
    ],
  ];
  return roles
    .filter(([, entry]) => entry !== undefined)
    .map(([sampleRole, entry]) => ({
      sampleRole,
      candidateId: entry.candidateId,
      hardState: entry.hardState,
      lane: entry.lane,
      reasonCode:
        sampleRole === 'negative-control'
          ? 'catalog-negative-control-exclusion'
          : sampleRole === 'cross-family' || sampleRole === 'hard-conflict'
            ? 'generated-primary-family-conflict'
            : sampleRole === 'evidence-needed'
              ? 'generated-hard-state-unresolved'
              : sampleRole === 'eligible'
                ? 'generated-hard-state-satisfied'
                : 'proposed-material-edge-sample',
      provenance,
    }))
    .sort((left, right) => compare(left.sampleRole, right.sampleRole));
}

function retrievalTags(slot) {
  const common = ['family-balanced'];
  if (slot === 1)
    return [...common, 'positive-multiple-relevant', 'slot-exact-family'];
  if (slot === 2)
    return [
      ...common,
      'active-alias',
      'positive-multiple-relevant',
      'slot-active-alias',
    ];
  if (slot === 3)
    return [
      ...common,
      'preferred-constraint',
      'positive-multiple-relevant',
      'slot-narrower-intent',
    ];
  if (slot === 4)
    return [
      ...common,
      'equivalence-safety',
      'positive-multiple-relevant',
      'same-family-comparison',
      'slot-candidate-comparison',
    ];
  if (slot === 5)
    return [
      ...common,
      'deployment-self-hosting',
      'evidence-needed',
      'infrastructure-exclusion',
      'no-eligible-candidate',
      'prohibited-constraint',
      'required-constraint',
      'slot-hard-constraint',
    ];
  return [
    ...common,
    'equivalence-safety',
    'negative-control-safety',
    'positive-multiple-relevant',
    'slot-negative-control',
  ];
}

function normalizationCase(caseId, family, slot, design) {
  if (slot === 1) {
    const tags = ['alias-evaluation'];
    const constraints = [];
    const references = [];
    if (family === 'authorization') {
      tags.push('same-family-comparison');
      references.push(
        ...design.compare.map((candidateId, index) =>
          reference(caseId, candidateId, index),
        ),
      );
    }
    if (family === 'audit-logging') {
      tags.push('unknown-preferred-nonblocking');
      constraints.push(
        constraint(
          caseId,
          'preferred',
          'other',
          'quiet-mode-unknown',
          'prefer an unclassified quiet mode',
        ),
      );
    }
    return {
      tags,
      terms: [design.alias],
      constraints,
      references,
      summary: 'Structured alias fields own meaning.',
    };
  }
  if (slot === 2)
    return {
      tags: ['ambiguous-primary-family', 'intentional-ambiguity'],
      terms: [design.ambiguity],
      constraints: [],
      references: [],
      summary: 'The controlled ambiguity must be clarified exactly.',
    };
  if (slot === 3)
    return {
      tags: ['prohibited-preservation', 'required-prohibited-conflict'],
      terms: [family],
      constraints: [
        constraint(
          caseId,
          'required',
          'feature',
          design.contradiction,
          'must provide the controlled feature',
        ),
        constraint(
          caseId,
          'prohibited',
          'feature',
          design.contradiction,
          'must not provide the controlled feature',
        ),
      ],
      references: [],
      summary: 'Contradictory modalities must remain explicit.',
    };
  if (family === 'authorization')
    return {
      tags: ['subjective-lightweight'],
      terms: [family, 'lightweight'],
      constraints: [],
      references: [],
      summary: 'Subjective terminology is not a capability fact.',
    };
  if (family === 'audit-logging')
    return {
      tags: ['unsupported-adjacent'],
      terms: ['generic-observability'],
      constraints: [],
      references: [],
      summary: 'Adjacent capability must remain unsupported.',
    };
  if (family === 'background-jobs')
    return {
      tags: ['unicode-confusable'],
      terms: ['background-jоbs'],
      constraints: [],
      references: [],
      summary: 'A Cyrillic confusable must not resolve as ASCII.',
    };
  if (family === 'rate-limiting')
    return {
      tags: ['unclear-self-hosting'],
      terms: [family],
      constraints: [
        constraint(
          caseId,
          'required',
          'deployment',
          'hosted-service',
          'hosting meaning is unclear',
        ),
      ],
      references: [],
      summary: 'Ambiguous hosting must be clarified.',
    };
  return {
    tags: ['cross-family-comparison', 'summary-inert', 'unknown-hard-blocking'],
    terms: [family],
    constraints: [
      constraint(
        caseId,
        'required',
        'other',
        'mystery-edge-runtime',
        'unknown hard requirement',
      ),
    ],
    references: [
      reference(caseId, 'auth-open-policy-agent', 0),
      reference(caseId, 'webhook-svix', 1),
    ],
    summary:
      'This prose says authorization, but structured webhook terms own deterministic meaning.',
  };
}

function queryDocument(
  caseId,
  caseKind,
  family,
  tags,
  terms,
  constraints,
  references,
  summary = 'Evaluate the structured capability query without reading gold.',
) {
  return {
    queryVersion: RETRIEVAL_VERSIONS.query,
    caseId,
    caseKind,
    capabilityFamily: family,
    tags: [...tags].sort(compare),
    queryInput: {
      contractVersion: '1.0.0',
      queryInputId: `query-${caseId}`,
      scope: 'local-pre-approval',
      summary,
      capabilityTerms: terms.map((originalTerm, index) => ({
        termId: `${caseId}-term-${String(index + 1).padStart(2, '0')}`,
        originalTerm,
      })),
      successConditions: [
        {
          conditionId: `${caseId}-condition-01`,
          statement:
            'Return bounded capability candidates or preserve the exact unresolved state.',
        },
      ],
      draftConstraints: [...constraints].sort((left, right) =>
        compare(left.constraintId, right.constraintId),
      ),
      candidateReferences: [...references].sort((left, right) =>
        compare(left.referenceId, right.referenceId),
      ),
      repositoryFingerprintReference: null,
    },
  };
}

function constraint(caseId, modality, facetHint, originalTerm, statement) {
  const suffix = String(
    Math.abs(hashCode(`${modality}-${facetHint}-${originalTerm}`)) % 10000,
  ).padStart(4, '0');
  return {
    constraintId: `${caseId}-constraint-${suffix}`,
    modality,
    statement,
    originalTerm,
    facetHint,
    reasonCode: 'evaluation-structured-constraint',
  };
}

function reference(caseId, candidateId, index) {
  return {
    referenceId: `${caseId}-reference-${String(index + 1).padStart(2, '0')}`,
    kind: 'candidate-id',
    value: candidateId,
    intent: 'compare',
  };
}

function group(groupId, relationshipKind, candidateIds) {
  return {
    groupId,
    relationshipKind,
    candidateIds: [...candidateIds].sort(compare),
    provenance,
  };
}

function write(path, value, kind, caseId) {
  writeFile(path, value);
  const bytes = readFileSync(join(corpusRoot, path));
  files.set(path, {
    path,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    kind,
    caseId,
  });
}

function writeFile(path, value) {
  const absolute = join(corpusRoot, path);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, retrievalStableJson(value), 'utf8');
}

function writeText(path, value) {
  const absolute = join(corpusRoot, path);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, value, 'utf8');
}

function json(path) {
  return JSON.parse(readFileSync(join(repositoryRoot, path), 'utf8'));
}
function field(profile, fieldId) {
  const result = profile.fields.find(
    (candidate) => candidate.fieldId === fieldId,
  );
  if (result?.state !== 'known')
    throw new Error('Required profile field missing.');
  return result;
}
function compare(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}
function hashCode(value) {
  let hash = 0;
  for (const character of value)
    hash = (hash * 31 + character.codePointAt(0)) | 0;
  return hash;
}
