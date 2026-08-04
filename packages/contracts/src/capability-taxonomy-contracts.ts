import {
  canonicalizeCapabilityTaxonomy,
  validateCapabilityTaxonomy,
  type CapabilityTaxonomy,
} from '@gitblocks/domain';

import { contractCanonicalDigest } from './artifact-identity.ts';
import {
  capabilityTaxonomySourceV1Validator,
  capabilityTaxonomyV1Validator,
  structurallyValidate,
} from './structural-validation.ts';
import {
  contractIssue,
  mapDomainIssues,
  type ContractIssue,
  type ContractParseResult,
} from './diagnostics.ts';
import { CONTRACT_VERSION } from './schema-builders.ts';
import type {
  CapabilityTaxonomySourceV1,
  CapabilityTaxonomyV1,
} from './capability-taxonomy-schemas.ts';

export function parseCapabilityTaxonomySourceV1(
  value: unknown,
): ContractParseResult<CapabilityTaxonomySourceV1, CapabilityTaxonomy> {
  const structural = structurallyValidate(
    value,
    capabilityTaxonomySourceV1Validator,
  );
  if (!structural.ok) {
    return structural;
  }
  const semantic = validateCapabilityTaxonomy(structural.value);
  return semantic.ok
    ? { ok: true, value: structural.value, domain: semantic.value, issues: [] }
    : { ok: false, issues: mapDomainIssues(semantic.issues) };
}

export function buildCapabilityTaxonomyV1(
  source: CapabilityTaxonomySourceV1,
): CapabilityTaxonomyV1 {
  const parsed = parseCapabilityTaxonomySourceV1(source);
  if (!parsed.ok) {
    throw new Error('Capability taxonomy source is invalid.');
  }
  const canonical = canonicalizeCapabilityTaxonomy(source);
  const withoutDigest = {
    contractVersion: CONTRACT_VERSION,
    taxonomyVersion: canonical.taxonomyVersion,
    concepts: canonical.concepts,
    resolvedAliases: canonical.resolvedAliases,
    ambiguities: canonical.ambiguities,
    exclusions: canonical.exclusions,
    releaseMetadata: { ...source.releaseMetadata },
  } satisfies Omit<CapabilityTaxonomyV1, 'semanticDigest'>;
  return {
    ...withoutDigest,
    semanticDigest: capabilityTaxonomySemanticDigest(withoutDigest),
  };
}

export function parseCapabilityTaxonomyV1(
  value: unknown,
): ContractParseResult<CapabilityTaxonomyV1, CapabilityTaxonomy> {
  const structural = structurallyValidate(value, capabilityTaxonomyV1Validator);
  if (!structural.ok) {
    return structural;
  }
  const semantic = validateCapabilityTaxonomy(structural.value);
  if (!semantic.ok) {
    return { ok: false, issues: mapDomainIssues(semantic.issues) };
  }
  const expected = buildCapabilityTaxonomyV1({
    taxonomyVersion: structural.value.taxonomyVersion,
    concepts: structural.value.concepts,
    resolvedAliases: structural.value.resolvedAliases,
    ambiguities: structural.value.ambiguities,
    exclusions: structural.value.exclusions,
    releaseMetadata: structural.value.releaseMetadata,
  });
  const issues: ContractIssue[] = [];
  if (
    serializeCapabilityTaxonomyV1(expected) !==
    serializeCapabilityTaxonomyV1(structural.value)
  ) {
    issues.push(
      contractIssue(
        'contract.literal',
        '',
        'Contract value does not match the required literal.',
      ),
    );
  }
  return issues.length === 0
    ? { ok: true, value: structural.value, domain: semantic.value, issues: [] }
    : { ok: false, issues };
}

export function capabilityTaxonomySemanticDigest(
  value: Omit<CapabilityTaxonomyV1, 'semanticDigest'> | CapabilityTaxonomyV1,
): string {
  return contractCanonicalDigest({
    contractVersion: value.contractVersion,
    taxonomyVersion: value.taxonomyVersion,
    concepts: value.concepts,
    resolvedAliases: value.resolvedAliases,
    ambiguities: value.ambiguities,
    exclusions: value.exclusions,
  });
}

export function serializeCapabilityTaxonomyV1(
  value: CapabilityTaxonomyV1,
): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}
