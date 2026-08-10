import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { validateRankingContractConformance } from '../src/ranking/contract-conformance.ts';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

describe('ranking-v1 product contract separation', () => {
  it('proves representability without accepting gold or adding a criterion schema', () => {
    expect(validateRankingContractConformance(REPOSITORY_ROOT)).toEqual({
      ok: true,
      summary: {
        caseCount: 30,
        candidateCount: 150,
        productContractVersion: '1.0.0',
        goldStatus: 'proposed',
        independentReviewStatus: 'not-reviewed',
        purpose: 'representability-and-mapping-completeness-only',
        criterionBindingProductSchemaAdded: false,
      },
      diagnostics: [],
    });
  });
});
