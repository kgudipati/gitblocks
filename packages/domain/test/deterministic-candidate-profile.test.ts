import { describe, expect, it } from 'vitest';

import {
  DETERMINISTIC_PROFILE_FIELD_IDS,
  getDeterministicProfileFieldRegistry,
  validateDeterministicProfileFieldRegistry,
} from '../src/index.ts';

const expectedFieldIds = [
  'catalog-role-status',
  'capability-family',
  'repository-identity',
  'adoption-unit-type',
  'capability-variants-features',
  'repository-discovery-metadata',
  'language-ecosystem',
  'package-identity-mapping',
  'package-publication-version',
  'runtime-package-format',
  'framework-compatibility',
  'datastore-requirements',
  'required-infrastructure',
  'optional-infrastructure',
  'deployment-self-hosting',
  'license-identity',
  'archived-state',
  'fork-upstream-state',
  'maintenance-activity',
  'release-state-recency',
  'security-advisory-state',
  'security-policy-presence',
  'documentation-presence',
  'test-ci-presence',
  'artifact-chunk-availability',
  'package-repository-linkage',
  'operational-complexity-primitives',
] as const;

describe('deterministic candidate profile field registry', () => {
  it('owns the exact immutable 27-field vocabulary, order, and scope partition', () => {
    expect(DETERMINISTIC_PROFILE_FIELD_IDS).toEqual(expectedFieldIds);
    const registry = getDeterministicProfileFieldRegistry();
    expect(registry.map(({ fieldId }) => fieldId)).toEqual(expectedFieldIds);
    expect(registry.map(({ ordinal }) => ordinal)).toEqual(
      Array.from({ length: 27 }, (_, index) => index + 1),
    );
    expect(
      registry
        .filter(({ scope }) => scope === 'candidate-wide')
        .map(({ fieldId }) => fieldId),
    ).toEqual([
      'catalog-role-status',
      'capability-family',
      'repository-identity',
      'adoption-unit-type',
      'capability-variants-features',
      'package-identity-mapping',
    ]);
    expect(() => {
      (registry as unknown as { push(value: unknown): void }).push({});
    }).toThrow();
    expect(() => {
      Object.assign(registry[0] as object, { scope: 'version-specific' });
    }).toThrow();
  });

  it('rejects duplicate, missing, wrong-scope, and invalid facet definitions', () => {
    const valid = getDeterministicProfileFieldRegistry();
    expect(validateDeterministicProfileFieldRegistry(valid).ok).toBe(true);
    expect(
      validateDeterministicProfileFieldRegistry([...valid, valid[0]!]).ok,
    ).toBe(false);
    expect(validateDeterministicProfileFieldRegistry(valid.slice(1)).ok).toBe(
      false,
    );
    expect(
      validateDeterministicProfileFieldRegistry([
        { ...valid[0]!, scope: 'version-specific' },
        ...valid.slice(1),
      ]).ok,
    ).toBe(false);
    expect(
      validateDeterministicProfileFieldRegistry([
        {
          ...valid[0]!,
          launchHardFilterFacet: 'unregistered-hard-filter',
        },
        ...valid.slice(1),
      ]).ok,
    ).toBe(false);
  });
});
