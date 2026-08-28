import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  canonicalizeCapabilityTaxonomy,
  lookupCapabilityTaxonomyTerm,
} from '@gitblocks/domain';

import {
  CONTRACT_SCHEMA_NAMES,
  buildCapabilityTaxonomyV1,
  capabilityTaxonomySemanticDigest,
  getContractSchemaV1,
  parseCapabilityTaxonomySourceV1,
  parseCapabilityTaxonomyV1,
  serializeCapabilityTaxonomyV1,
  type CapabilityTaxonomySourceV1,
  type CapabilityTaxonomyV1,
} from '../src/index.ts';

const sourcePath = fileURLToPath(
  new URL(
    '../../../catalog/capability-taxonomy/1.0.0/source.json',
    import.meta.url,
  ),
);
const manifestPath = fileURLToPath(
  new URL(
    '../../../catalog/capability-taxonomy/1.0.0/manifest.json',
    import.meta.url,
  ),
);

async function loadSource(): Promise<CapabilityTaxonomySourceV1> {
  const value = JSON.parse(await readFile(sourcePath, 'utf8')) as unknown;
  const parsed = parseCapabilityTaxonomySourceV1(value);
  if (!parsed.ok) {
    throw new Error('Test taxonomy source must be valid.');
  }
  return parsed.value;
}

async function loadManifest(): Promise<CapabilityTaxonomyV1> {
  const value = JSON.parse(await readFile(manifestPath, 'utf8')) as unknown;
  const parsed = parseCapabilityTaxonomyV1(value);
  if (!parsed.ok) {
    throw new Error('Test taxonomy manifest must be valid.');
  }
  return parsed.value;
}

function clone<Value>(value: Value): Value {
  return structuredClone(value);
}

