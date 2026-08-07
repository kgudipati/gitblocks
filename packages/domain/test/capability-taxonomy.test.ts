import { describe, expect, it } from 'vitest';

import {
  CAPABILITY_TAXONOMY_CONCEPT_KINDS,
  CAPABILITY_TAXONOMY_LIMITS,
  canonicalizeCapabilityTaxonomy,
  lookupCapabilityTaxonomyTerm,
  validateCapabilityTaxonomy,
} from '../src/index.ts';
import type { CapabilityTaxonomy } from '../src/index.ts';

const families = [
  'authorization',
  'audit-logging',
  'background-jobs',
  'rate-limiting',
  'webhooks',
] as const;

type DeepMutable<Value> = Value extends readonly (infer Entry)[]
  ? DeepMutable<Entry>[]
  : Value extends object
    ? { -readonly [Key in keyof Value]: DeepMutable<Value[Key]> }
    : Value;

function validTaxonomy(): DeepMutable<CapabilityTaxonomy> {
  const concepts = families.flatMap((family) => [
    {
      conceptId: family,
      kind: 'family' as const,
      displayLabel: family,
      definition: `Controlled ${family} capability family.`,
      applicableFamilyIds: [family],
      parentConceptId: null,
      status: 'active' as const,
      replacementConceptId: null,
    },
    {
      conceptId: `${family}-architecture`,
      kind: 'architecture' as const,
      displayLabel: `${family} architecture`,
      definition: `Controlled ${family} adoption-unit architecture.`,
      applicableFamilyIds: [family],
      parentConceptId: family,
      status: 'active' as const,
      replacementConceptId: null,
    },
    {
      conceptId: `${family}-feature`,
      kind: 'feature' as const,
      displayLabel: `${family} feature`,
      definition: `Controlled ${family} capability feature.`,
      applicableFamilyIds: [family],
      parentConceptId: family,
      status: 'active' as const,
      replacementConceptId: null,
    },
  ]);
  const resolvedAliases = concepts.map(({ conceptId }) => ({
    aliasKey: conceptId,
    conceptId,
    status: 'active' as const,
    replacementAliasKey: null,
  }));
  return {
    taxonomyVersion: '1.0.0',
    concepts,
    resolvedAliases,
    ambiguities: [
      {
        aliasKey: 'policy-engine',
        possibleConceptIds: [
          'authorization-architecture',
          'authorization-feature',
        ],
        clarificationReasonCode: 'adoption-unit-ambiguous',
        clarificationContext:
          'Specify whether policy engine means an adoption unit or a feature.',
      },
    ],
    exclusions: [
      {
        termKey: 'authentication',
        applicableFamilyIds: ['authorization'],
        exclusionReasonCode: 'adjacent-capability',
        explanation:
          'Authentication establishes identity and does not alone establish authorization.',
      },
    ],
  };
}

function expectInvalid(value: ReturnType<typeof validTaxonomy>): void {
  expect(validateCapabilityTaxonomy(value).ok).toBe(false);
}

