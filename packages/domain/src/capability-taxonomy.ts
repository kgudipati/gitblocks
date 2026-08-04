import {
  addIssue,
  addStableIdIssues,
  compareText,
  resultFromIssues,
  type DomainIssue,
  type DomainResult,
} from './issues.ts';
import { getCapabilityFamilies, type CapabilityFamily } from './model.ts';

export const CAPABILITY_TAXONOMY_CONCEPT_KINDS = Object.freeze([
  'family',
  'architecture',
  'feature',
  'infrastructure',
  'deployment',
] as const);

export const CAPABILITY_TAXONOMY_LIMITS = Object.freeze({
  concepts: 256,
  resolvedAliases: 512,
  ambiguities: 64,
  exclusions: 128,
  hierarchyDepth: 8,
} as const);

export type CapabilityTaxonomyConceptKind =
  (typeof CAPABILITY_TAXONOMY_CONCEPT_KINDS)[number];
export type CapabilityTaxonomyRecordStatus = 'active' | 'deprecated';

export interface CapabilityTaxonomyConcept {
  readonly conceptId: string;
  readonly kind: CapabilityTaxonomyConceptKind;
  readonly displayLabel: string;
  readonly definition: string;
  readonly applicableFamilyIds: readonly CapabilityFamily[];
  readonly parentConceptId: string | null;
  readonly status: CapabilityTaxonomyRecordStatus;
  readonly replacementConceptId: string | null;
}

export interface CapabilityTaxonomyResolvedAlias {
  readonly aliasKey: string;
  readonly conceptId: string;
  readonly status: CapabilityTaxonomyRecordStatus;
  readonly replacementAliasKey: string | null;
}

export interface CapabilityTaxonomyAmbiguity {
  readonly aliasKey: string;
  readonly possibleConceptIds: readonly string[];
  readonly clarificationReasonCode: string;
  readonly clarificationContext: string;
}

export interface CapabilityTaxonomyExclusion {
  readonly termKey: string;
  readonly applicableFamilyIds: readonly CapabilityFamily[];
  readonly exclusionReasonCode: string;
  readonly explanation: string;
}

export interface CapabilityTaxonomy {
  readonly taxonomyVersion: string;
  readonly concepts: readonly CapabilityTaxonomyConcept[];
  readonly resolvedAliases: readonly CapabilityTaxonomyResolvedAlias[];
  readonly ambiguities: readonly CapabilityTaxonomyAmbiguity[];
  readonly exclusions: readonly CapabilityTaxonomyExclusion[];
}

export type CapabilityTaxonomyLookupResult =
  | {
      readonly kind: 'resolved';
      readonly aliasKey: string;
      readonly conceptId: string;
      readonly aliasStatus: CapabilityTaxonomyRecordStatus;
      readonly replacementAliasKey: string | null;
    }
  | ({ readonly kind: 'ambiguous' } & CapabilityTaxonomyAmbiguity)
  | ({ readonly kind: 'excluded' } & CapabilityTaxonomyExclusion)
  | { readonly kind: 'unknown' };

const EXACT_TAXONOMY_VERSION = '1.0.0';
const CANONICAL_KEY_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/u;

export function validateCapabilityTaxonomy(
  taxonomy: CapabilityTaxonomy,
): DomainResult<CapabilityTaxonomy> {
  const issues: DomainIssue[] = [];
  if (taxonomy.taxonomyVersion !== EXACT_TAXONOMY_VERSION) {
    addIssue(issues, 'taxonomy.invariant', 'taxonomyVersion');
  }
  validateBounds(taxonomy, issues);

  const concepts = indexUnique(
    taxonomy.concepts,
    ({ conceptId }) => conceptId,
    'concepts',
    issues,
  );
  validateConcepts(taxonomy, concepts, issues);
  validateAliases(taxonomy, concepts, issues);
  validateTermRecords(taxonomy, concepts, issues);
  validateFamilyCoverage(taxonomy, issues);

  return resultFromIssues(canonicalizeCapabilityTaxonomy(taxonomy), issues);
}

export function canonicalizeCapabilityTaxonomy<T extends CapabilityTaxonomy>(
  taxonomy: T,
): T {
  return {
    ...taxonomy,
    concepts: taxonomy.concepts
      .map((concept) => ({
        ...concept,
        applicableFamilyIds: [...concept.applicableFamilyIds].sort(compareText),
      }))
      .sort((left, right) => compareText(left.conceptId, right.conceptId)),
    resolvedAliases: taxonomy.resolvedAliases
      .map((alias) => ({ ...alias }))
      .sort((left, right) => compareText(left.aliasKey, right.aliasKey)),
    ambiguities: taxonomy.ambiguities
      .map((ambiguity) => ({
        ...ambiguity,
        possibleConceptIds: [...ambiguity.possibleConceptIds].sort(compareText),
      }))
      .sort((left, right) => compareText(left.aliasKey, right.aliasKey)),
    exclusions: taxonomy.exclusions
      .map((exclusion) => ({
        ...exclusion,
        applicableFamilyIds: [...exclusion.applicableFamilyIds].sort(
          compareText,
        ),
      }))
      .sort((left, right) => compareText(left.termKey, right.termKey)),
  };
}