describe('capability taxonomy contracts', () => {
  it('parses the complete V1 source and generated authority', async () => {
    const source = await loadSource();
    const manifest = await loadManifest();

    expect(source).toMatchObject({ taxonomyVersion: '1.0.0' });
    expect(manifest).toMatchObject({
      contractVersion: '1.0.0',
      taxonomyVersion: '1.0.0',
      semanticDigest:
        '8b2806ec8862390d0368e1c06ed657983916530f1207be9072d9e4787a61d80e',
    });
    expect(buildCapabilityTaxonomyV1(source)).toEqual(manifest);
    expect(serializeCapabilityTaxonomyV1(manifest)).toBe(
      await readFile(manifestPath, 'utf8'),
    );
  });

  it('keeps the source and authority closed, exact-versioned, and bounded', async () => {
    const source = await loadSource();
    for (const invalid of [
      { ...source, unknown: true },
      { ...source, taxonomyVersion: '1.0.1' },
      {
        ...source,
        concepts: source.concepts.map((concept, index) =>
          index === 0 ? { ...concept, conceptId: 'Invalid_ID' } : concept,
        ),
      },
      {
        ...source,
        concepts: source.concepts.map((concept, index) =>
          index === 0
            ? { ...concept, applicableFamilyIds: ['payments'] }
            : concept,
        ),
      },
      {
        ...source,
        concepts: source.concepts.map((concept, index) =>
          index === 0 ? { ...concept, definition: 'x'.repeat(501) } : concept,
        ),
      },
      {
        ...source,
        concepts: Array.from({ length: 257 }, (_, index) => ({
          ...source.concepts[0]!,
          conceptId: `concept-${String(index)}`,
        })),
      },
    ]) {
      expect(parseCapabilityTaxonomySourceV1(invalid).ok).toBe(false);
    }

    const manifest = await loadManifest();
    expect(
      parseCapabilityTaxonomyV1({ ...manifest, contractVersion: '1.0.1' }).ok,
    ).toBe(false);
    expect(parseCapabilityTaxonomyV1({ ...manifest, unknown: true }).ok).toBe(
      false,
    );

    const tooDeep: Record<string, unknown> = {};
    let cursor = tooDeep;
    for (let depth = 0; depth < 34; depth += 1) {
      const next: Record<string, unknown> = {};
      cursor['nested'] = next;
      cursor = next;
    }
    expect(
      parseCapabilityTaxonomySourceV1({ ...source, unknown: tooDeep }),
    ).toMatchObject({
      ok: false,
      issues: [{ code: 'contract.input-depth' }],
    });

    const excessiveNodes = Array.from({ length: 101 }, () =>
      Array.from({ length: 2_000 }, () => null),
    );
    expect(
      parseCapabilityTaxonomySourceV1({ ...source, unknown: excessiveNodes }),
    ).toMatchObject({
      ok: false,
      issues: [{ code: 'contract.input-complexity' }],
    });
  });

  it('does not mutate, coerce, or retain caller-owned array order', async () => {
    const source = await loadSource();
    const before = clone(source);
    const reversed = {
      ...source,
      concepts: [...source.concepts].reverse(),
      resolvedAliases: [...source.resolvedAliases].reverse(),
      ambiguities: [...source.ambiguities].reverse(),
      exclusions: [...source.exclusions].reverse(),
    };

    expect(parseCapabilityTaxonomySourceV1(source).ok).toBe(true);
    expect(source).toEqual(before);
    expect(buildCapabilityTaxonomyV1(reversed)).toEqual(
      buildCapabilityTaxonomyV1(source),
    );
    expect(reversed.concepts[0]).toEqual(source.concepts.at(-1));

    const mutableSource = clone(source);
    const generated = buildCapabilityTaxonomyV1(mutableSource);
    mutableSource.releaseMetadata.notes = 'caller mutation';
    mutableSource.resolvedAliases[0]!.aliasKey = 'caller-mutation';
    expect(generated.releaseMetadata.notes).not.toBe('caller mutation');
    expect(generated.resolvedAliases[0]!.aliasKey).not.toBe('caller-mutation');
  });

  it('binds semantic changes while excluding only release metadata', async () => {
    const source = await loadSource();
    const original = buildCapabilityTaxonomyV1(source);
    const semanticChange = buildCapabilityTaxonomyV1({
      ...source,
      concepts: source.concepts.map((concept, index) =>
        index === 0
          ? { ...concept, definition: `${concept.definition} Exact scope.` }
          : concept,
      ),
    });
    const releaseOnly = buildCapabilityTaxonomyV1({
      ...source,
      releaseMetadata: {
        ...source.releaseMetadata,
        notes: 'A different non-semantic release note.',
      },
    });

    expect(semanticChange.semanticDigest).not.toBe(original.semanticDigest);
    expect(releaseOnly.semanticDigest).toBe(original.semanticDigest);
    expect(capabilityTaxonomySemanticDigest(original)).toBe(
      original.semanticDigest,
    );
  });

  it('rejects ordering, digest, and source/authority drift', async () => {
    const manifest = await loadManifest();
    const outOfOrder = {
      ...manifest,
      concepts: [...manifest.concepts].reverse(),
    };

    expect(parseCapabilityTaxonomyV1(outOfOrder).ok).toBe(false);
    expect(
      parseCapabilityTaxonomyV1({
        ...manifest,
        semanticDigest: '0'.repeat(64),
      }).ok,
    ).toBe(false);
  });

  it('rejects non-ASCII keys and never resolves confusable input', async () => {
    const source = await loadSource();
    const nonAscii = {
      ...source,
      resolvedAliases: source.resolvedAliases.map((alias, index) =>
        index === 0 ? { ...alias, aliasKey: 'аuthorization' } : alias,
      ),
    };

    expect(parseCapabilityTaxonomySourceV1(nonAscii).ok).toBe(false);
  });

  it('contains the exact family roots, semantic distinctions, and boundary terms', async () => {
    const source = await loadSource();
    const concepts = new Map(
      source.concepts.map((concept) => [concept.conceptId, concept]),
    );
    const familyRoots = source.concepts
      .filter(({ kind }) => kind === 'family')
      .map(({ conceptId }) => conceptId);
    const expectedFamilyRoots = [
      'authorization',
      'audit-logging',
      'background-jobs',
      'rate-limiting',
      'webhooks',
    ] as const;
    const resolvedKeys = new Set(
      source.resolvedAliases.map(({ aliasKey }) => aliasKey),
    );
    const excludedKeys = new Set(
      source.exclusions.map(({ termKey }) => termKey),
    );

    expect(familyRoots).toEqual(expectedFamilyRoots);
    for (const conceptId of [
      'external-policy-decision-point',
      'relationship-authorization-service',
      'database-audit-extension',
      'audit-storage-search-service',
      'database-backed-job-queue',
      'durable-execution-platform',
      'in-process-limiter',
      'centralized-rate-limit-service',
      'inbound-webhook-receiver',
      'outbound-webhook-dispatcher',
      'redis',
      'always-on-worker',
      'self-hosted-service',
      'database-extension',
    ]) {
      expect(concepts.has(conceptId)).toBe(true);
    }
    for (const key of [
      'authentication',
      'generic-log-formatting',
      'promise-concurrency',
      'load-balancing',
      'tunnel-only',
      'lightweight',
    ]) {
      expect(excludedKeys.has(key)).toBe(true);
      expect(resolvedKeys.has(key)).toBe(false);
    }
    for (const subjective of [
      'lightweight',
      'simple',
      'easy',
      'production-ready',
      'enterprise',
      'scalable',
    ]) {
      expect(concepts.has(subjective)).toBe(false);
      expect(resolvedKeys.has(subjective)).toBe(false);
    }
    expect(concepts.get('retries')?.applicableFamilyIds).toEqual([
      'background-jobs',
      'webhooks',
    ]);
    expect(
      source.concepts.filter(({ conceptId }) => conceptId === 'retries'),
    ).toHaveLength(1);

    expect(
      Object.fromEntries(
        expectedFamilyRoots.map((family) => [
          family,
          {
            architectures: source.concepts.filter(
              (concept) =>
                concept.kind === 'architecture' &&
                concept.applicableFamilyIds.includes(family),
            ).length,
            features: source.concepts.filter(
              (concept) =>
                concept.kind === 'feature' &&
                concept.applicableFamilyIds.includes(family),
            ).length,
          },
        ]),
      ),
    ).toEqual({
      authorization: { architectures: 7, features: 7 },
      'audit-logging': { architectures: 6, features: 7 },
      'background-jobs': { architectures: 6, features: 8 },
      'rate-limiting': { architectures: 5, features: 9 },
      webhooks: { architectures: 6, features: 9 },
    });
  });

  it('preserves reviewed ambiguity and adjacency instead of over-resolving terms', async () => {
    const source = await loadSource();
    const taxonomy = canonicalizeCapabilityTaxonomy(source);
    const queueConcepts = [
      'broker-backed-job-queue',
      'database-backed-job-queue',
      'queue-worker-library',
    ];

    for (const aliasKey of ['job-queue', 'worker-queue', 'task-queue']) {
      expect(lookupCapabilityTaxonomyTerm(taxonomy, aliasKey)).toMatchObject({
        kind: 'ambiguous',
        aliasKey,
        possibleConceptIds: queueConcepts,
        clarificationReasonCode: 'adoption-unit-ambiguous',
      });
    }

    const permuted = canonicalizeCapabilityTaxonomy({
      ...source,
      resolvedAliases: [...source.resolvedAliases].reverse(),
      ambiguities: [...source.ambiguities].reverse(),
      exclusions: [...source.exclusions].reverse(),
    });
    for (const aliasKey of ['job-queue', 'worker-queue', 'task-queue']) {
      expect(lookupCapabilityTaxonomyTerm(permuted, aliasKey)).toEqual(
        lookupCapabilityTaxonomyTerm(taxonomy, aliasKey),
      );
    }

    expect(lookupCapabilityTaxonomyTerm(taxonomy, 'cron-scheduler')).toEqual({
      kind: 'resolved',
      aliasKey: 'cron-scheduler',
      conceptId: 'recurring-schedules',
      aliasStatus: 'active',
      replacementAliasKey: null,
    });
    expect(
      lookupCapabilityTaxonomyTerm(taxonomy, 'cron-scheduler'),
    ).not.toMatchObject({ conceptId: 'in-process-scheduler' });

    expect(lookupCapabilityTaxonomyTerm(taxonomy, 'log-router')).toMatchObject({
      kind: 'excluded',
      termKey: 'log-router',
      applicableFamilyIds: ['audit-logging'],
    });
    expect(lookupCapabilityTaxonomyTerm(taxonomy, 'audit-log-router')).toEqual({
      kind: 'resolved',
      aliasKey: 'audit-log-router',
      conceptId: 'audit-pipeline-router',
      aliasStatus: 'active',
      replacementAliasKey: null,
    });

    expect(
      lookupCapabilityTaxonomyTerm(taxonomy, 'hosted-service'),
    ).toMatchObject({
      kind: 'ambiguous',
      aliasKey: 'hosted-service',
      possibleConceptIds: ['external-hosted-service', 'managed-service'],
      clarificationReasonCode: 'adoption-unit-ambiguous',
    });

    for (const [aliasKey, conceptId] of [
      ['authorisation', 'authorization'],
      ['web-hook', 'webhooks'],
    ] as const) {
      expect(lookupCapabilityTaxonomyTerm(taxonomy, aliasKey)).toEqual({
        kind: 'resolved',
        aliasKey,
        conceptId,
        aliasStatus: 'active',
        replacementAliasKey: null,
      });
    }
    expect(
      source.resolvedAliases.filter(({ status }) => status === 'deprecated'),
    ).toEqual([]);

    expect(
      source.concepts.find(({ conceptId }) => conceptId === 'authorization')
        ?.definition,
    ).toBe(
      'Controls which actors or principals may perform actions on protected resources.',
    );
  });

  it('returns bounded diagnostics without rejected taxonomy values', async () => {
    const source = await loadSource();
    const hostile = 'hostile_taxonomy_value_that_must_not_echo';
    const result = parseCapabilityTaxonomySourceV1({
      ...source,
      concepts: source.concepts.map((concept, index) =>
        index === 0 ? { ...concept, conceptId: hostile } : concept,
      ),
    });

    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain(hostile);
    if (!result.ok) {
      expect(result.issues.length).toBeLessThanOrEqual(20);
      expect(result.issues.every(({ message }) => message.length <= 160)).toBe(
        true,
      );
    }
  });

  it('adds two deterministic schema roots without removing existing roots', () => {
    expect(CONTRACT_SCHEMA_NAMES).toContain('capability-taxonomy');
    expect(CONTRACT_SCHEMA_NAMES).toContain('capability-taxonomy-source');
    expect(getContractSchemaV1('capability-taxonomy')).toMatchObject({
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $id: 'https://gitblocks.dev/schemas/contracts/capability-taxonomy/1.0.0',
      additionalProperties: false,
    });
  });
});