describe('capability taxonomy domain authority', () => {
  it('uses the closed V1 vocabulary and reviewed hard bounds', () => {
    expect(CAPABILITY_TAXONOMY_CONCEPT_KINDS).toEqual([
      'family',
      'architecture',
      'feature',
      'infrastructure',
      'deployment',
    ]);
    expect(CAPABILITY_TAXONOMY_LIMITS).toEqual({
      concepts: 256,
      resolvedAliases: 512,
      ambiguities: 64,
      exclusions: 128,
      hierarchyDepth: 8,
    });
  });

  it('accepts the minimum complete five-family forest', () => {
    const taxonomy = validTaxonomy();
    const result = validateCapabilityTaxonomy(taxonomy);

    expect(result).toMatchObject({ ok: true });
    expect(
      taxonomy.concepts.filter(({ kind }) => kind === 'family'),
    ).toHaveLength(5);
  });

  it('requires the exact five active family roots', () => {
    const taxonomy = validTaxonomy();
    taxonomy.concepts = taxonomy.concepts.filter(
      ({ conceptId }) => conceptId !== 'webhooks',
    );
    expectInvalid(taxonomy);

    const renamed = validTaxonomy();
    renamed.concepts[0] = {
      ...renamed.concepts[0]!,
      conceptId: 'access-management',
    };
    expectInvalid(renamed);
  });

  it('rejects duplicate IDs, missing parents, self-parenting, and cycles', () => {
    const duplicate = validTaxonomy();
    duplicate.concepts.push({ ...duplicate.concepts[0]! });
    expectInvalid(duplicate);

    const missing = validTaxonomy();
    missing.concepts[1] = {
      ...missing.concepts[1]!,
      parentConceptId: 'missing-parent',
    };
    expectInvalid(missing);

    const self = validTaxonomy();
    self.concepts[1] = {
      ...self.concepts[1]!,
      parentConceptId: self.concepts[1]!.conceptId,
    };
    expectInvalid(self);

    const cycle = validTaxonomy();
    cycle.concepts[1] = {
      ...cycle.concepts[1]!,
      parentConceptId: cycle.concepts[2]!.conceptId,
    };
    cycle.concepts[2] = {
      ...cycle.concepts[2]!,
      parentConceptId: cycle.concepts[1].conceptId,
    };
    expectInvalid(cycle);
  });

  it('rejects excessive hierarchy depth and incompatible parent families', () => {
    const deep = validTaxonomy();
    let parent = 'authorization-feature';
    for (
      let index = 0;
      index < CAPABILITY_TAXONOMY_LIMITS.hierarchyDepth;
      index += 1
    ) {
      const conceptId = `authorization-depth-${String(index)}`;
      deep.concepts.push({
        conceptId,
        kind: 'feature',
        displayLabel: `Authorization depth ${String(index)}`,
        definition: 'A test-only controlled authorization hierarchy node.',
        applicableFamilyIds: ['authorization'],
        parentConceptId: parent,
        status: 'active',
        replacementConceptId: null,
      });
      deep.resolvedAliases.push({
        aliasKey: conceptId,
        conceptId,
        status: 'active',
        replacementAliasKey: null,
      });
      parent = conceptId;
    }
    expectInvalid(deep);

    const incompatible = validTaxonomy();
    incompatible.concepts[1] = {
      ...incompatible.concepts[1]!,
      applicableFamilyIds: ['webhooks'],
    };
    expectInvalid(incompatible);
  });

  it('allows one shared concept and rejects duplicate semantic concepts', () => {
    const shared = validTaxonomy();
    shared.concepts.push({
      conceptId: 'retries',
      kind: 'feature',
      displayLabel: 'Retries',
      definition: 'Retry behavior after a failed unit of work or delivery.',
      applicableFamilyIds: ['background-jobs', 'webhooks'],
      parentConceptId: null,
      status: 'active',
      replacementConceptId: null,
    });
    shared.resolvedAliases.push({
      aliasKey: 'retries',
      conceptId: 'retries',
      status: 'active',
      replacementAliasKey: null,
    });
    expect(validateCapabilityTaxonomy(shared).ok).toBe(true);

    shared.concepts.push({
      ...shared.concepts.at(-1)!,
      conceptId: 'retry-behavior',
    });
    expectInvalid(shared);

    const invalidShared = validTaxonomy();
    invalidShared.concepts.push({
      conceptId: 'shared-architecture',
      kind: 'architecture',
      displayLabel: 'Shared architecture',
      definition: 'An invalid cross-family architecture test concept.',
      applicableFamilyIds: ['background-jobs', 'webhooks'],
      parentConceptId: null,
      status: 'active',
      replacementConceptId: null,
    });
    invalidShared.resolvedAliases.push({
      aliasKey: 'shared-architecture',
      conceptId: 'shared-architecture',
      status: 'active',
      replacementAliasKey: null,
    });
    expectInvalid(invalidShared);
  });

  it('rejects alias collisions and overlap between term record classes', () => {
    const duplicate = validTaxonomy();
    duplicate.resolvedAliases.push({
      aliasKey: 'authorization',
      conceptId: 'authorization-feature',
      status: 'active',
      replacementAliasKey: null,
    });
    expectInvalid(duplicate);

    const ambiguousOverlap = validTaxonomy();
    ambiguousOverlap.ambiguities[0] = {
      ...ambiguousOverlap.ambiguities[0]!,
      aliasKey: 'authorization',
    };
    expectInvalid(ambiguousOverlap);

    const excludedOverlap = validTaxonomy();
    excludedOverlap.exclusions[0] = {
      ...excludedOverlap.exclusions[0]!,
      termKey: 'policy-engine',
    };
    expectInvalid(excludedOverlap);
  });

  it('accepts explicit ambiguity but rejects fewer than two distinct targets', () => {
    const taxonomy = validTaxonomy();
    expect(validateCapabilityTaxonomy(taxonomy).ok).toBe(true);

    taxonomy.ambiguities[0] = {
      ...taxonomy.ambiguities[0]!,
      possibleConceptIds: ['authorization-feature', 'authorization-feature'],
    };
    expectInvalid(taxonomy);
  });

  it('validates concept and alias deprecation replacements and cycles', () => {
    const taxonomy = validTaxonomy();
    taxonomy.resolvedAliases.push({
      aliasKey: 'authorisation',
      conceptId: 'authorization',
      status: 'deprecated',
      replacementAliasKey: 'authorization',
    });
    expect(validateCapabilityTaxonomy(taxonomy).ok).toBe(true);

    taxonomy.resolvedAliases.at(-1)!.replacementAliasKey = 'authorisation';
    expectInvalid(taxonomy);

    const conceptCycle = validTaxonomy();
    conceptCycle.concepts[1] = {
      ...conceptCycle.concepts[1]!,
      status: 'deprecated',
      replacementConceptId: conceptCycle.concepts[2]!.conceptId,
    };
    conceptCycle.concepts[2] = {
      ...conceptCycle.concepts[2]!,
      status: 'deprecated',
      replacementConceptId: conceptCycle.concepts[1].conceptId,
    };
    expectInvalid(conceptCycle);
  });

  it('canonicalizes every collection without locale or declaration-order effects', () => {
    const original = validTaxonomy();
    const permuted = {
      ...original,
      concepts: [...original.concepts].reverse(),
      resolvedAliases: [...original.resolvedAliases].reverse(),
      ambiguities: [...original.ambiguities].reverse(),
      exclusions: [...original.exclusions].reverse(),
    };

    expect(canonicalizeCapabilityTaxonomy(permuted)).toEqual(
      canonicalizeCapabilityTaxonomy(original),
    );

    const originalLocaleCompare = Object.getOwnPropertyDescriptor(
      String.prototype,
      'localeCompare',
    );
    if (originalLocaleCompare === undefined) {
      throw new Error('String localeCompare descriptor must exist.');
    }
    try {
      Object.defineProperty(String.prototype, 'localeCompare', {
        ...originalLocaleCompare,
        value: () => {
          throw new Error('Taxonomy ordering must not use locale comparison.');
        },
      });
      expect(canonicalizeCapabilityTaxonomy(permuted)).toEqual(
        canonicalizeCapabilityTaxonomy(original),
      );
    } finally {
      Object.defineProperty(
        String.prototype,
        'localeCompare',
        originalLocaleCompare,
      );
    }
  });

  it('performs exact ASCII lookup only, with no fuzzy or prefix behavior', () => {
    const taxonomy = canonicalizeCapabilityTaxonomy(validTaxonomy());

    expect(lookupCapabilityTaxonomyTerm(taxonomy, 'authorization')).toEqual({
      kind: 'resolved',
      aliasKey: 'authorization',
      conceptId: 'authorization',
      aliasStatus: 'active',
      replacementAliasKey: null,
    });
    expect(
      lookupCapabilityTaxonomyTerm(taxonomy, 'policy-engine'),
    ).toMatchObject({
      kind: 'ambiguous',
    });
    expect(
      lookupCapabilityTaxonomyTerm(taxonomy, 'authentication'),
    ).toMatchObject({
      kind: 'excluded',
    });
    for (const input of [
      'Authorization',
      'authoriz',
      'authorisation',
      'аuthorization',
      'authorization-service-extra',
    ]) {
      expect(lookupCapabilityTaxonomyTerm(taxonomy, input)).toEqual({
        kind: 'unknown',
      });
    }
  });
});