export function lookupCapabilityTaxonomyTerm(
  taxonomy: CapabilityTaxonomy,
  canonicalKey: string,
): CapabilityTaxonomyLookupResult {
  if (!CANONICAL_KEY_PATTERN.test(canonicalKey)) {
    return { kind: 'unknown' };
  }
  const resolved = taxonomy.resolvedAliases.find(
    ({ aliasKey }) => aliasKey === canonicalKey,
  );
  if (resolved !== undefined) {
    return {
      kind: 'resolved',
      aliasKey: resolved.aliasKey,
      conceptId: resolved.conceptId,
      aliasStatus: resolved.status,
      replacementAliasKey: resolved.replacementAliasKey,
    };
  }
  const ambiguous = taxonomy.ambiguities.find(
    ({ aliasKey }) => aliasKey === canonicalKey,
  );
  if (ambiguous !== undefined) {
    return { kind: 'ambiguous', ...ambiguous };
  }
  const excluded = taxonomy.exclusions.find(
    ({ termKey }) => termKey === canonicalKey,
  );
  if (excluded !== undefined) {
    return { kind: 'excluded', ...excluded };
  }
  return { kind: 'unknown' };
}

function validateBounds(
  taxonomy: CapabilityTaxonomy,
  issues: DomainIssue[],
): void {
  for (const [path, count, maximum] of [
    ['concepts', taxonomy.concepts.length, CAPABILITY_TAXONOMY_LIMITS.concepts],
    [
      'resolvedAliases',
      taxonomy.resolvedAliases.length,
      CAPABILITY_TAXONOMY_LIMITS.resolvedAliases,
    ],
    [
      'ambiguities',
      taxonomy.ambiguities.length,
      CAPABILITY_TAXONOMY_LIMITS.ambiguities,
    ],
    [
      'exclusions',
      taxonomy.exclusions.length,
      CAPABILITY_TAXONOMY_LIMITS.exclusions,
    ],
  ] as const) {
    if (count > maximum) {
      addIssue(issues, 'taxonomy.invariant', path);
    }
  }
}

function validateConcepts(
  taxonomy: CapabilityTaxonomy,
  concepts: ReadonlyMap<string, CapabilityTaxonomyConcept>,
  issues: DomainIssue[],
): void {
  const familySet = new Set<string>(getCapabilityFamilies());
  const semanticRecords = new Set<string>();
  for (const [index, concept] of taxonomy.concepts.entries()) {
    const path = `concepts.${String(index)}`;
    addStableIdIssues(issues, concept.conceptId, `${path}.conceptId`);
    validateFamilyIds(
      concept.applicableFamilyIds,
      familySet,
      `${path}.applicableFamilyIds`,
      issues,
    );
    if (
      concept.applicableFamilyIds.length > 1 &&
      concept.kind !== 'feature' &&
      concept.kind !== 'infrastructure' &&
      concept.kind !== 'deployment'
    ) {
      addIssue(issues, 'taxonomy.invariant', `${path}.applicableFamilyIds`);
    }
    if (concept.parentConceptId !== null) {
      addStableIdIssues(
        issues,
        concept.parentConceptId,
        `${path}.parentConceptId`,
      );
      const parent = concepts.get(concept.parentConceptId);
      if (parent === undefined || parent === concept) {
        addIssue(issues, 'taxonomy.hierarchy', `${path}.parentConceptId`);
      } else if (
        !concept.applicableFamilyIds.every((family) =>
          parent.applicableFamilyIds.includes(family),
        )
      ) {
        addIssue(issues, 'taxonomy.hierarchy', `${path}.applicableFamilyIds`);
      }
    }
    validateReplacement(
      concept.status,
      concept.replacementConceptId,
      concept.conceptId,
      concepts,
      `${path}.replacementConceptId`,
      issues,
    );
    const semanticKey = JSON.stringify([
      concept.kind,
      concept.displayLabel,
      concept.definition,
      [...concept.applicableFamilyIds].sort(compareText),
      concept.parentConceptId,
    ]);
    if (semanticRecords.has(semanticKey)) {
      addIssue(issues, 'taxonomy.collision', path);
    }
    semanticRecords.add(semanticKey);
  }

  validateFamilyRoots(taxonomy, issues);
  validateParentForest(taxonomy, concepts, issues);
  validateReplacementForest(taxonomy.concepts, concepts, issues);
}

