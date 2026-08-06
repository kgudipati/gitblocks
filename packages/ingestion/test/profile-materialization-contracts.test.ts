import { describe, expect, it } from 'vitest';

import {
  PROFILE_MATERIALIZATION_COVERAGE_VERSION,
  PROFILE_MATERIALIZATION_OPERATOR_VERSION,
  PROFILE_MATERIALIZATION_PROVIDER_POLICY_VERSION,
  PROFILE_MATERIALIZATION_RECEIPT_VERSION,
  PROFILE_MATERIALIZATION_SOURCE_AUTHORITY_VERSION,
  createProfileMaterializationReceipt,
} from '../src/profile-materialization-contracts.ts';
import {
  deriveProfileMaterializationRequestBudget,
  validateProfileMaterializationProviderPolicy,
} from '../src/profile-materialization-policy.ts';
import { parseProfileMaterializationSourceAuthority } from '../src/profile-materialization-source-authority.ts';
import {
  loadCatalogFixture,
  loadMaterializationPolicyFixture,
} from './profile-materialization-fixtures.ts';

describe('profile-materialization operational contracts', () => {
  it('freezes the reviewed operational versions', () => {
    expect(PROFILE_MATERIALIZATION_OPERATOR_VERSION).toBe(
      'profile-materialization-operator/1.0.0',
    );
    expect(PROFILE_MATERIALIZATION_PROVIDER_POLICY_VERSION).toBe(
      'profile-materialization-provider-policy/1.0.0',
    );
    expect(PROFILE_MATERIALIZATION_SOURCE_AUTHORITY_VERSION).toBe(
      'profile-materialization-source-authority/1.0.0',
    );
    expect(PROFILE_MATERIALIZATION_COVERAGE_VERSION).toBe(
      'profile-materialization-coverage/1.0.0',
    );
    expect(PROFILE_MATERIALIZATION_RECEIPT_VERSION).toBe(
      'profile-materialization-receipt/1.0.0',
    );
  });

  it('derives the request budget from the catalog and rejects stored drift', async () => {
    const catalog = await loadCatalogFixture();
    const policy = await loadMaterializationPolicyFixture(catalog);
    expect(deriveProfileMaterializationRequestBudget(catalog, policy)).toEqual(
      policy.maximumRequestBudget,
    );
    expect(policy.maximumRequestBudget.total).toBe(913);

    const drifted = structuredClone(policy) as unknown as Record<
      string,
      unknown
    >;
    (drifted['maximumRequestBudget'] as Record<string, unknown>)['total'] = 912;
    expect(() =>
      validateProfileMaterializationProviderPolicy(drifted, catalog),
    ).toThrow();
  });

  it('closes the exact two-host, GET-only, same-host policy', async () => {
    const catalog = await loadCatalogFixture();
    const policy = await loadMaterializationPolicyFixture(catalog);
    expect(policy.transport.allowedHosts).toEqual([
      'api.github.com',
      'registry.npmjs.org',
    ]);
    expect(policy.transport).toMatchObject({
      scheme: 'https',
      effectivePort: 443,
      methods: ['GET'],
      redirectPolicy: 'manual-same-host',
      cache: 'none',
    });
    expect(policy.operations).toHaveLength(9);
    expect(
      policy.operations.every(
        (operation) =>
          operation.maximumRedirects === 2 &&
          policy.transport.allowedHosts.includes(operation.host),
      ),
    ).toBe(true);

    const broadened = structuredClone(policy) as unknown as Record<
      string,
      unknown
    >;
    (broadened['transport'] as Record<string, unknown>)['allowedHosts'] = [
      'api.github.com',
      'registry.npmjs.org',
      'raw.githubusercontent.com',
    ];
    expect(() =>
      validateProfileMaterializationProviderPolicy(broadened, catalog),
    ).toThrow();
  });

  it('does not authenticate a source authority or receipt by shape alone', () => {
    expect(() => parseProfileMaterializationSourceAuthority({})).toThrow();
    expect(() => createProfileMaterializationReceipt({} as never)).toThrow();
  });
});