function validateFamilyRoots(
  taxonomy: CapabilityTaxonomy,
  issues: DomainIssue[],
): void {
  const expected = getCapabilityFamilies();
  const roots = taxonomy.concepts
    .filter(({ kind, status }) => kind === 'family' && status === 'active')
    .map(({ conceptId }) => conceptId)
    .sort(compareText);
  if (
    JSON.stringify(roots) !== JSON.stringify([...expected].sort(compareText))
  ) {
    addIssue(issues, 'taxonomy.family-root', 'concepts');
  }
  for (const family of expected) {
    const root = taxonomy.concepts.find(
      ({ conceptId }) => conceptId === family,
    );
    if (
      root?.kind !== 'family' ||
      root.parentConceptId !== null ||
      root.status !== 'active' ||
      root.replacementConceptId !== null ||
      root.applicableFamilyIds.length !== 1 ||
      root.applicableFamilyIds[0] !== family
    ) {
      addIssue(issues, 'taxonomy.family-root', `concepts.${family}`);
    }
  }
}

function validateParentForest(
  taxonomy: CapabilityTaxonomy,
  concepts: ReadonlyMap<string, CapabilityTaxonomyConcept>,
  issues: DomainIssue[],
): void {
  for (const [index, concept] of taxonomy.concepts.entries()) {
    let current: CapabilityTaxonomyConcept | undefined = concept;
    const seen = new Set<string>();
    let depth = 0;
    while (current !== undefined && current.parentConceptId !== null) {
      if (seen.has(current.conceptId)) {
        addIssue(
          issues,
          'taxonomy.hierarchy',
          `concepts.${String(index)}.parentConceptId`,
        );
        break;
      }
      seen.add(current.conceptId);
      depth += 1;
      if (depth >= CAPABILITY_TAXONOMY_LIMITS.hierarchyDepth) {
        addIssue(
          issues,
          'taxonomy.hierarchy',
          `concepts.${String(index)}.parentConceptId`,
        );
        break;
      }
      current = concepts.get(current.parentConceptId);
    }
  }
}

function validateAliases(
  taxonomy: CapabilityTaxonomy,
  concepts: ReadonlyMap<string, CapabilityTaxonomyConcept>,
  issues: DomainIssue[],
): void {
  const aliases = indexUnique(
    taxonomy.resolvedAliases,
    ({ aliasKey }) => aliasKey,
    'resolvedAliases',
    issues,
  );
  for (const [index, alias] of taxonomy.resolvedAliases.entries()) {
    const path = `resolvedAliases.${String(index)}`;
    addStableIdIssues(issues, alias.aliasKey, `${path}.aliasKey`);
    const concept = concepts.get(alias.conceptId);
    if (concept?.status !== 'active') {
      addIssue(issues, 'taxonomy.deprecation', `${path}.conceptId`);
    }
    if (alias.status === 'active') {
      if (alias.replacementAliasKey !== null) {
        addIssue(issues, 'taxonomy.deprecation', `${path}.replacementAliasKey`);
      }
    } else if (alias.replacementAliasKey === null) {
      addIssue(issues, 'taxonomy.deprecation', `${path}.replacementAliasKey`);
    }
  }
  for (const [index, alias] of taxonomy.resolvedAliases.entries()) {
    if (alias.status !== 'deprecated') {
      continue;
    }
    let current: CapabilityTaxonomyResolvedAlias = alias;
    const seen = new Set<string>();
    while (current.status === 'deprecated') {
      if (seen.has(current.aliasKey) || current.replacementAliasKey === null) {
        addIssue(
          issues,
          'taxonomy.deprecation',
          `resolvedAliases.${String(index)}`,
        );
        break;
      }
      seen.add(current.aliasKey);
      const replacement = aliases.get(current.replacementAliasKey);
      if (replacement?.conceptId !== alias.conceptId) {
        addIssue(
          issues,
          'taxonomy.deprecation',
          `resolvedAliases.${String(index)}`,
        );
        break;
      }
      current = replacement;
    }
  }
}

function validateTermRecords(
  taxonomy: CapabilityTaxonomy,
  concepts: ReadonlyMap<string, CapabilityTaxonomyConcept>,
  issues: DomainIssue[],
): void {
  const keys = new Set<string>();
  for (const [index, alias] of taxonomy.resolvedAliases.entries()) {
    addTermKey(
      keys,
      alias.aliasKey,
      `resolvedAliases.${String(index)}.aliasKey`,
      issues,
    );
  }
  for (const [index, ambiguity] of taxonomy.ambiguities.entries()) {
    const path = `ambiguities.${String(index)}`;
    addStableIdIssues(issues, ambiguity.aliasKey, `${path}.aliasKey`);
    addStableIdIssues(
      issues,
      ambiguity.clarificationReasonCode,
      `${path}.clarificationReasonCode`,
    );
    addTermKey(keys, ambiguity.aliasKey, `${path}.aliasKey`, issues);
    const targets = new Set(ambiguity.possibleConceptIds);
    if (
      targets.size < 2 ||
      targets.size !== ambiguity.possibleConceptIds.length
    ) {
      addIssue(issues, 'taxonomy.ambiguity', `${path}.possibleConceptIds`);
    }
    for (const conceptId of targets) {
      const concept = concepts.get(conceptId);
      if (concept?.status !== 'active') {
        addIssue(issues, 'taxonomy.ambiguity', `${path}.possibleConceptIds`);
      }
    }
  }
  const familySet = new Set<string>(getCapabilityFamilies());
  for (const [index, exclusion] of taxonomy.exclusions.entries()) {
    const path = `exclusions.${String(index)}`;
    addStableIdIssues(issues, exclusion.termKey, `${path}.termKey`);
    addStableIdIssues(
      issues,
      exclusion.exclusionReasonCode,
      `${path}.exclusionReasonCode`,
    );
    addTermKey(keys, exclusion.termKey, `${path}.termKey`, issues);
    validateFamilyIds(
      exclusion.applicableFamilyIds,
      familySet,
      `${path}.applicableFamilyIds`,
      issues,
    );
  }
}

function validateFamilyCoverage(
  taxonomy: CapabilityTaxonomy,
  issues: DomainIssue[],
): void {
  for (const family of getCapabilityFamilies()) {
    for (const kind of ['architecture', 'feature'] as const) {
      if (
        !taxonomy.concepts.some(
          (concept) =>
            concept.status === 'active' &&
            concept.kind === kind &&
            concept.applicableFamilyIds.includes(family),
        )
      ) {
        addIssue(issues, 'taxonomy.coverage', `concepts.${family}.${kind}`);
      }
    }
  }
}

function validateFamilyIds(
  values: readonly CapabilityFamily[],
  familySet: ReadonlySet<string>,
  path: string,
  issues: DomainIssue[],
): void {
  if (values.length === 0 || new Set(values).size !== values.length) {
    addIssue(issues, 'taxonomy.invariant', path);
  }
  for (const value of values) {
    if (!familySet.has(value)) {
      addIssue(issues, 'taxonomy.invariant', path);
    }
  }
}

function validateReplacement(
  status: CapabilityTaxonomyRecordStatus,
  replacementId: string | null,
  id: string,
  concepts: ReadonlyMap<string, CapabilityTaxonomyConcept>,
  path: string,
  issues: DomainIssue[],
): void {
  if (status === 'active') {
    if (replacementId !== null) {
      addIssue(issues, 'taxonomy.deprecation', path);
    }
    return;
  }
  if (
    replacementId === null ||
    replacementId === id ||
    !concepts.has(replacementId)
  ) {
    addIssue(issues, 'taxonomy.deprecation', path);
  }
}

function validateReplacementForest(
  values: readonly CapabilityTaxonomyConcept[],
  concepts: ReadonlyMap<string, CapabilityTaxonomyConcept>,
  issues: DomainIssue[],
): void {
  for (const [index, concept] of values.entries()) {
    if (concept.status !== 'deprecated') {
      continue;
    }
    let current: CapabilityTaxonomyConcept = concept;
    const seen = new Set<string>();
    while (current.status === 'deprecated') {
      if (
        seen.has(current.conceptId) ||
        current.replacementConceptId === null
      ) {
        addIssue(issues, 'taxonomy.deprecation', `concepts.${String(index)}`);
        break;
      }
      seen.add(current.conceptId);
      const replacement = concepts.get(current.replacementConceptId);
      if (replacement?.kind !== concept.kind) {
        addIssue(issues, 'taxonomy.deprecation', `concepts.${String(index)}`);
        break;
      }
      current = replacement;
    }
  }
}

function addTermKey(
  keys: Set<string>,
  key: string,
  path: string,
  issues: DomainIssue[],
): void {
  if (keys.has(key)) {
    addIssue(issues, 'taxonomy.collision', path);
  }
  keys.add(key);
}

function indexUnique<Value>(
  values: readonly Value[],
  keyOf: (value: Value) => string,
  path: string,
  issues: DomainIssue[],
): ReadonlyMap<string, Value> {
  const indexed = new Map<string, Value>();
  for (const [index, value] of values.entries()) {
    const key = keyOf(value);
    if (indexed.has(key)) {
      addIssue(issues, 'taxonomy.collision', `${path}.${String(index)}`);
    } else {
      indexed.set(key, value);
    }
  }
  return indexed;
}
